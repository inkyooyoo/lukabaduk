# 멀티플레이어 동작을 위한 Node 서버 배포 가이드

Socket.IO + Next.js를 함께 쓰는 이 프로젝트는 **Node 서버를 24시간 띄우는 호스팅**에 배포해야 멀티플레이어가 동작합니다.

---

## 추천 순서

| 순위 | 서비스 | 장점 | 무료 한도 |
|------|--------|------|-----------|
| 1 | **Railway** | 설정 간단, WebSocket 지원, GitHub 연동 | 월 $5 크레딧 (소규모에 충분) |
| 2 | **Render** | 무료 플랜, GitHub 자동 배포 | 무료 시 15분 비활성 시 슬립 (첫 요청 시 깨움) |
| 3 | **Fly.io** | 글로벌 리전, 성능 좋음 | 소규모 무료 |

**가장 빠르게 쓰기 좋은 곳: Railway.**  
무료로 시작하고, 트래픽이 늘면 유료 전환하면 됩니다.

---

## 방법 1: Railway로 배포 (추천)

### 1) Railway 가입 및 프로젝트 생성

1. [railway.app](https://railway.app) 가입 (GitHub 로그인 권장).
2. **New Project** → **Deploy from GitHub repo** 선택.
3. `my-awesome-shoppingmall` 저장소 선택, **main** 브랜치.

### 2) 빌드/실행 설정

Railway는 Node 프로젝트를 감지해 **Build / Start**를 자동으로 잡습니다. 필요할 때만 아래처럼 덮어쓰면 됩니다.

- **Build Command** (비워두면 자동):  
  `npm install` 또는 `npm ci && npm run build`  
  (Next.js 빌드가 필요하므로, 자동이 Next 빌드를 안 하면 `npm ci && npm run build` 로 설정)
- **Start Command** (비워두면 `npm start` 사용):  
  `npm start`  
  (`package.json`의 `start` 스크립트가 실행됨)
- **Root Directory**: 비워두면 저장소 루트 = 프로젝트 루트.

**최소 설정:**

- **Settings → Variables** (환경 변수):
  - `TOKEN_SECRET` = **본인이 정한 긴 랜덤 문자열** (JWT 비밀키, 프로덕션에서 반드시 설정)
- 배포 후 502/빌드 실패가 나면 **Settings → Build**에서 Build Command를 `npm ci && npm run build` 로 명시.

### 3) 도메인 부여

- **Settings → Networking → Generate Domain** 클릭.
- `https://xxxx.up.railway.app` 형태의 URL이 생깁니다.

### 4) 배포 후 확인

- `https://xxxx.up.railway.app` → 메인 페이지.
- `https://xxxx.up.railway.app/lukabaduk.html` → 게임.
- 로그인/회원가입 후 **경기하기** → 방 목록·실시간 대국이 로컬처럼 동작하는지 확인.

---

## 방법 2: Render로 배포 (무료 플랜)

### 1) Render 가입 및 서비스 생성

1. [render.com](https://render.com) 가입 (GitHub 연동 권장).
2. **Dashboard → New + → Web Service**.
3. 저장소 `my-awesome-shoppingmall` 연결, 브랜치 **main**.

### 2) 설정

- **Runtime**: Node.
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: Free (또는 유료).

### 3) 환경 변수

- **Environment**:  
  - `NODE_ENV` = `production`  
  - `TOKEN_SECRET` = **본인이 정한 긴 랜덤 문자열**

### 4) 주의 (무료 플랜)

- 15분 동안 요청이 없으면 인스턴스가 **슬립**합니다.
- 다음 접속 시 **첫 로딩이 30초~1분** 걸릴 수 있습니다.
- 항상 켜 두려면 유료 플랜 사용.

---

## 공통: 빌드/실행 요약

로컬에서 다음이 되면, 위 서비스에서도 같은 방식으로 동작합니다.

```bash
# 의존성 설치
npm install

# Next.js 빌드 (서버 실행 전 한 번)
npm run build

# 서버 실행 (Next + Socket.IO)
npm start
```

- `npm start`는 `NODE_ENV=production node server.js`를 실행합니다 (Linux/Mac 기준).
- Railway/Render는 Linux 환경이므로 그대로 사용 가능합니다.

---

## 환경 변수 정리

| 변수 | 필수 | 설명 |
|------|------|------|
| `TOKEN_SECRET` | ✅ 권장 | JWT 서명용 비밀키. 프로덕션에서는 반드시 긴 랜덤 문자열로 설정. |
| `PORT` | ❌ | 호스팅이 지정해 주면 그대로 사용 (Railway/Render는 자동). |
| `NODE_ENV` | ❌ | 보통 호스팅이 `production`으로 설정. |

---

## 배포 후 체크리스트

- [ ] 메인 페이지 접속
- [ ] `/lukabaduk.html` 접속
- [ ] 회원가입 / 로그인
- [ ] **경기하기** → 방 목록 보임
- [ ] 방 생성 또는 입장 → 두 명이서 실시간 대국 가능
- [ ] 대국실 현황에서 미니보드·황색돌·플레이어 이름 표시 확인

---

## 문제 발생 시

- **Socket 연결 실패**: 배포 URL이 HTTPS인지, 브라우저 콘솔에 CORS/WebSocket 에러가 없는지 확인.
- **빌드 실패**: 로컬에서 `npm run build`가 성공하는지 먼저 확인.
- **502 Bad Gateway**: Start Command가 `npm start`인지, `TOKEN_SECRET`이 설정돼 있는지 확인.

이 가이드대로 배포하면 로컬에서 하던 것처럼 **멀티플레이어가 동작**합니다.
