// Exercises actual Store score/XP functions with acknowledged, rejected and
// deferred Firebase transactions. In-memory accounts only; no network writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
let source=fs.readFileSync(new URL('../js/store.js',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'')
 .replace('await import(`${BASE}/firebase-database.js`)','__sdk')
 .replace('await import(`${BASE}/firebase-app.js`)','__app')
 .replace(/import\('\.\/([^']+)'\)/g,(_,file)=>`Promise.resolve(__modules[${JSON.stringify(file)}] || {})`)
 .replace(/^export default Store;?$/m,'').replace(/^export /gm,'');
source+='\nthis.S=Store;this.P=player;this.hydrateStore=hydrate;';
const clone=v=>v==null?null:structuredClone(v);
const snap=v=>({val:()=>clone(v),exists:()=>v!=null,forEach:fn=>Object.entries(v||{}).forEach(([key,x])=>fn({...snap(x),key}))});
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({admin=false,alice=1000,bob=100,profileAlice,profileBob,initialData,crypto=webcrypto}={}){
 const data=initialData?clone(initialData):{users:{alice:{kaju:alice,...clone(profileAlice)},bob:{kaju:bob,...clone(profileBob)}}},storage=new Map(),writes=[],events=[],notices=[],listeners=[];
 let state={uid:'alice',status:'google',displayName:'Alice',isAdmin:admin,profile:clone(data.users.alice)},queue=Promise.resolve(),key=0;
 const hooks={beforeTx:null,afterTx:null,beforeSet:null,afterSet:null,beforeGet:null,autoEvents:false};
 const read=path=>path.split('/').reduce((v,k)=>v?.[k],data)??null;
 const emit=path=>{if(!hooks.autoEvents)return;for(const l of listeners)if(l.active&&(path===l.path||path.startsWith(l.path+'/')||l.path.startsWith(path+'/')))queueMicrotask(()=>{if(l.active)l.fn(snap(read(l.path)));});};
 const write=(path,value)=>{const p=path.split('/');let at=data;for(const k of p.slice(0,-1))at=at[k]??={};if(value===null)delete at[p.at(-1)];else at[p.at(-1)]=clone(value);writes.push({path,value:clone(value)});emit(path);};
 const sdk={getDatabase:()=>({}),ref:(_,path)=>({path}),get:async r=>{if(hooks.beforeGet)await hooks.beforeGet(r.path);return snap(read(r.path));},
  set:async(r,value)=>{if(hooks.beforeSet)await hooks.beforeSet(r.path,value);write(r.path,value);if(hooks.afterSet)await hooks.afterSet(r.path,value);},
  update:async(r,values)=>{for(const[k,v]of Object.entries(values))await sdk.set({path:r.path+'/'+k},v);},
  push:(r,value)=>{const p={path:r.path+'/key'+(++key),key:'key'+key};return value===undefined?p:sdk.set(p,value).then(()=>p);},
  onValue:(r,fn,onError)=>{const l={path:r.path,fn,onError,active:true};listeners.push(l);return()=>l.active=false;},
  runTransaction:(r,update,options)=>{
   const run=queue.then(async()=>{if(hooks.beforeTx)await hooks.beforeTx(r.path,options);const next=update(clone(read(r.path)));if(next===undefined)return{committed:false,snapshot:snap(read(r.path))};write(r.path,next);return{committed:true,snapshot:snap(next)};});
   queue=run.catch(()=>{});
   return run.then(async result=>{if(hooks.afterTx)await hooks.afterTx(r.path,result);return result;});
  }};
 const subscribers=new Set();
 const context=vm.createContext({console:{warn(){},error(...a){throw new Error(a.join(' '));}},Date,Math,Number,Object,Array,Map,Set,Promise,JSON,TextEncoder,Uint8Array,globalThis:{crypto},
  firebaseConfig:{},FIREBASE_SDK:'fixture',__sdk:sdk,__app:{getApps:()=>[{}],getApp:()=>({}),initializeApp:()=>({})},
  Auth:{getState:()=>state,subscribe:fn=>{subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);}},
  __modules:{'notify.js':{notifyKajuGift:async(...a)=>{notices.push(a);return true;}},'daily.js':{kajuCoinSound(){}},'economy.js':{progressQuest(){}},'tournament.js':{addTournamentPoints(){}}},
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  window:{addEventListener(){},dispatchEvent:e=>events.push(e),Hero:{}},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},setTimeout,clearTimeout
 });
 vm.runInContext(source,context);
 return {context,S:context.S,P:context.P,data,storage,writes,events,notices,listeners,hooks,sdk,read,write,
  auth:next=>{state={...state,...next};for(const fn of subscribers)fn(state);},
  switchTo:(uid,admin=false)=>{state={uid,status:'google',isAdmin:admin,displayName:uid,profile:clone(data.users[uid]||{})};for(const fn of subscribers)fn(state);}};
}
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS',name);}
const isBestPath=path=>path==='users/alice';
const initial={level:1,xp:{level:1,xp:10,totalXP:10},bestScores:{tetris:100}};

