// 파일 위치: app/components/PostCard.tsx
// 용도: 레딧 스타일 게시글 카드 (하단 보팅 바 + 인터랙션 필 버튼)
// 기능: 업보트/다운보트 토글, 댓글 수, 공유, 저장 버튼

"use client";

import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react";

// ─── Props 타입 정의 ───
type PostCardProps = {
  id: string;
  title: string;
  content: string;
  category: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
  authorNickname: string;
  isLiked: boolean;
  onToggleLike: (e: React.MouseEvent, postId: string) => void;
  onCategoryClick: (e: React.MouseEvent, category: string) => void;
};

// ─── 카테고리 뱃지 색상 (다크 테마용) ───
function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-orange-500/20 text-orange-400",
    마케팅: "bg-purple-500/20 text-purple-400",
    커리어: "bg-green-500/20 text-green-400",
    자유: "bg-amber-500/20 text-amber-400",
  };
  return colorMap[category] || "bg-gray-500/20 text-gray-400";
}

// ─── 상대 시간 포맷 ───
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

// ─── 추천 수 포맷 (1000 이상이면 1.2천 형태) ───
function formatCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}만`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}천`;
  return String(count);
}

export default function PostCard({
  id,
  title,
  content,
  category,
  upvotes,
  commentCount,
  createdAt,
  authorNickname,
  isLiked,
  onToggleLike,
  onCategoryClick,
}: PostCardProps) {
  return (
    <div className="post-card rounded-xl border border-border-color bg-card-bg overflow-hidden">
      {/* 상단: 메타 정보 (카테고리 + 작성자 + 시간) */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 text-xs">
          {/* 카테고리 뱃지 (클릭 시 필터링) */}
          <span
            onClick={(e) => onCategoryClick(e, category)}
            className={`cursor-pointer rounded-full px-2.5 py-0.5 font-semibold hover:opacity-80 ${getCategoryColor(category)}`}
          >
            {category}
          </span>
          <span className="text-muted">
            {authorNickname} · {timeAgo(createdAt)}
          </span>
        </div>
      </div>

      {/* 중앙: 제목 + 내용 미리보기 */}
      <div className="px-4 pb-2">
        <h3 className="mb-1 text-base font-semibold leading-snug text-foreground">
          {title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {content}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* 하단: 레딧 스타일 인터랙션 바 (필 버튼)         */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-1">
        {/* 추천/비추천 그룹 (하나의 필에 묶음) */}
        <div className="flex items-center rounded-full bg-hover-bg">
          {/* 업보트 버튼 */}
          <button
            onClick={(e) => onToggleLike(e, id)}
            className={`flex items-center rounded-l-full py-1.5 pl-3 pr-1.5 transition-colors ${
              isLiked
                ? "text-upvote hover:bg-upvote/20"
                : "text-muted hover:bg-hover-bg hover:text-upvote"
            }`}
            aria-label="추천"
          >
            <ArrowBigUp
              className="h-5 w-5"
              fill={isLiked ? "currentColor" : "none"}
            />
          </button>

          {/* 추천 수 */}
          <span
            className={`px-1 text-xs font-bold ${
              isLiked ? "text-upvote" : "text-foreground"
            }`}
          >
            {formatCount(upvotes)}
          </span>

          {/* 다운보트 버튼 (UI 뼈대만, 로직은 주석) */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // TODO: 다운보트 로직 구현 시 여기에 추가
            }}
            className="flex items-center rounded-r-full py-1.5 pl-1.5 pr-3 text-muted transition-colors hover:text-downvote"
            aria-label="비추천"
          >
            <ArrowBigDown className="h-5 w-5" />
          </button>
        </div>

        {/* 댓글 버튼 */}
        <span className="interaction-pill">
          <MessageCircle className="h-4 w-4" />
          {commentCount}
        </span>

        {/* 공유 버튼 */}
        <button
          className="interaction-pill"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">공유</span>
        </button>

        {/* 저장 버튼 */}
        <button
          className="interaction-pill"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">저장</span>
        </button>
      </div>
    </div>
  );
}
