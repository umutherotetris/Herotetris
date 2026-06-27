// ════════════════════════════════════════════════════════════════
//  TAVLA — UI / RENDER KATMANI (Canvas 2.5D)
//
//  tavla-engine.js üzerine kurulu. Osmanlı temalı, dokunmatik.
//  Bu sürüm: 6 tema + aynı cihazda 2 oyuncu. (AI/online sonra.)
// ════════════════════════════════════════════════════════════════
import Store from '../store.js';
import Auth from '../auth.js';
import { createVsHUD, getPortalNick, getPortalAvatar } from '../hud.js';
import {
  newGame, allLegalMoves, legalMovesFrom, applyMove, remainingDice,
  turnComplete, gameStatus, winType, rollDice, openingRoll, pipCount, canBearOff
} from './tavla-engine.js';
import { chooseSequence } from './tavla-ai.js';
import Sound from './tavla-audio.js';
let TavlaMP = null;   // çevrimiçi modül — sadece online moda girince dinamik yüklenir

// ── 6 Osmanlı teması (referans görsellerden) ──
const THEMES = {
  iznik: {
    name: 'İznik Premium',
    bg:'#0a1838', felt:'#16407a', frame:'#c8a557', frameDark:'#8a6d2f',
    pointA:'#2a6cb8', pointB:'#dbe4f0',           // üçgen renkleri (açık/koyu sıra)
    bar:'#0d2a55', barMotif:'#c8a557',
    wTop:'#f4f8fc', wBot:'#cdd8e8', wEdge:'#9fb0c8',   // beyaz pul
    bTop:'#1a4a86', bBot:'#0d2f5c', bEdge:'#3a6cb0',   // koyu (mavi) pul
    glow:'#3fa0ff'
  },
  kizil: {
    name: 'Ay Yıldız Kırmızı',
    bg:'#2a0a10', felt:'#7a1420', frame:'#d4af37', frameDark:'#9a7d27',
    pointA:'#a81c2c', pointB:'#f0e0c0',
    bar:'#5c0c14', barMotif:'#f0e0c0',
    wTop:'#f8f0e0', wBot:'#e0d0b0', wEdge:'#c0a880',
    bTop:'#b02232', bBot:'#7a1420', bEdge:'#d04050',
    glow:'#ff6048'
  },
  lacivert: {
    name: 'Osmanlı Lacivert',
    bg:'#0a1024', felt:'#16294a', frame:'#c8a557', frameDark:'#8a6d2f',
    pointA:'#1e3a6e', pointB:'#d8c4a0',
    bar:'#0d1a38', barMotif:'#c8a557',
    wTop:'#f0e4c8', wBot:'#d4c098', wEdge:'#b09868',
    bTop:'#1a3060', bBot:'#0d1f44', bEdge:'#3a5894',
    glow:'#d4af37'
  },
  zumrut: {
    name: 'Selçuklu Zümrüt',
    bg:'#04201a', felt:'#0f5a3c', frame:'#c8a557', frameDark:'#8a6d2f',
    pointA:'#147048', pointB:'#e8dcc0',
    bar:'#063828', barMotif:'#c8a557',
    wTop:'#f5efe0', wBot:'#d8cba8', wEdge:'#b8a880',
    bTop:'#0d6648', bBot:'#064030', bEdge:'#2a8a64',
    glow:'#3fe0a0'
  },
  ceviz: {
    name: 'Topkapı Altın',
    bg:'#1a0d08', felt:'#5e1a1a', frame:'#d4af37', frameDark:'#9a7d27',
    pointA:'#7a1e1e', pointB:'#d9b86a',
    bar:'#4a1414', barMotif:'#d4af37',
    wTop:'#f5ecd2', wBot:'#e0cca0', wEdge:'#c0a870',
    bTop:'#9a2424', bBot:'#5e1414', bEdge:'#c04040',
    glow:'#e0b850'
  },
  buz: {
    name: 'Buzlu Deniz',
    bg:'#0a1820', felt:'#3a5d7c', frame:'#a8c0d4', frameDark:'#7898b0',
    pointA:'#5a7d9c', pointB:'#e8f0f6',
    bar:'#243c52', barMotif:'#c8d8e8',
    wTop:'#f8fbfd', wBot:'#dce8f0', wEdge:'#b8ccdc',
    bTop:'#4a6d8c', bBot:'#243c52', bEdge:'#6a8dac',
    glow:'#80c0e0'
  }
};
let SELECTED_THEME = (function(){ try{ const t = localStorage.getItem('hero_tavla_theme'); return (t && THEMES[t]) ? t : 'kizil'; }catch(e){ return 'kizil'; } })();
let AUTO_ROLL = (function(){ try{ return localStorage.getItem('hero_tavla_autoroll') === 'on'; }catch(e){ return false; } })();
const AUTO_ROLL_MS = 5000;   // 5 sn içinde atılmazsa otomatik

let G = null;

