// ════════════════════════════════════════════════════════════════
//  HeroTetris — SES MOTORU (Web Audio API ile sentez)
//
//  Dosya İNDİRMEZ — tüm sesler kod ile üretilir (hafif, anında).
//  İlk kullanıcı dokunuşunda AudioContext başlar (tarayıcı kuralı).
//  Sessize alma: Audio.toggle() / durum localStorage'da.
// ════════════════════════════════════════════════════════════════
let ctx = null;
let enabled = (function(){ try{ return localStorage.getItem('hero_tetris_sound') !== 'off'; }catch(e){ return true; } })();
let master = null;

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
export const Sound = {
  get enabled(){ return enabled; },
  toggle(){
    enabled = !enabled;
    try{ localStorage.setItem('hero_tetris_sound', enabled ? 'on' : 'off'); }catch(e){}
    if(enabled) tone(660, 0.08, 'sine', 0.3);
    return enabled;
  },
  resume(){ const c = ensure(); if(c && c.state === 'suspended') c.resume(); },

  move(){ tone(220, 0.04, 'square', 0.12); },
  rotate(){ tone(380, 0.05, 'square', 0.15); },
  soft(){ tone(180, 0.03, 'sine', 0.1); },
  hard(){ sweep(420, 90, 0.14, 'sawtooth', 0.28); tone(80, 0.1, 'sine', 0.25); },
  hold(){ tone(300, 0.06, 'triangle', 0.18); tone(450, 0.06, 'triangle', 0.15, 0.04); },
  lock(){ tone(160, 0.06, 'square', 0.16); },

  line(n){
    // 1-3 satır: yükselen arpej
    const base = 440;
    for(let i=0;i<Math.min(n,3);i++) tone(base + i*160, 0.12, 'triangle', 0.26, i*0.05);
  },
  tetris(){
    // 4 satır: zafer arpeji
    [523,659,784,1047].forEach((f,i)=> tone(f, 0.18, 'triangle', 0.3, i*0.06));
  },
  level(){ [392,523,659].forEach((f,i)=> tone(f, 0.14, 'sine', 0.26, i*0.05)); },

  power(){ sweep(300, 900, 0.3, 'sawtooth', 0.3); tone(1200, 0.15, 'triangle', 0.2, 0.15); },
  gem(){ tone(880, 0.08, 'sine', 0.25); tone(1320, 0.1, 'sine', 0.2, 0.06); },
  fusion(){
    sweep(200, 1200, 0.4, 'sawtooth', 0.35);
    [659,988,1319].forEach((f,i)=> tone(f, 0.25, 'triangle', 0.3, 0.15 + i*0.08));
    tone(100, 0.5, 'sine', 0.3, 0.1);
  },
  gemPick(){ tone(700, 0.07, 'triangle', 0.22); tone(1050, 0.08, 'triangle', 0.18, 0.05); },

  shield(){ sweep(600, 200, 0.3, 'sine', 0.3); tone(880, 0.2, 'triangle', 0.2, 0.1); },
  gameover(){ [440,330,220,165].forEach((f,i)=> tone(f, 0.25, 'sawtooth', 0.28, i*0.12)); },
  win(){ [523,659,784,1047,1319].forEach((f,i)=> tone(f, 0.2, 'triangle', 0.3, i*0.1)); }
};

export default Sound;
