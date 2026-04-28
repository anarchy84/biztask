-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M007 - profiles 테이블 V2 확장
--
-- ▣ 추가 컬럼:
--   - tier         : 회원 등급 (guest/general/verified/blue)
--   - business_number: 사업자등록번호 (인증 후 저장)
--   - verified_at  : 인증 통과 시각
--   - subscription_until: 구독 만료일 (파란딱지)
--   - region       : 지역 (예: "마포구") - 피드 뱃지용
--   - years_in_business: 연차 (n년차) - 뱃지용
--   - cover_url    : 프로필 커버 이미지
--   - grit_score   : 그릿 지수 (0-100)
--   - grit_score_updated_at: 점수 갱신 시각
--
-- ▣ enum 신규: user_tier
-- ─────────────────────────────────────────────────────────────

-- 1) tier enum 신규 생성
CREATE TYPE public.user_tier AS ENUM ('guest', 'general', 'verified', 'blue');

-- 2) profiles에 신규 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN tier               public.user_tier NOT NULL DEFAULT 'general',
  ADD COLUMN business_number    text,
  ADD COLUMN verified_at        timestamptz,
  ADD COLUMN subscription_until timestamptz,
  ADD COLUMN region             text,
  ADD COLUMN years_in_business  integer,
  ADD COLUMN cover_url          text,
  ADD COLUMN grit_score         numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN grit_score_updated_at timestamptz;

-- 3) 사업자번호는 1인 1계정 → unique 제약 (NULL은 허용)
CREATE UNIQUE INDEX idx_profiles_business_number_unique
  ON public.profiles (business_number)
  WHERE business_number IS NOT NULL;

-- 4) tier 조회 인덱스 (RLS 정책에서 자주 쓰임)
CREATE INDEX idx_profiles_tier ON public.profiles (tier);

-- 5) 기존 NPC는 verified로 자동 승급 (활어 엔진 신뢰도 유지)
UPDATE public.profiles
   SET tier = 'verified', verified_at = now()
 WHERE is_npc = true;

-- 6) 컬럼 코멘트 (Supabase Dashboard에서 보기 좋게)
COMMENT ON COLUMN public.profiles.tier              IS '회원 등급: guest(비로그인) < general(일반) < verified(인증사장님) < blue(파란딱지/구독)';
COMMENT ON COLUMN public.profiles.business_number   IS '사업자등록번호 10자리. 인증 통과 시 저장. 1인 1계정 unique';
COMMENT ON COLUMN public.profiles.verified_at       IS '사업자 인증 통과 시각. NULL이면 미인증';
COMMENT ON COLUMN public.profiles.subscription_until IS '파란딱지 구독 만료일. NULL이면 미구독';
COMMENT ON COLUMN public.profiles.region            IS '지역 표기 (예: 마포구, 강남구). 피드 뱃지에 표시';
COMMENT ON COLUMN public.profiles.years_in_business IS '사업 연차 (n년차 뱃지). 정수';
COMMENT ON COLUMN public.profiles.cover_url         IS '프로필 커버 이미지 URL';
COMMENT ON COLUMN public.profiles.grit_score        IS '그릿 지수 (0-100). 활동량+매너+관계성+인증 가중 합산';
COMMENT ON COLUMN public.profiles.grit_score_updated_at IS '그릿 지수 마지막 갱신 시각';
