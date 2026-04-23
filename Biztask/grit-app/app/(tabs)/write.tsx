// 한글 주석: 글쓰기 탭 화면 (Phase 1 placeholder)
//
// ▣ Phase 1: 입력폼 UI만 박아둠 (실제 발행 로직은 Phase 2)
// ▣ Phase 2 예정 기능:
//   - Supabase에 글 insert
//   - 업종 배지 자동 태깅 (프로필 업종 기반)
//   - 카테고리 선택 (고민/질문/꿀팁/유머)
//   - 이미지 첨부
// ▣ Phase 1 단계에선 "작성 완료" 시 alert만 띄움

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
} from 'react-native'
import { colors } from '@/constants/colors'
import { Category, CATEGORY_LABELS } from '@/lib/types'

const WRITABLE_CATEGORIES: Category[] = ['humor', 'worry', 'question', 'tip']

export default function WriteScreen() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>('worry')

  const canSubmit = title.trim().length > 0 && body.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    // 한글 주석: Phase 2에서 Supabase insert로 교체
    Alert.alert(
      '발행 완료',
      `"${title}" 글이 등록됐어요! (Phase 1 목업)`,
      [
        {
          text: '확인',
          onPress: () => {
            setTitle('')
            setBody('')
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
          <Text
            style={[
              styles.submitBtnText,
              !canSubmit && styles.submitBtnTextDisabled,
            ]}
          >
            발행
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body}>
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
          onChangeText={setTitle}
          maxLength={50}
        />

        <Text style={styles.label}>내용</Text>
        <TextInput
          style={styles.bodyInput}
          placeholder={'사장님들과 공유하고 싶은 이야기를 자유롭게 적어주세요.\n(일상·고민·꿀팁·유머 뭐든 환영)'}
          placeholderTextColor={colors.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.brand,
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
