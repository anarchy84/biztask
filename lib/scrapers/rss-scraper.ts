// ================================================================
// 콘텐츠 팜 — RSS 피드 스크래퍼
// 날짜: 2026-03-30
// 용도: RSS/Atom 피드에서 기사 목록을 가져오고 본문을 파싱
// 의존성: rss-parser, cheerio (npm install rss-parser cheerio)
// ================================================================

import type { Scraper, ScrapedArticle } from "./types";

// ─── RSS 피드 설정 타입 ───
// 새 RSS 피드를 추가할 때 이 형식으로 정의
export interface RssFeedConfig {
  name: string;           // 스크래퍼 이름 (로그용, 예: "아이보스 RSS")
  category: string;       // BizTask 카테고리 (예: "marketing")
  feedUrl: string;        // RSS 피드 URL
  sourceSite: string;     // 출처 사이트명 (예: "아이보스")
  maxItems?: number;      // 한 번에 가져올 최대 기사 수 (기본값: 5)
}

// ─── RSS 스크래퍼 클래스 ───
// RssFeedConfig 하나당 Scraper 인스턴스 하나 생성
export class RssScraper implements Scraper {
  name: string;
  category: string;
  private feedUrl: string;
  private sourceSite: string;
  private maxItems: number;

  constructor(config: RssFeedConfig) {
    this.name = config.name;
    this.category = config.category;
    this.feedUrl = config.feedUrl;
    this.sourceSite = config.sourceSite;
    this.maxItems = config.maxItems || 5;
  }

