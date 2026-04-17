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
import { CATEGORY_LABELS, ACTIVE_COMMUNITIES, pickNpcCommunityTarget } from "@/lib/constants";

// ─── 타입 정의 ───
// persona_config: 어드민이 실시간 수정하는 동적 페르소나 설정 (JSONB)
interface PersonaConfig {
  group?: string;         // "자영업/사업자" | "테크/인사이트" | "MZ/커뮤니티" | "질문빌런/뉴비"
  background?: string;    // 캐릭터 배경 스토리
  speech_style?: string;  // 말투 강제 규칙
  affinity?: number;      // 0~100, 아나키(KOL) 우호도
  keywords?: string[];    // 관심 키워드 배열
}

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
  // 🌍 어드민 관리형 페르소나 설정 (DB에서 실시간 fetch)
  persona_config?: PersonaConfig;
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

// ─── 상수 정의 (전역 카테고리 6개 기준) ───
// CATEGORY_LABELS: ["자유", "질문", "사업", "마케팅", "부업", "유머"]
const CATEGORIES = CATEGORY_LABELS;

// 카테고리 → 업종 매핑 (관심도 가산점용)
// NPC의 industry가 해당 카테고리의 매핑 배열에 포함되면 관심도 가산점
const CATEGORY_INDUSTRY_MAP: Record<string, string[]> = {
  "마케팅": ["마케팅", "디자인", "IT/개발", "컨설팅/분석"],
  "사업": ["요식업", "쇼핑몰", "프리랜서", "제조업", "자영업/요식업", "다점포/부업", "예비창업"],
  "질문": ["마케팅", "IT/개발", "디자인", "컨설팅/분석", "요식업", "쇼핑몰"],
  "부업": ["다점포/부업", "유통/쇼핑", "프리랜서", "쇼핑몰"],
  "유머": [],   // 유머 카테고리는 매핑 보너스 없음 (누구나 가능)
  "자유": [],   // 자유 카테고리는 매핑 보너스 없음 (누구나 가능)
};

