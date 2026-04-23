// 한글 주석: 업종 배지 컴포넌트
//
// ▣ 이 컴포넌트가 하는 일:
//   - 피드 카드나 글 상세에서 작성자의 "업종"을 작은 배지로 보여준다.
//   - 예: "음식점", "카페", "미용" 등. 블라인드의 "회사명" 역할.
//
// ▣ 왜 필요한가:
//   - 업종별로 고유 파스텔 컬러를 매핑해서, 피드에서 한눈에 업종을 구분할 수 있게 한다.
//   - 텍스트는 업종 컬러의 darker shade를 써서 대비(WCAG AA) 확보.
//
// ▣ 사용법:
//   <IndustryBadge industry="food" />
//   <IndustryBadge industry="cafe" size="sm" />

import React from 'react'
import { View, Text, StyleSheet, ViewStyle } from 'react-native'
import { Industry, INDUSTRY_META } from '@/lib/types'

// 한글 주석: props 정의
//   - industry: 업종 키 (필수)
//   - size: 기본 'sm' (피드에서 쓰는 작은 사이즈). 필요하면 'md'로 키움.
//   - style: 바깥에서 위치 조정용으로 넘기고 싶을 때.
interface IndustryBadgeProps {
  industry: Industry
  size?: 'sm' | 'md'
  style?: ViewStyle
}

export default function IndustryBadge({
  industry,
  size = 'sm',
  style,
}: IndustryBadgeProps) {
  // 한글 주석: types.ts에 정의한 업종 메타(라벨+컬러)를 가져옴
  const meta = INDUSTRY_META[industry]

  return (
    <View
      style={[
        styles.base,
        size === 'md' && styles.md,
        { backgroundColor: meta.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'md' && styles.textMd,
          { color: meta.fg },
        ]}
      >
        {meta.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    // 한글 주석: 작은 배지 기본값 (피드에서 쓰는 사이즈)
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  md: {
    // 한글 주석: 글 상세 등에서 쓰는 조금 큰 사이즈
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Pretendard-Medium',
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
})
