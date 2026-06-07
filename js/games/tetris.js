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
import Auth from '../auth.js';
import * as Resume from './resume.js';
import { HEROES, HERO_KEYS, DEFAULT_HERO, resetHeroMods, POWER_CHARGE_LINES, isHeroUnlocked, unlockText } from './tetris-heroes.js';
import { GEMS, rollGem, GEM_MAX, GEM_BASE_CHANCE, FUSION_COUNT } from './tetris-gems.js';
import Sound from './tetris-audio.js';
import { THEMES, THEME_KEYS, DEFAULT_THEME, drawThemedCell } from './tetris-themes.js';
import { heroAvatar } from './tetris-avatars.js';
import { WORLDS, getProgress, isWorldUnlocked, completeWorld, calcStars, getWorld } from './tetris-adventure.js';
import { MP } from './tetris-mp.js';
import { Stats, ACHIEVEMENTS } from './tetris-stats.js';

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
  ai:       { key:'ai',       label:'AI RAKİP',    icon:'🤖', color:'#7C4DFF', desc:'Yapay zekaya karşı yarış' },
  versus:   { key:'versus',   label:'ÇOK OYUNCU',  icon:'🌐', color:'#00BCD4', desc:'Oda kur, arkadaşınla yarış' }
};
let SELECTED_MODE = (function(){ try{ return localStorage.getItem('hero_tetris_mode') || 'solo'; }catch(e){ return 'solo'; } })();
let ADVENTURE_WORLD = null;   // Macera modunda seçili dünya id'si
let RESUME_DATA = null;       // "kaldığın yerden devam" anlık görüntüsü (restore sırasında dolu)
const RESUMABLE_MODES = ['solo','survival','sprint','zen','adventure'];

// Tek-kişilik oyunda durumu kaydet (ai/versus hariç)
function saveTetrisResume(){
  if(!G || G.over || !G.board) return;
  if(!RESUMABLE_MODES.includes(G.mode)) return;
  try{
    Resume.saveSnapshot('tetris', {
      mode: G.mode, heroKey: SELECTED_HERO, theme: G.theme || SELECTED_THEME, advWorld: ADVENTURE_WORLD,
      board: G.board, bag: G.bag, queue: G.queue, cur: G.cur,
      holdType: G.holdType, canHold: G.canHold,
      score: G.score, level: G.level, lines: G.lines, tetrisCount: G.tetrisCount,
      charge: G.charge, powerReady: G.powerReady, gems: G.gems,
      elapsed: G.elapsed, survStep: G.survStep,
      combo: G.combo, b2b: G.b2b, maxComboThisGame: G.maxComboThisGame,
      speedMult: G.speedMult, baseInterval: G.baseInterval, dropInterval: G.dropInterval,
      shieldUsed: G.shieldUsed
    });
  }catch(e){}
}
// Kaydı yükleyip oyunu o moddan başlat
function resumeTetris(){
  const snap = Resume.loadSnapshot('tetris');
  if(!snap) return;
  const d = snap.data;
  SELECTED_MODE = d.mode || 'solo';
  if(d.heroKey) SELECTED_HERO = d.heroKey;
  if(d.theme) SELECTED_THEME = d.theme;
  ADVENTURE_WORLD = d.advWorld || null;
  RESUME_DATA = d;
  launchGame();
}
let AI_DIFFICULTY = 'normal'; // AI rakip zorluğu: easy/normal/hard
const SPRINT_TARGET = 40;
const LOCK_DELAY = 500;        // taş yere değince kilitlenmeden önce bekleme (ms)
const LOCK_MAX_RESETS = 15;    // sonsuz oyalanmayı önle: en fazla bu kadar tazeleme

// AI zorluk profilleri: satır temizleme hızı (ms) + tetris şansı
const AI_PROFILES = {
  easy:   { label:'KOLAY',  icon:'😊', color:'#69F0AE', dropMs:750, moveMs:260, tetrisChance:0.10, mult:0.7 },
  normal: { label:'NORMAL', icon:'🤖', color:'#7C4DFF', dropMs:480, moveMs:160, tetrisChance:0.20, mult:1.0 },
  hard:   { label:'ZOR',    icon:'👹', color:'#F44336', dropMs:280, moveMs:90,  tetrisChance:0.32, mult:1.3 }
};

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
  if(G) G.visualY = piece.y;   // yeni parça: yumuşak düşme referansını sıfırla
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
  G.lockTimer = 0; G.lockResets = 0;
  const linesBefore = G.lines;
  // T-spin tespiti: T parçası + son hamle döndürme + 3+ köşe dolu
  G.tspin = detectTSpin();
  matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
    const x = G.cur.x + cx, y = G.cur.y + cy;
    if(y >= 0) G.board[y][x] = G.cur.color;
  });
  clearLines();
  // Satır temizlemeyen T-spin (mini): clearLines içinde işlenmedi, burada ödüllendir
  if(G.tspin){
    G.score += 400 * G.level;
    showTspin('T-SPIN!');
    G.tspin = false;
    updateHUD();
  }
  // Satır temizlenmediyse combo sıfırla
  if(G.lines === linesBefore){ G.combo = 0; }
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
    // Admin yenilmez mod: ölme, üst yarıyı temizle ve devam et
    if(G.godmode){
      const half = Math.floor(ROWS/2);
      for(let i=0;i<half;i++){ G.board.shift(); G.board.push(Array(COLS).fill(0)); }
      G.cur.y = 0; G.cur.x = 3;
      flash('🛡️ YENİLMEZ');
      if(collides(G.cur, 0, 0)){ // hâlâ sığmıyorsa tahtayı tamamen temizle
        G.board = Array.from({length:ROWS}, () => Array(COLS).fill(0));
      }
      return;
    }
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
    // Satır kayma/flaş animasyonu: silinen satırları kısa süre beyaz parlat
    if(!G.clearFlash) G.clearFlash = [];
    clearedRows.forEach(ry => G.clearFlash.push({ y: ry, life: 1 }));
    // Combo takibi (arka arkaya temizleme)
    G.combo = (G.combo || 0) + 1;
    if(G.combo > (G.maxComboThisGame || 0)) G.maxComboThisGame = G.combo;
    if(G.combo > 1){ showCombo(G.combo); G.score += (G.combo - 1) * 50; }
    // Görsel + ses (combo'ya göre daha bol parçacık)
    spawnLineParticles(clearedRows, cleared);
    flashRows(clearedRows, cleared);
    screenShake(cleared >= 4 ? 12 : 5 + cleared);
    if(cleared >= 4) Sound.tetris(); else Sound.line(cleared);

    G.lines += cleared;
    let lineScore = Math.round(LINE_SCORE[cleared] * G.level * (G.speedBonus || 1));
    // "Zor temizleme" = tetris (4 satır) veya satır temizleyen T-spin
    const isDifficult = (cleared === 4) || (G.tspin && cleared > 0);
    // Back-to-back: arka arkaya zor temizleme → %50 bonus
    let b2bActive = false;
    if(isDifficult){
      if(G.b2b){ b2bActive = true; }   // önceki de zordu → B2B aktif
      G.b2b = true;
    } else if(cleared > 0){
      G.b2b = false;   // normal temizleme zinciri kırar
    }
    // T-spin bonusu
    if(G.tspin){
      const tspinBonus = (cleared === 0 ? 400 : cleared * 500) * G.level;
      lineScore += tspinBonus;
      const label = cleared === 0 ? 'T-SPIN!' : (cleared === 1 ? 'T-SPIN TEK!' : cleared === 2 ? 'T-SPIN ÇİFT!' : 'T-SPIN ÜÇLÜ!');
      showTspin(label);
      G.tspin = false;
    } else if(cleared === 4){ G.tetrisCount++; flash('🔥 TETRİS!'); }
    // B2B çarpanı uygula + göster
    if(b2bActive){ lineScore = Math.round(lineScore * 1.5); showB2B(); }
    G.score += lineScore;
    // Perfect Clear: satır temizledikten sonra tahta TAMAMEN boşsa devasa bonus
    const boardEmpty = G.board.every(row => row.every(c => !c));
    if(boardEmpty){
      const pcBonus = 3000 * G.level;
      G.score += pcBonus;
      showPerfectClear();
    }
    // Versus/AI: rakibe çöp gönder (2 satır=1, 3=2, 4=4 çöp sırası)
    if(G.versus){
      const garbageMap = { 1:0, 2:1, 3:2, 4:4 };
      const g = garbageMap[cleared] || 0;
      if(G.ai){
        // AI'ya gerçek çöp gönder (tahtasına eklenir)
        if(g > 0){ G.aiPendingGarbage += g; }
      } else if(MP.connected){
        if(g > 0) MP.send({ type:'garbage', rows:g });
        sendVersusState();
      }
    }
    // Golem: her 20 satırda alt sırayı temizle (sarsıntı)
    if(G.golemQuake && Math.floor(G.lines/20) > Math.floor((G.lines-cleared)/20)){
      G.board.shift(); G.board.push(Array(COLS).fill(0)); flash('🌋 SARSINTI'); screenShake(8);
    }
    // Güç şarjı (her satır şarjı doldurur)
    if(!G.powerReady){
      G.charge = Math.min(POWER_CHARGE_LINES, G.charge + cleared);
      if(G.charge >= POWER_CHARGE_LINES){ G.powerReady = true; flash('⚡ GÜÇ HAZIR!'); }
      updatePowerBtn();
    }
    const newLevel = Math.floor(G.lines / 10) + 1;
    if(newLevel > G.level){ G.level = newLevel; Sound.level(); if(G.mode!=='zen' && G.mode!=='survival') showLevelUp(G.level); }
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
function move(dir){ if(!G.cur || G.over || G.paused || G.countdown > 0) return; if(!collides(G.cur, dir, 0)){ G.cur.x += dir; G.lastMoveRotate = false; Sound.move(); resetLockDelay(); } }
function softDrop(){
  if(!G.cur || G.over || G.paused || G.countdown > 0) return;
  const step = G.softSpeedMult > 1 ? 2 : 1;   // Flash: 2 hücre
  let moved = false;
  for(let i=0;i<step;i++){ if(!collides(G.cur, 0, 1)){ G.cur.y++; moved = true; } else break; }
  if(moved){ G.score += (G.softBonus ? 2 : 1); Sound.soft(); updateHUD(); G.dropAcc = 0; }
}
function hardDrop(){
  if(!G.cur || G.over || G.paused || G.countdown > 0) return;
  let d = 0; while(!collides(G.cur, 0, 1)){ G.cur.y++; d++; }
  G.visualY = G.cur.y;   // anında otur (yumuşak gecikme yok)
  G.score += d * 2 + (G.hardDropBonus || 0); Sound.hard(); updateHUD(); lock(); G.dropAcc = 0;
}
// T-spin tespiti: T parçası, son hamle döndürme ve merkez köşelerinin 3+'sı dolu
function detectTSpin(){
  if(!G || !G.cur || G.cur.type !== 'T' || !G.lastMoveRotate) return false;
  // T parçasının dönüş merkezini bul (3x3 matriste orta hücre = [1,1])
  const cx = G.cur.x + 1, cy = G.cur.y + 1;   // merkez hücre koordinatı
  // 4 köşe: merkeze göre çapraz
  const corners = [[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1]];
  let filled = 0;
  for(const [x,y] of corners){
    // duvar/zemin dışı veya dolu hücre = "dolu köşe"
    if(x < 0 || x >= COLS || y >= ROWS) filled++;
    else if(y >= 0 && G.board[y][x]) filled++;
  }
  return filled >= 3;
}

// Lock delay tazeleme: taş yere değmişken hareket/döndürme yapılırsa
// kilitlenme sayacını sıfırla (sınırlı sayıda, sonsuz oyalanmayı önler)
function resetLockDelay(){
  if(!G) return;
  if(collides(G.cur, 0, 1)){   // sadece yere değiyorsa anlamlı
    if((G.lockResets || 0) < LOCK_MAX_RESETS){
      G.lockTimer = 0;
      G.lockResets = (G.lockResets || 0) + 1;
    }
  }
}

