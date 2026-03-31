-- ═══════════════════════════════════════════════════════
-- 기존 AI 카테고리 글 → 초급AI 실전 토론방으로 일괄 이동
-- 날짜: 2026-03-31
-- 용도: community_id가 NULL인 AI 글을 토론방에 귀속
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

UPDATE public.posts
SET community_id = 'e92e136f-df36-4c8c-a5ad-cb8d999649b9'
WHERE category = 'AI'
  AND (community_id IS NULL OR community_id != 'e92e136f-df36-4c8c-a5ad-cb8d999649b9');

-- 확인 쿼리:
-- SELECT id, title, category, community_id FROM posts WHERE category = 'AI';
