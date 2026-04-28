// 한글 주석: 소셜 로그인 훅 (카카오·구글)
//
// ▣ 이 훅이 하는 일:
//   - 익명 세션 → 소셜 계정 업그레이드 (linkIdentity)
//   - 로그아웃 상태 → 신규 소셜 로그인 (signInWithOAuth)
//   - Expo WebBrowser로 OAuth 플로우 진행 후 세션 자동 반영
//
// ▣ 분기 로직:
//   - 현재 user.is_anonymous === true → linkIdentity 호출
//     → 기존 익명 계정에 소셜 identity 덧붙임 → profiles row 그대로 유지
//     → 쌓아둔 글·댓글·좋아요 전부 보존
//   - 현재 user 없거나 is_anonymous !== true → signInWithOAuth
//     → 새 세션으로 소셜 로그인
//
// ▣ 사용 예:
//   const { login, loading, error } = useSocialLogin()
//   await login('kakao')
//
// ▣ 전제 조건 (Supabase Dashboard):
//   - Authentication > Providers: Kakao, Google 활성화 + 키 입력 완료
//   - Authentication > URL Configuration > Redirect URLs:
//     "grit://auth/callback" 허용 + (Expo Go용) "exp://*" 허용
//   - Authentication > Settings > Manual linking: ON (linkIdentity 허용)

import { useCallback, useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/lib/supabase'
import { getAuthRedirectUrl } from '@/lib/authRedirect'
import { setSupabaseSessionFromRedirectUrl } from '@/lib/oauthSession'
import { useAuth } from '@/contexts/AuthContext'
import {
  getSocialProviderConfig,
  type SocialProvider,
} from '@/lib/socialProviders'

export interface UseSocialLoginReturn {
  login: (provider: SocialProvider) => Promise<boolean>
  loading: boolean
  activeProvider: SocialProvider | null
  error: string | null
  clearError: () => void
}

// 한글 주석: WebBrowser 초기 세션 처리 (iOS에서 필요)
WebBrowser.maybeCompleteAuthSession()

export function useSocialLogin(): UseSocialLoginReturn {
  const {
    user,
    refreshProfile,
    shouldLinkIdentityOnSocialLogin,
    setSocialLoginMode,
  } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAlreadyLinkedError = useCallback((message?: string | null) => {
    const normalized = message?.toLowerCase() ?? ''
    return (
      normalized.includes('already linked') ||
      normalized.includes('identity is already linked') ||
      normalized.includes('linked to another user')
    )
  }, [])

  const login = useCallback(
    async (provider: SocialProvider): Promise<boolean> => {
      setError(null)
      const providerConfig = getSocialProviderConfig(provider)

      if (!providerConfig.enabled) {
        setActiveProvider(null)
        setError(
          providerConfig.unavailableMessage ??
            '지금은 이 로그인 방식을 사용할 수 없어. 잠시 후 다시 시도해줘.',
        )
        return false
      }

      // 한글 주석: Expo Go 차단 로직은 제거됨
      //   - dev build 환경에서도 잘못 감지되는 케이스 발생
      //   - 그냥 OAuth 시도하고, Expo Go 한계로 실패하면 에러 메시지로 안내
      //   - dev build에서는 정상 작동

      setLoading(true)
      setActiveProvider(provider)

      try {
        const redirectTo = await getAuthRedirectUrl()
        console.log('[useSocialLogin] OAuth redirectTo:', redirectTo)

        // ─────────────────────────────────────────────
        // 한글 주석: 1) OAuth URL 생성
        //   - 익명이면 linkIdentity (기존 세션 유지하며 identity만 추가)
        //   - 아니면 signInWithOAuth (새 세션)
        //   - skipBrowserRedirect=true로 자동 브라우저 오픈 차단
        //     → 우리가 WebBrowser로 직접 컨트롤
        // ─────────────────────────────────────────────
        const shouldLinkIdentity =
          user?.is_anonymous === true && shouldLinkIdentityOnSocialLogin

        // 한글 주석: provider별 scope는 정책 파일에서 관리
        //   - 카카오는 비즈앱 전환 전까지 disabled
        //   - 비즈앱 승인 후 EXPO_PUBLIC_KAKAO_LOGIN_ENABLED=true 로 재활성화 가능
        const { scopes } = providerConfig

        const startOAuthSignIn = async () =>
          supabase.auth.signInWithOAuth({
            provider,
            options: {
              redirectTo,
              scopes,
              skipBrowserRedirect: true,
            },
          })

        let data: { provider?: string; url?: string | null } | null = null
        let oauthErr: Error | null = null

        if (shouldLinkIdentity) {
          try {
            const linkResult = await supabase.auth.linkIdentity({
              provider,
              options: {
                redirectTo,
                scopes,
                skipBrowserRedirect: true,
              },
            })

            data = linkResult.data
            oauthErr = linkResult.error

            if (oauthErr && isAlreadyLinkedError(oauthErr.message)) {
              console.warn(
                '[useSocialLogin] linkIdentity 충돌 → 기존 계정 로그인으로 fallback',
              )
              await setSocialLoginMode('signin')
              const fallback = await startOAuthSignIn()
              data = fallback.data
              oauthErr = fallback.error
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            if (!isAlreadyLinkedError(message)) {
              throw error
            }

            console.warn(
              '[useSocialLogin] linkIdentity 예외 충돌 → 기존 계정 로그인으로 fallback',
            )
            await setSocialLoginMode('signin')
            const fallback = await startOAuthSignIn()
            data = fallback.data
            oauthErr = fallback.error
          }
        } else {
          const signInResult = await startOAuthSignIn()
          data = signInResult.data
          oauthErr = signInResult.error
        }

        if (oauthErr) throw new Error(oauthErr.message)
        if (!data?.url) throw new Error('OAuth URL을 받지 못했어')
        console.log('[useSocialLogin] OAuth authorize URL:', data.url)

        // ─────────────────────────────────────────────
        // 한글 주석: 2) WebBrowser로 OAuth 진행
        //   - openAuthSessionAsync: iOS/Android 모두 안전한 in-app 브라우저
        //   - 로그인 완료 시 redirectTo로 돌아오면서 fragment에 토큰 포함
        // ─────────────────────────────────────────────
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

        if (result.type === 'cancel' || result.type === 'dismiss') {
          // 한글 주석: 유저가 중간에 닫음 → 조용히 종료 (에러 아님)
          return false
        }

        if (result.type !== 'success' || !result.url) {
          throw new Error(`OAuth 결과 이상: ${result.type}`)
        }

        // ─────────────────────────────────────────────
        // 한글 주석: 3) 리다이렉트 URL에서 토큰 파싱 & 세션 설정
        //   - WebBrowser가 결과를 직접 넘겨준 정상 케이스
        //   - OS 레벨 딥링크 fallback 케이스는 app/auth/callback.tsx가 같은 유틸로 처리
        // ─────────────────────────────────────────────
        const { userId } = await setSupabaseSessionFromRedirectUrl(result.url)

        // 한글 주석: 4) 프로필 다시 불러오기 (is_anonymous, onboarded 상태 갱신)
        await refreshProfile(userId)

        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[useSocialLogin] 로그인 실패:', msg)
        setError(msg)
        return false
      } finally {
        setLoading(false)
        setActiveProvider(null)
      }
    },
    [
      user?.is_anonymous,
      refreshProfile,
      setSocialLoginMode,
      shouldLinkIdentityOnSocialLogin,
      isAlreadyLinkedError,
    ],
  )

  const clearError = useCallback(() => setError(null), [])

  return { login, loading, activeProvider, error, clearError }
}
