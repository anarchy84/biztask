// 파일 위치: app/login/page.tsx
// 용도: 로그인 / 회원가입 통합 페이지 (다크 테마)
// 탭으로 로그인 ↔ 회원가입 전환, Supabase Auth 연동

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  // ─── 상태 관리 ───
  const [isLogin, setIsLogin] = useState(true); // true: 로그인 모드, false: 회원가입 모드
  const [email, setEmail] = useState(""); // 이메일 입력값
  const [password, setPassword] = useState(""); // 비밀번호 입력값
  const [confirmPassword, setConfirmPassword] = useState(""); // 비밀번호 확인 (회원가입 시)
  const [showPassword, setShowPassword] = useState(false); // 비밀번호 보이기/숨기기
  const [error, setError] = useState(""); // 에러 메시지
  const [success, setSuccess] = useState(""); // 성공 메시지
  const [loading, setLoading] = useState(false); // 로딩 상태

  const router = useRouter();

  // ─── 폼 제출 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        // ─── 로그인 처리 ───
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login credentials")) {
            setError("이메일 또는 비밀번호가 올바르지 않습니다.");
          } else if (signInError.message.includes("Email not confirmed")) {
            setError("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
          } else {
            setError(signInError.message);
          }
          return;
        }

        router.push("/");
        router.refresh();
      } else {
        // ─── 회원가입 처리 ───
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("이미 가입된 이메일입니다. 로그인을 시도해주세요.");
          } else if (signUpError.message.includes("valid email")) {
            setError("올바른 이메일 형식을 입력해주세요.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        setSuccess("회원가입이 완료되었습니다! 이메일 인증 링크를 확인해주세요.");
        setTimeout(() => {
          setIsLogin(true);
          setSuccess("");
        }, 3000);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 탭 전환 핸들러 ───
  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4 py-12 md:px-8">
      <div className="w-full max-w-md">
        {/* 상단: 로고 + 환영 메시지 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black text-2xl font-bold">
            B
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {isLogin ? "다시 오셨군요!" : "BizTask에 합류하세요"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isLogin
              ? "계정에 로그인하여 커뮤니티에 참여하세요"
              : "익명 비즈니스 커뮤니티에서 인사이트를 나눠보세요"}
          </p>
        </div>

        {/* 카드 본체 (다크 테마) */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6">
          {/* ─── 탭 전환 버튼 ─── */}
          <div className="mb-6 flex rounded-lg bg-hover-bg p-1">
            <button
              onClick={() => switchTab(true)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                isLogin
                  ? "bg-card-bg text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => switchTab(false)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                !isLogin
                  ? "bg-card-bg text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              회원가입
            </button>
          </div>

          {/* ─── 에러 메시지 ─── */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ─── 성공 메시지 ─── */}
          {success && (
            <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
              {success}
            </div>
          )}

          {/* ─── 입력 폼 ─── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이메일 입력 */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-border-color bg-input-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="최소 6자 이상"
                  className="w-full rounded-lg border border-border-color bg-input-bg py-2.5 pl-10 pr-10 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보이기"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* 비밀번호 찾기 링크 (로그인 모드에서만 표시) */}
            {isLogin && (
              <div className="flex justify-end -mt-2">
                <Link
                  href="/reset-password"
                  className="text-xs text-primary hover:underline"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>
            )}

            {/* 비밀번호 확인 (회원가입 모드에서만 표시) */}
            {!isLogin && (
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  비밀번호 확인
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    className="w-full rounded-lg border border-border-color bg-input-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-black hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  {isLogin ? "로그인" : "회원가입"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* 하단 안내 문구 */}
          <p className="mt-6 text-center text-xs text-muted">
            {isLogin ? (
              <>
                아직 계정이 없으신가요?{" "}
                <button
                  onClick={() => switchTab(false)}
                  className="font-medium text-primary hover:underline"
                >
                  회원가입
                </button>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{" "}
                <button
                  onClick={() => switchTab(true)}
                  className="font-medium text-primary hover:underline"
                >
                  로그인
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
