// 파일 위치: app/news/page.tsx
// 용도: 뉴스 탭 페이지 (준비 중 껍데기)
// 사이드바 "뉴스" 메뉴 클릭 시 이동되는 페이지
// 브랜드: 형광 그린 #73e346 계열 다크 테마

import Link from "next/link";
import { Newspaper, ArrowLeft } from "lucide-react";

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      {/* 아이콘 */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-cyan-500/10">
        <Newspaper className="h-10 w-10 text-cyan-400" />
      </div>

      {/* 제목 */}
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        📰 뉴스
      </h1>

      {/* 설명 */}
      <p className="mb-8 text-sm leading-relaxed text-muted">
        비즈니스·마케팅 관련 최신 뉴스를 모아보는 공간입니다.
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
