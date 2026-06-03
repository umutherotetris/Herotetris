// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — ÇEKİRDEK MOTOR (saf mantık, DOM yok)
//
//  Tahta: 8x8 dizi, board[r][c]. r=0 üst (siyah taban), r=7 alt (beyaz).
//  Taş: { t:'p|n|b|r|q|k', c:'w|b' } veya null.
//  Koordinat: {r, c} (0-7).
// ════════════════════════════════════════════════════════════════

export const PIECE_NAMES = {
  p: 'Piyade', n: 'At', b: 'Fil', r: 'Kale', q: 'Vezir', k: 'Şah'
};

// Başlangıç dizilişi (standart satranç)
export function initialBoard(){
  const back = ['r','n','b','q','k','b','n','r'];
  const board = Array.from({length:8}, () => Array(8).fill(null));
  for(let c=0;c<8;c++){
    board[0][c] = { t: back[c], c: 'b' };   // siyah üstte
    board[1][c] = { t: 'p', c: 'b' };
    board[6][c] = { t: 'p', c: 'w' };
    board[7][c] = { t: back[c], c: 'w' };    // beyaz altta
  }
  return board;
}

export function cloneBoard(b){
  return b.map(row => row.map(cell => cell ? { t: cell.t, c: cell.c } : null));
}

const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

// Bir taşın TÜM "sözde-yasal" hamleleri (şah tehdidi kontrolü olmadan)
// state: { board, turn, enPassant, castling }
function pseudoMoves(state, r, c){
  const b = state.board;
  const piece = b[r][c];
  if(!piece) return [];
  const moves = [];
  const dir = piece.c === 'w' ? -1 : 1;   // beyaz yukarı (r azalır)
  const enemy = piece.c === 'w' ? 'b' : 'w';

  const add = (nr, nc, opts) => {
    if(!inBounds(nr, nc)) return false;
    const target = b[nr][nc];
    if(target && target.c === piece.c) return false;   // kendi taşı
    moves.push({ from:{r,c}, to:{r:nr,c:nc}, ...(opts||{}) });
    return !target;   // boşsa devam edilebilir
  };

  if(piece.t === 'p'){
    // ileri 1
    if(inBounds(r+dir, c) && !b[r+dir][c]){
      pawnAdd(moves, {r,c}, {r:r+dir,c}, piece);
      // ileri 2 (başlangıç sırasından)
      const startRow = piece.c === 'w' ? 6 : 1;
      if(r === startRow && !b[r+2*dir][c]){
        moves.push({ from:{r,c}, to:{r:r+2*dir,c}, double:true });
      }
    }
    // çapraz yeme
    for(const dc of [-1, 1]){
      const nr = r+dir, nc = c+dc;
      if(!inBounds(nr,nc)) continue;
      const target = b[nr][nc];
      if(target && target.c === enemy){ pawnAdd(moves, {r,c}, {r:nr,c:nc}, piece); }
      // en passant
      if(state.enPassant && state.enPassant.r === nr && state.enPassant.c === nc){
        moves.push({ from:{r,c}, to:{r:nr,c:nc}, enPassant:true });
      }
    }
  }
  else if(piece.t === 'n'){
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => add(r+dr, c+dc));
  }
  else if(piece.t === 'k'){
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => add(r+dr, c+dc));
    // rok (castling) — kabaca; yasallık ileride filtrelenir
    const cast = state.castling[piece.c];
    const row = piece.c === 'w' ? 7 : 0;
    if(r === row && c === 4){
      // kısa rok
      if(cast.k && !b[row][5] && !b[row][6] && b[row][7] && b[row][7].t==='r'){
        moves.push({ from:{r,c}, to:{r:row,c:6}, castle:'k' });
      }
      // uzun rok
      if(cast.q && !b[row][3] && !b[row][2] && !b[row][1] && b[row][0] && b[row][0].t==='r'){
        moves.push({ from:{r,c}, to:{r:row,c:2}, castle:'q' });
      }
    }
  }
  else {
    // kayan taşlar: fil, kale, vezir
    const dirs = [];
    if(piece.t === 'b' || piece.t === 'q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
    if(piece.t === 'r' || piece.t === 'q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
    for(const [dr,dc] of dirs){
      let nr = r+dr, nc = c+dc;
      while(add(nr, nc)){ nr += dr; nc += dc; }
    }
  }
  return moves;
}

// Piyade hamlesi ekle, son sıraya ulaşıyorsa terfi (promotion) işaretle
function pawnAdd(moves, from, to, piece){
  const lastRow = piece.c === 'w' ? 0 : 7;
  if(to.r === lastRow){
    moves.push({ from, to, promotion: 'q' });   // varsayılan vezire terfi
  } else {
    moves.push({ from, to });
  }
}

// Bir karenin saldırı altında olup olmadığı (renk: saldıran taraf)
function isAttacked(board, r, c, byColor){
  // tüm düşman taşlarını tara, pseudo hamlelerinde bu kareye vuran var mı
  for(let i=0;i<8;i++) for(let j=0;j<8;j++){
    const p = board[i][j];
    if(p && p.c === byColor){
      const ms = pseudoMoves({ board, turn:byColor, enPassant:null, castling:{w:{k:false,q:false},b:{k:false,q:false}} }, i, j);
      for(const m of ms){
        if(m.to.r === r && m.to.c === c && !m.castle) return true;
      }
    }
  }
  return false;
}

// Şahın konumunu bul
function findKing(board, color){
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.t === 'k' && p.c === color) return {r,c};
  }
  return null;
}

