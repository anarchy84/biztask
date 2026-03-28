// 파일 위치: utils/supabase/admin.ts
// 용도: Service Role Key를 사용하는 어드민 전용 Supabase 클라이언트
// ⚠️ 주의: 이 클라이언트는 RLS(행 수준 보안)를 우회합니다!
//          반드시 서버 사이드(API Route)에서만 사용하세요.
//          절대 브라우저에 노출되면 안 됩니다.

import { createClient } from "@supabase/supabase-js";

// Service Role 클라이언트 생성 함수
// - RLS를 우회하여 모든 테이블에 직접 접근 가능
// - NPC 대량 활동, 어드민 작업 등 서버 전용 작업에 사용
export function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 환경변수 누락 시 명확한 에러 메시지 표시
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다. " +
      "Supabase 대시보드 → Settings → API Keys → service_role에서 복사하세요."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Service Role은 사용자 세션이 필요 없으므로 자동 토큰 갱신 비활성화
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
