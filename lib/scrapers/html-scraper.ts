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
  // ─── 콘텐츠 타입 (Project DNA: 조건부 렌더링) ───
  contentType: "qa" | "news" | "humor";
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

  // ─── HTTP 요청 유틸 (타임아웃 + 에러 처리 + EUC-KR 인코딩 지원) ───
  // 웃긴대학 등 일부 사이트는 EUC-KR 인코딩을 사용하므로 디코딩 처리 필요
  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: this.headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15000), // 15초 타임아웃
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    // EUC-KR 인코딩 사이트 처리 (예: 웃긴대학)
    if (this.config.encoding === "euc-kr") {
      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder("euc-kr");
      return decoder.decode(buffer);
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
        contentType: this.config.contentType,
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
  // ════════════════════════════════════════════
  // ▼ 유머 소스 (50% 비율) ▼
  // ════════════════════════════════════════════

  // ────────────────────────────────────────────
  // 1. 보배드림 — 베스트 게시글
  // ────────────────────────────────────────────
  {
    name: "보배드림 베스트",
    category: "humor",
    contentType: "humor",
    sourceSite: "보배드림",
    listUrl: "https://www.bobaedream.co.kr/list?code=best",
    baseUrl: "https://www.bobaedream.co.kr",
    selectors: {
      listItem: "#boardlist tbody tr",
      listLink: "a.bsubject",
      listTitle: "a.bsubject",
      contentBody: ".bodyCont",
      contentImages: ".bodyCont img",
      commentItem: ".cmt_info",
      commentText: ".cmt_txt_cont",
    },
    customHeaders: {
      Referer: "https://www.bobaedream.co.kr/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // 2. 디시인사이드 — 실시간베스트 (실베)
  // ────────────────────────────────────────────
  {
    name: "디시 실베",
    category: "humor",
    contentType: "humor",
    sourceSite: "디시인사이드",
    listUrl: "https://gall.dcinside.com/board/lists/?id=dcbest",
    baseUrl: "https://gall.dcinside.com",
    selectors: {
      listItem: "tr.us-post",
      listLink: "a:not(.reply_numbox)",
      listTitle: "a:not(.reply_numbox)",
      contentBody: ".write_div",
      contentImages: ".write_div img",
      commentItem: ".reply_info",
      commentText: ".usertxt",
    },
    customHeaders: {
      Referer: "https://gall.dcinside.com/",
      Cookie: "PHPSESSID=dummy; ci_c=0",
      "X-Requested-With": "XMLHttpRequest",
    },
    maxItems: 3,
  },

  // ────────────────────────────────────────────
  // 3. 개드립 — HOT 베스트
  // URL: https://www.dogdrip.net/index.php?mid=hot
  // 엔진: XpressEngine 기반. 깔끔한 시맨틱 DOM.
  // 리스트: .vr_itemcard 안에 a.ed.title-link
  // 본문: .xe_content
  // 댓글: .ed.comment-item 안의 .ed.text-normal (R&D에서 11개 확인)
  // ────────────────────────────────────────────
  {
    name: "개드립 HOT",
    category: "humor",
    contentType: "humor",
    sourceSite: "개드립",
    listUrl: "https://www.dogdrip.net/index.php?mid=hot",
    baseUrl: "https://www.dogdrip.net",
    selectors: {
      listItem: ".vr_itemcard",                 // 게시물 카드 아이템
      listLink: "a.ed.title-link",              // 제목 링크
      listTitle: "a.ed.title-link",             // 제목 텍스트
      contentBody: ".xe_content",               // 상세 페이지 본문
      contentImages: ".xe_content img",          // 본문 이미지
      commentItem: ".ed.comment-item",           // 댓글 아이템
      commentText: ".ed.text-normal",            // 댓글 텍스트
    },
    customHeaders: {
      Referer: "https://www.dogdrip.net/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // 4. 더쿠 — HOT 게시판
  // URL: https://theqoo.net/hot
  // 구조: .theqoo_board_table tbody tr → td.title a
  // TD 클래스: no, cate, title, time, m_no
  // 본문: .xe_content (XE 기반)
  // 댓글: .comment_2_item 안의 댓글 텍스트
  // 카테고리 구분 가능: 이슈, 유머, 정보 등
  // ────────────────────────────────────────────
  {
    name: "더쿠 HOT",
    category: "humor",
    contentType: "humor",
    sourceSite: "더쿠",
    listUrl: "https://theqoo.net/hot",
    baseUrl: "https://theqoo.net",
    selectors: {
      listItem: ".theqoo_board_table tbody tr",  // 테이블 행
      listLink: "td.title a",                    // 제목 링크 (td.title 안의 a)
      listTitle: "td.title a",                   // 제목 텍스트
      contentBody: ".xe_content",                // 상세 페이지 본문 (XE 기반)
      contentImages: ".xe_content img",           // 본문 이미지
      commentItem: ".comment_2_item",             // 댓글 아이템
      commentText: ".text",                       // 댓글 텍스트
    },
    customHeaders: {
      Referer: "https://theqoo.net/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // 5. 웃긴대학 — 웃긴자료 (오늘의 베스트)
  // URL: https://web.humoruniv.com/board/humor/list.html?table=pds&st=day
  // 리스트: a[href*="read.html?table=pds"] (테이블 구조, 20+개)
  // 개별글 URL: read.html?table=pds&st=day&pg=0&number={ID}
  // 본문: #cnts (본문 콘텐츠 영역)
  // 댓글: "댓글마당" 섹션 — .comment_div_2 안의 댓글 텍스트
  //        댓글 베스트 3개 + 일반 댓글 구분됨 (39개 확인)
  //        댓글 길이 길고 양질 → RAG Few-Shot용 최적
  // 인코딩: EUC-KR (encoding 옵션 필요)
  // ────────────────────────────────────────────
  {
    name: "웃긴대학 웃긴자료",
    category: "humor",
    contentType: "humor",
    sourceSite: "웃긴대학",
    listUrl: "https://web.humoruniv.com/board/humor/list.html?table=pds&st=day",
    baseUrl: "https://web.humoruniv.com",
    selectors: {
      listItem: "table.list_table tr",                // 리스트 테이블 행
      listLink: "a[href*='read.html?table=pds']",     // 제목 링크 (read.html 패턴)
      listTitle: "a[href*='read.html?table=pds']",    // 제목 텍스트
      contentBody: "#cnts",                            // 상세 페이지 본문
      contentImages: "#cnts img",                      // 본문 이미지
      commentItem: ".comment_div_2",                   // 댓글마당 개별 댓글
      commentText: ".re_txt",                          // 댓글 텍스트 영역
    },
    customHeaders: {
      Referer: "https://web.humoruniv.com/",
    },
    encoding: "euc-kr",  // 웃대는 EUC-KR 인코딩 사용
    maxItems: 5,
  },

  // ════════════════════════════════════════════
  // ▼ 자동차 소스 (car 카테고리) ▼
  // 사장님들 자동차 좋아하시니까 필수 카테고리
  // ════════════════════════════════════════════

  // ────────────────────────────────────────────
  // 6. 클리앙 — 굴러간당 (자동차 게시판)
  // URL: https://www.clien.net/service/board/cm_car
  // 구조: div.list_item.symph_row → a.list_subject
  // 본문: div.post_article / 댓글: .comment_row → .comment_content
  // ────────────────────────────────────────────
  {
    name: "클리앙 굴러간당",
    category: "car",
    contentType: "humor",
    sourceSite: "클리앙",
    listUrl: "https://www.clien.net/service/board/cm_car",
    baseUrl: "https://www.clien.net",
    selectors: {
      listItem: "div.list_item.symph_row",    // 일반 글 (공지/홍보 제외)
      listLink: "a.list_subject",              // 제목 링크
      listTitle: "a.list_subject",             // 제목 텍스트
      contentBody: ".post_article",            // 상세 페이지 본문
      contentImages: ".post_article img",      // 본문 이미지
      commentItem: ".comment_row",             // 댓글 아이템
      commentText: ".comment_content",         // 댓글 텍스트
    },
    customHeaders: {
      Referer: "https://www.clien.net/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // 7. 뽐뿌 — 자동차포럼
  // URL: https://www.ppomppu.co.kr/zboard/zboard.php?id=car
  // 구조: tr.baseList → a.baseList-title
  // 본문: td.board-contents / 댓글: div.comment_wrapper → [id^="commentContent_"]
  // ────────────────────────────────────────────
  {
    name: "뽐뿌 자동차포럼",
    category: "car",
    contentType: "humor",
    sourceSite: "뽐뿌",
    listUrl: "https://www.ppomppu.co.kr/zboard/zboard.php?id=car",
    baseUrl: "https://www.ppomppu.co.kr",
    selectors: {
      listItem: "tr.baseList",                 // 글 목록 행
      listLink: "a.baseList-title",            // 제목 링크
      listTitle: "a.baseList-title",           // 제목 텍스트
      contentBody: "td.board-contents",        // 상세 페이지 본문
      contentImages: "td.board-contents img",  // 본문 이미지
      commentItem: "div.comment_wrapper",              // 댓글 wrapper
      commentText: "[id^='commentContent_']",          // 댓글 본문
    },
    customHeaders: {
      Referer: "https://www.ppomppu.co.kr/",
    },
    maxItems: 5,
  },

  // ════════════════════════════════════════════
  // ▼ 비즈니스 소스 — 아이보스 (30% 비율) ▼
  // Project DNA: 실전 마케터·자영업자·창업자 커뮤니티
  // ════════════════════════════════════════════

  // ────────────────────────────────────────────
  // 8. 아이보스 — 질문답변 (Q&A)
  // URL: https://www.i-boss.co.kr/ab-2109
  // 특징: 마케팅 실무 질문 → 원본 그대로 포스팅 + NPC가 고수 댓글
  // 구조: div.article → div.content a[href^="/ab-2110"]
  // ────────────────────────────────────────────
  {
    name: "아이보스 질문답변",
    category: "qa",
    contentType: "qa",
    sourceSite: "아이보스",
    listUrl: "https://www.i-boss.co.kr/ab-2109",
    baseUrl: "https://www.i-boss.co.kr",
    selectors: {
      listItem: "div.article",                       // 질문 카드 아이템
      listLink: "div.content a",                     // 제목+본문 링크
      listTitle: "div.content a",                    // 제목 텍스트
      contentBody: ".ABA-view-body",                 // 상세 페이지 본문
      contentImages: ".ABA-view-body img",           // 본문 이미지
      // 아이보스 댓글: .-CL 안의 .AB-cmt-view
      commentItem: ".-CL",
      commentText: ".AB-cmt-view",
    },
    customHeaders: {
      Referer: "https://www.i-boss.co.kr/",
    },
    maxItems: 5,
  },

  // ────────────────────────────────────────────
  // 9. 아이보스 — 정보공유 (마케팅 정보)
  // URL: https://www.i-boss.co.kr/ab-6140
  // 특징: 마케팅 정보·칼럼·쇼핑몰 운영 팁 → 3줄 요약 리라이팅
  // 구조: tr._t → a.mb_subject[href^="ab-6141"]
  // ────────────────────────────────────────────
  {
    name: "아이보스 정보공유",
    category: "marketing",
    contentType: "news",
    sourceSite: "아이보스",
    listUrl: "https://www.i-boss.co.kr/ab-6140",
    baseUrl: "https://www.i-boss.co.kr",
    selectors: {
      listItem: "tr._t",                            // 글 목록 테이블 행
      listLink: "a.mb_subject",                     // 제목 링크
      listTitle: "a.mb_subject",                    // 제목 텍스트
      contentBody: ".ABA-view-body",                // 상세 페이지 본문
      contentImages: ".ABA-view-body img",          // 본문 이미지
      commentItem: ".-CL",
      commentText: ".AB-cmt-view",
    },
    customHeaders: {
      Referer: "https://www.i-boss.co.kr/",
    },
    maxItems: 5,
  },
];

// ─── 팩토리 함수: Config 배열 → HtmlScraper 인스턴스 배열 ───
export function createHtmlScrapers(
  configs: HtmlScraperConfig[] = HTML_SCRAPER_CONFIGS
): HtmlScraper[] {
  return configs.map((config) => new HtmlScraper(config));
}
