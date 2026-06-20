// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — STORE (oyuncu verisi & ödüller)
//
//  Oyun ilerlemesinin TEK kaynağı: kaju, xp, seviye, en iyi skorlar.
//  Auth'a abone olur (kimlik gelince /users/{uid}'den beslenir),
//  oyunlar buraya skor/kaju/xp yazar, UI buradan canlı okur.
//
//  Eski sistemdeki addKaju/addXP/saveTetrisScore mantığının temiz hali.
//  Formüller orijinalle birebir: xpForLevel = 300 + lv*200, limit 2000.
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js';

// Firebase veritabanı erişimini DOĞRUDAN al (auth.js'in fdb export'una bağlı değil).
// FIREBASE_SDK eksik/undefined olsa bile sabit bir sürümle çalışır (çökmez).
const SDK_VER = (typeof FIREBASE_SDK === 'string' && FIREBASE_SDK) ? FIREBASE_SDK : '10.12.0';
const BASE = `https://www.gstatic.com/firebasejs/${SDK_VER}`;
const { getDatabase, ref, get, set, update, runTransaction } = await import(`${BASE}/firebase-database.js`);
const { getApp, getApps, initializeApp } = await import(`${BASE}/firebase-app.js`);
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const KAJU_DAILY_LIMIT = 2000;

// ── Kaju transfer ayarları (hile sınırlama) ─────────────────────
const KAJU_MAX     = 999999999;   // kuraldaki tavan
const ADMIN_OP_CAP = 10000000;    // admin tek-işlem tavanı (overflow/yanlış giriş koruması)
const TX_MIN       = 10;          // kullanıcı min transfer
const TX_PER       = 5000;        // kullanıcı tek-transfer tavanı (KURALLA AYNI olmalı)
const TX_HOUR      = 10000;       // kullanıcı saatlik gönderim tavanı
const TX_DAY       = 50000;       // kullanıcı günlük gönderim tavanı
const TX_MONTH     = 500000;      // kullanıcı aylık gönderim tavanı

const player = {
  uid: null, ready: false,
  kaju: 0, level: 1, xp: 0, totalXP: 0,
  best: {},            // { tetris: 12345, ... }
  kajuToday: 0,        // bugün kazanılan (günlük limit için, local)
  kajuSent: {}         // { hWin,hAmt, dWin,dAmt, mWin,mAmt } gönderim sayaçları
};

const subs = new Set();
export function subscribe(fn){ subs.add(fn); try{ fn(snapshot()); }catch(e){} return () => subs.delete(fn); }
function snapshot(){ return Object.assign({}, player, { best: Object.assign({}, player.best) }); }
function emit(){ const s = snapshot(); subs.forEach(fn => { try{ fn(s); }catch(e){ console.error('[store]', e); } }); }
export function getState(){ return snapshot(); }

export function xpForLevel(lv){ return 300 + lv * 200; }

// ════════════════ 🪙 KAJU İŞLEM GEÇMİŞİ ════════════════════════
const KAJU_LOG_KEY = 'hero_kaju_log';
const KAJU_LOG_MAX = 200;
// Kaju işlemini geçmişe kaydet (kazanç/harcama)
export function logKaju(amount, type, game, reason){
  try{
    const log = JSON.parse(localStorage.getItem(KAJU_LOG_KEY) || '[]');
    log.unshift({
      amount: Math.abs(Math.floor(amount||0)),
      type: type || (amount>=0?'earn':'spend'),  // 'earn' | 'spend'
      game: game || 'genel',
      reason: reason || '',
      ts: Date.now()
    });
    const trimmed = log.length > KAJU_LOG_MAX ? log.slice(0, KAJU_LOG_MAX) : log;
    localStorage.setItem(KAJU_LOG_KEY, JSON.stringify(trimmed));
  }catch(e){ console.warn('[store] logKaju', e); }
}
// Geçmişi oku (filtre: 'all' | 'earn' | 'spend')
export function getKajuLog(filter){
  try{
    const log = JSON.parse(localStorage.getItem(KAJU_LOG_KEY) || '[]');
    if(filter === 'earn') return log.filter(e => e.type === 'earn');
    if(filter === 'spend') return log.filter(e => e.type === 'spend');
    return log;
  }catch(e){ return []; }
}
// Geçmiş özeti (toplam kazanç/harcama)
export function getKajuSummary(){
  const log = getKajuLog('all');
  let earned = 0, spent = 0;
  log.forEach(e => { if(e.type==='earn') earned += e.amount; else spent += e.amount; });
  return { earned, spent, count: log.length };
}

