// 한글 주석: V2 알림 화면

import React, { useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar } from '@/components/common/Avatar'
import { VerifiedBadge } from '@/components/common/Badge'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'

type Filter = 'all' | 'follow' | 'mention' | 'match'
type NoticeType = 'quote' | 'follow' | 'like' | 'match' | 'comment' | 'milestone'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'follow', label: '팔로우' },
  { key: 'mention', label: '멘션' },
  { key: 'match', label: '매칭' },
]

const ITEMS = [
  { id: '1', type: 'quote' as NoticeType, who: '을지로프린스', text: '님이 회원님 글을 인용했어요.', preview: 'POS 교체 후기 진심 공감', time: '2분 전', unread: true, verified: true },
  { id: '2', type: 'follow' as NoticeType, who: '강남숯불왕', text: '님이 회원님을 팔로우합니다.', time: '15분 전', unread: true, verified: true },
  { id: '3', type: 'like' as NoticeType, who: '까칠한여우 외 24명', text: '이 회원님 글을 좋아합니다.', preview: '임대료 협상 후기 공유합니다...', time: '1시간 전', unread: false },
  { id: '4', type: 'match' as NoticeType, who: 'B2B 매칭', text: ' · 신선육 도매업체에서 제안이 도착했어요.', time: '3시간 전', unread: false },
  { id: '5', type: 'comment' as NoticeType, who: '리테일러7', text: '님이 댓글을 남겼어요.', preview: '저희 가게도 비슷한 상황이라 공유 감사합니다', time: '5시간 전', unread: false },
  { id: '6', type: 'milestone' as NoticeType, who: '그릿 지수가 90을 돌파했어요', text: '', time: '어제', unread: false },
]

export default function NotificationsScreen() {
  const [filter, setFilter] = useState<Filter>('all')

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>알림</Text>
        <Pressable style={styles.readAll} accessibilityRole="button">
          <Text style={styles.readAllText}>모두 읽음</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.chip, filter === item.key && styles.chipActive]}
            onPress={() => setFilter(item.key)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, filter === item.key && styles.chipTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={ITEMS}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <NoticeRow item={item} />}
        ListFooterComponent={<Text style={styles.footerText}>여기까지가 최근 알림이야</Text>}
      />
    </SafeAreaView>
  )
}

function NoticeRow({ item }: { item: (typeof ITEMS)[number] }) {
  const tone = toneFor(item.type)
  return (
    <Pressable style={[styles.row, item.unread && styles.rowUnread]} accessibilityRole="button">
      {item.unread ? <View style={styles.unreadDot} /> : null}
      <View style={[styles.iconCircle, { borderColor: tone }]}>
        <Text style={[styles.iconText, { color: tone }]}>{iconFor(item.type)}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.who} numberOfLines={1}>{item.who}</Text>
          {item.verified ? <VerifiedBadge size={14} /> : null}
          <Text style={styles.actionText}>{item.text}</Text>
        </View>
        {item.preview ? (
          <View style={[styles.previewBox, { borderLeftColor: tone }]}>
            <Text style={styles.previewText} numberOfLines={2}>{item.preview}</Text>
          </View>
        ) : null}
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
      <Avatar nickname={item.who} size={32} />
    </Pressable>
  )
}

function iconFor(type: NoticeType): string {
  return {
    quote: '“',
    follow: '+',
    like: '♥',
    match: '◇',
    comment: '…',
    milestone: '✦',
  }[type]
}

function toneFor(type: NoticeType): string {
  return {
    quote: colors.semantic.verify,
    follow: colors.semantic.verify,
    like: colors.semantic.like,
    match: colors.brand[400],
    comment: colors.text.secondary,
    milestone: colors.brand[300],
  }[type]
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
  },
  title: {
    ...typography.heading2,
    color: colors.text.primary,
  },
  readAll: {
    minHeight: 48,
    justifyContent: 'center',
  },
  readAllText: {
    ...typography.metaEmphasis,
    color: colors.brand[400],
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line.subtle,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.bg.raised,
    borderColor: colors.brand[600],
  },
  chipText: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  chipTextActive: {
    color: colors.brand[300],
  },
  list: {
    paddingHorizontal: spacing[3],
    paddingBottom: 112,
  },
  row: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line.subtle,
    borderRadius: radius.md,
  },
  rowUnread: {
    backgroundColor: colors.bg.surface,
  },
  unreadDot: {
    position: 'absolute',
    left: spacing[1],
    top: spacing[4],
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand[400],
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.bg.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1],
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing[1],
  },
  who: {
    ...typography.metaEmphasis,
    color: colors.text.primary,
    maxWidth: 160,
  },
  actionText: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  previewBox: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
    borderLeftWidth: 2,
    backgroundColor: colors.bg.raised,
  },
  previewText: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  timeText: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  footerText: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'center',
    paddingVertical: spacing[8],
  },
})
