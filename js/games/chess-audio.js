// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — SES EFEKTLERİ (Web Audio)
//
//  Hamle, yeme, şah, mat, rok, terfi için sentezlenmiş sesler.
//  Dosya yok — tüm sesler anlık üretilir.
// ════════════════════════════════════════════════════════════════

let ctx = null;
let master = null;
let enabled = (function(){ try{ return localStorage.getItem('hero_chess_sound') !== 'off'; }catch(e){ return true; } })();

function ensure(){
  if(ctx) return ctx;
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }catch(e){ return null; }
  return ctx;
}

// Tek nota çal
function tone(freq, dur, type, vol, delay){
  const c = ensure(); if(!c || !enabled) return;
  if(c.state === 'suspended') c.resume();
  const t = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

// Kısa gürültü patlaması (vuruş/yeme için)
function noise(dur, vol, delay){
  const c = ensure(); if(!c || !enabled) return;
  if(c.state === 'suspended') c.resume();
  const t = c.currentTime + (delay || 0);
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++){ data[i] = (Math.random()*2-1) * (1 - i/len); }
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = vol || 0.15;
  const filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1800;
  src.connect(filter); filter.connect(g); g.connect(master);
  src.start(t);
}

export const ChessSound = {
  get enabled(){ return enabled; },
  toggle(){
    enabled = !enabled;
    try{ localStorage.setItem('hero_chess_sound', enabled ? 'on' : 'off'); }catch(e){}
    if(enabled) this.move();
    return enabled;
  },

  // Normal hamle: yumuşak tık
  move(){ tone(420, 0.08, 'sine', 0.18); tone(280, 0.06, 'triangle', 0.12, 0.01); },

  // Yeme: tahtaya vuruş + gürültü
  capture(){ noise(0.12, 0.2); tone(180, 0.12, 'square', 0.16); tone(120, 0.1, 'sine', 0.12, 0.02); },

  // Şah: uyarı tonu (yükselen)
  check(){ tone(660, 0.12, 'triangle', 0.2); tone(880, 0.14, 'triangle', 0.18, 0.08); },

  // Rok: çift tık (iki taş hareketi)
  castle(){ tone(380, 0.07, 'sine', 0.16); tone(420, 0.07, 'sine', 0.16, 0.1); },

  // Terfi: yükselen parlak arpej
  promote(){ [523, 659, 784, 1047].forEach((f,i) => tone(f, 0.16, 'triangle', 0.16, i*0.06)); },

  // Mat / zafer: görkemli akor
  win(){ [523, 659, 784].forEach((f,i) => tone(f, 0.5, 'triangle', 0.18, i*0.04)); tone(1047, 0.6, 'sine', 0.14, 0.12); },

  // Yenilgi: alçalan üzgün ton
  lose(){ [440, 392, 330, 262].forEach((f,i) => tone(f, 0.3, 'sine', 0.16, i*0.12)); },

  // Pat / berabere: nötr
  draw(){ tone(440, 0.2, 'sine', 0.14); tone(440, 0.2, 'sine', 0.12, 0.18); },

  // Taş seçme: çok hafif tık
  select(){ tone(560, 0.04, 'sine', 0.1); }
};

export default ChessSound;
