// ============================================================
// 👍 보팅봇 (Vote Bot) — 활어 엔진
// 작성일: 2026-04-17
// ============================================================
// 목적:
//   - 글/댓글에 자동으로 보팅을 찍는 cron
//   - 과거 글에도 계속 보팅이 달림 → 숫자 변화로 "살아있는 커뮤니티" 연출
//   - 업:다운 = 8:2 비율 (대부분 긍정, 가끔 리얼함)
//   - 모든 NPC가 고르게 참여 (로드밸런싱)
//
// 호출 주기: 3~5분마다
// 한 번 호출당 처리: 최대 15개 보팅 (글 10 + 댓글 5)
// ============================================================

import { NextRequest, after } from "next/server";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── 타입 ───
interface Persona {
  id: string;
  user_id: string;
  nickname: string;
  is_active: boolean;
  active_start_hour?: number;
  active_end_hour?: number;
  like_frequency?: number;
  today_likes?: number;
  today_reset_date?: string;
  total_likes?: number;
}

interface VoteBotSummary {
  post_votes_created: number;
  comment_votes_created: number;
  duplicates_skipped: number;
  errors: number;
  details: string[];
}

// ────────────────────────────────────────────────────────────
// KST 유틸
// ────────────────────────────────────────────────────────────
function getKSTNow(): Date {
  const now = new Date();
  const kstOffset = 9 * 60;
  return new Date(now.getTime() + (kstOffset + now.getTimezoneOffset()) * 60000);
}
function getKSTDate(): string {
  const d = getKSTNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getKSTHour(): number {
  return getKSTNow().getHours();
}
function isWithinActiveHours(h: number, s: number, e: number): boolean {
  if (s < e) return h >= s && h < e;
  if (s > e) return h >= s || h < e;
  return true;
}

// ────────────────────────────────────────────────────────────
// 유틸: 가중치 랜덤
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

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ────────────────────────────────────────────────────────────
// 글 1개에 보팅 1개 찍기
// biztask의 post_likes는 "좋아요"만 지원 (다운보팅 없음)
// ────────────────────────────────────────────────────────────
async function voteOnPost(
  supabase: SupabaseClient,
  persona: Persona,
  postId: string,
  currentUpvotes: number
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  // 중복 체크 (UNIQUE 제약이 있어도 에러 전에 체크)
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", persona.user_id)
    .maybeSingle();

  if (existing) return { success: false, duplicate: true };

  const { error: insertErr } = await supabase
    .from("post_likes")
    .insert({ post_id: postId, user_id: persona.user_id });

  if (insertErr) {
    // UNIQUE 위반은 duplicate로 취급
    if (insertErr.code === "23505") return { success: false, duplicate: true };
    return { success: false, error: insertErr.message };
  }

  // posts.upvotes +1 (RPC 우선, 실패 시 직접 UPDATE)
  const { error: rpcErr } = await supabase.rpc("increment_upvotes", { row_id: postId });
  if (rpcErr) {
    await supabase
      .from("posts")
      .update({ upvotes: currentUpvotes + 1 })
      .eq("id", postId);
  }

  // 페르소나 카운터
  await supabase
    .from("personas")
    .update({
      today_likes: (persona.today_likes || 0) + 1,
      total_likes: (persona.total_likes || 0) + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", persona.id);

  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 댓글에 보팅 찍기
// comment_votes: vote_type(up/down) 지원 — 업 90%, 다운 10%
// ────────────────────────────────────────────────────────────
async function voteOnComment(
  supabase: SupabaseClient,
  persona: Persona,
  commentId: string
): Promise<{ success: boolean; duplicate?: boolean; error?: string }> {
  // 댓글은 up 90%, down 10% (유머 글이라 표기)
  const voteType = Math.random() < 0.90 ? "up" : "down";

  const { data: existing } = await supabase
    .from("comment_votes")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", persona.user_id)
    .maybeSingle();

  if (existing) return { success: false, duplicate: true };

  const { error: insertErr } = await supabase
    .from("comment_votes")
    .insert({ comment_id: commentId, user_id: persona.user_id, vote_type: voteType });

  if (insertErr) {
    if (insertErr.code === "23505") return { success: false, duplicate: true };
    return { success: false, error: insertErr.message };
  }

  // comments.upvotes/downvotes 카운터 업데이트 (기존 npc-cron과 동일 패턴)
  const { count: upCount } = await supabase
    .from("comment_votes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("vote_type", "up");

  const { count: downCount } = await supabase
    .from("comment_votes")
    .select("*", { count: "exact", head: true })
    .eq("comment_id", commentId)
    .eq("vote_type", "down");

  await supabase
    .from("comments")
    .update({ upvotes: upCount || 0, downvotes: downCount || 0 })
    .eq("id", commentId);

  // 페르소나 카운터
  await supabase
    .from("personas")
    .update({
      today_likes: (persona.today_likes || 0) + 1,
      total_likes: (persona.total_likes || 0) + 1,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", persona.id);

  return { success: true };
}

// ────────────────────────────────────────────────────────────
// 로드밸런싱 NPC 픽: today_likes 적은 애 우선
// ────────────────────────────────────────────────────────────
function pickNpcByLoadBalance(eligible: Persona[]): Persona {
  const weights = eligible.map((p) => 1 / ((p.today_likes || 0) + 1));
  return weightedPick(eligible, weights);
}

// ────────────────────────────────────────────────────────────
// 메인 잡
// ────────────────────────────────────────────────────────────
async function runVoteBotJob(): Promise<VoteBotSummary> {
  const supabase = createAdminSupabaseClient();
  const summary: VoteBotSummary = {
    post_votes_created: 0,
    comment_votes_created: 0,
    duplicates_skipped: 0,
    errors: 0,
    details: [],
  };

  const currentDate = getKSTDate();
  const currentHour = getKSTHour();

  // ─── 활성 NPC 로드 + 카운터 리셋 ───
  const { data: allPersonas, error: pErr } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true);

  if (pErr || !allPersonas || allPersonas.length === 0) {
    summary.details.push(`활성 NPC 없음 (${pErr?.message || "empty"})`);
    return summary;
  }

  const eligible: Persona[] = [];
  for (const p of allPersonas as Persona[]) {
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
      p.today_likes = 0;
    }

    const startH = p.active_start_hour ?? 9;
    const endH = p.active_end_hour ?? 23;
    if (!isWithinActiveHours(currentHour, startH, endH)) continue;

    const freq = p.like_frequency ?? 15;
    const today = p.today_likes ?? 0;
    if (today >= freq) continue;

    eligible.push(p);
  }

  if (eligible.length === 0) {
    summary.details.push(`활동 가능 NPC 0명 (시간대/할당량 필터)`);
    return summary;
  }

  console.log(`[VoteBot] 활동 가능 NPC: ${eligible.length}명 / 전체 ${allPersonas.length}명`);

  // ─── 글 타겟: 최근 30일, 보팅 적은 글 우선 ───
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, upvotes, category, created_at")
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(100);

  // ─── 댓글 타겟: 최근 7일 ───
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: comments } = await supabase
    .from("comments")
    .select("id, created_at")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(200);

  // ─── 이번 호출당 생성할 보팅 수 (5~15개) ───
  const targetPostVotes = 5 + Math.floor(Math.random() * 6);      // 5~10
  const targetCommentVotes = 2 + Math.floor(Math.random() * 4);   // 2~5
  summary.details.push(`목표 — 글 보팅 ${targetPostVotes}개, 댓글 보팅 ${targetCommentVotes}개`);

  // ═══ 글 보팅 생성 ═══
  if (posts && posts.length > 0) {
    for (let i = 0; i < targetPostVotes; i++) {
      if (eligible.length === 0) break;

      // 보팅 수 적은 글에 가중치 (신선도 + 보팅 부족도)
      const now = Date.now();
      const weights = posts.map((p: { id: string; upvotes: number; created_at: string }) => {
        const ageHours = (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60);
        const freshnessBoost = ageHours < 24 ? 3 : ageHours < 168 ? 1.5 : 1;
        const scarcityBoost = 1 / ((p.upvotes || 0) + 2);
        return freshnessBoost * scarcityBoost;
      });
      const targetPost = weightedPick(posts, weights) as { id: string; upvotes: number; category: string };

      // 로드밸런싱으로 NPC 픽
      const npc = pickNpcByLoadBalance(eligible);

      const result = await voteOnPost(supabase, npc, targetPost.id, targetPost.upvotes || 0);

      if (result.success) {
        summary.post_votes_created++;
        npc.today_likes = (npc.today_likes || 0) + 1;  // 로컬 카운터 업데이트
        // 할당량 초과면 pool에서 제거
        const freq = npc.like_frequency ?? 15;
        if ((npc.today_likes || 0) >= freq) {
          const idx = eligible.indexOf(npc);
          if (idx >= 0) eligible.splice(idx, 1);
        }
      } else if (result.duplicate) {
        summary.duplicates_skipped++;
      } else {
        summary.errors++;
        summary.details.push(`❌ 글 보팅 실패 (${npc.nickname}): ${result.error}`);
      }

      // 0.3~1초 딜레이
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
    }
  }

  // ═══ 댓글 보팅 생성 ═══
  if (comments && comments.length > 0 && eligible.length > 0) {
    for (let i = 0; i < targetCommentVotes; i++) {
      if (eligible.length === 0) break;
      const targetComment = pickRandom(comments) as { id: string };
      const npc = pickNpcByLoadBalance(eligible);

      const result = await voteOnComment(supabase, npc, targetComment.id);

      if (result.success) {
        summary.comment_votes_created++;
        npc.today_likes = (npc.today_likes || 0) + 1;
        const freq = npc.like_frequency ?? 15;
        if ((npc.today_likes || 0) >= freq) {
          const idx = eligible.indexOf(npc);
          if (idx >= 0) eligible.splice(idx, 1);
        }
      } else if (result.duplicate) {
        summary.duplicates_skipped++;
      } else {
        summary.errors++;
      }

      await new Promise((r) => setTimeout(r, 200 + Math.random() * 500));
    }
  }

  console.log(`[VoteBot] 완료 → 글 보팅 ${summary.post_votes_created}, 댓글 보팅 ${summary.comment_votes_created}, 중복 ${summary.duplicates_skipped}, 에러 ${summary.errors}`);
  return summary;
}

// ============================================================
// GET 핸들러 (Hit & Run)
// ============================================================
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
  }

  const kstHour = getKSTHour();
  const currentDate = getKSTDate();

  after(async () => {
    try {
      console.log(`[VoteBot GET→after] 시작 (${currentDate} KST ${kstHour}시)`);
      const summary = await runVoteBotJob();
      console.log(`[VoteBot GET→after] 요약:`, JSON.stringify(summary, null, 2));
    } catch (err) {
      console.error(`[VoteBot GET→after] 실패:`, err);
    }
  });

  return Response.json({
    success: true,
    cron: true,
    kstHour,
    currentDate,
    message: `보팅봇 cron 수신 → 백그라운드 실행 시작`,
  });
}

// ============================================================
// POST 핸들러 (어드민 수동 실행)
// ============================================================
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false, error: "인증 실패" }, { status: 401 });
  }

  try {
    const summary = await runVoteBotJob();
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
