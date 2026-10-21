// ════════════════════════════════════════════════════════════════
//  TAVLA — ÇEKİRDEK MOTOR (saf mantık, DOM yok)
//
//  Tahta: points[0..23], işaretli sayı:
//    points[i] > 0 → i adet BEYAZ pul
//    points[i] < 0 → |i| adet SİYAH pul
//    points[i] = 0 → boş
//  Beyaz (w) hareket yönü: index 23 → 0 (azalır), home = 0..5, çıkış index 0'dan
//  Siyah (b) hareket yönü: index 0 → 23 (artar), home = 18..23, çıkış index 23'ten
//  bar: {w, b} = kırılan (vurulan) pullar.   off: {w, b} = toplanan pullar.
// ════════════════════════════════════════════════════════════════

// Standart başlangıç dizilimi (0-indexli)
export function initialPoints(){
  const p = Array(24).fill(0);
  // Beyaz (pozitif): 24-pt(idx23)=2, 13-pt(idx12)=5, 8-pt(idx7)=3, 6-pt(idx5)=5
  p[23] = 2; p[12] = 5; p[7] = 3; p[5] = 5;
  // Siyah (negatif): ayna — 1-pt(idx0)=2, 12-pt(idx11)=5, 17-pt(idx16)=3, 19-pt(idx18)=5
  p[0] = -2; p[11] = -5; p[16] = -3; p[18] = -5;
  return p;
}

export function newGame(){
  return {
    points: initialPoints(),
    bar: { w: 0, b: 0 },
    off: { w: 0, b: 0 },
    turn: 'w',          // başlangıç (gerçek oyunda açılış zarıyla belirlenir)
    dice: [],           // atılan zarlar [d1,d2] veya çiftte [d,d,d,d]
    used: []            // kullanılan zar indexleri
  };
}

// Validate restored/network snapshots before they reach rule or canvas code.
export function isValidState(s){
  if(!s || !['w','b'].includes(s.turn) || !Array.isArray(s.points) || s.points.length !== 24 || !s.points.every(n=>Number.isInteger(n)&&Math.abs(n)<=15)) return false;
  for(const field of ['bar','off']){
    if(!s[field] || !['w','b'].every(c=>Number.isInteger(s[field][c])&&s[field][c]>=0&&s[field][c]<=15)) return false;
  }
  for(const c of ['w','b']){
    const onBoard=s.points.reduce((sum,n)=>sum+(c==='w'?Math.max(0,n):Math.max(0,-n)),0);
    if(onBoard+s.bar[c]+s.off[c] !== 15) return false;
  }
  if(!Array.isArray(s.dice) || ![0,2,4].includes(s.dice.length) || !s.dice.every(d=>Number.isInteger(d)&&d>=1&&d<=6)) return false;
  if(s.dice.length===2 && s.dice[0]===s.dice[1]) return false;
  if(s.dice.length===4 && !s.dice.every(d=>d===s.dice[0])) return false;
  return Array.isArray(s.used) && new Set(s.used).size===s.used.length && s.used.every(i=>Number.isInteger(i)&&i>=0&&i<s.dice.length);
}

export function cloneState(s){
  return {
    points: s.points.slice(),
    bar: { w: s.bar.w, b: s.bar.b },
    off: { w: s.off.w, b: s.off.b },
    turn: s.turn,
    dice: s.dice.slice(),
    used: s.used.slice()
  };
}

// Zar at: çift gelirse 4 hamle hakkı
export function rollDice(){
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
}

const isWhite = (c) => c === 'w';
const sign = (c) => (c === 'w' ? 1 : -1);

// Bir oyuncunun home (iç) bölgesindeki pul sayısı + bar kontrolü → bear off yapılabilir mi
export function canBearOff(state, color){
  if(state.bar[color] > 0) return false;
  const pts = state.points;
  if(isWhite(color)){
    // beyaz home = 0..5; başka yerde beyaz pul olmamalı
    for(let i = 6; i < 24; i++){ if(pts[i] > 0) return false; }
  } else {
    // siyah home = 18..23
    for(let i = 0; i < 18; i++){ if(pts[i] < 0) return false; }
  }
  return true;
}