// ════════════ AÇILIŞ ════════════
export function openTavla(){
  injectCSS();
  const root = document.createElement('div');
  root.className = 'tavla-root';
  root.innerHTML = `
    <div class="tv-modes" data-el="modeSelect">
      <div class="tvm-head">
        <button class="tv-icon" data-act="close">✕</button>
        <div class="tvm-title">🎲 TAVLA</div>
        <div style="display:flex;gap:6px">
          <button class="tv-icon" data-act="autoroll" data-el="autoRollBtn" title="Otomatik zar">⏱️</button>
          <button class="tv-icon" data-act="sound" data-el="soundBtn" title="Ses">🔊</button>
          <button class="tv-icon" data-act="theme" title="Tema">🎨</button>
        </div>
      </div>
      <div class="tvm-sub">Bir oyun modu seç</div>
      <div class="tvm-cards">
        <button class="tvm-card" data-mode="local">
          <span class="tvm-ic">👥</span>
          <div class="tvm-name">AYNI CİHAZDA 2 OYUNCU</div>
          <div class="tvm-desc">Sırayla aynı ekranda oynayın</div>
        </button>
        <button class="tvm-card" data-mode="ai">
          <span class="tvm-ic">🤖</span>
          <div class="tvm-name">YAPAY ZEKÂ</div>
          <div class="tvm-desc">Bilgisayara karşı oyna</div>
        </button>
        <button class="tvm-card" data-mode="online">
          <span class="tvm-ic">🌐</span>
          <div class="tvm-name">ÇEVRİMİÇİ</div>
          <div class="tvm-desc">Arkadaşınla oda kodu ile oyna</div>
        </button>
      </div>
    </div>

    <div class="tv-game" data-el="game" style="display:none">
      <div class="tg-top">
        <button class="tv-icon" data-act="exit">✕</button>
        <div class="tg-turn" data-el="turn">BEYAZ'IN SIRASI</div>
        <div style="display:flex;gap:6px">
          <button class="tv-icon" data-act="gameAutoRoll" data-el="gameAutoRollBtn" title="Otomatik zar">⏱️</button>
          <button class="tv-icon" data-act="chat" data-el="chatBtn" title="Sohbet" style="display:none">💬<span class="tg-chat-badge" data-el="chatBadge" style="display:none"></span></button>
          <button class="tv-icon" data-act="restart" title="Yeniden">🔄</button>
        </div>
      </div>
      <div class="tg-status" data-el="status"></div>
      <div class="tg-board-wrap" data-el="boardWrap">
        <canvas data-el="canvas"></canvas>
      </div>
      <div class="tg-controls">
        <button class="tg-btn tg-roll" data-act="roll" data-el="rollBtn" style="display:none">🎲 ZAR AT</button>
        <button class="tg-btn" data-act="pass" data-el="passBtn" style="display:none">⏭️ Pas</button>
      </div>
      <div class="tg-actions" data-el="actionsBar">
        <button class="tg-act-btn" data-act="undo" data-el="undoBtn">↩️ Geri Al</button>
        <button class="tg-act-btn" data-act="draw">🤝 Beraberlik</button>
        <button class="tg-act-btn" data-act="break" data-el="breakBtn" style="display:none">🛌 Mola</button>
        <button class="tg-act-btn danger" data-act="resign">🏳️ Pes Et</button>
      </div>
      <div class="tv-chat" data-el="chatPanel" style="display:none">
        <div class="tvc-head">
          <span>💬 Sohbet</span>
          <button class="tvc-close" data-act="chatClose">✕</button>
        </div>
        <div class="tvc-msgs" data-el="chatMsgs"></div>
        <div class="tvc-quick" data-el="chatQuick"></div>
        <div class="tvc-input-row">
          <input class="tvc-input" data-el="chatInput" maxlength="120" placeholder="Mesaj yaz…" autocomplete="off">
          <button class="tvc-send" data-act="chatSend">➤</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  root.querySelector('[data-act="close"]').addEventListener('click', closeAll);
  root.querySelector('[data-act="theme"]').addEventListener('click', () => showThemePicker(root));
  const soundBtn = root.querySelector('[data-el="soundBtn"]');
  if(soundBtn){
    soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
    soundBtn.addEventListener('click', () => { const on = Sound.toggle(); soundBtn.textContent = on ? '🔊' : '🔇'; });
  }
  const autoRollBtn = root.querySelector('[data-el="autoRollBtn"]');
  if(autoRollBtn){
    const paint = () => { autoRollBtn.textContent = '⏱️'; autoRollBtn.style.opacity = AUTO_ROLL ? '1' : '0.4'; autoRollBtn.title = AUTO_ROLL ? 'Otomatik zar: AÇIK (5sn)' : 'Otomatik zar: kapalı'; };
    paint();
    autoRollBtn.addEventListener('click', () => {
      AUTO_ROLL = !AUTO_ROLL;
      try{ localStorage.setItem('hero_tavla_autoroll', AUTO_ROLL ? 'on' : 'off'); }catch(e){}
      paint();
      if(window.Hero && window.Hero.toast) window.Hero.toast(AUTO_ROLL ? 'Otomatik zar açıldı (5 sn)' : 'Otomatik zar kapatıldı', false);
    });
  }
  root.querySelectorAll('.tvm-card:not(.soon)').forEach(card => {
    card.addEventListener('click', () => {
      try{ Sound.resume(); }catch(e){}
      const mode = card.dataset.mode;
      if(mode === 'ai'){ showAISetup(root); return; }
      if(mode === 'online'){ showOnlineLobby(root); return; }
      startGame(root, mode);
    });
  });
  G = { root, mode:null };

  // DAVET BAGLAMI: davetle acildiysa otomatik online host/guest
  try{
    const raw = localStorage.getItem('hero_invite_ctx');
    if(raw){
      const ctx = JSON.parse(raw);
      if(ctx && ctx.game === 'tavla' && ctx.code && (Date.now() - (ctx.ts||0)) < 120000){
        localStorage.removeItem('hero_invite_ctx');
        _startInviteTavla(root, ctx);
        return;
      } else if(ctx && (Date.now() - (ctx.ts||0)) >= 120000){
        localStorage.removeItem('hero_invite_ctx');
      }
    }
  }catch(e){}
}

// Davetle baslatilan online tavla (host/guest otomatik)
async function _startInviteTavla(root, ctx){
  const isHost = ctx.role === 'host';
  const wait = document.createElement('div');
  wait.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,8,14,.92);color:#c8a557;font-family:system-ui;gap:14px';
  wait.innerHTML = '<div style="font-size:42px">' + (isHost?'\u23f3':'\u2694\ufe0f') + '</div>'
    + '<div id="tinvMsg" style="font-size:16px;font-weight:800">' + (isHost ? (esc(ctx.oppNick)+' bekleniyor...') : (esc(ctx.oppNick)+'\'e baglaniliyor...')) + '</div>'
    + '<div style="font-size:11px;color:#9fb0d8">Davet kodu: ' + esc(ctx.code) + '</div>'
    + '<button id="tinvCancel" style="margin-top:8px;padding:8px 18px;border-radius:10px;border:1px solid rgba(255,82,82,.4);background:rgba(255,82,82,.1);color:#ff8a80;font-weight:800;cursor:pointer">Vazgec</button>';
  root.appendChild(wait);
  let cancelled = false;
  wait.querySelector('#tinvCancel').addEventListener('click', () => { cancelled = true; try{ if(TavlaMP) TavlaMP.close(); }catch(e){} closeAll(); });

  // TavlaMP yukle
  try{ if(!TavlaMP) TavlaMP = (await import('./tavla-mp.js')).default; }
  catch(e){ wait.querySelector('#tinvMsg').textContent = 'Baglanti modulu yuklenemedi'; return; }

  const onConnected = () => {
    if(cancelled) return;
    wait.remove();
    G && (G.oppName = ctx.oppNick);
    startGame(root, 'online', { isHost });
  };

  if(isHost){
    TavlaMP.createRoom((type, data) => {
      if(cancelled) return;
      if(type === 'connected'){ onConnected(); }
      else if(type === 'error'){ const m=wait.querySelector('#tinvMsg'); if(m) m.textContent = 'Hata: ' + data; }
    }, ctx.code);
  } else {
    let tries = 0;
    const tryJoin = () => {
      if(cancelled) return;
      tries++;
      TavlaMP.joinRoom(ctx.code, (type, data) => {
        if(type === 'connected'){ onConnected(); }
        else if(type === 'error'){
          if(tries < 8){ setTimeout(tryJoin, 1500); }
          else { const m=wait.querySelector('#tinvMsg'); if(m) m.textContent = 'Baglanilamadi (host hazir degil)'; }
        }
      });
    };
    setTimeout(tryJoin, 800);
  }
}

function closeAll(){
  try{ if(G && G._home) G._home.remove(); }catch(e){}
  clearAutoRollTimer();
  clearBreakTimers();
  if(G && G._autoPassTimer){ clearTimeout(G._autoPassTimer); G._autoPassTimer = null; }
  if(G && G._passRAF){ cancelAnimationFrame(G._passRAF); G._passRAF = null; }
  if(G && G._rollHintRAF){ cancelAnimationFrame(G._rollHintRAF); G._rollHintRAF = null; }
  if(G){ if(G.moveGraceTimer){ clearTimeout(G.moveGraceTimer); } if(G.moveGraceInterval){ clearInterval(G.moveGraceInterval); } G.moveGraceActive = false; }
  try{ if(G && G.online) TavlaMP.close(); }catch(e){}
  if(G && G.resizeHandler) window.removeEventListener('resize', G.resizeHandler);
  if(G && G.root){ G.root.remove(); }
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
    G._home = m.mountGameHome('tavla',
      () => { try{ closeAll(); }catch(e){} try{ import('../nav.js').then(n => n.go && n.go('home')); }catch(e){} },
      {
        sound:   { get:()=>Sound.enabled, toggle:()=>Sound.toggle() },
        onTheme: () => { if(G && G.root) showThemePicker(G.root); },
      });
  }).catch(()=>{});

  G.mode = mode;
  G.online = (mode === 'online');
  G.isHost = opts.isHost || false;
  G.difficulty = opts.difficulty || 'medium';
  if(mode === 'online'){
    G.playerColor = G.isHost ? 'w' : 'b';
    G.aiColor = null;
  } else {
    G.playerColor = opts.playerColor || 'w';     // AI modunda insanın rengi
    G.aiColor = G.playerColor === 'w' ? 'b' : 'w';
  }
  // ── AI modunda kayıtlı oyun varsa devam et
  G._resuming = false;
  if(mode === 'ai' && !opts.fresh){
    const saved = loadAIGame();
    if(saved && saved.state){
      G.state = saved.state;
      G.playerColor = saved.playerColor || G.playerColor;
      G.aiColor = saved.aiColor || G.aiColor;
      G.difficulty = saved.difficulty || G.difficulty;
      G.rolled = saved.rolled || false;
      G.openingDice = saved.openingDice || [1,1];
      if(saved.theme && THEMES[saved.theme]) SELECTED_THEME = saved.theme;
      G._resuming = true;
      G._savedFlip = saved.flip;
    }
  }
  if(!G._resuming){ G.state = newGame(); }
  G.canvas = root.querySelector('[data-el="canvas"]');
  G.ctx = G.canvas.getContext('2d');
  G.boardWrap = root.querySelector('[data-el="boardWrap"]');
  G.selected = null;        // seçili kaynak nokta (0..23 veya 'bar')
  G.legalForSel = [];       // seçili noktanın hamleleri
  G.undoStack = [];
  G.gameEnded = false;
  G.rolled = false;         // bu sırada zar atıldı mı
  G.flip = false;           // tahta yönü
  G.aiThinking = false;
  G.oppLeft = false;
  G.unreadChat = 0; G.chatOpen = false;

  if(G.online){
    TavlaMP.__setHandler((type, data) => {
      if(type === 'message' && data && data.type === 'hello'){ onHello(data); return; }
      onRemoteMessage(type, data);
    });
    G._helloSent = false;
    setTimeout(() => { if(G && G.online){ G._helloSent = true; sendHello(); } }, 900);
  }

  // Açılış zarı — resume'da mevcut state korunur
  if(!G._resuming){
    if(G.online && !G.isHost){
      G.openingDice = [1, 1];
      G.state.turn = 'w';
    } else {
      const open = openingRoll();
      G.state.turn = open.first;
      G.openingDice = open.dice;
    }
  }

  gameEl.querySelector('[data-act="exit"]').addEventListener('click', closeAll);
  gameEl.querySelector('[data-act="restart"]').addEventListener('click', () => restart());
  const gAR = gameEl.querySelector('[data-el="gameAutoRollBtn"]');
  if(gAR){
    const paintG = () => { gAR.style.opacity = AUTO_ROLL ? '1' : '0.4'; gAR.title = AUTO_ROLL ? 'Otomatik zar: AÇIK (5sn)' : 'Otomatik zar: kapalı'; };
    paintG();
    gAR.addEventListener('click', () => {
      AUTO_ROLL = !AUTO_ROLL;
      try{ localStorage.setItem('hero_tavla_autoroll', AUTO_ROLL ? 'on' : 'off'); }catch(e){}
      paintG();
      if(AUTO_ROLL){ startAutoRollTimer(); }
      else {
        clearAutoRollTimer();
        // Sayaç mesajını da temizle (takılı kalmasın)
        if(!G.rolled){ updateStatus((G.state.turn==='w'?'Beyaz':'Siyah') + ' — zar at'); }
      }
      if(window.Hero && window.Hero.toast) window.Hero.toast(AUTO_ROLL ? 'Otomatik zar açıldı (5 sn)' : 'Otomatik zar kapatıldı', false);
    });
  }
  gameEl.querySelector('[data-act="roll"]').addEventListener('click', () => rollAndShow());
  gameEl.querySelector('[data-act="undo"]').addEventListener('click', () => undoMove());
  gameEl.querySelector('[data-act="pass"]').addEventListener('click', () => endTurn());
  gameEl.querySelector('[data-act="draw"]').addEventListener('click', () => offerDraw());
  gameEl.querySelector('[data-act="resign"]').addEventListener('click', () => resignGame());
  gameEl.querySelector('[data-act="break"]').addEventListener('click', () => requestBreak());
  G.canvas.addEventListener('pointerdown', onPointerDown);
  G.canvas.addEventListener('pointermove', onPointerMove);
  G.canvas.addEventListener('pointerup', onPointerUp);
  G.canvas.addEventListener('pointercancel', onPointerUp);

  G.resizeHandler = () => fitCanvas();
  window.addEventListener('resize', G.resizeHandler);

  // Tahta yönü ÖNCE belirlensin ki fitCanvas doğru yönle çizsin
  // AI/online'da insan rengine göre sabit; 2 oyuncuda döner
  if(G._resuming && G._savedFlip !== undefined){ G.flip = G._savedFlip; }
  else if(mode === 'ai' || mode === 'online'){ G.flip = (G.playerColor === 'b'); }
  else if(mode === 'local'){ G.flip = (G.state.turn === 'b'); }

  fitCanvas();
  // Portal HUD enjekte et
  try{
    const _st=window.Hero&&window.Hero.Auth&&window.Hero.Auth.getState();
    const _p=window.Hero&&window.Hero.Store&&window.Hero.Store.getState();
    const _myNick=(_st&&(_st.profile&&_st.profile.nick||_st.displayName))||'Oyuncu';
    const _myAva=(_st&&_st.profile&&_st.profile.avatar)||'👤';
    const _myLv=(_p&&_p.level)||1;
    const _myXp=(_p&&_p.xp)||0;
    const oppN=G.oppName||'Rakip'; const oppA=G.oppAvatar||'🎲';
    const oppL=G.oppLevel||1; const oppX=G.oppXP||0;
    createVsHUD({
      root: gameEl, game:'tavla', myAccent:'#FF9800', oppAccent:'#42A5F5',
      oppUid: G.oppUid||null, oppNick:oppN, oppAvatar:oppA, oppLevel:oppL, oppXP:oppX,
      myScore: ()=>0, oppScore: ()=>0,
    }).then(h=>{ G._hud=h; }).catch(()=>{});
  }catch(e){ console.warn('[tavla hud]',e); }
  // Oyun ekranı yeni açıldı — board-wrap boyutu reflow sonrası kesinleşince
  // canvas ve taşların tam oturması için yeniden boyutlandır (özellikle flip=true)
  requestAnimationFrame(() => { if(G && G.canvas && G.boardWrap) fitCanvas(); });
  setTimeout(() => { if(G && G.canvas && G.boardWrap) fitCanvas(); }, 60);

  if(G.online){
    setupChat();
    if(G.isHost){
      // host açılış zarını misafire bildir
      TavlaMP.send({ type:'start', openingDice: G.openingDice, first: G.state.turn });
      updateTurn();
      updateStatus(`Açılış: Beyaz ${G.openingDice[0]} – Siyah ${G.openingDice[1]} · ${G.state.turn==='w'?'Beyaz':'Siyah'} başlar`);
    } else {
      updateTurn();
      updateStatus('Bağlandı — oyun başlıyor…');
    }
    updateControls();
    draw();
    startAutoRollTimer();
    return;
  }

  updateTurn();
  if(G._resuming){
    updateStatus(G.rolled ? 'Kaldığın yerden devam — pul seç' : 'Kaldığın yerden devam — zar at');
    if(window.Hero && window.Hero.toast) window.Hero.toast('♟️ Kaldığın yerden devam ediyorsun', false);
  } else {
    updateStatus(`Açılış: Beyaz ${G.openingDice[0]} – Siyah ${G.openingDice[1]} · ${G.state.turn==='w'?'Beyaz':'Siyah'} başlar`);
  }
  updateControls();
  draw();
  G._resuming = false;
  // AI sırasındaysa otomatik oyna
  maybeAITurn();
  startAutoRollTimer();
}

function restart(){
  if(G.online) return;   // çevrimiçi oyunda tek taraflı sıfırlama yok
  clearAIGame();   // yeni oyun → kayıt sil
  G.state = newGame();
  const open = openingRoll();
  G.state.turn = open.first; G.openingDice = open.dice;
  G.selected = null; G.legalForSel = []; G.undoStack = []; G.gameEnded = false; G.rolled = false; G.aiThinking = false;
  if(G.mode === 'ai'){ G.flip = (G.playerColor === 'b'); }
  else if(G.mode === 'local'){ G.flip = (G.state.turn === 'b'); }
  updateTurn();
  updateStatus(`Açılış: Beyaz ${G.openingDice[0]} – Siyah ${G.openingDice[1]} · ${G.state.turn==='w'?'Beyaz':'Siyah'} başlar`);
  updateControls(); draw();
  maybeAITurn();
  startAutoRollTimer();
}


// ════════════ AI OYUN KAYIT / YÜKLEME (kaldığın yerden devam) ════════════
const TAVLA_SAVE_KEY = 'hero_tavla_ai_save';
function saveAIGame(){
  if(!G || G.mode !== 'ai' || G.gameEnded) return;
  try{
    localStorage.setItem(TAVLA_SAVE_KEY, JSON.stringify({
      state: G.state, playerColor: G.playerColor, aiColor: G.aiColor,
      difficulty: G.difficulty, rolled: G.rolled, openingDice: G.openingDice,
      flip: G.flip, theme: SELECTED_THEME, ts: Date.now()
    }));
  }catch(e){}
}
function clearAIGame(){ try{ localStorage.removeItem(TAVLA_SAVE_KEY); }catch(e){} }
function loadAIGame(){
  try{
    const raw = localStorage.getItem(TAVLA_SAVE_KEY);
    if(!raw) return null;
    const snap = JSON.parse(raw);
    if(Date.now() - (snap.ts||0) > 12*3600*1000){ clearAIGame(); return null; }  // 12 saat
    return snap;
  }catch(e){ return null; }
}

// ════════════ ZAR ATMA ════════════
function rollAndShow(){
  if(G.gameEnded || G.rolled || G.aiThinking) return;
  if(G.mode === 'ai' && G.state.turn === G.aiColor) return;
  if(G.online && G.state.turn !== G.playerColor) return;   // sıra rakipte
  clearAutoRollTimer();
  G.state.dice = rollDice();
  G.state.used = [];
  G.rolled = true;
  G.undoStack = [];
  try{ Sound.dice(); }catch(e){}
  if(G.online){ TavlaMP.send({ type:'dice', dice: G.state.dice }); }
  const moves = allLegalMoves(G.state);
  const dd = G.state.dice;
  const diceStr = dd.length === 4 ? `${dd[0]}-${dd[0]} (çift!)` : `${dd[0]}-${dd[1]}`;
  animateDiceRoll(() => {
    if(moves.length === 0){
      updateStatus(`🎲 ${diceStr} — oynanabilir hamle yok, 2 sn içinde otomatik pas…`);
      G.canPass = true;
      // ⏭️ Otomatik pas: gele/hamle yoksa 2 saniyede sırayı devret
      // Sadece insan oyuncunun KENDİ sırasında (AI hamlesi değil)
      const _isAIturn = (G.mode==='ai' && G.state.turn !== G.playerColor);
      const _isOppTurn = (G.online && G.state.turn !== G.playerColor);
      if(!_isAIturn && !_isOppTurn){
        if(G._autoPassTimer){ clearTimeout(G._autoPassTimer); }
        G._autoPassTimer = setTimeout(() => {
          G._autoPassTimer = null;
          // Hâlâ aynı durumda mı? (oyuncu zar atmadı, hamle yok, sıra değişmedi)
          if(G && !G.gameEnded && G.rolled && G.canPass){
            const stillNone = allLegalMoves(G.state).length === 0;
            if(stillNone){ try{ Sound.move && Sound.move(); }catch(e){} endTurn(); }
          }
        }, 2000);
      }
    } else {
      updateStatus(`🎲 ${diceStr} — pul seç`);
    }
    updateControls();
    draw();
  });
}

// ════════════ CANVAS BOYUT ════════════
function fitCanvas(){
  if(!G || !G.canvas) return;
  const wrap = G.boardWrap;
  // wrap (.tg-board-wrap) flex:1 ile kalan alanı zaten alıyor →
  // clientWidth/clientHeight DOM'dan direkt okunur, manuel rezerv hesabı YOK.
  const availW = wrap.clientWidth  || (window.innerWidth  - 16);
  const availH = wrap.clientHeight || (window.innerHeight - 160);
  // Tavla oranı ~1.40 (dikey-uzun). 1.30–1.50 arasına sabitle.
  let ratio = availH / availW;
  ratio = Math.max(1.30, Math.min(ratio, 1.50));
  let w = availW, h = w * ratio;
  // Yükseklik taşarsa genişlikten kıs (ama en-boy korunur)
  if(h > availH){ h = availH; w = h / ratio; }
  // Genişlik taşarsa yükseklikten kıs
  if(w > availW){ w = availW; h = w * ratio; }
  const dpr = window.devicePixelRatio || 1;
  G.W = Math.floor(w); G.H = Math.floor(h);
  G.canvas.width = G.W * dpr; G.canvas.height = G.H * dpr;
  G.canvas.style.width = G.W + 'px'; G.canvas.style.height = G.H + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeLayout();
  draw();
}

// Tahta geometrisi — TAMAMEN ORANSAL (sabit piksel YOK).
// Bölgeler: [sol oyun yarısı | orta bar | sağ oyun yarısı | toplama oluğu]
function computeLayout(){
  const W = G.W, H = G.H;
  // iç kenar boşluğu (altın çerçeve ile keçe arası) — oransal
  const pad = Math.round(Math.min(W, H) * 0.045);
  const innerX = pad, innerY = pad;
  const innerW = W - pad * 2, innerH = H - pad * 2;
  // bölge genişlikleri (keçe genişliğine oransal)
  const barW = Math.round(innerW * 0.085);    // orta bar
  const bearW = Math.round(innerW * 0.075);   // sağ toplama oluğu
  const playW = innerW - barW - bearW;         // iki oyun yarısının toplam genişliği
  const halfW = playW / 2;                      // bir yarı (6 sütun)
  const colW = halfW / 6;                       // bir nokta sütunu
  const checkerR = colW * 0.42;                 // pul yarıçapı (sütuna güvenli sığar)
  const pointH = innerH * 0.42;                 // üçgen yüksekliği
  const safe = Math.max(2, checkerR * 0.40);    // kenarlardan güvenli boşluk (oransal)
  G.geo = {
    pad, innerX, innerY, innerW, innerH,
    barW, bearW, playW, halfW, colW, checkerR, pointH, safe,
    leftX:  innerX,                       // sol yarı başlangıcı
    barX:   innerX + halfW,               // orta bar başlangıcı
    rightX: innerX + halfW + barW,        // sağ yarı başlangıcı
    bearX:  innerX + halfW + barW + halfW // toplama oluğu başlangıcı (= keçe sağ kenarından bearW içeride)
  };
}

// Bir noktanın (0..23) ekran konumu: üçgen tabanının orta x'i + üst mü alt mı
// Yerleşim (flip=false, beyaz altta mantığı): 
//   alt sıra: idx 0..11 sağdan sola (sağ alt köşe idx0)
//   üst sıra: idx 12..23 soldan sağa (sol üst idx12)
function pointGeometry(idx){
  const g = G.geo;
  const flip = G.flip;
  let i = idx;
  // flip: tahtayı 180° döndür → idx eşlemesi
  // Standart tavla görseli: alt-sağ çeyrek 0..5, alt-sol 6..11, üst-sol 12..17, üst-sağ 18..23
  let bottom, slot, quadLeft;
  if(i <= 11){ bottom = true; } else { bottom = false; }
  // sütun indeksi (0..5) ve hangi yarı
  if(i <= 5){          // alt-sağ (sağ yarı), sağdan sola
    quadLeft = false; slot = i;          // i=0 en sağ
  } else if(i <= 11){  // alt-sol (sol yarı), sağdan sola
    quadLeft = true; slot = i - 6;       // i=6 → sol yarının en sağı
  } else if(i <= 17){  // üst-sol (sol yarı), soldan sağa
    quadLeft = true; slot = i - 12;      // i=12 en sol
  } else {             // üst-sağ (sağ yarı), soldan sağa
    quadLeft = false; slot = i - 18;
  }

  // x hesapla
  let baseX;
  if(quadLeft){
    // sol yarı: leftX .. leftX+halfW
    if(bottom){ // sağdan sola: slot 0 en sağ
      baseX = g.leftX + g.halfW - (slot + 0.5) * g.colW;
    } else {    // soldan sağa: slot 0 en sol
      baseX = g.leftX + (slot + 0.5) * g.colW;
    }
  } else {
    // sağ yarı: rightX .. rightX+halfW
    if(bottom){ // sağdan sola
      baseX = g.rightX + g.halfW - (slot + 0.5) * g.colW;
    } else {    // soldan sağa
      baseX = g.rightX + (slot + 0.5) * g.colW;
    }
  }

  let top = !bottom;
  // flip uygulandığında üst/alt ve x ters döner.
  // ÖNEMLİ: iki oyun yarısı BAR MERKEZİNE göre simetriktir (bear-off oluğu sağda
  // olduğu için keçe merkezi ≠ bar merkezi). Keçe merkezine aynalarsak kenar
  // sütunlardaki pullar bar'a/bear-off'a düşer. Bu yüzden bar merkezine aynalanır.
  if(flip){
    top = !top;
    const barCenter = g.barX + g.barW / 2;
    baseX = barCenter * 2 - baseX;
  }
  const y0 = top ? g.innerY : (g.innerY + g.innerH);   // üçgen tabanı (kenar)
  const dir = top ? 1 : -1;                            // üçgen içe doğru
  return { baseX, y0, dir, top, colW: g.colW };
}

// ════════════ ÇİZİM ════════════
function draw(){
  if(!G || !G.ctx) return;
  const ctx = G.ctx, t = THEMES[SELECTED_THEME], g = G.geo, W = G.W, H = G.H;
  ctx.clearRect(0, 0, W, H);

  // dış zemin (koyu radyal vinyet)
  const bgGrad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.2, W/2, H/2, Math.max(W,H)*0.7);
  bgGrad.addColorStop(0, _shade(t.bg, 1.25));
  bgGrad.addColorStop(1, t.bg);
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

  // ── ALTIN ÇERÇEVE (çok katmanlı metalik) ──
  _roundRect(ctx, 2, 2, W-4, H-4, 12);
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, _shade(t.frame, 1.25));
  fg.addColorStop(0.25, t.frame);
  fg.addColorStop(0.5, t.frameDark);
  fg.addColorStop(0.75, t.frame);
  fg.addColorStop(1, _shade(t.frame, 1.15));
  ctx.fillStyle = fg; ctx.fill();
  // çerçeve üst parlama
  _roundRect(ctx, 2, 2, W-4, H-4, 12);
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  // çerçeve iç oyma çizgisi (altın detay)
  _roundRect(ctx, g.innerX-6, g.innerY-6, g.innerW+12, g.innerH+12, 8);
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 2; ctx.stroke();
  _roundRect(ctx, g.innerX-4, g.innerY-4, g.innerW+8, g.innerH+8, 6);
  ctx.strokeStyle = _shade(t.frame, 1.3); ctx.lineWidth = 1; ctx.stroke();

  // ── İÇ KEÇE (kadife dokusu: gradyan + ince vinyet) ──
  const feltGrad = ctx.createLinearGradient(g.innerX, g.innerY, g.innerX, g.innerY + g.innerH);
  feltGrad.addColorStop(0, _shade(t.felt, 1.15));
  feltGrad.addColorStop(0.5, t.felt);
  feltGrad.addColorStop(1, _shade(t.felt, 0.85));
  ctx.fillStyle = feltGrad;
  ctx.fillRect(g.innerX, g.innerY, g.innerW, g.innerH);
  // keçe vinyet (kenarlar koyu)
  const fv = ctx.createRadialGradient(
    g.innerX + g.innerW/2, g.innerY + g.innerH/2, Math.min(g.innerW,g.innerH)*0.15,
    g.innerX + g.innerW/2, g.innerY + g.innerH/2, Math.max(g.innerW,g.innerH)*0.6);
  fv.addColorStop(0, 'rgba(0,0,0,0)');
  fv.addColorStop(1, 'rgba(0,0,0,.32)');
  ctx.fillStyle = fv;
  ctx.fillRect(g.innerX, g.innerY, g.innerW, g.innerH);
  // ince kadife doku (hafif noise çizgileri)
  _drawFeltTexture(ctx, g.innerX, g.innerY, g.innerW, g.innerH);

  // üçgen noktalar
  for(let i=0;i<24;i++){ drawPoint(ctx, i, t); }

  // orta bar — kadife gradyan
  const barGrad = ctx.createLinearGradient(g.barX, 0, g.barX + g.barW, 0);
  barGrad.addColorStop(0, _shade(t.bar, 0.75));
  barGrad.addColorStop(0.5, _shade(t.bar, 1.12));
  barGrad.addColorStop(1, _shade(t.bar, 0.75));
  ctx.fillStyle = barGrad;
  ctx.fillRect(g.barX, g.innerY, g.barW, g.innerH);
  _drawFeltTexture(ctx, g.barX, g.innerY, g.barW, g.innerH);
  drawBarMotif(ctx, t);
  // bar altın kenar şeritleri
  ctx.fillStyle = _shade(t.frame, 1.1);
  ctx.fillRect(g.barX - 2, g.innerY, 2, g.innerH);
  ctx.fillRect(g.barX + g.barW, g.innerY, 2, g.innerH);

  // bear-off oluğu — kadife gradyan + altın kenar
  const bearGrad = ctx.createLinearGradient(g.bearX, 0, g.bearX + g.bearW, 0);
  bearGrad.addColorStop(0, _shade(t.bar, 0.7));
  bearGrad.addColorStop(0.5, _shade(t.bar, 1.05));
  bearGrad.addColorStop(1, _shade(t.bar, 0.7));
  ctx.fillStyle = bearGrad;
  ctx.fillRect(g.bearX, g.innerY, g.bearW, g.innerH);
  _drawFeltTexture(ctx, g.bearX, g.innerY, g.bearW, g.innerH);
  ctx.fillStyle = _shade(t.frame, 1.1);
  ctx.fillRect(g.bearX - 2, g.innerY, 2, g.innerH);
  // toplanan pul göstergesi
  drawBearOff(ctx, t);

  // seçili nokta vurgusu + hedefler
  if(G.selected !== null){
    highlightSelection(ctx, t);
  }

  // pullar
  drawCheckers(ctx, t);

  // bar'daki pullar
  drawBarCheckers(ctx, t);

  // zarlar
  drawDice(ctx, t);

  // vurulan pul (bar'a uçar)
  if(G.hitChecker){
    drawChecker(ctx, G.hitChecker.x, G.hitChecker.y, G.hitChecker.r, G.hitChecker.color, t);
  }
  // hareket eden pul (AI animasyonu)
  if(G.movingChecker){
    drawChecker(ctx, G.movingChecker.x, G.movingChecker.y, G.movingChecker.r, G.movingChecker.color, t);
  }
  // sürüklenen pul (parmağı takip eder)
  if(G.dragging && G.dragMoved && G.dragPos){
    drawChecker(ctx, G.dragPos.x, G.dragPos.y, G.geo.checkerR * 1.15, G.state.turn, t);
  }
  // ZAR AT mini belirteç (sol-orta, zar atılmadıysa)
  if(!G.rolled && canInteractRoll()){ drawRollHint(ctx, t); }
  // PAS mini butonu (zar atıldı ama hamle yok → zarların altında)
  else { G._passBox = null; }
  if(G.rolled && G.canPass && canPassNow()){ drawPassHint(ctx, t); }
}

// Şu an pas geçebilir miyim? (insan, kendi sıram)
function canPassNow(){
  if(!G || G.gameEnded || !G.rolled || !G.canPass) return false;
  if(G.mode==='ai' && G.state.turn===G.aiColor) return false;
  if(G.online && G.state.turn!==G.playerColor) return false;
  return true;
}

// Zarların ALTINDA küçük PAS butonu (ZAR AT rozetinin minik versiyonu)
function drawPassHint(ctx, t){
  const g = G.geo;
  // Zarların merkezi (drawDice ile aynı hesap)
  const sz = Math.min(g.barW * 1.0, g.innerH * 0.085, g.halfW * 0.30);
  const halfCx = G.flip ? (g.leftX + g.halfW * 0.5) : (g.rightX + g.halfW * 0.5);
  const diceCy = g.innerY + g.innerH / 2;
  // Çift zarda 2x2 ızgara → daha aşağı; tekli sıra → bir zar yarısı
  const isDouble = G.state.dice && G.state.dice.length === 4;
  const diceBottom = diceCy + (isDouble ? sz*1.28*0.5 + sz*0.5 : sz*0.5);
  // PAS rozeti — ZAR AT'tan belirgin küçük
  const w = Math.min(g.halfW * 0.44, 84);
  const h = Math.max(22, w * 0.34);
  const cx = halfCx;
  const cy = diceBottom + h*0.85 + sz*0.18;
  ctx.save();
  const t0 = (performance.now() % 1400) / 1400;
  const pulse = 1 + Math.sin(t0 * Math.PI * 2) * 0.05;
  ctx.translate(cx, cy); ctx.scale(pulse, pulse);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2;
  _roundRect(ctx, -w/2, -h/2, w, h, h*0.45);
  const grd = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
  grd.addColorStop(0,'rgba(120,128,150,.97)'); grd.addColorStop(1,'rgba(80,86,104,.97)');
  ctx.fillStyle = grd; ctx.fill();
  ctx.shadowColor = 'transparent';
  _roundRect(ctx, -w/2, -h/2, w, h, h*0.45);
  ctx.strokeStyle = 'rgba(220,225,240,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.floor(h*0.42)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⏭ PAS', 0, 1);
  ctx.restore();
  // Hit-test için kutuyu sakla (ölçeksiz koordinat)
  G._passBox = { x: cx - w/2, y: cy - h/2, w, h };
  // Nabız animasyonu için sürekli çizim
  if(G && !G._passRAF){
    G._passRAF = requestAnimationFrame(() => {
      if(!G) return;
      G._passRAF = null;
      if(G && G.rolled && G.canPass && G.ctx) draw();
    });
  }
}

function canInteractRoll(){
  if(!G || G.gameEnded || G.rolled || G.aiThinking) return false;
  if(G.mode==='ai' && G.state.turn===G.aiColor) return false;
  if(G.online && G.state.turn!==G.playerColor) return false;
  return true;
}

// Sol-orta, sivri uçtan ve bar'dan uzak küçük ZAR AT rozeti
function drawRollHint(ctx, t){
  const g = G.geo;
  const cx = (G.flip ? g.rightX : g.leftX) + g.halfW * 0.5;
  const cy = g.innerY + g.innerH * 0.5;
  // Yükseklik referansı (eski genişlikten türetilir, görsel oran korunur)
  const wRef = Math.min(g.halfW * 0.62, 130);
  const h = Math.max(30, wRef * 0.32);
  const ds = h * 0.52;                       // zar boyutu
  const label = 'ZAR AT';
  ctx.save();
  const t0 = (performance.now() % 1400) / 1400;
  const pulse = 1 + Math.sin(t0 * Math.PI * 2) * 0.04;
  ctx.translate(cx, cy); ctx.scale(pulse, pulse);
  // ── Genişliği İÇERİĞE göre hesapla (sağdaki boşluk kalkar) ──
  ctx.font = `900 ${Math.floor(h*0.40)}px system-ui, sans-serif`;
  const textW = ctx.measureText(label).width;
  const padL = ds * 0.9;                      // sol kenar → zar merkezi
  const gap  = ds * 0.55;                     // zar ile yazı arası
  const padR = h * 0.42;                      // yazı sonu → sağ kenar
  const w = padL + ds*0.5 + gap + textW + padR;
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3;
  _roundRect(ctx, -w/2, -h/2, w, h, h*0.45);
  const grd = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
  grd.addColorStop(0,'rgba(200,165,87,.97)'); grd.addColorStop(1,'rgba(158,122,42,.97)');
  ctx.fillStyle = grd; ctx.fill();
  ctx.shadowColor = 'transparent';
  _roundRect(ctx, -w/2, -h/2, w, h, h*0.45);
  ctx.strokeStyle = 'rgba(255,235,180,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  // zar (sol) + yazı (zarın hemen sağında)
  const dieX = -w/2 + padL;
  drawDie(ctx, dieX, 0, ds, 5, false);
  ctx.fillStyle = '#1a1208';
  ctx.font = `900 ${Math.floor(h*0.40)}px system-ui, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, dieX + ds*0.5 + gap, 1);
  ctx.restore();
  if(G && !G._rollHintRAF){
    G._rollHintRAF = requestAnimationFrame(() => {
      if(!G) return;                       // oyundan çıkıldıysa dur
      G._rollHintRAF = null;
      if(!G.rolled && G.ctx) draw();
    });
  }
}

