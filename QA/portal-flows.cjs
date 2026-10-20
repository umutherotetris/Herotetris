// Social flow regressions. Every account/read/write is an in-memory fixture.
// Run: PORTAL_CHROMIUM=/tmp/chromium node QA/portal-flows.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:8765';
const authFixture = `
  let state={status:'google',uid:'me',displayName:'Fixture User',isAdmin:false,profile:{nick:'FixtureUser',avatar:'🙂'}};
  const authListeners=new Set();
  const snapshot=value=>({exists:()=>value!==null,val:()=>value,forEach:fn=>Object.entries(value||{}).forEach(([key,v])=>fn({...snapshot(v),key}))});
  const reads={},subscriptions=[],writes=[];
  window.__flow={reads,subscriptions,writes,holdPush:false,failPush:false,pendingPush:null,
    resolveUser:(uid,value)=>{const resolve=reads[uid];delete reads[uid];if(resolve)resolve(snapshot(value));},
    emitAuth:patch=>{state={...state,...patch};authListeners.forEach(fn=>fn(state));},
    emitValue:(path,value)=>subscriptions.filter(sub=>sub.active&&sub.path===path).forEach(sub=>sub.fn(snapshot(value))),
    finishPush:()=>{const resolve=window.__flow.pendingPush;window.__flow.pendingPush=null;if(resolve)resolve({key:'fixture-message'});}
  };
  export const db={};
  export const fdb={
    ref:(_db,p)=>({path:p}),query:(ref)=>ref,orderByChild:()=>({}),limitToLast:()=>({}),
    get:ref=>/^users\\/(a|b)$/.test(ref.path)?new Promise(resolve=>{reads[ref.path.slice(6)]=resolve;}):Promise.resolve(snapshot(null)),
    onValue:(ref,fn)=>{const sub={path:ref.path,active:true,fn};subscriptions.push(sub);queueMicrotask(()=>{if(sub.active)fn(snapshot(null));});return()=>{sub.active=false;};},
    set:(ref,value)=>{writes.push({type:'set',path:ref.path,value});return Promise.resolve();},
    update:(ref,value)=>{writes.push({type:'update',path:ref.path,value});return Promise.resolve();},
    remove:ref=>{writes.push({type:'remove',path:ref.path});return Promise.resolve();},
    push:(ref,value)=>{writes.push({type:'push',path:ref.path,value});if(window.__flow.failPush&&ref.path.startsWith('messages/'))return Promise.reject(new Error('Fixture send failure'));if(window.__flow.holdPush&&ref.path.startsWith('messages/'))return new Promise(resolve=>{window.__flow.pendingPush=resolve;});return Promise.resolve({key:'fixture-message'});},
    onDisconnect:()=>({remove:()=>Promise.resolve()}),serverTimestamp:()=>0
  };
  export const Auth={getState:()=>state,subscribe:fn=>{authListeners.add(fn);fn(state);return()=>authListeners.delete(fn);}};
  export default Auth;
`;
const html=`<!doctype html><html lang="tr"><head><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/css/components.css"></head><body><script type="module">import * as social from '/js/social.js';window.__social=social;social.initSocial();</script></body></html>`;

