// 파일 위치: app/admin/personas/page.tsx
// 용도: AI 페르소나(NPC) 관리 페이지
// 기능: 페르소나 목록 조회, 생성, 수정, AUTO/MANUAL 토글
// VIP 가드: layout.tsx에서 통합 처리 (이 파일에서는 불필요)
// 프로젝트: 그릿(Grit) 콜드스타트 해결용 AI NPC 시스템
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Loader2,
  Plus,
  Bot,
  Zap,
  Pause,
  Pencil,
  Trash2,
  X,
  Activity,
  MessageSquare,
  FileText,
  Clock,
  Save,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── 페르소나 타입 정의 ───
type Persona = {
  id: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  industry: string;
  personality: string;
  bio: string | null;
  mode: "AUTO" | "MANUAL";
  frequency: number;
  prompt: string | null;
  total_posts: number;
  total_comments: number;
  last_active_at: string | null;
  is_active: boolean;
  created_at: string;
};

// ─── 업종 프리셋 목록 ───
const INDUSTRY_PRESETS = [
  "마케팅", "IT/개발", "디자인", "요식업", "쇼핑몰",
  "부동산", "교육", "금융", "제조업", "프리랜서", "스타트업", "기타",
];

// ─── 성격/말투 프리셋 목록 ───
const PERSONALITY_PRESETS = [
  "친근한", "전문적인", "유머러스한", "열정적인", "차분한",
  "실용적인", "도전적인", "공감형", "분석적인", "직설적인",
];

// ─── 빈 폼 초기값 ───
const EMPTY_FORM = {
  nickname: "",
  avatar_url: "",
  industry: "마케팅",
  personality: "친근한",
  bio: "",
  mode: "MANUAL" as "AUTO" | "MANUAL",
  frequency: 3,
  prompt: "",
};

