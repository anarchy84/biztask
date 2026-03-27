-- ═══════════════════════════════════════════════════════
-- posts 테이블에 is_featured 컬럼 추가
-- 용도: VIP가 게시글을 메인 배너에 노출할 수 있는 기능
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 이 쿼리 전체를 붙여넣기 후 실행
-- 날짜: 2026-03-26
-- ═══════════════════════════════════════════════════════

-- 1. posts 테이블에 is_featured 컬럼 추가 (기본값 false)
-- 이미 존재하면 에러 없이 스킵
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. is_featured 인덱스 (배너 조회 성능 최적화)
-- is_featured = true인 게시글만 빠르게 조회하기 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_is_featured
  ON posts(created_at DESC)
  WHERE is_featured = true;

-- 3. VIP만 is_featured를 변경할 수 있도록 RLS 정책은 기존 posts UPDATE 정책에 의존
-- (기존 posts 테이블의 UPDATE 정책이 작성자 본인 또는 VIP에게 허용되어 있어야 합니다)
-- 아래는 VIP가 모든 게시글의 is_featured를 토글할 수 있는 추가 정책입니다
DO $$
BEGIN
  -- 기존 정책이 있으면 삭제 후 재생성
  DROP POLICY IF EXISTS "posts_update_featured_vip" ON posts;

  CREATE POLICY "posts_update_featured_vip"
    ON posts FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_vip = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_vip = true
      )
    );
END $$;
