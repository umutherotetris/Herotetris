// ═══════════════════════════════════════════════════════════════
//  KOZMOS — Hero Oyun Portalı (Goodyedek birebir + geliştirilmiş UI)
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';


// Hafif toast helper (alert yerine)
// Firebase undefined kabul etmez — objeyi recursive temizle
function _noUndef(obj){
  if(Array.isArray(obj)) return obj.map(_noUndef).filter(v=>v!==undefined);
  if(obj && typeof obj==='object'){
    const out={};
    for(const k in obj){ const v=_noUndef(obj[k]); if(v!==undefined) out[k]=v; }
    return out;
  }
  return obj;
}
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));


// ── 🔊 Ses sistemi (WebAudio) ─────────────────────────────────
let _ac=null;
function getAC(){
  if(!_ac){ try{_ac=new(window.AudioContext||window.webkitAudioContext)();}catch(e){} }
  if(_ac&&_ac.state==='suspended') try{_ac.resume();}catch(e){}
  return _ac;
}
function tone(freq,type,dur,vol,delay){
  const ac=getAC();if(!ac)return;
  try{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=type||'sine';o.frequency.value=freq||440;
    const s=ac.currentTime+(delay||0);
    g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(vol||0.12,s+0.005);
    g.gain.exponentialRampToValueAtTime(0.001,s+(dur||0.12));
    o.start(s);o.stop(s+(dur||0.12)+0.02);
  }catch(e){}
}
function sfxFeed(){
  [[523,'sine',0.12,0.15,0],[659,'sine',0.10,0.12,0.08],[784,'triangle',0.14,0.18,0.16],[1047,'sine',0.10,0.10,0.26]]
  .forEach(([f,t,d,v,dl])=>tone(f,t,d,v,dl));
}
function sfxCrack(){
  const ac=getAC();if(!ac)return;
  try{
    const dur=0.07+Math.random()*0.05;
    const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate);
    const d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,0.8);
    const src=ac.createBufferSource();src.buffer=buf;
    const filt=ac.createBiquadFilter();filt.type='bandpass';filt.frequency.value=1800;filt.Q.value=0.6;
    const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+dur);
    src.connect(filt);filt.connect(g);g.connect(ac.destination);
    src.start();src.stop(ac.currentTime+dur+0.02);
    setTimeout(()=>tone(2200+Math.random()*400,'square',0.025,0.06),dur*500);
    setTimeout(()=>tone(1600+Math.random()*300,'square',0.03,0.05),dur*800);
  }catch(e){}
}
function sfxHatch(){
  [[392,'triangle',0.15,0.18,0],[523,'triangle',0.13,0.20,0.12],[659,'sine',0.14,0.22,0.22],[784,'sine',0.13,0.20,0.34],[1047,'triangle',0.20,0.28,0.46],[1319,'sine',0.25,0.30,0.62]]
  .forEach(([f,t,d,v,dl])=>tone(f,t,d,v,dl));
}
function sfxReject(){
  [440,350,260].forEach((f,i)=>setTimeout(()=>tone(f,'sawtooth',0.10,0.09),i*55));
}
// 🐣 Vikleme/cıvıltı sesi (yumurta sesleri)
function sfxChirp(){
  const ac=getAC(); if(!ac)return;
  // Kuş cıvıltısı: hızlı yükselen-inen
  const base=800+Math.random()*400;
  [[base,0,0.05],[base*1.3,0.05,0.04],[base*0.9,0.1,0.05]].forEach(([f,d,dur])=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type='sine';o.frequency.value=f;
    const t=ac.currentTime+d;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.1,t+0.005);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.start(t);o.stop(t+dur+0.02);
  });
}

// ── Faz (Goodyedek birebir) ──────────────────────────────────
const PHASE_INFO=[
  {label:'Karanlık',   color:'#b090f0',mystery:true,  desc:'Nabız gibi titreşiyor…'},
  {label:'Isınıyor~',  color:'#a080e8',mystery:true,  desc:'Hafifçe sallanıyor'},
  {label:'Sesler!',    color:'#c090e8',mystery:true,  desc:'Tık tık… içeriden'},
  {label:'Renk!',      color:'#e0a050',mystery:true,  desc:'İpucu mu veriyor?'},
  {label:'Çatlak! 🔥', color:'#f5c040',mystery:true,  desc:'Işık sızıyor içeriden'},
  {label:'Büyüyor…',   color:'#60d8f8',mystery:false, desc:'Sesler daha güçlü!'},
  {label:'Göz! 👁',    color:'#40d0ff',mystery:false, desc:'Seni izliyor…!'},
  {label:'İki Göz 👀', color:'#c070ff',mystery:false, desc:'Dikkatle bakıyor'},
  {label:'Baş çıkıyor',color:'#d090ff',mystery:false, desc:'Kulaklar görünüyor'},
  {label:'Uyuyor~ 💤', color:'#b080f0',mystery:false, desc:'Mışıl mışıl'},
  {label:'Neredeyse!', color:'#e0a030',mystery:false, desc:'Gözler açıldı!'},
  {label:'DOĞDU! 🎊',  color:'#fbbf24',mystery:false, desc:'İsim açıklandı!'},
];
const PHASE_HOURS=[0,6,14,24,36,48,60,72,84,96,108,120];

export function kozmoGetPhase(sentAt,feedBonus){
  const elapsed=Date.now()-(sentAt||0)+(feedBonus||0)*8*3600000;
  let p=0; for(let i=0;i<PHASE_HOURS.length;i++){if(elapsed>=PHASE_HOURS[i]*3600000)p=i;else break;}
  return Math.min(p,11);
}

// ── Yaratık türleri ──────────────────────────────────────────
// ── ULTRA PREMIUM KOZMO TANIMLARI ────────────────────────────
// shape: SVG gövde tipi · c1/c2: gradyan renkleri · acc: aksan rengi
// power: yetenek · element: tür · sound: ses karakteri · particle: parçacık
const TYPES={
  nebula_kedi:  {n:'Nebula Kedi',   e:'🐱',c:'#7dd3fc',c1:'#93c5fd',c2:'#3b82f6',acc:'#e0f2fe',r:'common',
                 shape:'cat',    element:'Yıldız',  power:'Yıldız Tozu Saçar', bonus:{xp:0.05}, sound:'soft',   particle:'stars',
                 desc:'Gece göğünün küçük avcısı. Yıldız tozu saçarak sahibine ekstra deneyim kazandırır.'},
  lav_tilkisi:  {n:'Lav Tilkisi',   e:'🦊',c:'#fb923c',c1:'#fdba74',c2:'#ea580c',acc:'#fef08a',r:'rare',
                 shape:'fox',    element:'Ateş',    power:'Alev Püskürtür',    bonus:{score:0.05}, sound:'fierce', particle:'fire',
                 desc:'Volkanların ateşli sakini. Alevleriyle oyun skorunu yükseltir.'},
  mandalina_tav:{n:'Mandalina Tavşan',e:'🐇',c:'#fbbf24',c1:'#fde047',c2:'#f59e0b',acc:'#fff7cd',r:'common',
                 shape:'bunny',  element:'Doğa',    power:'Bereket Saçar',     bonus:{kaju:0.04}, sound:'cute',   particle:'leaves',
                 desc:'Bahçelerin neşeli zıplayıcısı. Bereketiyle Kaju kazancını artırır.'},
  bulut_ruhu:   {n:'Bulut Kaplanı', e:'🐯',c:'#e0f2fe',c1:'#f0f9ff',c2:'#7dd3fc',acc:'#bae6fd',r:'rare',
                 shape:'tiger',  element:'Hava',    power:'Rüzgâr Toplar',     bonus:{kaju:0.05}, sound:'majestic',particle:'clouds',
                 desc:'Gökyüzünde süzülen heybetli kaplan. Rüzgârla Kaju kazancını çoğaltır.'},
  gokk_ruhu:    {n:'Gök Fırtınası', e:'⚡',c:'#e879f9',c1:'#f0abfc',c2:'#a21caf',acc:'#fae8ff',r:'legendary',
                 shape:'storm',  element:'Şimşek',  power:'Şimşek Çaktırır',   bonus:{score:0.07}, sound:'epic',   particle:'lightning',
                 desc:'Fırtınaların güçlü ruhu. Şimşek hızıyla skorunu yükseltir. Görkemli ve nadir.'},
  kristal_boc:  {n:'Kristal Böcek', e:'🦋',c:'#67e8f9',c1:'#a5f3fc',c2:'#0891b2',acc:'#cffafe',r:'rare',
                 shape:'beetle', element:'Kristal', power:'Işık Kırar',        bonus:{xp:0.06}, sound:'crystal',particle:'crystals',
                 desc:'Işıltılı kanatların sahibi. Işığı kırarak deneyim kazancını parlatır.'},
  nova_kitsune: {n:'Nova Kitsune', e:'🦊',c:'#c084fc',c1:'#d8b4fe',c2:'#7c3aed',acc:'#f3e8ff',r:'rare',
                 shape:'kitsune',element:'Doğa',    power:'Üç Kuyruk Sallar',  bonus:{kaju:0.06}, sound:'mystic', particle:'spirits',
                 desc:'Üç kuyruklu çevik tilki. Her kuyruğu ayrı bir Kaju bereketi taşır.'},
  kozmik_unicorn:{n:'Kozmik Unicorn',e:'🦄',c:'#ff80ff',c1:'#fbcfe8',c2:'#db2777',acc:'#fdf2f8',r:'epic',
                 shape:'unicorn',element:'Gökkuşağı',power:'Gökkuşağı Saçar',  bonus:{all:0.05}, sound:'magical',particle:'rainbow',
                 desc:'Yedi renkli kozmik tek boynuzlu. Gökkuşağı saçarak tüm kazançları artırır.'},
  derin_ejder:  {n:'Derin Ejder',   e:'🐲',c:'#00ffc8',c1:'#5eead4',c2:'#0d9488',acc:'#ccfbf1',r:'legendary',
                 shape:'dragon', element:'Derinlik',power:'Gelgit Çağırır',    bonus:{kaju:0.08}, sound:'roar',   particle:'bubbles',
                 desc:'Derinlerin görkemli ejderhası. Gelgitlerle bol Kaju getirir. Çok nadir.'},
  peri_ruhu:    {n:'Peri Kelebeği', e:'🧚',c:'#ffb8ff',c1:'#fbcfe8',c2:'#e879f9',acc:'#fdf4ff',r:'mythical',
                 shape:'fairy',  element:'Işık',    power:'Işık Serper',       bonus:{all:0.08}, sound:'fairy',  particle:'sparkles',
                 desc:'Işığın zarif kelebeği. Işık serperek tüm kazançlarını en üst düzeyde çoğaltır. Olağanüstü nadir.'},
};
const RARITY_COLOR={common:'#aaa',rare:'#00E5FF',epic:'#c084fc',legendary:'#FFD740',mythical:'#ff80ff',gorkem:'#FFD740',olagan:'#ff80ff'};
const RARITY_LABEL={common:'Sıradan',rare:'Nadir',epic:'Epik',legendary:'Görkemli',mythical:'Olağanüstü',gorkem:'Görkemli',olagan:'Olağanüstü'};
const TYPE_KEYS=Object.keys(TYPES);

