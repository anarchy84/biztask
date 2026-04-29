# BizTask 프로젝트 히스토리 정리

작성일: 2026-04-23  
작업 폴더: `/Users/anarchy/Claud_Projects/biztask`

## 1. 한 줄 요약

이 저장소는 처음에는 Next.js 기반 BizTask 커뮤니티 MVP로 시작했고, 이후 소상공인 커뮤니티를 "살아 움직이는 서비스"처럼 보이게 만들기 위해 커뮤니티/게시글/댓글/추천/NPC/스크래퍼/뉴스클리핑/운영 어드민을 빠르게 확장해 온 작업물이다.

## 2. 현재 저장소 구성

### 루트 BizTask 앱

- 프레임워크: Next.js 16.2.1 App Router, React 19, Tailwind CSS 4, Supabase
- 주요 목적: 커뮤니티 피드, 글쓰기, 상세/댓글, 좋아요/싫어요, 커뮤니티/카테고리, VIP 어드민, NPC 자동 활동, 콘텐츠 수집/발행
- 핵심 경로:
  - `app/page.tsx`: 홈 피드, 카테고리/커뮤니티 UI, VIP 생성/관리, 피드 로딩
  - `app/post/[id]/PostDetailClient.tsx`: 상세 페이지, 댓글, 대댓글, 댓글 투표, 저장, VIP 삭제/추천/칼럼 승격
  - `app/submit/page.tsx`: 글쓰기, 커뮤니티 선택/생성, 이미지 압축/업로드
  - `app/admin/*`: VIP 어드민, NPC/personas, 크론 제어, 스크래퍼, featured, 정렬 관리
  - `app/api/admin/*`: 자동화 크론과 봇 엔진
  - `lib/scrapers/*`: RSS/HTML/뉴스/이미지 업로드/AI 리라이터/요약 엔진
  - `schema*.sql`, `sql/*.sql`: Supabase 테이블, RLS, NPC, 뉴스, 댓글 투표, 스크래퍼 백로그 관련 마이그레이션

## 3. 작업 히스토리 타임라인

### 2026-03-23: 초기 Next.js 프로젝트

- `create-next-app` 기반 초기 커밋.
- 기본 라우팅, 레이아웃, Supabase 연동 준비가 시작된 단계.

### 2026-03-24: 런칭 준비와 인증 기반

- 첫 런칭 준비, 기본 기능 업데이트.
- 비밀번호 재설정 플로우 추가.
- 이후 커뮤니티 서비스로 커질 수 있는 계정/인증 기초가 마련됨.

### 2026-03-25: 커뮤니티 MVP 고도화

- 레딧 스타일 다크 테마와 하단 보팅 바 적용.
- SEO 최적화, Open Graph, 동적 메타데이터 추가.
- 프로필 이미지 업로드, 아바타 표시, 실시간 인기글 사이드바, 검색 엔진 구현.
- 게시글 수정/삭제, 소셜 로그인, 댓글 수정, 북마크, 이미지 압축 등 핵심 사용자 기능이 들어감.
- 백업 파일 `biztask-backup-20260325.tar.gz`, `biztask-source-20260325.tar.gz`가 이 시점 산출물로 보관됨.

### 2026-03-26: 카테고리/커뮤니티 구조 분리

- 이미지 업로드 버킷을 `post_images`로 변경하고 UUID 파일명을 사용.
- Featured 슬라이더와 관리 페이지 구현.
- VIP 크리에이터 권한, 카테고리 콤보박스, 커뮤니티 생성/CRUD 도입.
- `categories`와 `communities`를 분리하고 레딧 스타일 커뮤니티 전용 페이지 `/community/[slug]` 구현.
- 글쓰기 화면과 PostCard에 커뮤니티 연동 및 배지 표시 추가.
- 성능 최적화, 스켈레톤 UI, DB 인덱스, slug 중복 처리 개선.

### 2026-03-27: 운영 안정화와 어드민 기능

- 커뮤니티 조회/생성 관련 핫픽스와 RLS 디버깅.
- 누락 페이지인 인기/칼럼 라우팅 보강.
- 칼럼 페이지 실데이터 연동.
- 어드민 전용 드래그 앤 드롭 정렬 기능 완성.
- 헤더에 VIP 전용 Admin 버튼과 보안 강화.
- `DEBUG_COMMUNITIES.md`에 커뮤니티 생성 실패 원인, RLS 정책 확인 절차, Supabase 진단 쿼리가 정리됨.

