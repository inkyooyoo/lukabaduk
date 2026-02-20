/* 루카바둑 게임 로직 - 황색돌(첫 수) 규칙 포함 */
let SIZE = 9;
const EMPTY = 0, BLACK = 1, WHITE = 2, YELLOW = 3;

function getStarPoints(size) {
    if (size === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
    if (size === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
    if (size === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
    return [];
}

let board = [];
let currentTurn = BLACK, lastMove = null, capturedBlack = 0, capturedWhite = 0, consecutivePass = 0, gameEnded = false;
let boardHistory = [], lastCapturedStones = [], moveHistory = [], blackMoveCount = 0, whiteMoveCount = 0;
let yellowAsBlack = new Set(), yellowAsWhite = new Set();
let gameMode = 'human', humanColor = BLACK, aiColor = WHITE, aiGameStarted = false, showingTerritory = false;

const boardEl = document.getElementById('board'), turnEl = document.getElementById('turn'), capBlackEl = document.getElementById('cap-black'), capWhiteEl = document.getElementById('cap-white'), passCountEl = document.getElementById('pass-count'), messageEl = document.getElementById('message');

function setBoardSize(size) { SIZE = size; document.querySelectorAll('.board-size .btn').forEach(b => b.classList.remove('active')); document.getElementById('size-' + size).classList.add('active'); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden')); const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function goToStart() { showScreen('screen-start'); }
function goToHumanGame() { gameMode = 'human'; aiGameStarted = false; resetGame(); showScreen('screen-game'); }
function goToAIChoice() { showScreen('screen-ai-choice'); }
function doStoneChoice() {
    humanColor = Math.random() < 0.5 ? BLACK : WHITE;
    aiColor = humanColor === BLACK ? WHITE : BLACK;
    aiGameStarted = true; gameMode = 'ai';
    resetGame(); showScreen('screen-game');
    messageEl.textContent = humanColor === BLACK ? '흑(당신) 선공입니다!' : '백(당신) 후공입니다. AI가 먼저 둡니다.';
    if (humanColor === WHITE) setTimeout(aiPlay, 600);
}

function initBoard() {
    board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(EMPTY));
    boardEl.innerHTML = '';
    const maxDim = SIZE === 9 ? 320 : SIZE === 13 ? 380 : 480;
    const dim = Math.min(window.innerWidth * 0.92, maxDim);
    boardEl.style.gridTemplateColumns = 'repeat(' + SIZE + ', 1fr)';
    boardEl.style.gridTemplateRows = 'repeat(' + SIZE + ', 1fr)';
    boardEl.style.width = boardEl.style.height = dim + 'px';
    const starPoints = getStarPoints(SIZE);
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (r === 0) cell.classList.add('edge-top');
            if (r === SIZE - 1) cell.classList.add('edge-bottom');
            if (c === 0) cell.classList.add('edge-left');
            if (c === SIZE - 1) cell.classList.add('edge-right');
            if (starPoints.some(([sr, sc]) => sr === r && sc === c)) { const dot = document.createElement('span'); dot.className = 'star-dot'; cell.appendChild(dot); }
            cell.dataset.row = r; cell.dataset.col = c;
            cell.addEventListener('click', () => placeStone(r, c));
            boardEl.appendChild(cell);
        }
    }
}

function getNeighbors(r, c) {
    const n = [];
    if (r > 0) n.push([r - 1, c]); if (r < SIZE - 1) n.push([r + 1, c]);
    if (c > 0) n.push([r, c - 1]); if (c < SIZE - 1) n.push([r, c + 1]);
    return n;
}
function getGroupOwner(r, c) {
    if (board[r][c] === BLACK) return BLACK;
    if (board[r][c] === WHITE) return WHITE;
    if (board[r][c] === YELLOW && yellowAsBlack.has(r + ',' + c)) return BLACK;
    if (board[r][c] === YELLOW && yellowAsWhite.has(r + ',' + c)) return WHITE;
    return null;
}
function getGroup(r, c, color) {
    const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false)), group = [];
    function sameColor(i, j) {
        if (board[i][j] === color) return true;
        if (color === BLACK && board[i][j] === YELLOW && yellowAsBlack.has(i + ',' + j)) return true;
        if (color === WHITE && board[i][j] === YELLOW && yellowAsWhite.has(i + ',' + j)) return true;
        return false;
    }
    function dfs(i, j) {
        if (i < 0 || i >= SIZE || j < 0 || j >= SIZE) return;
        if (visited[i][j] || !sameColor(i, j)) return;
        visited[i][j] = true; group.push([i, j]);
        getNeighbors(i, j).forEach(([ni, nj]) => dfs(ni, nj));
    }
    dfs(r, c); return group;
}
function getLiberties(r, c, color) {
    const group = getGroup(r, c, color), libSet = new Set();
    group.forEach(([i, j]) => getNeighbors(i, j).forEach(([ni, nj]) => { if (board[ni][nj] === EMPTY) libSet.add(ni * SIZE + nj); }));
    return libSet.size;
}
function removeGroup(r, c) {
    const owner = getGroupOwner(r, c); if (owner == null) return 0;
    const group = getGroup(r, c, owner);
    group.forEach(([i, j]) => {
        board[i][j] = EMPTY;
        yellowAsBlack.delete(i + ',' + j); yellowAsWhite.delete(i + ',' + j);
    });
    return group.length;
}
function boardSignature() { return board.map(row => row.join('')).join(''); }

