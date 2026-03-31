// ================================================================
// Heavy Scraper (Hard Track) — Puppeteer 기반 무거운 크롤러
// 날짜: 2026-03-31
// 용도: 봇 차단이 빡센 사이트 크롤링 (네이버 카페, 디시, 더쿠 등)
//
// [아키텍처]
// - Vercel 서버리스에서는 돌릴 수 없음 (메모리/타임아웃 한계)
// - 로컬 또는 외부 서버(VPS)에서 Node.js 스크립트로 실행
// - 하루 2번 (아침 8시, 저녁 8시) cron으로 돌림
// - 긁어온 데이터는 Supabase content_backlog에 직접 INSERT
//
// [실행 방법]
// npx ts-node lib/scrapers/heavy-scraper.ts
// 또는 crontab: 0 8,20 * * * cd /path/to/biztask && npx ts-node lib/scrapers/heavy-scraper.ts
//
// [의존성 — 별도 설치 필요]
// npm install puppeteer @supabase/supabase-js dotenv
// (puppeteer-core + browserless API도 가능 — 아래 주석 참고)
// ================================================================

// ─── 타겟 사이트 설정 ───
// 아직 구현하지 않은 Hard Track 타겟들
// 실제 구현 시 각 사이트의 HTML 구조를 Puppeteer로 분석한 뒤 셀렉터 채워야 함
export interface HeavyScraperTarget {
  name: string;               // 크롤러 이름
  category: string;           // 카테고리 (humor, business, car 등)
  contentType: "qa" | "news" | "humor";  // 조건부 렌더링용
  url: string;                // 크롤링 시작 URL
  loginRequired: boolean;     // 로그인 필요 여부 (네이버 카페)
  selectors: {
    listItem: string;         // 글 목록 아이템
    listLink: string;         // 링크
    listTitle: string;        // 제목
    contentBody: string;      // 본문
    contentImages: string;    // 이미지
    commentItem: string;      // 댓글 아이템
    commentText: string;      // 댓글 텍스트
  };
}

// ─── Hard Track 타겟 목록 ───
// 실제 크롤링 구현 시 셀렉터를 하나씩 검증하며 채워넣을 것
export const HEAVY_TARGETS: HeavyScraperTarget[] = [
  // ────────────────────────────────────────────
  // 더쿠 — 핫게시판
  // 봇 차단: CloudFlare Turnstile + JS 렌더링 필수
  // ────────────────────────────────────────────
  {
    name: "더쿠 핫게",
    category: "humor",
    contentType: "humor",
    url: "https://theqoo.net/hot",
    loginRequired: false,
    selectors: {
      listItem: "li.li_best2_pop0",         // TODO: Puppeteer로 검증 필요
      listLink: "a",
      listTitle: "a",
      contentBody: ".xe_content",
      contentImages: ".xe_content img",
      commentItem: ".fdb_lst_ul li",
      commentText: ".xe_content",
    },
  },

  // ────────────────────────────────────────────
  // 웃긴대학 — 월간베스트
  // 봇 차단: 레거시 사이트, euc-kr 인코딩, JS 필수
  // ────────────────────────────────────────────
  {
    name: "웃대 월베",
    category: "humor",
    contentType: "humor",
    url: "https://web.humoruniv.com/board/humor/list.html?table=pds&pg=0&kind=best&duration=monthly",
    loginRequired: false,
    selectors: {
      listItem: "#post_list tr",              // TODO: 검증 필요
      listLink: "a.li_sbj",
      listTitle: "a.li_sbj",
      contentBody: "#cnts",
      contentImages: "#cnts img",
      commentItem: ".re_box",
      commentText: ".re_txt",
    },
  },

  // ────────────────────────────────────────────
  // 아프니까 사장이다 — 네이버 카페 인기글
  // 봇 차단: 네이버 로그인 필수 + iframe 구조
  // ────────────────────────────────────────────
  {
    name: "아프니까 사장이다",
    category: "business",
    contentType: "qa",
    url: "https://cafe.naver.com/siusowners",
    loginRequired: true,      // ⚠️ 네이버 로그인 필요
    selectors: {
      listItem: ".article-board-list .inner_list",  // TODO: iframe 내부
      listLink: "a.article",
      listTitle: "a.article",
      contentBody: ".se-main-container",
      contentImages: ".se-main-container img",
      commentItem: ".comment_area .comment_box",
      commentText: ".text_comment",
    },
  },

  // ────────────────────────────────────────────
  // 자영업자의 쉼터 — 네이버 카페 인기글
  // 봇 차단: 네이버 로그인 필수 + iframe 구조
  // ────────────────────────────────────────────
  {
    name: "자영업자의 쉼터",
    category: "business",
    contentType: "qa",
    url: "https://cafe.naver.com/joyfulrest",
    loginRequired: true,
    selectors: {
      listItem: ".article-board-list .inner_list",
      listLink: "a.article",
      listTitle: "a.article",
      contentBody: ".se-main-container",
      contentImages: ".se-main-container img",
      commentItem: ".comment_area .comment_box",
      commentText: ".text_comment",
    },
  },
];

// ================================================================
// Heavy Scraper 실행 함수 (스캐폴딩)
// ─── 실제 구현은 Puppeteer 설치 후 단계별로 진행 ───
// ================================================================

/**
 * Heavy Scraper 메인 실행 함수
 * Puppeteer로 브라우저를 띄워서 인간처럼 순회하며 크롤링
 *
 * @param target - 크롤링 대상 설정
 * @returns 수집된 글 수
 *
 * [구현 예정 흐름]
 * 1. puppeteer.launch({ headless: "new" })
 * 2. 네이버 카페면 로그인 처리
 * 3. 목록 페이지 이동 → waitForSelector
 * 4. 글 목록 파싱 (최대 5개)
 * 5. 각 글 상세 페이지 이동
 * 6. 본문 + 이미지 + 댓글 5개 수집
 * 7. Supabase content_backlog에 INSERT (is_published=false)
 * 8. 랜덤 딜레이 (2~5초) — 봇 감지 회피
 */
export async function runHeavyScraper(target: HeavyScraperTarget): Promise<number> {
  console.log(`[Heavy Scraper] ⚠️ 아직 구현 전 — ${target.name}`);
  console.log(`[Heavy Scraper] URL: ${target.url}`);
  console.log(`[Heavy Scraper] 로그인 필요: ${target.loginRequired}`);
  console.log(`[Heavy Scraper] Puppeteer 설치 후 구현 예정`);

  // TODO: 실제 Puppeteer 구현
  // const browser = await puppeteer.launch({ headless: "new" });
  // const page = await browser.newPage();
  // ...

  return 0;
}

// ─── 직접 실행 시 (npx ts-node heavy-scraper.ts) ───
// Node.js에서 직접 실행할 때만 작동
// Vercel 서버리스에서는 이 파일을 import만 하므로 실행 안 됨
const isDirectExecution =
  typeof require !== "undefined" &&
  require.main === module;

if (isDirectExecution) {
  console.log("=== Heavy Scraper (Hard Track) 직접 실행 ===");
  console.log(`타겟 수: ${HEAVY_TARGETS.length}개`);
  console.log("아직 스캐폴딩 단계입니다. Puppeteer 설치 후 구현 예정.");

  // 향후: 모든 타겟 순회하며 크롤링
  // for (const target of HEAVY_TARGETS) {
  //   await runHeavyScraper(target);
  //   await sleep(randomBetween(3000, 8000)); // 봇 감지 회피
  // }
}