// Bir zar değeriyle 'from' noktasından yapılabilecek hedef + tür
// from: 0..23 normal nokta, ya da 'bar'
// döner: { to, type } | null   type: 'move'|'hit'|'bearoff'
function tryMove(state, color, from, die){
  const pts = state.points;
  const s = sign(color);

  // Bar'dan giriş zorunluysa
  if(state.bar[color] > 0 && from !== 'bar') return null;

  if(from === 'bar'){
    // beyaz bar girişi: index 24-die (yani 23..18), siyah: index die-1 (0..5)
    const to = isWhite(color) ? 24 - die : die - 1;
    if(to < 0 || to > 23) return null;
    const occ = pts[to];
    if(s > 0){ // beyaz
      if(occ >= 0) return { to, type:'move' };
      if(occ === -1) return { to, type:'hit' };
      return null; // 2+ siyah → kapalı
    } else {
      if(occ <= 0) return { to, type:'move' };
      if(occ === 1) return { to, type:'hit' };
      return null;
    }
  }

  // Normal nokta
  const fromVal = pts[from];
  if(s > 0 && fromVal <= 0) return null;   // beyazın pulu yok
  if(s < 0 && fromVal >= 0) return null;   // siyahın pulu yok

  const to = from - s * die;   // beyaz azalır, siyah artar

  // Bear off durumu
  if((isWhite(color) && to < 0) || (!isWhite(color) && to > 23)){
    if(!canBearOff(state, color)) return null;
    // tam çıkış mı yoksa daha yüksek zarla en uzaktaki pul mu
    const exactExit = isWhite(color) ? (from === die - 1) : (from === 24 - die);
    if(exactExit) return { to:'off', type:'bearoff' };
    // zar, gereğinden büyük: sadece en uzaktaki puldan oynanabilir
    if(isWhite(color)){
      for(let i = from + 1; i < 6; i++){ if(pts[i] > 0) return null; }   // daha uzakta pul varsa olmaz
      return { to:'off', type:'bearoff' };
    } else {
      for(let i = from - 1; i >= 18; i--){ if(pts[i] < 0) return null; }
      return { to:'off', type:'bearoff' };
    }
  }

  if(to < 0 || to > 23) return null;
  const occ = pts[to];
  if(s > 0){
    if(occ >= 0) return { to, type:'move' };
    if(occ === -1) return { to, type:'hit' };
    return null;
  } else {
    if(occ <= 0) return { to, type:'move' };
    if(occ === 1) return { to, type:'hit' };
    return null;
  }
}

// Kalan (kullanılmamış) zar değerleri
export function remainingDice(state){
  const rem = [];
  state.dice.forEach((d, i) => { if(!state.used.includes(i)) rem.push({ die: d, idx: i }); });
  return rem;
}

// Bir noktadan (veya bar) yapılabilecek tüm yasal hamleler (kalan zarlarla)
function rawMovesFrom(state, from){
  const color = state.turn;
  const moves = [];
  const seenDice = new Set();
  for(const { die, idx } of remainingDice(state)){
    if(seenDice.has(die)) continue;   // aynı değerli zarı bir kez değerlendir
    seenDice.add(die);
    const r = tryMove(state, color, from, die);
    if(r){ moves.push({ from, to: r.to, die, dieIdx: idx, type: r.type }); }
  }
  return moves;
}

// Tüm yasal hamleler (tüm noktalar + bar)
function rawMoves(state){
  const color = state.turn;
  const all = [];
  // bar zorunlu
  if(state.bar[color] > 0){
    return rawMovesFrom(state, 'bar');
  }
  for(let i = 0; i < 24; i++){
    const v = state.points[i];
    if((isWhite(color) && v > 0) || (!isWhite(color) && v < 0)){
      all.push(...rawMovesFrom(state, i));
    }
  }
  return all;
}

