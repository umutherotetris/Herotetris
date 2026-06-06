// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Ana UI / Kontrolcü
//  15x15 tahta (DOM grid), harf rafı, tap-to-place yerleştirme,
//  tur akışı (onayla/geç/değiştir), joker seçici, puanlama.
//  İlk sürüm: 2 oyuncu (aynı cihazda sırayla). AI/online sonraki faz.
// ════════════════════════════════════════════════════════════════
import {
  newGame, validatePlacement, commitMove, drawFromBag, buildBagSeeded, isEmptyBoard,
  buildSurprises, SURPRISE_INFO, previewPlacement,
  SIZE, RACK_SIZE, bonusAt, letterPoints, LETTERS
} from './kelime-engine.js';

let G = null;
let stylesInjected = false;
let KO = null;   // kelime-online.js (talep üzerine yüklenir)

const LETTER_LIST = Object.keys(LETTERS);  // joker atama için

// ── Ses motoru (Web Audio) ──
let AC = null;
function ac(){ try{ AC = AC || new (window.AudioContext||window.webkitAudioContext)(); return AC; }catch(e){ return null; } }
function tone(freq, dur, type, vol, when){
  if(!G || !G.sound) return;
  const a = ac(); if(!a) return;
  const t0 = a.currentTime + (when||0);
  const o = a.createOscillator(), g = a.createGain();
  o.type = type||'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol||0.06, t0); o.connect(g); g.connect(a.destination);
  o.start(t0); g.gain.exponentialRampToValueAtTime(0.0001, t0+(dur||0.1));
  o.stop(t0+(dur||0.1));
}
function arpeggio(freqs, step, type, vol){ freqs.forEach((f,i)=>tone(f, step*1.6, type||'sine', vol||0.06, i*step)); }
const sndPlace = ()=>tone(300+Math.random()*40,0.05,'square',0.04);
const sndPick  = ()=>tone(460,0.05,'sine',0.05);
const sndErr   = ()=>{ tone(180,0.16,'sawtooth',0.06); tone(120,0.2,'sawtooth',0.05,0.04); };
// kelime onayı — puana göre yükselen arpej (küçük: 3 nota, büyük: 5 nota)
function sndWord(score){
  if(score >= 40)      arpeggio([523,659,784,988,1319],0.07,'triangle',0.07);
  else if(score >= 20) arpeggio([523,659,784,1047],0.07,'triangle',0.06);
  else                 arpeggio([523,784],0.08,'sine',0.06);
}
const sndBingo = ()=>{ arpeggio([523,659,784,1047,1319,1568],0.08,'triangle',0.08); tone(1047,0.5,'sine',0.05,0.5); };
const sndSurprise = ()=>{ arpeggio([880,1175,1568,2093],0.05,'sine',0.06); tone(2637,0.18,'sine',0.04,0.2); };
const sndWin  = ()=>arpeggio([392,523,659,784,1047,1319],0.11,'triangle',0.08);
const sndLose = ()=>arpeggio([392,330,262,196],0.14,'sine',0.06);
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

