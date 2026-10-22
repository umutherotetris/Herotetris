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
 const records=new Map([['users/alice',clone(profile)]]),writes=[],logs=[],events=[],options=[];
 const hooks={reject:false,before:null,after:null,nullFirst:false,abortSnapshot:null,getReject:false};
 const context=vm.createContext({
  console,Date,Number,Object,Array,Math,Promise,KAJU_MAX:999999999,
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
    if(hooks.nullFirst)update(null);
    const next=update(clone(records.get(path)));
    if(next===undefined)return {committed:false,snapshot:snapshot(hooks.abortSnapshot??records.get(path))};
    records.set(path,clone(next));writes.push(path);
    if(hooks.after)await hooks.after(next);
    return {committed:true,snapshot:snapshot(records.get(path))};
   });queue=task.catch(()=>{});return task;
  },
  get:async path=>{if(hooks.getReject)throw new Error('Read denied');return snapshot(records.get(path));},
  set:async(path,value)=>{records.set(path,clone(value));writes.push(path);},
  logKaju:(...args)=>logs.push(args),emit:()=>events.push('emit'),_trackQuestSafe:(...args)=>events.push(args)
 });
 vm.runInContext(code,context);
 return {context,records,writes,logs,events,hooks,options,setUid:value=>{uid=value;}};
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
 f.hooks.reject=false;const r=await f.context.claimWheelReward('2026-10-22',{type:'kaju',amount:120},'alice');assert.equal(r.claimed,true);assert.equal(r.amount,120);groups++;
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
