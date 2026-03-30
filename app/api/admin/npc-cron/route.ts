// ============================================================
// 🤖 NPC 크론 자동화 엔진 — 타임존별 활동량 제어
// ============================================================
// 기능:
//   - 외부 크론 서비스(cron-job.org)에서 호출되는 GET 핸들러
//   - 어드민 패널에서 수동 실행하는 POST 핸들러
//   - NPC별 활동시간(active_start_hour ~ active_end_hour) 체크
//   - NPC별 일일 활동량 할당량(post_frequency, comment_frequency) 체크
//   - 댓글을 게시글보다 훨씬 자주 하는 로직
//   - 매일 자정에 today_counters 리셋
// ============================================================

import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 타입 정의 ───
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
  // 크론 활동 시간/할당량 제어
  active_start_hour?: number;
  active_end_hour?: number;
  post_frequency?: number;
  comment_frequency?: number;
  like_frequency?: number;
  today_posts?: number;
  today_comments?: number;
  today_likes?: number;
  today_reset_date?: string;
}

interface ActionResult {
  action: string;
  persona: string;
  success: boolean;
  detail: string;
  error?: string;
  provider?: string;
  relevance?: number;
}

interface ExecutionSummary {
  executed: number;
  posts: number;
  comments: number;
  votes: number;
  skipped: number;
  errors: number;
  details?: ActionResult[];
}

// ─── 상수 정의 ───
const CATEGORIES = ["자유", "사업", "마케팅", "커리어", "이직", "재테크", "트렌드"];

const CATEGORY_INDUSTRY_MAP: Record<string, string[]> = {
  "마케팅": ["마케팅", "디자인", "IT/개발", "컨설팅/분석"],
  "사업": ["요식업", "쇼핑몰", "프리랜서", "제조업", "자영업/요식업", "다점포/부업", "예비창업"],
  "커리어": ["IT/개발", "마케팅", "디자인", "컨설팅/분석"],
  "이직": ["IT/개발", "마케팅", "디자인"],
  "재테크": ["다점포/부업", "유통/쇼핑", "컨설팅/분석"],
  "트렌드": ["IT/개발", "유머/콘텐츠", "IT/요식업", "마케팅"],
  "자유": [],
};

const TEMPLATE_COMMENTS = [
  "ㅋㅋㅋ", "ㅋㅋㅋㅋㅋ", "ㄹㅇ", "ㅇㅇ 인정", "오 ㅋㅋ",
  "ㅋㅋ 이거 뭐야", "헐", "대박", "와", "ㅎㅎ",
  "ㅋㅋ 맞아", "아 진짜?", "ㄱㅇㄷ", "나만 그런줄", "ㅇㅈ",
];

