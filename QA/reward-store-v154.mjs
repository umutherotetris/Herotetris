// Real Store receipt functions with acknowledged/deferred Firebase semantics.
// No network, live account, or production reward is written.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/store.js',import.meta.url),'utf8');
const start=source.indexOf('export async function claimKajuOnce('),end=source.indexOf('// İşlem açıklaması',start);
assert.ok(start>=0&&end>start);
const code=source.slice(start,end).replace(/^export /gm,'');
const clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
const snapshot=value=>({val:()=>clone(value),exists:()=>value!=null});
function fixture(profile={kaju:100,level:1,xp:{level:1,xp:10,totalXP:10}}){
 let uid='alice',queue=Promise.resolve();
 const records=new Map([['users/alice',clone(profile)]]),writes=[],logs=[],events=[],options=[],reads=[],listeners=[];
 const hooks={reject:false,before:null,after:null,nullFirst:false,coldAbort:false,abortSnapshot:null,getReject:false,beforeGet:null};
 const context=vm.createContext({
  console,Date,Number,Object,Array,Math,Promise,setTimeout,clearTimeout,KAJU_MAX:999999999,
  Auth:{getState:()=>({uid,status:uid?'google':'offline'})},db:{},
  player:{uid:'alice',kaju:100,level:1,xp:10,totalXP:10},
  finiteAmount:(v,f=0)=>Number.isFinite(Number(v))?Math.max(0,Math.floor(Number(v))):f,
  xpForLevel:level=>300+level*200,
  ref:(_,path)=>path,
  runTransaction:(path,update,opts)=>{
   options.push(opts);
   const task=queue.then(async()=>{
    if(hooks.before)await hooks.before();
    if(hooks.reject){const error=new Error('PERMISSION_DENIED');error.code='PERMISSION_DENIED';throw error;}
    if(hooks.coldAbort){
     hooks.coldAbort=false;
     assert.equal(update(null),undefined);
     return {committed:false,snapshot:snapshot(null)};
    }
    if(hooks.nullFirst)update(null);
    const next=update(clone(records.get(path)));
    if(next===undefined)return {committed:false,snapshot:snapshot(hooks.abortSnapshot??records.get(path))};
    records.set(path,clone(next));writes.push(path);
    if(hooks.after)await hooks.after(next);
    return {committed:true,snapshot:snapshot(records.get(path))};
   });queue=task.catch(()=>{});return task;
  },
  get:async path=>{
   reads.push(path);
   if(hooks.beforeGet)await hooks.beforeGet(path);
   if(hooks.getReject)throw new Error('Read denied');
   const [parent,value]=[...records].find(([key])=>path===key||path.startsWith(key+'/')) || [];
   return snapshot(parent && path===parent ? value : parent && path.slice(parent.length+1).split('/').reduce((at,key)=>at?.[key],value));
  },
  onValue:(path,fn)=>{
   const listener={path,closed:false};listeners.push(listener);
   queueMicrotask(()=>{if(!listener.closed)fn(snapshot(records.get(path)));});
   return ()=>{listener.closed=true;};
  },
  set:async(path,value)=>{records.set(path,clone(value));writes.push(path);},
  logKaju:(...args)=>logs.push(args),emit:()=>events.push('emit'),_trackQuestSafe:(...args)=>events.push(args)
 });
 vm.runInContext(code,context);
 return {context,records,writes,logs,events,hooks,options,reads,listeners,setUid:value=>{uid=value;}};
}
let groups=0;
{
 const f=fixture();const a=await f.context.claimKajuOnce('quest_day_play3',100,'quest','3 games','alice');
 assert.equal(a.claimed,true);assert.equal(a.amount,100);assert.equal(f.records.get('users/alice').kaju,200);
 f.hooks.abortSnapshot={kaju:0,heroRewardClaims:{quest_day_play3:{amount:999}}};
 const b=await f.context.claimKajuOnce('quest_day_play3',100,'quest','3 games','alice');
 assert.equal(b.claimed,false);assert.equal(b.alreadyClaimed,true);assert.equal(b.amount,100);assert.equal(b.balance,200,'duplicate reconciliation uses get, not cached abort snapshot');
 assert.equal(f.logs.length,1);assert.ok(f.options.every(o=>o.applyLocally===false));groups++;
}
{
 const f=fixture();f.hooks.reject=true;
 await assert.rejects(f.context.claimKajuOnce('quest_day_play3',100,'quest','3 games','alice'),e=>e.code==='PERMISSION_DENIED');
 assert.equal(f.records.get('users/alice').kaju,100);assert.equal(f.context.player.kaju,100);assert.equal(f.logs.length,0);
 f.hooks.reject=false;assert.equal((await f.context.claimKajuOnce('quest_day_play3',100,'quest','3 games','alice')).claimed,true);groups++;
}
{
 const f=fixture();f.hooks.nullFirst=true;
 const r=await f.context.claimKajuOnce('daily_day',profile=>({amount:profile.kaju===100?75:50,fields:{dailyLogin:{lastReward:profile.kaju===100?75:50}}}),'daily','login','alice');
 assert.equal(r.amount,75);assert.equal(r.fields.dailyLogin.lastReward,75);assert.equal(f.records.get('users/alice').kaju,175);groups++;
}
{
 const f=fixture();let release;f.hooks.before=()=>new Promise(resolve=>release=resolve);
 const p=f.context.claimKajuOnce('quest_day',100,'quest','task','alice');await new Promise(resolve=>setImmediate(resolve));f.setUid('bob');release();
 assert.equal((await p).claimed,false);assert.equal(f.records.get('users/alice').kaju,100);assert.equal(f.logs.length,0);groups++;
}
{
 const f=fixture();let release;f.hooks.after=()=>new Promise(resolve=>release=resolve);
 const p=f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.context.player.xp,10,'UI state stays unchanged before acknowledgement');release();
 const r=await p;assert.equal(r.claimed,true);assert.equal(r.receipt.type,'xp');assert.equal(f.context.player.xp,50);assert.equal(f.context.player.kaju,100);groups++;
}
{
 const f=fixture();const [a,b]=await Promise.all([
  f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice'),
  f.context.claimWheelReward('2026-10-22',{type:'jackpot',amount:750},'alice')
 ]);
 assert.equal(a.claimed,true);assert.equal(b.claimed,false);assert.equal(b.alreadyClaimed,true);assert.equal(b.receipt.type,'xp');assert.equal(b.receipt.amount,40);
 assert.equal(f.records.get('users/alice').kaju,100);assert.equal(f.records.get('users/alice').xp.totalXP,50);groups++;
}
{
 const f=fixture({kaju:100,level:1,xp:{level:1,xp:480,totalXP:480},cosmetics:{vip:JSON.stringify({until:Date.now()+100000})}});
 const r=await f.context.claimWheelReward('2026-10-22',{type:'xp',amount:100},'alice');
 assert.equal(r.receipt.amount,200);assert.equal(r.receipt.vipMult,2);assert.equal(f.context.player.level,2);assert.equal(f.context.player.xp,180);assert.equal(f.context.player.totalXP,680);groups++;
}
{
 const f=fixture({kaju:100,cosmetics:{vip:{until:Date.now()+100000}}});
 const r=await f.context.claimWheelReward('2026-10-22',{type:'egg',amount:1},'alice');
 assert.equal(r.claimed,true);assert.equal(r.complete,false);assert.equal(r.receipt.eggId,'daily_spin_2026-10-22');assert.equal(r.amount,100);
 const retry=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:30},'alice');
 assert.equal(retry.receipt.type,'egg');assert.equal(retry.receipt.eggId,r.receipt.eggId);assert.equal(f.records.get('users/alice').kaju,200);assert.equal(f.logs.length,1);groups++;
}
{
 const f=fixture();f.hooks.reject=true;
 await assert.rejects(f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice'),e=>e.code==='PERMISSION_DENIED');
 assert.equal(f.context.player.xp,10);assert.equal(f.records.get('users/alice').heroRewardClaims,undefined);
 assert.equal(f.options.length,1,'denied write is not repeated or bypassed');
 assert.deepEqual(f.reads,['users/alice/heroRewardClaims/spin_2026-10-22']);
 f.hooks.reject=false;const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:120},'alice');assert.equal(r.claimed,true);assert.equal(r.amount,120);groups++;
}
{
 const f=fixture({kaju:100,level:1,xp:{level:1,xp:10,totalXP:10},heroWalletRevision:7});
 f.hooks.coldAbort=true;
 const r=await f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice');
 assert.equal(r.claimed,true);
 assert.equal(f.options.length,2,'cold null abort retries after a confirmed profile read');
 assert.equal(f.writes.length,1);
 assert.deepEqual(f.listeners,[{path:'users/alice',closed:true}]);
 assert.equal(f.records.get('users/alice').heroWalletRevision,7,'an XP prize does not touch the Kaju revision');
 groups++;
}
{
 const prior={kaju:'100',level:1,xp:{level:1,xp:10,totalXP:10},heroWalletRevision:7};
 const f=fixture(prior);
 const r=await f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice');
 assert.equal(r.claimed,true);
 const saved=f.records.get('users/alice');
 assert.equal(saved.kaju,100,'normalize old text balance without a Kaju credit');
 assert.equal(saved.heroWalletRevision,7);assert.equal(saved.xp.totalXP,50);groups++;
}
{
 const valid={amount:25,type:'earn',game:'chess',reason:'Maç ödülü',ts:1700000000000,extra:'kept'};
 const legacy={amount:'-5',ts:'1600000000000',type:'spend',source:'historic fixture'};
 const f=fixture({kaju:100,kaju_history:{present:valid,old:legacy}});
 const result=await f.context.claimKajuOnce('quest_day_play3',100,'quest','3 games','alice');
 const saved=f.records.get('users/alice');
 assert.equal(result.claimed,true);
 assert.deepEqual(saved.kaju_history.present,valid);
 assert.deepEqual(saved.kaju_history.old,{...legacy,amount:-5,ts:1600000000000,game:'kaju',reason:'Eski işlem kaydı'});
 assert.equal(saved.kaju,200);assert.deepEqual(f.writes.filter(path=>path==='users/alice'),['users/alice']);groups++;
}
{
 const raw={amount:'bilinmiyor',ts:'1600000000000',type:'spend',extensions:{from:'legacy'}};
 const active={amount:10,ts:1730000000000,type:'earn',game:'spin',reason:'Test'};
 const previous={kind:'row',logId:'older',original:['old']};
 const original={kaju:100,kaju_history:{old:raw,active},heroKajuHistoryArchive:{entry_1:previous}};
 const f=fixture(original);
 const [a,b]=await Promise.all([
   f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice'),
   f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice')
 ]);
 assert.equal(Number(a.claimed)+Number(b.claimed),1);
 assert.equal(Number(a.alreadyClaimed)+Number(b.alreadyClaimed),1);
 const saved=f.records.get('users/alice');
 assert.equal(saved.kaju,150);
 assert.deepEqual(saved.kaju_history,{active});
 assert.deepEqual(saved.heroKajuHistoryArchive,{entry_1:previous,entry_2:{kind:'row',logId:'old',original:raw}});
 assert.deepEqual(f.writes.filter(path=>path==='users/alice'),['users/alice']);groups++;
}
{
 const f=fixture({kaju:100,kaju_history:false});
 const result=await f.context.claimKajuOnce('daily_day',50,'daily','daily login','alice');
 assert.equal(result.claimed,true);
 const saved=f.records.get('users/alice');
 assert.equal(saved.kaju_history,null);
 assert.deepEqual(saved.heroKajuHistoryArchive,{entry_1:{kind:'collection',original:false}});groups++;
}
{
 const profile={kaju:100,kaju_history:{old:{amount:'unknown'}},heroKajuHistoryArchive:'non-schema data'};
 const f=fixture(profile);
 assert.equal((await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice')).reason,'legacy-profile');
 assert.deepEqual(f.records.get('users/alice'),profile);assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture({kaju:' 9.99268287e8 ',level:1,xp:{level:1,xp:10,totalXP:10}});
 const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice');
 assert.equal(r.claimed,true);assert.equal(f.records.get('users/alice').kaju,999268337);
 const g=fixture({kaju:'999268287.00000000001',level:1,xp:{level:1,xp:10,totalXP:10}});
 assert.equal((await g.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice')).reason,'legacy-balance');
 assert.equal(g.records.get('users/alice').kaju,'999268287.00000000001');
 assert.equal(g.writes.length,0);groups++;
}
{
 const profile={kaju:100,kaju_history:{old:{amount:'unknown'}}};
 const f=fixture(profile);f.hooks.reject=true;
 await assert.rejects(f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice'),e=>e.code==='PERMISSION_DENIED');
 assert.deepEqual(f.records.get('users/alice'),profile);assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();f.hooks.after=()=>{throw Object.assign(Error('Connection stopped before acknowledgement'),{code:'DISCONNECTED'});};
 const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:120},'alice');
 assert.equal(r.alreadyClaimed,true);
 assert.equal(r.receipt.amount,120);
 assert.equal(f.writes.length,1);
 assert.equal(f.options.length,1,'a lost acknowledgement is reconciled, not replayed');
 assert.equal(f.records.get('users/alice').kaju,220);
 groups++;
}
{
 const f=fixture({kaju:100,heroRewardClaims:{'spin_2026-10-22':{kind:'wheel',type:'egg',amount:50,vipMult:1,eggId:'wrong-day'}}});
 f.hooks.reject=true;
 await assert.rejects(f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice'),e=>e.code==='PERMISSION_DENIED');
 assert.equal(f.writes.length,0,'malformed receipt does not recover or consume a claim');
 groups++;
}
{
 const f=fixture({kaju:150,heroRewardClaims:{'spin_2026-10-22':{kind:'wheel',type:'kaju',amount:50,vipMult:1}}});
 f.hooks.reject=true;f.hooks.beforeGet=()=>f.setUid('bob');
 const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:120},'alice');
 assert.equal(r.reason,'identity');
 assert.equal(f.writes.length,0);
 groups++;
}
{
 const f=fixture({kaju:999999990});
 const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice');assert.equal(r.claimed,false);assert.equal(r.reason,'balance-limit');assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();
 for(const day of ['2026-99-99','2026-02-31','bad',null])assert.equal((await f.context.claimWheelReward(day,{type:'kaju',amount:50},'alice')).reason,'invalid-reward');
 assert.equal((await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:999999},'alice')).claimed,false);
 assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:50},'alice');
 f.hooks.getReject=true;await assert.rejects(f.context.claimWheelReward('2026-10-22',{type:'xp',amount:40},'alice'),/Read denied/);assert.equal(f.logs.length,1);groups++;
}
console.log(`PASS Store reward receipts v154: ${groups} acknowledgement, retry, cross-sector idempotency, VIP, XP, identity and rejection groups`);
