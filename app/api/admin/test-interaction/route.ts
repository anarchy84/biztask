// 파일 위치: app/api/admin/test-interaction/route.ts
// 용도: NPC 군단 대규모 상호작용 테스트 API
// 기능:
//   1. 랜덤 NPC가 게시글 작성 (AI 또는 템플릿 기반)
//   2. 랜덤 NPC가 최근 글에 댓글 달기 (아나키 글 우선)
//   3. 랜덤 NPC가 최근 글에 추천(upvote) 누르기
// 보안: Service Role Key로 RLS 우회 (서버에서만 실행)

import { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";

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
}

interface ActionResult {
  action: string;       // "post" | "comment" | "upvote"
  persona: string;      // NPC 닉네임
  success: boolean;
  detail: string;       // 수행 내용 요약
  error?: string;       // 에러 시 메시지
}

// ─── 카테고리 목록 (랜덤 선택용) ───
const CATEGORIES = ["자유", "사업", "마케팅", "커리어", "이직", "재테크", "트렌드"];

// ─── 템플릿 글 제목 (AI 없을 때 사용) ───
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

// ─── 템플릿 글 본문 (AI 없을 때 사용) ───
const TEMPLATE_CONTENTS = [
  "안녕하세요, {nickname}입니다. {industry} 분야에서 일하면서 최근 느낀 점을 공유해봅니다.\n\n요즘 시장 변화가 정말 빠르게 느껴지더라고요. 특히 AI 관련 도구들이 업무 방식을 완전히 바꾸고 있어서, 적응하려면 계속 공부해야 할 것 같습니다.\n\n여러분은 어떻게 대응하고 계신가요? 좋은 방법이 있으면 공유 부탁드립니다!",
  "최근에 {industry} 관련 프로젝트를 진행하면서 깨달은 게 있는데요.\n\n결국 가장 중요한 건 기본기라는 거예요. 화려한 최신 기술보다 기본에 충실한 게 장기적으로 더 효과적이더라고요.\n\n{personality} 성격이라 그런지 실전에서 부딪혀보는 게 제일 잘 맞는 것 같습니다.",
  "오늘 {industry} 관련 세미나에 다녀왔습니다.\n\n인상 깊었던 건 중소기업들도 이제 디지털 전환에 본격적으로 나서고 있다는 거예요. 예산이 부족해도 무료 툴이나 AI 도구를 활용해서 효율을 높이는 사례가 많았습니다.\n\n비즈태스크 멤버분들도 유용한 도구 있으면 추천해주세요!",
  "{industry}에서 일한 지 꽤 됐는데, 여전히 새로운 걸 배우는 게 즐겁습니다.\n\n특히 요즘은 데이터 기반 의사결정이 점점 중요해지고 있어서, 관련 역량을 키우는 게 필수인 것 같아요.\n\n같은 분야에서 일하시는 분들, 어떤 툴 쓰시나요? 서로 정보 공유하면 좋겠습니다.",
  "요즘 {industry} 업계에서 핫한 키워드가 뭔지 아시나요?\n\n제가 보기에는 '자동화'와 '개인화'인 것 같습니다. 단순 반복 작업은 자동화하고, 고객한테는 맞춤형 경험을 제공하는 게 대세더라고요.\n\n{nickname}의 관점에서 정리해봤는데, 여러분 의견도 궁금합니다!",
];

// ─── 템플릿 댓글 (AI 없을 때 사용) ───
const TEMPLATE_COMMENTS = [
  "좋은 글이네요! 저도 {industry} 분야에서 비슷한 경험을 했습니다.",
  "공감합니다. 특히 요즘 시장 변화가 빠르다는 부분이 와닿네요.",
  "유익한 정보 감사합니다! 참고하겠습니다 👍",
  "오 이런 관점은 처음이네요. 좋은 인사이트 감사합니다.",
  "맞아요, 기본기가 정말 중요하죠. 좋은 리마인더가 됐습니다.",
  "실전 경험에서 나온 이야기라 더 와닿습니다.",
  "저도 비슷한 생각이었는데 정리해주셔서 감사해요!",
  "현업 종사자 분의 의견이라 신뢰가 갑니다. 응원합니다!",
  "이 글 북마크 해둬야겠네요. 나중에 다시 읽어봐야지.",
  "댓글 달고 갑니다. {industry} 쪽 이야기는 항상 흥미롭네요.",
  "새로운 시각을 얻어갑니다. 좋은 글 감사해요!",
  "구체적인 사례가 있어서 이해하기 쉬웠습니다.",
];

// ─── 유틸: 배열에서 랜덤 항목 뽑기 ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 유틸: 템플릿 문자열에 변수 치환 ───
function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ─── AI 텍스트 생성 (Anthropic Claude API) ───
async function generateWithAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    // 동적 import로 Anthropic SDK 로드 (서버에서만 실행)
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // 텍스트 블록만 추출
    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (error) {
    console.error("[AI 생성 실패]", error);
    return null; // 실패 시 null → 템플릿으로 폴백
  }
}

