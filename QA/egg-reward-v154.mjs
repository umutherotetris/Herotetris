// Actual grantEgg against an acknowledged serialized RTDB fixture; no network writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/kozmos.js',import.meta.url),'utf8');
const grant=source.slice(source.indexOf('export async function grantEgg(')).replace(/^export /,'');
const clone=x=>x===undefined?null:structuredClone(x);
function fixture(){
 let uid='alice',profile={creatures:{keep:{name:'Keep'}}},fail=false,defer=false,release;
 const writes=[],reads=[],options=[],calls=[];let queue=Promise.resolve();
 const context=vm.createContext({Auth:{getState:()=>({uid})},db:{},console:{warn:()=>{}},randomType:()=> 'fixture-type',
  fdb:{ref:(_db,path)=>path,
   runTransaction:(path,fn,opts)=>{
    calls.push(path);options.push(opts);
    const job=queue.then(async()=>{
     if(defer)await new Promise(resolve=>release=resolve);
     if(fail)throw Object.assign(Error('Fixture denied'),{code:'PERMISSION_DENIED'});
     const next=fn(clone(profile));
     if(next===undefined)return {committed:false,snapshot:{val:()=>null}}; // cold-abort snapshot is not delivery evidence
     profile=clone(next);writes.push(clone(profile));return {committed:true,snapshot:{val:()=>clone(profile)}};
    });queue=job.catch(()=>{});return job;
   },
   get:async path=>{reads.push(path);if(fail)throw Object.assign(Error('Fixture denied'),{code:'PERMISSION_DENIED'});const id=path.split('/').at(-1);return {exists:()=>!!profile.rewardEggClaims?.[id],val:()=>clone(profile.rewardEggClaims?.[id])};},
   set:async(path,value)=>{if(fail)throw Object.assign(Error('Fixture denied'),{code:'PERMISSION_DENIED'});writes.push({path,value:clone(value)});}
  }
 });vm.runInContext(grant+'\nthis.grant=grantEgg;',context);
 return {context,writes,reads,options,calls,profile:()=>profile,setUid:value=>uid=value,setFail:value=>fail=value,setDefer:value=>defer=value,release:()=>release(),deleteEgg:id=>delete profile.eggs[id]};
}
let groups=0;
{
 const f=fixture(),id='daily_spin_2026-10-22';
 assert.deepEqual(await Promise.all([f.context.grant('alice',id),f.context.grant('alice',id)]),[true,true]);
 assert.equal(f.writes.length,1,'two deliveries create one egg and one durable receipt');
 assert.equal(f.profile().eggs[id].ownerId,'alice');assert.equal(f.profile().rewardEggClaims[id].source,'spin');assert.equal(f.profile().creatures.keep.name,'Keep');
 assert.equal(f.options[0].applyLocally,false);assert.equal(f.reads[0],'kozmos/alice/rewardEggClaims/'+id,'cold duplicate is checked with a confirmed read');groups++;
}
{
 const f=fixture(),id='daily_spin_2026-10-22';await f.context.grant('alice',id);f.deleteEgg(id);
 assert.equal(await f.context.grant('alice',id),true);assert.equal(f.profile().eggs[id],undefined,'a hatched/deleted reward is not resurrected');assert.equal(f.writes.length,1);groups++;
}
{
 const f=fixture();f.setFail(true);await assert.rejects(f.context.grant('alice','daily_spin_2026-10-22'),error=>error.code==='PERMISSION_DENIED');assert.equal(f.writes.length,0);assert.equal(f.profile().rewardEggClaims,undefined);groups++;
}
{
 const f=fixture();f.setFail(true);assert.equal(await f.context.grant(),false,'legacy callers retain boolean failure result');groups++;
}
{
 const f=fixture();f.setUid('bob');assert.equal(await f.context.grant('alice','daily_spin_2026-10-22'),false);assert.equal(f.calls.length,0,'an old owner cannot deliver into the new account');groups++;
}
{
 const f=fixture();for(const id of ['nested/path','bad.key','',{},'x'.repeat(121)])assert.equal(await f.context.grant('alice',id),false);assert.equal(f.calls.length,0);groups++;
}
{
 const f=fixture();f.setDefer(true);let settled=false;const pending=f.context.grant('alice','daily_spin_2026-10-22').then(result=>{settled=true;return result;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(f.writes.length,0);f.release();assert.equal(await pending,true);groups++;
}
{
 const f=fixture();f.setDefer(true);const pending=f.context.grant('alice','daily_spin_2026-10-22');await new Promise(resolve=>setImmediate(resolve));f.setUid('bob');f.release();assert.equal(await pending,false);assert.equal(f.writes.length,0);groups++;
}
console.log(`PASS stable egg reward: ${groups} acknowledgment, cold duplicate, tombstone, rejection and owner groups`);
