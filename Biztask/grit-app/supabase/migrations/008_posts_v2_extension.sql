-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M008 - posts 테이블 V2 확장
--
-- ▣ 추가/변경:
--   - quoted_post_id : 인용/리트윗 (X 시그니처 기능)
--   - is_quote       : 인용글 식별 flag
--   - video_url      : 동영상 첨부 (V2 신규, 20% 비중 목표)
--   - video_thumbnail_url: 동영상 썸네일
--   - bookmark_count : 저장/스크랩 카운터
--   - quote_count    : 인용 카운터
--   - image_url(text) → image_urls(text[]) 다중 이미지로 마이그레이션
--
-- ▣ image_url 마이그레이션:
--   기존 단일 image_url 데이터 → image_urls 배열로 자동 변환 후
--   기존 컬럼은 보존 (호환성, 추후 정리)
-- ─────────────────────────────────────────────────────────────

-- 1) 인용/리트윗 컬럼
ALTER TABLE public.posts
  ADD COLUMN quoted_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN is_quote       boolean NOT NULL DEFAULT false;

-- 2) 동영상 컬럼
ALTER TABLE public.posts
  ADD COLUMN video_url           text,
  ADD COLUMN video_thumbnail_url text;

-- 3) 카운터 컬럼
ALTER TABLE public.posts
  ADD COLUMN bookmark_count integer NOT NULL DEFAULT 0,
  ADD COLUMN quote_count    integer NOT NULL DEFAULT 0;

-- 4) image_url(text) → image_urls(text[]) 다중 이미지 지원
ALTER TABLE public.posts
  ADD COLUMN image_urls text[] NOT NULL DEFAULT '{}';

-- 5) 기존 image_url 값을 image_urls 배열로 변환
UPDATE public.posts
   SET image_urls = ARRAY[image_url]
 WHERE image_url IS NOT NULL
   AND image_url != '';

-- 6) 인용 글 인덱스 (피드 알고리즘에서 인용글 가산점 조회용)
CREATE INDEX idx_posts_quoted_post_id
  ON public.posts (quoted_post_id)
  WHERE quoted_post_id IS NOT NULL;

-- 7) 추천 알고리즘용 복합 인덱스 (시간 + 좋아요 정렬)
CREATE INDEX idx_posts_created_likes
  ON public.posts (created_at DESC, like_count DESC)
  WHERE is_deleted = false;

-- 8) 컬럼 코멘트
COMMENT ON COLUMN public.posts.quoted_post_id      IS '인용한 원본 글 ID. NULL이면 일반 글. X의 인용 리트윗 같은 기능';
COMMENT ON COLUMN public.posts.is_quote            IS 'true면 인용글. quoted_post_id가 있으면 자동 true';
COMMENT ON COLUMN public.posts.video_url           IS '동영상 첨부 URL (Supabase Storage post-videos 버킷)';
COMMENT ON COLUMN public.posts.video_thumbnail_url IS '동영상 썸네일 URL';
COMMENT ON COLUMN public.posts.image_urls          IS '다중 이미지 배열 (V2). 기존 image_url은 deprecated, 호환성으로 보존';
COMMENT ON COLUMN public.posts.bookmark_count      IS '저장/스크랩 카운터';
COMMENT ON COLUMN public.posts.quote_count         IS '인용 카운터 (X 알고리즘 가중치 1.0)';
