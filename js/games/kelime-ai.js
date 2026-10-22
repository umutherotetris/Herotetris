// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Yapay Zekâ Rakip
//  Sözlük ağacı, mevcut tahta harfleri ve rafla geçerli hamle üretir.
//  Zorluk: kolay (kısa/düşük puan), orta (rastgele iyi), zor (en yüksek).
// ════════════════════════════════════════════════════════════════
import DICT, { TR_LOWER } from './kelime-dict.js';
import { SIZE, validatePlacement, isEmptyBoard, isValidBoard, letterPoints, CENTER, getLanguage, SURPRISE_INFO } from './kelime-engine.js';

// küçük→büyük Türkçe (TR_LOWER tersi)
const TR_UPPER = {}; for(const up in TR_LOWER) TR_UPPER[TR_LOWER[up]] = up;

// İngilizce sözlük (talep üzerine yüklenir — dosya büyük)
let DICT_EN = null, EN_LOWER = null, EN_UPPER = null;
async function ensureEnDict(){
  if(DICT_EN) return;
  const m = await import('./kelime-dict-en.js');
  DICT_EN = m.default;
  EN_LOWER = m.EN_LOWER || {};
  EN_UPPER = {}; for(const up in EN_LOWER) EN_UPPER[EN_LOWER[up]] = up;
}

// Aktif dile göre harf eşleme
function _lang(){ try{ return getLanguage(); }catch(e){ return 'tr'; } }
function _upperMap(){ return _lang()==='en' ? (EN_UPPER||{}) : TR_UPPER; }
function upTR(lowerWord){ const U=_upperMap(); let s=''; for(const ch of lowerWord) s += (U[ch]||ch.toUpperCase()); return s; }

// Anagram indeksi: dile göre ayrı (TR ve EN)
let INDEX = null, INDEX_LANG = null, INDEX_SOURCE = null, TRIE = null, WORD_SET = null;
const EMPTY_DICT = [];
function ensureIndex(){
  const lang = _lang();
  const src = (lang === 'en') ? (DICT_EN || EMPTY_DICT) : DICT;
  if(INDEX && INDEX_LANG === lang && INDEX_SOURCE === src) return;
  INDEX = new Map(); INDEX_LANG = lang; INDEX_SOURCE = src;
  TRIE = {next:new Map(),word:false}; WORD_SET = new Set();
  for(const w of src){
    const n = w.length;
    if(n < 2 || n > SIZE) continue;
    const upper=upTR(w); WORD_SET.add(upper);
    let node=TRIE;
    for(const letter of upper){if(!node.next.has(letter))node.next.set(letter,{next:new Map(),word:false});node=node.next.get(letter);}
    node.word=true;
    const key = Array.from(w).sort().join('');
    let arr = INDEX.get(key);
    if(!arr){ arr = []; INDEX.set(key, arr); }
    arr.push(w);
  }
}

