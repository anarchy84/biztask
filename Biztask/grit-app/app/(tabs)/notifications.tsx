// 한글 주석: 알림 탭 화면 (Phase 1 placeholder)
//
// ▣ Phase 1: 목업 알림 3개만 표시
// ▣ Phase 2 예정 기능:
//   - Supabase Realtime으로 댓글·좋아요 실시간 수신
//   - expo-notifications로 푸시 알림
//   - 읽음/안읽음 상태 관리

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native'
import { colors } from '@/constants/colors'
import TimeAgo from '@/components/common/TimeAgo'

type NotiType = 'comment' | 'like' | 'reply'

interface Noti {
  id: string
  type: NotiType
  title: string
  preview: string
  createdAt: string
  unread: boolean
}

const mockNotis: Noti[] = [
  {
    id: 'n1',
    type: 'comment',
    title: '카페사장15년차님이 댓글을 남겼어요',
    preview: '저는 그냥 "죄송합니다" 세 번 하고 마음속으로 별점 1점…',
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unread: true,
  },
  {
    id: 'n2',
    type: 'like',
    title: '유통창고형님 외 47명이 내 글을 좋아해요',
    preview: '"오늘 진상 한 명 왔는데 듣다가 혈압 오름"',
    createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    unread: true,
  },
  {
    id: 'n3',
    type: 'reply',
    title: '온라인셀러박님이 답글을 달았어요',
    preview: 'CCTV 있으시면 녹화 돌려두세요. 진상은 언제든 또…',
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    unread: false,
  },
]

const TYPE_ICON: Record<NotiType, string> = {
  comment: '💬',
  like: '♥',
  reply: '↩',
}

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>알림</Text>
        <Pressable>
          <Text style={styles.headerAction}>모두 읽음</Text>
        </Pressable>
      </View>

      <ScrollView>
        {mockNotis.map((noti) => (
          <Pressable key={noti.id} style={styles.item}>
            <View style={[styles.iconWrap, noti.unread && styles.iconWrapUnread]}>
              <Text style={[styles.icon, noti.type === 'like' && styles.iconLike]}>
                {TYPE_ICON[noti.type]}
              </Text>
            </View>
            <View style={styles.itemBody}>
              <Text
                style={[styles.itemTitle, noti.unread && styles.itemTitleUnread]}
                numberOfLines={1}
              >
                {noti.title}
              </Text>
              <Text style={styles.itemPreview} numberOfLines={1}>
                {noti.preview}
              </Text>
              <TimeAgo date={noti.createdAt} style={styles.itemTime} />
            </View>
            {noti.unread && <View style={styles.dot} />}
          </Pressable>
        ))}

        <View style={styles.empty}>
          <Text style={styles.emptyText}>여기까지가 최근 알림이야</Text>
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
  headerAction: {
    fontSize: 12,
    fontFamily: 'Pretendard-Medium',
    color: colors.textBrand,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUnread: {
    backgroundColor: colors.bgBrandSoft,
  },
  icon: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  iconLike: {
    color: colors.like,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 13,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
  },
  itemTitleUnread: {
    fontFamily: 'Pretendard-SemiBold',
    color: colors.textStrong,
  },
  itemPreview: {
    fontSize: 12,
    fontFamily: 'Pretendard-Regular',
    color: colors.textMuted,
  },
  itemTime: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'Pretendard-Regular',
  },
})
