# Supabase Phase 7-A RLS Migration 실행 문서

작성일: 2026-04-29  
대상 프로젝트: GRIT V2  
Supabase project ref: `lqotquxmmrshikevqnsg`  
적용 대상 migration: `supabase/migrations/011_rls_write_cycle_policies.sql`

## 목적

Phase 7-A에서 작성한 글쓰기 사이클 서버 안전망을 Supabase 원격 DB에 적용한다.

적용 범위:

- `posts/comments/reactions/profiles/follows` RLS 정책 보강
- `storage.objects`의 `post-images`, `avatars` bucket 정책 보강
- `reactions` 중복 방지 unique index
- 좋아요/댓글 카운터 trigger 보강
- 익명 세션을 `guest`로 취급하는 `current_user_tier_rank()` helper 추가

## 실행 전 상태

Codex 세션에서는 Supabase MCP/CLI 인증이 없어 원격 적용을 완료하지 못했다.

확인 결과:

```json
{
  "applied": false,
  "code": "PGRST202",
  "message": "Could not find the function public.current_user_tier_rank without parameters in the schema cache"
}
```

즉, 이 문서를 실행하기 전 원격 DB에는 `011` migration이 아직 적용되지 않은 상태다.

## 파일 확인

로컬 repo에서 다음 파일이 존재해야 한다.

```bash
cd /Users/anarchy/Claud_Projects/biztask/Biztask/grit-app
git log --oneline -1
ls -la supabase/migrations/011_rls_write_cycle_policies.sql
```

기대 commit:

```text
56fea6a phase7: 글쓰기 audit 및 활어 엔진 설계
```

## 적용 방법 A: Supabase MCP 사용 권장

Claude 세션에 Supabase MCP가 연결되어 있으면 이 방법을 우선 사용한다.

1. Supabase project `lqotquxmmrshikevqnsg` 선택.
2. `supabase/migrations/011_rls_write_cycle_policies.sql` 전체 내용을 SQL 실행 도구로 실행.
3. 성공 후 아래 “적용 후 검증 SQL”을 순서대로 실행.

주의:

- SQL 일부만 잘라 실행하지 말고 전체 파일을 한 번에 실행한다.
- 에러가 발생하면 같은 파일을 반복 실행하기 전에 에러 메시지를 먼저 확인한다.
- `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE UNIQUE INDEX IF NOT EXISTS`를 사용해 대부분 재실행 가능하게 작성되어 있지만, 중간 실패 후 재실행 전 원인을 확인하는 편이 안전하다.

## 적용 방법 B: Supabase Dashboard SQL Editor

MCP가 없으면 Dashboard에서 직접 실행한다.

1. Supabase Dashboard 접속.
2. 프로젝트 `grit-app` / ref `lqotquxmmrshikevqnsg` 선택.
3. SQL Editor 열기.
4. `supabase/migrations/011_rls_write_cycle_policies.sql` 전체 붙여넣기.
5. Run.
6. 아래 검증 SQL 실행.

## 적용 방법 C: Supabase CLI

CLI 인증이 가능한 환경이면 아래 순서로 실행한다.

```bash
cd /Users/anarchy/Claud_Projects/biztask/Biztask/grit-app
export SUPABASE_ACCESS_TOKEN="대웅 Supabase access token"
npx supabase link --project-ref lqotquxmmrshikevqnsg --yes
npx supabase db push --yes
```

CLI가 DB password를 요구하면 Supabase Dashboard의 Database password를 입력한다.

## 적용 후 검증 SQL

### 1. helper function 존재 확인

```sql
select public.current_user_tier_rank() as tier_rank;
```

기대:

- SQL Editor/service context에서는 `0` 또는 정상 숫자 반환.
- `function does not exist`가 나오면 migration 미적용.

