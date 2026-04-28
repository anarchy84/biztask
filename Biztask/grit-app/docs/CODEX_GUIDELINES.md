# 🤝 코덱스 협업 지침 (GRIT V2)

> 이 문서는 클로드(Cowork)와 코덱스(Cursor)가 같은 GRIT 앱 폴더에서 동시에 작업할 때
> 충돌 안 나고 일관성 유지하기 위한 작업 규약이야.
> 작성일: 2026-04-28 / 작성자: 클로드 / 대상: 코덱스

---

## 1. 가장 먼저 알아야 할 것

이 프로젝트는 **GRIT V2**로 큰 피봇을 했어. 기획서 전문은 `docs/grit_master_plan_v2.md` 에 있고, 핵심 변경점은:

### V1 → V2 변화 요약

| 항목 | V1 (이전) | V2 (현재) |
|---|---|---|
| **컨셉** | 사장님 익명 커뮤니티 (블라인드식) | 사업자 전용 SNS (인스타+스레드+X) |
| **회원 등급** | 익명/소셜 단일 | 게스트 / 일반 / 인증사장님 (파란딱지) 3계층 |
| **피드 정렬** | 시간순 | 추천 알고리즘 (X 알고리즘 휴리스틱 차용) |
| **수익 모델** | 미정 | 구독(파란딱지) + 광고 + 수수료 |
| **시크릿 기능** | 없음 | 비공개 게시판 + 매칭/협업 + 구인구직(유료) |
| **팔로우** | 없음 | 팔로우/팔로잉 + 30~40% 믹스 알고리즘 |
| **사업자 인증** | 없음 | 국세청 API + 어드민 수기 검수 |

### 그대로 유지되는 것

- **활어 엔진 + NPC 10명**: V2에서도 유지하되 **더 고도화**
- **익명성**: 인증은 받되 활동 닉네임은 익명 (블라인드 방식)
- **Supabase + Expo + RN**: 기술 스택 동일
- **OAuth 흐름**: 카카오(비즈앱 보류) + 구글
- **이미지 업로드 + 프로필 편집**: 그대로

### 폐기된 것

- ❌ Flutter 옵션 (RN으로 픽스)
- ❌ 시간순만 정렬되는 단순 피드 (알고리즘 추천 필수)

---

## 2. 작업 영역 분리 (가장 중요)

같은 파일을 두 AI가 동시에 수정하면 git 충돌 100%. 사전 공유로 영역 분리해야 해.

### 클로드 담당 (구조/컨텍스트 의존)

- 메모리 박힌 컨텍스트 필요한 작업 (V2 마스터 컨셉, 회원 등급 정책 등)
- DB 스키마 마이그레이션 설계
- AuthContext, RLS 정책 같은 앱 전역 관통하는 작업
- 활어 엔진 고도화 (NPC 페르소나, 댓글 봇 로직)

### 코덱스 담당 (격리된 단일 기능)

- 한 화면 단위 UI 작업 (예: 글쓰기 화면, 프로필 화면)
- 한 훅 단위 작업 (예: useFollow, useReportPost)
- 단순 SQL 쿼리/마이그레이션 (스키마 합의 후)
- OAuth 콜백 같은 격리된 버그 수정 (현재 `app/auth/callback.tsx` 작업 중)

### 동시 작업 시 룰

1. **시작 전 `git pull`** 필수
2. **수정 중인 파일은 commit으로 명시** (다른 AI가 git log로 인지)
3. **클로드는 작업 시작 전 대웅이한테 영역 보고** → 대웅이 코덱스에 전달
4. **충돌 시 우선순위**: 클로드의 구조적 결정 > 코덱스의 격리된 fix

---

## 3. 공통 코드 규칙 (대웅 원칙)

### 필수

- ✅ **한글 주석**: Python·TypeScript 모두 한글로 상세하게 (초보도 이해할 수 있게)
- ✅ **파일명**: snake_case + 필요 시 YYYY-MM-DD
- ✅ **완성 코드 위치**:
  - 앱 코드: `grit-app/` 하위 (Expo Router 구조)
  - DB: `supabase/migrations/`
  - 산출물: `outputs/`
- ✅ **에러 메시지**: 한글로 친근한 반말 ("로그인 세션이 없어. 앱 재실행해줘")
- ✅ **TypeScript strict**: `npx tsc --noEmit` 통과 후에만 commit

### 금지

- ❌ **파일 삭제 금지**: 어떤 파일도 임의 삭제 금지. 안 쓰는 파일은 `archive/` 이동
- ❌ **자동 발행/배포/삭제 금지**: cron이나 Edge Function이 자동으로 글 발행하면 안 됨. 항상 대웅 검수 단계 필수
- ❌ **--no-verify 사용 금지**: pre-commit hook 우회 금지
- ❌ **`git add .` 대신 `git add -A`도 OK** (대웅 선호: 개별 파일 나열 X, 전체 add)
- ❌ **commit 메시지 한글**: 영어 X. 한글로 변경 의도 적어줘

