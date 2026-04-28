-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M009 - follows 테이블 신규 (팔로우 시스템)
--
-- ▣ 핵심 사용처:
--   - 프로필 화면: 팔로워/팔로잉 카운트
--   - 홈 피드: 팔로잉 30~40% 믹스 알고리즘
--   - 추천: Mutual Connections (공통 팔로워)
--   - 페북식 한 스푼: "내 팔로워 8명이 추천했습니다"
--
-- ▣ 스키마:
--   PRIMARY KEY (follower_id, following_id) - 같은 관계 중복 방지
--   self-follow 방지 CHECK 제약
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.follows (
  follower_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id != following_id)
);

-- 인덱스: follower_id 기준 조회 (내가 팔로우하는 사람들)
CREATE INDEX idx_follows_follower ON public.follows (follower_id);

-- 인덱스: following_id 기준 조회 (나를 팔로우하는 사람들)
CREATE INDEX idx_follows_following ON public.follows (following_id);

-- RLS 활성화
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 한글 주석: RLS 정책
--   - SELECT: 모두 읽기 가능 (팔로우 관계는 공개 정보)
--   - INSERT: 본인이 follower인 경우만 (남이 나 대신 팔로우 X)
--   - DELETE: 본인이 follower인 경우만 (언팔도 본인만)
--   - UPDATE: 정책 없음 (timestamptz는 수정 불필요)
-- ─────────────────────────────────────────────

CREATE POLICY "follows_select_all"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "follows_insert_own"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete_own"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ─────────────────────────────────────────────
-- 한글 주석: 카운터 컬럼 + 트리거
--   profiles에 follower_count, following_count 추가해서
--   매번 COUNT(*) 안 하고 빠르게 조회
-- ─────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN follower_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN following_count integer NOT NULL DEFAULT 0;

CREATE INDEX idx_profiles_follower_count ON public.profiles (follower_count DESC);

-- 트리거 함수: follows INSERT/DELETE 시 카운터 업데이트
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE public.profiles SET follower_count  = follower_count + 1  WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE public.profiles SET follower_count  = GREATEST(follower_count - 1, 0)  WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER follows_count_trigger
  AFTER INSERT OR DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_follow_counts();

-- 코멘트
COMMENT ON TABLE  public.follows                    IS '팔로우 관계. follower_id가 following_id를 팔로우';
COMMENT ON COLUMN public.profiles.follower_count    IS '나를 팔로우하는 사람 수 (트리거로 자동 갱신)';
COMMENT ON COLUMN public.profiles.following_count   IS '내가 팔로우하는 사람 수 (트리거로 자동 갱신)';
