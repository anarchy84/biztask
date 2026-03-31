// ================================================================
// 글로벌 카테고리 상수 — 시스템 전역에서 사용하는 카테고리 기준
// 날짜: 2026-03-31
//
// [규칙]
// 1. 프론트엔드(글쓰기 모달, 사이드바)와 백엔드(스크래퍼, 발행)가
//    반드시 이 상수를 import해서 사용해야 함
// 2. 카테고리 추가/삭제 시 이 파일만 수정하면 전체 시스템에 반영
// 3. slug는 DB에 저장되는 영어 키, label은 UI에 표시되는 한국어
// ================================================================

// ─── 공식 카테고리 6개 (이 외의 카테고리는 시스템에서 허용하지 않음) ───
export const CATEGORIES = [
  { slug: "free",      label: "자유" },
  { slug: "qa",        label: "질문" },
  { slug: "business",  label: "사업" },
  { slug: "marketing", label: "마케팅" },
  { slug: "sidejob",   label: "부업" },
  { slug: "humor",     label: "유머" },
  { slug: "ai",        label: "AI" },
] as const;

// ─── slug 배열 (DB 쿼리, 벨리데이션 등에 사용) ───
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

// ─── label 배열 (프론트엔드 UI 렌더링에 사용) ───
export const CATEGORY_LABELS = CATEGORIES.map((c) => c.label);

// ─── slug → label 변환 맵 ───
export const SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label])
);

// ─── label → slug 변환 맵 ───
export const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.label, c.slug])
);

// ─── 스크래퍼 내부 카테고리 → 공식 slug 매핑 ───
// 스크래퍼가 수집할 때 사용하는 내부 코드를 공식 6개 카테고리로 강제 변환
// ※ "car"(자동차)는 별도 탭이 없으므로 "free"로 편입
// ※ "ai"는 AI 전용 게시판으로 매핑
export const SCRAPER_CATEGORY_MAP: Record<string, string> = {
  humor: "humor",         // 유머 → 유머
  car: "free",            // 자동차 → 자유 (별도 자동차 탭 없음)
  qa: "qa",               // 질문답변 → 질문
  marketing: "marketing", // 마케팅 → 마케팅
  business: "business",   // 사업 → 사업
  ai: "ai",               // AI → AI (AI 전용 게시판)
  free: "free",           // 자유 → 자유
  sidejob: "sidejob",     // 부업 → 부업
  // geeknews는 고정 매핑 없음 → getGeeknewsCategory()로 랜덤 매핑
};

// ─── 긱뉴스 전용 랜덤 카테고리 배분 ───
// 비율: AI 50% / 자유 20% / 사업 15% / 마케팅 15%
// 긱뉴스는 AI/기술 뉴스 중심이므로 AI 게시판 비중 높게 설정
export function getGeeknewsCategory(): string {
  const rand = Math.random() * 100;
  if (rand < 50) return "ai";         // 50%
  if (rand < 70) return "free";       // 20%
  if (rand < 85) return "business";   // 15%
  return "marketing";                  // 15%
}

// ─── 카테고리별 UI 색상 (배경 + 텍스트) ───
// PostCard, FeaturedSlider, TrendingSidebar에서 공통으로 사용
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  free:      { bg: "bg-amber-500/20",   text: "text-amber-400",   badge: "bg-amber-500" },
  qa:        { bg: "bg-green-500/20",   text: "text-green-400",   badge: "bg-green-500" },
  business:  { bg: "bg-primary/20",     text: "text-primary-light", badge: "bg-primary" },
  marketing: { bg: "bg-purple-500/20",  text: "text-purple-400",  badge: "bg-purple-600" },
  sidejob:   { bg: "bg-cyan-500/20",    text: "text-cyan-400",    badge: "bg-cyan-500" },
  humor:     { bg: "bg-rose-500/20",    text: "text-rose-400",    badge: "bg-rose-500" },
  ai:        { bg: "bg-blue-500/20",    text: "text-blue-400",    badge: "bg-blue-500" },
};

// ─── 카테고리 → 커뮤니티 ID 매핑 (NPC 발행 시 사용) ───
// null이면 커뮤니티 없이 일반 피드에만 노출
export const CATEGORY_COMMUNITY_MAP: Record<string, string | null> = {
  free: null,
  qa: "c5a698b8-8047-41cf-83cb-548eca27e2e1",          // 초보를 위한 마케팅 연구소
  business: "51c60f49-c1ba-407b-9de2-396657f15102",     // 사업/창업 이야기
  marketing: "c5a698b8-8047-41cf-83cb-548eca27e2e1",    // 초보를 위한 마케팅 연구소
  sidejob: null,
  humor: null,
  ai: "e92e136f-df36-4c8c-a5ad-cb8d999649b9",          // 초급 Ai 실전 토론방
};
