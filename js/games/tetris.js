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
import { HEROES, HERO_KEYS, DEFAULT_HERO, resetHeroMods, POWER_CHARGE_LINES, isHeroUnlocked, unlockText } from './tetris-heroes.js';
import { GEMS, rollGem, GEM_MAX, GEM_BASE_CHANCE, FUSION_COUNT } from './tetris-gems.js';
import Sound from './tetris-audio.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME, drawThemedCell } from './tetris-themes.js';
import { heroAvatar } from './tetris-avatars.js';
import { WORLDS, getProgress, isWorldUnlocked, completeWorld, calcStars, getWorld } from './tetris-adventure.js';
import { MP } from './tetris-mp.js';

// Avatar modülünün renkleri okuyabilmesi için kahraman renklerini global'e yaz
try{
  window.__HERO_COLORS = {};
  HERO_KEYS.forEach(k => { window.__HERO_COLORS[k] = HEROES[k].color; });
}catch(e){}

// Seçili tema (oturum boyunca hatırlanır)
let SELECTED_THEME = (function(){ try{ return localStorage.getItem('hero_tetris_theme') || DEFAULT_THEME; }catch(e){ return DEFAULT_THEME; } })();

// Seçili kahraman (oturum boyunca hatırlanır)
let SELECTED_HERO = (function(){ try{ return localStorage.getItem('hero_tetris_char') || DEFAULT_HERO; }catch(e){ return DEFAULT_HERO; } })();

// ── Oyun modları ──
const MODES = {
  solo:     { key:'solo',     label:'SOLO',        icon:'🎮', color:'#00E5FF', desc:'Klasik Tetris' },
  survival: { key:'survival', label:'HAYATTA KAL', icon:'⏱️', color:'#FF5722', desc:'Her 30s hızlanır' },
  sprint:   { key:'sprint',   label:'SPRİNT',      icon:'🏃', color:'#E040FB', desc:'40 satırı en hızlı bitir' },
  zen:      { key:'zen',      label:'ZEN',         icon:'🧘', color:'#69F0AE', desc:'Baskısız, sınırsız' },
  adventure:{ key:'adventure',label:'MACERA',      icon:'🗺️', color:'#FFB300', desc:'8 dünya, boss savaşları' },
  versus:   { key:'versus',   label:'ÇOK OYUNCU',  icon:'🌐', color:'#00BCD4', desc:'Oda kur, arkadaşınla yarış' }
};
let SELECTED_MODE = (function(){ try{ return localStorage.getItem('hero_tetris_mode') || 'solo'; }catch(e){ return 'solo'; } })();
let ADVENTURE_WORLD = null;   // Macera modunda seçili dünya id'si
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
function rotateCCW(m){
  const n = m.length;
  const r = Array.from({length:n}, () => Array(n).fill(0));
  for(let y=0;y<n;y++) for(let x=0;x<n;x++) r[n-1-x][y] = m[y][x];
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

// Kuyruğu önizleme sayısı kadar dolu tut
function fillQueue(){
  const need = (G.previewCount || 1) + 1;   // +1 buffer
  while(G.queue.length < need) G.queue.push(spawn());
}
// Kuyruktan sıradaki taşı al, kuyruğu yeniden doldur
function nextFromQueue(){
  const piece = G.queue.shift();
  fillQueue();
  return piece;
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
  Sound.lock();
  matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
    const x = G.cur.x + cx, y = G.cur.y + cy;
    if(y >= 0) G.board[y][x] = G.cur.color;
  });
  clearLines();
  // Gem düşürme: her parça konunca şansla bir gem envantere
  maybeDropGem();
  // Versus: bekleyen çöp sıralarını uygula (alttan ekle, üstten kaydır)
  if(G.versus && G.pendingGarbage > 0){
    applyGarbage(G.pendingGarbage);
    G.pendingGarbage = 0;
  }
  G.cur = nextFromQueue();
  G.canHold = true;
  if(collides(G.cur, 0, 0)){
    // Nexus enerji kalkanı: ölümden 1 kez kurtul (üst 4 sırayı temizle)
    if(G.nexusShield && !G.shieldUsed){
      G.shieldUsed = true;
      for(let i=0;i<4;i++){ G.board.shift(); G.board.push(Array(COLS).fill(0)); }
      G.cur.y = 0; G.cur.x = 3;
      flash('🛡️ KALKAN!');
      Sound.shield(); screenShake(10);
      updateHeroBar();
      if(collides(G.cur, 0, 0)) gameOver();
    } else {
      gameOver();
    }
  }
}

// Parça konunca gem düşür (kahraman gemMult çarpanıyla)
function maybeDropGem(){
  if(!G || G.gems.length >= GEM_MAX) return;
  const chance = GEM_BASE_CHANCE * (G.gemMult || 1);
  if(Math.random() < chance){
    const gem = rollGem(SELECTED_HERO);
    G.gems.push(gem);
    Sound.gem();
    updateGemBtn();
    checkFusion();
  }
}

// Fusion: aynı gem'den FUSION_COUNT (3) tane → ULTRA güç
function checkFusion(){
  if(!G || G.gems.length < FUSION_COUNT) return;
  const counts = {};
  G.gems.forEach(g => { counts[g.id] = (counts[g.id] || 0) + 1; });
  for(const id in counts){
    if(counts[id] >= FUSION_COUNT){
      // 3 tanesini kaldır
      let removed = 0;
      G.gems = G.gems.filter(g => { if(g.id === id && removed < FUSION_COUNT){ removed++; return false; } return true; });
      // ULTRA: alt yarıyı temizle + büyük puan + efekt
      let n = 0;
      for(let r = Math.floor(ROWS/2); r < ROWS; r++){ if(G.board[r].some(c=>c)) n++; G.board[r] = Array(COLS).fill(0); }
      G.score += n*100 + 1000;
      const gem = GEMS.find(g => g.id === id);
      powerFX(gem || { color:'#FFD740' });
      Sound.fusion(); screenShake(14);
      flash('💥 ' + (gem ? gem.nm : '') + ' FUSION!');
      updateGemBtn(); updateHUD();
      break;
    }
  }
}

function clearLines(){
  let cleared = 0;
  const clearedRows = [];
  for(let y=ROWS-1;y>=0;y--){
    if(G.board[y].every(c => c)){
      clearedRows.push(y);
      G.board.splice(y,1);
      G.board.unshift(Array(COLS).fill(0));
      cleared++; y++;
    }
  }
  if(cleared > 0){
    // Görsel + ses
    spawnLineParticles(clearedRows, cleared);
    screenShake(cleared >= 4 ? 10 : 5);
    if(cleared >= 4) Sound.tetris(); else Sound.line(cleared);

    G.lines += cleared;
    G.score += Math.round(LINE_SCORE[cleared] * G.level * (G.speedBonus || 1));
    if(cleared === 4){ G.tetrisCount++; flash('🔥 TETRİS!'); }
    // Versus: rakibe çöp gönder (2 satır=1, 3=2, 4=4 çöp sırası)
    if(G.versus && MP.connected){
      const garbageMap = { 1:0, 2:1, 3:2, 4:4 };
      const g = garbageMap[cleared] || 0;
      if(g > 0) MP.send({ type:'garbage', rows:g });
      sendVersusState();
    }
    // Hulk: her 20 satırda alt sırayı temizle (sarsıntı)
    if(G.hulkQuake && Math.floor(G.lines/20) > Math.floor((G.lines-cleared)/20)){
      G.board.shift(); G.board.push(Array(COLS).fill(0)); flash('🌋 SARSINTI'); screenShake(8);
    }
    // Güç şarjı (her satır şarjı doldurur)
    if(!G.powerReady){
      G.charge = Math.min(POWER_CHARGE_LINES, G.charge + cleared);
      if(G.charge >= POWER_CHARGE_LINES){ G.powerReady = true; flash('⚡ GÜÇ HAZIR!'); }
      updatePowerBtn();
    }
    const newLevel = Math.floor(G.lines / 10) + 1;
    if(newLevel > G.level){ G.level = newLevel; Sound.level(); if(G.mode!=='zen' && G.mode!=='survival') flash('SEVİYE ' + G.level); }
    // Zen ve Survival kendi hızını yönetir; Solo/Sprint seviyeyle hızlanır
    if(G.mode === 'solo' || G.mode === 'sprint'){
      G.dropInterval = Math.max(90, Math.round((G.baseInterval - (G.level-1)*70) * (G.speedMult||1)));
    }
    // Sprint: 40 satır → kazandın
    if(G.mode === 'sprint' && G.lines >= SPRINT_TARGET && !G.won){
      G.won = true;
      sprintWin();
    }
    // Macera: dünya hedefine ulaşınca → bölüm tamamlandı
    if(G.mode === 'adventure' && G.advTarget && G.lines >= G.advTarget && !G.won){
      G.won = true;
      adventureWin();
    }
    updateHUD();
  }
}

