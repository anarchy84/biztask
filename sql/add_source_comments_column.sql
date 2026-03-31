-- ================================================================
-- scraped_sources 테이블에 source_comments 컬럼 추가
-- 용도: 원본 커뮤니티의 실제 유저 댓글을 저장 (Few-Shot용)
-- 실행: Supabase Dashboard → SQL Editor에서 복붙 실행
-- ================================================================

ALTER TABLE scraped_sources
ADD COLUMN IF NOT EXISTS source_comments text[] DEFAULT '{}';

-- 확인용
COMMENT ON COLUMN scraped_sources.source_comments IS '원본 게시글의 실제 유저 댓글 (최대 5개, Few-Shot 프롬프팅용)';
