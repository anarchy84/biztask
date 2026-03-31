// 파일 위치: app/admin/npcs/page.tsx
// 용도: 40개 NPC 페르소나 관리 페이지
// 기능: 페르소나 목록 조회, 그룹별 분류, 인라인 편집, persona_config JSONB 수정
// VIP 가드: layout.tsx에서 통합 처리
// 디자인: 다크 테마 + 형광 그린 #73e346 활성 상태

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Loader2,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  MessageSquare,
  Zap,
} from "lucide-react";

// ─── 페르소나 타입 정의 ───
type PersonaConfig = {
  group?: string;
  background?: string;
  speech_style?: string;
  affinity?: number;
  keywords?: string[];
};

type Persona = {
  id: string;
  nickname: string;
  industry: string;
  personality: string;
  is_active: boolean;
  persona_config: PersonaConfig;
  total_posts: number;
  total_comments: number;
  today_posts: number;
  today_comments: number;
};

// ─── 그룹 정의 ───
const GROUPS = [
  "자영업/사업자",
  "테크/인사이트",
  "MZ/커뮤니티",
  "질문빌런/뉴비",
];

// ─── 인라인 편집 상태 타입 ───
type EditingState = {
  [personaId: string]: {
    config: PersonaConfig;
    isEditing: boolean;
  };
};

