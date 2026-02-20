/* 간단 인증 - 회원가입/로그인 (서버) */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'lukabaduk-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 7;

function loadUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    if (e.code === 'ENOENT') return { users: [] };
    throw e;
  }
}

function saveUsers(data) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function hashPassword(password) {
  return crypto.scryptSync(password, 'lukabaduk-salt', 64).toString('hex');
}

function verifyPassword(password, hash) {
  const h = hashPassword(password);
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

function createToken(userId, username) {
  const payload = {
    userId,
    username,
    exp: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  return payloadB64 + '.' + sig;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') throw new Error('no token');
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) throw new Error('invalid token');
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB64).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('invalid token');
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  if (payload.exp < Date.now()) throw new Error('token expired');
  return payload;
}

function register(username, password) {
  if (!username || !password) throw new Error('아이디와 비밀번호를 입력하세요');
  const trimmed = username.trim();
  if (trimmed.length < 2) throw new Error('아이디는 2자 이상이어야 합니다');
  if (password.length < 4) throw new Error('비밀번호는 4자 이상이어야 합니다');
  const data = loadUsers();
  if (data.users.some((u) => u.username.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('이미 사용 중인 아이디입니다');
  }
  const id = crypto.randomUUID();
  data.users.push({
    id,
    username: trimmed,
    passwordHash: hashPassword(password),
  });
  saveUsers(data);
  return { id, username: trimmed };
}

function login(username, password) {
  if (!username || !password) throw new Error('아이디와 비밀번호를 입력하세요');
  const data = loadUsers();
  const user = data.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) throw new Error('아이디 또는 비밀번호가 맞지 않습니다');
  return { id: user.id, username: user.username };
}

module.exports = {
  loadUsers,
  createToken,
  verifyToken,
  register,
  login,
};
