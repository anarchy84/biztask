// 파일 위치: app/columns/page.tsx
// 용도: VIP 칼럼 전용 피드 페이지
// category === '칼럼'인 게시글만 최신순으로 불러와서 PostCard로 렌더링
// 사이드바 "칼럼" 메뉴 클릭 시 이동되는 페이지
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import PostCard from "@/app/components/PostCard";
import {
  BookOpen,
  Loader2,
  Inbox,
  Crown,
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

// ═══════════════════════════════════════════════════════
// VIP 칼럼 피드 페이지
// ═══════════════════════════════════════════════════════
export default function ColumnsPage() {
  const router = useRouter();

  // ─── 상태 관리 ───
  const [posts, setPosts] = useState<PostWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // ─── 칼럼 게시글 불러오기 ───
  // category가 '칼럼'인 게시글만 최신순으로 조회
  const fetchColumns = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select(
        `id, title, content, category, upvotes, comment_count, created_at, author_id, image_urls,
         profiles ( nickname, avatar_url ),
         communities ( name, slug )`
      )
      .eq("category", "칼럼")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as PostWithAuthor[]);
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

  // ─── 초기 로딩 ───
  useEffect(() => {
    const init = async () => {
      // 유저 세션 확인
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchMyLikes(session.user.id);
      }

      // 칼럼 게시글 로드
      await fetchColumns();
      setLoading(false);
    };

    init();
  }, [fetchColumns, fetchMyLikes]);

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
      // 추천 취소
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id);
      await supabase.rpc("decrement_upvotes", { row_id: postId });
      setLikedPostIds((prev) => { const next = new Set(prev); next.delete(postId); return next; });
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, upvotes: Math.max(0, p.upvotes - 1) } : p));
    } else {
      // 추천
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

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* ═══════════════════════════════════════════ */}
      {/* 페이지 헤더: VIP 익스클루시브 칼럼           */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/5 via-card-bg to-indigo-500/5 p-6">
        <div className="flex items-center gap-3">
          {/* 아이콘 */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/15">
            <Crown className="h-6 w-6 text-purple-400" />
          </div>

          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
              VIP 익스클루시브 칼럼
            </h1>
            <p className="mt-0.5 text-sm text-muted">
              검증된 크리에이터의 비즈니스 인사이트와 실전 노하우를 만나보세요.
            </p>
          </div>
        </div>

        {/* 통계 바 */}
        <div className="mt-4 flex items-center gap-4 border-t border-border-color pt-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <BookOpen className="h-3.5 w-3.5 text-purple-400" />
            <span>칼럼 {posts.length}편</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 칼럼 게시글 피드                              */}
      {/* ═══════════════════════════════════════════ */}
      {posts.length === 0 ? (
        // 빈 상태: 칼럼 글이 없을 때
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-card-bg py-16 text-center">
          <Inbox className="mb-4 h-12 w-12 text-muted" />
          <h3 className="mb-1 text-lg font-semibold text-foreground">
            아직 등록된 칼럼이 없습니다
          </h3>
          <p className="mb-6 text-sm text-muted">
            VIP의 멋진 글을 기다려주세요!
          </p>
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-2 text-sm font-bold text-black hover:bg-primary-hover transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      ) : (
        // 칼럼 게시글 목록
        <div className="space-y-3">
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
        </div>
      )}
    </div>
  );
}
