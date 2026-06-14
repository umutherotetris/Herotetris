// ══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — KLAN SİSTEMİ
//  Bölümler: klan ara / oluştur / bilgi / üyeler / sohbet / liderlik
// ══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');
const tAgo = (ts) => { const d=Date.now()-(ts||0); if(d<60e3)return'şimdi'; if(d<3600e3)return Math.floor(d/60e3)+' dk'; if(d<86400e3)return Math.floor(d/3600e3)+' sa'; return Math.floor(d/86400e3)+' g önce'; };

let C = null; // { root, myClanId, myRole, offChat, offMembers }

// ── Ekrana aç ──────────────────────────────────────────────────
export async function openClan(){
  if(document.getElementById('clanPanel')) return;
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google'){
    alert('Klan sistemi için Google ile giriş gerekli.'); return;
  }
  const ov = document.createElement('div');
  ov.id = 'clanPanel'; ov.className = 'clan-ov';
  ov.innerHTML = `
    <div class="clan-panel">
      <div class="clan-head">
        <div class="clan-title">🏰 KLANLAR</div>
        <button class="clan-x" id="clanClose">✕</button>
      </div>
      <div class="clan-body" id="clanBody"><div class="clan-load">⏳ Yükleniyor…</div></div>
    </div>`;
  document.body.appendChild(ov);
  C = { root: ov, myClanId: null, myRole: null, offChat: null, offMembers: null };
  ov.querySelector('#clanClose').addEventListener('click', closeClan);
  ov.addEventListener('click', (e) => { if(e.target === ov) closeClan(); });
  await loadMyClan();
}

function closeClan(){
  if(C){
    if(C.offChat){ try{ C.offChat(); }catch(e){} }
    if(C.offMembers){ try{ C.offMembers(); }catch(e){} }
    C = null;
  }
  document.getElementById('clanPanel')?.remove();
}

function body(){ return document.getElementById('clanBody'); }

// ── Klanım var mı? ─────────────────────────────────────────────
async function loadMyClan(){
  const st = Auth.getState();
  try{
    const snap = await fdb.get(fdb.ref(db, 'users/' + st.uid + '/clanId'));
    C.myClanId = snap.exists() ? snap.val() : null;
  }catch(e){ C.myClanId = null; }
  if(C.myClanId) renderMyClan();
  else renderNoClan();
}

// ── Klansız ekran ───────────────────────────────────────────────
function renderNoClan(){
  const b = body(); if(!b) return;
  b.innerHTML = `
    <div class="clan-card">
      <div class="clan-empty-ico">🏰</div>
      <div class="clan-empty-txt">Henüz bir klana üye değilsin</div>
    </div>
    <div class="clan-card">
      <div class="clan-lbl">🔍 KLAN ARA</div>
      <div class="clan-row">
        <input class="clan-in" id="clanSearchQ" placeholder="Klan adı veya etiketi" maxlength="20">
        <button class="clan-btn p" id="clanSearchBtn">Ara</button>
      </div>
      <div id="clanSearchRes"></div>
    </div>
    <div class="clan-card">
      <div class="clan-lbl">➕ YENİ KLAN OLUŞTUR</div>
      <input class="clan-in" id="clanNewName" placeholder="Klan adı (3–24 harf)" maxlength="24" style="margin-bottom:7px">
      <input class="clan-in" id="clanNewTag" placeholder="Etiket (#TAG, 2–5 harf)" maxlength="5" style="text-transform:uppercase;margin-bottom:7px">
      <div class="clan-msg" id="clanCreateMsg"></div>
      <button class="clan-btn p" id="clanCreateBtn" style="width:100%">🏰 Klan Kur</button>
    </div>`;
  b.querySelector('#clanSearchBtn').addEventListener('click', searchClans);
  b.querySelector('#clanSearchQ').addEventListener('keydown', (e) => { if(e.key==='Enter') searchClans(); });
  b.querySelector('#clanCreateBtn').addEventListener('click', createClan);
}

