// 한글 주석: 앱 루트 레이아웃
//
// ▣ 이 파일의 역할:
//   - 모든 화면의 최상위 래퍼 (Expo Router v4의 Root Layout)
//   - Pretendard 폰트 로딩 + 스플래시 화면 제어
//   - AuthProvider로 앱 전역 익명 로그인·프로필 주입
//   - Stack Navigator로 탭 화면 + 상세·로그인·온보딩 화면 연결
//   - AuthGate가 온보딩 여부에 따라 자동 분기
//
// ▣ 폰트 로딩 전략:
//   - Pretendard 폰트 파일이 assets/fonts/에 있으면 로드
//   - 없으면 useFonts가 에러 반환하고 시스템 폰트로 fallback (크래시 안 남)

import { Stack, useRouter, useSegments } from 'expo-router'
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
  const [fontsLoaded, fontError] = useFonts({
    // 'Pretendard-Regular':  require('../assets/fonts/Pretendard-Regular.otf'),
    // 'Pretendard-Medium':   require('../assets/fonts/Pretendard-Medium.otf'),
    // 'Pretendard-SemiBold': require('../assets/fonts/Pretendard-SemiBold.otf'),
    // 'Pretendard-Bold':     require('../assets/fonts/Pretendard-Bold.otf'),
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
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="post/[id]"
            options={{
              // 한글 주석: 글 상세는 push 스택 (뒤로가기 버튼 자연스러움)
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="login"
            options={{
              // 한글 주석: 로그인은 모달 (시트 느낌으로 올라옴)
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="auth/callback"
            options={{
              // 한글 주석: OAuth 딥링크 fallback 처리 화면
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="onboarding/nickname"
            options={{
              // 한글 주석: 온보딩은 가로 슬라이드 + 뒤로가기 제스처 비활성화
              //   (온보딩 스킵 불가 - AuthGate가 강제 렌더)
              gestureEnabled: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="profile/edit"
            options={{
              // 한글 주석: 프로필 편집은 모달 시트 느낌
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </AuthGate>
    </AuthProvider>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: AuthGate - 인증 상태에 따른 라우팅 분기
//
// 상태별 동작:
//   1) loading         → 로딩 스피너 (세션 + 프로필 fetch 중)
//   2) profile 없음    → 에러 화면 (트리거 실패 등 극히 드문 케이스)
//   3) 온보딩 필요     → /onboarding/nickname 강제 리다이렉트
//      (소셜 로그인 + onboarded=false)
//   4) 정상            → 현재 라우트 그대로 렌더
// ─────────────────────────────────────────────

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, profile, isOnboarded } = useAuth()
  const router = useRouter()
  const segments = useSegments()

  // 한글 주석: 온보딩 필요 시 강제 리다이렉트
  //   - useSegments로 현재 라우트 확인해서 이미 온보딩 중이면 push 반복 방지
  useEffect(() => {
    if (loading || !profile) return

    // 한글 주석: typedRoutes가 segments를 탭 라우트로만 좁혀놔서 string 캐스팅 필요
    const firstSegment = segments[0] as string | undefined
    const onOnboarding = firstSegment === 'onboarding'
    const onLogin = firstSegment === 'login'
    const onAuthCallback = firstSegment === 'auth'

    // 한글 주석: 소셜 로그인했는데 닉네임 미설정 → 온보딩으로
    //   - 로그인 화면은 패스 (소셜 버튼 눌러야 여기까지 옴)
    //   - OAuth 콜백 화면은 토큰 처리 후 직접 이동해야 하므로 패스
    //   - 익명은 isOnboarded=true 취급이라 여기 안 걸림
    if (!isOnboarded && !onOnboarding && !onLogin && !onAuthCallback) {
      router.replace('/onboarding/nickname' as any)
      return
    }

    // 한글 주석: 이미 온보딩 끝났는데 온보딩 화면에 있으면 홈으로
    if (isOnboarded && onOnboarding) {
      router.replace('/(tabs)' as any)
    }
  }, [loading, profile, isOnboarded, segments, router])

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
