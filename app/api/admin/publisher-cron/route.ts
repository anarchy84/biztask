// ================================================================
// 발행부 (The Publisher) — RAG 댓글 엔진 포함
// 날짜: 2026-03-31
// 용도: content_backlog(창고)에서 미발행 글을 꺼내서 가공+발행
// 호출: cron-job.org에서 1~2시간마다 호출
// 패턴: Hit & Run (GET 즉시 200 → after()로 백그라운드 실행)
//
// [글밥 창고 시스템 — 3단계 중 "발행" 담당]
// 1. content_backlog에서 is_published=false인 글 1개 가져옴
// 2. content_type별 조건부 처리:
//    - qa(질문): 원본 유지 + NPC가 전문가 답변 댓글 생성
//    - news(뉴스): 3줄 요약 + 시니컬 한줄평
//    - humor(유머): 댓글 RAG Few-Shot으로 분위기 흡수 → 음슴체 리라이팅
// 3. posts 테이블에 INSERT + is_published=true 업데이트
// ================================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import { rewriteArticle } from "@/lib/scrapers/rewriter";
import { downloadAndUploadImages } from "@/lib/scrapers/image-uploader";
import type { RewriterPersona } from "@/lib/scrapers/rewriter";
import type { ScrapedArticle } from "@/lib/scrapers/types";

// ─── KST 시간 유틸 ───
function getKSTDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function getKSTHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours();
}

// ─── 카테고리 → 커뮤니티 ID 매핑 ───
// 뉴스/비즈니스 카테고리는 전용 커뮤니티에, 유머/자동차는 community_id 없이 발행
const CATEGORY_COMMUNITY_MAP: Record<string, string> = {
  ai: "e92e136f-df36-4c8c-a5ad-cb8d999649b9",         // 초급AI 실전반
  marketing: "c5a698b8-8047-41cf-83cb-548eca27e2e1",   // 마케팅
  business: "51c60f49-c1ba-407b-9de2-396657f15102",    // 사업
  qa: "c5a698b8-8047-41cf-83cb-548eca27e2e1",          // Q&A도 마케팅 커뮤니티
};

// ─── 카테고리 → posts.category 한글 값 ───
const CATEGORY_LABEL_MAP: Record<string, string> = {
  humor: "유머",
  free: "자유",
  car: "자동차",
  qa: "질문답변",
  ai: "AI",
  marketing: "마케팅",
  business: "사업",
};

// ─── 발행 결과 요약 ───
interface PublishSummary {
  backlogId: string | null;
  title: string;
  contentType: string;
  category: string;
  action: string;       // 'rewrite' | 'passthrough' | 'summary'
  postId: string | null;
  commentId: string | null;  // Q&A 전문가 댓글 ID
  success: boolean;
  error: string | null;
  debug?: string[];     // 디버그 로그 (임시)
}

