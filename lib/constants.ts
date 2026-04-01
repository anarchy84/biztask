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

// ─── 긱뉴스 전용 랜덤 카테고리 배분 (2026-04-01 조정) ───
// 긱뉴스는 AI/기술 뉴스 소스
// AI 50% / 마케팅 20% / 사업 20% / 자유 10%
// → AI 정체성 유지 + 마케팅/사업 보조 공급원 역할
export function getGeeknewsCategory(): string {
  const rand = Math.random() * 100;
  if (rand < 50) return "ai";         // 50% → AI 토론방
  if (rand < 70) return "marketing";  // 20% → 마케팅/사업 25% 목표 보조
  if (rand < 90) return "business";   // 20%
  return "free";                       // 10%
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

// ================================================================
// 커뮤니티 활성화 시스템 (2026-04-01)
// NPC들이 개별 커뮤니티에서도 활동하도록 하는 매핑/비중 설정
// ================================================================

// ─── 개별 커뮤니티 ID 상수 ───
export const COMMUNITY_IDS = {
  자동차매니아: "acc85d23-5cb1-43c9-a86b-96464a5e79d0",
  마케팅연구소: "c5a698b8-8047-41cf-83cb-548eca27e2e1",
  사업창업: "51c60f49-c1ba-407b-9de2-396657f15102",
  AI토론방: "e92e136f-df36-4c8c-a5ad-cb8d999649b9",
} as const;

// ─── 활성 커뮤니티 목록 (랜덤 선택용) ───
export const ACTIVE_COMMUNITIES = [
  { id: COMMUNITY_IDS.자동차매니아, name: "자동차매니아", slug: "car-mania", topics: ["자동차", "전기차", "테슬라", "드라이브", "차량관리"] },
  { id: COMMUNITY_IDS.마케팅연구소, name: "초보를 위한 마케팅 연구소", slug: "marketing-lab", topics: ["마케팅", "SNS", "광고", "퍼포먼스", "브랜딩"] },
  { id: COMMUNITY_IDS.사업창업, name: "사업/창업 이야기", slug: "business-talk", topics: ["창업", "사업", "경영", "자금", "매출"] },
  { id: COMMUNITY_IDS.AI토론방, name: "초급 AI 실전 토론방", slug: "ai-talk", topics: ["AI", "ChatGPT", "자동화", "프롬프트", "GPT"] },
];

// ─── NPC 페르소나 ↔ 커뮤니티 친화도 매핑 ───
// communityWeight: 해당 NPC가 커뮤니티에 글 쓸 확률 (나머지는 글로벌)
// preferred: 우선 활동 커뮤니티 ID 목록 (가중치 순)
// 미등록 NPC는 기본값 적용 (글로벌 60% / 커뮤니티 40%)
export const NPC_COMMUNITY_AFFINITY: Record<string, {
  communityWeight: number;  // 0~1, 커뮤니티에 글 쓸 확률 (예: 0.7 = 70%)
  preferred: { id: string; weight: number }[];  // 선호 커뮤니티 + 가중치
}> = {
  // ─── 자동차 친화 NPC ───
  "벤츠타는궁수": {
    communityWeight: 0.70,  // 자동차 커뮤니티 70% / 글로벌 30%
    preferred: [
      { id: COMMUNITY_IDS.자동차매니아, weight: 0.85 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.15 },
    ],
  },
  // ─── 사업/경영 친화 NPC ───
  "인사이트호소인": {
    communityWeight: 0.50,
    preferred: [
      { id: COMMUNITY_IDS.사업창업, weight: 0.50 },
      { id: COMMUNITY_IDS.AI토론방, weight: 0.30 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.20 },
    ],
  },
  "점주님": {
    communityWeight: 0.45,
    preferred: [
      { id: COMMUNITY_IDS.사업창업, weight: 0.70 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.30 },
    ],
  },
  "자영업은지옥": {
    communityWeight: 0.50,
    preferred: [
      { id: COMMUNITY_IDS.사업창업, weight: 0.80 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.20 },
    ],
  },
  "납품아재": {
    communityWeight: 0.40,
    preferred: [
      { id: COMMUNITY_IDS.사업창업, weight: 0.70 },
      { id: COMMUNITY_IDS.자동차매니아, weight: 0.30 },
    ],
  },
  // ─── 마케팅 친화 NPC ───
  "광고충": {
    communityWeight: 0.50,
    preferred: [
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.70 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.30 },
    ],
  },
  "지표의노예": {
    communityWeight: 0.45,
    preferred: [
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.60 },
      { id: COMMUNITY_IDS.AI토론방, weight: 0.40 },
    ],
  },
  "MZ사장": {
    communityWeight: 0.45,
    preferred: [
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.40 },
      { id: COMMUNITY_IDS.AI토론방, weight: 0.35 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.25 },
    ],
  },
  // ─── AI 친화 NPC ───
  "AGI만세": {
    communityWeight: 0.60,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.90 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.10 },
    ],
  },
  "헤비업로더": {
    communityWeight: 0.55,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.80 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.20 },
    ],
  },
  "프로불편러": {
    communityWeight: 0.50,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.75 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.25 },
    ],
  },
  "AI궁금한사장": {
    communityWeight: 0.55,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.70 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.30 },
    ],
  },
  "프롬프트좀요": {
    communityWeight: 0.55,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.65 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.35 },
    ],
  },
  "쉽게설명좀": {
    communityWeight: 0.50,
    preferred: [
      { id: COMMUNITY_IDS.AI토론방, weight: 0.80 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.20 },
    ],
  },
  // ─── 유머/자유 중심 NPC (글로벌 비중 높음) ───
  "에반참치": {
    communityWeight: 0.20,  // 유머 80% 글로벌 / 커뮤니티 20%
    preferred: [
      { id: COMMUNITY_IDS.자동차매니아, weight: 0.40 },
      { id: COMMUNITY_IDS.사업창업, weight: 0.30 },
      { id: COMMUNITY_IDS.마케팅연구소, weight: 0.30 },
    ],
  },
  "짤방사냥꾼": {
    communityWeight: 0.20,
    preferred: [
      { id: COMMUNITY_IDS.자동차매니아, weight: 0.50 },
      { id: COMMUNITY_IDS.AI토론방, weight: 0.50 },
    ],
  },
  "편의점빌런": {
    communityWeight: 0.25,
    preferred: [
      { id: COMMUNITY_IDS.사업창업, weight: 0.60 },
      { id: COMMUNITY_IDS.자동차매니아, weight: 0.40 },
    ],
  },
};

