// Actual moderation exports in an isolated RTDB fixture; no production accounts,
// notifications, credentials, administrative actions or network are used.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/moderation.js',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;?$/gm,'').replace(/^export \{.*\};$/gm,'').replace(/^export /gm,'');
const clone=value=>value==null?null:structuredClone(value);
const snap=value=>({exists:()=>value!=null,val:()=>clone(value)});
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture({admin=true,operator=false}={}){
 const data={admins:admin?{actor:true}:{},gcOperators:operator?{actor:true}:{},users:{actor:{nick:'Actor'},target:{nick:'Target',kaju:100,lastIP:'192.0.2.3'},other:{nick:'Other'}},presence:{target:{online:true,lastSeen:Date.now()}}};
 let actor={uid:'actor',status:'google',isAdmin:admin,displayName:'Actor'},queue=Promise.resolve();
 const writes=[],listeners=[],calls=[],hooks={beforeGet:null,beforeTx:null,afterTx:null,beforeSet:null,beforeUpdate:null};
 const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)??null;
 const emit=path=>{for(const listener of [...listeners])if(listener.active&&(listener.path===path||path.startsWith(listener.path+'/')||listener.path.startsWith(path+'/')))listener.fn(snap(read(listener.path)));};
 const put=(path,value,record=true)=>{const parts=path.split('/').filter(Boolean);let at=data;for(const part of parts.slice(0,-1))at=at[part]??={};if(value===null)delete at[parts.at(-1)];else at[parts.at(-1)]=clone(value);if(record)writes.push({path,value:clone(value)});emit(path);};
 const fdb={ref:(_,path='')=>path,
  get:async path=>{calls.push(['get',path]);if(hooks.beforeGet)await hooks.beforeGet(path);return snap(read(path));},
  set:async(path,value)=>{calls.push(['set',path]);if(hooks.beforeSet)await hooks.beforeSet(path,value);put(path,value);},
  update:async(path,patch)=>{calls.push(['update',path,clone(patch)]);if(hooks.beforeUpdate)await hooks.beforeUpdate(path,patch);for(const[key,value]of Object.entries(patch))put(path?path+'/'+key:key,value);},
  runTransaction:(path,change,options)=>{assert.equal(options.applyLocally,false);const run=queue.then(async()=>{if(hooks.beforeTx)await hooks.beforeTx(path);const next=change(clone(read(path)));if(next===undefined)return{committed:false,snapshot:snap(read(path))};put(path,next);return{committed:true,snapshot:snap(next)};});queue=run.catch(()=>{});return run.then(async result=>{if(hooks.afterTx)await hooks.afterTx(path,result);return result;});},
  onValue:(path,fn,error)=>{const listener={path,fn,error,active:true};listeners.push(listener);fn(snap(read(path)));return()=>listener.active=false;}};
 const context=vm.createContext({Auth:{getState:()=>actor},db:{},fdb,Date,Math,Number,Object,Array,Set,Promise});
 vm.runInContext(source+'\nthis.M={globalBan,globalUnban,globalMute,globalUnmute,globalKick,chatKick,makeOperator,removeOperator,getUserIP,ipBan,ipUnban,isEffectiveAdmin};',context);
 return{M:context.M,data,hooks,writes,calls,listeners,read,put,setAuth:fields=>actor={...actor,...fields}};
}
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS',name);}
await test('authoritative cached-role loss and invalid identity/path inputs never mutate',async()=>{
 const f=fixture();f.put('admins/actor',null,false);
 assert.equal(await f.M.globalBan('target','Target','Reason'),false);assert.equal((await f.M.globalKick('target','Target')).ok,false);assert.equal(f.data.users.target.banned,undefined);
 const g=fixture();for(const uid of ['',null,'target/other','bad.key','bad\nkey',{}]){assert.equal(await g.M.globalBan(uid,'Target'),false);assert.equal((await g.M.ipBan(uid,'Target')).ok,false);}
 assert.equal(g.writes.length,0);g.setAuth({uid:'actor',status:'offline'});assert.equal(await g.M.globalMute('target','Target','Reason',30),false);
});
await test('admin mutation fields are compatible, existing wallet/receipts remain and missing targets are never created',async()=>{
 const f=fixture();f.data.users.target.heroRewardClaims={daily:{amount:10}};
 assert.equal(await f.M.globalBan('target','Target','Rule'),true);const p=f.data.users.target;assert.equal(p.banned,true);assert.equal(p.banType,'perma');assert.equal(p.banMsg,'Rule');assert.equal(p.bannedBy,'actor');assert.equal(p.kaju,100);assert.equal(p.heroRewardClaims.daily.amount,10);
 assert.equal(await f.M.globalUnban('target','Target'),true);assert.equal(p.banned,true,'old snapshots are not reused');assert.equal(f.data.users.target.banned,false);
 assert.equal(await f.M.globalBan('missing','Missing'),false);assert.equal(f.read('users/missing'),null);
});
await test('admin targets and self targeting are protected even with stale profile flags',async()=>{
 const f=fixture();f.data.admins.target=true;
 assert.equal(await f.M.globalMute('target','Target','Rule',30),false);assert.equal((await f.M.globalKick('target','Target')).ok,false);assert.equal(await f.M.removeOperator('target','Target'),false);assert.equal(f.writes.length,0);
 const g=fixture();assert.equal(await g.M.globalBan('actor','Actor'),false);assert.equal((await g.M.chatKick('actor','Actor','Reason',['actor'])).ok,false);assert.equal(g.writes.length,0);
});
await test('authoritative operators may moderate ordinary chat members but cannot perform admin operations or moderate peers',async()=>{
 const f=fixture({admin:false,operator:true});assert.equal(await f.M.globalMute('target','Target','Reason',30),true);assert.equal(await f.M.globalUnmute('target','Target'),true);
 assert.equal(await f.M.globalBan('target','Target'),false);assert.equal((await f.M.globalKick('target','Target')).ok,false);assert.equal(await f.M.makeOperator('target','Target'),false);assert.equal((await f.M.ipBan('target','Target')).ok,false);assert.equal(await f.M.getUserIP('target'),null);
 f.data.gcOperators.other=true;assert.equal(await f.M.globalMute('other','Other','Reason',30),false);
});
await test('account change during target reads prevents all subsequent primary writes',async()=>{
 const f=fixture();f.hooks.beforeGet=path=>{if(path==='users/target')f.setAuth({uid:'other'});};assert.equal(await f.M.globalBan('target','Target'),false);assert.equal(f.writes.length,0);
 const g=fixture();g.hooks.beforeGet=path=>{if(path==='presence/target')g.setAuth({uid:'other'});};assert.equal((await g.M.globalKick('target','Target')).ok,false);assert.equal(g.read('kicks/target'),null);
});
await test('role revoked or target promoted during transaction retry aborts before commit and detaches listeners',async()=>{
 for(const patch of [f=>f.put('admins/actor',null,false),f=>f.put('admins/target',true,false),f=>f.setAuth({isAdmin:false}),f=>f.put('users/target',{deleted:true},false)]){
  const f=fixture();f.hooks.beforeTx=path=>{if(path==='users/target')patch(f);};assert.equal(await f.M.globalMute('target','Target','Rule',30),false);assert.equal(f.data.users.target.muted,undefined);assert.ok(f.listeners.every(listener=>!listener.active));
 }
});
await test('operator role revocation during retry is checked by its live required-role guard',async()=>{
 const f=fixture({admin:false,operator:true});f.hooks.beforeTx=path=>{if(path==='users/target')f.put('gcOperators/actor',null,false);};assert.equal(await f.M.globalUnmute('target','Target'),false);assert.equal(f.data.users.target.muted,undefined);
});
await test('a duplicate caller cannot release another active operation lock',async()=>{
 const f=fixture();let release;f.hooks.beforeTx=path=>path==='users/target'?new Promise(resolve=>release=resolve):undefined;
 const pending=f.M.globalMute('target','Target','Reason',30);await settle();assert.equal(await f.M.globalMute('target','Target','Reason',30),false);assert.equal((await f.M.globalKick('target','Target')).busy,true);assert.equal(f.read('kicks/target'),null);
 release();assert.equal(await pending,true);assert.equal(f.writes.filter(write=>write.path==='users/target').length,1);
});
await test('global kick writes the Auth-consumed kicks path and offline/denied presence never falls through',async()=>{
 const f=fixture();assert.equal((await f.M.globalKick('target','Target','Reason')).ok,true);assert.equal(f.read('kicks/target').by,'actor');assert.equal(f.data.users.target.kickSignal,undefined);
 const g=fixture();g.data.presence.target.lastSeen=Date.now()-180001;const stale=await g.M.globalKick('target','Target');assert.equal(stale.notOnline,true);assert.equal(g.read('kicks/target'),null);
 const h=fixture();h.hooks.beforeGet=path=>{if(path==='presence/target')throw new Error('Denied');};assert.equal((await h.M.globalKick('target','Target')).ok,false);assert.equal(h.read('kicks/target'),null);
});
await test('chat kick writes observed kicked state and secondary failures do not masquerade as primary failure',async()=>{
 const f=fixture();f.hooks.beforeSet=path=>{if(path.startsWith('userNotifs/')||path.startsWith('globalChat/')||path.startsWith('adminLog/'))throw new Error('Secondary denied');};
 const result=await f.M.chatKick('target','<Target>','Reason',['target','other']);assert.equal(result.ok,true);assert.equal(f.data.users.target.kicked,true);assert.equal(f.data.users.target.chatKick.by,'actor');
 const g=fixture();assert.equal((await g.M.chatKick('target','Target','Reason',[])).notPresent,true);assert.equal(g.data.users.target.kicked,undefined);
});
await test('notification failure after ban/unban/mute does not erase a confirmed primary result',async()=>{
 const f=fixture();f.hooks.beforeSet=()=>{throw new Error('Secondary denied');};assert.equal(await f.M.globalBan('target','Target','Rule'),true);assert.equal(f.data.users.target.banned,true);assert.equal(await f.M.globalUnban('target','Target'),true);assert.equal(f.data.users.target.banned,false);assert.equal(await f.M.globalMute('target','Target','Rule',30),true);
});
await test('lost profile acknowledgement reconciles its own atomic moderation receipt',async()=>{
 const f=fixture();let once=true;f.hooks.afterTx=(path,result)=>{if(path==='users/target'&&result.committed&&once){once=false;throw new Error('Ack lost');}};
 assert.equal(await f.M.globalMute('target','Target','Rule',30),true);assert.equal(f.data.users.target.muted,true);assert.equal(Object.keys(f.data.users.target.heroModerationOps).length,1);
});
await test('invalid mute durations and malformed IP values cannot create unsafe fields or paths',async()=>{
 const f=fixture();for(const minutes of [-1,1.5,NaN,Infinity,'30',525601])assert.equal(await f.M.globalMute('target','Target','Rule',minutes),false);
 for(const ip of ['bad/path','999.2.3.4',':::','1:2:3:4:5:6:7:8:','::ffff:300.1.1.1',{},' 192.0.2.3']){f.data.users.target.lastIP=ip;assert.equal((await f.M.ipBan('target','Target')).ok,false);assert.equal(await f.M.getUserIP('target'),null);}
 assert.equal(f.writes.length,0);
});
await test('IP ban commits canonical IP record and user ban through a single atomic root update',async()=>{
 const f=fixture();const result=await f.M.ipBan('target','Target','Rule');assert.equal(result.ok,true);assert.equal(f.read('ipBans/192-0-2-3').targetUid,'target');assert.equal(f.data.users.target.banned,true);assert.equal(f.data.users.target.banSource,'ip');assert.equal(f.data.users.target.banIPKey,'192-0-2-3');
 const updates=f.calls.filter(call=>call[0]==='update');assert.equal(updates.length,1);assert.equal(updates[0][1],'');assert.ok(updates[0][2]['ipBans/192-0-2-3']);assert.equal(updates[0][2]['users/target/banned'],true);
 const g=fixture();g.hooks.beforeUpdate=()=>{throw new Error('Denied');};assert.equal((await g.M.ipBan('target','Target')).ok,false);assert.equal(g.read('ipBans'),null);assert.equal(g.data.users.target.banned,undefined);
});
await test('IPv6 encoding matches Auth and valid IP lookup remains admin restricted',async()=>{
 const f=fixture();f.data.users.target.lastIP='2001:db8::1';assert.equal(await f.M.getUserIP('target'),'2001:db8::1');assert.equal((await f.M.ipBan('target','Target')).ok,true);assert.equal(f.read('ipBans/2001-db8--1').ip,'2001:db8::1');assert.ok(f.listeners.every(listener=>!listener.active));
});
await test('IP unban clears only its own associated portal ban and preserves unrelated global bans',async()=>{
 const f=fixture();await f.M.ipBan('target','Target','IP reason');f.put('ipBans/192_0_2_3',{ip:'192.0.2.3'},false);const result=await f.M.ipUnban('target','Target');assert.equal(result.ok,true);assert.equal(result.accountUnbanned,true);assert.equal(f.read('ipBans/192-0-2-3'),null);assert.equal(f.read('ipBans/192_0_2_3'),null);assert.equal(f.data.users.target.banned,false);
 const g=fixture();g.data.users.target.banned=true;g.data.users.target.banReason='Independent global ban';g.data.ipBans={'192-0-2-3':{ip:'192.0.2.3'}};const unrelated=await g.M.ipUnban('target','Target');assert.equal(unrelated.ok,true);assert.equal(unrelated.accountUnbanned,false);assert.equal(g.data.users.target.banned,true);assert.equal(g.data.users.target.banReason,'Independent global ban');
});
await test('a later global ban, including IP-looking reason text, survives IP unban and IP reban',async()=>{
 const f=fixture();await f.M.ipBan('target','Target','IP reason');await f.M.globalBan('target','Target','IP Ban: independent global decision');
 await f.M.ipUnban('target','Target');assert.equal(f.data.users.target.banned,true);assert.equal(f.data.users.target.banSource,'global');
 await f.M.ipBan('target','Target','Another IP reason');assert.equal(f.data.users.target.banSource,'global');await f.M.ipUnban('target','Target');assert.equal(f.data.users.target.banned,true);
});
await test('lost kick/IP primary replies are marked uncertain while secondary failure still reports success',async()=>{
 const f=fixture();f.hooks.afterTx=(path,result)=>{if(path==='kicks/target'&&result.committed)throw new Error('Ack lost');};const kick=await f.M.globalKick('target','Target');assert.equal(kick.ok,false);assert.equal(kick.uncertain,true);assert.ok(kick.operationId);assert.equal(f.read('kicks/target').by,'actor');
 const g=fixture();g.hooks.beforeUpdate=()=>{throw new Error('Network interrupted');};const ip=await g.M.ipBan('target','Target');assert.equal(ip.ok,false);assert.equal(ip.uncertain,true);assert.ok(ip.operationId);
});
await test('operator changes require target existence/admin authority and abort after revocation',async()=>{
 const f=fixture();assert.equal(await f.M.makeOperator('target','Target'),true);assert.equal(f.data.gcOperators.target,true);assert.equal(await f.M.removeOperator('target','Target'),true);assert.equal(f.data.gcOperators.target,undefined);assert.equal(await f.M.makeOperator('missing','Missing'),false);assert.equal(f.data.gcOperators.missing,undefined);
 const g=fixture();g.hooks.beforeTx=path=>{if(path==='gcOperators/target')g.put('admins/actor',null,false);};assert.equal(await g.M.makeOperator('target','Target'),false);assert.equal(g.data.gcOperators.target,undefined);
});
console.log(`PASS Moderation v156: ${groups} authority, identity, transaction, kick, IP and secondary-failure groups`);
