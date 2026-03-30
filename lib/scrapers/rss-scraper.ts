// ================================================================
// 콘텐츠 팜 — RSS 피드 스크래퍼 (v2 — RSS 본문 우선 추출)
// 날짜: 2026-03-30
// 용도: RSS/Atom 피드에서 기사 목록 + 본문을 가져오기
// 핵심 변경: RSS 피드 자체의 content/description을 1순위로 사용
//           사이트 직접 방문은 폴백으로만 (한국 뉴스사이트 봇 차단 대응)
// 의존성: rss-parser, cheerio
// ================================================================

import type { Scraper, ScrapedArticle } from "./types";

// ─── RSS 피드 설정 타입 ───
export interface RssFeedConfig {
  name: string;           // 스크래퍼 이름 (로그용)
  category: string;       // BizTask 카테고리 (예: "marketing")
  feedUrl: string;        // RSS 피드 URL
  sourceSite: string;     // 출처 사이트명
  maxItems?: number;      // 한 번에 가져올 최대 기사 수 (기본값: 5)
}

// ─── RSS 아이템에서 추출한 정보 (내부 캐시) ───
interface RssItemCache {
  sourceUrl: string;
  sourceTitle: string;
  rssBody: string;        // RSS에서 바로 뽑은 본문 (content/description)
}

// ─── RSS 스크래퍼 클래스 ───
export class RssScraper implements Scraper {
  name: string;
  category: string;
  private feedUrl: string;
  private sourceSite: string;
  private maxItems: number;

  // RSS에서 뽑은 본문을 캐시 (URL → 본문)
  // fetchList에서 저장 → parseContent에서 사용
  private bodyCache: Map<string, string> = new Map();

  constructor(config: RssFeedConfig) {
    this.name = config.name;
    this.category = config.category;
    this.feedUrl = config.feedUrl;
    this.sourceSite = config.sourceSite;
    this.maxItems = config.maxItems || 5;
  }

