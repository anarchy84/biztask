// 파일 위치: app/components/FeaturedSlider.tsx
// 용도: 메인 피드 상단 가로 슬라이딩 배너 (BizTask 다크 테마)
// 데이터: Supabase posts 테이블에서 is_featured = true인 게시글을 최신순으로 불러옴
// VIP가 게시글 상세에서 "메인 배너 노출" 버튼으로 직접 관리
// 규격: 카드 너비 min 240px / max 380px / gap-3 통일, aspect-[16/10]
// 브랜드: 형광 그린 #73e346 계열

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Flame, ImageIcon } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

// ─── 카테고리별 뱃지 배경색 ───
function getCategoryBadgeColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "bg-primary",
    마케팅: "bg-purple-600",
    커리어: "bg-cyan-500",
    자유: "bg-amber-500",
    칼럼: "bg-indigo-600",
  };
  return colorMap[category] || "bg-gray-500";
}

// ─── Featured 게시글 타입 (posts 테이블에서 직접 조회) ───
type FeaturedPost = {
  id: string;
  title: string;
  category: string;
  image_urls: string[] | null;
  created_at: string;
  profiles: { nickname: string } | { nickname: string }[] | null;
};

// ─── 프로필 닉네임 추출 헬퍼 ───
function getAuthorNickname(
  profiles: { nickname: string } | { nickname: string }[] | null
): string {
  if (!profiles) return "익명";
  if (Array.isArray(profiles)) return profiles[0]?.nickname || "익명";
  return profiles.nickname || "익명";
}

export default function FeaturedSlider() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // ─── DB에서 불러온 Featured 게시글 목록 ───
  const [items, setItems] = useState<FeaturedPost[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── is_featured = true인 게시글을 최신순으로 불러오기 ───
  const fetchFeatured = useCallback(async () => {
    // posts 테이블에서 is_featured가 true인 게시글만 조회
    // 최신순으로 정렬하고 최대 10개까지만 표시
    const { data } = await supabase
      .from("posts")
      .select(
        `id, title, category, image_urls, created_at,
         profiles ( nickname )`
      )
      .eq("is_featured", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setItems(data as FeaturedPost[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeatured();
  }, [fetchFeatured]);

  // ─── 스크롤 상태 감지 ───
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    const cardWidth = el.clientWidth * 0.7;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, items.length - 1));
  }, [items.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  // ─── 화살표 클릭 스크롤 ───
  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // ─── 로딩 중이거나 데이터 없으면 렌더링 안 함 ───
  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      {/* 섹션 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Flame className="h-4 w-4 text-red-400" />
          Featured
        </h2>

        {/* 인디케이터 점 */}
        <div className="flex items-center gap-1">
          {items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-border-color"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 슬라이더 컨테이너 */}
      <div className="group relative">
        {/* 좌측 화살표 */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-card-bg/90 p-1.5 shadow-lg border border-border-color backdrop-blur-sm hover:bg-hover-bg lg:group-hover:block"
            aria-label="이전"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* 우측 화살표 */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-card-bg/90 p-1.5 shadow-lg border border-border-color backdrop-blur-sm hover:bg-hover-bg lg:group-hover:block"
            aria-label="다음"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* 가로 스크롤 영역 */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {items.map((post) => {
            const hasImage = post.image_urls && post.image_urls.length > 0;
            const authorName = getAuthorNickname(post.profiles);

            return (
              <button
                key={post.id}
                onClick={() => router.push(`/post/${post.id}`)}
                className="relative shrink-0 overflow-hidden rounded-xl border border-border-color text-left"
                style={{
                  scrollSnapAlign: "start",
                  width: "70%",
                  minWidth: "240px",
                  maxWidth: "380px",
                }}
              >
                {/* 카드 이미지 + 오버레이 */}
                <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                  {hasImage ? (
                    <Image
                      src={post.image_urls![0]}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 70vw, 380px"
                      className="object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-card-bg to-hover-bg">
                      <ImageIcon className="h-12 w-12 text-muted" />
                    </div>
                  )}

                  {/* 하단 그라데이션 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* 텍스트 콘텐츠 */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${getCategoryBadgeColor(post.category)}`}
                      >
                        {post.category}
                      </span>
                      <span className="text-[11px] text-white/70">
                        {authorName}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold leading-snug text-white drop-shadow-md sm:text-base">
                      {post.title}
                    </h3>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
