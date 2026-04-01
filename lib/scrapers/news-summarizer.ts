// ================================================================
// 뉴스클리핑 프로젝트 — AI 클러스터링 & 요약 엔진
// 날짜: 2026-04-01
// 용도: 유사 기사 그룹핑 → 핵심 헤드라인 + 3줄 요약 생성
// AI 폴백 체인: Gemini 2.5 Flash → Anthropic Claude Haiku
//
// [파이프라인]
// 1. news_articles에서 미클러스터링 기사 가져오기
// 2. LLM에게 제목 목록 전달 → 유사 기사 그룹핑 (JSON 응답)
// 3. 각 그룹별로 LLM에게 헤드라인 + 3줄 요약 요청
// 4. news_clips 생성 + news_articles.clip_id 업데이트
// ================================================================

import type { ClusteringResult } from "./news-scraper";

// ─── 클러스터링 대상 기사 타입 ───
interface ArticleForClustering {
  id: string;
  title: string;
  snippet: string | null;
  source_name: string;
  category: string;
}

// ================================================================
// AI 생성 함수 (기존 rewriter.ts 패턴 재사용)
// ================================================================

// 🥇 1순위: Gemini 2.5 Flash
async function generateWithGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } =
      await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.4, // 뉴스 요약은 정확도 우선 → 낮은 temperature
        maxOutputTokens: 4000,
        // @ts-expect-error — thinkingConfig 타입 미정의 가능
        thinkingConfig: { thinkingBudget: 512 },
      },
      safetySettings,
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (err) {
    console.warn(
      `[뉴스요약/Gemini 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
    );
    return null;
  }
}

// 🥈 2순위: Anthropic Claude Haiku
async function generateWithAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.warn(
      `[뉴스요약/Anthropic 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
    );
    return null;
  }
}

// ─── AI 폴백 체인 호출 ───
async function generateAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  // 1순위: Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const result = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    if (result) return result;
  }

  // 2순위: Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const result = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
    if (result) return result;
  }

  console.error("[뉴스요약] 모든 AI 호출 실패 — API 키 확인 필요");
  return null;
}

// ================================================================
// STEP 0: 카테고리 자동 분류 (Labeling)
// ================================================================
// 기사 제목+snippet을 보고 4대 카테고리로 자동 분류

const CATEGORY_SYSTEM_PROMPT = `너는 뉴스 카테고리 분류기야.
기사 제목과 내용을 보고 아래 4개 카테고리 중 가장 적합한 것을 골라.

## 카테고리 정의
- marketing_biz: 마케팅, 브랜딩, 경영전략, 사업 트렌드, 창업, 비즈니스 모델
- tech_ai: 기술, AI, IT, 소프트웨어, 하드웨어, 스타트업 기술, 디지털 전환
- smallbiz: 소상공인, 자영업, 중소기업, 소규모 사업자 지원, 정책/세금/대출
- ad_trend: 광고, 퍼포먼스 마케팅, 소셜미디어 광고, 플랫폼 트렌드, 콘텐츠 마케팅

## 규칙
1. 반드시 위 4개 중 하나만 선택
2. 애매하면 기사의 핵심 타겟 독자층 기준으로 판단
3. 반드시 JSON 배열로만 응답 (설명 텍스트 없이)

## 응답 형식
[
  { "index": 0, "category": "marketing_biz" },
  { "index": 1, "category": "tech_ai" }
]`;

// ─── 카테고리 분류 유저 프롬프트 ───
function buildCategoryUserPrompt(articles: ArticleForClustering[]): string {
  const list = articles
    .map((a, i) => `[${i}] ${a.title}${a.snippet ? ` — ${a.snippet.slice(0, 100)}` : ""}`)
    .join("\n");

  return `아래 ${articles.length}개 기사를 4개 카테고리(marketing_biz, tech_ai, smallbiz, ad_trend) 중 하나로 분류해줘.

${list}

JSON 배열로만 응답해.`;
}

