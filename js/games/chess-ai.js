// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — YAPAY ZEKÂ (minimax + alpha-beta budama)
//
//  Saf mantık (DOM yok). chess-engine.js üzerine kurulu.
//  Zorluk: 'easy' | 'medium' | 'hard'
// ════════════════════════════════════════════════════════════════
import { allLegalMoves, applyMove, inCheck, gameStatus } from './chess-engine.js';

// Taş materyal değerleri (centipawn)
const VALUE = { p:100, n:320, b:330, r:500, q:900, k:20000 };

// Piyade-kare tabloları (pozisyonel değerlendirme) — beyaz perspektifi (r=0 üst)
// Taşları iyi karelere yönlendirir. Siyah için tablo dikey yansıtılır.
const PST = {
  p: [
    [0,0,0,0,0,0,0,0],
    [50,50,50,50,50,50,50,50],
    [10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],
    [0,0,0,20,20,0,0,0],
    [5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],
    [0,0,0,0,0,0,0,0]
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],
    [-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],
    [-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,10,10,5,0,-10],
    [-10,5,5,10,10,5,5,-10],
    [-10,0,10,10,10,10,0,-10],
    [-10,10,10,10,10,10,10,-10],
    [-10,5,0,0,0,0,5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  r: [
    [0,0,0,0,0,0,0,0],
    [5,10,10,10,10,10,10,5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [-5,0,0,0,0,0,0,-5],
    [0,0,0,5,5,0,0,0]
  ],
  q: [
    [-20,-10,-10,-5,-5,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,5,5,5,0,-10],
    [-5,0,5,5,5,5,0,-5],
    [0,0,5,5,5,5,0,-5],
    [-10,5,5,5,5,5,0,-10],
    [-10,0,5,0,0,0,0,-10],
    [-20,-10,-10,-5,-5,-10,-10,-20]
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20,20,0,0,0,0,20,20],
    [20,30,10,0,0,10,30,20]
  ]
};

// Pozisyonu değerlendir (beyaz açısından pozitif = beyaz iyi)
function evaluate(board){
  let score = 0;
  for(let r=0;r<8;r++) for(let c=0;c<8;c++){
    const p = board[r][c];
    if(!p) continue;
    const mat = VALUE[p.t];
    // PST: beyaz için doğrudan, siyah için dikey yansıma
    const pst = p.c === 'w' ? PST[p.t][r][c] : PST[p.t][7-r][c];
    if(p.c === 'w') score += mat + pst;
    else score -= mat + pst;
  }
  return score;
}

// Hamleleri sırala (önce yemeler → alpha-beta daha çok budar)
function orderMoves(state, moves){
  return moves.map(m => {
    const target = state.board[m.to.r][m.to.c];
    let pri = 0;
    if(target) pri = 10 * VALUE[target.t] - VALUE[state.board[m.from.r][m.from.c].t];   // MVV-LVA
    if(m.promotion) pri += 800;
    return { m, pri };
  }).sort((a,b) => b.pri - a.pri).map(x => x.m);
}

// Minimax + alpha-beta. maximizing = beyaz mı?
function minimax(state, depth, alpha, beta, maximizing){
  if(depth === 0){ return evaluate(state.board); }
  const moves = allLegalMoves(state, state.turn);
  if(moves.length === 0){
    // mat ya da pat
    if(inCheck(state, state.turn)){
      // mat: kaybeden taraf için çok kötü skor (derinliğe göre daha yakın matı tercih)
      return maximizing ? -100000 - depth : 100000 + depth;
    }
    return 0;   // pat = berabere
  }
  const ordered = orderMoves(state, moves);
  if(maximizing){
    let best = -Infinity;
    for(const m of ordered){
      const val = minimax(applyMove(state, m), depth-1, alpha, beta, false);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if(beta <= alpha) break;   // budama
    }
    return best;
  } else {
    let best = Infinity;
    for(const m of ordered){
      const val = minimax(applyMove(state, m), depth-1, alpha, beta, true);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if(beta <= alpha) break;   // budama
    }
    return best;
  }
}

// Zorluk → arama derinliği + rastgelelik
const DIFFICULTY = {
  easy:   { depth: 1, randomness: 0.35 },   // sığ + sık hata
  medium: { depth: 2, randomness: 0.12 },   // makul
  hard:   { depth: 3, randomness: 0.0 }     // güçlü, derinlemesine
};

// En iyi hamleyi seç. state.turn oynayacak taraf.
// difficulty: 'easy' | 'medium' | 'hard'
export function chooseMove(state, difficulty){
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const moves = allLegalMoves(state, state.turn);
  if(moves.length === 0) return null;
  if(moves.length === 1) return moves[0];

  const maximizing = state.turn === 'w';
  const ordered = orderMoves(state, moves);
  const scored = [];

  for(const m of ordered){
    let val = minimax(applyMove(state, m), cfg.depth - 1, -Infinity, Infinity, !maximizing);
    // beyaz maksimize, siyah minimize eder → kendi açısından "iyi"yi normalize et
    const norm = maximizing ? val : -val;
    scored.push({ m, score: norm });
  }

  // En iyi skoru bul
  scored.sort((a,b) => b.score - a.score);
  const bestScore = scored[0].score;

  // Rastgelelik: zorluk düşükse bazen en iyi olmayan hamleyi seç
  if(cfg.randomness > 0 && Math.random() < cfg.randomness){
    // en iyiye yakın hamlelerden (bestScore - 120 centipawn içinde) rastgele
    const near = scored.filter(s => s.score >= bestScore - 120);
    const pick = near[Math.floor(Math.random() * near.length)];
    return pick.m;
  }

  // Eşit en iyiler arasında rastgele (çeşitlilik için)
  const top = scored.filter(s => s.score >= bestScore - 5);
  return top[Math.floor(Math.random() * top.length)].m;
}

// Düşünme süresini tahmin etmek için derinlik bilgisi (UI için)
export function difficultyInfo(difficulty){
  return DIFFICULTY[difficulty] || DIFFICULTY.medium;
}
