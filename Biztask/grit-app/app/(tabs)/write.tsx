// 한글 주석: 글쓰기 탭 화면
//
// ▣ 이 화면이 하는 일:
//   - 카테고리 선택 (유머/고민/질문/꿀팁)
//   - 제목 입력 (최대 50자)
//   - 본문 입력 (최대 2000자)
//   - 발행 버튼 → Supabase posts INSERT
//   - 성공 시 홈 탭으로 복귀 + 작성한 글 상세로 이동
//
// ▣ 주의:
//   - 익명 로그인 세션이 있어야 발행 가능 (AuthGate가 막아주니 여기서는 OK)
//   - 이미지 첨부는 Phase 3에서 (Supabase Storage 연동 필요)

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native'
import { router } from 'expo-router'
import { colors } from '@/constants/colors'
import { Category, CATEGORY_LABELS } from '@/lib/types'
import { usePostSubmit } from '@/lib/hooks/usePostSubmit'

// 한글 주석: 실제 발행 가능한 카테고리 (hot·all은 필터용)
type WritableCategory = Exclude<Category, 'all' | 'hot'>
const WRITABLE_CATEGORIES: WritableCategory[] = ['humor', 'worry', 'question', 'tip']

export default function WriteScreen() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<WritableCategory>('worry')

  // 한글 주석: 발행 훅 (성공 시 상세 화면으로 replace)
  const { submit, submitting, error, clearError } = usePostSubmit({
    onSuccess: (post) => {
      // 한글 주석: 작성 완료 → 입력 필드 초기화 후 상세로 이동
      //   - router.replace를 쓰면 뒤로 갈 때 글쓰기 화면으로 돌아가지 않음
      setTitle('')
      setBody('')
      Keyboard.dismiss()
      router.replace(`/post/${post.id}` as any)
    },
  })

  const canSubmit =
    title.trim().length >= 2 && body.trim().length >= 5 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return

    // 한글 주석: 발행 전 최종 확인 (사용자 실수 방지)
    Alert.alert(
      '발행할까?',
      '발행하면 다른 사장님들에게 바로 노출돼',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '발행',
          style: 'default',
          onPress: async () => {
            await submit({ title, body, category })
          },
        },
      ],
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>글쓰기</Text>
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          disabled={!canSubmit}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.textStrong} />
          ) : (
            <Text
              style={[
                styles.submitBtnText,
                !canSubmit && styles.submitBtnTextDisabled,
              ]}
            >
              발행
            </Text>
          )}
        </Pressable>
      </View>

      {/* 한글 주석: 에러 배너 (있을 때만) */}
      {error && (
        <Pressable style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <Text style={styles.errorBannerClose}>✕</Text>
        </Pressable>
      )}

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>카테고리</Text>
        <View style={styles.categoryRow}>
          {WRITABLE_CATEGORIES.map((cat) => {
            const isActive = cat === category
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.label}>제목</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="제목을 입력해주세요"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={(t) => {
            if (error) clearError()
            setTitle(t)
          }}
          maxLength={50}
          editable={!submitting}
        />
        <Text style={styles.counter}>{title.length} / 50</Text>

        <Text style={styles.label}>내용</Text>
        <TextInput
          style={styles.bodyInput}
          placeholder={'사장님들과 공유하고 싶은 이야기를 자유롭게 적어주세요.\n(일상·고민·꿀팁·유머 뭐든 환영)'}
          placeholderTextColor={colors.textMuted}
          value={body}
          onChangeText={(t) => {
            if (error) clearError()
            setBody(t)
          }}
          multiline
          textAlignVertical="top"
          editable={!submitting}
          maxLength={2000}
        />

        <Text style={styles.counter}>{body.length} / 2000</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

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
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
  },
  submitBtn: {
    minWidth: 52,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: colors.bgMuted,
  },
  submitBtnText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: colors.textStrong,
  },
  submitBtnTextDisabled: {
    color: colors.textMuted,
  },

  // 에러 배너
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
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

  body: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: colors.textMuted,
    marginTop: 16,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  categoryChipActive: {
    backgroundColor: colors.bgBrandSoft,
    borderColor: '#C0DD97',
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
  },
  categoryChipTextActive: {
    color: colors.textBrand,
    fontFamily: 'Pretendard-Medium',
  },
  titleInput: {
    fontSize: 16,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bodyInput: {
    fontSize: 15,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
    lineHeight: 24,
    minHeight: 240,
    paddingVertical: 10,
  },
  counter: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
    fontFamily: 'Pretendard-Regular',
  },
})
