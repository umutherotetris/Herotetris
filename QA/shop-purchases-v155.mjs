// Exercise the real durable shop implementation against a serialized RTDB fixture.
// No browser sessions, network requests, or production wallet writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/shop-purchases.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
const clone=value=>value===undefined?null:structuredClone(value);
const spec=(extra={})=>({sku:'bundle_mega',price:18000,grants:[{kind:'egg',rarity:'epic',label:'Epik yumurta'},{kind:'kaju',amount:10000,label:'10.000 Kaju'}],...extra});
function fixture(balance=50000){
  let uid='alice',eggFail=false,failPath=null,loseAck=false,pause=false,release,ackMatcher=null,replay=false,failMatcher=null,pauseMatcher=null,creditAmount=null;
  const data={users:{alice:{kaju:balance,heroWalletRevision:7}},shopInventory:{}},writes=[],eggs=[],credits=[],reads=[];
  let queue=Promise.resolve();
  const read=path=>path.split('/').reduce((value,key)=>value?.[key],data);
  const write=(path,value)=>{const parts=path.split('/');let target=data;for(const key of parts.slice(0,-1))target=target[key]??={};target[parts.at(-1)]=clone(value);};
  const snapshot=value=>({exists:()=>value!=null,val:()=>clone(value)});
  const Auth={getState:()=>({uid,status:'google'})};
  const fdb={ref:(_db,path)=>path,get:async path=>{reads.push(path);return snapshot(read(path));},
    runTransaction:(path,fn,options)=>{
      assert.equal(options.applyLocally,false);
      const job=queue.then(async()=>{
        if(pause||pauseMatcher?.(path)){pause=false;pauseMatcher=null;await new Promise(resolve=>release=resolve);}
        if(failPath===path||failMatcher?.(path))throw Object.assign(Error('Fixture denied'),{code:'PERMISSION_DENIED'});
        if(replay)fn(clone(read(path))); // SDK may invoke a pure updater repeatedly before its commit.
        const next=fn(clone(read(path)));
        if(next===undefined)return {committed:false,snapshot:snapshot(null)};
        write(path,next);writes.push({path,value:clone(next)});
        if(ackMatcher?.(path,next)){ackMatcher=null;throw Error('Lost delivery acknowledgement');}
        if(loseAck&&path==='users/alice'&&Object.values(next.heroShopPurchases||{}).some(p=>p.status==='pending')){loseAck=false;throw Error('Lost acknowledgement');}
        return {committed:true,snapshot:snapshot(next)};
      });queue=job.catch(()=>{});return job;
    },
    set:async(path,value)=>{if(failPath===path||failMatcher?.(path))throw Error('Fixture denied');write(path,value);writes.push({path,value:clone(value)});}
  };
  const Store={logSpend:()=>{},claimKajuOnce:async(id,amount,_game,_reason,owner)=>{
    const result=await fdb.runTransaction('users/'+owner,profile=>{
      if(uid!==owner||profile.kajuClaims?.[id])return;
      const credited=creditAmount??amount;
      credits.push(credited);
      return {...profile,kaju:profile.kaju+credited,heroWalletRevision:profile.heroWalletRevision+1,kajuClaims:{...profile.kajuClaims,[id]:{amount:credited}}};
    },{applyLocally:false});
    const receipt=read('users/'+owner+'/kajuClaims/'+id);
    return result.committed?{claimed:true,amount:receipt?.amount}:{alreadyClaimed:!!receipt,amount:receipt?.amount};
  }};
  const grantEgg=async(owner,id,rarity)=>{eggs.push({owner,id,rarity});if(eggFail||uid!==owner)return false;write('kozmos/'+owner+'/eggs/'+id,{id,rarity});return true;};
  const context=()=>{const ctx=vm.createContext({Auth,db:{},fdb,Store,grantEgg,console});vm.runInContext(source+'\nthis.buy=purchaseShopRewards;this.retry=retryShopPurchases;',ctx);return ctx;};
  return {context:context(),other:context,data,writes,eggs,credits,reads,read,write,profile:()=>read('users/alice'),setUid:value=>uid=value,setEggFail:value=>eggFail=value,setFailPath:value=>failPath=value,setFailWhen:fn=>failMatcher=fn,setCreditAmount:value=>creditAmount=value,loseAck:()=>loseAck=true,loseAckWhen:fn=>ackMatcher=fn,replay:value=>replay=value,pause:()=>pause=true,pauseWhen:fn=>pauseMatcher=fn,release:()=>release()};
}
let groups=0;
{
 const f=fixture();const result=await f.context.buy(spec(),'alice');
 assert.equal(result.ok,true);assert.equal(f.profile().kaju,42000,'fixed 10,000 award is not clipped by gameplay cap');
 assert.equal(f.profile().heroWalletRevision,9,'debit and receipt credit both increment shared wallet revision');
 assert.equal(f.eggs.length,1);assert.equal(f.eggs[0].owner,'alice');assert.equal(f.eggs[0].rarity,'epic');assert.match(f.eggs[0].id,/^shop_p_[A-Za-z0-9_]+_0$/);assert.equal(result.purchase.status,'complete');groups++;
}
{
 const f=fixture(1000);assert.equal((await f.context.buy(spec(),'alice')).ok,false);assert.equal(f.profile().kaju,1000);assert.equal(f.writes.length,0);assert.equal(f.eggs.length,0);groups++;
}
{
 const f=fixture();f.setEggFail(true);const first=await f.context.buy(spec(),'alice');
 assert.equal(first.ok,false);assert.equal(first.pending,true);assert.equal(f.profile().kaju,32000);assert.equal(f.credits.length,0,'false delivery never displays/acknowledges egg reward');
 f.setEggFail(false);const second=await f.context.buy(spec({grants:[{kind:'kaju',amount:1,label:'Rerolled'}]}),'alice');
 assert.equal(second.ok,true);assert.equal(second.purchase.id,first.purchase.id);assert.equal(second.purchase.grants[0].kind,'egg','retry preserves chosen reward');assert.equal(f.eggs[0].id,f.eggs[1].id);assert.equal(f.profile().kaju,42000,'retry debits only once');groups++;
}
{
 const f=fixture();f.setEggFail(true);const first=await f.context.buy(spec(),'alice');f.setEggFail(false);
 const results=await f.other().retry('alice');assert.equal(results[0].ok,true);assert.equal(results[0].purchase.id,first.purchase.id);assert.equal(f.profile().kaju,42000,'new module instance resumes durable journal');groups++;
}
{
 const f=fixture();const results=await Promise.all([f.context.buy(spec(),'alice'),f.context.buy(spec(),'alice')]);assert.equal(results[0].purchase.id,results[1].purchase.id);assert.equal(f.profile().kaju,42000);assert.equal(f.credits.length,1);groups++;
}
{
 const f=fixture();f.loseAck();const result=await f.context.buy(spec(),'alice');assert.equal(result.ok,true,'lost debit ack reconciles saved intent');assert.equal(f.profile().kaju,42000);assert.equal(Object.keys(f.profile().heroShopPurchases).length,1);groups++;
}
{
 const f=fixture();f.pause();const pending=f.context.buy(spec(),'alice');await new Promise(resolve=>setImmediate(resolve));f.setUid('bob');f.release();assert.equal((await pending).ok,false);assert.equal(f.profile().kaju,50000);assert.equal(f.eggs.length,0);groups++;
}
{
 const f=fixture();f.setEggFail(true);const first=await f.context.buy(spec(),'alice');f.setUid('bob');assert.equal((await f.context.buy(spec(),'alice')).ok,false);assert.equal((await f.context.retry('alice')).length,0);assert.equal(f.profile().kaju,32000);assert.equal(f.data.users.bob,undefined);assert.equal(f.profile().heroShopPurchases[first.purchase.id].status,'pending');groups++;
}
{
 const f=fixture();const once=spec({sku:'bundle_starter',once:true,grants:[{kind:'item',id:'item_hint',qty:5}]});
 const results=await Promise.all([f.context.buy(once,'alice'),f.other().buy(once,'alice')]);assert.ok(results.every(result=>result.ok));assert.equal(f.profile().kaju,32000);assert.equal(f.profile().inventory.item_hint,5,'profile grant idempotent across tabs');assert.equal(f.profile().purchasedOnce.bundle_starter,true);assert.equal((await f.context.buy(once,'alice')).ok,false);assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();f.setFailPath('shopInventory/alice/ownedItems/th_ocean');const first=await f.context.buy(spec({grants:[{kind:'theme',id:'th_ocean',qty:1}]}),'alice');assert.equal(first.ok,false);assert.equal(f.profile().kaju,32000);f.setFailPath(null);assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.data.shopInventory.alice.ownedItems.th_ocean,true,'bundle cosmetic writes usable shop ownership');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const vipSpec=spec({sku:'bundle_vip',subscription:true,grants:[{kind:'vip',days:30,daily:300},{kind:'egg',rarity:'rare'}]});
 f.setEggFail(true);assert.equal((await f.context.buy(vipSpec,'alice')).ok,false);const until=JSON.parse(f.profile().cosmetics.vip).until;f.setEggFail(false);assert.equal((await f.context.buy(vipSpec,'alice')).ok,true,'pending VIP can finish despite now-active subscription');assert.equal(JSON.parse(f.profile().cosmetics.vip).until,until,'retry does not extend VIP twice');assert.equal((await f.context.buy(vipSpec,'alice')).ok,false,'fresh active subscription cannot be repurchased');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();f.loseAckWhen((path,profile)=>path==='users/alice'&&profile.inventory?.item_hint===5);
 const itemSpec=spec({sku:'item_hint',grants:[{kind:'item',id:'item_hint',qty:5}]});
 const first=await f.context.buy(itemSpec,'alice');assert.equal(first.ok,false);assert.equal(first.pending,true);assert.equal(f.profile().inventory.item_hint,5,'grant and delivery marker commit together despite lost acknowledgment');
 assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.profile().kaju,32000);assert.equal(f.profile().inventory.item_hint,5,'retry after profile grant ack loss does not duplicate inventory');groups++;
}
{
 const f=fixture();f.replay(true);
 const first=await f.context.buy(spec({sku:'item_hint',grants:[{kind:'item',id:'item_hint',qty:5}]}),'alice');
 assert.equal(first.ok,true);assert.equal(f.profile().kaju,32000,'replaying transaction callback cannot debit twice');assert.equal(f.profile().heroWalletRevision,8);assert.equal(f.profile().inventory.item_hint,5,'replaying callback cannot grant twice');assert.equal(Object.keys(f.profile().heroShopPurchases).length,1);groups++;
}
{
 const f=fixture();f.profile().cosmetics={title:'Existing',keep:'preserved'};
 const result=await f.context.buy(spec({sku:'nick_flame',once:true,inventoryOwnership:'nick_flame',grants:[{kind:'cosmetic',key:'nickEffect',value:'flame'},{kind:'item',id:'nick_flame',qty:1}]}),'alice');
 assert.equal(result.ok,true);assert.equal(f.profile().cosmetics.nickEffect,'flame');assert.equal(f.profile().cosmetics.title,'Existing');assert.equal(f.profile().cosmetics.keep,'preserved');assert.equal(f.profile().inventory.nick_flame,1);assert.equal(f.profile().purchasedOnce.nick_flame,true);
 assert.equal((await f.context.buy(spec({sku:'nick_flame',once:true,inventoryOwnership:'nick_flame',grants:[{kind:'cosmetic',key:'nickEffect',value:'flame'}]}),'alice')).ok,false);assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const result=await f.context.buy(spec({sku:'fr_gold',once:true,ownershipId:'fr_gold',grants:[{kind:'frame',id:'fr_gold',qty:1},{kind:'appearance',field:'frame',value:'gold'}]}),'alice');
 assert.equal(result.ok,true);assert.equal(f.profile().frame,'gold');assert.equal(f.read('shopInventory/alice/ownedItems/fr_gold'),true);assert.equal(f.profile().purchasedOnce.fr_gold,true);groups++;
}
{
 const f=fixture();f.write('shopInventory/alice/ownedItems/fr_gold',true);
 assert.equal((await f.context.buy(spec({sku:'fr_gold',once:true,ownershipId:'fr_gold',grants:[{kind:'frame',id:'fr_gold',qty:1}]}),'alice')).ok,false,'legacy cosmetic ownership rejects a new charge');
 f.profile().inventory={nick_flame:1};
 assert.equal((await f.context.buy(spec({sku:'nick_flame',once:true,inventoryOwnership:'nick_flame',grants:[{kind:'cosmetic',key:'nickEffect',value:'flame'}]}),'alice')).ok,false,'legacy inventory marker rejects a new charge');
 assert.equal(f.profile().kaju,50000);assert.equal(f.writes.length,0);groups++;
}
{
 const f=fixture();const owned=spec({sku:'fr_gold',once:true,ownershipId:'fr_gold',grants:[{kind:'frame',id:'fr_gold',qty:1},{kind:'appearance',field:'frame',value:'gold'}]});
 let profileTransactions=0;f.setFailWhen(path=>path==='users/alice'&&++profileTransactions===2);
 const first=await f.context.buy(owned,'alice');assert.equal(first.ok,false);assert.equal(f.read('shopInventory/alice/ownedItems/fr_gold'),true);assert.equal(f.profile().frame,undefined);
 f.setFailWhen(null);assert.equal((await f.context.buy(owned,'alice')).ok,true,'pending paid delivery takes precedence over its partially delivered ownership');assert.equal(f.profile().frame,'gold');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const unique={kind:'unique',id:'uniq_star',creature:{unique:true,uniqueId:'uniq_star',name:'Yıldız Tozu',typeKey:'unique_uniq_star',level:1,xp:0,bonus:{xp:0.1}}};
 f.setFailWhen(path=>path.startsWith('users/alice/heroShopPurchases/'));
 const first=await f.context.buy(spec({sku:'uniq_star',once:true,ownershipId:'uniq_star',grants:[unique,{kind:'ownership',id:'uniq_star',qty:1}]}),'alice');assert.equal(first.ok,false);assert.equal(first.pending,true);const stable='shop_'+first.purchase.id+'_0';
 assert.equal(f.read('kozmos/alice/creatures/'+stable).uniqueId,'uniq_star');assert.ok(f.read('kozmos/alice/shopPurchaseClaims/'+stable),'delivery receipt is atomic with unique creature');
 f.write('kozmos/alice/creatures/'+stable,null);f.setFailWhen(null);assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.read('kozmos/alice/creatures/'+stable),null,'sender marker retry does not resurrect a fused/deleted creature');assert.equal(f.read('shopInventory/alice/ownedItems/uniq_star'),true,'remaining unique ownership grant completes after retry');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const gift={kind:'gift',recipientUid:'bob',rarity:'epic',seed:123,fromName:'Alice',fromAvatar:'👤',toName:'Bob'};
 f.setFailWhen(path=>path.startsWith('users/alice/heroShopPurchases/'));
 const first=await f.context.buy(spec({sku:'egg_epic_gift_bob',grants:[gift]}),'alice');assert.equal(first.ok,false);assert.equal(first.pending,true);const stable='shop_'+first.purchase.id+'_0';
 const pending=f.read('kozmoPending/bob/'+stable);assert.equal(pending.fromUid,'alice');assert.equal(pending.toUid,'bob');assert.equal(pending.minRarity,'epic');assert.equal(pending.seed,123);assert.equal(pending.status,'pending');assert.ok(f.read('kozmoPending/bob/_deliveryClaims/'+stable),'delivery receipt survives consumed inbox card');
 f.write('kozmoPending/bob/'+stable,null);f.setFailWhen(null);assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.read('kozmoPending/bob/'+stable),null,'sender marker retry does not resurrect an accepted/rejected gift');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();f.loseAckWhen(path=>path==='kozmos/alice');
 const unique={kind:'unique',id:'uniq_star',creature:{unique:true,uniqueId:'uniq_star',name:'Yıldız Tozu',typeKey:'unique_uniq_star'}};
 const first=await f.context.buy(spec({sku:'uniq_star',once:true,grants:[unique]}),'alice');assert.equal(first.ok,false);assert.equal(f.writes.filter(write=>write.path==='kozmos/alice').length,1);
 assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.writes.filter(write=>write.path==='kozmos/alice').length,1,'lost target acknowledgement reads durable receipt instead of recreating creature');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const gift={kind:'gift',recipientUid:'bob',rarity:'rare',seed:123,fromName:'Alice',fromAvatar:'👤',toName:'Bob'};
 f.loseAckWhen(path=>path==='kozmoPending/bob');const first=await f.context.buy(spec({sku:'egg_rare_gift_bob',grants:[gift]}),'alice');assert.equal(first.ok,false);
 assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.writes.filter(write=>write.path==='kozmoPending/bob').length,1,'lost gift acknowledgement reads receipt');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const gift={kind:'gift',recipientUid:'bob',rarity:'rare',seed:123,fromName:'Alice',fromAvatar:'👤',toName:'Bob'};
 f.pauseWhen(path=>path==='kozmoPending/bob');const first=f.context.buy(spec({sku:'egg_rare_gift_bob',grants:[gift]}),'alice');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.profile().kaju,32000);f.setUid('bob');f.release();assert.equal((await first).ok,false);assert.equal(f.read('kozmoPending/bob'),undefined,'changed account cannot perform an old sender gift delivery');assert.equal(f.data.users.bob,undefined);
 f.setUid('alice');assert.equal((await f.context.retry('alice'))[0].ok,true);assert.equal(f.profile().kaju,32000,'original sender later resumes without another charge');groups++;
}
{
 const f=fixture();const gift={kind:'gift',recipientUid:'bob',rarity:'rare',seed:123,fromName:'Alice',fromAvatar:'👤',toName:'Bob'};
 const giftSpec=spec({sku:'egg_rare_gift_bob',grants:[gift]});const results=await Promise.all([f.context.buy(giftSpec,'alice'),f.other().buy(giftSpec,'alice')]);
 assert.ok(results.every(result=>result.ok));assert.equal(results[0].purchase.id,results[1].purchase.id);assert.equal(f.writes.filter(write=>write.path==='kozmoPending/bob').length,1,'cross-tab gift retry creates one pending card');assert.equal(f.profile().kaju,32000);groups++;
}
{
 const f=fixture();const invalid=[{kind:'gift',recipientUid:'bob/nested',rarity:'rare',seed:1,fromName:'Alice',toName:'Bob',fromAvatar:'👤'},{kind:'cosmetic',key:'kaju',value:'999'},{kind:'appearance',field:'kaju',value:'gold'},{kind:'unique',id:'uniq_star',creature:{unique:true,uniqueId:'uniq_other',name:'Star',typeKey:'star'}}];
 for(const grant of invalid)assert.equal((await f.context.buy(spec({grants:[grant]}),'alice')).ok,false);assert.equal(f.profile().kaju,50000);assert.equal(f.writes.length,0,'invalid targets or profile fields never reach debit');groups++;
}
{
 for(const credited of [0,5000]){
   const f=fixture();f.setCreditAmount(credited);
   const first=await f.context.buy(spec({grants:[{kind:'kaju',amount:10000}]}),'alice');
   assert.equal(first.ok,false,'zero or clipped credit cannot acknowledge the displayed full award');assert.equal(first.pending,true);assert.equal(f.profile().kaju,32000+credited);assert.equal(f.profile().heroShopPurchases[first.purchase.id].delivered?.[0],undefined);assert.equal(f.profile().heroShopPurchases[first.purchase.id].status,'pending');
   const retry=await f.context.retry('alice');assert.equal(retry[0].ok,false,'alreadyClaimed receipt must also match the promised amount');assert.equal(f.profile().kaju,32000+credited,'mismatched receipt retry neither recharges nor credits again');
 }
 groups++;
}
{
 const f=fixture();const first=await f.context.buy(spec(),'alice');assert.equal(first.ok,true);
 const recovered=await f.other().buy(spec({resumeOnly:true}),'alice');assert.equal(recovered.ok,true);assert.equal(recovered.purchase.id,first.purchase.id,'a stale UI retry recovers the completed intent');assert.equal(f.profile().kaju,42000,'a stale retry after another tab completes cannot create a new paid purchase');assert.equal(Object.keys(f.profile().heroShopPurchases).length,1);groups++;
}
{
 const f=fixture();const result=await f.context.buy(spec({resumeOnly:true}),'alice');assert.equal(result.ok,false);assert.equal(result.clearPending,true,'an obsolete retry flag can be cleared when no matching intent exists');assert.equal(f.profile().kaju,50000);assert.equal(f.writes.length,0,'resume-only mode never creates a new intent');groups++;
}
console.log(`PASS durable shop purchases: ${groups} debit, receipt, retry, concurrency, ownership and account groups`);
