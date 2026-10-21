// Screenshot regression: white home checker must play 3 from a 6–3 roll.
// Real canvas and pointer handlers; account/network calls are fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const st={status:'anon',uid:null,isAdmin:false,displayName:'Test',profile:null};export const db={};export const fdb=new Proxy({},{get:(_,k)=>k==='get'?async()=>({exists:()=>false,val:()=>null}):()=>()=>{}});export const Auth={getState:()=>st,subscribe:fn=>{fn(st);return()=>{};}};export default Auth;`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`export const Store=new Proxy({getState:()=>({level:1,kaju:0,best:{}}),subscribe:()=>()=>{}},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const hooks=`
window.__tvQA={
 reset:(scale,flip)=>{
  clearAutoRollTimer();G.state=newGame();G.state.points[11]=-4;G.state.points[22]=-1;G.state.dice=[6,3];
  G.rolled=true;G.gameEnded=false;G.aiThinking=false;G.online=false;G.selected=null;G.legalForSel=[];G.flip=flip;
  document.body.style.zoom=String(scale);window.__uiScale=scale;fitCanvas();updateControls();draw();
 },
 screenPoint:idx=>{const p=checkerPixel(idx,'w','from'),r=G.canvas.getBoundingClientRect();return {x:r.left+p.x*r.width/G.W,y:r.top+p.y*r.height/G.H};},
 state:()=>G.state,selected:()=>G.selected,close:closeAll
};`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import {openTavla} from "/js/games/tavla.js";openTavla();</script>'});
   if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
   if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
   if(u.pathname==='/js/games/tavla.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/games/tavla.js'),'utf8')+hooks});
   const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});
  });
  await page.goto(base);await page.locator('[data-mode="local"]').click();
  for(const scale of [1,.85,.8,1.3])for(const flip of [false,true]){
   await page.evaluate(([z,f])=>window.__tvQA.reset(z,f),[scale,flip]);
   const from=await page.evaluate(()=>window.__tvQA.screenPoint(5)),to=await page.evaluate(()=>window.__tvQA.screenPoint(2));
   await page.touchscreen.tap(from.x,from.y);
   assert.equal(await page.evaluate(()=>window.__tvQA.selected()),5,`home checker selected at ${scale}, flip ${flip}`);
   await page.touchscreen.tap(to.x,to.y);
   const s=await page.evaluate(()=>window.__tvQA.state());
   assert.equal(s.points[5],4);assert.equal(s.points[2],1);assert.deepEqual(s.used,[1],'3 consumed; 6 remains');
   console.log('PASS touch 6–3, scale',scale,'flipped',flip);
  }
  await page.evaluate(()=>window.__tvQA.reset(.85,false));
  const from=await page.evaluate(()=>window.__tvQA.screenPoint(5)),to=await page.evaluate(()=>window.__tvQA.screenPoint(2));
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
  assert.equal(await page.evaluate(()=>window.__tvQA.state().points[2]),1,'scaled drag plays the same move');
  await page.evaluate(()=>window.__tvQA.close());assert.deepEqual(errors,[]);
  console.log('PASS scaled drag; no browser errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
