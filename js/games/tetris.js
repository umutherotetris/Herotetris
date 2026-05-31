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
import { HEROES, HERO_KEYS, DEFAULT_HERO, resetHeroMods } from './tetris-heroes.js';

// Seçili kahraman (oturum boyunca hatırlanır)
let SELECTED_HERO = (function(){ try{ return localStorage.getItem('hero_tetris_char') || DEFAULT_HERO; }catch(e){ return DEFAULT_HERO; } })();

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
    if(G.dropAcc >= G.dropInterval){ G.dropAcc = 0; if(!collides(G.cur, 0, 1)){ G.cur.y++; } else lock(); }
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
      shieldDot: root.querySelector('.t-shielddot')
    },
    raf: 0
  };
  G.resizeHandler = () => { if(G){ fitCanvas(); drawBoard(); } };
  window.addEventListener('resize', G.resizeHandler);
  bindControls();
  startGame();
}

export function openTetris(){
  if(G) return;   // oyun zaten açık
  if(document.querySelector('.hero-select-overlay')) return;  // seçim ekranı açık
  // Önce kahraman seçim ekranı, "OYNA"ya basınca oyun başlar
  buildHeroSelect(() => launchGame());
}

export default openTetris;
