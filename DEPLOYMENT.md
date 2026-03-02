# 배포 체크리스트

## ✅ 배포 전 확인 사항

### 1. 파일 확인
- ✅ `public/lukabaduk.html` 존재
- ✅ `public/lukabaduk-game.js` 존재
- ✅ 헤더에 "게임하기" 메뉴 추가됨
- ✅ 푸터에 "게임하기" 링크 추가됨

### 2. Git 커밋
```bash
# 변경된 파일 확인
git status

# 모든 변경사항 추가
git add .

# 커밋
git commit -m "Add lukabaduk game to website"

# GitHub에 푸시
git push origin main
```

### 3. Vercel 배포
1. GitHub 저장소에 코드가 푸시되어 있는지 확인
2. Vercel 대시보드에서 프로젝트 연결
3. 자동 배포 또는 수동 배포

### 4. 배포 후 확인
- [ ] 메인 페이지 접속: `https://your-domain.vercel.app/`
- [ ] 게임 페이지 접속: `https://your-domain.vercel.app/lukabaduk.html`
- [ ] 헤더 "게임하기" 클릭 → 새 탭에서 게임 열림
- [ ] 게임 내 "← 메인으로" 링크 작동 확인

## 📝 참고사항

- Next.js는 `public/` 폴더의 파일을 루트 경로(`/`)에서 서빙합니다
- `/lukabaduk.html` → `public/lukabaduk.html` 파일
- 절대 경로(`/lukabaduk-game.js`, `/lukabaduk-multiplayer.js`)를 사용하므로 배포 환경에서도 정상 작동합니다

---

## ⚠️ Vercel 배포 시 반드시 확인 (멀티플레이어)

이 프로젝트는 **커스텀 Node 서버**(`server.js`)로 Next.js + **Socket.IO**를 함께 띄웁니다.

- **Vercel은 커스텀 서버를 실행하지 않습니다.**  
  저장소를 연결하면 `next build`만 실행하고, **`server.js`는 실행되지 않습니다.**

| 항목 | Vercel에 올렸을 때 | 로컬(`node server.js`) |
|------|---------------------|--------------------------|
| 메인/Next.js 페이지 | ✅ 동작 | ✅ 동작 |
| `/lukabaduk.html` (게임 페이지) | ✅ 열림 | ✅ 열림 |
| **실시간 멀티플레이어** (방 목록, 대국실, 2인 대국) | ❌ **동작 안 함** | ✅ 동작 |
| 로그인/회원가입 API (`/api/register`, `/api/login`) | ❌ 커스텀 서버 경로라 서버리스에 없음 | ✅ 동작 |

- **로컬처럼 전부 동작하게 하려면** Node 서버를 켜 둘 수 있는 곳에 배포해야 합니다.  
  예: **Railway**, **Render**, **Fly.io**, **VPS** 등에서 `npm run build` 후 `npm start`(또는 `node server.js`)로 실행하면 됩니다.
- Node 서버 배포 시 **환경 변수** 설정 권장: `TOKEN_SECRET`(JWT 비밀키, 기본값은 개발용이라 프로덕션에서는 반드시 변경), `PORT`(호스트가 지정하는 경우 그대로 사용).

### 배포 후 체크 (Vercel에 올린 경우)

- [ ] 메인 페이지 접속
- [ ] `/lukabaduk.html` 접속 → 페이지는 열리지만 **「경기하기」→ 방 목록/실시간 대국은 연결 실패**될 수 있음 (정상 동작이 아님)
- 멀티플레이어까지 필요하면 **Railway/Render 등**에 별도 배포 후, 클라이언트에서 해당 서버 주소로 접속하도록 설정 필요

### 배포 후 체크 (Railway/Render 등 Node 서버로 올린 경우)

- [ ] 메인 페이지 접속
- [ ] `/lukabaduk.html` 접속
- [ ] 로그인/회원가입
- [ ] 경기하기 → 방 목록 조회, 방 생성/입장, 2인 대국이 로컬처럼 동작하는지 확인
- [ ] **혼자두기 → AI와 두기**: 서버에 GNU Go 미설정 시에도 **브라우저 MCTS**로 자동 폴백되어 동작함. GNU Go 사용하려면 호스트에 Linux용 gnugo 설치 후 `GTP_ENGINE_PATH_GNUGO` 환경변수 설정.
