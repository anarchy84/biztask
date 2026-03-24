// 파일 위치: app/components/FeaturedSlider.tsx
// 용도: 메인 피드 상단 가로 슬라이딩 배너 (레딧 Trending Today 스타일)
// 기능: 모바일 스와이프 + PC 마우스 휠 + 스크롤 스냅

"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";

// ─── 슬라이더 카드 데이터 (하드코딩 샘플) ───
const FEATURED_ITEMS = [
  {
    id: "f1",
    category: "사업",
    categoryColor: "bg-orange-500",
    title: "강남 스터디룸 대관 꿀팁 A to Z",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=340&fit=crop",
  },
  {
    id: "f2",
    category: "마케팅",
    categoryColor: "bg-purple-500",
    title: "비전공자 마케터 연봉 5천 찍는 법",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=340&fit=crop",
  },
  {
    id: "f3",
    category: "커리어",
    categoryColor: "bg-green-500",
    title: "이직할 때 꼭 체크해야 할 독소조항 3가지",
    image:
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=340&fit=crop",
  },
  {
    id: "f4",
    category: "자유",
    categoryColor: "bg-amber-500",
    title: "점심 메뉴 결정 장애 해결해 드림 (투표)",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=340&fit=crop",
  },
];

export default function FeaturedSlider() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // ─── 스크롤 상태 감지 (좌/우 화살표 표시 여부 결정) ───
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    // 현재 활성 인덱스 계산 (스냅 포인트 기준)
    const cardWidth = el.clientWidth * 0.75; // 카드 너비 약 75%
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, FEATURED_ITEMS.length - 1));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll(); // 초기 체크
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

  // ─── 화살표 클릭으로 스크롤 ───
  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  return (
    <div className="mb-3">
      {/* 섹션 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Flame className="h-4 w-4 text-red-500" />
          Featured
        </h2>

        {/* 인디케이터 점 */}
        <div className="flex items-center gap-1">
          {FEATURED_ITEMS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* 슬라이더 컨테이너 */}
      <div className="group relative">
        {/* 좌측 화살표 (PC에서 호버 시 표시) */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute -left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-lg backdrop-blur-sm transition-opacity hover:bg-white lg:group-hover:block"
            aria-label="이전"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* 우측 화살표 */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow-lg backdrop-blur-sm transition-opacity hover:bg-white lg:group-hover:block"
            aria-label="다음"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        )}

        {/* 가로 스크롤 영역 */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {FEATURED_ITEMS.map((item) => (
            <a
              key={item.id}
              href="#"
              className="relative shrink-0 overflow-hidden rounded-xl"
              style={{
                scrollSnapAlign: "start",
                width: "75%",
                minWidth: "260px",
                maxWidth: "400px",
              }}
            >
              {/* 카드: 16:9 비율 이미지 + 오버레이 */}
              <div className="relative aspect-video w-full">
                {/* 배경 이미지 */}
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                {/* 하단 그라데이션 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* 텍스트 콘텐츠 (오버레이 위) */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  {/* 카테고리 뱃지 */}
                  <span
                    className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white ${item.categoryColor}`}
                  >
                    {item.category}
                  </span>

                  {/* 제목 */}
                  <h3 className="text-base font-bold leading-snug text-white drop-shadow-md sm:text-lg">
                    {item.title}
                  </h3>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
