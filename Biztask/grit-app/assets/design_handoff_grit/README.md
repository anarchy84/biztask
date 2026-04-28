# Handoff: 그릿 (GRIT) — 사장님 전용 비즈니스 SNS

## Overview
'그릿(GRIT)'은 자영업·사장님을 위한 모바일 우선 비즈니스 SNS입니다. 검증된 사장님끼리만 진솔한 운영 노하우, 인력/비용 이슈, 매물·매칭을 익명/실명으로 공유하는 "프리미엄 비즈니스 라운지" 톤의 다크 UI입니다. 핵심 기능: 홈 피드, 탐색/네트워크, **시크릿 라운지**(인증 PRO 전용 익명 공간), 알림, 프로필, 그리고 **그릿 지수**(LV 1–100, 다이아몬드/플래티넘/골드 등급)로 신뢰도를 시각화합니다. PC는 3단 컬럼(좌 네비 / 중앙 피드 / 우 트렌드+매칭+라운지 티저).

## About the Design Files
이 번들 안의 파일은 **HTML로 만든 디자인 레퍼런스**입니다 — 룩 & 비헤이비어를 보여주는 프로토타입이지 그대로 복붙하는 production code가 아닙니다. 작업의 목표는 이 HTML 디자인을 **타겟 코드베이스의 기존 환경**(React/Next, React Native, SwiftUI, Flutter 등)에서 그 환경의 패턴/라이브러리/디자인 시스템에 맞춰 **재구현**하는 것입니다. 환경이 아직 없다면 프로젝트에 가장 적합한 프레임워크를 골라 구현하면 됩니다. (현 프로토는 inline JSX + Babel standalone + 단일 CSS 변수 시스템으로 작성됨 — 프로덕션엔 적합하지 않음.)

## Fidelity
**High-fidelity (hi-fi).** 색상, 타이포, 스페이싱, 컴포넌트 모양, 인터랙션, 카피까지 거의 최종에 가까운 모킹입니다. 픽셀 단위 재현을 권장하되 코드베이스의 기존 컴포넌트 라이브러리(예: Tailwind, shadcn/ui, NativeBase 등) 위에 매핑해서 구현하세요.

---

## Design Tokens

### Colors

```css
/* Brand — Emerald, 4 levels (calm, premium — NOT neon) */
--brand-300: #34D399  /* glow / hover */
--brand-400: #10B981  /* strong emphasis: numbers, gauge fills */
--brand-500: #059669  /* PRIMARY — CTAs, active tabs, follow buttons */
--brand-600: #047857
--brand-700: #065F46
--brand-800: #064E3B  /* gauge tracks, micro-lines */

/* Semantic (used sparingly, by meaning) */
--c-like:   #EF4444   /* like/heart only */
--c-verify: #3B82F6   /* verified badge */
--c-warn:   #F59E0B   /* warning */

/* Neutrals — deep grey, NOT pure black (hotel-lounge ambient) */
--bg-0:  #121212  /* app background */
--bg-1:  #1A1A1A  /* card surface */
--bg-2:  #242424  /* hover/active surface */
--bg-3:  #2D2D2D  /* nested surface */

--line-1: rgba(255,255,255,0.04)
--line-2: rgba(255,255,255,0.06)  /* default hairline */
--line-3: rgba(255,255,255,0.10)

/* Text — off-white scale, NEVER use #FFF */
--tx-1: #E4E4E7  /* primary body */
--tx-2: #A1A1AA  /* secondary, meta */
--tx-3: #71717A  /* tertiary, captions */
--tx-4: #52525B  /* disabled */

/* CTA text on emerald button */
color-on-brand: #ECFDF5  (mint-white, NOT #FFF, NOT #052E1B)
```

### Typography

- **Sans**: `Pretendard Variable` → fallback `Pretendard, Inter, -apple-system, system-ui`
- **Display/Numerals**: `Inter` → fallback `Pretendard Variable, system-ui`
- 숫자에는 `font-feature-settings: "tnum"` (tabular numerals) 클래스 `.tnum`

