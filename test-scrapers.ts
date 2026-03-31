// ================================================================
// Phase 1 스크래퍼 실전 테스트
// 개드립, 더쿠, 웃긴대학 — fetchList + parseContent 통합 테스트
// 실행: npx tsx test-scrapers.ts
// ================================================================

import { HtmlScraper, HTML_SCRAPER_CONFIGS } from "./lib/scrapers/html-scraper";

// 테스트할 신규 스크래퍼 이름
const TEST_TARGETS = ["개드립 HOT", "더쿠 HOT", "웃긴대학 웃긴자료"];

async function runTest() {
  console.log("═══════════════════════════════════════════");
  console.log("  Phase 1 스크래퍼 실전 테스트 시작");
  console.log("═══════════════════════════════════════════\n");

  const configs = HTML_SCRAPER_CONFIGS.filter((c) =>
    TEST_TARGETS.includes(c.name)
  );

  for (const config of configs) {
    const scraper = new HtmlScraper(config);
    console.log(`\n▶▶▶ [${config.name}] 테스트 시작 ▶▶▶`);
    console.log(`    URL: ${config.listUrl}`);
    console.log(`    카테고리: ${config.category} / 타입: ${config.contentType}`);
    console.log("───────────────────────────────────────");

    // 1단계: 글 목록 가져오기
    console.log("\n📋 1단계: fetchList()");
    const list = await scraper.fetchList();
    console.log(`   → 결과: ${list.length}개 글 발견`);

    if (list.length === 0) {
      console.log("   ❌ 글 목록이 비어있음! 셀렉터 확인 필요.");
      continue;
    }

    // 상위 3개 제목 출력
    list.slice(0, 3).forEach((item, i) => {
      console.log(`   ${i + 1}. "${item.sourceTitle}"`);
      console.log(`      ${item.sourceUrl}`);
    });

    // 2단계: 첫 번째 글 본문 + 댓글 파싱
    console.log("\n📄 2단계: parseContent() — 첫 번째 글");
    const firstArticle = list[0];
    const parsed = await scraper.parseContent(
      firstArticle.sourceUrl,
      firstArticle.sourceTitle
    );

    if (!parsed) {
      console.log("   ❌ 본문 파싱 실패! 셀렉터 확인 필요.");
      continue;
    }

    console.log(`   ✅ 제목: "${parsed.sourceTitle}"`);
    console.log(`   ✅ 본문: ${parsed.sourceBody.length}자`);
    console.log(`      미리보기: "${parsed.sourceBody.substring(0, 100)}..."`);
    console.log(`   ✅ 이미지: ${parsed.sourceImages.length}장`);
    if (parsed.sourceImages.length > 0) {
      console.log(`      첫 번째: ${parsed.sourceImages[0].substring(0, 80)}`);
    }
    console.log(`   ✅ 댓글(RAG용): ${parsed.sourceComments.length}개`);
    parsed.sourceComments.forEach((cmt, i) => {
      console.log(`      💬 ${i + 1}. "${cmt.substring(0, 80)}${cmt.length > 80 ? "..." : ""}"`);
    });
    console.log(`   ✅ 출처: ${parsed.sourceSite}`);
    console.log(`   ✅ 카테고리: ${parsed.category}`);
    console.log(`   ✅ 콘텐츠타입: ${parsed.contentType}`);

    console.log(`\n✅✅✅ [${config.name}] 테스트 통과 ✅✅✅`);
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  전체 테스트 완료");
  console.log("═══════════════════════════════════════════");
}

runTest().catch((err) => {
  console.error("테스트 실패:", err);
  process.exit(1);
});
