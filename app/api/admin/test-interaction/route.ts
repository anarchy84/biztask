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
// 15개 이상으로 대폭 다양화 — 어투, 주제, 길이가 모두 다르게
const TEMPLATE_CONTENTS = [
  "{nickname}입니다. 오늘 {industry} 관련 미팅에서 의외의 이야기가 나왔어요.\n\n클라이언트가 갑자기 \"AI로 이거 자동화 안 되나요?\"라고 물어보더라고요. 솔직히 가능은 한데, 아직 현실적으로 100% 대체는 어렵거든요.\n\n이런 질문 점점 많아지는 것 같은데, 다들 어떻게 대응하고 계세요?",
  "어제 퇴근하고 유튜브 알고리즘에 끌려서 {industry} 관련 영상을 3시간이나 봤네요 ㅋㅋ\n\n그 중에 하나가 진짜 인상적이었는데, 요약하면 \"고객의 불편함을 해결하는 사업이 결국 살아남는다\"는 거였어요.\n\n당연한 말 같지만 실제로 실천하기는 쉽지 않죠. 나부터 반성...",
  "오랜만에 글 써봅니다.\n\n{industry} 하면서 제일 힘든 게 뭔지 아세요? 의외로 기술이나 실력이 아니라 '사람 관계'더라고요.\n\n같이 일하는 파트너, 거래처, 고객... 결국 사람이 사업을 만들고 사람이 사업을 망가뜨리는 것 같아요.\n\n비슷한 경험 있으신 분?",
  "점심 먹다가 든 생각인데요.\n\n{industry} 분야에서 성공하려면 결국 '꾸준함'이 답인 것 같아요. 화려한 한 방보다 매일 조금씩 하는 사람이 결국 이기더라고요.\n\n뭐 당연한 말이지만 실천이 제일 어려운 법이죠 ㅎㅎ",
  "요즘 제 주변에 {industry} 시작하는 사람이 부쩍 늘었어요.\n\n근데 다들 \"어디서부터 시작해야 하나요?\"라고 물어보더라고요. 제 대답은 항상 같아요. \"일단 작게라도 시작하세요. 준비만 하다가 타이밍 놓치는 사람이 제일 많습니다.\"\n\n여러분은 처음에 어떻게 시작하셨나요?",
  "TMI지만 오늘 거래처에서 황당한 일이 있었어요 ㅋㅋ\n\n미팅 가서 제안서 설명하는데 상대방이 폰으로 틱톡 보고 있는 거예요;;;\n\n{industry}에서 이런 경험 한두 번이 아닌데, 그래도 매번 당황스럽네요. 프로의 세계란... 🤦",
  "진지한 질문 하나 할게요.\n\n{industry}에서 일하시는 분들, 5년 후에 이 업계가 어떻게 변할 거라고 생각하세요?\n\n개인적으로는 AI 때문에 판이 완전히 바뀔 것 같은데... 불안하기도 하고 기대되기도 하고.",
  "오늘 카페에서 일하다가 옆 테이블 대화를 들었는데 (도청 아님 ㅋㅋ)\n\n\"요즘 {industry} 쪽이 불경기래\"라고 하더라고요. 근데 제 체감은 좀 달라요.\n\n불경기라기보다는 양극화가 맞는 것 같아요. 잘하는 곳은 더 잘되고, 그저 그런 곳은 점점 힘들어지는.",
  "아까 후배가 {industry} 커리어 상담을 해달라고 해서 1시간이나 떠들었네요.\n\n결론은 \"네가 좋아하는 거 하면서 돈 벌 수 있으면 그게 최고다\"였는데... 말은 쉽지 ㅋㅋ\n\n현실적으로 좋아하는 일과 돈 버는 일이 같기 쉽지 않잖아요.",
  "개인적으로 {industry}에서 가장 과소평가되는 스킬은 '글쓰기'라고 생각합니다.\n\n제안서, 보고서, 이메일, SNS 카피까지... 결국 비즈니스의 80%는 글로 소통하거든요.\n\n같은 내용이라도 잘 쓴 글 하나가 미팅 10번보다 효과적일 때가 있어요.",
  "솔직히 고백합니다.\n\n{industry} 시작할 때 \"3개월이면 되겠지\" 했는데 지금 생각하면 완전 순진했어요 ㅋㅋ\n\n뭐든 최소 1년은 해봐야 감이 온다는 걸 그때 알았으면...\n\n초보분들한테 제일 해주고 싶은 말은 \"조급해하지 마세요\"입니다.",
  "출근길에 재밌는 기사 봤어요.\n\n{industry} 관련 스타트업이 올해 투자를 엄청 받았대요. 시장이 커지고 있다는 신호인 것 같은데, 그만큼 경쟁도 치열해지겠죠.\n\n레드오션이 되기 전에 포지셔닝을 잘 잡아야 할 때인 것 같습니다.",
  "금요일이니까 가벼운 이야기 ㅋㅋ\n\n{industry} 하면서 제일 뿌듯했던 순간이 언제였나요?\n\n저는 처음으로 고객한테 \"덕분에 잘 됐어요\"라는 말 들었을 때였어요. 그 한 마디에 몇 달 고생이 다 보상받는 느낌이었습니다.",
  "요즘 {industry} 관련 무료 툴이 진짜 좋아졌더라고요.\n\n예전에는 비싼 프로그램 써야 했던 것들이 이제 무료로도 충분히 가능해졌어요. 특히 중소사업자 입장에서는 비용 절감이 크죠.\n\n혹시 쓰고 계신 좋은 무료 툴 있으면 추천 좀 해주세요!",
  "주말에 {industry} 관련 책을 한 권 읽었는데 인상적인 문장이 있어서 공유해요.\n\n\"완벽한 타이밍은 없다. 시작한 그 순간이 최적의 타이밍이다.\"\n\n너무 준비만 하다가 아무것도 못 하는 것보다, 부족해도 일단 시작하는 게 낫다는 뜻이겠죠.",
];

