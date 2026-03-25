# BizTask 프로젝트 백업 및 인수인계 문서

**백업일:** 2026-03-25
**프로젝트명:** BizTask 커뮤니티
**기술 스택:** Next.js 16.2.1 (App Router) + React 19 + Supabase + Tailwind CSS 4 + TypeScript

---

## 1. 프로젝트 개요

BizTask는 레딧 스타일의 다크 테마 커뮤니티 웹앱입니다. Supabase를 백엔드(Auth + DB + Storage)로 사용하며, 형광 그린(#73e346)을 브랜드 컬러로 사용합니다.

---

## 2. Git 커밋 이력 (시간순)

| # | 커밋 해시 | 날짜 | 내용 |
|---|----------|------|------|
| 1 | ea6fc50 | 2026-03-23 | Initial commit from Create Next App |
| 2 | 7f6fb33 | 2026-03-24 | 첫 번째 런칭 준비 |
| 3 | 34f5335 | 2026-03-24 | 추가 기능 업데이트v1 |
| 4 | 78913b1 | 2026-03-24 | M8: 비밀번호 재설정 플로우 추가 |
| 5 | 5c7f2b5 | 2026-03-25 | 레딧 다크 테마 전면 적용 + 하단 보팅 바 구현 |
| 6 | 0690022 | 2026-03-25 | fix: useSearchParams Suspense 바운더리 추가 |
| 7 | bd3b0dc | 2026-03-25 | fix: useSearchParams Suspense UI/UX보강 |
| 8 | 9986311 | 2026-03-25 | 레이아웃 복원 + 형광 그린 브랜드 컬러 적용 |
| 9 | 477c5c8 | 2026-03-25 | SEO 최적화: Open Graph + 동적 메타데이터 추가 |
| 10 | 07b0575 | 2026-03-25 | M11: 프로필 이미지 업로드 + 아바타 표시 |
| 11 | c340cd1 | 2026-03-25 | 실시간 인기글 랭킹보드 사이드바 추가 |
| 12 | 875aa27 | 2026-03-25 | 실시간 검색 엔진 구현 |
| 13 | 62c7284 | 2026-03-25 | 게시글 수정/삭제 기능 구현 |

---

## 3. 구현 완료된 기능 목록

### 인증 (Auth)
- Supabase Auth 기반 회원가입/로그인/로그아웃
- 비밀번호 재설정 플로우 (이메일 → 리셋 → 업데이트)
- 프로필 이미지 업로드 + 아바타 표시 (Supabase Storage)

### 게시글 (Posts)
- 게시글 작성 (카테고리, 제목, 본문)
- 게시글 상세 보기
- 게시글 수정/삭제 (작성자 본인만, 권한 체크)
- 좋아요(Upvote/Downvote) 보팅 바
- SEO 최적화: Open Graph + 동적 메타데이터

### 검색 & 탐색
- 실시간 검색 엔진 (제목+본문 ilike 쿼리)
- 카테고리별 필터링
- 실시간 인기글 랭킹보드 사이드바 (TrendingSidebar)
- Featured 슬라이더

### UI/UX
- 레딧 스타일 다크 테마 전면 적용
- 형광 그린(#73e346) 브랜드 컬러
- 반응형 레이아웃 (max-w-3xl 중심)
- Suspense 바운더리 적용

### 마이페이지
- 내가 쓴 글 / 내가 단 댓글 조회

---

## 4. 미완성 / 다음에 해야 할 작업

아래 3가지 UX 작업이 요청되었으나 API 연결 에러(ECONNRESET)로 구현되지 못했습니다:

1. **댓글 인라인 수정 기능** — 댓글 [수정] 버튼 → 인라인 textarea 전환 → Supabase update
2. **마이페이지 아이템 라우팅** — 내가 쓴 글/댓글 클릭 시 해당 게시글로 이동 (Link/router.push)
3. **공유/저장(북마크) 기능** — 클립보드 복사 + saved_posts 테이블 insert/delete 토글

---

## 5. 프로젝트 구조

```
biztask/
├── app/
│   ├── page.tsx              # 메인 피드 페이지
│   ├── layout.tsx            # 루트 레이아웃 (다크 테마)
│   ├── globals.css           # 전역 스타일
│   ├── login/page.tsx        # 로그인/회원가입
│   ├── submit/page.tsx       # 게시글 작성
│   ├── search/page.tsx       # 검색 결과
│   ├── mypage/page.tsx       # 마이페이지
│   ├── edit/[id]/page.tsx    # 게시글 수정
│   ├── post/[id]/
│   │   ├── page.tsx          # 게시글 상세 (서버)
│   │   └── PostDetailClient.tsx  # 게시글 상세 (클라이언트)
│   ├── reset-password/page.tsx   # 비밀번호 리셋 요청
│   ├── update-password/page.tsx  # 비밀번호 변경
│   └── components/
│       ├── Header.tsx        # 상단 네비게이션 + 검색
│       ├── PostCard.tsx      # 게시글 카드 컴포넌트
│       ├── TrendingSidebar.tsx   # 인기글 랭킹 사이드바
│       └── FeaturedSlider.tsx    # 추천 슬라이더
├── utils/supabase/
│   ├── client.ts             # 클라이언트 Supabase 인스턴스
│   └── server.ts             # 서버 Supabase 인스턴스
├── schema.sql                # 메인 DB 스키마 (posts, comments, votes 등)
├── schema_category.sql       # 카테고리 테이블
├── schema_interaction.sql    # 상호작용 테이블
├── schema_storage.sql        # Storage 버킷 설정
├── schema_update.sql         # 스키마 업데이트
├── .env.local                # Supabase URL + anon key
├── package.json              # 의존성 (next, react, supabase, lucide-react)
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
└── postcss.config.mjs
```

---

## 6. 환경 설정 (새 계정에서 복원하기)

### 필수 환경변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://dqyfrzrqfhdxwgokrwii.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeWZyenJxZmhkeHdnb2tyd2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNDc2MzIsImV4cCI6MjA4OTgyMzYzMn0.XNvXJG2Tp8MB67kcG5h-OBcY5uIAbXRrCZP9eM3_O6o
```

### 복원 절차
1. 이 백업 폴더 전체를 새 작업 환경에 복사
2. `npm install` 실행 (node_modules 재설치)
3. `.env.local` 파일 확인
4. `npm run dev`로 개발 서버 실행
5. 위 "미완성 작업" 섹션부터 이어서 개발

### 주요 의존성
- next: 16.2.1
- react: 19.2.4
- @supabase/supabase-js: ^2.99.3
- lucide-react: ^0.577.0
- tailwindcss: ^4

---

## 7. Supabase DB 스키마

DB 스키마는 다음 SQL 파일들에 정의되어 있습니다:
- `schema.sql` — 메인 테이블 (posts, comments, votes, profiles 등)
- `schema_category.sql` — 카테고리 관련
- `schema_interaction.sql` — 상호작용 (좋아요, 댓글 등)
- `schema_storage.sql` — 프로필 이미지 Storage 버킷
- `schema_update.sql` — 스키마 변경 마이그레이션

새 Supabase 프로젝트에 적용하려면 위 SQL 파일들을 순서대로 실행하세요.

---

## 8. 디자인 규칙

- 다크 테마: 배경 `#1a1a1b`, 카드 `#272729`, 테두리 `#343536`
- 브랜드 컬러: 형광 그린 `#73e346`
- 폰트: Geist (next/font)
- 레이아웃: max-w-3xl 중심, 반응형
- 아이콘: lucide-react 사용

---

*이 문서는 2026-03-25에 자동 생성되었습니다.*
