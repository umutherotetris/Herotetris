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
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');
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
  const lvl = pl.level || 1, xp = pl.xp || 0;
  const need = (Store.xpForLevel ? Store.xpForLevel(lvl) : 100) || 100;
  const pct = Math.max(0, Math.min(100, Math.round(xp / need * 100)));
  box.innerHTML = `
    <div class="prf-card">
      <div class="prf-top">
        <div class="prf-ava">${isGoogle ? '🦸' : '👤'}</div>
        <div class="prf-id">
          <div class="prf-name">${esc(nick)} ${isGoogle ? '<button class="prf-mini" data-p="nick">✏️</button>' : ''}</div>
          <div class="prf-sub">${isGoogle ? (st.isAdmin ? '👑 ADMİN · ' : '') + 'UID: ' + esc((st.uid||'').slice(0,10)) + '…' : 'Misafir hesabı — kaydetmek için bağlan'}</div>
        </div>
      </div>
      <div class="prf-stats">
        <div class="prf-stat"><b>💰 ${fmt(pl.kaju)}</b><span>KAJU</span></div>
        <div class="prf-stat"><b>⭐ ${lvl}</b><span>SEVİYE</span></div>
        <div class="prf-stat"><b>✨ ${fmt(pl.totalXP || xp)}</b><span>TOPLAM XP</span></div>
      </div>
      <div class="prf-xpbar"><div class="prf-xpfill" style="width:${pct}%"></div><span>LV ${lvl} → ${lvl+1} · %${pct}</span></div>
      <div class="prf-acts">
        ${isGoogle ? '<button class="prf-btn" data-p="kaju">💸 Kaju Gönder</button>' : '<button class="prf-btn" data-p="login">🔗 Hesabı Bağla</button>'}
        <button class="prf-btn" data-p="settings">⚙️ Ayarlar</button>
      </div>
    </div>
    <div class="prf-card" id="prfRecords"><div class="prf-lbl">🏆 REKORLARIN</div><div class="prf-recbody">Yükleniyor…</div></div>`;
  box.querySelector('[data-p="settings"]').addEventListener('click', openSettings);
  const nb = box.querySelector('[data-p="nick"]'); if(nb) nb.addEventListener('click', async () => (await uiMod()).openNickModal());
  const kb = box.querySelector('[data-p="kaju"]'); if(kb) kb.addEventListener('click', async () => (await uiMod()).openKajuModal());
  const lb = box.querySelector('[data-p="login"]'); if(lb) lb.addEventListener('click', () => Auth.loginGoogle && Auth.loginGoogle());
  renderRecords(st);
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
      let name = r.name;
      try{ const u = await fdb.get(fdb.ref(db, 'users/' + r.uid + '/nick')); if(u.exists()) name = u.val(); }catch(e){}
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      return `<div class="prf-rec${r.uid===me?' me':''}"><span>${medal} ${esc(name || 'Oyuncu')}</span><b>💰 ${fmt(r.kaju)}</b></div>`;
    }));
    body.innerHTML = out.join('');
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
