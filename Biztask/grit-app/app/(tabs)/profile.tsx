// 한글 주석: 내정보 탭 화면
//
// ▣ 이 화면이 하는 일:
//   - AuthContext의 profile 실데이터 표시
//   - useMyStats로 내 활동 카운트 조회 (글·댓글·받은 좋아요)
//   - 익명 상태면 "로그인하기" CTA 큰 버튼
//   - 소셜 로그인 상태면 "로그아웃" 버튼 + 프로필 편집 링크 (Phase 3-2에서 활성화)
//
// ▣ 메뉴 구조:
//   - 익명일 때: 로그인 CTA + 기본 메뉴 (공지/문의/약관/버전)
//   - 로그인 상태: 전체 메뉴 (내 글·댓글·좋아요한 글·편집 등)
//
// ▣ 로그아웃:
//   - AuthContext.signOut 호출 → 자동으로 새 익명 세션 발급
//   - 프로필이 새 익명으로 바뀌니 화면 자동 리렌더

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import IndustryBadge from '@/components/common/IndustryBadge'
import { useAuth } from '@/contexts/AuthContext'
import { useMyStats } from '@/lib/hooks/useMyStats'

interface MenuItem {
  icon: string
  label: string
  hint?: string
  onPress?: () => void
  disabled?: boolean
}

export default function ProfileScreen() {
  const { profile, isAnonymous, signOut } = useAuth()
  const { stats, loading: statsLoading } = useMyStats()

  // ─────────────────────────────────────────────
  // 한글 주석: 로그아웃 핸들러
  //   - Alert로 한 번 확인
  //   - signOut 완료되면 AuthContext가 새 익명 세션 발급
  // ─────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert(
      '로그아웃할까?',
      '로그아웃해도 익명으로 앱은 계속 쓸 수 있어.\n다시 로그인하면 기록이 돌아와.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut()
            } catch (e) {
              Alert.alert(
                '로그아웃 실패',
                e instanceof Error ? e.message : '다시 시도해줘',
              )
            }
          },
        },
      ],
    )
  }

  // 한글 주석: 프로필 없음은 AuthGate에서 막아주지만 TypeScript 타입 좁히기용
  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────
  // 한글 주석: 메뉴 구성 (익명 vs 로그인 상태에 따라 다르게)
  // ─────────────────────────────────────────────
  const activitySection: MenuItem[] = [
    { icon: '📝', label: '내가 쓴 글', disabled: isAnonymous },
    { icon: '💬', label: '내 댓글', disabled: isAnonymous },
    { icon: '♥', label: '좋아요한 글', disabled: isAnonymous },
  ]

  const settingsSection: MenuItem[] = [
    { icon: '🔔', label: '알림 설정', hint: '준비중' },
    {
      // 한글 주석: 프로필 편집은 익명 유저도 사용 가능 (닉네임/업종/bio/아바타)
      icon: '🎨',
      label: '프로필 편집',
      onPress: () => router.push('/profile/edit' as any),
    },
    {
      // 한글 주석: 업종 변경도 프로필 편집 화면 안에 있으니 같은 곳으로 보냄
      icon: '🏷️',
      label: '업종 변경',
      onPress: () => router.push('/profile/edit' as any),
    },
  ]

  const infoSection: MenuItem[] = [
    { icon: '📣', label: '공지사항' },
    { icon: '❓', label: '문의하기' },
    { icon: '📄', label: '이용약관 · 개인정보' },
    { icon: 'ℹ️', label: '앱 버전', hint: 'v0.1.0 (Phase 3)' },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        {/* 프로필 헤더 */}
        <View style={styles.profileHeader}>
          {profile.avatar_url ? (
            // 한글 주석: 업로드한 아바타 이미지 표시
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            // 한글 주석: 기본 이니셜 아바타
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.nickname.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.nickname}>{profile.nickname}</Text>
          <View style={styles.badgeWrap}>
            <IndustryBadge industry={profile.industry} size="md" />
          </View>
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : isAnonymous ? (
            <Text style={styles.bioPlaceholder}>
              로그인하면 닉네임·업종·소개를 바꿀 수 있어
            </Text>
          ) : (
            <Text style={styles.bioPlaceholder}>
              프로필 편집에서 한줄 소개를 추가해봐
            </Text>
          )}
        </View>

        {/* 한글 주석: 익명일 때만 로그인 CTA 큰 버튼 */}
        {isAnonymous && (
          <View style={styles.loginCtaBox}>
            <Pressable
              style={styles.loginCtaBtn}
              onPress={() => router.push('/login' as any)}
            >
              <Text style={styles.loginCtaText}>
                🚀 로그인하고 계정 지키기
              </Text>
            </Pressable>
            <Text style={styles.loginCtaSub}>
              익명 상태에서 쓴 글·댓글도 그대로 유지돼
            </Text>
          </View>
        )}

        {/* 통계 바 */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {statsLoading ? '…' : stats.postCount}
            </Text>
            <Text style={styles.statLabel}>글</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {statsLoading ? '…' : stats.commentCount}
            </Text>
            <Text style={styles.statLabel}>댓글</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {statsLoading ? '…' : stats.likesReceived}
            </Text>
            <Text style={styles.statLabel}>받은 ♥</Text>
          </View>
        </View>

        {/* 메뉴 섹션들 */}
        <MenuSection items={activitySection} />
        <MenuSection items={settingsSection} />
        <MenuSection items={infoSection} />

        {/* 한글 주석: 로그인 상태면 로그아웃, 익명이면 숨김 */}
        {!isAnonymous && (
          <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>GRIT · 사장님들의 쉼터</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
// 메뉴 섹션 서브 컴포넌트
// ─────────────────────────────────────────────
function MenuSection({ items }: { items: MenuItem[] }) {
  return (
    <View style={styles.menuSection}>
      {items.map((item, idx) => (
        <Pressable
          key={item.label}
          style={[
            styles.menuItem,
            idx !== items.length - 1 && styles.menuItemBorder,
            item.disabled && styles.menuItemDisabled,
          ]}
          onPress={item.onPress}
          disabled={item.disabled}
        >
          <Text
            style={[
              styles.menuIcon,
              item.disabled && styles.menuIconDisabled,
            ]}
          >
            {item.icon}
          </Text>
          <Text
            style={[
              styles.menuLabel,
              item.disabled && styles.menuLabelDisabled,
            ]}
          >
            {item.label}
          </Text>
          {item.hint ? (
            <Text style={styles.menuHint}>{item.hint}</Text>
          ) : !item.disabled ? (
            <Text style={styles.menuArrow}>›</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgMuted,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Pretendard-Bold',
    color: colors.textBrand,
  },
  nickname: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    marginBottom: 8,
  },
  badgeWrap: {
    marginBottom: 10,
  },
  bio: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  bioPlaceholder: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 18,
  },

  // 로그인 CTA (익명 전용)
  loginCtaBox: {
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  loginCtaBtn: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginCtaText: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
  },
  loginCtaSub: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
  },

  // 통계 바
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.bg,
    marginTop: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Pretendard-Bold',
    color: colors.textStrong,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
    marginTop: 2,
  },

  // 메뉴
  menuSection: {
    backgroundColor: colors.bg,
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuIcon: {
    fontSize: 16,
    width: 28,
  },
  menuIconDisabled: {
    opacity: 0.5,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
  },
  menuLabelDisabled: {
    color: colors.textMuted,
  },
  menuArrow: {
    fontSize: 18,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  menuHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },

  // 로그아웃
  logoutBtn: {
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: colors.textMuted,
  },
  footer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
  },
})
