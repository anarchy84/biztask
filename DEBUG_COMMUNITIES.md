# BizTask 커뮤니티 생성 디버깅 가이드

## 증상
- "새 커뮤니티 만들기" 모달에서 이름 입력 후 "만들기" 클릭 → 실패
- 에러 메시지: "커뮤니티 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
- 성공 시 토스트/사이드바 갱신이 안 됨

## 기술 스택
- Next.js 16 App Router + Supabase + Tailwind CSS
- 프론트: `app/page.tsx` → `handleCreateCommunity` 함수
- DB: Supabase `communities` 테이블 (RLS 활성화)

## 의심 원인 (우선순위)

### 1. RLS INSERT 정책 누락 (최유력)
communities 테이블에 여러 SQL 마이그레이션이 순서대로 적용되어야 함:
- `schema_vip_communities.sql`: 최초 테이블 생성 + `communities_insert_auth` 정책
- `schema_categories_2026-03-26.sql`: slug/icon_url 등 컬럼 추가
- `schema_rls_update.sql`: 기존 정책 DROP 후 `communities_insert_vip_only` 재생성

**`schema_rls_update.sql`이 미실행이거나 부분 실행되었을 가능성이 높음.**
- DROP은 됐는데 CREATE에서 에러 → INSERT 정책 0개 → 모든 INSERT 차단

### 2. `name` UNIQUE 제약조건
`communities` 테이블의 `name` 컬럼이 UNIQUE임.
코드에서는 slug 중복만 체크하고 name 중복은 처리 안 했음. (수정 완료)

### 3. Supabase RLS의 "조용한 차단"
Supabase는 RLS가 INSERT를 차단할 때:
- `error`가 null이고 `data`가 빈 배열 `[]`로 응답하는 경우가 있음
- `.insert({...})` 뒤에 `.select()`를 붙여야 이 케이스 감지 가능 (수정 완료)

## 디버깅 순서

### Step 1: Supabase SQL Editor에서 진단 쿼리 실행
```sql
-- 현재 RLS 정책 확인 (INSERT 정책이 있는지가 핵심!)
SELECT policyname, cmd, permissive, qual, with_check
FROM pg_policies
WHERE tablename = 'communities'
ORDER BY cmd, policyname;
```

**정상이면 4개 정책이 보여야 함:**
- `communities_select_all` (SELECT)
- `communities_insert_vip_only` (INSERT)
- `communities_update_vip_owner` (UPDATE)
- `communities_delete_vip_owner` (DELETE)

**INSERT 정책이 없으면** → `schema_debug_communities_2026-03-27.sql`의 STEP 2 실행

### Step 2: VIP 상태 확인
```sql
SELECT id, nickname, is_vip FROM profiles WHERE is_vip = true;
```
본인 계정의 `is_vip`가 `true`인지 확인.

### Step 3: 브라우저 콘솔 확인
F12 → Console 탭에서 `[커뮤니티 생성]`으로 시작하는 로그 확인:
- `[커뮤니티 생성] 요청:` → user.id가 정상인지
- `[커뮤니티 생성] 응답:` → data와 error 값이 뭔지

### Step 4: 직접 INSERT 테스트 (Supabase SQL Editor)
```sql
-- RLS를 우회하여 직접 INSERT (테이블 구조 자체가 문제인지 확인)
INSERT INTO communities (name, slug, description, created_by)
VALUES ('테스트커뮤', 'test-community', '테스트', '여기에_본인_user_id');
```

## 관련 파일
- `app/page.tsx` — handleCreateCommunity 함수 (프론트엔드)
- `schema_vip_communities.sql` — 최초 테이블 생성
- `schema_categories_2026-03-26.sql` — slug 등 컬럼 추가
- `schema_rls_update.sql` — VIP 전용 RLS 정책
- `schema_debug_communities_2026-03-27.sql` — 디버깅 + 정책 리셋 SQL

## Supabase 테이블 스키마 요약
```
communities:
  id          UUID (PK, auto)
  name        TEXT NOT NULL UNIQUE    ← 이름 중복 불가!
  slug        TEXT UNIQUE             ← URL 중복 불가!
  description TEXT
  created_by  UUID (FK → auth.users)
  created_at  TIMESTAMPTZ
  member_count INTEGER DEFAULT 0
  icon_url    TEXT
  banner_url  TEXT
  is_active   BOOLEAN DEFAULT true
```
