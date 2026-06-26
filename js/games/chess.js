// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — UI / RENDER KATMANI (Canvas 2.5D)
//
//  chess-engine.js (saf mantık) üzerine kurulu görsel arayüz.
//  Osmanlı lacivert İznik teması, 2.5D gölgeli taşlar, dokunmatik.
// ════════════════════════════════════════════════════════════════
import Store from '../store.js';
import Auth from '../auth.js';
import { createVsHUD, getPortalNick, getPortalAvatar } from '../hud.js';
import { newGame, legalMoves, allLegalMoves, applyMove, inCheck, gameStatus, positionKey, toFEN, fromFEN, PIECE_NAMES } from './chess-engine.js';
import * as Resume from './resume.js';
import { chooseMove } from './chess-ai.js';
import { ChessSound as Sound } from './chess-audio.js';
import { ChessMP } from './chess-mp.js';

// ── Temalar (referans görsellerden: Osmanlı lacivert default) ──
const THEMES = {
  iznikmavi: {
    name: 'İznik Mavi',
    desc: 'Lapis lacivert ve beyaz çini, altın işleme.',
    light:'#edf0ec', dark:'#1e4fa0', lightTile:'#f4f6f2', darkTile:'#2a5eb2',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#0a1838',
    wTop:'#f8faf8', wBot:'#dbe4f0', bTop:'#0d7d92', bBot:'#064a58',
    wPiece:'#1e4fa0', bPiece:'#f2ead2', glow:'#3fa0ff'
  },
  sinan: {
    name: 'Mimar Sinan Mermer',
    desc: 'Beyaz mermer ve duman grisi, ince altın çizgiler.',
    light:'#ece6da', dark:'#6e6862', lightTile:'#f4efe6', darkTile:'#7e7872',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#1a1815',
    wTop:'#f8f4ec', wBot:'#dcd4c6', bTop:'#4a4640', bBot:'#2a2622',
    wPiece:'#4a4640', bPiece:'#f4efe6', glow:'#d4af37'
  },
  bursa: {
    name: 'Bursa Yeşil',
    desc: 'Zümrüt yeşili ve krem, ince çini detayları.',
    light:'#e8dcc0', dark:'#15543c', lightTile:'#f0e6cc', darkTile:'#1a6448',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#06241a',
    wTop:'#f5efe0', wBot:'#d8cba8', bTop:'#2a2824', bBot:'#16140f',
    wPiece:'#15543c', bPiece:'#f0e6cc', glow:'#3fe0a0'
  },
  canakkale: {
    name: 'Çanakkale Şafak',
    desc: 'Gece laciverti, sıcak bej ve şafak altını.',
    light:'#e0d0b0', dark:'#16294a', lightTile:'#ebdcbb', darkTile:'#1e335c',
    border:'#d4a857', borderDark:'#9a7d2f', bg:'#0a1428',
    wTop:'#f4e8d0', wBot:'#dcc8a4', bTop:'#2a2824', bBot:'#14120e',
    wPiece:'#16294a', bPiece:'#f4e8d0', glow:'#e0a860'
  },
  kapadokya: {
    name: 'Kapadokya Tüf',
    desc: 'Kum, taş ve ceviz ahşap tonları.',
    light:'#ddc9a3', dark:'#7d5a3a', lightTile:'#e6d4b2', darkTile:'#8a6644',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#1c130a',
    wTop:'#f0e2c8', wBot:'#d4be98', bTop:'#3a2a1c', bBot:'#221810',
    wPiece:'#5a3e26', bPiece:'#f0e2c8', glow:'#d8a860'
  },
  sedef: {
    name: 'Sedef Gece',
    desc: 'Sedef beyazı, siyah inci ve menekşe-mavi yansımalar.',
    light:'#e6e0ec', dark:'#3a3a5c', lightTile:'#efeaf4', darkTile:'#46466e',
    border:'#b0a0d0', borderDark:'#7868a0', bg:'#15152a',
    wTop:'#f4f0fa', wBot:'#dcd4e8', bTop:'#262236', bBot:'#16121f',
    wPiece:'#3a3a5c', bPiece:'#f4f0fa', glow:'#9080d0'
  },
  kizil: {
    name: 'Kızıl Sancak',
    desc: 'Bordo ve fildişi, zarif bordo dokular.',
    light:'#f0e8d8', dark:'#8a1c2c', lightTile:'#f5eede', darkTile:'#9a2434',
    border:'#d4af37', borderDark:'#9a7d27', bg:'#2a0a10',
    wTop:'#f8f0e0', wBot:'#e0d4bc', bTop:'#2a2420', bBot:'#160f0c',
    wPiece:'#8a1c2c', bPiece:'#f5eede', glow:'#ff6048'
  },
  otag: {
    name: 'Otağ Lacivert',
    desc: 'Lacivert derinlik, deri bej ve altın vurgular.',
    light:'#d8c4a0', dark:'#1a2a5c', lightTile:'#e2d0ac', darkTile:'#22356e',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#0a1024',
    wTop:'#f0e4c8', wBot:'#d4c098', bTop:'#2a2824', bBot:'#14120e',
    wPiece:'#1a2a5c', bPiece:'#f0e4c8', glow:'#d4af37'
  },
  safranbolu: {
    name: 'Safranbolu Ahşap',
    desc: 'Açık ve koyu ceviz, klasik ahşap işçilik.',
    light:'#d8b888', dark:'#6b4226', lightTile:'#e0c498', darkTile:'#7d4e2e',
    border:'#c8a557', borderDark:'#8a6d2f', bg:'#1a0e06',
    wTop:'#f0e0c0', wBot:'#d0b890', bTop:'#3a2414', bBot:'#22140a',
    wPiece:'#6b4226', bPiece:'#f0e0c0', glow:'#e0a860'
  }
};

// Hex rengi alpha ile rgba'ya çevirir: _hexA('#3fa0ff', .5) → 'rgba(63,160,255,.5)'
function _hexA(hex, a){
  if(!hex) return 'rgba(120,160,220,'+a+')';
  let h = hex.replace('#','');
  if(h.length === 3) h = h.split('').map(x=>x+x).join('');
  const r = parseInt(h.slice(0,2),16) || 0;
  const g = parseInt(h.slice(2,4),16) || 0;
  const b = parseInt(h.slice(4,6),16) || 0;
  return 'rgba('+r+','+g+','+b+','+a+')';
}

let SELECTED_THEME = (function(){ try{ const t = localStorage.getItem('hero_chess_theme'); return (t && THEMES[t]) ? t : 'iznikmavi'; }catch(e){ return 'iznikmavi'; } })();

// Unicode satranç sembolleri (dolu figürler — 2.5D stilize edilecek)
const GLYPH = { k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };

let G = null;   // aktif oyun durumu (DOM + state)