### 2. RLS 활성화 확인

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'posts', 'comments', 'reactions', 'follows')
order by tablename;
```

기대:

- 5개 테이블 모두 `rowsecurity = true`.

### 3. public/storage 정책 확인

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where (schemaname = 'public' and tablename in ('profiles', 'posts', 'comments', 'reactions', 'follows'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

기대 주요 정책:

- `profiles_select_all`
- `profiles_insert_own`
- `profiles_update_own`
- `posts_select_public`
- `posts_insert_general`
- `posts_update_own`
- `posts_delete_own`
- `comments_select_public`
- `comments_insert_general`
- `comments_update_own`
- `comments_delete_own`
- `reactions_select_own`
- `reactions_insert_own_general`
- `reactions_update_own`
- `reactions_delete_own`
- `follows_insert_own`
- `follows_delete_own`
- `storage_post_images_*`
- `storage_avatars_*`

### 4. trigger/function 확인

```sql
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in (
    'current_user_tier_rank',
    'prevent_profile_privilege_escalation',
    'bump_reaction_count',
    'bump_post_comment_count'
  )
order by proname;
```

```sql
select tgname, tgrelid::regclass::text as table_name
from pg_trigger
where not tgisinternal
  and tgname in (
    'profiles_prevent_privilege_escalation',
    'reactions_count_trigger',
    'comments_count_trigger'
  )
order by tgname;
```

기대:

- 함수 4개 반환.
- trigger 3개 반환.

### 5. reactions unique index 확인

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'reactions'
  and indexname = 'reactions_one_per_target_per_user';
```

기대:

- `(user_id, target_type, target_id)` unique index 존재.

### 6. storage bucket 확인

```sql
select id, name, public
from storage.buckets
where id in ('post-images', 'avatars')
order by id;
```

기대:

- `avatars`, `post-images` 둘 다 존재.
- `public = true`.

## 앱 레벨 smoke test

Migration 적용 후 앱에서 최소 아래 흐름을 확인한다.

### 익명/guest 세션

- 홈에서 글쓰기 버튼이 숨겨지는지 확인.
- 글 상세 댓글 입력 시 “소셜 로그인 후 댓글을 쓸 수 있어” 계열 메시지 확인.
- 좋아요/팔로우 시 권한 안내 또는 비활성 상태 확인.
- 네트워크 탭에서 우회 INSERT가 RLS로 막히는지 확인하면 가장 좋다.

### 로그인/general 세션

- 글쓰기 → 발행 → 상세 이동 성공.
- 홈 탭 복귀 시 새 글이 보임.
- 홈 피드 좋아요 누른 뒤 새로고침/재진입해도 유지.
- 글 상세 상단 좋아요도 유지.
- 댓글 작성 후 즉시 리스트 반영.
- 답글 작성 후 parent 아래 렌더링.
- 탐색 추천 사장님 팔로우/언팔로우가 즉시 바뀌고 재진입 후 유지.

## 실패 시 중단 기준

아래 에러가 나오면 즉시 중단하고 SQL을 추가 실행하지 않는다.

- `type "public.user_tier" does not exist`
  - `007_profiles_v2_extension.sql`이 원격에 적용되지 않은 상태일 수 있음.
- `relation "public.posts" does not exist`
  - 대상 프로젝트가 잘못됐거나 기본 schema가 다름.
- `cannot create unique index ... duplicated key`
  - migration 안의 중복 제거 CTE가 실패했거나 transaction 상태 확인 필요.
- `permission denied for schema storage`
  - SQL 실행 권한이 부족함. Dashboard SQL Editor 또는 owner/service 권한 필요.

## 성공 보고 템플릿

실행 완료 후 대웅에게 아래처럼 보고한다.

```text
Supabase Phase 7-A migration 적용 완료.

- 적용 파일: supabase/migrations/011_rls_write_cycle_policies.sql
- project ref: lqotquxmmrshikevqnsg
- RLS 확인: profiles/posts/comments/reactions/follows enabled
- storage 정책 확인: post-images/avatars select/insert/update/delete 정책 존재
- trigger 확인: profiles/reactions/comments trigger 존재
- 앱 smoke test: [완료/대기]
```