function rotate(dir){
  if(!G.cur || G.over || G.paused || G.countdown > 0) return;
  const r = (dir === 'ccw') ? rotateCCW(G.cur.matrix) : rotateCW(G.cur.matrix);
  // SRS tarzı duvar tekmesi: yatay + dikey kaydırma denemeleri
  // (taş duvara/bloğa değse bile uygun bir konuma kayarak döner)
  const kicks = [
    [0,0], [-1,0], [1,0], [-2,0], [2,0],   // yatay
    [0,-1], [-1,-1], [1,-1],                // yukarı + yatay (T-spin/kıvrım için)
    [0,-2]                                   // I parçası için yukarı
  ];
  for(const [kx, ky] of kicks){
    if(!collides(G.cur, kx, ky, r)){
      G.cur.matrix = r; G.cur.x += kx; G.cur.y += ky; Sound.rotate();
      G.lastMoveRotate = true;   // T-spin algılama için
      resetLockDelay();   // döndürünce kilit gecikmesini tazele
      if(G.rotBonus){ G.score += G.rotBonus; updateHUD(); }
      return;
    }
  }
}
function hold(){
  if(!G.cur || G.over || G.paused || !G.canHold || G.countdown > 0) return;
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
  if(!ghost && G && G.colorBlind) drawCBSymbol(ctx, x*size, y*size, size, color);
}

// Renk körü modu: her parça rengine özgü sembol çiz
const CB_SYMBOLS = {
  '#00E5FF':'I', '#FFD740':'O', '#E040FB':'T', '#69F0AE':'S',
  '#FF5252':'Z', '#42A5F5':'J', '#FF9800':'L', '#5a5a6e':'×'
};
function drawCBSymbol(ctx, px, py, size, color){
  const sym = CB_SYMBOLS[color];
  if(!sym) return;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.font = 'bold ' + Math.floor(size*0.5) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(sym, px + size/2, py + size/2 + 1);
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText(sym, px + size/2, py + size/2);
  ctx.restore();
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
  // Satır temizleme flaşı (silinen satır konumunda kısa beyaz bant)
  if(G.clearFlash && G.clearFlash.length){
    for(let i=G.clearFlash.length-1;i>=0;i--){
      const f = G.clearFlash[i];
      ctx.globalAlpha = f.life * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
      ctx.fillRect(0, f.y * s, COLS * s, s);
      f.life -= 0.12;
      if(f.life <= 0) G.clearFlash.splice(i,1);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  // hayalet (düşüş yeri)
  if(G.cur && !G.over){
    let gy = 0; while(!collides(G.cur, 0, gy+1)) gy++;
    matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
      const x = G.cur.x+cx, y = G.cur.y+cy+gy;
      if(y >= 0) cell(ctx, x, y, s, G.cur.color, true);
    });
    // aktif parça — yumuşak düşme (görsel Y mantıksal Y'ye doğru kayar)
    if(G.visualY === undefined) G.visualY = G.cur.y;
    const offset = (G.visualY - G.cur.y) * s;   // genelde 0..-s arası (yukarıdan kayar)
    matrixCells(G.cur.matrix).forEach(([cx,cy]) => {
      const x = G.cur.x+cx, y = G.cur.y+cy;
      if(y >= 0) cellF(ctx, x*s, y*s + offset, s, G.cur.color);
    });
  }
}

// Hücreyi piksel konumunda çiz (yumuşak düşme için kesirli y)
function cellF(ctx, px, py, size, color){
  ctx.save();
  ctx.translate(px, py);
  drawThemedCell(ctx, 0, 0, size, color, (G && G.theme) || SELECTED_THEME, false);
  if(G && G.colorBlind) drawCBSymbol(ctx, 0, 0, size, color);
  ctx.restore();
}

// AI tahtasını çiz (bölünmüş ekran, küçük)
function drawAIBoard(){
  if(!G || !G.ai || !G.aiCtx || !G.aiCell) return;
  const ctx = G.aiCtx, s = G.aiCell;
  ctx.clearRect(0,0,G.el.aiCanvas.width,G.el.aiCanvas.height);
  ctx.fillStyle = 'rgba(255,255,255,.015)';
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){ if((x+y)%2===0) ctx.fillRect(x*s, y*s, s, s); }
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if(G.aiBoard[y][x]){ drawThemedCell(ctx, x, y, s, G.aiBoard[y][x], 'neon', false); }
  }
  if(G.aiCur && G.oppAlive){
    matrixCells(G.aiCur.matrix).forEach(([cx,cy]) => {
      const x = G.aiCur.x+cx, y = G.aiCur.y+cy;
      if(y >= 0) drawThemedCell(ctx, x, y, s, G.aiCur.color, 'neon', false);
    });
  }
  if(!G.oppAlive){
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0,0,G.el.aiCanvas.width,G.el.aiCanvas.height);
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
  if(!G || G.over || G.paused || !G.powerReady || G.countdown > 0) return;
  const h = G.hero;
  const api = {
    board: G.board, COLS, ROWS,
    emptyRow: () => Array(COLS).fill(0),
    addScore: (n) => { G.score += Math.round(n || 0); },
    slowTime: (ms) => { G.slowUntil = performance.now() + ms; },
    clearFullest: (n) => {
      let total = 0;
      for(let k=0;k<n;k++){
        let bR=-1, bF=0;
        for(let r=0;r<ROWS;r++){ const f=G.board[r].filter(c=>c).length; if(f>bF){bF=f;bR=r;} }
        if(bR>=0 && bF>0){ G.board.splice(bR,1); G.board.unshift(Array(COLS).fill(0)); total+=bF; }
      }
      return total;
    },
    clearBottom: (n) => {
      let m=0; for(let i=0;i<n;i++){ if(G.board[ROWS-1].some(c=>c)){ G.board.splice(ROWS-1,1); G.board.unshift(Array(COLS).fill(0)); m++; } } return m;
    },
    scatter: (ratio) => {
      let removed=0;
      for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ if(G.board[r][c] && Math.random()<ratio){ G.board[r][c]=0; removed++; } }
      return removed;
    },
    gravity: () => {
      for(let c=0;c<COLS;c++){ const col=[]; for(let r=0;r<ROWS;r++) if(G.board[r][c]) col.push(G.board[r][c]); const st=ROWS-col.length; for(let r=0;r<ROWS;r++) G.board[r][c]=(r>=st)?col[r-st]:0; }
    },
    clearTallest: () => {
      let bC=-1, bH=0;
      for(let c=0;c<COLS;c++){ let h=0; for(let r=0;r<ROWS;r++){ if(G.board[r][c]){ h=ROWS-r; break; } } if(h>bH){bH=h;bC=c;} }
      if(bC>=0){ for(let r=0;r<ROWS;r++) G.board[r][bC]=0; }
      return bH;
    }
  };
  let msg = '';
  try{ msg = h.power.run(api) || h.power.name; }catch(e){ console.warn('[tetris] power', e); msg = h.power.name; }
  // Şarjı sıfırla
  G.charge = 0; G.powerReady = false;
  G.powersUsedCount = (G.powersUsedCount || 0) + 1;
  updatePowerBtn(); updateHUD();
  Sound.power();
  powerFX(h); screenShake(10);
  spawnPowerParticles(h.color);   // kahramana özel patlama
  flash('⚡ ' + msg);
}

// Güç kullanınca kahraman renginde büyük parçacık patlaması
function spawnPowerParticles(color){
  if(!G || !G.particles) G.particles = [];
  const s = G.cellSize;
  const cx = COLS * s / 2, cy = ROWS * s / 2;
  for(let i=0;i<80;i++){
    const ang = (i / 80) * Math.PI * 2 + Math.random()*0.3;
    const spd = 4 + Math.random() * 10;
    G.particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 1, decay: 0.012 + Math.random()*0.02,
      size: 3 + Math.random()*4,
      color: color || '#FFD740',
      glow: true
    });
  }
  if(G.particles.length > 600) G.particles = G.particles.slice(-600);
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
  const colors = ['#00E5FF','#FF4081','#FFD740','#69F0AE','#E040FB','#42A5F5','#FF6E40','#B388FF'];
  // combo ve satır sayısına göre daha bol parçacık
  const density = count * 2 + (G.combo > 1 ? G.combo : 0);
  rows.forEach(ry => {
    const py = ry * s + s/2;
    for(let i=0;i<COLS*density;i++){
      const px = Math.random() * COLS * s;
      const ang = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * (count >= 4 ? 9 : 6);
      G.particles.push({
        x: px, y: py,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        life: 1, decay: 0.015 + Math.random()*0.025,
        size: 2 + Math.random()*(count>=4?4:3),
        color: colors[Math.floor(Math.random()*colors.length)],
        glow: count >= 4
      });
    }
  });
  if(G.particles.length > 600) G.particles = G.particles.slice(-600);
}

// Temizlenen satırlarda beyaz flaş dalgası (silinmeden hemen önce hissi)
function flashRows(rows, count){
  if(!G || !G.el.fxLayer) return;
  const fx = G.el.fxLayer;
  fx.style.setProperty('--fxcol', count >= 4 ? '#FFD740' : '#ffffff');
  fx.classList.remove('lineflash'); void fx.offsetWidth; fx.classList.add('lineflash');
}

