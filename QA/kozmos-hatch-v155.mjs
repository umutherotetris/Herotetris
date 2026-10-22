// Exercise real hatch/type/phase source against a serial, fault-injected DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=fs.readFileSync(new URL('../js/kozmos.js',import.meta.url),'utf8');
const between=(start,end)=>{const a=file.indexOf(start),b=file.indexOf(end,a);assert.ok(a>=0&&b>a,start);return file.slice(a,b);};
const source=[between('const PHASE_HOURS=','// ── Yaratık türleri'),between('const TYPES={','// ── Birleştirme tablosu'),
  between('export function randomType(','// ── SVG Yumurta'),between('// Hatch consumes an authoritative egg','// ── 💥 Birleştirme Seçici')]
  .join('\n').replace(/export /g,'')+'\nglobalThis.api={hatchKozmoEgg,hatchEgg};';
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const snap=value=>{const saved=clone(value??null);return {val:()=>clone(saved),exists:()=>saved!==null};};
function backend(){
  const data={kozmos:{alice:{eggs:{},creatures:{},giftAcceptanceClaims:{prior:{eggId:'prior'}},rewardEggClaims:{prior:{ts:1}}}}};
  const hooks={},writes=[],transactions=[];let tail=Promise.resolve();
  const read=path=>path.split('/').reduce((v,k)=>v?.[k],data)??null;
  const put=(path,value)=>{const keys=path.split('/'),last=keys.pop();let node=data;for(const k of keys)node=node[k]??={};if(value===null)delete node[last];else node[last]=clone(value);writes.push({path,value:clone(value)});};
  const fdb={ref:(_db,path)=>path,get:async path=>{await hooks.beforeGet?.(path);const result=snap(read(path));await hooks.afterGet?.(path);return result;},
    runTransaction:async(path,update,options)=>{
      assert.equal(options?.applyLocally,false);transactions.push(path);await hooks.beforeTx?.(path);
      const job=tail.then(()=>{if(hooks.coldFirst)update(null);const next=update(clone(read(path)));if(next===undefined)return {committed:false,snapshot:snap(read(path))};put(path,next);return {committed:true,snapshot:snap(next)};});
      tail=job.catch(()=>{});const result=await job;await hooks.afterTx?.(path,result);return result;
    }};
  return {data,hooks,writes,transactions,fdb,read,put};
}
function app(b){
  let uid='alice';const toasts=[],effects=[],confirmations=[];
  const state=()=>({uid,status:uid?'google':'guest'});
  const context=vm.createContext({Auth:{getState:state},db:{},fdb:b.fdb,_eggGiftOwner:owner=>!!owner&&owner===uid,
    _noUndef:clone,_toast:text=>toasts.push(text),confirm:text=>{confirmations.push(text);return true;},
    sfxCrack:()=>effects.push('crack'),sfxHatch:()=>effects.push('hatch'),sfxChirp:()=>effects.push('chirp'),feedAnim:()=>effects.push('animation'),
    renderKozmos:async()=>effects.push('render'),setTimeout:()=>{},console});
  vm.runInContext(source,context,{filename:'kozmos-hatch-functions.js'});
  return {...context.api,setAccount:next=>{uid=next;},toasts,effects,confirmations};
}
const mature=(b,id='egg_paid',extra={})=>{const egg={id,seed:501,acceptedAt:Date.now()-121*3600000,ownerId:'alice',feedCount:0,source:'shop',...extra};b.put('kozmos/alice/eggs/'+id,egg);return egg;};
const creatures=b=>Object.values(b.read('kozmos/alice/creatures')||{});
const claims=b=>Object.values(b.read('kozmos/alice/hatchClaims')||{});
const deny=()=>Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
let groups=0;

// A hatch has exactly one atomic root write; unrelated acceptance/reward
// receipts and other eggs survive it.
{
  const b=backend(),a=app(b);mature(b);mature(b,'other');const before=b.writes.length;
  const result=await a.hatchKozmoEgg('egg_paid');assert.equal(result.ok,true);assert.equal(result.creatureId,'cre_hatch_egg_paid');
  assert.equal(b.read('kozmos/alice/eggs/egg_paid'),null);assert.ok(b.read('kozmos/alice/eggs/other'));assert.equal(creatures(b).length,1);assert.equal(claims(b).length,1);
  assert.equal(b.writes.length-before,1);assert.equal(b.writes.at(-1).path,'kozmos/alice');assert.ok(b.read('kozmos/alice/giftAcceptanceClaims/prior'));assert.ok(b.read('kozmos/alice/rewardEggClaims/prior'));groups++;
}

// Rejection leaves the egg intact and creates no creature; retry succeeds.
{
  const b=backend(),a=app(b);mature(b);b.hooks.beforeTx=()=>{throw deny();};
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,false);assert.ok(b.read('kozmos/alice/eggs/egg_paid'));assert.equal(creatures(b).length,0);
  delete b.hooks.beforeTx;assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,true);assert.equal(creatures(b).length,1);groups++;
}

// Commit-before-ack failure is reconciled from its receipt. Retrying after the
// creature was deleted/fused never recreates it or charges/consumes anything.
{
  const b=backend(),a=app(b);mature(b);let failed=false;
  b.hooks.afterTx=(_path,result)=>{if(result.committed&&!failed){failed=true;throw new Error('lost ack');}};
  const result=await a.hatchKozmoEgg('egg_paid');assert.equal(result.ok,true);assert.equal(result.alreadyHatched,true);assert.equal(creatures(b).length,1);
  b.put('kozmos/alice/creatures/'+result.creatureId,null);delete b.hooks.afterTx;
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,true);assert.equal(creatures(b).length,0);assert.equal(claims(b).length,1);groups++;
}

