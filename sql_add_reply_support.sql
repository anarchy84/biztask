-- =============================================
-- 대댓글(답글) 기능 추가를 위한 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1) comments 테이블에 parent_id 컬럼 추가
-- parent_id가 NULL이면 일반 댓글, 값이 있으면 대댓글
ALTER TABLE comments
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE DEFAULT NULL;

-- 2) 대댓글 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- 3) 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comments'
ORDER BY ordinal_position;
