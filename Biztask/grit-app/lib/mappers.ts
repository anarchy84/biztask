// 한글 주석: Supabase Row → GRIT V2 UI 타입 변환 매퍼
//
// ▣ DB는 snake_case, UI는 camelCase를 쓴다.
// ▣ V2 피드 카드가 요구하는 작성자 인증/그릿/인용/미디어 필드를 한 곳에서 정리한다.

import type { Tables } from './database.types'
import type { Category, Comment, Industry, Post, PostAuthor, QuotedPost } from './types'

type PostRow = Tables<'posts'>
type CommentRow = Tables<'comments'>
type ProfileRow = Tables<'profiles'>

export type PostRowWithAuthor = PostRow & {
  author: ProfileRow | null
  quoted?: (PostRow & { author: ProfileRow | null }) | null
}

export type CommentRowWithAuthor = CommentRow & {
  author: ProfileRow | null
}

/** 한글 주석: 프로필 row를 피드/댓글 작성자 모델로 바꾼다. */
export function mapAuthor(p: ProfileRow | null): PostAuthor {
  if (!p) {
    return {
      id: 'unknown',
      nickname: '사장님',
      industry: 'etc',
      isNpc: false,
      tier: 'guest',
      gritScore: 0,
    }
  }

  return {
    id: p.id,
    nickname: p.nickname,
    industry: p.industry as Industry,
    isNpc: p.is_npc,
    avatarUrl: p.avatar_url,
    region: p.region,
    yearsInBusiness: p.years_in_business,
    tier: p.tier,
    verifiedAt: p.verified_at,
    gritScore: p.grit_score,
    followerCount: p.follower_count,
    followingCount: p.following_count,
  }
}

/** 한글 주석: 인용 카드 안에 들어가는 원글 요약 모델. */
function mapQuotedPost(row: (PostRow & { author: ProfileRow | null }) | null | undefined): QuotedPost | null {
  if (!row) return null
  return {
    id: row.id,
    author: mapAuthor(row.author),
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
  }
}

/** 한글 주석: 게시글 row를 V2 PostCard가 바로 렌더링할 수 있는 모델로 변환한다. */
export function mapPost(row: PostRowWithAuthor): Post {
  const imageUrls = row.image_urls?.length
    ? row.image_urls
    : row.image_url
      ? [row.image_url]
      : []

  return {
    id: row.id,
    author: mapAuthor(row.author),
    category: row.category as Category,
    title: row.title,
    body: row.body,
    imageUrl: imageUrls[0],
    imageUrls,
    thumbnailUrl: row.video_thumbnail_url ?? imageUrls[0],
    videoUrl: row.video_url,
    videoThumbnailUrl: row.video_thumbnail_url,
    likeCount: row.like_count,
    dislikeCount: row.dislike_count,
    commentCount: row.comment_count,
    bookmarkCount: row.bookmark_count,
    quoteCount: row.quote_count,
    viewCount: 0,
    createdAt: row.created_at,
    isQuote: row.is_quote,
    quotedPostId: row.quoted_post_id,
    quotedPost: mapQuotedPost(row.quoted),
    myReaction: undefined,
  }
}

export function mapPosts(rows: PostRowWithAuthor[] | null): Post[] {
  if (!rows) return []
  return rows.map(mapPost)
}

/** 한글 주석: 댓글 row를 댓글 리스트 모델로 변환한다. */
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

/** 한글 주석: reactions 테이블 조회 결과를 현재 유저의 내 반응 상태로 주입한다. */
export function injectMyReaction<T extends { id: string; myReaction?: 'like' | 'dislike' | null }>(
  items: T[],
  myReactions: { target_id: string; type: 'like' | 'dislike' }[],
): T[] {
  const map = new Map(myReactions.map((r) => [r.target_id, r.type]))
  return items.map((item) => ({
    ...item,
    myReaction: map.get(item.id) ?? null,
  }))
}