function drawPoint(ctx, idx, t){
  const pg = pointGeometry(idx);
  const g = G.geo;
  const half = pg.colW * 0.5;
  const tipY = pg.y0 + pg.dir * g.pointH;
  const isA = (idx % 2 === 0);
  const baseCol = isA ? t.pointA : t.pointB;
  const x0 = pg.baseX - half*0.86, x1 = pg.baseX + half*0.86;

  ctx.save();
  // Üçgen yolu
  const tri = () => { ctx.beginPath(); ctx.moveTo(x0, pg.y0); ctx.lineTo(x1, pg.y0); ctx.lineTo(pg.baseX, tipY); ctx.closePath(); };

  // ── Ana gövde: tabandan uca gradyan (parlak taban → koyu uç) ──
  const grad = ctx.createLinearGradient(pg.baseX, pg.y0, pg.baseX, tipY);
  grad.addColorStop(0, _shade(baseCol, isA ? 1.18 : 1.10));   // taban: aydınlık
  grad.addColorStop(0.55, baseCol);
  grad.addColorStop(1, _shade(baseCol, 0.62));                // uç: koyu
  tri(); ctx.fillStyle = grad; ctx.fill();

  // ── Sol kenar boyunca ışık şeridi (3B hacim) ──
  const lg = ctx.createLinearGradient(x0, 0, pg.baseX, 0);
  lg.addColorStop(0, 'rgba(255,255,255,.16)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0)');
  lg.addColorStop(1, 'rgba(0,0,0,.10)');
  tri(); ctx.fillStyle = lg; ctx.fill();

  // ── Uç gölgesi (sivri uca doğru koyulaşma, derinlik) ──
  const tg = ctx.createLinearGradient(pg.baseX, tipY - g.pointH*0.4, pg.baseX, tipY);
  tg.addColorStop(0, 'rgba(0,0,0,0)');
  tg.addColorStop(1, 'rgba(0,0,0,.28)');
  tri(); ctx.fillStyle = tg; ctx.fill();

  // ── Kenar çizgileri (taban parlak, yanlar koyu) ──
  tri();
  ctx.strokeStyle = 'rgba(0,0,0,.30)'; ctx.lineWidth = 1.2; ctx.stroke();
  // taban üst ince altın çizgi
  ctx.beginPath(); ctx.moveTo(x0, pg.y0); ctx.lineTo(x1, pg.y0);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.restore();
}

