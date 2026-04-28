// 한글 주석: GRIT V2 앱 루트 레이아웃 (2026-04-28 갈아엎음)
//
// ▣ 이 파일의 역할:
//   - 모든 화면의 최상위 래퍼 (Expo Router v4의 Root Layout)
//   - Pretendard + Inter 폰트 로딩 + 스플래시 화면 제어
//   - AuthProvider + ThemeProvider로 앱 전역 컨텍스트 주입
//   - Stack Navigator로 탭 화면 + 상세·로그인·온보딩 화면 연결
//   - AuthGate가 온보딩 여부에 따라 자동 분기
//
// ▣ V2 변경:
//   - V1 colors 토큰 → V2 토큰 (colors.bg.base, colors.text.primary 등)
//   - 폰트: @expo-google-fonts/pretendard + inter 패키지 사용
//   - ThemeProvider 추가 (다크모드 우선)
//
// ▣ 폰트 패키지 설치 필요 (대웅이 한 번만):
//   npx expo install @expo-google-fonts/pretendard @expo-google-fonts/inter

import { Stack, useRouter, useSegments } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'

// 한글 주석: 폰트 로드
//   - Pretendard: assets/fonts/에 직접 다운로드한 otf 파일 (Google Fonts 없음)
//   - Inter: @expo-google-fonts/inter 패키지에서 받아옴
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'

import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'

// 한글 주석: 앱 시작 시 스플래시 유지 → 폰트 로딩 끝난 뒤 숨김
SplashScreen.preventAutoHideAsync().catch(() => {
  /* 이미 숨겨져 있으면 에러 무시 */
})

export default function RootLayout() {
  // 한글 주석: 폰트 로드
  //   - Pretendard: 로컬 otf 파일 require (assets/fonts/)
  //   - Inter: @expo-google-fonts/inter 패키지
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular':   require('../assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-Medium':    require('../assets/fonts/Pretendard-Medium.otf'),
    'Pretendard-SemiBold':  require('../assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold':      require('../assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('../assets/fonts/Pretendard-ExtraBold.otf'),
    'Inter-Regular':        Inter_400Regular,
    'Inter-SemiBold':        Inter_600SemiBold,
    'Inter-Bold':            Inter_700Bold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        {/* 한글 주석: V2는 다크모드 우선 → StatusBar light */}
        <StatusBar style="light" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg.base } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="post/[id]"
              options={{
                presentation: 'card',
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="login"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="auth/callback"
              options={{
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="onboarding/nickname"
              options={{
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="profile/edit"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </Stack>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: AuthGate - 인증 상태에 따른 라우팅 분기
// ─────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, profile, isOnboarded } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (loading || !profile) return

    const firstSegment = segments[0] as string | undefined
    const onOnboarding = firstSegment === 'onboarding'
    const onLogin = firstSegment === 'login'
    const onAuthCallback = firstSegment === 'auth'

    if (!isOnboarded && !onOnboarding && !onLogin && !onAuthCallback) {
      router.replace('/onboarding/nickname' as any)
      return
    }

    if (isOnboarded && onOnboarding) {
      router.replace('/(tabs)' as any)
    }
  }, [loading, profile, isOnboarded, segments, router])

  if (loading) {
    return (
      <View style={gateStyles.container}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text style={gateStyles.text}>그릿 라운지 준비 중…</Text>
      </View>
    )
  }

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
    backgroundColor: colors.bg.base,
    gap: 16,
  },
  text: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  errorTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
})
