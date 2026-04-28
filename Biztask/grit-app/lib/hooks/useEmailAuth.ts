// 한글 주석: 이메일/비번 가입 + 로그인 hook (메인 가입 방식)
//
// ▣ 동작:
//   - signUp(email, password): 신규 가입 + 자동 로그인
//   - signIn(email, password): 기존 회원 로그인
//   - 가입 후 onboarding 닉네임 화면으로 자동 이동 (AuthGate가 처리)
//
// ▣ 베타 단계 정책:
//   - Email confirmation OFF (Supabase Dashboard 설정)
//   - 가입 즉시 세션 생성 → 빠른 UX
//   - 출시 후 confirm 메일 ON 전환 권장
//
// ▣ 사용 예:
//   const { signUp, signIn, loading, error } = useEmailAuth()
//   const ok = await signUp('test@grit.app', 'password123')

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface UseEmailAuthReturn {
  signUp: (email: string, password: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<boolean>
  loading: boolean
  error: string | null
  clearError: () => void
}

// 한글 주석: 비밀번호 정책 (Supabase 기본 6자 이상)
const PASSWORD_MIN = 6

// 한글 주석: 이메일 형식 간단 검증 (RFC 5321 풀 검증은 서버에서)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function useEmailAuth(): UseEmailAuthReturn {
  const { refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signUp = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null)

      // ─────────────────────────────────────────────
      // 1) 입력 검증 + 정규화
      //   - 비번 trim → iOS 자동완성에서 들어오는 보이지 않는 공백 제거
      //     (가입 시와 로그인 시 동일 처리해야 매칭됨)
      // ─────────────────────────────────────────────
      const trimmedEmail = email.trim().toLowerCase()
      const trimmedPassword = password.trim()
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setError('이메일 형식이 잘못됐어. 다시 확인해줘')
        return false
      }
      if (trimmedPassword.length < PASSWORD_MIN) {
        setError(`비밀번호는 최소 ${PASSWORD_MIN}자 이상이어야 해`)
        return false
      }

      setLoading(true)
      try {
        // ─────────────────────────────────────────────
        // 2) Supabase 가입
        //    - confirmation 메일 OFF면 즉시 세션 생성
        //    - ON이면 data.session = null, 사용자가 메일 클릭 후 활성화
        // ─────────────────────────────────────────────
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
        })

        if (signUpErr) {
          // 한글 주석: 자주 나는 에러 한글 변환
          if (signUpErr.message.includes('already registered')) {
            throw new Error('이미 가입된 이메일이야. 로그인 해줘')
          }
          if (signUpErr.message.includes('rate limit')) {
            throw new Error('잠시 후 다시 시도해줘 (요청이 너무 많음)')
          }
          throw new Error(signUpErr.message)
        }

        // 한글 주석: confirmation OFF면 session 즉시 생성됨
        //   ON이면 session=null → 즉시 signIn 시도 (Supabase가 가끔 ON인데도 로그인 허용)
        if (!data.session) {
          console.warn('[useEmailAuth.signUp] session=null → 자동 로그인 시도')
          const { error: autoSignInErr } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          })
          if (autoSignInErr) {
            // 한글 주석: 자동 로그인도 실패 → confirmation 메일 모드 확정
            //   사용자에게 메일 확인 안내 (Dashboard에서 Confirm email OFF 권장)
            setError(
              '가입은 됐는데 자동 로그인이 막혔어. Supabase Dashboard에서 ' +
              'Confirm email을 끄거나, 어드민이 사용자를 수동 confirm 해야 해',
            )
            return false
          }
        }

        // 한글 주석: 프로필 새로고침 → AuthGate가 onboarding으로 자동 이동
        await refreshProfile()
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[useEmailAuth.signUp] 실패:', msg)
        setError(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [refreshProfile],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setError(null)

      const trimmedEmail = email.trim().toLowerCase()
      const trimmedPassword = password.trim()
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setError('이메일 형식이 잘못됐어. 다시 확인해줘')
        return false
      }
      if (trimmedPassword.length < PASSWORD_MIN) {
        setError(`비밀번호는 최소 ${PASSWORD_MIN}자 이상이어야 해`)
        return false
      }

      setLoading(true)
      try {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        })

        if (signInErr) {
          if (signInErr.message.includes('Invalid login')) {
            throw new Error('이메일 또는 비밀번호가 맞지 않아')
          }
          if (signInErr.message.includes('Email not confirmed')) {
            throw new Error('이메일 인증을 먼저 완료해줘 (가입 메일 확인)')
          }
          throw new Error(signInErr.message)
        }

        await refreshProfile()
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[useEmailAuth.signIn] 실패:', msg)
        setError(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [refreshProfile],
  )

  const clearError = useCallback(() => setError(null), [])

  return { signUp, signIn, loading, error, clearError }
}
