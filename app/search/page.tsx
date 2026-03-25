// 파일 위치: app/search/page.tsx
// 용도: 검색 결과 페이지 - Supabase posts 테이블에서 title/content 검색
// URL: /search?q=검색어
// 레이아웃: max-w-3xl mx-auto px-4 md:px-8 (메인 레이아웃 규격 통일)
// 브랜드: 형광 그린 #73e346 계열 다크 테마
// Suspense 래퍼 필수 (useSearchParams 사용)

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import PostCard from "@/app/components/PostCard";
import {
  Search,
  Loader2,
  Inbox,
  ArrowLeft,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

type SearchResult = {
  id: string;
  title: string;
  content: string;
  category: string;
  upvotes: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
};

// ─── 헬퍼 함수 ───
function getAuthorNickname(profiles: SearchResult["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

function getAuthorAvatarUrl(profiles: SearchResult["profiles"]): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.avatar_url || null;
  return profiles.avatar_url || null;
}

// ═══════════════════════════════════════════════════════
// Suspense 래퍼 (useSearchParams는 Suspense 바운더리 필요)
// ═══════════════════════════════════════════════════════
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════
// 검색 결과 컴포넌트 (내부)
// ═══════════════════════════════════════════════════════
function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // ─── 검색 실행 ───
  const executeSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // title 또는 content에 검색어가 포함된 게시글 검색 (대소문자 무시)
    const { data } = await supabase
      .from("posts")
      .select(
        `id, title, content, category, upvotes, comment_count, created_at, author_id,
         profiles ( nickname, avatar_url )`
      )
      .or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
      .order("upvotes", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30);

    setResults((data as SearchResult[]) || []);
    setLoading(false);
  }, []);

  // ─── 내가 추천한 글 목록 ───
  const fetchMyLikes = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId);
    if (data) {
      setLikedPostIds(new Set(data.map((row) => row.post_id)));
    }
  }, []);

  // ─── 마운트 시 + 검색어 변경 시 실행 ───
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await fetchMyLikes(session.user.id);
      }

      await executeSearch(query);
    };

    init();
  }, [query, executeSearch, fetchMyLikes]);

  // ─── 추천 토글 핸들러 ───
  const handleToggleLike = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    const isLiked = likedPostIds.has(postId);

    if (isLiked) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      await supabase.rpc("decrement_upvotes", { row_id: postId });

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
      setResults((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: Math.max(0, p.upvotes - 1) } : p
        )
      );
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });

      await supabase.rpc("increment_upvotes", { row_id: postId });

      setLikedPostIds((prev) => new Set(prev).add(postId));
      setResults((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p
        )
      );
    }
  };

  // ─── 카테고리 클릭 핸들러 ───
  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?category=${category}`);
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      {/* ─── 상단: 뒤로가기 ─── */}
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </button>
      </div>

      {/* ─── 검색 결과 헤더 ─── */}
      <div className="mb-6 rounded-xl border border-border-color bg-card-bg p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <div>
            {query ? (
              <>
                <h1 className="text-lg font-bold text-foreground">
                  &apos;<span className="text-primary">{query}</span>&apos; 검색 결과
                </h1>
                <p className="text-sm text-muted">
                  총 <span className="font-semibold text-foreground">{results.length}</span>건
                </p>
              </>
            ) : (
              <h1 className="text-lg font-bold text-foreground">
                검색어를 입력해주세요
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* ─── 검색 결과 목록 ─── */}
      {!query ? (
        /* 검색어가 없는 경우 */
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
          <Search className="mb-4 h-12 w-12 text-muted" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">
            검색어를 입력해주세요
          </h3>
          <p className="text-sm text-muted">
            상단 검색창에 키워드를 입력하고 엔터를 누르세요
          </p>
        </div>
      ) : results.length === 0 ? (
        /* 검색 결과가 없는 경우 */
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
          <Inbox className="mb-4 h-12 w-12 text-muted" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">
            검색 결과가 없습니다
          </h3>
          <p className="mb-4 text-sm text-muted">
            &apos;<span className="text-primary">{query}</span>&apos;에 대한 검색 결과를 찾을 수 없습니다.
            <br />
            다른 키워드로 검색해보세요.
          </p>
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-black hover:bg-primary-hover"
          >
            홈으로 돌아가기
          </Link>
        </div>
      ) : (
        /* 검색 결과 카드 목록 */
        <div className="space-y-3">
          {results.map((post) => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="block"
            >
              <PostCard
                id={post.id}
                title={post.title}
                content={post.content}
                category={post.category}
                upvotes={post.upvotes}
                commentCount={post.comment_count}
                createdAt={post.created_at}
                authorNickname={getAuthorNickname(post.profiles)}
                authorAvatarUrl={getAuthorAvatarUrl(post.profiles)}
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={handleToggleLike}
                onCategoryClick={handleCategoryClick}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
