// 한글 주석: ThemeContext - 다크/라이트 모드 토글
//
// ▣ V2 정책: 다크모드 우선, 라이트는 옵션
// ▣ AsyncStorage에 사용자 선택 저장 → 앱 재시작 시 복구
// ▣ 시스템 다크모드 자동 감지 (auto 모드)
//
// ▣ 사용 예:
//   const { mode, theme, setMode } = useTheme()
//   <View style={{ backgroundColor: theme.bg.base }}>
//   setMode('light' | 'dark' | 'auto')

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import { colors as darkColors } from '@/constants/colors'

// ─────────────────────────────────────────────
// 한글 주석: 라이트 모드 토큰 (현재 사실상 미사용, 구조만 박음)
//   V2 단계에서는 다크 우선이고 라이트는 후순위
//   추후 라이트 모드 디자인 시안 받으면 여기 채우면 됨
// ─────────────────────────────────────────────

const lightColors = {
  brand: {
    300: '#10B981',
    400: '#059669',
    500: '#047857',
    600: '#065F46',
    700: '#064E3B',
    800: '#022C22',
  },
  bg: {
    base:    '#FFFFFF',
    surface: '#F9FAFB',
    raised:  '#F3F4F6',
    nested:  '#E5E7EB',
  },
  text: {
    primary:   '#18181B',
    secondary: '#52525B',
    tertiary:  '#71717A',
    disabled:  '#A1A1AA',
  },
  line: {
    subtle:  'rgba(0,0,0,0.04)',
    default: 'rgba(0,0,0,0.08)',
    strong:  'rgba(0,0,0,0.12)',
  },
  semantic: darkColors.semantic,
  onBrand: '#FFFFFF',
} as const

// ─────────────────────────────────────────────
// 한글 주석: Theme 타입
// ─────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'auto'

interface ThemeContextValue {
  mode: ThemeMode               // 사용자 설정 ('auto'면 시스템 따라감)
  resolvedMode: 'light' | 'dark' // 실제 적용된 모드 (auto 해석 후)
  theme: typeof darkColors | typeof lightColors // 현재 적용된 컬러 토큰
  setMode: (mode: ThemeMode) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = '@grit/theme-mode'

// ─────────────────────────────────────────────
// 한글 주석: ThemeProvider
// ─────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()           // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ThemeMode>('dark')  // 기본 다크
  const [hydrated, setHydrated] = useState(false)

  // 한글 주석: 초기 hydration - AsyncStorage에서 사용자 선택 복구
  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY)
        if (stored === 'light' || stored === 'dark' || stored === 'auto') {
          setModeState(stored)
        }
      } catch (e) {
        console.warn('[ThemeContext] AsyncStorage 읽기 실패:', e)
      } finally {
        setHydrated(true)
      }
    })()
  }, [])

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next)
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next)
    } catch (e) {
      console.warn('[ThemeContext] AsyncStorage 저장 실패:', e)
    }
  }, [])

  // 한글 주석: auto 모드 → 시스템 스킴 따라감, 그 외엔 명시적 모드
  const resolvedMode: 'light' | 'dark' =
    mode === 'auto' ? (systemScheme === 'light' ? 'light' : 'dark') : mode

  const theme = resolvedMode === 'dark' ? darkColors : lightColors

  // 한글 주석: hydration 끝나기 전엔 다크 기본 (깜빡임 방지)
  if (!hydrated) {
    return (
      <ThemeContext.Provider
        value={{ mode: 'dark', resolvedMode: 'dark', theme: darkColors, setMode }}
      >
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, theme, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: useTheme hook
// ─────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme은 ThemeProvider 안에서만 쓸 수 있어')
  }
  return ctx
}
