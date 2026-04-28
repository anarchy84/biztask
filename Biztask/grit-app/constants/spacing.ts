// 한글 주석: GRIT V2 스페이싱 + 라운딩 토큰
//
// ▣ 8pt 그리드 + 4pt 미세조정 혼용
// ▣ 라운딩은 핸드오프 README의 4단계 (sm/md/lg/xl)
// ▣ 모바일 horizontal padding: 16-18px
// ▣ PC 컨테이너: 3-column grid (260 / 1fr / 320), max 1280px

// ─────────────────────────────────────────────
// 1. Spacing scale (8pt 그리드)
// ─────────────────────────────────────────────

export const spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const

// ─────────────────────────────────────────────
// 2. Border radius (sm/md/lg/xl + pill)
// ─────────────────────────────────────────────

export const radius = {
  none: 0,
  sm:   8,
  md:   14,
  lg:   20,
  xl:   28,
  pill: 999,
} as const

// ─────────────────────────────────────────────
// 3. 화면 레이아웃 상수
// ─────────────────────────────────────────────

export const layout = {
  // 모바일
  mobileHorizontalPadding: 16,
  mobileCardGap: 8,
  mobileSafeBottom: 24,

  // 5탭 네비
  tabBarHeight: 64,
  centerTabSize: 52,         // 가운데 시크릿 라운지 자물쇠 버튼
  centerTabMarginTop: -16,   // 다른 탭보다 위로 떠오름

  // PC 3단 컬럼 (Phase 7에서 사용)
  pcLeftRailWidth: 260,
  pcRightRailWidth: 320,
  pcMaxWidth: 1280,
} as const

// ─────────────────────────────────────────────
// 4. Density 변형 (tight / normal / loose)
//    핸드오프 README 권장: 디폴트 loose
// ─────────────────────────────────────────────

export const density = {
  tight:  0.85,
  normal: 1.0,
  loose:  1.15,
} as const

export type Spacing = typeof spacing
export type Radius = typeof radius
export type Layout = typeof layout
