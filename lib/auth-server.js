/* 간단 인증 - 회원가입/로그인 (서버) */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'lukabaduk-secret-change-in-production';
const LEGACY_SALT = 'lukabaduk-salt';
const TOKEN_EXPIRY_DAYS = 7;

/** 비밀번호 보안 규칙: 8자 이상, 영문 대·소문자, 숫자, 특수문자 각 1자 이상 */
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

function hashPassword(password, salt) {
  const s = salt || LEGACY_SALT;
  const saltBuf = typeof s === 'string' && s.length === 32 && /^[0-9a-f]+$/i.test(s)
    ? Buffer.from(s, 'hex')
    : Buffer.from(s, 'utf8');
  return crypto.scryptSync(password, saltBuf, 64).toString('hex');
}

function verifyPassword(password, hash, userSalt) {
  const salt = userSalt || LEGACY_SALT;
  const h = hashPassword(password, salt);
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
  const policy = validatePasswordPolicy(password);
  if (!policy.valid) throw new Error(policy.message);
  const trimmed = username.trim();
  if (trimmed.length < 2) throw new Error('아이디는 2자 이상이어야 합니다');
  if (trimmed.length > 32) throw new Error('아이디는 32자 이하여야 합니다');
  if (!/^[\w\uac00-\ud7a3\u3131-\u318e\s-]+$/.test(trimmed)) throw new Error('아이디에 사용할 수 없는 문자가 포함되어 있습니다');
  const data = loadUsers();
  if (data.users.some((u) => u.username.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error('이미 사용 중인 아이디입니다');
  }
  const id = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  data.users.push({
    id,
    username: trimmed,
    passwordHash: hashPassword(password, salt),
    salt,
  });
  saveUsers(data);
  return { id, username: trimmed };
}

function login(username, password) {
  if (!username || !password) throw new Error('아이디와 비밀번호를 입력하세요');
  const data = loadUsers();
  const user = data.users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash, user.salt)) throw new Error('아이디 또는 비밀번호가 맞지 않습니다');
  return { id: user.id, username: user.username };
}

/** OAuth: provider(kakao|google) + providerId로 사용자 찾기 또는 새로 생성 */
function findOrCreateUserByOAuth(provider, providerId, displayName, email) {
  if (!provider || !providerId) throw new Error('OAuth 정보가 없습니다');
  const data = loadUsers();
  const existing = data.users.find(
    (u) => u.provider === provider && String(u.providerId) === String(providerId)
  );
  if (existing) return { id: existing.id, username: existing.username };

  const baseName = (displayName || email || `${provider}_${providerId}`).trim() || `${provider}_${providerId}`;
  let username = baseName.replace(/[^\w\uac00-\ud7a3\u3131-\u318e\s-]/g, '').slice(0, 30) || `${provider}_${providerId}`;
  let suffix = 0;
  while (data.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    suffix += 1;
    username = `${baseName.slice(0, 24)}_${suffix}`.replace(/[^\w\uac00-\ud7a3\u3131-\u318e\s-]/g, '') || `${provider}_${providerId}_${suffix}`;
  }

  const id = crypto.randomUUID();
  data.users.push({
    id,
    username,
    provider,
    providerId: String(providerId),
    displayName: displayName || username,
    email: email || null,
  });
  saveUsers(data);
  return { id, username };
}

module.exports = {
  loadUsers,
  createToken,
  verifyToken,
  register,
  login,
  findOrCreateUserByOAuth,
  validatePasswordPolicy,
};