// Keçe/kadife dokusu — ince çapraz tarama (performanslı, bir kez hesaplanır)
let _feltPattern = null;
function _drawFeltTexture(ctx, x, y, w, h){
  try{
    if(!_feltPattern){
      const pc = document.createElement('canvas'); pc.width = 64; pc.height = 64;
      const pctx = pc.getContext('2d');
      // hafif noise noktaları
      for(let i=0;i<260;i++){
        const px = Math.random()*64, py = Math.random()*64;
        const a = Math.random()*0.04;
        pctx.fillStyle = Math.random()>0.5 ? 'rgba(255,255,255,'+a+')' : 'rgba(0,0,0,'+a+')';
        pctx.fillRect(px, py, 1, 1);
      }
      _feltPattern = ctx.createPattern(pc, 'repeat');
    }
    if(_feltPattern){
      ctx.save();
      ctx.fillStyle = _feltPattern;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }catch(e){}
}

// Renk tonu açma/koyma (factor>1 açar, <1 koyar)
function _shade(hex, factor){
  let h = (hex||'#888').replace('#','');
  if(h.length===3) h = h.split('').map(x=>x+x).join('');
  let r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  r = Math.max(0, Math.min(255, Math.round(r*factor)));
  g = Math.max(0, Math.min(255, Math.round(g*factor)));
  b = Math.max(0, Math.min(255, Math.round(b*factor)));
  return 'rgb('+r+','+g+','+b+')';
}

// Her temanın kendine özgü motifi (tasarım kuralı: motif yalnızca orta bar'da)
const THEME_MOTIF = { iznik:'flower', kizil:'crescent', lacivert:'star8', zumrut:'seljuk', ceviz:'diamond', buz:'snow' };

// Orta bar — TEMİZ (dekoratif sembol/hayalet ikon YOK), yalnızca ince kenar gölgesi
function drawBarMotif(ctx, t){
  const g = G.geo;
  ctx.save();
  // bar kenarlarında hafif iç gölge (3B his)
  const grad = ctx.createLinearGradient(g.barX, 0, g.barX + g.barW, 0);
  grad.addColorStop(0,    'rgba(0,0,0,.28)');
  grad.addColorStop(0.5,  'rgba(0,0,0,0)');
  grad.addColorStop(1,    'rgba(0,0,0,.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(g.barX, g.innerY, g.barW, g.innerH);

  // ── ⚜️ SARAY AY-YILDIZ MOTİFİ (bar üst & alt) — önbellekli ──
  const cx = g.barX + g.barW * 0.5;
  const r = Math.min(g.barW * 0.32, g.innerH * 0.045, 20);
  const yTop = g.innerY + g.innerH * 0.16;
  const yBot = g.innerY + g.innerH * 0.84;
  const sprite = _getCrescentSprite(r, t.frame, t.barMotif || t.frame);
  if(sprite){
    const dw = sprite.width, dh = sprite.height;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(sprite, cx - dw/2, yTop - dh/2);
    ctx.drawImage(sprite, cx - dw/2, yBot - dh/2);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Ay-yıldız motifini bir kez render edip önbelleğe al (FPS korunur)
let _crescentCache = {};
function _getCrescentSprite(r, goldMain, goldLight){
  const key = Math.round(r) + '|' + goldMain + '|' + goldLight;
  if(_crescentCache[key]) return _crescentCache[key];
  try{
    const pad = Math.ceil(r * 0.6);
    const W = Math.ceil(r * 2.5 + pad*2), H = Math.ceil(r * 2.4 + pad*2);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cc = cv.getContext('2d');
    drawCrescentStarLux(cc, W*0.42, H/2, r, goldMain, goldLight, 1.0);
    _crescentCache[key] = cv;
    return cv;
  }catch(e){ return null; }
}

// ⚜️ Premium Saray Ay-Yıldız (çift katman altın hilal + kabartmalı yıldız + gölge + ışıltı)
function drawCrescentStarLux(ctx, cx, cy, r, goldMain, goldLight, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  const gD = _shade(goldMain, 0.7);     // koyu altın
  const gL = _shade(goldLight, 1.35);   // açık altın (parlama)

  // ── Hilal gölgesi (derinlik) ──
  ctx.save();
  ctx.translate(1.5, 2);
  ctx.globalAlpha = alpha * 0.4;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(cx + r*0.42, cy - r*0.05, r*0.82, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // ── Hilal gövdesi (altın gradyan dolgu — offscreen ile temiz kesim) ──
  try{
    const sz = Math.ceil(r*3);
    const tmp = document.createElement('canvas'); tmp.width = sz; tmp.height = sz;
    const tc = tmp.getContext('2d');
    const ox = sz/2, oy = sz/2;
    tc.fillStyle = '#fff';
    tc.beginPath(); tc.arc(ox, oy, r, 0, Math.PI*2); tc.fill();
    tc.globalCompositeOperation = 'destination-out';
    tc.beginPath(); tc.arc(ox + r*0.42, oy - r*0.05, r*0.82, 0, Math.PI*2); tc.fill();
    tc.globalCompositeOperation = 'source-in';
    const gg = tc.createLinearGradient(0, 0, sz, sz);
    gg.addColorStop(0, gL); gg.addColorStop(0.5, goldMain); gg.addColorStop(1, gD);
    tc.fillStyle = gg; tc.fillRect(0, 0, sz, sz);
    ctx.drawImage(tmp, cx - ox, cy - oy);
  }catch(e){
    // Fallback: düz dolgu
    ctx.fillStyle = goldMain;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx + r*0.42, cy - r*0.05, r*0.82, 0, Math.PI*2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Hilal iç kenar parlaması ──
  ctx.strokeStyle = gL; ctx.lineWidth = Math.max(1, r*0.06); ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath(); ctx.arc(cx, cy, r-1, -0.7, 1.0); ctx.stroke();
  ctx.globalAlpha = alpha;

  // ── Yıldız (kabartmalı, gölge + gradyan + parlama) ──
  const sx = cx + r*0.66, sy = cy, R = r*0.5;
  // gölge
  ctx.save(); ctx.translate(1.2, 1.8); ctx.globalAlpha = alpha*0.4;
  ctx.fillStyle = '#000'; _star5path(ctx, sx, sy, R); ctx.fill();
  ctx.restore();
  // gövde
  const sg = ctx.createRadialGradient(sx - R*0.3, sy - R*0.3, R*0.1, sx, sy, R);
  sg.addColorStop(0, gL); sg.addColorStop(0.5, goldMain); sg.addColorStop(1, gD);
  ctx.fillStyle = sg; _star5path(ctx, sx, sy, R); ctx.fill();
  ctx.strokeStyle = gL; ctx.lineWidth = Math.max(0.8, R*0.08); _star5path(ctx, sx, sy, R); ctx.stroke();

  ctx.restore();
}
function _star5path(ctx, cx, cy, R){
  ctx.beginPath();
  for(let i=0;i<5;i++){
    const a = -Math.PI/2 + i*2*Math.PI/5;
    const a2 = a + Math.PI/5;
    ctx.lineTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R);
    ctx.lineTo(cx + Math.cos(a2)*R*0.42, cy + Math.sin(a2)*R*0.42);
  }
  ctx.closePath();
}

// Tek bir tema sembolü çiz
function drawMotifSymbol(ctx, cx, cy, r, motif, t){
  ctx.save();
  if(motif === 'diamond'){
    ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r*0.72, cy); ctx.lineTo(cx, cy+r); ctx.lineTo(cx-r*0.72, cy); ctx.closePath(); ctx.fill();
  } else if(motif === 'star8'){
    star(ctx, cx, cy, 8, r, r*0.45);
  } else if(motif === 'crescent'){
    // hilal + küçük yıldız
    ctx.beginPath(); ctx.arc(cx, cy, r*0.92, Math.PI*0.32, Math.PI*1.68); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx + r*0.34, cy, r*0.74, 0, Math.PI*2); ctx.fill(); ctx.restore();
    star(ctx, cx + r*0.5, cy, 5, r*0.34, r*0.15);
  } else if(motif === 'flower'){
    // 6 yapraklı çiçek (İznik)
    for(let i=0;i<6;i++){
      const a = (Math.PI/3)*i;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a)*r*0.5, cy + Math.sin(a)*r*0.5, r*0.34, r*0.18, a, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r*0.26, 0, Math.PI*2); ctx.fill();
  } else if(motif === 'seljuk'){
    // Selçuklu yıldızı: iki çakışık kare
    ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r, cy); ctx.lineTo(cx, cy+r); ctx.lineTo(cx-r, cy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.rect(cx-r*0.62, cy-r*0.62, r*1.24, r*1.24); ctx.fill();
  } else if(motif === 'snow'){
    // kar tanesi: 6 kol
    ctx.lineWidth = Math.max(1, r*0.16); ctx.lineCap = 'round';
    for(let i=0;i<6;i++){
      const a = (Math.PI/3)*i;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); ctx.stroke();
      // küçük çapraz dallar
      const mx = cx+Math.cos(a)*r*0.6, my = cy+Math.sin(a)*r*0.6;
      ctx.beginPath();
      ctx.moveTo(mx, my); ctx.lineTo(mx+Math.cos(a+0.6)*r*0.28, my+Math.sin(a+0.6)*r*0.28);
      ctx.moveTo(mx, my); ctx.lineTo(mx+Math.cos(a-0.6)*r*0.28, my+Math.sin(a-0.6)*r*0.28);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBearOff(ctx, t){
  const g = G.geo;
  const wOff = G.state.off.w, bOff = G.state.off.b;
  const topColor = G.flip ? 'w' : 'b';
  const botColor = G.flip ? 'b' : 'w';
  const topVal = G.flip ? wOff : bOff;
  const botVal = G.flip ? bOff : wOff;
  const cx = g.bearX + g.bearW/2;
  const R = g.checkerR * 0.82; // biraz küçük
  const maxShow = 15; // max gösterilecek pul
  // ── Arka plan ──
  ctx.save();
  // üst bölge (topColor)
  const rTop = 6;
  const topH = g.innerH/2 - 4;
  _roundRect(ctx, g.bearX+2, g.innerY+2, g.bearW-4, topH, rTop);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fill();
  // alt bölge (botColor)
  _roundRect(ctx, g.bearX+2, g.innerY+g.innerH/2+2, g.bearW-4, topH, rTop);
  ctx.fill();

  // ── Üst pul stack'i (topColor, aşağıdan yukarı istiflenir) ──
  _drawBearStack(ctx, cx, g.innerY+2+topH, -1, topVal, R, topColor, t);
  // ── Alt pul stack'i (botColor, yukarıdan aşağı istiflenir) ──
  _drawBearStack(ctx, cx, g.innerY+g.innerH/2+2, 1, botVal, R, botColor, t);

  // ── Eğer toplanan yok: soluk ikon ──
  ctx.font = `bold ${Math.floor(g.bearW*0.26)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,.18)';
  if(topVal === 0) ctx.fillText('off', cx, g.innerY + g.innerH*0.25);
  if(botVal === 0) ctx.fillText('off', cx, g.innerY + g.innerH*0.75);

  ctx.restore();
}

function _drawBearStack(ctx, cx, baseY, dir, count, R, color, t){
  if(count === 0) return;
  const maxShow = 15;
  const show = Math.min(count, maxShow);
  const areaH = G.geo.innerH/2 - 4;
  // Pul gap: alanı dolduracak şekilde hesapla
  const totalR = R * 2;
  const minGap = R * 0.25; // minimum görünür katman kalınlığı
  const maxGap = R * 1.75;
  const gap = show === 1 ? 0 : Math.min(maxGap, Math.max(minGap, (areaH - totalR) / (show - 1)));
  const isW = color === 'w';

  // Toplama animasyonu (G._bearAnim): son toplanan pulun animasyonu
  const anim = G._bearAnim && G._bearAnim.color === color ? G._bearAnim : null;

  for(let k = 0; k < show; k++){
    const cy = baseY + dir * (R + k * gap);
    // Son pul → animasyon uygula (sürükleme/giriş)
    if(anim && k === show - 1){
      const p = Math.min(1, anim.p);
      // easeOutBounce
      const eased = easeOutBounce(p);
      const startY = baseY + dir * (R + k * gap + R * 4 * (1 - eased));
      ctx.save();
      ctx.globalAlpha = 0.4 + 0.6 * p;
      drawChecker(ctx, cx, startY + (cy - startY) * eased, R, color, t);
      ctx.restore();
    } else {
      drawChecker(ctx, cx, cy, R, color, t);
    }
  }
  // 15'ten fazlaysa sayı etiketi (üstüne yaz)
  if(count > maxShow){
    const topCy = baseY + dir * (R + (show-1)*gap);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(cx, topCy, R*0.55, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = isW ? '#1a2a4a' : '#fff';
    ctx.font = `bold ${Math.floor(R*0.65)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(count, cx, topCy);
    ctx.restore();
  }
  // Toplam sayı rozeti (köşe)
  if(count > 0){
    const rozetY = baseY + dir * R * 0.05;
    ctx.save();
    ctx.fillStyle = isW ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.85)';
    ctx.strokeStyle = isW ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.25)'; ctx.lineWidth = 1;
    _roundRect(ctx, cx - R*0.7, rozetY - R*0.4, R*1.4, R*0.78, R*0.2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isW ? '#2a3a5a' : '#eef2ff';
    ctx.font = `900 ${Math.floor(R*0.55)}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕'+count, cx, rozetY - R*0.01);
    ctx.restore();
  }
}

// ── 🎲 Pul toplama (bear-off) giriş animasyonu ──────────────────
function startBearAnim(color){
  // Önceki aynı renk animasyonunu iptal et
  if(G._bearAnimRaf){ cancelAnimationFrame(G._bearAnimRaf); G._bearAnimRaf=null; }
  const startTime = performance.now();
  const dur = 420; // ms
  G._bearAnim = { color, p:0 };
  function step(now){
    if(!G || !G._bearAnim){ return; }
    const elapsed = now - startTime;
    G._bearAnim.p = Math.min(1, elapsed / dur);
    draw();
    if(G._bearAnim.p < 1){
      G._bearAnimRaf = requestAnimationFrame(step);
    } else {
      G._bearAnim = null; G._bearAnimRaf = null;
      draw();
    }
  }
  G._bearAnimRaf = requestAnimationFrame(step);
}

function easeOutBounce(x){
  const n1 = 7.5625, d1 = 2.75;
  if(x < 1/d1) return n1*x*x;
  else if(x < 2/d1){ x -= 1.5/d1; return n1*x*x + 0.75; }
  else if(x < 2.5/d1){ x -= 2.25/d1; return n1*x*x + 0.9375; }
  else { x -= 2.625/d1; return n1*x*x + 0.984375; }
}

// Bir noktadaki pulları çiz — üstgenler üzerinde, güvenli boşlukla
function drawCheckers(ctx, t){
  const g = G.geo;
  const R = g.checkerR, safe = g.safe, maxVisible = 5;
  // dizilim aralığı: pullar üçgen içinde, kenarlardan güvenli boşlukta kalır
  function stackGap(vis){
    const span = g.pointH - 2*safe - 2*R;       // ilk ve son pul merkezi arası kullanılabilir alan
    return Math.min(R * 2.05, vis > 1 ? span / (vis - 1) : 0);
  }
  for(let i=0;i<24;i++){
    if(G.hideAt === i) continue;          // vuruş animasyonu: vurulan taş bar'a uçuyor
    const v = G.state.points[i];
    if(v === 0) continue;
    const color = v > 0 ? 'w' : 'b';
    const count = Math.abs(v);
    const pg = pointGeometry(i);
    const vis = Math.min(count, maxVisible);
    const gap = stackGap(vis);
    for(let k=0;k<vis;k++){
      // tabandan içe doğru: ilk pul merkezi kenardan (safe + R) içeride
      const cy = pg.y0 + pg.dir * (safe + R + k * gap);
      drawChecker(ctx, pg.baseX, cy, R, color, t);
    }
    // 5'ten fazlaysa son pulun üstüne sayı yaz
    if(count > maxVisible){
      const cy = pg.y0 + pg.dir * (safe + R + (vis-1) * gap);
      ctx.save();
      ctx.fillStyle = color === 'w' ? '#1a2a4a' : '#fff';
      ctx.font = `bold ${Math.floor(R*0.9)}px system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(count, pg.baseX, cy);
      ctx.restore();
    }
  }
}

function drawChecker(ctx, cx, cy, R, color, t){
  const isW = color === 'w';
  ctx.save();

  // ── Zemin gölgesi (yumuşak, taşı tahtaya oturtur) ──
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(cx, cy + R*0.22, R*0.96, R*0.82, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // ── Dış disk kenarı (metalik/koyu pah) ──
  const rim = ctx.createLinearGradient(cx, cy - R, cx, cy + R);
  if(isW){ rim.addColorStop(0, t.wEdge); rim.addColorStop(.5, t.wBot); rim.addColorStop(1, '#000'); }
  else   { rim.addColorStop(0, t.bEdge); rim.addColorStop(.5, t.bBot); rim.addColorStop(1, '#000'); }
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();

  // ── Ana gövde (yukarıdan ışık alan kubbe) ──
  const body = ctx.createRadialGradient(cx - R*0.32, cy - R*0.38, R*0.1, cx, cy, R*0.98);
  body.addColorStop(0, isW ? t.wTop : t.bTop);
  body.addColorStop(0.55, isW ? t.wBot : t.bBot);
  body.addColorStop(1, isW ? t.wEdge : t.bEdge);
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(cx, cy, R*0.92, 0, Math.PI*2); ctx.fill();

  // ── İç basamak halkası (oyma/torna hissi) ──
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = Math.max(1, R*0.05);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.74, 0, Math.PI*2); ctx.stroke();
  ctx.strokeStyle = isW ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.14)';
  ctx.lineWidth = Math.max(1, R*0.04);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.70, 0, Math.PI*2); ctx.stroke();

  // ── Merkez oyuk (içe basık daire, hafif gölge + parlama) ──
  const inner = ctx.createRadialGradient(cx - R*0.15, cy - R*0.18, R*0.05, cx, cy, R*0.55);
  inner.addColorStop(0, isW ? t.wBot : t.bBot);
  inner.addColorStop(1, isW ? t.wTop : t.bTop);
  ctx.fillStyle = inner;
  ctx.beginPath(); ctx.arc(cx, cy, R*0.52, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(1, R*0.03);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.52, 0, Math.PI*2); ctx.stroke();

  // ── Üst parlama (specular highlight, sol-üst) ──
  const hl = ctx.createRadialGradient(cx - R*0.30, cy - R*0.34, R*0.02, cx - R*0.30, cy - R*0.34, R*0.55);
  hl.addColorStop(0, 'rgba(255,255,255,'+(isW?0.55:0.30)+')');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath(); ctx.arc(cx, cy, R*0.92, 0, Math.PI*2); ctx.fill();

  // ── İnce dış çizgi (tanım) ──
  ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = Math.max(1, R*0.045);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.97, 0, Math.PI*2); ctx.stroke();

  ctx.restore();
}

// Vurulan (kırılan) pullar — YALNIZCA orta bar üzerinde gösterilir
function drawBarCheckers(ctx, t){
  const g = G.geo;
  const cx = g.barX + g.barW / 2;     // tam bar ortası
  const R = g.checkerR, safe = g.safe;
  const gap = R * 2.05;
  const wBar = G.state.bar.w, bBar = G.state.bar.b;
  // beyaz: bir yarıda, siyah: diğer yarıda (flip'e göre yer değişir)
  const whiteTop = G.flip;            // flip=true → beyaz üstte
  for(let k=0;k<wBar;k++){
    const cy = whiteTop ? (g.innerY + safe + R + k*gap) : (g.innerY + g.innerH - safe - R - k*gap);
    drawChecker(ctx, cx, cy, R, 'w', t);
  }
  for(let k=0;k<bBar;k++){
    const cy = whiteTop ? (g.innerY + g.innerH - safe - R - k*gap) : (g.innerY + safe + R + k*gap);
    drawChecker(ctx, cx, cy, R, 'b', t);
  }
}

function drawDice(ctx, t){
  if(!G.state.dice || G.state.dice.length === 0) return;
  const g = G.geo;
  const dice = G.diceAnim || G.state.dice;   // animasyon sırasında rastgele yüzler
  const n = dice.length;
  // Zarın boyutu: bir tahta yarısına RAHAT sığacak şekilde sınırlı (taşma yok)
  const sz = Math.min(g.barW * 1.0, g.innerH * 0.085, g.halfW * 0.30);
  const spacing = sz * 1.28;
  // Zarları oyuncunun kendi yarısının ortasına yerleştir
  const halfCx = G.flip ? (g.leftX + g.halfW * 0.5) : (g.rightX + g.halfW * 0.5);
  const cy = g.innerY + g.innerH / 2;

  if(n <= 2){
    // tek sıra, yatay
    dice.forEach((d, i) => {
      const used = G.diceAnim ? false : G.state.used.includes(i);
      const dx = halfCx + (i - (n - 1) / 2) * spacing;
      drawDie(ctx, dx, cy, sz, d, used);
    });
  } else {
    // çift zar (4 adet) → 2x2 ızgara (taşmaz)
    dice.forEach((d, i) => {
      const used = G.diceAnim ? false : G.state.used.includes(i);
      const col = i % 2, row = Math.floor(i / 2);
      const dx = halfCx + (col - 0.5) * spacing;
      const dyy = cy + (row - 0.5) * spacing;
      drawDie(ctx, dx, dyy, sz, d, used);
    });
  }
}