// ════════════ AÇILIŞ ════════════
export function openChess(){
  injectCSS();
  const root = document.createElement('div');
  root.className = 'chess-root';
  root.innerHTML = `
    <div class="chess-modes" data-el="modeSelect">
      <div class="cm-head">
        <button class="c-icon" data-act="close">✕</button>
        <div class="cm-title">♛ SATRANÇ</div>
        <div style="display:flex;gap:6px">
          <button class="c-icon" data-act="sound" title="Ses">🔊</button>
          <button class="c-icon" data-act="theme" title="Tema">🎨</button>
        </div>
      </div>
      <div class="cm-sub">Bir oyun modu seç</div>
      <div class="cm-cards">
        <button class="cm-card" data-mode="local">
          <span class="cm-ic">👥</span>
          <div class="cm-name">AYNI CİHAZDA 2 OYUNCU</div>
          <div class="cm-desc">Sırayla aynı ekranda oynayın</div>
        </button>
        <button class="cm-card" data-mode="ai">
          <span class="cm-ic">🤖</span>
          <div class="cm-name">YAPAY ZEKÂ</div>
          <div class="cm-desc">Bilgisayara karşı oyna</div>
        </button>
        <button class="cm-card" data-mode="online">
          <span class="cm-ic">🌐</span>
          <div class="cm-name">ÇEVRİMİÇİ</div>
          <div class="cm-desc">Arkadaşınla oda kodu ile oyna</div>
        </button>
      </div>
    </div>

    <div class="chess-game" data-el="game" style="display:none">
      <div class="cg-top">
        <button class="c-icon" data-act="exit">✕</button>
        <div class="cg-turn" data-el="turn">BEYAZ'IN SIRASI</div>
        <button class="c-icon" data-act="chat" title="Sohbet" data-el="chatBtn" style="display:none">💬<span class="chat-badge" data-el="chatBadge" style="display:none"></span></button>
        <button class="c-icon" data-act="restart" title="Yeniden">🔄</button>
      </div>
      <div class="cg-player cg-opp" data-el="oppPanel" style="display:none">
        <div class="cgp-avatar" data-el="oppAvatar">♟</div>
        <div class="cgp-info">
          <div class="cgp-name" data-el="oppName">Rakip</div>
          <div class="cgp-sub" data-el="oppSub"><span class="cgp-dot" data-el="oppDot"></span> <span data-el="oppStatus">bağlanıyor…</span></div>
        </div>
        <div class="cgp-cap" data-el="oppCap"></div>
        <div class="cgp-turn-badge" data-el="oppBadge">●</div>
      </div>
      <div class="cg-status" data-el="status"></div>
      <div class="cg-clocks" data-el="clocks" style="display:none">
        <div class="cg-clock" data-el="clockTop"><span class="cgk-label" data-el="clockTopLabel">Siyah</span><span class="cgk-time" data-el="clockTopTime">5:00</span></div>
        <div class="cg-clock" data-el="clockBot"><span class="cgk-label" data-el="clockBotLabel">Beyaz</span><span class="cgk-time" data-el="clockBotTime">5:00</span></div>
      </div>
      <div class="cg-actions" data-el="actions">
        <button class="cg-act-btn" data-act="undo" data-el="undoBtn">↩️ Geri Al</button>
        <button class="cg-act-btn" data-act="resign">🏳️ Pes Et</button>
        <button class="cg-act-btn" data-act="offerDraw">🤝 Beraberlik</button>
        <button class="cg-act-btn" data-act="history">📜 Geçmiş</button>
      </div>
      <div class="cg-board-wrap" data-el="boardWrap">
        <canvas data-el="canvas"></canvas>
      </div>
      <div class="cg-player cg-me" data-el="mePanel" style="display:none">
        <div class="cgp-avatar" data-el="meAvatar">♔</div>
        <div class="cgp-info">
          <div class="cgp-name" data-el="meName">Sen</div>
          <div class="cgp-sub" data-el="meSub"><span class="cgp-dot online"></span> <span data-el="meStatus">çevrimiçi</span></div>
        </div>
        <div class="cgp-cap" data-el="meCap"></div>
        <div class="cgp-turn-badge" data-el="meBadge">●</div>
      </div>
      <div class="cg-captured" data-el="captured"></div>
      <div class="cg-chat" data-el="chatPanel" style="display:none">
        <div class="cgc-head">
          <span>💬 Sohbet</span>
          <button class="cgc-close" data-act="chatClose">✕</button>
        </div>
        <div class="cgc-messages" data-el="chatMessages"></div>
        <div class="cgc-quick" data-el="chatQuick"></div>
        <div class="cgc-input-row">
          <input class="cgc-input" data-el="chatInput" maxlength="120" placeholder="Mesaj yaz…" autocomplete="off">
          <button class="cgc-send" data-act="chatSend">➤</button>
        </div>
      </div>
      <div class="cg-history" data-el="historyPanel" style="display:none">
        <div class="cgc-head">
          <span>📜 Hamle Geçmişi</span>
          <button class="cgc-close" data-act="historyClose">✕</button>
        </div>
        <div class="cgh-list" data-el="historyList"><div class="cgh-empty">Henüz hamle yok</div></div>
        <div class="cgh-fen">
          <button class="cgh-fen-btn" data-act="copyFEN">📋 Pozisyonu Kopyala (FEN)</button>
          <button class="cgh-fen-btn" data-act="loadFEN">📥 FEN Yükle</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  // Mod seçim
  root.querySelector('[data-act="close"]').addEventListener('click', closeAll);
  root.querySelector('[data-act="theme"]').addEventListener('click', () => showThemePicker(root));
  const soundBtn = root.querySelector('[data-act="sound"]');
  soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
  soundBtn.addEventListener('click', () => {
    const on = Sound.toggle();
    soundBtn.textContent = on ? '🔊' : '🔇';
  });
  root.querySelectorAll('.cm-card:not(.soon)').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      if(mode === 'ai'){ showAISetup(root); return; }
      if(mode === 'online'){ showOnlineLobby(root); return; }
      if(mode === 'local'){ showTimeSetup(root); return; }
      startGame(root, mode);
    });
  });

  G = { root, mode:null };
  G.vis = ()=>{ if(document.hidden){ try{ saveChessResume(); }catch(e){} } };
  document.addEventListener('visibilitychange', G.vis);

  // Kaldığın yerden devam teklifi (AI oyunu yarıda kaldıysa)
  const rsnap = Resume.loadSnapshot('chess');
  if(rsnap){
    const d = rsnap.data;
    const sub = root.querySelector('.cm-sub');
    const btn = document.createElement('button');
    btn.className = 'cm-card';
    btn.style.cssText = 'border:1px solid #f0b13266;background:linear-gradient(135deg,rgba(240,177,50,.18),rgba(240,177,50,.05))';
    const moveN = Math.ceil((d.moveHistory ? d.moveHistory.length : 0) / 2);
    btn.innerHTML = `<span class="cm-ic">↩️</span><div class="cm-name">KALDIĞIN YERDEN DEVAM</div><div class="cm-desc">Yapay Zekâ · ${moveN}. hamle · ${Resume.fmtAge(rsnap.age)}</div>`;
    btn.addEventListener('click', ()=>{ const r = Resume.loadSnapshot('chess'); if(r) resumeChess(root, r.data); });
    const cards = root.querySelector('.cm-cards');
    if(cards) cards.insertBefore(btn, cards.firstChild);
  }
}

// Çevrimiçi lobi: oda kur veya katıl
function showOnlineLobby(root){
  const ov = document.createElement('div');
  ov.className = 'chess-online-lobby';
  ov.innerHTML = `<div class="col-box">
    <button class="col-back" data-act="back">← Geri</button>
    <div class="col-title">🌐 ÇEVRİMİÇİ OYUN</div>
    <div class="col-panel" data-panel="choose">
      <button class="col-big" data-act="create">
        <span class="col-ic">➕</span>
        <div class="col-bname">ODA KUR</div>
        <div class="col-bdesc">Sen beyaz oynarsın · kod paylaş</div>
      </button>
      <button class="col-big" data-act="join">
        <span class="col-ic">🔑</span>
        <div class="col-bname">ODAYA KATIL</div>
        <div class="col-bdesc">Arkadaşının kodunu gir · siyah oyna</div>
      </button>
    </div>
    <div class="col-panel" data-panel="host" style="display:none">
      <div class="col-time-sel" data-el="hostTimeSel">
        <div class="cas-label" style="text-align:center">SÜRE SEÇ</div>
        <div class="cas-row cas-time" data-group="hosttime">
          ${TIME_OPTIONS.map((o,i) => `<button class="cas-opt${i===0?' active':''}" data-v="${o.v}">${o.label}</button>`).join('')}
        </div>
        <button class="col-create-go">✅ ODAYI KUR</button>
      </div>
      <div class="col-host-wait" data-el="hostWait" style="display:none">
        <div class="col-info">Oda kodun:</div>
        <div class="col-code" data-el="code">······</div>
        <button class="col-copy" data-act="copy">📋 KODU KOPYALA</button>
        <div class="col-hint">Bu kodu arkadaşınla paylaş.<br>Rakip bekleniyor…</div>
        <div class="col-spinner"></div>
      </div>
    </div>
    <div class="col-panel" data-panel="join" style="display:none">
      <div class="col-info">Arkadaşının oda kodunu gir:</div>
      <div class="col-input-row">
        <input class="col-input" data-el="codeInput" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">
        <button class="col-paste" data-act="paste" title="Yapıştır">📋</button>
      </div>
      <button class="col-connect" data-act="connect">BAĞLAN</button>
      <div class="col-status" data-el="joinStatus"></div>
    </div>
  </div>`;
  root.appendChild(ov);

  const showPanel = (name) => {
    ov.querySelectorAll('.col-panel').forEach(p => p.style.display = p.dataset.panel === name ? 'flex' : 'none');
  };

  ov.querySelector('[data-act="back"]').addEventListener('click', () => { ChessMP.close(); ov.remove(); });

  // ODA KUR — önce süre seçimi göster
  ov.querySelector('[data-act="create"]').addEventListener('click', () => {
    showPanel('host');
  });
  // Süre seçimi (host)
  const hostSel = { time: 0 };
  ov.querySelectorAll('[data-group="hosttime"] .cas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="hosttime"] .cas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); hostSel.time = parseInt(b.dataset.v, 10);
  }));
  // ODAYI KUR (süre seçildikten sonra)
  ov.querySelector('.col-create-go').addEventListener('click', () => {
    ov.querySelector('[data-el="hostTimeSel"]').style.display = 'none';
    ov.querySelector('[data-el="hostWait"]').style.display = 'flex';
    ChessMP.createRoom((type, data) => {
      if(type === 'code'){ ov.querySelector('[data-el="code"]').textContent = data; }
      else if(type === 'connected'){
        // misafire süreyi gönder, sonra oyunu başlat
        ChessMP.send({ type:'config', time: hostSel.time });
        ov.remove(); startGame(root, 'online', { playerColor: 'w', time: hostSel.time });
      }
      else if(type === 'error'){ ov.querySelector('.col-hint').innerHTML = '❌ ' + data + '<br>Tekrar dene.'; }
    });
  });

  // ODAYA KATIL
  ov.querySelector('[data-act="join"]').addEventListener('click', () => { showPanel('join'); });
  const input = ov.querySelector('[data-el="codeInput"]');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });
  ov.querySelector('[data-act="connect"]').addEventListener('click', () => {
    const code = input.value.trim();
    const st = ov.querySelector('[data-el="joinStatus"]');
    if(code.length !== 6){ st.textContent = 'Kod 6 haneli olmalı'; return; }
    st.textContent = '⏳ Bağlanılıyor…';
    ChessMP.joinRoom(code, (type, data) => {
      if(type === 'connected'){ ov.remove(); startGame(root, 'online', { playerColor: 'b' }); }
      else if(type === 'error'){ st.textContent = '❌ ' + data; }
    });
  });

  // KODU KOPYALA
  ov.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    const code = ov.querySelector('[data-el="code"]').textContent.trim();
    const btn = e.currentTarget;
    const done = () => { btn.textContent = '✅ KOPYALANDI'; setTimeout(() => { btn.textContent = '📋 KODU KOPYALA'; }, 1800); };
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
      } else { fallbackCopy(code, done); }
    }catch(err){ fallbackCopy(code, done); }
  });

  // KODU YAPIŞTIR
  ov.querySelector('[data-act="paste"]').addEventListener('click', async () => {
    try{
      if(navigator.clipboard && navigator.clipboard.readText){
        const txt = await navigator.clipboard.readText();
        input.value = (txt || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
      }
    }catch(err){ /* izin yoksa sessizce geç */ }
  });
}

// Pano API'si yoksa eski yöntemle kopyala
function fallbackCopy(text, done){
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    if(done) done();
  }catch(e){}
}

// Süre kontrol seçenekleri (saniye; 0 = süresiz)
const TIME_OPTIONS = [
  { v: 0,   label: '∞ Süresiz' },
  { v: 60,  label: '1 dk' },
  { v: 180, label: '3 dk' },
  { v: 300, label: '5 dk' },
  { v: 600, label: '10 dk' }
];

// Süre seçim satırı HTML'i üret
function timeRowHTML(){
  return `<div class="cas-label">SÜRE</div>
    <div class="cas-row cas-time" data-group="time">
      ${TIME_OPTIONS.map((o,i) => `<button class="cas-opt${i===0?' active':''}" data-v="${o.v}">${o.label}</button>`).join('')}
    </div>`;
}

// Süre seçim satırını bağla (seçili değeri obj.time'a yazar)
function bindTimeRow(ov, store){
  ov.querySelectorAll('[data-group="time"] .cas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="time"] .cas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); store.time = parseInt(b.dataset.v, 10);
  }));
}

// Aynı cihazda 2 oyuncu: süre + ekran dönme seçimi
function showTimeSetup(root){
  const ov = document.createElement('div');
  ov.className = 'chess-ai-setup';
  ov.innerHTML = `<div class="cas-box">
    <div class="cas-title">👥 2 OYUNCU</div>
    ${timeRowHTML()}
    <div class="cas-label">TAHTA YÖNÜ</div>
    <div class="cas-row" data-group="flip">
      <button class="cas-opt active" data-v="1">🔄 Sıra gelene dönsün</button>
      <button class="cas-opt" data-v="0">🔒 Sabit kalsın</button>
    </div>
    <div class="cas-hint" data-el="flipHint">Her oyuncunun sırasında tahta ona göre döner.</div>
    <button class="cas-start">▶ BAŞLA</button>
  </div>`;
  root.appendChild(ov);
  const sel = { time: 0, autoFlip: true };
  bindTimeRow(ov, sel);
  const hint = ov.querySelector('[data-el="flipHint"]');
  ov.querySelectorAll('[data-group="flip"] .cas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="flip"] .cas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); sel.autoFlip = (b.dataset.v === '1');
    hint.textContent = sel.autoFlip
      ? 'Her oyuncunun sırasında tahta ona göre döner.'
      : 'Tahta hep beyaz tarafından görünür (dönmez) — karışıklığı önler.';
  }));
  ov.querySelector('.cas-start').addEventListener('click', () => {
    ov.remove();
    startGame(root, 'local', { time: sel.time, autoFlip: sel.autoFlip });
  });
}

// AI kurulum: zorluk + renk seçimi
function showAISetup(root){
  const ov = document.createElement('div');
  ov.className = 'chess-ai-setup';
  ov.innerHTML = `<div class="cas-box">
    <div class="cas-head-row">
      <button class="cas-back" data-act="back">← Geri</button>
      <div class="cas-title">🤖 YAPAY ZEKÂ</div>
      <button class="cas-close" data-act="close">✕</button>
    </div>
    <div class="cas-label">ZORLUK</div>
    <div class="cas-row" data-group="diff">
      <button class="cas-opt" data-v="easy">😊 KOLAY</button>
      <button class="cas-opt active" data-v="medium">🎯 ORTA</button>
      <button class="cas-opt" data-v="hard">🔥 ZOR</button>
    </div>
    <div class="cas-label">SENİN RENGİN</div>
    <div class="cas-row" data-group="color">
      <button class="cas-opt active" data-v="w">⚪ BEYAZ (önce sen)</button>
      <button class="cas-opt" data-v="b">⚫ SİYAH</button>
    </div>
    ${timeRowHTML()}
    <button class="cas-start">▶ BAŞLA</button>
  </div>`;
  root.appendChild(ov);
  let diff = 'medium', color = 'w';
  const sel = { time: 0 };
  bindTimeRow(ov, sel);
  ov.querySelectorAll('[data-group="diff"] .cas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="diff"] .cas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); diff = b.dataset.v;
  }));
  ov.querySelectorAll('[data-group="color"] .cas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="color"] .cas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); color = b.dataset.v;
  }));
  const backB=ov.querySelector('[data-act="back"]'); if(backB) backB.addEventListener('click',()=>ov.remove());
  const closeB=ov.querySelector('[data-act="close"]'); if(closeB) closeB.addEventListener('click',()=>{ ov.remove(); if(root&&root.parentNode) root.remove(); });
  ov.querySelector('.cas-start').addEventListener('click', () => {
    ov.remove();
    startGame(root, 'ai', { difficulty: diff, playerColor: color, time: sel.time });
  });
}

function closeAll(){
  try{ if(G && G._home) G._home.remove(); }catch(e){}
  try{ saveChessResume(); }catch(e){}
  try{ if(G && G.vis) document.removeEventListener('visibilitychange', G.vis); }catch(e){}
  try{ if(G && G.online) ChessMP.close(); }catch(e){}
  try{ stopClockTick(); }catch(e){}
  if(G && G.root){ G.root.remove(); }
  if(G && G.resizeHandler) window.removeEventListener('resize', G.resizeHandler);
  G = null;
}

// ════════════ OYUN BAŞLAT ════════════
function startGame(root, mode, opts){
  opts = opts || {};
  root.querySelector('[data-el="modeSelect"]').style.display = 'none';
  const gameEl = root.querySelector('[data-el="game"]');
  gameEl.style.display = 'flex';
  // 🏠 Oyun içi ev butonu
  import('../game-home.js').then(m => {
    if(!G) return;
    G._home = m.mountGameHome('chess',
      () => { try{ closeAll(); }catch(e){} try{ import('../nav.js').then(n => n.go && n.go('home')); }catch(e){} },
      { sound: { get:()=>Sound.enabled, toggle:()=>Sound.toggle() } });
  }).catch(()=>{});

  const canvas = root.querySelector('[data-el="canvas"]');
  G.mode = mode;
  G.aiDifficulty = opts.difficulty || 'medium';
  G.playerColor = opts.playerColor || 'w';     // AI modunda insan rengi
  G.aiColor = G.playerColor === 'w' ? 'b' : 'w';
  G.aiThinking = false;
  G.state = newGame();
  // Portal HUD enjekte et (her oyun modunda)
  try{
    const oppNm = G.oppName || (G.mode==='ai'?'Yapay Zekâ':'Rakip');
    const oppUid = G.oppUid || null;
    createVsHUD({
      root: G.root, game:'chess', myAccent:'#FFD740', oppAccent:'#4A90D9',
      oppUid, oppNick: oppNm, oppAvatar: G.oppAvatar||'🤖',
      myScore: ()=>0, oppScore: ()=>0,
    }).then(h=>{ G._hud=h; }).catch(()=>{});
  }catch(e){}
  G.selected = null;        // {r,c}
  G.legalForSelected = [];  // o taşın geçerli hamleleri
  G.canvas = canvas;
  G.ctx = canvas.getContext('2d');
  G.boardWrap = root.querySelector('[data-el="boardWrap"]');
  G.lastMove = null;        // {from,to} — son hamle vurgusu
  G.captured = { w:[], b:[] };
  G.moveHistory = [];       // cebirsel notasyon listesi
  G.posHistory = [ positionKey(G.state) ];   // 3 hamle tekrarı takibi
  G.gameEnded = false;
  G.timeControl = opts.time || 0;   // saniye (0 = süresiz)
  G.clock = null;
  G.undoStack = [];                 // hamle geri alma için anlık görüntüler
  G.autoFlip = (opts.autoFlip !== undefined) ? opts.autoFlip : true;   // 2 oyuncu: tahta dönsün mü
  // AI modunda tahta sabit (insan rengine göre), 2 oyuncu modunda (autoFlip açıksa) döner
  G.flip = ((mode === 'ai' || mode === 'online') && G.playerColor === 'b');
  G.animating = false;

  if(mode === 'ai' && !opts.restore) Resume.clearSnapshot('chess');   // taze AI oyunu → eski devam kaydını sil
  // ── Kaldığın yerden devam: durumu geri yükle ──
  if(opts.restore){
    const r = opts.restore;
    try{
      if(r.state) G.state = r.state;
      G.moveHistory = r.moveHistory || [];
      G.posHistory = r.posHistory || [ positionKey(G.state) ];
      G.captured = r.captured || { w:[], b:[] };
      G.lastMove = r.lastMove || null;
      G._restoreClock = r.clock || null;
    }catch(e){}
  }

  // Çevrimiçi mod: hamle senkronizasyonu
  if(mode === 'online'){
    G.online = true;
    G._helloSent = false;
    setTimeout(() => { if(G && G.online){ G._helloSent = true; sendHello(); } }, 900);
    // Oyuncu panellerini göster (üst = rakip, alt = sen)
    const oppPanel = root.querySelector('[data-el="oppPanel"]');
    const mePanel = root.querySelector('[data-el="mePanel"]');
    oppPanel.style.display = 'flex';
    mePanel.style.display = 'flex';
    root.querySelector('[data-el="captured"]').style.display = 'none';   // panellerde gösteriliyor
    const meIsW = G.playerColor === 'w';
    root.querySelector('[data-el="meName"]').textContent = meIsW ? 'Sen (Beyaz)' : 'Sen (Siyah)';
    root.querySelector('[data-el="oppName"]').textContent = meIsW ? 'Rakip (Siyah)' : 'Rakip (Beyaz)';
    root.querySelector('[data-el="meAvatar"]').textContent = meIsW ? '♔' : '♚';
    root.querySelector('[data-el="oppAvatar"]').textContent = meIsW ? '♚' : '♔';
    root.querySelector('[data-el="oppStatus"]').textContent = 'çevrimiçi';
    root.querySelector('[data-el="oppDot"]').classList.add('online');
    setupChat(root);
    ChessMP.__setHandler((type, data) => {
      if(type === 'message'){
        if(data && data.type === 'hello'){ onHello(data); return; }
        if(data && data.type === 'fullsync'){ applyFullSync(data.state); return; }
        if(data && data.type === 'resync_request'){ sendFullSync(); return; }
        onRemoteMessage(data);
      }
      else if(type === 'disconnected'){
        updateStatus('🔌 Rakip ayrıldı — yeniden bağlanılıyor…', 'draw'); G.oppLeft = true;
        root.querySelector('[data-el="oppStatus"]').textContent = 'bağlantı koptu';
        root.querySelector('[data-el="oppDot"]').classList.remove('online');
        updatePanels();
      }
      else if(type === 'reconnecting'){
        const tries = (data && data.tries) || 0, max = (data && data.max) || 6;
        updateStatus(`🔄 Yeniden bağlanılıyor… (${tries}/${max})`, 'draw');
        root.querySelector('[data-el="oppStatus"]').textContent = 'yeniden bağlanılıyor…';
      }
      else if(type === 'reconnected'){
        G.oppLeft = false;
        updateStatus('✅ Yeniden bağlanıldı!', 'win');
        root.querySelector('[data-el="oppStatus"]').textContent = 'çevrimiçi';
        root.querySelector('[data-el="oppDot"]').classList.add('online');
        updatePanels();
        // Host güncel state'i gönderir; misafir state ister
        if(G.playerColor === 'w'){ setTimeout(sendFullSync, 400); }
        else { setTimeout(() => ChessMP.send({ type:'resync_request' }), 400); }
        setTimeout(() => { if(!G.gameEnded) updateStatus((G.state.turn==='w'?'BEYAZ':'SİYAH')+"'IN SIRASI"); }, 2200);
      }
      else if(type === 'reconnect_failed'){
        updateStatus('❌ Yeniden bağlanılamadı', 'lose');
        root.querySelector('[data-el="oppStatus"]').textContent = 'ayrıldı';
        G.oppLeft = true; updatePanels();
      }
    });
  }

  // Kontroller
  gameEl.querySelector('[data-act="exit"]').addEventListener('click', closeAll);
  gameEl.querySelector('[data-act="restart"]').addEventListener('click', () => {
    G.state = newGame();
  // Portal HUD enjekte et (her oyun modunda)
  try{
    const oppNm = G.oppName || (G.mode==='ai'?'Yapay Zekâ':'Rakip');
    const oppUid = G.oppUid || null;
    createVsHUD({
      root: G.root, game:'chess', myAccent:'#FFD740', oppAccent:'#4A90D9',
      oppUid, oppNick: oppNm, oppAvatar: G.oppAvatar||'🤖',
      myScore: ()=>0, oppScore: ()=>0,
    }).then(h=>{ G._hud=h; }).catch(()=>{});
  }catch(e){} G.selected=null; G.legalForSelected=[]; G.lastMove=null;
    G.captured={w:[],b:[]}; G.aiThinking=false; G.gameEnded=false;
    G.moveHistory=[]; G.posHistory=[positionKey(G.state)];
    clearHistoryUI();
    G.flip = ((G.mode === 'ai' || G.mode === 'online') && G.playerColor === 'b');
    updateTurn(); updateStatus(''); updateCaptured(); draw();
    maybeAIMove();
  });

  // Pes Et
  gameEl.querySelector('[data-act="resign"]').addEventListener('click', () => {
    if(G.gameEnded) return;
    showConfirm('Pes etmek istediğine emin misin?', () => {
      G.gameEnded = true;
      if(G.mode === 'online'){ ChessMP.send({ type:'resign' }); }
      updateStatus('🏳️ Pes ettin — Rakip kazandı', 'draw');
      try{ Sound.lose(); }catch(e){}
      onGameEnd(false);   // pes eden kaybeder → kaybetme ödülü
    });
  });

  // Beraberlik Teklif Et
  gameEl.querySelector('[data-act="offerDraw"]').addEventListener('click', () => {
    if(G.gameEnded) return;
    offerDraw();
  });

  // Hamle Geçmişi
  gameEl.querySelector('[data-act="history"]').addEventListener('click', () => {
    const panel = gameEl.querySelector('[data-el="historyPanel"]');
    panel.style.display = 'flex';
  });
  gameEl.querySelector('[data-act="historyClose"]').addEventListener('click', () => {
    gameEl.querySelector('[data-el="historyPanel"]').style.display = 'none';
  });

  // Hamle Geri Al (online'da gizli — rakip senkronu nedeniyle)
  const undoBtn = gameEl.querySelector('[data-el="undoBtn"]');
  if(mode === 'online'){ undoBtn.style.display = 'none'; }
  else { undoBtn.addEventListener('click', () => undoMove()); }

  // FEN Kopyala
  gameEl.querySelector('[data-act="copyFEN"]').addEventListener('click', (e) => {
    const fullmove = Math.floor(G.moveHistory.length / 2) + 1;
    const fen = toFEN(G.state, fullmove);
    const btn = e.currentTarget;
    const done = () => { const o = btn.textContent; btn.textContent = '✅ Kopyalandı'; setTimeout(() => { btn.textContent = o; }, 1600); };
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(fen).then(done).catch(() => fallbackCopy(fen, done)); }
      else fallbackCopy(fen, done);
    }catch(err){ fallbackCopy(fen, done); }
  });

  // FEN Yükle
  gameEl.querySelector('[data-act="loadFEN"]').addEventListener('click', () => showFENLoader());

  // Dokunma / tıklama
  canvas.addEventListener('click', onBoardClick);

  // Boyutlandırma
  G.resizeHandler = () => fitCanvas();
  window.addEventListener('resize', G.resizeHandler);

  fitCanvas();
  updateTurn();
  updateCaptured();
  draw();

  // Süre kontrolü etkinse saati kur (misafir hariç — o config mesajıyla kurar)
  if(G.timeControl > 0 && !(mode === 'online' && G.playerColor === 'b')){
    setupClock(G.timeControl);
    if(G._restoreClock){ G.clock = { w:G._restoreClock.w, b:G._restoreClock.b }; G._restoreClock=null; try{ updateClockDisplay(); }catch(e){} }
  }
  if(opts.restore){ try{ updateCaptured(); draw(); }catch(e){} }

  // AI beyazsa ilk hamleyi AI yapar
  maybeAIMove();
}

// ── Satranç: kaldığın yerden devam (yalnız AI modu) ──
function saveChessResume(){
  if(!G || G.mode !== 'ai' || G.gameEnded || !G.state) return;
  try{
    Resume.saveSnapshot('chess', {
      aiDifficulty: G.aiDifficulty, playerColor: G.playerColor, timeControl: G.timeControl || 0,
      state: G.state, moveHistory: G.moveHistory, posHistory: G.posHistory,
      captured: G.captured, lastMove: G.lastMove,
      clock: G.clock ? { w: G.clock.w, b: G.clock.b } : null
    });
  }catch(e){}
}
function resumeChess(root, data){
  startGame(root, 'ai', {
    difficulty: data.aiDifficulty || 'medium',
    playerColor: data.playerColor || 'w',
    time: data.timeControl || 0,
    restore: data
  });
}

// AI'nın sırası mı? Öyleyse hamle yaptır (UI'yi bloklamadan)
function maybeAIMove(){
  if(!G || G.mode !== 'ai') return;
  if(G.state.turn !== G.aiColor) return;
  const status = gameStatus(G.state);
  if(status === 'checkmate' || status === 'stalemate') return;

  G.aiThinking = true;
  updateStatus('🤖 Düşünüyor…', 'thinking');
  // setTimeout ile ana thread'e nefes aldır (UI çizimi tamamlansın)
  setTimeout(() => {
    if(!G || G.mode !== 'ai') return;
    let mv = null;
    try{ mv = chooseMove(G.state, G.aiDifficulty); }catch(e){ console.warn('[chess-ai]', e); }
    G.aiThinking = false;
    if(!mv){ return; }
    // AI hamlesini uygula (yeme kaydı dahil)
    const target = G.state.board[mv.to.r][mv.to.c];
    const mover = G.state.board[mv.from.r][mv.from.c];
    if(target){ G.captured[mover.c].push(target.t); }
    if(mv.enPassant){ G.captured[mover.c].push('p'); }
    finishMove(mv);
  }, 260);
}

// ════════════ CANVAS BOYUT ════════════
function fitCanvas(){
  if(!G || !G.canvas) return;
  const wrap = G.boardWrap;
  const size = Math.min(wrap.clientWidth, wrap.clientHeight) || Math.min(window.innerWidth - 24, 440);
  const dpr = window.devicePixelRatio || 1;
  G.boardPx = size;
  G.cell = Math.floor((size - 2 * boardMargin(size)) / 8);
  G.margin = boardMargin(size);
  G.canvas.width = size * dpr;
  G.canvas.height = size * dpr;
  G.canvas.style.width = size + 'px';
  G.canvas.style.height = size + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}
function boardMargin(size){ return Math.round(size * 0.04); }   // altın çerçeve payı

// ════════════ ÇİZİM ════════════
function draw(){
  if(!G || !G.ctx) return;
  const ctx = G.ctx, t = THEMES[SELECTED_THEME], m = G.margin, cell = G.cell, sz = G.boardPx;
  ctx.clearRect(0, 0, sz, sz);

  // Arka plan
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, sz, sz);

  // Altın çerçeve
  drawBorder(ctx, t, sz, m);

  // Kareler — premium: yumuşak köşegen gradyan + ince iç kenar parlaması
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const { x, y } = cellXY(r, c);
    const isLight = (r + c) % 2 === 0;
    const base = isLight ? t.light : t.dark;
    const tile = isLight ? t.lightTile : t.darkTile;
    // Köşegen gradyan (üst-sol açık → alt-sağ koyu) — derinlik hissi
    const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
    g.addColorStop(0, tile);
    g.addColorStop(1, base);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, cell, cell);
    // Üst kenar ince parlama (ışık üstten gelir)
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    ctx.fillRect(x, y, cell, Math.max(1, cell*0.03));
    // Alt kenar ince gölge
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.fillRect(x, y + cell - Math.max(1, cell*0.03), cell, Math.max(1, cell*0.03));
  }
  // Kareler arası ince ızgara çizgisi (premium ayrım)
  ctx.strokeStyle = 'rgba(0,0,0,.10)';
  ctx.lineWidth = 1;
  for(let i=0;i<=8;i++){
    const p = cellXY(0,0).x + i*cell;
    const py = cellXY(0,0).y + i*cell;
    ctx.beginPath(); ctx.moveTo(p, cellXY(0,0).y); ctx.lineTo(p, cellXY(0,0).y + cell*8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cellXY(0,0).x, py); ctx.lineTo(cellXY(0,0).x + cell*8, py); ctx.stroke();
  }

  // Son hamle vurgusu — yumuşak altın parlama + kenar
  if(G.lastMove){
    for(const sq of [G.lastMove.from, G.lastMove.to]){
      const { x, y } = cellXY(sq.r, sq.c);
      ctx.fillStyle = 'rgba(212,175,55,.28)';
      ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = 'rgba(212,175,55,.55)';
      ctx.lineWidth = Math.max(1.5, cell*0.03);
      ctx.strokeRect(x + ctx.lineWidth/2, y + ctx.lineWidth/2, cell - ctx.lineWidth, cell - ctx.lineWidth);
    }
  }

  // Şah çekiliyorsa şahın karesini kırmızı vurgula
  const checkColor = G.state.turn;
  if(inCheck(G.state, checkColor)){
    const k = findKingPos(G.state.board, checkColor);
    if(k){
      const { x, y } = cellXY(k.r, k.c);
      const rg = ctx.createRadialGradient(x+cell/2, y+cell/2, cell*0.1, x+cell/2, y+cell/2, cell*0.6);
      rg.addColorStop(0, 'rgba(255,60,60,.55)');
      rg.addColorStop(1, 'rgba(255,60,60,.15)');
      ctx.fillStyle = rg;
      ctx.fillRect(x, y, cell, cell);
    }
  }

  // Seçili kare + geçerli hamleler — tema rengiyle uyumlu, premium
  if(G.selected){
    const { x, y } = cellXY(G.selected.r, G.selected.c);
    // seçili kare: tema glow yumuşak dolgu + kenar
    const sg = ctx.createRadialGradient(x+cell/2, y+cell/2, cell*0.1, x+cell/2, y+cell/2, cell*0.7);
    sg.addColorStop(0, _hexA(t.glow, .42));
    sg.addColorStop(1, _hexA(t.glow, .18));
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, cell, cell);
    ctx.strokeStyle = _hexA(t.glow, .7); ctx.lineWidth = Math.max(1.5, cell*0.03);
    ctx.strokeRect(x + ctx.lineWidth/2, y + ctx.lineWidth/2, cell - ctx.lineWidth, cell - ctx.lineWidth);
    for(const mv of G.legalForSelected){
      const cc = cellXY(mv.to.r, mv.to.c);
      const target = G.state.board[mv.to.r][mv.to.c];
      ctx.save();
      if(target){
        // yeme: kalın tema halkası + hafif iç parlama
        ctx.strokeStyle = _hexA(t.glow, .85); ctx.lineWidth = Math.max(2.5, cell*0.055);
        ctx.beginPath(); ctx.arc(cc.x+cell/2, cc.y+cell/2, cell*0.40, 0, Math.PI*2); ctx.stroke();
      } else {
        // boş: yumuşak nokta + halo
        const dg = ctx.createRadialGradient(cc.x+cell/2, cc.y+cell/2, 0, cc.x+cell/2, cc.y+cell/2, cell*0.20);
        dg.addColorStop(0, _hexA(t.glow, .65));
        dg.addColorStop(1, _hexA(t.glow, .15));
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(cc.x+cell/2, cc.y+cell/2, cell*0.18, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // Taşlar
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = G.state.board[r][c];
    if(!p) continue;
    // Animasyon: hareket eden taşı varış karesinde çizme (ayrı interpole çizilecek)
    if(G.anim && G.anim.to.r === r && G.anim.to.c === c) continue;
    drawPiece(ctx, r, c, p, t);
  }

  // Animasyonlu taş (kalkış → varış arası interpole)
  if(G.anim){
    const fromXY = cellXY(G.anim.from.r, G.anim.from.c);
    const toXY = cellXY(G.anim.to.r, G.anim.to.c);
    const e = easeOutCubic(G.anim.progress);
    const cx = fromXY.x + (toXY.x - fromXY.x) * e + G.cell/2;
    const cy = fromXY.y + (toXY.y - fromXY.y) * e + G.cell/2;
    drawPieceAt(ctx, cx, cy, G.anim.piece, t);
  }

  // Kenar koordinatları (a-h, 1-8)
  drawCoords(ctx, t, m, cell, sz);
}

function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

// Hamleyi cebirsel notasyona çevir (hamleden ÖNCEki state ile)
// Sonuç: e4, Nf3, exd5, O-O, O-O-O, e8=Q, Qxh7+, vb
function moveToNotation(state, mv){
  const piece = state.board[mv.from.r][mv.from.c];
  if(!piece) return '?';
  // Rok
  if(mv.castle === 'k') return notationCheck(state, mv, 'O-O');
  if(mv.castle === 'q') return notationCheck(state, mv, 'O-O-O');
  const files = 'abcdefgh';
  const toSq = files[mv.to.c] + (8 - mv.to.r);
  const isCapture = !!state.board[mv.to.r][mv.to.c] || !!mv.enPassant;
  let s = '';
  if(piece.t === 'p'){
    // piyade: yeme varsa kalkış dosyası
    if(isCapture) s += files[mv.from.c] + 'x';
    s += toSq;
    if(mv.promotion) s += '=' + mv.promotion.toUpperCase();
  } else {
    s += piece.t.toUpperCase();
    // belirsizlik çözümü: aynı tip başka taş da bu kareye gidebiliyorsa kalkış belirt
    s += disambiguation(state, mv, piece);
    if(isCapture) s += 'x';
    s += toSq;
  }
  return notationCheck(state, mv, s);
}

// Şah/mat işareti ekle (+/#)
function notationCheck(state, mv, base){
  const ns = applyMove(state, mv);
  const st = gameStatus(ns);
  if(st === 'checkmate') return base + '#';
  if(st === 'check') return base + '+';
  return base;
}

// Belirsizlik: aynı tip taş aynı kareye gidebiliyorsa kalkış dosyası/sırası
function disambiguation(state, mv, piece){
  const files = 'abcdefgh';
  let sameFile = false, sameRank = false, ambiguous = false;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    if(r === mv.from.r && c === mv.from.c) continue;
    const p = state.board[r][c];
    if(p && p.t === piece.t && p.c === piece.c){
      const ms = legalMoves(state, r, c);
      if(ms.some(m => m.to.r === mv.to.r && m.to.c === mv.to.c)){
        ambiguous = true;
        if(c === mv.from.c) sameFile = true;
        if(r === mv.from.r) sameRank = true;
      }
    }
  }
  if(!ambiguous) return '';
  if(!sameFile) return files[mv.from.c];        // dosya yeterli
  if(!sameRank) return String(8 - mv.from.r);   // sıra yeterli
  return files[mv.from.c] + (8 - mv.from.r);    // ikisi de
}

// Tahta yönüne göre satır/sütun → piksel
function cellXY(r, c){
  const rr = G.flip ? 7 - r : r;
  const cc = G.flip ? 7 - c : c;
  return { x: G.margin + cc * G.cell, y: G.margin + rr * G.cell };
}
// Piksel → satır/sütun (tıklama için, ters dönüşüm)
function xyToCell(px, py){
  const cc = Math.floor((px - G.margin) / G.cell);
  const rr = Math.floor((py - G.margin) / G.cell);
  if(cc < 0 || cc > 7 || rr < 0 || rr > 7) return null;
  const r = G.flip ? 7 - rr : rr;
  const c = G.flip ? 7 - cc : cc;
  return { r, c };
}

function drawBorder(ctx, t, sz, m){
  // dış altın bant
  const grad = ctx.createLinearGradient(0, 0, sz, sz);
  grad.addColorStop(0, t.border); grad.addColorStop(0.5, t.borderDark); grad.addColorStop(1, t.border);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, sz, sz);
  // iç gölge (oyma hissi)
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
  ctx.strokeRect(m - 3, m - 3, sz - 2*(m-3), sz - 2*(m-3));
  // tahta arka zemini
  ctx.fillStyle = t.bg;
  ctx.fillRect(m, m, sz - 2*m, sz - 2*m);
}


// 2.5D taş: gölgeli yuvarlak taban + sembol (kare konumunda)
function drawPiece(ctx, r, c, piece, t){
  const { x, y } = cellXY(r, c);
  drawPieceAt(ctx, x + G.cell/2, y + G.cell/2, piece, t);
}

// Premium figüratif taş çizimi — kabartmalı, altın kenarlı, gradyanlı (3D his)
function drawPieceAt(ctx, cx, cy, piece, t){
  const isW = piece.c === 'w';
  const s = G.cell;
  // Hacim renkleri (üst açık → alt koyu) — beyaz: fildişi-altın, siyah: obsidyen
  const top  = isW ? '#fdf8ec' : '#5a5a68';
  const mid  = isW ? '#ece0c6' : '#2e2e3a';
  const bot  = isW ? '#cdbb92' : '#0f0c16';
  const edge = isW ? '#8a7142' : '#020208';
  const glyph = GLYPH[piece.t];

  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // zemin gölgesi (taşı tahtaya oturtur) — yumuşak çift katman
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.filter = 'blur(1px)';
  ctx.beginPath(); ctx.ellipse(cx, cy + s*0.32, s*0.29, s*0.085, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(cx, cy + s*0.31, s*0.24, s*0.065, 0, 0, Math.PI*2); ctx.fill();

  const fs = Math.floor(s * 0.76);
  ctx.font = `${fs}px "Segoe UI Symbol","Noto Sans Symbols2","Apple Symbols",serif`;
  const yo = cy + s*0.015;   // optik merkez düzeltmesi

  // 1) düşen gölge (derinlik)
  ctx.fillStyle = 'rgba(0,0,0,.40)';
  ctx.fillText(glyph, cx + s*0.028, yo + s*0.04);

  // 2) kalın koyu/altın taban kenar (taşın silueti)
  ctx.lineJoin = 'round'; ctx.lineWidth = s*0.085; ctx.strokeStyle = edge;
  ctx.strokeText(glyph, cx, yo);

  // 3) ana gövde — dikey gradyan (hacim)
  const grad = ctx.createLinearGradient(cx, yo - fs*0.5, cx, yo + fs*0.5);
  grad.addColorStop(0, top); grad.addColorStop(0.5, mid); grad.addColorStop(1, bot);
  ctx.fillStyle = grad; ctx.fillText(glyph, cx, yo);

  // 4) üst parlama (ışık) — üst kısma kırp
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - s*0.5, yo - fs*0.62, s, fs*0.42); ctx.clip();
  ctx.fillStyle = isW ? 'rgba(255,255,255,.50)' : 'rgba(255,255,255,.22)';
  ctx.fillText(glyph, cx, yo);
  ctx.restore();

  // 5) ince keskin dış çizgi (altın vurgu)
  ctx.lineWidth = Math.max(1, s*0.016);
  ctx.strokeStyle = isW ? 'rgba(120,95,40,.55)' : 'rgba(200,170,90,.30)';
  ctx.strokeText(glyph, cx, yo);

  ctx.restore();
}

function drawCoords(ctx, t, m, cell, sz){
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.font = `${Math.floor(cell*0.18)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const files = G.flip ? 'hgfedcba' : 'abcdefgh';
  const ranks = G.flip ? '12345678' : '87654321';
  for(let i=0;i<8;i++){
    ctx.fillText(files[i], m + i*cell + cell/2, sz - m*0.5);   // alt: dosyalar
    ctx.fillText(ranks[i], m*0.5, m + i*cell + cell/2);        // sol: sıralar
  }
  ctx.restore();
}

function findKingPos(board, color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.t==='k' && p.c===color) return {r,c};
  }
  return null;
}

