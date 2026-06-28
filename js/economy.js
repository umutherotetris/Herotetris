// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — EKONOMİ MODÜLÜ
//  🪙 Kaju Geçmişi · 🎰 Günlük Çark · 📋 Günlük Görevler
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import Store, { getKajuLog as _getKajuLog, getKajuSummary as _getKajuSummary, addKaju as _addKaju, addXP as _addXP } from './store.js';
// Güvenli erişim sarmalayıcıları (eski cache koruması)
const _S = {
  getKajuLog: (f)=> (Store&&Store.getKajuLog?Store.getKajuLog(f):(_getKajuLog?_getKajuLog(f):[])),
  getKajuSummary: ()=> (Store&&Store.getKajuSummary?Store.getKajuSummary():(_getKajuSummary?_getKajuSummary():{earned:0,spent:0,count:0})),
  addKaju: (n,g)=> (Store&&Store.addKaju?Store.addKaju(n,g):(_addKaju?_addKaju(n,g):Promise.resolve(0))),
  addXP: (n)=> (Store&&Store.addXP?Store.addXP(n):(_addXP?_addXP(n):Promise.resolve(false))),
  isVip: ()=> (Store&&Store.isVip?Store.isVip():false),
};

// ── Toast yardımcısı ──
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(20,28,50,.95);color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5)'; document.body.appendChild(t); setTimeout(()=>t.remove(),2800); }catch(e){}
}
function _relTime(ts){
  const d = Date.now() - ts;
  if(d < 60000) return 'şimdi';
  if(d < 3600000) return Math.floor(d/60000) + ' dk önce';
  if(d < 86400000) return Math.floor(d/3600000) + ' sa önce';
  if(d < 604800000) return Math.floor(d/86400000) + ' gün önce';
  return new Date(ts).toLocaleDateString('tr-TR', {day:'2-digit', month:'2-digit'});
}
function esc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ════════════════════════════════════════════════════════════════
//  🪙 KAJU GEÇMİŞİ EKRANI
// ════════════════════════════════════════════════════════════════
let _kajuFilter = 'all';
export function openKajuHistory(){
  injectEconomyCSS();
  const ex = document.getElementById('kajuHistOv'); if(ex) ex.remove();
  const ov = document.createElement('div');
  ov.id = 'kajuHistOv'; ov.className = 'eco-ov';
  const _sumRaw = _S.getKajuSummary() || {};
  const summary = { earned: Number(_sumRaw.earned)||0, spent: Number(_sumRaw.spent)||0, count: Number(_sumRaw.count)||0 };
  ov.innerHTML = `
    <div class="eco-box">
      <div class="eco-head">
        <span class="eco-title">🪙 Kaju Geçmişi</span>
        <button class="eco-close" data-close>✕</button>
      </div>
      <div class="kaju-summary">
        <div class="kaju-sum-item earn"><div class="kaju-sum-val">+${summary.earned.toLocaleString('tr-TR')}</div><div class="kaju-sum-lbl">KAZANILAN</div></div>
        <div class="kaju-sum-item spend"><div class="kaju-sum-val">-${summary.spent.toLocaleString('tr-TR')}</div><div class="kaju-sum-lbl">HARCANAN</div></div>
        <div class="kaju-sum-item"><div class="kaju-sum-val">${summary.count}</div><div class="kaju-sum-lbl">İŞLEM</div></div>
      </div>
      <div class="kaju-filters">
        <button class="kaju-filter" data-f="all">Tümü</button>
        <button class="kaju-filter" data-f="earn">Kazanç</button>
        <button class="kaju-filter" data-f="spend">Harcama</button>
      </div>
      <div class="kaju-hist-list" id="kajuHistList"></div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  ov.querySelectorAll('.kaju-filter').forEach(b => b.addEventListener('click', () => {
    _kajuFilter = b.dataset.f; renderKajuHistory();
  }));
  renderKajuHistory();
}

function renderKajuHistory(){
  const list = document.getElementById('kajuHistList'); if(!list) return;
  // Filtre butonu aktif stili
  document.querySelectorAll('.kaju-filter').forEach(b => {
    b.classList.toggle('active', b.dataset.f === _kajuFilter);
  });
  const entries = _S.getKajuLog(_kajuFilter);
  if(!entries.length){
    list.innerHTML = '<div class="eco-empty"><div class="eco-empty-icon">📭</div><div>Henüz kayıt yok</div><div class="eco-empty-sub">Oyun oynayıp Kaju kazanmaya başla!</div></div>';
    return;
  }
  const gameIcons = { tetris:'🧩', chess:'♟️', satranc:'♟️', tavla:'🎲', kelime:'🔤',
    daily:'🗓️', daily_login:'🗓️', spin:'🎰', quest:'📋', shop:'🛒', clan:'🏰',
    gift:'🎁', social:'👥', genel:'🎮' };
  list.innerHTML = entries.slice(0, 100).map(e => {
    const isEarn = e.type === 'earn';
    return `<div class="kaju-row">
      <div class="kaju-row-ico">${gameIcons[e.game] || '🎮'}</div>
      <div class="kaju-row-info">
        <div class="kaju-row-reason">${esc(e.reason || e.game || '—')}</div>
        <div class="kaju-row-time">${_relTime(e.ts)}</div>
      </div>
      <div class="kaju-row-amt ${isEarn?'earn':'spend'}">${isEarn?'+':'-'}${(Number(e.amount)||0).toLocaleString('tr-TR')} 🥜</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════
//  🎰 GÜNLÜK ÇARK
// ════════════════════════════════════════════════════════════════
// Çark dilimleri: ağırlıklı (küçük ödül sık, büyük nadir)
const WHEEL_SEGMENTS = [
  { type:'kaju',    amount:50,  label:'50🥜',  color:'#FFD740', weight:22, ico:'🥜' },
  { type:'xp',      amount:40,  label:'40 XP', color:'#c084fc', weight:18, ico:'⚡' },
  { type:'kaju',    amount:120, label:'120🥜', color:'#FFA726', weight:15, ico:'🥜' },
  { type:'kaju',    amount:30,  label:'30🥜',  color:'#FFE082', weight:18, ico:'🥜' },
  { type:'xp',      amount:100, label:'100 XP',color:'#AB47BC', weight:10, ico:'⚡' },
  { type:'kaju',    amount:300, label:'300🥜', color:'#FF7043', weight:7,  ico:'💰' },
  { type:'egg',     amount:1,   label:'Yumurta',color:'#66BB6A', weight:5, ico:'🥚' },
  { type:'jackpot', amount:750, label:'750!',  color:'#FF5252', weight:2,  ico:'💎' },
];

function spinKey(){ return 'hero_spin_' + new Date().toISOString().slice(0,10); }
export function canSpin(){
  try{ return localStorage.getItem(spinKey()) !== '1'; }catch(e){ return true; }
}
function markSpun(){ try{ localStorage.setItem(spinKey(), '1'); }catch(e){} }

export function openDailyWheel(){
  injectEconomyCSS();
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google'){ _toast('🔑 Çark için Google girişi gerekli'); return; }
  const ex = document.getElementById('wheelOv'); if(ex) ex.remove();
  const ov = document.createElement('div');
  ov.id = 'wheelOv'; ov.className = 'eco-ov';
  const segCount = WHEEL_SEGMENTS.length;
  const segAngle = 360 / segCount;
  // SVG çark dilimleri
  let segs = '';
  WHEEL_SEGMENTS.forEach((seg, i) => {
    const a0 = (i * segAngle - 90) * Math.PI/180;
    const a1 = ((i+1) * segAngle - 90) * Math.PI/180;
    const r = 120, cx = 130, cy = 130;
    const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
    const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
    const large = segAngle > 180 ? 1 : 0;
    segs += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${seg.color}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>`;
    // Etiket
    const am = (a0 + a1) / 2;
    const lr = r * 0.66;
    const lx = cx + lr*Math.cos(am), ly = cy + lr*Math.sin(am);
    const rot = (i * segAngle) + segAngle/2;
    segs += `<text x="${lx}" y="${ly}" fill="#1a1020" font-size="13" font-weight="900" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot},${lx},${ly})">${seg.label}</text>`;
  });
  const already = !canSpin();
  ov.innerHTML = `
    <div class="eco-box wheel-box">
      <div class="eco-head">
        <span class="eco-title">🎰 Günlük Çark</span>
        <button class="eco-close" data-close>✕</button>
      </div>
      <div class="wheel-sub">${already ? 'Bugünkü hakkını kullandın · Yarın tekrar gel!' : 'Günde bir kez çevir, ödülü kap!'}${(_S.isVip&&_S.isVip())?' <b style="color:#ffd54f">👑 VIP ×2 ödül!</b>':''}</div>
      <div class="wheel-prizes">
        <span class="wheel-prize-chip">🥜 Kaju</span>
        <span class="wheel-prize-chip">⚡ XP</span>
        <span class="wheel-prize-chip">🥚 Yumurta</span>
        <span class="wheel-prize-chip" style="color:#FF8080;border-color:rgba(255,82,82,.3)">💎 750 Jackpot</span>
      </div>
      <div class="wheel-wrap">
        <div class="wheel-glow-ring"></div>
        <div class="wheel-pointer">▼</div>
        <svg class="wheel-svg" id="wheelSvg" width="260" height="260" viewBox="0 0 260 260">
          <circle cx="130" cy="130" r="124" fill="none" stroke="rgba(255,215,64,.5)" stroke-width="4"/>
          <g id="wheelRotor" style="transform-origin:130px 130px">${segs}</g>
          <circle cx="130" cy="130" r="22" fill="#1a2440" stroke="#FFD740" stroke-width="3"/>
          <text x="130" y="130" fill="#FFD740" font-size="16" text-anchor="middle" dominant-baseline="middle">🥜</text>
        </svg>
      </div>
      <button class="wheel-spin-btn" id="wheelSpinBtn" ${already?'disabled':''}>${already?'⏳ Yarın Tekrar':'🎰 ÇEVİR'}</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });

  const btn = ov.querySelector('#wheelSpinBtn');
  const rotor = ov.querySelector('#wheelRotor');
  let spinning = false;
  if(btn && !already){
    btn.addEventListener('click', async () => {
      if(spinning || !canSpin()) return;
      spinning = true; btn.disabled = true; btn.textContent = '🌀 Dönüyor…';
      // Ağırlıklı rastgele seçim
      const total = WHEEL_SEGMENTS.reduce((a,s) => a+s.weight, 0);
      let rnd = Math.random() * total, idx = 0;
      for(let i=0; i<WHEEL_SEGMENTS.length; i++){ rnd -= WHEEL_SEGMENTS[i].weight; if(rnd <= 0){ idx = i; break; } }
      const seg = WHEEL_SEGMENTS[idx];
      // Hedef açı: dilim üstte (pointer'da) dursun
      const segAngle = 360 / WHEEL_SEGMENTS.length;
      const targetMid = idx * segAngle + segAngle/2;
      const spins = 5; // tam tur
      const finalRot = spins * 360 + (360 - targetMid);
      rotor.style.transition = 'transform 4s cubic-bezier(.17,.67,.2,1)';
      rotor.style.transform = `rotate(${finalRot}deg)`;
      // Ses
      try{ wheelSpinSound(); }catch(e){}
      setTimeout(async () => {
        markSpun();
        // 👑 VIP çark 2× bonusu
        let vipMult = 1;
        try{ if(_S.isVip && _S.isVip()) vipMult = 2; }catch(e){}
        const vipTag = vipMult>1 ? ' 👑×2' : '';
        // Ödülü ver
        if(seg.type === 'xp'){
          const amt = seg.amount * vipMult;
          await _S.addXP(amt);
          _toast(`🎉 ${amt} XP kazandın!${vipTag}`);
        } else if(seg.type === 'egg'){
          // Kozmo yumurtası ver
          try{ const kz = await import('./kozmos.js'); if(kz.grantEgg) await kz.grantEgg(); }catch(e){}
          const bonus = 50 * vipMult;
          await _S.addKaju(bonus, 'spin');  // bonus kaju da
          _toast(`🥚 Kozmo Yumurtası + ${bonus}🥜 kazandın!${vipTag}`);
        } else {
          const amt = seg.amount * vipMult;
          await _S.addKaju(amt, 'spin');
          _toast(`🎉 ${amt} 🥜 kazandın!${vipTag}`);
        }
        try{ winSound(seg.type === 'jackpot'); }catch(e){}
        btn.textContent = seg.type === 'jackpot' ? '💰 JACKPOT!' : '✅ Kazandın!';
        // Görev ilerletme
        try{ progressQuest('spin'); }catch(e){}
        setTimeout(() => { const o = document.getElementById('wheelOv'); if(o) o.remove(); }, 1800);
      }, 4100);
    });
  }
}

function wheelSpinSound(){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    let t = ac.currentTime;
    for(let i=0; i<20; i++){
      const o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.frequency.value = 400 + Math.random()*200;
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.05);
      o.start(t); o.stop(t+0.05);
      t += 0.04 + i*0.012; // yavaşlayan tık
    }
  }catch(e){}
}
function winSound(big){
  try{
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const notes = big ? [523,659,784,1047,1319] : [523,659,784];
    notes.forEach((f,i) => {
      const o=ac.createOscillator(), g=ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type='sine'; o.frequency.value=f;
      const t=ac.currentTime+i*0.1;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.18,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
      o.start(t); o.stop(t+0.28);
    });
  }catch(e){}
}

// ════════════════════════════════════════════════════════════════
//  📋 GÜNLÜK GÖREVLER
// ════════════════════════════════════════════════════════════════
// Görev tanımları (her gün sıfırlanır)
const QUEST_DEFS = [
  { id:'play3',   icon:'🎮', title:'3 Oyun Oyna',       target:3,   reward:100, track:'play' },
  { id:'win1',    icon:'🏆', title:'1 Galibiyet Al',    target:1,   reward:150, track:'win' },
  { id:'earn200', icon:'🥜', title:'200 Kaju Kazan',    target:200, reward:80,  track:'earn' },
  { id:'spin1',   icon:'🎰', title:'Çarkı Çevir',       target:1,   reward:50,  track:'spin' },
];

function questKey(){ return 'hero_quests_' + new Date().toISOString().slice(0,10); }
function loadQuests(){
  try{
    const data = JSON.parse(localStorage.getItem(questKey()) || '{}');
    return data;
  }catch(e){ return {}; }
}
function saveQuests(data){ try{ localStorage.setItem(questKey(), JSON.stringify(data)); }catch(e){} }

// Görev ilerlet (oyunlar/çark çağırır)
export function progressQuest(track, amount){
  amount = amount || 1;
  const data = loadQuests();
  let changed = false;
  QUEST_DEFS.forEach(q => {
    if(q.track !== track) return;
    const cur = data[q.id] || { progress:0, claimed:false };
    if(cur.claimed) return;
    cur.progress = Math.min(q.target, (cur.progress||0) + amount);
    data[q.id] = cur;
    changed = true;
    // Tamamlandıysa bildir
    if(cur.progress >= q.target && !cur._notified){
      cur._notified = true;
      _toast(`✅ Görev tamam: ${q.title} · Ödülü al!`);
    }
  });
  if(changed) saveQuests(data);
}

export function openQuests(){
  injectEconomyCSS();
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google'){ _toast('🔑 Görevler için Google girişi gerekli'); return; }
  const ex = document.getElementById('questOv'); if(ex) ex.remove();
  const ov = document.createElement('div');
  ov.id = 'questOv'; ov.className = 'eco-ov';
  ov.innerHTML = `
    <div class="eco-box">
      <div class="eco-head">
        <span class="eco-title">📋 Günlük Görevler</span>
        <button class="eco-close" data-close>✕</button>
      </div>
      <div class="quest-sub">Her gün yenilenir · Tamamla, ödülü kap!</div>
      <div class="quest-list" id="questList"></div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-close]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });
  renderQuests();
}

