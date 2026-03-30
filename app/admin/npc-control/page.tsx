"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Loader2,
  Play,
  Power,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Volume2,
  VolumeX,
  RotateCcw,
} from "lucide-react";

// ─── 페르소나 타입 정의 (DB 스키마 참고) ───
type Persona = {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  industry: string;
  mode: "AUTO" | "MANUAL";
  is_active: boolean;
  post_frequency: number;
  comment_frequency: number;
  like_frequency: number;
  active_start_hour: number;
  active_end_hour: number;
  today_posts: number;
  today_comments: number;
  today_likes: number;
  today_reset_date: string;
  total_posts: number;
  total_comments: number;
  total_likes: number;
  last_active_at: string | null;
  prompt: string | null;
};

// ─── 크론 상태 타입 ───
type CronStatus = {
  url: string;
  lastExecution: string | null;
  lastResult: string | null;
  secretKey: string;
};

// ─── 편집 상태를 위한 임시 데이터 ───
type EditingData = {
  [personaId: string]: {
    post_frequency?: number;
    comment_frequency?: number;
    like_frequency?: number;
    active_start_hour?: number;
    active_end_hour?: number;
    is_active?: boolean;
  };
};

export default function NPCControlPage() {
  // ─── 상태 관리 ───
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditingData>({});
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [executingPersonaId, setExecutingPersonaId] = useState<string | null>(
    null
  );
  const [executingAll, setExecutingAll] = useState(false);
  const [resettingCounters, setResettingCounters] = useState(false);

  // ─── 페르소나 데이터 로드 ───
  const loadPersonas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .order("nickname");

      if (error) throw error;
      setPersonas(data || []);
      setEditing({});
    } catch (error) {
      console.error("Failed to load personas:", error);
      alert("페르소나 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 페이지 로드 시 데이터 가져오기 ───
  useEffect(() => {
    loadPersonas();
    // 크론 상태는 실제 API에서 가져와야 함 (여기서는 mock 데이터)
    setCronStatus({
      url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://biztask.kr"}/api/admin/npc-cron`,
      lastExecution: new Date(Date.now() - 3600000).toISOString(),
      lastResult: "Success: 15 actions completed (3 posts, 7 comments, 5 likes)",
      secretKey: "••••••••••••",
    });
  }, [loadPersonas]);

  // ─── 편집 상태 업데이트 ───
  const updateEditing = (
    personaId: string,
    field: keyof Persona,
    value: number | boolean
  ) => {
    setEditing((prev) => ({
      ...prev,
      [personaId]: {
        ...prev[personaId],
        [field]: value,
      },
    }));
  };

  // ─── 개별 페르소나 저장 ───
  const savePersona = async (personaId: string) => {
    setSaving(true);
    try {
      const data = editing[personaId];
      if (!data || Object.keys(data).length === 0) {
        alert("변경 사항이 없습니다.");
        return;
      }

      const { error } = await supabase
        .from("personas")
        .update(data)
        .eq("id", personaId);

      if (error) throw error;

      // 성공하면 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) => (p.id === personaId ? { ...p, ...data } : p))
      );

      // 편집 상태 제거
      setEditing((prev) => {
        const newEditing = { ...prev };
        delete newEditing[personaId];
        return newEditing;
      });

      alert("저장되었습니다.");
    } catch (error) {
      console.error("Failed to save persona:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 개별 NPC 1회 실행 ───
  const runSingleNPC = async (personaId: string) => {
    setExecutingPersonaId(personaId);
    try {
      const response = await fetch("/api/admin/npc-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`${personaId}가 실행되었습니다.`);
        // 데이터 새로고침
        await loadPersonas();
      } else {
        alert(`실행 실패: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to run NPC:", error);
      alert("실행 중 오류가 발생했습니다.");
    } finally {
      setExecutingPersonaId(null);
    }
  };

  // ─── 모든 NPC 1회 실행 (전체 실행) ───
  const runAllNPCs = async () => {
    if (
      !confirm(
        "모든 NPC를 1회 실행하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setExecutingAll(true);
    try {
      const response = await fetch("/api/admin/npc-cron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runAll: true }),
      });

      const result = await response.json();
      if (result.success) {
        alert(`모든 NPC가 실행되었습니다.`);
        // 데이터 새로고침
        await loadPersonas();
      } else {
        alert(`실행 실패: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to run all NPCs:", error);
      alert("실행 중 오류가 발생했습니다.");
    } finally {
      setExecutingAll(false);
    }
  };

  // ─── 일일 카운터 리셋 ───
  const resetDailyCounters = async () => {
    if (
      !confirm(
        "모든 NPC의 오늘 통계(글, 댓글, 좋아요)를 초기화하시겠습니까?"
      )
    ) {
      return;
    }

    setResettingCounters(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("personas")
        .update({
          today_posts: 0,
          today_comments: 0,
          today_likes: 0,
          today_reset_date: today,
        })
        .neq("id", null); // 모든 행 선택

      if (error) throw error;

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) => ({
          ...p,
          today_posts: 0,
          today_comments: 0,
          today_likes: 0,
          today_reset_date: today,
        }))
      );

      alert("일일 카운터가 초기화되었습니다.");
    } catch (error) {
      console.error("Failed to reset counters:", error);
      alert("초기화에 실패했습니다.");
    } finally {
      setResettingCounters(false);
    }
  };

  // ─── 댓글 폭격 모드 (모든 NPC의 댓글 빈도 x2) ───
  const applyBombMode = async () => {
    if (!confirm("모든 NPC의 댓글 빈도를 2배로 설정하시겠습니까?")) {
      return;
    }

    setSaving(true);
    try {
      const updates = personas.map((p) => ({
        id: p.id,
        comment_frequency: Math.min(p.comment_frequency * 2, 100), // max 100
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("personas")
          .update({ comment_frequency: update.comment_frequency })
          .eq("id", update.id);

        if (error) throw error;
      }

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) => ({
          ...p,
          comment_frequency: Math.min(p.comment_frequency * 2, 100),
        }))
      );

      alert("댓글 폭격 모드가 적용되었습니다.");
    } catch (error) {
      console.error("Failed to apply bomb mode:", error);
      alert("적용에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 조용 모드 (모든 NPC의 활동 빈도 /2) ───
  const applySilentMode = async () => {
    if (!confirm("모든 NPC의 활동 빈도를 1/2로 설정하시겠습니까?")) {
      return;
    }

    setSaving(true);
    try {
      const updates = personas.map((p) => ({
        id: p.id,
        post_frequency: Math.max(Math.floor(p.post_frequency / 2), 1),
        comment_frequency: Math.max(Math.floor(p.comment_frequency / 2), 0),
        like_frequency: Math.max(Math.floor(p.like_frequency / 2), 0),
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("personas")
          .update({
            post_frequency: update.post_frequency,
            comment_frequency: update.comment_frequency,
            like_frequency: update.like_frequency,
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) => ({
          ...p,
          post_frequency: Math.max(Math.floor(p.post_frequency / 2), 1),
          comment_frequency: Math.max(Math.floor(p.comment_frequency / 2), 0),
          like_frequency: Math.max(Math.floor(p.like_frequency / 2), 0),
        }))
      );

      alert("조용 모드가 적용되었습니다.");
    } catch (error) {
      console.error("Failed to apply silent mode:", error);
      alert("적용에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 기본값 복원 ───
  const restoreDefaults = async () => {
    if (!confirm("모든 NPC의 설정을 기본값으로 복원하시겠습니까?")) {
      return;
    }

    setSaving(true);
    try {
      const defaultSettings = {
        post_frequency: 3,
        comment_frequency: 5,
        like_frequency: 10,
        active_start_hour: 8,
        active_end_hour: 22,
      };

      const { error } = await supabase
        .from("personas")
        .update(defaultSettings)
        .neq("id", null); // 모든 행

      if (error) throw error;

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) => ({
          ...p,
          ...defaultSettings,
        }))
      );

      alert("기본값으로 복원되었습니다.");
    } catch (error) {
      console.error("Failed to restore defaults:", error);
      alert("복원에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 크론 URL 복사 ───
  const copyCronUrl = () => {
    if (!cronStatus) return;
    navigator.clipboard.writeText(cronStatus.url);
    setCopyFeedback("크론 URL이 복사되었습니다.");
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  // ─── 시간대 활동 가능 여부 판단 ───
  const isWithinActiveHours = (
    startHour: number,
    endHour: number,
    currentHour: number = new Date().getHours()
  ): boolean => {
    if (startHour <= endHour) {
      return currentHour >= startHour && currentHour < endHour;
    } else {
      // 자정을 넘는 경우 (예: 22:00 ~ 06:00)
      return currentHour >= startHour || currentHour < endHour;
    }
  };

  // ─── 일일 한도 도달 여부 판단 ───
  const hasReachedLimit = (
    today: number,
    frequency: number
  ): boolean => {
    return today >= frequency;
  };

  // ─── 로딩 상태 ───
  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── 통계 계산 ───
  const totalActivePeople = personas.filter((p) => p.is_active).length;
  const totalTodayPosts = personas.reduce((sum, p) => sum + p.today_posts, 0);
  const totalTodayComments = personas.reduce(
    (sum, p) => sum + p.today_comments,
    0
  );
  const totalTodayLikes = personas.reduce((sum, p) => sum + p.today_likes, 0);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. 대시보드 개요 (상단 섹션) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">
          대시보드 개요
        </h2>

        {/* 통계 카드 그리드 */}
        <div className="grid gap-4 md:grid-cols-4">
          {/* 활성 NPC 수 */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">활성 NPC</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalActivePeople}/{personas.length}
                </p>
              </div>
              <Power className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* 오늘 글 */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">오늘 게시글</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalTodayPosts}
                </p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </div>

          {/* 오늘 댓글 */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">오늘 댓글</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalTodayComments}
                </p>
              </div>
              <Volume2 className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          {/* 오늘 좋아요 */}
          <div className="rounded-xl border border-border-color bg-card-bg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">오늘 좋아요</p>
                <p className="text-2xl font-bold text-foreground">
                  {totalTodayLikes}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runAllNPCs}
            disabled={executingAll || saving || resettingCounters}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-black transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {executingAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            전체 실행
          </button>

          <button
            onClick={resetDailyCounters}
            disabled={executingAll || saving || resettingCounters}
            className="flex items-center gap-2 rounded-lg border border-border-color bg-card-bg px-4 py-2 font-medium text-foreground transition-colors hover:bg-hover-bg disabled:opacity-50"
          >
            {resettingCounters ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            일일 카운터 리셋
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. 빠른 프리셋 버튼 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">
          빠른 프리셋
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={applyBombMode}
            disabled={saving || executingAll || resettingCounters}
            className="flex items-center gap-2 rounded-lg border border-red-500 bg-red-500/10 px-4 py-2 font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            댓글 폭격 모드
          </button>

          <button
            onClick={applySilentMode}
            disabled={saving || executingAll || resettingCounters}
            className="flex items-center gap-2 rounded-lg border border-blue-500 bg-blue-500/10 px-4 py-2 font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
            조용 모드
          </button>

          <button
            onClick={restoreDefaults}
            disabled={saving || executingAll || resettingCounters}
            className="flex items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2 font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            기본 복원
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. NPC 컨트롤 테이블 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">
          NPC 활동 제어 ({personas.length}개)
        </h2>

        <div className="overflow-x-auto rounded-xl border border-border-color bg-card-bg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-color">
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  닉네임
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  활성
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  활동시간
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  일일 글
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  일일 댓글
                </th>
                <th className="px-4 py-3 text-left font-semibold text-foreground">
                  일일 좋아요
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  상태
                </th>
                <th className="px-4 py-3 text-center font-semibold text-foreground">
                  작업
                </th>
              </tr>
            </thead>
            <tbody>
              {personas.map((persona, index) => {
                const isEditing = !!editing[persona.id];
                const currentHour = new Date().getHours();
                const withinHours = isWithinActiveHours(
                  persona.active_start_hour,
                  persona.active_end_hour,
                  currentHour
                );
                const postReached = hasReachedLimit(
                  persona.today_posts,
                  persona.post_frequency
                );
                const commentReached = hasReachedLimit(
                  persona.today_comments,
                  persona.comment_frequency
                );
                const likeReached = hasReachedLimit(
                  persona.today_likes,
                  persona.like_frequency
                );
                const canActivityNow =
                  persona.is_active && withinHours && !postReached;

                return (
                  <tr
                    key={persona.id}
                    className={`border-b border-border-color transition-colors ${
                      index % 2 === 0 ? "bg-card-bg" : "bg-card-bg/50"
                    } hover:bg-hover-bg`}
                  >
                    {/* 닉네임 */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {persona.nickname}
                      </span>
                      <p className="text-xs text-muted">{persona.industry}</p>
                    </td>

                    {/* 활성 토글 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          updateEditing(
                            persona.id,
                            "is_active",
                            !persona.is_active
                          )
                        }
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                          editing[persona.id]?.is_active !== undefined
                            ? editing[persona.id]?.is_active
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                            : persona.is_active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {editing[persona.id]?.is_active !== undefined
                          ? editing[persona.id]?.is_active
                            ? "ON"
                            : "OFF"
                          : persona.is_active
                          ? "ON"
                          : "OFF"}
                      </button>
                    </td>

                    {/* 활동시간 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            editing[persona.id]?.active_start_hour ??
                            persona.active_start_hour
                          }
                          onChange={(e) =>
                            updateEditing(
                              persona.id,
                              "active_start_hour",
                              parseInt(e.target.value)
                            )
                          }
                          className="w-16 rounded border border-border-color bg-input-bg px-2 py-1 text-xs text-foreground"
                        >
                          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, "0")}:00
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-muted">~</span>
                        <select
                          value={
                            editing[persona.id]?.active_end_hour ??
                            persona.active_end_hour
                          }
                          onChange={(e) =>
                            updateEditing(
                              persona.id,
                              "active_end_hour",
                              parseInt(e.target.value)
                            )
                          }
                          className="w-16 rounded border border-border-color bg-input-bg px-2 py-1 text-xs text-foreground"
                        >
                          {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                            <option key={h} value={h}>
                              {String(h).padStart(2, "0")}:00
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    {/* 일일 글 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={
                            editing[persona.id]?.post_frequency ??
                            persona.post_frequency
                          }
                          onChange={(e) =>
                            updateEditing(
                              persona.id,
                              "post_frequency",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-14 rounded border border-border-color bg-input-bg px-2 py-1 text-center text-xs text-foreground"
                        />
                        <span className="text-xs text-muted">
                          {persona.today_posts}/
                          {editing[persona.id]?.post_frequency ??
                            persona.post_frequency}
                        </span>
                      </div>
                    </td>

                    {/* 일일 댓글 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={
                            editing[persona.id]?.comment_frequency ??
                            persona.comment_frequency
                          }
                          onChange={(e) =>
                            updateEditing(
                              persona.id,
                              "comment_frequency",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-14 rounded border border-border-color bg-input-bg px-2 py-1 text-center text-xs text-foreground"
                        />
                        <span className="text-xs text-muted">
                          {persona.today_comments}/
                          {editing[persona.id]?.comment_frequency ??
                            persona.comment_frequency}
                        </span>
                      </div>
                    </td>

                    {/* 일일 좋아요 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={
                            editing[persona.id]?.like_frequency ??
                            persona.like_frequency
                          }
                          onChange={(e) =>
                            updateEditing(
                              persona.id,
                              "like_frequency",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-14 rounded border border-border-color bg-input-bg px-2 py-1 text-center text-xs text-foreground"
                        />
                        <span className="text-xs text-muted">
                          {persona.today_likes}/
                          {editing[persona.id]?.like_frequency ??
                            persona.like_frequency}
                        </span>
                      </div>
                    </td>

                    {/* 상태 (현재 활동 가능 여부) */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {canActivityNow ? (
                          <div
                            className="flex items-center gap-1 rounded bg-green-500/20 px-2 py-1"
                            title="활동 가능: 활성화됨 + 시간대 OK + 한도 미달"
                          >
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs text-green-400">
                              활동가능
                            </span>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1"
                            title={`${!persona.is_active ? "비활성화됨" : ""} ${!withinHours ? "시간대 외" : ""} ${postReached ? "한도도달" : ""}`}
                          >
                            <AlertCircle className="h-3 w-3 text-red-400" />
                            <span className="text-xs text-red-400">불가능</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* 작업 버튼 */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => savePersona(persona.id)}
                              disabled={saving}
                              className="rounded bg-primary px-2 py-1 text-xs font-medium text-black transition-colors hover:bg-primary-hover disabled:opacity-50"
                              title="저장"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => {
                                setEditing((prev) => {
                                  const newEditing = { ...prev };
                                  delete newEditing[persona.id];
                                  return newEditing;
                                });
                              }}
                              className="rounded border border-border-color bg-card-bg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-hover-bg"
                              title="취소"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => runSingleNPC(persona.id)}
                            disabled={executingPersonaId === persona.id}
                            className="flex items-center gap-1 rounded border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                            title="이 NPC만 1회 실행"
                          >
                            {executingPersonaId === persona.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Play className="h-3 w-3" />
                            )}
                            실행
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 4. 크론 상태 섹션 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {cronStatus && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-foreground">
            크론 상태
          </h2>

          <div className="rounded-xl border border-border-color bg-card-bg p-4 space-y-4">
            {/* 크론 URL */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                크론 URL
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-border-color bg-input-bg px-3 py-2 text-xs text-muted break-all">
                  {cronStatus.url}
                </code>
                <button
                  onClick={copyCronUrl}
                  className="rounded border border-border-color bg-hover-bg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                  title="복사"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              {copyFeedback && (
                <p className="mt-1 text-xs text-green-400">{copyFeedback}</p>
              )}
            </div>

            {/* 마지막 실행 */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                마지막 실행
              </p>
              <div className="flex items-center gap-2 rounded border border-border-color bg-input-bg px-3 py-2 text-xs text-muted">
                <Clock className="h-4 w-4" />
                {cronStatus.lastExecution
                  ? new Date(cronStatus.lastExecution).toLocaleString("ko-KR")
                  : "아직 실행되지 않음"}
              </div>
            </div>

            {/* 마지막 결과 */}
            {cronStatus.lastResult && (
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  마지막 결과
                </p>
                <div className="rounded border border-border-color bg-input-bg px-3 py-2 text-xs text-muted">
                  {cronStatus.lastResult}
                </div>
              </div>
            )}

            {/* 시크릿 키 */}
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                시크릿 키
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-border-color bg-input-bg px-3 py-2 text-xs text-muted font-mono">
                  {showSecretKey
                    ? cronStatus.secretKey
                    : "•".repeat(cronStatus.secretKey.length)}
                </code>
                <button
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="rounded border border-border-color bg-hover-bg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/20 hover:text-primary"
                  title={showSecretKey ? "숨기기" : "표시"}
                >
                  {showSecretKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                외부 크론 서비스에서 API 요청할 때 이 키를 헤더에 포함하세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