// ── Birleştirme tablosu (Goodyedek birebir) ──────────────────
const MERGE_TABLE={
  'nebula_kedi+mandalina_tav':'nova_kitsune',
  'mandalina_tav+nebula_kedi':'nova_kitsune',
  'nebula_kedi+lav_tilkisi':'nova_kitsune',
  'lav_tilkisi+nebula_kedi':'nova_kitsune',
  'bulut_ruhu+nebula_kedi':'gokk_ruhu',
  'nebula_kedi+bulut_ruhu':'gokk_ruhu',
  'lav_tilkisi+bulut_ruhu':'kristal_boc',
  'bulut_ruhu+lav_tilkisi':'kristal_boc',
  'lav_tilkisi+mandalina_tav':'kozmik_unicorn',
  'mandalina_tav+lav_tilkisi':'kozmik_unicorn',
  'mandalina_tav+bulut_ruhu':'kozmik_unicorn',
  'bulut_ruhu+mandalina_tav':'kozmik_unicorn',
  'gokk_ruhu+kristal_boc':'derin_ejder',
  'kristal_boc+gokk_ruhu':'derin_ejder',
  'nova_kitsune+bulut_ruhu':'peri_ruhu',
  'bulut_ruhu+nova_kitsune':'peri_ruhu',
  'gokk_ruhu+nova_kitsune':'derin_ejder',
  'nova_kitsune+gokk_ruhu':'derin_ejder',
  'kozmik_unicorn+gokk_ruhu':'peri_ruhu',
  'gokk_ruhu+kozmik_unicorn':'peri_ruhu',
  'derin_ejder+peri_ruhu':'gokk_ruhu',
  'peri_ruhu+derin_ejder':'gokk_ruhu',
  'kristal_boc+nova_kitsune':'kozmik_unicorn',
  'nova_kitsune+kristal_boc':'kozmik_unicorn',
};
// Tabloda olmayan kombinasyonlar → özel füzyon yaratıkları
const FUSION_TYPES=[
  {key:'fusion_nebula',  name:'Nebula Kaynağı', e:'💠',c:'#818cf8',c1:'#a5b4fc',c2:'#4338ca',acc:'#e0e7ff',r:'legendary',shape:'cosmic', element:'Kozmos',  power:'Galaksi Işıtır',   bonus:{all:0.07}, sound:'epic',   particle:'galaxy',  desc:'İki kozmonun birleşimi. Galaksi ışığıyla tüm kazançları artırır. Görkemli füzyon.'},
  {key:'fusion_void',    name:'Gölge Birliği',   e:'🌌',c:'#c084fc',c1:'#d8b4fe',c2:'#6b21a8',acc:'#f3e8ff',r:'legendary',shape:'void',   element:'Gölge',   power:'Gölge Toplar',     bonus:{score:0.08}, sound:'mystic', particle:'void',    desc:'Gölgelerin gücünü toplayan füzyon. Skorunu güçlü biçimde yükseltir.'},
  {key:'fusion_cosmic',  name:'Kozmik Fırtına',  e:'⚡',c:'#fbbf24',c1:'#fde047',c2:'#d97706',acc:'#fef9c3',r:'epic',     shape:'storm',  element:'Enerji',  power:'Enerji Saçar',     bonus:{score:0.06}, sound:'epic',   particle:'energy',  desc:'Saf enerjinin fırtınası. Skor kazancını çoğaltır.'},
  {key:'fusion_aurora',  name:'Aurora Dansı',    e:'🌈',c:'#f9a8d4',c1:'#fbcfe8',c2:'#db2777',acc:'#fce7f3',r:'legendary',shape:'aurora', element:'Aurora',  power:'Renk Cümbüşü',     bonus:{xp:0.08}, sound:'magical',particle:'aurora',  desc:'Kuzey ışıklarının dansı. Renkleriyle deneyim kazancını parlatır.'},
  {key:'fusion_crystal', name:'Kristal Kalp',    e:'💎',c:'#67e8f9',c1:'#a5f3fc',c2:'#0e7490',acc:'#cffafe',r:'epic',     shape:'crystal',element:'Elmas',   power:'Prizma Işığı',     bonus:{kaju:0.07}, sound:'crystal',particle:'prism',   desc:'Saf kristalin kalbi. Prizma ışığıyla Kaju kazancını çoğaltır.'},
];
function getMergeResult(key1,key2,useStone){
  const combo=key1+'+'+key2;
  const direct=MERGE_TABLE[combo];
  if(direct&&TYPES[direct]) return {key:direct,...TYPES[direct]};
  // Birlestirme Tasi: legendary fusion garantisi
  if(useStone){
    const legends=FUSION_TYPES.filter(f=>f.r==='legendary');
    if(legends.length){ const lf=legends[Math.floor(Math.random()*legends.length)]; return {...lf}; }
  }
  // Bilinmeyen → rastgele fusion (epic+)
  const roll=Math.floor(Math.random()*100);
  if(roll===0){
    // %1 cok nadir: gokk_ruhu
    return {key:'gokk_ruhu',...TYPES.gokk_ruhu};
  }
  const ft=FUSION_TYPES[Math.floor(Math.random()*FUSION_TYPES.length)];
  return {...ft};
}
export function randomType(seed,minRarity){
  const w={common:6,rare:3,epic:1.2,legendary:0.6,mythical:0.2};
  const bump={rare:[1,0,1,2],epic:[2,1,0,1],legendary:[3,2,1,0]}; // minRarity başlangıç indeksi
  const keys=minRarity&&minRarity!=='common'
    ? TYPE_KEYS.filter(k=>{const r=TYPES[k].r;const order=['common','rare','epic','legendary','mythical'];return order.indexOf(r)>=order.indexOf(minRarity);})
    : TYPE_KEYS;
  const weights=keys.map(k=>w[TYPES[k].r]||1);
  const total=weights.reduce((a,b)=>a+b,0);
  let r=((seed||Date.now())%997/997)*total;
  for(let i=0;i<weights.length;i++){r-=weights[i];if(r<=0)return{key:keys[i],...TYPES[keys[i]]};}
  return {key:keys[0],...TYPES[keys[0]]};
}

// ── SVG Yumurta (Goodyedek kozmoEggSVG birebir) ──────────────
export function kozmoEggSVG(phase,size){
  size=size||54;
  const p=PHASE_INFO[phase]||PHASE_INFO[0];
  const anim=phase<4?'kozmoEggPulse':phase<8?'kozmoEggShake':'kozmoEggPulse';
  const dur=[2.5,2.2,2.0,1.8,1.7,1.5,1.5,1.4,1.3,1.2,1.1,1.0][phase]||2;
  const cols=[['#2e1558','#160a35'],['#3a1a68','#160a35'],['#461c78','#160a35'],['#522285','#160a35'],['#5e2490','#160a35'],['#6a2aa0','#160a35'],['#702eb8','#160a35'],['#7830c8','#160a35'],['#7030c0','#160a35'],['#7535c0','#1e0e45'],['#7535c8','#1e0e45'],['#c0a0ff','#3a1860']];
  const c=cols[phase]||cols[0];
  const sc=phase>=10?'rgba(255,215,64,.5)':'rgba(180,130,255,'+(0.25+phase*0.02)+')';
  let ex='';
  if(phase>=4) ex+='<path d="M'+(size*.5)+' '+(size*.16)+' L'+(size*.46)+' '+(size*.3)+' L'+(size*.52)+' '+(size*.38)+'" stroke="rgba(255,215,100,.65)" stroke-width="1.5" fill="none" stroke-linecap="round" style="animation:kozmoCrack '+(2-phase*.1).toFixed(1)+'s ease-in-out infinite"/>';
  if(phase>=5) ex+='<path d="M'+(size*.52)+' '+(size*.38)+' L'+(size*.62)+' '+(size*.44)+'" stroke="rgba(100,220,255,.5)" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  if(phase>=6) ex+='<ellipse cx="'+(size*.4)+'" cy="'+(size*.66)+'" rx="'+(size*.09)+'" ry="'+(size*.07)+'" fill="rgba(0,4,18,.92)"/><circle cx="'+(size*.4)+'" cy="'+(size*.66)+'" r="'+(size*.052)+'" fill="#00d4ff" style="animation:kozmoSparkle 2s ease-in-out infinite"/><circle cx="'+(size*.4)+'" cy="'+(size*.66)+'" r="'+(size*.026)+'" fill="#001525"/><circle cx="'+(size*.42)+'" cy="'+(size*.64)+'" r="'+(size*.018)+'" fill="white" opacity=".9"/>';
  if(phase>=7) ex+='<ellipse cx="'+(size*.6)+'" cy="'+(size*.66)+'" rx="'+(size*.08)+'" ry="'+(size*.07)+'" fill="rgba(0,4,18,.88)"/><circle cx="'+(size*.6)+'" cy="'+(size*.66)+'" r="'+(size*.048)+'" fill="#b060ff" style="animation:kozmoSparkle 2s ease-in-out infinite .5s"/><circle cx="'+(size*.6)+'" cy="'+(size*.66)+'" r="'+(size*.024)+'" fill="#0a0018"/><circle cx="'+(size*.62)+'" cy="'+(size*.64)+'" r="'+(size*.016)+'" fill="white" opacity=".88"/>';
  if(phase>=8&&phase<=10){const hx=size*.5,hy=size*.46,hr=size*.3;ex+='<circle cx="'+hx+'" cy="'+hy+'" r="'+hr+'" fill="rgba(42,18,80,.9)" stroke="rgba(190,140,255,.28)" stroke-width="1"/><path d="M'+(hx-hr*.4)+' '+hy+' Q'+hx+' '+(hy+hr*.2)+' '+(hx+hr*.4)+' '+hy+'" stroke="rgba(190,150,255,.75)" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="'+(hx-hr*.35)+'" cy="'+(hy-hr*.1)+'" r="'+(size*.09)+'" fill="rgba(255,140,175,.25)"/><circle cx="'+(hx+hr*.35)+'" cy="'+(hy-hr*.1)+'" r="'+(size*.09)+'" fill="rgba(255,140,175,.25)"/>';}
  if(phase>=11){ex+='<circle cx="'+(size*.1)+'" cy="'+(size*.3)+'" r="3" fill="#fbbf24" style="animation:kozmoSparkle 1.5s ease-in-out infinite"/><circle cx="'+(size*.9)+'" cy="'+(size*.25)+'" r="2.5" fill="#f9a8d4" style="animation:kozmoSparkle 2s ease-in-out infinite .4s"/><text x="'+(size*.05)+'" y="'+(size*.5)+'" font-size="8" fill="rgba(251,191,36,.7)" style="animation:kozmoSparkle 2.5s ease-in-out infinite">✦</text>';}
  const cx=size*.5,cy=size*.54,rx=size*.39,ry=size*.46;
  const uid='k'+(phase)+'s'+(size)+'_'+Math.floor(Math.random()*9999);
  return '<svg width="'+size+'" height="'+(size*1.15)+'" viewBox="0 0 '+size+' '+(size*1.15)+'" style="display:block;margin:0 auto;animation:'+anim+' '+dur+'s ease-in-out infinite;--kgc:'+sc+'">'
    +'<defs><radialGradient id="'+uid+'" cx="40%" cy="35%"><stop offset="0%" stop-color="'+c[0]+'"/><stop offset="100%" stop-color="'+c[1]+'"/></radialGradient></defs>'
    +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="url(#'+uid+')" stroke="'+sc+'" stroke-width="1.4"/>'
    +ex+'</svg>';
}

