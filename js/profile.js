// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — EKRANLAR: 👤 Profil + ⚙️ Ayarlar + 🏆 Liderlik
//  + Arkadaş/Bildirim köprüleri (Sosyal Hub'a açılır)
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import Store from './store.js';
// ui.js modalları: önce normal kopya, export eksikse (eski önbellek) taze sürümlü kopya
async function uiMod(){
  try{ const m = await import('./ui.js'); if(m.openKajuModal && m.openNickModal) return m; }catch(e){}
  return import('./ui.js?v=93');
}

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function defaultAvatar(uid){ if(!uid) return '⭐'; let h=0; for(let i=0;i<uid.length;i++) h=((h<<5)-h)+uid.charCodeAt(i); const A=['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈']; return A[Math.abs(h)%A.length]; }
const fmt = (n) => { const v = Number(n); return (Number.isFinite(v) ? v : 0).toLocaleString('tr-TR'); };
const byId = (id) => document.getElementById(id);

export function initScreens(){
  if(typeof window!=='undefined'){ if(window.__heroScreensInit) return; window.__heroScreensInit = true; }
  Auth.subscribe(renderProfile);
  Store.subscribe(renderProfile);
  renderBridges();
  // Liderlik: sekmeye her geçişte taze çek
  document.querySelectorAll('[data-nav="leaderboard"]').forEach(el => el.addEventListener('click', () => setTimeout(renderLeaderboard, 50)));
  renderLeaderboard();
}

