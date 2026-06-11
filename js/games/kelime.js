// ════════════════════════════════════════════════════════════════
//  KELİMECİK — Ana UI / Kontrolcü
//  15x15 tahta (DOM grid), harf rafı, tap-to-place yerleştirme,
//  tur akışı (onayla/geç/değiştir), joker seçici, puanlama.
//  İlk sürüm: 2 oyuncu (aynı cihazda sırayla). AI/online sonraki faz.
// ════════════════════════════════════════════════════════════════
import {
  newGame, validatePlacement, commitMove, drawFromBag, buildBagSeeded, isEmptyBoard,
  buildSurprises, SURPRISE_INFO, previewPlacement,
  SIZE, RACK_SIZE, bonusAt, letterPoints, LETTERS, JOKER_COUNT
} from './kelime-engine.js';
import * as Resume from './resume.js';

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
.kl-top{display:flex;align-items:center;gap:11px;padding:11px 14px 10px;flex:0 0 auto;border-bottom:1px solid rgba(200,170,255,.1);background:linear-gradient(180deg,rgba(168,85,247,.07),transparent)}
.kl-gameicon{width:42px;height:42px;flex:0 0 auto;border-radius:11px;background:linear-gradient(150deg,#a855f7,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 3px 10px rgba(124,58,237,.5),inset 0 1px 0 rgba(255,255,255,.35)}
.kl-brand{flex:1;min-width:0}
.kl-title{font-weight:800;letter-spacing:.5px;font-size:17px;line-height:1.1;background:linear-gradient(90deg,#ffe08a,#f0b132);-webkit-background-clip:text;background-clip:text;color:transparent}
.kl-sub{font-size:11px;color:#c9b8e8;opacity:.85;margin-top:1px}
.kl-icon{width:38px;height:38px;flex:0 0 auto;border-radius:10px;border:1px solid rgba(200,170,255,.22);background:rgba(168,85,247,.12);color:#efe7ff;font-size:17px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.kl-icon:active{transform:scale(.93)}
.kl-scores{display:flex;align-items:center;gap:8px;padding:0 12px 8px;flex:0 0 auto}
.kl-score{flex:1;background:linear-gradient(165deg,rgba(168,85,247,.15),rgba(124,58,237,.04));border:1px solid rgba(200,170,255,.18);border-radius:14px;padding:8px 10px;text-align:center;transition:.2s;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 2px 8px rgba(0,0,0,.22)}
.kl-score.active{border-color:#f0b132;background:linear-gradient(165deg,rgba(240,177,50,.22),rgba(240,177,50,.05));box-shadow:0 0 18px rgba(240,177,50,.34),inset 0 1px 0 rgba(255,255,255,.14)}
.kl-score .nm{font-size:11px;color:#cbb9ea;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kl-score .pt{font-size:21px;font-weight:800;background:linear-gradient(90deg,#ffe08a,#f0b132);-webkit-background-clip:text;background-clip:text;color:transparent}
.kl-gem{width:30px;height:30px;flex:0 0 auto;border-radius:7px;transform:rotate(45deg);background:linear-gradient(135deg,#d8b4fe,#7c3aed);border:2px solid #e9c466;box-shadow:0 0 16px rgba(168,85,247,.6),inset 0 0 7px rgba(255,255,255,.45)}
.kl-status{text-align:center;font-size:13px;padding:0 12px 6px;min-height:18px;color:#d9caf2;flex:0 0 auto}
.kl-timerbar{height:6px;margin:-2px 12px 6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;display:none}
.kl-timerbar.on{display:block}
.kl-timerfill{height:100%;width:100%;border-radius:4px;background:linear-gradient(90deg,#6cff9a,#ffe08a);transition:width 1s linear}
.kl-timerfill.low{background:#ff5470;transition:width 1s linear}
.kl-status .kl-turn{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;font-size:12px}
.kl-status .kl-turn.me{background:linear-gradient(90deg,#ffe08a,#f0b132);color:#3a2400}
.kl-status .kl-turn.opp{background:rgba(168,85,247,.2);color:#e3d3ff;border:1px solid rgba(200,170,255,.25)}
.kl-boardwrap{flex:1 1 auto;display:flex;align-items:center;justify-content:center;padding:4px 8px;min-height:0;position:relative}
.kl-boardwrap.large-scroll{align-items:flex-start;justify-content:flex-start;overflow:auto;-webkit-overflow-scrolling:touch}
.kl-zoomdock{position:fixed;z-index:9998;display:flex;align-items:center;gap:3px;padding:3px 3px 3px 9px;border-radius:999px;background:linear-gradient(165deg,rgba(52,37,23,.92),rgba(30,21,13,.92));backdrop-filter:blur(6px);border:1px solid rgba(255,220,170,.22);box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,235,200,.14);touch-action:none;user-select:none;cursor:grab}
.kl-zoomdock::before{content:'';width:3px;height:14px;margin-right:4px;border-radius:2px;background:repeating-linear-gradient(180deg,rgba(255,225,170,.45) 0 2px,transparent 2px 4px)}
.kl-zoomdock:active{cursor:grabbing}
.kl-zbtn{width:22px;height:22px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.05);color:#ffe08a;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;transition:transform .12s,background .12s}
.kl-zbtn:active{transform:scale(.88);background:rgba(255,220,150,.18)}
.kl-zbtn.active{background:rgba(240,177,50,.32);border-color:#f0b132;box-shadow:0 0 9px rgba(240,177,50,.45)}
.kl-zbtn:active{transform:scale(.88)}
.kl-ztip{position:fixed;white-space:nowrap;background:#2a1c12;color:#ffe9b8;font-size:12px;font-weight:700;padding:5px 10px;border-radius:8px;border:1px solid rgba(255,220,170,.3);box-shadow:0 4px 12px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .15s;z-index:9999}
.kl-ztip.show{opacity:1}
.kl-starbar{text-align:center;font-size:15px;letter-spacing:3px;color:#ffd86b;line-height:1;margin:-2px 0 3px;flex:0 0 auto;text-shadow:0 1px 2px rgba(0,0,0,.4)}
.kl-flagbtn{position:absolute;top:8px;right:10px;z-index:30;width:30px;height:30px;border-radius:999px;border:1px solid rgba(255,220,170,.25);background:linear-gradient(165deg,rgba(52,37,23,.9),rgba(30,21,13,.9));font-size:13px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.4);transition:transform .12s}
.kl-flagbtn:active{transform:scale(.9)}
.kl-gm-list{display:flex;flex-direction:column;gap:9px;margin-top:12px}
.kl-board{display:grid;grid-template-columns:repeat(15,1fr);grid-template-rows:repeat(15,1fr);gap:1.5px;width:min(96vw,460px);aspect-ratio:1;background:linear-gradient(145deg,#77583b,#48331f);border:3px solid #2c2013;border-radius:12px;padding:5px;box-shadow:0 18px 44px rgba(0,0,0,.6),0 0 0 1px rgba(255,220,170,.16),inset 0 0 0 2px rgba(255,208,138,.18),inset 0 2px 5px rgba(0,0,0,.42)}
.kl-board.large{width:min(168vw,780px);max-width:none;flex:0 0 auto}
.kl-cell{position:relative;background:linear-gradient(160deg,#f1e8d6,#ddd0b5);border-radius:2px;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;color:rgba(95,72,45,.62);user-select:none;cursor:pointer;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -1px 1px rgba(0,0,0,.08)}
.kl-cell.b-K3{background:linear-gradient(160deg,#ef5350,#c52f2a);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.4)}
.kl-cell.b-K2{background:linear-gradient(160deg,#f7a64d,#e07d22);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35)}
.kl-cell.b-H3{background:linear-gradient(160deg,#3f86cc,#1f5996);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.4)}
.kl-cell.b-H2{background:linear-gradient(160deg,#7ec8ed,#3fa1d6);color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.3)}
.kl-cell.b-center{background:linear-gradient(160deg,#ffe08a,#e3a82f);color:#3a2400;font-size:12px}
.kl-cell.target{outline:2px solid #ffd86b;outline-offset:-2px}
.kl-cell.drop-target{outline:3px solid #6cff9a;outline-offset:-2px;box-shadow:inset 0 0 10px rgba(108,255,154,.6)}
.kl-tile{position:absolute;inset:1px;border-radius:4px;background:linear-gradient(165deg,#fdf6e3 0%,#f1e1b8 55%,#e4cf97 100%);color:#3a2a10;display:flex;align-items:center;justify-content:center;font-weight:800;box-shadow:0 1.5px 0 #b9a06a,0 3px 4px rgba(0,0,0,.5),inset 0 1.5px 1px rgba(255,255,255,.85),inset 0 -2px 2px rgba(150,110,40,.35)}
.kl-tile .l{font-size:14px;line-height:1;text-shadow:0 1px 0 rgba(255,255,255,.5)}
.kl-tile .p{position:absolute;right:1px;bottom:0;font-size:7px;font-weight:700;color:#9a6a1a}
.kl-tile.pending{background:linear-gradient(165deg,#fff3cf,#f5cf6b);box-shadow:0 1.5px 0 #d6a93f,0 0 11px rgba(240,177,50,.7),inset 0 1.5px 1px rgba(255,255,255,.85)}
.kl-tile.joker{background:linear-gradient(165deg,#f3e4ff,#c9aef0);color:#3a1a5e}
.kl-tile.lastmove{background:linear-gradient(165deg,#dafbe7,#a6e8c2);color:#16432f;box-shadow:0 1.5px 0 #2a9d6a,0 0 10px rgba(52,211,153,.9),inset 0 1.5px 1px rgba(255,255,255,.85)}
.kl-tile.lastmove .p{color:#1f7a52}
.kl-lt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px}
.kl-lt{background:rgba(168,85,247,.1);border:1px solid rgba(200,170,255,.18);border-radius:9px;padding:6px 2px;text-align:center}
.kl-lt.zero{opacity:.32}
.kl-lt .ltl{font-size:16px;font-weight:800;color:#efe7ff}
.kl-lt .ltn{font-size:12px;font-weight:800;color:#ffe08a}
.kl-lt .ltp{font-size:9px;color:#bba8df}
.kl-rackwrap{flex:0 0 auto;padding:8px 10px 6px;display:flex;align-items:center;gap:8px}
.kl-rack{display:flex;gap:6px;justify-content:center;flex:1;min-width:0;background:linear-gradient(180deg,#4c3a27,#352616);border:1px solid rgba(255,220,170,.22);border-radius:16px;padding:9px;min-height:58px;box-shadow:inset 0 3px 9px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,220,170,.14),0 2px 6px rgba(0,0,0,.3)}
.kl-shuffle{flex:0 0 auto;width:46px;height:46px;border-radius:13px;border:1px solid rgba(200,170,255,.22);background:rgba(168,85,247,.14);color:#efe7ff;font-size:20px;cursor:pointer}
.kl-shuffle:active{transform:scale(.92) rotate(180deg);transition:transform .2s}
.kl-rtile{width:44px;height:50px;border-radius:9px;background:linear-gradient(165deg,#fdf6e3 0%,#f0e0b6 55%,#e6d3a4 100%);color:#3a2a10;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;position:relative;cursor:grab;touch-action:none;box-shadow:0 3px 0 #b9925a,0 5px 7px rgba(0,0,0,.45),inset 0 2px 1px rgba(255,255,255,.9),inset 0 -2px 3px rgba(150,110,40,.3);transition:transform .1s}
.kl-rtile>span:first-child{text-shadow:0 1px 0 rgba(255,255,255,.6)}
.kl-rtile.sel{transform:translateY(-9px);box-shadow:0 3px 0 #b9925a,0 0 15px rgba(240,177,50,.85),0 8px 12px rgba(0,0,0,.45)}
.kl-rtile.swap{transform:translateY(-4px);outline:2px solid #d6299a;outline-offset:-1px;opacity:.92}
.kl-rtile.swap::after{content:'⇄';position:absolute;top:-2px;left:3px;font-size:11px;color:#d6299a}
.kl-rtile.joker{background:linear-gradient(165deg,#f3e4ff,#c9aef0);color:#3a1a5e}
.kl-rtile .p{position:absolute;right:4px;bottom:2px;font-size:9px;color:#9a6a1a}
.kl-rtile.empty{background:rgba(255,255,255,.04);box-shadow:inset 0 2px 4px rgba(0,0,0,.25);cursor:default}
.kl-rtile.dragging{opacity:.35}
.kl-drag-ghost{position:fixed;z-index:9999;width:48px;height:54px;border-radius:9px;background:linear-gradient(165deg,#fdf6e3,#e6d3a4);color:#3a2a10;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;pointer-events:none;box-shadow:0 8px 18px rgba(0,0,0,.6),inset 0 2px 1px rgba(255,255,255,.9);transform:translate(-50%,-50%) scale(1.12)}
.kl-actions{display:flex;gap:6px;padding:6px 10px 12px}
.kl-btn{flex:1;padding:12px 6px;border-radius:13px;border:1px solid rgba(200,170,255,.22);background:linear-gradient(180deg,rgba(168,85,247,.17),rgba(124,58,237,.06));color:#efe7ff;font-weight:700;font-size:13px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 2px 5px rgba(0,0,0,.25)}
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
        <div class="kl-title">KELİMECİK</div>
        <div class="kl-sub">Türkçe · 59.000 kelime</div>
      </div>
      <button class="kl-icon" data-el="lettertable" title="Harf tablosu">📊</button>
      <button class="kl-icon" data-el="sound" title="Ses">🔊</button>
      <button class="kl-icon" data-act="close" title="Kapat">✕</button>
    </div>
    <div data-el="content" style="flex:1;display:flex;flex-direction:column;min-height:0;position:relative"></div>
  `;
  document.body.appendChild(root);
  G = { root, sound:true };
  root.querySelector('[data-act="close"]').addEventListener('click', closeKelime);
  root.querySelector('[data-el="lettertable"]').addEventListener('click', showLetterTable);
  const sb = root.querySelector('[data-el="sound"]');
  sb.addEventListener('click', ()=>{ G.sound=!G.sound; sb.textContent=G.sound?'🔊':'🔇'; });
  G.vis = ()=>{
    if(document.hidden){ try{ saveKelimeResume(); }catch(e){} }
    else if(G && G.online && !G.async && !G._over && KO){    // geri dön → hemen "buradayım"
      if(KO.rejoinPresence) KO.rejoinPresence();
      if(KO.heartbeat) KO.heartbeat();
    }
  };
  document.addEventListener('visibilitychange', G.vis);
  showStart();
}

function closeKelime(){ try{ saveKelimeResume(); }catch(e){} if(G && G._oppGrace){ try{ clearTimeout(G._oppGrace); }catch(e){} } try{ stopOnlineHeartbeat(); }catch(e){} try{ stopInviteListen(); }catch(e){} try{ stopTurnTimer(); }catch(e){} try{ if(G && G.online && KO) KO.leaveRoom(); }catch(e){} if(G && G.vis){ try{ document.removeEventListener('visibilitychange', G.vis); }catch(e){} } if(G && G.root) G.root.remove(); G=null; }

function showStart(){
  const c = G.root.querySelector('[data-el="content"]');
  let recHtml = '';
  try{
    const A = (window.Hero && window.Hero.Auth) ? window.Hero.Auth.getState() : null;
    const rec = A && A.profile && A.profile.kelimeRecords;
    if(rec && (rec.bestScore || rec.longestLen)){
      const parts = [];
      if(rec.longestWord) parts.push(`📏 En uzun: <b>${esc(rec.longestWord)}</b> (${rec.longestLen} harf)`);
      if(rec.bestWord) parts.push(`💎 En yüksek: <b>${esc(rec.bestWord)}</b> (${rec.bestScore} puan)`);
      recHtml = `<div style="margin:0 0 12px;padding:9px 12px;border-radius:11px;background:rgba(240,177,50,.1);border:1px solid rgba(240,177,50,.25);font-size:12px;color:#ffe9b8;line-height:1.6">🏆 Rekorların<br>${parts.join('<br>')}</div>`;
    }
  }catch(e){}
  let resumeHtml = '';
  const rsnap = Resume.loadSnapshot('kelime');
  if(rsnap){
    const d = rsnap.data;
    const lbl = d.mode === 'seri' ? 'Seri Mod' : 'Yapay Zekâ';
    const sc = d.scores ? `${d.scores.A||0}–${d.scores.B||0}` : '';
    resumeHtml = `<button class="kl-btn primary" data-x="resume" style="width:100%;margin:0 0 12px;text-align:left;padding:12px 14px">↩️ Kaldığın yerden devam et<br><span style="font-size:11px;opacity:.85;font-weight:500">${lbl} · ${sc} · ${Resume.fmtAge(rsnap.age)}</span></button>`;
  }
  c.innerHTML = `
    <div class="kl-overlay" style="position:relative;background:transparent">
      <div class="kl-card">
        <h3>🔤 Kelimecik</h3>
        <p>Türkçe kelime türetme oyunu · 15×15 tahta · 59.000 kelimelik TDK sözlüğü</p>
        ${resumeHtml}
        ${recHtml}
        <div class="kl-modes">
          <div class="kl-mode" data-mode="local"><span class="e">👥</span><div>2 Oyuncu<small>Aynı cihazda sırayla</small></div></div>
          <div class="kl-mode" data-mode="ai"><span class="e">🤖</span><div>Yapay Zekâ<small>3 zorluk · bilgisayara karşı</small></div></div>
          <div class="kl-mode" data-mode="seri"><span class="e">⏱️</span><div>Seri Mod (Süreli)<small>Hamle başına süre · hızlı oyun</small></div></div>
          <div class="kl-mode" data-mode="online"><span class="e">🌐</span><div>Çevrimiçi Rakip<small>Rastgele bir oyuncuyla eşleş</small></div></div>
          <div class="kl-mode" data-mode="invite"><span class="e">📨</span><div>Arkadaşını Davet Et<small>Nick ile meydan oku</small></div></div>
        </div>
      </div>
    </div>`;
  c.querySelector('[data-mode="local"]').addEventListener('click', ()=>startLocal());
  c.querySelector('[data-mode="ai"]').addEventListener('click', ()=>showAIDifficulty());
  const rb = c.querySelector('[data-x="resume"]');
  if(rb) rb.addEventListener('click', ()=>{ const r = Resume.loadSnapshot('kelime'); if(r) resumeKelime(r.data); else showStart(); });
  c.querySelector('[data-mode="seri"]').addEventListener('click', ()=>showSeriOptions());
  c.querySelector('[data-mode="online"]').addEventListener('click', ()=>showOnlineOptions());
  c.querySelector('[data-mode="invite"]').addEventListener('click', ()=>showInviteScreen());
}

function showAIDifficulty(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `
    <div class="kl-overlay" style="position:relative;background:transparent">
      <div class="kl-card">
        <h3>🤖 Yapay Zekâ</h3>
        <p>Zorluk seç — bilgisayara karşı oyna.</p>
        <div class="kl-modes">
          <div class="kl-mode" data-diff="kolay"><span class="e">🟢</span><div>Kolay<small>Kısa kelimeler, rahat tempo</small></div></div>
          <div class="kl-mode" data-diff="orta"><span class="e">🟡</span><div>Orta<small>Dengeli rakip</small></div></div>
          <div class="kl-mode" data-diff="zor"><span class="e">🔴</span><div>Zor<small>En yüksek puanı arar</small></div></div>
        </div>
        <button class="kl-btn" style="margin-top:12px" data-x="back">← Geri</button>
      </div>
    </div>`;
  c.querySelectorAll('[data-diff]').forEach(el=>el.addEventListener('click', ()=>startAI(el.dataset.diff)));
  c.querySelector('[data-x="back"]').addEventListener('click', showStart);
}

function startLocal(){
  const st = newGame();
  G.state = st;
  G.who = 'A';
  G.names = { A:'Oyuncu 1', B:'Oyuncu 2' };
  G.pending = [];
  G.rackView = st.racks[G.who].slice();   // bu turdaki kullanılabilir taşlar
  G.selected = null;
  G.ai = null;
  G.seri = null; stopTurnTimer();
  G.surprises = buildSurprises((Math.random()*0x7fffffff)|0);   // sürpriz kareler
  G.bestWord = { text:'', score:0, who:'' };
  G.lastMoveCells = new Set();
  G.myRecord = { best:{text:'',score:0}, longest:{text:'',len:0} };
  buildGameDOM();
  renderAll();
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
}

// ── YAPAY ZEKÂ ──
let KA = null;   // kelime-ai.js (talep üzerine yüklenir)
async function startAI(difficulty, turnTime){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>🤖 Hazırlanıyor…</h3><p>Sözlük yükleniyor</p></div></div>`;
  try{ if(!KA) KA = await import('./kelime-ai.js'); KA.aiReady(); }
  catch(e){ flashStartError('Yapay zekâ yüklenemedi.'); return; }
  Resume.clearSnapshot('kelime');                // yeni oyun → eski devam kaydını sil
  const st = newGame();
  G.state = st;
  G.who = 'A';                                   // insan = A
  G.ai = { difficulty, color:'B' };
  G.seri = turnTime ? { turnTime } : null;        // süreli seri mod
  const diffLbl = {kolay:'Kolay',orta:'Orta',zor:'Zor'}[difficulty];
  G.names = { A:'Sen', B:(turnTime?'Seri AI':'Yapay Zekâ')+' ('+diffLbl+')' };
  G.pending = []; G.selected = null;
  G.rackView = st.racks.A.slice();
  G.surprises = buildSurprises((Math.random()*0x7fffffff)|0);
  G.bestWord = { text:'', score:0, who:'' };
  G.lastMoveCells = new Set();
  G.myRecord = { best:{text:'',score:0}, longest:{text:'',len:0} };
  G.aiThinking = false; G._over = false;
  buildGameDOM();
  renderAll();
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(G.seri) startTurnTimer();                    // ilk insan turu için sayaç
}
function startSeri(turnTime){ startAI('orta', turnTime); }

// ── Kaldığın yerden devam (AI/Seri) ──
function saveKelimeResume(){
  if(!G || !G.state || G._over) return;
  if(!(G.ai || G.seri)) return;   // yalnız AI/Seri modunda
  try{
    Resume.saveSnapshot('kelime', {
      mode: G.seri ? 'seri' : 'ai',
      difficulty: G.ai ? G.ai.difficulty : 'orta',
      turnTime: G.seri ? G.seri.turnTime : 0,
      board: G.state.board, bag: G.state.bag, racks: G.state.racks,
      scores: G.state.scores, passStreak: G.state.passStreak || 0,
      who: G.who, rackView: G.rackView, pending: G.pending,
      surprises: G.surprises, names: G.names,
      lastMoveCells: Array.from(G.lastMoveCells || []),
      bestWord: G.bestWord, myRecord: G.myRecord
    });
  }catch(e){}
}
async function resumeKelime(snap){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>↩️ Devam ediliyor…</h3><p>Oyun yükleniyor</p></div></div>`;
  try{ if(!KA) KA = await import('./kelime-ai.js'); KA.aiReady(); }
  catch(e){ flashStartError('Yapay zekâ yüklenemedi.'); return; }
  G.state = {
    board: snap.board, bag: snap.bag, racks: snap.racks,
    scores: snap.scores, turn: snap.who, moveCount: 0,
    passStreak: snap.passStreak || 0, finished: false
  };
  G.who = snap.who;
  G.ai = { difficulty: snap.difficulty || 'orta', color: 'B' };
  G.seri = snap.mode === 'seri' ? { turnTime: snap.turnTime || 30 } : null;
  G.names = snap.names || { A:'Sen', B:'Yapay Zekâ' };
  G.pending = snap.pending || [];
  G.selected = null;
  G.rackView = snap.rackView || (G.state.racks.A ? G.state.racks.A.slice() : []);
  G.surprises = snap.surprises || {};
  G.bestWord = snap.bestWord || { text:'', score:0, who:'' };
  G.lastMoveCells = new Set(snap.lastMoveCells || []);
  G.myRecord = snap.myRecord || { best:{text:'',score:0}, longest:{text:'',len:0} };
  G.aiThinking = false; G._over = false;
  buildGameDOM();
  renderAll();
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  flashStatus('↩️ Kaldığın yerden devam');
  if(G.who === 'B'){           // sıra AI'daydı → oynat
    G.aiThinking = true; renderScores();
    setTimeout(aiTurn, 700);
  } else if(G.seri){ startTurnTimer(); }
}

function showSeriOptions(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `
    <div class="kl-overlay" style="position:relative;background:transparent">
      <div class="kl-card">
        <h3>⏱️ Seri Mod</h3>
        <p>Her hamle için süre! Süre dolarsa otomatik pas. Orta seviye yapay zekâya karşı hızlı oyna.</p>
        <div class="kl-modes">
          <div class="kl-mode" data-t="20"><span class="e">⚡</span><div>Hızlı<small>Hamle başına 20 sn</small></div></div>
          <div class="kl-mode" data-t="40"><span class="e">⏱️</span><div>Normal<small>Hamle başına 40 sn</small></div></div>
          <div class="kl-mode" data-t="60"><span class="e">🐢</span><div>Rahat<small>Hamle başına 60 sn</small></div></div>
        </div>
        <button class="kl-btn" style="margin-top:12px" data-x="back">← Geri</button>
      </div>
    </div>`;
  c.querySelectorAll('[data-t]').forEach(el=>el.addEventListener('click', ()=>startSeri(+el.dataset.t)));
  c.querySelector('[data-x="back"]').addEventListener('click', showStart);
}

function flashStartError(msg){
  const c = G.root.querySelector('[data-el="content"]');
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>⚠️</h3><p>${msg}</p><button class="kl-btn primary" data-x="ok">Tamam</button></div>`;
  c.appendChild(ov); ov.querySelector('[data-x="ok"]').addEventListener('click',()=>{ ov.remove(); showStart(); });
}

// ── ÇEVRİMİÇİ: rastgele eşleşme ──
async function startOnlineSearch(opts){
  opts = opts || {};
  const async = opts.mode === 'async';
  const c = G.root.querySelector('[data-el="content"]');
  if(!document.getElementById('kl-spin-kf')){ const s=document.createElement('style'); s.id='kl-spin-kf'; s.textContent='@keyframes klspin{to{transform:rotate(360deg)}}'; document.head.appendChild(s); }
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent">
    <div class="kl-card">
      <h3>🌐 Rakip Aranıyor…</h3>
      <p>${async?'Süreli oyun için bir rakip bekleniyor. Eşleşince ilk hamleni yap; rakip sonra (saatler içinde) oynayabilir.':'Çevrimiçi bir oyuncu bekleniyor. Biri katılınca oyun otomatik başlar.'}</p>
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
    onMatched: (d)=>{ if(!cancelled) startOnline(d.role, d.gameId, d.oppName, d.seed, { async:!!d.async, turnHours:d.turnHours }); }
  }, async ? { mode:'async', turnHours: opts.turnHours||72 } : undefined);
}

// Çevrimiçi mod seçimi
function showOnlineOptions(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `
    <div class="kl-overlay" style="position:relative;background:transparent">
      <div class="kl-card">
        <h3>🌐 Çevrimiçi Rakip</h3>
        <p>Anlık oyna ya da süreli (rakip sonra oynar) bir oyun başlat.</p>
        <div class="kl-modes">
          <div class="kl-mode" data-on="live"><span class="e">⚡</span><div>Anlık<small>Gerçek zamanlı, aynı anda</small></div></div>
          <div class="kl-mode" data-on="12"><span class="e">⏳</span><div>Süreli · 12 saat<small>Hamle başına 12 saat süre</small></div></div>
          <div class="kl-mode" data-on="72"><span class="e">⏳</span><div>Süreli · 72 saat<small>Hamle başına 72 saat süre</small></div></div>
          <div class="kl-mode" data-on="mygames"><span class="e">📂</span><div>Devam eden oyunlarım<small>Süreli oyunlarına dön</small></div></div>
        </div>
        <button class="kl-btn" style="margin-top:12px" data-x="back">← Geri</button>
      </div>
    </div>`;
  c.querySelector('[data-on="live"]').addEventListener('click', ()=>startOnlineSearch());
  c.querySelector('[data-on="12"]').addEventListener('click', ()=>startOnlineSearch({mode:'async',turnHours:12}));
  c.querySelector('[data-on="72"]').addEventListener('click', ()=>startOnlineSearch({mode:'async',turnHours:72}));
  c.querySelector('[data-on="mygames"]').addEventListener('click', ()=>showMyGames());
  c.querySelector('[data-x="back"]').addEventListener('click', showStart);
}

function fmtRemain(ms){
  if(ms<=0) return 'süre doldu';
  const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
  return h>0 ? `${h}s ${m}dk` : `${m}dk`;
}

async function showMyGames(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>📂 Yükleniyor…</h3></div></div>`;
  try{ if(!KO) KO = await import('./kelime-online.js'); }
  catch(e){ flashCard('Yüklenemedi','Bağlantını kontrol et.'); return; }
  let games=[]; try{ games = await KO.listMyGames(); }catch(e){}
  const now = Date.now();
  const rows = games.length ? games.map((g,i)=>{
    const mine = g.scores[g.myRole], opp = g.scores[g.myRole==='A'?'B':'A'];
    let badge, act;
    if(g.over){ badge = `<small>Bitti · ${mine}-${opp}</small>`; act='view'; }
    else if(g.myTurn){ badge = `<small style="color:#6cff9a">▶ Sıra sende · ${mine}-${opp}</small>`; act='play'; }
    else {
      const over = g.deadline && now > g.deadline;
      badge = over
        ? `<small style="color:#ff8fae">Rakibin süresi doldu · galibiyet alabilirsin</small>`
        : `<small style="color:#bba8df">Rakipte · kalan ${fmtRemain((g.deadline||0)-now)} · ${mine}-${opp}</small>`;
      act = over ? 'claim' : 'view';
    }
    return `<div class="kl-mode" data-i="${i}" data-act="${act}"><span class="e">${g.over?'🏁':(g.myTurn?'⚔️':'⌛')}</span><div>${esc(g.opp)}${badge}</div></div>`;
  }).join('') : `<div style="font-size:12px;color:#8a7aae">Devam eden süreli oyunun yok.</div>`;
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card">
      <h3>📂 Devam Eden Oyunlarım</h3>
      <div class="kl-modes" data-el="mglist">${rows}</div>
      <button class="kl-btn" style="margin-top:12px" data-x="back">← Geri</button>
    </div></div>`;
  const card = c.querySelector('.kl-card');
  card.querySelector('[data-x="back"]').addEventListener('click', showOnlineOptions);
  card.querySelectorAll('[data-i]').forEach(el=>{
    const g = games[+el.dataset.i]; const act = el.dataset.act;
    el.addEventListener('click', ()=>{
      if(act==='claim'){
        KO.claimTimeout(g.gameId, { onDone:()=>{ flashCard('🎉 Kazandın!', 'Rakibin süresi dolduğu için oyunu kazandın.'); }, onError:(m)=>flashCard('Olmadı', m) });
      } else {
        KO.resumeGame(g.gameId, {
          onError:(m)=>flashCard('Açılamadı', m),
          onResumed:({role,gameId,oppName,seed,room})=>startOnline(role,gameId,oppName,seed,{async:true,turnHours:room.turnHours,room})
        });
      }
    });
  });
}

function flashCard(title, msg){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>${title}</h3><p>${msg}</p><button class="kl-btn primary" data-x="back">Menüye Dön</button></div></div>`;
  c.querySelector('[data-x="back"]').addEventListener('click', showStart);
}

function esc(s){ return String(s||'').replace(/[<>&"]/g, m=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[m])); }
let _invOff = null;
function stopInviteListen(){ try{ if(_invOff) _invOff(); }catch(e){} _invOff=null; }

// ── ARKADAŞ / NİCK DAVETİ ──
async function showInviteScreen(){
  const c = G.root.querySelector('[data-el="content"]');
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>📨 Hazırlanıyor…</h3></div></div>`;
  try{ if(!KO) KO = await import('./kelime-online.js'); }
  catch(e){ flashCard('Çevrimiçi modül yüklenemedi','Bağlantını kontrol et.'); return; }
  let friends = []; try{ friends = await KO.listFriends(); }catch(e){}
  const friendsHtml = friends.length
    ? `<div style="margin-top:10px"><div style="font-size:12px;color:#bba8df;margin-bottom:5px">👥 Arkadaşların</div>${friends.map(f=>`<div class="kl-mode" data-fuid="${esc(f.uid)}" data-fname="${esc(f.name)}"><span class="e">🧑</span><div>${esc(f.name)}<small>Meydan oku</small></div></div>`).join('')}</div>`
    : '';
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card">
      <h3>📨 Arkadaşını Davet Et</h3>
      <p>Nick yaz, meydan oku — rakip kabul edince oyun başlar.</p>
      <div style="display:flex;gap:6px">
        <input data-el="nickin" placeholder="Rakip nick…" autocomplete="off" style="flex:1;min-width:0;padding:11px;border-radius:11px;border:1px solid rgba(200,170,255,.25);background:rgba(168,85,247,.1);color:#efe7ff;font-size:14px">
        <button class="kl-btn primary" style="flex:0 0 auto;width:auto;padding:11px 14px" data-x="send">Meydan Oku</button>
      </div>
      ${friendsHtml}
      <div data-el="invites" style="margin-top:12px"></div>
      <button class="kl-btn" style="margin-top:12px" data-x="back">← Geri</button>
    </div></div>`;
  const card = c.querySelector('.kl-card');
  card.querySelector('[data-x="back"]').addEventListener('click', ()=>{ stopInviteListen(); showStart(); });
  const sendBtn = card.querySelector('[data-x="send"]');
  sendBtn.addEventListener('click', async ()=>{
    const nick = card.querySelector('[data-el="nickin"]').value.trim();
    if(!nick) return;
    sendBtn.textContent='Aranıyor…';
    let u=null; try{ u = await KO.resolveNick(nick); }catch(e){}
    sendBtn.textContent='Meydan Oku';
    if(!u){ flashCard('Bulunamadı', `"${esc(nick)}" bulunamadı. Nick birebir doğru olmalı ve rakip en az bir kez giriş yapmış olmalı.`); return; }
    doSendInvite(u.uid, u.name);
  });
  card.querySelectorAll('[data-fuid]').forEach(el=>el.addEventListener('click', ()=>doSendInvite(el.dataset.fuid, el.dataset.fname)));
  stopInviteListen();
  _invOff = KO.listenInvites((list)=>{
    const box = card.querySelector('[data-el="invites"]'); if(!box) return;
    if(!list.length){ box.innerHTML = `<div style="font-size:12px;color:#8a7aae">📭 Bekleyen davet yok.</div>`; return; }
    box.innerHTML = `<div style="font-size:12px;color:#ffe08a;margin-bottom:5px">📥 Gelen davetler</div>` +
      list.map((inv,i)=>`<div class="kl-mode" data-acc="${i}"><span class="e">⚔️</span><div>${esc(inv.fromName||'Rakip')}<small>Seni Kelimecik'e çağırıyor · Kabul et</small></div></div>`).join('');
    box.querySelectorAll('[data-acc]').forEach(el=>{ const inv=list[+el.dataset.acc]; el.addEventListener('click', ()=>doAcceptInvite(inv)); });
  });
}

function doSendInvite(uid, name){
  const c = G.root.querySelector('[data-el="content"]');
  stopInviteListen();
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card">
    <h3>⚔️ ${esc(name)}</h3>
    <p>Davet gönderildi. Rakibin kabul etmesi bekleniyor…</p>
    <div style="margin:6px auto 14px;width:34px;height:34px;border:3px solid rgba(255,255,255,.2);border-top-color:#ffd86b;border-radius:50%;animation:klspin 1s linear infinite"></div>
    <button class="kl-btn warn" data-x="cancel">İptal</button></div></div>`;
  let cancelled=false;
  c.querySelector('[data-x="cancel"]').addEventListener('click', async ()=>{ cancelled=true; try{ await KO.cancelInvite(); }catch(e){} showInviteScreen(); });
  KO.sendInvite(uid, name, {
    onSent: ()=>{},
    onError: (msg)=>{ if(!cancelled) flashCard('Davet hatası', msg); },
    onAccepted: ({role,gameId,oppName,seed})=>{ if(!cancelled) startOnline(role,gameId,oppName,seed); }
  });
}
function doAcceptInvite(inv){
  const c = G.root.querySelector('[data-el="content"]');
  stopInviteListen();
  c.innerHTML = `<div class="kl-overlay" style="position:relative;background:transparent"><div class="kl-card"><h3>⚔️ Katılıyorsun…</h3><p>${esc(inv.fromName||'Rakip')} ile oyun başlıyor</p></div></div>`;
  KO.acceptInvite(inv, {
    onError: (msg)=>flashCard('Kabul hatası', msg),
    onMatched: ({role,gameId,oppName,seed})=>startOnline(role,gameId,oppName,seed)
  });
}

function startOnline(role, gameId, oppName, seed, opts){
  opts = opts || {};
  G.online = true; G.ai = null; G.seri = null; stopTurnTimer(); G.role = role; G.gameId = gameId; G.oppName = oppName; G._over = false; G.oppPresent = true;
  G.async = !!opts.async; G.turnHours = opts.turnHours || 0; G.deadline = opts.deadline || (opts.room && opts.room.deadline) || 0;
  G.bag = buildBagSeeded(seed);
  if(opts.room){
    // ── SÜRDÜRME: oda durumundan yükle ──
    const room = opts.room;
    let board; try{ board = JSON.parse(room.boardStr); }catch(e){ board = Array.from({length:SIZE}, ()=>Array(SIZE).fill(null)); }
    G.state = { board, scores: room.scores||{A:0,B:0}, turn: room.turn||'A', bagPointer: room.bagPointer!=null?room.bagPointer:14, passStreak: room.passStreak||0 };
    const myRack = room.racks && room.racks[role];
    G.rackView = Array.isArray(myRack)
      ? myRack.map(t=>({letter:t.letter,points:t.points,joker:t.joker}))
      : G.bag.slice(role==='A'?0:RACK_SIZE, (role==='A'?0:RACK_SIZE)+RACK_SIZE).map(t=>({letter:t.letter,points:t.points,joker:t.joker}));
  } else {
    const start = role === 'A' ? 0 : RACK_SIZE;     // A → [0..6], B → [7..13]
    G.rackView = G.bag.slice(start, start+RACK_SIZE).map(t=>({letter:t.letter, points:t.points, joker:t.joker}));
    G.state = { board: Array.from({length:SIZE}, ()=>Array(SIZE).fill(null)), scores:{A:0,B:0}, turn:'A', bagPointer:14, passStreak:0 };
    if(G.async && KO && KO.saveRack) KO.saveRack(G.rackView);   // sürdürme için rafımı kaydet
  }
  G.who = role;
  G.names = { A: role==='A'?'Sen':oppName, B: role==='B'?'Sen':oppName };
  G.pending = []; G.selected = null;
  G.surprises = buildSurprises(seed);     // seed'den aynı sürpriz kareler
  G.bestWord = { text:'', score:0, who:'' };
  G.lastMoveCells = new Set();
  G.myRecord = { best:{text:'',score:0}, longest:{text:'',len:0} };
  buildGameDOM();
  renderAll();
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(typeof window!=='undefined'){ window.__KL=()=>G; }
  if(KO) KO.subscribeRoom(applyRemote);
  if(!G.async){
    G._oppLastSeen = Date.now();          // başlangıçta rakip burada say
    if(KO && KO.heartbeat) KO.heartbeat();
    startOnlineHeartbeat();
  }
}

// Anlık oyun kalp atışı: kendi "buradayım"ımı yaz + rakip uzun sessizse bitir
function startOnlineHeartbeat(){
  stopOnlineHeartbeat();
  if(!G || !G.online || G.async) return;
  G._hb = setInterval(()=>{
    if(!G || !G.online || G._over){ stopOnlineHeartbeat(); return; }
    if(document.hidden) return;            // arka plandayken (donmuş) yazma
    if(KO && KO.heartbeat) KO.heartbeat();
    if(G._oppLastSeen && (Date.now() - G._oppLastSeen > 55000)){   // ~55 sn sessizlik → ayrıldı
      onlineGameOver('Rakip oyundan ayrıldı. Kazandın! 🎉');
    }
  }, 8000);
}
function stopOnlineHeartbeat(){ if(G && G._hb){ clearInterval(G._hb); G._hb = null; } }

function currentTurn(){ return G.online ? G.state.turn : G.who; }
function isMyTurn(){ return G.online ? (G.state.turn === G.role) : true; }

function applyRemote(room){
  if(!G || !G.online) return;
  let newCells = [];
  try{
    if(room.boardStr){
      const nb = JSON.parse(room.boardStr);
      for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ if(nb[r][c] && !(G.state.board[r] && G.state.board[r][c])) newCells.push({r,c}); }
      G.state.board = nb;
      recallConflictingPending();   // rakibin doldurduğu karelerdeki deneme taşlarımı rafa al
    }
  }catch(e){}
  if(newCells.length) setLastMove(newCells);
  if(room.scores) G.state.scores = room.scores;
  if(room.turn) G.state.turn = room.turn;
  if(room.bagPointer != null) G.state.bagPointer = room.bagPointer;
  G.state.passStreak = room.passStreak || 0;
  if(room.deadline != null) G.deadline = room.deadline;
  const oppRole = G.role==='A'?'B':'A';
  // Anlık oyunda rakibin "ayrıldı" kararı artık presence'a göre DEĞİL, lastSeen sessizliğine göre
  // (kısa kopmalar oyunu bitirmesin). Kalp atışı döngüsü sessizliği kontrol eder.
  if(!G.async && room.lastSeen && room.lastSeen[oppRole]){ G._oppLastSeen = room.lastSeen[oppRole]; }
  if(room.status === 'over' && !G._over){ onlineGameOver(room.overMsg || 'Oyun bitti', room.draw ? 'Berabere 🤝' : null); return; }
  handleDrawOffer(room);
  if(room.lastMove && room.lastMove.who && room.lastMove.who !== G.role && room.lastMove.ts !== G._lastSeenMove){
    G._lastSeenMove = room.lastMove.ts;
    const lm = room.lastMove;
    if(lm.pass){ flashStatus('Rakip pas geçti'); }
    else if(lm.exchange){ flashStatus('🔄 Rakip '+lm.exchange+' harf değiştirdi'); }
    else {
      // rakibin hamlesini kutla (görsel + ses)
      if(lm.score){ scorePopup('+'+lm.score); if(lm.bingo){ sndBingo(); confetti(); } else sndWord(lm.score); }
      if(lm.words && lm.words.length){ if(lm.words[0] && lm.words[0].score){ trackBest(lm.words, room.lastMove.who); } flashStatus('Rakip: '+lm.words.map(w=>w.text||w).join(', ')+' (+'+lm.score+')'); }
      if(lm.surp && lm.surp.length){ setTimeout(()=>{ surpriseStrip(lm.surp.map(l=>({icon:'🎁',label:l}))); sndSurprise(); }, 300); }
    }
  }
  renderAll();
}


// ── Oyun menüsü: pes etme / anlaşmalı beraberlik ────────────────
function openGameMenu(){
  if(!G || G._over) return;
  const c = G.root.querySelector('[data-el="content"]');
  if(c.querySelector('.kl-gamemenu')) return;
  const isOnline = !!G.online;
  const ov = document.createElement('div'); ov.className = 'kl-overlay kl-gamemenu';
  ov.innerHTML = `<div class="kl-card"><h3>🏳️ Oyun Seçenekleri</h3>
    <div class="kl-gm-list">
      ${isOnline ? '<button class="kl-btn warn" data-x="draw">🤝 Beraberlik Teklif Et<br><small style="font-weight:400;opacity:.75">İki taraf da ceza almadan biter</small></button>' : ''}
      <button class="kl-btn" style="border-color:#e0556b;color:#ff9aa8" data-x="resign">🏳️ Pes Et${isOnline?'<br><small style="font-weight:400;opacity:.75">Rakip kazanmış sayılır</small>':''}</button>
      <button class="kl-btn" data-x="close">Vazgeç</button>
    </div></div>`;
  c.appendChild(ov);
  ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('[data-x="close"]').addEventListener('click', ()=>ov.remove());
  ov.querySelector('[data-x="resign"]').addEventListener('click', ()=>{ ov.remove(); resignGame(); });
  const db_ = ov.querySelector('[data-x="draw"]');
  if(db_) db_.addEventListener('click', ()=>{ ov.remove(); offerDraw(); });
}

function resignGame(){
  if(!G || G._over) return;
  if(!confirm('Pes etmek istediğine emin misin?' + (G.online?' Rakip kazanmış sayılacak.':''))) return;
  if(G.online){
    try{ if(KO) KO.pushMove({ status:'over', overMsg:'Rakip pes etti 🏳️ — kazandın! 🎉', resignedBy:G.role, drawOffer:null }); }catch(e){}
    onlineGameOver('Pes ettin 🏳️', 'Kaybettin 😔');
  } else {
    G._resigned = true;
    endGameAI();
  }
}

function offerDraw(){
  if(!G || !G.online || G._over) return;
  if(G._myDrawOffer){ flashStatus('Teklifin zaten bekliyor…'); return; }
  G._myDrawOffer = true;
  try{ if(KO) KO.pushMove({ drawOffer: G.role }); }catch(e){}
  flashStatus('🤝 Beraberlik teklifi gönderildi — rakip bekleniyor');
}

function handleDrawOffer(room){
  if(!G || !G.online || G._over) return;
  const offer = room.drawOffer || null;
  // Benim teklifim reddedildi (alan silindi)
  if(G._myDrawOffer && !offer){ G._myDrawOffer = false; flashStatus('Rakip beraberlik teklifini reddetti'); return; }
  // Rakipten teklif geldi → sor
  if(offer && offer !== G.role && !G._drawPrompt){
    G._drawPrompt = true;
    const c = G.root.querySelector('[data-el="content"]');
    const ov = document.createElement('div'); ov.className = 'kl-overlay kl-gamemenu';
    ov.innerHTML = `<div class="kl-card"><h3>🤝 Beraberlik Teklifi</h3>
      <p>Rakip oyunu <b>anlaşmalı berabere</b> bitirmeyi öneriyor.<br><small style="opacity:.75">İki taraf da ceza puanı almadan biter.</small></p>
      <div class="kl-gm-list">
        <button class="kl-btn primary" data-x="acc">🤝 Kabul Et</button>
        <button class="kl-btn" data-x="dec">Reddet, devam</button>
      </div></div>`;
    c.appendChild(ov);
    ov.querySelector('[data-x="acc"]').addEventListener('click', ()=>{
      ov.remove(); G._drawPrompt = false;
      try{ if(KO) KO.pushMove({ status:'over', overMsg:'🤝 Anlaşmalı beraberlik', draw:true, drawOffer:null }); }catch(e){}
      onlineGameOver('🤝 Anlaşmalı beraberlik', 'Berabere 🤝');
    });
    ov.querySelector('[data-x="dec"]').addEventListener('click', ()=>{
      ov.remove(); G._drawPrompt = false;
      try{ if(KO) KO.pushMove({ drawOffer: null }); }catch(e){}
    });
  }
}

function onlineGameOver(msg, verdictOverride){
  if(G._over) return; G._over = true;
  if(G._oppGrace){ clearTimeout(G._oppGrace); G._oppGrace = null; }
  stopOnlineHeartbeat();
  try{ if(KO) KO.leaveRoom(); }catch(e){}
  const c = G.root.querySelector('[data-el="content"]');
  const mine = G.state.scores[G.role], opp = G.state.scores[G.role==='A'?'B':'A'];
  const verdict = verdictOverride || (mine===opp?'Berabere':(mine>opp?'Kazandın! 🎉':'Kaybettin 😔'));
  if(verdictOverride){ /* pes/anlaşma: skor sesi yerine nötr */ }
  else if(mine>opp){ sndWin(); confetti(); } else if(mine<opp){ sndLose(); }
  const stars = starsFor(mine);
  saveRecordsIfBetter();
  const bw = G.bestWord && G.bestWord.score ? `<p style="color:#c9b8e8;font-size:12px">🏆 En iyi kelime: <b>${G.bestWord.text}</b> (${G.bestWord.score} puan)</p>` : '';
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>🏁 Oyun Bitti</h3><p>${msg}</p>
    <div style="font-size:30px;letter-spacing:4px;color:#ffd86b;margin:2px 0 6px">${starStr(stars)}</div>
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
      <div class="kl-gem" title="Kelimecik"></div>
      <div class="kl-score" data-el="scoreB"><div class="nm" data-el="nameB">Oyuncu 2</div><div class="pt" data-el="ptB">0</div></div>
    </div>
    <div class="kl-starbar" data-el="starbar" title="Performans yıldızların"><span data-el="stars">★☆☆</span></div>
    <button class="kl-flagbtn" data-act="gamemenu" title="Oyun seçenekleri">🏳️</button>
    <div class="kl-timerbar" data-el="timerbar"><div class="kl-timerfill" data-el="timerfill"></div></div>
    <div class="kl-status" data-el="status"></div>
    <div class="kl-zoomdock" data-el="zoomdock"><button class="kl-zbtn" data-act="zin" title="Yakınlaştır">🔎</button><button class="kl-zbtn" data-act="zout" title="Uzaklaştır">🔭</button></div>
    <span class="kl-ztip" data-el="ztip"></span>
    <div class="kl-boardwrap"><div class="kl-board" data-el="board">${cells}</div></div>
    <div class="kl-rackwrap">
      <div class="kl-rack" data-el="rack"></div>
      <button class="kl-shuffle" data-act="shuffle" title="Karıştır">🔀</button>
    </div>
    <div class="kl-actions">
      <button class="kl-btn" data-act="recall">↩︎ Geri Al</button>
      <button class="kl-btn warn" data-act="exchange">🔄 Harf Değiş</button>
      <button class="kl-btn warn" data-act="pass">⏭️ Geç</button>
      <button class="kl-btn primary" data-act="submit">✓ Onayla</button>
    </div>`;
  // tahta hücre tıklama
  c.querySelector('[data-el="board"]').addEventListener('click', (e)=>{
    const cell = e.target.closest('.kl-cell'); if(!cell) return;
    onCellTap(+cell.dataset.r, +cell.dataset.c);
  });
  c.querySelector('[data-act="recall"]').addEventListener('click', recallAll);
  c.querySelector('[data-act="exchange"]').addEventListener('click', toggleExchangeMode);
  c.querySelector('[data-act="pass"]').addEventListener('click', passTurn);
  c.querySelector('[data-act="submit"]').addEventListener('click', submitMove);
  c.querySelector('[data-act="shuffle"]').addEventListener('click', shuffleRack);
  c.querySelector('[data-act="gamemenu"]').addEventListener('click', openGameMenu);
  bindZoomDock();
  bindBoardDoubleTap();
  applyZoom();
}

// Zoom sesi (içeri/dışarı süpürme)
function sndZoom(zin){
  if(!G || !G.sound) return;
  if(zin){ tone(420,0.06,'sine',0.06); setTimeout(()=>tone(760,0.09,'sine',0.06),55); }
  else { tone(760,0.06,'sine',0.06); setTimeout(()=>tone(420,0.09,'sine',0.06),55); }
}

// Büyüteç/teleskop dock'u: iki simge yan yana, ekranda her yere sürüklenip park edilebilir, dokun=zoom
function bindZoomDock(){
  const dock = G.root.querySelector('[data-el="zoomdock"]');
  if(!dock) return;
  // varsayılan konum: tahtanın hemen üstü (yoksa) — yan yana
  if(G.zoomPos){ placeDock(dock, G.zoomPos.left, G.zoomPos.top); }
  else { requestAnimationFrame(()=>defaultDockPos(dock)); }
  let sx=0, sy=0, dx0=0, dy0=0, moved=false, dragging=false, startBtn=null;
  dock.addEventListener('pointerdown', e=>{
    e.preventDefault();
    dragging=true; moved=false;
    startBtn = e.target.closest('.kl-zbtn');
    const r=dock.getBoundingClientRect();
    sx=e.clientX; sy=e.clientY; dx0=r.left; dy0=r.top;
    try{ dock.setPointerCapture(e.pointerId); }catch(_){}
    if(startBtn) showZTip(startBtn);
  });
  dock.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const mx=e.clientX-sx, my=e.clientY-sy;
    if(Math.abs(mx)+Math.abs(my)>6){ moved=true; hideZTip(); }
    if(moved){
      const nl=Math.max(2,Math.min(window.innerWidth-dock.offsetWidth-2, dx0+mx));
      const nt=Math.max(2,Math.min(window.innerHeight-dock.offsetHeight-2, dy0+my));
      placeDock(dock, nl, nt);
    }
  });
  const end = e=>{
    if(!dragging) return; dragging=false;
    try{ dock.releasePointerCapture(e.pointerId); }catch(_){}
    if(moved){ const r=dock.getBoundingClientRect(); G.zoomPos={ left:r.left, top:r.top }; }
    else if(startBtn){ doZoom(startBtn.dataset.act === 'zin'); }   // dokunma → o simgenin zoom'u
    setTimeout(hideZTip, 700);
    startBtn=null;
  };
  dock.addEventListener('pointerup', end);
  dock.addEventListener('pointercancel', end);
  dock.querySelectorAll('.kl-zbtn').forEach(btn=>{
    btn.addEventListener('pointerenter', ()=>{ if(!dragging) showZTip(btn); });
    btn.addEventListener('pointerleave', ()=>{ if(!dragging) hideZTip(); });
  });
}
function placeDock(dock, left, top){ dock.style.left=left+'px'; dock.style.top=top+'px'; }
function defaultDockPos(dock){
  const board = G.root.querySelector('[data-el="board"]');
  if(!board){ placeDock(dock, window.innerWidth-90, 120); return; }
  const r = board.getBoundingClientRect();
  const left = r.left + r.width - dock.offsetWidth - 4;
  const top  = Math.max(4, r.top - dock.offsetHeight - 10);   // tahtanın üstünün biraz daha üstü
  placeDock(dock, left, top);
}
function showZTip(btn){
  const tip = G.root.querySelector('[data-el="ztip"]'); if(!tip || !btn) return;
  tip.textContent = btn.dataset.act === 'zin' ? 'Yakınlaştır' : 'Uzaklaştır';
  tip.classList.add('show');
  const r = btn.getBoundingClientRect();
  const tw = tip.offsetWidth || 90;
  let left = r.left + r.width/2 - tw/2;
  left = Math.max(4, Math.min(window.innerWidth - tw - 4, left));
  tip.style.left = left+'px';
  tip.style.top = Math.max(4, r.top - (tip.offsetHeight||26) - 6)+'px';   // simgenin üstünde
}
function hideZTip(){ const tip = G && G.root && G.root.querySelector('[data-el="ztip"]'); if(tip) tip.classList.remove('show'); }

// Tahtaya çift dokunma → zoom aç/kapa
function bindBoardDoubleTap(){
  const board = G.root.querySelector('[data-el="board"]');
  if(!board) return;
  let lt=0, lx=0, ly=0;
  board.addEventListener('pointerup', e=>{
    if(G.selected != null) return;
    const now=Date.now();
    if(now-lt < 320 && Math.abs(e.clientX-lx)<30 && Math.abs(e.clientY-ly)<30){ doZoom(G.zoom!=='large'); lt=0; }
    else { lt=now; lx=e.clientX; ly=e.clientY; }
  });
}

function doZoom(zin){
  const target = zin ? 'large' : 'fit';
  if(G.zoom === target) return;
  G.zoom = target;
  sndZoom(zin);
  applyZoom();
  if(zin){
    const wrap = G.root.querySelector('.kl-boardwrap'), board = G.root.querySelector('[data-el="board"]');
    setTimeout(()=>{ if(wrap&&board){ wrap.scrollLeft=(board.offsetWidth-wrap.clientWidth)/2; wrap.scrollTop=(board.offsetHeight-wrap.clientHeight)/2; } }, 30);
  }
}
function applyZoom(){
  const board = G.root.querySelector('[data-el="board"]');
  const wrap = G.root.querySelector('.kl-boardwrap');
  if(!board || !wrap) return;
  const large = G.zoom === 'large';
  board.classList.toggle('large', large); wrap.classList.toggle('large-scroll', large);
  const zin = G.root.querySelector('[data-act="zin"]'), zout = G.root.querySelector('[data-act="zout"]');
  if(zin) zin.classList.toggle('active', large);
  if(zout) zout.classList.toggle('active', !large);
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
  if(!G.state || !G.names || !q('[data-el="nameA"]')) return;   // menü/geçiş anında çağrılırsa çök
  q('[data-el="nameA"]').textContent = G.names.A;
  q('[data-el="nameB"]').textContent = G.names.B;
  q('[data-el="ptA"]').textContent = G.state.scores.A;
  q('[data-el="ptB"]').textContent = G.state.scores.B;
  const ct = currentTurn();
  q('[data-el="scoreA"]').classList.toggle('active', ct==='A');
  q('[data-el="scoreB"]').classList.toggle('active', ct==='B');
  const starEl = q('[data-el="stars"]');
  if(starEl){
    let myScore;
    if(G.online) myScore = G.state.scores[G.role] || 0;
    else if(G.ai || G.seri) myScore = G.state.scores.A;
    else myScore = Math.max(G.state.scores.A, G.state.scores.B);
    starEl.textContent = starStr(starsFor(myScore));
  }
  if(G.online){
    const remain = Math.max(0, 100 - (G.state.bagPointer||0));
    let dl = '';
    if(G.async && G.deadline){
      const left = G.deadline - Date.now();
      dl = isMyTurn()
        ? ` &nbsp; <span style="color:#ffd86b">⏳ ${left>0?fmtRemain(left)+' içinde oyna':'süren doldu!'}</span>`
        : ` &nbsp; <span style="color:#bba8df">⏳ rakip: ${left>0?fmtRemain(left):'doldu'}</span>`;
    }
    const pill = isMyTurn() ? `<span class="kl-turn me">▶ Senin sıran</span>` : `<span class="kl-turn opp">${G.oppName} oynuyor…</span>`;
    q('[data-el="status"]').innerHTML = `${pill} &nbsp; Torbada ~${remain}${dl}`;
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
      const letter = t.joker ? (t.assigned || t.letter || '') : t.letter;
      const pts = t.joker ? 0 : (t.points!=null?t.points:letterPoints(t.letter));
      const div = document.createElement('div');
      const isLast = !pend && G.lastMoveCells && G.lastMoveCells.has(r+','+cc);
      div.className = 'kl-tile'+(pend?' pending':'')+(t.joker?' joker':'')+(isLast?' lastmove':'');
      div.innerHTML = `<span class="l">${letter}</span><span class="p">${pts}</span>`;
      if(pend){ div.style.touchAction='none'; div.addEventListener('pointerdown', (ev)=>onPendingPointerDown(ev, r, cc)); }
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
    const swapSel = G.exchangeMode && G.exchangeSel && G.exchangeSel.has(i);
    d.className = 'kl-rtile'+(t.joker?' joker':'')+(!G.exchangeMode && G.selected===i?' sel':'')+(swapSel?' swap':'');
    d.innerHTML = t.joker ? `<span>★</span>` : `<span>${t.letter}</span><span class="p">${t.points}</span>`;
    d.addEventListener('pointerdown', (e)=> onRackPointerDown(e, i, t));
    rack.appendChild(d);
  });
  // boş yuvaları doldur (görsel hizalama)
  for(let i=G.rackView.length;i<RACK_SIZE;i++){
    const d=document.createElement('div'); d.className='kl-rtile empty'; rack.appendChild(d);
  }
}

// ── Sürükle-bırak (pointer) + dokunma seçimi ──
let _drag = null;
function canPlayNow(){
  if(G.online && !isMyTurn()) return false;
  if(G.ai && (G.aiThinking || G.who!=='A')) return false;
  return true;
}
function rackTileEl(i){ const rack=G.root.querySelector('[data-el="rack"]'); return rack ? rack.querySelectorAll('.kl-rtile:not(.empty)')[i] : null; }
function onRackPointerDown(e, i, tile){
  if(e.button!=null && e.button!==0) return;
  _drag = { i, tile, x0:e.clientX, y0:e.clientY, moved:false, ghost:null };
  window.addEventListener('pointermove', onRackPointerMove);
  window.addEventListener('pointerup', onRackPointerUp);
  window.addEventListener('pointercancel', onRackPointerUp);
}
function onRackPointerMove(e){
  if(!_drag) return;
  const dx=e.clientX-_drag.x0, dy=e.clientY-_drag.y0;
  if(!_drag.moved){
    if(Math.hypot(dx,dy) < 8) return;
    if(G.exchangeMode || G._over) return;   // değişim modunda / oyun bitince sürükleme yok (sıra fark etmez)
    _drag.moved = true;
    const g = document.createElement('div'); g.className='kl-drag-ghost';
    g.textContent = _drag.tile.joker ? '★' : _drag.tile.letter;
    G.root.appendChild(g); _drag.ghost = g;
    const el = rackTileEl(_drag.i); if(el) el.classList.add('dragging');
  }
  if(!_drag.moved) return;
  e.preventDefault();
  if(_drag.ghost){ _drag.ghost.style.left=e.clientX+'px'; _drag.ghost.style.top=e.clientY+'px'; }
  highlightDrop(e.clientX, e.clientY);
}
function onRackPointerUp(e){
  window.removeEventListener('pointermove', onRackPointerMove);
  window.removeEventListener('pointerup', onRackPointerUp);
  window.removeEventListener('pointercancel', onRackPointerUp);
  const d = _drag; _drag = null;
  if(!d) return;
  if(d.ghost) d.ghost.remove();
  clearDropHighlight();
  const el = rackTileEl(d.i); if(el) el.classList.remove('dragging');
  if(d.moved){
    const cell = cellUnder(e.clientX, e.clientY);
    if(cell) dropTileOnCell(d.i, +cell.dataset.r, +cell.dataset.c);
  } else {
    // dokunma = seç / değişim seçimi
    if(G.exchangeMode){
      if(G.exchangeSel.has(d.i)) G.exchangeSel.delete(d.i); else G.exchangeSel.add(d.i);
      updateExchangeBtn(); renderRack();
    } else {
      G.selected = (G.selected===d.i ? null : d.i); renderRack();
    }
  }
}
function cellUnder(x,y){
  const el = document.elementFromPoint(x,y); if(!el || !el.closest) return null;
  const cell = el.closest('.kl-cell');
  if(!cell || !G.root.contains(cell)) return null;
  const r=+cell.dataset.r, c=+cell.dataset.c;
  if(G.state.board[r][c]) return null;
  if(G.pending.find(p=>p.r===r&&p.c===c)) return null;
  return cell;
}
let _dropHL = null;
function highlightDrop(x,y){
  const cell = cellUnder(x,y);
  if(_dropHL && _dropHL!==cell) _dropHL.classList.remove('drop-target');
  if(cell){ cell.classList.add('drop-target'); _dropHL=cell; } else _dropHL=null;
}
function clearDropHighlight(){ if(_dropHL){ _dropHL.classList.remove('drop-target'); _dropHL=null; } if(G&&G.root) G.root.querySelectorAll('.kl-cell.drop-target').forEach(c=>c.classList.remove('drop-target')); }
function dropTileOnCell(i, r, c){
  if(G.state.board[r][c]) return;
  if(G.pending.find(p=>p.r===r&&p.c===c)) return;
  G.selected = i;
  onCellTap(r, c);   // yerleştirme + joker mantığı
}
function updateExchangeBtn(){
  const b = G.root.querySelector('[data-act="exchange"]'); if(!b) return;
  if(G.exchangeMode){ const n=G.exchangeSel?G.exchangeSel.size:0; b.textContent = n ? `✓ Değiştir (${n})` : '✓ Onayla'; }
  else b.textContent = '🔄 Harf Değiş';
}

function onCellTap(r, c){
  if(G._suppressNextCellTap){ G._suppressNextCellTap=false; return; }   // pending sürükleme tıklamayı yutar
  if(G._over) return;
  // Sıra sende olmasa da deneme amaçlı yerleştirebilirsin (onayla sıraya bağlı)
  // doluysa (kalıcı) — kelime anlamını göster
  if(G.state.board[r][c]){ showWordMeaning(r, c); return; }
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

// ── Konan (pending) taşı sürükle: başka boş kareye taşı veya rafa geri al ──
let _pdrag = null;
function rawCellUnder(x,y){
  const el = document.elementFromPoint(x,y); if(!el || !el.closest) return null;
  const cell = el.closest('.kl-cell'); if(!cell || !G.root.contains(cell)) return null;
  return { r:+cell.dataset.r, c:+cell.dataset.c };
}
function onPendingPointerDown(e, r, c){
  if(e.button!=null && e.button!==0) return;
  if(G._over) return;   // sıra fark etmez; sadece oyun bitince taşıma yok
  e.stopPropagation();
  _pdrag = { r, c, x0:e.clientX, y0:e.clientY, moved:false, ghost:null };
  window.addEventListener('pointermove', onPendingPointerMove);
  window.addEventListener('pointerup', onPendingPointerUp);
  window.addEventListener('pointercancel', onPendingPointerUp);
}
function onPendingPointerMove(e){
  if(!_pdrag) return;
  const dx=e.clientX-_pdrag.x0, dy=e.clientY-_pdrag.y0;
  if(!_pdrag.moved){
    if(Math.hypot(dx,dy) < 8) return;
    _pdrag.moved = true;
    const p = G.pending.find(x=>x.r===_pdrag.r && x.c===_pdrag.c);
    const g = document.createElement('div'); g.className='kl-drag-ghost';
    g.textContent = p ? (p.joker ? (p.assigned||'★') : p.letter) : '';
    G.root.appendChild(g); _pdrag.ghost = g;
    const tEl = G.root.querySelector(`.kl-cell[data-r="${_pdrag.r}"][data-c="${_pdrag.c}"] .kl-tile`);
    if(tEl) tEl.style.opacity='0.3';
  }
  if(!_pdrag.moved) return;
  e.preventDefault();
  if(_pdrag.ghost){ _pdrag.ghost.style.left=e.clientX+'px'; _pdrag.ghost.style.top=e.clientY+'px'; }
  highlightDrop(e.clientX, e.clientY);
}
function onPendingPointerUp(e){
  window.removeEventListener('pointermove', onPendingPointerMove);
  window.removeEventListener('pointerup', onPendingPointerUp);
  window.removeEventListener('pointercancel', onPendingPointerUp);
  const d = _pdrag; _pdrag = null;
  if(!d) return;
  if(d.ghost) d.ghost.remove();
  clearDropHighlight();
  G._suppressNextCellTap = true; setTimeout(()=>{ G._suppressNextCellTap=false; }, 400);
  const idx = G.pending.findIndex(p=>p.r===d.r && p.c===d.c);
  if(idx<0){ renderAll(); return; }
  if(d.moved){
    const rc = rawCellUnder(e.clientX, e.clientY);
    if(rc && rc.r===d.r && rc.c===d.c){ /* aynı yer → bırak */ }
    else if(rc && !G.state.board[rc.r][rc.c] && !G.pending.some((p,k)=>k!==idx && p.r===rc.r && p.c===rc.c)){
      G.pending[idx].r = rc.r; G.pending[idx].c = rc.c; sndPlace(); haptic(10);   // başka kareye taşındı
    } else {
      const p = G.pending.splice(idx,1)[0]; G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker }); sndPick();   // geçersiz hedef → rafa
    }
  } else {
    const p = G.pending.splice(idx,1)[0]; G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker }); sndPick();   // dokunma → rafa (tek tek)
  }
  G.selected=null; renderAll();
}

function placeTile(r,c,tileData){
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
  if(G.exchangeMode){ exitExchangeMode(); flashStatus('Değişim iptal edildi'); return; }
  for(const p of G.pending) G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker });
  G.pending=[]; G.selected=null; sndPick(); renderAll();
}

function shuffleRack(){
  if(G.exchangeMode) return;   // değişim modunda seçim bozulmasın
  // Karıştırma yalnız kendi rafını görsel diziler — sıra kimde olursa olsun yapılabilir
  if(!G.rackView || !G.rackView.length) return;
  for(let i=G.rackView.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [G.rackView[i],G.rackView[j]]=[G.rackView[j],G.rackView[i]]; }
  G.selected=null; sndPick(); haptic(10); renderRack();
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
function setLastMove(cells){ G.lastMoveCells = new Set(cells.map(p=>p.r+','+p.c)); }
// Rakip/AI bir kareyi doldurduysa, oradaki deneme (pending) taşımı rafa geri al
function recallConflictingPending(){
  if(!G.pending || !G.pending.length) return;
  const keep = [];
  for(const p of G.pending){
    if(G.state.board[p.r] && G.state.board[p.r][p.c]){ G.rackView.push({ letter:p.letter, points:p.points, joker:p.joker }); }
    else keep.push(p);
  }
  if(keep.length !== G.pending.length){ G.pending = keep; G.selected = null; }
}
// Cihaz sahibinin kişisel rekorları (en uzun + en yüksek kelime)
function trackRecords(words){
  if(!G.myRecord) G.myRecord = { best:{text:'',score:0}, longest:{text:'',len:0} };
  for(const w of words){
    if(w.score > G.myRecord.best.score) G.myRecord.best = { text:w.text, score:w.score };
    const len = (w.text||'').replace(/\\s/g,'').length;
    if(len > G.myRecord.longest.len) G.myRecord.longest = { text:w.text, len };
  }
}
// Oyun sonunda rekorları profile kaydet (giriş yapılmışsa, daha iyiyse)
async function saveRecordsIfBetter(){
  try{
    const A = (window.Hero && window.Hero.Auth) ? window.Hero.Auth.getState() : null;
    if(!A || !A.uid || !G.myRecord) return;
    const prev = (A.profile && A.profile.kelimeRecords) || {};
    const upd = {};
    if(G.myRecord.best.score > (prev.bestScore||0)){ upd.bestWord = G.myRecord.best.text; upd.bestScore = G.myRecord.best.score; }
    if(G.myRecord.longest.len > (prev.longestLen||0)){ upd.longestWord = G.myRecord.longest.text; upd.longestLen = G.myRecord.longest.len; }
    if(!Object.keys(upd).length) return;
    if(!KO) KO = await import('./kelime-online.js');
    if(KO.saveKelimeRecords){ await KO.saveKelimeRecords(upd); if(A.profile){ A.profile.kelimeRecords = Object.assign({}, prev, upd); } }
  }catch(e){}
}
// Oyuncunun toplam puanına göre yıldız (1–3)
function starsFor(score){ return score>=220 ? 3 : score>=110 ? 2 : 1; }
function starStr(n){ return '★★★'.slice(0,n) + '☆☆☆'.slice(0,3-n); }

// ── TDK kelime anlamı ──
const _tdkCache = {};
async function fetchTDK(word){
  const w = String(word||'').trim();
  if(!w) return null;
  if(_tdkCache[w] !== undefined) return _tdkCache[w];
  try{
    const res = await fetch('https://sozluk.gov.tr/gts?ara=' + encodeURIComponent(w.toLocaleLowerCase('tr')));
    const txt = await res.text();
    const data = JSON.parse(txt.trim());
    if(Array.isArray(data) && data[0] && data[0].anlamlarListe){
      const anlam = data[0].anlamlarListe.map(a=>a.anlam).filter(Boolean);
      _tdkCache[w] = anlam.length ? anlam : null;
    } else { _tdkCache[w] = null; }
  }catch(e){ _tdkCache[w] = undefined; return undefined; }   // undefined = ağ hatası (tekrar denenebilir)
  return _tdkCache[w];
}
// Bir hücredeki taştan geçen yatay+dikey kelimeleri çöz
function wordsThrough(r, c){
  const B = G.state.board; if(!B[r][c]) return [];
  const read=(dr,dc)=>{
    let sr=r, sc=c;
    while(sr-dr>=0 && sc-dc>=0 && B[sr-dr][sc-dc]){ sr-=dr; sc-=dc; }
    let s=''; let rr=sr, cc=sc;
    while(rr<SIZE && cc<SIZE && B[rr][cc]){ const t=B[rr][cc]; s += (t.joker ? (t.assigned || t.letter || '?') : t.letter); rr+=dr; cc+=dc; }
    return s;
  };
  const out=[]; const h=read(0,1), v=read(1,0);
  if(h.length>=2) out.push(h);
  if(v.length>=2) out.push(v);
  return out;
}
function showWordMeaning(r, c){
  const words = wordsThrough(r, c);
  if(!words.length) return;
  const cEl = G.root.querySelector('[data-el="content"]');
  const ov = document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML = `<div class="kl-card"><h3>📖 ${esc(words[0])}</h3>
    <div data-el="mbody" style="font-size:13px;color:#d9caf2;line-height:1.5;text-align:left;max-height:46vh;overflow:auto">Anlam yükleniyor…</div>
    ${words.length>1?`<p style="font-size:11px;color:#bba8df;margin-top:8px">Diğer kelime: ${esc(words[1])}</p>`:''}
    <button class="kl-btn primary" style="margin-top:14px" data-x="ok">Kapat</button></div>`;
  cEl.appendChild(ov);
  ov.querySelector('[data-x="ok"]').addEventListener('click', ()=>ov.remove());
  const body = ov.querySelector('[data-el="mbody"]');
  fetchTDK(words[0]).then(an=>{
    if(an === undefined){ body.textContent='Anlam alınamadı (bağlantı). Tekrar dene.'; return; }
    if(!an){ body.innerHTML = `<span style="color:#bba8df">TDK sözlüğünde anlam bulunamadı.</span>`; return; }
    body.innerHTML = an.map((a,i)=>`<div style="padding:3px 0"><b style="color:#ffe08a">${i+1}.</b> ${esc(a)}</div>`).join('');
  });
}

// ── Harf tablosu (torbada/görünmeyen kalan harfler) ──
function showLetterTable(){
  if(!G || !G.state) return;
  const total = {}; for(const L in LETTERS) total[L] = LETTERS[L].n;
  const used = {};
  const bump=(L)=>{ if(L) used[L]=(used[L]||0)+1; };
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ const t=G.state.board[r][c]; if(t && !t.joker) bump(t.letter); }
  for(const t of G.rackView){ if(t && !t.joker) bump(t.letter); }
  for(const p of G.pending){ if(p && !p.joker) bump(p.letter); }
  const cEl = G.root.querySelector('[data-el="content"]');
  const ov = document.createElement('div'); ov.className='kl-overlay';
  const cells = Object.keys(total).map(L=>{
    const rem = Math.max(0, total[L] - (used[L]||0));
    return `<div class="kl-lt${rem===0?' zero':''}"><div class="ltl">${L}</div><div class="ltn">${rem}/${total[L]}</div><div class="ltp">${LETTERS[L].p}p</div></div>`;
  }).join('');
  let boardJokers = 0;
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){ if(G.state.board[r][c] && G.state.board[r][c].joker) boardJokers++; }
  const jokerRem = Math.max(0, JOKER_COUNT - boardJokers - G.rackView.filter(t=>t.joker).length - G.pending.filter(p=>p.joker).length);
  ov.innerHTML = `<div class="kl-card" style="max-width:360px"><h3>📊 Harf Tablosu</h3>
    <p style="font-size:11px;color:#bba8df">Henüz görünmeyen (torbada + rakipte olabilecek) harf sayısı</p>
    <div class="kl-lt-grid">${cells}<div class="kl-lt"><div class="ltl">★</div><div class="ltn">${jokerRem}/${JOKER_COUNT}</div><div class="ltp">joker</div></div></div>
    <button class="kl-btn primary" style="margin-top:14px" data-x="ok">Kapat</button></div>`;
  cEl.appendChild(ov);
  ov.querySelector('[data-x="ok"]').addEventListener('click', ()=>ov.remove());
}
function celebrate(moveScore, bingo, hits){
  scorePopup('+'+moveScore);
  haptic(bingo ? [30,40,30,40,70] : 20);
  if(bingo){ sndBingo(); confetti(); }
  else { sndWord(moveScore); if(moveScore>=40) confetti(); }
  if(hits && hits.length){ setTimeout(()=>{ surpriseStrip(hits); sndSurprise(); haptic([20,30,40]); }, 320); }
}

function submitMove(){
  if(G.online && !isMyTurn()){ sndErr(); flashStatus('⏳ Sıra sende değil — deneyebilirsin ama sıran gelince onayla'); return; }
  if(G.ai && (G.aiThinking || G.who!=='A')){ sndErr(); flashStatus('⏳ Yapay zekâ oynuyor — sıran gelince onayla'); return; }
  const res = validatePlacement(G.state.board, G.pending);
  if(!res.ok){ sndErr(); haptic(60); flashStatus('✗ '+res.error); return; }
  const surp = applySurprises(G.pending);
  const moveScore = res.score * surp.doubleMul + surp.extraPoints;
  const who = currentTurn();
  commitMove(G.state, G.pending, moveScore, who);
  trackBest(res.words, who);
  trackRecords(res.words);          // cihaz sahibinin kişisel rekorları
  setLastMove(G.pending);           // son kelime renklendirme
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
    if(G.async) patch['racks/'+G.role] = G.rackView;   // sürdürme için rafımı kaydet
    G.pending=[]; G.selected=null;
    if(KO) KO.pushMove(patch);
    renderAll();
    return;
  }
  // insan hamlesi bitti
  G.state.racks[who] = G.rackView.concat(drawFromBag(G.state.bag, need));
  G.rackView = G.state.racks.A;     // AI modunda insanın rafı = A
  G.pending=[]; G.selected=null;
  G.state.passStreak = 0;
  renderAll();
  if(G.ai){
    if(checkGameOver()) return;
    stopTurnTimer();
    G.who = 'B'; G.aiThinking = true; renderScores();
    flashStatus('🤖 Yapay zekâ düşünüyor…');
    saveKelimeResume();
    setTimeout(aiTurn, 850);
  } else {
    nextTurn();   // 2 oyuncu: sıra geçişi ekranı
  }
}

// ── Süreli Seri mod sayacı ──
function startTurnTimer(){
  stopTurnTimer();
  if(!G || !G.seri || G._over) return;
  G.timeLeft = G.seri.turnTime;
  updateTimerUI();
  G.timer = setInterval(()=>{
    if(!G || !G.seri){ stopTurnTimer(); return; }
    G.timeLeft--;
    if(G.who==='A' && !G.aiThinking && G.timeLeft>0 && G.timeLeft<=5) tone(940,0.05,'square',0.05);
    updateTimerUI();
    if(G.timeLeft<=0){ stopTurnTimer(); onTimeUp(); }
  }, 1000);
}
function stopTurnTimer(){
  if(G && G.timer){ clearInterval(G.timer); G.timer=null; }
  const bar = G && G.root && G.root.querySelector('[data-el="timerbar"]'); if(bar) bar.classList.remove('on');
}
function updateTimerUI(){
  if(!G || !G.root) return;
  const bar = G.root.querySelector('[data-el="timerbar"]'), fill = G.root.querySelector('[data-el="timerfill"]');
  if(!bar || !fill) return;
  if(!G.seri || G.who!=='A' || G.aiThinking){ bar.classList.remove('on'); return; }
  bar.classList.add('on');
  fill.style.width = Math.max(0,(G.timeLeft/G.seri.turnTime)*100)+'%';
  fill.classList.toggle('low', G.timeLeft<=5);
}
function onTimeUp(){
  if(!G || !G.seri || G.who!=='A' || G._over) return;
  sndErr(); flashStatus('⏱️ Süre doldu — pas!');
  if(G.exchangeMode) exitExchangeMode();
  if(G.pending.length){
    const res = validatePlacement(G.state.board, G.pending);
    if(res.ok){ submitMove(); return; }   // geçerli yerleşim → otomatik onayla
    recallAll();                           // değilse taşları rafa geri al
  }
  passTurn();                              // pas → AI oynar → sayaç yeniden başlar
}

// Yapay zekânın hamlesi
function aiTurn(){
  if(typeof window!=='undefined'){ window.__aiCalls=(window.__aiCalls||0)+1; }
  if(!G.ai || G._over) return;
  let mv = null;
  try{ mv = KA.findBestMove(G.state.board, G.state.racks.B, G.ai.difficulty); }catch(e){ mv = null; }
  if(mv && mv.pending && mv.pending.length){
    const surp = applySurprises(mv.pending);
    const moveScore = mv.score * surp.doubleMul + surp.extraPoints;
    commitMove(G.state, mv.pending, moveScore, 'B');
    trackBest(mv.words, 'B');
    setLastMove(mv.pending);          // AI'ın son kelimesini renklendir
    recallConflictingPending();       // AI'ın koyduğu karedeki deneme taşlarımı rafa al
    // KRİTİK: AI'ın oynadığı taşları rafından DÜŞ (yoksa raf hiç azalmaz,
    // torba donar ve AI sınırsız taşla oynar — "tahta kendi kendine doldu" bug'ı)
    for(const p of mv.pending){
      const i = G.state.racks.B.findIndex(t => p.joker ? t.joker : (!t.joker && t.letter === p.letter));
      if(i >= 0) G.state.racks.B.splice(i, 1);
    }
    // AI rafını doldur
    const need = RACK_SIZE - G.state.racks.B.length;
    G.state.racks.B = G.state.racks.B.concat(drawFromBag(G.state.bag, need));
    G.state.passStreak = 0;
    G.who = 'A'; G.aiThinking = false;
    G.rackView = G.state.racks.A;
    renderAll();
    celebrate(moveScore, !!(mv.words && mv.pending.length===RACK_SIZE), surp.hits);
    flashStatus('🤖 ' + mv.words.map(w=>w.text).join(', ') + ' (+' + moveScore + ')');
    setTimeout(()=>{ if(!checkGameOver() && G.seri) startTurnTimer(); }, 400);
    saveKelimeResume();
  } else {
    // AI hamle bulamadı → pas
    G.state.passStreak = (G.state.passStreak||0) + 1;
    G.who = 'A'; G.aiThinking = false;
    G.rackView = G.state.racks.A;
    renderAll();
    flashStatus('🤖 Yapay zekâ pas geçti');
    if(!checkGameOver() && G.seri) startTurnTimer();
    saveKelimeResume();
  }
}

// AI modunda oyun sonu kontrolü
function checkGameOver(){
  if(!G.ai) return false;
  const bagEmpty = G.state.bag.length === 0;
  const someoneOut = G.state.racks.A.length === 0 || G.state.racks.B.length === 0;
  if((bagEmpty && someoneOut) || (G.state.passStreak||0) >= 4){
    endGameAI();
    return true;
  }
  return false;
}

function endGameAI(){
  if(G._over) return; G._over = true;
  stopTurnTimer();
  Resume.clearSnapshot('kelime');
  const c = G.root.querySelector('[data-el="content"]');
  const a=G.state.scores.A, b=G.state.scores.B;
  const verdict = G._resigned ? 'Pes ettin 🏳️' : (a===b ? 'Berabere!' : (a>b ? 'Kazandın! 🎉' : 'Yapay zekâ kazandı 🤖'));
  if(G._resigned){ /* pes: kutlama yok */ } else if(a>b){ sndWin(); confetti(); } else if(a<b){ sndLose(); }
  const stars = starsFor(a);
  saveRecordsIfBetter();
  const bw = G.bestWord && G.bestWord.score ? `<p style="color:#c9b8e8;font-size:12px">🏆 En iyi kelime: <b>${G.bestWord.text}</b> (${G.bestWord.score} puan)</p>` : '';
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>🏁 Oyun Bitti</h3>
    <div style="font-size:30px;letter-spacing:4px;color:#ffd86b;margin:2px 0 6px">${starStr(stars)}</div>
    <p>Sen: ${a} &nbsp;·&nbsp; ${G.names.B}: ${b}</p>
    <p style="color:#ffd86b;font-weight:700">${verdict}</p>${bw}
    <button class="kl-btn primary" data-x="again">Yeni Oyun</button>
    <button class="kl-btn" style="margin-top:8px" data-x="menu">Menü</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="again"]').addEventListener('click',()=>{ ov.remove(); G._over=false; startAI(G.ai.difficulty); });
  ov.querySelector('[data-x="menu"]').addEventListener('click',()=>{ ov.remove(); G._over=false; G.ai=null; showStart(); });
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
  if(G.ai && (G.aiThinking || G.who!=='A')){ flashStatus('Yapay zekâ oynuyor…'); return; }
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
  if(G.ai){
    G.state.passStreak = (G.state.passStreak||0)+1;
    if(checkGameOver()) return;
    stopTurnTimer();
    G.who='B'; G.aiThinking=true; renderScores();
    flashStatus('🤖 Yapay zekâ düşünüyor…');
    setTimeout(aiTurn, 700);
    return;
  }
  G.state.passStreak++;
  if(G.state.passStreak>=4){ endGame(); return; }
  nextTurn();
}

function toggleExchangeMode(){
  if(G.online && !isMyTurn()){ flashStatus('⏳ Sıra sende değil'); return; }
  if(G.ai && (G.aiThinking || G.who!=='A')){ flashStatus('Yapay zekâ oynuyor…'); return; }
  if(!G.exchangeMode){
    if(G.pending.length>0){ flashStatus('Önce yerleştirdiğin taşları geri al'); return; }
    const bagLeft = G.online ? (G.bag.length - G.state.bagPointer) : G.state.bag.length;
    if(bagLeft <= 0){ flashStatus('Torba boş, değişim yok'); return; }
    G.exchangeMode=true; G.exchangeSel=new Set(); G.selected=null;
    updateExchangeBtn(); renderRack();
    flashStatus('Değiştirmek istediğin harflere dokun, sonra ✓ Onayla');
    return;
  }
  // değişimi onayla
  const idxs = Array.from(G.exchangeSel).sort((a,b)=>a-b);
  if(!idxs.length){ exitExchangeMode(); flashStatus('Harf seçilmedi'); return; }
  performExchange(idxs);
}

function exitExchangeMode(){ G.exchangeMode=false; G.exchangeSel=null; updateExchangeBtn(); renderRack(); }

function performExchange(idxs){
  const removed = idxs.map(i=>G.rackView[i]);
  G.rackView = G.rackView.filter((_,i)=>!idxs.includes(i));
  if(G.online){
    // Çevrimiçi: yeni harfleri tohumlu torbanın ucundan çek (bagPointer ilerler), sırayı rakibe geçir
    const need = removed.length;
    const fresh = G.bag.slice(G.state.bagPointer, G.state.bagPointer+need).map(t=>({letter:t.letter,points:t.points,joker:t.joker}));
    G.state.bagPointer += fresh.length;
    G.rackView = G.rackView.concat(fresh);
    G.state.racks[G.role] = G.rackView.slice();
    G.selected=null; G.exchangeMode=false; G.exchangeSel=null;
    G.state.passStreak=0; sndPick(); haptic(15); updateExchangeBtn();
    const oppRole = G.role==='A'?'B':'A';
    G.state.turn = oppRole;
    const patch = { turn: oppRole, bagPointer: G.state.bagPointer, passStreak: 0, lastMove: { who: G.role, ts: Date.now(), exchange: need } };
    if(G.async) patch['racks/'+G.role] = G.rackView;
    if(KO) KO.pushMove(patch);
    renderAll();
    flashStatus('🔄 '+need+' harf degisti — sira rakipte');
    return;
  }
  const fresh = drawFromBag(G.state.bag, removed.length);
  G.rackView = G.rackView.concat(fresh);
  // çıkarılanları torbaya geri at + karıştır
  for(const t of removed) G.state.bag.unshift(t);
  for(let i=G.state.bag.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [G.state.bag[i],G.state.bag[j]]=[G.state.bag[j],G.state.bag[i]]; }
  G.state.racks[G.who]=G.rackView.slice();
  G.selected=null; G.exchangeMode=false; G.exchangeSel=null;
  G.state.passStreak=0; sndPick(); haptic(15); updateExchangeBtn();
  if(G.ai){
    G.rackView = G.state.racks.A;
    stopTurnTimer();
    G.who='B'; G.aiThinking=true; renderAll(); renderScores();
    flashStatus('🔄 '+removed.length+' harf değişti · 🤖 düşünüyor…');
    setTimeout(aiTurn, 700);
    return;
  }
  renderAll();
  nextTurn();   // 2 oyuncu: sıra karşıya geçer
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
  const stars = starsFor(Math.max(a,b));
  const bw = G.bestWord && G.bestWord.score ? `<p style="color:#c9b8e8;font-size:12px">🏆 En iyi kelime: <b>${G.bestWord.text}</b> (${G.bestWord.score} puan)</p>` : '';
  const ov=document.createElement('div'); ov.className='kl-overlay';
  ov.innerHTML=`<div class="kl-card"><h3>🏁 Oyun Bitti</h3>
    <div style="font-size:30px;letter-spacing:4px;color:#ffd86b;margin:2px 0 6px">${starStr(stars)}</div>
    <p>${G.names.A}: ${a} &nbsp;·&nbsp; ${G.names.B}: ${b}</p>
    <p style="color:#ffd86b;font-weight:700">${win}</p>${bw}
    <button class="kl-btn primary" data-x="again">Yeni Oyun</button>
    <button class="kl-btn" style="margin-top:8px" data-x="close">Kapat</button></div>`;
  c.appendChild(ov);
  ov.querySelector('[data-x="again"]').addEventListener('click',()=>{ ov.remove(); startLocal(); });
  ov.querySelector('[data-x="close"]').addEventListener('click', closeKelime);
}
