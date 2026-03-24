// 파일 위치: utils/supabase/client.ts
// 용도: 브라우저(클라이언트) 환경에서 Supabase에 연결하는 유틸리티
// 사용법: import { supabase } from '@/utils/supabase/client'

import { createClient } from "@supabase/supabase-js";

// .env.local 에 설정한 환경변수를 가져옵니다
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase 클라이언트를 생성하여 내보냅니다
// 이 클라이언트로 DB 조회, 인증, 실시간 구독 등을 할 수 있습니다
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
