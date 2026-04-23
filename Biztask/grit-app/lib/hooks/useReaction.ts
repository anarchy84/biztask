// 한글 주석: 좋아요/싫어요 토글 훅 (posts + comments 공용)
//
// ▣ 이 훅이 하는 일:
//   - reactions 테이블에 insert / update / delete
//   - posts·comments의 카운터는 DB 트리거(bump_reaction_count)가 자동 갱신
//   - 낙관적 업데이트와 결합하면 체감 반응 속도가 인스턴트함
//
// ▣ 토글 규칙:
//   - 현재 myReaction === null          + 새 탭 'like'     → insert('like')
//   - 현재 myReaction === 'like'        + 같은 탭 'like'   → delete (토글 오프)
//   - 현재 myReaction === 'like'        + 반대 탭 'dislike'→ delete 후 insert('dislike')
//     (단, DB에 unique(user_id, target_id, target_type) 없으므로 update 방식 사용)
//
// ▣ 사용 예 (PostDetailScreen 안):
//   const { toggle } = useReaction()
//   await toggle({ target: 'post', targetId: post.id,
//                  current: post.myReaction, next: 'like',
//                  onOptimistic: (myR, ld, dd) => {
//                    applyMyReaction('post', post.id, myR)
//                    applyReactionDelta('post', post.id, ld, dd)
//                  },
//                  onError: () => { /* 롤백 */ } })

import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

type ReactionType = 'like' | 'dislike'
type TargetType = 'post' | 'comment'

export interface ToggleArgs {
  target: TargetType
  targetId: string
  current: ReactionType | null | undefined  // 현재 내 반응 (null = 안 누른 상태)
  next: ReactionType                         // 이번에 누른 버튼 ('like' | 'dislike')
  // 한글 주석: 낙관적 업데이트 콜백
  //   - nextMyReaction: 이 토글 이후 내 상태 (null이면 해제)
  //   - likeDelta / dislikeDelta: 카운터 증감
  onOptimistic?: (
    nextMyReaction: ReactionType | null,
    likeDelta: number,
    dislikeDelta: number,
  ) => void
  onError?: (err: Error) => void
}

export function useReaction() {
  const { user } = useAuth()

  // ─────────────────────────────────────────────
  // 한글 주석: 토글 핵심 로직
  //   - 3가지 케이스 분기 (토글 오프 / 동일 반응 재탭 / 반대 반응)
  // ─────────────────────────────────────────────
  const toggle = useCallback(
    async ({ target, targetId, current, next, onOptimistic, onError }: ToggleArgs) => {
      if (!user?.id) {
        onError?.(new Error('로그인이 필요해 (익명 세션도 없음)'))
        return
      }

      // 한글 주석: 1) 로컬 카운터 델타 계산
      let likeDelta = 0
      let dislikeDelta = 0
      let nextMyReaction: ReactionType | null = next

      if (current === next) {
        // 같은 버튼 다시 → 해제
        if (next === 'like') likeDelta = -1
        else dislikeDelta = -1
        nextMyReaction = null
      } else if (current === null || current === undefined) {
        // 처음 누름
        if (next === 'like') likeDelta = 1
        else dislikeDelta = 1
        nextMyReaction = next
      } else {
        // 반대 반응으로 전환 (like → dislike 또는 dislike → like)
        if (next === 'like') {
          likeDelta = 1
          dislikeDelta = -1
        } else {
          likeDelta = -1
          dislikeDelta = 1
        }
        nextMyReaction = next
      }

      // 한글 주석: 2) UI 낙관적 반영 (사용자 체감 반응 즉시)
      onOptimistic?.(nextMyReaction, likeDelta, dislikeDelta)

      // 한글 주석: 3) DB 동기화
      try {
        // 기존 row 조회 (한 유저가 한 대상에 하나만 있음이 정상)
        const { data: existing, error: fetchErr } = await supabase
          .from('reactions')
          .select('id, type')
          .eq('user_id', user.id)
          .eq('target_id', targetId)
          .eq('target_type', target)
          .maybeSingle()

        if (fetchErr) throw new Error(fetchErr.message)

        if (nextMyReaction === null) {
          // 해제 → delete
          if (existing) {
            const { error: delErr } = await supabase
              .from('reactions')
              .delete()
              .eq('id', existing.id)
            if (delErr) throw new Error(delErr.message)
          }
        } else if (!existing) {
          // insert
          const { error: insErr } = await supabase.from('reactions').insert({
            user_id: user.id,
            target_id: targetId,
            target_type: target,
            type: nextMyReaction,
          })
          if (insErr) throw new Error(insErr.message)
        } else if (existing.type !== nextMyReaction) {
          // 반대 반응으로 변경 → update
          const { error: updErr } = await supabase
            .from('reactions')
            .update({ type: nextMyReaction })
            .eq('id', existing.id)
          if (updErr) throw new Error(updErr.message)
        }
        // (existing.type === nextMyReaction 이면 이미 UI 낙관적 업데이트로 같은 상태 만든 뒤 여기 도달하지 않음)
      } catch (e) {
        const msg = e instanceof Error ? e.message : '알 수 없는 에러'
        console.error('[useReaction] 토글 실패:', msg)
        // 한글 주석: 롤백 - 반대 방향으로 델타 다시 호출
        onOptimistic?.(current ?? null, -likeDelta, -dislikeDelta)
        onError?.(new Error(msg))
      }
    },
    [user?.id],
  )

  return { toggle }
}
