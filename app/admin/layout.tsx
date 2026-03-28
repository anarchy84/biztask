// 파일 위치: app/admin/layout.tsx
// 용도: /admin 하위 모든 페이지에 적용되는 공통 레이아웃
// 기능: VIP 권한 가드 (로그인+VIP 체크) + 상단 내비게이션 탭(LNB)
// 디자인: 다크 테마 + 형광 그린 #73e346 활성 탭

"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import {
  ArrowLeft,
  Loader2,
  Shield,
  GripVertical,
  Bot,
  Star,
} from "lucide-react";

// ─── 어드민 내비게이션 메뉴 정의 ───
// 여기에 새 어드민 메뉴를 추가하면 탭이 자동으로 늘어남
const ADMIN_TABS = [
  {
    label: "커뮤니티 정렬",
    path: "/admin/sort",
    icon: GripVertical,
    emoji: "🗂️",
    description: "사이드바 순서 관리",
  },
  {
    label: "NPC 페르소나",
    path: "/admin/personas",
    icon: Bot,
    emoji: "🤖",
    description: "AI 캐릭터 관리",
  },
  {
    label: "추천 콘텐츠",
    path: "/admin/featured",
    icon: Star,
    emoji: "⭐",
    description: "큐레이션 관리",
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  // ─── VIP 인증 상태 ───
  const [authState, setAuthState] = useState<
    "loading" | "unauthorized" | "authorized"
  >("loading");

  // ─── 마운트 시 VIP 체크 (한 번만 실행) ───
  useEffect(() => {
    const checkVip = async () => {
      // 1) 세션 확인 — 로그인 안 됐으면 로그인 페이지로
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      // 2) VIP 여부 확인 — VIP 아니면 홈으로
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_vip")
        .eq("id", session.user.id)
        .single();

      if (!profile?.is_vip) {
        alert("VIP 전용 페이지입니다.");
        router.push("/");
        return;
      }

      // 3) VIP 확인 완료 → children 렌더링 허용
      setAuthState("authorized");
    };

    checkVip();
  }, [router]);

  // ─── 로딩 화면 ───
  if (authState === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── 미인증 (리다이렉트 중) ───
  if (authState === "unauthorized") return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* ═══════════════════════════════════════════ */}
      {/* 어드민 헤더 + 홈으로 돌아가기               */}
      {/* ═══════════════════════════════════════════ */}
      <div className="mb-6">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>

        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          VIP 전용 관리 패널 — 커뮤니티와 콘텐츠를 한곳에서 관리하세요.
        </p>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 상단 내비게이션 탭 (LNB)                      */}
      {/* ═══════════════════════════════════════════ */}
      <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-border-color pb-0">
        {ADMIN_TABS.map((tab) => {
          // 현재 경로가 이 탭의 path로 시작하면 활성 상태
          const isActive = pathname.startsWith(tab.path);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:border-border-color hover:text-foreground"
              }`}
            >
              <span className="text-base">{tab.emoji}</span>
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ═══════════════════════════════════════════ */}
      {/* 하위 페이지 콘텐츠 영역                       */}
      {/* ═══════════════════════════════════════════ */}
      {children}
    </div>
  );
}
