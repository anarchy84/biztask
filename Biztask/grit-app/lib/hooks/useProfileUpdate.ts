// 한글 주석: 프로필 업데이트 훅 (닉네임 / 업종 / 한줄소개 / 아바타)
//
// ▣ 이 훅이 하는 일:
//   - profiles 테이블의 내 row UPDATE
//   - 입력 검증 (닉네임 2~20자, bio 최대 100자)
//   - 부분 업데이트 지원 (닉네임만, 또는 아바타만 등)
//   - 성공 시 AuthContext의 refreshProfile 자동 호출 → 앱 전역 반영
//
// ▣ 사용 예 (편집 화면):
//   const { update, updating, error } = useProfileUpdate()
//   await update({ nickname: '새닉', industry: 'cafe', bio: '안녕' })

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Industry } from '@/lib/types'
import type { TablesUpdate } from '@/lib/database.types'

// 한글 주석: Supabase profiles 테이블 UPDATE 타입 (자동 생성된 정확한 타입)
type ProfileUpdatePayload = TablesUpdate<'profiles'>

// 한글 주석: 닉네임/바이오 길이 제한 (UX 기준)
const NICKNAME_MIN = 2
const NICKNAME_MAX = 20
const BIO_MAX = 100

export interface ProfileUpdateInput {
  nickname?: string
  industry?: Industry
  bio?: string | null         // null로 비우기 가능
  avatarUrl?: string | null   // null로 아바타 제거 가능
}

export interface UseProfileUpdateReturn {
  update: (input: ProfileUpdateInput) => Promise<boolean>
  updating: boolean
  error: string | null
  clearError: () => void
}

export function useProfileUpdate(): UseProfileUpdateReturn {
  const { user, refreshProfile } = useAuth()
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(
    async (input: ProfileUpdateInput): Promise<boolean> => {
      setError(null)

      if (!user?.id) {
        setError('로그인 세션이 없어. 앱 재실행 후 다시 시도해줘')
        return false
      }

      // ─────────────────────────────────────────────
      // 1) 입력 검증 + payload 구성
      //   - 명시된 필드만 업데이트 (undefined는 무시)
      //   - 빈 문자열도 의미 있을 수 있으니 명시적 trim 처리
      // ─────────────────────────────────────────────
      const payload: ProfileUpdatePayload = {}

      if (input.nickname !== undefined) {
        const trimmed = input.nickname.trim()
        if (trimmed.length < NICKNAME_MIN) {
          setError(`닉네임은 ${NICKNAME_MIN}자 이상이어야 해`)
          return false
        }
        if (trimmed.length > NICKNAME_MAX) {
          setError(`닉네임은 ${NICKNAME_MAX}자 이내로 써줘`)
          return false
        }
        payload.nickname = trimmed
      }

      if (input.industry !== undefined) {
        payload.industry = input.industry
      }

      if (input.bio !== undefined) {
        // 한글 주석: bio는 null로 비우기 허용
        if (input.bio === null) {
          payload.bio = null
        } else {
          const trimmed = input.bio.trim()
          if (trimmed.length > BIO_MAX) {
            setError(`한줄소개는 ${BIO_MAX}자 이내로 써줘`)
            return false
          }
          payload.bio = trimmed.length === 0 ? null : trimmed
        }
      }

      if (input.avatarUrl !== undefined) {
        // 한글 주석: avatarUrl도 null로 비우기 허용 (기본 이니셜 아바타로 복귀)
        payload.avatar_url = input.avatarUrl
      }

      // 한글 주석: 변경 사항 없으면 조기 종료
      if (Object.keys(payload).length === 0) {
        return true
      }

      setUpdating(true)

      try {
        // ─────────────────────────────────────────────
        // 2) Supabase UPDATE
        // ─────────────────────────────────────────────
        const { error: updErr } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', user.id)

        if (updErr) {
          // 한글 주석: unique violation (닉네임 중복) 처리 - 향후 unique 제약 추가 대비
          if (updErr.code === '23505') {
            throw new Error('이미 쓰이고 있는 닉네임이야. 다른 걸로 해줘')
          }
          throw new Error(updErr.message)
        }

        // 한글 주석: 3) 전역 프로필 새로고침 → 마이페이지·피드·댓글 등 자동 반영
        await refreshProfile()
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[useProfileUpdate] 실패:', msg)
        setError(msg)
        return false
      } finally {
        setUpdating(false)
      }
    },
    [user?.id, refreshProfile],
  )

  const clearError = useCallback(() => setError(null), [])

  return { update, updating, error, clearError }
}
