# 활어 엔진 V2 고도화 설계

작성일: 2026-04-29  
범위: 설계 문서만. 코드 구현은 다음 세션에서 진행.

## V1 자산 (계승)

- **3 cron**
  - `publisher-cron`: `content_backlog`에서 글밥을 꺼내 재가공 후 게시글 발행.
  - `comment-bot`: 글과 독립적으로 댓글/대댓글을 생성. 4-Layer 픽 로직 사용.
  - `vote-bot`: 글/댓글에 반응을 찍어 숫자가 살아 움직이는 느낌 생성.
- **NPC 페르소나**
  - V1 운영 기준은 핵심 NPC 10명 계승으로 잡는다.
  - 레거시 코드에는 21명 이상 확장 흔적이 있으므로, 말투/관심사/활동시간 필드는 재사용 후보로 둔다.
- **4-Layer 댓글 픽**
  - Layer 1: 시간 가중치로 타겟 글 선택.
  - Layer 2: 글 상태에 따라 참여 NPC 수 결정.
  - Layer 3: 콘텐츠 적합도 × 로드밸런싱으로 NPC 선택.
  - Layer 4: 댓글 생성 + 일정 확률 대댓글.
- **글밥 창고 RAG**
  - `content_backlog`에 원문, 이미지, `source_comments`를 저장.
  - 발행/댓글 생성 시 원본 댓글 분위기를 few-shot 재료로 사용.
- **뉴스클리핑**
  - 뉴스 수집 → 클러스터링/요약 → 커뮤니티 문체로 재가공하는 파이프라인을 V2 “운영 이슈 카드” 재료로 전환한다.

## V2 변경 포인트

V2의 핵심 변화는 “그냥 글이 올라오는 커뮤니티”가 아니라 인증/관계/추천이 섞인 사장님 네트워크라는 점이다. 활어 엔진도 모든 글을 같은 방식으로 뿌리지 말고, tier와 카테고리, 추천 알고리즘 점수까지 같이 설계해야 한다.

## 1. NPC 페르소나 V2 확장

기존 핵심 10명은 일반 피드의 밀도를 담당하고, 시크릿 라운지에는 verified 이상 NPC 6명을 추가한다.

| 구분 | 닉네임 | tier | 업종/역할 | 지역 | 주 무대 |
|---|---|---:|---|---|---|
| 기존 | 압구정바리스타 | verified | 카페 운영 7년차 | 강남 | 팁/고민/동네 |
| 기존 | 동대문빅마마 | verified | 도소매/재고 | 동대문 | 비용/매입 |
| 기존 | 편의점빌런 | general | 야간 편의점 | 관악 | 유머/고민 |
| 기존 | 네일하는누나 | verified | 뷰티샵 | 홍대 | 후기/직원 |
| 기존 | 지표의노예 | general | 온라인/마케팅 | 판교 | 질문/분석 |
| 기존 | 납품아재 | verified | 납품/물류 | 구로 | B2B/비용 |
| 기존 | MZ사장 | general | 자동화/1인사업 | 성수 | 팁/도구 |
| 기존 | 가성비충 | general | 비품/구매 비교 | 인천 | 비용 절감 |
| 기존 | 자영업은지옥 | general | 폐업 후 재창업 | 부산 | 고민/공감 |
| 기존 | 논리왕 | general | 세무/노무 관심 | 전국 | 질문/팩트체크 |
| 신규 | 인력반장K | verified | 알바/스케줄 운영 | 신림 | 시크릿: 인력 |
| 신규 | 세무쪼개기 | verified | 세무사무소 협업 경험 | 마포 | 시크릿: 비용 |
| 신규 | 권리금탐정 | verified | 매물/권리금 분석 | 송파 | 시크릿: 매물 |
| 신규 | 진상대응팀장 | verified | CS/분쟁 처리 | 부천 | 시크릿: 트러블 |
| 신규 | 공동구매왕 | blue | 식자재 공동구매 | 강서 | 시크릿: 비용/B2B |
| 신규 | 야간점주 | verified | 24시 매장 운영 | 수원 | 시크릿: 인력/트러블 |

NPC 프로필은 `profiles.is_npc=true`로 유지하되, UI에는 AI/NPC 표식을 노출하지 않는다. V2에서는 `tier`, `verified_at`, `region`, `years_in_business`, `grit_score`가 추천과 신뢰도에 직접 연결된다.

## 2. 콘텐츠 라우팅

일반 피드와 시크릿 라운지는 발행 재료와 말투를 분리한다.

| 라우트 | 대상 category | 진입 tier | 콘텐츠 톤 | NPC 조건 |
|---|---|---:|---|---|
| 일반 피드 | `humor`, `worry`, `question`, `tip` | guest 읽기 / general 쓰기 | 공개 가능한 운영 이야기 | general 이상 |
| 시크릿 인력 | `secret_staffing` | verified | 급여, 알바, 스케줄, 면접 | verified 이상 |
| 시크릿 비용 | `secret_cost` | verified | 원가, 수수료, 공동구매, 세무 | verified 이상 |
| 시크릿 매물 | `secret_property` | verified | 권리금, 임대료, 상권, 양도양수 | verified 이상 |
| 시크릿 트러블 | `secret_trouble` | verified | 진상, 분쟁, 신고, 법률 리스크 | verified 이상 |

라우팅 규칙:

- `content_backlog`에 `target_surface`를 둔다: `feed` 또는 `secret_lounge`.
- `target_surface='secret_lounge'`인 글은 verified/blue NPC만 작성한다.
- 시크릿 글은 외부 스크래핑 원문을 그대로 쓰지 않고, 익명화/일반화 단계를 반드시 거친다.
- 일반 피드는 재미/공감 중심, 시크릿은 “실무자가 아니면 모르는 정보” 중심으로 생성한다.

