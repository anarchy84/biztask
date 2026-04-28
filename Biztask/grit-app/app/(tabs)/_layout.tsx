// 한글 주석: GRIT V2 하단 5탭 네비게이션 (UX 수정 2026-04-28)
//
// ▣ 5탭 구성: 홈 / 탐색 / [글쓰기] / 알림 / 프로필
// ▣ 가운데 = 글쓰기 그린 글로우 버튼 (가장 직관적, V1·인스타·스레드 패턴)
// ▣ 시크릿 라운지는 홈 피드 상단 배너로 입구 분리됨 (별도 라우트 /lounge 그대로 유지)
//
// ▣ 가운데 글쓰기 동작:
//   - tabBarButton override로 router.push('/post/new') 모달 호출
//   - write.tsx 화면 자체는 fallback redirect만 (직접 진입 안 함)

import { Tabs, router } from 'expo-router'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { layout } from '@/constants/spacing'
import { ctaShadow } from '@/constants/shadows'

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

      {/* 한글 주석: 가운데 탭 = 글쓰기 트리거
            tabBarButton override로 onPress 가로채기 → /post/new 모달 push
            write.tsx 화면 자체는 fallback redirect용 더미 */}
      <Tabs.Screen
        name="write"
        options={{
          title: '글쓰기',
          tabBarLabelStyle: styles.tabLabelCenter,
          tabBarButton: (props) => (
            <Pressable
              onPress={(e) => {
                e.preventDefault?.()
                router.push('/post/new' as any)
              }}
              style={({ pressed }) => [
                styles.centerButtonWrap,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="글쓰기"
            >
              <View style={styles.writeButton}>
                <Text style={styles.writeIcon}>＋</Text>
              </View>
            </Pressable>
          ),
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

      {/* 한글 주석: 시크릿 라운지 - 탭바에서 숨기되 라우트는 살아있음
            진입은 홈 피드 상단 배너 → router.push('/(tabs)/lounge') */}
      <Tabs.Screen
        name="lounge"
        options={{
          href: null, // 탭에서 안 보임 (라우트는 유효)
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
  // 한글 주석: 가운데 글쓰기 버튼 wrapper
  centerButtonWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  writeButton: {
    width: layout.centerTabSize,
    height: layout.centerTabSize,
    borderRadius: layout.centerTabSize / 2,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: layout.centerTabMarginTop,
    borderWidth: 1,
    borderColor: colors.brand[400],
    ...ctaShadow,
  },
  writeIcon: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.onBrand,
    fontWeight: '300',
  },
})
