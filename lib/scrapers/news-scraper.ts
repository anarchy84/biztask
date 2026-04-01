// ================================================================
// 뉴스클리핑 프로젝트 — 뉴스 스크래퍼 (v2 — 7개 소스 확정)
// 날짜: 2026-04-01
// 용도: 구글 뉴스 RSS 6개 + 아이보스 HTML 1개에서 기사 수집
//       → news_articles 테이블에 저장
//       → 이후 AI 카테고리 분류 → 클러스터링 → news_clips 생성
//
// [데이터 소스 7개]
// 1. 아이보스 마케팅 뉴스/칼럼 (HTML)
// 2. 구글 뉴스 - 비즈니스 섹션 (RSS)
// 3. 구글 뉴스 - 과학/기술 섹션 (RSS)
// 4. 구글 뉴스 - 검색: 마케팅 (RSS)
// 5. 구글 뉴스 - 검색: 소상공인 (RSS)
// 6. 구글 뉴스 - 검색: 중소기업 (RSS)
// 7. 구글 뉴스 - 검색: 광고 (RSS)
//
// [카테고리 4종]
// marketing_biz: 마케팅/사업
// tech_ai: 기술/AI
// smallbiz: 소상공인/중소기업
// ad_trend: 광고/트렌드
// ================================================================

import { generateAntiBotHeaders, randomJitter, getSmartReferer } from "./anti-bot";

// ─── 수집된 뉴스 기사 1건 (news_articles 테이블 INSERT용) ───
export interface NewsArticle {
  title: string;          // 기사 제목
  link: string;           // 기사 원본 URL (중복 체크 키)
  source_name: string;    // 언론사명 (예: '한겨레', '조선일보')
  thumbnail_url: string | null;  // 기사 썸네일
  snippet: string | null;        // 기사 본문 일부/요약
  published_at: string | null;   // 기사 발행일 (ISO 문자열)
  feed_source: string;    // 수집 출처 ('google_news', 'iboss')
  category: string;       // 카테고리 (marketing_biz, tech_ai, smallbiz, ad_trend)
}

// ─── AI 클러스터링 결과 타입 ───
export interface ClusteringResult {
  headline: string;         // AI가 만든 핵심 헤드라인
  summary: string;          // 3줄 요약
  category: string;         // 카테고리
  articleIds: string[];     // 이 클러스터에 소속된 news_articles.id 배열
  thumbnailUrl: string | null;  // 대표 썸네일
}

// ─── 구글 뉴스 RSS 피드 설정 ───
interface GoogleNewsFeedConfig {
  name: string;       // 피드 이름 (로그용)
  feedUrl: string;    // RSS URL
  category: string;   // 기본 카테고리 (AI 재분류 전 초기값)
  maxItems: number;   // 최대 수집 기사 수
}

// ================================================================
// ★ 확정된 7개 데이터 소스 (6개 RSS + 1개 HTML)
// ================================================================

