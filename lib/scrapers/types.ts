// ================================================================
// 콘텐츠 팜 — 공통 타입 정의
// 날짜: 2026-03-30
// 용도: 스크래퍼, 리라이터, API 라우트에서 공통으로 사용하는 타입
// ================================================================

// ─── 스크래핑한 원본 기사 1건 ───
export interface ScrapedArticle {
  sourceUrl: string;        // 원본 글 URL (중복 체크 키)
  sourceTitle: string;      // 원본 제목
  sourceBody: string;       // 원본 본문 (HTML 태그 제거된 텍스트)
  sourceImages: string[];   // 원본 이미지 URL 배열
  sourceComments: string[]; // 원본 게시글의 실제 유저 댓글 (최대 5개, Few-Shot용)
  sourceSite: string;       // 출처 사이트명 (예: '아이보스')
  category: string;         // 카테고리 (예: 'marketing', 'tax')
  // ─── 콘텐츠 타입 (Project DNA: 조건부 렌더링용) ───
  // 'qa' = 질문글 → 원본 그대로 포스팅 + NPC 고수 댓글
  // 'news' = 뉴스/정보글 → 3줄 요약 + 시니컬 한줄평
  // 'humor' = 유머글 → 기존 음슴체 리라이팅
  contentType: "qa" | "news" | "humor";
  scrapedAt: string;        // 수집 시각 (ISO 문자열)
}

// ─── 스크래퍼 인터페이스 (팩토리 패턴용) ───
// 새 사이트를 추가할 때 이 인터페이스를 구현하면 됨
export interface Scraper {
  // 스크래퍼 이름 (로그용)
  name: string;
  // 담당 카테고리
  category: string;
  // 1단계: 글 목록 가져오기 (URL + 제목만)
  fetchList(): Promise<Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[]>;
  // 2단계: 개별 글 본문 파싱
  parseContent(url: string, title: string): Promise<ScrapedArticle | null>;
}

// ─── DB에 저장된 scraped_sources 행 타입 ───
export interface ScrapedSource {
  id: string;
  source_url: string;
  source_site: string;
  source_title: string;
  source_body: string | null;
  source_images: string[];
  source_comments: string[];  // 원본 유저 댓글 (Few-Shot용)
  category: string;
  status: "pending" | "rewriting" | "posted" | "failed" | "skipped";
  assigned_persona_id: string | null;
  assigned_community_id: string | null;
  result_post_id: string | null;
  rewritten_title: string | null;
  rewritten_body: string | null;
  error_message: string | null;
  scraped_at: string;
  rewritten_at: string | null;
  posted_at: string | null;
}

// ─── 리라이팅 결과 ───
export interface RewriteResult {
  title: string;          // AI가 다시 쓴 제목
  body: string;           // AI가 다시 쓴 본문
  provider: string;       // 어떤 AI가 썼는지 (gemini, anthropic, openai)
}

// ─── 스크래퍼 크론 실행 결과 요약 ───
export interface ScraperCronSummary {
  scraperName: string;        // 어떤 스크래퍼가 실행됐는지
  category: string;           // 카테고리
  articlesFound: number;      // 발견한 기사 수
  newArticles: number;        // 중복 제거 후 새 기사 수
  rewritten: number;          // 리라이팅 성공 수
  posted: number;             // 게시 성공 수
  failed: number;             // 실패 수
  skipped: number;            // 건너뛴 수 (중복 등)
  errors: string[];           // 에러 메시지 모음
}
