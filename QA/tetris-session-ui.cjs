// Real browser/module regressions for Tetris resume, AI replay and hold input.
// Auth/store/reward are fixtures: no live account or Firebase writes.
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), base = 'http://127.0.0.1:8765';
const authFixture = `
  const state={status:'google',uid:'qa-tetris',profile:{nick:'Test'},isAdmin:false,displayName:'Test'};
  const empty={exists:()=>false,val:()=>null,forEach:()=>{}};
  export const db={};
  export const fdb=new Proxy({}, {get:(_,key)=>key==='get'?async()=>empty:key==='onValue'?()=>()=>{}:()=>({})});
  export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve()};
  export default Auth;
`;
const names = [...fs.readFileSync(path.join(root, 'js/store.js'), 'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(match => match[1]);
const storeFixture = `
  const state={kaju:0,level:1,xp:0,totalXP:0,best:{}};
  export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},
    addKaju:async()=>true,addScore:async()=>false,addXP:async()=>true}, {get:(obj,key)=>obj[key]||(()=>0)});
  ${names.map(name => `export const ${name}=(...args)=>Store.${name}(...args);`).join('\n')}
  export const VIP_DISCOUNT=.1; export default Store;
`;
const hooks = `
window.__tSession={
  solo:()=>{ SELECTED_MODE='solo'; SELECTED_HERO='vor'; launchGame(); },
  close, resume:resumeTetris, save:saveTetrisResume, ai:launchAIGame, restart,
  seedGem:()=>{ G.paused=true; G.countdown=0; G.score=100; G.gems=[GEMS.find(g=>g.id==='double')]; updateGemBtn(); },
  pause:()=>{ G.paused=true; },
  dirtyAI:()=>{ window.__oldAISession=G; G.paused=true; G.aiBoard[19][0]='#bad'; G.oppAlive=false; G.oppScore=999; G.score=1234; },
  seedHoldCollision:()=>{
    G.board=Array.from({length:ROWS},()=>Array(COLS).fill(0)); G.board[0][4]='#abc';
    G.cur={type:'T',color:PIECES.T.color,matrix:toMatrix(PIECES.T.cells),x:0,y:15};
    G.holdType='O'; G.canHold=true; G.paused=false; G.countdown=0;
    G.lockTimer=350; G.lockResets=7; G.lastMoveRotate=true;
  },
  snapshot:()=>G?({
    mode:G.mode,over:G.over,score:G.score,gems:G.gems.map(g=>({id:g.id,run:typeof g.run})),
    ai:G.ai===true,oppAlive:G.oppAlive,oppScore:G.oppScore,
    aiFilled:G.aiBoard?G.aiBoard.flat().filter(Boolean).length:null,
    freshAI:G!==window.__oldAISession,curType:G.cur.type,
    lockTimer:G.lockTimer,lockResets:G.lockResets,lastMoveRotate:G.lastMoveRotate,visualY:G.visualY
  }):null
};
`;
(async () => {
  const launch = { headless: true };
  if (process.env.PORTAL_CHROMIUM) launch.executablePath = process.env.PORTAL_CHROMIUM;
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import "/js/games/tetris.js";</script>' });
      if (url.pathname === '/js/auth.js') return route.fulfill({ contentType: 'text/javascript', body: authFixture });
      if (url.pathname === '/js/store.js') return route.fulfill({ contentType: 'text/javascript', body: storeFixture });
      if (url.pathname === '/js/reward.js') return route.fulfill({ contentType: 'text/javascript', body: 'export const showReward=async()=>"exit";' });
      if (url.pathname === '/js/games/tetris.js') return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'js/games/tetris.js'), 'utf8') + hooks });
      const file = path.resolve(root, '.' + url.pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404 });
      return route.fulfill({ path: file });
    });
    await page.goto(base); await page.waitForFunction(() => !!window.__tSession);

    await page.evaluate(() => { window.__tSession.solo(); window.__tSession.seedGem(); window.__tSession.save(); window.__tSession.close(); });
    assert.equal(await page.locator('.tetris-overlay').count(), 0, 'close removes the active board');
    assert.equal(await page.evaluate(() => typeof JSON.parse(localStorage.getItem('hero_resume_tetris')).data.gems[0].run), 'undefined', 'snapshot is genuine JSON with no function');
    await page.evaluate(() => { window.__tSession.resume(); window.__tSession.pause(); });
    let state = await page.evaluate(() => window.__tSession.snapshot());
    assert.equal(state.score, 100); assert.deepEqual(state.gems, [{ id: 'double', run: 'function' }]);
    await page.locator('[data-act="gem"]').click();
    await page.locator('.gem-card').click();
    state = await page.evaluate(() => window.__tSession.snapshot());
    assert.equal(state.score, 850, 'restored x2 gem executes its real +750 effect');
    assert.deepEqual(state.gems, []);
    console.log('PASS real module: JSON resume rehydrates the gem effect; tapping the gem grants +750.');

    await page.evaluate(() => { window.__tSession.close(); window.__tSession.ai(); window.__tSession.dirtyAI(); window.__tSession.restart(); window.__tSession.pause(); });
    state = await page.evaluate(() => window.__tSession.snapshot());
    assert.equal(state.ai, true); assert.equal(state.mode, 'ai'); assert.equal(state.freshAI, true);
    assert.equal(state.oppAlive, true); assert.equal(state.oppScore, 0); assert.equal(state.aiFilled, 0); assert.equal(state.score, 0);
    assert.equal(await page.locator('.tetris-overlay').count(), 1, 'AI replay has a single board');
    console.log('PASS real module: AI replay replaces the finished session with a fresh living opponent.');

    await page.evaluate(() => { window.__tSession.close(); window.__tSession.solo(); window.__tSession.seedHoldCollision(); });
    await page.locator('[data-ctrl="hold"]').click();
    state = await page.evaluate(() => window.__tSession.snapshot());
    assert.equal(state.over, true, 'hold cannot spawn over settled blocks');
    assert.equal(state.curType, 'O'); assert.equal(state.lockTimer, 0); assert.equal(state.lockResets, 0); assert.equal(state.lastMoveRotate, false); assert.equal(state.visualY, 0);
    await page.evaluate(() => window.__tSession.close());
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log('PASS real hold control: blocked spawn ends the game, resets piece flags, and has no browser errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
