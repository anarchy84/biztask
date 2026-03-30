# NPC 크론 엔드포인트 - 파일 목록

## 프로젝트 루트 기준 경로

### 구현 파일 (필수)
```
/app/api/admin/npc-cron/route.ts
- 메인 구현 파일
- 928줄의 프로덕션 레디 코드
- GET & POST 핸들러 포함
- 다음 기능 포함:
  * 활동 시간대 제어
  * 일일 할당량 관리
  * 행동 선택 로직 (70% 댓글, 20% 글, 10% 추천)
  * AI 텍스트 생성 (폴백 체인)
  * 관심도 계산 및 동적 프롬프트
```

### 문서 파일 (참고용)

#### 1. NPC_CRON_README.md
- 전체 기능 설명
- API 응답 형식
- 사용 방법 (GET/POST)
- 데이터베이스 스키마
- 주요 로직 설명
- 문제 해결 (FAQ)

#### 2. NPC_CRON_EXAMPLES.sh
- curl 테스트 예제
- 환경 변수 설정 예시
- Supabase SQL 예제
- cron-job.org 설정
- 성능 모니터링 포인트
- 샘플 NPC 데이터

#### 3. NPC_CRON_IMPLEMENTATION_SUMMARY.md
- 구현 완료 보고서
- 생성된 파일 목록
- 기능 체크리스트
- 아키텍처 결정 사항
- 성능 지표
- 배포 체크리스트
- 향후 개선 계획

#### 4. FILE_MANIFEST.md (이 파일)
- 전체 파일 목록 및 설명
- 경로 정보
- 파일별 크기 및 내용

---

## 필수 마이그레이션 파일 (기존)

```
/sql_personas_active_hours_2026-03-30.sql
- personas 테이블 업데이트
- 다음 컬럼 추가:
  * active_start_hour (INT)
  * active_end_hour (INT)
  * post_frequency (INT)
  * comment_frequency (INT)
  * like_frequency (INT)
  * today_posts (INT)
  * today_comments (INT)
  * today_likes (INT)
  * today_reset_date (DATE)
```

---

## 참고 파일 (기존)

```
/app/api/admin/test-interaction/route.ts
- 1084줄의 기존 NPC 자동화 엔진
- npc-cron의 핵심 로직 참고용
- AI 생성 함수, 관심도 계산 등 참고

/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md
- Next.js Route Handler API 문서
- GET/POST 핸들러 구현 가이드

/CLAUDE.md, /AGENTS.md
- 프로젝트 커스텀 지침
```

---

## 파일 크기 및 통계

### 구현 파일
- route.ts: 928줄, ~36KB
  - 함수: 30개
  - 타입 정의: 4개
  - 핸들러: 2개 (GET, POST)

### 문서 파일
- NPC_CRON_README.md: ~500줄
- NPC_CRON_EXAMPLES.sh: ~300줄
- NPC_CRON_IMPLEMENTATION_SUMMARY.md: ~400줄
- FILE_MANIFEST.md: ~150줄 (이 파일)

---

## 배포 전 확인 사항

### 1단계: 마이그레이션
```bash
# Supabase SQL Editor에서 실행
sql_personas_active_hours_2026-03-30.sql
```

### 2단계: 환경 변수
```bash
# .env.local 또는 Vercel 환경 변수
CRON_SECRET=your_secret_key
ANTHROPIC_API_KEY=sk-...
GEMINI_API_KEY=...
OPENAI_API_KEY=...
```

### 3단계: 테스트
```bash
# 로컬 테스트
curl -H "Authorization: Bearer your_secret_key" \
  http://localhost:3000/api/admin/npc-cron

# POST 테스트
curl -X POST http://localhost:3000/api/admin/npc-cron \
  -H "Content-Type: application/json" \
  -d '{"runAll": true}'
```

### 4단계: 크론 등록
```
cron-job.org 또는 GitHub Actions에서
GET /api/admin/npc-cron 등록
Authorization: Bearer $CRON_SECRET
Schedule: 0 * * * * (매시간)
```

---

## 다음 단계 (향후 작업)

1. **POST 핸들러 인증 추가**
   - 세션 검증 미들웨어
   - VIP 사용자만 접근

2. **어드민 패널 UI**
   - NPC 목록 조회
   - 수동 실행 버튼
   - 실행 로그 확인

3. **모니터링 & 알람**
   - Sentry 통합
   - Slack 알림
   - 실행 시간 메트릭

4. **더 세밀한 스케줄링**
   - 요일별 설정
   - 시간대별 활동 확률
   - 휴일 제외

---

## 빠른 시작 가이드

### 5분 만에 시작하기

1. **마이그레이션 실행**
   ```bash
   # sql_personas_active_hours_2026-03-30.sql을
   # Supabase SQL Editor에서 실행
   ```

2. **환경 변수 설정**
   ```bash
   CRON_SECRET=demo_secret_12345
   GEMINI_API_KEY=AIzaXXX
   ```

3. **테스트**
   ```bash
   curl http://localhost:3000/api/admin/npc-cron \
     -H "Authorization: Bearer demo_secret_12345"
   ```

4. **크론 등록**
   - cron-job.org에 이 URL 등록
   - Authorization 헤더 추가
   - 매시간 실행 설정

---

## 문제 시 확인 사항

1. **마이그레이션 확인**
   ```sql
   SELECT * FROM personas LIMIT 1;
   -- active_start_hour, post_frequency 등이 보여야 함
   ```

2. **환경 변수 확인**
   ```bash
   # .env.local이 로드되었는지 확인
   echo $CRON_SECRET
   ```

3. **NPC 확인**
   ```sql
   SELECT count(*) FROM personas WHERE is_active = true;
   -- 1개 이상 있어야 함
   ```

4. **로그 확인**
   ```bash
   # 터미널에 [NPC Cron] 로그가 보여야 함
   # Vercel 배포 시 → Vercel Logs 확인
   ```

---

## 지원 범위

- Next.js 15.1+ (App Router)
- TypeScript 5.x
- Supabase SDK v2.x
- Node.js 18+

---

**생성 일시**: 2026-03-30  
**상태**: Production Ready  
**버전**: 1.0  

