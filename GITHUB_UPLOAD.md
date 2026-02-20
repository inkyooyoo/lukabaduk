# GitHub 업로드 가이드

**저장소:** https://github.com/inkyooyoo/my-awesome-shoppingmall.git

---

## 현재 상태

- ✅ Git 초기화됨
- ✅ 원격(origin)이 이미 위 주소로 연결됨
- 📌 업로드 대기: 수정된 파일 + 새 파일(public/, DEPLOYMENT.md)

---

## 업로드 절차 (3단계)

### 1단계: 변경사항 스테이징

```powershell
cd C:\Users\inkyo\.cursor\dev\cursorstudy\company-introduction-website

git add .
```

- `components/footer.tsx`, `components/header.tsx` (게임하기 메뉴)
- `public/lukabaduk.html`, `public/lukabaduk-game.js` (루카바둑 게임)
- `DEPLOYMENT.md`, `next-env.d.ts` 등 모두 스테이징됩니다.

---

### 2단계: 커밋

```powershell
git commit -m "루카바둑 게임 추가 및 메뉴 연동"
```

원하는 메시지로 바꿔도 됩니다. 예:
- `"Add lukabaduk game and menu links"`
- `"feat: 루카바둑 웹 게임 및 배포 준비"`

---

### 3단계: GitHub에 푸시

```powershell
git push origin main
```

- 브랜치 이름이 `master`라면: `git push origin master`
- 처음 푸시 시 GitHub 로그인(또는 토큰)이 필요할 수 있습니다.

---

## 한 번에 실행 (복사해서 터미널에 붙여넣기)

```powershell
cd C:\Users\inkyo\.cursor\dev\cursorstudy\company-introduction-website
git add .
git commit -m "루카바둑 게임 추가 및 메뉴 연동"
git push origin main
```

---

## 푸시 시 로그인

- **HTTPS:** 푸시 시 GitHub 사용자명 + 비밀번호(또는 Personal Access Token) 입력
- **SSH:** SSH 키가 등록되어 있으면 `git remote set-url origin git@github.com:inkyooyoo/my-awesome-shoppingmall.git` 후 `git push origin main`

---

## 푸시 후 확인

1. https://github.com/inkyooyoo/my-awesome-shoppingmall 에서 코드 반영 확인
2. Vercel이 이 저장소와 연결되어 있다면 자동 배포됨
3. 배포된 사이트에서 `/lukabaduk.html` 로 게임 동작 확인
