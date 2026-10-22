// Real tournament functions with deterministic account/ledger boundaries.
// No network calls, live prizes, or social messages are written.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/tournament.js',import.meta.url),'utf8');
const code=source.replace(/^import .*;\n/gm,'').replace(/^export default .*;\n?/gm,'').replace(/^export (?=(?:async )?function)/gm,'');
const clone=value=>value==null?null:structuredClone(value);
function fixture(){
 let uid='alice';const data={},gets=[],writes=[],calls=[],toasts=[],popups=[],timers=[],elements=new Map();
 const hooks={get:null,set:null,beforeTx:null,afterTx:null,claim:null};let credits=0;
 const read=path=>path.split('/').reduce((v,key)=>v?.[key],data)??null;
 const write=(path,value)=>{const parts=path.split('/');let at=data;for(const p of parts.slice(0,-1))at=at[p]??={};at[parts.at(-1)]=clone(value);};
 const snap=value=>({exists:()=>value!=null,val:()=>clone(value)});
 const body={innerHTML:'loading',querySelector:()=>null};
 const node=()=>({id:'',style:{},innerHTML:'',addEventListener(){},querySelector:sel=>sel==='#trnBody'?body:node(),remove(){if(elements.get(this.id)===this)elements.delete(this.id);}});
 const doc={getElementById:id=>elements.get(id)||null,createElement:node,head:{appendChild(){}},body:{appendChild:el=>elements.set(el.id,el),contains:el=>elements.get(el.id)===el}};
 const c=vm.createContext({Date,Number,Object,Array,Map,Set,Math,String,Promise,console,document:doc,window:{Hero:{toast:(...a)=>toasts.push(a),openTournament(){}}},
  setTimeout:fn=>{timers.push(fn);return timers.length;},setInterval:()=>1,clearInterval(){},
  Auth:{getState:()=>({uid,status:uid?'google':'offline',displayName:uid==='alice'?'Alice':'Bob'})},db:{},
  fdb:{ref:(_,path)=>path,get:async path=>{gets.push(path);if(hooks.get)await hooks.get(path);return snap(read(path));},
   set:async(path,value)=>{if(hooks.set)await hooks.set(path,value);write(path,value);writes.push({path,value:clone(value)});},
   update:async(path,value)=>{for(const [key,v]of Object.entries(value))write(path+'/'+key,v);writes.push({path,value:clone(value)});},
   runTransaction:async(path,fn,options)=>{if(hooks.beforeTx)await hooks.beforeTx();const value=fn(clone(read(path)));if(value===undefined)return{committed:false,snapshot:snap(read(path))};write(path,value);writes.push({path,value,options});if(hooks.afterTx)await hooks.afterTx();return{committed:true,snapshot:snap(value)};}},
  Store:{claimKajuOnce:async(id,amount,game,reason,owner)=>{
   calls.push({id,amount,owner});if(hooks.claim)return hooks.claim({id,amount,owner});
   const path='users/'+owner+'/heroRewardClaims/'+id,prior=read(path);
   if(prior)return{claimed:false,alreadyClaimed:true,amount:prior.amount};
   credits++;write(path,{amount});return{claimed:true,amount};
  }}
 });
 vm.runInContext(code,c);c._showPrizeWon=(...a)=>popups.push(a);
 const week=c._prevWeekId();
 write('tournaments/'+week+'/scores',{alice:{name:'Alice',pts:100},bob:{name:'Bob',pts:90}});
 return {c,data,gets,writes,calls,toasts,popups,timers,elements,body,week,hooks,read,write,setUid:value=>uid=value,credits:()=>credits};
}
let groups=0;
{
 const f=fixture();f.write('tournaments/'+f.c.weekId()+'/scores/alice/pts','20');
 await f.c.addTournamentPoints(10,'game');assert.equal(f.read('tournaments/'+f.c.weekId()+'/scores/alice/pts'),30);
 assert.equal(f.writes[0].options.applyLocally,false);groups++;
}
{
 const f=fixture();f.hooks.beforeTx=async()=>f.setUid('bob');await f.c.addTournamentPoints(10,'game');assert.equal(f.writes.length,0);
 const g=fixture();g.hooks.afterTx=async()=>g.setUid('bob');await g.c.addTournamentPoints(10,'game');assert.equal(g.writes.length,1,'account change after score commit blocks late name write');
 const h=fixture();h.write('tournaments/'+h.c.weekId()+'/scores/alice/pts',Number.MAX_SAFE_INTEGER);await h.c.addTournamentPoints(10,'game');assert.equal(h.writes.length,0);groups++;
}
{
 const f=fixture();f.write('tournaments/'+f.week+'/scores',{bob:{pts:10},zero:{pts:0},alice:{pts:'10'},bad:{pts:'NaN'},negative:{pts:-1},fraction:{pts:1.5}});
 const rows=await f.c.fetchLeaderboard(f.week,true);assert.deepEqual(Array.from(rows,x=>x.uid),['alice','bob']);groups++;
}
{
 const f=fixture();let release;f.hooks.get=path=>path.includes('/meta/claimed/')?new Promise(resolve=>release=resolve):undefined;
 const p=f.c.autoClaimPrize();await Promise.resolve();f.setUid('bob');release();
 const result=await p;assert.equal(result.claimed,false);assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);assert.equal(f.popups.length,0);groups++;
}
{
 const f=fixture();f.hooks.claim=async()=>{f.setUid('bob');return{claimed:true,amount:5000};};
 await f.c.autoClaimPrize();assert.equal(f.writes.length,0,'completed old-account award cannot start marker/wall writes');assert.equal(f.popups.length,0);groups++;
}
{
 const f=fixture();let rejectMarker=true;f.hooks.set=async path=>{if(rejectMarker&&path.includes('/meta/claimed/'))throw Error('Fixture marker unavailable');};
 const first=await f.c.autoClaimPrize();assert.equal(first.claimed,true);assert.equal(f.credits(),1);assert.equal(f.read('tournaments/'+f.week+'/meta/claimed/alice'),null);
 rejectMarker=false;const again=await f.c.autoClaimPrize();assert.equal(again.claimed,false);assert.equal(again.alreadyClaimed,true);assert.equal(f.credits(),1);
 assert.equal(f.read('tournaments/'+f.week+'/meta/claimed/alice'),true);
 assert.equal(Object.keys(f.data.achWall).length,1,'reconciliation overwrites same social-wall card');assert.equal(f.popups.length,1,'reconciliation does not repeat fresh-win celebration');groups++;
}
{
 const f=fixture();f.hooks.claim=async()=>({claimed:true,amount:4321});
 const result=await f.c.autoClaimPrize();assert.equal(result.prize,4321);assert.deepEqual(f.popups,[[1,4321]],'celebration uses acknowledged amount');assert.equal(f.data.achWall,undefined,'different historical prize does not invent current-rank wall achievement');groups++;
}
{
 const f=fixture();let release;f.hooks.claim=()=>new Promise(resolve=>release=resolve);
 const first=f.c.autoClaimPrize();while(!release)await Promise.resolve();
 const second=await f.c.autoClaimPrize();assert.equal(second.pending,true);assert.equal(f.calls.length,1);
 release({claimed:true,amount:5000});assert.equal((await first).claimed,true);assert.equal(f.popups.length,1);groups++;
}
{
 const f=fixture();f.write('tournaments/'+f.week+'/meta/claimed/alice',true);
 const result=await f.c.autoClaimPrize();assert.equal(result.alreadyClaimed,true);assert.equal(result.legacy,true);assert.equal(f.calls.length,0,'legacy payment marker is not automatically repaid');groups++;
}
{
 const f=fixture();f.hooks.get=async path=>{if(path.endsWith('/scores'))throw Error('Fixture leaderboard denied');};
 const result=await f.c.autoClaimPrize();assert.equal(result.reason,'unavailable');assert.equal(f.calls.length,0);assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();let release;f.hooks.get=path=>path.includes('/heroRewardClaims/')?new Promise(resolve=>release=resolve):undefined;
 const p=f.c.hasPendingPrize();await Promise.resolve();f.setUid('bob');release();assert.equal(await p,false);assert.equal(f.gets.length,1);groups++;
}
{
 const f=fixture();const panel={};f.elements.set('trnOv',panel);let reopened=0;f.c.openTournament=()=>reopened++;
 await f.c.claimPrize();assert.equal(f.timers.length,1);f.elements.delete('trnOv');f.timers[0]();assert.equal(reopened,0,'a completed award does not reopen a closed panel');groups++;
}
{
 const f=fixture();let release;f.hooks.get=path=>path.endsWith('/scores')?new Promise(resolve=>release=resolve):undefined;
 const p=f.c.openTournament();await Promise.resolve();f.setUid('bob');release();await p;assert.equal(f.body.innerHTML,'loading','late old-account leaderboard cannot render a new account view');assert.equal(f.gets.length,1);groups++;
}
console.log(`PASS tournament Kaju v155: ${groups} safe score, receipt, identity, recovery, actual amount and panel lifecycle groups`);
