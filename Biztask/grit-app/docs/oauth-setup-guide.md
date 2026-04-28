# GRIT 소셜 로그인 OAuth 설정 가이드

> 대상: 대웅 / 작성일: 2026-04-23
> 목표: 카카오·구글 로그인을 Supabase 대시보드에 연결해서 앱에서 소셜 로그인이 동작하도록 준비
> 예상 소요: 카카오 20분 + 구글 20분 = **총 40분**

---

## 🎯 이 가이드가 끝나면

- Supabase 대시보드의 Authentication → Providers 화면에 **카카오·구글 토글이 켜지고 초록불**이 들어옴
- GRIT 앱에서 `supabase.auth.signInWithOAuth({ provider: 'kakao' })` 같은 한 줄로 로그인 가능
- 일단 여기까지가 "OAuth 준비 끝". 실제 로그인 UI·버튼은 내가 이어서 코드로 붙일 거임

---

## 📋 체크리스트 (진행 상황 표시용)

**카카오**
- [ ] 1-1. developers.kakao.com 로그인 확인
- [ ] 1-2. 애플리케이션 생성 (앱 이름: GRIT)
- [ ] 1-3. 카카오 로그인 활성화
- [ ] 1-4. Redirect URI 등록 (Supabase 콜백 주소)
- [ ] 1-5. 동의 항목에 닉네임·이메일 추가
- [ ] 1-6. REST API 키 + Client Secret 메모
- [ ] 1-7. Supabase Dashboard에 입력 + 토글 ON

**구글**
- [ ] 2-1. Google Cloud Console 프로젝트 생성
- [ ] 2-2. OAuth 동의 화면 설정 (External, 테스트 모드)
- [ ] 2-3. OAuth 클라이언트 ID 발급 (Web 타입)
- [ ] 2-4. Redirect URI 등록
- [ ] 2-5. Client ID + Client Secret 메모
- [ ] 2-6. Supabase Dashboard에 입력 + 토글 ON

---

## 🔑 미리 알아둬야 할 핵심 값

진행 중에 여러 번 쓰게 될 값들. 미리 메모장에 열어두면 편해.

| 항목 | 값 |
|---|---|
| **Supabase 프로젝트 URL** | `https://lqotquxmmrshikevqnsg.supabase.co` |
| **Supabase 콜백 URL** (모든 provider 공통) | `https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback` |
| **앱 이름** | GRIT |
| **앱 설명** (동의 화면용) | 자영업 사장님 익명 커뮤니티 |

---

# Part 1. 카카오 로그인 설정

## 1-1. 카카오 개발자 로그인

1. 브라우저에서 https://developers.kakao.com 접속
2. 우상단 "로그인" → 카카오 계정으로 로그인
3. 첫 로그인이면 약관 동의 + 개발자 정보 입력 (실명·연락처)

## 1-2. 애플리케이션 생성

1. 상단 메뉴 → **내 애플리케이션** 클릭
2. **애플리케이션 추가하기** 버튼
3. 입력 값:
   - **앱 이름**: `GRIT`
   - **회사명**: `Anarchy` (또는 본인 상호)
   - **카테고리**: `라이프스타일` 또는 `커뮤니티/SNS`
4. **저장** 클릭
5. 앱 생성되면 좌측 메뉴에 여러 항목이 뜸 (요약 정보, 앱 설정, 플랫폼, 카카오 로그인 ...)

## 1-3. 카카오 로그인 활성화

1. 좌측 메뉴 → **제품 설정 > 카카오 로그인**
2. 상단 **활성화 설정** 스위치 → **ON**
3. 경고 팝업 뜨면 확인

## 1-4. Redirect URI 등록 (⚠️ 가장 중요)

1. 같은 페이지 (카카오 로그인) 하단에 **Redirect URI** 섹션이 있음
2. **Redirect URI 등록** 버튼
3. 아래 값을 정확히 붙여넣기:

   ```
   https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback
   ```

4. **저장**

> 💡 오타 하나라도 나면 로그인이 `redirect_uri_mismatch` 에러를 뱉고 통째로 안 됨. 복붙 권장.

## 1-5. 동의 항목 설정 (닉네임·이메일)

1. 좌측 메뉴 → **카카오 로그인 > 동의항목**
2. **닉네임 (profile_nickname)** 찾아서 **설정** → **필수 동의** 선택 → 저장
3. **카카오계정(이메일)** 찾아서 **설정** → **선택 동의**로 두고 저장
   - "이용 목적" 입력 칸에는 `계정 식별 및 연락 수단`으로 적어둬
   - 필수 동의는 심사가 필요해서 일단 선택 동의만 먼저 설정

## 1-6. REST API 키 + Client Secret 확인

**REST API 키:**

1. 좌측 메뉴 → **앱 설정 > 요약 정보** (또는 맨 처음 앱 페이지)
2. **앱 키** 섹션의 **REST API 키** 값 복사 → 메모장에 저장
   - 32자 영숫자 (예: `abc123...`)

