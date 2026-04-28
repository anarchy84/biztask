// 한글 주석: V2 프로필 화면
//
// ▣ 커버 + 아바타 + 통계 + Mutual + 그릿 게이지 + 프로필 탭 구조.

import React, { useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Avatar } from '@/components/common/Avatar'
import { IndustryBadge, ProBlueBadge, VerifiedBadge, YearsBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { GritGauge } from '@/components/common/GritGauge'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'
import { INDUSTRY_META } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import { useMyStats } from '@/lib/hooks/useMyStats'

const TABS = ['내 게시물', '답글', '비즈니스 제안', '저장']

export default function ProfileScreen() {
  const { profile, isAnonymous } = useAuth()
  const { stats, loading } = useMyStats()
  const [activeTab, setActiveTab] = useState(0)

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand[500]} />
        </View>
      </SafeAreaView>
    )
  }

  const industryLabel = INDUSTRY_META[profile.industry]?.label ?? '기타'
  const verified = profile.tier === 'verified' || profile.tier === 'blue' || Boolean(profile.verified_at)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.cover}>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.coverImage} resizeMode="cover" />
          ) : null}
          <View style={styles.coverGlow} />
          <View style={styles.coverFade} />
        </View>

        <View style={styles.profileBlock}>
          <View style={styles.avatarActionRow}>
            <Avatar
              url={profile.avatar_url}
              nickname={profile.nickname}
              size={84}
              showRing={verified}
              style={styles.avatarOverlap}
            />
            <View style={styles.profileActions}>
              <Pressable style={styles.settingsButton} accessibilityRole="button" accessibilityLabel="설정">
                <Text style={styles.settingsIcon}>⚙</Text>
              </Pressable>
              <Button
                label="프로필 편집"
                size="sm"
                onPress={() => router.push('/profile/edit' as any)}
              />
            </View>
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.nickname}>{profile.nickname}</Text>
            {verified ? <VerifiedBadge size={16} /> : null}
            {profile.tier === 'blue' ? <ProBlueBadge /> : null}
          </View>

          <View style={styles.badgeRow}>
            <IndustryBadge region={profile.region} industryLabel={industryLabel} />
            <YearsBadge years={profile.years_in_business} />
          </View>

          <Text style={styles.bio}>
            {profile.bio ?? (isAnonymous ? '익명으로 둘러보는 중이야. 로그인하면 기록을 지킬 수 있어.' : '프로필 편집에서 사장님의 한 줄 소개를 추가해봐.')}
          </Text>
        </View>

        {isAnonymous ? (
          <View style={styles.loginCta}>
            <Text style={styles.loginTitle}>계정을 지켜둘까요?</Text>
            <Text style={styles.loginText}>익명 상태에서 쓴 글과 댓글도 로그인하면 이어서 쓸 수 있어.</Text>
            <Button label="로그인하고 계정 지키기" onPress={() => router.push('/login' as any)} fullWidth />
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Stat label="게시물" value={loading ? '…' : String(stats.postCount)} />
          <Stat label="팔로워" value={profile.follower_count.toLocaleString()} />
          <Stat label="팔로잉" value={profile.following_count.toLocaleString()} />
        </View>

        <View style={styles.mutualRow}>
          <View style={styles.mutualAvatars}>
            {['마', '강', '을', '홍'].map((name, index) => (
              <Avatar key={name} nickname={name} size={24} style={{ marginLeft: index === 0 ? 0 : -8 }} />
            ))}
          </View>
          <Text style={styles.mutualText}>
            <Text style={styles.mutualStrong}>23명</Text>의 공통 팔로워
          </Text>
        </View>

        <View style={styles.gaugeCard}>
          <GritGauge mode="bar" score={profile.grit_score} />
          <Text style={styles.gaugeHint}>매칭 응답률과 인증 활동이 올라가면 지수가 상승해.</Text>
        </View>

        <View style={styles.tabs}>
          {TABS.map((tab, index) => (
            <Pressable
              key={tab}
              style={styles.tab}
              onPress={() => setActiveTab(index)}
              accessibilityRole="button"
            >
              <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>{tab}</Text>
              {activeTab === index ? <View style={styles.tabLine} /> : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>{TABS[activeTab]}</Text>
          <Text style={styles.emptyText}>V2 피드 연결 후 이 영역에 활동이 표시돼.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    paddingBottom: 112,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    height: 180,
    backgroundColor: colors.bg.surface,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.line.default,
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  coverGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand[800],
    opacity: 0.16,
  },
  coverFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.base,
    opacity: 0.18,
  },
  profileBlock: {
    paddingHorizontal: spacing[4],
    marginTop: -42,
    gap: spacing[3],
  },
  avatarActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  avatarOverlap: {
    borderWidth: 3,
    borderColor: colors.bg.base,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[2],
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
  },
  settingsIcon: {
    color: colors.text.secondary,
    fontSize: 17,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  nickname: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  bio: {
    ...typography.body,
    color: colors.text.secondary,
  },
  loginCta: {
    margin: spacing[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[4],
    gap: spacing[3],
  },
  loginTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  loginText: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    gap: spacing[4],
  },
  stat: {
    flex: 1,
  },
  statValue: {
    ...typography.numStrong,
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  mutualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  mutualAvatars: {
    flexDirection: 'row',
  },
  mutualText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  mutualStrong: {
    color: colors.brand[300],
    fontWeight: '700',
  },
  gaugeCard: {
    marginHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[4],
    gap: spacing[2],
  },
  gaugeHint: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.line.default,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    ...typography.metaEmphasis,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.text.primary,
  },
  tabLine: {
    position: 'absolute',
    left: spacing[3],
    right: spacing[3],
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.brand[400],
  },
  emptyPanel: {
    margin: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  emptyTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  emptyText: {
    ...typography.meta,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
})