async function searchClans(){
  const q = document.getElementById('clanSearchQ').value.trim().toLowerCase();
  const res = document.getElementById('clanSearchRes'); if(!res) return;
  if(q.length < 2){ res.innerHTML = '<div class="clan-msg bad">En az 2 harf gir</div>'; return; }
  res.innerHTML = '<div class="clan-load">Aranıyor…</div>';
  try{
    const snap = await fdb.get(fdb.ref(db, 'clans'));
    if(!snap.exists()){ res.innerHTML = '<div class="clan-msg bad">Klan bulunamadı</div>'; return; }
    const all = []; snap.forEach(ch => { const v = ch.val(); if(!v) return; all.push({ id: ch.key, ...v }); });
    const hits = all.filter(c => (c.name||'').toLowerCase().includes(q) || (c.tag||'').toLowerCase().includes(q)).slice(0,8);
    if(!hits.length){ res.innerHTML = '<div class="clan-msg bad">Sonuç yok</div>'; return; }
    res.innerHTML = hits.map(c => `
      <div class="clan-res" data-cid="${esc(c.id)}">
        <div>
          <b style="color:#ffd86b">[${esc(c.tag||'?')}] ${esc(c.name||'Klan')}</b>
          <div style="font-size:10px;color:#8d9ac4">👥 ${Object.keys(c.members||{}).length} üye · 💰 ${fmt(c.kaju)} kaju</div>
        </div>
        <button class="clan-btn p" style="padding:7px 13px" data-join="${esc(c.id)}">Katıl</button>
      </div>`).join('');
    res.querySelectorAll('[data-join]').forEach(btn => btn.addEventListener('click', () => joinClan(btn.dataset.join)));
  }catch(e){ res.innerHTML = '<div class="clan-msg bad">Okunamadı</div>'; }
}

async function createClan(){
  const name = document.getElementById('clanNewName').value.trim();
  const tag = document.getElementById('clanNewTag').value.trim().toUpperCase().replace(/[^A-Z0-9İÇŞĞÜÖ]/gi,'');
  const msgEl = document.getElementById('clanCreateMsg');
  if(name.length < 3){ msgEl.textContent = 'Klan adı en az 3 harf'; msgEl.className='clan-msg bad'; return; }
  if(tag.length < 2 || tag.length > 5){ msgEl.textContent = 'Etiket 2–5 harf olmalı'; msgEl.className='clan-msg bad'; return; }
  const st = Auth.getState();
  msgEl.textContent = 'Oluşturuluyor…'; msgEl.className='clan-msg ok';
  try{
    const clanId = 'c' + Date.now() + '_' + Math.floor(Math.random()*10000);
    const now = Date.now();
    const clanData = { name, tag, leader: st.uid, members:{ [st.uid]: { name: st.displayName||'Oyuncu', role:'leader', joinedAt: now } }, kaju:0, wins:0, createdAt: now };
    await fdb.set(fdb.ref(db, 'clans/' + clanId), clanData);
    await fdb.update(fdb.ref(db, 'users/' + st.uid), { clanId });
    C.myClanId = clanId;
    renderMyClan();
  }catch(e){ msgEl.textContent = '✗ Oluşturulamadı: ' + (e.message||e); msgEl.className='clan-msg bad'; }
}

async function joinClan(clanId){
  const st = Auth.getState();
  try{
    const now = Date.now();
    await fdb.update(fdb.ref(db, 'clans/' + clanId + '/members/' + st.uid), { name: st.displayName||'Oyuncu', role:'member', joinedAt: now });
    await fdb.update(fdb.ref(db, 'users/' + st.uid), { clanId });
    C.myClanId = clanId;
    renderMyClan();
  }catch(e){ alert('Katılım başarısız: ' + (e.message||e)); }
}

