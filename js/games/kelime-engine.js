// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Oyun Motoru
//  15x15 tahta, Türkçe harf seti (100 taş), torba, yerleştirme
//  doğrulama (hizalama/bağlantı/sözlük) ve puanlama (harf+kelime bonusları).
// ════════════════════════════════════════════════════════════════
import { isWord } from './kelime-dict.js';

export const SIZE = 15;
export const RACK_SIZE = 7;
export const BINGO_BONUS = 30;   // tüm 7 taş kullanılırsa ek puan

// Harf seti: { adet, puan }
export const LETTERS = {
  A:{n:12,p:1}, B:{n:2,p:3}, C:{n:2,p:4}, 'Ç':{n:2,p:4}, D:{n:2,p:3},
  E:{n:8,p:1}, F:{n:1,p:7}, G:{n:1,p:5}, 'Ğ':{n:1,p:8}, H:{n:1,p:5},
  'I':{n:4,p:2}, 'İ':{n:7,p:1}, J:{n:1,p:10}, K:{n:7,p:1}, L:{n:7,p:1},
  M:{n:4,p:2}, N:{n:5,p:1}, O:{n:3,p:2}, 'Ö':{n:1,p:7}, P:{n:1,p:5},
  R:{n:6,p:1}, S:{n:3,p:2}, 'Ş':{n:2,p:4}, T:{n:5,p:1}, U:{n:3,p:2},
  'Ü':{n:2,p:3}, V:{n:1,p:7}, Y:{n:2,p:3}, Z:{n:2,p:4}
};
export const JOKER_COUNT = 2;
export function letterPoints(letter){ return (LETTERS[letter] ? LETTERS[letter].p : 0); }

// Bonus tahta düzeni (klasik 15x15 simetrik)
// T=K3(üç kelime) D=K2(çift kelime) t=H3(üç harf) d=H2(çift harf) *=merkez .=normal
const LAYOUT = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...*...d..T',
  '..d...d.d...d..',
  '.t...t...t...t.',
  '....D.....D....',
  'd..D...d...D..d',
  '..D...d.d...D..',
  '.D...t...t...D.',
  'T..d...T...d..T'
];
// kod → {wordMul, letterMul, label}
export function bonusAt(r, c){
  const ch = LAYOUT[r][c];
  switch(ch){
    case 'T': return { wordMul:3, letterMul:1, label:'K³' };
    case 'D': return { wordMul:2, letterMul:1, label:'K²' };
    case 't': return { wordMul:1, letterMul:3, label:'H³' };
    case 'd': return { wordMul:1, letterMul:2, label:'H²' };
    case '*': return { wordMul:2, letterMul:1, label:'★', center:true };
    default:  return { wordMul:1, letterMul:1, label:'' };
  }
}
export const CENTER = { r:7, c:7 };

