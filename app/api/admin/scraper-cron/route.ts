// ================================================================
// 콘텐츠 팜 — 스크래퍼 크론 API 라우트
// 날짜: 2026-03-30
// 용도: 외부 크론(cron-job.org)이 호출 → 랜덤 스크래퍼 1개 실행
// 패턴: Hit & Run (GET 즉시 200 → 백그라운드 POST로 실제 작업)
//
// [변경사항 2026-03-30]
// - HtmlScraper 등록 추가 (보배드림, 개드립, 디시 실베)
// - posts INSERT 시 category 컬럼 직접 삽입 방식으로 전환
// - 기존 CATEGORY_COMMUNITY_MAP은 뉴스 스크래퍼용으로 유지
// - 유머/자유 카테고리는 community_id 없이 category만으로 발행
// ================================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { registerScraper, pickRandomScraper } from "@/lib/scrapers/registry";
import { createRssScrapers, RSS_FEED_CONFIGS } from "@/lib/scrapers/rss-scraper";
import { createHtmlScrapers, HTML_SCRAPER_CONFIGS } from "@/lib/scrapers/html-scraper";
import { rewriteArticle } from "@/lib/scrapers/rewriter";
import type { RewriterPersona } from "@/lib/scrapers/rewriter";
import type { ScrapedArticle, ScraperCronSummary } from "@/lib/scrapers/types";

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

  // 2) HTML 커뮤니티 스크래퍼 등록 (보배드림, 개드립, 디시)
  const htmlScrapers = createHtmlScrapers(HTML_SCRAPER_CONFIGS);
  for (const scraper of htmlScrapers) {
    registerScraper(scraper);
  }

  isRegistered = true;
  console.log("[Scraper Cron] RSS + HTML 스크래퍼 등록 완료");
}

// ─── KST 시간 유틸 ───
function getKSTDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0]; // "2026-03-30"
}

function getKSTHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

// ─── 카테고리 → 커뮤니티 ID 매핑 (뉴스 스크래퍼용, 기존 호환) ───
// 뉴스 카테고리는 전용 커뮤니티 게시판에 발행
// 유머/자유 카테고리는 여기에 없으므로 community_id 없이 category만으로 발행됨
const CATEGORY_COMMUNITY_MAP: Record<string, string> = {
  car: "acc85d23-5cb1-43c9-a86b-96464a5e79d0",        // 자동차 매니아
  ai: "e92e136f-df36-4c8c-a5ad-cb8d999649b9",         // 초급AI 실전반
  marketing: "c5a698b8-8047-41cf-83cb-548eca27e2e1",   // 마케팅
  business: "51c60f49-c1ba-407b-9de2-396657f15102",    // 사업
};

// ─── 스크래퍼 카테고리 → posts.category 값 매핑 ───
// posts 테이블의 category 컬럼에 들어갈 한글 값
// 기존 카테고리(뉴스)도 한글 카테고리를 넣어줌
const CATEGORY_LABEL_MAP: Record<string, string> = {
  humor: "유머",
  free: "자유",
  car: "자동차",
  ai: "AI",
  marketing: "마케팅",
  business: "사업",
};

