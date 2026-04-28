// 한글 주석: V2 Badge 컴포넌트 (3가지 변형)
//
// ▣ Verified: 인증 사장님 파란 체크 (✓)
// ▣ ProBlue: 파란딱지 - 구독 회원 (PRO)
// ▣ Industry: 업종/지역 뱃지 (예: "마포구·요식업")
// ▣ Years: 사업 연차 (예: "5년차")

import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'

// ─────────────────────────────────────────────
// VerifiedBadge - 파란 체크 아이콘
// ─────────────────────────────────────────────

export interface VerifiedBadgeProps {
  size?: 14 | 16 | 18
  style?: ViewStyle
}

export function VerifiedBadge({ size = 16, style }: VerifiedBadgeProps) {
  return (
    <View
      style={[
        styles.verified,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.verifiedCheck, { fontSize: size * 0.7 }]}>✓</Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// ProBlueBadge - 파란딱지 (PRO 구독 회원)
// ─────────────────────────────────────────────

export interface ProBlueBadgeProps {
  style?: ViewStyle
}

export function ProBlueBadge({ style }: ProBlueBadgeProps) {
  return (
    <View style={[styles.proBlue, style]}>
      <Text style={styles.proBlueText}>PRO</Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// IndustryBadge - 업종/지역 (예: "마포구·요식업")
// ─────────────────────────────────────────────

export interface IndustryBadgeProps {
  region?: string | null
  industryLabel?: string
  style?: ViewStyle
}

export function IndustryBadge({ region, industryLabel, style }: IndustryBadgeProps) {
  const label = [region, industryLabel].filter(Boolean).join('·')
  if (!label) return null
  return (
    <View style={[styles.industry, style]}>
      <Text style={styles.industryText}>{label}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// YearsBadge - 사업 연차 (예: "5년차")
// ─────────────────────────────────────────────

export interface YearsBadgeProps {
  years?: number | null
  style?: ViewStyle
}

export function YearsBadge({ years, style }: YearsBadgeProps) {
  if (!years || years < 1) return null
  return (
    <View style={[styles.years, style]}>
      <Text style={styles.yearsText}>{years}년차</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  verified: {
    backgroundColor: colors.semantic.verify,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedCheck: {
    color: colors.text.primary,
    fontWeight: '700',
    lineHeight: 14,
  },
  proBlue: {
    backgroundColor: colors.semantic.verify,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proBlueText: {
    ...typography.caption,
    color: colors.text.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  industry: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.raised,
    borderWidth: 1,
    borderColor: colors.line.default,
  },
  industryText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  years: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.raised,
  },
  yearsText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
})
