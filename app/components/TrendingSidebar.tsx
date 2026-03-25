// 파일 위치: app/components/TrendingSidebar.tsx
// 용도: 🔥 실시간 인기글 랭킹보드 - 추천(upvotes) 수 기준 상위 5개 게시글
// 데스크탑(lg 이상)에서만 표시, sticky top-16으로 스크롤 시 고정
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import Link from "next/link";
import {
  Flame,
  ArrowBigUp,
  MessageCircle,
  ChevronRight,
} from "lucide-react";

// ─── Props 타입 정의 ───
type TrendingItem = {
  id: string;
  title: string;
  upvotes: number;
  comment_count: number;
  category: string;
};

type TrendingSidebarProps = {
  items: TrendingItem[];
};

// ─── 카테고리 뱃지 색상 (소형 버전) ───
function getCategoryMiniColor(category: string): string {
  const colorMap: Record<string, string> = {
    사업: "text-primary-light",
    마케팅: "text-purple-400",
    커리어: "text-cyan-400",
    자유: "text-amber-400",
  };
  return colorMap[category] || "text-gray-400";
}

// ─── 순위 뱃지 스타일 (1~3위 형광 그린 강조, 4~5위 일반) ───
function getRankStyle(rank: number): string {
  if (rank <= 3) {
    // 1~3위: 형광 그린 배경 + 검정 텍스트
    return "bg-primary text-black";
  }
  // 4~5위: 어두운 배경 + 회색 텍스트
  return "bg-hover-bg text-muted";
}

export default function TrendingSidebar({ items }: TrendingSidebarProps) {
  return (
    <div className="rounded-xl border border-border-color bg-card-bg overflow-hidden">
      {/* ─── 헤더: 형광 그린 그라데이션 배경 ─── */}
      <div className="bg-gradient-to-r from-primary to-primary-light px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-black">
          <Flame className="h-4 w-4" />
          실시간 인기글
        </h2>
        <p className="mt-0.5 text-[11px] font-medium text-black/60">
          추천 수 기준 TOP 5
        </p>
      </div>

      {/* ─── 인기글 리스트 ─── */}
      {items.length > 0 ? (
        <div className="divide-y divide-border-color">
          {items.map((item, index) => {
            const rank = index + 1;

            return (
              <Link
                key={item.id}
                href={`/post/${item.id}`}
                className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-hover-bg"
              >
                {/* 순위 뱃지 */}
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${getRankStyle(rank)}`}
                >
                  {rank}
                </span>

                {/* 제목 + 메타 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {item.title}
                  </p>

                  {/* 카테고리 + 추천 수 + 댓글 수 */}
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className={`font-medium ${getCategoryMiniColor(item.category)}`}>
                      {item.category}
                    </span>
                    <span className="flex items-center gap-0.5 text-primary">
                      <ArrowBigUp className="h-3 w-3" />
                      {item.upvotes}
                    </span>
                    <span className="flex items-center gap-0.5 text-muted">
                      <MessageCircle className="h-3 w-3" />
                      {item.comment_count}
                    </span>
                  </div>
                </div>

                {/* 화살표 아이콘 */}
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-8 text-center">
          <Flame className="mx-auto mb-2 h-6 w-6 text-muted" />
          <p className="text-sm text-muted">
            아직 인기글이 없습니다
          </p>
        </div>
      )}

      {/* ─── 하단: 더보기 링크 ─── */}
      {items.length > 0 && (
        <div className="border-t border-border-color px-4 py-2.5">
          <Link
            href="/?sort=popular"
            className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary-light transition-colors"
          >
            인기글 더보기
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