// ─── NPC 커뮤니티 타겟 선택 헬퍼 ───
// 페르소나 닉네임 기반으로 글로벌 vs 커뮤니티 결정 + 커뮤니티 ID 반환
// 반환값: null이면 글로벌 피드, string이면 해당 커뮤니티 ID
export function pickNpcCommunityTarget(nickname: string): string | null {
  const affinity = NPC_COMMUNITY_AFFINITY[nickname];

  // 미등록 NPC → 기본 40% 확률로 랜덤 커뮤니티
  if (!affinity) {
    if (Math.random() < 0.40) {
      return pickRandom(ACTIVE_COMMUNITIES).id;
    }
    return null;
  }

  // 커뮤니티 활동 여부 결정 (communityWeight 확률)
  if (Math.random() >= affinity.communityWeight) {
    return null; // 글로벌 피드에 작성
  }

  // 선호 커뮤니티 중 가중치 기반 랜덤 선택
  const roll = Math.random();
  let cumulative = 0;
  for (const pref of affinity.preferred) {
    cumulative += pref.weight;
    if (roll < cumulative) return pref.id;
  }

  // 폴백: 마지막 선호 커뮤니티
  return affinity.preferred[affinity.preferred.length - 1]?.id || null;
}

// ─── 스크래퍼 키워드 → 커뮤니티 자동 매핑 ───
// 제목/본문에 특정 키워드가 포함되면 해당 커뮤니티로 자동 배치
export const KEYWORD_COMMUNITY_MAP: Array<{
  keywords: string[];
  communityId: string;
  communityName: string;
}> = [
  {
    keywords: ["전기차", "테슬라", "자동차", "현대차", "기아", "SUV", "자율주행", "EV", "하이브리드", "벤츠", "BMW", "아우디", "충전소"],
    communityId: COMMUNITY_IDS.자동차매니아,
    communityName: "자동차매니아",
  },
  {
    keywords: ["ChatGPT", "GPT-5", "클로드", "제미나이", "LLM", "프롬프트", "오픈AI", "AI 에이전트", "RAG", "파인튜닝"],
    communityId: COMMUNITY_IDS.AI토론방,
    communityName: "초급 AI 실전 토론방",
  },
];

// ─── 키워드 매칭 헬퍼: 제목+본문에서 커뮤니티 매칭 ───
// 매칭되면 communityId, 아니면 null (기존 카테고리 매핑 유지)
export function matchKeywordToCommunity(title: string, content: string): string | null {
  const text = `${title} ${content}`.toLowerCase();
  for (const mapping of KEYWORD_COMMUNITY_MAP) {
    for (const kw of mapping.keywords) {
      if (text.includes(kw.toLowerCase())) {
        return mapping.communityId;
      }
    }
  }
  return null;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
