// 한글 주석: 소셜 로그인 provider별 정책
//
// ▣ 이 파일의 역할:
//   - provider별 활성화 여부 / scope / 안내 문구를 한 곳에서 관리
//   - 카카오는 비즈앱 전환 전까지 앱 레벨에서 잠가 KOE205를 예방
//
// ▣ 재활성화 방법:
//   - 카카오 비즈앱 승인 후 .env.local 에 EXPO_PUBLIC_KAKAO_LOGIN_ENABLED=true 추가
//   - Expo 서버 재시작 (권장: npx expo start --clear)

export type SocialProvider = 'kakao' | 'google'

interface SocialProviderConfig {
  enabled: boolean
  buttonLabel: string
  scopes: string
  unavailableMessage?: string
}

const kakaoLoginEnabled = process.env.EXPO_PUBLIC_KAKAO_LOGIN_ENABLED === 'true'

const socialProviderConfig: Record<SocialProvider, SocialProviderConfig> = {
  kakao: {
    enabled: kakaoLoginEnabled,
    buttonLabel: kakaoLoginEnabled ? '카카오로 시작하기' : '카카오 로그인 준비중',
    scopes: 'profile_nickname',
    unavailableMessage:
      '카카오 로그인은 비즈앱 전환 후 지원할 예정이야. 지금은 구글 로그인을 이용해줘.',
  },
  google: {
    enabled: true,
    buttonLabel: '구글로 시작하기',
    scopes: 'openid email profile',
  },
}

export function getSocialProviderConfig(provider: SocialProvider): SocialProviderConfig {
  return socialProviderConfig[provider]
}

export function isSocialProviderEnabled(provider: SocialProvider): boolean {
  return socialProviderConfig[provider].enabled
}