const PERSONA_SPEECH_GUIDE: Record<string, string> = {
  "현직대기업": `[말투 강제] 블라인드체. 살짝 시크하지만 기본적으로 예의 있음. 종결어미: "~인듯", "~아닌가", "ㅇㅇ", "ㄹㅇ". 자영업자한테 은근 리스펙.`,
  "광고충": `[말투 강제] 캐주얼체. ROAS 관심 많음. 종결어미: "ㅋㅋ", "ㄹㅇ", "~임". 초보한테 친절하게 설명.`,
  "뜨아는사랑": `[말투 강제] 따뜻한 카페사장. 공감 만렙. 종결어미: "~요", "~네요", "ㅎㅎ", "ㅠㅠ". 이모지 가끔(☕💕).`,
  "방구석디자인": `[말투 강제] 프리랜서 자조+유머. 수정지옥 공감. 종결어미: "~ㅋㅋ", "~인데..", "아..", "힘내요".`,
  "위탁판매러": `[말투 강제] 셀러체. 마진 관심 많음. 종결어미: "~더라", "~했음", "마진이~". 기본적으로 친근.`,
  "편의점빌런": `[말투 강제] 캐주얼 반말. 짧고 재밌게. 종결어미: "~ㅋ", "ㄹㅇ", "~하노". 공감 잘 해줌.`,
  "점주님": `[말투 강제] 정감 있는 멘토. 15년 내공. 종결어미: "~한다", "~이다", "내가 해보니까~". 조언 위주.`,
  "네일하는누나": `[말투 강제] 밝은 언니. 에너지 넘침. 종결어미: "~~해요!", "~~한당ㅎㅎ", "헐 대박". 이모지(✨💅💕).`,
  "지표의노예": `[말투 강제] 데이터 관심러. 숫자에 반응. 종결어미: "~인데요", "수치를 보면~", "전환율이~".`,
  "납품아재": `[말투 강제] 투박하지만 정 있는 현장형. 종결어미: "~하는거야", "에이 뭐", "걍", "~인겨".`,
  "짤방사냥꾼": `[말투 강제] 밈 좋아하는 분위기 메이커. 종결어미: "ㅋㅋㅋ", "레전드", "짤 저장".`,
  "가성비충": `[말투 강제] 정보 나눔러. 대안 찾기 달인. 종결어미: "~더라고요", "가성비 갑", "비교해봤는데~".`,
  "눈팅만10년": `[말투 강제] 조용한 관찰자. 세무/법률은 정확. 종결어미: "~것 같아요..", "혹시..", "저만 그런가요..".`,
  "퇴근하고한잔": `[말투 강제] 직장인 위트. 자영업자 리스펙. 종결어미: "~ㅋㅋ", "한잔 해야겠다", "고생했어요".`,
  "자영업은지옥": `[말투 강제] 자조+유머. 폐업 경험 있지만 극복중. 종결어미: "~ㅋ", "ㅎ..", "그래도 해야지".`,
  "궁금한게많음": `[말투 강제] 질문 많은 호기심쟁이. 순수하게 궁금. 종결어미: "이거 왜?", "진짜요??", "오오 대박".`,
  "MZ사장": `[말투 강제] 트렌디 젊은 사장. 자동화 관심. 종결어미: "~임", "ㅇㅇ", "사바사", "갓생".`,
  "내일은맑음": `[말투 강제] 긍정러. 밝고 응원 잘 해줌. 종결어미: "파이팅!", "할수있어요!", "~ㅎㅎ".`,
  "논리왕": `[말투 강제] 분석형. 근거 중시하지만 상대방 존중. 종결어미: "근데 그건~", "소스?", "데이터 보면~".`,
  "장사는취미": `[말투 강제] 여유 있는 사장. 느긋한 매력. 종결어미: "~하하", "뭐 그럭저럭", "재밌으면 됐지".`,
  "식당왕김국자": `[말투 강제] 충청도 아재. 투박+정 넘침. 종결어미: "~하쇼", "~인겨", "~말여", "~했당께", "허허".`,
};

// ─── 유틸 함수 ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function randomDelay(): Promise<void> {
  const ms = 1000 + Math.random() * 2000;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────
// KST 시간 및 날짜 유틸
// ────────────────────────────────────────────────────────────
function getKSTNow(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
}

function getKSTHour(): number {
  return getKSTNow().getHours();
}

function getKSTDate(): string {
  const kstNow = getKSTNow();
  const year = kstNow.getFullYear();
  const month = String(kstNow.getMonth() + 1).padStart(2, "0");
  const day = String(kstNow.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ────────────────────────────────────────────────────────────
// 활동시간 범위 체크 (wrap-around 지원: 22-02 같은 경우)
// ────────────────────────────────────────────────────────────
function isWithinActiveHours(currentHour: number, startHour: number, endHour: number): boolean {
  // 정상 범위 (22-01: 22~23, 0~1)
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  // wrap-around (22-01: 22~23, 0~1)
  if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }
  // 같은 시간이면 항상 활동 가능
  return true;
}

// ────────────────────────────────────────────────────────────
// 관심도 점수 계산 (0~100)
// ────────────────────────────────────────────────────────────
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
  if (postCategory === "자유") {
    categoryBonus = 25;
  }

  const randomJitter = Math.floor(Math.random() * 21) - 10;
  const finalScore = Math.max(0, Math.min(100, Math.round(normalizedKeyword + categoryBonus + matchBonus + randomJitter)));
  return finalScore;
}

