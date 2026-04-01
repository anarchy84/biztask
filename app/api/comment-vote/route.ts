// ================================================================
// 댓글 투표 API (좋아요/싫어요)
// 날짜: 2026-04-01
// 용도: 댓글에 대한 좋아요(up)/싫어요(down) 투표 처리
//
// [동작 방식]
// - 같은 타입 재투표: 투표 취소 (toggle)
// - 다른 타입 투표: 기존 투표를 새 타입으로 변경
// - 투표 없는 상태: 새 투표 생성
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // 로그인 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { comment_id, vote_type } = body;

    // 입력값 검증
    if (!comment_id || !vote_type) {
      return NextResponse.json(
        { error: "comment_id와 vote_type은 필수입니다." },
        { status: 400 }
      );
    }

    if (vote_type !== "up" && vote_type !== "down") {
      return NextResponse.json(
        { error: "vote_type은 'up' 또는 'down'이어야 합니다." },
        { status: 400 }
      );
    }

    // 기존 투표 확인
    const { data: existingVote } = await supabase
      .from("comment_votes")
      .select("id, vote_type")
      .eq("comment_id", comment_id)
      .eq("user_id", user.id)
      .maybeSingle();

    let action: "created" | "toggled" | "removed" = "created";
    // oldType: 기존 투표 타입 (로깅/디버깅용)
    const _oldType = existingVote?.vote_type || null;
    void _oldType;

    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // 같은 타입 → 투표 취소 (토글)
        await supabase
          .from("comment_votes")
          .delete()
          .eq("id", existingVote.id);
        action = "removed";
      } else {
        // 다른 타입 → 변경 (좋아요 ↔ 싫어요)
        await supabase
          .from("comment_votes")
          .update({ vote_type })
          .eq("id", existingVote.id);
        action = "toggled";
      }
    } else {
      // 새 투표 생성
      const { error: insertError } = await supabase
        .from("comment_votes")
        .insert({
          comment_id,
          user_id: user.id,
          vote_type,
        });

      if (insertError) {
        return NextResponse.json(
          { error: "투표 실패: " + insertError.message },
          { status: 500 }
        );
      }
    }

    // 댓글의 upvotes/downvotes 카운트 재계산
    const { count: upCount } = await supabase
      .from("comment_votes")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", comment_id)
      .eq("vote_type", "up");

    const { count: downCount } = await supabase
      .from("comment_votes")
      .select("*", { count: "exact", head: true })
      .eq("comment_id", comment_id)
      .eq("vote_type", "down");

    await supabase
      .from("comments")
      .update({
        upvotes: upCount || 0,
        downvotes: downCount || 0,
      })
      .eq("id", comment_id);

    return NextResponse.json({
      success: true,
      action,
      vote_type: action === "removed" ? null : vote_type,
      upvotes: upCount || 0,
      downvotes: downCount || 0,
    });
  } catch (err) {
    console.error("[comment-vote] 에러:", err);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
