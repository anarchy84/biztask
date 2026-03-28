// 파일 위치: app/api/admin/test-interaction/route.ts
// 용도: NPC 군단 대규모 상호작용 테스트 API
// 기능:
//   1. NPC별 개별 유저 계정 자동 생성 (첫 실행 시)
//   2. 랜덤 NPC가 게시글 작성 (AI 또는 템플릿 기반)
//   3. 랜덤 NPC가 최근 글에 댓글 달기 (아나키 글 우선)
//   4. 랜덤 NPC가 최근 글에 추천(upvote) 누르기
//   5. 액션 사이에 자연스러운 딜레이 (2~5초)
// 보안: Service Role Key로 RLS 우회 (서버에서만 실행)

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
}

interface ActionResult {
  action: string;       // "post" | "comment" | "reply" | "upvote" | "setup"
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

// ─── 템플릿 댓글 (AI 없을 때 사용) - 카테고리별 맥락 기반 ───
const TEMPLATE_COMMENTS_BY_CATEGORY: Record<string, string[]> = {
  "자유": [
    "공감합니다! 저도 비슷한 경험을 했어요.",
    "오 이런 관점은 처음이네요. 좋은 인사이트네요.",
    "맞아요, 정말 공감되는 내용이에요.",
    "이런 얘기 계속 들으면 좋겠습니다!",
    "와 정말 흥미로운 관점입니다 🤔",
  ],
  "사업": [
    "사업하시면서 이런 경험 정말 도움이 됩니다.",
    "구체적인 팁 감사합니다! 바로 적용해봐야겠어요.",
    "실제 사업가 분의 경험담이라 더 와닿네요.",
    "이런 전략 저도 시도해봐야겠습니다.",
    "사업 실전에서 배우는 게 최고죠. 좋은 글입니다!",
  ],
  "마케팅": [
    "마케팅 관점에서 정말 좋은 지적입니다!",
    "이 방법 우리 팀도 시도해보겠습니다.",
    "요즘 마케팅 트렌드를 잘 정리해주셨네요.",
    "데이터 기반 마케팅의 중요성 공감합니다.",
    "이렇게 성과 내신 경험담 정말 귀하네요.",
  ],
  "커리어": [
    "커리어 관점에서 정말 좋은 조언입니다.",
    "저도 비슷한 고민을 하고 있었어요. 감사합니다!",
    "현업자의 목소리라 더 신뢰가 가네요.",
    "이런 경험담이 정말 필요했습니다.",
    "커리어 선택에 큰 참고가 될 것 같습니다.",
  ],
  "이직": [
    "이직 결정할 때 이런 정보가 정말 도움이 됩니다.",
    "솔직한 조언 감사해요. 많은 분들이 도움받을 거예요.",
    "이직 후 적응 과정이 있겠네요. 응원합니다!",
    "현실적인 팁 정말 좋습니다.",
    "이직 준비 중인데 정말 참고가 됩니다.",
  ],
  "재테크": [
    "재테크 팁 정말 실용적이네요!",
    "장기적 관점에서 정말 좋은 전략입니다.",
    "이런 재테크 경험담 정말 귀합니다.",
    "자산 관리 방법 좋은 아이디어 있으면 공유해주세요.",
    "이 방법 저도 고려해봐야겠네요.",
  ],
  "트렌드": [
    "최근 이 트렌드 정말 관심 받고 있더라고요.",
    "시장 흐름을 잘 파악하신 것 같습니다.",
    "이 부분은 앞으로 계속 중요할 것 같아요.",
    "좋은 정보 감사합니다!",
    "업계 전망에 대한 인사이트 정말 좋네요.",
  ],
};

// ─── 폴백용 기본 템플릿 댓글 ───
const TEMPLATE_COMMENTS = [
  "좋은 글 감사해요! 많이 배워갑니다.",
  "공감하는 부분이 많네요.",
  "유익한 내용 정말 감사합니다!",
  "좋은 관점이에요. 새로운 생각이 들었어요.",
  "현장의 목소리라 더 와닿습니다.",
  "이런 정보 계속 공유해주세요!",
  "실전 경험이 담겨있어서 좋네요.",
  "아 정말 공감돼요!",
  "이것도 하나의 방법이군요. 감사합니다.",
  "정말 도움이 되는 글입니다!",
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

// ─── 유틸: 자연스러운 딜레이 (2~5초 랜덤) ───
function randomDelay(): Promise<void> {
  const ms = 2000 + Math.random() * 3000; // 2초~5초
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── AI 텍스트 생성 (Anthropic Claude API) ───
async function generateWithAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string | null> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (error) {
    console.error("[AI 생성 실패]", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// NPC 개별 유저 계정 자동 생성
// - 모든 NPC가 관리자(아나키) user_id를 공유하고 있으면
//   각 NPC에게 개별 auth 계정 + profiles 행을 만들어줌
// ═══════════════════════════════════════════════════════
async function ensureNpcUsers(
  supabase: SupabaseClient,
  personas: Persona[],
  adminUserId: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  // 관리자 ID와 같은 user_id를 가진 NPC만 처리 (이미 개별 계정이 있으면 스킵)
  const needsSetup = personas.filter((p) => p.user_id === adminUserId);
  if (needsSetup.length === 0) return results;

  console.log(`[NPC 셋업] ${needsSetup.length}명의 NPC에게 개별 계정 생성 시작`);

  for (const persona of needsSetup) {
    try {
      // 1) Supabase Admin API로 auth 유저 생성
      const fakeEmail = `npc_${persona.id.slice(0, 8)}@biztask.local`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password: `npc_${crypto.randomUUID()}`, // 랜덤 비밀번호 (로그인 불필요)
        email_confirm: true,
        user_metadata: {
          nickname: persona.nickname,
          is_npc: true,
        },
      });

      if (authError || !authData?.user) {
        results.push({
          action: "setup",
          persona: persona.nickname,
          success: false,
          detail: `계정 생성 실패`,
          error: authError?.message || "auth user 생성 실패",
        });
        continue;
      }

      const newUserId = authData.user.id;

      // 2) profiles 테이블에 NPC 프로필 생성 (upsert)
      await supabase.from("profiles").upsert({
        id: newUserId,
        nickname: persona.nickname,
        avatar_url: persona.avatar_url,
      });

      // 3) personas 테이블의 user_id를 새 계정으로 변경
      await supabase
        .from("personas")
        .update({ user_id: newUserId })
        .eq("id", persona.id);

      // 메모리에도 반영 (이후 로직에서 새 user_id 사용하도록)
      persona.user_id = newUserId;

      results.push({
        action: "setup",
        persona: persona.nickname,
        success: true,
        detail: `개별 계정 생성 완료 (${newUserId.slice(0, 8)}...)`,
      });
    } catch (err) {
      results.push({
        action: "setup",
        persona: persona.nickname,
        success: false,
        detail: `계정 생성 중 예외 발생`,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
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
    const useAI = effectiveApiKey.length > 10;

    // ─── Service Role Supabase 클라이언트 생성 ───
    const supabase = createAdminSupabaseClient();

    // ─── 활성 NPC 페르소나 목록 가져오기 ───
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, total_posts, total_comments, total_likes")
      .eq("is_active", true);

    if (personaError || !personas || personas.length === 0) {
      return Response.json(
        { success: false, error: "활성 NPC 페르소나가 없습니다.", detail: personaError?.message },
        { status: 400 }
      );
    }

    const results: ActionResult[] = [];

    // ═══════════════════════════════════
    // 0) NPC 개별 유저 계정 셋업 (첫 실행 시에만)
    // ═══════════════════════════════════
    if (anakiUserId) {
      const setupResults = await ensureNpcUsers(supabase, personas as Persona[], anakiUserId);
      results.push(...setupResults);
    }

    // ─── 최근 게시글 목록 가져오기 (댓글/추천 대상) ───
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, author_id, title, category, upvotes, comment_count")
      .order("created_at", { ascending: false })
      .limit(30);

    // 아나키 글 분리 (우선 댓글 대상)
    const anakiPosts = recentPosts?.filter((p) => p.author_id === anakiUserId) || [];
    const allPosts = recentPosts || [];

    // ─── 액션 분배: 글쓰기 15%, 댓글 25%, 대댓글 20%, 추천 40% ───
    const actionCount = Math.min(actions, 20);
    const postCount = Math.max(1, Math.round(actionCount * 0.15));
    const commentCount = Math.max(1, Math.round(actionCount * 0.25));
    const replyCount = Math.max(1, Math.round(actionCount * 0.20));
    const upvoteCount = Math.max(1, actionCount - postCount - commentCount - replyCount);

    // ─── 액션을 섞어서 자연스럽게 실행 ───
    // (글쓰기만 몰아서 하지 않고, 댓글/대댓글/추천을 섞어서)
    type ActionItem = { type: "post" } | { type: "comment" } | { type: "reply" } | { type: "upvote" };
    const actionQueue: ActionItem[] = [];
    for (let i = 0; i < postCount; i++) actionQueue.push({ type: "post" });
    for (let i = 0; i < commentCount; i++) actionQueue.push({ type: "comment" });
    for (let i = 0; i < replyCount; i++) actionQueue.push({ type: "reply" });
    for (let i = 0; i < upvoteCount; i++) actionQueue.push({ type: "upvote" });

    // 셔플 (Fisher-Yates)
    for (let i = actionQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [actionQueue[i], actionQueue[j]] = [actionQueue[j], actionQueue[i]];
    }

    // 새로 생성된 글을 댓글/추천 대상에 추가하기 위한 배열
    const newPostIds: { id: string; author_id: string; title: string; category: string }[] = [];

    // ═══════════════════════════════════
    // 메인 루프: 셔플된 액션을 순서대로 실행
    // ═══════════════════════════════════
    for (let idx = 0; idx < actionQueue.length; idx++) {
      const action = actionQueue[idx];

      // 첫 액션 이후부터 딜레이 적용
      if (idx > 0) {
        await randomDelay();
      }

      if (action.type === "post") {
        // ─── 글쓰기 ───
        const persona = pickRandom(personas) as Persona;
        const category = pickRandom(CATEGORIES);
        const vars = { nickname: persona.nickname, industry: persona.industry, personality: persona.personality };

        let title = "";
        let content = "";

        if (useAI) {
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

        if (!title || !content) {
          title = fillTemplate(pickRandom(TEMPLATE_TITLES), vars);
          content = fillTemplate(pickRandom(TEMPLATE_CONTENTS), vars);
        }

        const { data: newPost, error: postError } = await supabase
          .from("posts")
          .insert({ author_id: persona.user_id, title, content, category, upvotes: 0, comment_count: 0 })
          .select("id")
          .single();

        if (postError) {
          results.push({ action: "post", persona: persona.nickname, success: false, detail: `글쓰기 실패: ${title}`, error: postError.message });
        } else {
          // 새 글을 댓글/추천 후보에 추가
          if (newPost) {
            newPostIds.push({ id: newPost.id, author_id: persona.user_id, title, category });
          }
          await supabase.from("personas").update({ total_posts: (persona.total_posts ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
          results.push({ action: "post", persona: persona.nickname, success: true, detail: `[${category}] "${title}" 작성 완료` });
        }

      } else if (action.type === "comment") {
        // ─── 댓글 달기 ───
        const availablePosts = [...allPosts, ...newPostIds];
        if (availablePosts.length === 0) {
          results.push({ action: "comment", persona: "-", success: false, detail: "댓글 달 글이 없음" });
          continue;
        }

        const persona = pickRandom(personas) as Persona;

        // 50% 확률로 아나키 글에 댓글
        const targetPost =
          anakiPosts.length > 0 && Math.random() < 0.5
            ? pickRandom(anakiPosts)
            : pickRandom(availablePosts);

        let commentText = "";

        if (useAI) {
          // 대상 글의 본문도 가져오기 (맥락 기반 댓글)
          const { data: postContent } = await supabase
            .from("posts")
            .select("content")
            .eq("id", targetPost.id)
            .single();

          const systemPrompt = persona.prompt ||
            `당신은 '${persona.nickname}'이라는 닉네임의 ${persona.industry} 전문가입니다. ` +
            `성격: ${persona.personality}. 자연스럽고 짧은 댓글을 작성하세요.`;

          const aiResult = await generateWithAI(
            effectiveApiKey,
            systemPrompt,
            `다음 글을 읽고 자연스러운 댓글을 작성해주세요.\n\n` +
            `제목: ${targetPost.title}\n` +
            `카테고리: ${targetPost.category}\n` +
            `본문: ${(postContent?.content || '').slice(0, 300)}\n\n` +
            `규칙:\n` +
            `- 글 내용에 대한 구체적인 반응을 담을 것\n` +
            `- 50~100자 이내\n` +
            `- 이모지 사용 가능하지만 과하지 않게\n` +
            `- 실제 커뮤니티 댓글처럼 자연스럽게\n` +
            `- "좋은 글이네요" 같은 뻔한 말 금지`
          );

          if (aiResult) commentText = aiResult.trim();
        }

        if (!commentText) {
          // 카테고리별 템플릿 댓글 선택
          const categoryTemplates = TEMPLATE_COMMENTS_BY_CATEGORY[targetPost.category];
          const templateList = categoryTemplates && categoryTemplates.length > 0
            ? categoryTemplates
            : TEMPLATE_COMMENTS;
          commentText = pickRandom(templateList);
        }

        const { error: commentError } = await supabase
          .from("comments")
          .insert({ post_id: targetPost.id, user_id: persona.user_id, content: commentText });

        if (commentError) {
          results.push({ action: "comment", persona: persona.nickname, success: false, detail: `댓글 실패 → "${targetPost.title.slice(0, 15)}..."`, error: commentError.message });
        } else {
          // comment_count를 직접 +1 업데이트
          const { data: currentPost } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ comment_count: (currentPost?.comment_count ?? 0) + 1 }).eq("id", targetPost.id);

          await supabase.from("personas").update({ total_comments: (persona.total_comments ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
          results.push({ action: "comment", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 에 댓글 완료` });
        }

      } else if (action.type === "reply") {
        // ─── 대댓글 달기 ───
        const availablePosts = [...allPosts, ...newPostIds];
        if (availablePosts.length === 0) {
          results.push({ action: "reply", persona: "-", success: false, detail: "대댓글 달 글이 없음" });
          continue;
        }

        const persona = pickRandom(personas) as Persona;
        const targetPost = anakiPosts.length > 0 && Math.random() < 0.5
          ? pickRandom(anakiPosts)
          : pickRandom(availablePosts);

        // 해당 글의 기존 댓글 가져오기
        const { data: existingComments } = await supabase
          .from("comments")
          .select("id, content, user_id")
          .eq("post_id", targetPost.id)
          .is("parent_id", null)
          .limit(10);

        if (!existingComments || existingComments.length === 0) {
          // 댓글이 없으면 일반 댓글로 대체하지 않고 스킵
          results.push({ action: "reply", persona: persona.nickname, success: false, detail: "대댓글 달 댓글이 없음 → 스킵" });
          continue;
        }

        const parentComment = pickRandom(existingComments);

        let replyText = "";
        if (useAI) {
          const systemPrompt = persona.prompt ||
            `당신은 '${persona.nickname}'이라는 닉네임의 ${persona.industry} 전문가입니다. ` +
            `성격: ${persona.personality}. 자연스럽고 짧은 대댓글을 작성하세요.`;

          const aiResult = await generateWithAI(
            effectiveApiKey,
            systemPrompt,
            `다음 댓글에 대한 답글을 작성해주세요.\n\n` +
            `원글 제목: ${targetPost.title}\n` +
            `댓글: "${parentComment.content}"\n\n` +
            `규칙:\n` +
            `- 댓글 내용에 대한 구체적인 반응\n` +
            `- 30~80자 이내\n` +
            `- 동의, 반박, 추가 의견 등 다양하게\n` +
            `- 실제 대댓글처럼 자연스럽게`
          );
          if (aiResult) replyText = aiResult.trim();
        }

        if (!replyText) {
          // 템플릿 대댓글
          const TEMPLATE_REPLIES = [
            "맞아요, 저도 같은 생각이에요!",
            "오 이런 관점은 처음이네요 👀",
            "완전 공감합니다 ㅋㅋ",
            "좀 다른 의견인데, 저는 다르게 생각해요",
            "아 그렇군요! 배워갑니다",
            "이거 정말 핵심 포인트네요",
            "실제로 그렇더라고요!",
            "좋은 지적입니다!",
            "저도 경험해본 부분이에요.",
            "정확한 지적입니다 👍",
          ];
          replyText = pickRandom(TEMPLATE_REPLIES);
        }

        const { error: replyError } = await supabase
          .from("comments")
          .insert({ post_id: targetPost.id, user_id: persona.user_id, content: replyText, parent_id: parentComment.id });

        if (replyError) {
          results.push({ action: "reply", persona: persona.nickname, success: false, detail: `대댓글 실패`, error: replyError.message });
        } else {
          const { data: currentPost } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ comment_count: (currentPost?.comment_count ?? 0) + 1 }).eq("id", targetPost.id);
          await supabase.from("personas").update({ total_comments: (persona.total_comments ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
          results.push({ action: "reply", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 대댓글 완료` });
        }

      } else if (action.type === "upvote") {
        // ─── 추천(Upvote) ───
        const availablePosts = [...allPosts, ...newPostIds];
        if (availablePosts.length === 0) {
          results.push({ action: "upvote", persona: "-", success: false, detail: "추천할 글이 없음" });
          continue;
        }

        const persona = pickRandom(personas) as Persona;

        // 60% 확률로 아나키 글에 추천
        const targetPost =
          anakiPosts.length > 0 && Math.random() < 0.6
            ? pickRandom(anakiPosts)
            : pickRandom(availablePosts);

        // 중복 추천 방지
        const { data: existingLike } = await supabase
          .from("post_likes")
          .select("id")
          .eq("post_id", targetPost.id)
          .eq("user_id", persona.user_id)
          .maybeSingle();

        if (existingLike) {
          results.push({ action: "upvote", persona: persona.nickname, success: false, detail: `"${targetPost.title.slice(0, 15)}..." 이미 추천 → 스킵` });
          continue;
        }

        const { error: likeError } = await supabase
          .from("post_likes")
          .insert({ post_id: targetPost.id, user_id: persona.user_id });

        if (likeError) {
          results.push({ action: "upvote", persona: persona.nickname, success: false, detail: `추천 실패 → "${targetPost.title.slice(0, 15)}..."`, error: likeError.message });
        } else {
          // upvotes +1 (RPC 시도 → 실패 시 직접 업데이트)
          const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
          if (rpcError) {
            const { data: currentPost } = await supabase.from("posts").select("upvotes").eq("id", targetPost.id).single();
            await supabase.from("posts").update({ upvotes: (currentPost?.upvotes ?? 0) + 1 }).eq("id", targetPost.id);
          }

          await supabase.from("personas").update({ total_likes: (persona.total_likes ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
          results.push({ action: "upvote", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 추천 완료` });
        }
      }
    }

    // ─── 결과 요약 반환 ───
    const summary = {
      총액션: results.length,
      성공: results.filter((r) => r.success).length,
      실패: results.filter((r) => !r.success).length,
      계정생성: results.filter((r) => r.action === "setup" && r.success).length,
      글쓰기: results.filter((r) => r.action === "post" && r.success).length,
      댓글: results.filter((r) => r.action === "comment" && r.success).length,
      대댓글: results.filter((r) => r.action === "reply" && r.success).length,
      추천: results.filter((r) => r.action === "upvote" && r.success).length,
      AI사용: useAI,
    };

    return Response.json({ success: true, summary, results });
  } catch (error) {
    console.error("[test-interaction] 전체 에러:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "알 수 없는 에러가 발생했습니다." },
      { status: 500 }
    );
  }
}
