// 파일 위치: app/components/FeaturedSlider.tsx
// 용도: 메인 피드 상단 가로 슬라이딩 배너 (BizTask 다크 테마)
// 규격: 카드 너비 min 240px / max 380px / gap-3 통일, aspect-[16/10]
// 브랜드: 형광 그린 #73e346 계열

"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";

// ─── 슬라이더 카드 데이터 ───
const FEATURED_ITEMS = [
  {
    id: "f1",
    category: "사업",
    categoryColor: "bg-primary",
    title: "강남 스터디룸 대관 꿀팁 A to Z",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=340&fit=crop",
  },
  {
    id: "f2",
    category: "마케팅",
    categoryColor: "bg-purple-600",
    title: "비전공자 마케터 연봉 5천 찍는 법",
    image:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=340&fit=crop",
  },
  {
    id: "f3",
    category: "커리어",
    categoryColor: "bg-cyan-500",
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

  // ─── 스크롤 상태 감지 ───
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;

    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);

    const cardWidth = el.clientWidth * 0.7;
    const index = Math.round(el.scrollLeft / cardWidth);
    setActiveIndex(Math.min(index, FEATURED_ITEMS.length - 1));
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, []);

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
          {FEATURED_ITEMS.map((_, i) => (
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
          {FEATURED_ITEMS.map((item) => (
            <a
              key={item.id}
              href="#"
              className="relative shrink-0 overflow-hidden rounded-xl border border-border-color"
              style={{
                scrollSnapAlign: "start",
                width: "70%",
                minWidth: "240px",
                maxWidth: "380px",
              }}
            >
              {/* 카드 이미지 + 오버레이 */}
              <div className="relative" style={{ aspectRatio: "16 / 10" }}>
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />

                {/* 하단 그라데이션 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* 텍스트 콘텐츠 */}
                <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                  <span
                    className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${item.categoryColor}`}
                  >
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold leading-snug text-white drop-shadow-md sm:text-base">
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