// ================================================================
// GET 핸들러 — 외부 크론 진입점
// ================================================================
export async function GET(request: NextRequest) {
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

  after(async () => {
    try {
      console.log(`[Publisher GET→after] 발행 시작 (${currentDate} KST ${kstHour}시)`);
      await runPublishJob();
    } catch (err) {
      console.error("[Publisher GET→after] 발행 실패:", err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `발행부(Publisher) 크론 수신 → 백그라운드 실행 시작 (KST ${kstHour}시)`,
  });
}

// ================================================================
// 핵심 발행 로직
// ================================================================
async function runPublishJob(): Promise<PublishSummary> {
  const supabase = createAdminSupabaseClient();

  const emptySummary: PublishSummary = {
    backlogId: null,
    title: "",
    contentType: "",
    category: "",
    action: "",
    postId: null,
    commentId: null,
    success: false,
    error: null,
  };

  // ================================================================
  // STEP 1: 창고에서 미발행 글 1개 가져오기 (오래된 것부터)
  // ================================================================
  const { data: backlogItem, error: fetchError } = await supabase
    .from("content_backlog")
    .select("*")
    .eq("is_published", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (fetchError || !backlogItem) {
    console.log("[Publisher] 창고에 미발행 글 없음 — 대기");
    return { ...emptySummary, error: "창고 비어있음" };
  }

  const debugLog: string[] = [];
  const summary: PublishSummary = {
    backlogId: backlogItem.id,
    title: backlogItem.title,
    contentType: backlogItem.content_type,
    category: backlogItem.category,
    action: "",
    postId: null,
    commentId: null,
    success: false,
    error: null,
    debug: debugLog,
  };

  console.log(
    `[Publisher] 📦 창고에서 꺼냄: "${backlogItem.title}" ` +
    `[${backlogItem.category}/${backlogItem.content_type}] ` +
    `(댓글 ${(backlogItem.source_comments || []).length}개)`
  );

  // ================================================================
  // STEP 2: 활성 NPC 중 랜덤 1명 배정
  // ================================================================
  const { data: personas } = await supabase
    .from("personas")
    .select("id, user_id, nickname, personality, industry, prompt, core_interests")
    .eq("is_active", true);

  if (!personas || personas.length === 0) {
    console.warn("[Publisher] 활성 NPC 없음 — 발행 불가");
    summary.error = "활성 NPC 없음";
    return summary;
  }

  const persona = personas[
    Math.floor(Math.random() * personas.length)
  ] as unknown as RewriterPersona;

  // NPC 할당 기록
  await supabase
    .from("content_backlog")
    .update({ assigned_persona_id: persona.id })
    .eq("id", backlogItem.id);

  // ================================================================
  // STEP 3: content_type별 조건부 처리
  // ================================================================
  const contentType = backlogItem.content_type as "qa" | "news" | "humor";
  const comments: string[] = backlogItem.source_comments || [];

  // ScrapedArticle 형태로 변환 (rewriter 호환)
  const articleForRewriter: ScrapedArticle = {
    sourceUrl: backlogItem.source_url,
    sourceTitle: backlogItem.title,
    sourceBody: backlogItem.body_html || "",
    sourceImages: backlogItem.images || [],
    sourceComments: comments,
    sourceSite: backlogItem.source_name,
    category: backlogItem.category,
    contentType: contentType,
    scrapedAt: backlogItem.scraped_at,
  };

  let finalTitle: string;
  let finalBody: string;
  let expertCommentText: string | null = null;

  // ─── 이미지 있는 글: 원본 보존 (이미지+본문 맥락 유지) ───
  const hasImages = articleForRewriter.sourceImages.length > 0;

  if (contentType === "qa") {
    // ===== Q&A 질문글: 원본 그대로 포스팅 + 전문가 답변 댓글 생성 =====
    summary.action = "passthrough+expert_comment";
    finalTitle = backlogItem.title;
    finalBody = backlogItem.body_html || "";

    // 전문가 답변 댓글 생성 (RAG: 원본 댓글 참고)
    debugLog.push(`Q&A 감지 → 전문가 댓글 생성 시작 (댓글 RAG: ${comments.length}개)`);
    expertCommentText = await generateExpertComment(
      backlogItem.title,
      backlogItem.body_html || "",
      comments,
      persona,
      debugLog
    );

    debugLog.push(`전문가 댓글 결과: ${expertCommentText ? expertCommentText.length + '자' : 'null'}`);
    console.log(`[Publisher] Q&A → 원본 유지 + 전문가 댓글 생성`);

  } else if (hasImages) {
    // ===== 이미지 포함 글: 원본 보존 (리라이팅하면 맥락 깨짐) =====
    summary.action = "passthrough_with_images";

    // 이미지를 HTML <img> 태그로 변환하여 본문 상단에 배치
    const imageHtml = articleForRewriter.sourceImages
      .map(
        (imgUrl) =>
          `<img src="${imgUrl}" style="max-width:100%; height:auto; display:block; margin-bottom:15px;" />`
      )
      .join("\n");

    finalTitle = backlogItem.title;
    finalBody = imageHtml + "\n" + (backlogItem.body_html || "");

    console.log(
      `[Publisher] 이미지 ${articleForRewriter.sourceImages.length}개 포함 → 원본 보존`
    );

  } else {
    // ===== 뉴스/유머 (텍스트만): AI 리라이팅 (댓글 RAG 주입) =====
    summary.action = contentType === "news" ? "summary" : "rewrite";

    const rewriteResult = await rewriteArticle(articleForRewriter, persona);

    if (!rewriteResult) {
      console.error(`[Publisher] 리라이팅 실패: ${backlogItem.title}`);
      summary.error = "리라이팅 실패 (모든 AI 프로바이더)";
      return summary;
    }

    finalTitle = rewriteResult.title;
    finalBody = rewriteResult.body;

    console.log(
      `[Publisher] ${contentType === "news" ? "뉴스 요약" : "유머 리라이팅"} 완료 ` +
      `(${rewriteResult.provider}, ${finalBody.length}자)`
    );
  }

  // ================================================================
  // STEP 4: 이미지 다운로드 → Supabase Storage 업로드
  // ================================================================
  const authorId = persona.user_id;
  let uploadedImageUrls: string[] = [];

  if (articleForRewriter.sourceImages.length > 0) {
    try {
      const imageResult = await downloadAndUploadImages(
        articleForRewriter.sourceImages,
        supabase,
        authorId,
        backlogItem.source_url
      );
      uploadedImageUrls = imageResult.uploaded;
      console.log(
        `[Publisher] 이미지 업로드: ${uploadedImageUrls.length}개 성공, ${imageResult.failed}개 실패`
      );

      // 업로드 성공한 이미지로 본문 내 이미지 URL 교체
      if (uploadedImageUrls.length > 0 && hasImages) {
        // 원본 이미지 URL을 업로드된 URL로 교체
        for (let i = 0; i < Math.min(articleForRewriter.sourceImages.length, uploadedImageUrls.length); i++) {
          finalBody = finalBody.replace(
            articleForRewriter.sourceImages[i],
            uploadedImageUrls[i]
          );
        }
      }
    } catch (imgErr) {
      console.warn(
        "[Publisher] 이미지 업로드 에러 (무시):",
        imgErr instanceof Error ? imgErr.message : String(imgErr)
      );
    }
  }

  // ================================================================
  // STEP 5: 게시글 발행 (posts 테이블 INSERT)
  // ================================================================
  const communityId = CATEGORY_COMMUNITY_MAP[backlogItem.category] || null;
  const postCategory = CATEGORY_LABEL_MAP[backlogItem.category] || "자유";

  const postData: Record<string, unknown> = {
    title: finalTitle,
    content: finalBody,
    author_id: authorId,
    category: postCategory,
    comment_count: 0,
    upvotes: 0,
  };

  if (uploadedImageUrls.length > 0) {
    postData.image_urls = uploadedImageUrls;
  }

  if (communityId) {
    postData.community_id = communityId;
  }

  const { data: newPost, error: postError } = await supabase
    .from("posts")
    .insert(postData)
    .select("id")
    .single();

  if (postError) {
    console.error(`[Publisher] 게시글 발행 실패: ${postError.message}`);
    summary.error = `게시글 발행 실패: ${postError.message}`;
    return summary;
  }

  summary.postId = newPost.id;

  // ================================================================
  // STEP 6: Q&A 전문가 댓글 달기 (Q&A 글만 해당)
  // ================================================================
  if (contentType === "qa" && expertCommentText) {
    try {
      debugLog.push(`댓글 INSERT 시도 — post_id: ${newPost.id}, author_id: ${authorId}, content: ${expertCommentText.length}자`);

      const { data: newComment, error: commentError } = await supabase
        .from("comments")
        .insert({
          post_id: newPost.id,
          user_id: authorId,
          content: expertCommentText,
        })
        .select("id")
        .single();

      if (commentError) {
        debugLog.push(`❌ 댓글 INSERT 에러: ${commentError.message} (code: ${commentError.code})`);
        console.error("[Publisher] 댓글 INSERT 실패:", commentError.message);
      }

      if (newComment) {
        summary.commentId = newComment.id;
        debugLog.push(`✅ 댓글 INSERT 성공 — commentId: ${newComment.id}`);

        // 댓글 수 증가
        try {
          await supabase.rpc("increment_comment_count", { post_id_input: newPost.id });
        } catch {
          // rpc 없으면 직접 업데이트
          await supabase.from("posts").update({ comment_count: 1 }).eq("id", newPost.id);
        }

        console.log(`[Publisher] 💬 전문가 댓글 발행 완료 (${expertCommentText.length}자)`);
      } else {
        debugLog.push("❌ newComment가 null (INSERT 후 반환값 없음)");
      }
    } catch (cmtErr) {
      debugLog.push(`❌ 댓글 catch 에러: ${cmtErr instanceof Error ? cmtErr.message : String(cmtErr)}`);
      console.warn(
        "[Publisher] 전문가 댓글 발행 실패 (게시글은 성공):",
        cmtErr instanceof Error ? cmtErr.message : String(cmtErr)
      );
    }
  }

  // ================================================================
  // STEP 7: content_backlog 상태 업데이트 (발행 완료!)
  // ================================================================
  await supabase
    .from("content_backlog")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
      result_post_id: newPost.id,
    })
    .eq("id", backlogItem.id);

  // NPC 일일 카운터 증가
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
    console.warn("[Publisher] today_posts 증가 실패 — 스킵");
  }

  summary.success = true;
  console.log(
    `[Publisher] ✅ 발행 완료: "${finalTitle}" by ${persona.nickname} ` +
    `[${postCategory}] (action: ${summary.action})`
  );

  return summary;
}

