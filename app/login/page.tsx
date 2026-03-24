// 파일 위치: app/login/page.tsx
// 용도: 로그인 / 회원가입 통합 페이지
// 탭으로 로그인 ↔ 회원가입 전환, Supabase Auth 연동

"use client"; // 브라우저에서 실행되는 클라이언트 컴포넌트

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  const router = useRouter(); // 페이지 이동을 위한 라우터

  // ─── 폼 제출 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // 기본 폼 제출 동작(페이지 새로고침) 방지
    setError(""); // 이전 에러 메시지 초기화
    setSuccess(""); // 이전 성공 메시지 초기화

    // 입력값 검증
    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    // 회원가입 모드일 때 비밀번호 확인 검증
    if (!isLogin && password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 비밀번호 최소 길이 검증
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true); // 로딩 시작

    try {
      if (isLogin) {
        // ─── 로그인 처리 ───
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Supabase 에러 메시지를 한글로 변환
          if (signInError.message.includes("Invalid login credentials")) {
            setError("이메일 또는 비밀번호가 올바르지 않습니다.");
          } else if (signInError.message.includes("Email not confirmed")) {
            setError("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
          } else {
            setError(signInError.message);
          }
          return;
        }

        // 로그인 성공 → 홈으로 이동
        router.push("/");
        router.refresh(); // 레이아웃(헤더)도 새로고침하여 로그인 상태 반영
      } else {
        // ─── 회원가입 처리 ───
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          // Supabase 에러 메시지를 한글로 변환
          if (signUpError.message.includes("already registered")) {
            setError("이미 가입된 이메일입니다. 로그인을 시도해주세요.");
          } else if (signUpError.message.includes("valid email")) {
            setError("올바른 이메일 형식을 입력해주세요.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        // 회원가입 성공 메시지
        setSuccess(
          "회원가입이 완료되었습니다! 이메일 인증 링크를 확인해주세요."
        );
        // 3초 후 로그인 탭으로 전환
        setTimeout(() => {
          setIsLogin(true);
          setSuccess("");
        }, 3000);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false); // 로딩 종료
    }
  };

  // ─── 탭 전환 핸들러 ───
  const switchTab = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setError(""); // 탭 전환 시 에러 초기화
    setSuccess(""); // 탭 전환 시 성공 메시지 초기화
    setPassword(""); // 비밀번호 초기화
    setConfirmPassword(""); // 비밀번호 확인 초기화
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center bg-background px-4 py-12">
      {/* 로그인/회원가입 카드 */}
      <div className="w-full max-w-md">
        {/* 상단: 로고 + 환영 메시지 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
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

        {/* 카드 본체 */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
          {/* ─── 탭 전환 버튼 ─── */}
          <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => switchTab(true)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                isLogin
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              로그인
            </button>
            <button
              onClick={() => switchTab(false)}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                !isLogin
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              회원가입
            </button>
          </div>

          {/* ─── 에러 메시지 (빨간색 박스) ─── */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ─── 성공 메시지 (초록색 박스) ─── */}
          {success && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
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
                  className="w-full rounded-lg border border-border-color bg-background py-2.5 pl-10 pr-4 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className="w-full rounded-lg border border-border-color bg-background py-2.5 pl-10 pr-10 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                />
                {/* 비밀번호 보이기/숨기기 토글 */}
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
                    className="w-full rounded-lg border border-border-color bg-background py-2.5 pl-10 pr-4 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
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
