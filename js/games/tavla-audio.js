// ════════════════════════════════════════════════════════════════
//  TAVLA — SES (Web Audio API, dosya yok, sentezlenmiş)
// ════════════════════════════════════════════════════════════════
let ctx = null;
let enabled = (function(){ try{ return localStorage.getItem('hero_tavla_sound') !== 'off'; }catch(e){ return true; } })();

function ac(){
  if(!ctx){ try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ return null; } }
  if(ctx && ctx.state === 'suspended'){ ctx.resume().catch(()=>{}); }
  return ctx;
}

function tone(freq, dur, type, gain, delay){
  if(!enabled) return;
  const a = ac(); if(!a) return;
  const t0 = a.currentTime + (delay || 0);
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain || 0.18, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(a.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// Kısa gürültü patlaması (zar takırtısı / pul tıkırtısı için)
function noise(dur, gain, delay, filterFreq){
  if(!enabled) return;
  const a = ac(); if(!a) return;
  const t0 = a.currentTime + (delay || 0);
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<len;i++){ data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, 2); }
  const src = a.createBufferSource(); src.buffer = buf;
  const filt = a.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = filterFreq || 1800; filt.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = gain || 0.2;
  src.connect(filt); filt.connect(g); g.connect(a.destination);
  src.start(t0);
}

const Sound = {
  get enabled(){ return enabled; },
  toggle(){
    enabled = !enabled;
    try{ localStorage.setItem('hero_tavla_sound', enabled ? 'on' : 'off'); }catch(e){}
    return enabled;
  },
  resume(){ ac(); },

  // Zar atma — iki kısa takırtı
  dice(){
    noise(0.09, 0.22, 0, 2200);
    noise(0.08, 0.18, 0.11, 1900);
    noise(0.07, 0.14, 0.2, 2400);
  },
  // Pul koyma — kısa tok tıkırtı
  move(){
    tone(420, 0.06, 'triangle', 0.16);
    noise(0.04, 0.12, 0, 1200);
  },
  // Vurma — sert vuruş
  hit(){
    tone(180, 0.12, 'square', 0.2);
    noise(0.1, 0.25, 0, 900);
    tone(120, 0.16, 'sawtooth', 0.14, 0.02);
  },
  // Toplama (bear off) — gerçekçi ahşap pul sesi
  // 1) Keskin tıklama (pul kenarı tahta kenarına değiyor)
  // 2) Kısa rezonans (içi boş ahşap çanak)
  // 3) Hafif yumuşak iniş (pul yığına oturuyor)
  bearoff(stackCount){
    const n = (stackCount || 1);
    // Ana tok darbe — ahşap
    noise(0.03, 0.28, 0, 3200);        // sert tıklama
    noise(0.06, 0.18, 0.01, 1400);     // derin gövde titreşimi
    tone(260, 0.18, 'triangle', 0.12); // ahşap rezonans
    tone(520, 0.06, 'triangle', 0.06, 0.02); // harmonik
    // Kaymak hissi (pul yığına süzülüyor)
    tone(180, 0.1, 'sine', 0.06, 0.04);
    // Çok pul varsa hafif kaskad — n'e göre ek tıklamalar
    if(n >= 5){
      noise(0.025, 0.12, 0.07, 2800);
      noise(0.02, 0.08, 0.11, 2200);
    }
    if(n >= 10){
      noise(0.02, 0.1, 0.14, 3000);
    }
    // İnce hışırtı (pul kenara yerleşiyor)
    noise(0.08, 0.06, 0.05, 800);
  },
  // Kazanma — yükselen arpej
  win(){
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.1));
  },
  // Kaybetme — alçalan
  lose(){
    [440, 370, 294].forEach((f, i) => tone(f, 0.24, 'sine', 0.16, i * 0.12));
  },
  // Seçim — hafif tık
  select(){ tone(660, 0.05, 'sine', 0.1); }
};

export default Sound;
export { Sound };
