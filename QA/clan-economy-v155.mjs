// Actual clan economy functions with acknowledged, interrupted and retried local
// RTDB transactions. No production connection, accounts or balances are used.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = name => fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
const source = read('clan-economy.js').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const clone = value => value == null ? null : structuredClone(value);
const snap = value => ({val:()=>clone(value),exists:()=>value!=null,forEach:fn=>Object.entries(value||{}).forEach(([key,v])=>fn({...snap(v),key}))});
const settle = async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({admin=false,initialData}={}){
  const data=clone(initialData||{users:{alice:{kaju:2000,clanId:'one',heroWalletRevision:3},bob:{kaju:3000,clanId:'one'}},clans:{one:{name:'One',leader:'alice',kaju:100,members:{alice:{},bob:{}}},two:{name:'Two',kaju:200}}});
  let state={uid:'alice',status:'google',displayName:'Alice',isAdmin:admin},queue=Promise.resolve();
  const logs=[],writes=[],hooks={beforeTx:null,afterTx:null,beforeGet:null};
  const get=path=>path.split('/').reduce((v,k)=>v?.[k],data)??null;
  const put=(path,value)=>{const parts=path.split('/');let at=data;for(const p of parts.slice(0,-1))at=at[p]??={};if(value===null)delete at[parts.at(-1)];else at[parts.at(-1)]=clone(value);writes.push(path);};
  const fdb={ref:(_,path)=>path,
    get:async path=>{if(hooks.beforeGet)await hooks.beforeGet(path);return snap(get(path));},
    set:async(path,value)=>put(path,value),
    runTransaction:(path,update,options)=>{
      assert.equal(options?.applyLocally,false);
      const run=queue.then(async()=>{
        if(hooks.beforeTx)await hooks.beforeTx(path);
        const next=update(clone(get(path)));
        if(next===undefined)return{committed:false,snapshot:snap(get(path))};
        put(path,next);return{committed:true,snapshot:snap(next)};
      });
      queue=run.catch(()=>{});
      return run.then(async result=>{if(hooks.afterTx)await hooks.afterTx(path,result);return result;});
    }};
  const context=vm.createContext({Auth:{getState:()=>state},db:{},fdb,Date,Math,Number,Object,Map,Promise,
    getState:()=>({uid:state.uid}),logSpend:(...args)=>logs.push(args)});
  vm.runInContext(source,context);
  return {context,data,hooks,fdb,logs,writes,get,put,setAuth:patch=>{state={...state,...patch};},
    donate:(...args)=>context.donateClanKaju(...args),retry:(...args)=>context.retryClanDonations(...args),support:(...args)=>context.supportClanKaju(...args)};
}
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS',name);}
await test('donation debits once and atomically credits pool, history and donor total with replay protection',async()=>{
  const f=fixture();Object.assign(f.data.users.alice,{heroRewardClaims:{daily:{amount:10}},kajuOutbox:{gift:{amount:50}},kajuSent:{dAmt:50},heroKajuDaily:{amount:20}});
  const first=await f.donate('one',500,'once');assert.equal(first.ok,true);assert.equal(first.pending,false);
  assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.users.alice.heroWalletRevision,4);
  assert.equal(f.data.clans.one.kaju,600);assert.equal(f.data.clans.one.donorTotals.alice.total,500);
  assert.equal(f.data.clans.one.donations[first.operationId].amount,500);assert.equal(f.data.users.alice.kaju_history[first.operationId].amount,500);
  await f.donate('one',500,'once');assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.clans.one.kaju,600);assert.equal(f.logs.length,1);
  assert.equal(f.data.users.alice.heroRewardClaims.daily.amount,10);assert.equal(f.data.users.alice.kajuOutbox.gift.amount,50);assert.equal(f.data.users.alice.kajuSent.dAmt,50);assert.equal(f.data.users.alice.heroKajuDaily.amount,20);
});
await test('strict amounts, invalid paths, absent wallet and insufficient/member changes cannot mint or debit',async()=>{
  const f=fixture();for(const amount of [-1,0,1.5,NaN,Infinity,'500',{},Number.MAX_SAFE_INTEGER+1,1000000000])assert.equal((await f.donate('one',amount,'invalid')).ok,false);
  for(const id of ['','bad/path','bad.key'])assert.equal((await f.donate(id,500,'bad')).ok,false);
  assert.equal((await f.donate('two',500,'membership')).ok,false);assert.equal((await f.donate('one',3000,'poor')).ok,false);
  f.data.users.alice.kaju='2000';assert.equal((await f.donate('one',500,'bad-balance')).ok,false);
  delete f.data.users.alice;assert.equal((await f.donate('one',500,'missing')).ok,false);
  assert.equal(f.data.clans.one.kaju,100);assert.equal(f.writes.length,0);
});
await test('failed clan delivery preserves funded reservation and exact recovery never takes a second debit',async()=>{
  const f=fixture();f.hooks.beforeTx=path=>{if(path==='clans/one')throw new Error('Offline');};
  const r=await f.donate('one',500,'offline');assert.equal(r.ok,true);assert.equal(r.pending,true);assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.clans.one.kaju,100);
  const other=await f.donate('one',1000,'new');assert.equal(other.ok,false);assert.equal(other.pending,true);assert.equal(other.operationId,r.operationId);assert.equal(f.data.users.alice.kaju,1500);
  f.hooks.beforeTx=null;const recovery=await f.retry(r.operationId);assert.equal(recovery.ok,true);assert.ok(recovery.confirmedIds.includes(r.operationId));assert.equal(f.data.clans.one.kaju,600);assert.equal(f.data.users.alice.kaju,1500);
  await f.retry(r.operationId);assert.equal(f.data.clans.one.kaju,600);assert.equal(f.data.clans.one.donorTotals.alice.total,500);
});
await test('lost wallet debit acknowledgement and denied read retain original ID for safe retry',async()=>{
  const f=fixture();let once=true;
  f.hooks.afterTx=(path,r)=>{if(path==='users/alice'&&r.committed&&once){once=false;throw new Error('Ack lost');}};
  f.hooks.beforeGet=path=>{if(path==='users/alice')throw new Error('Read denied');};
  const r=await f.donate('one',500,'uncertain');assert.equal(r.ok,false);assert.equal(r.uncertain,true);assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.clans.one.kaju,100);
  f.hooks.beforeGet=null;const retry=await f.donate('one',500,'uncertain');assert.equal(retry.ok,true);assert.equal(retry.pending,false);assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.clans.one.kaju,600);
});
await test('lost clan acknowledgement and denied confirmation do not refund or duplicate on recovery',async()=>{
  const f=fixture();let once=true;
  f.hooks.afterTx=(path,r)=>{if(path==='clans/one'&&r.committed&&once){once=false;throw new Error('Ack lost');}};
  f.hooks.beforeGet=path=>{if(path==='clans/one')throw new Error('Read denied');};
  const r=await f.donate('one',500,'clan-ack');assert.equal(r.pending,true);assert.equal(f.data.clans.one.kaju,600);assert.equal(f.data.users.alice.kaju,1500);
  f.hooks.beforeGet=null;const recovery=await f.retry(r.operationId);assert.ok(recovery.confirmedIds.includes(r.operationId));assert.equal(f.data.clans.one.kaju,600);assert.equal(f.data.clans.one.donorTotals.alice.total,500);assert.equal(f.data.users.alice.kaju,1500);
});
await test('failed sender completion acknowledgement leaves idempotent clan receipt for later retry',async()=>{
  const f=fixture();let userWrites=0;
  f.hooks.beforeTx=path=>{if(path==='users/alice'&&++userWrites>1)throw new Error('Journal update denied');};
  const r=await f.donate('one',500,'final-ack');assert.equal(r.pending,false);assert.equal(f.data.users.alice.heroClanDonations[r.operationId].state,'pending');
  f.hooks.beforeTx=null;const recovered=await f.retry(r.operationId);assert.ok(recovered.confirmedIds.includes(r.operationId));assert.equal(f.data.users.alice.heroClanDonations[r.operationId].state,'delivered');assert.equal(f.data.clans.one.kaju,600);
});
await test('reload recovery uses durable journal and refuses a new debit while old delivery is reserved',async()=>{
  const f=fixture();f.hooks.beforeTx=path=>{if(path==='clans/one')throw new Error('Offline');};
  const r=await f.donate('one',500,'reload');
  const fresh=fixture({initialData:f.data});const blocked=await fresh.donate('one',500,'new-form');assert.equal(blocked.pending,true);assert.equal(fresh.data.users.alice.kaju,1500);
  const recovered=await fresh.retry();assert.ok(recovered.confirmedIds.includes(r.operationId));assert.equal(fresh.data.clans.one.kaju,600);assert.equal(fresh.data.users.alice.kaju,1500);
});
await test('two concurrent donation intents cannot overdraw or create a second debit before delivery',async()=>{
  const f=fixture();const results=await Promise.all([f.donate('one',1500,'parallel-one'),f.donate('one',1500,'parallel-two')]);
  assert.equal(results.filter(r=>r.ok&&!r.pending).length,1);assert.equal(f.data.users.alice.kaju,500);assert.equal(f.data.clans.one.kaju,1600);assert.equal(Object.keys(f.data.users.alice.heroClanDonations).length,1);
});
await test('same caller ID from different donors has independent clan receipts',async()=>{
  const f=fixture();await f.donate('one',500,'shared');f.setAuth({uid:'bob',displayName:'Bob'});const r=await f.donate('one',500,'shared');assert.equal(r.ok,true);assert.equal(r.pending,false);
  assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.users.bob.kaju,2500);assert.equal(f.data.clans.one.kaju,1100);assert.equal(Object.keys(f.data.clans.one.donationReceipts).length,2);
});
await test('account switch after debit cannot credit a new clan or log under next account',async()=>{
  const f=fixture();let release;
  f.hooks.afterTx=(path,r)=>path==='users/alice'&&r.committed?new Promise(resolve=>release=resolve):undefined;
  const pending=f.donate('one',500,'switch');await settle();f.setAuth({uid:'bob'});release();const r=await pending;
  assert.equal(r.uncertain,true);assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.users.bob.kaju,3000);assert.equal(f.data.clans.one.kaju,100);assert.equal(f.logs.length,0);
  f.hooks.afterTx=null;f.setAuth({uid:'alice'});await f.retry();assert.equal(f.data.clans.one.kaju,600);
});
await test('malformed and full pools cancel atomically and refund instead of trapping a reserved donation',async()=>{
  for(const pool of ['100',Number.MAX_SAFE_INTEGER-10]){
    const f=fixture();f.data.clans.one.kaju=pool;const r=await f.donate('one',500,'bad-pool');
    assert.equal(r.refunded,true);assert.equal(r.pending,false);assert.equal(f.data.clans.one.kaju,pool);assert.equal(f.data.clans.one.donations,undefined);
    assert.equal(f.data.users.alice.kaju,2000);assert.equal(f.data.users.alice.heroClanDonations[r.operationId].state,'refunded');
    f.data.clans.one.kaju=100;await f.retry();assert.equal(f.data.clans.one.kaju,100,'cancelled operation never turns into a late delivery');assert.equal(f.data.users.alice.kaju,2000);
    assert.equal((await f.donate('one',500,'new-valid')).pending,false);assert.equal(f.data.clans.one.kaju,600);
  }
});
await test('missing clan is tombstoned and refunded, so joining a new clan does not strand the reservation',async()=>{
  const f=fixture();delete f.data.clans.one;const r=await f.donate('one',500,'deleted');assert.equal(r.refunded,true);assert.equal(f.data.users.alice.kaju,2000);
  assert.equal(f.data.clans.one.closed,true);assert.equal(f.data.clans.one.donationReceipts[r.operationId].state,'cancelled');
  f.data.users.alice.clanId='two';const next=await f.donate('two',500,'new-clan');assert.equal(next.pending,false);assert.equal(f.data.users.alice.kaju,1500);assert.equal(f.data.clans.two.kaju,700);
});
await test('refund acknowledgement loss and wallet cap retain durable cancellation without duplicate or lost money',async()=>{
  const f=fixture();f.data.clans.one.kaju=Number.MAX_SAFE_INTEGER;
  f.hooks.beforeTx=path=>{if(path==='clans/one')f.data.users.alice.kaju=999999999;};
  const r=await f.donate('one',500,'refund-cap');assert.equal(r.pending,true);assert.equal(f.data.clans.one.donationReceipts[r.operationId].state,'cancelled');assert.equal(f.data.users.alice.kaju,999999999);
  f.hooks.beforeTx=null;f.data.users.alice.kaju-=500;let once=true;
  f.hooks.afterTx=(path,result)=>{if(path==='users/alice'&&result.committed&&once){once=false;throw new Error('Refund ack lost');}};
  await f.retry(r.operationId);assert.equal(f.data.users.alice.kaju,999999999);await f.retry(r.operationId);assert.equal(f.data.users.alice.kaju,999999999);assert.equal(f.data.clans.one.kaju,Number.MAX_SAFE_INTEGER);
});
await test('disband preserves acknowledged payment receipts and canceled pending donations refund exactly once',async()=>{
  const f=fixture();let userWrites=0;
  f.hooks.beforeTx=path=>{if(path==='users/alice'&&++userWrites>1)throw new Error('Journal mark denied');};
  const r=await f.donate('one',500,'before-close');f.hooks.beforeTx=null;
  assert.equal(await f.context.closeClanTreasury('one','alice'),true);assert.equal(f.data.clans.one.closed,true);assert.equal(f.data.clans.one.donationReceipts[r.operationId].appliedDelta,500);
  const recovered=await f.retry(r.operationId);assert.ok(recovered.confirmedIds.includes(r.operationId));assert.equal(f.data.users.alice.kaju,1500,'fulfilled donation is not refunded after clan disband');assert.equal(f.data.clans.one.kaju,undefined);
  assert.equal((await f.support('one',100,'closed-support')).ok,false);
  const fresh=fixture();fresh.hooks.beforeTx=path=>{if(path==='clans/one')throw new Error('Offline');};const p=await fresh.donate('one',500,'pending-close');fresh.hooks.beforeTx=null;
  await fresh.context.closeClanTreasury('one','alice');const canceled=await fresh.retry(p.operationId);assert.ok(canceled.refundedIds.includes(p.operationId));assert.equal(fresh.data.users.alice.kaju,2000);
});
await test('operation tuple boundaries prevent underscore UID/request collisions',async()=>{
  const f=fixture();f.data.users.a_b={kaju:1000,clanId:'one'};f.data.users.a={kaju:1000,clanId:'one'};
  f.setAuth({uid:'a_b'});const first=await f.donate('one',100,'c');f.setAuth({uid:'a'});const second=await f.donate('one',100,'b_c');
  assert.equal(first.pending,false);assert.equal(second.pending,false);assert.notEqual(first.operationId,second.operationId);assert.equal(f.data.clans.one.kaju,300);assert.equal(f.data.users.a_b.kaju,900);assert.equal(f.data.users.a.kaju,900);
});
await test('failed recovery reads and malformed journal cannot claim success or mint clan Kaju',async()=>{
  const f=fixture();f.hooks.beforeGet=()=>{throw new Error('Denied');};const r=await f.retry('missing');assert.equal(r.ok,false);assert.deepEqual(Array.from(r.confirmedIds),[]);
  f.hooks.beforeGet=null;f.data.users.alice.heroClanDonations={forged:{uid:'bob',clanId:'one',amount:500,state:'pending'}};const malformed=await f.retry();assert.equal(malformed.confirmedIds.length,0);assert.equal(malformed.queuedIds.length,1);assert.equal(f.data.clans.one.kaju,100);
});
await test('admin support mint, audit and chat are atomic; replay and actual overflow clamp are precise',async()=>{
  const f=fixture({admin:true});const r=await f.support('one',100000,'support');assert.equal(r.ok,true);assert.equal(r.amount,100000);assert.equal(f.data.users.alice.kaju,2000);assert.equal(f.data.clans.one.kaju,100100);
  assert.equal(f.data.clans.one.chat[r.operationId].isSystem,true);assert.equal(f.data.clans.one.donations[r.operationId].amount,100000);
  await f.support('one',100000,'support');assert.equal(f.data.clans.one.kaju,100100);assert.equal(Object.keys(f.data.clans.one.donations).length,1);
  f.data.clans.one.kaju=Number.MAX_SAFE_INTEGER-9;const clipped=await f.support('one',100,'clipped');assert.equal(clipped.amount,9);assert.equal(f.data.clans.one.donations[clipped.operationId].amount,9);assert.equal((await f.support('one',1,'full')).ok,false);
});
await test('lost admin acknowledgement reuses stable operation and validates authorization/amount',async()=>{
  const f=fixture({admin:true});let once=true;
  f.hooks.afterTx=(path,r)=>{if(path==='clans/one'&&r.committed&&once){once=false;throw new Error('Ack lost');}};
  f.hooks.beforeGet=()=>{throw new Error('Read denied');};const r=await f.support('one',100,'support-ack');assert.equal(r.uncertain,true);assert.equal(f.data.clans.one.kaju,200);
  f.hooks.beforeGet=null;assert.equal((await f.support('one',100,'support-ack')).ok,true);assert.equal(f.data.clans.one.kaju,200);
  assert.equal((await f.support('one',101,'support-ack')).ok,false);for(const value of [1.5,'100',-10,0,1000000001])assert.equal((await f.support('one',value,'bad')).ok,false);
  f.setAuth({isAdmin:false});assert.equal((await f.support('one',100,'not-admin')).ok,false);assert.equal(f.data.clans.one.kaju,200);
});

