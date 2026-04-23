// 한글 주석: Supabase Row → UI Type 변환 매퍼
//
// ▣ 이 파일의 역할:
//   - DB는 snake_case (like_count, author_id, created_at ...)
//   - UI는 camelCase (likeCount, author, createdAt ...)
//   - 이 두 세계 사이를 이어주는 "번역기" 역할
//
// ▣ 왜 분리하나?
//   - DB 스키마 바뀌어도 UI는 건드릴 필요 없게 (변경 영향 최소화)
//   - 각 테이블의 join 데이터를 UI가 쓰기 좋은 구조로 정리
//   - 훅·컴포넌트 코드가 훨씬 짧고 깔끔해짐
//
// ▣ 사용 예:
//   const row = await supabase.from('posts').select('*, profiles:author_id(*)')
//   const post = mapPostRow(row)  // UI용 Post 타입

import type { Tables } from './database.types'
import type { Post, Comment, PostAuthor, Category } from './types'

// ─────────────────────────────────────────────
// 한글 주석: DB Row 타입 별칭 (편의용)
// ─────────────────────────────────────────────
type PostRow = Tables<'posts'>
type CommentRow = Tables<'comments'>
type ProfileRow = Tables<'profiles'>

// 한글 주석: profiles 조인된 타입 (Supabase 클라이언트가 자동 추론)
//   - 실제 쿼리: .select('*, author:profiles!author_id(*)')
//   - 조인 결과는 author 키 아래 프로필이 들어옴
export type PostRowWithAuthor = PostRow & {
  author: ProfileRow | null
}

export type CommentRowWithAuthor = CommentRow & {
  author: ProfileRow | null
}

// ─────────────────────────────────────────────
// 한글 주석: 프로필 Row → PostAuthor (공통 매퍼)
// ─────────────────────────────────────────────
export function mapAuthor(p: ProfileRow | null): PostAuthor {
  // 한글 주석: 프로필 join 실패 시 폴백 (프로필 삭제된 경우 등)
  if (!p) {
    return {
      id: 'unknown',
      nickname: '사장님',
      industry: 'etc',
      isNpc: false,
    }
  }
  return {
    id: p.id,
    nickname: p.nickname,
    industry: p.industry,
    isNpc: p.is_npc,
  }
}

// ─────────────────────────────────────────────
// 한글 주석: Post Row → UI Post 타입
// ─────────────────────────────────────────────
export function mapPost(row: PostRowWithAuthor): Post {
  return {
    id: row.id,
    author: mapAuthor(row.author),
    category: row.category as Category,
    title: row.title,
    body: row.body,
    thumbnailUrl: row.image_url ?? undefined,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    commentCount: row.comment_count,
    // 한글 주석: viewCount는 DB에 아직 없음 → 0 고정 (Phase 3에서 추가 예정)
    viewCount: 0,
    createdAt: row.created_at,
    // 한글 주석: myReaction은 별도 쿼리로 조합 (reactions 테이블 조회 필요)
    //   - 지금은 undefined → 훅 레이어에서 주입
    myReaction: undefined,
  }
}

// ─────────────────────────────────────────────
// 한글 주석: 복수 Post Row 한 번에 변환
// ─────────────────────────────────────────────
export function mapPosts(rows: PostRowWithAuthor[] | null): Post[] {
  if (!rows) return []
  return rows.map(mapPost)
}

// ─────────────────────────────────────────────
// 한글 주석: Comment Row → UI Comment 타입
// ─────────────────────────────────────────────
export function mapComment(row: CommentRowWithAuthor): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    author: mapAuthor(row.author),
    body: row.body,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    createdAt: row.created_at,
    myReaction: undefined,
  }
}

export function mapComments(rows: CommentRowWithAuthor[] | null): Comment[] {
  if (!rows) return []
  return rows.map(mapComment)
}

// ─────────────────────────────────────────────
// 한글 주석: 내 반응(myReaction) 주입 헬퍼
//   - posts/comments 배열에 내가 누른 like/dislike 붙여줌
//   - reactions 테이블에서 user_id 필터로 따로 조회 후 Map으로 join
// ─────────────────────────────────────────────
export function injectMyReaction<T extends { id: string; myReaction?: 'like' | 'dislike' | null }>(
  items: T[],
  myReactions: { target_id: string; type: 'like' | 'dislike' }[],
): T[] {
  // 한글 주석: target_id → type 맵으로 만들어 O(1) 조회
  const map = new Map(myReactions.map((r) => [r.target_id, r.type]))
  return items.map((item) => ({
    ...item,
    myReaction: map.get(item.id) ?? null,
  }))
}
