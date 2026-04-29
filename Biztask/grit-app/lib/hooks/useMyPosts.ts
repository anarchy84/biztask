// 한글 주석: 프로필 "내 게시물" 탭용 게시글 목록 훅
//
// ▣ 내가 작성한 posts를 최신순으로 불러온다.
// ▣ PostCard 렌더링에 필요한 author join과 myReaction 주입까지 처리한다.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { injectMyReaction, mapPosts, type PostRowWithAuthor } from '@/lib/mappers'
import type { Post } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { toUserFacingError } from '@/lib/errors'

const MY_POSTS_LIMIT = 30

export interface UseMyPostsReturn {
  posts: Post[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  applyPostReaction: (
    postId: string,
    reaction: 'like' | 'dislike' | null,
    likeDelta: number,
    dislikeDelta: number,
  ) => void
}

/** 한글 주석: 로그인한 사용자의 게시글 목록을 프로필 탭에 공급한다. */
export function useMyPosts(): UseMyPostsReturn {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPosts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchErr } = await supabase
        .from('posts')
        .select('*, author:profiles!author_id(*)')
        .eq('author_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(MY_POSTS_LIMIT)

      if (fetchErr) throw fetchErr

      let mapped = mapPosts((data ?? []) as unknown as PostRowWithAuthor[])

      if (mapped.length > 0) {
        const { data: myReactions, error: reactErr } = await supabase
          .from('reactions')
          .select('target_id, type')
          .eq('user_id', user.id)
          .eq('target_type', 'post')
          .in('target_id', mapped.map((post) => post.id))

        if (!reactErr && myReactions) {
          mapped = injectMyReaction(
            mapped,
            myReactions as { target_id: string; type: 'like' | 'dislike' }[],
          )
        }
      }

      setPosts(mapped)
    } catch (e) {
      setError(toUserFacingError(e, '내 게시물을 불러오지 못했어'))
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const applyPostReaction = useCallback(
    (
      postId: string,
      reaction: 'like' | 'dislike' | null,
      likeDelta: number,
      dislikeDelta: number,
    ) => {
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                myReaction: reaction,
                likeCount: Math.max(0, post.likeCount + likeDelta),
                dislikeCount: Math.max(0, post.dislikeCount + dislikeDelta),
              }
            : post,
        ),
      )
    },
    [],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    posts,
    loading,
    error,
    refresh,
    applyPostReaction,
  }
}