  // ─── HTML 태그 제거 유틸 ───
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, "")       // HTML 태그 제거
      .replace(/&nbsp;/g, " ")       // &nbsp; → 공백
      .replace(/&amp;/g, "&")        // &amp; → &
      .replace(/&lt;/g, "<")         // HTML entities
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")          // 연속 공백 정리
      .trim();
  }

  // ─── 1단계: RSS 피드에서 글 목록 + 본문 가져오기 ───
  async fetchList(): Promise<Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[]> {
    try {
      const Parser = (await import("rss-parser")).default;
      // content:encoded 필드도 파싱하도록 커스텀 필드 설정
      const parser = new Parser({
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        customFields: {
          item: [["content:encoded", "contentEncoded"]],
        },
      });

      console.log(`[${this.name}] RSS 피드 로딩: ${this.feedUrl}`);
      const feed = await parser.parseURL(this.feedUrl);

      const items = (feed.items || []).slice(0, this.maxItems);

      const result: Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[] = [];

      for (const item of items) {
        if (!item.link || !item.title) continue;
        if (!/[가-힣]/.test(item.title)) continue; // 한글 없는 제목 제외

        // ─── RSS 본문 추출 (우선순위) ───
        // 1. content:encoded (전체 HTML 본문, 가장 풍부)
        // 2. content (일반 본문)
        // 3. contentSnippet (태그 제거된 텍스트)
        // 4. description (요약문)
        const rawBody =
          (item as unknown as Record<string, string>).contentEncoded ||
          item.content ||
          item.contentSnippet ||
          (item as unknown as Record<string, string>).description ||
          "";

        const cleanBody = this.stripHtml(rawBody);

        // RSS 본문이 50자 이상이면 캐시에 저장 (나중에 parseContent에서 사용)
        if (cleanBody.length >= 50) {
          this.bodyCache.set(item.link, cleanBody);
          console.log(
            `[${this.name}] RSS 본문 캐시 저장: "${item.title.slice(0, 30)}..." (${cleanBody.length}자)`
          );
        } else {
          console.log(
            `[${this.name}] RSS 본문 짧음 (${cleanBody.length}자) — 사이트 폴백 필요: "${item.title.slice(0, 30)}..."`
          );
        }

        result.push({
          sourceUrl: item.link,
          sourceTitle: item.title,
        });
      }

      console.log(
        `[${this.name}] ${result.length}개 기사 발견, ${this.bodyCache.size}개 본문 캐시됨 (전체 ${feed.items?.length || 0}개 중)`
      );
      return result;
    } catch (err) {
      console.error(
        `[${this.name}] RSS 피드 로딩 실패:`,
        err instanceof Error ? err.message : String(err)
      );
      return [];
    }
  }

  // ─── 2단계: 기사 본문 파싱 ───
  // 1순위: RSS 캐시에서 가져오기 (사이트 방문 없이)
  // 2순위: 사이트 직접 방문 (캐시 miss 시 폴백)
  async parseContent(
    url: string,
    title: string
  ): Promise<ScrapedArticle | null> {
    try {
      console.log(`[${this.name}] 본문 파싱 시작: ${url}`);

      let bodyText = "";

      // ─── 1순위: RSS 캐시에서 본문 가져오기 ───
      const cachedBody = this.bodyCache.get(url);
      if (cachedBody && cachedBody.length >= 100) {
        bodyText = cachedBody;
        console.log(
          `[${this.name}] ✅ RSS 캐시 히트! (${bodyText.length}자) — 사이트 방문 불필요`
        );
      } else {
        // ─── 2순위: 사이트 직접 방문 (폴백) ───
        console.log(`[${this.name}] 캐시 없음 — 사이트 직접 방문 시도: ${url}`);
        bodyText = await this.fetchFromSite(url);
      }

      // 본문 정리
      bodyText = bodyText
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();

      // 너무 짧으면 스킵
      if (bodyText.length < 100) {
        console.warn(
          `[${this.name}] 본문이 너무 짧음 (${bodyText.length}자) — 스킵: ${url}`
        );
        return null;
      }

      // 한글 콘텐츠 필터
      const koreanChars = bodyText.match(/[가-힣]/g) || [];
      const koreanRatio = koreanChars.length / bodyText.length;
      if (koreanRatio < 0.15) {
        console.warn(
          `[${this.name}] 한글 비율 낮음 (${(koreanRatio * 100).toFixed(1)}%) — 스킵: ${url}`
        );
        return null;
      }

      // 너무 길면 앞부분만 (3000자)
      if (bodyText.length > 3000) {
        bodyText = bodyText.slice(0, 3000) + "...";
      }

      const article: ScrapedArticle = {
        sourceUrl: url,
        sourceTitle: title,
        sourceBody: bodyText,
        sourceImages: [], // RSS에서는 이미지 추출 생략 (본문 텍스트가 핵심)
        sourceSite: this.sourceSite,
        category: this.category,
        scrapedAt: new Date().toISOString(),
      };

      console.log(
        `[${this.name}] 파싱 완료: "${title}" (${bodyText.length}자)`
      );
      return article;
    } catch (err) {
      console.error(
        `[${this.name}] 본문 파싱 실패:`,
        err instanceof Error ? err.message : String(err),
        `— ${url}`
      );
      return null;
    }
  }

  // ─── 사이트 직접 방문 폴백 ───
  private async fetchFromSite(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`[${this.name}] 사이트 HTTP ${response.status} — ${url}`);
        return "";
      }

      const html = await response.text();
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      // 본문 선택자 시도
      const selectors = [
        "article", ".article-body", ".post-content", ".entry-content",
        ".content-body", ".article-content", '[itemprop="articleBody"]',
        "main", ".main-content",
      ];

      let bodyText = "";
      for (const selector of selectors) {
        const el = $(selector);
        if (el.length > 0) {
          el.find("script, style, .ad, .advertisement, nav, footer, .sidebar").remove();
          bodyText = el.text().trim();
          if (bodyText.length > 100) break;
        }
      }

      if (bodyText.length < 100) {
        $("script, style, nav, footer, header, .sidebar, .ad").remove();
        bodyText = $("body").text().trim();
      }

      return bodyText;
    } catch (err) {
      console.warn(
        `[${this.name}] 사이트 방문 실패: ${err instanceof Error ? err.message : String(err)}`
      );
      return "";
    }
  }
}

// ================================================================
// ─── RSS 피드 목록 (실전용 — 직접 접속 가능한 피드만) ───
// ================================================================
// 구글뉴스 RSS는 리다이렉트 체인 + 차단 문제로 불안정
// → 직접 RSS를 제공하는 국내 언론사 피드 사용
// 참고: https://github.com/akngs/knews-rss (한국 언론사 RSS 모음)
export const RSS_FEED_CONFIGS: RssFeedConfig[] = [
  // ─── 마케팅/IT ───
  {
    name: "한국 테크 뉴스 (마케팅/IT)",
    category: "marketing",
    feedUrl: "https://akngs.github.io/knews-rss/categories/tech.xml",
    sourceSite: "한국 테크 뉴스",
    maxItems: 3,
  },
  // ─── 사업/경제 ───
  {
    name: "한국 경제 뉴스 (사업)",
    category: "business",
    feedUrl: "https://akngs.github.io/knews-rss/categories/economy.xml",
    sourceSite: "한국 경제 뉴스",
    maxItems: 3,
  },
  // ─── 자동차 ───
  {
    name: "데일리카 (자동차)",
    category: "car",
    feedUrl: "https://www.dailycar.co.kr/feed/",
    sourceSite: "데일리카",
    maxItems: 3,
  },
  // ─── AI/인공지능 ───
  {
    name: "구글 뉴스 (AI/인공지능)",
    category: "ai",
    feedUrl: "https://news.google.com/rss/search?q=%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5+AI&hl=ko&gl=KR&ceid=KR:ko",
    sourceSite: "구글뉴스",
    maxItems: 2,
  },
];

// ─── 팩토리 함수: RSS 설정 배열 → Scraper 인스턴스 배열 ───
export function createRssScrapers(
  configs: RssFeedConfig[] = RSS_FEED_CONFIGS
): RssScraper[] {
  return configs.map((config) => new RssScraper(config));
}
