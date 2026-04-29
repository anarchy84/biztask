# Phase 7-A 글쓰기 사이클 Audit 결과

작성일: 2026-04-29  
대상 브랜치: `v2-redesign`  
기준 HEAD: `91c2ea4 v2: 이메일 가입(trim) + 이미지 다중 선택 + posts self-relation cache 회피`

## 발견 사항 (심각도별)

### 🔴 Critical (대웅 검증 전 반드시 수정)

- **RLS 정책 누락**
  - `follows` 외 `posts/comments/reactions/profiles/storage.objects` 정책이 마이그레이션에 없었다.
  - 조치: `supabase/migrations/011_rls_write_cycle_policies.sql` 추가.
  - 포함 내용: 익명 세션 guest 처리, general+ 쓰기 허용, 본인 UPDATE/DELETE, storage owner path 검사, reactions 중복 방지, 댓글/반응 카운터 트리거.
  - 남은 검증: Supabase 원격 DB에 migration 적용 후 익명 세션에서 INSERT가 막히는지 확인 필요.

- **피드/상세 게시글 좋아요가 DB에 저장되지 않음**
  - `PostCard` 내부 state만 바뀌고 `useReaction`을 호출하지 않아 새로고침하면 좋아요가 사라질 수 있었다.
  - 조치: `PostCard`에 `onLikePress`를 추가하고 홈 피드/글 상세에서 `useReaction` + 낙관적 업데이트로 연결.

- **탐색 추천 사장님 팔로우 버튼 미동작**
  - 기존 `explore.tsx`는 정적 mock 배열과 `Button label="팔로우"`만 있었다.
  - 조치: `lib/hooks/useFollow.ts` 신규 작성, 탐색 화면을 실제 `profiles` 조회 기반으로 전환, follows INSERT/DELETE와 팔로워 카운트 낙관적 갱신 연결.

### 🟡 Major (1주 내 수정 권장)

- **원격 DB migration 적용 전에는 클라이언트 보강만으로 안전하지 않음**
  - `useTier`로 guest 쓰기를 막아도 우회 클라이언트는 RLS 없이는 쓰기 가능하다.
  - 조치 파일은 작성 완료. 대웅이 Supabase migration 적용 여부를 확인해야 한다.

- **프로필 권한 상승 방어가 서버 trigger에 의존**
  - `profiles_update_own`만 있으면 악성 클라이언트가 `tier/grit_score/follower_count`를 직접 바꿀 수 있다.
  - 조치: `profiles_prevent_privilege_escalation` trigger 추가.
  - 남은 검증: 사업자 인증/관리자 승급은 service role 또는 별도 서버 함수로 수행해야 한다.

- **글 발행 후 홈 피드 갱신 경로가 약했음**
  - 발행 성공 후 상세로 이동하지만 홈 탭 복귀 시 피드가 낡을 수 있었다.
  - 조치: 홈 피드에 focus refresh를 추가해 탭 복귀 시 최신 피드를 다시 불러오게 했다.

- **Supabase 원문 에러가 사용자에게 그대로 노출됨**
  - `row-level security`, FK, UUID, 네트워크 에러가 영어/기술 문장으로 보일 수 있었다.
  - 조치: `lib/errors.ts` 추가, 글/댓글/반응/이미지/팔로우 흐름에 한글 메시지 변환 적용.

### 🟢 Minor (Polish)

- 인용글 ID는 현재 직접 UUID 입력 UX라 사용자가 실수하기 쉽다. 카드의 “인용” 버튼에서 자동으로 `quotedPostId`를 넘기는 플로우가 필요하다.
- 동영상은 `video_url/video_thumbnail_url` 수동 URL 입력만 지원한다. 실제 앱 검증 전 `post-videos` bucket, 업로드, 썸네일 생성 정책이 필요하다.
- 본인 글 좋아요는 선택사항으로 남겨두었다. 현재는 허용 상태이며 커뮤니티 정책에 따라 나중에 막을 수 있다.
- `reactions_select_own` 정책은 내 반응 조회에는 충분하지만, 타인의 reaction 목록을 클라이언트에서 직접 보여줄 기능이 생기면 별도 공개 정책 또는 RPC가 필요하다.

## 수정한 파일

- `app/(tabs)/index.tsx`: 홈 피드 좋아요 DB 연결, focus refresh, guest 글쓰기 CTA 숨김 유지.
- `app/(tabs)/explore.tsx`: 추천 사장님 실제 `profiles` 조회, 팔로우 버튼 동작 연결.
- `app/post/[id].tsx`: 상세 상단 게시글 좋아요 DB 연결.
- `components/feed/PostCard.tsx`: `onLikePress` 제어형 좋아요 props 추가.
- `lib/hooks/useFeed.ts`: 피드 게시글 reaction 낙관적 업데이트 setter 추가.
- `lib/hooks/usePostSubmit.ts`: `canWritePost` 서버 흐름 전 UX 가드, 인용 UUID 검증, 한글 에러 적용.
- `lib/hooks/useCommentSubmit.ts`: guest 댓글 가드, 한글 에러 적용.
- `lib/hooks/useReaction.ts`: guest reaction 가드, 한글 에러 적용.
- `lib/hooks/useImageUpload.ts`: storage/RLS 실패 한글 메시지 적용.
- `lib/hooks/useSocialLogin.ts`: UI `meta` provider를 Supabase `facebook` provider로 매핑해 TypeScript 오류 수정.

## 신규 작성한 파일

- `lib/errors.ts`: Supabase/네트워크 에러 메시지 변환 helper.
- `lib/hooks/useFollow.ts`: follows INSERT/DELETE + 낙관적 팔로워 카운트 hook.
- `supabase/migrations/011_rls_write_cycle_policies.sql`: RLS, storage 정책, reaction unique index, 카운터 트리거.
- `docs/audit_phase7a_findings.md`: 본 문서.

## 확인한 동작

- `npx tsc --noEmit` 통과.
- `usePostSubmit`: 이미지 업로드 중 발행 버튼 disabled, 동영상 빈 string은 `new.tsx`에서 `null`로 정리 후 전달.
- `useCommentSubmit`: 댓글 작성 성공 시 `appendComment`로 즉시 리스트 반영.
- `useReaction`: 실패 시 `onOptimistic(current, -delta)`로 롤백.
- 댓글 트리: `parent_id` 기반 재귀 렌더링이며 데이터 깊이 제한은 없음. UI indentation만 5단 이후 고정.

## 대웅에게 검증 요청 사항

1. Supabase에 `011_rls_write_cycle_policies.sql` 적용 후 익명 세션에서 글/댓글/좋아요/팔로우가 거부되는지 확인.
2. 이메일/소셜 로그인 유저로 글쓰기 → 발행 → 상세 이동 → 홈 탭 복귀 시 새 글이 보이는지 확인.
3. 홈 피드와 글 상세에서 좋아요를 누른 뒤 새로고침/재진입해도 상태와 카운트가 유지되는지 확인.
4. 탐색 화면 추천 사장님 팔로우/언팔로우가 즉시 바뀌고, 재진입 후에도 유지되는지 확인.
5. 이미지 업로드 실패/RLS 실패 시 영어 원문 대신 한글 안내가 나오는지 확인.