// Günlük kaju takibi (tarih değişince sıfırlanır) — local
function todayKey(){ return 'hero_kaju_' + new Date().toISOString().slice(0,10); }
function loadKajuToday(){ try{ return Number(localStorage.getItem(todayKey()) || 0); }catch(e){ return 0; } }
function saveKajuToday(v){ try{ localStorage.setItem(todayKey(), String(v)); }catch(e){} }

// Auth değişince oyuncu verisini beslemek
function hydrate(state){
  if(!state.uid){ player.uid = null; player.ready = false; emit(); return; }
  player.uid = state.uid;
  const p = state.profile || {};
  player.kaju    = Number(p.kaju || 0);
  player.level   = Number(p.level || (p.xp && p.xp.level) || 1);
  player.xp      = Number((p.xp && typeof p.xp === 'object' ? p.xp.xp : p.xp) ?? 0);
  player.totalXP = Number((p.xp && typeof p.xp === 'object' ? p.xp.totalXP : p.totalXP) ?? 0);
  player.best    = p.bestScores || {};
  player.kajuSent = p.kajuSent || {};
  player.kajuToday = loadKajuToday();
  player.ready   = true;
  emit();
  // Bekleyen transferleri talep et (alıcıya gelen Kaju'lar)
  claimPendingTransfers();
}
Auth.subscribe(hydrate);

// ── Kaju ekle (günlük limitli, admin sınırsız) ──────────────────
export async function addKaju(n, game, reason){
  // Kaju kazanım sesi
  if(n>0){try{import('./daily.js').then(m=>m.kajuCoinSound('earn')).catch(()=>{});}catch(e){}}
  if(n<0){try{import('./daily.js').then(m=>m.kajuCoinSound('spend')).catch(()=>{});}catch(e){}}
  n = Math.floor(n || 0);
  // Negatif → harcama olarak işle (geriye uyumluluk: shop.js addKaju(-price) çağırıyor)
  if(n < 0){ const ok = await spendKaju(-n, game, reason); return ok ? n : 0; }
  if(n <= 0 || !player.uid) return 0;
  const isAdmin = Auth.getState().isAdmin === true;
  if(!isAdmin){
    const remaining = KAJU_DAILY_LIMIT - player.kajuToday;
    if(remaining <= 0) return 0;
    n = Math.min(n, remaining);
  }
  player.kaju += n;
  player.kajuToday += n;
  saveKajuToday(player.kajuToday);
  // 🪙 Geçmişe kaydet
  logKaju(n, 'earn', game || 'genel', _kajuReason(game, n));
  emit();
  try{
    await update(ref(db, 'users/' + player.uid), { kaju: player.kaju });
    await set(ref(db, 'leaderboard/kaju/' + player.uid), { uid: player.uid, kaju: player.kaju, ts: Date.now() });
  }catch(e){ console.warn('[store] addKaju sync', e); }
  return n;
}

// İşlem açıklaması üret
function _kajuReason(game, n){
  const names = { tetris:'Tetris ödülü', chess:'Satranç ödülü', satranc:'Satranç ödülü',
    tavla:'Tavla ödülü', kelime:'Kelimecik ödülü', daily:'Günlük ödül', spin:'Çark ödülü',
    quest:'Görev ödülü', shop:'Mağaza', clan:'Klan', gift:'Hediye', genel:'Kazanç' };
  return names[game] || 'Kazanç';
}

// Harcama loglamak için (mağaza, kozmo vb. kullanır)
export function logSpend(amount, game, reason){
  logKaju(Math.abs(amount), 'spend', game||'shop', reason||'Harcama');
}

