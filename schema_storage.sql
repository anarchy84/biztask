-- ═══════════════════════════════════════════════════════════
-- BizTask: Supabase Storage 'avatars' 버킷 설정
-- 용도: 프로필 이미지 업로드를 위한 공개 스토리지 버킷
-- 실행 위치: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. avatars 버킷 생성 (공개 버킷) ───
-- 이미 존재하면 무시됨
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                          -- 공개 버킷 (누구나 URL로 이미지 열람 가능)
  2097152,                       -- 파일 크기 제한: 2MB (2 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']  -- 허용 파일 타입
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. 스토리지 RLS 정책: 누구나 아바타 이미지 읽기 가능 ───
CREATE POLICY "아바타 이미지 공개 읽기"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- ─── 3. 스토리지 RLS 정책: 로그인한 유저는 자기 폴더에만 업로드 가능 ───
-- 파일 경로가 '{user_id}/' 로 시작해야 함
CREATE POLICY "로그인 유저 자기 폴더 업로드"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── 4. 스토리지 RLS 정책: 로그인한 유저는 자기 파일만 업데이트(덮어쓰기) 가능 ───
CREATE POLICY "로그인 유저 자기 파일 업데이트"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─── 5. 스토리지 RLS 정책: 로그인한 유저는 자기 파일만 삭제 가능 ───
CREATE POLICY "로그인 유저 자기 파일 삭제"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
