# 카카오/구글 회원가입·로그인 구조 및 설정

## 1. 정상 동작을 위한 전체 구조

```
[사용자] → [루카바둑 화면] → [서버 server.js] → [카카오/구글 OAuth] → [서버 callback] → [루카바둑 화면 + 토큰]
```

### 단계별 흐름

| 단계 | 주체 | 동작 |
|------|------|------|
| 1 | 사용자 | 로그인/회원가입 탭에서 「카카오로 로그인」 또는 「구글 계정으로 가입」 클릭 |
| 2 | 브라우저 | `GET /api/auth/kakao` 또는 `GET /api/auth/google` 요청 (같은 도메인) |
| 3 | **서버(server.js)** | 환경변수에 CLIENT_ID가 있으면 **리다이렉트 URL** 생성 후 카카오/구글 인증 페이지로 **302 리다이렉트** |
| 4 | 카카오/구글 | 사용자 로그인·동의 후 **callback URL**로 `?code=...&state=...` 붙여 리다이렉트 |
| 5 | **서버(server.js)** | `GET /api/auth/kakao/callback` 또는 `.../google/callback` 수신 → **code로 액세스 토큰 교환** → 사용자 정보 조회 → **자체 토큰 발급** → `lukabaduk.html?token=...&user=...` 로 302 리다이렉트 |
| 6 | **클라이언트(lukabaduk-multiplayer.js)** | `handleOAuthCallback()`에서 `token`, `user` 쿼리 파라미터 확인 → 저장 후 로그인 처리 |

즉, **반드시 커스텀 서버(node server.js)가 떠 있어야** 합니다. Next만 단독 실행(`next dev`)하면 `/api/auth/*` 라우트가 없어서 소셜 로그인이 동작하지 않습니다.

---

## 2. 서버에서 필요한 것

### 2.1 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| **KAKAO_CLIENT_ID** | 카카오 사용 시 | 카카오 개발자 콘솔에서 발급한 앱 키(JavaScript 키 또는 REST API 키) |
| **KAKAO_CLIENT_SECRET** | 선택(비공개 앱이면 필수) | 카카오 개발자 콘솔 → 앱 설정 → 보안 → Client Secret |
| **GOOGLE_CLIENT_ID** | 구글 사용 시 | Google Cloud Console에서 만든 OAuth 2.0 클라이언트 ID |
| **GOOGLE_CLIENT_SECRET** | **구글은 필수** | 같은 OAuth 클라이언트의 Client Secret |

- 이 값들은 **server.js**가 기동할 때 `process.env`에서 읽습니다.
- 설정하지 않으면 `KAKAO_CLIENT_ID` / `GOOGLE_CLIENT_ID`가 빈 문자열이 되어, 소셜 로그인 버튼을 눌렀을 때 **`oauth_error=not_configured`** 로 돌아오거나 리다이렉트가 일어나지 않습니다.

### 2.2 리다이렉트 URL (서버가 사용하는 주소)

서버는 `getBaseUrl(req)`로 `http(s)://(host):(port)`를 만들고, 아래 경로를 **리다이렉트 URI**로 사용합니다.

- **카카오**: `{base}/api/auth/kakao/callback`  
  예: `http://localhost:3000/api/auth/kakao/callback`
- **구글**: `{base}/api/auth/google/callback`  
  예: `http://localhost:3000/api/auth/google/callback`

`base`는 **실제 접속 주소**입니다. 예를 들어:

- 브라우저에서 `http://localhost:3000/lukabaduk.html` 로 접속 → `base = http://localhost:3000`
- `http://127.0.0.1:3000`으로 접속 → `base = http://127.0.0.1:3000`

따라서 **localhost로 테스트하면** 카카오/구글 콘솔에 등록하는 리다이렉트 URI도 **반드시** `http://localhost:3000/...` 이어야 하고,  
**127.0.0.1로 접속해 쓰려면** `http://127.0.0.1:3000/...` 도 등록해야 합니다.

---

## 3. 카카오/구글 쪽 설정 (필수)

### 3.1 카카오 개발자 콘솔

