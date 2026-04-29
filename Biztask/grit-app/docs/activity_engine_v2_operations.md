# 활어 엔진 V2 운영 적용 절차

> 한글 주석: Phase 8 코드 반영 후 원격 Supabase에 seed/deploy/cron을 적용하는 순서.

## 1. 필수 secret

```bash
export SUPABASE_URL="https://lqotquxmmrshikevqnsg.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."
export ACTIVITY_ENGINE_CRON_SECRET="..."
```

Supabase Edge Function secret:

```bash
npx supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  ACTIVITY_ENGINE_CRON_SECRET="$ACTIVITY_ENGINE_CRON_SECRET" \
  MAX_NPC_RATIO="0.7" \
  DISABLE_ACTIVITY_ENGINE="false" \
  DISABLE_SECRET_BOT="false"
```

LLM 재작성 사용 시:

```bash
npx supabase secrets set ANTHROPIC_API_KEY="..." OPENAI_API_KEY="..."
```

DB cron에서 읽을 Vault secret:

```sql
SELECT vault.create_secret('실제-긴-랜덤-시크릿', 'ACTIVITY_ENGINE_CRON_SECRET');
```

## 2. NPC 16명 seed

```bash
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
npx --yes tsx scripts/seed_npc_personas.ts
```

검증 SQL:

```sql
SELECT COUNT(*) FROM public.npc_personas;
SELECT display_name, tier FROM public.npc_personas ORDER BY tier, display_name;
SELECT COUNT(*) FROM public.profiles WHERE is_npc = true AND npc_persona_id IS NOT NULL;
```

기대값: `npc_personas = 16`, 매핑된 NPC 프로필 `16`.

## 3. Edge Functions 배포

```bash
npx supabase functions deploy post-publisher
npx supabase functions deploy comment-bot
npx supabase functions deploy vote-bot
npx supabase functions deploy secret-lounge-bot
```

수동 dry-run:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/post-publisher?dryRun=1" \
  -H "x-cron-secret: $ACTIVITY_ENGINE_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual"}'
```

## 4. cron 등록

`supabase/migrations/013_activity_engine_cron.sql` 실행.

스케줄:

- `post-publisher`: `*/30 * * * *`
- `comment-bot`: `*/5 * * * *`
- `vote-bot`: `*/10 * * * *`
- `secret-lounge-bot`: `*/20 * * * *`

## 5. 24시간 관찰 SQL

```sql
SELECT n.display_name, COUNT(a.*) AS activities
FROM public.npc_personas n
LEFT JOIN public.npc_activity_log a
  ON a.persona_id = n.id
 AND a.created_at > now() - INTERVAL '24 hours'
GROUP BY n.display_name
ORDER BY activities DESC;
```

활동 편차가 대략 ±30% 안이면 로드밸런싱 정상 범위로 본다.