// ================================================================
// GET 핸들러 — 외부 크론 진입점 (Hit & Run)
// cron-job.org가 호출 → 즉시 200 반환 → after()로 백그라운드 실행
//
// [핵심 변경 2026-03-30]
// 기존: self-call fetch(POST) → ECONNRESET 에러 발생
// 변경: Next.js 16 after() API 사용 → 응답 전송 후 백그라운드 실행
// after()는 Vercel에서 waitUntil로 동작 → 서버리스 타임아웃까지 실행 보장
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
  // 응답을 먼저 보내고, 스크래핑 작업은 백그라운드에서 실행
  // self-call fetch 제거 → ECONNRESET 문제 완전 해결
  after(async () => {
    try {
      console.log(`[Scraper Cron GET→after] 백그라운드 실행 시작 (${currentDate} KST ${kstHour}시)`);
      await runScraperJob(true);
    } catch (err) {
      console.error("[Scraper Cron GET→after] 백그라운드 실행 실패:", err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `스크래퍼 크론 수신 → 백그라운드 실행 시작 (KST ${kstHour}시)`,
  });
}

// ================================================================
// 핵심 스크래핑 로직 — GET(after)과 POST 모두 이 함수를 호출
// GET → after() 콜백에서 호출 (백그라운드)
// POST → 직접 호출 (수동 테스트용, 결과 JSON 반환)
// ================================================================
async function runScraperJob(fromCron: boolean = false): Promise<{
  summary: ScraperCronSummary | null;
  message: string;
}> {
  const currentDate = getKSTDate();
  const kstHour = getKSTHour();

  console.log(
    `[Scraper Cron] 실행 시작 (${currentDate} KST ${kstHour}시, fromCron: ${fromCron})`
  );

  // ─── 스크래퍼 등록 확인 (RSS + HTML 모두) ───
  ensureScrapersRegistered();

  // ─── 랜덤 스크래퍼 1개 선택 (Hit & Run) ───
  const scraper = pickRandomScraper();
  if (!scraper) {
    console.warn("[Scraper Cron] 등록된 스크래퍼가 없음");
    return { summary: null, message: "등록된 스크래퍼가 없습니다." };
  }

  console.log(`[Scraper Cron] 선택된 스크래퍼: ${scraper.name} (${scraper.category})`);

  // ─── 실행 결과 추적 ───
  const summary: ScraperCronSummary = {
    scraperName: scraper.name,
    category: scraper.category,
    articlesFound: 0,
    newArticles: 0,
    rewritten: 0,
    posted: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const supabase = createAdminSupabaseClient();

  // ================================================================
  // STEP 1: 글 목록 가져오기
  // ================================================================
  const articleList = await scraper.fetchList();
  summary.articlesFound = articleList.length;

  if (articleList.length === 0) {
    console.log(`[Scraper Cron] ${scraper.name}: 기사 없음`);
    return { summary, message: `${scraper.name}: 기사 없음` };
  }

  // ================================================================
  // STEP 2: 중복 체크 — 이미 수집한 URL 제외
  // ================================================================
  const urls = articleList.map((a) => a.sourceUrl);
  const { data: existingRows } = await supabase
    .from("scraped_sources")
    .select("source_url")
    .in("source_url", urls);

  const existingUrls = new Set(
    (existingRows || []).map((r: { source_url: string }) => r.source_url)
  );

  const newArticles = articleList.filter(
    (a) => !existingUrls.has(a.sourceUrl)
  );
  summary.newArticles = newArticles.length;
  summary.skipped = articleList.length - newArticles.length;

  if (newArticles.length === 0) {
    console.log(`[Scraper Cron] ${scraper.name}: 새 기사 없음 (모두 수집 완료)`);
    return { summary, message: `${scraper.name}: 새 기사 없음` };
  }

  // ─── Hit & Run: 최대 2개만 처리 (Vercel 타임아웃 방어) ───
  const toProcess = newArticles.slice(0, 2);
  console.log(
    `[Scraper Cron] ${toProcess.length}개 기사 처리 시작 (전체 새 기사: ${newArticles.length}개)`
  );

  // ================================================================
  // STEP 3: 각 기사를 순차 처리 (파싱 → DB 저장 → 리라이팅 → 발행)
  // ================================================================
  for (const item of toProcess) {
    try {
      // ─── 3-1: 본문 파싱 ───
      const article: ScrapedArticle | null = await scraper.parseContent(
        item.sourceUrl,
        item.sourceTitle
      );

      if (!article) {
        // 파싱 실패 → DB에 skipped로 기록
        await supabase.from("scraped_sources").insert({
          source_url: item.sourceUrl,
          source_site: scraper.name,
          source_title: item.sourceTitle,
          category: scraper.category,
          status: "skipped",
          error_message: "본문 파싱 실패 또는 본문 너무 짧음",
        });
        summary.skipped++;
        continue;
      }

      // ─── 3-2: DB에 pending으로 저장 ───
      const { data: insertedRow, error: insertError } = await supabase
        .from("scraped_sources")
        .insert({
          source_url: article.sourceUrl,
          source_site: article.sourceSite,
          source_title: article.sourceTitle,
          source_body: article.sourceBody,
          source_images: article.sourceImages,
          category: article.category,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        // UNIQUE 위반 등 — 이미 존재하는 URL
        console.warn(
          `[Scraper Cron] DB 저장 실패 (중복?): ${insertError.message}`
        );
        summary.skipped++;
        continue;
      }

      const sourceId = insertedRow.id;

      // ─── 3-3: 활성 NPC 중 랜덤 1명 배정 ───
      const { data: personas } = await supabase
        .from("personas")
        .select("id, user_id, nickname, personality, industry, prompt, core_interests")
        .eq("is_active", true);

      if (!personas || personas.length === 0) {
        console.warn("[Scraper Cron] 활성 NPC가 없음 — 리라이팅 불가");
        await supabase
          .from("scraped_sources")
          .update({ status: "failed", error_message: "활성 NPC 없음" })
          .eq("id", sourceId);
        summary.failed++;
        continue;
      }

      // 랜덤 NPC 선택
      const persona = personas[
        Math.floor(Math.random() * personas.length)
      ] as unknown as RewriterPersona;

      // 상태 → rewriting으로 변경
      await supabase
        .from("scraped_sources")
        .update({
          status: "rewriting",
          assigned_persona_id: persona.id,
        })
        .eq("id", sourceId);

      // ─── 3-4: AI 리라이팅 (브레인워싱) ───
      const rewriteResult = await rewriteArticle(article, persona);

      if (!rewriteResult) {
        await supabase
          .from("scraped_sources")
          .update({
            status: "failed",
            error_message: "AI 리라이팅 실패 (모든 프로바이더)",
          })
          .eq("id", sourceId);
        summary.failed++;
        summary.errors.push(`리라이팅 실패: ${article.sourceTitle}`);
        continue;
      }

      summary.rewritten++;

      // 리라이팅 결과 DB에 저장
      await supabase
        .from("scraped_sources")
        .update({
          rewritten_title: rewriteResult.title,
          rewritten_body: rewriteResult.body,
          rewritten_at: new Date().toISOString(),
        })
        .eq("id", sourceId);

      // ─── 3-5: 게시글 발행 ───
      // 커뮤니티 ID 결정: 뉴스 카테고리는 전용 커뮤니티에, 유머/자유는 null
      const communityId = CATEGORY_COMMUNITY_MAP[scraper.category] || null;

      // posts.category에 넣을 한글 카테고리 값
      const postCategory = CATEGORY_LABEL_MAP[scraper.category] || "자유";

      // posts 테이블에 게시글 삽입
      // community_id가 있으면 넣고, 없으면 생략 (유머/자유)
      // category 컬럼에 직접 한글 카테고리 삽입
      const postData: Record<string, unknown> = {
        title: rewriteResult.title,
        content: rewriteResult.body,
        author_id: (persona as unknown as { user_id: string }).user_id,
        category: postCategory,      // ← 핵심 변경: category 직접 삽입
        comment_count: 0,
        upvotes: 0,
      };

      // 커뮤니티 ID가 있는 카테고리(뉴스)는 community_id도 넣기
      if (communityId) {
        postData.community_id = communityId;
      }

      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert(postData)
        .select("id")
        .single();

      if (postError) {
        console.error(
          `[Scraper Cron] 게시글 발행 실패: ${postError.message}`
        );
        await supabase
          .from("scraped_sources")
          .update({
            status: "failed",
            error_message: `게시글 발행 실패: ${postError.message}`,
          })
          .eq("id", sourceId);
        summary.failed++;
        summary.errors.push(`발행 실패: ${rewriteResult.title}`);
        continue;
      }

      // 성공! → scraped_sources 상태 업데이트
      await supabase
        .from("scraped_sources")
        .update({
          status: "posted",
          result_post_id: newPost.id,
          posted_at: new Date().toISOString(),
          assigned_community_id: communityId,
        })
        .eq("id", sourceId);

      // NPC 일일 카운터 증가 (today_posts + 1)
      try {
        const { data: currentPersona } = await supabase
          .from("personas")
          .select("today_posts")
          .eq("id", persona.id)
          .single();
        const currentCount = (currentPersona?.today_posts as number) || 0;
        await supabase
          .from("personas")
          .update({ today_posts: currentCount + 1 })
          .eq("id", persona.id);
      } catch {
        console.warn("[Scraper Cron] today_posts 증가 실패 — 스킵");
      }

      summary.posted++;
      console.log(
        `[Scraper Cron] ✅ 발행 완료: "${rewriteResult.title}" by ${persona.nickname} [${postCategory}]`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Scraper Cron] 기사 처리 중 에러:`, errMsg);
      summary.failed++;
      summary.errors.push(errMsg);
    }
  }

  // ─── 실행 완료 ───
  const resultMsg = `${scraper.name}: ${summary.posted}개 발행, ${summary.rewritten}개 리라이팅, ${summary.failed}개 실패`;
  console.log(
    `[Scraper Cron] 실행 완료 — 발견${summary.articlesFound}, 새기사${summary.newArticles}, 리라이팅${summary.rewritten}, 발행${summary.posted}, 실패${summary.failed}`
  );

  return { summary, message: resultMsg };
}

// ================================================================
// POST 핸들러 — 수동 테스트용 (직접 호출하면 결과 JSON 반환)
// 수동으로 curl이나 브라우저에서 POST 호출 시 사용
// ================================================================
export async function POST(request: NextRequest) {
  try {
    // ─── 인증 ───
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

    // ─── 핵심 로직 실행 (동기 — 결과를 기다려서 반환) ───
    const result = await runScraperJob(body.fromCron || false);

    return Response.json({
      success: true,
      currentDate,
      kstHour,
      ...result,
    });
  } catch (error) {
    console.error("[Scraper Cron POST] 예외 발생:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    );
  }
}
