/**
 * GTP 엔진 동작 확인 스크립트
 * 사용: node scripts/test-gtp.js
 * (서버와 동일한 환경변수 GTP_ENGINE_PATH_PACHI, GTP_ENGINE_PATH_GNUGO 필요)
 */
const path = require('path');
const gtpAi = require('../lib/gtp-ai.js');

async function test() {
  console.log('Pachi configured:', gtpAi.isEngineConfigured('pachi'));
  console.log('GNU Go configured:', gtpAi.isEngineConfigured('gnugo'));

  if (gtpAi.isEngineConfigured('pachi')) {
    console.log('\n--- Pachi: 9x9 빈판, 흑 선수 ---');
    const pachiResult = await gtpAi.getMove(9, [], 'B', 10, 'pachi');
    console.log('Result:', pachiResult);
    if (pachiResult && pachiResult.pass) console.log('-> 패스');
    else if (pachiResult) console.log('-> 좌표 (0-based):', pachiResult.row, pachiResult.col, '(GTP: 3-3 근처 등)');
  }

  if (gtpAi.isEngineConfigured('gnugo')) {
    console.log('\n--- GNU Go: 9x9 빈판, 흑 선수 ---');
    const gnugoResult = await gtpAi.getMove(9, [], 'B', 10, 'gnugo');
    console.log('Result:', gnugoResult);
    if (gnugoResult && gnugoResult.pass) console.log('-> 패스');
    else if (gnugoResult) console.log('-> 좌표 (0-based):', gnugoResult.row, gnugoResult.col);
  }

  if (!gtpAi.isEngineConfigured('pachi') && !gtpAi.isEngineConfigured('gnugo')) {
    console.log('\n엔진이 설정되지 않았습니다. GTP_ENGINE_PATH_PACHI 또는 GTP_ENGINE_PATH_GNUGO 를 설정한 뒤 다시 실행하세요.');
  }
}

test().catch((e) => {
  console.error(e);
  process.exit(1);
});
