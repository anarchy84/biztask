// 한글 주석: 내 활동 통계 훅 (마이페이지용)
//
// ▣ 이 훅이 하는 일:
//   - 내가 쓴 글 수 (posts.author_id = me)
//   - 내가 쓴 댓글 수 (comments.author_id = me)
//   - 내가 받은 좋아요 수 (내 글·댓글의 like_count 합산)
//
// ▣ 성능 고려:
//   - 3개 쿼리 병렬 실행
//   - count 쿼리는 head: true로 row 안 받고 카운트만
//   - 좋아요 합산은 .select('like_count')로 최소 필드만
//
// ▣ 사용 예:
//   const { stats, loading, refresh } = useMyStats()
//   console.log(stats.postCount, stats.commentCount, stats.likesReceived)

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface MyStats {
  postCount: number
  commentCount: number
  likesReceived: number
}

const EMPTY_STATS: MyStats = {
  postCount: 0,
  commentCount: 0,
  likesReceived: 0,
}

export interface UseMyStatsReturn {
  stats: MyStats
  loading: boolean
  refresh: () => Promise<void>
}

export function useMyStats(): UseMyStatsReturn {
  const { user } = useAuth()
  const [stats, setStats] = useState<MyStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setStats(EMPTY_STATS)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // ─────────────────────────────────────────────
      // 한글 주석: 3개 쿼리 병렬
      //   - count={exact, head:true} → row 반환 안 하고 카운트만
      //   - 좋아요 합산은 row 받아서 reduce (Postgres sum 함수 대신 단순하게)
      // ─────────────────────────────────────────────
      const [postsCountRes, commentsCountRes, postsLikesRes, commentsLikesRes] =
        await Promise.all([
          supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('author_id', user.id)
            .eq('is_deleted', false),
          supabase
            .from('comments')
            .select('id', { count: 'exact', head: true })
            .eq('author_id', user.id)
            .eq('is_deleted', false),
          supabase
            .from('posts')
            .select('like_count')
            .eq('author_id', user.id)
            .eq('is_deleted', false),
          supabase
            .from('comments')
            .select('like_count')
            .eq('author_id', user.id)
            .eq('is_deleted', false),
        ])

      // 한글 주석: 에러는 각각 체크 (하나 실패해도 나머지는 보여줌)
      const postCount = postsCountRes.count ?? 0
      const commentCount = commentsCountRes.count ?? 0

      const postsLikeSum =
        postsLikesRes.data?.reduce((acc, p) => acc + (p.like_count ?? 0), 0) ?? 0
      const commentsLikeSum =
        commentsLikesRes.data?.reduce((acc, c) => acc + (c.like_count ?? 0), 0) ?? 0

      setStats({
        postCount,
        commentCount,
        likesReceived: postsLikeSum + commentsLikeSum,
      })
    } catch (e) {
      console.warn('[useMyStats] 통계 조회 실패:', e)
      // 한글 주석: 실패해도 기본값 유지 (0 표시)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    loading,
    refresh: fetchStats,
  }
}