// ── Torba ──
export function buildBag(){
  const bag = makeOrderedBag();
  for(let i=bag.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
  return bag;
}
// Sıralı taş havuzu (karıştırılmamış)
function makeOrderedBag(){
  const bag = [];
  for(const letter in LETTERS){
    for(let i=0;i<LETTERS[letter].n;i++) bag.push({ letter, points:LETTERS[letter].p, joker:false });
  }
  for(let i=0;i<JOKER_COUNT;i++) bag.push({ letter:'', points:0, joker:true });
  return bag;
}
// Tohumlu PRNG (mulberry32) — çevrimiçi oyunda iki istemci AYNI torbayı üretir
function mulberry32(a){
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Deterministik torba: aynı seed → aynı sıra (çevrimiçi senkron için)
export function buildBagSeeded(seed){
  const bag = makeOrderedBag();
  const rng = mulberry32(seed >>> 0);
  for(let i=bag.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
  return bag;
}
export function drawFromBag(bag, n){
  const out = [];
  for(let i=0;i<n && bag.length>0;i++) out.push(bag.pop());
  return out;
}

export function newGame(){
  const board = Array.from({length:SIZE}, () => Array(SIZE).fill(null));
  const bag = buildBag();
  const racks = { A: drawFromBag(bag, RACK_SIZE), B: drawFromBag(bag, RACK_SIZE) };
  return {
    board, bag, racks,
    scores: { A:0, B:0 },
    turn: 'A',
    moveCount: 0,
    passStreak: 0,
    finished: false
  };
}

// (r,c)'deki taşı döndür — board + pending birlikte
function tileAt(board, pending, r, c){
  if(r<0||r>=SIZE||c<0||c>=SIZE) return null;
  for(const p of pending){ if(p.r===r && p.c===c) return p; }
  return board[r][c];
}
function isPending(pending, r, c){ return pending.some(p => p.r===r && p.c===c); }

// Bir yönde (dr,dc) (r,c)'den geçen kelimeyi topla (en az 1 taş)
function collectWord(board, pending, r, c, dr, dc){
  // başa git
  let sr=r, sc=c;
  while(tileAt(board, pending, sr-dr, sc-dc)){ sr-=dr; sc-=dc; }
  // ileri topla
  const tiles = [];
  let cr=sr, cc=sc;
  while(true){
    const t = tileAt(board, pending, cr, cc);
    if(!t) break;
    tiles.push({ r:cr, c:cc, tile:t });
    cr+=dr; cc+=dc;
  }
  return tiles;  // [{r,c,tile}]
}

// Bir kelimenin puanını hesapla (yalnızca pending taşlar bonus tetikler)
function scoreWord(wordTiles, pending){
  let sum = 0, wordMul = 1;
  for(const wt of wordTiles){
    const isNew = isPending(pending, wt.r, wt.c);
    const b = isNew ? bonusAt(wt.r, wt.c) : { wordMul:1, letterMul:1 };
    sum += (wt.tile.joker ? 0 : wt.tile.points) * b.letterMul;
    wordMul *= b.wordMul;
  }
  return sum * wordMul;
}

function wordString(wordTiles){
  return wordTiles.map(w => (w.tile.joker ? (w.tile.assigned||'?') : w.tile.letter)).join('');
}

// ── Ana doğrulama + puanlama ──
// pending: [{r,c,letter,points,joker,assigned?}]
// dönüş: { ok, score, words:[{text,score}], error }
export function validatePlacement(board, pending){
  if(!pending || pending.length === 0) return { ok:false, error:'Tahtaya taş yerleştir' };

  // tek hücreye iki taş?
  const seen = new Set();
  for(const p of pending){
    const key = p.r+','+p.c;
    if(seen.has(key)) return { ok:false, error:'Aynı kareye iki taş konamaz' };
    if(board[p.r][p.c]) return { ok:false, error:'Dolu kareye taş konamaz' };
    seen.add(key);
  }

  const rows = new Set(pending.map(p=>p.r));
  const cols = new Set(pending.map(p=>p.c));
  const horizontal = rows.size === 1;
  const vertical = cols.size === 1;
  if(!horizontal && !vertical) return { ok:false, error:'Taşlar tek satır veya sütunda olmalı' };

  const firstMove = isEmptyBoard(board);
  if(firstMove){
    // merkez kaplanmalı
    if(!pending.some(p => p.r===CENTER.r && p.c===CENTER.c))
      return { ok:false, error:'İlk kelime ortadaki ★ karesinden geçmeli' };
    if(pending.length < 2) return { ok:false, error:'İlk kelime en az 2 harf olmalı' };
  }

  // yön belirle (tek taşsa komşuya göre); süreklilik kontrolü
  let dr, dc;
  if(horizontal && !vertical){ dr=0; dc=1; }
  else if(vertical && !horizontal){ dr=1; dc=0; }
  else {
    // tek taş — hangi yönde komşu var?
    const p = pending[0];
    const hasH = tileAt(board,pending,p.r,p.c-1) || tileAt(board,pending,p.r,p.c+1);
    const hasV = tileAt(board,pending,p.r-1,p.c) || tileAt(board,pending,p.r+1,p.c);
    if(hasH){ dr=0; dc=1; } else { dr=1; dc=0; }
  }

  // ana çizgi: pending'leri kapsayan aralık boşluksuz mu (mevcut taşlarla dolu)
  const line = horizontal && !vertical ? pending.map(p=>p.c) : (vertical && !horizontal ? pending.map(p=>p.r) : null);
  if(line){
    const fixed = (dr===0) ? pending[0].r : pending[0].c;
    const lo = Math.min(...line), hi = Math.max(...line);
    for(let i=lo;i<=hi;i++){
      const rr = (dr===0) ? fixed : i;
      const cc = (dr===0) ? i : fixed;
      if(!tileAt(board, pending, rr, cc)) return { ok:false, error:'Harfler bitişik olmalı (boşluk var)' };
    }
  }

  // oluşan kelimeleri topla: ana kelime + her pending'in çapraz kelimesi
  const words = [];
  // ana kelime
  const anchor = pending[0];
  const mainWord = collectWord(board, pending, anchor.r, anchor.c, dr, dc);
  if(mainWord.length >= 2) words.push(mainWord);
  // çapraz kelimeler
  for(const p of pending){
    const cross = collectWord(board, pending, p.r, p.c, dc, dr); // dik yön
    if(cross.length >= 2) words.push(cross);
  }
  // dedupe (aynı kelime iki kez sayılmasın)
  const uniq = []; const ukeys = new Set();
  for(const w of words){
    const k = w.map(t=>t.r+'.'+t.c).join('|');
    if(!ukeys.has(k)){ ukeys.add(k); uniq.push(w); }
  }
  if(uniq.length === 0) return { ok:false, error:'En az 2 harfli bir kelime oluştur' };

  // bağlantı: ilk hamle değilse en az bir kelime mevcut bir taş içermeli
  if(!firstMove){
    const touchesExisting = uniq.some(w => w.some(t => !isPending(pending, t.r, t.c)));
    if(!touchesExisting) return { ok:false, error:'Yeni kelime mevcut taşlara değmeli' };
  }

  // sözlük kontrolü
  const result = [];
  let total = 0;
  for(const w of uniq){
    const text = wordString(w);
    if(!isWord(text)) return { ok:false, error:`"${text}" sözlükte yok` };
    const sc = scoreWord(w, pending);
    total += sc;
    result.push({ text, score: sc });
  }
  if(pending.length === RACK_SIZE) total += BINGO_BONUS;  // tümünü kullanma bonusu

  return { ok:true, score: total, words: result, bingo: pending.length === RACK_SIZE };
}

export function isEmptyBoard(board){
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]) return false;
  return true;
}

// Hamleyi kalıcı uygula (doğrulama YAPILMIŞ olmalı)
export function commitMove(state, pending, score, who){
  for(const p of pending){
    state.board[p.r][p.c] = { letter: p.joker ? p.assigned : p.letter, points: p.joker?0:p.points, joker: p.joker };
  }
  state.scores[who] += score;
  state.moveCount++;
  state.passStreak = 0;
}
