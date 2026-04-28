// 한글 주석: V2 글쓰기 화면
//
// ▣ 다중 이미지, 동영상 URL/썸네일, 인용글 ID 입력을 지원한다.
// ▣ 실제 동영상 파일 업로드는 Storage 정책 확정 후 post-videos 버킷 훅으로 분리한다.

import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { router } from 'expo-router'
import { Button } from '@/components/common/Button'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'
import { CATEGORY_LABELS, type Category } from '@/lib/types'
import { useImageUpload } from '@/lib/hooks/useImageUpload'
import { usePostSubmit } from '@/lib/hooks/usePostSubmit'
import { useTier } from '@/lib/hooks/useTier'

type WritableCategory = Exclude<Category, 'all' | 'hot'>
const CATEGORIES: WritableCategory[] = ['worry', 'question', 'tip', 'humor']

export default function NewPostScreen() {
  const { canWritePost } = useTier()
  const [category, setCategory] = useState<WritableCategory>('worry')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState('')
  const [quotedPostId, setQuotedPostId] = useState('')

  const {
    pickAndUploadMultiple,
    uploading,
    error: imageError,
    clearError: clearImageError,
  } = useImageUpload({ bucket: 'post-images' })
  const { submit, submitting, error, clearError } = usePostSubmit({
    onSuccess: (post) => {
      setTitle('')
      setBody('')
      setImageUrls([])
      setVideoUrl('')
      setVideoThumbnailUrl('')
      setQuotedPostId('')
      router.replace(`/post/${post.id}` as any)
    },
  })

  const canSubmit =
    canWritePost &&
    title.trim().length >= 2 &&
    body.trim().length >= 5 &&
    !submitting &&
    !uploading

  // 한글 주석: 다중 선택 - 남은 슬롯만큼만 picker selectionLimit 줘서
  //   PHPicker 우상단 "추가 (n)"으로 확정. 시뮬레이터 PHPicker 글리치 회피
  //   (single mode는 X 안 눌리는 버그 자주 발생)
  const addImage = async () => {
    const remaining = 4 - imageUrls.length
    if (remaining <= 0) {
      Alert.alert('사진은 최대 4장까지', '피드에서 한눈에 보기 좋게 4장까지만 붙일 수 있어.')
      return
    }
    const urls = await pickAndUploadMultiple(remaining)
    if (urls.length > 0) setImageUrls((prev) => [...prev, ...urls])
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    await submit({
      title,
      body,
      category,
      imageUrls,
      videoUrl: videoUrl.trim() || null,
      videoThumbnailUrl: videoThumbnailUrl.trim() || null,
      quotedPostId: quotedPostId.trim() || null,
    })
  }

  if (!canWritePost) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>글쓰기는 로그인 후 가능해</Text>
          <Text style={styles.gateText}>운영 이야기와 질문을 남기려면 먼저 계정을 지켜두자.</Text>
          <Button label="로그인하러 가기" onPress={() => router.push('/login' as any)} fullWidth />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header submitting={submitting} canSubmit={canSubmit} onSubmit={handleSubmit} />
      {(error || imageError) ? (
        <Pressable
          style={styles.errorBanner}
          onPress={() => {
            if (error) clearError()
            if (imageError) clearImageError()
          }}
        >
          <Text style={styles.errorText}>{error ?? imageError}</Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.label}>카테고리</Text>
          <View style={styles.categoryRow}>
            {CATEGORIES.map((item) => (
              <Pressable
                key={item}
                style={[styles.categoryChip, item === category && styles.categoryChipActive]}
                onPress={() => setCategory(item)}
              >
                <Text style={[styles.categoryText, item === category && styles.categoryTextActive]}>
                  {CATEGORY_LABELS[item]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>제목</Text>
          <TextInput
            style={styles.titleInput}
            value={title}
            onChangeText={setTitle}
            placeholder="사장님들에게 한 줄로 알려줘"
            placeholderTextColor={colors.text.tertiary}
            maxLength={50}
          />
          <Text style={styles.counter}>{title.length} / 50</Text>

          <Text style={styles.label}>내용</Text>
          <TextInput
            style={styles.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="운영 중 어떤 일이 있었나요?"
            placeholderTextColor={colors.text.tertiary}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.counter}>{body.length} / 2000</Text>

          <Text style={styles.label}>이미지</Text>
          <View style={styles.imageGrid}>
            {imageUrls.map((url, index) => (
              <View key={url} style={styles.imageSlot}>
                <Image source={{ uri: url }} style={styles.image} />
                <Pressable
                  style={styles.removeButton}
                  onPress={() => setImageUrls((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addMediaButton} onPress={addImage} disabled={uploading}>
              {uploading ? <ActivityIndicator color={colors.brand[400]} /> : <Text style={styles.addMediaText}>＋ 사진</Text>}
            </Pressable>
          </View>

          <Text style={styles.label}>동영상 (선택)</Text>
          <TextInput
            style={styles.input}
            value={videoUrl}
            onChangeText={setVideoUrl}
            placeholder="동영상 URL"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={videoThumbnailUrl}
            onChangeText={setVideoThumbnailUrl}
            placeholder="동영상 썸네일 URL"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />

          <Text style={styles.label}>인용 옵션</Text>
          <TextInput
            style={styles.input}
            value={quotedPostId}
            onChangeText={setQuotedPostId}
            placeholder="인용할 원글 ID"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function Header({
  submitting,
  canSubmit,
  onSubmit,
}: {
  submitting?: boolean
  canSubmit?: boolean
  onSubmit?: () => void
}) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.headerButton} onPress={() => router.back()}>
        <Text style={styles.cancelText}>취소</Text>
      </Pressable>
      <Text style={styles.headerTitle}>새 글</Text>
      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
      >
        {submitting ? <ActivityIndicator color={colors.onBrand} /> : <Text style={styles.submitText}>발행</Text>}
      </Pressable>
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
    paddingHorizontal: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.line.default,
  },
  headerButton: {
    minWidth: 64,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.metaEmphasis,
    color: colors.text.secondary,
  },
  headerTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  submitButton: {
    minWidth: 64,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[500],
  },
  submitButtonDisabled: {
    backgroundColor: colors.bg.nested,
  },
  submitText: {
    ...typography.buttonSmall,
    color: colors.onBrand,
  },
  errorBanner: {
    padding: spacing[3],
    backgroundColor: colors.bg.nested,
  },
  errorText: {
    ...typography.meta,
    color: colors.semantic.warn,
  },
  gate: {
    flex: 1,
    padding: spacing[6],
    justifyContent: 'center',
    gap: spacing[3],
  },
  gateTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  gateText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[10],
    gap: spacing[2],
  },
  label: {
    ...typography.label,
    color: colors.text.secondary,
    marginTop: spacing[3],
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  categoryChip: {
    minHeight: 38,
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: colors.bg.raised,
    borderColor: colors.brand[600],
  },
  categoryText: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  categoryTextActive: {
    color: colors.brand[300],
  },
  titleInput: {
    ...typography.heading3,
    minHeight: 52,
    color: colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.line.default,
  },
  bodyInput: {
    ...typography.body,
    minHeight: 220,
    color: colors.text.primary,
    backgroundColor: colors.bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    padding: spacing[3],
  },
  counter: {
    ...typography.caption,
    color: colors.text.disabled,
    textAlign: 'right',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  imageSlot: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.bg.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    right: spacing[1],
    top: spacing[1],
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: colors.text.primary,
    fontSize: 18,
  },
  addMediaButton: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
  },
  addMediaText: {
    ...typography.metaEmphasis,
    color: colors.brand[300],
  },
  input: {
    ...typography.body,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    color: colors.text.primary,
    paddingHorizontal: spacing[3],
  },
})
