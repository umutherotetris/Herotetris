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
const { getDatabase, ref, get, set, update, push, runTransaction, onValue } = await import(`${BASE}/firebase-database.js`);
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

const emptyPlayer = () => ({
  uid: null, ready: false,
  kaju: 0, level: 1, xp: 0, totalXP: 0,
  best: {},            // { tetris: 12345, ... }
  kajuToday: 0,        // bugün kazanılan (günlük limit için, local)
  kajuSent: {}, inventory:{}, boosts:{}, cosmetics:{}, purchasedOnce:{},
  stats:{ games:{}, totalW:0, totalL:0, totalD:0, streak:0, bestStreak:0 }, h2h:{}
});
const player = emptyPlayer();
const finiteAmount = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback;
let walletObservation = 0, liveWalletUid = null, liveWalletOff = null, liveTransfersOff = null, liveKozmosOff = null;
let lastHydratedProfile = null, walletListenEpoch = 0;
const deletedWalletUsers=new Set();

const subs = new Set();
export function subscribe(fn){ subs.add(fn); try{ fn(snapshot()); }catch(e){} return () => subs.delete(fn); }
function snapshot(){ return Object.assign({}, player, { best: Object.assign({}, player.best) }); }
function emit(){ const s = snapshot(); subs.forEach(fn => { try{ fn(s); }catch(e){ console.error('[store]', e); } }); }
export function getState(){ return snapshot(); }

export function xpForLevel(lv){ return 300 + lv * 200; }