// ─── 카테고리 자동 분류 실행 ───
async function classifyArticleCategories(
  articles: ArticleForClustering[]
): Promise<ArticleForClustering[]> {
  if (articles.length === 0) return articles;

  console.log(`[뉴스요약] 카테고리 자동 분류: ${articles.length}개 기사`);

  const userPrompt = buildCategoryUserPrompt(articles);
  const response = await generateAI(CATEGORY_SYSTEM_PROMPT, userPrompt);

  if (!response) {
    console.warn("[뉴스요약] 카테고리 분류 AI 응답 없음 — 기존 카테고리 유지");
    return articles;
  }

  try {
    const jsonStr = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const labels = JSON.parse(jsonStr) as Array<{ index: number; category: string }>;

    // AI가 분류한 카테고리를 기사에 반영
    const validCategories = ["marketing_biz", "tech_ai", "smallbiz", "ad_trend"];
    for (const label of labels) {
      if (label.index >= 0 && label.index < articles.length && validCategories.includes(label.category)) {
        articles[label.index].category = label.category;
      }
    }

    console.log(`[뉴스요약] 카테고리 분류 완료: ${labels.length}개 기사 라벨링`);
  } catch (err) {
    console.warn("[뉴스요약] 카테고리 분류 JSON 파싱 실패 — 기존 카테고리 유지");
  }

  return articles;
}

// ================================================================
// STEP 1: 유사 기사 클러스터링 프롬프트
// ================================================================
// LLM에게 기사 제목 목록을 주고 비슷한 것끼리 그룹핑 요청

const CLUSTERING_SYSTEM_PROMPT = `너는 뉴스 에디터야. 여러 기사 제목을 보고 같은 사건/이슈를 다루는 기사들을 그룹으로 묶는 것이 역할이야.

## 규칙
1. 같은 사건/주제를 다루는 기사끼리 하나의 그룹으로 묶어
2. 완전히 다른 주제의 기사는 단독 그룹으로 (1개짜리 그룹)
3. 애매하면 묶지 말고 분리해 (과도한 묶기 금지)
4. 반드시 JSON 배열로 응답해 (설명 텍스트 없이 순수 JSON만)

## 응답 형식 (반드시 이 JSON 포맷)
[
  {
    "group_name": "그룹 이름 (한 줄 요약)",
    "article_indices": [0, 3, 7]
  },
  {
    "group_name": "단독 기사 제목",
    "article_indices": [1]
  }
]

article_indices는 입력된 기사 목록의 0부터 시작하는 인덱스 번호야.`;

function buildClusteringUserPrompt(articles: ArticleForClustering[]): string {
  const articleList = articles
    .map((a, i) => `[${i}] [${a.source_name}] ${a.title}`)
    .join("\n");

  return `아래 기사 ${articles.length}개를 같은 이슈끼리 그룹으로 묶어줘.

${articleList}

JSON 배열로만 응답해. 설명 텍스트 없이.`;
}

// ================================================================
// STEP 2: 그룹별 헤드라인 + 3줄 요약 프롬프트
// ================================================================

const SUMMARY_SYSTEM_PROMPT = `너는 '바쁜 사장님을 위한 뉴스 브리핑' 서비스의 에디터야.
여러 언론사의 기사를 종합해서, 사장님들이 10초 만에 핵심을 파악할 수 있도록 정리하는 것이 역할이야.

## 헤드라인 작성 규칙
- 클릭을 유도하되 낚시는 금지
- 핵심 키워드를 앞에 배치
- 15~25자 이내
- 이모지 1개 허용 (선택)

## 3줄 요약 작성 규칙
- 1줄: 무슨 일이 일어났는지 (What)
- 2줄: 왜 중요한지 / 배경 (Why)
- 3줄: 사장님들에게 미치는 영향 또는 시사점 (So What)
- 각 줄은 50자 이내로 간결하게
- "~습니다" 존댓말 사용

## 응답 형식 (반드시 이 JSON 포맷만, 설명 텍스트 없이)
{
  "headline": "핵심을 찌르는 헤드라인",
  "summary": "1줄 요약\\n2줄 요약\\n3줄 요약",
  "category": "marketing_biz | tech_ai | smallbiz | ad_trend"
}`;

