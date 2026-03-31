// ================================================================
// 수집부 (The Harvester) — 스크래퍼 크론 API 라우트
// 날짜: 2026-03-31
// 용도: 외부 크론(cron-job.org)이 호출 → 랜덤 스크래퍼 1개 실행
// 패턴: Hit & Run (GET 즉시 200 → after()로 백그라운드 실행)
//
// [아키텍처 변경 2026-03-31 — 글밥 창고 시스템]
// 기존: 긁자마자 리라이팅+발행 (완급 조절 불가)
// 변경: 긁어서 content_backlog(창고)에 적재만 → 발행은 publisher-cron이 담당
// ================================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { registerScraper, pickRandomScraper } from "@/lib/scrapers/registry";
import { createRssScrapers, RSS_FEED_CONFIGS } from "@/lib/scrapers/rss-scraper";
import { createHtmlScrapers, HTML_SCRAPER_CONFIGS } from "@/lib/scrapers/html-scraper";
import type { ScrapedArticle } from "@/lib/scrapers/types";

// ─── 스크래퍼 등록 (서버 시작 시 1회) ───
// RSS + HTML 스크래퍼 모두 레지스트리에 등록
let isRegistered = false;
function ensureScrapersRegistered() {
  if (isRegistered) return;

  // 1) RSS 뉴스 스크래퍼 등록
  const rssScrapers = createRssScrapers(RSS_FEED_CONFIGS);
  for (const scraper of rssScrapers) {
    registerScraper(scraper);
  }

  // 2) HTML 커뮤니티 스크래퍼 등록 (보배드림, 디시, 클리앙, 뽐뿌, 아이보스 등)
  const htmlScrapers = createHtmlScrapers(HTML_SCRAPER_CONFIGS);
  for (const scraper of htmlScrapers) {
    registerScraper(scraper);
  }

  isRegistered = true;
  console.log("[Harvester] RSS + HTML 스크래퍼 등록 완료");
}

// ─── KST 시간 유틸 ───
function getKSTDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function getKSTHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

// ─── 수집 결과 요약 타입 ───
interface HarvestSummary {
  scraperName: string;
  category: string;
  articlesFound: number;
  newArticles: number;
  stored: number;       // 창고에 적재 성공
  skipped: number;      // 중복 또는 파싱 실패
  failed: number;
  errors: string[];
}

