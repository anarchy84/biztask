// 한글 주석: 인증 + 프로필 전역 상태 (익명 로그인 기반)
//
// ▣ 이 파일의 역할:
//   - 앱 첫 실행 시 익명 로그인 자동 수행 (세션 없으면)
//   - 세션·프로필을 앱 전역에서 접근 가능하게 (useAuth 훅)
//   - 로그인 상태 변화 자동 구독 (onAuthStateChange)
//
// ▣ 익명 로그인 플로우:
//   1) AsyncStorage에 세션 있으면 → 기존 유저 복구 (persistSession: true)
//   2) 없으면 → supabase.auth.signInAnonymously() 호출
//   3) Supabase 트리거(handle_new_user)가 profiles row 자동 생성
//   4) profiles 조회 → 화면에 표시
//
// ▣ 사용 예 (컴포넌트 안):
//   const { user, profile, loading, signOut } = useAuth()
//   if (!profile) return null
//   console.log(profile.nickname)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

// 한글 주석: Row 타입 직접 임포트 (DB 스키마 바뀌면 자동 반영)
type Profile = Tables<'profiles'>

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean               // 초기 로딩 (세션 확인 + 익명 로그인 + 프로필 fetch 동안 true)
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // ─────────────────────────────────────────────
  // 한글 주석: profiles 테이블에서 내 프로필 fetch
  //   - 트리거로 자동 생성되지만 타이밍 이슈 대비 최대 3회 재시도
  // ─────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[Auth] profiles fetch 실패:', error.message)
        return null
      }
      if (data) return data

      // 한글 주석: 트리거 반영 대기 (지수 백오프: 100ms, 300ms, 900ms)
      await new Promise((r) => setTimeout(r, 100 * Math.pow(3, attempt)))
    }
    console.warn('[Auth] profiles row 못 찾음 (트리거 실패 가능성)')
    return null
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return
    const p = await fetchProfile(session.user.id)
    setProfile(p)
  }, [session, fetchProfile])

  // ─────────────────────────────────────────────
  // 한글 주석: 앱 시작 시 초기 세션 체크 + 필요 시 익명 로그인
  // ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    const init = async () => {
      // 1) 저장된 세션 체크
      const {
        data: { session: existing },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (existing) {
        // 세션 있음 → 그대로 사용
        setSession(existing)
        const p = await fetchProfile(existing.user.id)
        if (mounted) setProfile(p)
      } else {
        // 세션 없음 → 익명 로그인
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) {
          console.error('[Auth] 익명 로그인 실패:', error.message)
        } else if (data.session && mounted) {
          setSession(data.session)
          const p = await fetchProfile(data.session.user.id)
          if (mounted) setProfile(p)
        }
      }

      if (mounted) setLoading(false)
    }

    init()

    // 2) 세션 변화 구독 (로그인·로그아웃·토큰 갱신 자동 반영)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user?.id) {
        fetchProfile(newSession.user.id).then(setProfile)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // 한글 주석: 로그아웃 후 바로 다시 익명 로그인 (앱 사용 계속 가능하도록)
    await supabase.auth.signInAnonymously()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─────────────────────────────────────────────
// 한글 주석: Hook — 반드시 AuthProvider 안에서 호출
// ─────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth는 <AuthProvider> 안에서만 호출 가능해')
  }
  return ctx
}