// ════════════ TIKLAMA / HAMLE ════════════
function onBoardClick(e){
  if(!G || G.animating || G.aiThinking || G.gameEnded) return;
  // AI modunda sadece insan kendi sırasında oynayabilir
  if(G.mode === 'ai' && G.state.turn !== G.playerColor) return;
  // Çevrimiçi modda sadece kendi rengini, kendi sıranda oyna
  if(G.mode === 'online'){
    if(G.oppLeft) return;
    if(G.state.turn !== G.playerColor) return;
  }
  const status = gameStatus(G.state);
  if(status === 'checkmate' || status === 'stalemate') return;   // oyun bitti

  const rect = G.canvas.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const sq = xyToCell(px, py);
  if(!sq) return;

  const piece = G.state.board[sq.r][sq.c];

  // Seçili taş varsa ve tıklanan kare geçerli hamle ise → hamle yap
  if(G.selected){
    const mv = G.legalForSelected.find(m => m.to.r === sq.r && m.to.c === sq.c);
    if(mv){ doMove(mv); return; }
  }

  // Kendi taşına tıklandıysa seç
  if(piece && piece.c === G.state.turn){
    G.selected = { r: sq.r, c: sq.c };
    G.legalForSelected = legalMoves(G.state, sq.r, sq.c);
    try{ Sound.select(); }catch(e){}
    draw();
    return;
  }

  // Boş/düşman kareye tıklandı → seçimi kaldır
  G.selected = null; G.legalForSelected = [];
  draw();
}

