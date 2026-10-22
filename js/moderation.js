// Central moderation operations. Firebase rules authorize the writes; these
// owner/role guards stop stale callbacks and keep acknowledged results truthful.
import { Auth, db, fdb } from './auth.js';

const DEFAULT_REASON = 'Kural İhlali';
const busyTargets = new Set();
let sequence = 0;
const validUid = uid => typeof uid === 'string' && uid.length > 0 && uid.length <= 128 && !/[.#$\[\]\/\x00-\x1f\x7f]/.test(uid);
const roleExists = snap => snap.exists() && snap.val() !== false;
const safeText = (value, fallback = '', max = 160) => typeof value === 'string' ? value.trim().slice(0,max) || fallback : fallback;
const operationId = () => 'mod_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+'_'+(++sequence).toString(36)+'_'+Math.random().toString(36).slice(2));
const errorText = error => safeText(error?.message,'İşlem tamamlanamadı',200);

function context(scope){
  const actor=Auth.getState();
  if(!validUid(actor.uid) || actor.status !== 'google' || (scope==='admin' && actor.isAdmin!==true)) throw new Error('Yetkin yok');
  const ctx={actor,scope,id:operationId(),revoked:false,off:null,role:null,committed:false,targetProtected:false,targetOff:[]};
  ctx.current=()=>!ctx.revoked && !ctx.targetProtected && Auth.getState().uid===actor.uid && Auth.getState().status==='google'
    &&(ctx.role!=='admin'||Auth.getState().isAdmin===true);
  ctx.assert=()=>{if(!ctx.current())throw new Error('Hesap veya yetki değişti');};
  return ctx;
}
async function read(ctx,path){
  ctx.assert();const snapshot=await fdb.get(fdb.ref(db,path));ctx.assert();return snapshot;
}
async function authorize(ctx){
  ctx.assert();
  const admin=await read(ctx,'admins/'+ctx.actor.uid);
  let role=roleExists(admin)?'admin':null;
  if(role==='admin' && Auth.getState().isAdmin!==true)throw new Error('Yönetici oturumunu yenile');
  if(!role && ctx.scope==='staff'){
    const op=await read(ctx,'gcOperators/'+ctx.actor.uid);
    if(op.val()===true)role='operator';
  }
  if(!role || (ctx.scope==='admin'&&role!=='admin'))throw new Error('Yetkin kaldırılmış veya bu işlem için yetersiz');
  if(ctx.role && ctx.role!==role)throw new Error('İşlem sırasında yetki değişti');
  ctx.role=role;
  if(!ctx.off && typeof fdb.onValue==='function'){
    const path=(role==='admin'?'admins/':'gcOperators/')+ctx.actor.uid;
    const off=fdb.onValue(fdb.ref(db,path),snapshot=>{
      if(role==='admin'?!roleExists(snapshot):snapshot.val()!==true)ctx.revoked=true;
    },()=>{ctx.revoked=true;});
    ctx.off=off;ctx.assert();
  }
}
async function targetProfile(ctx,uid,protect=true){
  if(!validUid(uid) || (protect&&uid===ctx.actor.uid))throw new Error('Geçerli başka bir oyuncu seç');
  const profile=(await read(ctx,'users/'+uid)).val();
  if(!profile || typeof profile!=='object' || Array.isArray(profile) || profile.deleted)throw new Error('Oyuncu kaydı bulunamadı');
  if(protect){
    const admin=await read(ctx,'admins/'+uid);
    if(roleExists(admin)||profile.isAdmin===true)throw new Error('Yönetici hesabına bu işlem uygulanamaz');
    if(!ctx.targetWatch && typeof fdb.onValue==='function'){
      ctx.targetWatch=uid;
      ctx.targetOff.push(fdb.onValue(fdb.ref(db,'admins/'+uid),snapshot=>{if(roleExists(snapshot))ctx.targetProtected=true;},()=>{ctx.targetProtected=true;}));
      ctx.targetOff.push(fdb.onValue(fdb.ref(db,'users/'+uid),snapshot=>{const value=snapshot.val();if(!value||value.deleted||value.isAdmin===true)ctx.targetProtected=true;},()=>{ctx.targetProtected=true;}));
      if(ctx.role==='operator')ctx.targetOff.push(fdb.onValue(fdb.ref(db,'gcOperators/'+uid),snapshot=>{if(snapshot.val()===true)ctx.targetProtected=true;},()=>{ctx.targetProtected=true;}));
      ctx.assert();
    }
    if(ctx.role==='operator'){
      const op=await read(ctx,'gcOperators/'+uid);
      if(op.val()===true)throw new Error('Başka bir operatöre bu işlem uygulanamaz');
    }
  }
  return profile;
}
async function modifyProfile(ctx,uid,fields,action){
  await targetProfile(ctx,uid);
  await authorize(ctx);
  let result;
  try{
    result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
      if(!ctx.current() || !profile || typeof profile!=='object' || Array.isArray(profile) || profile.deleted || profile.isAdmin===true)return;
      return {...profile,...fields,heroModerationOps:{...profile.heroModerationOps,[ctx.id]:{actorUid:ctx.actor.uid,action,ts:Date.now()}}};
    },{applyLocally:false});
  }catch(error){
    if(ctx.current()){
      try{
        const saved=(await read(ctx,'users/'+uid+'/heroModerationOps/'+ctx.id)).val();
        if(saved?.actorUid===ctx.actor.uid&&saved.action===action){ctx.committed=true;return;}
      }catch(e){}
    }
    throw error;
  }
  if(!result.committed)throw new Error('Oyuncu değişikliği onaylanmadı');
  ctx.committed=true;
}
async function notify(ctx,uid,icon,text){
  if(!ctx.current()||!validUid(uid))return;
  try{await fdb.set(fdb.ref(db,'userNotifs/'+uid+'/'+ctx.id),{type:'mod',icon,text,ts:Date.now(),fromUid:ctx.actor.uid});}catch(e){}
}
async function notifyStaff(ctx,icon,text){
  if(!ctx.current())return;
  try{
    const [admins,operators]=await Promise.all([read(ctx,'admins'),read(ctx,'gcOperators')]);
    const staff=new Set([...Object.entries(admins.val()||{}).filter(([,value])=>value!==false).map(([uid])=>uid),
      ...Object.entries(operators.val()||{}).filter(([,value])=>value===true).map(([uid])=>uid)]);
    for(const uid of staff){if(!ctx.current())return;if(uid!==ctx.actor.uid)await notify(ctx,uid,icon,text);}
  }catch(e){}
}
async function completed(ctx,uid,name,action,icon,text){
  if(!ctx.current())return;
  await notify(ctx,uid,icon,text);
  await notifyStaff(ctx,icon,safeText(ctx.actor.displayName,'Yönetici',80)+' → '+safeText(name,'Oyuncu',80)+' · '+text);
  if(!ctx.current())return;
  try{await fdb.set(fdb.ref(db,'adminLog/'+ctx.id),{adminUid:ctx.actor.uid,adminNick:safeText(ctx.actor.displayName,'Yönetici',80),target:uid,action,detail:text,ts:Date.now()});}catch(e){}
}
async function perform(uid,scope,objectResult,work){
  let ctx,lock,acquired=false;
  try{
    ctx=context(scope);
    if(!validUid(uid))throw new Error('Geçerli bir oyuncu seç');
    lock=ctx.actor.uid+':'+uid;
    if(busyTargets.has(lock))return objectResult?{ok:false,busy:true,error:'Bu oyuncu için işlem sürüyor'}:false;
    busyTargets.add(lock);acquired=true;
    await authorize(ctx);
    return await work(ctx);
  }catch(error){
    if(ctx?.committed)return objectResult?{ok:true,partial:true,warning:errorText(error)}:true;
    const uncertain=!!ctx?.primaryDispatched&&!/permission|denied|yetki|onaylanmadı/i.test(String(error?.code||error?.message||''));
    return objectResult?{ok:false,error:errorText(error),...(uncertain?{uncertain:true,operationId:ctx.id}:{})}:false;
  }
  finally{ctx?.off?.();ctx?.targetOff?.forEach(off=>off?.());if(acquired)busyTargets.delete(lock);}
}
const reasonText = reason => safeText(reason,DEFAULT_REASON);

