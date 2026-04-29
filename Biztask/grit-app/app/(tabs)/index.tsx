// 한글 주석: V2 홈 피드
//
// ▣ get_feed_ranked RPC를 우선 사용하고, 없으면 최신순 fallback을 쓴다.
// ▣ 칩 필터는 Phase 7 알고리즘 연결 전까지 UI 상태만 바꾼다.

import React, { useCallback } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { colors } from '@/constants/colors'
import { typography } from '@/constants/typography'
import { radius, spacing } from '@/constants/spacing'
import { FEED_FILTER_LABELS, type FeedFilter, type Post } from '@/lib/types'
import { useFeed } from '@/lib/hooks/useFeed'
import { useTier } from '@/lib/hooks/useTier'
import { useReaction } from '@/lib/hooks/useReaction'
import PostCard from '@/components/feed/PostCard'
import SecretLoungeBanner from '@/components/feed/SecretLoungeBanner'

const FILTERS: FeedFilter[] = ['all', 'following', 'industry', 'nearby', 'hot']

export default function HomeFeedScreen() {
  const { canWritePost } = useTier()
  const {
    posts,
    filter,
    setFilter,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    loadMore,
    applyPostReaction,
  } = useFeed()
  const { toggle } = useReaction()

  const handlePostLike = useCallback(
    (post: Post) => {
      void toggle({
        target: 'post',
        targetId: post.id,
        current: post.myReaction ?? null,
        next: 'like',
        onOptimistic: (nextMyReaction, likeDelta, dislikeDelta) => {
          applyPostReaction(post.id, nextMyReaction, likeDelta, dislikeDelta)
        },
      })
    },
    [applyPostReaction, toggle],
  )

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh]),
  )

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Text style={styles.logoGlyph}>그</Text>
        </View>
        <Text style={styles.logoText}>그릿</Text>
        {/* 한글 주석: 게스트는 글쓰기 CTA를 숨기고, 시크릿 라운지는 빠른 진입점으로 유지한다. */}
        <View style={styles.headerActions}>
          {canWritePost ? (
            <Pressable
              style={styles.writeButton}
              onPress={() => router.push('/post/new' as any)}
              accessibilityRole="button"
              accessibilityLabel="새 글 쓰기"
            >
              <Text style={styles.writeButtonText}>＋</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/lounge' as any)}
            accessibilityRole="button"
            accessibilityLabel="시크릿 라운지"
          >
            <Text style={styles.iconText}>🔒</Text>
          </Pressable>
        </View>
      </View>

      {/* 한글 주석: 칩 필터는 추천 알고리즘과 함께 정밀 구현 예정 (Phase 7).
            사용자가 "목적 모름"이라고 피드백 → 임시 숨김 처리.
            FILTERS / setFilter / filter는 hook에서 여전히 동작하므로 추후 다시 노출만 하면 됨 */}

      {loading && posts.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand[500]} />
          <Text style={styles.centerText}>추천 피드 불러오는 중…</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedItem post={item} onLike={handlePostLike} />}
          contentContainerStyle={styles.feedContent}
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.brand[400]}
              colors={[colors.brand[500]]}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={<SecretLoungeBanner />}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={colors.brand[500]} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>아직 피드가 비어 있어</Text>
              <Text style={styles.emptyText}>첫 운영 이야기를 남기면 다른 사장님들이 발견할 거야.</Text>
            </View>
          }
        />
      )}

      {error ? (
        <Pressable style={styles.errorBanner} onPress={refresh}>
          <Text style={styles.errorText}>{error} · 다시 시도</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  )
}

function FeedItem({ post, onLike }: { post: Post; onLike: (post: Post) => void }) {
  return (
    <PostCard
      post={post}
      onPress={() => router.push(`/post/${post.id}` as any)}
      onLikePress={onLike}
    />
  )
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
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  logoBox: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlyph: {
    ...typography.logo,
    fontSize: 15,
    lineHeight: 18,
    color: colors.onBrand,
  },
  logoText: {
    ...typography.heading2,
    color: colors.text.primary,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
  },
  iconText: {
    fontSize: 22,
    color: colors.text.secondary,
  },
  writeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[500],
  },
  writeButtonText: {
    fontSize: 24,
    color: colors.onBrand,
    lineHeight: 26,
  },
  filterRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line.subtle,
  },
  filterContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
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
  feedContent: {
    padding: spacing[3],
    paddingBottom: 110,
    gap: spacing[3],
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
  },
  centerText: {
    ...typography.meta,
    color: colors.text.tertiary,
  },
  footerLoader: {
    paddingVertical: spacing[5],
  },
  emptyBox: {
    padding: spacing[8],
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
  errorBanner: {
    position: 'absolute',
    left: spacing[4],
    right: spacing[4],
    bottom: 94,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.nested,
    borderWidth: 1,
    borderColor: colors.line.strong,
  },
  errorText: {
    ...typography.metaEmphasis,
    color: colors.text.secondary,
  },
})