function doMove(mv){
  // yeme varsa kaydet
  const target = G.state.board[mv.to.r][mv.to.c];
  const mover = G.state.board[mv.from.r][mv.from.c];
  if(target){ G.captured[mover.c].push(target.t); }
  if(mv.enPassant){ G.captured[mover.c].push('p'); }

  // terfi seçimi (piyade son sıraya gelince)
  if(mv.promotion){
    showPromotion(mover.c, (chosen) => {
      const full = { ...mv, promotion: chosen };
      sendMoveOnline(full);
      finishMove(full);
    });
    return;
  }
  sendMoveOnline(mv);
  finishMove(mv);
}

// Çevrimiçi modda yerel hamleyi rakibe gönder
function sendMoveOnline(mv){
  if(G.mode === 'online' && !G.applyingRemote){
    ChessMP.send({ type:'move', move: { from: mv.from, to: mv.to, promotion: mv.promotion, castle: mv.castle, double: mv.double, enPassant: mv.enPassant } });
  }
}

// Rakipten gelen mesaj
// ── Reconnect sonrası tam state senkronizasyonu ──
function sendFullSync(){
  if(!G || !ChessMP.connected) return;
  try{
    ChessMP.send({
      type: 'fullsync',
      state: {
        board: G.state.board,
        turn: G.state.turn,
        castling: G.state.castling || null,
        ep: G.state.ep || null,
        halfmove: G.state.halfmove || 0,
        moveHistory: G.moveHistory || [],
        captured: G.captured || { w:[], b:[] },
        lastMove: G.lastMove || null,
        posHistory: G.posHistory || [],
        scores: G.scores || null,
        gameEnded: !!G.gameEnded,
      }
    });
  }catch(e){ console.warn('[chess] sendFullSync', e); }
}

