// Fault-injection regressions for the real Kozmos gift send/accept functions.
// No Firebase/network access or real wallets are used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file=fs.readFileSync(new URL('../js/kozmos.js',import.meta.url),'utf8');
const start=file.indexOf('// ── Yumurta gönder (arkadaş profilinden)');
const end=file.indexOf('// ── Kozmos Paneli',start);
assert.ok(start>=0&&end>start,'Gift source boundaries must exist');
const source=file.slice(start,end).replace(/export /g,'')+'\nglobalThis.api={sendEgg,retryEggGifts,acceptEggGift,rejectEggGift:_rejectEggGift};';
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const snap=value=>{const fixed=clone(value??null);return {val:()=>clone(fixed),exists:()=>fixed!==null};};
const day=()=>new Date().toISOString().slice(0,10);
function backend(paid=false){
  const data={users:{alice:{kaju:500,heroWalletRevision:3,...(paid?{heroEggGiftFreeDay:day()}:{} )},bob:{kaju:10},carol:{kaju:20}}};
  const hooks={},writes=[],transactions=[];let tail=Promise.resolve(),serial=0;
  const read=path=>path.split('/').reduce((v,k)=>v?.[k],data)??null;
  const put=(path,value)=>{
    const keys=path.split('/'),last=keys.pop();let node=data;
    for(const key of keys)node=node[key]??=( {} );
    if(value===null)delete node[last];else node[last]=clone(value);
    writes.push({path,value:clone(value)});
  };
  const fdb={
    ref:(_db,path)=>path,
    push:()=>({key:'push_'+(++serial)}),
    get:async path=>{await hooks.beforeGet?.(path);const result=snap(read(path));await hooks.afterGet?.(path,result);return result;},
    set:async(path,value)=>{await hooks.beforeSet?.(path,value);put(path,value);},
    runTransaction:async(path,update,options)=>{
      assert.equal(options?.applyLocally,false,'Gift transactions must not apply optimistic financial/grant state');
      transactions.push(path);await hooks.beforeTx?.(path);
      const job=tail.then(()=>{const next=update(clone(read(path)));if(next===undefined)return {committed:false,snapshot:snap(read(path))};put(path,next);return {committed:true,snapshot:snap(next)};});
      tail=job.catch(()=>{});const result=await job;await hooks.afterTx?.(path,result);return result;
    }
  };
  return {data,hooks,writes,transactions,fdb,read,put};
}
function app(b,uid='alice'){
  let state={uid,status:'google',displayName:uid,profile:{avatar:'A'}};
  const spending=[],toasts=[],confirmations=[];
  const context=vm.createContext({Auth:{getState:()=>state},db:{},fdb:b.fdb,Store:{logSpend:(...args)=>spending.push(args)},
    _noUndef:clone,_toast:(...args)=>toasts.push(args),confirm:text=>{confirmations.push(text);return true;},console});
  vm.runInContext(source,context,{filename:'kozmos-gift-functions.js'});
  return {...context.api,spending,toasts,confirmations,setAccount:next=>{state={uid:next,status:next?'google':'guest',displayName:next,profile:{}};}};
}
const gifts=b=>Object.values(b.read('users/alice/heroEggGifts')||{});
const pending=(b,uid='bob')=>Object.entries(b.read('kozmoPending/'+uid)||{}).filter(([,v])=>v?.status==='pending');
const eggs=(b,uid='bob')=>Object.values(b.read('kozmos/'+uid+'/eggs')||{});
const deny=()=>Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
let groups=0;

