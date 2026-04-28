// 한글 주석: V2 5탭 네비 (2026-04-28 갈아엎음)
//
// ▣ V2 변경:
//   - 5탭 구조: 홈 / 탐색 / [시크릿 라운지] / 알림 / 프로필
//   - 가운데 시크릿 라운지 = 자물쇠 글로우 버튼 (시그니처)
//     · 인증 안 되면 자물쇠 (lock) 아이콘
//     · 인증 되면 sparkle 아이콘
//   - 다크모드 톤
//   - 글쓰기는 별도 모달로 분리 (하단 탭에서 제거)
//
// ▣ V1 → V2 매핑:
//   - search.tsx → explore.tsx로 이름 변경 권장 (추후 코덱스가 처리)
//   - write.tsx → 별도 모달(/post/new) 또는 글쓰기 FAB로 분리
//   - profile.tsx (탭) ← 그대로 사용

import { Tabs } from 'expo-router'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { layout } from '@/constants/spacing'
import { secretLoungeGlow } from '@/constants/shadows'
import { useTier } from '@/lib/hooks/useTier'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <TabIcon label="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '탐색',
          tabBarIcon: ({ focused }) => <TabIcon label="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="write"
        options={{
          title: '시크릿',
          tabBarIcon: () => <CenterLoungeButton />,
          tabBarLabelStyle: styles.tabLabelCenter,
          // 한글 주석: write 탭 자리를 시크릿 라운지로 임시 연결
          //   추후 코덱스가 lounge.tsx 신설 후 라우팅 정리
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '알림',
          tabBarIcon: ({ focused }) => <TabIcon label="🔔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

// ─────────────────────────────────────────────
// 일반 탭 아이콘 (이모지 기반, 추후 lucide로 교체)
// ─────────────────────────────────────────────

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.6 }}>{label}</Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  )
}

// ─────────────────────────────────────────────
// 가운데 시크릿 라운지 버튼 (자물쇠 글로우)
//   - 인증 사장님: sparkle (✨)
//   - 미인증:      자물쇠 (🔒)
// ─────────────────────────────────────────────

function CenterLoungeButton() {
  const { canViewSecretLounge } = useTier()

  return (
    <View style={styles.loungeButton}>
      <Text style={styles.loungeIcon}>{canViewSecretLounge ? '✨' : '🔒'}</Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 84 : layout.tabBarHeight,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line.default,
  },
  tabLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  tabLabelCenter: {
    ...typography.caption,
    color: colors.brand[400],
    marginTop: 2,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand[400],
    marginTop: 2,
  },

  // 한글 주석: 시크릿 라운지 가운데 버튼 - 시그니처
  loungeButton: {
    width: layout.centerTabSize,
    height: layout.centerTabSize,
    borderRadius: layout.centerTabSize / 2,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: layout.centerTabMarginTop,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    ...secretLoungeGlow,
  },
  loungeIcon: {
    fontSize: 24,
    lineHeight: 28,
  },
})
