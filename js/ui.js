// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — UI RENDER (TEK BOYAYICI)
//
//  Auth durumuna ABONE olur, her değişimde profil kartını + misafir
//  banner'ını + giriş durumunu TEK fonksiyonla boyar.
//  Eski sistemin 5-6 bağımsız setInterval ticker'ı YOK → titreme YOK.
// ════════════════════════════════════════════════════════════════
import Auth, { loginGoogle } from './auth.js';
import Store from './store.js';


// Hafif toast helper
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

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
  // Kompakt Kaju
  const kj = p.kaju || 0;
  let kjShort;
  if(kj >= 999500000) kjShort = (kj/1e9).toFixed(kj>=1e10?0:1)+'B';
  else if(kj >= 1e6) kjShort = (kj/1e6).toFixed(kj>=1e7?0:1)+'M';
  else if(kj >= 10000) kjShort = Math.round(kj/1e3)+'K';
  else if(kj >= 1000) kjShort = (kj/1e3).toFixed(1)+'K';
  else kjShort = String(kj);
  setText('statKaju', kjShort);
  setText('statLvl', 'LV.' + (p.level || 1));
  const _lvBadge = document.querySelector('.auth-user-lv');
  if(_lvBadge) _lvBadge.textContent = 'LV.' + (p.level || 1);
  const best = Number(p.best?.tetris || p.bestScores?.tetris || 0);
  const b = best >= 1e6 ? (best/1e6).toFixed(1)+'M' : best >= 1e3 ? (best/1e3).toFixed(1)+'K' : String(best);
  setText('statBest', b);
  // ── XP İlerleme Çubuğu ──
  const lv = p.level || 1;
  const xp = p.xp || 0;
  const needed = 300 + lv * 200;
  const pct = Math.min(100, Math.round(xp / needed * 100));
  setText('xpLvBadge', 'LV.' + lv);
  setText('xpNext', 'LV.' + (lv+1) + ' →');
  setText('xpCur', fmt(xp) + ' XP');
  setText('xpPct', pct + '%');
  setText('xpMax', fmt(needed) + ' XP');
  const fill = document.getElementById('xpBarFill');
  const glow = document.getElementById('xpBarGlow');
  if(fill) fill.style.width = pct + '%';
  if(glow) glow.style.left = Math.max(0, pct - 1) + '%';
  const track = document.querySelector('.xp-bar-track[role="progressbar"]');
  if(track) track.setAttribute('aria-valuenow', String(pct));
  const badge = document.getElementById('xpLvBadge');
  if(badge){
    const rank = lv >= 50 ? 'mythic' : lv >= 25 ? 'legend' : lv >= 10 ? 'epic' : lv >= 5 ? 'rare' : 'common';
    badge.setAttribute('data-rank', rank);
  }
}

// ── Tek render fonksiyonu ───────────────────────────────────────
function render(state){
  const { status, profile, isAdmin, displayName } = state;
  setText('headerPlayerName', status === 'google' ? (displayName || 'Oyuncu') : 'Hesabım');
  const card   = $('profileCard');
  const banner = $('guestBanner');
  if(card) card.dataset.status = status;

  // 🔑 KRİTİK: Login UI'yi EN ÖNCE ayarla (sonraki kod patlasa bile giriş/çıkış doğru görünsün)
  try{
    const _g = $('authGuest'), _u = $('authUser');
    if(status === 'google'){
      if(_g) _g.style.display = 'none';
      if(_u) _u.style.display = 'flex';
    } else if(status !== 'boot'){
      if(_g) _g.style.display = 'flex';
      if(_u) _u.style.display = 'none';
    }
  }catch(_e){}

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
  // Avatar güncelle
  const avaEl = $('pAvatar');
  if(avaEl && profile && profile.avatar) avaEl.textContent = profile.avatar;
  // Level rozetini hem eski hem yeni elemente yaz
  const lvNew = document.querySelector('.auth-user-lv');
  if(lvNew) lvNew.textContent = 'LV.' + (_player.level || 1);
  const ab = $('adminBadge');
  if(ab){
    ab.style.display = (isAdmin === true) ? 'inline-block' : 'none';
    if(isAdmin === true){
      ab.style.cursor='pointer'; ab.title='Admin yönetim paneli 👑';
      ab.onclick = () => import('./admin.js').then(m => m.openAdminPanel()).catch(()=>_toast('Panel yüklenemedi (admin.js yüklü mü?)'));
    }
    else { ab.style.cursor=''; ab.onclick = null; }
  }

  // Auth kartı: google → premium profil, anon/offline → login ekranı
  const guestEl  = $('authGuest');
  const userEl   = $('authUser');
  const btn      = $('connectBtn');
  console.info('[auth-ui] status =', status, '| guest:', !!guestEl, '| user:', !!userEl);


  if(status === 'google'){
    // Giriş yapılmış → kullanıcı paneli göster
    show(banner, false);
    if(guestEl) guestEl.style.display = 'none';
    if(userEl)  userEl.style.display  = 'flex';
    // Kaju gönder butonu
    const ks = $('pcKajuSend');
    if(ks) ks.style.display = 'inline-block';
    // Profil kartına tıkla → profil aç
    const card = $('profileCard');
    if(card && !card.__pclick){
      card.__pclick = 1;
      card.querySelector('.auth-user-left').style.cursor = 'pointer';
      card.querySelector('.auth-user-left').addEventListener('click', () => {
        try{ document.querySelector('[data-nav="profile"]').click(); }catch(e){}
      });
    }
  } else {
    // Giriş yapılmamış → login ekranı
    if(guestEl) guestEl.style.display = 'flex';
    if(userEl)  userEl.style.display  = 'none';
    if(btn){
      btn.textContent = status === 'offline'
        ? '🔄 Yeniden Bağlan'
        : 'Google ile devam et';
    }
    show(banner, status === 'anon');
  }
}