// Bir hamleyi tahtaya uygula → yeni state döndür (orijinali değiştirmez)
export function applyMove(state, move){
  const b = cloneBoard(state.board);
  const piece = b[move.from.r][move.from.c];
  const color = piece.c;
  const newCastling = { w:{...state.castling.w}, b:{...state.castling.b} };
  let newEnPassant = null;
  // 50 hamle kuralı sayacı: piyade hamlesi veya yeme → sıfırla, yoksa +1
  const isCapture = !!b[move.to.r][move.to.c] || !!move.enPassant;
  const isPawn = piece.t === 'p';
  const newHalfmove = (isCapture || isPawn) ? 0 : ((state.halfmove || 0) + 1);

  // en passant yeme
  if(move.enPassant){
    b[move.from.r][move.to.c] = null;   // geçilen piyadeyi kaldır
  }
  // taşı taşı
  b[move.to.r][move.to.c] = piece;
  b[move.from.r][move.from.c] = null;

  // terfi
  if(move.promotion){ b[move.to.r][move.to.c] = { t: move.promotion, c: color }; }

  // rok: kaleyi de taşı
  if(move.castle){
    const row = move.from.r;
    if(move.castle === 'k'){ b[row][5] = b[row][7]; b[row][7] = null; }
    else { b[row][3] = b[row][0]; b[row][0] = null; }
  }

  // çift piyade → en passant hedefi
  if(move.double){ newEnPassant = { r: (move.from.r + move.to.r)/2, c: move.from.c }; }

  // rok haklarını güncelle
  if(piece.t === 'k'){ newCastling[color].k = false; newCastling[color].q = false; }
  if(piece.t === 'r'){
    const row = color === 'w' ? 7 : 0;
    if(move.from.r === row && move.from.c === 0) newCastling[color].q = false;
    if(move.from.r === row && move.from.c === 7) newCastling[color].k = false;
  }
  // kale yenirse karşı rok hakkı düşer
  const oppRow = color === 'w' ? 0 : 7;
  if(move.to.r === oppRow && move.to.c === 0) newCastling[color==='w'?'b':'w'].q = false;
  if(move.to.r === oppRow && move.to.c === 7) newCastling[color==='w'?'b':'w'].k = false;

  return {
    board: b,
    turn: color === 'w' ? 'b' : 'w',
    enPassant: newEnPassant,
    castling: newCastling,
    halfmove: newHalfmove
  };
}

// Bir taşın YASAL hamleleri (kendi şahını tehlikeye atmayanlar)
export function legalMoves(state, r, c){
  const piece = state.board[r][c];
  if(!piece || piece.c !== state.turn) return [];
  const pseudo = pseudoMoves(state, r, c);
  const legal = [];
  for(const m of pseudo){
    // rok: aradaki kareler tehdit altında olmamalı + şah tehditte olmamalı
    if(m.castle){
      const row = m.from.r;
      const opp = piece.c === 'w' ? 'b' : 'w';
      if(isAttacked(state.board, row, 4, opp)) continue;   // şah halihazırda tehditte
      const midC = m.castle === 'k' ? 5 : 3;
      if(isAttacked(state.board, row, midC, opp)) continue; // geçtiği kare tehditte
      // hedef kare kontrolü applyMove sonrası aşağıda yapılır
    }
    const ns = applyMove(state, m);
    const king = findKing(ns.board, piece.c);
    if(king && !isAttacked(ns.board, king.r, king.c, piece.c === 'w' ? 'b' : 'w')){
      legal.push(m);
    }
  }
  return legal;
}

// Bir tarafın TÜM yasal hamleleri
export function allLegalMoves(state, color){
  color = color || state.turn;
  const all = [];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = state.board[r][c];
    if(p && p.c === color){
      const ms = legalMoves({ ...state, turn: color }, r, c);
      all.push(...ms);
    }
  }
  return all;
}

// Şah çekiliyor mu?
export function inCheck(state, color){
  const king = findKing(state.board, color);
  if(!king) return false;
  return isAttacked(state.board, king.r, king.c, color === 'w' ? 'b' : 'w');
}

