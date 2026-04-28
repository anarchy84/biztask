// 한글 주석: GRIT V2 하단 5탭 네비게이션
//
// ▣ 홈 / 탐색 / 시크릿 라운지 / 알림 / 프로필
// ▣ 가운데 시크릿 라운지는 인증 상태에 따라 자물쇠/스파클 아이콘을 바꾼다.

import { Tabs } from 'expo-router'
import { Platform, StyleSheet, Text, View } from 'react-native'
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
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: '탐색',
          tabBarIcon: ({ focused }) => <TabIcon label="⌕" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="lounge"
        options={{
          title: '시크릿',
          tabBarIcon: () => <CenterLoungeButton />,
          tabBarLabelStyle: styles.tabLabelCenter,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '알림',
          tabBarIcon: ({ focused }) => <TabIcon label="◔" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused }) => <TabIcon label="◉" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>{label}</Text>
      {focused ? <View style={styles.activeDot} /> : null}
    </View>
  )
}

function CenterLoungeButton() {
  const { canViewSecretLounge } = useTier()

  return (
    <View style={styles.loungeButton}>
      <Text style={styles.loungeIcon}>{canViewSecretLounge ? '✦' : '🔒'}</Text>
    </View>
  )
}

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
    height: 28,
  },
  tabIcon: {
    fontSize: 22,
    color: colors.text.tertiary,
  },
  tabIconActive: {
    color: colors.text.primary,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand[400],
    marginTop: 2,
  },
  loungeButton: {
    width: layout.centerTabSize,
    height: layout.centerTabSize,
    borderRadius: layout.centerTabSize / 2,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: layout.centerTabMarginTop,
    borderWidth: 1,
    borderColor: colors.brand[400],
    ...secretLoungeGlow,
  },
  loungeIcon: {
    fontSize: 24,
    lineHeight: 28,
    color: colors.onBrand,
  },
})
