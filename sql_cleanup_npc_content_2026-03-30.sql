-- ================================================================
-- NPC 콘텐츠 전체 삭제 + 댓글 카운트 리셋 SQL
-- 날짜: 2026-03-30
-- 용도: 아나키(관리자) 글/댓글만 남기고 NPC가 쓴 글/댓글 전부 삭제
-- 실행: Supabase SQL Editor에서 실행
-- ================================================================

-- ─── Step 0: 아나키 user_id 확인 ───
-- (아나키 닉네임으로 profiles에서 user_id 조회)
-- SELECT id, nickname FROM profiles WHERE nickname = '아나키';

-- ─── Step 1: NPC가 쓴 댓글 삭제 ───
-- personas 테이블에 등록된 user_id가 쓴 댓글만 삭제
DELETE FROM comments
WHERE user_id IN (
  SELECT user_id FROM personas
);

-- ─── Step 2: NPC가 쓴 게시글 삭제 ───
-- (댓글이 cascade로 먼저 삭제되므로 순서 중요)
DELETE FROM posts
WHERE author_id IN (
  SELECT user_id FROM personas
);

-- ─── Step 3: NPC가 누른 좋아요 삭제 ───
DELETE FROM post_likes
WHERE user_id IN (
  SELECT user_id FROM personas
);

-- ─── Step 4: 댓글 카운트 정확하게 재계산 ───
-- 모든 게시글의 comment_count를 실제 댓글 수로 동기화
UPDATE posts
SET comment_count = (
  SELECT COUNT(*) FROM comments WHERE comments.post_id = posts.id
);

-- ─── Step 5: NPC 누적 통계 초기화 ───
UPDATE personas
SET total_posts = 0,
    total_comments = 0,
    total_likes = 0,
    last_active_at = NULL;

-- ─── Step 6: 게시글 추천수도 리셋 (NPC 좋아요 제거됐으므로) ───
UPDATE posts
SET upvotes = (
  SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id
);

-- ─── 확인 쿼리 ───
-- SELECT COUNT(*) AS remaining_posts FROM posts;
-- SELECT COUNT(*) AS remaining_comments FROM comments;
-- SELECT id, title, comment_count FROM posts ORDER BY created_at DESC LIMIT 10;
