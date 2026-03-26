-- ═══════════════════════════════════════════════════════
-- 카테고리 + 커뮤니티 시스템 분리 마이그레이션
-- 날짜: 2026-03-26
-- 용도:
--   1. categories 테이블: 글 주제 태그 (사업, 마케팅 등)
--   2. communities 테이블 확장: slug, icon_url 등 추가
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 전체 붙여넣기 후 실행
-- ═══════════════════════════════════════════════════════

-- ─── 1. categories 테이블 (글 주제 분류) ───
-- 기존 하드코딩 카테고리를 DB 관리로 전환
-- VIP 회원이 추가/수정/삭제 가능
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#9ca3af',     -- 사이드바 dot 색상
  sort_order INTEGER DEFAULT 0,     -- 표시 순서
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 조회 가능
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_select_all' AND tablename = 'categories') THEN
    CREATE POLICY "categories_select_all" ON categories FOR SELECT USING (true);
  END IF;
END $$;

-- 인증된 사용자 추가 가능 (VIP 체크는 앱 레벨)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_insert_auth' AND tablename = 'categories') THEN
    CREATE POLICY "categories_insert_auth" ON categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 인증된 사용자 수정 가능
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_update_auth' AND tablename = 'categories') THEN
    CREATE POLICY "categories_update_auth" ON categories FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 인증된 사용자 삭제 가능
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'categories_delete_auth' AND tablename = 'categories') THEN
    CREATE POLICY "categories_delete_auth" ON categories FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 기본 카테고리 시드 데이터
INSERT INTO categories (name, color, sort_order) VALUES
  ('사업', '#4ade80', 1),
  ('마케팅', '#c084fc', 2),
  ('커리어', '#22d3ee', 3),
  ('자유', '#fbbf24', 4)
ON CONFLICT (name) DO NOTHING;

-- ─── 2. communities 테이블 확장 (레딧 서브레딧 스타일) ───
-- 기존 컬럼: id, name, description, created_by, created_at, member_count
ALTER TABLE communities ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 커뮤니티 삭제 정책 추가 (생성자만 삭제 가능)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'communities_delete_owner' AND tablename = 'communities') THEN
    CREATE POLICY "communities_delete_owner" ON communities FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- 기존 시드 데이터(사업, 마케팅 등)는 카테고리로 분리했으므로
-- communities에서 해당 데이터를 정리 (카테고리와 커뮤니티 혼동 방지)
DELETE FROM communities WHERE name IN ('사업', '마케팅', '커리어', '자유') AND created_by IS NULL;
