-- ═══════════════════════════════════════════════════════════
-- BizTask: Supabase Storage 'avatars' 버킷 설정 (안전 버전)
-- 용도: 프로필 이미지 업로드를 위한 공개 스토리지 버킷
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. avatars 버킷 생성 (공개 버킷) ───
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- ─── 2. 기존 정책 제거 (충돌 방지) ───
DROP POLICY IF EXISTS "아바타 이미지 공개 읽기" ON storage.objects;
DROP POLICY IF EXISTS "로그인 유저 자기 폴더 업로드" ON storage.objects;
DROP POLICY IF EXISTS "로그인 유저 자기 파일 업데이트" ON storage.objects;
DROP POLICY IF EXISTS "로그인 유저 자기 파일 삭제" ON storage.objects;

-- ─── 3. 누구나 아바타 이미지 읽기 가능 ───
CREATE POLICY "아바타 이미지 공개 읽기"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ─── 4. 로그인한 유저는 자기 폴더에 업로드 가능 ───
CREATE POLICY "로그인 유저 자기 폴더 업로드"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── 5. 로그인한 유저는 자기 파일만 업데이트 가능 ───
CREATE POLICY "로그인 유저 자기 파일 업데이트"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── 6. 로그인한 유저는 자기 파일만 삭제 가능 ───
CREATE POLICY "로그인 유저 자기 파일 삭제"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