function renderQuests(){
  const list = document.getElementById('questList'); if(!list) return;
  const data = loadQuests();
  list.innerHTML = QUEST_DEFS.map(q => {
    const cur = data[q.id] || { progress:0, claimed:false };
    const pct = Math.min(100, Math.round((cur.progress / q.target) * 100));
    const done = cur.progress >= q.target;
    const claimed = cur.claimed;
    return `<div class="quest-card ${claimed?'claimed':done?'done':''}">
      <div class="quest-ico">${q.icon}</div>
      <div class="quest-body">
        <div class="quest-title">${q.title}</div>
        <div class="quest-bar"><div class="quest-fill" style="width:${pct}%"></div></div>
        <div class="quest-prog">${Math.min(cur.progress,q.target)} / ${q.target}</div>
      </div>
      <div class="quest-reward">
        ${claimed
          ? '<span class="quest-claimed">✓ Alındı</span>'
          : done
            ? `<button class="quest-claim-btn" data-claim="${q.id}">+${q.reward}🥜</button>`
            : `<span class="quest-reward-val">+${q.reward}🥜</span>`}
      </div>
    </div>`;
  }).join('');
  // Ödül al butonları
  list.querySelectorAll('[data-claim]').forEach(b => b.addEventListener('click', async () => {
    const qid = b.dataset.claim;
    const q = QUEST_DEFS.find(x => x.id === qid); if(!q) return;
    const data = loadQuests();
    const cur = data[qid] || { progress:0, claimed:false };
    if(cur.claimed || cur.progress < q.target) return;
    cur.claimed = true; data[qid] = cur; saveQuests(data);
    await _S.addKaju(q.reward, 'quest');
    _toast(`🎉 +${q.reward} 🥜 görev ödülü!`);
    renderQuests();
  }));
}

