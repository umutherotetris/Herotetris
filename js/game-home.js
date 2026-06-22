// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — OYUN İÇİ KONTROL MERKEZİ (portatif/sürüklenebilir)
//  Küçük yuvarlak FAB. Dokununca akordiyon panel açılır:
//   • Ana menü + nav kısayolları (Arkadaş/Liderlik/Profil/Bildirim)
//   • Ses / Müzik / Titreşim aç-kapa (oyuna özel)
//   • UI ölçek ayarı (A− / A+)
//   • Nasıl Oynanır (oyuna özel rehber)
//  Sürüklenebilir (konum hatırlanır). Oyun butonlarını maskelemez.
// ════════════════════════════════════════════════════════════════

const THEME = {
  tetris: { accent:'#00E5FF', glow:'rgba(0,229,255,.5)',  name:'HEROTETRIS', icon:'🟦' },
  chess:  { accent:'#FFD740', glow:'rgba(255,215,64,.5)', name:'SATRANÇ',    icon:'♟️' },
  tavla:  { accent:'#FF7043', glow:'rgba(255,112,67,.5)', name:'TAVLA',      icon:'🎲' },
  kelime: { accent:'#AB47BC', glow:'rgba(171,71,188,.5)', name:'KELİMECİK',  icon:'🔤' },
  default:{ accent:'#7C4DFF', glow:'rgba(124,77,255,.5)', name:'OYUN',       icon:'🎮' },
};

// Oyuna özel "nasıl oynanır" rehberleri
const GUIDE = {
  tetris: [
    ['🎯 Amaç', 'Düşen blokları yan yana dizerek satırları doldur. Dolu satır temizlenir, puan kazanırsın.'],
    ['🕹️ Kontroller', '◀ ▶ taşı · 🔄 döndür · ▼ yumuşak düşür · SERT BIRAK anında indirir · TUT bloğu saklar.'],
    ['🔥 Combo & Tetris', '4 satırı birden temizle = TETRİS (bonus). Arka arkaya temizleme = combo çarpanı.'],
    ['💎 Güç & Gem', 'Satır temizledikçe güç dolar. Gem topla, 3 aynısını birleştir, özel güç kullan.'],
    ['⚡ İpucu', 'Sağ tarafta boşluk bırakıp uzun bloğu (I) saklayarak Tetris için fırsat yarat.'],
  ],
  kelime: [
    ['🎯 Amaç', 'Elindeki harflerle tahtaya kelime diz. Rakipten çok puan toplayan kazanır.'],
    ['🔤 Kelime kur', 'Harfleri sürükle, en az 2 harfli geçerli Türkçe kelime oluştur. İlk kelime ⭐ merkezden geçmeli.'],
    ['💰 Puan kareleri', 'Her harfin değeri var (alttaki rakam). Mavi H² harf puanını, koyu mavi H³ üçler. Turuncu K² kelimeyi 2×, kırmızı K³ kelimeyi 3× yapar.'],
    ['🎁 Sürpriz kutular', 'Üzerine taş koyduğunda açılır: ⭐+10 / 💎+15 / 💰+25 JACKPOT puan, 🎴 +1 ekstra harf, ✖️ o hamleyi 2× yapar. Her oyunda 4 tane rastgele yerleşir.'],
    ['🎰 Bingo', 'Tek hamlede 7 harfin hepsini kullanırsan +50 bonus puan!'],
    ['🔄 Seçenekler', 'Harf Değiş: sıranı harcayıp harfleri yenile · Geç: pas · Geri Al: yerleştirmeyi bozar.'],
    ['🔍 Araçlar', 'Büyüteç ile kelime kontrol, dürbün ile tahtayı incele.'],
  ],
  chess: [
    ['🎯 Amaç', 'Rakip şahı mat et (kaçışı olmayan tehdit). Beyaz başlar.'],
    ['♟️ Taşlar', 'Piyon düz gider çapraz yer · Kale düz · Fil çapraz · Vezir her yön · At L · Şah tek kare.'],
    ['🏰 Özel', 'Rok (şah+kale birlikte), en passant (piyon geçerken yeme), terfi (piyon sona = vezir).'],
    ['🤝 Sonuç', 'Mat = zafer · Pat/3 tekrar/50 hamle = berabere · Pes Et / Beraberlik teklif edebilirsin.'],
  ],
  tavla: [
    ['🎯 Amaç', 'Tüm pullarını kendi evine topla, sonra dışarı çıkar. İlk bitiren kazanır.'],
    ['🎲 Oyna', 'Zar at, çıkan sayılarla pul ilerlet. Çift atarsan 4 hamle hakkın olur.'],
    ['🛡️ Kırma', 'Rakibin tek pulunun olduğu noktaya gelirsen onu kırarsın (bara gider, baştan girer).'],
    ['🏁 Toplama', 'Tüm pullar evdeyse dışarı çıkarmaya başlarsın. Mars (×2) ve Hin (×3) ekstra puan.'],
  ],
};

