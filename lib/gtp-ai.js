/**
 * GTP(Go Text Protocol) 엔진 연동
 * - KataGo: https://github.com/lightvector/KataGo (딥러닝, time_settings 지원)
 * - Pachi:  https://github.com/lemonsqueeze/pachi (MCTS+RAVE, GTP 지원)
 * 착수시간(time_settings)을 전달하여 시간 내에만 수를 두도록 함.
 */
const { spawn } = require('child_process');

const GTP_ENGINE_PATH = process.env.GTP_ENGINE_PATH || '';
const GTP_ENGINE_ARGS = (process.env.GTP_ENGINE_ARGS || '').split(/\s+/).filter(Boolean);

function isConfigured() {
  return Boolean(GTP_ENGINE_PATH);
}

/** 0-based (row,col), row=0 상단 -> GTP: 열=A-S(I생략), 행=1이 하단 */
function toGtpCoord(row, col, size) {
  const gtpRow = size - row;
  const colCode = col <= 7 ? 65 + col : 66 + col;
  return String.fromCharCode(colCode) + String(gtpRow);
}

/** "= C3" / "= pass" -> { row, col } or { pass: true } */
function parseGenmove(line, size) {
  const m = line && line.trim().match(/^=\s*(\S+)/i);
  if (!m) return null;
  const tok = m[1].toUpperCase();
  if (tok === 'PASS') return { pass: true };
  const colCh = tok.charAt(0);
  const rowNum = parseInt(tok.slice(1), 10);
  if (isNaN(rowNum) || rowNum < 1 || rowNum > size) return null;
  const row = size - rowNum;
  let col = colCh.charCodeAt(0) - 65;
  if (colCh > 'I') col--;
  if (col < 0 || col >= size) return null;
  return { row, col };
}

/**
 * 한 수에 쓸 수 있는 시간(초)으로 genmove 요청.
 * KataGo/Pachi 모두 time_settings main_sec 0 0 형태로 "이 수에 쓸 시간" 전달.
 */
function getMove(size, moves, colorToPlay, timeRemainingSec) {
  if (!isConfigured()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const args = GTP_ENGINE_ARGS.length ? GTP_ENGINE_ARGS : ['gtp'];
    const proc = spawn(GTP_ENGINE_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let buf = '';
    const timeoutMs = Math.max(2000, (timeRemainingSec + 3) * 1000);
    const tid = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      resolve(null);
    }, timeoutMs);

    function flush(line) {
      if (line && line.trim().startsWith('=')) {
        clearTimeout(tid);
        try { proc.kill(); } catch (_) {}
        resolve(parseGenmove(line.trim(), size) || null);
      }
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
      else resolve(null);
    });

    const mainSec = Math.max(0, Math.floor(timeRemainingSec));
    proc.stdin.write('boardsize ' + size + '\n');
    proc.stdin.write('clear_board\n');
    moves.forEach((m) => {
      proc.stdin.write('play ' + m.color + ' ' + toGtpCoord(m.row, m.col, size) + '\n');
    });
    proc.stdin.write('time_settings ' + mainSec + ' 0 0\n');
    proc.stdin.write('genmove ' + colorToPlay + '\n');
    proc.stdin.end();
  });
}

module.exports = { isConfigured, getMove };
