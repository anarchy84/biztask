-- =============================================================
-- 파일 위치: schema_interaction.sql (프로젝트 루트)
-- 용도: 추천(좋아요) + 댓글 시스템을 위한 DB 테이블 생성
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 1) post_likes 테이블: 게시글 추천 (좋아요)
--    한 유저가 하나의 게시글에 한 번만 추천 가능 (UNIQUE 제약)
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,      -- 추천한 게시글
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- 추천한 유저
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 유저가 같은 게시글에 중복 추천 방지
  UNIQUE(post_id, user_id)
);

-- post_likes RLS 활성화
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 누구나 추천 현황 조회 가능
DROP POLICY IF EXISTS "추천 공개 조회" ON post_likes;
CREATE POLICY "추천 공개 조회"
  ON post_likes FOR SELECT
  USING (true);

-- 로그인한 본인만 추천 생성 가능
DROP POLICY IF EXISTS "본인 추천 생성" ON post_likes;
CREATE POLICY "본인 추천 생성"
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 추천 취소(삭제) 가능
DROP POLICY IF EXISTS "본인 추천 삭제" ON post_likes;
CREATE POLICY "본인 추천 삭제"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------
-- 2) comments 테이블: 게시글 댓글
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,      -- 댓글이 달린 게시글
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- 댓글 작성자
  content TEXT NOT NULL,                                              -- 댓글 내용
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- comments RLS 활성화
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 누구나 댓글 조회 가능
DROP POLICY IF EXISTS "댓글 공개 조회" ON comments;
CREATE POLICY "댓글 공개 조회"
  ON comments FOR SELECT
  USING (true);

-- 로그인한 본인만 댓글 작성 가능
DROP POLICY IF EXISTS "본인 댓글 작성" ON comments;
CREATE POLICY "본인 댓글 작성"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인 댓글만 삭제 가능
DROP POLICY IF EXISTS "본인 댓글 삭제" ON comments;
CREATE POLICY "본인 댓글 삭제"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);