### 커밋 메시지 형식

```
<영역>: <변경 요약 한 줄>

<상세 변경 내역 - 필요 시>
```

예시:
```
auth/callback: OAuth 콜백 라우트 신규 추가

WebBrowser가 못 받은 딥링크를 백업으로 처리하기 위해
app/auth/callback.tsx 추가. URL fragment 토큰 파싱 후 
setSession + 홈으로 redirect.
```

---

## 4. 기술 환경 특이사항

### Expo / RN

- **Expo SDK 52 + Router v4 + newArchEnabled: true**
- **Node 20 LTS 필수** (Node 22+은 type stripping 에러)
- **OAuth는 dev build 필수**: Expo Go에서는 안 됨 (`npx expo run:ios`)
- **app.json scheme**: `grit` (딥링크는 `grit://...`)

### Next.js (있을 경우)

- 이 프로젝트(grit-app)는 RN이지만, 만약 PC 웹 작업 들어가면 Next.js 신버전임
- `node_modules/next/dist/docs/` 참조 후 작업 (deprecation 주의)

### Supabase

- 프로젝트 ID: `lqotquxmmrshikevqnsg` (grit-app)
- **다른 Supabase 프로젝트 건드리지 말 것**: wooripen, wrpmkt, woori-nconnect는 별개 프로젝트
- RLS 변경은 마이그레이션 파일로 (직접 SQL 실행 X)
- Edge Function 신규 추가는 클로드와 사전 합의

### 디렉토리 룰

- **클로드 임시 작업 폴더**: `/sessions/gifted-hopeful-carson/mnt/Biztask/grit-app/`  (코덱스도 이 경로에서 작업)
- 메모리 폴더 (`.auto-memory/`)는 **클로드만 관리**. 코덱스는 읽기만 가능
- 메모리 핵심 내용은 이 docs 폴더에 미러링됨

---

## 5. 활어 엔진 V2 작업 시 주의

활어 엔진은 V1에서 다음 자산이 있어:
- 10명 NPC 페르소나
- 4-Layer 댓글 픽 로직 (시간/관심/감정/희소성)
- 글밥 창고 (RAG 댓글 엔진)
- 3개 독립 cron (스크래퍼 / 댓글봇 / 보팅봇)

**V2 고도화 방향** (대웅이 강조):
- "훨씬 정교해야 함"
- 인증사장님 콘텐츠 vs 일반 회원 콘텐츠 구분 학습
- 추천 알고리즘과 NPC가 시너지 (NPC가 알고리즘 점수 높이는 마중물)
- 카테고리/업종별 NPC 라우팅
- 사용자 신호(좋아요/체류) 기반 NPC 톤 조절

**작업 순서는 클로드가 메모리에서 끌고 와서 큰 그림 잡고, 코덱스가 격리된 함수 단위로 구현**.

V1 코드 위치:
- GitHub: 옛 `biztask` repo (Vercel 프로젝트 삭제했지만 코드 살아있음)
- 폐기 안 된 폴더: `~/Claud_Projects/biztask/Biztask/` (참고용)

---

## 6. 메모리 동기화

클로드는 `/sessions/gifted-hopeful-carson/mnt/.auto-memory/`에 컨텍스트 메모리를 박아두는데,
코덱스는 직접 읽을 수 없어. 그래서 **핵심 메모리는 이 docs 폴더에 미러링**:

- `docs/grit_master_plan_v2.md` ← 기획서 (V2 단일 소스)
- `docs/CODEX_GUIDELINES.md` ← 이 문서
- `docs/dual_ai_workflow.md` ← 작업 분담 룰 (이 문서랑 일부 중복, 더 상세함)

코덱스는 작업 시작 전 위 3개 문서 먼저 읽기.

---

## 7. 검수 체크리스트 (코덱스가 작업 끝낼 때)

- [ ] `npx tsc --noEmit` 통과
- [ ] 한글 주석 작성됨
- [ ] 파일 임의 삭제/이동 없음
- [ ] commit 메시지 한글로 명확히
- [ ] 자동 푸시 X (대웅이 검수 후 푸시)
- [ ] 대웅이한테 "이렇게 실행하세요" 한국어 가이드 작성

---

## 8. 첫 작업 (대웅 → 코덱스 위임 예정)

1. **OAuth 콜백 라우트 신규 추가**
   - `app/auth/callback.tsx` 신설
   - URL fragment 토큰 파싱 → `supabase.auth.setSession`
   - 온보딩 필요하면 `/onboarding/nickname`, 아니면 `/(tabs)`로 redirect
   - `app/_layout.tsx`에 라우트 등록

작업 끝나면 대웅이 검수 후 클로드한테 통보. 클로드는 그 다음 V2 디자인 시스템 정의 들어감.

---

문서 끝. 질문 있으면 대웅이한테.
