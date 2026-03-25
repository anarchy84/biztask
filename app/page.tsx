// 파일 위치: app/page.tsx
// 용도: 메인 홈 화면 - 레딧 다크 테마 3단 레이아웃
// 기능: 카테고리 필터링 (?category=사업) + 정렬 (?sort=popular|latest|rising)
//       추천 토글 + PostCard 컴포넌트 사용

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import FeaturedSlider from "@/app/components/FeaturedSlider";
import PostCard from "@/app/components/PostCard";
import {
  Flame,
  TrendingUp,
  Briefcase,
  Megaphone,
  GraduationCap,
  Coffee,
  Award,
  Clock,
  ChevronRight,
  Inbox,
  Loader2,
  LayoutGrid,
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
  profiles: ProfileInfo | ProfileInfo[] | null;
};

type TrendingPost = {
  id: string;
  title: string;
  comment_count: number;
};

// ─── 헬퍼 함수들 ───

function getAuthorNickname(profiles: PostWithAuthor["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

// ─── 좌측 메뉴 카테고리 정의 ───
const SIDEBAR_CATEGORIES = [
  { name: "전체", icon: LayoutGrid, color: "text-blue-400", href: "/" },
  { name: "사업", icon: Briefcase, color: "text-orange-400", href: "/?category=사업" },
  { name: "마케팅", icon: Megaphone, color: "text-purple-400", href: "/?category=마케팅" },
  { name: "커리어", icon: GraduationCap, color: "text-green-400", href: "/?category=커리어" },
  { name: "자유", icon: Coffee, color: "text-amber-400", href: "/?category=자유" },
];

// ─── 상단 정렬 탭 정의 ───
const SORT_TABS = [
  { key: "popular", label: "인기", icon: Flame, iconColor: "text-red-400" },
  { key: "latest", label: "최신", icon: Clock, iconColor: "text-blue-400" },
  { key: "rising", label: "급상승", icon: TrendingUp, iconColor: "text-green-400" },
];

// ═══════════════════════════════════════════════════════
// 메인 페이지 컴포넌트
// ═══════════════════════════════════════════════════════
export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL에서 현재 필터/정렬 값 읽기
  const currentCategory = searchParams.get("category") || ""; // 빈 문자열 = 전체
  const currentSort = searchParams.get("sort") || "popular"; // 기본값: 인기순

  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // ─── 게시글 목록 불러오기 (카테고리 + 정렬 적용) ───
  const fetchPosts = useCallback(
    async (category: string, sort: string) => {
      // 기본 쿼리: posts + profiles JOIN
      let query = supabase
        .from("posts")
        .select(
          `id, title, content, category, upvotes, comment_count, created_at, author_id,
           profiles ( nickname, avatar_url )`
        );

      // 카테고리 필터링: 값이 있으면 해당 카테고리만
      if (category) {
        query = query.eq("category", category);
      }

      // 정렬 기준 적용
      if (sort === "popular") {
        // 인기순: 추천 수 내림차순 → 같으면 최신순
        query = query
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sort === "rising") {
        // 급상승: 최근 24시간 이내 글 중 추천 수 높은 순
        const oneDayAgo = new Date(
          Date.now() - 24 * 60 * 60 * 1000
        ).toISOString();
        query = query
          .gte("created_at", oneDayAgo)
          .order("upvotes", { ascending: false });
      } else {
        // 최신순 (기본)
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query.limit(20);
      if (data) setPosts(data as PostWithAuthor[]);
    },
    []
  );

  // ─── 트렌딩 불러오기 ───
  const fetchTrending = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, comment_count")
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

      // 유저 세션 확인
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchMyLikes(session.user.id);
      }

      // 게시글 + 트렌딩 동시 로드
      await Promise.all([
        fetchPosts(currentCategory, currentSort),
        fetchTrending(),
      ]);
      setLoading(false);
    };

    init();
  }, [currentCategory, currentSort, fetchPosts, fetchTrending, fetchMyLikes]);

  // ─── URL 파라미터 조합 헬퍼 ───
  // 카테고리를 바꿀 때: 정렬은 유지
  function buildCategoryUrl(category: string): string {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (currentSort && currentSort !== "popular")
      params.set("sort", currentSort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  // 정렬을 바꿀 때: 카테고리는 유지
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

  // ─── 카테고리 클릭 핸들러 (PostCard에서 사용) ───
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
    <div className="mx-auto max-w-7xl px-4 py-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_300px]">
        {/* ═══════════════════════════════════════════ */}
        {/* 좌측 사이드바: 카테고리 필터 메뉴            */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-1">
            <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted">
              카테고리
            </h2>

            {SIDEBAR_CATEGORIES.map((cat) => {
              // 현재 선택된 카테고리인지 판별
              const isActive =
                (cat.name === "전체" && !currentCategory) ||
                cat.name === currentCategory;

              return (
                <Link
                  key={cat.name}
                  href={cat.name === "전체" ? buildCategoryUrl("") : buildCategoryUrl(cat.name)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground hover:bg-hover-bg"
                  }`}
                >
                  <cat.icon
                    className={`h-5 w-5 ${isActive ? "text-primary" : cat.color}`}
                  />
                  <span>{cat.name}</span>

                  {/* 활성 상태 표시 바 */}
                  {isActive && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}

            <div className="my-3 border-t border-border-color" />

            <a
              href="#"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-hover-bg"
            >
              <Award className="h-5 w-5 text-yellow-400" />
              <span>명예의 전당</span>
            </a>
          </div>
        </aside>

        {/* ═══════════════════════════════════════════ */}
        {/* 중앙 피드                                    */}
        {/* ═══════════════════════════════════════════ */}
        <section className="space-y-3">
          {/* 피드 최상단: Featured 슬라이딩 배너 */}
          <FeaturedSlider />

          {/* 피드 상단: 정렬 탭 + 현재 카테고리 표시 */}
          <div className="flex items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
            {SORT_TABS.map((tab) => {
              const isActive = currentSort === tab.key;

              return (
                <Link
                  key={tab.key}
                  href={buildSortUrl(tab.key)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
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

            {/* 현재 선택된 카테고리 뱃지 (카테고리 필터 활성 시) */}
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
            {SIDEBAR_CATEGORIES.map((cat) => {
              const isActive =
                (cat.name === "전체" && !currentCategory) ||
                cat.name === currentCategory;

              return (
                <Link
                  key={cat.name}
                  href={cat.name === "전체" ? buildCategoryUrl("") : buildCategoryUrl(cat.name)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "border border-border-color text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat.name}
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
                  className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                >
                  글쓰기
                </a>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* 게시글 카드 목록 (PostCard 컴포넌트 사용)    */}
          {/* ═══════════════════════════════════════════ */}
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
                isLiked={likedPostIds.has(post.id)}
                onToggleLike={handleToggleLike}
                onCategoryClick={handleCategoryClick}
              />
            </Link>
          ))}
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 우측 사이드바                                */}
        {/* ═══════════════════════════════════════════ */}
        <aside className="hidden lg:block">
          <div className="sticky top-16 space-y-4">
            {/* 트렌딩 */}
            <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
              <div className="bg-primary px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                  <TrendingUp className="h-4 w-4" />
                  오늘의 트렌딩
                </h2>
              </div>
              <div className="divide-y divide-border-color">
                {trending.length > 0 ? (
                  trending.map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/post/${item.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover-bg"
                    >
                      <span className="text-lg font-bold text-primary">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted">
                          댓글 {item.comment_count}개
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                    </Link>
                  ))
                ) : (
                  <p className="px-4 py-6 text-center text-sm text-muted">
                    트렌딩 게시글이 없습니다
                  </p>
                )}
              </div>
            </div>

            {/* 커뮤니티 소개 */}
            <div className="rounded-xl border border-border-color bg-card-bg p-4">
              <h3 className="mb-2 text-sm font-bold text-foreground">
                BizTask 커뮤니티
              </h3>
              <p className="mb-3 text-xs leading-relaxed text-muted">
                스타트업, 마케팅, 커리어에 대해 자유롭게 이야기하는 익명
                비즈니스 커뮤니티입니다. 솔직한 경험과 인사이트를 나눠보세요.
              </p>
              <div className="mb-3 flex gap-4 text-center">
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
                className="block w-full rounded-full bg-primary py-2 text-center text-sm font-medium text-white hover:bg-primary-hover"
              >
                글쓰기
              </a>
            </div>

            {/* 풋터 */}
            <div className="px-2 text-xs text-muted">
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