function drawDie(ctx, cx, cy, sz, val, used){
  ctx.save();
  const x = cx - sz/2, y = cy - sz/2;
  const rad = sz*0.20;
  // 1) Yere düşen gölge
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = sz*0.22; ctx.shadowOffsetX = sz*0.05; ctx.shadowOffsetY = sz*0.10;
  _roundRect(ctx, x, y, sz, sz, rad);
  ctx.fillStyle = used ? '#9a9a92' : '#f5f1e8'; ctx.fill();
  ctx.restore();
  // 2) Gövde — köşegen gradient
  const grad = ctx.createLinearGradient(x, y, x+sz, y+sz);
  if(used){ grad.addColorStop(0,'#b8b8ae'); grad.addColorStop(0.5,'#9a9a90'); grad.addColorStop(1,'#7e7e74'); }
  else { grad.addColorStop(0,'#fffefb'); grad.addColorStop(0.45,'#f3eee2'); grad.addColorStop(1,'#ddd5c4'); }
  _roundRect(ctx, x, y, sz, sz, rad); ctx.fillStyle = grad; ctx.fill();
  // 3) Üst parlama
  ctx.save();
  _roundRect(ctx, x, y, sz, sz, rad); ctx.clip();
  const hl = ctx.createLinearGradient(x, y, x, y+sz*0.55);
  hl.addColorStop(0,'rgba(255,255,255,.55)'); hl.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(x, y, sz, sz*0.55);
  ctx.restore();
  // 4) İnce kenar
  _roundRect(ctx, x+0.5, y+0.5, sz-1, sz-1, rad);
  ctx.strokeStyle = used ? 'rgba(0,0,0,.25)' : 'rgba(150,130,90,.45)';
  ctx.lineWidth = Math.max(1, sz*0.012); ctx.stroke();
  // 5) Kabartma noktalar
  const r = sz*0.085, C=0.5, L=0.27, R=0.73;
  const dot = (fx, fy) => {
    const px = x + sz*fx, py = y + sz*fy;
    ctx.beginPath(); ctx.arc(px+r*0.18, py+r*0.18, r, 0, Math.PI*2);
    ctx.fillStyle = used ? 'rgba(40,40,40,.5)' : 'rgba(20,15,5,.35)'; ctx.fill();
    const dg = ctx.createRadialGradient(px-r*0.3, py-r*0.3, r*0.1, px, py, r);
    if(used){ dg.addColorStop(0,'#444'); dg.addColorStop(1,'#222'); }
    else { dg.addColorStop(0,'#3a2a18'); dg.addColorStop(0.7,'#1a120a'); dg.addColorStop(1,'#0a0704'); }
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fillStyle = dg; ctx.fill();
    ctx.beginPath(); ctx.arc(px-r*0.35, py-r*0.35, r*0.28, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill();
  };
  if(val===1){ dot(C,C); }
  else if(val===2){ dot(L,L); dot(R,R); }
  else if(val===3){ dot(L,L); dot(C,C); dot(R,R); }
  else if(val===4){ dot(L,L); dot(R,L); dot(L,R); dot(R,R); }
  else if(val===5){ dot(L,L); dot(R,L); dot(C,C); dot(L,R); dot(R,R); }
  else if(val===6){ dot(L,L); dot(R,L); dot(L,C); dot(R,C); dot(L,R); dot(R,R); }
  ctx.restore();
}


// ════════════ KOMBİNE HAMLE (toplam pip) ════════════
function getCombinedMoves(state, from){
  const single = legalMovesFrom(state, from);
  if(!single.length) return single;
  const rem = remainingDice(state);
  if(rem.length < 2) return single;
  const combos = [];
  for(let i=0;i<rem.length;i++){
    for(let j=0;j<rem.length;j++){
      if(i===j) continue;
      combos.push([rem[i], rem[j]]);
    }
  }
  const result = [...single];
  const seenTo = new Set(single.map(m => String(m.to)));
  for(const [d1, d2] of combos){
    const step1 = single.find(m => m.die === d1.die && m.to !== 'off');
    if(!step1 || typeof step1.to !== 'number') continue;
    let midState;
    try{ midState = applyMove(state, step1); }catch(e){ continue; }
    const step2List = legalMovesFrom(midState, step1.to);
    const step2 = step2List.find(m => m.die === d2.die);
    if(!step2) continue;
    if(seenTo.has(String(step2.to))) continue;
    seenTo.add(String(step2.to));
    result.push({ from, to: step2.to, die: d1.die, dieIdx: d1.idx, _combo:[step1, step2], type: step2.type||step1.type });
  }
  return result;
}

// Seçili nokta + geçerli hedefleri vurgula
function highlightSelection(ctx, t){
  const g = G.geo;
  // kaynak
  if(G.selected === 'bar'){
    const cx = g.barX + g.barW/2;
    ctx.save(); ctx.strokeStyle = t.glow; ctx.lineWidth = 3;
    ctx.strokeRect(g.barX+2, g.innerY+2, g.barW-4, g.innerH-4); ctx.restore();
  } else {
    drawPointHighlight(ctx, G.selected, t.glow, 0.3);
  }
  // hedefler
  for(const m of G.legalForSel){
    if(m.to === 'off'){
      ctx.save(); ctx.strokeStyle = t.glow; ctx.lineWidth = 3;
      ctx.strokeRect(g.bearX+2, g.innerY+2, g.bearW-4, g.innerH-4); ctx.restore();
    } else {
      drawPointHighlight(ctx, m.to, t.glow, 0.45);
      // hedef üçgene nokta işareti
      const pg = pointGeometry(m.to);
      ctx.save(); ctx.fillStyle = t.glow;
      ctx.beginPath(); ctx.arc(pg.baseX, pg.y0 + pg.dir*g.pointH*0.5, g.colW*0.14, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }
}

function drawPointHighlight(ctx, idx, color, alpha){
  const pg = pointGeometry(idx);
  const g = G.geo;
  const half = pg.colW * 0.5;
  const tipY = pg.y0 + pg.dir * g.pointH;
  ctx.save();
  ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pg.baseX - half*0.86, pg.y0);
  ctx.lineTo(pg.baseX + half*0.86, pg.y0);
  ctx.lineTo(pg.baseX, tipY);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ════════════ TIKLAMA / SÜRÜKLEME / HAMLE ════════════
function getPos(e){
  const rect = G.canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function canInteract(){
  if(!G || G.gameEnded || !G.rolled || G.aiThinking) return false;
  if(G.mode === 'ai' && G.state.turn === G.aiColor) return false;
  if(G.online && G.state.turn !== G.playerColor) return false;
  if(turnComplete(G.state)) return false;
  return true;
}
function isMyPoint(idx){
  const c = G.state.turn;
  const v = G.state.points[idx];
  return (c === 'w' && v > 0) || (c === 'b' && v < 0);
}

function onPointerDown(e){
  // PAS mini butonuna basıldı mı? (zarların altında, hamle yokken)
  if(G && G._passBox && G.rolled && G.canPass && canPassNow()){
    const { x, y } = getPos(e);
    const b = G._passBox;
    if(x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h){
      e.preventDefault();
      if(G._autoPassTimer){ clearTimeout(G._autoPassTimer); G._autoPassTimer = null; }
      G._passBox = null;
      try{ Sound.move && Sound.move(); }catch(_){}
      endTurn();
      return;
    }
  }
  // Zar atılmadıysa belirtece/boşa basınca zar at
  if(G && !G.rolled && !G.gameEnded && !G.aiThinking){
    const canRoll = !(G.mode==='ai' && G.state.turn===G.aiColor) && !(G.online && G.state.turn!==G.playerColor);
    if(canRoll){ e.preventDefault(); rollAndShow(); return; }
  }
  if(!canInteract()) return;
  e.preventDefault();
  const { x, y } = getPos(e);
  const hit = hitTest(x, y);
  G.pointerDownPos = { x, y };
  G.dragMoved = false;
  G.tapTarget = null;
  G.dragging = false;
  G.dragFrom = null;

  const color = G.state.turn;

  // 1) Seçili kaynak varsa ve buraya basıldıysa = hedef → tap'te uygula
  if(G.selected !== null){
    const mv = G.legalForSel.find(m => (m.to === hit) || (hit === 'off' && m.to === 'off'));
    if(mv){ G.tapTarget = mv; return; }   // up'ta doMove
  }

  // 2) Bar zorunlu
  let from = null;
  if(G.state.bar[color] > 0){ from = 'bar'; }
  else if(typeof hit === 'number' && isMyPoint(hit)){ from = hit; }

  if(from !== null){
    const lm = getCombinedMoves(G.state, from);
    if(lm.length > 0){
      G.selected = from; G.legalForSel = lm;
      G.dragging = true; G.dragFrom = from; G.dragPos = { x, y };
      try{ Sound.select(); }catch(err){}
      draw();
      return;
    }
  }
  // boşa basıldı → seçimi kaldır
  G.selected = null; G.legalForSel = []; draw();
}

function onPointerMove(e){
  if(!G || !G.dragging) return;
  e.preventDefault();
  const { x, y } = getPos(e);
  if(G.pointerDownPos){
    const dx = x - G.pointerDownPos.x, dy = y - G.pointerDownPos.y;
    if(Math.hypot(dx, dy) > 6) G.dragMoved = true;
  }
  G.dragPos = { x, y };
  draw();
}

function onPointerUp(e){
  if(!G){ return; }
  if(!canInteract()){ G.dragging = false; G.dragPos = null; return; }
  const { x, y } = getPos(e);
  const hit = hitTest(x, y);

  // Sürükle-bırak (gerçek hareket)
  if(G.dragging && G.dragMoved){
    G.dragging = false; G.dragPos = null;
    const mv = G.legalForSel.find(m => (m.to === hit) || (hit === 'off' && m.to === 'off'));
    if(mv){ doMove(mv); return; }
    draw();   // geçersiz bırakma → seçim kalır
    return;
  }
  G.dragging = false; G.dragPos = null;

  // Tap ile hedefe basıldıysa (down'da işaretlendi)
  if(G.tapTarget){ const mv = G.tapTarget; G.tapTarget = null; doMove(mv); return; }

  // Tap ile kaynağa basıldıysa: seçim down'da yapıldı, dokunma
}

function onBoardClick(e){ /* artık pointer event'leri kullanılıyor */ }

// Piksel → nokta indeksi / 'bar' / 'off' / null
function hitTest(px, py){
  const g = G.geo;
  // bear-off oluğu
  if(px >= g.bearX && px <= g.bearX + g.bearW) return 'off';
  // bar
  if(px >= g.barX && px <= g.barX + g.barW) return 'bar';
  // hangi nokta: her üçgenin x aralığına bak
  for(let i=0;i<24;i++){
    const pg = pointGeometry(i);
    const half = pg.colW * 0.5;
    if(px >= pg.baseX - half && px <= pg.baseX + half){
      // üst mü alt mı kontrolü
      const onTop = py < g.innerY + g.innerH/2;
      if(pg.top === onTop) return i;
    }
  }
  return null;
}

function doMove(mv){
  if(G.moveGraceActive) clearMoveGrace();
  if(!G.online){ G.undoStack.push({ state: G.state, selected: null }); }
  // KOMBİNE: iki zarı ardışık oyna (toplam pip)
  if(mv._combo && Array.isArray(mv._combo)){
    for(const step of mv._combo){
      if(G.online){ TavlaMP.send({ type:'move', from: step.from, to: step.to, die: step.die, dieIdx: step.dieIdx }); }
      G.state = applyMove(G.state, step);
      try{ step.type === 'hit' ? Sound.hit() : Sound.move(); }catch(e){}
    }
    G.selected = null; G.legalForSel = [];
    const st0 = gameStatus(G.state);
    if(st0 !== 'playing'){ onWin(st0); return; }
    if(turnComplete(G.state)){
      updateStatus('Sıra tamamlandı — ' + (G.state.turn==='w'?'beyaz':'siyah') + ' bitti');
      setTimeout(() => endTurn(), 600);
    } else {
      const rem0 = remainingDice(G.state).map(r=>r.die).join(', ');
      updateStatus(`Kalan zar: ${rem0} — devam et`);
    }
    updateControls(); draw();
    return;
  }
  if(G.online){ TavlaMP.send({ type:'move', from: mv.from, to: mv.to, die: mv.die, dieIdx: mv.dieIdx }); }
  G.state = applyMove(G.state, mv);
  G.selected = null; G.legalForSel = [];
  try{ mv.type === 'hit' ? Sound.hit() : (mv.to === 'off' ? (Sound.bearoff(G.state.off.w+G.state.off.b), startBearAnim(mv.color||(G.state.turn==='w'?'b':'w'))) : Sound.move()); }catch(e){}

  const status = gameStatus(G.state);
  if(status !== 'playing'){
    onWin(status);
    return;
  }
  // sıra bitti mi
  if(turnComplete(G.state)){
    updateStatus('Sıra tamamlandı — ' + (G.state.turn==='w'?'beyaz':'siyah') + ' bitti');
    setTimeout(() => endTurn(), 600);
  } else {
    const rem = remainingDice(G.state).map(r=>r.die).join(', ');
    updateStatus(`Kalan zar: ${rem} — devam et`);
  }
  updateControls();
  draw();
  if(G.mode === 'ai'){ saveAIGame(); }
}

function endTurn(){
  if(G.gameEnded) return;
  if(G._autoPassTimer){ clearTimeout(G._autoPassTimer); G._autoPassTimer = null; }
  if(G._passRAF){ cancelAnimationFrame(G._passRAF); G._passRAF = null; }
  G._passBox = null;
  if(G.online){ TavlaMP.send({ type:'endturn' }); }
  // sırayı değiştir, zarları temizle
  G.state.turn = G.state.turn === 'w' ? 'b' : 'w';
  G.state.dice = []; G.state.used = [];
  G.rolled = false; G.canPass = false;
  G.selected = null; G.legalForSel = []; G.undoStack = [];
  if(G.mode === 'local'){ G.flip = (G.state.turn === 'b'); }
  updateTurn();
  if(G.online){
    const mine = (G.state.turn === G.playerColor);
    updateStatus(mine ? 'Senin sıran — zar at' : 'Rakip oynuyor…');
  } else {
    updateStatus((G.state.turn==='w'?'Beyaz':'Siyah') + ' — zar at');
  }
  updateControls();
  draw();
  if(!G.online){ maybeAITurn(); }
  startAutoRollTimer();
  if(G.mode === 'ai'){ saveAIGame(); }
}

// ════════════ OTOMATİK ZAR ════════════
function clearAutoRollTimer(){
  if(G && G.autoRollTimer){ clearTimeout(G.autoRollTimer); G.autoRollTimer = null; }
  if(G && G.autoRollCountdown){ clearInterval(G.autoRollCountdown); G.autoRollCountdown = null; }
  // Sayaç mesajı asılı kaldıysa temizle
  if(G && !G.rolled && !G.gameEnded){
    const st = G.root && G.root.querySelector('[data-el="status"]');
    if(st && st.textContent.includes('otomatik zar')){
      updateStatus((G.state.turn==='w'?'Beyaz':'Siyah') + ' — zar at');
    }
  }
}
function startAutoRollTimer(){
  if(!G) return;
  clearAutoRollTimer();
  if(!AUTO_ROLL || G.gameEnded || G.rolled || G.aiThinking || G.paused) return;
  // AI sırasında gerekmez (AI kendi atar); online'da yalnızca kendi sıramda
  if(G.mode === 'ai' && G.state.turn === G.aiColor) return;
  if(G.online && G.state.turn !== G.playerColor) return;
  let left = Math.ceil(AUTO_ROLL_MS / 1000);
  // küçük geri sayım göstergesi
  G.autoRollCountdown = setInterval(() => {
    if(!G || G.rolled || G.gameEnded){ clearAutoRollTimer(); return; }
    left--;
    if(left > 0){ updateStatus(`⏱️ ${left} sn içinde otomatik zar atılacak…`); }
  }, 1000);
  G.autoRollTimer = setTimeout(() => {
    clearAutoRollTimer();
    if(G && !G.rolled && !G.gameEnded && !G.paused) rollAndShow();
  }, AUTO_ROLL_MS);
}

// ════════════ YAPAY ZEKÂ SIRASI ════════════
function maybeAITurn(){
  if(!G || G.mode !== 'ai' || G.gameEnded) return;
  if(G.state.turn !== G.aiColor) return;
  G.aiThinking = true;
  updateControls();
  updateStatus('🤖 Yapay zekâ düşünüyor…', 'thinking');
  setTimeout(() => {
    if(!G || G.gameEnded) return;
    G.state.dice = rollDice();
    G.state.used = [];
    G.rolled = true;
    const dd = G.state.dice;
    const diceStr = dd.length === 4 ? `${dd[0]}-${dd[0]} (çift!)` : `${dd[0]}-${dd[1]}`;
    animateDiceRoll(() => {
      updateStatus(`🤖 YZ zarı: ${diceStr}`, 'thinking');
      draw();
      const seq = chooseSequence(G.state, G.difficulty);
      if(!seq || seq.length === 0){
        setTimeout(() => { G.aiThinking = false; endTurn(); }, 700);
        return;
      }
      playAISequence(seq, 0);
    });
  }, 500);
}

function playAISequence(seq, i){
  if(!G || G.gameEnded) return;
  if(i >= seq.length){
    G.aiThinking = false;
    const status = gameStatus(G.state);
    if(status !== 'playing'){ onWin(status); return; }
    setTimeout(() => endTurn(), 500);
    return;
  }
  const mv = seq[i];
  animateMove(mv, () => {
    G.state = applyMove(G.state, mv);
    try{ mv.type === 'hit' ? Sound.hit() : (mv.to === 'off' ? (Sound.bearoff(G.state.off.w+G.state.off.b), startBearAnim(mv.color||(G.state.turn==='w'?'b':'w'))) : Sound.move()); }catch(e){}
    draw();
    const status = gameStatus(G.state);
    if(status !== 'playing'){ G.aiThinking = false; onWin(status); return; }
    setTimeout(() => playAISequence(seq, i + 1), 350);
  });
}

// ════════════ ÇEVRİMİÇİ MESAJ ════════════
// ── Reconnect sonrası tam state senkronizasyonu ──
function sendFullSync(){
  if(!G || !G.online || !TavlaMP || !TavlaMP.connected) return;
  try{
    TavlaMP.send({
      type: 'fullsync',
      state: {
        gameState: G.state,           // points, bar, off, turn, dice, used
        rolled: !!G.rolled,
        openingDice: G.openingDice || null,
        gameEnded: !!G.gameEnded,
      }
    });
  }catch(e){ console.warn('[tavla] sendFullSync', e); }
}

function applyFullSync(s){
  if(!G || !s) return;
  try{
    if(s.gameState){ G.state = s.gameState; }
    G.rolled = !!s.rolled;
    if(s.openingDice) G.openingDice = s.openingDice;
    G.selected = null; G.legalForSel = []; G.undoStack = [];
    G.flip = (G.online && G.playerColor === 'b');
    updateTurn();
    updateControls();
    draw();
  }catch(e){ console.warn('[tavla] applyFullSync', e); }
}

function sendHello(){
  try{
    import('../auth.js').then(m => {
      const st = m.Auth.getState();
      TavlaMP.send({ type:'hello', uid: st.uid || null, name: getPortalNick(st) });
    });
  }catch(e){}
}
function onHello(d){
  if(!G) return;
  G.oppUid = d.uid || null;
  G.oppRealName = d.name || null;
  const el = G.root && G.root.querySelector('[data-el="status"]');
  if(el && G.oppUid && !G.root.querySelector('[data-opc]')){
    const tag = document.createElement('span');
    tag.dataset.opc = G.oppUid;
    tag.style.cssText = 'margin-left:8px;cursor:pointer;text-decoration:underline dotted;font-weight:800;color:#90CAF9';
    tag.textContent = '👤 ' + (d.name || 'Rakip');
    el.parentNode.insertBefore(tag, el.nextSibling);
  }
  if(!G._helloSent){ G._helloSent = true; sendHello(); }
}
function onRemoteMessage(type, data){
  if(!G) return;
  if(type === 'disconnected'){
    // Oyunu HEMEN bitirme — reconnect denenecek
    if(!G.gameEnded){ G.oppLeft = true; updateStatus('🔌 Rakip bağlantısı koptu — yeniden bağlanılıyor…'); updateControls(); }
    return;
  }
  if(type === 'reconnecting'){
    const tries = (data && data.tries) || 0, max = (data && data.max) || 6;
    updateStatus(`🔄 Yeniden bağlanılıyor… (${tries}/${max})`);
    return;
  }
  if(type === 'reconnected'){
    G.oppLeft = false;
    updateStatus('✅ Yeniden bağlanıldı!');
    // Host güncel state'i gönderir; misafir ister
    if(G.isHost){ setTimeout(sendFullSync, 400); }
    else { setTimeout(() => TavlaMP.send({ type:'resync_request' }), 400); }
    setTimeout(() => { if(!G.gameEnded) updateTurn(); }, 2000);
    return;
  }
  if(type === 'reconnect_failed'){
    if(!G.gameEnded){ G.oppLeft = true; G.gameEnded = true; updateStatus('❌ Rakip yeniden bağlanamadı', 'win'); updateControls(); }
    return;
  }
  if(type !== 'message') return;
  const msg = data;
  if(!msg || !msg.type) return;

  // Reconnect senkron mesajları
  if(msg.type === 'resync_request'){ sendFullSync(); return; }
  if(msg.type === 'fullsync'){ applyFullSync(msg.state); return; }

  if(msg.type === 'start'){
    G.openingDice = msg.openingDice || [1,1];
    G.state.turn = msg.first || 'w';
    updateTurn();
    const mine = (G.state.turn === G.playerColor);
    updateStatus(`Açılış: B${G.openingDice[0]}–S${G.openingDice[1]} · ` + (mine ? 'sen başla, zar at' : 'rakip başlıyor'));
    updateControls(); draw();
  } else if(msg.type === 'dice'){
    if(G.moveGraceActive) clearMoveGrace();   // rakip mola sonrası oynadı
    G.state.dice = msg.dice || []; G.state.used = []; G.rolled = true;
    try{ Sound.dice(); }catch(e){}
    animateDiceRoll(() => {
      const dd = G.state.dice;
      updateStatus('Rakip zarı: ' + (dd.length===4?`${dd[0]}-${dd[0]} (çift)`:`${dd[0]}-${dd[1]}`));
      draw();
    });
  } else if(msg.type === 'move'){
    if(G.moveGraceActive) clearMoveGrace();   // rakip mola sonrası oynadı
    const mv = { from: msg.from, to: msg.to, die: msg.die, dieIdx: msg.dieIdx };
    let isHit = false;
    if(typeof mv.to === 'number'){
      const occ = G.state.points[mv.to]; const mover = G.state.turn;
      if((mover === 'w' && occ === -1) || (mover === 'b' && occ === 1)) isHit = true;
    }
    animateMove(mv, () => {
      G.state = applyMove(G.state, mv);
      try{ isHit ? Sound.hit() : (mv.to === 'off' ? (Sound.bearoff(G.state.off.w+G.state.off.b), startBearAnim(mv.color||(G.state.turn==='w'?'b':'w'))) : Sound.move()); }catch(e){}
      draw();
      const st = gameStatus(G.state);
      if(st !== 'playing'){ onWin(st); }
    });
  } else if(msg.type === 'endturn'){
    G.state.turn = G.state.turn === 'w' ? 'b' : 'w';
    G.state.dice = []; G.state.used = []; G.rolled = false; G.canPass = false;
    G.selected = null; G.legalForSel = [];
    updateTurn();
    const mine = (G.state.turn === G.playerColor);
    updateStatus(mine ? 'Senin sıran — zar at' : 'Rakip oynuyor…');
    updateControls(); draw();
    startAutoRollTimer();
  } else if(msg.type === 'chat'){
    addChatMessage((msg.text || '').slice(0, 120), false);
  } else if(msg.type === 'drawoffer'){
    showConfirm('🤝 Rakip beraberlik teklif etti. Kabul ediyor musun?', () => {
      if(TavlaMP && TavlaMP.connected) TavlaMP.send({ type:'drawaccept' });
      endInDraw();
    }, 'Kabul Et');
  } else if(msg.type === 'drawaccept'){
    endInDraw();
  } else if(msg.type === 'break_request'){
    onBreakRequestReceived();
  } else if(msg.type === 'break_accept'){
    startBreak('resting');          // teklifim kabul edildi → ben dinleniyorum
  } else if(msg.type === 'break_decline'){
    G.breakState = null; G.breakRequester = null; hideBreakOverlay();
    updateStatus('Mola reddedildi — oyun sürüyor'); startAutoRollTimer();
  } else if(msg.type === 'break_back'){
    endBreak();                     // rakip molasından döndü
  } else if(msg.type === 'break_extend'){
    startBreak('resting');          // süre uzatıldı → hâlâ dinleniyorum
  } else if(msg.type === 'break_resume'){
    resumeAfterBreak();             // rakip oyunu başlattı → 3 dk içinde oynamalıyım
  } else if(msg.type === 'forfeit'){
    G.gameEnded = true; clearAutoRollTimer(); clearMoveGrace();
    updateStatus('🏆 Rakip hükmen yenildi — KAZANDIN!', 'win');
    try{ Sound.win(); }catch(e){}
    updateControls();
    awardSimple(true, 'Rakip süre aşımından yenildi');
  } else if(msg.type === 'resign'){
    G.gameEnded = true; G.oppLeft = true; clearAutoRollTimer();
    updateStatus('🏆 Rakip pes etti — KAZANDIN!', 'win');
    awardSimple(true, 'Rakip pes etti');
    try{ Sound.win(); }catch(e){}
    updateControls();
  }
}

// ════════════ SOHBET ════════════
const TAVLA_QUICK_MSGS = ['İyi oyunlar! 👋', 'Aferin! 👏', 'Zarın iyi! 🎲', 'Hadi bakalım! 🔥', 'İyi şanslar! 🍀', 'Rövanş? 😎'];

function setupChat(){
  if(!G || !G.root) return;
  const chatBtn = G.root.querySelector('[data-el="chatBtn"]');
  if(chatBtn) chatBtn.style.display = 'flex';
  const breakBtn = G.root.querySelector('[data-el="breakBtn"]');
  if(breakBtn) breakBtn.style.display = 'inline-block';   // mola yalnızca çevrimiçi
  const panel = G.root.querySelector('[data-el="chatPanel"]');
  const quick = G.root.querySelector('[data-el="chatQuick"]');
  if(quick){
    quick.innerHTML = TAVLA_QUICK_MSGS.map(m => `<button class="tvc-q">${m}</button>`).join('');
    quick.querySelectorAll('.tvc-q').forEach((b, i) => b.addEventListener('click', () => sendChat(TAVLA_QUICK_MSGS[i])));
  }
  if(chatBtn) chatBtn.addEventListener('click', () => {
    G.chatOpen = true; if(panel) panel.style.display = 'flex';
    G.unreadChat = 0; updateChatBadge();
    const inp = G.root.querySelector('[data-el="chatInput"]');
    if(inp) setTimeout(() => inp.focus(), 50);
  });
  const closeBtn = G.root.querySelector('[data-act="chatClose"]');
  if(closeBtn) closeBtn.addEventListener('click', () => { G.chatOpen = false; if(panel) panel.style.display = 'none'; });
  const sendBtn = G.root.querySelector('[data-act="chatSend"]');
  const inp = G.root.querySelector('[data-el="chatInput"]');
  if(sendBtn && inp){
    sendBtn.addEventListener('click', () => { const t = inp.value.trim(); if(t){ sendChat(t); inp.value=''; } });
    inp.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ const t = e.target.value.trim(); if(t){ sendChat(t); e.target.value=''; } } });
  }
}

function sendChat(text){
  if(!G || !TavlaMP.connected) return;
  text = (text || '').slice(0, 120);
  TavlaMP.send({ type:'chat', text });
  addChatMessage(text, true);
}

function addChatMessage(text, mine){
  if(!G || !G.root) return;
  const box = G.root.querySelector('[data-el="chatMsgs"]');
  if(!box) return;
  const m = document.createElement('div');
  m.className = 'tvc-msg ' + (mine ? 'mine' : 'theirs');
  m.textContent = text;
  box.appendChild(m); box.scrollTop = box.scrollHeight;
  if(!mine && !G.chatOpen){ G.unreadChat = (G.unreadChat||0) + 1; updateChatBadge(); }
}

function updateChatBadge(){
  const badge = G.root.querySelector('[data-el="chatBadge"]');
  if(!badge) return;
  if(G.unreadChat > 0){ badge.style.display = 'flex'; badge.textContent = G.unreadChat; }
  else { badge.style.display = 'none'; }
}

function undoMove(){
  if(!G.undoStack || G.undoStack.length === 0) return;
  const snap = G.undoStack.pop();
  G.state = snap.state;
  G.selected = null; G.legalForSel = [];
  G.gameEnded = false;
  updateStatus('Hamle geri alındı');
  updateControls();
  draw();
}

// ════════════ BERABERLİK / PES ════════════
function showConfirm(msg, onYes, yesLabel, onNo, noLabel){
  if(!G || !G.root) return;
  const ov = document.createElement('div');
  ov.className = 'tavla-confirm';
  ov.innerHTML = `<div class="tvcf-box">
    <div class="tvcf-msg">${msg}</div>
    <div class="tvcf-row">
      <button class="tvcf-no">${noLabel || 'Vazgeç'}</button>
      <button class="tvcf-yes">${yesLabel || 'Evet'}</button>
    </div>
  </div>`;
  G.root.appendChild(ov);
  ov.querySelector('.tvcf-no').addEventListener('click', () => { ov.remove(); if(onNo) onNo(); });
  ov.querySelector('.tvcf-yes').addEventListener('click', () => { ov.remove(); if(onYes) onYes(); });
}

function offerDraw(){
  if(!G || G.gameEnded) return;
  if(G.mode === 'local'){
    showConfirm('Oyun berabere bitsin mi?', () => endInDraw(), 'Berabere');
  } else if(G.mode === 'ai'){
    // AI: pip farkı azsa kabul eder
    const myPip = pipCount(G.state, G.playerColor);
    const aiPip = pipCount(G.state, G.aiColor);
    if(Math.abs(myPip - aiPip) <= 8 && (myPip + aiPip) < 200){
      updateStatus('🤝 Yapay zekâ beraberliği kabul etti'); endInDraw();
    } else {
      updateStatus('🤖 Yapay zekâ beraberliği reddetti — oyun sürüyor');
    }
  } else if(G.online){
    if(!TavlaMP || !TavlaMP.connected) return;
    TavlaMP.send({ type:'drawoffer' });
    updateStatus('🤝 Beraberlik teklifi gönderildi — yanıt bekleniyor…');
  }
}

function resignGame(){
  if(!G || G.gameEnded) return;
  showConfirm('Pes etmek istediğine emin misin?', () => {
    if(G.online){
      if(TavlaMP && TavlaMP.connected) TavlaMP.send({ type:'resign' });
      G.gameEnded = true; clearAutoRollTimer();
      updateStatus('🏳️ Pes ettin — rakip kazandı', 'win');
      try{ Sound.lose(); }catch(e){}
      updateControls(); draw();
      awardSimple(false, 'Pes ettin');
    } else if(G.mode === 'ai'){
      G.gameEnded = true; clearAutoRollTimer();
      updateStatus('🏳️ Pes ettin — 🤖 yapay zekâ kazandı', 'win');
      try{ Sound.lose(); }catch(e){}
      updateControls(); draw();
      awardSimple(false, 'Pes ettin');
    } else {
      // local: sıradaki oyuncu pes eder, diğeri kazanır
      const winner = G.state.turn === 'w' ? 'SİYAH' : 'BEYAZ';
      G.gameEnded = true; clearAutoRollTimer();
      updateStatus(`🏳️ ${G.state.turn==='w'?'Beyaz':'Siyah'} pes etti — ${winner} kazandı`, 'win');
      try{ Sound.win(); }catch(e){}
      updateControls(); draw();
    }
  }, '🏳️ Pes Et');
}

function endInDraw(){
  G.gameEnded = true; clearAutoRollTimer();
  updateStatus('🤝 Oyun berabere bitti', 'win');
  G.selected = null; G.legalForSel = [];
  updateControls(); draw();
}

// ════════════ MOLA / DİNLENME SİSTEMİ (çevrimiçi) ════════════
const BREAK_MS = 5 * 60 * 1000;        // 5 dakika dinlenme
const MOVE_GRACE_MS = 3 * 60 * 1000;   // resume sonrası oynama süresi

function clearBreakTimers(){
  if(!G) return;
  if(G.breakTimer){ clearTimeout(G.breakTimer); G.breakTimer = null; }
  if(G.breakInterval){ clearInterval(G.breakInterval); G.breakInterval = null; }
}
function clearMoveGrace(){
  if(!G) return;
  if(G.moveGraceTimer){ clearTimeout(G.moveGraceTimer); G.moveGraceTimer = null; }
  if(G.moveGraceInterval){ clearInterval(G.moveGraceInterval); G.moveGraceInterval = null; }
  if(G.moveGraceActive){ G.moveGraceActive = false; updateStatus(''); }
}
function fmt(ms){ const s = Math.max(0, Math.ceil(ms/1000)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }

// 1) Mola iste
function requestBreak(){
  if(!G || !G.online || G.gameEnded || G.breakState) return;
  if(!TavlaMP || !TavlaMP.connected){ if(window.Hero) window.Hero.toast('Bağlantı yok', true); return; }
  clearAutoRollTimer();
  TavlaMP.send({ type:'break_request' });
  G.breakState = 'requesting'; G.breakRequester = 'me';
  showBreakOverlay('🛌 Mola talebi gönderildi', 'Rakibin yanıtı bekleniyor…', null);
}

// 2) Rakip mola istedi (break_request alındı)
function onBreakRequestReceived(){
  if(!G || G.gameEnded || G.breakState) return;
  G.breakRequester = 'them';
  clearAutoRollTimer();
  showConfirm('🛌 Rakip 5 dakika mola istiyor.<br>Kabul ediyor musun?',
    () => { TavlaMP.send({ type:'break_accept' }); startBreak('waiting'); },
    'Kabul Et',
    () => { TavlaMP.send({ type:'break_decline' }); G.breakRequester = null; G.breakState = null; updateStatus('Mola reddedildi — oyun sürüyor'); startAutoRollTimer(); },
    'Reddet'
  );
}

// 3) Molayı başlat. role: 'resting' (isteyen) | 'waiting' (bekleyen)
function startBreak(role){
  clearBreakTimers();
  G.breakState = role;
  G.breakEndsAt = Date.now() + BREAK_MS;
  renderBreakByRole();
  G.breakInterval = setInterval(() => renderBreakByRole(), 1000);
  if(role === 'waiting'){
    G.breakTimer = setTimeout(() => onBreakTimeout(), BREAK_MS);
  }
}

function renderBreakByRole(){
  if(!G || !G.breakState) return;
  const left = G.breakEndsAt - Date.now();
  if(G.breakState === 'resting'){
    if(left > 0){
      showBreakOverlay('🛌 Moladasın', 'Kalan süre: ' + fmt(left), 'back');
    } else {
      showBreakOverlay('⏳ Molan doldu', 'Rakip bekliyor / karar veriyor…', 'back');
    }
  } else if(G.breakState === 'waiting'){
    showBreakOverlay('⏸️ Rakip molada', 'Kalan süre: ' + fmt(left), null);
  }
}

// 4) Mola süresi doldu (yalnızca bekleyen tarafta tetiklenir)
function onBreakTimeout(){
  clearBreakTimers();
  G.breakState = 'decision';
  showBreakDecision();
}

// 5) Mola bitti (geri dönüş / iptal)
function endBreak(){
  clearBreakTimers();
  G.breakState = null; G.breakRequester = null;
  hideBreakOverlay();
  updateStatus('Mola bitti — oyun devam ediyor');
  updateControls(); draw();
  startAutoRollTimer();
}

// 6) Oyunu sürdür (mola sonrası) — mola isteyen 3dk içinde oynamalı
function resumeAfterBreak(){
  clearBreakTimers();
  G.breakState = null;
  hideBreakOverlay();
  updateStatus('Oyun devam ediyor — mola isteyen oynamalı');
  updateControls(); draw();
  startMoveGrace();
}

function startMoveGrace(){
  clearMoveGrace();
  G.moveGraceActive = true;
  G.moveGraceEndsAt = Date.now() + MOVE_GRACE_MS;
  const tick = () => {
    if(!G || !G.moveGraceActive) return;
    const left = G.moveGraceEndsAt - Date.now();
    if(left > 0){
      const who = (G.breakRequester === 'me') ? 'Sen' : 'Rakip';
      updateStatus(`⏳ ${who} ${fmt(left)} içinde oynamazsa hükmen yenik`);
    }
  };
  tick();
  G.moveGraceInterval = setInterval(tick, 1000);
  G.moveGraceTimer = setTimeout(() => forfeitByTimeout(), MOVE_GRACE_MS);
}

function forfeitByTimeout(){
  clearMoveGrace();
  if(!G || G.gameEnded) return;
  G.gameEnded = true; clearAutoRollTimer();
  if(G.breakRequester === 'me'){
    if(TavlaMP && TavlaMP.connected) TavlaMP.send({ type:'forfeit' });
    updateStatus('⏳ Süre doldu — hükmen yenildin', 'win');
    try{ Sound.lose(); }catch(e){}
  } else {
    updateStatus('🏆 Rakip süresinde oynamadı — hükmen kazandın!', 'win');
    try{ Sound.win(); }catch(e){}
  }
  updateControls(); draw();
}

// ── Mola UI ──
function showBreakOverlay(title, sub, button){
  if(!G || !G.root) return;
  let ov = G.root.querySelector('[data-el="breakOverlay"]');
  if(!ov){
    ov = document.createElement('div');
    ov.className = 'tavla-break'; ov.setAttribute('data-el','breakOverlay');
    G.root.appendChild(ov);
  }
  let btnHTML = '';
  if(button === 'back') btnHTML = `<button class="tvbk-btn" data-act="breakBack">↩️ Geri Döndüm</button>`;
  ov.innerHTML = `<div class="tvbk-box">
    <div class="tvbk-icon">🛌</div>
    <div class="tvbk-title">${title}</div>
    <div class="tvbk-sub">${sub}</div>
    ${btnHTML}
  </div>`;
  const bb = ov.querySelector('[data-act="breakBack"]');
  if(bb) bb.addEventListener('click', () => { TavlaMP.send({ type:'break_back' }); endBreak(); });
}
function showBreakDecision(){
  if(!G || !G.root) return;
  let ov = G.root.querySelector('[data-el="breakOverlay"]');
  if(!ov){ ov = document.createElement('div'); ov.className = 'tavla-break'; ov.setAttribute('data-el','breakOverlay'); G.root.appendChild(ov); }
  ov.innerHTML = `<div class="tvbk-box">
    <div class="tvbk-icon">⏳</div>
    <div class="tvbk-title">Süre doldu</div>
    <div class="tvbk-sub">Rakip henüz dönmedi. Ne yapmak istersin?</div>
    <div class="tvbk-row">
      <button class="tvbk-btn alt" data-act="extend">➕ 5 dk daha bekle</button>
      <button class="tvbk-btn" data-act="resume">▶ Oyunu başlat</button>
    </div>
    <div class="tvbk-note">Oyunu başlatırsan rakip 3 dk içinde oynamazsa hükmen yenilir.</div>
  </div>`;
  ov.querySelector('[data-act="extend"]').addEventListener('click', () => { TavlaMP.send({ type:'break_extend' }); startBreak('waiting'); });
  ov.querySelector('[data-act="resume"]').addEventListener('click', () => { TavlaMP.send({ type:'break_resume' }); resumeAfterBreak(); });
}
function hideBreakOverlay(){
  if(!G || !G.root) return;
  const ov = G.root.querySelector('[data-el="breakOverlay"]');
  if(ov) ov.remove();
}

// Pes/forfeit/bağlantı kopması için sade ödül (winType yok, normal kazanç)
async function awardSimple(playerWon, reason){
  try{ Store.trackQuestEvent && Store.trackQuestEvent('game_played',{game:'tavla'}); if(playerWon) Store.trackQuestEvent('game_won',{game:'tavla'}); }catch(e){}
  const kaju = playerWon ? 50 : 15;
  const xp = playerWon ? 55 : 20;
  try{ await Store.addKaju(kaju, 'tavla'); await Store.addXP(xp); }catch(e){}
  try{
    const Reward = await import('../reward.js');
    await Reward.showReward({
      won: playerWon, game:'tavla', kaju, xp, writeReward:false,
      title: playerWon ? '🎲 KAZANDIN!' : '🏳️ Kaybettin',
      subtitle: reason || 'Tavla oyunu tamamlandı',
    });
  }catch(e){ console.warn('[reward]',e); }
}

async function onWin(status){
  G.gameEnded = true;
  G.aiThinking = false;
  clearAutoRollTimer();
  clearAIGame();
  const winner = status === 'white_wins' ? 'w' : 'b';
  const wt = winType(G.state, winner);
  const typeLabel = wt === 3 ? ' (Hin/Backgammon ×3)' : wt === 2 ? ' (Mars/Gammon ×2)' : '';
  // playerWon dışarıda tanımla — tüm dallarda erişilebilsin
  let playerWon = false;
  let label;
  if(G.mode === 'ai'){
    playerWon = (winner === G.playerColor);
    label = playerWon ? `🏆 KAZANDIN!${typeLabel}` : `🤖 YZ KAZANDI${typeLabel}`;
    try{ playerWon ? Sound.win() : Sound.lose(); }catch(e){}
  } else if(G.online){
    playerWon = (winner === G.playerColor);
    label = playerWon ? `🏆 KAZANDIN!${typeLabel}` : `😔 Rakip kazandı${typeLabel}`;
    try{ playerWon ? Sound.win() : Sound.lose(); }catch(e){}
  } else {
    // Local oyun: beyaz tarafı oynayan kazandıysa playerWon=true
    playerWon = (winner === (G.playerColor || 'w'));
    const name = winner === 'w' ? 'BEYAZ' : 'SİYAH';
    label = `🏆 ${name} KAZANDI!${typeLabel}`;
    try{ Sound.win(); }catch(e){}
  }
  updateStatus(label, 'win');
  G.selected = null; G.legalForSel = [];
  updateControls(); draw();
  const tavlaKaju = 50 * wt; const tavlaXp = playerWon ? 55 : 20;
  try{ await Store.addKaju(tavlaKaju, 'tavla'); await Store.addXP(tavlaXp); }catch(e){}
  try{
    const Reward = await import('../reward.js');
    await Reward.showReward({
      won: playerWon, game:'tavla', kaju:tavlaKaju, xp:tavlaXp, writeReward:false,
      title: playerWon ? '🎲 KAZANDIN!' : '😔 Rakip kazandı',
      subtitle: 'Tavla oyunu tamamlandı',
    });
  }catch(e){ console.warn('[reward]',e); }
}

// ════════════ HUD ════════════
function updateTurn(){
  const el = G.root.querySelector('[data-el="turn"]');
  if(!el) return;
  const isW = G.state.turn === 'w';
  el.textContent = (isW ? 'BEYAZ' : 'SİYAH') + "'IN SIRASI";
  el.className = 'tg-turn ' + (isW ? 'white' : 'black');
}

function updateStatus(msg, kind){
  const el = G.root.querySelector('[data-el="status"]');
  if(!el) return;
  el.textContent = msg || '';
  el.className = 'tg-status' + (kind ? ' ' + kind : '') + (msg ? ' show' : '');
}

function updateControls(){
  if(!G || !G.root) return;
  const rollBtn = G.root.querySelector('[data-el="rollBtn"]');
  const passBtn = G.root.querySelector('[data-el="passBtn"]');
  const undoBtn = G.root.querySelector('[data-el="undoBtn"]');
  const actionsBar = G.root.querySelector('[data-el="actionsBar"]');
  if(actionsBar) actionsBar.style.display = G.gameEnded ? 'none' : 'flex';
  if(G.gameEnded || G.aiThinking){
    rollBtn.style.display = 'none'; passBtn.style.display = 'none'; undoBtn.style.display = 'none';
    return;
  }
  // AI sırasıysa kontrol gösterme
  if(G.mode === 'ai' && G.state.turn === G.aiColor){
    rollBtn.style.display = 'none'; passBtn.style.display = 'none'; undoBtn.style.display = 'none';
    return;
  }
  // Online'da sıra rakipteyse kontrol gösterme
  if(G.online && G.state.turn !== G.playerColor){
    rollBtn.style.display = 'none'; passBtn.style.display = 'none'; undoBtn.style.display = 'none';
    return;
  }
  rollBtn.style.display = 'none';
  if(!G.rolled){
    passBtn.style.display = 'none';
  } else {
    const noMoves = allLegalMoves(G.state).length === 0;
    // noMoves (gele) → tahtadaki mini PAS gösterilir, alttaki gizli
    // turnComplete (tüm zarlar kullanıldı) → alttaki Pas (tahtada zar yok)
    const showBottomPass = !noMoves && turnComplete(G.state);
    passBtn.style.display = showBottomPass ? 'block' : 'none';
  }
  undoBtn.style.display = (G.undoStack && G.undoStack.length > 0) ? 'block' : 'none';
}

// ════════════ YZ KURULUM ════════════
function showAISetup(root){
  const ov = document.createElement('div');
  ov.className = 'tavla-theme-picker';
  ov.innerHTML = `<div class="ttp-box">
    <div class="ttp-head-row">
      <button class="ttp-back-btn" data-act="back">← Geri</button>
      <div class="ttp-title">🤖 YAPAY ZEKÂ</div>
      <button class="ttp-close-btn" data-act="close">✕</button>
    </div>
    <div class="tas-label">ZORLUK</div>
    <div class="tas-row" data-group="diff">
      <button class="tas-opt" data-v="easy">😊 KOLAY</button>
      <button class="tas-opt active" data-v="medium">🎯 ORTA</button>
      <button class="tas-opt" data-v="hard">🔥 ZOR</button>
    </div>
    <div class="tas-label">SENİN RENGİN</div>
    <div class="tas-row" data-group="color">
      <button class="tas-opt active" data-v="w">⚪ BEYAZ</button>
      <button class="tas-opt" data-v="b">⚫ SİYAH</button>
    </div>
    <button class="tas-resume" style="display:none;width:100%;padding:14px;margin-bottom:10px;border-radius:14px;border:1.5px solid rgba(125,194,75,.6);background:linear-gradient(135deg,rgba(40,80,25,.7),rgba(20,45,12,.9));color:#b8f07a;font-size:14px;font-weight:900;cursor:pointer;transition:transform .12s">♟️ KALDIĞIN YERDEN DEVAM ET</button>
    <button class="ttp-close tas-start">▶ YENİ OYUN BAŞLAT</button>
  </div>`;
  root.appendChild(ov);
  let diff = 'medium', color = 'w';
  // Yarım kalmış AI oyunu varsa "devam" butonunu göster
  const _saved = loadAIGame();
  const _resumeBtn = ov.querySelector('.tas-resume');
  if(_saved && _saved.state && _resumeBtn){
    _resumeBtn.style.display = 'block';
    _resumeBtn.addEventListener('click', () => {
      ov.remove();
      startGame(root, 'ai', { difficulty: _saved.difficulty || 'medium', playerColor: _saved.playerColor || 'w' });
    });
  }
  ov.querySelectorAll('[data-group="diff"] .tas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="diff"] .tas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); diff = b.dataset.v;
  }));
  ov.querySelectorAll('[data-group="color"] .tas-opt').forEach(b => b.addEventListener('click', () => {
    ov.querySelectorAll('[data-group="color"] .tas-opt').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); color = b.dataset.v;
  }));
  ov.querySelector('.tas-start').addEventListener('click', () => {
    ov.remove();
    clearAIGame();   // yeni oyun → eski kaydı sil
    startGame(root, 'ai', { difficulty: diff, playerColor: color, fresh: true });
  });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => { ov.remove(); });
  ov.querySelector('[data-act="close"]').addEventListener('click', () => {
    ov.remove();
    // Ana menüye dön (tavla root'u kapat)
    if(G && G.root) G.root.remove(); G=null;
  });
}

