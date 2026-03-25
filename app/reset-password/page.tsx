// 파일 위치: app/reset-password/page.tsx
// 용도: 비밀번호 재설정 요청 페이지 (다크 테마)
// 이메일 입력 → Supabase에서 재설정 링크 발송

"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/utils/supabase/client";
import { Mail, ArrowLeft, ArrowRight, Loader2, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  // ─── 재설정 링크 발송 핸들러 ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/update-password`,
        }
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSent(true);
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4 py-12 md:px-8">
      <div className="w-full max-w-md">
        {/* 상단: 로고 + 안내 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black text-2xl font-bold">
            B
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            비밀번호 재설정
          </h1>
          <p className="mt-2 text-sm text-muted">
            가입한 이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다
          </p>
        </div>

        {/* 카드 본체 (다크 테마) */}
        <div className="rounded-xl border border-border-color bg-card-bg p-6">
          {sent ? (
            /* ─── 발송 완료 화면 ─── */
            <div className="py-4 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-400" />
              <h2 className="mb-2 text-lg font-bold text-foreground">
                이메일이 발송되었습니다
              </h2>
              <p className="mb-2 text-sm text-muted">
                <span className="font-medium text-foreground">{email}</span>
                으로 비밀번호 재설정 링크를 보냈습니다.
              </p>
              <p className="mb-6 text-xs text-muted">
                이메일이 보이지 않으면 스팸 폴더를 확인해주세요.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  className="w-full rounded-lg border border-border-color py-2.5 text-sm font-medium text-muted hover:bg-hover-bg hover:text-foreground"
                >
                  다른 이메일로 다시 보내기
                </button>
                <Link
                  href="/login"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-black hover:bg-primary-hover"
                >
                  로그인으로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            /* ─── 이메일 입력 폼 ─── */
            <>
              {error && (
                <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    이메일
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-lg border border-border-color bg-input-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-black hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    <>
                      비밀번호 재설정 링크 받기
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                  로그인으로 돌아가기
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
