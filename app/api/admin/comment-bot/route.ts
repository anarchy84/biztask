// ============================================================
// 💬 댓글봇 (Comment Bot) — 활어 엔진
// 작성일: 2026-04-17
// ============================================================
// 목적:
//   - 글과 완전히 독립적으로 댓글을 생성하는 cron
//   - 글이 안 올라와도 과거 글에 댓글이 계속 달림
//   - 모든 NPC가 고르게 활동 (로드밸런싱)
//   - 글마다 참여 NPC 조합이 달라서 실제 커뮤니티 느낌
//
// 4-Layer 픽 로직:
//   Layer 1 - 타겟 글 선택 (시간 가중치 랜덤)
//   Layer 2 - 참여 NPC 수 결정 (2~5명, 활어 밀도)
//   Layer 3 - NPC 픽 (콘텐츠 적합도 × 로드밸런싱)
//   Layer 4 - 댓글 생성 + 대댓글 (30% 확률)
//
// 호출 주기: cron-job.org에서 5~10분마다 호출 권장
// ============================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 타입 정의 ───
interface PersonaConfig {
  group?: string;
  background?: string;
  speech_style?: string;
  affinity?: number;
  keywords?: string[];
}

interface Persona {
  id: string;
  user_id: string;
  nickname: string;
  industry: string;
  personality: string;
  prompt: string | null;
  is_active: boolean;
  total_comments?: number;
  core_interests?: string[];
  interest_weights?: Record<string, number>;
  active_start_hour?: number;
  active_end_hour?: number;
  comment_frequency?: number;
  today_comments?: number;
  today_reset_date?: string;
  persona_config?: PersonaConfig;
}

interface PostTarget {
  id: string;
  title: string;
  content: string;
  category: string;
  comment_count: number;
  created_at: string;
  author_id: string;
}

interface CommentBotSummary {
  target_post_id: string | null;
  target_title: string;
  npcs_picked: number;
  comments_created: number;
  replies_created: number;
  errors: number;
  details: string[];
}

// ────────────────────────────────────────────────────────────
// KST 시간 유틸
// ────────────────────────────────────────────────────────────
function getKSTNow(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
}

function getKSTDate(): string {
  const kstNow = getKSTNow();
  const year = kstNow.getFullYear();
  const month = String(kstNow.getMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getKSTHour(): number {
  return getKSTNow().getHours();
}

// 활동시간 범위 체크 (wrap-around 지원)
function isWithinActiveHours(currentHour: number, startHour: number, endHour: number): boolean {
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }
  return true;
}

// ────────────────────────────────────────────────────────────
// 유틸: 가중치 랜덤 픽
// ────────────────────────────────────────────────────────────
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// 복수 개 가중치 랜덤 픽 (중복 없이)
function weightedPickMultiple<T>(items: T[], weights: number[], count: number): T[] {
  const picked: T[] = [];
  const poolItems = [...items];
  const poolWeights = [...weights];
  const n = Math.min(count, items.length);
  for (let i = 0; i < n; i++) {
    const total = poolWeights.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < poolItems.length; idx++) {
      r -= poolWeights[idx];
      if (r <= 0) break;
    }
    if (idx >= poolItems.length) idx = poolItems.length - 1;
    picked.push(poolItems[idx]);
    poolItems.splice(idx, 1);
    poolWeights.splice(idx, 1);
  }
  return picked;
}

// ────────────────────────────────────────────────────────────
// 관심도 점수 계산 (0~100) — npc-cron과 동일 로직
// ────────────────────────────────────────────────────────────
const CATEGORY_INDUSTRY_MAP: Record<string, string[]> = {
  "마케팅": ["마케팅", "디자인", "IT/개발", "컨설팅/분석"],
  "사업": ["요식업", "쇼핑몰", "프리랜서", "제조업", "자영업/요식업", "다점포/부업", "예비창업"],
  "질문": ["마케팅", "IT/개발", "디자인", "컨설팅/분석", "요식업", "쇼핑몰"],
  "부업": ["다점포/부업", "유통/쇼핑", "프리랜서", "쇼핑몰"],
  "유머": [],
  "자유": [],
  "AI": ["IT/개발", "컨설팅/분석", "마케팅"],
};