## 3. 추천 알고리즘 시너지

`get_feed_ranked`와 활어 엔진은 따로 놀면 안 된다. NPC 글은 cold start를 해결하되, 사용자 글을 밀어내지 않는 방식으로 점수를 만든다.

추천 점수 연동안:

- 신규 NPC 글에는 낮은 수준의 초기 반응 seed를 준다: `like_count 1~4`, `bookmark_count 0~2`, `quote_count 0~1`.
- 시크릿 글은 공개 피드에 섞지 않고 라운지 내부 ranking만 사용한다.
- NPC끼리 follows 그래프를 미리 만들되, 실제 유저와의 연결은 사용자가 팔로우한 뒤에만 추천 가중치에 반영한다.
- “팔로워 N명이 추천했습니다” 문구는 다음 순서로 산출한다:
  1. 내 팔로잉/팔로워가 실제 반응한 글.
  2. 내 업종/지역에서 반응이 많은 글.
  3. cold start 구간에서는 NPC social proof mock을 낮은 N으로 제한.
- 사용자 글이 들어오면 같은 category의 NPC 댓글/좋아요를 붙여 초기 반응 공백을 줄인다.

점수 가드레일:

- NPC 글에는 `npc_seed_score` 같은 내부 가중치를 두되, 실제 카운터와 분리해서 과한 조작감을 피한다.
- 사용자 글은 첫 2시간 동안 freshness bonus를 더 크게 준다.
- 같은 NPC가 연속으로 추천 상위권에 뜨지 않도록 author diversity penalty를 둔다.

## 4. Cron 스케줄 V2

| 잡 | 주기 | 역할 | V2 조정 |
|---|---:|---|---|
| scraper/news | 1시간 | 글밥/뉴스 재료 수집 | 민감 정보 제거, 업종/지역 태깅 추가 |
| publisher | 30분 | 신규 글 발행 | 피크 시간대 가중, feed/secret 분리 |
| comment-bot | 5분 | 댓글/대댓글 생성 | 사용자 글 우선, 한 글당 NPC 댓글 최대 3개 |
| vote-bot | 10분 | 반응/저장 seed | 중복 reaction unique 준수 |
| secret-lounge-bot | 20~30분 | 인증 라운지 전용 글/댓글 | verified NPC만 사용, 카테고리별 쿼터 |

피크 시간대:

- 오전 08~10시: 출근/오픈 전 체크.
- 점심 12~14시: 사장님 짬 시간.
- 저녁 21~24시: 마감 후 고민/정산 시간.

## 5. RAG 글밥 창고 V2

V1은 댓글 생성 중심이었다. V2는 신규 글, 댓글, 인용 글까지 RAG를 확장한다.

제안 schema:

- `content_backlog.target_surface`: `feed` 또는 `secret_lounge`.
- `content_backlog.secret_category`: `staffing`, `cost`, `property`, `trouble`.
- `content_backlog.source_comments`: 말투 few-shot.
- `content_backlog.risk_level`: `low`, `medium`, `high`.
- `content_backlog.redaction_notes`: 민감정보 제거 기록.
- `content_backlog.assigned_persona_id`: 발행 NPC.

생성 방식:

- 신규 글: 원문을 그대로 옮기지 않고, 업종/지역/상황만 추출해 GRIT 문체로 재작성.
- 댓글: `source_comments`를 말투 샘플로 쓰되, 사실관계는 게시글 본문만 기준으로 제한.
- 인용 글: 기존 인기 글을 직접 복붙하지 않고 “내 업장에서 비슷한 케이스” 형태로 확장.
- 뉴스클리핑: 정책/최저임금/수수료/임대차 이슈를 3줄 요약 + 사장님 관점 질문으로 변환.

## 6. 안전장치

- NPC 비율은 초기 70%까지 허용하되, 실제 사용자 활성도가 올라가면 자동으로 줄인다.
- 한 글당 NPC 댓글 최대 3개, 대댓글은 최대 1단계까지만 자동 생성한다.
- 같은 NPC는 30분 안에 같은 surface에 연속 발행하지 않는다.
- 시크릿 라운지 글은 사업자/직원/상호/정확한 주소를 생성하지 않는다.
- 트러블 카테고리는 법률 단정 표현을 금지하고 “경험 공유/확인 필요” 톤으로 제한한다.
- 운영자 kill switch를 둔다: `DISABLE_ACTIVITY_ENGINE`, `DISABLE_SECRET_BOT`, `MAX_NPC_RATIO`.
- 모든 NPC 생성 row에는 내부 감사용 `is_npc`, `persona_id`, `engine_version`을 남긴다. UI에는 노출하지 않는다.

## 7. 구현 우선순위 (다음 세션)

1. NPC 6명 신규 페르소나 seed와 `profiles` tier/verified/grit 값 세팅.
2. 시크릿 라운지 category enum 또는 별도 `secret_posts` 설계 확정.
3. `content_backlog` V2 schema migration 작성.
4. `publisher/comment/vote/secret` Edge Function 또는 서버 라우트 구조 정의.
5. 4-Layer 댓글 픽 V2 가중치 재조정.
6. `get_feed_ranked`와 NPC seed/social proof 필드 연결.
7. 관리자용 dry-run 로그와 kill switch 검증.

## 열린 질문

- 시크릿 라운지를 `posts.category` 확장으로 갈지, 별도 테이블로 분리할지 결정 필요.
- 동영상 seed 콘텐츠까지 자동 생성할지, 초기에는 이미지/텍스트만 둘지 결정 필요.
- NPC의 `tier=blue`를 실제 구독자와 동일하게 취급할지, 내부 추천 가중치에서만 쓰는 운영 tier로 둘지 결정 필요.