// ================================================================
// 전문가 답변 댓글 생성 (Q&A 글 전용)
// ─── RAG: 원본 댓글을 참고하여 18년차 마케터 답변 생성 ───
// ================================================================
async function generateExpertComment(
  title: string,
  body: string,
  originalComments: string[],
  persona: RewriterPersona,
  debugLog: string[] = []
): Promise<string | null> {
  // ─── 원본 댓글 RAG 블록 ───
  let ragBlock = "";
  if (originalComments.length > 0) {
    ragBlock = `
[📋 원본 글에 달린 실제 답변들 — 참고만 하고 베끼지 마]
${originalComments.map((c, i) => `${i + 1}. "${c}"`).join("\n")}
→ 위 답변들의 수준과 방향은 참고하되, 너만의 경험과 관점으로 새롭게 답변해라.`;
  }

  const systemPrompt = `너는 "${persona.nickname}"이야. 18년차 디지털마케팅 베테랑.
직업: ${persona.personality} / 업종: ${persona.industry}
성격: ${persona.prompt}

너는 비즈니스 커뮤니티에서 후배들 질문에 답변해주는 고수야.
${ragBlock}

[답변 스타일]
- 반말 + 음슴체 (이건 ~함, ~인듯, ~해봤는데)
- 구체적인 경험 기반: "내가 해봤는데~", "우리 때는~", "솔직히~"
- 질문의 핵심만 콕 짚어서 실전 조언
- 이론이 아닌 현장 노하우
- 200~400자. 장황하게 쓰지 마.
- "안녕하세요", "도움이 되셨으면", "화이팅" 같은 인사치레 절대 금지
- AI 냄새 1%라도 나면 실패임

[🚫 금지]
- "정리하자면", "결론적으로", "추천드립니다", "중요합니다"
- "1. 2. 3." 번호 매기기, 소제목
- "저는 ~전문가로서" 자기소개
- 이모지 남발 (1~2개까지만)`;

  const userPrompt = `아래 질문에 고수답게 답변해줘.

[질문 제목] ${title}
[질문 내용] ${body.slice(0, 1500)}

핵심만 콕 짚어서 경험 기반으로 답변. 장문 금지.`;

  // AI 생성 (Gemini → Anthropic → OpenAI 폴백)
  try {
    const geminiKey = process.env.GEMINI_API_KEY || "";
    const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
    const openaiKey = process.env.OPENAI_API_KEY || "";

    debugLog.push(`API 키 상태 — Gemini: ${geminiKey.length}자, Anthropic: ${anthropicKey.length}자, OpenAI: ${openaiKey.length}자`);

    // 🥇 Gemini
    if (geminiKey.length > 10) {
      debugLog.push("Gemini 시도 중...");
      try {
        const result = await generateWithGemini(geminiKey, systemPrompt, userPrompt);
        if (result) {
          debugLog.push(`✅ Gemini 성공 (${result.length}자)`);
          return result;
        }
        debugLog.push("❌ Gemini: null 반환");
      } catch (e) {
        debugLog.push(`❌ Gemini 에러: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      debugLog.push("Gemini 키 없음 (skip)");
    }

    // 🥈 Anthropic
    if (anthropicKey.length > 10) {
      debugLog.push("Anthropic 시도 중...");
      try {
        const result = await generateWithAnthropic(anthropicKey, systemPrompt, userPrompt);
        if (result) {
          debugLog.push(`✅ Anthropic 성공 (${result.length}자)`);
          return result;
        }
        debugLog.push("❌ Anthropic: null 반환");
      } catch (e) {
        debugLog.push(`❌ Anthropic 에러: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      debugLog.push("Anthropic 키 없음 (skip)");
    }

    // 🥉 OpenAI
    if (openaiKey.length > 10) {
      debugLog.push("OpenAI 시도 중...");
      try {
        const result = await generateWithOpenAI(openaiKey, systemPrompt, userPrompt);
        if (result) {
          debugLog.push(`✅ OpenAI 성공 (${result.length}자)`);
          return result;
        }
        debugLog.push("❌ OpenAI: null 반환");
      } catch (e) {
        debugLog.push(`❌ OpenAI 에러: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      debugLog.push("OpenAI 키 없음 (skip)");
    }

    debugLog.push("모든 AI 프로바이더 실패 → null");
    return null;
  } catch (err) {
    console.error(
      "[Publisher] 전문가 댓글 AI 생성 실패:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ─── AI 프로바이더 함수들 (rewriter.ts와 동일 패턴) ───

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
        temperature: 0.9,
        maxOutputTokens: 1000,
        // @ts-expect-error — thinkingConfig 타입 미정의
        thinkingConfig: { thinkingBudget: 256 },
      },
      safetySettings,
    });

    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (err) {
    console.warn(
      `[Publisher/Gemini] ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`
    );
    return null;
  }
}

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
      max_tokens: 600,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.warn(
      `[Publisher/Anthropic] ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`
    );
    return null;
  }
}

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
      max_tokens: 600,
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    return completion.choices[0]?.message?.content || null;
  } catch (err) {
    console.warn(
      `[Publisher/OpenAI] ${err instanceof Error ? err.message.slice(0, 100) : String(err)}`
    );
    return null;
  }
}

// ================================================================
// POST 핸들러 — 수동 테스트용
// ================================================================
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json(
        { success: false, error: "인증 실패" },
        { status: 401 }
      );
    }

    const currentDate = getKSTDate();
    const kstHour = getKSTHour();

    const result = await runPublishJob();

    return Response.json({
      currentDate,
      kstHour,
      ...result,
    });
  } catch (error) {
    console.error("[Publisher POST] 예외 발생:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러",
      },
      { status: 500 }
    );
  }
}