// A free gift is reserved on the account, and a later pair of paid gifts from
// the same sender cannot overwrite the first pending gift.
{
  const b=backend(),a=app(b);
  assert.equal((await a.sendEgg('bob','Bob')).ok,true);
  assert.equal(b.read('users/alice/kaju'),500);assert.equal(b.read('users/alice/heroEggGiftFreeDay'),day());
  assert.equal(a.spending.length,0);assert.equal(a.confirmations.length,0);
  assert.equal((await a.sendEgg('bob','Bob')).ok,true);assert.equal((await a.sendEgg('bob','Bob')).ok,true);
  assert.equal(b.read('users/alice/kaju'),400);assert.equal(b.read('users/alice/heroWalletRevision'),5);
  assert.equal(pending(b).length,3);assert.equal(gifts(b).length,3);assert.equal(a.spending.length,2);
  assert.equal(Object.keys(b.read('userNotifs/bob')).length,3);groups++;
}

// Invalid recipients, guest accounts, and an insufficient authoritative wallet
// do not create a grant or debit, even when a local display would be stale.
{
  const b=backend(true),a=app(b);b.put('users/alice/kaju',49);
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);
  assert.equal((await a.sendEgg('alice','Alice')).ok,false);assert.equal((await a.sendEgg('../bad','Bad')).ok,false);
  assert.equal((await a.sendEgg('missing','Missing')).ok,false);a.setAccount(null);
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);
  assert.equal(b.read('users/alice/kaju'),49);assert.equal(gifts(b).length,0);assert.equal(pending(b).length,0);groups++;
}

// A rejected reservation is not followed by a cross-user write.
{
  const b=backend(true),a=app(b);b.hooks.beforeTx=path=>{if(path==='users/alice')throw deny();};
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);assert.equal(b.read('users/alice/kaju'),500);
  assert.equal(gifts(b).length,0);assert.equal(pending(b).length,0);groups++;
}

// Delivery failure retains the paid intent. A reload retries the same gift,
// without charging or consuming another daily right.
{
  const b=backend(true),a=app(b);b.hooks.beforeTx=path=>{if(path==='kozmoPending/bob')throw deny();};
  const first=await a.sendEgg('bob','Bob');assert.equal(first.ok,false);assert.equal(first.pending,true);
  assert.equal(b.read('users/alice/kaju'),450);assert.equal(gifts(b)[0].status,'pending');assert.equal(pending(b).length,0);
  delete b.hooks.beforeTx;const reloaded=app(b);assert.equal((await reloaded.retryEggGifts())[0].ok,true);
  assert.equal(b.read('users/alice/kaju'),450);assert.equal(gifts(b).length,1);assert.equal(pending(b).length,1);assert.equal(reloaded.spending.length,0);groups++;
}

// A reserve acknowledgement can fail after the debit committed. Confirming
// the durable journal completes this very gift rather than creating a new one.
{
  const b=backend(true),a=app(b);let failed=false;
  b.hooks.afterTx=(path,result)=>{if(path==='users/alice'&&result.committed&&!failed){failed=true;throw new Error('lost reserve ack');}};
  assert.equal((await a.sendEgg('bob','Bob')).ok,true);assert.equal(b.read('users/alice/kaju'),450);
  assert.equal(gifts(b).length,1);assert.equal(pending(b).length,1);groups++;
}

// If publication committed but its acknowledgement was lost, the recipient
// may accept/delete before sender recovery. The inbox tombstone prevents replay.
{
  const b=backend(true),a=app(b);let failed=false;
  b.hooks.afterTx=(path,result)=>{if(path==='kozmoPending/bob'&&result.committed&&!failed){failed=true;throw new Error('lost delivery ack');}};
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);assert.equal(pending(b).length,1);delete b.hooks.afterTx;
  const bob=app(b,'bob'),[key,gift]=pending(b)[0];assert.equal((await bob.acceptEggGift(key,gift)).ok,true);
  for(const egg of eggs(b))b.put('kozmos/bob/eggs/'+egg.id,null);
  assert.equal((await a.retryEggGifts())[0].ok,true);assert.equal(pending(b).length,0);assert.equal(eggs(b).length,0);
  assert.equal(b.read('users/alice/kaju'),450);assert.equal(gifts(b)[0].status,'complete');groups++;
}

