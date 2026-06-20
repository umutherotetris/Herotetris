// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — ADMİN YÖNETİM PANELİ
//  👑 rozetinden açılır. Yalnız /admins kaydı olan hesaplar.
//  Bölümler: oyuncu ara → profil + Kaju ± + geçmiş + nick zorla
//  değiştir + ban/mute. Her işlem adminLog'a yazılır.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import Store from './store.js';

const $ = (root, sel) => root.querySelector(sel);
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');
const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let P = null;   // panel durumu { root, target:{uid,profile} }

// ── adminLog kaydı ──────────────────────────────────────────────
async function logAdmin(action, targetUid, detail){
  try{
    const me = Auth.getState();
    const k = 'a' + Date.now() + '_' + Math.floor(Math.random()*100000);
    await fdb.set(fdb.ref(db, 'adminLog/' + k), {
      ts: Date.now(), adminUid: me.uid, adminNick: me.displayName || 'Admin',
      action, target: targetUid || '', detail: String(detail||'').slice(0, 200)
    });
  }catch(e){}
}

// ── Panel aç/kapa ───────────────────────────────────────────────
export function openAdminPanel(){
  const st = Auth.getState();
  if(st.isAdmin !== true){ alert('Bu panel yalnız adminler içindir.'); return; }
  if(document.getElementById('adminPanel')) return;
  const ov = document.createElement('div');
  ov.id = 'adminPanel'; ov.className = 'adm-ov';
  ov.innerHTML = `
    <div class="adm-panel">
      <div class="adm-head">
        <div class="adm-title">👑 ADMİN YÖNETİMİ</div>
        <button class="adm-x" data-a="close">✕</button>
      </div>
      <div class="adm-body">
        <div class="adm-row" style="position:relative">
          <input class="adm-in" data-el="q" placeholder="Nick veya UID ara…" autocomplete="off" spellcheck="false">
          <button class="adm-btn p" data-a="search">🔍</button>
          <div class="adm-sug" data-el="sug" style="display:none"></div>
        </div>
        <div class="adm-msg" data-el="msg"></div>
        <div data-el="result"></div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="rebuild">📇 Nick Defterini Onar <span style="opacity:.6;font-weight:400">— tüm oyuncuları aramaya ekler</span></button>
        </div>
        <div class="adm-stats" data-el="stats">📊 yükleniyor…</div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="onlinelist">🟢 Çevrimiçi Oyuncular <span data-el="oncount" style="color:#5fd38a;font-weight:800"></span> <span>▾</span></button>
          <div class="adm-log" data-el="online" style="display:none"></div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="chatmod">💬 Sohbet Moderasyonu <span>▾</span></button>
          <div class="adm-log" data-el="chatmod" style="display:none"></div>
        </div>
        <div class="adm-sec">
          <div class="adm-row">
            <button class="adm-acc" style="flex:1" data-a="chatlock">🔒 Sohbet Kilidi: <b data-el="lockState">…</b></button>
            <button class="adm-acc" style="flex:1" data-a="glow">✨ Nick Işıltısı</button>
          </div>
          <div class="adm-log" data-el="glowbox" style="display:none"></div>
        </div>
        <div class="adm-sec">
          <div class="adm-row" style="gap:6px;flex-wrap:wrap">
            <button class="adm-acc" style="flex:1" data-a="allusers">👥 Tüm Kullanıcılar <span data-el="ucount" style="color:#5fd38a;font-weight:800"></span> <span>▾</span></button>
            <button class="adm-btn r" style="flex:0;white-space:nowrap" data-a="cleanAnon">🧹 Nick'siz Temizle</button>
            <button class="adm-btn r" style="flex:0;white-space:nowrap" data-a="cleanDup">🔁 Duplicate Temizle</button>
          </div>
          <div class="adm-row" style="gap:4px;flex-wrap:wrap;margin-top:4px" id="userFilterRow" style="display:none">
            <button class="adm-btn p" data-filter="all" style="font-size:10px;padding:4px 8px">Tümü</button>
            <button class="adm-btn" data-filter="nonick" style="font-size:10px;padding:4px 8px">Nick'siz</button>
            <button class="adm-btn" data-filter="anon" style="font-size:10px;padding:4px 8px">Anonim</button>
            <button class="adm-btn" data-filter="dup" style="font-size:10px;padding:4px 8px">Duplicate</button>
            <input class="adm-in" data-el="userSearch" placeholder="Nick ara…" style="flex:1;min-width:80px;padding:4px 8px;font-size:11px">
          </div>
          <div class="adm-log" data-el="allusers" style="display:none"></div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="ghost">👻 Ghost Modu: <b data-el="ghostState">…</b> <span style="opacity:.6;font-weight:400">— listelerde görünmezsin</span></button>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="toggleAdmFab">👑 Admin FAB Görünürlüğü: <b data-el="admFabState">…</b> <span style="opacity:.6;font-weight:400">— ekrandaki admin butonu</span></button>
        </div>
        <div class="adm-sec" style="border:1px solid rgba(0,229,255,.25);border-radius:10px;padding:8px">
          <div class="adm-lbl" style="color:#4dd0e1">🩺 SİSTEM CHECK-UP & DEBUG</div>
          <button class="adm-acc" data-a="toggleDebug">🔬 Debug Modu: <b data-el="debugState">…</b> <span style="opacity:.6;font-weight:400">— ekranda hata/durum overlay'i</span></button>
          <button class="adm-btn p" data-a="runCheckup" style="width:100%;margin-top:6px">🩺 Tam Sistem Check-Up Çalıştır</button>
          <div class="adm-log" data-el="checkup" style="display:none;margin-top:6px;font-size:10px;font-family:monospace;line-height:1.7;max-height:300px;overflow:auto"></div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="ipbans">🌐 IP Yasakları <span>▾</span></button>
          <div class="adm-log" data-el="ipbans" style="display:none"></div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="nickbans">🚷 Nick Yasakları <span>▾</span></button>
          <div class="adm-log" data-el="nickbans" style="display:none">
            <div class="adm-row">
              <input class="adm-in" data-el="nbText" maxlength="16" placeholder="Yasaklanacak nick" autocapitalize="off">
              <button class="adm-btn r" data-a="nbAdd">Yasakla</button>
            </div>
            <div data-el="nbList"></div>
          </div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="dupclean">🧹 Kopya/Yetim Defter Temizliği <span style="opacity:.6;font-weight:400">— nicks/ düzenler</span></button>
        </div>
        <div class="adm-sec"><div class="adm-lbl">📣 PORTALA DUYURU GÖNDER</div>
          <div class="adm-row">
            <input class="adm-in" data-el="bcText" maxlength="200" placeholder="Duyuru metni (tüm oyunculara)">
            <button class="adm-btn p" data-a="bcSend">Gönder</button>
          </div>
        </div>
        <div class="adm-sec">
          <button class="adm-acc" data-a="loglist">📜 Son admin işlemleri <span data-el="logarrow">▾</span></button>
          <div class="adm-log" data-el="log" style="display:none"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  P = { root: ov, target: null };
  ov.addEventListener('click', (e) => { if(e.target === ov) closePanel(); });
  $(ov,'[data-a="close"]').addEventListener('click', closePanel);
  $(ov,'[data-a="search"]').addEventListener('click', doSearch);
  $(ov,'[data-el="q"]').addEventListener('keydown', (e) => { if(e.key==='Enter') doSearch(); });
  // Canlı öneri: 2+ harf yazınca kayıt defterini tara (harf duyarsız)
  let sugT = null;
  $(ov,'[data-el="q"]').addEventListener('input', () => {
    const v = $(ov,'[data-el="q"]').value.trim();
    const box = $(ov,'[data-el="sug"]');
    clearTimeout(sugT);
    if(v.length < 2 || (v.length >= 20 && !/\s/.test(v))){ box.style.display='none'; return; }
    sugT = setTimeout(async () => {
      const list = (Auth.searchNicks ? await Auth.searchNicks(v, 8) : []);
      if($(ov,'[data-el="q"]').value.trim() !== v) return;
      if(!list.length){ box.style.display='none'; return; }
      box.innerHTML = list.map(x => `<div class="adm-sug-it" data-uid="${esc(x.uid)}">👤 ${esc(x.nick)}</div>`).join('');
      box.style.display = '';
      box.querySelectorAll('.adm-sug-it').forEach(it => it.addEventListener('click', () => {
        box.style.display = 'none';
        $(ov,'[data-el="q"]').value = it.textContent.replace('👤 ','');
        loadTarget(it.dataset.uid);
      }));
    }, 220);
  });
  $(ov,'[data-a="loglist"]').addEventListener('click', toggleLog);
  $(ov,'[data-a="rebuild"]').addEventListener('click', rebuildRegistry);
  $(ov,'[data-a="onlinelist"]').addEventListener('click', toggleOnline);
  $(ov,'[data-a="chatmod"]').addEventListener('click', toggleChatMod);
  $(ov,'[data-a="chatlock"]').addEventListener('click', toggleChatLock);
  $(ov,'[data-a="glow"]').addEventListener('click', toggleGlowPicker);
  $(ov,'[data-a="allusers"]').addEventListener('click', toggleAllUsers);
  $(ov,'[data-a="cleanAnon"]').addEventListener('click', cleanAnonUsers);
  $(ov,'[data-a="cleanDup"]').addEventListener('click', cleanDupNicks);
  // Filtre butonları
  ov.querySelectorAll('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
    ov.querySelectorAll('[data-filter]').forEach(b => b.className = 'adm-btn');
    btn.className = 'adm-btn p';
    applyUserFilter(btn.dataset.filter);
  }));
  const usrSearch = $(ov,'[data-el="userSearch"]');
  if(usrSearch) usrSearch.addEventListener('input', () => applyUserFilter('search', usrSearch.value));
  $(ov,'[data-a="ghost"]').addEventListener('click', toggleGhost);
  $(ov,'[data-a="toggleAdmFab"]').addEventListener('click', toggleAdminFab);
  $(ov,'[data-a="toggleDebug"]').addEventListener('click', toggleDebugMode);
  $(ov,'[data-a="runCheckup"]').addEventListener('click', runSystemCheckup);
  $(ov,'[data-a="ipbans"]').addEventListener('click', toggleIPBans);
  $(ov,'[data-a="nickbans"]').addEventListener('click', toggleNickBans);
  $(ov,'[data-a="nbAdd"]').addEventListener('click', addNickBan);
  $(ov,'[data-a="dupclean"]').addEventListener('click', cleanRegistry);
  loadStats(); loadLockState(); loadGhostState(); loadAdminFabState(); loadDebugState();
  $(ov,'[data-a="bcSend"]').addEventListener('click', sendBroadcast);
  setTimeout(() => $(ov,'[data-el="q"]').focus(), 60);
}

// ── 📊 İstatistik şeridi ────────────────────────────────────────
async function loadStats(){
  const el = $(P.root,'[data-el="stats"]'); if(!el) return;
  let total = '?', online = 0;
  try{ const s = await fdb.get(fdb.ref(db, 'users')); if(s.exists()) total = Object.keys(s.val()).length; }catch(e){}
  try{
    const s = await fdb.get(fdb.query(fdb.ref(db, 'presence'), fdb.orderByChild('online'), fdb.equalTo(true)));
    if(s.exists()){ const now = Date.now(); s.forEach(ch => { const v = ch.val(); if(now - (v.lastSeen||0) < 180000) online++; }); }
  }catch(e){}
  el.innerHTML = `📊 Kayıtlı: <b>${fmt(total)}</b> · 🟢 Çevrimiçi: <b style="color:#5fd38a">${online}</b>`;
}

// ── 💬 Sohbet moderasyonu: son mesajlar + silme ─────────────────
async function toggleChatMod(){
  const box = $(P.root,'[data-el="chatmod"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'globalChat'), fdb.limitToLast(15)));
    if(!snap.exists()){ box.innerHTML = '<i>Mesaj yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ key: ch.key, ...ch.val() }); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(m => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(m.name || '?')}</b>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.text || '')}</span>
        <button class="adm-btn r" style="flex:0;padding:5px 9px;font-size:11px" data-del="${esc(m.key)}">🗑</button>
      </div>`).join('');
    box.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', async () => {
      if(!confirm('Bu mesaj silinsin mi?')) return;
      try{
        await fdb.set(fdb.ref(db, 'globalChat/' + btn.dataset.del), null);
        btn.closest('.adm-li').remove();
        logAdmin('chat-sil', '', 'mesaj silindi');
      }catch(e){ msg('✗ Silinemedi', false); }
    }));
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

