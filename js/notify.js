// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — BİLDİRİM SİSTEMİ
//  Kategoriler: kişisel · admin · klan · yayın (broadcast)
//  Hedefler: tek kullanıcı · tüm adminler · eylem yapan admin ·
//            klan yöneticileri · tüm kullanıcılar · operatörler
// ════════════════════════════════════════════════════════════════
import Auth, { db, fdb } from './auth.js';

// Bildirim tipleri ve görsel temaları
export const NOTIF_TYPES = {
  // Kişisel (sadece alıcı görür)
  friend_add:   { icon:'👥', color:'#42A5F5', cat:'personal' },
  friend_accept:{ icon:'🤝', color:'#69F0AE', cat:'personal' },
  dm:           { icon:'✉️', color:'#42A5F5', cat:'personal' },
  poke:         { icon:'👉', color:'#FFA726', cat:'personal' },
  challenge:    { icon:'⚔️', color:'#FF7043', cat:'personal' },
  gift_kaju:    { icon:'🎁', color:'#FFD740', cat:'personal' },
  gift_kozmo:   { icon:'🥚', color:'#AB47BC', cat:'personal' },
  clan_invite:  { icon:'🏰', color:'#FFD740', cat:'personal' },
  // Admin eylemleri (kişiye)
  warn:         { icon:'⚠️', color:'#FF5252', cat:'admin_to_user' },
  mute:         { icon:'🔇', color:'#FF5252', cat:'admin_to_user' },
  kick:         { icon:'🦵', color:'#FF5252', cat:'admin_to_user' },
  unmute:       { icon:'🔊', color:'#69F0AE', cat:'admin_to_user' },
  kaju_admin:   { icon:'🪙', color:'#FFD740', cat:'admin_to_user' },
  // Admin bilgilendirme (tüm adminler görür)
  admin_action: { icon:'🛡️', color:'#FFD740', cat:'admin_log' },
  new_user:     { icon:'🆕', color:'#69F0AE', cat:'admin_log' },
  report:       { icon:'🚨', color:'#FF5252', cat:'admin_log' },
  // Klan yönetimi (klan yöneticileri görür)
  clan_join:    { icon:'🏰', color:'#FFD740', cat:'clan_admin' },
  clan_leave:   { icon:'🚪', color:'#FFA726', cat:'clan_admin' },
  clan_request: { icon:'📨', color:'#42A5F5', cat:'clan_admin' },
  // Yayın (tüm kullanıcılar)
  broadcast:    { icon:'📢', color:'#FFD740', cat:'broadcast' },
  event:        { icon:'🎉', color:'#FF4081', cat:'broadcast' },
  season:       { icon:'🏆', color:'#FFD740', cat:'broadcast' },
  // Durum (giriş/çıkış)
  presence_in:  { icon:'🟢', color:'#69F0AE', cat:'status' },
  presence_out: { icon:'⚪', color:'#7070a0', cat:'status' },
};

function _me(){ return Auth.getState(); }

// ── TEK KULLANICIYA bildirim gönder ──
export async function notifyUser(uid, type, text, extra){
  if(!uid) return;
  const t = NOTIF_TYPES[type] || { icon:'🔔', color:'#9fb0d8' };
  const me = _me();
  try{
    await fdb.push(fdb.ref(db, 'userNotifs/' + uid), {
      type, icon: t.icon, text: text || '', ts: Date.now(),
      fromUid: me.uid || null, fromName: me.displayName || null,
      ...(extra || {})
    });
  }catch(e){ console.warn('[notify] user', e); }
}

// ── TÜM ADMİNLERE bildirim (admin_log kanalı) ──
export async function notifyAdmins(type, text, extra){
  const t = NOTIF_TYPES[type] || { icon:'🛡️', color:'#FFD740' };
  const me = _me();
  try{
    await fdb.push(fdb.ref(db, 'adminLog'), {
      type, icon: t.icon, text: text || '', ts: Date.now(),
      actorUid: me.uid || null, actorName: me.displayName || null,
      ...(extra || {})
    });
  }catch(e){ console.warn('[notify] admins', e); }
}

// ── SADECE EYLEMİ YAPAN ADMİNE onay bildirimi (local toast) ──
export function notifySelf(text, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(text, !!isErr); return; } }catch(e){}
}

// ── KLAN YÖNETİCİLERİNE bildirim ──
export async function notifyClanAdmins(clanId, type, text, extra){
  if(!clanId) return;
  const t = NOTIF_TYPES[type] || { icon:'🏰', color:'#FFD740' };
  const me = _me();
  try{
    // Klan liderlerini bul
    const snap = await fdb.get(fdb.ref(db, 'clans/' + clanId + '/members'));
    if(!snap.exists()) return;
    const members = snap.val();
    const leaders = Object.entries(members)
      .filter(([uid, m]) => m && (m.role === 'leader' || m.role === 'vice' || m.role === 'co-leader'))
      .map(([uid]) => uid);
    // Her lidere bildir
    for(const luid of leaders){
      await fdb.push(fdb.ref(db, 'userNotifs/' + luid), {
        type, icon: t.icon, text: text || '', ts: Date.now(),
        fromUid: me.uid || null, fromName: me.displayName || null,
        clanId, ...(extra || {})
      });
    }
  }catch(e){ console.warn('[notify] clan', e); }
}