// If both the acknowledgement and receipt read fail, a later reload still
// reconciles the same consumed egg rather than generating another creature.
{
  const b=backend(),a=app(b);mature(b);
  b.hooks.afterTx=(_path,result)=>{if(result.committed)throw new Error('lost ack');};
  b.hooks.beforeGet=path=>{if(path.includes('/hatchClaims/'))throw new Error('offline');};
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,false);assert.equal(creatures(b).length,1);delete b.hooks.afterTx;delete b.hooks.beforeGet;
  assert.equal((await app(b).hatchKozmoEgg('egg_paid')).ok,true);assert.equal(creatures(b).length,1);groups++;
}

// Same-tab duplicates and competing tabs mint one deterministic creature.
{
  const b=backend(),a=app(b),other=app(b);mature(b);
  const results=await Promise.all([a.hatchKozmoEgg('egg_paid'),a.hatchKozmoEgg('egg_paid'),other.hatchKozmoEgg('egg_paid')]);
  assert.ok(results.every(result=>result.ok));assert.equal(creatures(b).length,1);assert.equal(claims(b).length,1);groups++;
}

// Readiness and ownership come from the current stored egg, so a stale UI or
// an early call cannot hatch an immature or differently owned egg.
{
  const b=backend(),a=app(b);const egg=mature(b,'egg_paid',{acceptedAt:Date.now(),feedCount:0});
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,false);assert.ok(b.read('kozmos/alice/eggs/egg_paid'));assert.equal(creatures(b).length,0);
  b.put('kozmos/alice/eggs/egg_paid',{...egg,feedCount:15});assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,true);
  mature(b,'other',{ownerId:'bob'});assert.equal((await a.hatchKozmoEgg('other')).ok,false);assert.ok(b.read('kozmos/alice/eggs/other'));groups++;
}

// A malformed ID/clock/feed count and a missing egg produce no root grant.
{
  const b=backend(),a=app(b);mature(b,'bad_feed',{feedCount:-1});mature(b,'bad_clock',{acceptedAt:0});
  for(const id of ['../escape','missing','bad_feed','bad_clock'])assert.equal((await a.hatchKozmoEgg(id)).ok,false);
  assert.equal(creatures(b).length,0);assert.equal(claims(b).length,0);groups++;
}

// A null first transaction callback is harmless; the authoritative callback
// preserves other eggs and receipts and still consumes exactly the target.
{
  const b=backend(),a=app(b);mature(b);mature(b,'other');b.hooks.coldFirst=true;
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,true);assert.equal(creatures(b).length,1);assert.ok(b.read('kozmos/alice/eggs/other'));assert.ok(b.read('kozmos/alice/rewardEggClaims/prior'));groups++;
}

// Stored legacy wheel types are retained. Modern rarity floors, zero seeds,
// and legacy eggs lacking a seed all produce repeatable results.
{
  const b=backend(),a=app(b);mature(b,'stored',{type:{key:'peri_ruhu'}});mature(b,'minimum',{minRarity:'legendary',seed:0});mature(b,'legacy',{seed:null});
  assert.equal((await a.hatchKozmoEgg('stored')).ok,true);assert.equal(b.read('kozmos/alice/creatures/cre_hatch_stored/typeKey'),'peri_ruhu');
  assert.equal((await a.hatchKozmoEgg('minimum')).ok,true);assert.ok(['legendary','mythical'].includes(b.read('kozmos/alice/creatures/cre_hatch_minimum/rarity')));
  const first=await a.hatchKozmoEgg('legacy');assert.equal(first.ok,true);const type=b.read('kozmos/alice/creatures/cre_hatch_legacy/typeKey');
  assert.equal((await a.hatchKozmoEgg('legacy')).receipt.typeKey,type);groups++;
}

// The account guard applies before reservation, inside the transaction, after
// commit and before success effects. No new account receives a stale hatch.
{
  const b=backend(),a=app(b),egg=mature(b);b.hooks.beforeTx=()=>a.setAccount('bob');
  assert.equal((await a.hatchKozmoEgg('egg_paid')).ok,false);assert.equal(creatures(b).length,0);assert.ok(b.read('kozmos/alice/eggs/egg_paid'));
  delete b.hooks.beforeTx;a.setAccount('alice');b.hooks.afterTx=(_path,result)=>{if(result.committed)a.setAccount('bob');};
  assert.equal((await a.hatchEgg('egg_paid',egg,{uid:'alice'},{isConnected:true})),undefined);
  assert.equal(creatures(b).length,1);assert.equal(b.read('kozmos/bob'),null);assert.equal(a.effects.length,0);assert.equal(a.toasts.length,0);groups++;
}

// The UI lock remains held for the full pending operation and permits only one
// confirmation, rather than expiring while a slow server write is in flight.
{
  const b=backend(),a=app(b),egg=mature(b);let release,entered;const gate=new Promise(resolve=>{release=resolve;}),ready=new Promise(resolve=>{entered=resolve;});
  b.hooks.beforeTx=async()=>{entered();await gate;};
  const first=a.hatchEgg('egg_paid',egg,{uid:'alice'},{isConnected:true});await ready;
  await a.hatchEgg('egg_paid',egg,{uid:'alice'},{isConnected:true});assert.equal(a.confirmations.length,1);
  release();await first;assert.equal(creatures(b).length,1);assert.equal(a.effects.filter(effect=>effect==='animation').length,1);groups++;
}

console.log(`PASS ${groups} Kozmos hatch regression groups`);
