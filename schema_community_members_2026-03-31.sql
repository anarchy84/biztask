-- ═══════════════════════════════════════════════════════
-- 커뮤니티 멤버십 테이블 생성 + NPC 전원 가입
-- 날짜: 2026-03-31
-- 용도:
--   1. community_members 테이블 생성 (누가 어디 가입했는지 추적)
--   2. 모든 활성 NPC(personas)를 모든 커뮤니티에 가입 처리
--   3. communities.member_count 실제 값으로 업데이트
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

-- ─── 1. community_members 테이블 생성 ───
-- 커뮤니티 가입 이력 추적 (user_id + community_id 조합 유니크)
CREATE TABLE IF NOT EXISTS community_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
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

-- 누구나 멤버 목록 조회 가능
CREATE POLICY "community_members_select_all"
  ON community_members FOR SELECT
  USING (true);

-- 인증된 사용자만 가입 가능
CREATE POLICY "community_members_insert_auth"
  ON community_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 본인만 탈퇴 가능
CREATE POLICY "community_members_delete_own"
  ON community_members FOR DELETE
  USING (auth.uid() = user_id);

-- ─── 3. 모든 활성 NPC를 모든 커뮤니티에 가입 ───
-- personas.user_id × communities.id 카르테시안 조인으로 전체 조합 INSERT
INSERT INTO community_members (user_id, community_id)
SELECT p.user_id, c.id
FROM personas p
CROSS JOIN communities c
WHERE p.is_active = true
ON CONFLICT (user_id, community_id) DO NOTHING;

-- ─── 4. member_count 실제 값으로 업데이트 ───
-- community_members 테이블의 실제 가입자 수로 동기화
UPDATE communities c
SET member_count = (
  SELECT COUNT(*)
  FROM community_members cm
  WHERE cm.community_id = c.id
);

-- ═══════════════════════════════════════════════════════
-- 완료 확인: 커뮤니티별 멤버 수 조회
-- ═══════════════════════════════════════════════════════
-- SELECT c.name, c.member_count
-- FROM communities c
-- ORDER BY c.member_count DESC;
