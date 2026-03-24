-- =============================================================
-- 파일 위치: schema_update.sql (프로젝트 루트)
-- 용도: 마이페이지 기능을 위한 DB 스키마 확장
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 1) profiles 테이블에 새 컬럼 추가
--    기존 컬럼(id, nickname, avatar_url, bio, created_at)은 유지
-- -------------------------------------------------

-- 상태 메시지 (한줄 자기소개보다 짧은 현재 상태)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_message TEXT DEFAULT '';

-- 업종 (예: IT, 금융, F&B, 교육 등)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT '';

-- 회사명 (선택 입력)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company TEXT DEFAULT '';

-- 휴대폰 번호 (선택 입력, 비공개)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- 관심사 태그 (JSONB 배열로 저장, 예: ["스타트업","마케팅","투자"])
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests JSONB DEFAULT '[]'::jsonb;

-- 회사 인증 여부 (관리자가 승인 시 true로 변경)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_company_verified BOOLEAN DEFAULT false;

-- 사업자 인증 여부 (사업자등록증 확인 후 true로 변경)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_business_verified BOOLEAN DEFAULT false;

-- -------------------------------------------------
-- 2) follows 테이블: 팔로워/팔로잉 시스템
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- 팔로우 하는 사람
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,  -- 팔로우 당하는 사람
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 사람을 중복 팔로우 방지
  UNIQUE(follower_id, following_id)
);

-- follows 테이블 RLS 활성화
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 누구나 팔로우 관계 조회 가능
DROP POLICY IF EXISTS "팔로우 공개 조회" ON follows;
CREATE POLICY "팔로우 공개 조회"
  ON follows FOR SELECT
  USING (true);

-- 본인만 팔로우 생성 가능
DROP POLICY IF EXISTS "본인 팔로우 생성" ON follows;
CREATE POLICY "본인 팔로우 생성"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- 본인만 팔로우 해제 가능
DROP POLICY IF EXISTS "본인 팔로우 삭제" ON follows;
CREATE POLICY "본인 팔로우 삭제"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);

-- -------------------------------------------------
-- 3) 프로필 자동 생성 정책 (이전 마일스톤에서 이미 추가했다면 무시됨)
-- -------------------------------------------------
DROP POLICY IF EXISTS "프로필 자동 생성" ON profiles;
CREATE POLICY "프로필 자동 생성"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
