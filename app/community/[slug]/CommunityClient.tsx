// 파일 위치: app/community/[slug]/CommunityClient.tsx
// 용도: 커뮤니티 전용 페이지 - 클라이언트 컴포넌트
// 레이아웃: 레딧 서브레딧 스타일
//   - 상단: 배너 + 커뮤니티 이름/설명
//   - 좌측: 게시글 피드 (해당 커뮤니티 소속 글만)
//   - 우측: 커뮤니티 정보 사이드바
//   - VIP(생성자): 수정/삭제 관리 기능
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import PostCard from "@/app/components/PostCard";
import {
  Users,
  Calendar,
  ArrowLeft,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  Flame,
  TrendingUp,
  Inbox,
  Shield,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

type CommunityJoin = {
  name: string;
  slug: string | null;
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
  communities: CommunityJoin | CommunityJoin[] | null;
};

type CommunityInfo = {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  created_by: string | null;
  created_at: string;
  member_count: number;
  icon_url: string | null;
  banner_url: string | null;
};

// ─── 헬퍼 함수 ───
function getAuthorNickname(profiles: PostWithAuthor["profiles"]): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

function getAuthorAvatarUrl(profiles: PostWithAuthor["profiles"]): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.avatar_url || null;
  return profiles.avatar_url || null;
}

function getCommunityName(communities: PostWithAuthor["communities"]): string | null {
  if (!communities) return null;
  if (Array.isArray(communities)) return communities[0]?.name || null;
  return communities.name || null;
}

function getCommunitySlug(communities: PostWithAuthor["communities"]): string | null {
  if (!communities) return null;
  if (Array.isArray(communities)) return communities[0]?.slug || null;
  return communities.slug || null;
}

// 날짜 포맷: "2026년 3월 26일 생성"
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─── 정렬 탭 ───
const SORT_TABS = [
  { key: "popular", label: "인기", icon: Flame, iconColor: "text-red-400" },
  { key: "latest", label: "최신", icon: Clock, iconColor: "text-blue-400" },
  { key: "rising", label: "급상승", icon: TrendingUp, iconColor: "text-green-400" },
];

