// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — TETRİS (temiz, kendi içinde kapalı modül)
//
//  Modüler oyun deseni: oyun KENDİ DOM'unu oluşturur (open → overlay
//  kurar, close → kaldırır). Platforma yalnızca Store üzerinden
//  bağlanır (skor/kaju/xp). Eski tangled koddan bağımsız, temiz.
//
//  Dışa açtığı: openTetris() — ana ekrandaki kart bunu çağırır.
// ════════════════════════════════════════════════════════════════
import Store from '../store.js';
import { HEROES, HERO_KEYS, DEFAULT_HERO, resetHeroMods, POWER_CHARGE_LINES } from './tetris-heroes.js';

// Seçili kahraman (oturum boyunca hatırlanır)
let SELECTED_HERO = (function(){ try{ return localStorage.getItem('hero_tetris_char') || DEFAULT_HERO; }catch(e){ return DEFAULT_HERO; } })();

// ── Oyun modları ──
const MODES = {
  solo:     { key:'solo',     label:'SOLO',        icon:'🎮', color:'#00E5FF', desc:'Klasik Tetris' },
  survival: { key:'survival', label:'HAYATTA KAL', icon:'⏱️', color:'#FF5722', desc:'Her 30s hızlanır' },
  sprint:   { key:'sprint',   label:'SPRİNT',      icon:'🏃', color:'#E040FB', desc:'40 satırı en hızlı bitir' },
  zen:      { key:'zen',      label:'ZEN',         icon:'🧘', color:'#69F0AE', desc:'Baskısız, sınırsız' }
};
let SELECTED_MODE = 'solo';
const SPRINT_TARGET = 40;

// ── Tetromino tanımları (neon renkler) ──────────────────────────
const PIECES = {
  I: { color: '#00E5FF', cells: [[0,1],[1,1],[2,1],[3,1]] },
  O: { color: '#FFD740', cells: [[1,0],[2,0],[1,1],[2,1]] },
  T: { color: '#E040FB', cells: [[1,0],[0,1],[1,1],[2,1]] },
  S: { color: '#69F0AE', cells: [[1,0],[2,0],[0,1],[1,1]] },
  Z: { color: '#FF5252', cells: [[0,0],[1,0],[1,1],[2,1]] },
  J: { color: '#42A5F5', cells: [[0,0],[0,1],[1,1],[2,1]] },
  L: { color: '#FF9800', cells: [[2,0],[0,1],[1,1],[2,1]] }
};
const TYPES = Object.keys(PIECES);
const COLS = 10, ROWS = 20;
const LINE_SCORE = [0, 100, 300, 500, 800];   // 0,1,2,3,4 satır

let G = null;   // aktif oyun durumu (tek seferde bir oyun)

// ── 4x4'lük matris döndürme için piece'i matrise çevir ──────────
function toMatrix(cells){
  let maxX = 0, maxY = 0;
  cells.forEach(([x,y]) => { if(x>maxX) maxX=x; if(y>maxY) maxY=y; });
  const n = Math.max(maxX, maxY) + 1;
  const m = Array.from({length:n}, () => Array(n).fill(0));
  cells.forEach(([x,y]) => { m[y][x] = 1; });
  return m;
}
function rotateCW(m){
  const n = m.length;
  const r = Array.from({length:n}, () => Array(n).fill(0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[x][n-1-y] = m[y][x];
  return r;
}
function matrixCells(m){
  const out = [];
  for(let y=0;y<m.length;y++) for(let x=0;x<m[y].length;x++) if(m[y][x]) out.push([x,y]);
  return out;
}

function newBag(){
  const b = TYPES.slice();
  for(let i=b.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [b[i],b[j]]=[b[j],b[i]]; }
  return b;
}

function spawn(){
  if(G.bag.length === 0) G.bag = newBag();
  const type = G.bag.shift();
  if(G.bag.length < 4) G.bag = G.bag.concat(newBag());
  const p = PIECES[type];
  return { type, color: p.color, matrix: toMatrix(p.cells), x: 3, y: 0 };
}

function collides(piece, ox, oy, mat){
  const m = mat || piece.matrix;
  const cells = matrixCells(m);
  for(const [cx,cy] of cells){
    const x = piece.x + cx + ox, y = piece.y + cy + oy;
    if(x < 0 || x >= COLS || y >= ROWS) return true;
    if(y >= 0 && G.board[y][x]) return true;
  }
  return false;
}

function lock(){
  matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
    const x = G.cur.x + cx, y = G.cur.y + cy;
    if(y >= 0) G.board[y][x] = G.cur.color;
  });
  clearLines();
  G.cur = G.next;
  G.next = spawn();
  G.canHold = true;
  if(collides(G.cur, 0, 0)){
    // Nexus enerji kalkanı: ölümden 1 kez kurtul (üst 4 sırayı temizle)
    if(G.nexusShield && !G.shieldUsed){
      G.shieldUsed = true;
      for(let i=0;i<4;i++){ G.board.shift(); G.board.push(Array(COLS).fill(0)); }
      G.cur.y = 0; G.cur.x = 3;
      flash('🛡️ KALKAN!');
      updateHeroBar();
      if(collides(G.cur, 0, 0)) gameOver();
    } else {
      gameOver();
    }
  }
}