function applyFullSync(s){
  if(!G || !s) return;
  try{
    if(s.board){ G.state.board = s.board; }
    if(s.turn){ G.state.turn = s.turn; }
    if(s.castling !== undefined) G.state.castling = s.castling;
    if(s.ep !== undefined) G.state.ep = s.ep;
    if(s.halfmove !== undefined) G.state.halfmove = s.halfmove;
    G.moveHistory = s.moveHistory || G.moveHistory || [];
    G.captured = s.captured || G.captured || { w:[], b:[] };
    G.lastMove = s.lastMove || null;
    G.posHistory = s.posHistory || G.posHistory || [];
    if(s.scores) G.scores = s.scores;
    G.selected = null; G.legalForSelected = [];
    drawBoard();
    if(typeof updatePanels === 'function') updatePanels();
    if(!G.gameEnded) updateStatus((G.state.turn==='w'?'BEYAZ':'SİYAH')+"'IN SIRASI");
  }catch(e){ console.warn('[chess] applyFullSync', e); }
}

function sendHello(){
  try{
    import('../auth.js').then(m => {
      const st = m.Auth.getState();
      ChessMP.send({ type:'hello', uid: st.uid || null, name: getPortalNick(st) });
    });
  }catch(e){}
}
function onHello(d){
  if(!G) return;
  G.oppUid = d.uid || null;
  const el = G.root && G.root.querySelector('[data-el="oppName"]');
  if(el){
    if(d.name) el.textContent = d.name;
    if(G.oppUid){ el.dataset.opc = G.oppUid; el.style.cursor = 'pointer'; el.style.textDecoration = 'underline dotted'; }
  }
  if(!G._helloSent){ G._helloSent = true; sendHello(); }   // karşılık ver (1 kez)
}
function onRemoteMessage(data){
  if(!data || !G) return;
  if(data.type === 'move' && data.move){
    const mv = data.move;
    // gelen hamlenin yeme bilgisini yerelde de kaydet
    const target = G.state.board[mv.to.r] && G.state.board[mv.to.r][mv.to.c];
    const mover = G.state.board[mv.from.r] && G.state.board[mv.from.r][mv.from.c];
    if(mover){
      if(target){ G.captured[mover.c].push(target.t); }
      if(mv.enPassant){ G.captured[mover.c].push('p'); }
    }
    G.applyingRemote = true;
    finishMove(mv);
    G.applyingRemote = false;
  } else if(data.type === 'resign'){
    updateStatus('🏳️ Rakip pes etti — KAZANDIN!', 'win');
    G.oppLeft = true; G.gameEnded = true;
    try{ Sound.win(); }catch(e){}
    onGameEnd(true);   // rakip pes etti → kazanma ödülü
  } else if(data.type === 'drawOffer'){
    handleDrawOffer();
  } else if(data.type === 'drawAccept'){
    G.gameEnded = true;
    updateStatus('🤝 BERABERE — Karşılıklı anlaşma', 'draw');
    try{ Sound.draw(); }catch(e){}
    onGameEndDraw();   // beraberlik ödülü
  } else if(data.type === 'drawDecline'){
    updateStatus('Rakip beraberliği reddetti', 'check');
    setTimeout(() => { if(G && !G.gameEnded) updateStatus(''); }, 2000);
  } else if(data.type === 'config'){
    // host süreyi belirledi → misafir saatini kur
    if(data.time && data.time > 0){ setupClock(data.time); }
  } else if(data.type === 'chat'){
    addChatMessage((data.text || '').slice(0, 120), false);
  }
}

function finishMove(mv){
  // Animasyon için: hareket eden taşı + yeme bilgisini hamleden ÖNCE yakala
  const movingPiece = G.state.board[mv.from.r][mv.from.c];
  const isCapture = !!G.state.board[mv.to.r][mv.to.c] || !!mv.enPassant;

  // Animasyonu başlat (taş kalkıştan varışa kayar)
  G.animating = true;
  G.anim = { from: mv.from, to: mv.to, piece: movingPiece, progress: 0 };
  const start = performance.now();
  const DUR = 200;   // ms

  const step = (now) => {
    if(!G || !G.anim) return;
    G.anim.progress = Math.min(1, (now - start) / DUR);
    draw();
    if(G.anim.progress < 1){
      requestAnimationFrame(step);
    } else {
      // Animasyon bitti → hamleyi uygula
      G.anim = null;
      G.animating = false;
      applyAndContinue(mv, isCapture);
    }
  };
  requestAnimationFrame(step);
}

// Animasyon bittikten sonra: state güncelle, ses çal, durum kontrol
function applyAndContinue(mv, isCapture){
  // Undo için: hamleden ÖNCEki tam durumu kaydet
  if(G.undoStack){
    G.undoStack.push({
      state: G.state,   // immutable (applyMove yeni state üretir)
      captured: { w: G.captured.w.slice(), b: G.captured.b.slice() },
      lastMove: G.lastMove,
      historyLen: G.moveHistory.length,
      posLen: G.posHistory.length
    });
    if(G.undoStack.length > 100) G.undoStack.shift();
  }

  // Notasyonu hamleden ÖNCE (mevcut state ile) üret
  const notation = moveToNotation(G.state, mv);
  const moverColor = G.state.turn;

  G.state = applyMove(G.state, mv);
  G.lastMove = { from: mv.from, to: mv.to };
  G.selected = null; G.legalForSelected = [];

  // Hamle geçmişine ekle
  G.moveHistory.push({ notation, color: moverColor });
  addHistoryRow(notation, moverColor);

  // 3 hamle tekrarı takibi
  const key = positionKey(G.state);
  G.posHistory.push(key);
  const repeats = G.posHistory.filter(k => k === key).length;

  // 2 oyuncu modunda tahtayı çevir; AI modunda sabit
  if(G.mode === 'local' && G.autoFlip){ G.flip = (G.state.turn === 'b'); }

  updateTurn();
  updateCaptured();
  updateClockDisplay();
  draw();

  // Durum + ses
  const status = gameStatus(G.state);
  if(status === 'checkmate'){
    // Mat edilen taraf = sırası gelen taraf (hamle yapamıyor). Kazanan = diğeri.
    const matedColor = G.state.turn;        // 'w' veya 'b' (mat olan)
    const winnerColor = matedColor === 'w' ? 'b' : 'w';
    const winnerName = winnerColor === 'w' ? 'BEYAZ' : 'SİYAH';
    let label = `♚ ŞAH MAT! ${winnerName} KAZANDI`;
    // playerWon: AI ve online modda oyuncunun kendi rengine göre
    let playerWon = true;
    if(G.mode === 'ai' || G.mode === 'online'){
      playerWon = (winnerColor === G.playerColor);
      label = playerWon ? '🏆 KAZANDIN! ŞAH MAT' : (G.mode==='ai' ? '🤖 YZ KAZANDI — ŞAH MAT' : '♟ RAKİP KAZANDI — ŞAH MAT');
    }
    updateStatus(label, 'win');
    try{ playerWon ? Sound.win() : Sound.lose(); }catch(e){}
    G.gameEnded = true;
    onGameEnd(playerWon);
    return;
  } else if(status === 'stalemate'){
    updateStatus('🤝 PAT — BERABERE', 'draw');
    try{ Sound.draw(); }catch(e){}
    G.gameEnded = true; onGameEndDraw();
    return;
  } else if(status === 'insufficient'){
    updateStatus('🤝 BERABERE — Yetersiz materyal', 'draw');
    try{ Sound.draw(); }catch(e){}
    G.gameEnded = true; onGameEndDraw();
    return;
  } else if(status === 'fiftymove'){
    updateStatus('🤝 BERABERE — 50 hamle kuralı', 'draw');
    try{ Sound.draw(); }catch(e){}
    G.gameEnded = true; onGameEndDraw();
    return;
  } else if(repeats >= 3){
    updateStatus('🤝 BERABERE — 3 hamle tekrarı', 'draw');
    try{ Sound.draw(); }catch(e){}
    G.gameEnded = true; onGameEndDraw();
    return;
  } else if(status === 'check'){
    updateStatus('⚠️ ŞAH!', 'check');
    try{ Sound.check(); }catch(e){}
  } else {
    updateStatus('');
    try{
      if(mv.castle) Sound.castle();
      else if(mv.promotion) Sound.promote();
      else if(isCapture) Sound.capture();
      else Sound.move();
    }catch(e){}
  }

  // AI modu: oyuncu hamle yaptıysa AI yanıt versin
  saveChessResume();
  maybeAIMove();
}

async function onGameEndDraw(){
  Resume.clearSnapshot('chess');
  const kaju = 40, xp = 30;
  try{ await Store.addKaju(kaju, 'chess'); await Store.addXP(xp); }catch(e){}
  try{
    const Reward = await import('../reward.js');
    await Reward.showReward({
      won:false, draw:true, game:'chess', kaju, xp, writeReward:false,
      title: '🤝 BERABERE', subtitle: 'Satranç partisi berabere bitti',
    });
  }catch(e){ console.warn('[reward]',e); }
}

async function onGameEnd(playerWon){
  Resume.clearSnapshot('chess');
  const won = playerWon === true;
  const kaju = won ? 80 : 20;
  const xp = won ? 60 : 25;
  try{ await Store.addKaju(kaju, 'chess'); await Store.addXP(xp); }catch(e){}
  try{
    const Reward = await import('../reward.js');
    await Reward.showReward({
      won, game:'chess', kaju, xp, writeReward:false,
      title: won ? '♛ KAZANDIN!' : '♟ Rakip kazandı',
      subtitle: 'Satranç partisi tamamlandı',
    });
  }catch(e){ console.warn('[reward]',e); }
}

// ════════════ HUD GÜNCELLEME ════════════
function updateTurn(){
  const el = G.root.querySelector('[data-el="turn"]');
  if(!el) return;
  const isW = G.state.turn === 'w';
  el.textContent = (isW ? "BEYAZ" : "SİYAH") + "'IN SIRASI";
  el.className = 'cg-turn ' + (isW ? 'white' : 'black');
}

function updateStatus(msg, kind){
  const el = G.root.querySelector('[data-el="status"]');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'cg-status' + (kind ? ' ' + kind : '') + (msg ? ' show' : '');
}

// ════════════ HAMLE GEÇMİŞİ ════════════
function addHistoryRow(notation, color){
  if(!G || !G.root) return;
  const list = G.root.querySelector('[data-el="historyList"]');
  if(!list) return;
  const empty = list.querySelector('.cgh-empty');
  if(empty) empty.remove();
  const moveNum = Math.ceil(G.moveHistory.length / 2);
  if(color === 'w'){
    const row = document.createElement('div');
    row.className = 'cgh-row';
    row.innerHTML = `<span class="cgh-num">${moveNum}.</span><span class="cgh-w">${notation}</span><span class="cgh-b"></span>`;
    list.appendChild(row);
  } else {
    const rows = list.querySelectorAll('.cgh-row');
    const last = rows[rows.length - 1];
    if(last){ last.querySelector('.cgh-b').textContent = notation; }
    else {
      const row = document.createElement('div');
      row.className = 'cgh-row';
      row.innerHTML = `<span class="cgh-num">${moveNum}.</span><span class="cgh-w">…</span><span class="cgh-b">${notation}</span>`;
      list.appendChild(row);
    }
  }
  list.scrollTop = list.scrollHeight;
}

function clearHistoryUI(){
  const list = G.root.querySelector('[data-el="historyList"]');
  if(list){ list.innerHTML = '<div class="cgh-empty">Henüz hamle yok</div>'; }
}

