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
let timeConfig = { base: 180, byoYomi: 10 };
let lastCreatedRoomTimeConfig = null; // { base, byoYomi } when current user created the room
let countRequestedBy = null; // 1 | 2 | null (who requested count)
let multiplayerTimerId = null;
let deadStoneMarks = new Set(); // "r,c"
let scoringInspectMode = false; // true after countScore/judgePosition until board changes
let lastScoringView = null; // 'count' | 'judge' | null
let isSpectator = false;
let lastSentChatText = '';

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
  if (tab === 'register') {
    const pwEl = document.getElementById('register-password');
    updatePasswordRulesUI(pwEl ? pwEl.value : '');
  }
}

/** 서버와 동일한 비밀번호 규칙 검증 */
function validatePasswordPolicy(password) {
  if (!password || typeof password !== 'string') return { valid: false, message: '비밀번호를 입력하세요' };
  if (password.length < 8) return { valid: false, message: '비밀번호는 8자 이상이어야 합니다' };
  if (!/[A-Z]/.test(password)) return { valid: false, message: '영문 대문자를 1자 이상 포함해 주세요' };
  if (!/[a-z]/.test(password)) return { valid: false, message: '영문 소문자를 1자 이상 포함해 주세요' };
  if (!/[0-9]/.test(password)) return { valid: false, message: '숫자를 1자 이상 포함해 주세요' };
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) return { valid: false, message: '특수문자를 1자 이상 포함해 주세요' };
  if (password.length > 128) return { valid: false, message: '비밀번호는 128자 이하여야 합니다' };
  return { valid: true };
}

function updatePasswordRulesUI(password) {
  const p = password || '';
  const rules = {
    'rule-len': p.length >= 8,
    'rule-upper': /[A-Z]/.test(p),
    'rule-lower': /[a-z]/.test(p),
    'rule-num': /[0-9]/.test(p),
    'rule-special': /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p),
  };
  Object.keys(rules).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('valid', rules[id]);
  });
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
  const passwordConfirm = (document.getElementById('register-password-confirm') && document.getElementById('register-password-confirm').value) || '';
  const errEl = document.getElementById('auth-register-error');
  if (!username) { errEl.textContent = '아이디를 입력하세요.'; return; }
  if (username.length < 2) { errEl.textContent = '아이디는 2자 이상이어야 합니다.'; return; }
  if (username.length > 32) { errEl.textContent = '아이디는 32자 이하여야 합니다.'; return; }
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) { errEl.textContent = policy.message; return; }
  if (password !== passwordConfirm) { errEl.textContent = '비밀번호가 일치하지 않습니다.'; return; }
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
        if (document.getElementById('register-password-confirm')) document.getElementById('register-password-confirm').value = '';
        updatePasswordRulesUI('');
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
  showMainSection('games');
}

const boardEl = document.getElementById('board');
const capBlackEl = document.getElementById('cap-black');
const capWhiteEl = document.getElementById('cap-white');
const passCountEl = document.getElementById('pass-count');
const messageEl = document.getElementById('message');
const waitingRoomCodeEl = document.getElementById('waiting-room-code');
const gameRoomCodeEl = document.getElementById('game-room-code');
const passBtn = document.getElementById('pass-btn');
const undoBtn = document.getElementById('undo-btn');
const timeBlackEl = document.getElementById('time-black');
const timeWhiteEl = document.getElementById('time-white');
const turnEl = document.getElementById('turn');
const myColorLabelEl = document.getElementById('my-color-label');

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

function setTimeLimit(baseSeconds, byoYomiSeconds) {
  timeConfig.base = baseSeconds;
  timeConfig.byoYomi = byoYomiSeconds;
  document.querySelectorAll('.time-btn').forEach(b => b && b.classList.remove('active'));
  const activeId = (baseSeconds === 10 && byoYomiSeconds === 10) ? 'time-10-10' : (baseSeconds === 180 && byoYomiSeconds === 10) ? 'time-3-10' : (baseSeconds === 300 && byoYomiSeconds === 20) ? 'time-5-20' : 'time-10-30';
  const el = document.getElementById(activeId);
  if (el) el.classList.add('active');
}

