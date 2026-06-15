// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — MERKEZİ MODERASYON SİSTEMİ
//  Ban/Unban/Kick/Mute/Unmute — bildirimli, nedenli
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

const DEFAULT_REASON = 'Kural İhlali';
const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ── Bildirim gönderici ───────────────────────────────────────
async function notify(uid, icon, text){
  if(!uid) return;
  try{ await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon,text,ts:Date.now()}); }catch(e){}
}

// Tüm adminlere + sohbet operatörlerine bildir
async function notifyStaff(icon, text, exceptUid){
  try{
    const [admSnap, opSnap] = await Promise.all([
      fdb.get(fdb.ref(db,'admins')),
      fdb.get(fdb.ref(db,'gcOperators')),
    ]);
    const staff = new Set();
    if(admSnap.exists()) Object.keys(admSnap.val()||{}).forEach(u=>{ if(admSnap.val()[u]) staff.add(u); });
    if(opSnap.exists()) Object.keys(opSnap.val()||{}).forEach(u=>{ if(opSnap.val()[u]) staff.add(u); });
    for(const uid of staff){
      if(uid === exceptUid) continue;
      await notify(uid, icon, text);
    }
  }catch(e){}
}

// ── 🌐 GLOBAL BAN ────────────────────────────────────────────
export async function globalBan(targetUid, targetName, reason){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  try{
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ banned:true, banReason:r, bannedAt:Date.now(), bannedBy:me.uid });
    // Bildirimler
    await notify(targetUid, '🚫', 'OYUNDAN BANLANDIN! Neden: '+r);
    await notifyStaff('🚫', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' BANLANDI. Neden: '+r, me.uid);
    return true;
  }catch(e){ return false; }
}
export async function globalUnban(targetUid, targetName, reason){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  try{
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ banned:false, banReason:null });
    await notify(targetUid, '✅', 'Oyun banın kaldırıldı! Tekrar hoş geldin. ('+r+')');
    await notifyStaff('✅', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' BANI KALDIRILDI. ('+r+')', me.uid);
    return true;
  }catch(e){ return false; }
}

// ── 🔇 GLOBAL MUTE ───────────────────────────────────────────
export async function globalMute(targetUid, targetName, reason, durationMin){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  const muteUntil = durationMin ? Date.now() + durationMin*60000 : null;
  try{
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ muted:true, muteReason:r, muteUntil, mutedAt:Date.now(), mutedBy:me.uid });
    const durTxt = durationMin ? ' ('+durationMin+' dk)' : '';
    await notify(targetUid, '🔇', 'SUSTURULDUN'+durTxt+'! Neden: '+r);
    await notifyStaff('🔇', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' SUSTURULDU'+durTxt+'. Neden: '+r, me.uid);
    return true;
  }catch(e){ return false; }
}
export async function globalUnmute(targetUid, targetName, reason){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  try{
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ muted:false, muteReason:null, muteUntil:null });
    await notify(targetUid, '🔊', 'Susturulman kaldırıldı! Tekrar yazabilirsin. ('+r+')');
    await notifyStaff('🔊', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' SUSTURMASI KALDIRILDI. ('+r+')', me.uid);
    return true;
  }catch(e){ return false; }
}

// ── 🦵 GLOBAL KICK (oyundan/portaldan at) ────────────────────
export async function globalKick(targetUid, targetName, reason){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  try{
    // Kick sinyali: kullanıcı bunu görünce çıkış yapar
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ kickSignal:{ ts:Date.now(), reason:r, by:me.uid } });
    await notify(targetUid, '🦵', 'OYUNDAN ATILDIN! Neden: '+r);
    await notifyStaff('🦵', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' OYUNDAN ATILDI. Neden: '+r, me.uid);
    return true;
  }catch(e){ return false; }
}

// ── 💬 SOHBET KICK (sadece sohbetten at) ─────────────────────
// Bildirim: atılan + sohbette olanlar + admin/operatörler
export async function chatKick(targetUid, targetName, reason, activeChatUids){
  const r = (reason||'').trim() || DEFAULT_REASON;
  const me = Auth.getState();
  try{
    // Sohbet kick işareti
    await fdb.update(fdb.ref(db,'users/'+targetUid),{ chatKick:{ ts:Date.now(), reason:r, by:me.uid } });
    // Atılan kişiye
    await notify(targetUid, '🦵', 'SOHBETTEN ATILDIN! Neden: '+r);
    // Sohbette olanlara (varsa liste)
    if(Array.isArray(activeChatUids)){
      for(const uid of activeChatUids){
        if(uid===targetUid||uid===me.uid) continue;
        await notify(uid, '🦵', esc(targetName||'Bir oyuncu')+' sohbetten atıldı. Neden: '+r);
      }
    }
    // Admin + operatörlere
    await notifyStaff('🦵', (me.displayName||'Admin')+' → '+(targetName||'bir oyuncu')+' SOHBETTEN ATILDI. Neden: '+r, me.uid);
    // Sistem mesajı (sohbete)
    await fdb.push(fdb.ref(db,'globalChat'),{ _system:true, sysType:'kick', text:esc(targetName||'Bir oyuncu')+' sohbetten atıldı ('+r+')', ts:Date.now() });
    return true;
  }catch(e){ return false; }
}

// ── Yetki kontrolü: efektif admin (gizli mod dahil) ──────────
export function isEffectiveAdmin(){
  const st = Auth.getState();
  return st.isAdmin === true; // gizli mod isAdmin'i değiştirmez, sadece görünürlüğü
}

export { DEFAULT_REASON };
export default { globalBan, globalUnban, globalMute, globalUnmute, globalKick, chatKick };
