// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — OYUN İÇİ EV (🏠) BUTONU (ortak bileşen)
//  Her oyun (tetris/chess/tavla/kelime) bunu çağırır.
//  • Sağ-alt köşede yarı saydam, gizlenebilir bir FAB.
//  • Tek dokunuş: gizle/göster geçişi (uzun basış değil — küçük yan tutamak).
//  • "Ev"e basınca onConfirmExit() çağrılır (oyun kendi kapanışını yapar).
//  • Oyun butonlarını maskelemez: pointer-events sadece butonun kendisinde.
// ════════════════════════════════════════════════════════════════

// Her oyun için ev ikonu/teması (görsel kimlik)
const GAME_THEME = {
  tetris: { icon: '🏠', accent: '#00E5FF', glow: 'rgba(0,229,255,.45)', label: 'TETRIS' },
  chess:  { icon: '🏠', accent: '#FFD740', glow: 'rgba(255,215,64,.45)', label: 'SATRANÇ' },
  tavla:  { icon: '🏠', accent: '#FF7043', glow: 'rgba(255,112,67,.45)', label: 'TAVLA' },
  kelime: { icon: '🏠', accent: '#AB47BC', glow: 'rgba(171,71,188,.45)', label: 'KELİME' },
  default:{ icon: '🏠', accent: '#7C4DFF', glow: 'rgba(124,77,255,.45)', label: 'OYUN' },
};

// Stil bir kez enjekte edilir
function ensureHomeStyle(){
  if(document.getElementById('ghp-game-home-style')) return;
  const st = document.createElement('style');
  st.id = 'ghp-game-home-style';
  st.textContent = `
    .ghp-game-home {
      position: fixed;
      right: 14px;
      bottom: calc(14px + env(safe-area-inset-bottom, 0px));
      z-index: 2147483000;
      display: flex; align-items: center; gap: 0;
      pointer-events: none;             /* kapsayıcı tıklamayı geçirir */
      transition: transform .28s cubic-bezier(.4,1.3,.6,1), opacity .25s;
      user-select: none; -webkit-user-select: none;
    }
    .ghp-game-home.hidden {
      transform: translateX(calc(100% - 30px));  /* sadece tutamak görünür */
    }
    .ghp-gh-handle {
      pointer-events: auto;
      width: 30px; height: 56px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(15,15,30,.82);
      border: 1px solid var(--gh-accent, #7C4DFF);
      border-right: none;
      border-radius: 14px 0 0 14px;
      color: var(--gh-accent, #7C4DFF);
      font-size: 13px; cursor: pointer;
      backdrop-filter: blur(6px);
      box-shadow: -2px 0 12px rgba(0,0,0,.35);
    }
    .ghp-gh-main {
      pointer-events: auto;
      display: flex; align-items: center; gap: 8px;
      padding: 0 16px 0 14px; height: 56px;
      background: rgba(15,15,30,.82);
      border: 1px solid var(--gh-accent, #7C4DFF);
      border-radius: 0 14px 14px 0;
      color: #fff; cursor: pointer;
      backdrop-filter: blur(6px);
      box-shadow: 0 4px 18px var(--gh-glow, rgba(124,77,255,.45)), inset 0 0 0 1px rgba(255,255,255,.04);
      transition: transform .15s, box-shadow .2s;
    }
    .ghp-gh-main:active { transform: scale(.94); }
    .ghp-gh-icon { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 6px var(--gh-glow)); }
    .ghp-gh-text { font-size: 11px; font-weight: 900; letter-spacing: .6px; color: var(--gh-accent, #7C4DFF); white-space: nowrap; }
    /* Onay balonu */
    .ghp-gh-confirm {
      position: fixed; inset: 0; z-index: 2147483600;
      background: rgba(0,0,0,.6); backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center; padding: 24px;
      pointer-events: auto;
    }
    .ghp-gh-confirm-box {
      background: linear-gradient(160deg,#1c1c30,#15152a);
      border: 1px solid var(--gh-accent, #7C4DFF);
      border-radius: 18px; padding: 22px 20px; max-width: 320px; width: 100%;
      text-align: center; box-shadow: 0 18px 50px rgba(0,0,0,.55);
    }
    .ghp-gh-confirm-icon { font-size: 40px; margin-bottom: 8px; }
    .ghp-gh-confirm-title { font-size: 16px; font-weight: 900; color: #fff; margin-bottom: 4px; }
    .ghp-gh-confirm-sub { font-size: 12px; color: #9fb0d8; margin-bottom: 18px; }
    .ghp-gh-confirm-btns { display: flex; gap: 10px; }
    .ghp-gh-btn {
      flex: 1; padding: 12px; border-radius: 12px; font-size: 13px; font-weight: 800;
      cursor: pointer; border: 1px solid transparent;
    }
    .ghp-gh-btn.stay { background: rgba(255,255,255,.07); color: #cdd8f5; border-color: rgba(255,255,255,.12); }
    .ghp-gh-btn.go { background: var(--gh-accent, #7C4DFF); color: #0a0a14; }
  `;
  document.head.appendChild(st);
}