**Client Secret:**

1. 좌측 메뉴 → **제품 설정 > 카카오 로그인 > 보안**
2. **Client Secret** 섹션에서 **코드 생성**
3. 생성된 Secret 값 복사 → 메모장에 저장
4. **활성화 상태: 사용함**으로 반드시 토글
5. 저장

> ⚠️ Client Secret은 한 번 생성하면 다시 표시 안 되니까 지금 꼭 메모.

## 1-7. Supabase Dashboard에 카카오 입력

1. 새 탭에서 https://supabase.com/dashboard 접속
2. GRIT 프로젝트 선택
3. 좌측 사이드바 → **Authentication** (자물쇠 아이콘)
4. 상단 **Providers** 탭 (또는 Sign In / Up 섹션)
5. 스크롤 내려서 **Kakao** 찾기 → 클릭해서 펼침
6. 입력:
   - **Kakao enabled**: 토글 **ON**
   - **Kakao Client ID**: 위에서 메모한 **REST API 키**
   - **Kakao Client Secret**: 위에서 메모한 **Client Secret**
7. **Callback URL for OAuth** 값이 자동으로 `https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback` 으로 표시되는지 확인 (카카오에 등록한 것과 동일해야 함)
8. **Save** 버튼

> ✅ **카카오 완료 신호**: 토글이 녹색으로 켜져 있고, 저장 후 페이지 새로고침 했을 때 Client ID가 그대로 들어가 있으면 끝.

---

# Part 2. 구글 로그인 설정

## 2-1. Google Cloud Console 프로젝트 생성

1. https://console.cloud.google.com 접속 (구글 계정 필요)
2. 상단 프로젝트 드롭다운 (보통 "프로젝트 선택" 또는 최근 프로젝트명 표시) 클릭
3. 우상단 **새 프로젝트** 클릭
4. 입력:
   - **프로젝트 이름**: `grit-app`
   - **조직**: (기본값 그대로)
5. **만들기** → 1~2분 기다림
6. 생성 완료 알림 뜨면 **프로젝트 선택** 클릭 (또는 상단 드롭다운에서 `grit-app` 선택)

## 2-2. OAuth 동의 화면 설정

1. 좌측 햄버거 메뉴 → **API 및 서비스 > OAuth 동의 화면**
2. **User Type: External** 선택 → **만들기**
3. **앱 정보** 입력:
   - **앱 이름**: `GRIT`
   - **사용자 지원 이메일**: 본인 이메일 (soul1803@gmail.com)
   - **앱 로고**: (건너뛰기 - 나중에 추가 가능)
4. **앱 도메인**: (전부 비워둬도 OK, 테스트 단계에서는 선택사항)
5. **개발자 연락처 정보**: 본인 이메일
6. **저장 후 계속**
7. **범위(Scopes)** 페이지:
   - **범위 추가 또는 삭제** → `email`, `profile`, `openid` 세 개 체크 → **업데이트**
   - **저장 후 계속**
8. **테스트 사용자** 페이지:
   - **+ ADD USERS** → 본인 구글 이메일 추가
   - (테스트 단계에서는 여기 추가된 사람만 로그인 가능. 나중에 "게시 상태" 변경하면 전체 공개)
   - **저장 후 계속**
9. **요약** 페이지 → **대시보드로 돌아가기**

> 💡 "게시 상태: 테스트 중" 단계에서는 동의 화면에 경고가 뜨고 100명까지만 로그인 가능. 앱이 어느 정도 안정되면 "앱 게시" 눌러서 심사 거치면 무제한 공개됨. 지금은 테스트 모드로도 충분.

## 2-3. OAuth 클라이언트 ID 발급

1. 좌측 메뉴 → **API 및 서비스 > 사용자 인증 정보**
2. 상단 **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. **애플리케이션 유형**: **웹 애플리케이션** 선택
   - (Expo가 웹 OAuth 플로우를 거쳐서 앱으로 리디렉션하는 방식이라 Web으로 하는 게 맞음)
4. **이름**: `GRIT Web OAuth`
5. **승인된 JavaScript 출처**: 비워두기 (나중에 웹 버전 만들면 추가)
6. **승인된 리디렉션 URI**:
   - **+ URI 추가**
   - 값:
     ```
     https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback
     ```
7. **만들기** 버튼
8. 생성 완료 팝업에서 **클라이언트 ID**와 **클라이언트 보안 비밀** 두 값 모두 복사 → 메모장에 저장
   - Client ID는 `xxxxx.apps.googleusercontent.com` 형태
   - Client Secret은 `GOCSPX-xxxxx` 형태

## 2-4. Supabase Dashboard에 구글 입력

1. Supabase Dashboard → **Authentication > Providers**
2. **Google** 찾기 → 펼치기
3. 입력:
   - **Google enabled**: 토글 **ON**
   - **Client IDs**: 위에서 복사한 **Client ID**
   - **Client Secret (for OAuth)**: 위에서 복사한 **Client Secret**