// ── 👤 PROFİL ───────────────────────────────────────────────────
let _profT = null;
function renderProfile(){
  clearTimeout(_profT);
  _profT = setTimeout(_renderProfile, 60);   // auth+store ardışık emit'lerini tekille
}
async function _renderProfile(){
  const box = byId('scrProfile'); if(!box) return;
  const st = Auth.getState();
  const pl = Store.getState ? Store.getState() : {};
  const isGoogle = st.status === 'google';
  const nick = st.displayName || 'Misafir Oyuncu';
  const lvl = Math.max(1, Number(pl.level)||1);
  // pl.xp Firebase'de obje olabilir: { level, xp, totalXP }
  const _xpObj = pl.xp;
  const _xpRaw = (_xpObj && typeof _xpObj === 'object') ? Number(_xpObj.xp ?? 0) : Number(_xpObj ?? 0);
  const xp = Number.isFinite(_xpRaw) ? _xpRaw : 0;
  const _txRaw = (_xpObj && typeof _xpObj === 'object') ? Number(_xpObj.totalXP ?? 0) : Number(pl.totalXP ?? xp);
  const totalXPv = Number.isFinite(_txRaw) ? _txRaw : xp;
  const need = Math.max(1, (Store.xpForLevel ? Store.xpForLevel(lvl) : 300+lvl*200)||100);
  const _raw = xp / need * 100;
  const pct = Number.isFinite(_raw) ? Math.max(0, Math.min(100, Math.round(_raw))) : 0;
  box.innerHTML = `
    <div class="prf-card">
      <div class="prf-top">
        <div class="prf-ava" data-p="avatar" title="Avatar değiştir" style="cursor:pointer;border:3px solid ${esc((st.profile&&st.profile.frame)||'transparent')}">${esc((st.profile && st.profile.avatar) || defaultAvatar(st.uid))}<span class="prf-ava-edit">✏️</span></div>
        <div class="prf-id">
          <div class="prf-name"><span data-el="prfNick">${esc(nick)}</span> ${isGoogle ? '<button class="prf-mini" data-p="nick">✏️</button>' : ''}</div>
          <div class="prf-badges" data-el="prfBadges"></div>
          <div class="prf-sub">${isGoogle ? (st.isAdmin ? '👑 ADMİN · ' : '') + 'UID: ' + esc((st.uid||'').slice(0,10)) + '…' : 'Misafir hesabı — kaydetmek için bağlan'}</div>
        </div>
      </div>
      <div class="prf-stats">
        <div class="prf-stat"><b>💰 ${fmt(pl.kaju)}</b><span>KAJU</span></div>
        <div class="prf-stat"><b>⭐ ${lvl}</b><span>SEVİYE</span></div>
        <div class="prf-stat"><b>✨ ${fmt(totalXPv)}</b><span>TOPLAM XP</span></div>
      </div>
      <div class="prf-xpbar"><div class="prf-xpfill" style="width:${pct}%"></div><span>LV ${lvl} → ${lvl+1} · %${pct}</span></div>
      <div class="prf-acts-grid">
        ${isGoogle
          ? '<button class="prf-act-btn prf-act-primary" data-p="kaju">💸 Kaju Gönder</button>'
          : '<button class="prf-act-btn prf-act-primary" data-p="login">🔗 Hesabı Bağla</button>'}
        ${isGoogle ? '<button class="prf-act-btn" data-p="mycard">🪪 Kartım</button>' : ''}
        ${isGoogle ? '<button class="prf-act-btn" data-p="clan">🏰 Klan</button>' : ''}
        <button class="prf-act-btn" data-p="season">👑 Sezon</button>
        ${isGoogle ? '<button class="prf-act-btn" data-p="frame">🖼️ Çerçeve & Tema</button>' : ''}
        <button class="prf-act-btn" data-p="settings">⚙️ Ayarlar</button>
      </div>
    </div>
    <div class="prf-card" id="prfRecords"><div class="prf-lbl">🏆 REKORLARIN</div><div class="prf-recbody">Yükleniyor…</div></div>
    <div class="prf-card" id="prfTrophies"><div class="prf-lbl">🏅 KUPA VİTRİNİ</div><div class="prf-trbody">Yükleniyor…</div></div>`;
  box.querySelector('[data-p="settings"]').addEventListener('click', openSettings);
  const av = box.querySelector('[data-p="avatar"]'); if(av && isGoogle) av.addEventListener('click', openAvatarPicker);
  const nb = box.querySelector('[data-p="nick"]'); if(nb) nb.addEventListener('click', async () => (await uiMod()).openNickModal());
  const kb = box.querySelector('[data-p="kaju"]'); if(kb) kb.addEventListener('click', async () => (await uiMod()).openKajuModal());
  const lb = box.querySelector('[data-p="login"]'); if(lb) lb.addEventListener('click', () => Auth.loginGoogle && Auth.loginGoogle());
  const mc = box.querySelector('[data-p="mycard"]'); if(mc) mc.addEventListener('click', async () => { try{ const m = await import('./social.js'); m.openPlayerCard(st.uid); }catch(e){} });
  const cb = box.querySelector('[data-p="clan"]'); if(cb) cb.addEventListener('click', async () => { try{ const m = await import('./clan.js'); m.default(); }catch(e){ alert('Klan yüklenemedi: '+e.message); } });

// ── 🖼️ Çerçeve + Arka Plan Seçici ─────────────────────────────
const FRAMES = [{"id": "none", "label": "\u00c7er\u00e7eve Yok", "color": "transparent"}, {"id": "gold", "label": "\ud83d\udc51 Alt\u0131n", "color": "#FFD740"}, {"id": "cyan", "label": "\ud83d\udc8e Mavi", "color": "#00E5FF"}, {"id": "fire", "label": "\ud83d\udd25 Ate\u015f", "color": "#FF5722"}, {"id": "green", "label": "\ud83c\udf3f Ye\u015fil", "color": "#69F0AE"}, {"id": "purple", "label": "\ud83d\udc9c Mor", "color": "#CE93D8"}, {"id": "silver", "label": "\ud83e\udd48 G\u00fcm\u00fc\u015f", "color": "#B0BEC5"}];
const BG_THEMES = [{"id": "default", "label": "\ud83c\udf0c Varsay\u0131lan", "bg": ""}, {"id": "space", "label": "\ud83d\ude80 Uzay", "bg": "radial-gradient(ellipse at top,#1a1040 0%,#0a0a1e 100%)"}, {"id": "ocean", "label": "\ud83c\udf0a Okyanus", "bg": "linear-gradient(160deg,#0d1b4b 0%,#0a3060 50%,#062040 100%)"}, {"id": "forest", "label": "\ud83c\udf32 Orman", "bg": "linear-gradient(160deg,#0d2b1a 0%,#1a3a20 50%,#0a1e12 100%)"}, {"id": "sunset", "label": "\ud83c\udf05 G\u00fcn Bat\u0131m\u0131", "bg": "linear-gradient(160deg,#3a0a20 0%,#6b1a2a 40%,#2a0a40 100%)"}, {"id": "ice", "label": "\u2744\ufe0f Buz", "bg": "linear-gradient(160deg,#0d2040 0%,#1a3060 50%,#0a1830 100%)"}];
async function openFramePicker(){
  if(byId('framePicker')) return;
  const st = Auth.getState(); if(!st.uid || st.status!=='google'){ alert('Çerçeve/tema için giriş gerekli'); return; }
  const cur = (st.profile&&st.profile.frame)||'none';
  const curBg = (st.profile&&st.profile.profileBg)||'default';
  const ov = document.createElement('div'); ov.id='framePicker'; ov.className='nick-modal-ov';
  ov.innerHTML = '<div class="nick-modal"><div class="nm-title">🖼️ Çerçeve \u0026 Tema</div>' +
    '<div class="prf-lbl" style="margin-top:8px">AVATAR ÇERÇEVESİ</div>' +
    '<div class="ava-grid" style="grid-template-columns:repeat(4,1fr)">' +
    FRAMES.map(f=>'<button class="ava-opt frame-opt'+(f.id===cur?' on':'')
      +'" data-fid="'+f.id+'" title="'+f.label+'" style="font-size:10px;font-weight:800;padding:7px 2px">'+f.label+'</button>').join('') + '</div>' +
    '<div class="prf-lbl" style="margin-top:10px">PROFİL ARKA PLANI</div>' +
    '<div class="ava-grid" style="grid-template-columns:repeat(3,1fr)">' +
    BG_THEMES.map(b=>'<button class="ava-opt frame-opt'+(b.id===curBg?' on':'')
      +'" data-bid="'+b.id+'" style="font-size:10px;font-weight:700;padding:8px 2px;'+(b.bg?'background:'+b.bg+';':'')+'">'+b.label+'</button>').join('') + '</div>' +
    '<div class="nm-actions"><button class="nm-btn nm-cancel" data-fp-close>Kapat</button></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('[data-fp-close]').addEventListener('click', ()=>ov.remove());
  ov.querySelectorAll('[data-fid]').forEach(btn=>btn.addEventListener('click', async()=>{
    try{
      await fdb.update(fdb.ref(db, 'users/'+st.uid), {frame: btn.dataset.fid});
      if(st.profile) st.profile.frame = btn.dataset.fid;
      ov.querySelectorAll('[data-fid]').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
      _renderProfile();
    }catch(e){ alert('Kaydedilemedi'); }
  }));
  ov.querySelectorAll('[data-bid]').forEach(btn=>btn.addEventListener('click', async()=>{
    try{
      await fdb.update(fdb.ref(db, 'users/'+st.uid), {profileBg: btn.dataset.bid});
      if(st.profile) st.profile.profileBg = btn.dataset.bid;
      ov.querySelectorAll('[data-bid]').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
      applyProfileBg(btn.dataset.bid);
    }catch(e){ alert('Kaydedilemedi'); }
  }));
}
function applyProfileBg(id){
  const theme = BG_THEMES.find(b=>b.id===id);
  const scr = document.querySelector('[data-screen="profile"]');
  if(scr) scr.style.background = theme && theme.bg ? theme.bg : '';
}

  const fb2 = box.querySelector('[data-p="frame"]'); if(fb2) fb2.addEventListener('click', openFramePicker);
  const sb = box.querySelector('[data-p="season"]'); if(sb) sb.addEventListener('click', async () => { try{ const m = await import('./season.js'); m.openSeason(); }catch(e){ alert('Sezon yüklenemedi: '+e.message); } });
  renderBadgesAndRank(st);
  applyProfileBg((st.profile&&st.profile.profileBg)||'default');
  renderRecords(st);
  renderTrophies(st);
}

