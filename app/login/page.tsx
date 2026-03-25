// 파일 위치: app/login/page.tsx
// 용도: 로그인 / 회원가입 통합 페이지 (다크 테마)
// 기능:
//   1. 구글 / 카카오 소셜 로그인 (Supabase OAuth)
//   2. 이메일+비밀번호 로그인 / 회원가입
//   3. 탭으로 로그인 ↔ 회원가입 전환
// 브랜드: 형광 그린 #73e346 계열 다크 테마

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

// ═══════════════════════════════════════════════════════
// 구글 로고 SVG 컴포넌트
// 공식 구글 브랜드 가이드라인의 4색 "G" 로고
// ═══════════════════════════════════════════════════════
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// 카카오 말풍선 로고 SVG 컴포넌트
// 카카오 공식 브랜드 가이드라인의 말풍선 심볼
// ═══════════════════════════════════════════════════════
function KakaoLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3C6.48 3 2 6.44 2 10.61c0 2.68 1.78 5.03 4.46 6.36-.15.54-.97 3.49-1 3.64 0 0-.02.17.09.23.11.07.24.01.24.01.32-.04 3.7-2.44 4.28-2.85.62.09 1.27.14 1.93.14 5.52 0 10-3.44 10-7.53C22 6.44 17.52 3 12 3z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

export default function LoginPage() {
  // ─── 상태 관리 ───
  const [isLogin, setIsLogin] = useState(true); // true: 로그인 모드, false: 회원가입 모드
  const [email, setEmail] = useState(""); // 이메일 입력값
  const [password, setPassword] = useState(""); // 비밀번호 입력값
  const [confirmPassword, setConfirmPassword] = useState(""); // 비밀번호 확인 (회원가입 시)
  const [showPassword, setShowPassword] = useState(false); // 비밀번호 보이기/숨기기
  const [error, setError] = useState(""); // 에러 메시지
  const [success, setSuccess] = useState(""); // 성공 메시지
  const [loading, setLoading] = useState(false); // 이메일 폼 로딩 상태
  const [socialLoading, setSocialLoading] = useState<string | null>(null); // 소셜 로그인 로딩 ('google' | 'kakao' | null)

  const router = useRouter();

  // ═══════════════════════════════════════════════════════
  // 소셜 로그인 핸들러 (Google / Kakao)
  // Supabase signInWithOAuth를 호출하여 해당 프로바이더의
  // 인증 페이지로 리다이렉트합니다.
  // 로그인 성공 후 /auth/callback으로 돌아옵니다.
  // ═══════════════════════════════════════════════════════
  const handleSocialLogin = async (provider: "google" | "kakao") => {
    setError("");
    setSocialLoading(provider);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // 소셜 로그인 성공 후 돌아올 콜백 주소
          // Supabase가 토큰 교환 후 홈('/')으로 최종 리다이렉트
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError(`${provider === "google" ? "구글" : "카카오"} 로그인에 실패했습니다: ${oauthError.message}`);
        setSocialLoading(null);
      }
      // 성공 시 Supabase가 자동으로 OAuth 페이지로 리다이렉트하므로
      // setSocialLoading(null)은 호출하지 않음 (페이지가 바뀌므로)
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
      setSocialLoading(null);
    }
  };

  // ─── 이메일 폼 제출 핸들러 ───
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

          {/* ═══════════════════════════════════════════════════════ */}
          {/* 소셜 로그인 버튼 영역                                     */}
          {/* 구글 / 카카오 OAuth 버튼을 이메일 폼 위에 큼직하게 배치      */}
          {/* ═══════════════════════════════════════════════════════ */}
          <div className="mb-5 space-y-3">
            {/* ─── 구글 로그인 버튼 ─── */}
            {/* 흰색 배경 + 진한 회색 텍스트 + 구글 4색 로고 */}
            <button
              onClick={() => handleSocialLogin("google")}
              disabled={socialLoading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {socialLoading === "google" ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              ) : (
                <GoogleLogo className="h-5 w-5" />
              )}
              <span>Google로 3초 만에 시작하기</span>
            </button>

            {/* ─── 카카오 로그인 버튼 ─── */}
            {/* 카카오 공식 노란색 배경(#FEE500) + 짙은 갈색 텍스트 + 말풍선 로고 */}
            <button
              onClick={() => handleSocialLogin("kakao")}
              disabled={socialLoading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-[#FEE500] py-3 text-sm font-medium text-[#3C1E1E] transition-all hover:bg-[#FDD835] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {socialLoading === "kakao" ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#3C1E1E]" />
              ) : (
                <KakaoLogo className="h-5 w-5" />
              )}
              <span>카카오로 1초 만에 시작하기</span>
            </button>
          </div>

          {/* ─── 구분선 (Divider): "또는 이메일로 로그인" ─── */}
          <div className="relative mb-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border-color" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card-bg px-3 text-xs text-muted">
                또는 이메일로 {isLogin ? "로그인" : "회원가입"}
              </span>
            </div>
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

          {/* ─── 이메일 입력 폼 ─── */}
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
