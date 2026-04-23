// 한글 주석: 피드 카드 컴포넌트 (블라인드식 세로 리스트용)
//
// ▣ 이 컴포넌트가 하는 일:
//   - 홈 피드에 나열되는 게시글 한 장.
//   - 좌측: 업종 배지 + 닉네임 + 시간 + 제목 + 본문 2줄 미리보기 + 통계
//   - 우측: 썸네일 (있을 때만, 64x64 정사각)
//   - 전체 카드를 탭하면 상세 페이지로 이동.
//
// ▣ 디자인 원칙:
//   - 블라인드의 비움: 카드 배경 #FFF, 아래 보더 1px #EEEEEE만.
//   - 좋아요는 브랜드 연두 (내가 누른 상태는 더 진하게).
//   - 싫어요는 부드러운 회색 (공격성 최소화).
//   - 행간 21px 본문 (가독성 우선).
//
// ▣ 사용법:
//   <PostCard post={post} onPress={() => router.push(`/post/${post.id}`)} />

import React from 'react'
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
} from 'react-native'
import { Post } from '@/lib/types'
import { colors } from '@/constants/colors'
import IndustryBadge from '@/components/common/IndustryBadge'
import TimeAgo from '@/components/common/TimeAgo'

interface PostCardProps {
  post: Post
  onPress?: () => void
}

export default function PostCard({ post, onPress }: PostCardProps) {
  // 한글 주석: 내가 좋아요 눌렀는지 여부 (표시 스타일 분기용)
  const isLiked = post.myReaction === 'like'

  return (
    <Pressable
      onPress={onPress}
      // 한글 주석: 눌렀을 때 배경 살짝 눌림 효과 (RN 표준 방식)
      android_ripple={{ color: colors.bgMuted }}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* 한글 주석: 좌측 본문 영역 */}
      <View style={styles.body}>
        {/* 메타 줄: 배지 + 닉네임 + · + 시간 */}
        <View style={styles.metaRow}>
          <IndustryBadge industry={post.author.industry} />
          <Text style={styles.nickname} numberOfLines={1}>
            {post.author.nickname}
          </Text>
          <Text style={styles.dotSep}>·</Text>
          <TimeAgo date={post.createdAt} style={styles.metaText} />
        </View>

        {/* 제목 */}
        <Text style={styles.title} numberOfLines={2}>
          {post.title}
        </Text>

        {/* 본문 2줄 미리보기 */}
        <Text style={styles.preview} numberOfLines={2}>
          {post.body}
        </Text>

        {/* 통계 줄: 좋아요 · 싫어요 · 댓글수 / 우측: 조회수 */}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <ThumbsUpIcon color={isLiked ? colors.like : colors.textMuted} filled={isLiked} />
            <Text style={[styles.statText, isLiked && styles.statTextLiked]}>
              {post.likeCount}
            </Text>
          </View>
          <View style={styles.stat}>
            <ThumbsDownIcon color={colors.textMuted} />
            <Text style={styles.statText}>{post.dislikeCount}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statText}>💬 {post.commentCount}</Text>
          </View>
          <Text style={[styles.statText, styles.viewCount]}>
            조회 {formatCount(post.viewCount)}
          </Text>
        </View>
      </View>

      {/* 한글 주석: 우측 썸네일 (있을 때만 렌더) */}
      {post.thumbnailUrl && (
        <Image
          source={{ uri: post.thumbnailUrl }}
          style={styles.thumb}
          resizeMode="cover"
        />
      )}
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// 한글 주석: 아이콘 - 외부 라이브러리 없이 SVG로 직접 그리려면
//   react-native-svg가 필요한데, 목업 단계에선 emoji-style 텍스트로 간단 대체.
//   Phase 2에서 react-native-svg + lucide-react-native로 교체 예정.
// ─────────────────────────────────────────────

function ThumbsUpIcon({ color, filled }: { color: string; filled?: boolean }) {
  return (
    <Text style={{ fontSize: 12, color, fontWeight: filled ? '500' : '400' }}>
      {filled ? '♥' : '♡'}
    </Text>
  )
}

function ThumbsDownIcon({ color }: { color: string }) {
  return <Text style={{ fontSize: 12, color }}>▽</Text>
}

// 한글 주석: 조회수 숫자 포맷 (1,234 → "1.2k")
function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return (n / 1000).toFixed(1) + 'k'
  return Math.floor(n / 1000) + 'k'
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardPressed: {
    backgroundColor: colors.bgElevated,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  nickname: {
    fontSize: 12,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Medium',
    maxWidth: 120,
  },
  dotSep: {
    fontSize: 12,
    color: colors.borderStrong,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    lineHeight: 22,
    marginBottom: 4,
  },
  preview: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  statTextLiked: {
    color: colors.textBrand,
    fontFamily: 'Pretendard-Medium',
  },
  viewCount: {
    marginLeft: 'auto',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.bgMuted,
  },
})