// ═══════════════════════════════════════════════════════
// 메인 컴포넌트
// VIP 가드는 layout.tsx에서 처리하므로 여기선 데이터만 관리
// ═══════════════════════════════════════════════════════
export default function PersonasAdminPage() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);

  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null이면 새로 생성
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── 페르소나 목록 불러오기 ───
  const fetchPersonas = useCallback(async () => {
    const { data } = await supabase
      .from("personas")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setPersonas(data as Persona[]);
  }, []);

  // ─── 초기 데이터 로딩 (VIP 체크는 layout.tsx에서 완료) ───
  useEffect(() => {
    const init = async () => {
      // 유저 정보만 가져옴 (페르소나 생성 시 user_id 필요)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUser(session.user);

      await fetchPersonas();
      setLoading(false);
    };

    init();
  }, [fetchPersonas]);

  // ─── AUTO/MANUAL 토글 ───
  // 목록에서 즉시 모드를 전환하는 핵심 기능
  const handleToggleMode = async (persona: Persona) => {
    const newMode = persona.mode === "AUTO" ? "MANUAL" : "AUTO";

    // 낙관적 업데이트: UI를 먼저 변경하고 DB는 백그라운드에서 처리
    setPersonas((prev) =>
      prev.map((p) => (p.id === persona.id ? { ...p, mode: newMode } : p))
    );

    const { error } = await supabase
      .from("personas")
      .update({ mode: newMode })
      .eq("id", persona.id);

    if (error) {
      // 실패 시 원복
      setPersonas((prev) =>
        prev.map((p) => (p.id === persona.id ? { ...p, mode: persona.mode } : p))
      );
      alert("모드 변경 실패: " + error.message);
    }
  };

  // ─── 모달 열기: 새 페르소나 생성 ───
  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  // ─── 모달 열기: 기존 페르소나 수정 ───
  const openEditModal = (persona: Persona) => {
    setEditingId(persona.id);
    setForm({
      nickname: persona.nickname,
      avatar_url: persona.avatar_url || "",
      industry: persona.industry,
      personality: persona.personality,
      bio: persona.bio || "",
      mode: persona.mode,
      frequency: persona.frequency,
      prompt: persona.prompt || "",
    });
    setShowModal(true);
  };

  // ─── 모달 닫기 ───
  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ─── 저장 (생성 또는 수정) ───
  const handleSave = async () => {
    if (!form.nickname.trim() || !user) return;
    setSaving(true);

    const payload = {
      nickname: form.nickname.trim(),
      avatar_url: form.avatar_url.trim() || null,
      industry: form.industry,
      personality: form.personality,
      bio: form.bio.trim() || null,
      mode: form.mode,
      frequency: form.frequency,
      prompt: form.prompt.trim() || null,
    };

    if (editingId) {
      // 수정
      const { error } = await supabase
        .from("personas")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        alert("수정 실패: " + error.message);
      } else {
        await fetchPersonas();
        closeModal();
      }
    } else {
      // 새로 생성 (user_id 포함)
      const { error } = await supabase
        .from("personas")
        .insert({ ...payload, user_id: user.id });

      if (error) {
        alert("생성 실패: " + error.message);
      } else {
        await fetchPersonas();
        closeModal();
      }
    }

    setSaving(false);
  };

  // ─── 삭제 ───
  const handleDelete = async (persona: Persona) => {
    if (!confirm(`'${persona.nickname}' 페르소나를 삭제하시겠습니까?`)) return;

    const { error } = await supabase
      .from("personas")
      .delete()
      .eq("id", persona.id);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      await fetchPersonas();
    }
  };

  // ─── 로딩 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // 통계 계산
  const autoCount = personas.filter((p) => p.mode === "AUTO").length;
  const manualCount = personas.filter((p) => p.mode === "MANUAL").length;

  return (
    <div>
      {/* ═══════════════════════════════════════════ */}
      {/* 페이지 서브헤더 + 생성 버튼                    */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Bot className="h-5 w-5 text-primary" />
            AI 페르소나 관리
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            커뮤니티를 활성화할 AI NPC를 관리합니다.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          새 페르소나
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 통계 카드                                    */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border-color bg-card-bg p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{personas.length}</p>
          <p className="text-xs text-muted">전체</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{autoCount}</p>
          <p className="text-xs text-muted">AUTO 가동 중</p>
        </div>
        <div className="rounded-xl border border-border-color bg-card-bg p-4 text-center">
          <p className="text-2xl font-bold text-muted">{manualCount}</p>
          <p className="text-xs text-muted">MANUAL 대기</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 페르소나 목록                                 */}
      {/* ═══════════════════════════════════════════ */}
      {personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
          <Bot className="mb-4 h-12 w-12 text-muted" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">
            아직 페르소나가 없습니다
          </h3>
          <p className="mb-6 text-sm text-muted">
            첫 번째 AI NPC를 만들어 커뮤니티를 활성화하세요!
          </p>
          <button
            onClick={openCreateModal}
            className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-black hover:bg-primary-hover transition-colors"
          >
            페르소나 만들기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="rounded-xl border border-border-color bg-card-bg p-4 transition-colors hover:border-primary/20"
            >
              <div className="flex items-start gap-4">
                {/* 아바타 */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">
                  {persona.avatar_url ? (
                    <img src={persona.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    persona.nickname.charAt(0)
                  )}
                </div>

                {/* 정보 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">{persona.nickname}</h3>
                    <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                      {persona.industry}
                    </span>
                    <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                      {persona.personality}
                    </span>
                  </div>

                  {persona.bio && (
                    <p className="mt-1 text-xs text-muted line-clamp-1">{persona.bio}</p>
                  )}

                  {/* 통계 */}
                  <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      글 {persona.total_posts}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      댓글 {persona.total_comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      일 {persona.frequency}회 목표
                    </span>
                    {persona.last_active_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(persona.last_active_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>

                {/* 우측: 토글 + 액션 버튼 */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* AUTO/MANUAL 토글 스위치 */}
                  <button
                    onClick={() => handleToggleMode(persona)}
                    className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      persona.mode === "AUTO"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                        : "bg-gray-500/15 text-muted border border-border-color hover:bg-gray-500/25"
                    }`}
                  >
                    {persona.mode === "AUTO" ? (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        AUTO
                      </>
                    ) : (
                      <>
                        <Pause className="h-3.5 w-3.5" />
                        MANUAL
                      </>
                    )}
                  </button>

                  {/* 수정 */}
                  <button
                    onClick={() => openEditModal(persona)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-hover-bg hover:text-foreground"
                    title="수정"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>

                  {/* 삭제 */}
                  <button
                    onClick={() => handleDelete(persona)}
                    className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 페르소나 생성/수정 모달                        */}
      {/* ═══════════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border-color bg-card-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 rounded-full p-1 text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* 모달 헤더 */}
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Bot className="h-5 w-5 text-primary" />
              {editingId ? "페르소나 수정" : "새 페르소나 생성"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              AI NPC의 성격과 행동 패턴을 설정합니다.
            </p>

            {/* ─── 닉네임 ─── */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                닉네임 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                placeholder="예: 마케팅김대리"
                maxLength={20}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* ─── 아바타 URL ─── */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                프로필 이미지 URL <span className="text-muted">(선택)</span>
              </label>
              <input
                type="url"
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* ─── 업종 ─── */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                업종 <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRY_PRESETS.map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => setForm({ ...form, industry: ind })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.industry === ind
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "bg-hover-bg text-muted border border-border-color hover:text-foreground"
                    }`}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── 성격/말투 ─── */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                성격/말투 <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PERSONALITY_PRESETS.map((pers) => (
                  <button
                    key={pers}
                    type="button"
                    onClick={() => setForm({ ...form, personality: pers })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.personality === pers
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                        : "bg-hover-bg text-muted border border-border-color hover:text-foreground"
                    }`}
                  >
                    {pers}
                  </button>
                ))}
              </div>
            </div>

            {/* ─── 자기소개 ─── */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                자기소개 한 줄 <span className="text-muted">(선택)</span>
              </label>
              <input
                type="text"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="예: 10년차 마케터, 퍼포먼스 마케팅 전문"
                maxLength={100}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* ─── 동작 모드 + 빈도 (나란히) ─── */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {/* 모드 선택 */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  동작 모드
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mode: "AUTO" })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
                      form.mode === "AUTO"
                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                        : "bg-hover-bg text-muted border border-border-color"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    AUTO
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, mode: "MANUAL" })}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
                      form.mode === "MANUAL"
                        ? "bg-gray-500/20 text-foreground border border-border-color"
                        : "bg-hover-bg text-muted border border-border-color"
                    }`}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    MANUAL
                  </button>
                </div>
              </div>

              {/* 일일 활동 빈도 */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  일일 활동 목표 <span className="text-primary font-bold">{form.frequency}회</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: Number(e.target.value) })}
                  className="mt-2 w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>1회</span>
                  <span>20회</span>
                </div>
              </div>
            </div>

            {/* ─── AI 프롬프트 (핵심!) ─── */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                AI 커스텀 프롬프트 <span className="text-muted">(Claude에게 전달되는 지시문)</span>
              </label>
              <textarea
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder={`예: 당신은 마케팅 업계 10년차 실무자입니다.\n- 실전 경험을 기반으로 답변해주세요\n- 친근하지만 전문적인 톤을 유지하세요\n- 구체적인 사례와 수치를 곁들여 설명하세요`}
                rows={5}
                maxLength={2000}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="mt-1 text-right text-[10px] text-muted">
                {(form.prompt || "").length}/2000
              </p>
            </div>

            {/* ─── 액션 버튼 ─── */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!form.nickname.trim() || saving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 중...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Save className="h-4 w-4" />
                    {editingId ? "수정 완료" : "생성하기"}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
