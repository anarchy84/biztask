// 한글 주석: 내정보 탭 화면 (Phase 1 placeholder)
//
// ▣ Phase 1: 목업 프로필 정보만 표시
// ▣ Phase 2 예정 기능:
//   - Supabase auth 세션 기반 프로필 표시
//   - 내 글·댓글·좋아요 탭
//   - 프로필 편집 (닉네임·업종·한줄소개)
//   - 알림 설정·로그아웃·탈퇴

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native'
import { colors } from '@/constants/colors'
import IndustryBadge from '@/components/common/IndustryBadge'

// 한글 주석: 목업 프로필 (Phase 2에서 Supabase로 교체)
const mockProfile = {
  nickname: '대웅사장',
  industry: 'cafe' as const,
  bio: '동네에서 작은 카페 하는 사장입니다. 사장님들 이야기 듣고 싶어요.',
  stats: {
    posts: 12,
    comments: 47,
    likes: 238,
  },
}

interface MenuItem {
  icon: string
  label: string
  hint?: string
}

const MENU_ITEMS: MenuItem[][] = [
  [
    { icon: '📝', label: '내가 쓴 글' },
    { icon: '💬', label: '내 댓글' },
    { icon: '♥', label: '좋아요한 글' },
  ],
  [
    { icon: '🔔', label: '알림 설정' },
    { icon: '🎨', label: '프로필 편집' },
    { icon: '🏷️', label: '업종 변경' },
  ],
  [
    { icon: '📣', label: '공지사항' },
    { icon: '❓', label: '문의하기' },
    { icon: '📄', label: '이용약관 · 개인정보' },
    { icon: 'ℹ️', label: '앱 버전', hint: 'v0.1.0 (Phase 1)' },
  ],
]

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        {/* 한글 주석: 프로필 헤더 (아바타 + 닉네임 + 업종 + 바이오) */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {mockProfile.nickname.charAt(0)}
            </Text>
          </View>
          <Text style={styles.nickname}>{mockProfile.nickname}</Text>
          <View style={styles.badgeWrap}>
            <IndustryBadge industry={mockProfile.industry} size="md" />
          </View>
          <Text style={styles.bio}>{mockProfile.bio}</Text>
        </View>

        {/* 한글 주석: 통계 바 (글·댓글·좋아요) */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{mockProfile.stats.posts}</Text>
            <Text style={styles.statLabel}>글</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{mockProfile.stats.comments}</Text>
            <Text style={styles.statLabel}>댓글</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{mockProfile.stats.likes}</Text>
            <Text style={styles.statLabel}>받은 ♥</Text>
          </View>
        </View>

        {/* 한글 주석: 메뉴 섹션들 */}
        {MENU_ITEMS.map((section, sectionIdx) => (
          <View key={sectionIdx} style={styles.menuSection}>
            {section.map((item, itemIdx) => (
              <Pressable
                key={item.label}
                style={[
                  styles.menuItem,
                  itemIdx !== section.length - 1 && styles.menuItemBorder,
                ]}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.hint ? (
                  <Text style={styles.menuHint}>{item.hint}</Text>
                ) : (
                  <Text style={styles.menuArrow}>›</Text>
                )}
              </Pressable>
            ))}
          </View>
        ))}

        {/* 한글 주석: 하단 여백 + 로그아웃 버튼 (Phase 2에서 실제 로그아웃 연결) */}
        <Pressable style={styles.logoutBtn}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>GRIT · 사장님들의 쉼터</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgMuted,
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
  menuIcon: {
    fontSize: 16,
    width: 28,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
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
