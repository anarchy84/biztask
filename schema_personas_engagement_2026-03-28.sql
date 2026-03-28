-- ═══════════════════════════════════════════════════════
-- [AI NPC 인게이지먼트 빈도 분리] personas 테이블 컬럼 추가
-- 기존: frequency 하나로 전체 활동량만 설정
-- 변경: post_frequency, comment_frequency, like_frequency 3개로 분리
-- → NPC가 "글만 많이 쓰는 타입" vs "좋아요 위주 조용한 타입" 등 차별화 가능
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- 날짜: 2026-03-28
-- ═══════════════════════════════════════════════════════

-- ─── 1단계: 새 컬럼 3개 추가 ───

-- 일일 게시글 작성 목표 (1~20회)
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS post_frequency INTEGER NOT NULL DEFAULT 2
  CHECK (post_frequency >= 1 AND post_frequency <= 20);

-- 일일 댓글 작성 목표 (0~50회, 0 = 댓글 안 씀)
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS comment_frequency INTEGER NOT NULL DEFAULT 5
  CHECK (comment_frequency >= 0 AND comment_frequency <= 50);

-- 일일 좋아요 목표 (0~100회, 0 = 좋아요 안 누름)
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS like_frequency INTEGER NOT NULL DEFAULT 10
  CHECK (like_frequency >= 0 AND like_frequency <= 100);

-- ─── 2단계: 기존 frequency 데이터 마이그레이션 ───
-- 기존 frequency 값이 있다면 post_frequency로 복사
-- (기존에 frequency=5였던 NPC는 post_frequency=5로 매핑)
UPDATE public.personas
SET post_frequency = frequency
WHERE frequency IS NOT NULL AND frequency >= 1;

-- ─── 3단계: 누적 좋아요 통계 컬럼 추가 ───
-- total_posts, total_comments는 이미 있으니 total_likes만 추가
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS total_likes INTEGER DEFAULT 0;

-- ─── 4단계: 확인 ───
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'personas'
  AND column_name IN ('post_frequency', 'comment_frequency', 'like_frequency', 'total_likes', 'frequency')
ORDER BY ordinal_position;
