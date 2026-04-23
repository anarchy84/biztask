// 한글 주석: 앱 루트 레이아웃
//
// ▣ 이 파일의 역할:
//   - 모든 화면의 최상위 래퍼 (Expo Router v4의 Root Layout)
//   - Pretendard 폰트 로딩 + 스플래시 화면 제어
//   - AuthProvider로 앱 전역 익명 로그인·프로필 주입
//   - Stack Navigator로 탭 화면 + 상세 화면 연결
//
// ▣ 폰트 로딩 전략:
//   - Pretendard 폰트 파일이 assets/fonts/에 있으면 로드
//   - 없으면 useFonts가 에러 반환하고 시스템 폰트로 fallback (크래시 안 남)
//   - Phase 1 초기엔 폰트 파일 없이도 돌아가야 함 → try/catch 대신 require를 주석 처리해둠
//   - 나중에 폰트 파일 넣으면 아래 주석 해제

import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { colors } from '@/constants/colors'

// 한글 주석: 앱 시작 시 스플래시 유지 → 폰트 로딩 끝난 뒤 숨김
SplashScreen.preventAutoHideAsync().catch(() => {
  /* 이미 숨겨져 있으면 에러 무시 */
})

export default function RootLayout() {
  // 한글 주석: 폰트 로딩
  //   - 빈 객체 넘기면 즉시 loaded=true (폰트 없이도 동작)
  //   - 아래 주석 해제하려면:
  //     1) https://github.com/orioncactus/pretendard/releases 에서 최신 릴리스 다운로드
  //     2) web-static 폴더의 Pretendard-{Weight}.otf 파일들을 assets/fonts/에 복사
  //     3) require 라인 주석 제거
  const [fontsLoaded, fontError] = useFonts({
    // 'Pretendard-Regular':  require('../assets/fonts/Pretendard-Regular.otf'),
    // 'Pretendard-Medium':   require('../assets/fonts/Pretendard-Medium.otf'),
    // 'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    // 'Pretendard-Bold':     require('../assets/fonts/Pretendard-Bold.otf'),
  })

  useEffect(() => {
    // 한글 주석: 폰트 로딩 끝나면 (또는 에러 나면) 스플래시 숨김
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  // 한글 주석: 폰트 로딩 중엔 빈 화면 유지 (스플래시가 계속 보임)
  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="post/[id]"
            options={{
              // 한글 주석: 글 상세는 모달 방식이 아니라 push 스택 (뒤로가기 버튼 자연스러움)
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
        </Stack>
      </AuthGate>
    </AuthProvider>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: 인증 초기화 동안 로딩 화면
//   - 익명 로그인 + 프로필 fetch 끝나기 전엔 스택 렌더 지연
//   - 덕분에 자식 컴포넌트에서 user/profile null 체크 간소화
// ─────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, profile } = useAuth()

  if (loading) {
    return (
      <View style={gateStyles.container}>
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={gateStyles.text}>사장님 쉼터 준비 중…</Text>
      </View>
    )
  }

  // 한글 주석: 프로필 생성 실패 (극히 드문 트리거 실패 케이스)
  if (!profile) {
    return (
      <View style={gateStyles.container}>
        <Text style={gateStyles.errorTitle}>접속 문제가 발생했어</Text>
        <Text style={gateStyles.text}>앱 재실행 후 다시 시도해줘</Text>
      </View>
    )
  }

  return <>{children}</>
}

const gateStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 16,
  },
  text: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  errorTitle: {
    fontSize: 16,
    color: colors.textStrong,
    fontFamily: 'Pretendard-SemiBold',
  },
})
