// Durable purchase intents for paid shop rewards. No rollback after an
// uncertain acknowledgement: retries complete the same persisted rewards.
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';
import { grantEgg } from './kozmos.js';

const MAX = 999999999;
const idOK = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,90}$/.test(value);
const skuOK = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value);
const uidOK = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const rarityOK = value => ['common','rare','epic','legendary','mythical'].includes(value);
const ownerIs = uid => Auth.getState().uid === uid && Auth.getState().status === 'google';
const clone = value => JSON.parse(JSON.stringify(value));
const revision = profile => (Number.isSafeInteger(profile.heroWalletRevision) && profile.heroWalletRevision >= 0 ? profile.heroWalletRevision : 0) + 1;
const balanceOf = profile => Number.isSafeInteger(profile?.kaju) && profile.kaju >= 0 && profile.kaju <= MAX ? profile.kaju : null;
let serial = 0;
const newId = () => 'p_' + Date.now().toString(36) + '_' + (++serial).toString(36) + '_' + Math.random().toString(36).slice(2,12);
const validGrant = grant => {
  if(!grant || !idOK(grant.kind)) return false;
  if(grant.kind === 'kaju') return Number.isSafeInteger(grant.amount) && grant.amount > 0 && grant.amount <= 100000;
  if(grant.kind === 'egg') return rarityOK(grant.rarity);
  if(grant.kind === 'gift') return uidOK(grant.recipientUid) && rarityOK(grant.rarity) && Number.isSafeInteger(grant.seed) && grant.seed>=0 && grant.seed<0x80000000 && typeof grant.fromName==='string' && typeof grant.toName==='string' && typeof grant.fromAvatar==='string';
  if(grant.kind === 'unique') return idOK(grant.id) && grant.creature?.unique===true && grant.creature.uniqueId===grant.id && typeof grant.creature.name==='string' && typeof grant.creature.typeKey==='string';
  if(grant.kind === 'cosmetic') return ['nickEffect','nameColor','title'].includes(grant.key) && typeof grant.value==='string' && grant.value.length<=90;
  if(grant.kind === 'appearance') return ['frame','profileBg'].includes(grant.field) && idOK(grant.value);
  if(grant.kind === 'boost') return idOK(grant.id) && ['xp','kaju','all'].includes(grant.type) && Number.isFinite(grant.mult) && grant.mult >= 1 && grant.mult <= 10 && Number.isSafeInteger(grant.duration) && grant.duration > 0 && grant.duration <= 90*86400000;
  if(grant.kind === 'title') return typeof grant.title === 'string' && grant.title.length <= 90;
  if(grant.kind === 'vip') return Number.isSafeInteger(grant.days) && grant.days > 0 && grant.days <= 366 && Number.isSafeInteger(grant.daily) && grant.daily >= 0 && grant.daily <= 10000;
  return ['frame','theme','ownership','item'].includes(grant.kind) && idOK(grant.id) && Number.isSafeInteger(grant.qty || 1) && (grant.qty || 1) > 0 && (grant.qty || 1) <= 1000;
};
function validPurchase(purchase){
  return purchase && idOK(purchase.id) && skuOK(purchase.sku) && Number.isSafeInteger(purchase.price) && purchase.price > 0 && purchase.price <= MAX && Array.isArray(purchase.grants) && purchase.grants.length > 0 && purchase.grants.length <= 20 && purchase.grants.every(validGrant);
}
async function readPurchase(uid, id){
  if(!ownerIs(uid)) return null;
  const snapshot = await fdb.get(fdb.ref(db, 'users/'+uid+'/heroShopPurchases/'+id));
  return ownerIs(uid) ? snapshot.val() : null;
}

