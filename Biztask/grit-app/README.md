# GRIT

사장님들의 쉼터 · 정보교류 커뮤니티 앱 (Phase 1 UI 프로토타입)

> 20~60대 자영업자·소규모 대표님들을 위한 블라인드식 세로 피드 커뮤니티.
> Phase 1은 UI 스캐폴딩 + 목업 데이터만. Phase 2에서 Supabase 연동.

---

## 필요한 환경

- **Node.js** 20 이상 (권장: LTS)
- **npm** 또는 **yarn**
- **Expo Go 앱** (실기기 테스트용) 또는 iOS 시뮬레이터 / Android 에뮬레이터

Expo Go는 앱스토어·플레이스토어에서 "Expo Go" 검색 후 설치.

---

## 실행 방법 (3단계)

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 실행
npx expo start

# 3) 터미널에 뜨는 QR을 Expo Go 앱으로 스캔
#    (iOS: 카메라 앱으로, Android: Expo Go 앱 내 QR 스캐너)
```

시뮬레이터로 돌리고 싶으면 서버 실행 후:
- `i` → iOS 시뮬레이터
- `a` → Android 에뮬레이터
- `w` → 웹 브라우저 (일부 RN 기능은 제한)

---

## Pretendard 폰트 설치 (선택)

지금은 폰트 파일 없이도 시스템 폰트로 돌아가. 완벽한 한국어 타이포 적용하려면:

1. [orioncactus/pretendard 릴리스 페이지](https://github.com/orioncactus/pretendard/releases) 에서 최신 릴리스 다운로드
2. `web-static` 또는 `public-static` 폴더에서 아래 4개 파일 추출
   - `Pretendard-Regular.otf`
   - `Pretendard-Medium.otf`
   - `Pretendard-SemiBold.otf`
   - `Pretendard-Bold.otf`
3. 위 파일들을 `assets/fonts/` 폴더에 복사
4. `app/_layout.tsx` 열고 `useFonts` 안의 `require` 4줄 주석 해제
5. 서버 재시작 (`npx expo start --clear`)

---

## 폴더 구조

```
grit-app/
├── app/                      # Expo Router v4 (파일 기반 라우팅)
│   ├── _layout.tsx           # 루트 레이아웃 (폰트 로딩 + Stack)
│   ├── (tabs)/               # 하단 탭 네비
│   │   ├── _layout.tsx       # 5탭 정의 (홈/검색/글쓰기/알림/내정보)
│   │   ├── index.tsx         # 홈 피드 (블라인드식 카드 리스트)
│   │   ├── search.tsx        # 검색 (placeholder)
│   │   ├── write.tsx         # 글쓰기 (placeholder)
│   │   ├── notifications.tsx # 알림 (placeholder)
│   │   └── profile.tsx       # 내정보 (placeholder)
│   └── post/
│       └── [id].tsx          # 글 상세 페이지 + 댓글
├── components/
│   ├── common/
│   │   ├── IndustryBadge.tsx # 업종 파스텔 배지
│   │   └── TimeAgo.tsx       # "3분 전" 상대시간
│   └── feed/
│       └── PostCard.tsx      # 피드 카드
├── constants/
│   └── colors.ts             # 디자인 토큰 (컬러/타이포/스페이싱/라운드)
├── lib/
│   └── types.ts              # 공통 타입 (Post/Comment/Industry 등)
├── assets/fonts/             # (선택) Pretendard 폰트 파일
├── app.json                  # Expo 설정
├── babel.config.js           # babel + @ alias
├── tsconfig.json             # TS strict + @ alias
└── package.json
```

---

## 디자인 토큰 (핵심만)

| 토큰 | 값 | 용도 |
|---|---|---|
| `colors.brand` | `#97C93A` | 법인차 번호판 연두 (primary) |
| `colors.brandPressed` | `#7FAD2E` | 눌렸을 때 |
| `colors.textBrand` | `#648823` | 흰 배경 위 브랜드 텍스트 (대비 확보) |
| `colors.textStrong` | `#1C1917` | 제목·강조 차콜 |
| `colors.textPrimary` | `#333333` | 본문 |
| `colors.textMuted` | `#767676` | 메타 정보 (시간·업종) |
| `colors.bg` | `#FFFFFF` | 기본 배경 |
| `colors.bgMuted` | `#FAFAFA` | 섹션 배경 |
| `colors.border` | `#EEEEEE` | 구분선 |

**CTA 공식**: 연두 배경(`#97C93A`) + 차콜 텍스트(`#1C1917`) → 대비비 7:1 이상 (WCAG AAA).

---

## Phase 1 기능 체크리스트

- [x] 하단 5탭 (홈/검색/글쓰기/알림/내정보)
- [x] 홈 피드 (목업 5개, 카테고리 필터)
- [x] 글 상세 + 좋아요·싫어요 토글
- [x] 댓글 리스트 + 고정 입력창
- [x] 업종 배지 (10종)
- [x] "3분 전" 상대시간 자동 갱신
- [x] 중앙 글쓰기 탭 FAB 스타일
- [x] 프로필 탭 (목업)

## Phase 2 로드맵

- [ ] Supabase 연동 (Auth + DB + Storage)
- [ ] 카카오 로그인 (OAuth)
- [ ] 실제 글 발행 + 이미지 업로드
- [ ] Realtime 댓글·좋아요 구독
- [ ] expo-notifications 푸시
- [ ] NPC 활어 엔진 (자동 댓글·글)
- [ ] 검색 (제목·본문·닉네임)
- [ ] 업종별 라운지

---

## 트러블슈팅

**Q. `npx expo start` 했더니 Metro 번들러 에러가 나**
A. `npx expo start --clear` 로 캐시 날리고 다시 시도.

**Q. 폰트가 안 예뻐 보여**
A. Pretendard 폰트 파일을 `assets/fonts/`에 넣고 `app/_layout.tsx`의 require 주석을 풀어야 해. 위 "Pretendard 폰트 설치" 섹션 참고.

**Q. TypeScript 에러 `Cannot find module '@/...'`**
A. VSCode·Cursor는 `tsconfig.json`을 자동으로 안 집을 때가 있어. 에디터 재시작하면 됨.

**Q. Android 에뮬레이터에서 한글이 깨져**
A. 시스템 폰트 fallback 때문. Pretendard 설치하면 해결.

---

## 지금 앱이 어떻게 생겼는지 빠르게 보려면

1. `npm install && npx expo start`
2. Expo Go 앱으로 QR 스캔
3. 홈 → 글 카드 탭 → 상세 → 좋아요 눌러보기
4. 하단 탭 이동해서 각 placeholder 확인
5. 중앙 글쓰기 버튼 눌러서 목업 발행 테스트

바로 손에 잡히는 게 중요하니까, 일단 돌려보고 눈에 거슬리는 거 있으면 피드백 주세요.