// Combo göstergesi (arka arkaya temizleme)
function showCombo(n){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-combo');
  if(!el){
    el = document.createElement('div');
    el.className = 't-combo';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.textContent = n + 'x COMBO!';
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

// T-spin göstergesi (özel mor parlama)
function showTspin(label){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-tspin');
  if(!el){
    el = document.createElement('div');
    el.className = 't-tspin';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.textContent = label;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  screenShake(9);
  Sound.power();
  // mor parçacık patlaması
  if(G.particles){
    const s = G.cellSize, cx = COLS*s/2, cy = ROWS*s/2;
    for(let i=0;i<60;i++){
      const ang = Math.random()*Math.PI*2, spd = 3+Math.random()*8;
      G.particles.push({ x:cx, y:cy, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, life:1, decay:0.012+Math.random()*0.02, size:3+Math.random()*4, color:'#E040FB', glow:true });
    }
  }
}

// Back-to-back göstergesi
function showB2B(){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-b2b');
  if(!el){
    el = document.createElement('div');
    el.className = 't-b2b';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.textContent = 'BACK-TO-BACK ×1.5';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}

// Perfect Clear (tüm tahta temizlendi) — en görkemli efekt
function showPerfectClear(){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-perfect');
  if(!el){
    el = document.createElement('div');
    el.className = 't-perfect';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.innerHTML = '<div class="pc-big">PERFECT!</div><div class="pc-sub">TÜM TEMİZLEME · +' + (3000*G.level).toLocaleString('tr-TR') + '</div>';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  screenShake(14);
  Sound.win();
  // gökkuşağı parçacık patlaması (her yerden)
  if(G.particles){
    const s = G.cellSize;
    const colors = ['#00E5FF','#FF4081','#FFD740','#69F0AE','#E040FB','#42A5F5','#FF6E40'];
    for(let i=0;i<120;i++){
      const ang = Math.random()*Math.PI*2, spd = 3+Math.random()*11;
      G.particles.push({
        x: COLS*s/2, y: ROWS*s/2,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
        life: 1, decay: 0.008+Math.random()*0.015,
        size: 3+Math.random()*5, color: colors[Math.floor(Math.random()*colors.length)], glow: true
      });
    }
  }
}

// Seviye atlama efekti (tam ekran banner + parçacık + sarsıntı)
function showLevelUp(lv){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-levelup');
  if(!el){
    el = document.createElement('div');
    el.className = 't-levelup';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.innerHTML = '<div class="lu-label">SEVİYE</div><div class="lu-num">' + lv + '</div>';
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  screenShake(8);
  // altın parçacık yağmuru
  if(G.particles){
    const s = G.cellSize;
    for(let i=0;i<50;i++){
      G.particles.push({
        x: Math.random() * COLS * s, y: -10,
        vx: (Math.random()-0.5) * 3, vy: 2 + Math.random() * 4,
        life: 1, decay: 0.01 + Math.random()*0.015,
        size: 3 + Math.random()*3, color: '#FFD740', glow: true
      });
    }
  }
}

function updateParticles(){
  if(!G || !G.particles || !G.particles.length) return;
  const ctx = G.ctx;
  for(let i=G.particles.length-1;i>=0;i--){
    const p = G.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.vx *= 0.99; p.life -= p.decay;
    if(p.life <= 0){ G.particles.splice(i,1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = p.glow ? 12 : 7;
    const sz = p.size * (0.5 + p.life * 0.5);   // sönerken küçülür
    ctx.fillRect(p.x - sz/2, p.y - sz/2, sz, sz);
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
  G.gemsUsedCount = (G.gemsUsedCount || 0) + 1;
  updateGemBtn(); updateHUD();
  Sound.gemPick();
  powerFX(gem); screenShake(8);
  spawnPowerParticles(gem.c || '#FFD740');   // gem rengine özel patlama
  flash((gem.ic ? gem.ic + ' ' : '💎 ') + msg);
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
      <div class="hs-title">Herotetris</div>
      <div class="hs-top-right">
        <button class="t-icon" data-act="stats" title="İstatistik & Başarımlar">🏆</button>
        <button class="t-icon" data-act="tutorial" title="Nasıl oynanır">❓</button>
        <button class="t-icon" data-act="music" title="Müzik" style="opacity:${Sound.musicEnabled ? '1' : '0.4'}">🎵</button>
        <button class="t-icon" data-act="colorblind" title="Renk körü modu" style="opacity:${(function(){try{return localStorage.getItem('hero_tetris_colorblind')==='on'?'1':'0.4';}catch(e){return '0.4';}})()}">👁️</button>
        <button class="t-icon" data-act="sound" title="Ses">${Sound.enabled ? '🔊' : '🔇'}</button>
      </div>
    </div>
    ${(function(){ const s=Resume.loadSnapshot('tetris'); if(!s) return ''; const d=s.data; const mn=(MODES[d.mode]&&MODES[d.mode].label)||d.mode; return `<button class="hs-resume" data-act="resume">↩️ KALDIĞIN YERDEN DEVAM<small>${mn} · ${d.score||0} puan · ${Resume.fmtAge(s.age)}</small></button>`; })()}
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
  ov.querySelector('[data-act="tutorial"]').addEventListener('click', () => { showTutorial(); });
  ov.querySelector('[data-act="stats"]').addEventListener('click', () => { showStats(); });
  ov.querySelector('[data-act="music"]').addEventListener('click', (e) => {
    const on = Sound.toggleMusic();
    e.currentTarget.style.opacity = on ? '1' : '0.4';
    e.currentTarget.title = on ? 'Müzik açık' : 'Müzik kapalı';
  });
  ov.querySelector('[data-act="colorblind"]').addEventListener('click', (e) => {
    let on = false;
    try{ on = localStorage.getItem('hero_tetris_colorblind') !== 'on'; localStorage.setItem('hero_tetris_colorblind', on ? 'on' : 'off'); }catch(err){}
    e.currentTarget.style.opacity = on ? '1' : '0.4';
    e.currentTarget.title = on ? 'Renk körü modu açık' : 'Renk körü modu kapalı';
    if(G) G.colorBlind = on;   // oyun açıksa anında uygula
  });
  ov.querySelector('[data-act="play"]').addEventListener('click', () => { ov.remove(); onPick(); });
  const rb = ov.querySelector('[data-act="resume"]');
  if(rb) rb.addEventListener('click', () => { ov.remove(); resumeTetris(); });
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

// ── İSTATİSTİK & BAŞARIMLAR ekranı ──
function showStats(){
  const s = Stats.get();
  const unlocked = Stats.getUnlocked();
  const heroName = s.favoriteHero && HEROES[s.favoriteHero] ? HEROES[s.favoriteHero].name : '—';
  const statRows = [
    ['🎮','Oynanan Oyun', s.gamesPlayed],
    ['🏆','En Yüksek Skor', s.bestScore.toLocaleString('tr-TR')],
    ['📊','Toplam Satır', s.totalLines.toLocaleString('tr-TR')],
    ['🔥','Toplam Tetris', s.totalTetris],
    ['⚡','En Uzun Combo', s.bestCombo + 'x'],
    ['🚀','En Yüksek Seviye', s.maxLevel],
    ['💥','Kullanılan Güç', s.powersUsed],
    ['💠','Kullanılan Gem', s.gemsUsed],
    ['🤖','AI Galibiyeti', s.aiWins],
    ['🌐','Çok Oyuncu Galibiyeti', s.vsWins],
    ['👹','Yenilen Boss', s.bossesBeaten],
    ['⭐','Favori Kahraman', heroName]
  ].map(([ic,label,val]) => `<div class="st-row"><span class="st-ic">${ic}</span><span class="st-label">${label}</span><span class="st-val">${val}</span></div>`).join('');

  const achCards = ACHIEVEMENTS.map(a => {
    const on = unlocked.includes(a.id);
    return `<div class="ach-card ${on?'unlocked':'locked'}">
      <span class="ach-card-ic">${on ? a.icon : '🔒'}</span>
      <div class="ach-card-name">${a.name}</div>
      <div class="ach-card-desc">${on ? a.desc : '???'}</div>
    </div>`;
  }).join('');

  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay stats-overlay';
  ov.innerHTML = `
    <div class="hs-top">
      <div class="hs-title" style="font-size:16px">🏆 İSTATİSTİK</div>
      <button class="t-icon" data-act="stats-close">✕</button>
    </div>
    <div class="st-body">
      <div class="st-ach-head">📈 İSTATİSTİKLER</div>
      <div class="st-grid">${statRows}</div>
      <div class="st-ach-head">🏅 BAŞARIMLAR (${unlocked.length}/${ACHIEVEMENTS.length})</div>
      <div class="ach-grid">${achCards}</div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('[data-act="stats-close"]').addEventListener('click', () => ov.remove());
  return ov;
}

// ── ÖĞRETİCİ (Nasıl oynanır) ──
function showTutorial(){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay tutorial-overlay';
  ov.innerHTML = `
    <div class="hs-top">
      <div class="hs-title" style="font-size:16px">❓ NASIL OYNANIR</div>
      <button class="t-icon" data-act="tut-close">✕</button>
    </div>
    <div class="tut-body">
      <div class="tut-section">
        <div class="tut-head">🎯 AMAÇ</div>
        <p>Düşen taşları yan yana dizerek <b>tam satır</b> oluştur. Dolan satırlar silinir, puan kazanırsın. Taşlar tepeye ulaşırsa oyun biter.</p>
      </div>
      <div class="tut-section">
        <div class="tut-head">👆 DOKUNMATİK KONTROLLER</div>
        <div class="tut-row"><span class="tut-ic">↔️</span><div><b>Yana sürükle</b> — taşı sola/sağa hareket ettir</div></div>
        <div class="tut-row"><span class="tut-ic">👆</span><div><b>Dokun</b> — taşı döndür (sağ yarı saat yönü, sol yarı ters)</div></div>
        <div class="tut-row"><span class="tut-ic">👇</span><div><b>Aşağı sürükle</b> — taşı hızlı indir (yumuşak)</div></div>
        <div class="tut-row"><span class="tut-ic">👆</span><div><b>Yukarı çek</b> — sert bırak (anında en alta)</div></div>
      </div>
      <div class="tut-section">
        <div class="tut-head">🎮 BUTONLAR</div>
        <div class="tut-row"><span class="tut-ic">↺ ↻</span><div>Taşı sola / sağa döndür</div></div>
        <div class="tut-row"><span class="tut-ic">◀ ▶ ▼</span><div>Hareket ettir / aşağı indir</div></div>
        <div class="tut-row"><span class="tut-ic">⇄</span><div><b>TUT</b> — taşı sonraya sakla, sonra geri çağır</div></div>
        <div class="tut-row"><span class="tut-ic">⤓</span><div><b>SERT BIRAK</b> — taşı anında en alta düşür</div></div>
      </div>
      <div class="tut-section">
        <div class="tut-head">⚡ KAHRAMAN GÜCÜ</div>
        <p>Her kahramanın özel bir gücü var. <b>8 satır temizleyince</b> ⚡GÜÇ butonu dolar — bas, kahramanına özel etki patlasın (satır temizleme, yavaşlatma, puan vb).</p>
      </div>
      <div class="tut-section">
        <div class="tut-head">💎 S.GÜÇ (GEM)</div>
        <p>Taş yerleştikçe şansla <b>gem</b> kazanırsın (max 5). 💎S.GÜÇ panelinden gem kullan — bomba, lazer, zaman durdurma gibi güçlü etkiler. Aynı gemden <b>3 tane</b> birleşince ULTRA güce dönüşür!</p>
      </div>
      <div class="tut-section">
        <div class="tut-head">🔥 COMBO</div>
        <p>Arka arkaya satır temizlersen <b>combo</b> yaparsın — her combo ekstra puan! Üst üste tetris (4 satır) en yüksek puanı verir.</p>
      </div>
      <div class="tut-section">
        <div class="tut-head">🎲 OYUN MODLARI</div>
        <div class="tut-row"><span class="tut-ic">🎮</span><div><b>Solo</b> — klasik sonsuz mod</div></div>
        <div class="tut-row"><span class="tut-ic">⏱️</span><div><b>Hayatta Kal</b> — giderek hızlanır</div></div>
        <div class="tut-row"><span class="tut-ic">🏁</span><div><b>Sprint</b> — 40 satırı en hızlı temizle</div></div>
        <div class="tut-row"><span class="tut-ic">🧘</span><div><b>Zen</b> — rahat, baskısız oyna</div></div>
        <div class="tut-row"><span class="tut-ic">🗺️</span><div><b>Macera</b> — 8 dünya, boss savaşları</div></div>
        <div class="tut-row"><span class="tut-ic">🤖</span><div><b>AI Rakip</b> — bölünmüş ekran, yapay zekaya karşı</div></div>
        <div class="tut-row"><span class="tut-ic">🌐</span><div><b>Çok Oyuncu</b> — oda kur, arkadaşınla yarış</div></div>
      </div>
      <div class="tut-section">
        <div class="tut-head">⚔️ SALDIRI (AI / Çok Oyuncu)</div>
        <p>2+ satır birden temizlersen rakibe <b>çöp blok</b> gönderirsin: 2 satır→1, 3→2, <b>4 (tetris)→4 çöp</b>. Rakibinin tahtasını doldurup ele!</p>
      </div>
      <button class="tut-ok" data-act="tut-close">ANLADIM ▶</button>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-act="tut-close"]').forEach(b => b.addEventListener('click', () => ov.remove()));
  return ov;
}

// ── AI RAKİP: Zorluk seçim ekranı ──
function buildAISelect(onPick){
  const ov = document.createElement('div');
  ov.className = 'hero-select-overlay ai-select';
  let cards = '';
  Object.keys(AI_PROFILES).forEach(key => {
    const p = AI_PROFILES[key];
    cards += `
      <button class="ai-card" data-diff="${key}" style="--ac:${p.color}">
        <span class="ai-icon">${p.icon}</span>
        <div class="ai-info">
          <div class="ai-name">${p.label}</div>
          <div class="ai-desc">${key==='easy'?'Yavaş rakip, rahat yarış':key==='normal'?'Dengeli rakip':'Hızlı ve acımasız rakip'}</div>
        </div>
      </button>`;
  });
  ov.innerHTML = `
    <div class="hs-top">
      <div class="hs-title" style="font-size:16px">🤖 AI RAKİP</div>
      <button class="t-icon" data-act="back">← GERİ</button>
    </div>
    <div class="ws-progress">Zorluk seç — yapay zekaya karşı yarış</div>
    <div class="ai-grid">${cards}</div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('.ai-card').forEach(card => {
    card.addEventListener('click', () => { const d = card.dataset.diff; ov.remove(); onPick(d); });
  });
  ov.querySelector('[data-act="back"]').addEventListener('click', () => {
    ov.remove();
    buildHeroSelect(() => {
      if(SELECTED_MODE === 'ai'){ buildAISelect((d)=>{ AI_DIFFICULTY=d; launchAIGame(); }); }
      else if(SELECTED_MODE === 'adventure'){ buildWorldSelect((wid) => { ADVENTURE_WORLD = wid; launchGame(); }); }
      else if(SELECTED_MODE === 'versus'){ buildVersusLobby(); }
      else { ADVENTURE_WORLD = null; launchGame(); }
    });
  });
  return ov;
}

// ── Pano kopyalama yardımcısı (Clipboard API + fallback) ──
function copyText(text, onDone){
  const done = () => { if(onDone) onDone(); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopyText(text, done));
    } else { fallbackCopyText(text, done); }
  }catch(e){ fallbackCopyText(text, done); }
}
function fallbackCopyText(text, done){
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
    if(done) done();
  }catch(e){}
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
        <div class="vl-input-row">
          <input class="vl-input" data-el="codeInput" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters">
          <button class="vl-paste" data-act="paste" title="Yapıştır">📋</button>
        </div>
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
      statusEl.innerHTML = '<div class="vl-codebig" data-el="codebig">' + data + '</div>' +
        '<button class="vl-copy" data-act="copycode">📋 KODU KOPYALA</button>' +
        '<div class="vl-codehint">Bu kodu arkadaşına gönder, rakip bekleniyor…</div>' +
        '<div class="vl-spinner"></div>';
      statusEl.className = 'vl-status code';
      const cp = statusEl.querySelector('[data-act="copycode"]');
      if(cp) cp.addEventListener('click', () => {
        copyText(data, () => { cp.textContent = '✅ KOPYALANDI'; setTimeout(() => { cp.textContent = '📋 KODU KOPYALA'; }, 1600); });
      });
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
  const pasteBtn = ov.querySelector('[data-act="paste"]');
  if(pasteBtn) pasteBtn.addEventListener('click', async () => {
    try{
      if(navigator.clipboard && navigator.clipboard.readText){
        const txt = await navigator.clipboard.readText();
        codeInput.value = (txt || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
      }
    }catch(e){}
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
  // Skor sayaç animasyonu: gösterilen skoru hedefe doğru yumuşakça artır
  animateScore();
  G.el.level.textContent = G.level;
  G.el.lines.textContent = G.lines;
}

// Skoru yuvarlanan sayı efektiyle güncelle (hedefe doğru kademeli)
function animateScore(){
  if(!G || !G.el.score) return;
  const target = G.score;
  if(G.displayScore === undefined) G.displayScore = target;
  if(G.scoreRaf) return;   // zaten animasyon dönüyorsa tekrar başlatma
  const tick = () => {
    if(!G || !G.el.score){ return; }
    const diff = target - G.displayScore;
    if(Math.abs(diff) < 1){
      G.displayScore = target;
      G.el.score.textContent = target.toLocaleString('tr-TR');
      G.el.score.classList.remove('bump');
      G.scoreRaf = null;
      return;
    }
    // hedefe yaklaş (büyük artışlarda hızlı, sonda yavaş)
    G.displayScore += diff * 0.25 + Math.sign(diff);
    G.el.score.textContent = Math.round(G.displayScore).toLocaleString('tr-TR');
    G.scoreRaf = requestAnimationFrame(tick);
  };
  // skor artışında hafif "pop" efekti
  if(target > (G.displayScore || 0)){
    G.el.score.classList.remove('bump'); void G.el.score.offsetWidth; G.el.score.classList.add('bump');
  }
  G.scoreRaf = requestAnimationFrame(tick);
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
    // Oyun başı geri sayım: countdown bitene kadar taş düşmez
    if(G.countdown > 0){
      G.countdownAcc += dt;
      drawBoard(); drawSide();
      if(G.countdownAcc >= 800){
        G.countdownAcc = 0;
        G.countdown--;
        if(G.countdown > 0){ showCountdownText(String(G.countdown)); Sound.move(); }
        else { showCountdownText('BAŞLA!'); Sound.level(); }
      }
      G.raf = requestAnimationFrame(loop);
      return;
    }
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
    if(G.versus && !G.ai){
      G.vsSyncAcc = (G.vsSyncAcc || 0) + dt;
      if(G.vsSyncAcc >= 1000){ G.vsSyncAcc = 0; sendVersusState(); }
    }
    // AI rakip: botun ilerlemesini simüle et
    if(G.ai){ aiTick(dt); drawAIBoard(); }
    G.dropAcc += dt;
    // Flash "Zaman Yavaşlat" aktifse düşme aralığını 4x uzat
    const slowed = (G.slowUntil && ts < G.slowUntil);
    const interval = slowed ? G.dropInterval * 4 : G.dropInterval;
    const onGround = collides(G.cur, 0, 1);
    if(onGround){
      // Lock delay: yere değince hemen kilitleme, kısa süre hareket/döndürme şansı ver
      G.lockTimer = (G.lockTimer || 0) + dt;
      G.dropAcc = 0;
      if(G.lockTimer >= LOCK_DELAY || (G.lockResets || 0) >= LOCK_MAX_RESETS){
        lock(); G.lockTimer = 0; G.lockResets = 0;
      }
    } else {
      // Havadayken normal düşüş, kilit sayacı sıfır
      G.lockTimer = 0; G.lockResets = 0;
      if(G.dropAcc >= interval){ G.dropAcc = 0; G.cur.y++; G.lastMoveRotate = false; }
    }
    // Yumuşak düşme: görsel Y'yi mantıksal Y'ye doğru kaydır
    if(G.cur){
      if(G.visualY === undefined) G.visualY = G.cur.y;
      const dy = G.cur.y - G.visualY;
      if(Math.abs(dy) < 0.08) G.visualY = G.cur.y;
      else G.visualY += dy * Math.min(1, dt / 60);   // ~kademeli yaklaşma
    }
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

// Oyun sonu istatistik kaydı + açılan başarımları göster
function recordGameStats(won){
  if(!G) return;
  try{
    const newly = Stats.recordGame({
      score: G.score, lines: G.lines, tetrisCount: G.tetrisCount || 0,
      combo: G.maxComboThisGame || 0, level: G.level,
      hero: SELECTED_HERO, powersUsed: G.powersUsedCount || 0,
      gemsUsed: G.gemsUsedCount || 0, mode: G.mode, won: !!won
    });
    if(newly && newly.length){ showAchievements(newly); }
  }catch(e){ console.warn('[tetris] stats', e); }
}

// Açılan başarımları sırayla bildir (toast)
function showAchievements(list){
  if(!G || !G.root || !list.length) return;
  let i = 0;
  const showNext = () => {
    if(i >= list.length) return;
    const a = list[i++];
    let toast = document.createElement('div');
    toast.className = 'ach-toast';
    toast.innerHTML = '<span class="ach-ic">' + a.icon + '</span><div class="ach-txt"><div class="ach-unlocked">🏆 BAŞARIM AÇILDI</div><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div></div>';
    G.root.appendChild(toast);
    try{ Sound.level(); }catch(e){}
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.remove(); showNext(); }, 400);
    }, 2600);
  };
  showNext();
}

// Admin yenilmez mod aç/kapat
function toggleGodmode(){
  if(!G || !G.isAdmin) return;
  G.godmode = !G.godmode;
  if(G.el.godmodeBtn){
    G.el.godmodeBtn.classList.toggle('on', G.godmode);
    G.el.godmodeBtn.textContent = '🛡️ YENİLMEZ: ' + (G.godmode ? 'AÇIK' : 'KAPALI');
  }
  flash(G.godmode ? '🛡️ YENİLMEZ AÇIK' : '🛡️ YENİLMEZ KAPALI');
  try{ Sound.shield(); }catch(e){}
}
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
  try{ Resume.clearSnapshot('tetris'); }catch(e){}
  cancelAnimationFrame(G.raf);
  try{ Sound.stopMusic(); }catch(e){}
  // Versus/AI: rakibe öldüğünü bildir
  if(G.versus){
    if(!isWin && !G.ai && MP.connected) MP.send({ type:'dead' });
    Sound.gameover();
    const ov = G.el.gameover;
    // Rakip zaten elendiyse sen kazandın; yoksa sen elendin
    const won = !G.oppAlive;
    ov.querySelector('.go-title').textContent = won ? '🏆 KAZANDIN!' : '💀 ELENDİN';
    ov.querySelector('.go-score').textContent = G.score.toLocaleString('tr-TR');
    ov.querySelector('.go-lines').textContent = 'Sen: ' + G.lines + ' satır  ·  ' + (G.oppNick||'Rakip') + ': ' + (G.oppLines||0) + ' satır';
    ov.querySelector('.go-reward').textContent = won ? '🥜 +100 zafer ödülü' : '';
    ov.querySelector('.go-record').style.display = 'none';
    try{ if(won) await Store.addKaju(100, G.ai ? 'tetris-ai' : 'tetris-vs'); await Store.addScore('tetris', G.score); }catch(e){}
    recordGameStats(won);
    ov.classList.add('show');
    if(!G.ai){ setTimeout(() => { try{ MP.close(); }catch(e){} }, 500); }
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
  recordGameStats(isWin);
  ov.classList.add('show');
}

// ── DOM kurulumu ────────────────────────────────────────────────
function build(){
  const root = document.createElement('div');
  root.className = 'tetris-overlay';
  root.innerHTML = `
    <div class="tetris-topbar">
      <button class="t-icon" data-act="exit">✕</button>
      <div class="t-title">Herotetris <span class="t-herobadge"></span><span class="t-shielddot" style="display:none">🛡️</span></div>
      <button class="t-icon" data-act="chat" data-el="chatBtn" title="Sohbet" style="display:none">💬<span class="t-chat-badge" data-el="chatBadge" style="display:none"></span></button>
      <button class="t-icon" data-act="pause">⏸</button>
    </div>
    <button class="t-godmode" data-act="godmode" style="display:none">🛡️ YENİLMEZ: KAPALI</button>
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
        <canvas class="tetris-ai-canvas" style="display:none"></canvas>
        <div class="t-ai-label" style="display:none">🤖 AI</div>
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
          <div class="pause-title">⏸ DURAKLATILDI</div>
          <div class="pause-stats" data-el="pauseStats"></div>
          <button class="go-btn primary" data-act="resume">▶ DEVAM ET</button>
          <button class="go-btn" data-act="restart">🔄 YENİDEN BAŞLA</button>
          <button class="go-btn" data-act="quit">🏠 ANA MENÜ</button>
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
    </div>
    <div class="t-chat" data-el="chatPanel" style="display:none">
      <div class="t-chat-head">
        <span>💬 Sohbet</span>
        <button class="t-chat-close" data-act="chatClose">✕</button>
      </div>
      <div class="t-chat-msgs" data-el="chatMsgs"></div>
      <div class="t-chat-quick" data-el="chatQuick"></div>
      <div class="t-chat-input-row">
        <input class="t-chat-input" data-el="chatInput" maxlength="120" placeholder="Mesaj yaz…" autocomplete="off">
        <button class="t-chat-send" data-act="chatSend">➤</button>
      </div>
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
  let cs;
  if(G.ai && G.el.aiCanvas){
    // Bölünmüş ekran: oyuncu tahtası (büyük) + AI tahtası (küçük) yan yana
    // Genişliği paylaş: oyuncu ~62%, AI ~34%, arada boşluk
    const gap = 8;
    const playerW = Math.floor((availW - gap) * 0.64);
    const aiW = Math.floor((availW - gap) * 0.36);
    const csW = Math.floor(playerW / COLS);
    const csH = Math.floor(availH / ROWS);
    cs = Math.min(csW, csH);
    if(cs < 8) cs = 8;
    G.cellSize = cs;
    // AI hücre boyutu (kendi genişliğine + yüksekliğe sığsın)
    const aiCsW = Math.floor(aiW / COLS);
    const aiCsH = Math.floor(availH / ROWS);
    let aiCs = Math.min(aiCsW, aiCsH);
    if(aiCs < 5) aiCs = 5;
    G.aiCell = aiCs;
    const dpr = window.devicePixelRatio || 1;
    G.canvas.width = COLS*cs*dpr; G.canvas.height = ROWS*cs*dpr;
    G.canvas.style.width = (COLS*cs)+'px'; G.canvas.style.height = (ROWS*cs)+'px';
    G.ctx.setTransform(dpr,0,0,dpr,0,0);
    G.el.aiCanvas.width = COLS*aiCs*dpr; G.el.aiCanvas.height = ROWS*aiCs*dpr;
    G.el.aiCanvas.style.width = (COLS*aiCs)+'px'; G.el.aiCanvas.style.height = (ROWS*aiCs)+'px';
    G.aiCtx.setTransform(dpr,0,0,dpr,0,0);
    return;
  }
  const csW = Math.floor(availW / COLS);
  const csH = Math.floor(availH / ROWS);
  cs = Math.min(csW, csH);
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
      else if(a==='quit') close();
      else if(a==='power') usePower();
      else if(a==='gem') openGemSheet();
      else if(a==='gemclose') closeGemSheet();
      else if(a==='godmode') toggleGodmode();
    });
  });

  // ── Tahta üzerinde dokunmatik jestler ──
  bindTouchGestures();

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

// Tahta üzerinde dokunmatik jest kontrolleri (sürükle/dokun)
function bindTouchGestures(){
  const wrap = G.root.querySelector('.tetris-board-wrap');
  if(!wrap) return;
  let active = false;
  let startX = 0, startY = 0, lastX = 0, lastY = 0;
  let startT = 0;
  let movedH = 0, movedV = 0;   // toplam hareket (jest tipini ayırmak için)
  let didHardDrop = false;
  let dragColumns = 0;          // sürüklemeyle yapılan yatay adım sayısı
  let gestureLock = null;       // 'vertical' → yukarı çekme jesti, yatay kilitli

  const onStart = (e) => {
    if(!G || G.over || G.paused) return;
    const t = e.touches ? e.touches[0] : e;
    active = true;
    startX = lastX = t.clientX;
    startY = lastY = t.clientY;
    startT = Date.now();
    movedH = movedV = 0; dragColumns = 0; didHardDrop = false; gestureLock = null;
  };

  const onMove = (e) => {
    if(!active || !G || G.over || G.paused) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - lastX;
    const dy = t.clientY - lastY;
    const cell = G.cellSize || 24;
    movedH += Math.abs(dx); movedV += Math.abs(dy);

    // Jest kilidi: toplam dikey hareket yataydan belirgin fazlaysa "dikey jest"e kilitlen
    // (yukarı çekerken parmağın hafif sağa-sola kayması parçayı oynatmasın)
    const totalUp = startY - t.clientY;   // yukarı = pozitif
    if(totalUp > cell * 0.8 && movedV > movedH * 1.3){
      gestureLock = 'vertical';
    }

    // Yatay hareket — sadece dikey kilit YOKSA uygula
    if(gestureLock !== 'vertical'){
      const stepThresh = Math.max(18, cell * 0.7);
      if(Math.abs(t.clientX - startX) >= stepThresh * (Math.abs(dragColumns) + 1) && Math.abs(dx) > 1){
        if(dx > 0){ move(1); dragColumns++; } else { move(-1); dragColumns--; }
        e.preventDefault();
      }
    }
    // Aşağı sürükleme: yumuşak düşür (yalnızca aşağı yönde, dikey kilitliyse de izin ver)
    if(dy > Math.max(14, cell * 0.6)){
      softDrop();
      e.preventDefault();
    }
    // Konumu her zaman güncelle (yukarı swipe tespiti için onEnd'de gerekli)
    lastX = t.clientX;
    lastY = t.clientY;
  };

  const onEnd = (e) => {
    if(!active) return;
    active = false;
    if(!G || G.over || G.paused) return;
    const dt = Date.now() - startT;
    const totalUp = startY - lastY;   // yukarı = pozitif
    const cell = G.cellSize || 24;

    // YUKARI çekme → sert bırak. Dikey kilide girdiyse veya yeterince yukarı çekildiyse.
    // (yatay sürüklemeyle karışmasın diye movedV > movedH kontrolü)
    if((gestureLock === 'vertical' || totalUp > cell * 1.5) && movedV >= movedH){
      hardDrop();
      return;
    }
    // Dokunma (tap): çok az hareket + kısa süre → döndür
    if(movedH < 12 && movedV < 12 && dt < 250){
      const rect = wrap.getBoundingClientRect();
      const tapX = startX - rect.left;
      if(tapX > rect.width / 2) rotate('cw');
      else rotate('ccw');
    }
  };

  // Pointer events (hem dokunmatik hem fare)
  wrap.addEventListener('touchstart', onStart, { passive: true });
  wrap.addEventListener('touchmove', onMove, { passive: false });
  wrap.addEventListener('touchend', onEnd);
  wrap.addEventListener('touchcancel', () => { active = false; });
  // Fare ile de test edilebilsin (masaüstü)
  wrap.addEventListener('pointerdown', (e) => { if(e.pointerType !== 'touch') onStart(e); });
  wrap.addEventListener('pointermove', (e) => { if(e.pointerType !== 'touch' && active) onMove(e); });
  wrap.addEventListener('pointerup', (e) => { if(e.pointerType !== 'touch') onEnd(e); });
}

function togglePause(on){
  if(!G || G.over) return;
  G.paused = on;
  if(on){
    const st = G.root.querySelector('[data-el="pauseStats"]');
    if(st) st.innerHTML = 'Skor <b>' + G.score.toLocaleString('tr-TR') + '</b> · Satır <b>' + G.lines + '</b> · Seviye <b>' + G.level + '</b>';
  }
  G.root.querySelector('.tetris-pause').classList.toggle('show', on);
  G.last = 0;
}

function startGame(){
  if(!RESUME_DATA && RESUMABLE_MODES.includes(SELECTED_MODE)) Resume.clearSnapshot('tetris');   // taze oyun → eski devam kaydını sil
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
  G.previewCount = Math.min(5, Math.max(3, G.hero.preview || 3));   // taban 3, kahramana göre 5'e kadar
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
  G.combo = 0;
  G.lockTimer = 0;
  G.lockResets = 0;
  G.countdown = 0;
  G.countdownAcc = 0;
  G.powersUsedCount = 0;
  G.gemsUsedCount = 0;
  G.maxComboThisGame = 0;
  G.displayScore = 0;
  if(G.scoreRaf){ cancelAnimationFrame(G.scoreRaf); G.scoreRaf = null; }
  G.tspin = false;
  G.lastMoveRotate = false;
  G.b2b = false;
  G.clearFlash = [];
  G.visualY = 0;
  try{ G.colorBlind = localStorage.getItem('hero_tetris_colorblind') === 'on'; }catch(e){ G.colorBlind = false; }

  // ── Admin yenilmez mod (default KAPALI; sadece admin görür) ──
  G.godmode = false;
  let admin = false;
  try{ admin = Auth.getState().isAdmin === true; }catch(e){ admin = false; }
  G.isAdmin = admin;
  if(G.el.godmodeBtn){
    G.el.godmodeBtn.style.display = admin ? 'block' : 'none';
    G.el.godmodeBtn.classList.remove('on');
    G.el.godmodeBtn.textContent = '🛡️ YENİLMEZ: KAPALI';
  }

  fitCanvas(); updateHUD(); drawSide(); updateHeroBar();
  G.el.gameover.classList.remove('show');
  G.el.pause.classList.remove('show');
  cancelAnimationFrame(G.raf);

  // ── Kaldığın yerden devam: dinamik durumu geri yükle ──
  if(RESUME_DATA){
    const d = RESUME_DATA; RESUME_DATA = null;
    try{
      if(d.board) G.board = d.board;
      if(d.bag) G.bag = d.bag;
      if(d.queue) G.queue = d.queue;
      if(d.cur) G.cur = d.cur;
      G.holdType = d.holdType || null; G.canHold = d.canHold !== false;
      G.score = d.score||0; G.level = d.level||1; G.lines = d.lines||0; G.tetrisCount = d.tetrisCount||0;
      G.charge = d.charge||0; G.powerReady = !!d.powerReady;
      if(Array.isArray(d.gems)) G.gems = d.gems;
      G.elapsed = d.elapsed||0; G.survStep = d.survStep||0;
      G.combo = d.combo||0; G.b2b = !!d.b2b; G.maxComboThisGame = d.maxComboThisGame||0;
      if(d.speedMult) G.speedMult = d.speedMult;
      if(d.baseInterval) G.baseInterval = d.baseInterval;
      G.dropInterval = d.dropInterval || Math.round(G.baseInterval * G.speedMult);
      G.shieldUsed = !!d.shieldUsed;
      G.displayScore = G.score; G.visualY = G.cur ? G.cur.y : 0;
      updateHUD(); drawSide(); updateHeroBar(); updatePowerBtn(); updateGemBtn(); updateModeUI();
    }catch(e){ console.warn('[tetris] resume override', e); }
  }

  try{ Sound.startMusic(); }catch(e){}
  startCountdown();
  G.raf = requestAnimationFrame(loop);
}

// Oyun başı geri sayım: 3 → 2 → 1 → BAŞLA!
function startCountdown(){
  if(!G) return;
  G.countdown = 3;
  G.countdownAcc = 0;
  showCountdownText('3');
}

function showCountdownText(txt){
  if(!G || !G.root) return;
  let el = G.root.querySelector('.t-countdown');
  if(!el){
    el = document.createElement('div');
    el.className = 't-countdown';
    G.root.querySelector('.tetris-board-wrap').appendChild(el);
  }
  el.textContent = txt;
  el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
}
function restart(){
  if(G && G.root){ G.root.querySelector('.tetris-pause').classList.remove('show'); }
  startGame();
}

function close(){
  if(!G) return;
  try{ saveTetrisResume(); }catch(e){}
  cancelAnimationFrame(G.raf);
  try{ Sound.stopMusic(); }catch(e){}
  window.removeEventListener('keydown', G.keyHandler);
  window.removeEventListener('resize', G.resizeHandler);
  if(G.vis){ try{ document.removeEventListener('visibilitychange', G.vis); }catch(e){} }
  if(G.versus && !G.ai){ try{ MP.close(); }catch(e){} }
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
      aiCanvas: root.querySelector('.tetris-ai-canvas'),
      aiLabel: root.querySelector('.t-ai-label'),
      godmodeBtn: root.querySelector('.t-godmode'),
      fxLayer: root.querySelector('.t-fxlayer'),
      gemBtn: root.querySelector('.t-gem'),
      gemSheet: root.querySelector('.gem-sheet'),
      modeBar: root.querySelector('.t-modebar')
    },
    raf: 0
  };
  G.resizeHandler = () => { if(G){ fitCanvas(); drawBoard(); } };
  window.addEventListener('resize', G.resizeHandler);
  G.vis = () => { if(document.hidden){ try{ saveTetrisResume(); }catch(e){} } };
  document.addEventListener('visibilitychange', G.vis);
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
  setupTetrisChat();   // çok oyuncu sohbetini aç
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

// AI rakibe karşı oyunu başlat (bölünmüş ekran, gerçek AI tahtası)
function launchAIGame(){
  SELECTED_MODE = 'ai';
  ADVENTURE_WORLD = null;
  launchGame();
  if(!G) return;
  const prof = AI_PROFILES[AI_DIFFICULTY] || AI_PROFILES.normal;
  G.ai = true;
  G.versus = true;           // versus altyapısını kullan (çöp, skor, UI)
  G.aiProfile = prof;
  G.oppScore = 0; G.oppLines = 0; G.oppNick = prof.icon + ' AI (' + prof.label + ')'; G.oppAlive = true;
  G.pendingGarbage = 0;

  // AI gerçek tahtası + durumu
  G.aiBoard = Array.from({length:ROWS}, () => Array(COLS).fill(0));
  G.aiBag = newBag();
  G.aiCur = aiSpawn();
  G.aiDropAcc = 0;
  G.aiDropInterval = prof.dropMs || 600;   // AI parça düşme hızı
  G.aiMoveAcc = 0;
  G.aiPlan = null;            // AI'nın mevcut parça için hedef planı
  G.aiPendingGarbage = 0;     // oyuncudan AI'ya gelen çöp

  // Bölünmüş ekranı aç
  if(G.el.aiCanvas){ G.el.aiCanvas.style.display = 'block'; G.aiCtx = G.el.aiCanvas.getContext('2d'); }
  if(G.el.aiLabel){ G.el.aiLabel.style.display = 'block'; }
  G.root.querySelector('.tetris-board-wrap').classList.add('split');
  fitCanvas();
  updateVersusUI();
}

// AI için parça üret
function aiSpawn(){
  if(G.aiBag.length === 0) G.aiBag = newBag();
  const type = G.aiBag.shift();
  if(G.aiBag.length < 4) G.aiBag = G.aiBag.concat(newBag());
  const p = PIECES[type];
  return { type, color: p.color, matrix: toMatrix(p.cells), x: 3, y: 0 };
}

// AI botunun bir adımı (loop'tan çağrılır) — gerçek tahtada oynar
function aiTick(dt){
  if(!G || !G.ai || G.over || !G.oppAlive) return;
  const prof = G.aiProfile;

  // Mevcut parça için plan yoksa hesapla (en iyi sütun + dönüş)
  if(!G.aiPlan && G.aiCur){
    G.aiPlan = aiComputePlan(G.aiCur);
  }

  // AI hareketi: plana doğru adım adım (insansı hız)
  G.aiMoveAcc += dt;
  if(G.aiPlan && G.aiMoveAcc >= (prof.moveMs || 160)){
    G.aiMoveAcc = 0;
    const plan = G.aiPlan;
    // Önce hedef dönüşe ulaş
    if(plan.rot > 0){
      const r = rotateCW(G.aiCur.matrix);
      if(!aiCollides(G.aiCur, 0, 0, r)){ G.aiCur.matrix = r; }
      plan.rot--;
    } else if(G.aiCur.x < plan.x){
      if(!aiCollides(G.aiCur, 1, 0)) G.aiCur.x++;
    } else if(G.aiCur.x > plan.x){
      if(!aiCollides(G.aiCur, -1, 0)) G.aiCur.x--;
    }
  }

  // AI parça düşürme
  G.aiDropAcc += dt;
  if(G.aiDropAcc >= G.aiDropInterval){
    G.aiDropAcc = 0;
    if(!aiCollides(G.aiCur, 0, 1)){
      G.aiCur.y++;
    } else {
      aiLock();
    }
  }
}

// AI çarpışma kontrolü (kendi tahtasında)
function aiCollides(piece, dx, dy, matrix){
  const m = matrix || piece.matrix;
  for(const [cx, cy] of matrixCells(m)){
    const x = piece.x + cx + dx, y = piece.y + cy + dy;
    if(x < 0 || x >= COLS || y >= ROWS) return true;
    if(y >= 0 && G.aiBoard[y][x]) return true;
  }
  return false;
}

// AI: parça için en iyi yerleşimi hesapla (basit sezgisel)
function aiComputePlan(piece){
  let best = null;
  const rotations = [0, 1, 2, 3];
  for(const rot of rotations){
    let m = piece.matrix;
    for(let i=0;i<rot;i++) m = rotateCW(m);
    // her x konumu dene
    for(let x = -2; x < COLS; x++){
      const test = { type:piece.type, matrix:m, x:x, y:0, color:piece.color };
      if(aiCollides(test, 0, 0)) continue;
      // düşür
      let gy = 0; while(!aiCollides(test, 0, gy+1)) gy++;
      const landY = test.y + gy;
      // skoru hesapla (yükseklik + delik + düzlük)
      const score = aiEvaluate(test, landY, m);
      if(!best || score > best.score){
        best = { x:x, rot:rot, score:score };
      }
    }
  }
  return best || { x:piece.x, rot:0, score:0 };
}

// Yerleşim skoru: düşük yükseklik + az delik iyi
function aiEvaluate(piece, landY, m){
  // geçici yerleştir
  const temp = G.aiBoard.map(r => r.slice());
  for(const [cx, cy] of matrixCells(m)){
    const x = piece.x + cx, y = landY + cy;
    if(y >= 0 && y < ROWS && x >= 0 && x < COLS) temp[y][x] = piece.color;
  }
  let aggHeight = 0, holes = 0, lines = 0, bumpiness = 0;
  const heights = [];
  for(let x=0;x<COLS;x++){
    let h = 0, blocked = false, colHoles = 0;
    for(let y=0;y<ROWS;y++){
      if(temp[y][x]){ if(h===0) h = ROWS - y; blocked = true; }
      else if(blocked) colHoles++;
    }
    heights.push(h); aggHeight += h; holes += colHoles;
  }
  for(let y=0;y<ROWS;y++){ if(temp[y].every(c => c)) lines++; }
  for(let x=0;x<COLS-1;x++) bumpiness += Math.abs(heights[x] - heights[x+1]);
  // ağırlıklar (klasik Tetris AI sezgiseli)
  return lines*2.0 - aggHeight*0.4 - holes*1.5 - bumpiness*0.2;
}

// AI parçayı kilitle + satır temizle + oyuncuya çöp
function aiLock(){
  matrixCells(G.aiCur.matrix).forEach(([cx,cy]) => {
    const x = G.aiCur.x + cx, y = G.aiCur.y + cy;
    if(y >= 0 && y < ROWS && x >= 0 && x < COLS) G.aiBoard[y][x] = G.aiCur.color;
  });
  // satır temizle
  let cleared = 0;
  for(let y=ROWS-1;y>=0;y--){
    if(G.aiBoard[y].every(c => c)){ G.aiBoard.splice(y,1); G.aiBoard.unshift(Array(COLS).fill(0)); cleared++; y++; }
  }
  if(cleared > 0){
    G.oppLines += cleared;
    const lineScore = [0,100,300,500,800][cleared] || 100;
    G.oppScore += Math.round(lineScore * (G.aiProfile.mult||1));
    // Oyuncuya çöp gönder
    const garbageMap = { 1:0, 2:1, 3:2, 4:4 };
    const g = garbageMap[cleared] || 0;
    if(g > 0){ G.pendingGarbage += g; flash('⚠️ AI ' + g + ' çöp gönderdi!'); Sound.garbage(); }
    updateVersusUI();
  }
  // Oyuncudan gelen çöbü AI tahtasına uygula
  if(G.aiPendingGarbage > 0){
    aiApplyGarbage(G.aiPendingGarbage);
    G.aiPendingGarbage = 0;
  }
  // yeni parça
  G.aiCur = aiSpawn();
  G.aiPlan = null;
  // AI öldü mü (yeni parça sığmıyorsa)
  if(aiCollides(G.aiCur, 0, 0)){
    G.oppAlive = false;
    flash('🏆 AI elendi! Kazandın!');
    updateVersusUI();
    if(!G.over) endGame(true);
  }
}

// AI tahtasına çöp uygula (oyuncunun saldırısı)
function aiApplyGarbage(rows){
  for(let i=0;i<rows;i++){
    G.aiBoard.shift();
    const row = Array(COLS).fill('#5a5a6e');
    row[Math.floor(Math.random()*COLS)] = 0;
    G.aiBoard.push(row);
  }
  if(G.aiCur && aiCollides(G.aiCur, 0, 0)){ G.aiCur.y = Math.max(0, G.aiCur.y - rows); }
}

function handleVersusMessage(msg){
  if(!G || !msg) return;
  if(msg.type === 'hello'){ G.oppNick = msg.nick || 'Rakip'; updateVersusUI(); }
  else if(msg.type === 'state'){ G.oppScore = msg.score||0; G.oppLines = msg.lines||0; updateVersusUI(); }
  else if(msg.type === 'garbage'){ G.pendingGarbage += (msg.rows||0); flash('⚠️ ' + (msg.rows||0) + ' çöp geliyor!'); Sound.garbage(); updateVersusUI(); }
  else if(msg.type === 'dead'){ G.oppAlive = false; if(!G.over){ flash('🏆 Rakip eledin!'); } updateVersusUI(); }
  else if(msg.type === 'chat'){ addTetrisChatMessage((msg.text||'').slice(0,120), false); }
}

// ── ÇOK OYUNCU SOHBET ──
const TETRIS_QUICK_MSGS = ['İyi oyunlar! 👋', 'Aferin! 👏', 'Çok hızlısın!', 'Hadi bakalım! 🔥', 'İyi şanslar! 🍀', 'Rövanş? 😎'];

function setupTetrisChat(){
  if(!G || !G.root) return;
  G.chatOpen = false; G.unreadChat = 0;
  const chatBtn = G.root.querySelector('[data-el="chatBtn"]');
  if(chatBtn) chatBtn.style.display = 'flex';
  const panel = G.root.querySelector('[data-el="chatPanel"]');
  const quick = G.root.querySelector('[data-el="chatQuick"]');
  if(quick){
    quick.innerHTML = TETRIS_QUICK_MSGS.map(m => `<button class="t-chat-q">${m}</button>`).join('');
    quick.querySelectorAll('.t-chat-q').forEach((b, i) => b.addEventListener('click', () => sendTetrisChat(TETRIS_QUICK_MSGS[i])));
  }
  if(chatBtn) chatBtn.addEventListener('click', () => {
    G.chatOpen = true; if(panel) panel.style.display = 'flex';
    G.unreadChat = 0; updateTetrisChatBadge();
    const inp = G.root.querySelector('[data-el="chatInput"]');
    if(inp) setTimeout(() => inp.focus(), 50);
  });
  const closeBtn = G.root.querySelector('[data-act="chatClose"]');
  if(closeBtn) closeBtn.addEventListener('click', () => { G.chatOpen = false; if(panel) panel.style.display = 'none'; });
  const sendBtn = G.root.querySelector('[data-act="chatSend"]');
  const inp = G.root.querySelector('[data-el="chatInput"]');
  if(sendBtn && inp){
    sendBtn.addEventListener('click', () => { const t = inp.value.trim(); if(t){ sendTetrisChat(t); inp.value=''; } });
    inp.addEventListener('keydown', (e) => { if(e.key === 'Enter'){ const t = e.target.value.trim(); if(t){ sendTetrisChat(t); e.target.value=''; } } });
  }
}

function sendTetrisChat(text){
  if(!G || !MP.connected) return;
  text = (text||'').slice(0,120);
  MP.send({ type:'chat', text });
  addTetrisChatMessage(text, true);
}

function addTetrisChatMessage(text, mine){
  if(!G || !G.root) return;
  const box = G.root.querySelector('[data-el="chatMsgs"]');
  if(!box) return;
  const msg = document.createElement('div');
  msg.className = 't-chat-msg ' + (mine ? 'mine' : 'theirs');
  msg.textContent = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  if(!mine && !G.chatOpen){ G.unreadChat = (G.unreadChat||0) + 1; updateTetrisChatBadge(); }
}

function updateTetrisChatBadge(){
  const badge = G.root.querySelector('[data-el="chatBadge"]');
  if(!badge) return;
  if(G.unreadChat > 0){ badge.style.display = 'flex'; badge.textContent = G.unreadChat; }
  else { badge.style.display = 'none'; }
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
  bar.style.color = G.ai ? (G.aiProfile ? G.aiProfile.color : '#7C4DFF') : '#00BCD4';
  const prefix = G.ai ? '' : '🌐 ';
  let txt = prefix + (G.oppNick||'Rakip') + ': ' + (G.oppScore||0).toLocaleString('tr-TR') + ' · ' + (G.oppLines||0) + ' satır';
  if(!G.oppAlive) txt = '🏆 ' + (G.ai?'AI':'Rakip') + ' elendi! Sen kazandın!';
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
.t-pval.t-score{ color: var(--gold); text-shadow: var(--glow-gold); font-size: 15px; transition: transform .1s ease; display: inline-block; }
.t-pval.t-score.bump{ animation: scoreBump .3s ease-out; }
@keyframes scoreBump{ 0%{ transform: scale(1); } 35%{ transform: scale(1.25); color: #fff; } 100%{ transform: scale(1); } }
.t-next, .t-hold{ display: block; margin: 3px auto 0; }

/* Tahta */
.tetris-board-wrap{ flex: 1; display: flex; align-items: flex-start; justify-content: center; position: relative; min-width: 0; min-height: 0; overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; outline: none; }
.tetris-board-wrap *{ -webkit-tap-highlight-color: transparent; }
.tetris-canvas{ -webkit-tap-highlight-color: transparent; outline: none; -webkit-user-select: none; user-select: none; }
/* Bölünmüş ekran (AI rakip) */
.tetris-board-wrap.split{ flex-direction: row; gap: 8px; align-items: flex-start; justify-content: center; }
.tetris-ai-canvas{ border: 1px solid rgba(124,77,255,.4); border-radius: 8px; background: rgba(0,0,0,.35); box-shadow: 0 0 20px rgba(124,77,255,.15) inset; align-self: flex-start; }
.t-ai-label{ position: absolute; top: 4px; right: 8px; font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #7C4DFF; background: rgba(124,77,255,.12); border-radius: 6px; padding: 2px 8px; z-index: 6; }
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
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 6px;
}
.tetris-controls-2{ grid-template-columns: 1fr 1.4fr; margin-top: 5px; }
.tetris-controls-2 .t-ctrl{ height: 44px; }
.t-ctrl-wide{ font-size: 13px !important; font-weight: 800; letter-spacing: .5px; }
.t-ctrl{
  height: 50px; border-radius: 14px; position: relative; overflow: hidden;
  background:
    linear-gradient(180deg, rgba(0,229,255,.20) 0%, rgba(0,180,210,.10) 45%, rgba(0,90,120,.18) 100%),
    radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.10), transparent 60%);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0,229,255,.4); color: var(--cyan);
  font-size: 22px; font-weight: 800; touch-action: none; user-select: none; -webkit-user-select: none;
  display: flex; align-items: center; justify-content: center;
  text-shadow: 0 0 10px rgba(0,229,255,.5), 0 1px 1px rgba(0,0,0,.4);
  box-shadow:
    inset 0 2px 1px rgba(255,255,255,.30),
    inset 0 -3px 6px rgba(0,0,0,.35),
    inset 0 0 0 1px rgba(255,255,255,.06),
    0 6px 14px rgba(0,0,0,.45),
    0 2px 4px rgba(0,0,0,.3);
  transition: transform .08s ease, box-shadow .08s ease, filter .08s ease;
}
.t-ctrl::before{ content:''; position:absolute; top:1px; left:3px; right:3px; height:44%; background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.02) 90%); pointer-events:none; border-radius: 14px 14px 50% 50%; }
.t-ctrl::after{ content:''; position:absolute; bottom:0; left:0; right:0; height:35%; background:linear-gradient(0deg,rgba(0,0,0,.25),transparent); pointer-events:none; }
.t-ctrl:active{
  transform: translateY(2px) scale(.96);
  box-shadow:
    inset 0 3px 10px rgba(0,0,0,.5),
    inset 0 0 22px rgba(0,229,255,.5),
    inset 0 1px 0 rgba(255,255,255,.1),
    0 1px 3px rgba(0,0,0,.4);
  filter: brightness(1.3);
}
.t-ctrl[data-ctrl="drop"], .t-ctrl-drop{ color: var(--pink); border-color: rgba(255,64,129,.55); text-shadow: 0 0 10px rgba(255,64,129,.5), 0 1px 1px rgba(0,0,0,.4); background: linear-gradient(180deg, rgba(255,64,129,.22) 0%, rgba(200,40,100,.10) 45%, rgba(120,20,60,.18) 100%), radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.10), transparent 60%); }
.t-ctrl-drop::before{ background:linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,.02) 90%); }
.t-ctrl[data-ctrl="hold"]{ color: var(--gold); border-color: rgba(255,215,64,.5); background: linear-gradient(160deg, rgba(255,215,64,.14), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)); }
.t-ctrl[data-ctrl="rotateR"], .t-ctrl[data-ctrl="rotateL"]{ color: var(--magenta); border-color: rgba(224,64,251,.5); background: linear-gradient(160deg, rgba(224,64,251,.14), rgba(255,255,255,.03) 50%, rgba(0,0,0,.15)); }

