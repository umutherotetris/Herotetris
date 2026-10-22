// Actual Store module with local acknowledged transactions, deferred events and
// independent sender/receiver profiles. No network or production balances.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
const transferId=(uid,id)=>'tx_'+createHash('sha256').update(uid+'\0'+id).digest('hex');
let source=fs.readFileSync(new URL('../js/store.js',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'')
 .replace('await import(`${BASE}/firebase-database.js`)','__sdk')
 .replace('await import(`${BASE}/firebase-app.js`)','__app')
 .replace(/import\('\.\/([^']+)'\)/g,(_,file)=>`Promise.resolve(__modules[${JSON.stringify(file)}] || {})`)
 .replace(/^export default Store;?$/m,'').replace(/^export /gm,'');
source+='\nthis.S=Store;this.P=player;this.hydrateStore=hydrate;this.kozmoMult=_kozmoMult;';
const clone=v=>v==null?null:structuredClone(v);
const snap=v=>({val:()=>clone(v),exists:()=>v!=null,forEach:fn=>Object.entries(v||{}).forEach(([key,x])=>fn({...snap(x),key}))});
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({admin=false,alice=1000,bob=100,profileAlice,profileBob,initialData,crypto=webcrypto}={}){
 const data=initialData?clone(initialData):{users:{alice:{kaju:alice,...profileAlice},bob:{kaju:bob,...profileBob}}},storage=new Map(),writes=[],events=[],notices=[],listeners=[];
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
await test('strict amounts, UID paths, absent recipients and non-admin self transfer cannot debit',async()=>{
 const f=fixture();await settle();
 for(const amount of [NaN,Infinity,-50,10.5,'12.5',{},'',Number.MAX_SAFE_INTEGER+1])assert.equal((await f.S.transferKaju('bob','Bob',amount)).ok,false);
 for(const uid of ['bad/path','bad.key','',null,{}])assert.equal((await f.S.transferKaju(uid,'Bad',50)).ok,false);
 assert.equal((await f.S.transferKaju('missing','Missing',50)).ok,false);assert.equal((await f.S.transferKaju('alice','Alice',50)).ok,false);
 assert.equal(f.data.users.alice.kaju,1000);assert.equal(f.data.users.missing,undefined);
});
await test('normal transfer debit, counters and durable outbox commit together; stable replay never debits twice',async()=>{
 const f=fixture();await settle();
 const first=await f.S.transferKaju('bob','Bob',50,{txId:'stable_one'});assert.equal(first.ok,true);assert.equal(first.queued,false);
 assert.equal(f.data.users.alice.kaju,950);assert.equal(f.data.users.alice.kajuSent.dAmt,50);assert.equal(f.data.users.alice.kajuOutbox[first.txId].state,'published');
 assert.equal(f.read('kajuTransfers/bob/'+first.txId).amount,50);assert.deepEqual(f.notices.at(-1).slice(3),['alice',first.txId]);
 const again=await f.S.transferKaju('bob','Bob',50,{txId:'stable_one'});assert.equal(again.alreadyApplied,true);assert.equal(f.data.users.alice.kaju,950);
 assert.equal((await f.S.transferKaju('bob','Bob',60,{txId:'stable_one'})).ok,false);assert.equal(f.data.users.alice.kaju,950);
});
await test('concurrent limits use authoritative profile, not cached UI counters',async()=>{
 const w=new Date().toISOString();const f=fixture({alice:20000,profileAlice:{kajuSent:{hWin:w.slice(0,13),hAmt:9000,dWin:w.slice(0,10),dAmt:9000,mWin:w.slice(0,7),mAmt:9000}}});await settle();
 const results=await Promise.all([f.S.transferKaju('bob','Bob',1000),f.S.transferKaju('bob','Bob',1000)]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.data.users.alice.kaju,19000);assert.equal(f.data.users.alice.kajuSent.hAmt,10000);
});
await test('failed pending publish keeps funded journal and retry publishes without refund or a second debit',async()=>{
 const f=fixture();await settle();f.hooks.beforeSet=path=>{if(path.startsWith('kajuTransfers/'))throw new Error('Network unavailable');};
 const r=await f.S.transferKaju('bob','Bob',75,{txId:'offline'});assert.equal(r.ok,true);assert.equal(r.queued,true);assert.equal(f.data.users.alice.kaju,925);
 assert.equal(f.data.users.alice.kajuOutbox[r.txId].state,'queued');assert.equal(f.read('kajuTransfers/bob/'+r.txId),null);
 f.hooks.beforeSet=null;const retry=await f.S.retryPendingTransfers(r.txId);assert.equal(retry.ok,true);assert.ok(retry.confirmedIds.includes(r.txId));assert.equal(f.data.users.alice.kaju,925);assert.equal(f.read('kajuTransfers/bob/'+r.txId).amount,75);
});
await test('publish committed then acknowledgement failed never mints a refund; receiver receipt survives republish',async()=>{
 const f=fixture();await settle();let once=true;f.hooks.afterSet=path=>{if(once&&path==='kajuTransfers/bob/'+transferId('alice','ambiguous')){once=false;throw new Error('ack lost');}};
 const r=await f.S.transferKaju('bob','Bob',80,{txId:'ambiguous'});assert.equal(r.queued,true);assert.equal(f.data.users.alice.kaju,920);
 f.hooks.afterSet=null;f.switchTo('bob');await settle();await f.S.claimPendingTransfers();assert.equal(f.data.users.bob.kaju,180);
 f.switchTo('alice');await settle();await f.S.retryPendingTransfers();f.switchTo('bob');await settle();await f.S.claimPendingTransfers();
 assert.equal(f.data.users.alice.kaju+f.data.users.bob.kaju,1100);assert.equal(f.data.users.bob.kaju,180);
});
await test('recovery read failure cannot masquerade as confirmed delivery',async()=>{
 const f=fixture();await settle();f.hooks.beforeGet=path=>{if(path==='users/alice')throw new Error('Read denied');};
 const r=await f.S.retryPendingTransfers('unknown');assert.equal(r.ok,false);assert.deepEqual(Array.from(r.confirmedIds),[]);
});
await test('legacy valid pending entries credit once; failed cleanup and concurrent claims do not duplicate',async()=>{
 const f=fixture();await settle();f.write('kajuTransfers/bob/legacy',{txId:'legacy',fromUid:'alice',fromNick:'Alice',toUid:'bob',amount:25,ts:1});
 f.hooks.beforeSet=(path,value)=>{if(path==='kajuTransfers/bob/legacy'&&value===null)throw new Error('Cleanup denied');};
 f.switchTo('bob');await settle();await Promise.all([f.S.claimPendingTransfers(),f.S.claimPendingTransfers()]);assert.equal(f.data.users.bob.kaju,125);
 f.hooks.beforeSet=null;await f.S.claimPendingTransfers();assert.equal(f.data.users.bob.kaju,125);assert.equal(f.read('kajuTransfers/bob/legacy'),null);
 assert.ok(f.events.some(e=>e.detail?.uid==='bob'&&e.detail.total===25));
});
await test('malformed, mismatched and fractional pending entries are retained without credit',async()=>{
 const f=fixture();await settle();const base={txId:'bad',fromUid:'alice',toUid:'bob',amount:25};
 for(const [id,patch] of Object.entries({wrongTarget:{toUid:'alice'},wrongId:{txId:'other'},fraction:{amount:25.5},string:{amount:'25'},sender:{fromUid:'bad/path'}}))f.write('kajuTransfers/bob/'+id,{...base,txId:id,...patch});
 f.switchTo('bob');await settle();const r=await f.S.claimPendingTransfers();assert.equal(r.invalid,5);assert.equal(f.data.users.bob.kaju,100);assert.equal(Object.keys(f.read('kajuTransfers/bob')).length,5);
});
await test('admin clamping reports and atomically logs actual delta; stable operation is idempotent',async()=>{
 const f=fixture({admin:true,bob:999999990});await settle();
 const r=await f.S.adminAdjustKaju('bob',100,'audit','admin_once');assert.equal(r.ok,true);assert.equal(r.appliedDelta,9);assert.equal(r.amount,9);assert.equal(r.clipped,true);assert.equal(r.newBalance,999999999);
 assert.equal(f.data.users.bob.kaju_history.admin_once.amount,9);assert.equal(f.data.users.bob.kaju_history.admin_once.type,'admin-add');
 assert.equal((await f.S.adminAdjustKaju('bob',100,'audit','admin_once')).alreadyApplied,true);assert.equal(Object.keys(f.data.users.bob.kaju_history).length,1);
 assert.equal((await f.S.adminAdjustKaju('bob',100,'audit')).ok,false);
 const sub=await f.S.adminAdjustKaju('alice',-5000,'audit','subtract');assert.equal(sub.appliedDelta,-1000);assert.equal(sub.newBalance,0);assert.equal((await f.S.adminAdjustKaju('alice',-1,'audit')).ok,false);
});
await test('admin safe inputs, missing target and role loss before transaction are rejected',async()=>{
 const f=fixture({admin:true});await settle();for(const n of [NaN,Infinity,1.1,'4.2',0])assert.equal((await f.S.adminAdjustKaju('bob',n,'audit')).ok,false);
 assert.equal((await f.S.adminAdjustKaju('missing',50,'audit')).ok,false);
 f.hooks.beforeTx=path=>{if(path==='users/bob')f.auth({isAdmin:false});};
 assert.equal((await f.S.adminAdjustKaju('bob',50,'audit')).ok,false);assert.equal(f.data.users.bob.kaju,100);
});
await test('admin gifts accept positive integers below normal transfer minimum',async()=>{
 const f=fixture({admin:true});await settle();
 const r=await f.S.transferKaju('bob','Bob',1,{txId:'small_admin'});assert.equal(r.ok,true);assert.equal(r.admin,true);assert.equal(r.appliedDelta,1);assert.equal(f.data.users.bob.kaju,101);
 f.auth({isAdmin:false});assert.equal((await f.S.transferKaju('bob','Bob',1)).ok,false);
});
await test('lost admin commit acknowledgement recovers stable receipt without replaying delta',async()=>{
 const f=fixture({admin:true});await settle();let once=true;
 f.hooks.afterTx=(path,result)=>{if(once&&path==='users/bob'&&result.committed){once=false;throw new Error('ack lost');}};
 const first=await f.S.adminAdjustKaju('bob',30,'audit','admin_ack');assert.equal(first.ok,true);assert.equal(first.appliedDelta,30);
 assert.equal((await f.S.adminAdjustKaju('bob',30,'audit','admin_ack')).alreadyApplied,true);assert.equal(f.data.users.bob.kaju,130);assert.equal(Object.keys(f.data.users.bob.kaju_history).length,1);
});
await test('account switch after reserved transfer cannot mutate or publish as the next account',async()=>{
 const f=fixture();await settle();let release,started;const reserved=new Promise(resolve=>started=resolve);
 f.hooks.afterTx=(path,result)=>path==='users/alice'&&result.committed?new Promise(resolve=>{release=resolve;started();}):undefined;
 const p=f.S.transferKaju('bob','Bob',50,{txId:'account_switch'});await reserved;f.switchTo('bob');release();const r=await p;
 assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.equal(f.P.kaju,100);assert.equal(f.data.users.alice.kaju,950);assert.equal(f.read('kajuTransfers/bob/'+r.txId),null);
 f.hooks.afterTx=null;f.switchTo('alice');await settle();assert.equal(f.read('kajuTransfers/bob/'+r.txId).amount,50);
});
await test('gameplay earnings share atomic daily counter across simultaneous requests',async()=>{
 const f=fixture({alice:100});await settle();const credits=await Promise.all([f.S.addKaju(1500,'tetris'),f.S.addKaju(1500,'tetris')]);
 assert.equal(credits.reduce((a,b)=>a+b,0),2000);assert.equal(f.data.users.alice.kaju,2100);assert.equal(f.data.users.alice.heroKajuDaily.amount,2000);
 assert.equal(await f.S.addKaju(10,'tetris'),0);
});
await test('spend checks server wallet and safe positive integer, not stale local display',async()=>{
 const f=fixture({alice:10});await settle();f.data.users.alice.kaju=100;
 assert.equal(await f.S.spendKaju(20,'shop'),true);assert.equal(f.data.users.alice.kaju,80);
 for(const n of [-10,1.5,NaN,Infinity])assert.equal(await f.S.spendKaju(n,'shop'),false);
});
await test('per-account history is private and same-profile auth emissions do not roll back confirmed balance',async()=>{
 const f=fixture();await settle();await f.S.addKaju(50,'tetris');assert.equal(f.P.kaju,1050);
 f.auth({isVisibleAdmin:true});assert.equal(f.P.kaju,1050);assert.equal(f.S.getKajuLog('all').length,1);
 f.storage.set('hero_kaju_log',JSON.stringify([{amount:999,type:'earn',reason:'unknown legacy owner'}]));
 f.switchTo('bob');await settle();assert.equal(f.S.getKajuLog('all').length,0);assert.equal(f.S.getKajuSummary().earned,0);
});
await test('live wallet/incoming listeners update admin credits and ignore a prior account callback',async()=>{
 const f=fixture();await settle();const old=f.listeners.find(l=>l.active&&l.path==='users/alice');
 f.hooks.autoEvents=true;f.write('users/alice/kaju',1200);await settle();assert.equal(f.P.kaju,1200);
 f.write('kajuTransfers/alice/incoming',{txId:'incoming',fromUid:'bob',fromNick:'Bob',toUid:'alice',amount:30,ts:2});await settle();assert.equal(f.P.kaju,1230);
 f.switchTo('bob');await settle();old.fn(snap({kaju:99999}));assert.equal(f.P.uid,'bob');assert.equal(f.P.kaju,100);
});
await test('live paid ownership survives cached Auth profile re-emissions',async()=>{
 const f=fixture();await settle();f.hooks.autoEvents=true;
 f.write('users/alice/inventory',{shield:2});f.write('users/alice/boosts',{kaju:{until:Date.now()+100000,mult:2}});
 f.write('users/alice/cosmetics',{title:'paid'});f.write('users/alice/purchasedOnce',{bundle:true});f.write('users/alice/xp',{level:2,xp:50,totalXP:550});await settle();
 f.auth({isVisibleAdmin:true});assert.equal(f.P.inventory.shield,2);assert.equal(f.P.cosmetics.title,'paid');assert.equal(f.P.purchasedOnce.bundle,true);assert.equal(f.P.boosts.kaju.mult,2);assert.equal(f.P.totalXP,550);
});
await test('older acknowledged wallet snapshots cannot overwrite a newer revision mirror',async()=>{
 const f=fixture({alice:100});await settle();let release,held=true;
 f.hooks.afterTx=(path,result)=>{if(held&&path==='users/alice'&&result.committed){held=false;return new Promise(resolve=>release=resolve);}};
 const first=f.S.addKaju(20,'tetris');await settle();assert.equal(await f.S.addKaju(30,'tetris'),30);await settle();assert.equal(f.read('leaderboard/kaju/alice').kaju,150);
 release();assert.equal(await first,20);await settle();assert.equal(f.read('leaderboard/kaju/alice').kaju,150);assert.equal(f.read('leaderboard/kaju/alice').revision,2);
});
await test('durable funded transfer survives fresh module reload and conserves sender plus recipient',async()=>{
 const f=fixture();await settle();f.hooks.beforeSet=path=>{if(path.startsWith('kajuTransfers/'))throw new Error('offline');};
 const r=await f.S.transferKaju('bob','Bob',45,{txId:'reload'});assert.equal(r.queued,true);
 const next=fixture({initialData:f.data});await settle();assert.equal(next.data.users.alice.kaju,955);assert.equal(next.read('kajuTransfers/bob/'+r.txId).amount,45);
 next.switchTo('bob');await settle();assert.equal(next.data.users.bob.kaju,145);assert.equal(next.data.users.alice.kaju+next.data.users.bob.kaju,1100);
});
await test('lazy quest and tournament imports cannot apply an old event to a switched account',async()=>{
 const f=fixture();await settle();let release,quests=0,points=0;
 f.context.__modules['economy.js']=new Promise(resolve=>release=()=>resolve({progressQuest(){quests++;}}));
 f.context.__modules['tournament.js']={addTournamentPoints(){points++;}};
 f.S.trackQuestEvent('game_played');await settle();f.switchTo('bob');release();await settle();assert.equal(quests,0);assert.equal(points,0);
});
await test('sender namespace prevents different senders with the same requested operation ID from colliding',async()=>{
 const f=fixture();f.data.users.carol={kaju:10};await settle();
 const first=await f.S.transferKaju('carol','Carol',50,{txId:'shared_request'});assert.equal(first.ok,true);
 f.switchTo('bob');await settle();const second=await f.S.transferKaju('carol','Carol',25,{txId:'shared_request'});assert.equal(second.ok,true);assert.notEqual(first.txId,second.txId);
 f.switchTo('carol');await settle();assert.equal(f.data.users.carol.kaju,85);assert.equal(f.data.users.alice.kaju+f.data.users.bob.kaju+f.data.users.carol.kaju,1110);
});
await test('missing secure crypto fails before any debit',async()=>{
 const f=fixture({crypto:{}});await settle();const r=await f.S.transferKaju('bob','Bob',50,{txId:'no_crypto'});assert.equal(r.ok,false);assert.match(r.error,/HTTPS/);assert.equal(f.data.users.alice.kaju,1000);assert.equal(f.data.users.alice.kajuOutbox,undefined);
});
await test('Kozmo bonus selection is scoped to its owner and legacy global selection is never adopted',async()=>{
 const f=fixture();await settle();const selection={ownerUid:'alice',bonus:{kaju:0.2}};
 f.storage.set('hero_active_kozmo',JSON.stringify(selection));assert.equal(f.context.kozmoMult('kaju_boost'),1);
 f.storage.set('hero_active_kozmo:alice',JSON.stringify(selection));assert.equal(await f.S.addKaju(100,'tetris'),120);
 f.switchTo('bob');await settle();assert.equal(f.context.kozmoMult('kaju_boost'),1);
 f.storage.set('hero_active_kozmo:bob',JSON.stringify(selection));assert.equal(await f.S.addKaju(100,'tetris'),100);
 f.storage.set('hero_active_kozmo:bob',JSON.stringify({ownerUid:'bob',bonus:{kaju:0.2}}));assert.equal(f.context.kozmoMult('kaju_boost'),1.2);
 f.context.Auth.getState=()=>({uid:'alice'});assert.equal(f.context.kozmoMult('kaju_boost'),1);
});
await test('malformed Kozmo bonus values cannot concatenate, overflow or multiply earnings',async()=>{
 const f=fixture();await settle();
 for(const value of [null,true,'0.5','1','Infinity',-0.1,1.1,{},[],NaN,Infinity]){
  for(const key of ['kaju','xp','score','all']){
   f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',bonus:{[key]:value}}));
   for(const type of ['kaju_boost','xp_boost','score_boost'])assert.equal(f.context.kozmoMult(type),1);
  }
 }
 f.storage.set('hero_active_kozmo:alice','{"ownerUid":"alice","bonus":{"all":1e999}}');assert.equal(await f.S.addKaju(100,'tetris'),100);
});
await test('valid Kozmo gem bonuses and legacy power fallback keep their original rates',async()=>{
 const f=fixture();await settle();
 for(const [bonus,expected] of [[{kaju:0.12,all:0.08},1.12],[{all:0.08},1.08],[{kaju:0,all:0.05},1.05],[{kaju:1},2]]){
  f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',bonus}));assert.equal(f.context.kozmoMult('kaju_boost'),expected);
 }
 f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',power:'Bulut Çağırır',bonus:{xp:0.1}}));assert.equal(f.context.kozmoMult('kaju_boost'),1.05);assert.equal(f.context.kozmoMult('xp_boost'),1.1);
 f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',power:'Işık Patlatır'}));for(const type of ['kaju_boost','xp_boost','score_boost'])assert.equal(f.context.kozmoMult(type),1.08);
});
await test('successful creature snapshots clear deleted active Kozmos while read errors and malformed snapshots preserve them',async()=>{
 const f=fixture();await settle();const listener=f.listeners.find(l=>l.active&&l.path==='kozmos/alice/creatures');assert.ok(listener);
 const selection=JSON.stringify({ownerUid:'alice',id:'active_one',bonus:{kaju:0.2}});
 f.storage.set('hero_active_kozmo:alice',selection);listener.fn(snap({active_one:{name:'Owned'}}));assert.equal(f.context.kozmoMult('kaju_boost'),1.2);
 listener.onError({code:'PERMISSION_DENIED'});assert.equal(f.storage.get('hero_active_kozmo:alice'),selection);
 for(const malformed of [false,2,'unreadable',[]]){listener.fn(snap(malformed));assert.equal(f.storage.get('hero_active_kozmo:alice'),selection);}
 listener.fn(snap({other:{name:'Other'}}));assert.equal(f.storage.has('hero_active_kozmo:alice'),false);assert.equal(f.context.kozmoMult('kaju_boost'),1);
 f.storage.set('hero_active_kozmo:alice',selection);listener.fn(snap(null));assert.equal(f.storage.has('hero_active_kozmo:alice'),false);
});
await test('prior account creature callbacks cannot clear the next account selection or the old account selection after teardown',async()=>{
 const f=fixture();await settle();const old=f.listeners.find(l=>l.active&&l.path==='kozmos/alice/creatures');
 f.storage.set('hero_active_kozmo:alice',JSON.stringify({ownerUid:'alice',id:'alice_one',bonus:{kaju:0.1}}));
 f.switchTo('bob');await settle();assert.equal(old.active,false);const selection=JSON.stringify({ownerUid:'bob',id:'bob_one',bonus:{kaju:0.2}});
 f.storage.set('hero_active_kozmo:bob',selection);old.fn(snap(null));assert.equal(f.storage.get('hero_active_kozmo:bob'),selection);assert.ok(f.storage.has('hero_active_kozmo:alice'));
 const current=f.listeners.find(l=>l.active&&l.path==='kozmos/bob/creatures');current.fn(snap({bob_one:{name:'Owned'}}));assert.equal(f.storage.get('hero_active_kozmo:bob'),selection);
 current.fn(snap(null));assert.equal(f.storage.has('hero_active_kozmo:bob'),false);
});
console.log(`PASS Kaju wallet/transfer v155: ${groups} actual-module concurrency, conservation, admin, receipt, live-listener and account-boundary groups`);
