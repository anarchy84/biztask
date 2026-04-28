// 한글 주석: 프로필 편집 화면
//
// ▣ 이 화면이 하는 일:
//   - 아바타 업로드 / 제거 (avatars 버킷)
//   - 닉네임 수정 (2~20자)
//   - 업종 변경 (10종 중 1)
//   - 한줄소개 입력 (최대 100자)
//   - 저장 시 useProfileUpdate 호출 → 전역 프로필 갱신
//
// ▣ 진입 경로:
//   - 마이페이지 → "프로필 편집" 메뉴
//
// ▣ UX 원칙:
//   - "변경된 게 있을 때만" 저장 버튼 활성화
//   - 뒤로 가기 시 변경사항 있으면 confirm

import React, { useState, useMemo } from 'react'
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
  Image,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { INDUSTRY_META, type Industry } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useProfileUpdate } from '@/lib/hooks/useProfileUpdate'
import { useImageUpload } from '@/lib/hooks/useImageUpload'

const INDUSTRY_ORDER: Industry[] = [
  'cafe', 'food', 'beauty', 'retail', 'online',
  'service', 'education', 'health', 'creative', 'etc',
]

const NICKNAME_MAX = 20
const BIO_MAX = 100

export default function ProfileEditScreen() {
  const { profile } = useAuth()

  // ─────────────────────────────────────────────
  // 한글 주석: 초기값 = 현재 프로필 값
  //   - profile null이면 진입 자체가 안 돼야 함 (AuthGate가 막아주지만 안전장치)
  // ─────────────────────────────────────────────
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [industry, setIndustry] = useState<Industry>(profile?.industry ?? 'etc')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)

  const { update, updating, error, clearError } = useProfileUpdate()
  const {
    pickAndUpload,
    uploading: avatarUploading,
    error: avatarError,
    clearError: clearAvatarError,
  } = useImageUpload({ bucket: 'avatars' })

  // ─────────────────────────────────────────────
  // 한글 주석: 변경 여부 계산 (저장 버튼 활성화 + 뒤로가기 confirm 용)
  // ─────────────────────────────────────────────
  const isDirty = useMemo(() => {
    if (!profile) return false
    if (nickname.trim() !== profile.nickname) return true
    if (industry !== profile.industry) return true
    if ((bio.trim() || null) !== (profile.bio ?? null)) return true
    if (avatarUrl !== (profile.avatar_url ?? null)) return true
    return false
  }, [profile, nickname, industry, bio, avatarUrl])

  const canSubmit =
    isDirty &&
    nickname.trim().length >= 2 &&
    nickname.trim().length <= NICKNAME_MAX &&
    bio.trim().length <= BIO_MAX &&
    !updating &&
    !avatarUploading

  // ─────────────────────────────────────────────
  // 핸들러
  // ─────────────────────────────────────────────
  const handlePickAvatar = async () => {
    if (avatarUploading || updating) return
    if (avatarError) clearAvatarError()
    const url = await pickAndUpload()
    if (url) setAvatarUrl(url)
  }

  const handleRemoveAvatar = () => {
    Alert.alert('아바타 삭제', '기본 이니셜 아바타로 돌아가. 진행할까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => setAvatarUrl(null),
      },
    ])
  }

  const handleSave = async () => {
    if (!canSubmit) return
    const ok = await update({
      nickname,
      industry,
      bio: bio.trim().length === 0 ? null : bio,
      avatarUrl,
    })
    if (ok) {
      // 한글 주석: 저장 성공 → 마이페이지로 복귀
      if (router.canGoBack()) router.back()
      else router.replace('/(tabs)/profile' as any)
    }
  }

  const handleCancel = () => {
    if (!isDirty) {
      router.back()
      return
    }
    Alert.alert(
      '변경사항 버리고 나갈까?',
      '저장 안 한 변경사항이 사라져.',
      [
        { text: '계속 편집', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: () => router.back() },
      ],
    )
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    )
  }

  const initial = (nickname.trim() || '사').charAt(0)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} style={styles.headerBtn} hitSlop={8}>
          <Text style={styles.headerBtnText}>취소</Text>
        </Pressable>
        <Text style={styles.headerTitle}>프로필 편집</Text>
        <Pressable
          onPress={handleSave}
          style={styles.headerBtn}
          disabled={!canSubmit}
          hitSlop={8}
        >
          {updating ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text
              style={[
                styles.headerBtnText,
                styles.headerBtnSave,
                !canSubmit && styles.headerBtnDisabled,
              ]}
            >
              저장
            </Text>
          )}
        </Pressable>
      </View>

      {/* 에러 배너 */}
      {(error || avatarError) && (
        <Pressable
          style={styles.errorBanner}
          onPress={() => {
            if (error) clearError()
            if (avatarError) clearAvatarError()
          }}
        >
          <Text style={styles.errorBannerText}>{error ?? avatarError}</Text>
          <Text style={styles.errorBannerClose}>✕</Text>
        </Pressable>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* 아바타 영역 */}
          <View style={styles.avatarSection}>
            <Pressable
              onPress={handlePickAvatar}
              disabled={avatarUploading || updating}
              style={styles.avatarPressable}
            >
              {avatarUploading ? (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <ActivityIndicator color={colors.textBrand} />
                </View>
              ) : avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>📷</Text>
              </View>
            </Pressable>
            {avatarUrl && (
              <Pressable onPress={handleRemoveAvatar} disabled={updating}>
                <Text style={styles.avatarRemoveText}>아바타 삭제</Text>
              </Pressable>
            )}
          </View>

          {/* 닉네임 */}
          <View style={styles.section}>
            <Text style={styles.label}>닉네임</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={(t) => {
                if (error) clearError()
                setNickname(t)
              }}
              placeholder="2~20자"
              placeholderTextColor={colors.textMuted}
              maxLength={NICKNAME_MAX}
              editable={!updating}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              {nickname.trim().length} / {NICKNAME_MAX}
            </Text>
          </View>

          {/* 업종 */}
          <View style={styles.section}>
            <Text style={styles.label}>업종</Text>
            <Text style={styles.sublabel}>피드에 보이는 배지에 영향을 줘</Text>
            <View style={styles.industryGrid}>
              {INDUSTRY_ORDER.map((ind) => {
                const meta = INDUSTRY_META[ind]
                const isActive = industry === ind
                return (
                  <Pressable
                    key={ind}
                    onPress={() => setIndustry(ind)}
                    disabled={updating}
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
                        isActive && {
                          color: meta.fg,
                          fontFamily: 'Pretendard-SemiBold',
                        },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* 한줄소개 */}
          <View style={styles.section}>
            <Text style={styles.label}>한줄소개 (선택)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={(t) => {
                if (error) clearError()
                setBio(t)
              }}
              placeholder="다른 사장님들에게 한마디 (예: 동네 작은 카페 사장)"
              placeholderTextColor={colors.textMuted}
              maxLength={BIO_MAX}
              editable={!updating}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.hint}>
              {bio.trim().length} / {BIO_MAX}
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: colors.textPrimary,
  },
  headerBtnSave: {
    color: colors.textBrand,
    fontFamily: 'Pretendard-SemiBold',
  },
  headerBtnDisabled: {
    color: colors.textMuted,
    opacity: 0.5,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
  },

  // 에러 배너
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
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

  content: {
    padding: 24,
  },

  // 아바타 영역
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  avatarPressable: {
    position: 'relative',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgBrandSoft,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontFamily: 'Pretendard-Bold',
    color: colors.textBrand,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  avatarBadgeText: {
    fontSize: 14,
  },
  avatarRemoveText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Medium',
    textDecorationLine: 'underline',
    marginTop: 4,
  },

  // 섹션
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    marginBottom: 8,
  },
  sublabel: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    marginTop: -4,
    marginBottom: 12,
  },
  input: {
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: colors.textStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.bg,
  },
  bioInput: {
    minHeight: 80,
    paddingTop: 12,
    lineHeight: 22,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 6,
  },

  // 업종
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
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  industryChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
  },
})