// ─── 구글 뉴스 RSS 피드 6개 ───
// 구글 뉴스 URL → RSS 변환 규칙:
// topics URL: /topics/XXX → /rss/topics/XXX?hl=ko&gl=KR&ceid=KR:ko
// search URL: /search?q=XXX → /rss/search?q=XXX&hl=ko&gl=KR&ceid=KR:ko
export const GOOGLE_NEWS_FEEDS: GoogleNewsFeedConfig[] = [
  // ─── [소스 2] 구글 뉴스 비즈니스 섹션 ───
  {
    name: "구글뉴스-비즈니스",
    feedUrl:
      "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko",
    category: "marketing_biz",
    maxItems: 15,
  },
  // ─── [소스 3] 구글 뉴스 과학/기술 섹션 ───
  {
    name: "구글뉴스-과학기술",
    feedUrl:
      "https://news.google.com/rss/topics/CAAqKAgKIiJDQkFTRXdvSkwyMHZNR1ptZHpWbUVnSnJieG9DUzFJb0FBUAE?hl=ko&gl=KR&ceid=KR:ko",
    category: "tech_ai",
    maxItems: 15,
  },
  // ─── [소스 4] 구글 뉴스 검색: 마케팅 ───
  {
    name: "구글뉴스-검색-마케팅",
    feedUrl:
      "https://news.google.com/rss/search?q=%EB%A7%88%EC%BC%80%ED%8C%85&hl=ko&gl=KR&ceid=KR:ko",
    category: "marketing_biz",
    maxItems: 10,
  },
  // ─── [소스 5] 구글 뉴스 검색: 소상공인 ───
  {
    name: "구글뉴스-검색-소상공인",
    feedUrl:
      "https://news.google.com/rss/search?q=%EC%86%8C%EC%83%81%EA%B3%B5%EC%9D%B8&hl=ko&gl=KR&ceid=KR:ko",
    category: "smallbiz",
    maxItems: 10,
  },
  // ─── [소스 6] 구글 뉴스 검색: 중소기업 ───
  {
    name: "구글뉴스-검색-중소기업",
    feedUrl:
      "https://news.google.com/rss/search?q=%EC%A4%91%EC%86%8C%EA%B8%B0%EC%97%85&hl=ko&gl=KR&ceid=KR:ko",
    category: "smallbiz",
    maxItems: 10,
  },
  // ─── [소스 7] 구글 뉴스 검색: 광고 ───
  {
    name: "구글뉴스-검색-광고",
    feedUrl:
      "https://news.google.com/rss/search?q=%EA%B4%91%EA%B3%A0&hl=ko&gl=KR&ceid=KR:ko",
    category: "ad_trend",
    maxItems: 10,
  },
];

// ─── [소스 1] 아이보스 마케팅 뉴스/칼럼 (HTML) ───
const IBOSS_CONFIG = {
  name: "아이보스-마케팅뉴스칼럼",
  listUrl: "https://www.i-boss.co.kr/ab-2876",
  baseUrl: "https://www.i-boss.co.kr",
  category: "marketing_biz",
  maxItems: 15,
};

// ================================================================
// 유틸 함수
// ================================================================

// ─── HTML 태그 제거 ───
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── 구글 뉴스 제목에서 언론사명 분리 ───
// 구글 뉴스 제목 형식: "기사 제목 - 언론사명"
function extractSourceFromTitle(title: string): { cleanTitle: string; sourceName: string } {
  const lastDash = title.lastIndexOf(" - ");
  if (lastDash > 0) {
    return {
      cleanTitle: title.substring(0, lastDash).trim(),
      sourceName: title.substring(lastDash + 3).trim(),
    };
  }
  return { cleanTitle: title, sourceName: "알 수 없음" };
}

// ================================================================
// 1. 구글 뉴스 RSS 스크래퍼
// ================================================================

