// ============================================================
// 🧠 그릿(Grit) 자율 NPC 생태계 — 하이브리드 에이전트 시스템
// ============================================================
// 핵심 아키텍처:
//   - action_bias 돌림판: NPC마다 글/댓글/추천 확률이 다름
//   - 관심도 매칭(0~100): NPC의 core_interests vs 게시글 키워드
//   - 비용 통제: 0~19점은 API 호출 금지, 20+ 만 AI 생성
//   - 제미나이 비전(눈): 이미지 분석 → 클로드(뇌): 텍스트 생성
//   - 폴백 체인: Anthropic Haiku → Gemini 3 Flash → OpenAI GPT-4o-mini
//   - 템플릿은 최후의 폴백(API 전체 장애 시)으로만 사용
// ============================================================

import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 타입 정의 (그릿 확장) ───
interface Persona {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  industry: string;
  personality: string;
  prompt: string | null;
  is_active: boolean;
  total_posts?: number;
  total_comments?: number;
  total_likes?: number;
  // 🧠 그릿 확장 필드
  action_bias?: { post: number; comment: number; vote: number };
  core_interests?: string[];
  interest_weights?: Record<string, number>;
}

interface ActionResult {
  action: string;       // "post" | "comment" | "reply" | "upvote" | "setup" | "skip"
  persona: string;
  success: boolean;
  detail: string;
  error?: string;
  provider?: string;    // 어떤 AI가 생성했는지
  relevance?: number;   // 관심도 점수 (0~100)
}

// ─── 카테고리 목록 ───
const CATEGORIES = ["자유", "사업", "마케팅", "커리어", "이직", "재테크", "트렌드"];

// ─── 카테고리 → 업종 매핑 (관심도 가산점용) ───
const CATEGORY_INDUSTRY_MAP: Record<string, string[]> = {
  "마케팅": ["마케팅", "디자인", "IT/개발", "컨설팅/분석"],
  "사업": ["요식업", "쇼핑몰", "프리랜서", "제조업", "자영업/요식업", "다점포/부업", "예비창업"],
  "커리어": ["IT/개발", "마케팅", "디자인", "컨설팅/분석"],
  "이직": ["IT/개발", "마케팅", "디자인"],
  "재테크": ["다점포/부업", "유통/쇼핑", "컨설팅/분석"],
  "트렌드": ["IT/개발", "유머/콘텐츠", "IT/요식업", "마케팅"],
  "자유": [], // 자유 카테고리는 매핑 보너스 없음 (누구나 가능)
};

// ─── 템플릿 (API 전체 장애 시 최후의 폴백 전용) ───
const TEMPLATE_TITLES = [
  "요즘 {industry} 쪽에서 느끼는 점",
  "{industry} 현직자가 말하는 현실",
  "이번 주 {industry} 트렌드 정리",
  "솔직히 {industry}에서 제일 힘든 건...",
  "{industry} 3년차가 느끼는 변화",
  "초보자에게 알려주고 싶은 {industry} 꿀팁",
  "{industry} 종사자들만 공감하는 이야기",
  "올해 {industry} 시장 전망 어떻게 보세요?",
  "오늘 {industry} 관련 미팅에서 있었던 일",
  "{industry}에서 살아남는 법",
];

const TEMPLATE_CONTENTS = [
  "{nickname}입니다. 오늘 {industry} 관련 미팅에서 의외의 이야기가 나왔어요.\n\n클라이언트가 갑자기 \"AI로 이거 자동화 안 되나요?\"라고 물어보더라고요. 솔직히 가능은 한데, 아직 현실적으로 100% 대체는 어렵거든요.\n\n이런 질문 점점 많아지는 것 같은데, 다들 어떻게 대응하고 계세요?",
  "어제 퇴근하고 유튜브 알고리즘에 끌려서 {industry} 관련 영상을 3시간이나 봤네요 ㅋㅋ\n\n그 중에 하나가 진짜 인상적이었는데, 요약하면 \"고객의 불편함을 해결하는 사업이 결국 살아남는다\"는 거였어요.\n\n당연한 말 같지만 실제로 실천하기는 쉽지 않죠. 나부터 반성...",
  "오랜만에 글 써봅니다.\n\n{industry} 하면서 제일 힘든 게 뭔지 아세요? 의외로 기술이나 실력이 아니라 '사람 관계'더라고요.\n\n같이 일하는 파트너, 거래처, 고객... 결국 사람이 사업을 만들고 사람이 사업을 망가뜨리는 것 같아요.\n\n비슷한 경험 있으신 분?",
  "점심 먹다가 든 생각인데요.\n\n{industry} 분야에서 성공하려면 결국 '꾸준함'이 답인 것 같아요. 화려한 한 방보다 매일 조금씩 하는 사람이 결국 이기더라고요.\n\n뭐 당연한 말이지만 실천이 제일 어려운 법이죠 ㅎㅎ",
  "요즘 제 주변에 {industry} 시작하는 사람이 부쩍 늘었어요.\n\n근데 다들 \"어디서부터 시작해야 하나요?\"라고 물어보더라고요. 제 대답은 항상 같아요. \"일단 작게라도 시작하세요.\"\n\n여러분은 처음에 어떻게 시작하셨나요?",
];

const TEMPLATE_COMMENTS = [
  "ㅋㅋㅋ", "ㅋㅋㅋㅋㅋ", "ㄹㅇ", "ㅇㅇ 인정", "오 ㅋㅋ",
  "ㅋㅋ 이거 뭐야", "헐", "대박", "와", "ㅎㅎ",
  "ㅋㅋ 맞아", "아 진짜?", "ㄱㅇㄷ", "나만 그런줄", "ㅇㅈ",
];

const TEMPLATE_REPLIES = [
  "ㅋㅋㅋ", "ㅇㅈ", "ㄹㅇ", "ㅋㅋ 맞아", "아 ㅋㅋ",
  "그치", "ㅎㅎ", "나도 그렇게 생각", "ㅋㅋ 이건 인정", "아 진짜 ㅋㅋ",
];

