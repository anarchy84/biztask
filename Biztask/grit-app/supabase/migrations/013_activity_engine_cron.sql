-- ─────────────────────────────────────────────────────────────
-- 한글 주석: M013 - 활어 엔진 V2 Supabase cron 스케줄
--
-- ▣ 전제:
--   - Edge Functions 4종 배포 완료
--   - Functions env: SUPABASE_SERVICE_ROLE_KEY, ACTIVITY_ENGINE_CRON_SECRET
--   - Vault secret: ACTIVITY_ENGINE_CRON_SECRET
--
-- ▣ Vault secret 생성 예시(실제 값으로 1회 실행):
--   SELECT vault.create_secret('replace-with-long-random-secret', 'ACTIVITY_ENGINE_CRON_SECRET');
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('activity-engine-post-publisher');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('activity-engine-comment-bot');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('activity-engine-vote-bot');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('activity-engine-secret-lounge-bot');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'activity-engine-post-publisher',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lqotquxmmrshikevqnsg.supabase.co/functions/v1/post-publisher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'ACTIVITY_ENGINE_CRON_SECRET'
          LIMIT 1
        ), '')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'job', 'post-publisher',
        'surface', 'feed'
      )
    );
  $$
);

SELECT cron.schedule(
  'activity-engine-comment-bot',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lqotquxmmrshikevqnsg.supabase.co/functions/v1/comment-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'ACTIVITY_ENGINE_CRON_SECRET'
          LIMIT 1
        ), '')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'job', 'comment-bot',
        'surface', 'feed'
      )
    );
  $$
);

SELECT cron.schedule(
  'activity-engine-vote-bot',
  '*/10 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lqotquxmmrshikevqnsg.supabase.co/functions/v1/vote-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'ACTIVITY_ENGINE_CRON_SECRET'
          LIMIT 1
        ), '')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'job', 'vote-bot',
        'surface', 'feed'
      )
    );
  $$
);

SELECT cron.schedule(
  'activity-engine-secret-lounge-bot',
  '*/20 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://lqotquxmmrshikevqnsg.supabase.co/functions/v1/secret-lounge-bot',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', COALESCE((
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'ACTIVITY_ENGINE_CRON_SECRET'
          LIMIT 1
        ), '')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'job', 'secret-lounge-bot',
        'surface', 'secret_lounge'
      )
    );
  $$
);
