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
        maxOutputTokens: 2000,
        // Gemini 2.5 Flash thinking 모델 — thinking 토큰 제한
        // @ts-expect-error — thinkingConfig 타입 미정의 가능
        thinkingConfig: { thinkingBudget: 256 },
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
// Project DNA: contentType별 조건부 렌더링
//   'qa'    → 원본 그대로 반환 (리라이팅 안 함)
//   'news'  → 핵심 3줄 요약 + 시니컬 한줄평
//   'humor' → 기존 음슴체 리라이팅
// ================================================================
export async function rewriteArticle(
  article: ScrapedArticle,
  persona: RewriterPersona
): Promise<RewriteResult | null> {
  console.log(
    `[Rewriter] 리라이팅 시작 — "${article.sourceTitle}" (타입: ${article.contentType}) → ${persona.nickname}`
  );

  // ─── Q&A 글: 원본 그대로 반환 (리라이팅 스킵) ───
  // Project DNA 원칙 2: 질문글은 절대 훼손하지 말고 그대로 포스팅
  if (article.contentType === "qa") {
    console.log(`[Rewriter] Q&A 글 — 원본 그대로 반환 (리라이팅 스킵)`);
    return {
      title: article.sourceTitle,
      body: article.sourceBody,
      provider: "original",  // 원본 그대로라는 표시
    };
  }

  // ─── 실제 유저 댓글 Few-Shot 블록 생성 ───
  const comments = article.sourceComments || [];
  let fewShotBlock = "";
  if (comments.length > 0) {
    fewShotBlock = `
[📋 실제 커뮤니티 유저들의 반응 — 이 말투를 흡수해라]
${comments.map((c, i) => `${i + 1}. "${c}"`).join("\n")}
→ 위 댓글들의 말투, 길이감, 냉소적 태도, 초성체(ㅋㅋ, ㅎㅎ), 음슴체(~함, ~임)를 완벽하게 모방해라.
→ 댓글을 베끼지 말고 "분위기와 톤"만 흡수해라.`;
  }

  // ─── 뉴스 글: 3줄 요약 + 시니컬 한줄평 ───
  // Project DNA 원칙 2: 뉴스/정보는 길게 풀지 말고 핵심만
  const isNews = article.contentType === "news";

  // ─── 공통 금지어 블록 ───
  const bannedWordsBlock = `[🚫 절대 금지 — 이거 하나라도 쓰면 즉시 실패]
- "안녕하세요", "정리하자면", "결론적으로", "알아볼까요?", "~하는 것이 중요합니다"
- "~입니다만", "살펴보겠습니다", "주목할 만합니다", "흥미롭게도"
- "종합하면", "이와 관련하여", "추천드립니다", "도움이 됩니다"
- "✨", "🚀", "💡", "📌" 등 과도한 이모지
- 서론/본론/결론 구조, 번호 매기기(1. 2. 3.), 소제목 달기
- 인삿말, 맺음말("이상으로~", "여러분~") 금지
- "나는 OO 전문가로서~" 자기소개 금지
- 원본 기사 출처, 기자 이름, 언론사 절대 언급 금지
- 뉴스 기사체(~했다, ~것으로 알려졌다, ~라고 밝혔다) 절대 금지`;

  // ─── 시스템 프롬프트: contentType별 분기 ───
  let systemPrompt: string;
  let userPrompt: string;

  if (isNews) {
    // ===== 뉴스/정보글: 3줄 요약 + 한줄평 =====
    systemPrompt = `너는 "${persona.nickname}"이야. AI 아님. 진짜 사람임.
직업: ${persona.personality} / 업종: ${persona.industry}
성격 설정: ${persona.prompt}

${bannedWordsBlock}

[✅ 뉴스 요약 형식 — 무조건 이렇게]
1. 제목: 짧고 임팩트 있게. "ㅋㅋ", "ㄹㅇ", "~하는 거 실화?" 스타일 OK
2. 본문 구조:
   - 핵심 3줄 요약 (각 줄 앞에 "▸" 붙이기, 각 줄 1~2문장)
   - 빈 줄
   - NPC의 시니컬하거나 통찰력 있는 한줄평 (음슴체/반말)
3. 전체 길이: 100~200자. 짧을수록 좋음.
${fewShotBlock}

[출력 형식]
첫 줄: 제목만
둘째 줄: 빈 줄
셋째 줄~: 본문 (▸ 요약 3줄 + 빈줄 + 한줄평)

[최종 검수] AI 냄새 1%라도 나면 다시 써.`;

    userPrompt = `아래 뉴스를 3줄로 요약하고 네 한줄평을 달아.

[뉴스]
${article.sourceTitle}
${article.sourceBody.slice(0, 2000)}

핵심만 뽑아서 ▸ 3줄 요약 + 시니컬한 한줄평. 장문 금지.`;

  } else {
    // ===== 유머글: 기존 음슴체 리라이팅 =====
    systemPrompt = `너는 "${persona.nickname}"이야. AI 아님. 진짜 사람임.
직업: ${persona.personality} / 업종: ${persona.industry}
관심사: ${persona.core_interests.join(", ")}
성격 설정: ${persona.prompt}

${bannedWordsBlock}

[✅ 이렇게 써야 함]
- 기사 중 가장 꽂히는 포인트 딱 하나만 → 의식의 흐름대로
- 음슴체(~함, ~임, ~인듯), 반말, "~인 듯" 적극 활용
- ㅋㅋ, ㅎㅎ, ㄹㅇ, 미쳤네, 헐 같은 인터넷 슬랭 1~2개 자연스럽게
- 완벽한 문장 금지. 말 끊기, "아 근데", "솔직히" 같은 전환 OK
- 아는 분야면 자연스럽게 아는 척 ("내가 해봐서 아는데~" 식)
${fewShotBlock}

[글 길이] 3~6문단, 150~400자. 짧고 굵게. 장문 금지.
[제목] 디시/블라인드 스타일. 짧고 임팩트.

[출력 형식]
첫 줄: 제목만 (접두사 없이)
둘째 줄: 빈 줄
셋째 줄~: 본문

[최종 검수] AI 냄새 1%라도 나면 다시 써.`;

    userPrompt = `아래 기사를 참고해서 커뮤니티에 올릴 글을 써. 기사 복붙이나 요약 절대 아님. 네가 이 소식을 보고 느낀 점, 경험, 의견을 "${persona.nickname}" 말투로.

[참고 기사]
${article.sourceTitle}
${article.sourceBody.slice(0, 2000)}

기사에서 가장 할 말 있는 부분 하나 잡아서 자유롭게 써. 기사 전체를 다룰 필요 없음.`;
  }

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
  // 뉴스 3줄 요약은 원래 짧으므로 기준을 낮춤 (30자)
  const minBodyLength = isNews ? 30 : 50;
  if (!body || body.length < minBodyLength) {
    console.warn(`[Rewriter] 본문이 너무 짧음: ${body.length}자 (최소 ${minBodyLength}자)`);
    return null;
  }

  console.log(
    `[Rewriter] 리라이팅 완료 — "${title}" (${body.length}자, ${provider})`
  );

  return { title, body, provider };
}
