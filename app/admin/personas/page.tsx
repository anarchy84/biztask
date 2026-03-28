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
  Heart,
  PenLine,
  Drama,
  Rocket,
  Key,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ThumbsUp,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useImpersonation } from "@/app/context/ImpersonationContext";
import type { ImpersonatedPersona } from "@/app/context/ImpersonationContext";

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
  frequency: number;               // 레거시 (하위호환)
  post_frequency: number;          // 일일 게시글 목표 (1~20)
  comment_frequency: number;       // 일일 댓글 목표 (0~50)
  like_frequency: number;          // 일일 좋아요 목표 (0~100)
  prompt: string | null;
  total_posts: number;
  total_comments: number;
  total_likes: number;             // 누적 좋아요 수
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

// ─── 시뮬레이션 결과 타입 ───
type SimActionResult = {
  action: string;
  persona: string;
  success: boolean;
  detail: string;
  error?: string;
};

type SimResult = {
  success: boolean;
  summary?: {
    총액션: number;
    성공: number;
    실패: number;
    글쓰기: number;
    댓글: number;
    추천: number;
    AI사용: boolean;
  };
  results?: SimActionResult[];
  error?: string;
};

// ─── 빈 폼 초기값 ───
const EMPTY_FORM = {
  nickname: "",
  avatar_url: "",
  industry: "마케팅",
  personality: "친근한",
  bio: "",
  mode: "MANUAL" as "AUTO" | "MANUAL",
  post_frequency: 2,       // 일일 게시글 목표 (기본 2회)
  comment_frequency: 5,    // 일일 댓글 목표 (기본 5회)
  like_frequency: 10,      // 일일 좋아요 목표 (기본 10회)
  prompt: "",
};

