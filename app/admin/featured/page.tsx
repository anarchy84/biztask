// 파일 위치: app/admin/featured/page.tsx
// 용도: Featured 슬라이더 관리 페이지
// 기능:
//   - 현재 Featured에 등록된 게시글 목록 표시 (순서 변경 가능)
//   - 게시글 검색 → Featured에 추가
//   - Featured에서 제거
//   - 드래그 없이 ▲▼ 버튼으로 순서 변경
// 접근: 로그인한 사용자만 접근 가능 (추후 관리자 권한 체크 추가 가능)
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import {
  Flame,
  Search,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  ImageIcon,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───

// Supabase JOIN 결과의 posts 필드 타입
type PostInfo = {
  id: string;
  title: string;
  category: string;
  upvotes: number;
  comment_count: number;
  image_urls: string[] | null;
  created_at: string;
};

// Featured에 등록된 게시글 (JOIN 결과)
// Supabase는 1:1 관계를 객체로, 1:N을 배열로 반환하므로 둘 다 허용
type FeaturedPost = {
  id: string; // featured_posts 테이블의 id
  post_id: string;
  display_order: number;
  is_active: boolean;
  posts: PostInfo | PostInfo[] | null;
};

// 검색 결과 게시글
type SearchPost = {
  id: string;
  title: string;
  category: string;
  upvotes: number;
  comment_count: number;
  image_urls: string[] | null;
  created_at: string;
};

// ─── posts 필드 추출 헬퍼 (Supabase JOIN이 객체 또는 배열로 반환될 수 있음) ───
function getPostInfo(posts: PostInfo | PostInfo[] | null): PostInfo | null {
  if (!posts) return null;
  if (Array.isArray(posts)) return posts[0] || null;
  return posts;
}

// ─── 카테고리 뱃지 색상 ───
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-primary/20 text-primary-light",
    마케팅: "bg-purple-500/20 text-purple-400",
    커리어: "bg-cyan-500/20 text-cyan-400",
    자유: "bg-amber-500/20 text-amber-400",
  };
  return colorMap[category] || "bg-gray-500/20 text-gray-400";
}

// ─── 상대 시간 포맷 ───
function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay < 1) return "오늘";
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

