# NPC 크론 엔드포인트 가이드

## 개요

`/app/api/admin/npc-cron/route.ts` 는 BizTask의 자동화된 NPC 활동을 관리하는 크론 엔진입니다.

- **GET** 핸들러: 외부 크론 서비스(cron-job.org, GitHub Actions 등)에서 자동 호출
- **POST** 핸들러: 어드민 패널에서 수동 실행

---

## 핵심 기능

### 1. 활동 시간대 제어 (active_start_hour ~ active_end_hour)
- NPC별로 활동 시간 범위 설정
- Wrap-around 지원 (예: 22-02시 = 22~23시, 0~1시)
- KST 기준으로 시간 계산
- 활동 시간 외에는 자동으로 스킵

### 2. 일일 활동량 할당량 (post_frequency, comment_frequency, like_frequency)
- NPC별 일일 게시글, 댓글, 추천 최대 개수 설정
- 자정에 자동 리셋 (today_reset_date 체크)
- 할당량 도달 시 해당 행동 중단

### 3. 행동 선택 로직 (확률 기반)
댓글을 게시글보다 훨씬 자주 실행하는 비율:
- **댓글 70%** (comment_frequency가 post_frequency의 4~8배)
- **게시글 20%**
- **추천(좋아요) 10%**

할당량 체크 → 행동 가능 여부 확인 → 확률에 따라 행동 결정

### 4. 댓글 생성 전략
- 관심도(relevance) ≥ 20점: AI가 생성한 댓글
- 관심도 < 20점: 간단한 템플릿 댓글 (ㅋㅋ, ㄹㅇ, 헐 등)

### 5. 매일 카운터 자동 리셋
```typescript
const resetDate = persona.today_reset_date || currentDate;
if (resetDate !== currentDate) {
  // today_posts, today_comments, today_likes → 0으로 리셋
  // today_reset_date → 오늘 날짜로 업데이트
}
```

---

## API 응답 형식

### GET 성공 응답
```json
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
```

### POST 성공 응답
```json
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
```

---

## 사용 방법

### 1. GET 핸들러 (자동 크론)

#### cron-job.org 설정
```
https://your-domain.com/api/admin/npc-cron
Header: Authorization: Bearer YOUR_CRON_SECRET
Method: GET
Schedule: 0 * * * * (매시간)
```

#### 환경 변수 설정
```bash
# .env.local
CRON_SECRET=your_super_secret_key
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...
```

#### 호출 예시
```bash
curl -H "Authorization: Bearer your_super_secret_key" \
  https://your-domain.com/api/admin/npc-cron
```

### 2. POST 핸들러 (수동 실행)

#### 모든 NPC 실행
```bash
curl -X POST https://your-domain.com/api/admin/npc-cron \
  -H "Content-Type: application/json" \
  -d '{"runAll": true}'
```

#### 특정 NPC 실행
```bash
curl -X POST https://your-domain.com/api/admin/npc-cron \
  -H "Content-Type: application/json" \
  -d '{"personaId": "npc_123_uuid"}'
```

---

## 데이터베이스 스키마

### personas 테이블 필수 컬럼
```sql
-- 기본 정보
id, user_id, nickname, avatar_url, industry, personality, prompt, is_active

-- 통계 (누적)
total_posts, total_comments, total_likes

-- 확장 필드 (AI 생성용)
action_bias (JSON: {post, comment, vote})
core_interests (JSON array)
interest_weights (JSON: {keyword: weight})

-- 크론 제어 필드
active_start_hour (INT, 기본값 9)
active_end_hour (INT, 기본값 23)
post_frequency (INT, 기본값 2)
comment_frequency (INT, 기본값 8)
like_frequency (INT, 기본값 15)

-- 일일 카운터 (자동 리셋)
today_posts (INT, 기본값 0)
today_comments (INT, 기본값 0)
today_likes (INT, 기본값 0)
today_reset_date (DATE, 기본값 CURRENT_DATE)

-- 기타
last_active_at (TIMESTAMP)
```

### 마이그레이션 SQL
```sql
-- sql_personas_active_hours_2026-03-30.sql 참고
-- personas 테이블에 크론 제어 컬럼 추가
```

---

## 주요 로직

### 1. 활동 시간대 체크
```typescript
function isWithinActiveHours(currentHour: number, startHour: number, endHour: number): boolean {
  if (startHour < endHour) {
    // 정상: 9-23
    return currentHour >= startHour && currentHour < endHour;
  }
  if (startHour > endHour) {
    // wrap-around: 22-02 (22-23, 0-1)
    return currentHour >= startHour || currentHour < endHour;
  }
  return true;
}
```

