-- ═══════════════════════════════════════════════════════
-- community_members 테이블 생성 + 전체 NPC 커뮤니티 등록
-- 날짜: 2026-03-31 (v2 — AI NPC 분리 등록)
-- 용도:
--   1. community_members 테이블 CREATE (없으면 생성)
--   2. 기존 21명 NPC → 3개 커뮤니티 등록 (자동차매니아, 마케팅연구소, 사업/창업)
--   3. 8명 AI NPC → 4개 커뮤니티 전부 등록
--   4. 초급 Ai 실전 토론방은 8명 AI NPC만 등록 (기존 NPC 제외)
--   5. VIP(사장님) 계정 → 모든 커뮤니티 admin
--   6. member_count 동기화
--
-- ⚠️ 반드시 schema_ai_npc_users_2026-03-31.sql을 먼저 실행한 후 실행!
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

-- ─── 1. community_members 테이블 생성 ───
CREATE TABLE IF NOT EXISTS community_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  role TEXT DEFAULT 'member',  -- member, moderator, admin
  UNIQUE(user_id, community_id)  -- 한 유저가 같은 커뮤니티 중복 가입 방지
);

-- 인덱스: 커뮤니티별 멤버 조회 최적화
CREATE INDEX IF NOT EXISTS idx_community_members_community
  ON community_members(community_id);

-- 인덱스: 유저별 가입 커뮤니티 조회
CREATE INDEX IF NOT EXISTS idx_community_members_user
  ON community_members(user_id);

-- ─── 2. RLS 정책 ───
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

-- 기존 정책 안전 삭제 후 재생성
DROP POLICY IF EXISTS "community_members_select_all" ON community_members;
CREATE POLICY "community_members_select_all"
  ON community_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "community_members_insert_auth" ON community_members;
CREATE POLICY "community_members_insert_auth"
  ON community_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "community_members_insert_own" ON community_members;

DROP POLICY IF EXISTS "community_members_delete_own" ON community_members;
CREATE POLICY "community_members_delete_own"
  ON community_members FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 3. NPC 등록 (분리 전략) ───
DO $$
DECLARE
  c_car UUID := 'acc85d23-5cb1-43c9-a86b-96464a5e79d0';  -- 자동차매니아
  c_mkt UUID := 'c5a698b8-8047-41cf-83cb-548eca27e2e1';  -- 초보를 위한 마케팅 연구소
  c_biz UUID := '51c60f49-c1ba-407b-9de2-396657f15102';  -- 사업/창업 이야기
  c_ai  UUID := 'e92e136f-df36-4c8c-a5ad-cb8d999649b9';  -- 초급 Ai 실전 토론방
  ai_npc_names TEXT[] := ARRAY['헤비업로더','인사이트호소인','프로불편러','AGI만세','ㄷㄷ형님들','AI궁금한사장','프롬프트좀요','쉽게설명좀'];
  r RECORD;
BEGIN

  -- ─── 3a. 기존 21명 NPC → 3개 커뮤니티만 등록 (AI 토론방 제외) ───
  FOR r IN
    SELECT p.user_id
    FROM personas p
    WHERE p.is_active = true
      AND p.nickname != ALL(ai_npc_names)
  LOOP
    INSERT INTO community_members (community_id, user_id) VALUES (c_car, r.user_id) ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id) VALUES (c_mkt, r.user_id) ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id) VALUES (c_biz, r.user_id) ON CONFLICT DO NOTHING;
    -- ※ c_ai에는 등록하지 않음!
  END LOOP;
  RAISE NOTICE '✅ 기존 21명 NPC → 3개 커뮤니티 등록 완료';

  -- ─── 3b. 8명 AI NPC → 4개 커뮤니티 전부 등록 ───
  FOR r IN
    SELECT p.user_id
    FROM personas p
    WHERE p.is_active = true
      AND p.nickname = ANY(ai_npc_names)
  LOOP
    INSERT INTO community_members (community_id, user_id) VALUES (c_car, r.user_id) ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id) VALUES (c_mkt, r.user_id) ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id) VALUES (c_biz, r.user_id) ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id) VALUES (c_ai,  r.user_id) ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '✅ AI NPC 8명 → 4개 커뮤니티 등록 완료 (AI 토론방 포함)';

  -- ─── 3c. VIP(사장님) → 모든 커뮤니티 admin 등록 ───
  FOR r IN
    SELECT id AS user_id FROM profiles WHERE is_vip = true
  LOOP
    INSERT INTO community_members (community_id, user_id, role) VALUES (c_car, r.user_id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id, role) VALUES (c_mkt, r.user_id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id, role) VALUES (c_biz, r.user_id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO community_members (community_id, user_id, role) VALUES (c_ai,  r.user_id, 'admin') ON CONFLICT DO NOTHING;
  END LOOP;
  RAISE NOTICE '✅ VIP 계정 → 4개 커뮤니티 admin 등록 완료';

  -- ─── 4. member_count 동기화 ───
  UPDATE communities c
  SET member_count = (
    SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id
  );
  RAISE NOTICE '✅ member_count 동기화 완료';

END;
$$;

-- ═══════════════════════════════════════════════════════
-- 확인 쿼리 (선택사항)
-- ═══════════════════════════════════════════════════════
-- SELECT c.name, c.member_count,
--   (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) as actual_count
-- FROM communities c ORDER BY c.name;
--
-- 초급 Ai 실전 토론방 멤버 확인:
-- SELECT cm.role, pr.nickname
-- FROM community_members cm
-- JOIN profiles pr ON pr.id = cm.user_id
-- WHERE cm.community_id = 'e92e136f-df36-4c8c-a5ad-cb8d999649b9'
-- ORDER BY pr.nickname;