export async function scrapeGoogleNews(config: GoogleNewsFeedConfig): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const Parser = (await import("rss-parser")).default;
    const parser = new Parser({
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    console.log(`[뉴스클리핑] ${config.name} RSS 로딩: ${config.feedUrl.slice(0, 80)}...`);
    const feed = await parser.parseURL(config.feedUrl);
    const items = (feed.items || []).slice(0, config.maxItems);

    console.log(`[뉴스클리핑] ${config.name}: ${items.length}개 기사 발견`);

    for (const item of items) {
      if (!item.link || !item.title) continue;

      // 한글 기사만 수집
      if (!/[가-힣]/.test(item.title)) continue;

      // 구글 뉴스 제목에서 언론사명 분리
      const { cleanTitle, sourceName } = extractSourceFromTitle(item.title);

      // RSS description에서 snippet 추출
      const snippet = item.contentSnippet
        ? stripHtml(item.contentSnippet).slice(0, 300)
        : null;

      // 발행일 파싱
      const publishedAt = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : null;

      // 구글 뉴스 이미지는 media:content에서 가져오기 시도
      const mediaContent = (item as Record<string, unknown>)["media:content"] as
        | { $?: { url?: string } }
        | undefined;
      const thumbnailUrl = mediaContent?.$?.url || null;

      articles.push({
        title: cleanTitle,
        link: item.link,
        source_name: sourceName,
        thumbnail_url: thumbnailUrl,
        snippet,
        published_at: publishedAt,
        feed_source: "google_news",
        category: config.category,
      });
    }

    console.log(`[뉴스클리핑] ${config.name}: ${articles.length}개 기사 수집 완료`);
  } catch (err) {
    console.error(
      `[뉴스클리핑] ${config.name} 스크래핑 실패:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  return articles;
}

// ================================================================
// 2. 아이보스 마케팅 뉴스/칼럼 스크래퍼 (HTML)
// ================================================================
// 아이보스 ab-2876: 마케팅 뉴스/칼럼 게시판
// 게시판 형태 (테이블 기반) — 제목, 링크, 작성자(=언론사/칼럼니스트)

export async function scrapeIbossNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const cheerio = await import("cheerio");

    // 봇 차단 우회: 랜덤 딜레이 + Anti-Bot 헤더
    await randomJitter(500, 1500);
    const headers = {
      ...generateAntiBotHeaders(),
      Referer: getSmartReferer(IBOSS_CONFIG.baseUrl),
    };

    console.log(`[뉴스클리핑] ${IBOSS_CONFIG.name} 페이지 로딩: ${IBOSS_CONFIG.listUrl}`);

    const response = await fetch(IBOSS_CONFIG.listUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // ─── 아이보스 게시판 HTML 구조 파싱 ───
    // ab-2876은 게시판 형태: 테이블 또는 리스트
    // 여러 셀렉터를 순서대로 시도 (아이보스 리디자인 대응)
    const selectorCandidates = [
      // 게시판 테이블 행 (가장 일반적)
      { list: "table.board-list tbody tr, table.list tbody tr", titleSel: "a", skipSel: ".notice" },
      // 리스트 형태
      { list: ".list-item, .board-item, .article-item", titleSel: "a", skipSel: ".notice" },
      // 카드/뉴스 형태
      { list: ".news-item, article, .content-item", titleSel: "a", skipSel: "" },
      // 범용 폴백: 본문 내 모든 링크 블록
      { list: "#content a[href*='ab-'], .board-body a[href*='ab-']", titleSel: "", skipSel: "" },
    ];

    let foundItems = false;

    for (const sel of selectorCandidates) {
      const items = $(sel.list);
      if (items.length === 0) continue;

      foundItems = true;
      console.log(
        `[뉴스클리핑] ${IBOSS_CONFIG.name}: 셀렉터 "${sel.list.slice(0, 50)}"로 ${items.length}개 발견`
      );

      let count = 0;
      items.each((_i, el) => {
        if (count >= IBOSS_CONFIG.maxItems) return false; // early exit

        // 공지사항 건너뛰기
        if (sel.skipSel && $(el).hasClass("notice")) return;

        // 제목과 링크 추출
        const linkEl = sel.titleSel ? $(el).find(sel.titleSel).first() : $(el);
        const rawTitle = linkEl.text().trim() ||
          $(el).find(".title, .subject, h3, h4, td.title, td.subject").text().trim();
        let link = linkEl.attr("href") || $(el).find("a").first().attr("href") || "";

        // 제목 유효성 검사
        if (!rawTitle || rawTitle.length < 5) return;

        // 상대 경로 → 절대 경로
        if (link && !link.startsWith("http")) {
          link = link.startsWith("/")
            ? IBOSS_CONFIG.baseUrl + link
            : IBOSS_CONFIG.baseUrl + "/" + link;
        }
        if (!link) return;

        // 이미 수집한 링크 중복 제거 (같은 페이지 내)
        if (articles.some((a) => a.link === link)) return;

        // 작성자/출처 추출 (아이보스 칼럼니스트 또는 뉴스 출처)
        const sourceName =
          $(el).find(".writer, .author, .name, td.writer, .source").first().text().trim() ||
          "아이보스";

        // 날짜 추출 시도
        const dateText = $(el).find(".date, .time, td.date, .regdate").first().text().trim();
        let publishedAt: string | null = null;
        if (dateText) {
          try {
            // "2026.04.01" 또는 "04.01" 형태 파싱
            const dateMatch = dateText.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
            if (dateMatch) {
              publishedAt = new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`).toISOString();
            }
          } catch { /* 파싱 실패 시 null 유지 */ }
        }

        articles.push({
          title: stripHtml(rawTitle),
          link,
          source_name: sourceName,
          thumbnail_url: null, // 아이보스 게시판은 보통 썸네일 없음
          snippet: null,       // 상세페이지 접근 없이 목록만 수집
          published_at: publishedAt,
          feed_source: "iboss",
          category: IBOSS_CONFIG.category,
        });

        count++;
      });

      break; // 첫 번째 매칭 셀렉터로 충분
    }

    if (!foundItems) {
      console.warn(
        `[뉴스클리핑] ${IBOSS_CONFIG.name}: 기사 아이템을 찾지 못함 — HTML 구조 변경 가능성`
      );
    }

    console.log(`[뉴스클리핑] ${IBOSS_CONFIG.name}: ${articles.length}개 기사 수집 완료`);
  } catch (err) {
    console.error(
      `[뉴스클리핑] ${IBOSS_CONFIG.name} 스크래핑 실패:`,
      err instanceof Error ? err.message : String(err)
    );
  }

  return articles;
}

