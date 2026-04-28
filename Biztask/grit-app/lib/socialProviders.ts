// 한글 주석: 소셜 로그인 provider별 정책 (V2 갱신 2026-04-28)
//
// ▣ 현재 상태:
//   - 이메일 가입이 메인 → OAuth는 모두 비활성 (UI 표시만)
//   - 카카오: 비즈앱 전환 후 활성
//   - 구글: dev build OAuth 콜백 검증 후 활성
//   - 메타: Facebook Developer 앱 등록 후 활성
//
// ▣ 재활성화 방법:
//   - 카카오: EXPO_PUBLIC_KAKAO_LOGIN_ENABLED=true
//   - 구글:   EXPO_PUBLIC_GOOGLE_LOGIN_ENABLED=true
//   - 메타:   EXPO_PUBLIC_META_LOGIN_ENABLED=true

export type SocialProvider = 'kakao' | 'google' | 'meta'

interface SocialProviderConfig {
  enabled: boolean
  buttonLabel: string
  scopes: string
  unavailableMessage?: string
}

const kakaoLoginEnabled = process.env.EXPO_PUBLIC_KAKAO_LOGIN_ENABLED === 'true'
const googleLoginEnabled = process.env.EXPO_PUBLIC_GOOGLE_LOGIN_ENABLED === 'true'
const metaLoginEnabled = process.env.EXPO_PUBLIC_META_LOGIN_ENABLED === 'true'

const socialProviderConfig: Record<SocialProvider, SocialProviderConfig> = {
  kakao: {
    enabled: kakaoLoginEnabled,
    buttonLabel: kakaoLoginEnabled ? '카카오로 시작하기' : '카카오 (준비 중)',
    scopes: 'profile_nickname',
    unavailableMessage:
      '카카오 로그인은 비즈앱 전환 후 지원할 예정이야. 지금은 이메일 가입을 이용해줘.',
  },
  google: {
    enabled: googleLoginEnabled,
    buttonLabel: googleLoginEnabled ? '구글로 시작하기' : '구글 (준비 중)',
    scopes: 'openid email profile',
    unavailableMessage:
      '구글 로그인은 곧 열릴 예정이야. 지금은 이메일 가입을 이용해줘.',
  },
  meta: {
    enabled: metaLoginEnabled,
    buttonLabel: metaLoginEnabled ? '메타로 시작하기' : '메타 (준비 중)',
    scopes: 'email public_profile',
    unavailableMessage:
      '메타(페이스북) 로그인은 곧 열릴 예정이야. 지금은 이메일 가입을 이용해줘.',
  },
}

export function getSocialProviderConfig(provider: SocialProvider): SocialProviderConfig {
  return socialProviderConfig[provider]
}

export function isSocialProviderEnabled(provider: SocialProvider): boolean {
  return socialProviderConfig[provider].enabled
}
