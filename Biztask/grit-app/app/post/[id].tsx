// 한글 주석: V2 글 상세 화면
//
// ▣ PostCard 디자인을 상세 상단에 재사용한다.
// ▣ parent_id 기반 댓글 트리를 재귀 렌더링해서 깊이 제한 없이 표시한다.

import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import PostCard from '@/components/feed/PostCard'
import { Avatar } from '@/components/common/Avatar'
import TimeAgo from '@/components/common/TimeAgo'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'
import type { Comment } from '@/lib/types'
import { useCommentSubmit } from '@/lib/hooks/useCommentSubmit'
import { usePost } from '@/lib/hooks/usePost'
import { useReaction } from '@/lib/hooks/useReaction'

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
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
  const [commentInput, setCommentInput] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const tree = useMemo(() => buildCommentTree(comments), [comments])

  const { submit, submitting, error: submitError, clearError } = useCommentSubmit({
    postId: id ?? '',
    onSuccess: (comment) => {
      appendComment(comment)
      setCommentInput('')
      setReplyTo(null)
    },
  })

  const handleSend = async () => {
    const trimmed = commentInput.trim()
    if (!trimmed || submitting) return
    await submit(trimmed, replyTo?.id ?? null)
  }

  const handleCommentReaction = (comment: Comment) => {
    toggle({
      target: 'comment',
      targetId: comment.id,
      current: comment.myReaction ?? null,
      next: 'like',
      onOptimistic: (nextMyReaction, likeDelta, dislikeDelta) => {
        applyMyReaction('comment', comment.id, nextMyReaction)
        applyReactionDelta('comment', comment.id, likeDelta, dislikeDelta)
      },
    })
  }

  const handlePostReaction = () => {
    if (!post) return
    void toggle({
      target: 'post',
      targetId: post.id,
      current: post.myReaction ?? null,
      next: 'like',
      onOptimistic: (nextMyReaction, likeDelta, dislikeDelta) => {
        applyMyReaction('post', post.id, nextMyReaction)
        applyReactionDelta('post', post.id, likeDelta, dislikeDelta)
      },
    })
  }

  if (loading && !post) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={styles.centerBox}>
          <ActivityIndicator color={colors.brand[500]} />
          <Text style={styles.centerText}>게시글 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={styles.centerBox}>
          <Text style={styles.errorTitle}>게시글을 불러올 수 없어</Text>
          <Text style={styles.centerText}>{error ?? '알 수 없는 문제'}</Text>
          <Pressable style={styles.retryButton} onPress={refresh}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <PostCard post={post} onLikePress={handlePostReaction} />

          <View style={styles.commentHeader}>
            <Text style={styles.commentHeaderText}>댓글 {post.commentCount}</Text>
          </View>

          {tree.length === 0 ? (
            <View style={styles.emptyComments}>
              <Text style={styles.centerText}>첫 댓글을 남겨보세요</Text>
            </View>
          ) : (
            tree.map((node) => (
              <CommentNode
                key={node.comment.id}
                node={node}
                depth={0}
                onReply={setReplyTo}
                onLike={handleCommentReaction}
              />
            ))
          )}
        </ScrollView>

        {replyTo ? (
          <View style={styles.replyBanner}>
            <Text style={styles.replyText}>{replyTo.author.nickname}님에게 답글 작성 중</Text>
            <Pressable onPress={() => setReplyTo(null)} style={styles.replyCancel}>
              <Text style={styles.replyCancelText}>취소</Text>
            </Pressable>
          </View>
        ) : null}

        {submitError ? (
          <Pressable style={styles.submitError} onPress={clearError}>
            <Text style={styles.submitErrorText}>{submitError}</Text>
          </Pressable>
        ) : null}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={commentInput}
            onChangeText={(text) => {
              if (submitError) clearError()
              setCommentInput(text)
            }}
            placeholder="댓글을 남겨보세요"
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={500}
          />
          <Pressable
            style={[styles.sendButton, (!commentInput.trim() || submitting) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!commentInput.trim() || submitting}
            accessibilityRole="button"
            accessibilityLabel="댓글 보내기"
          >
            {submitting ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.sendText}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.headerIcon}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>게시글</Text>
      <Pressable style={styles.headerButton} accessibilityRole="button">
        <Text style={styles.headerMore}>•••</Text>
      </Pressable>
    </View>
  )
}