// ── 🔒 Sohbet kilidi ────────────────────────────────────────────
async function loadLockState(){
  try{
    const snap = await fdb.get(fdb.ref(db, 'chatModeration/locked'));
    const on = snap.exists() && snap.val() && snap.val().locked === true;
    const el = $(P.root,'[data-el="lockState"]'); if(el){ el.textContent = on ? 'KİLİTLİ 🔒' : 'AÇIK 🔓'; el.style.color = on ? '#ff8fa0' : '#5fd38a'; }
    return on;
  }catch(e){ return false; }
}
async function toggleChatLock(){
  const on = await loadLockState();
  const next = !on;
  if(!confirm(next ? 'Global sohbet TÜM oyunculara kilitlensin mi?' : 'Sohbet kilidi açılsın mı?')) return;
  try{
    await fdb.set(fdb.ref(db, 'chatModeration/locked'), next ? { locked:true, by: Auth.getState().uid, ts: Date.now() } : null);
    await loadLockState();
    msg(next ? '✓ Sohbet kilitlendi 🔒' : '✓ Sohbet açıldı 🔓', true);
    logAdmin(next ? 'sohbet-kilit' : 'sohbet-ac', '', '');
  }catch(e){ msg('✗ Yapılamadı', false); }
}

// ── ✨ Nick Işıltısı seçici ─────────────────────────────────────
async function toggleGlowPicker(){
  const box = $(P.root,'[data-el="glowbox"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  let GS = {}, cur = localStorage.getItem('hero_glow_style') || 'classic';
  try{ const m = await import('./social.js'); GS = m.GLOW_STYLES || {}; }catch(e){}
  box.style.display = '';
  box.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px 0">' +
    Object.keys(GS).map(k => `
      <button class="adm-acc" data-glow="${k}" style="${k===cur?'border-color:#ffd86b;':''}">
        <span class="${GS[k].cls}" style="font-weight:900;color:#FFD740">NitrikOksit</span><br><small style="opacity:.7">${GS[k].label}</small>
      </button>`).join('') + '</div>';
  box.querySelectorAll('[data-glow]').forEach(btn => btn.addEventListener('click', () => {
    localStorage.setItem('hero_glow_style', btn.dataset.glow);
    msg('✓ Işıltı: ' + btn.dataset.glow + ' (sohbette admin nicklerinde)', true);
    toggleGlowPicker(); toggleGlowPicker();   // yeniden çiz (seçim çerçevesi)
  }));
}

// ── 👥 Tüm kullanıcılar ─────────────────────────────────────────
// Tüm kullanıcılar listesi için global cache
let _allUsersCache = [];
let _dupNickMap = {};  // nick → [uid1, uid2, ...]

async function toggleAllUsers(){
  const box = $(P.root,'[data-el="allusers"]');
  const filterRow = P.root.querySelector('#userFilterRow');
  if(box.style.display !== 'none'){ box.style.display = 'none'; if(filterRow) filterRow.style.display='none'; return; }
  box.style.display = ''; if(filterRow) filterRow.style.display='';
  box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.ref(db, 'users'));
    if(!snap.exists()){ box.innerHTML = '<i>Kullanıcı yok</i>'; return; }
    const v = snap.val();
    _allUsersCache = Object.keys(v).map(uid => ({ uid, ...v[uid] }));
    _allUsersCache.sort((a,b) => (b.lastSeen||0)-(a.lastSeen||0));

    // Duplicate nick tespiti
    _dupNickMap = {};
    _allUsersCache.forEach(u => {
      const n = (u.nick||u.name||u.displayName||'').toLowerCase().trim();
      if(n){ (_dupNickMap[n] = _dupNickMap[n]||[]).push(u.uid); }
    });

    const countEl = $(P.root,'[data-el="ucount"]');
    if(countEl) countEl.textContent = '(' + _allUsersCache.length + ')';

    renderUserList(_allUsersCache);
    // İlk filtre butonunu aktif et
    const firstFilter = P.root.querySelector('[data-filter="all"]');
    if(firstFilter){ P.root.querySelectorAll('[data-filter]').forEach(b => b.className='adm-btn'); firstFilter.className='adm-btn p'; }
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

function renderUserList(rows){
  const box = $(P.root,'[data-el="allusers"]');
  if(!box) return;
  const dupSet = new Set(Object.values(_dupNickMap).filter(a=>a.length>1).flat());
  const display = rows.slice(0, 100);
  if(!display.length){ box.innerHTML = '<i style="color:#9fb0d8">Sonuç yok</i>'; return; }
  box.innerHTML = display.map(u => {
    const nick = u.nick || u.name || u.displayName || '';
    const isDup = nick && dupSet.has(u.uid);
    const isAnon = !nick || nick.startsWith('Misafir') || nick.startsWith('Oyuncu');
    const noNick = !nick;
    return `<div class="adm-li" data-uid="${esc(u.uid)}" style="cursor:pointer;align-items:center;${noNick?'opacity:.5':''}">
      <b style="${isDup?'color:#FFD740':''}">${esc(nick||'—')} ${isDup?'<span title="Duplicate nick">⚠️</span>':''}</b>
      ${u.isAdmin?'<span class="adm-tag" style="background:rgba(255,215,64,.15);color:#ffd86b;border:1px solid rgba(255,215,64,.35)">👑</span>':''}
      ${u.isVice?'<span class="adm-tag" style="background:rgba(206,147,216,.15);color:#CE93D8;border:1px solid rgba(206,147,216,.35)">⭐</span>':''}
      ${u.banned===true?'<span class="adm-tag ban">🚫</span>':''}
      ${u.muted===true?'<span class="adm-tag mute">🔇</span>':''}
      ${isAnon&&nick?'<span class="adm-tag" style="background:rgba(150,150,150,.15);color:#9fb0d8;border:1px solid rgba(150,150,150,.3);font-size:9px">ANONİM</span>':''}
      <span style="margin-left:auto">💰 ${fmt(u.kaju)}</span>
    </div>`;
  }).join('');
  if(rows.length > 100) box.innerHTML += `<div style="padding:6px;color:#6d7aa8;font-size:10px;text-align:center">+${rows.length-100} daha… Aramayı daralt</div>`;
  box.querySelectorAll('[data-uid]').forEach(el => el.addEventListener('click', () => loadTarget(el.dataset.uid)));
}

function applyUserFilter(filter, searchVal){
  if(!_allUsersCache.length) return;
  const dupSet = new Set(Object.values(_dupNickMap).filter(a=>a.length>1).flat());
  let rows = _allUsersCache;
  if(filter === 'nonick'){
    rows = _allUsersCache.filter(u => !(u.nick||u.name||u.displayName||'').trim());
  } else if(filter === 'anon'){
    rows = _allUsersCache.filter(u => {
      const n = (u.nick||u.name||u.displayName||'').trim();
      return !n || n.startsWith('Misafir') || n.startsWith('Oyuncu') || n.startsWith('Anonim');
    });
  } else if(filter === 'dup'){
    rows = _allUsersCache.filter(u => dupSet.has(u.uid));
  } else if(filter === 'search' && searchVal){
    const q = searchVal.toLowerCase().trim();
    rows = _allUsersCache.filter(u => {
      const n = (u.nick||u.name||u.displayName||'').toLowerCase();
      return n.includes(q) || u.uid.toLowerCase().includes(q);
    });
  }
  renderUserList(rows);
}

// 🧹 Nick'siz (boş isimli) anonim kullanıcıları sil
async function cleanAnonUsers(){
  if(!_allUsersCache.length){ msg('Önce "Tüm Kullanıcılar" listesini aç', false); return; }
  const toDelete = _allUsersCache.filter(u => {
    const n = (u.nick||u.name||u.displayName||'').trim();
    return !n && !u.kaju && !u.isAdmin && !u.isVice;  // nick yok + kaju yok + admin değil
  });
  if(!toDelete.length){ msg('Temizlenecek kayıt yok', true); return; }
  if(!confirm(`Nick'i VE kajusu olmayan ${toDelete.length} anonim kullanıcı silinecek. Onaylıyor musun?`)) return;
  msg(`Temizleniyor… (0/${toDelete.length})`, true);
  let done = 0, failed = 0;
  for(const u of toDelete){
    try{
      await fdb.set(fdb.ref(db, 'users/' + u.uid), null);
      done++;
      if(done % 5 === 0) msg(`Temizleniyor… (${done}/${toDelete.length})`, true);
    }catch(e){ failed++; }
  }
  _allUsersCache = _allUsersCache.filter(u => !toDelete.find(d => d.uid === u.uid));
  const countEl = $(P.root,'[data-el="ucount"]');
  if(countEl) countEl.textContent = '(' + _allUsersCache.length + ')';
  renderUserList(_allUsersCache);
  msg(`✓ ${done} kullanıcı silindi${failed ? ' · ' + failed + ' başarısız' : ''}`, true);
  logAdmin('anon-temizle', '', `${done} kullanıcı silindi`);
}

// 🔁 Duplicate nick temizliği — aynı nick'teki en yeni UID dışındakileri temizle
async function cleanDupNicks(){
  if(!_allUsersCache.length){ msg('Önce "Tüm Kullanıcılar" listesini aç', false); return; }
  const dups = Object.entries(_dupNickMap).filter(([,uids]) => uids.length > 1);
  if(!dups.length){ msg('Duplicate nick bulunamadı', true); return; }
  const summary = dups.map(([nick, uids]) => `• "${nick}" → ${uids.length} hesap`).join('\n');
  if(!confirm(`${dups.length} duplicate nick bulundu:\n${summary}\n\nHer grup için en son aktif hesap KORUNUR, diğerlerinin nick'i silinir (hesap silinmez). Devam?`)) return;
  msg('Duplicate temizleniyor…', true);
  let fixed = 0;
  for(const [, uids] of dups){
    // En son lastSeen olan UID'yi koru
    const withTs = uids.map(uid => {
      const u = _allUsersCache.find(x => x.uid === uid);
      return { uid, lastSeen: u ? (u.lastSeen||0) : 0, kaju: u ? (u.kaju||0) : 0, isAdmin: u && u.isAdmin };
    });
    withTs.sort((a,b) => {
      if(a.isAdmin) return -1; if(b.isAdmin) return 1;  // admin her zaman korunur
      if(b.kaju !== a.kaju) return b.kaju - a.kaju;      // daha fazla kajusu olan korunur
      return b.lastSeen - a.lastSeen;
    });
    const keep = withTs[0].uid;
    const remove = withTs.slice(1).map(x => x.uid);
    for(const uid of remove){
      try{
        // Nick'i sil ama hesabı koru
        await fdb.update(fdb.ref(db, 'users/' + uid), { nick: null, name: null });
        const u = _allUsersCache.find(x => x.uid === uid);
        if(u){ u.nick = null; u.name = null; }
        fixed++;
      }catch(e){}
    }
  }
  // Cache'i güncelle ve yeniden render et
  _dupNickMap = {};
  _allUsersCache.forEach(u => {
    const n = (u.nick||u.name||u.displayName||'').toLowerCase().trim();
    if(n){ (_dupNickMap[n] = _dupNickMap[n]||[]).push(u.uid); }
  });
  renderUserList(_allUsersCache);
  msg(`✓ ${fixed} duplicate kayıt temizlendi (hesaplar korundu, nickleri boşaltıldı)`, true);
  logAdmin('dup-temizle', '', `${fixed} duplicate`);
}

// ── 🟢 Çevrimiçi oyuncular (presence) ───────────────────────────
async function toggleOnline(){
  const box = $(P.root,'[data-el="online"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'presence'), fdb.orderByChild('online'), fdb.equalTo(true)));
    if(!snap.exists()){ box.innerHTML = '<i>Şu an çevrimiçi oyuncu yok</i>'; $(P.root,'[data-el="oncount"]').textContent = '(0)'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ uid: ch.key, ...ch.val() }); });
    // 3 dakikadan eski "online" kayıtları bayat say (kapanışta onDisconnect kaçmış olabilir)
    const fresh = rows.filter(r => (Date.now() - (r.lastSeen || 0)) < 180000);
    fresh.sort((a,b) => (b.lastSeen||0)-(a.lastSeen||0));
    $(P.root,'[data-el="oncount"]').textContent = '(' + fresh.length + ')';
    if(!fresh.length){ box.innerHTML = '<i>Şu an çevrimiçi oyuncu yok</i>'; return; }
    box.innerHTML = fresh.map(r =>
      `<div class="adm-li adm-online" data-uid="${esc(r.uid)}" style="cursor:pointer;align-items:center">
        <span style="width:8px;height:8px;border-radius:50%;background:#5fd38a;box-shadow:0 0 6px #5fd38a;flex-shrink:0"></span>
        <b>${esc(r.name || 'Oyuncu')}</b> <span>${tAgoA(r.lastSeen)}</span>
      </div>`).join('');
    box.querySelectorAll('.adm-online').forEach(el => el.addEventListener('click', () => loadTarget(el.dataset.uid)));
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}
function tAgoA(ts){ const d = Date.now()-(ts||0); if(d<90e3) return 'şimdi'; if(d<3600e3) return Math.floor(d/60e3)+' dk önce'; return Math.floor(d/3600e3)+' sa önce'; }

