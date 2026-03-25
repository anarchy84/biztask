// 파일 위치: app/auth/callback/route.ts
// 용도: 소셜 로그인(Google, Kakao) 후 Supabase OAuth 콜백 처리
//
// 흐름:
//   1. 유저가 Google/Kakao 인증 완료
//   2. Supabase가 이 라우트로 ?code=xxx 파라미터와 함께 리다이렉트
//   3. 이 라우트에서 code를 세션 토큰으로 교환
//   4. 성공 시 홈('/')으로 리다이렉트, 실패 시 로그인 페이지로 복귀
//
// 참고: 이 파일은 Route Handler(서버 사이드)이므로 createClient를 직접 사용합니다.

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // URL에서 인증 코드(code) 추출
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    // Supabase 클라이언트 생성 (서버 사이드)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 인증 코드를 세션 토큰으로 교환
    // 이 과정에서 Supabase가 유저 정보를 저장하고 세션을 생성합니다.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 성공: 홈 페이지로 리다이렉트
      return NextResponse.redirect(`${origin}/`);
    }
  }

  // 실패: 에러 파라미터와 함께 로그인 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
