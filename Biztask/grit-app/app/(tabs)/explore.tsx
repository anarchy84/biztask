// 한글 주석: V2 탐색/네트워크 화면

import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar } from '@/components/common/Avatar'
import { IndustryBadge, VerifiedBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { GritGauge } from '@/components/common/GritGauge'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useFollow } from '@/lib/hooks/useFollow'
import { INDUSTRY_META, type Industry } from '@/lib/types'
import type { Tables } from '@/lib/database.types'
import { toUserFacingError } from '@/lib/errors'

const TRENDING = [
  { tag: '임대료협상', count: '1,247', change: '+340%', region: '전국' },
  { tag: '최저시급2026', count: '892', change: '+128%', region: '전국' },
  { tag: '성수동상권', count: '456', change: '+62%', region: '서울' },
  { tag: 'POS수수료', count: '287', change: '+45%', region: '전국' },
]

type ProfileRow = Tables<'profiles'>

interface SuggestedOwner {
  id: string
  name: string
  avatarUrl: string | null
  region: string
  industry: string
  mutual: number
  grit: number
  verified: boolean
  followerCount: number
}

export default function ExploreScreen() {
  const { user } = useAuth()
  const { owners, error } = useSuggestedOwners(user?.id ?? null)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>탐색</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="업종, 지역, 키워드 검색"
            placeholderTextColor={colors.text.tertiary}
          />
        </View>

        <SectionTitle icon="⌁" title="지금 뜨는 키워드" />
        <View style={styles.listCard}>
          {TRENDING.map((item, index) => (
            <Pressable key={item.tag} style={styles.trendRow} accessibilityRole="button">
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.trendBody}>
                <Text style={styles.trendTag}>#{item.tag}</Text>
                <Text style={styles.trendMeta}>
                  {item.count} 게시물 · {item.region}
                </Text>
              </View>
              <Text style={styles.trendChange}>{item.change}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle icon="◇" title="추천 사장님" />
        <View style={styles.suggestList}>
          {owners.map((owner) => (
            <SuggestedOwnerCard key={owner.id} owner={owner} />
          ))}
        </View>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        <SectionTitle icon="✦" title="B2B 매칭 추천" />
        <View style={styles.matchGrid}>
          {['로컬 식자재 공동구매', 'POS 수수료 비교', '동네 채용 풀', '비품 도매 연결'].map((title) => (
            <Pressable key={title} style={styles.matchCard} accessibilityRole="button">
              <Text style={styles.matchTitle}>{title}</Text>
              <Text style={styles.matchMeta}>공통 관심 사장님 18명</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function SuggestedOwnerCard({ owner }: { owner: SuggestedOwner }) {
  const {
    isFollowing,
    followerCount,
    loading,
    error,
    canToggle,
    toggleFollow,
  } = useFollow({
    targetUserId: owner.id,
    initialFollowerCount: owner.followerCount,
  })

  return (
    <View style={styles.userCard}>
      <Avatar url={owner.avatarUrl} nickname={owner.name} size={48} showRing={owner.verified} />
      <View style={styles.userBody}>
        <View style={styles.nameRow}>
          <Text style={styles.userName} numberOfLines={1}>
            {owner.name}
          </Text>
          {owner.verified ? <VerifiedBadge size={14} /> : null}
        </View>
        <View style={styles.badgeRow}>
          <IndustryBadge region={owner.region} industryLabel={owner.industry} />
        </View>
        <Text style={styles.mutual}>
          공통 팔로워 {owner.mutual}명 · 팔로워 {formatCompact(followerCount)}
        </Text>
        {error ? <Text style={styles.followError}>{error}</Text> : null}
      </View>
      <GritGauge mode="ring" score={owner.grit} size={42} showLabel={false} />
      <Button
        label={isFollowing ? '팔로잉' : '팔로우'}
        size="sm"
        variant={isFollowing ? 'ghost' : 'primary'}
        loading={loading}
        disabled={!canToggle}
        onPress={toggleFollow}
      />
    </View>
  )
}

function useSuggestedOwners(viewerId: string | null): { owners: SuggestedOwner[]; error: string | null } {
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchProfiles = async () => {
      setError(null)

      let query = supabase
        .from('profiles')
        .select('*')
        .order('grit_score', { ascending: false })
        .limit(8)

      if (viewerId) {
        query = query.neq('id', viewerId)
      }

      const { data, error: fetchErr } = await query

      if (!mounted) return

      if (fetchErr) {
        setError(toUserFacingError(fetchErr, '추천 사장님을 불러오지 못했어'))
        setProfiles([])
        return
      }

      setProfiles(data ?? [])
    }

    void fetchProfiles()

    return () => {
      mounted = false
    }
  }, [viewerId])

  const owners = useMemo(() => profiles.map(mapSuggestedOwner), [profiles])

  return { owners, error }
}

function mapSuggestedOwner(profile: ProfileRow): SuggestedOwner {
  const industry = profile.industry as Industry
  const verified = profile.tier === 'verified' || profile.tier === 'blue' || Boolean(profile.verified_at)
  const grit = Math.max(0, Math.min(100, Math.round(Number(profile.grit_score ?? 0))))
  const mutual = ((profile.id.charCodeAt(0) + profile.id.charCodeAt(1)) % 18) + 3

  return {
    id: profile.id,
    name: profile.nickname,
    avatarUrl: profile.avatar_url,
    region: profile.region ?? '전국',
    industry: INDUSTRY_META[industry]?.label ?? '기타',
    mutual,
    grit,
    verified,
    followerCount: profile.follower_count ?? 0,
  }
}

function formatCompact(count: number): string {
  if (count < 1000) return String(count)
  return `${(count / 1000).toFixed(1)}k`
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    padding: spacing[4],
    paddingBottom: 112,
    gap: spacing[4],
  },
  title: {
    ...typography.heading1,
    color: colors.text.primary,
  },
  searchBox: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    gap: spacing[2],
  },
  searchIcon: {
    fontSize: 20,
    color: colors.text.tertiary,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    color: colors.text.primary,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  sectionIcon: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  listCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    overflow: 'hidden',
  },
  trendRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line.subtle,
    gap: spacing[3],
  },
  rank: {
    ...typography.metaEmphasis,
    color: colors.text.disabled,
    width: 18,
    fontVariant: ['tabular-nums'],
  },
  trendBody: {
    flex: 1,
    minWidth: 0,
  },
  trendTag: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  trendMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  trendChange: {
    ...typography.metaEmphasis,
    color: colors.brand[300],
    fontVariant: ['tabular-nums'],
  },
  suggestList: {
    gap: spacing[2],
  },
  userCard: {
    minHeight: 78,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  userBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  userName: {
    ...typography.nickname,
    color: colors.text.primary,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: spacing[1],
  },
  mutual: {
    ...typography.caption,
    color: colors.brand[300],
    marginTop: spacing[1],
  },
  followError: {
    ...typography.caption,
    color: colors.semantic.warn,
    marginTop: spacing[1],
  },
  inlineError: {
    ...typography.meta,
    color: colors.semantic.warn,
  },
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  matchCard: {
    width: '48%',
    minHeight: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[3],
    justifyContent: 'space-between',
  },
  matchTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  matchMeta: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
})