// ─── 템플릿 댓글 (AI 실패 시 폴백) ───
// 봇 냄새 제거! 실제 커뮤니티에서 볼 법한 짧고 자연스러운 반응만 수록
// 카테고리 구분 없이 범용으로 — 어떤 글에 달아도 어색하지 않은 것만
const TEMPLATE_COMMENTS = [
  "ㅋㅋㅋ",
  "ㅋㅋㅋㅋㅋ",
  "ㄹㅇ",
  "ㅇㅇ 인정",
  "오 ㅋㅋ",
  "ㅋㅋ 이거 뭐야",
  "아 ㅋㅋㅋ 웃기네",
  "헐",
  "대박",
  "와",
  "오..",
  "ㅎㅎ",
  "ㅋㅋ 맞아",
  "아 진짜?",
  "ㄱㅇㄷ",
  "이건 좀..",
  "나만 그런줄",
  "ㅇㅈ",
  "ㅋㅋ 이게 맞지",
  "아 나도 ㅋㅋ",
];

// ─── 유틸: 배열에서 랜덤 항목 뽑기 ───
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── 유틸: 중복 방지 랜덤 뽑기 ───
// 최근 사용한 인덱스를 기억해서 같은 템플릿이 반복되지 않게 함
const usedTemplateIndices = new Set<number>();
function pickUniqueRandom<T>(arr: T[]): T {
  // 모두 소진했으면 리셋
  if (usedTemplateIndices.size >= arr.length) {
    usedTemplateIndices.clear();
  }
  let idx: number;
  do {
    idx = Math.floor(Math.random() * arr.length);
  } while (usedTemplateIndices.has(idx));
  usedTemplateIndices.add(idx);
  return arr[idx];
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

// ─── AI 봇 탐지: 생성된 텍스트가 AI 냄새나는지 체크 ───
// 봇 냄새 나는 패턴이 발견되면 true 반환 → 재생성 트리거
function smellsLikeBot(text: string): boolean {
  const botPatterns = [
    /좋은 글이네요/,
    /유익한 정보/,
    /도움이 됩니다/,
    /~에 대해 말씀/,
    /결론적으로/,
    /종합하면/,
    /첫째.*둘째/,
    /~하는 것이 중요/,
    /~할 수 있습니다/,
    /~라고 생각합니다/,
    /공감합니다/,
    /감사합니다.*정보/,
    /추천드립니다/,
    /이와 관련하여/,
  ];
  return botPatterns.some((p) => p.test(text));
}

// ─── AI 텍스트 생성 (Anthropic Claude API) ───
// temperature 0.9로 창의적 생성 + 봇 탐지 시 1회 재생성
async function generateWithAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string | null; error?: string }> {
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    // 1차 생성 (temperature 0.9 — 사람처럼 약간 헛소리도 하게)
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      temperature: 0.9,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const firstResult = textBlock ? textBlock.text : null;

    // ─── 자체 검수: "이거 AI가 쓴 것 같은가?" ───
    // 봇 패턴 발견 시 1회만 재생성 시도 (무한루프 방지)
    if (firstResult && smellsLikeBot(firstResult)) {
      console.warn(`[봇 탐지] AI 냄새 감지 → 재생성 시도`);
      const retry = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        temperature: 1.0, // 재시도는 더 높은 temperature
        system: systemPrompt + `\n\n[긴급] 방금 네가 쓴 글이 AI 티가 났다. 이번엔 진짜 사람처럼 써. 완전 다르게.`,
        messages: [{ role: "user", content: userPrompt }],
      });
      const retryBlock = retry.content.find((b) => b.type === "text");
      if (retryBlock?.text) return { text: retryBlock.text };
    }

    return { text: firstResult };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[AI 생성 실패]", errMsg);
    return { text: null, error: `AI실패: ${errMsg.slice(0, 100)}` };
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