// ── Kaju harca (bakiyeden düş + Firebase + geçmiş) ──────────────
export async function spendKaju(amount, game, reason){
  amount = Math.abs(Math.floor(amount||0));
  if(amount <= 0 || !player.uid) return false;
  if(player.kaju < amount) return false;  // yetersiz bakiye
  player.kaju -= amount;
  logKaju(amount, 'spend', game||'shop', reason||'Harcama');
  try{ import('./daily.js').then(m=>m.kajuCoinSound('spend')).catch(()=>{}); }catch(e){}
  emit();
  try{
    await update(ref(db, 'users/' + player.uid), { kaju: player.kaju });
    await set(ref(db, 'leaderboard/kaju/' + player.uid), { uid: player.uid, kaju: player.kaju, ts: Date.now() });
  }catch(e){ console.warn('[store] spendKaju sync', e); }
  return true;
}

// ── XP ekle (seviye atlama dahil) ───────────────────────────────
export async function addXP(n){
  n = Math.floor(n || 0);
  if(n <= 0 || !player.uid) return false;
  player.xp += n; player.totalXP += n;
  let leveled = false, needed = xpForLevel(player.level);
  while(player.xp >= needed){ player.xp -= needed; player.level++; needed = xpForLevel(player.level); leveled = true; }
  emit();
  try{
    await update(ref(db, 'users/' + player.uid), {
      level: player.level,
      xp: { level: player.level, xp: player.xp, totalXP: player.totalXP }
    });
  }catch(e){ console.warn('[store] addXP sync', e); }
  return leveled;
}

// ── Skor kaydet (yeni rekor ise liderliğe yaz) ──────────────────
export async function addScore(game, score){
  score = Math.floor(score || 0);
  if(!player.uid || score <= 0) return false;
  const prev = player.best[game] || 0;
  if(score <= prev) return false;       // yeni rekor değil
  player.best[game] = score;
  emit();
  const name = Auth.getState().displayName || 'Oyuncu';
  try{
    await update(ref(db, 'users/' + player.uid + '/bestScores'), { [game]: score });
    await set(ref(db, 'gameLB/' + game + '/' + player.uid), { uid: player.uid, name: name, score: score, ts: Date.now() });
  }catch(e){ console.warn('[store] addScore sync', e); }
  return true;                          // yeni rekor
}

// ════════════════════════════════════════════════════════════════
//  KAJU TRANSFER / GÖNDERİM
//  • Admin: doğrudan runTransaction (kaynak yaratır, 0 altına düşmez, per-işlem tavanı)
//  • Kullanıcı→kullanıcı: kendi bakiyesinden düş → kajuTransfers (pending) → alıcı talep eder
//  Not: Cloud Functions olmadan sunucu-taraflı atomiklik sınırlıdır; limitler + denetim
//  kaydı (kaju_history) hile riskini sınırlar. Tam koruma için Cloud Functions önerilir.
// ════════════════════════════════════════════════════════════════
function winKeys(){ const iso = new Date().toISOString(); return { h: iso.slice(0,13), d: iso.slice(0,10), m: iso.slice(0,7) }; }
function curSent(){
  const w = winKeys(), s = player.kajuSent || {};
  return {
    h: (s.hWin === w.h ? Number(s.hAmt||0) : 0),
    d: (s.dWin === w.d ? Number(s.dAmt||0) : 0),
    m: (s.mWin === w.m ? Number(s.mAmt||0) : 0),
    w
  };
}
function checkLimits(amount){
  const c = curSent();
  if(c.h + amount > TX_HOUR)  return { ok:false, error:`Saatlik limit aşılır (${TX_HOUR}). Kalan: ${Math.max(0,TX_HOUR-c.h)}` };
  if(c.d + amount > TX_DAY)   return { ok:false, error:`Günlük limit aşılır (${TX_DAY}). Kalan: ${Math.max(0,TX_DAY-c.d)}` };
  if(c.m + amount > TX_MONTH) return { ok:false, error:`Aylık limit aşılır (${TX_MONTH}). Kalan: ${Math.max(0,TX_MONTH-c.m)}` };
  return { ok:true };
}
async function bumpLimits(amount){
  const c = curSent();
  player.kajuSent = { hWin:c.w.h, hAmt:c.h+amount, dWin:c.w.d, dAmt:c.d+amount, mWin:c.w.m, mAmt:c.m+amount };
  try{ await update(ref(db, 'users/'+player.uid), { kajuSent: player.kajuSent }); }catch(e){}
}
export function transferRemaining(){
  const c = curSent();
  return { perTx:TX_PER, min:TX_MIN, hour:Math.max(0,TX_HOUR-c.h), day:Math.max(0,TX_DAY-c.d), month:Math.max(0,TX_MONTH-c.m) };
}
// Başka bir kullanıcının kaju geçmişine yaz (admin/hediye işlemleri için)
function logKajuFor(uid, amount, type, reason){
  try{
    const k = 'h' + Date.now() + '_' + Math.floor(Math.random()*100000);
    set(ref(db, 'users/'+uid+'/kaju_history/'+k), { amount: Math.floor(amount), type, game:'kaju', reason: reason||'', ts: Date.now() });
  }catch(e){}
}

