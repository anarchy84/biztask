# 🤝 코덱스 인계서 — V2 갈아엎기 Phase 3~6

> **현재 브랜치**: `v2-redesign` (V1은 `v1-preserved` 브랜치에 영구 보존됨)
> **작성일**: 2026-04-28
> **클로드 Wave 1 완료 후 시작**

---

## 0. 시작 전 필독

먼저 이 3개 문서 순서대로 읽어:
1. `docs/CODEX_GUIDELINES.md` — 두 AI 협업 규약
2. `docs/grit_master_plan_v2.md` — V2 기획서 단일 소스
3. `docs/design_direction_v2.md` — 디자인 명세 (그린 4단/다크 4단/오프화이트 4단)
4. `assets/design_handoff_grit/README.md` — 클로드디자인 핸드오프 (가장 정확한 토큰 + 컴포넌트 매핑)

특히 `assets/design_handoff_grit/`의 `primitives.jsx`, `screens-mobile.jsx`, `post-card.jsx`는 **비주얼 레퍼런스**야. 그대로 복붙 X. RN/Expo로 재구현.

---

## 1. 클로드가 먼저 만들어둔 것 (Wave 1 산출물)

코덱스 작업 전에 클로드가 다음을 완료해둠. 이거 import해서 사용:

### DB 스키마
- `profiles` 확장: tier/business_number/verified_at/subscription_until/region/years_in_business/cover_url/grit_score/grit_score_updated_at
- `posts` 확장: quoted_post_id/is_quote/video_url/video_thumbnail_url/bookmark_count/quote_count/image_urls(text[])
- `follows` 신규 테이블 (follower_id, following_id)
- `lib/database.types.ts` 자동 생성됨

### 디자인 토큰
- `constants/colors.ts`: brand 4단, bg 4단, text 4단, semantic 3색, line 3단
- `constants/typography.ts`: Pretendard Variable + Inter, weight 위계
- `constants/spacing.ts`: radius (sm/md/lg/xl), gap, container padding
- `constants/shadows.ts`: card default, CTA, secret lounge glow

### 컨텍스트 + Hook
- `contexts/AuthContext.tsx`: tier 추가 → `const { tier } = useAuth()` 가능
- `lib/hooks/useTier.ts`: 권한 체크 (`canViewSecretLounge`, `canPostJob`, `isVerified` 등)
- `contexts/ThemeContext.tsx`: 다크/라이트 토글 (기본 다크)

### 폰트
- `assets/fonts/Pretendard*.otf` 로드됨
- `_layout.tsx`의 `useFonts` 활성화됨

---

## 2. 코덱스 작업 — Phase별

### Phase 3-C: 공통 컴포넌트 5종

`assets/design_handoff_grit/primitives.jsx` + `post-card.jsx` 매핑:

| HTML 컴포넌트 | RN 신규 위치 | 사용처 |
|---|---|---|
| `<Avatar>` | `components/Avatar.tsx` | 거의 모든 화면 |
| `<Verified>` `<Badge>` (Industry/Years) | `components/Badge.tsx` | 피드/프로필 |
| `<Button>` (Primary/Ghost) | `components/Button.tsx` | CTA/팔로우 |
| `<TrustScore>` (ring/bar/level/radar) | `components/GritGauge.tsx` | 프로필/탐색 |
| `<PostCard>` | `components/PostCard.tsx` | 피드 |

**각 컴포넌트 요구사항**:
- TypeScript strict 통과
- `constants/colors.ts` 토큰만 사용 (하드코딩 금지)
- 한글 주석 + JSDoc
- 다크모드만 우선 (라이트는 v2)
- accessibilityLabel 추가
- 48px 이상 터치 영역 (Apple HIG)

**GritGauge 4가지 모드** (props로 분기):
- `mode="ring"`: 원형 게이지 (탐색 카드, 작은 사이즈)
- `mode="bar"`: 가로 바 게이지 (프로필, 큰 사이즈)
- `mode="level"`: LV 87 + 다이아몬드 사장님 텍스트
- `mode="radar"`: 5축 레이더 차트 (선택적)

### Phase 4-A: 5탭 네비 갈아엎기

`app/(tabs)/_layout.tsx` 갈아엎기:

```tsx
<Tabs>
  <Tabs.Screen name="index" />          {/* 홈 */}
  <Tabs.Screen name="explore" />        {/* 탐색 (신규) */}
  <Tabs.Screen name="lounge" />         {/* 시크릿 라운지 (신규, 가운데) */}
  <Tabs.Screen name="notifications" /> {/* 알림 (신규) */}
  <Tabs.Screen name="profile" />        {/* 프로필 (이름 변경) */}
</Tabs>
```