// ── Klanim ekranı ───────────────────────────────────────────────
let _clanData = null;
async function renderMyClan(){
  const b = body(); if(!b) return;
  b.innerHTML = '<div class="clan-load">⏳ Yükleniyor…</div>';
  try{
    const snap = await fdb.get(fdb.ref(db, 'clans/' + C.myClanId));
    if(!snap.exists()){ await leaveClanClean(); return; }
    _clanData = snap.val() || {};
    const st = Auth.getState();
    C.myRole = _clanData.leader === st.uid ? 'leader' : (_clanData.viceLeaders && _clanData.viceLeaders[st.uid]) ? 'vice' : 'member';
    const members = Object.keys(_clanData.members || {});
    b.innerHTML = `
      <div class="clan-card clan-banner">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="clan-badge">${esc(_clanData.tag||'?')}</div>
          <div>
            <div style="font-size:16px;font-weight:900;color:#ffd86b">${esc(_clanData.name||'Klan')}</div>
            <div style="font-size:11px;color:#aab6da">👥 ${members.length} üye · 💰 ${fmt(_clanData.kaju)} · 🏆 ${fmt(_clanData.wins)} galibiyet</div>
          </div>
        </div>
        <div class="clan-tabs" style="margin-top:11px">
          <button class="clan-tab active" data-ct="members">👥 Üyeler</button>
          <button class="clan-tab" data-ct="chat">💬 Sohbet</button>
          <button class="clan-tab" data-ct="leader">🏆 Liderlik</button>
          ${C.myRole==='leader'?'<button class="clan-tab" data-ct="manage">⚙️ Yönet</button>':''}
        </div>
      </div>
      <div id="clanTabBody"></div>
      <button class="clan-btn r" id="clanLeaveBtn" style="width:100%;margin-top:8px">🚪 Klandan Ayrıl</button>`;
    b.querySelectorAll('.clan-tab').forEach(t => t.addEventListener('click', () => {
      b.querySelectorAll('.clan-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active'); loadClanTab(t.dataset.ct);
    }));
    b.querySelector('#clanLeaveBtn').addEventListener('click', leaveClan);
    loadClanTab('members');
    listenClanMembers();
  }catch(e){ b.innerHTML = `<div class="clan-msg bad">Klan yüklenemedi</div>`; }
}

function loadClanTab(tab){
  if(tab==='members') renderClanMembers();
  else if(tab==='chat') renderClanChat();
  else if(tab==='leader') renderClanLeaderboard();
  else if(tab==='manage') renderClanManage();
}

// ── Üyeler ─────────────────────────────────────────────────────
function listenClanMembers(){
  if(C.offMembers){ try{ C.offMembers(); }catch(e){} }
  C.offMembers = fdb.onValue(fdb.ref(db, 'clans/' + C.myClanId + '/members'), (snap) => {
    if(!snap.exists()) return;
    if(_clanData) _clanData.members = snap.val();
    const act = document.querySelector('.clan-tab.active');
    if(act && act.dataset.ct === 'members') renderClanMembers();
  });
}

