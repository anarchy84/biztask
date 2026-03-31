-- ═══════════════════════════════════════════════════════
-- scraped_sources FK 제약 조건 수정
-- 날짜: 2026-03-31
-- 문제: posts 삭제 시 scraped_sources.result_post_id FK 제약으로 삭제 실패
-- 해결: ON DELETE SET NULL로 변경 (게시글 삭제해도 수집 이력은 보존, 참조만 null)
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- ═══════════════════════════════════════════════════════

-- 1. 기존 FK 제약 삭제
ALTER TABLE scraped_sources
  DROP CONSTRAINT IF EXISTS scraped_sources_result_post_id_fkey;

-- 2. ON DELETE SET NULL로 재생성
ALTER TABLE scraped_sources
  ADD CONSTRAINT scraped_sources_result_post_id_fkey
  FOREIGN KEY (result_post_id) REFERENCES posts(id) ON DELETE SET NULL;

-- 3. scraped_sources에 대한 RLS UPDATE 정책 추가
-- (VIP가 프론트에서 result_post_id를 null로 밀어야 하므로)
DROP POLICY IF EXISTS "scraped_sources_update_vip" ON scraped_sources;
CREATE POLICY "scraped_sources_update_vip"
  ON scraped_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM verified_creators vc
      WHERE vc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM verified_creators vc
      WHERE vc.user_id = auth.uid()
    )
  );