**가운데 시크릿 라운지 탭 특수 처리**:
- `marginTop: -16` (다른 탭보다 위로 살짝 떠오름)
- 52×52 원형
- emerald primary (`brand.500`) + 글로우 (`shadows.secretLoungeGlow`)
- 인증 안 됐으면 자물쇠 아이콘
- 인증 됐으면 sparkle 아이콘
- `useTier()`로 분기

### Phase 5: 5개 화면 (병행 가능)

각 화면은 디자인 핸드오프 README의 해당 섹션 참조:

| 화면 | 파일 | 핸드오프 섹션 |
|---|---|---|
| 홈 피드 | `app/(tabs)/index.tsx` | §1 Mobile Home Feed |
| 탐색/네트워크 | `app/(tabs)/explore.tsx` | §2 Mobile Discover |
| 시크릿 라운지 | `app/(tabs)/lounge.tsx` | §3 Mobile Secret Lounge ⭐ |
| 알림 | `app/(tabs)/notifications.tsx` | §4 Mobile Notifications |
| 프로필 | `app/(tabs)/profile.tsx` | §5 Mobile Profile |

**시크릿 라운지 게이팅** (가장 중요):
```tsx
const { isVerified } = useTier()

if (!isVerified) {
  return <SecretLoungeGate />  // "사업자 인증하면 들어올 수 있어요" 안내 화면
}

return <SecretLoungeContent />
```

**홈 피드 데이터 fetch**:
- 추천 80% / 팔로우 20% 믹스 (Phase 7에서 알고리즘 SQL 제공 예정, 일단 시간순으로)
- `lib/hooks/useFeed.ts` 작성 (Supabase 쿼리)
- 무한 스크롤 (`useInfiniteQuery` 또는 manual pagination)
- "팔로워 N명이 추천했습니다" 한 줄: 일단 mock으로, 알고리즘 완성 후 실제 연결

### Phase 6: 잔여 화면

| 화면 | 파일 | 비고 |
|---|---|---|
| 글쓰기 | `app/post/new.tsx` 또는 모달 | V2 톤으로 리뉴얼 (이미지 다중 + 동영상 첨부 + 인용 옵션) |
| 글 상세 | `app/post/[id].tsx` | V2 카드 디자인 + 무한 댓글 트리 |
| 로그인 | `app/login.tsx` | 디자인만 V2 톤으로 리뉴얼 (로직 그대로) |
| 온보딩 | `app/onboarding/nickname.tsx` | 디자인만 V2 톤으로 리뉴얼 |
| 프로필 편집 | `app/profile/edit.tsx` | 커버 이미지 추가 + V2 톤 |

---

## 3. 데이터 fetch 패턴 (모든 화면 공통)

```tsx
// 1. 클로드가 만든 hook 사용
import { useTier } from '@/lib/hooks/useTier'
import { supabase } from '@/lib/supabase'

// 2. 화면별 데이터 hook (코덱스가 작성)
function useFeed() {
  // Supabase 쿼리 + tier 분기
  // tier='guest'면 시크릿 카테고리 제외
  // tier='verified'면 시크릿도 포함
}
```

`lib/database.types.ts`에서 자동 생성된 타입 사용. 모든 쿼리는 이 타입으로 strict.

---

## 4. 코덱스 작업 체크리스트 (각 화면 완성 시)

- [ ] `npx tsc --noEmit` 통과
- [ ] StyleSheet 토큰만 사용 (하드코딩 금지)
- [ ] 한글 주석 작성
- [ ] commit 메시지 한글 + 영역 표시 (`auth/callback: ...`, `feed/home: ...`)
- [ ] 자동 푸시 X (대웅 검수 후 직접)
- [ ] 시뮬레이터에서 시각 검증 1회
- [ ] tier 분기 누락 없는지 확인 (시크릿 게이팅, 단톡 등)

---

## 5. 충돌 방지

같은 파일 동시 수정 금지. 각자 작업 영역 명확히:

- **클로드만 수정**: `constants/`, `contexts/`, `lib/hooks/useTier.ts`, `supabase/migrations/`, `lib/database.types.ts`
- **코덱스만 수정**: `app/`, `components/`, 데이터 fetch hook (`useFeed`, `useProfile` 등)
- **공통 (먼저 시작한 쪽이 commit 후 다른 쪽 시작)**: `lib/supabase.ts`, `_layout.tsx`

작업 전 `git pull` 필수. commit 메시지에 영역 명확히.

---

## 6. 끝났을 때

각 Phase 완료 시 대웅한테 알려:
- "Phase 3-C 완료, 컴포넌트 5종 작성"
- "Phase 5 완료, 5개 화면 모두 시뮬레이터 검증"

대웅이 클로드한테 다음 단계 트리거 줘. 클로드는 Wave 3 (추천 알고리즘 + 활어 엔진 V2 고도화) 진행.

---

문서 끝. 질문은 대웅이한테 (대웅이 클로드한테 전달).
