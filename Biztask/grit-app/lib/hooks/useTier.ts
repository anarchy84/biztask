// 한글 주석: useTier - V2 4계층 회원 권한 체크 hook
//
// ▣ 4계층 (낮은 → 높은):
//   - guest    : 비로그인 (피드 읽기만, SEO 유입용)
//   - general  : 일반 회원 (소셜 로그인, 글/댓글/좋아요 가능)
//   - verified : 인증 사장님 (시크릿 라운지·매칭·DM 가능)
//   - blue     : 파란딱지 = verified + 구독 (단톡 개설·구인구직·광고제거)
//
// ▣ 사용 예:
//   const { tier, isVerified, canPostJob, canViewSecretLounge } = useTier()
//
//   if (!canViewSecretLounge) {
//     return <SecretLoungeGate />
//   }
//
// ▣ 화면 렌더링과 RLS 정책 양쪽에서 같은 게이팅 적용해야 함
//   (RLS는 서버 레벨 안전장치, hook은 UX 레벨 분기)

import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { Database } from '@/lib/database.types'

type UserTier = Database['public']['Enums']['user_tier']

// 한글 주석: tier 위계 비교용 숫자 매핑
//   guest(0) < general(1) < verified(2) < blue(3)
const TIER_ORDER: Record<UserTier, number> = {
  guest: 0,
  general: 1,
  verified: 2,
  blue: 3,
}

export interface UseTierReturn {
  /** 현재 회원 등급 (인증 안 됐거나 게스트면 'guest') */
  tier: UserTier

  /** 로그인 상태 (general 이상) */
  isAuthenticated: boolean

  /** 인증 사장님 이상 (verified or blue) */
  isVerified: boolean

  /** 파란딱지 (구독 활성) */
  isBlue: boolean

  /** 시크릿 라운지 진입 가능 (verified 이상) */
  canViewSecretLounge: boolean

  /** B2B 매칭/협업 탭 사용 가능 (verified 이상) */
  canUseBusinessMatching: boolean

  /** 1:1 DM 사용 가능 (verified 이상) */
  canSendDM: boolean

  /** 단톡(그룹채팅) 개설 가능 (blue 전용) */
  canCreateGroupChat: boolean

  /** 구인구직 포스팅 가능 (blue 전용) */
  canPostJob: boolean

  /** 광고 제거 옵션 (blue 전용) */
  hasAdRemoval: boolean

  /** 글/댓글 작성 가능 (general 이상) */
  canWritePost: boolean

  /** 좋아요 가능 (general 이상) */
  canReact: boolean

  /** 임의 tier 이상인지 체크 (예: hasMinTier('verified')) */
  hasMinTier: (minTier: UserTier) => boolean
}

export function useTier(): UseTierReturn {
  const { user, profile } = useAuth()

  return useMemo(() => {
    // 한글 주석: 비로그인 또는 익명 → guest 취급
    //   - user 없음 OR
    //   - profile 없음 OR
    //   - is_anonymous === true (Supabase auth 익명 세션)
    const isGuest = !user || !profile || (user as any).is_anonymous === true

    // 한글 주석: tier 결정
    //   - guest면 'guest' 강제
    //   - 그 외엔 profile.tier 그대로 (general/verified/blue)
    //   - 구독 만료되면 자동 verified로 강등 (subscription_until 검사)
    let tier: UserTier = 'guest'

    if (!isGuest && profile) {
      tier = profile.tier

      // 한글 주석: 구독 만료 검사 - blue지만 만료일 지났으면 verified로
      if (tier === 'blue' && profile.subscription_until) {
        const expiresAt = new Date(profile.subscription_until).getTime()
        if (expiresAt < Date.now()) {
          tier = 'verified'
        }
      }
    }

    const tierLevel = TIER_ORDER[tier]
    const hasMinTier = (minTier: UserTier) => tierLevel >= TIER_ORDER[minTier]

    return {
      tier,
      isAuthenticated: hasMinTier('general'),
      isVerified: hasMinTier('verified'),
      isBlue: tier === 'blue',
      canViewSecretLounge: hasMinTier('verified'),
      canUseBusinessMatching: hasMinTier('verified'),
      canSendDM: hasMinTier('verified'),
      canCreateGroupChat: tier === 'blue',
      canPostJob: tier === 'blue',
      hasAdRemoval: tier === 'blue',
      canWritePost: hasMinTier('general'),
      canReact: hasMinTier('general'),
      hasMinTier,
    }
  }, [user, profile])
}
