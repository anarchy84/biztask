-- ═══════════════════════════════════════════════════════
-- VIP 전용 RLS 보안 정책 업데이트
-- 날짜: 2026-03-26
-- 용도:
--   1. categories 테이블: VIP(profiles.is_vip = true)만 INSERT/UPDATE/DELETE 가능
--   2. communities 테이블: VIP만 INSERT 가능, 생성자만 UPDATE/DELETE 가능
--   3. 일반 유저가 API로 강제 CRUD 불가하도록 보안 강화
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 전체 붙여넣기 후 실행
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════
-- 1. categories 테이블: 기존 정책 삭제 후 VIP 전용으로 재생성
-- ═══════════════════════════════════════════════════════

-- 기존 느슨한 정책 삭제 (auth.uid() IS NOT NULL 기준이었음)
DROP POLICY IF EXISTS "categories_insert_auth" ON categories;
DROP POLICY IF EXISTS "categories_update_auth" ON categories;
DROP POLICY IF EXISTS "categories_delete_auth" ON categories;

-- VIP만 카테고리 추가 가능
-- profiles 테이블의 is_vip 컬럼이 true인 사용자만 허용
CREATE POLICY "categories_insert_vip_only"
  ON categories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- VIP만 카테고리 수정 가능
CREATE POLICY "categories_update_vip_only"
  ON categories FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- VIP만 카테고리 삭제 가능
CREATE POLICY "categories_delete_vip_only"
  ON categories FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- ═══════════════════════════════════════════════════════
-- 2. communities 테이블: 기존 정책 삭제 후 VIP 전용으로 재생성
-- ═══════════════════════════════════════════════════════

-- 기존 정책 삭제
DROP POLICY IF EXISTS "communities_insert_auth" ON communities;
DROP POLICY IF EXISTS "communities_update_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_owner" ON communities;

-- VIP만 커뮤니티 생성 가능
CREATE POLICY "communities_insert_vip_only"
  ON communities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- VIP + 생성자만 커뮤니티 수정 가능
-- (VIP이면서 본인이 만든 커뮤니티만 수정 가능)
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

-- VIP + 생성자만 커뮤니티 삭제 가능
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

-- ═══════════════════════════════════════════════════════
-- 3. SELECT 정책은 유지 (모든 사용자가 조회 가능)
-- ═══════════════════════════════════════════════════════
-- "categories_select_all" → 이미 존재, 변경 없음
-- "communities_select_all" → 이미 존재, 변경 없음

-- ═══════════════════════════════════════════════════════
-- 검증: 정책이 올바르게 적용되었는지 확인
-- ═══════════════════════════════════════════════════════
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('categories', 'communities')
ORDER BY tablename, policyname;
