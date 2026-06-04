// ════════════════════════════════════════════════════════════════
//  TAVLA — UI / RENDER KATMANI (Canvas 2.5D)
//
//  tavla-engine.js üzerine kurulu. Osmanlı temalı, dokunmatik.
//  Bu sürüm: 6 tema + aynı cihazda 2 oyuncu. (AI/online sonra.)
// ════════════════════════════════════════════════════════════════
import Store from '../store.js';
import Auth from '../auth.js';
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
    name: 'Anadolu Ceviz',
    bg:'#1a0e06', felt:'#5a3a1e', frame:'#c8a557', frameDark:'#8a6d2f',
    pointA:'#7d4e2a', pointB:'#e0c498',
    bar:'#3a2410', barMotif:'#c8a557',
    wTop:'#f0e0c0', wBot:'#d0b890', wEdge:'#b09868',
    bTop:'#6b4226', bBot:'#3a2414', bEdge:'#8a5e3a',
    glow:'#e0a860'
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
          <button class="tv-icon" data-act="chat" data-el="chatBtn" title="Sohbet" style="display:none">💬<span class="tg-chat-badge" data-el="chatBadge" style="display:none"></span></button>
          <button class="tv-icon" data-act="restart" title="Yeniden">🔄</button>
        </div>
      </div>
      <div class="tg-status" data-el="status"></div>
      <div class="tg-board-wrap" data-el="boardWrap">
        <canvas data-el="canvas"></canvas>
      </div>
      <div class="tg-controls">
        <button class="tg-btn" data-act="undo" data-el="undoBtn">↩️ Geri Al</button>
        <button class="tg-btn tg-roll" data-act="roll" data-el="rollBtn">🎲 ZAR AT</button>
        <button class="tg-btn" data-act="pass" data-el="passBtn" style="display:none">⏭️ Pas</button>
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
}

function closeAll(){
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
  G.state = newGame();
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

  if(G.online){ TavlaMP.__setHandler(onRemoteMessage); }

  // Açılış zarı — online'da host belirler+gönderir; diğer modlarda yerel
  if(G.online && !G.isHost){
    // misafir: host'tan 'start' bekleyecek
    G.openingDice = [1, 1];
    G.state.turn = 'w';
  } else {
    const open = openingRoll();
    G.state.turn = open.first;
    G.openingDice = open.dice;
  }

  // Açılış zarı — kim başlar
  const open = openingRoll();
  G.state.turn = open.first;
  G.openingDice = open.dice;

  gameEl.querySelector('[data-act="exit"]').addEventListener('click', closeAll);
  gameEl.querySelector('[data-act="restart"]').addEventListener('click', () => restart());
  gameEl.querySelector('[data-act="roll"]').addEventListener('click', () => rollAndShow());
  gameEl.querySelector('[data-act="undo"]').addEventListener('click', () => undoMove());
  gameEl.querySelector('[data-act="pass"]').addEventListener('click', () => endTurn());
  G.canvas.addEventListener('pointerdown', onPointerDown);
  G.canvas.addEventListener('pointermove', onPointerMove);
  G.canvas.addEventListener('pointerup', onPointerUp);
  G.canvas.addEventListener('pointercancel', onPointerUp);

  G.resizeHandler = () => fitCanvas();
  window.addEventListener('resize', G.resizeHandler);

  fitCanvas();
  // Tahta yönü: AI/online'da insan rengine göre sabit; 2 oyuncuda döner
  if(mode === 'ai' || mode === 'online'){ G.flip = (G.playerColor === 'b'); }
  else if(mode === 'local'){ G.flip = (G.state.turn === 'b'); }

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
    return;
  }

  updateTurn();
  updateStatus(`Açılış: Beyaz ${G.openingDice[0]} – Siyah ${G.openingDice[1]} · ${G.state.turn==='w'?'Beyaz':'Siyah'} başlar`);
  updateControls();
  draw();
  // AI başlıyorsa otomatik oyna
  maybeAITurn();
}

function restart(){
  if(G.online) return;   // çevrimiçi oyunda tek taraflı sıfırlama yok
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
}