### 2026-03-28: NPC 페르소나와 자동 상호작용의 시작

- 그릿(Grit) AI 페르소나 관리자 대시보드와 DB 연동.
- NPC 페르소나, 어드민 통합 대시보드, 빙의(impersonation) 시스템, 콘텐츠 팩토리 UI 추가.
- `/api/admin/test-interaction/route.ts`로 NPC 군단 활동 시뮬레이션 API 구현.
- 어드민 personas 페이지에 시뮬레이션 UI와 API 키 저장 기능 추가.
- 주요 버그 수정:
  - 모든 NPC가 한 계정으로 작성하던 문제 해결
  - 딜레이 없이 한 번에 실행되던 부자연스러운 액션 개선
  - 댓글/추천 작동 문제와 카운트 업데이트 로직 개선
- 대댓글 UI와 NPC 리얼리즘 업그레이드.
- Vercel Cron, 바이오리듬, 말투 강제, 봇 탐지 재생성, 템플릿 중복 방지, SKIP 로직, AI 폴백 체인까지 NPC 엔진이 빠르게 진화.
- 관련 문서: `WORK_SUMMARY_2026-03-28.md`

### 2026-03-29 ~ 2026-03-30: 자율 에이전트와 콘텐츠 팜

- 그릿 자율 에이전트 v1.0:
  - 관심도 매칭
  - 행동 DNA
  - Gemini Vision 기반 이미지 분석
  - Claude/Gemini/OpenAI 폴백 구조
- Gemini 모델명과 thinking 토큰 제한, 빈 응답 재시도 로직 조정.
- NPC 프롬프트 전면 리뉴얼.
- NPC 활동 관리 시스템:
  - 어드민 컨트롤 패널
  - `/api/admin/npc-cron`
  - 활동 시간대
  - 일일 할당량
  - 카운터 리셋
- 콘텐츠 팜 스크래퍼와 AI 리라이터 엔진 탑재.
- 한경/매경 RSS, 유머/자유게시판 HTML 스크래퍼, 이미지 다운로드 후 Supabase Storage 업로드 파이프라인 추가.
- Next.js self-call fetch 문제를 `after()` API 기반 백그라운드 처리로 전환.
- 실시간 댓글 RAG, Few-shot 댓글 프롬프트, 무의미 댓글 필터 강화.
- 관련 문서:
  - `NPC_CRON_README.md`
  - `NPC_CRON_IMPLEMENTATION_SUMMARY.md`
  - `FILE_MANIFEST.md`
  - `NPC_CRON_EXAMPLES.sh`

### 2026-03-31: 스크래퍼 확장, 커뮤니티 생태계, AI/NPC 세계관 확장

- 크론 전체 등록과 AI 프롬프트 오버홀.
- 원본 댓글 크롤링과 `source_comments` 저장.
- 개드립, 더쿠, 웃긴대학, 보배드림, 디시, 뽐뿌 등 스크래퍼 config/셀렉터 확장.
- Anti-Bot 헤더 적용.
- 전문가 댓글 AI 생성 디버깅과 DB 컬럼명 수정.
- 백엔드 카테고리 체계를 전역 상수로 통일.
- NPC 댓글 템플릿 폐지, 모든 댓글 AI 생성 및 RAG 적용.
- 이미지 URL 매핑, 이미지 필터링, AI 환각 방지, 문장 완결성, 단답 댓글 차단 강화.
- 무한 스크롤 구현.
- GeekNews 스크래퍼, AI/기술 특화 생태계, 8개 AI NPC, Role별 프롬프트 분기.
- 커뮤니티 멤버십 테이블과 NPC 전원 가입 SQL.
- VIP 어드민 글/댓글 삭제 권한.
- NPC 4차 웨이브로 총 40명 규모 완성.
- `persona_config` DB 기반 가상 세계, 인간미 프로토콜, KOL 케어 도입.

### 2026-04-01: 댓글 투표, 뉴스클리핑, 글로벌/커뮤니티 피드 조정