// ────────────────────────────────────────────────────────────
// 동적 System Prompt 생성 (관심도 기반)
// ────────────────────────────────────────────────────────────
function buildDynamicSystemPrompt(
  persona: Persona,
  relevanceScore: number
): string {
  const basePrompt = persona.prompt || "";
  const speechGuide = PERSONA_SPEECH_GUIDE[persona.nickname] ||
    `[말투 강제] 네 성격(${persona.personality})에 맞는 실제 한국인 말투를 써. 구어체 필수.`;
  const interests = (persona.core_interests || []).join(", ");

  let expertiseDirective = "";
  if (relevanceScore >= 80) {
    expertiseDirective =
      `\n[🔥 전문 분야 모드 (관심도 ${relevanceScore}점)]\n` +
      `이 글은 네 전문 분야(${interests})와 직접 관련이 있다.\n` +
      `현업 경험자답게 구체적인 숫자, 사례를 자연스럽게 섞어라.\n` +
      `길이: 40~120자. 짧지만 알맹이가 있게.`;
  } else if (relevanceScore >= 20) {
    expertiseDirective =
      `\n[💬 가벼운 반응 모드 (관심도 ${relevanceScore}점)]\n` +
      `이 글은 네 전문 분야는 아니지만 관심은 있다.\n` +
      `심드렁하게 한 줄 반응만 해라. 전문가 코스프레 금지.\n` +
      `길이: 10~40자. 짧을수록 좋다.`;
  }

  return (
    `너는 "${persona.nickname}"이야. AI 아님. 한국 커뮤니티 실제 유저임.\n\n` +
    `[니 정보]\n` +
    `업종: ${persona.industry} / 성격: ${persona.personality}\n` +
    `관심사: ${interests || "잡다함"}\n` +
    `캐릭터: ${basePrompt}\n\n` +
    `${speechGuide}\n` +
    `${expertiseDirective}\n\n` +
    `[🚫 금지어 — 하나라도 쓰면 실패]\n` +
    `"좋은 글이네요", "유익한 정보", "감사합니다", "공감합니다",\n` +
    `"안녕하세요", "정리하자면", "결론적으로", "알아볼까요?",\n` +
    `"~하는 것이 중요합니다", "추천드립니다", "흥미롭게도"\n\n` +
    `[✅ 이렇게 써]\n` +
    `- 음슴체(~함, ~임), 반말, "~인 듯" 자연스럽게\n` +
    `- ㅋㅋ, ㅎㅎ, ㄹㅇ, 헐 등 슬랭 OK\n` +
    `- 완벽한 문장 쓰지 마. 대충 쓰는 느낌\n` +
    `- "나는 OO 전문가로서~" 식 자기소개 금지. 아는 척은 자연스럽게\n` +
    `- 서론/본론/결론 구조 금지\n` +
    `- 공격적이진 마. 의견 다르면 "글쎄" "좀 다른듯" 정도로\n` +
    `- 이모지 과용 금지\n\n` +
    `[최종 체크] 디시에 이 댓글 올렸을 때 "봇이다" 소리 나면 다시 써.`
  );
}