// ════════════════ 🪙 KAJU İŞLEM GEÇMİŞİ ════════════════════════
const KAJU_LOG_KEY = 'hero_kaju_log';
const KAJU_LOG_MAX = 200;
function kajuLogKey(uid = player.uid){ return uid ? KAJU_LOG_KEY + ':' + uid : null; }
// Kaju işlemini geçmişe kaydet (kazanç/harcama)
export function logKaju(amount, type, game, reason){
  try{
    const key = kajuLogKey(); if(!key) return;
    const value = Math.abs(Number(amount)); if(!Number.isSafeInteger(value) || value <= 0) return;
    const log = getKajuLog('all');
    log.unshift({
      amount: value,
      type: type || (amount>=0?'earn':'spend'),  // 'earn' | 'spend'
      game: game || 'genel',
      reason: reason || '',
      ts: Date.now()
    });
    const trimmed = log.length > KAJU_LOG_MAX ? log.slice(0, KAJU_LOG_MAX) : log;
    localStorage.setItem(key, JSON.stringify(trimmed));
  }catch(e){ console.warn('[store] logKaju', e); }
}
// Geçmişi oku (filtre: 'all' | 'earn' | 'spend')
export function getKajuLog(filter, uid = player.uid){
  try{
    const key = kajuLogKey(uid); if(!key) return [];
    // The old unscoped log has no reliable owner; never attribute it to the next login.
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    const log = (Array.isArray(raw) ? raw : []).filter(e => e && typeof e === 'object' && Number.isFinite(Number(e.amount)))
      .map(e => ({...e, amount:finiteAmount(e.amount)}));
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
function todayKey(uid = player.uid){ return 'hero_kaju_' + uid + '_' + new Date().toISOString().slice(0,10); }
function loadKajuToday(uid){ try{ return finiteAmount(localStorage.getItem(todayKey(uid)) || 0); }catch(e){ return 0; } }
function saveKajuToday(v, uid){ try{ localStorage.setItem(todayKey(uid), String(v)); }catch(e){} }

// Auth değişince oyuncu verisini beslemek
function hydrate(state){
  if(state.uid && state.profile?.deleted)deletedWalletUsers.add(state.uid);
  const blocked=!!state.uid && deletedWalletUsers.has(state.uid);
  const changed = player.uid !== state.uid || blocked;
  if(changed){
    walletListenEpoch++; liveWalletOff?.(); liveTransfersOff?.(); liveKozmosOff?.();
    liveWalletOff = liveTransfersOff = liveKozmosOff = null; liveWalletUid = null;
    lastHydratedProfile = null; walletObservation++;
    appliedXPUid=null; appliedXPRevision=0; scoreCacheUid=null; confirmedScores={};
    matchCacheUid=null; appliedMatchRevision=0; inventoryCacheUid=null; appliedInventoryRevision=0;
  }
  if(!state.uid || blocked){ Object.assign(player, emptyPlayer()); _statsCache = null; emit(); return; }
  player.uid = state.uid;
  const p = state.profile || {};
  if(changed || state.profile !== lastHydratedProfile){
    player.kaju = Math.min(KAJU_MAX, finiteAmount(p.kaju));
    player.kajuSent = p.kajuSent || {};
    applyXPSnapshot(state.uid,p);
    player.best    = p.bestScores || {};
    applyInventorySnapshot(state.uid,p);
    player.boosts = p.boosts || {};
    player.cosmetics = p.cosmetics || {};
    player.purchasedOnce = p.purchasedOnce || {};
    applyMatchSnapshot(state.uid,p);
  }
  lastHydratedProfile = state.profile;
  player.kajuToday = loadKajuToday();
  player.ready   = true;
  _pruneExpiredBoosts();
  emit();
  if(changed || !liveWalletUid) startWalletListeners(state.uid);
  // Bekleyen transferleri talep et (alıcıya gelen Kaju'lar)
  claimPendingTransfers();
  retryPendingTransfers();
  // 👑 VIP günlük Kaju (oturum açılınca, günde 1 kez)
  _claimVipDaily();
}

// 👑 VIP günlük Kaju dağıtımı
// ── VIP durumu (merkezi — tüm sistemler buradan okur) ──
function _readVip(){
  try{
    if(!player.cosmetics || !player.cosmetics.vip) return null;
    const v = typeof player.cosmetics.vip === 'string' ? JSON.parse(player.cosmetics.vip) : player.cosmetics.vip;
    if(v && v.until && Date.now() < v.until) return v;
  }catch(e){}
  return null;
}
export function isVip(){ return !!_readVip(); }
export function vipDaysLeft(){
  const v = _readVip();
  if(!v) return 0;
  return Math.ceil((v.until - Date.now())/86400000);
}
// VIP indirim oranı (mağaza fiyatlarına uygulanır)
export const VIP_DISCOUNT = 0.10;   // %10
export function vipPrice(basePrice){
  if(isVip()) return Math.ceil(basePrice * (1 - VIP_DISCOUNT));
  return basePrice;
}

async function _claimVipDaily(){
  try{
    if(!player.uid || !player.cosmetics || !player.cosmetics.vip) return;
    let vip;
    try{ vip = typeof player.cosmetics.vip === 'string' ? JSON.parse(player.cosmetics.vip) : player.cosmetics.vip; }
    catch(e){ return; }
    if(!vip || !vip.until || Date.now() > vip.until) return;   // VIP süresi dolmuş
    const daily = Number(vip.daily) || 0;
    if(daily <= 0) return;
    const uid = player.uid;
    const receipt = 'vip_' + new Date().toISOString().slice(0,10);
    const result = await claimKajuOnce(receipt, Math.floor(daily), 'vip', 'VIP günlük Kaju', uid);
    if(result.claimed && player.uid === uid){
      try{ window.Hero?.toast('👑 VIP günlük ' + result.amount + ' Kaju eklendi!'); }catch(e){}
    }
  }catch(e){ console.warn('[store] vip daily', e); }
}

// ── Görev takibi köprüsü (lazy import — döngüsel bağımlılık yok) ──
let _Eco = null, _Trn = null;
async function _trackQuestSafe(eventType, data){
  const uid = player.uid, current = () => !!uid && player.uid === uid && Auth.getState().uid === uid;
  if(!current()) return;
  data = data || {};
  // Görev ilerlemesi → economy.js (tek görev sistemi). track: play/win/earn/spin
  try{
    if(!_Eco){ _Eco = await import('./economy.js'); }
    if(!current()) return;
    if(_Eco && _Eco.progressQuest){
      if(eventType === 'game_played') _Eco.progressQuest('play', 1);
      else if(eventType === 'game_won') _Eco.progressQuest('win', 1);
      else if(eventType === 'kaju_earned') _Eco.progressQuest('earn', data.amount||0);
      else if(eventType === 'spin_wheel') _Eco.progressQuest('spin', 1);
    }
  }catch(e){ /* görev opsiyonel */ }
  // Turnuva puanı (maç oynama + galibiyet + yüksek skor)
  try{
    if(!_Trn){ _Trn = await import('./tournament.js'); }
    if(!current()) return;
    if(_Trn && _Trn.addTournamentPoints){
      // Dengeli puan: katılım ödüllü ama galibiyet öne çıkar, beraberlik de değerli
      if(eventType === 'game_played') _Trn.addTournamentPoints(10, 'maç');          // her maç (katılım)
      else if(eventType === 'game_won') _Trn.addTournamentPoints(20, 'galibiyet');   // +20 ek → galibiyet toplam 30
      else if(eventType === 'game_draw') _Trn.addTournamentPoints(5, 'beraberlik');  // +5 ek → beraberlik toplam 15
      else if(eventType === 'score_tetris' && data && data.score >= 10000) _Trn.addTournamentPoints(Math.min(Math.floor(data.score/2000), 25), 'tetris skor'); // maks 25 (aşırı skoru sınırla)
    }
  }catch(e){ /* turnuva opsiyonel */ }
}
// Dışarıdan da çağrılabilsin (oyunlar galibiyet/özel olay için)
export function trackQuestEvent(eventType, data){ _trackQuestSafe(eventType, data); }

// ══════════ MAÇ İSTATİSTİK SİSTEMİ ══════════
// Firebase: users/{uid}/stats = {
//   games: { chess:{w,l,d}, tavla:{...}, tetris:{...}, kelime:{...} },
//   totalW, totalL, totalD, streak, bestStreak, lastResult, lastGame, updatedAt
// }
// Head-to-head: users/{uid}/h2h/{oppUid} = { w, l, d, oppName, lastTs }
let _statsCache = null;
function _loadStats(){
  if(_statsCache) return _statsCache;
  _statsCache = (player.stats && typeof player.stats==='object') ? player.stats : {
    games:{}, totalW:0, totalL:0, totalD:0, streak:0, bestStreak:0
  };
  return _statsCache;
}
export function getStats(){ return _loadStats(); }
export function getH2H(oppUid){ return (player.h2h && player.h2h[oppUid]) || null; }

let matchCacheUid=null, appliedMatchRevision=0;
function applyMatchSnapshot(uid,profile){
  if(player.uid!==uid || Auth.getState().uid!==uid || profile?.deleted) return;
  const revision=Number.isSafeInteger(profile?.heroMatchRevision) && profile.heroMatchRevision>=0?profile.heroMatchRevision:0;
  if(matchCacheUid!==uid){matchCacheUid=uid;appliedMatchRevision=0;}
  if(revision<appliedMatchRevision) return;
  appliedMatchRevision=revision;
  player.stats=profile.stats || {games:{},totalW:0,totalL:0,totalD:0,streak:0,bestStreak:0};
  player.h2h=profile.h2h || {}; _statsCache=null;
}

// Stats, the owner's head-to-head row and bounded match history commit together.
// A supplied match ID can be retried after an unknown acknowledgement.
export async function recordMatchResult(game, result, oppUid, oppName, requestedId){
  const uid=player.uid, actor=Auth.getState(), current=()=>!!uid && player.uid===uid && Auth.getState().uid===uid;
  if(!current() || actor.uid!==uid || typeof game!=='string' || !/^[a-z][a-z0-9_-]{0,63}$/i.test(game) || ['constructor','prototype'].includes(game) || !['win','loss','draw'].includes(result)) return false;
  if(oppUid && !validWalletKey(oppUid)) return false;
  const operationId=requestedId || walletOperationId('match');
  if(typeof operationId!=='string' || !/^[\w-]{1,180}$/.test(operationId)) return false;
  const opponent=oppUid && oppUid!==uid?oppUid:null, opponentName=String(oppName || '—');
  const counter=value=>safeCounter(value ?? 0);
  let transaction, profile;
  try{
    transaction=await runTransaction(ref(db,'users/'+uid),saved=>{
      if(!current() || !saved || saved.deleted || typeof saved!=='object' || Array.isArray(saved)) return;
      if(saved.heroMatchClaims?.[operationId]) return;
      const stats=saved.stats || {}, gameStats=stats.games?.[game] || {};
      if(typeof stats!=='object' || Array.isArray(stats) || typeof gameStats!=='object' || Array.isArray(gameStats)) return;
      const next={...stats,games:{...stats.games}}, row={...gameStats};
      for(const key of ['totalW','totalL','totalD','streak','bestStreak']){next[key]=counter(stats[key]);if(next[key]===null)return;}
      for(const key of ['w','l','d']){row[key]=counter(gameStats[key]);if(row[key]===null)return;}
      const key={win:'w',loss:'l',draw:'d'}[result], total={win:'totalW',loss:'totalL',draw:'totalD'}[result];
      row[key]++;next[total]++;
      if(result==='win'){next.streak++;next.bestStreak=Math.max(next.bestStreak,next.streak);}
      else if(result==='loss') next.streak=0;
      if(!Number.isSafeInteger(row[key]) || !Number.isSafeInteger(next[total]) || !Number.isSafeInteger(next.streak))return;
      next.games[game]=row;next.lastResult=result;next.lastGame=game;next.updatedAt=Date.now();
      const h2h={...saved.h2h};
      if(opponent){
        const previous=h2h[opponent] || {}, h={...previous};
        for(const key of ['w','l','d']){h[key]=counter(previous[key]);if(h[key]===null)return;}
        h[key]++;if(!Number.isSafeInteger(h[key]))return;
        h.oppName=opponentName;h.lastTs=next.updatedAt;h2h[opponent]=h;
      }
      const entry={game,result,oppName:opponentName,ts:next.updatedAt,...(opponent?{oppUid:opponent}:{})};
      const history=Object.fromEntries(Object.entries({...saved.matchHistory,[operationId]:entry})
        .sort(([idA,a],[idB,b])=>(Number(b?.ts)||0)-(Number(a?.ts)||0) || (idA===operationId?-1:idB===operationId?1:0)).slice(0,20));
      const revision=Number.isSafeInteger(saved.heroMatchRevision) && saved.heroMatchRevision>=0?saved.heroMatchRevision:0;
      if(!Number.isSafeInteger(revision+1))return;
      return {...saved,stats:next,h2h,matchHistory:history,heroMatchRevision:revision+1,
        heroMatchClaims:{...saved.heroMatchClaims,[operationId]:{game,result,oppUid:opponent,ts:next.updatedAt}}};
    },{applyLocally:false});
    if(!current())return false;
    profile=transaction.committed?transaction.snapshot.val():(await get(ref(db,'users/'+uid))).val();
  }catch(error){
    if(!current())return false;
    try{profile=(await get(ref(db,'users/'+uid))).val();}catch(readError){return false;}
  }
  if(!current())return false;
  const receipt=profile?.heroMatchClaims?.[operationId];
  if(!receipt || receipt.game!==game || receipt.result!==result || receipt.oppUid!==opponent)return false;
  applyMatchSnapshot(uid,profile);emit();
  if(transaction?.committed && current()){
    try{
      if(typeof window.recordGameResult==='function' && !window.__heroBridgeBusy){
        window.__heroBridgeBusy=true;
        try{window.recordGameResult(game,result,0);}finally{setTimeout(()=>{window.__heroBridgeBusy=false;},100);}
      }
    }catch(error){}
    if(result==='draw' && current())_trackQuestSafe('game_draw',{game});
    if(result==='win' && [3,5,10,20].includes(profile.stats.streak) && current()){
      void push(ref(db,'achWall'),{uid,userName:String(actor.displayName || 'Oyuncu'),achId:'streak_'+operationId,
        achName:'🔥 '+profile.stats.streak+' maçlık galibiyet serisi!',icon:'🔥',isAdmin:false,ts:Date.now()}).catch(()=>{});
    }
    if(result==='win' || result==='draw'){
      try{const clan=await import('./clan.js');if(current() && clan?.addClanWarPoints)void Promise.resolve(clan.addClanWarPoints(result==='win'?10:3)).catch(()=>{});}catch(error){}
    }
  }
  return current();
}

export async function getMatchHistory(limit){
  const uid=player.uid;
  if(!uid || Auth.getState().uid!==uid)return [];
  try{
    const snap=await get(ref(db,'users/'+uid+'/matchHistory'));
    if(player.uid!==uid || Auth.getState().uid!==uid || !snap.exists())return [];
    const value=snap.val();if(!value || typeof value!=='object' || Array.isArray(value))return [];
    const size=Number.isSafeInteger(limit) && limit>0?Math.min(limit,20):20;
    return Object.entries(value).map(([id,entry])=>({id,...entry})).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,size);
  }catch(error){return [];}
}

// ── Kaju ekle (günlük limitli, admin sınırsız) ──────────────────
// ⚡ Aktif kozmo bonus çarpanı (localStorage'dan senkron okur — import gecikmesi yok)
function _kozmoMult(type){
  try{
    if(!player.uid || Auth.getState().uid !== player.uid) return 1;
    const raw = localStorage.getItem('hero_active_kozmo:'+player.uid);
    if(!raw) return 1;
    const a = JSON.parse(raw);
    if(!a || a.ownerUid !== player.uid) return 1;
    // Yeni değerli taşlar: doğrudan bonus objesi {xp/score/kaju/all}
    if(a.bonus && typeof a.bonus === 'object'){
      const b = a.bonus;
      const bonus = key => typeof b[key] === 'number' && Number.isFinite(b[key]) && b[key] >= 0 && b[key] <= 1 ? b[key] : 0;
      if(type==='xp_boost'    && bonus('xp'))    return 1 + bonus('xp');
      if(type==='score_boost' && bonus('score')) return 1 + bonus('score');
      if(type==='kaju_boost'  && bonus('kaju'))  return 1 + bonus('kaju');
      if(bonus('all') && (type==='xp_boost'||type==='score_boost'||type==='kaju_boost')) return 1 + bonus('all');
      // bonus var ama bu tipe uymuyorsa power tablosuna düşmesin
      if(!a.power) return 1;
    }
    if(!a.power) return 1;
    // Bonus tablosu (kozmos.js KOZMO_POWERS ile eşleşir)
    const P = {
      'Yıldız Tozu Saçar':['xp_boost',0.05],'Alev Püskürtür':['score_boost',0.05],
      'Alev Saçar':['score_boost',0.08],'Şans Getirir':['wheel_luck',1],
      'Bulut Çağırır':['kaju_boost',0.05],'Yıldırım Düşürür':['score_boost',0.07],
      'Işık Kırar':['xp_boost',0.06],'Üç Kuyruk Sallar':['kaju_boost',0.06],
      'Işık Saçar':['xp_boost',0.07],'Okyanus Dalgası':['score_boost',0.06],
      'Şimşek Hızı':['xp_boost',0.10],'Işık Patlatır':['allboost',0.08],
      'Gelgit Çağırır':['kaju_boost',0.08],'Renk Cümbüşü':['allboost',0.05],
      'Karanlığı Yutar':['score_boost',0.10],
    };
    const e = P[a.power];
    if(!e) return 1;
    const [key,val] = e;
    if(key === type) return 1 + val;
    if(key === 'allboost' && (type==='xp_boost'||type==='score_boost'||type==='kaju_boost')) return 1 + val;
    return 1;
  }catch(e){ return 1; }
}
function _applyKozmoBonus(n, type){
  const m = _kozmoMult(type);
  return m > 1 ? Math.round(n * m) : n;
}

export async function addKaju(n, game, reason){
  n = Number(n);
  if(!Number.isSafeInteger(n)) return 0;
  // Negatif → harcama olarak işle (geriye uyumluluk: shop.js addKaju(-price) çağırıyor)
  if(n < 0){
    if(!await spendKaju(-n, game, reason)) throw new Error('Ödeme tamamlanamadı');
    return n;
  }
  if(n <= 0 || !player.uid) return 0;
  // ⚡ Aktif kozmo Kaju bonusu (varsa kazanımı çarpar)
  n = _applyKozmoBonus(n, 'kaju_boost');
  n = Math.round(n * getBoostMult('kaju'));    // satın alınan Kaju boost'u
  if(!Number.isSafeInteger(n) || n <= 0) return 0;
  const uid = player.uid;
  if(Auth.getState().uid !== uid) return 0;
  const day = new Date().toISOString().slice(0,10), legacyToday = loadKajuToday(uid);
  const earnId = walletOperationId('earn'), observed = walletObserved();
  let credited = 0;
  const result = await runTransaction(ref(db, 'users/' + uid), profile => {
    if(Auth.getState().uid !== uid) return;
    if(!profile || profile.deleted || typeof profile!=='object' || Array.isArray(profile))return;
    const balance = walletBalance(profile.kaju); if(balance === null) return;
    const saved = profile.heroKajuDaily;
    const today = saved?.day === day ? safeCounter(saved.amount) : legacyToday;
    if(today === null) return;
    const remaining = Auth.getState().isAdmin === true ? n : Math.max(0, KAJU_DAILY_LIMIT - today);
    credited = Math.min(n, remaining, KAJU_MAX - balance);
    if(credited <= 0) return;
    return {...profile, kaju:balance + credited, heroWalletRevision:nextWalletRevision(profile),
      heroKajuDaily:{day,amount:today + credited,lastEarn:{id:earnId,amount:credited}}};
  }, {applyLocally:false});
  if(!result.committed) return 0;
  const profile = result.snapshot.val() || {}, earned = profile.heroKajuDaily?.lastEarn;
  if(earned?.id !== earnId || !Number.isSafeInteger(earned.amount) || earned.amount <= 0) throw new Error('Kazanç onayı geçersiz');
  n = earned.amount;
  saveKajuToday(profile.heroKajuDaily.amount, uid);
  void mirrorWallet(uid, profile, uid);
  if(Auth.getState().uid !== uid || player.uid !== uid) return n;
  applyWalletSnapshot(uid, profile, observed);
  player.kajuToday = profile.heroKajuDaily.amount;
  // Görev takibi: Kaju kazanıldı (görev ödülü/transfer kendini saymasın)
  if(game !== 'quest' && game !== 'transfer' && game !== 'vip'){ _trackQuestSafe('kaju_earned', { amount: n }); }
  // 🪙 Geçmişe kaydet
  logKaju(n, 'earn', game || 'genel', reason || _kajuReason(game, n));
  emit();
  import('./daily.js').then(m=>m.kajuCoinSound('earn')).catch(()=>{});
  return n;
}

// A reward receipt and its balance change commit together, including across tabs.
// The backend remains responsible for authorizing rewards; this prevents retries
// from duplicating a legitimate claim or marking a failed credit as paid.
export async function claimKajuOnce(receiptId, reward, game, reason, uid = player.uid){
  if(!uid || Auth.getState().uid !== uid || !/^[\w-]{1,180}$/.test(receiptId)) return {claimed:false, reason:'identity'};
  let amount = 0, fields = {}, rejected = 'unavailable';
  const observed = walletObserved();
  const result = await runTransaction(ref(db, 'users/' + uid), profile => {
    if(Auth.getState().uid !== uid){ rejected = 'identity'; return; }
    if(!profile || profile.deleted || typeof profile!=='object' || Array.isArray(profile))return;
    if(profile.heroRewardClaims?.[receiptId]) return;
    const next = typeof reward === 'function' ? reward(profile) : {amount:reward};
    amount = next?.amount;
    fields = next?.fields || {};
    const balance = walletBalance(profile.kaju);
    if(balance === null){ rejected = 'invalid-profile'; return; }
    if(!Number.isSafeInteger(amount) || amount <= 0){ rejected = 'ineligible'; return; }
    if(balance + amount > KAJU_MAX){ rejected = 'balance-limit'; return; }
    return {...profile, ...fields, kaju:balance + amount, heroWalletRevision:nextWalletRevision(profile),
      heroRewardClaims:{...profile.heroRewardClaims, [receiptId]:{amount, ts:Date.now()}}};
  }, {applyLocally:false});
  if(Auth.getState().uid !== uid) return {claimed:false, reason:'identity'};
  // An abort can carry a cached snapshot; reconcile only after a fresh SDK get.
  const confirmed = result.committed ? result.snapshot : await get(ref(db, 'users/' + uid));
  if(Auth.getState().uid !== uid) return {claimed:false, reason:'identity'};
  const profile = confirmed.val() || {};
  const balance = finiteAmount(profile.kaju);
  const receipt = profile.heroRewardClaims?.[receiptId];
  if(!result.committed){
    // A confirmed receipt lets a reopened panel repair its local marker without
    // replaying a credit. A rejected write never reaches this successful receipt path.
    if(receipt && Number.isSafeInteger(receipt.amount) && receipt.amount > 0){
      if(player.uid === uid){ applyWalletSnapshot(uid, profile, observed); emit(); }
      return {claimed:false, alreadyClaimed:true, amount:receipt.amount, balance, receipt, reason:'already-claimed'};
    }
    return {claimed:false, alreadyClaimed:false, reason:rejected};
  }
  amount = receipt?.amount;
  if(!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Ödül onayı geçersiz');
  fields = Object.fromEntries(Object.keys(fields).map(key => [key, profile[key]]));
  if(player.uid === uid){
    applyWalletSnapshot(uid, profile, observed);
    logKaju(amount, 'earn', game, reason);
    emit();
  }
  void mirrorWallet(uid, profile, uid);
  return {claimed:true, alreadyClaimed:false, amount, balance, fields, receipt};
}

// All wheel sectors share one daily receipt. The selected outcome and its
// Kaju/XP credit commit together, so retrying cannot reroll or change sectors.
// Egg delivery is a recoverable second step keyed by receipt.eggId in Kozmos.
export async function claimWheelReward(day, segment, uid = player.uid){
  const current = () => !!uid && Auth.getState().uid === uid && Auth.getState().status === 'google';
  if(!current()) return {claimed:false, complete:false, reason:'identity'};
  const dayTime = typeof day === 'string' ? Date.parse(day+'T00:00:00Z') : NaN;
  if(typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(dayTime) || new Date(dayTime).toISOString().slice(0,10) !== day) return {claimed:false, complete:false, reason:'invalid-reward'};
  const type = segment?.type, requested = segment?.amount;
  const valid = type === 'kaju' ? [30,50,120,300].includes(requested)
    : type === 'xp' ? [40,100].includes(requested)
    : type === 'jackpot' ? requested === 750 : type === 'egg' && requested === 1;
  if(!valid) return {claimed:false, complete:false, reason:'invalid-reward'};
  const receiptId = 'spin_' + day, observed = walletObserved();
  let rejected = 'unavailable';
  const result = await runTransaction(ref(db, 'users/' + uid), profile => {
    if(!current()){ rejected='identity'; return; }
    if(!profile || profile.deleted || typeof profile!=='object' || Array.isArray(profile))return;
    if(profile.heroRewardClaims?.[receiptId]) return;
    let vip = profile.cosmetics?.vip;
    try{ if(typeof vip === 'string') vip = JSON.parse(vip); }catch(e){ vip = null; }
    const vipMult = vip?.until && Number(vip.until) > Date.now() ? 2 : 1;
    const amount = (type === 'egg' ? 50 : requested) * vipMult;
    const receipt = {kind:'wheel', type, amount, vipMult, ts:Date.now()};
    const fields = {};
    if(type === 'xp'){
      const stored = profile.xp && typeof profile.xp === 'object' ? profile.xp : {};
      let level = Math.max(1, finiteAmount(profile.level || stored.level, 1));
      let xp = finiteAmount(stored.xp ?? profile.xp), totalXP = finiteAmount(stored.totalXP ?? profile.totalXP);
      if(!Number.isSafeInteger(level) || !Number.isSafeInteger(xp + amount) || !Number.isSafeInteger(totalXP + amount)){ rejected='invalid-profile'; return; }
      xp += amount; totalXP += amount;
      // Corrupt legacy XP must not make a reward callback loop indefinitely.
      let advances = 0;
      while(xp >= xpForLevel(level)){
        if(advances++ >= 10000){ rejected='invalid-profile'; return; }
        xp -= xpForLevel(level); level++;
      }
      fields.level = level; fields.xp = {level, xp, totalXP}; fields.heroXPRevision = nextXPRevision(profile);
    } else {
      const balance = walletBalance(profile.kaju);
      if(balance === null){ rejected='invalid-profile'; return; }
      if(balance + amount > KAJU_MAX){ rejected='balance-limit'; return; }
      fields.kaju = balance + amount;
      if(type === 'egg') receipt.eggId = 'daily_spin_' + day;
    }
    return {...profile, ...fields, heroWalletRevision:nextWalletRevision(profile), heroRewardClaims:{...profile.heroRewardClaims, [receiptId]:receipt}};
  }, {applyLocally:false});
  if(!current()) return {claimed:false, complete:false, reason:'identity'};
  const confirmed = result.committed ? result.snapshot : await get(ref(db, 'users/' + uid));
  if(!current()) return {claimed:false, complete:false, reason:'identity'};
  const profile = confirmed.val() || {};
  const receipt = profile.heroRewardClaims?.[receiptId];
  if(!receipt || receipt.kind !== 'wheel' || !Number.isSafeInteger(receipt.amount) || receipt.amount <= 0 || !['kaju','jackpot','xp','egg'].includes(receipt.type)) return {claimed:false, complete:false, reason:rejected};
  const balance = finiteAmount(profile.kaju);
  if(player.uid === uid){
    applyWalletSnapshot(uid, profile, observed);
    if(receipt.type === 'xp'){
      applyXPSnapshot(uid,profile);
    } else if(result.committed) logKaju(receipt.amount,'earn','spin','Günlük çark');
    emit();
  }
  if(result.committed && receipt.type !== 'xp'){
    void mirrorWallet(uid, profile, uid);
    if(current()) _trackQuestSafe('kaju_earned',{amount:receipt.amount});
  }
  return {claimed:result.committed, alreadyClaimed:!result.committed, receipt, amount:receipt.amount, balance, complete:receipt.type !== 'egg'};
}

function walletObserved(){ return typeof walletObservation === 'number' ? walletObservation : 0; }
function nextWalletRevision(profile){ return (Number.isSafeInteger(profile?.heroWalletRevision) && profile.heroWalletRevision >= 0 ? profile.heroWalletRevision : 0) + 1; }
function applyWalletSnapshot(uid, profile, observed){
  if(player.uid !== uid || Auth.getState().uid !== uid || profile?.deleted) return;
  if(observed !== undefined && walletObserved() !== observed) return;
  player.kaju = Math.min(KAJU_MAX, finiteAmount(profile?.kaju));
  if(profile?.kajuSent) player.kajuSent = profile.kajuSent;
}
async function mirrorWallet(uid, profile, actorUid){
  const balance = walletBalance(profile?.kaju), revision = nextWalletRevision(profile) - 1;
  if(balance === null) return;
  try{
    await runTransaction(ref(db, 'leaderboard/kaju/' + uid), current => {
      if(Auth.getState().uid !== actorUid) return;
      if(Number.isSafeInteger(current?.revision) && current.revision > revision) return;
      return {uid,kaju:balance,revision,ts:Date.now()};
    }, {applyLocally:false});
  }catch(e){ console.warn('[store] wallet mirror', e?.code || 'sync_failed'); }
}
function walletBalance(value){
  if(value === null || value === undefined) return 0;
  const n = typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n >= 0 && n <= KAJU_MAX ? n : null;
}
function safeCounter(value){ const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : null; }
let walletOperationSequence = 0;
function walletOperationId(prefix){
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g,'') || Math.random().toString(36).slice(2,14);
  return prefix + '_' + Date.now().toString(36) + '_' + random + '_' + (++walletOperationSequence).toString(36);
}
let appliedXPUid = null, appliedXPRevision = 0;
function nextXPRevision(profile){ return (Number.isSafeInteger(profile?.heroXPRevision) && profile.heroXPRevision >= 0 ? profile.heroXPRevision : 0) + 1; }
function xpProfileState(profile){
  const saved = profile?.xp && typeof profile.xp === 'object' && !Array.isArray(profile.xp) ? profile.xp : {};
  const number = value => typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  const level = number(profile?.level ?? saved.level ?? 1), xp = number(saved.xp ?? profile?.xp ?? 0), totalXP = number(saved.totalXP ?? profile?.totalXP ?? 0);
  if(!Number.isSafeInteger(level) || level < 1 || !Number.isSafeInteger(300+200*level) || !Number.isSafeInteger(xp) || xp < 0 || !Number.isSafeInteger(totalXP) || totalXP < 0) return null;
  return {level,xp,totalXP};
}
function applyXPSnapshot(uid,profile){
  if(player.uid !== uid || Auth.getState().uid !== uid || profile?.deleted) return;
  const state = xpProfileState(profile); if(!state) return;
  const revision = nextXPRevision(profile)-1;
  if(appliedXPUid !== uid){ appliedXPUid=uid; appliedXPRevision=0; }
  if(revision < appliedXPRevision) return;
  appliedXPRevision=revision;
  Object.assign(player,state);
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
  amount = Number(amount);
  if(!Number.isSafeInteger(amount) || amount <= 0 || !player.uid) return false;
  const uid = player.uid;
  if(Auth.getState().uid !== uid) return false;
  const observed = walletObserved();
  let result;
  try{
    result = await runTransaction(ref(db, 'users/' + uid), profile => {
      if(Auth.getState().uid !== uid) return;
      if(!profile || profile.deleted || typeof profile!=='object' || Array.isArray(profile))return;
      const balance = walletBalance(profile.kaju);
      if(balance === null || balance < amount) return;
      return {...profile,kaju:balance - amount,heroWalletRevision:nextWalletRevision(profile)};
    }, {applyLocally:false});
  }catch(e){ console.warn('[store] spendKaju', e); return false; }
  if(!result.committed) return false;
  const profile = result.snapshot.val() || {};
  void mirrorWallet(uid, profile, uid);
  if(player.uid !== uid || Auth.getState().uid !== uid) return true;
  applyWalletSnapshot(uid, profile, observed);
  logKaju(amount, 'spend', game||'shop', reason||'Harcama');
  try{ import('./daily.js').then(m=>m.kajuCoinSound('spend')).catch(()=>{}); }catch(e){}
  emit();
  return true;
}



// ════════════ 📦 ENVANTER & BOOST SİSTEMİ ════════════
function _pruneExpiredBoosts(){
  if(!player.boosts) return;
  const now = Date.now();
  let changed = false;
  for(const k of Object.keys(player.boosts)){
    const b = player.boosts[k];
    if(b && b.until && b.until < now){ delete player.boosts[k]; changed = true; }
  }
  if(changed && player.uid){
    try{ update(ref(db,'users/'+player.uid), { boosts: player.boosts }); }catch(e){}
  }
}

// Aktif boost çarpanı (kozmo bonusuyla ÇARPILIR — ikisi birlikte çalışır)
export function getBoostMult(type){
  _pruneExpiredBoosts();
  if(!player.boosts) return 1;
  const now = Date.now();
  let mult = 1;
  for(const k of Object.keys(player.boosts)){
    const b = player.boosts[k];
    if(!b || (b.until && b.until < now)) continue;
    if(b.type === type || b.type === 'all') mult *= (b.mult || 1);
  }
  return mult;
}

// Boost aktifleştir (süreli). durationMs sonra otomatik biter.
export async function activateBoost(key, type, mult, durationMs){
  if(!player.uid) return false;
  const until = Date.now() + durationMs;
  player.boosts = player.boosts || {};
  player.boosts[key] = { type, mult, until };
  emit();
  try{ await update(ref(db,'users/'+player.uid), { boosts: player.boosts }); }catch(e){}
  return true;
}

// Aktif boost listesi (UI için)
export function getActiveBoosts(){
  _pruneExpiredBoosts();
  const now = Date.now();
  const out = [];
  for(const k of Object.keys(player.boosts||{})){
    const b = player.boosts[k];
    if(b && (!b.until || b.until > now)) out.push({ key:k, ...b, remainMs: b.until ? b.until-now : 0 });
  }
  return out;
}

// Envantere ürün ekle
export async function addItem(itemId, qty){
  if(!player.uid) return false;
  qty = qty || 1;
  player.inventory = player.inventory || {};
  player.inventory[itemId] = (player.inventory[itemId] || 0) + qty;
  emit();
  try{ await update(ref(db,'users/'+player.uid), { inventory: player.inventory }); }catch(e){}
  return true;
}

let inventoryCacheUid=null, appliedInventoryRevision=0;
function applyInventorySnapshot(uid,profile,observed){
  if(player.uid!==uid || Auth.getState().uid!==uid || profile?.deleted || observed!==undefined && walletObserved()!==observed)return;
  if(profile.inventory && (typeof profile.inventory!=='object' || Array.isArray(profile.inventory)))return;
  const revision=Number.isSafeInteger(profile.heroInventoryRevision) && profile.heroInventoryRevision>=0?profile.heroInventoryRevision:0;
  if(inventoryCacheUid!==uid){inventoryCacheUid=uid;appliedInventoryRevision=0;}
  if(revision<appliedInventoryRevision)return;
  appliedInventoryRevision=revision;player.inventory={...(profile.inventory || {})};
}

// The item decrement and use receipt commit together; never grant a hint for
// an optimistic or rejected decrement. A stable ID makes explicit retries safe.
export async function useItem(itemId,expectedUid=player.uid,requestedId){
  const uid=expectedUid,current=()=>!!uid && player.uid===uid && Auth.getState().uid===uid;
  if(!current() || !validWalletKey(itemId) || !/^[\w-]+$/.test(itemId))return false;
  const operationId=requestedId || walletOperationId('item');
  if(typeof operationId!=='string' || !/^[\w-]{1,180}$/.test(operationId))return false;
  const observed=walletObserved();let result,profile;
  try{
    result=await runTransaction(ref(db,'users/'+uid),saved=>{
      if(!current() || !saved || saved.deleted || typeof saved!=='object' || Array.isArray(saved))return;
      if(saved.heroItemUses?.[operationId])return;
      if(!saved.inventory || typeof saved.inventory!=='object' || Array.isArray(saved.inventory))return;
      const count=strictWalletInteger(saved.inventory[itemId]);if(count===null || count<=0)return;
      const inventory={...saved.inventory};if(count===1)delete inventory[itemId];else inventory[itemId]=count-1;
      const revision=Number.isSafeInteger(saved.heroInventoryRevision) && saved.heroInventoryRevision>=0?saved.heroInventoryRevision:0;
      if(!Number.isSafeInteger(revision+1))return;
      return {...saved,inventory,heroInventoryRevision:revision+1,heroItemUses:{...saved.heroItemUses,[operationId]:{itemId,ts:Date.now()}}};
    },{applyLocally:false});
    if(!current())return false;
    profile=result.committed?result.snapshot.val():(await get(ref(db,'users/'+uid))).val();
  }catch(error){
    if(!current())return false;
    try{profile=(await get(ref(db,'users/'+uid))).val();}catch(readError){return false;}
  }
  if(!current() || profile?.heroItemUses?.[operationId]?.itemId!==itemId)return false;
  applyInventorySnapshot(uid,profile,observed);emit();return true;
}

export function getItemCount(itemId){ return (player.inventory && player.inventory[itemId]) || 0; }
export function getInventory(){ return Object.assign({}, player.inventory||{}); }

// Kozmetik ayarla (nick efekti, sohbet teması, unvan vb.)
export async function setCosmetic(key, value){
  if(!player.uid) return false;
  player.cosmetics = player.cosmetics || {};
  if(value === null || value === undefined) delete player.cosmetics[key];
  else player.cosmetics[key] = value;
  emit();
  try{ await update(ref(db,'users/'+player.uid), { cosmetics: player.cosmetics }); }catch(e){}
  return true;
}
export function getCosmetic(key){ return player.cosmetics && player.cosmetics[key]; }
export async function markPurchasedOnce(bundleId){
  if(!player.uid) return;
  player.purchasedOnce = player.purchasedOnce || {};
  player.purchasedOnce[bundleId] = true;
  emit();
  try{ await update(ref(db, 'users/' + player.uid + '/purchasedOnce'), { [bundleId]: true }); }catch(e){ console.warn('[store] markPurchasedOnce', e); }
}
export function hasPurchasedOnce(bundleId){ return !!(player.purchasedOnce && player.purchasedOnce[bundleId]); }
export function getCosmetics(){ return Object.assign({}, player.cosmetics||{}); }


// XP credit and its receipt commit together. The optional operation ID lets a
// caller retry an uncertain award without granting it twice.
export async function awardXP(n, expectedUid = player.uid, requestedId){
  const requestedAmount = strictWalletInteger(n), uid = expectedUid;
  const current = () => !!uid && player.uid === uid && Auth.getState().uid === uid;
  const fail = (error,extra={}) => ({ok:false,amount:0,leveled:false,level:current()?player.level:1,error,...extra});
  if(!current()) return fail('Hesap değişti veya oturum yok');
  if(requestedAmount === null || requestedAmount <= 0) return fail('Pozitif tam sayı XP gerekli');
  n = Math.round(_applyKozmoBonus(requestedAmount,'xp_boost') * getBoostMult('xp'));
  if(!Number.isSafeInteger(n) || n <= 0) return fail('XP miktarı geçersiz');
  const operationId = requestedId || walletOperationId('xp');
  if(typeof operationId !== 'string' || !/^[\w-]{1,180}$/.test(operationId)) return fail('İşlem kimliği geçersiz');
  let result, profile, rejection = 'XP eklenemedi';
  try{
    result = await runTransaction(ref(db,'users/'+uid), saved => {
      if(!current()){ rejection='Hesap değişti'; return; }
      if(!saved || saved.deleted || typeof saved !== 'object' || Array.isArray(saved)){ rejection='Oyuncu profili bulunamadı'; return; }
      if(saved.heroXPClaims?.[operationId]) return;
      const state = xpProfileState(saved);
      if(!state || !Number.isSafeInteger(state.xp+n) || !Number.isSafeInteger(state.totalXP+n)){ rejection='XP bakiyesi doğrulanamadı'; return; }
      let {level,xp,totalXP} = state; xp += n; totalXP += n;
      // Thresholds form an arithmetic progression; binary search avoids an
      // unbounded level-up loop for a large but otherwise valid integer award.
      let low=0, high=Math.floor(Math.sqrt(xp/100))+1;
      const cost = levels => levels*(300+200*level)+100*levels*(levels-1);
      while(low < high){
        const mid=Math.ceil((low+high)/2), needed=cost(mid);
        if(Number.isSafeInteger(needed) && needed <= xp) low=mid; else high=mid-1;
      }
      xp -= cost(low); level += low;
      if(!Number.isSafeInteger(level) || !Number.isSafeInteger(300+200*level)){ rejection='Seviye sınırı aşıldı'; return; }
      const receipt={requestedAmount,amount:n,leveled:level>state.level,level,ts:Date.now()};
      return {...saved,level,xp:{level,xp,totalXP},heroXPRevision:nextXPRevision(saved),heroXPClaims:{...saved.heroXPClaims,[operationId]:receipt}};
    },{applyLocally:false});
    if(!current()) return fail('Hesap değişti; XP işlem kaydı korunuyor',{uncertain:!!result.committed,operationId});
    profile=result.committed?result.snapshot.val():(await get(ref(db,'users/'+uid))).val();
  }catch(error){
    if(!current()) return fail('Hesap değişti; XP işlem kaydı korunuyor',{uncertain:true,operationId});
    try{ profile=(await get(ref(db,'users/'+uid))).val(); }
    catch(readError){ return fail('XP işleminin sonucu doğrulanamadı',{uncertain:true,operationId}); }
  }
  if(!current()) return fail('Hesap değişti; XP işlem kaydı korunuyor',{uncertain:true,operationId});
  const receipt=profile?.heroXPClaims?.[operationId], state=xpProfileState(profile);
  if(!state || receipt?.requestedAmount !== requestedAmount || !Number.isSafeInteger(receipt.amount) || receipt.amount <= 0) return fail(rejection,{operationId});
  applyXPSnapshot(uid,profile); emit();
  return {ok:true,amount:receipt.amount,leveled:receipt.leveled===true,level:state.level,operationId,alreadyApplied:!result?.committed};
}

// Existing callers use this boolean only for a level-up notification.
export async function addXP(n){ const result=await awardXP(n); return result.ok && result.leveled; }

function scoreValue(value){
  if(value === null || value === undefined) return 0;
  const amount=strictWalletInteger(value); return amount !== null && amount >= 0 ? amount : null;
}
let scoreCacheUid=null, confirmedScores={};
// True means a new best, or a previously incomplete equal best, was confirmed
// in both the profile and ranking. A failed/unknown write never reports success.
export async function addScore(game, score){
  score=strictWalletInteger(score);
  const actor=Auth.getState(), uid=player.uid, name=String(actor.displayName || 'Oyuncu');
  const current=()=>!!uid && player.uid===uid && Auth.getState().uid===uid;
  if(!current() || actor.uid!==uid || typeof game!=='string' || !/^[a-z][a-z0-9_-]{0,63}$/i.test(game) || ['constructor','prototype'].includes(game) || score===null || score<=0) return false;
  _trackQuestSafe('game_played',{game});
  if(game==='tetris') _trackQuestSafe('score_tetris',{score});
  const bestRef=ref(db,'users/'+uid), rankingRef=ref(db,'gameLB/'+game+'/'+uid);
  const observed=walletObserved();
  let result, best, attemptedImprovement=false;
  try{
    result=await runTransaction(bestRef,profile=>{
      if(!current() || !profile || profile.deleted || typeof profile!=='object' || Array.isArray(profile))return;
      const saved=scoreValue(profile.bestScores?.[game]); if(saved===null || saved>=score) return;
      attemptedImprovement=true; return {...profile,bestScores:{...profile.bestScores,[game]:score}};
    },{applyLocally:false});
    if(!current()) return false;
    const profile=result.committed?result.snapshot.val():(await get(bestRef)).val();
    if(profile?.deleted)return false;best=scoreValue(profile?.bestScores?.[game]);
  }catch(error){
    if(!current()) return false;
    try{const profile=(await get(bestRef)).val();if(profile?.deleted)return false;best=scoreValue(profile?.bestScores?.[game]);}catch(readError){ return false; }
  }
  if(!current() || best===null || best<score) return false;
  if(scoreCacheUid!==uid){ scoreCacheUid=uid; confirmedScores={}; }
  confirmedScores[game]=Math.max(confirmedScores[game] || 0,best);
  if(walletObserved()===observed){ player.best={...player.best,[game]:confirmedScores[game]}; emit(); }
  let mirrored, mirrorChanged=false, attemptedMirror=false;
  try{
    const mirror=await runTransaction(rankingRef,previous=>{
      if(!current()) return;
      const saved=scoreValue(previous?.score);
      if(previous && (typeof previous!=='object' || Array.isArray(previous) || saved===null)) return;
      if(saved>best || saved===best && previous?.uid===uid) return;
      attemptedMirror=true;
      return {uid,name,score:best,ts:Date.now()};
    },{applyLocally:false});
    if(!current()) return false;
    mirrorChanged=mirror.committed;
    mirrored=mirror.committed?mirror.snapshot.val():(await get(rankingRef)).val();
  }catch(error){
    if(!current()) return false;
    try{ mirrored=(await get(rankingRef)).val(); }catch(readError){ return false; }
  }
  if(!current() || mirrored?.uid!==uid || scoreValue(mirrored.score)===null || scoreValue(mirrored.score)<best) return false;
  return !!(result?.committed || attemptedImprovement || (mirrorChanged || attemptedMirror) && best===score);
}

// ════════════════════════════════════════════════════════════════
//  KAJU TRANSFER / GÖNDERİM
//  • Admin: doğrudan runTransaction (kaynak yaratır, 0 altına düşmez, per-işlem tavanı)
//  • Kullanıcı→kullanıcı: kendi bakiyesinden düş → kajuTransfers (pending) → alıcı talep eder
//  Not: Cloud Functions olmadan sunucu-taraflı atomiklik sınırlıdır; limitler + denetim
//  kaydı (kaju_history) hile riskini sınırlar. Tam koruma için Cloud Functions önerilir.
// ════════════════════════════════════════════════════════════════
function winKeys(){ const iso = new Date().toISOString(); return { h:iso.slice(0,13), d:iso.slice(0,10), m:iso.slice(0,7) }; }
function validWalletKey(value, max = 128){ return typeof value === 'string' && value.length > 0 && value.length <= max && !/[.#$\[\]\/\u0000-\u001f\u007f]/.test(value); }
function strictWalletInteger(value){
  if(typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?\d+$/.test(value.trim()))) return null;
  const n = Number(value); return Number.isSafeInteger(n) ? n : null;
}
function sentAmounts(sent = {}, w = winKeys()){
  const amount = (windowKey, value, key) => windowKey === key ? safeCounter(value === undefined ? 0 : value) : 0;
  return {h:amount(sent.hWin,sent.hAmt,w.h),d:amount(sent.dWin,sent.dAmt,w.d),m:amount(sent.mWin,sent.mAmt,w.m),w};
}
function curSent(){ return sentAmounts(player.kajuSent || {}); }
function checkLimits(amount, c = curSent()){
  if(c.h === null || c.d === null || c.m === null) return {ok:false,error:'Gönderim sayacı doğrulanamadı'};
  if(c.h + amount > TX_HOUR) return {ok:false,error:`Saatlik limit aşılır (${TX_HOUR}). Kalan: ${Math.max(0,TX_HOUR-c.h)}`};
  if(c.d + amount > TX_DAY) return {ok:false,error:`Günlük limit aşılır (${TX_DAY}). Kalan: ${Math.max(0,TX_DAY-c.d)}`};
  if(c.m + amount > TX_MONTH) return {ok:false,error:`Aylık limit aşılır (${TX_MONTH}). Kalan: ${Math.max(0,TX_MONTH-c.m)}`};
  return {ok:true};
}
export function transferRemaining(){
  const c = curSent();
  return {perTx:TX_PER,min:TX_MIN,hour:c.h === null ? 0 : Math.max(0,TX_HOUR-c.h),day:c.d === null ? 0 : Math.max(0,TX_DAY-c.d),month:c.m === null ? 0 : Math.max(0,TX_MONTH-c.m)};
}
function walletError(error, fallback){
  const code = String(error?.code || error?.message || '').toLowerCase();
  return code.includes('permission') || code.includes('denied') ? 'Sunucu bu işleme izin vermedi' : fallback;
}
async function targetExists(uid){
  const snap = await get(ref(db,'users/'+uid));
  const value = snap.val(); return !!value && !value.deleted && typeof value === 'object' && !Array.isArray(value);
}
function adminResult(profile, operationId){
  const receipt = profile?.heroAdminKajuOps?.[operationId];
  if(profile?.deleted || !receipt || !Number.isSafeInteger(receipt.appliedDelta) || !receipt.appliedDelta || Math.abs(receipt.appliedDelta) > ADMIN_OP_CAP || walletBalance(receipt.newBalance) === null) return null;
  return {ok:true,amount:Math.abs(receipt.appliedDelta),appliedDelta:receipt.appliedDelta,newBalance:receipt.newBalance,
    requestedDelta:receipt.requestedDelta,clipped:receipt.appliedDelta !== receipt.requestedDelta,operationId};
}

// An admin operation, its actual delta and target history commit together.
async function adminCredit(toUid, delta, reason, requestedId){
  const me = Auth.getState(), current = () => Auth.getState().uid === me.uid && Auth.getState().status === 'google' && Auth.getState().isAdmin === true;
  if(!me.uid || me.status !== 'google' || me.isAdmin !== true) return {ok:false,error:'Yetki yok'};
  if(!validWalletKey(toUid)) return {ok:false,error:'Geçerli hedef gerekli'};
  const operationId = requestedId || walletOperationId('admin');
  if(!validWalletKey(operationId,160) || !/^[\w-]+$/.test(operationId)) return {ok:false,error:'İşlem kimliği geçersiz'};
  const observed = walletObserved();
  let rejection = 'İşlem yapılamadı', result;
  try{
    if(!await targetExists(toUid)) return {ok:false,error:'Alıcı hesabı bulunamadı'};
    if(!current()) return {ok:false,error:'Hesap veya yetki değişti',operationId};
    result = await runTransaction(ref(db,'users/'+toUid), profile => {
      if(!current()){ rejection='Hesap veya yetki değişti'; return; }
      if(!profile || profile.deleted || typeof profile !== 'object' || Array.isArray(profile)){ rejection='Alıcı hesabı bulunamadı'; return; }
      const previous = profile.heroAdminKajuOps?.[operationId];
      if(previous){
        if(previous.actorUid !== me.uid || previous.requestedDelta !== delta) rejection='İşlem kimliği başka bir işleme ait';
        return;
      }
      const balance = walletBalance(profile.kaju);
      if(balance === null){ rejection='Hedef bakiyesi doğrulanamadı'; return; }
      const newBalance = Math.max(0,Math.min(KAJU_MAX,balance + delta)), appliedDelta = newBalance - balance;
      if(!appliedDelta){ rejection='Bakiye sınırı nedeniyle değişiklik yapılmadı'; return; }
      const receipt = {actorUid:me.uid,requestedDelta:delta,appliedDelta,newBalance,ts:Date.now()};
      return {...profile,kaju:newBalance,heroWalletRevision:nextWalletRevision(profile),
        heroAdminKajuOps:{...profile.heroAdminKajuOps,[operationId]:receipt},
        kaju_history:{...profile.kaju_history,[operationId]:{amount:Math.abs(appliedDelta),type:appliedDelta>0?'admin-add':'admin-sub',game:'kaju',reason:String(reason || 'admin'),actorUid:me.uid,ts:receipt.ts}}};
    }, {applyLocally:false});
  }catch(error){
    // A missing acknowledgement is not evidence that the credit did not commit.
    if(current()){
      try{
        const profile = (await get(ref(db,'users/'+toUid))).val();
        if(!current()) return {ok:false,error:'Hesap veya yetki değişti; işlem kaydı korunuyor',uncertain:true,operationId};
        const recovered = adminResult(profile,operationId);
        if(recovered && profile.heroAdminKajuOps[operationId].actorUid === me.uid && profile.heroAdminKajuOps[operationId].requestedDelta === delta){
          applyWalletSnapshot(toUid,profile,observed); void mirrorWallet(toUid,profile,me.uid); return recovered;
        }
      }catch(e){}
    }
    return {ok:false,error:walletError(error,'İşlemin sonucu doğrulanamadı; aynı işlemi yeniden kontrol edebilirsin'),uncertain:!String(error?.code || error?.message || '').toLowerCase().includes('permission'),operationId};
  }
  if(!current()) return {ok:false,error:'Hesap veya yetki değişti; işlem kaydı korunuyor',uncertain:!!result?.committed,operationId};
  let profile;
  try{ profile = result.committed ? result.snapshot.val() : (await get(ref(db,'users/'+toUid))).val(); }
  catch(error){ return {ok:false,error:walletError(error,'İşlemin sonucu doğrulanamadı'),uncertain:true,operationId}; }
  if(!current()) return {ok:false,error:'Hesap veya yetki değişti; işlem kaydı korunuyor',uncertain:true,operationId};
  const receipt = profile?.heroAdminKajuOps?.[operationId], answer = adminResult(profile,operationId);
  if(!answer || receipt.actorUid !== me.uid || receipt.requestedDelta !== delta) return {ok:false,error:rejection,operationId};
  applyWalletSnapshot(toUid,profile,observed);
  if(toUid === me.uid && current()){ if(result.committed) logKaju(answer.amount,answer.appliedDelta>0?'earn':'spend','admin',reason || 'Admin işlemi'); emit(); }
  void mirrorWallet(toUid,profile,me.uid);
  return {...answer,alreadyApplied:!result.committed};
}
export async function adminAdjustKaju(targetUid, delta, reason, operationId){
  delta = strictWalletInteger(delta);
  if(Auth.getState().isAdmin !== true) return {ok:false,error:'Yetki yok'};
  if(delta === null || delta === 0) return {ok:false,error:'Sıfırdan farklı tam sayı gerekli'};
  if(Math.abs(delta) > ADMIN_OP_CAP) return {ok:false,error:`Tek seferde en fazla ${ADMIN_OP_CAP}`};
  return adminCredit(targetUid,delta,reason || 'admin-adjust',operationId);
}

const outgoingFlushes = new Map(), incomingClaims = new Map(), outgoingDirty = new Set(), incomingDirty = new Set();
function validTransfer(txId, transfer, recipient){
  return validWalletKey(txId,160) && /^[\w-]+$/.test(txId) && transfer && typeof transfer === 'object' && !Array.isArray(transfer)
    && validWalletKey(recipient) && transfer.txId === txId && transfer.toUid === recipient && validWalletKey(transfer.fromUid) && transfer.fromUid !== recipient
    && Number.isSafeInteger(transfer.amount) && transfer.amount >= TX_MIN && transfer.amount <= TX_PER;
}
async function publishOutbox(uid, txId, transfer){
  const current = () => Auth.getState().uid === uid && Auth.getState().status === 'google';
  if(!current() || !validTransfer(txId,transfer,transfer.toUid) || transfer.fromUid !== uid) return false;
  // Republish exactly the same transfer ID. An already-credited receiver's receipt
  // survives pending-record deletion, so replay cannot credit that transfer twice.
  await set(ref(db,'kajuTransfers/'+transfer.toUid+'/'+txId), {
    v:155,txId,fromUid:uid,fromNick:transfer.fromNick || 'Oyuncu',toUid:transfer.toUid,amount:transfer.amount,ts:transfer.ts
  });
  if(!current()) return false;
  await runTransaction(ref(db,'users/'+uid), profile => {
    if(!current() || !profile || profile.deleted) return;
    const entry = profile.kajuOutbox?.[txId];
    if(!entry || entry.amount !== transfer.amount || entry.toUid !== transfer.toUid || entry.state === 'published') return;
    return {...profile,kajuOutbox:{...profile.kajuOutbox,[txId]:{...entry,state:'published',publishedAt:Date.now()}}};
  }, {applyLocally:false});
  if(!current()) return true;
  try{
    const N = await import('./notify.js');
    if(current()) await N.notifyKajuGift(transfer.toUid,transfer.amount,transfer.fromNick || 'Bir oyuncu',uid,txId);
  }catch(e){}
  return true;
}
export function retryPendingTransfers(txId){
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google') return Promise.resolve({ok:false,published:0,queued:0,publishedIds:[],confirmedIds:[],queuedIds:[],error:'Google ile giriş gerekli'});
  if(outgoingFlushes.has(me.uid)){ outgoingDirty.add(me.uid); return outgoingFlushes.get(me.uid); }
  const uid = me.uid, current = () => Auth.getState().uid === uid && Auth.getState().status === 'google';
  const task = (async()=>{
    let published = 0, queued = 0, ok = true, error;
    const publishedIds = [], confirmedIds = [], queuedIds = [];
    try{
      const profile = (await get(ref(db,'users/'+uid))).val() || {};
      if(profile.deleted)return {ok:false,published,queued,publishedIds,confirmedIds,queuedIds,error:'Oyuncu kaydı silinmiş'};
      if(!current()) return {ok:false,published,queued,publishedIds,confirmedIds,queuedIds,error:'Hesap değişti'};
      for(const [txId,transfer] of Object.entries(profile.kajuOutbox || {})){
        if(!current()) break;
        if(!validTransfer(txId,transfer,transfer?.toUid) || transfer.fromUid !== uid){ queued++; queuedIds.push(txId); continue; }
        if(transfer.state === 'published'){ confirmedIds.push(txId); continue; }
        try{
          if(await publishOutbox(uid,txId,transfer)){ published++; publishedIds.push(txId); confirmedIds.push(txId); }
          else {queued++;queuedIds.push(txId);}
        }catch(cause){ queued++;queuedIds.push(txId);error=walletError(cause,'Bazı gönderimler bağlantı geldiğinde tamamlanacak'); }
      }
    }catch(cause){ ok=false;error=walletError(cause,'Bekleyen gönderimler okunamadı'); }
    return {ok:ok && current(),published,queued,publishedIds,confirmedIds,queuedIds,...(error?{error}:{})};
  })();
  outgoingFlushes.set(uid,task);
  void task.finally(()=>{
    if(outgoingFlushes.get(uid) === task) outgoingFlushes.delete(uid);
    if(outgoingDirty.delete(uid) && current()) void retryPendingTransfers();
  });
  return task;
}

// Debit, rolling limits and durable outbox are one own-profile transaction.
// Failed delivery is queued; an uncertain publish is never refunded locally.
async function canonicalTransferId(uid, operationId){
  if(!globalThis.crypto?.subtle?.digest) throw new Error('secure-crypto-unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(uid+'\0'+operationId));
  return 'tx_'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
}
export async function transferKaju(toUid, toNick, amount, options = {}){
  amount = strictWalletInteger(amount);
  const me = Auth.getState(), uid = me.uid;
  const current = () => Auth.getState().uid === uid && Auth.getState().status === 'google';
  if(!uid || me.status !== 'google') return {ok:false,error:'Göndermek için Google ile giriş gerekli'};
  if(!validWalletKey(toUid)) return {ok:false,error:'Alıcı bulunamadı'};
  if(amount === null || amount < 1) return {ok:false,error:'Pozitif tam sayı gerekli'};
  if(me.isAdmin === true){
    if(amount > ADMIN_OP_CAP) return {ok:false,error:`Tek seferde en fazla ${ADMIN_OP_CAP}`};
    const result = await adminCredit(toUid,amount,'admin-gift → '+String(toNick || toUid),options?.txId);
    return result.ok ? {...result,admin:true,queued:false,pending:false,txId:result.operationId} : result;
  }
  if(amount < TX_MIN) return {ok:false,error:`En az ${TX_MIN} Kaju, tam sayı olarak girilmeli`};
  if(toUid === uid) return {ok:false,error:'Kendine gönderemezsin'};
  if(amount > TX_PER) return {ok:false,error:`Tek transferde en fazla ${TX_PER} Kaju`};
  const operationId = options?.txId || walletOperationId('tx');
  if(!validWalletKey(operationId,160) || !/^[\w-]+$/.test(operationId)) return {ok:false,error:'İşlem kimliği geçersiz'};
  let txId;
  try{ txId = await canonicalTransferId(uid,operationId); }
  catch(error){ return {ok:false,error:'Güvenli işlem kimliği oluşturulamadı; güncel tarayıcıda HTTPS bağlantısını kullan',operationId}; }
  if(!current()) return {ok:false,error:'Hesap değişti',txId,operationId};
  const observed = walletObserved(), w = winKeys();
  let rejection = 'Gönderilemedi', result;
  try{
    if(!await targetExists(toUid)) return {ok:false,error:'Alıcı hesabı bulunamadı'};
    if(!current()) return {ok:false,error:'Hesap değişti',txId};
    result = await runTransaction(ref(db,'users/'+uid), profile => {
      if(!current()){ rejection='Hesap değişti'; return; }
      if(!profile || profile.deleted || typeof profile !== 'object' || Array.isArray(profile)){ rejection='Gönderen hesabı bulunamadı'; return; }
      const previous = profile.kajuOutbox?.[txId];
      if(previous){ rejection=previous.amount === amount && previous.toUid === toUid ? 'existing' : 'İşlem kimliği başka bir işleme ait'; return; }
      const balance = walletBalance(profile.kaju);
      if(balance === null){ rejection='Bakiye doğrulanamadı'; return; }
      const counters = sentAmounts(profile.kajuSent || {},w), limits = checkLimits(amount,counters);
      if(!limits.ok){ rejection=limits.error; return; }
      if(balance < amount){ rejection='Yetersiz bakiye'; return; }
      if(Object.values(profile.kajuOutbox || {}).filter(t=>t?.state !== 'published').length >= 100){ rejection='Bekleyen gönderimler tamamlanmadan yeni gönderim yapılamıyor'; return; }
      const transfer = {v:155,txId,operationId,fromUid:uid,fromNick:String(me.displayName || 'Oyuncu'),toUid,toNick:String(toNick || 'Oyuncu'),amount,ts:Date.now(),state:'queued'};
      return {...profile,kaju:balance-amount,heroWalletRevision:nextWalletRevision(profile),
        kajuSent:{hWin:w.h,hAmt:counters.h+amount,dWin:w.d,dAmt:counters.d+amount,mWin:w.m,mAmt:counters.m+amount},
        kajuOutbox:{...profile.kajuOutbox,[txId]:transfer}};
    }, {applyLocally:false});
  }catch(error){
    // Recovery reads the stable reservation; no second debit or speculative refund.
    if(current()){
      try{
        const profile = (await get(ref(db,'users/'+uid))).val(), entry = profile?.kajuOutbox?.[txId];
        if(!current()) return {ok:false,error:'Hesap değişti; gönderim kaydı korunuyor',uncertain:true,txId};
        if(entry && entry.fromUid === uid && entry.toUid === toUid && entry.amount === amount){
          applyWalletSnapshot(uid,profile,observed); emit(); void mirrorWallet(uid,profile,uid); void retryPendingTransfers();
          return {ok:true,amount,queued:entry.state !== 'published',pending:entry.state !== 'published',txId,recovered:true};
        }
      }catch(e){}
    }
    return {ok:false,error:walletError(error,'Gönderim sonucu doğrulanamadı; aynı işlem kimliğiyle yeniden kontrol edebilirsin'),uncertain:!String(error?.code || error?.message || '').toLowerCase().includes('permission'),txId};
  }
  if(!current()) return {ok:false,error:'Hesap değişti; kaydedilmiş gönderim hesabına dönünce tamamlanacak',uncertain:!!result?.committed,txId};
  let profile;
  try{ profile = result.committed ? result.snapshot.val() : (await get(ref(db,'users/'+uid))).val(); }
  catch(error){ return {ok:false,error:walletError(error,'Gönderim sonucu doğrulanamadı'),uncertain:true,txId}; }
  if(!current()) return {ok:false,error:'Hesap değişti; gönderim kaydı korunuyor',uncertain:true,txId};
  const entry = profile?.kajuOutbox?.[txId];
  if(!entry || entry.toUid !== toUid || entry.amount !== amount || entry.fromUid !== uid) return {ok:false,error:rejection,txId};
  applyWalletSnapshot(uid,profile,observed);
  if(result.committed && current()) logKaju(amount,'spend','gift','Gönderim kaydedildi → '+String(toNick || toUid));
  emit(); void mirrorWallet(uid,profile,uid);
  if(entry.state === 'published') return {ok:true,amount,queued:false,pending:false,txId,alreadyApplied:true};
  let published = false;
  try{ published = await publishOutbox(uid,txId,entry); }catch(error){}
  return {ok:true,amount,queued:!published,pending:!published,txId};
}

export function claimPendingTransfers(){
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google') return Promise.resolve({total:0,claimed:[],invalid:0});
  if(incomingClaims.has(me.uid)){ incomingDirty.add(me.uid); return incomingClaims.get(me.uid); }
  const uid = me.uid, current = () => Auth.getState().uid === uid && Auth.getState().status === 'google';
  const task = (async()=>{
    let total = 0, invalid = 0; const claimed = [];
    try{
      const snap = await get(ref(db,'kajuTransfers/'+uid));
      if(!current() || !snap.exists()) return {total,claimed,invalid};
      const all = snap.val();
      if(!all || typeof all !== 'object' || Array.isArray(all)) return {total,claimed,invalid:1};
      for(const [txId,transfer] of Object.entries(all)){
        if(!current()) break;
        // Old legitimate v154 entries already carry these identity/amount fields.
        // Malformed entries remain for inspection; never erase evidence or round credit.
        if(!validTransfer(txId,transfer,uid)){ invalid++; continue; }
        try{
          const result = await claimKajuOnce('transfer_'+txId,transfer.amount,'gift',String(transfer.fromNick || 'Biri')+' gönderdi',uid);
          if(!current()) break;
          if((result.claimed || result.alreadyClaimed) && result.amount === transfer.amount){
            if(result.claimed){ total += result.amount; claimed.push({from:transfer.fromNick || 'Biri',amount:result.amount,txId}); }
            await set(ref(db,'kajuTransfers/'+uid+'/'+txId),null);
          }
        }catch(error){}
      }
      if(total > 0 && current()){
        emit();
        try{ window.dispatchEvent(new CustomEvent('hero:kaju-claimed',{detail:{uid,total,claimed}})); }catch(e){}
      }
    }catch(error){ console.warn('[store] claimPending',error?.code || 'read_failed'); }
    return {total,claimed,invalid};
  })();
  incomingClaims.set(uid,task);
  void task.finally(()=>{
    if(incomingClaims.get(uid) === task) incomingClaims.delete(uid);
    if(incomingDirty.delete(uid) && current()) void claimPendingTransfers();
  });
  return task;
}

function startWalletListeners(uid){
  const epoch = ++walletListenEpoch;
  liveWalletUid = uid;
  const current = () => epoch === walletListenEpoch && Auth.getState().uid === uid && player.uid === uid;
  let mirrored = '';
  try{
    liveWalletOff = onValue(ref(db,'users/'+uid), snap => {
      if(!current()) return;
      const profile = snap.val(); if(!profile || typeof profile !== 'object' || Array.isArray(profile)) return;
      if(profile.deleted){hydrate({...Auth.getState(),profile});return;}
      walletObservation++; applyWalletSnapshot(uid,profile);
      applyInventorySnapshot(uid,profile); player.boosts = profile.boosts || {};
      player.cosmetics = profile.cosmetics || {}; player.purchasedOnce = profile.purchasedOnce || {};
      applyXPSnapshot(uid,profile); applyMatchSnapshot(uid,profile);
      if(!profile.bestScores || typeof profile.bestScores === 'object' && !Array.isArray(profile.bestScores)){
        player.best={...(profile.bestScores || {})}; scoreCacheUid=uid; confirmedScores={...player.best};
      }
      emit();
      const marker = String(profile.heroWalletRevision || 0)+':'+String(profile.kaju || 0);
      if(marker !== mirrored){ mirrored=marker; void mirrorWallet(uid,profile,uid); }
      if(Object.values(profile.kajuOutbox || {}).some(t=>t?.state !== 'published')) void retryPendingTransfers();
    }, error => { if(current()) console.warn('[store] wallet listener',error?.code || 'read_failed'); });
    liveTransfersOff = onValue(ref(db,'kajuTransfers/'+uid), snap => {
      if(current() && snap.exists()) void claimPendingTransfers();
    }, error => { if(current()) console.warn('[store] transfer listener',error?.code || 'read_failed'); });
    liveKozmosOff = onValue(ref(db,'kozmos/'+uid+'/creatures'), snap => {
      if(!current()) return;
      const creatures = snap.val();
      if(creatures !== null && (typeof creatures !== 'object' || Array.isArray(creatures))) return;
      try{
        const key = 'hero_active_kozmo:'+uid, active = JSON.parse(localStorage.getItem(key) || 'null');
        if(active?.ownerUid === uid && (typeof active.id !== 'string' || !active.id || !Object.prototype.hasOwnProperty.call(creatures || {},active.id))){
          localStorage.removeItem(key);
        }
      }catch(error){}
    }, error => { if(current()) console.warn('[store] kozmo listener',error?.code || 'read_failed'); });
  }catch(error){ console.warn('[store] wallet listeners',error?.code || 'unavailable'); }
}
if(typeof window !== 'undefined') window.addEventListener?.('online',()=>{
  if(Auth.getState().status === 'google'){ void retryPendingTransfers(); void claimPendingTransfers(); }
});

export const Store = { subscribe, getState, addKaju, claimKajuOnce, claimWheelReward, addXP, awardXP, addScore, xpForLevel, transferKaju, adminAdjustKaju, claimPendingTransfers, retryPendingTransfers, transferRemaining, logKaju, getKajuLog, getKajuSummary, logSpend, spendKaju, getBoostMult, activateBoost, getActiveBoosts, addItem, useItem, getItemCount, getInventory, setCosmetic, getCosmetic, getCosmetics, trackQuestEvent, markPurchasedOnce, hasPurchasedOnce, isVip, vipDaysLeft, vipPrice, VIP_DISCOUNT, recordMatchResult, getStats, getH2H, getMatchHistory };
export default Store;
// Immediate Auth callbacks need every Store binding to have been initialized.
Auth.subscribe(hydrate);