// ── 🏅 Kupa vitrini: mevcut verilerden türetilen başarımlar ─────
async function renderTrophies(st){
  const body = document.querySelector('#prfTrophies .prf-trbody'); if(!body) return;
  if(!st.uid){ body.innerHTML = '<i>Giriş yapınca kupaların burada görünür</i>'; return; }
  let p = st.profile || {};
  try{ const s = await fdb.get(fdb.ref(db, 'users/' + st.uid)); if(s.exists()) p = s.val(); }catch(e){}
  let frCount = 0;
  try{ const s = await fdb.get(fdb.ref(db, 'friends/' + st.uid)); if(s.exists()) frCount = Object.keys(s.val()).length; }catch(e){}
  const lvl = p.level || 1, kaju = p.kaju || 0;
  const best = p.bestScores || {}, kr = p.kelimeRecords || {};
  const T = [
    { icon:'👣', name:'İlk Adım',      desc:'Seviye 2 ol',            ok: lvl >= 2 },
    { icon:'🚀', name:'Yükselen',      desc:'Seviye 5 ol',            ok: lvl >= 5 },
    { icon:'🌟', name:'Usta',          desc:'Seviye 10 ol',           ok: lvl >= 10 },
    { icon:'💰', name:'Birikimci',     desc:'10.000 Kaju',            ok: kaju >= 10000 },
    { icon:'🤑', name:'Zengin',        desc:'100.000 Kaju',           ok: kaju >= 100000 },
    { icon:'💎', name:'Milyoner',      desc:'1.000.000 Kaju',         ok: kaju >= 1000000 },
    { icon:'👥', name:'Sosyal',        desc:'3 arkadaş edin',         ok: frCount >= 3 },
    { icon:'🦋', name:'Popüler',       desc:'10 arkadaş edin',        ok: frCount >= 10 },
    { icon:'🎭', name:'Karakterli',    desc:'Avatar seç',             ok: !!p.avatar },
    { icon:'🧱', name:'Tetrisçi',      desc:'Tetris rekoru kır',      ok: !!best.tetris },
    { icon:'♟️', name:'Stratejist',    desc:'Satranç rekoru kır',     ok: !!best.chess },
    { icon:'🎲', name:'Tavlacı',       desc:'Tavla rekoru kır',       ok: !!best.tavla },
    { icon:'🔤', name:'Kelime Kurdu',  desc:'30+ puanlık kelime',     ok: !!(kr.best && kr.best.score >= 30) },
  ];
  const got = T.filter(t => t.ok).length;
  body.innerHTML = `<div class="tr-count">${got}/${T.length} kupa</div><div class="tr-grid">` + T.map(t => `
    <div class="tr-item${t.ok ? ' on' : ''}" title="${t.desc}">
      <div class="tr-ico">${t.ok ? t.icon : '🔒'}</div>
      <div class="tr-name">${t.name}</div>
    </div>`).join('') + '</div>';
}
async function renderBadgesAndRank(st){
  const box = byId('scrProfile'); if(!box || !st.uid) return;
  const bEl = box.querySelector('[data-el="prfBadges"]'); if(!bEl) return;
  const badges = [];
  if(st.isAdmin === true){
    badges.push('<span class="chat-admin-badge">👑 ADMİN</span>');
    // admin nick ışıltısı (sohbettekiyle aynı stil)
    try{ const m = await import('./social.js'); const n = box.querySelector('[data-el="prfNick"]'); if(n){ n.classList.add(m.glowClass()); n.style.color = '#FFD740'; } }catch(e){}
  }
  if(st.profile && st.profile.isVice) badges.push('<span class="chat-op-badge" style="color:#FFD740;border-color:rgba(255,215,64,.3);background:rgba(255,215,64,.1)">⭐ VICE</span>');
  try{ const o = await fdb.get(fdb.ref(db, 'gcOperators/' + st.uid)); if(o.exists() && o.val() === true) badges.push('<span class="chat-op-badge">🔧 OP</span>'); }catch(e){}
  // Kaju liderlik sırası (top 100 içinde)
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'leaderboard/kaju'), fdb.orderByChild('kaju'), fdb.limitToLast(100)));
    if(snap.exists()){
      const rows = []; snap.forEach(ch => { rows.push({ uid: ch.key, kaju: (ch.val()||{}).kaju || 0 }); });
      rows.sort((a,b) => b.kaju - a.kaju);
      const i = rows.findIndex(r => r.uid === st.uid);
      if(i >= 0) badges.push(`<span class="prf-rank">🏆 Liderlik #${i+1}</span>`);
    }
  }catch(e){}
  bEl.innerHTML = badges.join(' ');
}