/**
 * Oyun içi ev butonu ekler.
 * @param {string} gameKey  'tetris' | 'chess' | 'tavla' | 'kelime'
 * @param {function} onExit  Onaylanınca çağrılır (oyun kendi kapanışını + nav.go('home') yapar)
 * @param {object} [opts]    { confirm: true, hidden: false }
 * @returns {object} { remove, show, hide, toggle }
 */
export function mountGameHome(gameKey, onExit, opts = {}){
  ensureHomeStyle();
  const theme = GAME_THEME[gameKey] || GAME_THEME.default;
  const needConfirm = opts.confirm !== false;

  // Eski varsa kaldır (çift oyun açılışına karşı)
  const old = document.getElementById('ghpGameHome');
  if(old) old.remove();

  const wrap = document.createElement('div');
  wrap.className = 'ghp-game-home';
  wrap.id = 'ghpGameHome';
  wrap.style.setProperty('--gh-accent', theme.accent);
  wrap.style.setProperty('--gh-glow', theme.glow);
  if(opts.hidden) wrap.classList.add('hidden');
  wrap.innerHTML = `
    <div class="ghp-gh-handle" title="Göster/Gizle">⟨</div>
    <div class="ghp-gh-main" title="Ana menüye dön">
      <span class="ghp-gh-icon">${theme.icon}</span>
      <span class="ghp-gh-text">ANA MENÜ</span>
    </div>`;
  document.body.appendChild(wrap);

  const handle = wrap.querySelector('.ghp-gh-handle');
  const main = wrap.querySelector('.ghp-gh-main');

  // Tutamak: gizle/göster
  handle.addEventListener('click', (e) => {
    e.stopPropagation();
    const hidden = wrap.classList.toggle('hidden');
    handle.textContent = hidden ? '⟩' : '⟨';
  });

  // Ev: onay sor → çık
  function doExit(){
    try{ wrap.remove(); }catch(_){}
    try{ onExit && onExit(); }catch(err){ console.warn('[gameHome] exit', err); }
  }
  main.addEventListener('click', (e) => {
    e.stopPropagation();
    if(!needConfirm){ doExit(); return; }
    showConfirm();
  });

  function showConfirm(){
    const c = document.createElement('div');
    c.className = 'ghp-gh-confirm';
    c.style.setProperty('--gh-accent', theme.accent);
    c.innerHTML = `
      <div class="ghp-gh-confirm-box">
        <div class="ghp-gh-confirm-icon">🏠</div>
        <div class="ghp-gh-confirm-title">Ana menüye dön?</div>
        <div class="ghp-gh-confirm-sub">${theme.label} oyunundan çıkacaksın. İlerlemen otomatik kaydedilir.</div>
        <div class="ghp-gh-confirm-btns">
          <button class="ghp-gh-btn stay">Devam et</button>
          <button class="ghp-gh-btn go">🏠 Çık</button>
        </div>
      </div>`;
    document.body.appendChild(c);
    c.querySelector('.stay').addEventListener('click', () => c.remove());
    c.querySelector('.go').addEventListener('click', () => { c.remove(); doExit(); });
    c.addEventListener('click', (e) => { if(e.target === c) c.remove(); });
  }

  return {
    remove: () => { try{ wrap.remove(); }catch(_){} },
    show: () => { wrap.classList.remove('hidden'); handle.textContent = '⟨'; },
    hide: () => { wrap.classList.add('hidden'); handle.textContent = '⟩'; },
    toggle: () => { const h = wrap.classList.toggle('hidden'); handle.textContent = h ? '⟩' : '⟨'; },
  };
}

export default mountGameHome;
