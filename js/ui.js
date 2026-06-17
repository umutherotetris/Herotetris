// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — UI RENDER (TEK BOYAYICI)
//
//  Auth durumuna ABONE olur, her değişimde profil kartını + misafir
//  banner'ını + giriş durumunu TEK fonksiyonla boyar.
//  Eski sistemin 5-6 bağımsız setInterval ticker'ı YOK → titreme YOK.
// ════════════════════════════════════════════════════════════════
import Auth, { loginGoogle } from './auth.js';
import Store from './store.js';

const $ = (id) => document.getElementById(id);
function setText(id, v){ const el = $(id); if(el && el.textContent !== v) el.textContent = v; }
function show(el, on){ if(el) el.style.display = on ? '' : 'none'; }

function fmt(n){
  const x = Number(n || 0);
  return x.toLocaleString('tr-TR');
}

// Oyuncu ilerlemesi (kaju/seviye/xp) — store'dan canlı
let _player = { kaju: 0, level: 1, xp: 0 };
function renderPlayer(p){
  _player = p;
  setText('pLevel', 'LV.' + (p.level || 1));
  setText('pKaju', fmt(p.kaju));
  // Ana sayfa istatistik şeridi
  setText('statLvl', 'LV.' + (p.level || 1));
  setText('statKaju', fmt(p.kaju));
  const best = p.bestScores && p.bestScores.tetris ? p.bestScores.tetris : 0;
  if(best > 0){ const b = best >= 1e6 ? (best/1e6).toFixed(1)+'M' : best >= 1e3 ? (best/1e3).toFixed(1)+'K' : String(best); setText('statBest', b); }
}

// ── Tek render fonksiyonu ───────────────────────────────────────
function render(state){
  const { status, profile, isAdmin, displayName } = state;
  const card   = $('profileCard');
  const banner = $('guestBanner');
  if(card) card.dataset.status = status;

  // Boot: yükleniyor görünümü
  if(status === 'boot'){
    setText('pName', 'Yükleniyor…');
    show(banner, false);
    return;
  }

  // İsim + admin rozeti auth'tan; seviye/kaju store'dan (renderPlayer)
  setText('pName', displayName);
  // Google kullanıcısı: isme dokununca nick değiştir
  const pn = $('pName');
  if(pn){
    if(status === 'google'){ pn.style.cursor='pointer'; pn.title='Nick değiştir ✏️'; pn.onclick = openNickModal; }
    else { pn.style.cursor=''; pn.title=''; pn.onclick = null; }
  }
  // Google kullanıcısı: Kaju bloğuna dokununca gönderim modalı
  const ks = $('pcKajuSend'), kb = $('pcKaju');
  if(ks) ks.style.display = (status === 'google') ? '' : 'none';
  if(kb){
    if(status === 'google'){ kb.style.cursor='pointer'; kb.onclick = openKajuModal; }
    else { kb.style.cursor=''; kb.onclick = null; }
  }
  // Admin rozeti — YALNIZCA gerçek /admins kaydı (güvenli)
  // NOT: .pc-admin CSS'te display:none → show()'un boş inline'ı yetmez, açıkça ver
  const ab = $('adminBadge');
  if(ab){
    ab.style.display = (isAdmin === true) ? 'inline-block' : 'none';
    if(isAdmin === true){
      ab.style.cursor='pointer'; ab.title='Admin yönetim paneli 👑';
      ab.onclick = () => import('./admin.js').then(m => m.openAdminPanel()).catch(()=>alert('Panel yüklenemedi (admin.js yüklü mü?)'));
    }
    else { ab.style.cursor=''; ab.onclick = null; }
  }

  // Durum satırı + bağlan butonu + misafir banner
  const dot = $('pStatusDot'), txt = $('pStatusText'), btn = $('connectBtn');

  if(status === 'google'){
    if(dot) dot.style.background = 'var(--green)';
    setText('pStatusText', 'BAĞLI');
    if(btn){ btn.textContent = '✅ BAĞLI'; btn.classList.add('is-linked'); }
    show(banner, false);
  } else if(status === 'anon'){
    if(dot) dot.style.background = 'var(--red)';
    setText('pStatusText', 'MİSAFİR');
    if(btn){ btn.textContent = '🔗 HESABI BAĞLA'; btn.classList.remove('is-linked'); }
    show(banner, true);
  } else { // offline
    if(dot) dot.style.background = 'var(--orange)';
    setText('pStatusText', 'Çevrimdışı');
    if(btn){ btn.textContent = '🔄 YENİDEN DENE'; btn.classList.remove('is-linked'); }
    show(banner, false);
  }
}

// ── Tek tıklama bağlama ─────────────────────────────────────────
function bind(){
  const btn = $('connectBtn'), bannerBtn = $('guestBannerBtn');
  const onConnect = async (e) => {
    if(e){ e.preventDefault(); e.stopPropagation(); }
    const st = Auth.getState();
    if(st.status === 'google') return;            // zaten bağlı
    if(st.status === 'offline'){ location.reload(); return; }
    const r = await loginGoogle();
    if(!r.ok && r.code){
      const msg = $('authMsg');
      if(msg){ msg.textContent = 'Giriş hatası: ' + (r.message || r.code); msg.style.display = 'block'; }
    }
  };
  if(btn && !btn.__bound){ btn.__bound = 1; btn.addEventListener('click', onConnect); }
  if(bannerBtn && !bannerBtn.__bound){ bannerBtn.__bound = 1; bannerBtn.addEventListener('click', onConnect); }
}

