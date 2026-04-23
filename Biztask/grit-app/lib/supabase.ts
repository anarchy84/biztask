// 한글 주석: Supabase 클라이언트 싱글톤
//
// ▣ 이 파일의 역할:
//   - 앱 전역에서 공유하는 Supabase 클라이언트 생성
//   - React Native 환경 특화 설정 (AsyncStorage 세션, URL 감지 off)
//   - 환경변수는 .env.local 에서 로드 (EXPO_PUBLIC_* 접두사 필수)
//
// ▣ 사용 예:
//   import { supabase } from '@/lib/supabase'
//   const { data } = await supabase.from('posts').select()
//
// ▣ 주의:
//   - Node fetch polyfill 필요 → url-polyfill import 꼭 위에서 1번 호출
//   - EXPO_PUBLIC_ 없는 env는 앱 번들에 안 들어감 (Expo SDK 규칙)

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 한글 주석: .env.local 파일 설정 안 했을 때 즉시 알림
  //   - 앱 실행 즉시 에러 나야 디버깅 수월
  //   - 배포 빌드에선 환경변수 없으면 빌드 자체가 실패하도록
  throw new Error(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았어. ' +
      '.env.local 파일 확인하고 expo start 재실행해봐.',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,   // 토큰 자동 갱신 (세션 유지)
    persistSession: true,     // AsyncStorage에 세션 저장 → 앱 재실행 시 로그인 유지
    detectSessionInUrl: false, // RN에서는 URL로 세션 복구 안 함 (웹 전용 기능)
  },
})
