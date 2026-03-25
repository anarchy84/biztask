// 파일 위치: app/submit/page.tsx
// 용도: 새 글 작성 페이지 (다크 테마)
// - 비로그인 사용자 → 로그인 페이지로 리다이렉트
// - 로그인 사용자 → 제목/카테고리/본문 입력 → Supabase posts 테이블에 저장

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import {
  FileText,
  Type,
  AlignLeft,
  Tag,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// 카테고리 옵션 목록
const CATEGORIES = ["자유", "사업", "마케팅", "커리어"];

export default function SubmitPage() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("자유");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  // ─── 마운트 시 로그인 여부 확인 ───
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
    };

    checkAuth();
  }, [router]);

  // ─── 글 발행 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
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
      // 1단계: 프로필이 없으면 자동 생성
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        const nickname = user.email?.split("@")[0] || "익명";
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({ id: user.id, nickname });

        if (profileError) {
          setError("프로필 생성에 실패했습니다: " + profileError.message);
          return;
        }
      }

      // 2단계: 게시글 저장
      const { error: insertError } = await supabase.from("posts").insert({
        author_id: user.id,
        title: title.trim(),
        content: content.trim(),
        category,
      });

      if (insertError) {
        if (insertError.message.includes("row-level security")) {
          setError("권한 오류: 게시글 작성 권한이 없습니다. 다시 로그인해주세요.");
        } else {
          setError("글 작성에 실패했습니다: " + insertError.message);
        }
        return;
      }

      // 3단계: 성공 → 홈으로 이동
      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // 인증 확인 중 로딩 표시
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
          <FileText className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">새 글 작성</h1>
        </div>
      </div>

      {/* 글쓰기 카드 (다크 테마) */}
      <div className="rounded-xl border border-border-color bg-card-bg p-6">
        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
              htmlFor="title"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <Type className="h-4 w-4 text-muted" />
              제목
            </label>
            <input
              id="title"
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
              htmlFor="content"
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground"
            >
              <AlignLeft className="h-4 w-4 text-muted" />
              본문
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자유롭게 이야기를 나눠보세요. 경험, 질문, 인사이트 무엇이든 좋습니다."
              rows={10}
              className="w-full resize-y rounded-lg border border-border-color bg-input-bg px-4 py-3 text-sm leading-relaxed text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* 하단: 취소 + 발행 버튼 */}
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
                  발행 중...
                </>
              ) : (
                "발행하기"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