// ════════════ ÇEVRİMİÇİ LOBİ ════════════
async function showOnlineLobby(root){
  // çevrimiçi modülü dinamik yükle (eksikse tavla yine de açılır)
  if(!TavlaMP){
    try{ TavlaMP = (await import('./tavla-mp.js')).default; }
    catch(e){
      if(window.Hero && window.Hero.toast) window.Hero.toast('Çevrimiçi modül yüklenemedi (tavla-mp.js eksik olabilir)', true);
      console.error('[tavla-mp]', e); return;
    }
  }
  const ov = document.createElement('div');
  ov.className = 'tavla-online-lobby';
  ov.innerHTML = `<div class="tol-box">
    <button class="tol-back" data-act="back">← Geri</button>
    <div class="tol-title">🌐 ÇEVRİMİÇİ OYUN</div>
    <div class="tol-panel" data-panel="choose">
      <button class="tol-big" data-act="create">
        <span class="tol-ic">➕</span>
        <div class="tol-bname">ODA KUR</div>
        <div class="tol-bdesc">Sen beyaz oynarsın · kod paylaş</div>
      </button>
      <button class="tol-big" data-act="join">
        <span class="tol-ic">🔑</span>
        <div class="tol-bname">ODAYA KATIL</div>
        <div class="tol-bdesc">Arkadaşının kodunu gir · siyah oyna</div>
      </button>
    </div>
    <div class="tol-panel" data-panel="host" style="display:none">
      <div class="tol-info">Oda kodun:</div>
      <div class="tol-code" data-el="code">······</div>
      <button class="tol-copy" data-act="copy">📋 KODU KOPYALA</button>
      <div class="tol-hint">Bu kodu arkadaşınla paylaş.<br>Rakip bekleniyor…</div>
      <div class="tol-spinner"></div>
    </div>
    <div class="tol-panel" data-panel="joinp" style="display:none">
      <div class="tol-info">Oda kodunu gir:</div>
      <div class="tol-input-row">
        <input class="tol-input" data-el="codeInput" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">
        <button class="tol-paste" data-act="paste" title="Yapıştır">📋</button>
      </div>
      <button class="tol-connect" data-act="connect">BAĞLAN</button>
      <div class="tol-status" data-el="joinStatus"></div>
    </div>
  </div>`;
  root.appendChild(ov);

  const showPanel = (name) => {
    ov.querySelectorAll('.tol-panel').forEach(p => p.style.display = 'none');
    ov.querySelector(`[data-panel="${name}"]`).style.display = 'flex';
  };

  ov.querySelector('[data-act="back"]').addEventListener('click', () => { try{ TavlaMP.close(); }catch(e){} ov.remove(); });

  // ODA KUR
  ov.querySelector('[data-act="create"]').addEventListener('click', () => {
    showPanel('host');
    try{ Sound.resume(); }catch(e){}
    TavlaMP.createRoom((type, data) => {
      if(type === 'code'){ ov.querySelector('[data-el="code"]').textContent = data; }
      else if(type === 'connected'){ ov.remove(); startGame(root, 'online', { isHost: true }); }
      else if(type === 'error'){ ov.querySelector('.tol-hint').innerHTML = '❌ ' + data + '<br>Tekrar dene.'; }
    });
  });
  // Kodu kopyala
  ov.querySelector('[data-act="copy"]').addEventListener('click', (e) => {
    const code = ov.querySelector('[data-el="code"]').textContent;
    const btn = e.currentTarget;
    copyTextTavla(code, () => { btn.textContent = '✅ KOPYALANDI'; setTimeout(() => { btn.textContent = '📋 KODU KOPYALA'; }, 1600); });
  });

  // ODAYA KATIL
  ov.querySelector('[data-act="join"]').addEventListener('click', () => showPanel('joinp'));
  const codeInput = ov.querySelector('[data-el="codeInput"]');
  ov.querySelector('[data-act="paste"]').addEventListener('click', async () => {
    try{ if(navigator.clipboard && navigator.clipboard.readText){ const t = await navigator.clipboard.readText(); codeInput.value = (t||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); } }catch(e){}
  });
  ov.querySelector('[data-act="connect"]').addEventListener('click', () => {
    const code = codeInput.value.trim().toUpperCase();
    if(code.length !== 6){ ov.querySelector('[data-el="joinStatus"]').textContent = '⚠️ 6 haneli kod gir'; return; }
    ov.querySelector('[data-el="joinStatus"]').textContent = 'Bağlanıyor…';
    try{ Sound.resume(); }catch(e){}
    TavlaMP.joinRoom(code, (type, data) => {
      if(type === 'connected'){ ov.remove(); startGame(root, 'online', { isHost: false }); }
      else if(type === 'error'){ ov.querySelector('[data-el="joinStatus"]').textContent = '❌ ' + data; }
    });
  });
}