// ═══════════════════════════════════════════════════════
// POST 핸들러: NPC 군단 활동 시뮬레이션
// ═══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    // ─── 요청 바디 파싱 ───
    const body = await request.json();
    const {
      actions = 5,            // 수행할 총 액션 수 (기본 5)
      anthropicApiKey = "",   // 어드민 UI에서 입력한 Anthropic API 키
      anakiUserId = "",       // 아나키의 user_id (댓글 우선 대상)
    } = body;

    // API 키: 요청 바디에서 받은 키 → 환경변수 순으로 체크
    const effectiveApiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY || "";
    const useAI = effectiveApiKey.length > 10; // AI 사용 여부

    // ─── Service Role Supabase 클라이언트 생성 ───
    const supabase = createAdminSupabaseClient();

    // ─── 활성 NPC 페르소나 목록 가져오기 ───
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, user_id, nickname, avatar_url, industry, personality, prompt, is_active")
      .eq("is_active", true);

    if (personaError || !personas || personas.length === 0) {
      return Response.json(
        { success: false, error: "활성 NPC 페르소나가 없습니다.", detail: personaError?.message },
        { status: 400 }
      );
    }

    // ─── 최근 게시글 목록 가져오기 (댓글/추천 대상) ───
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, author_id, title, category")
      .order("created_at", { ascending: false })
      .limit(20);

    // 아나키 글 분리 (우선 댓글 대상)
    const anakiPosts = recentPosts?.filter((p) => p.author_id === anakiUserId) || [];
    const allPosts = recentPosts || [];

    // ─── 액션 분배: 글쓰기 30%, 댓글 40%, 추천 30% ───
    const actionCount = Math.min(actions, 20); // 최대 20개 제한
    const postCount = Math.max(1, Math.round(actionCount * 0.3));
    const commentCount = Math.max(1, Math.round(actionCount * 0.4));
    const upvoteCount = Math.max(1, actionCount - postCount - commentCount);

    const results: ActionResult[] = [];

    // ═══════════════════════════════════
    // 1) NPC 글쓰기
    // ═══════════════════════════════════
    for (let i = 0; i < postCount; i++) {
      const persona = pickRandom(personas) as Persona;
      const category = pickRandom(CATEGORIES);
      const vars = {
        nickname: persona.nickname,
        industry: persona.industry,
        personality: persona.personality,
      };

      let title = "";
      let content = "";

      if (useAI) {
        // AI로 제목+본문 한번에 생성
        const systemPrompt = persona.prompt ||
          `당신은 '${persona.nickname}'이라는 닉네임의 ${persona.industry} 분야 전문가입니다. ` +
          `성격은 ${persona.personality}이고, 비즈니스 커뮤니티에서 활동 중입니다. ` +
          `자연스럽고 진정성 있는 한국어로 글을 작성하세요.`;

        const aiResult = await generateWithAI(
          effectiveApiKey,
          systemPrompt,
          `비즈니스 커뮤니티에 올릴 '${category}' 카테고리 글을 작성해주세요.\n` +
          `형식: 첫 줄에 제목만, 둘째 줄부터 본문.\n` +
          `분량: 제목 20자 이내, 본문 100~200자.\n` +
          `말투: ${persona.personality} 스타일로 자연스럽게.`
        );

        if (aiResult) {
          const lines = aiResult.trim().split("\n");
          title = lines[0].replace(/^#\s*/, "").replace(/^제목[:\s]*/i, "").trim();
          content = lines.slice(1).join("\n").replace(/^본문[:\s]*/i, "").trim();
        }
      }

      // AI 실패 시 또는 AI 미사용 시 → 템플릿 폴백
      if (!title || !content) {
        title = fillTemplate(pickRandom(TEMPLATE_TITLES), vars);
        content = fillTemplate(pickRandom(TEMPLATE_CONTENTS), vars);
      }

      // DB에 글 삽입
      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert({
          author_id: persona.user_id,
          title,
          content,
          category,
          upvotes: 0,
          comment_count: 0,
        })
        .select("id")
        .single();

      if (postError) {
        results.push({
          action: "post",
          persona: persona.nickname,
          success: false,
          detail: `글쓰기 실패: ${title}`,
          error: postError.message,
        });
      } else {
        // 페르소나 통계 업데이트 (total_posts +1)
        await supabase
          .from("personas")
          .update({
            total_posts: (persona.total_posts ?? 0) + 1,
            last_active_at: new Date().toISOString(),
          })
          .eq("id", persona.id);

        results.push({
          action: "post",
          persona: persona.nickname,
          success: true,
          detail: `[${category}] "${title}" 작성 완료 (ID: ${newPost?.id?.slice(0, 8)})`,
        });
      }
    }

    // ═══════════════════════════════════
    // 2) NPC 댓글 달기 (아나키 글 우선)
    // ═══════════════════════════════════
    for (let i = 0; i < commentCount; i++) {
      if (allPosts.length === 0) break; // 글이 없으면 스킵

      const persona = pickRandom(personas) as Persona;

      // 50% 확률로 아나키 글에 댓글 (아나키 글이 있을 때)
      const targetPost =
        anakiPosts.length > 0 && Math.random() < 0.5
          ? pickRandom(anakiPosts)
          : pickRandom(allPosts);

      let commentText = "";

      if (useAI) {
        const systemPrompt = persona.prompt ||
          `당신은 '${persona.nickname}'이라는 닉네임의 ${persona.industry} 전문가입니다. ` +
          `성격: ${persona.personality}. 자연스럽고 짧은 댓글을 작성하세요.`;

        const aiResult = await generateWithAI(
          effectiveApiKey,
          systemPrompt,
          `'${targetPost.title}' 라는 제목의 글에 달 댓글을 한 줄로 작성해주세요.\n` +
          `카테고리: ${targetPost.category}\n` +
          `50자 이내, 자연스럽고 공감하는 톤으로.`
        );

        if (aiResult) {
          commentText = aiResult.trim();
        }
      }

      // AI 실패 시 → 템플릿 폴백
      if (!commentText) {
        commentText = fillTemplate(pickRandom(TEMPLATE_COMMENTS), {
          industry: persona.industry,
          nickname: persona.nickname,
        });
      }

      // 댓글 삽입
      const { error: commentError } = await supabase
        .from("comments")
        .insert({
          post_id: targetPost.id,
          user_id: persona.user_id,
          content: commentText,
        });

      if (commentError) {
        results.push({
          action: "comment",
          persona: persona.nickname,
          success: false,
          detail: `댓글 실패 → "${targetPost.title}"`,
          error: commentError.message,
        });
      } else {
        // comment_count 직접 증가 (+1)
        // RPC 함수가 없을 수 있으므로 직접 업데이트 방식 사용
        await supabase
          .from("posts")
          .update({ comment_count: ((targetPost as { comment_count?: number }).comment_count ?? 0) + 1 })
          .eq("id", targetPost.id);

        // 페르소나 통계 업데이트
        await supabase
          .from("personas")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", persona.id);

        results.push({
          action: "comment",
          persona: persona.nickname,
          success: true,
          detail: `"${targetPost.title.slice(0, 20)}..." 에 댓글: "${commentText.slice(0, 30)}..."`,
        });
      }
    }

    // ═══════════════════════════════════
    // 3) NPC 추천(Upvote) 누르기
    // ═══════════════════════════════════
    for (let i = 0; i < upvoteCount; i++) {
      if (allPosts.length === 0) break;

      const persona = pickRandom(personas) as Persona;

      // 60% 확률로 아나키 글에 추천 (아나키 글이 있을 때)
      const targetPost =
        anakiPosts.length > 0 && Math.random() < 0.6
          ? pickRandom(anakiPosts)
          : pickRandom(allPosts);

      // 중복 추천 방지: 이미 추천했는지 확인
      const { data: existingLike } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", targetPost.id)
        .eq("user_id", persona.user_id)
        .maybeSingle();

      if (existingLike) {
        results.push({
          action: "upvote",
          persona: persona.nickname,
          success: false,
          detail: `"${targetPost.title.slice(0, 20)}..." 이미 추천함 → 스킵`,
        });
        continue;
      }

      // post_likes에 삽입
      const { error: likeError } = await supabase
        .from("post_likes")
        .insert({
          post_id: targetPost.id,
          user_id: persona.user_id,
        });

      if (likeError) {
        results.push({
          action: "upvote",
          persona: persona.nickname,
          success: false,
          detail: `추천 실패 → "${targetPost.title.slice(0, 20)}..."`,
          error: likeError.message,
        });
      } else {
        // upvotes 카운트 증가 — increment_upvotes RPC 사용
        const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
        if (rpcError) {
          // RPC 실패 시 직접 업데이트 폴백
          await supabase
            .from("posts")
            .update({ upvotes: ((targetPost as { upvotes?: number }).upvotes ?? 0) + 1 })
            .eq("id", targetPost.id);
        }

        // 페르소나 통계 업데이트
        await supabase
          .from("personas")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", persona.id);

        results.push({
          action: "upvote",
          persona: persona.nickname,
          success: true,
          detail: `"${targetPost.title.slice(0, 20)}..." 추천 완료`,
        });
      }
    }

    // ─── 결과 요약 반환 ───
    const summary = {
      총액션: results.length,
      성공: results.filter((r) => r.success).length,
      실패: results.filter((r) => !r.success).length,
      글쓰기: results.filter((r) => r.action === "post" && r.success).length,
      댓글: results.filter((r) => r.action === "comment" && r.success).length,
      추천: results.filter((r) => r.action === "upvote" && r.success).length,
      AI사용: useAI,
    };

    return Response.json({
      success: true,
      summary,
      results,
    });
  } catch (error) {
    console.error("[test-interaction] 전체 에러:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 에러가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
