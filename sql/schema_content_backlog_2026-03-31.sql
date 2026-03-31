-- ================================================================
-- 글밥 창고(Content Backlog) 테이블 — 3단계 파이프라인의 핵심
-- 날짜: 2026-03-31
-- 용도: 수집(Harvest) → 저장(Silo) → 발행(Publish) 중 "저장" 담당
--
-- [아키텍처 변경]
-- 기존: 스크래퍼가 긁자마자 바로 리라이팅+발행 (완급 조절 불가)
-- 변경: 스크래퍼는 여기에 적재만 → publisher-cron이 꺼내서 가공+발행
--
-- 실행: Supabase SQL Editor에서 실행
-- ================================================================

-- ─── content_backlog 테이블 생성 ───
-- 스크래퍼가 긁어온 원본 콘텐츠를 보관하는 창고
-- 핵심: source_comments (실제 유저 댓글)를 반드시 함께 저장
CREATE TABLE IF NOT EXISTS content_backlog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── 출처 정보 ──
  source_url      TEXT NOT NULL UNIQUE,           -- 원본 글 URL (중복 수집 방지)
  source_name     TEXT NOT NULL,                  -- 출처 사이트명 (예: '클리앙', '뽐뿌', '아이보스')
  source_site     TEXT NOT NULL DEFAULT '',       -- 스크래퍼 이름 (예: '클리앙 굴러간당')

  -- ── 콘텐츠 본체 ──
  title           TEXT NOT NULL,                  -- 원본 제목
  body_html       TEXT NOT NULL DEFAULT '',       -- 원본 본문 (HTML 태그 제거된 텍스트)
  images          TEXT[] DEFAULT '{}',            -- 원본 이미지 URL 배열
  source_comments TEXT[] DEFAULT '{}',            -- ⭐ 핵심: 실제 유저 댓글 배열 (RAG/Few-Shot용)

  -- ── 분류 ──
  category        TEXT NOT NULL DEFAULT 'humor',  -- 대분류: humor, car, qa, marketing, business, ai
  content_type    TEXT NOT NULL DEFAULT 'humor'   -- 조건부 렌더링: 'qa' | 'news' | 'humor'
                  CHECK (content_type IN ('qa', 'news', 'humor')),

  -- ── 발행 상태 ──
  is_published    BOOLEAN NOT NULL DEFAULT FALSE, -- false = 창고 대기, true = 발행 완료
  published_at    TIMESTAMPTZ,                    -- 발행 시각
  result_post_id  UUID REFERENCES posts(id),      -- 발행된 게시글 ID

  -- ── 발행 시 할당된 NPC ──
  assigned_persona_id UUID REFERENCES personas(id),

  -- ── 수집 트랙 ──
  -- 'easy' = HTML/RSS 스크래퍼 (Vercel 서버리스)
  -- 'hard' = Puppeteer 크롤러 (외부 서버)
  scrape_track    TEXT NOT NULL DEFAULT 'easy'
                  CHECK (scrape_track IN ('easy', 'hard')),

  -- ── 타임스탬프 ──
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- 수집 시각
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 인덱스 ───
-- 발행 대기 글 조회 (publisher-cron 핵심 쿼리)
CREATE INDEX IF NOT EXISTS idx_backlog_unpublished
  ON content_backlog(is_published, created_at ASC)
  WHERE is_published = FALSE;

-- 카테고리별 조회
CREATE INDEX IF NOT EXISTS idx_backlog_category
  ON content_backlog(category);

-- content_type별 조회 (조건부 렌더링용)
CREATE INDEX IF NOT EXISTS idx_backlog_content_type
  ON content_backlog(content_type);

-- 출처별 조회
CREATE INDEX IF NOT EXISTS idx_backlog_source_name
  ON content_backlog(source_name);

-- ─── updated_at 자동 갱신 트리거 ───
CREATE OR REPLACE FUNCTION update_content_backlog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_backlog_updated_at ON content_backlog;
CREATE TRIGGER trg_content_backlog_updated_at
  BEFORE UPDATE ON content_backlog
  FOR EACH ROW
  EXECUTE FUNCTION update_content_backlog_updated_at();

-- ─── RLS (서비스 롤 전용) ───
ALTER TABLE content_backlog ENABLE ROW LEVEL SECURITY;
-- 서비스 롤(SUPABASE_SERVICE_ROLE_KEY)은 RLS 무시
-- 일반 유저는 이 테이블에 접근 불가 (어드민 전용)

-- ─── 확인 쿼리 ───
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'content_backlog' ORDER BY ordinal_position;
