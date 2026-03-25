-- =============================================================
-- 파일 위치: schema_bookmark.sql (프로젝트 루트)
-- 용도: 북마크(저장) 기능 + 댓글 수정 권한을 위한 DB 스키마
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 1) saved_posts 테이블: 게시글 저장(북마크)
--    한 유저가 하나의 게시글에 한 번만 저장 가능 (UNIQUE 제약)
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,      -- 저장한 게시글
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- 저장한 유저
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 유저가 같은 게시글을 중복 저장 방지
  UNIQUE(post_id, user_id)
);

-- saved_posts RLS 활성화
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- 본인이 저장한 목록만 조회 가능
DROP POLICY IF EXISTS "본인 저장 조회" ON saved_posts;
CREATE POLICY "본인 저장 조회"
  ON saved_posts FOR SELECT
  USING (auth.uid() = user_id);

-- 로그인한 본인만 저장(insert) 가능
DROP POLICY IF EXISTS "본인 저장 생성" ON saved_posts;
CREATE POLICY "본인 저장 생성"
  ON saved_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 저장 해제(delete) 가능
DROP POLICY IF EXISTS "본인 저장 삭제" ON saved_posts;
CREATE POLICY "본인 저장 삭제"
  ON saved_posts FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------
-- 2) comments 테이블에 UPDATE 정책 추가
--    (댓글 인라인 수정 기능을 위해 필요)
-- -------------------------------------------------
DROP POLICY IF EXISTS "본인 댓글 수정" ON comments;
CREATE POLICY "본인 댓글 수정"
  ON comments FOR UPDATE
  USING (auth.uid() = user_id);