function buildSummaryUserPrompt(
  articles: Array<{ title: string; snippet: string | null; source_name: string }>
): string {
  const articleDetails = articles
    .map(
      (a, i) =>
        `[기사 ${i + 1}] [${a.source_name}]\n제목: ${a.title}${a.snippet ? `\n내용: ${a.snippet.slice(0, 200)}` : ""}`
    )
    .join("\n\n");

  return `아래 ${articles.length}개 기사는 같은 이슈를 다루고 있어.
이걸 종합해서 핵심 헤드라인 1개 + 3줄 요약을 만들어줘.

${articleDetails}

JSON으로만 응답해.`;
}

// ================================================================
// 메인 클러스터링 + 요약 파이프라인
// ================================================================

export async function clusterAndSummarizeArticles(
  articles: ArticleForClustering[]
): Promise<ClusteringResult[]> {
  if (articles.length === 0) {
    console.log("[뉴스요약] 클러스터링할 기사 없음");
    return [];
  }

  console.log(`[뉴스요약] ${articles.length}개 기사 클러스터링 시작`);

  // ─── STEP 0: 카테고리 자동 분류 ───
  articles = await classifyArticleCategories(articles);

  // ─── STEP 1: 클러스터링 ───
  const clusteringPrompt = buildClusteringUserPrompt(articles);
  const clusteringResponse = await generateAI(CLUSTERING_SYSTEM_PROMPT, clusteringPrompt);

  if (!clusteringResponse) {
    console.error("[뉴스요약] 클러스터링 AI 응답 없음");
    return [];
  }

  // JSON 파싱 (코드블록 제거)
  let groups: Array<{ group_name: string; article_indices: number[] }>;
  try {
    const jsonStr = clusteringResponse
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    groups = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[뉴스요약] 클러스터링 JSON 파싱 실패:", clusteringResponse.slice(0, 200));
    return [];
  }

  console.log(`[뉴스요약] ${groups.length}개 그룹으로 클러스터링 완료`);

  // ─── STEP 2: 그룹별 헤드라인 + 요약 생성 ───
  const results: ClusteringResult[] = [];

  for (const group of groups) {
    // 그룹에 속한 기사들 추출
    const groupArticles = group.article_indices
      .filter((idx) => idx >= 0 && idx < articles.length)
      .map((idx) => articles[idx]);

    if (groupArticles.length === 0) continue;

    // 기사 1개짜리 그룹은 간단 처리 (AI 호출 절약)
    if (groupArticles.length === 1) {
      const solo = groupArticles[0];
      results.push({
        headline: solo.title.slice(0, 50),
        summary: solo.snippet || solo.title,
        category: solo.category,
        articleIds: [solo.id],
        thumbnailUrl: null,
      });
      continue;
    }

    // 2개 이상 기사 → LLM으로 요약 생성
    const summaryPrompt = buildSummaryUserPrompt(groupArticles);
    const summaryResponse = await generateAI(SUMMARY_SYSTEM_PROMPT, summaryPrompt);

    if (!summaryResponse) {
      // AI 실패 시 첫 번째 기사 제목으로 폴백
      results.push({
        headline: group.group_name,
        summary: groupArticles.map((a) => `• ${a.title}`).join("\n"),
        category: groupArticles[0].category,
        articleIds: groupArticles.map((a) => a.id),
        thumbnailUrl: null,
      });
      continue;
    }

    // JSON 파싱
    try {
      const jsonStr = summaryResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      const parsed = JSON.parse(jsonStr) as {
        headline: string;
        summary: string;
        category: string;
      };

      results.push({
        headline: parsed.headline,
        summary: parsed.summary,
        category: parsed.category || groupArticles[0].category,
        articleIds: groupArticles.map((a) => a.id),
        thumbnailUrl: null,
      });
    } catch {
      // 파싱 실패 시 원본 텍스트 사용
      results.push({
        headline: group.group_name,
        summary: summaryResponse.slice(0, 300),
        category: groupArticles[0].category,
        articleIds: groupArticles.map((a) => a.id),
        thumbnailUrl: null,
      });
    }
  }

  console.log(`[뉴스요약] ${results.length}개 뉴스 클립 생성 완료`);
  return results;
}