// Sender completion failure after a confirmed delivery also recovers without
// reintroducing an accepted gift or making a second debit.
{
  const b=backend(true),a=app(b);b.hooks.beforeTx=path=>{if(path.startsWith('users/alice/heroEggGifts/'))throw deny();};
  const result=await a.sendEgg('bob','Bob');assert.equal(result.ok,true);assert.equal(result.pending,true);
  const bob=app(b,'bob'),[key,gift]=pending(b)[0];assert.equal((await bob.acceptEggGift(key,gift)).ok,true);
  delete b.hooks.beforeTx;await a.retryEggGifts();assert.equal(pending(b).length,0);assert.equal(eggs(b).length,1);
  assert.equal(Object.keys(b.read('userNotifs/bob')).length,1);assert.equal(b.read('users/alice/kaju'),450);groups++;
}

// The same recipient in the same tab shares a busy promise. Concurrent tabs
// additionally discover and reuse the persisted pending reservation.
{
  const b=backend(true),a=app(b),other=app(b);b.hooks.beforeTx=path=>{if(path==='kozmoPending/bob')throw deny();};
  const results=await Promise.all([a.sendEgg('bob','Bob'),a.sendEgg('bob','Bob'),other.sendEgg('bob','Bob')]);
  assert.equal(results.length,3);assert.equal(b.read('users/alice/kaju'),450);assert.equal(gifts(b).length,1);
  delete b.hooks.beforeTx;assert.equal((await a.sendEgg('bob','Bob')).ok,true);assert.equal(b.read('users/alice/kaju'),450);assert.equal(pending(b).length,1);groups++;
}

// Two tabs observing an unused free day may race. Exactly one reservation is
// free; the loser is not silently converted into an unapproved paid purchase.
{
  const b=backend(),a=app(b),other=app(b);
  const results=await Promise.all([a.sendEgg('bob','Bob'),other.sendEgg('carol','Carol')]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(gifts(b).length,1);
  assert.equal(b.read('users/alice/kaju'),500);assert.equal(pending(b,'bob').length+pending(b,'carol').length,1);groups++;
}

// Switching accounts before reservation, and immediately after debit, never
// gives the new account a grant or starts delivery under its identity.
{
  const b=backend(true),a=app(b);b.hooks.beforeTx=path=>{if(path==='users/alice')a.setAccount('carol');};
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);assert.equal(b.read('users/alice/kaju'),500);assert.equal(pending(b).length,0);
  delete b.hooks.beforeTx;a.setAccount('alice');b.hooks.afterTx=(path,result)=>{if(path==='users/alice'&&result.committed)a.setAccount('carol');};
  assert.equal((await a.sendEgg('bob','Bob')).ok,false);assert.equal(b.read('users/alice/kaju'),450);assert.equal(pending(b).length,0);
  assert.equal(b.read('users/carol/heroEggGifts'),null);assert.equal(a.spending.length,0);
  delete b.hooks.afterTx;a.setAccount('alice');await a.retryEggGifts();assert.equal(pending(b).length,1);assert.equal(b.read('users/alice/kaju'),450);groups++;
}

// A failing notification is secondary to confirmed gift delivery.
{
  const b=backend(true),a=app(b);b.hooks.beforeSet=path=>{if(path.startsWith('userNotifs/'))throw deny();};
  assert.equal((await a.sendEgg('bob','Bob')).ok,true);assert.equal(gifts(b)[0].status,'complete');assert.equal(pending(b).length,1);groups++;
}

function incoming(b,key='legacy_alice',extra={}){
  const gift={fromUid:'alice',fromName:'Alice',toUid:'bob',toName:'Bob',sentAt:1720000000000,seed:997,status:'pending',minRarity:'legendary',...extra};
  b.put('kozmoPending/bob/'+key,gift);return [key,gift];
}

