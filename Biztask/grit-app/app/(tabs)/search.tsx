// 한글 주석: 검색 탭 화면 (Phase 1 placeholder)
//
// ▣ Phase 1: 검색창 UI만 박아둠 (실제 검색 기능은 Phase 2)
// ▣ Phase 2 예정 기능:
//   - 키워드 검색 (제목·본문·닉네임)
//   - 인기 검색어 태그
//   - 최근 검색 히스토리

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native'
import { colors } from '@/constants/colors'

const HOT_KEYWORDS = [
  '진상 손님',
  '임대료',
  '스마트스토어',
  '배달앱 수수료',
  '세무',
  '인건비',
  '마케팅',
  '재료값',
]

export default function SearchScreen() {
  const [query, setQuery] = useState('')

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.input}
            placeholder="사장님들이 궁금해하는 거 검색"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      </View>

      <ScrollView style={styles.body}>
        <Text style={styles.sectionTitle}>🔥 지금 뜨는 키워드</Text>
        <View style={styles.tagRow}>
          {HOT_KEYWORDS.map((k, i) => (
            <Pressable key={k} style={styles.tag}>
              <Text style={styles.tagRank}>{i + 1}</Text>
              <Text style={styles.tagText}>{k}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.emptyHint}>
          <Text style={styles.emptyText}>
            검색 기능은 곧 오픈 예정이야{'\n'}조금만 기다려줘
          </Text>
        </View>
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
  },
  body: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.bgBrandSoft,
    borderRadius: 16,
  },
  tagRank: {
    fontSize: 12,
    fontFamily: 'Pretendard-Bold',
    color: colors.textBrand,
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'Pretendard-Medium',
    color: colors.textStrong,
  },
  emptyHint: {
    marginTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
})
