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
  const key = r + ',' + c;
  if (board[r][c] === YELLOW && yellowAsBlack.includes(key)) return BLACK;
  if (board[r][c] === YELLOW && yellowAsWhite.includes(key)) return WHITE;
  return null;
}

function getGroup(r, c, color, board, size, yellowAsBlack, yellowAsWhite) {
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const group = [];

  function sameColor(i, j) {
    if (board[i][j] === color) return true;
    const key = i + ',' + j;
    if (color === BLACK && board[i][j] === YELLOW && yellowAsBlack.includes(key)) return true;
    if (color === WHITE && board[i][j] === YELLOW && yellowAsWhite.includes(key)) return true;
    return false;
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
    const key = i + ',' + j;
    const blackIdx = yellowAsBlack.indexOf(key);
    if (blackIdx >= 0) yellowAsBlack.splice(blackIdx, 1);
    const whiteIdx = yellowAsWhite.indexOf(key);
    if (whiteIdx >= 0) yellowAsWhite.splice(whiteIdx, 1);
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

  if (placeAsYellow && state.currentTurn === BLACK) {
    newYellowAsBlack.push(row + ',' + col);
  }
  if (placeAsYellow && state.currentTurn === WHITE) {
    newYellowAsWhite.push(row + ',' + col);
  }

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
  const key = m.row + ',' + m.col;
  if (m.stone === YELLOW && m.turn === BLACK) {
    const idx = newYellowAsBlack.indexOf(key);
    if (idx >= 0) newYellowAsBlack.splice(idx, 1);
  }
  if (m.stone === YELLOW && m.turn === WHITE) {
    const idx = newYellowAsWhite.indexOf(key);
    if (idx >= 0) newYellowAsWhite.splice(idx, 1);
  }

  m.capturedStones.forEach(([i, j, color, owner]) => {
    newBoard[i][j] = color;
    if (color === YELLOW && owner === BLACK) {
      if (!newYellowAsBlack.includes(i + ',' + j)) newYellowAsBlack.push(i + ',' + j);
    }
    if (color === YELLOW && owner === WHITE) {
      if (!newYellowAsWhite.includes(i + ',' + j)) newYellowAsWhite.push(i + ',' + j);
    }
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

function floodTerritory(r, c, visited, board, size, yellowAsBlack, yellowAsWhite) {
  if (r < 0 || r >= size || c < 0 || c >= size) return { territory: 0, touchesBlack: false, touchesWhite: false };
  if (visited[r][c]) return { territory: 0, touchesBlack: false, touchesWhite: false };
  if (board[r][c] === BLACK) return { territory: 0, touchesBlack: true, touchesWhite: false };
  if (board[r][c] === WHITE) return { territory: 0, touchesBlack: false, touchesWhite: true };
  if (board[r][c] === YELLOW) {
    const key = r + ',' + c;
    return { territory: 0, touchesBlack: yellowAsBlack.includes(key), touchesWhite: yellowAsWhite.includes(key) };
  }
  visited[r][c] = true;
  let territory = 1, touchesBlack = false, touchesWhite = false;
  getNeighbors(r, c, size).forEach(([nr, nc]) => {
    const res = floodTerritory(nr, nc, visited, board, size, yellowAsBlack, yellowAsWhite);
    territory += res.territory;
    touchesBlack = touchesBlack || res.touchesBlack;
    touchesWhite = touchesWhite || res.touchesWhite;
  });
  return { territory, touchesBlack, touchesWhite };
}

function countStones(color, board, size, yellowAsBlack, yellowAsWhite) {
  let n = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] === color) n++;
      else if (board[r][c] === YELLOW && color === BLACK && yellowAsBlack.includes(r + ',' + c)) n++;
      else if (board[r][c] === YELLOW && color === WHITE && yellowAsWhite.includes(r + ',' + c)) n++;
    }
  }
  return n;
}

function getScore(state) {
  const { board, size, yellowAsBlack, yellowAsWhite, capturedBlack, capturedWhite } = state;
  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  let blackTerritory = 0, whiteTerritory = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== EMPTY || visited[r][c]) continue;
      const res = floodTerritory(r, c, visited, board, size, yellowAsBlack || [], yellowAsWhite || []);
      if (res.touchesBlack && !res.touchesWhite) blackTerritory += res.territory;
      if (res.touchesWhite && !res.touchesBlack) whiteTerritory += res.territory;
    }
  }
  const blackStones = countStones(BLACK, board, size, yellowAsBlack || [], yellowAsWhite || []);
  const whiteStones = countStones(WHITE, board, size, yellowAsBlack || [], yellowAsWhite || []);
  const blackScore = blackTerritory + blackStones + (capturedWhite || 0);
  const whiteScore = whiteTerritory + whiteStones + (capturedBlack || 0) + 6.5;
  return { blackScore, whiteScore };
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