// ════════════ ZAR ATMA ════════════
function rollAndShow(){
  if(G.gameEnded || G.rolled || G.aiThinking) return;
  if(G.mode === 'ai' && G.state.turn === G.aiColor) return;
  if(G.online && G.state.turn !== G.playerColor) return;   // sıra rakipte
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
      updateStatus(`🎲 ${diceStr} — oynanabilir hamle yok, pas`);
      G.canPass = true;
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
  const availW = wrap.clientWidth || (window.innerWidth - 12);
  const availH = wrap.clientHeight || (window.innerHeight - 180);
  // Tavla tahtası DİKEY-UZUN: ekranın çoğunu doldurur. Oran = yükseklik/genişlik.
  // Dikey ekranda mevcut alana göre dinamik (1.30–1.62 arası), boşa alan bırakmaz.
  let ratio = availH / availW;
  ratio = Math.max(1.30, Math.min(ratio, 1.62));
  let w = availW, h = w * ratio;
  if(h > availH){ h = availH; w = h / ratio; }
  const dpr = window.devicePixelRatio || 1;
  G.W = Math.floor(w); G.H = Math.floor(h);
  G.canvas.width = G.W * dpr; G.canvas.height = G.H * dpr;
  G.canvas.style.width = G.W + 'px'; G.canvas.style.height = G.H + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeLayout();
  draw();
}