function placeStone(row, col) {
    if (gameEnded || board[row][col] !== EMPTY) return;
    if (gameMode === 'ai' && (!aiGameStarted || currentTurn !== humanColor)) return;
    if (doPlaceStone(row, col) && gameMode === 'ai' && currentTurn === aiColor) setTimeout(aiPlay, 500);
}

function doPlaceStone(row, col) {
    if (board[row][col] !== EMPTY) return false;
    const opponent = currentTurn === BLACK ? WHITE : BLACK;
    const isFirstBlack = currentTurn === BLACK && blackMoveCount === 0, isFirstWhite = currentTurn === WHITE && whiteMoveCount === 0;
    const placeAsYellow = isFirstBlack || isFirstWhite, actualStone = placeAsYellow ? YELLOW : currentTurn;
    lastCapturedStones = [];
    let captured = 0;
    getNeighbors(row, col).forEach(([nr, nc]) => {
        if (getGroupOwner(nr, nc) === opponent && getLiberties(nr, nc, opponent) === 1) {
            getGroup(nr, nc, opponent).forEach(([i, j]) => lastCapturedStones.push([i, j, board[i][j], getGroupOwner(i, j)]));
            captured += removeGroup(nr, nc);
        }
    });
    if (currentTurn === BLACK) capturedWhite += captured; else capturedBlack += captured;
    board[row][col] = actualStone;
    function undoPlace() {
        board[row][col] = EMPTY;
        if (currentTurn === BLACK) capturedWhite -= captured; else capturedBlack -= captured;
        lastCapturedStones.forEach(([i, j, color]) => { board[i][j] = color; });
    }
    if (getLiberties(row, col, actualStone) === 0) { undoPlace(); return false; }
    const sig = boardSignature();
    if (boardHistory.length > 0 && boardHistory[boardHistory.length - 1] === sig) { undoPlace(); return false; }
    boardHistory.push(sig); if (boardHistory.length > 2) boardHistory.shift();
    if (placeAsYellow && currentTurn === BLACK) yellowAsBlack.add(row + ',' + col);
    if (placeAsYellow && currentTurn === WHITE) yellowAsWhite.add(row + ',' + col);
    moveHistory.push({ row, col, stone: actualStone, capturedStones: lastCapturedStones.map(([i, j, c, o]) => [i, j, c, o]), capturedByBlack: currentTurn === WHITE ? captured : 0, capturedByWhite: currentTurn === BLACK ? captured : 0, turn: currentTurn, blackMoveCount, whiteMoveCount });
    lastMove = [row, col]; consecutivePass = 0;
    if (currentTurn === BLACK) blackMoveCount++; else whiteMoveCount++;
    currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    clearTerritoryDisplay(); updateUI(); renderStones();
    return true;
}