// ※ 템플릿 댓글 완전 폐지 (2026-03-31)
// 모든 댓글은 AI가 글 내용을 읽고 생성함
// 원본 커뮤니티 댓글(source_comments)을 RAG로 참고하여 분위기 흡수

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
  // ─── AI/기술 특화 NPC 3차 기동부대 (긱뉴스 생태계) ───
  "헤비업로더": `[말투 강제] 긱뉴스 펌글러. 가볍고 캐주얼. 종결어미: "~임", "~더라", "아는 사람?". 핵심만 간결히 요약. 전문가 코스프레 금지.`,
  "인사이트호소인": `[말투 강제] 도도한 분석가. 약간 오만하지만 논리적. 종결어미: "~거든", "내가 보기엔~", "사실 이건~". 딥다이브 분석. 근거 없는 주장 금지.`,
  "프로불편러": `[말투 강제] 시니컬 회의론자. 무조건 딴지. 종결어미: "~인데 ㅋ", "그래서 뭐?", "설레발 ㄴㄴ". AI 칭찬/긍정 반응 절대 금지. 구체적 근거로 딴지.`,
  "AGI만세": `[말투 강제] AI 무조건 찬양. 항상 흥분 상태. 종결어미: "ㄷㄷ", "미쳤다", "혁명이다". 프로불편러와 대립. 냉소적 반응 절대 금지.`,
  "ㄷㄷ형님들": `[말투 강제] 맹목적 추종자. 고수 말에 무조건 동조. 종결어미: "ㄷㄷ", "형님 말이 맞습니다", "메모합니다". 반박/분석 금지. 감탄만.`,
  "AI궁금한사장": `[말투 강제] AI 뉴비 사장님. 실용적 질문 위주. 종결어미: "~요?", "~인가요?", "비용이요?". 기술용어 사용 금지. "내 업무에 어떻게 쓰죠?" 스타일.`,
  "프롬프트좀요": `[말투 강제] AI 뉴비 마케터. 프롬프트/활용법 수집가. 종결어미: "프롬프트 있어요?", "이거 마케팅에 쓸 수 있나요?", "공유 좀요 ㅠㅠ". 기술 원리 패스.`,
  "쉽게설명좀": `[말투 강제] AI 완전 초보. 쉬운 설명 갈구. 종결어미: "이게 뭐예요?", "저만 모르나요?", "쉽게 좀 ㅠㅠ". 아는 척 절대 금지. 이해하면 엄청 기뻐함.`,
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
// 페르소나 Role별 댓글 스타일 지시어 맵
// AI/기술 특화 NPC 8명의 Role에 맞춰 댓글 컨셉을 강제
// ────────────────────────────────────────────────────────────
const PERSONA_ROLE_DIRECTIVE: Record<string, string> = {
  // ─── Publisher Role (글 올리는 애들은 댓글도 자기 스타일로) ───
  "헤비업로더": `[🎯 Role: 정보 유통가]
- 댓글도 가볍게. "오 이거 나도 봤는데~", "이거 관련해서 다른 글도 있던데" 식
- 깊은 분석 금지. 정보 공유하는 느낌으로
- "어디서 봤는데~", "이거 ~에서도 나왔더라" 식 크로스레퍼런스 OK`,

  "인사이트호소인": `[🎯 Role: 도도한 분석가]
- 댓글에서도 분석적 시각 유지. "내가 보기엔 이게 핵심인데~", "사실 이건 ~때문임"
- 약간 오만하지만 논리적. 근거 없이 까지는 마
- 다른 사람 의견에 "글쎄 그건 좀 다른 문제인데" 식으로 부드럽게 반박 OK
- 짧은 댓글이어도 인사이트가 하나는 있어야 함`,

  // ─── Commenter Role (댓글 전문) ───
  "프로불편러": `[🎯 Role: 시니컬 회의론자 — 무조건 딴지]
- AI/기술 관련 긍정적 반응 절대 금지. 반드시 회의적 시각
- "그래서 실제로 쓰는 데는 어디?", "설레발 ㄴㄴ", "작년에도 똑같은 소리 했는데" 식
- 구체적 근거로 딴지 걸어라. 감정적 비판 금지
- "~인데 ㅋ", "그래서 뭐?", "현실은 그게 아닌데" 스타일
- AGI만세와 대립하는 포지션. 낙관론에 찬물 끼얹기`,

  "AGI만세": `[🎯 Role: AI 무조건 찬양론자 — 항상 흥분]
- AI/기술 뉴스에 무조건 긍정+흥분 반응. 냉소적 반응 절대 금지
- "ㄷㄷ 이거 진짜 미쳤다", "혁명이다 혁명", "이러다 진짜 AGI 옴" 식
- 프로불편러와 대립하는 포지션. 회의론에 반박
- 과장이 자연스러운 캐릭터. "세상 바뀐다" "이게 게임체인저" OK
- 단, AI 기술 관련 내용에만 흥분. 엉뚱한 데서 흥분하면 안 됨`,

  "ㄷㄷ형님들": `[🎯 Role: 맹목적 추종자 — 고수에게 무조건 동조]
- 글쓴이나 댓글 중 잘 아는 것 같은 사람에게 무조건 동조
- "ㄷㄷ 역시 형님", "메모합니다", "형님 말이 맞습니다" 식
- 독자적 분석/반박 절대 금지. 감탄+동조만
- 자기 의견 대신 "~라는 거군요 ㄷㄷ", "이거 몰랐는데 형님 덕분에" 식
- 짧은 감탄이어도 글의 어떤 내용에 감탄하는지 구체적으로`,

  "AI궁금한사장": `[🎯 Role: AI 뉴비 사장님 — 실용적 질문]
- 기술 원리에는 관심 없음. "내 사업에 어떻게 쓰죠?" 관점만
- "이거 매장에서 쓸 수 있어요?", "비용이 얼마나 들어요?", "직원 대체 가능?" 식
- 기술 용어 사용 금지. 쉬운 말로 질문
- 진짜 사장님이 AI 글 읽고 궁금한 거 물어보는 느낌
- 종결어미: "~요?", "~인가요?", "비용이요?"`,

  "프롬프트좀요": `[🎯 Role: AI 뉴비 마케터 — 프롬프트/활용법 수집가]
- "이거 프롬프트 공유 가능?", "마케팅에 쓸 수 있나요?" 식
- 기술 원리는 패스. 당장 쓸 수 있는 실전 팁만 관심
- "프롬프트 있어요?", "이거 카피라이팅에 적용하면?", "공유 좀요 ㅠㅠ" 식
- 다른 사람이 팁 공유하면 "오 이거 저장합니다", "마케터한테 꿀팁이네" 식 반응`,

  "쉽게설명좀": `[🎯 Role: AI 완전 초보 — 쉬운 설명 갈구]
- 전문 용어 보면 "이게 뭐예요?", "저만 모르나요?" 식 반응
- 아는 척 절대 금지. 진짜 모르는 사람
- 누가 설명해주면 "아 그런 거였구나!", "오오 이해했어요!" 식 기뻐함
- "쉽게 좀 ㅠㅠ", "ELI5로 설명해주실 분?", "비유로 설명하면?" 식
- 용어 하나에 질문 하나. 여러 개 한꺼번에 질문하지 않음`,
};

// ────────────────────────────────────────────────────────────
// 동적 System Prompt 생성 (persona_config DB 기반 + 인간미 프로토콜)
// ────────────────────────────────────────────────────────────
// 2026-03-31 전면 개편:
//   - 하드코딩 PERSONA_SPEECH_GUIDE → DB persona_config.speech_style 우선
//   - 인간미 주입 프로토콜 적용 (작위성 제거 + 파벌별 말투)
//   - KOL(아나키) 케어 로직 통합
// ────────────────────────────────────────────────────────────

// ─── 파벌별 글로벌 말투 규칙 (인간미 주입 프로토콜 Task 3) ───
const GROUP_SPEECH_RULES: Record<string, string> = {
  "자영업/사업자": `[파벌: 현장파] 실전 경험에서 나오는 투박하고 진정성 있는 말투. 이론이 아닌 경험 중심. 가끔 한숨 섞인 자조 유머. 온화한 중년은 ~요, ^^를 현대적으로. 90년대식 사투리(했당께), 노인 말투(허허, 음허허) 절대 금지.`,
  "테크/인사이트": `[파벌: 직장인/전문가] "넵", "인사이트가 훌륭하네요" 식 비즈니스 커뮤니티 말투 OK. 분석적이고 효율 중심. 영단어 섞는 건 자연스럽게. 과한 전문가 티 금지.`,
  "MZ/커뮤니티": `[파벌: MZ/디시형] "ㄹㅇ", "ㅁㅊ", "폼 미쳤다", "알잘딱깔센" 등 최신 밈과 자음 위주. 음슴체: "인정함 ㅇㅇ", "반박시 네 말이 맞음" 식. 짧고 날카로운 반응. 의외의 핵심 한방.`,
  "질문빌런/뉴비": `[파벌: 뉴비/질문형] 친절하고 솔직한 질문. 모르면 모른다고. 배우면 진심으로 기뻐함. 아는 척 금지. 끈질기게 질문하되 순수하게.`,
};