await test('score rejects unsafe, fractional and invalid path inputs without writes',async()=>{
 const f=fixture({profileAlice:initial});await settle();const start=f.writes.length;
 for(const score of [NaN,Infinity,-1,0,1.5,{},[],true,Number.MAX_SAFE_INTEGER+1])assert.equal(await f.S.addScore('tetris',score),false,String(score));
 for(const game of ['',null,{},'../bad','tetris/bob','bad.key'])assert.equal(await f.S.addScore(game,500),false);
 assert.equal(f.writes.length,start);assert.equal(f.P.best.tetris,100);
});
await test('score cannot write without the captured authenticated account',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.switchTo(null);const before=f.writes.length;
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.writes.length,before);
});
await test('new score is acknowledged in profile and captured leaderboard identity',async()=>{
 const f=fixture({profileAlice:initial});await settle();assert.equal(await f.S.addScore('tetris',500),true);
 assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.read('gameLB/tetris/alice').score,500);assert.equal(f.read('gameLB/tetris/alice').uid,'alice');assert.equal(f.read('gameLB/tetris/alice').name,'Alice');assert.equal(f.P.best.tetris,500);
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(await f.S.addScore('tetris',499),false);
});
await test('stale lower UI best cannot overwrite a higher authoritative profile record',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.data.users.alice.bestScores.tetris=900;assert.equal(f.P.best.tetris,100);
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.data.users.alice.bestScores.tetris,900);assert.equal(f.P.best.tetris,900);
});
await test('stale higher UI best cannot suppress a legitimate authoritative record',async()=>{
 const f=fixture({profileAlice:{...initial,bestScores:{tetris:900}}});await settle();f.data.users.alice.bestScores.tetris=100;
 assert.equal(await f.S.addScore('tetris',500),true);assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.read('gameLB/tetris/alice').score,500);
});
await test('rejected personal record does not claim success or optimistically mutate best',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.beforeTx=path=>{if(isBestPath(path))throw new Error('PERMISSION_DENIED');};
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.data.users.alice.bestScores.tetris,100);assert.equal(f.P.best.tetris,100);assert.equal(f.read('gameLB/tetris/alice'),null);
});
await test('failed leaderboard publication returns false and same-score retry repairs only the mirror',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.beforeTx=path=>{if(path==='gameLB/tetris/alice')throw new Error('PERMISSION_DENIED');};
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.read('gameLB/tetris/alice'),null);
 f.hooks.beforeTx=null;assert.equal(await f.S.addScore('tetris',500),true);assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.read('gameLB/tetris/alice').score,500);assert.equal(await f.S.addScore('tetris',500),false);
});
await test('lost personal-record acknowledgement resolves by confirmed read without lowering or duplicating',async()=>{
 const f=fixture({profileAlice:initial});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&isBestPath(path)&&result.committed){once=false;throw new Error('ack lost');}};
 assert.equal(await f.S.addScore('tetris',500),true);assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.read('gameLB/tetris/alice').score,500);assert.equal(await f.S.addScore('tetris',500),false);
});
await test('lost leaderboard acknowledgement resolves only from a successful confirming read',async()=>{
 const f=fixture({profileAlice:initial});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&path==='gameLB/tetris/alice'&&result.committed){once=false;throw new Error('ack lost');}};
 assert.equal(await f.S.addScore('tetris',500),true);assert.equal(f.read('gameLB/tetris/alice').score,500);
});
await test('uncertain record write plus unavailable confirmation returns false and remains safely retryable',async()=>{
 const f=fixture({profileAlice:initial});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&isBestPath(path)&&result.committed){once=false;throw new Error('ack lost');}};
 f.hooks.beforeGet=path=>{if(isBestPath(path))throw new Error('Read failed');};
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.data.users.alice.bestScores.tetris,500);
 f.hooks.beforeGet=null;assert.equal(await f.S.addScore('tetris',500),true);assert.equal(f.read('gameLB/tetris/alice').score,500);
});
await test('account switch after committed personal best cannot publish under the next account',async()=>{
 const f=fixture({profileAlice:initial,profileBob:{bestScores:{tetris:20}}});await settle();let release,started;const written=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>isBestPath(path)&&result.committed?new Promise(resolve=>{release=resolve;started();}):undefined;
 const pending=f.S.addScore('tetris',500);await written;f.switchTo('bob');release();assert.equal(await pending,false);
 assert.equal(f.data.users.alice.bestScores.tetris,500);assert.equal(f.data.users.bob.bestScores.tetris,20);assert.equal(f.P.best.tetris,20);assert.equal(f.read('gameLB/tetris/bob'),null);assert.equal(f.read('gameLB/tetris/alice'),null);
});
await test('account loss before transaction callback aborts every score write',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.beforeTx=path=>{if(isBestPath(path))f.switchTo('bob');};
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(f.data.users.alice.bestScores.tetris,100);assert.equal(f.read('gameLB/tetris/bob'),null);
});
await test('older delayed personal-record completion cannot roll leaderboard or local best backwards',async()=>{
 const f=fixture({profileAlice:{...initial,bestScores:{tetris:10}}});await settle();let release,started,once=true;const written=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>{if(once&&isBestPath(path)&&result.committed){once=false;return new Promise(resolve=>{release=resolve;started();});}};
 const older=f.S.addScore('tetris',100);await written;assert.equal(await f.S.addScore('tetris',200),true);release();await older;
 assert.equal(f.data.users.alice.bestScores.tetris,200);assert.equal(f.read('gameLB/tetris/alice').score,200);assert.equal(f.P.best.tetris,200);
});
await test('simultaneous scores use an authoritative monotonic maximum',async()=>{
 const f=fixture({profileAlice:initial});await settle();await Promise.all([f.S.addScore('tetris',700),f.S.addScore('tetris',600),f.S.addScore('tetris',800)]);
 assert.equal(f.data.users.alice.bestScores.tetris,800);assert.equal(f.read('gameLB/tetris/alice').score,800);assert.equal(f.P.best.tetris,800);
});
await test('live own-profile updates reflect confirmed server best and reject old account callbacks',async()=>{
 const f=fixture({profileAlice:initial,profileBob:{bestScores:{tetris:20}}});await settle();f.hooks.autoEvents=true;
 f.write('users/alice/bestScores/tetris',900);await settle();assert.equal(f.P.best.tetris,900);const old=f.listeners.find(l=>l.active&&l.path==='users/alice');
 f.switchTo('bob');await settle();old.fn(snap({kaju:100,bestScores:{tetris:9999}}));assert.equal(f.P.best.tetris,20);
});
await test('awardXP rejects invalid amounts and expected-owner mismatches',async()=>{
 const f=fixture({profileAlice:initial});await settle();assert.equal(typeof f.S.awardXP,'function');
 for(const n of [NaN,Infinity,-1,0,1.5,{},[],true,Number.MAX_SAFE_INTEGER+1]){const result=await f.S.awardXP(n,'alice');assert.equal(result.ok,false,String(n));assert.equal(result.amount,0);}
 assert.equal((await f.S.awardXP(50,'bob')).ok,false);assert.equal(f.data.users.alice.xp.totalXP,10);
});
await test('failed XP write returns zero confirmed award and leaves local/server XP unchanged',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.beforeTx=path=>{if(path==='users/alice')throw new Error('PERMISSION_DENIED');};
 const result=await f.S.awardXP(50,'alice');assert.equal(result.ok,false);assert.equal(result.amount,0);assert.equal(f.P.xp,10);assert.equal(f.P.totalXP,10);assert.equal(f.data.users.alice.xp.totalXP,10);
});
await test('XP uses authoritative profile rather than stale local XP or level',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.data.users.alice.level=2;f.data.users.alice.xp={level:2,xp:80,totalXP:580};
 const result=await f.S.awardXP(50,'alice');assert.equal(result.ok,true);assert.equal(result.amount,50);assert.equal(result.level,2);assert.equal(result.leveled,false);assert.equal(f.data.users.alice.xp.xp,130);assert.equal(f.data.users.alice.xp.totalXP,630);assert.equal(f.P.xp,130);assert.equal(f.P.level,2);
});
await test('concurrent XP awards preserve every increment and level crossing',async()=>{
 const f=fixture({profileAlice:{level:1,xp:{level:1,xp:450,totalXP:450}}});await settle();
 const results=await Promise.all([f.S.awardXP(40,'alice'),f.S.awardXP(60,'alice')]);assert.equal(results.every(r=>r.ok),true);assert.equal(results.reduce((n,r)=>n+r.amount,0),100);assert.equal(f.data.users.alice.xp.totalXP,550);assert.equal(f.data.users.alice.xp.xp,50);assert.equal(f.data.users.alice.level,2);assert.equal(f.P.totalXP,550);
});
await test('XP applies existing Kozmo and purchased boosts once and reports actual credited amount',async()=>{
 const f=fixture({profileAlice:{level:1,xp:{level:1,xp:450,totalXP:450},boosts:{xp:{type:'xp',until:Date.now()+100000,mult:2}}}});await settle();
 f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',id:'owned',bonus:{xp:0.1}}));
 const result=await f.S.awardXP(100,'alice');assert.equal(result.ok,true);assert.equal(result.amount,220);assert.equal(result.leveled,true);assert.equal(result.level,2);assert.equal(f.data.users.alice.xp.xp,170);assert.equal(f.data.users.alice.xp.totalXP,670);
});
await test('XP callback captures owner and aborts if account changes before commit',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.beforeTx=path=>{if(path==='users/alice')f.switchTo('bob');};
 const result=await f.S.awardXP(50,'alice');assert.equal(result.ok,false);assert.equal(result.amount,0);assert.equal(f.data.users.alice.xp.totalXP,10);assert.equal(f.data.users.bob.xp,undefined);
});
await test('confirmed old-account XP cannot mutate the next account local state',async()=>{
 const f=fixture({profileAlice:initial,profileBob:{level:1,xp:{level:1,xp:5,totalXP:5}}});await settle();let release,started;const written=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>path==='users/alice'&&result.committed?new Promise(resolve=>{release=resolve;started();}):undefined;
 const pending=f.S.awardXP(50,'alice');await written;f.switchTo('bob');release();const result=await pending;
 assert.equal(result.ok,false);assert.equal(result.amount,0);assert.equal(f.data.users.alice.xp.totalXP,60);assert.equal(f.data.users.bob.xp.totalXP,5);assert.equal(f.P.totalXP,5);
});
await test('legacy addXP returns a leveled boolean while awardXP reports confirmed amount',async()=>{
 const f=fixture({profileAlice:{level:1,xp:{level:1,xp:450,totalXP:450}}});await settle();
 assert.equal(await f.S.addXP(60),true);assert.equal(await f.S.addXP(10),false);assert.equal(f.data.users.alice.xp.totalXP,520);
 f.hooks.beforeTx=path=>{if(path==='users/alice')throw new Error('PERMISSION_DENIED');};assert.equal(await f.S.addXP(500),false);assert.equal(f.data.users.alice.xp.totalXP,520);
});
await test('lost XP acknowledgement recovers original confirmed receipt and stable replay never credits twice',async()=>{
 const f=fixture({profileAlice:initial});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&path==='users/alice'&&result.committed){once=false;throw new Error('ack lost');}};
 const first=await f.S.awardXP(50,'alice','xp_ack');assert.equal(first.ok,true);assert.equal(first.amount,50);assert.equal(f.data.users.alice.xp.totalXP,60);
 const duplicate=await f.S.awardXP(50,'alice','xp_ack');assert.equal(duplicate.ok,true);assert.equal(duplicate.amount,50);assert.equal(duplicate.alreadyApplied,true);assert.equal(f.data.users.alice.xp.totalXP,60);
});
await test('unknown XP acknowledgement remains recoverable by the same operation receipt',async()=>{
 const f=fixture({profileAlice:initial});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&path==='users/alice'&&result.committed){once=false;throw new Error('ack lost');}};
 f.hooks.beforeGet=path=>{if(path==='users/alice')throw new Error('Read failed');};
 const first=await f.S.awardXP(50,'alice','xp_unknown');assert.equal(first.ok,false);assert.equal(first.amount,0);assert.equal(f.data.users.alice.xp.totalXP,60);
 f.hooks.beforeGet=null;const retry=await f.S.awardXP(50,'alice','xp_unknown');assert.equal(retry.ok,true);assert.equal(retry.amount,50);assert.equal(retry.alreadyApplied,true);assert.equal(f.data.users.alice.xp.totalXP,60);
});
await test('simultaneous XP retries of the same operation credit exactly once',async()=>{
 const f=fixture({profileAlice:initial});await settle();const results=await Promise.all([f.S.awardXP(50,'alice','xp_once'),f.S.awardXP(50,'alice','xp_once')]);
 assert.equal(results.every(r=>r.ok),true);assert.equal(results.filter(r=>r.alreadyApplied).length,1);assert.equal(f.data.users.alice.xp.totalXP,60);
});
await test('older acknowledged XP snapshot cannot roll back a newer confirmed cache revision',async()=>{
 const f=fixture({profileAlice:initial});await settle();let release,started,once=true;const written=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>{if(once&&path==='users/alice'&&result.committed){once=false;return new Promise(resolve=>{release=resolve;started();});}};
 const first=f.S.awardXP(40,'alice');await written;const second=await f.S.awardXP(60,'alice');assert.equal(second.ok,true);release();assert.equal((await first).ok,true);
 assert.equal(f.data.users.alice.xp.totalXP,110);assert.equal(f.P.totalXP,110);assert.equal(f.P.xp,110);
});
await test('match counters, opponent result and history persist together in one own-profile transaction',async()=>{
 const f=fixture();await settle();const before=f.writes.length;
 assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob'),true);const stats=f.data.users.alice.stats;
 assert.equal(stats.totalW,1);assert.equal(stats.totalL||0,0);assert.equal(stats.games.chess.w,1);assert.equal(f.data.users.alice.h2h.bob.w,1);
 const history=await f.S.getMatchHistory(20);assert.equal(history.length,1);assert.equal(history[0].game,'chess');assert.equal(history[0].result,'win');assert.equal(f.P.stats.totalW,1);
 assert.equal(f.writes.slice(before).filter(w=>w.path==='users/alice').length,1);assert.equal(f.writes.slice(before).some(w=>w.path.startsWith('users/alice/stats')||w.path.startsWith('users/alice/h2h')||w.path.startsWith('users/alice/matchHistory')),false);
});
await test('simultaneous match win and loss conserve authoritative counters and both history entries',async()=>{
 const f=fixture();await settle();const results=await Promise.all([f.S.recordMatchResult('chess','win','bob','Bob'),f.S.recordMatchResult('chess','loss','bob','Bob')]);
 assert.equal(results.every(Boolean),true);const stats=f.data.users.alice.stats;assert.equal(stats.totalW,1);assert.equal(stats.totalL,1);assert.equal(stats.games.chess.w,1);assert.equal(stats.games.chess.l,1);
 assert.equal(f.data.users.alice.h2h.bob.w,1);assert.equal(f.data.users.alice.h2h.bob.l,1);assert.equal((await f.S.getMatchHistory(20)).length,2);assert.equal(f.P.stats.totalW,1);assert.equal(f.P.stats.totalL,1);
});
await test('rejected match transaction cannot leave optimistic statistics or history behind',async()=>{
 const f=fixture();await settle();f.hooks.beforeTx=path=>{if(path==='users/alice')throw new Error('PERMISSION_DENIED');};
 assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob'),false);assert.equal(f.data.users.alice.stats,undefined);assert.equal(f.data.users.alice.h2h,undefined);assert.equal(f.data.users.alice.matchHistory,undefined);assert.equal(f.P.stats.totalW,0);assert.equal((await f.S.getMatchHistory(20)).length,0);
});
await test('account change after a committed match cannot mutate the next account statistics or publish as it',async()=>{
 const f=fixture();await settle();let release,started;const written=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>path==='users/alice'&&result.committed?new Promise(resolve=>{release=resolve;started();}):undefined;
 const pending=f.S.recordMatchResult('chess','win','bob','Bob');await written;f.switchTo('bob');release();assert.equal(await pending,false);
 assert.equal(f.data.users.alice.stats.totalW,1);assert.equal(f.data.users.bob.stats,undefined);assert.equal(f.data.users.bob.matchHistory,undefined);assert.equal(f.P.stats.totalW,0);assert.equal(f.writes.some(w=>w.path==='users/bob'||w.path.startsWith('users/bob/')),false);
});
await test('match history is bounded to the latest twenty matches while lifetime counters remain complete',async()=>{
 const f=fixture();await settle();for(let n=0;n<25;n++)assert.equal(await f.S.recordMatchResult('chess',n%2?'loss':'win','bob','Bob'),true);
 assert.equal(Object.keys(f.data.users.alice.matchHistory).length,20);assert.equal((await f.S.getMatchHistory(100)).length,20);assert.equal(f.data.users.alice.stats.totalW,13);assert.equal(f.data.users.alice.stats.totalL,12);
});
await test('stable match ID retries acknowledge one result without duplicating counters or history',async()=>{
 const f=fixture();await settle();assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob','stable_match'),true);
 assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob','stable_match'),true);assert.equal(f.data.users.alice.stats.totalW,1);assert.equal(f.data.users.alice.h2h.bob.w,1);assert.equal((await f.S.getMatchHistory()).length,1);
 assert.equal(await f.S.recordMatchResult('chess','loss','bob','Bob','stable_match'),false);assert.equal(f.data.users.alice.stats.totalW,1);assert.equal(f.data.users.alice.stats.totalL,0);
});
await test('lost match acknowledgement recovers the same durable result without counting it twice',async()=>{
 const f=fixture();await settle();let once=true;f.hooks.afterTx=(path,result)=>{if(once&&path==='users/alice'&&result.committed){once=false;throw new Error('ack lost');}};
 assert.equal(await f.S.recordMatchResult('chess','draw','bob','Bob','match_ack'),true);assert.equal(await f.S.recordMatchResult('chess','draw','bob','Bob','match_ack'),true);assert.equal(f.data.users.alice.stats.totalD,1);assert.equal((await f.S.getMatchHistory()).length,1);
});
await test('unknown match acknowledgement returns false until the same stable result can be confirmed',async()=>{
 const f=fixture();await settle();let once=true;f.hooks.afterTx=(path,result)=>{if(once&&path==='users/alice'&&result.committed){once=false;throw new Error('ack lost');}};
 f.hooks.beforeGet=path=>{if(path==='users/alice')throw new Error('Read failed');};assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob','match_unknown'),false);assert.equal(f.data.users.alice.stats.totalW,1);
 f.hooks.beforeGet=null;assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob','match_unknown'),true);assert.equal(f.data.users.alice.stats.totalW,1);assert.equal((await f.S.getMatchHistory()).length,1);
});
await test('deferred match-history read cannot reveal a previous account history after switching accounts',async()=>{
 const f=fixture();await settle();await f.S.recordMatchResult('chess','win','bob','Bob','private_match');let release,started;const reading=new Promise(resolve=>started=resolve);
 f.hooks.beforeGet=path=>path==='users/alice/matchHistory'?new Promise(resolve=>{release=resolve;started();}):undefined;
 const history=f.S.getMatchHistory();await reading;f.switchTo('bob');release();assert.equal((await history).length,0);
});
await test('corrupt match counters reject the whole result without creating history or replacement totals',async()=>{
 for(const bad of [-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  const f=fixture({profileAlice:{stats:{games:{chess:{w:0,l:0,d:0}},totalW:bad,totalL:0,totalD:0,streak:0,bestStreak:0}}});await settle();
  assert.equal(await f.S.recordMatchResult('chess','win','bob','Bob'),false);assert.equal(f.data.users.alice.stats.totalW,bad);assert.equal(f.data.users.alice.matchHistory,undefined);
 }
});
await test('XP revision cache resets when the same owner logs out and back in to a newer authoritative profile',async()=>{
 const f=fixture({profileAlice:initial});await settle();await f.S.awardXP(50,'alice');await f.S.awardXP(50,'alice');assert.equal(f.P.totalXP,110);
 f.switchTo(null);f.data.users.alice={kaju:100,level:1,xp:{level:1,xp:5,totalXP:5},heroXPRevision:0};f.switchTo('alice');await settle();
 const result=await f.S.awardXP(10,'alice');assert.equal(result.ok,true);assert.equal(f.data.users.alice.xp.totalXP,15);assert.equal(f.P.totalXP,15);
});
await test('rejected item use returns false without an optimistic inventory debit',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();f.hooks.beforeTx=path=>{if(path==='users/alice')throw new Error('PERMISSION_DENIED');};
 assert.equal(await f.S.useItem('item_hint'),false);assert.equal(f.P.inventory.item_hint,2);assert.equal(f.data.users.alice.inventory.item_hint,2);
});
await test('item use reads authoritative inventory and concurrent use cannot consume one item twice',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:0}}});await settle();f.data.users.alice.inventory.item_hint=1;
 const results=await Promise.all([f.S.useItem('item_hint'),f.S.useItem('item_hint')]);assert.equal(results.filter(Boolean).length,1);assert.equal(f.data.users.alice.inventory.item_hint,undefined);assert.equal(f.P.inventory.item_hint,undefined);
});
await test('item use rejects invalid IDs and switched expected owner',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();
 for(const id of ['bad/path','bad.key','',null,{}])assert.equal(await f.S.useItem(id),false);
 assert.equal(await f.S.useItem('item_hint','bob'),false);assert.equal(f.data.users.alice.inventory.item_hint,2);
});
await test('confirmed old-account item debit cannot update the next account inventory',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}},profileBob:{...initial,inventory:{item_hint:8}}});await settle();let release,started;const pending=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,r)=>path==='users/alice'&&r.committed?new Promise(resolve=>{release=resolve;started();}):undefined;
 const result=f.S.useItem('item_hint');await pending;f.switchTo('bob');release();assert.equal(await result,false);assert.equal(f.P.inventory.item_hint,8);assert.equal(f.data.users.alice.inventory.item_hint,1);
});
await test('lost item-use acknowledgement recovers the same receipt and stable retries do not consume again',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();let once=true;
 f.hooks.afterTx=(path,r)=>{if(once&&path==='users/alice'&&r.committed){once=false;throw new Error('lost acknowledgement');}};
 assert.equal(await f.S.useItem('item_hint','alice','hint_once'),true);assert.equal(await f.S.useItem('item_hint','alice','hint_once'),true);assert.equal(f.data.users.alice.inventory.item_hint,1);
});
await test('unknown item-use acknowledgement stays false until the same operation is confirmed',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();let once=true;
 f.hooks.afterTx=(path,r)=>{if(once&&path==='users/alice'&&r.committed){once=false;throw new Error('lost acknowledgement');}};
 f.hooks.beforeGet=path=>{if(path==='users/alice')throw new Error('offline');};
 assert.equal(await f.S.useItem('item_hint','alice','hint_unknown'),false);assert.equal(f.data.users.alice.inventory.item_hint,1);
 f.hooks.beforeGet=null;assert.equal(await f.S.useItem('item_hint','alice','hint_unknown'),true);assert.equal(f.data.users.alice.inventory.item_hint,1);
});
await test('older item-use completion cannot restore a newer consumed item in local inventory',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();let release,started,once=true;const pending=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,r)=>{if(once&&path==='users/alice'&&r.committed){once=false;return new Promise(resolve=>{release=resolve;started();});}};
 const first=f.S.useItem('item_hint');await pending;assert.equal(await f.S.useItem('item_hint'),true);release();assert.equal(await first,true);assert.equal(f.P.inventory.item_hint,undefined);
});
await test('deleted self profile cannot be rebuilt by wallet, XP, score, match or item transactions',async()=>{
 const f=fixture({profileAlice:{...initial,inventory:{item_hint:2}}});await settle();f.data.users.alice.deleted=true;const before=clone(f.data.users.alice);
 assert.equal(await f.S.addKaju(10,'tetris'),0);assert.equal(await f.S.spendKaju(10),false);assert.equal((await f.S.awardXP(10)).ok,false);
 assert.equal(await f.S.addScore('tetris',500),false);assert.equal(await f.S.useItem('item_hint'),false);assert.equal(await f.S.recordMatchResult('chess','win'),false);
 assert.equal((await f.S.claimKajuOnce('deleted_daily',10,'daily','Daily','alice')).claimed,false);
 assert.equal((await f.S.claimWheelReward(new Date().toISOString().slice(0,10),{type:'kaju',amount:30},'alice')).claimed,false);
 assert.deepEqual(f.data.users.alice,before);
});
await test('deleted recipients and a concurrent deletion reject admin credit without recreating funds',async()=>{
 const f=fixture({admin:true,profileAlice:initial,profileBob:{deleted:true}});await settle();assert.equal((await f.S.adminAdjustKaju('bob',10,'audit')).ok,false);assert.equal((await f.S.transferKaju('bob','Bob',10)).ok,false);
 f.data.users.bob.deleted=false;f.hooks.beforeTx=path=>{if(path==='users/bob')f.data.users.bob.deleted=true;};
 assert.equal((await f.S.adminAdjustKaju('bob',10,'audit')).ok,false);assert.equal(f.data.users.bob.kaju,100);assert.equal(f.data.users.bob.deleted,true);assert.equal(f.data.users.bob.heroAdminKajuOps,undefined);
});
await test('live deletion clears Store identity and cached Auth emissions cannot reactivate the deleted owner',async()=>{
 const f=fixture({profileAlice:initial});await settle();f.hooks.autoEvents=true;f.write('users/alice/deleted',true);await settle();assert.equal(f.P.uid,null);assert.equal(f.P.ready,false);assert.equal(f.P.kaju,0);
 f.auth({isVisibleAdmin:true});assert.equal(f.P.uid,null);assert.equal((await f.S.awardXP(10)).ok,false);assert.equal(await f.S.useItem('item_hint'),false);
});
console.log(`PASS Store score/XP/match v156: ${groups} authoritative, acknowledgment, monotonic, identity, boost, history and compatibility groups`);
