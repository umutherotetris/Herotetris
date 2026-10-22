// Real portal/game-control lifecycle regressions. Account/store are inert fixtures.
// Baseline: PORTAL_V151_SOURCE_REF=5df370d PORTAL_CHROMIUM=... node QA/portal-overlap-v151.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`
 let state={status:'anon',uid:null,profile:null,isAdmin:false,displayName:'Misafir Oyuncu'};
 const listeners=new Set(),empty={exists:()=>false,val:()=>null,forEach:()=>{}};
 export const db={};
 export const fdb=new Proxy({}, {get:(_,k)=>k==='get'?async()=>empty:k==='onValue'?()=>()=>{}:k==='serverTimestamp'?()=>0:()=>({})});
 export async function loginGoogle(){return {ok:false,userCancelled:true};}
 export const Auth={getState:()=>state,subscribe:fn=>{listeners.add(fn);fn(state);return()=>listeners.delete(fn)},ready:Promise.resolve(),loginGoogle,db,auth:{currentUser:null}};
 export default Auth;
`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`
 const state={kaju:0,level:1,xp:0,totalXP:0,best:{}};
 export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};}}, {get:(o,k)=>o[k]||(()=>0)});
 ${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}
 export const VIP_DISCOUNT=.1;export default Store;
`;
function source(file){
 if(process.env.PORTAL_V151_SOURCE_REF&&['js/app.js','js/game-home.js'].includes(file))
  return execFileSync('git',['show',process.env.PORTAL_V151_SOURCE_REF+':'+file],{cwd:root,encoding:'utf8'});
 return fs.readFileSync(path.join(root,file),'utf8');
}
let browser,failed=0;
async function setup(hold=[]){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const pending=new Map(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
  if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
  if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
  const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  if(hold.includes(file))await new Promise(resolve=>pending.set(file,resolve));
  const full=path.resolve(root,file);
  if(!full.startsWith(root+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile())return route.fulfill({status:404});
  if(['js/app.js','js/game-home.js'].includes(file))return route.fulfill({contentType:'text/javascript',body:source(file)});
  if(hold.includes(file))return route.fulfill({contentType:'text/javascript',body:source(file)+'\n(window.__loadedGames ||= []).push('+JSON.stringify(file)+');'});
  return route.fulfill({path:full});
 });
 await page.goto(base);await page.waitForFunction(()=>!!window.Hero);
 return {page,errors,pending,release:file=>{assert.ok(pending.has(file),'lazy request started: '+file);pending.get(file)();pending.delete(file);}};
}
async function test(name,run){
 try{await run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,'\n'+e.message);}
}
const roots='.chess-root,.tavla-root,.kl-root,.tetris-overlay,.hero-select-overlay';
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 browser=await chromium.launch(launch);
 try{
  await test('a completed launch cannot duplicate an already open game root',async()=>{
   const {page,errors}=await setup();try{
    await page.locator('#gameChess').click();await page.locator('.chess-root').waitFor();
    await page.evaluate(()=>window.Hero.openChess());
    assert.equal(await page.locator('.chess-root').count(),1,'reopening the same game keeps its original session');
    assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('another game waits until the active game is closed',async()=>{
   const {page,errors}=await setup();try{
    await page.evaluate(()=>window.Hero.openChess());
    await page.evaluate(()=>window.Hero.openTavla());
    assert.equal(await page.locator('.chess-root').count(),1);assert.equal(await page.locator('.tavla-root').count(),0,'game launch cannot stack two live engines');
    await page.locator('.chess-root [data-act="close"]').first().click();
    await page.evaluate(()=>window.Hero.openTavla());
    assert.equal(await page.locator('.tavla-root').count(),1);assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('latest card wins when different lazy imports finish out of order',async()=>{
   const files=['js/games/chess.js','js/games/tavla.js'];const {page,pending,release,errors}=await setup(files);
   try{
    await page.locator('#gameChess').click();
    for(let i=0;i<100&&!pending.has(files[0]);i++)await page.waitForTimeout(10);
    assert.ok(pending.has(files[0]));
    await page.locator('#gameTavla').click();
    for(let i=0;i<100&&!pending.has(files[1]);i++)await page.waitForTimeout(10);
    release(files[1]);await page.locator('.tavla-root').waitFor();
    release(files[0]);await page.waitForFunction(()=>window.__loadedGames?.includes('js/games/chess.js'));
    assert.equal(await page.locator('.chess-root').count(),0,'stale imported game cannot open over the requested game');
    assert.equal(await page.locator('.tavla-root').count(),1);assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{for(const resolve of pending.values())resolve();await page.close();}
  });
  await test('latest choice can return to a module whose lazy import is still pending',async()=>{
   const files=['js/games/chess.js','js/games/tavla.js'];const {page,pending,release,errors}=await setup(files);
   try{
    await page.locator('#gameChess').click();await page.locator('#gameTavla').click();await page.locator('#gameChess').click();
    for(let i=0;i<100&&!files.every(file=>pending.has(file));i++)await page.waitForTimeout(10);
    release(files[1]);await page.waitForFunction(()=>window.__loadedGames?.includes('js/games/tavla.js'));
    assert.equal(await page.locator(roots).count(),0,'earlier choice stays closed while the newest choice loads');
    release(files[0]);await page.locator('.chess-root').waitFor();
    assert.equal(await page.locator('.tavla-root').count(),0);assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{for(const resolve of pending.values())resolve();await page.close();}
  });
  await test('removing game controls removes their open guide overlay',async()=>{
   const {page,errors}=await setup();try{
    await page.evaluate(async()=>{window.__mount=(await import('/js/game-home.js')).mountGameHome;window.__control=window.__mount('chess',()=>{});window.__control.open();});
    await page.locator('#ghpGameHomePanel [data-cc="guide"]').click();assert.equal(await page.locator('.ghp-cc-guide').count(),1);
    await page.evaluate(()=>window.__control.remove());
    assert.equal(await page.locator('.ghp-cc-guide').count(),0,'closing/replacing a game releases its guide');
    assert.equal(await page.locator('#ghpGameHome,#ghpGameHomePanel').count(),0);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('removed confirmation callbacks cannot exit a later game',async()=>{
   const {page,errors}=await setup();try{
    await page.evaluate(async()=>{window.__mount=(await import('/js/game-home.js')).mountGameHome;window.__exits=0;window.__old=window.__mount('chess',()=>window.__exits++);window.__old.open();});
    await page.locator('#ghpGameHomePanel [data-cc="home"]').click();
    await page.evaluate(()=>{window.__oldGo=document.querySelector('.ghp-cc-confirm .go');window.__old.remove();window.__new=window.__mount('tavla',()=>{});window.__oldGo.click();});
    assert.equal(await page.locator('.ghp-cc-confirm').count(),0,'old exit confirmation is released');
    assert.equal(await page.evaluate(()=>window.__exits),0,'detached old buttons cannot run their former exit action');
    assert.equal(await page.locator('#ghpGameHome').count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('remount retires the previous control handle and its auxiliary overlays',async()=>{
   const {page,errors}=await setup();try{
    await page.evaluate(async()=>{window.__mount=(await import('/js/game-home.js')).mountGameHome;window.__old=window.__mount('chess',()=>{});window.__old.open();});
    await page.locator('#ghpGameHomePanel [data-cc="guide"]').click();
    await page.evaluate(()=>{window.__new=window.__mount('tavla',()=>{});window.__new.open();window.__old.open();});
    assert.equal(await page.locator('.ghp-cc-guide').count(),0,'remount closes the prior guide');
    assert.equal(await page.locator('#ghpGameHomePanel').count(),1,'retired control cannot recreate a second panel');
    assert.match(await page.locator('#ghpGameHomePanel .ghp-cc-head .t').textContent(),/TAVLA/);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('Escape closes game-control overlays before reaching game keyboard handlers',async()=>{
   const {page,errors}=await setup();try{
    await page.evaluate(async()=>{
     window.__mount=(await import('/js/game-home.js')).mountGameHome;
     window.__control=window.__mount('chess',()=>{});window.__control.open();
     window.__escaped=0;window.addEventListener('keydown',e=>{if(e.key==='Escape')window.__escaped++;});
    });
    await page.locator('#ghpGameHomePanel [data-cc="guide"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ghp-cc-guide').count(),0,'Escape dismisses the guide');
    assert.equal(await page.evaluate(()=>window.__escaped),0,'guide Escape cannot trigger an underlying game action');
    await page.evaluate(()=>window.__control.open());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ghpGameHomePanel').count(),0,'next Escape dismisses the control panel');
    assert.equal(await page.evaluate(()=>window.__escaped),0,'panel Escape cannot trigger an underlying game action');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>window.__escaped),1,'Escape reaches game handlers after all controls are closed');
    await page.evaluate(()=>window.__control.remove());assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
 }finally{await browser.close();}
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