// ════════════ SÜRE SAATİ ════════════
function setupClock(seconds){
  if(!G || !G.root) return;
  G.timeControl = seconds;
  G.clock = { w: seconds, b: seconds };
  const clocksEl = G.root.querySelector('[data-el="clocks"]');
  if(clocksEl) clocksEl.style.display = 'flex';
  // Üst saat = rakip/uzak renk, alt saat = yerel/beyaz (moda göre)
  // Online: alt = kendi rengin. AI: alt = oyuncu rengi. Local: alt = beyaz (döner)
  let botColor = 'w', topColor = 'b';
  if(G.mode === 'ai' || G.mode === 'online'){ botColor = G.playerColor; topColor = G.playerColor === 'w' ? 'b' : 'w'; }
  G.clockBotColor = botColor; G.clockTopColor = topColor;
  const topLabel = G.root.querySelector('[data-el="clockTopLabel"]');
  const botLabel = G.root.querySelector('[data-el="clockBotLabel"]');
  if(topLabel) topLabel.textContent = topColor === 'w' ? 'Beyaz' : 'Siyah';
  if(botLabel) botLabel.textContent = botColor === 'w' ? 'Beyaz' : 'Siyah';
  updateClockDisplay();
  startClockTick();
}

function startClockTick(){
  stopClockTick();
  if(!G || !G.clock) return;
  G.clockTimer = setInterval(() => {
    if(!G || !G.clock || G.gameEnded){ stopClockTick(); return; }
    const turn = G.state.turn;
    G.clock[turn] = Math.max(0, G.clock[turn] - 1);
    updateClockDisplay();
    if(G.clock[turn] <= 0){ onTimeout(turn); }
  }, 1000);
}

function stopClockTick(){
  if(G && G.clockTimer){ clearInterval(G.clockTimer); G.clockTimer = null; }
}

function updateClockDisplay(){
  if(!G || !G.clock || !G.root) return;
  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  };
  const topTime = G.root.querySelector('[data-el="clockTopTime"]');
  const botTime = G.root.querySelector('[data-el="clockBotTime"]');
  const topEl = G.root.querySelector('[data-el="clockTop"]');
  const botEl = G.root.querySelector('[data-el="clockBot"]');
  if(topTime) topTime.textContent = fmt(G.clock[G.clockTopColor]);
  if(botTime) botTime.textContent = fmt(G.clock[G.clockBotColor]);
  // Aktif saat vurgusu + düşük süre kırmızı
  const activeTurn = G.state.turn;
  if(topEl){ topEl.classList.toggle('active', activeTurn === G.clockTopColor && !G.gameEnded); topEl.classList.toggle('low', G.clock[G.clockTopColor] <= 15); }
  if(botEl){ botEl.classList.toggle('active', activeTurn === G.clockBotColor && !G.gameEnded); botEl.classList.toggle('low', G.clock[G.clockBotColor] <= 15); }
}

function onTimeout(color){
  stopClockTick();
  G.gameEnded = true;
  const loserIsW = color === 'w';
  let label = `⏰ SÜRE BİTTİ — ${loserIsW ? 'SİYAH' : 'BEYAZ'} KAZANDI`;
  if(G.mode === 'ai'){
    const playerLost = (color === G.playerColor);
    label = playerLost ? '⏰ SÜREN BİTTİ — YZ KAZANDI' : '⏰ YZ\'NİN SÜRESİ BİTTİ — KAZANDIN!';
  } else if(G.mode === 'online'){
    const playerLost = (color === G.playerColor);
    label = playerLost ? '⏰ SÜREN BİTTİ — Kaybettin' : '⏰ Rakibin süresi bitti — KAZANDIN!';
  }
  updateStatus(label, loserIsW ? 'draw' : 'win');
  try{ Sound.lose(); }catch(e){}
  updateClockDisplay();
}

// ════════════ FEN YÜKLEME ════════════
function showFENLoader(){
  const ov = document.createElement('div');
  ov.className = 'chess-confirm';
  ov.innerHTML = `<div class="ccf-box">
    <div class="ccf-text">📥 FEN pozisyonu yapıştır:</div>
    <input class="fen-input" data-el="fenInput" placeholder="rnbqkbnr/pppp..." autocomplete="off">
    <div class="fen-err" data-el="fenErr"></div>
    <div class="ccf-btns">
      <button class="ccf-no">Vazgeç</button>
      <button class="ccf-yes">Yükle</button>
    </div>
  </div>`;
  G.root.appendChild(ov);
  const input = ov.querySelector('[data-el="fenInput"]');
  // pano yapıştırma kolaylığı
  setTimeout(() => { input.focus(); }, 50);
  ov.querySelector('.ccf-no').addEventListener('click', () => ov.remove());
  ov.querySelector('.ccf-yes').addEventListener('click', () => {
    const fen = input.value.trim();
    const parsed = fromFEN(fen);
    if(!parsed){ ov.querySelector('[data-el="fenErr"]').textContent = '❌ Geçersiz FEN'; return; }
    ov.remove();
    // Pozisyonu yükle (taze oyun gibi)
    G.state = parsed;
    G.selected = null; G.legalForSelected = []; G.lastMove = null;
    G.captured = { w:[], b:[] };
    G.moveHistory = []; G.posHistory = [ positionKey(G.state) ];
    G.undoStack = []; G.gameEnded = false;
    if(G.mode === 'local' && G.autoFlip){ G.flip = (G.state.turn === 'b'); }
    clearHistoryUI();
    updateTurn(); updateStatus(''); updateCaptured(); draw();
    const st = gameStatus(G.state);
    if(st === 'check') updateStatus('⚠️ ŞAH!', 'check');
    // AI modunda yüklenen pozisyonda sıra AI'daysa oynasın
    maybeAIMove();
  });
}

// ════════════ HAMLE GERİ ALMA ════════════
function undoMove(){
  if(!G || !G.undoStack || G.undoStack.length === 0) return;
  if(G.animating || G.aiThinking) return;
  // AI modunda 2 yarım hamle geri al (AI + oyuncu) ki oyuncu tekrar oynasın
  let steps = 1;
  if(G.mode === 'ai' && G.undoStack.length >= 2){ steps = 2; }
  let snap = null;
  for(let i=0;i<steps;i++){ if(G.undoStack.length) snap = G.undoStack.pop(); }
  if(!snap) return;
  // Durumu geri yükle
  G.state = snap.state;
  G.captured.w = snap.captured.w; G.captured.b = snap.captured.b;
  G.lastMove = snap.lastMove;
  G.moveHistory.length = snap.historyLen;
  G.posHistory.length = snap.posLen;
  G.gameEnded = false;
  G.selected = null; G.legalForSelected = [];
  // 2 oyuncu modunda tahta yönünü düzelt
  if(G.mode === 'local' && G.autoFlip){ G.flip = (G.state.turn === 'b'); }
  // Geçmiş panelini yeniden kur
  rebuildHistoryUI();
  updateTurn(); updateStatus(''); updateCaptured(); updateClockDisplay(); draw();
}

// Geçmiş panelini moveHistory'den yeniden oluştur (undo sonrası)
function rebuildHistoryUI(){
  if(!G || !G.root) return;
  clearHistoryUI();
  const saved = G.moveHistory.slice();
  G.moveHistory = [];
  for(const h of saved){ G.moveHistory.push(h); addHistoryRow(h.notation, h.color); }
}

// ════════════ ONAY DİYALOĞU ════════════
function showConfirm(text, onYes){
  const ov = document.createElement('div');
  ov.className = 'chess-confirm';
  ov.innerHTML = `<div class="ccf-box">
    <div class="ccf-text">${text}</div>
    <div class="ccf-btns">
      <button class="ccf-no">Vazgeç</button>
      <button class="ccf-yes">Evet</button>
    </div>
  </div>`;
  G.root.appendChild(ov);
  ov.querySelector('.ccf-no').addEventListener('click', () => ov.remove());
  ov.querySelector('.ccf-yes').addEventListener('click', () => { ov.remove(); onYes(); });
}

// ════════════ BERABERLİK TEKLİFİ ════════════
function offerDraw(){
  if(G.mode === 'local'){
    // 2 oyuncu: doğrudan sor
    showConfirm('Berabere bitirilsin mi? (Her iki oyuncu da onaylamalı)', () => {
      G.gameEnded = true;
      updateStatus('🤝 BERABERE — Karşılıklı anlaşma', 'draw');
      try{ Sound.draw(); }catch(e){}
    });
  } else if(G.mode === 'ai'){
    // AI: materyal durumuna göre kabul/red
    const adv = materialAdvantage();
    const myColor = G.playerColor, aiColor = G.aiColor;
    // AI dezavantajlıysa veya eşitse kabul eder, avantajlıysa reddeder
    const aiAdv = adv[aiColor] || 0, myAdv = adv[myColor] || 0;
    if(aiAdv <= myAdv + 1){
      G.gameEnded = true;
      updateStatus('🤝 BERABERE — YZ kabul etti', 'draw');
      try{ Sound.draw(); }catch(e){}
    } else {
      updateStatus('🤖 YZ beraberliği reddetti', 'check');
      setTimeout(() => { if(G && !G.gameEnded) updateStatus(''); }, 2000);
    }
  } else if(G.mode === 'online'){
    // Online: rakibe teklif gönder
    if(G.drawOfferSent){ return; }
    G.drawOfferSent = true;
    ChessMP.send({ type:'drawOffer' });
    updateStatus('🤝 Beraberlik teklif edildi, rakip bekleniyor…', 'thinking');
    setTimeout(() => { G.drawOfferSent = false; }, 3000);
  }
}

// Online: rakipten beraberlik teklifi geldi
function handleDrawOffer(){
  const ov = document.createElement('div');
  ov.className = 'chess-confirm';
  ov.innerHTML = `<div class="ccf-box">
    <div class="ccf-text">🤝 Rakip beraberlik teklif etti.<br>Kabul ediyor musun?</div>
    <div class="ccf-btns">
      <button class="ccf-no">Reddet</button>
      <button class="ccf-yes">Kabul Et</button>
    </div>
  </div>`;
  G.root.appendChild(ov);
  ov.querySelector('.ccf-no').addEventListener('click', () => { ov.remove(); ChessMP.send({ type:'drawDecline' }); });
  ov.querySelector('.ccf-yes').addEventListener('click', () => {
    ov.remove();
    ChessMP.send({ type:'drawAccept' });
    G.gameEnded = true;
    updateStatus('🤝 BERABERE — Karşılıklı anlaşma', 'draw');
    try{ Sound.draw(); }catch(e){}
  });
}

// ════════════ SOHBET ════════════
const QUICK_MSGS = ['İyi oyunlar! 👋', 'Aferin! 👏', 'Hmm… 🤔', 'Güzel hamle!', 'Tekrar oynayalım?', 'İyi şanslar! 🍀'];

function setupChat(root){
  G.chatOpen = false;
  G.unreadChat = 0;
  const chatBtn = root.querySelector('[data-el="chatBtn"]');
  chatBtn.style.display = 'flex';
  const panel = root.querySelector('[data-el="chatPanel"]');

  // Hızlı mesaj butonları
  const quick = root.querySelector('[data-el="chatQuick"]');
  quick.innerHTML = QUICK_MSGS.map(m => `<button class="cgc-q">${m}</button>`).join('');
  quick.querySelectorAll('.cgc-q').forEach((b, i) => {
    b.addEventListener('click', () => sendChat(QUICK_MSGS[i]));
  });

  chatBtn.addEventListener('click', () => {
    G.chatOpen = true;
    panel.style.display = 'flex';
    G.unreadChat = 0;
    updateChatBadge();
    const inp = root.querySelector('[data-el="chatInput"]');
    setTimeout(() => inp.focus(), 50);
  });
  root.querySelector('[data-act="chatClose"]').addEventListener('click', () => {
    G.chatOpen = false; panel.style.display = 'none';
  });
  root.querySelector('[data-act="chatSend"]').addEventListener('click', () => {
    const inp = root.querySelector('[data-el="chatInput"]');
    const txt = inp.value.trim();
    if(txt){ sendChat(txt); inp.value = ''; }
  });
  root.querySelector('[data-el="chatInput"]').addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){
      const txt = e.target.value.trim();
      if(txt){ sendChat(txt); e.target.value = ''; }
    }
  });
}

function sendChat(text){
  if(!G || !G.online) return;
  text = (text || '').slice(0, 120);
  ChessMP.send({ type:'chat', text });
  addChatMessage(text, true);
}

function addChatMessage(text, mine){
  if(!G || !G.root) return;
  const box = G.root.querySelector('[data-el="chatMessages"]');
  if(!box) return;
  const msg = document.createElement('div');
  msg.className = 'cgc-msg ' + (mine ? 'mine' : 'theirs');
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  // Sohbet kapalıysa okunmamış sayacı
  if(!mine && !G.chatOpen){ G.unreadChat = (G.unreadChat || 0) + 1; updateChatBadge(); }
}

function updateChatBadge(){
  const badge = G.root.querySelector('[data-el="chatBadge"]');
  if(!badge) return;
  if(G.unreadChat > 0){ badge.style.display = 'flex'; badge.textContent = G.unreadChat; }
  else { badge.style.display = 'none'; }
}

