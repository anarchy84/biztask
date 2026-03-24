// 파일 위치: app/update-password/page.tsx
// 용도: 새 비밀번호 설정 페이지
// 이메일에서 재설정 링크를 클릭한 후 도달하는 페이지
// Supabase가 URL에 토큰을 담아 리다이렉트하므로, 세션이 자동으로 설정됩니다.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle, ShieldCheck } from "lucide-react";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false); // 세션 확인 완료 여부
  const [checkingSession, setCheckingSession] = useState(true); // 세션 확인 중

  const router = useRouter();

  // ─── 페이지 진입 시 세션 확인 ───
  // Supabase가 이메일 링크의 토큰을 처리하여 세션을 설정할 때까지 대기
  useEffect(() => {
    const checkSession = async () => {
      // onAuthStateChange로 토큰 교환 완료를 감지
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          // 비밀번호 복구 세션이 설정됨
          setSessionReady(true);
          setCheckingSession(false);
        }
      });

      // 이미 세션이 있는 경우도 처리
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
        setCheckingSession(false);
      }

      // 3초 후에도 세션이 없으면 타임아웃
      setTimeout(() => {
        setCheckingSession(false);
      }, 3000);

      return () => subscription.unsubscribe();
    };

    checkSession();
  }, []);

  // ─── 비밀번호 변경 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 입력값 검증
    if (!password) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        if (updateError.message.includes("same as")) {
          setError("기존 비밀번호와 동일합니다. 새로운 비밀번호를 입력해주세요.");
        } else {
          setError(updateError.message);
        }
        return;
      }

      // 성공
      setSuccess(true);

      // 3초 후 로그인 페이지로 이동
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // ─── 세션 확인 중 로딩 ───
  if (checkingSession) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted">인증 정보를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  // ─── 세션 없음 (유효하지 않은 접근) ───
  if (!sessionReady) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <ShieldCheck className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">
            링크가 만료되었거나 유효하지 않습니다
          </h2>
          <p className="mb-6 text-sm text-muted">
            비밀번호 재설정 링크를 다시 요청해주세요.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/reset-password"
              className="rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              재설정 링크 다시 받기
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-border-color py-2.5 text-sm font-medium text-muted hover:bg-gray-50"
            >
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* 상단: 로고 + 안내 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white text-2xl font-bold">
            B
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            새 비밀번호 설정
          </h1>
          <p className="mt-2 text-sm text-muted">
            안전한 새 비밀번호를 입력해주세요
          </p>
        </div>

        {/* 카드 본체 */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
          {success ? (
            /* ─── 변경 완료 화면 ─── */
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
              <h2 className="mb-2 text-lg font-bold text-foreground">
                비밀번호가 변경되었습니다
              </h2>
              <p className="mb-4 text-sm text-muted">
                잠시 후 로그인 페이지로 이동합니다...
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
              >
                지금 로그인하기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            /* ─── 새 비밀번호 입력 폼 ─── */
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 새 비밀번호 */}
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    새 비밀번호
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="최소 6자 이상"
                      className="w-full rounded-lg border border-border-color bg-background py-2.5 pl-10 pr-10 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      autoComplete="new-password"
                      autoFocus
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

                {/* 새 비밀번호 확인 */}
                <div>
                  <label
                    htmlFor="confirm-new-password"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    새 비밀번호 확인
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="confirm-new-password"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="비밀번호를 다시 입력하세요"
                      className="w-full rounded-lg border border-border-color bg-background py-2.5 pl-10 pr-4 text-sm placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {/* 비밀번호 강도 안내 */}
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-muted">
                  <p>안전한 비밀번호를 위해:</p>
                  <ul className="mt-1 ml-3 list-disc space-y-0.5">
                    <li>최소 6자 이상</li>
                    <li>영문, 숫자, 특수문자 조합 권장</li>
                  </ul>
                </div>

                {/* 변경 버튼 */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      변경 중...
                    </>
                  ) : (
                    <>
                      비밀번호 변경
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
