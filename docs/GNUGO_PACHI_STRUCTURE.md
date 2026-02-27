# 루카바둑 프로젝트 내 GNU Go / Pachi 구조 정리

이 문서는 루카바둑에서 **GNU Go**와 **Pachi** 엔진이 어떻게 연결·호출되는지 프로젝트 구조 기준으로 정리한 것입니다.

---

## 1. 전체 흐름

```
[브라우저] 혼자두기 → AI와 두기(GNU Go) 또는 AI와 두기(Pachi) 선택
       → 돌가르기 → 대국 시작
       → AI 차례마다 POST /api/ai-move { size, moves, colorToPlay, timeRemainingSec, engine }
       ↓
[서버 server.js] 요청 검증 후 lib/gtp-ai.getMove(..., engine) 호출
       ↓
[lib/gtp-ai.js] engine 에 따라 GTP_ENGINE_PATH_PACHI 또는 GTP_ENGINE_PATH_GNUGO 로 프로세스 spawn
       → GTP 명령 전송 (boardsize, clear_board, komi, play..., time_settings, genmove)
       → stdout 에서 마지막 "= 좌표" / "= pass" 파싱
       ↓
[서버] 결과를 JSON 으로 응답 { row, col } 또는 { pass: true }
       ↓
[브라우저] applyServerAIMove(result) → 착수 또는 패스 처리, 실패 시 MCTS 폴백
```

---

## 2. 관련 파일 위치

| 구분 | 경로 | 역할 |
|------|------|------|
| **GTP 연동 코어** | `lib/gtp-ai.js` | 엔진 경로/인자 결정, spawn, 좌표 변환, genmove 응답 파싱 |
| **HTTP API** | `server.js` | `/api/ai-capable`, `/api/ai-move` 처리, gtpAi 호출 |
| **클라이언트 UI** | `public/lukabaduk-single.html` | "AI와 두기(GNU Go)", "AI와 두기(Pachi)" 버튼 |
| **클라이언트 로직** | `public/lukabaduk-game.js` | selectedAiEngine, tryServerAI(), applyServerAIMove() |
| **서버 실행 시 엔진 경로** | `start-lukabaduk-server.bat` | GTP_ENGINE_PATH_PACHI 등 환경 변수 설정 |
| **환경 변수 예시** | `.env.example` | Pachi/GNU Go 경로·인자 예시 |
| **설정 가이드** | `docs/AI_GTP_SETUP.md` | 사용자용 설치·환경 변수 설명 |
| **엔진 테스트** | `scripts/test-gtp.js` | Pachi/GNU Go 9×9 빈판 1수 호출 테스트 |
| **엔진 바이너리·데이터** | `engines/` | pachi.exe, patterns_*, opening.dat 등 (Pachi용) |

---

## 3. lib/gtp-ai.js 구조

### 3.1 환경 변수 (엔진별)

| 변수명 | 용도 |
|--------|------|
| `GTP_ENGINE_PATH` | (레거시) 단일 엔진 경로. 경로에 'pachi' 포함 시 Pachi, 아니면 GNU Go 로 간주 |
| `GTP_ENGINE_PATH_PACHI` | Pachi 실행 파일 경로 |
| `GTP_ENGINE_PATH_GNUGO` | GNU Go 실행 파일 경로 |
| `GTP_ENGINE_ARGS` | (레거시) 공백 구분 인자 |
| `GTP_ENGINE_ARGS_PACHI` | Pachi 전용 인자 (비어 있으면 Pachi는 인자 없이 실행) |
| `GTP_ENGINE_ARGS_GNUGO` | GNU Go 전용 인자 (비어 있으면 `gtp` 사용) |

### 3.2 공개 API

| 함수 | 반환 | 설명 |
|------|------|------|
| `isConfigured()` | boolean | Pachi 또는 GNU Go 중 하나라도 설정되었는지 |
| `isEngineConfigured(engine)` | boolean | `engine === 'pachi'` 또는 `'gnugo'` 인 경우 해당 엔진만 설정 여부 |
| `getMove(size, moves, colorToPlay, timeRemainingSec, engine)` | Promise<{ row, col } \| { pass: true } \| null> | GTP로 한 수 요청, 실패/타임아웃 시 null |

### 3.3 내부 동작 요약

- **getPathAndArgs(engine)**  
  - `engine === 'pachi'` → `GTP_ENGINE_PATH_PACHI` 또는 (경로에 pachi 포함 시) `GTP_ENGINE_PATH`, 인자는 없거나 `GTP_ENGINE_ARGS_PACHI`  
  - `engine === 'gnugo'` → `GTP_ENGINE_PATH_GNUGO` 또는 (경로에 pachi 없을 때) `GTP_ENGINE_PATH`, 인자는 `gtp` 또는 `GTP_ENGINE_ARGS_GNUGO`
- **toGtpCoord(row, col, size)**  
  - 내부 좌표(0부터, row=상단) → GTP 좌표(열 A–T, 행 1=하단). 열 I 는 생략.
