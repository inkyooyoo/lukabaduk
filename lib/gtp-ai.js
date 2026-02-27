/**
 * GTP(Go Text Protocol) 엔진 연동
 * - Pachi:  https://github.com/pasky/pachi (MCTS+RAVE)
 * - GNU Go: https://www.gnu.org/software/gnugo/ (가벼운 규칙 기반)
 * 선택에 따라 engine = 'pachi' | 'gnugo' 로 각각 호출.
 */
const { spawn } = require('child_process');
const path = require('path');
const isWin = process.platform === 'win32';

const GTP_ENGINE_PATH = process.env.GTP_ENGINE_PATH || '';
const GTP_ENGINE_ARGS = (process.env.GTP_ENGINE_ARGS || '').split(/\s+/).filter(Boolean);
const GTP_ENGINE_PATH_PACHI = process.env.GTP_ENGINE_PATH_PACHI || '';
const GTP_ENGINE_PATH_GNUGO = process.env.GTP_ENGINE_PATH_GNUGO || '';
const GTP_ENGINE_ARGS_PACHI = (process.env.GTP_ENGINE_ARGS_PACHI || '').split(/\s+/).filter(Boolean);
const GTP_ENGINE_ARGS_GNUGO = (process.env.GTP_ENGINE_ARGS_GNUGO || '').split(/\s+/).filter(Boolean);

function isConfigured() {
  return Boolean(GTP_ENGINE_PATH) || Boolean(GTP_ENGINE_PATH_PACHI) || Boolean(GTP_ENGINE_PATH_GNUGO);
}

function isEngineConfigured(engine) {
  if (engine === 'pachi') return Boolean(GTP_ENGINE_PATH_PACHI) || (Boolean(GTP_ENGINE_PATH) && GTP_ENGINE_PATH.toLowerCase().includes('pachi'));
  if (engine === 'gnugo') return Boolean(GTP_ENGINE_PATH_GNUGO) || (Boolean(GTP_ENGINE_PATH) && !GTP_ENGINE_PATH.toLowerCase().includes('pachi'));
  return false;
}

function getPathAndArgs(engine) {
  let path = '';
  let args = [];
  if (engine === 'pachi') {
    path = GTP_ENGINE_PATH_PACHI || (GTP_ENGINE_PATH.toLowerCase().includes('pachi') ? GTP_ENGINE_PATH : '');
    args = GTP_ENGINE_ARGS_PACHI.length ? GTP_ENGINE_ARGS_PACHI : (path.toLowerCase().includes('pachi') ? [] : ['gtp']);
  } else if (engine === 'gnugo') {
    path = GTP_ENGINE_PATH_GNUGO || (GTP_ENGINE_PATH && !GTP_ENGINE_PATH.toLowerCase().includes('pachi') ? GTP_ENGINE_PATH : '');
    args = GTP_ENGINE_ARGS_GNUGO.length ? GTP_ENGINE_ARGS_GNUGO : ['gtp'];
  }
  return { path, args };
}

/** 0-based (row,col), row=0 상단 -> GTP: 열=A-S(I생략), 행=1이 하단 */
function toGtpCoord(row, col, size) {
  const gtpRow = size - row;
  const colCode = col <= 7 ? 65 + col : 66 + col;
  return String.fromCharCode(colCode) + String(gtpRow);
}

/** "= C3" / "= C 3" / "= pass" -> { row, col } or { pass: true }. genmove 응답만 파싱(문자+숫자 또는 pass). */
function parseGenmove(line, size) {
  const trimmed = line && line.trim();
  if (!trimmed || !trimmed.startsWith('=')) return null;
  const rest = trimmed.slice(1).trim();
  const tok = rest.replace(/\s+/g, '').toUpperCase();
  if (!tok) return null;
  if (tok === 'PASS' || tok === 'RESIGN') return { pass: true };
  if (tok.length < 2) return null;
  const colCh = tok.charAt(0);
  const rowNum = parseInt(tok.slice(1), 10);
  if (isNaN(rowNum) || rowNum < 1 || rowNum > size) return null;
  if (colCh < 'A' || colCh > 'T') return null;
  const row = size - rowNum;
  let col = colCh.charCodeAt(0) - 65;
  if (colCh > 'I') col--;
  if (col < 0 || col >= size) return null;
  return { row, col };
}

/**
 * 한 수에 쓸 수 있는 시간(초)으로 genmove 요청.
 * engine: 'pachi' | 'gnugo'
 * GTP 명령 순서: boardsize → clear_board → komi → play... → time_settings → genmove (엔진이 마지막 = 응답만 착수로 사용)
 */
function getMove(size, moves, colorToPlay, timeRemainingSec, engine) {
  const { path: enginePath, args } = getPathAndArgs(engine || 'pachi');
  if (!enginePath || !isEngineConfigured(engine)) return Promise.resolve(null);

  const engineDir = path.dirname(enginePath);

  return new Promise((resolve) => {
    const proc = spawn(enginePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      cwd: engineDir,
    });

    let buf = '';
    let lastValidMove = null;
    const timeoutMs = Math.max(5000, (timeRemainingSec + 5) * 1000);
    const tid = setTimeout(() => {
      try {
        if (isWin) proc.kill();
        else proc.kill('SIGKILL');
      } catch (_) {}
      resolve(lastValidMove);
    }, timeoutMs);

    function onLine(line) {
      const t = line && line.trim();
      if (!t) return;
      if (t.startsWith('?')) {
        lastValidMove = null;
        return;
      }
      if (t.startsWith('=')) {
        const parsed = parseGenmove(line, size);
        if (parsed !== null) lastValidMove = parsed;
      }
    }

    function flush(line) {
      if (line) onLine(line.trim());
    }

    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      lines.forEach((line) => flush(line));
    });

    proc.stderr.on('data', () => {});
    proc.on('error', () => { clearTimeout(tid); resolve(null); });
    proc.on('close', () => {
      clearTimeout(tid);
      if (buf.trim()) flush(buf.trim());
      resolve(lastValidMove);
    });

    const mainSec = Math.max(1, Math.floor(timeRemainingSec));
    proc.stdin.write('boardsize ' + size + '\n');
    proc.stdin.write('clear_board\n');
    proc.stdin.write('komi 7.5\n');
    moves.forEach((m) => {
      proc.stdin.write('play ' + m.color + ' ' + toGtpCoord(m.row, m.col, size) + '\n');
    });
    proc.stdin.write('time_settings ' + mainSec + ' 0 0\n');
    proc.stdin.write('genmove ' + colorToPlay + '\n');
    proc.stdin.end();
  });
}

module.exports = { isConfigured, isEngineConfigured, getMove };
