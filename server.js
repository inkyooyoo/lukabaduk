/* Socket.io 게임 서버 */
const { Server } = require('socket.io');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { register, login, createToken, verifyToken } = require('./lib/auth-server.js');
const gtpAi = require('./lib/gtp-ai.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/socket.io/')) {
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/register') {
      try {
        const body = await readBody(req);
        const { username, password } = JSON.parse(body || '{}');
        const user = register(username, password);
        const token = createToken(user.id, user.username);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, token, user: { id: user.id, username: user.username } }));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/login') {
      try {
        const body = await readBody(req);
        const { username, password } = JSON.parse(body || '{}');
        const user = login(username, password);
        const token = createToken(user.id, user.username);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, token, user: { id: user.id, username: user.username } }));
      } catch (err) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/ai-capable') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        gtp: gtpAi.isConfigured(),
        pachi: gtpAi.isEngineConfigured('pachi'),
        gnugo: gtpAi.isEngineConfigured('gnugo'),
      }));
      return;
    }

    if (req.method === 'POST' && parsedUrl.pathname === '/api/ai-move') {
      try {
        const body = await readBody(req);
        const { size, moves, colorToPlay, timeRemainingSec, engine } = JSON.parse(body || '{}');
        const useEngine = engine === 'gnugo' ? 'gnugo' : 'pachi';
        if (!gtpAi.isEngineConfigured(useEngine)) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: useEngine + ' engine not configured' }));
          return;
        }
        if (!size || !Array.isArray(moves) || !colorToPlay || timeRemainingSec == null) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'size, moves, colorToPlay, timeRemainingSec required' }));
          return;
        }
        const allowedSizes = [9, 13, 19];
        if (!Number.isInteger(size) || !allowedSizes.includes(size)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'size must be 9, 13, or 19' }));
          return;
        }
        const colorOk = colorToPlay === 'B' || colorToPlay === 'W';
        if (!colorOk) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'colorToPlay must be B or W' }));
          return;
        }
        for (let i = 0; i < moves.length; i++) {
          const m = moves[i];
          const c = m && (m.color === 'B' || m.color === 'W');
          const r = typeof m.row === 'number' && m.row >= 0 && m.row < size;
          const col = typeof m.col === 'number' && m.col >= 0 && m.col < size;
          if (!c || !r || !col) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'invalid move at index ' + i }));
            return;
          }
        }
        const result = await gtpAi.getMove(size, moves, colorToPlay, Math.max(1, timeRemainingSec), useEngine);
        res.setHeader('Content-Type', 'application/json');
        if (result === null) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'engine timeout or error' }));
          return;
        }
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: String(err.message) }));
      }
      return;
    }

    try {
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      try {
        const payload = verifyToken(token);
        socket.userId = payload.userId;
        socket.username = payload.username;
      } catch (e) {}
    }
    next();
  });

  // 게임 방 관리 (최대 6개)
  const MAX_ROOMS = 6;
  const rooms = new Map(); // roomId -> GameRoom

  function getRoomList() {
    return Array.from(rooms.entries()).map(([id, room]) => {
      const base = {
        roomId: id,
        size: room.size,
        playerCount: room.players.size,
        waiting: !room.gameState,
      };
      if (room.gameState) {
        base.gameSnapshot = {
          size: room.gameState.size,
          board: room.gameState.board.map((row) => row.slice()),
          currentTurn: room.gameState.currentTurn,
          gameEnded: room.gameState.gameEnded,
          yellowAsBlack: (room.gameState.yellowAsBlack || []).slice(),
          yellowAsWhite: (room.gameState.yellowAsWhite || []).slice(),
          blackTimeRemaining: room.gameState.blackTimeRemaining,
          whiteTimeRemaining: room.gameState.whiteTimeRemaining,
          timeWin: room.gameState.timeWin,
          winnerByTime: room.gameState.winnerByTime,
        };
        const blackP = Array.from(room.players.entries()).find(([, p]) => p.color === 1);
        const whiteP = Array.from(room.players.entries()).find(([, p]) => p.color === 2);
        base.whitePlayerName = whiteP ? (whiteP[1].username || whiteP[0]) : '';
        base.blackPlayerName = blackP ? (blackP[1].username || blackP[0]) : '';
      }
      return base;
    });
  }

  const DEFAULT_TIME_BASE = 300;
  const DEFAULT_TIME_BYOYOMI = 20;

  class GameRoom {
    constructor(roomId, size, timeConfig) {
      this.roomId = roomId;
      this.size = size;
      this.timeConfig = timeConfig || { base: DEFAULT_TIME_BASE, byoYomi: DEFAULT_TIME_BYOYOMI };
      this.players = new Map(); // socketId -> { color?: number }
      this.gameState = null;
      this.choosing = false;
      this.createdAt = Date.now();
      this.timerId = null;
      this.countRequestedBy = null; // 1 | 2 | null
    }

    addPlayer(socketId, username) {
      if (this.players.size >= 2) return false;
      this.players.set(socketId, { username: username || socketId });
      return true;
    }

    setPlayerUsername(socketId, username) {
      const p = this.players.get(socketId);
      if (p) p.username = username || socketId;
    }

    removePlayer(socketId) {
      this.players.delete(socketId);
    }

    setColor(socketId, color) {
      const p = this.players.get(socketId);
      if (p) p.color = color;
    }

    getPlayerColor(socketId) {
      return this.players.get(socketId)?.color;
    }

    getOtherPlayer(socketId) {
      for (const [id] of this.players) {
        if (id !== socketId) return id;
      }
      return null;
    }

    getChooserSocketId() {
      const ids = Array.from(this.players.keys());
      return ids.length >= 2 ? ids[1] : null;
    }

    resetForNewOpponent() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.gameState = null;
      this.choosing = false;
      this.countRequestedBy = null;
      for (const [id, p] of this.players) {
        this.players.set(id, { username: p.username });
      }
    }

    startGameTimer(io, roomId) {
      if (this.timerId) return;
      const room = this;
      this.timerId = setInterval(() => {
        if (!room.gameState || room.gameState.gameEnded) {
          if (room.timerId) clearInterval(room.timerId);
          room.timerId = null;
          return;
        }
        const cur = room.gameState.currentTurn;
        const byo = room.timeConfig.byoYomi || DEFAULT_TIME_BYOYOMI;
        if (cur === 1) {
          room.gameState.blackTimeRemaining = Math.max(0, (room.gameState.blackTimeRemaining || 0) - 1);
          if (room.gameState.blackTimeRemaining <= 0) {
            room.gameState.gameEnded = true;
            room.gameState.timeWin = true;
            room.gameState.winnerByTime = 2;
            room.gameState.blackTimeRemaining = 0;
            if (room.timerId) clearInterval(room.timerId);
            room.timerId = null;
            const gs = room.gameState;
            io.to(roomId).emit('game-state-updated', { gameState: { ...gs, blackTimeRemaining: 0, whiteTimeRemaining: Math.max(0, Number(gs.whiteTimeRemaining)) } });
            io.to(roomId).emit('game-ended', { gameState: room.gameState });
            io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
            return;
          }
        } else {
          room.gameState.whiteTimeRemaining = Math.max(0, (room.gameState.whiteTimeRemaining || 0) - 1);
          if (room.gameState.whiteTimeRemaining <= 0) {
            room.gameState.gameEnded = true;
            room.gameState.timeWin = true;
            room.gameState.winnerByTime = 1;
            room.gameState.whiteTimeRemaining = 0;
            if (room.timerId) clearInterval(room.timerId);
            room.timerId = null;
            const gs = room.gameState;
            io.to(roomId).emit('game-state-updated', { gameState: { ...gs, blackTimeRemaining: Math.max(0, Number(gs.blackTimeRemaining)), whiteTimeRemaining: 0 } });
            io.to(roomId).emit('game-ended', { gameState: room.gameState });
            io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
            return;
          }
        }
        const gs = room.gameState;
        io.to(roomId).emit('game-state-updated', {
          gameState: {
            ...gs,
            blackTimeRemaining: Math.max(0, Number(gs.blackTimeRemaining)),
            whiteTimeRemaining: Math.max(0, Number(gs.whiteTimeRemaining)),
          },
        });
      }, 1000);
    }

    isFull() {
      return this.players.size >= 2;
    }
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create-room', (data) => {
      if (!socket.userId) {
        socket.emit('error', { message: '로그인이 필요합니다.' });
        return;
      }
      if (rooms.size >= MAX_ROOMS) {
        socket.emit('error', { message: `대국실이 가득 찼습니다. (최대 ${MAX_ROOMS}개)` });
        return;
      }
      const { size, timeBase, timeByoYomi } = data || {};
      const roomId = Math.random().toString(36).substring(2, 9);
      const baseSec = (timeBase != null && timeBase !== '') ? Number(timeBase) : DEFAULT_TIME_BASE;
      const byoSec = (timeByoYomi != null && timeByoYomi !== '') ? Number(timeByoYomi) : DEFAULT_TIME_BYOYOMI;
      const timeConfig = {
        base: (typeof baseSec === 'number' && !Number.isNaN(baseSec) && baseSec > 0) ? baseSec : DEFAULT_TIME_BASE,
        byoYomi: (typeof byoSec === 'number' && !Number.isNaN(byoSec) && byoSec >= 0) ? byoSec : DEFAULT_TIME_BYOYOMI,
      };
      const room = new GameRoom(roomId, size || 9, timeConfig);
      rooms.set(roomId, room);
      socket.join(roomId);
      room.addPlayer(socket.id, socket.username);
      socket.emit('room-created', { roomId });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on('list-rooms', () => {
      socket.emit('room-list', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
    });

    socket.on('join-room', ({ roomId }) => {
      if (!socket.userId) {
        socket.emit('error', { message: '로그인이 필요합니다.' });
        return;
      }
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: '방을 찾을 수 없습니다' });
        return;
      }
      if (room.isFull()) {
        socket.emit('error', { message: '방이 가득 찼습니다' });
        return;
      }

      socket.join(roomId);
      room.addPlayer(socket.id, socket.username);
      socket.emit('room-joined', { roomId });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });

      if (room.isFull()) {
        room.choosing = true;
        io.to(roomId).emit('stone-choosing', { roomId });
        console.log(`Stone choosing in room: ${roomId}`);
      } else {
        io.to(roomId).emit('waiting-for-player', { roomId });
      }
    });

    socket.on('choose-color', ({ roomId, color }) => {
      const room = rooms.get(roomId);
      if (!room || !room.choosing) {
        socket.emit('error', { message: '돌가르기 상태가 아닙니다' });
        return;
      }
      if (!room.players.has(socket.id)) {
        socket.emit('error', { message: '이 방의 플레이어가 아닙니다' });
        return;
      }
      const BLACK = 1, WHITE = 2;
      const chosen = color === BLACK || color === 1 ? BLACK : WHITE;
      const other = chosen === BLACK ? WHITE : BLACK;
      room.setColor(socket.id, chosen);
      room.setColor(room.getOtherPlayer(socket.id), other);
      room.choosing = false;
      const { createInitialState } = require('./lib/game-logic-server.js');
      const tc = room.timeConfig || {};
      const baseSec = Number(tc.base);
      const byoSec = Number(tc.byoYomi);
      const timeConfigForGame = {
        base: (Number.isNaN(baseSec) || baseSec <= 0) ? DEFAULT_TIME_BASE : baseSec,
        byoYomi: (Number.isNaN(byoSec) || byoSec < 0) ? DEFAULT_TIME_BYOYOMI : byoSec,
      };
      room.timeConfig = timeConfigForGame;
      room.gameState = createInitialState(room.size, timeConfigForGame);
      const blackPlayer = Array.from(room.players.entries()).find(([, p]) => p.color === BLACK)?.[0];
      const whitePlayer = Array.from(room.players.entries()).find(([, p]) => p.color === WHITE)?.[0];
      io.to(roomId).emit('game-started', {
        gameState: room.gameState,
        blackPlayer,
        whitePlayer,
        timeConfig: timeConfigForGame,
      });
      room.startGameTimer(io, roomId);
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      console.log(`Game started in room: ${roomId}, black: ${blackPlayer}, white: ${whitePlayer}`);
    });

    socket.on('make-move', ({ roomId, row, col }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
        return;
      }
      if (room.countRequestedBy) {
        socket.emit('move-error', { error: '계가 신청에 응답해 주세요' });
        return;
      }

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor) {
        socket.emit('error', { message: '플레이어 정보를 찾을 수 없습니다' });
        return;
      }

      if (room.gameState.currentTurn !== playerColor) {
        socket.emit('error', { message: '당신 차례가 아닙니다' });
        return;
      }

      const { doPlaceStone } = require('./lib/game-logic-server.js');
      const base = room.timeConfig.base != null ? room.timeConfig.base : DEFAULT_TIME_BASE;
      const byoYomi = room.timeConfig.byoYomi != null ? room.timeConfig.byoYomi : DEFAULT_TIME_BYOYOMI;
      const prevBlackTime = room.gameState.blackTimeRemaining != null && room.gameState.blackTimeRemaining >= 0 ? room.gameState.blackTimeRemaining : base;
      const prevWhiteTime = room.gameState.whiteTimeRemaining != null && room.gameState.whiteTimeRemaining >= 0 ? room.gameState.whiteTimeRemaining : base;

      const result = doPlaceStone(row, col, room.gameState);
      if (!result.success) {
        socket.emit('move-error', { error: result.error });
        return;
      }

      room.gameState = result.newState;
      const justPlayed = result.newState.currentTurn === 1 ? 2 : 1;
      const blackNow = (result.newState.blackTimeRemaining != null && result.newState.blackTimeRemaining >= 0) ? Number(result.newState.blackTimeRemaining) : prevBlackTime;
      const whiteNow = (result.newState.whiteTimeRemaining != null && result.newState.whiteTimeRemaining >= 0) ? Number(result.newState.whiteTimeRemaining) : prevWhiteTime;
      room.gameState.blackTimeRemaining = justPlayed === 1 ? blackNow + Number(byoYomi) : blackNow;
      room.gameState.whiteTimeRemaining = justPlayed === 2 ? whiteNow + Number(byoYomi) : whiteNow;

      const gs = room.gameState;
      io.to(roomId).emit('game-state-updated', {
        gameState: {
          ...gs,
          blackTimeRemaining: Number(gs.blackTimeRemaining),
          whiteTimeRemaining: Number(gs.whiteTimeRemaining),
        },
      });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
    });

    socket.on('pass-turn', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
        return;
      }
      if (room.countRequestedBy) {
        socket.emit('move-error', { error: '계가 신청에 응답해 주세요' });
        return;
      }

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor || room.gameState.currentTurn !== playerColor) {
        socket.emit('error', { message: '당신 차례가 아닙니다' });
        return;
      }

      const { doPassTurn } = require('./lib/game-logic-server.js');
      room.gameState = doPassTurn(room.gameState);
      const justPlayed = room.gameState.currentTurn === 1 ? 2 : 1;
      const byo = Number(room.timeConfig.byoYomi ?? DEFAULT_TIME_BYOYOMI);
      if (justPlayed === 1) room.gameState.blackTimeRemaining = Number(room.gameState.blackTimeRemaining || 0) + byo;
      else room.gameState.whiteTimeRemaining = Number(room.gameState.whiteTimeRemaining || 0) + byo;
      io.to(roomId).emit('game-state-updated', {
        gameState: {
          ...room.gameState,
          blackTimeRemaining: Number(room.gameState.blackTimeRemaining),
          whiteTimeRemaining: Number(room.gameState.whiteTimeRemaining),
        },
      });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      if (room.gameState.gameEnded) {
        if (room.timerId) { clearInterval(room.timerId); room.timerId = null; }
        io.to(roomId).emit('game-ended', { gameState: room.gameState });
        io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      }
    });

    socket.on('undo-move', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
        return;
      }
      if (room.countRequestedBy) {
        socket.emit('move-error', { error: '계가 신청에 응답해 주세요' });
        return;
      }

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor || room.gameState.currentTurn !== playerColor) {
        socket.emit('error', { message: '당신 차례가 아닙니다' });
        return;
      }

      const { doUndoMove } = require('./lib/game-logic-server.js');
      const result = doUndoMove(room.gameState);
      if (!result.success) {
        socket.emit('move-error', { error: result.error });
        return;
      }

      room.gameState = result.newState;
      io.to(roomId).emit('game-state-updated', { gameState: room.gameState });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
    });

    socket.on('request-count', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
        return;
      }
      if (room.gameState.gameEnded) {
        socket.emit('error', { message: '이미 게임이 종료되었습니다' });
        return;
      }
      if (room.countRequestedBy) {
        socket.emit('move-error', { error: '이미 계가 신청이 있습니다' });
        return;
      }
      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor) return;
      room.countRequestedBy = playerColor;
      socket.emit('count-requested', { requestedBy: playerColor });
      socket.to(roomId).emit('count-requested', { requestedBy: playerColor });
    });

    socket.on('respond-count', ({ roomId, agree }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) return;
      if (!room.countRequestedBy) {
        socket.emit('move-error', { error: '계가 신청이 없습니다' });
        return;
      }
      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor || playerColor === room.countRequestedBy) {
        socket.emit('move-error', { error: '상대방만 동의/거절할 수 있습니다' });
        return;
      }
      if (agree) {
        const { getScore } = require('./lib/game-logic-server.js');
        const { blackScore, whiteScore } = getScore(room.gameState);
        room.gameState.gameEnded = true;
        room.gameState.countEnd = true;
        room.gameState.blackScore = blackScore;
        room.gameState.whiteScore = whiteScore;
        room.gameState.winnerByScore = blackScore > whiteScore ? 1 : 2;
        room.countRequestedBy = null;
        if (room.timerId) {
          clearInterval(room.timerId);
          room.timerId = null;
        }
        io.to(roomId).emit('game-state-updated', { gameState: room.gameState });
        io.to(roomId).emit('game-ended', { gameState: room.gameState });
        io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      } else {
        room.countRequestedBy = null;
        io.to(roomId).emit('count-refused', {});
      }
    });

    socket.on('cancel-count-request', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) return;
      if (!room.countRequestedBy) {
        socket.emit('move-error', { error: '계가 신청이 없습니다' });
        return;
      }
      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor || playerColor !== room.countRequestedBy) {
        socket.emit('move-error', { error: '신청자만 취소할 수 있습니다' });
        return;
      }
      room.countRequestedBy = null;
      io.to(roomId).emit('count-request-cancelled', {});
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      for (const [rId, room] of rooms) {
        if (room.players.has(socket.id)) {
          room.removePlayer(socket.id);
          socket.leave(rId);
          if (room.players.size === 0) {
            rooms.delete(rId);
            console.log(`Room deleted: ${rId}`);
          } else {
            room.resetForNewOpponent();
            io.to(rId).emit('opponent-left', { roomId: rId });
          }
          io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
          break;
        }
      }
    });
  });

  httpServer.listen(port, (err) => {
    if (err) {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n포트 ${port}이(가) 이미 사용 중입니다.`);
        console.error('다른 터미널에서 실행 중인 서버를 종료하거나, 아래 명령으로 프로세스를 종료하세요:\n');
        console.error('  Windows: for /f "tokens=5" %a in (\'netstat -ano ^| findstr :' + port + '\') do taskkill /F /PID %a');
        console.error('  또는: npx kill-port ' + port + '\n');
        process.exit(1);
      }
      throw err;
    }
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
