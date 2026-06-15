// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — GÜNLÜK GİRİŞ ÖDÜLÜ + KAJU KAZANIM LİMİTİ
//  Goodyedek: _kajuLoadDaily, KAJU_GAME_LIMITS, loginStreak
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

// ── Günlük kazanım limitleri (Goodyedek birebir) ─────────────
export const KAJU_GAME_LIMITS = {
  tetris: 300, chess: 200, tavla: 200,
  kelime: 250, kozmo: 100, daily_login: 50,
  friend_game: 20, clan_bonus: 30, achievement: 100, level_up: 25,
};
export const KAJU_TOTAL_DAILY_LIMIT = 1500;

const TODAY = () => new Date().toISOString().slice(0,10);

function loadDailyState(){
  try{
    const d = JSON.parse(localStorage.getItem('htu_kaju_daily2')||'null');
    if(d && d.date === TODAY()) return d.games||{};
  }catch(e){}
  return {};
}
function saveDailyState(games){
  try{ localStorage.setItem('htu_kaju_daily2', JSON.stringify({date:TODAY(), games})); }catch(e){}
}
export function dailyEarned(game){
  const g = loadDailyState();
  if(game) return g[game]||0;
  return Object.values(g).reduce((a,b)=>a+b, 0);
}
export function recordEarning(game, amount){
  const g = loadDailyState();
  g[game] = (g[game]||0) + amount;
  saveDailyState(g);
}
export function canEarn(game, amount){
  const st = Auth.getState();
  if(st.isAdmin === true) return true; // Admin bypass
  const gameEarned = dailyEarned(game);
  const limit = KAJU_GAME_LIMITS[game]||200;
  if(gameEarned >= limit) return false;
  const totalEarned = dailyEarned();
  return totalEarned < KAJU_TOTAL_DAILY_LIMIT;
}

// ── Kaju coin sesi (Goodyedek kajuCoinSound) ─────────────────
export function kajuCoinSound(type){
  try{
    const ac = new(window.AudioContext||window.webkitAudioContext)();
    if(type === 'earn'){
      // Yükselen çift ding
      [[523,0],[659,0.08],[784,0.16],[1047,0.26]].forEach(([f,d])=>{
        const o=ac.createOscillator(), g=ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type='sine'; o.frequency.value=f;
        const t=ac.currentTime+d;
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.18,t+0.01);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
        o.start(t); o.stop(t+0.2);
      });
    } else if(type === 'spend'){
      [[784,0],[659,0.08],[523,0.16]].forEach(([f,d])=>{
        const o=ac.createOscillator(), g=ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type='triangle'; o.frequency.value=f;
        const t=ac.currentTime+d;
        g.gain.setValueAtTime(0.12,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15);
        o.start(t); o.stop(t+0.18);
      });
    }
  }catch(e){}
}

// ── Günlük giriş ödülü ───────────────────────────────────────
const DAILY_REWARDS = [50,75,100,125,150,200,300]; // 7 günlük

export async function checkDailyLogin(){
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google') return;
  const key = 'htu_daily_login_' + st.uid;
  try{
    const snap = await fdb.get(fdb.ref(db,'users/'+st.uid+'/dailyLogin'));
    const data = snap.exists() ? snap.val() : {streak:0, lastDate:''};
    const today = TODAY();
    if(data.lastDate === today) return; // Zaten alındı
    const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
    const newStreak = data.lastDate === yesterday ? Math.min((data.streak||0)+1, 7) : 1;
    const reward = DAILY_REWARDS[newStreak-1] || 50;
    // Ödülü kaydet
    await fdb.update(fdb.ref(db,'users/'+st.uid+'/dailyLogin'), {streak:newStreak, lastDate:today, lastReward:reward});
    await Store.addKaju(reward, 'daily_login', 'Günlük giriş');
    recordEarning('daily_login', reward);
    kajuCoinSound('earn');
    // Toast göster
    showDailyToast(newStreak, reward);
  }catch(e){}
}

function showDailyToast(streak, reward){
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a2a4a,#0e1628);border:1.5px solid rgba(255,215,64,.45);border-radius:16px;padding:14px 20px;z-index:99999;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.6);animation:dailyToastIn .4s cubic-bezier(.34,1.56,.64,1)';
  const days = ['1.','2.','3.','4.','5.','6.','7.'][streak-1]||'';
  el.innerHTML = '<div style="font-size:22px;margin-bottom:4px">🗓️</div>'
    + '<div style="font-size:13px;font-weight:900;color:#FFD740">Günlük Ödül!</div>'
    + '<div style="font-size:11px;color:#9fb0d8;margin:3px 0">'+days+' gün serisi</div>'
    + '<div style="font-size:18px;font-weight:900;color:#FFD740">+'+reward+' 🥜</div>'
    + '<div style="display:flex;justify-content:center;gap:4px;margin-top:8px">'
    + Array.from({length:7},(_,i)=>'<div style="width:8px;height:8px;border-radius:50%;background:'+(i<streak?'#FFD740':'rgba(255,255,255,.15)')+'"></div>').join('')
    + '</div>';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
  if(!document.getElementById('dailyToastCSS')){
    const sty=document.createElement('style');
    sty.id='dailyToastCSS';
    sty.textContent='@keyframes dailyToastIn{from{opacity:0;transform:translateX(-50%) translateY(-20px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}';
    document.head.appendChild(sty);
  }
}

export default checkDailyLogin;
