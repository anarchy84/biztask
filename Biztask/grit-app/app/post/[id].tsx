// 한글 주석: 게시글 상세 화면
//
// ▣ 이 화면이 하는 일:
//   - 상단 헤더 (뒤로가기 + "게시글" 타이틀 + 메뉴 점3개)
//   - 본문 영역: 업종 배지 + 카테고리 배지 + 제목 + 작성자 + 본문
//   - 좋아요/싫어요 토글 버튼 (낙관적 업데이트 + DB 동기화)
//   - 댓글 리스트 (댓글에도 좋아요 토글)
//   - 하단 고정 댓글 입력창 (Phase F에서 활성화 예정)
//
// ▣ 라우팅:
//   - Expo Router v4 동적 라우트: /post/[id]
//   - router.push(`/post/${id}`)로 진입
//   - useLocalSearchParams()로 id 받아옴
//
// ▣ 데이터:
//   - usePost(id) 훅으로 Supabase에서 단건 + 댓글 병렬 조회
//   - useReaction 훅으로 좋아요/싫어요 토글 (낙관적 업데이트)

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
  ActivityIndicator,
  Image,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Post, Comment, INDUSTRY_META } from '@/lib/types'
import { colors } from '@/constants/colors'
import IndustryBadge from '@/components/common/IndustryBadge'
import TimeAgo from '@/components/common/TimeAgo'
import { usePost } from '@/lib/hooks/usePost'
import { useReaction } from '@/lib/hooks/useReaction'
import { useCommentSubmit } from '@/lib/hooks/useCommentSubmit'

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
  // 한글 주석: URL에서 id 파라미터 추출
  const { id } = useLocalSearchParams<{ id: string }>()

  // 한글 주석: Supabase에서 게시글 + 댓글 조회
  const {
    post,
    comments,
    loading,
    error,
    refresh,
    applyMyReaction,
    applyReactionDelta,
    appendComment,
  } = usePost(id)

  const { toggle } = useReaction()

  // 한글 주석: 댓글 입력 + 제출
  const [commentInput, setCommentInput] = useState('')
  const { submit: submitComment, submitting, error: submitError, clearError } =
    useCommentSubmit({
      postId: id ?? '',
      onSuccess: (c) => {
        // 한글 주석: 성공 시 로컬 댓글 리스트에 즉시 append + 카운터 +1
        appendComment(c)
        setCommentInput('')
      },
    })

  // 한글 주석: 전송 버튼 핸들러
  const handleSendComment = async () => {
    const trimmed = commentInput.trim()
    if (!trimmed || submitting) return
    await submitComment(trimmed)
  }

  // ─────────────────────────────────────────────
  // 한글 주석: 로딩/에러 처리
  // ─────────────────────────────────────────────
  if (loading && !post) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <SimpleHeader />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>게시글 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <SimpleHeader />
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>게시글을 불러올 수 없어</Text>
          <Text style={styles.errorText}>{error ?? '알 수 없는 문제'}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  // ─────────────────────────────────────────────
  // 한글 주석: 반응 토글 핸들러 (post 용)
  //   - 낙관적 업데이트 + DB 동기화를 useReaction 훅에 위임
  // ─────────────────────────────────────────────
  const handlePostReaction = (next: 'like' | 'dislike') => {
    toggle({
      target: 'post',
      targetId: post.id,
      current: post.myReaction ?? null,
      next,
      onOptimistic: (nextMyReaction, likeDelta, dislikeDelta) => {
        applyMyReaction('post', post.id, nextMyReaction)
        applyReactionDelta('post', post.id, likeDelta, dislikeDelta)
      },
    })
  }

  const handleCommentReaction = (commentId: string, next: 'like' | 'dislike') => {
    const c = comments.find((x) => x.id === commentId)
    if (!c) return
    toggle({
      target: 'comment',
      targetId: commentId,
      current: c.myReaction ?? null,
      next,
      onOptimistic: (nextMyReaction, likeDelta, dislikeDelta) => {
        applyMyReaction('comment', commentId, nextMyReaction)
        applyReactionDelta('comment', commentId, likeDelta, dislikeDelta)
      },
    })
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <SimpleHeader />

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
              <IndustryBadge industry={post.author.industry} size="md" />
              {post.category !== 'all' && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {CATEGORY_BADGE_LABEL[post.category]}
                  </Text>
                </View>
              )}
            </View>

            {/* 제목 */}
            <Text style={styles.postTitle}>{post.title}</Text>

            {/* 작성자 정보 */}
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {post.author.nickname.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={styles.authorName}>{post.author.nickname}</Text>
                <View style={styles.authorMeta}>
                  <TimeAgo
                    date={post.createdAt}
                    style={styles.authorMetaText}
                  />
                  {post.viewCount > 0 && (
                    <Text style={styles.authorMetaText}>
                      {' · 조회 ' + post.viewCount.toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* 본문 */}
            <Text style={styles.content}>{post.body}</Text>

            {/* 한글 주석: 첨부 이미지 (있을 때만) */}
            {post.thumbnailUrl && (
              <Image
                source={{ uri: post.thumbnailUrl }}
                style={styles.contentImage}
                resizeMode="cover"
              />
            )}

            {/* 좋아요/싫어요 버튼 */}
            <View style={styles.reactRow}>
              <Pressable
                onPress={() => handlePostReaction('like')}
                style={[
                  styles.reactBtn,
                  post.myReaction === 'like' && styles.reactBtnLikeOn,
                ]}
              >
                <Text
                  style={[
                    styles.reactBtnText,
                    post.myReaction === 'like' && styles.reactBtnLikeText,
                  ]}
                >
                  {post.myReaction === 'like' ? '♥ ' : '♡ '}좋아요 {post.likeCount}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handlePostReaction('dislike')}
                style={[
                  styles.reactBtn,
                  post.myReaction === 'dislike' && styles.reactBtnDislikeOn,
                ]}
              >
                <Text
                  style={[
                    styles.reactBtnText,
                    post.myReaction === 'dislike' && styles.reactBtnDislikeText,
                  ]}
                >
                  ▽ 싫어요 {post.dislikeCount}
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
                댓글 {post.commentCount}
              </Text>
            </View>

            {comments.length === 0 ? (
              <View style={styles.commentEmpty}>
                <Text style={styles.commentEmptyText}>
                  첫 댓글을 남겨보세요
                </Text>
              </View>
            ) : (
              comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onReaction={(next) => handleCommentReaction(comment.id, next)}
                />
              ))
            )}
          </View>

          {/* 한글 주석: 하단 여백 (댓글 입력창에 가리지 않도록) */}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* 한글 주석: 에러 배너 (있을 때만) */}
        {submitError && (
          <Pressable style={styles.errorBanner} onPress={clearError}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
            <Text style={styles.errorBannerClose}>✕</Text>
          </Pressable>
        )}

        {/* 하단 고정 댓글 입력창 */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="댓글을 남겨보세요"
            placeholderTextColor={colors.textMuted}
            value={commentInput}
            onChangeText={(t) => {
              if (submitError) clearError()
              setCommentInput(t)
            }}
            multiline
            editable={!submitting}
            maxLength={500}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!commentInput.trim() || submitting) && styles.sendBtnDisabled,
            ]}
            disabled={!commentInput.trim() || submitting}
            onPress={handleSendComment}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.textStrong} />
            ) : (
              <Text style={styles.sendBtnText}>→</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─────────────────────────────────────────────
// 공통 헤더 (로딩·에러 화면에서도 재사용)
// ─────────────────────────────────────────────
function SimpleHeader() {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.iconBtn}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>게시글</Text>
      <Pressable style={styles.iconBtn}>
        <Text style={styles.menuIcon}>⋯</Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// 댓글 아이템 서브 컴포넌트
// ─────────────────────────────────────────────

function CommentItem({
  comment,
  onReaction,
}: {
  comment: Comment
  onReaction: (next: 'like' | 'dislike') => void
}) {
  // 한글 주석: 작성자 업종에 따라 아바타 배경색 다르게 (가볍게 구분감)
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
        <Pressable onPress={() => onReaction('like')}>
          <Text
            style={[
              styles.commentStatText,
              comment.myReaction === 'like' && styles.commentStatOn,
            ]}
          >
            {comment.myReaction === 'like' ? '♥' : '♡'} {comment.likeCount}
          </Text>
        </Pressable>
        {/* 한글 주석: 답글(대댓글)은 Phase 3 이후 활성화 */}
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

  // 로딩/에러
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
  contentImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: colors.bgMuted,
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
  commentEmpty: {
    padding: 32,
    alignItems: 'center',
  },
  commentEmptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
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

  // 에러 배너 (댓글 작성 실패 시)
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontFamily: 'Pretendard-Medium',
  },
  errorBannerClose: {
    fontSize: 14,
    color: '#991B1B',
    marginLeft: 8,
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
