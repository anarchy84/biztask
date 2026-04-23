// 한글 주석: 하단 탭 레이아웃
//
// ▣ 이 파일의 역할:
//   - 5개 탭 (홈/검색/글쓰기/알림/내정보) 정의
//   - 글쓰기 탭은 중앙에 둥근 연두 버튼으로 강조 (네이버카페·당근 스타일)
//   - 활성 탭 아이콘·텍스트는 차콜, 비활성은 회색
//
// ▣ 아이콘:
//   - Phase 1: 텍스트(이모지 + 한글)로 처리
//   - Phase 2: lucide-react-native로 교체 예정

import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Platform } from 'react-native'
import { colors } from '@/constants/colors'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.textStrong,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <TabIcon label="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '검색',
          tabBarIcon: ({ color }) => <TabIcon label="🔍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="write"
        options={{
          title: '글쓰기',
          // 한글 주석: 중앙 탭은 커스텀 아이콘 (연두 원형 버튼)
          tabBarIcon: () => <CenterWriteButton />,
          tabBarLabelStyle: styles.tabLabelCenter,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: '알림',
          tabBarIcon: ({ color }) => <TabIcon label="🔔" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내정보',
          tabBarIcon: ({ color }) => <TabIcon label="👤" color={color} />,
        }}
      />
    </Tabs>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: 일반 탭 아이콘 (이모지 기반, 나중에 SVG로 교체)
// ─────────────────────────────────────────────

const gray400 = '#A1A1AA'

const colorsLocal = { gray400 }

function TabIcon({ label, color }: { label: string; color: string }) {
  return (
    <Text style={{ fontSize: 20, color, opacity: color === gray400 ? 0.7 : 1 }}>
      {label}
    </Text>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: 중앙 글쓰기 버튼 (연두 원형, 살짝 떠 있게)
// ─────────────────────────────────────────────

function CenterWriteButton() {
  return (
    <View style={styles.writeBubble}>
      <Text style={styles.writePlus}>＋</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  tabLabelCenter: {
    fontSize: 10,
    fontFamily: 'Pretendard-Medium',
    color: colors.textStrong,
    marginTop: 2,
  },
  writeBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    // 한글 주석: 살짝 떠 보이는 그림자
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  writePlus: {
    fontSize: 22,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Bold',
    lineHeight: 24,
  },
})
