# 루카바둑 온라인 2인 대국

웹에 접속한 2명이 실시간으로 루카바둑을 두는 멀티플레이어 게임입니다.

## ⚠️ 서버는 1개만 띄우면 됩니다 (채팅용 별도 서버 없음)

- **웹 페이지**와 **채팅·대국·관람**은 **같은 서버 한 개**에서 모두 동작합니다.
- 채팅을 위해 별도 서버를 띄울 필요가 **없습니다**.
- `server.js` 한 번 실행 = 웹 제공 + Socket.IO(채팅, 대국실, 관람) 모두 처리.

## 구조 변경 사항

### 추가된 파일

- **`server.js`** - 웹 서버 + Socket.IO 한 번에 (Next.js와 통합)
- **`lib/game-logic-server.js`** - 서버용 게임 로직 (JavaScript)
- **`lib/game-logic.ts`** - 클라이언트용 게임 로직 (TypeScript, 향후 사용 가능)
- **`public/lukabaduk-multiplayer.js`** - 멀티플레이어 클라이언트 코드

### 수정된 파일

- **`public/lukabaduk.html`** - 온라인 2인 대국 UI로 변경
- **`package.json`** - Socket.io 의존성 추가, dev 스크립트는 `node server.js` 실행

## 실행 방법

### 개발 환경

**반드시** 아래 중 하나로만 실행하세요. (`next dev`만 단독 실행하면 Socket.IO가 없어 채팅·대국·관람이 동작하지 않습니다.)

```bash
# lukabaduk 폴더에서
node server.js
```

또는 (pnpm 사용 시):

```bash
pnpm dev
```

서버가 `http://localhost:3000`에서 실행됩니다. 브라우저에서 **같은 주소** `http://localhost:3000/lukabaduk.html` 로 접속하세요.

### 잘 안 될 때

- **채팅/관람이 안 된다** → `next dev`가 아닌 **`node server.js`**(또는 `pnpm dev`)로 실행 중인지 확인하세요.
- **포트가 겹친다** → 이미 3000번을 쓰는 프로세스를 종료한 뒤 다시 실행하세요.

### 사용 방법

1. 브라우저에서 `http://localhost:3000/lukabaduk.html` 접속
2. **방 만들기**: 판 크기 선택 후 "방 만들기" 클릭 → 방 코드 생성
3. **방 입장**: 다른 브라우저/기기에서 같은 URL 접속 → 방 코드 입력 후 "방 입장"
4. 두 명이 모두 입장하면 게임 시작
5. 각자 차례에만 착수/패스/무르기 가능

## 배포 시 주의사항

### Vercel 배포

Vercel은 WebSocket을 직접 지원하지 않으므로:

1. **옵션 1**: 별도 서버 배포 (Railway, Render, Fly.io 등)
   - `server.js`를 별도 서버에서 실행
   - 클라이언트에서 해당 서버 주소로 Socket.io 연결

2. **옵션 2**: Vercel Serverless Functions + 외부 WebSocket 서비스
   - Pusher, Ably 등 사용

### 환경 변수

- `PORT`: 서버 포트 (기본: 3000)
- `HOSTNAME`: 서버 호스트 (기본: localhost)
- `NODE_ENV`: 환경 (development/production)

## 게임 흐름

1. **방 만들기**: 첫 번째 플레이어가 방 생성 → 흑(BLACK=1) 배정
2. **방 입장**: 두 번째 플레이어가 방 코드로 입장 → 백(WHITE=2) 배정
3. **게임 시작**: 서버가 초기 상태 생성 후 두 클라이언트에 브로드캐스트
4. **수 두기**: 클라이언트가 서버로 요청 → 서버가 규칙 검증 후 상태 갱신 → 두 클라이언트에 브로드캐스트
5. **패스/무르기**: 동일한 흐름

## 기술 스택

- **서버**: Node.js + Socket.io
- **클라이언트**: Vanilla JavaScript + Socket.io Client
- **프레임워크**: Next.js (정적 파일 서빙)