async function reserve(uid, spec){
  if(!ownerIs(uid) || !skuOK(spec?.sku) || !Number.isSafeInteger(spec.price) || spec.price <= 0 || spec.price > MAX || !Array.isArray(spec.grants) || !spec.grants.length || spec.grants.length > 20 || !spec.grants.every(validGrant) || (spec.ownershipId!==undefined && !idOK(spec.ownershipId)) || (spec.inventoryOwnership!==undefined && !idOK(spec.inventoryOwnership))) return {ok:false,error:'Satın alma bilgisi geçersiz'};
  const proposed = {id:newId(),sku:spec.sku,price:spec.price,once:spec.once === true,createdAt:Date.now(),status:'pending',grants:clone(spec.grants)};
  let chosen = proposed.id, rejection = 'Satın alma kaydedilemedi',clearPending=false;
  let result,attempted=false;
  try{
    // Warm the profile cache before a transaction that must reject an absent
    // balance; a cold null callback must not reject an existing wallet.
    await fdb.get(fdb.ref(db,'users/'+uid));
    if(!ownerIs(uid)) return {ok:false,error:'Hesap değişti'};
    const legacyOwned=spec.ownershipId ? (await fdb.get(fdb.ref(db,'shopInventory/'+uid+'/ownedItems/'+spec.ownershipId))).val()===true : false;
    if(!ownerIs(uid)) return {ok:false,error:'Hesap değişti'};
    attempted=true;
    result = await fdb.runTransaction(fdb.ref(db,'users/'+uid), profile => {
      if(!ownerIs(uid)){rejection='Hesap değişti';return;}
      profile = profile || {};
      const entries = profile.heroShopPurchases || {};
      const pending = Object.values(entries).find(p => validPurchase(p) && p.sku === spec.sku && p.status === 'pending');
      if(pending){chosen=pending.id;return;}
      if(spec.resumeOnly){
        const completed=Object.values(entries).filter(p=>validPurchase(p)&&p.sku===spec.sku&&p.status==='complete').sort((a,b)=>b.createdAt-a.createdAt)[0];
        if(completed){chosen=completed.id;return;}
        clearPending=true;rejection='Bu ürün için bekleyen satın alma bulunamadı';return;
      }
      if(spec.once && profile.purchasedOnce?.[spec.sku]){rejection='Bu paket zaten alınmış';return;}
      if(legacyOwned || (spec.inventoryOwnership && Number(profile.inventory?.[spec.inventoryOwnership])>0)){rejection='Bu öğeye zaten sahipsin';return;}
      if(spec.subscription){
        let vip=profile.cosmetics?.vip;
        try{if(typeof vip==='string')vip=JSON.parse(vip);}catch(_){vip=null;}
        if(Number(vip?.until)>Date.now()+3*86400000){rejection='VIP zaten aktif. Bitmesine 3 gün kala yenileyebilirsin.';return;}
      }
      const balance = balanceOf(profile);
      if(balance === null || balance < spec.price){rejection='Yetersiz Kaju';return;}
      chosen=proposed.id;
      return {...profile,kaju:balance-spec.price,heroWalletRevision:revision(profile),heroShopPurchases:{...entries,[proposed.id]:proposed}};
    },{applyLocally:false});
  }catch(error){
    // A server may commit before an acknowledgement is lost. Only a confirmed
    // journal permits recovery; a retry always searches this SKU's pending work.
    if(!ownerIs(uid)) return {ok:false,error:'Hesap değişti'};
    if(!attempted)return {ok:false,error:'Satın alma bilgileri kontrol edilemedi. Yeniden deneyebilirsin.'};
    try{const purchase=await readPurchase(uid,chosen);if(validPurchase(purchase))return {ok:true,purchase,recovered:true};}catch(_){}
    return {ok:false,pending:true,error:'Satın alma onayı alınamadı. Aynı üründen yeniden deneyerek kaydı kontrol edebilirsin.'};
  }
  if(!ownerIs(uid)) return {ok:false,error:'Hesap değişti'};
  const purchase = result.committed ? result.snapshot.val()?.heroShopPurchases?.[chosen] : await readPurchase(uid,chosen);
  if(!validPurchase(purchase)) return {ok:false,error:rejection,clearPending};
  if(result.committed && ownerIs(uid)) Store.logSpend?.(purchase.price,'shop',purchase.sku);
  return {ok:true,purchase,recovered:!result.committed};
}

