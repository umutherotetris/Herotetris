// Actual Kaju gift helper with deterministic delivery; no production writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/notify.js',import.meta.url),'utf8');
const begin=source.indexOf('export async function notifyKajuGift('),end=source.indexOf('// ── SOHBET',begin);
assert.ok(begin>=0 && end>begin);
const code=source.slice(begin,end).replace('export async function','async function');
function fixture(){
 let state={uid:'alice',status:'google',displayName:'Alice'},seq=0,hold=null,reject=false;
 const writes=[],records=new Map(),warnings=[];
 const save=async(path,value)=>{writes.push({path,value:{...value}});if(reject){const e=new Error('Private fixture details');e.code='PERMISSION_DENIED';throw e;}if(hold)await hold();records.set(path,{...value});};
 const c=vm.createContext({Date,Number,String,console:{warn:(...args)=>warnings.push(args)},_me:()=>({...state}),db:{},NOTIF_TYPES:{gift_kaju:{icon:'🎁'}},fdb:{ref:(_,path)=>path,set:save,push:(path,value)=>save(path+'/push-'+(++seq),value)}});
 vm.runInContext(code,c);
 return {c,writes,records,warnings,setState:next=>state={...state,...next},setHold:fn=>hold=fn,setReject:()=>reject=true};
}
let groups=0;
{
 const f=fixture();assert.equal(await f.c.notifyKajuGift('bob',100,'Alice'),true);
 assert.equal(f.writes.length,1);assert.equal(f.writes[0].path,'userNotifs/bob/push-1');
 assert.equal(f.writes[0].value.fromUid,'alice');assert.equal(f.writes[0].value.fromName,'Alice');assert.equal(f.writes[0].value.amount,100);groups++;
}
{
 const f=fixture();for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'100',null])assert.equal(await f.c.notifyKajuGift('bob',value,'Alice','alice'),false);
 assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();for(const target of ['',null,'bad/path','bad.key','bad#key','bad[key]','x'.repeat(129)])assert.equal(await f.c.notifyKajuGift(target,100,'Alice','alice'),false);
 for(const sender of ['old-account','',null,42])assert.equal(await f.c.notifyKajuGift('bob',100,'Alice',sender),false);assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();let release;f.setHold(()=>new Promise(resolve=>release=resolve));
 const p=f.c.notifyKajuGift('bob',100,'Alice','alice','transfer-1');f.setState({uid:'new-account',displayName:'New account'});release();
 assert.equal(await p,true);assert.equal(f.writes[0].value.fromUid,'alice');assert.equal(f.writes[0].value.fromName,'Alice');assert.equal(f.records.size,1);groups++;
}
{
 const f=fixture();assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice','transfer-1'),true);assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice','transfer-1'),true);
 assert.equal(f.records.size,1);assert.equal(f.writes[0].path,'userNotifs/bob/kaju_transfer-1');assert.equal(f.writes[1].path,f.writes[0].path);assert.equal(f.writes[0].value.txId,'transfer-1');groups++;
}
{
 const f=fixture();for(const tx of ['','bad/path','bad.key',null,42,'x'.repeat(181)])assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice',tx),false);
 assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();f.setReject();assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice','transfer-1'),false);assert.equal(f.records.size,0);assert.deepEqual(f.warnings,[['[notify] Kaju gift','PERMISSION_DENIED']]);groups++;
}
{
 const f=fixture();f.setState({uid:null,status:'offline'});assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice'),false);f.setState({uid:'alice',status:'anon'});assert.equal(await f.c.notifyKajuGift('bob',100,'Alice','alice'),false);assert.equal(f.writes.length,0);groups++;
}
console.log(`PASS Kaju notifications v155: ${groups} identity, actual amount, stable transfer, acknowledgement and rejection groups`);