function injectStyles(){
  if(stylesInjected) return; stylesInjected = true;
  const css = `
.kl-root{position:fixed;inset:0;z-index:9000;background:radial-gradient(120% 80% at 50% -10%,#2a1550 0%,#1a0e30 45%,#120a22 100%);color:#efe7ff;display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;overflow:hidden}
.kl-top{display:flex;align-items:center;gap:10px;padding:10px 12px;flex:0 0 auto}
.kl-gameicon{width:42px;height:42px;flex:0 0 auto;border-radius:11px;background:linear-gradient(150deg,#a855f7,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 3px 10px rgba(124,58,237,.5),inset 0 1px 0 rgba(255,255,255,.35)}
.kl-brand{flex:1;min-width:0}
.kl-title{font-weight:800;letter-spacing:.5px;font-size:17px;line-height:1.1;background:linear-gradient(90deg,#ffe08a,#f0b132);-webkit-background-clip:text;background-clip:text;color:transparent}
.kl-sub{font-size:11px;color:#c9b8e8;opacity:.85;margin-top:1px}
.kl-icon{width:38px;height:38px;flex:0 0 auto;border-radius:10px;border:1px solid rgba(200,170,255,.22);background:rgba(168,85,247,.12);color:#efe7ff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.kl-icon:active{transform:scale(.93)}
.kl-scores{display:flex;align-items:center;gap:8px;padding:0 12px 8px;flex:0 0 auto}
.kl-score{flex:1;background:rgba(168,85,247,.08);border:1px solid rgba(200,170,255,.16);border-radius:13px;padding:7px 10px;text-align:center;transition:.2s}
.kl-score.active{border-color:#f0b132;background:rgba(240,177,50,.14);box-shadow:0 0 16px rgba(240,177,50,.28)}
.kl-score .nm{font-size:11px;color:#cbb9ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kl-score .pt{font-size:21px;font-weight:800;background:linear-gradient(90deg,#ffe08a,#f0b132);-webkit-background-clip:text;background-clip:text;color:transparent}
.kl-gem{width:30px;height:30px;flex:0 0 auto;border-radius:7px;transform:rotate(45deg);background:linear-gradient(135deg,#d8b4fe,#7c3aed);border:2px solid #e9c466;box-shadow:0 0 16px rgba(168,85,247,.6),inset 0 0 7px rgba(255,255,255,.45)}
.kl-status{text-align:center;font-size:13px;padding:0 12px 6px;min-height:18px;color:#d9caf2;flex:0 0 auto}
.kl-status .kl-turn{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:12px}
.kl-status .kl-turn.me{background:linear-gradient(90deg,#ffe08a,#f0b132);color:#3a2400}
.kl-status .kl-turn.opp{background:rgba(168,85,247,.2);color:#e3d3ff;border:1px solid rgba(200,170,255,.25)}
.kl-boardwrap{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:4px 8px;min-height:0}
.kl-board{display:grid;grid-template-columns:repeat(15,1fr);grid-template-rows:repeat(15,1fr);gap:1.5px;width:min(96vw,460px);aspect-ratio:1;background:#4a4e56;border:3px solid #2e323a;border-radius:8px;padding:3px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.kl-cell{position:relative;background:#d8d4ca;border-radius:1px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:rgba(70,72,82,.65);user-select:none;cursor:pointer;overflow:hidden}
.kl-cell.b-K3{background:linear-gradient(160deg,#d6299a,#a01473);color:#fff}
.kl-cell.b-K2{background:linear-gradient(160deg,#b14de0,#8a2fc4);color:#fff}
.kl-cell.b-H3{background:linear-gradient(160deg,#7c5cf0,#5a37cf);color:#fff}
.kl-cell.b-H2{background:linear-gradient(160deg,#a99cf2,#8472d6);color:#fff}
.kl-cell.b-center{background:linear-gradient(160deg,#ffe08a,#e3a82f);color:#3a2400;font-size:12px}
.kl-cell.target{outline:2px solid #ffd86b;outline-offset:-2px}
.kl-tile{position:absolute;inset:1px;border-radius:3px;background:linear-gradient(160deg,#f7edd4,#e6d3a4);color:#3a2a10;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 1px 3px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 2px rgba(150,110,40,.3)}
.kl-tile .l{font-size:14px;line-height:1}
.kl-tile .p{position:absolute;right:1px;bottom:0;font-size:7px;font-weight:700;color:#9a6a1a}
.kl-tile.pending{background:linear-gradient(160deg,#ffe9a8,#f3cf6b);box-shadow:0 0 10px rgba(240,177,50,.7),inset 0 1px 0 rgba(255,255,255,.6)}
.kl-tile.joker{background:linear-gradient(160deg,#ead6ff,#c4a6f0);color:#3a1a5e}
.kl-rackwrap{flex:0 0 auto;padding:8px 10px 6px}
.kl-rack{display:flex;gap:6px;justify-content:center;background:linear-gradient(180deg,rgba(168,85,247,.12),rgba(124,58,237,.06));border:1px solid rgba(200,170,255,.2);border-radius:15px;padding:9px;min-height:56px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.kl-rtile{width:43px;height:48px;border-radius:9px;background:linear-gradient(160deg,#f7edd4,#e6d3a4);color:#3a2a10;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;position:relative;cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -2px 3px rgba(150,110,40,.3);transition:transform .1s}
.kl-rtile.sel{transform:translateY(-8px);box-shadow:0 0 14px rgba(240,177,50,.8),0 5px 10px rgba(0,0,0,.4)}
.kl-rtile.joker{background:linear-gradient(160deg,#ead6ff,#c4a6f0);color:#3a1a5e}
.kl-rtile .p{position:absolute;right:4px;bottom:2px;font-size:9px;color:#9a6a1a}
.kl-rtile.empty{background:rgba(255,255,255,.04);box-shadow:none;cursor:default}
.kl-actions{display:flex;gap:6px;padding:6px 10px 12px}
.kl-btn{flex:1;padding:12px 6px;border-radius:12px;border:1px solid rgba(200,170,255,.2);background:rgba(168,85,247,.1);color:#efe7ff;font-weight:700;font-size:13px;cursor:pointer}
.kl-btn:active{transform:scale(.96)}
.kl-btn.primary{background:linear-gradient(90deg,#b14de0,#7c3aed);border-color:transparent;box-shadow:0 3px 12px rgba(124,58,237,.45)}
.kl-btn.warn{background:rgba(214,41,154,.16)}
.kl-overlay{position:absolute;inset:0;background:rgba(15,8,30,.85);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px}
.kl-card{background:linear-gradient(160deg,#241141,#1a0e30);border:1px solid rgba(200,170,255,.22);border-radius:20px;padding:22px;max-width:340px;width:100%;text-align:center;box-shadow:0 16px 50px rgba(80,20,140,.5)}
.kl-card h3{margin:0 0 6px;font-size:19px;background:linear-gradient(90deg,#ffe08a,#f0b132);-webkit-background-clip:text;background-clip:text;color:transparent}
.kl-card p{margin:0 0 14px;font-size:13px;color:#cbb9ea;line-height:1.45}
.kl-modes{display:flex;flex-direction:column;gap:9px}
.kl-mode{padding:14px;border-radius:13px;border:1px solid rgba(200,170,255,.2);background:rgba(168,85,247,.08);cursor:pointer;font-weight:700;text-align:left;display:flex;align-items:center;gap:11px;transition:.15s}
.kl-mode:active{transform:scale(.98);background:rgba(168,85,247,.16)}
.kl-mode .e{font-size:23px}
.kl-mode.soon{opacity:.45}
.kl-mode small{display:block;font-weight:400;color:#bba8df;font-size:11px}
.kl-jokergrid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:10px}
.kl-jk{aspect-ratio:1;border-radius:8px;background:rgba(168,85,247,.14);border:1px solid rgba(200,170,255,.2);color:#fff;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.kl-jk:active{background:rgba(240,177,50,.3)}
.kl-words{margin:6px 0 0;font-size:13px;text-align:left;color:#e3d3ff}
.kl-words div{padding:2px 0}
.kl-cell.b-surprise{background:linear-gradient(160deg,#fff0c0,#f3d484);box-shadow:inset 0 0 6px rgba(240,177,50,.7);animation:klpulse 1.5s ease-in-out infinite}
.kl-cell.b-surprise .bl{font-size:12px}
@keyframes klpulse{0%,100%{box-shadow:inset 0 0 5px rgba(240,177,50,.5)}50%{box-shadow:inset 0 0 12px rgba(255,205,70,.95)}}
.kl-scorepop{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:42px;font-weight:900;color:#ffe08a;text-shadow:0 2px 12px rgba(0,0,0,.7),0 0 22px rgba(240,177,50,.7);pointer-events:none;z-index:62;animation:klpop 1.2s ease-out forwards}
@keyframes klpop{0%{opacity:0;transform:translate(-50%,-25%) scale(.5)}22%{opacity:1;transform:translate(-50%,-50%) scale(1.18)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-135%) scale(1)}}
.kl-strip{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;z-index:62}
.kl-surp{display:inline-block;margin:3px auto;padding:9px 18px;border-radius:999px;background:linear-gradient(90deg,#b14de0,#7c3aed);color:#fff;font-weight:800;font-size:15px;box-shadow:0 5px 20px rgba(124,58,237,.65);animation:klsurp 1.9s ease-out forwards}
@keyframes klsurp{0%{opacity:0;transform:scale(.4) translateY(12px)}16%{opacity:1;transform:scale(1.12)}32%{transform:scale(1)}82%{opacity:1}100%{opacity:0;transform:translateY(-22px)}}
.kl-confetti{position:absolute;inset:0;pointer-events:none;z-index:58;overflow:hidden}
.kl-confetti i{position:absolute;top:-14px;width:9px;height:14px;border-radius:2px;animation:klfall linear forwards}
@keyframes klfall{to{transform:translateY(115vh) rotate(720deg);opacity:.15}}
`;
  const tag = document.createElement('style');
  tag.id = 'kl-styles'; tag.textContent = css;
  document.head.appendChild(tag);
}