// Ana fonksiyon: en iyi (zorluğa göre) geçerli hamleyi bul. Yoksa null.
export function findBestMove(board, rack, difficulty, context){
  ensureIndex();
  if(!isValidBoard(board)||!Array.isArray(rack)||!rack.length||rack.length>SIZE||!Array.from(rack).every(t=>t&&(t.joker===undefined||typeof t.joker==='boolean')&&(!t.joker?(typeof t.letter==='string'&&letterPoints(t.letter)>0&&t.points===letterPoints(t.letter)):t.points===0))) return null;
  const counts=new Map();let jokers=0;
  for(const tile of rack){if(tile.joker)jokers++;else counts.set(tile.letter,(counts.get(tile.letter)||0)+1);}
  const firstMove=isEmptyBoard(board),moves=[],seen=new Set(),crossCache=new Map();
  const MAX_EVAL=6000,MAX_NODES=300000;let evals=0,nodes=0;
  const letterOf=tile=>tile?.joker?(tile.assigned||tile.letter):tile?.letter;
  const occupied=(r,c)=>r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r][c];
  const surprises=context?.surprises;
  const vowels=new Set(_lang()==='en'?[...'AEIOU']:[...'AEIİOÖUÜ']);
  function rankMove(pending,baseScore){
    let extraPoints=0,doubleMul=1,jokersUsed=0;
    const remaining=rack.slice();
    for(const p of pending){
      if(p.joker)jokersUsed++;
      const index=remaining.findIndex(t=>p.joker?t.joker:!t.joker&&t.letter===p.letter);
      if(index>=0)remaining.splice(index,1);
      const surprise=surprises?.[p.r+','+p.c];
      const info=surprise && SURPRISE_INFO[surprise.type];
      if(info?.kind==='points')extraPoints+=info.points;
      else if(info?.kind==='double')doubleMul=2;
    }
    let vowelCount=0,consonantCount=0,points=0,duplicates=0;const letters=new Set();
    for(const t of remaining){
      if(t.joker)continue;
      if(vowels.has(t.letter))vowelCount++;else consonantCount++;
      points+=t.points;
      if(letters.has(t.letter))duplicates++;else letters.add(t.letter);
    }
    return {effectiveScore:baseScore*doubleMul+extraPoints,jokersUsed,
      leaveQuality:-Math.abs(vowelCount-consonantCount)-duplicates*.25-points*.05};
  }
  function tryPending(pending){
    if(evals>=MAX_EVAL)return;
    const sig=pending.map(p=>p.r+'.'+p.c+(p.assigned||p.letter)+(p.joker?'?':'')).sort().join('|');
    if(seen.has(sig))return;seen.add(sig);evals++;
    const res=validatePlacement(board,pending);
    if(res.ok)moves.push({pending:pending.map(p=>({...p})),score:res.score,words:res.words,...rankMove(pending,res.score)});
  }
  function crossAt(r,c,dr,dc){
    const key=r+','+c+','+dr; if(crossCache.has(key))return crossCache.get(key);
    let before='',after='';
    for(let rr=r-dc,cc=c-dr;occupied(rr,cc);rr-=dc,cc-=dr)before=letterOf(board[rr][cc])+before;
    for(let rr=r+dc,cc=c+dr;occupied(rr,cc);rr+=dc,cc+=dr)after+=letterOf(board[rr][cc]);
    const data={before,after,touches:!!(before||after)};crossCache.set(key,data);return data;
  }
  for(const [dr,dc] of [[0,1],[1,0]])for(let line=0;line<SIZE&&nodes<MAX_NODES&&evals<MAX_EVAL;line++){
    const at=pos=>dr?[pos,line]:[line,pos];
    const anchors=Array.from({length:SIZE},(_,pos)=>{const [r,c]=at(pos);return firstMove?r===CENTER.r&&c===CENTER.c:!!board[r][c]||crossAt(r,c,dr,dc).touches;});
    if(!anchors.some(Boolean))continue;
    for(let start=0;start<SIZE&&nodes<MAX_NODES&&evals<MAX_EVAL;start++){
      const [sr,sc]=at(start);if(start&&occupied(sr-dr,sc-dc))continue;
      let empty=0,reachable=false;
      for(let pos=start;pos<SIZE;pos++){const [r,c]=at(pos);if(!board[r][c])empty++;if(empty>rack.length)break;if(anchors[pos]){reachable=true;break;}}
      if(!reachable)continue;
      const pending=[];
      function search(node,pos,connected,remainingJokers){
        if(nodes++>=MAX_NODES||evals>=MAX_EVAL)return;
        const [r,c]=at(pos);
        if(node.word&&pending.length&&connected&&(pos===SIZE||!board[r][c]))tryPending(pending);
        if(pos===SIZE)return;
        const cell=board[r][c];
        if(cell){const next=node.next.get(letterOf(cell));if(next)search(next,pos+1,true,remainingJokers);return;}
        if(pending.length>=rack.length)return;
        const cross=crossAt(r,c,dr,dc);
        for(const [letter,next]of node.next){
          if(cross.touches&&!WORD_SET.has(cross.before+letter+cross.after))continue;
          const joined=connected||anchors[pos],count=counts.get(letter)||0;
          if(count){counts.set(letter,count-1);pending.push({r,c,letter,points:letterPoints(letter),joker:false});search(next,pos+1,joined,remainingJokers);pending.pop();counts.set(letter,count);}
          if(remainingJokers){pending.push({r,c,letter:'',assigned:letter,points:0,joker:true});search(next,pos+1,joined,remainingJokers-1);pending.pop();}
          if(nodes>=MAX_NODES||evals>=MAX_EVAL)break;
        }
      }
      search(TRIE,start,false,jokers);
    }
  }

  if(!moves.length) return null;
  moves.sort((a,b)=>b.effectiveScore-a.effectiveScore||a.jokersUsed-b.jokersUsed||b.leaveQuality-a.leaveQuality);

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
  if(!pick)return null;
  const {jokersUsed,leaveQuality,...result}=pick;
  return result;
}

export async function aiReady(){
  if(_lang() === 'en'){ await ensureEnDict(); }
  ensureIndex();
  return INDEX.size;
}
