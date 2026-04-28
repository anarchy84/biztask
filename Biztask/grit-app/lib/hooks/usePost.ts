// 한글 주석: 단일 게시글 + 댓글 조회 훅 (상세 화면용)
//
// ▣ 이 훅이 하는 일:
//   - posts 테이블에서 id로 단건 조회 (author join)
//   - comments 테이블에서 post_id로 목록 조회 (author join, 최신순)
//   - 내가 누른 reaction 주입 (post + comments)
//   - 로컬 낙관적 업데이트(optimistic) 위한 setters 제공
//
// ▣ 사용 예:
//   const { post, comments, loading, error, refresh,
//           applyMyReaction, applyReactionDelta } = usePost(id)
//
// ▣ 낙관적 업데이트 흐름:
//   1) 사용자가 ♥ 탭 → applyMyReaction('post', id, 'like') 즉시 호출
//   2) UI는 이미 새 상태로 그려짐 (체감 속도 ↑)
//   3) Supabase 쓰기는 useReaction 훅에서 백그라운드 진행
//   4) 실패하면 onError에서 롤백

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  mapPost,
  mapComments,
  injectMyReaction,
  type PostRowWithAuthor,
  type CommentRowWithAuthor,
} from '@/lib/mappers'
import type { Post, Comment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

export interface UsePostReturn {
  post: Post | null
  comments: Comment[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  // 한글 주석: 낙관적 업데이트용 setters
  //   - 로컬 상태만 조정 (DB 쓰기는 useReaction에서)
  applyMyReaction: (
    target: 'post' | 'comment',
    targetId: string,
    reaction: 'like' | 'dislike' | null,
  ) => void
  applyReactionDelta: (
    target: 'post' | 'comment',
    targetId: string,
    likeDelta: number,
    dislikeDelta: number,
  ) => void
  // 한글 주석: 댓글 insert 직후 로컬에 append
  appendComment: (c: Comment) => void
}

export function usePost(id: string | undefined): UsePostReturn {
  const { user } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ─────────────────────────────────────────────
  // 한글 주석: fetch 로직 (post + comments 병렬)
  // ─────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!id) {
      setError('게시글 ID가 없어')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1) post + comments 병렬 조회 (네트워크 왕복 최소화)
      const [postRes, commentsRes] = await Promise.all([
        // 한글 주석: PostgREST self-relation cache 이슈 회피
        //   posts → posts (quoted_post_id) 자기참조는 cache 인식 불안정.
        //   인용글 본문이 필요하면 별도 fetch (quoted_post_id 있을 때만).
        supabase
          .from('posts')
          .select('*, author:profiles!author_id(*)')
          .eq('id', id)
          .eq('is_deleted', false)
          .maybeSingle(),
        supabase
          .from('comments')
          .select('*, author:profiles!author_id(*)')
          .eq('post_id', id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true }),
      ])

      if (postRes.error) throw new Error(postRes.error.message)
      if (!postRes.data) {
        throw new Error('게시글을 찾을 수 없어 (삭제됐거나 잘못된 ID)')
      }
      if (commentsRes.error) throw new Error(commentsRes.error.message)

      let mappedPost = mapPost(postRes.data as unknown as PostRowWithAuthor)
      let mappedComments = mapComments(
        (commentsRes.data ?? []) as CommentRowWithAuthor[],
      )

      // 2) 내 반응 조회 (post + comments 한 번에)
      if (user?.id) {
        const commentIds = mappedComments.map((c) => c.id)
        const allIds = [mappedPost.id, ...commentIds]

        const { data: myReactions, error: reactErr } = await supabase
          .from('reactions')
          .select('target_id, target_type, type')
          .eq('user_id', user.id)
          .in('target_id', allIds)

        if (!reactErr && myReactions) {
          // post 쪽 반응
          const postReactions = myReactions.filter((r) => r.target_type === 'post')
          const [enrichedPost] = injectMyReaction(
            [mappedPost],
            postReactions as { target_id: string; type: 'like' | 'dislike' }[],
          )
          mappedPost = enrichedPost

          // comment 쪽 반응
          const commentReactions = myReactions.filter((r) => r.target_type === 'comment')
          mappedComments = injectMyReaction(
            mappedComments,
            commentReactions as { target_id: string; type: 'like' | 'dislike' }[],
          )
        }
      }

      setPost(mappedPost)
      setComments(mappedComments)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 에러'
      console.error('[usePost] 조회 실패:', msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [id, user?.id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ─────────────────────────────────────────────
  // 한글 주석: 낙관적 업데이트 - 내 반응 갱신
  // ─────────────────────────────────────────────
  const applyMyReaction = useCallback(
    (
      target: 'post' | 'comment',
      targetId: string,
      reaction: 'like' | 'dislike' | null,
    ) => {
      if (target === 'post') {
        setPost((prev) =>
          prev && prev.id === targetId ? { ...prev, myReaction: reaction } : prev,
        )
      } else {
        setComments((prev) =>
          prev.map((c) => (c.id === targetId ? { ...c, myReaction: reaction } : c)),
        )
      }
    },
    [],
  )

  // ─────────────────────────────────────────────
  // 한글 주석: 낙관적 업데이트 - 카운터 증감
  //   - Supabase 트리거가 실제 카운터를 바꾸지만
  //   - 체감 반응 속도 위해 로컬도 즉시 반영
  // ─────────────────────────────────────────────
  const applyReactionDelta = useCallback(
    (
      target: 'post' | 'comment',
      targetId: string,
      likeDelta: number,
      dislikeDelta: number,
    ) => {
      if (target === 'post') {
        setPost((prev) =>
          prev && prev.id === targetId
            ? {
                ...prev,
                likeCount: Math.max(0, prev.likeCount + likeDelta),
                dislikeCount: Math.max(0, prev.dislikeCount + dislikeDelta),
              }
            : prev,
        )
      } else {
        setComments((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  likeCount: Math.max(0, c.likeCount + likeDelta),
                  dislikeCount: Math.max(0, c.dislikeCount + dislikeDelta),
                }
              : c,
          ),
        )
      }
    },
    [],
  )

  // 한글 주석: 댓글 insert 후 바로 화면에 반영
  const appendComment = useCallback((c: Comment) => {
    setComments((prev) => [...prev, c])
    setPost((prev) =>
      prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev,
    )
  }, [])

  return {
    post,
    comments,
    loading,
    error,
    refresh: fetchAll,
    applyMyReaction,
    applyReactionDelta,
    appendComment,
  }
}
