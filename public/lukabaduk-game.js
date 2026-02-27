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
var selectedAiEngine = 'pachi';
var countRequestedBy = null;
var deadStoneMarks = new Set();
var scoringInspectMode = false;
var lastScoringView = null;
/* 착수시간: 기본시간이 주어지고 매 초 줄어듦. 0이 되면 해당 색 패. 한 수 둘 때마다 +byoYomi초가 그 색에 가산. */
var timeConfig = { base: 180, byoYomi: 10 };
var blackTimeRemaining = 180, whiteTimeRemaining = 180, timerIntervalId = null;

const boardEl = document.getElementById('board'), turnEl = document.getElementById('turn'), capBlackEl = document.getElementById('cap-black'), capWhiteEl = document.getElementById('cap-white'), passCountEl = document.getElementById('pass-count'), messageEl = document.getElementById('message');
var timeBlackEl = document.getElementById('time-black'), timeWhiteEl = document.getElementById('time-white');

var boardTheme = 'normal';
var showMoveNumbers = false;
var moveNumberDisplayStart = 0;
var MAX_MOVE_NUM_DISPLAY = 20;
var alphabetMode = false;
var alphabetOrder = [];
var MAX_ALPHABET = 26;
function toggleAlphabetMode() {
    alphabetMode = !alphabetMode;
    if (!alphabetMode) alphabetOrder = [];
    var btn = document.getElementById('btn-alphabet');
    if (btn) { btn.classList.toggle('active', alphabetMode); btn.textContent = alphabetMode ? '알파벳표기 켜짐' : '알파벳표기'; }
    renderStones();
}
function addAlphabetLabel(row, col) {
    var key = row + ',' + col;
    var idx = alphabetOrder.findIndex(function (p) { return p.r === row && p.c === col; });
    if (idx >= 0) {
        alphabetOrder.splice(idx, 1);
    } else if (alphabetOrder.length < MAX_ALPHABET) {
        alphabetOrder.push({ r: row, c: col });
    }
    renderStones();
}
function toggleMoveNumbers() {
    showMoveNumbers = !showMoveNumbers;
    if (showMoveNumbers) moveNumberDisplayStart = moveHistory.length;
    var btn = document.getElementById('btn-move-numbers');
    if (btn) { btn.classList.toggle('active', showMoveNumbers); btn.textContent = showMoveNumbers ? '수순표기 켜짐' : '수순표기'; }
    renderStones();
}
function setBoardSize(size) { SIZE = size; document.querySelectorAll('.board-size .btn').forEach(b => b.classList.remove('active')); var el = document.getElementById('size-' + size); if (el) el.classList.add('active'); }
function setBoardTheme(theme) {
    boardTheme = theme;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    var el = document.getElementById('theme-' + theme);
    if (el) el.classList.add('active');
    applyBoardTheme();
}
function applyBoardTheme() {
    var wrap = document.querySelector('.board-wrap');
    if (!wrap) return;
    if (boardTheme === 'bw') wrap.classList.add('theme-bw');
    else wrap.classList.remove('theme-bw');
}
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    if (id === 'screen-game') applyBoardTheme();
}
function goToStart() { clearDeadStoneMarks(); showScreen('screen-start'); }
function setTimeLimit(baseSeconds, byoYomiSeconds) {
    timeConfig.base = baseSeconds;
    timeConfig.byoYomi = byoYomiSeconds;
    var ids = ['time-10-10', 'time-3-10', 'time-5-20', 'time-10-30'];
    ids.forEach(function (id) { var b = document.getElementById(id); if (b) b.classList.remove('active'); });
    var activeId = (baseSeconds === 10 && byoYomiSeconds === 10) ? 'time-10-10' : (baseSeconds === 180 && byoYomiSeconds === 10) ? 'time-3-10' : (baseSeconds === 300 && byoYomiSeconds === 20) ? 'time-5-20' : 'time-10-30';
    var ab = document.getElementById(activeId); if (ab) ab.classList.add('active');
}
function formatTime(sec) {
    if (sec < 0) sec = 0;
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}
function updateTimeDisplay() {
    if (timeBlackEl) timeBlackEl.textContent = formatTime(blackTimeRemaining);
    if (timeWhiteEl) timeWhiteEl.textContent = formatTime(whiteTimeRemaining);
}
function stopTimer() {
    if (timerIntervalId !== null) { clearInterval(timerIntervalId); timerIntervalId = null; }
}
function startTimer() {
    stopTimer();
    if (!timeBlackEl || gameEnded) return;
    /* AI와 두기에서도 컴퓨터 차례에 타이머 가동(시간이 흐름). 사람/컴퓨터 모두 시간패 적용 */
    timerIntervalId = setInterval(function () {
        if (currentTurn === BLACK) {
            blackTimeRemaining -= 1;
            if (blackTimeRemaining <= 0) { blackTimeRemaining = 0; stopTimer(); gameEnded = true; if (messageEl) messageEl.textContent = '시간 초과. 흑 패. 백 시간승.'; updateTimeDisplay(); updateUI(); updateSidebarResult('white', null, true); return; }
        } else {
            whiteTimeRemaining -= 1;
            if (whiteTimeRemaining <= 0) { whiteTimeRemaining = 0; stopTimer(); gameEnded = true; if (messageEl) messageEl.textContent = '시간 초과. 백 패. 흑 시간승.'; updateTimeDisplay(); updateUI(); updateSidebarResult('black', null, true); return; }
        }
        updateTimeDisplay();
    }, 1000);
}
/* 착수 시: 둔 쪽 남은 시간에 매 수 추가시간(byoYomi)을 더함. */
function onHumanMoved() {
    var justPlayed = currentTurn === BLACK ? WHITE : BLACK;
    if (justPlayed === BLACK) blackTimeRemaining += timeConfig.byoYomi;
    else whiteTimeRemaining += timeConfig.byoYomi;
    updateTimeDisplay();
    stopTimer();
    if (!gameEnded) startTimer();
}
function goToHumanGame() { gameMode = 'human'; aiGameStarted = false; resetGame(); showScreen('screen-game'); if (currentTurn === BLACK) startTimer(); }
function goToAIChoice(engine) {
        selectedAiEngine = engine === 'gnugo' ? 'gnugo' : 'pachi';
        showScreen('screen-ai-choice');
        var hintEl = document.getElementById('ai-engine-hint');
        var label = selectedAiEngine === 'gnugo' ? 'GNU Go' : 'Pachi';
        if (hintEl) hintEl.textContent = label + '와 대국합니다. 돌가르기 후 시작하세요.';
        fetch('/api/ai-capable').then(function (r) { return r.json(); }).then(function (data) {
            if (!hintEl) return;
            var available = data && ((selectedAiEngine === 'gnugo' && data.gnugo) || (selectedAiEngine === 'pachi' && data.pachi));
            if (available) hintEl.textContent = label + '와 대국합니다. 돌가르기 후 시작하세요.';
            else hintEl.textContent = '서버에 ' + label + '가 설정되면 대국 가능합니다. (미설정 시 브라우저 AI로 진행)';
        }).catch(function () {
            if (hintEl) hintEl.textContent = '서버에 ' + label + '가 설정되면 대국 가능합니다.';
        });
    }
