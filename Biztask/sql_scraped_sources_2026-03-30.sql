-- ================================================================
-- 외부 콘텐츠 수집(콘텐츠 팜) DB 스키마
-- 날짜: 2026-03-30
-- 용도: 스크래핑한 외부 콘텐츠의 원본·상태·결과를 추적하는 테이블
-- 실행: Supabase SQL Editor에서 실행
-- ================================================================

-- ─── scraped_sources 테이블 생성 ───
-- 외부에서 수집한 콘텐츠 1건 = 1행
CREATE TABLE IF NOT EXISTS scraped_sources (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── 원본 정보 ──
  source_url    TEXT NOT NULL UNIQUE,            -- 원본 글 URL (중복 수집 방지용 UNIQUE)
  source_site   TEXT NOT NULL,                   -- 출처 사이트명 (예: '아이보스', '세금신고닷컴')
  source_title  TEXT NOT NULL,                   -- 원본 제목
  source_body   TEXT,                            -- 원본 본문 (HTML 또는 텍스트)
  source_images TEXT[] DEFAULT '{}',             -- 원본 이미지 URL 배열

  -- ── 수집 카테고리 ──
  category      TEXT NOT NULL DEFAULT 'general', -- 스크래퍼 카테고리 (예: 'marketing', 'tax', 'startup')

  -- ── 처리 상태 ──
  -- pending    : 수집만 됨, 아직 리라이팅 안 함
  -- rewriting  : AI가 리라이팅 중
  -- posted     : 리라이팅 완료 + 게시글 발행됨
  -- failed     : 리라이팅 또는 발행 실패
  -- skipped    : 중복/부적합으로 건너뜀
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'rewriting', 'posted', 'failed', 'skipped')),

  -- ── NPC 할당 ──
  assigned_persona_id UUID REFERENCES personas(id),  -- 이 글을 리라이팅할 NPC
  assigned_community_id UUID,                         -- 발행할 커뮤니티 ID

  -- ── 결과 추적 ──
  result_post_id UUID REFERENCES posts(id),      -- 리라이팅 후 생성된 게시글 ID
  rewritten_title TEXT,                           -- AI가 리라이팅한 제목
  rewritten_body  TEXT,                           -- AI가 리라이팅한 본문
  error_message   TEXT,                           -- 실패 시 에러 메시지

  -- ── 타임스탬프 ──
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 수집 시각
  rewritten_at  TIMESTAMPTZ,                        -- 리라이팅 완료 시각
  posted_at     TIMESTAMPTZ,                        -- 게시 시각
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 인덱스 ───
-- 상태별 조회 (pending 건 찾기용)
CREATE INDEX IF NOT EXISTS idx_scraped_sources_status
  ON scraped_sources(status);

-- 카테고리별 조회
CREATE INDEX IF NOT EXISTS idx_scraped_sources_category
  ON scraped_sources(category);

-- 출처 사이트별 조회
CREATE INDEX IF NOT EXISTS idx_scraped_sources_site
  ON scraped_sources(source_site);

-- 수집일시 정렬용
CREATE INDEX IF NOT EXISTS idx_scraped_sources_scraped_at
  ON scraped_sources(scraped_at DESC);

-- ─── updated_at 자동 갱신 트리거 ───
CREATE OR REPLACE FUNCTION update_scraped_sources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scraped_sources_updated_at ON scraped_sources;
CREATE TRIGGER trg_scraped_sources_updated_at
  BEFORE UPDATE ON scraped_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_scraped_sources_updated_at();

-- ─── RLS 정책 (서비스 롤 키 사용하므로 비활성화) ───
ALTER TABLE scraped_sources ENABLE ROW LEVEL SECURITY;

-- 서비스 롤은 RLS 무시하므로 별도 정책 불필요
-- 일반 유저는 이 테이블에 접근 불가 (어드민 전용)

-- ─── 확인 쿼리 ───
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'scraped_sources' ORDER BY ordinal_position;
