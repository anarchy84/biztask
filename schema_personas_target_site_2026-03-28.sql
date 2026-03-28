-- ═══════════════════════════════════════════════════════
-- [콘텐츠 수혈] personas 테이블에 target_site_url 컬럼 추가
-- 용도: 각 NPC 페르소나가 주로 콘텐츠를 가져올 외부 사이트 지정
-- 실행 방법: Supabase 대시보드 → SQL Editor → 이 쿼리 전체 복붙 → Run!
-- 날짜: 2026-03-28
-- ═══════════════════════════════════════════════════════

-- ─── 1단계: target_site_url 컬럼 추가 ───
-- 각 페르소나가 전담하는 외부 커뮤니티 URL
-- NULL이면 아직 전담 사이트가 지정되지 않은 상태
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS target_site_url TEXT DEFAULT NULL;

-- ─── 2단계: 컬럼 설명(코멘트) 추가 ───
-- DB 관리 시 이 컬럼이 뭔지 한눈에 알 수 있게
COMMENT ON COLUMN public.personas.target_site_url
  IS '페르소나 전담 외부 콘텐츠 수집 사이트 URL (예: https://gall.dcinside.com/...)';

-- ─── 3단계: 기존 NPC에 전담 사이트 매핑 (선택사항) ───
-- 각 캐릭터 성격에 맞는 커뮤니티를 기본값으로 지정
-- 나중에 어드민 UI에서 수정 가능

-- 현직대기업 → 뽐뿌 (가성비/할인 커뮤니티)
UPDATE public.personas SET target_site_url = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard'
WHERE nickname = '현직대기업' AND target_site_url IS NULL;

-- 광고충 → 개드립 (유머/바이럴 커뮤니티)
UPDATE public.personas SET target_site_url = 'https://www.dogdrip.net/free'
WHERE nickname = '광고충' AND target_site_url IS NULL;

-- 뜨아는사랑 → 네이버카페 자영업 (카페사장 감성)
UPDATE public.personas SET target_site_url = 'https://cafe.naver.com/jaripon'
WHERE nickname = '뜨아는사랑' AND target_site_url IS NULL;

-- 방구석디자인 → 개드립 (유머 감성 프리랜서)
UPDATE public.personas SET target_site_url = 'https://www.dogdrip.net/free'
WHERE nickname = '방구석디자인' AND target_site_url IS NULL;

-- 위탁판매러 → 뽐뿌 (쇼핑/판매 커뮤니티)
UPDATE public.personas SET target_site_url = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard'
WHERE nickname = '위탁판매러' AND target_site_url IS NULL;

-- 편의점빌런 → 디시인사이드 편의점갤러리
UPDATE public.personas SET target_site_url = 'https://gall.dcinside.com/mgallery/board/lists/?id=cvs'
WHERE nickname = '편의점빌런' AND target_site_url IS NULL;

-- 점주님 → 보배드림 자유 (차분한 사장 감성)
UPDATE public.personas SET target_site_url = 'https://www.bobaedream.co.kr/list?code=freeb'
WHERE nickname = '점주님' AND target_site_url IS NULL;

-- 네일하는누나 → 네이버카페 (공감/소통 감성)
UPDATE public.personas SET target_site_url = 'https://cafe.naver.com/jaripon'
WHERE nickname = '네일하는누나' AND target_site_url IS NULL;

-- 지표의노예 → 개드립 (IT/스타트업 유머)
UPDATE public.personas SET target_site_url = 'https://www.dogdrip.net/free'
WHERE nickname = '지표의노예' AND target_site_url IS NULL;

-- 납품아재 → 보배드림 (50대 아재 감성)
UPDATE public.personas SET target_site_url = 'https://www.bobaedream.co.kr/list?code=freeb'
WHERE nickname = '납품아재' AND target_site_url IS NULL;

-- ─── 4단계: 확인 쿼리 ───
SELECT nickname, target_site_url
FROM public.personas
ORDER BY nickname;
