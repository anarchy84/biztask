// 한글 주석: V2 로그인/가입 화면 (2026-04-28 갈아엎음)
//
// ▣ 변경 핵심:
//   - 메인: 이메일 + 비번 가입/로그인 (Supabase auth.signUp / signInWithPassword)
//   - 서브: 카카오/구글/메타 버튼은 표시만 (전부 disabled, "준비 중" 토스트)
//   - 가입 후 → AuthGate가 /onboarding/nickname으로 자동 이동
//
// ▣ 디자인:
//   - V2 다크 + 그린 액센트
//   - 이메일/비번 입력 + 회원가입↔로그인 토글
//   - OAuth 버튼은 회색 톤 + "준비 중" 라벨

import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'
import { ctaShadow } from '@/constants/shadows'
import { useEmailAuth } from '@/lib/hooks/useEmailAuth'
import {
  getSocialProviderConfig,
  type SocialProvider,
} from '@/lib/socialProviders'

type AuthMode = 'signin' | 'signup'

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signUp, signIn, loading, error, clearError } = useEmailAuth()

  // 한글 주석: 가입/로그인 토글
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))
    clearError()
  }, [clearError])

  // 한글 주석: 이메일 가입/로그인 제출
  const handleSubmit = useCallback(async () => {
    const ok =
      mode === 'signup'
        ? await signUp(email, password)
        : await signIn(email, password)
    if (ok) {
      // 한글 주석: AuthGate가 onboarded 체크해서 닉네임 화면 또는 홈으로
      router.replace('/(tabs)' as any)
    }
  }, [mode, email, password, signUp, signIn])

  // 한글 주석: 비활성 OAuth 버튼 누르면 안내
  const handleSocialClick = useCallback((provider: SocialProvider) => {
    const cfg = getSocialProviderConfig(provider)
    Alert.alert(
      '아직 준비 중이야',
      cfg.unavailableMessage ?? '잠시 후 다시 시도해줘',
    )
  }, [])

  // 한글 주석: 이메일+비번 유효성 (버튼 활성/비활성)
  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length >= 6 && !loading
  }, [email, password, loading])

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── 헤더 ─── */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoGlyph}>그</Text>
            </View>
            <Text style={styles.title}>
              {mode === 'signup' ? '그릿 시작하기' : '그릿 로그인'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'signup'
                ? '사장님들의 비즈니스 라운지'
                : '다시 만나서 반가워'}
            </Text>
          </View>

          {/* ─── 이메일 가입/로그인 폼 ─── */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="이메일"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              onChangeText={(v) => {
                setEmail(v)
                if (error) clearError()
              }}
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="비밀번호 (6자 이상)"
              placeholderTextColor={colors.text.tertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChangeText={(v) => {
                setPassword(v)
                if (error) clearError()
              }}
              editable={!loading}
              onSubmitEditing={canSubmit ? handleSubmit : undefined}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
              onPress={canSubmit ? handleSubmit : undefined}
              accessibilityRole="button"
              accessibilityLabel={mode === 'signup' ? '회원가입' : '로그인'}
            >
              {loading ? (
                <ActivityIndicator color={colors.onBrand} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signup' ? '회원가입' : '로그인'}
                </Text>
              )}
            </Pressable>

            <Pressable onPress={toggleMode} style={styles.toggleLink}>
              <Text style={styles.toggleText}>
                {mode === 'signup'
                  ? '이미 계정이 있어? 로그인하기'
                  : '아직 회원이 아니야? 가입하기'}
              </Text>
            </Pressable>
          </View>

          {/* ─── 구분선 ─── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ─── 소셜 로그인 (전부 disabled) ─── */}
          <View style={styles.socialBox}>
            <SocialButton provider="kakao" onPress={handleSocialClick} />
            <SocialButton provider="google" onPress={handleSocialClick} />
            <SocialButton provider="meta" onPress={handleSocialClick} />
            <Text style={styles.socialNote}>
              소셜 로그인은 곧 열려. 지금은 이메일로 시작해줘.
            </Text>
          </View>

          {/* ─── 닫기 (모달이라 뒤로) ─── */}
          <Pressable
            onPress={() => router.back()}
            style={styles.closeLink}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Text style={styles.closeText}>나중에 할게</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: 비활성 소셜 버튼
// ─────────────────────────────────────────────

function SocialButton({
  provider,
  onPress,
}: {
  provider: SocialProvider
  onPress: (provider: SocialProvider) => void
}) {
  const cfg = getSocialProviderConfig(provider)
  const icon = provider === 'kakao' ? '💬' : provider === 'google' ? 'G' : 'f'

  return (
    <Pressable
      style={[styles.socialButton, !cfg.enabled && styles.socialButtonDisabled]}
      onPress={() => onPress(provider)}
      accessibilityRole="button"
      accessibilityLabel={cfg.buttonLabel}
    >
      <Text style={styles.socialIcon}>{icon}</Text>
      <Text style={styles.socialLabel}>{cfg.buttonLabel}</Text>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: spacing[5],
    gap: spacing[5],
  },
  // ── 헤더
  header: {
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[6],
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    ...typography.heading2,
    color: colors.onBrand,
    fontWeight: '800',
  },
  title: {
    ...typography.heading1,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
  },
  // ── 폼
  form: {
    gap: spacing[3],
  },
  input: {
    height: 52,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
    color: colors.text.primary,
    fontSize: 15,
    fontFamily: typography.body.fontFamily,
  },
  errorText: {
    ...typography.meta,
    color: colors.semantic.like,
    marginTop: -spacing[1],
  },
  primaryButton: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...ctaShadow,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...typography.buttonPrimary,
    color: colors.onBrand,
    fontWeight: '600',
  },
  toggleLink: {
    alignSelf: 'center',
    paddingVertical: spacing[2],
  },
  toggleText: {
    ...typography.label,
    color: colors.brand[400],
  },
  // ── 구분선
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line.default,
  },
  dividerText: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  // ── 소셜
  socialBox: {
    gap: spacing[2],
  },
  socialButton: {
    height: 52,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
  },
  socialButtonDisabled: {
    opacity: 0.45,
  },
  socialIcon: {
    fontSize: 18,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  socialLabel: {
    ...typography.label,
    color: colors.text.secondary,
  },
  socialNote: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing[2],
  },
  // ── 닫기
  closeLink: {
    alignSelf: 'center',
    paddingVertical: spacing[3],
  },
  closeText: {
    ...typography.label,
    color: colors.text.tertiary,
  },
})
