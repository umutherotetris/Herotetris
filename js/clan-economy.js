import { Auth, db, fdb } from './auth.js';
import { getState, logSpend } from './store.js';

const WALLET_MAX = 999999999, SUPPORT_MAX = 1000000000, POOL_MAX = Number.MAX_SAFE_INTEGER;
const key = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value);
const journalKey = value => typeof value === 'string' && /^[\w-]{1,360}$/.test(value);
const integer = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const balance = value => value == null ? 0 : integer(value) ? value : null;
const current = uid => !!uid && Auth.getState().uid === uid && Auth.getState().status === 'google';
const nextRevision = p => (integer(p.heroWalletRevision) ? p.heroWalletRevision : 0) + 1;
export function clanOperationId(){
  return 'clan_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));
}
const matches = (entry, uid, clanId, amount, adminGift = false) => entry && entry.uid === uid && entry.clanId === clanId
  && entry.amount === amount && !!entry.adminGift === adminGift;
const validDonation = (id, entry, uid) => journalKey(id) && key(entry?.clanId) && entry?.uid === uid
  && integer(entry.amount) && entry.amount > 0 && entry.amount <= WALLET_MAX;
const terminal = entry => entry?.state === 'delivered' || entry?.state === 'refunded';

// Closing a clan must retain payment receipts. Otherwise an acknowledgement lost
// just before disbanding could later be replayed as a new donation or refund.
export async function closeClanTreasury(clanId, uid, onlyIfEmpty=false){
  if(!current(uid) || !key(clanId)) return false;
  const result=await fdb.runTransaction(fdb.ref(db,'clans/'+clanId),clan=>{
    if(!current(uid) || !clan) return;
    if(clan.closed)return;
    if(clan.leader!==uid&&Auth.getState().isAdmin!==true)return;
    if(onlyIfEmpty&&Object.keys(clan.members||{}).length)return;
    return {closed:true,closedAt:Date.now(),donationReceipts:clan.donationReceipts||{}};
  },{applyLocally:false});
  if(!current(uid))return false;
  return !!result.committed || !!(await fdb.get(fdb.ref(db,'clans/'+clanId))).val()?.closed;
}

async function refundDonation(uid, operationId, entry){
  let result;
  try{
    result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
      if(!current(uid)||!profile)return;
      const saved=profile.heroClanDonations?.[operationId];
      if(!matches(saved,uid,entry.clanId,entry.amount)||terminal(saved))return;
      const kaju=balance(profile.kaju);
      if(kaju===null||kaju+entry.amount>WALLET_MAX)return;
      return {...profile,kaju:kaju+entry.amount,heroWalletRevision:nextRevision(profile),
        heroClanDonations:{...profile.heroClanDonations,[operationId]:{...saved,state:'refunded',refundedAt:Date.now()}},
        kaju_history:{...profile.kaju_history,[operationId+'_refund']:{amount:entry.amount,type:'earn',game:'clan',reason:'Klan bağışı iadesi',ts:Date.now()}}};
    },{applyLocally:false});
  }catch(e){}
  if(!current(uid))return {ok:true,pending:true,operationId,amount:entry.amount};
  let profile;
  try{profile=result?.committed?result.snapshot.val():(await fdb.get(fdb.ref(db,'users/'+uid))).val();}
  catch(e){return {ok:true,pending:true,operationId,amount:entry.amount,error:'Bağış iadesi henüz doğrulanamadı'};}
  if(!current(uid))return {ok:true,pending:true,operationId,amount:entry.amount};
  if(profile?.heroClanDonations?.[operationId]?.state==='refunded'){
    return {ok:false,refunded:true,pending:false,operationId,amount:entry.amount,error:'Klan kasası uygun olmadığı için bağışın iade edildi'};
  }
  return {ok:true,pending:true,operationId,amount:entry.amount,error:'İade için Kaju bakiyende yer açıp yeniden kontrol et'};
}

