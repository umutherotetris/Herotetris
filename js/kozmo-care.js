// Account-bound care intents keep a reserved food/stone and its eventual effect
// together across reloads. Target receipts make retries safe after consumption.
import { Auth, db, fdb } from './auth.js';

const MAX=999999999;
const keyOK=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(value);
const ownerIs=uid=>!!uid&&Auth.getState().uid===uid&&Auth.getState().status==='google';
const clone=value=>JSON.parse(JSON.stringify(value));
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX?value:null;
const dayKey=()=>{const day=new Date();return day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');};
let serial=0;
const newId=()=>'care_'+Date.now().toString(36)+'_'+(++serial).toString(36)+'_'+Math.random().toString(36).slice(2,11);
const fusionResultOK=result=>result&&keyOK(result.typeKey)&&typeof result.name==='string'&&result.name.length>0&&result.name.length<=100&&['common','rare','epic','legendary','mythical'].includes(result.rarity)&&/^#[a-fA-F0-9]{6}$/.test(result.color);
function validIntent(intent){
  if(!intent||!keyOK(intent.id)||!['feed','fusion'].includes(intent.kind)||!['pending','complete','cancelled'].includes(intent.status))return false;
  const resource=intent.resource;
  if(resource&&!(resource.kind==='item'&&['item_food10','item_food50','item_fusion'].includes(resource.itemId))&&!(resource.kind==='free'&&keyOK(resource.eggId)&&/^\d{4}-\d{2}-\d{2}$/.test(resource.day)))return false;
  if(intent.kind==='feed')return keyOK(intent.eggId)&&(resource?.kind==='free'&&resource.eggId===intent.eggId||resource?.kind==='item'&&['item_food10','item_food50'].includes(resource.itemId));
  return (!resource||resource.kind==='item'&&resource.itemId==='item_fusion')&&keyOK(intent.firstId)&&keyOK(intent.secondId)&&intent.firstId!==intent.secondId&&keyOK(intent.firstType)&&keyOK(intent.secondType)&&fusionResultOK(intent.result);
}
function sameTarget(intent,spec){
  return intent.kind===spec.kind&&(spec.kind==='feed'?intent.eggId===spec.eggId:[intent.firstId,intent.secondId].sort().join(':')===[spec.firstId,spec.secondId].sort().join(':'));
}
function freeLimit(profile){
  let vip=profile.cosmetics?.vip;
  try{if(typeof vip==='string')vip=JSON.parse(vip);}catch(_){vip=null;}
  return Number(vip?.until)>Date.now()?5:3;
}
const ownedBy=(item,uid)=>!!item&&(!item.ownerId||item.ownerId===uid);
const compatibleParent=(parent,type,uid)=>ownedBy(parent,uid)&&typeof parent==='object'&&!parent.unique&&parent.typeKey===type;
async function savedIntent(uid,id){
  if(!ownerIs(uid))return null;
  const snapshot=await fdb.get(fdb.ref(db,'users/'+uid+'/heroKozmoCare/'+id));
  return ownerIs(uid)?snapshot.val():null;
}
async function reserve(uid,spec){
  if(!ownerIs(uid))return {ok:false,error:'Hesap değişti'};
  const base={...clone(spec),id:spec.resumeId||newId(),createdAt:Date.now(),status:'pending'};
  let selected=base.id,error='İşlem kaydedilemedi',attempted=false,result;
  try{
    await fdb.get(fdb.ref(db,'users/'+uid));
    if(!ownerIs(uid))return {ok:false,error:'Hesap değişti'};
    const target=(await fdb.get(fdb.ref(db,'kozmos/'+uid))).val()||{};
    if(!ownerIs(uid))return {ok:false,error:'Hesap değişti'};
    attempted=true;
    result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
      if(!ownerIs(uid)||!profile)return;
      const intents=profile.heroKozmoCare||{};
      if(spec.resumeId){
        const previous=intents[spec.resumeId];
        if(validIntent(previous)&&sameTarget(previous,spec)){selected=previous.id;return;}
        if(previous){error='Önceki işlem kaydı henüz doğrulanamadı';return;}
      }
      const pending=Object.values(intents).find(intent=>validIntent(intent)&&intent.status==='pending'&&sameTarget(intent,spec));
      if(pending){selected=pending.id;return;}
      let inventory=profile.inventory||{},feeds=profile.heroKozmoFeeds||{},resource=null,freeUsed=0;
      if(spec.kind==='feed'){
        const egg=target.eggs?.[spec.eggId];
        if(!ownedBy(egg,uid)||count(egg.feedCount||0)===null||egg.feedCount===MAX){error='Yumurta artık mevcut değil veya beslenemiyor';return;}
        const day=dayKey(),old=feeds[spec.eggId],limit=freeLimit(profile);
        const used=old?.day===day?count(old.used):Math.min(limit,spec.legacyFreeUsed||0);
        if(used===null){error='Besleme kaydı geçersiz';return;}
        if(used<limit){freeUsed=used+1;resource={kind:'free',eggId:spec.eggId,day};feeds={...feeds,[spec.eggId]:{day,used:freeUsed}};}
        else{
          freeUsed=used;
          const food=['item_food10','item_food50'].find(id=>count(inventory[id]||0)>0);
          if(!food){error='Bugün '+limit+' kez besledin. Mağazadan 🍎 Besin alarak devam edebilirsin!';return;}
          resource={kind:'item',itemId:food};inventory={...inventory,[food]:inventory[food]-1};
        }
      }else{
        if(!compatibleParent(target.creatures?.[spec.firstId],spec.firstType,uid)||!compatibleParent(target.creatures?.[spec.secondId],spec.secondType,uid)){error='Birleştirilecek kozmolar artık mevcut değil';return;}
        if(spec.useStone){
          const available=count(inventory.item_fusion||0);
          if(!available){error='Birleştirme Taşı bulunamadı';return;}
          resource={kind:'item',itemId:'item_fusion'};inventory={...inventory,item_fusion:available-1};
        }
      }
      selected=base.id;
      const intent={...base,resource,...(spec.kind==='feed'?{freeUsed}:{})};
      return {...profile,inventory,heroKozmoFeeds:feeds,heroKozmoCare:{...intents,[intent.id]:intent}};
    },{applyLocally:false});
  }catch(_){
    if(!ownerIs(uid))return {ok:false,error:'Hesap değişti'};
    if(attempted)try{const intent=await savedIntent(uid,selected);if(validIntent(intent))return {ok:true,intent};}catch(_){}
    return {ok:false,pending:attempted,operationId:selected,error:attempted?'İşlem onayı alınamadı. Aynı işlemden yeniden deneyebilirsin.':'İşlem bilgileri kontrol edilemedi. Yeniden deneyebilirsin.'};
  }
  if(!ownerIs(uid))return {ok:false,error:'Hesap değişti'};
  let intent;
  try{intent=result.committed?result.snapshot.val()?.heroKozmoCare?.[selected]:await savedIntent(uid,selected);}
  catch(_){return {ok:false,pending:true,operationId:selected,error:'İşlem kaydı doğrulanamadı. Aynı işlemden yeniden deneyebilirsin.'};}
  return validIntent(intent)?{ok:true,intent}:{ok:false,error};
}

