// 한글 주석: V2 시크릿 라운지
//
// ▣ 인증 사장님 전용 화면이다.
// ▣ 미인증 사용자는 SecretLoungeGate로 인증 안내만 보여준다.

import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@/components/common/Button'
import { GritGauge } from '@/components/common/GritGauge'
import { colors } from '@/constants/colors'
import { radius, spacing } from '@/constants/spacing'
import { typography } from '@/constants/typography'
import { useTier } from '@/lib/hooks/useTier'

const CATEGORIES = [
  { icon: '인', title: '인력', count: '128', delta: '+18', desc: '채용·노무·면접' },
  { icon: '비', title: '비용', count: '342', delta: '+31', desc: '임대료·수수료·세무' },
  { icon: '매', title: '매물', count: '74', delta: '+9', desc: '상가·기기·양도' },
  { icon: '트', title: '트러블', count: '219', delta: '+26', desc: '진상·분쟁·리스크' },
]

export default function LoungeScreen() {
  const { canViewSecretLounge } = useTier()
  if (!canViewSecretLounge) return <SecretLoungeGate />
  return <SecretLoungeContent />
}

function SecretLoungeGate() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.gateWrap}>
        <View style={styles.lockCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <Text style={styles.secretLabel}>SECRET · 인증 회원 전용</Text>
        <Text style={styles.gateTitle}>사업자 인증하면 들어올 수 있어요</Text>
        <Text style={styles.gateBody}>
          시크릿 라운지는 검증된 사장님끼리만 운영 노하우와 민감한 정보를 나누는 공간이야.
        </Text>
        <Button label="사업자 인증 시작" size="lg" fullWidth />
        <Button label="나중에 할게" variant="ghost" size="lg" fullWidth />
      </View>
    </SafeAreaView>
  )
}

function SecretLoungeContent() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroLabelRow}>
            <Text style={styles.heroLock}>🔒</Text>
            <Text style={styles.secretLabel}>SECRET · 인증 회원 전용</Text>
          </View>
          <Text style={styles.heroTitle}>시크릿{'\n'}라운지</Text>
          <Text style={styles.heroBody}>사장님끼리만 보이는 비공개 채널. 인력, 비용, 매물, 트러블까지 진짜 이야기만.</Text>
        </View>

        <View style={styles.categoryGrid}>
          {CATEGORIES.map((item) => (
            <Pressable key={item.title} style={styles.categoryCard} accessibilityRole="button">
              <Text style={styles.categoryIcon}>{item.icon}</Text>
              <View>
                <Text style={styles.categoryDesc}>{item.desc}</Text>
                <Text style={styles.categoryCount}>{item.count}</Text>
                <Text style={styles.categoryTitle}>
                  {item.title} · 오늘 {item.delta}개
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>오늘의 익명 토픽</Text>
        <View style={styles.topicList}>
          {[
            ['다이아몬드 사장님 #A7', '직원 4대보험 조정 요청이 들어왔는데 어디까지 받아줘야 할까요?', 92],
            ['플래티넘 사장님 #M2', '프랜차이즈 본사 물류 단가 협상해본 분 있나요?', 78],
            ['블루 사장님 #K9', '상가 재계약 직전 꼭 확인할 조항 공유합니다.', 88],
          ].map(([who, body, score]) => (
            <Pressable key={String(body)} style={styles.topicRow} accessibilityRole="button">
              <GritGauge mode="ring" score={Number(score)} size={40} showLabel={false} />
              <View style={styles.topicBody}>
                <Text style={styles.topicWho}>{who}</Text>
                <Text style={styles.topicText} numberOfLines={2}>{body}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  gateWrap: {
    flex: 1,
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  lockCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.brand[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 32,
    color: colors.brand[300],
  },
  secretLabel: {
    ...typography.caption,
    color: colors.brand[300],
    letterSpacing: 1,
  },
  gateTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  gateBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing[4],
    paddingBottom: 112,
    gap: spacing[5],
  },
  hero: {
    paddingTop: spacing[8],
    gap: spacing[3],
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  heroLock: {
    fontSize: 14,
    color: colors.brand[300],
  },
  heroTitle: {
    ...typography.heading1,
    fontSize: 34,
    lineHeight: 40,
    color: colors.text.primary,
  },
  heroBody: {
    ...typography.body,
    color: colors.text.tertiary,
    maxWidth: 300,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  categoryCard: {
    width: '48%',
    aspectRatio: 1.05,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[4],
    justifyContent: 'space-between',
  },
  categoryIcon: {
    ...typography.heading3,
    color: colors.brand[400],
  },
  categoryDesc: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  categoryCount: {
    ...typography.numLarge,
    color: colors.text.primary,
    marginTop: spacing[1],
  },
  categoryTitle: {
    ...typography.label,
    color: colors.text.secondary,
  },
  sectionTitle: {
    ...typography.bodyEmphasis,
    color: colors.text.secondary,
  },
  topicList: {
    gap: spacing[2],
  },
  topicRow: {
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line.default,
    backgroundColor: colors.bg.surface,
    padding: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  topicBody: {
    flex: 1,
    minWidth: 0,
  },
  topicWho: {
    ...typography.metaEmphasis,
    color: colors.brand[300],
  },
  topicText: {
    ...typography.meta,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
})
