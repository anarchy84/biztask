// 파일 위치: app/post/[id]/PostDetailClient.tsx
// 용도: 게시글 상세 페이지 클라이언트 컴포넌트 (UI + 인터랙션)
// page.tsx(서버 컴포넌트)에서 import하여 사용
// 브랜드: 형광 그린 #73e346 계열
// M11: 게시글 작성자 + 댓글 작성자 프로필 이미지 표시
// M12: 작성자 본인만 수정/삭제 버튼 표시 + 삭제 로직
// M13: 이미지 갤러리를 Next.js <Image> 컴포넌트로 교체 (fill + object-contain)

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
  Crown,
  Flame,
  FileText,
  Drama,
  CornerDownRight,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useImpersonation } from "@/app/context/ImpersonationContext";

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
  image_urls: string[] | null; // 첨부 이미지 URL 배열
  is_featured: boolean; // 메인 배너 노출 여부
  profiles: ProfileInfo | ProfileInfo[] | null;
};

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
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

  // ─── 빙의(Impersonation) 전역 상태 ───
  const { impersonating, isImpersonating } = useImpersonation();

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

  // 답글 관련 상태
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyingToNickname, setReplyingToNickname] = useState<string>("");

  // 게시글 삭제 관련 상태
  const [deleting, setDeleting] = useState(false);

  // 더보기 메뉴 (수정/삭제) 토글 상태
  const [showMenu, setShowMenu] = useState(false);

  // ─── 댓글 인라인 수정 관련 상태 ───
  // editingCommentId: 현재 수정 중인 댓글의 ID (null이면 수정 모드 아님)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  // editCommentText: 수정 중인 댓글의 텍스트
  const [editCommentText, setEditCommentText] = useState("");
  // editCommentSaving: 댓글 수정 저장 중 로딩 상태
  const [editCommentSaving, setEditCommentSaving] = useState(false);

  // ─── 공유/저장(북마크) 관련 상태 ───
  // isSaved: 현재 유저가 이 게시글을 북마크했는지 여부
  const [isSaved, setIsSaved] = useState(false);
  // shareToast: 공유 링크 복사 완료 토스트 메시지 표시 여부
  const [shareToast, setShareToast] = useState(false);

  // ─── VIP 관리 도구 관련 상태 ───
  // isVip: 현재 로그인한 유저가 VIP인지 여부
  const [isVip, setIsVip] = useState(false);
  // VIP 액션 로딩 상태 (칼럼 승격 / 배너 토글 중)
  const [vipActionLoading, setVipActionLoading] = useState(false);

  // ─── 게시글 불러오기 ───
  const fetchPost = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select(
        `id, title, content, category, upvotes, comment_count, created_at, author_id, image_urls, is_featured,
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
        `id, post_id, user_id, content, created_at, parent_id,
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

  // ─── 내가 이 글을 저장(북마크)했는지 확인 ───
  const checkMySave = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("saved_posts")
        .select("id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      setIsSaved(!!data);
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
        await Promise.all([
          checkMyLike(session.user.id),
          checkMySave(session.user.id),
        ]);

        // 내 프로필 아바타 + VIP 여부 가져오기
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("avatar_url, is_vip")
          .eq("id", session.user.id)
          .single();

        if (myProfile?.avatar_url) {
          setMyAvatarUrl(myProfile.avatar_url);
        }
        // VIP 여부 설정 (VIP 관리 도구 표시에 사용)
        if (myProfile?.is_vip) {
          setIsVip(true);
        }
      }

      await Promise.all([fetchPost(), fetchComments()]);
      setLoading(false);
    };

    init();
  }, [fetchPost, fetchComments, checkMyLike, checkMySave]);

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
  // 게시글 삭제 핸들러 (작성자 본인 또는 VIP 어드민)
  // ═══════════════════════════════════════════════════════
  const handleDeletePost = async () => {
    if (!user || !post) return;
    // 권한 체크: 작성자 본인이거나 VIP 어드민이어야 삭제 가능
    if (user.id !== post.author_id && !isVip) return;

    // VIP 어드민이 남의 글을 삭제할 때는 다른 경고 메시지
    const confirmMsg = user.id !== post.author_id
      ? "🔴 어드민 삭제\n\n이 글과 달린 댓글·추천을 모두 삭제합니다.\n이 작업은 되돌릴 수 없습니다."
      : "정말 이 글을 삭제하시겠습니까?\n삭제된 글은 복구할 수 없습니다.";
    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    setDeleting(true);

    try {
      // scraped_sources FK 참조 해제 (result_post_id → null)
      await supabase.from("scraped_sources").update({ result_post_id: null }).eq("result_post_id", postId);

      // 게시글에 달린 댓글 먼저 삭제 (FK 제약조건 방지)
      await supabase.from("comments").delete().eq("post_id", postId);

      // 게시글에 달린 좋아요 삭제
      await supabase.from("post_likes").delete().eq("post_id", postId);

      // 게시글 삭제 (VIP는 author_id 제한 없이 삭제)
      let deleteQuery = supabase.from("posts").delete().eq("id", postId);
      if (!isVip) {
        deleteQuery = deleteQuery.eq("author_id", user.id); // 일반 유저: 본인 글만
      }
      const { error: deleteError } = await deleteQuery;

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

      // ─── 빙의 모드: NPC의 user_id를 댓글 작성자로 사용 ───
      const effectiveUserId = isImpersonating && impersonating
        ? impersonating.user_id
        : user.id;

      // 댓글 삽입
      const { error: insertError } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: effectiveUserId,
        content: commentText.trim(),
        parent_id: replyingTo || null,
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
      setReplyingTo(null);
      setReplyingToNickname("");
      await Promise.all([fetchComments(), fetchPost()]);
    } catch {
      setCommentError("네트워크 오류가 발생했습니다.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ─── 답글 핸들러 ───
  const handleReply = (commentId: string, nickname: string) => {
    setReplyingTo(commentId);
    setReplyingToNickname(nickname);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyingToNickname("");
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

  // ═══════════════════════════════════════════════════════
  // 댓글 인라인 수정 핸들러
  // 1. [수정] 버튼 클릭 → 해당 댓글을 textarea로 전환
  // 2. [저장] 버튼 클릭 → Supabase comments 테이블 update
  // 3. [취소] 버튼 클릭 → 수정 모드 해제
  // ═══════════════════════════════════════════════════════

  // 수정 모드 시작: 기존 댓글 내용을 textarea에 채움
  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
  };

  // 수정 취소: 수정 모드 해제
  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentText("");
  };

  // 수정 저장: Supabase에 업데이트 요청
  const saveEditComment = async (commentId: string) => {
    if (!user || !editCommentText.trim()) return;

    setEditCommentSaving(true);

    try {
      const { error: updateError } = await supabase
        .from("comments")
        .update({ content: editCommentText.trim() })
        .eq("id", commentId)
        .eq("user_id", user.id); // 본인 댓글만 수정 가능 (안전장치)

      if (updateError) {
        alert("댓글 수정에 실패했습니다: " + updateError.message);
        return;
      }

      // 수정 모드 해제 + 댓글 목록 새로고침
      setEditingCommentId(null);
      setEditCommentText("");
      await fetchComments();
    } catch {
      alert("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setEditCommentSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // VIP 관리 도구: 칼럼 승격 핸들러
  // 해당 게시글의 category를 '칼럼'으로 변경
  // ═══════════════════════════════════════════════════════
  const handlePromoteToColumn = async () => {
    if (!user || !post || !isVip) return;

    // 이미 칼럼이면 안내
    if (post.category === "칼럼") {
      alert("이미 '칼럼' 카테고리입니다.");
      return;
    }

    const confirmed = window.confirm(
      `이 게시글을 '칼럼'으로 승격하시겠습니까?\n(현재 카테고리: ${post.category} → 칼럼)`
    );
    if (!confirmed) return;

    setVipActionLoading(true);
    const { error } = await supabase
      .from("posts")
      .update({ category: "칼럼" })
      .eq("id", post.id);

    if (error) {
      alert("칼럼 승격에 실패했습니다: " + error.message);
    } else {
      // 로컬 상태 업데이트 (새로고침 없이 즉시 반영)
      setPost((prev) => (prev ? { ...prev, category: "칼럼" } : prev));
    }
    setVipActionLoading(false);
  };

  // ═══════════════════════════════════════════════════════
  // VIP 관리 도구: 메인 배너 노출 토글 핸들러
  // is_featured 값을 true/false로 전환
  // ═══════════════════════════════════════════════════════
  const handleToggleFeatured = async () => {
    if (!user || !post || !isVip) return;

    const newValue = !post.is_featured;
    const action = newValue ? "메인 배너에 노출" : "메인 배너에서 제거";
    const confirmed = window.confirm(`이 게시글을 ${action}하시겠습니까?`);
    if (!confirmed) return;

    setVipActionLoading(true);
    const { error } = await supabase
      .from("posts")
      .update({ is_featured: newValue })
      .eq("id", post.id);

    if (error) {
      alert(`${action}에 실패했습니다: ` + error.message);
    } else {
      // 로컬 상태 업데이트 (새로고침 없이 즉시 반영)
      setPost((prev) => (prev ? { ...prev, is_featured: newValue } : prev));
    }
    setVipActionLoading(false);
  };

  // ═══════════════════════════════════════════════════════
  // 공유 기능: 현재 게시글 URL을 클립보드에 복사
  // ═══════════════════════════════════════════════════════
  const handleShare = async () => {
    try {
      // 현재 페이지 URL을 클립보드에 복사
      await navigator.clipboard.writeText(window.location.href);
      // 토스트 메시지 표시 (2초 후 자동 사라짐)
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      // 클립보드 API 지원 안 되는 경우 fallback
      alert("링크가 복사되었습니다: " + window.location.href);
    }
  };

  // ═══════════════════════════════════════════════════════
  // 저장(북마크) 토글: saved_posts 테이블에 insert/delete
  // ═══════════════════════════════════════════════════════
  const handleToggleSave = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (isSaved) {
      // 이미 저장된 상태 → 저장 해제 (delete)
      await supabase
        .from("saved_posts")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      setIsSaved(false);
    } else {
      // 저장하지 않은 상태 → 저장 (insert)
      await supabase
        .from("saved_posts")
        .insert({ post_id: postId, user_id: user.id });

      setIsSaved(true);
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
  // VIP 어드민은 모든 글에 대해 삭제 권한 보유
  const isMyPost = user !== null && (user.id === post.author_id || isVip);

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
              <Image
                src={postAuthorAvatarUrl}
                alt={postAuthorNickname}
                width={24}
                height={24}
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

            {/* ─── 수정/삭제 더보기 메뉴 (작성자 본인 또는 VIP 어드민) ─── */}
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
                    {/* 수정 버튼 (본인 글에만 표시, VIP가 남의 글 볼 때는 숨김) */}
                    {user && user.id === post.author_id && (
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
                    )}

                    {/* 삭제 버튼 (본인 글 + VIP 어드민) */}
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

          {/* ─── 이미지 영역 (제목 바로 아래, 본문 위) ─── */}
          {/* image_urls가 있으면 Supabase 이미지를 시원하게 세로 나열 */}
          {post.image_urls && post.image_urls.length > 0 && (
            <div className="mb-6 space-y-4">
              {post.image_urls.map((url, idx) => (
                <div
                  key={idx}
                  className="relative w-full overflow-hidden rounded-xl bg-hover-bg"
                >
                  <Image
                    src={url}
                    alt={`첨부 이미지 ${idx + 1}`}
                    width={800}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="w-full h-auto object-contain rounded-xl"
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ─── 본문 텍스트 (이미지 아래) ─── */}
          {/* image_urls가 있으면 content 내 외부 <img> 태그 제거 (핫링크 차단 대응) */}
          <div
            className="mb-5 text-sm leading-relaxed text-foreground whitespace-pre-wrap [&_img]:w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-4"
            dangerouslySetInnerHTML={{
              __html: post.image_urls && post.image_urls.length > 0
                ? post.content.replace(/<img\s[^>]*\/?>/gi, "")
                : post.content,
            }}
          />

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

            {/* 공유 — 클릭 시 URL 클립보드 복사 */}
            <button onClick={handleShare} className="interaction-pill">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">공유</span>
            </button>

            {/* 저장(북마크) — 클릭 시 saved_posts 토글 */}
            <button
              onClick={handleToggleSave}
              className={`interaction-pill ${isSaved ? "text-primary" : ""}`}
            >
              <Bookmark
                className="h-4 w-4"
                fill={isSaved ? "currentColor" : "none"}
              />
              <span className="hidden sm:inline">
                {isSaved ? "저장됨" : "저장"}
              </span>
            </button>
          </div>

          {/* 공유 완료 토스트 메시지 */}
          {shareToast && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary animate-pulse">
              <Share2 className="h-3 w-3" />
              링크가 클립보드에 복사되었습니다!
            </div>
          )}
        </div>
      </article>

      {/* ═══════════════════════════════════════════ */}
      {/* VIP 관리 도구 (VIP 유저에게만 표시)            */}
      {/* ═══════════════════════════════════════════ */}
      {isVip && post && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-400 mb-3">
            <Crown className="h-4 w-4" />
            VIP 관리 도구
          </h3>
          <div className="flex flex-wrap gap-2">
            {/* 칼럼으로 승격 버튼 */}
            <button
              onClick={handlePromoteToColumn}
              disabled={vipActionLoading || post.category === "칼럼"}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                post.category === "칼럼"
                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              <FileText className="h-4 w-4" />
              {post.category === "칼럼" ? "이미 칼럼입니다" : "💎 칼럼으로 승격"}
            </button>

            {/* 메인 배너 노출 토글 버튼 */}
            <button
              onClick={handleToggleFeatured}
              disabled={vipActionLoading}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                post.is_featured
                  ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  : "bg-orange-600 text-white hover:bg-orange-700"
              }`}
            >
              <Flame className="h-4 w-4" />
              {post.is_featured ? "🔥 배너에서 제거" : "🔥 메인 배너 노출"}
            </button>
          </div>

          {/* 현재 상태 안내 */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            <span>카테고리: <span className="text-foreground font-medium">{post.category}</span></span>
            <span>배너 노출: <span className={post.is_featured ? "text-primary font-medium" : "text-muted"}>{post.is_featured ? "ON" : "OFF"}</span></span>
          </div>
        </div>
      )}

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
            {/* 빙의 모드 안내 (NPC로 댓글 작성 중일 때) */}
            {isImpersonating && impersonating && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs text-amber-300">
                <Drama className="h-3.5 w-3.5 shrink-0" />
                <span>&apos;{impersonating.nickname}&apos; 명의로 댓글을 작성합니다</span>
              </div>
            )}
            {/* 답글 작성 중 안내 */}
            {replyingTo && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs text-blue-300">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0" />
                <span>&apos;{replyingToNickname}&apos;에게 답글 작성 중</span>
                <button onClick={cancelReply} className="ml-auto text-blue-400 hover:text-blue-200">✕</button>
              </div>
            )}
            <div className="flex gap-3">
              {/* 유저 아바타 — 빙의 중이면 NPC 아바타 표시 */}
              {isImpersonating && impersonating ? (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-300 ring-2 ring-amber-500/30">
                  {impersonating.avatar_url ? (
                    <img src={impersonating.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    impersonating.nickname.charAt(0)
                  )}
                </div>
              ) : myAvatarUrl ? (
                <Image
                  src={myAvatarUrl}
                  alt="내 프로필"
                  width={32}
                  height={32}
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
            {(() => {
              // 부모 댓글과 답글 분리
              const parentComments = comments.filter(c => !c.parent_id);
              const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

              return parentComments.map((comment) => {
                const commentNickname = getAuthorNickname(comment.profiles);
                const commentAvatarUrl = getAuthorAvatarUrl(comment.profiles);
                const replies = getReplies(comment.id);

                return (
                  <div key={comment.id}>
                    {/* 부모 댓글 */}
                    <div className="group flex gap-3 rounded-lg p-2 hover:bg-hover-bg">
                      {/* 댓글 작성자 아바타 (이미지 또는 이니셜) */}
                      {commentAvatarUrl ? (
                        <Image
                          src={commentAvatarUrl}
                          alt={commentNickname}
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-border-color text-foreground text-xs font-bold">
                          {commentNickname.charAt(0)}
                        </div>
                      )}

                      {/* 댓글 내용 */}
                      <div className="flex-1 min-w-0">
                        {/* 작성자 + 시간 + 수정/삭제/답글 버튼 */}
                        <div className="mb-1 flex items-center gap-2 text-xs">
                          <span className="font-medium text-foreground">
                            {commentNickname}
                          </span>
                          <span className="text-muted">
                            {timeAgo(comment.created_at)}
                          </span>

                          {/* 버튼들 (hover 시 표시) */}
                          <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            {/* 답글 버튼 */}
                            <button
                              onClick={() => handleReply(comment.id, commentNickname)}
                              className="flex items-center gap-1 text-xs text-muted hover:text-primary"
                              aria-label="답글 작성"
                            >
                              <CornerDownRight className="h-3 w-3" />
                              답글
                            </button>
                            {/* 본인 댓글이면 수정/삭제 버튼, VIP는 삭제만 표시 */}
                            {user && (user.id === comment.user_id || isVip) && editingCommentId !== comment.id && (
                              <>
                                {/* 수정 버튼 (본인 댓글에만 표시) */}
                                {user.id === comment.user_id && (
                                  <button
                                    onClick={() => startEditComment(comment)}
                                    className="flex items-center gap-1 text-xs text-muted hover:text-primary"
                                    aria-label="댓글 수정"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    수정
                                  </button>
                                )}
                                {/* 삭제 버튼 (본인 댓글 + VIP 어드민) */}
                                <button
                                  onClick={() => handleDeleteComment(comment.id)}
                                  className={`flex items-center gap-1 text-xs ${
                                    user.id !== comment.user_id
                                      ? "text-red-400/70 hover:text-red-400"
                                      : "text-muted hover:text-red-400"
                                  }`}
                                  aria-label="댓글 삭제"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* ─── 댓글 본문 또는 인라인 수정 textarea ─── */}
                        {editingCommentId === comment.id ? (
                          // 수정 모드: textarea + 저장/취소 버튼
                          <div className="mt-1">
                            <textarea
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              rows={3}
                              className="w-full resize-none rounded-lg border border-primary/50 bg-input-bg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                            <div className="mt-1.5 flex items-center gap-2">
                              {/* 저장 버튼 */}
                              <button
                                onClick={() => saveEditComment(comment.id)}
                                disabled={editCommentSaving || !editCommentText.trim()}
                                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-black hover:bg-primary-hover disabled:opacity-50"
                              >
                                {editCommentSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3" />
                                )}
                                저장
                              </button>
                              {/* 취소 버튼 */}
                              <button
                                onClick={cancelEditComment}
                                className="rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:bg-hover-bg hover:text-foreground"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          // 일반 모드: 댓글 본문 텍스트
                          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 답글 목록 (들여쓰기) */}
                    {replies.length > 0 && (
                      <div className="ml-10 mt-2 space-y-4 border-l border-border-color pl-4">
                        {replies.map((reply) => {
                          const replyNickname = getAuthorNickname(reply.profiles);
                          const replyAvatarUrl = getAuthorAvatarUrl(reply.profiles);

                          return (
                            <div key={reply.id} className="group flex gap-3 rounded-lg p-2 hover:bg-hover-bg">
                              {/* 답글 작성자 아바타 */}
                              {replyAvatarUrl ? (
                                <Image
                                  src={replyAvatarUrl}
                                  alt={replyNickname}
                                  width={24}
                                  height={24}
                                  className="h-6 w-6 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-border-color text-foreground text-xs font-bold">
                                  {replyNickname.charAt(0)}
                                </div>
                              )}

                              {/* 답글 내용 */}
                              <div className="flex-1 min-w-0">
                                {/* 작성자 + 시간 + 수정/삭제 버튼 */}
                                <div className="mb-1 flex items-center gap-2 text-xs">
                                  <span className="font-medium text-foreground">
                                    {replyNickname}
                                  </span>
                                  <span className="text-muted">
                                    {timeAgo(reply.created_at)}
                                  </span>

                                  {/* 본인 답글이면 수정/삭제 버튼 표시 */}
                                  {user && user.id === reply.user_id && editingCommentId !== reply.id && (
                                    <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                      {/* 수정 버튼 */}
                                      <button
                                        onClick={() => startEditComment(reply)}
                                        className="flex items-center gap-1 text-xs text-muted hover:text-primary"
                                        aria-label="답글 수정"
                                      >
                                        <Pencil className="h-3 w-3" />
                                        수정
                                      </button>
                                      {/* 삭제 버튼 */}
                                      <button
                                        onClick={() => handleDeleteComment(reply.id)}
                                        className="flex items-center gap-1 text-xs text-muted hover:text-red-400"
                                        aria-label="답글 삭제"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        삭제
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* ─── 답글 본문 또는 인라인 수정 textarea ─── */}
                                {editingCommentId === reply.id ? (
                                  // 수정 모드: textarea + 저장/취소 버튼
                                  <div className="mt-1">
                                    <textarea
                                      value={editCommentText}
                                      onChange={(e) => setEditCommentText(e.target.value)}
                                      rows={3}
                                      className="w-full resize-none rounded-lg border border-primary/50 bg-input-bg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                      autoFocus
                                    />
                                    <div className="mt-1.5 flex items-center gap-2">
                                      {/* 저장 버튼 */}
                                      <button
                                        onClick={() => saveEditComment(reply.id)}
                                        disabled={editCommentSaving || !editCommentText.trim()}
                                        className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-black hover:bg-primary-hover disabled:opacity-50"
                                      >
                                        {editCommentSaving ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Send className="h-3 w-3" />
                                        )}
                                        저장
                                      </button>
                                      {/* 취소 버튼 */}
                                      <button
                                        onClick={cancelEditComment}
                                        className="rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:bg-hover-bg hover:text-foreground"
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // 일반 모드: 답글 본문 텍스트
                                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                    {reply.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
