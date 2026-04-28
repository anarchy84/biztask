// 한글 주석: GRIT V2 피드 카드
//
// ▣ 핸드오프 post-card.jsx를 RN/Expo 스타일로 재구현했다.
// ▣ 지원 범위: 관계성 캡션, 인증/업종/연차 뱃지, 다중 이미지, 동영상 썸네일,
//   인용글 카드, 좋아요/댓글/인용/저장 카운터.

import React, { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import type { Post } from '@/lib/types'
import { INDUSTRY_META } from '@/lib/types'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'
import { cardShadow } from '@/constants/shadows'
import { Avatar } from '@/components/common/Avatar'
import { IndustryBadge, VerifiedBadge, YearsBadge } from '@/components/common/Badge'
import TimeAgo from '@/components/common/TimeAgo'

interface PostCardProps {
  post: Post
  onPress?: () => void
  compact?: boolean
  style?: ViewStyle
}

/** 한글 주석: 피드와 상세에서 공유하는 V2 게시글 카드. */
export default function PostCard({ post, onPress, compact = false, style }: PostCardProps) {
  const [liked, setLiked] = useState(post.myReaction === 'like')
  const [bookmarked, setBookmarked] = useState(false)
  const industryLabel = INDUSTRY_META[post.author.industry]?.label ?? '기타'
  const isVerified = post.author.tier === 'verified' || post.author.tier === 'blue' || Boolean(post.author.verifiedAt)
  const hasVideo = Boolean(post.videoThumbnailUrl || post.videoUrl)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.cardPressed,
        style,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${post.author.nickname}님의 게시글`}
    >
      {post.relation ? (
        <View style={styles.relationRow}>
          <Text style={styles.relationIcon}>↗</Text>
          <Text style={styles.relationText}>{post.relation}</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Avatar
          url={post.author.avatarUrl}
          nickname={post.author.nickname}
          size={compact ? 32 : 40}
          showRing={isVerified}
        />

        <View style={styles.headerBody}>
          <View style={styles.nameRow}>
            <Text style={styles.nickname} numberOfLines={1}>
              {post.author.nickname}
            </Text>
            {isVerified ? <VerifiedBadge size={14} /> : null}
            <Text style={styles.dot}>·</Text>
            <TimeAgo date={post.createdAt} style={styles.timeText} />
          </View>

          <View style={styles.badgeRow}>
            <IndustryBadge region={post.author.region} industryLabel={industryLabel} />
            <YearsBadge years={post.author.yearsInBusiness} />
          </View>
        </View>

        <Pressable style={styles.moreButton} accessibilityRole="button" accessibilityLabel="게시글 더보기">
          <Text style={styles.moreText}>•••</Text>
        </Pressable>
      </View>

      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
      <Text style={styles.body}>{post.body}</Text>

      {hasVideo ? (
        <View style={styles.mediaBox}>
          {post.videoThumbnailUrl ? (
            <Image source={{ uri: post.videoThumbnailUrl }} style={styles.mediaImage} resizeMode="cover" />
          ) : (
            <View style={styles.mediaPlaceholder} />
          )}
          <View style={styles.playBadge}>
            <Text style={styles.playText}>▶</Text>
          </View>
        </View>
      ) : post.imageUrls.length > 0 ? (
        <ImageGrid urls={post.imageUrls} />
      ) : null}

      {post.isQuote ? (
        <View style={styles.quoteIndent}>
          {post.quotedPost ? (
            <View style={styles.quoteCard}>
              <View style={styles.quoteHead}>
                <Avatar
                  url={post.quotedPost.author.avatarUrl}
                  nickname={post.quotedPost.author.nickname}
                  size={24}
                />
                <Text style={styles.quoteName} numberOfLines={1}>
                  {post.quotedPost.author.nickname}
                </Text>
                <Text style={styles.dot}>·</Text>
                <TimeAgo date={post.quotedPost.createdAt} style={styles.timeText} />
              </View>
              <Text style={styles.quoteBody} numberOfLines={3}>
                {post.quotedPost.body}
              </Text>
            </View>
          ) : (
            <View style={styles.quoteCard}>
              <Text style={styles.quoteBody}>원글을 불러오는 중이야</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <ActionButton icon="💬" count={post.commentCount} label="댓글" />
        <ActionButton icon="↻" count={post.quoteCount} label="인용" accent={colors.brand[400]} />
        <ActionButton
          icon={liked ? '♥' : '♡'}
          count={post.likeCount + (liked && post.myReaction !== 'like' ? 1 : 0)}
          label="좋아요"
          accent={liked ? colors.semantic.like : undefined}
          onPress={() => setLiked((prev) => !prev)}
        />
        <ActionButton
          icon={bookmarked ? '▰' : '▱'}
          count={post.bookmarkCount + (bookmarked ? 1 : 0)}
          label="저장"
          accent={bookmarked ? colors.brand[400] : undefined}
          onPress={() => setBookmarked((prev) => !prev)}
        />
      </View>
    </Pressable>
  )
}

function ImageGrid({ urls }: { urls: string[] }) {
  const first = urls[0]
  if (!first) return null

  return (
    <View style={styles.mediaBox}>
      <Image source={{ uri: first }} style={styles.mediaImage} resizeMode="cover" />
      {urls.length > 1 ? (
        <View style={styles.imageCountBadge}>
          <Text style={styles.imageCountText}>+{urls.length - 1}</Text>
        </View>
      ) : null}
    </View>
  )
}

function ActionButton({
  icon,
  count,
  label,
  accent,
  onPress,
}: {
  icon: string
  count?: number
  label: string
  accent?: string
  onPress?: () => void
}) {
  const color = accent ?? colors.text.tertiary
  return (
    <Pressable
      onPress={onPress}
      style={styles.actionButton}
      accessibilityRole="button"
      accessibilityLabel={`${label}${count != null ? ` ${count}` : ''}`}
      hitSlop={4}
    >
      <Text style={[styles.actionIcon, { color }]}>{icon}</Text>
      {count != null ? <Text style={[styles.actionText, { color }]}>{formatCount(count)}</Text> : null}
    </Pressable>
  )
}

function formatCount(count: number): string {
  if (count < 1000) return String(count)
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  return `${Math.floor(count / 1000)}k`
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
    ...cardShadow,
  },
  cardCompact: {
    padding: spacing[3],
    gap: spacing[2],
  },
  cardPressed: {
    backgroundColor: colors.bg.raised,
  },
  relationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  relationIcon: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  relationText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  nickname: {
    ...typography.nickname,
    color: colors.text.primary,
    flexShrink: 1,
  },
  dot: {
    ...typography.meta,
    color: colors.text.disabled,
  },
  timeText: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    marginTop: spacing[1],
  },
  moreButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing[2],
    marginRight: -spacing[2],
  },
  moreText: {
    color: colors.text.tertiary,
    letterSpacing: 1,
  },
  title: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  body: {
    ...typography.body,
    color: colors.text.primary,
  },
  mediaBox: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg.raised,
    borderWidth: 1,
    borderColor: colors.line.default,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    backgroundColor: colors.bg.nested,
  },
  playBadge: {
    position: 'absolute',
    left: spacing[3],
    bottom: spacing[3],
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  playText: {
    color: colors.onBrand,
    fontSize: 16,
    marginLeft: 2,
  },
  imageCountBadge: {
    position: 'absolute',
    right: spacing[3],
    bottom: spacing[3],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  imageCountText: {
    ...typography.caption,
    color: colors.onBrand,
  },
  quoteIndent: {
    marginLeft: spacing[8],
  },
  quoteCard: {
    backgroundColor: colors.bg.raised,
    borderWidth: 1,
    borderColor: colors.line.default,
    borderRadius: radius.md,
    padding: spacing[3],
    gap: spacing[2],
  },
  quoteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  quoteName: {
    ...typography.metaEmphasis,
    color: colors.text.primary,
    flexShrink: 1,
  },
  quoteBody: {
    ...typography.meta,
    color: colors.text.secondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[1],
  },
  actionButton: {
    minWidth: 48,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    ...typography.metaEmphasis,
    fontVariant: ['tabular-nums'],
  },
})