function clearLines(){
  let cleared = 0;
  for(let y=ROWS-1;y>=0;y--){
    if(G.board[y].every(c => c)){
      G.board.splice(y,1);
      G.board.unshift(Array(COLS).fill(0));
      cleared++; y++;
    }
  }
  if(cleared > 0){
    G.lines += cleared;
    G.score += Math.round(LINE_SCORE[cleared] * G.level * (G.speedBonus || 1));
    if(cleared === 4) G.tetrisCount++;
    // Hulk: her 20 satırda alt sırayı temizle (sarsıntı)
    if(G.hulkQuake && Math.floor(G.lines/20) > Math.floor((G.lines-cleared)/20)){
      G.board.shift(); G.board.push(Array(COLS).fill(0)); flash('🌋 SARSINTI');
    }
    // Güç şarjı (her satır şarjı doldurur)
    if(!G.powerReady){
      G.charge = Math.min(POWER_CHARGE_LINES, G.charge + cleared);
      if(G.charge >= POWER_CHARGE_LINES){ G.powerReady = true; flash('⚡ GÜÇ HAZIR!'); }
      updatePowerBtn();
    }
    const newLevel = Math.floor(G.lines / 10) + 1;
    if(newLevel > G.level){ G.level = newLevel; flash('SEVİYE ' + G.level); }
    G.dropInterval = Math.max(90, Math.round((G.baseInterval - (G.level-1)*70) * (G.speedMult||1)));
    updateHUD();
  }
}

// ── Hamleler ────────────────────────────────────────────────────
function move(dir){ if(!G.cur || G.over || G.paused) return; if(!collides(G.cur, dir, 0)){ G.cur.x += dir; } }
function softDrop(){
  if(!G.cur || G.over || G.paused) return;
  const step = G.softSpeedMult > 1 ? 2 : 1;   // Flash: 2 hücre
  let moved = false;
  for(let i=0;i<step;i++){ if(!collides(G.cur, 0, 1)){ G.cur.y++; moved = true; } else { if(i===0) lock(); break; } }
  if(moved){ G.score += (G.softBonus ? 2 : 1); updateHUD(); }
  G.dropAcc = 0;
}
function hardDrop(){
  if(!G.cur || G.over || G.paused) return;
  let d = 0; while(!collides(G.cur, 0, 1)){ G.cur.y++; d++; }
  G.score += d * 2 + (G.hardDropBonus || 0); updateHUD(); lock(); G.dropAcc = 0;
}
function rotate(){
  if(!G.cur || G.over || G.paused) return;
  const r = rotateCW(G.cur.matrix);
  for(const k of [0, -1, 1, -2, 2]){   // basit duvar tekmesi
    if(!collides(G.cur, k, 0, r)){
      G.cur.matrix = r; G.cur.x += k;
      if(G.rotBonus){ G.score += G.rotBonus; updateHUD(); }   // Spiderman
      return;
    }
  }
}
function hold(){
  if(!G.cur || G.over || G.paused || !G.canHold) return;
  const curType = G.cur.type;
  if(G.holdType){
    const p = PIECES[G.holdType];
    G.cur = { type: G.holdType, color: p.color, matrix: toMatrix(p.cells), x: 3, y: 0 };
  } else {
    G.cur = G.next; G.next = spawn();
  }
  G.holdType = curType;
  G.canHold = false;
  drawSide();
}

// ── Çizim ───────────────────────────────────────────────────────
function cell(ctx, x, y, size, color, ghost){
  const px = x*size, py = y*size, g = 1;
  if(ghost){
    ctx.strokeStyle = color; ctx.globalAlpha = .35; ctx.lineWidth = 2;
    ctx.strokeRect(px+g+1, py+g+1, size-2*g-2, size-2*g-2); ctx.globalAlpha = 1; return;
  }
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.fillRect(px+g, py+g, size-2*g, size-2*g);
  ctx.shadowBlur = 0;
  // iç parlama
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fillRect(px+g, py+g, size-2*g, Math.max(2, size*0.18));
}

