// 파일 위치: app/communities/page.tsx
// 용도: 둘러보기(커뮤니티 탐색) 페이지 (준비 중 껍데기)
// 사이드바 "둘러보기" 메뉴 클릭 시 이동되는 페이지
// 브랜드: 형광 그린 #73e346 계열 다크 테마

import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function CommunitiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      {/* 아이콘 */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
        <Compass className="h-10 w-10 text-amber-400" />
      </div>

      {/* 제목 */}
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        🧭 둘러보기
      </h1>

      {/* 설명 */}
      <p className="mb-8 text-sm leading-relaxed text-muted">
        다양한 커뮤니티를 탐색하고 관심사에 맞는 공간을 찾아보세요.
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