  // ─── 1단계: RSS 피드에서 글 목록 가져오기 ───
  async fetchList(): Promise<Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[]> {
    try {
      // rss-parser는 ESM/CJS 혼용 이슈가 있어서 dynamic import 사용
      const Parser = (await import("rss-parser")).default;
      const parser = new Parser({
        timeout: 10000, // 10초 타임아웃
        headers: {
          // 봇 차단 방지용 User-Agent
          "User-Agent":
            "Mozilla/5.0 (compatible; BizTaskBot/1.0; +https://www.biztask.kr)",
        },
      });

      console.log(`[${this.name}] RSS 피드 로딩: ${this.feedUrl}`);
      const feed = await parser.parseURL(this.feedUrl);

      // 최신 N개만 가져오기
      const items = (feed.items || []).slice(0, this.maxItems);

      const result = items
        .filter((item) => item.link && item.title) // URL과 제목이 있는 것만
        .filter((item) => /[가-힣]/.test(item.title!)) // 제목에 한글이 포함된 것만 (외국 기사 제외)
        .map((item) => ({
          sourceUrl: item.link!,
          sourceTitle: item.title!,
        }));

      console.log(
        `[${this.name}] ${result.length}개 기사 발견 (전체 ${feed.items?.length || 0}개 중)`
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

  // ─── 2단계: 개별 기사 본문 파싱 ───
  async parseContent(
    url: string,
    title: string
  ): Promise<ScrapedArticle | null> {
    try {
      console.log(`[${this.name}] 본문 파싱 시작: ${url}`);

      // HTML 가져오기
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BizTaskBot/1.0; +https://www.biztask.kr)",
        },
        signal: AbortSignal.timeout(15000), // 15초 타임아웃
      });

      if (!response.ok) {
        console.warn(
          `[${this.name}] HTTP ${response.status} — ${url}`
        );
        return null;
      }

      const html = await response.text();

      // cheerio로 HTML 파싱
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      // ─── 본문 텍스트 추출 ───
      // 일반적인 기사 본문 선택자들을 순서대로 시도
      const bodySelectors = [
        "article",
        ".article-body",
        ".post-content",
        ".entry-content",
        ".content-body",
        ".article-content",
        '[itemprop="articleBody"]',
        "main",
        ".main-content",
      ];

      let bodyText = "";
      for (const selector of bodySelectors) {
        const el = $(selector);
        if (el.length > 0) {
          // 스크립트, 스타일, 광고 제거
          el.find("script, style, .ad, .advertisement, nav, footer, .sidebar").remove();
          bodyText = el.text().trim();
          if (bodyText.length > 100) break; // 충분한 길이의 텍스트를 찾으면 중단
        }
      }

      // 어떤 선택자도 안 먹히면 body 전체에서 추출
      if (bodyText.length < 100) {
        $("script, style, nav, footer, header, .sidebar, .ad").remove();
        bodyText = $("body").text().trim();
      }

      // 본문 정리: 연속 공백/줄바꿈 제거
      bodyText = bodyText
        .replace(/\s+/g, " ")
        .replace(/\n\s*\n/g, "\n")
        .trim();

      // 너무 짧으면 (100자 미만) 스킵
      if (bodyText.length < 100) {
        console.warn(
          `[${this.name}] 본문이 너무 짧음 (${bodyText.length}자) — 스킵: ${url}`
        );
        return null;
      }

      // ─── 한글 콘텐츠 필터 ───
      // 본문에서 한글 글자 수를 세서 전체의 20% 미만이면 외국 기사로 판단 → 스킵
      const koreanChars = bodyText.match(/[가-힣]/g) || [];
      const koreanRatio = koreanChars.length / bodyText.length;
      if (koreanRatio < 0.2) {
        console.warn(
          `[${this.name}] 한글 비율 너무 낮음 (${(koreanRatio * 100).toFixed(1)}%) — 외국 기사 스킵: ${url}`
        );
        return null;
      }

      // 너무 길면 앞부분만 (3000자)
      if (bodyText.length > 3000) {
        bodyText = bodyText.slice(0, 3000) + "...";
      }

      // ─── 이미지 URL 추출 ───
      const images: string[] = [];
      $("img").each((_, el) => {
        const src = $(el).attr("src");
        if (src && src.startsWith("http") && !src.includes("logo") && !src.includes("icon")) {
          images.push(src);
        }
      });

      const article: ScrapedArticle = {
        sourceUrl: url,
        sourceTitle: title,
        sourceBody: bodyText,
        sourceImages: images.slice(0, 5), // 최대 5개 이미지
        sourceSite: this.sourceSite,
        category: this.category,
        scrapedAt: new Date().toISOString(),
      };

      console.log(
        `[${this.name}] 파싱 완료: "${title}" (${bodyText.length}자, 이미지 ${images.length}개)`
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
}

// ================================================================
// ─── RSS 피드 목록 (진짜 실전용) ───
// ================================================================
export const RSS_FEED_CONFIGS: RssFeedConfig[] = [
  {
    name: "구글 뉴스 (마케팅)",
    category: "marketing",
    feedUrl: "https://news.google.com/rss/search?q=%EB%A7%88%EC%BC%80%ED%8C%85&hl=ko&gl=KR&ceid=KR:ko",
    sourceSite: "구글뉴스",
    maxItems: 3,
  },
  {
    name: "구글 뉴스 (사업/비즈니스)",
    category: "business",
    feedUrl: "https://news.google.com/rss/search?q=%EB%B9%84%EC%A6%88%EB%8B%88%EC%8A%A4&hl=ko&gl=KR&ceid=KR:ko",
    sourceSite: "구글뉴스",
    maxItems: 3,
  },
  {
    name: "구글 뉴스 (자동차)",
    category: "car",
    feedUrl: "https://news.google.com/rss/search?q=%EC%9E%90%EB%8F%99%EC%B0%A8&hl=ko&gl=KR&ceid=KR:ko",
    sourceSite: "구글뉴스",
    maxItems: 3,
  },
  {
    name: "구글 뉴스 (AI/인공지능)",
    category: "ai",
    feedUrl: "https://news.google.com/rss/search?q=%EC%9D%B8%EA%B3%B5%EC%A7%80%EB%8A%A5+AI&hl=ko&gl=KR&ceid=KR:ko",
    sourceSite: "구글뉴스",
    maxItems: 3,
  },
];

// ─── 팩토리 함수: RSS 설정 배열 → Scraper 인스턴스 배열 ───
export function createRssScrapers(
  configs: RssFeedConfig[] = RSS_FEED_CONFIGS
): RssScraper[] {
  return configs.map((config) => new RssScraper(config));
}