// ── 🐾 Animasyonlu sevimli yaratık SVG'leri ──────────────────
// ════════ ANIMASYONLU DEGERLI TAS (özel kozmolar) ════════
// kind: aurora/ember/tide/glow/star/prism/bolt/nova
// Her biri animasyonlu, ışımalı, parçacıklı bir değerli taş döndürür
let _gemCssInjected = false;
function _ensureGemCSS(){
  if(_gemCssInjected) return; _gemCssInjected = true;
  const st = document.createElement('style');
  st.textContent = `
  @keyframes gemFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}
  @keyframes gemSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  @keyframes gemPulse{0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.85;transform:scale(1.18)}}
  @keyframes gemShimmer{0%{opacity:0;transform:translateX(-60%) translateY(-60%) rotate(35deg)}50%{opacity:.9}100%{opacity:0;transform:translateX(60%) translateY(60%) rotate(35deg)}}
  @keyframes gemSpark{0%{opacity:0;transform:translate(0,0) scale(.4)}40%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
  @keyframes gemHue{from{filter:hue-rotate(0deg)}to{filter:hue-rotate(360deg)}}
  .gem-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;animation:gemFloat 3.4s ease-in-out infinite}
  .gem-glow{position:absolute;inset:-15%;border-radius:50%;filter:blur(7px);animation:gemPulse 2.6s ease-in-out infinite;z-index:0}
  .gem-svg{position:relative;z-index:1;overflow:visible}
  .gem-spark{position:absolute;width:4px;height:4px;border-radius:50%;z-index:2;animation:gemSpark 1.8s ease-out infinite}
  .koz-detail-sound,.koz-detail-activate{display:block;width:100%;margin:7px 0 0;padding:10px;border-radius:11px;border:1px solid rgba(192,132,252,.35);background:rgba(192,132,252,.12);color:#e9d5ff;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;transition:transform .12s,background .12s}
  .koz-detail-sound:active,.koz-detail-activate:active{transform:scale(.97)}
  .koz-detail-activate{border-color:rgba(255,215,64,.45);background:linear-gradient(135deg,rgba(255,215,64,.18),rgba(240,165,0,.12));color:#ffe082}
  .koz-detail-activate.active{background:linear-gradient(135deg,#69F0AE,#34d399);color:#04130b;border-color:transparent}
  .koz-detail-bonus{margin:8px 0 4px;padding:8px 12px;border-radius:11px;font-size:11.5px;font-weight:800;color:#ffe082;background:linear-gradient(135deg,rgba(255,215,64,.15),rgba(255,165,0,.08));border:1px solid rgba(255,215,64,.3);text-align:center;line-height:1.4}
  .koz-cre-power{font-size:8px;color:#ffd54f;font-weight:800;margin-top:2px;opacity:.92}
  `;
  document.head.appendChild(st);
}

export function uniqueGemSVG(kind, size, color){
  _ensureGemCSS();
  size = size || 64;
  color = color || '#c0b0ff';
  // Renk paleti: ana + açık + koyu
  const lite = _gemShade(color, 1.4), dark = _gemShade(color, 0.55);
  const S = size;

  // Taş gövdesi (kesme elmas biçimi) — her kind biraz farklı kesim
  const cuts = {
    aurora: 'M50 6 L80 32 L66 92 L34 92 L20 32 Z',       // uzun damla
    ember:  'M50 4 L82 38 L50 96 L18 38 Z',               // alev/baklava
    tide:   'M50 8 C78 8 90 40 72 72 C60 92 40 92 28 72 C10 40 22 8 50 8 Z', // su damlası
    glow:   'M50 6 L72 26 L92 50 L72 74 L50 94 L28 74 L8 50 L28 26 Z',  // ışık yıldızı
    star:   'M50 4 L61 38 L96 38 L68 60 L79 94 L50 72 L21 94 L32 60 L4 38 L39 38 Z', // 5 köşe yıldız
    prism:  'M50 6 L86 30 L86 70 L50 94 L14 70 L14 30 Z', // altıgen prizma
    bolt:   'M58 4 L30 52 L48 52 L40 96 L74 40 L54 40 Z', // şimşek
    nova:   'M50 8 L62 36 L92 38 L68 58 L78 90 L50 70 L22 90 L32 58 L8 38 L38 36 Z', // patlama yıldız
  };
  const path = cuts[kind] || cuts.star;
  const gid = 'g'+kind+Math.floor(Math.random()*100000);

  // Bazı taşlar dönen ışın / renk döngüsü efekti alır
  const extraAnim = (kind==='aurora'||kind==='prism'||kind==='nova') ? 'animation:gemHue 6s linear infinite' : '';
  const rays = (kind==='star'||kind==='nova'||kind==='glow')
    ? '<g style="animation:gemSpin 9s linear infinite;transform-origin:50px 50px">'
      + _gemRays(color) + '</g>'
    : '';

  // Parçacık kıvılcımları (rastgele konum)
  let sparks = '';
  for(let i=0;i<4;i++){
    const ang = Math.random()*Math.PI*2, dist = 18+Math.random()*10;
    const dx = Math.cos(ang)*dist, dy = Math.sin(ang)*dist;
    const delay = (Math.random()*1.8).toFixed(2);
    sparks += '<span class="gem-spark" style="left:50%;top:50%;background:'+lite+';--dx:'+dx.toFixed(0)+'px;--dy:'+dy.toFixed(0)+'px;animation-delay:'+delay+'s;box-shadow:0 0 6px '+color+'"></span>';
  }

  const svg =
    '<svg class="gem-svg" width="'+S+'" height="'+S+'" viewBox="0 0 100 100" style="'+extraAnim+'">'
    + '<defs>'
    +   '<linearGradient id="'+gid+'" x1="0" y1="0" x2="1" y2="1">'
    +     '<stop offset="0" stop-color="'+lite+'"/>'
    +     '<stop offset="0.5" stop-color="'+color+'"/>'
    +     '<stop offset="1" stop-color="'+dark+'"/>'
    +   '</linearGradient>'
    +   '<radialGradient id="'+gid+'r" cx="0.35" cy="0.3" r="0.8">'
    +     '<stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/>'
    +     '<stop offset="0.4" stop-color="'+lite+'" stop-opacity="0.3"/>'
    +     '<stop offset="1" stop-color="'+dark+'" stop-opacity="0"/>'
    +   '</radialGradient>'
    + '</defs>'
    + rays
    // taş gövdesi
    + '<path d="'+path+'" fill="url(#'+gid+')" stroke="'+lite+'" stroke-width="1.5"/>'
    // iç kesim çizgileri (elmas faseti)
    + '<path d="'+path+'" fill="url(#'+gid+'r)"/>'
    + _gemFacets(kind, color, lite)
    // üst parlama
    + '<ellipse cx="40" cy="32" rx="10" ry="6" fill="#ffffff" opacity="0.55" transform="rotate(-25 40 32)"/>'
    + '</svg>';

  return '<span class="gem-wrap">'
    + '<span class="gem-glow" style="background:radial-gradient(circle,'+color+'cc,transparent 70%)"></span>'
    + svg
    + sparks
    + '</span>';
}

// Faset (iç kesim) çizgileri — taşa derinlik
function _gemFacets(kind, color, lite){
  const c = 'stroke="'+lite+'" stroke-width="0.8" opacity="0.5" fill="none"';
  if(kind==='prism'||kind==='nova'||kind==='star'){
    return '<g '+c+'><line x1="50" y1="6" x2="50" y2="94"/><line x1="14" y1="34" x2="86" y2="34"/><line x1="14" y1="66" x2="86" y2="66"/></g>';
  }
  if(kind==='tide'){
    return '<g '+c+'><path d="M30 40 Q50 50 70 40"/><path d="M34 60 Q50 70 66 60"/></g>';
  }
  if(kind==='bolt'){
    return '<g '+c+'><line x1="48" y1="20" x2="40" y2="70"/></g>';
  }
  return '<g '+c+'><line x1="50" y1="8" x2="50" y2="92"/><line x1="22" y1="40" x2="78" y2="40"/></g>';
}

// Dönen ışınlar (yıldız tipi taşlar)
function _gemRays(color){
  let r = '';
  for(let i=0;i<8;i++){
    const a = (i*45)*Math.PI/180;
    const x1 = 50+Math.cos(a)*22, y1 = 50+Math.sin(a)*22;
    const x2 = 50+Math.cos(a)*44, y2 = 50+Math.sin(a)*44;
    r += '<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+color+'" stroke-width="1.5" opacity="0.35" stroke-linecap="round"/>';
  }
  return r;
}

// Renk tonu açma/koyma
function _gemShade(hex, factor){
  let h = (hex||'#888').replace('#','');
  if(h.length===3) h = h.split('').map(x=>x+x).join('');
  let r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  r = Math.max(0,Math.min(255,Math.round(r*factor)));
  g = Math.max(0,Math.min(255,Math.round(g*factor)));
  b = Math.max(0,Math.min(255,Math.round(b*factor)));
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
}