// Erişilebilirlik modlarını açılışta uygula (her oyun açılışında çağrılır)
function applyA11y(){
  try{
    document.documentElement.classList.toggle('hero-high-contrast', localStorage.getItem('hero_high_contrast')==='1');
    document.documentElement.classList.toggle('hero-colorblind', localStorage.getItem('hero_colorblind')==='1');
  }catch(e){}
}

function inject(){
  if(document.getElementById('ghp-cc-style')) return;
  const st = document.createElement('style');
  st.id = 'ghp-cc-style';
  st.textContent = `
    /* ── Erişilebilirlik modları ── */
    html.hero-high-contrast .tetris-canvas,
    html.hero-high-contrast .kl-cell,
    html.hero-high-contrast canvas { filter: contrast(1.35) brightness(1.12) saturate(1.1); }
    html.hero-high-contrast .ghp-cc-row .rl,
    html.hero-high-contrast .t-pval { text-shadow: 0 0 1px #000, 0 1px 2px #000; }
    /* Renk körü: deuteranopia/protanopia dostu — mavi/turuncu kontrastını artır, kırmızı/yeşil ayrımına desen */
    html.hero-colorblind canvas { filter: saturate(1.4) contrast(1.15); }
    html.hero-colorblind .kl-cell.b-h2,
    html.hero-colorblind .kl-cell.b-h3 { outline: 2px dashed rgba(0,180,255,.6); outline-offset:-3px; }
    html.hero-colorblind .kl-cell.b-k2,
    html.hero-colorblind .kl-cell.b-k3 { outline: 2px dotted rgba(255,140,0,.7); outline-offset:-3px; }

    .ghp-cc-fab{
      position:fixed; z-index:2147483000;
      width:34px; height:34px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      background:rgba(12,12,22,.88); border:1.5px solid var(--cc-accent);
      color:var(--cc-accent); font-size:14px; cursor:pointer;
      box-shadow:0 3px 10px var(--cc-glow), inset 0 0 0 1px rgba(255,255,255,.05);
      backdrop-filter:blur(8px); touch-action:none;
      transition:transform .18s, box-shadow .2s, opacity .15s;
      user-select:none; -webkit-user-select:none; opacity:0.82;
    }
    .ghp-cc-fab:hover{ opacity:1; box-shadow:0 4px 14px var(--cc-glow); }
    .ghp-cc-fab:active{ transform:scale(.88); opacity:1; }
    .ghp-cc-fab.dragging{ transform:scale(1.08); box-shadow:0 6px 18px var(--cc-glow); opacity:1; }
    .ghp-cc-panel{
      position:fixed; z-index:2147483001;
      width:248px; max-width:calc(100vw - 24px);
      background:linear-gradient(165deg,rgba(22,22,38,.97),rgba(16,16,30,.97));
      border:1.5px solid var(--cc-accent); border-radius:18px;
      box-shadow:0 18px 50px rgba(0,0,0,.6), 0 0 24px var(--cc-glow);
      backdrop-filter:blur(14px); overflow:hidden;
      transform-origin:bottom right; animation:ccpop .22s cubic-bezier(.34,1.4,.5,1);
    }
    @keyframes ccpop{ from{ opacity:0; transform:scale(.7) translateY(10px);} to{opacity:1; transform:scale(1) translateY(0);} }
    .ghp-cc-head{
      display:flex; align-items:center; gap:8px; padding:11px 13px;
      border-bottom:1px solid rgba(255,255,255,.08);
      background:linear-gradient(180deg,var(--cc-glow),transparent);
    }
    .ghp-cc-head .t{ flex:1; font-size:12px; font-weight:900; letter-spacing:.5px; color:var(--cc-accent); }
    .ghp-cc-head .x{ width:24px; height:24px; border-radius:7px; border:1px solid rgba(255,255,255,.12);
      background:rgba(255,255,255,.05); color:#fff; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center;}
    .ghp-cc-body{ max-height:min(60vh,440px); overflow-y:auto; padding:8px; }
    /* Ana menü büyük buton */
    .ghp-cc-home{
      width:100%; display:flex; align-items:center; gap:10px; justify-content:center;
      padding:13px; border-radius:13px; margin-bottom:8px; cursor:pointer;
      background:var(--cc-accent); color:#0a0a14; font-weight:900; font-size:14px; border:none;
      box-shadow:0 4px 14px var(--cc-glow);
    }
    .ghp-cc-home:active{ transform:scale(.96); }
    /* Nav grid */
    .ghp-cc-nav{ display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-bottom:9px; }
    .ghp-cc-navbtn{
      display:flex; flex-direction:column; align-items:center; gap:3px;
      padding:8px 2px; border-radius:10px; cursor:pointer;
      background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08);
      color:#cdd8f5; font-size:9px; font-weight:700;
    }
    .ghp-cc-navbtn .i{ font-size:17px; }
    .ghp-cc-navbtn:active{ background:var(--cc-glow); }
    /* Bölüm başlığı */
    .ghp-cc-sec{ font-size:9px; font-weight:800; color:#6d7aa8; letter-spacing:.6px;
      text-transform:uppercase; margin:9px 4px 5px; }
    /* Toggle satırı */
    .ghp-cc-row{
      display:flex; align-items:center; gap:9px; padding:9px 10px; border-radius:11px;
      background:rgba(255,255,255,.04); margin-bottom:5px;
    }
    .ghp-cc-row .ri{ font-size:16px; width:20px; text-align:center; }
    .ghp-cc-row .rl{ flex:1; font-size:12px; font-weight:700; color:#e8eaf6; }
    .ghp-cc-sw{
      width:42px; height:24px; border-radius:13px; cursor:pointer; flex-shrink:0; position:relative;
      background:rgba(255,255,255,.14); transition:background .2s; border:1px solid rgba(255,255,255,.1);
    }
    .ghp-cc-sw.on{ background:var(--cc-accent); }
    .ghp-cc-sw::after{ content:''; position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%;
      background:#fff; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.4);}
    .ghp-cc-sw.on::after{ transform:translateX(18px); }
    /* UI ölçek */
    .ghp-cc-scale{ display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:11px; background:rgba(255,255,255,.04); margin-bottom:5px; }
    .ghp-cc-scale .sb{ width:30px; height:30px; border-radius:8px; border:1px solid var(--cc-accent);
      background:rgba(255,255,255,.05); color:var(--cc-accent); font-size:15px; font-weight:900; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .ghp-cc-scale .sv{ flex:1; text-align:center; font-size:12px; font-weight:800; color:#e8eaf6; }
    /* Rehber */
    .ghp-cc-guide-btn{
      width:100%; padding:10px; border-radius:11px; cursor:pointer; margin-top:4px;
      background:rgba(255,255,255,.05); border:1px solid var(--cc-accent); color:var(--cc-accent);
      font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:6px;
    }
    /* Rehber modal */
    .ghp-cc-guide{
      position:fixed; inset:0; z-index:2147483600; background:rgba(0,0,0,.72); backdrop-filter:blur(5px);
      display:flex; align-items:center; justify-content:center; padding:20px;
    }
    .ghp-cc-guide-box{
      background:linear-gradient(165deg,#1c1c32,#14142a); border:1.5px solid var(--cc-accent);
      border-radius:20px; max-width:360px; width:100%; max-height:82vh; overflow-y:auto;
      box-shadow:0 22px 60px rgba(0,0,0,.6);
    }
    .ghp-cc-guide-h{ position:sticky; top:0; display:flex; align-items:center; gap:10px; padding:16px 18px;
      background:linear-gradient(180deg,#1c1c32,rgba(28,28,50,.9)); border-bottom:1px solid rgba(255,255,255,.08); }
    .ghp-cc-guide-h .gt{ flex:1; font-size:16px; font-weight:900; color:var(--cc-accent); }
    .ghp-cc-guide-h .gx{ width:30px; height:30px; border-radius:9px; border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.05); color:#fff; cursor:pointer; font-size:15px; }
    .ghp-cc-guide-item{ padding:13px 18px; border-bottom:1px solid rgba(255,255,255,.05); }
    .ghp-cc-guide-item .gh{ font-size:13px; font-weight:900; color:#fff; margin-bottom:4px; }
    .ghp-cc-guide-item .gp{ font-size:12px; color:#aab6da; line-height:1.6; }
    /* Onay */
    .ghp-cc-confirm{ position:fixed; inset:0; z-index:2147483600; background:rgba(0,0,0,.6); backdrop-filter:blur(3px);
      display:flex; align-items:center; justify-content:center; padding:24px; }
    .ghp-cc-confirm-box{ background:linear-gradient(160deg,#1c1c30,#15152a); border:1px solid var(--cc-accent);
      border-radius:18px; padding:22px 20px; max-width:300px; width:100%; text-align:center; }
    .ghp-cc-confirm .ti{ font-size:36px; margin-bottom:6px; }
    .ghp-cc-confirm .tt{ font-size:15px; font-weight:900; color:#fff; margin-bottom:4px; }
    .ghp-cc-confirm .ts{ font-size:11px; color:#9fb0d8; margin-bottom:16px; }
    .ghp-cc-confirm .bs{ display:flex; gap:9px; }
    .ghp-cc-confirm button{ flex:1; padding:11px; border-radius:11px; font-size:12px; font-weight:800; cursor:pointer; border:1px solid transparent; }
    .ghp-cc-confirm .stay{ background:rgba(255,255,255,.07); color:#cdd8f5; border-color:rgba(255,255,255,.12); }
    .ghp-cc-confirm .go{ background:var(--cc-accent); color:#0a0a14; }
  `;
  document.head.appendChild(st);
}

