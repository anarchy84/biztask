-- ═══════════════════════════════════════════════════════
-- [콘텐츠 큐레이션] posts 테이블에 is_featured 컬럼 추가
-- 용도: VIP 편집장이 게시글을 메인 배너에 노출할 수 있는 기능
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 쿼리 전체 복붙 → Run!
-- 날짜: 2026-03-27
-- ═══════════════════════════════════════════════════════

-- ─── 1단계: is_featured 컬럼 추가 ───
-- 이미 있으면 알아서 건너뛰니까 에러 걱정 없이 실행해!
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- ─── 2단계: 성능 인덱스 ───
-- is_featured = true인 게시글만 빠르게 찾기 위한 부분 인덱스
-- FeaturedSlider가 이 인덱스를 타서 번개처럼 빠르게 조회함
CREATE INDEX IF NOT EXISTS idx_posts_is_featured
  ON public.posts(created_at DESC)
  WHERE is_featured = true;

-- ─── 3단계: VIP만 is_featured를 변경할 수 있는 RLS 정책 ───
-- 기존 동일 이름 정책이 있으면 먼저 삭제 후 재생성
DROP POLICY IF EXISTS "posts_update_featured_vip" ON public.posts;

CREATE POLICY "posts_update_featured_vip"
  ON public.posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- ─── 4단계: 확인용 쿼리 ───
-- 실행 후 아래 결과에서 is_featured 컬럼이 보이면 성공!
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'posts' AND column_name = 'is_featured';