export function creatureSVG(typeKey, size, opts){
  size = size || 56;
  opts = opts || {};
  // Özel değerli taş kozmolar → animasyonlu gem render
  if(opts && opts.unique && opts.kind){
    return uniqueGemSVG(opts.kind, size, opts.color || '#c0b0ff');
  }
  if(typeof typeKey==='string' && typeKey.indexOf('unique_')===0 && opts && opts.kind){
    return uniqueGemSVG(opts.kind, size, opts.color || '#c0b0ff');
  }
  const t = TYPES[typeKey] || FUSION_TYPES.find(x=>x.key===typeKey) || {c:'#c084fc',c1:'#d8b4fe',c2:'#7c3aed',acc:'#fff',shape:'blob'};
  const c1=t.c1||t.c||'#c084fc', c2=t.c2||t.c||'#7c3aed', acc=t.acc||'#fff';
  const shape=t.shape||'blob';
  const uid='cr'+Math.floor(Math.random()*99999);
  const W=size, H=size, cx=W/2, cy=H/2;
  const bob='creatureBob '+(2.2+Math.random()*0.8).toFixed(2)+'s ease-in-out infinite';
  const blinkD=(3+Math.random()*2).toFixed(1);

  // Gradyan tanımları (3D hacim hissi)
  const defs='<defs>'
    +'<radialGradient id="body'+uid+'" cx="38%" cy="32%" r="75%"><stop offset="0%" stop-color="'+lighten(c1)+'"/><stop offset="55%" stop-color="'+c1+'"/><stop offset="100%" stop-color="'+c2+'"/></radialGradient>'
    +'<radialGradient id="belly'+uid+'" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="'+acc+'" stop-opacity=".95"/><stop offset="100%" stop-color="'+acc+'" stop-opacity=".4"/></radialGradient>'
    +'<radialGradient id="glow'+uid+'" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="'+c1+'" stop-opacity=".5"/><stop offset="100%" stop-color="'+c1+'" stop-opacity="0"/></radialGradient>'
    +'<linearGradient id="wing'+uid+'" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="'+lighten(c1)+'" stop-opacity=".85"/><stop offset="100%" stop-color="'+c2+'" stop-opacity=".5"/></linearGradient>'
    +'</defs>';

  // Aura/glow arkası
  const aura='<circle cx="'+cx+'" cy="'+cy+'" r="'+(W*.48)+'" fill="url(#glow'+uid+')"/>';

  // Şekle özel ekstra parçalar (kulak, kanat, boynuz, kuyruk)
  let back='', front='', special='';

  if(shape==='cat'||shape==='kitsune'||shape==='fox'){
    // Sivri kulaklar (içi açık renkli)
    const ew=W*.16, eh=W*.22;
    back='<path d="M'+(cx-W*.26)+' '+(cy-H*.08)+' L'+(cx-W*.34)+' '+(cy-H*.42)+' L'+(cx-W*.06)+' '+(cy-H*.22)+' Z" fill="'+c2+'"/>'
        +'<path d="M'+(cx+W*.26)+' '+(cy-H*.08)+' L'+(cx+W*.34)+' '+(cy-H*.42)+' L'+(cx+W*.06)+' '+(cy-H*.22)+' Z" fill="'+c2+'"/>'
        +'<path d="M'+(cx-W*.24)+' '+(cy-H*.12)+' L'+(cx-W*.29)+' '+(cy-H*.34)+' L'+(cx-W*.12)+' '+(cy-H*.22)+' Z" fill="'+acc+'" opacity=".7"/>'
        +'<path d="M'+(cx+W*.24)+' '+(cy-H*.12)+' L'+(cx+W*.29)+' '+(cy-H*.34)+' L'+(cx+W*.12)+' '+(cy-H*.22)+' Z" fill="'+acc+'" opacity=".7"/>';
    if(shape==='kitsune'){
      // Üç kuyruk (sallanan)
      special='<g style="animation:creatureTail 2.2s ease-in-out infinite;transform-origin:'+(cx+W*.3)+'px '+(cy+H*.2)+'px">'
        +'<ellipse cx="'+(cx+W*.34)+'" cy="'+(cy+H*.12)+'" rx="'+(W*.13)+'" ry="'+(W*.06)+'" fill="'+c1+'" transform="rotate(-20 '+(cx+W*.34)+' '+(cy+H*.12)+')"/>'
        +'<ellipse cx="'+(cx+W*.36)+'" cy="'+(cy+H*.2)+'" rx="'+(W*.14)+'" ry="'+(W*.06)+'" fill="'+c2+'" transform="rotate(0 '+(cx+W*.36)+' '+(cy+H*.2)+')"/>'
        +'<ellipse cx="'+(cx+W*.34)+'" cy="'+(cy+H*.28)+'" rx="'+(W*.13)+'" ry="'+(W*.06)+'" fill="'+c1+'" transform="rotate(20 '+(cx+W*.34)+' '+(cy+H*.28)+')"/>'
        +'<circle cx="'+(cx+W*.46)+'" cy="'+(cy+H*.2)+'" r="'+(W*.04)+'" fill="'+acc+'"/></g>';
    }
  } else if(shape==='bunny'){
    // Uzun tavşan kulakları
    back='<ellipse cx="'+(cx-W*.13)+'" cy="'+(cy-H*.36)+'" rx="'+(W*.075)+'" ry="'+(W*.26)+'" fill="'+c1+'" transform="rotate(-8 '+(cx-W*.13)+' '+(cy-H*.36)+')"/>'
        +'<ellipse cx="'+(cx+W*.13)+'" cy="'+(cy-H*.36)+'" rx="'+(W*.075)+'" ry="'+(W*.26)+'" fill="'+c1+'" transform="rotate(8 '+(cx+W*.13)+' '+(cy-H*.36)+')"/>'
        +'<ellipse cx="'+(cx-W*.13)+'" cy="'+(cy-H*.34)+'" rx="'+(W*.035)+'" ry="'+(W*.2)+'" fill="'+acc+'" opacity=".75" transform="rotate(-8 '+(cx-W*.13)+' '+(cy-H*.34)+')"/>'
        +'<ellipse cx="'+(cx+W*.13)+'" cy="'+(cy-H*.34)+'" rx="'+(W*.035)+'" ry="'+(W*.2)+'" fill="'+acc+'" opacity=".75" transform="rotate(8 '+(cx+W*.13)+' '+(cy-H*.34)+')"/>';
  } else if(shape==='tiger'){
    // Yuvarlak kaplan kulakları + çizgiler
    back='<circle cx="'+(cx-W*.24)+'" cy="'+(cy-H*.24)+'" r="'+(W*.11)+'" fill="'+c2+'"/>'
        +'<circle cx="'+(cx+W*.24)+'" cy="'+(cy-H*.24)+'" r="'+(W*.11)+'" fill="'+c2+'"/>'
        +'<circle cx="'+(cx-W*.24)+'" cy="'+(cy-H*.24)+'" r="'+(W*.06)+'" fill="'+acc+'" opacity=".6"/>'
        +'<circle cx="'+(cx+W*.24)+'" cy="'+(cy-H*.24)+'" r="'+(W*.06)+'" fill="'+acc+'" opacity=".6"/>';
    front='<path d="M'+(cx-W*.05)+' '+(cy-H*.22)+' q'+(W*.05)+' '+(W*.06)+' 0 '+(W*.12)+'" stroke="'+c2+'" stroke-width="1.5" fill="none" opacity=".6"/>'
         +'<path d="M'+(cx+W*.05)+' '+(cy-H*.22)+' q'+(-W*.05)+' '+(W*.06)+' 0 '+(W*.12)+'" stroke="'+c2+'" stroke-width="1.5" fill="none" opacity=".6"/>';
  } else if(shape==='unicorn'){
    // Altın boynuz (parlayan) + yele
    special='<path d="M'+cx+' '+(cy-H*.5)+' L'+(cx-W*.055)+' '+(cy-H*.2)+' L'+(cx+W*.055)+' '+(cy-H*.2)+' Z" fill="#ffd86b" stroke="#fbbf24" stroke-width="1"/>'
      +'<path d="M'+(cx-W*.03)+' '+(cy-H*.42)+' L'+(cx+W*.03)+' '+(cy-H*.42)+'" stroke="#fff8dc" stroke-width="1" opacity=".8"/>'
      +'<path d="M'+(cx-W*.03)+' '+(cy-H*.32)+' L'+(cx+W*.03)+' '+(cy-H*.32)+'" stroke="#fff8dc" stroke-width="1" opacity=".8"/>'
      +'<circle cx="'+cx+'" cy="'+(cy-H*.5)+'" r="'+(W*.025)+'" fill="#fff" style="animation:creatureSparkle 1.5s ease-in-out infinite"/>';
    back='<path d="M'+(cx-W*.22)+' '+(cy-H*.18)+' Q'+(cx-W*.34)+' '+(cy-H*.02)+' '+(cx-W*.26)+' '+(cy+H*.18)+'" stroke="'+lighten(c1)+'" stroke-width="'+(W*.08)+'" fill="none" stroke-linecap="round" opacity=".8"/>';
  } else if(shape==='dragon'){
    // Ejder boynuzları + kanatlar + sırt dikenleri
    back='<path d="M'+(cx-W*.34)+' '+(cy+H*.02)+' Q'+(cx-W*.5)+' '+(cy-H*.16)+' '+(cx-W*.42)+' '+(cy+H*.2)+' Q'+(cx-W*.3)+' '+(cy+H*.16)+' '+(cx-W*.2)+' '+(cy+H*.1)+' Z" fill="url(#wing'+uid+')" style="animation:creatureWing 1.3s ease-in-out infinite;transform-origin:'+(cx-W*.2)+'px '+cy+'px"/>'
        +'<path d="M'+(cx+W*.34)+' '+(cy+H*.02)+' Q'+(cx+W*.5)+' '+(cy-H*.16)+' '+(cx+W*.42)+' '+(cy+H*.2)+' Q'+(cx+W*.3)+' '+(cy+H*.16)+' '+(cx+W*.2)+' '+(cy+H*.1)+' Z" fill="url(#wing'+uid+')" style="animation:creatureWing 1.3s ease-in-out infinite .15s;transform-origin:'+(cx+W*.2)+'px '+cy+'px"/>';
    special='<path d="M'+(cx-W*.14)+' '+(cy-H*.26)+' L'+(cx-W*.18)+' '+(cy-H*.42)+' L'+(cx-W*.08)+' '+(cy-H*.3)+' Z" fill="'+c2+'"/>'
      +'<path d="M'+(cx+W*.14)+' '+(cy-H*.26)+' L'+(cx+W*.18)+' '+(cy-H*.42)+' L'+(cx+W*.08)+' '+(cy-H*.3)+' Z" fill="'+c2+'"/>';
    front='<path d="M'+cx+' '+(cy-H*.18)+' L'+(cx-W*.03)+' '+(cy-H*.08)+' L'+(cx+W*.03)+' '+(cy-H*.08)+' Z" fill="'+acc+'" opacity=".7"/>';
  } else if(shape==='beetle'||shape==='fairy'||shape==='crystal'){
    // Şeffaf parlak kanatlar (çırpan)
    back='<ellipse cx="'+(cx-W*.28)+'" cy="'+(cy-H*.04)+'" rx="'+(W*.2)+'" ry="'+(W*.28)+'" fill="url(#wing'+uid+')" style="animation:creatureWing .9s ease-in-out infinite;transform-origin:'+(cx-W*.1)+'px '+cy+'px"/>'
        +'<ellipse cx="'+(cx+W*.28)+'" cy="'+(cy-H*.04)+'" rx="'+(W*.2)+'" ry="'+(W*.28)+'" fill="url(#wing'+uid+')" style="animation:creatureWing .9s ease-in-out infinite .1s;transform-origin:'+(cx+W*.1)+'px '+cy+'px"/>'
        +'<ellipse cx="'+(cx-W*.26)+'" cy="'+(cy+H*.06)+'" rx="'+(W*.13)+'" ry="'+(W*.16)+'" fill="url(#wing'+uid+')" opacity=".7" style="animation:creatureWing .9s ease-in-out infinite .2s;transform-origin:'+(cx-W*.1)+'px '+cy+'px"/>'
        +'<ellipse cx="'+(cx+W*.26)+'" cy="'+(cy+H*.06)+'" rx="'+(W*.13)+'" ry="'+(W*.16)+'" fill="url(#wing'+uid+')" opacity=".7" style="animation:creatureWing .9s ease-in-out infinite .3s;transform-origin:'+(cx+W*.1)+'px '+cy+'px"/>';
    if(shape==='fairy'){
      special='<circle cx="'+(cx-W*.04)+'" cy="'+(cy-H*.32)+'" r="'+(W*.03)+'" fill="#fff" style="animation:creatureSparkle 1.2s ease-in-out infinite"/>'
        +'<circle cx="'+(cx+W*.06)+'" cy="'+(cy-H*.36)+'" r="'+(W*.02)+'" fill="'+acc+'" style="animation:creatureSparkle 1.6s ease-in-out infinite .3s"/>';
    }
  } else if(shape==='storm'){
    // Şimşek bulutu — gövde üstü yıldırım
    special='<path d="M'+(cx+W*.04)+' '+(cy-H*.4)+' L'+(cx-W*.06)+' '+(cy-H*.22)+' L'+(cx+W*.02)+' '+(cy-H*.22)+' L'+(cx-W*.04)+' '+(cy-H*.06)+' L'+(cx+W*.1)+' '+(cy-H*.28)+' L'+(cx+W*.02)+' '+(cy-H*.28)+' Z" fill="#fde047" stroke="#f59e0b" stroke-width=".5" style="animation:creatureSparkle 0.8s ease-in-out infinite"/>';
  } else if(shape==='cosmic'||shape==='void'||shape==='aurora'){
    // Kozmik halka (dönen)
    back='<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+(W*.44)+'" ry="'+(W*.16)+'" fill="none" stroke="url(#wing'+uid+')" stroke-width="2" opacity=".7" style="animation:creatureRing 4s linear infinite;transform-origin:'+cx+'px '+cy+'px"/>';
    special='<circle cx="'+(cx-W*.3)+'" cy="'+(cy-H*.2)+'" r="'+(W*.025)+'" fill="'+acc+'" style="animation:creatureSparkle 1.5s ease-in-out infinite"/>'
      +'<circle cx="'+(cx+W*.32)+'" cy="'+(cy+H*.1)+'" r="'+(W*.02)+'" fill="#fff" style="animation:creatureSparkle 2s ease-in-out infinite .5s"/>';
  }

  // Ana gövde (3D gradyanlı, yumuşak)
  const bodyShape='<ellipse cx="'+cx+'" cy="'+(cy+H*.06)+'" rx="'+(W*.33)+'" ry="'+(W*.32)+'" fill="url(#body'+uid+')"/>';
  // Karın/göğüs (açık renk)
  const belly='<ellipse cx="'+cx+'" cy="'+(cy+H*.14)+'" rx="'+(W*.2)+'" ry="'+(W*.2)+'" fill="url(#belly'+uid+')"/>';
  // Parlama noktası (3D highlight)
  const shine='<ellipse cx="'+(cx-W*.12)+'" cy="'+(cy-H*.06)+'" rx="'+(W*.1)+'" ry="'+(W*.08)+'" fill="#fff" opacity=".35"/>';

  // Büyük parlak gözler (anime tarzı)
  const eyeY=cy+H*.02, eyeR=W*.085, pupR=W*.045;
  const eyes='<ellipse cx="'+(cx-W*.13)+'" cy="'+eyeY+'" rx="'+eyeR+'" ry="'+(eyeR*1.1)+'" fill="#fff"/>'
    +'<ellipse cx="'+(cx+W*.13)+'" cy="'+eyeY+'" rx="'+eyeR+'" ry="'+(eyeR*1.1)+'" fill="#fff"/>'
    +'<circle cx="'+(cx-W*.12)+'" cy="'+(eyeY+W*.01)+'" r="'+pupR+'" fill="'+c2+'" style="animation:creatureBlink '+blinkD+'s ease-in-out infinite"/>'
    +'<circle cx="'+(cx+W*.14)+'" cy="'+(eyeY+W*.01)+'" r="'+pupR+'" fill="'+c2+'" style="animation:creatureBlink '+blinkD+'s ease-in-out infinite"/>'
    +'<circle cx="'+(cx-W*.105)+'" cy="'+(eyeY-W*.012)+'" r="'+(W*.018)+'" fill="#fff"/>'
    +'<circle cx="'+(cx+W*.155)+'" cy="'+(eyeY-W*.012)+'" r="'+(W*.018)+'" fill="#fff"/>';
  // Pembe yanaklar
  const cheeks='<circle cx="'+(cx-W*.22)+'" cy="'+(cy+H*.12)+'" r="'+(W*.045)+'" fill="#ff9ec4" opacity=".55"/>'
    +'<circle cx="'+(cx+W*.22)+'" cy="'+(cy+H*.12)+'" r="'+(W*.045)+'" fill="#ff9ec4" opacity=".55"/>';
  // Tatlı gülümseme
  const mouth='<path d="M'+(cx-W*.05)+' '+(cy+H*.16)+' Q'+cx+' '+(cy+H*.23)+' '+(cx+W*.05)+' '+(cy+H*.16)+'" stroke="'+c2+'" stroke-width="1.6" fill="none" stroke-linecap="round"/>';

  return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="display:block;margin:0 auto;overflow:visible;filter:drop-shadow(0 3px 10px '+c1+'77);animation:'+bob+'">'
    +defs+aura+back+bodyShape+belly+shine+special+front+eyes+cheeks+mouth+'</svg>';
}

// ── Element ikonu ──
function elementIcon(el){
  const m={'Yıldız':'⭐','Ateş':'🔥','Doğa':'🌿','Hava':'💨','Şimşek':'⚡','Kristal':'💎','Ruh':'👻','Gökkuşağı':'🌈','Derinlik':'🌊','Işık':'✨','Kozmos':'🌌','Boşluk':'🕳️','Enerji':'⚡','Aurora':'🌈','Elmas':'💠'};
  return m[el]||'✨';
}

// ── 🔊 Türe özel premium sesler ──
function creatureSound(soundType){
  const ac=getAC(); if(!ac) return;
  const now=ac.currentTime;
  const play=(freq,start,dur,type,vol)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=type||'sine';o.frequency.value=freq;
    const t=now+start;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol||0.12,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.start(t);o.stop(t+dur+0.02);
  };
  const slide=(f1,f2,start,dur,type,vol)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=type||'sine';
    const t=now+start;
    o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol||0.12,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.start(t);o.stop(t+dur+0.02);
  };
  switch(soundType){
    case 'soft':    // kedi mırıltısı
      play(330,0,0.15,'sine',0.1);play(392,0.1,0.15,'sine',0.1);play(440,0.2,0.2,'sine',0.08); break;
    case 'fierce':  // ateş kükremesi
      slide(180,90,0,0.35,'sawtooth',0.14);play(120,0.1,0.25,'square',0.06); break;
    case 'cute':    // tavşan cıvıltısı
      play(880,0,0.06,'sine',0.1);play(1100,0.06,0.05,'sine',0.1);play(990,0.12,0.07,'sine',0.09); break;
    case 'majestic':// kaplan heybeti
      slide(220,165,0,0.4,'triangle',0.13);play(330,0.15,0.3,'sine',0.07); break;
    case 'epic':    // şimşek/fırtına
      slide(800,200,0,0.15,'sawtooth',0.12);play(100,0.1,0.3,'square',0.1);play(1200,0.05,0.1,'sine',0.08); break;
    case 'crystal': // kristal çınlama
      play(1318,0,0.3,'sine',0.1);play(1568,0.08,0.3,'sine',0.08);play(2093,0.16,0.4,'sine',0.06); break;
    case 'mystic':  // ruh ürpertisi
      slide(440,660,0,0.4,'sine',0.1);slide(660,440,0.2,0.4,'sine',0.07); break;
    case 'magical': // unicorn büyüsü
      [523,659,784,1047,1319].forEach((fr,i)=>play(fr,i*0.07,0.25,'sine',0.09)); break;
    case 'roar':    // ejder kükremesi
      slide(150,70,0,0.5,'sawtooth',0.15);play(90,0.2,0.35,'square',0.08); break;
    case 'fairy':   // peri ışıltısı
      [1047,1319,1568,2093].forEach((fr,i)=>play(fr,i*0.05,0.2,'sine',0.08)); break;
    default:
      play(523,0,0.1,'sine',0.1);play(784,0.08,0.15,'sine',0.08);
  }
}