- NPC 활동 비율 조정:
  - 보팅/댓글/게시글 비중 재설계
  - 유머 콘텐츠 우선 발행
  - Anti-Conflict 필터
  - 발행 빈도 조정
- 댓글 투표(좋아요/싫어요)와 NPC 대댓글/댓글 투표 액션 추가.
- 대댓글 클릭 시 `@닉네임` 자동 삽입.
- 뉴스클리핑 프로젝트 기반 구축:
  - DB 스키마
  - Google News/아이보스 스크래퍼
  - AI 클러스터링
  - 요약 엔진
  - AI 카테고리 자동 분류
  - `/news` 브리핑 카드 UI
- 홈 피드에 커뮤니티 글이 안 보이던 버그 수정.
- NPC 커뮤니티 활성화 시스템 도입:
  - 글로벌 피드 60%
  - 커뮤니티 피드 40%

### 2026-04-06: NPC 비율 재조정

- NPC 활동 비율 재조정: 댓글 7, 글 3 비중과 유머 70% 중심.

### 2026-04-17: 활어 엔진 도입

- 기존 통합 `npc-cron` 중심 구조를 글 발행, 댓글, 보팅으로 분리.
- 새 엔진:
  - `publisher-cron`: 글 발행
  - `comment-bot`: 댓글 전용
  - `vote-bot`: 보팅 전용
- 댓글봇은 시간 가중 타겟 선정, NPC 풀 크기 결정, 적합도와 로드밸런싱 기반 NPC 선택, RAG few-shot 댓글 생성 구조.
- 보팅봇은 글/댓글을 대상으로 중복 방지, 업/다운 비율, 신선도/부족 보팅 가중치를 사용.
- 운영 문서: `COMMENT_VOTE_BOT_README.md`

### 2026-04-23: 모바일 앱 디자인 브리프

- `biztask_app_design_brief_2026-04-23.md` 추가.
- BizTask를 React Native 모바일 앱으로 확장하기 위한 디자인 요청서.
- 핵심 방향:
  - 40~60대 소상공인이 퇴근 후 보는 커뮤니티 앱
  - 블라인드 스타일 세로 피드
  - 네이버카페식 친근함과 한국어 가독성
  - 유머 80%, 비즈니스 Q&A 20%
  - 큰 글자, 큰 터치 타겟, 하단 탭바, 중앙 글쓰기 FAB

## 4. 현재 자동화 엔진 지도

### 콘텐츠 수집

- `app/api/admin/scraper-cron/route.ts`
  - 등록된 RSS/HTML 스크래퍼 실행
  - 중복 확인 후 `content_backlog`, `scraped_sources` 저장
  - 이미지 수집 및 Supabase Storage 업로드 연계

### 콘텐츠 리라이팅/발행

- `lib/scrapers/rewriter.ts`
  - Gemini, Anthropic, OpenAI 순서의 AI 리라이터 폴백
  - 봇 같은 표현, 환각, 단답, 문장 미완성 방지 로직이 누적됨
- `app/api/admin/publisher-cron/route.ts`
  - 백로그에서 콘텐츠를 고르고 NPC 작성자로 게시글 발행
  - 유머 우선, 카테고리/커뮤니티 매핑, 전문가 댓글 생성 포함

### 통합 NPC 크론

- `app/api/admin/npc-cron/route.ts`
  - 초기에는 핵심 엔진이었고 현재도 남아 있음
  - 활동 시간, 할당량, 게시글/댓글/추천, 대댓글, 댓글 투표까지 포함한 대형 엔진
  - 최근 문서 기준으로는 `DISABLE_NPC_CRON=true`로 비활성화하고 독립 봇을 쓰는 운영 방향

### 댓글 전용 봇

- `app/api/admin/comment-bot/route.ts`
  - 최근 30일 글 중 타겟 선정
  - 댓글 수, 시간대, 관심도, NPC 로드밸런싱 반영
  - 대댓글 30% 확률
  - `content_backlog.source_comments` 기반 few-shot RAG 사용

### 보팅 전용 봇

- `app/api/admin/vote-bot/route.ts`
  - 게시글과 댓글에 별도 투표
  - `post_likes`, `comment_votes` UNIQUE 제약으로 중복 방지
  - NPC별 일일 like 카운터 관리

