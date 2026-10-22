// Actual three PeerJS lobby UIs; transport/account/share boundaries are local fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const state={status:'anon',uid:null,profile:null,isAdmin:false,displayName:'Fixture'};const empty={exists:()=>false,val:()=>null,forEach:()=>{}};export const db={};export const fdb=new Proxy({},{get:(_,k)=>k==='get'?async()=>empty:k==='onValue'?()=>()=>{}:()=>({})});export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve()};export default Auth;`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`const state={kaju:0,level:1,xp:0,totalXP:0,best:{}};export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};}},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const share=`export async function shareRoomCode(game,code){window.__shares.push({game,code});if(window.__holdShare)return new Promise(resolve=>window.__resolveShare=resolve);return 'shared';}`;
const hooks={
 chess:'\nwindow.__lobby={open:()=>{openChess();showOnlineLobby(G.root);}};',
 tavla:'\nwindow.__lobby={open:async()=>{openTavla();await showOnlineLobby(G.root);}};',
 tetris:'\nwindow.__lobby={open:()=>{injectCSS();buildVersusLobby();}};'
};
let browser,failed=0;
async function setup(game){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__shares=[];window.__peers=[];
  window.Peer=class {
   constructor(id){this.id=typeof id==='string'?id:'fixture-peer';this.events=new Map();this.destroyed=false;window.__peers.push(this);}
   on(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);return this;}
   emit(name,...args){for(const fn of this.events.get(name)||[])fn(...args);}
   connect(){return {open:false,on(){return this;},send(){},close(){}};}
   destroy(){this.destroyed=true;}disconnect(){}
  };
 });
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
  if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import Auth from "/js/auth.js";import Store from "/js/store.js";window.Hero={Auth,Store};import "/js/games/'+game+'.js";</script>'});
  if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
  if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
  if(u.pathname==='/js/room-share.js')return route.fulfill({contentType:'text/javascript',body:share});
  const file=u.pathname.slice(1),full=path.resolve(root,file);
  if(!full.startsWith(root+path.sep)||!fs.existsSync(full)||!fs.statSync(full).isFile())return route.fulfill({status:404});
  if(file==='js/games/'+game+'.js'){
   const text=process.env.LOBBIES_V151_SOURCE_REF?execFileSync('git',['show',process.env.LOBBIES_V151_SOURCE_REF+':'+file],{cwd:root,encoding:'utf8'}):fs.readFileSync(full,'utf8');
   return route.fulfill({contentType:'text/javascript',body:text+hooks[game]});
  }
  return route.fulfill({path:full});
 });
 await page.goto(base);await page.waitForFunction(()=>!!window.__lobby);await page.evaluate(()=>window.__lobby.open());
 return {page,errors};
}
async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,'\n'+e.stack);}}
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 browser=await chromium.launch(launch);
 try{
  for(const [game,lobby,codeSelector,copySelector,shareSelector] of [
   ['chess','.chess-online-lobby','[data-el="code"]','[data-act="copy"]','[data-act="share"]'],
   ['tavla','.tavla-online-lobby','[data-el="code"]','[data-act="copy"]','[data-act="share"]'],
   ['tetris','.versus-lobby','[data-el="codebig"]','[data-act="copycode"]','[data-act="sharecode"]']
  ].filter(([game])=>!process.env.LOBBIES_GAME||process.env.LOBBIES_GAME===game))await test(game+' real lobby shares its room code and fits320/390px at80/100/130%',async()=>{
   const {page,errors}=await setup(game);try{
    const panel=page.locator(lobby);
    await panel.locator('[data-act="create"]').click();
    if(game==='chess')await panel.locator('.col-create-go').click();
    if(game!=='tetris'){
     assert.equal(await panel.locator(shareSelector).count(),1,'share button is present beside copy');
     await panel.locator(shareSelector).click();assert.equal(await page.evaluate(()=>window.__shares.length),0,'a room must have a valid code before sharing');
    }
    const code=await page.evaluate(()=>{const peer=window.__peers.at(-1);if(!peer)throw new Error('Real MP module did not create a Peer');peer.emit('open',peer.id);return peer.id.slice(-6);});
    assert.match(code,/^[A-Z0-9]{6}$/);
    await page.waitForFunction(([selector,code])=>document.querySelector(selector)?.textContent===code,[lobby+' '+codeSelector,code]);
    assert.equal(await panel.locator(shareSelector).count(),1,'ready room includes its share button');
    let clicks=0;
    for(const width of [320,390])for(const scale of [.8,1,1.3]){
     await page.setViewportSize({width,height:844});
     await page.evaluate(scale=>{document.body.style.zoom=String(scale);localStorage.setItem('hero_ui_scale',String(scale));},scale);
     const button=panel.locator(shareSelector);await button.scrollIntoViewIfNeeded();
     const geometry=await button.evaluate((el,copySelector)=>{
      const r=el.getBoundingClientRect(),p=el.closest('.col-box,.tol-box,.vl-status').getBoundingClientRect();
      const other=el.closest('.chess-online-lobby,.tavla-online-lobby,.versus-lobby').querySelector(copySelector).getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,inside:r.left>=p.left-1&&r.right<=p.right+1,
       textFits:el.scrollWidth<=el.clientWidth+1,apart:other.bottom<=r.top+1,viewWidth:innerWidth,viewHeight:innerHeight};
     },copySelector);
     assert.ok(geometry.left>=-1&&geometry.right<=geometry.viewWidth+1,JSON.stringify({width,scale,geometry}));
     assert.ok(geometry.top>=-1&&geometry.bottom<=geometry.viewHeight+1,'share control remains reachable: '+JSON.stringify({width,scale,geometry}));
     assert.ok(geometry.width>30&&geometry.inside&&geometry.textFits&&geometry.apart,'share/copy controls fit without overlap: '+JSON.stringify({width,scale,geometry}));
     await button.click();clicks++;
     await page.waitForFunction(n=>window.__shares.length===n,clicks);
     assert.deepEqual(await page.evaluate(()=>window.__shares.at(-1)),{game,code});
     // The first feedback has no earlier reset timer; later layouts verify calls/code.
     if(clicks===1)await page.waitForFunction(selector=>document.querySelector(selector)?.textContent.includes('PAYLAŞILDI'),lobby+' '+shareSelector);
    }
    assert.equal(await page.evaluate(()=>window.__shares.length),6);
    await page.evaluate(selector=>{window.__holdShare=true;const button=document.querySelector(selector);button.click();button.click();},lobby+' '+shareSelector);
    assert.equal(await page.evaluate(()=>window.__shares.length),7,'rapid repeated clicks open one pending share request');
    assert.equal(await panel.locator(shareSelector).isDisabled(),true,'share stays disabled until its pending request finishes');
    await page.evaluate(()=>{window.__holdShare=false;window.__resolveShare('shared');});
    await page.waitForFunction(selector=>!document.querySelector(selector)?.disabled,lobby+' '+shareSelector);
    assert.equal(await page.evaluate(()=>window.__shares.length),7);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
 }finally{await browser.close();}
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