function doStoneChoice() {
    humanColor = Math.random() < 0.5 ? BLACK : WHITE;
    aiColor = humanColor === BLACK ? WHITE : BLACK;
    aiGameStarted = true; gameMode = 'ai';
    resetGame(); showScreen('screen-game');
    messageEl.textContent = humanColor === BLACK ? '흑(당신) 선공입니다!' : '백(당신) 후공입니다. AI가 먼저 둡니다.';
    if (humanColor === BLACK) startTimer();
    if (humanColor === WHITE) { startTimer(); setTimeout(aiPlay, 600); }
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
    return null;
}
function getGroup(r, c, color) {
    const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false)), group = [];
    function sameColor(i, j) {
        return board[i][j] === color;
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
    });
    return group.length;
}
function boardSignature() { return board.map(row => row.join('')).join(''); }

function placeStone(row, col) {
    if (alphabetMode) { addAlphabetLabel(row, col); return; }
    if (scoringInspectMode && board[row][col] !== EMPTY) { toggleDeadStoneMark(row, col); return; }
    if (gameEnded || board[row][col] !== EMPTY) return;
    if (countRequestedBy) return;
    if (gameMode === 'ai' && (!aiGameStarted || currentTurn !== humanColor)) return;
    if (doPlaceStone(row, col)) {
        onHumanMoved();
        if (gameMode === 'ai' && currentTurn === aiColor) setTimeout(aiPlay, 500);
    }
}

function doPlaceStone(row, col, skipUI) {
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
    moveHistory.push({ row, col, stone: actualStone, capturedStones: lastCapturedStones.map(([i, j, c, o]) => [i, j, c, o]), capturedByBlack: currentTurn === WHITE ? captured : 0, capturedByWhite: currentTurn === BLACK ? captured : 0, turn: currentTurn, blackMoveCount, whiteMoveCount });
    lastMove = [row, col]; consecutivePass = 0;
    if (currentTurn === BLACK) blackMoveCount++; else whiteMoveCount++;
    currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    if (!skipUI) { clearDeadStoneMarks(); clearTerritoryDisplay(); updateUI(); renderStones(); }
    return true;
}

function getValidMoves() {
    const moves = [];
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
            lastCapturedStones.forEach(([i, j, color]) => { board[i][j] = color; });
            continue;
        }
        const sig = boardSignature();
        board[r][c] = EMPTY; if (currentTurn === BLACK) capturedWhite -= captured; else capturedBlack -= captured;
        lastCapturedStones.forEach(([i, j, color]) => { board[i][j] = color; });
        const koViolation = boardHistory.length > 0 && boardHistory[boardHistory.length - 1] === sig;
        if (!koViolation) moves.push({ r, c, captures: captured });
    }
    return moves;
}
/* ========== AI와 두기: Pachi/KataGo 참고 재구성 (UCT+RAVE, 휴리스틱 플레이아웃, 착수시간 준수) ========== */
var AI_MIN_THINK_MS = 9000;
var AI_MAX_THINK_MS = 10000;
var AI_MIN_ITERATIONS = 48;
var AI_TIME_BUFFER_SEC = 1;
var AI_CHUNK_SIZE = 24;
var AI_RAVE_K = 500;
var AI_UCB_C = 1.7;
var AI_PLAYOUT_MAX_MOVES = 50;
var aiThinkState = null;

function aiMovePrior(move) {
    var r = move.r, c = move.c, captures = move.captures || 0, opp = currentTurn === BLACK ? WHITE : BLACK;
    var total = blackMoveCount + whiteMoveCount;
    var openTh = SIZE <= 9 ? 6 : (SIZE <= 13 ? 9 : 12);
    var isOpen = total < openTh;
    var cd = SIZE <= 9 ? 3 : (SIZE <= 13 ? 4 : 5);
    var inCorner = (r <= cd && c <= cd) || (r <= cd && c >= SIZE - 1 - cd) || (r >= SIZE - 1 - cd && c <= cd) || (r >= SIZE - 1 - cd && c >= SIZE - 1 - cd);
    var onEdge = r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
    var isStar = getStarPoints(SIZE).some(function (p) { return p[0] === r && p[1] === c; });
    var score = 0;
    if (captures > 0) score += 140 + captures * 40;
    getNeighbors(r, c).forEach(function (n) {
        var owner = getGroupOwner(n[0], n[1]);
        if (owner === currentTurn) {
            var lib = getLiberties(n[0], n[1], currentTurn);
            if (lib === 1) score += 75;
            else if (lib === 2) score += 30;
            else score += 10;
        } else if (owner === opp) {
            var lo = getLiberties(n[0], n[1], opp);
            if (lo === 2) score += 40;
            if (lo === 1) score += 18;
        }
    });
    if (isOpen) {
        if (isStar) score += 100;
        else if (inCorner) score += 58;
        else if (onEdge) score += 32;
        else score -= 32;
    } else {
        if (inCorner) score += 15;
        else if (onEdge) score += 8;
        else score -= 5;
        if (isStar) score += 10;
    }
    return score + Math.random() * 0.2;
}

function aiPlayoutScore(move) {
    if ((move.captures || 0) > 0) return 3;
    var neighbors = getNeighbors(move.r, move.c);
    for (var i = 0; i < neighbors.length; i++) {
        var o = getGroupOwner(neighbors[i][0], neighbors[i][1]);
        if (o === currentTurn && getLiberties(neighbors[i][0], neighbors[i][1], currentTurn) === 1) return 2;
        if (o === (currentTurn === BLACK ? WHITE : BLACK) && getLiberties(neighbors[i][0], neighbors[i][1], currentTurn === BLACK ? WHITE : BLACK) === 2) return 1;
    }
    return 0;
}