function calculateRelevanceScore(
  persona: Persona,
  postTitle: string,
  postContent: string,
  postCategory: string
): number {
  const interests = persona.core_interests || [];
  const weights = persona.interest_weights || {};
  if (interests.length === 0) return 35;

  const targetText = `${postTitle} ${postContent.slice(0, 500)}`.toLowerCase();

  let keywordScore = 0;
  let maxPossible = 0;
  for (const interest of interests) {
    const weight = weights[interest] || 50;
    maxPossible += weight;
    if (targetText.includes(interest.toLowerCase())) {
      keywordScore += weight;
    }
  }
  const normalizedKeyword = maxPossible > 0 ? (keywordScore / maxPossible) * 70 : 0;
  const matchBonus = keywordScore > 0 ? 15 : 0;

  let categoryBonus = 0;
  const matchingIndustries = CATEGORY_INDUSTRY_MAP[postCategory] || [];
  if (matchingIndustries.includes(persona.industry)) {
    categoryBonus = 20;
  }
  if (postCategory === "자유" || postCategory === "유머") {
    categoryBonus = 15;  // 유머/자유는 누구나 참여 가능 (약간 보너스)
  }

  const randomJitter = Math.floor(Math.random() * 21) - 10;
  return Math.max(0, Math.min(100, Math.round(normalizedKeyword + categoryBonus + matchBonus + randomJitter)));
}

// ────────────────────────────────────────────────────────────
// 파벌별 글로벌 말투 규칙 (npc-cron에서 복사)
// ────────────────────────────────────────────────────────────
const GROUP_SPEECH_RULES: Record<string, string> = {
  "자영업/사업자": `[파벌: 현장파] 실전 경험에서 나오는 투박하고 진정성 있는 말투. 이론이 아닌 경험 중심. 가끔 한숨 섞인 자조 유머. 90년대식 사투리(했당께), 노인 말투(허허) 절대 금지.`,
  "테크/인사이트": `[파벌: 직장인/전문가] "넵", "인사이트가 훌륭하네요" 식 비즈니스 커뮤니티 말투 OK. 분석적이고 효율 중심. 과한 전문가 티 금지.`,
  "MZ/커뮤니티": `[파벌: MZ/디시형] "ㄹㅇ", "ㅁㅊ", "폼 미쳤다", "알잘딱깔센" 등 최신 밈과 자음 위주. 음슴체: "인정함 ㅇㅇ". 짧고 날카로운 반응.`,
  "질문빌런/뉴비": `[파벌: 뉴비/질문형] 친절하고 솔직한 질문. 모르면 모른다고. 배우면 진심으로 기뻐함. 아는 척 금지.`,
};

