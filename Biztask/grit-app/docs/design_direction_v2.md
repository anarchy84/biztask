# GRIT V2 디자인 방향성

> 클로드디자인이 작업 중. 이 문서는 디자인 명세 + 코드 구현 측면 정교화 메모.
> 작성일: 2026-04-28 / 클로드디자인 결과물 들어오면 별도 토큰 문서로 분리 예정.

## 1. 무드 앤 톤: "프리미엄 앤 힙"

사장님 앱이라고 올드한 게시판 느낌 나면 안 됨.

- **다크 모드 우선**: 어두운 배경 + 쨍한 포인트 컬러 (네온 블루 또는 일렉트릭 퍼플). "프로들의 비밀 공간" 느낌
- **라이트 모드**: 옵션 제공 (사용자 선택)
- **타이포**: 스레드처럼 얇고 가독성 높은 산세리프

## 2. 레이아웃

### 모바일 (하단 5탭)

| 탭 | 화면 | 설명 |
|---|---|---|
| 1 | 🏠 홈 | 추천+팔로우 게시글 피드 |
| 2 | 🔍 탐색/네트워크 | 뜨는 키워드 + 추천 사장님 (페북식 관계성) |
| 3 | 🤝 시크릿 라운지 | **가운데 탭**, B2B 매칭/구인구직/비공개 게시판 진입점 |
| 4 | 🔔 알림 | 인용/팔로우/멘션 |
| 5 | 👤 프로필 | 내 게시물, 그릿 지수, 인증 마크 |

### PC 웹 (X식 3단 컬럼)

```
[좌측]              [중앙]              [우측]
- 홈              - 메인 피드          - 실시간 트렌드 업종
- 탐색            - 무한 스크롤        - 추천 팔로우
- 시크릿 라운지   - 글 작성 박스       - 광고 (네이티브)
- 알림
- 프로필
```

## 3. 피드 UI (인스타 + 스레드 + X 결합)

게시글 한 개의 구조:

### 상단

- 닉네임 + `[마포구 요식업]` 같은 업종/지역 뱃지
- **페북식 관계성 한 스푼** (프로필 위 작은 글씨):
  - "아나키 님이 팔로우하는 유저입니다"
  - "내 팔로워 3명이 추천했습니다"
- 닉네임 옆 영롱한 **파란딱지** (유료/인증 회원)

### 본문

- **텍스트**: 스레드식 여백 충분히 (가독성 우선)
- **이미지**: 인스타식 가로 풀폭 고해상도
- **동영상**: Wi-Fi 자동재생 음소거 (인스타/X 동일 패턴), 셀룰러는 탭 시 재생

### 하단 액션바

```
💬 댓글     🔄 인용     ❤️ 좋아요     📥 저장
```

- 인용은 X 시그니처 (확장의 핵심)
- 공유 버튼: 외부 SNS로 예쁘게 카드 이미지 생성

## 4. 프로필 UI ("나를 증명하는 쇼룸")

사업자들의 허영심(좋은 의미)을 채워줘야 함.

- 상단: 커버 이미지 + 프로필 + 파란딱지
- **관계성 스탯**: 팔로워/팔로잉 + Mutual Connections (나와 겹치는 팔로워)
- **그릿 지수 (Trust Score)**: 게이지 형태 UI 바
- 탭: [내 게시물] / [답글] / [비즈니스 제안(매칭)]

## 5. 콘텐츠/알고리즘 비율 결정 (대웅 확정)

- **콘텐츠 타입**: 텍스트 50% / 이미지 30% / 동영상 20%
- **댓글 트리**: 무한 깊이
- **알고리즘 추천 강도**: 추천 80% / 내 팔로워 20%

## 6. 코드 임팩트 정리

클로드디자인 작업 결과 받아서 코드로 옮길 때 신경 쓸 것:

### 다크모드 시스템
```ts
// contexts/ThemeContext.tsx (신규)
- useColorScheme로 시스템 다크모드 감지
- AsyncStorage에 사용자 선택 저장 ('auto' | 'dark' | 'light')
- colors 토큰 light/dark 두 세트 정의
```

### 동영상 첨부
```bash
npx expo install expo-video expo-video-thumbnails
```
- Supabase Storage `post-videos` 버킷 신설
- 100MB 제한
- 썸네일 자동 생성
- 자동재생 정책 (Wi-Fi 음소거, 셀룰러 탭)

### 그릿 지수 (Trust Score)
```sql
ALTER TABLE profiles ADD COLUMN grit_score NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN grit_score_updated_at TIMESTAMPTZ;
```
- 어뷰징 방지를 위한 점수 공식 별도 검토 세션 필요
- 일일 배치 또는 실시간 트리거로 갱신

### 인용/리트윗
```sql
ALTER TABLE posts ADD COLUMN quoted_post_id UUID REFERENCES posts(id);
ALTER TABLE posts ADD COLUMN is_quote BOOLEAN DEFAULT false;
```

### Mutual Connections
```sql
-- 두 유저의 공통 팔로워 추출
SELECT follower_id FROM follows WHERE following_id = $1
INTERSECT
SELECT follower_id FROM follows WHERE following_id = $2
```

### 5탭 구조 재편
```
app/(tabs)/
├── _layout.tsx          (탭 네비게이션 정의)
├── index.tsx            (홈)
├── explore.tsx          (탐색/네트워크) ← 신규
├── secret-lounge.tsx    (시크릿 라운지) ← 신규, 인증 게이팅
├── notifications.tsx    (알림) ← 신규
└── profile.tsx          (프로필)
```

### 알림 시스템
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  type TEXT, -- 'follow' | 'quote' | 'comment' | 'mention'
  actor_id UUID,
  target_post_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
- Supabase realtime subscription으로 실시간 푸시

## 7. 디자인에 추가 요청할 디테일 (코드 측면)

클로드디자인한테 추가로 부탁할 만한 것:

1. **스켈레톤 로딩**: 피드 로딩 시 회색 카드 placeholder (다크모드에서 더 중요)
2. **햅틱 피드백**: 좋아요/북마크/팔로우 진동 (`expo-haptics`)
3. **풀투리프레시 커스텀**: 기본 스피너 대신 GRIT 로고 회전
4. **이미지 더블탭 좋아요**: 인스타 시그니처 + 하트 애니메이션
5. **인용 카드 위계**: 원글 카드 들여쓰기 + 회색 톤 다운 (X 패턴)
6. **5탭 가운데 시크릿 라운지**: 굵은 원형 액션 버튼 (인스타 카메라 자리), 인증 안 했으면 자물쇠 아이콘

## 작업 순서 (예상)

```
1. 클로드디자인 결과물 수신 (시안/토큰)
2. 디자인 토큰을 grit-app/constants/ 에 코드로 옮기기
3. ThemeContext 구축 (다크모드 시스템)
4. 5탭 라우터 재편
5. 피드 카드 컴포넌트 리뉴얼
6. 동영상 첨부 시스템 추가
7. 인용/리트윗 기능 구현
8. 알림 시스템 구현
9. 프로필 화면 리뉴얼 (그릿 지수, Mutual Connections)
10. 그릿 지수 점수 공식 확정 + 백엔드 구현
```

각 단계마다 코덱스/클로드 분담 가능.
