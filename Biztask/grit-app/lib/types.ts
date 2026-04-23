// 한글 주석: GRIT 앱 공통 타입 정의
// 이 파일은 앱 전반에서 쓰는 데이터 모델을 한 곳에 모아둔 것.
// Supabase 테이블 스키마랑 1:1 매핑이 아니라, "UI가 쓰는 모양"으로 가공한 타입들이야.
// 나중에 Supabase 연동 들어가면 lib/supabase/types.ts (자동 생성)랑 매퍼로 연결한다.

// ─────────────────────────────────────────────
// 1. 업종 (Industry)
// ─────────────────────────────────────────────
// 한글 주석: 카페/음식점/미용/유통/온라인/서비스/기타 등 10종.
//   - 각 업종마다 고유 컬러를 부여해서 피드에서 한눈에 구분되게 만든다.
//   - 블라인드가 "회사명"을 보여주듯, 우리는 "업종"으로 정체성을 드러낸다.

export type Industry =
  | 'cafe'       // 카페·디저트
  | 'food'       // 음식점·외식
  | 'beauty'     // 미용·뷰티
  | 'retail'     // 유통·판매
  | 'online'     // 온라인·이커머스
  | 'service'    // 서비스업
  | 'education'  // 교육·강의
  | 'health'     // 건강·헬스
  | 'creative'   // 크리에이티브·1인사업
  | 'etc'        // 기타

// 한글 주석: 업종별 한글 라벨과 배지 컬러 매핑.
//   - 배지 컬러는 파스텔 톤으로 은은하게 (너무 튀면 본문이 안 읽힘).
//   - 텍스트 컬러는 충분히 진하게 해서 대비 확보 (WCAG AA 기준 4.5:1).
export const INDUSTRY_META: Record<
  Industry,
  { label: string; bg: string; fg: string }
> = {
  cafe:      { label: '카페',     bg: '#FEF3E8', fg: '#92400E' },
  food:      { label: '음식점',   bg: '#FEF2F2', fg: '#991B1B' },
  beauty:    { label: '미용',     bg: '#FDF2F8', fg: '#9D174D' },
  retail:    { label: '유통',     bg: '#F0FDF4', fg: '#166534' },
  online:    { label: '온라인',   bg: '#EFF6FF', fg: '#1E40AF' },
  service:   { label: '서비스',   bg: '#F5F3FF', fg: '#5B21B6' },
  education: { label: '교육',     bg: '#FFFBEB', fg: '#854D0E' },
  health:    { label: '건강',     bg: '#ECFEFF', fg: '#155E75' },
  creative:  { label: '1인사업',  bg: '#FFF7ED', fg: '#9A3412' },
  etc:       { label: '기타',     bg: '#F4F4F5', fg: '#3F3F46' },
}

// ─────────────────────────────────────────────
// 2. 카테고리 (상단 횡스크롤 탭)
// ─────────────────────────────────────────────
// 한글 주석: "전체/인기/유머/고민/질문/팁" 같은 피드 필터.
//   - 블라인드의 상단 탭이랑 비슷한 역할.
//   - 기본값은 'all' (전체 피드).

export type Category =
  | 'all'       // 전체
  | 'hot'       // 실시간 인기
  | 'humor'     // 유머
  | 'worry'     // 고민
  | 'question'  // 질문
  | 'tip'       // 꿀팁

export const CATEGORY_LABELS: Record<Category, string> = {
  all:      '전체',
  hot:      '🔥 실시간',
  humor:    '유머',
  worry:    '고민',
  question: '질문',
  tip:      '꿀팁',
}

// ─────────────────────────────────────────────
// 3. 작성자 (Post / Comment 공통)
// ─────────────────────────────────────────────
// 한글 주석: NPC든 실제 유저든 동일한 모양으로 취급한다.
//   - isNpc 필드는 "내부 운영용"이고 UI에는 절대 노출 X (원칙).
//   - 닉네임 + 업종 조합이 블라인드 "직장인/회사명"의 역할을 한다.

export interface PostAuthor {
  id: string
  nickname: string        // 예: "김치찌개사장"
  industry: Industry      // 업종 배지용
  isNpc?: boolean         // 운영용 플래그 (UI 노출 금지)
}

// ─────────────────────────────────────────────
// 4. 게시글 (Post)
// ─────────────────────────────────────────────
// 한글 주석: 피드 카드 한 장에 필요한 데이터.
//   - thumbnailUrl은 선택 (없으면 우측 썸네일 영역 숨김).
//   - likeCount / dislikeCount는 좋아요/싫어요 카운터.
//   - commentCount는 댓글 수.
//   - viewCount는 조회수 (Phase 2에서 구현).

export interface Post {
  id: string
  author: PostAuthor
  category: Category
  title: string
  body: string                // 본문 (피드에선 2줄만 미리보기)
  thumbnailUrl?: string       // 첨부 이미지 썸네일 (선택)
  likeCount: number
  dislikeCount: number
  commentCount: number
  viewCount: number
  createdAt: string           // ISO 8601
  // 내가 누른 상태 (로그인 유저 기준, 비로그인이면 undefined)
  myReaction?: 'like' | 'dislike' | null
}

// ─────────────────────────────────────────────
// 5. 댓글 (Comment)
// ─────────────────────────────────────────────
// 한글 주석: 댓글도 좋아요/싫어요가 붙는다 (블라인드처럼).
//   - parentId가 있으면 대댓글 (Phase 2에서 UI 추가).
//   - 댓글 하나당 깊이 2단계까지만 허용 예정.

export interface Comment {
  id: string
  postId: string
  parentId?: string | null    // null이면 최상위 댓글
  author: PostAuthor
  body: string
  likeCount: number
  dislikeCount: number
  createdAt: string
  myReaction?: 'like' | 'dislike' | null
}

// ─────────────────────────────────────────────
// 6. 반응 타입 (좋아요/싫어요 토글용)
// ─────────────────────────────────────────────

export type Reaction = 'like' | 'dislike'
