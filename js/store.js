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
import Auth, { db, fdb } from './auth.js';
const { ref, get, set, update } = fdb;

const KAJU_DAILY_LIMIT = 2000;

const player = {
  uid: null, ready: false,
  kaju: 0, level: 1, xp: 0, totalXP: 0,
  best: {},            // { tetris: 12345, ... }
  kajuToday: 0         // bugün kazanılan (günlük limit için, local)
};

const subs = new Set();
export function subscribe(fn){ subs.add(fn); try{ fn(snapshot()); }catch(e){} return () => subs.delete(fn); }
function snapshot(){ return Object.assign({}, player, { best: Object.assign({}, player.best) }); }
function emit(){ const s = snapshot(); subs.forEach(fn => { try{ fn(s); }catch(e){ console.error('[store]', e); } }); }
export function getState(){ return snapshot(); }

export function xpForLevel(lv){ return 300 + lv * 200; }

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
  player.xp      = Number((p.xp && p.xp.xp) || 0);
  player.totalXP = Number((p.xp && p.xp.totalXP) || 0);
  player.best    = p.bestScores || {};
  player.kajuToday = loadKajuToday();
  player.ready   = true;
  emit();
}
Auth.subscribe(hydrate);

// ── Kaju ekle (günlük limitli, admin sınırsız) ──────────────────
export async function addKaju(n, game){
  n = Math.floor(n || 0);
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
  emit();
  try{
    await update(ref(db, 'users/' + player.uid), { kaju: player.kaju });
    await set(ref(db, 'leaderboard/kaju/' + player.uid), { uid: player.uid, kaju: player.kaju, ts: Date.now() });
  }catch(e){ console.warn('[store] addKaju sync', e); }
  return n;
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

export const Store = { subscribe, getState, addKaju, addXP, addScore, xpForLevel };
export default Store;