// ================================================================
// GET 핸들러 — 외부 크론 진입점 (Hit & Run)
// cron-job.org가 호출 → 즉시 200 반환 → after()로 백그라운드 실행
// ================================================================
export async function GET(request: NextRequest) {
  // ─── 인증 검증 ───
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      { success: false, error: "인증 실패: Authorization 헤더 불일치" },
      { status: 401 }
    );
  }

  const kstHour = getKSTHour();
  const currentDate = getKSTDate();

  // ─── after()로 백그라운드 실행 ───
  after(async () => {
    try {
      console.log(`[Harvester GET→after] 백그라운드 수집 시작 (${currentDate} KST ${kstHour}시)`);
      await runHarvestJob(true);
    } catch (err) {
      console.error("[Harvester GET→after] 백그라운드 수집 실패:", err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `수집부(Harvester) 크론 수신 → 백그라운드 실행 시작 (KST ${kstHour}시)`,
  });
}

// ================================================================
// 핵심 수집 로직 — 긁어서 content_backlog에 적재만!
// 리라이팅/발행은 publisher-cron이 별도로 처리
// ================================================================
async function runHarvestJob(fromCron: boolean = false): Promise<{
  summary: HarvestSummary | null;
  message: string;
}> {
  const currentDate = getKSTDate();
  const kstHour = getKSTHour();

  console.log(
    `[Harvester] 수집 시작 (${currentDate} KST ${kstHour}시, fromCron: ${fromCron})`
  );

  // ─── 스크래퍼 등록 확인 ───
  ensureScrapersRegistered();

  // ─── 가중치 기반 랜덤 스크래퍼 1개 선택 ───
  const scraper = pickRandomScraper();
  if (!scraper) {
    console.warn("[Harvester] 등록된 스크래퍼가 없음");
    return { summary: null, message: "등록된 스크래퍼가 없습니다." };
  }

  console.log(`[Harvester] 선택된 스크래퍼: ${scraper.name} (${scraper.category})`);

  // ─── 수집 결과 추적 ───
  const summary: HarvestSummary = {
    scraperName: scraper.name,
    category: scraper.category,
    articlesFound: 0,
    newArticles: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const supabase = createAdminSupabaseClient();

  // ================================================================
  // STEP 1: 글 목록 가져오기
  // ================================================================
  const articleList = await scraper.fetchList();
  summary.articlesFound = articleList.length;

  if (articleList.length === 0) {
    console.log(`[Harvester] ${scraper.name}: 글 없음`);
    return { summary, message: `${scraper.name}: 글 없음` };
  }

  // ================================================================
  // STEP 2: 중복 체크 — content_backlog에 이미 있는 URL 제외
  // (기존 scraped_sources도 함께 체크하여 이중 수집 방지)
  // ================================================================
  const urls = articleList.map((a) => a.sourceUrl);

  // content_backlog 중복 체크
  const { data: existingBacklog } = await supabase
    .from("content_backlog")
    .select("source_url")
    .in("source_url", urls);

  // 기존 scraped_sources도 체크 (마이그레이션 전 데이터 호환)
  const { data: existingSources } = await supabase
    .from("scraped_sources")
    .select("source_url")
    .in("source_url", urls);

  const existingUrls = new Set([
    ...(existingBacklog || []).map((r: { source_url: string }) => r.source_url),
    ...(existingSources || []).map((r: { source_url: string }) => r.source_url),
  ]);

  const newArticles = articleList.filter(
    (a) => !existingUrls.has(a.sourceUrl)
  );
  summary.newArticles = newArticles.length;
  summary.skipped = articleList.length - newArticles.length;

  if (newArticles.length === 0) {
    console.log(`[Harvester] ${scraper.name}: 새 글 없음 (모두 수집 완료)`);
    return { summary, message: `${scraper.name}: 새 글 없음` };
  }

  // ─── Hit & Run: 최대 3개만 처리 (Vercel 타임아웃 방어) ───
  const toProcess = newArticles.slice(0, 3);
  console.log(
    `[Harvester] ${toProcess.length}개 글 처리 시작 (전체 새 글: ${newArticles.length}개)`
  );

  // ================================================================
  // STEP 3: 각 글을 파싱 → content_backlog에 적재 (발행 안 함!)
  // ================================================================
  for (const item of toProcess) {
    try {
      // ─── 3-1: 본문 + 이미지 + 댓글 파싱 ───
      const article: ScrapedArticle | null = await scraper.parseContent(
        item.sourceUrl,
        item.sourceTitle
      );

      if (!article) {
        console.warn(`[Harvester] 파싱 실패: ${item.sourceTitle}`);
        summary.skipped++;
        continue;
      }

      // ─── 3-2: content_backlog(창고)에 적재 ───
      // 리라이팅/발행은 절대 하지 않음 → publisher-cron 담당
      const { error: insertError } = await supabase
        .from("content_backlog")
        .insert({
          source_url: article.sourceUrl,
          source_name: article.sourceSite,      // 출처 사이트명
          source_site: scraper.name,             // 스크래퍼 이름
          title: article.sourceTitle,
          body_html: article.sourceBody,
          images: article.sourceImages || [],
          source_comments: article.sourceComments || [],  // ⭐ 댓글 반드시 저장
          category: article.category,
          content_type: article.contentType,      // qa | news | humor
          scrape_track: "easy",                   // Easy Track (HTML/RSS)
          is_published: false,                    // 아직 발행 안 됨 (창고 대기)
        });

      if (insertError) {
        // UNIQUE 위반 (중복 URL) 등
        console.warn(
          `[Harvester] 창고 적재 실패 (중복?): ${insertError.message}`
        );
        summary.skipped++;
        continue;
      }

      summary.stored++;
      console.log(
        `[Harvester] 📦 창고 적재 완료: "${article.sourceTitle}" ` +
        `(본문 ${article.sourceBody.length}자, 이미지 ${article.sourceImages.length}장, ` +
        `댓글 ${article.sourceComments.length}개) [${article.category}/${article.contentType}]`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Harvester] 글 처리 중 에러:`, errMsg);
      summary.failed++;
      summary.errors.push(errMsg);
    }
  }

  // ─── 수집 완료 ───
  const resultMsg = `${scraper.name}: ${summary.stored}개 적재, ${summary.skipped}개 스킵, ${summary.failed}개 실패`;
  console.log(
    `[Harvester] 수집 완료 — 발견${summary.articlesFound}, 새글${summary.newArticles}, 적재${summary.stored}, 스킵${summary.skipped}, 실패${summary.failed}`
  );

  return { summary, message: resultMsg };
}

// ================================================================
// POST 핸들러 — 수동 테스트용
// ================================================================
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        { success: false, error: "인증 실패" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const currentDate = getKSTDate();
    const kstHour = getKSTHour();

    const result = await runHarvestJob(body.fromCron || false);

    return Response.json({
      success: true,
      currentDate,
      kstHour,
      ...result,
    });
  } catch (error) {
    console.error("[Harvester POST] 예외 발생:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    );
  }
}
