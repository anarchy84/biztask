// ================================================================
// 뉴스클리핑 크론 — 수집 → 저장 → 분류 → 클러스터링 → 요약
// 날짜: 2026-04-01
// 실행 주기: 매일 새벽 6시 + 오후 2시 (KST), 하루 2회
// 패턴: Hit & Run (GET 즉시 200 → after()로 백그라운드 실행)
//
// [파이프라인]
// STEP 1: 7개 소스에서 뉴스 기사 수집 (scrapeAllNews)
// STEP 2: news_articles 테이블에 저장 (중복 링크는 건너뜀)
// STEP 3: AI 카테고리 자동 분류 (LLM)
// STEP 4: 미클러스터링 기사 → AI 클러스터링 + 3줄 요약
// STEP 5: news_clips 테이블에 저장 + FK 연결
// ================================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { scrapeAllNews } from "@/lib/scrapers/news-scraper";
import type { NewsArticle } from "@/lib/scrapers/news-scraper";
import { clusterAndSummarizeArticles } from "@/lib/scrapers/news-summarizer";

// ─── KST 시간 유틸 ───
function getKSTDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function getKSTHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

// ─── 실행 결과 요약 ───
interface NewsClipCronSummary {
  totalScraped: number;       // 수집된 기사 수
  newlySaved: number;         // 새로 저장된 기사 수
  duplicatesSkipped: number;  // 중복으로 건너뛴 수
  clipsCreated: number;       // 생성된 뉴스 클립 수
  errors: string[];           // 에러 목록
}