// ── ✨ Yaratık detay modalı ──
// Özel kozmo geri-doldurma tablosu (eski satın alımlar için element/yetenek/bonus)
const UNIQUE_FALLBACK = {
  uniq_aurora:{element:'Aurora',power:'Renk Cümbüşü · +%8 XP',bonus:{xp:0.08}},  aurora:{element:'Aurora',power:'Renk Cümbüşü · +%8 XP',bonus:{xp:0.08}},
  uniq_ember:{element:'Ateş',power:'Alev Saçar · +%8 Skor',bonus:{score:0.08}},   ember:{element:'Ateş',power:'Alev Saçar · +%8 Skor',bonus:{score:0.08}},
  uniq_tide:{element:'Okyanus',power:'Gelgit Çağırır · +%8 Kaju',bonus:{kaju:0.08}}, tide:{element:'Okyanus',power:'Gelgit Çağırır · +%8 Kaju',bonus:{kaju:0.08}},
  uniq_glow:{element:'Işık',power:'Işık Saçar · +%8 XP',bonus:{xp:0.08}},          glow:{element:'Işık',power:'Işık Saçar · +%8 XP',bonus:{xp:0.08}},
  uniq_star:{element:'Kozmos',power:'Yıldız Tozu Saçar · +%10 XP',bonus:{xp:0.10}}, star:{element:'Kozmos',power:'Yıldız Tozu Saçar · +%10 XP',bonus:{xp:0.10}},
  uniq_prism:{element:'Kristal',power:'Işık Kırar · +%10 Kaju',bonus:{kaju:0.10}},  prism:{element:'Kristal',power:'Işık Kırar · +%10 Kaju',bonus:{kaju:0.10}},
  uniq_bolt:{element:'Enerji',power:'Şimşek Hızı · +%10 Skor',bonus:{score:0.10}},  bolt:{element:'Enerji',power:'Şimşek Hızı · +%10 Skor',bonus:{score:0.10}},
  uniq_nova:{element:'Enerji',power:'Işık Patlatır · +%12 Tümü',bonus:{all:0.12}},  nova:{element:'Enerji',power:'Işık Patlatır · +%12 Tümü',bonus:{all:0.12}},
};