// ── Hamleler ────────────────────────────────────────────────────
function move(dir){ if(!G.cur || G.over || G.paused) return; if(!collides(G.cur, dir, 0)){ G.cur.x += dir; Sound.move(); } }
function softDrop(){
  if(!G.cur || G.over || G.paused) return;
  const step = G.softSpeedMult > 1 ? 2 : 1;   // Flash: 2 hücre
  let moved = false;
  for(let i=0;i<step;i++){ if(!collides(G.cur, 0, 1)){ G.cur.y++; moved = true; } else { if(i===0) lock(); break; } }
  if(moved){ G.score += (G.softBonus ? 2 : 1); Sound.soft(); updateHUD(); }
  G.dropAcc = 0;
}
function hardDrop(){
  if(!G.cur || G.over || G.paused) return;
  let d = 0; while(!collides(G.cur, 0, 1)){ G.cur.y++; d++; }
  G.score += d * 2 + (G.hardDropBonus || 0); Sound.hard(); updateHUD(); lock(); G.dropAcc = 0;
}
function rotate(dir){
  if(!G.cur || G.over || G.paused) return;
  const r = (dir === 'ccw') ? rotateCCW(G.cur.matrix) : rotateCW(G.cur.matrix);
  for(const k of [0, -1, 1, -2, 2]){   // basit duvar tekmesi
    if(!collides(G.cur, k, 0, r)){
      G.cur.matrix = r; G.cur.x += k; Sound.rotate();
      if(G.rotBonus){ G.score += G.rotBonus; updateHUD(); }   // döndürme bonusu
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
    G.cur = nextFromQueue();
  }
  G.holdType = curType;
  G.canHold = false;
  Sound.hold();
  drawSide();
}

// ── Çizim ───────────────────────────────────────────────────────
function cell(ctx, x, y, size, color, ghost){
  drawThemedCell(ctx, x, y, size, color, (G && G.theme) || SELECTED_THEME, ghost);
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
// Birden fazla sonraki taşı dikey çiz (kahramanın önizleme sayısı kadar)
function drawNextQueue(canvas, count){
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(!G.queue || !G.queue.length) return;
  const n = Math.min(count || 1, G.queue.length);
  const slotH = canvas.height / n;
  for(let i=0;i<n;i++){
    const type = G.queue[i].type;
    const p = PIECES[type], cells = p.cells;
    let maxX=0,maxY=0; cells.forEach(([x,y])=>{if(x>maxX)maxX=x;if(y>maxY)maxY=y;});
    const w=maxX+1, h=maxY+1;
    const s = Math.floor(Math.min(canvas.width/(w+0.6), slotH/(h+0.4)));
    const ox = (canvas.width - w*s)/2;
    const oy = i*slotH + (slotH - h*s)/2;
    const alpha = i === 0 ? 1 : 0.55;   // ilk taş net, sonrakiler soluk
    cells.forEach(([x,y]) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = i===0?6:3;
      ctx.fillRect(ox+x*s+1, oy+y*s+1, s-2, s-2); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(ox+x*s+1, oy+y*s+1, s-2, Math.max(2,s*0.18));
    });
  }
  ctx.globalAlpha = 1;
}
function drawSide(){ drawNextQueue(G.nextCv, G.previewCount || 1); drawMini(G.holdCv, G.holdType); }

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
  Sound.power();
  powerFX(h); screenShake(7);
  flash(msg);
}

// Ekran efekti — kahraman/gem rengiyle parlama dalgası
function powerFX(h){
  if(!G || !G.el.fxLayer) return;
  const fx = G.el.fxLayer;
  fx.style.setProperty('--fxcol', h.color || '#FFD740');
  fx.classList.remove('burst'); void fx.offsetWidth; fx.classList.add('burst');
}

// ── Parçacık sistemi (satır temizleme patlaması) ──
function spawnLineParticles(rows, count){
  if(!G || !G.particles) G.particles = [];
  const s = G.cellSize;
  const colors = ['#00E5FF','#FF4081','#FFD740','#69F0AE','#E040FB','#42A5F5'];
  rows.forEach(ry => {
    const py = ry * s + s/2;
    // satır boyunca parçacıklar
    for(let i=0;i<COLS*2;i++){
      const px = Math.random() * COLS * s;
      G.particles.push({
        x: px, y: py,
        vx: (Math.random()-0.5) * 6,
        vy: (Math.random()-0.5) * 6 - 2,
        life: 1, decay: 0.02 + Math.random()*0.03,
        size: 2 + Math.random()*3,
        color: colors[Math.floor(Math.random()*colors.length)]
      });
    }
  });
  // çok parçacık olmasın
  if(G.particles.length > 400) G.particles = G.particles.slice(-400);
}