function renderClanMembers(){
  const box = document.getElementById('clanTabBody'); if(!box) return;
  const st = Auth.getState();
  const members = _clanData && _clanData.members ? _clanData.members : {};
  const rows = Object.keys(members).map(uid => ({ uid, ...members[uid] }));
  rows.sort((a,b) => { const ro = {leader:0,vice:1,member:2}; return (ro[a.role]||2)-(ro[b.role]||2); });
  const roleLabel = { leader:'👑 Lider', vice:'💎 Yardımcı', member:'👤 Üye' };
  const roleColor = { leader:'#FFD740', vice:'#00E5FF', member:'#7d8ab8' };
  box.innerHTML = `<div class="clan-card">` + rows.map(m => {
    const isLeaderOrVice = C.myRole==='leader' || C.myRole==='vice';
    const canKick = isLeaderOrVice && m.uid !== st.uid && m.role !== 'leader';
    return `<div class="clan-member" data-muid="${esc(m.uid)}">
      <div class="clan-mava">${m.avatar||'👤'}</div>
      <div style="flex:1"><b style="color:${roleColor[m.role]||'#cdd8f5'}">${esc(m.name||'Üye')}</b>
        <div style="font-size:9px;color:#6d7aa8">${roleLabel[m.role]||'Üye'} · ${tAgo(m.joinedAt)}</div></div>
      ${canKick ? `<button class="clan-btn r" style="padding:4px 9px;font-size:10px" data-kick="${esc(m.uid)}">Çıkar</button>` : ''}
    </div>`;
  }).join('') + `</div>`;
  box.querySelectorAll('[data-muid]').forEach(el => el.addEventListener('click', async (e) => {
    if(e.target.closest('[data-kick]')) return;
    try{ const m = await import('./social.js'); m.openPlayerCard(el.dataset.muid); }catch(err){}
  }));
  box.querySelectorAll('[data-kick]').forEach(btn => btn.addEventListener('click', async () => {
    if(!confirm('Bu üye klandan çıkarılsın mı?')) return;
    try{
      await fdb.set(fdb.ref(db, 'clans/' + C.myClanId + '/members/' + btn.dataset.kick), null);
      await fdb.set(fdb.ref(db, 'users/' + btn.dataset.kick + '/clanId'), null);
    }catch(e){ alert('Çıkarılamadı'); }
  }));
}

// ── Klan Sohbeti ───────────────────────────────────────────────
function renderClanChat(){
  const box = document.getElementById('clanTabBody'); if(!box) return;
  box.innerHTML = `
    <div class="clan-card" style="padding:0;overflow:hidden">
      <div class="clan-chat" id="clanChatList"><div class="clan-load">Yükleniyor…</div></div>
      <div class="clan-row" style="padding:8px;border-top:1px solid rgba(255,255,255,.06)">
        <input class="clan-in" id="clanChatInp" placeholder="Klan sohbetine yaz…" maxlength="200">
        <button class="clan-btn p" id="clanChatSend">➤</button>
      </div>
    </div>`;
  box.querySelector('#clanChatSend').addEventListener('click', sendClanChat);
  box.querySelector('#clanChatInp').addEventListener('keydown', (e) => { if(e.key==='Enter') sendClanChat(); });
  if(C.offChat){ try{ C.offChat(); }catch(e){} }
  C.offChat = fdb.onValue(fdb.query(fdb.ref(db, 'clans/' + C.myClanId + '/chat'), fdb.limitToLast(40)), (snap) => {
    const list = document.getElementById('clanChatList'); if(!list) return;
    const me = Auth.getState().uid;
    const rows = []; if(snap.exists()) snap.forEach(ch => { rows.push(ch.val()); });
    rows.sort((a,b) => (a.ts||0)-(b.ts||0));
    if(!rows.length){ list.innerHTML = '<div class="clan-load" style="color:#5d6890">İlk mesajı sen yaz! 🏰</div>'; return; }
    list.innerHTML = rows.map(m => `
      <div class="clan-chat-row${m.uid===me?' mine':''}">
        <div class="clan-chat-ava">${m.avatar||'👤'}</div>
        <div><div style="font-size:10px;font-weight:800;color:${m.uid===me?'#00E5FF':'#A78BFA'}">${esc(m.name||'Üye')}</div>
          <div style="font-size:12px;color:#c4c4e0">${esc(m.text)}</div>
          <div style="font-size:8px;color:#505074">${tAgo(m.ts)}</div></div>
      </div>`).join('');
    list.scrollTop = list.scrollHeight;
  });
}