1. [Kakao Developers](https://developers.kakao.com/) 로그인 후 앱 생성/선택.
2. **앱 키**: JavaScript 키 또는 REST API 키 → 이 값을 **KAKAO_CLIENT_ID**에 넣습니다.
3. **플랫폼** → **Web** 등록:
   - 사이트 도메인: 로컬 테스트 시 `http://localhost:3000` (필요 시 `http://127.0.0.1:3000` 추가).
4. **카카오 로그인** → **활성화 ON**.
5. **Redirect URI**에 아래를 **그대로** 등록:
   - `http://localhost:3000/api/auth/kakao/callback`
   - (127.0.0.1로 접속할 경우) `http://127.0.0.1:3000/api/auth/kakao/callback`
6. **동의 항목**: 프로필(닉네임 등), 이메일 등 필요한 항목 활성화.

Redirect URI가 한 글자라도 다르면(끝 슬래시 유무, 포트, http/https 등) 카카오가 **redirect_uri_mismatch** 등 오류를 반환합니다.

### 3.2 Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 선택/생성.
2. **API 및 서비스** → **사용자 인증 정보** → **사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**.
3. 애플리케이션 유형: **웹 애플리케이션**.
4. **승인된 리디렉션 URI**에 아래를 **그대로** 추가:
   - `http://localhost:3000/api/auth/google/callback`
   - (127.0.0.1 사용 시) `http://127.0.0.1:3000/api/auth/google/callback`
5. 클라이언트 ID → **GOOGLE_CLIENT_ID**, Client Secret → **GOOGLE_CLIENT_SECRET**에 넣습니다.  
   구글은 **authorization_code** 방식에서 **client_secret**이 필수이므로, **GOOGLE_CLIENT_SECRET**을 반드시 설정해야 합니다.

---

## 4. 루카바둑에서 잘 동작하지 않을 때 점검할 것

| 현상 | 원인 | 조치 |
|------|------|------|
| 버튼 눌러도 카카오/구글 로그인 화면으로 안 넘어감 | **KAKAO_CLIENT_ID** 또는 **GOOGLE_CLIENT_ID**가 비어 있음 | `.env` 또는 실행 시 환경변수에 CLIENT_ID 설정. **반드시 node server.js(또는 pnpm dev)로 실행**했는지 확인. |
| 카카오/구글 로그인 후 “redirect_uri 불일치” 오류 | 카카오/구글 콘솔에 등록한 Redirect URI와 서버가 보내는 값이 다름 | 접속 주소와 동일한 **정확한** URI를 콘솔에 등록 (예: `http://localhost:3000/api/auth/kakao/callback`). 브라우저 주소창이 `127.0.0.1`이면 `http://127.0.0.1:3000/...` 도 등록. |
| 구글 로그인 후 토큰 교환 단계에서 실패 | **GOOGLE_CLIENT_SECRET** 미설정 | Google Cloud Console에서 Client Secret 복사 후 **GOOGLE_CLIENT_SECRET** 환경변수 설정. |
| “missing required error components, refreshing…” | Next.js 에러 UI 관련(이전 대화에서 처리함) | `app/error.tsx`, `app/global-error.tsx` 존재 여부 확인. |
| 로그인/콜백 후에도 로그인 안 된 것처럼 보임 | 토큰/유저 저장 실패 또는 쿼리 제거 실패 | 브라우저 개발자 도구 → 콘솔/네트워크에서 `lukabaduk.html?token=...` 리다이렉트와 `handleOAuthCallback` 동작 확인. |

---

## 5. 로컬에서 빠르게 확인하는 방법

1. **서버를 커스텀 서버로 실행**  
   `lukabaduk` 폴더에서:
   ```bash
   node server.js
   ```
   또는:
   ```bash
   pnpm dev
   ```

2. **환경변수 설정**  
   프로젝트 루트에 `.env` 파일을 만들고 (또는 실행 전 export/set):
   ```env
   KAKAO_CLIENT_ID=발급받은_카카오_앱_키
   KAKAO_CLIENT_SECRET=  # 필요 시 입력
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
   ```
   `.env.example`을 복사해 `.env`로 저장한 뒤 값을 채우면 됩니다. 서버는 `dotenv`로 `.env`를 자동 로드합니다.
   Windows PowerShell에서 한 번만 쓸 때:
   ```powershell
   $env:KAKAO_CLIENT_ID="발급받은_앱_키"
   $env:GOOGLE_CLIENT_ID="..."; $env:GOOGLE_CLIENT_SECRET="..."
   node server.js
   ```

3. **브라우저 주소 통일**  
   항상 **같은 주소**로 접속 (예: `http://localhost:3000/lukabaduk.html`).  
   카카오/구글 콘솔의 Redirect URI도 이 호스트/포트와 **완전히 동일**하게 맞춥니다.

4. **콜백 후**  
   정상이면 `http://localhost:3000/lukabaduk.html?token=...&user=...` 로 왔다가, 스크립트가 쿼리를 제거하고 토큰을 저장한 뒤 로그인된 상태로 보여야 합니다.

이 문서와 위 항목을 기준으로 하면, 카카오/구글 회원가입·로그인이 **어떤 구조**로 동작해야 하고, **왜 안 될 수 있는지**를 순서대로 짚을 수 있습니다.
