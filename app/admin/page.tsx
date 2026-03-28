// 파일 위치: app/admin/page.tsx
// 용도: /admin 접속 시 기본 페이지로 리다이렉트
// 동작: /admin → /admin/sort 로 자동 이동 (커뮤니티 정렬이 기본 탭)

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AdminIndexPage() {
  const router = useRouter();

  // 마운트 즉시 기본 탭으로 리다이렉트
  // (VIP 가드는 layout.tsx에서 이미 처리됨)
  useEffect(() => {
    router.replace("/admin/sort");
  }, [router]);

  // 리다이렉트 되기 전 잠깐 보이는 로딩 화면
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
