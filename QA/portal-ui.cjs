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
    if(url.pathname==='/js/games/tetris.js') return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/games/tetris.js'),'utf8')+'\nwindow.__tetrisQA={state:()=>G,score:animateScore,drop:hardDrop,close,launch:launchGame};'});
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
  await page.evaluate(()=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth>0?resolve():reject(new Error('empty atlas'));img.onerror=()=>reject(new Error('missing atlas'));img.src='assets/aurora-games.webp?v=142';}));
  assert.equal(await page.locator('html').getAttribute('data-theme'),'aurora');
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
  await page.locator('[data-guide="tavla"]').click();
  assert.equal(await page.locator('#guideTitle').textContent(),'Tavla');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#gemFloatBtn .tw-gem').textContent(),'💎');
  assert.equal(await page.locator('#adminFloatBtn').isVisible(),false,'crown retains admin-only visibility');
  await page.locator('#gemFloatBtn').click();
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
  await page.locator('[data-guide="chess"]').click();
  assert.equal(await page.locator('#guideTitle').textContent(),'Satranç');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.guide),'chess');
  await page.locator('#searchTrigger').click();
  await page.locator('#gameSearchInput').fill('SATRANÇ');
  assert.equal(await page.locator('.search-result').count(),1);
  await page.locator('#gameSearchInput').fill('zzzz');
  assert.equal(await page.locator('.search-empty').isVisible(),true);
  await page.locator('#gameSearchInput').fill('kelime');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'gameKelime');
  await page.locator('[data-guide="kelime"]').click();await page.locator('#guidePlay').click();
  await page.locator('.kl-root').waitFor({state:'visible'});
  assert.equal(await page.locator('#gameGuide').evaluate(d=>d.open),false);
  await page.waitForFunction(()=>document.getElementById('recentName').textContent==='Kelimecik');
  await page.reload();await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('#recentName').textContent(),'Kelimecik');
  await page.locator('[data-favorite="tetris"]').click();
  await page.reload();await page.waitForFunction(()=>!!window.Hero);
  assert.equal(await page.locator('[data-favorite="tetris"]').getAttribute('aria-pressed'),'true');
  await page.locator('.bottom-nav [data-nav="friends"]').click();
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'games');
  assert.equal(await page.locator('[data-screen="home"]').evaluate(el=>el.classList.contains('active')),true);
  await page.locator('.friends-open').click();
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
  for(const theme of ['aurora','lounge','ivory','neon','cosmic','sunset','emerald','golden','crimson','ocean','mono']){
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
  await page.evaluate(()=>window.__testAuth({status:'google',uid:'fixture-admin',isAdmin:true,displayName:'Test Oyuncusu',profile:{nick:'Test Oyuncusu'}}));
  await page.locator('#adminFloatBtn').waitFor({state:'visible'});
  assert.equal(await page.locator('#adminFloatBtn .tw-crown').textContent(),'👑');
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`admin viewport overflow at ${width}`);
    assert.equal(await page.locator('#adminFloatBtn').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width===34;}),true,'crown keeps its original 34px size');
  }
  await page.locator('#adminFloatBtn').click();
  await page.locator('#adminPanel').waitFor({state:'visible'});
  await page.locator('#adminPanel [data-a="close"]').click();
  await page.evaluate(()=>window.__testAuth({status:'anon',uid:null,isAdmin:false,displayName:'Misafir Oyuncu',profile:null}));
  assert.equal(await page.locator('#adminFloatBtn').isVisible(),false);
  if(process.env.PORTAL_SCREENSHOTS){
    await page.evaluate(()=>{localStorage.setItem('hero_theme','aurora');localStorage.removeItem('hero_lobby_recent');localStorage.removeItem('hero_lobby_favorites');});
    await page.reload();await page.waitForFunction(()=>!!window.Hero);await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});
    await page.setViewportSize({width:1440,height:1000}); await page.waitForTimeout(200); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(200); await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-mobile.png'),fullPage:true});
    await page.locator('.bottom-nav [data-nav="profile"]').click();
    await page.locator('[data-p="settings"]').click();
    await page.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-settings.png')});
  }
  // Floating jewels retain their original saved-position keys and panel actions.
  const dragPage=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true});
  await setup(dragPage); await dragPage.goto(base); await dragPage.waitForFunction(()=>!!window.Hero);
  const adminState={status:'google',uid:'fixture-admin',isAdmin:true,displayName:'Test Oyuncusu',profile:{nick:'Test Oyuncusu'}};
  await dragPage.evaluate(state=>window.__testAuth(state),adminState);
  await dragPage.emulateMedia({reducedMotion:'no-preference'});
  for(const [selector,animation] of [['#gemFloatBtn','twGemPulse'],['#adminFloatBtn','twAdminPulse'],['.tw-gem','twGemShine'],['.tw-crown','twCrownFloat'],['.tw-spark-cyan-1','twSparkCyan'],['.tw-spark-gold-1','twSparkGold']]){
    const style=await dragPage.locator(selector).evaluate(el=>({animation:getComputedStyle(el).animationName,display:getComputedStyle(el).display}));
    assert.equal(style.animation,animation,'original jewel animation');
    assert.notEqual(style.display,'none','original spark is not suppressed');
  }
  assert.equal(await dragPage.locator('#gemFloatBtn img, #adminFloatBtn img').count(),0,'no replacement artwork');
  await dragPage.emulateMedia({reducedMotion:'reduce'});
  const positions={};
  for(const [id,x,y] of [['gemFloatBtn',65,260],['adminFloatBtn',265,360]]){
    const fab=dragPage.locator('#'+id);
    assert.equal(await fab.evaluate(el=>el.parentElement.classList.contains('jewel-slot')&&el.dataset.parked==='true'),true);
    const before=await fab.boundingBox();
    assert.equal(before.width,34,id+' keeps its original size');
    assert.equal(before.height,34);
    await dragPage.mouse.move(before.x+before.width/2,before.y+before.height/2);
    await dragPage.mouse.down();
    await dragPage.mouse.move(x+before.width/2,y+before.height/2,{steps:12});
    await dragPage.mouse.up();
    const after=await fab.boundingBox();
    assert.ok(Math.abs(after.x-x)<2&&Math.abs(after.y-y)<2, id+' follows pointer');
    positions[id]=await fab.evaluate(el=>JSON.parse(localStorage.getItem('twFab_'+el.id)));
    assert.ok(Math.abs(positions[id].left-x)<2&&Math.abs(positions[id].top-y)<2,id+' saves position');
  }
  assert.equal(await dragPage.locator('#gemHubPanel').evaluate(el=>el.classList.contains('ghp-open')),false,'drag does not open social panel');
  assert.equal(await dragPage.locator('#adminPanel').isVisible(),false,'drag does not open admin panel');
  await dragPage.evaluate(()=>localStorage.setItem('hero_jewel_start','remember'));
  await dragPage.reload();await dragPage.waitForFunction(()=>!!window.Hero);
  await dragPage.evaluate(state=>window.__testAuth(state),adminState);
  for(const id of Object.keys(positions)){
    const r=await dragPage.locator('#'+id).boundingBox();
    assert.ok(Math.abs(r.x-positions[id].left)<2&&Math.abs(r.y-positions[id].top)<2,id+' restores saved position');
  }
  await dragPage.locator('#gemFloatBtn').click();
  await dragPage.locator('#gemHubPanel.ghp-open').waitFor({state:'visible'});
  await dragPage.locator('#ghpCloseBtn').click();
  await dragPage.locator('#adminFloatBtn').click();
  await dragPage.locator('#adminPanel').waitFor({state:'visible'});
  await dragPage.evaluate(()=>localStorage.setItem('hero_ui_scale','0.85'));
  await dragPage.reload();await dragPage.waitForFunction(()=>!!window.Hero);
  assert.equal(await dragPage.evaluate(()=>localStorage.getItem('hero_ui_scale')),'0.85','saved UI scale survives');
  await dragPage.waitForFunction(()=>window.__uiScale===0.85);
  // Personalization: persistence, account isolation, safe text and park defaults.
  await dragPage.evaluate(()=>{localStorage.setItem('hero_ui_scale','1');localStorage.removeItem('hero_jewel_start');});
  await dragPage.reload();await dragPage.waitForFunction(()=>!!window.Hero);
  assert.equal(await dragPage.locator('#gemFloatBtn').getAttribute('data-parked'),'true','fresh start auto-parks');
  await dragPage.locator('.bottom-nav [data-nav="profile"]').click();
  await dragPage.locator('[data-p="personalize"]').click();
  const editor=dragPage.locator('#profilePersonalize');
  await editor.locator('[name="title"]').fill('Gece oyuncusu');
  await editor.locator('[name="bio"]').fill('<img src=x onerror=alert(1)>');
  await editor.locator('[name="avatar"]').selectOption('🐉');
  await editor.locator('[name="game"]').selectOption('chess');
  await editor.locator('[name="background"]').selectOption('ocean');
  await editor.locator('[name="frame"]').check();
  await editor.locator('[type="submit"]').click();
  assert.equal(await dragPage.locator('.profile-intro img').count(),0,'bio is plain text');
  assert.match(await dragPage.locator('.profile-intro').textContent(),/Gece oyuncusu/);
  await dragPage.reload();await dragPage.waitForFunction(()=>!!window.Hero);
  await dragPage.locator('.bottom-nav [data-nav="profile"]').click();
  assert.match(await dragPage.locator('.profile-intro').textContent(),/Gece oyuncusu/);
  await dragPage.evaluate(state=>window.__testAuth(state),adminState);
  assert.doesNotMatch(await dragPage.locator('.profile-intro').textContent(),/Gece oyuncusu/,'another account has separate settings');
  await dragPage.locator('[data-p="personalize"]').click();
  await editor.locator('[data-park]').click();
  await dragPage.keyboard.press('Escape');
  assert.equal(await dragPage.locator('#adminFloatBtn').getAttribute('data-parked'),'true');
  // Dragging at non-default UI scale follows the pointer without jumping.
  await dragPage.evaluate(async()=>{document.body.style.zoom='0.85';window.__uiScale=.85;window.dispatchEvent(new Event('hero:scale'));});
  const jewel=await dragPage.locator('#gemFloatBtn').boundingBox();
  await dragPage.mouse.move(jewel.x+jewel.width/2,jewel.y+jewel.height/2);await dragPage.mouse.down();
  await dragPage.mouse.move(90+jewel.width/2,250+jewel.height/2,{steps:10});await dragPage.mouse.up();
  const dropped=await dragPage.locator('#gemFloatBtn').boundingBox();
  assert.ok(Math.abs(dropped.x-90)<2&&Math.abs(dropped.y-250)<2,'scaled jewel follows pointer');
  const cdp=await dragPage.context().newCDPSession(dragPage);
  await dragPage.evaluate(()=>window.dispatchEvent(new Event('hero:park-jewels')));
  const touchBox=await dragPage.locator('#gemFloatBtn').boundingBox();
  const touchStart={x:touchBox.x+touchBox.width/2,y:touchBox.y+touchBox.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touchStart]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:120+touchBox.width/2,y:290+touchBox.height/2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const touchEnd=await dragPage.locator('#gemFloatBtn').boundingBox();
  assert.ok(Math.abs(touchEnd.x-120)<2&&Math.abs(touchEnd.y-290)<2,'real touch input drags parked jewel');
  await cdp.detach();
  if(process.env.PORTAL_SCREENSHOTS){
    await dragPage.evaluate(()=>{document.body.style.zoom='';window.__uiScale=1;window.dispatchEvent(new Event('hero:park-jewels'));});
    await dragPage.locator('.bottom-nav [data-nav="home"]').click();
    await dragPage.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-parked-admin.png'),fullPage:true});
    await dragPage.locator('.bottom-nav [data-nav="profile"]').click();await dragPage.locator('[data-p="personalize"]').click();
    await dragPage.screenshot({path:path.join(process.env.PORTAL_SCREENSHOTS,'portal-personalize.png')});
  }
  await dragPage.close();
  // Exercise the real Tetris module; test hooks exist only in this route fixture.
  const tPage=await browser.newPage({viewport:{width:390,height:844}});await setup(tPage);
  const tErrors=[];tPage.on('pageerror',e=>tErrors.push(e.message));
  await tPage.goto(base);await tPage.waitForFunction(()=>!!window.Hero);
  await tPage.locator('#gameTetris').click();await tPage.locator('.hs-play').click();
  await tPage.waitForFunction(()=>!!window.__tetrisQA?.state());
  await tPage.evaluate(()=>{const q=window.__tetrisQA,s=q.state();s.countdown=0;s.paused=true;s.score=100;q.score();});
  await tPage.waitForTimeout(30);
  await tPage.evaluate(()=>{window.__tetrisQA.state().score=800;window.__tetrisQA.score();});
  await tPage.waitForFunction(()=>window.__tetrisQA.state().displayScore===800);
  await tPage.evaluate(()=>{const s=window.__tetrisQA.state();s.paused=false;s.countdown=0;window.__tetrisQA.drop();});
  assert.ok(await tPage.evaluate(()=>window.__tetrisQA.state().board.flat().some(Boolean)),'hard drop locks real cells');
  await tPage.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await tPage.evaluate(()=>window.__tetrisQA.state().paused),true,'backgrounding pauses solo Tetris');
  await tPage.evaluate(()=>{window.__tetrisQA.state().paused=false;document.querySelector('[data-ctrl="left"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));window.__tetrisQA.close();});
  await tPage.waitForTimeout(200);assert.deepEqual(tErrors,[],'closing while control held leaves no timer errors');
  await tPage.close();
  assert.deepEqual(pageErrors,[], 'unexpected browser error');
  const offline=await browser.newPage(); await setup(offline,false); await offline.goto(base);
  await offline.locator('.portal-retry').waitFor({state:'visible'});
  await offline.locator('#gameTetris').click();
  assert.match(await offline.locator('#portalStatus').textContent(),/bağlanılamadı/);
  await offline.locator('.bottom-nav [data-nav="friends"]').click();
  assert.equal(await offline.locator('[data-screen="friends"]').evaluate(el=>el.classList.contains('active')),true);
  await browser.close();
  console.log('PASS: 6 viewport widths across 5 routes, local Turkish font/art/PeerJS, keyboard/skip/hero actions, live score/XP, 4 real game entries, 11 themes/settings, lobby search/filter/favorite/guide/recent flows, reduced motion and connection recovery. Backend: in-memory fixtures.');
})().catch(error=>{console.error(error);process.exit(1)});