export function openKelime(){
  injectStyles();
  const root = document.createElement('div');
  root.className = 'kl-root';
  root.innerHTML = `
    <div class="kl-top">
      <div class="kl-gameicon">🔤</div>
      <div class="kl-brand">
        <div class="kl-title">KELİME DÜELLOSU</div>
        <div class="kl-sub">Türkçe · 59.000 kelime</div>
      </div>
      <button class="kl-icon" data-el="sound" title="Ses">🔊</button>
      <button class="kl-icon" data-act="close" title="Kapat">✕</button>
    </div>
    <div data-el="content" style="flex:1;display:flex;flex-direction:column;min-height:0;position:relative"></div>
  `;
  document.body.appendChild(root);
  G = { root, sound:true };
  root.querySelector('[data-act="close"]').addEventListener('click', closeKelime);
  const sb = root.querySelector('[data-el="sound"]');
  sb.addEventListener('click', ()=>{ G.sound=!G.sound; sb.textContent=G.sound?'🔊':'🔇'; });
  showStart();
}

function closeKelime(){ try{ if(G && G.online && KO) KO.leaveRoom(); }catch(e){} if(G && G.root) G.root.remove(); G=null; }

function showStart(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `
    <div class="kl-overlay" style="position:relative;background:transparent">
      <div class="kl-card">
        <h3>🔤 Kelime Düellosu</h3>
        <p>Türkçe kelime türetme oyunu · 15×15 tahta · 59.000 kelimelik TDK sözlüğü</p>
        <div class="kl-modes">
          <div class="kl-mode" data-mode="local"><span class="e">👥</span><div>2 Oyuncu<small>Aynı cihazda sırayla</small></div></div>
          <div class="kl-mode" data-mode="online"><span class="e">🌐</span><div>Çevrimiçi Rakip<small>Rastgele bir oyuncuyla eşleş</small></div></div>
          <div class="kl-mode soon"><span class="e">🤖</span><div>Yapay Zekâ<small>Yakında</small></div></div>
        </div>
      </div>
    </div>`;
  c.querySelector('[data-mode="local"]').addEventListener('click', ()=>startLocal());
  c.querySelector('[data-mode="online"]').addEventListener('click', ()=>startOnlineSearch());
}

