// Real module/canvas and controls; account/reward writes are deterministic fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const state={status:'google',uid:'qa-power',profile:{nick:'Test'},isAdmin:false,displayName:'Test'};export const db={};const empty={exists:()=>false,val:()=>null,forEach:()=>{}};export const fdb=new Proxy({},{get:(_,k)=>k==='get'?async()=>empty:k==='onValue'?()=>()=>{}:()=>({})});export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve()};export default Auth;`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`const state={kaju:1e9,level:99,xp:0,totalXP:0,best:{}};export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},addKaju:async()=>true,addScore:async()=>false,addXP:async()=>true},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const hooks=`
window.__powerQA={
 start:()=>{SELECTED_MODE='solo';SELECTED_HERO='vor';launchGame();cancelAnimationFrame(G.raf);G.paused=true;G.countdown=0;},
 gravityPosition:()=>{
  G.board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for(const y of [8,10,12])for(const x of [4,5])G.board[y][x]='#ff5a00';
  G.cur={type:'O',color:PIECES.O.color,matrix:toMatrix(PIECES.O.cells),x:3,y:17};
  G.visualY=17;G.paused=false;G.countdown=0;G.score=0;G.gems=[GEMS.find(g=>g.id==='gravity')];updateGemBtn();drawBoard();
 },
 timing:steps=>{
  G.board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  G.cur={type:'O',color:PIECES.O.color,matrix:toMatrix(PIECES.O.cells),x:0,y:0};
  G.visualY=0;G.paused=false;G.over=false;G.countdown=0;G.last=100;G.elapsed=0;G.dropAcc=0;G.dropInterval=100;G.lockTimer=0;G.lockResets=0;
  let timestamp=100;for(const dt of steps){timestamp+=dt;loop(timestamp);cancelAnimationFrame(G.raf);}
  G.paused=true;return {y:G.cur.y,remainder:G.dropAcc,elapsed:G.elapsed};
 },
 snapshot:()=>({filled:G.board.flat().filter(Boolean).length,original:G.board.flat().filter(c=>c==='#ff5a00').length,over:G.over,overlap:collides(G.cur,0,0),y:G.cur.y,score:G.score}),
 close
};`;
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 const browser=await chromium.launch(launch);let failures=0;
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import "/js/games/tetris.js";</script>'});
   if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
   if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
   if(u.pathname==='/js/reward.js')return route.fulfill({contentType:'text/javascript',body:'export const showReward=async()=>"close";'});
   if(u.pathname==='/js/games/tetris.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/games/tetris.js'),'utf8')+hooks});
   const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile())return route.fulfill({status:404});return route.fulfill({path:p});
  });
  await page.goto(base);await page.waitForFunction(()=>!!window.__powerQA);
  await page.evaluate(()=>window.__powerQA.start());
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n',e.message);}}
  await test('real gravity-gem click relocates active piece without losing settled cells',async()=>{
   await page.evaluate(()=>window.__powerQA.gravityPosition());
   const before=await page.evaluate(()=>window.__powerQA.snapshot());assert.equal(before.overlap,false);assert.equal(before.filled,6);
   await page.locator('[data-act="gem"]').click();await page.locator('.gem-card').click();
   const after=await page.evaluate(()=>window.__powerQA.snapshot());assert.equal(after.filled,6);assert.equal(after.original,6);assert.equal(after.overlap,false,'power must not leave an active piece overlapping settled blocks');assert.equal(after.over,false);
   await page.locator('[data-ctrl="drop"]').click();
   const locked=await page.evaluate(()=>window.__powerQA.snapshot());assert.equal(locked.filled,10,'locking adds all four piece cells');assert.equal(locked.original,6,'all settled cells survive');assert.equal(locked.over,false);
  });
  await test('one delayed frame retains ten gravity steps',async()=>{
   const s=await page.evaluate(()=>window.__powerQA.timing([1000]));assert.equal(s.y,10);assert.equal(s.remainder,0);assert.equal(s.elapsed,1000);
  });
  await test('ordinary uneven frames preserve gravity remainder',async()=>{
   const s=await page.evaluate(()=>window.__powerQA.timing(Array(10).fill(60)));assert.equal(s.y,6);assert.equal(s.remainder,0);assert.equal(s.elapsed,600);
   const t=await page.evaluate(()=>window.__powerQA.timing([60,60,60]));assert.equal(t.y,1);assert.equal(t.remainder,80);assert.equal(t.elapsed,180);
  });
  await page.evaluate(()=>window.__powerQA.close());assert.deepEqual(errors,[],'no browser errors');
 }finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