// The wallet debit and this outbox entry commit together. Delivery can be retried
// after any interruption; its receipt, clan balance and donor totals also commit together.
async function deliverDonation(uid, operationId, entry){
  if(!current(uid) || !validDonation(operationId,entry,uid)) return {ok:false,error:'Bağış kaydı doğrulanamadı'};
  let result, rejection = 'Klan kasası doğrulanamadı';
  try{
    result = await fdb.runTransaction(fdb.ref(db,'clans/'+entry.clanId), clan => {
      if(!current(uid)) return;
      if(clan?.donationReceipts?.[operationId]) return;
      if(!clan || typeof clan !== 'object' || Array.isArray(clan))clan={closed:true,closedAt:Date.now()};
      const pool = balance(clan.kaju), total = balance(clan.donorTotals?.[uid]?.total);
      if(clan.closed || pool === null || total === null || pool + entry.amount > POOL_MAX || total + entry.amount > POOL_MAX){
        return {...clan,donationReceipts:{...clan.donationReceipts,[operationId]:{...entry,operationId,adminGift:false,state:'cancelled',cancelledAt:Date.now()}}};
      }
      const receipt = {...entry,operationId,state:'delivered',adminGift:false,appliedDelta:entry.amount,newBalance:pool+entry.amount};
      return {...clan,kaju:receipt.newBalance,
        donationReceipts:{...clan.donationReceipts,[operationId]:receipt},
        donations:{...clan.donations,[operationId]:{uid,name:entry.name,amount:entry.amount,ts:entry.ts}},
        donorTotals:{...clan.donorTotals,[uid]:{...clan.donorTotals?.[uid],name:entry.name,total:total+entry.amount}}};
    },{applyLocally:false});
  }catch(e){ rejection = 'Bağış kaydedildi; kasaya aktarım bağlantı geldiğinde yeniden denenecek'; }
  if(!current(uid)) return {ok:true,pending:true,operationId,amount:entry.amount};
  let clan;
  try{ clan = result?.committed ? result.snapshot.val() : (await fdb.get(fdb.ref(db,'clans/'+entry.clanId))).val(); }
  catch(e){ return {ok:true,pending:true,operationId,amount:entry.amount,error:rejection}; }
  if(!current(uid)) return {ok:true,pending:true,operationId,amount:entry.amount};
  const receipt = clan?.donationReceipts?.[operationId];
  if(matches(receipt,uid,entry.clanId,entry.amount)&&receipt.state==='cancelled')return refundDonation(uid,operationId,entry);
  if(!matches(receipt,uid,entry.clanId,entry.amount) || receipt.appliedDelta !== entry.amount){
    return {ok:true,pending:true,operationId,amount:entry.amount,error:rejection};
  }
  // A failed acknowledgement here leaves a recoverable journal entry. The clan
  // receipt already proves delivery, and prevents a second clan credit on replay.
  try{
    await fdb.runTransaction(fdb.ref(db,'users/'+uid), profile => {
      if(!current(uid) || !profile) return;
      const saved = profile.heroClanDonations?.[operationId];
      if(!matches(saved,uid,entry.clanId,entry.amount) || terminal(saved)) return;
      return {...profile,heroClanDonations:{...profile.heroClanDonations,[operationId]:{...saved,state:'delivered',deliveredAt:Date.now()}}};
    },{applyLocally:false});
  }catch(e){}
  return {ok:true,pending:false,operationId,amount:entry.amount,newBalance:clan.kaju};
}