4. **Skip nonce check**: 체크 해제 (기본값 유지)
5. **Save** 버튼

> ✅ **구글 완료 신호**: 토글 녹색, 저장 후 새로고침 시 Client ID 남아있으면 끝.

---

# Part 3. Supabase 추가 설정 (⚠️ 빠뜨리면 딥링크 안 됨)

Kakao/Google 키 등록만 끝내면 **브라우저에서 로그인은 되지만 앱으로 안 돌아옴**. 앱 복귀용 딥링크 허용 2가지 설정이 더 필요해.

## 3-1. Redirect URLs 허용 목록

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Redirect URLs** 섹션에서 **Add URL** 버튼
3. 아래 2개 각각 추가:

   ```
   grit://**
   ```

   ```
   exp://**
   ```

   > 💡 `grit://**` 은 프로덕션 빌드에서 앱으로 돌아올 때, `exp://**` 는 Expo Go로 개발할 때 필요. 와일드카드 `**` 를 꼭 붙여야 쿼리스트링 포함 매칭됨.

4. **Save**

## 3-2. Manual Linking 활성화 (linkIdentity 허용)

익명 세션 → 소셜 업그레이드 기능을 쓰려면 이 토글이 켜져있어야 해.

1. Supabase Dashboard → **Authentication** → **Sign In / Providers** (맨 위쪽) 또는 **Settings**
2. **Manual linking** 항목 찾기
3. **Enable Manual Linking**: **ON**
4. **Save**

> 💡 이게 꺼져있으면 `auth.linkIdentity()` 호출 시 `Manual linking is disabled` 에러 발생.

---

# Part 4. 최종 확인 체크리스트

Supabase Dashboard에서:

**Providers 탭:**
- ✅ **Email** (기본, 켜져있음)
- ✅ **Anonymous Sign-ins** (이전 스텝에서 켬)
- ✅ **Kakao** (방금 켬)
- ✅ **Google** (방금 켬)

**URL Configuration:**
- ✅ **Redirect URLs** 에 `grit://**` 와 `exp://**` 둘 다 등록

**Settings:**
- ✅ **Manual Linking**: ON

이 6개가 모두 되어있으면 **완료**.

---

# 🆘 문제 해결 FAQ

### Q1. "redirect_uri_mismatch" 에러가 뜸
- **원인**: 카카오/구글에 등록한 Redirect URI와 Supabase가 실제 요청하는 URL이 다름
- **해결**: Redirect URI 값을 정확히 `https://lqotquxmmrshikevqnsg.supabase.co/auth/v1/callback`으로 등록했는지 재확인 (맨 앞/뒤 공백 없이, 슬래시 빠뜨리지 말고)

### Q2. 카카오 로그인 동의 화면이 안 뜸
- **원인**: 동의 항목 설정 안 함
- **해결**: 카카오 개발자 콘솔 → 카카오 로그인 → 동의항목에서 닉네임 필수 설정

### Q3. Supabase에 저장했는데 다음 날 다시 들어가 보니 빈칸이 됨
- **원인**: Save 안 누르고 페이지 떠남
- **해결**: 저장 버튼 누른 후 페이지 새로고침해서 값 남아있는지 반드시 확인

### Q4. 구글 "앱이 확인되지 않음" 경고가 떠
- **원인**: OAuth 동의 화면이 "테스트 모드"인데 본인 계정이 테스트 사용자로 안 들어감
- **해결**: Google Cloud Console → OAuth 동의 화면 → 테스트 사용자에 로그인하려는 구글 이메일 추가
- **대안**: 심사 후 "앱 게시" 상태로 바꾸면 경고 없어짐 (초기엔 테스트 사용자 추가가 빠름)

### Q5. 애플은 왜 안 해요?
- 애플 개발자 계정($99/년)이 필요해서 이번 스프린트에는 제외
- iOS 스토어 출시 전에는 반드시 필요하니 그전에 결제·등록 필요
- 계정 생기면 이 가이드에 Part 3으로 추가해줄게

---

# 🚀 이 가이드 끝나면 뭐 해?

위 체크리스트 **전부 ✅ 되면** 나한테 "OAuth 키 등록 끝"이라고 알려줘. 그러면:

1. **G-1-c**: Expo OAuth 라이브러리 설치 + 딥링크 설정 (내가 작업)
2. **G-1-d**: 로그인 화면 + 소셜 로그인 훅 (내가 작업)
3. **G-1-e**: 온보딩 닉네임 입력 화면 (내가 작업)
4. **G-1-f**: 마이페이지 DB 연동 (내가 작업)
5. **G-1-g**: 로그아웃/계정 전환 (내가 작업)

여기까지 끝나면 **1순위 (로그인+마이페이지) 완료**. 실제 휴대폰에서 카카오·구글 버튼 눌러서 로그인 되는 상태가 됨.

---

# 📞 막히면?

각 스텝에서 "이 메뉴 어디 있어?" 싶으면 바로 물어봐. 스크린샷 첨부해도 OK.