// A grant and its acceptance receipt commit atomically. Failed pending cleanup
// leaves a retryable row without minting a second egg or resetting feedCount.
{
  const b=backend(),bob=app(b,'bob'),[key,gift]=incoming(b);
  b.hooks.beforeTx=path=>{if(path==='kozmoPending/bob/'+key)throw deny();};
  const accepted=await bob.acceptEggGift(key,gift);assert.equal(accepted.ok,true);assert.equal(accepted.pendingCleanup,true);
  assert.equal(eggs(b).length,1);assert.equal(eggs(b)[0].minRarity,'legendary');assert.equal(eggs(b)[0].seed,997);
  b.put('kozmos/bob/eggs/'+accepted.eggId+'/feedCount',2);assert.equal((await bob.acceptEggGift(key,gift)).ok,true);
  assert.equal(eggs(b).length,1);assert.equal(eggs(b)[0].feedCount,2);
  delete b.hooks.beforeTx;assert.equal((await bob.acceptEggGift(key,gift)).ok,true);assert.equal(pending(b).length,0);groups++;
}

// Accept acknowledgement loss and retry after consuming the egg cannot mint
// another copy. Rejecting a leftover row also preserves its acceptance receipt.
{
  const b=backend(),bob=app(b,'bob'),[key,gift]=incoming(b);let failed=false;
  b.hooks.afterTx=(path,result)=>{if(path==='kozmos/bob'&&result.committed&&!failed){failed=true;throw new Error('lost accept ack');}};
  assert.equal((await bob.acceptEggGift(key,gift)).ok,false);assert.equal(eggs(b).length,1);
  const id=eggs(b)[0].id;b.put('kozmos/bob/eggs/'+id,null);delete b.hooks.afterTx;
  assert.equal((await bob.acceptEggGift(key,gift)).ok,true);assert.equal(eggs(b).length,0);assert.equal(pending(b).length,0);
  incoming(b,key);assert.equal(await bob.rejectEggGift(key,gift,'bob'),true);
  assert.equal(Object.keys(b.read('kozmos/bob/giftAcceptanceClaims')).length,1);assert.equal(eggs(b).length,0);groups++;
}

// Existing shop gifts preserve their minRarity/type. A second legacy gift on
// the reused sender key gets a new receipt based on immutable payload identity.
{
  const b=backend(),bob=app(b,'bob');let [key,gift]=incoming(b,'shop_p_123_0',{type:{key:'special'},source:'gift'});
  assert.equal((await bob.acceptEggGift(key,gift)).ok,true);assert.equal(eggs(b)[0].type.key,'special');assert.equal(eggs(b)[0].minRarity,'legendary');
  [key,gift]=incoming(b,'legacy_alice');assert.equal((await bob.acceptEggGift(key,gift)).ok,true);
  [key,gift]=incoming(b,'legacy_alice',{sentAt:1720000000001,seed:998});assert.equal((await bob.acceptEggGift(key,gift)).ok,true);
  assert.equal(eggs(b).length,3);assert.equal(Object.keys(b.read('kozmos/bob/giftAcceptanceClaims')).length,3);groups++;
}

// Account changes block acceptance and cleanup; a replaced legacy pending
// record is never deleted using a stale panel's identity.
{
  const b=backend(),bob=app(b,'bob'),[key,gift]=incoming(b);
  b.hooks.beforeTx=path=>{if(path==='kozmos/bob')bob.setAccount('carol');};
  assert.equal((await bob.acceptEggGift(key,gift)).ok,false);assert.equal(eggs(b).length,0);assert.equal(pending(b).length,1);
  delete b.hooks.beforeTx;bob.setAccount('bob');incoming(b,key,{sentAt:gift.sentAt+1});
  assert.equal((await bob.acceptEggGift(key,gift)).ok,false);assert.equal(await bob.rejectEggGift(key,gift,'bob'),false);assert.equal(pending(b).length,1);groups++;
}

console.log(`PASS ${groups} Kozmos gift regression groups`);