// ── Tek tıklama bağlama ─────────────────────────────────────────
function bind(){
  const btn = $('connectBtn');
  const onConnect = async (e) => {
    if(e){ e.preventDefault(); e.stopPropagation(); }
    const st = Auth.getState();
    if(st.status === 'google') return;
    if(st.status === 'offline'){ location.reload(); return; }
    if(btn.disabled) return;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    const msg = $('authMsg');
    if(msg){ msg.style.display='none'; }
    let r;
    try{ r = await loginGoogle(); }
    catch(error){ console.error('[Login]', error); r = { ok: false }; }
    finally{ btn.disabled = false; btn.removeAttribute('aria-busy'); }
    if(r.redirect){
      // Redirect başladı — sayfa birazdan yönlenecek
      if(msg){ msg.style.display='block'; msg.style.color='#90caf9'; msg.textContent='Google\'a yönlendiriliyorsun…'; }
      return;
    }
    if(!r.ok){
      if(r.userCancelled){ return; } // kullanıcı kendisi kapattı, mesaj gösterme
      if(msg){
        msg.style.display='block'; msg.style.color='';
        if(r.popupBlocked){
          // A3: Firefox/Safari popup blok rehberi
          msg.innerHTML = '⚠️ Açılır pencere engellendi.<br><b>Çözüm:</b> Adres çubuğundaki 🛡️/🚫 simgesine tıkla → bu site için <b>açılır pencerelere ve çerezlere izin ver</b>, sonra tekrar dene.';
        } else {
          console.error('[Login]', r.message || r.code || 'Login failed');
          msg.textContent = 'Giriş tamamlanamadı. Bağlantını kontrol edip yeniden dene.';
        }
      }
    }
  };
  if(btn && !btn.__bound){ btn.__bound = 1; btn.addEventListener('click', onConnect); }
}

// ── Nick belirleme/değiştirme modalı ────────────────────────────
export function openNickModal(){
  const st = Auth.getState();
  if(st.status !== 'google'){ _toast('Nick için önce Google ile giriş yapmalısın.'); return; }
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
      try{
        const r = await Auth.checkNick(v);
        if(!ov.isConnected || input.value.trim() !== v) return;
        if(r.available){ setMsg('✓ Uygun', true); saveBtn.disabled = false; }
        else { setMsg('✗ ' + (r.error || 'Alınmış'), false); saveBtn.disabled = true; }
      }catch(error){
        if(ov.isConnected && input.value.trim() === v) setMsg('Nick kontrol edilemedi. Yeniden dene.', false);
        console.error('[Nick]', error);
      }
    }, 350);
  });
  ov.querySelector('[data-act="cancel"]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true; setMsg('Kaydediliyor…', true);
    try{
      const r = await Auth.setNick(input.value.trim());
      if(r.ok){ setMsg('✓ Kaydedildi', true); setTimeout(() => ov.remove(), 700); }
      else { setMsg('✗ ' + (r.error || 'Olmadı'), false); saveBtn.disabled = false; }
    }catch(error){ console.error('[Nick]', error); setMsg('Kaydedilemedi. Yeniden deneyebilirsin.', false); saveBtn.disabled = false; }
  });
  setTimeout(() => input.focus(), 50);
}

