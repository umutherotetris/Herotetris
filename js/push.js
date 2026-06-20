// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — PUSH BİLDİRİMLERİ (PWA)
//  Service Worker kaydı + bildirim izni + Firebase canlı dinleme
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

let _swReg = null;
let _notifListener = null;
let _lastNotifTs = 0;

// Yeni SW kontrolü ele aldığında sayfayı BİR KEZ yenile (güncel kod gelsin)
if(typeof navigator !== 'undefined' && 'serviceWorker' in navigator){
  let _swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(_swReloaded) return;
    _swReloaded = true;
    location.reload();
  });
}

// ── Service Worker kaydı ─────────────────────────────────────
export async function registerSW(){
  if(!('serviceWorker' in navigator)) return null;
  try{
    _swReg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    // Güncelleme kontrolü
    _swReg.addEventListener('updatefound', () => {
      const nw = _swReg.installing;
      if(nw) nw.addEventListener('statechange', () => {
        if(nw.state === 'installed' && navigator.serviceWorker.controller){
          // Yeni sürüm hazır
          nw.postMessage('SKIP_WAITING');
        }
      });
    });
    return _swReg;
  }catch(e){ console.warn('[SW] kayıt hatası', e); return null; }
}

// ── Bildirim izni durumu ─────────────────────────────────────
export function notifPermission(){
  if(!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// ── İzin iste ────────────────────────────────────────────────
export async function requestNotifPermission(){
  if(!('Notification' in window)){ alert('Tarayıcın bildirimleri desteklemiyor'); return false; }
  if(Notification.permission === 'granted') return true;
  if(Notification.permission === 'denied'){
    alert('Bildirimler engellenmiş. Tarayıcı ayarlarından izin vermelisin.');
    return false;
  }
  try{
    const perm = await Notification.requestPermission();
    if(perm === 'granted'){
      // Hoş geldin bildirimi
      showLocalNotif('🎮 Hero Portal', 'Bildirimler açıldı! Artık arkadaş istekleri, mesajlar ve davetlerden haberdar olacaksın.', '🔔');
      // Firebase'e izin durumunu yaz
      const st = Auth.getState();
      if(st.uid) try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{ notifEnabled: true }); }catch(e){}
      startNotifListener();
      return true;
    }
    return false;
  }catch(e){ return false; }
}

// ── Yerel bildirim göster (sayfa açık veya SW üzerinden) ─────
export function showLocalNotif(title, body, icon, url){
  if(notifPermission() !== 'granted') return;
  // SW varsa onun üzerinden (uygulama kapalıyken de çalışır)
  if(_swReg && _swReg.active){
    _swReg.active.postMessage({
      type: 'SHOW_NOTIFICATION',
      payload: { title, body, icon, url: url||'./index.html', tag: 'hero-'+Date.now() }
    });
  } else if('Notification' in window){
    // Doğrudan Notification API
    try{
      const n = new Notification(title, { body, tag: 'hero-'+Date.now() });
      n.onclick = () => { window.focus(); n.close(); };
    }catch(e){}
  }
}

// ── Firebase canlı bildirim dinleme ──────────────────────────
// userNotifs'e yeni bir şey gelince → push bildirim göster
export function startNotifListener(){
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google') return;
  if(notifPermission() !== 'granted') return;
  stopNotifListener();
  _lastNotifTs = Date.now();
  const q = fdb.query(fdb.ref(db,'userNotifs/'+st.uid), fdb.limitToLast(1));
  _notifListener = fdb.onChildAdded(q, (snap) => {
    const n = snap.val();
    if(!n || !n.ts) return;
    // Sadece dinleme başladıktan SONRA gelenleri göster (eskiler değil)
    if(n.ts <= _lastNotifTs) return;
    _lastNotifTs = n.ts;
    // Sayfa görünürse bildirim gösterme (kullanıcı zaten içeride)
    if(document.visibilityState === 'visible') return;
    const icon = n.icon || '🔔';
    const text = n.text || n.msg || 'Yeni bildirim';
    showLocalNotif(icon + ' Hero Portal', text, icon, './index.html');
  });
}

export function stopNotifListener(){
  if(_notifListener){
    try{ _notifListener(); }catch(e){}
    _notifListener = null;
  }
}

// ── Başlatma: SW kaydet + izin verildiyse dinlemeyi başlat ──
export async function initPush(){
  await registerSW();
  // İzin zaten verilmişse otomatik dinlemeye başla
  if(notifPermission() === 'granted'){
    setTimeout(() => startNotifListener(), 2000);
  } else {
    // İzin verilmemişse banner öner
    maybeShowNotifPrompt();
  }
}

// ── İlk girişte bildirim izni öner (banner) ──────────────────
export function maybeShowNotifPrompt(){
  if(notifPermission()!=='default') return; // zaten karar verilmiş
  if(localStorage.getItem('hero_notif_prompted')==='1') return;
  const st=Auth.getState();
  if(!st.uid||st.status!=='google') return;
  setTimeout(()=>{
    if(document.getElementById('notifPromptBanner')) return;
    const b=document.createElement('div');
    b.id='notifPromptBanner';
    b.style.cssText='position:fixed;bottom:90px;left:12px;right:12px;max-width:420px;margin:0 auto;background:linear-gradient(135deg,#1a2a4a,#0e1628);border:1.5px solid rgba(124,77,255,.4);border-radius:16px;padding:14px 16px;z-index:9998;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:dailyToastIn .4s ease';
    b.innerHTML='<div style="display:flex;align-items:center;gap:12px">'
      +'<div style="font-size:28px">🔔</div>'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:800;color:#dfe7ff">Bildirimleri Aç</div><div style="font-size:10px;color:#9fb0d8;margin-top:2px">Arkadaş istekleri, mesajlar ve davetlerden anında haberdar ol</div></div>'
      +'</div>'
      +'<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button id="notifPromptYes" style="flex:1;padding:9px;border-radius:10px;border:none;background:linear-gradient(135deg,#7C4DFF,#536DFE);color:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">✅ İzin Ver</button>'
        +'<button id="notifPromptNo" style="padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#9fb0d8;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Sonra</button>'
      +'</div>';
    document.body.appendChild(b);
    b.querySelector('#notifPromptYes').addEventListener('click',async()=>{
      localStorage.setItem('hero_notif_prompted','1');
      b.remove();
      await requestNotifPermission();
    });
    b.querySelector('#notifPromptNo').addEventListener('click',()=>{
      localStorage.setItem('hero_notif_prompted','1');
      b.remove();
    });
  }, 5000);
}

export default initPush;