function updateParticles(){
  if(!G || !G.particles || !G.particles.length) return;
  const ctx = G.ctx;
  for(let i=G.particles.length-1;i>=0;i--){
    const p = G.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= p.decay;
    if(p.life <= 0){ G.particles.splice(i,1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Ekran sarsıntısı ──
function screenShake(intensity){
  if(!G || !G.canvas) return;
  G.shake = intensity || 5;
  G.shakeDecay = (intensity || 5) / 12;
}
function applyShake(){
  if(!G || !G.canvas) return;
  if(G.shake && G.shake > 0.3){
    const dx = (Math.random()-0.5) * G.shake;
    const dy = (Math.random()-0.5) * G.shake;
    G.canvas.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    G.shake -= G.shakeDecay;
  } else if(G.canvas.style.transform){
    G.canvas.style.transform = '';
    G.shake = 0;
  }
}

// "S.GÜÇ" gem butonu güncelle (kaç gem var)
function updateGemBtn(){
  if(!G || !G.el.gemBtn) return;
  const btn = G.el.gemBtn, n = G.gems.length;
  btn.classList.toggle('has', n > 0);
  // fusion yaklaşıyor mu (aynıdan 2+)
  const counts = {}; G.gems.forEach(g => counts[g.id] = (counts[g.id]||0)+1);
  const fusing = Object.values(counts).some(c => c >= 2);
  btn.classList.toggle('fusing', fusing);
  btn.innerHTML = '<span class="pw-ico">💎</span><span class="pw-txt">S.GÜÇ ' + n + '/' + GEM_MAX + '</span>';
}

// Gem envanter panelini aç
function openGemSheet(){
  if(!G || G.over || !G.gems.length) return;
  G.paused = true;   // panel açıkken oyun durur
  const sheet = G.el.gemSheet, grid = sheet.querySelector('.gem-grid');
  const counts = {}; G.gems.forEach(g => counts[g.id] = (counts[g.id]||0)+1);
  grid.innerHTML = '';
  G.gems.forEach((gm, i) => {
    const cnt = counts[gm.id] || 1;
    const fusing = cnt >= 2;
    const btn = document.createElement('button');
    btn.className = 'gem-card' + (fusing ? ' fusing' : '');
    btn.style.setProperty('--gc', gm.c);
    btn.innerHTML =
      (fusing ? '<span class="gem-badge">'+cnt+'x'+(cnt>=3?' 🔗':'→')+'</span>' : '') +
      '<span class="gem-ic">'+gm.ic+'</span>' +
      '<span class="gem-nm">'+gm.nm+'</span>' +
      '<span class="gem-desc">'+gm.desc+'</span>';
    btn.addEventListener('click', () => pickGem(i));
    grid.appendChild(btn);
  });
  const hasFusing = Object.values(counts).some(c => c >= 2);
  sheet.querySelector('.gem-hint').style.display = hasFusing ? 'block' : 'none';
  sheet.classList.add('show');
}
function closeGemSheet(){
  if(!G) return;
  G.el.gemSheet.classList.remove('show');
  G.paused = false; G.last = 0;
}
function pickGem(idx){
  if(!G) return;
  const gem = G.gems[idx];
  if(!gem){ closeGemSheet(); return; }
  G.gems.splice(idx, 1);   // gem'i envanterden çıkar
  closeGemSheet();
  // Gem etkisini çalıştır
  const api = {
    board: G.board, COLS, ROWS,
    emptyRow: () => Array(COLS).fill(0),
    addScore: (n) => { G.score += Math.round(n || 0); },
    slowTime: (ms) => { G.slowUntil = performance.now() + ms; }
  };
  let msg = '';
  try{ msg = gem.run(api) || gem.nm; }catch(e){ console.warn('[tetris] gem', e); msg = gem.nm; }
  // Krypto gem boost
  if(G.gemPowerBoost && G.gemPowerBoost > 1){ G.score += Math.floor(200 * G.gemPowerBoost); }
  updateGemBtn(); updateHUD();
  Sound.gemPick();
  powerFX(gem); screenShake(6);
  flash(msg);
  checkFusion();   // kullanım sonrası kalan gem'lerde fusion olabilir
}

// ── Karakter seçim ekranı ───────────────────────────────────────
function buildHeroSelect(onPick){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay';
  // Oyuncunun kaju + level'i (kilit kontrolü için)
  const ps = (function(){ try{ return Store.getState(); }catch(e){ return {}; } })();
  const pKaju = ps.kaju || 0, pLevel = ps.level || 1;

  let cards = '';
  HERO_KEYS.forEach(key => {
    const h = HEROES[key];
    const unlocked = isHeroUnlocked(key, pKaju, pLevel);
    const sel = (key === SELECTED_HERO && unlocked) ? ' selected' : '';
    if(unlocked){
      const ava = heroAvatar(key);
      const iconHtml = ava ? `<span class="hc-avatar">${ava}</span>` : `<span class="hc-icon">${h.icon}</span>`;
      cards += `
        <button class="hero-card${sel}" data-hero="${key}" style="--hc:${h.color}">
          <span class="hc-prev">👁️${h.preview}</span>
          ${iconHtml}
          <span class="hc-name">${h.name}</span>
          <span class="hc-passive">${h.passive}</span>
        </button>`;
    } else {
      // Kilitli → sürpriz "?" kartı
      cards += `
        <button class="hero-card locked" data-hero="${key}" data-locked="1" style="--hc:${h.color}">
          <span class="hc-lockbadge">🔒</span>
          <span class="hc-icon hc-q">?</span>
          <span class="hc-name">???</span>
          <span class="hc-unlock">${unlockText(key)}</span>
        </button>`;
    }
  });
  let modeBtns = '';
  Object.keys(MODES).forEach(key => {
    const m = MODES[key];
    const sel = (key === SELECTED_MODE) ? ' selected' : '';
    modeBtns += `
      <button class="mode-card${sel}" data-mode="${key}" style="--mc:${m.color}">
        <span class="mode-ic">${m.icon}</span>
        <span class="mode-nm">${m.label}</span>
      </button>`;
  });
  let themeBtns = '';
  THEME_KEYS.forEach(key => {
    const t = THEMES[key];
    const sel = (key === SELECTED_THEME) ? ' selected' : '';
    themeBtns += `
      <button class="theme-card${sel}" data-theme="${key}">
        <span class="theme-ic">${t.icon}</span>
        <span class="theme-nm">${t.name}</span>
      </button>`;
  });
  ov.innerHTML = `
    <div class="hs-top">
      <button class="t-icon" data-act="back">✕</button>
      <div class="hs-title">HEROTETRIS</div>
      <button class="t-icon" data-act="sound" title="Ses">${Sound.enabled ? '🔊' : '🔇'}</button>
    </div>
    <div class="hs-modes">${modeBtns}</div>
    <div class="hs-modedesc" id="hsModeDesc"></div>
    <div class="hs-label">🎨 TAŞ TEMASI</div>
    <div class="hs-themes">${themeBtns}</div>
    <div class="hs-sub">Kahramanını seç — her birinin özel gücü var</div>
    <div class="hero-grid">${cards}</div>
    <button class="hs-play" data-act="play">▶ OYNA</button>`;
  document.body.appendChild(ov);

  function refreshHeroes(){
    ov.querySelectorAll('.hero-card').forEach(c => c.classList.toggle('selected', !c.dataset.locked && c.dataset.hero === SELECTED_HERO));
  }
  function refreshModes(){
    ov.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('selected', c.dataset.mode === SELECTED_MODE));
    const d = ov.querySelector('#hsModeDesc');
    if(d) d.textContent = MODES[SELECTED_MODE].icon + ' ' + MODES[SELECTED_MODE].desc;
  }
  function refreshThemes(){
    ov.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('selected', c.dataset.theme === SELECTED_THEME));
  }
  ov.querySelectorAll('.hero-card').forEach(card => {
    card.addEventListener('click', () => {
      if(card.dataset.locked){
        // Kilitli: açılma şartını göster, titret
        const txt = unlockText(card.dataset.hero);
        const info = ov.querySelector('#hsModeDesc');
        if(info) info.textContent = '🔒 Kilitli — ' + txt + ' gerekli';
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        try{ Sound.lock(); }catch(e){}
        return;
      }
      SELECTED_HERO = card.dataset.hero;
      try{ localStorage.setItem('hero_tetris_char', SELECTED_HERO); }catch(e){}
      refreshHeroes();
    });
  });
  ov.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      SELECTED_MODE = card.dataset.mode;
      try{ localStorage.setItem('hero_tetris_mode', SELECTED_MODE); }catch(e){}
      refreshModes();
    });
  });
  ov.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      SELECTED_THEME = card.dataset.theme;
      try{ localStorage.setItem('hero_tetris_theme', SELECTED_THEME); }catch(e){}
      refreshThemes();
    });
  });
  refreshModes();
  ov.querySelector('[data-act="sound"]').addEventListener('click', (e) => {
    const on = Sound.toggle();
    e.currentTarget.textContent = on ? '🔊' : '🔇';
  });
  ov.querySelector('[data-act="play"]').addEventListener('click', () => { ov.remove(); onPick(); });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => { ov.remove(); });
  return ov;
}

