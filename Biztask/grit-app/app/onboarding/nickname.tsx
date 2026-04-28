// 한글 주석: 최초 로그인 온보딩 - 닉네임 + 업종 입력 화면
//
// ▣ 이 화면이 하는 일:
//   - 소셜 로그인 후 최초 1회 노출 (onboarded=false 일 때)
//   - 닉네임 2~20자 + 업종 선택 (10종 중 1)
//   - profiles.update({ nickname, industry, onboarded: true })
//   - 완료 시 홈 탭으로 replace
//
// ▣ 스킵 불가:
//   - AuthGate에서 onboarded=false 면 무조건 이 화면만 렌더
//   - 뒤로가기 막음 (안드로이드 back 버튼 대응)
//
// ▣ UX 원칙:
//   - "실명 노출 주의" 안내 문구 꼭 노출
//   - 카카오/구글 프로필 닉네임을 **자동으로 채우지 않음** (실수 방지)
//   - 업종은 블라인드의 "회사 이름" 역할 → 기본값 없이 반드시 선택

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { INDUSTRY_META, type Industry } from '@/lib/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// 한글 주석: 업종 표시 순서 (편의상 INDUSTRY_META 키 순서 그대로)
const INDUSTRY_ORDER: Industry[] = [
  'cafe', 'food', 'beauty', 'retail', 'online',
  'service', 'education', 'health', 'creative', 'etc',
]

export default function OnboardingNicknameScreen() {
  const { user, refreshProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [industry, setIndustry] = useState<Industry | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = nickname.trim()
  const canSubmit = trimmed.length >= 2 && trimmed.length <= 20 && industry !== null && !submitting

  // ─────────────────────────────────────────────
  // 한글 주석: 닉네임·업종 저장
  //   - profiles UPDATE (이미 handle_new_user 트리거로 row 존재)
  //   - 성공 시 refreshProfile → AuthGate가 자동으로 홈으로 보냄
  // ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || !user?.id || !industry) return

    setError(null)
    setSubmitting(true)

    try {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          nickname: trimmed,
          industry,
          onboarded: true,
        })
        .eq('id', user.id)

      if (updErr) {
        // 한글 주석: Postgres unique violation 23505 → 닉네임 중복
        //   - 지금 DB엔 unique 제약 없지만, 후속 마이그레이션에 대비해 미리 처리
        if (updErr.code === '23505') {
          throw new Error('이미 쓰이고 있는 닉네임이야. 다른 걸로 해줘')
        }
        throw new Error(updErr.message)
      }

      // 한글 주석: 프로필 갱신 → AuthGate가 isOnboarded=true 감지하고 홈 렌더
      await refreshProfile()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 에러'
      console.error('[Onboarding] 저장 실패:', msg)
      setError(msg)
      setSubmitting(false)
    }
    // 한글 주석: 성공 시엔 AuthGate가 이 화면 자체를 언마운트하므로 setSubmitting(false) 불필요
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.base} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.greet}>환영해, 사장님 👋</Text>
            <Text style={styles.title}>앞으로 쓸 닉네임을 정해주자</Text>
            <Text style={styles.warn}>
              ⚠️ 실명·상호명 노출되지 않게{'\n'}
              별명 스타일로 정하는 걸 추천
            </Text>
          </View>

          {/* 닉네임 입력 */}
          <View style={styles.section}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={(t) => {
                if (error) setError(null)
                setNickname(t)
              }}
              placeholder="예: 동네카페사장, 눈썹장인..."
              placeholderTextColor={colors.text.tertiary}
              maxLength={20}
              editable={!submitting}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              2~20자 · {trimmed.length}자 입력
            </Text>
          </View>

          {/* 업종 선택 */}
          <View style={styles.section}>
            <Text style={styles.label}>업종</Text>
            <Text style={styles.sublabel}>
              피드에서 다른 사장님들에게 보이는 배지야
            </Text>
            <View style={styles.industryGrid}>
              {INDUSTRY_ORDER.map((ind) => {
                const meta = INDUSTRY_META[ind]
                const isActive = industry === ind
                return (
                  <Pressable
                    key={ind}
                    onPress={() => setIndustry(ind)}
                    disabled={submitting}
                    style={[
                      styles.industryChip,
                      isActive && {
                        backgroundColor: meta.bg,
                        borderColor: meta.fg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.industryChipText,
                        isActive && { color: meta.fg, fontFamily: 'Pretendard-SemiBold' },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* 에러 표시 */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* 하단 고정 CTA */}
        <View style={styles.cta}>
          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.text.primary} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  !canSubmit && styles.submitTextDisabled,
                ]}
              >
                GRIT 시작하기
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 16,
    marginBottom: 32,
  },
  greet: {
    fontSize: 15,
    fontFamily: 'Pretendard-Medium',
    color: colors.brand[400],
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Pretendard-Bold',
    color: colors.text.primary,
    lineHeight: 32,
    marginBottom: 16,
  },
  warn: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: colors.text.tertiary,
    lineHeight: 19,
    backgroundColor: colors.bg.surface,
    padding: 12,
    borderRadius: 8,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: colors.text.tertiary,
    marginBottom: 12,
    marginTop: -4,
  },
  input: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.text.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line.default,
    borderRadius: 10,
    backgroundColor: colors.bg.base,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.text.tertiary,
    marginTop: 6,
    textAlign: 'right',
  },
  industryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  industryChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.base,
  },
  industryChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.text.secondary,
  },
  errorBox: {
    padding: 12,
    marginTop: -16,
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: '#991B1B',
  },
  cta: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
    borderTopWidth: 1,
    borderTopColor: colors.line.default,
    backgroundColor: colors.bg.base,
  },
  submit: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    backgroundColor: colors.bg.raised,
  },
  submitText: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.text.primary,
  },
  submitTextDisabled: {
    color: colors.text.tertiary,
  },
})