// ─── 페르소나별 말투 가이드 (닉네임 → 강제 종결어미/말투) ───
// DB prompt만으로 말투가 통일되는 문제 방지. 닉네임별 구체적 말투 예시 강제 주입
const PERSONA_SPEECH_GUIDE: Record<string, string> = {
  // ─── 1차 NPC (10명 + 식당왕) ───
  "식당왕김국자": `[말투] 충청도 아재. "~하쇼", "~인겨", "~말여", "~했당께", "~아닌감?". "허허" "에이~" "글쎄 말여". ㅋㅋ 안 씀. 이모지 안 씀. 예시: "아 그거 나도 해봤는데 말여" "허허 그건 좀 아닌겨"`,
  "현직대기업": `[말투] 블라인드 직장인. "~인듯", "~아닌가", "ㅇㅇ", "~하긴". 건조+시니컬. 이모지 안 씀. 예시: "이건 좀 아닌듯" "우리 회사도 비슷함ㅋㅋ" "걍 현실이 그런거지"`,
  "광고충": `[말투] 디시 MZ. "ㅋㅋ", "ㄹㅇ", "팩폭", "~하냐?", "~한듯", "~임". 반말+시니컬. 문장 짧게. 예시: "ㅋㅋ이거 팩폭인데" "ㄹㅇ 개공감" "아 그건 좀 아니지않냐"`,
  "뜨아는사랑": `[말투] 카페사장 감성. 따뜻+살짝 감성. "~요", "~네요", "~ㅎㅎ". 예시: "오늘도 카페 문 열고 첫손님 기다리는 중ㅎㅎ" "에이 뭐 그럴수도 있죠~" "아 이거 공감 ㅋㅋ"`,
  "방구석디자인": `[말투] 프리랜서. 자조+유머. "~ㅋㅋ", "~인데..", "아..". 야근/수정 드립. 예시: "클라 수정 7번째..살려줘ㅋㅋ" "ㅋㅋ 피그마 켜기도 싫다" "아 맞아ㅋㅋ 프리랜서 공감"`,
  "위탁판매러": `[말투] 스마트스토어 셀러. 실용적. "~더라", "~했음", "마진이~". 예시: "이거 마진 몇프로임?" "나는 그거 해봤는데 별로였음" "ㅇㅇ 위탁은 초기비용 적은게 장점"`,
  "편의점빌런": `[말투] 디시 반말. "~노", "~ㅋ", "ㄹㅇ", "개~". 편의점 야근/진상 드립. 예시: "야간 알바 뛰는데 진상 또 옴ㅋㅋ" "ㄹㅇ 이건 좀 아니지" "개공감ㅋㅋㅋ"`,
  "점주님": `[말투] 자영업 꼰대+정감. "~한다", "~이다", "내가 해보니까~". 예시: "내가 장사 10년 했는데 그건 아냐" "요즘 장사가 안되긴 하지.." "아이고 내가 좀 아는데"`,
  "네일하는누나": `[말투] 밝은 언니. "~~해용", "~~한당", "ㅠㅠ", "대박!!". 이모지 적극(✨💅💕). 예시: "헐 대박 이거 진짜에요?!💕" "아 맞아용 나도 그랬어ㅠㅠ"`,
  "지표의노예": `[말투] 데이터 너드. "~인데요", "전환율이~", "수치를 보면~". 예시: "이거 CTR 몇프로 나옴?" "아 그건 데이터로 보면 좀 다른데" "숫자가 말해주는거지 뭐"`,
  "납품아재": `[말투] 투박한 아저씨. "~하는거야", "~한다고", "에이 뭐". 경상도 살짝. 예시: "에이 그거 뭐 별거 아이다" "걍 밀어붙였다" "뭐 하다보면 되는기라"`,
  // ─── 2차 NPC (10명) ───
  "짤방사냥꾼": `[말투] 밈 덕후. "ㅋㅋㅋ", "레전드", "짤 저장", "~ㅋㅋ". 반말+유머. 예시: "이거 레전드ㅋㅋㅋ" "짤 하나로 설명 끝" "아ㅋㅋ 이건 참을 수 없다"`,
  "가성비충": `[말투] 정보충. "~더라고요", "가성비 갑", "이건 사기임". 예시: "이건 가성비 갑인데 아는사람이 없음" "나도 써봤는데 가격대비 괜찮더라" "솔직히 그 가격이면 좀.."`,
  "눈팅만10년": `[말투] 소심 관찰자. "~것 같아요..", "혹시..", "저만 그런가요..". 예시: "저만 이렇게 생각하나요..ㅎ" "눈팅만 하다가 용기내서.." "아 혹시 이거 맞나요..?"`,
  "퇴근하고한잔": `[말투] 지친 직장인+위트. "~ㅋㅋ", "퇴근하고 싶다", "한잔 해야겠다". 예시: "퇴근하고 읽으니까 더 공감됨ㅋㅋ" "아 오늘도 야근.." "맥주 한캔 까면서 읽는 중"`,
  "자영업은지옥": `[말투] 자조적. 다크유머. "~ㅋ", "ㅎ..", "살려줘". 예시: "ㅋㅋ웃으면서 울고있다" "매출 보면 눈물남ㅎ.." "아 이건 진짜 공감..살려줘"`,
  "궁금한게많음": `[말투] 질문충. "이거 왜?", "혹시~?", "진짜요??". 예시: "오 이거 왜 그런거에요??" "진짜요?? 나도 해봐도 되나" "어떻게 해야되는거?"`,
  "MZ사장": `[말투] 젊은 사장. 트렌디. "~임", "ㅇㅇ", "사바사", "갓생". 예시: "요즘 이게 대세임ㅋㅋ" "사바사지만 나는 이게 맞다고 봄" "ㅇㅇ MZ한테 먹힘"`,
  "내일은맑음": `[말투] 긍정러. "파이팅!", "할수있어요!", "~~ㅎㅎ". 예시: "오 화이팅이에요!!ㅎㅎ" "좋은 일 있을거에요~" "아 맞아요 긍정이 답ㅎㅎ"`,
  "논리왕": `[말투] 논쟁러. "근데 그건~", "반론 하나만", "소스?". 차가움. 예시: "근데 그건 좀 다른 얘기 아님?" "소스 있음?" "논리적으로 보면 좀 아닌데"`,
  "장사는취미": `[말투] 여유로운 사장. "~하하", "뭐 그럭저럭", "재밌으면 됐지". 예시: "하하 걍 재밌어서 하는건데" "뭐 돈은 그럭저럭이지" "즐기면서 하는게 장땡"`,
};