function startLocal(){
  const st = newGame();
  G.state = st;
  G.who = 'A';
  G.names = { A:'Oyuncu 1', B:'Oyuncu 2' };
  G.pending = [];
  G.rackView = st.racks[G.who].slice();   // bu turdaki kullanılabilir taşlar
  G.selected = null;
  G.surprises = buildSurprises((Math.random()*0x7fffffff)|0);   // sürpriz kareler
  G.bestWord = { text:'', score:0, who:'' };
  buildGameDOM();
  renderAll();
}

// ── ÇEVRİMİÇİ: rastgele eşleşme ──
async function startOnlineSearch(){
  const c = G.root.querySelector('[data-el="content"]');
  if(!document.getElementById('kl-spin-kf')){ const s=document.createElement('style'); s.id='kl-spin-kf'; s.textContent='@keyframes klspin{to{transform:rotate(360deg)}}'; document.head.appendChild(s); }
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent">
    <div class="kl-card">
      <h3>🌐 Rakip Aranıyor…</h3>
      <p>Çevrimiçi bir oyuncu bekleniyor. Biri katılınca oyun otomatik başlar.</p>
      <div style="margin:6px auto 14px;width:34px;height:34px;border:3px solid rgba(255,255,255,.2);border-top-color:#ffd86b;border-radius:50%;animation:klspin 1s linear infinite"></div>
      <button class="kl-btn warn" data-x="cancel">İptal</button>
    </div></div>`;
  let cancelled = false;
  c.querySelector('[data-x="cancel"]').addEventListener('click', async ()=>{
    cancelled = true; try{ if(KO) await KO.cancelSearch(); }catch(e){} showStart();
  });
  try{ KO = await import('./kelime-online.js'); }
  catch(e){ flashCard('Çevrimiçi modül yüklenemedi', 'Bağlantını kontrol edip tekrar dene.'); return; }
  KO.findMatch({
    onSearching: ()=>{},
    onError: (msg)=>{ if(!cancelled) flashCard('Eşleşme hatası', msg); },
    onMatched: ({role, gameId, oppName, seed})=>{ if(!cancelled) startOnline(role, gameId, oppName, seed); }
  });
}

function flashCard(title, msg){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>${title}</h3><p>${msg}</p><button class="kl-btn primary" data-x="back">Menüye Dön</button></div></div>`;
  c.querySelector('[data-x="back"]').addEventListener('click', showStart);
}

function startOnline(role, gameId, oppName, seed){
  G.online = true; G.role = role; G.gameId = gameId; G.oppName = oppName; G._over = false; G.oppPresent = true;
  G.bag = buildBagSeeded(seed);
  const start = role === 'A' ? 0 : RACK_SIZE;     // A → [0..6], B → [7..13]
  G.rackView = G.bag.slice(start, start+RACK_SIZE).map(t=>({letter:t.letter, points:t.points, joker:t.joker}));
  G.state = {
    board: Array.from({length:SIZE}, ()=>Array(SIZE).fill(null)),
    scores: { A:0, B:0 }, turn:'A', bagPointer:14, passStreak:0
  };
  G.who = role;
  G.names = { A: role==='A'?'Sen':oppName, B: role==='B'?'Sen':oppName };
  G.pending = []; G.selected = null;
  G.surprises = buildSurprises(seed);     // online: seed'den aynı sürpriz kareler (iki taraf da aynı)
  G.bestWord = { text:'', score:0, who:'' };
  buildGameDOM();
  renderAll();
  if(KO) KO.subscribeRoom(applyRemote);
}

function currentTurn(){ return G.online ? G.state.turn : G.who; }
function isMyTurn(){ return G.online ? (G.state.turn === G.role) : true; }

function applyRemote(room){
  if(!G || !G.online) return;
  try{ if(room.boardStr) G.state.board = JSON.parse(room.boardStr); }catch(e){}
  if(room.scores) G.state.scores = room.scores;
  if(room.turn) G.state.turn = room.turn;
  if(room.bagPointer != null) G.state.bagPointer = room.bagPointer;
  G.state.passStreak = room.passStreak || 0;
  const oppRole = G.role==='A'?'B':'A';
  const oppPres = room.presence ? room.presence[oppRole] : true;
  if(oppPres === false && G.oppPresent && !G._over){ G.oppPresent=false; onlineGameOver('Rakip oyundan ayrıldı. Kazandın! 🎉'); return; }
  if(room.status === 'over' && !G._over){ onlineGameOver(room.overMsg || 'Oyun bitti'); return; }
  if(room.lastMove && room.lastMove.who && room.lastMove.who !== G.role && room.lastMove.ts !== G._lastSeenMove){
    G._lastSeenMove = room.lastMove.ts;
    const lm = room.lastMove;
    if(lm.pass){ flashStatus('Rakip pas geçti'); }
    else {
      // rakibin hamlesini kutla (görsel + ses)
      if(lm.score){ scorePopup('+'+lm.score); if(lm.bingo){ sndBingo(); confetti(); } else sndWord(lm.score); }
      if(lm.words && lm.words.length){ if(lm.words[0] && lm.words[0].score){ trackBest(lm.words, room.lastMove.who); } flashStatus('Rakip: '+lm.words.map(w=>w.text||w).join(', ')+' (+'+lm.score+')'); }
      if(lm.surp && lm.surp.length){ setTimeout(()=>{ surpriseStrip(lm.surp.map(l=>({icon:'🎁',label:l}))); sndSurprise(); }, 300); }
    }
  }
  renderAll();
}