function drawBoard(){
  const ctx = G.ctx, s = G.cellSize;
  ctx.clearRect(0,0,G.canvas.width,G.canvas.height);
  // ızgara zemin
  ctx.fillStyle = 'rgba(255,255,255,.015)';
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if((x+y)%2===0){ ctx.fillRect(x*s, y*s, s, s); }
  }
  // yerleşmiş bloklar
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if(G.board[y][x]) cell(ctx, x, y, s, G.board[y][x]);
  }
  // hayalet (düşüş yeri)
  if(G.cur && !G.over){
    let gy = 0; while(!collides(G.cur, 0, gy+1)) gy++;
    matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
      const x = G.cur.x+cx, y = G.cur.y+cy+gy;
      if(y >= 0) cell(ctx, x, y, s, G.cur.color, true);
    });
    // aktif parça
    matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
      const x = G.cur.x+cx, y = G.cur.y+cy;
      if(y >= 0) cell(ctx, x, y, s, G.cur.color);
    });
  }
}

function drawMini(canvas, type){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!type) return;
  const p = PIECES[type], cells = p.cells;
  let maxX=0,maxY=0; cells.forEach(([x,y])=>{if(x>maxX)maxX=x;if(y>maxY)maxY=y;});
  const w=maxX+1, h=maxY+1, s = Math.floor(Math.min(canvas.width/(w+0.5), canvas.height/(h+0.5)));
  const ox = (canvas.width - w*s)/2, oy = (canvas.height - h*s)/2;
  cells.forEach(([x,y]) => {
    ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.fillRect(ox+x*s+1, oy+y*s+1, s-2, s-2); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(ox+x*s+1, oy+y*s+1, s-2, Math.max(2,s*0.18));
  });
}
function drawSide(){ drawMini(G.nextCv, G.next && G.next.type); drawMini(G.holdCv, G.holdType); }

// Oyun içi kahraman göstergesi (üst barda ikon + kalkan durumu)
function updateHeroBar(){
  if(!G || !G.el.heroBadge) return;
  const h = G.hero || HEROES[SELECTED_HERO];
  G.el.heroBadge.textContent = h.icon;
  G.el.heroBadge.style.borderColor = h.color;
  if(G.el.shieldDot) G.el.shieldDot.style.display = (G.nexusShield && !G.shieldUsed) ? 'inline' : 'none';
}

// "⚡ GÜÇ" butonunu güncelle (şarj % ve hazır durumu)
function updatePowerBtn(){
  if(!G || !G.el.powerBtn) return;
  const btn = G.el.powerBtn, h = G.hero;
  const pct = Math.round((G.charge / POWER_CHARGE_LINES) * 100);
  if(G.powerReady){
    btn.classList.add('ready');
    btn.style.setProperty('--pcol', h.color);
    btn.innerHTML = '<span class="pw-ico">' + h.power.icon + '</span><span class="pw-txt">' + h.power.name + '</span>';
    btn.style.setProperty('--fill', '100%');
  } else {
    btn.classList.remove('ready');
    btn.innerHTML = '<span class="pw-ico">' + h.power.icon + '</span><span class="pw-txt">GÜÇ %' + pct + '</span>';
    btn.style.setProperty('--fill', pct + '%');
  }
}

// Gücü kullan
function usePower(){
  if(!G || G.over || G.paused || !G.powerReady) return;
  const h = G.hero;
  const api = {
    board: G.board, COLS, ROWS,
    emptyRow: () => Array(COLS).fill(0),
    addScore: (n) => { G.score += Math.round(n || 0); },
    slowTime: (ms) => { G.slowUntil = performance.now() + ms; }
  };
  let msg = '';
  try{ msg = h.power.run(api) || h.power.name; }catch(e){ console.warn('[tetris] power', e); msg = h.power.name; }
  // Şarjı sıfırla
  G.charge = 0; G.powerReady = false;
  updatePowerBtn(); updateHUD();
  powerFX(h);
  flash(msg);
}

// Ekran efekti — kahraman rengiyle parlama dalgası
function powerFX(h){
  if(!G || !G.el.fxLayer) return;
  const fx = G.el.fxLayer;
  fx.style.setProperty('--fxcol', h.color);
  fx.classList.remove('burst'); void fx.offsetWidth; fx.classList.add('burst');
}