function aiPlayout(rootKeys) {
    var depth = 0, moves, m, i, scored = [], N = AI_PLAYOUT_MAX_MOVES;
    while (depth < N && (moves = getValidMoves()).length > 0) {
        scored.length = 0;
        for (i = 0; i < moves.length; i++) {
            var sc = aiPlayoutScore(moves[i]);
            if (sc >= 1) scored.push({ move: moves[i], sc: sc });
        }
        if (scored.length > 0 && Math.random() < 0.82) {
            var best = scored[0];
            for (i = 1; i < scored.length; i++) if (scored[i].sc > best.sc) best = scored[i];
            var same = scored.filter(function (x) { return x.sc === best.sc; });
            m = same[Math.floor(Math.random() * same.length)].move;
        } else {
            m = moves[Math.floor(Math.random() * moves.length)];
        }
        var key = m.r + ',' + m.c;
        if (rootKeys && rootKeys.hasOwnProperty(key)) rootKeys[key] = true;
        if (doPlaceStone(m.r, m.c, true)) depth++;
    }
    return depth;
}

function aiUctRaveSelect(rootMoves, rootStats, totalVisits) {
    var unvisited = [], i, key, st, bestKey = null, bestVal = -1e9;
    for (i = 0; i < rootMoves.length; i++) {
        key = rootMoves[i].r + ',' + rootMoves[i].c;
        st = rootStats[key];
        if (!st || st.visits === 0) unvisited.push(key);
    }
    if (unvisited.length > 0) return unvisited[Math.floor(Math.random() * unvisited.length)];
    var logN = Math.log(totalVisits + 1);
    for (i = 0; i < rootMoves.length; i++) {
        key = rootMoves[i].r + ',' + rootMoves[i].c;
        st = rootStats[key];
        var n = st.visits, w = st.wins, rn = st.raveVisits || 0, rw = st.raveWins || 0;
        var beta = rn / (rn + AI_RAVE_K);
        var ucb = (1 - beta) * (w / n) + beta * (rn ? rw / rn : 0.5) + AI_UCB_C * Math.sqrt(logN / n);
        if (ucb > bestVal) { bestVal = ucb; bestKey = key; }
    }
    return bestKey;
}

