/* 루카바둑 멀티플레이어 클라이언트 */
const EMPTY = 0, BLACK = 1, WHITE = 2, YELLOW = 3;
const AUTH_STORAGE_KEY = 'lukabaduk_token';
const USER_STORAGE_KEY = 'lukabaduk_user';

let SIZE = 9;
let socket = null;
let roomId = null;
let myColor = null;
let gameState = null;
let showingTerritory = false;

function getToken() { return localStorage.getItem(AUTH_STORAGE_KEY); }
function setToken(token) { if (token) localStorage.setItem(AUTH_STORAGE_KEY, token); else localStorage.removeItem(AUTH_STORAGE_KEY); }
function removeToken() { localStorage.removeItem(AUTH_STORAGE_KEY); localStorage.removeItem(USER_STORAGE_KEY); }
function getStoredUser() { try { return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)); } catch (e) { return null; } }
function setUser(user) { if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_STORAGE_KEY); }
function isLoggedIn() { return !!getToken(); }

function updateAuthUI() {
  const navGuest = document.getElementById('auth-nav');
  const navLogged = document.getElementById('auth-nav-logged');
  const usernameEl = document.getElementById('nav-username');
  const loginReqMsg = document.getElementById('login-required-msg');
  const drawerGuest = document.getElementById('drawer-auth-guest');
  const drawerLogged = document.getElementById('drawer-auth-logged');
  const drawerUsername = document.getElementById('drawer-username');
  if (navGuest) navGuest.style.display = isLoggedIn() ? 'none' : 'flex';
  if (navLogged) navLogged.style.display = isLoggedIn() ? 'flex' : 'none';
  if (usernameEl) usernameEl.textContent = (getStoredUser() && getStoredUser().username) ? getStoredUser().username + '님' : '';
  if (drawerGuest) drawerGuest.style.display = isLoggedIn() ? 'none' : 'flex';
  if (drawerLogged) drawerLogged.style.display = isLoggedIn() ? 'flex' : 'none';
  if (drawerUsername) drawerUsername.textContent = (getStoredUser() && getStoredUser().username) ? getStoredUser().username + '님' : '';
  if (loginReqMsg) loginReqMsg.style.display = isLoggedIn() ? 'none' : 'block';
}

function showAuthPanel(tab) {
  const panel = document.getElementById('auth-panel');
  if (panel) panel.classList.add('show');
  switchAuthTab(tab || 'login');
  document.getElementById('auth-login-error').textContent = '';
  document.getElementById('auth-register-error').textContent = '';
}

function hideAuthPanel() {
  const panel = document.getElementById('auth-panel');
  if (panel) panel.classList.remove('show');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tabs button').forEach(b => b.classList.remove('active'));
  document.getElementById('auth-tab-' + tab).classList.add('active');
  document.getElementById('auth-login-wrap').classList.toggle('show', tab === 'login');
  document.getElementById('auth-register-wrap').classList.toggle('show', tab === 'register');
}

function doLogin() {
  const username = (document.getElementById('login-username').value || '').trim();
  const password = document.getElementById('login-password').value || '';
  const errEl = document.getElementById('auth-login-error');
  if (!username || !password) { errEl.textContent = '아이디와 비밀번호를 입력하세요.'; return; }
  errEl.textContent = '';
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.ok) {
        setToken(data.token);
        setUser(data.user);
        if (socket) { socket.disconnect(); socket = null; }
        updateAuthUI();
        hideAuthPanel();
        document.getElementById('login-password').value = '';
      } else {
        errEl.textContent = data.error || '로그인에 실패했습니다.';
      }
    })
    .catch(() => { errEl.textContent = '연결할 수 없습니다.'; });
}

function doRegister() {
  const username = (document.getElementById('register-username').value || '').trim();
  const password = document.getElementById('register-password').value || '';
  const errEl = document.getElementById('auth-register-error');
  if (!username || !password) { errEl.textContent = '아이디와 비밀번호를 입력하세요.'; return; }
  errEl.textContent = '';
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.ok) {
        setToken(data.token);
        setUser(data.user);
        if (socket) { socket.disconnect(); socket = null; }
        updateAuthUI();
        hideAuthPanel();
        document.getElementById('register-password').value = '';
      } else {
        errEl.textContent = data.error || '가입에 실패했습니다.';
      }
    })
    .catch(() => { errEl.textContent = '연결할 수 없습니다.'; });
}