// ================================================================
// GET 핸들러 — 외부 크론 진입점 (Hit & Run)
// cron-job.org에서 호출 → 즉시 200 → after()로 백그라운드 실행
// ================================================================
export async function GET(request: NextRequest) {
  // ─── 인증 검증 ───
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      { success: false, error: "인증 실패" },
      { status: 401 }
    );
  }

  const kstHour = getKSTHour();
  const currentDate = getKSTDate();

  // ─── after()로 백그라운드 실행 ───
  after(async () => {
    try {
      console.log(`[뉴스크론] ========== 백그라운드 시작 (${currentDate} KST ${kstHour}시) ==========`);
      const summary = await runNewsClipPipeline();
      console.log("[뉴스크론] 결과:", JSON.stringify(summary, null, 2));
    } catch (err) {
      console.error("[뉴스크론] 파이프라인 실패:", err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `뉴스클리핑 크론 수신 → 백그라운드 실행 시작 (KST ${kstHour}시)`,
  });
}

// ================================================================
// POST 핸들러 — 수동 실행 (Admin 패널에서 호출)
// ================================================================
export async function POST(request: NextRequest) {
  // ─── 인증: Admin만 ───
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
  }

  try {
    console.log("[뉴스크론] ========== 수동 실행 시작 ==========");
    const summary = await runNewsClipPipeline();
    return Response.json({ success: true, summary });
  } catch (err) {
    return Response.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}

// ================================================================
// 메인 파이프라인: 수집 → 저장 → 분류 → 클러스터링 → 요약
// ================================================================

async function runNewsClipPipeline(): Promise<NewsClipCronSummary> {
  const summary: NewsClipCronSummary = {
    totalScraped: 0,
    newlySaved: 0,
    duplicatesSkipped: 0,
    clipsCreated: 0,
    errors: [],
  };

  const supabase = createAdminSupabaseClient();

  // ─────────────────────────────────────────────
  // STEP 1: 7개 소스에서 뉴스 기사 수집
  // ─────────────────────────────────────────────
  console.log("[뉴스크론] STEP 1: 뉴스 수집 시작...");
  let scrapedArticles: NewsArticle[] = [];
  try {
    scrapedArticles = await scrapeAllNews();
    summary.totalScraped = scrapedArticles.length;
    console.log(`[뉴스크론] STEP 1 완료: ${scrapedArticles.length}개 기사 수집`);
  } catch (err) {
    const msg = `수집 실패: ${err instanceof Error ? err.message : String(err)}`;
    summary.errors.push(msg);
    console.error(`[뉴스크론] ${msg}`);
    return summary;
  }

  if (scrapedArticles.length === 0) {
    console.log("[뉴스크론] 수집된 기사 없음 — 종료");
    return summary;
  }

  // ─────────────────────────────────────────────
  // STEP 2: news_articles 테이블에 저장 (중복 건너뜀)
  // ─────────────────────────────────────────────
  console.log("[뉴스크론] STEP 2: DB 저장 시작...");

  for (const article of scrapedArticles) {
    try {
      // upsert 대신 insert + onConflict 무시 (중복 링크는 건너뜀)
      const { error } = await supabase
        .from("news_articles")
        .upsert(
          {
            title: article.title,
            link: article.link,
            source_name: article.source_name,
            thumbnail_url: article.thumbnail_url,
            snippet: article.snippet,
            published_at: article.published_at,
            feed_source: article.feed_source,
            category: article.category,
            is_clustered: false,
          },
          { onConflict: "link", ignoreDuplicates: true }
        );

      if (error) {
        // 중복 에러가 아닌 진짜 에러만 기록
        if (!error.message.includes("duplicate") && !error.message.includes("conflict")) {
          summary.errors.push(`DB 저장 실패 [${article.title.slice(0, 30)}]: ${error.message}`);
        } else {
          summary.duplicatesSkipped++;
        }
      } else {
        summary.newlySaved++;
      }
    } catch (err) {
      summary.errors.push(`예외 [${article.title.slice(0, 30)}]: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `[뉴스크론] STEP 2 완료: 새로 저장 ${summary.newlySaved}개, 중복 건너뜀 ${summary.duplicatesSkipped}개`
  );

  // ─────────────────────────────────────────────
  // STEP 3+4: 미클러스터링 기사 → AI 클러스터링 + 요약
  // ─────────────────────────────────────────────
  console.log("[뉴스크론] STEP 3: 미클러스터링 기사 조회...");

  const { data: unclusteredArticles, error: fetchErr } = await supabase
    .from("news_articles")
    .select("id, title, snippet, source_name, category")
    .eq("is_clustered", false)
    .order("created_at", { ascending: false })
    .limit(100); // 한 번에 최대 100개 처리

  if (fetchErr || !unclusteredArticles || unclusteredArticles.length === 0) {
    console.log("[뉴스크론] 클러스터링할 기사 없음 — 종료");
    return summary;
  }

  console.log(`[뉴스크론] STEP 3: ${unclusteredArticles.length}개 기사 클러스터링 시작`);

  try {
    const clusters = await clusterAndSummarizeArticles(unclusteredArticles);
    console.log(`[뉴스크론] STEP 4: ${clusters.length}개 클러스터 생성됨`);

    // ─────────────────────────────────────────────
    // STEP 5: news_clips 생성 + news_articles FK 연결
    // ─────────────────────────────────────────────
    for (const cluster of clusters) {
      try {
        // 5-1) news_clips에 INSERT
        const { data: clipData, error: clipErr } = await supabase
          .from("news_clips")
          .insert({
            headline: cluster.headline,
            summary: cluster.summary,
            category: cluster.category,
            thumbnail_url: cluster.thumbnailUrl,
            article_count: cluster.articleIds.length,
            importance_score: cluster.articleIds.length * 1.5, // 기사 수 기반 중요도
            clip_date: getKSTDate(),
            status: "published",
          })
          .select("id")
          .single();

        if (clipErr || !clipData) {
          summary.errors.push(`클립 생성 실패: ${clipErr?.message || "unknown"}`);
          continue;
        }

        // 5-2) 해당 기사들의 clip_id + is_clustered 업데이트
        const { error: updateErr } = await supabase
          .from("news_articles")
          .update({ clip_id: clipData.id, is_clustered: true })
          .in("id", cluster.articleIds);

        if (updateErr) {
          summary.errors.push(`기사 FK 업데이트 실패: ${updateErr.message}`);
        }

        summary.clipsCreated++;
      } catch (err) {
        summary.errors.push(
          `클러스터 처리 중 예외: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // 클러스터에 포함되지 않은 기사들도 is_clustered = true로 마킹
    // (단독 기사이거나 그룹에 안 잡힌 기사 — 다음 크론에서 중복 처리 방지)
    const allClusteredIds = clusters.flatMap((c) => c.articleIds);
    const unhandledIds = unclusteredArticles
      .map((a) => a.id)
      .filter((id) => !allClusteredIds.includes(id));

    if (unhandledIds.length > 0) {
      await supabase
        .from("news_articles")
        .update({ is_clustered: true })
        .in("id", unhandledIds);
      console.log(`[뉴스크론] 미처리 기사 ${unhandledIds.length}개 → is_clustered=true 마킹`);
    }

  } catch (err) {
    summary.errors.push(`클러스터링 전체 실패: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log(`[뉴스크론] ========== 파이프라인 완료 ==========`);
  console.log(`  수집: ${summary.totalScraped}개 → 새 저장: ${summary.newlySaved}개`);
  console.log(`  클립 생성: ${summary.clipsCreated}개`);
  if (summary.errors.length > 0) {
    console.log(`  에러: ${summary.errors.length}건`);
  }

  return summary;
}
