import { useEffect, useRef, useState } from 'react'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors } from '@/constants/colors'
import { useAuth } from '@/contexts/AuthContext'
import { setSupabaseSessionFromRedirectUrl } from '@/lib/oauthSession'

export default function AuthCallbackScreen() {
  const router = useRouter()
  const { refreshProfile } = useAuth()
  const liveUrl = Linking.useURL()
  const handledUrlRef = useRef<string | null>(null)
  const [initialUrl, setInitialUrl] = useState<string | null>(null)
  const [statusText, setStatusText] = useState('로그인 마무리 중…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => setInitialUrl(url))
      .catch((err) => {
        console.warn('[AuthCallback] initial URL 로드 실패:', err)
      })
  }, [])

  const callbackUrl = liveUrl ?? initialUrl

  useEffect(() => {
    if (!callbackUrl || handledUrlRef.current === callbackUrl) return

    handledUrlRef.current = callbackUrl
    let cancelled = false

    const completeOAuth = async () => {
      try {
        setError(null)
        setStatusText('로그인 정보를 확인하는 중…')

        const { userId } = await setSupabaseSessionFromRedirectUrl(callbackUrl)
        if (cancelled) return

        setStatusText('프로필을 불러오는 중…')
        const profile = await refreshProfile(userId)
        if (cancelled) return

        if (profile?.onboarded === true) {
          router.replace('/(tabs)' as any)
          return
        }

        router.replace('/onboarding/nickname' as any)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '로그인을 마무리하지 못했어'
        console.error('[AuthCallback] 로그인 콜백 처리 실패:', message)
        if (!cancelled) {
          setError(message)
        }
      }
    }

    completeOAuth()

    return () => {
      cancelled = true
    }
  }, [callbackUrl, refreshProfile, router])

  useEffect(() => {
    if (callbackUrl || error) return

    const timer = setTimeout(() => {
      setError('로그인 콜백 정보를 찾지 못했어. 다시 시도해줘')
    }, 1500)

    return () => clearTimeout(timer)
  }, [callbackUrl, error])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.brand[500]} />
        <Text style={styles.title}>
          {error ? '로그인을 완료하지 못했어' : '로그인 마무리 중…'}
        </Text>
        <Text style={styles.description}>
          {error ?? statusText}
        </Text>

        {error && (
          <View style={styles.buttonGroup}>
            <Pressable
              onPress={() => router.replace('/login' as any)}
              style={[styles.button, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>다시 로그인</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace('/(tabs)' as any)}
              style={[styles.button, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>홈으로 이동</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
  },
  title: {
    marginTop: 18,
    fontSize: 20,
    color: colors.text.primary,
    fontFamily: 'Pretendard-SemiBold',
    textAlign: 'center',
  },
  description: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.tertiary,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
    marginTop: 22,
  },
  button: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: colors.brand[500],
  },
  primaryButtonText: {
    fontSize: 15,
    color: colors.text.primary,
    fontFamily: 'Pretendard-SemiBold',
  },
  secondaryButton: {
    backgroundColor: colors.bg.base,
    borderWidth: 1,
    borderColor: colors.line.strong,
  },
  secondaryButtonText: {
    fontSize: 15,
    color: colors.text.primary,
    fontFamily: 'Pretendard-Medium',
  },
})
