// ════════════════════════════════════════════════════════════════
//  HeroTetris — SES MOTORU (Web Audio API ile sentez)
//
//  Dosya İNDİRMEZ — tüm sesler kod ile üretilir (hafif, anında).
//  İlk kullanıcı dokunuşunda AudioContext başlar (tarayıcı kuralı).
//  Sessize alma: Audio.toggle() / durum localStorage'da.
// ════════════════════════════════════════════════════════════════
let ctx = null;
let enabled = (function(){ try{ return localStorage.getItem('hero_tetris_sound') !== 'off'; }catch(e){ return true; } })();
let vibeOn = (function(){ try{ return localStorage.getItem('hero_tetris_vibe') !== 'off'; }catch(e){ return true; } })();

// Vibrasyon yardımcısı (destekleyen cihazlarda)
function vibrate(pattern){
  if(!vibeOn) return;
  try{ if(navigator && navigator.vibrate) navigator.vibrate(pattern); }catch(e){}
}
let master = null;

// ── Arka plan müziği (chiptune döngü) ──
let musicOn = (function(){ try{ return localStorage.getItem('hero_tetris_music') === 'on'; }catch(e){ return false; } })();
let musicTimer = null;
let musicGain = null;
let musicStep = 0;
const MELODY = [330,392,494,392, 330,294,330,392, 262,330,392,330, 294,247,294,196, 330,392,494,587, 523,494,392,330, 294,330,392,494, 392,330,294,262];
const BASS = [82,82,98,98, 82,82,73,73, 65,65,82,82, 73,73,49,49, 82,82,98,98, 87,87,73,73, 65,65,82,82, 73,73,65,65];

function musicTick(){
  const c = ensure(); if(!c || !musicGain) return;
  const t = c.currentTime;
  const mFreq = MELODY[musicStep % MELODY.length];
  const bFreq = BASS[musicStep % BASS.length];
  try{
    const mo = c.createOscillator(), mg = c.createGain();
    mo.type = 'square'; mo.frequency.value = mFreq;
    mg.gain.setValueAtTime(0.0001, t); mg.gain.linearRampToValueAtTime(0.16, t+0.02);
    mg.gain.exponentialRampToValueAtTime(0.0008, t+0.22);
    mo.connect(mg); mg.connect(musicGain); mo.start(t); mo.stop(t+0.24);
    const bo = c.createOscillator(), bg = c.createGain();
    bo.type = 'triangle'; bo.frequency.value = bFreq;
    bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.22, t+0.02);
    bg.gain.exponentialRampToValueAtTime(0.0008, t+0.26);
    bo.connect(bg); bg.connect(musicGain); bo.start(t); bo.stop(t+0.28);
  }catch(e){}
  musicStep++;
}
function startMusic(){
  if(musicTimer) return;
  const c = ensure(); if(!c) return;
  if(c.state === 'suspended') c.resume();
  if(!musicGain){ musicGain = c.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master); }
  musicStep = 0; musicTick();
  musicTimer = setInterval(musicTick, 200);
}
function stopMusic(){ if(musicTimer){ clearInterval(musicTimer); musicTimer = null; } }

function ensure(){
  if(ctx) return ctx;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }catch(e){ ctx = null; }
  return ctx;
}

// Tek bir ton çal (osilatör)
function tone(freq, dur, type, vol, delay){
  if(!enabled) return;
  const c = ensure(); if(!c) return;
  try{
    if(c.state === 'suspended') c.resume();
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + (dur || 0.12));
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + (dur || 0.12) + 0.02);
  }catch(e){}
}

// Frekans kaydırmalı ton (whoosh/güç efektleri)
function sweep(f1, f2, dur, type, vol){
  if(!enabled) return;
  const c = ensure(); if(!c) return;
  try{
    if(c.state === 'suspended') c.resume();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.3, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }catch(e){}
}

// ── Ses olayları ──
// Beyaz gürültü patlaması (patlama/çöp efektleri için)
function noise(dur, vol, filterFreq){
  if(!enabled) return;
  const c = ensure(); if(!c) return;
  try{
    if(c.state === 'suspended') c.resume();
    const t0 = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * (1 - i/len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.setValueAtTime(vol||0.2, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0+dur);
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = filterFreq || 1200;
    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0); src.stop(t0+dur);
  }catch(e){}
}