// ── Karakter seçim ekranı ───────────────────────────────────────
function buildHeroSelect(onPick){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay';
  let cards = '';
  HERO_KEYS.forEach(key => {
    const h = HEROES[key];
    const sel = (key === SELECTED_HERO) ? ' selected' : '';
    cards += `
      <button class="hero-card${sel}" data-hero="${key}" style="--hc:${h.color}">
        <span class="hc-icon">${h.icon}</span>
        <span class="hc-name">${h.name}</span>
        <span class="hc-passive">${h.passive}</span>
      </button>`;
  });
  ov.innerHTML = `
    <div class="hs-top">
      <button class="t-icon" data-act="back">✕</button>
      <div class="hs-title">KAHRAMANINI SEÇ</div>
      <span style="width:38px"></span>
    </div>
    <div class="hs-sub">Her kahramanın özel pasif gücü var</div>
    <div class="hero-grid">${cards}</div>
    <button class="hs-play" data-act="play">▶ OYNA</button>`;
  document.body.appendChild(ov);

  function refresh(){
    ov.querySelectorAll('.hero-card').forEach(c => c.classList.toggle('selected', c.dataset.hero === SELECTED_HERO));
  }
  ov.querySelectorAll('.hero-card').forEach(card => {
    card.addEventListener('click', () => {
      SELECTED_HERO = card.dataset.hero;
      try{ localStorage.setItem('hero_tetris_char', SELECTED_HERO); }catch(e){}
      refresh();
    });
  });
  ov.querySelector('[data-act="play"]').addEventListener('click', () => { ov.remove(); onPick(); });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => { ov.remove(); });
  return ov;
}

function updateHUD(){
  G.el.score.textContent = G.score.toLocaleString('tr-TR');
  G.el.level.textContent = G.level;
  G.el.lines.textContent = G.lines;
}

function flash(text){
  const f = G.el.flash; f.textContent = text; f.classList.remove('show');
  void f.offsetWidth; f.classList.add('show');
}

// ── Oyun döngüsü ────────────────────────────────────────────────
function loop(ts){
  if(!G || G.over) return;
  if(!G.last) G.last = ts;
  const dt = ts - G.last; G.last = ts;
  if(!G.paused){
    G.dropAcc += dt;
    // Flash "Zaman Yavaşlat" aktifse düşme aralığını 4x uzat
    const slowed = (G.slowUntil && ts < G.slowUntil);
    const interval = slowed ? G.dropInterval * 4 : G.dropInterval;
    if(G.dropAcc >= interval){ G.dropAcc = 0; if(!collides(G.cur, 0, 1)){ G.cur.y++; } else lock(); }
    drawBoard(); drawSide();
  }
  G.raf = requestAnimationFrame(loop);
}

async function gameOver(){
  G.over = true;
  cancelAnimationFrame(G.raf);
  const score = G.score;
  // Ödüller (modest, pozitif)
  const kaju = Math.min(Math.floor(score / 200), 200);
  const xp   = Math.floor(score / 50);
  let isRecord = false;
  try{
    isRecord = await Store.addScore('tetris', score);
    if(kaju > 0) await Store.addKaju(kaju, 'tetris');
    if(xp > 0)   await Store.addXP(xp);
  }catch(e){ console.warn('[tetris] ödül', e); }

  const ov = G.el.gameover;
  ov.querySelector('.go-score').textContent = score.toLocaleString('tr-TR');
  ov.querySelector('.go-lines').textContent = G.lines;
  ov.querySelector('.go-reward').textContent = (kaju>0?('+'+kaju+' 🥜'):'') + (xp>0?('  +'+xp+' XP'):'');
  ov.querySelector('.go-record').style.display = isRecord ? 'block' : 'none';
  ov.classList.add('show');
}

