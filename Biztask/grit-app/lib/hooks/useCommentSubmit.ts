// 한글 주석: 댓글 작성 훅 (insert + 로컬 반영)
//
// ▣ 이 훅이 하는 일:
//   - comments 테이블에 insert
//   - insert 성공 시 onSuccess 콜백으로 새 Comment 객체 넘겨줌
//     → usePost의 appendComment에 연결하면 리스트에 바로 추가
//   - DB 트리거(bump_post_comment_count)가 posts.comment_count 자동 증가
//
// ▣ 사용 예:
//   const { submit, submitting, error } = useCommentSubmit({
//     postId: post.id,
//     onSuccess: (c) => appendComment(c),
//   })
//   await submit(commentInput)

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapComment, type CommentRowWithAuthor } from '@/lib/mappers'
import type { Comment } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useTier } from '@/lib/hooks/useTier'
import { toUserFacingError } from '@/lib/errors'

export interface UseCommentSubmitArgs {
  postId: string
  onSuccess?: (c: Comment) => void
}

export interface UseCommentSubmitReturn {
  submit: (body: string, parentId?: string | null) => Promise<boolean>
  submitting: boolean
  error: string | null
  clearError: () => void
}

// 한글 주석: 댓글 최대·최소 길이 (UX 기준)
const MIN_LENGTH = 2
const MAX_LENGTH = 500

export function useCommentSubmit({
  postId,
  onSuccess,
}: UseCommentSubmitArgs): UseCommentSubmitReturn {
  const { user } = useAuth()
  const { canWritePost } = useTier()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (body: string, parentId: string | null = null): Promise<boolean> => {
      setError(null)

      // ─────────────────────────────────────────────
      // 한글 주석: 입력 검증
      // ─────────────────────────────────────────────
      const trimmed = body.trim()
      if (trimmed.length < MIN_LENGTH) {
        setError(`댓글은 최소 ${MIN_LENGTH}자 이상 입력해줘`)
        return false
      }
      if (trimmed.length > MAX_LENGTH) {
        setError(`댓글은 ${MAX_LENGTH}자 이내로 써줘`)
        return false
      }
      if (!user?.id) {
        setError('로그인 세션이 없어. 앱 재실행 후 다시 시도해줘')
        return false
      }
      if (!canWritePost) {
        setError('소셜 로그인 후 댓글을 쓸 수 있어')
        return false
      }

      setSubmitting(true)

      try {
        // ─────────────────────────────────────────────
        // 한글 주석: INSERT + 반환된 row에 author 조인
        //   - .select('*, author:profiles!author_id(*)')를 insert 뒤에 체이닝
        //   - 덕분에 응답에 프로필 포함돼서 바로 UI에 쓸 수 있음
        // ─────────────────────────────────────────────
        const { data, error: insErr } = await supabase
          .from('comments')
          .insert({
            post_id: postId,
            author_id: user.id,
            body: trimmed,
            parent_id: parentId,
          })
          .select('*, author:profiles!author_id(*)')
          .single()

        if (insErr) throw new Error(insErr.message)
        if (!data) throw new Error('댓글 저장 결과를 받지 못했어')

        // 한글 주석: UI Comment 타입으로 매핑 후 콜백
        const mapped = mapComment(data as CommentRowWithAuthor)
        onSuccess?.(mapped)

        return true
      } catch (e) {
        const msg = toUserFacingError(e, '댓글 작성에 실패했어')
        console.error('[useCommentSubmit] 댓글 작성 실패:', msg)
        setError(msg)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [canWritePost, postId, user?.id, onSuccess],
  )

  const clearError = useCallback(() => setError(null), [])

  return { submit, submitting, error, clearError }
}
