-- ═══════════════════════════════════════════════════════
-- [드래그 앤 드롭] communities 테이블에 sort_order 컬럼 추가
-- 용도: 사이드바 커뮤니티 목록의 표시 순서를 VIP가 자유롭게 변경
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 쿼리 전체 복붙 → Run!
-- 날짜: 2026-03-27
-- ═══════════════════════════════════════════════════════

-- ─── 1단계: sort_order 컬럼 추가 ───
-- 숫자가 작을수록 위에 표시됨 (1이 맨 위, 2가 그 다음...)
-- 이미 있으면 에러 없이 건너뛰니까 안심하고 실행!
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- ─── 2단계: 기존 데이터 초기화 ───
-- 현재 있는 커뮤니티들을 id 순서대로 1, 2, 3... 번호 매기기
-- (ROW_NUMBER 윈도우 함수 사용)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.communities
)
UPDATE public.communities c
SET sort_order = numbered.rn
FROM numbered
WHERE c.id = numbered.id;

-- ─── 3단계: 성능 인덱스 ───
-- sort_order로 정렬 조회할 때 빠르게 찾기 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_communities_sort_order
  ON public.communities(sort_order ASC);

-- ─── 4단계: 확인용 쿼리 ───
-- 실행 후 sort_order가 1, 2, 3... 순서대로 잘 들어갔는지 확인!
SELECT id, name, slug, sort_order
FROM public.communities
ORDER BY sort_order ASC;