// ── MACERA: Bölüm (dünya) seçim ekranı ──
function buildWorldSelect(onPick){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay world-select';
  const prog = getProgress();
  const doneCount = prog.completed.length;
  let cardsHtml = '';
  WORLDS.forEach(w => {
    const unlocked = isWorldUnlocked(w.id);
    const stars = prog.stars[w.id] || 0;
    let starHtml = '';
    for(let i=1;i<=3;i++) starHtml += `<span class="ws-star${i<=stars?' on':''}">${i<=stars?'★':'☆'}</span>`;
    const lockCls = unlocked ? '' : ' locked';
    const lockAttr = unlocked ? '' : ' data-locked="1"';
    const lockBadge = unlocked ? '' : '<span class="ws-lock">🔒</span>';
    cardsHtml += `
      <button class="ws-card${lockCls}" data-world="${w.id}"${lockAttr} style="--wc:${w.color}">
        <span class="ws-icon">${w.icon}</span>
        <div class="ws-info">
          <div class="ws-name">DÜNYA ${w.id}: ${w.name}</div>
          <div class="ws-desc">${w.desc}</div>
          <div class="ws-meta"><span class="ws-stars">${starHtml}</span><span class="ws-target">${w.target} blok</span><span class="ws-boss">👹 ${w.boss}</span></div>
        </div>
        ${lockBadge}
      </button>`;
  });
  ov.innerHTML = `
    <div class="hs-top">
      <div class="hs-title" style="font-size:16px">🗺️ MACERA</div>
      <button class="t-icon" data-act="back">← GERİ</button>
    </div>
    <div class="ws-progress">${doneCount} / 8 dünya tamamlandı</div>
    <div class="ws-grid">${cardsHtml}</div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('.ws-card').forEach(card => {
    card.addEventListener('click', () => {
      if(card.dataset.locked){
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        try{ Sound.lock(); }catch(e){}
        return;
      }
      const id = parseInt(card.dataset.world, 10);
      ov.remove(); onPick(id);
    });
  });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => {
    ov.remove();
    buildHeroSelect(() => {
      if(SELECTED_MODE === 'adventure'){ buildWorldSelect((wid) => { ADVENTURE_WORLD = wid; launchGame(); }); }
      else if(SELECTED_MODE === 'versus'){ buildVersusLobby(); }
      else { ADVENTURE_WORLD = null; launchGame(); }
    });
  });
  return ov;
}

// ── ÇOK OYUNCU: Lobi (oda oluştur / koda katıl) ──
function buildVersusLobby(){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay versus-lobby';
  ov.innerHTML = `
    <div class="hs-top">
      <div class="hs-title" style="font-size:16px">🌐 ÇOK OYUNCU</div>
      <button class="t-icon" data-act="back">← GERİ</button>
    </div>
    <div class="vl-body">
      <div class="vl-card">
        <div class="vl-card-title">🎮 ODA OLUŞTUR</div>
        <div class="vl-card-desc">Yeni oda kur, kodu arkadaşına gönder</div>
        <button class="vl-btn vl-create" data-act="create">ODA OLUŞTUR</button>
      </div>
      <div class="vl-or">— veya —</div>
      <div class="vl-card">
        <div class="vl-card-title">🔑 ODAYA KATIL</div>
        <div class="vl-card-desc">Arkadaşının kodunu gir</div>
        <input class="vl-input" data-el="codeInput" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">
        <button class="vl-btn vl-join" data-act="join">KATIL</button>
      </div>
      <div class="vl-status" data-el="status"></div>
    </div>`;
  document.body.appendChild(ov);
  const statusEl = ov.querySelector('[data-el="status"]');
  const codeInput = ov.querySelector('[data-el="codeInput"]');
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''); });

  function setStatus(msg, type){
    statusEl.textContent = msg;
    statusEl.className = 'vl-status' + (type ? ' ' + type : '');
  }
  function handleEvent(type, data){
    if(type === 'code'){
      setStatus('Oda kodu: ' + data + '  ·  Paylaş ve bekle', 'code');
      // kod büyük gösterilsin
      statusEl.innerHTML = '<div class="vl-codebig">' + data + '</div><div class="vl-codehint">Bu kodu arkadaşına gönder, rakip bekleniyor…</div>';
    } else if(type === 'waiting'){
      /* zaten kod gösteriliyor */
    } else if(type === 'connected'){
      setStatus('✅ Rakip bağlandı! Başlıyor…', 'ok');
      // el sıkışma: nick gönder
      MP.send({ type:'hello', nick: (window.__HERO_NICK || 'Rakip'), hero: SELECTED_HERO });
      setTimeout(() => { ov.remove(); launchVersusGame(); }, 800);
    } else if(type === 'disconnected'){
      setStatus('❌ Rakip ayrıldı', 'err');
    } else if(type === 'error'){
      setStatus('⚠️ ' + (data || 'bağlantı hatası'), 'err');
    }
  }
  ov.querySelector('[data-act="create"]').addEventListener('click', () => {
    setStatus('Oda kuruluyor…');
    MP.createRoom(handleEvent);
  });
  ov.querySelector('[data-act="join"]').addEventListener('click', () => {
    const code = codeInput.value.trim();
    if(code.length !== 6){ setStatus('⚠️ 6 haneli kod gir', 'err'); return; }
    setStatus('Bağlanıyor…');
    MP.joinRoom(code, handleEvent);
  });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => {
    MP.close();
    ov.remove();
    buildHeroSelect(() => {
      if(SELECTED_MODE === 'adventure'){ buildWorldSelect((wid) => { ADVENTURE_WORLD = wid; launchGame(); }); }
      else if(SELECTED_MODE === 'versus'){ buildVersusLobby(); }
      else { ADVENTURE_WORLD = null; launchGame(); }
    });
  });
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
    G.elapsed += dt;
    // Hayatta Kal: her 30 saniyede hızlan
    if(G.mode === 'survival'){
      const step = Math.floor(G.elapsed / 30000);
      if(step > G.survStep){
        G.survStep = step;
        G.baseInterval = Math.max(120, G.baseInterval - 90);
        G.dropInterval = Math.max(80, Math.round(G.baseInterval * (G.speedMult||1)));
        flash('⏱️ HIZLANIYOR!');
      }
    }
    updateModeUI();
    // Versus: saniyede bir skor senkronu
    if(G.versus){
      G.vsSyncAcc = (G.vsSyncAcc || 0) + dt;
      if(G.vsSyncAcc >= 1000){ G.vsSyncAcc = 0; sendVersusState(); }
    }
    G.dropAcc += dt;
    // Flash "Zaman Yavaşlat" aktifse düşme aralığını 4x uzat
    const slowed = (G.slowUntil && ts < G.slowUntil);
    const interval = slowed ? G.dropInterval * 4 : G.dropInterval;
    if(G.dropAcc >= interval){ G.dropAcc = 0; if(!collides(G.cur, 0, 1)){ G.cur.y++; } else lock(); }
    drawBoard(); drawSide();
    updateParticles();
    applyShake();
  }
  G.raf = requestAnimationFrame(loop);
}

function fmtTime(ms){
  const s = Math.floor(ms/1000); const m = Math.floor(s/60);
  return m + ':' + String(s%60).padStart(2,'0');
}

// Mod göstergesini güncelle (süre / sprint ilerleme)
function updateModeUI(){
  if(!G || !G.el.modeBar) return;
  if(G.versus){ updateVersusUI(); return; }
  const bar = G.el.modeBar;
  if(G.mode === 'solo'){ bar.style.display = 'none'; return; }
  bar.style.display = 'block';
  const m = MODES[G.mode];
  if(G.mode === 'survival'){
    bar.style.color = m.color;
    bar.textContent = '⏱️ ' + fmtTime(G.elapsed) + ' · Lv' + (G.survStep+1);
  } else if(G.mode === 'sprint'){
    bar.style.color = m.color;
    const left = Math.max(0, SPRINT_TARGET - G.lines);
    bar.textContent = '🏃 ' + fmtTime(G.elapsed) + ' · ' + left + ' satır kaldı';
  } else if(G.mode === 'zen'){
    bar.style.color = m.color;
    bar.textContent = '🧘 ' + fmtTime(G.elapsed);
  } else if(G.mode === 'adventure' && G.advWorld){
    bar.style.color = G.advWorld.color;
    const left = Math.max(0, G.advTarget - G.lines);
    bar.textContent = G.advWorld.icon + ' ' + G.advWorld.name + ' · ' + left + ' blok · 👹' + G.advWorld.boss;
  }
}

async function gameOver(){ await endGame(false); }
async function sprintWin(){ await endGame(true); }
async function adventureWin(){
  // Dünyayı tamamla + yıldız hesapla
  if(G.advWorld){
    const stars = calcStars(G.advWorld.id, G.lines);
    completeWorld(G.advWorld.id, stars);
    G.advStars = stars;
  }
  await endGame(true);
}

async function endGame(isWin){
  if(G.over) return;
  G.over = true;
  cancelAnimationFrame(G.raf);
  // Versus: rakibe öldüğünü bildir
  if(G.versus){
    if(!isWin && MP.connected) MP.send({ type:'dead' });
    Sound.gameover();
    const ov = G.el.gameover;
    // Rakip zaten elendiyse sen kazandın; yoksa sen elendin
    const won = !G.oppAlive;
    ov.querySelector('.go-title').textContent = won ? '🏆 KAZANDIN!' : '💀 ELENDİN';
    ov.querySelector('.go-score').textContent = G.score.toLocaleString('tr-TR');
    ov.querySelector('.go-lines').textContent = 'Sen: ' + G.lines + ' satır  ·  ' + (G.oppNick||'Rakip') + ': ' + (G.oppLines||0) + ' satır';
    ov.querySelector('.go-reward').textContent = won ? '🥜 +100 zafer ödülü' : '';
    ov.querySelector('.go-record').style.display = 'none';
    try{ if(won) await Store.addKaju(100, 'tetris-vs'); await Store.addScore('tetris', G.score); }catch(e){}
    ov.classList.add('show');
    setTimeout(() => { try{ MP.close(); }catch(e){} }, 500);
    return;
  }
  if(isWin) Sound.win(); else Sound.gameover();
  let score = G.score;
  // Sprint kazanınca süre bonusu (hızlı bitirme ödüllü)
  if(isWin && G.mode === 'sprint'){
    const secs = Math.floor(G.elapsed/1000);
    const timeBonus = Math.max(0, 5000 - secs*20);
    score += timeBonus;
    G.score = score;
  }
  const kaju = Math.min(Math.floor(score / 200), 200);
  const xp   = Math.floor(score / 50);
  let isRecord = false;
  try{
    isRecord = await Store.addScore('tetris', score);
    if(kaju > 0) await Store.addKaju(kaju, 'tetris');
    if(xp > 0)   await Store.addXP(xp);
  }catch(e){ console.warn('[tetris] ödül', e); }

  const ov = G.el.gameover;
  // Macera kazanınca özel başlık (boss yenildi + yıldızlar)
  if(isWin && G.mode === 'adventure' && G.advWorld){
    ov.querySelector('.go-title').textContent = '👹 ' + G.advWorld.boss + ' YENİLDİ!';
  } else {
    ov.querySelector('.go-title').textContent = isWin ? '🏆 KAZANDIN!' : 'OYUN BİTTİ';
  }
  ov.querySelector('.go-score').textContent = score.toLocaleString('tr-TR');
  // Modda süre anlamlıysa satır yerine süreyi göster
  const lineRow = ov.querySelector('.go-lines').closest('.go-row');
  if(G.mode === 'adventure' && isWin && G.advWorld){
    const s = G.advStars || 1;
    let stars = ''; for(let i=1;i<=3;i++) stars += (i<=s?'★':'☆');
    const nextW = getWorld(G.advWorld.id + 1);
    ov.querySelector('.go-lines').textContent = stars + (nextW ? ('  ·  ' + nextW.name + ' açıldı!') : '  ·  Tüm dünyalar bitti!');
  } else if(G.mode === 'sprint' || G.mode === 'survival'){
    ov.querySelector('.go-lines').textContent = G.lines + ' satır · ' + fmtTime(G.elapsed);
  } else {
    ov.querySelector('.go-lines').textContent = G.lines;
  }
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
    <div class="t-modebar" style="display:none"></div>
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
    <div class="t-power-row">
      <button class="t-power" data-act="power"><span class="pw-ico">⚡</span><span class="pw-txt">GÜÇ %0</span></button>
      <button class="t-gem" data-act="gem"><span class="pw-ico">💎</span><span class="pw-txt">S.GÜÇ 0/5</span></button>
    </div>
    <div class="gem-sheet">
      <div class="gem-sheet-inner">
        <div class="gem-sheet-title">💎 SÜPER GÜÇLER</div>
        <div class="gem-grid"></div>
        <div class="gem-hint">💥 3 aynı gem → ULTRA FUSION!</div>
        <button class="gem-close" data-act="gemclose">KAPAT</button>
      </div>
    </div>
    <div class="tetris-controls">
      <button class="t-ctrl" data-ctrl="rotateL">↺</button>
      <button class="t-ctrl" data-ctrl="left">◀</button>
      <button class="t-ctrl" data-ctrl="down">▼</button>
      <button class="t-ctrl" data-ctrl="right">▶</button>
      <button class="t-ctrl" data-ctrl="rotateR">↻</button>
    </div>
    <div class="tetris-controls tetris-controls-2">
      <button class="t-ctrl t-ctrl-wide" data-ctrl="hold">⇄ TUT</button>
      <button class="t-ctrl t-ctrl-wide t-ctrl-drop" data-ctrl="drop">⤓ SERT BIRAK</button>
    </div>`;
  document.body.appendChild(root);
  return root;
}

