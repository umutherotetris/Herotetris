// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — EVRENSEL OYUN İÇİ HUD
//  Her oyuna enjekte edilebilir, tıklanabilir oyuncu kartları,
//  canlı skor/XP/level, portal nick & avatar entegrasyonu.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import * as Store from './store.js';

// ── CSS (bir kez enjekte) ──────────────────────────────────────
let cssInjected = false;
function injectHudCSS(){
  if(cssInjected) return; cssInjected = true;
  const st = document.createElement('style'); st.id='heroHudCSS';
  st.textContent=`
.ghud{ position:relative; display:flex; align-items:stretch; justify-content:space-between; gap:10px; padding:8px 10px; background:linear-gradient(160deg,rgba(10,12,28,.95),rgba(4,5,14,.98)); border-bottom:1px solid rgba(0,229,255,.12); z-index:10; }
.ghud-player{ flex:1; min-width:0; display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:13px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); cursor:pointer; transition:background .15s,border-color .15s; position:relative; overflow:hidden; }
.ghud-player:hover{ background:rgba(0,229,255,.07); border-color:rgba(0,229,255,.25); }
.ghud-player.mine{ border-color:rgba(var(--ghud-accent-rgb,0,229,255),.22); }
.ghud-player.mine::before{ content:''; position:absolute; top:0; left:0; right:0; height:1.5px; background:linear-gradient(90deg,transparent,var(--ghud-accent,#00E5FF),transparent); }
.ghud-ava{ position:relative; width:36px; height:36px; border-radius:10px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
.ghud-online{ position:absolute; bottom:-1px; right:-1px; width:9px; height:9px; border-radius:50%; background:#69F0AE; border:1.5px solid #0a0c1c; }
.ghud-info{ flex:1; min-width:0; }
.ghud-nick{ font-family:'Orbitron','Chakra Petch',sans-serif; font-size:11px; font-weight:800; color:#eef2ff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ghud-nick.admin-nick-glow{ font-size:10px; }
.ghud-meta{ display:flex; align-items:center; gap:5px; margin-top:3px; }
.ghud-lv{ font-size:8.5px; font-weight:800; background:rgba(192,132,252,.15); color:#c084fc; padding:1px 6px; border-radius:6px; }
.ghud-score{ font-family:'Orbitron',sans-serif; font-size:11px; font-weight:700; color:var(--ghud-accent,#00E5FF); margin-left:auto; text-align:right; flex-shrink:0; }
.ghud-score-lbl{ font-size:7px; color:#7070A0; letter-spacing:1px; margin-bottom:1px; }
.ghud-score-val{ font-size:14px; }
.ghud-xp-track{ height:3px; background:rgba(255,255,255,.06); border-radius:3px; margin-top:3px; overflow:hidden; }
.ghud-xp-fill{ height:100%; background:linear-gradient(90deg,#7c3aed,#c084fc); border-radius:3px; transition:width .6s ease; }
.ghud-vs{ flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:0 4px; }
.ghud-vs-ico{ font-size:16px; filter:drop-shadow(0 0 6px rgba(255,215,64,.5)); }
.ghud-vs-txt{ font-family:'Orbitron',sans-serif; font-size:7px; color:#FFD740; letter-spacing:1px; font-weight:800; }
/* Solo HUD (tek oyuncu) */
.ghud-solo{ display:flex; align-items:center; gap:10px; padding:8px 12px; background:linear-gradient(160deg,rgba(10,12,28,.95),rgba(4,5,14,.98)); border-bottom:1px solid rgba(0,229,255,.1); }
.ghud-solo-info{ flex:1; display:flex; align-items:center; gap:8px; cursor:pointer; padding:6px 10px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(0,229,255,.15); transition:background .15s; }
.ghud-solo-info:hover{ background:rgba(0,229,255,.08); }
.ghud-stats{ display:flex; gap:8px; flex-shrink:0; }
.ghud-stat{ text-align:center; padding:4px 10px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:10px; }
.ghud-stat-v{ font-family:'Orbitron',sans-serif; font-size:12px; font-weight:800; color:var(--ghud-accent,#00E5FF); }
.ghud-stat-l{ font-size:7px; color:#7070A0; letter-spacing:1px; margin-top:1px; }
  `;
  document.head.appendChild(st);
}

// ── Yardımcı: portal nickini al ──────────────────────────────
export function getPortalNick(st){
  if(!st){ try{ st=Auth.getState(); }catch(e){ st=(window.Hero&&window.Hero.Auth&&window.Hero.Auth.getState())||{}; } }
  return (st.profile&&st.profile.nick) || st.displayName || 'Oyuncu';
}
export function getPortalAvatar(st){
  if(!st){ try{ st=Auth.getState(); }catch(e){ st=(window.Hero&&window.Hero.Auth&&window.Hero.Auth.getState())||{}; } }
  return (st.profile&&st.profile.avatar) || '👤';
}