// Oyun durumu: 'checkmate' | 'stalemate' | 'check' | 'normal'
export function gameStatus(state){
  const moves = allLegalMoves(state, state.turn);
  const check = inCheck(state, state.turn);
  if(moves.length === 0) return check ? 'checkmate' : 'stalemate';
  if(insufficientMaterial(state.board)) return 'insufficient';
  if((state.halfmove || 0) >= 100) return 'fiftymove';
  return check ? 'check' : 'normal';
}

// Pozisyon anahtarı (3 hamle tekrarı için): dizilim + sıra + rok + en passant
export function positionKey(state){
  let s = '';
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = state.board[r][c];
    s += p ? (p.c === 'w' ? p.t.toUpperCase() : p.t) : '.';
  }
  s += '|' + state.turn;
  s += '|' + (state.castling.w.k?'K':'') + (state.castling.w.q?'Q':'') + (state.castling.b.k?'k':'') + (state.castling.b.q?'q':'');
  s += '|' + (state.enPassant ? state.enPassant.r + ',' + state.enPassant.c : '-');
  return s;
}

// Yetersiz materyal: K-K, K+hafif-K, K+B-K+B (aynı renk kare)
export function insufficientMaterial(board){
  const pieces = { w:[], b:[] };
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(p && p.t !== 'k'){ pieces[p.c].push({ t:p.t, sq:(r+c)%2 }); }
  }
  const w = pieces.w, b = pieces.b;
  const heavy = arr => arr.some(p => p.t==='p'||p.t==='r'||p.t==='q');
  if(heavy(w) || heavy(b)) return false;
  const total = w.length + b.length;
  if(total === 0) return true;
  if(total === 1) return true;
  if(w.length === 1 && b.length === 1 && w[0].t==='b' && b[0].t==='b' && w[0].sq===b[0].sq) return true;
  return false;
}

// Yeni oyun state'i
export function newGame(){
  return {
    board: initialBoard(),
    turn: 'w',
    enPassant: null,
    castling: { w:{k:true,q:true}, b:{k:true,q:true} },
    halfmove: 0
  };
}

// ── FEN (Forsyth-Edwards Notation) ──
// State → FEN string. fullmove opsiyonel (varsayılan 1).
export function toFEN(state, fullmove){
  let fen = '';
  for(let r=0;r<8;r++){
    let empty = 0;
    for(let c=0;c<8;c++){
      const p = state.board[r][c];
      if(!p){ empty++; }
      else {
        if(empty > 0){ fen += empty; empty = 0; }
        fen += p.c === 'w' ? p.t.toUpperCase() : p.t;
      }
    }
    if(empty > 0) fen += empty;
    if(r < 7) fen += '/';
  }
  fen += ' ' + state.turn;
  // rok hakları
  let cast = '';
  if(state.castling.w.k) cast += 'K';
  if(state.castling.w.q) cast += 'Q';
  if(state.castling.b.k) cast += 'k';
  if(state.castling.b.q) cast += 'q';
  fen += ' ' + (cast || '-');
  // en passant hedefi
  if(state.enPassant){
    const files = 'abcdefgh';
    fen += ' ' + files[state.enPassant.c] + (8 - state.enPassant.r);
  } else { fen += ' -'; }
  fen += ' ' + (state.halfmove || 0);
  fen += ' ' + (fullmove || 1);
  return fen;
}

// FEN string → state. Geçersizse null döner.
export function fromFEN(fen){
  try{
    const parts = fen.trim().split(/\s+/);
    if(parts.length < 2) return null;
    const rows = parts[0].split('/');
    if(rows.length !== 8) return null;
    const board = Array.from({length:8}, () => Array(8).fill(null));
    const valid = 'pnbrqkPNBRQK';
    for(let r=0;r<8;r++){
      let c = 0;
      for(const ch of rows[r]){
        if(/\d/.test(ch)){ c += parseInt(ch, 10); }
        else if(valid.includes(ch)){
          if(c > 7) return null;
          board[r][c] = { t: ch.toLowerCase(), c: ch === ch.toUpperCase() ? 'w' : 'b' };
          c++;
        } else return null;
      }
      if(c !== 8) return null;
    }
    const turn = parts[1] === 'b' ? 'b' : 'w';
    const cast = parts[2] || '-';
    const castling = {
      w: { k: cast.includes('K'), q: cast.includes('Q') },
      b: { k: cast.includes('k'), q: cast.includes('q') }
    };
    let enPassant = null;
    if(parts[3] && parts[3] !== '-'){
      const files = 'abcdefgh';
      const fc = files.indexOf(parts[3][0]);
      const fr = 8 - parseInt(parts[3][1], 10);
      if(fc >= 0 && fr >= 0 && fr < 8) enPassant = { r: fr, c: fc };
    }
    const halfmove = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    // İki şah var mı (geçerlilik)
    let wk = 0, bk = 0;
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const p = board[r][c];
      if(p && p.t === 'k'){ p.c === 'w' ? wk++ : bk++; }
    }
    if(wk !== 1 || bk !== 1) return null;
    return { board, turn, enPassant, castling, halfmove };
  }catch(e){ return null; }
}