// ─── 유틸 함수들 ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const usedTemplateIndices = new Set<number>();
function pickUniqueRandom<T>(arr: T[]): T {
  if (usedTemplateIndices.size >= arr.length) usedTemplateIndices.clear();
  let idx: number;
  do { idx = Math.floor(Math.random() * arr.length); } while (usedTemplateIndices.has(idx));
  usedTemplateIndices.add(idx);
  return arr[idx];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function randomDelay(): Promise<void> {
  const ms = 2000 + Math.random() * 3000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── AI 봇 탐지 ───
function smellsLikeBot(text: string): boolean {
  const botPatterns = [
    /좋은 글이네요/, /유익한 정보/, /도움이 됩니다/, /~에 대해 말씀/,
    /결론적으로/, /종합하면/, /첫째.*둘째/, /~하는 것이 중요/,
    /~할 수 있습니다/, /~라고 생각합니다/, /공감합니다/,
    /감사합니다.*정보/, /추천드립니다/, /이와 관련하여/,
  ];
  return botPatterns.some((p) => p.test(text));
}

// ════════════════════════════════════════════════════════════
// 🧠 그릿 핵심 #1: 관심도 점수 계산 (0~100)
// ════════════════════════════════════════════════════════════
// NPC의 core_interests 키워드가 게시글에 몇 개 포함되는지 +
// 카테고리-업종 매칭 보너스 → 최종 0~100점 반환
function calculateRelevanceScore(
  persona: Persona,
  postTitle: string,
  postContent: string,
  postCategory: string
): number {
  const interests = persona.core_interests || [];
  const weights = persona.interest_weights || {};
  if (interests.length === 0) return 35; // 관심사 미설정 시 → 추천은 하되 댓글은 안 달게

  // 게시글 텍스트 (제목 + 본문 앞 500자)
  const targetText = `${postTitle} ${postContent.slice(0, 500)}`.toLowerCase();

  // 1) 키워드 매칭 점수 (가중치 적용)
  let keywordScore = 0;
  let maxPossible = 0;
  for (const interest of interests) {
    const weight = weights[interest] || 50;
    maxPossible += weight;
    if (targetText.includes(interest.toLowerCase())) {
      keywordScore += weight;
    }
  }
  // 0~70점 범위로 정규화
  const normalizedKeyword = maxPossible > 0 ? (keywordScore / maxPossible) * 70 : 0;

  // 키워드 1개라도 매칭되면 기본 15점 보장 (매칭 0개면 0점)
  const matchBonus = keywordScore > 0 ? 15 : 0;

  // 2) 카테고리-업종 매칭 보너스 (최대 +20점)
  let categoryBonus = 0;
  const matchingIndustries = CATEGORY_INDUSTRY_MAP[postCategory] || [];
  if (matchingIndustries.includes(persona.industry)) {
    categoryBonus = 20;
  }
  // "자유" 카테고리는 누구나 참여 가능 → 기본 +25점
  if (postCategory === "자유") {
    categoryBonus = 25;
  }

  // 3) 랜덤 변동 (±10점) — 같은 NPC라도 매번 조금씩 다르게
  const randomJitter = Math.floor(Math.random() * 21) - 10;

  // 최종 점수 (0~100 클램프) — matchBonus로 키워드 1개만 매칭돼도 최소 점수 보장
  const finalScore = Math.max(0, Math.min(100, Math.round(normalizedKeyword + categoryBonus + matchBonus + randomJitter)));
  return finalScore;
}

// ════════════════════════════════════════════════════════════
// 🧠 그릿 핵심 #2: action_bias 돌림판 (행동 선택)
// ════════════════════════════════════════════════════════════
// NPC의 action_bias 확률에 따라 행동 유형 결정
// 예: {post:15, comment:75, vote:10} → 75% 확률로 comment
function selectActionByBias(persona: Persona): "post" | "comment" | "vote" {
  const bias = persona.action_bias || { post: 30, comment: 40, vote: 30 };
  const total = bias.post + bias.comment + bias.vote;
  const roll = Math.random() * total;

  if (roll < bias.post) return "post";
  if (roll < bias.post + bias.comment) return "comment";
  return "vote";
}

// ════════════════════════════════════════════════════════════
// 👁️ 그릿 핵심 #3: 제미나이 비전 — 이미지 분석
// ════════════════════════════════════════════════════════════
// 게시글 본문에서 이미지 URL을 추출
function extractImageUrls(content: string): string[] {
  const urls: string[] = [];
  // <img src="..."> 태그에서 추출
  const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgTagRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  // 마크다운 이미지 ![...](url)
  const mdRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }
  // 직접 URL (jpg, png, gif, webp)
  const urlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp))/gi;
  while ((match = urlRegex.exec(content)) !== null) {
    if (!urls.includes(match[1])) urls.push(match[1]);
  }
  return urls.slice(0, 3); // 최대 3장만 분석
}

