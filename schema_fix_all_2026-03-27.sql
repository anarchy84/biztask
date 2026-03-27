-- ═══════════════════════════════════════════════════════
-- BizTask 올인원 수정 SQL (2026-03-27)
-- 커뮤니티 생성 버그의 진짜 원인: is_active 컬럼 누락
-- 이 파일 하나만 Supabase SQL Editor에서 실행하면 모든 문제 해결
-- ═══════════════════════════════════════════════════════


-- ─── 1. communities 테이블에 누락된 컬럼 추가 ───
-- is_active가 없어서 fetchCommunities가 400 에러를 반환했음
ALTER TABLE communities ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 기존 데이터에 is_active 기본값 적용
UPDATE communities SET is_active = true WHERE is_active IS NULL;


-- ─── 2. posts 테이블에 is_featured 컬럼 추가 (VIP 배너 기능용) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- is_featured 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_is_featured
  ON posts(created_at DESC)
  WHERE is_featured = true;


-- ─── 3. communities RLS 정책 완전 리셋 ───
-- 기존 정책 전부 삭제 (어떤 상태든 깨끗하게)
DROP POLICY IF EXISTS "communities_select_all" ON communities;
DROP POLICY IF EXISTS "communities_insert_auth" ON communities;
DROP POLICY IF EXISTS "communities_insert_vip_only" ON communities;
DROP POLICY IF EXISTS "communities_update_owner" ON communities;
DROP POLICY IF EXISTS "communities_update_vip_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_vip_owner" ON communities;

-- RLS 활성화 확인
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- SELECT: 모든 사용자 조회 가능
CREATE POLICY "communities_select_all"
  ON communities FOR SELECT
  USING (true);

-- INSERT: VIP만 생성 가능
CREATE POLICY "communities_insert_vip_only"
  ON communities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- UPDATE: VIP + 본인만 수정 가능
CREATE POLICY "communities_update_vip_owner"
  ON communities FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- DELETE: VIP + 본인만 삭제 가능
CREATE POLICY "communities_delete_vip_owner"
  ON communities FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );


-- ─── 4. posts 테이블 VIP 배너 토글 RLS ───
DROP POLICY IF EXISTS "posts_update_featured_vip" ON posts;

CREATE POLICY "posts_update_featured_vip"
  ON posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );


-- ─── 5. 성능 인덱스 ───
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_is_active ON communities(is_active);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id) WHERE community_id IS NOT NULL;


-- ─── 6. 검증: 정상 적용 확인 ───
-- 이 쿼리 결과를 확인해서 4개 정책(SELECT/INSERT/UPDATE/DELETE)이 있는지 체크
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'communities' ORDER BY cmd;

-- communities 컬럼 확인 (is_active, slug 등이 보이면 정상)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'communities'
ORDER BY ordinal_position;
