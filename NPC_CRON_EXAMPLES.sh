#!/bin/bash
# ════════════════════════════════════════════════════════════
# NPC 크론 엔드포인트 테스트 예제
# ════════════════════════════════════════════════════════════

BASE_URL="http://localhost:3000"
CRON_SECRET="your_super_secret_key"

# ════════════════════════════════════════════════════════════
# 1. GET 핸들러: 외부 크론 서비스 호출 (인증 필요)
# ════════════════════════════════════════════════════════════

echo "=== 1. 전체 NPC 크론 실행 (GET) ==="
curl -X GET "$BASE_URL/api/admin/npc-cron" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo "=== 2. GET 응답 예시 (성공) ==="
cat << 'EOF'
{
  "success": true,
  "cron": true,
  "kstHour": 14,
  "currentDate": "2026-03-30",
  "summary": {
    "executed": 5,
    "posts": 1,
    "comments": 3,
    "votes": 1,
    "skipped": 3,
    "errors": 0
  },
  "totalPersonas": 20,
  "message": "5개 행동 실행 (글1, 댓글3, 추천1)"
}
EOF

echo ""
echo "=== 3. GET 응답 예시 (인증 실패) ==="
cat << 'EOF'
{
  "success": false,
  "error": "인증 실패: Authorization 헤더 불일치"
}
EOF

# ════════════════════════════════════════════════════════════
# 2. POST 핸들러: 어드민 패널 수동 실행 (인증 없음, 실제론 추가 필요)
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 4. POST: 모든 NPC 한 번씩 실행 ==="
curl -X POST "$BASE_URL/api/admin/npc-cron" \
  -H "Content-Type: application/json" \
  -d '{"runAll": true}' \
  -v

echo ""
echo "=== 5. POST: 특정 NPC만 실행 ==="
curl -X POST "$BASE_URL/api/admin/npc-cron" \
  -H "Content-Type: application/json" \
  -d '{
    "personaId": "123e4567-e89b-12d3-a456-426614174000"
  }' \
  -v

echo ""
echo "=== 6. POST 응답 예시 (성공) ==="
cat << 'EOF'
{
  "success": true,
  "manual": true,
  "currentDate": "2026-03-30",
  "summary": {
    "executed": 2,
    "posts": 0,
    "comments": 2,
    "votes": 0,
    "skipped": 1,
    "errors": 0
  },
  "npcsProcessed": 3,
  "message": "2개 행동 실행 (글0, 댓글2, 추천0)"
}
EOF

# ════════════════════════════════════════════════════════════
# 3. 환경 변수 설정 (로컬 개발용)
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 7. .env.local 설정 예시 ==="
cat << 'EOF'
# Cron 인증 (GET 핸들러용)
CRON_SECRET=super_secret_cron_key_2026

# AI API 키 (필수: 1개 이상)
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-proj-...

# Supabase 설정 (기존)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
EOF

# ════════════════════════════════════════════════════════════
# 4. 실제 personas 테이블 쿼리 (Supabase SQL)
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 8. 활성 NPC 조회 (Supabase SQL) ==="
cat << 'EOF'
SELECT
  id,
  nickname,
  is_active,
  active_start_hour,
  active_end_hour,
  post_frequency,
  comment_frequency,
  like_frequency,
  today_posts,
  today_comments,
  today_likes,
  today_reset_date,
  total_posts,
  total_comments,
  total_likes,
  last_active_at
FROM personas
WHERE is_active = true
ORDER BY nickname;
EOF

# ════════════════════════════════════════════════════════════
# 5. NPC 설정 업데이트 (수동)
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 9. NPC 활동시간 업데이트 (Supabase SQL) ==="
cat << 'EOF'
-- "현직대기업" NPC: 점심시간 + 퇴근 후 (12-14, 19-23)
UPDATE personas
SET
  active_start_hour = 12,
  active_end_hour = 23,
  post_frequency = 1,
  comment_frequency = 8,
  like_frequency = 15
WHERE nickname = '현직대기업';