async function markDelivered(uid, id, index){
  const result=await fdb.runTransaction(fdb.ref(db,'users/'+uid+'/heroShopPurchases/'+id), purchase => {
    if(!ownerIs(uid) || !validPurchase(purchase)) return;
    return {...purchase,delivered:{...purchase.delivered,[index]:true}};
  },{applyLocally:false});
  if(!ownerIs(uid)) return false;
  if(result.committed) return true;
  return !!(await readPurchase(uid,id))?.delivered?.[index];
}

async function profileGrant(uid, id, index, grant){
  const result=await fdb.runTransaction(fdb.ref(db,'users/'+uid), profile => {
    if(!ownerIs(uid) || !profile) return;
    const purchase=profile.heroShopPurchases?.[id];
    if(!validPurchase(purchase) || purchase.status !== 'pending' || purchase.delivered?.[index]) return;
    const fields={};
    if(grant.kind === 'boost') fields.boosts={...profile.boosts,[grant.id]:{type:grant.type,mult:grant.mult,until:Date.now()+grant.duration}};
    else if(grant.kind === 'title') fields.cosmetics={...profile.cosmetics,title:grant.title};
    else if(grant.kind === 'cosmetic') fields.cosmetics={...profile.cosmetics,[grant.key]:grant.value};
    else if(grant.kind === 'appearance')fields[grant.field]=grant.value;
    else if(grant.kind === 'vip'){
      let vip=profile.cosmetics?.vip;
      try{if(typeof vip === 'string')vip=JSON.parse(vip);}catch(_){vip=null;}
      const base=Math.max(Date.now(),Number(vip?.until)||0);
      fields.cosmetics={...profile.cosmetics,vip:JSON.stringify({until:base+grant.days*86400000,daily:grant.daily})};
    } else if(grant.kind === 'item'){
      const count=profile.inventory?.[grant.id] || 0;
      if(!Number.isSafeInteger(count) || count<0 || count>MAX-(grant.qty||1))return;
      fields.inventory={...profile.inventory,[grant.id]:count+(grant.qty||1)};
    }
    else return;
    return {...profile,...fields,heroShopPurchases:{...profile.heroShopPurchases,[id]:{...purchase,delivered:{...purchase.delivered,[index]:true}}}};
  },{applyLocally:false});
  if(!ownerIs(uid)) return false;
  if(result.committed) return true;
  return !!(await readPurchase(uid,id))?.delivered?.[index];
}

async function externalGrant(uid,purchase,index,grant){
  const stable='shop_'+purchase.id+'_'+index;
  const gift=grant.kind==='gift';
  const path=gift?'kozmoPending/'+grant.recipientUid:'kozmos/'+uid;
  const claims=gift?'_deliveryClaims':'shopPurchaseClaims';
  const result=await fdb.runTransaction(fdb.ref(db,path),data=>{
    if(!ownerIs(uid))return;
    data=data || {};
    if(data[claims]?.[stable])return;
    const receipt={ts:Date.now(),fromUid:uid};
    if(gift)return {...data,[stable]:{fromUid:uid,fromName:grant.fromName,fromAvatar:grant.fromAvatar,toUid:grant.recipientUid,toName:grant.toName,sentAt:purchase.createdAt,seed:grant.seed,status:'pending',minRarity:grant.rarity,source:'gift'},[claims]:{...data[claims],[stable]:receipt}};
    return {...data,creatures:{...data.creatures,[stable]:data.creatures?.[stable] || grant.creature},[claims]:{...data[claims],[stable]:receipt}};
  },{applyLocally:false});
  if(!ownerIs(uid))return false;
  const confirmed=result.committed || (await fdb.get(fdb.ref(db,path+'/'+claims+'/'+stable))).exists();
  if(!ownerIs(uid) || !confirmed)return false;
  if(gift)try{
    await fdb.set(fdb.ref(db,'userNotifs/'+grant.recipientUid+'/'+stable),{type:'gift_kozmo',icon:'🎁',text:grant.fromName+' sana kozmo yumurtası hediye etti! 🥚',ts:purchase.createdAt,fromUid:uid});
  }catch(_){/* Notification delivery does not undo a confirmed gift. */}
  return true;
}

