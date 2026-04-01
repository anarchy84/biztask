-- =============================================================
-- 파일 위치: schema_comment_votes_2026-04-01.sql (프로젝트 루트)
-- 용도: 댓글 투표(좋아요/싫어요) 시스템 테이블 생성
-- 날짜: 2026-04-01
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 1) comment_votes 테이블: 댓글 좋아요/싫어요
--    한 유저가 하나의 댓글에 한 번만 투표 가능 (UNIQUE 제약)
--    vote_type: 'up' (좋아요) 또는 'down' (싫어요)
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,  -- 투표 대상 댓글
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,     -- 투표한 유저
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),         -- 좋아요 or 싫어요
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 같은 유저가 같은 댓글에 중복 투표 방지
  UNIQUE(comment_id, user_id)
);

-- 인덱스: 댓글별 투표 조회 최적화
CREATE INDEX IF NOT EXISTS idx_comment_votes_comment_id ON comment_votes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_votes_user_id ON comment_votes(user_id);

-- comment_votes RLS 활성화
ALTER TABLE comment_votes ENABLE ROW LEVEL SECURITY;

-- 누구나 투표 현황 조회 가능
DROP POLICY IF EXISTS "댓글투표 공개 조회" ON comment_votes;
CREATE POLICY "댓글투표 공개 조회"
  ON comment_votes FOR SELECT
  USING (true);

-- 로그인한 본인만 투표 생성 가능
DROP POLICY IF EXISTS "본인 댓글투표 생성" ON comment_votes;
CREATE POLICY "본인 댓글투표 생성"
  ON comment_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 본인만 투표 변경 가능 (좋아요 ↔ 싫어요 전환)
DROP POLICY IF EXISTS "본인 댓글투표 수정" ON comment_votes;
CREATE POLICY "본인 댓글투표 수정"
  ON comment_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- 본인만 투표 취소(삭제) 가능
DROP POLICY IF EXISTS "본인 댓글투표 삭제" ON comment_votes;
CREATE POLICY "본인 댓글투표 삭제"
  ON comment_votes FOR DELETE
  USING (auth.uid() = user_id);

-- -------------------------------------------------
-- 2) comments 테이블에 투표 카운트 컬럼 추가
--    실시간 카운트 조회를 위해 비정규화
-- -------------------------------------------------
ALTER TABLE comments ADD COLUMN IF NOT EXISTS upvotes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS downvotes INTEGER NOT NULL DEFAULT 0;
