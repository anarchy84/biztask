// 한글 주석: 추천 사장님 팔로우/언팔로우 훅
//
// ▣ follows 테이블에 INSERT/DELETE를 수행한다.
// ▣ 팔로워 카운트는 DB 트리거가 실제 값을 갱신하고, UI는 낙관적으로 먼저 반영한다.
// ▣ 익명 세션/본인 팔로우는 클라이언트에서도 막고 RLS/CHECK 제약이 서버에서 한 번 더 막는다.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTier } from '@/lib/hooks/useTier'
import { toUserFacingError } from '@/lib/errors'

export interface UseFollowArgs {
  targetUserId: string | null | undefined
  initialFollowerCount?: number
}

export interface UseFollowReturn {
  isFollowing: boolean
  followerCount: number
  loading: boolean
  error: string | null
  canToggle: boolean
  toggleFollow: () => Promise<void>
  clearError: () => void
}

/** 한글 주석: 단일 유저 팔로우 상태와 낙관적 토글을 제공한다. */
export function useFollow({
  targetUserId,
  initialFollowerCount = 0,
}: UseFollowArgs): UseFollowReturn {
  const { user } = useAuth()
  const { isAuthenticated } = useTier()
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSelf = Boolean(user?.id && targetUserId && user.id === targetUserId)
  const canToggle = Boolean(targetUserId && isAuthenticated && !isSelf)

  useEffect(() => {
    setFollowerCount(initialFollowerCount)
  }, [initialFollowerCount, targetUserId])

  useEffect(() => {
    let mounted = true

    const fetchFollowState = async () => {
      setError(null)

      if (!user?.id || !targetUserId || isSelf || !isAuthenticated) {
        if (mounted) setIsFollowing(false)
        return
      }

      const { data, error: fetchErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle()

      if (!mounted) return

      if (fetchErr) {
        setError(toUserFacingError(fetchErr, '팔로우 상태를 확인하지 못했어'))
        setIsFollowing(false)
        return
      }

      setIsFollowing(Boolean(data))
    }

    void fetchFollowState()

    return () => {
      mounted = false
    }
  }, [isAuthenticated, isSelf, targetUserId, user?.id])

  const toggleFollow = useCallback(async () => {
    setError(null)

    if (!targetUserId) {
      setError('팔로우할 계정을 찾을 수 없어')
      return
    }
    if (!user?.id || !isAuthenticated) {
      setError('소셜 로그인 후 팔로우할 수 있어')
      return
    }
    if (isSelf) {
      setError('내 계정은 팔로우할 수 없어')
      return
    }
    if (loading) return

    const nextFollowing = !isFollowing
    const delta = nextFollowing ? 1 : -1

    setLoading(true)
    setIsFollowing(nextFollowing)
    setFollowerCount((prev) => Math.max(0, prev + delta))

    try {
      const result = nextFollowing
        ? await supabase.from('follows').insert({
            follower_id: user.id,
            following_id: targetUserId,
          })
        : await supabase
            .from('follows')
            .delete()
            .eq('follower_id', user.id)
            .eq('following_id', targetUserId)

      if (result.error) throw result.error
    } catch (e) {
      setIsFollowing(isFollowing)
      setFollowerCount((prev) => Math.max(0, prev - delta))
      setError(toUserFacingError(e, '팔로우 변경에 실패했어'))
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isFollowing, isSelf, loading, targetUserId, user?.id])

  const clearError = useCallback(() => setError(null), [])

  return {
    isFollowing,
    followerCount,
    loading,
    error,
    canToggle,
    toggleFollow,
    clearError,
  }
}