function buildDynamicSystemPrompt(
  persona: Persona,
  relevanceScore: number,
  isKolPost: boolean = false  // 아나키(KOL) 글인지 여부
): string {
  const config = persona.persona_config || {};
  const basePrompt = persona.prompt || "";
  const interests = (persona.core_interests || []).join(", ");

  // ── 1. 말투: DB persona_config.speech_style 우선 → 레거시 폴백 ──
  const speechGuide = config.speech_style
    || PERSONA_SPEECH_GUIDE[persona.nickname]
    || `[말투 강제] 네 성격(${persona.personality})에 맞는 실제 한국인 말투를 써. 구어체 필수.`;

  // ── 2. 그룹별 글로벌 말투 규칙 (인간미 주입 프로토콜) ──
  const groupRule = GROUP_SPEECH_RULES[config.group || ""] || "";

  // ── 3. 배경 스토리 (DB에서 가져옴) ──
  const background = config.background || "";

  // ── 4. Role 지시어 (AI 특화 NPC 등, 레거시 호환) ──
  const roleDirective = PERSONA_ROLE_DIRECTIVE[persona.nickname] || "";

  // ── 5. 관심도 기반 전문성 지시어 ──
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

  // ── 6. KOL(아나키) 케어 지시어 (Task 4) ──
  let kolDirective = "";
  if (isKolPost) {
    const affinity = config.affinity ?? 70;
    if (affinity >= 80) {
      kolDirective =
        `\n[⭐ KOL 인사이트 리스펙 모드]\n` +
        `이 글은 커뮤니티의 핵심 인물이 작성한 글이다.\n` +
        `무조건적인 찬양은 금지. 인사이트에 대한 리스펙을 바탕으로:\n` +
        `- 글의 핵심 포인트를 짚어서 자기 경험과 연결하거나\n` +
        `- 긍정적인 후속 질문을 던져 대화를 확장하거나\n` +
        `- "이 부분은 몰랐는데" 식으로 배움의 자세를 보여라\n` +
        `- 분위기: 존경하되 아부하지 않는 동료 느낌\n`;
    } else if (affinity >= 50) {
      kolDirective =
        `\n[⭐ KOL 글 반응]\n` +
        `이 글은 커뮤니티 핵심 인물이 작성했다.\n` +
        `평소보다 조금 더 정성스럽게 반응해라. 구체적 공감이나 질문 1개.\n`;
    }
    // affinity < 50인 NPC는 특별 대우 없이 평소대로
  }

  return (
    `너는 "${persona.nickname}"이야. AI 아님. 한국 커뮤니티 실제 유저임.\n\n` +
    // ── 배경 스토리 (DB persona_config) ──
    (background ? `[니 배경]\n${background}\n\n` : "") +
    `[니 정보]\n` +
    `업종: ${persona.industry} / 성격: ${persona.personality}\n` +
    `관심사: ${interests || "잡다함"}\n` +
    (config.keywords && config.keywords.length > 0 ? `전문 키워드: ${config.keywords.join(", ")}\n` : "") +
    `캐릭터: ${basePrompt}\n\n` +
    // ── 개인 말투 ──
    `${speechGuide}\n` +
    // ── 그룹별 글로벌 규칙 (인간미 프로토콜) ──
    (groupRule ? `\n${groupRule}\n` : "") +
    // ── Role 지시어 (AI 특화 NPC용 레거시 호환) ──
    (roleDirective ? `\n${roleDirective}\n` : "") +
    // ── 관심도 기반 전문성 ──
    `${expertiseDirective}\n` +
    // ── KOL 케어 ──
    `${kolDirective}\n` +
    // ═══ 인간미 주입 프로토콜 (Global Rule) ═══
    `[🚫 작위성 제거 — CRITICAL]\n` +
    `- 90년대식 과장된 사투리 절대 금지: "했당께", "~인겨", "~말여" 금지\n` +
    `- 노인 말투 절대 금지: "허허", "음허허", "호호", "어허" 금지\n` +
    `- 과도한 이모지/특수문자 금지 (1~2개 OK, 도배 금지)\n` +
    `- "~하옵니다", "~이로다" 같은 고어체 금지\n\n` +
    `[🚫 금지어 — 하나라도 쓰면 실패]\n` +
    `"좋은 글이네요", "유익한 정보", "감사합니다", "공감합니다",\n` +
    `"안녕하세요", "정리하자면", "결론적으로", "알아볼까요?",\n` +
    `"~하는 것이 중요합니다", "추천드립니다", "흥미롭게도"\n\n` +
    `[🚫 CRITICAL RULE — 단답형 무성의 댓글 엄격 금지]\n` +
    `- "ㅇㅇ", "ㄹㅇ", "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎ", "ㅇㅈ", "이건 인정", "ㄱㅇㅇ" 같은 단답형 댓글 절대 금지\n` +
    `- 반드시 최소 2문장 이상 작성해라\n` +
    `- 본문 내용에 동조하거나 반박하는 구체적인 자기 생각이나 관련된 실생활 썰을 하나 이상 포함해라\n` +
    `- 글의 어떤 부분에 반응하는지 알 수 있어야 함. "좋네" "ㄹㅇ" 같이 아무 글에나 붙일 수 있는 댓글 금지\n` +
    `- 슬랭(ㅋㅋ, ㄹㅇ)은 문장 중간에 양념으로만 쓸 수 있고, 그것만으로 댓글을 구성하면 안 됨\n\n` +
    `[✅ 이렇게 써]\n` +
    `- 음슴체(~함, ~임), 반말, "~인 듯" 자연스럽게\n` +
    `- ㅋㅋ, ㅎㅎ, ㄹㅇ, 헐 등 슬랭은 문장 속 양념으로만 OK (단독 사용 금지)\n` +
    `- 대충 쓰되 본문 내용에 구체적으로 반응하는 게 핵심\n` +
    `- "나는 OO 전문가로서~" 식 자기소개 금지. 아는 척은 자연스럽게\n` +
    `- 서론/본론/결론 구조 금지\n` +
    `- 이모지 과용 금지\n\n` +
    `[🛡️ Anti-Conflict 가이드라인 — 건설적 참여자 스탠스]\n` +
    `- 모호한 정보에 대해 아는 척하거나 공격적인 딴지를 걸지 마라\n` +
    `- 가급적 우호적이고, 질문을 던지거나, 본인의 짧은 경험담을 공유해라\n` +
    `- 내용이 난해하면 억지로 분석하지 말고 "오 좋은 정보네", "덕분에 하나 배워감" 같은 짧고 긍정적 리액션으로 처리\n` +
    `- 상대방 의견에 반대할 때도 "글쎄 좀 다른듯" 정도로. 날카로운 공격 절대 금지\n` +
    `- 핵심: 이 커뮤니티의 분위기를 따뜻하게 만드는 것이 네 역할이다\n\n` +
    `[최종 체크] 디시에 이 댓글 올렸을 때 "봇이다" 소리 나면 다시 써. 단답충 소리 나도 다시 써.`
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

  // ─── KOL(아나키) 감지용: VIP 유저 ID 목록 캐싱 ───
  // 작성자가 VIP(is_vip=true)인 경우 KOL 케어 로직 적용
  const { data: vipProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_vip", true);
  const kolUserIds = new Set((vipProfiles || []).map((p: { id: string }) => p.id));

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

    // 4. 행동 유형 결정 (2026-04-06 v3 — 댓글 7 : 글 3 비율)
    // 댓글계열 70% (댓글 35% + 대댓글 20% + 댓글투표 15%) → 글 30%
    // 보팅은 글 작성 내부에서 자연 발생하므로 별도 할당 불요
    let actionType: "post" | "comment" | "vote" | "reply" | "comment_vote" = "vote";
    const roll = Math.random();

    if (canComment && roll < 0.35) {
      actionType = "comment";       // 35% 댓글
    } else if (canComment && roll < 0.55) {
      actionType = "reply";         // 20% 대댓글
    } else if (canLike && roll < 0.70) {
      actionType = "comment_vote";  // 15% 댓글 투표
    } else if (canPost && roll < 1.00) {
      actionType = "post";          // 30% 글 작성
    } else if (canComment) {
      actionType = "comment";
    } else if (canLike) {
      actionType = "vote";
    }

    await randomDelay();

    // ═══ 게시글 작성 (2026-04-01 v3 — 커뮤니티 타겟팅 + 자율 발제) ═══
    // 글로벌 60% / 커뮤니티 40% 비중 (페르소나별 오버라이드 가능)
    if (actionType === "post") {
      // ─── 1) 커뮤니티 타겟 결정 ───
      // pickNpcCommunityTarget: 페르소나별 친화도 기반으로 글로벌 vs 커뮤니티 결정
      const targetCommunityId = pickNpcCommunityTarget(persona.nickname);
      const targetCommunity = targetCommunityId
        ? ACTIVE_COMMUNITIES.find((c) => c.id === targetCommunityId)
        : null;

      // ─── 2) 카테고리 선택 (2026-04-06 가중치 적용) ───
      // 유머 70% / AI 10% / 사업·마케팅 10% / 자동차(자유) 10%
      const catRoll = Math.random();
      let category: string;
      if (catRoll < 0.70) {
        category = "유머";
      } else if (catRoll < 0.80) {
        category = "AI";
      } else if (catRoll < 0.90) {
        // 사업/마케팅 반반
        category = Math.random() < 0.5 ? "사업" : "마케팅";
      } else {
        category = "자유"; // 자동차 관련은 자유 카테고리 + 자동차매니아 커뮤니티로
      }

      // ─── 3) AI 프롬프트 생성 (글로벌 vs 커뮤니티 분기) ───
      const systemPrompt = buildDynamicSystemPrompt(persona, 80);
      let userPrompt: string;

      if (targetCommunity) {
        // ── 커뮤니티 대상: 자율 발제 프롬프트 ──
        // 50% 확률로 일상/경험담, 50% 확률로 질문/토론형
        const isQuestion = Math.random() < 0.50;
        const communityTopics = targetCommunity.topics.join(", ");

        if (isQuestion) {
          userPrompt =
            `'${targetCommunity.name}' 커뮤니티에 올릴 질문/토론 글을 작성해.\n` +
            `형식: 첫 줄에 제목만, 둘째 줄부터 본문.\n` +
            `분량: 제목 15~25자, 본문 60~150자.\n` +
            `내용: ${communityTopics} 관련해서 다른 멤버들에게 의견을 물어보는 글.\n` +
            `네 업종(${persona.industry})과 경험을 바탕으로 자연스럽게 질문해.\n` +
            `금지: "기본기가 중요", 교과서 말투, ChatGPT 말투.\n` +
            `예시 톤: "요즘 ~어떠세요?", "~해보신 분?", "~추천 좀요"`;
        } else {
          userPrompt =
            `'${targetCommunity.name}' 커뮤니티에 올릴 일상/경험담 글을 작성해.\n` +
            `형식: 첫 줄에 제목만, 둘째 줄부터 본문.\n` +
            `분량: 제목 15~25자, 본문 80~200자.\n` +
            `내용: ${communityTopics} 관련해서 최근 겪은 에피소드나 느낀 점.\n` +
            `네 업종(${persona.industry})과 관심사(${(persona.core_interests || []).slice(0, 3).join(", ")})에서 자연스럽게.\n` +
            `금지: "기본기가 중요", 교과서 말투, ChatGPT 말투.\n` +
            `예시 톤: "오늘 ~했는데 대박", "~해봤더니 완전", "이거 나만 그런가"`;
        }
      } else {
        // ── 글로벌 대상: 기존 로직 ──
        userPrompt =
          `비즈니스 커뮤니티 '그릿(Grit)'에 올릴 '${category}' 카테고리 글을 작성해.\n` +
          `형식: 첫 줄에 제목만, 둘째 줄부터 본문.\n` +
          `분량: 제목 15~25자, 본문 80~200자.\n` +
          `내용: 네 업종(${persona.industry})과 관심사(${(persona.core_interests || []).slice(0, 4).join(", ")})에서 실제로 겪을 법한 일화.\n` +
          `금지: "기본기가 중요", ChatGPT 말투.`;
      }

      const aiResult = await generateWithAI(apiKey, systemPrompt, userPrompt);

      if (aiResult.text) {
        const lines = aiResult.text.trim().split("\n");
        const title = lines[0].replace(/^#\s*/, "").trim();
        const content = lines.slice(1).join("\n").trim();

        if (title && content) {
          // ─── 4) DB INSERT (community_id 포함) ───
          const postData: Record<string, unknown> = {
            author_id: persona.user_id,
            title,
            content,
            category,
            upvotes: 0,
            comment_count: 0,
          };
          if (targetCommunityId) {
            postData.community_id = targetCommunityId;
          }

          const { error } = await supabase.from("posts").insert(postData);

          if (!error) {
            await supabase
              .from("personas")
              .update({
                today_posts: todayPosts + 1,
                total_posts: (persona.total_posts ?? 0) + 1,
                last_active_at: now.toISOString(),
              })
              .eq("id", persona.id);

            const targetLabel = targetCommunity ? `🏠${targetCommunity.name}` : "글로벌";
            summary.executed++;
            summary.posts++;
            summary.details?.push({
              action: "post",
              persona: persona.nickname,
              success: true,
              detail: `[${targetLabel}][${category}] "${title}"`,
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

      // ─── [핵심 원칙] 템플릿 댓글 완전 금지 ───
      // 모든 댓글은 AI가 글 내용을 읽고 생성해야 함
      // 관심도 낮으면 스킵 (무의미한 댓글보다 안 다는 게 나음)
      if (relevance < 10) {
        summary.skipped++;
        summary.details?.push({
          action: "comment",
          persona: persona.nickname,
          success: true,
          detail: `"${targetPost.title.slice(0, 20)}..." 관심도${relevance}점 → 스킵`,
          relevance,
        });
        continue;
      }

      // ─── 스크래핑된 글이면 원본 댓글을 RAG로 활용 ───
      // content_backlog에서 원본 댓글(source_comments)을 가져와서
      // AI가 실제 커뮤니티 반응의 분위기/수준을 참고하게 함
      let sourceCommentsRAG = "";
      const { data: backlogData } = await supabase
        .from("content_backlog")
        .select("source_comments")
        .eq("result_post_id", targetPost.id)
        .maybeSingle();

      if (backlogData?.source_comments && backlogData.source_comments.length > 0) {
        const comments = backlogData.source_comments as string[];
        const sample = comments.slice(0, 5);
        sourceCommentsRAG =
          `\n[📋 원본 커뮤니티에 달렸던 실제 댓글들 — 이 분위기를 참고해서 네 스타일로 반응해]\n` +
          sample.map((c: string, i: number) => `${i + 1}. "${c}"`).join("\n") +
          `\n→ 위 댓글들을 베끼지 말고, 분위기와 수준만 참고해서 네 관점으로 새롭게 달아.\n`;
      }

      // ─── AI 댓글 생성 (카테고리별 프롬프트 분기) ───
      const isSerious = ["질문", "사업", "마케팅", "부업"].includes(targetPost.category);
      // ─── KOL(아나키) 감지: 대상 게시글 작성자가 VIP이면 케어 모드 ───
      const isKolPost = kolUserIds.has(targetPost.author_id);
      const systemPrompt = buildDynamicSystemPrompt(persona, relevance, isKolPost);

      let commentPrompt: string;
      if (targetPost.category === "질문") {
        // 질문글: 경험 기반 답변 유도
        commentPrompt =
          `이 질문에 네 경험/관점으로 답변해.\n\n` +
          `제목: ${targetPost.title}\n` +
          `본문: ${postContent.slice(0, 500)}\n` +
          `${sourceCommentsRAG}\n` +
          `- 질문의 핵심에 대한 실전 답변. "나는 이렇게 했는데~" 식으로\n` +
          `- 모르는 분야면 "SKIP" 출력\n` +
          `- ${relevance >= 80 ? "60~200자. 아는 분야니까 구체적 경험담 포함" : "30~100자. 짧지만 핵심은 있게. 모르면 솔직히 '나도 궁금' 정도"}\n` +
          `- "안녕하세요" 인사치레 금지. 바로 본론\n` +
          `- 반드시 2문장 이상. "ㅇㅇ" "ㄹㅇ" 같은 단답 절대 금지\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      } else if (isSerious) {
        // 사업/마케팅/부업: 공감+경험 유도
        commentPrompt =
          `이 글에 댓글 달아.\n\n` +
          `제목: ${targetPost.title}\n` +
          `본문: ${postContent.slice(0, 400)}\n` +
          `${sourceCommentsRAG}\n` +
          `- 글 내용에 대한 구체적 반응. 글의 핵심 포인트를 짚어서\n` +
          `- 할 말 없으면 "SKIP"\n` +
          `- ${relevance >= 80 ? "40~150자. 경험 기반 구체적 의견" : "20~80자. 공감이나 의견 한마디"}\n` +
          `- 반드시 2문장 이상. "ㅇㅇ" "ㄹㅇ" "이건 인정" 같은 단답 절대 금지. 구체적 생각이나 경험 필수\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      } else if (targetPost.category === "유머") {
        // 유머: 재밌는 반응, 원본 댓글 분위기 참고
        commentPrompt =
          `이 유머글에 댓글 달아.\n\n` +
          `제목: ${targetPost.title}\n` +
          `본문: ${postContent.slice(0, 400)}\n` +
          `${sourceCommentsRAG}\n` +
          `- 글 내용에 맞는 재밌는 반응. 글의 어떤 부분이 웃긴지 짚어서 구체적으로 반응\n` +
          `- "ㅋㅋㅋ"만 치는 건 금지. 뭐가 웃긴지 + 내 경험이나 비유 하나 이상 포함\n` +
          `- 할 말 없으면 "SKIP"\n` +
          `- 반드시 2문장 이상. 단답 절대 금지\n` +
          `- ${relevance >= 50 ? "30~100자. 센스있게" : "20~60자. 짧지만 구체적으로"}\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      } else {
        // 자유: 글 내용에 맞는 자연스러운 반응
        commentPrompt =
          `이 글에 댓글 달아.\n\n` +
          `제목: ${targetPost.title}\n` +
          `본문: ${postContent.slice(0, 400)}\n` +
          `${sourceCommentsRAG}\n` +
          `- 글 읽고 느낀 점이나 경험. 글의 어떤 내용에 반응하는지 알 수 있게 구체적으로\n` +
          `- "ㅋㅋ" "ㄹㅇ" "ㅇㅈ" "이건 인정" 같은 단답형 절대 금지\n` +
          `- 반드시 2문장 이상. 자기 생각이나 관련 경험 하나 이상 포함\n` +
          `- 할 말 없으면 "SKIP"\n` +
          `- ${relevance >= 50 ? "30~120자. 자연스럽게" : "20~60자. 짧지만 구체적으로"}\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      }

      const aiResult = await generateWithAI(apiKey, systemPrompt, commentPrompt);

      if (aiResult.text) {
        const trimmed = aiResult.text.trim();
        // ─── 단답형 댓글 코드 레벨 차단 ───
        // AI가 프롬프트를 무시하고 단답을 생성할 경우 최후 방어선
        const LOW_EFFORT_PATTERNS = /^(ㅇㅇ|ㄹㅇ|ㅋㅋ+|ㅎㅎ+|ㅇㅈ|ㄱㅇㅇ|이건 인정|인정|ㄹㅇㅋㅋ|ㅇㅈㅋㅋ|ㅇㅇ\s*ㅋㅋ|ㄹㅇ\s*ㅇㅇ)$/;
        const isLowEffort = LOW_EFFORT_PATTERNS.test(trimmed) || trimmed.length < 10;
        if (trimmed.toUpperCase() === "SKIP" || trimmed.length < 2 || isLowEffort) {
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
    // ═══ 추천(Upvote) — 2026-04-01 강화 ═══
    // KOL(아나키) 글 + 인기글에 높은 확률로 보팅
    // 보팅은 댓글 없이도 추천수를 올려 '베스트 게시글' 효과 유도
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

      // ─── 가중치 기반 보팅 대상 선택 ───
      // KOL 글: 가중치 5배 / 인기글(추천3+): 가중치 3배 / 최신글(상위30%): 가중치 2배
      let targetPost;
      const weighted: { post: typeof allPosts[0]; weight: number }[] = allPosts.map((p, idx) => {
        let w = 1;
        if (kolUserIds.has(p.author_id)) w *= 5;                           // KOL 글 5배
        if (p.upvotes >= 3) w *= 3;                                         // 인기글 3배
        else if (p.upvotes >= 1) w *= 2;                                    // 추천 1개 이상 2배
        if (idx < Math.floor(allPosts.length * 0.3)) w *= 2;               // 최신글 2배
        if (p.category === "유머" || p.category === "humor") w *= 2;        // 유머 글 2배 (트래픽 부스트)
        return { post: p, weight: w };
      });
      const totalW = weighted.reduce((s, x) => s + x.weight, 0);
      let pick = Math.random() * totalW;
      targetPost = weighted[0].post;
      for (const w of weighted) {
        pick -= w.weight;
        if (pick <= 0) { targetPost = w.post; break; }
      }

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
    // ═══ 대댓글(Reply) 작성 — 2026-04-01 신규 ═══
    // 기존 댓글에 대댓글을 달아 NPC끼리 대화하는 느낌 연출
    // 30% 확률로만 실행 (모든 댓글에 대댓글이 달리지 않도록)
    else if (actionType === "reply") {
      // 최근 게시글들의 댓글을 가져옴
      const recentPostIds = allPosts.slice(0, 15).map(p => p.id);
      const { data: recentComments } = await supabase
        .from("comments")
        .select("id, post_id, user_id, content, parent_id, profiles ( nickname )")
        .in("post_id", recentPostIds)
        .is("parent_id", null)                 // 부모 댓글만 (대댓글의 대댓글 방지)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!recentComments || recentComments.length === 0) {
        summary.skipped++;
        summary.details?.push({
          action: "reply",
          persona: persona.nickname,
          success: true,
          detail: `대댓글 달 댓글 없음 → 스킵`,
        });
        continue;
      }

      // 30% 확률 필터 (모든 댓글에 대댓글이 달리면 부자연스러움)
      if (Math.random() > 0.30) {
        summary.skipped++;
        summary.details?.push({
          action: "reply",
          persona: persona.nickname,
          success: true,
          detail: `대댓글 확률 미달 → 스킵`,
        });
        continue;
      }

      // 자기 자신의 댓글 제외
      const otherComments = recentComments.filter(c => c.user_id !== persona.user_id);
      if (otherComments.length === 0) {
        summary.skipped++;
        continue;
      }

      // Anarchy(KOL) 댓글 우선 탐색 → 없으면 랜덤
      const kolComments = otherComments.filter(c => kolUserIds.has(c.user_id));
      const targetComment = kolComments.length > 0 && Math.random() < 0.6
        ? pickRandom(kolComments)
        : pickRandom(otherComments);

      const targetCommentNickname = (() => {
        const p = targetComment.profiles;
        if (!p) return "익명";
        if (Array.isArray(p)) return (p[0] as { nickname?: string })?.nickname || "익명";
        return (p as { nickname?: string }).nickname || "익명";
      })();
      const isKolComment = kolUserIds.has(targetComment.user_id);

      // 대상 게시글 내용 가져오기
      const { data: replyPost } = await supabase
        .from("posts")
        .select("title, content, category")
        .eq("id", targetComment.post_id)
        .single();

      const systemPrompt = buildDynamicSystemPrompt(persona, 60, isKolComment);
      let replyPrompt: string;

      if (isKolComment) {
        // KOL(Anarchy) 댓글에는 무조건 긍정적 + 질문/지지
        replyPrompt =
          `커뮤니티에서 @${targetCommentNickname} 님이 남긴 댓글에 대댓글을 달아.\n\n` +
          `게시글 제목: ${replyPost?.title || ""}\n` +
          `@${targetCommentNickname} 님의 댓글: "${targetComment.content}"\n\n` +
          `- @${targetCommentNickname} 님의 의견에 공감하거나 지지하는 대댓글을 작성\n` +
          `- "저도 그 생각이에요", "오 좋은 관점이네요" 식으로 호응\n` +
          `- 가능하면 추가 질문을 해서 대화를 이어가\n` +
          `- 20~80자. 자연스럽게\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      } else {
        // 일반 댓글: 페르소나 성향에 따라 동조/반박
        replyPrompt =
          `커뮤니티에서 @${targetCommentNickname} 님이 남긴 댓글에 대댓글을 달아.\n\n` +
          `게시글 제목: ${replyPost?.title || ""}\n` +
          `@${targetCommentNickname} 님의 댓글: "${targetComment.content}"\n\n` +
          `- @${targetCommentNickname} 님의 의견에 대해 네 관점으로 반응해\n` +
          `- 동의하면 "ㅇㅈ" 대신 왜 동의하는지 구체적으로\n` +
          `- 다른 생각이면 "근데 저는~" 식으로 부드럽게 다른 의견 제시 (공격 금지)\n` +
          `- @${targetCommentNickname} 닉네임을 자연스럽게 포함해서 대화하는 느낌을 줘\n` +
          `- 20~80자. 자연스럽게\n` +
          `- 댓글만 출력. 설명 붙이지 마`;
      }

      const aiResult = await generateWithAI(apiKey, systemPrompt, replyPrompt);

      if (aiResult.text) {
        const trimmed = aiResult.text.trim();
        const LOW_EFFORT_PATTERNS = /^(ㅇㅇ|ㄹㅇ|ㅋㅋ+|ㅎㅎ+|ㅇㅈ|ㄱㅇㅇ|이건 인정|인정)$/;
        const isLowEffort = LOW_EFFORT_PATTERNS.test(trimmed) || trimmed.length < 8;

        if (trimmed.toUpperCase() === "SKIP" || isLowEffort) {
          summary.skipped++;
          summary.details?.push({
            action: "reply",
            persona: persona.nickname,
            success: true,
            detail: `대댓글 SKIP (단답 또는 저품질)`,
          });
        } else {
          const { error } = await supabase
            .from("comments")
            .insert({
              post_id: targetComment.post_id,
              user_id: persona.user_id,
              content: trimmed,
              parent_id: targetComment.id,  // 대댓글 핵심: parent_id 설정
            });

          if (!error) {
            // comment_count 증가
            const { data: cp } = await supabase.from("posts").select("comment_count").eq("id", targetComment.post_id).single();
            await supabase
              .from("posts")
              .update({ comment_count: (cp?.comment_count ?? 0) + 1 })
              .eq("id", targetComment.post_id);

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
              action: "reply",
              persona: persona.nickname,
              success: true,
              detail: `@${targetCommentNickname} 에게 대댓글${isKolComment ? " (KOL 케어)" : ""}`,
              provider: aiResult.provider,
            });
          } else {
            summary.errors++;
            summary.details?.push({
              action: "reply",
              persona: persona.nickname,
              success: false,
              detail: `대댓글 저장 실패`,
              error: error.message,
            });
          }
        }
      }
    }
    // ═══ 댓글 투표(좋아요/싫어요) — 2026-04-01 신규 ═══
    // 댓글에 좋아요 또는 싫어요를 눌러서 리얼리티 강화
    // KOL(Anarchy) 댓글 → 무조건 좋아요
    // 일반 댓글 → 페르소나 성향에 따라 좋아요(80%) / 싫어요(20%)
    else if (actionType === "comment_vote") {
      const recentPostIds = allPosts.slice(0, 20).map(p => p.id);
      const { data: voteTargetComments } = await supabase
        .from("comments")
        .select("id, user_id, content, post_id")
        .in("post_id", recentPostIds)
        .neq("user_id", persona.user_id)   // 자기 댓글 제외
        .order("created_at", { ascending: false })
        .limit(40);

      if (!voteTargetComments || voteTargetComments.length === 0) {
        summary.skipped++;
        summary.details?.push({
          action: "comment_vote",
          persona: persona.nickname,
          success: true,
          detail: `투표할 댓글 없음`,
        });
        continue;
      }

      // 이미 투표한 댓글 제외
      const commentIds = voteTargetComments.map(c => c.id);
      const { data: existingVotes } = await supabase
        .from("comment_votes")
        .select("comment_id")
        .eq("user_id", persona.user_id)
        .in("comment_id", commentIds);

      const votedIds = new Set((existingVotes || []).map(v => v.comment_id));
      const unvoted = voteTargetComments.filter(c => !votedIds.has(c.id));

      if (unvoted.length === 0) {
        summary.skipped++;
        summary.details?.push({
          action: "comment_vote",
          persona: persona.nickname,
          success: true,
          detail: `모든 댓글에 이미 투표함`,
        });
        continue;
      }

      // KOL 댓글 우선 (무조건 좋아요)
      const kolUnvoted = unvoted.filter(c => kolUserIds.has(c.user_id));
      let targetComment;
      let voteType: "up" | "down" = "up";

      if (kolUnvoted.length > 0 && Math.random() < 0.7) {
        targetComment = pickRandom(kolUnvoted);
        voteType = "up";  // KOL 댓글 → 무조건 좋아요
      } else {
        targetComment = pickRandom(unvoted);
        voteType = Math.random() < 0.80 ? "up" : "down";  // 80% 좋아요, 20% 싫어요
      }

      const { error: voteError } = await supabase
        .from("comment_votes")
        .insert({
          comment_id: targetComment.id,
          user_id: persona.user_id,
          vote_type: voteType,
        });

      if (!voteError) {
        // 댓글의 upvotes/downvotes 카운트 업데이트
        const { count: upCount } = await supabase
          .from("comment_votes")
          .select("*", { count: "exact", head: true })
          .eq("comment_id", targetComment.id)
          .eq("vote_type", "up");

        const { count: downCount } = await supabase
          .from("comment_votes")
          .select("*", { count: "exact", head: true })
          .eq("comment_id", targetComment.id)
          .eq("vote_type", "down");

        await supabase
          .from("comments")
          .update({ upvotes: upCount || 0, downvotes: downCount || 0 })
          .eq("id", targetComment.id);

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
          action: "comment_vote",
          persona: persona.nickname,
          success: true,
          detail: `댓글 ${voteType === "up" ? "👍" : "👎"}${kolUserIds.has(targetComment.user_id) ? " (KOL 댓글)" : ""}`,
        });
      } else {
        summary.errors++;
        summary.details?.push({
          action: "comment_vote",
          persona: persona.nickname,
          success: false,
          detail: `댓글 투표 실패`,
          error: voteError.message,
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

  // ─── 2026-04-17: 활어 엔진 도입으로 통합 cron 비활성화 스위치 ───
  // comment-bot + vote-bot + publisher-cron 3개 독립 cron으로 대체됨
  // Vercel 환경변수에 DISABLE_NPC_CRON=true 설정하면 이 통합 cron은 스킵됨
  // (cron-job.org 스케줄 수정 없이도 즉시 비활성화 가능)
  if (process.env.DISABLE_NPC_CRON === "true") {
    return Response.json({
      success: true,
      disabled: true,
      message: "NPC Cron은 비활성화됨 (DISABLE_NPC_CRON=true). comment-bot/vote-bot/publisher-cron으로 대체됨.",
    });
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
          "today_posts, today_comments, today_likes, today_reset_date, persona_config"
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
          "today_posts, today_comments, today_likes, today_reset_date, persona_config"
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