function copyTextTavla(text, onDone){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(onDone).catch(() => fbCopy(text, onDone)); }
    else fbCopy(text, onDone);
  }catch(e){ fbCopy(text, onDone); }
}
function fbCopy(text, done){
  try{ const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); if(done) done(); }catch(e){}
}

// ════════════ TEMA SEÇİCİ ════════════
function showThemePicker(root){
  const ov = document.createElement('div');
  ov.className = 'tavla-theme-picker';
  ov.innerHTML = `<div class="ttp-box">
    <div class="ttp-title">🎨 TAHTA TEMASI</div>
    <div class="ttp-grid">
      ${Object.entries(THEMES).map(([key, th]) => `
        <button class="ttp-card ${key===SELECTED_THEME?'active':''}" data-theme="${key}">
          <div class="ttp-prev" style="background:${th.felt};border-color:${th.frame}">
            <span style="background:${th.pointA}"></span><span style="background:${th.pointB}"></span>
            <span style="background:${th.wTop}"></span><span style="background:${th.bTop}"></span>
          </div>
          <div class="ttp-name">${th.name}</div>
        </button>`).join('')}
    </div>
    <button class="ttp-close">KAPAT</button>
  </div>`;
  root.appendChild(ov);
  ov.querySelectorAll('.ttp-card').forEach(card => card.addEventListener('click', () => {
    SELECTED_THEME = card.dataset.theme;
    try{ localStorage.setItem('hero_tavla_theme', SELECTED_THEME); }catch(e){}
    if(G && G.ctx) draw();
    ov.remove();
  }));
  ov.querySelector('.ttp-close').addEventListener('click', () => ov.remove());
}

// ════════════ ANİMASYONLAR ════════════
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

