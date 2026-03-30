// ================================================================
// 콘텐츠 팜 — NPC 브레인워싱 리라이터
// 날짜: 2026-03-30
// 용도: 스크래핑한 외부 콘텐츠를 NPC 페르소나 말투로 완전히 재작성
// AI 폴백 체인: Gemini → Anthropic → OpenAI (npc-cron과 동일)
// ================================================================

import type { ScrapedArticle, RewriteResult } from "./types";

// ─── NPC 페르소나 정보 (리라이팅에 필요한 최소 정보) ───
export interface RewriterPersona {
  id: string;
  user_id: string;          // auth 유저 UUID (posts.author_id에 사용)
  nickname: string;
  personality: string;      // 성격/유형 (예: "직장인", "자영업자", "MZ세대")
  industry: string;         // 예: "마케팅", "요식업", "IT"
  prompt: string;           // 말투·행동 지침 프롬프트
  core_interests: string[]; // 관심사 배열
}

// ─── AI 생성 함수들 (npc-cron/route.ts와 동일 패턴) ───

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

    // 안전 필터 전부 해제 (NPC 콘텐츠는 자유롭게)
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
        maxOutputTokens: 800, // 리라이팅은 좀 더 길게
      },
      safetySettings,
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (err) {
    console.warn(
      `[Rewriter/Gemini 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
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
      max_tokens: 800,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.warn(
      `[Rewriter/Anthropic 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
    );
    return null;
  }
}

// 🥉 3순위: OpenAI GPT-4o-mini
async function generateWithOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    console.warn(
      `[Rewriter/OpenAI 실패] ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`
    );
    return null;
  }
}

// ─── AI 폴백 체인: Gemini → Anthropic → OpenAI ───
async function generateWithAI(
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string | null; provider: string }> {
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  // 🥇 Gemini
  if (geminiKey.length > 10) {
    const result = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "gemini-2.5-flash" };
  }

  // 🥈 Anthropic
  if (anthropicKey.length > 10) {
    const result = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "anthropic-haiku" };
  }

  // 🥉 OpenAI
  if (openaiKey.length > 10) {
    const result = await generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
    if (result) return { text: result, provider: "openai-4o-mini" };
  }

  return { text: null, provider: "none" };
}

// ================================================================
// ─── 핵심 함수: 외부 콘텐츠를 NPC 말투로 완전 재작성 ───
// ================================================================
export async function rewriteArticle(
  article: ScrapedArticle,
  persona: RewriterPersona
): Promise<RewriteResult | null> {
  console.log(
    `[Rewriter] 리라이팅 시작 — "${article.sourceTitle}" → ${persona.nickname}`
  );

  // ─── 시스템 프롬프트: NPC에게 "세뇌" ───
  const systemPrompt = `너는 "${persona.nickname}"이라는 사람이야.
직업/유형: ${persona.personality}
업종: ${persona.industry}
관심사: ${persona.core_interests.join(", ")}
행동지침: ${persona.prompt}

## 핵심 규칙
1. 너는 기사를 읽고 "내 경험·생각"으로 완전히 다시 써야 해
2. 원본 기사를 베끼거나 요약하면 절대 안 됨
3. 뉴스 기사체(~했다, ~한 것으로 알려졌다) 절대 금지
4. 마치 네가 직접 경험하고 느낀 것처럼 1인칭으로 써
5. 커뮤니티 게시글 느낌으로 — 딱딱하면 안 됨
6. 원본 출처를 절대 언급하지 마
7. 제목도 커뮤니티 스타일로 완전히 새로 만들어
8. 반드시 행동지침에 나온 말투를 지켜

## 출력 형식
첫 줄: 제목 (제목만, "제목:" 같은 접두사 없이)
둘째 줄: 빈 줄
셋째 줄부터: 본문 (3~8문단, 200~500자)`;

  // ─── 유저 프롬프트: 원본 콘텐츠 전달 ───
  const userPrompt = `아래 내용을 참고해서 너만의 글을 써줘. 원본을 베끼지 말고, 네 경험과 의견으로 완전히 새로 써.

[참고 자료]
제목: ${article.sourceTitle}
내용: ${article.sourceBody.slice(0, 2000)}

위 내용을 참고만 하고, "${persona.nickname}"으로서 커뮤니티에 올릴 글을 써줘.`;

  // ─── AI 생성 ───
  const { text, provider } = await generateWithAI(systemPrompt, userPrompt);

  if (!text) {
    console.error(`[Rewriter] AI 생성 실패 — 모든 프로바이더 실패`);
    return null;
  }

  // ─── 결과 파싱: 첫 줄 = 제목, 나머지 = 본문 ───
  const lines = text.trim().split("\n");
  let title = lines[0]?.trim() || "";
  let body = "";

  // 제목에서 "제목:" 접두사 제거 (AI가 가끔 붙임)
  title = title.replace(/^(제목\s*[:：]\s*)/i, "").trim();
  // 제목에서 따옴표 제거
  title = title.replace(/^["'「]|["'」]$/g, "").trim();

  // 빈 줄 이후를 본문으로 처리
  let bodyStartIndex = 1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      bodyStartIndex = i + 1;
      break;
    }
  }
  body = lines.slice(bodyStartIndex).join("\n").trim();

  // 본문이 비어있으면 두 번째 줄부터 전부 본문으로
  if (!body && lines.length > 1) {
    body = lines.slice(1).join("\n").trim();
  }

  // 최소 품질 체크
  if (!title || title.length < 5) {
    console.warn(`[Rewriter] 제목이 너무 짧음: "${title}"`);
    return null;
  }
  if (!body || body.length < 50) {
    console.warn(`[Rewriter] 본문이 너무 짧음: ${body.length}자`);
    return null;
  }

  console.log(
    `[Rewriter] 리라이팅 완료 — "${title}" (${body.length}자, ${provider})`
  );

  return { title, body, provider };
}