async function sendClanChat(){
  const inp = document.getElementById('clanChatInp'); if(!inp) return;
  const text = inp.value.trim(); if(!text) return;
  const st = Auth.getState();
  inp.value = '';
  try{
    await fdb.push(fdb.ref(db, 'clans/' + C.myClanId + '/chat'), { uid: st.uid, name: st.displayName||'Üye', avatar: (st.profile&&st.profile.avatar)||'👤', text: text.slice(0,200), ts: Date.now() });
  }catch(e){ alert('Gönderilemedi'); }
}

// ── Klan Liderliği ─────────────────────────────────────────────
async function renderClanLeaderboard(){
  const box = document.getElementById('clanTabBody'); if(!box) return;
  box.innerHTML = '<div class="clan-card"><div class="clan-load">Yükleniyor…</div></div>';
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'clans'), fdb.orderByChild('kaju'), fdb.limitToLast(20)));
    if(!snap.exists()){ box.innerHTML = '<div class="clan-card"><i>Henüz klan yok</i></div>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ id: ch.key, ...ch.val() }); });
    rows.sort((a,b) => (b.kaju||0)-(a.kaju||0));
    box.innerHTML = `<div class="clan-card">` + rows.map((c,i) => {
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      return `<div class="clan-res ${c.id===C.myClanId?'mine':''}">
        <div>${medal} <b style="color:${c.id===C.myClanId?'#00E5FF':'#ffd86b'}">[${esc(c.tag||'?')}] ${esc(c.name||'Klan')}</b></div>
        <span style="font-size:11px;color:#ffd86b">💰 ${fmt(c.kaju)}</span>
      </div>`;
    }).join('') + `</div>`;
  }catch(e){ box.innerHTML = '<div class="clan-card"><i>Okunamadı</i></div>'; }
}

// ── Lider yönetim sekmesi ───────────────────────────────────────
function renderClanManage(){
  const box = document.getElementById('clanTabBody'); if(!box) return;
  box.innerHTML = `
    <div class="clan-card">
      <div class="clan-lbl">📣 KLAN DUYURUSU</div>
      <div class="clan-row">
        <input class="clan-in" id="clanAnnInp" maxlength="150" placeholder="Klan üyelerine duyuru…">
        <button class="clan-btn p" id="clanAnnSend">Gönder</button>
      </div>
    </div>`;
  box.querySelector('#clanAnnSend').addEventListener('click', async () => {
    const inp = box.querySelector('#clanAnnInp'); const text = inp.value.trim(); if(!text) return;
    const st = Auth.getState();
    const members = _clanData && _clanData.members ? Object.keys(_clanData.members) : [];
    try{
      for(const uid of members){
        if(uid===st.uid) continue;
        await fdb.push(fdb.ref(db, 'userNotifs/' + uid), { icon:'🏰', text: '['+(_clanData.tag||'KLAN')+'] ' + text.slice(0,140), ts: Date.now() });
      }
      inp.value = ''; alert('✓ Duyuru gönderildi (' + (members.length-1) + ' üye)');
    }catch(e){ alert('Gönderilemedi'); }
  });
}

// ── Klandan ayrıl ──────────────────────────────────────────────
async function leaveClan(){
  const st = Auth.getState();
  if(!confirm(C.myRole==='leader' ? '⚠️ Lider olarak ayrılırsan klan silinecek!' : 'Klandan ayrılmak istediğine emin misin?')) return;
  await leaveClanClean();
}
async function leaveClanClean(){
  const st = Auth.getState();
  try{
    await fdb.set(fdb.ref(db, 'clans/' + C.myClanId + '/members/' + st.uid), null);
    await fdb.set(fdb.ref(db, 'users/' + st.uid + '/clanId'), null);
    if(C.myRole === 'leader'){
      // Üye kalmadıysa klanı sil
      const s = await fdb.get(fdb.ref(db, 'clans/' + C.myClanId + '/members'));
      if(!s.exists()) await fdb.set(fdb.ref(db, 'clans/' + C.myClanId), null);
    }
  }catch(e){}
  C.myClanId = null; _clanData = null;
  renderNoClan();
}

export default openClan;