// ── TÜM KULLANICILARA yayın (broadcast kanalı) ──
export async function broadcast(type, text, extra){
  const me = _me();
  if(me.isAdmin !== true) return;  // sadece admin yayın yapabilir
  const t = NOTIF_TYPES[type] || { icon:'📢', color:'#FFD740' };
  try{
    await fdb.set(fdb.ref(db, 'broadcasts/latest'), {
      type, icon: t.icon, text: text || '', ts: Date.now(),
      fromName: me.displayName || 'Yönetim', ...(extra || {})
    });
  }catch(e){ console.warn('[notify] broadcast', e); }
}

// ── KAJU HEDİYESİ bildirimi (özel) ──
export async function notifyKajuGift(toUid, amount, fromName){
  await notifyUser(toUid, 'gift_kaju',
    (fromName || 'Bir oyuncu') + ' sana ' + amount + ' 🥜 Kaju hediye etti!',
    { amount });
}

// ── SOHBET GİRİŞ/ÇIKIŞ bildirimleri (durum) ──
// Bunlar sohbete yazılır (globalChat'e sistem mesajı), kişiye değil
export async function chatPresence(inOut, nick){
  const me = _me();
  if(!me.uid || me.status !== 'google') return;
  try{
    await fdb.push(fdb.ref(db, 'globalChat'), {
      system: true,
      presenceType: inOut,  // 'in' | 'out'
      text: (nick || me.displayName || 'Biri') + (inOut === 'in' ? ' sohbete katıldı 🟢' : ' sohbetten ayrıldı ⚪'),
      ts: Date.now(),
      uid: me.uid,
    });
  }catch(e){ console.warn('[notify] chatPresence', e); }
}

// ── Admin log dinleyici (admin panelinde kullanılır) ──
export function watchAdminLog(cb, limit){
  const me = _me();
  if(me.isAdmin !== true) return () => {};
  try{
    const q = fdb.query(fdb.ref(db, 'adminLog'), fdb.limitToLast(limit || 30));
    return fdb.onValue(q, snap => {
      const rows = [];
      if(snap.exists()) snap.forEach(ch => { const v = ch.val(); if(v) rows.push({ ...v, _key: ch.key }); });
      rows.sort((a,b) => (b.ts||0) - (a.ts||0));
      cb(rows);
    });
  }catch(e){ return () => {}; }
}

// ── Broadcast dinleyici (tüm kullanıcılar) ──
let _lastBroadcastTs = 0;
export function watchBroadcasts(){
  try{
    _lastBroadcastTs = parseInt(localStorage.getItem('hero_last_broadcast') || '0');
  }catch(e){}
  try{
    return fdb.onValue(fdb.ref(db, 'broadcasts/latest'), snap => {
      if(!snap.exists()) return;
      const b = snap.val();
      if(!b || !b.ts || b.ts <= _lastBroadcastTs) return;
      _lastBroadcastTs = b.ts;
      try{ localStorage.setItem('hero_last_broadcast', String(b.ts)); }catch(e){}
      showBroadcastBanner(b);
    });
  }catch(e){ return () => {}; }
}

function showBroadcastBanner(b){
  const ex = document.getElementById('broadcastBanner'); if(ex) ex.remove();
  const el = document.createElement('div');
  el.id = 'broadcastBanner';
  el.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:100003;display:flex;align-items:center;gap:11px;background:linear-gradient(135deg,rgba(40,32,8,.98),rgba(20,16,4,.98));border:1px solid rgba(255,215,64,.5);border-radius:16px;padding:13px 18px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.6);cursor:pointer;animation:bcIn .45s cubic-bezier(.34,1.56,.64,1)';
  el.innerHTML = '<span style="font-size:24px">' + (b.icon || '📢') + '</span>'
    + '<div><div style="font-size:11px;font-weight:900;color:#FFD740">' + (b.fromName || 'Yönetim') + '</div>'
    + '<div style="font-size:12px;color:#eef2ff;margin-top:2px">' + esc(b.text || '') + '</div></div>';
  document.body.appendChild(el);
  el.addEventListener('click', () => el.remove());
  if(!document.getElementById('bcCSS')){
    const s = document.createElement('style'); s.id = 'bcCSS';
    s.textContent = '@keyframes bcIn{from{transform:translateX(-50%) translateY(-60px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
    document.head.appendChild(s);
  }
  setTimeout(() => { if(el.parentNode){ el.style.transition='opacity .4s'; el.style.opacity='0'; setTimeout(()=>el.remove(),400); } }, 6000);
}

function esc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default { notifyUser, notifyAdmins, notifySelf, notifyClanAdmins, broadcast, notifyKajuGift, chatPresence, watchAdminLog, watchBroadcasts, NOTIF_TYPES };