(async()=>{
  const launch={headless:true,args:['--no-sandbox']};
  if(process.env.PORTAL_CHROMIUM) launch.executablePath=process.env.PORTAL_CHROMIUM;
  const browser=await chromium.launch(launch);
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.dismiss());
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.origin!==base)return route.abort();
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
      if(url.pathname==='/js/auth.js')return route.fulfill({contentType:'text/javascript',body:authFixture});
      const file=path.resolve(root,'.'+url.pathname);
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Missing'});
      await route.fulfill({path:file});
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__social&&!!document.getElementById('gemHubPanel'));
    const open=async(uid,nick)=>{
      await page.evaluate(([uid,nick])=>window.__social.dmOpenThreadExternal(uid,nick),[uid,nick]);
      await page.waitForFunction(uid=>window.__flow.subscriptions.some(s=>s.active&&s.path.includes('/_typing/'+uid)),uid);
    };
    await open('a','Alice');
    await open('b','Bob');
    assert.equal(await page.evaluate(()=>window.__flow.subscriptions.filter(s=>s.active&&/messages\/a_me(?:\/|$)/.test(s.path)).length),0,'switching thread must release all old message/seen/typing listeners');
    await page.evaluate(()=>window.__flow.resolveUser('a',{nick:'Late Alice',avatar:'🙂'}));
    await page.waitForTimeout(30);
    assert.match(await page.locator('#ghpDMTitle').textContent(),/Bob/,'late Alice response must not overwrite Bob title');
    await page.evaluate(()=>window.__flow.resolveUser('b',{nick:'Bob',avatar:'🙂'}));

    const before=await page.evaluate(()=>window.__flow.subscriptions.filter(s=>s.active&&s.path.startsWith('messages/b_me')).length);
    await page.evaluate(()=>window.__flow.emitAuth({displayName:'Renamed Fixture'}));
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>window.__flow.subscriptions.filter(s=>s.active&&s.path.startsWith('messages/b_me')).length),before,'same-account updates must preserve active conversation');
    assert.ok(before>=3,'message, seen, and typing listeners are active');

    await page.evaluate(()=>window.__flow.emitValue('messages/b_me',{
      malicious:{from:'b',fromName:'Bob',fromAvatar:'<img src=x onerror="window.__avatarExecuted=true">',text:'A fixture message',ts:Date.now()}
    }));
    assert.equal(await page.locator('#ghpDMMsgs img').count(),0,'incoming avatar must be rendered as text, not an HTML element');
    assert.match(await page.locator('#ghpDMMsgs').textContent(),/<img src=x/,'malicious avatar text remains literal');
    assert.equal(await page.evaluate(()=>window.__avatarExecuted),undefined,'incoming avatar must not execute an event handler');
    await page.evaluate(()=>window.__flow.emitValue('globalChat',{
      malicious:{uid:'b',name:'Bob',text:'Cosmetic fixture',ts:Date.now(),nickEffect:'neon" onmouseover="window.__cosmeticExecuted=true',nameColor:'red" onclick="window.__cosmeticExecuted=true'}
    }));
    assert.equal(await page.locator('#ghpChatList [onmouseover],#ghpChatList [onclick]').count(),0,'cosmetic fields must not introduce HTML event attributes');
    assert.equal(await page.evaluate(()=>window.__cosmeticExecuted),undefined,'cosmetic fields must not execute markup');

    await page.evaluate(()=>{window.__flow.failPush=true;document.getElementById('ghpDMInput').value='Keep this draft';document.getElementById('ghpDMSend').click();});
    await page.waitForFunction(()=>document.getElementById('ghpDMInput').value==='Keep this draft');
    assert.equal(await page.locator('#ghpDMInput').inputValue(),'Keep this draft','a failed send must restore the active conversation draft');
    await page.evaluate(()=>{window.__flow.failPush=false;document.getElementById('ghpDMInput').value='';});

    await open('a','Alice');
    await page.evaluate(()=>{window.__flow.holdPush=true;document.getElementById('ghpDMInput').value='Message for Alice';document.getElementById('ghpDMSend').click();});
    await page.waitForFunction(()=>!!window.__flow.pendingPush);
    await open('b','Bob');
    await page.evaluate(()=>window.__flow.finishPush());
    await page.waitForFunction(()=>window.__flow.writes.some(w=>w.type==='push'&&w.path.startsWith('userNotifs/')));
    assert.equal(await page.evaluate(()=>window.__flow.writes.filter(w=>w.type==='push'&&w.path.startsWith('userNotifs/')).at(-1).path),'userNotifs/a','in-flight Alice send must notify Alice after switching to Bob');

    await page.evaluate(()=>{document.getElementById('ghpCloseBtn').click();window.__social.openHubTab('ozel');});
    await page.waitForTimeout(350);
    assert.equal(await page.locator('#gemHubPanel').evaluate(el=>el.classList.contains('ghp-open')),true,'old close timer must not hide a reopened hub');
    assert.deepEqual(errors,[],'unexpected browser errors');
    console.log('PASS: old DM listeners released, stale profile read ignored, same-account updates preserve conversation, avatar/cosmetic markup stays inert, failed send restores draft, send recipient remains stable, close/reopen race prevented. Backend: in-memory fixtures.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