// Zar atma animasyonu: kısa süre rastgele yüzler, sonra gerçek değerde sabitlenir
function animateDiceRoll(onDone){
  if(!G || !G.state.dice || G.state.dice.length === 0){ if(onDone) onDone(); return; }
  const real = G.state.dice.slice();
  const dur = 450, t0 = performance.now();
  G.diceAnim = real.map(() => 1 + Math.floor(Math.random()*6));
  function frame(now){
    if(!G){ return; }
    const p = Math.min(1, (now - t0) / dur);
    if(p < 1){
      // her ~60ms yüzleri değiştir
      if(Math.floor((now - t0) / 60) % 2 === 0){
        G.diceAnim = real.map(() => 1 + Math.floor(Math.random()*6));
      }
      draw();
      requestAnimationFrame(frame);
    } else {
      G.diceAnim = null;   // gerçek değerleri göster
      draw();
      if(onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}

// Pul hareket animasyonu: kaynak noktadan hedefe kayan pul
function animateMove(mv, onDone){
  if(!G){ if(onDone) onDone(); return; }
  const color = G.state.turn;
  const from = mv.from, to = mv.to;
  // VURUŞ mu? (hedefte rakibin TEK taşı) — görsel hatanın düzeltmesi:
  // 1) vurulan taş animasyon boyunca noktada DURMASIN (gizle + bar'a uçur)
  // 2) gelen taş rakip taşın ÜSTÜNE değil, zeminine (k=0) insin
  let hit = false, oppColor = color === 'w' ? 'b' : 'w';
  if(typeof to === 'number'){
    const occ = G.state.points[to];
    if((color === 'w' && occ === -1) || (color === 'b' && occ === 1)) hit = true;
  }
  const start = checkerPixel(from, color, 'from');
  let end = checkerPixel(to, color, 'to');
  if(hit && typeof to === 'number'){
    const g = G.geo, pg = pointGeometry(to);
    end = { x: pg.baseX, y: pg.y0 + pg.dir * (g.safe + g.checkerR) };   // k=0 zemini
  }
  if(!start || !end){ if(onDone) onDone(); return; }
  const dur = 280, t0 = performance.now();
  G.movingChecker = { color, x: start.x, y: start.y, r: G.geo.checkerR };
  // vurulan taş: noktadan bar'daki gerçek yuvasına uçar
  if(hit && typeof to === 'number'){
    const g = G.geo, pg = pointGeometry(to);
    const hs = { x: pg.baseX, y: pg.y0 + pg.dir * (g.safe + g.checkerR) };
    const whiteTop = G.flip, k = G.state.bar[oppColor];   // bar'da bir sonraki yuva
    const gap = g.checkerR * 2.05;
    const topY = g.innerY + g.safe + g.checkerR + k * gap;
    const botY = g.innerY + g.innerH - g.safe - g.checkerR - k * gap;
    const hy = (oppColor === 'w') ? (whiteTop ? topY : botY) : (whiteTop ? botY : topY);
    G.hitChecker = { color: oppColor, x: hs.x, y: hs.y, sx: hs.x, sy: hs.y, ex: g.barX + g.barW/2, ey: hy, r: G.geo.checkerR };
    G.hideAt = to;                                         // statik kopyayı gizle
  }
  function frame(now){
    if(!G){ return; }
    const p = Math.min(1, (now - t0) / dur);
    const e = easeOutCubic(p);
    G.movingChecker.x = start.x + (end.x - start.x) * e;
    G.movingChecker.y = start.y + (end.y - start.y) * e;
    if(G.hitChecker){
      const he = easeOutCubic(Math.min(1, p * 1.15));      // vurulan taş hafif önde gider
      G.hitChecker.x = G.hitChecker.sx + (G.hitChecker.ex - G.hitChecker.sx) * he;
      G.hitChecker.y = G.hitChecker.sy + (G.hitChecker.ey - G.hitChecker.sy) * he;
    }
    draw();
    if(p < 1){ requestAnimationFrame(frame); }
    else { G.movingChecker = null; G.hitChecker = null; G.hideAt = null; if(onDone) onDone(); }
  }
  requestAnimationFrame(frame);
}

// Bir nokta/bar/off için temsili pul piksel konumu
function checkerPixel(idx, color, side){
  const g = G.geo;
  if(idx === 'bar'){
    return { x: g.barX + g.barW/2, y: g.innerY + g.innerH/2 };
  }
  if(idx === 'off'){
    const topOff = (color === 'w') ? !G.flip : G.flip;
    return { x: g.bearX + g.bearW/2, y: topOff ? g.innerY + g.innerH*0.25 : g.innerY + g.innerH*0.75 };
  }
  const pg = pointGeometry(idx);
  const R = g.checkerR, safe = g.safe;
  // drawCheckers ile AYNI dizilim formülü (sürüklenen/animasyonlu pul doğru oturur)
  const cnt = Math.abs(G.state.points[idx]) || 0;
  const k = side === 'from' ? Math.max(0, cnt - 1) : cnt;
  const vis = Math.min(Math.max(cnt, 1), 5);
  const span = g.pointH - 2*safe - 2*R;
  const gap = Math.min(R * 2.05, vis > 1 ? span / (vis - 1) : 0);
  const cy = pg.y0 + pg.dir * (safe + R + Math.min(k, 4) * gap);
  return { x: pg.baseX, y: cy };
}

// ════════════ YARDIMCI ÇİZİM ════════════
function _roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function star(ctx, cx, cy, spikes, outer, inner){
  ctx.beginPath();
  for(let i=0;i<spikes*2;i++){
    const ang = (Math.PI/spikes)*i - Math.PI/2;
    const rad = i%2===0 ? outer : inner;
    const px = cx + Math.cos(ang)*rad, py = cy + Math.sin(ang)*rad;
    i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
  }
  ctx.closePath(); ctx.fill();
}

// ════════════ CSS ════════════
function injectCSS(){
  if(document.getElementById('tavla-css')) return;
  const s = document.createElement('style');
  s.id = 'tavla-css';
  s.textContent = `
.tavla-root{ position:fixed; inset:0; z-index:9000; background:#0a1428;
  display:flex; flex-direction:column; font-family:system-ui,-apple-system,sans-serif;
  color:#f0e6cc; overflow:hidden; }
.tv-modes{ flex:1; display:flex; flex-direction:column; padding:14px; max-width:520px; margin:0 auto; width:100%; box-sizing:border-box; }
.tvm-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
.tvm-title{ font-size:18px; font-weight:800; letter-spacing:1px; color:#c8a557; text-shadow:0 0 12px rgba(200,165,87,.4); }
.tvm-sub{ text-align:center; color:#8a9bb5; font-size:13px; margin-bottom:20px; }
.tvm-cards{ display:flex; flex-direction:column; gap:12px; }
.tvm-card{ display:flex; flex-direction:column; align-items:center; gap:4px; padding:20px;
  background:linear-gradient(135deg, rgba(122,20,32,.4), rgba(10,20,40,.9));
  border:1.5px solid rgba(200,165,87,.4); border-radius:16px; color:#f0e6cc; cursor:pointer;
  transition:transform .12s, border-color .2s; }
.tvm-card:active{ transform:scale(.98); }
.tvm-card:not(.soon):hover{ border-color:#c8a557; }
.tvm-card.soon{ opacity:.45; cursor:not-allowed; }
.tvm-ic{ font-size:36px; }
.tvm-name{ font-size:15px; font-weight:800; letter-spacing:.5px; }
.tvm-desc{ font-size:11px; color:#8a9bb5; }

.tv-game{ display:flex; flex-direction:column; padding:4px 6px 2px; max-width:640px; margin:0 auto; width:100%; box-sizing:border-box; height:100svh; height:100vh; max-height:100svh; overflow:hidden; }
.tg-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:5px; flex-shrink:0; }
.tg-turn{ font-size:15px; font-weight:800; letter-spacing:1px; padding:6px 16px; border-radius:20px; border:1.5px solid rgba(200,165,87,.4); }
.tg-turn.white{ background:rgba(245,239,224,.15); color:#f5efe0; }
.tg-turn.black{ background:rgba(60,80,120,.25); color:#9fc0e8; }
.tv-icon{ width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(200,165,87,.3); color:#c8a557; font-size:16px; cursor:pointer; }
.tv-icon:active{ transform:scale(.92); }
.tg-status{ text-align:center; font-size:13px; font-weight:700; min-height:0; height:0; overflow:hidden; opacity:0; transition:all .2s; }
.tg-status.show{ height:auto; min-height:22px; opacity:1; margin:2px 0 6px; padding:6px; border-radius:10px; background:rgba(255,255,255,.05); }
.tg-status.win{ background:linear-gradient(90deg, rgba(200,165,87,.25), rgba(255,215,64,.15)); color:#ffd740; font-size:15px; }
.tg-board-wrap{ flex:1 1 0; display:flex; align-items:center; justify-content:center; min-height:0; overflow:hidden; }
.tg-board-wrap canvas{ border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,.6); touch-action:none; }
.tg-controls{ display:flex; gap:6px; justify-content:center; align-items:center; padding:5px 0 3px; flex-shrink:0; position:relative; z-index:5; }
.tg-actions{ display:flex; gap:6px; justify-content:center; align-items:center; padding:0 6px 4px; flex-shrink:0; flex-wrap:nowrap; position:relative; z-index:5; }
.tg-act-btn{ flex:1 1 0; min-width:0; padding:9px 6px; background:rgba(255,255,255,.05); border:1px solid rgba(200,165,87,.3); border-radius:10px; color:#c8a557; font-size:11px; font-weight:700; cursor:pointer; transition:transform .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tg-act-btn:active{ transform:scale(.95); }
.tg-act-btn.danger{ border-color:rgba(255,90,90,.4); color:#ff8080; }
.tavla-confirm{ position:fixed; inset:0; z-index:9300; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.8); backdrop-filter:blur(5px); padding:20px; box-sizing:border-box; }
.tvcf-box{ background:linear-gradient(135deg,#16294a,#0a1428); border:2px solid #c8a557; border-radius:18px; padding:22px; max-width:340px; width:100%; box-sizing:border-box; text-align:center; }
.tvcf-msg{ font-size:15px; font-weight:600; color:#f0e6cc; line-height:1.5; margin-bottom:18px; }
.tvcf-row{ display:flex; gap:10px; }
.tvcf-no, .tvcf-yes{ flex:1; padding:13px; border-radius:11px; font-size:14px; font-weight:800; cursor:pointer; border:none; }
.tvcf-no{ background:rgba(255,255,255,.08); color:#b0c0d4; border:1px solid rgba(255,255,255,.15); }
.tvcf-yes{ background:linear-gradient(135deg,#c8a557,#a07d2f); color:#0a1428; }
.tvcf-no:active, .tvcf-yes:active{ transform:scale(.96); }
.tavla-break{ position:fixed; inset:0; z-index:9400; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.9); backdrop-filter:blur(7px); padding:20px; box-sizing:border-box; }
.tvbk-box{ background:linear-gradient(135deg,#1a2e52,#0a1428); border:2px solid #c8a557; border-radius:20px; padding:28px 22px; max-width:360px; width:100%; box-sizing:border-box; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.6); }
.tvbk-icon{ font-size:46px; margin-bottom:10px; }
.tvbk-title{ font-size:20px; font-weight:800; color:#f0e6cc; margin-bottom:8px; }
.tvbk-sub{ font-size:15px; color:#b8c4d8; line-height:1.5; margin-bottom:18px; font-variant-numeric:tabular-nums; }
.tvbk-btn{ width:100%; padding:14px; border-radius:12px; font-size:15px; font-weight:800; cursor:pointer; border:none; background:linear-gradient(135deg,#c8a557,#a07d2f); color:#0a1428; margin-top:6px; }
.tvbk-btn.alt{ background:rgba(255,255,255,.08); color:#dbe4f0; border:1px solid rgba(255,255,255,.2); }
.tvbk-btn:active{ transform:scale(.96); }
.tvbk-row{ display:flex; flex-direction:column; gap:8px; }
.tvbk-note{ font-size:11px; color:#8a98ac; margin-top:12px; line-height:1.4; }
.tg-btn{ padding:12px 18px; background:rgba(255,255,255,.06); border:1px solid rgba(200,165,87,.3); border-radius:12px; color:#c8a557; font-size:13px; font-weight:700; cursor:pointer; transition:transform .1s; }
.tg-btn:active{ transform:scale(.96); }
.tg-roll{ background:linear-gradient(135deg, #c8a557, #a07d2f); color:#0a1428; font-size:16px; font-weight:800; letter-spacing:1px; padding:14px 32px; box-shadow:0 0 16px rgba(200,165,87,.3); }

.tavla-theme-picker{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.8); backdrop-filter:blur(6px); padding:16px; box-sizing:border-box; }
.ttp-head-row{ display:flex;align-items:center;justify-content:space-between;margin-bottom:14px; }
.ttp-back-btn{ background:rgba(255,255,255,.07);border:1px solid rgba(200,165,87,.3);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#c8a557;cursor:pointer;font-family:inherit; }
.ttp-close-btn{ background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.25);border-radius:10px;padding:7px 13px;font-size:12px;font-weight:700;color:#ff8080;cursor:pointer;font-family:inherit; }
.ttp-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:20px; padding:20px; max-width:440px; width:100%; box-sizing:border-box; }
.ttp-box *{ box-sizing:border-box; }
.ttp-title{ text-align:center; font-size:16px; font-weight:800; letter-spacing:1px; color:#c8a557; margin-bottom:16px; }
.ttp-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.ttp-card{ padding:10px; background:rgba(255,255,255,.04); border:1.5px solid rgba(200,165,87,.3); border-radius:12px; cursor:pointer; transition:all .15s; }
.ttp-card.active{ border-color:#c8a557; background:rgba(200,165,87,.15); }
.ttp-prev{ display:grid; grid-template-columns:1fr 1fr; width:54px; height:40px; margin:0 auto 6px; border-radius:6px; overflow:hidden; border:1.5px solid; }
.ttp-prev span{ display:block; }
.ttp-name{ text-align:center; font-size:11px; font-weight:700; color:#f0e6cc; }
.ttp-close{ width:100%; margin-top:14px; padding:10px; background:rgba(200,165,87,.2); border:1px solid #c8a557; border-radius:10px; color:#c8a557; font-weight:700; cursor:pointer; }
/* YZ kurulum */
.tas-label{ font-size:12px; font-weight:700; color:#8a9bb5; letter-spacing:.5px; margin:14px 0 6px; }
.tas-row{ display:flex; gap:6px; }
.tas-opt{ flex:1; padding:11px 4px; background:rgba(255,255,255,.05); border:1.5px solid rgba(200,165,87,.3); border-radius:10px; color:#f0e6cc; font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; }
.tas-opt.active{ border-color:#c8a557; background:rgba(200,165,87,.18); color:#ffd740; }
.tas-opt:active{ transform:scale(.96); }
.tas-start{ background:linear-gradient(135deg,#c8a557,#a07d2f)!important; color:#0a1428!important; border:none!important; font-size:14px!important; margin-top:18px!important; }

/* Çevrimiçi lobi */
.tavla-online-lobby{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.85); backdrop-filter:blur(6px); padding:16px; box-sizing:border-box; }
.tol-box{ background:linear-gradient(135deg, #16294a, #0a1428); border:2px solid #c8a557; border-radius:20px; padding:20px; max-width:400px; width:100%; box-sizing:border-box; position:relative; overflow:hidden; max-height:92vh; overflow-y:auto; }
.tol-box *{ box-sizing:border-box; }
.tol-back{ position:absolute; top:14px; left:14px; background:none; border:none; color:#8a9bb5; font-size:13px; cursor:pointer; z-index:2; }
.tol-title{ text-align:center; font-size:16px; font-weight:800; letter-spacing:.5px; color:#c8a557; margin-bottom:18px; padding-top:6px; }
.tol-panel{ display:flex; flex-direction:column; gap:12px; width:100%; }
.tol-big{ display:flex; flex-direction:column; align-items:center; gap:3px; padding:18px; width:100%; background:linear-gradient(135deg, rgba(35,70,126,.5), rgba(10,20,40,.9)); border:1.5px solid rgba(200,165,87,.4); border-radius:14px; color:#f0e6cc; cursor:pointer; transition:transform .12s, border-color .2s; }
.tol-big:active{ transform:scale(.98); }
.tol-big:hover{ border-color:#c8a557; }
.tol-ic{ font-size:30px; }
.tol-bname{ font-size:15px; font-weight:800; letter-spacing:.5px; }
.tol-bdesc{ font-size:11px; color:#8a9bb5; text-align:center; }
.tol-info{ text-align:center; font-size:13px; color:#b0c0d4; }
.tol-code{ width:100%; text-align:center; font-family:monospace; font-weight:800; font-size:clamp(26px,9vw,40px); letter-spacing:0.18em; color:#ffd740; text-shadow:0 0 18px rgba(255,215,64,.45); padding:14px 8px; background:rgba(255,215,64,.08); border-radius:12px; border:1.5px dashed rgba(200,165,87,.5); overflow-wrap:break-word; }
.tol-copy{ width:100%; padding:13px; background:linear-gradient(135deg,#c8a557,#a07d2f); border:none; border-radius:12px; color:#0a1428; font-weight:800; font-size:14px; letter-spacing:.5px; cursor:pointer; }
.tol-copy:active{ transform:scale(.97); }
.tol-hint{ text-align:center; font-size:12px; color:#8a9bb5; line-height:1.5; }
.tol-spinner{ width:30px; height:30px; margin:4px auto; border:3px solid rgba(200,165,87,.2); border-top-color:#c8a557; border-radius:50%; animation:tolSpin .9s linear infinite; }
@keyframes tolSpin{ to{ transform:rotate(360deg); } }
.tol-input-row{ display:flex; gap:8px; }
.tol-input{ flex:1; min-width:0; padding:16px; font-family:monospace; font-weight:800; font-size:clamp(22px,7vw,28px); letter-spacing:0.2em; text-align:center; text-transform:uppercase; background:rgba(255,255,255,.06); border:1.5px solid rgba(200,165,87,.4); border-radius:12px; color:#ffd740; }
.tol-input:focus{ outline:none; border-color:#c8a557; }
.tol-paste{ width:52px; flex-shrink:0; background:rgba(200,165,87,.12); border:1.5px solid rgba(200,165,87,.4); border-radius:12px; color:#c8a557; font-size:20px; cursor:pointer; }
.tol-paste:active{ transform:scale(.94); }
.tol-connect{ width:100%; padding:14px; background:linear-gradient(135deg,#c8a557,#a07d2f); border:none; border-radius:12px; color:#0a1428; font-weight:800; font-size:15px; letter-spacing:1px; cursor:pointer; }
.tol-connect:active{ transform:scale(.98); }
.tol-status{ text-align:center; font-size:13px; color:#3fc8e0; min-height:18px; }

/* Sohbet */
.tg-chat-badge{ position:absolute; top:-4px; right:-4px; min-width:16px; height:16px; padding:0 4px; display:flex; align-items:center; justify-content:center; background:#ff4060; color:#fff; font-size:10px; font-weight:800; border-radius:8px; box-sizing:border-box; }
.tv-icon{ position:relative; }
.tv-chat{ position:fixed; left:0; right:0; bottom:0; max-width:600px; margin:0 auto; background:linear-gradient(180deg, #16294a, #0a1428); border-top:2px solid #c8a557; border-radius:18px 18px 0 0; display:flex; flex-direction:column; max-height:60%; z-index:1200; box-shadow:0 -10px 40px rgba(0,0,0,.6); }
.tvc-head{ display:flex; align-items:center; justify-content:space-between; padding:12px 16px; font-weight:700; font-size:14px; color:#c8a557; border-bottom:1px solid rgba(200,165,87,.2); }
.tvc-close{ background:none; border:none; color:#8a9bb5; font-size:16px; cursor:pointer; }
.tvc-msgs{ flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:6px; min-height:110px; }
.tvc-msg{ max-width:75%; padding:8px 12px; border-radius:14px; font-size:13px; line-height:1.4; word-break:break-word; }
.tvc-msg.mine{ align-self:flex-end; background:linear-gradient(135deg,#c8a557,#a07d2f); color:#0a1428; border-bottom-right-radius:4px; }
.tvc-msg.theirs{ align-self:flex-start; background:rgba(200,165,87,.18); color:#f0e6cc; border-bottom-left-radius:4px; }
.tvc-quick{ display:flex; gap:6px; overflow-x:auto; padding:8px 12px; border-top:1px solid rgba(200,165,87,.15); }
.tvc-q{ flex-shrink:0; padding:6px 12px; background:rgba(200,165,87,.08); border:1px solid rgba(200,165,87,.3); border-radius:16px; color:#f0e6cc; font-size:12px; white-space:nowrap; cursor:pointer; }
.tvc-q:active{ transform:scale(.95); }
.tvc-input-row{ display:flex; gap:8px; padding:12px; }
.tvc-input{ flex:1; min-width:0; padding:12px 14px; background:rgba(255,255,255,.06); border:1.5px solid rgba(200,165,87,.4); border-radius:22px; color:#fff; font-size:14px; }
.tvc-input:focus{ outline:none; border-color:#c8a557; }
.tvc-send{ width:48px; flex-shrink:0; background:linear-gradient(135deg,#c8a557,#a07d2f); border:none; border-radius:50%; color:#0a1428; font-size:18px; cursor:pointer; }
.tvc-send:active{ transform:scale(.94); }
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