function updateCaptured(){
  const el = G.root.querySelector('[data-el="captured"]');
  if(!el) return;
  const wCap = G.captured.w.map(t => GLYPH[t]).join('');   // beyazın yediği (siyah taşlar)
  const bCap = G.captured.b.map(t => GLYPH[t]).join('');
  const adv = materialAdvantage();
  const wAdv = adv.w > 0 ? `<span class="cap-adv">+${adv.w}</span>` : '';
  const bAdv = adv.b > 0 ? `<span class="cap-adv">+${adv.b}</span>` : '';
  el.innerHTML = `<span class="cap-row"><b>Beyaz aldı:</b> <span class="cap-pieces">${wCap || '—'}</span>${wAdv}</span>` +
                 `<span class="cap-row"><b>Siyah aldı:</b> <span class="cap-pieces">${bCap || '—'}</span>${bAdv}</span>`;
  updatePanels();
}

// Çevrimiçi oyuncu panellerini güncelle (sıra göstergesi + yenen taşlar)
function updatePanels(){
  if(!G || !G.online || !G.root) return;
  const meIsW = G.playerColor === 'w';
  const meColor = G.playerColor, oppColor = meIsW ? 'b' : 'w';
  // Sıra rozeti: aktif oyuncunun rozeti parlar
  const meTurn = (G.state.turn === meColor) && !G.oppLeft;
  const oppTurn = (G.state.turn === oppColor) && !G.oppLeft;
  const meBadge = G.root.querySelector('[data-el="meBadge"]');
  const oppBadge = G.root.querySelector('[data-el="oppBadge"]');
  const mePanel = G.root.querySelector('[data-el="mePanel"]');
  const oppPanel = G.root.querySelector('[data-el="oppPanel"]');
  if(meBadge){ meBadge.classList.toggle('active', meTurn); }
  if(oppBadge){ oppBadge.classList.toggle('active', oppTurn); }
  if(mePanel){ mePanel.classList.toggle('your-turn', meTurn); }
  if(oppPanel){ oppPanel.classList.toggle('your-turn', oppTurn); }
  // Yenen taşlar: her oyuncunun yediği rakip taşları kendi panelinde
  const meCap = G.root.querySelector('[data-el="meCap"]');
  const oppCap = G.root.querySelector('[data-el="oppCap"]');
  if(meCap){ meCap.textContent = (G.captured[meColor] || []).map(t => GLYPH[t]).join(''); }
  if(oppCap){ oppCap.textContent = (G.captured[oppColor] || []).map(t => GLYPH[t]).join(''); }
  // Materyal avantajı (puan farkı)
  const adv = materialAdvantage();
  if(meCap && adv[meColor] > 0){ meCap.textContent += ' +' + adv[meColor]; }
  if(oppCap && adv[oppColor] > 0){ oppCap.textContent += ' +' + adv[oppColor]; }
}

// Materyal avantajı hesapla (yenen taşların net puan farkı)
function materialAdvantage(){
  const val = { p:1, n:3, b:3, r:5, q:9 };
  let w = 0, b = 0;
  G.captured.w.forEach(t => w += val[t] || 0);   // beyazın yediği = beyaz avantajı
  G.captured.b.forEach(t => b += val[t] || 0);
  const diff = w - b;
  return { w: diff > 0 ? diff : 0, b: diff < 0 ? -diff : 0 };
}

// ════════════ TERFİ SEÇİMİ ════════════
function showPromotion(color, cb){
  const ov = document.createElement('div');
  ov.className = 'chess-promo';
  const opts = ['q','r','b','n'];
  ov.innerHTML = `<div class="cp-box">
    <div class="cp-title">TERFİ SEÇ</div>
    <div class="cp-pieces">${opts.map(t => `<button class="cp-btn" data-p="${t}">${GLYPH[t]}<span>${PIECE_NAMES[t]}</span></button>`).join('')}</div>
  </div>`;
  G.root.appendChild(ov);
  ov.querySelectorAll('.cp-btn').forEach(b => {
    b.addEventListener('click', () => { ov.remove(); cb(b.dataset.p); });
  });
}

// ════════════ TEMA SEÇİCİ ════════════
function showThemePicker(root){
  const ov = document.createElement('div');
  ov.className = 'chess-theme-picker';
  ov.innerHTML = `<div class="ctp-box">
    <div class="ctp-title">🎨 TAHTA TEMASI</div>
    <div class="ctp-grid">
      ${Object.entries(THEMES).map(([key, th]) => `
        <button class="ctp-card ${key===SELECTED_THEME?'active':''}" data-theme="${key}">
          <div class="ctp-preview">
            <span style="background:${th.light}"></span><span style="background:${th.dark}"></span>
            <span style="background:${th.dark}"></span><span style="background:${th.light}"></span>
          </div>
          <div class="ctp-name">${th.name}</div>
        </button>`).join('')}
    </div>
    <button class="ctp-close">KAPAT</button>
  </div>`;
  root.appendChild(ov);
  ov.querySelectorAll('.ctp-card').forEach(card => {
    card.addEventListener('click', () => {
      SELECTED_THEME = card.dataset.theme;
      try{ localStorage.setItem('hero_chess_theme', SELECTED_THEME); }catch(e){}
      if(G && G.ctx) draw();
      ov.remove();
    });
  });
  ov.querySelector('.ctp-close').addEventListener('click', () => ov.remove());
}

