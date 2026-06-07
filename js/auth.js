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
const { getDatabase, ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst } = await import(`${BASE}/firebase-database.js`);

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
export const fdb = { ref, get, set, update, onValue, push, remove, runTransaction, onDisconnect, serverTimestamp, off, child, query, orderByChild, equalTo, limitToFirst };

boot();

export const Auth = { subscribe, getState, loginGoogle, logout, db, auth, ready };
export default Auth;
