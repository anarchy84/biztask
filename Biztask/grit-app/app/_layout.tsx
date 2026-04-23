// 한글 주석: 앱 루트 레이아웃
//
// ▣ 이 파일의 역할:
//   - 모든 화면의 최상위 래퍼 (Expo Router v4의 Root Layout)
//   - Pretendard 폰트 로딩 + 스플래시 화면 제어
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
    <>
      <StatusBar style="dark" />
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
    </>
  )
}
