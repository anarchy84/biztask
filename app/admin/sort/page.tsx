// 파일 위치: app/admin/sort/page.tsx
// 용도: 커뮤니티 & 카테고리 순서를 드래그 앤 드롭으로 변경
// VIP 가드: layout.tsx에서 통합 처리 (이 파일에서는 불필요)
// 라이브러리: @dnd-kit (core + sortable + utilities)
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  Loader2,
  Save,
  GripVertical,
  Users,
  Hash,
  CheckCircle2,
} from "lucide-react";

// ─── dnd-kit 임포트 ───
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── 타입 정의 ───
type Community = {
  id: string;
  name: string;
  slug: string | null;
  member_count: number;
  sort_order: number;
};

type Category = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

// ═══════════════════════════════════════════════════════
// 드래그 가능한 커뮤니티 아이템 컴포넌트
// ═══════════════════════════════════════════════════════
function SortableCommunityItem({ community, index }: { community: Community; index: number }) {
  // useSortable 훅: 이 아이템을 드래그 가능하게 만들어줌
  const {
    attributes,    // 접근성 관련 속성 (aria 등)
    listeners,     // 드래그 이벤트 리스너 (마우스/터치)
    setNodeRef,    // 이 DOM 요소를 dnd-kit에 등록
    transform,     // 드래그 중 이동 거리 (x, y)
    transition,    // 부드러운 전환 애니메이션
    isDragging,    // 현재 이 아이템이 드래그 중인지 여부
  } = useSortable({ id: community.id });

  // 드래그 중 위치 이동을 CSS transform으로 표현
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        isDragging
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
          : "border-border-color bg-card-bg hover:bg-hover-bg"
      }`}
    >
      {/* 드래그 핸들 (GripVertical 아이콘) */}
      <button
        className="cursor-grab touch-none text-muted hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* 순서 번호 */}
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {index + 1}
      </span>

      {/* 커뮤니티 아이콘 */}
      <Users className="h-4 w-4 shrink-0 text-primary/60" />

      {/* 커뮤니티 이름 */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {community.name}
        </span>
        <span className="text-[10px] text-muted">
          {community.slug || "slug 없음"} · {community.member_count}명
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 드래그 가능한 카테고리 아이템 컴포넌트
// ═══════════════════════════════════════════════════════
function SortableCategoryItem({ category, index }: { category: Category; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
        isDragging
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
          : "border-border-color bg-card-bg hover:bg-hover-bg"
      }`}
    >
      {/* 드래그 핸들 */}
      <button
        className="cursor-grab touch-none text-muted hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* 순서 번호 */}
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {index + 1}
      </span>

      {/* 카테고리 색상 점 */}
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: category.color }}
      />

      {/* 카테고리 이름 */}
      <span className="text-sm font-medium text-foreground">{category.name}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// 메인 관리 페이지 컴포넌트
// VIP 가드는 layout.tsx에서 처리하므로 여기선 데이터만 관리
// ═══════════════════════════════════════════════════════
export default function AdminSortPage() {
  // ─── 상태 관리 ───
  const [loading, setLoading] = useState(true);

  // 커뮤니티 & 카테고리 목록 (드래그로 순서 변경됨)
  const [communities, setCommunities] = useState<Community[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // 저장 상태
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── dnd-kit 센서 설정 ───
  // PointerSensor: 마우스/터치 드래그
  // KeyboardSensor: 키보드로도 순서 변경 가능 (접근성)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px 이상 움직여야 드래그 시작 (클릭과 구분)
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ─── 데이터 불러오기 ───
  const fetchData = useCallback(async () => {
    // 커뮤니티: sort_order 순으로 조회
    const { data: comData } = await supabase
      .from("communities")
      .select("id, name, slug, member_count, sort_order")
      .order("sort_order", { ascending: true });

    if (comData) setCommunities(comData as Community[]);

    // 카테고리: sort_order 순으로 조회
    const { data: catData } = await supabase
      .from("categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true });

    if (catData) setCategories(catData as Category[]);
  }, []);

  // ─── 초기 데이터 로딩 (VIP 체크는 layout.tsx에서 완료) ───
  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  // ─── 커뮤니티 드래그 종료 핸들러 ───
  // 드래그가 끝나면 배열 순서를 바꿔서 화면에 즉시 반영
  const handleCommunityDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCommunities((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });

    // 저장 성공 표시 초기화 (순서 변경했으니 다시 저장 필요)
    setSaveSuccess(false);
  };

  // ─── 카테고리 드래그 종료 핸들러 ───
  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setCategories((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });

    setSaveSuccess(false);
  };

  // ─── 순서 일괄 저장 ───
  // 변경된 커뮤니티 + 카테고리의 sort_order를 DB에 한 번에 업데이트
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      // 커뮤니티 sort_order 업데이트 (배열 인덱스 + 1 = 새 순서)
      const communityUpdates = communities.map((com, idx) =>
        supabase
          .from("communities")
          .update({ sort_order: idx + 1 })
          .eq("id", com.id)
      );

      // 카테고리 sort_order 업데이트
      const categoryUpdates = categories.map((cat, idx) =>
        supabase
          .from("categories")
          .update({ sort_order: idx + 1 })
          .eq("id", cat.id)
      );

      // 모든 업데이트를 동시에 실행 (병렬 처리로 빠르게)
      await Promise.all([...communityUpdates, ...categoryUpdates]);

      setSaveSuccess(true);
      // 3초 후 성공 표시 자동 제거
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("[순서 저장] 에러:", err);
      alert("순서 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* ═══════════════════════════════════════════ */}
      {/* 페이지 서브헤더 + 저장 버튼                    */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            사이드바 순서 관리
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            항목을 드래그하여 사이드바 표시 순서를 변경하세요.
          </p>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSaveAll}
          disabled={saving}
          className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            saveSuccess
              ? "bg-green-600 text-white"
              : "bg-primary text-black hover:bg-primary-hover"
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              저장 완료!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              순서 저장
            </>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 카테고리 순서 변경                            */}
      {/* ═══════════════════════════════════════════ */}
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Hash className="h-4 w-4 text-muted" />
          카테고리 순서
          <span className="text-xs font-normal text-muted">({categories.length}개)</span>
        </h3>

        {categories.length === 0 ? (
          <p className="rounded-lg border border-border-color bg-card-bg px-4 py-8 text-center text-sm text-muted">
            등록된 카테고리가 없습니다.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {categories.map((cat, idx) => (
                  <SortableCategoryItem key={cat.id} category={cat} index={idx} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* 커뮤니티 순서 변경                            */}
      {/* ═══════════════════════════════════════════ */}
      <section className="mb-8">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-primary/60" />
          커뮤니티 순서
          <span className="text-xs font-normal text-muted">({communities.length}개)</span>
        </h3>

        {communities.length === 0 ? (
          <p className="rounded-lg border border-border-color bg-card-bg px-4 py-8 text-center text-sm text-muted">
            등록된 커뮤니티가 없습니다.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCommunityDragEnd}
          >
            <SortableContext
              items={communities.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {communities.map((com, idx) => (
                  <SortableCommunityItem key={com.id} community={com} index={idx} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </section>

      {/* 안내 문구 */}
      <div className="rounded-lg border border-border-color bg-card-bg p-4 text-xs leading-relaxed text-muted">
        <p className="font-semibold text-foreground mb-1">사용법</p>
        <p>각 항목의 왼쪽 ⠿ 핸들을 잡고 위아래로 드래그하세요. 순서를 다 바꿨으면 우상단 [순서 저장] 버튼을 꼭 눌러야 DB에 반영됩니다.</p>
      </div>
    </div>
  );
}