// ── 📣 Duyuru ───────────────────────────────────────────────────
async function sendBroadcast(){
  const inp = $(P.root,'[data-el="bcText"]');
  const text = inp.value.trim();
  if(!text){ msg('Duyuru metni boş', false); return; }
  if(!confirm('Bu duyuru TÜM oyunculara gidecek:\n\n"' + text + '"\n\nGönderilsin mi?')) return;
  try{
    const me = Auth.getState();
    await fdb.push(fdb.ref(db, 'broadcasts'), { text: text.slice(0,200), ts: Date.now(), by: me.displayName || 'Admin' });
    inp.value = '';
    msg('✓ Duyuru gönderildi 📣', true);
    logAdmin('duyuru', '', text.slice(0, 80));
  }catch(e){ msg('✗ Gönderilemedi', false); }
}

// ── Kayıt defteri onarımı: tüm users → nicks/ (admin yetkisiyle) ──
function nickKeySafe(n){ return String(n||'').replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase().replace(/[.#$\[\]\/\s]/g,''); }
async function rebuildRegistry(){
  if(!confirm('Tüm oyuncular taranıp nick kayıt defteri (nicks/) doldurulacak. Devam?')) return;
  msg('Oyuncular okunuyor…', true);
  let users;
  try{ const s = await fdb.get(fdb.ref(db, 'users')); users = s.exists() ? s.val() : {}; }
  catch(e){ msg('✗ users okunamadı', false); return; }
  const uids = Object.keys(users);
  let added = 0, fixedProfile = 0, conflict = 0, skipped = 0, done = 0;
  for(const uid of uids){
    done++;
    if(done % 10 === 0) msg(`Onarılıyor… ${done}/${uids.length}`, true);
    const p = users[uid] || {};
    const raw = p.nick || p.name || p.displayName || '';
    const clean = String(raw).trim().slice(0, 16);
    const key = nickKeySafe(clean);
    if(!clean || key.length < 3){ skipped++; continue; }
    try{
      const reg = await fdb.get(fdb.ref(db, 'nicks/' + key));
      if(reg.exists()){
        if(reg.val().uid !== uid) conflict++;   // aynı nick başka uid'de — ilk gelen korunur
      } else {
        await fdb.set(fdb.ref(db, 'nicks/' + key), { uid, nick: clean, ts: Date.now() });
        added++;
      }
      if(!p.nick){ await fdb.update(fdb.ref(db, 'users/' + uid), { nick: clean }); fixedProfile++; }
    }catch(e){ skipped++; }
  }
  msg(`✓ Defter onarıldı: +${added} eklendi · ${fixedProfile} profile nick yazıldı · ${conflict} çakışma · ${skipped} atlandı (${uids.length} oyuncu)`, true);
  logAdmin('nick-defter-onar', '', `+${added}, profil:${fixedProfile}, çakışma:${conflict}`);
}
function closePanel(){ if(P){ P.root.remove(); P = null; } }
function msg(t, ok){ const m = $(P.root,'[data-el="msg"]'); m.textContent = t||''; m.className = 'adm-msg ' + (ok?'ok':'bad'); }

// ── Oyuncu ara ──────────────────────────────────────────────────
async function doSearch(){
  const q = $(P.root,'[data-el="q"]').value.trim();
  if(!q){ msg('Nick veya UID gir', false); return; }
  msg('Aranıyor…', true);
  let uid = null;
  if(q.length >= 20 && !/\s/.test(q)){ uid = q; }            // UID gibi görünüyor
  else { const r = await Auth.resolveNick(q); uid = r ? r.uid : null; }
  if(!uid){ msg('✗ Oyuncu bulunamadı', false); return; }
  await loadTarget(uid);
}

async function loadTarget(uid){
  try{
    const snap = await fdb.get(fdb.ref(db, 'users/' + uid));
    if(!snap.exists()){ msg('✗ users/' + uid + ' yok', false); return; }
    P.target = { uid, profile: snap.val() || {} };
    msg('', true);
    renderTarget();
  }catch(e){ msg('✗ Okunamadı (izin?)', false); }
}

function renderTarget(){
  const { uid, profile: p } = P.target;
  const banned = p.banned === true;
  const muted = p.muted === true;
  const banInfo = banned ? (p.banType==='perma' ? 'KALICI' : ('→ ' + (p.banUntil ? new Date(p.banUntil).toLocaleString('tr-TR') : '?'))) : '';
  const muteInfo = muted ? ('→ ' + (p.muteUntil ? new Date(p.muteUntil).toLocaleString('tr-TR') : '?')) : '';
  $(P.root,'[data-el="result"]').innerHTML = `
    <div class="adm-card">
      <div class="adm-prow"><b>${esc(p.nick || p.name || p.displayName || '—')}</b>
        ${banned?'<span class="adm-tag ban">🚫 BANLI '+esc(banInfo)+'</span>':''}
        ${muted?'<span class="adm-tag mute">🔇 SUSTURULMUŞ '+esc(muteInfo)+'</span>':''}
      </div>
      <div class="adm-uid">${esc(uid)}</div>
      <div class="adm-prow">💰 <b data-el="kaju">${fmt(p.kaju)}</b> Kaju · LV ${esc(p.level||1)} · XP ${(()=>{ const x=p.xp; const v=Number((x&&typeof x==='object')?(x.totalXP??x.xp??0):(p.totalXP??x??0)); return (Number.isFinite(v)?v:0).toLocaleString('tr-TR'); })()}</div>
      <div class="adm-prow" style="font-size:11px;color:#9fb0d8">🌐 IP: <b data-el="ipTxt">${esc(p.lastIP || 'bilinmiyor')}</b>
        ${p.lastIP ? '<button class="adm-btn r" style="padding:4px 9px;font-size:10px" data-a="ipban">IP Banla</button>' : ''}
        <span data-el="ipBanState"></span>
      </div>

      <div class="adm-sec"><div class="adm-lbl">💰 KAJU AYARLA</div>
        <div class="adm-row">
          <input class="adm-in" data-el="kAmt" inputmode="numeric" placeholder="+ekle / −eksilt (örn. -500)">
          <button class="adm-btn p" data-a="kaju">Uygula</button>
        </div>
        <button class="adm-acc" data-a="khist">📒 Kaju geçmişi <span>▾</span></button>
        <div class="adm-log" data-el="khist" style="display:none"></div>
      </div>

      <div class="adm-sec"><div class="adm-lbl">🔔 OYUNCUYA BİLDİRİM</div>
        <div class="adm-row">
          <input class="adm-in" data-el="ntfText" maxlength="150" placeholder="Bildirim metni">
          <button class="adm-btn p" data-a="ntfSend">Gönder</button>
        </div>
      </div>
      <div class="adm-sec"><div class="adm-lbl">✏️ NİCK ZORLA DEĞİŞTİR</div>
        <div class="adm-row">
          <input class="adm-in" data-el="nNick" maxlength="16" placeholder="Yeni nick" autocapitalize="off">
          <button class="adm-btn p" data-a="forcenick">Değiştir</button>
        </div>
      </div>

      <div class="adm-sec"><div class="adm-lbl">🚫 BAN / 🔇 MUTE</div>
        <div class="adm-row">
          <select class="adm-in" data-el="dur">
            <option value="3600000">1 saat</option><option value="86400000">1 gün</option>
            <option value="604800000">7 gün</option><option value="0">KALICI</option>
          </select>
          <input class="adm-in" data-el="reason" placeholder="Sebep" maxlength="80">
        </div>
        <div class="adm-row">
          <button class="adm-btn p" style="flex:1" data-a="kick">🦵 Oyundan At</button>
          <button class="adm-btn ${p.isVice?'g':'p'}" style="flex:1" data-a="vice">${p.isVice?'⭐ Vice Kaldır':'⭐ Vice Yap'}</button>
          <button class="adm-btn p" style="flex:1" data-a="op" data-el="opBtn">🔧 OP…</button>
        </div>
        <div class="adm-row">
          ${banned
            ? '<button class="adm-btn g" data-a="unban">✅ Banı Kaldır</button>'
            : '<button class="adm-btn r" data-a="ban">🚫 Banla</button>'}
          ${muted
            ? '<button class="adm-btn g" data-a="unmute">✅ Susturmayı Kaldır</button>'
            : '<button class="adm-btn r" data-a="mute">🔇 Sustur</button>'}
        </div>
      </div>

      <div class="adm-sec" style="border:1px solid rgba(255,82,82,.25);border-radius:10px;padding:8px">
        <div class="adm-lbl" style="color:#ff8fa0">☢️ TEHLİKELİ BÖLGE — KALICI SİLME</div>
        <div style="font-size:10px;color:#6d7aa8;margin-bottom:6px">Bu işlemler GERİ ALINAMAZ. Silinen veriler kurtarılamaz.</div>
        <button class="adm-acc" data-a="deldetail" style="width:100%;margin-bottom:4px">🗂 Silinecekler <span>▾</span></button>
        <div data-el="deldetail" style="display:none;font-size:10px;color:#9fb0d8;padding:4px 0;line-height:1.8">
          ☑ users/${esc(uid)} (profil, nick, kaju, avatar…)<br>
          ☑ nicks/ (nick kayıt defteri)<br>
          ☑ presence/${esc(uid)} (çevrimiçi durum)<br>
          ☑ friends/${esc(uid)} (arkadaş listesi)<br>
          ☑ userNotifs/${esc(uid)} (bildirimler)<br>
          ☑ gameLB/${esc(uid)} (oyun liderliği)<br>
          ☑ leaderboard/kaju/${esc(uid)}<br>
          ☑ seasons/* (sezon puanları)<br>
          ☑ shopInventory/${esc(uid)} (envanter)<br>
          ☑ kozmos/${esc(uid)} (kozmos)<br>
          ☑ outbox/${esc(uid)}<br>
          ☑ adminForcedNick/${esc(uid)}<br>
          ☑ kicks/${esc(uid)}<br>
        </div>
        <div class="adm-row" style="gap:6px;margin-top:4px">
          <button class="adm-btn r" style="flex:1" data-a="resetProgress">🔄 İlerlemeyi Sıfırla</button>
          <button class="adm-btn r" style="flex:1;background:rgba(255,50,50,.2);border-color:#ff5252" data-a="deleteUser">🗑 Hesabı Komple Sil</button>
        </div>
      </div>
    </div>`;
  const R = $(P.root,'[data-el="result"]');
  $(R,'[data-a="kaju"]').addEventListener('click', doKaju);
  $(R,'[data-a="khist"]').addEventListener('click', toggleKHist);
  $(R,'[data-a="forcenick"]').addEventListener('click', doForceNick);
  $(R,'[data-a="ntfSend"]').addEventListener('click', sendUserNotif);
  $(R,'[data-a="kick"]').addEventListener('click', doKick);
  $(R,'[data-a="vice"]').addEventListener('click', doVice);
  const ipb = $(R,'[data-a="ipban"]'); if(ipb) ipb.addEventListener('click', doIPBan);
  checkTargetIPBan();
  const opb = $(R,'[data-a="op"]'); if(opb){ opb.addEventListener('click', doOP); refreshOPBtn(); }
  const bb = $(R,'[data-a="ban"]'), ub = $(R,'[data-a="unban"]');
  const mb = $(R,'[data-a="mute"]'), um = $(R,'[data-a="unmute"]');
  if(bb) bb.addEventListener('click', () => doBan(true));
  if(ub) ub.addEventListener('click', () => doBan(false));
  if(mb) mb.addEventListener('click', () => doMute(true));
  if(um) um.addEventListener('click', () => doMute(false));
  // Silme butonları
  const delBtn = $(R,'[data-a="deleteUser"]');
  const resetBtn = $(R,'[data-a="resetProgress"]');
  const detailBtn = $(R,'[data-a="deldetail"]');
  if(detailBtn) detailBtn.addEventListener('click', () => {
    const d = $(R,'[data-el="deldetail"]');
    if(d) d.style.display = d.style.display === 'none' ? '' : 'none';
  });
  if(resetBtn) resetBtn.addEventListener('click', doResetProgress);
  if(delBtn) delBtn.addEventListener('click', doDeleteUser);
}

// ── 👻 Ghost ────────────────────────────────────────────────────
async function loadGhostState(){
  try{
    const m = await import('./auth.js');
    const on = m.isGhost && m.isGhost();
    const el = $(P.root,'[data-el="ghostState"]'); if(el){ el.textContent = on ? 'AÇIK 👻' : 'KAPALI'; el.style.color = on ? '#CE93D8' : '#5fd38a'; }
    return on;
  }catch(e){ return false; }
}
// ── 👑 Admin FAB görünürlük toggle ─────────────────────────────
// ── 🔬 DEBUG MODU ───────────────────────────────────────────────
function loadDebugState(){
  const on = localStorage.getItem('hero_debug') === '1';
  const el = $(P.root,'[data-el="debugState"]');
  if(el){ el.textContent = on ? 'AÇIK 🟢' : 'KAPALI ⚫'; el.style.color = on ? '#5fd38a' : '#9fb0d8'; }
  applyDebugOverlay(on);
  return on;
}
function toggleDebugMode(){
  const on = !(localStorage.getItem('hero_debug') === '1');
  localStorage.setItem('hero_debug', on ? '1' : '0');
  loadDebugState();
  msg(on ? '🔬 Debug modu açıldı — hatalar ekranda görünecek' : '🔬 Debug modu kapatıldı', true);
}
function applyDebugOverlay(on){
  let ov = document.getElementById('__heroDebugOverlay');
  if(on){
    if(!ov){
      ov = document.createElement('div');
      ov.id = '__heroDebugOverlay';
      ov.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483646;background:rgba(0,0,0,.82);color:#0f0;font:10px/1.5 monospace;padding:5px 8px;border:1px solid #0f0;border-radius:0 0 8px 0;max-width:70vw;max-height:30vh;overflow:auto;pointer-events:none';
      document.body.appendChild(ov);
      // Global hata yakalayıcıları kur (bir kez)
      if(!window.__heroDebugHooked){
        window.__heroDebugHooked = true;
        window.addEventListener('error', e => _heroDbgErr('JS', e.message, e.error && e.error.stack));
        window.addEventListener('unhandledrejection', e => { const r=e.reason; _heroDbgErr('PROMISE', (r&&r.message)||String(r), r&&r.stack); });
      }
    }
    _heroDbgRefresh();
    if(window.__heroDbgTimer) clearInterval(window.__heroDbgTimer);
    window.__heroDbgTimer = setInterval(_heroDbgRefresh, 1500);
  } else {
    if(ov) ov.remove();
    if(window.__heroDbgTimer){ clearInterval(window.__heroDbgTimer); window.__heroDbgTimer = null; }
  }
}
function _heroDbgErr(kind, m, stack){
  window.__heroDbgErrors = window.__heroDbgErrors || [];
  window.__heroDbgErrors.unshift('✗ ['+kind+'] '+m + (stack ? ' | '+stack.split(String.fromCharCode(10))[1] : ''));
  if(window.__heroDbgErrors.length > 6) window.__heroDbgErrors.pop();
}
function _heroDbgRefresh(){
  const ov = document.getElementById('__heroDebugOverlay'); if(!ov) return;
  let st = {}; try{ st = Auth.getState(); }catch(e){}
  const errs = window.__heroDbgErrors || [];
  const guestEl = document.getElementById('authGuest');
  const userEl = document.getElementById('authUser');
  ov.innerHTML = '<b style="color:#0ff">🔬 DEBUG</b> '
    + 'status=' + (st.status||'?')
    + ' uid=' + (st.uid ? st.uid.slice(0,6) : 'YOK')
    + ' adm=' + (st.isAdmin===true?'E':'H') + '<br>'
    + 'guest=' + (guestEl ? (guestEl.style.display||'def') : '?')
    + ' user=' + (userEl ? (userEl.style.display||'def') : '?') + '<br>'
    + (errs.length ? '<span style="color:#ff6b8a">'+errs.join('<br>')+'</span>' : '<span style="color:#5fd38a">hata yok ✓</span>');
}

// ── 🩺 TAM SİSTEM CHECK-UP ───────────────────────────────────────
async function runSystemCheckup(){
  const box = $(P.root,'[data-el="checkup"]');
  if(!box) return;
  box.style.display = '';
  box.innerHTML = '<div style="color:#4dd0e1">🩺 Check-up çalışıyor…</div>';
  const lines = [];
  const ok  = (t) => lines.push('<div style="color:#5fd38a">✓ '+t+'</div>');
  const bad = (t) => lines.push('<div style="color:#ff6b8a;font-weight:bold">✗ '+t+'</div>');
  const inf = (t) => lines.push('<div style="color:#9fb0d8">• '+t+'</div>');

  // 1. Auth durumu
  let st = {};
  try{ st = Auth.getState(); ok('Auth.getState() çalışıyor'); }catch(e){ bad('Auth.getState HATA: '+e.message); }
  inf('status = '+(st.status||'?')+' | uid = '+(st.uid?st.uid.slice(0,10):'YOK')+' | admin = '+(st.isAdmin===true));

  // 2. DOM elementleri (login ekranı)
  const guestEl = document.getElementById('authGuest');
  const userEl = document.getElementById('authUser');
  if(guestEl) ok('authGuest elementi var → display: '+(guestEl.style.display||'default')); else bad('authGuest elementi YOK');
  if(userEl) ok('authUser elementi var → display: '+(userEl.style.display||'default')); else bad('authUser elementi YOK');
  // Login state tutarlılığı
  if(st.status === 'google'){
    if(guestEl && guestEl.style.display !== 'none') bad('TUTARSIZ: giriş yapıldı ama login ekranı görünür! (render hatası)');
    if(userEl && userEl.style.display === 'none') bad('TUTARSIZ: giriş yapıldı ama kullanıcı paneli gizli!');
    if(guestEl && guestEl.style.display === 'none' && userEl && userEl.style.display !== 'none') ok('Login UI tutarlı (giriş paneli doğru gösteriliyor)');
  }

  // 3. Store
  try{ const Store = (await import('./store.js')).default || (await import('./store.js')).Store; const ss = Store.getState(); ok('Store.getState() OK → kaju:'+(ss.kaju||0)+' lvl:'+(ss.level||1)); }catch(e){ bad('Store HATA: '+e.message); }

  // 4. Kritik modüller yüklenebiliyor mu
  const mods = ['ui.js','nav.js','profile.js','social.js','clan.js','store.js','auth.js','kozmos.js'];
  for(const mod of mods){
    try{ await import('./'+mod+'?chk='+Date.now()); ok(mod+' yükleniyor'); }
    catch(e){ bad(mod+' → '+e.message); }
  }

  // 5. Firebase bağlantısı
  try{
    const snap = await fdb.get(fdb.ref(db, '.info/connected'));
    ok('Firebase DB erişilebilir');
  }catch(e){ bad('Firebase HATA: '+e.message); }

  // 6. Kullanıcı verisi
  if(st.uid){
    try{ const us = await fdb.get(fdb.ref(db,'users/'+st.uid)); if(us.exists()){ const u=us.val(); ok('Kullanıcı kaydı var → nick:'+(u.nick||u.name||'?')); } else bad('users/'+st.uid.slice(0,8)+' kaydı YOK'); }
    catch(e){ bad('Kullanıcı verisi HATA: '+e.message); }
  }

  // 7. localStorage sağlık
  try{
    const keys = ['hero_set_fabs','hero_admfab_hidden','hero_debug','hero_ui_scale','hero_glow_style'];
    const vals = keys.map(k => k+'='+(localStorage.getItem(k)||'∅')).join(' ');
    inf('localStorage: '+vals);
    ok('localStorage erişilebilir');
  }catch(e){ bad('localStorage HATA: '+e.message); }

  // 8. Bilinen hatalar (debug overlay'den)
  const errs = window.__heroDbgErrors || [];
  if(errs.length){ errs.forEach(er => bad('Yakalanan: '+er)); }
  else inf('Çalışma anında yakalanan hata yok (debug açıksa)');

  // 9. Service Worker
  if('serviceWorker' in navigator){
    try{ const regs = await navigator.serviceWorker.getRegistrations(); inf('Service Worker: '+regs.length+' kayıt'); ok('SW API erişilebilir'); }
    catch(e){ bad('SW HATA: '+e.message); }
  }

  lines.push('<div style="color:#FFD740;margin-top:6px;font-weight:bold">── Check-up tamamlandı ──</div>');
  box.innerHTML = lines.join('');
}

function loadAdminFabState(){
  const hidden = localStorage.getItem('hero_admfab_hidden') === '1';
  const el = $(P.root,'[data-el="admFabState"]');
  if(el){ el.textContent = hidden ? 'GİZLİ 🙈' : 'GÖRÜNÜR 👁'; el.style.color = hidden ? '#ff8fa0' : '#5fd38a'; }
  // FAB gizlenince tamamen kaybolmaz — %18 opak küçük buton olarak kalır (panele girebilmek için)
  const fab = document.getElementById('adminFloatBtn');
  if(fab){
    fab.style.display = 'grid';
    fab.style.opacity = hidden ? '0.18' : '';
    fab.style.transform = hidden ? 'scale(0.52)' : '';
    fab.title = hidden ? 'Admin paneli (gizli mod)' : '';
  }
  return hidden;
}
function toggleAdminFab(){
  const hidden = !( localStorage.getItem('hero_admfab_hidden') === '1' );
  localStorage.setItem('hero_admfab_hidden', hidden ? '1' : '0');
  loadAdminFabState();
  msg(hidden ? '👑 Admin FAB gizlendi' : '👑 Admin FAB gösteriliyor', true);
}

async function toggleGhost(){
  try{
    const m = await import('./auth.js');
    const on = !(m.isGhost && m.isGhost());
    await m.setGhost(on);
    await loadGhostState();
    msg(on ? '✓ Ghost AÇIK — çevrimiçi listelerde görünmezsin 👻' : '✓ Ghost kapalı — tekrar görünürsün', true);
    logAdmin(on ? 'ghost-ac' : 'ghost-kapat', '', '');
  }catch(e){ msg('✗ Yapılamadı', false); }
}

// ── 🌐 IP ban / liste ───────────────────────────────────────────
let _ipKey = null;
async function ipKeyOf(ip){ const m = await import('./auth.js'); return m.ipKey(ip); }
async function checkTargetIPBan(){
  const p = P.target && P.target.profile; if(!p || !p.lastIP) return;
  try{
    const k = await ipKeyOf(p.lastIP);
    const snap = await fdb.get(fdb.ref(db, 'ipBans/' + k));
    const el = $(P.root,'[data-el="ipBanState"]'); const btn = $(P.root,'[data-a="ipban"]');
    if(snap.exists()){
      if(el) el.innerHTML = '<span class="adm-tag ban">IP BANLI</span>';
      if(btn){ btn.textContent = 'IP Banı Kaldır'; btn.className = 'adm-btn g'; btn.style.cssText='padding:4px 9px;font-size:10px'; _ipKey = k; }
    } else { _ipKey = null; }
  }catch(e){}
}
async function doIPBan(){
  const p = P.target.profile; if(!p.lastIP) return;
  const k = await ipKeyOf(p.lastIP);
  try{
    if(_ipKey){   // kaldır
      await fdb.set(fdb.ref(db, 'ipBans/' + k), null);
      msg('✓ IP banı kaldırıldı', true); logAdmin('ipban-kaldir', P.target.uid, p.lastIP);
    } else {
      const reason = $(P.root,'[data-el="reason"]').value.trim() || 'Yönetici kararı';
      if(!confirm('Bu IP ENGELLENECEK: ' + p.lastIP + '\n(Bu IP\'den giren TÜM hesaplar kilitlenir)\nSebep: ' + reason)) return;
      await fdb.set(fdb.ref(db, 'ipBans/' + k), { ip: p.lastIP, reason, by: Auth.getState().uid, ts: Date.now() });
      msg('✓ IP banlandı 🌐', true); logAdmin('ipban', P.target.uid, p.lastIP + ' · ' + reason);
    }
    renderTarget();
  }catch(e){ msg('✗ Yapılamadı — kurallar v526 mı?', false); }
}
async function toggleIPBans(){
  const box = $(P.root,'[data-el="ipbans"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.ref(db, 'ipBans'));
    if(!snap.exists()){ box.innerHTML = '<i>IP yasağı yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ key: ch.key, ...ch.val() }); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(r => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(r.ip || r.key)}</b><span style="flex:1">${esc(r.reason || '')}</span>
        <button class="adm-btn g" style="flex:0;padding:4px 9px;font-size:10px" data-ipun="${esc(r.key)}">Kaldır</button>
      </div>`).join('');
    box.querySelectorAll('[data-ipun]').forEach(btn => btn.addEventListener('click', async () => {
      try{ await fdb.set(fdb.ref(db, 'ipBans/' + btn.dataset.ipun), null); btn.closest('.adm-li').remove(); logAdmin('ipban-kaldir', '', btn.dataset.ipun); }catch(e){ msg('✗ Kaldırılamadı', false); }
    }));
  }catch(e){ box.innerHTML = '<i>Okunamadı — kurallar v526 mı?</i>'; }
}

// ── 🚷 Nick yasakları ───────────────────────────────────────────
function nbKey(n){ return nickKeySafe(n); }
async function toggleNickBans(){
  const box = $(P.root,'[data-el="nickbans"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = '';
  refreshNickBans();
}
async function refreshNickBans(){
  const list = $(P.root,'[data-el="nbList"]'); if(!list) return;
  list.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.ref(db, 'nickBans'));
    if(!snap.exists()){ list.innerHTML = '<i>Yasaklı nick yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ key: ch.key, ...ch.val() }); });
    list.innerHTML = rows.map(r => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(r.nick || r.key)}</b>
        <button class="adm-btn g" style="flex:0;margin-left:auto;padding:4px 9px;font-size:10px" data-nbun="${esc(r.key)}">Kaldır</button>
      </div>`).join('');
    list.querySelectorAll('[data-nbun]').forEach(btn => btn.addEventListener('click', async () => {
      try{ await fdb.set(fdb.ref(db, 'nickBans/' + btn.dataset.nbun), null); btn.closest('.adm-li').remove(); logAdmin('nickban-kaldir', '', btn.dataset.nbun); }catch(e){ msg('✗ Kaldırılamadı', false); }
    }));
  }catch(e){ list.innerHTML = '<i>Okunamadı — kurallar v526 mı?</i>'; }
}
async function addNickBan(){
  const inp = $(P.root,'[data-el="nbText"]'); const nick = inp.value.trim();
  if(!nick || nbKey(nick).length < 3){ msg('Geçerli bir nick yaz', false); return; }
  try{
    await fdb.set(fdb.ref(db, 'nickBans/' + nbKey(nick)), { nick, by: Auth.getState().uid, ts: Date.now() });
    try{ await fdb.set(fdb.ref(db, 'nicks/' + nbKey(nick)), null); }catch(e){}   // defterden de düşür
    inp.value = '';
    msg('✓ Nick yasaklandı: ' + nick, true); logAdmin('nickban', '', nick);
    refreshNickBans();
  }catch(e){ msg('✗ Yapılamadı — kurallar v526 mı?', false); }
}

// ── 🔧 Sohbet operatörü ─────────────────────────────────────────
async function refreshOPBtn(){
  const btn = $(P.root,'[data-el="opBtn"]'); if(!btn) return;
  try{
    const snap = await fdb.get(fdb.ref(db, 'gcOperators/' + P.target.uid));
    const on = snap.exists() && snap.val() === true;
    btn.textContent = on ? '🔧 OP Kaldır' : '🔧 OP Yap';
    btn.className = 'adm-btn ' + (on ? 'g' : 'p');
    btn.dataset.on = on ? '1' : '0';
  }catch(e){ btn.textContent = '🔧 OP?'; }
}
async function doOP(){
  const btn = $(P.root,'[data-el="opBtn"]');
  const on = btn && btn.dataset.on === '1';
  try{
    await fdb.set(fdb.ref(db, 'gcOperators/' + P.target.uid), on ? null : true);
    msg(on ? '✓ OP yetkisi kaldırıldı' : '✓ Sohbet operatörü yapıldı 🔧', true);
    logAdmin(on ? 'op-kaldir' : 'op-yap', P.target.uid, '');
    refreshOPBtn();
  }catch(e){ msg('✗ Yapılamadı', false); }
}

// ── 🧹 Kopya/Yetim defter temizliği ─────────────────────────────
async function cleanRegistry(){
  if(!confirm('nicks/ defteri taranacak:\n• Aynı oyuncunun KOPYA kayıtları (eski nickler) silinir\n• Sahibi olmayan YETİM kayıtlar silinir\nDevam?')) return;
  msg('Defter taranıyor…', true);
  let nicks = {}, users = {};
  try{
    const ns = await fdb.get(fdb.ref(db, 'nicks')); nicks = ns.exists() ? ns.val() : {};
    const us = await fdb.get(fdb.ref(db, 'users')); users = us.exists() ? us.val() : {};
  }catch(e){ msg('✗ Okunamadı', false); return; }
  const keys = Object.keys(nicks);
  const byUid = {};
  keys.forEach(k => { const u = nicks[k] && nicks[k].uid; if(u){ (byUid[u] = byUid[u] || []).push(k); } });
  let dupDel = 0, orphanDel = 0;
  for(const uid of Object.keys(byUid)){
    const ks = byUid[uid];
    const prof = users[uid];
    if(!prof){   // yetim: kullanıcı yok
      for(const k of ks){ try{ await fdb.set(fdb.ref(db, 'nicks/' + k), null); orphanDel++; }catch(e){} }
      continue;
    }
    if(ks.length <= 1) continue;
    const want = nickKeySafe(prof.nick || prof.name || prof.displayName || '');
    const keep = ks.includes(want) ? want : ks[0];
    for(const k of ks){ if(k !== keep){ try{ await fdb.set(fdb.ref(db, 'nicks/' + k), null); dupDel++; }catch(e){} } }
  }
  msg(`✓ Temizlik bitti: ${dupDel} kopya + ${orphanDel} yetim silindi (${keys.length} kayıt tarandı)`, true);
  logAdmin('defter-temizlik', '', `kopya:${dupDel} yetim:${orphanDel}`);
}

// ── 🗑 Hesap Silme + 🔄 İlerleme Sıfırlama ──────────────────────

// Silinecek tüm node'lar
function _deleteNodes(uid){
  return [
    'users/' + uid,
    'presence/' + uid,
    'friends/' + uid,
    'userNotifs/' + uid,
    'outbox/' + uid,
    'adminForcedNick/' + uid,
    'kicks/' + uid,
    'shopInventory/' + uid,
    'shopPurchases/' + uid,
    'kozmos/' + uid,
    'kozmoPending/' + uid,
    'leaderboard/kaju/' + uid,
    'leaderboard/games/' + uid,
    'gameLB/' + uid,
    'gameLeaderboard/all/' + uid,
    'userInbox/' + uid,
  ];
}

async function doResetProgress(){
  const { uid, profile: p } = P.target;
  if(p.isAdmin){ msg('✗ Admin hesabının ilerlemesi sıfırlanamaz', false); return; }
  const nick = p.nick || p.name || p.displayName || uid.slice(0,8);
  if(!confirm(`"${nick}" kullanıcısının İLERLEMESİ sıfırlanacak:\n\n• Kaju: 0\n• Level: 1 / XP: 0\n• Kaju geçmişi silinir\n• Oyun liderliği silinir\n• Sezon puanları silinir\n\nProfil ve nick KORUNUR. GERİ ALINAMAZ!`)) return;
  msg('Sıfırlanıyor…', true);
  try{
    // users/{uid} içindeki ilerleme alanlarını sıfırla
    await fdb.update(fdb.ref(db, 'users/' + uid), {
      kaju: 0, kajuUpdAt: null, kajuSent: null,
      level: 1, xp: { level:1, xp:0, totalXP:0 },
      bestScores: null, kelimeRecords: null,
      lastSeen: null
    });
    // kaju_history sil
    await fdb.set(fdb.ref(db, 'users/' + uid + '/kaju_history'), null);
    // Liderlik kayıtları sil
    const lbNodes = [
      'leaderboard/kaju/' + uid,
      'leaderboard/games/' + uid,
      'gameLB/' + uid,
      'gameLeaderboard/all/' + uid,
    ];
    await Promise.all(lbNodes.map(n => fdb.set(fdb.ref(db, n), null).catch(()=>{})));
    // Sezon puanları sil (tüm sezonlar)
    try{
      const seasons = await fdb.get(fdb.ref(db, 'seasons'));
      if(seasons.exists()){
        const dels = [];
        seasons.forEach(s => { dels.push(fdb.set(fdb.ref(db, 'seasons/' + s.key + '/' + uid), null)); });
        await Promise.all(dels.map(d => d.catch(()=>{})));
      }
    }catch(e){}
    P.target.profile.kaju = 0;
    P.target.profile.level = 1;
    P.target.profile.xp = { level:1, xp:0, totalXP:0 };
    msg(`✓ "${nick}" ilerlemesi sıfırlandı`, true);
    logAdmin('ilerleme-sifirla', uid, nick);
    renderTarget();
  }catch(e){ msg('✗ Sıfırlanamadı: ' + (e.message||e), false); }
}

async function doDeleteUser(){
  const { uid, profile: p } = P.target;
  if(p.isAdmin){ msg('✗ Admin hesabı silinemez', false); return; }
  const nick = p.nick || p.name || p.displayName || uid.slice(0,8);
  if(!confirm(`"${nick}" KOMPLE SİLİNECEK!\n\nProfil, kaju, level, XP, arkadaş listesi,\nbildirimler, envanter, kozmos, liderlik\nkayıtları dahil TÜM veriler silinir.\n\nBu işlem GERİ ALINAMAZ!\n\nEmin misin?`)) return;
  if(!confirm(`SON ONAY: "${nick}" (${uid.slice(0,12)}…) silinsin mi?`)) return;
  msg('Siliniyor…', true);
  try{
    // Nick'i kayıt defterinden sil
    if(p.nick){
      const nk = String(p.nick).replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase();
      await fdb.set(fdb.ref(db, 'nicks/' + nk), null).catch(()=>{});
    }
    if(p.name && p.name !== p.nick){
      const nk2 = String(p.name).replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase();
      await fdb.set(fdb.ref(db, 'nicks/' + nk2), null).catch(()=>{});
    }
    // Klan üyeliğini sil
    if(p.clanId){
      await fdb.set(fdb.ref(db, 'clans/' + p.clanId + '/members/' + uid), null).catch(()=>{});
    }
    // Sezon puanlarını sil
    try{
      const seasons = await fdb.get(fdb.ref(db, 'seasons'));
      if(seasons.exists()){
        const dels = [];
        seasons.forEach(s => { dels.push(fdb.set(fdb.ref(db, 'seasons/' + s.key + '/' + uid), null)); });
        await Promise.all(dels.map(d => d.catch(()=>{})));
      }
    }catch(e){}
    // Tüm node'ları sil
    const nodes = _deleteNodes(uid);
    await Promise.all(nodes.map(n => fdb.set(fdb.ref(db, n), null).catch(()=>{})));
    // Cache'den kaldır
    _allUsersCache = _allUsersCache.filter(u => u.uid !== uid);
    const countEl = $(P.root,'[data-el="ucount"]');
    if(countEl) countEl.textContent = '(' + _allUsersCache.length + ')';
    // Sonuç panelini temizle
    $(P.root,'[data-el="result"]').innerHTML = `<div style="padding:12px;color:#5fd38a;text-align:center">✓ "${esc(nick)}" silindi</div>`;
    P.target = null;
    msg(`✓ "${nick}" komple silindi`, true);
    logAdmin('kullanici-sil', uid, nick + ' · ' + uid);
  }catch(e){ msg('✗ Silinemedi: ' + (e.message||e), false); }
}

// ── 🦵 Oyuncuyu at + ⭐ Vice ─────────────────────────────────────
async function doKick(){
  const reason = $(P.root,'[data-el="reason"]').value.trim() || 'Yönetici kararı';
  if(!confirm('Oyuncu OYUNDAN ATILACAK (oturumu yenilenir).\nSebep: ' + reason + '\nOnaylıyor musun?')) return;
  try{
    await fdb.set(fdb.ref(db, 'kicks/' + P.target.uid), { ts: Date.now(), by: Auth.getState().uid, reason });
    msg('✓ Atıldı 🦵', true); logAdmin('kick', P.target.uid, reason);
  }catch(e){ msg('✗ Yapılamadı', false); }
}
async function doVice(){
  const now = P.target.profile.isVice === true;
  try{
    await fdb.set(fdb.ref(db, 'users/' + P.target.uid + '/isVice'), now ? null : true);
    P.target.profile.isVice = !now;
    msg(now ? '✓ Vice kaldırıldı' : '✓ Vice yapıldı ⭐', true);
    logAdmin(now ? 'vice-kaldir' : 'vice-yap', P.target.uid, '');
    renderTarget();
  }catch(e){ msg('✗ Yapılamadı', false); }
}

// ── 🔔 Oyuncuya bildirim gönder ─────────────────────────────────
async function sendUserNotif(){
  const inp = $(P.root,'[data-el="ntfText"]');
  const text = inp.value.trim();
  if(!text){ msg('Bildirim metni boş', false); return; }
  try{
    await fdb.push(fdb.ref(db, 'userNotifs/' + P.target.uid), { icon:'📩', text: text.slice(0,150), ts: Date.now(), from:'admin' });
    inp.value = '';
    msg('✓ Bildirim gönderildi 🔔', true);
    logAdmin('bildirim', P.target.uid, text.slice(0, 60));
  }catch(e){ msg('✗ Gönderilemedi', false); }
}

// ── Kaju ± ──────────────────────────────────────────────────────
async function doKaju(){
  const v = Math.floor(Number($(P.root,'[data-el="kAmt"]').value.trim()));
  if(!Number.isFinite(v) || v === 0){ msg('Geçerli miktar gir (örn. 500 veya -500)', false); return; }
  msg('Uygulanıyor…', true);
  const r = await Store.adminAdjustKaju(P.target.uid, v, 'admin-panel');
  if(!r.ok){ msg('✗ ' + r.error, false); return; }
  P.target.profile.kaju = r.newBalance;
  $(P.root,'[data-el="kaju"]').textContent = fmt(r.newBalance);
  msg(`✓ Yeni bakiye: ${fmt(r.newBalance)}`, true);
  logAdmin(v > 0 ? 'kaju-ekle' : 'kaju-eksilt', P.target.uid, v + ' → ' + r.newBalance);
}

async function toggleKHist(){
  const box = $(P.root,'[data-el="khist"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'users/' + P.target.uid + '/kaju_history'), fdb.limitToLast(15)));
    if(!snap.exists()){ box.innerHTML = '<i>Kayıt yok</i>'; return; }
    const rows = []; snap.forEach(ch => { const v = ch.val(); rows.push(v); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(v =>
      `<div class="adm-li"><span>${new Date(v.ts).toLocaleString('tr-TR')}</span> <b class="${v.amount>=0?'ok':'bad'}">${v.amount>=0?'+':''}${fmt(v.amount)}</b> <span>${esc(v.type||'')} · ${esc(v.reason||'')}</span></div>`
    ).join('');
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

// ── Nick zorla değiştir ─────────────────────────────────────────
function nickKey(n){ return String(n||'').replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase(); }
async function doForceNick(){
  const want = $(P.root,'[data-el="nNick"]').value.trim();
  const v = Auth.validateNick(want);
  if(!v.ok){ msg('✗ ' + v.error, false); return; }
  const uid = P.target.uid;
  const newKey = nickKey(v.clean);
  msg('Kontrol ediliyor…', true);
  try{
    const ex = await fdb.get(fdb.ref(db, 'nicks/' + newKey));
    if(ex.exists() && ex.val().uid !== uid){ msg('✗ Bu nick başkasında', false); return; }
    if(!confirm(`Oyuncunun nick'i "${v.clean}" yapılacak. Onaylıyor musun?`)) return;
    // 1) yeni kayıt defteri girdisi (hedef uid adına — v524 kuralı admin'e izin verir)
    await fdb.set(fdb.ref(db, 'nicks/' + newKey), { uid, nick: v.clean, ts: Date.now() });
    // 2) eski kaydı serbest bırak
    const oldNick = P.target.profile.nick;
    if(oldNick && nickKey(oldNick) !== newKey){ try{ await fdb.set(fdb.ref(db, 'nicks/' + nickKey(oldNick)), null); }catch(e){} }
    // 3) profil + zorlama işareti
    await fdb.update(fdb.ref(db, 'users/' + uid), { nick: v.clean, name: v.clean });
    await fdb.set(fdb.ref(db, 'adminForcedNick/' + uid), { nick: v.clean, by: Auth.getState().uid, ts: Date.now() });
    P.target.profile.nick = v.clean;
    msg(`✓ Nick "${v.clean}" yapıldı`, true);
    logAdmin('nick-zorla', uid, (oldNick||'—') + ' → ' + v.clean);
    renderTarget();
  }catch(e){ msg('✗ Yapılamadı — kurallar v524 mü? (nicks admin izni)', false); }
}

// ── Ban / Mute ──────────────────────────────────────────────────
function durReason(){
  const d = Number($(P.root,'[data-el="dur"]').value);
  const reason = $(P.root,'[data-el="reason"]').value.trim() || 'Belirtilmedi';
  return { d, reason, until: d > 0 ? Date.now() + d : 0, label: d > 0 ? ($(P.root,'[data-el="dur"]').selectedOptions[0].textContent) : 'KALICI' };
}
async function doBan(on){
  const uid = P.target.uid;
  if(on){
    const { reason, until, label } = durReason();
    if(!confirm(`Oyuncu ${label} BANLANACAK.\nSebep: ${reason}\nOnaylıyor musun?`)) return;
    try{
      await fdb.update(fdb.ref(db, 'users/' + uid), { banned: true, banType: until ? 'temp' : 'perma', banUntil: until || null, banMsg: reason });
      msg('✓ Banlandı (' + label + ')', true); logAdmin('ban', uid, label + ' · ' + reason);
    }catch(e){ msg('✗ Yapılamadı', false); return; }
    P.target.profile.banned = true; P.target.profile.banType = until?'temp':'perma'; P.target.profile.banUntil = until;
  } else {
    try{
      await fdb.update(fdb.ref(db, 'users/' + uid), { banned: false, banType: null, banUntil: null, banMsg: null });
      msg('✓ Ban kaldırıldı', true); logAdmin('unban', uid, '');
    }catch(e){ msg('✗ Yapılamadı', false); return; }
    P.target.profile.banned = false;
  }
  renderTarget();
}
async function doMute(on){
  const uid = P.target.uid;
  if(on){
    const { reason, until, label } = durReason();
    try{
      await fdb.update(fdb.ref(db, 'users/' + uid), { muted: true, muteUntil: until || null, muteReason: reason });
      msg('✓ Susturuldu (' + label + ')', true); logAdmin('mute', uid, label + ' · ' + reason);
    }catch(e){ msg('✗ Yapılamadı', false); return; }
    P.target.profile.muted = true; P.target.profile.muteUntil = until;
  } else {
    try{
      await fdb.update(fdb.ref(db, 'users/' + uid), { muted: false, muteUntil: null, muteReason: null });
      msg('✓ Susturma kaldırıldı', true); logAdmin('unmute', uid, '');
    }catch(e){ msg('✗ Yapılamadı', false); return; }
    P.target.profile.muted = false;
  }
  renderTarget();
}

// ── adminLog listesi ────────────────────────────────────────────
async function toggleLog(){
  const box = $(P.root,'[data-el="log"]');
  if(box.style.display !== 'none'){ box.style.display = 'none'; return; }
  box.style.display = ''; box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'adminLog'), fdb.limitToLast(20)));
    if(!snap.exists()){ box.innerHTML = '<i>Kayıt yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push(ch.val()); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(v =>
      `<div class="adm-li"><span>${new Date(v.ts).toLocaleString('tr-TR')}</span> <b>${esc(v.adminNick||'?')}</b> <span>${esc(v.action)} → ${esc((v.target||'').slice(0,10))}… ${esc(v.detail||'')}</span></div>`
    ).join('');
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

export default openAdminPanel;