// ── DOM kurulumu ────────────────────────────────────────────────
function build(){
  const root = document.createElement('div');
  root.className = 'tetris-overlay';
  root.innerHTML = `
    <div class="tetris-topbar">
      <button class="t-icon" data-act="exit">✕</button>
      <div class="t-title">HEROTETRIS <span class="t-herobadge"></span><span class="t-shielddot" style="display:none">🛡️</span></div>
      <button class="t-icon" data-act="pause">⏸</button>
    </div>
    <div class="tetris-stage">
      <div class="tetris-side">
        <div class="t-panel"><div class="t-plabel">SKOR</div><div class="t-pval t-score">0</div></div>
        <div class="t-panel"><div class="t-plabel">SEVİYE</div><div class="t-pval t-level">1</div></div>
        <div class="t-panel"><div class="t-plabel">SATIR</div><div class="t-pval t-lines">0</div></div>
        <div class="t-panel"><div class="t-plabel">SONRAKİ</div><canvas class="t-next" width="84" height="64"></canvas></div>
        <div class="t-panel"><div class="t-plabel">TUT</div><canvas class="t-hold" width="84" height="64"></canvas></div>
      </div>
      <div class="tetris-board-wrap">
        <canvas class="tetris-canvas"></canvas>
        <div class="t-fxlayer"></div>
        <div class="t-flash"></div>
        <div class="tetris-gameover">
          <div class="go-title">OYUN BİTTİ</div>
          <div class="go-record">🏆 YENİ REKOR!</div>
          <div class="go-row">Skor: <b class="go-score">0</b></div>
          <div class="go-row">Satır: <b class="go-lines">0</b></div>
          <div class="go-reward-lbl"><span class="go-reward"></span></div>
          <div class="go-btns">
            <button class="go-btn primary" data-act="restart">🔄 TEKRAR</button>
            <button class="go-btn" data-act="exit">🏠 MENÜ</button>
          </div>
        </div>
        <div class="tetris-pause">
          <div class="pause-title">DURAKLATILDI</div>
          <button class="go-btn primary" data-act="resume">▶ DEVAM</button>
        </div>
      </div>
    </div>
    <button class="t-power" data-act="power"><span class="pw-ico">⚡</span><span class="pw-txt">GÜÇ %0</span></button>
    <div class="tetris-controls">
      <button class="t-ctrl" data-ctrl="left">◀</button>
      <button class="t-ctrl" data-ctrl="rotate">↻</button>
      <button class="t-ctrl" data-ctrl="right">▶</button>
      <button class="t-ctrl" data-ctrl="down">▼</button>
      <button class="t-ctrl" data-ctrl="drop">⤓</button>
      <button class="t-ctrl" data-ctrl="hold">⇄</button>
    </div>`;
  document.body.appendChild(root);
  return root;
}

function fitCanvas(){
  const wrap = G.root.querySelector('.tetris-board-wrap');
  // Genişlik henüz 0 ise (overlay yeni eklendi) ekran genişliğinden tahmin et
  let avail = wrap.clientWidth;
  if(!avail || avail < 40){
    const sideW = 92 + 10;   // yan panel + boşluk
    avail = Math.max(120, (window.innerWidth || 360) - sideW - 20);
  }
  let cs = Math.floor(avail / COLS);
  // Yükseklik taşmasın diye dikey sınır da uygula
  const availH = (window.innerHeight || 640) - 180;
  const csH = Math.floor(availH / ROWS);
  if(csH > 6 && csH < cs) cs = csH;
  if(cs < 8) cs = 8;
  G.cellSize = cs;
  const dpr = window.devicePixelRatio || 1;
  G.canvas.width  = COLS * cs * dpr;
  G.canvas.height = ROWS * cs * dpr;
  G.canvas.style.width  = (COLS*cs) + 'px';
  G.canvas.style.height = (ROWS*cs) + 'px';
  G.ctx.setTransform(dpr,0,0,dpr,0,0);
}

function bindControls(){
  const press = (ctrl) => {
    if(ctrl==='left') move(-1);
    else if(ctrl==='right') move(1);
    else if(ctrl==='rotate') rotate();
    else if(ctrl==='down') softDrop();
    else if(ctrl==='drop') hardDrop();
    else if(ctrl==='hold') hold();
  };
  G.root.querySelectorAll('[data-ctrl]').forEach(btn => {
    const ctrl = btn.dataset.ctrl;
    let timer = null;
    const start = (e) => {
      e.preventDefault();
      press(ctrl);
      if(ctrl==='left' || ctrl==='right' || ctrl==='down'){
        timer = setInterval(() => press(ctrl), 90);   // basılı tut → tekrar
      }
    };
    const stop = () => { if(timer){ clearInterval(timer); timer=null; } };
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  });

  G.root.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.act;
      if(a==='exit') close();
      else if(a==='pause') togglePause(true);
      else if(a==='resume') togglePause(false);
      else if(a==='restart') restart();
      else if(a==='power') usePower();
    });
  });

  // Klavye (masaüstü testte kolaylık)
  G.keyHandler = (e) => {
    if(!G) return;
    const k = e.key;
    if(k==='ArrowLeft') move(-1);
    else if(k==='ArrowRight') move(1);
    else if(k==='ArrowUp'||k==='x'||k==='X') rotate();
    else if(k==='ArrowDown') softDrop();
    else if(k===' '){ e.preventDefault(); hardDrop(); }
    else if(k==='Shift'||k==='c'||k==='C') hold();
    else if(k==='e'||k==='E') usePower();
    else if(k==='p'||k==='P') togglePause(!G.paused);
  };
  window.addEventListener('keydown', G.keyHandler);
}

