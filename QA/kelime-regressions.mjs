// Real Kelime online module with an in-memory Firebase adapter; no production writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const source = process.env.KELIME_SOURCE_REF
  ? execFileSync('git',['show',`${process.env.KELIME_SOURCE_REF}:js/games/kelime-online.js`],{encoding:'utf8'})
  : fs.readFileSync(new URL('../js/games/kelime-online.js',import.meta.url),'utf8');
let counter=0;
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
async function harness(){
  const data={},listeners=new Map(),disconnects=[],hooks={};let roomNo=0;
  const clone=x=>x===undefined?undefined:structuredClone(x);
  const get=path=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data)??null;
  const set=(path,value)=>{const keys=path.split('/').filter(Boolean);let o=data;for(const k of keys.slice(0,-1))o=o[k]??={};if(value===null)delete o[keys.at(-1)];else o[keys.at(-1)]=clone(value);};
  const snap=v=>({val:()=>clone(v),exists:()=>v!==null});
  const emit=path=>{for(const [p,cbs]of listeners){if(path===p||path.startsWith(p+'/'))for(const cb of cbs)cb(snap(get(p)));}};
  const fdb={ref:(_db,path)=>path,push:()=>({key:`room${++roomNo}`}),
    set:async(p,v)=>{if(hooks.set)await hooks.set(p,v);set(p,v);emit(p);},
    update:async(p,patch)=>{if(hooks.update)await hooks.update(p,patch);for(const[k,v]of Object.entries(patch))set(p+'/'+k,v);emit(p);},
    remove:async(p)=>{if(hooks.remove)await hooks.remove(p);set(p,null);emit(p);},
    get:async p=>snap(get(p)),
    runTransaction:async(p,fn)=>{if(hooks.transaction)await hooks.transaction(p);const v=fn(clone(get(p)));if(v===undefined)return {committed:false,snapshot:snap(get(p))};set(p,v);emit(p);return {committed:true,snapshot:snap(get(p))};},
    onValue:(p,cb)=>{if(!listeners.has(p))listeners.set(p,new Set());listeners.get(p).add(cb);queueMicrotask(()=>{if(listeners.get(p)?.has(cb))cb(snap(get(p)));});return()=>listeners.get(p)?.delete(cb);},
    onDisconnect:p=>({set:()=>{disconnects.push(['set',p]);return Promise.resolve();},remove:()=>{disconnects.push(['remove',p]);return Promise.resolve();},cancel:()=>{disconnects.push(['cancel',p]);return Promise.resolve();}})
  };
  globalThis.__kelimeRegressionDeps={Auth:{getState:()=>({uid:'me',displayName:'Me'})},db:{},fdb};
  const rewritten=source.replace("import { Auth, db, fdb } from '../auth.js';","const { Auth, db, fdb } = globalThis.__kelimeRegressionDeps;");
  const mod=await import('data:text/javascript;base64,'+Buffer.from(rewritten+`\n// harness ${counter++}`).toString('base64'));
  delete globalThis.__kelimeRegressionDeps;
  return {mod,data,get,set,hooks,listeners,disconnects};
}
function room(extra={}){return {seed:7,players:{A:'me',B:'opponent'},names:{A:'Me',B:'Other'},presence:{},status:'active',mode:'async',turnHours:12,turn:'A',deadline:Date.now()-1000,...extra};}
{
  const h=await harness();await h.mod.findMatch({}, {lang:'en'});
  assert.equal(h.get('kelimeQueue/waiting_en').uid,'me');
  await h.mod.cancelSearch();
  assert.equal(h.get('kelimeQueue/waiting_en'),null,'cancel clears the actual language queue');
  assert.equal(h.get('kelimeGames/room1'),null,'cancel removes the waiting room');
  assert.ok(h.disconnects.some(([op,p])=>op==='cancel'&&p==='kelimeQueue/waiting_en'));
}
{
  const h=await harness();await h.mod.findMatch({}, {mode:'async',turnHours:12,lang:'tr'});
  assert.equal(h.mod.getSession().turnHours,12,'new host retains per-turn deadline duration');
  assert.equal(h.mod.getSession().queuePath,'kelimeQueue/async12_tr');
  const before=Date.now();await h.mod.pushMove({turn:'B'});
  assert.ok(h.get('kelimeGames/room1/deadline')>=before+12*3600000,'successful move renews opponent deadline');
  const deadline=h.get('kelimeGames/room1/deadline');await h.mod.pushMove({drawOffer:'A'});
  assert.equal(h.get('kelimeGames/room1/deadline'),deadline,'draw offer does not buy additional turn time');
  await h.mod.cancelSearch();assert.equal(h.get('kelimeQueue/async12_tr'),null);
}
{
  const h=await harness();h.set('kelimeGames/resumed',room());await h.mod.resumeGame('resumed',{});
  assert.equal(h.mod.getSession().turnHours,12,'resumed session retains turn duration');
  const before=Date.now();await h.mod.pushMove({turn:'B'});assert.ok(h.get('kelimeGames/resumed/deadline')>=before+12*3600000);
}
{
  const h=await harness();h.set('kelimeGames/not-mine',room({players:{A:'x',B:'y'},turn:'A'}));
  let resumed=false,error='';await h.mod.resumeGame('not-mine',{onResumed:()=>resumed=true,onError:m=>error=m});
  assert.equal(resumed,false,'outsider cannot resume as B');assert.match(error,/oyuncusu/);assert.equal(h.mod.getSession(),null);
  let done=false;await h.mod.claimTimeout('not-mine',{onDone:()=>done=true,onError:m=>error=m});
  assert.equal(done,false,'outsider cannot claim a timeout');assert.equal(h.get('kelimeGames/not-mine/status'),'active');
}
{
  const h=await harness();h.set('kelimeGames/race',room({turn:'B'}));
  h.hooks.transaction=async p=>h.set(p+'/deadline',Date.now()+100000);
  let done=false,error='';await h.mod.claimTimeout('race',{onDone:()=>done=true,onError:m=>error=m});
  assert.equal(done,false,'updated deadline is checked atomically');assert.equal(h.get('kelimeGames/race/status'),'active');assert.match(error,/henüz/);
  delete h.hooks.transaction;h.set('kelimeGames/race/deadline',Date.now()-1);
  await h.mod.claimTimeout('race',{onDone:()=>done=true});assert.equal(done,true);assert.equal(h.get('kelimeGames/race/winnerByTimeout'),'A');
}
{
  const h=await harness();h.set('kelimeGames/old',room());h.set('kelimeGames/new',room());await h.mod.resumeGame('old',{});
  const gate=deferred();let blocked=false;h.hooks.remove=async()=>{if(!blocked){blocked=true;await gate.promise;}};
  const ending=h.mod.markGameOver();await Promise.resolve();await h.mod.resumeGame('new',{});gate.resolve();await ending;
  assert.equal(h.get('kelimeGames/old/status'),'over');assert.equal(h.get('kelimeGames/new/status'),'active','late old cleanup cannot end new room');
  assert.equal(h.mod.getSession().gameId,'new');
}
{
  const h=await harness();h.set('kelimeGames/old',room({mode:'live'}));h.set('kelimeGames/new',room());await h.mod.resumeGame('old',{});
  const gate=deferred();h.hooks.update=async(p,patch)=>{if(p==='kelimeGames/old'&&patch['presence/A']===false)await gate.promise;};
  const leaving=h.mod.leaveRoom();await h.mod.resumeGame('new',{});gate.resolve();await leaving;
  assert.equal(h.mod.getSession().gameId,'new','late leave completion cannot clear new session');
}
{
  const h=await harness();h.set('kelimeGames/old',room());h.set('kelimeGames/new',room());await h.mod.resumeGame('old',{});
  let calls=0;h.mod.subscribeRoom(()=>calls++);await Promise.resolve();const callback=[...h.listeners.get('kelimeGames/old')][0];calls=0;
  await h.mod.resumeGame('new',{});callback({val:()=>room()});assert.equal(calls,0,'old room callback cannot update replacement game');
}
{
  const h=await harness(),gate=deferred();h.hooks.set=async p=>{if(p==='kelimeGames/room1')await gate.promise;};
  let matched=false;const searching=h.mod.findMatch({onMatched:()=>matched=true},{lang:'tr'});
  await Promise.resolve();await Promise.resolve();await h.mod.cancelSearch();gate.resolve();await searching;
  assert.equal(h.mod.getSession(),null,'cancel during room creation cannot revive the search');
  assert.equal(h.get('kelimeGames/room1'),null);assert.equal(h.get('kelimeQueue/waiting_tr'),null);assert.equal(matched,false);
}
console.log('PASS Kelime online regressions: language/async queue cleanup, deadline renewals, draw time, membership, atomic timeout, late cleanup and stale listeners.');
