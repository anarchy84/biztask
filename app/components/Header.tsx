// 파일 위치: app/components/Header.tsx
// 용도: 상단 네비게이션 바 (로그인 상태에 따라 UI가 바뀌는 클라이언트 컴포넌트)
// 비로그인: [로그인] 버튼 표시
// 로그인: 유저 아바타 + [로그아웃] 버튼 표시

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Search, User, Bell, PenSquare, LogOut } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function Header() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<SupabaseUser | null>(null); // 현재 로그인한 유저 정보
  const [loading, setLoading] = useState(true); // 초기 세션 확인 로딩 상태

  const router = useRouter();

  // ─── 컴포넌트 마운트 시 현재 세션 확인 ───
  useEffect(() => {
    // 1) 현재 세션에서 유저 정보 가져오기
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getUser();

    // 2) 인증 상태 변화 실시간 감지 (로그인/로그아웃 시 자동 UI 업데이트)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // 3) 컴포넌트 언마운트 시 구독 해제 (메모리 누수 방지)
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── 로그아웃 핸들러 ───
  const handleLogout = async () => {
    await supabase.auth.signOut(); // Supabase 세션 삭제
    setUser(null); // 로컬 상태 초기화
    router.push("/"); // 홈으로 이동
    router.refresh(); // 서버 컴포넌트도 새로고침
  };

  // ─── 유저 이메일에서 첫 글자 추출 (아바타에 표시) ───
  const getUserInitial = () => {
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border-color">
      <nav className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
        {/* 좌측: 로고 */}
        <div className="flex items-center gap-2">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white font-bold text-sm">
              B
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">
              BizTask
            </span>
          </a>
        </div>

        {/* 중앙: 검색창 */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="BizTask 검색..."
              className="w-full rounded-full border border-border-color bg-background py-1.5 pl-10 pr-4 text-sm placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* 우측: 로그인 상태에 따라 다른 UI */}
        <div className="flex items-center gap-1">
          {/* 글쓰기 버튼 (항상 표시, /submit 페이지로 이동) */}
          <a
            href="/submit"
            className="flex items-center gap-1.5 rounded-full border border-border-color px-3 py-1.5 text-sm font-medium text-muted hover:bg-gray-100"
            aria-label="새 글 작성"
          >
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">글쓰기</span>
          </a>

          {/* 로딩 중에는 스켈레톤 표시 */}
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />
          ) : user ? (
            /* ─── 로그인 상태: 알림 + 아바타 + 로그아웃 ─── */
            <>
              {/* 알림 버튼 */}
              <button
                className="rounded-full p-2 text-muted hover:bg-gray-100"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* 유저 아바타 (클릭 시 마이페이지로 이동) */}
              <a
                href="/mypage"
                className="flex items-center gap-2 rounded-full border border-border-color px-2 py-1 hover:bg-gray-50"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">
                  {getUserInitial()}
                </div>
                <span className="hidden text-sm font-medium text-foreground sm:block max-w-[120px] truncate">
                  {user.email}
                </span>
              </a>

              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-red-50 hover:text-red-600"
                aria-label="로그아웃"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : (
            /* ─── 비로그인 상태: 알림 + 로그인 버튼 ─── */
            <>
              <button
                className="rounded-full p-2 text-muted hover:bg-gray-100"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
              </button>

              <a
                href="/login"
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                <User className="h-4 w-4" />
                <span>로그인</span>
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