export async function donateClanKaju(clanId, amount, operationId = clanOperationId()){
  const owner = Auth.getState(), uid = owner.uid;
  if(!current(uid) || !key(clanId) || !key(operationId) || !integer(amount) || amount <= 0 || amount > WALLET_MAX){
    return {ok:false,error:'Geçerli bir Kaju miktarı ve klan gerekli'};
  }
  operationId='clan_'+uid.length+'_'+uid+'_'+operationId;
  let result, rejection = 'Bağış yapılamadı', pendingId = operationId;
  try{
    result = await fdb.runTransaction(fdb.ref(db,'users/'+uid), profile => {
      if(!current(uid)){ rejection = 'Hesap değişti'; return; }
      if(!profile || typeof profile !== 'object' || Array.isArray(profile)) return;
      const previous = profile.heroClanDonations?.[operationId];
      if(previous){
        if(!matches(previous,uid,clanId,amount)) rejection = 'İşlem kimliği başka bir bağışa ait';
        return;
      }
      // A reopened panel must resolve a reserved donation before making another
      // debit, even when the first transaction acknowledgement was lost.
      const pending = Object.entries(profile.heroClanDonations || {}).find(([,v])=>!terminal(v));
      if(pending){ pendingId = pending[0]; rejection = 'Bekleyen bağış önce tamamlanmalı'; return; }
      if(profile.clanId !== clanId){ rejection = 'Klan üyeliğin değişti'; return; }
      const kaju = balance(profile.kaju);
      if(kaju === null || kaju > WALLET_MAX){ rejection = 'Kaju bakiyesi doğrulanamadı'; return; }
      if(kaju < amount){ rejection = 'Yetersiz Kaju'; return; }
      const entry = {uid,clanId,amount,name:String(owner.displayName || 'Üye').slice(0,80),ts:Date.now(),state:'pending'};
      return {...profile,kaju:kaju-amount,heroWalletRevision:nextRevision(profile),
        heroClanDonations:{...profile.heroClanDonations,[operationId]:entry},
        kaju_history:{...profile.kaju_history,[operationId]:{amount,type:'spend',game:'clan',reason:'Klan kasası bağışı',ts:entry.ts}}};
    },{applyLocally:false});
  }catch(e){ rejection = 'Bağış sonucu doğrulanamadı; aynı işlemi yeniden kontrol et'; }
  if(!current(uid)) return {ok:false,uncertain:true,operationId,error:'Hesap değişti; işlem kaydı korunuyor'};
  let profile;
  try{ profile = result?.committed ? result.snapshot.val() : (await fdb.get(fdb.ref(db,'users/'+uid))).val(); }
  catch(e){ return {ok:false,uncertain:true,operationId,error:rejection}; }
  if(!current(uid)) return {ok:false,uncertain:true,operationId,error:'Hesap değişti; işlem kaydı korunuyor'};
  const entry = profile?.heroClanDonations?.[operationId];
  if(!matches(entry,uid,clanId,amount)){
    const pending = profile?.heroClanDonations?.[pendingId];
    if(validDonation(pendingId,pending,uid) && !terminal(pending)){
      return {ok:false,pending:true,operationId:pendingId,amount:pending.amount,clanId:pending.clanId,error:rejection};
    }
    return {ok:false,operationId,error:rejection};
  }
  if(result?.committed && getState().uid === uid) logSpend(amount,'clan','Klan kasası bağışı');
  if(entry.state === 'delivered') return {ok:true,pending:false,operationId,amount:entry.amount,alreadyApplied:true};
  if(entry.state === 'refunded') return {ok:false,refunded:true,pending:false,operationId,amount:entry.amount,error:'Bu bağış daha önce iade edildi'};
  return deliverDonation(uid,operationId,entry);
}

const recoveries = new Map();
export async function retryClanDonations(operationId){
  const uid = Auth.getState().uid;
  if(!current(uid)) return {ok:false,confirmedIds:[],queuedIds:[],error:'Giriş gerekli'};
  if(recoveries.has(uid)){
    await recoveries.get(uid);
    if(!current(uid)) return {ok:false,confirmedIds:[],queuedIds:[],error:'Hesap değişti'};
  }
  const task = (async()=>{
    const confirmedIds = [], queuedIds = [], refundedIds = [];
    try{
      const profile = (await fdb.get(fdb.ref(db,'users/'+uid))).val();
      if(!current(uid)) return {ok:false,confirmedIds,queuedIds,error:'Hesap değişti'};
      for(const [id,entry] of Object.entries(profile?.heroClanDonations || {})){
        if(operationId && operationId !== id) continue;
        if(!current(uid)) return {ok:false,confirmedIds,queuedIds,error:'Hesap değişti'};
        if(!validDonation(id,entry,uid)){ queuedIds.push(id); continue; }
        if(entry.state === 'delivered'){ confirmedIds.push(id); continue; }
        if(entry.state === 'refunded'){ refundedIds.push(id); continue; }
        const result = await deliverDonation(uid,id,entry);
        if(!current(uid)) return {ok:false,confirmedIds,queuedIds,error:'Hesap değişti'};
        (result.refunded ? refundedIds : result.ok && !result.pending ? confirmedIds : queuedIds).push(id);
      }
      return {ok:true,confirmedIds,queuedIds,refundedIds};
    }catch(e){ return {ok:false,confirmedIds,queuedIds,error:'Bekleyen bağışlar okunamadı'}; }
  })();
  recoveries.set(uid,task);
  try{ return await task; }finally{ if(recoveries.get(uid) === task) recoveries.delete(uid); }
}

