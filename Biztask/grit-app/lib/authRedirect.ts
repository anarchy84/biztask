// 한글 주석: OAuth 리다이렉트 URL 헬퍼
//
// ▣ 이 파일의 역할:
//   - OAuth 로그인 후 앱으로 돌아올 딥링크 URL 생성
//   - Expo Go / 개발 빌드 / 프로덕션 빌드별로 실제 열 수 있는 URL 선택
//
// ▣ 반환 URL 형식:
//   - Expo Go 개발:   exp://192.168.x.x:8081/--/auth/callback
//   - 독립 빌드(iOS/Android): grit://auth/callback  (app.json scheme 기반)
//   - 웹 빌드:        https://your-host/auth/callback
//
// ▣ Supabase Dashboard 등록 필요:
//   - Authentication > URL Configuration > Redirect URLs 에
//     "grit://auth/callback" 을 허용 목록에 넣어야 프로덕션에서 동작함
//   - Expo Go 개발 중엔 매번 IP가 바뀌니 "exp://*" 와일드카드 추가도 권장

import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Linking from 'expo-linking'

// 한글 주석: OAuth 콜백 경로
//   - 이제 app/auth/callback.tsx 라우트가 실제 fallback 핸들러 역할도 함
const AUTH_CALLBACK_PATH = 'auth/callback'
const NATIVE_AUTH_REDIRECT_URL = 'grit://auth/callback'

/**
 * 한글 주석: 현재 런타임에서 사용 가능한 OAuth 리다이렉트 URL 선택
 *
 * - Expo Go(storeClient): exp://... 형식 강제
 * - 개발 빌드/프로덕션 빌드: grit://auth/callback 우선
 * - iOS에서 custom scheme 등록이 꼬인 경우를 대비해 canOpenURL로 한 번 더 검증
 */
export async function getAuthRedirectUrl(): Promise<string> {
  const expoRedirectUrl = Linking.createURL(AUTH_CALLBACK_PATH)

  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return expoRedirectUrl
  }

  try {
    const canOpenNativeRedirect = await Linking.canOpenURL(NATIVE_AUTH_REDIRECT_URL)
    if (canOpenNativeRedirect) {
      return NATIVE_AUTH_REDIRECT_URL
    }
  } catch (error) {
    console.warn('[authRedirect] native redirect 검사 실패:', error)
  }

  try {
    const canOpenExpoRedirect = await Linking.canOpenURL(expoRedirectUrl)
    if (canOpenExpoRedirect) {
      return expoRedirectUrl
    }
  } catch (error) {
    console.warn('[authRedirect] expo redirect 검사 실패:', error)
  }

  console.warn('[authRedirect] fallback redirect 사용:', {
    executionEnvironment: Constants.executionEnvironment,
    expoRedirectUrl,
    nativeRedirectUrl: NATIVE_AUTH_REDIRECT_URL,
  })

  return expoRedirectUrl
}
