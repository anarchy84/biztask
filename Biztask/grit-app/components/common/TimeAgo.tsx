// 한글 주석: 상대 시간 표시 컴포넌트
//
// ▣ 이 컴포넌트가 하는 일:
//   - ISO 날짜 문자열(예: "2026-04-23T09:41:00Z")을 받아서
//     "3분 전", "1시간 전", "어제" 같은 한국어 상대 시간으로 변환한다.
//   - 30초마다 자동으로 갱신 (화면에 계속 머물러 있을 때 최신 값 유지).
//
// ▣ 왜 필요한가:
//   - 블라인드·네이버카페에서 시간 표시는 사용자 체류에 큰 영향.
//   - "3분 전"이 "방금"이 되고 "방금"이 "1분 전"이 되는 걸 본능적으로 체크하니까.
//
// ▣ 사용법:
//   <TimeAgo date="2026-04-23T09:41:00Z" />
//   <TimeAgo date={post.createdAt} style={{ color: '#71717A' }} />
//
// ▣ 의존 라이브러리:
//   - date-fns (경량, 필요한 함수만 import → 트리 셰이킹 유리)
//   - date-fns/locale/ko (한국어 로케일)
//   → npm install date-fns

import React, { useEffect, useState } from 'react'
import { Text, TextStyle } from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

interface TimeAgoProps {
  date: string          // ISO 8601 문자열
  style?: TextStyle
}

export default function TimeAgo({ date, style }: TimeAgoProps) {
  // 한글 주석: 현재 표시할 텍스트 상태
  const [text, setText] = useState<string>(() => formatKo(date))

  useEffect(() => {
    // 한글 주석: 30초마다 다시 계산 (정확성 vs 배터리 트레이드오프)
    //   - 30초면 "방금 → 1분 전" 전환 느낌이 자연스럽다
    //   - 너무 짧으면 배터리 소모, 너무 길면 시간이 얼어붙어 보임
    const id = setInterval(() => setText(formatKo(date)), 30_000)
    return () => clearInterval(id)
  }, [date])

  return <Text style={style}>{text}</Text>
}

// 한글 주석: 날짜 포맷 변환 함수
//   - date-fns의 formatDistanceToNow에 한국어 로케일 적용.
//   - addSuffix: true → "3분 전"처럼 "전" 접미사 붙임.
//   - 결과 예: "3분 전", "약 1시간 전", "1일 전"
//   - "약 1시간" 같이 불필요한 "약 "이 붙으면 제거 (한국어 UI 톤 정리)
function formatKo(dateStr: string): string {
  try {
    const raw = formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ko,
    })
    return raw.replace(/^약\s/, '')
  } catch {
    // 한글 주석: 날짜 파싱 실패 시 원본 문자열 그대로 표시
    return dateStr
  }
}