export const Sound = {
  get enabled(){ return enabled; },
  get vibeEnabled(){ return vibeOn; },
  toggle(){
    enabled = !enabled;
    try{ localStorage.setItem('hero_tetris_sound', enabled ? 'on' : 'off'); }catch(e){}
    if(enabled) tone(660, 0.08, 'sine', 0.3);
    return enabled;
  },
  toggleVibe(){
    vibeOn = !vibeOn;
    try{ localStorage.setItem('hero_tetris_vibe', vibeOn ? 'on' : 'off'); }catch(e){}
    if(vibeOn) vibrate(30);
    return vibeOn;
  },
  get musicEnabled(){ return musicOn; },
  toggleMusic(){
    musicOn = !musicOn;
    try{ localStorage.setItem('hero_tetris_music', musicOn ? 'on' : 'off'); }catch(e){}
    if(musicOn){ startMusic(); } else { stopMusic(); }
    return musicOn;
  },
  startMusic(){ if(musicOn) startMusic(); },   // sadece açıksa başlat
  stopMusic(){ stopMusic(); },
  vibrate(p){ vibrate(p); },
  resume(){ const c = ensure(); if(c && c.state === 'suspended') c.resume(); },

  move(){ tone(240, 0.035, 'square', 0.10); vibrate(8); },
  rotate(){ tone(420, 0.05, 'square', 0.14); tone(640, 0.04, 'sine', 0.08, 0.02); vibrate(12); },
  soft(){ tone(190, 0.03, 'sine', 0.09); },
  hard(){ sweep(460, 80, 0.16, 'sawtooth', 0.30); tone(70, 0.12, 'sine', 0.28); noise(0.08, 0.12, 800); vibrate([15, 20, 25]); },
  hold(){ tone(320, 0.06, 'triangle', 0.18); tone(480, 0.06, 'triangle', 0.15, 0.04); vibrate(10); },
  lock(){ tone(150, 0.06, 'square', 0.15); tone(90, 0.05, 'sine', 0.12, 0.01); vibrate(10); },

  line(n){
    // 1-3 satır: yükselen parlak arpej + hafif çıngırak
    const base = 480;
    for(let i=0;i<Math.min(n,3);i++){ tone(base + i*180, 0.13, 'triangle', 0.26, i*0.05); tone((base + i*180)*2, 0.08, 'sine', 0.10, i*0.05); }
    noise(0.1, 0.08, 2400);
    vibrate(n >= 3 ? [20, 30, 40] : [15, 20]);
  },
  tetris(){
    // 4 satır: görkemli zafer akoru
    [523,659,784,1047].forEach((f,i)=>{ tone(f, 0.22, 'triangle', 0.3, i*0.05); tone(f*2, 0.12, 'sine', 0.12, i*0.05); });
    sweep(200, 900, 0.3, 'sawtooth', 0.18, 0.1);
    noise(0.15, 0.14, 3000);
    vibrate([30, 40, 30, 60]);
  },
  level(){ [392,523,659,784].forEach((f,i)=> tone(f, 0.15, 'sine', 0.26, i*0.05)); vibrate([20, 30]); },

  power(){
    sweep(280, 1100, 0.32, 'sawtooth', 0.32);
    tone(1400, 0.18, 'triangle', 0.2, 0.16);
    noise(0.2, 0.12, 2000);
    vibrate([25, 20, 35, 20, 50]);
  },
  gem(){ tone(920, 0.08, 'sine', 0.24); tone(1380, 0.1, 'sine', 0.18, 0.06); tone(1840, 0.06, 'sine', 0.1, 0.1); vibrate(15); },
  fusion(){
    sweep(180, 1400, 0.45, 'sawtooth', 0.36);
    [659,988,1319,1760].forEach((f,i)=> tone(f, 0.28, 'triangle', 0.3, 0.15 + i*0.07));
    tone(90, 0.55, 'sine', 0.32, 0.1);
    noise(0.3, 0.18, 2600);
    vibrate([40, 30, 50, 30, 80]);
  },
  gemPick(){ tone(740, 0.07, 'triangle', 0.22); tone(1110, 0.08, 'triangle', 0.18, 0.05); vibrate(12); },

  garbage(){ sweep(300, 120, 0.2, 'sawtooth', 0.22); noise(0.12, 0.16, 700); vibrate([20, 40]); },   // çöp geldi
  shield(){ sweep(600, 220, 0.32, 'sine', 0.3); tone(920, 0.22, 'triangle', 0.2, 0.1); noise(0.15, 0.1, 1800); vibrate([30, 20, 30]); },
  gameover(){ [440,330,220,165].forEach((f,i)=> tone(f, 0.28, 'sawtooth', 0.28, i*0.12)); noise(0.4, 0.12, 500); vibrate([60, 40, 80, 100]); },
  win(){ [523,659,784,1047,1319,1568].forEach((f,i)=> tone(f, 0.22, 'triangle', 0.3, i*0.09)); noise(0.2, 0.1, 3000, 0.2); vibrate([40, 30, 40, 30, 60, 100]); }
};

export default Sound;