function onlineGameOver(msg){
  if(G._over) return; G._over = true;
  try{ if(KO) KO.leaveRoom(); }catch(e){}
  const c = G.root.querySelector('[data-el="content"]');
  const mine = G.state.scores[G.role], opp = G.state.scores[G.role==='A'?'B':'A'];
  const verdict = mine===opp?'Berabere':(mine>opp?'Kazandın! 🎉':'Kaybettin 😔');
  if(mine>opp){ sndWin(); confetti(); } else if(mine<opp){ sndLose(); }
  const bw = G.bestWord && G.bestWord.score ? `<p style="color:#c9b8e8;font-size:12px">🏆 En iyi kelime: <b>${G.bestWord.text}</b> (${G.bestWord.score} puan)</p>` : '';
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>🏁 Oyun Bitti</h3><p>${msg}</p>
    <p>Sen: ${mine} · Rakip: ${opp}</p>
    <p style="color:#ffd86b;font-weight:700">${verdict}</p>${bw}
    <button class="kl-btn primary" data-x="menu">Menüye Dön</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="menu"]').addEventListener('click', ()=>{ ov.remove(); G.online=false; G._over=false; showStart(); });
}

function buildGameDOM(){
  const c = G.root.querySelector('[data-el="content"]');
  let cells = '';
  for(let r=0;r<SIZE;r++) for(let cc=0;cc<SIZE;cc++){
    const b = bonusAt(r,cc);
    const isSurp = G.surprises && G.surprises[r+','+cc];
    let cls = 'kl-cell';
    if(isSurp) cls+=' b-surprise';
    else if(b.center) cls+=' b-center'; else if(b.label==='K³')cls+=' b-K3'; else if(b.label==='K²')cls+=' b-K2'; else if(b.label==='H³')cls+=' b-H3'; else if(b.label==='H²')cls+=' b-H2';
    const label = isSurp ? '🎁' : (b.center?'★':b.label);
    cells += `<div class="${cls}" data-r="${r}" data-c="${cc}"><span class="bl">${label}</span></div>`;
  }
  c.innerHTML = `
    <div class="kl-scores">
      <div class="kl-score" data-el="scoreA"><div class="nm" data-el="nameA">Oyuncu 1</div><div class="pt" data-el="ptA">0</div></div>
      <div class="kl-gem" title="Kelime Düellosu"></div>
      <div class="kl-score" data-el="scoreB"><div class="nm" data-el="nameB">Oyuncu 2</div><div class="pt" data-el="ptB">0</div></div>
    </div>
    <div class="kl-status" data-el="status"></div>
    <div class="kl-boardwrap"><div class="kl-board" data-el="board">${cells}</div></div>
    <div class="kl-rackwrap"><div class="kl-rack" data-el="rack"></div></div>
    <div class="kl-actions">
      <button class="kl-btn" data-act="recall">↩︎ Geri Al</button>
      <button class="kl-btn warn" data-act="exchange">🔄 Değiştir</button>
      <button class="kl-btn warn" data-act="pass">⏭️ Geç</button>
      <button class="kl-btn primary" data-act="submit">✓ Onayla</button>
    </div>`;
  // tahta hücre tıklama
  c.querySelector('[data-el="board"]').addEventListener('click', (e)=>{
    const cell = e.target.closest('.kl-cell'); if(!cell) return;
    onCellTap(+cell.dataset.r, +cell.dataset.c);
  });
  c.querySelector('[data-act="recall"]').addEventListener('click', recallAll);
  c.querySelector('[data-act="exchange"]').addEventListener('click', exchangeTiles);
  c.querySelector('[data-act="pass"]').addEventListener('click', passTurn);
  c.querySelector('[data-act="submit"]').addEventListener('click', submitMove);
}

function renderAll(){ renderScores(); renderBoard(); renderRack(); if(G.pending && G.pending.length) previewMove(); }

// Canlı puan hesaplayıcı — taş koydukça anlık puanı gösterir
function previewMove(){
  const s = G.root.querySelector('[data-el="status"]'); if(!s || !G.state) return;
  if(!G.pending.length){ renderScores(); return; }
  const pv = previewPlacement(G.state.board, G.pending);
  if(pv.valid) s.innerHTML = `<span class="kl-turn me">⚡ Bu hamle: +${pv.score} ✓</span>`;
  else s.innerHTML = `<span class="kl-turn opp">⚡ +${pv.score} · ${pv.reason || 'kelimeyi tamamla'}</span>`;
}

