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
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.querySelectorAll('.game-art,.intro-art img')].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.evaluate(()=>typeof window.Peer),'function','local multiplayer library loads without a CDN');
  assert.equal(await page.evaluate(()=>document.fonts.check('600 16px Manrope','Türkçe İstanbul')),true,'local font supports Turkish');
  await page.waitForFunction(()=>!!window.__testSetPlayer);
  for(const width of [320,390,600,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
    assert.equal(await page.locator('.game-pc').count(),4);
    await page.waitForFunction(()=>[...document.querySelectorAll('.game-pc')].every(card=>card.scrollWidth<=card.clientWidth),null,{timeout:2000});
    assert.equal(await page.locator('.game-pc').evaluateAll(cards=>cards.every(card=>card.scrollWidth<=card.clientWidth)),true,`card overflow at ${width}`);
    for(const screen of ['friends','leaderboard','profile','notifications','home']){
      await page.locator(`.bottom-nav [data-nav="${screen}"]`).click();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${screen} overflow at ${width}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  for(const screen of ['friends','leaderboard','profile','notifications','home']){
    await page.locator(`.bottom-nav [data-nav="${screen}"]`).click();
    assert.equal(await page.locator(`[data-screen="${screen}"]`).evaluate(el=>el.classList.contains('active')),true);
    assert.equal(await page.locator(`.bottom-nav [data-nav="${screen}"]`).getAttribute('aria-current'),'page');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.screen),screen);
  }
  await page.locator('.bottom-nav [data-nav="friends"]').click();
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  await page.goBack();
  await page.waitForFunction(()=>document.querySelector('[data-screen="friends"]').classList.contains('active'));
  await page.goForward();
  await page.waitForFunction(()=>document.querySelector('[data-screen="profile"]').classList.contains('active'));
  await page.locator('.bottom-nav [data-nav="home"]').click();
  await page.locator('[data-stage-select="tavla"]').click();
  assert.equal(await page.locator('#stageTitle').textContent(),'Tavla');
  assert.equal(await page.locator('[data-select="tavla"]').getAttribute('aria-pressed'),'true');
  await page.locator('#lobbyChatSlot #gemFloatBtn').click();
  await page.locator('#gemHubPanel.ghp-open').waitFor({state:'visible'});
  await page.locator('#ghpCloseBtn').click();
  await page.waitForFunction(()=>!document.getElementById('gemHubPanel').classList.contains('ghp-open'));
  // Lobby discovery: filters, favorites, keyboard search, contextual help, persistent recents.
  await page.locator('[data-filter="favorites"]').click();
  assert.equal(await page.locator('#collectionEmpty').isVisible(),true);
  await page.locator('#resetFilter').click();
  await page.locator('[data-favorite="chess"]').click();
  await page.locator('[data-filter="favorites"]').click();
  assert.equal(await page.locator('[data-game-card]:visible').count(),1);
  await page.locator('[data-favorite="chess"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.filter),'favorites');
  await page.locator('#resetFilter').click();
  await page.locator('[data-filter="together"]').click();
  assert.equal(await page.locator('[data-game-card]:visible').count(),3);
  await page.locator('[data-filter="all"]').click();
  await page.locator('[data-select="chess"]').click();
  assert.equal(await page.locator('#stageTitle').textContent(),'Satranç');
  await page.locator('#stageHelp').click();
  assert.equal(await page.locator('#guideTitle').textContent(),'Satranç');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'stageHelp');
  await page.locator('#searchTrigger').click();
  await page.locator('#gameSearchInput').fill('SATRANÇ');
  assert.equal(await page.locator('.search-result').count(),1);
  await page.locator('#gameSearchInput').fill('zzzz');
  assert.equal(await page.locator('.search-empty').isVisible(),true);
  await page.locator('#gameSearchInput').fill('kelime');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.locator('#stageTitle').textContent(),'Kelimecik');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'stagePlay');
  await page.locator('#stageHelp').click();await page.locator('#guidePlay').click();
  await page.locator('.kl-root').waitFor({state:'visible'});
  assert.equal(await page.locator('#gameGuide').evaluate(d=>d.open),false);
  await page.waitForFunction(()=>document.getElementById('recentName').textContent==='Kelimecik');
  await page.reload();await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('#stageTitle').textContent(),'Kelimecik');
  await page.locator('[data-favorite="tetris"]').click();
  await page.reload();await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('[data-favorite="tetris"]').getAttribute('aria-pressed'),'true');
  await page.locator('.bottom-nav [data-nav="friends"]').click();
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'games');
  assert.equal(await page.locator('[data-screen="home"]').evaluate(el=>el.classList.contains('active')),true);
  await page.locator('.intro-secondary').click();
  assert.equal(await page.locator('[data-screen="friends"]').evaluate(el=>el.classList.contains('active')),true);
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
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
  await page.locator('.bottom-nav [data-nav="profile"]').click();
  await page.locator('[data-p="settings"]').click();
  for(const theme of ['lounge','ivory','neon','cosmic','sunset','emerald','golden','crimson','ocean','mono']){
    await page.locator(`.theme-chip[data-theme="${theme}"]`).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${theme} settings overflow`);
  }
  await page.locator('.theme-chip[data-theme="ivory"]').click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.set-row')).color==='rgb(49, 89, 64)',null,{timeout:2000});
  assert.equal(await page.locator('.set-row').first().evaluate(el=>getComputedStyle(el).color),'rgb(49, 89, 64)','ivory settings labels remain readable on a light background');
  for(const scale of [80,130,100]){
    await page.locator('#scaleSlider').evaluate((slider,value)=>{slider.value=value;slider.dispatchEvent(new Event('input',{bubbles:true}));},String(scale));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`UI scale ${scale} overflow`);
    assert.equal(await page.locator('.nick-modal').evaluate(modal=>{const r=modal.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1;}),true,`settings stay inside viewport at scale ${scale}`);
  }
  await page.locator('#stClose').click();
  await page.locator('.bottom-nav [data-nav="home"]').click();
  await page.evaluate(()=>localStorage.setItem('hero_theme','emerald'));
  await page.reload(); await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'emerald');
  assert.equal(await page.locator('#gameTetris').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.evaluate(()=>localStorage.setItem('hero_theme','ivory'));
  await page.reload(); await page.waitForFunction(()=>!!window.Hero);
  if(process.env.PORTAL_SCREENSHOTS){
    await page.evaluate(()=>{localStorage.setItem('hero_theme','lounge');localStorage.removeItem('hero_lobby_recent');localStorage.removeItem('hero_lobby_favorites');});
    await page.reload();await page.waitForFunction(()=>!!window.Hero);await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});
    await page.setViewportSize({width:1440,height:1000}); await page.waitForTimeout(200); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(200); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-mobile.png'),fullPage:true});
    await page.locator('.bottom-nav [data-nav="profile"]').click();
    await page.locator('[data-p="settings"]').click();
    await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-settings.png')});
  }
  assert.deepEqual(pageErrors,[], 'unexpected browser error');
  const offline=await browser.newPage(); await setup(offline,false); await offline.goto(base);
  await offline.locator('.portal-retry').waitFor({state:'visible'});
  await offline.locator('#gameTetris').click();
  assert.match(await offline.locator('#portalStatus').textContent(),/bağlanılamadı/);
  await offline.locator('.bottom-nav [data-nav="friends"]').click();
  assert.equal(await offline.locator('[data-screen="friends"]').evaluate(el=>el.classList.contains('active')),true);
  await browser.close();
  console.log('PASS: 6 viewport widths across 5 routes, local Turkish font/art/PeerJS, keyboard/skip/hero actions, live score/XP, 4 real game entries, 10 themes/settings, lobby search/filter/favorite/guide/recent flows, reduced motion and connection recovery. Backend: in-memory fixtures.');
})().catch(error=>{console.error(error);process.exit(1)});
