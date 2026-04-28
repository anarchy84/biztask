// 한글 주석: GRIT V2 앱 공통 타입 정의
//
// ▣ 이 파일의 역할:
//   - Supabase row를 화면이 쓰기 쉬운 camelCase 모델로 가공한 타입을 모아둔다.
//   - V1 타입 이름(Post/Comment/Industry)은 유지해서 기존 훅과 화면의 영향 범위를 줄인다.
//   - V2에서 추가된 인증 등급, 그릿 지수, 인용글, 다중 이미지, 동영상 썸네일까지 포함한다.

// ─────────────────────────────────────────────
// 1. 업종 (Industry)
// ─────────────────────────────────────────────

export type Industry =
  | 'cafe'
  | 'food'
  | 'beauty'
  | 'retail'
  | 'online'
  | 'service'
  | 'education'
  | 'health'
  | 'creative'
  | 'etc'

export const INDUSTRY_META: Record<
  Industry,
  { label: string; bg: string; fg: string }
> = {
  cafe: { label: '카페', bg: '#064E3B', fg: '#A7F3D0' },
  food: { label: '요식업', bg: '#064E3B', fg: '#A7F3D0' },
  beauty: { label: '미용', bg: '#1F2937', fg: '#E4E4E7' },
  retail: { label: '유통', bg: '#1F2937', fg: '#E4E4E7' },
  online: { label: '온라인', bg: '#1F2937', fg: '#E4E4E7' },
  service: { label: '서비스', bg: '#1F2937', fg: '#E4E4E7' },
  education: { label: '교육', bg: '#1F2937', fg: '#E4E4E7' },
  health: { label: '헬스', bg: '#1F2937', fg: '#E4E4E7' },
  creative: { label: '1인사업', bg: '#1F2937', fg: '#E4E4E7' },
  etc: { label: '기타', bg: '#1F2937', fg: '#E4E4E7' },
}

// ─────────────────────────────────────────────
// 2. 카테고리 (피드 필터 + DB 카테고리)
// ─────────────────────────────────────────────

export type Category =
  | 'all'
  | 'hot'
  | 'humor'
  | 'worry'
  | 'question'
  | 'tip'

export const CATEGORY_LABELS: Record<Category, string> = {
  all: '전체',
  hot: 'HOT',
  humor: '유머',
  worry: '고민',
  question: '질문',
  tip: '꿀팁',
}

export type FeedFilter = 'all' | 'following' | 'industry' | 'nearby' | 'hot'

export const FEED_FILTER_LABELS: Record<FeedFilter, string> = {
  all: '전체',
  following: '팔로우',
  industry: '내 업종',
  nearby: '동네',
  hot: 'HOT',
}

// ─────────────────────────────────────────────
// 3. 작성자 / 프로필 요약
// ─────────────────────────────────────────────

export type UserTier = 'guest' | 'general' | 'verified' | 'blue'

export interface PostAuthor {
  id: string
  nickname: string
  industry: Industry
  isNpc?: boolean
  avatarUrl?: string | null
  region?: string | null
  yearsInBusiness?: number | null
  tier?: UserTier
  verifiedAt?: string | null
  gritScore?: number
  followerCount?: number
  followingCount?: number
}

// ─────────────────────────────────────────────
// 4. 게시글
// ─────────────────────────────────────────────

export interface Post {
  id: string
  author: PostAuthor
  category: Category
  title: string
  body: string
  imageUrl?: string
  imageUrls: string[]
  thumbnailUrl?: string
  videoUrl?: string | null
  videoThumbnailUrl?: string | null
  likeCount: number
  dislikeCount: number
  commentCount: number
  bookmarkCount: number
  quoteCount: number
  viewCount: number
  createdAt: string
  isQuote: boolean
  quotedPostId?: string | null
  quotedPost?: QuotedPost | null
  relation?: string | null
  myReaction?: 'like' | 'dislike' | null
}

export interface QuotedPost {
  id: string
  author: PostAuthor
  body: string
  title?: string
  createdAt: string
}

// ─────────────────────────────────────────────
// 5. 댓글
// ─────────────────────────────────────────────

export interface Comment {
  id: string
  postId: string
  parentId?: string | null
  author: PostAuthor
  body: string
  likeCount: number
  dislikeCount: number
  createdAt: string
  myReaction?: 'like' | 'dislike' | null
}

export type Reaction = 'like' | 'dislike'
