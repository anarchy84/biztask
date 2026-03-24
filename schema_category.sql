-- =============================================================
-- 파일 위치: schema_category.sql (프로젝트 루트)
-- 용도: 카테고리 컬럼 존재 확인용 (이미 있으면 무시됨)
-- 실행 방법: Supabase 대시보드 → SQL Editor → 붙여넣기 → Run
-- =============================================================

-- posts 테이블에 category 컬럼이 없을 경우에만 추가 (이미 있으면 무시)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '자유';

-- 카테고리 조회 성능을 위한 인덱스 (이미 있으면 무시)
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);

-- 정렬 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_upvotes ON posts(upvotes DESC);