async function deliver(uid, original){
  if(!ownerIs(uid) || !validPurchase(original)) return {ok:false,error:'Satın alma kaydı geçersiz'};
  let purchase=original;
  try{
    for(let index=0;index<purchase.grants.length;index++){
      if(!ownerIs(uid)) return {ok:false,pending:true,error:'Hesap değişti; teslim kaydı korunuyor'};
      if(purchase.delivered?.[index]) continue;
      const grant=purchase.grants[index],stable='shop_'+purchase.id+'_'+index;
      let done=false;
      if(grant.kind === 'kaju'){
        const result=await Store.claimKajuOnce(stable,grant.amount,'shop','Mağaza: '+purchase.sku,uid);
        done=!!(result.claimed || result.alreadyClaimed) && result.amount===grant.amount;
      } else if(grant.kind === 'egg') done=await grantEgg(uid,stable,grant.rarity);
      else if(grant.kind === 'unique' || grant.kind === 'gift')done=await externalGrant(uid,purchase,index,grant);
      else if(grant.kind === 'frame' || grant.kind === 'theme' || grant.kind === 'ownership'){
        if(!ownerIs(uid)) return {ok:false,pending:true,error:'Hesap değişti'};
        await fdb.set(fdb.ref(db,'shopInventory/'+uid+'/ownedItems/'+grant.id),true);done=true;
      } else {
        done=await profileGrant(uid,purchase.id,index,grant);
        if(done){purchase={...purchase,delivered:{...purchase.delivered,[index]:true}};continue;}
      }
      if(!done || !await markDelivered(uid,purchase.id,index)) throw new Error('Teslim onaylanamadı');
      purchase={...purchase,delivered:{...purchase.delivered,[index]:true}};
    }
    const result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
      if(!ownerIs(uid) || !profile) return;
      const saved=profile.heroShopPurchases?.[purchase.id];
      if(!validPurchase(saved) || saved.status === 'complete' || saved.grants.some((_,i)=>!saved.delivered?.[i])) return;
      return {...profile,purchasedOnce:saved.once?{...profile.purchasedOnce,[saved.sku]:true}:profile.purchasedOnce || {},heroShopPurchases:{...profile.heroShopPurchases,[saved.id]:{...saved,status:'complete',completedAt:Date.now()}}};
    },{applyLocally:false});
    if(!ownerIs(uid)) return {ok:false,pending:true,error:'Hesap değişti; teslim kaydı korunuyor'};
    const saved=result.committed?result.snapshot.val()?.heroShopPurchases?.[purchase.id]:await readPurchase(uid,purchase.id);
    if(saved?.status !== 'complete')throw new Error('Teslim kaydı tamamlanamadı');
    return {ok:true,purchase:saved};
  }catch(error){
    const code=String(error?.code||error?.message||'').toLowerCase();
    return {ok:false,pending:true,purchase,error:code.includes('permission')||code.includes('denied')?'Teslim için sunucu izni alınamadı. Ödüllerin kayıtlı; aynı üründen yeniden deneyebilirsin.':'Teslim tamamlanamadı. Aynı üründen yeniden deneyince kayıtlı ödüller tamamlanır; tekrar ücret alınmaz.'};
  }
}

const active=new Map();
export function purchaseShopRewards(spec,uid=Auth.getState().uid){
  const key=uid+':'+spec?.sku;
  if(active.has(key))return active.get(key);
  const pending=(async()=>{const reserved=await reserve(uid,spec);return reserved.ok?deliver(uid,reserved.purchase):reserved;})();
  active.set(key,pending);pending.finally(()=>{if(active.get(key)===pending)active.delete(key);}).catch(()=>{});
  return pending;
}
export async function retryShopPurchases(uid=Auth.getState().uid){
  if(!ownerIs(uid))return [];
  const snapshot=await fdb.get(fdb.ref(db,'users/'+uid));
  if(!ownerIs(uid))return [];
  const results=[];
  for(const purchase of Object.values(snapshot.val()?.heroShopPurchases||{}))if(validPurchase(purchase)&&purchase.status==='pending')results.push(await deliver(uid,purchase));
  return results;
}
