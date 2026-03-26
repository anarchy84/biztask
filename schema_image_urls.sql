-- =============================================================
-- 파일 위치: schema_image_urls.sql (프로젝트 루트)
-- 용도: 게시글 이미지 첨부 기능을 위한 posts 테이블 확장
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 1) posts 테이블에 image_urls 컬럼 추가
--    JSONB 배열로 저장 (예: ["https://...", "https://..."])
--    게시글에 첨부된 이미지/미디어의 공개 URL 목록
-- -------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- -------------------------------------------------
-- 2) post-media Storage 버킷 생성
--    게시글 첨부 이미지/동영상 저장용
--    public: true로 설정하여 별도 인증 없이 이미지 접근 가능
-- -------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- post-media 버킷 RLS 정책: 누구나 파일 읽기 가능
DROP POLICY IF EXISTS "미디어 공개 읽기" ON storage.objects;
CREATE POLICY "미디어 공개 읽기"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

-- post-media 버킷 RLS 정책: 인증된 사용자만 업로드 가능
DROP POLICY IF EXISTS "인증된 사용자 미디어 업로드" ON storage.objects;
CREATE POLICY "인증된 사용자 미디어 업로드"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media' AND auth.role() = 'authenticated');