// ═══════════════════════════════════════════════════════
// 메인 컴포넌트
// VIP 가드는 layout.tsx에서 처리하므로 여기선 데이터만 관리
// ═══════════════════════════════════════════════════════
export default function PersonasAdminPage() {
  // ─── 빙의(Impersonation) 전역 상태 ───
  const { impersonating, startImpersonation, stopImpersonation, isImpersonating } = useImpersonation();

  // ─── 상태 관리 ───
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [personas, setPersonas] = useState<Persona[]>([]);

  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null이면 새로 생성
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── 군단 활동 시뮬레이션 상태 ───
  const [simOpen, setSimOpen] = useState(false);           // 시뮬레이션 패널 열기/닫기
  const [simApiKey, setSimApiKey] = useState("");           // Anthropic API 키 (어드민 입력)
  const [simActions, setSimActions] = useState(5);          // 수행할 액션 수
  const [simRunning, setSimRunning] = useState(false);      // 실행 중 여부
  const [simResults, setSimResults] = useState<SimResult | null>(null); // 실행 결과

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
      post_frequency: persona.post_frequency ?? persona.frequency ?? 2,
      comment_frequency: persona.comment_frequency ?? 5,
      like_frequency: persona.like_frequency ?? 10,
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
      post_frequency: form.post_frequency,
      comment_frequency: form.comment_frequency,
      like_frequency: form.like_frequency,
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

  // ─── 빙의하기/복귀하기 핸들러 ───
  const handleImpersonate = (persona: Persona) => {
    // 이미 같은 페르소나로 빙의 중이면 해제
    if (impersonating?.id === persona.id) {
      stopImpersonation();
      return;
    }
    // 빙의에 필요한 최소 정보만 전달
    const impersonateData: ImpersonatedPersona = {
      id: persona.id,
      user_id: persona.user_id,
      nickname: persona.nickname,
      avatar_url: persona.avatar_url,
      industry: persona.industry,
      personality: persona.personality,
    };
    startImpersonation(impersonateData);
  };

  // ─── 군단 활동 시뮬레이션 실행 ───
  const handleRunSimulation = async () => {
    setSimRunning(true);
    setSimResults(null);

    try {
      const res = await fetch("/api/admin/test-interaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actions: simActions,
          anthropicApiKey: simApiKey.trim(),
          anakiUserId: user?.id || "",  // 현재 로그인한 VIP = 아나키
        }),
      });

      const data = await res.json();
      setSimResults(data as SimResult);

      // 성공 시 페르소나 목록 새로고침 (통계가 변경되었을 수 있음)
      if (data.success) {
        await fetchPersonas();
      }
    } catch (err) {
      setSimResults({
        success: false,
        error: err instanceof Error ? err.message : "네트워크 오류가 발생했습니다.",
      });
    } finally {
      setSimRunning(false);
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
      {/* 🚀 군단 활동 시뮬레이션 패널                      */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 rounded-xl border border-orange-500/20 bg-gradient-to-r from-orange-500/5 via-card-bg to-red-500/5 overflow-hidden">
        {/* 토글 헤더 */}
        <button
          onClick={() => setSimOpen(!simOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-orange-500/5"
        >
          <div className="flex items-center gap-2.5">
            <Rocket className="h-5 w-5 text-orange-400" />
            <span className="text-sm font-bold text-foreground">군단 활동 시뮬레이션</span>
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              NPC {personas.filter(p => p.is_active).length}명 대기
            </span>
          </div>
          {simOpen ? (
            <ChevronUp className="h-4 w-4 text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted" />
          )}
        </button>

        {/* 펼쳐지는 내용 */}
        {simOpen && (
          <div className="border-t border-orange-500/10 px-4 py-4 space-y-4">
            {/* API 키 입력 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                <Key className="h-3 w-3 text-amber-400" />
                Anthropic API Key <span className="text-muted font-normal">(선택 — 없으면 템플릿 모드)</span>
              </label>
              <input
                type="password"
                value={simApiKey}
                onChange={(e) => setSimApiKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2 text-sm text-foreground placeholder-muted focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
              />
              <p className="mt-1 text-[10px] text-muted">
                {simApiKey ? "✅ AI 모드 (Claude가 자연스러운 텍스트 생성)" : "📝 템플릿 모드 (미리 정의된 텍스트 사용)"}
              </p>
            </div>

            {/* 액션 수 조절 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  실행할 액션 수
                </label>
                <span className="text-sm font-bold text-orange-400">{simActions}개</span>
              </div>
              <input
                type="range"
                min={3}
                max={20}
                value={simActions}
                onChange={(e) => setSimActions(Number(e.target.value))}
                className="w-full accent-orange-400"
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>3개 (가볍게)</span>
                <span>20개 (풀 파워)</span>
              </div>
              <p className="mt-1 text-[10px] text-muted">
                ≈ 글쓰기 {Math.max(1, Math.round(simActions * 0.3))}개 + 댓글 {Math.max(1, Math.round(simActions * 0.4))}개 + 추천 {Math.max(1, simActions - Math.max(1, Math.round(simActions * 0.3)) - Math.max(1, Math.round(simActions * 0.4)))}개
              </p>
            </div>

            {/* 실행 버튼 */}
            <button
              onClick={handleRunSimulation}
              disabled={simRunning || personas.filter(p => p.is_active).length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 text-sm font-bold text-white transition-all hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
            >
              {simRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  NPC 군단 활동 중...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4" />
                  🚀 군단 활동 시뮬레이션 시작
                </>
              )}
            </button>

            {/* 결과 표시 영역 */}
            {simResults && (
              <div className="mt-3 rounded-lg border border-border-color bg-card-bg p-4">
                {simResults.success ? (
                  <>
                    {/* 요약 통계 */}
                    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      <div className="rounded-lg bg-green-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-green-400">{simResults.summary?.성공}</p>
                        <p className="text-[10px] text-muted">성공</p>
                      </div>
                      <div className="rounded-lg bg-red-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-red-400">{simResults.summary?.실패}</p>
                        <p className="text-[10px] text-muted">실패</p>
                      </div>
                      <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-blue-400">{simResults.summary?.글쓰기}</p>
                        <p className="text-[10px] text-muted">글쓰기</p>
                      </div>
                      <div className="rounded-lg bg-cyan-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-cyan-400">{simResults.summary?.댓글}</p>
                        <p className="text-[10px] text-muted">댓글</p>
                      </div>
                      <div className="rounded-lg bg-pink-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-pink-400">{simResults.summary?.추천}</p>
                        <p className="text-[10px] text-muted">추천</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                        <p className="text-lg font-bold text-amber-400">{simResults.summary?.AI사용 ? "AI" : "TPL"}</p>
                        <p className="text-[10px] text-muted">모드</p>
                      </div>
                    </div>

                    {/* 상세 로그 */}
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {simResults.results?.map((r, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                            r.success ? "bg-green-500/5" : "bg-red-500/5"
                          }`}
                        >
                          {r.success ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" />
                          ) : (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                          )}
                          <div className="min-w-0">
                            <span className={`font-bold ${
                              r.action === "post" ? "text-blue-400" :
                              r.action === "comment" ? "text-cyan-400" : "text-pink-400"
                            }`}>
                              {r.action === "post" ? "📝" : r.action === "comment" ? "💬" : "👍"} {r.persona}
                            </span>
                            <span className="ml-1.5 text-muted">{r.detail}</span>
                            {r.error && (
                              <p className="mt-0.5 text-red-400/80">⚠️ {r.error}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <XCircle className="h-5 w-5" />
                    <span className="text-sm font-bold">시뮬레이션 실패: {simResults.error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 빙의 상태 알림 배너 (빙의 중일 때만 표시)         */}
      {/* ═══════════════════════════════════════════ */}
      {isImpersonating && impersonating && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-sm font-bold text-amber-300">
              {impersonating.avatar_url ? (
                <img src={impersonating.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                impersonating.nickname.charAt(0)
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-amber-300">
                🎭 &apos;{impersonating.nickname}&apos;으로 빙의 중
              </p>
              <p className="text-[11px] text-amber-400/60">
                이 상태에서 글/댓글을 작성하면 해당 NPC 명의로 게시됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={stopImpersonation}
            className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/25"
          >
            복귀하기
          </button>
        </div>
      )}

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

                  {/* 누적 통계 */}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      글 {persona.total_posts}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      댓글 {persona.total_comments}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      좋아요 {persona.total_likes ?? 0}
                    </span>
                    <span className="text-border-color">|</span>
                    {/* 일일 빈도 목표 */}
                    <span className="flex items-center gap-1 text-primary/70">
                      <Activity className="h-3 w-3" />
                      일 {persona.post_frequency ?? persona.frequency}글 / {persona.comment_frequency ?? 5}댓 / {persona.like_frequency ?? 10}좋
                    </span>
                    {persona.last_active_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(persona.last_active_at).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                  </div>
                </div>

                {/* 우측: 빙의 + 토글 + 액션 버튼 */}
                <div className="flex shrink-0 items-center gap-2">
                  {/* 🎭 빙의하기 버튼 — 이 NPC로 글/댓글 작성 모드 진입 */}
                  <button
                    onClick={() => handleImpersonate(persona)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                      impersonating?.id === persona.id
                        ? "bg-amber-500/25 text-amber-300 border border-amber-500/40 hover:bg-amber-500/35 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        : "bg-amber-500/10 text-amber-400/70 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300"
                    }`}
                    title={impersonating?.id === persona.id ? "빙의 해제" : `'${persona.nickname}'으로 빙의`}
                  >
                    <Drama className="h-3.5 w-3.5" />
                    {impersonating?.id === persona.id ? "빙의 중" : "빙의하기"}
                  </button>

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

            {/* ─── 동작 모드 ─── */}
            <div className="mt-4">
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

            {/* ─── 인게이지먼트 빈도 설정 (3개 슬라이더) ─── */}
            <div className="mt-4 rounded-lg border border-border-color bg-hover-bg/30 p-4">
              <label className="block text-xs font-semibold text-foreground mb-3">
                일일 활동 목표 설정
              </label>

              {/* 게시글 빈도 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <PenLine className="h-3 w-3 text-blue-400" />
                    게시글 작성
                  </span>
                  <span className="text-xs font-bold text-blue-400">{form.post_frequency}회/일</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={form.post_frequency}
                  onChange={(e) => setForm({ ...form, post_frequency: Number(e.target.value) })}
                  className="w-full accent-blue-400"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>1회</span>
                  <span>20회</span>
                </div>
              </div>

              {/* 댓글 빈도 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <MessageSquare className="h-3 w-3 text-cyan-400" />
                    댓글 작성
                  </span>
                  <span className="text-xs font-bold text-cyan-400">{form.comment_frequency}회/일</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={form.comment_frequency}
                  onChange={(e) => setForm({ ...form, comment_frequency: Number(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>0 (안 함)</span>
                  <span>50회</span>
                </div>
              </div>

              {/* 좋아요 빈도 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Heart className="h-3 w-3 text-pink-400" />
                    좋아요
                  </span>
                  <span className="text-xs font-bold text-pink-400">{form.like_frequency}회/일</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.like_frequency}
                  onChange={(e) => setForm({ ...form, like_frequency: Number(e.target.value) })}
                  className="w-full accent-pink-400"
                />
                <div className="flex justify-between text-[10px] text-muted">
                  <span>0 (안 함)</span>
                  <span>100회</span>
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