function showCreatureDetail(c,t,rc){
  // Eski özel kozmolarda element/power eksikse, isimden/türden geri doldur
  if(c.unique && (!c.power || !c.element)){
    const guess = UNIQUE_FALLBACK[c.uniqueId] || UNIQUE_FALLBACK[c.kind];
    if(guess){ if(!c.element) c.element = guess.element; if(!c.power) c.power = guess.power; if(!c.bonus) c.bonus = guess.bonus; }
  }
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inn=document.createElement('div'); inn.className='nick-modal koz-detail'; inn.style.maxWidth='300px';
  inn.style.setProperty('--cc',t.c||'#c084fc');
  inn.innerHTML='<div class="koz-detail-hero">'+(c.unique?( c.kind?creatureSVG(c.typeKey,96,{unique:true,kind:c.kind,color:c.color}):'<div style="font-size:64px">'+(c.icon||t.e)+'</div>' ):creatureSVG(c.typeKey,96))+'</div>'
    +'<div class="koz-detail-name" style="color:'+(t.c||'#c084fc')+'">'+esc(c.name||t.n)+'</div>'
    +'<div class="koz-detail-rar" style="color:'+rc+'">'+(RARITY_LABEL[t.r]||t.r)+'</div>'
    +'<div class="koz-detail-desc">'+esc(t.desc||'Gizemli bir kozmo')+'</div>'
    +(()=>{ const b=c.bonus||t.bonus; if(!b) return ''; 
        const parts=[]; 
        if(b.all) parts.push('Tüm kazançlar +%'+Math.round(b.all*100));
        if(b.xp) parts.push('XP +%'+Math.round(b.xp*100));
        if(b.score) parts.push('Skor +%'+Math.round(b.score*100));
        if(b.kaju) parts.push('Kaju +%'+Math.round(b.kaju*100));
        return '<div class="koz-detail-bonus">⚡ Aktifken: '+parts.join(' · ')+'</div>';
      })()
    +'<div class="koz-detail-stats">'
      +'<div class="koz-stat"><span class="koz-stat-ico">'+elementIcon(c.element||t.element)+'</span><span class="koz-stat-lbl">Element</span><span class="koz-stat-val">'+esc(c.element||t.element||'?')+'</span></div>'
      +'<div class="koz-stat"><span class="koz-stat-ico">✨</span><span class="koz-stat-lbl">Yetenek</span><span class="koz-stat-val">'+esc(c.power||t.power||'?')+'</span></div>'
      +'<div class="koz-stat"><span class="koz-stat-ico">⭐</span><span class="koz-stat-lbl">Seviye</span><span class="koz-stat-val">LV '+(c.level||1)+'</span></div>'
      +'<div class="koz-stat"><span class="koz-stat-ico">💝</span><span class="koz-stat-lbl">Kaynak</span><span class="koz-stat-val">'+esc(c.fromName||'Mağaza')+'</span></div>'
    +'</div>'
    +'<button class="koz-detail-sound" id="kozPlaySound">🔊 Sesini Dinle</button>'
    +((c.bonus||c.power)?'<button class="koz-detail-activate" id="kozActivate">⚡ Aktif Et (bonusu kullan)</button>':'')
    +'<div class="nm-actions"><button class="nm-btn nm-cancel" id="kozDetClose">Kapat</button></div>';
  ov.appendChild(inn); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  inn.querySelector('#kozDetClose').addEventListener('click',()=>ov.remove());
  inn.querySelector('#kozPlaySound').addEventListener('click',()=>creatureSound(t.sound));
  // ⚡ Aktif Et — bonusu hero_active_kozmo'ya yaz (oyunlarda etki eder)
  const actBtn = inn.querySelector('#kozActivate');
  if(actBtn){
    // Mevcut aktif mi?
    try{
      const cur = JSON.parse(localStorage.getItem('hero_active_kozmo')||'null');
      if(cur && cur.id === (c._id||c.uniqueId)){ actBtn.textContent='✓ Aktif'; actBtn.classList.add('active'); }
    }catch(e){}
    actBtn.addEventListener('click',()=>{
      try{
        localStorage.setItem('hero_active_kozmo', JSON.stringify({
          id: c._id||c.uniqueId||c.name, name: c.name, power: c.power||(t&&t.power)||null, bonus: c.bonus||null
        }));
        actBtn.textContent='✓ Aktif'; actBtn.classList.add('active');
        creatureSound(t.sound);
        _toast('⚡ '+(c.name||'Kozmo')+' aktif! Bonusu artık oyunlarda geçerli.');
      }catch(e){ _toast('Aktif edilemedi'); }
    });
  }
}

// Rengi açma yardımcısı (3D highlight için)
function lighten(hex){
  try{
    const h=hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
    const lr=Math.min(255,Math.round(r+(255-r)*.4)),lg=Math.min(255,Math.round(g+(255-g)*.4)),lb=Math.min(255,Math.round(b+(255-b)*.4));
    return '#'+lr.toString(16).padStart(2,'0')+lg.toString(16).padStart(2,'0')+lb.toString(16).padStart(2,'0');
  }catch(e){ return hex; }
}


// ── Yumurta gönder (arkadaş profilinden) ─────────────────────
export async function sendEgg(toUid,toName){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Yumurta için giriş gerekli');return;}
  const todayKey='htu_kozmo_'+new Date().toDateString();
  const sentToday=parseInt(localStorage.getItem(todayKey)||'0');
  if(sentToday>=1){
    const pl=Store.getState?Store.getState():{};
    if((pl.kaju||0)<50){_toast('Günlük limit doldu! 50 Kaju ile 1 daha gönderebilirsin.');return;}
    if(!confirm('Günlük limit doldu. 50 Kaju ile gönder?'))return;
    try{await Store.addKaju(-50,'kozmo','egg_send');}catch(e){return;}
  }
  try{
    await fdb.set(fdb.ref(db,'kozmoPending/'+toUid+'/'+st.uid),_noUndef({
      fromUid:st.uid,fromName:st.displayName||'Oyuncu',
      fromAvatar:(st.profile&&st.profile.avatar)||'👤',
      toUid,toName:toName||'Oyuncu',
      sentAt:Date.now(),seed:Math.floor(Date.now()/1000)%997,status:'pending'
    }));
    try{localStorage.setItem(todayKey,String(sentToday+1));}catch(e){}
    // Alıcıya bildirim
    try{await fdb.push(fdb.ref(db,'userNotifs/'+toUid),{type:'gift_kozmo',icon:'🥚',text:(st.displayName||'Bir oyuncu')+' sana kozmo yumurtası gönderdi! Kozmos panelinden kabul et.',ts:Date.now(),fromUid:st.uid});}catch(e){}
    _toast('🥚 Yumurta gönderildi → '+toName+'!');
  }catch(e){_toast('Gönderilemedi: '+(e.message||e));}
}

