# AI와 두기 – GTP 엔진 연동 (GNU Go / Pachi 선택)

혼자두기에서 **AI와 두기(GNU Go)** 또는 **AI와 두기(Pachi)** 를 선택해 각 엔진과 대국할 수 있습니다.  
서버에 해당 엔진 경로를 설정하면 클라이언트가 그 엔진을 사용하고, 미설정 시 브라우저 MCTS로 폴백합니다.

## 동작 방식

- **서버에 GTP 엔진 설정됨**: AI 차례에 서버로 `POST /api/ai-move` 요청 → 엔진이 **남은 착수시간(time_settings)** 안에 수를 두고 결과 반환 → 클라이언트가 그 수를 적용.
- **설정 안 됨 / 타임아웃 / 오류**: 기존 MCTS(몬테카를로)로 수를 두며, 기존처럼 **시간 제한(deadline)** 과 청크 단위 실행으로 착수시간을 준수합니다.

즉, **점진적 강화**: 엔진만 설정하면 GNU Go AI가 붙고, 없으면 기존 MCTS AI가 동작합니다.

## 로컬 vs 웹 배포 (Railway 등)

| 환경 | AI와 두기 동작 |
|------|------------------|
| **로컬 (Windows)** | `engines/gnugo-3.8/gnugo.exe` 있거나 `GTP_ENGINE_PATH_GNUGO` 설정 시 GNU Go 사용. 미설정 시 브라우저 MCTS 폴백. |
| **웹 (Railway/Linux 등)** | `GTP_ENGINE_PATH_GNUGO`에 Linux용 gnugo 경로 설정 시 GNU Go 사용. 미설정 시 **동일하게 브라우저 MCTS 폴백**으로 플레이 가능. |

- 웹에서는 `engines/` 폴더가 저장소에 없으므로(용량·gitignore) **GNU Go를 쓰려면** 배포 환경에 gnugo를 설치하고 환경변수로 경로를 지정해야 합니다.
- 환경변수 없이 배포해도 **AI와 두기는 동작**하며, 서버가 503을 반환할 때 클라이언트가 자동으로 MCTS로 진행합니다.

## GTP 연동 구조 (개발 참고)

- **클라이언트** → `POST /api/ai-move` with `{ size, moves, colorToPlay, timeRemainingSec, engine }`. 타임아웃은 `(timeRemainingSec + 6) * 1000` ms 이상으로 두어 엔진 응답을 기다림.
- **서버** → `size`는 9/13/19만 허용, `moves` 배열 각 항목은 `{ color: 'B'|'W', row, col }` 범위 검사 후 `lib/gtp-ai.js`의 `getMove()` 호출.
- **gtp-ai** → 엔진 실행 시 `cwd`를 엔진 디렉터리로 설정(데이터 파일 로드), 명령 순서: `boardsize` → `clear_board` → `komi 6.5` → `level 10`(GNU Go) → `play` 반복 → `time_settings` → `genmove`. 기본 실행 인자 `--mode gtp`(보통바둑 참고). stdout에서 파싱된 `= 좌표`/`= pass` 사용.

## Pachi 설정 (권장)

Pachi는 **이미 학습된 상태**입니다. `engines/` 폴더의 `golast.trained`(DCNN), `patterns_mm.spat`·`patterns_mm.gamma`(패턴) 등이 포함되어 있어 별도 학습 없이 사용할 수 있습니다.  
기력이 약하게 느껴지면 **한 수당 시간**과 **실행 옵션**을 조정하면 됩니다.

### 기력에 영향을 주는 요소

1. **착수 시간 (가장 중요)**  
   - 혼자두기에서 「착수 시간」을 **5분+30초**, **10분+30초** 등으로 길게 잡을수록 Pachi가 더 생각해서 강해집니다.  
   - 10초+10초처럼 짧으면 상대적으로 약하게 둡니다.

2. **GTP_ENGINE_ARGS_PACHI (실행 옵션)**  
   - `threads=4` — CPU 코어 수. 2~8 정도로 늘리면 같은 시간에 더 많은 탐색을 합니다.  
   - `max_tree_size=200` — 탐색 트리 크기. 100~500 정도로 늘리면 수읽기가 깊어집니다.  
   - 예: `set GTP_ENGINE_ARGS_PACHI=threads=4 max_tree_size=200`

3. **데이터 파일**  
   - `engines/` 안에 `pachi.exe`와 같은 폴더에 `golast.trained`, `patterns_mm.spat` 등이 있으면 DCNN·패턴이 적용된 상태입니다. (서버가 해당 폴더를 cwd로 두고 실행하므로 자동으로 로드됩니다.)

