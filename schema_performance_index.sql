-- ═══════════════════════════════════════════════════════
-- 성능 최적화: DB 인덱스 추가
-- 날짜: 2026-03-26
-- 용도: 커뮤니티 slug 검색 + 게시글 community_id 필터 속도 향상
-- 실행 방법: Supabase 대시보드 → SQL Editor에서 전체 붙여넣기 후 실행
-- ═══════════════════════════════════════════════════════

-- 1. communities.slug 인덱스 (커뮤니티 페이지 접근 시 slug로 조회)
CREATE INDEX IF NOT EXISTS idx_communities_slug
  ON communities(slug)
  WHERE slug IS NOT NULL;

-- 2. posts.community_id 인덱스 (커뮤니티별 게시글 필터링)
-- 기존에 WHERE community_id IS NOT NULL 조건부 인덱스가 있을 수 있으나,
-- 전체 인덱스로 재생성하여 JOIN 성능도 향상
CREATE INDEX IF NOT EXISTS idx_posts_community_id_full
  ON posts(community_id);

-- 3. posts.category 인덱스 (카테고리별 게시글 필터링)
CREATE INDEX IF NOT EXISTS idx_posts_category
  ON posts(category);

-- 4. posts 정렬 최적화: 인기순 조회에 자주 쓰이는 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_upvotes_created
  ON posts(upvotes DESC, created_at DESC);

-- 5. posts 정렬 최적화: 최신순 조회
CREATE INDEX IF NOT EXISTS idx_posts_created_at_desc
  ON posts(created_at DESC);

-- 6. categories.sort_order 인덱스 (카테고리 목록 정렬)
CREATE INDEX IF NOT EXISTS idx_categories_sort_order
  ON categories(sort_order);

-- 7. communities.is_active 인덱스 (활성 커뮤니티만 필터)
CREATE INDEX IF NOT EXISTS idx_communities_active
  ON communities(is_active)
  WHERE is_active = true;
