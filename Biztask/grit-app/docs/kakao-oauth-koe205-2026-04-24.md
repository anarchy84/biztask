# 카카오 로그인 KOE205 트러블슈팅 기록

> 작성일: 2026-04-24
> 작성자: Claude (대웅과 함께 디버깅)
> 상태: **미해결** — `account_email` 권한 이슈로 비즈앱 전환 또는 우회책 필요
> 2026-04-26 앱 반영: `lib/socialProviders.ts`에서 카카오 로그인을 기본 비활성화하고, `app/login.tsx`에서 "준비중" 상태로 표시함

---

## TL;DR

GRIT 앱에서 카카오 소셜 로그인 시도 시 **KOE205 "잘못된 요청"** 에러 발생.
원인: **Supabase Kakao provider가 `account_email`, `profile_image` scope를 자동 요청**하는데, 카카오 일반 개발자 앱은 `account_email` 권한이 없음.

`profile_image`는 동의항목 설정으로 해결했지만, **`account_email`은 비즈앱(사업자) 전환 후 심사 통과해야만 사용 가능**.

---

## 문제 상황

### 에러 메시지 (카카오 공식)

```
잘못된 요청 (KOE205)
그릿 서비스 설정에 오류가 있어, 이용할 수 없습니다.
서비스 관리자의 확인이 필요합니다.

왜 에러가 발생하나요?
설정하지 않은 카카오 로그인 동의 항목을 포함해 인가 코드를 요청했습니다.
설정하지 않은 동의 항목: account_email, profile_image
```

### 발생 시점

앱(Expo Go) → 프로필 탭 → "로그인하고 계정 지키기" → 카카오 버튼
→ Safari in-app browser 열림 → 카카오 로그인 페이지 → KOE205 에러

---

## 원인 분석

### 1. Supabase Kakao provider의 기본 scope

Supabase JS의 `signInWithOAuth({ provider: 'kakao' })`는 내부적으로 다음 scope를 카카오 OAuth URL에 포함시켜 요청한다:

- `account_email`
- `profile_image`
- `profile_nickname`

코드에서 `options.scopes`로 오버라이드를 시도해도, Supabase 서버 측에서 기본값이 강제로 들어갈 수 있음.

### 2. 카카오 개인 개발자 앱의 권한 제약

카카오 개발자 콘솔에서 동의항목 권한 분포:

| 동의 항목 | 일반 앱 | 비즈앱 |
|---|---|---|
| `profile_nickname` | ✅ 사용 가능 | ✅ |
| `profile_image` | ✅ 사용 가능 | ✅ |
| **`account_email`** | ❌ **권한 없음** | ✅ 사용 가능 |
| `name`, `gender`, `age_range`, `phone_number` 등 | ❌ 권한 없음 | ✅ 심사 후 사용 가능 |

→ **개인 개발자 GRIT 앱은 `account_email`을 카카오에 요청할 권한 자체가 없음.**

### 3. 충돌

Supabase가 `account_email`을 자동 요청 + 카카오 앱이 해당 scope 미설정 → 카카오가 "설정하지 않은 동의 항목" 에러 반환 = KOE205.

---

## 지금까지 시도한 해결책

### ✅ 성공한 조치

| # | 조치 | 결과 |
|---|---|---|
| 1 | 카카오 콘솔에 Redirect URI 등록 (`https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback`) | 등록 완료 |
| 2 | 카카오 Client Secret 발급 + 활성화 ON | 완료 |
| 3 | Supabase Auth Providers > Kakao Enabled + Client ID/Secret 입력 | 완료 |
| 4 | Supabase URL Configuration > Redirect URLs에 `grit://**`, `exp://**` 등록 | 완료 |
| 5 | Supabase Sign In/Providers > Allow manual linking ON | 완료 |
| 6 | Supabase Sign In/Providers > Allow anonymous sign-ins ON | 완료 |
| 7 | Supabase Kakao Provider > Allow users without an email ON | 완료 |
| 8 | Supabase Site URL: `http://localhost:3000` → `grit://auth/callback` | 완료 (구글 측 localhost 에러 해결용) |
| 9 | 카카오 동의항목 > `profile_image` "선택 동의"로 설정 | 완료 |
| 10 | `useSocialLogin.ts` 코드 수정: 카카오는 `scopes: 'profile_nickname'`만 요청 | 코드 적용 (효과 미검증) |

### ❌ 해결 불가능한 항목

| 항목 | 사유 |
|---|---|
| `account_email` 동의항목 활성화 | 일반 개발자 앱 권한 없음. **비즈앱 심사 필수** |

---

## 현재 막힌 지점

1. Supabase가 **`account_email` scope를 자동으로 요청**
2. 카카오 앱은 **`account_email` 권한 없음**
3. 양쪽이 안 맞아서 KOE205 지속

**확인 필요한 가설**: 코드의 `scopes: 'profile_nickname'` 옵션이 실제로 Supabase가 카카오에 보내는 scope를 덮어쓰는가?
- `npx expo start --clear`로 캐시 삭제 후 테스트
- 여전히 KOE205면 → Supabase가 server-side에서 scope 강제 → 우회 불가

---

## 해결 옵션

### 옵션 A. 비즈앱 전환 (추천 — 장기적 완전 해결)