// 제미나이 비전으로 이미지 분석 (gemini-1.5-flash)
// 이미지 URL → "이 이미지가 뭔지" 한국어 요약 텍스트 반환
async function analyzeImageWithGeminiVision(
  imageUrl: string,
  geminiKey: string
): Promise<string | null> {
  if (!geminiKey || geminiKey.length < 10) return null;

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(geminiKey);
    const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 이미지 다운로드 → base64 변환
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!imageResponse.ok) {
      console.warn(`[Vision] 이미지 다운로드 실패: ${imageResponse.status} ${imageUrl.slice(0, 80)}`);
      return null;
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Content-Type에서 MIME 타입 추출
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();

    // 제미나이 비전에게 커뮤니티 시선으로 이미지 분석 요청
    const result = await visionModel.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        },
      },
      "이 이미지가 어떤 상황인지, 텍스트나 밈(Meme)이 있다면 무슨 내용인지 " +
      "한국 비즈니스 커뮤니티 유저 시선에서 2~3줄로 요약해 줘. " +
      "차트/그래프라면 핵심 수치를, 스크린샷이라면 어떤 앱/사이트인지 알려줘.",
    ]);

    const text = result.response.text();
    if (text && text.length > 5) {
      console.log(`[Vision 성공] ${imageUrl.slice(0, 50)}... → "${text.slice(0, 60)}..."`);
      return text;
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Vision 실패] ${msg.slice(0, 120)}`);
    return null;
  }
}

// 게시글의 모든 이미지를 분석해서 하나의 요약 텍스트로 합침
async function analyzePostImages(
  postContent: string,
  geminiKey: string
): Promise<string | null> {
  const imageUrls = extractImageUrls(postContent);
  if (imageUrls.length === 0) return null;

  const analyses: string[] = [];
  for (const url of imageUrls) {
    const analysis = await analyzeImageWithGeminiVision(url, geminiKey);
    if (analysis) analyses.push(analysis);
  }

  if (analyses.length === 0) return null;
  return analyses.join("\n---\n");
}

// ════════════════════════════════════════════════════════════
// AI 텍스트 생성: 폴백 체인 (비용 최적화 버전)
// ════════════════════════════════════════════════════════════
// 1순위: Anthropic Claude 3 Haiku (가성비 최고)
// 2순위: Google Gemini 3 Flash
// 3순위: OpenAI GPT-4o-mini

async function generateWithAnthropic(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-3-haiku-20240307", // 💰 비용 최적화: Haiku 사용
    max_tokens: 500,
    temperature: 0.9,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const textBlock = message.content.find((b) => b.type === "text");
  const result = textBlock ? textBlock.text : null;

  if (result && smellsLikeBot(result)) {
    console.warn(`[Anthropic 봇 탐지] 재생성 시도`);
    const retry = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500, temperature: 1.0,
      system: systemPrompt + `\n\n[긴급] 방금 네가 쓴 글이 AI 티가 났다. 완전 다르게 써.`,
      messages: [{ role: "user", content: userPrompt }],
    });
    const retryBlock = retry.content.find((b) => b.type === "text");
    if (retryBlock?.text) return retryBlock.text;
  }
  return result;
}

async function generateWithGemini(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(apiKey);

  // 안전 필터 완화 — 커뮤니티 글/댓글이 차단되지 않도록
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  // 🔥 gemini-2.5-flash: thinking 모델이라 budgetTokens로 사고 토큰 제한
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 500,
      // @ts-ignore — thinking 설정: 사고에 토큰 적게 쓰고 실제 응답에 집중
      thinkingConfig: { thinkingBudget: 100 },
    },
    safetySettings,
  });
  const result = await model.generateContent(userPrompt);
  let text = "";
  try {
    text = result.response.text();
  } catch (e) {
    // text()가 빈 응답이면 에러 날 수 있음 — candidates에서 직접 추출
    const candidate = result.response.candidates?.[0];
    if (candidate?.content?.parts) {
      text = candidate.content.parts
        .filter((p: { text?: string }) => p.text)
        .map((p: { text?: string }) => p.text)
        .join("");
    }
    console.warn(`[Gemini] text() 에러 → candidates에서 추출: "${text?.slice(0, 50)}"`);
  }

  // 빈 응답이면 한 번 더 시도 (thinking 끄고 temperature 올려서)
  if (!text || text.trim().length < 5) {
    console.warn(`[Gemini] 빈 응답 → 재시도 (thinking 꺼짐, temperature 1.2)`);
    const retryModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt + `\n\n[중요] 반드시 내용을 생성해. 빈 응답 금지.`,
      generationConfig: {
        temperature: 1.2,
        maxOutputTokens: 500,
        // @ts-ignore — 재시도에선 thinking 완전 비활성화
        thinkingConfig: { thinkingBudget: 0 },
      },
      safetySettings,
    });
    const retry = await retryModel.generateContent(userPrompt);
    try {
      const retryText = retry.response.text();
      if (retryText && retryText.trim().length >= 5) return retryText;
    } catch {
      const candidate = retry.response.candidates?.[0];
      if (candidate?.content?.parts) {
        const extracted = candidate.content.parts
          .filter((p: { text?: string }) => p.text)
          .map((p: { text?: string }) => p.text)
          .join("");
        if (extracted && extracted.trim().length >= 5) return extracted;
      }
    }
  }

  if (text && smellsLikeBot(text)) {
    console.warn(`[Gemini 봇 탐지] 재생성 시도`);
    const retryModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt + `\n\n[긴급] AI 티 났다. 완전 다르게 써.`,
      generationConfig: {
        temperature: 1.2,
        maxOutputTokens: 500,
        // @ts-ignore
        thinkingConfig: { thinkingBudget: 0 },
      },
      safetySettings,
    });
    const retry = await retryModel.generateContent(userPrompt);
    try {
      const retryText = retry.response.text();
      if (retryText) return retryText;
    } catch {
      // ignore
    }
  }
  return text || null;
}

async function generateWithOpenAI(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 500, temperature: 0.9,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const text = completion.choices[0]?.message?.content || null;

  if (text && smellsLikeBot(text)) {
    console.warn(`[OpenAI 봇 탐지] 재생성 시도`);
    const retry = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 500, temperature: 1.2,
      messages: [
        { role: "system", content: systemPrompt + `\n\n[긴급] AI 티 났다. 완전 다르게 써.` },
        { role: "user", content: userPrompt },
      ],
    });
    const retryText = retry.choices[0]?.message?.content;
    if (retryText) return retryText;
  }
  return text;
}

// 메인 생성 함수: 폴백 체인
// 🔥 순서 변경: Gemini 1순위 (무료!) → Anthropic 2순위 → OpenAI 3순위
async function generateWithAI(
  _apiKey: string, systemPrompt: string, userPrompt: string
): Promise<{ text: string | null; error?: string; provider?: string }> {
  const anthropicKey = _apiKey || process.env.ANTHROPIC_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const errors: string[] = [];

  // 🥇 1순위: Google Gemini (무료 티어, 기름 무한!)
  if (geminiKey.length > 10) {
    try {
      console.log(`[AI] Gemini 1.5 Flash 호출 시도...`);
      const result = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
      if (result) return { text: result, provider: "gemini-2.5-flash" };
      errors.push(`Gemini: 결과 없음(null)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini 실패] ${msg.slice(0, 200)}`);
      errors.push(`Gemini: ${msg.slice(0, 120)}`);
    }
  } else {
    errors.push(`Gemini: API키 미설정`);
  }

  // 🥈 2순위: Anthropic Claude Haiku (크레딧 있을 때만)
  if (anthropicKey.length > 10) {
    try {
      console.log(`[AI] Anthropic Haiku 호출 시도...`);
      const result = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
      if (result) return { text: result, provider: "anthropic-haiku" };
      errors.push(`Anthropic: 결과 없음(null)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Anthropic 실패] ${msg.slice(0, 120)}`);
      errors.push(`Anthropic: ${msg.slice(0, 120)}`);
    }
  }

  // 🥉 3순위: OpenAI GPT-4o-mini
  if (openaiKey.length > 10) {
    try {
      console.log(`[AI] OpenAI 호출 시도...`);
      const result = await generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
      if (result) return { text: result, provider: "openai-4o-mini" };
      errors.push(`OpenAI: 결과 없음(null)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAI 실패] ${msg.slice(0, 120)}`);
      errors.push(`OpenAI: ${msg.slice(0, 120)}`);
    }
  }

  const errorSummary = errors.length > 0 ? errors.join(" | ") : "API키 전부 미설정";
  console.error(`[AI 전체 실패] ${errorSummary}`);
  return { text: null, error: errorSummary };
}

// ════════════════════════════════════════════════════════════
// 페르소나별 말투 가이드 (변경 없음 — 기존 유지)
// ════════════════════════════════════════════════════════════
const PERSONA_SPEECH_GUIDE: Record<string, string> = {
  "식당왕김국자": `[말투] 충청도 아재. "~하쇼", "~인겨", "~말여", "~했당께". "허허" "에이~". 예시: "아 그거 나도 해봤는데 말여" "허허 그건 좀 아닌겨"`,
  "현직대기업": `[말투] 블라인드 직장인. "~인듯", "~아닌가", "ㅇㅇ". 건조+시니컬. 예시: "이건 좀 아닌듯" "우리 회사도 비슷함ㅋㅋ"`,
  "광고충": `[말투] 디시 MZ. "ㅋㅋ", "ㄹㅇ", "팩폭", "~하냐?". 반말+시니컬. 짧게. 예시: "ㅋㅋ이거 팩폭인데" "ㄹㅇ 개공감"`,
  "뜨아는사랑": `[말투] 카페사장 감성. 따뜻. "~요", "~네요", "~ㅎㅎ". 예시: "에이 뭐 그럴수도 있죠~" "아 이거 공감 ㅋㅋ"`,
  "방구석디자인": `[말투] 프리랜서. 자조+유머. "~ㅋㅋ", "~인데..", "아..". 예시: "클라 수정 7번째..살려줘ㅋㅋ" "아 맞아ㅋㅋ 프리랜서 공감"`,
  "위탁판매러": `[말투] 스마트스토어 셀러. "~더라", "~했음", "마진이~". 예시: "이거 마진 몇프로임?" "나는 그거 해봤는데 별로였음"`,
  "편의점빌런": `[말투] 디시 반말. "~노", "~ㅋ", "ㄹㅇ", "개~". 예시: "야간 알바 뛰는데 진상 또 옴ㅋㅋ" "개공감ㅋㅋㅋ"`,
  "점주님": `[말투] 자영업 꼰대+정감. "~한다", "~이다", "내가 해보니까~". 예시: "내가 장사 10년 했는데 그건 아냐"`,
  "네일하는누나": `[말투] 밝은 언니. "~~해용", "~~한당", "ㅠㅠ", "대박!!". 이모지(✨💅💕). 예시: "헐 대박 이거 진짜에요?!💕"`,
  "지표의노예": `[말투] 데이터 너드. "~인데요", "전환율이~", "수치를 보면~". 예시: "이거 CTR 몇프로 나옴?" "숫자가 말해주는거지"`,
  "납품아재": `[말투] 투박한 아저씨. "~하는거야", "에이 뭐". 경상도 살짝. 예시: "에이 그거 뭐 별거 아이다" "걍 밀어붙였다"`,
  "짤방사냥꾼": `[말투] 밈 덕후. "ㅋㅋㅋ", "레전드", "짤 저장". 반말+유머. 예시: "이거 레전드ㅋㅋㅋ" "짤 하나로 설명 끝"`,
  "가성비충": `[말투] 정보충. "~더라고요", "가성비 갑", "이건 사기임". 예시: "이건 가성비 갑인데 아는사람이 없음"`,
  "눈팅만10년": `[말투] 소심 관찰자. "~것 같아요..", "혹시..", "저만 그런가요..". 예시: "저만 이렇게 생각하나요..ㅎ"`,
  "퇴근하고한잔": `[말투] 지친 직장인+위트. "~ㅋㅋ", "퇴근하고 싶다", "한잔 해야겠다". 예시: "퇴근하고 읽으니까 더 공감됨ㅋㅋ"`,
  "자영업은지옥": `[말투] 자조적. 다크유머. "~ㅋ", "ㅎ..", "살려줘". 예시: "ㅋㅋ웃으면서 울고있다" "매출 보면 눈물남ㅎ.."`,
  "궁금한게많음": `[말투] 질문충. "이거 왜?", "혹시~?", "진짜요??". 예시: "오 이거 왜 그런거에요??" "진짜요??"`,
  "MZ사장": `[말투] 젊은 사장. 트렌디. "~임", "ㅇㅇ", "사바사", "갓생". 예시: "요즘 이게 대세임ㅋㅋ" "사바사지만 나는 이게 맞다고 봄"`,
  "내일은맑음": `[말투] 긍정러. "파이팅!", "할수있어요!", "~~ㅎㅎ". 예시: "오 화이팅이에요!!ㅎㅎ" "좋은 일 있을거에요~"`,
  "논리왕": `[말투] 논쟁러. "근데 그건~", "반론 하나만", "소스?". 차가움. 예시: "근데 그건 좀 다른 얘기 아님?" "소스 있음?"`,
  "장사는취미": `[말투] 여유로운 사장. "~하하", "뭐 그럭저럭", "재밌으면 됐지". 예시: "하하 걍 재밌어서 하는건데"`,
};

// ════════════════════════════════════════════════════════════
// 🧠 그릿 핵심 #4: 동적 System Prompt (관심도 기반)
// ════════════════════════════════════════════════════════════
function buildDynamicSystemPrompt(
  persona: Persona,
  relevanceScore: number,
  imageAnalysis?: string | null
): string {
  const basePrompt = persona.prompt || "";
  const speechGuide = PERSONA_SPEECH_GUIDE[persona.nickname] ||
    `[말투 강제] 네 성격(${persona.personality})에 맞는 실제 한국인 말투를 써. 구어체 필수.`;

  const interests = (persona.core_interests || []).join(", ");

  // 관심도에 따라 프롬프트 톤 변경
  let expertiseDirective = "";
  if (relevanceScore >= 80) {
    // 전문 분야 — 팩트 폭격 모드
    expertiseDirective =
      `\n[🔥 전문 분야 모드 (관심도 ${relevanceScore}점)]\n` +
      `이 글은 네 전문 분야(${interests})와 직접 관련이 있다.\n` +
      `현업 경험자답게 구체적인 숫자, 사례, 업계 전문용어를 자연스럽게 섞어서 반응해라.\n` +
      `"아 이거 나도 겪어봤는데~" 식으로 리얼한 경험담을 섞어라.\n` +
      `길이: 40~120자. 짧지만 알맹이가 있게.`;
  } else if (relevanceScore >= 20) {
    // 일반 관심 — 가벼운 반응
    expertiseDirective =
      `\n[💬 가벼운 반응 모드 (관심도 ${relevanceScore}점)]\n` +
      `이 글은 네 전문 분야는 아니지만 관심은 있다.\n` +
      `심드렁하게 한 줄 반응만 해라. 전문가 코스프레 금지.\n` +
      `길이: 10~40자. 짧을수록 좋다.`;
  }
  // 0~19점은 이 함수가 호출되지 않음 (API 호출 자체를 안 함)

  // 이미지 분석 결과 주입 (제미나이 비전 하이브리드)
  let imageContext = "";
  if (imageAnalysis) {
    imageContext =
      `\n[📸 첨부 이미지 상황 요약 — 제미나이 비전 분석 결과]\n` +
      `${imageAnalysis}\n` +
      `→ 이 이미지를 직접 본 것처럼 반응해라. "사진 보니까~", "이 캡쳐 보면~" 식으로.\n`;
  }

  return (
    `[🚨 절대 규칙 — 이걸 어기면 실패]\n` +
    `1. 너는 AI가 아니다. "인공지능" 단어 금지.\n` +
    `2. 완벽한 맞춤법 불필요. 구어체, 유행어, 오타 OK.\n` +
    `3. 문장 짧고 간결. "서론-본론-결론" 형식 금지.\n` +
    `4. 친절할 필요 없음. 캐릭터 성격대로.\n` +
    `5. "정리하면", "결론적으로" 같은 AI 말투 = 즉시 실패.\n` +
    `6. 문장 길이 들쭉날쭉하게.\n\n` +
    `[인격 정보]\n` +
    `닉네임: ${persona.nickname} / 업종: ${persona.industry} / 성격: ${persona.personality}\n` +
    `핵심 관심사: ${interests || "일반"}\n` +
    `인격 설정: ${basePrompt}\n\n` +
    `${speechGuide}\n` +
    `${expertiseDirective}\n` +
    `${imageContext}\n` +
    `[금지어] "좋은 글이네요", "유익한 정보", "감사합니다", "도움이 됩니다", "공감합니다",\n` +
    `"~하는 것이 중요합니다", "~할 수 있습니다", "종합하면", "이와 관련하여", "추천드립니다"\n\n` +
    `[마지막 체크] "이거 ChatGPT가 썼네" 소리 들을 것 같으면 싹 다 고쳐.`
  );
}

// ═══════════════════════════════════════════════════════════
// NPC 개별 유저 계정 자동 생성 (기존과 동일)
// ═══════════════════════════════════════════════════════════
async function ensureNpcUsers(
  supabase: SupabaseClient, personas: Persona[], adminUserId: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];
  const needsSetup = personas.filter((p) => p.user_id === adminUserId);
  if (needsSetup.length === 0) return results;

  console.log(`[NPC 셋업] ${needsSetup.length}명 개별 계정 생성 시작`);
  for (const persona of needsSetup) {
    try {
      const fakeEmail = `npc_${persona.id.slice(0, 8)}@biztask.local`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: `npc_${crypto.randomUUID()}`,
        email_confirm: true,
        user_metadata: { nickname: persona.nickname, is_npc: true },
      });
      if (authError || !authData?.user) {
        results.push({ action: "setup", persona: persona.nickname, success: false, detail: "계정 생성 실패", error: authError?.message });
        continue;
      }
      const newUserId = authData.user.id;
      await supabase.from("profiles").upsert({ id: newUserId, nickname: persona.nickname, avatar_url: persona.avatar_url });
      await supabase.from("personas").update({ user_id: newUserId }).eq("id", persona.id);
      persona.user_id = newUserId;
      results.push({ action: "setup", persona: persona.nickname, success: true, detail: `계정 생성 완료 (${newUserId.slice(0, 8)}...)` });
    } catch (err) {
      results.push({ action: "setup", persona: persona.nickname, success: false, detail: "예외 발생", error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

// ─── KST 시간 ───
function getKSTHour(): number {
  const now = new Date();
  const kstOffset = 9 * 60;
  const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
  return kstTime.getHours();
}

// ═══════════════════════════════════════════════════════════
// 🧠 그릿 메인 엔진: NPC 자율 행동 실행
// ═══════════════════════════════════════════════════════════
// POST와 GET 핸들러가 공유하는 핵심 로직
async function executeGritActions(
  supabase: SupabaseClient,
  personas: Persona[],
  actionCount: number,
  anakiUserId: string,
  effectiveApiKey: string
): Promise<{ results: ActionResult[]; stats: Record<string, number> }> {
  const results: ActionResult[] = [];
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";
  const hasAnyAI = effectiveApiKey.length > 10 || geminiKey.length > 10 || openaiKey.length > 10;

  // 최근 게시글 가져오기 (댓글/추천 대상)
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("id, author_id, title, category, content, upvotes, comment_count")
    .order("created_at", { ascending: false })
    .limit(30);

  const anakiPosts = recentPosts?.filter((p) => p.author_id === anakiUserId) || [];
  const allPosts = recentPosts || [];
  const newPostIds: { id: string; author_id: string; title: string; category: string; content: string }[] = [];

  // 통계 추적
  const stats = { apiCalls: 0, visionCalls: 0, skipped: 0, lowRelevance: 0 };

  for (let idx = 0; idx < actionCount; idx++) {
    if (idx > 0) await randomDelay();

    // 🎲 NPC 선택 + action_bias 돌림판
    const persona = pickRandom(personas) as Persona;
    const actionType = selectActionByBias(persona);

    // ═══ 글쓰기 ═══
    if (actionType === "post") {
      const category = pickRandom(CATEGORIES);
      const vars = { nickname: persona.nickname, industry: persona.industry, personality: persona.personality };
      let title = "";
      let content = "";
      let provider = "";
      let lastAiError = "";

      if (hasAnyAI) {
        const systemPrompt = buildDynamicSystemPrompt(persona, 80); // 글쓰기는 항상 전문 모드
        stats.apiCalls++;
        const aiResult = await generateWithAI(
          effectiveApiKey, systemPrompt,
          `비즈니스 커뮤니티 '그릿(Grit)'에 올릴 '${category}' 카테고리 글을 작성해.\n` +
          `형식: 첫 줄에 제목만(# 붙이지 마), 둘째 줄부터 본문.\n` +
          `분량: 제목 15~25자, 본문 80~200자.\n` +
          `내용: 네 업종(${persona.industry})과 관심사(${(persona.core_interests || []).slice(0, 4).join(", ")})에서 실제로 겪을 법한 일화, 뻘글, 질문, 불만, 꿀팁.\n` +
          `금지: "기본기가 중요", "데이터 기반", ChatGPT 말투.\n` +
          `참고: 커뮤니티 글이니까 가볍게. 뻘글도 OK.`
        );
        if (aiResult.text) {
          const lines = aiResult.text.trim().split("\n");
          title = lines[0].replace(/^#\s*/, "").replace(/^제목[:\s]*/i, "").trim();
          content = lines.slice(1).join("\n").replace(/^본문[:\s]*/i, "").trim();
          provider = aiResult.provider || "";
        }
        if (aiResult.error) {
          console.warn(`[AI 글쓰기 실패] ${persona.nickname}: ${aiResult.error}`);
          lastAiError = aiResult.error;
        }
      }

      // AI 실패 시 → 템플릿 사용하지 않고 스킵 (템플릿 글은 절대 안 씀)
      if (!title || !content) {
        if (!lastAiError) lastAiError = "AI 생성 결과 없음";
        stats.skipped++;
        results.push({ action: "post", persona: persona.nickname, success: true, detail: `AI 생성 실패 → 스킵`, error: lastAiError });
        continue;
      }

      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert({ author_id: persona.user_id, title, content, category, upvotes: 0, comment_count: 0 })
        .select("id").single();

      if (postError) {
        results.push({ action: "post", persona: persona.nickname, success: false, detail: `글쓰기 실패: ${title}`, error: postError.message });
      } else {
        if (newPost) newPostIds.push({ id: newPost.id, author_id: persona.user_id, title, category, content });
        await supabase.from("personas").update({ total_posts: (persona.total_posts ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        results.push({ action: "post", persona: persona.nickname, success: true, detail: `[${category}] "${title}" 작성`, provider, error: lastAiError || undefined });
      }

    // ═══ 댓글/대댓글 ═══
    } else if (actionType === "comment") {
      const availablePosts = [...allPosts, ...newPostIds];
      if (availablePosts.length === 0) {
        results.push({ action: "comment", persona: persona.nickname, success: false, detail: "댓글 달 글 없음" });
        continue;
      }

      // 타겟 글 선택 (아나키 글 50% 우선)
      const targetPost = anakiPosts.length > 0 && Math.random() < 0.5
        ? pickRandom(anakiPosts)
        : pickRandom(availablePosts);

      // 본문 가져오기 (content가 없는 경우)
      let postContent = (targetPost as { content?: string }).content || "";
      if (!postContent) {
        const { data: pc } = await supabase.from("posts").select("content").eq("id", targetPost.id).single();
        postContent = pc?.content || "";
      }

      // 🧠 관심도 점수 계산
      const relevance = calculateRelevanceScore(persona, targetPost.title, postContent, targetPost.category);

      // ─── [절대 원칙 1] 0~19점: API 호출 금지! 로컬에서 추천만 처리 ───
      if (relevance < 20) {
        stats.lowRelevance++;
        // 관심 없는 글 → 확률적으로 추천만 하고 넘어감 (50%)
        if (Math.random() < 0.5) {
          const { data: existing } = await supabase.from("post_likes")
            .select("id").eq("post_id", targetPost.id).eq("user_id", persona.user_id).maybeSingle();
          if (!existing) {
            await supabase.from("post_likes").insert({ post_id: targetPost.id, user_id: persona.user_id });
            const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
            if (rpcError) {
              const { data: cp } = await supabase.from("posts").select("upvotes").eq("id", targetPost.id).single();
              await supabase.from("posts").update({ upvotes: (cp?.upvotes ?? 0) + 1 }).eq("id", targetPost.id);
            }
            await supabase.from("personas").update({ total_likes: (persona.total_likes ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
            results.push({ action: "upvote", persona: persona.nickname, success: true, detail: `관심도 ${relevance}점 → 가볍게 추천만`, relevance });
          } else {
            results.push({ action: "skip", persona: persona.nickname, success: true, detail: `관심도 ${relevance}점 → 이미 추천됨, 패스`, relevance });
          }
        } else {
          results.push({ action: "skip", persona: persona.nickname, success: true, detail: `관심도 ${relevance}점 → 관심 없음, 패스`, relevance });
          stats.skipped++;
        }
        continue;
      }

      // ─── 20점 이상: AI 생성 ───
      // 대댓글 vs 댓글 결정 (기존 댓글 있으면 30% 확률로 대댓글)
      const { data: existingComments } = await supabase
        .from("comments").select("id, content, user_id")
        .eq("post_id", targetPost.id).is("parent_id", null).limit(10);

      const isReply = existingComments && existingComments.length > 0 && Math.random() < 0.3;
      const parentComment = isReply ? pickRandom(existingComments!) : null;

      // 👁️ 이미지 분석 (제미나이 비전 하이브리드)
      let imageAnalysis: string | null = null;
      if (relevance >= 50 && geminiKey.length > 10) {
        imageAnalysis = await analyzePostImages(postContent, geminiKey);
        if (imageAnalysis) stats.visionCalls++;
      }

      // 동적 프롬프트 생성 (관심도 기반)
      const systemPrompt = buildDynamicSystemPrompt(persona, relevance, imageAnalysis);
      stats.apiCalls++;

      let commentText = "";
      let shouldSkip = false;
      let provider = "";

      if (isReply && parentComment) {
        // 대댓글
        const aiResult = await generateWithAI(effectiveApiKey, systemPrompt,
          `다음 댓글에 답글을 달아.\n\n` +
          `원글 제목: ${targetPost.title}\n` +
          `댓글: "${parentComment.content}"\n\n` +
          `규칙:\n` +
          `- 댓글 내용에 대한 구체적 반응\n` +
          `- 할 말 없으면 "SKIP"만 출력\n` +
          `- 5~40자. 짧을수록 자연스러움\n` +
          `- 봇말 쓰면 실패. 답글만 출력`
        );
        if (aiResult.text) {
          const trimmed = aiResult.text.trim();
          if (trimmed.toUpperCase() === "SKIP" || trimmed.toUpperCase().startsWith("SKIP")) {
            shouldSkip = true;
          } else {
            commentText = trimmed;
            provider = aiResult.provider || "";
          }
        }
      } else {
        // 일반 댓글
        const imageHint = imageAnalysis ? `\n[이미지 참고] 이 글에 이미지가 있다. 이미지 내용도 반영해서 댓글 달아.\n` : "";
        const aiResult = await generateWithAI(effectiveApiKey, systemPrompt,
          `다음 글에 댓글을 달아.\n\n` +
          `제목: ${targetPost.title}\n` +
          `카테고리: ${targetPost.category}\n` +
          `본문: ${postContent.slice(0, 300)}\n` +
          `${imageHint}\n` +
          `규칙:\n` +
          `- 글 제목과 본문을 읽고 구체적으로 반응\n` +
          `- 할 말 없으면 "SKIP"만 출력\n` +
          `- ${relevance >= 80 ? "40~120자. 전문적이되 자연스럽게" : "10~60자. 짧고 가볍게"}\n` +
          `- 봇 댓글 쓰면 실패. 댓글만 출력`
        );
        if (aiResult.text) {
          const trimmed = aiResult.text.trim();
          if (trimmed.toUpperCase() === "SKIP" || trimmed.toUpperCase().startsWith("SKIP")) {
            shouldSkip = true;
          } else {
            commentText = trimmed;
            provider = aiResult.provider || "";
          }
        }
      }

      if (shouldSkip) {
        stats.skipped++;
        results.push({ action: "comment", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." SKIP (관심도 ${relevance})`, relevance });
        continue;
      }

      // AI 실패 시 → 템플릿 사용하지 않고 스킵
      if (!commentText) {
        stats.skipped++;
        results.push({ action: "comment", persona: persona.nickname, success: true, detail: `AI 생성 실패 → 스킵 (관심도 ${relevance})`, relevance });
        continue;
      }

      // DB 저장
      if (isReply && parentComment) {
        const { error } = await supabase.from("comments")
          .insert({ post_id: targetPost.id, user_id: persona.user_id, content: commentText, parent_id: parentComment.id });
        if (!error) {
          const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ comment_count: (cp?.comment_count ?? 0) + 1 }).eq("id", targetPost.id);
          await supabase.from("personas").update({ total_comments: (persona.total_comments ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        }
        results.push({ action: "reply", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 대댓글 (관심도 ${relevance})`, provider, relevance });
      } else {
        const { error } = await supabase.from("comments")
          .insert({ post_id: targetPost.id, user_id: persona.user_id, content: commentText });
        if (!error) {
          const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ comment_count: (cp?.comment_count ?? 0) + 1 }).eq("id", targetPost.id);
          await supabase.from("personas").update({ total_comments: (persona.total_comments ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        }
        results.push({ action: "comment", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 댓글 (관심도 ${relevance})`, provider, relevance });
      }

    // ═══ 추천(Upvote) ═══
    } else if (actionType === "vote") {
      const availablePosts = [...allPosts, ...newPostIds];
      if (availablePosts.length === 0) {
        results.push({ action: "upvote", persona: "-", success: false, detail: "추천할 글 없음" });
        continue;
      }

      const targetPost = anakiPosts.length > 0 && Math.random() < 0.6
        ? pickRandom(anakiPosts) : pickRandom(availablePosts);

      // 중복 추천 방지
      const { data: existing } = await supabase.from("post_likes")
        .select("id").eq("post_id", targetPost.id).eq("user_id", persona.user_id).maybeSingle();
      if (existing) {
        results.push({ action: "upvote", persona: persona.nickname, success: false, detail: `이미 추천 → 스킵` });
        continue;
      }

      const { error: likeError } = await supabase.from("post_likes")
        .insert({ post_id: targetPost.id, user_id: persona.user_id });

      if (!likeError) {
        const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
        if (rpcError) {
          const { data: cp } = await supabase.from("posts").select("upvotes").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ upvotes: (cp?.upvotes ?? 0) + 1 }).eq("id", targetPost.id);
        }
        await supabase.from("personas").update({ total_likes: (persona.total_likes ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
      }
      results.push({ action: "upvote", persona: persona.nickname, success: !likeError, detail: likeError ? `추천 실패` : `"${targetPost.title.slice(0, 15)}..." 추천` });
    }
  }

  return { results, stats };
}

// ═══════════════════════════════════════════════════════════
// POST 핸들러: 어드민 UI 수동 실행
// ═══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      actions = 5,
      anthropicApiKey = "",
      anakiUserId = "",
      skipSleepCheck = false,
    } = body;

    // 취침 체크
    const kstHour = getKSTHour();
    if (!skipSleepCheck && kstHour >= 1 && kstHour < 8) {
      return Response.json({
        success: true,
        summary: { 총액션: 0, 메시지: `💤 NPC 취침 중 (KST ${kstHour}시)` },
        results: [], sleeping: true,
      });
    }

    const effectiveApiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY || "";
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";
    const supabase = createAdminSupabaseClient();

    // 활성 NPC 가져오기 (🧠 그릿 확장 필드 포함)
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, total_posts, total_comments, total_likes, action_bias, core_interests, interest_weights")
      .eq("is_active", true);

    if (personaError || !personas || personas.length === 0) {
      return Response.json({ success: false, error: "활성 NPC 없음", detail: personaError?.message }, { status: 400 });
    }

    const results: ActionResult[] = [];

    // NPC 계정 셋업
    if (anakiUserId) {
      const setupResults = await ensureNpcUsers(supabase, personas as Persona[], anakiUserId);
      results.push(...setupResults);
    }

    // 🧠 그릿 메인 엔진 실행
    const actionCount = Math.min(actions, 20);
    const { results: gritResults, stats } = await executeGritActions(
      supabase, personas as Persona[], actionCount, anakiUserId, effectiveApiKey
    );
    results.push(...gritResults);

    // 결과 요약
    const summary = {
      총액션: results.filter(r => r.action !== "setup").length,
      성공: results.filter((r) => r.success && r.action !== "setup").length,
      실패: results.filter((r) => !r.success && r.action !== "setup").length,
      글쓰기: results.filter((r) => r.action === "post" && r.success).length,
      댓글: results.filter((r) => r.action === "comment" && r.success).length,
      대댓글: results.filter((r) => r.action === "reply" && r.success).length,
      추천: results.filter((r) => r.action === "upvote" && r.success).length,
      스킵: results.filter((r) => r.action === "skip").length,
      AI호출수: stats.apiCalls,
      비전분석: stats.visionCalls,
      저관심스킵: stats.lowRelevance,
      AI제공자: [
        geminiKey.length > 10 ? "🥇Gemini(2.5-Flash)" : null,
        effectiveApiKey.length > 10 ? "🥈Anthropic(Haiku)" : null,
        openaiKey.length > 10 ? "🥉OpenAI(4o-mini)" : null,
      ].filter(Boolean),
      아키텍처: "그릿 자율 에이전트 v1.0",
    };

    return Response.json({ success: true, summary, results });
  } catch (error) {
    console.error("[test-interaction POST] 에러:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "알 수 없는 에러" },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════
// GET 핸들러: Vercel Cron 자동 실행
// ═══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    // CRON_SECRET 검증
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
    }

    // 취침 체크
    const kstHour = getKSTHour();
    if (kstHour >= 1 && kstHour < 8) {
      return Response.json({ success: true, sleeping: true, message: `💤 NPC 취침 중 (KST ${kstHour}시)` });
    }

    const supabase = createAdminSupabaseClient();
    const effectiveApiKey = process.env.ANTHROPIC_API_KEY || "";

    // 관리자 ID
    const { data: adminProfile } = await supabase
      .from("profiles").select("id").order("created_at", { ascending: true }).limit(1).single();
    const anakiUserId = adminProfile?.id || "";

    // 활성 NPC (그릿 확장 필드 포함)
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, total_posts, total_comments, total_likes, action_bias, core_interests, interest_weights")
      .eq("is_active", true);

    if (personaError || !personas || personas.length === 0) {
      return Response.json({ success: false, error: "활성 NPC 없음" });
    }

    // NPC 계정 셋업
    const setupResults: ActionResult[] = [];
    if (anakiUserId) {
      const sr = await ensureNpcUsers(supabase, personas as Persona[], anakiUserId);
      setupResults.push(...sr);
    }

    // 🧠 그릿 메인 엔진 (3~7개 랜덤 액션)
    const randomActions = 3 + Math.floor(Math.random() * 5);
    const { results, stats } = await executeGritActions(
      supabase, personas as Persona[], randomActions, anakiUserId, effectiveApiKey
    );

    return Response.json({
      success: true, cron: true, kstHour,
      summary: {
        총액션: results.length,
        성공: results.filter((r) => r.success).length,
        실패: results.filter((r) => !r.success).length,
        AI호출수: stats.apiCalls,
        비전분석: stats.visionCalls,
        저관심스킵: stats.lowRelevance,
        아키텍처: "그릿 자율 에이전트 v1.0",
      },
      results: [...setupResults, ...results],
    });
  } catch (error) {
    console.error("[cron test-interaction] 에러:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "에러" }, { status: 500 });
  }
}
