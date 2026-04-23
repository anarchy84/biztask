// 한글 주석: 게시글 상세 화면
//
// ▣ 이 화면이 하는 일:
//   - 상단 헤더 (뒤로가기 + "게시글" 타이틀 + 메뉴 점3개)
//   - 본문 영역: 업종 배지 + 카테고리 배지 + 제목 + 작성자 + 본문
//   - 좋아요/싫어요 토글 버튼 (중앙 정렬)
//   - 댓글 리스트 (아바타 + 닉네임 + 본문 + 좋아요)
//   - 하단 고정 댓글 입력창 (KeyboardAvoidingView)
//
// ▣ 라우팅:
//   - Expo Router v4 동적 라우트: /post/[id]
//   - router.push(`/post/${id}`)로 진입
//   - useLocalSearchParams()로 id 받아옴
//
// ▣ 데이터:
//   - Phase 1: mockPost 하드코딩 (id 무관하게 동일 게시글 표시)
//   - Phase 2: Supabase fetch + Realtime 구독 (댓글 실시간 유입)
//
// ▣ 실행:
//   - 홈 피드에서 카드 탭 → 이 화면 진입

import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Post, Comment } from '@/lib/types'
import { colors } from '@/constants/colors'
import IndustryBadge from '@/components/common/IndustryBadge'
import TimeAgo from '@/components/common/TimeAgo'

// ─────────────────────────────────────────────
// 한글 주석: 목업 데이터 (Phase 1 UI 확인용)
// ─────────────────────────────────────────────

const mockPost: Post = {
  id: '1',
  author: { id: 'n1', nickname: '김치찌개사장', industry: 'food', isNpc: true },
  category: 'worry',
  title: '오늘 진상 한 명 왔는데 듣다가 혈압 오름',
  body:
    '반찬 더 달라고 소리 지르길래 줬더니 이번엔 왜 이렇게 느리냐고 난리 치더라고요.\n\n' +
    '다른 손님들도 눈치 보고… 15년 장사하면서 이런 분 처음 겪는 것도 아닌데 요즘은 진짜 대응이 어렵네요. ' +
    '사장님들 이럴 때 어떻게 풀고 넘어가세요?',
  likeCount: 48,
  dislikeCount: 2,
  commentCount: 32,
  viewCount: 1234,
  createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  myReaction: 'like',
}

const mockComments: Comment[] = [
  {
    id: 'c1',
    postId: '1',
    author: { id: 'n6', nickname: '카페사장15년차', industry: 'cafe', isNpc: true },
    body: '저는 그냥 "죄송합니다" 세 번 하고 마음속으로 별점 1점 드립니다 ㅋㅋㅋ 버티세요 사장님',
    likeCount: 12,
    dislikeCount: 0,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    myReaction: 'like',
  },
  {
    id: 'c2',
    postId: '1',
    author: { id: 'n7', nickname: '온라인셀러박', industry: 'online', isNpc: true },
    body: 'CCTV 있으시면 녹화 돌려두세요. 진상은 언제든 또 옵니다. 증거가 답.',
    likeCount: 8,
    dislikeCount: 0,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'c3',
    postId: '1',
    author: { id: 'n8', nickname: '유통창고형', industry: 'retail', isNpc: true },
    body: '사장님 오늘도 버티셨네요. 그래도 하루 마감했잖아요 수고했어요.',
    likeCount: 24,
    dislikeCount: 0,
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    myReaction: 'like',
  },
]