function getValidMoves() {
    const moves = [], saveYellowBlack = new Set(yellowAsBlack), saveYellowWhite = new Set(yellowAsWhite);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) continue;
        const opponent = currentTurn === BLACK ? WHITE : BLACK;
        const isFirstBlack = currentTurn === BLACK && blackMoveCount === 0, isFirstWhite = currentTurn === WHITE && whiteMoveCount === 0;
        const placeAsYellow = isFirstBlack || isFirstWhite, actualStone = placeAsYellow ? YELLOW : currentTurn;
        lastCapturedStones = []; let captured = 0;
        getNeighbors(r, c).forEach(([nr, nc]) => {
            if (getGroupOwner(nr, nc) === opponent && getLiberties(nr, nc, opponent) === 1) {
                getGroup(nr, nc, opponent).forEach(([i, j]) => lastCapturedStones.push([i, j, board[i][j], getGroupOwner(i, j)]));
                captured += removeGroup(nr, nc);
            }
        });
        if (currentTurn === BLACK) capturedWhite += captured; else capturedBlack += captured;
        board[r][c] = actualStone;
        const myLib = getLiberties(r, c, actualStone);
        if (myLib === 0) {
            board[r][c] = EMPTY; if (currentTurn === BLACK) capturedWhite -= captured; else capturedBlack -= captured;
            lastCapturedStones.forEach(([i, j, color, owner]) => { board[i][j] = color; if (color === YELLOW && owner === BLACK) yellowAsBlack.add(i + ',' + j); if (color === YELLOW && owner === WHITE) yellowAsWhite.add(i + ',' + j); });
            yellowAsBlack = new Set(saveYellowBlack); yellowAsWhite = new Set(saveYellowWhite);
            continue;
        }
        const sig = boardSignature();
        board[r][c] = EMPTY; if (currentTurn === BLACK) capturedWhite -= captured; else capturedBlack -= captured;
        lastCapturedStones.forEach(([i, j, color, owner]) => { board[i][j] = color; if (color === YELLOW && owner === BLACK) yellowAsBlack.add(i + ',' + j); if (color === YELLOW && owner === WHITE) yellowAsWhite.add(i + ',' + j); });
        yellowAsBlack = new Set(saveYellowBlack); yellowAsWhite = new Set(saveYellowWhite);
        const koViolation = boardHistory.length > 0 && boardHistory[boardHistory.length - 1] === sig;
        if (!koViolation) moves.push({ r, c, captures: captured });
    }
    return moves;
}
function evaluateMove(move) {
    const { r, c, captures } = move, opponent = currentTurn === BLACK ? WHITE : BLACK;
    let score = captures > 0 ? 80 + captures * 15 : 0;
    getNeighbors(r, c).forEach(([nr, nc]) => {
        if (board[nr][nc] === currentTurn) { const lib = getLiberties(nr, nc, currentTurn); if (lib === 1) score += 25; score += 6; }
        else if (board[nr][nc] === opponent) { const lib = getLiberties(nr, nc, opponent); if (lib === 2) score += 8; }
    });
    const center = (SIZE - 1) / 2; score += (12 - Math.abs(r - center) - Math.abs(c - center)) * 1.5;
    if (getStarPoints(SIZE).some(([sr, sc]) => sr === r && sc === c)) score += 5;
    if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) score -= 3;
    return score + Math.random() * 1.5;
}
function aiPlay() {
    if (gameEnded || currentTurn !== aiColor) return;
    const moves = getValidMoves();
    if (moves.length === 0) { passTurn(); messageEl.textContent = 'AI가 패스했습니다. 당신 차례입니다'; return; }
    moves.sort((a, b) => evaluateMove(b) - evaluateMove(a));
    doPlaceStone(moves[0].r, moves[0].c);
    if (gameMode === 'ai' && currentTurn === humanColor) messageEl.textContent = '당신 차례입니다';
}