async function renderRecords(st){
  const body = document.querySelector('#prfRecords .prf-recbody'); if(!body) return;
  if(!st.uid){ body.innerHTML = '<i>Giriş yapınca rekorların burada görünür</i>'; return; }
  let p = st.profile || {};
  try{ const s = await fdb.get(fdb.ref(db, 'users/' + st.uid)); if(s.exists()) p = s.val(); }catch(e){}
  const best = p.bestScores || {};
  const kr = p.kelimeRecords || {};
  const rows = [];
  const names = { tetris:'🧱 Tetris', chess:'♟️ Satranç', tavla:'🎲 Tavla', kelime:'🔤 Kelimecik' };
  for(const g of Object.keys(names)){ if(best[g]) rows.push(`<div class="prf-rec"><span>${names[g]}</span><b>${fmt(best[g])}</b></div>`); }
  if(kr.best && kr.best.text) rows.push(`<div class="prf-rec"><span>🔤 En değerli kelime</span><b>${esc(kr.best.text)} (${kr.best.score})</b></div>`);
  if(kr.longest && kr.longest.text) rows.push(`<div class="prf-rec"><span>🔤 En uzun kelime</span><b>${esc(kr.longest.text)}</b></div>`);
  body.innerHTML = rows.length ? rows.join('') : '<i>Henüz rekor yok — oynamaya başla! 🎮</i>';
}