// Tamamlanan ama alınmamış görev sayısı (rozet için)
export function pendingQuestCount(){
  const data = loadQuests();
  let n = 0;
  QUEST_DEFS.forEach(q => {
    const cur = data[q.id] || {};
    if((cur.progress||0) >= q.target && !cur.claimed) n++;
  });
  return n;
}

// ════════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════════
let cssInjected = false;
function injectEconomyCSS(){
  if(cssInjected) return; cssInjected = true;
  const st = document.createElement('style'); st.id = 'economyCSS';
  st.textContent = `
.eco-ov{ position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.6); backdrop-filter:blur(5px); padding:18px; animation:ecoFade .25s ease; }
@keyframes ecoFade{ from{opacity:0} to{opacity:1} }
.eco-box{ width:100%; max-width:380px; max-height:85vh; overflow-y:auto; background:linear-gradient(165deg,#18203a,#0c1322); border:1px solid rgba(255,215,64,.25); border-radius:22px; padding:18px; box-shadow:0 20px 60px rgba(0,0,0,.6); animation:ecoUp .35s cubic-bezier(.34,1.4,.64,1); }
@keyframes ecoUp{ from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
.eco-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.eco-title{ font-family:'Orbitron',sans-serif; font-size:16px; font-weight:900; color:#FFD740; }
.eco-close{ width:32px; height:32px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#9fb0d8; font-size:14px; cursor:pointer; }
.eco-empty{ text-align:center; padding:32px 16px; color:#7070a0; }
.eco-empty-icon{ font-size:38px; margin-bottom:10px; }
.eco-empty-sub{ font-size:10px; margin-top:6px; opacity:.7; }
/* Kaju geçmişi */
.kaju-summary{ display:flex; gap:8px; margin-bottom:14px; }
.kaju-sum-item{ flex:1; text-align:center; padding:10px 6px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:12px; }
.kaju-sum-val{ font-family:'Orbitron',sans-serif; font-size:14px; font-weight:900; color:#E0E0FF; }
.kaju-sum-item.earn .kaju-sum-val{ color:#69F0AE; }
.kaju-sum-item.spend .kaju-sum-val{ color:#FF5252; }
.kaju-sum-lbl{ font-size:7.5px; color:#7070a0; letter-spacing:1px; margin-top:3px; }
.kaju-filters{ display:flex; gap:6px; margin-bottom:12px; }
.kaju-filter{ flex:1; padding:8px; border-radius:10px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); color:#7070a0; font-size:11px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .15s; }
.kaju-filter.active{ background:rgba(0,229,255,.12); border-color:rgba(0,229,255,.3); color:#00E5FF; }
.kaju-hist-list{ display:flex; flex-direction:column; gap:6px; }
.kaju-row{ display:flex; align-items:center; gap:10px; padding:10px 12px; background:rgba(255,255,255,.02); border:1px solid rgba(255,255,255,.05); border-radius:11px; }
.kaju-row-ico{ font-size:18px; flex-shrink:0; }
.kaju-row-info{ flex:1; min-width:0; }
.kaju-row-reason{ font-size:11px; font-weight:700; color:#E0E0FF; }
.kaju-row-time{ font-size:8.5px; color:#7070a0; margin-top:1px; }
.kaju-row-amt{ font-size:12px; font-weight:900; flex-shrink:0; }
.kaju-row-amt.earn{ color:#69F0AE; }
.kaju-row-amt.spend{ color:#FF5252; }
/* Çark */
.wheel-box{ text-align:center; position:relative; overflow:hidden; }
.wheel-box::before{ content:''; position:absolute; top:-40px; left:50%; transform:translateX(-50%); width:240px; height:240px; background:radial-gradient(circle,rgba(255,215,64,.18),transparent 65%); filter:blur(20px); pointer-events:none; }
.wheel-sub{ font-size:11px; color:#9fb0d8; margin-bottom:14px; position:relative; }
.wheel-wrap{ position:relative; display:inline-block; margin-bottom:18px; }
.wheel-pointer{ position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:30px; color:#FFD740; z-index:5; filter:drop-shadow(0 3px 6px rgba(0,0,0,.6)); animation:wheelPointerBob 1.2s ease-in-out infinite; }
@keyframes wheelPointerBob{ 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(3px)} }
.wheel-svg{ display:block; filter:drop-shadow(0 8px 30px rgba(255,215,64,.25)) drop-shadow(0 4px 12px rgba(0,0,0,.5)); }
.wheel-glow-ring{ position:absolute; inset:0; border-radius:50%; box-shadow:0 0 30px rgba(255,215,64,.3),inset 0 0 20px rgba(255,215,64,.15); pointer-events:none; animation:wheelRingPulse 2s ease-in-out infinite; }
@keyframes wheelRingPulse{ 0%,100%{opacity:.5} 50%{opacity:1} }
.wheel-spin-btn{ width:100%; padding:16px; border-radius:16px; background:linear-gradient(135deg,#FFD740,#FFA726,#FF7043); background-size:200% 100%; border:none; color:#1a1020; font-size:17px; font-weight:900; font-family:inherit; cursor:pointer; letter-spacing:1px; transition:transform .15s; box-shadow:0 6px 20px rgba(255,167,38,.4); position:relative; animation:wheelBtnShine 3s linear infinite; }
@keyframes wheelBtnShine{ 0%{background-position:0% 0} 100%{background-position:200% 0} }
.wheel-spin-btn:active:not(:disabled){ transform:scale(.96); }
.wheel-spin-btn:disabled{ opacity:.5; cursor:not-allowed; background:rgba(255,255,255,.1); color:#9fb0d8; animation:none; box-shadow:none; }
.wheel-prizes{ display:flex; justify-content:center; gap:6px; margin-bottom:14px; flex-wrap:wrap; position:relative; }
.wheel-prize-chip{ font-size:9px; font-weight:700; padding:3px 9px; border-radius:10px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); color:#cbb98a; }
/* Görevler */
.quest-sub{ font-size:11px; color:#9fb0d8; margin-bottom:14px; }
.quest-list{ display:flex; flex-direction:column; gap:9px; }
.quest-card{ display:flex; align-items:center; gap:11px; padding:12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; transition:all .2s; }
.quest-card.done{ border-color:rgba(255,215,64,.4); background:rgba(255,215,64,.05); }
.quest-card.claimed{ opacity:.5; }
.quest-ico{ font-size:24px; flex-shrink:0; }
.quest-body{ flex:1; min-width:0; }
.quest-title{ font-size:12px; font-weight:800; color:#E0E0FF; margin-bottom:5px; }
.quest-bar{ height:6px; background:rgba(255,255,255,.08); border-radius:6px; overflow:hidden; }
.quest-fill{ height:100%; background:linear-gradient(90deg,#FFD740,#FFA726); border-radius:6px; transition:width .5s ease; }
.quest-prog{ font-size:8.5px; color:#7070a0; margin-top:3px; }
.quest-reward{ flex-shrink:0; }
.quest-reward-val{ font-size:11px; font-weight:800; color:#9a8a5a; }
.quest-claim-btn{ padding:8px 12px; border-radius:10px; background:linear-gradient(135deg,#FFD740,#FFA726); border:none; color:#1a1020; font-size:11px; font-weight:900; cursor:pointer; font-family:inherit; animation:questPulse 1.5s ease-in-out infinite; }
@keyframes questPulse{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
.quest-claimed{ font-size:10px; font-weight:700; color:#69F0AE; }
  `;
  document.head.appendChild(st);
}