// ── Kozmos Paneli ─────────────────────────────────────────────
export async function openKozmos(){
  if(document.getElementById('kozmosPanel'))return;
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Kozmos için giriş gerekli');return;}
  const ov=document.createElement('div'); ov.id='kozmosPanel'; ov.className='clan-ov';
  const panel=document.createElement('div'); panel.className='clan-panel';
  panel.style.cssText='border-color:rgba(192,132,252,.35);background:linear-gradient(170deg,#110826,#0a0416)';
  panel.innerHTML=''
    +'<div class="clan-head" style="border-color:rgba(192,132,252,.15)">'
      +'<div class="clan-title" style="background:linear-gradient(90deg,#E040FB,#7C4DFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🥚 KOZMOS</div>'
      +'<button class="clan-x" id="kozClose">✕</button>'
    +'</div>'
    +'<div class="clan-body" id="kozBody"><div class="clan-load">⏳ Yükleniyor…</div></div>';
  ov.appendChild(panel); document.body.appendChild(ov);
  panel.querySelector('#kozClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  await renderKozmos(st,panel.querySelector('#kozBody'));
}

async function renderKozmos(st,box){
  if(!box)return;
  let pending={},eggs={},creatures={};
  try{const s=await fdb.get(fdb.ref(db,'kozmoPending/'+st.uid));pending=s.exists()?s.val():{};}catch(e){}
  try{const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/eggs'));eggs=s.exists()?s.val():{};}catch(e){}
  try{const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/creatures'));creatures=s.exists()?s.val():{};}catch(e){}
  const pendList=Object.entries(pending).filter(([,v])=>v&&v.status==='pending');
  const eggList=Object.entries(eggs);
  const creList=Object.entries(creatures);
  box.innerHTML='';

  // ── Gelen Yumurtalar
  if(pendList.length){
    const sec=mkCard(box,'📬 GELEN YUMURTALAR ('+pendList.length+')','#E040FB');
    pendList.forEach(([uid,e])=>{
      const row=document.createElement('div'); row.className='koz-pend-row';
      row.innerHTML=''
        +'<div class="koz-pend-egg">'+kozmoEggSVG(0,38)+'</div>'
        +'<div class="koz-pend-info">'
          +'<div style="font-weight:800;color:#CE93D8;font-size:12px">'+esc(e.fromName||'?')+'</div>'
          +'<div style="font-size:10px;color:#7d8ab8">sana bir yumurta gönderdi 🥚</div>'
        +'</div>'
        +'<div style="display:flex;flex-direction:column;gap:5px">'
          +'<button class="koz-btn-acc" data-acc="'+uid+'">✅ Kabul</button>'
          +'<button class="koz-btn-rej" data-rej="'+uid+'">✕ Reddet</button>'
        +'</div>';
      row.querySelector('[data-acc]').addEventListener('click',async(ev)=>{
        if(ev.target.disabled) return;
        ev.target.disabled=true; ev.target.textContent='⏳';
        const id='egg_'+Date.now()+'_'+uid.slice(0,6);
        try{
          await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+id),_noUndef({...e,acceptedAt:Date.now(),feedCount:0,ownerId:st.uid}));
          await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+uid),null);
          feedAnim(); await renderKozmos(st,box);
        }catch(err){_toast('Kabul edilemedi');}
      });
      row.querySelector('[data-rej]').addEventListener('click',async()=>{
        try{await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+uid),null); await renderKozmos(st,box);}catch(e){}
      });
      sec.appendChild(row);
    });
  }

  // ── Kuluçka
  if(eggList.length){
    const sec=mkCard(box,'🥚 KULUÇKADA ('+eggList.length+')','#FFD740');
    const grid=document.createElement('div'); grid.className='koz-egg-grid';
    eggList.forEach(([k,egg])=>{
      const phase=kozmoGetPhase(egg.sentAt||egg.acceptedAt||0,egg.feedCount||0);
      const info=PHASE_INFO[phase]||PHASE_INFO[0];
      const pct=Math.round(phase/11*100);
      const fed=egg.feedCount||0;
      const card=document.createElement('div'); card.className='kozmo-egg-mini';
      card.style.setProperty('--kc',info.color);
      // Faz geçiş sesi: ilk kez bu faza ulaştıysa çal
      const phaseKey='htu_eggphase_'+k;
      const lastPhase=parseInt(localStorage.getItem(phaseKey)||'-1');
      if(phase>lastPhase&&lastPhase>=0){
        localStorage.setItem(phaseKey,String(phase));
        // Faz tipine göre ses
        if(phase>=11) setTimeout(()=>sfxHatch(),300);
        else if(phase>=4) setTimeout(()=>{sfxCrack();setTimeout(sfxChirp,200);},300);
        else setTimeout(sfxChirp,300);
      } else if(lastPhase<0){
        localStorage.setItem(phaseKey,String(phase));
      }
      card.innerHTML=kozmoEggSVG(phase,54)
        +'<div class="koz-phase-label" style="color:'+info.color+'">'+esc(info.label)+'</div>'
        +'<div class="koz-phase-desc">'+esc(info.desc)+'</div>'
        +'<div class="koz-egg-from">'+esc(egg.fromName||'?')+'\u2019den</div>'
        +'<button class="koz-egg-del" data-del="'+k+'">🗑 Sil</button>'
        +'<div class="koz-bar"><div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,'+info.color+',#818cf8);border-radius:3px;transition:width .5s"></div></div>'
        +'<div class="koz-bar-txt">%'+pct+' · '+fed+' beslenme</div>'
        +'<button class="koz-feed-btn" data-feed="'+k+'">🍎 Besle</button>'
        +(phase>=11?'<button class="koz-hatch-btn" data-hatch="'+k+'">🎊 Çıkar!</button>':'');
      card.querySelector('[data-feed]').addEventListener('click',async e=>{
        e.stopPropagation();
        const todayKey='htu_feed_'+k+'_'+new Date().toDateString();
        const fedToday=parseInt(localStorage.getItem(todayKey)||'0');
        const feedLimit=(Store.isVip&&Store.isVip())?5:3;   // VIP: +2 ekstra besleme
        // Gunluk besleme dolduysa: Besin Paketi ogesi varsa onunla besle
        let usedItem=false;
        if(fedToday>=feedLimit){
          const foodCount=(Store.getItemCount&&(Store.getItemCount('item_food10')+Store.getItemCount('item_food50')))||0;
          if(foodCount<=0){_toast('Bugun '+feedLimit+' kez besledin. Magazadan 🍎 Besin alarak devam edebilirsin!');return;}
          // Besin ogesini kullan (once 10luk, yoksa 50lik)
          if(Store.getItemCount('item_food10')>0){ await Store.useItem('item_food10'); }
          else if(Store.getItemCount('item_food50')>0){ await Store.useItem('item_food50'); }
          usedItem=true;
        }
        try{
          await fdb.runTransaction(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+k+'/feedCount'),c=>(c||0)+1);
          if(!usedItem) localStorage.setItem(todayKey,String(fedToday+1));
          sfxFeed(); feedAnim();
          if(usedItem){ const rem=(Store.getItemCount('item_food10')+Store.getItemCount('item_food50')); _toast('🍎 Besin kullanildi! Kalan: '+rem); }
          await renderKozmos(st,box);
        }catch(err){_toast('Beslenemedi');}
      });
      const hb=card.querySelector('[data-hatch]');
      if(hb) hb.addEventListener('click',async e=>{e.stopPropagation();await hatchEgg(k,egg,st,box);});
      const eDelB=card.querySelector('[data-del]');
      if(eDelB) eDelB.addEventListener('click',async e=>{e.stopPropagation();if(!confirm('Yumurta silinsin mi?'))return;sfxReject();try{await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+k),null);await renderKozmos(st,box);}catch(err){}});
      card.addEventListener('click',()=>{sfxCrack();showEggModal(k,egg,phase,st,box);});
      grid.appendChild(card);
    });
    sec.appendChild(grid);
  }

  // ── Yaratıklar
  if(creList.length){
    const sec=mkCard(box,'🐾 YARATIKLARIM ('+creList.length+')','#69F0AE');
    const grid=document.createElement('div'); grid.className='koz-cre-grid';
    creList.forEach(([k,c])=>{
      const t=TYPES[c.typeKey]||(FUSION_TYPES.find(x=>x.key===c.typeKey))||{n:c.name||'?',e:c.icon||'🌟',c:c.color||'#c084fc',r:c.rarity||'common',element:c.element,power:c.power,bonus:c.bonus};
      // Eski özel kozmolarda eksik bilgileri geri doldur
      if(c.unique && (!c.power || !c.element)){
        const _g = UNIQUE_FALLBACK[c.uniqueId] || UNIQUE_FALLBACK[c.kind];
        if(_g){ if(!c.element) c.element=_g.element; if(!c.power) c.power=_g.power; if(!c.bonus) c.bonus=_g.bonus; }
      }
      const rc=RARITY_COLOR[t.r]||'#aaa';
      const card=document.createElement('div'); card.className='kozmo-card rar-'+(t.r||'common');
      card.style.cssText='border-color:'+t.c+'44;background:linear-gradient(160deg,rgba(20,10,40,.98),rgba('+hexToRgb(t.c)+', .08))';
      card.innerHTML=''
        +'<div class="koz-cre-svg">'+(c.unique?( c.kind?creatureSVG(c.typeKey,58,{unique:true,kind:c.kind,color:c.color}):'<div style="font-size:40px">'+(c.icon||t.e||'🌟')+'</div>' ):creatureSVG(c.typeKey,58))+'</div>'
        +'<div class="koz-cre-name" style="color:'+t.c+'">'+esc(c.name||t.n)+'</div>'
        +'<div class="koz-cre-rarity" style="color:'+rc+'">'+esc(RARITY_LABEL[t.r]||t.r)+'</div>'
        +(t.element?'<div class="koz-cre-element">'+elementIcon(t.element)+' '+esc(t.element)+'</div>':'')
        +(()=>{ const b=c.bonus||t.bonus; if(!b) return '';
            if(b.all) return '<div class="koz-cre-power">⚡ Tümü +%'+Math.round(b.all*100)+'</div>';
            if(b.xp) return '<div class="koz-cre-power">⚡ XP +%'+Math.round(b.xp*100)+'</div>';
            if(b.score) return '<div class="koz-cre-power">⚡ Skor +%'+Math.round(b.score*100)+'</div>';
            if(b.kaju) return '<div class="koz-cre-power">⚡ Kaju +%'+Math.round(b.kaju*100)+'</div>';
            return '';
          })()
        +'<div class="koz-cre-lv">LV '+(c.level||1)+'</div>';
      const delB=document.createElement('button');delB.className='koz-del-btn';delB.textContent='🗑';delB.title='Sil';
      delB.addEventListener('click',async e=>{e.stopPropagation();if(!confirm('Yaratık silinsin mi?'))return;sfxReject();try{await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+k),null);await renderKozmos(st,box);}catch(err){}});
      card.appendChild(delB);
      // Merge butonu (yalnızca fusion_* veya unique olmayan yaratıklar birleşebilir)
      if(!c.unique){
        const mergeBtn=document.createElement('button'); mergeBtn.className='koz-merge-btn'; mergeBtn.textContent='💥 Birleştir';
        mergeBtn.title='Başka bir kozmoyla birleştir';
        mergeBtn.addEventListener('click',async e=>{
          e.stopPropagation();
          openMergeSelector(k,c,creatures,st,box);
        });
        card.appendChild(mergeBtn);
      }
      // Karta tıkla → detay modalı (yetenek + ses çal)
      card.addEventListener('click',()=>{ c._id=k; creatureSound(t.sound); showCreatureDetail(c,t,rc); });
      grid.appendChild(card);
    });
    sec.appendChild(grid);
  }

  if(!pendList.length&&!eggList.length&&!creList.length){
    const empty=document.createElement('div'); empty.style.cssText='text-align:center;padding:32px 16px';
    empty.innerHTML='<div style="font-size:52px;margin-bottom:12px">🥚</div>'
      +'<div style="font-size:14px;font-weight:800;color:#7d8ab8">Henüz kozmo yok</div>'
      +'<div style="font-size:11px;color:#4a5078;margin-top:8px;line-height:1.6">Arkadaş profilinden yumurta gönder<br>ya da Mağaza\u2019dan sat\u0131n al!</div>';
    box.appendChild(empty);
  }
}

let _hatchLock=false;
async function hatchEgg(eggId,egg,st,box){
  if(_hatchLock){ return; }  // çift tıklama koruması
  if(!confirm('🎊 Yumurta çıkarılsın mı?'))return;
  _hatchLock=true;
  setTimeout(()=>{_hatchLock=false;},2000);
  sfxCrack(); setTimeout(()=>sfxCrack(),180); setTimeout(()=>sfxHatch(),350);
  try{
    const t=randomType(egg.seed||0,egg.minRarity);
    const creId='cre_'+Date.now()+'_'+eggId.slice(0,6);
    // Firebase undefined kabul etmez — tüm alanları güvene al (mağaza/çark yumurtalarında fromUid/sentAt olmayabilir)
    const creature = {
      typeKey: t.key || 'unknown',
      name: t.n || 'Kozmo',
      fromUid: egg.fromUid || st.uid,        // gönderen yoksa sahibi
      fromName: egg.fromName || 'Mağaza',
      bornAt: Date.now(),
      sentAt: egg.sentAt || egg.acceptedAt || Date.now(),
      level: 1, xp: 0,
    };
    // Benzersiz/değerli yumurta alanlarını da taşı (varsa)
    if(egg.unique) creature.unique = true;
    if(egg.kind) creature.kind = egg.kind;
    if(egg.uniqueId) creature.uniqueId = egg.uniqueId;
    if(t.r) creature.rarity = t.r;
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+creId), _noUndef(creature));
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),null);
    feedAnim(); sfxChirp();
    await renderKozmos(st,box);
    _toast('🎊 '+t.e+' '+t.n+' doğdu! ('+esc((RARITY_LABEL[t.r]||t.r))+')');
  }catch(e){_toast('Çıkarılamadı: '+(e.message||e));}
}