**Weight 위계 (중요):**
- 본문/캡션/라벨: `400` Regular
- 섹션 라벨, 메타 강조: `500–600`
- 닉네임 (예: "아나키"): `600` SemiBold
- 큰 숫자 (팔로워 8,247 / 팔로잉 412 / 게시물 187), 그릿 LV 87, 헤딩: `700` Bold
- 로고 글리프, 메인 헤딩: `800`

### Spacing & Radius

- Radius scale: `--r-sm: 8px`, `--r-md: 14px`, `--r-lg: 20px`, `--r-xl: 28px`
- Pill button: `border-radius: 999px`
- 카드 gap: 8–12px
- 모바일 horizontal padding: 16–18px
- PC 컨테이너: 3-column grid `260px | 1fr | 320px`, max-width 1280px

### Shadows / Elevation

```css
/* 카드 default — 거의 안 보일 정도로 미세하게 */
box-shadow: 0 4px 16px rgba(0,0,0,0.3);
border: 1px solid rgba(255,255,255,0.06);

/* CTA primary button */
box-shadow:
  0 0 0 1px rgba(16,185,129,0.18),
  0 4px 14px rgba(5,150,105,0.22);

/* Secret Lounge 자물쇠 글로우 (가운데 탭 버튼) */
box-shadow:
  0 0 0 1px rgba(16,185,129,0.25) inset,
  0 6px 22px rgba(5,150,105,0.35),
  0 0 32px rgba(52,211,153,0.18);
```

---

## Screens / Views

### 1. Mobile — Home Feed (`screens-mobile.jsx` → `MobileHome`)
- **Purpose**: 팔로잉/추천 사장님 게시물 피드. 운영 노하우, 매장 일상, 비즈니스 제안.
- **Layout**: iOS 프레임 안. 상단 sticky AppBar (로고 "그" + 검색 + DM), 그 아래 가로 스크롤 칩 필터 (전체/팔로잉/내 업종/근처/HOT), 게시물 카드 세로 리스트, 하단 5탭 네비.
- **Components**:
  - `<PostCard>` (`post-card.jsx`): 아바타 + 닉네임 + Verified + 업종 뱃지(예: "마포구·요식업") + 시간 / 본문 / 이미지 그리드 / 하단 액션 (좋아요·댓글·공유·저장)
  - "내 팔로워 8명이 추천했습니다" 한 줄 캡션 (페북식 social proof)
  - 게시물 사이 추천 사장님 카드 ("이 분도 팔로우해 보세요")
- **Behavior**: 카드 탭 → 상세, 좋아요 더블탭, 저장 토글, 공유 시트.

### 2. Mobile — Discover / Network (`MobileDiscover`)
- **Purpose**: 업종·지역별 사장님 탐색, B2B 매칭 후보 노출.
- **Layout**: 검색바 → "트렌딩 토픽" 칩 → "근처 사장님" 가로 캐러셀 → "B2B 매칭 추천" 카드 그리드 (2열) → 인기 게시물.
- **Components**: 사장님 카드 (아바타 + 그릿 LV ring + 업종 + 팔로우 버튼), 매칭 카드 (양쪽 아바타 + 매칭 이유 + 공통 팔로워 N명).

### 3. Mobile — Secret Lounge (`MobileLounge`) ⭐ 시그니처 화면
- **Purpose**: PRO 인증 사장님 전용 익명 공간. 실명/매장명 가려지고 "다이아몬드 사장님 #A7" 형태로 표시.
- **Layout**: 상단 어두운 헤더 + 자물쇠 아이콘 + "SECRET LOUNGE" 타이포 + 등급 뱃지. 4개 카테고리 카드 (인력 / 비용 / 매물 / 트러블) — 모두 동일한 보더 톤. 각 카테고리 진입 시 익명 게시물 리스트.
- **Components**: 카테고리 카드 (아이콘 + 제목 + "활성 토픽 N" + "오늘 +N개"), 익명 게시물 (등급 칭호 + 시간만 노출).
- **Tone**: 다른 화면보다 한 단계 더 어둡고 차분. 강조색을 거의 안 씀.

