// 한글 주석: V2 GritGauge - 그릿 지수 시각화 (4가지 모드)
//
// ▣ 모드:
//   - bar  : 가로 바 게이지 (프로필 메인) - 디폴트
//   - ring : 원형 게이지 (탐색 카드, 작은 사이즈)
//   - level: LV 87 + "다이아몬드 사장님" 텍스트만
//
// ▣ 등급 계산 (점수 기반):
//   - 0~30:  씨앗 사장님    (회색)
//   - 31~50: 골드 사장님    (옐로우)
//   - 51~75: 플래티넘 사장님 (시안)
//   - 76~90: 다이아몬드 사장님 (그린)
//   - 91~100: 시그니처 사장님 (네온 그린 + 글로우)
//
// ▣ 사용 예:
//   <GritGauge mode="bar"   score={87} />
//   <GritGauge mode="ring"  score={62} size={48} />
//   <GritGauge mode="level" score={87} />

import { StyleSheet, Text, View, ViewStyle } from 'react-native'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'

// ─────────────────────────────────────────────
// 등급 계산
// ─────────────────────────────────────────────

export interface GritTier {
  /** 등급 칭호 */
  title: string
  /** 등급 단계 ('seed' | 'gold' | 'platinum' | 'diamond' | 'signature') */
  key: 'seed' | 'gold' | 'platinum' | 'diamond' | 'signature'
  /** 게이지 채움 색 */
  color: string
}

export function calcGritTier(score: number): GritTier {
  if (score >= 91) return { title: '시그니처 사장님',   key: 'signature', color: colors.brand[300] }
  if (score >= 76) return { title: '다이아몬드 사장님', key: 'diamond',   color: colors.brand[400] }
  if (score >= 51) return { title: '플래티넘 사장님',   key: 'platinum',  color: '#06B6D4' }   // cyan
  if (score >= 31) return { title: '골드 사장님',       key: 'gold',      color: '#F59E0B' }   // amber
  return                  { title: '씨앗 사장님',       key: 'seed',      color: colors.text.secondary }
}

export type GritGaugeMode = 'bar' | 'ring' | 'level'

export interface GritGaugeProps {
  score: number
  mode?: GritGaugeMode
  /** ring 모드 사이즈 (디폴트 48) */
  size?: number
  /** 칭호 텍스트 표시 여부 (bar/level) */
  showLabel?: boolean
  style?: ViewStyle
}

export function GritGauge({
  score,
  mode = 'bar',
  size = 48,
  showLabel = true,
  style,
}: GritGaugeProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  const tier = calcGritTier(safeScore)
  const fillRatio = safeScore / 100

  if (mode === 'level') {
    return (
      <View style={[styles.levelContainer, style]}>
        <Text style={[styles.tierTitle, { color: tier.color }]}>{tier.title}</Text>
        <Text style={styles.levelText}>LV {safeScore}</Text>
      </View>
    )
  }

  if (mode === 'ring') {
    // 한글 주석: SVG 없이 RN으로 ring 표현 - 두 겹 원으로 단순 구현
    //   정밀한 호 그리기는 react-native-svg 필요. 일단 단순 버전.
    return (
      <View style={[styles.ringContainer, { width: size, height: size }, style]}>
        <View
          style={[
            styles.ringTrack,
            { width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.08 },
          ]}
        />
        <View
          style={[
            styles.ringFill,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: size * 0.08,
              borderColor: tier.color,
              opacity: 0.3 + fillRatio * 0.7,
            },
          ]}
        />
        <View style={styles.ringCenter}>
          <Text style={[typography.numStrong, { fontSize: size * 0.32 }]}>{safeScore}</Text>
        </View>
      </View>
    )
  }

  // mode === 'bar'
  return (
    <View style={[styles.barContainer, style]}>
      {showLabel && (
        <View style={styles.barHeader}>
          <Text style={[styles.tierTitle, { color: tier.color }]}>{tier.title}</Text>
          <Text style={styles.levelText}>LV {safeScore}</Text>
        </View>
      )}
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${fillRatio * 100}%`, backgroundColor: tier.color },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.barCaption}>
          {safeScore < 100 ? `다음 단계까지 ${Math.max(0, 100 - safeScore)}점` : '최고 등급 달성'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  // ── level mode
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  tierTitle: {
    ...typography.bodyEmphasis,
    fontWeight: '700',
  },
  levelText: {
    ...typography.numStrong,
    color: colors.text.primary,
  },

  // ── bar mode
  barContainer: {
    gap: spacing[2],
  },
  barHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  barTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brand[800],
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  barCaption: {
    ...typography.caption,
    color: colors.text.tertiary,
  },

  // ── ring mode
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTrack: {
    position: 'absolute',
    borderColor: colors.brand[800],
  },
  ringFill: {
    position: 'absolute',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