// ── 💥 Birleştirme Seçici ────────────────────────────────────────
function openMergeSelector(srcId,src,allCreatures,st,box){
  const others=Object.entries(allCreatures).filter(([k,c])=>k!==srcId&&!c.unique);
  if(!others.length){_toast('Birleştirmek için en az 2 kozmo gerekli!');return;}
  const srcType=TYPES[src.typeKey]||{n:src.name||'?',e:'✨',c:'#c084fc',r:'common'};
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inn=document.createElement('div'); inn.className='nick-modal'; inn.style.maxWidth='310px';
  inn.innerHTML='<div class="nm-title">💥 Birleştirme Seç</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px">'
      +'<div>'+(src.unique?( src.kind?creatureSVG(src.typeKey,44,{unique:true,kind:src.kind,color:src.color}):'<span style="font-size:28px">'+(src.icon||srcType.e)+'</span>' ):creatureSVG(src.typeKey,44))+'</div>'
      +'<span style="font-size:11px;color:'+srcType.c+';font-weight:800">'+esc(src.name||srcType.n)+'</span>'
      +'<span style="color:#c084fc;font-size:18px">+</span>'
      +'<span style="font-size:22px;color:#7d8ab8">❓</span>'
    +'</div>'
    +'<div style="font-size:9px;color:#5d6890;text-align:center;margin-bottom:10px">Birleştirince ebeveynler kaybolur — geri alınamaz!</div>'
    +((Store.getItemCount&&Store.getItemCount('item_fusion')>0)?'<label style="display:flex;align-items:center;gap:7px;padding:8px 10px;margin-bottom:8px;border-radius:10px;background:rgba(232,121,249,.1);border:1px solid rgba(232,121,249,.3);cursor:pointer;font-size:10px;color:#e879f9;font-weight:700"><input type="checkbox" id="useStoneChk" style="width:15px;height:15px"> 💫 Birleştirme Taşı kullan (Görkemli garanti) · '+Store.getItemCount('item_fusion')+' adet</label>':'')
    +'<div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto" id="mergeTargetList"></div>'
    +'<div class="nm-actions" style="margin-top:12px"><button class="nm-btn nm-cancel" id="mergeClose">İptal</button></div>';
  ov.appendChild(inn); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  inn.querySelector('#mergeClose').addEventListener('click',()=>ov.remove());
  const list=inn.querySelector('#mergeTargetList');
  const stoneChk=inn.querySelector('#useStoneChk');
  const _useStone=()=>!!(stoneChk&&stoneChk.checked);
  const _renderRows=()=>{
  list.innerHTML='';
  others.forEach(([k2,c2])=>{
    const t2=TYPES[c2.typeKey]||{n:c2.name||'?',e:'✨',c:'#c084fc',r:'common'};
    const result=getMergeResult(src.typeKey||'',c2.typeKey||'',_useStone());
    const rc=RARITY_COLOR[result.r]||'#aaa';
    const row=document.createElement('button'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:11px;border:1px solid rgba(192,132,252,.2);background:rgba(192,132,252,.06);cursor:pointer;font-family:inherit;width:100%;text-align:left';
    row.innerHTML='<div style="flex-shrink:0">'+(c2.unique?( c2.kind?creatureSVG(c2.typeKey,36,{unique:true,kind:c2.kind,color:c2.color}):'<span style="font-size:24px">'+(c2.icon||t2.e)+'</span>' ):creatureSVG(c2.typeKey,36))+'</div>'
      +'<div style="flex:1"><div style="font-size:10px;font-weight:800;color:'+t2.c+'">'+esc(c2.name||t2.n)+'</div><div style="font-size:8px;color:#5d6890">LV '+(c2.level||1)+' · '+esc(t2.element||'')+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:9px;color:#c084fc">→ '+esc(result.name||result.n||'?')+'</div><div style="font-size:8px;font-weight:800;color:'+rc+'">'+esc(RARITY_LABEL[result.r]||result.r)+'</div></div>';
    row.addEventListener('click',async()=>{
      const usingStone=_useStone();
      ov.remove();
      src._id=srcId; c2._id=k2;
      if(usingStone && Store.getItemCount('item_fusion')>0){ await Store.useItem('item_fusion'); }
      await doMerge(srcId,src,k2,c2,result,st,box);
    });
    list.appendChild(row);
  });
  };
  _renderRows();
  if(stoneChk) stoneChk.addEventListener('change',_renderRows);
}

async function doMerge(id1,c1,id2,c2,resultType,st,box){
  if(!confirm('Birleştirme: '+esc(c1.name||'?')+' + '+esc(c2.name||'?')+' → '+esc(resultType.name||resultType.n||'?')+'\n\nBu işlem geri alınamaz!'))return;
  // ID'leri güvenceye al
  c1._id=c1._id||id1; c2._id=c2._id||id2;
  try{
    showFusionAnimation(c1,c2,resultType,st,box);
  }catch(e){_toast('Birleştirme hatası: '+(e.message||e));}
}
async function showFusionAnimation(c1,c2,resultType,st,box){
  const ov=document.createElement('div'); ov.className='koz-fusion-ov';
  const t1=TYPES[c1.typeKey]||{e:'✨',c:'#c084fc',sound:'soft'}, t2=TYPES[c2.typeKey]||{e:'⚡',c:'#fb923c',sound:'soft'};
  const rc=RARITY_COLOR[resultType.r]||'#FFD740';
  ov.innerHTML='<div class="koz-fusion-stage">'
    +'<div class="koz-fusion-pair">'
      +'<div class="koz-fusion-p left">'+(c1.unique?'<div style="font-size:48px">'+(c1.icon||t1.e)+'</div>':creatureSVG(c1.typeKey,72))+'<div class="koz-fusion-pn" style="color:'+t1.c+'">'+esc(c1.name||t1.n||'?')+'</div></div>'
      +'<div class="koz-fusion-spark">✦</div>'
      +'<div class="koz-fusion-p right">'+(c2.unique?'<div style="font-size:48px">'+(c2.icon||t2.e)+'</div>':creatureSVG(c2.typeKey,72))+'<div class="koz-fusion-pn" style="color:'+t2.c+'">'+esc(c2.name||t2.n||'?')+'</div></div>'
    +'</div>'
    +'<div class="koz-fusion-result" id="fusionResult">'
      +'<div class="koz-fusion-burst" style="--rc:'+rc+'"></div>'
      +'<div class="koz-fusion-hero">'+creatureSVG(resultType.key,110)+'</div>'
      +'<div class="koz-fusion-rn" style="color:'+(resultType.c||'#c084fc')+'">'+esc(resultType.name||resultType.n||'Yeni Kozmo')+'</div>'
      +'<div class="koz-fusion-rr" style="color:'+rc+'">'+esc(RARITY_LABEL[resultType.r]||resultType.r||'')+'</div>'
      +(resultType.power?'<div class="koz-fusion-power">✨ '+esc(resultType.power)+'</div>':'')
    +'</div>'
    +'<div class="koz-fusion-label" id="fusionLabel">⚗️ BİRLEŞİYOR…</div>'
  +'</div>';
  document.body.appendChild(ov);
  // Birleşme sesleri (iki ebeveyn sesi → sonuç sesi)
  creatureSound(t1.sound); setTimeout(()=>creatureSound(t2.sound),300);
  sfxCrack(); setTimeout(()=>sfxCrack(),600);
  // 1.8s: sonucu göster + premium ses
  setTimeout(()=>{
    const res=ov.querySelector('#fusionResult');
    const lbl=ov.querySelector('#fusionLabel');
    if(res) res.classList.add('show');
    if(lbl) lbl.textContent='✨ YENİ KOZMO DOĞDU!';
    sfxHatch(); creatureSound(resultType.sound||'magical');
  },1800);
  // 3.5s: kapat + Firebase
  setTimeout(async()=>{
    ov.remove();
    const creId='cre_fusion_'+Date.now();
    const newCre={
      typeKey:resultType.key||'fusion_cosmic', name:resultType.name||resultType.n||'Fusion',
      rarity:resultType.r||'epic', color:resultType.c||'#c084fc',
      fromUid:st.uid, fromName:'Birleştirme', bornAt:Date.now(), level:Math.max(c1.level||1,c2.level||1),
      xp:0, parents:[c1.typeKey,c2.typeKey], isFusion:true,
    };
    try{
      // Önce ebeveynleri sil, sonra yeni yaratığı ekle (atomik benzeri)
      await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+c1._id),null);
      await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+c2._id),null);
      await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+creId),_noUndef(newCre));
    }catch(e){ console.warn('[fusion]',e); }
    feedAnim();
    await renderKozmos(st,box);
  },3500);
}

function showEggModal(eggId,egg,phase,st,box){
  const info=PHASE_INFO[phase]||PHASE_INFO[0];
  const phHours=PHASE_HOURS[Math.min(phase+1,11)];
  const elapsed=Date.now()-(egg.sentAt||egg.acceptedAt||0)+(egg.feedCount||0)*8*3600000;
  const hoursLeft=Math.max(0,Math.floor((phHours*3600000-elapsed)/3600000));
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inn=document.createElement('div'); inn.className='nick-modal'; inn.style.maxWidth='290px';
  inn.innerHTML=''
    +'<div style="text-align:center;margin-bottom:10px">'+kozmoEggSVG(phase,72)+'</div>'
    +'<div style="font-size:15px;font-weight:900;color:'+info.color+';text-align:center;margin-bottom:4px">'+esc(info.label)+'</div>'
    +'<div style="font-size:10px;color:#7d8ab8;text-align:center;margin-bottom:12px">Faz '+phase+' · '+esc(egg.fromName||'?')+'\u2019den</div>'
    +'<div class="koz-info-box"><div style="font-size:11px;color:#b8b8d8">'+esc(info.desc)+'</div></div>'
    +'<div class="koz-time-box">'+(hoursLeft>0?'Sonraki faz: ~'+hoursLeft+' saat':'<span style="color:#69F0AE">Sonraki faz hazır!</span>')+'</div>'
    +'<div class="nm-actions" style="gap:8px;margin-top:12px"></div>';
  const acts=inn.querySelector('.nm-actions');
  const bFeed=document.createElement('button'); bFeed.className='nm-btn nm-ok'; bFeed.textContent='🍎 Besle (+8sa)';
  bFeed.addEventListener('click',async()=>{
    const tk='htu_feed_'+eggId+'_'+new Date().toDateString();
    const fd=parseInt(localStorage.getItem(tk)||'0');
    const fLim=(Store.isVip&&Store.isVip())?5:3;
    if(fd>=fLim){_toast('Bugün '+fLim+' kez besledin!'+((Store.isVip&&Store.isVip())?'':' 👑 VIP ile +2 hak!'));return;}
    try{await fdb.runTransaction(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId+'/feedCount'),c=>(c||0)+1);localStorage.setItem(tk,String(fd+1));feedAnim();ov.remove();await renderKozmos(st,box);}catch(e){}
  });
  acts.appendChild(bFeed);
  if(phase>=11){
    const bH=document.createElement('button'); bH.className='nm-btn nm-ok'; bH.style.background='linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08))'; bH.style.color='#fbbf24'; bH.style.borderColor='rgba(251,191,36,.35)'; bH.textContent='🎊 ÇIKAR!';
    bH.addEventListener('click',async()=>{ov.remove();await hatchEgg(eggId,egg,st,box);});
    acts.appendChild(bH);
  }
  const bC=document.createElement('button'); bC.className='nm-btn nm-cancel'; bC.textContent='Kapat';
  bC.addEventListener('click',()=>ov.remove()); acts.appendChild(bC);
  ov.appendChild(inn); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
}

function mkCard(parent,title,color){
  const c=document.createElement('div'); c.className='clan-card koz-sec';
  c.innerHTML='<div class="clan-lbl" style="color:'+color+';margin-bottom:10px">'+title+'</div>';
  parent.appendChild(c); return c;
}
function feedAnim(){['⭐','🌟','✨','💫'].forEach((s,i)=>setTimeout(()=>{const e=document.createElement('div');e.textContent=s;e.style.cssText='position:fixed;z-index:9999;font-size:22px;pointer-events:none;left:'+(25+Math.random()*50)+'%;bottom:30%;animation:kozmoConfetti .9s ease-out forwards';document.body.appendChild(e);setTimeout(()=>e.remove(),950);},i*130));}
function hexToRgb(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return r+','+g+','+b;}

export default openKozmos;


// ── 🥚 Kozmo yumurtası ver (çark/ödül kullanır) ──
export async function grantEgg(){
  const st = (window.Hero && window.Hero.Auth && window.Hero.Auth.getState) ? window.Hero.Auth.getState() : null;
  if(!st || !st.uid) return false;
  try{
    const id = 'egg_' + Date.now() + '_' + Math.floor(Math.random()*100000);
    const seed = (Math.random()*0x7fffffff)|0;
    const type = randomType(seed);
    await fdb.set(fdb.ref(db, 'kozmos/'+st.uid+'/eggs/'+id), {
      id, type, acceptedAt: Date.now(), feedCount: 0, ownerId: st.uid,
      source: 'spin'
    });
    return true;
  }catch(e){ console.warn('[kozmo] grantEgg', e); return false; }
}