-- "뜨아는사랑" NPC: 오전~저녁 (9-22)
UPDATE personas
SET
  active_start_hour = 9,
  active_end_hour = 22,
  post_frequency = 2,
  comment_frequency = 10,
  like_frequency = 20
WHERE nickname = '뜨아는사랑';

-- "MZ사장" NPC: 늦은 오후~새벽 (14-01, wrap-around)
UPDATE personas
SET
  active_start_hour = 14,
  active_end_hour = 1,
  post_frequency = 3,
  comment_frequency = 12,
  like_frequency = 25
WHERE nickname = 'MZ사장';
EOF

# ════════════════════════════════════════════════════════════
# 6. 크론 서비스 통합 (cron-job.org)
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 10. cron-job.org 설정 ==="
cat << 'EOF'
Title: BizTask NPC Cron
URL: https://your-domain.com/api/admin/npc-cron
Method: GET
Headers:
  Authorization: Bearer super_secret_cron_key_2026

Schedule: 0 * * * * (매시간 정각)
또는
Schedule: 0 8-23 * * * (8시~23시 매시간)

Save response: Yes (로그용)
Timeout: 30초
EOF

# ════════════════════════════════════════════════════════════
# 7. 실행 로그 분석
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 11. 크론 실행 로그 확인 (Vercel/Local) ==="
cat << 'EOF'
# Vercel 배포 시 → Vercel Logs
# 로컬 개발 시 → 터미널 콘솔

[NPC Cron GET] 20명 NPC 크론 시작 (KST 14시, 2026-03-30)
[NPC Cron POST] 3명 NPC 수동 실행 (2026-03-30)
EOF

# ════════════════════════════════════════════════════════════
# 8. 성능 모니터링
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 12. 성능 모니터링 포인트 ==="
cat << 'EOF'
1. API 호출 시간
   - GET: 300ms~2초 (NPC 20명 기준)
   - POST: 200ms~1초 (NPC 1~3명)

2. AI 생성 시간
   - Gemini: 1초
   - Anthropic: 1.5초
   - OpenAI: 1.5초

3. DB 쿼리 시간
   - personas 로드: 100ms
   - posts 로드: 150ms
   - insert/update: 50ms per row

4. 전체 실행 시간 (3개 액션)
   - Best: 5초
   - Average: 8초
   - Worst (API timeout): 30초
EOF

# ════════════════════════════════════════════════════════════
# 9. 버그 리포팅 체크리스트
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 13. 버그 리포팅 체크리스트 ==="
cat << 'EOF'
[ ] CRON_SECRET 설정 확인
[ ] AI API 키 최소 1개 이상 설정
[ ] personas 테이블에 is_active = true 인 NPC 있음
[ ] active_start_hour < active_end_hour 또는 wrap-around 올바름
[ ] post_frequency <= comment_frequency (권장)
[ ] today_reset_date가 NULL이 아님
[ ] posts 테이블에 최소 1개 이상 게시글 있음
[ ] comments 테이블 스키마 정상 (parent_id 칼럼 있음)
[ ] post_likes 테이블 스키마 정상
[ ] increment_upvotes RPC 함수 존재
EOF

# ════════════════════════════════════════════════════════════
# 10. 샘플 NPC 데이터
# ════════════════════════════════════════════════════════════

echo ""
echo "=== 14. 샘플 NPC 데이터 (INSERT) ==="
cat << 'EOF'
INSERT INTO personas (
  user_id, nickname, avatar_url, industry, personality, prompt,
  is_active, action_bias, core_interests, interest_weights,
  active_start_hour, active_end_hour,
  post_frequency, comment_frequency, like_frequency,
  today_posts, today_comments, today_likes, today_reset_date
) VALUES (
  'user_123_uuid', '현직대기업', 'https://...', 'IT/개발',
  '블라인드체 시니컬', '...',
  true, '{"post":30,"comment":40,"vote":30}',
  '["개발","API","DevOps"]', '{"개발":100,"API":80}',
  12, 23,
  1, 8, 15,
  0, 0, 0, CURRENT_DATE
);
EOF

echo ""
echo "✅ 모든 예제 생성 완료!"
