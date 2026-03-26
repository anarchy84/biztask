// 파일 위치: app/components/PostCard.tsx
// 용도: BizTask 스타일 게시글 카드 (하단 보팅 바 + 인터랙션 필 버튼)
// 규격: 카드 내부 패딩 px-4 py-3 통일, 아이콘 h-4 w-4 / h-5 w-5 규격화
// 브랜드: 형광 그린 #73e346 계열
// M11: 작성자 프로필 이미지(authorAvatarUrl) 표시 추가
// M13: 이미지 썸네일을 Next.js <Image> 컴포넌트로 교체 (외부 이미지 최적화)

"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageCircle,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
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

// ─── 레딧 스타일 이미지 슬라이더 컴포넌트 ───
// 블러 배경 위에 원본 비율 이미지를 센터 정렬로 표시
// 여러 장이면 좌우 화살표 + 도트 인디케이터로 슬라이드
function ImageSlider({ imageUrls }: { imageUrls?: string[] | null }) {
  // 슬라이더 현재 인덱스 상태
  const [currentIdx, setCurrentIdx] = useState(0);

  // 이미지가 없으면 아무것도 렌더링하지 않음
  if (!imageUrls || imageUrls.length === 0) return null;

  const total = imageUrls.length;
  const currentUrl = imageUrls[currentIdx];

  // 이전 이미지로 이동 (루핑: 첫 번째 → 마지막)
  const goPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIdx((prev) => (prev === 0 ? total - 1 : prev - 1));
  };

  // 다음 이미지로 이동 (루핑: 마지막 → 첫 번째)
  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIdx((prev) => (prev === total - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative mt-2 aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
      {/* 레이어 1: 블러 배경 이미지 (같은 이미지를 확대+블러 처리) */}
      <Image
        src={currentUrl}
        alt="배경 블러"
        fill
        sizes="100vw"
        className="object-cover scale-110 blur-2xl opacity-40"
        loading="lazy"
        priority={false}
      />

      {/* 레이어 2: 전경 이미지 (원본 비율 유지, 중앙 정렬) */}
      <Image
        src={currentUrl}
        alt={`첨부 이미지 ${currentIdx + 1}`}
        fill
        sizes="100vw"
        className="object-contain object-center z-10"
        loading="lazy"
        priority={false}
      />

      {/* 여러 장일 때만 슬라이더 UI 표시 */}
      {total > 1 && (
        <>
          {/* 좌측 화살표 버튼 */}
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110"
            aria-label="이전 이미지"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* 우측 화살표 버튼 */}
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110"
            aria-label="다음 이미지"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* 하단 도트 인디케이터 */}
          <div className="absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5">
            {imageUrls.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentIdx(idx);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIdx
                    ? "w-4 bg-primary"       // 현재 이미지: 형광 그린 + 넓은 바
                    : "w-1.5 bg-white/50 hover:bg-white/80"  // 다른 이미지: 작은 점
                }`}
                aria-label={`이미지 ${idx + 1}번으로 이동`}
              />
            ))}
          </div>

          {/* 우상단 이미지 카운터 뱃지 (예: 2/5) */}
          <span className="absolute top-2.5 right-2.5 z-20 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white/90 backdrop-blur-sm">
            {currentIdx + 1}/{total}
          </span>
        </>
      )}
    </div>
  );
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

        {/* ─── 레딧 스타일 이미지 슬라이더 ─── */}
        {/* 고정 비율 컨테이너 (4:3) + 블러 배경 + 센터 이미지 */}
        {/* 여러 장일 때: 좌우 화살표 + 하단 도트 인디케이터 */}
        <ImageSlider imageUrls={imageUrls} />
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