// ── Rakip verisini Firebase'den çek ───────────────────────────
async function fetchOpponent(uid){
  if(!uid) return null;
  try{
    const [uSnap, pSnap] = await Promise.all([
      fdb.get(fdb.ref(db,'users/'+uid)),
      fdb.get(fdb.ref(db,'presence/'+uid)),
    ]);
    const u = uSnap.exists() ? uSnap.val() : {};
    const p = pSnap.exists() ? pSnap.val() : {};
    return {
      uid,
      nick: u.nick || u.name || u.displayName || 'Rakip',
      avatar: u.avatar || '👤',
      level: u.level || 1,
      xp: (u.xp && u.xp.xp) || u.xp || 0,
      kaju: u.kaju || 0,
      isAdmin: u.isAdmin === true,
      online: p.online === true && (Date.now()-(p.lastSeen||0)) < 180000,
    };
  }catch(e){ return null; }
}

// ── XP yüzdesini hesapla ──────────────────────────────────────
function xpPct(xp, lv){ return Math.min(100, Math.round(xp / (300+lv*200)*100)); }

// ── Oyuncu satırı HTML üret ───────────────────────────────────
function playerRowHTML(info, isMine, accentCss, score){
  const pct = xpPct(info.xp, info.level);
  const isAdm = info.isAdmin;
  const nickHtml = isAdm
    ? '<span class="admin-crown">👑</span><span class="admin-nick-glow">'+esc(info.nick)+'</span>'
    : esc(info.nick);
  return `
  <div class="ghud-player${isMine?' mine':''}" style="--ghud-accent:${accentCss}" data-huduid="${esc(info.uid||'')}">
    <div class="ghud-ava">${info.avatar}${info.online?'<div class="ghud-online"></div>':''}</div>
    <div class="ghud-info">
      <div class="ghud-nick">${nickHtml}</div>
      <div class="ghud-meta">
        <span class="ghud-lv">LV.${info.level}</span>
        <div class="ghud-xp-track" style="flex:1"><div class="ghud-xp-fill" style="width:${pct}%"></div></div>
      </div>
    </div>
    <div class="ghud-score">
      <div class="ghud-score-lbl">SKOR</div>
      <div class="ghud-score-val" data-hud-score="${esc(info.uid||'me')}">${(score||0).toLocaleString('tr-TR')}</div>
    </div>
  </div>`;
}

