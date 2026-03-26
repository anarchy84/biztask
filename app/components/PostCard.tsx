// 파일 위치: app/components/PostCard.tsx
// 용도: BizTask 스타일 게시글 카드 (하단 보팅 바 + 인터랙션 필 버튼)
// 규격: 카드 내부 패딩 px-4 py-3 통일, 아이콘 h-4 w-4 / h-5 w-5 규격화
// 브랜드: 형광 그린 #73e346 계열
// M11: 작성자 프로필 이미지(authorAvatarUrl) 표시 추가
// M13: 이미지 썸네일을 Next.js <Image> 컴포넌트로 교체 (외부 이미지 최적화)

"use client";

import Image from "next/image";
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
  authorAvatarUrl?: string | null; // 작성자 프로필 이미지 URL (선택)
  imageUrls?: string[] | null; // 첨부 이미지 URL 배열 (선택)
  isLiked: boolean;
  onToggleLike: (e: React.MouseEvent, postId: string) => void;
  onCategoryClick: (e: React.MouseEvent, category: string) => void;
};

// ─── 카테고리 뱃지 색상 (다크 테마용) ───
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
  authorAvatarUrl,
  imageUrls,
  isLiked,
  onToggleLike,
  onCategoryClick,
}: PostCardProps) {
  return (
    <div className="post-card rounded-xl border border-border-color bg-card-bg">
      {/* 상단: 메타 정보 (아바타 + 카테고리 + 작성자 + 시간) */}
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 text-xs">
          {/* 작성자 아바타 (이미지 또는 이니셜) */}
          {authorAvatarUrl ? (
            <Image
              src={authorAvatarUrl}
              alt={authorNickname}
              width={20}
              height={20}
              className="h-5 w-5 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-border-color text-[10px] font-bold text-foreground">
              {authorNickname.charAt(0)}
            </div>
          )}

          {/* 카테고리 뱃지 */}
          <span
            onClick={(e) => onCategoryClick(e, category)}
            className={`cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-semibold hover:opacity-80 ${getCategoryColor(category)}`}
          >
            {category}
          </span>
          <span className="text-muted">
            {authorNickname} · {timeAgo(createdAt)}
          </span>
        </div>
      </div>

      {/* 중앙: 제목 + 내용 미리보기 + 이미지 썸네일 */}
      <div className="px-4 pt-1.5 pb-2">
        <h3 className="mb-1 text-[15px] font-semibold leading-snug text-foreground">
          {title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {content}
        </p>

        {/* ─── 첨부 이미지 썸네일 (Next.js Image 컴포넌트) ─── */}
        {/* 이미지 1장: 전체 너비 aspect-video */}
        {/* 이미지 2장: 반반 분할 */}
        {/* 이미지 3장+: 3등분 + 나머지 개수 오버레이 */}
        {imageUrls && imageUrls.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-hidden rounded-lg">
            {imageUrls.slice(0, 3).map((url, idx) => (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-md bg-hover-bg ${
                  imageUrls.length === 1
                    ? "aspect-video w-full"
                    : imageUrls.length === 2
                      ? "h-32 w-1/2"
                      : "h-28 w-1/3"
                }`}
              >
                <Image
                  src={url}
                  alt={`첨부 이미지 ${idx + 1}`}
                  fill
                  sizes={
                    imageUrls.length === 1
                      ? "100vw"
                      : imageUrls.length === 2
                        ? "50vw"
                        : "33vw"
                  }
                  className="object-cover"
                  loading="lazy"
                />
                {/* 3장 이상일 때 마지막 썸네일에 +N 오버레이 */}
                {idx === 2 && imageUrls.length > 3 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">
                    +{imageUrls.length - 3}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 하단: 레딧 스타일 인터랙션 바 */}
      <div className="flex items-center gap-2 px-3 pb-2.5">
        {/* 추천/비추천 그룹 (하나의 필에 묶음) */}
        <div className="flex items-center rounded-full bg-hover-bg">
          {/* 업보트 버튼 */}
          <button
            onClick={(e) => onToggleLike(e, id)}
            className={`flex items-center rounded-l-full py-1.5 pl-2.5 pr-1 transition-colors ${
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
            className={`min-w-[28px] text-center text-xs font-bold ${
              isLiked ? "text-upvote" : "text-foreground"
            }`}
          >
            {formatCount(upvotes)}
          </span>

          {/* 다운보트 버튼 */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center rounded-r-full py-1.5 pl-1 pr-2.5 text-muted transition-colors hover:text-downvote"
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