function scorePopup(text){
  const c = G.root.querySelector('[data-el="content"]'); if(!c) return;
  const d = document.createElement('div'); d.className='kl-scorepop'; d.textContent=text;
  c.appendChild(d); setTimeout(()=>d.remove(), 1250);
}
function surpriseStrip(items){
  const c = G.root.querySelector('[data-el="content"]'); if(!c || !items.length) return;
  const wrap = document.createElement('div'); wrap.className='kl-strip';
  wrap.innerHTML = items.map(it=>`<div class="kl-surp">${it.icon} ${it.label}</div>`).join('<br>');
  c.appendChild(wrap); setTimeout(()=>wrap.remove(), 2000);
}
function confetti(){
  const c = G.root.querySelector('[data-el="content"]'); if(!c) return;
  const box = document.createElement('div'); box.className='kl-confetti';
  const colors = ['#ffe08a','#b14de0','#7c3aed','#d6299a','#6cff9a','#5aa6d6'];
  for(let i=0;i<70;i++){ const s=document.createElement('i'); s.style.left=(Math.random()*100)+'%'; s.style.background=colors[i%colors.length]; s.style.animationDuration=(1.2+Math.random()*1.3)+'s'; s.style.animationDelay=(Math.random()*0.35)+'s'; box.appendChild(s); }
  c.appendChild(box); setTimeout(()=>box.remove(), 2700);
}

function renderScores(){
  const q = s => G.root.querySelector(s);
  q('[data-el="nameA"]').textContent = G.names.A;
  q('[data-el="nameB"]').textContent = G.names.B;
  q('[data-el="ptA"]').textContent = G.state.scores.A;
  q('[data-el="ptB"]').textContent = G.state.scores.B;
  const ct = currentTurn();
  q('[data-el="scoreA"]').classList.toggle('active', ct==='A');
  q('[data-el="scoreB"]').classList.toggle('active', ct==='B');
  if(G.online){
    const remain = Math.max(0, 100 - (G.state.bagPointer||0));
    const pill = isMyTurn() ? `<span class="kl-turn me">▶ Senin sıran</span>` : `<span class="kl-turn opp">${G.oppName} oynuyor…</span>`;
    q('[data-el="status"]').innerHTML = `${pill} &nbsp; Torbada ~${remain}`;
  } else {
    q('[data-el="status"]').innerHTML = `<span class="kl-turn me">${G.names[G.who]}</span> &nbsp; Torbada ${G.state.bag.length} taş`;
  }
}

function renderBoard(){
  const board = G.root.querySelector('[data-el="board"]');
  for(const cell of board.children){
    const r=+cell.dataset.r, cc=+cell.dataset.c;
    const existing = G.state.board[r][cc];
    const pend = G.pending.find(p=>p.r===r&&p.c===cc);
    // önce eski taşı temizle
    const old = cell.querySelector('.kl-tile'); if(old) old.remove();
    const bl = cell.querySelector('.bl');
    if(existing || pend){
      if(bl) bl.style.visibility='hidden';
      if(existing) cell.classList.remove('b-surprise');   // kalıcı taş geldi → sürpriz parıltısını kaldır
      const t = existing || pend;
      const letter = t.joker ? (t.assigned||'') : t.letter;
      const pts = t.joker ? 0 : (t.points!=null?t.points:letterPoints(t.letter));
      const div = document.createElement('div');
      div.className = 'kl-tile'+(pend?' pending':'')+(t.joker?' joker':'');
      div.innerHTML = `<span class="l">${letter}</span><span class="p">${pts}</span>`;
      cell.appendChild(div);
    } else {
      if(bl) bl.style.visibility='visible';
    }
    cell.classList.remove('target');
  }
}

function renderRack(){
  const rack = G.root.querySelector('[data-el="rack"]');
  rack.innerHTML = '';
  G.rackView.forEach((t, i)=>{
    const d = document.createElement('div');
    d.className = 'kl-rtile'+(t.joker?' joker':'')+(G.selected===i?' sel':'');
    d.innerHTML = t.joker ? `<span>★</span>` : `<span>${t.letter}</span><span class="p">${t.points}</span>`;
    d.addEventListener('click', ()=>{ G.selected = (G.selected===i?null:i); renderRack(); });
    rack.appendChild(d);
  });
  // boş yuvaları doldur (görsel hizalama)
  for(let i=G.rackView.length;i<RACK_SIZE;i++){
    const d=document.createElement('div'); d.className='kl-rtile empty'; rack.appendChild(d);
  }
}

