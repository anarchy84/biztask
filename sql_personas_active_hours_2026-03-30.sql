-- ================================================================
-- NPC 활동시간 + 일일 설정 컬럼 추가 SQL
-- 날짜: 2026-03-30
-- 용도: NPC별 활동 시간대, 일일 활동량 제어 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행
-- ================================================================

-- ─── 활동 시간대 설정 (KST 기준, 시작~종료) ───
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS active_start_hour INT NOT NULL DEFAULT 9;   -- 활동 시작 시간 (기본 09시)

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS active_end_hour INT NOT NULL DEFAULT 23;    -- 활동 종료 시간 (기본 23시)

-- ─── 오늘 활동량 추적 (일일 리셋용) ───
ALTER TABLE personas
ADD COLUMN IF NOT EXISTS today_posts INT NOT NULL DEFAULT 0;         -- 오늘 쓴 글 수

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS today_comments INT NOT NULL DEFAULT 0;      -- 오늘 쓴 댓글 수

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS today_likes INT NOT NULL DEFAULT 0;         -- 오늘 누른 좋아요 수

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS today_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;  -- 마지막 리셋 날짜

-- ─── 기본 NPC들에 다양한 활동시간 부여 ───
-- 직장인형: 점심시간 + 퇴근 후 (12-14, 19-23)
UPDATE personas SET active_start_hour = 12, active_end_hour = 23
WHERE nickname IN ('현직대기업', '퇴근하고한잔', '논리왕', '지표의노예');

-- 자영업형: 오전~저녁 (9-22)
UPDATE personas SET active_start_hour = 9, active_end_hour = 22
WHERE nickname IN ('뜨아는사랑', '점주님', '식당왕김국자', '납품아재', '네일하는누나');

-- MZ형: 늦은 오후~새벽 (14-01)
UPDATE personas SET active_start_hour = 14, active_end_hour = 1
WHERE nickname IN ('MZ사장', '짤방사냥꾼', '가성비충', '방구석디자인');

-- 야행성: 저녁~새벽 (20-02)
UPDATE personas SET active_start_hour = 20, active_end_hour = 2
WHERE nickname IN ('편의점빌런');

-- 은둔형: 랜덤 짧은 시간 (22-01)
UPDATE personas SET active_start_hour = 22, active_end_hour = 1
WHERE nickname IN ('눈팅만10년');

-- 올타임: 하루종일 (8-24)
UPDATE personas SET active_start_hour = 8, active_end_hour = 0
WHERE nickname IN ('궁금한게많음', '자영업은지옥', '위탁판매러', '장사는취미', '내일은맑음', '광고충');

-- ─── 댓글 빈도를 게시글보다 높게 기본 설정 ───
-- 게시글: 1~3개/일, 댓글: 5~15개/일, 좋아요: 10~30개/일
UPDATE personas SET post_frequency = 1, comment_frequency = 8, like_frequency = 15
WHERE nickname IN ('현직대기업', '점주님', '납품아재', '눈팅만10년');

UPDATE personas SET post_frequency = 2, comment_frequency = 10, like_frequency = 20
WHERE nickname IN ('뜨아는사랑', '네일하는누나', '퇴근하고한잔', '가성비충', '위탁판매러');

UPDATE personas SET post_frequency = 3, comment_frequency = 12, like_frequency = 25
WHERE nickname IN ('MZ사장', '짤방사냥꾼', '방구석디자인', '궁금한게많음', '자영업은지옥');

UPDATE personas SET post_frequency = 2, comment_frequency = 15, like_frequency = 20
WHERE nickname IN ('광고충', '논리왕', '지표의노예', '식당왕김국자');

UPDATE personas SET post_frequency = 1, comment_frequency = 5, like_frequency = 25
WHERE nickname IN ('장사는취미', '내일은맑음', '편의점빌런');
