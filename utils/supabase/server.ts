// 파일 위치: utils/supabase/server.ts
// 용도: 서버 컴포넌트(Server Component)에서 Supabase에 접속하는 클라이언트
// 서버에서 데이터를 조회할 때 사용합니다. (예: 메인 피드에서 게시글 목록 불러오기)
// 클라이언트용(client.ts)과 분리하는 이유:
//   - 서버 컴포넌트는 매 요청마다 새로운 클라이언트를 생성해야 합니다.
//   - 브라우저 전용 기능(onAuthStateChange 등)이 불필요합니다.

import { createClient } from "@supabase/supabase-js";

// 매 호출마다 새 클라이언트를 생성하는 함수 (서버 컴포넌트에서 안전하게 사용)
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
