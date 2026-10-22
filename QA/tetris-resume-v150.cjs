// Real Tetris module/canvas regressions; account/reward/network writes are fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const state={status:'google',uid:'qa-resume-v150',profile:{nick:'Test'},isAdmin:false,displayName:'Test'};export const db={};const empty={exists:()=>false,val:()=>null,forEach:()=>{}};export const fdb=new Proxy({},{get:(_,k)=>k==='get'?async()=>empty:k==='onValue'?()=>()=>{}:()=>({})});export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve()};export default Auth;`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`const state={kaju:1e9,level:99,xp:0,totalXP:0,best:{}};export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},addKaju:async()=>true,addScore:async()=>false,addXP:async()=>true},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const hooks=`
const qaFreeze=()=>{cancelAnimationFrame(G.raf);G.paused=true;};
window.__resumeQA={
 start:()=>{SELECTED_MODE='solo';SELECTED_HERO='vor';launchGame();qaFreeze();G.countdown=0;},
 close,
 resume:()=>{resumeTetris();qaFreeze();},
 seedPhase:()=>{
  qaFreeze();G.countdown=0;G.board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  G.cur={type:'T',color:PIECES.T.color,matrix:toMatrix(PIECES.T.cells),x:3,y:18};
  G.visualY=18;G.dropAcc=75;G.lockTimer=350;G.lockResets=12;
  G.lastMoveRotate=true;G.slowRemainingMs=4000;G.gravityDebt=125;
 },
 saveClose:()=>{saveTetrisResume();close();return JSON.parse(localStorage.getItem('hero_resume_tetris:'+encodeURIComponent(window.Hero?.Auth?.getState?.()?.uid||'guest')));},
 phase:()=>({cur:G.cur,dropAcc:G.dropAcc,lockTimer:G.lockTimer,lockResets:G.lockResets,
  lastMoveRotate:G.lastMoveRotate,slowRemainingMs:G.slowRemainingMs,gravityDebt:G.gravityDebt}),
 prepareGem:()=>{qaFreeze();G.countdown=0;G.gems=[GEMS.find(g=>g.id==='time')];updateGemBtn();},
 timing:()=>{
  qaFreeze();G.board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  G.cur={type:'O',color:PIECES.O.color,matrix:toMatrix(PIECES.O.cells),x:0,y:0};
  G.visualY=0;G.over=false;G.countdown=0;G.countdownAcc=0;G.last=100;G.elapsed=0;
  G.dropAcc=0;G.dropInterval=1000;G.lockTimer=0;G.lockResets=0;G.gravityDebt=0;
  G.slowRemainingMs=4000;
 },
 frame:(dt,paused=false,countdown=0)=>{
  G.paused=paused;G.countdown=countdown;loop(G.last+dt);cancelAnimationFrame(G.raf);
  return {slowRemainingMs:G.slowRemainingMs,elapsed:G.elapsed,y:G.cur.y,dropAcc:G.dropAcc,countdown:G.countdown};
 },
 power:()=>({slowRemainingMs:G.slowRemainingMs,score:G.score,gems:G.gems.length})
};`;
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 const browser=await chromium.launch(launch);let failures=0;
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import "/js/games/tetris.js";</script>'});
   if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
   if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
   if(u.pathname==='/js/reward.js')return route.fulfill({contentType:'text/javascript',body:'export const showReward=async()=>"close";'});
   if(u.pathname==='/js/games/tetris.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/games/tetris.js'),'utf8')+hooks});
   const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile())return route.fulfill({status:404});return route.fulfill({path:p});
  });
  await page.goto(base);await page.waitForFunction(()=>!!window.__resumeQA);
  async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n',e.message);}}
  await page.evaluate(()=>{window.__resumeQA.start();window.__resumeQA.seedPhase();});
  const expected=await page.evaluate(()=>window.__resumeQA.phase());
  const saved=await page.evaluate(()=>window.__resumeQA.saveClose());
  await test('JSON snapshot retains gravity, lock, rotation and remaining power phase',async()=>{
   for(const [key,value] of Object.entries(expected))assert.deepEqual(saved.data[key],value,key+' must survive JSON serialization');
   assert.equal(await page.locator('.tetris-overlay').count(),0,'close removes the old canvas');
  });
  await page.evaluate(()=>window.__resumeQA.resume());
  await test('real close/resume restores the current piece and every transient phase',async()=>{
   assert.deepEqual(await page.evaluate(()=>window.__resumeQA.phase()),expected);
   assert.equal(await page.locator('.tetris-overlay').count(),1,'resume creates a single canvas');
  });
  await test('real time-gem click starts a full ten seconds of active power',async()=>{
   await page.evaluate(()=>{window.__resumeQA.close();window.__resumeQA.start();window.__resumeQA.prepareGem();});
   await page.locator('[data-act="gem"]').click();await page.locator('.gem-card').click();
   const state=await page.evaluate(()=>window.__resumeQA.power());
   assert.equal(state.slowRemainingMs,10000);assert.equal(state.score,120);assert.equal(state.gems,0);
  });
  await test('pause and countdown preserve power time; active frames consume it exactly',async()=>{
   await page.evaluate(()=>window.__resumeQA.timing());
   let state=await page.evaluate(()=>window.__resumeQA.frame(60000,true));
   assert.equal(state.slowRemainingMs,4000,'pause preserves the full remaining power');assert.equal(state.elapsed,0);assert.equal(state.y,0);
   state=await page.evaluate(()=>window.__resumeQA.frame(400,false,3));
   assert.equal(state.slowRemainingMs,4000,'countdown preserves the full remaining power');assert.equal(state.elapsed,0);assert.equal(state.y,0);assert.equal(state.countdown,3);
   state=await page.evaluate(()=>window.__resumeQA.frame(1000));
   assert.equal(state.slowRemainingMs,3000,'one active second consumes one power second');assert.equal(state.elapsed,1000);assert.equal(state.y,0,'an active power must retain the slow gravity interval');assert.equal(state.dropAcc,1000);
   state=await page.evaluate(()=>window.__resumeQA.frame(3000));
   assert.equal(state.slowRemainingMs,0);assert.equal(state.elapsed,4000);assert.equal(state.y,1);assert.equal(state.dropAcc,0);
   state=await page.evaluate(()=>window.__resumeQA.frame(1000));
   assert.equal(state.slowRemainingMs,0);assert.equal(state.elapsed,5000);assert.equal(state.y,2);
  });
  await test('a delayed frame applies slow and normal gravity on the correct sides of expiry',async()=>{
   await page.evaluate(()=>window.__resumeQA.timing());
   const state=await page.evaluate(()=>window.__resumeQA.frame(5000));
   assert.equal(state.slowRemainingMs,0);assert.equal(state.elapsed,5000);
   assert.equal(state.y,2,'four slow seconds and one normal second produce two drops');assert.equal(state.dropAcc,0);
  });
  await page.evaluate(()=>window.__resumeQA.close());
  assert.deepEqual(errors,[],'no browser runtime errors');
 }finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
