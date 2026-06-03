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
  // Admin rozeti — YALNIZCA gerçek /admins kaydı (güvenli)
  show($('adminBadge'), isAdmin === true);

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

export function initUI(){
  bind();
  Auth.subscribe(render);        // kimlik + durum
  Store.subscribe(renderPlayer); // kaju + seviye (canlı, oyun sonrası güncellenir)
}

export default initUI;