// Exercise the actual treasury and reset handlers at their async boundaries too.
const clanSource=read('clan.js');
const handlers=clanSource.slice(clanSource.indexOf('function treasuryCurrent('),clanSource.indexOf('// ── Üyeler'));
function treasury(){
  const calls=[],messages=[];let owner='alice',admin=false,nonce=0;
  const C={ownerUid:'alice',myClanId:'one'},context=vm.createContext({C,_clan:{kaju:100},Auth:{getState:()=>({uid:owner,status:'google',isAdmin:admin})},
    document:{getElementById:()=>({querySelectorAll:()=>[]})},confirm:()=>true,fmt:n=>String(n),_toast:(...args)=>messages.push(args),renderTreasury:async()=>{},renderMyClan:async()=>{},renderNoClan:()=>{},
    clanOperationId:()=>String(++nonce),donateClanKaju:async(...args)=>{calls.push(args);return{ok:true,amount:500,newBalance:600};},supportClanKaju:async()=>({ok:true,amount:1,newBalance:101}),retryClanDonations:async()=>({ok:false,confirmedIds:[]})});
  vm.runInContext(handlers,context);return{context,C,calls,messages,setOwner:uid=>owner=uid,setAdmin:value=>admin=value};
}
await test('treasury double click and replaced owner/clan cannot submit or paint a second operation',async()=>{
  const f=treasury();let release;f.context.donateClanKaju=(...args)=>{f.calls.push(args);return new Promise(resolve=>release=resolve);};
  const pending=f.context.donateToClan(500);await f.context.donateToClan(500);assert.equal(f.calls.length,1);f.C.myClanId='two';release({ok:true,amount:500,newBalance:600});await pending;assert.equal(f.messages.length,0);assert.equal(f.context._clan.kaju,100);
  f.setOwner('bob');await f.context.donateToClan(500);assert.equal(f.calls.length,1);
});
await test('treasury uncertain operations preserve ID and cannot change requested amount; failed exact recovery stays pending',async()=>{
  const f=treasury();f.context.donateClanKaju=async(...args)=>{f.calls.push(args);return{ok:false,uncertain:true};};
  await f.context.donateToClan(500);await f.context.donateToClan(1000);assert.equal(f.calls.length,1);await f.context.donateToClan(500);assert.equal(f.calls[0][2],f.calls[1][2]);
  f.C.pendingDonation='reserved';await f.context.retryClanDonation();assert.equal(f.C.pendingDonation,'reserved');assert.match(f.messages.at(-1)[0],/henüz doğrulanamadı/);
  f.context.retryClanDonations=async()=>({ok:true,confirmedIds:['unrelated']});await f.context.retryClanDonation();assert.equal(f.C.pendingDonation,'reserved');
  f.context.retryClanDonations=async()=>({ok:true,confirmedIds:['reserved']});await f.context.retryClanDonation();assert.equal(f.C.pendingDonation,null);
});
await test('a former member can finish an exact refund without rendering a missing clan',async()=>{
  const f=treasury();f.C.myClanId=null;f.C.pendingDonation='refund';let noClan=0,clan=0;
  f.context.renderNoClan=()=>{noClan++;};f.context.renderMyClan=()=>{clan++;};
  f.context.retryClanDonations=async()=>({ok:true,confirmedIds:[],refundedIds:['refund']});
  await f.context.retryClanDonation();assert.equal(f.C.pendingDonation,null);assert.equal(noClan,1);assert.equal(clan,0);assert.match(f.messages.at(-1)[0],/iade edildi/);
});