function fitCanvas(){
  const wrap = G.root.querySelector('.tetris-board-wrap');
  // Genişlik
  let availW = wrap.clientWidth;
  if(!availW || availW < 40){
    const sideW = 92 + 10;   // yan panel + boşluk
    availW = Math.max(120, (window.innerWidth || 360) - sideW - 20);
  }
  // Yükseklik: sarmalayıcının GERÇEK yüksekliğini ölç (mod barı, güç satırı,
  // kontroller flex ile yer kaptıktan SONRA kalan alan). Sabit tahmin yapma.
  let availH = wrap.clientHeight;
  if(!availH || availH < 60){
    // İlk render'da ölçülememişse güvenli tahmin (tüm UI elemanlarını düş)
    const modeBarH = (G.mode && G.mode !== 'solo') ? 30 : 0;
    availH = Math.max(200, (window.innerHeight || 640) - 56 - modeBarH - 66 - 70 - 24);
  }
  // Hücre boyutu: hem genişliğe hem yüksekliğe sığmalı (küçük olanı seç)
  const csW = Math.floor(availW / COLS);
  const csH = Math.floor(availH / ROWS);
  let cs = Math.min(csW, csH);
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
    else if(ctrl==='rotateR') rotate('cw');
    else if(ctrl==='rotateL') rotate('ccw');
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
      else if(a==='gem') openGemSheet();
      else if(a==='gemclose') closeGemSheet();
    });
  });

  // Klavye (masaüstü testte kolaylık)
  G.keyHandler = (e) => {
    if(!G) return;
    const k = e.key;
    if(k==='ArrowLeft') move(-1);
    else if(k==='ArrowRight') move(1);
    else if(k==='ArrowUp'||k==='x'||k==='X') rotate('cw');
    else if(k==='z'||k==='Z') rotate('ccw');
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
  G.queue = [];
  G.holdType = null; G.canHold = true;
  G.score = 0; G.level = 1; G.lines = 0; G.tetrisCount = 0;
  G.dropAcc = 0; G.last = 0;
  G.over = false; G.paused = false;

  // ── Kahraman pasif güçleri ──
  resetHeroMods(G);
  // Seçili kahraman kilitliyse veya geçersizse varsayılana düş
  let heroKey = SELECTED_HERO;
  if(!HEROES[heroKey]){ heroKey = DEFAULT_HERO; }
  else {
    const ps = (function(){ try{ return Store.getState(); }catch(e){ return {}; } })();
    if(!isHeroUnlocked(heroKey, ps.kaju||0, ps.level||1)){ heroKey = DEFAULT_HERO; SELECTED_HERO = DEFAULT_HERO; }
  }
  G.hero = HEROES[heroKey] || HEROES[DEFAULT_HERO];
  try{ G.hero.apply(G); }catch(e){ console.warn('[tetris] hero apply', e); }
  G.previewCount = G.hero.preview || 1;   // kahramana göre önizleme sayısı (2/3/4)
  G.baseInterval = 800;
  G.dropInterval = Math.round(G.baseInterval * G.speedMult);
  G.shieldUsed = false;   // Nexus kalkanı

  // Kuyruğu kur + ilk taşı al (previewCount ayarlandıktan sonra)
  fillQueue();
  G.cur = nextFromQueue();

  // ── Güç şarj sistemi ──
  G.power = G.hero.power;
  G.charge = 0;           // 0..POWER_CHARGE_LINES
  G.powerReady = false;
  G.slowUntil = 0;        // Flash zaman yavaşlatma bitiş (ms timestamp)
  updatePowerBtn();

  // ── Gem (S.Güç) envanteri ──
  G.gems = [];            // toplanan gem'ler
  updateGemBtn();

  // ── Mod durumu ──
  G.mode = SELECTED_MODE;
  G.elapsed = 0;          // geçen süre (ms)
  G.survStep = 0;         // survival: kaç kez hızlandı
  G.zen = (G.mode === 'zen');
  G.won = false;
  if(G.mode === 'zen'){ G.baseInterval = 700; G.dropInterval = Math.round(700 * G.speedMult); }
  // Macera: seçili dünyanın hedefi + boss bilgisi
  G.advWorld = (G.mode === 'adventure' && ADVENTURE_WORLD) ? getWorld(ADVENTURE_WORLD) : null;
  G.advTarget = G.advWorld ? G.advWorld.target : 0;
  updateModeUI();

  // ── Tema + efekt durumu ──
  G.theme = SELECTED_THEME;
  G.particles = [];
  G.shake = 0;

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
  if(G.versus){ try{ MP.close(); }catch(e){} }
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
      fxLayer: root.querySelector('.t-fxlayer'),
      gemBtn: root.querySelector('.t-gem'),
      gemSheet: root.querySelector('.gem-sheet'),
      modeBar: root.querySelector('.t-modebar')
    },
    raf: 0
  };
  G.resizeHandler = () => { if(G){ fitCanvas(); drawBoard(); } };
  window.addEventListener('resize', G.resizeHandler);
  bindControls();
  Sound.resume();   // ses bağlamını başlat (OYNA dokunuşuyla)
  startGame();
  // DOM yerleştikten sonra gerçek ölçüyle yeniden boyutlandır (mod barı dahil)
  requestAnimationFrame(() => { if(G){ fitCanvas(); drawBoard(); } });
  setTimeout(() => { if(G){ fitCanvas(); drawBoard(); } }, 80);
}

