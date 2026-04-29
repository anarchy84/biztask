# 🤝 코덱스 인계서 — Phase 8 활어 엔진 V2 구현

> **현재 브랜치**: `v2-redesign`
> **작성일**: 2026-04-29
> **클로드가 한 일**: M012 마이그레이션 적용 + 설계 문서
> **너가 할 일**: NPC 16명 시드 + Edge Functions 4종 + V1 코드 포팅

---

## 0. 사전 확인 (1분)

```bash
cd /Users/anarchy/Claud_Projects/biztask/Biztask/grit-app
git pull
ls -la supabase/migrations/012_*.sql
```

마이그레이션 적용 확인 SQL (Supabase SQL Editor):
```sql
SELECT
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema='public' 
   AND table_name IN ('npc_personas','content_backlog','npc_activity_log')) AS new_tables,
  (SELECT COUNT(*) FROM pg_proc WHERE proname='get_npc_load_balance') AS new_rpcs;
```
결과: 3 tables / 1 rpc 떠야 정상.

---

## 1. 작업 A — NPC 16명 시드 INSERT (1h)

### 사전 읽기

`docs/activity_engine_v2_design.md` 표 §1 — NPC 16명 명단 (기존 10 + 신규 6).

### 단계

1. **auth.users + profiles 생성** (NPC 1명당 1세트)
   - Supabase Admin API 사용 (service_role 필요)
   - email: `npc_<persona_slug>@grit.internal`
   - email_confirmed_at: now()
   - is_anonymous: false
   - profile: nickname, industry, region, years_in_business, tier, is_npc=true
   - 단, V1 NPC 14명이 이미 DB에 있으면 **재사용** (is_npc=true + npc_persona_id 매핑)

2. **npc_personas 테이블 INSERT** (16명 메타)
   - profile_id ← 위에서 만든 (또는 매핑한) profile.id
   - tone, primary_categories, category_weights (jsonb) 채움
   - 설계 문서의 적합도 매트릭스를 jsonb로:
     ```json
     {
       "humor": 0.4, "worry": 1.0, "question": 0.5, "tip": 0.3,
       "secret_staffing": 0.0, "secret_cost": 0.0, "secret_property": 0.0, "secret_trouble": 0.0
     }
     ```

3. **profiles.npc_persona_id 백필**
   ```sql
   UPDATE public.profiles SET npc_persona_id = (SELECT id FROM npc_personas WHERE display_name = profiles.nickname);
   ```

### 권장 패턴

`scripts/seed_npc_personas.ts` 신규 작성 (Node 스크립트):
- service_role 키 사용
- 트랜잭션 보호
- 멱등성 (이미 있으면 UPDATE)

---

## 2. 작업 B — Supabase Edge Functions 4종 (3h)

### 폴더 구조

```
grit-app/supabase/functions/
├── post-publisher/index.ts       — content_backlog → posts (30분 cron)
├── comment-bot/index.ts          — 4-Layer 픽 + 댓글 발행 (5분 cron)
├── vote-bot/index.ts             — 가짜 reactions seed (10분 cron)
└── secret-lounge-bot/index.ts    — 시크릿 통합 (20분 cron)
```

### post-publisher 핵심 로직

```typescript
// 1. content_backlog WHERE status='queued' AND scheduled_for <= now() 1건 픽
// 2. assigned_persona_id 없으면 카테고리 적합도 + 로드밸런싱으로 NPC 픽
//    (get_npc_load_balance RPC + npc_personas.category_weights)
// 3. NPC 페르소나 톤으로 본문 재작성 (OpenAI / Anthropic API)
// 4. posts INSERT (author_id = persona의 profile_id)
//    + 가짜 시드: like_count = randint(1,4), bookmark_count = randint(0,2)
// 5. content_backlog.status = 'published'
// 6. npc_activity_log INSERT (action_type='post')
```

### comment-bot 4-Layer 픽

```typescript
// Layer 1: 글 선택 가중치 랜덤
//   - 최근 24h 글 60%, 2~7일 30%, 7~30일 10%
//   - comment_count < 25만 picks
// Layer 2: 글당 NPC 풀 결정 (조용한 글 2~3, 보통 4~6, 떡밥 7~10)
// Layer 3: NPC 선정
//   - npc_personas.category_weights[글.category] × get_npc_load_balance.load_score
// Layer 4: 시간 분산 (즉시 1~2개, 30분~2시간 후 3~5, 6~24h 후 3~5)
//   - scheduled_for로 큐잉
```

