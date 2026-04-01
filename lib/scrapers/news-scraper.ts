// ================================================================
// 뉴스클리핑 프로젝트 — 뉴스 스크래퍼
// 날짜: 2026-04-01
// 용도: 구글 뉴스 RSS + 아이보스 마케팅 뉴스에서 기사 수집
//       → news_articles 테이블에 저장
//       → 이후 AI 클러스터링 → news_clips 생성
//
// [기존 콘텐츠팜 스크래퍼와 분리된 이유]
// 콘텐츠팜: 커뮤니티 글 → 리라이팅 → 게시 (content_backlog 경유)
// 뉴스클리핑: 뉴스 기사 → 클러스터링 → 요약 카드 (news_articles → news_clips)
// 목적과 파이프라인이 완전히 다르므로 별도 모듈로 분리
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
  category: string;       // 카테고리 ('economy', 'tech', 'marketing')
}

// ─── 구글 뉴스 RSS 피드 설정 ───
// 구글 뉴스는 섹션별 RSS를 제공
// https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSnJieGdBUAE
export interface GoogleNewsFeedConfig {
  name: string;       // 피드 이름 (로그용)
  feedUrl: string;    // RSS URL
  category: string;   // BizTask 뉴스 카테고리
  maxItems: number;   // 최대 수집 기사 수
}

// ─── 구글 뉴스 RSS 피드 목록 ───
// 한국 구글 뉴스 주요 섹션
export const GOOGLE_NEWS_FEEDS: GoogleNewsFeedConfig[] = [
  {
    name: "구글뉴스-경제",
    // 한국 경제 뉴스 RSS (Google News Korea - Business)
    feedUrl: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGxqTjNjd0VnSnJieGdBUAE?hl=ko&gl=KR&ceid=KR:ko",
    category: "economy",
    maxItems: 15,
  },
  {
    name: "구글뉴스-기술",
    // 한국 기술 뉴스 RSS (Google News Korea - Technology)
    feedUrl: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko",
    category: "tech",
    maxItems: 10,
  },
];

// ─── HTML 태그 제거 유틸 ───
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