// ─────────────────────────────────────────────
// 카테고리 한글 라벨 (글 상세 상단 배지용)
// ─────────────────────────────────────────────
const CATEGORY_BADGE_LABEL: Record<string, string> = {
  worry: '고민',
  question: '질문',
  tip: '꿀팁',
  humor: '유머',
  hot: '실시간',
  all: '',
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export default function PostDetailScreen() {
  // 한글 주석: URL에서 id 파라미터 추출 (Phase 2에서 fetch할 때 사용)
  const { id } = useLocalSearchParams<{ id: string }>()

  // 한글 주석: 로컬 상태 - 좋아요/싫어요 토글 + 댓글 입력
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(
    mockPost.myReaction ?? null,
  )
  const [commentInput, setCommentInput] = useState('')

  // 한글 주석: 좋아요/싫어요 숫자 (토글에 따라 실시간 반영)
  const likeCount =
    mockPost.likeCount +
    (reaction === 'like' ? 1 : 0) -
    (mockPost.myReaction === 'like' ? 1 : 0)
  const dislikeCount =
    mockPost.dislikeCount +
    (reaction === 'dislike' ? 1 : 0) -
    (mockPost.myReaction === 'dislike' ? 1 : 0)

  // 한글 주석: 토글 핸들러 - 같은 버튼 다시 누르면 해제
  const handleToggle = (target: 'like' | 'dislike') => {
    setReaction((prev) => (prev === target ? null : target))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>게시글</Text>
        <Pressable style={styles.iconBtn}>
          <Text style={styles.menuIcon}>⋯</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        // 한글 주석: 키보드 올라올 때 댓글 입력창이 가려지지 않도록 조정
        //   - iOS: padding 방식, Android: height 방식이 각각 가장 자연스러움
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView style={styles.scroll}>
          {/* 본문 섹션 */}
          <View style={styles.bodySection}>
            {/* 배지 줄 */}
            <View style={styles.badgeRow}>
              <IndustryBadge industry={mockPost.author.industry} size="md" />
              {mockPost.category !== 'all' && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {CATEGORY_BADGE_LABEL[mockPost.category]}
                  </Text>
                </View>
              )}
            </View>

            {/* 제목 */}
            <Text style={styles.postTitle}>{mockPost.title}</Text>

            {/* 작성자 정보 */}
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {mockPost.author.nickname.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={styles.authorName}>{mockPost.author.nickname}</Text>
                <View style={styles.authorMeta}>
                  <TimeAgo
                    date={mockPost.createdAt}
                    style={styles.authorMetaText}
                  />
                  <Text style={styles.authorMetaText}>
                    {' · 조회 ' + mockPost.viewCount.toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* 본문 */}
            <Text style={styles.content}>{mockPost.body}</Text>

            {/* 좋아요/싫어요 버튼 */}
            <View style={styles.reactRow}>
              <Pressable
                onPress={() => handleToggle('like')}
                style={[
                  styles.reactBtn,
                  reaction === 'like' && styles.reactBtnLikeOn,
                ]}
              >
                <Text
                  style={[
                    styles.reactBtnText,
                    reaction === 'like' && styles.reactBtnLikeText,
                  ]}
                >
                  {reaction === 'like' ? '♥ ' : '♡ '}좋아요 {likeCount}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleToggle('dislike')}
                style={[
                  styles.reactBtn,
                  reaction === 'dislike' && styles.reactBtnDislikeOn,
                ]}
              >
                <Text
                  style={[
                    styles.reactBtnText,
                    reaction === 'dislike' && styles.reactBtnDislikeText,
                  ]}
                >
                  ▽ 싫어요 {dislikeCount}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 섹션 구분 (회색 굵은 띠) */}
          <View style={styles.sectionDivider} />

          {/* 댓글 섹션 */}
          <View>
            <View style={styles.commentsHead}>
              <Text style={styles.commentsHeadText}>
                댓글 {mockPost.commentCount}
              </Text>
            </View>

            {mockComments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </View>

          {/* 한글 주석: 하단 여백 (댓글 입력창에 가리지 않도록) */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 하단 고정 댓글 입력창 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="댓글을 남겨보세요"
            placeholderTextColor={colors.textMuted}
            value={commentInput}
            onChangeText={setCommentInput}
            multiline
          />
          <Pressable
            style={[
              styles.sendBtn,
              !commentInput.trim() && styles.sendBtnDisabled,
            ]}
            disabled={!commentInput.trim()}
            onPress={() => {
              // 한글 주석: Phase 2에서 Supabase insert 로직 연결 예정
              setCommentInput('')
            }}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
// 댓글 아이템 서브 컴포넌트
// ─────────────────────────────────────────────

function CommentItem({ comment }: { comment: Comment }) {
  const [reaction, setReaction] = useState<'like' | 'dislike' | null>(
    comment.myReaction ?? null,
  )
  const likeCount =
    comment.likeCount +
    (reaction === 'like' ? 1 : 0) -
    (comment.myReaction === 'like' ? 1 : 0)

  // 한글 주석: 작성자 업종에 따라 아바타 배경색 다르게 (가볍게 구분감)
  const { INDUSTRY_META } = require('@/lib/types')
  const industryMeta = INDUSTRY_META[comment.author.industry]

  return (
    <View style={styles.comment}>
      <View style={styles.commentAuthorRow}>
        <View
          style={[
            styles.commentAvatar,
            { backgroundColor: industryMeta.bg },
          ]}
        >
          <Text
            style={[styles.commentAvatarText, { color: industryMeta.fg }]}
          >
            {comment.author.nickname.charAt(0)}
          </Text>
        </View>
        <Text style={styles.commentName}>{comment.author.nickname}</Text>
        <Text style={styles.commentTime}>· </Text>
        <TimeAgo date={comment.createdAt} style={styles.commentTime} />
      </View>

      <Text style={styles.commentBody}>{comment.body}</Text>

      <View style={styles.commentStatRow}>
        <Pressable
          onPress={() => setReaction((p) => (p === 'like' ? null : 'like'))}
        >
          <Text
            style={[
              styles.commentStatText,
              reaction === 'like' && styles.commentStatOn,
            ]}
          >
            {reaction === 'like' ? '♥' : '♡'} {likeCount}
          </Text>
        </Pressable>
        <Text style={styles.commentStatText}>답글</Text>
      </View>
    </View>
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
  flex: {
    flex: 1,
  },

  // 헤더
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 26,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Regular',
    marginTop: -2,
  },
  menuIcon: {
    fontSize: 20,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Pretendard-Medium',
    color: colors.textStrong,
    textAlign: 'center',
  },

  scroll: {
    flex: 1,
  },

  // 본문 섹션
  bodySection: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.bgBrandSoft,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: colors.textBrand,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 16,
  },
  postTitle: {
    fontSize: 18,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    lineHeight: 26,
    marginTop: 10,
    marginBottom: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgBrandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    color: colors.textBrand,
    fontFamily: 'Pretendard-SemiBold',
  },
  authorName: {
    fontSize: 13,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Medium',
  },
  authorMeta: {
    flexDirection: 'row',
    marginTop: 2,
  },
  authorMetaText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  content: {
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 25,
    marginTop: 14,
  },

  // 좋아요/싫어요
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  reactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  reactBtnLikeOn: {
    backgroundColor: colors.bgBrandSoft,
    borderColor: '#C0DD97',
  },
  reactBtnDislikeOn: {
    backgroundColor: colors.bgMuted,
    borderColor: colors.borderStrong,
  },
  reactBtnText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  reactBtnLikeText: {
    color: colors.textBrand,
    fontFamily: 'Pretendard-Medium',
  },
  reactBtnDislikeText: {
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Medium',
  },

  // 섹션 구분
  sectionDivider: {
    height: 6,
    backgroundColor: colors.bgElevated,
  },

  // 댓글 섹션
  commentsHead: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentsHeadText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: colors.textStrong,
  },
  comment: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: 10,
    fontFamily: 'Pretendard-SemiBold',
  },
  commentName: {
    fontSize: 12,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Medium',
  },
  commentTime: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  commentBody: {
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
    lineHeight: 21,
  },
  commentStatRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  commentStatText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
  commentStatOn: {
    color: colors.textBrand,
    fontFamily: 'Pretendard-Medium',
  },

  // 하단 입력창
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    borderRadius: 18,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.borderStrong,
  },
  sendBtnText: {
    fontSize: 16,
    color: colors.textStrong,
    fontFamily: 'Pretendard-Bold',
  },
})
