// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — PUSH BİLDİRİMLERİ (PWA)
//  Service Worker kaydı + bildirim izni + Firebase canlı dinleme
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';


// Hafif toast helper
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

let _swReg = null;
let _notifListener = null;
let _lastNotifTs = 0;

// ── Bildirim tercihleri (localStorage) ───────────────────────
// Genel açık/kapalı + tür bazlı (davet / mesaj / arkadaşlık / oyun)
const NOTIF_PREF_KEY = 'hero_notif_prefs';
const DEFAULT_PREFS = { enabled:true, invite:true, message:true, friend:true, game:true, system:true };
export function getNotifPrefs(){
  try{ const p = JSON.parse(localStorage.getItem(NOTIF_PREF_KEY)||'null'); if(p) return Object.assign({}, DEFAULT_PREFS, p); }catch(e){}
  return Object.assign({}, DEFAULT_PREFS);
}
export function setNotifPref(key, val){
  const p = getNotifPrefs(); p[key] = !!val;
  try{ localStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(p)); }catch(e){}
  return p;
}
// Bir bildirim türü için: kullanıcı bu türü açık tutuyor mu?
function _prefAllows(notif){
  const p = getNotifPrefs();
  if(!p.enabled) return false;                       // genel kapalıysa hiçbiri
  const type = (notif && notif.type) || '';
  if(type === 'challenge') return p.invite;          // oyun daveti
  if(type === 'dm' || type === 'message') return p.message;
  if(type === 'friendreq') return p.friend;
  if(type === 'poke' || type === 'game') return p.game;
  return p.system;                                   // diğer (sistem)
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
  if(!('Notification' in window)){ _toast('Tarayıcın bildirimleri desteklemiyor'); return false; }
  if(Notification.permission === 'granted') return true;
  if(Notification.permission === 'denied'){
    _toast('Bildirimler engellenmiş. Tarayıcı ayarlarından izin vermelisin.');
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
  if(!getNotifPrefs().enabled) return;   // kullanıcı tüm bildirimleri kapatmış
  stopNotifListener();
  _lastNotifTs = Date.now();
  const q = fdb.query(fdb.ref(db,'userNotifs/'+st.uid), fdb.limitToLast(1));
  _notifListener = fdb.onChildAdded(q, (snap) => {
    const n = snap.val();
    if(!n || !n.ts) return;
    // Sadece dinleme başladıktan SONRA gelenleri göster (eskiler değil)
    if(n.ts <= _lastNotifTs) return;
    _lastNotifTs = n.ts;
    // Kullanıcı bu bildirim türünü kapatmışsa gösterme
    if(!_prefAllows(n)) return;
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


// ════════════ BİLDİRİM AYARLARI PANELİ ════════════
let _npCss = false;
function _ensureNpCss(){
  if(_npCss) return; _npCss = true;
  const s = document.createElement('style');
  s.textContent = `
  .np-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(6,8,18,.82);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:npf .2s}
  @keyframes npf{from{opacity:0}to{opacity:1}}
  .np-panel{width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:linear-gradient(170deg,#161a2e,#0c0e18);border-radius:22px 22px 0 0;border:1px solid rgba(124,77,255,.25);border-bottom:none;padding:18px 16px 26px;animation:nps .26s cubic-bezier(.2,.8,.3,1)}
  @keyframes nps{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .np-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px}
  .np-title{font-size:18px;font-weight:900;color:#dfe7ff}
  .np-x{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#cbd5e1;font-size:18px;cursor:pointer}
  .np-sub{font-size:11px;color:#9fb0d8;margin-bottom:16px}
  .np-perm{display:flex;align-items:center;gap:11px;padding:12px;border-radius:14px;margin-bottom:14px;font-size:12px;font-weight:700}
  .np-perm.ok{background:rgba(105,240,174,.1);border:1px solid rgba(105,240,174,.3);color:#69F0AE}
  .np-perm.no{background:rgba(255,82,82,.1);border:1px solid rgba(255,82,82,.3);color:#ff8a80}
  .np-perm-btn{margin-left:auto;padding:7px 12px;border-radius:9px;border:none;background:linear-gradient(135deg,#7C4DFF,#536DFE);color:#fff;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit}
  .np-row{display:flex;align-items:center;gap:12px;padding:13px;border-radius:13px;background:rgba(255,255,255,.04);margin-bottom:9px}
  .np-row.master{background:rgba(124,77,255,.1);border:1px solid rgba(124,77,255,.25)}
  .np-ic{font-size:22px;width:32px;text-align:center}
  .np-info{flex:1;min-width:0}
  .np-nm{font-size:13px;font-weight:800;color:#e8eaf6}
  .np-desc{font-size:10px;color:#9fb0d8;margin-top:1px}
  .np-tog{position:relative;width:46px;height:26px;flex-shrink:0;border-radius:13px;background:rgba(120,130,160,.3);cursor:pointer;transition:.2s;border:none}
  .np-tog.on{background:linear-gradient(135deg,#69F0AE,#34d399)}
  .np-tog::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 2px 6px rgba(0,0,0,.3)}
  .np-tog.on::after{transform:translateX(20px)}
  .np-sub2{font-size:10px;color:#7d8ab8;text-align:center;margin-top:12px;line-height:1.6}
  `;
  document.head.appendChild(s);
}

export function openNotifSettings(){
  _ensureNpCss();
  const old = document.getElementById('npOv'); if(old) old.remove();
  const perm = notifPermission();
  const prefs = getNotifPrefs();
  const ov = document.createElement('div'); ov.id='npOv'; ov.className='np-ov';

  const permHtml = perm === 'granted'
    ? '<div class="np-perm ok">✅ Bildirim izni verildi</div>'
    : perm === 'denied'
      ? '<div class="np-perm no">🚫 Bildirimler engelli — tarayıcı ayarlarından izin ver</div>'
      : '<div class="np-perm no">🔔 Bildirim izni gerekli<button class="np-perm-btn" id="npAsk">İzin Ver</button></div>';

  const rows = [
    { key:'enabled', ic:'🔔', nm:'Tüm Bildirimler', desc:'Ana açma/kapama anahtarı', master:true },
    { key:'invite',  ic:'⚔️', nm:'Oyun Davetleri', desc:'Biri seni oyuna çağırınca' },
    { key:'message', ic:'💬', nm:'Mesajlar', desc:'Yeni özel mesaj geldiğinde' },
    { key:'friend',  ic:'👥', nm:'Arkadaşlık İstekleri', desc:'Yeni arkadaşlık isteği' },
    { key:'game',    ic:'🎮', nm:'Oyun Bildirimleri', desc:'Dürtme, oyun sırası vb.' },
    { key:'system',  ic:'📢', nm:'Sistem & Duyurular', desc:'Genel bilgilendirmeler' },
  ];
  let rowsHtml = '';
  rows.forEach(r=>{
    const on = prefs[r.key];
    rowsHtml += '<div class="np-row'+(r.master?' master':'')+'">'
      + '<div class="np-ic">'+r.ic+'</div>'
      + '<div class="np-info"><div class="np-nm">'+r.nm+'</div><div class="np-desc">'+r.desc+'</div></div>'
      + '<button class="np-tog'+(on?' on':'')+'" data-pref="'+r.key+'"></button>'
      + '</div>';
  });

  ov.innerHTML = '<div class="np-panel"><div class="np-head"><div class="np-title">🔔 Bildirim Ayarları</div><button class="np-x">✕</button></div>'
    + '<div class="np-sub">Hangi bildirimleri almak istediğini seç</div>'
    + permHtml + rowsHtml
    + '<div class="np-sub2">💡 Bildirimler uygulama açık veya arka plandayken telefonuna gelir. Uygulama tamamen kapalıyken bildirim için uygulamayı ana ekrana ekle (PWA).</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('.np-x').addEventListener('click', ()=>ov.remove());

  const askBtn = ov.querySelector('#npAsk');
  if(askBtn) askBtn.addEventListener('click', async ()=>{ await requestNotifPermission(); ov.remove(); openNotifSettings(); });

  ov.querySelectorAll('[data-pref]').forEach(tog=>tog.addEventListener('click', ()=>{
    const key = tog.dataset.pref;
    const cur = getNotifPrefs()[key];
    setNotifPref(key, !cur);
    tog.classList.toggle('on', !cur);
    // Genel kapatılırsa dinlemeyi durdur, açılırsa başlat
    if(key === 'enabled'){
      if(!cur){ if(notifPermission()==='granted') startNotifListener(); }
      else { stopNotifListener(); }
    }
  }));
}

// Global erişim
try{ window.Hero = window.Hero || {}; window.Hero.openNotifSettings = openNotifSettings; }catch(e){}