// ================================================================
// 3. 통합 뉴스 수집 함수 (크론에서 호출)
// ================================================================
// 구글 뉴스 RSS 6개 + 아이보스 HTML 1개 = 총 7개 소스

export async function scrapeAllNews(): Promise<NewsArticle[]> {
  console.log("[뉴스클리핑] ========== 전체 뉴스 수집 시작 (7개 소스) ==========");

  const allArticles: NewsArticle[] = [];
  const stats: Array<{ name: string; count: number }> = [];

  // ─── 1) 구글 뉴스 RSS 6개 순차 수집 ───
  for (const feed of GOOGLE_NEWS_FEEDS) {
    try {
      const articles = await scrapeGoogleNews(feed);
      allArticles.push(...articles);
      stats.push({ name: feed.name, count: articles.length });
      // 피드 간 딜레이 (구글 rate limit 방지)
      await randomJitter(500, 1200);
    } catch (err) {
      console.error(`[뉴스클리핑] ${feed.name} 수집 중 에러:`, err);
      stats.push({ name: feed.name, count: 0 });
    }
  }

  // ─── 2) 아이보스 마케팅 뉴스/칼럼 ───
  try {
    const ibossArticles = await scrapeIbossNews();
    allArticles.push(...ibossArticles);
    stats.push({ name: IBOSS_CONFIG.name, count: ibossArticles.length });
  } catch (err) {
    console.error("[뉴스클리핑] 아이보스 수집 중 에러:", err);
    stats.push({ name: IBOSS_CONFIG.name, count: 0 });
  }

  // ─── URL 기반 중복 제거 ───
  const uniqueMap = new Map<string, NewsArticle>();
  for (const article of allArticles) {
    if (!uniqueMap.has(article.link)) {
      uniqueMap.set(article.link, article);
    }
  }
  const dedupedArticles = Array.from(uniqueMap.values());
  const removedDupes = allArticles.length - dedupedArticles.length;

  // ─── 수집 결과 로그 ───
  console.log("[뉴스클리핑] ========== 수집 결과 요약 ==========");
  for (const s of stats) {
    console.log(`  ${s.name}: ${s.count}개`);
  }
  console.log(`  합계: ${allArticles.length}개 (중복 제거: ${removedDupes}개 → 최종: ${dedupedArticles.length}개)`);
  console.log("[뉴스클리핑] ==========================================");

  return dedupedArticles;
}
