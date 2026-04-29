-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M012 - 활어 엔진 V2 스키마
--
-- ▣ 추가:
--   - post_category enum 확장 (시크릿 카테고리 4개)
--   - npc_personas 테이블 (16명 NPC 메타)
--   - content_backlog 테이블 (글밥 창고 V2)
--   - npc_activity_log 테이블 (로드밸런싱 계산용)
--   - get_npc_load_balance() RPC (잠수 NPC 우대 점수)
--   - profiles.npc_persona_id (FK → npc_personas)
-- ─────────────────────────────────────────────────────────────

-- 1) post_category enum 확장
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'secret_staffing';
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'secret_cost';
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'secret_property';
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'secret_trouble';

-- 2) npc_personas 테이블
CREATE TABLE IF NOT EXISTS public.npc_personas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name    text NOT NULL,
  tone            text NOT NULL,
  industry        public.industry NOT NULL,
  region          text,
  years_in_business integer,
  tier            public.user_tier NOT NULL DEFAULT 'general',
  primary_categories public.post_category[] NOT NULL DEFAULT '{}',
  category_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  post_freq_per_day integer NOT NULL DEFAULT 1,
  comment_freq_per_day integer NOT NULL DEFAULT 5,
  vote_freq_per_day integer NOT NULL DEFAULT 10,
  active_hours    int[] NOT NULL DEFAULT '{8,9,12,13,21,22,23}',
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npc_personas_tier ON public.npc_personas (tier);
CREATE INDEX IF NOT EXISTS idx_npc_personas_active ON public.npc_personas (is_active) WHERE is_active = true;

COMMENT ON TABLE  public.npc_personas IS '활어 엔진 V2 - NPC 16명 메타데이터';
COMMENT ON COLUMN public.npc_personas.category_weights IS '{ "humor": 0.5, "worry": 1.0, ... } 형태 적합도 매트릭스';
COMMENT ON COLUMN public.npc_personas.active_hours IS '활동 시간대 배열 (KST 0-23). 비활성 시간엔 cron 스킵';

-- 3) content_backlog 테이블 (글밥 창고)
CREATE TYPE public.content_surface AS ENUM ('feed', 'secret_lounge');
CREATE TYPE public.backlog_status AS ENUM ('queued', 'published', 'discarded');
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');

CREATE TABLE IF NOT EXISTS public.content_backlog (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_surface  public.content_surface NOT NULL DEFAULT 'feed',
  category        public.post_category NOT NULL DEFAULT 'worry',
  source_url      text,
  source_title    text,
  source_body     text,
  source_comments jsonb DEFAULT '[]'::jsonb,
  risk_level      public.risk_level NOT NULL DEFAULT 'low',
  redaction_notes text,
  assigned_persona_id uuid REFERENCES public.npc_personas(id) ON DELETE SET NULL,
  status          public.backlog_status NOT NULL DEFAULT 'queued',
  scheduled_for   timestamptz,
  published_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_content_backlog_status ON public.content_backlog (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_backlog_surface ON public.content_backlog (target_surface, status);

COMMENT ON TABLE  public.content_backlog IS '글밥 창고 V2 - 스크래퍼/뉴스 → publisher cron 입력';
COMMENT ON COLUMN public.content_backlog.source_comments IS '원본 댓글 배열 (RAG 말투 few-shot 재료)';

-- 4) npc_activity_log 테이블 (로드밸런싱)
CREATE TYPE public.npc_action_type AS ENUM ('post', 'comment', 'reply', 'reaction_like', 'reaction_dislike', 'follow');

CREATE TABLE IF NOT EXISTS public.npc_activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES public.npc_personas(id) ON DELETE CASCADE,
  action_type   public.npc_action_type NOT NULL,
  target_type   text,
  target_id     uuid,
  surface       public.content_surface NOT NULL DEFAULT 'feed',
  engine_version text NOT NULL DEFAULT 'v2',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_npc_activity_persona_recent
  ON public.npc_activity_log (persona_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_npc_activity_recent_24h
  ON public.npc_activity_log (created_at DESC, action_type, persona_id);

COMMENT ON TABLE public.npc_activity_log IS '활어 엔진 활동 감사 로그 + 로드밸런싱 계산용';

-- 5) profiles에 npc_persona_id 추가 (NPC 프로필 ↔ 페르소나 메타 매핑)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS npc_persona_id uuid REFERENCES public.npc_personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_npc_persona
  ON public.profiles (npc_persona_id) WHERE npc_persona_id IS NOT NULL;

-- 6) 로드밸런싱 RPC: 최근 24h 활동 적은 NPC가 우대됨
CREATE OR REPLACE FUNCTION public.get_npc_load_balance(
  p_action_type public.npc_action_type DEFAULT 'comment',
  p_surface public.content_surface DEFAULT 'feed'
)
RETURNS TABLE (
  persona_id uuid,
  recent_count integer,
  load_score numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    n.id AS persona_id,
    COALESCE(c.cnt, 0)::integer AS recent_count,
    (1.0 / (COALESCE(c.cnt, 0) + 1))::numeric AS load_score
  FROM public.npc_personas n
  LEFT JOIN (
    SELECT persona_id, COUNT(*) AS cnt
    FROM public.npc_activity_log
    WHERE created_at > now() - INTERVAL '24 hours'
      AND action_type = p_action_type
      AND surface = p_surface
    GROUP BY persona_id
  ) c ON c.persona_id = n.id
  WHERE n.is_active = true
    AND (
      p_surface = 'feed' AND n.tier = 'general'
      OR p_surface = 'secret_lounge' AND n.tier IN ('verified', 'blue')
    );
$$;

COMMENT ON FUNCTION public.get_npc_load_balance IS '잠수 NPC 우대 점수 (1/(최근24h 활동 + 1)). surface별 NPC tier 자동 분기';

-- 7) RLS - npc_personas / content_backlog / npc_activity_log
-- 한글 주석: 모두 service_role + 어드민만 접근. 일반 클라이언트는 RPC를 통해서만 접근
ALTER TABLE public.npc_personas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_backlog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npc_activity_log   ENABLE ROW LEVEL SECURITY;

-- service_role bypass는 자동, 일반 클라이언트엔 정책 안 만들면 막힘 (default deny)
-- 단 npc_personas는 SELECT만 공개 (NPC 메타 자체는 비밀 아님, 향후 어드민 화면용)
DROP POLICY IF EXISTS "npc_personas_select_public" ON public.npc_personas;
CREATE POLICY "npc_personas_select_public" ON public.npc_personas FOR SELECT USING (true);