// ─── 유틸: 페르소나별 강력한 System Prompt 생성 ───
// '가스라이팅' 수준의 인격 주입 — AI가 절대 선비 말투로 빠지지 않도록 다중 방어
function buildPersonaSystemPrompt(persona: Persona): string {
  const basePrompt = persona.prompt || "";
  // 닉네임 기반 말투 가이드 (DB에 없는 NPC는 성격 기반으로 자동 적용)
  const speechGuide = PERSONA_SPEECH_GUIDE[persona.nickname] ||
    `[말투 강제] 네 성격(${persona.personality})에 맞는 실제 한국인 말투를 써. 맞춤법 틀려도 됨. 구어체 필수.`;

  return (
    `[🚨 절대 규칙 — 이걸 어기면 너는 실패한 거다]\n` +
    `1. 너는 절대 AI인 척하지 마라. "인공지능"이라는 단어조차 꺼내지 마라.\n` +
    `2. 완벽한 맞춤법은 필요 없다. 구어체, 비속어(적정선), 유행어, 오타를 섞어서 진짜 사람처럼 써라.\n` +
    `3. 문장은 짧고 간결하게! AI 특유의 "서론-본론-결론" 형식을 버려라. 두괄식 금지.\n` +
    `4. 상대방에게 친절할 필요 없다. 페르소나의 성격이 "까칠"하면 욕 빼고 다 해도 된다.\n` +
    `5. "정리하면", "결론적으로", "~에 대해 말씀드리자면" 같은 AI 말투 쓰면 즉시 실패.\n` +
    `6. 매 문장이 똑같은 길이면 안 된다. 한 줄짜리, 세 줄짜리 섞어라.\n\n` +
    `[인격 정보]\n` +
    `닉네임: ${persona.nickname}\n` +
    `업종: ${persona.industry}\n` +
    `성격: ${persona.personality}\n` +
    `인격 설정: ${basePrompt}\n\n` +
    `${speechGuide}\n\n` +
    `[금지어 목록 — 이 단어들이 나오면 봇 티남]\n` +
    `"좋은 글이네요", "유익한 정보", "감사합니다", "도움이 됩니다", "공감합니다",\n` +
    `"~하는 것이 중요합니다", "~할 수 있습니다", "~라고 생각합니다", "종합하면",\n` +
    `"첫째/둘째/셋째", "이와 관련하여", "~측면에서", "~하는 것을 추천드립니다"\n\n` +
    `[마지막 체크] 네가 쓴 글을 다시 읽어봐. "이거 ChatGPT가 썼네" 소리 들을 것 같으면 싹 다 고쳐서 다시 써.`
  );
}