/**
 * @param {string} gameKey
 * @param {function} onExit  ana menüye dönüş (oyun kapanışı)
 * @param {object} [api]  { sound, music, vibe, theme } opsiyonel kontroller
 *   sound: { get():bool, toggle():bool }
 *   music: { get():bool, toggle():bool }
 *   vibe:  { get():bool, toggle():bool }
 */
export function mountGameHome(gameKey, onExit, api = {}){
  inject();
  applyA11y();
  const theme = THEME[gameKey] || THEME.default;
  document.getElementById('ghpGameHome')?.remove();
  document.getElementById('ghpGameHomePanel')?.remove();

  const fab = document.createElement('div');
  fab.className = 'ghp-cc-fab';
  fab.id = 'ghpGameHome';
  fab.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"/><path d="M9 21V13h6v8"/></svg>`;
  fab.style.setProperty('--cc-accent', theme.accent);
  fab.style.setProperty('--cc-glow', theme.glow);

  // Konum: kayıtlı veya varsayılan (sağ-alt, oyun butonlarının ÜSTÜnde değil — kenarda)
  const saved = (()=>{ try{ return JSON.parse(localStorage.getItem('hero_cc_pos_'+gameKey)||'null'); }catch(e){ return null; } })();
  const defPos = { left: window.innerWidth - 60, top: Math.round(window.innerHeight * 0.42) };
  let pos = saved || defPos;
  function clamp(){ pos.left = Math.max(6, Math.min(window.innerWidth-52, pos.left)); pos.top = Math.max(70, Math.min(window.innerHeight-110, pos.top)); }
  clamp();
  function place(){ fab.style.left = pos.left+'px'; fab.style.top = pos.top+'px'; }
  place();
  document.body.appendChild(fab);

  // ── Sürükleme ──
  let drag=false, moved=false, sx=0, sy=0, ox=0, oy=0;
  const down = (e)=>{ const t=e.touches?e.touches[0]:e; drag=true; moved=false; sx=t.clientX; sy=t.clientY; ox=pos.left; oy=pos.top; fab.classList.add('dragging'); };
  const move = (e)=>{ if(!drag) return; const t=e.touches?e.touches[0]:e; const dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>6) moved=true; pos.left=ox+dx; pos.top=oy+dy; clamp(); place(); if(e.cancelable) e.preventDefault(); };
  const up = ()=>{ if(!drag) return; drag=false; fab.classList.remove('dragging');
    if(moved){ try{ localStorage.setItem('hero_cc_pos_'+gameKey, JSON.stringify(pos)); }catch(e){} }
    else { togglePanel(); } };
  fab.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  fab.addEventListener('touchstart', down, {passive:false}); window.addEventListener('touchmove', move, {passive:false}); window.addEventListener('touchend', up);

  // ── Panel ──
  let panel=null;
  function togglePanel(){ panel ? closePanel() : openPanel(); }
  function closePanel(){ panel?.remove(); panel=null; }
  function openPanel(){
    closePanel();
    panel = document.createElement('div');
    panel.className = 'ghp-cc-panel';
    panel.id = 'ghpGameHomePanel';
    panel.style.setProperty('--cc-accent', theme.accent);
    panel.style.setProperty('--cc-glow', theme.glow);

    const hasSound = api.sound && api.sound.get;
    const hasMusic = api.music && api.music.get;
    const hasVibe  = api.vibe && api.vibe.get;
    const scale = (()=>{ try{ return parseFloat(localStorage.getItem('hero_ui_scale')||'1'); }catch(e){ return 1; } })();

    panel.innerHTML = `
      <div class="ghp-cc-head">
        <span style="font-size:15px">${theme.icon}</span>
        <span class="t">${theme.name}</span>
        <button class="x" data-cc="close">✕</button>
      </div>
      <div class="ghp-cc-body">
        <button class="ghp-cc-home" data-cc="home">🏠 ANA MENÜ</button>
        <div class="ghp-cc-nav">
          <div class="ghp-cc-navbtn" data-nav="home"><span class="i">🏠</span>Ana</div>
          <div class="ghp-cc-navbtn" data-nav="friends"><span class="i">👥</span>Arkadaş</div>
          <div class="ghp-cc-navbtn" data-nav="leaderboard"><span class="i">🏆</span>Liderlik</div>
          <div class="ghp-cc-navbtn" data-nav="notifications"><span class="i">🔔</span>Bildirim</div>
        </div>

        ${(hasSound||hasMusic||hasVibe) ? `<div class="ghp-cc-sec">🔊 Ses & Müzik</div>` : ''}
        ${hasSound ? `<div class="ghp-cc-row"><span class="ri">🔊</span><span class="rl">Ses Efektleri</span><div class="ghp-cc-sw ${api.sound.get()?'on':''}" data-sw="sound"></div></div>` : ''}
        ${hasMusic ? `<div class="ghp-cc-row"><span class="ri">🎵</span><span class="rl">Müzik</span><div class="ghp-cc-sw ${api.music.get()?'on':''}" data-sw="music"></div></div>` : ''}
        ${hasVibe ? `<div class="ghp-cc-row"><span class="ri">📳</span><span class="rl">Titreşim</span><div class="ghp-cc-sw ${api.vibe.get()?'on':''}" data-sw="vibe"></div></div>` : ''}

        <div class="ghp-cc-sec">🔍 Görünüm</div>
        <div class="ghp-cc-scale">
          <button class="sb" data-scale="-">A−</button>
          <span class="sv" data-el="scaleVal">%${Math.round(scale*100)}</span>
          <button class="sb" data-scale="+">A+</button>
        </div>
        <div class="ghp-cc-row"><span class="ri">🌗</span><span class="rl">Yüksek Kontrast</span><div class="ghp-cc-sw ${localStorage.getItem('hero_high_contrast')==='1'?'on':''}" data-sw2="contrast"></div></div>
        <div class="ghp-cc-row"><span class="ri">🎨</span><span class="rl">Renk Körü Modu</span><div class="ghp-cc-sw ${localStorage.getItem('hero_colorblind')==='1'?'on':''}" data-sw2="colorblind"></div></div>

        ${api.onTheme ? `<button class="ghp-cc-guide-btn" style="margin-bottom:5px" data-cc="theme">🎨 Tahta / Taş Teması</button>` : ''}
        ${GUIDE[gameKey] ? `<button class="ghp-cc-guide-btn" data-cc="guide">📖 Nasıl Oynanır?</button>` : ''}
      </div>`;
    document.body.appendChild(panel);
    positionPanel();

    // events
    panel.querySelector('[data-cc="close"]').addEventListener('click', closePanel);
    panel.querySelector('[data-cc="home"]').addEventListener('click', confirmExit);
    panel.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', async () => {
      const screen = b.dataset.nav;
      closePanel();
      if(screen === 'home'){
        doExit(async () => {
          try{ const n = await import('./nav.js'); if(n.go) n.go('home'); }catch(e){ console.warn('[cc] nav', e); }
        });
      } else {
        // Arkadaş / Liderlik / Bildirim → hepsi social hub overlay (oyundan çıkmadan)
        const tabMap = { friends:'dost', notifications:'notif', leaderboard:'lider' };
        const tab = tabMap[screen] || screen;
        try{
          const soc = await import('./social.js');
          if(soc.openHubTab) soc.openHubTab(tab);
        }catch(e){ console.warn('[cc] social', e); }
      }
    }));
    panel.querySelectorAll('[data-sw]').forEach(sw => sw.addEventListener('click', () => {
      const kind = sw.dataset.sw; let on=false;
      try{ on = api[kind].toggle(); }catch(e){}
      sw.classList.toggle('on', !!on);
    }));
    panel.querySelectorAll('[data-sw2]').forEach(sw => sw.addEventListener('click', () => {
      const kind = sw.dataset.sw2;
      const key = kind==='contrast' ? 'hero_high_contrast' : 'hero_colorblind';
      const cls = kind==='contrast' ? 'hero-high-contrast' : 'hero-colorblind';
      const on = localStorage.getItem(key) !== '1';
      localStorage.setItem(key, on ? '1' : '0');
      document.documentElement.classList.toggle(cls, on);
      sw.classList.toggle('on', on);
    }));
    panel.querySelectorAll('[data-scale]').forEach(b => b.addEventListener('click', () => {
      let s = parseFloat(localStorage.getItem('hero_ui_scale')||'1');
      s = b.dataset.scale==='+' ? Math.min(1.3, s+0.1) : Math.max(0.8, s-0.1);
      s = Math.round(s*10)/10;
      try{ localStorage.setItem('hero_ui_scale', s); }catch(e){}
      applyScale(s);
      const v = panel.querySelector('[data-el="scaleVal"]'); if(v) v.textContent = '%'+Math.round(s*100);
    }));
    const gb = panel.querySelector('[data-cc="guide"]'); if(gb) gb.addEventListener('click', showGuide);
    const tb = panel.querySelector('[data-cc="theme"]'); if(tb) tb.addEventListener('click', () => { closePanel(); try{ api.onTheme(); }catch(e){} });
  }

  function positionPanel(){
    if(!panel) return;
    const pw=248, ph=panel.offsetHeight||300, gap=8;
    let left = pos.left - pw + 46; // FAB'ın sol üstüne hizala
    let top = pos.top - ph - gap;  // FAB'ın üstüne aç
    if(left < 8) left = 8;
    if(left + pw > window.innerWidth-8) left = window.innerWidth-pw-8;
    if(top < 70){ top = pos.top + 54; } // yukarı sığmazsa aşağı aç
    if(top + ph > window.innerHeight-8) top = window.innerHeight-ph-8;
    panel.style.left = left+'px'; panel.style.top = top+'px';
  }

  function applyScale(s){
    // Oyun root'una ölçek uygula (varsa), yoksa body font-size
    const roots = ['.tetris-overlay','.chess-root','.tg-root','.kl-root','[data-el="game"]'];
    let applied=false;
    for(const sel of roots){ const el=document.querySelector(sel); if(el){ el.style.fontSize=(s*100)+'%'; applied=true; } }
    if(!applied) document.documentElement.style.setProperty('--hero-ui-scale', s);
  }
  // açılışta kayıtlı ölçeği uygula
  try{ const s=parseFloat(localStorage.getItem('hero_ui_scale')||'1'); if(s!==1) applyScale(s); }catch(e){}

  function showGuide(){
    const g = document.createElement('div');
    g.className='ghp-cc-guide'; g.style.setProperty('--cc-accent', theme.accent);
    g.innerHTML = `
      <div class="ghp-cc-guide-box">
        <div class="ghp-cc-guide-h">
          <span style="font-size:20px">${theme.icon}</span>
          <span class="gt">${theme.name} — Nasıl Oynanır</span>
          <button class="gx" data-g="close">✕</button>
        </div>
        ${GUIDE[gameKey].map(([h,p]) => `<div class="ghp-cc-guide-item"><div class="gh">${h}</div><div class="gp">${p}</div></div>`).join('')}
      </div>`;
    document.body.appendChild(g);
    g.querySelector('[data-g="close"]').addEventListener('click', ()=>g.remove());
    g.addEventListener('click', e=>{ if(e.target===g) g.remove(); });
  }

  function confirmExit(){
    closePanel();
    const c = document.createElement('div');
    c.className='ghp-cc-confirm'; c.style.setProperty('--cc-accent', theme.accent);
    c.innerHTML = `<div class="ghp-cc-confirm-box">
      <div class="ti">🏠</div><div class="tt">Ana menüye dön?</div>
      <div class="ts">${theme.name} oyunundan çıkacaksın. İlerlemen kaydedilir.</div>
      <div class="bs"><button class="stay">Devam</button><button class="go">🏠 Çık</button></div>
    </div>`;
    document.body.appendChild(c);
    c.querySelector('.stay').addEventListener('click', ()=>c.remove());
    c.querySelector('.go').addEventListener('click', ()=>{ c.remove(); doExit(); });
    c.addEventListener('click', e=>{ if(e.target===c) c.remove(); });
  }

  function doExit(after){
    try{ remove(); }catch(_){}
    try{ onExit && onExit(); }catch(err){ console.warn('[cc] exit', err); }
    try{ after && after(); }catch(e){}
  }

  function remove(){ fab.remove(); closePanel();
    window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
    window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up);
  }

  return { remove, open:openPanel, close:closePanel };
}

export default mountGameHome;