function onCellTap(r, c){
  if(G.online && !isMyTurn()){ flashStatus('Sıra rakipte, bekle'); return; }
  // doluysa (kalıcı) — bir şey yapma
  if(G.state.board[r][c]) return;
  const pendIdx = G.pending.findIndex(p=>p.r===r&&p.c===c);
  if(pendIdx>=0){
    // pending taşı rafa geri al
    const p = G.pending.splice(pendIdx,1)[0];
    G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker });
    G.selected=null; sndPick(); renderAll(); return;
  }
  // rafta seçili taş yoksa uyar
  if(G.selected==null){ flashStatus('Önce rafta bir harf seç'); return; }
  const tile = G.rackView[G.selected];
  if(tile.joker){
    // joker hangi harf? seçici aç
    pickJokerLetter((chosen)=>{
      placeTile(r,c,{ letter:'', points:0, joker:true, assigned:chosen });
    });
  } else {
    placeTile(r,c,{ letter:tile.letter, points:tile.points, joker:false });
  }
}

function placeTile(r,c,tileData){
  // rafView'dan seçili taşı çıkar
  G.rackView.splice(G.selected,1);
  G.pending.push({ r, c, ...tileData });
  G.selected=null; sndPlace(); haptic(12); renderAll();
}

function pickJokerLetter(cb){
  const c = G.root.querySelector('[data-el="content"]');
  const ov = document.createElement('div');
  ov.className='kl-overlay';
  ov.innerHTML = `<div class="kl-card"><h3>Joker harfi</h3><p>Bu joker hangi harf olsun?</p>
    <div class="kl-jokergrid">${LETTER_LIST.map(l=>`<button class="kl-jk" data-l="${l}">${l}</button>`).join('')}</div>
    <button class="kl-btn" style="margin-top:10px" data-x="iptal">İptal</button></div>`;
  c.appendChild(ov);
  ov.querySelectorAll('.kl-jk').forEach(b=>b.addEventListener('click',()=>{ ov.remove(); cb(b.dataset.l); }));
  ov.querySelector('[data-x="iptal"]').addEventListener('click',()=>ov.remove());
}

function flashStatus(msg){
  const s = G.root.querySelector('[data-el="status"]'); if(!s) return;
  const prev = s.textContent; s.textContent = msg; s.style.color='#ffd86b';
  setTimeout(()=>{ s.style.color=''; renderScores(); }, 1600);
}

function recallAll(){
  for(const p of G.pending) G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker });
  G.pending=[]; G.selected=null; sndPick(); renderAll();
}

// Sürpriz karelerin ödüllerini topla + tüket
function applySurprises(pending){
  let extraPoints=0, doubleMul=1, extraTiles=0; const hits=[];
  if(!G.surprises) return { extraPoints, doubleMul, extraTiles, hits };
  for(const p of pending){
    const key = p.r+','+p.c; const s = G.surprises[key];
    if(!s) continue;
    const info = SURPRISE_INFO[s.type];
    hits.push({ icon:info.icon, label:info.label });
    if(info.kind==='points') extraPoints += info.points;
    else if(info.kind==='double') doubleMul = 2;
    else if(info.kind==='extra') extraTiles += 1;
    delete G.surprises[key];
  }
  return { extraPoints, doubleMul, extraTiles, hits };
}
function trackBest(words, who){
  for(const w of words) if(w.score > G.bestWord.score) G.bestWord = { text:w.text, score:w.score, who };
}
function celebrate(moveScore, bingo, hits){
  scorePopup('+'+moveScore);
  haptic(bingo ? [30,40,30,40,70] : 20);
  if(bingo){ sndBingo(); confetti(); }
  else { sndWord(moveScore); if(moveScore>=40) confetti(); }
  if(hits && hits.length){ setTimeout(()=>{ surpriseStrip(hits); sndSurprise(); haptic([20,30,40]); }, 320); }
}

function submitMove(){
  if(G.online && !isMyTurn()){ flashStatus('Sıra rakipte, bekle'); return; }
  const res = validatePlacement(G.state.board, G.pending);
  if(!res.ok){ sndErr(); haptic(60); flashStatus('✗ '+res.error); return; }
  const surp = applySurprises(G.pending);
  const moveScore = res.score * surp.doubleMul + surp.extraPoints;
  const who = currentTurn();
  commitMove(G.state, G.pending, moveScore, who);
  trackBest(res.words, who);
  celebrate(moveScore, !!res.bingo, surp.hits);
  const need = RACK_SIZE - G.rackView.length + surp.extraTiles;
  if(G.online){
    const fresh = G.bag.slice(G.state.bagPointer, G.state.bagPointer+need).map(t=>({letter:t.letter,points:t.points,joker:t.joker}));
    G.state.bagPointer += fresh.length;
    G.rackView = G.rackView.concat(fresh);
    const nextRole = G.role==='A'?'B':'A';
    G.state.turn = nextRole;
    const patch = {
      boardStr: JSON.stringify(G.state.board),
      scores: G.state.scores, turn: nextRole,
      bagPointer: G.state.bagPointer, passStreak:0,
      lastMove: { who:G.role, words:res.words, score:moveScore, bingo:!!res.bingo, surp:surp.hits.map(h=>h.label), ts:Date.now() }
    };
    G.pending=[]; G.selected=null;
    if(KO) KO.pushMove(patch);
    renderAll();
    return;
  }
  // 2 oyuncu: rafı doldur, kutlama oynar, sonra sıra geçiş ekranı (kutlama modalın üstünde görünür)
  G.state.racks[who] = G.rackView.concat(drawFromBag(G.state.bag, need));
  G.pending=[]; G.selected=null;
  renderAll();
  nextTurn();
}