// ── 🎭 AVATAR SEÇİCİ ────────────────────────────────────────────
async function openAvatarPicker(){
  if(byId('avaModal')) return;
  let AV = ['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈'];
  try{ const m = await import('./social.js'); if(m.AVATARS) AV = m.AVATARS; }catch(e){}
  const st = Auth.getState();
  const cur = (st.profile && st.profile.avatar) || defaultAvatar(st.uid);
  const ov = document.createElement('div');
  ov.id = 'avaModal'; ov.className = 'nick-modal-ov';
  ov.innerHTML = `
    <div class="nick-modal">
      <div class="nm-title">🎭 Avatarını Seç</div>
      <div class="ava-grid">${AV.map(a => `<button class="ava-opt${a===cur?' on':''}" data-av="${a}">${a}</button>`).join('')}</div>
      <div class="nm-actions"><button class="nm-btn nm-cancel" data-av-close>Kapat</button></div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  ov.querySelector('[data-av-close]').addEventListener('click', () => ov.remove());
  ov.querySelectorAll('.ava-opt').forEach(btn => btn.addEventListener('click', async () => {
    try{
      await fdb.update(fdb.ref(db, 'users/' + st.uid), { avatar: btn.dataset.av });
      if(st.profile) st.profile.avatar = btn.dataset.av;
      ov.remove();
      _renderProfile();
    }catch(e){ alert('Kaydedilemedi'); }
  }));
}

// ── ⚙️ AYARLAR ──────────────────────────────────────────────────
function setOn(key, def){ const v = localStorage.getItem(key); return v === null ? def : v !== '0'; }
function openSettings(){
  if(byId('setModal')) return;
  const ov = document.createElement('div');
  ov.id = 'setModal'; ov.className = 'nick-modal-ov';
  const fabs = setOn('hero_set_fabs', true);
  const st = Auth.getState();
  ov.innerHTML = `
    <div class="nick-modal">
      <div class="nm-title">⚙️ Ayarlar</div>
      <div class="set-row"><span>💎 Yüzen butonlar (FAB)</span><button class="set-tgl ${fabs?'on':''}" data-s="fabs">${fabs?'AÇIK':'KAPALI'}</button></div>
      <div class="set-row"><span>🧹 Önbelleği temizle + yenile</span><button class="set-tgl" data-s="cache">TEMİZLE</button></div>
      ${st.status==='google' ? '<div class="set-row"><span>🚪 Hesaptan çık</span><button class="set-tgl warn" data-s="logout">ÇIKIŞ</button></div>' : ''}
      <div class="set-ver">Hero Oyun Portalı · modüler sürüm</div>
      <div class="nm-actions"><button class="nm-btn nm-cancel" data-s="close">Kapat</button></div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  ov.querySelector('[data-s="close"]').addEventListener('click', () => ov.remove());
  ov.querySelector('[data-s="fabs"]').addEventListener('click', async (e) => {
    const now = !setOn('hero_set_fabs', true);
    localStorage.setItem('hero_set_fabs', now ? '1' : '0');
    e.target.classList.toggle('on', now); e.target.textContent = now ? 'AÇIK' : 'KAPALI';
    try{ const m = await import('./social.js'); m.applyFabSetting(); }catch(err){}
  });
  ov.querySelector('[data-s="cache"]').addEventListener('click', async () => {
    try{ if(window.caches && caches.keys){ const ks = await caches.keys(); for(const k of ks) await caches.delete(k); } }catch(e){}
    location.reload();
  });
  const lo = ov.querySelector('[data-s="logout"]');
  if(lo) lo.addEventListener('click', async () => { if(confirm('Hesaptan çıkılsın mı?')){ try{ await Auth.logout(); }catch(e){} ov.remove(); } });
}

