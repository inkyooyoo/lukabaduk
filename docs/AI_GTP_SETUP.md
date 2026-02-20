# AI와 두기 – 딥러닝 엔진(KataGo) 연동

AI와 두기에서 **착수시간을 지키면서** 기력을 높이려면, 서버에 GTP(Go Text Protocol) 엔진을 연결할 수 있습니다.  
엔진이 설정되어 있으면 클라이언트가 **자동으로 서버 AI를 우선 사용**하고, 실패 시 기존 MCTS로 폴백합니다.

## 동작 방식

- **서버에 GTP 엔진 설정됨**: AI 차례에 서버로 `POST /api/ai-move` 요청 → 엔진이 **남은 착수시간(time_settings)** 안에 수를 두고 결과 반환 → 클라이언트가 그 수를 적용.
- **설정 안 됨 / 타임아웃 / 오류**: 기존 MCTS(몬테카를로)로 수를 두며, 기존처럼 **시간 제한(deadline)** 과 청크 단위 실행으로 착수시간을 준수합니다.

즉, **점진적 강화**: 엔진만 설정하면 강한 AI가 붙고, 없으면 기존 AI가 그대로 동작합니다.

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
  (설정하지 않으면 기본으로 `gtp`만 사용합니다.)

## API

- **GET /api/ai-capable**  
  - 응답: `{ "gtp": true }` 또는 `{ "gtp": false }`  
  - 서버에 GTP 엔진이 설정되어 있는지 확인할 때 사용할 수 있습니다.

- **POST /api/ai-move**  
  - Body: `{ size, moves, colorToPlay, timeRemainingSec }`  
  - 서버가 엔진에 `time_settings`와 `genmove`를 보내고, **timeRemainingSec 안에** 나온 수를 그대로 반환합니다.  
  - 클라이언트는 이 시간을 “남은 착수시간” 기준으로 넘기므로, 착수시간 규칙을 유지할 수 있습니다.

## 착수시간

- 클라이언트는 AI 차례에 **타이머를 계속 돌리고**, 서버에는 `timeRemainingSec`(필요 시 1초 버퍼 적용)만 전달합니다.
- 서버는 이 값을 GTP `time_settings`에 넣어 엔진이 그 시간 안에 수를 두도록 합니다.
- 서버가 타임아웃되거나 503이면 클라이언트는 **기존 MCTS**로 넘어가고, MCTS도 **deadline = 남은 시간**으로 동작해 착수시간을 지킵니다.

이 구성을 유지하면 “딥러닝 오픈소스 활용 + 점진적 기력 향상 + 착수시간 준수”가 함께 적용됩니다.
