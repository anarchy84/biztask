// ================================================================
// 콘텐츠 팜 — 만능 HTML 커뮤니티 스크래퍼
// 날짜: 2026-03-30
// 용도: 보배드림, 개드립, 디시인사이드 등 국내 커뮤니티 베스트글 스크래핑
// 핵심: CSS Selector를 Config로 주입받아 어떤 커뮤니티든 유연하게 파싱
// 의존성: cheerio (이미 설치됨)
// ================================================================

import type { Scraper, ScrapedArticle } from "./types";

// ─── HTML 스크래퍼 설정 타입 ───
// 커뮤니티마다 HTML 구조가 다르므로 CSS Selector를 외부에서 주입
export interface HtmlScraperConfig {
  name: string;           // 스크래퍼 이름 (로그용, 예: "보배드림 베스트")
  category: string;       // BizTask 카테고리 (예: "humor", "free")
  sourceSite: string;     // 출처 사이트명 (예: "보배드림")
  listUrl: string;        // 글 목록 페이지 URL
  baseUrl: string;        // 상대경로 → 절대경로 변환용 (예: "https://www.bobaedream.co.kr")

  // ─── CSS Selectors ───
  selectors: {
    listItem: string;       // 글 목록 아이템 (예: ".news01List li")
    listLink: string;       // 각 아이템 안의 링크 <a> (예: "a")
    listTitle: string;      // 각 아이템 안의 제목 (예: "a" 또는 ".title")
    contentBody: string;    // 상세 페이지 본문 영역 (예: ".bodyCont")
    contentImages: string;  // 상세 페이지 이미지들 (예: ".bodyCont img")
    // ─── 댓글 크롤링 (Few-Shot용) ───
    commentItem?: string;   // 댓글 영역 개별 아이템 (예: ".cmt_info")
    commentText?: string;   // 댓글 아이템 내 텍스트 (예: ".cmt_txt_cont")
  };

  // ─── HTTP 요청 커스텀 헤더 (봇 차단 우회용) ───
  // 사이트마다 다른 헤더가 필요할 수 있음
  customHeaders?: Record<string, string>;

  // ─── 옵션 ───
  maxItems?: number;        // 한 번에 가져올 최대 글 수 (기본값: 5)
  encoding?: string;        // 페이지 인코딩 (기본값: utf-8, 일부 사이트는 euc-kr)
}

