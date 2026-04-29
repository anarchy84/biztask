# 🤝 코덱스 인계서 — Phase 7-A (글쓰기 audit) + Phase 7-B (활어 V2 설계)

> **현재 브랜치**: `v2-redesign` (마지막 push: `91c2ea4`)
> **작성일**: 2026-04-28
> **작성자**: 클로드 (대웅 위임)
> **이번 작업 분담**: 둘 다 코덱스가 자율 진행 (대웅은 다른 세션에서 클로드와 별도 작업)

---

## 0. 시작 전 필독 (5분)

순서대로 읽고 시작:
1. `docs/CODEX_GUIDELINES.md` — 두 AI 협업 규약
2. `docs/CODEX_PHASE_3_TO_6_BRIEF.md` — 이전에 너가 한 작업 (참고)
3. `docs/grit_master_plan_v2.md` — V2 기획서 단일 소스
4. `docs/design_direction_v2.md` — 디자인 방향성

**현재 브랜치 상태 확인**:
```bash
cd /Users/anarchy/Claud_Projects/biztask/Biztask/grit-app
git pull
git log --oneline -5
```

`91c2ea4`가 HEAD에 있어야 정상.

---

## 1. 작업 A — 글쓰기 사이클 코드 Audit (1시간)

### 목적

대웅이 시뮬레이터에서 글쓰기→발행→피드 사이클 검증 시 막히지 않게 **코드 흐름 정적 분석 + 빠진 에러 핸들링 + RLS 누락 점검**.

시뮬레이터 클릭은 대웅이 직접. 너는 **코드 audit + 발견 사항 정리**.

### 점검 대상 (체크리스트)

#### 1-1. 글쓰기 → 발행 플로우

`app/post/new.tsx` → `lib/hooks/usePostSubmit.ts` → Supabase posts insert → 화면 redirect

체크:
- [ ] `usePostSubmit`이 발행 성공 후 홈 피드 캐시를 invalidate / refresh 트리거하는지
- [ ] 발행 실패 시 사용자 에러 메시지가 명확한 한글인지
- [ ] tier='guest'면 RLS가 INSERT 막는지 (서버 안전망)
- [ ] 이미지 업로드 중 발행 누르면 어떻게 되는지 (uploading 상태 체크)
- [ ] 동영상 URL 빈 string이면 null로 저장되는지

#### 1-2. 글 상세 + 좋아요 + 댓글

`app/post/[id].tsx` → `usePost` + `useReaction` + `useCommentSubmit`

체크:
- [ ] 좋아요 낙관적 업데이트가 실패 시 롤백 되는지
- [ ] 댓글 작성 후 댓글 리스트 즉시 반영되는지 (appendComment)
- [ ] 무한 댓글 트리 (parent_id) 렌더링이 깊이 제한 없는지
- [ ] 본인 글 좋아요 막혀있는지 (선택사항)

#### 1-3. 팔로우 (구현 안 됐으면 신규)

탐색 화면의 "추천 사장님" 카드에 팔로우 버튼이 동작하는지.

체크:
- [ ] `lib/hooks/useFollow.ts` 존재 확인 (없으면 신규 작성)
- [ ] follows 테이블 INSERT/DELETE
- [ ] 팔로워 카운트 트리거가 자동 갱신되는지 (이미 있음)
- [ ] 화면에서 본 카운트가 즉시 갱신되는지 (낙관적)
- [ ] 본인 팔로우 막혀있는지 (CHECK 제약 + 화면 분기)

#### 1-4. RLS 정책 누락 점검

Supabase Dashboard → Authentication → Policies에서 확인:
- [ ] posts: 게스트 SELECT 허용 / general+ INSERT 허용 / 본인만 UPDATE/DELETE
- [ ] comments: 동일 패턴
- [ ] reactions: general+ INSERT 본인 user_id만
- [ ] follows: 본인 follower_id만 INSERT/DELETE (이미 적용됨)
- [ ] profiles: 본인 UPDATE만 + 모두 SELECT
- [ ] storage: post-images / avatars 버킷 RLS

미흡한 정책 발견 시 마이그레이션 SQL 작성 (`supabase/migrations/011_*.sql`).

### 결과물

`docs/audit_phase7a_findings.md` 신규 작성:

```markdown
# Phase 7-A 글쓰기 사이클 Audit 결과

## 발견 사항 (심각도별)

### 🔴 Critical (대웅 검증 전 반드시 수정)
- ...

### 🟡 Major (1주 내 수정 권장)
- ...

### 🟢 Minor (Polish)
- ...

## 수정한 파일
- file1.ts: ...
- file2.tsx: ...

## 신규 작성한 파일
- ...

## 대웅에게 검증 요청 사항
1. 시뮬레이터에서 [흐름 N] 직접 시도
2. ...
```

---

## 2. 작업 B — 활어 엔진 V2 고도화 설계 문서 (1.5시간)

### 목적

V1 활어 엔진 자산 (3 cron + 10 NPC + 4-Layer 댓글 픽 + 글밥 창고 RAG)을 V2에 어떻게 적용할지 **설계 문서만** 작성. 실제 코드 구현은 다음 세션 (대웅 + 클로드).

### 사전 읽기

