// 한글 주석: GRIT V2 그림자 + 글로우 토큰 (RN 호환)
//
// ▣ 핸드오프 README의 box-shadow를 RN 스타일로 변환:
//   - iOS: shadowColor + shadowOffset + shadowOpacity + shadowRadius
//   - Android: elevation
//
// ▣ V2 디자인 원칙:
//   - 그라데이션 90% 폐기, 깊이감은 border + shadow + 명도로 표현
//   - 카드 default: 거의 안 보일 정도로 미세하게
//   - CTA primary: 미묘한 emerald 글로우
//   - Secret Lounge 자물쇠: 가장 강한 emerald 글로우 (시그니처)

import { Platform, ViewStyle } from 'react-native'

// ─────────────────────────────────────────────
// 1. 카드 default - 미세 그림자 + 보더 (보더는 컴포넌트에서)
// ─────────────────────────────────────────────

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  android: {
    elevation: 2,
  },
  default: {},
}) as ViewStyle

// ─────────────────────────────────────────────
// 2. CTA Primary 버튼 - emerald 미세 글로우
// ─────────────────────────────────────────────

export const ctaShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  android: {
    elevation: 4,
  },
  default: {},
}) as ViewStyle

// ─────────────────────────────────────────────
// 3. Secret Lounge 자물쇠 (5탭 가운데) - 강한 emerald 글로우
//    ★ 시그니처 효과
// ─────────────────────────────────────────────

export const secretLoungeGlow: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
  },
  android: {
    elevation: 8,
  },
  default: {},
}) as ViewStyle

// ─────────────────────────────────────────────
// 4. 카드 hover/active (PC, 추후 사용)
//    transform translateY(-1px) + shadow 강화
// ─────────────────────────────────────────────

export const cardHover: ViewStyle = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  android: {
    elevation: 6,
  },
  default: {},
}) as ViewStyle

// ─────────────────────────────────────────────
// 5. 통합 export
// ─────────────────────────────────────────────

export const shadows = {
  card: cardShadow,
  cta: ctaShadow,
  secretLoungeGlow,
  cardHover,
} as const

export type Shadows = typeof shadows
