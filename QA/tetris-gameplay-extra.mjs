// Additional gameplay regressions. Runs the real Tetris module in a VM;
// only presentation, account, audio and game-end side effects are fixtures.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GEMS } from '../js/games/tetris-gems.js';

const source = fs.readFileSync(new URL('../js/games/tetris.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export default .*;\r?$/gm, '')
  .replace(/^export function /gm, 'function ');
const noop = () => {};
const emptyBoard = () => Array.from({ length: 20 }, () => Array(10).fill(0));
function harness(state = {}) {
  const ended = [], chats = [];
  const context = vm.createContext({
    console, Math, Number, performance: { now: () => 0 },
    window: {}, localStorage: { getItem: () => null },
    DEFAULT_THEME: 'neon', DEFAULT_HERO: 'vor', HERO_KEYS: [], HEROES: {},
    GEMS, POWER_CHARGE_LINES: 8,
    Sound: new Proxy({}, { get: () => noop }),
    MP: { connected: true, host: false, send: noop },
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
    setTimeout: noop, clearTimeout: noop,
  });
  vm.runInContext(source + `\nthis.qa = {
    setState: state => { G = state; },
    clearLines, rotate, matrixCells, toMatrix,
    receive: handleVersusMessage, sync: applyVersusSync,
  };`, context);
  for (const name of [
    'showCombo', 'spawnLineParticles', 'flashRows', 'screenShake', 'showTspin',
    'flash', 'showB2B', 'showPerfectClear', 'showLevelUp', 'updateHUD',
    'updatePowerBtn', 'updateVersusUI',
  ]) context[name] = noop;
  context.endGame = won => { state.over = true; ended.push(won); };
  context.addTetrisChatMessage = text => chats.push(text);
  context.qa.setState(state);
  return { ...context.qa, state, ended, chats };
}
let failures = 0;
function test(name, run) {
  try { run(); console.log('PASS', name); }
  catch (error) { failures++; console.error('FAIL', name, '\n', error.message); }
}

test('gravity-created five, six and ten full rows keep a finite score and clear', () => {
  for (const rows of [5, 6, 10]) {
    const board = emptyBoard();
    // Every column contains `rows` cells but no row starts full. The actual
    // gravity gem compacts these scattered cells into more than four full rows.
    for (let x = 0; x < 10; x++) for (let i = 0; i < rows; i++) board[(i * 2 + x) % 20][x] = '#abc';
    assert.equal(board.filter(row => row.every(Boolean)).length, 0);
    GEMS.find(gem => gem.id === 'gravity').run({ board, ROWS: 20, COLS: 10, emptyRow: () => Array(10).fill(0), addScore: noop });
    assert.equal(board.filter(row => row.every(Boolean)).length, rows);
    const state = { board, score: 0, lines: 0, level: 1, combo: 0, clearFlash: [],
      tspin: false, b2b: false, powerReady: true, tetrisCount: 0,
      baseInterval: 800, speedMult: 1, mode: 'solo' };
    harness(state).clearLines();
    assert.equal(state.lines, rows);
    assert.equal(state.board.length, 20);
    assert.ok(state.board.every(row => row.every(cell => !cell)), 'all compacted rows removed');
    assert.ok(Number.isFinite(state.score) && state.score > 0, `${rows} cleared rows must not poison score`);
  }
});

test('O rotation preserves the occupied square for clockwise and counterclockwise turns', () => {
  const state = { board: emptyBoard(), cur: { type: 'O', x: 3, y: 10 },
    over: false, paused: false, countdown: 0, lockTimer: 0, lockResets: 0 };
  const h = harness(state);
  state.cur.matrix = h.toMatrix([[1, 0], [2, 0], [1, 1], [2, 1]]);
  const occupied = () => JSON.stringify(Array.from(h.matrixCells(state.cur.matrix), ([x, y]) => [x + state.cur.x, y + state.cur.y]).sort());
  const before = occupied();
  for (const direction of ['cw', 'cw', 'ccw', 'ccw']) {
    h.rotate(direction);
    assert.equal(occupied(), before, `square cannot drift after ${direction}`);
  }
});

test('remote death settles the surviving player once and ignores duplicates', () => {
  const state = { versus: true, ai: false, over: false, oppAlive: true, pendingGarbage: 0 };
  const h = harness(state);
  h.receive({ type: 'dead' });
  h.receive({ type: 'dead' });
  assert.deepEqual(h.ended, [true], 'winner must finish immediately, once');
  assert.equal(state.oppAlive, false);
});

test('garbage accepts bounded integer attacks and rejects malformed rows', () => {
  const state = { versus: true, ai: false, over: false, oppAlive: true, pendingGarbage: 0 };
  const h = harness(state);
  h.receive({ type: 'garbage', rows: 2 });
  h.receive({ type: 'garbage', rows: 3 });
  assert.equal(state.pendingGarbage, 5);
  for (const rows of [Infinity, NaN, -1, 0, 2.5, '3', {}, null, 1e9]) {
    const before = state.pendingGarbage;
    assert.doesNotThrow(() => h.receive({ type: 'garbage', rows }));
    assert.equal(state.pendingGarbage, before, `reject invalid rows ${String(rows)}`);
  }
});

test('remote state, sync and chat reject invalid payloads without throwing', () => {
  const state = { versus: true, ai: false, over: false, oppAlive: true,
    oppScore: 10, oppLines: 2, oppNick: 'Rakip', pendingGarbage: 0 };
  const h = harness(state);
  h.receive({ type: 'state', score: 500, lines: 4 });
  assert.equal(state.oppScore, 500); assert.equal(state.oppLines, 4);
  for (const bad of [Infinity, NaN, -1, '50', {}, []]) {
    const score = state.oppScore, lines = state.oppLines;
    assert.doesNotThrow(() => h.receive({ type: 'state', score: bad, lines: bad }));
    assert.equal(state.oppScore, score); assert.equal(state.oppLines, lines);
    assert.doesNotThrow(() => h.sync({ score: bad, lines: bad, nick: {}, alive: false }));
    assert.equal(state.oppScore, score); assert.equal(state.oppLines, lines);
    assert.equal(state.over, false); assert.equal(state.oppAlive, true, 'invalid sync must not settle the match');
  }
  for (const text of [4, null, {}, []]) assert.doesNotThrow(() => h.receive({ type: 'chat', text }));
  h.receive({ type: 'chat', text: 'İyi oyunlar!' });
  assert.equal(h.chats.at(-1), 'İyi oyunlar!');
});

if (failures) process.exitCode = 1;