export async function globalBan(uid,name,reason){
  return perform(uid,'admin',false,async ctx=>{
    const r=reasonText(reason);await modifyProfile(ctx,uid,{banned:true,banType:'perma',banUntil:null,banReason:r,banMsg:r,bannedAt:Date.now(),bannedBy:ctx.actor.uid,banSource:'global',banIPKey:null},'ban');
    await completed(ctx,uid,name,'ban','🚫','Portaldan yasaklandın. Neden: '+r);return true;
  });
}
export async function globalUnban(uid,name,reason){
  return perform(uid,'admin',false,async ctx=>{
    await modifyProfile(ctx,uid,{banned:false,banReason:null,banMsg:null,banType:null,banUntil:null,banSource:null,banIPKey:null},'unban');
    await completed(ctx,uid,name,'unban','✅','Portal yasağın kaldırıldı. '+reasonText(reason));return true;
  });
}
export async function globalMute(uid,name,reason,durationMin){
  if(durationMin!=null && (!Number.isSafeInteger(durationMin)||durationMin<0||durationMin>525600))return false;
  return perform(uid,'staff',false,async ctx=>{
    const r=reasonText(reason),minutes=durationMin||0;
    await modifyProfile(ctx,uid,{muted:true,muteReason:r,muteUntil:minutes?Date.now()+minutes*60000:null,mutedAt:Date.now(),mutedBy:ctx.actor.uid},'mute');
    await completed(ctx,uid,name,'mute','🔇','Susturuldun'+(minutes?' ('+minutes+' dk)':'')+'. Neden: '+r);return true;
  });
}
export async function globalUnmute(uid,name,reason){
  return perform(uid,'staff',false,async ctx=>{
    await modifyProfile(ctx,uid,{muted:false,muteReason:null,muteUntil:null},'unmute');
    await completed(ctx,uid,name,'unmute','🔊','Susturulman kaldırıldı. '+reasonText(reason));return true;
  });
}
export async function globalKick(uid,name,reason){
  return perform(uid,'admin',true,async ctx=>{
    await targetProfile(ctx,uid);
    const presence=(await read(ctx,'presence/'+uid)).val(),age=Date.now()-Number(presence?.lastSeen||0);
    if(presence?.online!==true||!Number.isFinite(age)||age<0||age>=180000)return{ok:false,notOnline:true,error:safeText(name,'Bu oyuncu',80)+' şu an çevrimiçi değil'};
    await authorize(ctx);ctx.assert();const r=reasonText(reason);
    // Auth.startKickListener consumes this exact path.
    ctx.primaryDispatched=true;
    const kicked=await fdb.runTransaction(fdb.ref(db,'kicks/'+uid),()=>ctx.current()?{ts:Date.now(),reason:r,by:ctx.actor.uid,operationId:ctx.id}:undefined,{applyLocally:false});
    if(!kicked.committed){ctx.primaryDispatched=false;throw new Error('Oturumu kapatma sinyali onaylanmadı');}ctx.committed=true;
    await completed(ctx,uid,name,'kick','🦵','Oturumu kapatma sinyali gönderildi. Neden: '+r);return{ok:true};
  });
}
export async function chatKick(uid,name,reason,activeChatUids){
  return perform(uid,'staff',true,async ctx=>{
    if(Array.isArray(activeChatUids)&&!activeChatUids.includes(uid))return{ok:false,notPresent:true,error:safeText(name,'Bu oyuncu',80)+' şu an sohbet listesinde değil'};
    const r=reasonText(reason);
    // Social chat reads kicked; retain timestamped metadata for other consumers.
    await modifyProfile(ctx,uid,{kicked:true,chatKick:{ts:Date.now(),reason:r,by:ctx.actor.uid}},'chat-kick');
    await completed(ctx,uid,name,'chat-kick','🦵','Sohbetten çıkarıldın. Neden: '+r);
    if(ctx.current()){
      const audience=new Set(Array.isArray(activeChatUids)?activeChatUids.filter(validUid):[]);
      for(const target of audience){if(!ctx.current())break;if(target!==uid&&target!==ctx.actor.uid)await notify(ctx,target,'🦵',safeText(name,'Bir oyuncu',80)+' sohbetten çıkarıldı. Neden: '+r);}
      if(ctx.current())try{await fdb.set(fdb.ref(db,'globalChat/'+ctx.id),{_system:true,sysType:'kick',text:safeText(name,'Bir oyuncu',80)+' sohbetten çıkarıldı ('+r+')',ts:Date.now()});}catch(e){}
    }
    return{ok:true};
  });
}
async function changeOperator(uid,name,desired){
  return perform(uid,'admin',false,async ctx=>{
    await targetProfile(ctx,uid);await authorize(ctx);
    const result=await fdb.runTransaction(fdb.ref(db,'gcOperators/'+uid),()=>ctx.current()?(desired?true:null):undefined,{applyLocally:false});
    if(!result.committed)throw new Error('Operatör değişikliği onaylanmadı');ctx.committed=true;
    await completed(ctx,uid,name,desired?'op-yap':'op-kaldir','🔧',desired?'Sohbet operatörlüğü verildi.':'Sohbet operatörlüğü kaldırıldı.');return true;
  });
}
export async function makeOperator(uid,name){return changeOperator(uid,name,true);}
export async function removeOperator(uid,name){return changeOperator(uid,name,false);}