### 뉴스클리핑

- `app/api/admin/news-cron/route.ts`
  - 뉴스 기사 수집
  - AI 클러스터링/요약
  - `news_articles`, `news_clips` 저장
- `app/news/page.tsx`
  - 뉴스 브리핑 카드 UI

## 5. 데이터베이스/스키마 축

주요 SQL 파일은 기능 진화 순서대로 남아 있다.

- 기본 커뮤니티/게시글: `schema.sql`, `schema_update.sql`, `schema_category.sql`
- 이미지/저장/상호작용: `schema_image_urls.sql`, `schema_bookmark.sql`, `schema_interaction.sql`, `schema_storage.sql`
- VIP/커뮤니티/RLS: `schema_vip_communities.sql`, `schema_rls_update.sql`, `schema_debug_communities_2026-03-27.sql`, `schema_vip_delete_rls_2026-03-31.sql`
- featured/정렬: `schema_featured_posts.sql`, `schema_featured_update.sql`, `schema_sort_order_2026-03-27.sql`
- NPC/personas: `schema_personas_*.sql`, `schema_ai_npc_users_2026-03-31.sql`, `schema_persona_config_2026-03-31.sql`, `sql_personas_active_hours_2026-03-30.sql`
- 스크래퍼/백로그: `sql/schema_content_backlog_2026-03-31.sql`, `sql/add_source_comments_column.sql`, `schema_fix_scraped_sources_fk_2026-03-31.sql`
- 댓글/대댓글/투표: `sql_add_reply_support.sql`, `schema_comment_votes_2026-04-01.sql`
- 뉴스클리핑: `schema_news_clipping_2026-04-01.sql`

## 6. 현재 변경 상태

2026-04-23 기준 작업 전부터 아래 파일에 미커밋 변경이 있었다.

- `app/api/admin/publisher-cron/route.ts`
- `app/api/admin/vote-bot/route.ts`
- `lib/scrapers/rewriter.ts`
- `biztask_app_design_brief_2026-04-23.md` 신규 파일

이 히스토리 문서는 위 파일들을 건드리지 않고 새 파일로만 추가했다. 이후 `chryseai-frontend/`는 별도 프로젝트로 확인되어 이 저장소에서 제거했다.

## 7. 다음에 작업할 때 주의할 점

- 이 저장소의 Next.js는 16.x라서 기존 지식과 다른 부분이 있을 수 있다. 코드 수정 전 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인해야 한다.
- Supabase RLS와 Service Role 사용 경계가 중요하다. 사용자 기능은 RLS를 존중하고, 크론/어드민/NPC 자동화는 `utils/supabase/admin.ts` 또는 서버 전용 서비스 클라이언트를 사용한다.
- NPC/봇 관련 코드는 이미 여러 세대가 누적되어 있다. 새 자동화를 추가하기보다 `publisher-cron`, `comment-bot`, `vote-bot` 중 어디에 속하는지 먼저 판단하는 것이 좋다.
- 현재 운영 방향은 통합 `npc-cron`보다 분리된 활어 엔진 쪽이다.
- 스크래퍼는 외부 사이트 구조 변경에 취약하다. 수정 시 `lib/scrapers/registry.ts`, `html-scraper.ts`, `rss-scraper.ts`, `anti-bot.ts`를 함께 확인해야 한다.
- 댓글/투표 카운트는 DB 테이블과 표시용 카운터가 동시에 존재한다. 중복/삭제/대댓글 작업 시 카운터 동기화가 중요하다.

## 8. 참고 문서 목록

- `WORK_SUMMARY_2026-03-28.md`: NPC 군단 시뮬레이션 1차 작업 요약
- `NPC_CRON_README.md`: 통합 NPC 크론 운영 가이드
- `NPC_CRON_IMPLEMENTATION_SUMMARY.md`: NPC 크론 구현 보고서
- `FILE_MANIFEST.md`: NPC 크론 관련 파일 목록
- `DEBUG_COMMUNITIES.md`: 커뮤니티 생성/RLS 디버깅 가이드
- `COMMENT_VOTE_BOT_README.md`: 활어 엔진 운영 가이드
- `biztask_app_design_brief_2026-04-23.md`: 모바일 앱 디자인 브리프
