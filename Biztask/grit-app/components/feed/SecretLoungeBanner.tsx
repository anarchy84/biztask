// 한글 주석: 시크릿 라운지 진입 배너 (홈 피드 상단)
//
// ▣ 역할:
//   - 가운데 탭이 글쓰기로 바뀌면서 시크릿 라운지 입구 분리
//   - 홈 피드 최상단에 배너 형태로 노출
//   - 인증 사장님은 "✦ 시크릿 라운지 입장" CTA
//   - 일반/게스트는 "🔒 인증하면 시크릿 라운지 열려" CTA
//
// ▣ 시각 디자인:
//   - 가로 풀폭, 살짝 그라데이션 느낌의 다크 카드
//   - 좌측 자물쇠/스파클 아이콘 + 우측 화살표
//   - 인증 안 된 경우 borderColor 살짝 다른 톤

import { Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'
import { useTier } from '@/lib/hooks/useTier'

export default function SecretLoungeBanner() {
  const { canViewSecretLounge } = useTier()

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/lounge' as any)}
      style={({ pressed }) => [
        styles.banner,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="시크릿 라운지 입장"
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{canViewSecretLounge ? '✦' : '🔒'}</Text>
      </View>

      <View style={styles.textBox}>
        <Text style={styles.title}>
          {canViewSecretLounge ? '시크릿 라운지' : '시크릿 라운지 잠겨 있어'}
        </Text>
        <Text style={styles.subtitle}>
          {canViewSecretLounge
            ? '인증 사장님끼리만 보는 매칭·구인구직·진짜 후기'
            : '사업자 인증하면 진짜 사장님끼리만 보는 공간이 열려'}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginHorizontal: spacing[3],
    marginTop: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.brand[800], // 미묘한 에메랄드 보더
    gap: spacing[3],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
    color: colors.onBrand,
    lineHeight: 24,
  },
  textBox: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  arrow: {
    ...typography.heading2,
    color: colors.text.tertiary,
    marginLeft: spacing[2],
  },
})