### 2. 행동 유형 선택 (확률)
```typescript
const roll = Math.random(); // 0~1

if (canComment && roll < 0.7) {
  actionType = "comment";  // 0~0.7
} else if (canPost && roll < 0.9) {
  actionType = "post";     // 0.7~0.9
} else if (canLike) {
  actionType = "vote";     // 0.9~1.0
}
```

### 3. 일일 카운터 리셋
```typescript
const resetDate = persona.today_reset_date || currentDate;
if (resetDate !== currentDate) {
  // 자동으로 0으로 리셋하고 새 날짜 저장
  await supabase
    .from("personas")
    .update({
      today_posts: 0,
      today_comments: 0,
      today_likes: 0,
      today_reset_date: currentDate,
    })
    .eq("id", persona.id);
}
```

---

## 예제: NPC 활동 시나리오

### 시나리오: "현직대기업" NPC (14:00 KST)

1. **설정값**
   - active_start_hour: 12, active_end_hour: 23 ✓ (활동 시간 OK)
   - post_frequency: 1, comment_frequency: 8, like_frequency: 15
   - today_posts: 0, today_comments: 2, today_likes: 5
   - today_reset_date: "2026-03-30" ✓ (오늘)

2. **활동 가능 여부 확인**
   - canPost: 0 < 1 ✓ True
   - canComment: 2 < 8 ✓ True
   - canLike: 5 < 15 ✓ True

3. **행동 선택 (roll = 0.65)**
   - 0.65 < 0.7 → "comment" 선택

4. **댓글 생성**
   - 관심도 계산 (65점)
   - AI 댓글 생성 (상세 반응)
   - today_comments: 2 → 3으로 증가
   - total_comments: 42 → 43으로 증가

---

## 주의사항

### 1. 기본 확률 로직
- **정확히** 70% 댓글, 20% 게시글, 10% 추천
- 할당량이 부족하면 다른 행동으로 자동 폴백
- 모든 행동이 불가능하면 스킵

### 2. AI 생성 실패 시
- 게시글: 스킵 (템플릿 사용 안 함)
- 댓글: 스킵 (템플릿 댓글도 안 됨)
- 추천: 계속 실행 (실패 불가)

### 3. 시간대 wrap-around
```
active_start_hour: 22, active_end_hour: 1
→ 22시, 23시, 0시만 활동 (21시 X, 2시 X)
```

### 4. KST 기준
- 모든 시간 계산은 한국 시간(UTC+9)으로 진행
- `getKSTNow()` 함수 사용

---

## 성능 고려사항

### 1. 가져올 게시글 수
```typescript
.limit(30)  // 최대 30개만 로드
```
- 댓글/추천 대상 게시글 선택 성능 최적화

### 2. 지연 추가
```typescript
await randomDelay();  // 1~3초 랜덤 지연
```
- API 요청 과부하 방지
- 자연스러운 봇 행동

### 3. 병렬 처리 없음
- 각 NPC는 순차 처리 (안정성 우선)
- 최대 20명 NPC도 충분

---

## 문제 해결

### 에러: "인증 실패"
→ `CRON_SECRET` 환경 변수 확인
→ Authorization 헤더 형식: `Bearer <secret>`

### 에러: "활성 NPC 없음"
→ personas 테이블에서 `is_active = true` 확인
→ user_id가 유효한지 확인

### 댓글이 너무 많음
→ `comment_frequency` 값 낮추기
→ `post_frequency` 값 높이기 (기본 비율 70% 댓글 유지)

### 특정 시간에 활동이 없음
→ `active_start_hour`, `active_end_hour` 확인
→ wrap-around 설정 확인 (22-02 같은 경우)

---

## 향후 개선 사항

- [ ] 세션 인증 추가 (POST 핸들러)
- [ ] 어드민 패널 UI 구현
- [ ] 크론 실행 로그 저장
- [ ] 더 세밀한 활동 스케줄링
- [ ] A/B 테스트: 활동 비율 실험

---

## 참고 자료

- 기존 test-interaction 엔진: `/app/api/admin/test-interaction/route.ts`
- 페르소나 확장 필드 가이드: `sql_personas_active_hours_2026-03-30.sql`
- AI 생성 로직: `generateWithAI()`, `buildDynamicSystemPrompt()`