- **parseGenmove(line, size)**  
  - `= D4`, `= pass`, `= D 4`, `= RESIGN` 등만 착수/패스로 인식. `?` 오류 줄이 나오면 해당 수는 사용하지 않음.
- **getMove()**  
  - `spawn(enginePath, args, { cwd: engineDir })` 로 엔진 실행.  
  - 명령 순서: `boardsize` → `clear_board` → `komi 7.5` → `play` 반복 → `time_settings` → `genmove`.  
  - stdout에서 **마지막** 유효한 `= 좌표`/`= pass` 만 반환.  
  - Windows 에서는 타임아웃 시 `proc.kill()`, 그 외 `proc.kill('SIGKILL')`.

---

## 4. 서버 (server.js) 역할

- **GET /api/ai-capable**  
  - `gtpAi.isConfigured()`, `gtpAi.isEngineConfigured('pachi')`, `gtpAi.isEngineConfigured('gnugo')` 를 그대로 JSON 으로 반환.
- **POST /api/ai-move**  
  - body 에서 `size`, `moves`, `colorToPlay`, `timeRemainingSec`, `engine` 읽음.  
  - `engine === 'gnugo'` 이면 GNU Go, 아니면 Pachi (`useEngine`).  
  - `size` 는 9/13/19 만 허용. `colorToPlay` 는 `B`/`W`. `moves[]` 각 항목은 `{ color: 'B'|'W', row, col }` 및 범위 검사.  
  - `gtpAi.getMove(size, moves, colorToPlay, timeRemainingSec, useEngine)` 호출 후 결과를 그대로 JSON 응답.  
  - 결과가 null 이면 503.

---

## 5. 클라이언트 (lukabaduk-game.js, lukabaduk-single.html) 역할

- **선택 저장**  
  - `selectedAiEngine`: `'pachi'` 또는 `'gnugo'`.  
  - `goToAIChoice('gnugo')` / `goToAIChoice('pachi')` 호출 시 설정되고, 돌가르기 화면으로 전환.
- **API 호출**  
  - AI 차례에 `tryServerAI(timeRemainingSec)` → `POST /api/ai-move` body 에 `engine: selectedAiEngine` 포함.  
  - 타임아웃: `(timeRemainingSec + 6) * 1000` ms 이상.
- **결과 처리**  
  - `applyServerAIMove(result)`: `result.pass` 이면 패스, 아니면 `(result.row, result.col)` 유효성 검사 후 `doPlaceStone()`.  
  - 범위/빈 칸 검사 실패 또는 서버 오류/타임아웃 시 `runMCTSFromStart()` 로 MCTS 폴백.

---

## 6. Pachi 기력 (이미 학습된 상태)

- **학습 데이터**: `engines/` 에 `golast.trained`(DCNN), `patterns_mm.spat`·`patterns_mm.gamma` 등이 있으면 **별도 학습 없이** 사용 가능.
- **기력이 약할 때**: (1) 혼자두기 착수 시간을 **5분+30초** 등으로 늘리기, (2) `GTP_ENGINE_ARGS_PACHI=threads=4 max_tree_size=200` 처럼 스레드·트리 크기 지정.
- 자세한 옵션은 `docs/AI_GTP_SETUP.md` 의 「Pachi 설정」 참고.

## 7. 엔진 디렉터리 (engines/)

- **Pachi**  
  - `pachi.exe` (및 필요 시 `pachi_19x19.exe`) 와 데이터 파일(`patterns_mm.spat`, `patterns_mm.gamma`, `opening.dat`, `joseki19.gtp`, `golast.trained` 등)을 같은 디렉터리에 두고, `gtp-ai.js` 는 `cwd` 를 이 디렉터리로 두어 실행.
- **GNU Go**  
  - 프로젝트에서는 바이너리만 경로로 지정. `GTP_ENGINE_PATH_GNUGO` 에 실행 파일 경로를 넣으면 되며, `engines/gnugo.exe` 등으로 두고 배치에서 설정할 수 있음.

---

## 8. 설정 요약 (실제 사용 시)

- **Pachi 만 쓸 때**  
  - `GTP_ENGINE_PATH_PACHI` (또는 `GTP_ENGINE_PATH` 에 pachi 경로) 설정.  
  - 예: `start-lukabaduk-server.bat` 에서 `set GTP_ENGINE_PATH_PACHI=%~dp0engines\pachi.exe`
- **GNU Go 만 쓸 때**  
  - `GTP_ENGINE_PATH_GNUGO` 에 gnugo 실행 파일 경로 설정.
- **둘 다 쓸 때**  
  - `GTP_ENGINE_PATH_PACHI`, `GTP_ENGINE_PATH_GNUGO` 각각 설정.  
  - 클라이언트는 선택한 메뉴에 따라 `engine: 'pachi'` 또는 `engine: 'gnugo'` 로 요청.

자세한 설치 및 옵션은 `docs/AI_GTP_SETUP.md` 를 참고하면 됩니다.
