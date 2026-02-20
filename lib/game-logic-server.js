/* 루카바둑 게임 로직 - 서버용 (JavaScript) */
const EMPTY = 0, BLACK = 1, WHITE = 2, YELLOW = 3;

function getStarPoints(size) {
  if (size === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
  if (size === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
  if (size === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
  return [];
}

function getNeighbors(r, c, size) {
  const n = [];
  if (r > 0) n.push([r - 1, c]);
  if (r < size - 1) n.push([r + 1, c]);
  if (c > 0) n.push([r, c - 1]);
  if (c < size - 1) n.push([r, c + 1]);
  return n;
}

function getGroupOwner(r, c, board, yellowAsBlack, yellowAsWhite) {
  if (board[r][c] === BLACK) return BLACK;
  if (board[r][c] === WHITE) return WHITE;
  return null;
}

function getGroup(r, c, color, board, size, yellowAsBlack, yellowAsWhite) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const group = [];

  function sameColor(i, j) {
    return board[i][j] === color;
  }

  function dfs(i, j) {
    if (i < 0 || i >= size || j < 0 || j >= size) return;
    if (visited[i][j] || !sameColor(i, j)) return;
    visited[i][j] = true;
    group.push([i, j]);
    getNeighbors(i, j, size).forEach(([ni, nj]) => dfs(ni, nj));
  }

  dfs(r, c);
  return group;
}

function getLiberties(r, c, color, board, size, yellowAsBlack, yellowAsWhite) {
  const group = getGroup(r, c, color, board, size, yellowAsBlack, yellowAsWhite);
  const libSet = new Set();
  group.forEach(([i, j]) => {
    getNeighbors(i, j, size).forEach(([ni, nj]) => {
      if (board[ni][nj] === EMPTY) libSet.add(ni * size + nj);
    });
  });
  return libSet.size;
}

function removeGroup(r, c, board, size, yellowAsBlack, yellowAsWhite) {
  const owner = getGroupOwner(r, c, board, yellowAsBlack, yellowAsWhite);
  if (owner == null) return 0;
  const group = getGroup(r, c, owner, board, size, yellowAsBlack, yellowAsWhite);
  group.forEach(([i, j]) => {
    board[i][j] = EMPTY;
  });
  return group.length;
}

function boardSignature(board) {
  return board.map((row) => row.join('')).join('');
}

function doPlaceStone(row, col, state) {
  if (state.gameEnded) return { success: false, error: '게임이 종료되었습니다' };
  if (state.board[row][col] !== EMPTY) return { success: false, error: '이미 돌이 있습니다' };

  const opponent = state.currentTurn === BLACK ? WHITE : BLACK;
  const isFirstBlack = state.currentTurn === BLACK && state.blackMoveCount === 0;
  const isFirstWhite = state.currentTurn === WHITE && state.whiteMoveCount === 0;
  const placeAsYellow = isFirstBlack || isFirstWhite;
  const actualStone = placeAsYellow ? YELLOW : state.currentTurn;

  const newBoard = state.board.map((row) => [...row]);
  const newYellowAsBlack = [...state.yellowAsBlack];
  const newYellowAsWhite = [...state.yellowAsWhite];
  const lastCapturedStones = [];
  let captured = 0;

  getNeighbors(row, col, state.size).forEach(([nr, nc]) => {
    const owner = getGroupOwner(nr, nc, newBoard, newYellowAsBlack, newYellowAsWhite);
    if (owner === opponent && getLiberties(nr, nc, opponent, newBoard, state.size, newYellowAsBlack, newYellowAsWhite) === 1) {
      const group = getGroup(nr, nc, opponent, newBoard, state.size, newYellowAsBlack, newYellowAsWhite);
      group.forEach(([i, j]) => {
        const stoneColor = newBoard[i][j];
        const stoneOwner = getGroupOwner(i, j, newBoard, newYellowAsBlack, newYellowAsWhite);
        lastCapturedStones.push([i, j, stoneColor, stoneOwner]);
      });
      captured += removeGroup(nr, nc, newBoard, state.size, newYellowAsBlack, newYellowAsWhite);
    }
  });

  const newCapturedBlack = state.currentTurn === WHITE ? captured : 0;
  const newCapturedWhite = state.currentTurn === BLACK ? captured : 0;

  newBoard[row][col] = actualStone;

  if (getLiberties(row, col, actualStone, newBoard, state.size, newYellowAsBlack, newYellowAsWhite) === 0) {
    return { success: false, error: '자충수는 둘 수 없습니다' };
  }

  const sig = boardSignature(newBoard);
  if (state.boardHistory.length > 0 && state.boardHistory[state.boardHistory.length - 1] === sig) {
    return { success: false, error: '코 규칙 위반입니다' };
  }

  const newBoardHistory = [...state.boardHistory, sig];
  if (newBoardHistory.length > 2) newBoardHistory.shift();

  const moveData = {
    row,
    col,
    stone: actualStone,
    capturedStones: lastCapturedStones,
    capturedByBlack: newCapturedBlack,
    capturedByWhite: newCapturedWhite,
    turn: state.currentTurn,
    blackMoveCount: state.blackMoveCount,
    whiteMoveCount: state.whiteMoveCount,
  };

  const newMoveHistory = [...state.moveHistory, moveData];

  const newState = {
    board: newBoard,
    currentTurn: state.currentTurn === BLACK ? WHITE : BLACK,
    lastMove: [row, col],
    capturedBlack: state.capturedBlack + newCapturedBlack,
    capturedWhite: state.capturedWhite + newCapturedWhite,
    consecutivePass: 0,
    gameEnded: false,
    boardHistory: newBoardHistory,
    moveHistory: newMoveHistory,
    blackMoveCount: state.currentTurn === BLACK ? state.blackMoveCount + 1 : state.blackMoveCount,
    whiteMoveCount: state.currentTurn === WHITE ? state.whiteMoveCount + 1 : state.whiteMoveCount,
    yellowAsBlack: newYellowAsBlack,
    yellowAsWhite: newYellowAsWhite,
    size: state.size,
    blackTimeRemaining: state.blackTimeRemaining,
    whiteTimeRemaining: state.whiteTimeRemaining,
    timeWin: state.timeWin,
    winnerByTime: state.winnerByTime,
  };

  return { success: true, newState };
}

function doPassTurn(state) {
  const sig = boardSignature(state.board);
  const newBoardHistory = [...state.boardHistory, sig];
  if (newBoardHistory.length > 2) newBoardHistory.shift();

  const newConsecutivePass = state.consecutivePass + 1;

  return {
    ...state,
    currentTurn: state.currentTurn === BLACK ? WHITE : BLACK,
    lastMove: null,
    consecutivePass: newConsecutivePass,
    boardHistory: newBoardHistory,
    gameEnded: newConsecutivePass >= 2,
  };
}

function doUndoMove(state) {
  if (state.moveHistory.length === 0) return { success: false, error: '무를 수가 없습니다' };

  const m = state.moveHistory[state.moveHistory.length - 1];
  const newMoveHistory = state.moveHistory.slice(0, -1);
  const newBoard = state.board.map((row) => [...row]);
  const newYellowAsBlack = [...state.yellowAsBlack];
  const newYellowAsWhite = [...state.yellowAsWhite];

  newBoard[m.row][m.col] = EMPTY;
  m.capturedStones.forEach(([i, j, color]) => {
    newBoard[i][j] = color;
  });

  const newBoardHistory = state.boardHistory.slice(0, -1);

  const newState = {
    ...state,
    board: newBoard,
    currentTurn: m.turn,
    lastMove: newMoveHistory.length > 0 ? [newMoveHistory[newMoveHistory.length - 1].row, newMoveHistory[newMoveHistory.length - 1].col] : null,
    capturedBlack: state.capturedBlack - m.capturedByBlack,
    capturedWhite: state.capturedWhite - m.capturedByWhite,
    consecutivePass: 0,
    gameEnded: false,
    boardHistory: newBoardHistory,
    moveHistory: newMoveHistory,
    blackMoveCount: m.blackMoveCount,
    whiteMoveCount: m.whiteMoveCount,
    yellowAsBlack: newYellowAsBlack,
    yellowAsWhite: newYellowAsWhite,
  };

  return { success: true, newState };
}

function getScore(state) {
  const { board, size, capturedBlack, capturedWhite } = state;

  function ownerAt(r, c) {
    const v = board[r][c];
    if (v === BLACK) return BLACK;
    if (v === WHITE) return WHITE;
    if (v === YELLOW) return EMPTY;
    return EMPTY;
  }

  function detectAutoDead() {
    const visited = new Set();
    const autoDead = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const key = r + ',' + c;
        if (visited.has(key)) continue;
        const owner = ownerAt(r, c);
        if (owner !== BLACK && owner !== WHITE) continue;
        const queue = [[r, c]];
        const group = [];
        const liberties = new Set();
        visited.add(key);
        while (queue.length > 0) {
          const [cr, cc] = queue.pop();
          group.push([cr, cc]);
          getNeighbors(cr, cc, size).forEach(([nr, nc]) => {
            const nKey = nr + ',' + nc;
            const nOwner = ownerAt(nr, nc);
            if (nOwner === EMPTY) liberties.add(nKey);
            else if (nOwner === owner && !visited.has(nKey)) {
              visited.add(nKey);
              queue.push([nr, nc]);
            }
          });
        }
        if (liberties.size <= 1) group.forEach(([gr, gc]) => autoDead.add(gr + ',' + gc));
      }
    }
    return autoDead;
  }

  const deadSet = detectAutoDead();
  function ownerAtForScoring(r, c) {
    if (deadSet.has(r + ',' + c)) return EMPTY;
    return ownerAt(r, c);
  }

  function pointInfluence(r, c) {
    let blackInfluence = 0;
    let whiteInfluence = 0;
    const radius = size <= 9 ? 4 : size <= 13 ? 5 : 6;
    const decay = 0.72;
    for (let sr = 0; sr < size; sr++) {
      for (let sc = 0; sc < size; sc++) {
        const o = ownerAtForScoring(sr, sc);
        if (o !== BLACK && o !== WHITE) continue;
        const dist = Math.abs(sr - r) + Math.abs(sc - c);
        if (dist <= 0 || dist > radius) continue;
        const influence = Math.pow(decay, dist - 1);
        if (o === BLACK) blackInfluence += influence;
        else whiteInfluence += influence;
      }
    }
    return blackInfluence - whiteInfluence;
  }

  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  let safeBlack = 0;
  let safeWhite = 0;
  let potentialBlack = 0;
  let potentialWhite = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((board[r][c] !== EMPTY && !deadSet.has(r + ',' + c)) || visited[r][c]) continue;
      const queue = [[r, c]];
      const region = [];
      let touchesBlack = false;
      let touchesWhite = false;
      visited[r][c] = true;
      while (queue.length > 0) {
        const [cr, cc] = queue.pop();
        region.push([cr, cc]);
        getNeighbors(cr, cc, size).forEach(([nr, nc]) => {
          const o = ownerAtForScoring(nr, nc);
          const nKey = nr + ',' + nc;
          const isTraversable = (board[nr][nc] === EMPTY || deadSet.has(nKey));
          if (o === EMPTY && isTraversable && !visited[nr][nc]) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          } else if (o === BLACK) touchesBlack = true;
          else if (o === WHITE) touchesWhite = true;
        });
      }
      if (touchesBlack && !touchesWhite) safeBlack += region.length;
      else if (touchesWhite && !touchesBlack) safeWhite += region.length;
      else {
        region.forEach(([rr, cc]) => {
          const diff = pointInfluence(rr, cc);
          const absDiff = Math.abs(diff);
          if (absDiff >= 0.3) {
            const strength = Math.min(1, absDiff / 1.2);
            if (diff > 0) potentialBlack += 0.5 + strength * 0.5;
            else potentialWhite += 0.5 + strength * 0.5;
          }
        });
      }
    }
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const o = ownerAtForScoring(r, c);
      if (o === BLACK) blackStones += 1;
      else if (o === WHITE) whiteStones += 1;
    }
  }

  let deadBlack = 0;
  let deadWhite = 0;
  deadSet.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const o = ownerAt(r, c);
    if (o === BLACK) deadBlack += 1;
    else if (o === WHITE) deadWhite += 1;
  });

  const blackScore = safeBlack + potentialBlack + (capturedWhite || 0) + deadWhite; // Japanese rule
  const whiteScore = safeWhite + potentialWhite + (capturedBlack || 0) + deadBlack + 6.5;
  const chineseBlackScore = safeBlack + potentialBlack + blackStones;
  const chineseWhiteScore = safeWhite + potentialWhite + whiteStones + 6.5;
  return { blackScore, whiteScore, chineseBlackScore, chineseWhiteScore, deadBlack, deadWhite, autoDeadCount: deadSet.size };
}

/** 초기 대국 상태. timeConfig.base = 흑/백 각자 초기 시간(초), 매 수 후 timeConfig.byoYomi초가 착수한 쪽에 가산됨. */
function createInitialState(size, timeConfig) {
  const raw = (timeConfig && timeConfig.base != null) ? timeConfig.base : 300;
  const baseNum = Number(raw);
  const base = (Number.isNaN(baseNum) || baseNum < 0) ? 300 : baseNum;
  return {
    board: Array(size).fill(null).map(() => Array(size).fill(EMPTY)),
    currentTurn: BLACK,
    lastMove: null,
    capturedBlack: 0,
    capturedWhite: 0,
    consecutivePass: 0,
    gameEnded: false,
    boardHistory: [],
    moveHistory: [],
    blackMoveCount: 0,
    whiteMoveCount: 0,
    yellowAsBlack: [],
    yellowAsWhite: [],
    size,
    blackTimeRemaining: base,
    whiteTimeRemaining: base,
    timeWin: false,
    winnerByTime: null,
  };
}

module.exports = {
  EMPTY,
  BLACK,
  WHITE,
  YELLOW,
  getStarPoints,
  doPlaceStone,
  doPassTurn,
  doUndoMove,
  createInitialState,
  getScore,
};
