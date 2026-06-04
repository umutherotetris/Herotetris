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
      for(let i = die; i < 6; i++){ if(pts[i] > 0) return null; }   // daha uzakta pul varsa olmaz
      return { to:'off', type:'bearoff' };
    } else {
      for(let i = 24 - die - 1; i >= 18; i--){ if(pts[i] < 0) return null; }
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
export function legalMovesFrom(state, from){
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
export function allLegalMoves(state){
  const color = state.turn;
  const all = [];
  // bar zorunlu
  if(state.bar[color] > 0){
    return legalMovesFrom(state, 'bar');
  }
  for(let i = 0; i < 24; i++){
    const v = state.points[i];
    if((isWhite(color) && v > 0) || (!isWhite(color) && v < 0)){
      all.push(...legalMovesFrom(state, i));
    }
  }
  return all;
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
    if(move.type === 'hit'){
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
