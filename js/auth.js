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

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK}`;
const { initializeApp } = await import(`${BASE}/firebase-app.js`);
const {
  getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence,
  signInAnonymously, signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, linkWithPopup, signOut
} = await import(`${BASE}/firebase-auth.js`);
const { getDatabase, ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst, limitToLast, orderByKey, startAt, endAt } = await import(`${BASE}/firebase-database.js`);

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
export function getState(){ return Object.assign({}, state); }
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
  startPresence();                                  // çevrimiçilik: presence/{uid}
  startKickListener();                              // 🦵 admin atarsa oturumu yenile
  // Google kullanıcısının nick'i yoksa arka planda benzersiz bir nick üret (engellemeden)
  if(user && !user.isAnonymous){ ensureNick(); }   // nick yoksa üret; varsa kayıt defterini onar
}

// ── PRESENCE: çevrimiçi durumu (admin paneli + arkadaş listesi kullanır) ──
let _presT = null, _presVis = null;
function startPresence(){
  stopPresence();
  if(!state.uid) return;
  const pref = ref(db, 'presence/' + state.uid);
  const write = () => { try{ set(pref, { online:true, lastSeen: Date.now(), name: state.displayName || 'Oyuncu', uid: state.uid }); }catch(e){} };
  try{ onDisconnect(pref).update({ online:false, lastSeen: Date.now() }); }catch(e){}
  write();
  _presT = setInterval(() => { if(!document.hidden) write(); }, 60000);
  _presVis = () => { if(!document.hidden) write(); };
  document.addEventListener('visibilitychange', _presVis);
}
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
      alert('🦵 Yönetici tarafından oyundan atıldın.' + (v.reason ? '\nSebep: ' + v.reason : ''));
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

  // Redirect yedeğiyle dönüldüyse sonucu işle (hatayı sessizce yut — env vb.)
  try { await getRedirectResult(auth); } catch(e){ /* yoksay */ }

  // Kısa beklemeden sonra hâlâ kullanıcı yoksa anonim başlat
  setTimeout(async () => {
    if(!auth.currentUser){
      try { await signInAnonymously(auth); }
      catch(e){ state.status = 'offline'; emit(); }
    }
    _resolveReady(getState());
  }, 600);
}

// ── Google ile giriş: popup → redirect yedeği → anonse link ─────
export async function loginGoogle(){
  const provider = new GoogleAuthProvider();
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(e){}
  await setPersistence(auth, browserLocalPersistence).catch(() => {});

  const cur = auth.currentUser;
  try {
    if(cur && cur.isAnonymous){
      // Anonim veriyi koruyarak Google'a bağla
      await linkWithPopup(cur, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
    return { ok: true };
  } catch(e){
    const code = (e && e.code) || '';
    if(/popup/.test(code) || code === 'auth/web-storage-unsupported'){
      // Popup engellendi → redirect yedeği (firebaseapp.com'da garantili çalışır)
      try { await signInWithRedirect(auth, provider); return { ok: true, redirect: true }; }
      catch(e2){ return { ok: false, code: (e2 && e2.code) || code, message: (e2 && e2.message) || '' }; }
    }
    if(code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'){
      // Hesap zaten var → doğrudan giriş
      try { await signInWithPopup(auth, provider); return { ok: true }; }
      catch(e3){ return { ok: false, code: (e3 && e3.code) || code, message: (e3 && e3.message) || '' }; }
    }
    return { ok: false, code, message: (e && e.message) || '' };
  }
}

export async function logout(){ try { await signOut(auth); } catch(e){ console.error('[auth] logout', e); } }

// RTDB erişimini diğer modüllere aç (friends/chat/shop sonraki aşamalarda kullanacak)
export { db, auth };
// Veritabanı yardımcıları — store.js ve oyunlar tekrar import etmeden kullanır
export const fdb = { ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst, limitToLast, orderByKey, startAt, endAt };

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
