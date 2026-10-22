// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — YAPAY ZEKÂ (minimax + alpha-beta budama)
//
//  Saf mantık (DOM yok). chess-engine.js üzerine kurulu.
//  Zorluk: 'easy' | 'medium' | 'hard'
// ════════════════════════════════════════════════════════════════
import { allLegalMoves, applyMove, inCheck, gameStatus, insufficientMaterial } from './chess-engine.js';

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
    else if(m.enPassant) pri = 10 * VALUE.p - VALUE.p;
    if(m.promotion) pri += 800;
    return { m, pri };
  }).sort((a,b) => b.pri - a.pri).map(x => x.m);
}

// Minimax + alpha-beta. maximizing = beyaz mı?
const SEARCH_STOP = {};
function visit(search){
  search.nodes++;
  if(search.nodes>search.maxNodes || (search.nodes%64===0 && search.now()>search.deadline)) throw SEARCH_STOP;
}

// Ufukta zorunlu yemeleri/terfileri çöz; şah altındayken pas değerlendirmesi yapma.
function quiescence(state, alpha, beta, maximizing, remaining, search, knownMoves){
  visit(search);
  const moves=knownMoves || allLegalMoves(state,state.turn);
  const checked=inCheck(state,state.turn);
  if(!moves.length) return checked ? (maximizing?-100000-remaining:100000+remaining) : 0;
  if(insufficientMaterial(state.board) || (state.halfmove||0)>=100) return 0;
  const stand=evaluate(state.board);
  if(remaining<=0){
    if(!checked) return stand;
    // Uzatma sınırında bile en az bir yasal şah kaçışını değerlendir.
    let best=maximizing?-Infinity:Infinity;
    for(const m of moves){
      visit(search);
      const next=applyMove(state,m),replies=allLegalMoves(next,next.turn);
      const score=!replies.length ? (inCheck(next,next.turn)?(maximizing?100000:-100000):0)
        : (insufficientMaterial(next.board)||(next.halfmove||0)>=100?0:evaluate(next.board));
      best=maximizing?Math.max(best,score):Math.min(best,score);
    }
    return best;
  }
  let best=checked?(maximizing?-Infinity:Infinity):stand;
  if(!checked){
    if(maximizing){if(stand>=beta)return stand;alpha=Math.max(alpha,stand);}
    else {if(stand<=alpha)return stand;beta=Math.min(beta,stand);}
  }
  const tactical=checked?moves:moves.filter(m=>state.board[m.to.r][m.to.c] || m.enPassant || m.promotion);
  for(const m of orderMoves(state,tactical)){
    const score=quiescence(applyMove(state,m),alpha,beta,!maximizing,remaining-1,search);
    best=maximizing?Math.max(best,score):Math.min(best,score);
    if(maximizing) alpha=Math.max(alpha,score);else beta=Math.min(beta,score);
    if(beta<=alpha) break;
  }
  return best;
}

function minimax(state, depth, alpha, beta, maximizing, search){
  visit(search);
  const moves = allLegalMoves(state, state.turn);
  if(moves.length === 0){
    // mat ya da pat
    if(inCheck(state, state.turn)){
      // mat: kaybeden taraf için çok kötü skor (derinliğe göre daha yakın matı tercih)
      return maximizing ? -100000 - depth : 100000 + depth;
    }
    return 0;   // pat = berabere
  }
  if(insufficientMaterial(state.board) || (state.halfmove || 0) >= 100) return 0;
  if(depth === 0) return search.qDepth ? quiescence(state,alpha,beta,maximizing,search.qDepth,search,moves) : evaluate(state.board);
  const ordered = orderMoves(state, moves);
  if(maximizing){
    let best = -Infinity;
    for(const m of ordered){
      const val = minimax(applyMove(state, m), depth-1, alpha, beta, false,search);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if(beta <= alpha) break;   // budama
    }
    return best;
  } else {
    let best = Infinity;
    for(const m of ordered){
      const val = minimax(applyMove(state, m), depth-1, alpha, beta, true,search);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if(beta <= alpha) break;   // budama
    }
    return best;
  }
}

// Zorluk → arama derinliği + rastgelelik
const DIFFICULTY = {
  easy:   { depth: 1, randomness: 0.35, qDepth:0, maxNodes:3000, timeMs:60 },
  medium: { depth: 2, randomness: 0.12, qDepth:2, maxNodes:12000, timeMs:140 },
  hard:   { depth: 3, randomness: 0.0, qDepth:4, maxNodes:30000, timeMs:240 }
};

// En iyi hamleyi seç. state.turn oynayacak taraf.
// difficulty: 'easy' | 'medium' | 'hard'
export function chooseMove(state, difficulty){
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  if(['checkmate','stalemate','insufficient','fiftymove'].includes(gameStatus(state))) return null;
  const moves = allLegalMoves(state, state.turn);
  if(moves.length === 0) return null;
  if(moves.length === 1) return moves[0];

  const maximizing = state.turn === 'w';
  const ordered = orderMoves(state, moves);
  // An immediate mate is conclusive even when a busy/slow device exhausts the
  // deeper search before its first full iteration. Check only checking moves.
  for(const m of ordered){
    const next = applyMove(state, m);
    if(inCheck(next, next.turn) && allLegalMoves(next, next.turn).length === 0) return m;
  }
  let scored=[];
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const search={nodes:0,maxNodes:cfg.maxNodes,qDepth:cfg.qDepth,now,deadline:now()+cfg.timeMs};
  // Yalnız tamamlanan derinlik sonucunu kullan; yarım kalan tur seçimleri bozmasın.
  for(let depth=1;depth<=cfg.depth;depth++){
    const iteration=[];
    try{
      for(const m of ordered){
        const val=minimax(applyMove(state,m),depth-1,-Infinity,Infinity,!maximizing,search);
        iteration.push({m,score:maximizing?val:-val});
      }
    }catch(e){if(e!==SEARCH_STOP)throw e;break;}
    scored=iteration;
    if(scored.some(s=>s.score>=90000)) break;
  }
  if(!scored.length) return ordered[0];

  // En iyi skoru bul
  scored.sort((a,b) => b.score - a.score);
  const bestScore = scored[0].score;

  // Rastgelelik: zorluk düşükse bazen en iyi olmayan hamleyi seç
  if(bestScore < 90000 && cfg.randomness > 0 && Math.random() < cfg.randomness){
    // en iyiye yakın hamlelerden (bestScore - 120 centipawn içinde) rastgele
    const near = scored.filter(s => s.score >= bestScore - 120);
    const pick = near[Math.floor(Math.random() * near.length)];
    return pick.m;
  }

  // Eşit en iyiler arasında rastgele (çeşitlilik için)
  const tolerance = bestScore >= 90000 ? 0 : 5;
  const top = scored.filter(s => s.score >= bestScore - tolerance);
  return top[Math.floor(Math.random() * top.length)].m;
}

// Düşünme süresini tahmin etmek için derinlik bilgisi (UI için)
export function difficultyInfo(difficulty){
  return DIFFICULTY[difficulty] || DIFFICULTY.medium;
}
