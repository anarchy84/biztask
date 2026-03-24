-- =============================================================
-- 파일 위치: schema.sql (프로젝트 루트)
-- 용도: Supabase SQL Editor에 복사-붙여넣기하여 테이블을 생성합니다.
-- 실행 방법:
--   1. Supabase 대시보드 → SQL Editor 클릭
--   2. 이 파일 전체 내용을 복사-붙여넣기
--   3. "Run" 버튼 클릭
-- =============================================================

-- -------------------------------------------------
-- 0) 기존 테이블이 있으면 삭제 (깨끗하게 재생성)
--    ※ 이미 데이터가 있는 운영 DB에서는 사용 금지!
-- -------------------------------------------------
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS profiles;

-- -------------------------------------------------
-- 1) profiles 테이블: 사용자 프로필 (익명 닉네임 등)
-- -------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 고유 ID (자동 생성)
  nickname TEXT NOT NULL DEFAULT '익명',                      -- 닉네임 (기본값: 익명)
  avatar_url TEXT DEFAULT NULL,                              -- 프로필 이미지 URL (선택)
  bio TEXT DEFAULT '',                                       -- 자기소개 한줄
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()              -- 가입 시각
);

-- -------------------------------------------------
-- 2) posts 테이블: 피드에 표시될 게시글
-- -------------------------------------------------
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),            -- 게시글 고유 ID
  author_id UUID NOT NULL REFERENCES profiles(id)           -- 작성자 (profiles 테이블 참조)
    ON DELETE CASCADE,
  title TEXT NOT NULL,                                       -- 게시글 제목
  content TEXT NOT NULL DEFAULT '',                           -- 게시글 본문
  category TEXT NOT NULL DEFAULT '자유',                      -- 카테고리 (자유, 사업, 마케팅 등)
  upvotes INT NOT NULL DEFAULT 0,                            -- 추천 수
  comment_count INT NOT NULL DEFAULT 0,                      -- 댓글 수
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()              -- 작성 시각
);

-- -------------------------------------------------
-- 3) RLS(Row Level Security) 정책
--    → 누구나 읽을 수 있지만, 쓰기는 인증된 사용자만 가능
-- -------------------------------------------------

-- profiles 테이블 RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 누구나 프로필 조회 가능 (익명 커뮤니티이므로 공개)
DROP POLICY IF EXISTS "프로필 공개 조회" ON profiles;
CREATE POLICY "프로필 공개 조회"
  ON profiles FOR SELECT
  USING (true);

-- 본인 프로필만 수정 가능 (auth.uid()와 id가 같을 때)
DROP POLICY IF EXISTS "본인 프로필 수정" ON profiles;
CREATE POLICY "본인 프로필 수정"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- posts 테이블 RLS 활성화
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 누구나 게시글 조회 가능
DROP POLICY IF EXISTS "게시글 공개 조회" ON posts;
CREATE POLICY "게시글 공개 조회"
  ON posts FOR SELECT
  USING (true);

-- 인증된 사용자만 게시글 작성 가능
DROP POLICY IF EXISTS "인증된 사용자 글 작성" ON posts;
CREATE POLICY "인증된 사용자 글 작성"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 본인 게시글만 수정 가능
DROP POLICY IF EXISTS "본인 게시글 수정" ON posts;
CREATE POLICY "본인 게시글 수정"
  ON posts FOR UPDATE
  USING (auth.uid() = author_id);

-- 본인 게시글만 삭제 가능
DROP POLICY IF EXISTS "본인 게시글 삭제" ON posts;
CREATE POLICY "본인 게시글 삭제"
  ON posts FOR DELETE
  USING (auth.uid() = author_id);

-- -------------------------------------------------
-- 4) 더미 데이터 삽입 (개발용 테스트 데이터)
-- -------------------------------------------------

-- 더미 프로필 3명
INSERT INTO profiles (id, nickname, bio) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '창업가김대리', '스타트업에서 야근하는 직장인'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '마케터박과장', '퍼포먼스 마케팅 5년차'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '개발자이주임', '풀스택 개발자 지망생');

-- 더미 게시글 5개
INSERT INTO posts (author_id, title, content, category, upvotes, comment_count, created_at) VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '스타트업 3년차, 솔직한 매출 공개합니다',
    '월매출 3000만원 달성까지의 여정을 공유합니다. 처음 6개월은 정말 힘들었지만...',
    '사업',
    142,
    38,
    now() - INTERVAL '2 hours'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '퍼포먼스 마케팅 vs 브랜드 마케팅, 뭐가 먼저?',
    '초기 스타트업이라면 퍼포먼스부터 시작하라는 말이 많은데, 제 경험은 좀 다릅니다.',
    '마케팅',
    87,
    24,
    now() - INTERVAL '5 hours'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '비전공자 개발 입문 6개월 후기',
    'Next.js와 Supabase로 사이드 프로젝트를 만들면서 배운 것들을 정리했습니다.',
    '커리어',
    203,
    56,
    now() - INTERVAL '1 day'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '법인 설립 vs 개인사업자, 뭐가 유리할까?',
    '세무사에게 상담받은 내용 정리합니다. 매출 규모에 따라 다른데...',
    '사업',
    65,
    17,
    now() - INTERVAL '3 days'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'ChatGPT로 블로그 자동화한 결과 (3개월)',
    'AI로 콘텐츠 자동화했더니 트래픽이 200% 증가했습니다. 방법 공유합니다.',
    '마케팅',
    310,
    89,
    now() - INTERVAL '6 hours'
  );