// Çok oyunculu oyunu başlat (versus modu)
function launchVersusGame(){
  SELECTED_MODE = 'versus';
  ADVENTURE_WORLD = null;
  launchGame();
  if(!G) return;
  G.versus = true;
  G.oppScore = 0; G.oppLines = 0; G.oppNick = 'Rakip'; G.oppAlive = true;
  G.pendingGarbage = 0;   // gelen çöp sıraları (sonraki kilitlemede uygulanır)
  // Rakip mesajlarını dinle
  MP.send({ type:'hello', nick:(window.__HERO_NICK||'Sen'), hero:SELECTED_HERO });
  MP._gameHandler = (type, data) => {
    if(type === 'message') handleVersusMessage(data);
    else if(type === 'disconnected'){ if(G && G.versus && !G.over){ flash('🏆 Rakip ayrıldı!'); G.oppAlive = false; } }
  };
  // onEvent'i oyun handler'ına yönlendir (lobi handler'ı bitti)
  rebindMPHandler();
  updateVersusUI();
}

function rebindMPHandler(){
  // MP modülünün onEvent'ini oyun sırasında bizim handler'a bağla
  const h = MP._gameHandler;
  if(!h) return;
  // MP.createRoom/joinRoom onEvent'i içeride tutuyor; yeniden bağlamak için send sonrası
  // basitçe: MP'ye yeni handler ata (modül onEvent'i export etmiyor, bu yüzden closure ile)
  try{ MP.__setHandler && MP.__setHandler(h); }catch(e){}
}

function handleVersusMessage(msg){
  if(!G || !msg) return;
  if(msg.type === 'hello'){ G.oppNick = msg.nick || 'Rakip'; updateVersusUI(); }
  else if(msg.type === 'state'){ G.oppScore = msg.score||0; G.oppLines = msg.lines||0; updateVersusUI(); }
  else if(msg.type === 'garbage'){ G.pendingGarbage += (msg.rows||0); flash('⚠️ ' + (msg.rows||0) + ' çöp geliyor!'); updateVersusUI(); }
  else if(msg.type === 'dead'){ G.oppAlive = false; if(!G.over){ flash('🏆 Rakip eledin!'); } updateVersusUI(); }
}

// Rakibe durum gönder (skor/satır)
function sendVersusState(){
  if(G && G.versus && MP.connected){ MP.send({ type:'state', score:G.score, lines:G.lines }); }
}

// Gelen çöp sıralarını tahtaya uygula (altta gri bloklar, 1 rastgele boşluk)
function applyGarbage(rows){
  if(!G || rows <= 0) return;
  for(let i=0;i<rows;i++){
    G.board.shift();   // üstten bir sıra at
    const row = Array(COLS).fill('#5a5a6e');   // gri çöp
    const hole = Math.floor(Math.random() * COLS);
    row[hole] = 0;   // bir boşluk bırak
    G.board.push(row);
  }
  screenShake(6);
  // çöp eklenince mevcut parça çakışıyorsa yukarı it
  if(G.cur && collides(G.cur, 0, 0)){ G.cur.y = Math.max(0, G.cur.y - rows); }
}