// ────────────────────────────────────────────────────────────
// 시스템 프롬프트 생성 (댓글 전용, 간소화 버전)
// ────────────────────────────────────────────────────────────
function buildCommentSystemPrompt(
  persona: Persona,
  relevanceScore: number
): string {
  const config = persona.persona_config || {};
  const basePrompt = persona.prompt || "";
  const interests = (persona.core_interests || []).join(", ");

  const speechGuide = config.speech_style
    || `[말투] 네 성격(${persona.personality})에 맞는 실제 한국인 말투를 써. 구어체 필수.`;
  const groupRule = GROUP_SPEECH_RULES[config.group || ""] || "";
  const background = config.background || "";

  let expertiseDirective = "";
  if (relevanceScore >= 70) {
    expertiseDirective =
      `\n[🔥 관심 분야 — 관심도 ${relevanceScore}점]\n` +
      `이 글은 네 관심 분야와 맞음. 구체적인 경험이나 숫자를 자연스럽게 섞어.\n` +
      `길이: 40~120자.`;
  } else if (relevanceScore >= 25) {
    expertiseDirective =
      `\n[💬 가벼운 반응 — 관심도 ${relevanceScore}점]\n` +
      `심드렁하게 한 줄 반응. 전문가 코스프레 금지.\n` +
      `길이: 20~60자.`;
  } else {
    expertiseDirective =
      `\n[👀 구경만 — 관심도 ${relevanceScore}점]\n` +
      `짧게 한 마디. 관심 없는 티 내도 됨.\n` +
      `길이: 15~40자.`;
  }

  return (
    `너는 "${persona.nickname}"이야. AI 아님. 한국 커뮤니티 실제 유저임.\n\n` +
    (background ? `[니 배경]\n${background}\n\n` : "") +
    `[니 정보]\n` +
    `업종: ${persona.industry} / 성격: ${persona.personality}\n` +
    `관심사: ${interests || "잡다함"}\n` +
    (config.keywords && config.keywords.length > 0 ? `전문 키워드: ${config.keywords.join(", ")}\n` : "") +
    `캐릭터: ${basePrompt}\n\n` +
    `${speechGuide}\n` +
    (groupRule ? `\n${groupRule}\n` : "") +
    `${expertiseDirective}\n` +
    `[🚫 금지]\n` +
    `- "좋은 글이네요", "유익한 정보", "감사합니다", "공감합니다" 같은 상투어 금지\n` +
    `- "ㅇㅇ", "ㄹㅇ", "ㅋㅋ" 단독 사용 금지 (문장 속 양념으로만 OK)\n` +
    `- 자기소개("저는 마케터로서~") 금지\n` +
    `- 서론/본론/결론 구조 금지\n` +
    `- 90년대 사투리/노인 말투(허허, 했당께) 금지\n\n` +
    `[✅ 이렇게]\n` +
    `- 음슴체(~함, ~임), 반말 자연스럽게\n` +
    `- 글 내용에 구체적으로 반응\n` +
    `- 최소 1문장 이상, 본인 생각이나 썰 하나 포함\n` +
    `- 디시/개드립 댓글처럼 날것 느낌\n\n` +
    `[최종] 봇 티 나면 다시 써. 단답충 소리 나도 다시 써.`
  );
}

