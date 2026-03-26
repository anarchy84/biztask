// 파일 위치: app/page.tsx
// 용도: 메인 홈 화면 - BizTask 다크 테마 3단 레이아웃
// 레이아웃: 순수 Tailwind 유틸리티 클래스만 사용 (커스텀 CSS 클래스 사용 금지)
// 브랜드: 형광 그린 #73e346 계열
// Suspense 래퍼 필수 (useSearchParams)
// 우측 사이드바: TrendingSidebar (🔥 실시간 인기글 랭킹보드)

"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import FeaturedSlider from "@/app/components/FeaturedSlider";
import PostCard from "@/app/components/PostCard";
import TrendingSidebar from "@/app/components/TrendingSidebar";
import {
  Flame,
  TrendingUp,
  Home as HomeIcon,
  BookOpen,
  Newspaper,
  Compass,
  Clock,
  Inbox,
  Loader2,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

type PostWithAuthor = {
  id: string;
  title: string;
  content: string;
  category: string;
  upvotes: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  image_urls: string[] | null;
  profiles: ProfileInfo | ProfileInfo[] | null;
};

// 트렌딩 게시글 타입 (upvotes + category 포함)
type TrendingPost = {
  id: string;
  title: string;
  upvotes: number;
  comment_count: number;
  category: string;
};

// ─── 헬퍼 함수 ───
function getAuthorNickname(profiles: PostWithAuthor["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

// 작성자 아바타 URL 추출 헬퍼
function getAuthorAvatarUrl(profiles: PostWithAuthor["profiles"]): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.avatar_url || null;
  return profiles.avatar_url || null;
}

// ─── 좌측 메뉴: 레딧 스타일 5대 메인 네비게이션 ───
const SIDEBAR_NAV = [
  { name: "홈", icon: HomeIcon, color: "text-primary-light", path: "/" },
  { name: "인기", icon: Flame, color: "text-red-400", path: "/popular" },
  { name: "칼럼", icon: BookOpen, color: "text-purple-400", path: "/columns" },
  { name: "뉴스", icon: Newspaper, color: "text-cyan-400", path: "/news" },
  { name: "둘러보기", icon: Compass, color: "text-amber-400", path: "/communities" },
];

// ─── 상단 정렬 탭 ───
const SORT_TABS = [
  { key: "popular", label: "인기", icon: Flame, iconColor: "text-red-400" },
  { key: "latest", label: "최신", icon: Clock, iconColor: "text-blue-400" },
  { key: "rising", label: "급상승", icon: TrendingUp, iconColor: "text-green-400" },
];

// ═══════════════════════════════════════════════════════
// Suspense 래퍼 (useSearchParams는 Suspense 바운더리 필요)
// ═══════════════════════════════════════════════════════
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}

// ═══════════════════════════════════════════════════════
// 메인 페이지 컴포넌트 (내부)
// ═══════════════════════════════════════════════════════
function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentCategory = searchParams.get("category") || "";
  const currentSort = searchParams.get("sort") || "popular";

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // ─── 게시글 목록 불러오기 ───
  const fetchPosts = useCallback(
    async (category: string, sort: string) => {
      let query = supabase
        .from("posts")
        .select(
          `id, title, content, category, upvotes, comment_count, created_at, author_id, image_urls,
           profiles ( nickname, avatar_url )`
        );

      if (category) {
        query = query.eq("category", category);
      }

      if (sort === "popular") {
        query = query
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sort === "rising") {
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
        query = query
          .gte("created_at", oneDayAgo)
          .order("upvotes", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query.limit(20);
      if (data) setPosts(data as PostWithAuthor[]);
    },
    []
  );

  // ─── 🔥 실시간 인기글 TOP 5 불러오기 (upvotes 기준 내림차순) ───
  const fetchTrending = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, upvotes, comment_count, category")
      .order("upvotes", { ascending: false })
      .limit(5);
    if (data) setTrending(data as TrendingPost[]);
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

  // ─── 초기 + URL 변경 시 데이터 로드 ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchMyLikes(session.user.id);
      }

      await Promise.all([
        fetchPosts(currentCategory, currentSort),
        fetchTrending(),
      ]);
      setLoading(false);
    };

    init();
  }, [currentCategory, currentSort, fetchPosts, fetchTrending, fetchMyLikes]);

  // ─── URL 파라미터 조합 헬퍼 ───
  function buildCategoryUrl(category: string): string {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (currentSort && currentSort !== "popular")
      params.set("sort", currentSort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function buildSortUrl(sort: string): string {
    const params = new URLSearchParams();
    if (currentCategory) params.set("category", currentCategory);
    if (sort !== "popular") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

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
      setPosts((prev) =>
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
      setPosts((prev) =>
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
    router.push(buildCategoryUrl(category));
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
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
      {/* 3단 그리드: Tailwind 유틸리티만 사용 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:gap-6 xl:grid-cols-[220px_minmax(0,1fr)_300px] xl:gap-7">

        {/* ═══════════════════════════════════════════ */}
        {/* 좌측 사이드바: 레딧 스타일 5대 메인 네비게이션   */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-1">
            {SIDEBAR_NAV.map((item) => {
              // 현재 경로와 비교하여 활성 상태 판단
              // "홈"은 카테고리 없는 루트("/")일 때 활성
              const isActive =
                (item.path === "/" && !currentCategory && currentSort === "popular") ||
                (item.path === "/popular" && currentSort === "popular" && !currentCategory);

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground hover:bg-hover-bg"
                  }`}
                >
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : item.color}`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            <div className="my-3 border-t border-border-color" />

            {/* 카테고리 서브 메뉴 (접힌 형태, 토글 가능하게 추후 확장 가능) */}
            <h3 className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
              카테고리
            </h3>
            {["사업", "마케팅", "커리어", "자유"].map((cat) => {
              const isActive = currentCategory === cat;
              return (
                <Link
                  key={cat}
                  href={buildCategoryUrl(cat)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted hover:bg-hover-bg hover:text-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${
                    isActive ? "bg-primary" :
                    cat === "사업" ? "bg-green-400" :
                    cat === "마케팅" ? "bg-purple-400" :
                    cat === "커리어" ? "bg-cyan-400" :
                    "bg-amber-400"
                  }`} />
                  <span>{cat}</span>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* ═══════════════════════════════════════════ */}
        {/* 중앙 피드                                    */}
        {/* ═══════════════════════════════════════════ */}
        <section className="min-w-0 space-y-3">
          {/* Featured 슬라이더 */}
          <FeaturedSlider />

          {/* 정렬 탭 */}
          <div className="flex items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
            {SORT_TABS.map((tab) => {
              const isActive = currentSort === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={buildSortUrl(tab.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-hover-bg text-foreground"
                      : "text-muted hover:bg-hover-bg hover:text-foreground"
                  }`}
                >
                  <tab.icon
                    className={`h-4 w-4 ${isActive ? tab.iconColor : ""}`}
                  />
                  {tab.label}
                </Link>
              );
            })}

            {currentCategory && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {currentCategory}
                </span>
                <Link
                  href={buildCategoryUrl("")}
                  className="rounded-full p-0.5 text-muted hover:bg-hover-bg hover:text-foreground"
                  aria-label="필터 해제"
                >
                  ✕
                </Link>
              </div>
            )}
          </div>

          {/* 모바일 전용: 카테고리 가로 스크롤 */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {["전체", "사업", "마케팅", "커리어", "자유"].map((cat) => {
              const isActive =
                (cat === "전체" && !currentCategory) ||
                cat === currentCategory;

              return (
                <Link
                  key={cat}
                  href={cat === "전체" ? buildCategoryUrl("") : buildCategoryUrl(cat)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-black"
                      : "border border-border-color text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat}
                </Link>
              );
            })}
          </div>

          {/* 게시글이 없을 때 */}
          {posts.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
              <Inbox className="mb-4 h-12 w-12 text-muted" />
              <h3 className="mb-1 text-lg font-semibold text-foreground">
                {currentCategory
                  ? `'${currentCategory}' 카테고리에 게시글이 없습니다`
                  : "아직 게시글이 없습니다"}
              </h3>
              <p className="mb-4 text-sm text-muted">
                {currentCategory
                  ? "다른 카테고리를 확인하거나 첫 글을 작성해보세요!"
                  : "첫 번째 글을 작성해 커뮤니티를 시작해보세요!"}
              </p>
              <div className="flex gap-2">
                {currentCategory && (
                  <Link
                    href="/"
                    className="rounded-full border border-border-color px-5 py-2 text-sm font-medium text-muted hover:bg-hover-bg"
                  >
                    전체 보기
                  </Link>
                )}
                <a
                  href="/submit"
                  className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-black hover:bg-primary-hover"
                >
                  글쓰기
                </a>
              </div>
            </div>
          )}

          {/* 게시글 카드 목록 */}
          {posts.map((post) => (
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
                imageUrls={post.image_urls}
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={handleToggleLike}
                onCategoryClick={handleCategoryClick}
              />
            </Link>
          ))}
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 우측 사이드바: 🔥 실시간 인기글 + 커뮤니티 소개 */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-4">
            {/* 🔥 실시간 인기글 랭킹보드 (TrendingSidebar 컴포넌트) */}
            <TrendingSidebar items={trending} />

            {/* 커뮤니티 소개 */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="mb-2 text-sm font-bold text-foreground">
                BizTask 커뮤니티
              </h3>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                스타트업, 마케팅, 커리어에 대해 자유롭게 이야기하는 익명
                비즈니스 커뮤니티입니다. 솔직한 경험과 인사이트를 나눠보세요.
              </p>
              <div className="mb-3 flex gap-6">
                <div>
                  <p className="text-lg font-bold text-foreground">1.2K</p>
                  <p className="text-xs text-muted">멤버</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-400">48</p>
                  <p className="text-xs text-muted">온라인</p>
                </div>
              </div>
              <a
                href="/submit"
                className="block w-full rounded-full bg-primary py-2 text-center text-sm font-bold text-black hover:bg-primary-hover"
              >
                글쓰기
              </a>
            </div>

            {/* 풋터 */}
            <div className="text-xs text-muted">
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <a href="#" className="hover:underline">이용약관</a>
                <a href="#" className="hover:underline">개인정보처리방침</a>
                <a href="#" className="hover:underline">문의하기</a>
              </div>
              <p className="mt-2">2026 BizTask. All rights reserved.</p>
            </div>
          </div>
        </aside>

      </div>
    </div>
  );
}
