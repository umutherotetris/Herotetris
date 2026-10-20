// UI integration checks. Account/store are in-memory fixtures; no live account writes.
// Run with a Playwright installation: node QA/portal-ui.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:8765';
const authFixture = `
  let state={status:'anon',uid:null,profile:null,isAdmin:false,displayName:'Misafir Oyuncu'};
  const listeners=new Set();
  const empty={exists:()=>false,val:()=>null,forEach:()=>{}};
  export const db={};
  export const fdb=new Proxy({}, {get:(_,key)=> key==='get'?async()=>empty:key==='onValue'?()=>()=>{}:key==='serverTimestamp'?()=>0:()=>({})});
  export async function loginGoogle(){return {ok:false,userCancelled:true};}
  export const Auth={getState:()=>state,subscribe:fn=>{listeners.add(fn);fn(state);return()=>listeners.delete(fn)},ready:Promise.resolve(),loginGoogle,db,auth:{currentUser:null}};
  window.__testAuth=next=>{state=next;listeners.forEach(fn=>fn(state));};
  export default Auth;
`;
const storeSource=fs.readFileSync(path.join(root,'js/store.js'),'utf8');
const storeNames=[...storeSource.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)].map(m=>m[1]);
const storeFixture=`
  let player={kaju:0,level:1,xp:0,totalXP:0,best:{}}; const subs=new Set();
  const values={getKajuLog:()=>[],getKajuSummary:()=>({earned:0,spent:0,net:0}),getStats:()=>({}),getInventory:()=>({}),getCosmetics:()=>({}),getMatchHistory:()=>[],getActiveBoosts:()=>[],getBoostMult:()=>1,xpForLevel:lv=>300+lv*200};
  export const Store=new Proxy({getState:()=>player,subscribe:fn=>{subs.add(fn);fn(player);return()=>subs.delete(fn)}}, {get:(obj,key)=>obj[key]||values[key]||(()=>0)});
  window.__testSetPlayer=next=>{player=next;subs.forEach(fn=>fn(player));};
  ${storeNames.map(n=>`export const ${n}=(...args)=>Store.${n}(...args);`).join('\n')}
  export const VIP_DISCOUNT=0.1; export default Store;
`;
async function setup(page, fixtures=true){
  await page.route('**/*', async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==base) return route.abort();
    if(fixtures&&url.pathname==='/js/auth.js') return route.fulfill({contentType:'text/javascript',body:authFixture});
    if(fixtures&&url.pathname==='/js/store.js') return route.fulfill({contentType:'text/javascript',body:storeFixture});
    if(!fixtures&&url.pathname==='/js/auth.js') return route.abort();
    const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
    if(!file.startsWith(root+path.sep)) return route.fulfill({status:403});
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()) return route.fulfill({status:404,body:'Missing'});
    await route.fulfill({path:file});
  });
}
(async()=>{
  const launch={headless:true};
  if(process.env.PORTAL_CHROMIUM) launch.executablePath=process.env.PORTAL_CHROMIUM;
  const browser=await chromium.launch(launch);
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const pageErrors=[]; page.on('pageerror',e=>pageErrors.push(e.message));
  await setup(page); await page.goto(base); await page.waitForFunction(()=>!!window.Hero);
  await page.waitForFunction(()=>!!window.__testSetPlayer);
  for(const width of [320,390,600,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
    assert.equal(await page.locator('.game-pc').count(),4);
    assert.equal(await page.locator('.game-pc').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth)),true,`card overflow at ${width}`);
  }
  await page.setViewportSize({width:390,height:844});
  for(const screen of ['friends','leaderboard','profile','notifications','home']){
    await page.locator(`.bottom-nav [data-nav="${screen}"]`).click();
    assert.equal(await page.locator(`[data-screen="${screen}"]`).evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator(`.bottom-nav [data-nav="${screen}"]`).getAttribute('aria-current'),'page');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.screen),screen);
  }
  await page.locator('.bottom-nav [data-nav="friends"]').click();
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'games');
  assert.equal(await page.locator('[data-screen="home"]').evaluate(el=>el.classList.contains('active')),true);
  await page.evaluate(()=>window.__testSetPlayer({level:2,xp:350,kaju:15,best:{tetris:12345}}));
  assert.equal(await page.locator('#statBest').textContent(),'12.3K');
  assert.equal(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow'),'50');
  await page.evaluate(()=>window.__testSetPlayer({level:1,xp:0,kaju:0,best:{}}));
  assert.equal(await page.locator('#statBest').textContent(),'0');
  for(const [card,overlay] of [['gameTetris','.hero-select-overlay'],['gameChess','.chess-root'],['gameTavla','.tavla-root'],['gameKelime','.kl-root']]){
    await page.locator('#'+card).focus(); await page.keyboard.press('Enter');
    await page.locator(overlay).waitFor({state:'visible',timeout:10000});
    await page.locator(overlay).evaluate(el=>el.remove());
  }
  // Reload resets the original game modules' open state.
  await page.reload(); await page.waitForFunction(()=>!!window.Hero);
  await page.evaluate(()=>localStorage.setItem('hero_theme','emerald'));
  await page.reload(); await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'emerald');
  assert.equal(await page.locator('#gameTetris').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.evaluate(()=>localStorage.setItem('hero_theme','neon'));
  await page.reload(); await page.waitForFunction(()=>!!window.Hero);
  if(process.env.PORTAL_SCREENSHOTS){
    await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});
    await page.setViewportSize({width:1440,height:1000}); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-mobile.png'),fullPage:true});
  }
  assert.deepEqual(pageErrors,[], 'unexpected browser error');
  const offline=await browser.newPage(); await setup(offline,false); await offline.goto(base);
  await offline.locator('.portal-retry').waitFor({state:'visible'});
  await offline.locator('#gameTetris').click();
  assert.match(await offline.locator('#portalStatus').textContent(),/bağlanılamadı/);
  await offline.locator('.bottom-nav [data-nav="friends"]').click();
  assert.equal(await offline.locator('[data-screen="friends"]').evaluate(el=>el.classList.contains('active')),true);
  await browser.close();
  console.log('PASS: 6 viewport widths, 5 navigation routes, keyboard/skip focus, live score/XP rendering, 4 real game entry modules, saved theme, reduced motion, offline recovery. Backend: in-memory fixtures.');
})().catch(error=>{console.error(error);process.exit(1)});