function togglePause(on){
  if(!G || G.over) return;
  G.paused = on;
  G.root.querySelector('.tetris-pause').classList.toggle('show', on);
  G.last = 0;
}

function startGame(){
  G.board = Array.from({length:ROWS}, () => Array(COLS).fill(0));
  G.bag = newBag();
  G.cur = spawn();
  G.next = spawn();
  G.holdType = null; G.canHold = true;
  G.score = 0; G.level = 1; G.lines = 0; G.tetrisCount = 0;
  G.dropAcc = 0; G.last = 0;
  G.over = false; G.paused = false;

  // ── Kahraman pasif güçleri ──
  resetHeroMods(G);
  G.hero = HEROES[SELECTED_HERO] || HEROES[DEFAULT_HERO];
  try{ G.hero.apply(G); }catch(e){ console.warn('[tetris] hero apply', e); }
  G.baseInterval = 800;
  G.dropInterval = Math.round(G.baseInterval * G.speedMult);
  G.shieldUsed = false;   // Nexus kalkanı

  // ── Güç şarj sistemi ──
  G.power = G.hero.power;
  G.charge = 0;           // 0..POWER_CHARGE_LINES
  G.powerReady = false;
  G.slowUntil = 0;        // Flash zaman yavaşlatma bitiş (ms timestamp)
  updatePowerBtn();

  fitCanvas(); updateHUD(); drawSide(); updateHeroBar();
  G.el.gameover.classList.remove('show');
  G.el.pause.classList.remove('show');
  cancelAnimationFrame(G.raf);
  G.raf = requestAnimationFrame(loop);
}
function restart(){ startGame(); }

function close(){
  if(!G) return;
  cancelAnimationFrame(G.raf);
  window.removeEventListener('keydown', G.keyHandler);
  window.removeEventListener('resize', G.resizeHandler);
  G.root.remove();
  G = null;
}

function launchGame(){
  if(G) return;
  const root = build();
  const canvas = root.querySelector('.tetris-canvas');
  G = {
    root, canvas, ctx: canvas.getContext('2d'),
    nextCv: root.querySelector('.t-next'),
    holdCv: root.querySelector('.t-hold'),
    el: {
      score: root.querySelector('.t-score'),
      level: root.querySelector('.t-level'),
      lines: root.querySelector('.t-lines'),
      flash: root.querySelector('.t-flash'),
      gameover: root.querySelector('.tetris-gameover'),
      pause: root.querySelector('.tetris-pause'),
      heroBadge: root.querySelector('.t-herobadge'),
      shieldDot: root.querySelector('.t-shielddot'),
      powerBtn: root.querySelector('.t-power'),
      fxLayer: root.querySelector('.t-fxlayer')
    },
    raf: 0
  };
  G.resizeHandler = () => { if(G){ fitCanvas(); drawBoard(); } };
  window.addEventListener('resize', G.resizeHandler);
  bindControls();
  startGame();
}