**필요 조건:**
- 사업자등록증 (개인사업자도 OK)
- 카카오 비즈니스 계정 등록

**절차:**
1. https://business.kakao.com 접속 → 카카오 비즈니스 계정 생성
2. 카카오 개발자 콘솔 → GRIT 앱 → 비즈니스 인증
3. 사업자 정보 입력 + 약관 동의
4. 카카오 심사 (보통 1~3 영업일)
5. 승인되면 동의항목에서 `account_email` "선택 동의"로 설정 가능
6. Supabase Kakao provider 그대로 사용 → 정상 동작

**장점**: 완전한 표준 OAuth 플로우 사용 가능
**단점**: 사업자 등록 필요, 심사 대기 시간 필요

### 옵션 B. 카카오 일단 제외 (단기 추천)

카카오 버튼을 로그인 화면에서 임시 숨김 또는 비활성화 + 추후 비즈앱 전환 후 부활.

**구현:**
- `app/login.tsx`에서 카카오 버튼 비활성화 또는 "준비중" 표시
- Phase 3-1을 구글 + (나중에) 애플로 진행
- 비즈앱 전환 완료 후 카카오 다시 활성화

**장점**: 5분 내 완료, 다른 기능 개발 진행 가능
**단점**: 한국 사용자에게 카카오 옵션 부재 (대다수가 카카오 선호)

### 옵션 C. 우회책 — 직접 OAuth URL 구성 (비추)

Supabase의 `signInWithOAuth`를 우회하고, 카카오 OAuth URL을 직접 만들어서 호출:

```typescript
const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}` +
  `&redirect_uri=https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback` +
  `&response_type=code&scope=profile_nickname,profile_image`
```

이후 Supabase callback이 카카오 code를 받아서 토큰 교환.

**장점**: 비즈앱 없이도 카카오 사용 가능
**단점**:
- Supabase가 자체 scope 강제하면 마지막 토큰 교환 단계에서 또 실패할 수 있음
- 비표준 우회책이라 향후 Supabase 업데이트 시 깨질 수 있음
- 디버깅 어려움

---

## 추천 액션

### 단기 (오늘 할 일)

1. **앱 재시작 후 카카오 코드 수정 효과 검증** (5분)
   ```bash
   npx expo start --clear
   ```
   - 카카오 로그인 시도
   - 여전히 KOE205면 → Supabase scope 강제 확정
   - 다른 에러면 → 진단 다시

2. **구글 로그인 우선 완성** (Site URL 변경 효과 확인)

3. **카카오 버튼 임시 비활성화** (구글로만 Phase 3-1 마무리)
   - `app/login.tsx`에서 카카오 버튼 disabled 처리
   - 안내 문구: "카카오 로그인은 곧 추가될 예정이에요"
   - `lib/hooks/useSocialLogin.ts`에서도 카카오 provider 실행을 차단해 우발적인 KOE205 재발을 막기

### 중기 (이번주~다음주)

4. **비즈앱 전환 진행**
   - 사업자등록증 준비
   - 카카오 비즈니스 가입
   - 비즈니스 인증 신청
   - 심사 대기

### 장기 (비즈앱 승인 후)

5. **카카오 동의항목 재설정**
   - `account_email` 선택 동의로 활성화
   - `profile_nickname` 필수 동의로 변경 검토

6. **카카오 버튼 부활**
   - `app/login.tsx`에서 disabled 해제

---

## 참고 정보

### 카카오 개발자 앱 정보

- 앱 ID: `1439309`
- 앱 이름: 그릿
- REST API Key: `37aa84584e4ef2312985d57cc4f27b29` (이미 노출됨, 비즈앱 전환 시 재발급 권장)
- 카카오 로그인 활성화: ON
- OpenID Connect: ON
- Redirect URI: `https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback` ✅
- Client Secret: 활성화 ON ✅

### Supabase Kakao Provider 정보

- Project: `lqotquxmmrshikevqnsg` (grit-app)
- Kakao enabled: ON
- REST API Key 입력 완료
- Client Secret 입력 완료
- Allow users without an email: ON
- Callback URL: `https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback`

### 관련 코드 위치

- 소셜 provider 정책: `lib/socialProviders.ts`
- 소셜 로그인 훅: `lib/hooks/useSocialLogin.ts`
- 로그인 화면: `app/login.tsx`
- 인증 컨텍스트: `contexts/AuthContext.tsx`
- 딥링크 헬퍼: `lib/authRedirect.ts`

### 관련 참고 링크

- 카카오 로그인 동의항목 가이드: https://developers.kakao.com/docs/latest/ko/kakaologin/prerequisite#consent-item
- 비즈앱 전환 안내: https://developers.kakao.com/docs/latest/ko/getting-started/app#bizapp
- Supabase Kakao Provider 문서: https://supabase.com/docs/guides/auth/social-login/auth-kakao
- KOE205 에러 코드 설명: https://developers.kakao.com/docs/latest/ko/kakaologin/trouble-shooting

---

## 의사결정 요청

다음 단계를 정해야 함:

- [ ] **A안**: 비즈앱 전환 추진 (1~3일 소요)
- [ ] **B안**: 카카오 비활성화 + 구글 먼저 완성 (즉시 가능)
- [ ] **C안**: 우회책 시도 (불확실, 시간 소요)

대웅의 결정 필요.