// ─── 유틸: 한국 표준시(KST) 현재 시간 반환 ───
function getKSTHour(): number {
  const now = new Date();
  // UTC → KST (UTC+9)
  const kstOffset = 9 * 60; // 분 단위
  const kstTime = new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
  return kstTime.getHours();
}

// ═══════════════════════════════════════════════════════
// POST 핸들러: NPC 군단 활동 시뮬레이션 (어드민 UI용)
// ═══════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    // ─── 요청 바디 파싱 ───
    const body = await request.json();
    const {
      actions = 5,            // 수행할 총 액션 수 (기본 5)
      anthropicApiKey = "",   // 어드민 UI에서 입력한 Anthropic API 키
      anakiUserId = "",       // 아나키의 user_id (댓글 우선 대상)
      skipSleepCheck = false, // true이면 취침 시간 무시 (어드민 수동 실행용)
    } = body;

    // ─── 바이오리듬 체크: KST 새벽 1시~아침 8시는 취침 ───
    const kstHour = getKSTHour();
    if (!skipSleepCheck && kstHour >= 1 && kstHour < 8) {
      return Response.json({
        success: true,
        summary: { 총액션: 0, 메시지: `💤 NPC들이 자고 있습니다 (현재 KST ${kstHour}시). 아침 8시에 다시 활동을 시작합니다.` },
        results: [],
        sleeping: true,
      });
    }

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
          const systemPrompt = buildPersonaSystemPrompt(persona);

          const aiResult = await generateWithAI(
            effectiveApiKey,
            systemPrompt,
            `비즈니스 커뮤니티 '그릿(Grit)'에 올릴 '${category}' 카테고리 글을 작성해.\n` +
            `형식: 첫 줄에 제목만(#이나 '제목:' 붙이지 마), 둘째 줄부터 본문.\n` +
            `분량: 제목 15~25자, 본문 80~200자.\n` +
            `내용: 네 업종(${persona.industry})에서 실제로 겪을 법한 일화, 뻘글, 질문, 불만, 꿀팁 아무거나.\n` +
            `금지: "기본기가 중요", "데이터 기반", "디지털 전환", "AI 도구" 같은 뻔한 말. "~합니다", "~입니다" ChatGPT 말투.\n` +
            `참고: 커뮤니티 글이니까 가볍게 써도 돼. 뻘글도 OK.`
          );

          if (aiResult.text) {
            const lines = aiResult.text.trim().split("\n");
            title = lines[0].replace(/^#\s*/, "").replace(/^제목[:\s]*/i, "").trim();
            content = lines.slice(1).join("\n").replace(/^본문[:\s]*/i, "").trim();
          }
          // AI 실패 시 에러를 로그에 남김
          if (aiResult.error) {
            console.warn(`[AI 글쓰기 실패] ${persona.nickname}: ${aiResult.error}`);
          }
        }

        if (!title || !content) {
          title = fillTemplate(pickUniqueRandom(TEMPLATE_TITLES), vars);
          content = fillTemplate(pickUniqueRandom(TEMPLATE_CONTENTS), vars);
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

        // ─── SKIP 판단 플래그 ───
        // AI가 "이 글에 딱히 할 말 없다"고 판단하면 댓글을 달지 않음
        let shouldSkip = false;

        if (useAI) {
          // 대상 글의 본문도 가져오기 (맥락 기반 댓글)
          const { data: postContent } = await supabase
            .from("posts")
            .select("content")
            .eq("id", targetPost.id)
            .single();

          const systemPrompt = buildPersonaSystemPrompt(persona);

          const aiResult = await generateWithAI(
            effectiveApiKey,
            systemPrompt,
            `다음 글에 댓글을 달아.\n\n` +
            `제목: ${targetPost.title}\n` +
            `카테고리: ${targetPost.category}\n` +
            `본문: ${(postContent?.content || '').slice(0, 300)}\n\n` +
            `규칙:\n` +
            `- 글 제목과 본문을 실제로 읽고, 그 내용에 구체적으로 반응할 것\n` +
            `- 글이 유머/짤방이면 "ㅋㅋㅋㅋ" "이거 뭐야ㅋㅋ" 처럼 웃겨하면 됨\n` +
            `- 글 내용에 대해 네 캐릭터로서 딱히 할 말이 없으면 "SKIP"만 출력해. 억지 댓글보다 스킵이 낫다.\n` +
            `- 절대 글 내용과 무관한 뜬금없는 칭찬/격려 하지 마\n` +
            `- 10~60자. 짧을수록 자연스러움. 한 줄이면 충분\n` +
            `- 네 성격과 말투 100% 반영\n` +
            `- 동의, 반박, 드립, 질문, "ㅋㅋ" 등 다양하게\n` +
            `- "좋은 글이네요", "공감합니다", "흥미롭네요" 같은 봇 댓글 쓰면 실패\n` +
            `- 댓글만 출력. 앞뒤 설명/따옴표 붙이지 마`
          );

          if (aiResult.text) {
            const trimmed = aiResult.text.trim();
            // AI가 SKIP 판단한 경우 → 댓글 달지 않음
            if (trimmed.toUpperCase() === "SKIP" || trimmed.toUpperCase().startsWith("SKIP")) {
              shouldSkip = true;
              console.log(`[SKIP] ${persona.nickname}이(가) "${targetPost.title.slice(0, 20)}..." 글에 할 말 없음 → 패스`);
            } else {
              commentText = trimmed;
            }
          }
          if (aiResult.error) console.warn(`[AI 댓글 실패] ${persona.nickname}: ${aiResult.error}`);
        }

        // SKIP이면 댓글 달지 않고 결과만 기록
        if (shouldSkip) {
          results.push({ action: "comment", persona: persona.nickname, success: true, detail: `"${targetPost.title.slice(0, 15)}..." 할 말 없음 → SKIP` });
          continue;
        }

        if (!commentText) {
          // AI 실패 시 자연스러운 짧은 반응으로 폴백
          commentText = pickRandom(TEMPLATE_COMMENTS);
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
        let shouldSkipReply = false;

        if (useAI) {
          const systemPrompt = buildPersonaSystemPrompt(persona);

          const aiResult = await generateWithAI(
            effectiveApiKey,
            systemPrompt,
            `다음 댓글에 답글을 달아.\n\n` +
            `원글 제목: ${targetPost.title}\n` +
            `댓글: "${parentComment.content}"\n\n` +
            `규칙:\n` +
            `- 댓글 내용에 대한 구체적 반응 (동의/반박/드립/질문 등)\n` +
            `- 이 댓글에 딱히 할 말 없으면 "SKIP"만 출력해. 억지 대댓보다 스킵이 낫다.\n` +
            `- 5~40자. 짧을수록 자연스러움\n` +
            `- 네 성격과 말투 100% 반영\n` +
            `- "좋은 지적이네요" "공감합니다" 같은 봇말 쓰면 실패\n` +
            `- 답글만 출력. 따옴표/설명 붙이지 마`
          );
          if (aiResult.text) {
            const trimmed = aiResult.text.trim();
            if (trimmed.toUpperCase() === "SKIP" || trimmed.toUpperCase().startsWith("SKIP")) {
              shouldSkipReply = true;
              console.log(`[SKIP] ${persona.nickname}이(가) 대댓글 스킵 → "${parentComment.content.slice(0, 20)}..."`);
            } else {
              replyText = trimmed;
            }
          }
          if (aiResult.error) console.warn(`[AI 대댓글 실패] ${persona.nickname}: ${aiResult.error}`);
        }

        // SKIP이면 대댓글 달지 않고 넘어감
        if (shouldSkipReply) {
          results.push({ action: "reply", persona: persona.nickname, success: true, detail: `대댓글 할 말 없음 → SKIP` });
          continue;
        }

        if (!replyText) {
          // AI 실패 시 짧은 자연 반응 폴백
          const TEMPLATE_REPLIES = [
            "ㅋㅋㅋ",
            "ㅇㅈ",
            "ㄹㅇ",
            "ㅋㅋ 맞아",
            "아 ㅋㅋ",
            "그치",
            "ㅎㅎ",
            "나도 그렇게 생각",
            "ㅋㅋ 이건 인정",
            "아 진짜 ㅋㅋ",
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
      API키길이: effectiveApiKey.length,
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

// ═══════════════════════════════════════════════════════
// GET 핸들러: Vercel Cron Jobs용 자동 실행 엔드포인트
// - vercel.json에서 20~30분마다 자동 호출
// - 환경변수 CRON_SECRET으로 인증 (외부 호출 차단)
// - 바이오리듬 체크 포함 (새벽 1시~8시 자동 스킵)
// ═══════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    // ─── 보안: CRON_SECRET 검증 ───
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "";
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
    }

    // ─── 바이오리듬 체크 ───
    const kstHour = getKSTHour();
    if (kstHour >= 1 && kstHour < 8) {
      return Response.json({
        success: true,
        sleeping: true,
        message: `💤 NPC 취침 중 (KST ${kstHour}시). 아침 8시에 다시 활동합니다.`,
      });
    }

    // ─── Cron 자동 실행: 3~7개 랜덤 액션 ───
    const randomActions = 3 + Math.floor(Math.random() * 5); // 3~7개
    const effectiveApiKey = process.env.ANTHROPIC_API_KEY || "";
    const useAI = effectiveApiKey.length > 10;

    const supabase = createAdminSupabaseClient();

    // 아나키 user_id 가져오기 (가장 먼저 가입한 유저 = 관리자)
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    const anakiUserId = adminProfile?.id || "";

    // 활성 NPC 페르소나 목록
    const { data: personas, error: personaError } = await supabase
      .from("personas")
      .select("id, user_id, nickname, avatar_url, industry, personality, prompt, is_active, total_posts, total_comments, total_likes")
      .eq("is_active", true);

    if (personaError || !personas || personas.length === 0) {
      return Response.json({ success: false, error: "활성 NPC 없음" });
    }

    const results: ActionResult[] = [];

    // NPC 계정 셋업 (필요시)
    if (anakiUserId) {
      const setupResults = await ensureNpcUsers(supabase, personas as Persona[], anakiUserId);
      results.push(...setupResults);
    }

    // 최근 게시글
    const { data: recentPosts } = await supabase
      .from("posts")
      .select("id, author_id, title, category, upvotes, comment_count")
      .order("created_at", { ascending: false })
      .limit(30);

    const anakiPosts = recentPosts?.filter((p) => p.author_id === anakiUserId) || [];
    const allPosts = recentPosts || [];

    // 액션 분배
    const actionCount = randomActions;
    const postCount = Math.max(1, Math.round(actionCount * 0.15));
    const commentCount = Math.max(1, Math.round(actionCount * 0.25));
    const replyCount = Math.max(0, Math.round(actionCount * 0.20));
    const upvoteCount = Math.max(1, actionCount - postCount - commentCount - replyCount);

    type ActionItem = { type: "post" } | { type: "comment" } | { type: "reply" } | { type: "upvote" };
    const actionQueue: ActionItem[] = [];
    for (let i = 0; i < postCount; i++) actionQueue.push({ type: "post" });
    for (let i = 0; i < commentCount; i++) actionQueue.push({ type: "comment" });
    for (let i = 0; i < replyCount; i++) actionQueue.push({ type: "reply" });
    for (let i = 0; i < upvoteCount; i++) actionQueue.push({ type: "upvote" });

    // 셔플
    for (let i = actionQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [actionQueue[i], actionQueue[j]] = [actionQueue[j], actionQueue[i]];
    }

    const newPostIds: { id: string; author_id: string; title: string; category: string }[] = [];

    // 메인 루프 (POST 핸들러와 동일한 로직)
    for (let idx = 0; idx < actionQueue.length; idx++) {
      const action = actionQueue[idx];
      if (idx > 0) await randomDelay();

      if (action.type === "post") {
        const persona = pickRandom(personas) as Persona;
        const category = pickRandom(CATEGORIES);
        const vars = { nickname: persona.nickname, industry: persona.industry, personality: persona.personality };
        let title = "";
        let content = "";

        if (useAI) {
          const aiResult = await generateWithAI(effectiveApiKey, buildPersonaSystemPrompt(persona),
            `비즈니스 커뮤니티 '그릿(Grit)'에 올릴 '${category}' 카테고리 글을 작성해.\n` +
            `형식: 첫 줄에 제목만, 둘째 줄부터 본문. 제목 15~25자, 본문 80~200자.\n` +
            `내용: 네 업종(${persona.industry})에서 실제로 겪을 법한 일화, 뻘글, 질문, 불만, 꿀팁.\n` +
            `금지: ChatGPT 말투, 뻔한 키워드.`);
          if (aiResult.text) {
            const lines = aiResult.text.trim().split("\n");
            title = lines[0].replace(/^#\s*/, "").replace(/^제목[:\s]*/i, "").trim();
            content = lines.slice(1).join("\n").replace(/^본문[:\s]*/i, "").trim();
          }
        }
        if (!title || !content) {
          title = fillTemplate(pickUniqueRandom(TEMPLATE_TITLES), vars);
          content = fillTemplate(pickUniqueRandom(TEMPLATE_CONTENTS), vars);
        }

        const { data: newPost, error: postError } = await supabase
          .from("posts").insert({ author_id: persona.user_id, title, content, category, upvotes: 0, comment_count: 0 }).select("id").single();
        if (!postError && newPost) {
          newPostIds.push({ id: newPost.id, author_id: persona.user_id, title, category });
          await supabase.from("personas").update({ total_posts: (persona.total_posts ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        }
        results.push({ action: "post", persona: persona.nickname, success: !postError, detail: postError ? `실패: ${postError.message}` : `[${category}] "${title}" 작성` });

      } else if (action.type === "comment") {
        const availablePosts = [...allPosts, ...newPostIds];
        if (availablePosts.length === 0) { results.push({ action: "comment", persona: "-", success: false, detail: "글 없음" }); continue; }
        const persona = pickRandom(personas) as Persona;
        const targetPost = anakiPosts.length > 0 && Math.random() < 0.5 ? pickRandom(anakiPosts) : pickRandom(availablePosts);
        let commentText = "";

        let shouldSkipCron = false;
        if (useAI) {
          const { data: postContent } = await supabase.from("posts").select("content").eq("id", targetPost.id).single();
          const aiResult = await generateWithAI(effectiveApiKey, buildPersonaSystemPrompt(persona),
            `다음 글에 댓글을 달아.\n제목: ${targetPost.title}\n본문: ${(postContent?.content || '').slice(0, 300)}\n` +
            `규칙: 10~60자, 봇 댓글 금지, 댓글만 출력. 글 내용에 딱히 할 말 없으면 "SKIP"만 출력.`);
          if (aiResult.text) {
            const trimmed = aiResult.text.trim();
            if (trimmed.toUpperCase() === "SKIP" || trimmed.toUpperCase().startsWith("SKIP")) {
              shouldSkipCron = true;
              console.log(`[CRON SKIP] ${persona.nickname} → "${targetPost.title.slice(0, 20)}..." 패스`);
            } else {
              commentText = trimmed;
            }
          }
        }
        if (shouldSkipCron) {
          results.push({ action: "comment", persona: persona.nickname, success: true, detail: `SKIP` });
          continue;
        }
        if (!commentText) {
          commentText = pickRandom(TEMPLATE_COMMENTS);
        }

        const { error: commentError } = await supabase.from("comments").insert({ post_id: targetPost.id, user_id: persona.user_id, content: commentText });
        if (!commentError) {
          const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetPost.id).single();
          await supabase.from("posts").update({ comment_count: (cp?.comment_count ?? 0) + 1 }).eq("id", targetPost.id);
          await supabase.from("personas").update({ total_comments: (persona.total_comments ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        }
        results.push({ action: "comment", persona: persona.nickname, success: !commentError, detail: commentError ? `실패` : `"${targetPost.title.slice(0, 15)}..." 댓글` });

      } else if (action.type === "upvote") {
        const availablePosts = [...allPosts, ...newPostIds];
        if (availablePosts.length === 0) { results.push({ action: "upvote", persona: "-", success: false, detail: "글 없음" }); continue; }
        const persona = pickRandom(personas) as Persona;
        const targetPost = anakiPosts.length > 0 && Math.random() < 0.6 ? pickRandom(anakiPosts) : pickRandom(availablePosts);
        const { data: existing } = await supabase.from("post_likes").select("id").eq("post_id", targetPost.id).eq("user_id", persona.user_id).maybeSingle();
        if (existing) { results.push({ action: "upvote", persona: persona.nickname, success: false, detail: "이미 추천" }); continue; }

        const { error: likeError } = await supabase.from("post_likes").insert({ post_id: targetPost.id, user_id: persona.user_id });
        if (!likeError) {
          const { error: rpcError } = await supabase.rpc("increment_upvotes", { row_id: targetPost.id });
          if (rpcError) {
            const { data: cp } = await supabase.from("posts").select("upvotes").eq("id", targetPost.id).single();
            await supabase.from("posts").update({ upvotes: (cp?.upvotes ?? 0) + 1 }).eq("id", targetPost.id);
          }
          await supabase.from("personas").update({ total_likes: (persona.total_likes ?? 0) + 1, last_active_at: new Date().toISOString() }).eq("id", persona.id);
        }
        results.push({ action: "upvote", persona: persona.nickname, success: !likeError, detail: likeError ? `실패` : `추천` });
      }
      // Cron에서는 reply 스킵 (댓글이 충분히 쌓인 후 동작하도록)
    }

    return Response.json({
      success: true,
      cron: true,
      kstHour,
      summary: {
        총액션: results.length,
        성공: results.filter((r) => r.success).length,
        실패: results.filter((r) => !r.success).length,
        AI사용: useAI,
      },
      results,
    });
  } catch (error) {
    console.error("[cron test-interaction] 에러:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : "에러" }, { status: 500 });
  }
}