async function applyEffect(uid,intent){
  const path='kozmos/'+uid;
  const result=await fdb.runTransaction(fdb.ref(db,path),data=>{
    if(!ownerIs(uid))return;
    data=data||{};
    if(data.careClaims?.[intent.id])return;
    let fields={},status='complete',reason='',resultId='';
    if(intent.kind==='feed'){
      const egg=data.eggs?.[intent.eggId],fed=count(egg?.feedCount||0);
      if(!ownedBy(egg,uid)||fed===null||fed===MAX){status='cancelled';reason='Yumurta artık beslenemiyor';}
      else fields.eggs={...data.eggs,[intent.eggId]:{...egg,feedCount:fed+1}};
    }else{
      const first=data.creatures?.[intent.firstId],second=data.creatures?.[intent.secondId];
      resultId='fusion_'+intent.id;
      if(!compatibleParent(first,intent.firstType,uid)||!compatibleParent(second,intent.secondType,uid)||data.creatures?.[resultId]){status='cancelled';reason='Birleştirilecek kozmolar değişti veya kaldırıldı';}
      else{
        const creatures={...data.creatures};delete creatures[intent.firstId];delete creatures[intent.secondId];
        const level=parent=>Number.isSafeInteger(Number(parent.level))&&Number(parent.level)>0&&Number(parent.level)<=MAX?Number(parent.level):1;
        creatures[resultId]={...intent.result,fromUid:uid,fromName:'Birleştirme',bornAt:intent.createdAt,level:Math.max(level(first),level(second)),xp:0,parents:[first.typeKey,second.typeKey],isFusion:true};
        fields.creatures=creatures;
      }
    }
    const receipt={kind:intent.kind,status,ts:Date.now(),reason,...(resultId?{resultId}:{})};
    return {...data,...fields,careClaims:{...data.careClaims,[intent.id]:receipt}};
  },{applyLocally:false});
  if(!ownerIs(uid))return null;
  const receipt=result.committed?result.snapshot.val()?.careClaims?.[intent.id]:(await fdb.get(fdb.ref(db,path+'/careClaims/'+intent.id))).val();
  return ownerIs(uid)&&receipt?.kind===intent.kind&&['complete','cancelled'].includes(receipt.status)?receipt:null;
}
async function finish(uid,intent,receipt){
  const result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
    if(!ownerIs(uid)||!profile)return;
    const saved=profile.heroKozmoCare?.[intent.id];
    if(!validIntent(saved)||saved.status!=='pending')return;
    let inventory=profile.inventory||{},feeds=profile.heroKozmoFeeds||{};
    if(receipt.status==='cancelled'){
      const resource=saved.resource;
      if(resource?.kind==='item'){
        const available=count(inventory[resource.itemId]||0);
        if(available===null||available===MAX)return;
        inventory={...inventory,[resource.itemId]:available+1};
      }else if(resource?.kind==='free'){
        const daily=feeds[resource.eggId];
        if(daily?.day===resource.day){const used=count(daily.used);if(used===null||used===0)return;feeds={...feeds,[resource.eggId]:{...daily,used:used-1}};}
      }
    }
    return {...profile,inventory,heroKozmoFeeds:feeds,heroKozmoCare:{...profile.heroKozmoCare,[intent.id]:{...saved,status:receipt.status,completedAt:Date.now(),reason:receipt.reason||'',...(receipt.resultId?{resultId:receipt.resultId}:{})}}};
  },{applyLocally:false});
  if(!ownerIs(uid))return null;
  return result.committed?result.snapshot.val()?.heroKozmoCare?.[intent.id]:await savedIntent(uid,intent.id);
}
async function deliver(uid,intent){
  if(!ownerIs(uid)||!validIntent(intent))return {ok:false,error:'İşlem kaydı geçersiz'};
  const operationId=intent.id,original=intent;
  try{
    if(intent.status==='pending'){
      const receipt=await applyEffect(uid,intent);
      if(!receipt)throw Error('İşlem teslimi onaylanamadı');
      intent=await finish(uid,intent,receipt);
    }
    if(!ownerIs(uid))return {ok:false,pending:true,error:'Hesap değişti; işlem kaydı korunuyor'};
    if(!validIntent(intent)||intent.status==='pending')throw Error('İşlem tamamlanamadı');
    return intent.status==='complete'?{ok:true,intent}:{ok:false,cancelled:true,intent,error:(intent.reason||'İşlem iptal edildi')+'. Ayrılan hak veya öğe iade edildi.'};
  }catch(_){
    if(ownerIs(uid))try{
      const saved=await savedIntent(uid,operationId);
      if(validIntent(saved)&&saved.status==='complete')return {ok:true,intent:saved};
      if(validIntent(saved)&&saved.status==='cancelled')return {ok:false,cancelled:true,intent:saved,error:(saved.reason||'İşlem iptal edildi')+'. Ayrılan hak veya öğe iade edildi.'};
    }catch(_){}
    return {ok:false,pending:true,intent:validIntent(intent)?intent:original,operationId,error:'İşlem tamamlanamadı. Kayıt korunuyor; tekrar denemede ek hak veya öğe kullanılmaz.'};
  }
}
const active=new Map(),uncertain=new Map();
function perform(uid,spec){
  const target=spec.kind==='feed'?spec.eggId:[spec.firstId,spec.secondId].sort().join(':'),key=uid+':'+spec.kind+':'+target;
  if(active.has(key))return active.get(key);
  const task=(async()=>{
    const resumeId=uncertain.get(key);
    const reserved=await reserve(uid,{...spec,...(resumeId?{resumeId}:{})});
    const result=reserved.ok?await deliver(uid,reserved.intent):reserved;
    if(result.pending&&(result.operationId||result.intent?.id))uncertain.set(key,result.operationId||result.intent.id);
    else if(result.ok||result.cancelled)uncertain.delete(key);
    return result;
  })();
  active.set(key,task);void task.finally(()=>{if(active.get(key)===task)active.delete(key);}).catch(()=>{});return task;
}
export function feedKozmo(eggId,expectedUid=Auth.getState().uid,legacyFreeUsed=0){
  if(!keyOK(eggId)||!Number.isSafeInteger(legacyFreeUsed)||legacyFreeUsed<0||legacyFreeUsed>5)return Promise.resolve({ok:false,error:'Besleme bilgisi geçersiz'});
  return perform(expectedUid,{kind:'feed',eggId,legacyFreeUsed});
}
export function fuseKozmos(spec,expectedUid=Auth.getState().uid){
  if(!keyOK(spec?.firstId)||!keyOK(spec.secondId)||spec.firstId===spec.secondId||!keyOK(spec.firstType)||!keyOK(spec.secondType)||!fusionResultOK(spec.result)||(spec.useStone&&spec.result.rarity!=='legendary'))return Promise.resolve({ok:false,error:'Birleştirme bilgisi geçersiz'});
  return perform(expectedUid,{kind:'fusion',firstId:spec.firstId,secondId:spec.secondId,firstType:spec.firstType,secondType:spec.secondType,result:clone(spec.result),useStone:spec.useStone===true});
}
export async function retryKozmoCare(uid=Auth.getState().uid){
  if(!ownerIs(uid))return [];
  const profile=(await fdb.get(fdb.ref(db,'users/'+uid))).val();
  if(!ownerIs(uid))return [];
  const results=[];
  for(const intent of Object.values(profile?.heroKozmoCare||{}))if(validIntent(intent)&&intent.status==='pending')results.push(await deliver(uid,intent));
  if(ownerIs(uid))for(const [key,id]of uncertain)if(key.startsWith(uid+':')&&(profile?.heroKozmoCare?.[id]?.status==='complete'||profile?.heroKozmoCare?.[id]?.status==='cancelled'||results.some(result=>result.intent?.id===id&&!result.pending)))uncertain.delete(key);
  return results;
}