function validIP(value){
  if(typeof value!=='string'||value!==value.trim()||value.length>45)return false;
  const ipv4=ip=>{const parts=ip.split('.');return parts.length===4&&parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)<=255);};
  if(ipv4(value))return true;
  if(value.includes(':::')||(value.startsWith(':')&&!value.startsWith('::'))||(value.endsWith(':')&&!value.endsWith('::')))return false;
  if(!value.includes(':')||/[^a-f\d:.]/i.test(value)||value.split('::').length>2)return false;
  const parts=value.split(':').filter(Boolean);let count=0;
  for(let i=0;i<parts.length;i++){
    const part=parts[i];if(i===parts.length-1&&part.includes('.')&&ipv4(part))count+=2;
    else if(/^[a-f\d]{1,4}$/i.test(part))count++;else return false;
  }
  return value.includes('::')?count<8:count===8;
}
const ipKey = ip => ip.replace(/[.:#$\[\]\/]/g,'-'); // Same encoding as Auth.ipKey.
export async function getUserIP(uid){
  let ctx;
  try{ctx=context('admin');await authorize(ctx);const profile=await targetProfile(ctx,uid,false);return validIP(profile.lastIP)?profile.lastIP:null;}
  catch(e){return null;}finally{ctx?.off?.();}
}
async function changeIPBan(uid,name,reason,desired){
  return perform(uid,'admin',true,async ctx=>{
    let profile=await targetProfile(ctx,uid);const ip=profile.lastIP;
    if(!validIP(ip))return{ok:false,error:'Geçerli IP bilgisi yok'};
    await authorize(ctx);profile=await targetProfile(ctx,uid);
    if(profile.lastIP!==ip)throw new Error('IP adresi değişti; oyuncuyu yeniden aç');
    ctx.assert();const r=reasonText(reason),key=ipKey(ip),patch={};
    patch['ipBans/'+key]=desired?{ip,reason:r,bannedAt:Date.now(),bannedBy:ctx.actor.uid,by:ctx.actor.uid,targetUid:uid,targetName:safeText(name,'',80),operationId:ctx.id}:null;
    // Remove records made by the old central helper's incompatible encoding.
    const legacy=ip.replace(/\./g,'_');if(!desired&&legacy!==key)patch['ipBans/'+legacy]=null;
    const ownIPBan=profile.banSource==='ip'&&profile.banIPKey===key
      ||profile.banSource==null&&String(profile.banReason||'').startsWith('IP Ban:');
    const unrelatedBan=profile.banned===true&&!ownIPBan;
    const unbanAccount=!desired&&ownIPBan;
    if(desired&&!unrelatedBan||unbanAccount){
      const fields=desired?{banned:true,banType:'perma',banUntil:null,banReason:'IP Ban: '+r,banMsg:'IP Ban: '+r,bannedAt:Date.now(),bannedBy:ctx.actor.uid,banSource:'ip',banIPKey:key}
        :{banned:false,banType:null,banUntil:null,banReason:null,banMsg:null,banSource:null,banIPKey:null};
      for(const [field,value] of Object.entries(fields))patch['users/'+uid+'/'+field]=value;
    }
    // Both primary changes commit or fail together; notification failures are secondary.
    ctx.primaryDispatched=true;await fdb.update(fdb.ref(db),patch);ctx.committed=true;
    await completed(ctx,uid,name,desired?'ipban':'ipban-kaldir','🌐',desired?'IP adresi yasaklandı. Neden: '+r:'IP yasağı kaldırıldı.'+(unbanAccount?' Portal yasağın da kaldırıldı.':' Diğer portal yasakları korunur.'));
    return{ok:true,ip,accountUnbanned:unbanAccount};
  });
}
export async function ipBan(uid,name,reason){return changeIPBan(uid,name,reason,true);}
export async function ipUnban(uid,name,reason){return changeIPBan(uid,name,reason,false);}
export function isEffectiveAdmin(){const st=Auth.getState();return validUid(st.uid)&&st.status==='google'&&st.isAdmin===true;}
export { DEFAULT_REASON };
export default {globalBan,globalUnban,globalMute,globalUnmute,globalKick,chatKick,makeOperator,removeOperator,getUserIP,ipBan,ipUnban};