// ════════════ CSS ════════════
function injectCSS(){
  if(document.getElementById('chess-css')) return;
  const s = document.createElement('style');
  s.id = 'chess-css';
  s.textContent = `
.chess-root{ position:fixed; inset:0; z-index:9000; background:#0a1428;
  display:flex; flex-direction:column; font-family:system-ui,-apple-system,sans-serif;
  color:#f0e6cc; overflow:hidden; }

/* Mod seçim */
.chess-modes{ flex:1; display:flex; flex-direction:column; padding:14px; max-width:520px; margin:0 auto; width:100%; }
.cm-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.cm-title{ font-size:18px; font-weight:800; letter-spacing:1px; color:#c8a557; text-shadow:0 0 12px rgba(200,165,87,.4); }
.cm-sub{ text-align:center; color:#8a9bb5; font-size:13px; margin-bottom:20px; }
.cm-cards{ display:flex; flex-direction:column; gap:12px; }
.cm-card{ display:flex; flex-direction:column; align-items:center; gap:4px; padding:20px;
  background:linear-gradient(135deg, rgba(35,70,126,.5), rgba(10,20,40,.9));
  border:1.5px solid rgba(200,165,87,.4); border-radius:16px; color:#f0e6cc; cursor:pointer;
  transition:transform .12s, border-color .2s; }
.cm-card:active{ transform:scale(.98); }
.cm-card:not(.soon):hover{ border-color:#c8a557; }
.cm-card.soon{ opacity:.45; cursor:not-allowed; }
.cm-ic{ font-size:36px; }
.cm-name{ font-size:15px; font-weight:800; letter-spacing:.5px; }
.cm-desc{ font-size:11px; color:#8a9bb5; }

/* Oyun ekranı */
.chess-game{ flex:1; display:flex; flex-direction:column; padding:10px; max-width:560px; margin:0 auto; width:100%; }
.cg-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.cg-turn{ font-size:15px; font-weight:800; letter-spacing:1px; padding:6px 16px; border-radius:20px;
  border:1.5px solid rgba(200,165,87,.4); transition:all .2s; }
.cg-turn.white{ background:rgba(245,239,224,.15); color:#f5efe0; }
.cg-turn.black{ background:rgba(42,125,140,.2); color:#3fc8d8; }
.c-icon{ width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,.06);
  border:1px solid rgba(200,165,87,.3); color:#c8a557; font-size:16px; cursor:pointer; }
.c-icon:active{ transform:scale(.92); }
.cg-status{ text-align:center; font-size:14px; font-weight:800; letter-spacing:.5px; min-height:0; height:0;
  overflow:hidden; opacity:0; transition:all .25s; margin:0; }
.cg-status.show{ height:auto; min-height:24px; opacity:1; margin:2px 0 6px; padding:6px; border-radius:10px; }
.cg-status.win{ background:linear-gradient(90deg, rgba(200,165,87,.25), rgba(255,215,64,.15)); color:#ffd740; }
.cg-status.check{ background:rgba(255,60,60,.2); color:#ff8080; }
.cg-status.draw{ background:rgba(138,155,181,.2); color:#b0c0d4; }
.cg-status.thinking{ background:rgba(63,200,224,.15); color:#3fc8e0; }

/* AI kurulum ekranı */
.chess-ai-setup{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center;
  background:rgba(5,10,20,.8); backdrop-filter:blur(6px); padding:16px; }
.cas-head-row{ display:flex;align-items:center;justify-content:space-between;margin-bottom:14px; }
.cas-back{ background:rgba(255,255,255,.07);border:1px solid rgba(200,165,87,.3);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#c8a557;cursor:pointer;font-family:inherit; }
.cas-close{ background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#ff8080;cursor:pointer;font-family:inherit; }
.cas-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:20px;
  padding:22px; max-width:400px; width:100%; }
.cas-title{ text-align:center; font-size:16px; font-weight:800; letter-spacing:.5px; color:#c8a557; margin-bottom:18px; }
.cas-label{ font-size:11px; font-weight:700; letter-spacing:1px; color:#8a9bb5; margin:14px 0 8px; }
.cas-row{ display:flex; gap:8px; }
.cas-opt{ flex:1; padding:12px 6px; background:rgba(255,255,255,.05); border:1.5px solid rgba(200,165,87,.3);
  border-radius:10px; color:#f0e6cc; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; }
.cas-opt.active{ border-color:#c8a557; background:rgba(200,165,87,.2); color:#ffd740; }
.cas-opt:active{ transform:scale(.96); }
.cas-start{ width:100%; margin-top:20px; padding:14px; background:linear-gradient(135deg,#c8a557,#a07d2f);
  border:none; border-radius:12px; color:#0a1428; font-weight:800; font-size:15px; letter-spacing:1px; cursor:pointer; }
.cas-start:active{ transform:scale(.98); }

/* Çevrimiçi lobi */
.chess-online-lobby{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center;
  background:rgba(5,10,20,.85); backdrop-filter:blur(6px); padding:16px; box-sizing:border-box; }
.col-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:20px;
  padding:20px; max-width:400px; width:100%; box-sizing:border-box; position:relative; overflow:hidden;
  max-height:92vh; overflow-y:auto; }
.col-box *{ box-sizing:border-box; }
.col-back{ position:absolute; top:14px; left:14px; background:none; border:none; color:#8a9bb5; font-size:13px; cursor:pointer; z-index:2; }
.col-title{ text-align:center; font-size:16px; font-weight:800; letter-spacing:.5px; color:#c8a557; margin-bottom:18px; padding-top:6px; }
.col-panel{ display:flex; flex-direction:column; gap:12px; width:100%; }
.col-time-sel, .col-host-wait{ display:flex; flex-direction:column; gap:12px; width:100%; }
.col-big{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:18px; width:100%;
  background:linear-gradient(135deg, rgba(35,70,126,.5), rgba(10,20,40,.9)); border:1.5px solid rgba(200,165,87,.4);
  border-radius:14px; color:#f0e6cc; cursor:pointer; transition:transform .12s, border-color .2s; }
.col-big:active{ transform:scale(.98); }
.col-big:hover{ border-color:#c8a557; }
.col-ic{ font-size:30px; }
.col-bname{ font-size:15px; font-weight:800; letter-spacing:.5px; }
.col-bdesc{ font-size:11px; color:#8a9bb5; text-align:center; }
.col-info{ text-align:center; font-size:13px; color:#b0c0d4; }
.col-code{ width:100%; text-align:center; font-family:monospace; font-weight:800;
  font-size:clamp(26px, 9vw, 40px); letter-spacing:0.18em;
  color:#ffd740; text-shadow:0 0 18px rgba(255,215,64,.45); padding:14px 8px; background:rgba(255,215,64,.08);
  border-radius:12px; border:1.5px dashed rgba(200,165,87,.5); overflow-wrap:break-word; }
.col-hint{ text-align:center; font-size:12px; color:#8a9bb5; line-height:1.5; width:100%; }
.col-spinner{ width:32px; height:32px; margin:4px auto; border:3px solid rgba(200,165,87,.2);
  border-top-color:#c8a557; border-radius:50%; animation:colSpin 0.9s linear infinite; }
@keyframes colSpin{ to{ transform:rotate(360deg); } }
.col-input{ width:100%; min-width:0; padding:16px; font-family:monospace; font-weight:800;
  font-size:clamp(22px, 7vw, 28px); letter-spacing:0.2em; text-align:center; text-transform:uppercase;
  background:rgba(255,255,255,.06); border:1.5px solid rgba(200,165,87,.4); border-radius:12px; color:#ffd740; }
.col-input:focus{ outline:none; border-color:#c8a557; }
.col-connect{ width:100%; padding:14px; background:linear-gradient(135deg,#c8a557,#a07d2f); border:none;
  border-radius:12px; color:#0a1428; font-weight:800; font-size:15px; letter-spacing:1px; cursor:pointer; }
.col-connect:active{ transform:scale(.98); }
.col-status{ text-align:center; font-size:13px; color:#3fc8e0; min-height:18px; }
.col-copy{ width:100%; padding:12px; background:rgba(63,200,224,.15); border:1.5px solid #3fc8e0;
  border-radius:10px; color:#3fc8e0; font-weight:800; font-size:14px; letter-spacing:.5px; cursor:pointer; transition:transform .1s; }
.col-copy:active{ transform:scale(.97); }
.col-input-row{ display:flex; gap:8px; }
.col-input-row .col-input{ flex:1; }
.col-paste{ width:56px; flex-shrink:0; background:rgba(63,200,224,.15); border:1.5px solid #3fc8e0;
  border-radius:12px; color:#3fc8e0; font-size:22px; cursor:pointer; transition:transform .1s; }
.col-paste:active{ transform:scale(.94); }
.cg-board-wrap{ flex:1; display:flex; align-items:center; justify-content:center; min-height:0; }
.cg-board-wrap canvas{ border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,.6); touch-action:manipulation; }
.cg-captured{ display:flex; justify-content:space-between; padding:8px 12px; font-size:18px; gap:10px; }
.cg-captured{ display:flex; flex-direction:column; gap:4px; padding:8px 12px; font-size:16px; }
.cap-row{ display:flex; align-items:center; gap:8px; background:rgba(255,255,255,.04); border-radius:8px; padding:6px 12px; min-height:30px; }
.cap-row b{ font-size:11px; color:#8a9bb5; font-weight:700; flex-shrink:0; }
.cap-pieces{ flex:1; color:#c8a557; letter-spacing:1px; }
.cap-adv{ font-size:13px; font-weight:800; color:#3fe070; font-family:monospace; }

/* Çevrimiçi oyuncu panelleri (rakip takip) */
.cg-player{ display:flex; align-items:center; gap:10px; padding:8px 12px; margin:4px 0;
  background:linear-gradient(135deg, rgba(35,70,126,.35), rgba(10,20,40,.6));
  border:1.5px solid rgba(200,165,87,.25); border-radius:12px; transition:all .25s; }
.cg-player.your-turn{ border-color:#c8a557; background:linear-gradient(135deg, rgba(200,165,87,.2), rgba(35,70,126,.4));
  box-shadow:0 0 16px rgba(200,165,87,.25); }
.cgp-avatar{ width:40px; height:40px; flex-shrink:0; display:flex; align-items:center; justify-content:center;
  font-size:24px; background:radial-gradient(circle at 35% 30%, #2a5a9c, #0a1f3c);
  border:2px solid #c8a557; border-radius:50%; color:#f0e6cc; }
.cg-me .cgp-avatar{ background:radial-gradient(circle at 35% 30%, #d4af5a, #8a6d2f); color:#0a1428; }
.cgp-info{ flex:1; min-width:0; }
.cgp-name{ font-size:14px; font-weight:800; color:#f0e6cc; }
.cgp-sub{ font-size:11px; color:#8a9bb5; display:flex; align-items:center; gap:5px; }
.cgp-dot{ width:8px; height:8px; border-radius:50%; background:#666; flex-shrink:0; }
.cgp-dot.online{ background:#3fe070; box-shadow:0 0 8px rgba(63,224,112,.6); }
.cgp-cap{ font-size:15px; color:#c8a557; letter-spacing:1px; max-width:120px; overflow:hidden; text-align:right; }
.cgp-turn-badge{ font-size:14px; color:#2a3a52; flex-shrink:0; transition:all .25s; }
.cgp-turn-badge.active{ color:#3fe070; text-shadow:0 0 10px rgba(63,224,112,.7); animation:badgePulse 1.2s ease-in-out infinite; }
@keyframes badgePulse{ 0%,100%{ opacity:1; } 50%{ opacity:.4; } }

/* Sohbet rozeti (buton üstünde) */
.chat-badge{ position:absolute; top:-4px; right:-4px; min-width:16px; height:16px; padding:0 4px;
  display:flex; align-items:center; justify-content:center; background:#ff5252; color:#fff;
  font-size:10px; font-weight:800; border-radius:8px; box-sizing:border-box; }
.c-icon{ position:relative; }

/* Sohbet paneli */
.cg-chat{ position:absolute; left:0; right:0; bottom:0; max-width:560px; margin:0 auto;
  background:linear-gradient(180deg, #16294a, #0a1428); border-top:2px solid #c8a557;
  border-radius:18px 18px 0 0; display:flex; flex-direction:column; max-height:60%; z-index:50;
  box-shadow:0 -10px 40px rgba(0,0,0,.5); }
.cgc-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px;
  font-size:14px; font-weight:800; color:#c8a557; border-bottom:1px solid rgba(200,165,87,.2); }
.cgc-close{ background:none; border:none; color:#8a9bb5; font-size:16px; cursor:pointer; }
.cgc-messages{ flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:6px; min-height:120px; }
.cgc-msg{ max-width:75%; padding:8px 12px; border-radius:14px; font-size:13px; line-height:1.4; word-break:break-word; }
.cgc-msg.mine{ align-self:flex-end; background:linear-gradient(135deg,#c8a557,#a07d2f); color:#0a1428; border-bottom-right-radius:4px; }
.cgc-msg.theirs{ align-self:flex-start; background:rgba(35,70,126,.6); color:#f0e6cc; border-bottom-left-radius:4px; }
.cgc-quick{ display:flex; gap:6px; overflow-x:auto; padding:8px 12px; border-top:1px solid rgba(200,165,87,.15); }
.cgc-q{ flex-shrink:0; padding:6px 12px; background:rgba(255,255,255,.06); border:1px solid rgba(200,165,87,.3);
  border-radius:16px; color:#f0e6cc; font-size:12px; white-space:nowrap; cursor:pointer; }
.cgc-q:active{ transform:scale(.95); }
.cgc-input-row{ display:flex; gap:8px; padding:12px; }
.cgc-input{ flex:1; padding:12px 14px; background:rgba(255,255,255,.06); border:1.5px solid rgba(200,165,87,.3);
  border-radius:22px; color:#f0e6cc; font-size:14px; }
.cgc-input:focus{ outline:none; border-color:#c8a557; }
.cgc-send{ width:48px; flex-shrink:0; background:linear-gradient(135deg,#c8a557,#a07d2f); border:none;
  border-radius:50%; color:#0a1428; font-size:18px; cursor:pointer; }
.cgc-send:active{ transform:scale(.94); }

/* Aksiyon butonları (pes/beraberlik/geçmiş) */
.cg-actions{ display:flex; gap:6px; justify-content:center; margin:4px 0 6px; }
.cg-act-btn{ flex:1; max-width:140px; padding:8px 6px; background:rgba(255,255,255,.05);
  border:1px solid rgba(200,165,87,.3); border-radius:10px; color:#c8a557; font-size:12px;
  font-weight:700; cursor:pointer; transition:transform .1s, background .2s; }
.cg-act-btn:active{ transform:scale(.96); }
.cg-act-btn:hover{ background:rgba(200,165,87,.12); }

/* Hamle geçmişi paneli */
.cg-history{ position:absolute; left:0; right:0; bottom:0; max-width:560px; margin:0 auto;
  background:linear-gradient(180deg, #16294a, #0a1428); border-top:2px solid #c8a557;
  border-radius:18px 18px 0 0; display:flex; flex-direction:column; max-height:55%; z-index:50;
  box-shadow:0 -10px 40px rgba(0,0,0,.5); }
.cgh-list{ flex:1; overflow-y:auto; padding:10px 14px; min-height:120px; }
.cgh-empty{ text-align:center; color:#8a9bb5; font-size:13px; padding:30px; }
.cgh-row{ display:flex; align-items:center; padding:6px 4px; border-bottom:1px solid rgba(255,255,255,.04); font-size:14px; }
.cgh-num{ width:36px; color:#8a9bb5; font-size:12px; }
.cgh-w, .cgh-b{ flex:1; font-family:monospace; font-weight:700; color:#f0e6cc; }
.cgh-b{ color:#3fc8d8; }
/* FEN paylaş/yükle butonları */
.cgh-fen{ display:flex; gap:8px; padding:10px 14px; border-top:1px solid rgba(200,165,87,.2); }
.cgh-fen-btn{ flex:1; padding:10px; background:rgba(63,200,224,.12); border:1px solid rgba(63,200,224,.4);
  border-radius:10px; color:#3fc8d8; font-size:12px; font-weight:700; cursor:pointer; transition:transform .1s; }
.cgh-fen-btn:active{ transform:scale(.96); }
.fen-input{ width:100%; box-sizing:border-box; padding:12px; margin-bottom:8px; font-family:monospace; font-size:13px;
  background:rgba(255,255,255,.06); border:1.5px solid rgba(200,165,87,.4); border-radius:10px; color:#f0e6cc; }
.fen-input:focus{ outline:none; border-color:#c8a557; }
.fen-err{ color:#ff5252; font-size:12px; text-align:center; min-height:16px; margin-bottom:6px; }

/* Onay diyaloğu (pes/beraberlik) */
.chess-confirm{ position:fixed; inset:0; z-index:9200; display:flex; align-items:center; justify-content:center;
  background:rgba(5,10,20,.8); backdrop-filter:blur(5px); padding:20px; }
.ccf-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:18px;
  padding:24px; max-width:340px; width:100%; }
.ccf-text{ text-align:center; font-size:15px; color:#f0e6cc; line-height:1.5; margin-bottom:20px; }
.ccf-btns{ display:flex; gap:10px; }
.ccf-no, .ccf-yes{ flex:1; padding:13px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer; transition:transform .1s; }
.ccf-no{ background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); color:#b0c0d4; }
.ccf-yes{ background:linear-gradient(135deg,#c8a557,#a07d2f); border:none; color:#0a1428; }
.ccf-no:active, .ccf-yes:active{ transform:scale(.96); }

/* Süre saati göstergesi */
.cg-clocks{ display:flex; justify-content:space-between; gap:10px; margin:4px 0 6px; }
.cg-clock{ flex:1; display:flex; align-items:center; justify-content:space-between; padding:8px 14px;
  background:rgba(255,255,255,.04); border:1.5px solid rgba(200,165,87,.25); border-radius:10px; transition:all .2s; }
.cg-clock.active{ border-color:#c8a557; background:rgba(200,165,87,.15); box-shadow:0 0 12px rgba(200,165,87,.2); }
.cg-clock.low .cgk-time{ color:#ff5252; }
.cg-clock.active.low{ border-color:#ff5252; box-shadow:0 0 12px rgba(255,82,82,.3); animation:clockPulse 1s ease-in-out infinite; }
@keyframes clockPulse{ 0%,100%{ opacity:1; } 50%{ opacity:.6; } }
.cgk-label{ font-size:12px; color:#8a9bb5; font-weight:700; }
.cgk-time{ font-family:monospace; font-size:20px; font-weight:800; color:#f0e6cc; letter-spacing:1px; }

/* Terfi seçimi */
.chess-promo{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center;
  background:rgba(5,10,20,.75); backdrop-filter:blur(4px); }
.cp-box{ background:linear-gradient(135deg, #1a3a6b, #0a1428); border:2px solid #c8a557; border-radius:18px; padding:20px; text-align:center; }
.cp-title{ font-size:14px; font-weight:800; letter-spacing:1px; color:#c8a557; margin-bottom:14px; }
.cp-pieces{ display:flex; gap:10px; }
.cp-btn{ display:flex; flex-direction:column; align-items:center; gap:4px; width:64px; padding:12px 6px;
  background:rgba(245,239,224,.1); border:1.5px solid rgba(200,165,87,.4); border-radius:12px;
  color:#f0e6cc; font-size:30px; cursor:pointer; transition:transform .1s; }
.cp-btn:active{ transform:scale(.94); }
.cp-btn span{ font-size:10px; color:#8a9bb5; }

/* Tema seçici */
.chess-theme-picker{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center;
  background:rgba(5,10,20,.8); backdrop-filter:blur(6px); padding:16px; }
.ctp-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:20px;
  padding:20px; max-width:440px; width:100%; }
.ctp-title{ text-align:center; font-size:16px; font-weight:800; letter-spacing:1px; color:#c8a557; margin-bottom:16px; }
.ctp-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.ctp-card{ padding:10px; background:rgba(255,255,255,.04); border:1.5px solid rgba(200,165,87,.3);
  border-radius:12px; cursor:pointer; transition:all .15s; }
.ctp-card.active{ border-color:#c8a557; background:rgba(200,165,87,.15); }
.ctp-preview{ display:grid; grid-template-columns:1fr 1fr; width:48px; height:48px; margin:0 auto 6px; border-radius:6px; overflow:hidden; border:1px solid rgba(200,165,87,.4); }
.ctp-preview span{ display:block; }
.ctp-name{ text-align:center; font-size:11px; font-weight:700; color:#f0e6cc; }
.ctp-close{ width:100%; margin-top:14px; padding:10px; background:rgba(200,165,87,.2); border:1px solid #c8a557;
  border-radius:10px; color:#c8a557; font-weight:700; cursor:pointer; }
`;
  document.head.appendChild(s);
}

// Rakip adına dokun → oyuncu kartı (online kimlik el sıkışması)
if(typeof document !== 'undefined' && !window.__klOppClick){
  window.__klOppClick = true;
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-opc]');
    if(o && o.dataset.opc){ import('../social.js').then(m => m.openPlayerCard(o.dataset.opc)).catch(()=>{}); }
  });
}