### 4. Mobile — Notifications (`MobileNotifications`)
- **Purpose**: 알림 피드.
- **Layout**: 상단 탭 (전체/팔로우/멘션/매칭) → 알림 row 리스트 (아바타 + 액션 텍스트 + 시간 + 미리보기 thumbnail).
- 미확인 알림은 좌측에 `--brand-400` 4px dot.

### 5. Mobile — Profile (`MobileProfile`) — Layout: **stacked**
- **Purpose**: 본인/타 사장님 프로필.
- **Layout (stacked variant — 기본)**:
  1. **Cover** (height 180px, `#1A1A1A` 베이스 + 중앙 위에서 emerald `radial-gradient(80% 60% at 50% 0%, rgba(5,150,105,0.10), transparent 70%)` 8% 깔림 + 1px 도트 그리드(opacity 4%)에 radial mask로 중앙만 보이게)
  2. 아바타 84px (그릿 ring overlay 28px) + 우측 [설정] [프로필 편집] CTA
  3. 닉네임 (22px / 700) + Verified + PRO 뱃지 / 업종 뱃지 / 5년차 뱃지 / bio
  4. **Stats row** — 게시물 / 팔로워 / 팔로잉 (숫자 20px / 700 tnum, 라벨 11px / 400 `--tx-3`)
  5. **Mutual followers**: 작은 아바타 4개 스택 + "23명의 공통 팔로워"
  6. **Grit gauge (level 스타일 — 기본)**: 1px 보더 카드 안에 "다이아몬드 사장님" / "LV 87" (700, `--brand-300`) + bar 게이지 (track `--brand-800`, fill `--brand-400`) + "다음 단계까지 13점 · 매칭 응답률 +5%"
  7. **Tabs** — 내 게시물 / 답글 / 비즈니스 제안 / 저장 (active는 `--tx-1` 600 + 하단 2px `--brand-400` underline)
- **Stats v alternate (`profileLayout: "glass"`)**: 글래스 카드 안에 인포 통합. (현재 디폴트는 stacked.)

### 6. PC — Home (`screens-pc.jsx` → `PCHome`)
- **Layout**: 3단 그리드 (260px / 1fr / 320px), 최대 1280px.
- **Left rail**: 로고, 검색, 메인 메뉴 (홈/탐색/시크릿 라운지/알림/메시지/프로필), 작성 CTA 버튼.
- **Center**: 게시물 작성 trigger ("운영 중 어떤 일이 있나요?") → 피드 (모바일과 동일 카드).
- **Right rail**: 트렌딩 토픽 (지수 변화 +340% 등 tnum, 작은 sparkline), B2B 매칭 추천 카드, 시크릿 라운지 티저 (자물쇠 + 활성 토픽 수).

---

## Interactions & Behavior

- **5탭 하단 네비** (모바일): 홈/탐색/**시크릿 라운지(가운데, 자물쇠)**/알림/프로필. 가운데 자물쇠는 -16px margin-top + 52×52 원형 + emerald primary + 글로우. 탭 active는 아이콘 색 `--tx-1` + 하단 4px dot `--brand-400`.
- **Card hover/press** (PC): `transform: translateY(-1px)` + shadow 강화, 100ms.
- **그릿 게이지 애니메이션**: 마운트 시 fill width 0→target % easing `cubic-bezier(.2,.8,.2,1)` 600ms.
- **Verified badge**: 항상 닉네임 바로 우측 16px 푸른 체크 (`--c-verify`).
- **Tweaks panel** (`tweaks-panel.jsx`): 우측 하단 토글로 열림. 디자인-system level 토글이라 production에서는 제거하거나 dev-only flag 뒤로 숨길 것.
- **Density**: tight / normal / **loose** — padding/gap 0.85x / 1x / 1.15x. (현재 디폴트 loose.)

