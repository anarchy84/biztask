// 파일 위치: app/post/[id]/PostDetailClient.tsx
// 용도: 게시글 상세 페이지 클라이언트 컴포넌트 (UI + 인터랙션)
// page.tsx(서버 컴포넌트)에서 import하여 사용
// 브랜드: 형광 그린 #73e346 계열
// M11: 게시글 작성자 + 댓글 작성자 프로필 이미지 표시
// M12: 작성자 본인만 수정/삭제 버튼 표시 + 삭제 로직

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Share2,
  Bookmark,
  ArrowLeft,
  Send,
  Loader2,
  Clock,
  Trash2,
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

// ─── 타입 정의 ───
type ProfileInfo = {
  nickname: string;
  avatar_url: string | null;
};

type PostDetail = {
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

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
};

// ─── 헬퍼 함수 ───

function getAuthorNickname(profiles: ProfileInfo | ProfileInfo[] | null): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

// 프로필 이미지 URL 추출 헬퍼
function getAuthorAvatarUrl(profiles: ProfileInfo | ProfileInfo[] | null): string | null {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0]?.avatar_url || null;
  return profiles.avatar_url || null;
}

function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-primary/20 text-primary-light",
    마케팅: "bg-purple-500/20 text-purple-400",
    커리어: "bg-cyan-500/20 text-cyan-400",
    자유: "bg-amber-500/20 text-amber-400",
  };
  return colorMap[category] || "bg-gray-500/20 text-gray-400";
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;
  return `${Math.floor(diffDay / 30)}개월 전`;
}