// Versus göstergesini güncelle (rakip skor/satır + çöp uyarısı)
function updateVersusUI(){
  if(!G || !G.versus || !G.el.modeBar) return;
  const bar = G.el.modeBar;
  bar.style.display = 'block';
  bar.style.color = '#00BCD4';
  let txt = '🌐 ' + (G.oppNick||'Rakip') + ': ' + (G.oppScore||0).toLocaleString('tr-TR') + ' · ' + (G.oppLines||0) + ' satır';
  if(!G.oppAlive) txt = '🏆 Rakip elendi! Sen kazandın!';
  if(G.pendingGarbage > 0) txt += '  ⚠️' + G.pendingGarbage;
  bar.textContent = txt;
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
.tetris-board-wrap{ flex: 1; display: flex; align-items: flex-start; justify-content: center; position: relative; min-width: 0; min-height: 0; overflow: hidden; }
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
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin-top: 8px;
}
.tetris-controls-2{ grid-template-columns: 1fr 1.4fr; margin-top: 7px; }
.t-ctrl-wide{ font-size: 13px !important; font-weight: 800; letter-spacing: .5px; }
.t-ctrl{
  height: 58px; border-radius: var(--r-lg); position: relative; overflow: hidden;
  background:
    linear-gradient(160deg, rgba(0,229,255,.14), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)),
    rgba(255,255,255,.02);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(0,229,255,.35); color: var(--cyan);
  font-size: 24px; font-weight: 700; touch-action: none; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; justify-content: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.15), inset 0 -2px 8px rgba(0,0,0,.2), 0 4px 12px rgba(0,0,0,.35);
}
.t-ctrl::before{ content:''; position:absolute; top:0; left:0; right:0; height:48%; background:linear-gradient(180deg,rgba(255,255,255,.16),transparent); pointer-events:none; border-radius: var(--r-lg) var(--r-lg) 0 0; }
.t-ctrl::after{ content:''; position:absolute; inset:0; border-radius:var(--r-lg); box-shadow: inset 0 0 0 1px rgba(255,255,255,.04); pointer-events:none; }
.t-ctrl:active{ transform: scale(.92); box-shadow: inset 0 0 18px rgba(0,229,255,.45), 0 2px 6px rgba(0,0,0,.4); filter: brightness(1.2); }
.t-ctrl[data-ctrl="drop"], .t-ctrl-drop{ color: var(--pink); border-color: rgba(255,64,129,.5); background: linear-gradient(160deg, rgba(255,64,129,.16), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)); }
.t-ctrl-drop::before{ background:linear-gradient(180deg,rgba(255,255,255,.18),transparent); }
.t-ctrl[data-ctrl="hold"]{ color: var(--gold); border-color: rgba(255,215,64,.5); background: linear-gradient(160deg, rgba(255,215,64,.14), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)); }
.t-ctrl[data-ctrl="rotateR"], .t-ctrl[data-ctrl="rotateL"]{ color: var(--magenta); border-color: rgba(224,64,251,.5); background: linear-gradient(160deg, rgba(224,64,251,.14), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)); }

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
/* Mod seçici */
.hs-modes{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 8px; }
.mode-card{
  --mc: #00E5FF; display: flex; flex-direction: column; align-items: center; gap: 3px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 9px 4px; transition: border-color .15s, box-shadow .15s;
}
.mode-card .mode-ic{ font-size: 20px; }
.mode-card .mode-nm{ font-size: 7px; font-weight: 800; letter-spacing: .5px; color: var(--text-mute); }
.mode-card.selected{ border-color: var(--mc); box-shadow: 0 0 12px color-mix(in srgb, var(--mc) 35%, transparent); }
.mode-card.selected .mode-nm{ color: var(--mc); }
.mode-card:active{ transform: scale(.95); }
.hs-modedesc{ text-align: center; font-size: 9px; font-weight: 700; color: var(--text-dim); margin-bottom: 8px; min-height: 12px; }
/* Tema seçici */
.hs-label{ font-size: 8px; letter-spacing: 2px; color: var(--text-mute); font-weight: 800; margin: 2px 0 6px; }
.hs-themes{ display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 6px; margin-bottom: 8px; }
.theme-card{
  flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--r-sm);
  padding: 7px 10px; min-width: 54px;
}
.theme-card .theme-ic{ font-size: 18px; }
.theme-card .theme-nm{ font-size: 7px; font-weight: 800; letter-spacing: .5px; color: var(--text-mute); }
.theme-card.selected{ border-color: var(--cyan); box-shadow: 0 0 10px rgba(0,229,255,.3); }
.theme-card.selected .theme-nm{ color: var(--cyan); }
.theme-card:active{ transform: scale(.95); }
/* Oyun içi mod göstergesi */
.t-modebar{ text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 11px; letter-spacing: 1.5px; padding: 4px 0 8px; }
/* Macera bölüm seçim ekranı */
.ws-progress{ text-align: center; font-size: 10px; letter-spacing: 2px; color: var(--text-mute); font-weight: 700; margin-bottom: 12px; }
.ws-grid{ flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; display: flex; flex-direction: column; gap: 10px; padding-bottom: 12px; }
.ws-card{
  --wc: #888; position: relative; display: flex; align-items: center; gap: 12px; text-align: left;
  background: linear-gradient(120deg, color-mix(in srgb, var(--wc) 16%, transparent), rgba(255,255,255,.02) 60%);
  border: 1.5px solid color-mix(in srgb, var(--wc) 50%, transparent); border-radius: var(--r-lg);
  padding: 13px 14px; transition: transform .12s, box-shadow .15s;
}
.ws-card:active{ transform: scale(.98); }
.ws-card:not(.locked):active{ box-shadow: 0 0 18px color-mix(in srgb, var(--wc) 45%, transparent); }
.ws-icon{ font-size: 38px; line-height: 1; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--wc) 60%, transparent)); flex-shrink: 0; }
.ws-info{ flex: 1; min-width: 0; }
.ws-name{ font-family: var(--font-display); font-weight: 700; font-size: 12px; letter-spacing: .5px; color: var(--wc); margin-bottom: 2px; }
.ws-desc{ font-size: 8px; color: var(--text-mute); margin-bottom: 5px; }
.ws-meta{ display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ws-stars{ letter-spacing: 1px; }
.ws-star{ font-size: 11px; color: var(--text-faint); }
.ws-star.on{ color: var(--gold); text-shadow: 0 0 6px rgba(255,215,64,.6); }
.ws-target{ font-size: 8px; font-weight: 700; color: var(--text-dim); }
.ws-boss{ font-size: 8px; font-weight: 800; color: var(--pink); }
.ws-card.locked{ filter: grayscale(.6); opacity: .6; border-style: dashed; }
.ws-lock{ position: absolute; top: 10px; right: 12px; font-size: 18px; }
.ws-card.shake{ animation: cardShake .4s ease; }
/* Çok oyuncu lobisi */
.vl-body{ flex: 1; display: flex; flex-direction: column; gap: 14px; padding-top: 10px; justify-content: center; }
.vl-card{ background: linear-gradient(160deg, rgba(0,188,212,.1), rgba(255,255,255,.02)); border: 1.5px solid rgba(0,188,212,.35); border-radius: var(--r-lg); padding: 18px 16px; text-align: center; }
.vl-card-title{ font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: 1px; color: var(--cyan); margin-bottom: 5px; }
.vl-card-desc{ font-size: 9px; color: var(--text-mute); margin-bottom: 12px; }
.vl-btn{ width: 100%; padding: 13px; border-radius: var(--r-md); font-family: var(--font-display); font-weight: 700; font-size: 13px; letter-spacing: 1px; border: none; }
.vl-create{ background: linear-gradient(135deg, #00BCD4, #0097A7); color: #001a1f; box-shadow: 0 0 16px rgba(0,188,212,.4); }
.vl-join{ background: linear-gradient(135deg, #00E5FF, #00B8D4); color: #001a1f; }
.vl-btn:active{ transform: scale(.97); }
.vl-or{ text-align: center; font-size: 10px; color: var(--text-faint); letter-spacing: 2px; }
.vl-input{ width: 100%; padding: 13px; margin-bottom: 10px; text-align: center; font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; background: rgba(0,0,0,.3); border: 1.5px solid var(--border-cyan); border-radius: var(--r-md); color: #fff; }
.vl-input:focus{ outline: none; border-color: var(--cyan); box-shadow: 0 0 12px rgba(0,229,255,.3); }
.vl-input::placeholder{ color: var(--text-faint); letter-spacing: 4px; }
.vl-status{ text-align: center; font-size: 11px; font-weight: 700; padding: 10px; min-height: 20px; color: var(--text-dim); }
.vl-status.ok{ color: var(--green); }
.vl-status.err{ color: var(--pink); }
.vl-status.code{ color: var(--gold); }
.vl-codebig{ font-family: var(--font-display); font-size: 36px; font-weight: 700; letter-spacing: 8px; color: var(--gold); text-shadow: 0 0 20px rgba(255,215,64,.5); margin: 8px 0; }
.vl-codehint{ font-size: 9px; color: var(--text-mute); letter-spacing: .5px; }
.hero-grid{ flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; align-content: start; padding-bottom: 8px; }
.hero-card{
  position: relative; overflow: hidden;
  background:
    radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--hc) 18%, transparent), transparent 70%),
    linear-gradient(160deg, rgba(255,255,255,.05), rgba(255,255,255,.01));
  border: 1.5px solid var(--border); border-radius: var(--r-md);
  padding: 12px 7px 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
  transition: transform .12s, border-color .15s, box-shadow .15s; min-height: 112px;
}
.hero-card::before{
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 40%;
  background: linear-gradient(180deg, rgba(255,255,255,.08), transparent); pointer-events: none;
}
.hero-card:active{ transform: scale(.96); }
.hero-card.selected{
  border-color: var(--hc);
  box-shadow: 0 0 20px color-mix(in srgb, var(--hc) 50%, transparent), inset 0 0 24px color-mix(in srgb, var(--hc) 12%, transparent);
  transform: translateY(-2px);
}
.hero-card.selected::after{
  content: '✓'; position: absolute; top: 5px; right: 6px; z-index: 2;
  font-size: 10px; font-weight: 900; color: #001018;
  background: var(--hc); border-radius: 50%; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px var(--hc);
}
.hc-icon{ font-size: 32px; filter: drop-shadow(0 0 10px var(--hc)); position: relative; z-index: 1; }
.hc-avatar{ width: 48px; height: 48px; display: block; position: relative; z-index: 1; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--hc) 60%, transparent)); }
.hc-avatar svg{ display: block; }
.hc-name{ font-family: var(--font-display); font-weight: 700; font-size: 9px; letter-spacing: .5px; color: var(--hc); position: relative; z-index: 1; }
.hc-passive{ font-size: 7px; line-height: 1.4; color: var(--text-mute); position: relative; z-index: 1; }
/* Önizleme rozeti (kaç taş görünür) */
.hc-prev{ position: absolute; top: 5px; left: 6px; z-index: 2; font-size: 7px; font-weight: 800; color: var(--hc);
  background: color-mix(in srgb, var(--hc) 18%, transparent); border-radius: 4px; padding: 1px 4px; }
