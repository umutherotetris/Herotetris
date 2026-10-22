// ════════════════════════════════════════════════════════════════
//  TAVLA — YAPAY ZEKÂ
//
//  Zarlar atıldıktan sonra, mevcut zarlarla yapılabilecek TÜM hamle
//  dizilerini üretir, her sonuç pozisyonunu değerlendirir, en iyisini seçer.
//  Zorluk: 'easy' | 'medium' | 'hard'
// ════════════════════════════════════════════════════════════════
import { allLegalMoves, applyMove, turnComplete, pipCount, cloneState } from './tavla-engine.js';

// Pozisyon anahtarı (dizi tekrarını eler — dal patlamasını azaltır)
function posKey(s){
  return s.points.join(',') + '|' + s.bar.w + ',' + s.bar.b + '|' + s.off.w + ',' + s.off.b + '|' + s.used.slice().sort().join('');
}

// Bu sıradaki tüm tam hamle dizilerini üret
function generateSequences(state){
  const results = [];
  const seen = new Set();
  let count = 0;
  const MAX = 20000;   // güvenlik sınırı

  function recurse(s, moves){
    if(count++ > MAX) return;
    const legal = allLegalMoves(s);
    if(legal.length === 0 || turnComplete(s)){
      const key = posKey(s);
      if(!seen.has(key)){ seen.add(key); results.push({ state: s, moves }); }
      return;
    }
    for(const m of legal){
      recurse(applyMove(s, m), moves.concat([m]));
    }
  }
  recurse(state, []);
  // hiç hamle yoksa boş dizi
  if(results.length === 0) results.push({ state, moves: [] });
  return results;
}

// Pozisyonu AI rengi açısından değerlendir (yüksek = iyi)
function evaluate(state, color){
  const opp = color === 'w' ? 'b' : 'w';
  if(state.off[color]===15) return 1000000;
  if(state.off[opp]===15) return -1000000;
  let score = 0;

  // pip farkı (düşük kendi pip = iyi)
  score -= pipCount(state, color) * 1.0;
  score += pipCount(state, opp) * 0.55;

  // toplanan pullar (bear-off) çok değerli
  score += state.off[color] * 28;
  score -= state.off[opp] * 22;

  // bar: kendi pulun bar'da çok kötü, rakip bar'da iyi
  score -= state.bar[color] * 32;
  score += state.bar[opp] * 26;

  const pts = state.points;
  const isW = color === 'w';
  let lastWhite=-1,firstBlack=24;
  for(let i=0;i<24;i++){
    if(pts[i]>0) lastWhite=i;
    else if(pts[i]<0) firstBlack=Math.min(firstBlack,i);
  }
  // Temas bittiyse açık pul/kapı güvenliği yerine toplama verimini değerlendir.
  if(!state.bar.w && !state.bar.b && lastWhite<firstBlack){
    for(let i=0;i<24;i++){
      const mine=isW?Math.max(0,pts[i]):Math.max(0,-pts[i]);
      const distance=isW?i+1:24-i;
      score-=mine*distance*distance*.08;
    }
    return score;
  }
  // home bölgeleri
  const myHomeLo = isW ? 0 : 18, myHomeHi = isW ? 5 : 23;

  for(let i=0;i<24;i++){
    const v = pts[i];
    if(v === 0) continue;
    const mine = (isW && v > 0) || (!isW && v < 0);
    const cnt = Math.abs(v);
    if(mine){
      if(cnt >= 2){
        score += 5;                                   // kapalı nokta (güvenli)
        if(i >= myHomeLo && i <= myHomeHi) score += 3; // home'da nokta (rakibi engeller)
      } else if(cnt === 1){
        // blot (açık pul) — vurulma riski. Rakibe yakınlık riski artırır.
        score -= 10;
        // rakip pul bu blotu vurabilecek mesafede mi (kabaca)
        for(let d=1; d<=6; d++){
          // Black moves toward increasing indices, white toward decreasing ones.
          const fi = isW ? i - d : i + d;
          if(fi >= 0 && fi <= 23){
            const ov = pts[fi];
            const oppThere = (isW && ov < 0) || (!isW && ov > 0);
            if(oppThere){ score -= 4; break; }
          }
        }
      }
    }
  }

  // ardışık kapalı noktalar (prime) bonusu — basit
  let run = 0, bestRun = 0;
  for(let i=0;i<24;i++){
    const v = pts[i];
    const mine2pt = ((isW && v >= 2) || (!isW && v <= -2));
    if(mine2pt){ run++; bestRun = Math.max(bestRun, run); } else { run = 0; }
  }
  if(bestRun >= 3) score += bestRun * 4;

  return score;
}

const DIFFICULTY = {
  easy:   { noise: 60, suboptimal: 0.30 },
  medium: { noise: 18, suboptimal: 0.08 },
  hard:   { noise: 0,  suboptimal: 0.0 }
};

// En iyi hamle dizisini seç → moves dizisi döner (sırayla uygulanacak)
export function chooseSequence(state, difficulty){
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.medium;
  const color = state.turn;
  const seqs = generateSequences(state);
  if(seqs.length === 0) return [];
  if(seqs.length === 1) return seqs[0].moves;

  // Difficulty may soften positional choices, never decline a completed win.
  // Otherwise the suboptimal branch can deliberately leave the last checker on
  // the board even though another legal sequence bears off all fifteen now.
  const winning = seqs.find(sq => sq.state.off[color] === 15);
  if(winning) return winning.moves;

  const scored = seqs.map(sq => {
    let sc = evaluate(sq.state, color);
    // daha çok zar kullanan diziyi hafifçe tercih et (zar yakmamak)
    sc += sq.moves.length * 0.5;
    if(cfg.noise > 0) sc += (Math.random() * 2 - 1) * cfg.noise;
    return { moves: sq.moves, score: sc };
  });
  scored.sort((a, b) => b.score - a.score);

  // zayıf zorlukta bazen optimal olmayanı seç
  if(cfg.suboptimal > 0 && Math.random() < cfg.suboptimal && scored.length > 1){
    const idx = 1 + Math.floor(Math.random() * Math.min(3, scored.length - 1));
    return scored[idx].moves;
  }
  return scored[0].moves;
}

export function difficultyInfo(d){ return DIFFICULTY[d] || DIFFICULTY.medium; }