// Retain only moves that allow the maximum number of dice to be played.
// If only one of two unequal dice can be used, the higher die is mandatory.
function searchKey(s){return [s.turn,s.points.join(','),s.bar.w,s.bar.b,s.off.w,s.off.b,remainingDice(s).map(d=>d.die).sort().join(',')].join('|');}
function maxPlayable(s,memo){
  const rem=remainingDice(s).length;if(!rem)return 0;
  const key=searchKey(s);if(memo.has(key))return memo.get(key);
  let best=0;
  for(const move of rawMoves(s)){
    best=Math.max(best,1+maxPlayable(applyMove(s,move),memo));
    if(best===rem)break;
  }
  memo.set(key,best);return best;
}
export function allLegalMoves(state){
  if(gameStatus(state)!=='playing') return [];
  const moves=rawMoves(state), memo=new Map();let best=0;
  const ranked=moves.map(move=>{const count=1+maxPlayable(applyMove(state,move),memo);best=Math.max(best,count);return {move,count};});
  let result=ranked.filter(r=>r.count===best).map(r=>r.move);
  if(best===1 && remainingDice(state).length===2){
    const high=Math.max(...result.map(m=>m.die));result=result.filter(m=>m.die===high);
  }
  return result;
}
export function legalMovesFrom(state,from){return allLegalMoves(state).filter(m=>m.from===from);}
export function resolveLegalMove(state,candidate){
  if(!candidate)return null;
  return allLegalMoves(state).find(m=>m.from===candidate.from&&m.to===candidate.to&&m.die===candidate.die)||null;
}

// Hamleyi uygula → yeni state (zarı kullanılmış işaretler)
export function applyMove(state, move){
  const ns = cloneState(state);
  const color = ns.turn;
  const s = sign(color);

  // kaynaktan çıkar
  if(move.from === 'bar'){ ns.bar[color]--; }
  else { ns.points[move.from] -= s; }

  // hedefe ekle
  if(move.to === 'off'){
    ns.off[color]++;
  } else {
    if(ns.points[move.to] === -s){
      // rakip blot'u bar'a gönder
      const opp = isWhite(color) ? 'b' : 'w';
      ns.points[move.to] = 0;       // tek rakip pulu kaldır
      ns.bar[opp]++;
    }
    ns.points[move.to] += s;
  }

  // zarı kullanılmış işaretle
  if(move.dieIdx !== undefined && move.dieIdx !== null){
    ns.used = ns.used.concat([move.dieIdx]);
  } else {
    // dieIdx verilmemişse ilk eşleşen kullanılmamış zarı kullan
    const found = remainingDice(ns).find(r => r.die === move.die);
    if(found) ns.used = ns.used.concat([found.idx]);
  }
  return ns;
}

// Sıra bu oyuncuda bitti mi (kullanılacak zar/hamle kalmadı mı)
export function turnComplete(state){
  if(gameStatus(state)!=='playing') return true;
  if(state.dice.length === 0) return false;
  if(state.used.length >= state.dice.length) return true;
  return allLegalMoves(state).length === 0;   // hamle yoksa sıra biter
}

// Oyun durumu
export function gameStatus(state){
  if(state.off.w === 15) return 'white_wins';
  if(state.off.b === 15) return 'black_wins';
  return 'playing';
}

// Kazanma türü (normal=1, mars/gammon=2, hin/backgammon=3) — puan için
export function winType(state, winner){
  const loser = winner === 'w' ? 'b' : 'w';
  if(state.off[loser] > 0) return 1;   // normal: kaybeden en az 1 pul toplamış
  // kaybeden hiç toplamadı → gammon (2) veya backgammon (3)
  // backgammon: kaybedenin kazananın home bölgesinde veya bar'da pulu var
  const pts = state.points;
  if(state.bar[loser] > 0) return 3;
  if(winner === 'w'){
    // beyaz kazandı → siyahın beyaz home'unda (0..5) pulu var mı
    for(let i = 0; i < 6; i++){ if(pts[i] < 0) return 3; }
  } else {
    for(let i = 18; i < 24; i++){ if(pts[i] > 0) return 3; }
  }
  return 2;   // gammon
}

// Açılış zarı: iki oyuncu birer zar atar, büyük başlar (eşitse tekrar)
export function openingRoll(){
  let w, b;
  do { w = 1 + Math.floor(Math.random()*6); b = 1 + Math.floor(Math.random()*6); } while(w === b);
  return { w, b, first: w > b ? 'w' : 'b', dice: [w, b] };
}

// Pip sayısı (kazanmaya kalan toplam mesafe) — AI/gösterge için
export function pipCount(state, color){
  const pts = state.points;
  let pip = 0;
  if(isWhite(color)){
    for(let i = 0; i < 24; i++){ if(pts[i] > 0) pip += pts[i] * (i + 1); }
    pip += state.bar.w * 25;
  } else {
    for(let i = 0; i < 24; i++){ if(pts[i] < 0) pip += (-pts[i]) * (24 - i); }
    pip += state.bar.b * 25;
  }
  return pip;
}