// Admin: hedefin bakiyesini doğrudan ayarla (delta + veya −; 0 altına düşmez)
async function adminCredit(toUid, delta, reason){
  const me = Auth.getState();
  if(me.isAdmin !== true) return { ok:false, error:'Yetki yok' };
  if(!toUid) return { ok:false, error:'Hedef yok' };
  let nb = 0, ok = false;
  try{
    const res = await runTransaction(ref(db, 'users/'+toUid+'/kaju'), cur => {
      cur = Number(cur||0);
      nb = Math.max(0, Math.min(KAJU_MAX, cur + delta));   // 0 altına düşmez, tavanı aşmaz
      ok = true; return nb;
    });
    if(!res.committed || !ok) return { ok:false, error:'İşlem yapılamadı' };
  }catch(e){ return { ok:false, error:'İşlem hatası (bağlantı?)' }; }
  if(toUid === me.uid){ player.kaju = nb; emit(); }
  logKajuFor(toUid, delta, delta>=0 ? 'admin-add' : 'admin-sub', reason || 'admin');
  try{ await set(ref(db, 'leaderboard/kaju/'+toUid), { uid:toUid, kaju:nb, ts:Date.now() }); }catch(e){}
  return { ok:true, newBalance: nb };
}

// Admin paneli/oyuncu arayüzü: +artır / −azalt
export async function adminAdjustKaju(targetUid, delta, reason){
  delta = Math.floor(delta || 0);
  if(Auth.getState().isAdmin !== true) return { ok:false, error:'Yetki yok' };
  if(!delta) return { ok:false, error:'Miktar 0 olamaz' };
  if(Math.abs(delta) > ADMIN_OP_CAP) return { ok:false, error:`Tek seferde en fazla ${ADMIN_OP_CAP}` };
  return adminCredit(targetUid, delta, reason || 'admin-adjust');
}

