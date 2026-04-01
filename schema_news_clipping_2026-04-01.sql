-- ================================================================
-- 뉴스클리핑 프로젝트 — DB 스키마
-- 날짜: 2026-04-01
-- 용도: 뉴스 기사 수집 + AI 클러스터링 요약 저장
-- 관계: news_clips (1) → news_articles (N)
-- ================================================================

-- ─── 1. news_clips: AI가 클러스터링한 "오늘의 이슈" 단위 ───
-- 비슷한 기사들을 하나로 묶은 뉴스 클립 (대표 카드)
CREATE TABLE IF NOT EXISTS news_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 클립 핵심 정보
  headline TEXT NOT NULL,                    -- AI가 생성한 핵심 헤드라인 (한 줄)
  summary TEXT NOT NULL,                     -- AI가 생성한 3줄 요약
  thumbnail_url TEXT,                        -- 대표 썸네일 URL (기사 중 대표 1개)
  category TEXT NOT NULL DEFAULT 'general',  -- 카테고리 (economy, tech, marketing, etc.)

  -- 클립 메타
  clip_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- 이슈 날짜 (날짜 휠 아카이브용)
  article_count INTEGER NOT NULL DEFAULT 0,       -- 소속 기사 수 (비정규화 캐시)
  importance_score REAL DEFAULT 0,                -- 중요도 점수 (기사 수 + 언론사 다양성 등)

  -- 상태 관리
  status TEXT NOT NULL DEFAULT 'draft',  -- draft: AI 생성 대기, published: 발행됨
  is_featured BOOLEAN DEFAULT FALSE,     -- 메인 피처드 여부

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. news_articles: 개별 기사 원본 ───
-- 구글 뉴스, 아이보스 등에서 수집한 개별 기사
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- FK: 어떤 클립(이슈)에 소속되는지 (클러스터링 전에는 NULL)
  clip_id UUID REFERENCES news_clips(id) ON DELETE SET NULL,

  -- 기사 핵심 정보
  title TEXT NOT NULL,                  -- 기사 제목
  link TEXT NOT NULL,                   -- 기사 원본 URL (중복 체크 키)
  source_name TEXT NOT NULL,            -- 언론사명 (예: '한겨레', '조선일보', '아이보스')
  thumbnail_url TEXT,                   -- 기사 썸네일 URL
  snippet TEXT,                         -- 기사 요약/본문 일부 (RSS description 등)
  published_at TIMESTAMPTZ,             -- 기사 발행일시

  -- 수집 메타
  feed_source TEXT NOT NULL DEFAULT 'google_news',  -- 수집 출처 (google_news, iboss, etc.)
  category TEXT NOT NULL DEFAULT 'general',          -- 카테고리
  is_clustered BOOLEAN DEFAULT FALSE,                -- 클러스터링 처리 완료 여부

  -- 타임스탬프
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. 인덱스 ───
-- 중복 체크용: 같은 URL의 기사 중복 수집 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_news_articles_link ON news_articles(link);

-- 날짜별 클립 조회 (날짜 휠 아카이브)
CREATE INDEX IF NOT EXISTS idx_news_clips_date ON news_clips(clip_date DESC);

-- 클립별 기사 조회
CREATE INDEX IF NOT EXISTS idx_news_articles_clip_id ON news_articles(clip_id);

-- 클러스터링 대기 기사 조회
CREATE INDEX IF NOT EXISTS idx_news_articles_unclustered ON news_articles(is_clustered) WHERE is_clustered = FALSE;

-- 카테고리별 클립 조회
CREATE INDEX IF NOT EXISTS idx_news_clips_category ON news_clips(category);

-- ─── 4. RLS 정책 ───
ALTER TABLE news_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

-- 클립: 모든 사용자 조회 가능
CREATE POLICY "news_clips_public_read" ON news_clips
  FOR SELECT USING (true);

-- 기사: 모든 사용자 조회 가능
CREATE POLICY "news_articles_public_read" ON news_articles
  FOR SELECT USING (true);

-- 클립: service_role만 INSERT/UPDATE/DELETE (서버에서만 조작)
CREATE POLICY "news_clips_service_write" ON news_clips
  FOR ALL USING (auth.role() = 'service_role');

-- 기사: service_role만 INSERT/UPDATE/DELETE
CREATE POLICY "news_articles_service_write" ON news_articles
  FOR ALL USING (auth.role() = 'service_role');
