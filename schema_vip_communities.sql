-- ═══════════════════════════════════════════════════════
-- VIP 인증 크리에이터 + 커뮤니티 테이블 생성
-- 용도:
--   1. verified_creators: VIP 인증된 사용자 관리 (새 커뮤니티 생성 권한)
--   2. communities: 커뮤니티(게시판) 목록
--   3. posts 테이블에 community_id 컬럼 추가
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 이 쿼리 전체를 붙여넣기 후 실행
-- ═══════════════════════════════════════════════════════

-- ─── 1. communities 테이블 (커뮤니티/게시판 목록) ───
-- 게시글이 소속될 커뮤니티 (레딧의 subreddit 개념)
CREATE TABLE IF NOT EXISTS communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,            -- 커뮤니티 이름 (중복 불가)
  description TEXT DEFAULT '',          -- 커뮤니티 설명
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 생성자
  created_at TIMESTAMPTZ DEFAULT now(),
  member_count INTEGER DEFAULT 0        -- 멤버 수 (캐시용)
);

-- 커뮤니티 이름 검색용 인덱스
CREATE INDEX IF NOT EXISTS idx_communities_name
  ON communities USING gin (name gin_trgm_ops);

-- ─── 2. verified_creators 테이블 (VIP 인증 사용자) ───
-- 사업자 인증을 완료한 사용자 → 새 커뮤니티 생성 권한 부여
CREATE TABLE IF NOT EXISTS verified_creators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT DEFAULT '',               -- 인증 사유 (관리자 메모)
  UNIQUE(user_id)                       -- 한 유저당 한 번만 인증
);

-- ─── 3. posts 테이블에 community_id 컬럼 추가 ───
-- 기존 게시글은 community_id가 NULL (기존 데이터 호환)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- community_id 기준 인덱스 (커뮤니티별 게시글 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_posts_community_id
  ON posts(community_id)
  WHERE community_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════
-- RLS (Row Level Security) 정책
-- ═══════════════════════════════════════════════════════

-- ─── communities RLS ───
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 커뮤니티 목록을 조회 가능
CREATE POLICY "communities_select_all"
  ON communities FOR SELECT
  USING (true);

-- 인증된 사용자만 커뮤니티 생성 가능 (VIP 체크는 앱 레벨에서)
CREATE POLICY "communities_insert_auth"
  ON communities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 커뮤니티 생성자만 수정 가능
CREATE POLICY "communities_update_owner"
  ON communities FOR UPDATE
  USING (auth.uid() = created_by);

-- ─── verified_creators RLS ───
ALTER TABLE verified_creators ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 인증 여부를 조회 가능 (자기 자신의 인증 상태 확인용)
CREATE POLICY "verified_creators_select_all"
  ON verified_creators FOR SELECT
  USING (true);

-- 관리자만 인증 추가/삭제 가능 (추후 admin 권한 체크 추가)
-- 우선은 인증된 사용자면 누구나 가능하도록 설정 (초기 개발 단계)
CREATE POLICY "verified_creators_insert_auth"
  ON verified_creators FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "verified_creators_delete_auth"
  ON verified_creators FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════
-- 기본 커뮤니티 시드 데이터 (선택사항)
-- ═══════════════════════════════════════════════════════
INSERT INTO communities (name, description) VALUES
  ('사업', '사업 아이디어, 창업, 투자에 대한 이야기'),
  ('마케팅', '디지털 마케팅, 브랜딩, 광고 전략'),
  ('커리어', '이직, 연봉, 커리어 성장 이야기'),
  ('자유', '가벼운 잡담과 자유로운 대화')
ON CONFLICT (name) DO NOTHING;
