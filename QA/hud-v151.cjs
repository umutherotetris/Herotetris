// Real shared HUD module. Account reads are deterministic memory fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`const state={uid:'me',profile:{nick:'VeryLongPlayerName'.repeat(4),avatar:'🙂'},isAdmin:false};const reads=[];window.__hudReads=reads;export const db={};export const fdb={ref:(_,p)=>p,get:p=>new Promise(resolve=>reads.push({p,resolve}))};export const Auth={getState:()=>state};`;
const store=`export const getState=()=>({level:1,xp:0});`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM});let failed=0;
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());if(u.origin!==base)return route.abort();
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><body><script type="module">window.__hud=await import("/js/hud.js");</script>'});
   if(u.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
   if(u.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
   const p=path.resolve(root,'.'+u.pathname);if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return route.fulfill({status:404});
   if(u.pathname==='/js/hud.js'&&process.env.HUD_V151_SOURCE_REF){const {execFileSync}=require('node:child_process');return route.fulfill({contentType:'text/javascript',body:execFileSync('git',['show',process.env.HUD_V151_SOURCE_REF+':js/hud.js'],{cwd:root,encoding:'utf8'})});}
   return route.fulfill({path:p});
  });
  await page.goto(base);await page.waitForFunction(()=>!!window.__hud);
  async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
  await test('deferred Kelime-style attachment starts live score updates',async()=>{
   await page.evaluate(async()=>{window.__liveScore=0;window.__detachedHud=await window.__hud.createVsHUD({root:null,myScore:()=>window.__liveScore,oppScore:()=>0});document.body.appendChild(window.__detachedHud.el);window.__liveScore=123;});
   await page.waitForFunction(()=>window.__detachedHud.el.querySelector('[data-hud-score="me"]').textContent==='123',null,{timeout:1600});
  });
  await page.evaluate(()=>window.__detachedHud.destroy());
  await test('a late opponent read cannot replace the newer solo HUD',async()=>{
   await page.evaluate(async()=>{const r=document.createElement('section');document.body.appendChild(r);window.__hudRoot=r;window.__lateHUD=window.__hud.createVsHUD({root:r,oppUid:'late',myScore:()=>0});window.__solo=window.__hud.createSoloHUD({root:r,score:()=>7});for(const read of window.__hudReads.splice(0))read.resolve({exists:()=>true,val:()=>({nick:'Late opponent'})});await window.__lateHUD;});
   assert.equal(await page.locator('section .ghud-solo').count(),1);assert.equal(await page.locator('section .ghud').count(),0);
  });
  await page.evaluate(async()=>{window.__solo.destroy();(await window.__lateHUD).destroy();window.__hudRoot.remove();});
  await test('long player names and solo stats stay within a narrow HUD',async()=>{
   await page.evaluate(()=>{const r=document.createElement('section');r.style.width='320px';document.body.appendChild(r);window.__narrowRoot=r;window.__narrow=window.__hud.createSoloHUD({root:r,score:()=>999999,lines:()=>120,level:()=>99});});
   assert.equal(await page.locator('.ghud-solo').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  });
  await page.evaluate(()=>{window.__narrow.destroy();window.__narrowRoot.remove();});
  assert.deepEqual(errors,[],'no module or timer errors');
 }finally{await browser.close();}
 if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