interface CommentTreeNode {
  comment: Comment
  children: CommentTreeNode[]
}

function buildCommentTree(comments: Comment[]): CommentTreeNode[] {
  const map = new Map<string, CommentTreeNode>()
  comments.forEach((comment) => map.set(comment.id, { comment, children: [] }))

  const roots: CommentTreeNode[] = []
  map.forEach((node) => {
    const parentId = node.comment.parentId
    const parent = parentId ? map.get(parentId) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  })

  return roots
}

function CommentNode({
  node,
  depth,
  onReply,
  onLike,
}: {
  node: CommentTreeNode
  depth: number
  onReply: (comment: Comment) => void
  onLike: (comment: Comment) => void
}) {
  const comment = node.comment
  return (
    <View style={[styles.commentNode, { marginLeft: Math.min(depth, 5) * 18 }]}>
      <View style={styles.commentBodyWrap}>
        <Avatar url={comment.author.avatarUrl} nickname={comment.author.nickname} size={32} />
        <View style={styles.commentContent}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentName}>{comment.author.nickname}</Text>
            <Text style={styles.commentDot}>·</Text>
            <TimeAgo date={comment.createdAt} style={styles.commentTime} />
          </View>
          <Text style={styles.commentBody}>{comment.body}</Text>
          <View style={styles.commentActions}>
            <Pressable onPress={() => onLike(comment)} style={styles.commentActionButton}>
              <Text style={[styles.commentActionText, comment.myReaction === 'like' && styles.commentLiked]}>
                {comment.myReaction === 'like' ? '♥' : '♡'} {comment.likeCount}
              </Text>
            </Pressable>
            <Pressable onPress={() => onReply(comment)} style={styles.commentActionButton}>
              <Text style={styles.commentActionText}>답글</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {node.children.map((child) => (
        <CommentNode
          key={child.comment.id}
          node={child}
          depth={depth + 1}
          onReply={onReply}
          onLike={onLike}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.line.default,
    paddingHorizontal: spacing[2],
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 30,
    color: colors.text.primary,
  },
  headerMore: {
    color: colors.text.secondary,
    letterSpacing: 1,
  },
  headerTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: spacing[3],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[3],
  },
  centerText: {
    ...typography.meta,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  retryButton: {
    minHeight: 48,
    paddingHorizontal: spacing[5],
    borderRadius: radius.pill,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...typography.buttonSmall,
    color: colors.onBrand,
  },
  commentHeader: {
    paddingHorizontal: spacing[1],
    paddingTop: spacing[2],
  },
  commentHeaderText: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
  },
  emptyComments: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentNode: {
    gap: spacing[2],
  },
  commentBodyWrap: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  commentContent: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.line.default,
    padding: spacing[3],
    gap: spacing[2],
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  commentName: {
    ...typography.metaEmphasis,
    color: colors.text.primary,
  },
  commentDot: {
    color: colors.text.disabled,
  },
  commentTime: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  commentBody: {
    ...typography.body,
    color: colors.text.secondary,
  },
  commentActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  commentActionButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  commentActionText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  commentLiked: {
    color: colors.semantic.like,
  },
  replyBanner: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line.default,
    gap: spacing[3],
  },
  replyText: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  replyCancel: {
    minHeight: 36,
    justifyContent: 'center',
  },
  replyCancelText: {
    ...typography.caption,
    color: colors.brand[400],
  },
  submitError: {
    padding: spacing[3],
    backgroundColor: colors.bg.nested,
  },
  submitErrorText: {
    ...typography.meta,
    color: colors.semantic.warn,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.line.default,
    backgroundColor: colors.bg.surface,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.base,
    color: colors.text.primary,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.bg.nested,
  },
  sendText: {
    fontSize: 22,
    color: colors.onBrand,
  },
})