// ── CSS'i kendi icinde enjekte et (ayri dosyaya/onbellege bagimli degil) ──
function injectCSS(){
  if(document.getElementById('hero-tetris-css')) return;
  var s = document.createElement('style');
  s.id = 'hero-tetris-css';
  s.textContent = `/* ════════════════════════════════════════════════════════════════
   Hero Oyun Portalı — TETRİS görünümü (neon)
   ════════════════════════════════════════════════════════════════ */
.tetris-overlay{
  position: fixed; inset: 0; z-index: 1000;
  background:
    radial-gradient(circle at 30% 0%, rgba(0,229,255,.10), transparent 50%),
    radial-gradient(circle at 80% 100%, rgba(224,64,251,.08), transparent 50%),
    #05050b;
  display: flex; flex-direction: column;
  padding: calc(8px + env(safe-area-inset-top,0px)) 10px calc(10px + env(safe-area-inset-bottom,0px));
  animation: fadeUp .25s ease both;
}

.tetris-topbar{ display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.tetris-topbar .t-title{ font-family: var(--font-display); font-weight: 700; font-size: 18px; letter-spacing: 3px; color: var(--cyan); text-shadow: var(--glow-cyan); }
.t-icon{ width: 38px; height: 38px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim); font-size: 16px; }

.tetris-stage{ flex: 1; display: flex; gap: 10px; min-height: 0; align-items: stretch; }

/* Yan paneller */
.tetris-side{ width: 92px; flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px; }
.t-panel{ background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 7px 8px; text-align: center; }
.t-plabel{ font-size: 8px; letter-spacing: 1.5px; color: var(--text-mute); font-weight: 700; }
.t-pval{ font-family: var(--font-display); font-weight: 700; font-size: 17px; color: #fff; margin-top: 2px; }
.t-pval.t-score{ color: var(--gold); text-shadow: var(--glow-gold); font-size: 15px; }
.t-next, .t-hold{ display: block; margin: 3px auto 0; }

/* Tahta */
.tetris-board-wrap{ flex: 1; display: flex; align-items: flex-start; justify-content: center; position: relative; min-width: 0; }
.tetris-canvas{ border: 1px solid var(--border-cyan); border-radius: 8px; background: rgba(0,0,0,.35); box-shadow: 0 0 30px rgba(0,229,255,.12) inset; }

/* Seviye flash */
.t-flash{
  position: absolute; top: 30%; left: 50%; transform: translateX(-50%);
  font-family: var(--font-display); font-weight: 700; font-size: 26px; letter-spacing: 2px;
  color: var(--cyan); text-shadow: var(--glow-cyan); opacity: 0; pointer-events: none; white-space: nowrap;
}
.t-flash.show{ animation: tflash 1s ease both; }
@keyframes tflash{ 0%{ opacity:0; transform: translateX(-50%) scale(.7); } 25%{ opacity:1; transform: translateX(-50%) scale(1.05); } 100%{ opacity:0; transform: translateX(-50%) scale(1); } }

/* Oyun bitti / duraklat örtüleri */
.tetris-gameover, .tetris-pause{
  position: absolute; inset: 0; display: none; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(5,5,11,.88); backdrop-filter: blur(6px); border-radius: 8px; gap: 8px; text-align: center; padding: 20px;
}
.tetris-gameover.show, .tetris-pause.show{ display: flex; animation: fadeUp .25s ease both; }
.go-title, .pause-title{ font-family: var(--font-display); font-weight: 700; font-size: 26px; letter-spacing: 3px; color: var(--pink); text-shadow: var(--glow-pink); }
.go-record{ display: none; font-weight: 900; font-size: 13px; color: var(--gold); text-shadow: var(--glow-gold); letter-spacing: 1px; }
.go-row{ font-size: 13px; color: var(--text-dim); }
.go-row b{ color: #fff; font-size: 18px; }
.go-reward-lbl{ min-height: 18px; }
.go-reward{ font-weight: 800; font-size: 13px; color: var(--green); }
.go-btns{ display: flex; gap: 10px; margin-top: 10px; }
.go-btn{ background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim); border-radius: var(--r-md); padding: 11px 18px; font-weight: 800; font-size: 12px; }
.go-btn.primary{ background: linear-gradient(135deg, var(--cyan), #39C0FF); color: #001018; box-shadow: var(--glow-cyan); border: none; }

/* Kontrol pad */
.tetris-controls{
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; margin-top: 10px;
}
.t-ctrl{
  height: 56px; border-radius: var(--r-md);
  background: var(--surface-2); border: 1px solid var(--border-cyan); color: var(--cyan);
  font-size: 22px; font-weight: 700; touch-action: none; user-select: none;
  display: flex; align-items: center; justify-content: center;
}
.t-ctrl:active{ background: rgba(0,229,255,.15); transform: scale(.95); }
.t-ctrl[data-ctrl="drop"]{ color: var(--pink); border-color: rgba(255,64,129,.4); }
.t-ctrl[data-ctrl="hold"]{ color: var(--gold); border-color: rgba(255,215,64,.4); }
.t-ctrl[data-ctrl="rotate"]{ color: var(--magenta); border-color: rgba(224,64,251,.4); }

@media (max-height: 680px){
  .t-ctrl{ height: 48px; font-size: 19px; }
  .t-panel{ padding: 5px 6px; }
  .t-pval{ font-size: 15px; }
}

/* ════════ HeroTetris — Karakter seçim ekranı ════════ */
.hero-select-overlay{
  position: fixed; inset: 0; z-index: 1001;
  background:
    radial-gradient(circle at 25% 5%, rgba(0,229,255,.12), transparent 45%),
    radial-gradient(circle at 80% 95%, rgba(255,64,129,.10), transparent 45%),
    #05050b;
  display: flex; flex-direction: column;
  padding: calc(8px + env(safe-area-inset-top,0px)) 14px calc(12px + env(safe-area-inset-bottom,0px));
  animation: fadeUp .25s ease both;
}
.hs-top{ display: flex; align-items: center; justify-content: space-between; }
.hs-title{ font-family: var(--font-display); font-weight: 700; font-size: 17px; letter-spacing: 2px; color: var(--cyan); text-shadow: var(--glow-cyan); }
.hs-sub{ text-align: center; font-size: 9px; letter-spacing: 2px; color: var(--text-mute); margin: 4px 0 12px; }
.hero-grid{ flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; align-content: start; padding-bottom: 8px; }
.hero-card{
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 11px 7px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
  transition: transform .12s, border-color .15s, box-shadow .15s; min-height: 104px;
}
.hero-card:active{ transform: scale(.96); }
.hero-card.selected{ border-color: var(--hc); box-shadow: 0 0 16px color-mix(in srgb, var(--hc) 40%, transparent), inset 0 0 20px color-mix(in srgb, var(--hc) 8%, transparent); }
.hc-icon{ font-size: 30px; filter: drop-shadow(0 0 8px var(--hc)); }
.hc-name{ font-family: var(--font-display); font-weight: 700; font-size: 9px; letter-spacing: .5px; color: var(--hc); }
.hc-passive{ font-size: 7px; line-height: 1.4; color: var(--text-mute); }
.hs-play{
  margin-top: 10px; width: 100%; padding: 15px;
  background: linear-gradient(135deg, var(--cyan), #39C0FF); color: #001018;
  font-family: var(--font-display); font-weight: 700; font-size: 16px; letter-spacing: 2px;
  border-radius: var(--r-lg); box-shadow: var(--glow-cyan);
}

/* Oyun içi kahraman rozeti */
.t-herobadge{ display: inline-block; font-size: 15px; margin-left: 4px; padding: 0 4px; border-left: 2px solid var(--cyan); }
.t-shielddot{ font-size: 12px; margin-left: 2px; }

/* ⚡ GÜÇ butonu (büyük, şarj göstergeli) */
.t-power{
  --fill: 0%; --pcol: #FFD740;
  width: 100%; margin-top: 8px; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 50px; border-radius: var(--r-lg);
  border: 1.5px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04); color: var(--text-mute);
  font-weight: 800; letter-spacing: 1px; transition: color .2s;
}
/* şarj dolum çubuğu (arka plan) */
.t-power::before{
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: var(--fill);
  background: linear-gradient(90deg, color-mix(in srgb, var(--pcol) 35%, transparent), color-mix(in srgb, var(--pcol) 15%, transparent));
  transition: width .35s ease; z-index: 0;
}
.t-power .pw-ico, .t-power .pw-txt{ position: relative; z-index: 1; }
.t-power .pw-ico{ font-size: 20px; filter: grayscale(.6); }
.t-power.ready{
  color: #fff; border-color: var(--pcol);
  box-shadow: 0 0 18px color-mix(in srgb, var(--pcol) 50%, transparent), inset 0 0 18px color-mix(in srgb, var(--pcol) 12%, transparent);
  animation: powerPulse 1.1s ease-in-out infinite;
}
.t-power.ready .pw-ico{ filter: none; }
.t-power.ready .pw-txt{ font-family: var(--font-display); letter-spacing: 1.5px; }
@keyframes powerPulse{ 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.015); } }
.t-power:active{ transform: scale(.98); }

/* Güç efekti — kahraman rengiyle parlama dalgası */
.t-fxlayer{
  --fxcol: #FFD740;
  position: absolute; inset: 0; pointer-events: none; z-index: 5; opacity: 0; border-radius: 8px;
}
.t-fxlayer.burst{ animation: fxBurst .6s ease-out; }
@keyframes fxBurst{
  0%{ opacity: 0; box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--fxcol) 80%, transparent); background: color-mix(in srgb, var(--fxcol) 35%, transparent); }
  30%{ opacity: 1; box-shadow: inset 0 0 60px 10px color-mix(in srgb, var(--fxcol) 70%, transparent); }
  100%{ opacity: 0; box-shadow: inset 0 0 0 0 transparent; background: transparent; }
}

`;
  document.head.appendChild(s);
}

export function openTetris(){
  injectCSS();
  if(G) return;   // oyun zaten açık
  if(document.querySelector('.hero-select-overlay')) return;  // seçim ekranı açık
  // Önce kahraman seçim ekranı, "OYNA"ya basınca oyun başlar
  buildHeroSelect(() => launchGame());
}

export default openTetris;