// ═══════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════
export default function CommunityClient({ slug }: { slug: string }) {
  const router = useRouter();

  // ─── 상태 관리 ───
  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isOwner, setIsOwner] = useState(false);      // 커뮤니티 생성자 여부
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [currentSort, setCurrentSort] = useState("popular");

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ─── 커뮤니티 정보 불러오기 ───
  const fetchCommunity = useCallback(async () => {
    // slug 또는 id로 조회
    const { data } = await supabase
      .from("communities")
      .select("id, name, slug, description, created_by, created_at, member_count, icon_url, banner_url")
      .or(`slug.eq.${slug},id.eq.${slug}`)
      .single();

    if (data) {
      setCommunity(data as CommunityInfo);
      return data as CommunityInfo;
    }
    return null;
  }, [slug]);

  // ─── 커뮤니티 소속 게시글 불러오기 ───
  const fetchPosts = useCallback(
    async (communityId: string, sort: string) => {
      let query = supabase
        .from("posts")
        .select(
          `id, title, content, category, upvotes, comment_count, created_at, author_id, image_urls,
           profiles ( nickname, avatar_url ),
           communities ( name, slug )`
        )
        .eq("community_id", communityId);

      if (sort === "popular") {
        query = query
          .order("upvotes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sort === "rising") {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query
          .gte("created_at", oneDayAgo)
          .order("upvotes", { ascending: false });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data } = await query.limit(30);
      if (data) setPosts(data as PostWithAuthor[]);
    },
    []
  );

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

  // ─── 초기 로딩 ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 유저 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchMyLikes(session.user.id);
      }

      // 커뮤니티 정보 로드
      const com = await fetchCommunity();
      if (!com) {
        setLoading(false);
        return;
      }

      // 생성자 여부 판단
      if (session?.user && com.created_by === session.user.id) {
        setIsOwner(true);
      }

      // 게시글 로드
      await fetchPosts(com.id, currentSort);
      setLoading(false);
    };

    init();
  }, [slug, fetchCommunity, fetchPosts, fetchMyLikes, currentSort]);

  // ─── 정렬 변경 ───
  const handleSortChange = async (sort: string) => {
    if (!community) return;
    setCurrentSort(sort);
  };

  // ─── 추천 토글 ───
  const handleToggleLike = async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    const isLiked = likedPostIds.has(postId);

    if (isLiked) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.rpc("decrement_upvotes", { row_id: postId });
      setLikedPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: Math.max(0, p.upvotes - 1) } : p));
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      await supabase.rpc("increment_upvotes", { row_id: postId });
      setLikedPostIds((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: p.upvotes + 1 } : p));
    }
  };

  // ─── 카테고리 클릭 (메인 피드로 이동) ───
  const handleCategoryClick = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/?category=${encodeURIComponent(category)}`);
  };

  // ─── 커뮤니티 수정 ───
  const handleEditCommunity = async () => {
    if (!community || !editName.trim()) return;
    setEditSaving(true);

    const { error } = await supabase
      .from("communities")
      .update({
        name: editName.trim(),
        description: editDesc.trim(),
      })
      .eq("id", community.id);

    if (error) {
      alert("수정 실패: " + error.message);
    } else {
      await fetchCommunity();
      setShowEditModal(false);
    }
    setEditSaving(false);
  };

  // ─── 커뮤니티 삭제 ───
  const handleDeleteCommunity = async () => {
    if (!community) return;
    if (!confirm(`'${community.name}' 커뮤니티를 정말 삭제하시겠습니까?\n소속 게시글의 커뮤니티 연결이 해제됩니다.`)) return;

    const { error } = await supabase
      .from("communities")
      .delete()
      .eq("id", community.id);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      router.push("/");
    }
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── 커뮤니티 없음 ───
  if (!community) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center gap-4">
        <h1 className="text-xl font-bold text-foreground">커뮤니티를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted">삭제되었거나 존재하지 않는 커뮤니티입니다.</p>
        <Link href="/" className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-black hover:bg-primary-hover">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-48px)]">
      {/* ═══════════════════════════════════════════ */}
      {/* 커뮤니티 배너 (레딧 스타일 헤더)             */}
      {/* ═══════════════════════════════════════════ */}
      <div className="relative">
        {/* 배너 배경 (그라데이션 기본 / 이미지 있으면 이미지) */}
        <div
          className="h-28 w-full md:h-36"
          style={{
            background: community.banner_url
              ? `url(${community.banner_url}) center/cover`
              : "linear-gradient(135deg, #1a472a 0%, #2d5a3f 50%, #73e346 100%)",
          }}
        />

        {/* 커뮤니티 정보 오버레이 */}
        <div className="mx-auto max-w-5xl px-4 md:px-8">
          <div className="-mt-6 flex items-end gap-4">
            {/* 커뮤니티 아이콘 */}
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#1a1a1b] bg-card-bg text-2xl md:h-20 md:w-20">
              {community.icon_url ? (
                <img src={community.icon_url} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <Users className="h-8 w-8 text-primary" />
              )}
            </div>

            {/* 이름 + 멤버 수 */}
            <div className="flex-1 pb-2">
              <h1 className="text-xl font-bold text-foreground md:text-2xl">{community.name}</h1>
              <p className="text-xs text-muted">멤버 {community.member_count}명</p>
            </div>

            {/* 액션 버튼들 */}
            <div className="flex items-center gap-2 pb-2">
              {/* 글쓰기 버튼 */}
              {user && (
                <Link
                  href={`/submit?community=${community.id}`}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-black hover:bg-primary-hover transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  글쓰기
                </Link>
              )}

              {/* 생성자 전용: 수정/삭제 */}
              {isOwner && (
                <>
                  <button
                    onClick={() => {
                      setEditName(community.name);
                      setEditDesc(community.description || "");
                      setShowEditModal(true);
                    }}
                    className="flex items-center gap-1 rounded-full border border-border-color px-3 py-2 text-xs text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    수정
                  </button>
                  <button
                    onClick={handleDeleteCommunity}
                    className="flex items-center gap-1 rounded-full border border-red-500/30 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 설명 */}
          {community.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{community.description}</p>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 메인 콘텐츠: 2단 레이아웃                     */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">

          {/* ─── 좌측: 게시글 피드 ─── */}
          <section className="min-w-0 space-y-3">
            {/* 정렬 탭 */}
            <div className="flex items-center gap-2 rounded-xl border border-border-color bg-card-bg p-2">
              {SORT_TABS.map((tab) => {
                const isActive = currentSort === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleSortChange(tab.key)}
                    className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-hover-bg text-foreground"
                        : "text-muted hover:bg-hover-bg hover:text-foreground"
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? tab.iconColor : ""}`} />
                    {tab.label}
                  </button>
                );
              })}

              <div className="ml-auto">
                <Link
                  href="/"
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  메인으로
                </Link>
              </div>
            </div>

            {/* 게시글 없을 때 */}
            {posts.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
                <Inbox className="mb-4 h-12 w-12 text-muted" />
                <h3 className="mb-1 text-lg font-semibold text-foreground">
                  아직 게시글이 없습니다
                </h3>
                <p className="mb-4 text-sm text-muted">
                  이 커뮤니티의 첫 번째 글을 작성해보세요!
                </p>
                {user && (
                  <Link
                    href={`/submit?community=${community.id}`}
                    className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-black hover:bg-primary-hover"
                  >
                    글쓰기
                  </Link>
                )}
              </div>
            )}

            {/* 게시글 목록 */}
            {posts.map((post) => (
              <Link key={post.id} href={`/post/${post.id}`} className="block">
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
                  communityName={getCommunityName(post.communities)}
                  communitySlug={getCommunitySlug(post.communities)}
                  isLiked={likedPostIds.has(post.id)}
                  onToggleLike={handleToggleLike}
                  onCategoryClick={handleCategoryClick}
                />
              </Link>
            ))}
          </section>

          {/* ─── 우측 사이드바: 커뮤니티 정보 ─── */}
          <aside className="hidden lg:block">
            <div className="sticky top-16 space-y-4">
              {/* 커뮤니티 정보 카드 */}
              <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
                {/* 카드 헤더 */}
                <div className="bg-primary/10 px-4 py-3">
                  <h3 className="text-sm font-bold text-foreground">커뮤니티 소개</h3>
                </div>

                <div className="p-4 space-y-3">
                  {/* 설명 */}
                  <p className="text-xs leading-relaxed text-muted">
                    {community.description || "아직 설명이 없습니다."}
                  </p>

                  {/* 통계 */}
                  <div className="flex gap-6 border-t border-border-color pt-3">
                    <div>
                      <p className="text-lg font-bold text-foreground">{community.member_count}</p>
                      <p className="text-xs text-muted">멤버</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">{posts.length}</p>
                      <p className="text-xs text-muted">게시글</p>
                    </div>
                  </div>

                  {/* 생성일 */}
                  <div className="flex items-center gap-1.5 text-xs text-muted border-t border-border-color pt-3">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(community.created_at)} 생성</span>
                  </div>

                  {/* 생성자 표시 */}
                  {isOwner && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <Shield className="h-3.5 w-3.5" />
                      <span>내가 만든 커뮤니티</span>
                    </div>
                  )}

                  {/* 글쓰기 버튼 */}
                  {user && (
                    <Link
                      href={`/submit?community=${community.id}`}
                      className="block w-full rounded-full bg-primary py-2 text-center text-sm font-bold text-black hover:bg-primary-hover transition-colors"
                    >
                      글쓰기
                    </Link>
                  )}
                </div>
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

      {/* ═══════════════════════════════════════════ */}
      {/* 커뮤니티 수정 모달 (생성자 전용)              */}
      {/* ═══════════════════════════════════════════ */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-border-color bg-card-bg p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 rounded-full p-1 text-muted hover:bg-hover-bg hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Pencil className="h-5 w-5 text-primary" />
              커뮤니티 수정
            </h2>

            {/* 이름 */}
            <div className="mt-5">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                커뮤니티 이름 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* 설명 */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                설명
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={200}
                rows={3}
                className="w-full rounded-lg border border-border-color bg-input-bg px-3 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            {/* 액션 */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 rounded-lg border border-border-color px-4 py-2.5 text-sm font-medium text-muted hover:bg-hover-bg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEditCommunity}
                disabled={!editName.trim() || editSaving}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-black hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 중...
                  </span>
                ) : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
