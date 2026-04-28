// 한글 주석: GRIT V2 타이포그래피 토큰
//
// ▣ 폰트 패밀리:
//   - Sans (한글+영문): Pretendard Variable
//   - Display/Numerals (숫자 강조): Inter
//
// ▣ Weight 위계 (디자인 핸드오프 기반):
//   - 400 Regular: 본문/캡션/라벨
//   - 500-600: 섹션 라벨, 메타 강조
//   - 600 SemiBold: 닉네임 (예: "아나키")
//   - 700 Bold: 큰 숫자 (팔로워 8,247), 그릿 LV 87, 헤딩
//   - 800 Heavy: 로고 글리프, 메인 헤딩
//
// ▣ 사용 예:
//   <Text style={[typography.body, { color: colors.text.primary }]}>
//   <Text style={typography.numStrong}>{followerCount.toLocaleString()}</Text>

// ─────────────────────────────────────────────
// 1. 폰트 패밀리 상수
//    expo-font로 로드 후 fontFamily 값으로 사용
// ─────────────────────────────────────────────

export const fontFamily = {
  sansRegular:  'Pretendard-Regular',
  sansMedium:   'Pretendard-Medium',
  sansSemiBold: 'Pretendard-SemiBold',
  sansBold:     'Pretendard-Bold',
  sansHeavy:    'Pretendard-ExtraBold',
  // 숫자 전용 (Inter)
  numRegular:   'Inter-Regular',
  numSemiBold:  'Inter-SemiBold',
  numBold:      'Inter-Bold',
} as const

// ─────────────────────────────────────────────
// 2. 타입 스케일 (모바일 우선)
//    fontSize / lineHeight / fontFamily 한 번에
// ─────────────────────────────────────────────

export const typography = {
  // ── 헤딩 (스크린 타이틀, 큰 섹션) ──
  heading1: {
    fontSize: 28,
    lineHeight: 36,
    fontFamily: fontFamily.sansHeavy,    // weight 800
  },
  heading2: {
    fontSize: 22,
    lineHeight: 30,
    fontFamily: fontFamily.sansBold,     // weight 700
  },
  heading3: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: fontFamily.sansSemiBold, // weight 600
  },

  // ── 본문 ──
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fontFamily.sansRegular,  // weight 400
  },
  bodyEmphasis: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fontFamily.sansMedium,   // weight 500
  },

  // ── 닉네임/이름 (SemiBold 위계) ──
  nickname: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.sansSemiBold, // weight 600
  },

  // ── 큰 숫자 강조 (팔로워 카운트, 그릿 LV) - Inter Bold ──
  numStrong: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fontFamily.numBold,      // weight 700, tabular numerals
  },
  numLarge: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: fontFamily.numBold,
  },

  // ── 메타데이터 (시간, 작성자, 캡션) ──
  meta: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.sansRegular,
  },
  metaEmphasis: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.sansMedium,
  },

  // ── 캡션/라벨 ──
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamily.sansRegular,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.sansMedium,
  },

  // ── 버튼 ──
  buttonPrimary: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.sansSemiBold,
  },
  buttonSmall: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.sansSemiBold,
  },

  // ── 로고 글리프 (Heavy) ──
  logo: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: fontFamily.sansHeavy,
  },
} as const

export type Typography = typeof typography
