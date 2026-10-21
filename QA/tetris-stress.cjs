// Actual Tetris module/canvas stress with deterministic randomness and account fixtures.
// Does not connect to a production account or modify application state outside this browser.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const state={status:'google',uid:'qa-stress',profile:{nick:'Test'},isAdmin:false,displayName:'Test'};export const db={};const empty={exists:()=>false,val:()=>null,forEach:()=>{}};export const fdb=new Proxy({},{get:(_,k)=>k==='get'?async()=>empty:k==='onValue'?()=>()=>{}:()=>({})});export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve()};export default Auth;`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`const state={kaju:1e9,level:99,xp:0,totalXP:0,best:{}};export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},addKaju:async()=>true,addScore:async()=>false,addXP:async()=>true},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const hooks=`
window.__stress={
 start:(hero='vor')=>{ if(G)close(); SELECTED_MODE='solo'; SELECTED_HERO=hero; launchGame(); G.paused=true; G.countdown=0; },
 cycle:n=>{ for(let i=0;i<n;i++){
  if(!G)window.__stress.start(); G.score=i+1; G.elapsed=100.125+i; G.paused=true;
  const piece=JSON.stringify(G.cur);saveTetrisResume(); close(); resumeTetris(); G.paused=true; G.countdown=0;
  if(G.score!==i+1||G.elapsed!==100.125+i||JSON.stringify(G.cur)!==piece)throw new Error('valid fractional-time/shape/color resume changed at '+i);
  if(i%5===0){restart(); G.paused=true; G.countdown=0;}
 } },
 exercise:n=>{
  let drops=0,restarts=0,powers=0,gems=0;
  for(let i=0;i<n;i++){
   if(G.over){restart();G.countdown=0;restarts++;}
   G.paused=false;
   if(i%2)rotate('cw');else rotate('ccw');
   for(let step=0;step<i%5;step++)move(i%3?1:-1);
   if(i%7===0)hold();
   if(!G.over){hardDrop();drops++;}
   if(!Number.isFinite(G.score))throw new Error('non-finite score at '+i);
   if(!Array.isArray(G.board)||G.board.length!==ROWS||G.board.some(r=>!Array.isArray(r)||r.length!==COLS))throw new Error('bad board at '+i);
   if(G.cur&&matrixCells(G.cur.matrix).length!==4)throw new Error('lost piece cells at '+i);
   if(i%11===0&&!G.over){G.powerReady=true;usePower();powers++;}
   if(i%13===0&&!G.over){G.gems=[GEMS[(i/13|0)%GEMS.length]];pickGem(0);gems++;}
   if(!Number.isFinite(G.score))throw new Error('non-finite power score at '+i);
   drawBoard();drawSide();G.paused=true;
  }
  return {drops,restarts,powers,gems,score:G.score,lines:G.lines};
 },
 allPowers:()=>{
  const results=[];
  for(const key of HERO_KEYS){
   window.__stress.start(key);G.paused=false;G.countdown=0;
   for(let y=14;y<ROWS;y++)for(let x=0;x<COLS;x++)G.board[y][x]=(x+y)%3?'#abc':0;
   G.powerReady=true;usePower();drawBoard();drawSide();
   if(!Number.isFinite(G.score)||G.board.length!==ROWS||G.board.some(r=>r.length!==COLS))throw new Error('bad hero power '+key);
   results.push(key);G.paused=true;
  }
  return results;
 },
 close,
 state:()=>G?{score:G.score,boardRows:G.board.length,over:G.over}:null
};`;
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 const browser=await chromium.launch(launch);
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   let seed=148;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const kinds=['mousemove','mouseup','touchmove','touchend'],live=new Map(kinds.map(k=>[k,new Set()]));
   const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
   window.addEventListener=(type,fn,opts)=>{live.get(type)?.add(fn);return add(type,fn,opts);};
   window.removeEventListener=(type,fn,opts)=>{live.get(type)?.delete(fn);return remove(type,fn,opts);};
   window.__stressListeners=()=>Object.fromEntries([...live].map(([k,s])=>[k,s.size]));
  });
  let releaseHome;const homeGate=new Promise(r=>releaseHome=r);let homeReleased=false;
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import "/js/games/tetris.js";</script>'});
   if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
   if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
   if(u.pathname==='/js/reward.js')return route.fulfill({contentType:'text/javascript',body:'export const showReward=async()=>"close";'});
   if(u.pathname==='/js/games/tetris.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/games/tetris.js'),'utf8')+hooks});
   if(u.pathname==='/js/game-home.js'&&!homeReleased)await homeGate;
   const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile())return route.fulfill({status:404});
   return route.fulfill({path:p});
  });
  await page.goto(base);await page.waitForFunction(()=>!!window.__stress);
  // Playwright itself installs capture listeners; measure before application mounts.
  const baselineListeners=await page.evaluate(()=>window.__stressListeners());
  await page.evaluate(()=>{window.__stress.start();window.__stress.cycle(50);});
  homeReleased=true;releaseHome();await page.locator('#ghpGameHome').waitFor();
  // Dynamic-import callbacks are queued together; wait through two rendering turns.
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const listeners=await page.evaluate(()=>window.__stressListeners());
  for(const [type,count]of Object.entries(listeners))assert.equal(count,baselineListeners[type]+1,'one active game-home '+type+' listener after 50 close/resume loops');
  assert.equal(await page.locator('.tetris-overlay').count(),1);assert.equal(await page.locator('#ghpGameHome').count(),1);
  console.log('PASS 50 save/close/resume cycles and 10 restarts: one overlay/home control and no orphan drag listeners.');
  const exercise=await page.evaluate(()=>window.__stress.exercise(1200));
  console.log('PASS 1200 deterministic action cycles with real move/rotate/hold/drop/gem/power functions:',JSON.stringify(exercise));
  const heroes=await page.evaluate(()=>window.__stress.allPowers());
  assert.equal(heroes.length,9);console.log('PASS all nine hero powers retain finite score and a 20×10 board.');
  await page.evaluate(()=>window.__stress.close());
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.locator('.tetris-overlay').count(),0);assert.equal(await page.locator('#ghpGameHome').count(),0);
  for(const [type,count]of Object.entries(await page.evaluate(()=>window.__stressListeners())))assert.equal(count,baselineListeners[type],'close releases '+type+' drag listeners');
  assert.deepEqual(errors,[],'no browser runtime errors across stress/replay/powers');
  console.log('PASS final cleanup and no browser runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