## State Management

핵심 state(클라이언트 측):
- `currentTab` (home/discover/lounge/notifications/profile)
- `feedItems` (paginated)
- `likedPostIds`, `savedPostIds` (Set)
- `followingIds` (Set)
- `unreadNotificationCount`
- `loungeAuthorized: boolean` (PRO 인증 여부 — 서버 권한)
- `loungeAnonHandle` (등급 칭호 — 서버 발급)

서버에서 받아야 할 핵심 데이터:
- 사장님 프로필 (id, 닉, verified, pro, 업종, 지역, 연차, gritScore, gritLevel, gritTier)
- 게시물 (작성자, 본문, 미디어, 좋아요/댓글/저장 카운트, 추천 컨텍스트 "팔로워 8명이 추천")
- 시크릿 라운지 카테고리별 토픽 카운트, 익명 게시물

## Assets

- **Avatars**: 현재 SVG 그라디언트 placeholder (이름 이니셜 + hue). 실제 구현 시 사용자 업로드 이미지로 교체.
- **Post images**: `<ImagePlaceholder>` (그라디언트 메시 placeholder). 실제 이미지로 교체.
- **Icons**: 인라인 SVG (`primitives.jsx`의 `<Icon name>`) — Lucide 또는 Phosphor으로 1:1 매핑 가능. 현재 사용된 이름: home, compass, lock, bell, user, search, message, bookmark, heart, share, more, settings, plus, check, sparkle.
- **Fonts**: Pretendard Variable (CDN: cdn.jsdelivr.net/gh/orioncactus/pretendard), Inter (Google Fonts).

## Files

- `그릿.html` — 엔트리 포인트. CSS/스크립트 로드 순서, Tweak defaults JSON, root mount.
- `styles.css` — 모든 토큰 (CSS 변수), 글로벌, 카드, 버튼, 게이지, 오로라/그래뉼 배경 효과.
- `primitives.jsx` — Avatar, Verified, Badge, Icon, TrustScore (그릿 게이지 ring/bar/level/radar), ImagePlaceholder, Button.
- `post-card.jsx` — 게시물 카드 (모바일/PC 공유).
- `data.jsx` — 더미 데이터 (사장님, 게시물, 토픽, 카테고리).
- `screens-mobile.jsx` — Home/Discover/Lounge/Notifications/Profile + 하단 5탭.
- `screens-pc.jsx` — PC 3단 컬럼 홈, PC 프로필.
- `ios-frame.jsx`, `design-canvas.jsx` — 디자인 캔버스 셸 (production에서는 불필요).
- `tweaks-panel.jsx` — Tweaks UI (production에서는 제거).

## Implementation Notes for Claude Code

1. **재구현 권장 스택**: React + TypeScript + Tailwind (또는 vanilla-extract / CSS Modules), 또는 React Native (모바일 우선이라면). 모든 토큰을 Tailwind config / theme.ts로 옮기세요.
2. **컴포넌트 매핑**: `primitives.jsx`의 컴포넌트를 그대로 한 파일씩 production 컴포넌트로 옮기되, prop 인터페이스는 동일하게 유지하면 디자인 호환이 쉬움.
3. **JSX inline style → CSS**: 현 프로토는 inline style이 많은데, production에서는 className 또는 CSS-in-JS로 옮기세요. 단 CSS 변수(`--brand-500` 등)는 그대로 유지.
4. **Density / theme variants**: 현재는 root `data-*` attribute로 처리됨. 같은 패턴 유지하거나 React context로 옮기면 됨.
5. **다크가 디폴트**: 라이트 모드 토큰도 `styles.css`에 정의돼있지만 우선순위는 다크. 라이트는 v2에서.
6. **접근성**: 컬러 콘트라스트 `--tx-2` (#A1A1AA) on `--bg-0` (#121212)는 4.5:1 통과. `--tx-3`은 보조 텍스트로만.
7. **그릿 지수 계산식**은 서버 사이드 비즈니스 로직 (별도 정의 필요).
