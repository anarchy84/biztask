// 한글 주석: GRIT 디자인 토큰
// 설계 원칙:
//   1) 블라인드 비움의 미학 - 흰 배경 + 짙은 회색 텍스트 + 연한 보더
//   2) 네이버카페 가독성 - 행간 1.6배 + Pretendard
//   3) GRIT 정체성 - 법인차 번호판 연두(사장님의 상징) × 차콜(뚝심) 대비
//   4) Semantic Color 시스템 - 라이트/다크 모드 대응 (Phase 1은 라이트만, 구조만 박음)
//
// 컬러 철학:
//   - Primary 연두는 CTA·좋아요·로고 포인트에만 제한적으로 (너무 많이 쓰면 피로)
//   - 본문·배경·보더는 전부 무채색 (읽기 편함이 최우선)
//   - CTA 버튼 공식: "연두 배경 + 차콜 텍스트" (대비비 7:1, AAA 통과)

// ─────────────────────────────────────────────
// 1. 원시 팔레트 (Primitive Palette)
// ─────────────────────────────────────────────

export const palette = {
  // Primary - GRIT 연두 (법인차 번호판 톤을 살짝 다듬어 눈에 편하게)
  green: {
    50:  '#F4FAE6',   // 배경 하이라이트 (좋아요 눌린 카드 등)
    100: '#E5F3C4',   // 연한 배경
    500: '#97C93A',   // ★ 브랜드 메인 (CTA, 좋아요, 포인트)
    600: '#7FAD2E',   // Pressed 상태
    700: '#648823',   // 흰 배경 위 텍스트용 (대비 확보)
  },

  // Anchor - "뚝심" 차콜 블랙 (로고, 제목, CTA 위 텍스트)
  charcoal: {
    800: '#333333',   // 본문 텍스트
    900: '#1C1917',   // 로고, 앱 아이콘, CTA 위 텍스트
  },

  // Neutral
  white:    '#FFFFFF',
  gray50:   '#FAFAFA',
  gray100:  '#F4F4F5',
  gray200:  '#EEEEEE',   // 보더 기본
  gray300:  '#D4D4D8',
  gray400:  '#A1A1AA',
  gray500:  '#71717A',
  gray700:  '#3F3F46',
  gray900:  '#18181B',

  // Semantic
  like:     '#97C93A',   // 좋아요 = 브랜드 연두 (정체성 일치)
  dislike:  '#64748B',   // 싫어요 = 부드러운 회색 (공격성 최소화)
  danger:   '#EF4444',
}

// ─────────────────────────────────────────────
// 2. Semantic 토큰 (라이트 모드 기본)
//    → 다크 모드 추가 시 이 키들만 다른 값으로 바꾸면 됨
// ─────────────────────────────────────────────

export const colors = {
  // 텍스트 위계 (Hierarchy)
  textPrimary:   palette.charcoal[800],   // #333333 - 본문
  textStrong:    palette.charcoal[900],   // #1C1917 - 제목/닉네임/CTA 위 텍스트
  textMuted:     palette.gray500,         // 메타 (작성자·시간·조회수)
  textBrand:     palette.green[700],      // 브랜드 포인트 텍스트 (연두 500은 흰배경서 대비 부족)

  // 배경
  bg:            palette.white,
  bgElevated:    palette.gray50,
  bgMuted:       palette.gray100,
  bgBrand:       palette.green[500],      // CTA 배경 (위에 차콜 텍스트)
  bgBrandSoft:   palette.green[50],       // 좋아요 눌린 카드 하이라이트

  // 보더
  border:        palette.gray200,         // #EEEEEE
  borderStrong:  palette.gray300,

  // 액션
  brand:         palette.green[500],
  brandPressed:  palette.green[600],
  like:          palette.like,
  dislike:       palette.dislike,
  danger:        palette.danger,
}

// ─────────────────────────────────────────────
// 3. 타이포그래피 (행간 1.6배 기준)
// ─────────────────────────────────────────────

export const typography = {
  h1:      { fontSize: 22, lineHeight: 32, fontFamily: 'Pretendard-Bold' },
  h2:      { fontSize: 18, lineHeight: 28, fontFamily: 'Pretendard-SemiBold' },
  title:   { fontSize: 17, lineHeight: 24, fontFamily: 'Pretendard-SemiBold' },
  body:    { fontSize: 16, lineHeight: 26, fontFamily: 'Pretendard-Regular' },  // 1.625 행간
  meta:    { fontSize: 13, lineHeight: 18, fontFamily: 'Pretendard-Medium' },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Pretendard-Regular' },
} as const

// ─────────────────────────────────────────────
// 4. 스페이싱 (8pt 그리드)
// ─────────────────────────────────────────────

export const spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  10: 40,
  12: 48,
} as const

// ─────────────────────────────────────────────
// 5. 라운딩
// ─────────────────────────────────────────────

export const radius = {
  none: 0,
  sm:   4,
  md:   8,
  lg:   12,
  full: 9999,
} as const