function tryServerAI(timeRemainingSec) {
    var body = {
        size: SIZE,
        moves: moveHistory.map(function (m) { return { color: m.turn === BLACK ? 'B' : 'W', row: m.row, col: m.col }; }),
        colorToPlay: aiColor === BLACK ? 'B' : 'W',
        timeRemainingSec: Math.max(1, Math.floor(timeRemainingSec)),
        engine: selectedAiEngine
    };
    var timeoutMs = Math.max(8000, (timeRemainingSec + 6) * 1000);
    var controller = new AbortController();
    var t = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch('/api/ai-move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal })
        .then(function (res) { clearTimeout(t); return res.ok ? res.json() : null; })
        .catch(function () { clearTimeout(t); return null; });
}

function applyServerAIMove(result) {
    if (result.pass) {
        if (aiColor === BLACK) blackTimeRemaining += timeConfig.byoYomi; else whiteTimeRemaining += timeConfig.byoYomi;
        consecutivePass++;
        boardHistory.push(boardSignature());
        if (boardHistory.length > 2) boardHistory.shift();
        lastMove = null;
        currentTurn = currentTurn === BLACK ? WHITE : BLACK;
        stopTimer();
        updateTimeDisplay();
        if (consecutivePass >= 2) { endGame(); return; }
        clearTerritoryDisplay();
        if (passCountEl) passCountEl.textContent = '연속 패스 ' + consecutivePass + '회';
        updateUI();
        renderStones();
        messageEl.textContent = 'AI가 패스했습니다. 당신 차례입니다';
        if (!gameEnded) startTimer();
        if (currentTurn === aiColor) setTimeout(aiPlay, 500);
    } else {
        var r = result.row, c = result.col;
        if (typeof r !== 'number' || typeof c !== 'number' || r < 0 || r >= SIZE || c < 0 || c >= SIZE || board[r][c] !== EMPTY) {
            runMCTSFromStart(); return;
        }
        if (!doPlaceStone(r, c)) { runMCTSFromStart(); return; }
        if (aiColor === BLACK) blackTimeRemaining += timeConfig.byoYomi; else whiteTimeRemaining += timeConfig.byoYomi;
        updateTimeDisplay();
        messageEl.textContent = '당신 차례입니다';
        startTimer();
    }
}

function runMCTSFromStart() {
    var moves = getValidMoves();
    if (moves.length === 0) { passTurn(); messageEl.textContent = 'AI가 패스했습니다. 당신 차례입니다'; return; }
    moves.sort(function (a, b) { return aiMovePrior(b) - aiMovePrior(a); });
    var rootLimit = SIZE <= 9 ? 36 : (SIZE <= 13 ? 30 : 26);
    if (moves.length > rootLimit) moves = moves.slice(0, rootLimit);
    var rootStats = {};
    var aiRemainingSec = aiColor === BLACK ? blackTimeRemaining : whiteTimeRemaining;
    var remainingMs = (aiRemainingSec - AI_TIME_BUFFER_SEC) * 1000;
    if (remainingMs < 500) remainingMs = 500;
    var budgetMs = Math.min(remainingMs, Math.max(AI_MIN_THINK_MS, Math.min(AI_MAX_THINK_MS, remainingMs)));
    aiThinkState = { moves: moves, rootStats: rootStats, deadline: Date.now() + budgetMs, totalVisits: 0, ucbC: AI_UCB_C };
    setTimeout(aiPlay, 0);
}

function aiPlay() {
    if (gameEnded || currentTurn !== aiColor) return;
    var state = aiThinkState;
    if (!state) {
        var timeRemainingSec = (aiColor === BLACK ? blackTimeRemaining : whiteTimeRemaining) - 1;
        if (timeRemainingSec < 1) timeRemainingSec = 1;
        tryServerAI(timeRemainingSec).then(function (r) {
            if (gameEnded || currentTurn !== aiColor) return;
            if (r && (r.pass || (r.row != null && r.col != null))) { applyServerAIMove(r); return; }
            runMCTSFromStart();
        }).catch(function () { if (gameEnded || currentTurn !== aiColor) return; runMCTSFromStart(); });
        return;
    }
    var moves = state.moves, rootStats = state.rootStats, deadline = state.deadline;
    var totalVisits = state.totalVisits, i, key, mv, mi, k, chunkDone = 0;
    var rootKeys = {};
    for (i = 0; i < moves.length; i++) rootKeys[moves[i].r + ',' + moves[i].c] = false;
    while (chunkDone < AI_CHUNK_SIZE && (Date.now() < deadline || totalVisits < AI_MIN_ITERATIONS) && !gameEnded) {
        if (totalVisits >= AI_MIN_ITERATIONS && Date.now() >= deadline) break;
        key = aiUctRaveSelect(moves, rootStats, totalVisits);
        mv = null;
        for (mi = 0; mi < moves.length; mi++) if ((moves[mi].r + ',' + moves[mi].c) === key) { mv = moves[mi]; break; }
        if (!mv || !doPlaceStone(mv.r, mv.c, true)) continue;
        for (var kk in rootKeys) rootKeys[kk] = false;
        var depth = 1 + aiPlayout(rootKeys);
        var score = doCountScore();
        var aiWins = (aiColor === BLACK && score.blackScore > score.whiteScore) || (aiColor === WHITE && score.whiteScore > score.blackScore);
        for (k = 0; k < depth; k++) undoMove(true);
        if (!rootStats[key]) rootStats[key] = { visits: 0, wins: 0, raveVisits: 0, raveWins: 0 };
        rootStats[key].visits++;
        rootStats[key].wins += aiWins ? 1 : 0;
        for (var rk in rootKeys) if (rootKeys[rk]) {
            if (!rootStats[rk]) rootStats[rk] = { visits: 0, wins: 0, raveVisits: 0, raveWins: 0 };
            rootStats[rk].raveVisits = (rootStats[rk].raveVisits || 0) + 1;
            rootStats[rk].raveWins = (rootStats[rk].raveWins || 0) + (aiWins ? 1 : 0);
        }
        totalVisits++;
        chunkDone++;
    }
    state.totalVisits = totalVisits;
    if ((Date.now() < deadline && totalVisits < AI_MIN_ITERATIONS) && !gameEnded) {
        setTimeout(aiPlay, 0);
        return;
    }
    aiThinkState = null;
    var bestMove = moves[0];
    var bestVisits = 0, bestWR = -1;
    for (i = 0; i < moves.length; i++) {
        key = moves[i].r + ',' + moves[i].c;
        var s = rootStats[key];
        if (!s || s.visits === 0) continue;
        var wr = s.wins / s.visits;
        if (s.visits > bestVisits || (s.visits === bestVisits && wr > bestWR)) { bestVisits = s.visits; bestWR = wr; bestMove = moves[i]; }
    }
    if (gameEnded) return;
    doPlaceStone(bestMove.r, bestMove.c);
    if (aiColor === BLACK) blackTimeRemaining += timeConfig.byoYomi; else whiteTimeRemaining += timeConfig.byoYomi;
    updateTimeDisplay();
    if (gameMode === 'ai' && currentTurn === humanColor) { messageEl.textContent = '당신 차례입니다'; startTimer(); }
}

function undoMove(skipUI) {
    if (moveHistory.length === 0) return;
    if (countRequestedBy) return;
    const m = moveHistory.pop();
    if (gameEnded) gameEnded = false;
    consecutivePass = 0; if (!skipUI) passCountEl.textContent = '';
    board[m.row][m.col] = EMPTY;
    m.capturedStones.forEach(([i, j, color]) => {
        board[i][j] = color;
    });
    capturedBlack -= m.capturedByBlack; capturedWhite -= m.capturedByWhite;
    currentTurn = m.turn; blackMoveCount = m.blackMoveCount; whiteMoveCount = m.whiteMoveCount;
    lastMove = moveHistory.length > 0 ? [moveHistory[moveHistory.length - 1].row, moveHistory[moveHistory.length - 1].col] : null;
    if (boardHistory.length > 0) boardHistory.pop();
    if (!skipUI) { messageEl.textContent = ''; clearTerritoryDisplay(); updateUI(); renderStones(); }
}
function passTurn() {
    if (gameEnded) return;
    if (countRequestedBy) return;
    if (gameMode === 'ai' && (!aiGameStarted || currentTurn !== humanColor)) return;
    var passer = currentTurn;
    if (passer === BLACK) blackTimeRemaining += timeConfig.byoYomi;
    else whiteTimeRemaining += timeConfig.byoYomi;
    consecutivePass++;
    boardHistory.push(boardSignature()); if (boardHistory.length > 2) boardHistory.shift();
    lastMove = null; currentTurn = currentTurn === BLACK ? WHITE : BLACK;
    stopTimer();
    updateTimeDisplay();
    if (consecutivePass >= 2) { endGame(); return; }
    clearDeadStoneMarks(); clearTerritoryDisplay(); if (passCountEl) passCountEl.textContent = '연속 패스 ' + consecutivePass + '회';
    updateUI(); renderStones();
    if (!gameEnded) startTimer();
    if (gameMode === 'ai' && currentTurn === aiColor) setTimeout(aiPlay, 500);
}
function clearDeadStoneMarks() {
    deadStoneMarks.clear();
    scoringInspectMode = false;
    lastScoringView = null;
}
function getStoneOwnerAt(r, c) {
    const v = board[r][c];
    if (v === BLACK) return BLACK;
    if (v === WHITE) return WHITE;
    if (v === YELLOW) return EMPTY;
    return EMPTY;
}
function getRawOwnerAt(r, c) {
    const v = board[r][c];
    if (v === BLACK) return BLACK;
    if (v === WHITE) return WHITE;
    if (v === YELLOW) return EMPTY;
    return EMPTY;
}
function getScoringOwnerAtPoint(r, c, ignoreDeadKey) {
    const key = r + ',' + c;
    if (deadStoneMarks.has(key) && key !== ignoreDeadKey) return EMPTY;
    const v = board[r][c];
    if (v === BLACK) return BLACK;
    if (v === WHITE) return WHITE;
    if (v === YELLOW) return EMPTY;
    return EMPTY;
}
function getDeadStoneCaptureBonus() {
    let deadBlack = 0, deadWhite = 0;
    deadStoneMarks.forEach((key) => {
        const [r, c] = key.split(',').map(Number);
        const owner = getScoringOwnerAtPoint(r, c, key);
        if (owner === BLACK) deadBlack += 1;
        else if (owner === WHITE) deadWhite += 1;
    });
    return { deadBlack, deadWhite };
}

function analyzeScoringState() {
    const baseDead = new Set(deadStoneMarks);

    function baseOwnerAt(r, c) {
        const v = board[r][c];
        if (v === BLACK) return BLACK;
        if (v === WHITE) return WHITE;
        if (v === YELLOW) return EMPTY;
        return EMPTY;
    }

    function ownerAtWithDead(r, c, deadSet) {
        const key = r + ',' + c;
        if (deadSet.has(key)) return EMPTY;
        const v = board[r][c];
        if (v === BLACK) return BLACK;
        if (v === WHITE) return WHITE;
        if (v === YELLOW) return EMPTY;
        return EMPTY;
    }

    function detectAutoDead(deadSet) {
        const visited = new Set();
        const autoDead = new Set();
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
            const key = r + ',' + c;
            if (visited.has(key) || deadSet.has(key)) continue;
            const owner = baseOwnerAt(r, c);
            if (owner !== BLACK && owner !== WHITE) continue;
            const queue = [[r, c]];
            const group = [];
            const liberties = new Set();
            visited.add(key);
            while (queue.length > 0) {
                const [cr, cc] = queue.pop();
                group.push([cr, cc]);
                getNeighbors(cr, cc).forEach(([nr, nc]) => {
                    const nKey = nr + ',' + nc;
                    const nOwner = ownerAtWithDead(nr, nc, deadSet);
                    if (nOwner === EMPTY) liberties.add(nKey);
                    else if (nOwner === owner && !visited.has(nKey)) {
                        visited.add(nKey);
                        queue.push([nr, nc]);
                    }
                });
            }
            if (liberties.size <= 1) group.forEach(([gr, gc]) => autoDead.add(gr + ',' + gc));
        }
        return autoDead;
    }

    const autoDead = detectAutoDead(baseDead);
    const deadSet = new Set([...baseDead, ...autoDead]);
    const ownerAt = (r, c) => ownerAtWithDead(r, c, deadSet);

    function pointInfluence(r, c) {
        let blackInfluence = 0, whiteInfluence = 0;
        const radius = SIZE <= 9 ? 4 : SIZE <= 13 ? 5 : 6;
        const decay = 0.72;
        for (let sr = 0; sr < SIZE; sr++) for (let sc = 0; sc < SIZE; sc++) {
            const o = ownerAt(sr, sc);
            if (o !== BLACK && o !== WHITE) continue;
            const dist = Math.abs(sr - r) + Math.abs(sc - c);
            if (dist <= 0 || dist > radius) continue;
            const line = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
            const edgeWeight = line === 0 ? 1.18 : line === 1 ? 1.1 : 1.0;
            const influence = Math.pow(decay, dist - 1) * edgeWeight;
            if (o === BLACK) blackInfluence += influence;
            else whiteInfluence += influence;
        }
        return { diff: blackInfluence - whiteInfluence };
    }

    const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
    const safeBlackPoints = [], safeWhitePoints = [];
    const potentialBlackPoints = [], potentialWhitePoints = [];
    const threatenedPoints = [];
    let safeBlack = 0, safeWhite = 0, potentialBlack = 0, potentialWhite = 0;

    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if ((board[r][c] !== EMPTY && !deadSet.has(r + ',' + c)) || visited[r][c]) continue;
        const queue = [[r, c]];
        visited[r][c] = true;
        const region = [];
        let touchesBlack = false, touchesWhite = false;
        while (queue.length > 0) {
            const [cr, cc] = queue.pop();
            region.push([cr, cc]);
            getNeighbors(cr, cc).forEach(([nr, nc]) => {
                const o = ownerAt(nr, nc);
                const nKey = nr + ',' + nc;
                const isTraversable = (board[nr][nc] === EMPTY || deadSet.has(nKey));
                if (o === EMPTY && isTraversable && !visited[nr][nc]) {
                    visited[nr][nc] = true;
                    queue.push([nr, nc]);
                } else if (o === BLACK) touchesBlack = true;
                else if (o === WHITE) touchesWhite = true;
            });
        }
        if (touchesBlack && !touchesWhite) {
            region.forEach(([rr, cc]) => safeBlackPoints.push([rr, cc]));
            safeBlack += region.length;
        } else if (touchesWhite && !touchesBlack) {
            region.forEach(([rr, cc]) => safeWhitePoints.push([rr, cc]));
            safeWhite += region.length;
        } else {
            region.forEach(([rr, cc]) => {
                const inf = pointInfluence(rr, cc);
                const absDiff = Math.abs(inf.diff);
                if (absDiff >= 0.3) {
                    const strength = Math.min(1, absDiff / 1.2);
                    if (inf.diff > 0) {
                        potentialBlackPoints.push([rr, cc, strength]);
                        potentialBlack += 0.5 + strength * 0.5;
                    } else {
                        potentialWhitePoints.push([rr, cc, strength]);
                        potentialWhite += 0.5 + strength * 0.5;
                    }
                } else {
                    threatenedPoints.push([rr, cc]);
                }
            });
        }
    }

    let blackStones = 0, whiteStones = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        const o = ownerAt(r, c);
        if (o === BLACK) blackStones++;
        else if (o === WHITE) whiteStones++;
    }

    let deadBlack = 0, deadWhite = 0;
    deadSet.forEach((key) => {
        const [r, c] = key.split(',').map(Number);
        const o = baseOwnerAt(r, c);
        if (o === BLACK) deadBlack++;
        else if (o === WHITE) deadWhite++;
    });

    const japaneseBlack = safeBlack + potentialBlack + capturedWhite + deadWhite;
    const japaneseWhite = safeWhite + potentialWhite + capturedBlack + deadBlack + 6.5;
    const chineseBlack = safeBlack + potentialBlack + blackStones;
    const chineseWhite = safeWhite + potentialWhite + whiteStones + 6.5;

    return {
        safeBlackPoints, safeWhitePoints, potentialBlackPoints, potentialWhitePoints, threatenedPoints,
        safeBlack, safeWhite, potentialBlack, potentialWhite, blackStones, whiteStones,
        deadBlack, deadWhite, japaneseBlack, japaneseWhite, chineseBlack, chineseWhite,
        autoDeadCount: autoDead.size
    };
}
function toggleDeadStoneMark(r, c) {
    if (!scoringInspectMode) return false;
    const owner = getStoneOwnerAt(r, c);
    if (owner !== BLACK && owner !== WHITE) return false;
    const key = r + ',' + c;
    if (deadStoneMarks.has(key)) deadStoneMarks.delete(key); else deadStoneMarks.add(key);
    renderStones();
    if (lastScoringView === 'judge') renderJudgePosition();
    else if (lastScoringView === 'count') countScore();
    return true;
}
function countStones(color) {
    let n = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (getScoringOwnerAtPoint(r, c) === color) n++;
    }
    return n;
}
function doCountScore() {
    const s = analyzeScoringState();
    if (!s) return null;
    return {
        blackScore: s.japaneseBlack,
        whiteScore: s.japaneseWhite,
        blackSafeTerritory: s.safeBlack,
        whiteSafeTerritory: s.safeWhite,
        blackPotentialTerritory: s.potentialBlack,
        whitePotentialTerritory: s.potentialWhite,
        capturedByBlack: capturedWhite,
        capturedByWhite: capturedBlack,
        deadWhite: s.deadWhite,
        deadBlack: s.deadBlack,
        komi: 6.5
    };
}
function countScore() {
    scoringInspectMode = true;
    lastScoringView = 'count';
    const s = doCountScore();
    if (!s) return;
    const winner = s.blackScore > s.whiteScore ? '흑' : '백';
    const diff = Math.abs(s.blackScore - s.whiteScore).toFixed(1);
    messageEl.textContent =
      '집계산(일본식 단일): 흑 ' + s.blackScore.toFixed(1) +
      ' (안전집 ' + s.blackSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.blackPotentialTerritory.toFixed(1) +
      ' + 따낸돌 ' + s.capturedByBlack + ' + 사석 ' + s.deadWhite + ')' +
      ' : 백 ' + s.whiteScore.toFixed(1) +
      ' (안전집 ' + s.whiteSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.whitePotentialTerritory.toFixed(1) +
      ' + 따낸돌 ' + s.capturedByWhite + ' + 사석 ' + s.deadBlack + ' + 덤 ' + s.komi + ')' +
      ' → ' + winner + '+' + diff;
}
function floodTerritoryWithPoints(r, c, visited) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return { points: [], touchesBlack: false, touchesWhite: false };
    if (visited[r][c]) return { points: [], touchesBlack: false, touchesWhite: false };
    const key = r + ',' + c;
    const isDead = deadStoneMarks.has(key);
    if (!isDead && board[r][c] !== EMPTY) {
        const owner = getScoringOwnerAtPoint(r, c);
        if (owner === BLACK) return { points: [], touchesBlack: true, touchesWhite: false };
        if (owner === WHITE) return { points: [], touchesBlack: false, touchesWhite: true };
        return { points: [], touchesBlack: false, touchesWhite: false };
    }
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
        if ((board[r][c] !== EMPTY && !deadStoneMarks.has(r + ',' + c)) || visited[r][c]) continue;
        const res = floodTerritoryWithPoints(r, c, visited);
        regions.push(res);
    }
    return regions;
}
function getStoneOwnerAtPoint(r, c) {
    return getScoringOwnerAtPoint(r, c);
}
function getEdgeWeight(r, c) {
    const line = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
    if (line === 0) return 1.22;
    if (line === 1) return 1.12;
    if (line === 2) return 1.05;
    return 1.0;
}
function evaluateAdvantageAreas() {
    const settledBlack = new Set(), settledWhite = new Set();
    getTerritoryRegions().forEach(({ points, touchesBlack, touchesWhite }) => {
        if (touchesBlack && !touchesWhite) points.forEach(([r, c]) => settledBlack.add(r + ',' + c));
        else if (touchesWhite && !touchesBlack) points.forEach(([r, c]) => settledWhite.add(r + ',' + c));
    });
    const radius = SIZE <= 9 ? 4 : SIZE <= 13 ? 5 : 6;
    const decay = 0.72, advantageThreshold = 0.22, strongThreshold = 0.9;
    const blackAdvPoints = [], whiteAdvPoints = [];
    let blackAdvScore = 0, whiteAdvScore = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY && !deadStoneMarks.has(r + ',' + c)) continue;
        const key = r + ',' + c;
        if (settledBlack.has(key) || settledWhite.has(key)) continue;
        let blackInfluence = 0, whiteInfluence = 0;
        for (let sr = 0; sr < SIZE; sr++) for (let sc = 0; sc < SIZE; sc++) {
            const owner = getStoneOwnerAtPoint(sr, sc);
            if (owner !== BLACK && owner !== WHITE) continue;
            const dist = Math.abs(sr - r) + Math.abs(sc - c);
            if (dist <= 0 || dist > radius) continue;
            let influence = Math.pow(decay, dist - 1) * getEdgeWeight(r, c);
            const stoneLine = Math.min(sr, sc, SIZE - 1 - sr, SIZE - 1 - sc);
            const targetLine = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
            if (stoneLine <= 1 && targetLine <= 1) influence *= 1.08;
            if (owner === BLACK) blackInfluence += influence; else whiteInfluence += influence;
        }
        const diff = blackInfluence - whiteInfluence, absDiff = Math.abs(diff);
        if (absDiff < advantageThreshold) continue;
        const strength = Math.min(1, (absDiff - advantageThreshold) / (strongThreshold - advantageThreshold));
        if (diff > 0) { blackAdvPoints.push([r, c, strength]); blackAdvScore += strength; }
        else { whiteAdvPoints.push([r, c, strength]); whiteAdvScore += strength; }
    }
    return { settledBlack, settledWhite, blackAdvPoints, whiteAdvPoints, blackAdvScore, whiteAdvScore };
}
function getCellAt(r, c) { return boardEl.querySelector('.cell[data-row="' + r + '"][data-col="' + c + '"]'); }
function clearTerritoryDisplay() { if (!showingTerritory) return; showingTerritory = false; boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove()); }
function evaluateProbabilisticPosition(s) {
    const uncertain = s.threatenedPoints || [];
    const iterations = SIZE <= 9 ? 120 : SIZE <= 13 ? 180 : 240;
    const radius = SIZE <= 9 ? 3 : SIZE <= 13 ? 4 : 5;
    const decay = 0.74;
    function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    function influenceDiffAt(r, c) {
        let blackInf = 0, whiteInf = 0;
        for (let sr = 0; sr < SIZE; sr++) for (let sc = 0; sc < SIZE; sc++) {
            const owner = getScoringOwnerAtPoint(sr, sc);
            if (owner !== BLACK && owner !== WHITE) continue;
            const dist = Math.abs(sr - r) + Math.abs(sc - c);
            if (dist <= 0 || dist > radius) continue;
            const inf = Math.pow(decay, dist - 1);
            if (owner === BLACK) blackInf += inf; else whiteInf += inf;
        }
        return blackInf - whiteInf;
    }

    const pointProb = uncertain.map(([r, c]) => {
        const d = influenceDiffAt(r, c);
        const pBlack = Math.max(0.08, Math.min(0.92, sigmoid(d * 1.35)));
        return { r, c, pBlack };
    });
    const avgCertainty = pointProb.length === 0 ? 1 : pointProb.reduce((acc, p) => acc + Math.abs(p.pBlack - 0.5) * 2, 0) / pointProb.length;

    const baseJapaneseDiff = s.japaneseBlack - s.japaneseWhite;
    const baseChineseDiff = s.chineseBlack - s.chineseWhite;
    const valueDiff = baseJapaneseDiff * 0.65 + baseChineseDiff * 0.35;
    const valueWinRate = sigmoid(valueDiff / 6.0);

    let mctsWinsBlack = 0;
    let diffSum = 0;
    for (let i = 0; i < iterations; i++) {
        let b = s.japaneseBlack;
        let w = s.japaneseWhite;
        for (let j = 0; j < pointProb.length; j++) {
            const p = pointProb[j];
            if (Math.random() < p.pBlack) b += 1;
            else w += 1;
        }
        const diff = b - w;
        diffSum += diff;
        if (diff > 0) mctsWinsBlack += 1;
        else if (diff === 0 && Math.random() < 0.5) mctsWinsBlack += 1;
    }
    const mctsWinRate = mctsWinsBlack / Math.max(1, iterations);
    const mctsDiff = diffSum / Math.max(1, iterations);

    const blackWinRate = valueWinRate * 0.35 + mctsWinRate * 0.65;
    const predictedDiff = valueDiff * 0.4 + mctsDiff * 0.6;
    return {
        blackWinRate,
        whiteWinRate: 1 - blackWinRate,
        predictedDiff,
        iterations,
        confidence: Math.max(0.12, Math.min(0.98, avgCertainty * 0.8 + Math.abs(blackWinRate - 0.5) * 0.4)),
    };
}
function renderJudgePosition() {
    const s = analyzeScoringState();
    if (!s) return;
    const p = evaluateProbabilisticPosition(s);
    const bw = (p.blackWinRate * 100).toFixed(1);
    const ww = (p.whiteWinRate * 100).toFixed(1);
    const absDiff = Math.abs(p.predictedDiff).toFixed(1);
    let msg;
    if (Math.abs(p.predictedDiff) < 1) msg = '형세판단: 접전 (승률 흑 ' + bw + '% / 백 ' + ww + '%, 예상 집차 약 0~1집, 신뢰도 ' + (p.confidence * 100).toFixed(0) + '%)';
    else if (p.predictedDiff > 0) msg = '형세판단: 흑 우세 (승률 흑 ' + bw + '% / 백 ' + ww + '%, 예상 흑 +' + absDiff + '집, 신뢰도 ' + (p.confidence * 100).toFixed(0) + '%)';
    else msg = '형세판단: 백 우세 (승률 흑 ' + bw + '% / 백 ' + ww + '%, 예상 백 +' + absDiff + '집, 신뢰도 ' + (p.confidence * 100).toFixed(0) + '%)';
    msg += ' · 가치평가+시뮬레이션(' + p.iterations + '회)';
    messageEl.textContent = msg;
    boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
    s.safeBlackPoints.forEach(([r, c]) => {
        const cell = getCellAt(r, c); if (!cell) return;
        const dot = document.createElement('span'); dot.className = 'territory-dot territory-black-dot'; cell.appendChild(dot);
    });
    s.safeWhitePoints.forEach(([r, c]) => {
        const cell = getCellAt(r, c); if (!cell) return;
        const dot = document.createElement('span'); dot.className = 'territory-dot territory-white-dot'; cell.appendChild(dot);
    });
    s.potentialBlackPoints.forEach(([r, c, strength]) => {
        const cell = getCellAt(r, c); if (!cell) return;
        const dot = document.createElement('span'); dot.className = 'territory-dot territory-black-adv-dot';
        dot.style.opacity = String(Math.max(0.28, Math.min(0.78, 0.28 + strength * 0.5)));
        cell.appendChild(dot);
    });
    s.potentialWhitePoints.forEach(([r, c, strength]) => {
        const cell = getCellAt(r, c); if (!cell) return;
        const dot = document.createElement('span'); dot.className = 'territory-dot territory-white-adv-dot';
        dot.style.opacity = String(Math.max(0.28, Math.min(0.78, 0.28 + strength * 0.5)));
        cell.appendChild(dot);
    });
    s.threatenedPoints.forEach(([r, c]) => {
        const cell = getCellAt(r, c); if (!cell) return;
        const dot = document.createElement('span'); dot.className = 'territory-dot territory-threat-dot'; cell.appendChild(dot);
    });
    showingTerritory = true;
}
function judgePosition() {
    scoringInspectMode = true;
    lastScoringView = 'judge';
    if (showingTerritory) { clearTerritoryDisplay(); messageEl.textContent = ''; return; }
    renderJudgePosition();
}
function updateSidebarResult(winnerColor, scoreDiff, isTimeWin) {
    var wrap = document.getElementById('sidebar-result');
    var stonesEl = document.getElementById('sidebar-result-stones');
    var textEl = document.getElementById('sidebar-result-text');
    if (!wrap || !stonesEl || !textEl) return;
    var isBlack = winnerColor === 'black';
    stonesEl.innerHTML = '<div class="sidebar-result-stone ' + winnerColor + ' winner"></div>';
    var label = (isBlack ? '흑' : '백');
    if (isTimeWin) textEl.textContent = label + ' 시간승';
    else if (scoreDiff != null) textEl.textContent = label + ' ' + (scoreDiff === Math.floor(scoreDiff) ? scoreDiff + '집' : scoreDiff.toFixed(1) + '집') + ' 승';
    else textEl.textContent = label + ' 승';
    wrap.classList.add('show');
}
function hideSidebarResult() {
    var wrap = document.getElementById('sidebar-result');
    if (wrap) wrap.classList.remove('show');
}
function endGame() {
    gameEnded = true;
    stopTimer();
    var s = doCountScore();
    if (!s) return;
    var winnerColor = s.blackScore > s.whiteScore ? 'black' : 'white', winner = winnerColor === 'black' ? '흑' : '백', diff = Math.abs(s.blackScore - s.whiteScore);
    messageEl.textContent =
      '종료(일본식). 흑 ' + s.blackScore.toFixed(1) +
      ' (안전집 ' + s.blackSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.blackPotentialTerritory.toFixed(1) + ' + 따낸돌 ' + s.capturedByBlack + ' + 사석 ' + s.deadWhite + ')' +
      ' : 백 ' + s.whiteScore.toFixed(1) +
      ' (안전집 ' + s.whiteSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.whitePotentialTerritory.toFixed(1) + ' + 따낸돌 ' + s.capturedByWhite + ' + 사석 ' + s.deadBlack + ' + 덤 ' + s.komi + ')' +
      ' → ' + winner + '+' + diff.toFixed(1);
    updateSidebarResult(winnerColor, diff, false);
}
function showCountRequestUI() {
    var wrap = document.getElementById('count-request-wrap');
    var msgEl = document.getElementById('count-request-message');
    if (!wrap || !msgEl) return;
    var requester = countRequestedBy === 'black' ? '흑' : '백';
    var responder = countRequestedBy === 'black' ? '백' : '흑';
    msgEl.textContent = requester + '이 계가를 신청했습니다. ' + responder + '이 동의하시겠습니까?';
    wrap.classList.remove('hidden');
}
function hideCountRequestUI() {
    var wrap = document.getElementById('count-request-wrap');
    if (wrap) wrap.classList.add('hidden');
}
function requestCount() {
    if (gameEnded || countRequestedBy) return;
    countRequestedBy = currentTurn;
    showCountRequestUI();
    if (messageEl) messageEl.textContent = '';
}
function agreeCount() {
    if (!countRequestedBy) return;
    hideCountRequestUI();
    countRequestedBy = null;
    countAndEndGame();
}
function refuseCount() {
    if (!countRequestedBy) return;
    countRequestedBy = null;
    hideCountRequestUI();
    if (messageEl) messageEl.textContent = '계가 신청이 거절되었습니다. 게임을 계속합니다.';
}
function countAndEndGame() {
    if (gameEnded) return;
    gameEnded = true;
    stopTimer();
    var s = doCountScore();
    if (!s) return;
    var winnerColor = s.blackScore > s.whiteScore ? 'black' : 'white';
    var winner = winnerColor === 'black' ? '흑' : '백';
    var diff = Math.abs(s.blackScore - s.whiteScore);
    messageEl.textContent =
      '계가 완료(일본식). 흑 ' + s.blackScore.toFixed(1) +
      ' (안전집 ' + s.blackSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.blackPotentialTerritory.toFixed(1) + ' + 따낸돌 ' + s.capturedByBlack + ' + 사석 ' + s.deadWhite + ')' +
      ' : 백 ' + s.whiteScore.toFixed(1) +
      ' (안전집 ' + s.whiteSafeTerritory.toFixed(1) + ' + 우세영역 ' + s.whitePotentialTerritory.toFixed(1) + ' + 따낸돌 ' + s.capturedByWhite + ' + 사석 ' + s.deadBlack + ' + 덤 ' + s.komi + ')' +
      ' → ' + winner + '+' + (diff === Math.floor(diff) ? diff : diff.toFixed(1));
    updateSidebarResult(winnerColor, diff, false);
}
function floodTerritory(r, c, visited) {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return { territory: 0, touchesBlack: false, touchesWhite: false };
    if (visited[r][c]) return { territory: 0, touchesBlack: false, touchesWhite: false };
    const key = r + ',' + c;
    const isDead = deadStoneMarks.has(key);
    if (!isDead && board[r][c] !== EMPTY) {
        const owner = getScoringOwnerAtPoint(r, c);
        if (owner === BLACK) return { territory: 0, touchesBlack: true, touchesWhite: false };
        if (owner === WHITE) return { territory: 0, touchesBlack: false, touchesWhite: true };
        return { territory: 0, touchesBlack: false, touchesWhite: false };
    }
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
        if ((board[r][c] !== EMPTY && !deadStoneMarks.has(r + ',' + c)) || visited[r][c]) continue;
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
    boardEl.querySelectorAll('.cell').forEach(cell => { cell.querySelector('.stone')?.remove(); cell.querySelector('.yellow-stone-cross')?.remove(); cell.querySelector('.dead-stone-x')?.remove(); cell.querySelector('.move-number')?.remove(); cell.querySelector('.alphabet-label')?.remove(); });
    var moveNumMap = {};
    moveHistory.forEach(function (m, i) {
        var displayNum = i - moveNumberDisplayStart + 1;
        if (displayNum >= 1 && displayNum <= MAX_MOVE_NUM_DISPLAY) moveNumMap[m.row + ',' + m.col] = displayNum;
    });
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === EMPTY) continue;
        const cell = boardEl.children[r * SIZE + c];
        const stoneType = board[r][c] === BLACK ? 'black' : board[r][c] === WHITE ? 'white' : 'yellow';
        if (stoneType === 'yellow') { const cross = document.createElement('div'); cross.className = 'yellow-stone-cross'; cell.appendChild(cross); }
        const stone = document.createElement('div');
        stone.className = 'stone ' + stoneType;
        if (lastMove && lastMove[0] === r && lastMove[1] === c) stone.classList.add('last');
        cell.appendChild(stone);
        var num = moveNumMap[r + ',' + c];
        if (showMoveNumbers && num !== undefined) {
            var span = document.createElement('span');
            span.className = 'move-number ' + (stoneType === 'black' ? 'on-black' : 'on-white');
            span.textContent = num;
            cell.appendChild(span);
        }
        if (deadStoneMarks.has(r + ',' + c)) {
            const x = document.createElement('div');
            x.className = 'dead-stone-x';
            x.textContent = 'X';
            cell.appendChild(x);
        }
    }
    for (var i = 0; i < alphabetOrder.length; i++) {
        var pos = alphabetOrder[i];
        var cell = boardEl.children[pos.r * SIZE + pos.c];
        if (!cell) continue;
        var span = document.createElement('span');
        span.className = 'alphabet-label';
        span.textContent = String.fromCharCode(65 + i);
        cell.appendChild(span);
    }
}
function resetGame() {
    currentTurn = BLACK; lastMove = null; capturedBlack = 0; capturedWhite = 0; consecutivePass = 0; gameEnded = false;
    countRequestedBy = null;
    aiThinkState = null;
    if (gameMode === 'ai') aiGameStarted = true;
    boardHistory = []; moveHistory = []; blackMoveCount = 0; whiteMoveCount = 0; yellowAsBlack = new Set(); yellowAsWhite = new Set();
    alphabetOrder = []; alphabetMode = false;
    var ab = document.getElementById('btn-alphabet'); if (ab) { ab.classList.remove('active'); ab.textContent = '알파벳표기'; }
    clearDeadStoneMarks();
    blackTimeRemaining = timeConfig.base;
    whiteTimeRemaining = timeConfig.base;
    stopTimer();
    updateTimeDisplay();
    messageEl.textContent = ''; if (passCountEl) passCountEl.textContent = '';
    hideSidebarResult();
    hideCountRequestUI();
    updateUI(); initBoard();
}

initBoard();