/* Kilitli kart (sürpriz) */
.hero-card.locked{
  background: linear-gradient(160deg, rgba(255,255,255,.03), rgba(0,0,0,.2));
  border-color: rgba(255,255,255,.06); border-style: dashed;
}
.hero-card.locked .hc-icon{ filter: none; }
.hc-q{ font-family: var(--font-display); font-weight: 900; font-size: 40px; color: var(--text-faint); text-shadow: 0 0 16px rgba(255,255,255,.1); }
.hc-lockbadge{ position: absolute; top: 5px; right: 6px; z-index: 2; font-size: 12px; opacity: .7; }
.hc-unlock{ font-size: 7px; font-weight: 800; line-height: 1.3; color: var(--gold); letter-spacing: .3px; position: relative; z-index: 1; }
.hero-card.shake{ animation: cardShake .4s ease; }
@keyframes cardShake{ 0%,100%{ transform: translateX(0); } 20%,60%{ transform: translateX(-5px); } 40%,80%{ transform: translateX(5px); } }
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
  0%{ opacity: 0; box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--fxcol) 80%, transparent); background: radial-gradient(circle at 50% 60%, color-mix(in srgb, var(--fxcol) 45%, transparent), transparent 70%); }
  25%{ opacity: 1; box-shadow: inset 0 0 80px 16px color-mix(in srgb, var(--fxcol) 75%, transparent), 0 0 40px color-mix(in srgb, var(--fxcol) 50%, transparent); }
  60%{ opacity: .7; }
  100%{ opacity: 0; box-shadow: inset 0 0 0 0 transparent; background: transparent; }
}

/* Güç + S.Güç buton satırı */
.t-power-row{ display: flex; gap: 8px; margin-top: 8px; }
.t-power-row .t-power{ margin-top: 0; flex: 1.4; }
.t-gem{
  flex: 1; position: relative; overflow: hidden;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 50px; border-radius: var(--r-lg);
  border: 1.5px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.04); color: var(--text-mute);
  font-weight: 800; letter-spacing: .5px; transition: color .2s;
}
.t-gem .pw-ico{ font-size: 18px; filter: grayscale(.6); }
.t-gem.has{ color: #fff; border-color: rgba(171,71,188,.5); background: rgba(171,71,188,.1); }
.t-gem.has .pw-ico{ filter: none; }
.t-gem.fusing{
  border-color: #FFD740; color: #FFD740;
  box-shadow: 0 0 16px rgba(255,215,64,.4);
  animation: powerPulse 1s ease-in-out infinite;
}
.t-gem:active{ transform: scale(.98); }

/* Gem envanter paneli */
.gem-sheet{
  position: fixed; inset: 0; z-index: 1002; display: none;
  align-items: flex-end; justify-content: center;
  background: rgba(0,0,0,.7); backdrop-filter: blur(4px);
}
.gem-sheet.show{ display: flex; animation: fadeUp .2s ease both; }
.gem-sheet-inner{
  width: 100%; max-width: var(--maxw); background: #0c0c16;
  border-top: 1px solid var(--border-cyan); border-radius: var(--r-xl) var(--r-xl) 0 0;
  padding: 16px 14px calc(16px + env(safe-area-inset-bottom,0px)); max-height: 70vh; overflow-y: auto;
}
.gem-sheet-title{ text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: 2px; color: var(--magenta); margin-bottom: 12px; }
.gem-grid{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
.gem-card{
  --gc: #888; position: relative;
  background: color-mix(in srgb, var(--gc) 12%, transparent);
  border: 2px solid var(--gc); border-radius: var(--r-md);
  padding: 13px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center;
}
.gem-card:active{ transform: scale(.97); }
.gem-card.fusing{ box-shadow: 0 0 14px color-mix(in srgb, var(--gc) 60%, transparent); border-width: 3px; }
.gem-badge{ position: absolute; top: 4px; right: 4px; font-size: 7px; font-weight: 900; color: var(--gc); background: color-mix(in srgb, var(--gc) 20%, transparent); border-radius: 4px; padding: 1px 4px; }
.gem-ic{ font-size: 30px; line-height: 1; }
.gem-nm{ font-size: 11px; font-weight: 700; color: var(--gc); letter-spacing: .5px; margin-top: 4px; }
.gem-desc{ font-size: 8px; color: var(--text-mute); line-height: 1.3; }
.gem-hint{ text-align: center; font-size: 8px; color: var(--gold); letter-spacing: 1px; font-weight: 700; padding: 10px 0 4px; }
.gem-close{ width: 100%; margin-top: 10px; padding: 12px; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim); border-radius: var(--r-md); font-weight: 800; font-size: 12px; }


`;
  document.head.appendChild(s);
}

export function openTetris(){
  injectCSS();
  if(G) return;   // oyun zaten açık
  if(document.querySelector('.hero-select-overlay')) return;  // seçim ekranı açık
  // Önce kahraman seçim ekranı, "OYNA"ya basınca oyun başlar
  buildHeroSelect(() => {
    if(SELECTED_MODE === 'adventure'){
      buildWorldSelect((worldId) => { ADVENTURE_WORLD = worldId; launchGame(); });
    } else if(SELECTED_MODE === 'versus'){
      buildVersusLobby();
    } else {
      ADVENTURE_WORLD = null;
      launchGame();
    }
  });
}

export default openTetris;
