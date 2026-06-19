// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — AUTH (TEK DOĞRULUK KAYNAĞI)
//
//  Eski 20 auth yamasının (v268…v1200) yerini alan TEK modül.
//  İlke: kimlik DAİMA firebase.auth().currentUser'dan türetilir.
//  localStorage'dan kimlik basılmaz → "yarı login / yarı guest" İMKANSIZ.
//
//  Dışa açtığı API:
//    Auth.subscribe(fn)  → durum değişiminde fn(state) çağrılır; unsubscribe döner
//    Auth.getState()     → anlık {status, user, uid, profile, isAdmin, displayName}
//    Auth.loginGoogle()  → Google ile giriş (popup → redirect yedeği → anonse link)
//    Auth.logout()       → çıkış
//    Auth.db, Auth.ready → RTDB referansı ve hazır-promise'i
//
//  status: 'boot' | 'google' | 'anon' | 'offline'
// ════════════════════════════════════════════════════════════════
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js';


// Hafif toast helper
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
const { initializeApp } = await import(`${BASE}/firebase-app.js`);
const {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence,
  signInAnonymously, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, linkWithPopup, signInWithCredential, signOut
} = await import(`${BASE}/firebase-auth.js`);
const { getDatabase, ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst, limitToLast, orderByKey, startAt, endAt, onChildAdded } = await import(`${BASE}/firebase-database.js`);

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ── TEK durum nesnesi ───────────────────────────────────────────
const state = {
  status: 'boot',     // boot | google | anon | offline
  user: null,         // Firebase user
  uid: null,
  profile: null,      // /users/{uid} (sadece doğrulanmış kullanıcı için)
  isAdmin: false,     // /admins/{uid} var mı (sunucu kontrollü — güvenli)
  displayName: ''     // gösterilecek ad (türetilmiş)
};

const listeners = new Set();
export function subscribe(fn){ listeners.add(fn); try{ fn(getState()); }catch(e){ console.error(e); } return () => listeners.delete(fn); }
export function getState(){
  let um=false; try{ um = localStorage.getItem('hero_usermode')==='1'; }catch(e){}
  return Object.assign({}, state, { isVisibleAdmin: state.isAdmin===true && !um, isUserMode: um });
}
function emit(){ const s = getState(); listeners.forEach(fn => { try{ fn(s); }catch(e){ console.error('[auth] listener', e); } }); }

function statusOf(user){ if(!user) return 'offline'; return user.isAnonymous ? 'anon' : 'google'; }

function deriveName(user, profile){
  if(profile && profile.nick) return String(profile.nick);
  if(profile && (profile.name || profile.displayName)) return String(profile.name || profile.displayName);
  if(user && !user.isAnonymous && user.displayName) return user.displayName;
  return 'Misafir Oyuncu';
}

// Auth değişince TÜM türetilmiş durumu yeniden hesapla (tek yer)
async function hydrate(user){
  state.user = user;
  state.uid  = user ? user.uid : null;
  state.status = statusOf(user);

  if(user){
    // Admin: yalnızca /admins/{uid} (sunucu kontrollü, güvenli)
    try { const a = await get(ref(db, 'admins/' + user.uid)); state.isAdmin = a.exists(); }
    catch(e){ state.isAdmin = false; }
    // Profil
    try { const p = await get(ref(db, 'users/' + user.uid)); state.profile = p.exists() ? p.val() : null; }
    catch(e){ state.profile = null; }
  } else {
    state.isAdmin = false;
    state.profile = null;
  }
  state.displayName = deriveName(user, state.profile);
  emit();
  // Günlük giriş kontrolü (Google girişinde)
  if(state.status==='google'&&state.uid){
    setTimeout(async()=>{try{const m=await import('./daily.js');await m.checkDailyLogin();}catch(e){}},1500);
    setTimeout(async()=>{try{const m=await import('./push.js');m.startNotifListener();}catch(e){}},2500);
  }
  startPresence();                                  // çevrimiçilik: presence/{uid}
  startKickListener();                              // 🦵 admin atarsa oturumu yenile
  checkIPAndBan();                                  // 🌐 IP kaydet + IP banı uygula
  // Google kullanıcısının nick'i yoksa arka planda benzersiz bir nick üret (engellemeden)
  if(user && !user.isAnonymous){ ensureNick(); }   // nick yoksa üret; varsa kayıt defterini onar
}