// Admin support has no wallet debit. Its mint, audit row and optional chat entry
// share one idempotent clan transaction, so audit failures cannot double support.
export async function supportClanKaju(clanId, amount, operationId = clanOperationId()){
  const owner = Auth.getState(), uid = owner.uid;
  const authorized = () => current(uid) && Auth.getState().isAdmin === true;
  if(!authorized() || !key(clanId) || !key(operationId) || !integer(amount) || amount <= 0 || amount > SUPPORT_MAX){
    return {ok:false,error:'Admin desteği 1–1.000.000.000 tam Kaju olmalı'};
  }
  operationId='support_'+uid.length+'_'+uid+'_'+operationId;
  let result, rejection = 'Klan kasası doğrulanamadı';
  try{
    result = await fdb.runTransaction(fdb.ref(db,'clans/'+clanId), clan => {
      if(!authorized()) return;
      if(!clan || clan.closed || typeof clan !== 'object' || Array.isArray(clan)) return;
      if(clan.donationReceipts?.[operationId]) return;
      const pool = balance(clan.kaju); if(pool === null) return;
      const appliedDelta = Math.min(amount,POOL_MAX-pool);
      if(appliedDelta <= 0){ rejection = 'Klan kasası üst sınırda'; return; }
      const ts = Date.now(), name = '👑 '+String(owner.displayName || 'Admin').slice(0,80)+' (Destek)';
      const receipt = {uid,clanId,amount,appliedDelta,newBalance:pool+appliedDelta,adminGift:true,ts};
      return {...clan,kaju:receipt.newBalance,
        donationReceipts:{...clan.donationReceipts,[operationId]:receipt},
        donations:{...clan.donations,[operationId]:{uid,name,amount:appliedDelta,ts,adminGift:true}},
        chat:{...clan.chat,[operationId]:{uid:'system',name:'👑 Sistem',avatar:'💰',isSystem:true,isAdmin:true,
          text:'👑 '+String(owner.displayName || 'Admin').slice(0,80)+' klan kasasına '+appliedDelta.toLocaleString('tr-TR')+' Kaju destek verdi! 🎉',ts}}};
    },{applyLocally:false});
  }catch(e){ rejection = 'Desteğin sonucu doğrulanamadı; aynı işlemi yeniden kontrol et'; }
  if(!authorized()) return {ok:false,uncertain:true,operationId,error:'Hesap veya yetki değişti; işlem kaydı korunuyor'};
  let clan;
  try{ clan = result?.committed ? result.snapshot.val() : (await fdb.get(fdb.ref(db,'clans/'+clanId))).val(); }
  catch(e){ return {ok:false,uncertain:true,operationId,error:rejection}; }
  if(!authorized()) return {ok:false,uncertain:true,operationId,error:'Hesap veya yetki değişti'};
  const receipt = clan?.donationReceipts?.[operationId];
  if(!matches(receipt,uid,clanId,amount,true) || !integer(receipt.appliedDelta) || receipt.appliedDelta <= 0){
    return {ok:false,operationId,error:rejection};
  }
  return {ok:true,operationId,amount:receipt.appliedDelta,newBalance:clan.kaju,alreadyApplied:!result?.committed};
}
