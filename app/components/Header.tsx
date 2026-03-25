// 파일 위치: app/components/Header.tsx
// 용도: BizTask 다크 헤더 - 형광 그린 글로우 검색창 + 프로필 아바타 이미지 표시
// 레이아웃: Tailwind 유틸리티만 사용 (max-w-7xl mx-auto px-4 md:px-8)
// 브랜드: 형광 그린 #73e346 계열
// user_metadata.avatar_url이 있으면 이미지를, 없으면 이니셜을 표시

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Search, User, Bell, PenSquare, LogOut } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function Header() {
  // ─── 상태 관리 ───
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");

  const router = useRouter();

  // ─── 컴포넌트 마운트 시 현재 세션 확인 ───
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        // user_metadata에서 아바타 URL과 닉네임 가져오기
        const metadata = currentUser.user_metadata;
        setAvatarUrl(metadata?.avatar_url || null);
        setNickname(metadata?.nickname || "");

        // profiles 테이블에서도 최신 정보 가져오기 (metadata보다 정확)
        const { data: profile } = await supabase
          .from("profiles")
          .select("avatar_url, nickname")
          .eq("id", currentUser.id)
          .single();

        if (profile) {
          if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
          if (profile.nickname) setNickname(profile.nickname);
        }
      }

      setLoading(false);
    };

    getUser();

    // 인증 상태 변경 감지 (로그인/로그아웃/프로필 업데이트)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const metadata = currentUser.user_metadata;
        setAvatarUrl(metadata?.avatar_url || null);
        setNickname(metadata?.nickname || "");
      } else {
        setAvatarUrl(null);
        setNickname("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── 로그아웃 핸들러 ───
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAvatarUrl(null);
    setNickname("");
    router.push("/");
    router.refresh();
  };

  // ─── 유저 이메일에서 첫 글자 추출 ───
  const getUserInitial = () => {
    if (nickname) return nickname.charAt(0).toUpperCase();
    if (!user?.email) return "?";
    return user.email.charAt(0).toUpperCase();
  };

  // ─── 표시용 이름 (닉네임 > 이메일) ───
  const displayName = nickname || user?.email || "";

  return (
    <header className="sticky top-0 z-50 border-b border-border-color bg-header-bg">
      {/* max-w-7xl + px-4/md:px-8 → 메인 콘텐츠와 동일한 규격 */}
      <nav className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 md:px-8">
        {/* 좌측: 로고 */}
        <div className="flex shrink-0 items-center gap-2">
          <a href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black font-bold text-sm">
              B
            </div>
            <span className="text-lg font-bold text-foreground hidden sm:block">
              BizTask
            </span>
          </a>
        </div>

        {/* 중앙: 빛나는 검색창 (형광 그린 글로우) */}
        <div className="mx-4 flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="search"
              placeholder="BizTask 검색..."
              className="search-glow w-full rounded-full border border-border-color bg-input-bg py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:outline-none"
            />
          </div>
        </div>

        {/* 우측: 버튼 그룹 */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* 글쓰기 버튼 */}
          <a
            href="/submit"
            className="flex items-center gap-1.5 rounded-full border border-border-color px-3 py-1.5 text-sm font-medium text-muted hover:border-foreground hover:text-foreground"
            aria-label="새 글 작성"
          >
            <PenSquare className="h-4 w-4" />
            <span className="hidden sm:inline">글쓰기</span>
          </a>

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-hover-bg" />
          ) : user ? (
            <>
              {/* 알림 버튼 */}
              <button
                className="rounded-full p-2 text-muted hover:bg-hover-bg hover:text-foreground"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
              </button>

              {/* 유저 아바타 (프로필 이미지 또는 이니셜) */}
              <a
                href="/mypage"
                className="flex items-center gap-2 rounded-full border border-border-color px-2 py-1 hover:border-foreground"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="프로필"
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-black text-xs font-bold">
                    {getUserInitial()}
                  </div>
                )}
                <span className="hidden text-sm font-medium text-foreground sm:block max-w-[100px] truncate">
                  {displayName}
                </span>
              </a>

              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-red-400"
                aria-label="로그아웃"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="rounded-full p-2 text-muted hover:bg-hover-bg hover:text-foreground"
                aria-label="알림"
              >
                <Bell className="h-5 w-5" />
              </button>

              <a
                href="/login"
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-black hover:bg-primary-hover"
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