// ────────────────────────────────────────────────────────────
// AI 생성 폴백 체인 (Gemini → Anthropic → OpenAI)
// ────────────────────────────────────────────────────────────
async function generateWithGemini(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  try {
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = await import("@google/generative-ai");
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
        temperature: 0.95,
        maxOutputTokens: 1000,
        // @ts-expect-error thinkingConfig 타입 정의 미비
        thinkingConfig: { thinkingBudget: 128 },
      },
      safetySettings,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (err) {
    console.warn(`[CommentBot/Gemini 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return null;
  }
}

async function generateWithAnthropic(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 400,
      temperature: 0.95,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.warn(`[CommentBot/Anthropic 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return null;
  }
}

async function generateWithOpenAI(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0.95,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    console.warn(`[CommentBot/OpenAI 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return null;
  }
}

async function generateComment(
  systemPrompt: string, userPrompt: string
): Promise<{ text: string | null; provider?: string }> {
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  if (geminiKey.length > 10) {
    const r = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    if (r) return { text: r, provider: "gemini" };
  }
  if (anthropicKey.length > 10) {
    const r = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
    if (r) return { text: r, provider: "anthropic" };
  }
  if (openaiKey.length > 10) {
    const r = await generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
    if (r) return { text: r, provider: "openai" };
  }
  return { text: null };
}

// ────────────────────────────────────────────────────────────
// 🎯 Layer 1: 타겟 글 선택 (시간 가중치 랜덤)
// ────────────────────────────────────────────────────────────
async function pickTargetPost(supabase: SupabaseClient): Promise<PostTarget | null> {
  // 최근 30일 글 중 댓글 수 25개 미만 가져오기
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, title, content, category, comment_count, created_at, author_id")
    .gte("created_at", thirtyDaysAgo)
    .lt("comment_count", 25)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !posts || posts.length === 0) {
    console.warn(`[CommentBot/Layer1] 타겟 글 없음 (error: ${error?.message})`);
    return null;
  }

  // 시간 버킷으로 분류
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).getTime();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();

  const fresh: PostTarget[] = [];    // 최근 24h
  const mid: PostTarget[] = [];      // 2~7일
  const old: PostTarget[] = [];      // 7~30일

  for (const p of posts) {
    const t = new Date(p.created_at).getTime();
    if (t >= twentyFourHoursAgo) fresh.push(p);
    else if (t >= sevenDaysAgo) mid.push(p);
    else old.push(p);
  }

  // 버킷 가중치 랜덤: 최근24h 60% / 2~7일 30% / 7~30일 10%
  const buckets: PostTarget[][] = [fresh, mid, old].filter((b) => b.length > 0);
  const bucketWeights: number[] = [];
  if (fresh.length > 0) bucketWeights.push(60);
  if (mid.length > 0) bucketWeights.push(30);
  if (old.length > 0) bucketWeights.push(10);

  if (buckets.length === 0) return null;
  const chosenBucket = weightedPick(buckets, bucketWeights);

  // 버킷 안에서 댓글 수 적은 글 우선 (10개 미만 강한 가중치)
  const postWeights = chosenBucket.map((p) => {
    const shortage = Math.max(0, 10 - p.comment_count);
    return 1 + shortage * 3;  // 댓글 0개면 가중치 31, 10개면 1
  });
  return weightedPick(chosenBucket, postWeights);
}

// ────────────────────────────────────────────────────────────
// 🎯 Layer 2: 참여 NPC 수 결정
// ────────────────────────────────────────────────────────────
function decideNpcPoolSize(post: PostTarget): number {
  // 이미 댓글 많이 달린 글엔 적게, 적게 달린 글엔 많이
  const shortage = Math.max(0, 10 - post.comment_count);
  const roll = Math.random();

  // 기본 분포
  // 30% → 1~2명 (조용)
  // 50% → 3~4명 (보통)
  // 20% → 5~7명 (떡밥)
  let base: number;
  if (roll < 0.30) base = 1 + Math.floor(Math.random() * 2);
  else if (roll < 0.80) base = 3 + Math.floor(Math.random() * 2);
  else base = 5 + Math.floor(Math.random() * 3);

  // 댓글 없는 신상글엔 +1~2 보너스
  if (shortage >= 8) base += 1 + Math.floor(Math.random() * 2);

  // Vercel 타임아웃 방어: 한 번 호출 최대 5명
  return Math.min(5, base);
}

// ────────────────────────────────────────────────────────────
// 🎯 Layer 3: NPC 풀 선택 (적합도 × 로드밸런싱)
// ────────────────────────────────────────────────────────────
function pickNpcPool(
  personas: Persona[],
  post: PostTarget,
  poolSize: number
): Array<{ persona: Persona; relevance: number }> {
  // 각 NPC의 가중치 = (A) 적합도 × (B) 로드밸런싱
  const scored = personas.map((p) => {
    const relevance = calculateRelevanceScore(p, post.title, post.content, post.category);
    const todayCount = p.today_comments || 0;
    // 로드밸런싱: 오늘 댓글 적게 단 NPC에게 가중치 ↑
    const loadBalance = 1 / (todayCount + 1);
    // 최종 가중치: 적합도(10~100) × 로드밸런싱(1/(n+1))
    // 적합도 0인 NPC도 기본 10은 줘서 완전 배제되진 않게
    const finalWeight = Math.max(10, relevance) * loadBalance;
    return { persona: p, relevance, weight: finalWeight };
  });

  // 가중치 기반 N명 랜덤 픽 (중복 없이)
  const picked = weightedPickMultiple(
    scored,
    scored.map((s) => s.weight),
    poolSize
  );
  return picked.map((s) => ({ persona: s.persona, relevance: s.relevance }));
}

// ────────────────────────────────────────────────────────────
// 댓글 생성 + comments 테이블 INSERT
// ────────────────────────────────────────────────────────────
async function createCommentForNpc(
  supabase: SupabaseClient,
  persona: Persona,
  post: PostTarget,
  relevance: number,
  sourceComments: string[],
  parentCommentId: string | null = null
): Promise<{ success: boolean; commentId?: string; error?: string }> {
  const systemPrompt = buildCommentSystemPrompt(persona, relevance);

  // RAG Few-Shot: 원본 커뮤니티 댓글 분위기 흡수
  const ragBlock = sourceComments.length > 0
    ? `\n\n[참고: 원본 커뮤니티 반응 예시 (분위기만 참고, 복사 금지)]\n${sourceComments.slice(0, 5).join("\n---\n")}\n`
    : "";

  // 대댓글 모드
  let parentContext = "";
  if (parentCommentId) {
    const { data: parentComment } = await supabase
      .from("comments")
      .select("content")
      .eq("id", parentCommentId)
      .single();
    if (parentComment) {
      parentContext = `\n\n[위 댓글에 대한 대댓글이다 — 이 댓글에 반응해라]\n"${parentComment.content.slice(0, 300)}"\n`;
    }
  }

  const userPrompt =
    `아래 글을 읽고 댓글 1개만 달아라.\n\n` +
    `[제목]\n${post.title}\n\n` +
    `[본문]\n${post.content.slice(0, 800)}\n\n` +
    `[카테고리]\n${post.category}\n` +
    ragBlock +
    parentContext +
    `\n\n[출력 지시]\n` +
    `- 댓글 본문만 출력해라. 다른 설명/접두사 금지.\n` +
    `- 최소 1문장, 최대 3문장.\n` +
    `- 니 성격에 맞게 자연스럽게.`;

  const { text, provider } = await generateComment(systemPrompt, userPrompt);

  if (!text || text.trim().length < 5) {
    return { success: false, error: "AI 생성 실패 또는 너무 짧음" };
  }

  const cleanContent = text.trim().slice(0, 800);

  const { data: inserted, error: insertError } = await supabase
    .from("comments")
    .insert({
      post_id: post.id,
      parent_id: parentCommentId,
      user_id: persona.user_id,
      content: cleanContent,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { success: false, error: insertError?.message || "insert 실패" };
  }

  // personas 카운터 업데이트
  await supabase
    .from("personas")
    .update({
      today_comments: (persona.today_comments || 0) + 1,
      total_comments: (persona.total_comments || 0) + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", persona.id);

  // posts.comment_count 증가
  await supabase
    .from("posts")
    .update({ comment_count: post.comment_count + 1 })
    .eq("id", post.id);

  console.log(`[CommentBot] ✅ ${persona.nickname} (${provider}) → 글 "${post.title.slice(0, 30)}..." ${parentCommentId ? "대댓글" : "댓글"} 생성`);
  return { success: true, commentId: inserted.id };
}

// ────────────────────────────────────────────────────────────
// 메인 잡
// ────────────────────────────────────────────────────────────
async function runCommentBotJob(): Promise<CommentBotSummary> {
  const supabase = createAdminSupabaseClient();
  const summary: CommentBotSummary = {
    target_post_id: null,
    target_title: "",
    npcs_picked: 0,
    comments_created: 0,
    replies_created: 0,
    errors: 0,
    details: [],
  };

  const currentDate = getKSTDate();
  const currentHour = getKSTHour();

  // ─── 활성 NPC 로드 + 일일 카운터 리셋 ───
  const { data: personas, error: personaErr } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true);

  if (personaErr || !personas || personas.length === 0) {
    summary.details.push(`활성 NPC 없음 (${personaErr?.message || "빈 결과"})`);
    return summary;
  }

  // 활동 시간 + 할당량 필터
  const eligible: Persona[] = [];
  for (const p of personas as Persona[]) {
    // 카운터 리셋
    const resetDate = p.today_reset_date || currentDate;
    if (resetDate !== currentDate) {
      await supabase
        .from("personas")
        .update({
          today_posts: 0,
          today_comments: 0,
          today_likes: 0,
          today_reset_date: currentDate,
        })
        .eq("id", p.id);
      p.today_comments = 0;
    }

    const startH = p.active_start_hour ?? 9;
    const endH = p.active_end_hour ?? 23;
    if (!isWithinActiveHours(currentHour, startH, endH)) continue;

    const freq = p.comment_frequency ?? 8;
    const today = p.today_comments ?? 0;
    if (today >= freq) continue;  // 일일 할당량 초과

    eligible.push(p);
  }

  if (eligible.length === 0) {
    summary.details.push(`활동 가능 NPC 없음 (시간대/할당량 필터)`);
    return summary;
  }

  console.log(`[CommentBot] 활동 가능 NPC: ${eligible.length}명 / 전체 ${personas.length}명`);

  // ─── Layer 1: 타겟 글 선택 ───
  const post = await pickTargetPost(supabase);
  if (!post) {
    summary.details.push(`타겟 글 없음 (최근 30일 내 댓글 25개 미만 글 0개)`);
    return summary;
  }
  summary.target_post_id = post.id;
  summary.target_title = post.title.slice(0, 50);

  // ─── content_backlog에서 source_comments 조회 (RAG 재료) ───
  let sourceComments: string[] = [];
  const { data: backlogLink } = await supabase
    .from("content_backlog")
    .select("source_comments")
    .eq("result_post_id", post.id)
    .maybeSingle();
  if (backlogLink?.source_comments && Array.isArray(backlogLink.source_comments)) {
    sourceComments = backlogLink.source_comments.filter((c: unknown) => typeof c === "string" && (c as string).trim().length > 0);
  }

  // ─── Layer 2: 풀 크기 결정 ───
  const poolSize = decideNpcPoolSize(post);
  summary.details.push(`Layer 2: NPC 풀 크기 ${poolSize}명 결정 (글 댓글수: ${post.comment_count})`);

  // ─── Layer 3: NPC 픽 ───
  const pickedNpcs = pickNpcPool(eligible, post, poolSize);
  summary.npcs_picked = pickedNpcs.length;
  summary.details.push(`Layer 3: 픽 NPC ${pickedNpcs.map((p) => p.persona.nickname).join(", ")}`);

  // ─── 기존 댓글 조회 (대댓글 후보용) ───
  const { data: existingComments } = await supabase
    .from("comments")
    .select("id")
    .eq("post_id", post.id)
    .is("parent_id", null)
    .limit(20);
  const rootCommentIds = (existingComments || []).map((c: { id: string }) => c.id);

  // ─── Layer 4: 각 NPC가 댓글 생성 ───
  for (const { persona, relevance } of pickedNpcs) {
    // 대댓글 확률 30% (기존 루트 댓글 있을 때만)
    const isReply = rootCommentIds.length > 0 && Math.random() < 0.30;
    const parentId = isReply ? rootCommentIds[Math.floor(Math.random() * rootCommentIds.length)] : null;

    const result = await createCommentForNpc(
      supabase,
      persona,
      post,
      relevance,
      sourceComments,
      parentId
    );

    if (result.success) {
      if (isReply) summary.replies_created++;
      else summary.comments_created++;
      // 방금 단 댓글도 이후 대댓글 후보로 (현재 배치에서는 과한 꼬리 방지하려 skip)
    } else {
      summary.errors++;
      summary.details.push(`❌ ${persona.nickname}: ${result.error}`);
    }

    // 봇 티 안 나게 1~3초 랜덤 딜레이
    const delay = 1000 + Math.random() * 2000;
    await new Promise((r) => setTimeout(r, delay));
  }

  console.log(`[CommentBot] 완료 → 댓글 ${summary.comments_created}개, 대댓글 ${summary.replies_created}개, 에러 ${summary.errors}개`);
  return summary;
}

// ============================================================
// GET 핸들러 (cron-job.org 진입점) — Hit & Run 패턴
// ============================================================
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
  }

  const kstHour = getKSTHour();
  const currentDate = getKSTDate();

  // 백그라운드 실행
  after(async () => {
    try {
      console.log(`[CommentBot GET→after] 시작 (${currentDate} KST ${kstHour}시)`);
      const summary = await runCommentBotJob();
      console.log(`[CommentBot GET→after] 요약:`, JSON.stringify(summary, null, 2));
    } catch (err) {
      console.error(`[CommentBot GET→after] 실패:`, err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `댓글봇 cron 수신 → 백그라운드 실행 시작`,
  });
}

// ============================================================
// POST 핸들러 (어드민 수동 실행)
// ============================================================
export async function POST(request: NextRequest) {
  // 간단한 인증 (필요 시 세션 기반으로 강화)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
  }

  try {
    const summary = await runCommentBotJob();
    return Response.json({
      success: true,
      manual: true,
      currentDate: getKSTDate(),
      summary,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