function esc(t){ return String(t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ══════════════════════════════════════════════════════════════
// createVsHUD — İki oyunculu oyunlar için (çevrimiçi + local)
// opts: { root, myScore:()=>number, oppScore:()=>number,
//         oppUid, oppNick, oppAvatar, oppLevel, oppXP,
//         myAccent, oppAccent, game }
// ══════════════════════════════════════════════════════════════
export async function createVsHUD(opts={}){
  injectHudCSS();
  const st = Auth.getState();
  const me = {
    uid: st.uid || '',
    nick: getPortalNick(st),
    avatar: getPortalAvatar(st),
    level: Store.getState().level || 1,
    xp: Store.getState().xp || 0,
    isAdmin: st.isAdmin === true,
    online: true,
  };

  // Rakip bilgisi: UID varsa Firebase'den çek, yoksa gelen bilgiyi kullan
  let opp = {
    uid: opts.oppUid || '',
    nick: opts.oppNick || 'Rakip',
    avatar: opts.oppAvatar || '🤖',
    level: opts.oppLevel || 1,
    xp: opts.oppXP || 0,
    isAdmin: false,
    online: true,
  };
  if(opts.oppUid){
    const fetched = await fetchOpponent(opts.oppUid);
    if(fetched) opp = fetched;
  }

  const myAcc  = opts.myAccent  || '#00E5FF';
  const oppAcc = opts.oppAccent || '#FF4081';

  const wrap = document.createElement('div');
  wrap.className = 'ghud';
  wrap.id = 'heroGameHud';
  wrap.innerHTML =
    playerRowHTML(me,  true,  myAcc,  opts.myScore  ? opts.myScore()  : 0)
    + `<div class="ghud-vs"><div class="ghud-vs-ico">⚔️</div><div class="ghud-vs-txt">VS</div></div>`
    + playerRowHTML(opp, false, oppAcc, opts.oppScore ? opts.oppScore() : 0);

  // Enjekte et
  const root = opts.root;
  if(root) root.insertBefore(wrap, root.firstChild);

  // Tıklanabilir profil kartları
  wrap.querySelectorAll('[data-huduid]').forEach(el=>{
    el.addEventListener('click', async()=>{
      const uid = el.dataset.huduid;
      if(!uid) return;
      try{ const m=await import('./social.js'); m.openPlayerCard(uid); }catch(e){}
    });
  });

  // Canlı skor güncelleyici (her 500ms)
  let hudRaf = null;
  function tick(){
    if(!wrap.isConnected){ hudRaf=null; return; }
    if(opts.myScore){
      const el=wrap.querySelector('[data-hud-score="'+me.uid+'"]');
      if(el) el.textContent=(opts.myScore()||0).toLocaleString('tr-TR');
    }
    if(opts.oppScore){
      const el=wrap.querySelector('[data-hud-score="'+(opp.uid||'me')+'"]');
      if(el) el.textContent=(opts.oppScore()||0).toLocaleString('tr-TR');
    }
    // XP çubuğunu da güncelle (store'dan canlı)
    const myXpFill=wrap.querySelector('.ghud-player.mine .ghud-xp-fill');
    if(myXpFill){
      const p=Store.getState(); const pct=xpPct(p.xp||0,p.level||1);
      myXpFill.style.width=pct+'%';
    }
    hudRaf = setTimeout(tick,500);
  }
  tick();

  return {
    el: wrap,
    destroy(){ wrap.remove(); if(hudRaf) clearTimeout(hudRaf); },
    updateOppScore(s){ const el=wrap.querySelector('[data-hud-score="'+(opp.uid||'me')+'"]'); if(el) el.textContent=(s||0).toLocaleString('tr-TR'); },
    updateOppInfo(info){ /* genişletilebilir */ },
  };
}

// ══════════════════════════════════════════════════════════════
// createSoloHUD — Tek oyuncu oyunlar için
// opts: { root, score:()=>number, lines:()=>number,
//         level:()=>number, game, accentColor }
// ══════════════════════════════════════════════════════════════
export function createSoloHUD(opts={}){
  injectHudCSS();
  const st = Auth.getState();
  let _sp={level:1,xp:0}; try{ _sp=Store.getState(); }catch(e){ _sp=(window.Hero&&window.Hero.Store&&window.Hero.Store.getState())||{level:1,xp:0}; }
  const me = {
    nick: getPortalNick(st),
    avatar: getPortalAvatar(st),
    uid: st.uid || '',
    level: _sp.level || 1,
    xp: _sp.xp || 0,
    isAdmin: st.isAdmin === true,
  };
  const acc = opts.accentColor || '#00E5FF';
  const pct = xpPct(me.xp, me.level);
  const isAdm = me.isAdmin;
  const nickHtml = isAdm
    ? '<span class="admin-crown">👑</span><span class="admin-nick-glow">'+esc(me.nick)+'</span>'
    : esc(me.nick);

  const wrap = document.createElement('div');
  wrap.className = 'ghud-solo';
  wrap.id = 'heroGameHud';
  wrap.style.setProperty('--ghud-accent', acc);
  wrap.innerHTML = `
    <div class="ghud-solo-info" data-huduid="${esc(me.uid)}">
      <div class="ghud-ava">${me.avatar}</div>
      <div class="ghud-info">
        <div class="ghud-nick">${nickHtml}</div>
        <div class="ghud-meta">
          <span class="ghud-lv">LV.${me.level}</span>
          <div class="ghud-xp-track" style="flex:1"><div class="ghud-xp-fill" id="hudSoloXp" style="width:${pct}%"></div></div>
        </div>
      </div>
    </div>
    <div class="ghud-stats">
      ${opts.score!==undefined?`<div class="ghud-stat"><div class="ghud-stat-v" id="hudSoloScore">0</div><div class="ghud-stat-l">SKOR</div></div>`:''}
      ${opts.lines!==undefined?`<div class="ghud-stat"><div class="ghud-stat-v" id="hudSoloLines">0</div><div class="ghud-stat-l">SATIR</div></div>`:''}
      ${opts.level!==undefined?`<div class="ghud-stat"><div class="ghud-stat-v" id="hudSoloLevel">1</div><div class="ghud-stat-l">SEVİYE</div></div>`:''}
    </div>`;

  const root = opts.root;
  if(root) root.insertBefore(wrap, root.firstChild);

  // Profil kartı tıklama
  wrap.querySelector('[data-huduid]').addEventListener('click', async()=>{
    if(!me.uid) return;
    try{ const m=await import('./social.js'); m.openPlayerCard(me.uid); }catch(e){}
  });

  // Canlı güncelleme
  let hudTimer=null;
  function tick(){
    if(!wrap.isConnected){ hudTimer=null; return; }
    if(opts.score){ const el=document.getElementById('hudSoloScore'); if(el) el.textContent=(opts.score()||0).toLocaleString('tr-TR'); }
    if(opts.lines){ const el=document.getElementById('hudSoloLines'); if(el) el.textContent=(opts.lines()||0).toLocaleString('tr-TR'); }
    if(opts.level){ const el=document.getElementById('hudSoloLevel'); if(el) el.textContent=opts.level()||1; }
    const xpFill=document.getElementById('hudSoloXp');
    if(xpFill){ const p=Store.getState(); xpFill.style.width=xpPct(p.xp||0,p.level||1)+'%'; }
    hudTimer=setTimeout(tick,500);
  }
  tick();

  return {
    el: wrap,
    destroy(){ wrap.remove(); if(hudTimer) clearTimeout(hudTimer); },
  };
}

// ── Portal nick'ini oyuna kaydet (tüm oyunlar çağırmalı) ───────
export function applyPortalNick(){
  const st = Auth.getState();
  return {
    nick: getPortalNick(st),
    avatar: getPortalAvatar(st),
    uid: st.uid || '',
    level: Store.getState().level || 1,
    isAdmin: st.isAdmin === true,
  };
}
