// 한글 주석: V2 Avatar 컴포넌트
//
// ▣ 사용처: 거의 모든 화면 (피드/프로필/댓글/알림)
// ▣ 변형:
//   - 사이즈: 24/32/40/48/64/84
//   - 그릿 ring overlay (선택적)
//   - 이니셜 fallback (avatar_url 없을 때)

import { Image, StyleSheet, View, ViewStyle } from 'react-native'
import { Text } from 'react-native'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'

export interface AvatarProps {
  /** 아바타 이미지 URL (없으면 이니셜 fallback) */
  url?: string | null
  /** 닉네임 (이니셜 추출용) */
  nickname?: string
  /** 사이즈 */
  size?: 24 | 32 | 40 | 48 | 64 | 84
  /** 그릿 ring overlay (그릿 지수 기반 색상 강조) */
  showRing?: boolean
  /** 추가 스타일 */
  style?: ViewStyle
}

/** 한글 주석: 닉네임에서 첫 글자 추출 (한글/영문 둘 다 지원) */
function getInitial(nickname?: string): string {
  if (!nickname) return '?'
  return nickname.trim().charAt(0).toUpperCase()
}

/** 한글 주석: 닉네임 → hue 추출 (이니셜 배경 그라데이션 색) */
function getHue(nickname?: string): number {
  if (!nickname) return 200
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash << 5) - hash + nickname.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

export function Avatar({ url, nickname, size = 40, showRing = false, style }: AvatarProps) {
  const initial = getInitial(nickname)
  const hue = getHue(nickname)
  const ringSize = showRing ? size + 8 : size

  const wrapper: ViewStyle = {
    width: ringSize,
    height: ringSize,
    borderRadius: ringSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: showRing ? colors.bg.surface : 'transparent',
    borderWidth: showRing ? 2 : 0,
    borderColor: showRing ? colors.brand[500] : 'transparent',
  }

  const inner: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `hsl(${hue}, 50%, 35%)`,
  }

  return (
    <View style={[wrapper, style]}>
      <View style={inner}>
        {url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  initial: {
    ...typography.heading3,
    color: colors.text.primary,
  },
})
