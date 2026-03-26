-- ═══════════════════════════════════════════════════════
-- Featured Posts (피처드 게시글) 테이블 생성
-- 용도: 메인 피드 상단 슬라이더에 노출할 게시글을 관리
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 이 쿼리 전체를 붙여넣기 후 실행
-- ═══════════════════════════════════════════════════════

-- 1. featured_posts 테이블 생성
-- post_id: posts 테이블의 게시글 참조
-- display_order: 슬라이더에서의 표시 순서 (낮을수록 앞에 표시)
-- is_active: 활성/비활성 토글 (삭제하지 않고 숨길 수 있음)
CREATE TABLE IF NOT EXISTS featured_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 같은 게시글이 중복 등록되지 않도록 유니크 제약
  UNIQUE(post_id)
);

-- 2. display_order 기준 인덱스 (정렬 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_featured_posts_order
  ON featured_posts(display_order ASC)
  WHERE is_active = true;

-- 3. RLS (Row Level Security) 활성화
ALTER TABLE featured_posts ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책: 모든 사용자가 읽기 가능 (피처드는 공개 콘텐츠)
CREATE POLICY "featured_posts_select_all"
  ON featured_posts FOR SELECT
  USING (true);

-- 5. RLS 정책: 인증된 사용자만 삽입 가능 (추후 관리자 체크 추가 가능)
CREATE POLICY "featured_posts_insert_auth"
  ON featured_posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. RLS 정책: 인증된 사용자만 수정 가능
CREATE POLICY "featured_posts_update_auth"
  ON featured_posts FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 7. RLS 정책: 인증된 사용자만 삭제 가능
CREATE POLICY "featured_posts_delete_auth"
  ON featured_posts FOR DELETE
  USING (auth.uid() IS NOT NULL);