function formatTime(sec) {
  if (sec == null || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function updateTimeDisplay() {
  if (!gameState) return;
  if (timeBlackEl) timeBlackEl.textContent = formatTime(gameState.blackTimeRemaining);
  if (timeWhiteEl) timeWhiteEl.textContent = formatTime(gameState.whiteTimeRemaining);
}

function stopMultiplayerTimer() {
  if (multiplayerTimerId !== null) {
    clearInterval(multiplayerTimerId);
    multiplayerTimerId = null;
  }
}

function startMultiplayerTimer() {
  stopMultiplayerTimer();
  if (!gameState || gameState.gameEnded) return;
  multiplayerTimerId = setInterval(function () {
    if (!gameState || gameState.gameEnded) {
      stopMultiplayerTimer();
      return;
    }
    if (gameState.currentTurn === BLACK) {
      gameState.blackTimeRemaining = Math.max(0, (gameState.blackTimeRemaining || 0) - 1);
    } else {
      gameState.whiteTimeRemaining = Math.max(0, (gameState.whiteTimeRemaining || 0) - 1);
    }
    updateTimeDisplay();
  }, 1000);
}

function updateSidebarResult(winnerColor, scoreDiff, isTimeWin) {
  const wrap = document.getElementById('sidebar-result');
  const stonesEl = document.getElementById('sidebar-result-stones');
  const textEl = document.getElementById('sidebar-result-text');
  if (!wrap || !stonesEl || !textEl) return;
  const isBlack = winnerColor === 'black' || winnerColor === 1;
  stonesEl.innerHTML = '<div class="sidebar-result-stone ' + (isBlack ? 'black' : 'white') + ' winner"></div>';
  const label = isBlack ? '흑' : '백';
  if (isTimeWin) textEl.textContent = label + ' 시간승';
  else if (scoreDiff != null) textEl.textContent = label + ' ' + (scoreDiff === Math.floor(scoreDiff) ? scoreDiff + '집' : scoreDiff.toFixed(1) + '집') + ' 승';
  else textEl.textContent = label + ' 승';
  wrap.classList.add('show');
}

function hideSidebarResult() {
  const wrap = document.getElementById('sidebar-result');
  if (wrap) wrap.classList.remove('show');
}

function showCountRequestUI() {
  const wrap = document.getElementById('count-request-wrap');
  const msgEl = document.getElementById('count-request-message');
  const btnsEl = document.getElementById('count-request-btns');
  const cancelBtnsEl = document.getElementById('count-request-cancel-btns');
  if (!wrap || !msgEl) return;
  const reqColor = countRequestedBy != null ? Number(countRequestedBy) : null;
  const isRequester = reqColor === myColor;
  const requester = reqColor === 1 ? '흑' : '백';
  const responder = reqColor === 1 ? '백' : '흑';
  if (isRequester) {
    msgEl.textContent = '계가를 신청했습니다. 상대방 응답 대기 중.';
    if (btnsEl) { btnsEl.classList.add('hidden'); btnsEl.style.display = 'none'; }
    if (cancelBtnsEl) {
      cancelBtnsEl.classList.remove('hidden');
      cancelBtnsEl.style.display = 'flex';
    }
  } else {
    msgEl.textContent = requester + '이 계가를 신청했습니다. ' + responder + '이 동의하시겠습니까?';
    if (btnsEl) {
      btnsEl.classList.remove('hidden');
      btnsEl.style.display = 'flex';
      btnsEl.style.visibility = 'visible';
    }
    if (cancelBtnsEl) { cancelBtnsEl.classList.add('hidden'); cancelBtnsEl.style.display = 'none'; }
  }
  wrap.classList.remove('hidden');
  wrap.style.display = 'block';
  wrap.style.visibility = 'visible';
  wrap.style.setProperty('display', 'block', 'important');
  if (!isRequester && wrap.scrollIntoView) wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetCountRequestUIElements() {
  const wrap = document.getElementById('count-request-wrap');
  const msgEl = document.getElementById('count-request-message');
  const btnsEl = document.getElementById('count-request-btns');
  const cancelBtnsEl = document.getElementById('count-request-cancel-btns');
  if (msgEl) msgEl.textContent = '';
  if (btnsEl) {
    btnsEl.classList.remove('hidden');
    btnsEl.style.display = 'flex';
    btnsEl.style.visibility = '';
  }
  if (cancelBtnsEl) {
    cancelBtnsEl.classList.add('hidden');
    cancelBtnsEl.style.display = 'none';
  }
  if (wrap) {
    wrap.classList.add('hidden');
    wrap.style.removeProperty('display');
    wrap.style.removeProperty('visibility');
  }
}

function hideCountRequestUI() {
  resetCountRequestUIElements();
}

function requestCount() {
  if (!gameState || gameState.gameEnded || !roomId) return;
  if (countRequestedBy) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례에만 계가신청할 수 있습니다.';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  socket.emit('request-count', { roomId });
  countRequestedBy = myColor;
  showCountRequestUI();
  messageEl.textContent = '';
}

function agreeCount() {
  if (!countRequestedBy || countRequestedBy === myColor || !roomId) return;
  socket.emit('respond-count', { roomId, agree: true });
  countRequestedBy = null;
  hideCountRequestUI();
}

function refuseCount() {
  if (!countRequestedBy || countRequestedBy === myColor || !roomId) return;
  socket.emit('respond-count', { roomId, agree: false });
  countRequestedBy = null;
  hideCountRequestUI();
  messageEl.textContent = '계가 신청이 거절되었습니다. 게임을 계속합니다.';
}

function cancelCountRequest() {
  if (!countRequestedBy || countRequestedBy !== myColor || !roomId) return;
  socket.emit('cancel-count-request', { roomId });
  countRequestedBy = null;
  hideCountRequestUI();
  if (messageEl) messageEl.textContent = '계가 신청을 취소했습니다.';
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

function joinRoomAsSpectator(roomIdToJoin) {
  const rid = roomIdToJoin != null ? String(roomIdToJoin) : '';
  if (!rid) return;
  if (!isLoggedIn()) {
    showAuthPanel('login');
    return;
  }
  if (!socket) initSocket();
  function doJoin() {
    socket.emit('join-room-as-spectator', { roomId: rid });
  }
  if (socket.connected) {
    doJoin();
  } else {
    socket.once('connect', doJoin);
  }
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
    const isFull = r.playerCount >= 2;
    card.className = 'room-card' + (isFull ? ' full' : '');
    const statusText = r.waiting ? '대기 중' : (r.gameSnapshot && r.gameSnapshot.gameEnded ? '종료' : '대국 중');
    card.innerHTML =
      '<div><span class="room-id">' + r.roomId + '</span><div class="room-meta">' + r.size + '×' + r.size + ' · ' + statusText + (r.spectatorCount ? ' · 관람 ' + r.spectatorCount + '명' : '') + '</div></div>' +
      '<div class="room-players">' + r.playerCount + '/2' + (r.spectatorCount ? ' · 관람 ' + r.spectatorCount : '') + '</div>';
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
    card.style.cursor = 'pointer';
    if (isFull) {
      const rid = r.roomId;
      card.onclick = function () {
        joinRoomAsSpectator(rid);
      };
      const specLabel = document.createElement('div');
      specLabel.className = 'room-card-spectator-label';
      specLabel.textContent = '관람하기';
      card.appendChild(specLabel);
    } else {
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

function refreshRoomList() {
  const btn = document.getElementById('lobby-refresh-btn');
  if (btn) btn.disabled = true;
  if (socket && socket.connected) {
    socket.emit('list-rooms');
    if (btn) setTimeout(function () { btn.disabled = false; }, 500);
  } else {
    if (!socket) initSocket();
    socket.once('room-list', function () { if (btn) btn.disabled = false; });
    socket.once('connect', function () { socket.emit('list-rooms'); });
  }
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
  isSpectator = false;
  stopMultiplayerTimer();
  roomId = null;
  myColor = null;
  gameState = null;
  countRequestedBy = null;
  clearDeadStoneMarks();
  if (boardEl) boardEl.innerHTML = '';
  hideSidebarResult();
  hideCountRequestUI();
  hideStoneChoosing();
  setGameScreenSpectator(false);
  showMainSection('games');
}

function setGameScreenSpectator(spectator) {
  const screen = document.getElementById('screen-game');
  if (screen) screen.classList.toggle('spectator-mode', !!spectator);
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function sendRoomChat() {
  const input = document.getElementById('game-chat-input');
  if (!roomId || !socket || !input) return;
  const text = input.value.trim();
  if (!text) return;
  const username = (getStoredUser() && getStoredUser().username) || '나';
  lastSentChatText = text;
  appendChatMessage(username, text);
  socket.emit('room-chat', { roomId, text });
  input.value = '';
}

function appendChatMessage(username, text) {
  const list = document.getElementById('game-chat-messages');
  if (!list) return;
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = '<span class="chat-user">' + escapeHtml(username) + '</span>' + escapeHtml(text);
  list.appendChild(div);
  list.scrollTop = list.scrollHeight;
}

function clearGameChatMessages() {
  const list = document.getElementById('game-chat-messages');
  if (list) list.innerHTML = '';
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
      : 'lukabaduk 폴더에서 node server.js (또는 pnpm dev)로 서버를 띄운 뒤, 이 페이지를 새로고침해 주세요. (next dev만 쓰면 채팅/대국이 안 됩니다)';
    setMatchStatus(base + hint, true);
    console.warn('Socket connect_error', err);
  });

  socket.on('room-created', ({ roomId: rid }) => {
    roomId = rid;
    myColor = null;
    waitingRoomCodeEl.textContent = rid;
    updateWaitingTimeDisplay(lastCreatedRoomTimeConfig);
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방 입장 대기 중...';
    hideStoneChoosing();
    showScreen('screen-waiting');
  });

  socket.on('room-joined', ({ roomId: rid }) => {
    roomId = rid;
    myColor = null;
    isSpectator = false;
    lastCreatedRoomTimeConfig = null;
    waitingRoomCodeEl.textContent = rid;
    updateWaitingTimeDisplay(null);
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

  socket.on('game-started', ({ gameState: state, blackPlayer, whitePlayer, timeConfig: serverTimeConfig }) => {
    isSpectator = false;
    myColor = socket.id === blackPlayer ? BLACK : WHITE;
    SIZE = state.size;
    if (serverTimeConfig && (serverTimeConfig.base != null || serverTimeConfig.byoYomi != null)) {
      const baseNum = Number(serverTimeConfig.base);
      const byoNum = Number(serverTimeConfig.byoYomi);
      timeConfig = {
        base: (serverTimeConfig.base != null && serverTimeConfig.base !== '' && !Number.isNaN(baseNum)) ? baseNum : 180,
        byoYomi: (serverTimeConfig.byoYomi != null && serverTimeConfig.byoYomi !== '' && !Number.isNaN(byoNum)) ? byoNum : 10,
      };
      const initialBase = Number(serverTimeConfig.base);
      if (!Number.isNaN(initialBase) && initialBase > 0) {
        state = { ...state, blackTimeRemaining: initialBase, whiteTimeRemaining: initialBase };
      }
    }
    gameState = state;
    countRequestedBy = null;
    clearDeadStoneMarks();
    gameRoomCodeEl.textContent = roomId;
    hideStoneChoosing();
    hideSidebarResult();
    hideCountRequestUI();
    if (myColorLabelEl) myColorLabelEl.textContent = myColor === BLACK ? '흑' : '백';
    initBoard();
    updateGameState(state);
    startMultiplayerTimer();
    setGameScreenSpectator(false);
    clearGameChatMessages();
    showScreen('screen-game');
  });

  socket.on('room-joined-as-spectator', ({ roomId: rid, gameState: state, timeConfig: serverTimeConfig }) => {
    roomId = rid;
    myColor = null;
    isSpectator = true;
    SIZE = state.size;
    if (serverTimeConfig && (serverTimeConfig.base != null || serverTimeConfig.byoYomi != null)) {
      const baseNum = Number(serverTimeConfig.base);
      const byoNum = Number(serverTimeConfig.byoYomi);
      timeConfig = {
        base: (serverTimeConfig.base != null && !Number.isNaN(baseNum)) ? baseNum : 180,
        byoYomi: (serverTimeConfig.byoYomi != null && !Number.isNaN(byoNum)) ? byoNum : 10,
      };
    }
    gameState = state;
    countRequestedBy = null;
    clearDeadStoneMarks();
    gameRoomCodeEl.textContent = roomId;
    hideSidebarResult();
    hideCountRequestUI();
    if (myColorLabelEl) myColorLabelEl.textContent = '관람';
    initBoard();
    updateGameState(state);
    startMultiplayerTimer();
    setGameScreenSpectator(true);
    clearGameChatMessages();
    showScreen('screen-game');
  });

  socket.on('opponent-left', () => {
    stopMultiplayerTimer();
    myColor = null;
    gameState = null;
    clearDeadStoneMarks();
    if (boardEl) boardEl.innerHTML = '';
    setWaitingTitle('대기 중...');
    document.getElementById('waiting-message').textContent = '상대방이 나갔습니다. 새 상대를 기다리는 중...';
    hideStoneChoosing();
    showScreen('screen-waiting');
  });

  socket.on('game-state-updated', ({ gameState: state }) => {
    updateGameState(state);
    if (gameState && !gameState.gameEnded) startMultiplayerTimer();
  });

  socket.on('room-chat', ({ username, text }) => {
    const ourName = (getStoredUser() && getStoredUser().username) || '';
    if (ourName && username === ourName && text === lastSentChatText) {
      lastSentChatText = '';
      return;
    }
    appendChatMessage(username, text);
  });

  socket.on('count-requested', ({ requestedBy }) => {
    if (requestedBy != null) countRequestedBy = requestedBy;
    showCountRequestUI();
    if (document.getElementById('screen-game') && !document.getElementById('screen-game').classList.contains('hidden')) {
      const wrap = document.getElementById('count-request-wrap');
      if (wrap && countRequestedBy !== myColor) setTimeout(function () { wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
    }
  });

  socket.on('count-refused', () => {
    countRequestedBy = null;
    hideCountRequestUI();
    messageEl.textContent = '계가 신청이 거절되었습니다. 게임을 계속합니다.';
  });

  socket.on('count-request-cancelled', () => {
    countRequestedBy = null;
    hideCountRequestUI();
    messageEl.textContent = '계가 신청이 취소되었습니다.';
  });

  socket.on('game-ended', ({ gameState: state }) => {
    stopMultiplayerTimer();
    countRequestedBy = null;
    hideCountRequestUI();
    updateGameState(state);
    if (state.timeWin && state.winnerByTime) {
      const winnerColor = state.winnerByTime === 1 ? 'black' : 'white';
      const label = winnerColor === 'black' ? '흑' : '백';
      messageEl.textContent = label + ' 시간승. 게임이 종료되었습니다.';
      updateSidebarResult(winnerColor, null, true);
    } else if (state.countEnd && state.winnerByScore != null && state.blackScore != null && state.whiteScore != null) {
      const winnerColor = state.winnerByScore === 1 ? 'black' : 'white';
      const diff = Math.abs(state.blackScore - state.whiteScore);
      const label = winnerColor === 'black' ? '흑' : '백';
      const blackScoreTxt = Number(state.blackScore).toFixed(1);
      const whiteScoreTxt = Number(state.whiteScore).toFixed(1);
      const diffTxt = diff === Math.floor(diff) ? diff : diff.toFixed(1);
      const localSummary = analyzeScoringState();
      if (localSummary) {
        messageEl.textContent =
          '계가 완료(일본식). 흑 ' + blackScoreTxt +
          ' (안전집 ' + localSummary.safeBlack.toFixed(1) + ' + 우세영역 ' + localSummary.potentialBlack.toFixed(1) + ' + 따낸돌 ' + (state.capturedWhite || 0) + ' + 사석 ' + localSummary.deadWhite + ')' +
          ' : 백 ' + whiteScoreTxt +
          ' (안전집 ' + localSummary.safeWhite.toFixed(1) + ' + 우세영역 ' + localSummary.potentialWhite.toFixed(1) + ' + 따낸돌 ' + (state.capturedBlack || 0) + ' + 사석 ' + localSummary.deadBlack + ' + 덤 6.5)' +
          ' → ' + label + ' ' + diffTxt + '집 승.';
      } else {
        messageEl.textContent = '계가 완료. 흑 ' + blackScoreTxt + '집 : 백 ' + whiteScoreTxt + '집 → ' + label + ' ' + diffTxt + '집 승.';
      }
      updateSidebarResult(winnerColor, diff, false);
    } else if (state.gameEnded) {
      const summary = analyzeScoringState();
      const blackScore = summary ? summary.japaneseBlack : 0;
      const whiteScore = summary ? summary.japaneseWhite : 0;
      const winnerColor = blackScore > whiteScore ? 'black' : 'white';
      const diff = Math.abs(blackScore - whiteScore);
      const label = winnerColor === 'black' ? '흑' : '백';
      messageEl.textContent = '종료. ' + label + ' ' + (diff === Math.floor(diff) ? diff : diff.toFixed(1)) + '집 승.';
      updateSidebarResult(winnerColor, diff, false);
    } else {
      messageEl.textContent = '게임이 종료되었습니다.';
    }
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

function getSelectedTimeFromDOM() {
  const activeBtn = document.querySelector('#section-match .time-limit .time-btn.active');
  if (activeBtn && activeBtn.dataset.base != null && activeBtn.dataset.byoYomi != null) {
    const base = Number(activeBtn.dataset.base);
    const byo = Number(activeBtn.dataset.byoYomi);
    return { base: Number.isNaN(base) ? 180 : base, byoYomi: Number.isNaN(byo) ? 10 : byo };
  }
  return { base: Number(timeConfig.base) || 180, byoYomi: Number(timeConfig.byoYomi) ?? 10 };
}

function formatTimeSettingLabel(baseSec, byoYomiSec) {
  const base = Number(baseSec);
  const byo = Number(byoYomiSec);
  const baseStr = base < 60 ? base + '초' : (base / 60) + '분';
  const byoStr = (byo != null && !Number.isNaN(byo)) ? (byo + '초') : '';
  return byoStr ? baseStr + '+' + byoStr : baseStr;
}

function updateWaitingTimeDisplay(timeConfigForRoom) {
  const wrap = document.getElementById('waiting-time-setting');
  const valueEl = document.getElementById('waiting-time-setting-value');
  if (!wrap || !valueEl) return;
  if (timeConfigForRoom && (timeConfigForRoom.base != null || timeConfigForRoom.byoYomi != null)) {
    valueEl.textContent = formatTimeSettingLabel(timeConfigForRoom.base ?? 180, timeConfigForRoom.byoYomi ?? 10);
    wrap.style.display = '';
  } else {
    valueEl.textContent = '－';
    wrap.style.display = 'none';
  }
}

function createRoom() {
  if (!isLoggedIn()) {
    showAuthPanel('login');
    setMatchStatus('로그인이 필요합니다.', true);
    return;
  }
  setMatchStatus('');
  if (!socket) initSocket();
  const selected = getSelectedTimeFromDOM();
  lastCreatedRoomTimeConfig = { base: selected.base, byoYomi: selected.byoYomi };
  const timeBase = Math.max(1, Number(selected.base) || 180);
  const timeByoYomi = Math.max(0, Number(selected.byoYomi) ?? 10);
  const payload = { size: SIZE, timeBase, timeByoYomi };
  if (socket.connected) {
    socket.emit('create-room', payload);
  } else {
    setMatchStatus('연결 중...', false);
    socket.once('connect', () => {
      setMatchStatus('');
      socket.emit('create-room', { size: SIZE, timeBase, timeByoYomi });
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
  if (scoringInspectMode && gameState.board[row][col] !== EMPTY) {
    toggleDeadStoneMark(row, col);
    return;
  }
  if (countRequestedBy) return;
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
  if (countRequestedBy) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례가 아닙니다';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  socket.emit('pass-turn', { roomId });
}

function undoMove() {
  if (!gameState || gameState.gameEnded) return;
  if (countRequestedBy) return;
  if (gameState.currentTurn !== myColor) {
    messageEl.textContent = '당신 차례가 아닙니다';
    setTimeout(() => { messageEl.textContent = ''; }, 2000);
    return;
  }
  socket.emit('undo-move', { roomId });
}

function updateGameState(state) {
  const prevMoveCount = gameState && gameState.moveHistory ? gameState.moveHistory.length : 0;
  const prevPass = gameState && gameState.consecutivePass;
  const base = (timeConfig && timeConfig.base != null) ? Number(timeConfig.base) : 180;
  if (state != null) {
    const black = (state.blackTimeRemaining != null && state.blackTimeRemaining >= 0) ? state.blackTimeRemaining : (gameState && gameState.blackTimeRemaining != null ? gameState.blackTimeRemaining : base);
    const white = (state.whiteTimeRemaining != null && state.whiteTimeRemaining >= 0) ? state.whiteTimeRemaining : (gameState && gameState.whiteTimeRemaining != null ? gameState.whiteTimeRemaining : base);
    state = { ...state, blackTimeRemaining: Number(black), whiteTimeRemaining: Number(white) };
  }
  const nextMoveCount = state && state.moveHistory ? state.moveHistory.length : 0;
  const nextPass = state ? state.consecutivePass : 0;
  if (nextMoveCount !== prevMoveCount || nextPass !== prevPass) {
    clearDeadStoneMarks();
  }
  gameState = state;
  const isMyTurn = state.currentTurn === myColor;
  const blocked = !!countRequestedBy;
  const spectatorOrNotMyTurn = isSpectator || !isMyTurn;
  const isFirstBlack = state.currentTurn === BLACK && state.blackMoveCount === 0;
  const isFirstWhite = state.currentTurn === WHITE && state.whiteMoveCount === 0;

  if (turnEl) {
    if (state.gameEnded) {
      turnEl.textContent = '종료';
      turnEl.className = '';
    } else {
      let turnTxt = state.currentTurn === BLACK ? '흑' : '백';
      if (isFirstBlack) turnTxt = '흑 (첫 수 → 황색돌)';
      else if (isFirstWhite) turnTxt = '백 (첫 수 → 황색돌)';
      turnTxt += isMyTurn ? ' (내 차례)' : ' (상대 차례)';
      turnEl.textContent = turnTxt;
      turnEl.className = isMyTurn ? 'turn-mine' : 'turn-opponent';
    }
  }
  if (myColorLabelEl && myColor != null) {
    myColorLabelEl.textContent = myColor === BLACK ? '흑' : '백';
  }

  capBlackEl.textContent = state.capturedBlack;
  capWhiteEl.textContent = state.capturedWhite;

  updateTimeDisplay();
  if (state.gameEnded) stopMultiplayerTimer();

  if (state.consecutivePass > 0) {
    passCountEl.textContent = `연속 패스 ${state.consecutivePass}회`;
  } else {
    passCountEl.textContent = '';
  }

  passBtn.disabled = spectatorOrNotMyTurn || state.gameEnded || blocked;
  undoBtn.disabled = spectatorOrNotMyTurn || state.gameEnded || blocked;

  boardEl.querySelectorAll('.cell').forEach(cell => {
    if (!isSpectator && isMyTurn && !state.gameEnded && !blocked) {
      cell.classList.remove('disabled');
    } else {
      cell.classList.add('disabled');
    }
  });

  renderStones();
  if (state.gameEnded) {
    clearTerritoryDisplay();
  } else if (showingTerritory && state.moveHistory && (state.moveHistory.length !== prevMoveCount || state.consecutivePass !== prevPass)) {
    clearTerritoryDisplay();
  }
}

function renderStones() {
  if (!gameState) return;
  boardEl.querySelectorAll('.cell').forEach(cell => {
    cell.querySelector('.stone')?.remove();
    cell.querySelector('.yellow-stone-cross')?.remove();
    cell.querySelector('.dead-stone-x')?.remove();
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
      if (deadStoneMarks.has(r + ',' + c)) {
        const x = document.createElement('div');
        x.className = 'dead-stone-x';
        x.textContent = 'X';
        cell.appendChild(x);
      }
    }
  }
}

function clearTerritoryDisplay() {
  if (!showingTerritory) return;
  showingTerritory = false;
  boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
}

function clearDeadStoneMarks() {
  deadStoneMarks.clear();
  scoringInspectMode = false;
  lastScoringView = null;
}

function getStoneOwnerAt(row, col) {
  if (!gameState || row < 0 || col < 0 || row >= SIZE || col >= SIZE) return EMPTY;
  const v = gameState.board[row][col];
  if (v === BLACK) return BLACK;
  if (v === WHITE) return WHITE;
  if (v === YELLOW) return EMPTY;
  return EMPTY;
}

function getRawOwnerAt(row, col) {
  const v = gameState.board[row][col];
  if (v === BLACK) return BLACK;
  if (v === WHITE) return WHITE;
  if (v === YELLOW) return EMPTY;
  return EMPTY;
}

function getScoringOwnerAtPoint(row, col, ignoreDeadKey) {
  const key = row + ',' + col;
  if (deadStoneMarks.has(key) && key !== ignoreDeadKey) return EMPTY;
  const v = gameState.board[row][col];
  if (v === BLACK) return BLACK;
  if (v === WHITE) return WHITE;
  if (v === YELLOW) return EMPTY;
  return EMPTY;
}

function toggleDeadStoneMark(row, col) {
  if (!scoringInspectMode || !gameState) return false;
  const owner = getStoneOwnerAt(row, col);
  if (owner !== BLACK && owner !== WHITE) return false;
  const key = row + ',' + col;
  if (deadStoneMarks.has(key)) deadStoneMarks.delete(key);
  else deadStoneMarks.add(key);
  renderStones();
  if (lastScoringView === 'judge') renderJudgePosition();
  else if (lastScoringView === 'count') countScore();
  return true;
}

function getDeadStoneCaptureBonus() {
  let deadBlack = 0;
  let deadWhite = 0;
  deadStoneMarks.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const owner = getScoringOwnerAtPoint(r, c, key);
    if (owner === BLACK) deadBlack += 1;
    else if (owner === WHITE) deadWhite += 1;
  });
  return { deadBlack, deadWhite };
}

function analyzeScoringState() {
  if (!gameState) return null;
  const baseDead = new Set(deadStoneMarks);
  const board = gameState.board;
  const size = SIZE;

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
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
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
          const neighbors = [];
          if (cr > 0) neighbors.push([cr - 1, cc]);
          if (cr < size - 1) neighbors.push([cr + 1, cc]);
          if (cc > 0) neighbors.push([cr, cc - 1]);
          if (cc < size - 1) neighbors.push([cr, cc + 1]);
          neighbors.forEach(([nr, nc]) => {
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
    }
    return autoDead;
  }

  const autoDead = detectAutoDead(baseDead);
  const deadSet = new Set([...baseDead, ...autoDead]);

  function ownerAt(r, c) {
    return ownerAtWithDead(r, c, deadSet);
  }

  function pointInfluence(r, c) {
    let blackInfluence = 0;
    let whiteInfluence = 0;
    const radius = size <= 9 ? 4 : size <= 13 ? 5 : 6;
    const decay = 0.72;
    for (let sr = 0; sr < size; sr++) {
      for (let sc = 0; sc < size; sc++) {
        const o = ownerAt(sr, sc);
        if (o !== BLACK && o !== WHITE) continue;
        const dist = Math.abs(sr - r) + Math.abs(sc - c);
        if (dist <= 0 || dist > radius) continue;
        const line = Math.min(r, c, size - 1 - r, size - 1 - c);
        const edgeWeight = line === 0 ? 1.18 : line === 1 ? 1.1 : 1.0;
        const influence = Math.pow(decay, dist - 1) * edgeWeight;
        if (o === BLACK) blackInfluence += influence;
        else whiteInfluence += influence;
      }
    }
    return { blackInfluence, whiteInfluence, diff: blackInfluence - whiteInfluence };
  }

  const visited = Array(size).fill(null).map(() => Array(size).fill(false));
  const safeBlackPoints = [];
  const safeWhitePoints = [];
  const potentialBlackPoints = [];
  const potentialWhitePoints = [];
  const threatenedPoints = [];
  let safeBlack = 0;
  let safeWhite = 0;
  let potentialBlack = 0;
  let potentialWhite = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if ((board[r][c] !== EMPTY && !deadSet.has(r + ',' + c)) || visited[r][c]) continue;
      const queue = [[r, c]];
      visited[r][c] = true;
      const region = [];
      let touchesBlack = false;
      let touchesWhite = false;
      while (queue.length > 0) {
        const [cr, cc] = queue.pop();
        region.push([cr, cc]);
        const neighbors = [];
        if (cr > 0) neighbors.push([cr - 1, cc]);
        if (cr < size - 1) neighbors.push([cr + 1, cc]);
        if (cc > 0) neighbors.push([cr, cc - 1]);
        if (cc < size - 1) neighbors.push([cr, cc + 1]);
        neighbors.forEach(([nr, nc]) => {
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
  }

  let blackStones = 0;
  let whiteStones = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const o = ownerAt(r, c);
      if (o === BLACK) blackStones += 1;
      else if (o === WHITE) whiteStones += 1;
    }
  }

  let deadBlack = 0;
  let deadWhite = 0;
  deadSet.forEach((key) => {
    const [r, c] = key.split(',').map(Number);
    const o = baseOwnerAt(r, c);
    if (o === BLACK) deadBlack += 1;
    else if (o === WHITE) deadWhite += 1;
  });

  const japaneseBlack = safeBlack + potentialBlack + (gameState.capturedWhite || 0) + deadWhite;
  const japaneseWhite = safeWhite + potentialWhite + (gameState.capturedBlack || 0) + deadBlack + 6.5;
  const chineseBlack = safeBlack + potentialBlack + blackStones;
  const chineseWhite = safeWhite + potentialWhite + whiteStones + 6.5;

  return {
    safeBlackPoints, safeWhitePoints, potentialBlackPoints, potentialWhitePoints, threatenedPoints,
    safeBlack, safeWhite, potentialBlack, potentialWhite,
    deadBlack, deadWhite, blackStones, whiteStones,
    japaneseBlack, japaneseWhite, chineseBlack, chineseWhite,
    autoDeadCount: autoDead.size,
  };
}

function getCellAt(r, c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function countStones(color) {
  if (!gameState) return 0;
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (getScoringOwnerAtPoint(r, c) === color) n++;
    }
  }
  return n;
}

function floodTerritory(r, c, visited, board, size, yellowAsBlack, yellowAsWhite, deadMarks) {
  if (r < 0 || r >= size || c < 0 || c >= size) return { territory: 0, touchesBlack: false, touchesWhite: false };
  if (visited[r][c]) return { territory: 0, touchesBlack: false, touchesWhite: false };
  const key = r + ',' + c;
  const isDead = deadMarks && deadMarks.has(key);
  if (!isDead && board[r][c] !== EMPTY) {
    const owner = getScoringOwnerAtPoint(r, c);
    if (owner === BLACK) return { territory: 0, touchesBlack: true, touchesWhite: false };
    if (owner === WHITE) return { territory: 0, touchesBlack: false, touchesWhite: true };
    return { territory: 0, touchesBlack: false, touchesWhite: false };
  }
  visited[r][c] = true;
  let territory = 1, touchesBlack = false, touchesWhite = false;
  const neighbors = [];
  if (r > 0) neighbors.push([r - 1, c]);
  if (r < size - 1) neighbors.push([r + 1, c]);
  if (c > 0) neighbors.push([r, c - 1]);
  if (c < size - 1) neighbors.push([r, c + 1]);
  neighbors.forEach(([nr, nc]) => {
    const res = floodTerritory(nr, nc, visited, board, size, yellowAsBlack, yellowAsWhite, deadMarks);
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
      const dead = deadStoneMarks.has(r + ',' + c);
      if ((!dead && gameState.board[r][c] !== EMPTY) || visited[r][c]) continue;
      const res = floodTerritory(r, c, visited, gameState.board, SIZE, gameState.yellowAsBlack, gameState.yellowAsWhite, deadStoneMarks);
      if (res.touchesBlack && !res.touchesWhite) total += color === BLACK ? res.territory : 0;
      if (res.touchesWhite && !res.touchesBlack) total += color === WHITE ? res.territory : 0;
    }
  }
  return total;
}

function countScore() {
  if (!gameState) return;
  scoringInspectMode = true;
  lastScoringView = 'count';
  const s = analyzeScoringState();
  if (!s) return;
  const blackScore = s.japaneseBlack;
  const whiteScore = s.japaneseWhite;
  const winner = blackScore > whiteScore ? '흑' : '백';
  const diff = Math.abs(blackScore - whiteScore).toFixed(1);
  messageEl.textContent =
    `집계산(일본식 단일): 흑 ${blackScore.toFixed(1)} (안전집 ${s.safeBlack.toFixed(1)} + 우세영역 ${s.potentialBlack.toFixed(1)} + 따낸돌 ${gameState.capturedWhite || 0} + 사석 ${s.deadWhite}) : 백 ${whiteScore.toFixed(1)} (안전집 ${s.safeWhite.toFixed(1)} + 우세영역 ${s.potentialWhite.toFixed(1)} + 따낸돌 ${gameState.capturedBlack || 0} + 사석 ${s.deadBlack} + 덤 6.5) → ${winner}+${diff}`;
}

function floodTerritoryWithPoints(r, c, visited, board, size, yellowAsBlack, yellowAsWhite, deadMarks) {
  if (r < 0 || r >= size || c < 0 || c >= size) return { points: [], touchesBlack: false, touchesWhite: false };
  if (visited[r][c]) return { points: [], touchesBlack: false, touchesWhite: false };
  const key = r + ',' + c;
  const isDead = deadMarks && deadMarks.has(key);
  if (!isDead && board[r][c] !== EMPTY) {
    const owner = getScoringOwnerAtPoint(r, c);
    if (owner === BLACK) return { points: [], touchesBlack: true, touchesWhite: false };
    if (owner === WHITE) return { points: [], touchesBlack: false, touchesWhite: true };
    return { points: [], touchesBlack: false, touchesWhite: false };
  }
  visited[r][c] = true;
  let points = [[r, c]], touchesBlack = false, touchesWhite = false;
  const neighbors = [];
  if (r > 0) neighbors.push([r - 1, c]);
  if (r < size - 1) neighbors.push([r + 1, c]);
  if (c > 0) neighbors.push([r, c - 1]);
  if (c < size - 1) neighbors.push([r, c + 1]);
  neighbors.forEach(([nr, nc]) => {
    const res = floodTerritoryWithPoints(nr, nc, visited, board, size, yellowAsBlack, yellowAsWhite, deadMarks);
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
      const dead = deadStoneMarks.has(r + ',' + c);
      if ((!dead && gameState.board[r][c] !== EMPTY) || visited[r][c]) continue;
      const res = floodTerritoryWithPoints(r, c, visited, gameState.board, SIZE, gameState.yellowAsBlack, gameState.yellowAsWhite, deadStoneMarks);
      regions.push(res);
    }
  }
  return regions;
}

function getStoneOwnerAtPoint(r, c) {
  return getScoringOwnerAtPoint(r, c);
}

function getEdgeWeight(r, c) {
  const line = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
  if (line === 0) return 1.22; // 귀
  if (line === 1) return 1.12; // 변 인접
  if (line === 2) return 1.05;
  return 1.0;
}

function evaluateAdvantageAreas() {
  if (!gameState) return { settledBlack: new Set(), settledWhite: new Set(), blackAdvPoints: [], whiteAdvPoints: [], blackAdvScore: 0, whiteAdvScore: 0 };
  const settledBlack = new Set();
  const settledWhite = new Set();
  getTerritoryRegions().forEach(({ points, touchesBlack, touchesWhite }) => {
    if (touchesBlack && !touchesWhite) points.forEach(([r, c]) => settledBlack.add(r + ',' + c));
    else if (touchesWhite && !touchesBlack) points.forEach(([r, c]) => settledWhite.add(r + ',' + c));
  });

  const radius = SIZE <= 9 ? 4 : SIZE <= 13 ? 5 : 6;
  const decay = 0.72;
  const advantageThreshold = 0.22;
  const strongThreshold = 0.9;
  const blackAdvPoints = [];
  const whiteAdvPoints = [];
  let blackAdvScore = 0;
  let whiteAdvScore = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (gameState.board[r][c] !== EMPTY && !deadStoneMarks.has(r + ',' + c)) continue;
      const key = r + ',' + c;
      if (settledBlack.has(key) || settledWhite.has(key)) continue;

      let blackInfluence = 0;
      let whiteInfluence = 0;
      for (let sr = 0; sr < SIZE; sr++) {
        for (let sc = 0; sc < SIZE; sc++) {
          const owner = getStoneOwnerAtPoint(sr, sc);
          if (owner !== BLACK && owner !== WHITE) continue;
          const dist = Math.abs(sr - r) + Math.abs(sc - c);
          if (dist <= 0 || dist > radius) continue;
          let influence = Math.pow(decay, dist - 1) * getEdgeWeight(r, c);
          const stoneLine = Math.min(sr, sc, SIZE - 1 - sr, SIZE - 1 - sc);
          const targetLine = Math.min(r, c, SIZE - 1 - r, SIZE - 1 - c);
          if (stoneLine <= 1 && targetLine <= 1) influence *= 1.08; // 귀/변 형태 보정
          if (owner === BLACK) blackInfluence += influence;
          else whiteInfluence += influence;
        }
      }

      const diff = blackInfluence - whiteInfluence;
      const absDiff = Math.abs(diff);
      if (absDiff < advantageThreshold) continue;
      const strength = Math.min(1, (absDiff - advantageThreshold) / (strongThreshold - advantageThreshold));
      if (diff > 0) {
        blackAdvPoints.push([r, c, strength]);
        blackAdvScore += strength;
      } else {
        whiteAdvPoints.push([r, c, strength]);
        whiteAdvScore += strength;
      }
    }
  }
  return { settledBlack, settledWhite, blackAdvPoints, whiteAdvPoints, blackAdvScore, whiteAdvScore };
}

function renderJudgePosition() {
  if (!gameState) return;
  const s = analyzeScoringState();
  if (!s) return;
  function evaluateProbabilisticPosition(stateSummary) {
    const uncertain = stateSummary.threatenedPoints || [];
    const iterations = SIZE <= 9 ? 120 : SIZE <= 13 ? 180 : 240;
    const radius = SIZE <= 9 ? 3 : SIZE <= 13 ? 4 : 5;
    const decay = 0.74;
    function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    function influenceDiffAt(r, c) {
      let blackInf = 0;
      let whiteInf = 0;
      for (let sr = 0; sr < SIZE; sr++) {
        for (let sc = 0; sc < SIZE; sc++) {
          const owner = getScoringOwnerAtPoint(sr, sc);
          if (owner !== BLACK && owner !== WHITE) continue;
          const dist = Math.abs(sr - r) + Math.abs(sc - c);
          if (dist <= 0 || dist > radius) continue;
          const inf = Math.pow(decay, dist - 1);
          if (owner === BLACK) blackInf += inf;
          else whiteInf += inf;
        }
      }
      return blackInf - whiteInf;
    }
    const pointProb = uncertain.map(([r, c]) => {
      const d = influenceDiffAt(r, c);
      const pBlack = Math.max(0.08, Math.min(0.92, sigmoid(d * 1.35)));
      return { r, c, pBlack };
    });
    const avgCertainty = pointProb.length === 0 ? 1 : pointProb.reduce((acc, p) => acc + Math.abs(p.pBlack - 0.5) * 2, 0) / pointProb.length;
    const baseJapaneseDiff = stateSummary.japaneseBlack - stateSummary.japaneseWhite;
    const baseChineseDiff = stateSummary.chineseBlack - stateSummary.chineseWhite;
    const valueDiff = baseJapaneseDiff * 0.65 + baseChineseDiff * 0.35;
    const valueWinRate = sigmoid(valueDiff / 6.0);
    let mctsWinsBlack = 0;
    let diffSum = 0;
    for (let i = 0; i < iterations; i++) {
      let b = stateSummary.japaneseBlack;
      let w = stateSummary.japaneseWhite;
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
  const p = evaluateProbabilisticPosition(s);
  const bw = (p.blackWinRate * 100).toFixed(1);
  const ww = (p.whiteWinRate * 100).toFixed(1);
  const absDiff = Math.abs(p.predictedDiff).toFixed(1);
  let msg;
  if (Math.abs(p.predictedDiff) < 1) msg = `형세판단: 접전 (승률 흑 ${bw}% / 백 ${ww}%, 예상 집차 약 0~1집, 신뢰도 ${(p.confidence * 100).toFixed(0)}%)`;
  else if (p.predictedDiff > 0) msg = `형세판단: 흑 우세 (승률 흑 ${bw}% / 백 ${ww}%, 예상 흑 +${absDiff}집, 신뢰도 ${(p.confidence * 100).toFixed(0)}%)`;
  else msg = `형세판단: 백 우세 (승률 흑 ${bw}% / 백 ${ww}%, 예상 백 +${absDiff}집, 신뢰도 ${(p.confidence * 100).toFixed(0)}%)`;
  msg += ` · 가치평가+시뮬레이션(${p.iterations}회)`;
  messageEl.textContent = msg;
  boardEl.querySelectorAll('.cell .territory-dot').forEach(el => el.remove());
  s.safeBlackPoints.forEach(([r, c]) => {
    const cell = getCellAt(r, c);
    if (!cell) return;
    const dot = document.createElement('span');
    dot.className = 'territory-dot territory-black-dot';
    cell.appendChild(dot);
  });
  s.safeWhitePoints.forEach(([r, c]) => {
    const cell = getCellAt(r, c);
    if (!cell) return;
    const dot = document.createElement('span');
    dot.className = 'territory-dot territory-white-dot';
    cell.appendChild(dot);
  });
  s.potentialBlackPoints.forEach(([r, c, strength]) => {
    const cell = getCellAt(r, c);
    if (!cell) return;
    const dot = document.createElement('span');
    dot.className = 'territory-dot territory-black-adv-dot';
    dot.style.opacity = String(Math.max(0.28, Math.min(0.78, 0.28 + strength * 0.5)));
    cell.appendChild(dot);
  });
  s.potentialWhitePoints.forEach(([r, c, strength]) => {
    const cell = getCellAt(r, c);
    if (!cell) return;
    const dot = document.createElement('span');
    dot.className = 'territory-dot territory-white-adv-dot';
    dot.style.opacity = String(Math.max(0.28, Math.min(0.78, 0.28 + strength * 0.5)));
    cell.appendChild(dot);
  });
  s.threatenedPoints.forEach(([r, c]) => {
    const cell = getCellAt(r, c);
    if (!cell) return;
    const dot = document.createElement('span');
    dot.className = 'territory-dot territory-threat-dot';
    cell.appendChild(dot);
  });
  showingTerritory = true;
}

function judgePosition() {
  if (!gameState) return;
  scoringInspectMode = true;
  lastScoringView = 'judge';
  if (showingTerritory) {
    clearTerritoryDisplay();
    messageEl.textContent = '';
    return;
  }
  renderJudgePosition();
}

function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const userStr = params.get('user');
  const oauthError = params.get('oauth_error');
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      setToken(token);
      setUser(user);
      if (socket) { socket.disconnect(); socket = null; }
      window.history.replaceState({}, document.title, window.location.pathname || '/lukabaduk.html');
    } catch (e) {}
  }
  if (oauthError) {
    const msg = oauthError === 'not_configured' ? '소셜 로그인이 설정되지 않았습니다.' :
      oauthError === 'use_custom_server' ? '소셜 로그인을 사용하려면 터미널에서 "pnpm dev"로 서버를 실행해 주세요. (next dev만으로는 동작하지 않습니다)' :
      oauthError === 'access_denied' ? '로그인이 취소되었습니다.' :
      oauthError === 'token_failed' ? '토큰 발급에 실패했습니다.' :
      oauthError === 'no_code' ? '인증 코드를 받지 못했습니다.' :
      '소셜 로그인 중 오류가 발생했습니다.';
    showAuthPanel('login');
    const errEl = document.getElementById('auth-login-error');
    if (errEl) errEl.textContent = msg;
    window.history.replaceState({}, document.title, window.location.pathname || '/lukabaduk.html');
  }
}

handleOAuthCallback();
updateAuthUI();

(function initPasswordRules() {
  const pwEl = document.getElementById('register-password');
  if (pwEl) {
    pwEl.addEventListener('input', function () { updatePasswordRulesUI(this.value); });
    pwEl.addEventListener('blur', function () { updatePasswordRulesUI(this.value); });
  }
})();

(function initGameChat() {
  const input = document.getElementById('game-chat-input');
  if (input) {
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendRoomChat();
      }
    });
  }
})();
