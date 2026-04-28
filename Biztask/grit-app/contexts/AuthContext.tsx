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
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

// 한글 주석: Row 타입 직접 임포트 (DB 스키마 바뀌면 자동 반영)
type Profile = Tables<'profiles'>
type SocialLoginMode = 'link' | 'signin'

const SOCIAL_LOGIN_MODE_KEY = 'grit:social-login-mode'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean               // 초기 로딩 (세션 확인 + 익명 로그인 + 프로필 fetch 동안 true)
  // 한글 주석: 편의 계산값
  //   - isAnonymous: 현재 세션이 익명 로그인 상태인지
  //   - isOnboarded: 프로필에서 닉네임·업종을 직접 입력했는지 (익명은 항상 true 취급 - 온보딩 화면 탈 필요 없음)
  isAnonymous: boolean
  isOnboarded: boolean
  shouldLinkIdentityOnSocialLogin: boolean
  setSocialLoginMode: (mode: SocialLoginMode) => Promise<void>
  refreshProfile: (userId?: string) => Promise<Profile | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [shouldLinkIdentityOnSocialLogin, setShouldLinkIdentityOnSocialLogin] = useState(true)
  const [loading, setLoading] = useState(true)

  const persistSocialLoginMode = useCallback(async (mode: SocialLoginMode) => {
    setShouldLinkIdentityOnSocialLogin(mode === 'link')
    try {
      await AsyncStorage.setItem(SOCIAL_LOGIN_MODE_KEY, mode)
    } catch (error) {
      console.warn('[Auth] social login mode 저장 실패:', error)
    }
  }, [])

  const loadSocialLoginMode = useCallback(async (): Promise<SocialLoginMode> => {
    try {
      const stored = await AsyncStorage.getItem(SOCIAL_LOGIN_MODE_KEY)
      return stored === 'signin' ? 'signin' : 'link'
    } catch (error) {
      console.warn('[Auth] social login mode 로드 실패:', error)
      return 'link'
    }
  }, [])

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

  const refreshProfile = useCallback(async (userId?: string): Promise<Profile | null> => {
    const targetUserId = userId ?? session?.user?.id
    if (!targetUserId) return null
    const p = await fetchProfile(targetUserId)
    setProfile(p)
    return p
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
        if (existing.user.is_anonymous === true) {
          const mode = await loadSocialLoginMode()
          if (mounted) setShouldLinkIdentityOnSocialLogin(mode === 'link')
        } else if (mounted) {
          setShouldLinkIdentityOnSocialLogin(false)
        }
        const p = await fetchProfile(existing.user.id)
        if (mounted) setProfile(p)
      } else {
        // 세션 없음 → 익명 로그인
        const mode = await loadSocialLoginMode()
        if (mounted) setShouldLinkIdentityOnSocialLogin(mode === 'link')
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
      if (newSession?.user?.is_anonymous === true) {
        loadSocialLoginMode().then((mode) => {
          setShouldLinkIdentityOnSocialLogin(mode === 'link')
        })
      } else {
        setShouldLinkIdentityOnSocialLogin(false)
      }
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
  }, [fetchProfile, loadSocialLoginMode, persistSocialLoginMode])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // 한글 주석: 명시적 로그아웃 직후의 재로그인은 "기존 계정 로그인"으로 취급
    //   - 새 익명 세션에 기존 구글 identity를 다시 link 하려 하면 충돌할 수 있음
    await persistSocialLoginMode('signin')
    // 한글 주석: 로그아웃 후 바로 다시 익명 로그인 (앱 사용 계속 가능하도록)
    await supabase.auth.signInAnonymously()
  }, [persistSocialLoginMode])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    // 한글 주석: Supabase의 is_anonymous 플래그 (string | undefined일 수 있음)
    const isAnonymous = user?.is_anonymous === true
    // 한글 주석: 익명 유저는 온보딩 화면 탈 필요 없으므로 true 취급
    //   → AuthGate 분기에서 "익명 OR onboarded=true" 인 유저만 통과
    const isOnboarded = isAnonymous ? true : profile?.onboarded === true

    return {
      session,
      user,
      profile,
      loading,
      isAnonymous,
      isOnboarded,
      shouldLinkIdentityOnSocialLogin,
      setSocialLoginMode: persistSocialLoginMode,
      refreshProfile,
      signOut,
    }
  }, [
    session,
    profile,
    loading,
    shouldLinkIdentityOnSocialLogin,
    persistSocialLoginMode,
    refreshProfile,
    signOut,
  ])

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
