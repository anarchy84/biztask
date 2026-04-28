// 한글 주석: V2 탐색/네트워크 화면

import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar } from '@/components/common/Avatar'
import { IndustryBadge, VerifiedBadge } from '@/components/common/Badge'
import { Button } from '@/components/common/Button'
import { GritGauge } from '@/components/common/GritGauge'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'

const TRENDING = [
  { tag: '임대료협상', count: '1,247', change: '+340%', region: '전국' },
  { tag: '최저시급2026', count: '892', change: '+128%', region: '전국' },
  { tag: '성수동상권', count: '456', change: '+62%', region: '서울' },
  { tag: 'POS수수료', count: '287', change: '+45%', region: '전국' },
]

const SUGGESTED = [
  { name: '압구정바리스타', region: '강남', industry: '카페', mutual: 12, grit: 91, verified: true },
  { name: '동대문빅마마', region: '동대문', industry: '도소매', mutual: 7, grit: 88, verified: true },
  { name: 'B2B-447', region: '송파', industry: '유통', mutual: 4, grit: 76, verified: false },
  { name: '까칠한여우', region: '홍대', industry: '펍', mutual: 23, grit: 94, verified: true },
]

export default function ExploreScreen() {
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
          {SUGGESTED.map((user) => (
            <View key={user.name} style={styles.userCard}>
              <Avatar nickname={user.name} size={48} showRing={user.verified} />
              <View style={styles.userBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.name}
                  </Text>
                  {user.verified ? <VerifiedBadge size={14} /> : null}
                </View>
                <View style={styles.badgeRow}>
                  <IndustryBadge region={user.region} industryLabel={user.industry} />
                </View>
                <Text style={styles.mutual}>공통 팔로워 {user.mutual}명</Text>
              </View>
              <GritGauge mode="ring" score={user.grit} size={42} showLabel={false} />
              <Button label="팔로우" size="sm" />
            </View>
          ))}
        </View>

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