function undoMove() {
    if (moveHistory.length === 0) return;
    const m = moveHistory.pop();
    if (gameEnded) gameEnded = false;
    consecutivePass = 0; passCountEl.textContent = '';
    board[m.row][m.col] = EMPTY;
    if (m.stone === YELLOW && m.turn === BLACK) yellowAsBlack.delete(m.row + ',' + m.col);
    if (m.stone === YELLOW && m.turn === WHITE) yellowAsWhite.delete(m.row + ',' + m.col);
    m.capturedStones.forEach(([i, j, color, owner]) => {
        board[i][j] = color;
        if (color === YELLOW && owner === BLACK) yellowAsBlack.add(i + ',' + j);
        if (color === YELLOW && owner === WHITE) yellowAsWhite.add(i + ',' + j);
    });
    capturedBlack -= m.capturedByBlack; capturedWhite -= m.capturedByWhite;
    currentTurn = m.turn; blackMoveCount = m.blackMoveCount; whiteMoveCount = m.whiteMoveCount;
    lastMove = moveHistory.length > 0 ? [moveHistory[moveHistory.length - 1].row, moveHistory[moveHistory.length - 1].col] : null;
    if (boardHistory.length > 0) boardHistory.pop();
    messageEl.textContent = ''; clearTerritoryDisplay(); updateUI(); renderStones();
}
function passTurn() {
    if (gameEnded) return;
    if (gameMode === 'ai' && (!aiGameStarted || currentTurn !== humanColor)) return;
    consecutivePass++;
    boardHistory.push(boardSignature()); if (boardHistory.length > 2) boardHistory.shift();
    lastMove = null; currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    if (consecutivePass >= 2) { endGame(); return; }
    clearTerritoryDisplay(); passCountEl.textContent = '연속 패스 ' + consecutivePass + '회';
    updateUI(); renderStones();
    if (gameMode === 'ai' && currentTurn === aiColor) setTimeout(aiPlay, 500);
}
function countStones(color) {
    let n = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === color) n++;
        else if (board[r][c] === YELLOW && color === BLACK && yellowAsBlack.has(r + ',' + c)) n++;
        else if (board[r][c] === YELLOW && color === WHITE && yellowAsWhite.has(r + ',' + c)) n++;
    }
    return n;
}
function doCountScore() {
    const blackTerritory = countTerritory(BLACK), whiteTerritory = countTerritory(WHITE);
    const blackStones = countStones(BLACK), whiteStones = countStones(WHITE);
    return { blackScore: blackTerritory + blackStones + capturedWhite, whiteScore: whiteTerritory + whiteStones + capturedBlack + 6.5, blackTerritory, whiteTerritory, blackStones, whiteStones };
}
function countScore() {
    const s = doCountScore();
    const winner = s.blackScore > s.whiteScore ? '흑' : '백', diff = Math.abs(s.blackScore - s.whiteScore).toFixed(1);
    messageEl.textContent = '집계산: 흑 ' + s.blackScore.toFixed(1) + ' (집 ' + s.blackTerritory + ' + 돌 ' + s.blackStones + ' + 포로 ' + capturedWhite + ') : 백 ' + s.whiteScore.toFixed(1) + ' (집 ' + s.whiteTerritory + ' + 돌 ' + s.whiteStones + ' + 포로 ' + capturedBlack + ' + 코미 6.5) → ' + winner + '+' + diff;
}
function floodTerritoryWithPoints(r, c, visited) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return { points: [], touchesBlack: false, touchesWhite: false };
    if (visited[r][c]) return { points: [], touchesBlack: false, touchesWhite: false };
    if (board[r][c] === BLACK) return { points: [], touchesBlack: true, touchesWhite: false };
    if (board[r][c] === WHITE) return { points: [], touchesBlack: false, touchesWhite: true };
    if (board[r][c] === YELLOW) return { points: [], touchesBlack: yellowAsBlack.has(r + ',' + c), touchesWhite: yellowAsWhite.has(r + ',' + c) };
    visited[r][c] = true;
    let points = [[r, c]], touchesBlack = false, touchesWhite = false;
    getNeighbors(r, c).forEach(([nr, nc]) => {
        const res = floodTerritoryWithPoints(nr, nc, visited);
        points = points.concat(res.points); touchesBlack = touchesBlack || res.touchesBlack; touchesWhite = touchesWhite || res.touchesWhite;
    });
    return { points, touchesBlack, touchesWhite };
}
function getTerritoryRegions() {
    const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false)), regions = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY || visited[r][c]) continue;
        const res = floodTerritoryWithPoints(r, c, visited);
        regions.push(res);
    }
    return regions;
}
function getCellAt(r, c) { return boardEl.querySelector('.cell[data-row="' + r + '"][data-col="' + c + '"]'); }
function clearTerritoryDisplay() { if (!showingTerritory) return; showingTerritory = false; boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove()); }
function judgePosition() {
    if (showingTerritory) { clearTerritoryDisplay(); messageEl.textContent = ''; return; }
    const s = doCountScore(), diff = s.blackScore - s.whiteScore;
    let msg; if (Math.abs(diff) < 1) msg = '형세판단: 접전 (흑 ' + s.blackScore.toFixed(1) + ' : 백 ' + s.whiteScore.toFixed(1) + ') · 파랑=흑집, 연한색=백집';
    else if (diff > 0) msg = '형세판단: 흑 우세 (흑 ' + s.blackScore.toFixed(1) + ' : 백 ' + s.whiteScore.toFixed(1) + ', +' + diff.toFixed(1) + ') · 파랑=흑집, 연한색=백집';
    else msg = '형세판단: 백 우세 (흑 ' + s.blackScore.toFixed(1) + ' : 백 ' + s.whiteScore.toFixed(1) + ', +' + (-diff).toFixed(1) + ') · 파랑=흑집, 연한색=백집';
    messageEl.textContent = msg;
    boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
    getTerritoryRegions().forEach(({ points, touchesBlack, touchesWhite }) => {
        if (touchesBlack && !touchesWhite) points.forEach(([r, c]) => { const cell = getCellAt(r, c); if (cell) { const dot = document.createElement('span'); dot.className = 'territory-dot territory-black-dot'; cell.appendChild(dot); } });
        else if (touchesWhite && !touchesBlack) points.forEach(([r, c]) => { const cell = getCellAt(r, c); if (cell) { const dot = document.createElement('span'); dot.className = 'territory-dot territory-white-dot'; cell.appendChild(dot); } });
    });
    showingTerritory = true;
}
function endGame() {
    gameEnded = true;
    const s = doCountScore(), winner = s.blackScore > s.whiteScore ? '흑' : '백', diff = Math.abs(s.blackScore - s.whiteScore).toFixed(1);
    messageEl.textContent = '종료. ' + winner + ' 승 (흑 ' + s.blackScore.toFixed(1) + ' : 백 ' + s.whiteScore.toFixed(1) + ', ' + winner + '+' + diff + ')';
}
function floodTerritory(r, c, visited) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return { territory: 0, touchesBlack: false, touchesWhite: false };
    if (visited[r][c]) return { territory: 0, touchesBlack: false, touchesWhite: false };
    if (board[r][c] === BLACK) return { territory: 0, touchesBlack: true, touchesWhite: false };
    if (board[r][c] === WHITE) return { territory: 0, touchesBlack: false, touchesWhite: true };
    if (board[r][c] === YELLOW) return { territory: 0, touchesBlack: yellowAsBlack.has(r + ',' + c), touchesWhite: yellowAsWhite.has(r + ',' + c) };
    visited[r][c] = true;
    let territory = 1, touchesBlack = false, touchesWhite = false;
    getNeighbors(r, c).forEach(([nr, nc]) => {
        const res = floodTerritory(nr, nc, visited);
        territory += res.territory; touchesBlack = touchesBlack || res.touchesBlack; touchesWhite = touchesWhite || res.touchesWhite;
    });
    return { territory, touchesBlack, touchesWhite };
}
function countTerritory(color) {
    const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
    let total = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY || visited[r][c]) continue;
        const res = floodTerritory(r, c, visited);
        if (res.touchesBlack && !res.touchesWhite) total += color === BLACK ? res.territory : 0;
        if (res.touchesWhite && !res.touchesBlack) total += color === WHITE ? res.territory : 0;
    }
    return total;
}
function updateUI() {
    const isFirstBlack = currentTurn === BLACK && blackMoveCount === 0, isFirstWhite = currentTurn === WHITE && whiteMoveCount === 0;
    let txt = '';
    if (gameMode === 'ai' && currentTurn === aiColor) txt = 'AI 차례';
    else if (isFirstBlack) txt = '흑 (첫 수 → 황색돌)';
    else if (isFirstWhite) txt = '백 (첫 수 → 황색돌)';
    else txt = currentTurn === BLACK ? '흑' : '백';
    turnEl.textContent = txt; capBlackEl.textContent = capturedBlack; capWhiteEl.textContent = capturedWhite;
}
function renderStones() {
    boardEl.querySelectorAll('.cell').forEach(cell => { cell.querySelector('.stone')?.remove(); cell.querySelector('.yellow-stone-cross')?.remove(); });
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) continue;
        const cell = boardEl.children[r * SIZE + c];
        const stoneType = board[r][c] === BLACK ? 'black' : board[r][c] === WHITE ? 'white' : 'yellow';
        if (stoneType === 'yellow') { const cross = document.createElement('div'); cross.className = 'yellow-stone-cross'; cell.appendChild(cross); }
        const stone = document.createElement('div');
        stone.className = 'stone ' + stoneType;
        if (lastMove && lastMove[0] === r && lastMove[1] === c) stone.classList.add('last');
        cell.appendChild(stone);
    }
}
function resetGame() {
    currentTurn = BLACK; lastMove = null; capturedBlack = 0; capturedWhite = 0; consecutivePass = 0; gameEnded = false;
    if (gameMode === 'ai') aiGameStarted = true;
    boardHistory = []; moveHistory = []; blackMoveCount = 0; whiteMoveCount = 0; yellowAsBlack = new Set(); yellowAsWhite = new Set();
    messageEl.textContent = ''; passCountEl.textContent = '';
    updateUI(); initBoard();
}

initBoard();