function doLogout() {
  removeToken();
  if (socket) { socket.disconnect(); socket = null; }
  roomId = null;
  myColor = null;
  gameState = null;
  updateAuthUI();
  showMainSection('match');
}

const boardEl = document.getElementById('board');
const capBlackEl = document.getElementById('cap-black');
const capWhiteEl = document.getElementById('cap-white');
const passCountEl = document.getElementById('pass-count');
const messageEl = document.getElementById('message');
const waitingRoomCodeEl = document.getElementById('waiting-room-code');
const gameRoomCodeEl = document.getElementById('game-room-code');
const sidebarStoneEl = document.getElementById('sidebar-stone');
const sidebarTurnEl = document.getElementById('sidebar-turn');
const passBtn = document.getElementById('pass-btn');
const undoBtn = document.getElementById('undo-btn');

function getStarPoints(size) {
  if (size === 9) return [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]];
  if (size === 13) return [[3, 3], [3, 9], [6, 6], [9, 3], [9, 9]];
  if (size === 19) return [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]];
  return [];
}

function setBoardSize(size) {
  SIZE = size;
  document.querySelectorAll('.board-size .btn').forEach(b => b.classList.remove('active'));
  document.getElementById('size-' + size).classList.add('active');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function showMainSection(section) {
  document.querySelectorAll('.game-nav a[id^="nav-"]').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.game-nav-drawer a[data-section]').forEach(a => a.classList.remove('active'));
  const nav = document.getElementById('nav-' + section);
  if (nav) nav.classList.add('active');
  const drawerNav = document.querySelector('.game-nav-drawer a[data-section="' + section + '"]');
  if (drawerNav) drawerNav.classList.add('active');
  document.querySelectorAll('#section-match, #section-games, #section-learn').forEach(el => el.classList.add('hidden'));
  const panel = document.getElementById('section-' + section);
  if (panel) panel.classList.remove('hidden');
  document.getElementById('screen-waiting')?.classList.add('hidden');
  document.getElementById('screen-game')?.classList.add('hidden');
  if (section === 'games' || section === 'match') {
    refreshRoomList();
  }
  updateAuthUI();
}

function toggleMobileNav() {
  const toggle = document.getElementById('game-nav-toggle');
  const drawer = document.getElementById('game-nav-drawer');
  if (toggle && drawer) {
    toggle.classList.toggle('open');
    drawer.classList.toggle('open');
  }
}

function closeMobileNav() {
  const toggle = document.getElementById('game-nav-toggle');
  const drawer = document.getElementById('game-nav-drawer');
  if (toggle && drawer) {
    toggle.classList.remove('open');
    drawer.classList.remove('open');
  }
}

function refreshRoomList() {
  const listEl = document.getElementById('room-list');
  const emptyEl = document.getElementById('lobby-empty');
  if (!listEl) return;
  if (!socket || !socket.connected) {
    if (!socket) initSocket();
    socket.once('connect', () => {
      socket.emit('list-rooms');
    });
    return;
  }
  socket.emit('list-rooms');
}

function createMiniBoard(size, gameSnapshot) {
  const wrap = document.createElement('div');
  wrap.className = 'mini-board-wrap';
  const totalPx = 248;
  const canvas = document.createElement('canvas');
  canvas.width = totalPx;
  canvas.height = totalPx;
  canvas.className = 'mini-board-canvas';
  const ctx = canvas.getContext('2d');
  const cellPx = totalPx / (size + 1);
  const padding = cellPx * 0.5;

  ctx.fillStyle = '#daa84b';
  ctx.fillRect(0, 0, totalPx, totalPx);

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i++) {
    const p = padding + i * (totalPx - 2 * padding) / (size - 1) || padding;
    ctx.beginPath();
    ctx.moveTo(p, padding);
    ctx.lineTo(p, totalPx - padding);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(padding, p);
    ctx.lineTo(totalPx - padding, p);
    ctx.stroke();
  }

  const starPoints = getStarPoints(size);
  ctx.fillStyle = '#333';
  starPoints.forEach(function (pt) {
    const [sr, sc] = pt;
    const x = padding + sc * (totalPx - 2 * padding) / (size - 1) || padding;
    const y = padding + sr * (totalPx - 2 * padding) / (size - 1) || padding;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  });

  if (gameSnapshot && gameSnapshot.board && Array.isArray(gameSnapshot.board)) {
    const board = gameSnapshot.board;
    const radius = Math.max(4, (totalPx - 2 * padding) / (size - 1) / 2 * 0.88);

    for (let r = 0; r < size; r++) {
      const row = board[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < size; c++) {
        const val = Number(row[c]);
        const key = r + ',' + c;
        const x = padding + c * (totalPx - 2 * padding) / (size - 1) || padding;
        const y = padding + r * (totalPx - 2 * padding) / (size - 1) || padding;

        if (val === YELLOW) {
          ctx.fillStyle = '#e6c200';
          ctx.strokeStyle = '#b39800';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (val === BLACK) {
          ctx.fillStyle = '#1a1a1a';
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (val === WHITE) {
          ctx.fillStyle = '#f5f5f5';
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }
  }

  wrap.appendChild(canvas);
  return wrap;
}

function renderRoomList(rooms) {
  const listEl = document.getElementById('room-list');
  const emptyEl = document.getElementById('lobby-empty');
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';
  if (!rooms || rooms.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  rooms.slice(0, 6).forEach(function (r) {
    const li = document.createElement('li');
    const card = document.createElement('div');
    card.className = 'room-card' + (r.playerCount >= 2 ? ' full' : '');
    const statusText = r.waiting ? '대기 중' : (r.gameSnapshot && r.gameSnapshot.gameEnded ? '종료' : '대국 중');
    card.innerHTML =
      '<div><span class="room-id">' + r.roomId + '</span><div class="room-meta">' + r.size + '×' + r.size + ' · ' + statusText + '</div></div>' +
      '<div class="room-players">' + r.playerCount + '/2</div>';
    card.appendChild(createMiniBoard(r.size, r.gameSnapshot || null));
    const playersRow = document.createElement('div');
    playersRow.className = 'room-card-players';
    const whitePart = document.createElement('span');
    whitePart.className = 'room-card-player white';
    whitePart.innerHTML = '<span class="room-card-stone room-card-stone-white"></span><span class="room-card-name">' + (r.whitePlayerName || '—') + '</span>';
    const blackPart = document.createElement('span');
    blackPart.className = 'room-card-player black';
    blackPart.innerHTML = '<span class="room-card-stone room-card-stone-black"></span><span class="room-card-name">' + (r.blackPlayerName || '—') + '</span>';
    playersRow.appendChild(whitePart);
    playersRow.appendChild(blackPart);
    card.appendChild(playersRow);
    if (r.playerCount < 2) {
      card.style.cursor = 'pointer';
      card.onclick = function () {
        if (!isLoggedIn()) { showAuthPanel('login'); return; }
        document.getElementById('room-code-input').value = r.roomId;
        if (!socket) initSocket();
        socket.emit('join-room', { roomId: r.roomId });
      };
    }
    li.appendChild(card);
    listEl.appendChild(li);
  });
}

function renderMatchAvailableRooms(rooms) {
  const listEl = document.getElementById('match-available-rooms');
  const emptyEl = document.getElementById('match-available-empty');
  if (!listEl || !emptyEl) return;
  const available = (rooms || []).filter(function (r) { return r.playerCount < 2; });
  listEl.innerHTML = '';
  if (available.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  available.forEach(function (r) {
    const li = document.createElement('li');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'room-chip';
    chip.innerHTML = '<span class="room-chip-id">' + r.roomId + '</span><span class="room-chip-meta">' + r.size + '×' + r.size + ' · 입장</span>';
    chip.onclick = function () {
      if (!isLoggedIn()) { showAuthPanel('login'); return; }
      if (!socket) initSocket();
      socket.emit('join-room', { roomId: r.roomId });
    };
    li.appendChild(chip);
    listEl.appendChild(li);
  });
}

function setWaitingTitle(text) {
  const el = document.getElementById('waiting-screen-title');
  if (el) el.textContent = text;
}

function hideStoneChoosing() {
  const wrap = document.getElementById('stone-choosing-wrap');
  const msg = document.getElementById('waiting-message');
  const hint = document.getElementById('waiting-hint');
  if (wrap) wrap.classList.add('hidden');
  if (msg) msg.classList.remove('hidden');
  if (hint) hint.classList.remove('hidden');
}

function chooseColor(color) {
  if (!roomId || !socket) return;
  socket.emit('choose-color', { roomId, color: color === BLACK ? 1 : 2 });
  hideStoneChoosing();
  document.getElementById('waiting-message').textContent = '상대방 대기 중...';
}

function goToStart() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  roomId = null;
  myColor = null;
  gameState = null;
  if (boardEl) boardEl.innerHTML = '';
  hideStoneChoosing();
  showMainSection('match');
}

function setMatchStatus(text, isError) {
  const el = document.getElementById('match-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'match-status' + (isError ? '' : text ? ' ok' : '');
}

function initSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  socket = io(`${protocol}//${host}`, {
    transports: ['websocket', 'polling'],
    auth: { token: getToken() },
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    setMatchStatus('');
  });

  socket.on('connect_error', (err) => {
    const base = '서버에 연결할 수 없습니다. ';
    const hint = window.location.protocol === 'file:'
      ? '브라우저 주소창에 http://localhost:3000/lukabaduk.html 로 접속해 주세요.'
      : '터미널에서 npm run dev 로 실행한 뒤, 이 페이지를 새로고침해 주세요.';
    setMatchStatus(base + hint, true);
    console.warn('Socket connect_error', err);
  });

  socket.on('room-created', ({ roomId: rid }) => {
    roomId = rid;
    myColor = null;
    waitingRoomCodeEl.textContent = rid;
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방 입장 대기 중...';
    hideStoneChoosing();
    showScreen('screen-waiting');
  });

  socket.on('room-joined', ({ roomId: rid }) => {
    roomId = rid;
    myColor = null;
    waitingRoomCodeEl.textContent = rid;
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방 입장 대기 중...';
    hideStoneChoosing();
    showScreen('screen-waiting');
  });

  socket.on('waiting-for-player', () => {
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방 입장 대기 중...';
    hideStoneChoosing();
  });

  socket.on('stone-choosing', () => {
    const wrap = document.getElementById('stone-choosing-wrap');
    const msg = document.getElementById('waiting-message');
    const hint = document.getElementById('waiting-hint');
    const prompt = document.getElementById('stone-choosing-prompt');
    if (!wrap || !msg) return;
    setWaitingTitle('돌가르기');
    msg.classList.add('hidden');
    if (hint) hint.classList.add('hidden');
    wrap.classList.remove('hidden');
    if (prompt) prompt.textContent = '흑 또는 백을 선택하세요';
  });

  socket.on('game-started', ({ gameState: state, blackPlayer, whitePlayer }) => {
    myColor = socket.id === blackPlayer ? BLACK : WHITE;
    gameState = state;
    SIZE = state.size;
    gameRoomCodeEl.textContent = roomId;
    hideStoneChoosing();
    if (sidebarStoneEl) {
      sidebarStoneEl.className = 'sidebar-stone ' + (myColor === BLACK ? 'black' : 'white');
    }
    initBoard();
    updateGameState(state);
    showScreen('screen-game');
  });

  socket.on('opponent-left', () => {
    myColor = null;
    gameState = null;
    if (boardEl) boardEl.innerHTML = '';
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방이 나갔습니다. 새 상대를 기다리는 중...';
    hideStoneChoosing();
    showScreen('screen-waiting');
  });

  socket.on('game-state-updated', ({ gameState: state }) => {
    updateGameState(state);
  });

  socket.on('game-ended', ({ gameState: state }) => {
    updateGameState(state);
    messageEl.textContent = '게임이 종료되었습니다.';
  });

  socket.on('move-error', ({ error }) => {
    messageEl.textContent = error;
    setTimeout(() => { messageEl.textContent = ''; }, 3000);
  });

  socket.on('error', ({ message }) => {
    if (message === '로그인이 필요합니다.') {
      showAuthPanel('login');
      setMatchStatus(message, true);
    } else {
      alert(message);
    }
  });


  socket.on('disconnect', () => {
    messageEl.textContent = '서버 연결이 끊어졌습니다.';
  });

  socket.on('room-list', ({ rooms }) => {
    renderRoomList(rooms);
    renderMatchAvailableRooms(rooms);
    updateCreateButtonState(rooms);
  });

  socket.on('room-list-updated', ({ rooms }) => {
    renderRoomList(rooms);
    renderMatchAvailableRooms(rooms);
    updateCreateButtonState(rooms);
  });
}

function updateCreateButtonState(rooms) {
  const createBtn = document.getElementById('create-room-btn');
  if (createBtn) createBtn.disabled = rooms && rooms.length >= 6;
}

function createRoom() {
  if (!isLoggedIn()) {
    showAuthPanel('login');
    setMatchStatus('로그인이 필요합니다.', true);
    return;
  }
  setMatchStatus('');
  if (!socket) initSocket();
  if (socket.connected) {
    socket.emit('create-room', { size: SIZE });
  } else {
    setMatchStatus('연결 중...', false);
    socket.once('connect', () => {
      setMatchStatus('');
      socket.emit('create-room', { size: SIZE });
    });
  }
}

function joinRoom() {
  const code = document.getElementById('room-code-input').value.trim();
  if (!code) {
    alert('방 코드를 입력해주세요');
    return;
  }
  if (!isLoggedIn()) {
    showAuthPanel('login');
    setMatchStatus('로그인이 필요합니다.', true);
    return;
  }
  setMatchStatus('');
  if (!socket) initSocket();
  if (socket.connected) {
    socket.emit('join-room', { roomId: code });
  } else {
    setMatchStatus('연결 중...', false);
    socket.once('connect', () => {
      setMatchStatus('');
      socket.emit('join-room', { roomId: code });
    });
  }
}

function initBoard() {
  boardEl.innerHTML = '';
  const maxDim = SIZE === 9 ? 320 : SIZE === 13 ? 380 : 480;
  const dim = Math.min(window.innerWidth * 0.92, maxDim);
  boardEl.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${SIZE}, 1fr)`;
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
      if (starPoints.some(([sr, sc]) => sr === r && sc === c)) {
        const dot = document.createElement('span');
        dot.className = 'star-dot';
        cell.appendChild(dot);
      }
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => placeStone(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function placeStone(row, col) {
  if (!gameState || gameState.gameEnded) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례가 아닙니다';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  if (gameState.board[row][col] !== EMPTY) return;
  socket.emit('make-move', { roomId, row, col });
}

function passTurn() {
  if (!gameState || gameState.gameEnded) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례가 아닙니다';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  socket.emit('pass-turn', { roomId });
}

function undoMove() {
  if (!gameState || gameState.gameEnded) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례가 아닙니다';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  socket.emit('undo-move', { roomId });
}

function updateGameState(state) {
  gameState = state;
  const isMyTurn = state.currentTurn === myColor;

  if (sidebarTurnEl) {
    if (state.gameEnded) {
      sidebarTurnEl.textContent = '차례: 종료';
      sidebarTurnEl.className = 'game-sidebar-item';
    } else {
      sidebarTurnEl.textContent = isMyTurn ? '차례: 내 차례' : '차례: 상대방 차례';
      sidebarTurnEl.className = 'game-sidebar-item ' + (isMyTurn ? 'turn-mine' : 'turn-opponent');
    }
  }

  capBlackEl.textContent = state.capturedBlack;
  capWhiteEl.textContent = state.capturedWhite;

  if (state.consecutivePass > 0) {
    passCountEl.textContent = `연속 패스 ${state.consecutivePass}회`;
  } else {
    passCountEl.textContent = '';
  }

  // 버튼 활성화/비활성화
  passBtn.disabled = !isMyTurn || state.gameEnded;
  undoBtn.disabled = !isMyTurn || state.gameEnded;

  // 보드 셀 활성화/비활성화
  boardEl.querySelectorAll('.cell').forEach(cell => {
    if (isMyTurn && !state.gameEnded) {
      cell.classList.remove('disabled');
    } else {
      cell.classList.add('disabled');
    }
  });

  renderStones();
  clearTerritoryDisplay();
}

function renderStones() {
  if (!gameState) return;
  boardEl.querySelectorAll('.cell').forEach(cell => {
    cell.querySelector('.stone')?.remove();
    cell.querySelector('.yellow-stone-cross')?.remove();
  });

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (gameState.board[r][c] === EMPTY) continue;
      const cell = boardEl.children[r * SIZE + c];
      const stoneType = gameState.board[r][c] === BLACK ? 'black' :
                        gameState.board[r][c] === WHITE ? 'white' : 'yellow';
      if (stoneType === 'yellow') {
        const cross = document.createElement('div');
        cross.className = 'yellow-stone-cross';
        cell.appendChild(cross);
      }
      const stone = document.createElement('div');
      stone.className = `stone ${stoneType}`;
      if (gameState.lastMove && gameState.lastMove[0] === r && gameState.lastMove[1] === c) {
        stone.classList.add('last');
      }
      cell.appendChild(stone);
    }
  }
}

function clearTerritoryDisplay() {
  if (!showingTerritory) return;
  showingTerritory = false;
  boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
}

function getCellAt(r, c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function countStones(color) {
  if (!gameState) return 0;
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (gameState.board[r][c] === color) n++;
      else if (gameState.board[r][c] === YELLOW && color === BLACK && gameState.yellowAsBlack.includes(r + ',' + c)) n++;
      else if (gameState.board[r][c] === YELLOW && color === WHITE && gameState.yellowAsWhite.includes(r + ',' + c)) n++;
    }
  }
  return n;
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
  const neighbors = [];
  if (r > 0) neighbors.push([r - 1, c]);
  if (r < size - 1) neighbors.push([r + 1, c]);
  if (c > 0) neighbors.push([r, c - 1]);
  if (c < size - 1) neighbors.push([r, c + 1]);
  neighbors.forEach(([nr, nc]) => {
    const res = floodTerritory(nr, nc, visited, board, size, yellowAsBlack, yellowAsWhite);
    territory += res.territory;
    touchesBlack = touchesBlack || res.touchesBlack;
    touchesWhite = touchesWhite || res.touchesWhite;
  });
  return { territory, touchesBlack, touchesWhite };
}

function countTerritory(color) {
  if (!gameState) return 0;
  const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
  let total = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (gameState.board[r][c] !== EMPTY || visited[r][c]) continue;
      const res = floodTerritory(r, c, visited, gameState.board, SIZE, gameState.yellowAsBlack, gameState.yellowAsWhite);
      if (res.touchesBlack && !res.touchesWhite) total += color === BLACK ? res.territory : 0;
      if (res.touchesWhite && !res.touchesBlack) total += color === WHITE ? res.territory : 0;
    }
  }
  return total;
}

function countScore() {
  if (!gameState) return;
  const blackTerritory = countTerritory(BLACK);
  const whiteTerritory = countTerritory(WHITE);
  const blackStones = countStones(BLACK);
  const whiteStones = countStones(WHITE);
  const blackScore = blackTerritory + blackStones + gameState.capturedWhite;
  const whiteScore = whiteTerritory + whiteStones + gameState.capturedBlack + 6.5;
  const winner = blackScore > whiteScore ? '흑' : '백';
  const diff = Math.abs(blackScore - whiteScore).toFixed(1);
  messageEl.textContent = `집계산: 흑 ${blackScore.toFixed(1)} (집 ${blackTerritory} + 돌 ${blackStones} + 포로 ${gameState.capturedWhite}) : 백 ${whiteScore.toFixed(1)} (집 ${whiteTerritory} + 돌 ${whiteStones} + 포로 ${gameState.capturedBlack} + 코미 6.5) → ${winner}+${diff}`;
}

function floodTerritoryWithPoints(r, c, visited, board, size, yellowAsBlack, yellowAsWhite) {
  if (r < 0 || r >= size || c < 0 || c >= size) return { points: [], touchesBlack: false, touchesWhite: false };
  if (visited[r][c]) return { points: [], touchesBlack: false, touchesWhite: false };
  if (board[r][c] === BLACK) return { points: [], touchesBlack: true, touchesWhite: false };
  if (board[r][c] === WHITE) return { points: [], touchesBlack: false, touchesWhite: true };
  if (board[r][c] === YELLOW) {
    const key = r + ',' + c;
    return { points: [], touchesBlack: yellowAsBlack.includes(key), touchesWhite: yellowAsWhite.includes(key) };
  }
  visited[r][c] = true;
  let points = [[r, c]], touchesBlack = false, touchesWhite = false;
  const neighbors = [];
  if (r > 0) neighbors.push([r - 1, c]);
  if (r < size - 1) neighbors.push([r + 1, c]);
  if (c > 0) neighbors.push([r, c - 1]);
  if (c < size - 1) neighbors.push([r, c + 1]);
  neighbors.forEach(([nr, nc]) => {
    const res = floodTerritoryWithPoints(nr, nc, visited, board, size, yellowAsBlack, yellowAsWhite);
    points = points.concat(res.points);
    touchesBlack = touchesBlack || res.touchesBlack;
    touchesWhite = touchesWhite || res.touchesWhite;
  });
  return { points, touchesBlack, touchesWhite };
}

function getTerritoryRegions() {
  if (!gameState) return [];
  const visited = Array(SIZE).fill(null).map(() => Array(SIZE).fill(false));
  const regions = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (gameState.board[r][c] !== EMPTY || visited[r][c]) continue;
      const res = floodTerritoryWithPoints(r, c, visited, gameState.board, SIZE, gameState.yellowAsBlack, gameState.yellowAsWhite);
      regions.push(res);
    }
  }
  return regions;
}

function judgePosition() {
  if (!gameState) return;
  if (showingTerritory) {
    clearTerritoryDisplay();
    messageEl.textContent = '';
    return;
  }
  const blackTerritory = countTerritory(BLACK);
  const whiteTerritory = countTerritory(WHITE);
  const blackStones = countStones(BLACK);
  const whiteStones = countStones(WHITE);
  const blackScore = blackTerritory + blackStones + gameState.capturedWhite;
  const whiteScore = whiteTerritory + whiteStones + gameState.capturedBlack + 6.5;
  const diff = blackScore - whiteScore;
  let msg;
  if (Math.abs(diff) < 1) msg = `형세판단: 접전 (흑 ${blackScore.toFixed(1)} : 백 ${whiteScore.toFixed(1)}) · 파랑=흑집, 연한색=백집`;
  else if (diff > 0) msg = `형세판단: 흑 우세 (흑 ${blackScore.toFixed(1)} : 백 ${whiteScore.toFixed(1)}, +${diff.toFixed(1)}) · 파랑=흑집, 연한색=백집`;
  else msg = `형세판단: 백 우세 (흑 ${blackScore.toFixed(1)} : 백 ${whiteScore.toFixed(1)}, +${(-diff).toFixed(1)}) · 파랑=흑집, 연한색=백집`;
  messageEl.textContent = msg;
  boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
  getTerritoryRegions().forEach(({ points, touchesBlack, touchesWhite }) => {
    if (touchesBlack && !touchesWhite) {
      points.forEach(([r, c]) => {
        const cell = getCellAt(r, c);
        if (cell) {
          const dot = document.createElement('span');
          dot.className = 'territory-dot territory-black-dot';
          cell.appendChild(dot);
        }
      });
    } else if (touchesWhite && !touchesBlack) {
      points.forEach(([r, c]) => {
        const cell = getCellAt(r, c);
        if (cell) {
          const dot = document.createElement('span');
          dot.className = 'territory-dot territory-white-dot';
          cell.appendChild(dot);
        }
      });
    }
  });
  showingTerritory = true;
}

updateAuthUI();
