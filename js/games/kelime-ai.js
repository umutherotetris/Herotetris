// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Yapay Zekâ Rakip
//  Anagram indeksi + çapa-uzatma araması ile geçerli hamle üretir.
//  Zorluk: kolay (kısa/düşük puan), orta (rastgele iyi), zor (en yüksek).
// ════════════════════════════════════════════════════════════════
import DICT, { TR_LOWER } from './kelime-dict.js';
import { SIZE, RACK_SIZE, validatePlacement, isEmptyBoard, letterPoints, CENTER } from './kelime-engine.js';

// küçük→büyük Türkçe (TR_LOWER tersi)
const TR_UPPER = {}; for(const up in TR_LOWER) TR_UPPER[TR_LOWER[up]] = up;
function upTR(lowerWord){ let s=''; for(const ch of lowerWord) s += (TR_UPPER[ch]||ch); return s; }

// Anagram indeksi: sıralı-harf-anahtarı → [küçük kelime] (uzunluk 2..8)
let INDEX = null;
function ensureIndex(){
  if(INDEX) return;
  INDEX = new Map();
  for(const w of DICT){
    const n = w.length;
    if(n < 2 || n > 8) continue;
    const key = Array.from(w).sort().join('');
    let arr = INDEX.get(key);
    if(!arr){ arr = []; INDEX.set(key, arr); }
    arr.push(w);
  }
}

// Bir harf çoklu-kümesinin (sayım) tüm alt-kümelerinin sıralı anahtarlarını üret (boyut≥2)
function subsetKeys(countMap){
  const letters = Object.keys(countMap);
  const keys = [];
  const cur = [];
  function rec(i){
    if(i === letters.length){
      if(cur.length >= 2) keys.push(cur.slice().sort().join(''));
      return;
    }
    const L = letters[i], max = countMap[L];
    for(let k=0;k<=max;k++){
      for(let x=0;x<k;x++) cur.push(L);
      rec(i+1);
      for(let x=0;x<k;x++) cur.pop();
    }
  }
  rec(0);
  return keys;
}

function countOf(lettersArr){
  const m = {}; for(const l of lettersArr) m[l] = (m[l]||0)+1; return m;
}

// Bir küçük kelimeyi, indeks i'deki harfi (r,c)'ye gelecek şekilde yatay/dikey yerleştir.
// Dönüş: pending dizisi (yalnız boş hücrelere yeni taşlar) veya null (geçersiz hizalama).
function buildPending(board, word, alignIdx, r, c, horizontal){
  const upper = upTR(word);
  const n = word.length;
  const pending = [];
  let anyNew = false;
  for(let j=0;j<n;j++){
    const rr = horizontal ? r : (r - alignIdx + j);
    const cc = horizontal ? (c - alignIdx + j) : c;
    if(rr<0||rr>=SIZE||cc<0||cc>=SIZE) return null;
    const want = upper[j];
    const existing = board[rr][cc];
    if(existing){
      if(existing.letter !== want) return null;   // mevcut taşla çakışıyor
    } else {
      pending.push({ r:rr, c:cc, letter:want, points:letterPoints(want), joker:false });
      anyNew = true;
    }
  }
  return anyNew ? pending : null;
}

// Ana fonksiyon: en iyi (zorluğa göre) geçerli hamleyi bul. Yoksa null.
export function findBestMove(board, rack, difficulty){
  ensureIndex();
  const rackLower = rack.filter(t=>!t.joker).map(t => TR_LOWER[t.letter] || t.letter);
  const moves = [];           // {pending, score, words}
  const seen = new Set();     // aynı yerleşimi tekrar etme
  const MAX_EVAL = 6000;      // güvenlik bütçesi
  let evals = 0;

  function tryPending(pending){
    if(!pending || !pending.length) return;
    const sig = pending.map(p=>p.r+'.'+p.c+p.letter).sort().join('|');
    if(seen.has(sig)) return; seen.add(sig);
    if(evals++ > MAX_EVAL) return;
    const res = validatePlacement(board, pending);
    if(res.ok) moves.push({ pending, score:res.score, words:res.words });
  }

  if(isEmptyBoard(board)){
    // İlk hamle: raftan kelimeler, merkezden geçecek şekilde yerleştir
    const keys = subsetKeys(countOf(rackLower));
    for(const key of keys){
      const words = INDEX.get(key); if(!words) continue;
      for(const w of words){
        const n = w.length;
        // kelimenin herhangi bir karesi merkeze gelsin (yatay)
        for(let i=0;i<n;i++){
          tryPending(buildPending(board, w, i, CENTER.r, CENTER.c, true));
          if(evals > MAX_EVAL) break;
        }
        if(evals > MAX_EVAL) break;
      }
      if(evals > MAX_EVAL) break;
    }
  } else {
    // Sonraki hamleler: her dolu hücreyi çapa al, rack+çapaharfi havuzundan kelime kur
    for(let r=0;r<SIZE && evals<=MAX_EVAL;r++){
      for(let c=0;c<SIZE && evals<=MAX_EVAL;c++){
        const cell = board[r][c]; if(!cell) continue;
        const bl = TR_LOWER[cell.letter] || cell.letter;
        const pool = rackLower.concat([bl]);
        const keys = subsetKeys(countOf(pool));
        for(const key of keys){
          if(!key.includes(bl)) continue;            // çapayı içeren kelimeler
          const words = INDEX.get(key); if(!words) continue;
          for(const w of words){
            // çapanın kelime içindeki her konumu için hizala (yatay + dikey)
            for(let i=0;i<w.length;i++){
              if(w[i] !== bl) continue;
              tryPending(buildPending(board, w, i, r, c, true));
              tryPending(buildPending(board, w, i, r, c, false));
            }
            if(evals > MAX_EVAL) break;
          }
          if(evals > MAX_EVAL) break;
        }
      }
    }
  }

  if(!moves.length) return null;
  moves.sort((a,b)=>b.score-a.score);

  // Zorluğa göre seç
  let pick;
  if(difficulty === 'zor'){
    pick = moves[0];
  } else if(difficulty === 'kolay'){
    // düşük-orta puanlı, kısa kelimeler tercih (alt yarı)
    const pool = moves.slice(Math.floor(moves.length*0.55));
    pick = pool[Math.floor(Math.random()*pool.length)] || moves[moves.length-1];
  } else { // orta
    const top = moves.slice(0, Math.max(1, Math.floor(moves.length*0.35)));
    pick = top[Math.floor(Math.random()*top.length)];
  }
  return pick || null;
}

export function aiReady(){ ensureIndex(); return INDEX.size; }