// ─── 구글 뉴스 RSS에서 언론사명 추출 ───
// 구글 뉴스 제목 형식: "기사 제목 - 언론사명"
function extractSourceFromTitle(title: string): { cleanTitle: string; sourceName: string } {
  // 마지막 " - " 기준으로 분리 (언론사명이 뒤에 옴)
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

    console.log(`[뉴스클리핑] ${config.name} RSS 로딩: ${config.feedUrl}`);
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
// 2. 아이보스 마케팅 뉴스 스크래퍼
// ================================================================

// 아이보스 뉴스 설정
const IBOSS_CONFIG = {
  name: "아이보스-마케팅뉴스",
  // 아이보스 마케팅 뉴스 섹션 URL
  listUrl: "https://www.i-boss.co.kr/ab-newsbot",
  baseUrl: "https://www.i-boss.co.kr",
  category: "marketing",
  maxItems: 10,
};

export async function scrapeIbossNews(): Promise<NewsArticle[]> {
  const articles: NewsArticle[] = [];

  try {
    const cheerio = await import("cheerio");

    // 랜덤 딜레이 (봇 차단 우회)
    await randomJitter(500, 1500);

    // Anti-Bot 헤더 생성
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

    // 아이보스 뉴스봇 페이지의 기사 목록 파싱
    // 구조: .news-list 또는 .content-list 내 개별 기사 아이템
    // ※ 아이보스 HTML 구조가 변경될 수 있으므로 여러 셀렉터 시도
    const selectors = [
      ".news-item",                  // 뉴스봇 아이템
      ".content-list .item",         // 콘텐츠 리스트 아이템
      ".board-list tbody tr",        // 게시판 형태
      "article",                     // article 태그 기반
    ];

    let foundItems = false;

    for (const selector of selectors) {
      const items = $(selector);
      if (items.length === 0) continue;

      foundItems = true;
      console.log(
        `[뉴스클리핑] ${IBOSS_CONFIG.name}: 셀렉터 "${selector}"로 ${items.length}개 발견`
      );

      items.slice(0, IBOSS_CONFIG.maxItems).each((_i, el) => {
        // 제목과 링크 추출 (a 태그에서)
        const linkEl = $(el).find("a").first();
        const title = linkEl.text().trim() || $(el).find(".title, .subject, h3, h4").text().trim();
        let link = linkEl.attr("href") || "";

        if (!title || title.length < 5) return;

        // 상대 경로 → 절대 경로
        if (link && !link.startsWith("http")) {
          link = link.startsWith("/")
            ? IBOSS_CONFIG.baseUrl + link
            : IBOSS_CONFIG.baseUrl + "/" + link;
        }

        if (!link) return;

        // 썸네일 추출 시도
        const imgEl = $(el).find("img").first();
        let thumbnailUrl = imgEl.attr("src") || imgEl.attr("data-src") || null;
        if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
          thumbnailUrl = IBOSS_CONFIG.baseUrl + thumbnailUrl;
        }

        // 요약 추출 시도
        const snippet =
          $(el).find(".summary, .desc, .description, p").first().text().trim().slice(0, 300) || null;

        // 언론사명 추출 (아이보스 뉴스봇은 원본 언론사를 표시)
        const sourceName =
          $(el).find(".source, .media, .press").first().text().trim() || "아이보스";

        articles.push({
          title: stripHtml(title),
          link,
          source_name: sourceName,
          thumbnail_url: thumbnailUrl,
          snippet: snippet ? stripHtml(snippet) : null,
          published_at: null, // 아이보스 페이지에서 시간 파싱이 어려우면 null
          feed_source: "iboss",
          category: IBOSS_CONFIG.category,
        });
      });

      break; // 첫 번째로 매칭된 셀렉터로 진행
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
// 구글 뉴스 + 아이보스를 모두 돌려서 news_articles 형태로 반환

export async function scrapeAllNews(): Promise<NewsArticle[]> {
  console.log("[뉴스클리핑] ========== 전체 뉴스 수집 시작 ==========");

  const allArticles: NewsArticle[] = [];

  // 1) 구글 뉴스 RSS (경제 + 기술)
  for (const feed of GOOGLE_NEWS_FEEDS) {
    try {
      const articles = await scrapeGoogleNews(feed);
      allArticles.push(...articles);
      // 피드 사이에 약간의 딜레이
      await randomJitter(300, 800);
    } catch (err) {
      console.error(`[뉴스클리핑] ${feed.name} 수집 중 에러:`, err);
    }
  }

  // 2) 아이보스 마케팅 뉴스
  try {
    const ibossArticles = await scrapeIbossNews();
    allArticles.push(...ibossArticles);
  } catch (err) {
    console.error("[뉴스클리핑] 아이보스 수집 중 에러:", err);
  }

  console.log(
    `[뉴스클리핑] ========== 전체 수집 완료: ${allArticles.length}개 기사 ==========`
  );

  return allArticles;
}

// ================================================================
// 4. AI 클러스터링 뼈대 (news_articles → news_clips 매핑)
// ================================================================
// 실제 LLM 호출은 Task 3에서 구현 — 여기서는 구조만 잡음

export interface ClusteringResult {
  headline: string;         // AI가 만든 핵심 헤드라인
  summary: string;          // 3줄 요약
  category: string;         // 카테고리
  articleIds: string[];     // 이 클러스터에 소속된 news_articles.id 배열
  thumbnailUrl: string | null;  // 대표 썸네일
}

// ─── 유사 기사 클러스터링 함수 (뼈대) ───
// 입력: 아직 클러스터링되지 않은 기사 목록
// 출력: 클러스터 배열 (각 클러스터 = 1개의 news_clip)
//
// [알고리즘 계획]
// 1. 제목 유사도 기반 그룹핑 (TF-IDF 또는 LLM 임베딩)
// 2. 같은 이벤트를 다루는 기사끼리 묶기
// 3. 각 그룹에 대해 LLM으로 헤드라인 + 3줄 요약 생성
// 4. 단독 기사도 1:1로 클립 생성 (중요도 낮게)
export async function clusterAndSummarize(
  _articles: Array<{ id: string; title: string; snippet: string | null; source_name: string; category: string }>
): Promise<ClusteringResult[]> {
  // TODO: Task 3에서 LLM 프롬프트와 함께 구현
  // 현재는 빈 배열 반환 (뼈대만)
  console.log("[뉴스클리핑] 클러스터링 함수 호출됨 (아직 뼈대만 구현)");
  return [];
}
