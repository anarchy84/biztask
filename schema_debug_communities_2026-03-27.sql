-- ═══════════════════════════════════════════════════════
-- communities 테이블 디버깅 + RLS 정책 완전 재설정
-- 날짜: 2026-03-27
-- 용도: 커뮤니티 생성이 안 되는 문제 디버깅 및 해결
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 "한 섹션씩" 실행
-- ═══════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════
-- [STEP 1] 현재 상태 진단 — 이 쿼리를 먼저 실행하고 결과를 확인해 주세요
-- ═══════════════════════════════════════════════════════

-- 1-1. communities 테이블 컬럼 구조 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'communities'
ORDER BY ordinal_position;

-- 1-2. communities 테이블의 현재 RLS 정책 목록 (핵심!)
-- 여기서 INSERT 정책이 없으면 → 커뮤니티 생성 100% 차단됨
SELECT policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename = 'communities'
ORDER BY cmd, policyname;

-- 1-3. communities 테이블의 UNIQUE 제약조건 확인
-- name과 slug 둘 다 UNIQUE인지 확인
SELECT con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'communities'
  AND con.contype = 'u';

-- 1-4. 현재 존재하는 커뮤니티 목록 (중복 확인용)
SELECT id, name, slug, is_active, created_by, created_at
FROM communities
ORDER BY created_at DESC
LIMIT 20;

-- 1-5. 현재 유저의 is_vip 확인
-- 여기서 본인 이메일의 is_vip가 true인지 확인
SELECT id, nickname, is_vip
FROM profiles
LIMIT 20;


-- ═══════════════════════════════════════════════════════
-- [STEP 2] RLS 정책 완전 리셋 (문제 해결)
-- ⚠️ STEP 1 결과를 확인한 후에 실행해 주세요!
-- ═══════════════════════════════════════════════════════

-- 2-1. communities 테이블의 기존 정책 전부 삭제 (깨끗하게)
DROP POLICY IF EXISTS "communities_select_all" ON communities;
DROP POLICY IF EXISTS "communities_insert_auth" ON communities;
DROP POLICY IF EXISTS "communities_insert_vip_only" ON communities;
DROP POLICY IF EXISTS "communities_update_owner" ON communities;
DROP POLICY IF EXISTS "communities_update_vip_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_owner" ON communities;
DROP POLICY IF EXISTS "communities_delete_vip_owner" ON communities;

-- 2-2. RLS 활성화 확인
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- 2-3. 새 정책 생성 (조회: 전체 / 생성: VIP / 수정: VIP+본인 / 삭제: VIP+본인)

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


-- ═══════════════════════════════════════════════════════
-- [STEP 3] 적용 확인 — STEP 2 실행 후 이 쿼리로 검증
-- ═══════════════════════════════════════════════════════

-- 정책 4개가 보여야 정상 (SELECT, INSERT, UPDATE, DELETE)
SELECT policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename = 'communities'
ORDER BY cmd, policyname;