// Tahta geometrisi (çerçeve, bar, çeyrekler, nokta üçgenleri)
function computeLayout(){
  const W = G.W, H = G.H;
  const margin = Math.round(W * 0.03);
  const barW = Math.round(W * 0.07);     // orta bar
  const bearW = Math.round(W * 0.07);    // sağ toplama oluğu
  const innerX = margin, innerY = margin;
  const innerW = W - margin*2, innerH = H - margin*2;
  // sol yarı + bar + sağ yarı + bear oluğu
  const playW = innerW - barW - bearW;
  const halfW = playW / 2;
  const colW = halfW / 6;               // bir nokta sütunu genişliği
  G.geo = {
    margin, barW, bearW, innerX, innerY, innerW, innerH,
    leftX: innerX,
    barX: innerX + halfW,
    rightX: innerX + halfW + barW,
    bearX: innerX + playW + barW,
    colW, halfW, playW,
    pointH: innerH * 0.42,              // üçgen yüksekliği
    checkerR: Math.min(colW, innerH*0.42/5) * 0.46
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
  // flip uygulandığında üst/alt ve x ters döner
  if(flip){
    top = !top;
    baseX = (g.innerX*2 + g.innerW) - baseX;   // yatay ayna
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

  // dış zemin
  ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
  // altın çerçeve
  roundRect(ctx, 2, 2, W-4, H-4, 10);
  const fg = ctx.createLinearGradient(0,0,W,H);
  fg.addColorStop(0, t.frame); fg.addColorStop(.5, t.frameDark); fg.addColorStop(1, t.frame);
  ctx.fillStyle = fg; ctx.fill();
  // iç keçe (oyun alanı)
  ctx.fillStyle = t.felt;
  ctx.fillRect(g.innerX, g.innerY, g.innerW, g.innerH);

  // üçgen noktalar
  for(let i=0;i<24;i++){ drawPoint(ctx, i, t); }

  // orta bar
  ctx.fillStyle = t.bar;
  ctx.fillRect(g.barX, g.innerY, g.barW, g.innerH);
  drawBarMotif(ctx, t);

  // bear-off oluğu
  ctx.fillStyle = t.bar;
  ctx.fillRect(g.bearX, g.innerY, g.bearW, g.innerH);
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

  // hareket eden pul (AI animasyonu)
  if(G.movingChecker){
    drawChecker(ctx, G.movingChecker.x, G.movingChecker.y, G.movingChecker.r, G.movingChecker.color, t);
  }
  // sürüklenen pul (parmağı takip eder)
  if(G.dragging && G.dragMoved && G.dragPos){
    drawChecker(ctx, G.dragPos.x, G.dragPos.y, G.geo.checkerR * 1.15, G.state.turn, t);
  }
}

function drawPoint(ctx, idx, t){
  const pg = pointGeometry(idx);
  const g = G.geo;
  const half = pg.colW * 0.5;
  const tipY = pg.y0 + pg.dir * g.pointH;
  // alternatifli renk
  const isA = (idx % 2 === 0);
  ctx.fillStyle = isA ? t.pointA : t.pointB;
  ctx.beginPath();
  ctx.moveTo(pg.baseX - half*0.86, pg.y0);
  ctx.lineTo(pg.baseX + half*0.86, pg.y0);
  ctx.lineTo(pg.baseX, tipY);
  ctx.closePath();
  ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
  // ince kenar
  ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 1; ctx.stroke();
}

function drawBarMotif(ctx, t){
  const g = G.geo;
  const cx = g.barX + g.barW/2;
  ctx.save();
  // dikey altın orta çizgi
  ctx.strokeStyle = t.barMotif; ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, g.barW*0.04);
  ctx.beginPath(); ctx.moveTo(cx, g.innerY + 6); ctx.lineTo(cx, g.innerY + g.innerH - 6); ctx.stroke();
  // tekrarlı küçük baklava (eşkenar dörtgen) motifler
  ctx.globalAlpha = 0.4; ctx.fillStyle = t.barMotif;
  const n = 6, gap = (g.innerH - 20) / n;
  const d = g.barW * 0.18;
  for(let k=0;k<=n;k++){
    const cy = g.innerY + 10 + k * gap;
    ctx.beginPath();
    ctx.moveTo(cx, cy-d); ctx.lineTo(cx+d, cy); ctx.lineTo(cx, cy+d); ctx.lineTo(cx-d, cy);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBearOff(ctx, t){
  const g = G.geo;
  // toplanan pul sayısı (üstte siyah off, altta beyaz off — flip'e göre)
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = `bold ${Math.floor(g.bearW*0.32)}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cx = g.bearX + g.bearW/2;
  const wOff = G.state.off.w, bOff = G.state.off.b;
  // beyaz altta (flip false), siyah üstte
  const topVal = G.flip ? wOff : bOff;
  const botVal = G.flip ? bOff : wOff;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.fillRect(g.bearX+2, g.innerY+2, g.bearW-4, g.innerH/2-4);
  ctx.fillRect(g.bearX+2, g.innerY+g.innerH/2+2, g.bearW-4, g.innerH/2-4);
  ctx.fillStyle = '#fff';
  ctx.fillText('↑'+topVal, cx, g.innerY + g.innerH*0.25);
  ctx.fillText('↓'+botVal, cx, g.innerY + g.innerH*0.75);
  ctx.restore();
}

// Bir noktadaki pulları çiz
function drawCheckers(ctx, t){
  const g = G.geo;
  for(let i=0;i<24;i++){
    const v = G.state.points[i];
    if(v === 0) continue;
    const color = v > 0 ? 'w' : 'b';
    const count = Math.abs(v);
    const pg = pointGeometry(i);
    const R = g.checkerR;
    const maxVisible = 5;
    for(let k=0;k<Math.min(count, maxVisible);k++){
      const cy = pg.y0 + pg.dir * (R + k * R * 1.9 + 2);
      drawChecker(ctx, pg.baseX, cy, R, color, t);
    }
    // 5'ten fazlaysa sayı göster
    if(count > maxVisible){
      const cy = pg.y0 + pg.dir * (R + (maxVisible-1) * R * 1.9 + 2);
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
  // gölge
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(cx, cy + R*0.18, R*0.95, R*0.9, 0, 0, Math.PI*2); ctx.fill();
  // gövde (radyal gradyan)
  const grad = ctx.createRadialGradient(cx - R*0.3, cy - R*0.3, R*0.15, cx, cy, R);
  grad.addColorStop(0, isW ? t.wTop : t.bTop);
  grad.addColorStop(1, isW ? t.wBot : t.bBot);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
  // kenar
  ctx.strokeStyle = isW ? t.wEdge : t.bEdge; ctx.lineWidth = Math.max(1, R*0.12);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.94, 0, Math.PI*2); ctx.stroke();
  // iç halka (oyuk hissi)
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = Math.max(1, R*0.08);
  ctx.beginPath(); ctx.arc(cx, cy, R*0.6, 0, Math.PI*2); ctx.stroke();
  ctx.restore();
}

function drawBarCheckers(ctx, t){
  const g = G.geo;
  const cx = g.barX + g.barW/2;
  const R = g.checkerR;
  // beyaz bar (alt yarı) + siyah bar (üst yarı), flip'e göre
  const wBar = G.state.bar.w, bBar = G.state.bar.b;
  // beyaz: aktifse alta, siyah üste (flip false)
  for(let k=0;k<wBar;k++){
    const cy = (G.flip ? g.innerY + R + 4 : g.innerY + g.innerH - R - 4) + (G.flip?1:-1)*k*R*1.9;
    drawChecker(ctx, cx, cy, R, 'w', t);
  }
  for(let k=0;k<bBar;k++){
    const cy = (G.flip ? g.innerY + g.innerH - R - 4 : g.innerY + R + 4) + (G.flip?-1:1)*k*R*1.9;
    drawChecker(ctx, cx, cy, R, 'b', t);
  }
}

function drawDice(ctx, t){
  if(!G.state.dice || G.state.dice.length === 0) return;
  const g = G.geo;
  const dice = G.diceAnim || G.state.dice;   // animasyon sırasında rastgele yüzler
  const sz = Math.min(g.barW*1.1, g.innerH*0.1);
  const cy = g.innerY + g.innerH/2;
  const startX = G.flip ? g.leftX + g.halfW*0.5 : g.rightX + g.halfW*0.5;
  dice.forEach((d, i) => {
    const used = G.diceAnim ? false : G.state.used.includes(i);
    const dx = startX + (i - dice.length/2) * (sz*1.25);
    drawDie(ctx, dx, cy, sz, d, used);
  });
}

function drawDie(ctx, cx, cy, sz, val, used){
  ctx.save();
  const x = cx - sz/2, y = cy - sz/2;
  roundRect(ctx, x, y, sz, sz, sz*0.18);
  ctx.fillStyle = used ? '#8a8a8a' : '#f8f8f4';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 1; ctx.stroke();
  // noktalar
  ctx.fillStyle = used ? '#555' : '#2a2a2a';
  const r = sz*0.09;
  const p = (fx, fy) => { ctx.beginPath(); ctx.arc(x + sz*fx, y + sz*fy, r, 0, Math.PI*2); ctx.fill(); };
  const C=0.5, L=0.28, R=0.72;
  if(val===1){ p(C,C); }
  else if(val===2){ p(L,L); p(R,R); }
  else if(val===3){ p(L,L); p(C,C); p(R,R); }
  else if(val===4){ p(L,L); p(R,L); p(L,R); p(R,R); }
  else if(val===5){ p(L,L); p(R,L); p(C,C); p(L,R); p(R,R); }
  else if(val===6){ p(L,L); p(R,L); p(L,C); p(R,C); p(L,R); p(R,R); }
  ctx.restore();
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
    const lm = legalMovesFrom(G.state, from);
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
  // undo için kaydet (online'da undo kapalı)
  if(!G.online){ G.undoStack.push({ state: G.state, selected: null }); }
  if(G.online){ TavlaMP.send({ type:'move', from: mv.from, to: mv.to, die: mv.die, dieIdx: mv.dieIdx }); }
  G.state = applyMove(G.state, mv);
  G.selected = null; G.legalForSel = [];
  try{ mv.type === 'hit' ? Sound.hit() : (mv.to === 'off' ? Sound.bearoff() : Sound.move()); }catch(e){}

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
}

function endTurn(){
  if(G.gameEnded) return;
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
  if(!G.online){ maybeAITurn(); }   // sıra AI'daysa otomatik oyna (online'da yok)
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
    try{ mv.type === 'hit' ? Sound.hit() : (mv.to === 'off' ? Sound.bearoff() : Sound.move()); }catch(e){}
    draw();
    const status = gameStatus(G.state);
    if(status !== 'playing'){ G.aiThinking = false; onWin(status); return; }
    setTimeout(() => playAISequence(seq, i + 1), 350);
  });
}

// ════════════ ÇEVRİMİÇİ MESAJ ════════════
function onRemoteMessage(type, data){
  if(!G) return;
  if(type === 'disconnected'){
    if(!G.gameEnded){ G.oppLeft = true; G.gameEnded = true; updateStatus('❌ Rakip bağlantısı koptu', 'win'); updateControls(); }
    return;
  }
  if(type !== 'message') return;
  const msg = data;
  if(!msg || !msg.type) return;

  if(msg.type === 'start'){
    G.openingDice = msg.openingDice || [1,1];
    G.state.turn = msg.first || 'w';
    updateTurn();
    const mine = (G.state.turn === G.playerColor);
    updateStatus(`Açılış: B${G.openingDice[0]}–S${G.openingDice[1]} · ` + (mine ? 'sen başla, zar at' : 'rakip başlıyor'));
    updateControls(); draw();
  } else if(msg.type === 'dice'){
    G.state.dice = msg.dice || []; G.state.used = []; G.rolled = true;
    try{ Sound.dice(); }catch(e){}
    animateDiceRoll(() => {
      const dd = G.state.dice;
      updateStatus('Rakip zarı: ' + (dd.length===4?`${dd[0]}-${dd[0]} (çift)`:`${dd[0]}-${dd[1]}`));
      draw();
    });
  } else if(msg.type === 'move'){
    const mv = { from: msg.from, to: msg.to, die: msg.die, dieIdx: msg.dieIdx };
    let isHit = false;
    if(typeof mv.to === 'number'){
      const occ = G.state.points[mv.to]; const mover = G.state.turn;
      if((mover === 'w' && occ === -1) || (mover === 'b' && occ === 1)) isHit = true;
    }
    animateMove(mv, () => {
      G.state = applyMove(G.state, mv);
      try{ isHit ? Sound.hit() : (mv.to === 'off' ? Sound.bearoff() : Sound.move()); }catch(e){}
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
  } else if(msg.type === 'chat'){
    addChatMessage((msg.text || '').slice(0, 120), false);
  } else if(msg.type === 'resign'){
    G.gameEnded = true; G.oppLeft = true;
    updateStatus('🏆 Rakip pes etti — KAZANDIN!', 'win');
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

async function onWin(status){
  G.gameEnded = true;
  G.aiThinking = false;
  const winner = status === 'white_wins' ? 'w' : 'b';
  const wt = winType(G.state, winner);
  const typeLabel = wt === 3 ? ' (Hin/Backgammon ×3)' : wt === 2 ? ' (Mars/Gammon ×2)' : '';
  let label;
  if(G.mode === 'ai'){
    const playerWon = (winner === G.playerColor);
    label = playerWon ? `🏆 KAZANDIN!${typeLabel}` : `🤖 YZ KAZANDI${typeLabel}`;
    try{ playerWon ? Sound.win() : Sound.lose(); }catch(e){}
  } else if(G.online){
    const playerWon = (winner === G.playerColor);
    label = playerWon ? `🏆 KAZANDIN!${typeLabel}` : `😔 Rakip kazandı${typeLabel}`;
    try{ playerWon ? Sound.win() : Sound.lose(); }catch(e){}
  } else {
    const name = winner === 'w' ? 'BEYAZ' : 'SİYAH';
    label = `🏆 ${name} KAZANDI!${typeLabel}`;
    try{ Sound.win(); }catch(e){}
  }
  updateStatus(label, 'win');
  G.selected = null; G.legalForSel = [];
  updateControls(); draw();
  try{ await Store.addKaju(50 * wt, 'tavla'); }catch(e){}
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
  // zar atılmadıysa ZAR AT göster
  if(!G.rolled){
    rollBtn.style.display = 'block'; passBtn.style.display = 'none';
  } else {
    rollBtn.style.display = 'none';
    const noMoves = allLegalMoves(G.state).length === 0;
    passBtn.style.display = (noMoves || turnComplete(G.state)) ? 'block' : 'none';
  }
  undoBtn.style.display = (G.undoStack && G.undoStack.length > 0) ? 'block' : 'none';
}

// ════════════ YZ KURULUM ════════════
function showAISetup(root){
  const ov = document.createElement('div');
  ov.className = 'tavla-theme-picker';
  ov.innerHTML = `<div class="ttp-box">
    <div class="ttp-title">🤖 YAPAY ZEKÂ AYARLARI</div>
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
    <button class="ttp-close tas-start">▶ BAŞLA</button>
  </div>`;
  root.appendChild(ov);
  let diff = 'medium', color = 'w';
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
    startGame(root, 'ai', { difficulty: diff, playerColor: color });
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
  // başlangıç ve bitiş piksel konumları
  const start = checkerPixel(from, color, 'from');
  const end = checkerPixel(to, color, 'to');
  if(!start || !end){ if(onDone) onDone(); return; }
  const dur = 280, t0 = performance.now();
  G.movingChecker = { color, x: start.x, y: start.y, r: G.geo.checkerR };
  function frame(now){
    if(!G){ return; }
    const p = Math.min(1, (now - t0) / dur);
    const e = easeOutCubic(p);
    G.movingChecker.x = start.x + (end.x - start.x) * e;
    G.movingChecker.y = start.y + (end.y - start.y) * e;
    draw();
    if(p < 1){ requestAnimationFrame(frame); }
    else { G.movingChecker = null; if(onDone) onDone(); }
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
  const R = g.checkerR;
  // mevcut yığının üstüne yakın konum
  const cnt = Math.abs(G.state.points[idx]) || 0;
  const k = side === 'from' ? Math.max(0, cnt - 1) : cnt;
  const cy = pg.y0 + pg.dir * (R + Math.min(k,4) * R * 1.9 + 2);
  return { x: pg.baseX, y: cy };
}

// ════════════ YARDIMCI ÇİZİM ════════════
function roundRect(ctx, x, y, w, h, r){
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

.tv-game{ flex:1; display:flex; flex-direction:column; padding:10px; max-width:640px; margin:0 auto; width:100%; box-sizing:border-box; }
.tg-top{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.tg-turn{ font-size:15px; font-weight:800; letter-spacing:1px; padding:6px 16px; border-radius:20px; border:1.5px solid rgba(200,165,87,.4); }
.tg-turn.white{ background:rgba(245,239,224,.15); color:#f5efe0; }
.tg-turn.black{ background:rgba(60,80,120,.25); color:#9fc0e8; }
.tv-icon{ width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,.06); border:1px solid rgba(200,165,87,.3); color:#c8a557; font-size:16px; cursor:pointer; }
.tv-icon:active{ transform:scale(.92); }
.tg-status{ text-align:center; font-size:13px; font-weight:700; min-height:0; height:0; overflow:hidden; opacity:0; transition:all .2s; }
.tg-status.show{ height:auto; min-height:22px; opacity:1; margin:2px 0 6px; padding:6px; border-radius:10px; background:rgba(255,255,255,.05); }
.tg-status.win{ background:linear-gradient(90deg, rgba(200,165,87,.25), rgba(255,215,64,.15)); color:#ffd740; font-size:15px; }
.tg-board-wrap{ flex:1; display:flex; align-items:center; justify-content:center; min-height:0; }
.tg-board-wrap canvas{ border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,.6); touch-action:none; }
.tg-controls{ display:flex; gap:8px; justify-content:center; align-items:center; padding:8px 0 4px; }
.tg-btn{ padding:12px 18px; background:rgba(255,255,255,.06); border:1px solid rgba(200,165,87,.3); border-radius:12px; color:#c8a557; font-size:13px; font-weight:700; cursor:pointer; transition:transform .1s; }
.tg-btn:active{ transform:scale(.96); }
.tg-roll{ background:linear-gradient(135deg, #c8a557, #a07d2f); color:#0a1428; font-size:16px; font-weight:800; letter-spacing:1px; padding:14px 32px; box-shadow:0 0 16px rgba(200,165,87,.3); }

.tavla-theme-picker{ position:fixed; inset:0; z-index:9100; display:flex; align-items:center; justify-content:center; background:rgba(5,10,20,.8); backdrop-filter:blur(6px); padding:16px; box-sizing:border-box; }
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
