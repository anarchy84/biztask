// 파일 위치: app/edit/[id]/page.tsx
// 용도: 게시글 수정 페이지 - 기존 데이터 불러와서 수정 후 update
// 레이아웃: max-w-2xl mx-auto px-4 md:px-8 (submit 페이지와 동일 규격)
// 브랜드: 형광 그린 #73e346 계열 다크 테마
// 권한: 작성자 본인만 수정 가능 (author_id === user.id 체크)

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  Pencil,
  Type,
  AlignLeft,
  Tag,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// 카테고리 옵션 목록
const CATEGORIES = ["자유", "사업", "마케팅", "커리어"];

export default function EditPage() {
  const params = useParams();
  const postId = params.id as string;
  const router = useRouter();

  // ─── 상태 관리 ───
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("자유");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ─── 기존 게시글 데이터 불러오기 ───
  const fetchPost = useCallback(
    async (userId: string) => {
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select("id, title, content, category, author_id")
        .eq("id", postId)
        .single();

      if (fetchError || !data) {
        setError("게시글을 찾을 수 없습니다.");
        return;
      }

      // 권한 체크: 작성자 본인이 아니면 접근 차단
      if (data.author_id !== userId) {
        setError("수정 권한이 없습니다.");
        router.replace(`/post/${postId}`);
        return;
      }

      // 기존 데이터로 폼 초기화
      setTitle(data.title);
      setContent(data.content);
      setCategory(data.category);
    },
    [postId, router]
  );

  // ─── 마운트 시 인증 확인 + 데이터 로드 ───
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      await fetchPost(session.user.id);
      setAuthLoading(false);
    };

    init();
  }, [router, fetchPost]);

  // ─── 수정 완료 핸들러 ───
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (title.trim().length < 2) {
      setError("제목은 최소 2자 이상이어야 합니다.");
      return;
    }
    if (!content.trim()) {
      setError("본문을 입력해주세요.");
      return;
    }
    if (!user) {
      setError("로그인이 필요합니다.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from("posts")
        .update({
          title: title.trim(),
          content: content.trim(),
          category,
        })
        .eq("id", postId)
        .eq("author_id", user.id); // RLS 추가 안전장치: 작성자만 수정 가능

      if (updateError) {
        if (updateError.message.includes("row-level security")) {
          setError("권한 오류: 이 게시글을 수정할 권한이 없습니다.");
        } else {
          setError("수정에 실패했습니다: " + updateError.message);
        }
        return;
      }

      // 수정 성공 → 해당 게시글 상세 페이지로 이동
      router.push(`/post/${postId}`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 인증/데이터 로딩 중 표시 ───
  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8">
      {/* 상단: 뒤로가기 + 페이지 제목 */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 text-muted hover:bg-hover-bg hover:text-foreground"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">게시글 수정</h1>
        </div>
      </div>

      {/* 수정 폼 카드 (다크 테마) */}
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-5">
          {/* 카테고리 선택 */}
          <div>
            <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Tag className="h-4 w-4 text-muted" />
              카테고리
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                    category === cat
                      ? "bg-primary text-black"
                      : "border border-border-color text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 입력 */}
          <div>
            <label
              htmlFor="edit-title"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Type className="h-4 w-4 text-muted" />
              제목
            </label>
            <input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full rounded-lg border border-border-color bg-input-bg px-4 py-3 text-base text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {title.length}/100
            </p>
          </div>

          {/* 본문 입력 */}
          <div>
            <label
              htmlFor="edit-content"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <AlignLeft className="h-4 w-4 text-muted" />
              본문
            </label>
            <textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 이야기를 나눠보세요. 경험, 질문, 인사이트 무엇이든 좋습니다."
              rows={10}
              className="w-full resize-y rounded-lg border border-border-color bg-input-bg px-4 py-3 text-sm leading-relaxed text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 하단: 취소 + 수정 완료 버튼 */}
          <div className="flex items-center justify-end gap-3 border-t border-border-color pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg px-5 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-black hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  수정 중...
                </>
              ) : (
                "수정 완료"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
