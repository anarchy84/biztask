-- ═══════════════════════════════════════════════════════
-- 🚨 긴급 수정 SQL — 이 파일 하나만 Supabase SQL Editor에서 실행!
-- 날짜: 2026-03-27
-- 문제: fetchCommunities가 is_active 컬럼을 조회하는데 DB에 컬럼이 없어서 400 에러
-- 추가: SELECT RLS 정책도 완전 개방 확인
-- ═══════════════════════════════════════════════════════


-- ─── 1단계: is_active 컬럼 추가 (이게 400 에러의 원인!) ───
ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
UPDATE communities SET is_active = true WHERE is_active IS NULL;


-- ─── 2단계: SELECT RLS 정책 완전 개방 ───
-- 기존 SELECT 정책 삭제 후 재생성 (anon + authenticated 모두 허용)
DROP POLICY IF EXISTS "communities_select_all" ON communities;

-- RLS가 꺼져있을 수도 있으니 확실히 켜기
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- 누구나(anon, authenticated 상관없이) 조회 가능
CREATE POLICY "communities_select_all"
  ON communities FOR SELECT
  USING (true);


-- ─── 3단계: 나머지 CRUD 정책도 한 번에 정리 ───
DROP POLICY IF EXISTS "communities_insert_auth" ON communities;
DROP POLICY IF EXISTS "communities_insert_vip_only" ON communities;
DROP POLICY IF EXISTS "communities_update_owner" ON communities;
DROP POLICY IF EXISTS "communities_update_vip_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_vip_owner" ON communities;

-- INSERT: VIP만
CREATE POLICY "communities_insert_vip_only"
  ON communities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_vip = true
    )
  );

-- UPDATE: VIP + 본인
CREATE POLICY "communities_update_vip_owner"
  ON communities FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_vip = true
    )
  );

-- DELETE: VIP + 본인
CREATE POLICY "communities_delete_vip_owner"
  ON communities FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_vip = true
    )
  );


-- ─── 4단계: 검증 (실행 결과에서 4개 정책이 보이면 성공) ───
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'communities'
ORDER BY cmd;
