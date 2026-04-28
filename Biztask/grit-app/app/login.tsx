// 한글 주석: 로그인 화면 (모달 스타일로 뜸)
//
// ▣ 이 화면이 하는 일:
//   - 카카오·구글 소셜 로그인 버튼
//   - 익명 세션에서 소셜 계정 업그레이드 (linkIdentity)
//   - 성공 시 자동으로 상위 라우트 pop → AuthGate가 온보딩 여부 판정
//
// ▣ 진입 경로:
//   - 프로필 탭의 "로그인" 버튼
//   - 향후: 글쓰기/알림 등 로그인 필수 액션 시 리다이렉트
//
// ▣ 디자인 원칙:
//   - 카카오: 공식 가이드라인 준수 (노란색 + 검은 말풍선 로고 컨셉 이모지로 대체)
//   - 구글: 흰 배경 + 구글 컬러 로고 이모지
//   - 실제 SVG 로고는 Phase 3-2에서 교체 예정

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { useSocialLogin } from '@/lib/hooks/useSocialLogin'
import { useAuth } from '@/contexts/AuthContext'
import {
  getSocialProviderConfig,
  isSocialProviderEnabled,
  type SocialProvider,
} from '@/lib/socialProviders'

export default function LoginScreen() {
  const { login, loading, activeProvider, error, clearError } = useSocialLogin()
  const { isAnonymous } = useAuth()
  const kakaoEnabled = isSocialProviderEnabled('kakao')
  const kakaoConfig = getSocialProviderConfig('kakao')
  const googleConfig = getSocialProviderConfig('google')

  // ─────────────────────────────────────────────
  // 한글 주석: 로그인 버튼 핸들러
  //   - 성공하면 뒤로 가기 (모달 닫힘 → AuthGate가 온보딩 체크)
  // ─────────────────────────────────────────────
  const handleLogin = async (provider: SocialProvider) => {
    if (loading) return
    const ok = await login(provider)
    if (ok) {
      // 한글 주석: 로그인 성공 → 이전 화면으로 돌아감
      //   - 온보딩이 필요하면 _layout의 AuthGate가 자동으로 /onboarding으로 보냄
      if (router.canGoBack()) {
        router.back()
      } else {
        router.replace('/(tabs)' as any)
      }
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* 상단 닫기 버튼 (모달처럼 취급) */}
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/(tabs)' as any)
          }}
          style={styles.closeBtn}
          hitSlop={12}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
      </View>

      {/* 중앙 로고 + 헤드라인 */}
      <View style={styles.hero}>
        <Text style={styles.logo}>GRIT</Text>
        <Text style={styles.headline}>사장님들의 쉼터</Text>
        <Text style={styles.subhead}>
          {isAnonymous
            ? '로그인해서 쌓은 기록을 지켜두자'
            : '로그인 후 계속 이용해줘'}
        </Text>
      </View>

      {/* 에러 배너 */}
      {error && (
        <Pressable style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Text style={styles.errorBannerClose}>✕</Text>
        </Pressable>
      )}

      {/* 로그인 버튼들 */}
      <View style={styles.buttonGroup}>
        {/* 카카오 */}
        <Pressable
          style={[
            styles.btn,
            styles.btnKakao,
            (!kakaoEnabled || loading) && styles.btnDisabled,
          ]}
          onPress={() => handleLogin('kakao')}
          disabled={loading || !kakaoEnabled}
        >
          {loading && activeProvider === 'kakao' ? (
            <ActivityIndicator size="small" color="#3C1E1E" />
          ) : (
            <>
              <Text style={styles.btnIconKakao}>💬</Text>
              <Text style={styles.btnTextKakao}>{kakaoConfig.buttonLabel}</Text>
            </>
          )}
        </Pressable>

        {/* 구글 */}
        <Pressable
          style={[styles.btn, styles.btnGoogle, loading && styles.btnDisabled]}
          onPress={() => handleLogin('google')}
          disabled={loading}
        >
          {loading && activeProvider === 'google' ? (
            <ActivityIndicator size="small" color={colors.textStrong} />
          ) : (
            <>
              <Text style={styles.btnIconGoogle}>G</Text>
              <Text style={styles.btnTextGoogle}>{googleConfig.buttonLabel}</Text>
            </>
          )}
        </Pressable>

        {/* 한글 주석: 애플은 추후 추가 예정 (개발자 계정 발급 후) */}
      </View>
      {!kakaoEnabled && (
        <Text style={styles.providerHint}>
          카카오 로그인은 비즈앱 전환 전까지 준비중이야. 지금은 구글 로그인을
          이용해줘.
        </Text>
      )}

      {/* 익명 유지 옵션 (하단) */}
      <View style={styles.anonymousBox}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back()
            else router.replace('/(tabs)' as any)
          }}
        >
          <Text style={styles.anonymousText}>
            {isAnonymous
              ? '나중에 로그인할게 →'
              : '익명으로 둘러보기 →'}
          </Text>
        </Pressable>
      </View>

      {/* 하단 약관 안내 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          로그인하면 이용약관 및 개인정보 처리방침에{'\n'}동의하는 것으로 간주돼요
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    height: 48,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    color: colors.textStrong,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 60,
  },
  logo: {
    fontSize: 48,
    fontFamily: 'Pretendard-Bold',
    color: colors.textStrong,
    letterSpacing: 4,
    marginBottom: 16,
  },
  headline: {
    fontSize: 20,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    marginBottom: 8,
  },
  subhead: {
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontFamily: 'Pretendard-Medium',
  },
  errorBannerClose: {
    fontSize: 14,
    color: '#991B1B',
    marginLeft: 8,
  },
  buttonGroup: {
    paddingHorizontal: 20,
    gap: 10,
  },
  providerHint: {
    marginTop: 12,
    paddingHorizontal: 28,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 52,
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  // 카카오 공식 컬러 (#FEE500)
  btnKakao: {
    backgroundColor: '#FEE500',
  },
  btnIconKakao: {
    fontSize: 18,
  },
  btnTextKakao: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: '#3C1E1E',
  },
  // 구글: 흰 배경 + 테두리
  btnGoogle: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnIconGoogle: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    color: '#4285F4',
  },
  btnTextGoogle: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
  },
  anonymousBox: {
    alignItems: 'center',
    marginTop: 28,
  },
  anonymousText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
})
