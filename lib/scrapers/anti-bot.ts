// ================================================================
// Anti-Bot 헤더 유틸리티 — 봇 차단 우회 모듈
// 날짜: 2026-03-31
// 용도: 스크래퍼가 평범한 크롬 브라우저처럼 보이도록 위장
// 핵심: 랜덤 User-Agent + 현실적인 헤더 조합 + 요청간 Jitter
// ================================================================

// ─── 최신 Chrome User-Agent 풀 (2025~2026년 기준) ───
// 같은 UA를 계속 쓰면 핑거프린팅에 걸리므로 랜덤 로테이션
const USER_AGENT_POOL = [
  // Chrome 131 (Windows 10)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Chrome 130 (Windows 11)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  // Chrome 131 (macOS Sonoma)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Chrome 129 (Windows 10)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  // Chrome 130 (macOS Ventura)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Safari/537.36",
  // Edge 131 (Windows 10) — 엣지도 섞어서 다양성 확보
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  // Chrome 128 (Windows 10)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  // Chrome 131 (Linux)
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

// ─── 검색엔진 Referer 풀 ───
// 구글/네이버 검색에서 유입된 것처럼 위장 (직접 URL 입력보다 자연스러움)
const SEARCH_REFERERS = [
  "https://www.google.com/",
  "https://www.google.co.kr/",
  "https://search.naver.com/search.naver",
  "https://www.google.com/search?q=",
  "https://search.daum.net/search",
];

// ─── Accept-Language 다양화 ───
const ACCEPT_LANGUAGES = [
  "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "ko-KR,ko;q=0.9,en;q=0.8",
  "ko,en-US;q=0.9,en;q=0.8",
  "ko-KR,ko;q=0.95,en-US;q=0.8,en;q=0.7,ja;q=0.3",
];

// ─── 유틸: 배열에서 랜덤 하나 뽑기 ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ================================================================
// 랜덤 Anti-Bot 헤더 생성
// 매 요청마다 호출하여 다른 조합의 헤더를 만들어냄
// siteReferer: 사이트별 고정 Referer (없으면 검색엔진에서 온 척)
// ================================================================
export function generateAntiBotHeaders(
  siteReferer?: string
): Record<string, string> {
  const ua = pickRandom(USER_AGENT_POOL);

  // Sec-Ch-Ua는 User-Agent의 Chrome 버전과 매칭해야 자연스러움
  const chromeVersionMatch = ua.match(/Chrome\/(\d+)/);
  const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : "131";

  return {
    // ─── 핵심: 랜덤 User-Agent ───
    "User-Agent": ua,

    // ─── Accept: 브라우저 기본값과 동일하게 ───
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

    // ─── Accept-Language: 한국어 우선 (랜덤) ───
    "Accept-Language": pickRandom(ACCEPT_LANGUAGES),

    // ─── Accept-Encoding: gzip/deflate만! ───
    // brotli(br)는 Node.js fetch에서 디코딩 실패할 수 있으므로 제외
    "Accept-Encoding": "gzip, deflate",

    // ─── Referer: 사이트 내부 or 검색엔진 랜덤 ───
    Referer: siteReferer || pickRandom(SEARCH_REFERERS),

    // ─── Cache-Control: 새로고침 패턴 ───
    "Cache-Control": "no-cache",
    Pragma: "no-cache",

    // ─── Sec-Ch-Ua: Chrome 버전 매칭 (안 맞으면 봇 의심) ───
    "Sec-Ch-Ua": `"Chromium";v="${chromeVersion}", "Not_A Brand";v="24"`,
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',

    // ─── Sec-Fetch: 일반적인 페이지 이동 패턴 ───
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",

    // ─── 기타: 사람 냄새 추가 ───
    "Upgrade-Insecure-Requests": "1",
    Connection: "keep-alive",
    DNT: "1",
  };
}

// ================================================================
// 랜덤 딜레이(Jitter) — 기계적인 요청 패턴 방지
// 사람은 일정한 간격으로 클릭하지 않으므로 랜덤 지연 삽입
// minMs~maxMs 사이의 랜덤 밀리초만큼 대기
// ================================================================
export async function randomJitter(
  minMs: number = 300,
  maxMs: number = 1500
): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ================================================================
// Referer 위장 헬퍼 — 사이트 내부 vs 검색엔진
// 7:3 비율로 사이트 내부 Referer 우선 사용
// ================================================================
export function getSmartReferer(baseUrl: string): string {
  if (Math.random() < 0.7) {
    return baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  }
  return pickRandom(SEARCH_REFERERS);
}