V1 활어 엔진 자료는 두 군데에 있음:

1. **메모리 (요약)**:
   - `.auto-memory/project_activity_engine.md` (3 cron + 10 NPC + 4-Layer)
   - `.auto-memory/project_content_backlog_architecture.md` (글밥 창고 + RAG)
   - `.auto-memory/project_news_clipping.md` (뉴스클리핑)
   
   ※ 코덱스는 .auto-memory 직접 접근 불가. 대웅한테 핵심 요약 받거나 git log에서 V1 commit 메시지 참조.
   
2. **V1 코드 (GitHub)**:
   - 옛 BizTask repo (Vercel `biztask` 프로젝트와 연결됐던 것)
   - Vercel은 폐기됐지만 GitHub 코드는 살아있음
   - `~/Claud_Projects/biztask/Biztask/` 안 옛 폴더 (아직 아카이브 X)

### V2에서 변경할 것

V1 → V2 마이그레이션 포인트:

| V1 | V2 |
|---|---|
| 단일 카테고리(humor/worry/question/tip) | + 시크릿 라운지 (인증 사장님 전용) |
| 모든 NPC 일반 회원 | NPC도 tier 분기 (verified vs general) |
| 시간순 피드 | 추천 알고리즘 점수 (`get_feed_ranked`) — NPC 글이 알고리즘에 잘 잡히게 가중 |
| 단일 이미지 | 다중 이미지 (4장) + 동영상 |
| 일반 카테고리만 | 시크릿 라운지 카테고리 (B2B 매칭/구인구직/매물/트러블) |

### 설계 문서 작성

`docs/activity_engine_v2_design.md` 신규:

```markdown
# 활어 엔진 V2 고도화 설계

## V1 자산 (계승)
- 3 cron (스크래퍼 / 댓글봇 / 보팅봇)
- 10 NPC 페르소나
- 4-Layer 댓글 픽 (시간/관심/감정/희소성)
- 글밥 창고 RAG

## V2 변경 포인트

### 1. NPC 페르소나 V2 확장
- 기존 10명 → 16명? (시크릿 라운지용 인증 사장님 NPC 6명 추가)
- tier 매핑 표
- 업종/지역 다양화

### 2. 콘텐츠 라우팅
- 일반 카테고리 (humor/worry/...) NPC
- 시크릿 라운지 카테고리 (b2b/jobs/property/trouble) NPC
- 라우팅 규칙

### 3. 추천 알고리즘 시너지
- NPC 글이 cold start에 잘 노출되도록 quote_count·bookmark_count 시드 부여
- "팔로워 N명이 추천했습니다" 메시지 NPC 가짜 팔로우 그래프

### 4. cron 스케줄 V2
- 스크래퍼: 1시간마다
- 글 발행: 30분마다 (피크 시간대 가중)
- 댓글봇: 5분마다 (실시간성)
- 보팅봇: 10분마다 (자연스러운 카운트 증가)
- 시크릿 라운지 봇: 별도 (인증 게이팅)

### 5. RAG 글밥 창고 V2
- V1: 댓글 생성에만 사용
- V2: 댓글 + 신규 글 + 인용 글 모두 RAG 활용

### 6. 안전장치
- NPC 글 비율 70% → 사용자 30%였던 V1 → V2에선 점진적 역전 (가입자 늘면 비율 자동 조정)
- NPC 댓글 너무 많이 달리는 거 차단 (한 글당 최대 3 NPC 댓글)

## 구현 우선순위 (다음 세션)
1. NPC 6명 신규 페르소나 시드
2. 시크릿 라운지 카테고리 enum + RLS
3. cron Edge Function 구조 정의
4. 4-Layer 댓글 픽 알고리즘 V2 가중치 재조정
```

### 결과물

`docs/activity_engine_v2_design.md` (위 구조)

---

## 3. 작업 분담 (충돌 방지)

이번 세션엔 **클로드는 GRIT 작업 안 함**. 대웅이 다른 세션에서 클로드와 별도 작업 진행.

너만 v2-redesign 브랜치에서 진행. 다음 파일에만 변경:
- `docs/audit_phase7a_findings.md` (신규)
- `docs/activity_engine_v2_design.md` (신규)
- 마이그레이션 추가 시 `supabase/migrations/011_*.sql` (RLS 누락 발견 시)
- 코드 audit으로 발견된 버그 수정 (각 파일별)

---

## 4. 끝났을 때

대웅이 돌아오면:

```
Phase 7-A 끝남. audit 결과 docs/audit_phase7a_findings.md 봐줘.
Critical 이슈 N개, Major M개 발견. 시뮬레이터 검증 전에 [수정 사항] 확인해줘.

Phase 7-B 끝남. 활어 엔진 V2 설계 docs/activity_engine_v2_design.md 작성.
NPC 6명 신규 페르소나 + 시크릿 라운지 카테고리 + cron 스케줄 V2.
다음 세션에서 대웅이랑 클로드가 코드 구현 들어갈 예정.
```

대웅이 검수 후 push. 자동 push X.

---

## 5. 끝.

질문/막히는 거 있으면 대웅한테 메시지 남기기. 클로드는 다른 세션에 있어서 즉시 응답 안 함.