export default function AdminFeaturedPage() {
  const router = useRouter();

  // ─── 상태 관리 ───
  const [user, setUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Featured 게시글 목록
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [saving, setSaving] = useState(false);

  // 게시글 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPost[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // ─── Featured 게시글 목록 불러오기 ───
  const fetchFeatured = useCallback(async () => {
    const { data } = await supabase
      .from("featured_posts")
      .select(
        `id, post_id, display_order, is_active,
         posts ( id, title, category, upvotes, comment_count, image_urls, created_at )`
      )
      .order("display_order", { ascending: true });

    if (data) {
      setFeaturedPosts(data as FeaturedPost[]);
    }
  }, []);

  // ─── 초기 로딩: 인증 확인 + Featured 데이터 로드 ───
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
      await fetchFeatured();
      setPageLoading(false);
    };

    init();
  }, [router, fetchFeatured]);

  // ─── 게시글 검색 핸들러 ───
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);

    // 이미 Featured에 등록된 post_id 목록
    const featuredPostIds = featuredPosts.map((fp) => fp.post_id);

    // 제목으로 검색 (이미 등록된 글 제외)
    const { data } = await supabase
      .from("posts")
      .select("id, title, category, upvotes, comment_count, image_urls, created_at")
      .ilike("title", `%${searchQuery.trim()}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      // 이미 Featured에 등록된 글은 결과에서 제외
      const filtered = data.filter((p) => !featuredPostIds.includes(p.id));
      setSearchResults(filtered as SearchPost[]);
    }

    setSearching(false);
  };

  // ─── Featured에 게시글 추가 ───
  const addToFeatured = async (post: SearchPost) => {
    if (!user) return;
    setSaving(true);

    // 현재 가장 큰 display_order + 1
    const maxOrder = featuredPosts.length > 0
      ? Math.max(...featuredPosts.map((fp) => fp.display_order))
      : -1;

    const { error } = await supabase.from("featured_posts").insert({
      post_id: post.id,
      display_order: maxOrder + 1,
      is_active: true,
    });

    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        alert("이미 Featured에 등록된 게시글입니다.");
      } else {
        alert("등록 실패: " + error.message);
      }
      setSaving(false);
      return;
    }

    // 검색 결과에서 제거 + Featured 목록 새로고침
    setSearchResults((prev) => prev.filter((p) => p.id !== post.id));
    await fetchFeatured();
    setSaving(false);
  };

  // ─── Featured에서 게시글 제거 ───
  const removeFromFeatured = async (featuredId: string) => {
    const confirmed = window.confirm("이 게시글을 Featured에서 제거하시겠습니까?");
    if (!confirmed) return;

    setSaving(true);
    await supabase.from("featured_posts").delete().eq("id", featuredId);
    await fetchFeatured();
    setSaving(false);
  };

  // ─── 활성/비활성 토글 ───
  const toggleActive = async (featuredId: string, currentActive: boolean) => {
    setSaving(true);
    await supabase
      .from("featured_posts")
      .update({ is_active: !currentActive })
      .eq("id", featuredId);
    await fetchFeatured();
    setSaving(false);
  };

  // ─── 순서 변경 (위로/아래로) ───
  const moveOrder = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === featuredPosts.length - 1) return;

    setSaving(true);

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const current = featuredPosts[index];
    const swap = featuredPosts[swapIndex];

    // display_order를 서로 교환
    await Promise.all([
      supabase
        .from("featured_posts")
        .update({ display_order: swap.display_order })
        .eq("id", current.id),
      supabase
        .from("featured_posts")
        .update({ display_order: current.display_order })
        .eq("id", swap.id),
    ]);

    await fetchFeatured();
    setSaving(false);
  };

  // ─── 페이지 로딩 ───
  if (pageLoading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      {/* ─── 상단: 뒤로가기 + 제목 ─── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-full p-2 text-muted hover:bg-hover-bg hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-400" />
            <h1 className="text-xl font-bold text-foreground">Featured 관리</h1>
          </div>
        </div>

        {/* 게시글 추가 버튼 */}
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            showSearch
              ? "bg-hover-bg text-foreground"
              : "bg-primary text-black hover:bg-primary-hover"
          }`}
        >
          {showSearch ? (
            "닫기"
          ) : (
            <>
              <Plus className="h-4 w-4" />
              게시글 추가
            </>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 게시글 검색 영역 (토글)                      */}
      {/* ═══════════════════════════════════════════ */}
      {showSearch && (
        <div className="mb-6 rounded-xl border border-border-color bg-card-bg p-4">
          <h2 className="mb-3 text-sm font-bold text-foreground">
            게시글 검색하여 Featured에 추가
          </h2>

          {/* 검색 입력 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="게시글 제목으로 검색..."
                className="w-full rounded-lg border border-border-color bg-input-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-black hover:bg-primary-hover disabled:opacity-50"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              검색
            </button>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {searchResults.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded-lg border border-border-color bg-hover-bg p-3"
                >
                  {/* 이미지 썸네일 */}
                  {post.image_urls && post.image_urls.length > 0 ? (
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-md bg-border-color">
                      <Image
                        src={post.image_urls[0]}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-border-color">
                      <ImageIcon className="h-5 w-5 text-muted" />
                    </div>
                  )}

                  {/* 게시글 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {post.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getCategoryColor(post.category)}`}>
                        {post.category}
                      </span>
                      <span>추천 {post.upvotes}</span>
                      <span>댓글 {post.comment_count}</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </div>

                  {/* 추가 버튼 */}
                  <button
                    onClick={() => addToFeatured(post)}
                    disabled={saving}
                    className="flex items-center gap-1 shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-black hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    추가
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 검색 결과 없음 */}
          {searchResults.length === 0 && searchQuery.trim() && !searching && (
            <p className="mt-3 text-center text-sm text-muted">
              &quot;{searchQuery}&quot;에 해당하는 게시글이 없습니다.
            </p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 현재 Featured 게시글 목록                     */}
      {/* ═══════════════════════════════════════════ */}
      <div className="rounded-xl border border-border-color bg-card-bg">
        <div className="border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-bold text-foreground">
            등록된 Featured 게시글 ({featuredPosts.length}개)
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            순서를 변경하면 슬라이더에 표시되는 순서가 바뀝니다. 눈 아이콘으로 노출/숨김을 전환하세요.
          </p>
        </div>

        {featuredPosts.length === 0 ? (
          <div className="py-12 text-center">
            <Flame className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="mb-1 text-sm font-medium text-foreground">
              아직 등록된 게시글이 없습니다
            </p>
            <p className="text-xs text-muted">
              상단의 &quot;게시글 추가&quot; 버튼을 눌러 Featured에 게시글을 등록하세요.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-color">
            {featuredPosts.map((fp, index) => {
              const postInfo = getPostInfo(fp.posts);

              return (
              <div
                key={fp.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                  !fp.is_active ? "opacity-50" : ""
                }`}
              >
                {/* 순서 표시 + 드래그 아이콘 */}
                <div className="flex shrink-0 items-center gap-1 text-muted">
                  <GripVertical className="h-4 w-4" />
                  <span className="w-5 text-center text-xs font-bold">
                    {index + 1}
                  </span>
                </div>

                {/* 이미지 썸네일 */}
                {postInfo?.image_urls && postInfo.image_urls.length > 0 ? (
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-border-color">
                    <Image
                      src={postInfo.image_urls[0]}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-border-color">
                    <ImageIcon className="h-6 w-6 text-muted" />
                  </div>
                )}

                {/* 게시글 정보 */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/post/${fp.post_id}`}
                    className="truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {postInfo?.title || "삭제된 게시글"}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    {postInfo && (
                      <>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${getCategoryColor(postInfo.category)}`}>
                          {postInfo.category}
                        </span>
                        <span>추천 {postInfo.upvotes}</span>
                        <span>댓글 {postInfo.comment_count}</span>
                      </>
                    )}
                    {!fp.is_active && (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                        숨김
                      </span>
                    )}
                  </div>
                </div>

                {/* 액션 버튼들 */}
                <div className="flex shrink-0 items-center gap-1">
                  {/* 위로 이동 */}
                  <button
                    onClick={() => moveOrder(index, "up")}
                    disabled={index === 0 || saving}
                    className="rounded-md p-1.5 text-muted hover:bg-hover-bg hover:text-foreground disabled:opacity-30"
                    aria-label="위로 이동"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>

                  {/* 아래로 이동 */}
                  <button
                    onClick={() => moveOrder(index, "down")}
                    disabled={index === featuredPosts.length - 1 || saving}
                    className="rounded-md p-1.5 text-muted hover:bg-hover-bg hover:text-foreground disabled:opacity-30"
                    aria-label="아래로 이동"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>

                  {/* 활성/비활성 토글 */}
                  <button
                    onClick={() => toggleActive(fp.id, fp.is_active)}
                    disabled={saving}
                    className={`rounded-md p-1.5 transition-colors ${
                      fp.is_active
                        ? "text-green-400 hover:bg-green-500/10"
                        : "text-muted hover:bg-hover-bg"
                    }`}
                    aria-label={fp.is_active ? "숨기기" : "보이기"}
                  >
                    {fp.is_active ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>

                  {/* 삭제 */}
                  <button
                    onClick={() => removeFromFeatured(fp.id)}
                    disabled={saving}
                    className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    aria-label="Featured에서 제거"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ); })}
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <p className="mt-4 text-center text-xs text-muted">
        Featured에 등록된 게시글은 메인 피드 상단 슬라이더에 표시됩니다.
        <br />
        이미지가 있는 게시글을 등록하면 더 멋진 배너가 됩니다.
      </p>
    </div>
  );
}
