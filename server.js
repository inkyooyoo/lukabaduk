/* Socket.io 게임 서버 */
const { Server } = require('socket.io');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { register, login, createToken, verifyToken } = require('./lib/auth-server.js');

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
        };
        const blackP = Array.from(room.players.entries()).find(([, p]) => p.color === 1);
        const whiteP = Array.from(room.players.entries()).find(([, p]) => p.color === 2);
        base.whitePlayerName = whiteP ? (whiteP[1].username || whiteP[0]) : '';
        base.blackPlayerName = blackP ? (blackP[1].username || blackP[0]) : '';
      }
      return base;
    });
  }

  class GameRoom {
    constructor(roomId, size) {
      this.roomId = roomId;
      this.size = size;
      this.players = new Map(); // socketId -> { color?: number }
      this.gameState = null;
      this.choosing = false;
      this.createdAt = Date.now();
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
      this.gameState = null;
      this.choosing = false;
      for (const [id, p] of this.players) {
        this.players.set(id, { username: p.username });
      }
    }

    isFull() {
      return this.players.size >= 2;
    }
  }

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create-room', ({ size }) => {
      if (!socket.userId) {
        socket.emit('error', { message: '로그인이 필요합니다.' });
        return;
      }
      if (rooms.size >= MAX_ROOMS) {
        socket.emit('error', { message: `대국실이 가득 찼습니다. (최대 ${MAX_ROOMS}개)` });
        return;
      }
      const roomId = Math.random().toString(36).substring(2, 9);
      const room = new GameRoom(roomId, size || 9);
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
      room.gameState = createInitialState(room.size);
      const blackPlayer = Array.from(room.players.entries()).find(([, p]) => p.color === BLACK)?.[0];
      const whitePlayer = Array.from(room.players.entries()).find(([, p]) => p.color === WHITE)?.[0];
      io.to(roomId).emit('game-started', {
        gameState: room.gameState,
        blackPlayer,
        whitePlayer,
      });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      console.log(`Game started in room: ${roomId}, black: ${blackPlayer}, white: ${whitePlayer}`);
    });

    socket.on('make-move', ({ roomId, row, col }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
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
      const result = doPlaceStone(row, col, room.gameState);
      if (!result.success) {
        socket.emit('move-error', { error: result.error });
        return;
      }

      room.gameState = result.newState;
      io.to(roomId).emit('game-state-updated', { gameState: room.gameState });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
    });

    socket.on('pass-turn', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) {
        socket.emit('error', { message: '게임 상태를 찾을 수 없습니다' });
        return;
      }

      const playerColor = room.getPlayerColor(socket.id);
      if (!playerColor || room.gameState.currentTurn !== playerColor) {
        socket.emit('error', { message: '당신 차례가 아닙니다' });
        return;
      }

      const { doPassTurn } = require('./lib/game-logic-server.js');
      room.gameState = doPassTurn(room.gameState);
      io.to(roomId).emit('game-state-updated', { gameState: room.gameState });
      io.emit('room-list-updated', { rooms: JSON.parse(JSON.stringify(getRoomList())) });
      if (room.gameState.gameEnded) {
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
