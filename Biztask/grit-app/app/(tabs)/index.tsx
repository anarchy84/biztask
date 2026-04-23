// 한글 주석: 홈 피드 화면 (하단 탭의 "홈")
//
// ▣ 이 화면이 하는 일:
//   - 상단 헤더 (로고 GRIT + 알림 아이콘)
//   - 횡스크롤 카테고리 탭 (전체/실시간/유머/고민/질문/꿀팁)
//   - 세로 피드 리스트 (PostCard 반복) + Pull-to-refresh
//   - 우하단 FAB (글쓰기 버튼)
//
// ▣ 데이터:
//   - usePosts(category) 훅으로 Supabase에서 실시간 조회
//   - NPC·실유저 글 섞여서 최신순/인기순으로 표시
//
// ▣ 실행 방법:
//   - Expo Router v4 기준: app/(tabs)/index.tsx 경로면 자동으로 첫 탭이 됨
//   - npx expo start → 시뮬레이터/실기기 연결

import React, { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { Category, CATEGORY_LABELS } from '@/lib/types'
import { colors } from '@/constants/colors'
import PostCard from '@/components/feed/PostCard'
import { usePosts } from '@/lib/hooks/usePosts'

// ─────────────────────────────────────────────
// 한글 주석: 카테고리 탭 순서 (상단 횡스크롤용)
// ─────────────────────────────────────────────
const CATEGORY_ORDER: Category[] = ['all', 'hot', 'humor', 'worry', 'question', 'tip']

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export default function HomeFeedScreen() {
  // 한글 주석: 선택된 카테고리 상태 (기본 '전체')
  const [activeCategory, setActiveCategory] = useState<Category>('all')

  // 한글 주석: Supabase에서 피드 조회 (카테고리 바뀌면 자동 재조회)
  const { posts, loading, refreshing, error, refresh } = usePosts(activeCategory)

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* 헤더: 로고 + 알림 */}
      <View style={styles.header}>
        <Text style={styles.logo}>GRIT</Text>
        <Pressable
          style={styles.iconBtn}
          onPress={() => router.push('/notifications' as any)}
        >
          <Text style={styles.iconChar}>🔔</Text>
        </Pressable>
      </View>

      {/* 카테고리 횡스크롤 탭 */}
      <View style={styles.tabWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          {CATEGORY_ORDER.map((cat) => {
            const isActive = cat === activeCategory
            return (
              <Pressable
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={styles.tab}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
                {/* 한글 주석: 활성 탭 하단 연두 라인 */}
                {isActive && <View style={styles.tabIndicator} />}
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* 한글 주석: 첫 로딩 시엔 스피너, 이후엔 리스트 */}
      {loading && posts.length === 0 ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>피드 불러오는 중…</Text>
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>피드 로딩 실패</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => router.push(`/post/${item.id}` as any)}
            />
          )}
          // 한글 주석: Pull-to-refresh (아래로 당기면 새로고침)
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {activeCategory === 'all'
                  ? '아직 게시글이 없어'
                  : `${CATEGORY_LABELS[activeCategory]} 게시글이 없어`}
              </Text>
              <Text style={styles.emptyHint}>첫 글 써보는 건 어때?</Text>
            </View>
          }
          // 한글 주석: FlatList 기본 성능 튜닝
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}

      {/* 한글 주석: 우하단 FAB (글쓰기) */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/write' as any)}
      >
        <Text style={styles.fabIcon}>✎</Text>
      </Pressable>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    fontSize: 20,
    fontFamily: 'Pretendard-Bold',
    color: colors.textStrong,
    letterSpacing: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChar: {
    fontSize: 18,
  },
  tabWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
    alignItems: 'center',
  },
  tab: {
    paddingBottom: 2,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  tabTextActive: {
    color: colors.textStrong,
    fontFamily: 'Pretendard-SemiBold',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.brand,
    borderRadius: 1,
  },
  // ─────────────────────────────────────────────
  // 로딩/에러 중앙 박스
  // ─────────────────────────────────────────────
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  errorTitle: {
    fontSize: 16,
    color: colors.textStrong,
    fontFamily: 'Pretendard-SemiBold',
  },
  errorText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.brand,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: colors.textStrong,
    fontFamily: 'Pretendard-SemiBold',
  },
  // ─────────────────────────────────────────────
  // 빈 상태
  // ─────────────────────────────────────────────
  empty: {
    padding: 48,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  emptyHint: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
    opacity: 0.7,
  },
  // ─────────────────────────────────────────────
  // FAB
  // ─────────────────────────────────────────────
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    // 한글 주석: iOS/Android 모두에서 살짝 떠 보이게 하는 섀도우
    shadowColor: colors.textStrong,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  fabIcon: {
    fontSize: 22,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Bold',
  },
})