@media (max-height: 680px){
  .t-ctrl{ height: 42px; font-size: 18px; }
  .tetris-controls-2 .t-ctrl{ height: 38px; }
  .tetris-controls{ gap: 5px; margin-top: 5px; }
  .tetris-controls-2{ margin-top: 4px; }
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
/* Admin yenilmez mod butonu */
.t-godmode{
  display: block; margin: 0 auto 8px; padding: 7px 16px; border-radius: var(--r-md);
  background: rgba(255,215,64,.08); border: 1.5px solid rgba(255,215,64,.4); color: var(--gold);
  font-family: var(--font-display); font-weight: 700; font-size: 11px; letter-spacing: 1px;
  transition: all .15s;
}
.t-godmode:active{ transform: scale(.96); }
.t-godmode.on{
  background: linear-gradient(135deg, rgba(255,215,64,.25), rgba(255,180,0,.15));
  border-color: var(--gold); color: #fff;
  box-shadow: 0 0 18px rgba(255,215,64,.5), inset 0 0 12px rgba(255,215,64,.2);
  animation: powerPulse 1.5s ease-in-out infinite;
}
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
/* Başlık sağ buton grubu */
.hs-top-right{ display: flex; gap: 6px; align-items: center; }
/* Öğretici */
.tut-body{ flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 6px 2px 12px; }
.tut-section{ background: rgba(255,255,255,.025); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px 14px; margin-bottom: 10px; }
.tut-head{ font-family: var(--font-display); font-weight: 700; font-size: 13px; letter-spacing: 1px; color: var(--cyan); margin-bottom: 8px; }
.tut-section p{ font-size: 12px; line-height: 1.55; color: var(--text-dim); margin: 0; }
.tut-section p b{ color: var(--text); }
.tut-row{ display: flex; align-items: center; gap: 12px; padding: 5px 0; font-size: 12px; line-height: 1.4; color: var(--text-dim); }
.tut-row b{ color: var(--text); }
.tut-ic{ flex-shrink: 0; min-width: 42px; text-align: center; font-size: 17px; font-weight: 700; color: var(--gold); }
.tut-ok{ width: 100%; padding: 14px; margin-top: 4px; border-radius: var(--r-md); border: none; background: linear-gradient(135deg, var(--cyan), #0097A7); color: #001a1f; font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: 1px; box-shadow: 0 0 16px rgba(0,229,255,.35); }
.tut-ok:active{ transform: scale(.98); }
/* İstatistik & başarım ekranı */
.st-body{ flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 6px 2px 12px; }
.st-ach-head{ font-family: var(--font-display); font-weight: 700; font-size: 12px; letter-spacing: 1px; color: var(--cyan); margin: 12px 2px 8px; }
.st-grid{ display: flex; flex-direction: column; gap: 1px; background: var(--border); border-radius: var(--r-md); overflow: hidden; }
.st-row{ display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(20,20,30,.6); font-size: 12px; }
.st-ic{ font-size: 16px; min-width: 22px; text-align: center; }
.st-label{ flex: 1; color: var(--text-dim); }
.st-val{ font-family: var(--font-display); font-weight: 700; color: var(--text); font-size: 13px; }
.ach-grid{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.ach-card{ text-align: center; padding: 12px 6px; border-radius: var(--r-md); border: 1px solid var(--border); transition: transform .12s; }
.ach-card.unlocked{ background: linear-gradient(160deg, rgba(255,215,64,.14), rgba(255,255,255,.02)); border-color: rgba(255,215,64,.4); }
.ach-card.locked{ background: rgba(255,255,255,.015); opacity: .55; }
.ach-card-ic{ font-size: 28px; display: block; margin-bottom: 5px; filter: drop-shadow(0 0 6px rgba(255,215,64,.4)); }
.ach-card.locked .ach-card-ic{ filter: grayscale(1); opacity: .6; }
.ach-card-name{ font-family: var(--font-display); font-weight: 700; font-size: 9px; letter-spacing: .3px; color: var(--text); line-height: 1.2; }
.ach-card.unlocked .ach-card-name{ color: var(--gold); }
.ach-card-desc{ font-size: 7.5px; color: var(--text-mute); margin-top: 2px; line-height: 1.2; }
/* AI rakip zorluk seçimi */
.ai-grid{ flex: 1; display: flex; flex-direction: column; gap: 12px; padding-top: 10px; }
.ai-card{ --ac: #7C4DFF; display: flex; align-items: center; gap: 14px; text-align: left;
  background: linear-gradient(120deg, color-mix(in srgb, var(--ac) 16%, transparent), rgba(255,255,255,.02) 60%);
  border: 1.5px solid color-mix(in srgb, var(--ac) 50%, transparent); border-radius: var(--r-lg); padding: 16px 16px; transition: transform .12s, box-shadow .15s; }
.ai-card:active{ transform: scale(.98); box-shadow: 0 0 18px color-mix(in srgb, var(--ac) 45%, transparent); }
.ai-icon{ font-size: 40px; line-height: 1; filter: drop-shadow(0 0 8px color-mix(in srgb, var(--ac) 60%, transparent)); }
.ai-info{ flex: 1; }
.ai-name{ font-family: var(--font-display); font-weight: 700; font-size: 16px; letter-spacing: 1px; color: var(--ac); margin-bottom: 3px; }
.ai-desc{ font-size: 9px; color: var(--text-mute); }
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
.hs-resume{
  display:flex; flex-direction:column; align-items:center; gap:2px;
  width:100%; padding:12px; margin:4px 0 10px;
  background:linear-gradient(135deg,#ffd86b,#e3a82f); color:#2a1c00;
  font-family:var(--font-display); font-weight:800; font-size:14px; letter-spacing:1px;
  border-radius:var(--r-lg); box-shadow:0 4px 16px rgba(240,177,50,.45);
}
.hs-resume small{ font-size:11px; font-weight:600; letter-spacing:0; opacity:.8; }

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
/* Satır temizleme flaş dalgası */
.t-fxlayer.lineflash{ animation: lineFlash .35s ease-out; }
@keyframes lineFlash{
  0%{ opacity: 0; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--fxcol) 60%, transparent), transparent); }
  30%{ opacity: 1; }
  100%{ opacity: 0; }
}
/* Combo göstergesi */
.t-combo{
  position: absolute; top: 30%; left: 50%; transform: translate(-50%,-50%) scale(0);
  font-family: var(--font-display); font-weight: 800; font-size: 26px; letter-spacing: 1px;
  color: #FFD740; text-shadow: 0 0 16px rgba(255,215,64,.8), 0 2px 4px rgba(0,0,0,.6);
  pointer-events: none; z-index: 7; opacity: 0; white-space: nowrap;
}
.t-combo.pop{ animation: comboPop .9s ease-out; }
/* Perfect Clear (tüm temizleme) */
.t-perfect{
  position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%);
  text-align: center; pointer-events: none; z-index: 10; opacity: 0;
}
.t-perfect.show{ animation: pcAnim 2s ease-out; }
.pc-big{ font-family: var(--font-display); font-weight: 800; font-size: 46px; line-height: 1;
  background: linear-gradient(90deg, #00E5FF, #E040FB, #FFD740, #69F0AE, #00E5FF);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 20px rgba(255,255,255,.5)); letter-spacing: 2px;
}
.pc-sub{ font-family: var(--font-display); font-weight: 700; font-size: 12px; letter-spacing: 1px; color: #fff; text-shadow: 0 0 10px var(--cyan); margin-top: 6px; }
@keyframes pcAnim{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(.2) rotate(-8deg); }
  15%{ opacity: 1; transform: translate(-50%,-50%) scale(1.2) rotate(3deg); }
  30%{ transform: translate(-50%,-50%) scale(1) rotate(0deg); }
  80%{ opacity: 1; transform: translate(-50%,-50%) scale(1); }
  100%{ opacity: 0; transform: translate(-50%,-55%) scale(.9); }
}
/* Back-to-back göstergesi */
.t-b2b{
  position: absolute; top: 22%; left: 50%; transform: translate(-50%,-50%) scale(0);
  font-family: var(--font-display); font-weight: 800; font-size: 17px; letter-spacing: 1px;
  color: #FF6E40; text-shadow: 0 0 14px #FF6E40, 0 2px 4px rgba(0,0,0,.6);
  pointer-events: none; z-index: 9; opacity: 0; white-space: nowrap;
}
.t-b2b.show{ animation: b2bAnim 1.2s ease-out; }
@keyframes b2bAnim{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(0); }
  25%{ opacity: 1; transform: translate(-50%,-50%) scale(1.2); }
  45%{ transform: translate(-50%,-50%) scale(1); }
  75%{ opacity: 1; }
  100%{ opacity: 0; transform: translate(-50%,-70%) scale(.85); }
}
/* T-spin göstergesi */
.t-tspin{
  position: absolute; top: 36%; left: 50%; transform: translate(-50%,-50%) scale(0);
  font-family: var(--font-display); font-weight: 800; font-size: 30px; letter-spacing: 1px;
  color: #E040FB; text-shadow: 0 0 18px #E040FB, 0 0 36px rgba(224,64,251,.6), 0 2px 4px rgba(0,0,0,.6);
  pointer-events: none; z-index: 9; opacity: 0; white-space: nowrap;
}
.t-tspin.show{ animation: tspinAnim 1.3s ease-out; }
@keyframes tspinAnim{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(0) rotate(-10deg); }
  20%{ opacity: 1; transform: translate(-50%,-50%) scale(1.3) rotate(5deg); }
  40%{ transform: translate(-50%,-50%) scale(1) rotate(0deg); }
  75%{ opacity: 1; transform: translate(-50%,-55%) scale(1); }
  100%{ opacity: 0; transform: translate(-50%,-80%) scale(.8); }
}
/* Seviye atlama banner */
.t-levelup{
  position: absolute; top: 42%; left: 50%; transform: translate(-50%,-50%);
  text-align: center; pointer-events: none; z-index: 9; opacity: 0;
}
.t-levelup.show{ animation: levelUpAnim 1.6s ease-out; }
.lu-label{ font-family: var(--font-display); font-weight: 700; font-size: 18px; letter-spacing: 4px; color: var(--cyan); text-shadow: 0 0 12px var(--cyan); }
.lu-num{ font-family: var(--font-display); font-weight: 800; font-size: 64px; line-height: 1; color: #fff; text-shadow: 0 0 24px var(--gold), 0 0 48px rgba(255,215,64,.6); margin-top: 2px; }
@keyframes levelUpAnim{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(.3) rotate(-5deg); }
  20%{ opacity: 1; transform: translate(-50%,-50%) scale(1.15) rotate(2deg); }
  35%{ transform: translate(-50%,-50%) scale(1) rotate(0deg); }
  75%{ opacity: 1; transform: translate(-50%,-50%) scale(1); }
  100%{ opacity: 0; transform: translate(-50%,-58%) scale(.9); }
}
@keyframes comboPop{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(0) rotate(-8deg); }
  25%{ opacity: 1; transform: translate(-50%,-50%) scale(1.3) rotate(3deg); }
  45%{ transform: translate(-50%,-50%) scale(1) rotate(0deg); }
  75%{ opacity: 1; transform: translate(-50%,-60%) scale(1); }
  100%{ opacity: 0; transform: translate(-50%,-90%) scale(.8); }
}
/* Oyun başı geri sayım */
.t-countdown{
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  font-family: var(--font-display); font-weight: 800; font-size: 80px; line-height: 1;
  color: #fff; text-shadow: 0 0 30px var(--cyan), 0 0 60px rgba(0,229,255,.6), 0 4px 8px rgba(0,0,0,.5);
  pointer-events: none; z-index: 8; opacity: 0;
}
.t-countdown.tick{ animation: cdTick .8s ease-out; }
/* Başarım bildirimi (toast) */
.ach-toast{
  position: absolute; top: 70px; left: 50%; transform: translateX(-50%) translateY(-20px);
  display: flex; align-items: center; gap: 12px; min-width: 250px; max-width: 90%;
  background: linear-gradient(135deg, rgba(255,215,64,.18), rgba(20,20,30,.96));
  border: 1.5px solid var(--gold); border-radius: var(--r-lg); padding: 12px 16px;
  box-shadow: 0 8px 30px rgba(0,0,0,.5), 0 0 24px rgba(255,215,64,.3);
  z-index: 20; opacity: 0; transition: opacity .35s ease, transform .35s ease; pointer-events: none;
  backdrop-filter: blur(10px);
}
.ach-toast.show{ opacity: 1; transform: translateX(-50%) translateY(0); }
.ach-ic{ font-size: 36px; line-height: 1; filter: drop-shadow(0 0 8px rgba(255,215,64,.6)); }
.ach-unlocked{ font-size: 9px; font-weight: 700; letter-spacing: 1px; color: var(--gold); margin-bottom: 2px; }
.ach-name{ font-family: var(--font-display); font-weight: 700; font-size: 15px; color: #fff; letter-spacing: .5px; }
.ach-desc{ font-size: 10px; color: var(--text-mute); margin-top: 1px; }
@keyframes cdTick{
  0%{ opacity: 0; transform: translate(-50%,-50%) scale(2.2); }
  30%{ opacity: 1; transform: translate(-50%,-50%) scale(1); }
  70%{ opacity: 1; transform: translate(-50%,-50%) scale(1); }
  100%{ opacity: 0; transform: translate(-50%,-50%) scale(.6); }
}
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

/* ── Çok Oyuncu: lobi kopyala/yapıştır ── */
.vl-codebig{ font-family: var(--font-display); font-weight: 900; font-size: clamp(30px, 11vw, 48px); letter-spacing: 0.14em; text-align: center; color: var(--cyan); text-shadow: 0 0 20px rgba(0,229,255,.5); padding: 14px 8px; background: rgba(0,229,255,.08); border: 1.5px dashed var(--border-cyan); border-radius: var(--r-md); overflow-wrap: break-word; }
.vl-copy{ width: 100%; margin-top: 10px; padding: 13px; background: linear-gradient(135deg, #00E5FF, #00B8D4); border: none; border-radius: var(--r-md); color: #001a1f; font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: .5px; cursor: pointer; }
.vl-copy:active{ transform: scale(.97); }
.vl-codehint{ text-align: center; font-size: 10px; color: var(--text-mute); margin-top: 8px; line-height: 1.4; }
.vl-spinner{ width: 28px; height: 28px; margin: 10px auto 0; border: 3px solid rgba(0,229,255,.2); border-top-color: var(--cyan); border-radius: 50%; animation: vlSpin .9s linear infinite; }
@keyframes vlSpin{ to{ transform: rotate(360deg); } }
.vl-input-row{ display: flex; gap: 8px; margin-bottom: 10px; }
.vl-input-row .vl-input{ flex: 1; min-width: 0; margin-bottom: 0; }
.vl-paste{ width: 52px; flex-shrink: 0; background: rgba(0,229,255,.12); border: 1.5px solid var(--border-cyan); border-radius: var(--r-md); color: var(--cyan); font-size: 20px; cursor: pointer; }
.vl-paste:active{ transform: scale(.94); }

/* ── Çok Oyuncu: oyun içi sohbet ── */
.t-chat-badge{ position: absolute; top: -4px; right: -4px; min-width: 16px; height: 16px; padding: 0 4px; display: flex; align-items: center; justify-content: center; background: #ff4060; color: #fff; font-size: 10px; font-weight: 800; border-radius: 8px; box-sizing: border-box; }
.t-chat{ position: fixed; left: 0; right: 0; bottom: 0; max-width: 560px; margin: 0 auto; background: linear-gradient(180deg, #0e0e1c, #05050b); border-top: 2px solid var(--cyan); border-radius: 18px 18px 0 0; display: flex; flex-direction: column; max-height: 60%; z-index: 1200; box-shadow: 0 -10px 40px rgba(0,0,0,.6); }
.t-chat-head{ display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-family: var(--font-display); font-weight: 700; font-size: 14px; color: var(--cyan); border-bottom: 1px solid rgba(0,229,255,.2); }
.t-chat-close{ background: none; border: none; color: var(--text-dim); font-size: 16px; cursor: pointer; }
.t-chat-msgs{ flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; min-height: 110px; }
.t-chat-msg{ max-width: 75%; padding: 8px 12px; border-radius: 14px; font-size: 13px; line-height: 1.4; word-break: break-word; }
.t-chat-msg.mine{ align-self: flex-end; background: linear-gradient(135deg, #00E5FF, #00B8D4); color: #001a1f; border-bottom-right-radius: 4px; }
.t-chat-msg.theirs{ align-self: flex-start; background: rgba(0,188,212,.18); color: #d8f8ff; border-bottom-left-radius: 4px; }
.t-chat-quick{ display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px; border-top: 1px solid rgba(0,229,255,.15); }
.t-chat-q{ flex-shrink: 0; padding: 6px 12px; background: rgba(0,229,255,.08); border: 1px solid var(--border-cyan); border-radius: 16px; color: #d8f8ff; font-size: 12px; white-space: nowrap; cursor: pointer; }
.t-chat-q:active{ transform: scale(.95); }
.t-chat-input-row{ display: flex; gap: 8px; padding: 12px; }
.t-chat-input{ flex: 1; min-width: 0; padding: 12px 14px; background: rgba(255,255,255,.06); border: 1.5px solid var(--border-cyan); border-radius: 22px; color: #fff; font-size: 14px; }
.t-chat-input:focus{ outline: none; border-color: var(--cyan); }
.t-chat-send{ width: 48px; flex-shrink: 0; background: linear-gradient(135deg, #00E5FF, #00B8D4); border: none; border-radius: 50%; color: #001a1f; font-size: 18px; cursor: pointer; }
.t-chat-send:active{ transform: scale(.94); }


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
    } else if(SELECTED_MODE === 'ai'){
      buildAISelect((diff) => { AI_DIFFICULTY = diff; launchAIGame(); });
    } else {
      ADVENTURE_WORLD = null;
      launchGame();
    }
  });
}

export default openTetris;