function showMoveResult(res, cb){
  const c = G.root.querySelector('[data-el="content"]');
  const ov = document.createElement('div'); ov.className='kl-overlay';
  const wl = res.words.map(w=>`<div>• <b>${w.text}</b> — ${w.score} puan</div>`).join('');
  ov.innerHTML = `<div class="kl-card"><h3>+${res.score} puan!</h3>
    <div class="kl-words">${wl}</div>
    ${res.bingo?'<p style="color:#6cff9a;margin-top:8px">🎉 Tüm harfler! +30 bonus</p>':''}
    <button class="kl-btn primary" style="margin-top:14px" data-x="ok">Devam</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="ok"]').addEventListener('click',()=>{ ov.remove(); cb(); });
}

function passTurn(){
  if(G.online && !isMyTurn()){ flashStatus('Sıra rakipte, bekle'); return; }
  if(G.pending.length>0){ flashStatus('Önce taşları geri al'); return; }
  if(G.online){
    const ps = (G.state.passStreak||0)+1;
    const nextRole = G.role==='A'?'B':'A';
    G.state.passStreak = ps; G.state.turn = nextRole;
    const patch = { turn:nextRole, passStreak:ps, lastMove:{ who:G.role, pass:true, ts:Date.now() } };
    if(ps>=4){ patch.status='over'; patch.overMsg='İki taraf da pas geçti — oyun bitti'; }
    if(KO) KO.pushMove(patch);
    renderAll();
    if(ps>=4) onlineGameOver('İki taraf da pas geçti — oyun bitti');
    else flashStatus('Pas geçtin · rakip bekleniyor');
    return;
  }
  G.state.passStreak++;
  if(G.state.passStreak>=4){ endGame(); return; }
  nextTurn();
}

function exchangeTiles(){
  if(G.online){ flashStatus('Çevrimiçi modda harf değişimi kapalı'); return; }
  if(G.pending.length>0){ flashStatus('Önce taşları geri al'); return; }
  if(G.state.bag.length===0){ flashStatus('Torba boş, değişim yok'); return; }
  // basit: seçili taşı değiştir; seçili yoksa tümünü
  let toSwap;
  if(G.selected!=null){ toSwap=[G.selected]; }
  else { flashStatus('Değiştirilecek harfi seç (yoksa Geç kullan)'); return; }
  const removed = toSwap.map(i=>G.rackView[i]);
  G.rackView = G.rackView.filter((_,i)=>!toSwap.includes(i));
  const fresh = drawFromBag(G.state.bag, removed.length);
  G.rackView = G.rackView.concat(fresh);
  // çıkarılanları torbaya geri at + karıştır
  for(const t of removed) G.state.bag.unshift(t);
  for(let i=G.state.bag.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [G.state.bag[i],G.state.bag[j]]=[G.state.bag[j],G.state.bag[i]]; }
  G.state.racks[G.who]=G.rackView.slice();
  G.selected=null; sndPick();
  G.state.passStreak=0;
  nextTurn();
}

function nextTurn(){
  G.who = (G.who==='A') ? 'B' : 'A';
  G.rackView = G.state.racks[G.who].slice();
  G.selected=null; G.pending=[];
  // sıra geçişi bilgilendirme
  const c = G.root.querySelector('[data-el="content"]');
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>${G.names[G.who]} sırası</h3><p>Cihazı ${G.names[G.who]}'e ver, hazır olunca başla.</p><button class="kl-btn primary" data-x="go">Hazırım ▶</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="go"]').addEventListener('click',()=>{ ov.remove(); renderAll(); });
}

function endGame(){
  const c = G.root.querySelector('[data-el="content"]');
  const a=G.state.scores.A, b=G.state.scores.B;
  const win = a===b ? 'Berabere!' : (a>b? `${G.names.A} kazandı!` : `${G.names.B} kazandı!`);
  if(a!==b){ sndWin(); confetti(); } else sndLose();
  const bw = G.bestWord && G.bestWord.score ? `<p style="color:#c9b8e8;font-size:12px">🏆 En iyi kelime: <b>${G.bestWord.text}</b> (${G.bestWord.score} puan)</p>` : '';
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>🏁 Oyun Bitti</h3>
    <p>${G.names.A}: ${a} &nbsp;·&nbsp; ${G.names.B}: ${b}</p>
    <p style="color:#ffd86b;font-weight:700">${win}</p>${bw}
    <button class="kl-btn primary" data-x="again">Yeni Oyun</button>
    <button class="kl-btn" style="margin-top:8px" data-x="close">Kapat</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="again"]').addEventListener('click',()=>{ ov.remove(); startLocal(); });
  ov.querySelector('[data-x="close"]').addEventListener('click', closeKelime);
}