// ─── 최신 Chrome User-Agent (2026년 기준) ───
const CHROME_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ─── 공통 HTTP 헤더 (브라우저처럼 보이게) ───
const BASE_HEADERS: Record<string, string> = {
  "User-Agent": CHROME_USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// ================================================================
// HtmlScraper 클래스 — Scraper 인터페이스 구현
// ================================================================
export class HtmlScraper implements Scraper {
  name: string;
  category: string;
  private config: HtmlScraperConfig;
  private headers: Record<string, string>;

  constructor(config: HtmlScraperConfig) {
    this.name = config.name;
    this.category = config.category;
    this.config = config;

    // 공통 헤더 + 사이트별 커스텀 헤더 병합
    this.headers = {
      ...BASE_HEADERS,
      ...(config.customHeaders || {}),
    };
  }

  // ─── HTML 태그 제거 유틸 ───
  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, "\n")   // <br> → 줄바꿈
      .replace(/<[^>]*>/g, "")          // HTML 태그 제거
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ─── 이미지 URL 추출 (Lazy Loading 대응) ───
  // 커뮤니티 글은 이미지가 생명! src뿐 아니라 data-src, data-original도 체크
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractImageUrl(imgEl: any, $: any): string | null {
    const el = $(imgEl);

    // Lazy Loading 속성 우선순위로 체크
    const src =
      el.attr("data-original") ||     // 디시인사이드 등
      el.attr("data-src") ||           // 범용 lazy loading
      el.attr("data-lazy-src") ||      // 일부 사이트
      el.attr("src") ||                // 기본 src
      "";

    if (!src) return null;

    // data:image (placeholder) 제거
    if (src.startsWith("data:")) return null;

    // 상대경로 → 절대경로 변환
    if (src.startsWith("//")) {
      return `https:${src}`;
    }
    if (src.startsWith("/")) {
      return `${this.config.baseUrl}${src}`;
    }
    if (!src.startsWith("http")) {
      return `${this.config.baseUrl}/${src}`;
    }

    return src;
  }

  // ─── HTTP 요청 유틸 (타임아웃 + 에러 처리) ───
  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: this.headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  // ================================================================
  // 1단계: 글 목록 가져오기 (URL + 제목)
  // ================================================================
  async fetchList(): Promise<Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[]> {
    try {
      console.log(`[${this.name}] 글 목록 로딩: ${this.config.listUrl}`);

      const html = await this.fetchPage(this.config.listUrl);
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      const result: Pick<ScrapedArticle, "sourceUrl" | "sourceTitle">[] = [];
      const maxItems = this.config.maxItems || 5;
      const { selectors, baseUrl } = this.config;

      // 목록 아이템 순회
      $(selectors.listItem).each((_index, element) => {
        if (result.length >= maxItems) return false; // 최대 개수 도달 시 중단

        const $item = $(element);

        // 링크 추출
        const $link = $item.find(selectors.listLink).first();
        let href = $link.attr("href") || "";

        if (!href) return; // 링크 없으면 스킵

        // 상대경로 → 절대경로
        if (href.startsWith("/")) {
          href = `${baseUrl}${href}`;
        } else if (!href.startsWith("http")) {
          href = `${baseUrl}/${href}`;
        }

        // 제목 추출
        let title = "";
        if (selectors.listTitle === selectors.listLink) {
          // 링크 자체가 제목인 경우
          title = $link.text().trim();
        } else {
          title = $item.find(selectors.listTitle).first().text().trim();
        }

        if (!title) {
          title = $link.text().trim(); // 폴백: 링크 텍스트
        }

        // 한글 제목만 (해외 스팸 필터)
        if (!/[가-힣]/.test(title)) return;

        // 제목 정리 (댓글 수 등 부가 정보 제거)
        title = title.replace(/\s*\[\d+\]\s*$/, "").trim(); // "[3]" 같은 댓글 수 제거
        title = title.replace(/\s*\(\d+\)\s*$/, "").trim(); // "(3)" 같은 것도 제거

        if (title.length < 3) return; // 너무 짧은 제목 스킵

        result.push({ sourceUrl: href, sourceTitle: title });
      });

      console.log(`[${this.name}] ${result.length}개 글 발견`);
      return result;
    } catch (err) {
      console.error(
        `[${this.name}] 글 목록 로딩 실패:`,
        err instanceof Error ? err.message : String(err)
      );
      return [];
    }
  }

  // ================================================================
  // 2단계: 개별 글 본문 + 이미지 파싱
  // ================================================================
  async parseContent(
    url: string,
    title: string
  ): Promise<ScrapedArticle | null> {
    try {
      console.log(`[${this.name}] 본문 파싱: ${url}`);

      const html = await this.fetchPage(url);
      const cheerio = await import("cheerio");
      const $ = cheerio.load(html);

      const { selectors } = this.config;

      // ─── 본문 추출 ───
      const $body = $(selectors.contentBody).first();
      if ($body.length === 0) {
        console.warn(`[${this.name}] 본문 영역 못 찾음 (selector: ${selectors.contentBody})`);
        return null;
      }

      // 불필요한 요소 제거 (광고, 스크립트, 스타일 등)
      $body
        .find(
          "script, style, iframe, .ad, .advertisement, .adsbygoogle, " +
          ".signature, .sig, .comment-area, .comment-list, " +
          "nav, footer, .footer, .copyright, .social-share"
        )
        .remove();

      // 본문 텍스트 추출
      let bodyText = this.stripHtml($body.html() || "");

      // 너무 짧으면 스킵
      if (bodyText.length < 50) {
        console.warn(
          `[${this.name}] 본문 너무 짧음 (${bodyText.length}자): ${url}`
        );
        return null;
      }

      // 한글 콘텐츠 필터 (최소 10% — 유머글은 이미지 위주라 비율 낮게)
      const koreanChars = bodyText.match(/[가-힣]/g) || [];
      const koreanRatio = koreanChars.length / bodyText.length;
      if (koreanRatio < 0.1) {
        console.warn(
          `[${this.name}] 한글 비율 낮음 (${(koreanRatio * 100).toFixed(1)}%): ${url}`
        );
        return null;
      }

      // 너무 길면 3000자로 자르기
      if (bodyText.length > 3000) {
        bodyText = bodyText.slice(0, 3000) + "...";
      }

      // ─── 이미지 추출 ───
      const images: string[] = [];
      $(selectors.contentImages).each((_i, imgEl) => {
        if (images.length >= 10) return false; // 최대 10장

        const imgUrl = this.extractImageUrl(imgEl, $);
        if (imgUrl && !images.includes(imgUrl)) {
          // 아이콘, 이모티콘 등 작은 이미지 필터 (URL 패턴으로)
          const isSmallIcon =
            /icon|emoji|emoticon|btn_|bullet|logo.*small/i.test(imgUrl);
          if (!isSmallIcon) {
            images.push(imgUrl);
          }
        }
      });

      // ─── 댓글 크롤링 (Few-Shot 프롬프팅용) ───
      // 실제 유저들의 반응을 최대 5개까지 수집하여 AI에게 컨닝 페이퍼로 제공
      const comments: string[] = [];
      const { commentItem, commentText } = selectors;
      if (commentItem) {
        $(commentItem).each((_i, cmtEl) => {
          if (comments.length >= 5) return false; // 최대 5개

          // 댓글 텍스트 추출
          let cmtContent = "";
          if (commentText) {
            cmtContent = $(cmtEl).find(commentText).first().text().trim();
          } else {
            cmtContent = $(cmtEl).text().trim();
          }

          // 너무 짧거나 긴 댓글 필터링
          if (cmtContent.length >= 5 && cmtContent.length <= 200) {
            // 광고성/봇 댓글 필터
            const isSpam = /https?:\/\/|텔레그램|카톡|문의|홍보|광고|클릭/i.test(cmtContent);
            if (!isSpam) {
              comments.push(cmtContent);
            }
          }
        });
        console.log(`[${this.name}] 댓글 ${comments.length}개 수집 (Few-Shot용)`);
      }

      console.log(
        `[${this.name}] 파싱 완료: "${title}" (본문 ${bodyText.length}자, 이미지 ${images.length}장, 댓글 ${comments.length}개)`
      );

      return {
        sourceUrl: url,
        sourceTitle: title,
        sourceBody: bodyText,
        sourceImages: images,
        sourceComments: comments,
        sourceSite: this.config.sourceSite,
        category: this.category,
        scrapedAt: new Date().toISOString(),
      };
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
// ─── 타겟 커뮤니티 Config 배열 (3개 사이트) ───
// ================================================================
// 주의: 커뮤니티 사이트들은 봇 차단이 빡세서 차단당할 수 있음
// → 차단되면 해당 Config만 주석처리하면 됨 (다른 스크래퍼에 영향 없음)

export const HTML_SCRAPER_CONFIGS: HtmlScraperConfig[] = [
  // ────────────────────────────────────────────
  // 1. 보배드림 — 베스트 게시글
  // URL: https://www.bobaedream.co.kr/list?code=best
  // 특징: 비교적 관대한 봇 정책, 자동차 + 유머 혼합
  // ────────────────────────────────────────────
  {
    name: "보배드림 베스트",
    category: "humor",
    sourceSite: "보배드림",
    listUrl: "https://www.bobaedream.co.kr/list?code=best",
    baseUrl: "https://www.bobaedream.co.kr",
    selectors: {
      listItem: "#boardlist tbody tr",               // 글 목록 행 (#boardlist 테이블)
      listLink: "a.bsubject",                        // 제목 링크
      listTitle: "a.bsubject",                       // 제목 텍스트도 여기서
      contentBody: ".bodyCont",                        // 상세 본문 영역 (보배드림 실제 클래스)
      contentImages: ".bodyCont img",                // 본문 내 이미지
      // ─── 댓글 (Few-Shot용) ───
      commentItem: ".cmt_info",                      // 보배드림 댓글 개별 아이템
      commentText: ".cmt_txt_cont",                  // 댓글 텍스트 영역
    },
    customHeaders: {
      Referer: "https://www.bobaedream.co.kr/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // [비활성화] 개드립넷 — 개드립 (유머)
  // 사유: Rhymix 기반 CSR(Client Side Rendering)으로 본문 로딩
  //       cheerio(서버사이드 HTML 파싱)로는 본문 추출 불가
  //       article.rhymix_content 내부가 빈 상태로 렌더링됨
  //       향후 Puppeteer 등 headless browser 도입 시 재활성화 가능
  // ────────────────────────────────────────────

  // ────────────────────────────────────────────
  // 3. 디시인사이드 — 실시간베스트 (실베)
  // URL: https://gall.dcinside.com/board/lists/?id=dcbest
  // 특징: 봇 차단 매우 빡셈! Referer, Cookie 검사함
  // → 헤더를 꼼꼼히 세팅해도 차단당할 수 있음 (그러면 쿨하게 버림)
  // ────────────────────────────────────────────
  {
    name: "디시 실베",
    category: "humor",
    sourceSite: "디시인사이드",
    listUrl: "https://gall.dcinside.com/board/lists/?id=dcbest",
    baseUrl: "https://gall.dcinside.com",
    selectors: {
      listItem: "tr.us-post",                        // 글 목록 행 (tr에 us-post 클래스)
      listLink: "a:not(.reply_numbox)",              // 제목 링크 (댓글수 링크 제외)
      listTitle: "a:not(.reply_numbox)",             // 제목 텍스트
      contentBody: ".write_div",                     // 상세 본문 영역
      contentImages: ".write_div img",               // 본문 이미지
      // ─── 댓글 (Few-Shot용) ───
      commentItem: ".reply_info",                    // 디시 댓글 개별 행
      commentText: ".usertxt",                       // 댓글 텍스트
    },
    customHeaders: {
      Referer: "https://gall.dcinside.com/",
      Cookie: "PHPSESSID=dummy; ci_c=0",   // 기본 쿠키 (없으면 403)
      "X-Requested-With": "XMLHttpRequest", // 일부 요청에서 필요
    },
    maxItems: 3, // 디시는 보수적으로 (차단 위험)
  },
];

// ─── 팩토리 함수: Config 배열 → HtmlScraper 인스턴스 배열 ───
export function createHtmlScrapers(
  configs: HtmlScraperConfig[] = HTML_SCRAPER_CONFIGS
): HtmlScraper[] {
  return configs.map((config) => new HtmlScraper(config));
}