### 환경 변수 예시

```bash
# Windows 예시 (기력 향상 옵션 포함)
set GTP_ENGINE_PATH_PACHI=C:\path\to\engines\pachi.exe
set GTP_ENGINE_ARGS_PACHI=threads=4 max_tree_size=200
npm run dev
```

```bash
# Linux/macOS 예시
export GTP_ENGINE_PATH_PACHI=/path/to/pachi
export GTP_ENGINE_ARGS_PACHI="threads=4 max_tree_size=200"
npm run dev
```

- **GTP_ENGINE_PATH_PACHI**: Pachi 실행 파일 경로.  
- **GTP_ENGINE_ARGS_PACHI**: 비워두면 기본. 기력 향상 시 `threads=4 max_tree_size=200` 등 권장.

## GNU Go 설정

GNU Go는 가벼운 규칙 기반 엔진입니다. [GNU Go](https://www.gnu.org/software/gnugo/)에서 빌드/다운로드 후 경로를 지정합니다.

```bash
# Windows 예시
set GTP_ENGINE_PATH_GNUGO=C:\path\to\gnugo.exe
```

```bash
# Linux/macOS 예시
export GTP_ENGINE_PATH_GNUGO=/usr/local/bin/gnugo
```

- **GTP_ENGINE_PATH_GNUGO**: GNU Go 실행 파일 경로. 비워두면 **Windows 한정**으로 `lukabaduk/engines/gnugo-3.8/gnugo.exe`가 있으면 해당 경로를 사용(보통바둑과 동일 폴더 구조).
- **GTP_ENGINE_ARGS_GNUGO**: (선택) 비워두면 `--mode gtp` 사용(보통바둑 참고).

## KataGo 설정 (예시)

1. [KataGo 릴리스](https://github.com/lightvector/KataGo/releases)에서 OS에 맞는 실행 파일과 넷워크(권장: `*.bin.gz`)를 받습니다.
2. GTP용 설정 파일(예: `default_gtp.cfg`)을 만들고, 넷워크 경로 등을 설정합니다.
3. 서버 실행 시 환경 변수로 엔진 경로와 인자를 넘깁니다.

```bash
# Windows 예시 (KataGo 실행 파일과 cfg 경로를 실제 경로로 바꾸세요)
set GTP_ENGINE_PATH=C:\path\to\katago.exe
set GTP_ENGINE_ARGS=gtp -config C:\path\to\default_gtp.cfg
npm run dev
```

```bash
# Linux/macOS 예시
export GTP_ENGINE_PATH=/path/to/katago
export GTP_ENGINE_ARGS="gtp -config /path/to/default_gtp.cfg"
npm run dev
```

- **GTP_ENGINE_PATH**: KataGo(또는 다른 GTP 호환 엔진) 실행 파일 경로.
- **GTP_ENGINE_ARGS**: 공백으로 구분된 인자. 예: `gtp -config ...`  
  (Pachi는 경로에 'pachi'가 있으면 인자 없이 실행, KataGo/GNU Go 등은 `gtp` 등 필요.)

## API

- **GET /api/ai-capable**  
  - 응답: `{ "gtp", "pachi", "gnugo" }` (각 boolean, 엔진 사용 가능 여부)  
  - 서버에 GTP 엔진이 설정되어 있는지 확인할 때 사용할 수 있습니다.

- **POST /api/ai-move**  
  - Body: `{ size, moves, colorToPlay, timeRemainingSec, engine }` (**engine**: `"pachi"` | `"gnugo"`)  
  - 서버가 엔진에 `time_settings`와 `genmove`를 보내고, **timeRemainingSec 안에** 나온 수를 그대로 반환합니다.  
  - 클라이언트는 이 시간을 “남은 착수시간” 기준으로 넘기므로, 착수시간 규칙을 유지할 수 있습니다.

## 착수시간

- 클라이언트는 AI 차례에 **타이머를 계속 돌리고**, 서버에는 `timeRemainingSec`(필요 시 1초 버퍼 적용)만 전달합니다.
- 서버는 이 값을 GTP `time_settings`에 넣어 엔진이 그 시간 안에 수를 두도록 합니다.
- 서버가 타임아웃되거나 503이면 클라이언트는 **기존 MCTS**로 넘어가고, MCTS도 **deadline = 남은 시간**으로 동작해 착수시간을 지킵니다.

이 구성을 유지하면 “딥러닝 오픈소스 활용 + 점진적 기력 향상 + 착수시간 준수”가 함께 적용됩니다.
