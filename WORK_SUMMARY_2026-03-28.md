# BizTask 작업 내역 총 정리 (2026-03-28)

## 📋 작업 개요
**제미나이 PM 작업지시서: NPC 군단 대규모 총연습 (Mass Interaction Test)**
- 스텝1: `/api/admin/test-interaction/route.ts` API 생성
- 스텝2: 어드민 personas 페이지에 "군단 활동 시뮬레이션" 버튼 추가
- 스텝3: 투표/댓글 카운트 로직 검증

---

## ✅ 완료된 작업

### 1. 신규 파일 생성
| 파일 | 용도 |
|------|------|
| `utils/supabase/admin.ts` | Service Role Key로 RLS 우회하는 어드민 전용 Supabase 클라이언트 |
| `app/api/admin/test-interaction/route.ts` | NPC 군단 활동 시뮬레이션 API (핵심 파일) |

### 2. 수정된 파일
| 파일 | 변경 내용 |
|------|-----------|
| `app/admin/personas/page.tsx` | 시뮬레이션 UI 패널 추가 (API키 입력, 저장, 실행 버튼, 결과 표시) |
| `.env.local` | `SUPABASE_SERVICE_ROLE_KEY` 추가 |
| `package.json` | `@anthropic-ai/sdk` 의존성 추가 |

### 3. DB 정리 완료
- NPC 테스트로 생성된 아나키 명의 글 6개 삭제
- NPC 테스트 댓글 2개 삭제
- comment_count 동기화 완료

---

## 🐛 발견된 버그 3개 + 수정 코드 (아직 미배포)

### 버그1: 모든 NPC 글이 아나키 계정으로 작성됨
- **원인**: 21개 NPC 페르소나가 모두 동일한 `user_id = faa5e02e-...` (아나키 ID) 공유
- **수정**: `ensureNpcUsers()` 함수 추가 — 첫 실행 시 각 NPC에게 `supabase.auth.admin.createUser()`로 개별 auth 계정 생성 + profiles 테이블에 프로필 생성 + personas.user_id 업데이트

### 버그2: 모든 액션이 순식간에 실행됨 (부자연스러움)
- **원인**: 딜레이 없이 모든 작업을 동기적으로 순차 실행
- **수정**: `randomDelay()` 함수 (2~5초 랜덤) + Fisher-Yates 셔플로 글쓰기/댓글/추천을 섞어서 실행

### 버그3: 댓글·추천 활동이 작동 안 함
- **원인**: 동일 user_id 문제 + 댓글 작성 후 `increment_upvotes` RPC를 잘못 호출 (댓글인데 upvotes를 올림)
- **수정**: 개별 user_id 사용 + comment_count 직접 +1 업데이트로 변경

---

## ⚠️ 현재 상태: Git 푸시 막힘

### 문제 상황
로컬 맥에서 git이 꼬인 상태:
```
error: Unable to create '.git/index.lock': File exists
fatal: previous rebase directory .git/rebase-apply still exists
fatal: Dirty index: cannot apply patches
You are in the middle of an am session.
```

### 해결 필요 사항
맥 터미널에서 다음 순서로 실행 필요:
```bash
# 1. 꼬인 git 상태 정리
rm -f ~/Claud_Projects/biztask/.git/index.lock
rm -rf ~/Claud_Projects/biztask/.git/rebase-apply

# 2. 변경된 파일 확인
git status

# 3. 변경된 2개 파일 커밋 + 푸시
git add app/api/admin/test-interaction/route.ts app/admin/personas/page.tsx
git commit -m "fix: NPC 군단 시뮬레이션 3대 버그 수정"
git push origin main
```

### 커밋해야 할 변경 파일 2개
1. **`app/api/admin/test-interaction/route.ts`** — 전면 리라이트 (470줄)
2. **`app/admin/personas/page.tsx`** — API키 저장 기능 추가

---

## 🔧 기술 스택 및 구조

### route.ts 핵심 구조 (470줄)
```
[타입 정의] Persona, ActionResult
[상수] CATEGORIES, TEMPLATE_TITLES, TEMPLATE_CONTENTS, TEMPLATE_COMMENTS
[유틸] pickRandom(), fillTemplate(), randomDelay()
[AI] generateWithAI() — Anthropic Claude API 호출
[셋업] ensureNpcUsers() — NPC 개별 계정 자동 생성
[메인] POST handler
  └→ 0) NPC 계정 셋업 (첫 실행)
  └→ 1) 액션 분배: 글 20% / 댓글 40% / 추천 40%
  └→ 2) Fisher-Yates 셔플
  └→ 3) 메인 루프 (딜레이 포함)
       ├→ post: AI 또는 템플릿 기반 글 작성
       ├→ comment: AI 또는 템플릿 기반 댓글 (아나키 글 50% 우선)
       └→ upvote: 중복 방지 + RPC/직접 업데이트 (아나키 글 60% 우선)
  └→ 4) 결과 요약 JSON 반환
```

### 어드민 UI (personas/page.tsx) 추가사항
- 접이식 오렌지 그라데이션 시뮬레이션 패널
- Anthropic API 키 입력 필드 + localStorage 저장/불러오기
- 액션 수 설정 (1~20)
- 실행 버튼 → `/api/admin/test-interaction` POST 호출
- 결과 요약(성공/실패 카운트) + 상세 액션 로그 스크롤 표시

### 환경변수 (Vercel에 설정 필요)
```
NEXT_PUBLIC_SUPABASE_URL=https://dqyfrzrqfhdxwgokrwii.supabase.co
SUPABASE_SERVICE_ROLE_KEY=(설정 완료)
ANTHROPIC_API_KEY=(선택 — 어드민 UI에서도 입력 가능)
```

---

## 📝 남은 작업 (배포 후)
1. ✅ git 정리 + 커밋 + 푸시 (위 명령어 참고)
2. Vercel 배포 확인
3. NPC 시뮬레이션 재테스트 (개별 계정 + 딜레이 + 댓글/추천)
4. NPC 테스트 글 정리 (이전 테스트로 생성된 "식당왕김국자" 글 등)
