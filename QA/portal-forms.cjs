// Form regressions; auth and transfers are memory-only fixtures.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const auth=`
  const state={uid:'me',status:'google',displayName:'Fixture',profile:{},isAdmin:false};
  window.__forms={authSubscriptions:0,storeSubscriptions:0,transfers:[],mode:'partial'};
  export async function loginGoogle(){throw new Error('Fixture login failure');}
  export const db={};
  const empty={exists:()=>false,val:()=>null,forEach:()=>{}};
  export const fdb={ref:(_,path)=>({path}),query:ref=>ref,orderByChild:()=>({}),limitToLast:()=>({}),get:async()=>empty};
  export const Auth={getState:()=>state,getNick:()=>'',subscribe:fn=>{window.__forms.authSubscriptions++;fn(state);},
    validateNick:()=>({ok:true}),checkNick:async()=>({available:true}),setNick:async()=>{throw new Error('Fixture save failure');},
    resolveNick:async nick=>{if(window.__forms.mode==='resolve-error')throw new Error('Fixture resolve failure');return nick==='alice'?{uid:'alice',nick:'alice'}:null;},
    searchNicks:async nick=>window.__forms.mode==='markup'?[{uid:'evil',nick:'<img src=x onerror="window.__injected=true">'}]:[{uid:'alicia',nick:'alicia'}]
  };export default Auth;
`;
const store=`
  export const Store={subscribe:fn=>{window.__forms.storeSubscriptions++;fn({level:1,xp:0,kaju:100});},
    transferRemaining:()=>({min:10,perTx:5000,hour:100,day:100,month:100}),
    transferKaju:async(...args)=>{window.__forms.transfers.push(args);throw new Error('Fixture transfer failure');}
  };export default Store;
`;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
      if(url.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:auth});
      if(url.pathname==='/js/store.js')return route.fulfill({contentType:'text/javascript',body:store});
      if(url.pathname==='/js/portal.js')return route.fulfill({contentType:'text/javascript',body:''});
      const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404});
      return route.fulfill({path:file});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.evaluate(async()=>{window.__ui=await import('/js/ui.js');window.__ui.initUI();window.__ui.initUI();});
    assert.equal(await page.evaluate(()=>window.__forms.authSubscriptions),1,'UI auth must subscribe once');
    assert.equal(await page.evaluate(()=>window.__forms.storeSubscriptions),1,'UI store must subscribe once');
    await page.evaluate(()=>window.__ui.openKajuModal());
    await page.locator('#kjNick').fill('ali');await page.locator('#kjAmt').fill('10');
    await page.locator('#kajuModal [data-act="send"]').click();
    await page.waitForFunction(()=>document.getElementById('kjMsg').textContent.includes('bulunamadı'));
    assert.equal(await page.evaluate(()=>window.__forms.transfers.length),0,'a unique partial match must not receive a transfer');
    await page.evaluate(()=>window.__forms.mode='resolve-error');
    await page.locator('#kjNick').fill('missing');await page.locator('#kajuModal [data-act="send"]').click();
    await page.waitForFunction(()=>!document.querySelector('#kajuModal [data-act="send"]').disabled);
    assert.match(await page.locator('#kjMsg').textContent(),/tamamlanamadı/,'lookup failure must release the send button');
    await page.evaluate(()=>window.__forms.mode='normal');
    await page.locator('#kjNick').fill('alice');await page.locator('#kajuModal [data-act="send"]').click();
    await page.waitForFunction(()=>window.__forms.transfers.length===1&&!document.querySelector('#kajuModal [data-act="send"]').disabled);
    assert.match(await page.locator('#kjMsg').textContent(),/tamamlanamadı/,'transfer rejection must leave a retryable form');
    await page.evaluate(()=>window.__forms.mode='markup');await page.locator('#kjNick').fill('evil');
    await page.locator('.adm-sug-it').waitFor({state:'visible'});
    assert.equal(await page.locator('#kjSug img').count(),0,'suggestions must treat nicknames as text');
    assert.equal(await page.locator('#kjSug button').count(),1,'suggestions must be keyboard buttons');
    assert.equal(await page.evaluate(()=>window.__injected),undefined);
    await page.locator('#kajuModal [data-act="cancel"]').click();
    await page.evaluate(()=>window.__ui.openNickModal());await page.locator('#nmInput').fill('NewNick');
    await page.waitForFunction(()=>!document.querySelector('#nickModal [data-act="save"]').disabled);
    await page.locator('#nickModal [data-act="save"]').click();
    await page.waitForFunction(()=>!document.querySelector('#nickModal [data-act="save"]').disabled);
    assert.match(await page.locator('#nmMsg').textContent(),/Kaydedilemedi/);
    await page.locator('#nickModal [data-act="cancel"]').click();
    await page.evaluate(async()=>{
      window.__profile=await import('/js/profile.js');window.__profile.renderProfile();
      window.__profile.applyProfileBg('matrix');window.__profile.applyProfileBg('default');
    });
    assert.equal(await page.locator('canvas.matrix-cv').count(),0,'default profile background must remove the prior matrix canvas');
    await page.evaluate(async()=>{
      for(const name of ['hero-portal:/:test','hero-portal:/another-app/:test','sukun-cache-sentinel']) await caches.open(name);
      localStorage.setItem('hero_theme','emerald');localStorage.setItem('other_app_sentinel','keep');
      await new Promise((resolve,reject)=>{const request=indexedDB.open('other-app-fixture',1);request.onsuccess=()=>{request.result.close();resolve();};request.onerror=()=>reject(request.error);});
      document.querySelector('[data-screen="profile"]').classList.add('active');
      document.querySelector('[data-p="settings"]').click();
    });
    await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#stCache').click()]);
    const stored=await page.evaluate(async()=>({keys:await caches.keys(),theme:localStorage.getItem('hero_theme'),other:localStorage.getItem('other_app_sentinel'),dbs:indexedDB.databases?await indexedDB.databases():null}));
    assert.equal(stored.keys.includes('hero-portal:/:test'),false,'cache clear removes only this Hero project cache');
    assert.equal(stored.keys.includes('hero-portal:/another-app/:test'),true,'other Hero project cache is preserved');
    assert.equal(stored.keys.includes('sukun-cache-sentinel'),true,'Sukun cache is preserved');
    assert.equal(stored.theme,'emerald','saved theme survives cache clear');
    assert.equal(stored.other,'keep','other app storage survives cache clear');
    if(stored.dbs)assert.equal(stored.dbs.some(db=>db.name==='other-app-fixture'),true,'other app IndexedDB survives cache clear');
    assert.deepEqual(errors,[],'no unhandled browser error');
    console.log('PASS: idempotent UI subscriptions; exact transfer recipient; recoverable form failures; safe keyboard suggestions; matrix background reset; scoped cache clear preserving theme, other apps and IndexedDB. All account writes mocked.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
