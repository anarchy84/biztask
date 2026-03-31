-- ═══════════════════════════════════════════════════════
-- VIP 어드민 삭제 권한 RLS 정책 업데이트
-- 날짜: 2026-03-31
-- 용도:
--   1. posts DELETE 정책: 본인 글 + VIP 인증 유저 삭제 허용
--   2. comments DELETE 정책: 본인 댓글 + VIP 인증 유저 삭제 허용
--   3. post_likes DELETE 정책: VIP가 게시글 삭제 시 관련 좋아요도 삭제 가능
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

-- ─── 1. posts DELETE 정책 업데이트 ───
-- 기존: 본인 게시글만 삭제 가능 (auth.uid() = author_id)
-- 변경: 본인 게시글 OR VIP 인증 유저면 모든 글 삭제 가능

DROP POLICY IF EXISTS "본인 게시글 삭제" ON posts;
CREATE POLICY "본인 게시글 삭제"
  ON posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR
    EXISTS (
      SELECT 1 FROM verified_creators vc
      WHERE vc.user_id = auth.uid()
    )
  );

-- ─── 2. comments DELETE 정책 업데이트 ───
-- 기존: 본인 댓글만 삭제 가능 (auth.uid() = user_id)
-- 변경: 본인 댓글 OR VIP 인증 유저면 모든 댓글 삭제 가능

DROP POLICY IF EXISTS "본인 댓글 삭제" ON comments;
CREATE POLICY "본인 댓글 삭제"
  ON comments FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM verified_creators vc
      WHERE vc.user_id = auth.uid()
    )
  );

-- ─── 3. post_likes DELETE 정책 업데이트 ───
-- VIP 어드민이 게시글을 삭제할 때, 해당 글의 좋아요도 함께 삭제해야 함
-- 기존 정책이 본인 좋아요만 삭제 가능하면, VIP에게도 권한 부여

-- 먼저 기존 정책 확인 후 교체 (정책 이름이 다를 수 있으므로 안전하게 처리)
DO $$
BEGIN
  -- 기존 post_likes DELETE 정책이 있으면 삭제
  DROP POLICY IF EXISTS "본인 좋아요 삭제" ON post_likes;
  DROP POLICY IF EXISTS "post_likes_delete_own" ON post_likes;
  DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;
END $$;

-- 새 정책: 본인 좋아요 OR VIP면 모든 좋아요 삭제 가능
CREATE POLICY "본인_또는_VIP_좋아요_삭제"
  ON post_likes FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM verified_creators vc
      WHERE vc.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════
-- 완료 확인: 정책 목록 조회 (선택사항)
-- ═══════════════════════════════════════════════════════
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('posts', 'comments', 'post_likes')
-- ORDER BY tablename, cmd;