### vote-bot

```typescript
// 최근 30일 글/댓글 중 보팅 적은 거 픽
// like:dislike = 8:2
// 시간당 보팅 수 제한 (NPC당 vote_freq_per_day ÷ 24)
// reactions UNIQUE 제약 위배 안 되게 EXISTS 체크 후 INSERT
```

### secret-lounge-bot

```typescript
// 위 3 봇을 통합한 단일 cron
// surface='secret_lounge'로 필터링
// tier verified+ NPC만 사용
// 카테고리: secret_staffing/cost/property/trouble
```

---

## 3. 작업 C — V1 BizTask repo에서 코드 포팅 (1h)

V1 코드 위치:
- GitHub: `anarchy84/biztask` (옛 BizTask repo, 폐기됐지만 코드 살아있음)
- 로컬: `~/Claud_Projects/biztask/Biztask/` (옛 폴더, 참고용)

가져올 핵심 파일:
- `app/api/admin/publisher-cron/route.ts` → Edge Function으로 포팅
- `app/api/admin/comment-bot/route.ts` → 동일
- `app/api/admin/vote-bot/route.ts` → 동일
- `lib/scrapers/` 전체 (글밥 창고용)
- `lib/personas/` (NPC 프롬프트 템플릿)

V1 → V2 차이:
- V1: Vercel cron + Next.js API route
- V2: Supabase Edge Function (Deno) + Supabase scheduled tasks
- V1: `supabase/server.ts` 사용 → V2: Edge Function 환경 (Deno + supabase-js)

---

## 4. 작업 D — cron 스케줄 등록 (10분)

Supabase Dashboard → Database → Cron Jobs:

```
post-publisher       */30 * * * *   (30분마다)
comment-bot          */5 * * * *    (5분마다)
vote-bot             */10 * * * *   (10분마다)
secret-lounge-bot    */20 * * * *   (20분마다)
```

각 잡은 Edge Function 호출 (`net.http_post(...)`).

---

## 5. 검증 (각 단계마다)

### 시드 INSERT 후
```sql
SELECT COUNT(*) FROM npc_personas;  -- 16
SELECT display_name, tier FROM npc_personas ORDER BY tier, display_name;
SELECT COUNT(*) FROM profiles WHERE is_npc = true AND npc_persona_id IS NOT NULL;  -- 16
```

### Edge Function 배포 후 (수동 트리거)
```sql
-- post-publisher 1회 호출 후
SELECT COUNT(*) FROM posts WHERE author_id IN (SELECT profile_id FROM npc_personas);
SELECT COUNT(*) FROM npc_activity_log WHERE action_type = 'post';
SELECT * FROM content_backlog WHERE status = 'published' ORDER BY published_at DESC LIMIT 5;
```

### cron 실행 후 (24h 관찰)
```sql
-- NPC 활동량 분포 (로드밸런싱 잘 되는지)
SELECT n.display_name, COUNT(a.*) AS activities
FROM npc_personas n
LEFT JOIN npc_activity_log a ON a.persona_id = n.id AND a.created_at > now() - INTERVAL '24h'
GROUP BY n.display_name
ORDER BY activities DESC;
```

균등 분포 (편차 ±30% 이내) 떠야 정상.

---

## 6. 안전장치 체크리스트

- [ ] env `DISABLE_ACTIVITY_ENGINE=true`면 모든 봇 즉시 정지
- [ ] env `MAX_NPC_RATIO=0.7` 초과 시 NPC 글 발행 중단
- [ ] 같은 NPC 30분 안에 같은 surface 연속 발행 막힘
- [ ] secret 카테고리는 verified+ NPC만 작성
- [ ] 트러블 카테고리 법률 단정 표현 필터
- [ ] reactions UNIQUE 제약 (M011) 준수

---

## 7. 끝났을 때

대웅에게 보고:

```
Phase 8 완료. 활어 엔진 V2 라이브.

- npc_personas 16명 시드 INSERT
- Edge Functions 4종 배포 (post-publisher/comment-bot/vote-bot/secret-lounge-bot)
- cron 스케줄 등록
- 24h 관찰: NPC 활동 분포 균등 ±30% 이내

다음 세션: 어드민 대시보드 (NPC 활동 모니터링 + kill switch UI)
```

대웅 검수 후 push (자동 push X).

---

## 끝.

질문 있으면 docs/activity_engine_v2_design.md (코덱스 본인 설계 문서) 참조.
