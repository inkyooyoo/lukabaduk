# 루카바둑 회사 소개 웹사이트

**빌드·배포는 이 폴더(`lukabaduk`)를 기준으로 합니다.**

v0에서 제작한 루카바둑 회사 소개 페이지입니다. Next.js + TypeScript + Tailwind CSS + shadcn/ui 기반입니다.

## 기술 스택

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Radix UI 기반)
- **Lucide React** (아이콘)

## 시작하기

### 1. 의존성 설치

```bash
npm install --legacy-peer-deps
```

> 일부 패키지의 peer dependency 충돌로 `--legacy-peer-deps` 옵션이 필요할 수 있습니다.

### 2. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 3. 프로덕션 빌드

```bash
npm run build
npm start
```

## 프로젝트 구조

```
company-introduction-website/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # 루트 레이아웃 (폰트, 메타데이터)
│   ├── page.tsx          # 메인 페이지
│   └── globals.css       # 전역 스타일
├── components/           # 페이지 컴포넌트
│   ├── header.tsx
│   ├── hero.tsx
│   ├── about.tsx
│   ├── services.tsx
│   ├── research.tsx
│   ├── philosophy.tsx
│   ├── education.tsx
│   ├── contact.tsx
│   ├── footer.tsx
│   └── ui/               # shadcn/ui 컴포넌트
├── lib/
│   └── utils.ts
└── hooks/
```

## Cursor에서 작업하기

1. Cursor에서 `company-introduction-website` 폴더 열기
2. `npm run dev` 실행 후 `http://localhost:3000`에서 미리보기
3. `components/` 내 컴포넌트를 수정하여 콘텐츠/디자인 변경