// ═══════════════════════════════════════════════════════
// 게시글 상세 페이지 클라이언트 컴포넌트
// ═══════════════════════════════════════════════════════
export default function PostDetailClient() {
  const params = useParams();
  const postId = params.id as string;
  const router = useRouter();

  // ─── 상태 관리 ───
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  // 현재 유저의 프로필 정보 (댓글 작성 시 아바타 표시용)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);

  // 댓글 입력 관련 상태
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  // 게시글 삭제 관련 상태
  const [deleting, setDeleting] = useState(false);

  // 더보기 메뉴 (수정/삭제) 토글 상태
  const [showMenu, setShowMenu] = useState(false);

  // ─── 게시글 불러오기 ───
  const fetchPost = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select(
        `id, title, content, category, upvotes, comment_count, created_at, author_id,
         profiles ( nickname, avatar_url )`
      )
      .eq("id", postId)
      .single();

    if (data) setPost(data as PostDetail);
  }, [postId]);

  // ─── 댓글 목록 불러오기 ───
  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments")
      .select(
        `id, post_id, user_id, content, created_at,
         profiles ( nickname, avatar_url )`
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data) setComments(data as Comment[]);
  }, [postId]);

  // ─── 내가 이 글을 추천했는지 확인 ───
  const checkMyLike = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      setIsLiked(!!data);
    },
    [postId]
  );

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        await checkMyLike(session.user.id);

        // 내 프로필 아바타 가져오기 (댓글 입력 영역 표시용)
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("avatar_url")
          .eq("id", session.user.id)
          .single();

        if (myProfile?.avatar_url) {
          setMyAvatarUrl(myProfile.avatar_url);
        }
      }

      await Promise.all([fetchPost(), fetchComments()]);
      setLoading(false);
    };

    init();
  }, [fetchPost, fetchComments, checkMyLike]);

  // ─── 더보기 메뉴 외부 클릭 시 닫기 ───
  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) setShowMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showMenu]);

  // ─── 추천 토글 ───
  const handleToggleLike = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!post) return;

    if (isLiked) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      setIsLiked(false);
      setPost((prev) =>
        prev ? { ...prev, upvotes: Math.max(0, prev.upvotes - 1) } : prev
      );
    } else {
      await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });

      setIsLiked(true);
      setPost((prev) =>
        prev ? { ...prev, upvotes: prev.upvotes + 1 } : prev
      );
    }
  };

  // ═══════════════════════════════════════════════════════
  // 게시글 삭제 핸들러 (작성자 본인만 가능)
  // ═══════════════════════════════════════════════════════
  const handleDeletePost = async () => {
    if (!user || !post) return;
    // 이중 권한 체크: 현재 유저 === 게시글 작성자
    if (user.id !== post.author_id) return;

    const confirmed = window.confirm("정말 이 글을 삭제하시겠습니까?\n삭제된 글은 복구할 수 없습니다.");
    if (!confirmed) return;

    setDeleting(true);

    try {
      // 게시글에 달린 댓글 먼저 삭제 (FK 제약조건 방지)
      await supabase.from("comments").delete().eq("post_id", postId);

      // 게시글에 달린 좋아요 삭제
      await supabase.from("post_likes").delete().eq("post_id", postId);

      // 게시글 삭제
      const { error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", user.id); // RLS 추가 안전장치

      if (deleteError) {
        alert("삭제에 실패했습니다: " + deleteError.message);
        setDeleting(false);
        return;
      }

      // 삭제 성공 → 홈으로 이동
      router.push("/");
      router.refresh();
    } catch {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setDeleting(false);
    }
  };

  // ─── 댓글 등록 핸들러 ───
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError("");

    if (!user) {
      router.push("/login");
      return;
    }

    if (!commentText.trim()) {
      setCommentError("댓글 내용을 입력해주세요.");
      return;
    }

    setCommentSubmitting(true);

    try {
      // 프로필이 없으면 자동 생성
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingProfile) {
        const nickname = user.email?.split("@")[0] || "익명";
        await supabase.from("profiles").insert({ id: user.id, nickname });
      }

      // 댓글 삽입
      const { error: insertError } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: user.id,
        content: commentText.trim(),
      });

      if (insertError) {
        setCommentError("댓글 작성에 실패했습니다: " + insertError.message);
        return;
      }

      // 게시글의 comment_count +1 업데이트
      if (post) {
        await supabase
          .from("posts")
          .update({ comment_count: post.comment_count + 1 })
          .eq("id", postId);
      }

      // 입력창 초기화 + 댓글 & 게시글 새로고침
      setCommentText("");
      await Promise.all([fetchComments(), fetchPost()]);
    } catch {
      setCommentError("네트워크 오류가 발생했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ─── 댓글 삭제 핸들러 ───
  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;

    await supabase.from("comments").delete().eq("id", commentId);

    // comment_count -1
    await supabase
      .from("posts")
      .update({ comment_count: Math.max(0, post.comment_count - 1) })
      .eq("id", postId);

    await Promise.all([fetchComments(), fetchPost()]);
  };

  // ─── 로딩 화면 ───
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── 게시글 없음 ───
  if (!post) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center">
        <h2 className="mb-2 text-xl font-bold text-foreground">
          게시글을 찾을 수 없습니다
        </h2>
        <p className="mb-4 text-sm text-muted">
          삭제되었거나 존재하지 않는 게시글입니다.
        </p>
        <Link
          href="/"
          className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-black hover:bg-primary-hover"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  // 게시글 작성자 정보
  const postAuthorNickname = getAuthorNickname(post.profiles);
  const postAuthorAvatarUrl = getAuthorAvatarUrl(post.profiles);

  // 현재 유저가 이 글의 작성자인지 확인 (수정/삭제 권한)
  const isMyPost = user !== null && user.id === post.author_id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
      {/* 상단: 뒤로가기 */}
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </button>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 게시글 본문 카드 (다크 테마)                  */}
      {/* ═══════════════════════════════════════════ */}
      <article className="mb-6 rounded-xl border border-border-color bg-card-bg overflow-hidden">
        <div className="p-5">
          {/* 메타 정보 (아바타 + 카테고리 + 작성자 + 시간 + 수정/삭제) */}
          <div className="mb-3 flex items-center gap-2 text-xs">
            {/* 게시글 작성자 아바타 */}
            {postAuthorAvatarUrl ? (
              <img
                src={postAuthorAvatarUrl}
                alt={postAuthorNickname}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-border-color text-xs font-bold text-foreground">
                {postAuthorNickname.charAt(0)}
              </div>
            )}

            <span
              className={`rounded-full px-2.5 py-0.5 font-semibold ${getCategoryColor(post.category)}`}
            >
              {post.category}
            </span>
            <span className="font-medium text-foreground">
              {postAuthorNickname}
            </span>
            <span className="flex items-center gap-1 text-muted">
              <Clock className="h-3 w-3" />
              {timeAgo(post.created_at)}
            </span>

            {/* ─── 수정/삭제 더보기 메뉴 (작성자 본인만 표시) ─── */}
            {isMyPost && (
              <div className="relative ml-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu((prev) => !prev);
                  }}
                  className="rounded-full p-1.5 text-muted transition-colors hover:bg-hover-bg hover:text-primary"
                  aria-label="더보기"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {/* 드롭다운 메뉴 */}
                {showMenu && (
                  <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-border-color bg-card-bg py-1 shadow-lg">
                    {/* 수정 버튼 */}
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.push(`/edit/${postId}`);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-hover-bg hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      수정
                    </button>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleDeletePost();
                      }}
                      disabled={deleting}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 제목 */}
          <h1 className="mb-4 text-xl font-bold leading-tight text-foreground">
            {post.title}
          </h1>

          {/* 본문 (줄바꿈 유지) */}
          <div className="mb-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {post.content}
          </div>

          {/* 하단 인터랙션 바 (레딧 스타일 필 버튼) */}
          <div className="flex items-center gap-2 border-t border-border-color pt-3">
            {/* 추천/비추천 그룹 */}
            <div className="flex items-center rounded-full bg-hover-bg">
              <button
                onClick={handleToggleLike}
                className={`flex items-center rounded-l-full py-1.5 pl-3 pr-1.5 transition-colors ${
                  isLiked
                    ? "text-upvote hover:bg-upvote/20"
                    : "text-muted hover:text-upvote"
                }`}
                aria-label="추천"
              >
                <ArrowBigUp
                  className="h-5 w-5"
                  fill={isLiked ? "currentColor" : "none"}
                />
              </button>
              <span
                className={`px-1 text-xs font-bold ${
                  isLiked ? "text-upvote" : "text-foreground"
                }`}
              >
                {post.upvotes}
              </span>
              <button
                className="flex items-center rounded-r-full py-1.5 pl-1.5 pr-3 text-muted transition-colors hover:text-downvote"
                aria-label="비추천"
              >
                <ArrowBigDown className="h-5 w-5" />
              </button>
            </div>

            {/* 댓글 수 */}
            <span className="interaction-pill">
              <MessageCircle className="h-4 w-4" />
              {post.comment_count}
            </span>

            {/* 공유 */}
            <button className="interaction-pill">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">공유</span>
            </button>

            {/* 저장 */}
            <button className="interaction-pill">
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">저장</span>
            </button>
          </div>
        </div>
      </article>

      {/* ═══════════════════════════════════════════ */}
      {/* 댓글 섹션 (다크 테마)                        */}
      {/* ═══════════════════════════════════════════ */}
      <div className="rounded-xl border border-border-color bg-card-bg p-5">
        <h2 className="mb-4 text-base font-bold text-foreground">
          댓글 {post.comment_count}개
        </h2>

        {/* ─── 댓글 입력 폼 ─── */}
        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-6">
            {commentError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                {commentError}
              </div>
            )}
            <div className="flex gap-3">
              {/* 유저 아바타 (프로필 이미지 또는 이니셜) */}
              {myAvatarUrl ? (
                <img
                  src={myAvatarUrl}
                  alt="내 프로필"
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-black text-xs font-bold">
                  {user.email?.charAt(0).toUpperCase() || "?"}
                </div>
              )}
              {/* 입력 + 전송 */}
              <div className="flex-1">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="댓글을 입력하세요..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border-color bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={commentSubmitting || !commentText.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-black hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {commentSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    등록
                  </button>
                </div>
              </div>
            </div>
          </form>
        ) : (
          <div className="mb-6 rounded-lg border border-border-color bg-hover-bg p-4 text-center">
            <p className="mb-2 text-sm text-muted">
              댓글을 작성하려면 로그인이 필요합니다
            </p>
            <Link
              href="/login"
              className="inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-black hover:bg-primary-hover"
            >
              로그인
            </Link>
          </div>
        )}

        {/* ─── 댓글 목록 ─── */}
        {comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">
              아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => {
              const commentNickname = getAuthorNickname(comment.profiles);
              const commentAvatarUrl = getAuthorAvatarUrl(comment.profiles);

              return (
                <div
                  key={comment.id}
                  className="group flex gap-3 rounded-lg p-2 hover:bg-hover-bg"
                >
                  {/* 댓글 작성자 아바타 (이미지 또는 이니셜) */}
                  {commentAvatarUrl ? (
                    <img
                      src={commentAvatarUrl}
                      alt={commentNickname}
                      className="h-7 w-7 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border-color text-foreground text-xs font-bold">
                      {commentNickname.charAt(0)}
                    </div>
                  )}

                  {/* 댓글 내용 */}
                  <div className="flex-1 min-w-0">
                    {/* 작성자 + 시간 */}
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">
                        {commentNickname}
                      </span>
                      <span className="text-muted">
                        {timeAgo(comment.created_at)}
                      </span>

                      {/* 본인 댓글이면 삭제 버튼 표시 */}
                      {user && user.id === comment.user_id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
                          aria-label="댓글 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                          삭제
                        </button>
                      )}
                    </div>

                    {/* 댓글 본문 */}
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