const adminSource=read('admin.js');
const resetHandler=adminSource.slice(adminSource.indexOf('async function doResetProgress('),adminSource.indexOf('async function doDeleteUser('));
function reset(){
  const f=fixture({admin:true});f.put('users/victim',{nick:'Victim',kaju:1234,heroWalletRevision:7,heroRewardClaims:{wheel:{amount:50}},kajuOutbox:{gift:{amount:100}},heroClanDonations:{don:{amount:50}},kajuSent:{dAmt:100},heroKajuDaily:{amount:2000},heroAdminKajuOps:{admin:{appliedDelta:50}},level:5,xp:{level:5,xp:100}});
  const target={uid:'victim',profile:clone(f.get('users/victim'))},panel={target},messages=[],logs=[];
  Object.assign(f.context,{P:panel,msg:(...a)=>messages.push(a),confirm:()=>true,logAdmin:(...a)=>logs.push(a),renderTarget:()=>{}});vm.runInContext(resetHandler,f.context);
  return{...f,panel,target,messages,logs,run:()=>f.context.doResetProgress()};
}
await test('admin progress reset changes wallet revision but preserves all paid/reserved receipts and limits',async()=>{
  const f=reset();await f.run();const p=f.data.users.victim;assert.equal(p.kaju,0);assert.equal(p.heroWalletRevision,8);assert.equal(p.level,1);assert.equal(p.kaju_history,null);
  for(const field of ['heroRewardClaims','kajuOutbox','heroClanDonations','kajuSent','heroKajuDaily','heroAdminKajuOps'])assert.deepEqual(p[field],f.target.profile[field]);
  const count=Object.keys(p.heroProgressResets).length;f.data.users.victim.kaju=20;await f.run();assert.equal(f.data.users.victim.kaju,20);assert.equal(Object.keys(p.heroProgressResets).length,count);
});
await test('uncertain admin reset reuses its receipt and does not erase subsequently earned funds',async()=>{
  const f=reset();let once=true;f.hooks.afterTx=(path,r)=>{if(path==='users/victim'&&r.committed&&once){once=false;throw new Error('Ack lost');}};
  f.hooks.beforeGet=path=>{if(path==='users/victim')throw new Error('Read denied');};await f.run();assert.equal(f.data.users.victim.kaju,0);f.data.users.victim.kaju=40;
  f.hooks.beforeGet=null;await f.run();assert.equal(f.data.users.victim.kaju,40);assert.equal(f.target.profile.kaju,40);assert.equal(Object.keys(f.data.users.victim.heroProgressResets).length,1);
});
await test('admin reset holds original target and rejects duplicate and stale account completion',async()=>{
  const f=reset();let release;f.hooks.afterTx=(path,r)=>path==='users/victim'&&r.committed?new Promise(resolve=>release=resolve):undefined;
  const pending=f.run();await f.run();await settle();f.panel.target={uid:'bob',profile:{kaju:999}};release();await pending;assert.equal(f.panel.target.profile.kaju,999);assert.equal(f.logs[0][1],'victim');
  const g=reset();let finish;g.hooks.afterTx=(path,r)=>path==='users/victim'&&r.committed?new Promise(resolve=>finish=resolve):undefined;const old=g.run();await settle();g.setAuth({uid:'bob'});finish();await old;assert.equal(g.logs.length,0);assert.equal(g.target.profile.kaju,1234);
});
console.log(`PASS Clan economy/admin reset v155: ${groups} transaction, reservation, recovery, identity and reset groups`);