// Kaju gönder. Admin → doğrudan kredi (sınırsız, per-op tavanı). Kullanıcı → limitli pending.
export async function transferKaju(toUid, toNick, amount){
  amount = Math.floor(amount || 0);
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google') return { ok:false, error:'Göndermek için Google ile giriş gerekli' };
  if(!toUid) return { ok:false, error:'Alıcı bulunamadı' };
  if(amount < TX_MIN) return { ok:false, error:`En az ${TX_MIN} Kaju gönderilebilir` };

  // ADMIN: kaynak yaratır, doğrudan alıcıya ekler (kendine de olabilir)
  if(me.isAdmin === true){
    if(amount > ADMIN_OP_CAP) return { ok:false, error:`Tek seferde en fazla ${ADMIN_OP_CAP}` };
    const r = await adminCredit(toUid, amount, 'admin-gift → '+(toNick||toUid));
    return r.ok ? { ok:true, amount, admin:true } : r;
  }

  // KULLANICI
  if(toUid === me.uid) return { ok:false, error:'Kendine gönderemezsin' };
  if(amount > TX_PER) return { ok:false, error:`Tek transferde en fazla ${TX_PER} Kaju` };
  const lim = checkLimits(amount); if(!lim.ok) return lim;
  if(player.kaju < amount) return { ok:false, error:'Yetersiz bakiye' };

  // 1) kendi bakiyemden ATOMİK düş
  const dref = ref(db, 'users/'+me.uid+'/kaju');
  let okDed = false;
  try{
    const res = await runTransaction(dref, cur => { cur = Number(cur||0); if(cur < amount) return; okDed = true; return cur - amount; });
    if(!res.committed || !okDed) return { ok:false, error:'Yetersiz bakiye' };
  }catch(e){ return { ok:false, error:'Gönderilemedi (bağlantı?)' }; }
  player.kaju = Math.max(0, player.kaju - amount); emit();

  // 2) pending transfer yaz (alıcı talep edecek)
  const txId = me.uid.slice(0,6) + '_' + Date.now() + '_' + Math.floor(Math.random()*1000000);
  try{
    await set(ref(db, 'kajuTransfers/'+toUid+'/'+txId), { txId, fromUid: me.uid, fromNick: me.displayName || 'Oyuncu', toUid, amount, ts: Date.now() });
  }catch(e){
    // yazılamadı → parayı geri ver
    try{ await runTransaction(dref, cur => Number(cur||0) + amount); }catch(_){}
    player.kaju += amount; emit();
    return { ok:false, error:'Transfer kaydı yazılamadı' };
  }
  // 3) sayaç + geçmiş + liderlik
  await bumpLimits(amount);
  logKaju(amount, 'spend', 'gift', 'Gönderildi → '+(toNick||toUid));
  try{ await set(ref(db, 'leaderboard/kaju/'+me.uid), { uid:me.uid, kaju:player.kaju, ts:Date.now() }); }catch(e){}
  // 🎁 Alıcıya bildirim gönder
  try{
    const N = await import('./notify.js');
    await N.notifyKajuGift(toUid, amount, me.displayName || 'Bir oyuncu');
  }catch(e){}
  return { ok:true, amount };
}

// Alıcı: bekleyen transferleri kendi bakiyesine ekle (talep) → { total, claimed[] }
export async function claimPendingTransfers(){
  const me = Auth.getState();
  if(!me.uid) return { total:0, claimed:[] };
  let total = 0; const claimed = [];
  try{
    const snap = await get(ref(db, 'kajuTransfers/'+me.uid));
    if(!snap.exists()) return { total:0, claimed:[] };
    const all = snap.val();
    for(const txId of Object.keys(all)){
      const t = all[txId] || {};
      const amt = Math.floor(Number(t.amount||0));
      const path = 'kajuTransfers/'+me.uid+'/'+txId;
      if(amt <= 0){ try{ await set(ref(db, path), null); }catch(e){} continue; }
      let nb = 0, ok = false;
      try{
        const res = await runTransaction(ref(db, 'users/'+me.uid+'/kaju'), cur => { cur = Number(cur||0); nb = Math.min(KAJU_MAX, cur + amt); ok = true; return nb; });
        if(res.committed && ok){
          total += amt; player.kaju = nb;
          await set(ref(db, path), null);   // talep edildi → sil
          logKaju(amt, 'earn', 'gift', (t.fromNick||'Biri')+' gönderdi');
          claimed.push({ from: t.fromNick || 'Biri', amount: amt });
        }
      }catch(e){ /* sonraki transfer */ }
    }
    if(total > 0){
      emit();
      try{ await set(ref(db, 'leaderboard/kaju/'+me.uid), { uid:me.uid, kaju:player.kaju, ts:Date.now() }); }catch(e){}
      try{ window.dispatchEvent(new CustomEvent('hero:kaju-claimed', { detail:{ total, claimed } })); }catch(e){}
    }
  }catch(e){ console.warn('[store] claimPending', e); }
  return { total, claimed };
}

export const Store = { subscribe, getState, addKaju, addXP, addScore, xpForLevel, transferKaju, adminAdjustKaju, claimPendingTransfers, transferRemaining, logKaju, getKajuLog, getKajuSummary, logSpend, spendKaju };
export default Store;
