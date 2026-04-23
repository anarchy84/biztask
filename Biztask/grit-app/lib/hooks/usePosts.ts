// 한글 주석: 홈 피드에서 쓰는 게시글 조회 훅
//
// ▣ 이 훅이 하는 일:
//   - Supabase posts 테이블 조회 (author join + myReaction 조합)
//   - 카테고리별 필터 (all/hot/humor/worry/question/tip)
//   - pull-to-refresh 지원
//   - 로딩·에러 상태 반환
//
// ▣ 사용 예 (컴포넌트 안):
//   const { posts, loading, error, refresh, refreshing } = usePosts(activeCategory)
//
// ▣ 쿼리 전략:
//   - 'all': 최신순 (created_at DESC)
//   - 'hot': 가중치 점수 (like*2 + comment*3 - dislike) 내림차순
//     └ 단, hot은 24h 이내 글만 (너무 오래된 인기글이 계속 위에 남는 걸 방지)
//   - 나머지 카테고리: 해당 category 필터 + 최신순
//
// ▣ 페이지네이션:
//   - Phase 2 MVP는 최근 50개만 로드 (무한스크롤은 Phase 3)

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { mapPosts, injectMyReaction, type PostRowWithAuthor } from '@/lib/mappers'
import type { Post, Category } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'

// 한글 주석: 피드 한 번에 불러올 글 개수
const FEED_LIMIT = 50

// 한글 주석: Hot 카테고리 기준 시간대 (24시간)
const HOT_WINDOW_HOURS = 24

export interface UsePostsReturn {
  posts: Post[]
  loading: boolean      // 첫 로딩 (화면에 스피너 띄울지 판단용)
  refreshing: boolean   // pull-to-refresh 중인지
  error: string | null
  refresh: () => Promise<void>
}

export function usePosts(category: Category): UsePostsReturn {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ─────────────────────────────────────────────
  // 한글 주석: 실제 fetch 로직
  //   - isRefresh: pull-to-refresh 호출 여부 (스피너 구분용)
  // ─────────────────────────────────────────────
  const fetchPosts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        // 1) posts 기본 쿼리 (author join)
        let query = supabase
          .from('posts')
          .select('*, author:profiles!author_id(*)')
          .eq('is_deleted', false)
          .limit(FEED_LIMIT)

        // 2) 카테고리별 필터·정렬 분기
        if (category === 'hot') {
          // 한글 주석: 24시간 이내 + 좋아요·댓글 많은 순
          //   - Postgres 계산 컬럼(like_count * 2 + comment_count * 3)은
          //     supabase-js에서 바로 정렬 못 시켜서 like_count DESC로 1차 정렬
          //   - Phase 3에서 DB view나 rpc 함수로 제대로 구현 예정
          const since = new Date(Date.now() - HOT_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
          query = query
            .gte('created_at', since)
            .order('like_count', { ascending: false })
            .order('comment_count', { ascending: false })
        } else if (category === 'all') {
          // 최신순
          query = query.order('created_at', { ascending: false })
        } else {
          // 특정 카테고리 (humor/worry/question/tip)
          query = query.eq('category', category).order('created_at', { ascending: false })
        }

        const { data, error: fetchError } = await query

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        // 3) UI 타입으로 변환
        const mapped = mapPosts((data ?? []) as PostRowWithAuthor[])

        // 4) 내가 누른 반응 주입 (로그인 상태면)
        if (user?.id && mapped.length > 0) {
          const postIds = mapped.map((p) => p.id)
          const { data: myReactions, error: reactErr } = await supabase
            .from('reactions')
            .select('target_id, type')
            .eq('user_id', user.id)
            .eq('target_type', 'post')
            .in('target_id', postIds)

          if (reactErr) {
            // 한글 주석: 반응 조회 실패는 치명적 아님 → 로그만 남기고 계속
            console.warn('[usePosts] myReactions fetch 실패:', reactErr.message)
          } else if (myReactions) {
            const enriched = injectMyReaction(
              mapped,
              myReactions as { target_id: string; type: 'like' | 'dislike' }[],
            )
            setPosts(enriched)
            return
          }
        }

        setPosts(mapped)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[usePosts] 피드 로딩 실패:', msg)
        setError(msg)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [category, user?.id],
  )

  // ─────────────────────────────────────────────
  // 한글 주석: 카테고리 바뀌거나 유저 바뀌면 자동 재조회
  // ─────────────────────────────────────────────
  useEffect(() => {
    fetchPosts(false)
  }, [fetchPosts])

  // 한글 주석: 외부에서 수동 새로고침 호출용
  const refresh = useCallback(async () => {
    await fetchPosts(true)
  }, [fetchPosts])

  return {
    posts,
    loading,
    refreshing,
    error,
    refresh,
  }
}
