// ================================================================
// 전체 스크래퍼 대규모 통합 테스트
// 목표: 글 ~30개, 댓글 ~50개 수집하여 실전 파이프라인 검증
// 실행: npx tsx test-all-scrapers.ts
// ================================================================

import { HtmlScraper, HTML_SCRAPER_CONFIGS } from "./lib/scrapers/html-scraper";
import type { ScrapedArticle } from "./lib/scrapers/types";

// ─── 집계용 카운터 ───
interface TestStats {
  scraperName: string;
  category: string;
  listCount: number;          // fetchList()로 발견한 글 수
  parsedCount: number;        // parseContent() 성공한 글 수
  failedCount: number;        // parseContent() 실패한 글 수
  totalBodyChars: number;     // 본문 총 글자 수
  totalImages: number;        // 이미지 총 개수
  totalComments: number;      // 댓글 총 개수
  articles: ScrapedArticle[]; // 수집된 글 배열
  errors: string[];           // 에러 메시지 모음
  elapsedMs: number;          // 소요 시간
}

// ─── 구분선 출력 유틸 ───
function divider(char = "═", len = 60) {
  return char.repeat(len);
}

// ─── 개별 스크래퍼 테스트 ───
async function testScraper(config: (typeof HTML_SCRAPER_CONFIGS)[number]): Promise<TestStats> {
  const scraper = new HtmlScraper(config);
  const stats: TestStats = {
    scraperName: config.name,
    category: config.category,
    listCount: 0,
    parsedCount: 0,
    failedCount: 0,
    totalBodyChars: 0,
    totalImages: 0,
    totalComments: 0,
    articles: [],
    errors: [],
    elapsedMs: 0,
  };

  const startTime = Date.now();

  try {
    // 1단계: 글 목록 수집
    const list = await scraper.fetchList();
    stats.listCount = list.length;

    if (list.length === 0) {
      stats.errors.push("글 목록 비어있음 — 셀렉터 또는 URL 확인 필요");
      stats.elapsedMs = Date.now() - startTime;
      return stats;
    }

    // 2단계: 각 글의 본문 + 댓글 파싱 (최대 5개씩)
    const maxParse = Math.min(list.length, config.maxItems || 5);
    for (let i = 0; i < maxParse; i++) {
      const item = list[i];

      try {
        const parsed = await scraper.parseContent(item.sourceUrl, item.sourceTitle);

        if (parsed) {
          stats.parsedCount++;
          stats.totalBodyChars += parsed.sourceBody.length;
          stats.totalImages += parsed.sourceImages.length;
          stats.totalComments += parsed.sourceComments.length;
          stats.articles.push(parsed);
        } else {
          stats.failedCount++;
        }
      } catch (err) {
        stats.failedCount++;
        stats.errors.push(
          `[${item.sourceTitle.substring(0, 30)}] ${err instanceof Error ? err.message : String(err)}`
        );
      }

      // 사이트 부담 줄이기: 요청 사이 0.5초 대기
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (err) {
    stats.errors.push(`치명적 오류: ${err instanceof Error ? err.message : String(err)}`);
  }

  stats.elapsedMs = Date.now() - startTime;
  return stats;
}

// ─── 메인 실행 ───
async function main() {
  console.log(divider());
  console.log("  전체 스크래퍼 대규모 통합 테스트");
  console.log(`  대상: ${HTML_SCRAPER_CONFIGS.length}개 스크래퍼`);
  console.log(`  목표: 글 ~30개 / 댓글 ~50개`);
  console.log(`  시작 시각: ${new Date().toLocaleString("ko-KR")}`);
  console.log(divider());

  const allStats: TestStats[] = [];
  const globalStart = Date.now();

  // 스크래퍼별 순차 테스트
  for (let idx = 0; idx < HTML_SCRAPER_CONFIGS.length; idx++) {
    const config = HTML_SCRAPER_CONFIGS[idx];
    console.log(`\n${divider("─")}`);
    console.log(`▶ [${idx + 1}/${HTML_SCRAPER_CONFIGS.length}] ${config.name}`);
    console.log(`  카테고리: ${config.category} | URL: ${config.listUrl}`);
    console.log(divider("─"));

    const stats = await testScraper(config);
    allStats.push(stats);

    // 개별 결과 요약
    const status = stats.parsedCount > 0 ? "✅" : "❌";
    console.log(
      `  ${status} 목록: ${stats.listCount}개 → 파싱 성공: ${stats.parsedCount}개 / 실패: ${stats.failedCount}개`
    );
    console.log(
      `  📊 본문: ${stats.totalBodyChars.toLocaleString()}자 | 이미지: ${stats.totalImages}장 | 댓글: ${stats.totalComments}개`
    );
    console.log(`  ⏱️ ${(stats.elapsedMs / 1000).toFixed(1)}초`);

    if (stats.errors.length > 0) {
      stats.errors.forEach((e) => console.log(`  ⚠️ ${e}`));
    }

    // 수집된 글 제목 출력
    stats.articles.forEach((a, i) => {
      const cmtTag = a.sourceComments.length > 0 ? ` 💬${a.sourceComments.length}` : "";
      const imgTag = a.sourceImages.length > 0 ? ` 🖼️${a.sourceImages.length}` : "";
      console.log(
        `    ${i + 1}. "${a.sourceTitle.substring(0, 45)}${a.sourceTitle.length > 45 ? "..." : ""}" (${a.sourceBody.length}자${imgTag}${cmtTag})`
      );
    });

    // 사이트간 간격: 1초 대기
    if (idx < HTML_SCRAPER_CONFIGS.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ─── 전체 집계 리포트 ───
  const totalElapsed = Date.now() - globalStart;
  const totalArticles = allStats.reduce((s, r) => s + r.parsedCount, 0);
  const totalFailed = allStats.reduce((s, r) => s + r.failedCount, 0);
  const totalChars = allStats.reduce((s, r) => s + r.totalBodyChars, 0);
  const totalImages = allStats.reduce((s, r) => s + r.totalImages, 0);
  const totalComments = allStats.reduce((s, r) => s + r.totalComments, 0);

  // 카테고리별 집계
  const byCat: Record<string, { articles: number; comments: number; chars: number }> = {};
  allStats.forEach((s) => {
    if (!byCat[s.category]) byCat[s.category] = { articles: 0, comments: 0, chars: 0 };
    byCat[s.category].articles += s.parsedCount;
    byCat[s.category].comments += s.totalComments;
    byCat[s.category].chars += s.totalBodyChars;
  });

  // 전체 댓글 샘플 (RAG 품질 확인용)
  const allComments: { site: string; text: string }[] = [];
  allStats.forEach((s) => {
    s.articles.forEach((a) => {
      a.sourceComments.forEach((c) => {
        allComments.push({ site: a.sourceSite, text: c });
      });
    });
  });

  console.log(`\n\n${divider("█")}`);
  console.log("  📋 전체 테스트 결과 리포트");
  console.log(divider("█"));

  console.log(`\n  ⏱️ 총 소요시간: ${(totalElapsed / 1000).toFixed(1)}초`);
  console.log(`  📰 수집된 글: ${totalArticles}개 (실패: ${totalFailed}개)`);
  console.log(`  📝 총 본문: ${totalChars.toLocaleString()}자`);
  console.log(`  🖼️ 총 이미지: ${totalImages}장`);
  console.log(`  💬 총 댓글: ${totalComments}개`);

  // 목표 달성 여부
  console.log(`\n  🎯 목표 달성:`);
  console.log(`     글 30개 목표 → ${totalArticles}개 ${totalArticles >= 25 ? "✅" : "⚠️ 미달"}`);
  console.log(`     댓글 50개 목표 → ${totalComments}개 ${totalComments >= 40 ? "✅" : "⚠️ 미달"}`);

  // 카테고리별 분포
  console.log(`\n  📊 카테고리별 분포:`);
  Object.entries(byCat)
    .sort((a, b) => b[1].articles - a[1].articles)
    .forEach(([cat, data]) => {
      console.log(
        `     ${cat}: 글 ${data.articles}개 | 댓글 ${data.comments}개 | ${data.chars.toLocaleString()}자`
      );
    });

  // 스크래퍼별 성적표
  console.log(`\n  📈 스크래퍼별 성적표:`);
  console.log(`  ${"스크래퍼".padEnd(22)} ${"글".padStart(4)} ${"댓글".padStart(5)} ${"이미지".padStart(6)} ${"본문".padStart(8)} ${"시간".padStart(6)}`);
  console.log(`  ${"-".repeat(55)}`);
  allStats.forEach((s) => {
    const status = s.parsedCount > 0 ? "✅" : "❌";
    console.log(
      `  ${status} ${s.scraperName.padEnd(20)} ${String(s.parsedCount).padStart(4)} ${String(s.totalComments).padStart(5)} ${String(s.totalImages).padStart(6)} ${s.totalBodyChars.toLocaleString().padStart(8)} ${((s.elapsedMs / 1000).toFixed(1) + "s").padStart(6)}`
    );
  });

  // RAG 댓글 샘플 출력 (품질 확인용)
  if (allComments.length > 0) {
    console.log(`\n  💬 RAG 댓글 샘플 (최대 15개):`);
    // 각 사이트에서 고르게 샘플링
    const sampleComments = allComments.slice(0, 15);
    sampleComments.forEach((c, i) => {
      console.log(
        `     ${i + 1}. [${c.site}] "${c.text.substring(0, 80)}${c.text.length > 80 ? "..." : ""}"`
      );
    });
  }

  // 에러 요약
  const allErrors = allStats.flatMap((s) => s.errors.map((e) => `[${s.scraperName}] ${e}`));
  if (allErrors.length > 0) {
    console.log(`\n  ⚠️ 에러 목록 (${allErrors.length}건):`);
    allErrors.forEach((e) => console.log(`     ${e}`));
  }

  console.log(`\n${divider("█")}`);
  console.log("  테스트 완료!");
  console.log(divider("█"));
}

main().catch((err) => {
  console.error("테스트 치명적 오류:", err);
  process.exit(1);
});