// ────────────────────────────────────────────────────────────
// AI 텍스트 생성: 폴백 체인
// ────────────────────────────────────────────────────────────
async function generateWithAnthropic(
  apiKey: string, systemPrompt: string, userPrompt: string
): Promise<string | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 500,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.warn(`[Anthropic 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return null;
  }
}

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
        temperature: 0.9,
        maxOutputTokens: 2000,
        // Gemini 2.5 Flash는 thinking 모델 — thinking 토큰을 제한해야
        // 실제 출력에 토큰이 충분히 배분됨
        // @ts-expect-error — thinkingConfig는 아직 타입 정의에 없을 수 있음
        thinkingConfig: { thinkingBudget: 256 },
      },
      safetySettings,
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (err) {
    console.warn(`[Gemini 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
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
      max_tokens: 500,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    console.warn(`[OpenAI 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    return null;
  }
}

// 메인 생성 함수: 폴백 체인 (Gemini 1순위)
async function generateWithAI(
  _apiKey: string, systemPrompt: string, userPrompt: string
): Promise<{ text: string | null; provider?: string }> {
  const anthropicKey = _apiKey || process.env.ANTHROPIC_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  // 🥇 1순위: Google Gemini
  if (geminiKey.length > 10) {
    const result = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "gemini-2.5-flash" };
  }

  // 🥈 2순위: Anthropic Claude Haiku
  if (anthropicKey.length > 10) {
    const result = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "anthropic-haiku" };
  }

  // 🥉 3순위: OpenAI GPT-4o-mini
  if (openaiKey.length > 10) {
    const result = await generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "openai-4o-mini" };
  }

  return { text: null };
}

// ════════════════════════════════════════════════════════════
// NPC 크론 실행 메인 함수
// ════════════════════════════════════════════════════════════
async function executeNpcCron(
  supabase: SupabaseClient,
  personas: Persona[],
  apiKey: string
): Promise<ExecutionSummary> {
  const summary: ExecutionSummary = {
    executed: 0,
    posts: 0,
    comments: 0,
    votes: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  const now = getKSTNow();
  const currentHour = now.getHours();
  const currentDate = getKSTDate();

  // 최근 게시글 가져오기
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("id, author_id, title, category, content, upvotes, comment_count")
    .order("created_at", { ascending: false })
    .limit(30);

  const allPosts = recentPosts || [];

  for (const persona of personas) {
    // 1. 활동 시간대 체크
    const startHour = persona.active_start_hour || 9;
    const endHour = persona.active_end_hour || 23;

    if (!isWithinActiveHours(currentHour, startHour, endHour)) {
      summary.skipped++;
      summary.details?.push({
        action: "skip",
        persona: persona.nickname,
        success: true,
        detail: `[${persona.nickname}] 활동 시간 외 (활동: ${startHour}~${endHour}시, 현재: ${currentHour}시)`,
      });
      continue;
    }

    // 2. 일일 카운터 리셋 (날짜 변경 시)
    const resetDate = persona.today_reset_date || currentDate;
    if (resetDate !== currentDate) {
      await supabase
        .from("personas")
        .update({
          today_posts: 0,
          today_comments: 0,
          today_likes: 0,
          today_reset_date: currentDate,
        })
        .eq("id", persona.id);
      persona.today_posts = 0;
      persona.today_comments = 0;
      persona.today_likes = 0;
    }

    const postFreq = persona.post_frequency || 2;
    const commentFreq = persona.comment_frequency || 8;
    const likeFreq = persona.like_frequency || 15;
    const todayPosts = persona.today_posts || 0;
    const todayComments = persona.today_comments || 0;
    const todayLikes = persona.today_likes || 0;

    // 3. 할당량 체크
    const canPost = todayPosts < postFreq;
    const canComment = todayComments < commentFreq;
    const canLike = todayLikes < likeFreq;

    if (!canComment && !canPost && !canLike) {
      summary.skipped++;
      summary.details?.push({
        action: "skip",
        persona: persona.nickname,
        success: true,
        detail: `[${persona.nickname}] 오늘 할당량 완료 (글${todayPosts}/${postFreq}, 댓글${todayComments}/${commentFreq}, 추천${todayLikes}/${likeFreq})`,
      });
      continue;
    }

    // 4. 행동 유형 결정: 댓글을 훨씬 자주 (70%), 게시글(20%), 추천(10%)
    let actionType: "post" | "comment" | "vote" = "vote";
    const roll = Math.random();

    if (canComment && roll < 0.7) {
      actionType = "comment";
    } else if (canPost && roll < 0.9) {
      actionType = "post";
    } else if (canLike) {
      actionType = "vote";
    } else if (canComment) {
      actionType = "comment";
    } else if (canPost) {
      actionType = "post";
    }

    await randomDelay();

    // ═══ 게시글 작성 ═══
    if (actionType === "post") {
      const category = pickRandom(CATEGORIES);
      const systemPrompt = buildDynamicSystemPrompt(persona, 80);
      const aiResult = await generateWithAI(
        apiKey,
        systemPrompt,
        `비즈니스 커뮤니티 '그릿(Grit)'에 올릴 '${category}' 카테고리 글을 작성해.\n` +
        `형식: 첫 줄에 제목만, 둘째 줄부터 본문.\n` +
        `분량: 제목 15~25자, 본문 80~200자.\n` +
        `내용: 네 업종(${persona.industry})과 관심사(${(persona.core_interests || []).slice(0, 4).join(", ")})에서 실제로 겪을 법한 일화.\n` +
        `금지: "기본기가 중요", ChatGPT 말투.`
      );

      if (aiResult.text) {
        const lines = aiResult.text.trim().split("\n");
        const title = lines[0].replace(/^#\s*/, "").trim();
        const content = lines.slice(1).join("\n").trim();

        if (title && content) {
          const { error } = await supabase
            .from("posts")
            .insert({ author_id: persona.user_id, title, content, category, upvotes: 0, comment_count: 0 });

          if (!error) {
            await supabase
              .from("personas")
              .update({
                today_posts: todayPosts + 1,
                total_posts: (persona.total_posts ?? 0) + 1,
                last_active_at: now.toISOString(),
              })
              .eq("id", persona.id);

            summary.executed++;
            summary.posts++;
            summary.details?.push({
              action: "post",
              persona: persona.nickname,
              success: true,
              detail: `[${category}] "${title}"`,
              provider: aiResult.provider,
            });
          } else {
            summary.errors++;
            summary.details?.push({
              action: "post",
              persona: persona.nickname,
              success: false,
              detail: `게시글 저장 실패`,
              error: error.message,
            });
          }
        } else {
          summary.skipped++;
          summary.details?.push({
            action: "post",
            persona: persona.nickname,
            success: true,
            detail: `AI 생성 결과 불완전 → 스킵`,
          });
        }
      } else {
        summary.skipped++;
        summary.details?.push({
          action: "post",
          persona: persona.nickname,
          success: true,
          detail: `AI 생성 실패 → 스킵`,
        });
      }
    }
    // ═══ 댓글 작성 ═══
    else if (actionType === "comment") {
      if (allPosts.length === 0) {
        summary.skipped++;
        summary.details?.push({
          action: "comment",
          persona: persona.nickname,
          success: false,
          detail: `댓글 달 글 없음`,
        });
        continue;
      }

      // 최신글 우선: 상위 30%에서 70% 확률로 선택
      const recentCutoff = Math.max(1, Math.floor(allPosts.length * 0.3));
      const targetPost = Math.random() < 0.7
        ? pickRandom(allPosts.slice(0, recentCutoff))
        : pickRandom(allPosts);
      let postContent = (targetPost as { content?: string }).content || "";
      if (!postContent) {
        const { data: pc } = await supabase.from("posts").select("content").eq("id", targetPost.id).single();
        postContent = pc?.content || "";
      }

      const relevance = calculateRelevanceScore(persona, targetPost.title, postContent, targetPost.category);

      // 관심도 20점 미만이면 간단한 반응만
      if (relevance < 20) {
        // 간단한 반응 (템플릿)
        const shortComment = pickRandom(TEMPLATE_COMMENTS);
        const { error } = await supabase
          .from("comments")
          .insert({ post_id: targetPost.id, user_id: persona.user_id, content: shortComment });

        if (!error) {
          const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase
            .from("posts")
            .update({ comment_count: (cp?.comment_count ?? 0) + 1 })
            .eq("id", targetPost.id);

          await supabase
            .from("personas")
            .update({
              today_comments: todayComments + 1,
              total_comments: (persona.total_comments ?? 0) + 1,
              last_active_at: now.toISOString(),
            })
            .eq("id", persona.id);

          summary.executed++;
          summary.comments++;
          summary.details?.push({
            action: "comment",
            persona: persona.nickname,
            success: true,
            detail: `"${targetPost.title.slice(0, 20)}..." (관심도${relevance}점)`,
            relevance,
          });
        } else {
          summary.errors++;
          summary.details?.push({
            action: "comment",
            persona: persona.nickname,
            success: false,
            detail: `댓글 저장 실패`,
            error: error.message,
          });
        }
      } else {
        // AI 댓글
        const systemPrompt = buildDynamicSystemPrompt(persona, relevance);
        const aiResult = await generateWithAI(
          apiKey,
          systemPrompt,
          `이 글에 댓글 달아.\n\n` +
          `제목: ${targetPost.title}\n` +
          `본문: ${postContent.slice(0, 300)}\n\n` +
          `- 글 읽고 느낀 점 한마디. 할 말 없으면 "SKIP"\n` +
          `- ${relevance >= 80 ? "40~120자. 아는 분야니까 구체적으로. 근데 강의체 금지" : "10~50자. 짧게. 'ㅋㅋ 이거 뭐야' 'ㄹㅇ' 수준 OK"}\n` +
          `- 댓글만 출력. 설명 붙이지 마`
        );

        if (aiResult.text) {
          const trimmed = aiResult.text.trim();
          if (trimmed.toUpperCase() === "SKIP" || trimmed.length < 2) {
            summary.skipped++;
            summary.details?.push({
              action: "comment",
              persona: persona.nickname,
              success: true,
              detail: `"${targetPost.title.slice(0, 20)}..." SKIP`,
              relevance,
            });
          } else {
            const { error } = await supabase
              .from("comments")
              .insert({ post_id: targetPost.id, user_id: persona.user_id, content: trimmed });

            if (!error) {
              const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
              await supabase
                .from("posts")
                .update({ comment_count: (cp?.comment_count ?? 0) + 1 })
                .eq("id", targetPost.id);

              await supabase
                .from("personas")
                .update({
                  today_comments: todayComments + 1,
                  total_comments: (persona.total_comments ?? 0) + 1,
                  last_active_at: now.toISOString(),
                })
                .eq("id", persona.id);

              summary.executed++;
              summary.comments++;
              summary.details?.push({
                action: "comment",
                persona: persona.nickname,
                success: true,
                detail: `"${targetPost.title.slice(0, 20)}..." (관심도${relevance}점)`,
                provider: aiResult.provider,
                relevance,
              });
            } else {
              summary.errors++;
              summary.details?.push({
                action: "comment",
                persona: persona.nickname,
                success: false,
                detail: `댓글 저장 실패`,
                error: error.message,
              });
            }
          }
        } else {
          summary.skipped++;
          summary.details?.push({
            action: "comment",
            persona: persona.nickname,
            success: true,
            detail: `AI 생성 실패 → 스킵`,
            relevance,
          });
        }
      }
    }
    // ═══ 추천(Upvote) ═══
    else if (actionType === "vote") {
      if (allPosts.length === 0) {
        summary.skipped++;
        summary.details?.push({
          action: "vote",
          persona: persona.nickname,
          success: false,
          detail: `추천할 글 없음`,
        });
        continue;
      }

      // 최신글 우선: 상위 30%에서 70% 확률로 선택
      const voteCutoff = Math.max(1, Math.floor(allPosts.length * 0.3));
      const targetPost = Math.random() < 0.7
        ? pickRandom(allPosts.slice(0, voteCutoff))
        : pickRandom(allPosts);

      // 중복 추천 방지
      const { data: existing } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", targetPost.id)
        .eq("user_id", persona.user_id)
        .maybeSingle();

      if (existing) {
        summary.skipped++;
        summary.details?.push({
          action: "vote",
          persona: persona.nickname,
          success: false,
          detail: `이미 추천함 → 스킵`,
        });
        continue;
      }

      const { error: likeError } = await supabase
        .from("post_likes")
        .insert({ post_id: targetPost.id, user_id: persona.user_id });

      if (!likeError) {
        const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
        if (rpcError) {
          const { data: cp } = await supabase.from("posts").select("upvotes").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ upvotes: (cp?.upvotes ?? 0) + 1 }).eq("id", targetPost.id);
        }

        await supabase
          .from("personas")
          .update({
            today_likes: todayLikes + 1,
            total_likes: (persona.total_likes ?? 0) + 1,
            last_active_at: now.toISOString(),
          })
          .eq("id", persona.id);

        summary.executed++;
        summary.votes++;
        summary.details?.push({
          action: "vote",
          persona: persona.nickname,
          success: true,
          detail: `"${targetPost.title.slice(0, 20)}..."`,
        });
      } else {
        summary.errors++;
        summary.details?.push({
          action: "vote",
          persona: persona.nickname,
          success: false,
          detail: `추천 저장 실패`,
          error: likeError.message,
        });
      }
    }
  }

  return summary;
}

// ════════════════════════════════════════════════════════════
// GET 핸들러: 외부 크론 서비스 호출
// ════════════════════════════════════════════════════════════
// 핵심: 인증 확인 후 즉시 200 응답 → 백그라운드에서 NPC 실행
// cron-job.org 무료 플랜 타임아웃(30초)에 걸리지 않도록 설계
// ════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  // CRON_SECRET 검증
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (!cronSecret) {
    console.warn("[NPC Cron] CRON_SECRET 미설정");
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      { success: false, error: "인증 실패: Authorization 헤더 불일치" },
      { status: 401 }
    );
  }

  const kstHour = getKSTHour();
  const currentDate = getKSTDate();

  // ─── 즉시 200 응답 반환 (타임아웃 방지) ───
  // 백그라운드에서 NPC 크론 실행은 자체 내부 호출로 처리
  // cron-job.org는 이 응답만 받고 종료됨
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.biztask.kr";

  // 백그라운드 실행: 자기 자신의 POST 엔드포인트를 비동기 호출
  // fetch를 await하지 않으므로 즉시 응답 가능
  fetch(`${siteUrl}/api/admin/npc-cron`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runAll: true, fromCron: true }),
  }).catch((err) => {
    console.error("[NPC Cron GET] 백그라운드 POST 호출 실패:", err);
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `크론 수신 완료 → 백그라운드 실행 시작 (KST ${kstHour}시)`,
  });
}

// ════════════════════════════════════════════════════════════
// POST 핸들러: 어드민 패널 수동 실행
// ════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, runAll } = body;

    // 세션 인증은 여기서 생략 (실제론 auth 미들웨어 추가 필요)
    // TODO: 세션 검증 추가

    const supabase = createAdminSupabaseClient();
    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const currentDate = getKSTDate();

    let personas: Persona[] = [];

    if (runAll) {
      // 모든 활성 NPC 실행
      const { data } = await supabase
        .from("personas")
        .select(
          "id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, " +
          "total_posts, total_comments, total_likes, action_bias, core_interests, interest_weights, " +
          "active_start_hour, active_end_hour, post_frequency, comment_frequency, like_frequency, " +
          "today_posts, today_comments, today_likes, today_reset_date"
        )
        .eq("is_active", true);
      personas = (data as unknown as Persona[]) || [];
    } else if (personaId) {
      // 특정 NPC 실행
      const { data } = await supabase
        .from("personas")
        .select(
          "id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, " +
          "total_posts, total_comments, total_likes, action_bias, core_interests, interest_weights, " +
          "active_start_hour, active_end_hour, post_frequency, comment_frequency, like_frequency, " +
          "today_posts, today_comments, today_likes, today_reset_date"
        )
        .eq("id", personaId)
        .single();
      if (data) personas = [data as unknown as Persona];
    } else {
      return Response.json(
        { success: false, error: "personaId 또는 runAll 필요" },
        { status: 400 }
      );
    }

    if (personas.length === 0) {
      return Response.json(
        { success: false, error: "NPC를 찾을 수 없음" },
        { status: 404 }
      );
    }

    console.log(`[NPC Cron POST] ${personas.length}명 NPC 수동 실행 (${currentDate})`);

    const summary = await executeNpcCron(supabase, personas, apiKey);

    return Response.json({
      success: true,
      manual: true,
      currentDate,
      summary: {
        executed: summary.executed,
        posts: summary.posts,
        comments: summary.comments,
        votes: summary.votes,
        skipped: summary.skipped,
        errors: summary.errors,
      },
      npcsProcessed: personas.length,
      message: `${summary.executed}개 행동 실행 (글${summary.posts}, 댓글${summary.comments}, 추천${summary.votes})`,
    });
  } catch (error) {
    console.error("[NPC Cron POST] 예외 발생:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    );
  }
}
