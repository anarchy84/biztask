// 파일 위치: app/popular/page.tsx
// 용도: 인기 게시글 모아보기 페이지 (준비 중 껍데기)
// 사이드바 "인기" 메뉴 클릭 시 이동되는 페이지
// 브랜드: 형광 그린 #73e346 계열 다크 테마

import Link from "next/link";
import { Flame, ArrowLeft } from "lucide-react";

export default function PopularPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      {/* 아이콘 */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <Flame className="h-10 w-10 text-red-400" />
      </div>

      {/* 제목 */}
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        🔥 인기 게시글
      </h1>

      {/* 설명 */}
      <p className="mb-8 text-sm leading-relaxed text-muted">
        가장 많은 추천을 받은 인기 게시글을 모아보는 페이지입니다.
        <br />
        곧 멋진 기능으로 찾아올게요!
      </p>

      {/* 홈으로 돌아가기 버튼 */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-primary-hover"
      >
        <ArrowLeft className="h-4 w-4" />
        홈으로 돌아가기
      </Link>
    </div>
  );
}