// ── Kaju gönderme modalı (nick'e gönder; admin: ± ayarlama da) ──
export function openKajuModal(){
  const st = Auth.getState();
  if(!st.uid || st.status !== 'google'){ _toast('Kaju göndermek için Google ile giriş yapmalısın.'); return; }
  if(document.getElementById('kajuModal')) return;
  const isAdmin = st.isAdmin === true;
  const rem = Store.transferRemaining ? Store.transferRemaining() : { min:10, perTx:5000, hour:0, day:0, month:0 };
  const ov = document.createElement('div');
  ov.id = 'kajuModal'; ov.className = 'nick-modal-ov';
  ov.innerHTML = `
    <div class="nick-modal">
      <div class="nm-title">🥜 Kaju Gönder</div>
      <div class="nm-sub">${isAdmin
        ? 'Admin: işlem başına en fazla 10.000.000 Kaju · − ile eksilt'
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
  const current = () => ov.isConnected && document.getElementById('kajuModal') === ov && Auth.getState().uid === st.uid && Auth.getState().status === 'google' && (Auth.getState().isAdmin === true) === isAdmin;
  const nickIn = ov.querySelector('#kjNick'), amtIn = ov.querySelector('#kjAmt');
  const msg = ov.querySelector('#kjMsg'), sendBtn = ov.querySelector('[data-act="send"]');
  const setMsg = (t, ok) => { msg.textContent = t; msg.className = 'nm-msg ' + (ok ? 'ok' : 'bad'); };
  // Canlı öneri (harf duyarsız) — seçilen alıcının uid'si saklanır
  let kjTarget = null, kjSugT = null, kjVersion = 0, sending = false, finished = false, pendingTx = null, attempt = null;
  const kjSug = ov.querySelector('#kjSug');
  nickIn.addEventListener('input', () => {
    kjVersion++;
    kjTarget = null;
    const v = nickIn.value.trim();
    clearTimeout(kjSugT);
    if(v.length < 2){ kjSug.style.display = 'none'; return; }
    kjSugT = setTimeout(async () => {
      let list;
      try{ list = Auth.searchNicks ? await Auth.searchNicks(v, 6) : []; }
      catch(error){ console.error('[NickSearch]', error); if(current() && nickIn.value.trim() === v) kjSug.style.display = 'none'; return; }
      if(!current() || nickIn.value.trim() !== v) return;
      if(!list.length){ kjSug.style.display = 'none'; return; }
      kjSug.replaceChildren(...list.map(x => {
        const item = document.createElement('button');
        item.type = 'button'; item.className = 'adm-sug-it';
        item.dataset.uid = String(x.uid); item.dataset.nick = String(x.nick);
        item.textContent = '👤 ' + x.nick;
        return item;
      }));
      kjSug.style.display = '';
      kjSug.querySelectorAll('.adm-sug-it').forEach(it => it.addEventListener('click', () => {
        if(!current() || sending || pendingTx) return;
        kjVersion++;
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
        const version = kjVersion;
        const valid = () => current() && Auth.getState().isAdmin === true && !sending && kjVersion === version && nickIn.value.trim() === v;
        if(!valid()) return;
        let t;
        try{ t = await Auth.resolveNick(v); }catch(error){ if(valid()) setMsg('Bakiye kontrol edilemedi.', false); return; }
        if(!valid()) return;
        if(!t){ setMsg('✗ Nick bulunamadı', false); return; }
        try{
          const cfg = await import('./firebase-config.js');
          const fdb = await import(`https://www.gstatic.com/firebasejs/${cfg.FIREBASE_SDK}/firebase-database.js`);
          if(!valid()) return;
          const snap = await fdb.get(fdb.ref(fdb.getDatabase(), 'users/' + t.uid + '/kaju'));
          if(!valid()) return;
          setMsg(`${t.nick} · bakiye: ${fmt(Number(snap.val() || 0))}`, true);
        }catch(e){ if(valid()) setMsg(t.nick + ' bulundu', true); }
      }, 400);
    });
  }
  ov.querySelector('[data-act="cancel"]').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  sendBtn.addEventListener('click', async () => {
    if(sending || finished || sendBtn.disabled || !current()) return;
    if(pendingTx){
      sending = true; sendBtn.disabled = true; setMsg('Bekleyen gönderim yeniden iletiliyor…', true);
      try{
        const r = await Store.retryPendingTransfers(pendingTx);
        if(!current()) return;
        if(r?.ok && Array.isArray(r.confirmedIds) && r.confirmedIds.includes(pendingTx)){
          pendingTx = null; finished = true; setMsg('✓ Bekleyen gönderim alıcıya iletildi.', true); setTimeout(() => { if(current()) ov.remove(); }, 1400);
        } else { setMsg('Gönderim kaydı korunuyor; alıcıya iletildiği henüz doğrulanamadı.', false); }
      }catch(error){ if(current()) setMsg('Gönderim kaydı korunuyor. Bağlantı geldiğinde tekrar deneyebilirsin.', false); }
      finally{ sending = false; if(current()){ sendBtn.disabled = finished; sendBtn.textContent = pendingTx ? 'Teslimi yeniden dene' : 'Gönder'; } }
      return;
    }
    const nick = nickIn.value.trim();
    const amt = Number(amtIn.value.trim());
    if(!nick){ setMsg('Nick gir', false); return; }
    if(!Number.isSafeInteger(amt) || amt === 0){ setMsg('Geçerli bir tam sayı gir', false); return; }
    if(amt < 0 && Auth.getState().isAdmin !== true){ setMsg('Negatif miktar sadece admin', false); return; }
    const version = ++kjVersion; // Any outstanding balance preview predates this send.
    const valid = () => current() && kjVersion === version && nickIn.value.trim() === nick && Number(amtIn.value.trim()) === amt;
    sending = true; sendBtn.disabled = true; setMsg('Alıcı aranıyor…', true);
    try{
    let target = (kjTarget && kjTarget.nick === nick) ? kjTarget : await Auth.resolveNick(nick);
    if(!valid()) return;
    if(!target && Auth.searchNicks){
      const cand = await Auth.searchNicks(nick, 2);   // harf duyarsız tam eşleşme dene
      if(!valid()) return;
      const exact = cand.filter(item => String(item.nick).toLowerCase() === nick.toLowerCase());
      if(exact.length === 1) target = exact[0];
    }
    if(!target){ setMsg('✗ Bu nick bulunamadı — öneri listesinden seç', false); sendBtn.disabled = false; return; }
    const signature = JSON.stringify([target.uid, amt]);
    if(attempt?.signature !== signature) attempt = {signature, id:'wallet_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2))};
    let r;
    if(amt < 0){
      setMsg('Bakiye ayarlanıyor…', true);
      r = await Store.adminAdjustKaju(target.uid, amt, 'admin-eksiltme', attempt.id);
      if(!current()) return;
      if(r.ok){ finished = true; setMsg(`✓ ${target.nick}: ${fmt(r.appliedDelta)} Kaju · yeni bakiye ${fmt(r.newBalance)}`, true); setTimeout(() => { if(current()) ov.remove(); }, 1400); return; }
    } else {
      setMsg('Gönderiliyor…', true);
      r = await Store.transferKaju(target.uid, target.nick, amt, {txId:attempt.id});
      if(!current()) return;
      if(r.ok){
        const actual = r.amount;
        if(r.pending || r.queued){
          pendingTx = r.txId; nickIn.disabled = amtIn.disabled = true;
          sendBtn.textContent = 'Teslimi yeniden dene';
          setMsg(`✓ ${fmt(actual)} Kaju gönderimi kaydedildi; alıcıya iletilmesi bekleniyor.`, true);
        } else {
          finished = true;
          setMsg(r.admin ? `✓ ${fmt(actual)} Kaju ${target.nick} adlı oyuncunun bakiyesine eklendi` : `✓ ${fmt(actual)} Kaju gönderimi ${target.nick} için kaydedildi. Alıcı hesabında onaylandığında bakiyeye geçer.`, true);
          setTimeout(() => { if(current()) ov.remove(); }, 1400);
        }
        return;
      }
    }
    setMsg('✗ ' + (r.error || 'Olmadı'), false); sendBtn.disabled = false;
    }catch(error){
      console.error('[KajuTransfer]', error);
      if(current()) setMsg('Gönderim tamamlanamadı. Bakiyeni kontrol edip yeniden dene.', false);
    }finally{ sending = false; if(current()) sendBtn.disabled = finished; }
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
function onKajuClaimed(e){
  const d = e.detail || {};
  const owner = d.uid || d.ownerUid;
  if(owner && owner !== Auth.getState().uid) return;
  if(!Number.isSafeInteger(d.total) || d.total <= 0) return;
  const who = (Array.isArray(d.claimed) ? d.claimed : []).map(c => typeof c?.from === 'string' ? c.from : '').filter((v,i,a)=>v && a.indexOf(v)===i).slice(0,3).join(', ');
  kajuToast(`🥜 +${fmt(d.total)} Kaju geldi!${who ? ' (' + who + ')' : ''}`);
}
window.addEventListener('hero:kaju-claimed', onKajuClaimed);

let initialized = false;
export function initUI(){
  if(initialized) return;
  initialized = true;
  bind();
  Auth.subscribe(render);        // kimlik + durum
  Store.subscribe(renderPlayer); // kaju + seviye (canlı, oyun sonrası güncellenir)
}

export default initUI;
