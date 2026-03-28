-- ═══════════════════════════════════════════════════════
-- [AI NPC - 그릿 콜드스타트 해결] personas 테이블 생성
-- 용도: VIP 어드민이 AI 페르소나(NPC)를 관리하는 핵심 테이블
-- 각 페르소나는 고유한 성격/업종/말투를 가지고
-- AUTO 모드에서 자동으로 커뮤니티 활동(글/댓글)을 수행
-- 실행: Supabase 대시보드 → SQL Editor → 전체 복붙 → Run!
-- 날짜: 2026-03-28
-- ═══════════════════════════════════════════════════════

-- ─── 1단계: personas 테이블 생성 ───
CREATE TABLE IF NOT EXISTS public.personas (
  -- 고유 ID (자동 생성)
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 이 페르소나를 관리하는 실제 유저 (profiles 테이블 연동)
  -- VIP 어드민의 user_id가 들어감
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 페르소나 기본 정보
  nickname TEXT NOT NULL,                     -- NPC 닉네임 (예: "마케팅김대리")
  avatar_url TEXT,                            -- 프로필 이미지 URL (선택)
  industry TEXT NOT NULL DEFAULT '일반',       -- 업종 (예: "마케팅", "IT", "요식업")
  personality TEXT NOT NULL DEFAULT '친근한',   -- 성격/말투 (예: "친근한", "전문적인", "유머러스한")
  bio TEXT,                                   -- 자기소개 한 줄 (프로필에 표시)

  -- AI 동작 설정
  mode TEXT NOT NULL DEFAULT 'MANUAL'         -- AUTO: 자동 활동 / MANUAL: 수동 대기
    CHECK (mode IN ('AUTO', 'MANUAL')),
  frequency INTEGER NOT NULL DEFAULT 3        -- 일일 활동 목표량 (글+댓글 합산)
    CHECK (frequency >= 1 AND frequency <= 20),
  prompt TEXT,                                -- Claude에게 넘길 커스텀 지시문
                                              -- 예: "마케팅 실무 경험 10년차처럼 대화해줘"

  -- 활동 통계 (캐싱용, 실시간 집계 부하 방지)
  total_posts INTEGER DEFAULT 0,              -- 누적 작성 글 수
  total_comments INTEGER DEFAULT 0,           -- 누적 작성 댓글 수
  last_active_at TIMESTAMPTZ,                 -- 마지막 활동 시각

  -- 활성화 여부 (삭제 대신 비활성화)
  is_active BOOLEAN DEFAULT true,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2단계: 인덱스 ───
-- 모드별 조회 (AUTO 모드 페르소나만 빠르게 찾기)
CREATE INDEX IF NOT EXISTS idx_personas_mode
  ON public.personas(mode) WHERE is_active = true;

-- 관리자별 조회 (특정 VIP의 페르소나만 조회)
CREATE INDEX IF NOT EXISTS idx_personas_user_id
  ON public.personas(user_id);

-- ─── 3단계: updated_at 자동 갱신 트리거 ───
-- 레코드가 수정될 때마다 updated_at을 현재 시각으로 자동 업데이트
CREATE OR REPLACE FUNCTION update_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_personas_updated_at ON public.personas;
CREATE TRIGGER trigger_personas_updated_at
  BEFORE UPDATE ON public.personas
  FOR EACH ROW
  EXECUTE FUNCTION update_personas_updated_at();

-- ─── 4단계: RLS (Row Level Security) 정책 ───
-- 오직 VIP 어드민만 personas 테이블에 접근/수정 가능
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

-- 기존 정책 초기화
DROP POLICY IF EXISTS "personas_select_vip" ON public.personas;
DROP POLICY IF EXISTS "personas_insert_vip" ON public.personas;
DROP POLICY IF EXISTS "personas_update_vip" ON public.personas;
DROP POLICY IF EXISTS "personas_delete_vip" ON public.personas;

-- SELECT: VIP만 조회 가능
CREATE POLICY "personas_select_vip"
  ON public.personas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- INSERT: VIP만 생성 가능 (자기 자신의 user_id로만)
CREATE POLICY "personas_insert_vip"
  ON public.personas FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- UPDATE: VIP만 수정 가능 (자기가 만든 페르소나만)
CREATE POLICY "personas_update_vip"
  ON public.personas FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- DELETE: VIP만 삭제 가능 (자기가 만든 페르소나만)
CREATE POLICY "personas_delete_vip"
  ON public.personas FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_vip = true
    )
  );

-- ─── 5단계: 확인용 쿼리 ───
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'personas'
ORDER BY ordinal_position;
