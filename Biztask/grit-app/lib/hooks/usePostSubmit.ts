// 한글 주석: 새 글 작성 훅 (posts INSERT)
//
// ▣ 이 훅이 하는 일:
//   - posts 테이블에 새 row insert
//   - 기본값: author_id = 현재 유저, image_url = null
//   - insert 성공 시 onSuccess 콜백으로 새 Post 객체 넘겨줌
//
// ▣ 사용 예:
//   const { submit, submitting, error } = usePostSubmit({
//     onSuccess: (post) => router.replace(`/post/${post.id}`),
//   })
//   await submit({ title, body, category: 'worry' })

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapPost, type PostRowWithAuthor } from '@/lib/mappers'
import type { Post, Category } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

// 한글 주석: 실제 DB에 저장 가능한 카테고리 (hot·all은 필터용이라 제외)
type WritableCategory = Exclude<Category, 'all' | 'hot'>

// 한글 주석: 본문/제목 길이 제한
const TITLE_MIN = 2
const TITLE_MAX = 50
const BODY_MIN = 5
const BODY_MAX = 2000

export interface PostSubmitInput {
  title: string
  body: string
  category: WritableCategory
  imageUrl?: string | null
  imageUrls?: string[]
  videoUrl?: string | null
  videoThumbnailUrl?: string | null
  quotedPostId?: string | null
}

export interface UsePostSubmitArgs {
  onSuccess?: (post: Post) => void
}

export interface UsePostSubmitReturn {
  submit: (input: PostSubmitInput) => Promise<Post | null>
  submitting: boolean
  error: string | null
  clearError: () => void
}

export function usePostSubmit({
  onSuccess,
}: UsePostSubmitArgs = {}): UsePostSubmitReturn {
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (input: PostSubmitInput): Promise<Post | null> => {
      setError(null)

      // ─────────────────────────────────────────────
      // 한글 주석: 입력 검증
      // ─────────────────────────────────────────────
      const title = input.title.trim()
      const body = input.body.trim()

      if (title.length < TITLE_MIN) {
        setError(`제목은 최소 ${TITLE_MIN}자 이상이어야 해`)
        return null
      }
      if (title.length > TITLE_MAX) {
        setError(`제목은 ${TITLE_MAX}자 이내로 써줘`)
        return null
      }
      if (body.length < BODY_MIN) {
        setError(`본문은 최소 ${BODY_MIN}자 이상 써줘`)
        return null
      }
      if (body.length > BODY_MAX) {
        setError(`본문은 ${BODY_MAX}자 이내로 써줘`)
        return null
      }
      if (!user?.id) {
        setError('로그인 세션이 없어. 앱 재실행 후 다시 시도해줘')
        return null
      }

      setSubmitting(true)

      try {
        // ─────────────────────────────────────────────
        // 한글 주석: INSERT + author join 반환
        //   - 글 발행 즉시 PostCard에 쓸 수 있는 형태로 받아옴
        // ─────────────────────────────────────────────
        const { data, error: insErr } = await supabase
          .from('posts')
          .insert({
            author_id: user.id,
            title,
            body,
            category: input.category,
            image_url: input.imageUrl ?? input.imageUrls?.[0] ?? null,
            image_urls: input.imageUrls ?? (input.imageUrl ? [input.imageUrl] : []),
            video_url: input.videoUrl ?? null,
            video_thumbnail_url: input.videoThumbnailUrl ?? null,
            quoted_post_id: input.quotedPostId ?? null,
            is_quote: Boolean(input.quotedPostId),
          })
          .select('*, author:profiles!author_id(*), quoted:posts!posts_quoted_post_id_fkey(*, author:profiles!author_id(*))')
          .single()

        if (insErr) throw new Error(insErr.message)
        if (!data) throw new Error('글 저장 결과를 받지 못했어')

        const mapped = mapPost(data as unknown as PostRowWithAuthor)
        onSuccess?.(mapped)

        return mapped
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[usePostSubmit] 글 작성 실패:', msg)
        setError(msg)
        return null
      } finally {
        setSubmitting(false)
      }
    },
    [user?.id, onSuccess],
  )

  const clearError = useCallback(() => setError(null), [])

  return { submit, submitting, error, clearError }
}
