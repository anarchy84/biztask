// 한글 주석: 홈 피드 화면 (하단 탭의 "홈")
//
// ▣ 이 화면이 하는 일:
//   - 상단 헤더 (로고 GRIT + 알림 아이콘)
//   - 횡스크롤 카테고리 탭 (전체/실시간/유머/고민/질문/꿀팁)
//   - 세로 피드 리스트 (PostCard 반복)
//   - 우하단 FAB (글쓰기 버튼)
//
// ▣ 데이터:
//   - 지금은 mockPosts 상수 사용 (Phase 1: UI만 잡기 위한 목업 데이터)
//   - Phase 2에서 Supabase + Realtime 구독으로 교체 예정
//
// ▣ 실행 방법:
//   - Expo Router v4 기준: app/(tabs)/index.tsx 경로면 자동으로 첫 탭이 됨
//   - npx expo start → 시뮬레이터/실기기 연결

import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { Post, Category, CATEGORY_LABELS } from '@/lib/types'
import { colors } from '@/constants/colors'
import PostCard from '@/components/feed/PostCard'

// ─────────────────────────────────────────────
// 한글 주석: 목업 데이터 (Phase 1 UI 확인용)
//   - Phase 2에서 Supabase fetch로 교체.
//   - NPC 닉네임은 실제 NPC 21명 중 일부 차용.
// ─────────────────────────────────────────────

const mockPosts: Post[] = [
  {
    id: '1',
    author: { id: 'n1', nickname: '김치찌개사장', industry: 'food', isNpc: true },
    category: 'worry',
    title: '오늘 진상 한 명 왔는데 듣다가 혈압 오름',
    body: '반찬 더 달라고 소리 지르길래 줬더니 이번엔 왜 이렇게 느리냐고… 사장님들 이럴 때 어떻게 대응하세요 진짜 궁금',
    likeCount: 48,
    dislikeCount: 2,
    commentCount: 32,
    viewCount: 1234,
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    myReaction: 'like',
  },
  {
    id: '2',
    author: { id: 'n2', nickname: '월세공주', industry: 'cafe', isNpc: true },
    category: 'question',
    title: '임대료 올려달라는 건물주한테 한마디 해주는 법',
    body: '2년 계약 만료인데 30% 올려달라는 게 상식적인지… 주변 시세 자료 정리해서 협상 들어가려고 합니다',
    thumbnailUrl: 'https://picsum.photos/seed/grit2/200/200',
    likeCount: 23,
    dislikeCount: 0,
    commentCount: 17,
    viewCount: 842,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    author: { id: 'n3', nickname: '네이버스토어찜', industry: 'online', isNpc: true },
    category: 'tip',
    title: '스마트스토어 리뷰 이벤트 반응 좋았던 후기 공유',
    body: '별점 5개 남기면 다음 주문 3천원 할인 쿠폰 보내드렸는데 생각보다 전환율이 2배 뛰었어요',
    likeCount: 91,
    dislikeCount: 1,
    commentCount: 46,
    viewCount: 3124,
    createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    author: { id: 'n4', nickname: '눈썹장인', industry: 'beauty', isNpc: true },
    category: 'worry',
    title: '네이버 예약 취소하면서 환불까지 요구하는 손님',
    body: '당일 취소 정책 공지 다 해놨는데 별점 1점 협박… 어떻게 대응해야 맞을까요 진심 조언 부탁',
    likeCount: 67,
    dislikeCount: 3,
    commentCount: 29,
    viewCount: 1802,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    author: { id: 'n5', nickname: '유통창고형', industry: 'retail', isNpc: true },
    category: 'humor',
    title: '창고 정리하다 5년 묵은 재고 발견함 ㅋㅋ',
    body: '박스 열었더니 2021년 스티커 그대로… 이거 지금 팔면 빈티지냐 폐기냐 진짜 고민됩니다',
    likeCount: 156,
    dislikeCount: 0,
    commentCount: 73,
    viewCount: 5421,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
]

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

  // 한글 주석: 카테고리 필터 적용된 피드
  //   - 'all' → 전부
  //   - 'hot' → 좋아요 많은 순 (Phase 2에서 조회수·댓글 가중치로 교체)
  //   - 나머지 → 해당 category 매칭
  const filteredPosts = useMemo(() => {
    if (activeCategory === 'all') return mockPosts
    if (activeCategory === 'hot') {
      return [...mockPosts].sort((a, b) => b.likeCount - a.likeCount)
    }
    return mockPosts.filter((p) => p.category === activeCategory)
  }, [activeCategory])

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

      {/* 피드 리스트 */}
      <FlatList
        data={filteredPosts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() => router.push(`/post/${item.id}` as any)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>아직 게시글이 없어요</Text>
          </View>
        }
        // 한글 주석: FlatList 기본 성능 튜닝
        //   - initialNumToRender: 처음에 렌더할 개수
        //   - maxToRenderPerBatch: 한 번에 렌더할 개수
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />

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
  empty: {
    padding: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
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
