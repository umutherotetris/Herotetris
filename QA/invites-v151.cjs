// Real social module and real lazy game imports. Firebase/Peer/account are inert fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`
 const state={status:'google',uid:'qa-invites',displayName:'Fixture',profile:{nick:'Fixture'},isAdmin:false};
 const empty={exists:()=>false,val:()=>null,forEach:()=>{}},writes=[];window.__writes=writes;
 export const db={};
 export const fdb=new Proxy({
  ref:(_db,path)=>({path}),get:async()=>empty,onValue:()=>()=>{},serverTimestamp:()=>0,
  push:async(ref,value)=>{writes.push({type:'push',path:ref.path,value});return {key:'fixture'};},
  set:async(ref,value)=>{writes.push({type:'set',path:ref.path,value});},
  update:async(ref,value)=>{writes.push({type:'update',path:ref.path,value});},
  remove:async ref=>{writes.push({type:'remove',path:ref.path});}
 },{get:(o,k)=>o[k]||(()=>({}))});
 export async function loginGoogle(){return {ok:false,userCancelled:true};}
 export const Auth={getState:()=>state,subscribe:fn=>{fn(state);return()=>{};},ready:Promise.resolve(),loginGoogle,db,auth:{currentUser:null}};
 export default Auth;
`;
const names=[...fs.readFileSync(path.join(root,'js/store.js'),'utf8').matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const store=`const state={kaju:0,level:1,xp:0,totalXP:0,best:{}};export const Store=new Proxy({getState:()=>state,subscribe:fn=>{fn(state);return()=>{};}},{get:(o,k)=>o[k]||(()=>0)});${names.map(n=>`export const ${n}=(...a)=>Store.${n}(...a);`).join('\n')}export const VIP_DISCOUNT=.1;export default Store;`;
const hooks='\nwindow.__invites={open:_openGameModule,accept:_acceptGameInvite,host:_launchGameAsInviteHost,picker:_showGameInvitePicker};';
const html='<!doctype html><html lang="tr"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/base.css"><link rel="stylesheet" href="/css/components.css"><body><script type="module">import Auth from "/js/auth.js";import Store from "/js/store.js";window.Hero={Auth,Store,toast:()=>{}};import "/js/social.js";</script></body></html>';
const roots='.chess-root,.tavla-root,.kl-root,.tetris-overlay,.hero-select-overlay';
let browser,failures=0;
async function setup(portal=false){
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[],missing=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.__peers=[];
  window.__FakePeer=class {
   constructor(id){this.id=typeof id==='string'?id:'fixture-peer';this.destroyed=false;this.events=new Map();window.__peers.push(this);}
   on(type,fn){this.events.set(type,fn);return this;}
   connect(){return {open:false,on(){return this;},send(){},close(){}};}
   disconnect(){}destroy(){this.destroyed=true;}
  };
  window.Peer=window.__FakePeer;
 });
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
  if(u.pathname==='/'&&!portal)return route.fulfill({contentType:'text/html',body:html});
  if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
  if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
  if(u.pathname==='/js/vendor/peerjs-1.5.4.min.js')return route.fulfill({contentType:'text/javascript',body:'window.Peer=window.__FakePeer;'});
  if(u.pathname==='/js/social.js'){
   const code=process.env.INVITES_V151_SOURCE_REF
    ?execFileSync('git',['show',process.env.INVITES_V151_SOURCE_REF+':js/social.js'],{cwd:root,encoding:'utf8'})
    :fs.readFileSync(path.join(root,'js/social.js'),'utf8');
   return route.fulfill({contentType:'text/javascript',body:code+hooks});
  }
  const file=path.resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){missing.push(u.pathname);return route.fulfill({status:404});}
  return route.fulfill({path:file});
 });
 await page.goto(base);await page.waitForFunction(()=>!!window.__invites&&!!window.Hero);
 return {page,errors,missing};
}
async function expectRoot(page,selector,missing){
 for(let i=0;i<200;i++){
  if(await page.locator(selector).count())return;
  const bad=missing.find(file=>/^\/games\//.test(file));
  assert.equal(bad,undefined,'invite import must resolve inside /js/games, not '+bad);
  await page.waitForTimeout(10);
 }
 assert.equal(await page.locator(selector).count(),1,'invited game module must open its real UI');
}
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n'+e.message);}}
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 browser=await chromium.launch(launch);
 try{
  for(const [game,selector] of [['chess','.chess-root'],['tavla','.tavla-root'],['tetris','.hero-select-overlay'],['kelime','.kl-root']]){
   await test(game+' invitation fallback imports the real game module',async()=>{
    const {page,errors,missing}=await setup();try{
     await page.evaluate(game=>window.__invites.open(game),game);await expectRoot(page,selector,missing);
     assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
    }finally{await page.close();}
   });
  }
  await test('invitation routing and collection cards share one active-game guard',async()=>{
   const {page,errors,missing}=await setup(true);try{
    await page.evaluate(()=>window.__invites.open('tavla'));
    await expectRoot(page,'.tavla-root',missing);
    await page.evaluate(()=>window.Hero.openChess());
    assert.equal(await page.locator('.tavla-root').count(),1,'collection tap preserves invited game');
    assert.equal(await page.locator('.chess-root').count(),0,'collection tap cannot stack a second engine');
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('accepting a second game cannot overwrite invite context or stack its engine',async()=>{
   const {page,errors}=await setup(true);try{
    await page.evaluate(()=>window.Hero.openChess());
    const before=await page.evaluate(()=>{const value=JSON.stringify({game:'chess',code:'OLD123',role:'host',ts:Date.now()});localStorage.setItem('hero_invite_ctx',value);window.__invites.accept('tavla','ABC234','Opponent');return value;});
    assert.equal(await page.evaluate(()=>localStorage.getItem('hero_invite_ctx')),before,'blocked invite acceptance must not replace pending context');
    assert.equal(await page.locator('.tavla-root').count(),0);assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('hosting a second invitation cannot replace an active game context',async()=>{
   const {page,errors}=await setup(true);try{
    await page.evaluate(()=>window.Hero.openChess());
    const before=await page.evaluate(()=>{const value='existing-context';localStorage.setItem('hero_invite_ctx',value);window.__invites.host('tetris','ABC234','Opponent');return value;});
    assert.equal(await page.evaluate(()=>localStorage.getItem('hero_invite_ctx')),before);
    assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
  await test('a game invitation cannot be sent while another engine is active',async()=>{
   const {page,errors}=await setup(true);try{
    await page.evaluate(()=>window.Hero.openChess());
    await page.evaluate(()=>window.__invites.picker('opponent','Opponent'));
    if(await page.locator('[data-gi="tavla"]').count())await page.locator('[data-gi="tavla"]').click();
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>window.__writes.slice().filter(w=>w.type==='push'&&w.path==='userNotifs/opponent').length),0,'blocked send must not notify an opponent without hosting a room');
    assert.equal(await page.locator(roots).count(),1);assert.deepEqual(errors,[]);
   }finally{await page.close();}
  });
 }finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