// ── PRESENCE: çevrimiçi durumu (admin paneli + arkadaş listesi kullanır) ──
let _presT = null, _presVis = null;
function startPresence(){
  stopPresence();
  if(!state.uid) return;
  if(isGhost() && state.isAdmin === true) return;   // 👻 ghost: presence yazma
  const pref = ref(db, 'presence/' + state.uid);
  const write = () => { try{ set(pref, { online:true, lastSeen: Date.now(), name: state.displayName || 'Oyuncu', uid: state.uid }); }catch(e){} };
  try{ onDisconnect(pref).update({ online:false, lastSeen: Date.now() }); }catch(e){}
  write();
  _presT = setInterval(() => { if(!document.hidden) write(); }, 60000);
  _presVis = () => { if(!document.hidden) write(); };
  document.addEventListener('visibilitychange', _presVis);
}
// 🌐 IP: yakala → users/{uid}/lastIP yaz → ipBans kontrolü (banlıysa kilitle)
export function ipKey(ip){ return String(ip||'').replace(/[.:#$\[\]\/]/g,'-'); }
let _ipDone = false;
async function checkIPAndBan(){
  if(_ipDone || !state.uid) return; _ipDone = true;
  let ip = null;
  try{
    const r = await fetch('https://api.ipify.org?format=json', { cache:'no-store' });
    ip = (await r.json()).ip || null;
  }catch(e){}
  if(!ip) return;
  state.lastIP = ip;
  try{ await update(ref(db, 'users/' + state.uid), { lastIP: ip, lastIPAt: Date.now() }); }catch(e){}
  try{
    const snap = await get(ref(db, 'ipBans/' + ipKey(ip)));
    if(snap.exists()){
      const v = snap.val() || {};
      document.body.innerHTML = '<div style="position:fixed;inset:0;background:#0a0a14;color:#ff8fa0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;font-family:sans-serif;text-align:center;padding:24px"><div style="font-size:40px">🚫</div><b style="font-size:18px">IP adresin engellendi</b><div style="font-size:13px;color:#aab">' + String(v.reason||'').replace(/[<>]/g,'') + '</div></div>';
      try{ await signOut(auth); }catch(e){}
    }
  }catch(e){ /* ipBans okunamadı (kural v526 değilse) — sessiz geç */ }
}

// 👻 GHOST modu (admin): presence yazımını kapat/aç — listelerde görünmez
export async function setGhost(on){
  try{ localStorage.setItem('hero_ghost', on ? '1' : '0'); }catch(e){}
  if(on){
    stopPresence();
    try{ await set(ref(db, 'presence/' + state.uid), { online:false, lastSeen: Date.now() }); }catch(e){}
  } else {
    startPresence();
  }
  return on;
}
export function isGhost(){ try{ return localStorage.getItem('hero_ghost') === '1'; }catch(e){ return false; } }
// 🥸 Kullanıcı Modu: admin yetkileri korunur ama rozet/görünürlük gizlenir
export function setUserMode(on){ try{ localStorage.setItem('hero_usermode', on?'1':'0'); }catch(e){} emit(); }
export function isUserMode(){ try{ return localStorage.getItem('hero_usermode')==='1'; }catch(e){ return false; } }
// Görünür admin mi? (isAdmin && !userMode) — başkalarının gördüğü
export function isVisibleAdmin(){ return state.isAdmin === true && !isUserMode(); }

// 🦵 Kick dinleyici: kicks/{uid} taze bir kayıt alırsa kullanıcıyı bilgilendir + yenile
let _kickOff = null, _kickBootTs = Date.now();
function startKickListener(){
  if(_kickOff){ try{ _kickOff(); }catch(e){} _kickOff = null; }
  if(!state.uid) return;
  try{
    _kickOff = onValue(ref(db, 'kicks/' + state.uid), (snap) => {
      if(!snap.exists()) return;
      const v = snap.val() || {};
      if((v.ts || 0) < _kickBootTs) return;          // eski kayıt — yok say
      try{ set(ref(db, 'kicks/' + state.uid), null); }catch(e){}
      _toast('🦵 Yönetici tarafından oyundan atıldın.' + (v.reason ? '\nSebep: ' + v.reason : ''));
      location.reload();
    });
  }catch(e){}
}

function stopPresence(){
  if(_presT){ clearInterval(_presT); _presT = null; }
  if(_presVis){ try{ document.removeEventListener('visibilitychange', _presVis); }catch(e){} _presVis = null; }
}

onAuthStateChanged(auth, (user) => { hydrate(user); });

// ── Açılış: oturumu garantiye al ────────────────────────────────
let _resolveReady;
export const ready = new Promise(r => { _resolveReady = r; });

async function boot(){
  await setPersistence(auth, browserLocalPersistence)
    .catch(() => setPersistence(auth, browserSessionPersistence).catch(() => {}));

  // "Giriş bekleniyor" işareti (redirect başlatıldı mı?)
  let pendingLogin = false;
  try { pendingLogin = sessionStorage.getItem('hero_login_pending') === '1'; } catch(e){}

  // Redirect'ten dönüldü mü? (popup engellenince redirect yedeği kullanıldıysa)
  let redirectUser = null;
  try {
    const res = await getRedirectResult(auth);
    if(res && res.user){ redirectUser = res.user; }
  } catch(e){ console.warn('[auth] redirectResult', e&&e.code); }

  // Redirect başarılı → temizle ve kullan
  if(redirectUser){
    try{ sessionStorage.removeItem('hero_login_pending'); }catch(e){}
    try{ localStorage.removeItem('hero_login_redirect_ts'); }catch(e){}
    _resolveReady(getState());
    return;
  }

  // Redirect bekleniyordu ama sonuç boş döndü (Firefox storage izolasyonu olası)
  // → kısa ek bekleme ver, currentUser oturabilir
  if(pendingLogin){
    // Eğer redirect 60sn'den eskiyse bayat say, temizle
    let stale = false;
    try{
      const ts = parseInt(localStorage.getItem('hero_login_redirect_ts')||'0');
      if(ts && (Date.now()-ts) > 60000) stale = true;
    }catch(e){}
    if(stale){
      try{ sessionStorage.removeItem('hero_login_pending'); }catch(e){}
      try{ localStorage.removeItem('hero_login_redirect_ts'); }catch(e){}
      pendingLogin = false;
    }
  }

  // Kısa beklemeden sonra hâlâ kullanıcı yoksa anonim başlat
  setTimeout(async () => {
    if(!auth.currentUser && !pendingLogin){
      try { await signInAnonymously(auth); }
      catch(e){ state.status = 'offline'; emit(); }
    }
    // pendingLogin doğruysa anonim başlatmadık ama flag'i temizle (sonraki açılışta takılmasın)
    try { sessionStorage.removeItem('hero_login_pending'); } catch(e){}
    _resolveReady(getState());
  }, pendingLogin ? 2500 : 600);
}

// ── Google ile giriş: popup → redirect yedeği → anonse link ─────
// Firefox tespiti (popup blokluyor — redirect kullan)
function isFirefox(){ return typeof navigator !== 'undefined' && /Firefox/i.test(navigator.userAgent); }

export async function loginGoogle(){
  const provider = new GoogleAuthProvider();
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(e){}

  const cur = auth.currentUser;
  const isAnon = !!(cur && cur.isAnonymous);

  // ── ADIM 1: Anonim kullanıcıysa önce LINK dene ──
  // Başarılıysa anonim veriler Google hesabına taşınır.
  // credential-already-in-use gelirse → o Google hesabı zaten var,
  // anonimi bırakıp doğrudan o hesaba gireceğiz (ADIM 2).
  if(isAnon){
    try{
      await linkWithPopup(cur, provider);
      return { ok: true };
    }catch(e){
      const code = (e && e.code) || '';
      // Google hesabı zaten kayıtlı → credential'ı yakala, direkt giriş yap
      if(code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'){
        let cred = null;
        try{ cred = GoogleAuthProvider.credentialFromError(e); }catch(_){}
        if(cred){
          try{
            await signInWithCredential(auth, cred);
            return { ok: true, switchedAccount: true };
          }catch(e2){ console.warn('[auth] signInWithCred', e2&&e2.code); }
        }
        // credential alınamadı → anonimden çık (temiz başlangıç), ADIM 2'ye düş
        console.warn('[auth] credential alınamadı, anonim oturum kapatılıp tekrar denenecek');
        try{ await signOut(auth); }catch(_){}
      } else {
        // Başka popup hatası → ortak hata bloğuna gönder
        return _handlePopupError(e, provider);
      }
    }
  }

  // ── ADIM 2: Düz Google girişi (anonim değil VEYA link başarısız) ──
  try{
    await signInWithPopup(auth, provider);
    return { ok: true, switchedAccount: isAnon };
  }catch(e){
    return _handlePopupError(e, provider);
  }
}

// Popup hatalarını ortak işle (blok/iptal/redirect yedeği)
async function _handlePopupError(e, provider){
  const code = (e && e.code) || '';
  // Kullanıcı popup'ı kendi kapattı
  if(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request'){
    return { ok: false, code, message: 'İşlem iptal edildi', userCancelled: true };
  }
  // Popup engellendi → redirect yedeği
  const popupBlocked = /popup/i.test(code) || /blocked/i.test(code) || code === 'auth/web-storage-unsupported';
  if(popupBlocked){
    try{
      try{ sessionStorage.setItem('hero_login_pending', '1'); }catch(_){}
      try{ localStorage.setItem('hero_login_redirect_ts', String(Date.now())); }catch(_){}
      await signInWithRedirect(auth, provider);
      return { ok: true, redirect: true };
    }catch(e2){
      try{ sessionStorage.removeItem('hero_login_pending'); }catch(_){}
      return { ok: false, code: (e2&&e2.code)||code, message: (e2&&e2.message)||'', popupBlocked: true };
    }
  }
  return { ok: false, code, message: (e&&e.message)||'' };
}

export async function logout(){ try { await signOut(auth); } catch(e){ console.error('[auth] logout', e); } }

// RTDB erişimini diğer modüllere aç (friends/chat/shop sonraki aşamalarda kullanacak)
export { db, auth };
// Veritabanı yardımcıları — store.js ve oyunlar tekrar import etmeden kullanır
export const fdb = { ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst, limitToLast, orderByKey, startAt, endAt, onChildAdded };

boot();

// ════════════════════════════════════════════════════════════════
//  NICK — portal-geneli BENZERSİZ takma ad
//  Kayıt defteri: nicks/{anahtar} = { uid, nick, ts }   (anahtar = TR-duyarlı küçük harf)
//  users/{uid}/nick = tek doğruluk kaynağı.
//  Atomik claim = runTransaction (yalnız boşsa veya zaten sahibiyse yazılır) → benzersizlik + spoof koruması.
// ════════════════════════════════════════════════════════════════
const NICK_MIN = 3, NICK_MAX = 16;
const NICK_RE = /^[A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]+$/;
function nickKey(nick){ return String(nick||'').replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase(); }

export function validateNick(nick){
  const clean = String(nick||'').trim();
  if(clean.length < NICK_MIN) return { ok:false, error:`En az ${NICK_MIN} karakter olmalı` };
  if(clean.length > NICK_MAX) return { ok:false, error:`En fazla ${NICK_MAX} karakter olabilir` };
  if(!NICK_RE.test(clean)) return { ok:false, error:'Sadece harf, rakam ve _ (boşluk/işaret yok)' };
  return { ok:true, clean };
}

// Nick boşta mı? { available, clean } | { available:false, error }
export async function checkNick(nick){
  const v = validateNick(nick); if(!v.ok) return { available:false, error:v.error };
  try{
    const nb = await get(ref(db, 'nickBans/' + nickKey(v.clean)));
    if(nb.exists() && state.isAdmin !== true) return { available:false, error:'Bu nick yasaklı' };
    const snap = await get(ref(db, 'nicks/' + nickKey(v.clean)));
    if(snap.exists() && snap.val().uid !== state.uid) return { available:false, error:'Bu nick alınmış' };
    return { available:true, clean:v.clean };
  }catch(e){ return { available:false, error:'Şu an kontrol edilemedi' }; }
}

// Nick al/değiştir — ATOMİK. { ok, nick } | { ok:false, error }
export async function setNick(desired){
  if(!state.uid || state.status !== 'google') return { ok:false, error:'Nick için Google ile giriş gerekli' };
  const v = validateNick(desired); if(!v.ok) return v;
  const key = nickKey(v.clean);
  try{
    const nb = await get(ref(db, 'nickBans/' + key));
    if(nb.exists() && state.isAdmin !== true) return { ok:false, error:'Bu nick yasaklı' };
  }catch(e){}
  const nref = ref(db, 'nicks/' + key);
  let claimed = false;
  try{
    const res = await runTransaction(nref, (cur) => {
      if(cur === null){ claimed = true; return { uid: state.uid, nick: v.clean, ts: Date.now() }; }
      if(cur.uid === state.uid){ claimed = true; return { uid: state.uid, nick: v.clean, ts: cur.ts || Date.now() }; }
      return;   // dolu (başkasının) → iptal
    });
    if(!res.committed || !claimed) return { ok:false, error:'Bu nick alınmış' };
  }catch(e){ return { ok:false, error:'Nick alınamadı (bağlantı?)' }; }
  // users/{uid}/nick güncelle (name'i de eşitle: eski displayName tabanlı listeler için)
  try{ await update(ref(db, 'users/' + state.uid), { nick: v.clean, name: v.clean }); }catch(e){}
  // Eski nick'i serbest bırak
  const oldKey = (state.profile && state.profile.nick) ? nickKey(state.profile.nick) : null;
  if(oldKey && oldKey !== key){ try{ await set(ref(db, 'nicks/' + oldKey), null); }catch(e){} }
  if(!state.profile) state.profile = {};
  state.profile.nick = v.clean; state.profile.name = v.clean;
  state.displayName = v.clean; emit();
  return { ok:true, nick: v.clean };
}

// Nick → { uid, nick } | null  (kayıt defterinden, hızlı + benzersiz)
export async function resolveNick(nick){
  const key = nickKey(nick);
  if(!key) return null;
  try{
    const snap = await get(ref(db, 'nicks/' + key));
    if(snap.exists()) return { uid: snap.val().uid, nick: snap.val().nick || String(nick).trim() };
  }catch(e){}
  return null;
}

// Nick'leri ön ekle ara (canlı liste): 'ni' → NitrikOksit… Harf duyarsız (anahtarlar küçük).
export async function searchNicks(prefix, limit){
  const k = nickKey(String(prefix||'').trim());
  if(k.length < 2) return [];
  try{
    const snap = await get(query(ref(db,'nicks'), orderByKey(), startAt(k), endAt(k + '\uf8ff'), limitToFirst(limit || 8)));
    if(!snap.exists()) return [];
    const out = [];
    snap.forEach(ch => { const v = ch.val() || {}; if(v.uid) out.push({ uid: v.uid, nick: v.nick || ch.key }); });
    return out;
  }catch(e){ return []; }
}

export function getNick(){ return (state.profile && state.profile.nick) || ''; }

// İlk girişte nick yoksa Google adından benzersiz bir nick türet + claim
let _ensuringNick = false;
async function ensureNick(){
  if(_ensuringNick) return; _ensuringNick = true;
  try{
    if(!state.uid || state.status !== 'google') return;
    // Varsayılan avatar: yoksa UID'den deterministik seç ve yaz
    if(state.profile && !state.profile.avatar && state.uid){
      try{
        const A=['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈'];
        let h=0; for(let i=0;i<state.uid.length;i++) h=((h<<5)-h)+state.uid.charCodeAt(i);
        const av = A[Math.abs(h)%A.length];
        await update(ref(db,'users/'+state.uid), {avatar: av});
        if(state.profile) state.profile.avatar = av;
      }catch(e){}
    }
    if(state.profile && state.profile.nick){
      // Kendini onar: profilde nick var ama kayıt defterinde (nicks/) girdisi yoksa claim et
      try{
        const k = nickKey(state.profile.nick);
        const reg = await get(ref(db, 'nicks/' + k));
        if(!reg.exists()){ await setNick(state.profile.nick); }
      }catch(e){}
      return;
    }
    // Taban: önce PORTAL adı (monolitten gelen name/displayName) — Google adı en son çare
    let base = (state.profile && (state.profile.name || state.profile.displayName)) ||
               (state.user && state.user.displayName) || 'Oyuncu';
    base = base.replace(/\s+/g,'').replace(/[^A-Za-z0-9_ğüşıöçĞÜŞİÖÇ]/g,'').slice(0, NICK_MAX);
    if(base.length < NICK_MIN) base = 'Oyuncu';
    for(let i=0;i<30;i++){
      const cand = i === 0 ? base : (base.slice(0, NICK_MAX - String(i).length) + i);
      const r = await setNick(cand);
      if(r.ok) return;
    }
  }catch(e){ console.warn('[auth] ensureNick', e); }
  finally{ _ensuringNick = false; }
}

export const Auth = { subscribe, getState, loginGoogle, logout, db, auth, ready, validateNick, checkNick, setNick, resolveNick, getNick, searchNicks };
export default Auth;