// ── 🏆 LİDERLİK (Kaju) ──────────────────────────────────────────
async function renderLeaderboard(){
  const box = byId('scrLB'); if(!box) return;
  box.innerHTML = '<div class="prf-card"><div class="prf-lbl">🏆 KAJU LİDERLİĞİ</div><div class="prf-recbody">Yükleniyor…</div></div>';
  const body = box.querySelector('.prf-recbody');
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'leaderboard/kaju'), fdb.orderByChild('kaju'), fdb.limitToLast(20)));
    if(!snap.exists()){ body.innerHTML = '<i>Henüz veri yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ uid: ch.key, ...ch.val() }); });
    rows.sort((a,b) => (b.kaju||0)-(a.kaju||0));
    // İsimleri nick'ten tazele (en iyi 20)
    const me = Auth.getState().uid;
    const out = await Promise.all(rows.map(async (r, i) => {
      let name = r.name, ava = '👤';
      try{ const u = await fdb.get(fdb.ref(db, 'users/' + r.uid)); if(u.exists()){ const v = u.val(); name = v.nick || v.name || name; ava = v.avatar || '👤'; } }catch(e){}
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      return `<div class="prf-rec${r.uid===me?' me':''}" data-lbuid="${esc(r.uid)}" style="cursor:pointer"><span>${medal} ${ava} ${esc(name || 'Oyuncu')}</span><b>💰 ${fmt(r.kaju)}</b></div>`;
    }));
    body.innerHTML = out.join('');
    body.querySelectorAll('[data-lbuid]').forEach(el => el.addEventListener('click', async () => {
      try{ const m = await import('./social.js'); m.openPlayerCard(el.dataset.lbuid); }catch(e){}
    }));
  }catch(e){ body.innerHTML = '<i>Liderlik okunamadı</i>'; }
}

// ── 👥 / 🔔 köprüleri: Sosyal Hub'a aç ─────────────────────────
function renderBridges(){
  const fr = byId('scrFriends');
  if(fr) fr.innerHTML = `<div class="prf-card prf-bridge"><div class="prf-lbl">👥 ARKADAŞLAR</div><p>Arkadaş listesi, ekleme ve özel mesajlar <b>Sosyal Hub</b>'ta.</p><button class="prf-btn" data-hub="dost">💎 Hub'da Aç</button></div>`;
  const nt = byId('scrNotif');
  if(nt) nt.innerHTML = `<div class="prf-card prf-bridge"><div class="prf-lbl">🔔 BİLDİRİMLER</div><p>Bildirimlerin ve 📣 duyurular <b>Sosyal Hub</b>'ta.</p><button class="prf-btn" data-hub="notif">💎 Hub'da Aç</button></div>`;
  document.querySelectorAll('[data-hub]').forEach(b => b.addEventListener('click', async () => {
    try{ const m = await import('./social.js'); m.applyFabSetting(); m.openHubTab(b.dataset.hub); }catch(e){}
  }));
}

export default initScreens;