// ── Nick belirleme/değiştirme modalı ────────────────────────────
export function openNickModal(){
  const st = Auth.getState();
  if(st.status !== 'google'){ alert('Nick için önce Google ile giriş yapmalısın.'); return; }
  if(document.getElementById('nickModal')) return;
  const cur = (Auth.getNick && Auth.getNick()) || '';
  const ov = document.createElement('div');
  ov.id = 'nickModal'; ov.className = 'nick-modal-ov';
  ov.innerHTML = `
    <div class="nick-modal">
      <div class="nm-title">✏️ Nick Belirle</div>
      <div class="nm-sub">Portalda herkese görünen benzersiz adın.<br>3–16 karakter; harf, rakam ve _</div>
      <input id="nmInput" class="nm-input" maxlength="16" value="${String(cur).replace(/"/g,'&quot;')}" placeholder="nick" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div id="nmMsg" class="nm-msg"></div>
      <div class="nm-actions">
        <button class="nm-btn nm-cancel" data-act="cancel">Vazgeç</button>
        <button class="nm-btn nm-save" data-act="save" disabled>Kaydet</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const input = ov.querySelector('#nmInput');
  const msg = ov.querySelector('#nmMsg');
  const saveBtn = ov.querySelector('[data-act="save"]');
  let checkT = null;
  const setMsg = (t, ok) => { msg.textContent = t; msg.className = 'nm-msg ' + (ok ? 'ok' : 'bad'); };
  input.addEventListener('input', () => {
    const v = input.value.trim();
    const val = Auth.validateNick(v);
    if(!val.ok){ setMsg(val.error, false); saveBtn.disabled = true; return; }
    if(v === cur){ setMsg('Mevcut nick', true); saveBtn.disabled = false; return; }
    setMsg('Kontrol ediliyor…', true); saveBtn.disabled = true;
    clearTimeout(checkT);
    checkT = setTimeout(async () => {
      const r = await Auth.checkNick(v);
      if(input.value.trim() !== v) return;
      if(r.available){ setMsg('✓ Uygun', true); saveBtn.disabled = false; }
      else { setMsg('✗ ' + (r.error || 'Alınmış'), false); saveBtn.disabled = true; }
    }, 350);
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; setMsg('Kaydediliyor…', true);
    const r = await Auth.setNick(input.value.trim());
    if(r.ok){ setMsg('✓ Kaydedildi', true); setTimeout(() => ov.remove(), 700); }
    else { setMsg('✗ ' + (r.error || 'Olmadı'), false); saveBtn.disabled = false; }
  });
  setTimeout(() => input.focus(), 50);
}

// ── Kaju gönderme modalı (nick'e gönder; admin: ± ayarlama da) ──
export function openKajuModal(){
  const st = Auth.getState();
  if(st.status !== 'google'){ alert('Kaju göndermek için Google ile giriş yapmalısın.'); return; }
  if(document.getElementById('kajuModal')) return;
  const isAdmin = st.isAdmin === true;
  const rem = Store.transferRemaining ? Store.transferRemaining() : { min:10, perTx:5000, hour:0, day:0, month:0 };
  const ov = document.createElement('div');
  ov.id = 'kajuModal'; ov.className = 'nick-modal-ov';
  ov.innerHTML = `
    <div class="nick-modal">
      <div class="nm-title">🥜 Kaju Gönder</div>
      <div class="nm-sub">${isAdmin
        ? 'Admin: sınırsız gönderim + bakiye ayarlama (− ile eksilt)'
        : `Tek seferde ${rem.min}–${rem.perTx} · Kalan: saat ${fmt(rem.hour)} / gün ${fmt(rem.day)} / ay ${fmt(rem.month)}`}</div>
      <div style="position:relative">
        <input id="kjNick" class="nm-input" maxlength="16" placeholder="Alıcının nick'i" autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="adm-sug" id="kjSug" style="display:none"></div>
      </div>
      <input id="kjAmt" class="nm-input" style="margin-top:8px" inputmode="numeric" placeholder="Miktar${isAdmin ? ' ( − ile eksilt )' : ''}">
      <div id="kjMsg" class="nm-msg"></div>
      <div class="nm-actions">
        <button class="nm-btn nm-cancel" data-act="cancel">Vazgeç</button>
        <button class="nm-btn nm-save" data-act="send">Gönder</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const nickIn = ov.querySelector('#kjNick'), amtIn = ov.querySelector('#kjAmt');
  const msg = ov.querySelector('#kjMsg'), sendBtn = ov.querySelector('[data-act="send"]');
  const setMsg = (t, ok) => { msg.textContent = t; msg.className = 'nm-msg ' + (ok ? 'ok' : 'bad'); };
  // Canlı öneri (harf duyarsız) — seçilen alıcının uid'si saklanır
  let kjTarget = null, kjSugT = null;
  const kjSug = ov.querySelector('#kjSug');
  nickIn.addEventListener('input', () => {
    kjTarget = null;
    const v = nickIn.value.trim();
    clearTimeout(kjSugT);
    if(v.length < 2){ kjSug.style.display = 'none'; return; }
    kjSugT = setTimeout(async () => {
      const list = (Auth.searchNicks ? await Auth.searchNicks(v, 6) : []);
      if(nickIn.value.trim() !== v) return;
      if(!list.length){ kjSug.style.display = 'none'; return; }
      kjSug.innerHTML = list.map(x => `<div class="adm-sug-it" data-uid="${String(x.uid).replace(/"/g,'')}" data-nick="${String(x.nick).replace(/"/g,'')}">👤 ${String(x.nick).replace(/</g,'&lt;')}</div>`).join('');
      kjSug.style.display = '';
      kjSug.querySelectorAll('.adm-sug-it').forEach(it => it.addEventListener('click', () => {
        kjTarget = { uid: it.dataset.uid, nick: it.dataset.nick };
        nickIn.value = it.dataset.nick; kjSug.style.display = 'none';
      }));
    }, 220);
  });
  // Admin: nick yazarken hedefin mevcut bakiyesini göster
  if(isAdmin){
    let lookT = null;
    nickIn.addEventListener('input', () => {
      clearTimeout(lookT);
      const v = nickIn.value.trim();
      if(v.length < 3){ setMsg('', true); return; }
      lookT = setTimeout(async () => {
        const t = await Auth.resolveNick(v);
        if(nickIn.value.trim() !== v) return;
        if(!t){ setMsg('✗ Nick bulunamadı', false); return; }
        try{
          const cfg = await import('./firebase-config.js');
          const fdb = await import(`https://www.gstatic.com/firebasejs/${cfg.FIREBASE_SDK}/firebase-database.js`);
          const snap = await fdb.get(fdb.ref(fdb.getDatabase(), 'users/' + t.uid + '/kaju'));
          setMsg(`${t.nick} · bakiye: ${fmt(Number(snap.val() || 0))}`, true);
        }catch(e){ setMsg(t.nick + ' bulundu', true); }
      }, 400);
    });
  }
  ov.querySelector('[data-act="cancel"]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  sendBtn.addEventListener('click', async () => {
    const nick = nickIn.value.trim();
    const amt = Math.floor(Number(amtIn.value.trim()));
    if(!nick){ setMsg('Nick gir', false); return; }
    if(!Number.isFinite(amt) || amt === 0){ setMsg('Geçerli bir miktar gir', false); return; }
    if(amt < 0 && !isAdmin){ setMsg('Negatif miktar sadece admin', false); return; }
    sendBtn.disabled = true; setMsg('Alıcı aranıyor…', true);
    let target = (kjTarget && kjTarget.nick === nick) ? kjTarget : await Auth.resolveNick(nick);
    if(!target && Auth.searchNicks){
      const cand = await Auth.searchNicks(nick, 2);   // harf duyarsız tam eşleşme dene
      if(cand.length === 1) target = cand[0];
    }
    if(!target){ setMsg('✗ Bu nick bulunamadı — öneri listesinden seç', false); sendBtn.disabled = false; return; }
    let r;
    if(amt < 0){
      setMsg('Bakiye ayarlanıyor…', true);
      r = await Store.adminAdjustKaju(target.uid, amt, 'admin-eksiltme');
      if(r.ok){ setMsg(`✓ ${target.nick}: yeni bakiye ${fmt(r.newBalance)}`, true); setTimeout(() => ov.remove(), 1400); return; }
    } else {
      setMsg('Gönderiliyor…', true);
      r = await Store.transferKaju(target.uid, target.nick, amt);
      if(r.ok){ setMsg(`✓ ${fmt(amt)} Kaju ${target.nick} adlı oyuncuya gönderildi`, true); setTimeout(() => ov.remove(), 1400); return; }
    }
    setMsg('✗ ' + (r.error || 'Olmadı'), false); sendBtn.disabled = false;
  });
  setTimeout(() => nickIn.focus(), 50);
}

// Gelen Kaju bildirimi (claim sonrası küçük toast)
function kajuToast(text){
  const t = document.createElement('div');
  t.className = 'kaju-toast'; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 30);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4200);
}
// Store açılışta claim ediyor; sonuç olayla gelir → toast
window.addEventListener('hero:kaju-claimed', (e) => {
  const d = e.detail || {};
  if(!d.total) return;
  const who = (d.claimed || []).map(c => c.from).filter((v,i,a)=>a.indexOf(v)===i).slice(0,3).join(', ');
  kajuToast(`🥜 +${fmt(d.total)} Kaju geldi!${who ? ' (' + who + ')' : ''}`);
});

export function initUI(){
  bind();
  Auth.subscribe(render);        // kimlik + durum
  Store.subscribe(renderPlayer); // kaju + seviye (canlı, oyun sonrası güncellenir)
}

export default initUI;
