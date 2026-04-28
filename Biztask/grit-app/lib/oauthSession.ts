// 한글 주석: Supabase OAuth 콜백 URL 파싱 + 세션 적용 유틸
//
// ▣ 이 파일의 역할:
//   - Supabase OAuth redirect URL(fragment/query)에서 토큰 꺼내기
//   - access_token / refresh_token을 Supabase 세션으로 적용
//   - WebBrowser 경유 결과와 OS 레벨 딥링크 fallback이 같은 로직을 재사용하도록 통일

import { supabase } from '@/lib/supabase'

export interface ParsedSupabaseOAuthResult {
  accessToken: string | null
  refreshToken: string | null
  errorMessage: string | null
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseSupabaseOAuthRedirectUrl(
  url: string,
): ParsedSupabaseOAuthResult {
  const rawParams = url.includes('#')
    ? url.split('#')[1]
    : url.includes('?')
      ? url.split('?')[1]
      : ''

  const params = new URLSearchParams(rawParams)

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    errorMessage: params.get('error_description')
      ? safeDecodeURIComponent(params.get('error_description')!)
      : params.get('error')
        ? safeDecodeURIComponent(params.get('error')!)
        : null,
  }
}

export async function setSupabaseSessionFromRedirectUrl(url: string): Promise<{
  accessToken: string
  refreshToken: string
  userId: string
}> {
  const { accessToken, refreshToken, errorMessage } =
    parseSupabaseOAuthRedirectUrl(url)

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!accessToken || !refreshToken) {
    throw new Error('로그인 토큰을 파싱하지 못했어. 다시 시도해줘')
  }

  const { error: setErr } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (setErr) {
    throw new Error(setErr.message)
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(accessToken)

  if (userErr) {
    throw new Error(userErr.message)
  }

  if (!user?.id) {
    throw new Error('로그인 사용자 정보를 확인하지 못했어')
  }

  return {
    accessToken,
    refreshToken,
    userId: user.id,
  }
}