// ═══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════
export default function NPCsAdminPage() {
  // ─── 상태 관리 ───
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState>({});

  // ─── 그룹별로 정렬된 페르소나 조회 ───
  const fetchPersonas = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("personas")
        .select(
          "id, nickname, industry, personality, is_active, persona_config, total_posts, total_comments, today_posts, today_comments"
        )
        .order("nickname");

      if (error) throw error;

      // 그룹별로 정렬
      const sortedData = (data || []).sort((a, b) => {
        const groupOrder = GROUPS.indexOf(a.persona_config?.group || "") -
          GROUPS.indexOf(b.persona_config?.group || "");
        if (groupOrder !== 0) return groupOrder;
        return (a.nickname || "").localeCompare(b.nickname || "");
      });

      setPersonas(sortedData as Persona[]);
    } catch (error) {
      console.error("Failed to load personas:", error);
      alert("페르소나 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 초기 로드 ───
  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // ─── 편집 모드 시작 ───
  const startEditing = (persona: Persona) => {
    setEditing((prev) => ({
      ...prev,
      [persona.id]: {
        config: { ...persona.persona_config },
        isEditing: true,
      },
    }));
  };

  // ─── 편집 취소 ───
  const cancelEditing = (personaId: string) => {
    setEditing((prev) => {
      const newEditing = { ...prev };
      delete newEditing[personaId];
      return newEditing;
    });
  };

  // ─── 편집 필드 업데이트 ───
  const updateEditingField = (
    personaId: string,
    field: keyof PersonaConfig,
    value: string | number | string[]
  ) => {
    setEditing((prev) => ({
      ...prev,
      [personaId]: {
        ...prev[personaId],
        config: {
          ...prev[personaId]?.config,
          [field]: value,
        },
      },
    }));
  };

  // ─── 저장 처리 ───
  const handleSave = async (persona: Persona) => {
    if (!editing[persona.id]) return;

    setSaving(true);
    try {
      const updatedConfig = editing[persona.id].config;

      // keywords가 문자열이면 배열로 변환
      if (typeof updatedConfig.keywords === "string") {
        updatedConfig.keywords = updatedConfig.keywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k);
      }

      const { error } = await supabase
        .from("personas")
        .update({
          persona_config: updatedConfig,
        })
        .eq("id", persona.id);

      if (error) throw error;

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === persona.id
            ? { ...p, persona_config: updatedConfig }
            : p
        )
      );

      // 편집 모드 해제
      cancelEditing(persona.id);
      alert("저장되었습니다.");
    } catch (error) {
      console.error("Failed to save persona:", error);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 토글 is_active ───
  const handleToggleActive = async (persona: Persona) => {
    try {
      const { error } = await supabase
        .from("personas")
        .update({ is_active: !persona.is_active })
        .eq("id", persona.id);

      if (error) throw error;

      // 로컬 상태 업데이트
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === persona.id ? { ...p, is_active: !p.is_active } : p
        )
      );
    } catch (error) {
      console.error("Failed to toggle active:", error);
      alert("상태 변경에 실패했습니다.");
    }
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── 그룹별 페르소나 데이터 준비 ───
  const personasByGroup = GROUPS.reduce((acc, group) => {
    acc[group] = personas.filter(
      (p) => (p.persona_config?.group || "질문빌런/뉴비") === group
    );
    return acc;
  }, {} as Record<string, Persona[]>);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════ */}
      {/* 페이지 헤더 */}
      {/* ═══════════════════════════════════════════ */}
      <div>
        <h2 className="text-lg font-bold text-foreground">
          NPC 월드 관리
        </h2>
        <p className="mt-1 text-sm text-muted">
          40개 NPC 페르소나를 그룹별로 관리하고 설정을 커스터마이즈하세요.
          총 {personas.length}명
        </p>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 그룹별 NPC 카드 */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const groupPersonas = personasByGroup[group];
          const isExpanded = expandedGroup === group;

          return (
            <div key={group} className="space-y-3">
              {/* 그룹 헤더 (접기/펼치기) */}
              <button
                onClick={() =>
                  setExpandedGroup(isExpanded ? null : group)
                }
                className="flex w-full items-center gap-3 rounded-lg border border-border-color bg-secondary-bg px-4 py-3 text-left transition-colors hover:bg-tertiary-bg"
              >
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-primary" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted" />
                )}
                <span className="font-semibold text-foreground">{group}</span>
                <span className="ml-auto text-sm text-muted">
                  {groupPersonas.length}명
                </span>
              </button>

              {/* NPC 목록 (펼쳐진 경우) */}
              {isExpanded && (
                <div className="grid gap-3 pl-4">
                  {groupPersonas.map((persona) => {
                    const editState = editing[persona.id];
                    const isEditing = editState?.isEditing;
                    const config = editState?.config || persona.persona_config;

                    return (
                      <div
                        key={persona.id}
                        className="rounded-lg border border-border-color bg-secondary-bg p-4"
                      >
                        {/* 요약 뷰 (비편집 상태) */}
                        {!isEditing ? (
                          <div>
                            <div className="flex items-start justify-between gap-4">
                              {/* NPC 기본 정보 */}
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-foreground">
                                    {persona.nickname}
                                  </h3>
                                  <button
                                    onClick={() =>
                                      handleToggleActive(persona)
                                    }
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                                      persona.is_active
                                        ? "bg-green-900/30 text-green-400"
                                        : "bg-red-900/30 text-red-400"
                                    }`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        persona.is_active
                                          ? "bg-green-400"
                                          : "bg-red-400"
                                      }`}
                                    />
                                    {persona.is_active
                                      ? "활성"
                                      : "비활성"}
                                  </button>
                                </div>

                                <div className="flex flex-wrap gap-3 text-xs text-muted">
                                  <span>{persona.industry}</span>
                                  <span>{persona.personality}</span>
                                  {config?.affinity !== undefined && (
                                    <span className="text-primary">
                                      호감도: {config.affinity}%
                                    </span>
                                  )}
                                </div>

                                {config?.keywords &&
                                  config.keywords.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {config.keywords.slice(0, 3).map((kw) => (
                                        <span
                                          key={kw}
                                          className="rounded bg-primary/20 px-2 py-1 text-xs text-primary"
                                        >
                                          {kw}
                                        </span>
                                      ))}
                                      {config.keywords.length > 3 && (
                                        <span className="text-xs text-muted">
                                          +{config.keywords.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                              </div>

                              {/* 활동 통계 */}
                              <div className="flex gap-4 text-right text-sm">
                                <div>
                                  <div className="flex items-center gap-1 text-muted">
                                    <FileText className="h-4 w-4" />
                                    글
                                  </div>
                                  <div className="font-semibold text-foreground">
                                    {persona.total_posts}
                                    <span className="text-xs text-primary ml-1">
                                      (+{persona.today_posts})
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex items-center gap-1 text-muted">
                                    <MessageSquare className="h-4 w-4" />
                                    댓글
                                  </div>
                                  <div className="font-semibold text-foreground">
                                    {persona.total_comments}
                                    <span className="text-xs text-primary ml-1">
                                      (+{persona.today_comments})
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 편집 버튼 */}
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => startEditing(persona)}
                                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                              >
                                <Pencil className="h-4 w-4" />
                                편집
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 편집 뷰 */
                          <div className="space-y-4">
                            <h3 className="font-semibold text-foreground">
                              {persona.nickname} 설정 편집
                            </h3>

                            {/* 그룹 드롭다운 */}
                            <div>
                              <label className="block text-sm font-medium text-muted mb-1">
                                그룹
                              </label>
                              <select
                                value={config?.group || ""}
                                onChange={(e) =>
                                  updateEditingField(
                                    persona.id,
                                    "group",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-border-color bg-primary-bg px-3 py-2 text-foreground outline-none focus:border-primary"
                              >
                                <option value="">그룹 선택</option>
                                {GROUPS.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* 배경 textarea */}
                            <div>
                              <label className="block text-sm font-medium text-muted mb-1">
                                배경
                              </label>
                              <textarea
                                value={config?.background || ""}
                                onChange={(e) =>
                                  updateEditingField(
                                    persona.id,
                                    "background",
                                    e.target.value
                                  )
                                }
                                className="w-full h-20 rounded border border-border-color bg-primary-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
                                placeholder="NPC의 배경 스토리를 입력하세요..."
                              />
                            </div>

                            {/* 말투 textarea */}
                            <div>
                              <label className="block text-sm font-medium text-muted mb-1">
                                말투
                              </label>
                              <textarea
                                value={config?.speech_style || ""}
                                onChange={(e) =>
                                  updateEditingField(
                                    persona.id,
                                    "speech_style",
                                    e.target.value
                                  )
                                }
                                className="w-full h-20 rounded border border-border-color bg-primary-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary resize-none"
                                placeholder="NPC의 말투 특징을 입력하세요..."
                              />
                            </div>

                            {/* 호감도 슬라이더 */}
                            <div>
                              <label className="block text-sm font-medium text-muted mb-2">
                                호감도 ({config?.affinity || 0}%)
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={config?.affinity || 0}
                                onChange={(e) =>
                                  updateEditingField(
                                    persona.id,
                                    "affinity",
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                className="w-full cursor-pointer accent-primary"
                              />
                            </div>

                            {/* 키워드 입력 */}
                            <div>
                              <label className="block text-sm font-medium text-muted mb-1">
                                키워드 (쉼표로 구분)
                              </label>
                              <input
                                type="text"
                                value={
                                  Array.isArray(config?.keywords)
                                    ? config.keywords.join(", ")
                                    : ""
                                }
                                onChange={(e) =>
                                  updateEditingField(
                                    persona.id,
                                    "keywords",
                                    e.target.value
                                  )
                                }
                                className="w-full rounded border border-border-color bg-primary-bg px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                                placeholder="예: 마케팅, 성장, 실험"
                              />
                            </div>

                            {/* 저장/취소 버튼 */}
                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                onClick={() => cancelEditing(persona.id)}
                                className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-tertiary-bg"
                              >
                                <X className="h-4 w-4" />
                                취소
                              </button>
                              <button
                                onClick={() => handleSave(persona)}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-primary/90 disabled:opacity-50"
                              >
                                <Save className="h-4 w-4" />
                                {saving ? "저장 중..." : "저장"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 더미 아이콘 컴포넌트 (lucide-react에 없는 경우) ───
function FileText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </svg>
  );
}
