// ═══════════════════════════════════════════════════════════════
//  KAJU MAĞAZASI — Hero Oyun Portalı
//  Tab: Çerçeve / Tema / Kozmo Yumurtası
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';


// Hafif toast helper (alert yerine)
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>(Number.isFinite(Number(n))?Number(n):0).toLocaleString('tr-TR');

// ════════════ 🎁 SANDIKLAR ════════════
const CHESTS = [
  {id:'chest_bronze', name:'Bronz Sandık', icon:'📦', color:'#cd7f32', price:1500,
   desc:'Rastgele ödül: 500-3000 Kaju, çerçeve veya yumurta şansı',
   loot:{kajuMin:500,kajuMax:3000, eggChance:0.15, frameChance:0.10}},
  {id:'chest_silver', name:'Gümüş Sandık', icon:'🎁', color:'#c0c0c0', price:4000,
   desc:'Daha iyi ödül: 1500-7000 Kaju, nadir çerçeve/tema/yumurta',
   loot:{kajuMin:1500,kajuMax:7000, eggChance:0.30, frameChance:0.20, themeChance:0.10}},
  {id:'chest_gold', name:'Altın Sandık', icon:'💰', color:'#ffd700', price:10000,
   desc:'Premium ödül: 4000-18000 Kaju, epik yumurta + boost şansı',
   loot:{kajuMin:4000,kajuMax:18000, eggChance:0.50, epicEgg:true, boostChance:0.25, frameChance:0.30, themeChance:0.20}},
];

// ════════════ ⚡ BOOSTLAR (süreli) ════════════
const BOOSTS = [
  {id:'boost_xp2',   name:'2× XP Rozeti', icon:'⭐', color:'#fbbf24', price:3000,
   type:'xp', mult:2, hours:24, desc:'24 saat boyunca tüm oyunlarda XP iki katı'},
  {id:'boost_kaju2', name:'2× Kaju Rozeti', icon:'🥜', color:'#f59e0b', price:3500,
   type:'kaju', mult:2, hours:24, desc:'24 saat boyunca kazandığın Kaju iki katı'},
  {id:'boost_all15', name:'Altın Dokunuş', icon:'✨', color:'#c084fc', price:6000,
   type:'all', mult:1.5, hours:24, desc:'24 saat XP, Kaju ve Skor %50 artar'},
  {id:'boost_xp2_3d',name:'2× XP (3 Gün)', icon:'🌟', color:'#fbbf24', price:7000,
   type:'xp', mult:2, hours:72, desc:'3 gün boyunca XP iki katı — uzun süreli'},
];

// ════════════ ✨ KOZMETİK / STİL ════════════
const COSMETICS = [
  // Nick efektleri
  {id:'nick_flame',   name:'Alev Nick', icon:'🔥', color:'#ff6b35', price:5000, ckey:'nickEffect', cval:'flame', preview:'flame', desc:'Adın alevli yanıp söner'},
  {id:'nick_neon',    name:'Neon Nick', icon:'💠', color:'#22d3ee', price:5000, ckey:'nickEffect', cval:'neon', preview:'neon', desc:'Adın neon ışıkla parlar'},
  {id:'nick_rainbow', name:'Gökkuşağı Nick', icon:'🌈', color:'#e879f9', price:8000, ckey:'nickEffect', cval:'rainbow', preview:'rainbow', desc:'Adın gökkuşağı renklerinde akar'},
  {id:'nick_gold',    name:'Altın Nick', icon:'👑', color:'#ffd700', price:7000, ckey:'nickEffect', cval:'gold', preview:'gold', desc:'Adın altın parıltıyla görünür'},
  // İsim renkleri
  {id:'color_cyan',   name:'Camgöbeği İsim', icon:'🔵', color:'#22d3ee', price:2500, ckey:'nameColor', cval:'#22d3ee', desc:'İsmin camgöbeği renginde'},
  {id:'color_pink',   name:'Pembe İsim', icon:'🩷', color:'#f472b6', price:2500, ckey:'nameColor', cval:'#f472b6', desc:'İsmin pembe renginde'},
  {id:'color_lime',   name:'Yeşil İsim', icon:'💚', color:'#a3e635', price:2500, ckey:'nameColor', cval:'#a3e635', desc:'İsmin canlı yeşil renginde'},
  // Unvanlar
  {id:'title_legend', name:'"Efsane" Unvanı', icon:'🏆', color:'#ffd700', price:10000, ckey:'title', cval:'Efsane', desc:'Profilinde "Efsane" unvanı görünür'},
  {id:'title_master', name:'"Kozmo Ustası"', icon:'🌌', color:'#c084fc', price:9000, ckey:'title', cval:'Kozmo Ustası', desc:'Profilinde "Kozmo Ustası" unvanı'},
  {id:'title_champ',  name:'"Şampiyon"', icon:'⚔️', color:'#fb923c', price:9000, ckey:'title', cval:'Şampiyon', desc:'Profilinde "Şampiyon" unvanı'},
];

// ════════════ 🛠️ İŞLEVSEL ÖĞELER (envantere eklenir) ════════════
const CONSUMABLES = [
  {id:'item_hint',    name:'İpucu Paketi (×5)', icon:'💡', color:'#fbbf24', price:2000, qty:5, desc:'Kelime ve satrançta 5 ipucu hakkı'},
  {id:'item_undo',    name:'Geri Alma (×5)', icon:'↩️', color:'#60a5fa', price:1800, qty:5, desc:'Oyunlarda 5 ekstra geri alma hakkı'},
  {id:'item_food10',  name:'Besin Paketi (×10)', icon:'🍎', color:'#ef4444', price:1000, qty:10, desc:'Kozmo besleme: 10 yiyecek'},
  {id:'item_food50',  name:'Besin Çuvalı (×50)', icon:'🧺', color:'#dc2626', price:4000, qty:50, desc:'Kozmo besleme: 50 yiyecek (indirimli)'},
  {id:'item_fusion',  name:'Birleştirme Taşı', icon:'💫', color:'#e879f9', price:5000, qty:1, desc:'Bir sonraki birleştirmede daha iyi sonuç şansı'},
];

// ════════════ 💎 PAKETLER / BUNDLE ════════════
const BUNDLES = [
  {id:'bundle_starter', name:'Başlangıç Paketi', icon:'🎒', color:'#34d399', price:5000, origPrice:9000,
   desc:'Yeni başlayanlar için: 1 Nadir Yumurta + 1 Çerçeve + 2× XP (24s)',
   grants:[{type:'egg',rarity:'nadir'},{type:'frame',random:true},{type:'boost',boostId:'boost_xp2'}]},
  {id:'bundle_mega', name:'Mega Paket', icon:'🎆', color:'#c084fc', price:18000, origPrice:30000,
   desc:'1 Epik Yumurta + Altın Dokunuş Boost + 1 Tema + 10000 Kaju',
   grants:[{type:'egg',rarity:'epik'},{type:'boost',boostId:'boost_all15'},{type:'theme',random:true},{type:'kaju',amount:10000}]},
  {id:'bundle_vip', name:'VIP Aylık', icon:'👑', color:'#ffd700', price:25000, origPrice:45000,
   desc:'30 gün her gün 1000 Kaju + kalıcı "VIP" unvanı + 2× XP (3 gün)',
   grants:[{type:'vip',days:30,daily:1000},{type:'title',title:'VIP'},{type:'boost',boostId:'boost_xp2_3d'}]},
];

export const SHOP_ITEMS={
  frames:[
    {id:'fr_none',  name:'Çerçeve Yok',     price:0,    icon:'⭕',color:'transparent',      free:true},
    {id:'fr_gold',  name:'Altın',            price:1000, icon:'👑',color:'#FFD740'},
    {id:'fr_cyan',  name:'Siber Mavi',       price:1500, icon:'💎',color:'#00E5FF'},
    {id:'fr_fire',  name:'Ateş',             price:3000, icon:'🔥',color:'#FF5722'},
    {id:'fr_neon',  name:'Neon Mor',         price:2500, icon:'💜',color:'#CE93D8'},
    {id:'fr_green', name:'Zümrüt',           price:1200, icon:'🌿',color:'#69F0AE'},
    {id:'fr_rainbow',name:'Gökkuşağı',       price:8000, icon:'🌈',color:'rainbow'},
    {id:'fr_silver',name:'Gümüş',            price:800,  icon:'🥈',color:'#B0BEC5'},
    {id:'fr_diamond',name:'Elmas',           price:5000, icon:'💠',color:'#A5F3FC'},
  ],
  themes:[
    {id:'th_default',name:'Varsayılan',      price:0,    icon:'🌌',bg:'',free:true},
    {id:'th_ocean',  name:'Okyanus',         price:800,  icon:'🌊',bg:'ocean'},
    {id:'th_space',  name:'Galaksi',         price:1200, icon:'🚀',bg:'space'},
    {id:'th_matrix', name:'Matrix',          price:2000, icon:'💚',bg:'matrix',animated:true},
    {id:'th_forest', name:'Orman',           price:600,  icon:'🌲',bg:'forest'},
    {id:'th_sunset', name:'Gün Batımı',      price:900,  icon:'🌅',bg:'sunset'},
    {id:'th_ice',    name:'Buz Vadisi',      price:1000, icon:'❄️',bg:'ice'},
  ],
  eggs:[
    {id:'egg_basic', name:'Sıradan Yumurta', price:500,  icon:'🥚',desc:'Rastgele yaratık'},
    {id:'egg_rare',  name:'Nadir Yumurta',   price:2000, icon:'💜',desc:'Nadir+ yaratık garantili'},
    {id:'egg_epic',  name:'Epik Yumurta',    price:5000, icon:'✨',desc:'Epik+ yaratık garantili'},
  ],
};

const BG_MAP={
  ocean:'linear-gradient(160deg,#0d1b4b,#0a3060,#062040)',
  space:'radial-gradient(ellipse at top,#1a1040,#0a0a1e)',
  forest:'linear-gradient(160deg,#0d2b1a,#1a3a20,#0a1e12)',
  sunset:'linear-gradient(160deg,#3a0a20,#6b1a2a,#2a0a40)',
  ice:'linear-gradient(160deg,#0d2040,#1a3060,#0a1830)',
  matrix:'#000800',
};

const UNIQUE_KOZMOS=[
  // ── EFSANEVI ──
  {id:'uniq_aurora',  name:'Kutup Dansçısı',    icon:'🌠',color:'#f0a0f8',price:35000, rarity:'legendary', element:'Aurora',  power:'Renk Cümbüşü',     desc:'Kuzey ışıklarıyla dans eden efsanevi yaratık. Tek nüsha.'},
  {id:'uniq_phoenix', name:'Kor Kanatları',     icon:'🦅',color:'#fb923c',price:45000, rarity:'legendary', element:'Ateş',    power:'Alev Saçar',       desc:'Ateş renkli görkemli kanatlara sahip nadir bir kuş. Koleksiyonda yalnızca bu kopya.'},
  {id:'uniq_leviathan',name:'Derin Leviathan',  icon:'🐋',color:'#22d3ee',price:40000, rarity:'legendary', element:'Okyanus', power:'Gelgit Çağırır',   desc:'Okyanusun en derininde uyuyan kadim dev. Eşi benzeri yok.'},
  {id:'uniq_lumina',  name:'Işıltı Kuşu',       icon:'🕊️',color:'#fde68a',price:42000, rarity:'legendary', element:'Işık',    power:'Işık Saçar',       desc:'Parlak altın tüylere sahip zarif bir ışık kuşu. Tek nüsha.'},
  // ── MITOLOJIK ──
  {id:'uniq_aether',  name:'Yıldız Bekçisi',    icon:'🌌',color:'#c0b0ff',price:25000, rarity:'mythical',  element:'Kozmos',  power:'Yıldız Tozu Saçar',desc:'Uzak galaksilerin gizemli yaratığı. Tek üretim, koleksiyonluk.'},
  {id:'uniq_void',    name:'Karanlık Ejder',    icon:'🐉',color:'#00ffc8',price:50000, rarity:'mythical',  element:'Boşluk',  power:'Karanlığı Yutar',  desc:'Karanlık bölgelerin nadir sakinlerinden. Ultra nadir, benzersiz baskı.'},
  {id:'uniq_swift',   name:'Hız Gezgini',       icon:'💫',color:'#a3e635',price:60000, rarity:'mythical',  element:'Hız',     power:'Şimşek Hızı',      desc:'Göz açıp kapayana dek yer değiştiren çevik bir yaratık. Tek üretim.'},
  {id:'uniq_nova',    name:'Nova Çekirdeği',    icon:'🌀',color:'#e879f9',price:75000, rarity:'mythical',  element:'Enerji',  power:'Işık Patlatır',    desc:'İçinde muazzam parlak enerji barındıran nadir bir çekirdek. En değerli koleksiyon parçası.'},
];

let _inv={}, _tab='frames';

async function loadInv(){
  const st=Auth.getState(); if(!st.uid) return {};
  try{const s=await fdb.get(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'));_inv=s.exists()?s.val():{};} catch(e){_inv={};}
}
function owns(id){return id.endsWith('_none')||id.endsWith('_default')||SHOP_ITEMS.frames.find(f=>f.id===id&&f.free)||SHOP_ITEMS.themes.find(t=>t.id===id&&t.free)||!!_inv[id];}

export async function openShop(){
  if(document.getElementById('shopPanel'))return;
  await loadInv();
  const st=Auth.getState(); const pl=Store.getState?Store.getState():{};
  const ov=document.createElement('div'); ov.id='shopPanel'; ov.className='clan-ov';
  ov.innerHTML='';
  const panel=document.createElement('div'); panel.className='clan-panel shop-panel';
  panel.innerHTML=''
    +'<div class="clan-head">'
      +'<div class="clan-title">🛍️ MAĞAZA</div>'
      +'<div class="shop-kaju-badge">🥜 '+fmt(pl.kaju)+' Kaju</div>'
      +'<button class="clan-x" id="shopClose">✕</button>'
    +'</div>'
    +'<div class="shop-tabs" id="shopTabs"></div>'
    +'<div class="clan-body" id="shopBody"></div>';
  ov.appendChild(panel); document.body.appendChild(ov);
  _injectShopCSS();
  panel.querySelector('#shopClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  renderShopTabs();
  renderShop();
}

// ── 🔊 Mağaza ses efektleri (WebAudio, hafif sentez) ──
let _shopAC = null;
function _ac(){ try{ if(!_shopAC) _shopAC = new (window.AudioContext||window.webkitAudioContext)(); if(_shopAC.state==='suspended') _shopAC.resume(); return _shopAC; }catch(e){ return null; } }
function _beep(freq, dur, type, vol, slideTo){
  const ac=_ac(); if(!ac) return;
  const o=ac.createOscillator(), g=ac.createGain();
  o.type=type||'sine'; o.frequency.value=freq;
  if(slideTo){ o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime+dur); }
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(vol||0.08, ac.currentTime+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+dur);
  o.connect(g); g.connect(ac.destination);
  o.start(); o.stop(ac.currentTime+dur+0.02);
}
const ShopSfx = {
  hover(){ _beep(620, 0.07, 'sine', 0.04, 720); },
  tap(){ _beep(480, 0.09, 'triangle', 0.06, 360); },
  buy(){ // yükselen üçlü akor
    _beep(523, 0.12, 'sine', 0.07);
    setTimeout(()=>_beep(659, 0.12, 'sine', 0.07), 90);
    setTimeout(()=>_beep(784, 0.18, 'sine', 0.08, 880), 180);
  },
  deny(){ _beep(200, 0.18, 'sawtooth', 0.05, 140); },
};

function _injectShopCSS(){
  if(document.getElementById('shopPremiumCSS')) return;
  const s=document.createElement('style'); s.id='shopPremiumCSS';
  s.textContent=`
    /* Sekme satırı — yazı binmesini KESİN önle (yüksek specificity + !important) */
    #shopPanel .shop-panel .shop-tabs,
    .shop-panel .shop-tabs{
      display:flex !important; gap:7px !important; padding:10px 14px 9px !important;
      flex-wrap:nowrap !important; overflow-x:auto !important; overflow-y:hidden !important;
      scrollbar-width:none !important; -ms-overflow-style:none !important;
      width:100% !important; box-sizing:border-box !important;
      border-bottom:1px solid rgba(255,255,255,.06) !important;
      -webkit-overflow-scrolling:touch;
    }
    #shopPanel .shop-tabs::-webkit-scrollbar,
    .shop-panel .shop-tabs::-webkit-scrollbar{ display:none !important; width:0 !important; height:0 !important; }
    #shopPanel .shop-panel .shop-tab-btn,
    .shop-panel .shop-tab-btn{
      flex:0 0 auto !important; white-space:nowrap !important;
      padding:7px 11px !important; border-radius:10px !important;
      border:1px solid rgba(255,255,255,.1) !important; background:rgba(255,255,255,.05) !important;
      color:#9fb0d8 !important; font-size:12px !important; font-weight:800 !important;
      cursor:pointer !important; transition:all .18s !important;
      width:auto !important; min-width:0 !important; max-width:none !important;
      line-height:1.2 !important;
    }
    #shopPanel .shop-panel .shop-tab-btn.active,
    .shop-panel .shop-tab-btn.active{
      background:linear-gradient(135deg,rgba(224,64,251,.3),rgba(124,77,255,.2)) !important;
      border-color:rgba(192,132,252,.55) !important; color:#e9d5ff !important;
      box-shadow:0 2px 12px rgba(124,77,255,.25) !important;
    }
    .shop-panel .shop-tab-btn:active{ transform:scale(.95); }
    /* Başlık satırı taşmasın */
    #shopPanel .shop-panel{ overflow:hidden !important; max-width:100vw !important; }
    #shopPanel #shopTabs{ max-width:100% !important; width:100% !important; box-sizing:border-box !important; overflow-x:auto !important; }
    #shopPanel .clan-head{ flex-wrap:nowrap !important; gap:8px !important; padding:14px 14px 10px !important; }
    #shopPanel .clan-title{ flex-shrink:0 !important; font-size:18px !important; }
    #shopPanel .shop-kaju-badge{ flex:1 1 auto !important; min-width:0 !important; text-align:center !important; overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important; font-size:13px !important; }
    #shopPanel .clan-x{ flex-shrink:0 !important; }

    /* Benzersiz kozmo kartı — premium */
    .shop-unique-card{ position:relative; border-radius:18px; padding:14px 12px 13px; text-align:center;
      background:linear-gradient(160deg, rgba(255,255,255,.04), rgba(0,0,0,.25));
      border:1.5px solid color-mix(in srgb, var(--uc) 45%, transparent);
      box-shadow:0 4px 22px color-mix(in srgb, var(--uc) 18%, transparent), inset 0 1px 0 rgba(255,255,255,.06);
      overflow:hidden; transition:transform .2s cubic-bezier(.2,.8,.3,1), box-shadow .2s; cursor:pointer; }
    .shop-unique-card::before{ content:''; position:absolute; inset:0; border-radius:18px; pointer-events:none;
      background:radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, var(--uc) 22%, transparent), transparent 60%); }
    .shop-unique-card:hover{ transform:translateY(-4px) scale(1.015);
      box-shadow:0 10px 32px color-mix(in srgb, var(--uc) 32%, transparent), inset 0 1px 0 rgba(255,255,255,.1); }
    .shop-unique-card:active{ transform:translateY(-1px) scale(.99); }
    .shop-unique-badge{ display:inline-block; font-size:9px; font-weight:900; letter-spacing:.5px;
      padding:3px 10px; border-radius:20px; margin-bottom:6px; color:#1a1208;
      background:linear-gradient(90deg, #ffd86b, #f0a500); box-shadow:0 2px 8px rgba(240,165,0,.35); }
    .shop-unique-creature{ width:64px; height:64px; margin:2px auto 6px; display:flex; align-items:center; justify-content:center; font-size:40px; }
    .shop-unique-name{ font-size:14px; font-weight:900; letter-spacing:.3px; }
    .shop-unique-btn{ margin-top:9px; width:100%; padding:10px; border-radius:12px; border:none; cursor:pointer;
      font-size:13px; font-weight:900; color:#1a1208; background:linear-gradient(135deg, #ffd86b, #f0a500);
      box-shadow:0 3px 12px rgba(240,165,0,.3); transition:transform .12s, filter .15s; }
    .shop-unique-btn:hover{ filter:brightness(1.08); }
    .shop-unique-btn:active{ transform:scale(.96); }
    .shop-unique-btn.locked{ background:rgba(255,255,255,.08); color:#7d8ab8; box-shadow:none; cursor:not-allowed; }
    /* Satın alınınca ışık dalgası */
    @keyframes shopUqBuy{ 0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--uc) 60%, transparent)} 100%{box-shadow:0 0 0 30px transparent} }
    .shop-unique-card.bought{ animation:shopUqBuy .7s ease-out; }
    /* Nick efekt önizlemeleri */
    .cz-flame{ background:linear-gradient(90deg,#ff6b35,#ffd700,#ff6b35); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; animation:czFlame 2s linear infinite; }
    @keyframes czFlame{ to{ background-position:200% center; } }
    .cz-neon{ color:#22d3ee; text-shadow:0 0 6px #22d3ee,0 0 12px #22d3ee; animation:czNeon 1.5s ease-in-out infinite; }
    @keyframes czNeon{ 0%,100%{ opacity:1; } 50%{ opacity:.6; } }
    .cz-rainbow{ background:linear-gradient(90deg,#ff0000,#ff9900,#ffff00,#33ff00,#00ffff,#3333ff,#cc00ff,#ff0000); background-size:300% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; animation:czRainbow 3s linear infinite; }
    @keyframes czRainbow{ to{ background-position:300% center; } }
    .cz-gold{ background:linear-gradient(90deg,#bf953f,#fcf6ba,#b38728,#fbf5b7,#aa771c); background-size:200% auto; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; animation:czFlame 2.5s linear infinite; }
  `;
  document.head.appendChild(s);
}

function renderShopTabs(){
  const box=document.getElementById('shopTabs'); if(!box)return;
  const tabs=[['chests','🎁 Sandık'],['boosts','⚡ Boost'],['cosmetics','✨ Stil'],['frames','🖼️ Çerçeve'],['themes','🎨 Tema'],['eggs','🥚 Kozmo'],['bundles','💎 Paket']];
  box.innerHTML='';
  tabs.forEach(([id,label])=>{
    const b=document.createElement('button');
    b.className='shop-tab-btn'+(id===_tab?' active':'');
    b.textContent=label;
    b.addEventListener('click',()=>{_tab=id;renderShopTabs();renderShop();});
    box.appendChild(b);
  });
  // Aktif sekmeyi görünür alana kaydır (taşma/gizlenme önlenir)
  const act = box.querySelector('.shop-tab-btn.active');
  if(act){ try{ act.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'}); }catch(e){} }
}

function renderShop(){
  const box=document.getElementById('shopBody'); if(!box)return;
  const items=SHOP_ITEMS[_tab]||[];
  const st=Auth.getState(); const pl=Store.getState?Store.getState():{};
  box.innerHTML='';

  // ── Aktif boost bandı (her sekmede üstte göster)
  _renderActiveBoostBand(box);

  if(_tab==='chests'){ renderChests(box, pl); return; }
  if(_tab==='boosts'){ renderBoosts(box, pl); return; }
  if(_tab==='cosmetics'){ renderCosmetics(box, pl); return; }
  if(_tab==='bundles'){ renderBundles(box, pl); return; }

  if(_tab==='eggs'){
    const intro=document.createElement('div'); intro.className='shop-egg-info';
    intro.innerHTML='<div class="clan-lbl" style="color:#E040FB;margin-bottom:5px">🥚 KOZMO YUMURTASI</div>'
      +'<div style="font-size:10.5px;color:#9fb0d8;line-height:1.6">Satın al → kozmos koleksiyonuna ekle. 120 saatte yavaşça büyür, besleyerek hızlandır!</div>';
    box.appendChild(intro);
    // Normal yumurtalar
    const eggGrid=document.createElement('div'); eggGrid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px';
    items.forEach(item=>{
      // Animasyonlu SVG yumurta
      const phase=item.id==='egg_basic'?0:item.id==='egg_rare'?4:8;
      import('./kozmos.js').then(kz=>{
        const svg=kz.kozmoEggSVG(phase,52);
        card.querySelector('.shop-anim-egg').innerHTML=svg;
      }).catch(()=>{});
      const card=document.createElement('div'); card.className='shop-anim-egg-card';
      card.innerHTML='<div class="shop-anim-egg">'+item.icon+'</div>'
        +'<div style="font-size:10px;font-weight:900;color:#dfe7ff;margin:5px 0 2px">'+esc(item.name)+'</div>'
        +'<div style="font-size:8px;color:#7d8ab8;margin-bottom:8px">'+esc(item.desc)+'</div>'
        +'<button class="shop-buy-btn" data-buy="'+esc(item.id)+'">🥜 '+fmt(item.price)+'</button>';
      card.querySelector('[data-buy]').addEventListener('click',async()=>buyEgg(item));
      eggGrid.appendChild(card);
    });
    box.appendChild(eggGrid);
    // Unique / Benzersiz kozmolar
    const uniqSec=document.createElement('div'); uniqSec.innerHTML='<div class="clan-lbl" style="color:#FFD740;margin-bottom:8px">⭐ BENZERSİZ KOZMO (Tek Üretim)</div>';
    box.appendChild(uniqSec);
    const uGrid=document.createElement('div'); uGrid.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:10px';
    const RAR_LBL={mythical:'MİTOLOJİK',legendary:'EFSANEVİ',epic:'EPİK'};
    UNIQUE_KOZMOS.forEach(item=>{
      const pl=Store.getState?Store.getState():{};
      const owned=!!_inv[item.id];
      const canBuy=!owned&&(pl.kaju||0)>=item.price;
      const card=document.createElement('div'); card.className='shop-unique-card';
      card.style.setProperty('--uc',item.color);
      const rl = RAR_LBL[item.rarity]||'NADİR';
      card.innerHTML='<div class="shop-unique-badge">✦ '+rl+'</div>'
        +'<div class="shop-unique-creature" data-uqanim="'+esc(item.id)+'">'+item.icon+'</div>'
        +'<div class="shop-unique-name" style="color:'+item.color+'">'+esc(item.name)+'</div>'
        +(item.power?'<div style="font-size:8px;color:'+item.color+';font-weight:800;margin-top:2px;opacity:.9">⚡ '+esc(item.power)+'</div>':'')
        +'<div style="font-size:8px;color:#7d8ab8;margin:3px 0 8px;line-height:1.4">'+esc(item.desc)+'</div>'
        +(owned
          ?'<div style="font-size:10px;color:#69F0AE;font-weight:800">✓ Sahibisin</div>'
          :'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(item.price)+'</button>');
      // 🔊 Hover sesi (kart üzerine gelince)
      let _hovT=0;
      card.addEventListener('mouseenter',()=>{ const now=Date.now(); if(now-_hovT>200){ _hovT=now; ShopSfx.hover(); } });
      // Tıklama (kart geneli) — hafif tap sesi
      card.addEventListener('click',()=>ShopSfx.tap());
      if(!owned){
        const btn=card.querySelector('button');
        if(btn) btn.addEventListener('click',(e)=>{
          e.stopPropagation();
          if(!canBuy){ ShopSfx.deny(); return; }
          ShopSfx.buy();
          card.classList.add('bought');
          buyUniqueKozmo(item);
        });
      }
      uGrid.appendChild(card);
      // Animasyonlu SVG yükle (kozmos.js'den)
      import('./kozmos.js').then(kz=>{
        if(kz.uniqueCosmoSVG){
          const slot=card.querySelector('[data-uqanim="'+CSS.escape(item.id)+'"]');
          if(slot) slot.innerHTML=kz.uniqueCosmoSVG(item.icon,64,item.color);
        }
        if(kz.ensureUniqueCSS) kz.ensureUniqueCSS();
      }).catch(()=>{});
    });
    box.appendChild(uGrid);
    return;
  }

  const grid=document.createElement('div'); grid.className='shop-item-grid';
  items.forEach(item=>{
    const owned=owns(item.id);
    const canBuy=!owned&&!item.free&&(pl.kaju||0)>=item.price;
    const isActive=_tab==='frames'
      ? (st.profile&&st.profile.frame)===item.id.replace('fr_','')
      : (st.profile&&st.profile.profileBg)===item.id.replace('th_','');
    const card=document.createElement('div');
    card.className='shop-card'+(owned?' owned':'')+(isActive?' active':'');
    // Önizleme rengi/gradient
    let preview='';
    if(_tab==='frames'){
      const c=item.color;
      if(c==='rainbow') preview='background:linear-gradient(135deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)';
      else if(c&&c!=='transparent') preview='background:'+c;
      else preview='border:2px dashed rgba(255,255,255,.2)';
    } else {
      const bg=BG_MAP[item.bg]||'rgba(255,255,255,.04)';
      preview='background:'+bg;
    }
    card.innerHTML='<div class="shop-preview" style="'+preview+'">'
        +(item.animated?'<div class="shop-anim-badge">✨ ANİMASYON</div>':'')
        +(isActive?'<div class="shop-active-badge">✓ AKTİF</div>':'')
      +'</div>'
      +'<div class="shop-icon-row">'+item.icon+' <span class="shop-item-name">'+esc(item.name)+'</span></div>'
      +(owned
        ?'<button class="shop-btn-use'+(isActive?' is-active':'')+'">'+  (isActive?'✓ Aktif':'Kullan')+'</button>'
        :item.free
          ?'<button class="shop-btn-use">Kullan</button>'
          :'<button class="shop-btn-buy'+(canBuy?'':' locked')+'">🥜 '+fmt(item.price)+'</button>');
    if(owned||item.free){
      card.querySelector('button').addEventListener('click',()=>useItem(item));
    } else {
      card.querySelector('button').addEventListener('click',()=>buyItem(item));
    }
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

async function buyItem(item){
  const pl=Store.getState?Store.getState():{};
  if((pl.kaju||0)<item.price){_toast('🥜 Yetersiz Kaju! Gerekli: '+fmt(item.price));return;}
  if(!confirm(item.icon+' "'+item.name+'" → '+fmt(item.price)+' Kaju harcanacak. Satın al?'))return;
  try{
    await Store.addKaju(-item.price,'shop',item.id);
    const st=Auth.getState();
    await fdb.update(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'),{[item.id]:true});
    _inv[item.id]=true;
    await useItem(item);
    renderShop();
  }catch(e){_toast('Satın alınamadı: '+(e.message||e));}
}

async function useItem(item){
  const st=Auth.getState(); if(!st.uid)return;
  try{
    if(_tab==='frames'){
      const frId=item.id.replace('fr_','');
      await fdb.update(fdb.ref(db,'users/'+st.uid),{frame:frId});
      if(st.profile)st.profile.frame=frId;
    } else {
      const bgId=item.id.replace('th_','');
      await fdb.update(fdb.ref(db,'users/'+st.uid),{profileBg:bgId});
      if(st.profile)st.profile.profileBg=bgId;
      try{const m=await import('./profile.js');m.applyProfileBg(bgId);}catch(e){}
    }
    renderShop();
  }catch(e){_toast('Uygulanamadı: '+(e.message||e));}
}


// ════════════ AKTİF BOOST BANDI ════════════
function _renderActiveBoostBand(box){
  try{
    const boosts = Store.getActiveBoosts ? Store.getActiveBoosts() : [];
    if(!boosts.length) return;
    const band=document.createElement('div');
    band.style.cssText='display:flex;gap:8px;flex-wrap:wrap;padding:9px 11px;margin-bottom:12px;border-radius:12px;background:linear-gradient(135deg,rgba(251,191,36,.12),rgba(245,158,11,.06));border:1px solid rgba(251,191,36,.3)';
    band.innerHTML='<div style="font-size:10px;font-weight:900;color:#fbbf24;width:100%;margin-bottom:2px">⚡ AKTİF BOOSTLAR</div>'
      + boosts.map(b=>{
          const mins=Math.ceil(b.remainMs/60000);
          const tstr = mins>60 ? Math.floor(mins/60)+'s '+(mins%60)+'dk' : mins+' dk';
          const tlabel = b.type==='xp'?'XP':b.type==='kaju'?'Kaju':'Tümü';
          return '<span style="font-size:10px;font-weight:800;color:#fde68a;background:rgba(251,191,36,.15);padding:4px 9px;border-radius:14px">'
            +'×'+b.mult+' '+tlabel+' · ⏳ '+tstr+'</span>';
        }).join('');
    box.appendChild(band);
  }catch(e){}
}

// ════════════ 🎁 SANDIK RENDER ════════════
function renderChests(box, pl){
  const intro=document.createElement('div'); intro.className='shop-egg-info';
  intro.innerHTML='<div class="clan-lbl" style="color:#ffd700;margin-bottom:5px">🎁 GİZEMLİ SANDIKLAR</div>'
    +'<div style="font-size:10.5px;color:#9fb0d8;line-height:1.6">Sandık aç → sürpriz ödül kazan! Kaju, çerçeve, tema, yumurta veya boost çıkabilir. Pahalı sandık = daha iyi ödül şansı.</div>';
  box.appendChild(intro);
  const grid=document.createElement('div'); grid.className='shop-grid';
  CHESTS.forEach(ch=>{
    const canBuy=(pl.kaju||0)>=ch.price;
    const card=document.createElement('div'); card.className='shop-unique-card'; card.style.setProperty('--uc',ch.color);
    card.innerHTML='<div class="shop-unique-creature" style="font-size:48px">'+ch.icon+'</div>'
      +'<div class="shop-unique-name" style="color:'+ch.color+'">'+esc(ch.name)+'</div>'
      +'<div style="font-size:9px;color:#9fb0d8;margin:5px 0 9px;line-height:1.5">'+esc(ch.desc)+'</div>'
      +'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(ch.price)+'</button>';
    const btn=card.querySelector('button');
    card.addEventListener('mouseenter',()=>ShopSfx.hover());
    btn.addEventListener('click',()=>{ if(!canBuy){ShopSfx.deny();return;} openChest(ch); });
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

// ════════════ ⚡ BOOST RENDER ════════════
function renderBoosts(box, pl){
  const intro=document.createElement('div'); intro.className='shop-egg-info';
  intro.innerHTML='<div class="clan-lbl" style="color:#fbbf24;margin-bottom:5px">⚡ GÜÇLENDİRİCİLER</div>'
    +'<div style="font-size:10.5px;color:#9fb0d8;line-height:1.6">Süreli boostlar tüm oyunlarda geçerli. Kozmo bonuslarıyla BİRLİKTE çalışır — çarpanlar çarpılır!</div>';
  box.appendChild(intro);
  const grid=document.createElement('div'); grid.className='shop-grid';
  BOOSTS.forEach(b=>{
    const canBuy=(pl.kaju||0)>=b.price;
    const card=document.createElement('div'); card.className='shop-unique-card'; card.style.setProperty('--uc',b.color);
    card.innerHTML='<div class="shop-unique-badge">'+(b.hours>=72?'⏳ '+(b.hours/24)+' GÜN':'⏳ '+b.hours+' SAAT')+'</div>'
      +'<div class="shop-unique-creature" style="font-size:46px">'+b.icon+'</div>'
      +'<div class="shop-unique-name" style="color:'+b.color+'">'+esc(b.name)+'</div>'
      +'<div style="font-size:9px;color:#9fb0d8;margin:5px 0 9px;line-height:1.5">'+esc(b.desc)+'</div>'
      +'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(b.price)+'</button>';
    const btn=card.querySelector('button');
    card.addEventListener('mouseenter',()=>ShopSfx.hover());
    btn.addEventListener('click',()=>{ if(!canBuy){ShopSfx.deny();return;} buyBoost(b); });
    grid.appendChild(card);
  });
  box.appendChild(grid);
}

// ════════════ ✨ KOZMETİK RENDER ════════════
function renderCosmetics(box, pl){
  const intro=document.createElement('div'); intro.className='shop-egg-info';
  intro.innerHTML='<div class="clan-lbl" style="color:#e879f9;margin-bottom:5px">✨ STİL & GÖRÜNÜM</div>'
    +'<div style="font-size:10.5px;color:#9fb0d8;line-height:1.6">Nick efektleri, isim renkleri ve unvanlar. Sohbet ve liderlikte herkese görünür!</div>';
  box.appendChild(intro);
  const own = Store.getCosmetics ? Store.getCosmetics() : {};
  const grid=document.createElement('div'); grid.className='shop-grid';
  COSMETICS.forEach(cz=>{
    const equipped = own[cz.ckey]===cz.cval;
    const owned = (Store.getInventory&&Store.getInventory()['cz_'+cz.id]) || equipped;
    const canBuy=(pl.kaju||0)>=cz.price;
    const card=document.createElement('div'); card.className='shop-unique-card'; card.style.setProperty('--uc',cz.color);
    // Nick efekti önizlemesi
    let preview='';
    if(cz.preview){ preview='<div class="cz-prev cz-'+cz.preview+'" style="font-size:15px;font-weight:900;margin:4px 0">İsim</div>'; }
    else if(cz.ckey==='nameColor'){ preview='<div style="font-size:15px;font-weight:900;margin:4px 0;color:'+cz.cval+'">İsim</div>'; }
    card.innerHTML='<div class="shop-unique-creature" style="font-size:36px">'+cz.icon+'</div>'
      +preview
      +'<div class="shop-unique-name" style="color:'+cz.color+';font-size:12px">'+esc(cz.name)+'</div>'
      +'<div style="font-size:8px;color:#9fb0d8;margin:4px 0 8px;line-height:1.4">'+esc(cz.desc)+'</div>'
      +(equipped
        ?'<button class="shop-unique-btn" style="background:rgba(105,240,174,.15);color:#69F0AE">✓ Kullanımda</button>'
        : owned
          ?'<button class="shop-unique-btn" data-equip>Kullan</button>'
          :'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(cz.price)+'</button>');
    const btn=card.querySelector('button');
    card.addEventListener('mouseenter',()=>ShopSfx.hover());
    if(equipped){ /* nothing */ }
    else if(owned){ btn.addEventListener('click',()=>equipCosmetic(cz)); }
    else { btn.addEventListener('click',()=>{ if(!canBuy){ShopSfx.deny();return;} buyCosmetic(cz); }); }
    grid.appendChild(card);
  });
  box.appendChild(grid);

  // İşlevsel öğeler bölümü
  const sep=document.createElement('div');
  sep.innerHTML='<div class="clan-lbl" style="color:#60a5fa;margin:16px 0 8px">🛠️ İŞLEVSEL ÖĞELER</div>';
  box.appendChild(sep);
  const grid2=document.createElement('div'); grid2.className='shop-grid';
  CONSUMABLES.forEach(it=>{
    const have=(Store.getItemCount&&Store.getItemCount(it.id))||0;
    const canBuy=(pl.kaju||0)>=it.price;
    const card=document.createElement('div'); card.className='shop-unique-card'; card.style.setProperty('--uc',it.color);
    card.innerHTML='<div class="shop-unique-creature" style="font-size:38px">'+it.icon+'</div>'
      +'<div class="shop-unique-name" style="color:'+it.color+';font-size:12px">'+esc(it.name)+'</div>'
      +(have?'<div style="font-size:9px;color:#69F0AE;font-weight:800;margin-top:2px">Elinde: '+have+'</div>':'')
      +'<div style="font-size:8px;color:#9fb0d8;margin:4px 0 8px;line-height:1.4">'+esc(it.desc)+'</div>'
      +'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(it.price)+'</button>';
    const btn=card.querySelector('button');
    card.addEventListener('mouseenter',()=>ShopSfx.hover());
    btn.addEventListener('click',()=>{ if(!canBuy){ShopSfx.deny();return;} buyConsumable(it); });
    grid2.appendChild(card);
  });
  box.appendChild(grid2);
}

// ════════════ 💎 BUNDLE RENDER ════════════
function renderBundles(box, pl){
  const intro=document.createElement('div'); intro.className='shop-egg-info';
  intro.innerHTML='<div class="clan-lbl" style="color:#c084fc;margin-bottom:5px">💎 ÖZEL PAKETLER</div>'
    +'<div style="font-size:10.5px;color:#9fb0d8;line-height:1.6">Birden fazla premium içerik tek fiyata — indirimli! Sınırlı süre değil, istediğinde al.</div>';
  box.appendChild(intro);
  BUNDLES.forEach(bd=>{
    const canBuy=(pl.kaju||0)>=bd.price;
    const save=bd.origPrice?Math.round((1-bd.price/bd.origPrice)*100):0;
    const card=document.createElement('div'); card.className='shop-unique-card'; card.style.setProperty('--uc',bd.color);
    card.style.marginBottom='12px';
    card.innerHTML=(save?'<div class="shop-unique-badge" style="background:linear-gradient(90deg,#34d399,#10b981)">%'+save+' İNDİRİM</div>':'')
      +'<div class="shop-unique-creature" style="font-size:50px">'+bd.icon+'</div>'
      +'<div class="shop-unique-name" style="color:'+bd.color+'">'+esc(bd.name)+'</div>'
      +'<div style="font-size:10px;color:#cbd5e1;margin:6px 0 9px;line-height:1.6">'+esc(bd.desc)+'</div>'
      +(bd.origPrice?'<div style="font-size:11px;color:#7d8ab8;text-decoration:line-through;margin-bottom:3px">🥜 '+fmt(bd.origPrice)+'</div>':'')
      +'<button class="shop-unique-btn'+(canBuy?'':' locked')+'" style="font-size:14px">🥜 '+fmt(bd.price)+'</button>';
    const btn=card.querySelector('button');
    card.addEventListener('mouseenter',()=>ShopSfx.hover());
    btn.addEventListener('click',()=>{ if(!canBuy){ShopSfx.deny();return;} buyBundle(bd); });
    box.appendChild(card);
  });
}


// ════════════ SATIN ALMA FONKSİYONLARI ════════════
async function buyBoost(b){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  const ok=await Store.spendKaju(b.price,'shop','boost:'+b.id);
  if(!ok){_toast('Yetersiz Kaju');ShopSfx.deny();return;}
  ShopSfx.buy();
  await Store.activateBoost(b.id, b.type, b.mult, b.hours*3600*1000);
  _toast('⚡ '+b.name+' aktif! '+b.hours+' saat geçerli');
  renderShop();
}

async function buyCosmetic(cz){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  const ok=await Store.spendKaju(cz.price,'shop','cosmetic:'+cz.id);
  if(!ok){_toast('Yetersiz Kaju');ShopSfx.deny();return;}
  ShopSfx.buy();
  await Store.addItem('cz_'+cz.id, 1);     // sahiplik işareti
  await Store.setCosmetic(cz.ckey, cz.cval); // direkt kuşan
  _toast('✨ '+cz.name+' alındı ve kullanıma alındı!');
  renderShop();
}
async function equipCosmetic(cz){
  await Store.setCosmetic(cz.ckey, cz.cval);
  ShopSfx.tap();
  _toast('✨ '+cz.name+' kullanımda');
  renderShop();
}

async function buyConsumable(it){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  const ok=await Store.spendKaju(it.price,'shop','item:'+it.id);
  if(!ok){_toast('Yetersiz Kaju');ShopSfx.deny();return;}
  ShopSfx.buy();
  await Store.addItem(it.id, it.qty||1);
  _toast('✓ '+it.name+' envantere eklendi');
  renderShop();
}

// ── Sandık açma (animasyonlu sonuç) ──
async function openChest(ch){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  const ok=await Store.spendKaju(ch.price,'shop','chest:'+ch.id);
  if(!ok){_toast('Yetersiz Kaju');ShopSfx.deny();return;}
  ShopSfx.buy();
  // Ödül hesapla
  const L=ch.loot;
  const rewards=[];
  // Kaju (her zaman)
  const kaju=Math.floor(L.kajuMin + Math.random()*(L.kajuMax-L.kajuMin));
  await Store.addKaju(kaju,'chest','Sandık ödülü');
  rewards.push({icon:'🥜',label:fmt(kaju)+' Kaju',color:'#f59e0b'});
  // Yumurta şansı
  if(L.eggChance && Math.random()<L.eggChance){
    try{ const kz=await import('./kozmos.js'); if(kz.grantEgg){ await kz.grantEgg(L.epicEgg?'epik':'nadir'); rewards.push({icon:'🥚',label:(L.epicEgg?'Epik':'Nadir')+' Yumurta',color:'#E040FB'}); } }catch(e){}
  }
  // Boost şansı
  if(L.boostChance && Math.random()<L.boostChance){
    await Store.activateBoost('chest_xp2','xp',2,24*3600*1000);
    rewards.push({icon:'⭐',label:'2× XP (24s)',color:'#fbbf24'});
  }
  _showChestResult(ch, rewards);
  renderShop();
}

function _showChestResult(ch, rewards){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.8);backdrop-filter:blur(6px)';
  const inn=document.createElement('div');
  inn.style.cssText='background:linear-gradient(160deg,#1a1530,#0f0a20);border:2px solid '+ch.color+';border-radius:24px;padding:28px 24px;max-width:320px;width:88%;text-align:center;box-shadow:0 0 60px '+ch.color+'66';
  inn.innerHTML='<div style="font-size:64px;animation:chestPop .6s cubic-bezier(.2,1.4,.4,1)">'+ch.icon+'</div>'
    +'<div style="font-size:18px;font-weight:900;color:'+ch.color+';margin:6px 0 16px">🎉 Sandık Açıldı!</div>'
    +'<div style="display:flex;flex-direction:column;gap:9px">'
    + rewards.map((r,i)=>'<div style="display:flex;align-items:center;gap:11px;padding:11px 14px;border-radius:13px;background:rgba(255,255,255,.05);border:1px solid '+r.color+'55;animation:chestReward .4s ease-out '+(i*0.15)+'s both"><span style="font-size:26px">'+r.icon+'</span><span style="font-size:15px;font-weight:800;color:'+r.color+'">'+r.label+'</span></div>').join('')
    +'</div>'
    +'<button id="chestOk" style="margin-top:18px;width:100%;padding:12px;border-radius:13px;border:none;cursor:pointer;font-size:14px;font-weight:900;color:#1a1208;background:linear-gradient(135deg,#ffd86b,#f0a500)">Harika!</button>';
  ov.appendChild(inn); document.body.appendChild(ov);
  if(!document.getElementById('chestAnimCSS')){
    const s=document.createElement('style'); s.id='chestAnimCSS';
    s.textContent='@keyframes chestPop{0%{transform:scale(0) rotate(-20deg)}100%{transform:scale(1) rotate(0)}}'
      +'@keyframes chestReward{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}';
    document.head.appendChild(s);
  }
  inn.querySelector('#chestOk').addEventListener('click',()=>{ ShopSfx.tap(); ov.remove(); });
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
}

// ── Bundle satın alma ──
async function buyBundle(bd){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  const ok=await Store.spendKaju(bd.price,'shop','bundle:'+bd.id);
  if(!ok){_toast('Yetersiz Kaju');ShopSfx.deny();return;}
  ShopSfx.buy();
  const got=[];
  for(const g of bd.grants){
    try{
      if(g.type==='egg'){ const kz=await import('./kozmos.js'); if(kz.grantEgg){ await kz.grantEgg(g.rarity); got.push((g.rarity||'')+' yumurta'); } }
      else if(g.type==='boost'){ const b=BOOSTS.find(x=>x.id===g.boostId); if(b){ await Store.activateBoost(b.id,b.type,b.mult,b.hours*3600*1000); got.push(b.name); } }
      else if(g.type==='kaju'){ await Store.addKaju(g.amount,'bundle','Paket Kaju'); got.push(fmt(g.amount)+' Kaju'); }
      else if(g.type==='title'){ await Store.setCosmetic('title',g.title); got.push('"'+g.title+'" unvanı'); }
      else if(g.type==='frame'||g.type==='theme'){
        // rastgele bir çerçeve/tema ver
        const pool=(g.type==='frame'?SHOP_ITEMS.frames:SHOP_ITEMS.themes).filter(x=>!x.free);
        const pick=pool[Math.floor(Math.random()*pool.length)];
        if(pick){ await Store.addItem(pick.id,1); got.push(pick.name); }
      }
      else if(g.type==='vip'){
        // VIP: günlük kaju için işaret koy (daily.js okuyabilir)
        await Store.setCosmetic('vip', JSON.stringify({until:Date.now()+g.days*86400000, daily:g.daily}));
        got.push(g.days+' gün VIP');
      }
    }catch(e){ console.warn('bundle grant', e); }
  }
  _toast('🎆 '+bd.name+' alındı! ('+got.join(', ')+')');
  renderShop();
}

async function buyEgg(item){
  const pl=Store.getState?Store.getState():{};
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  if((pl.kaju||0)<item.price){_toast('🥜 Yetersiz Kaju! Gerekli: '+fmt(item.price));return;}
  // Kendine mi hediye mi?
  await showEggGiftModal(item,st,pl);
}

async function showEggGiftModal(item,st,pl){
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inn=document.createElement('div'); inn.className='nick-modal'; inn.style.maxWidth='300px';
  inn.innerHTML=''
    +'<div class="nm-title">'+item.icon+' '+esc(item.name)+'</div>'
    +'<div style="font-size:12px;color:#9fb0d8;text-align:center;margin-bottom:14px">Kime gönderilsin?</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px">'
      +'<button class="shop-gift-opt" id="eggSelf" style="border-color:rgba(0,229,255,.35);background:rgba(0,229,255,.06)">'
        +'<div style="font-size:24px;margin-bottom:5px">🥚</div>'
        +'<div style="font-size:11px;font-weight:800;color:#00E5FF">Kendime Al</div>'
        +'<div style="font-size:9px;color:#7d8ab8;margin-top:3px">Kozmos\u2019uma ekle</div>'
      +'</button>'
      +'<button class="shop-gift-opt" id="eggGift" style="border-color:rgba(224,64,251,.35);background:rgba(224,64,251,.06)">'
        +'<div style="font-size:24px;margin-bottom:5px">🎁</div>'
        +'<div style="font-size:11px;font-weight:800;color:#E040FB">Arkadaşa Hediye</div>'
        +'<div style="font-size:9px;color:#7d8ab8;margin-top:3px">Nick ile gönder</div>'
      +'</button>'
    +'</div>'
    +'<div id="eggGiftForm" style="display:none;margin-bottom:10px">'
      +'<div class="clan-lbl" style="margin-bottom:5px">Nick ile gönder:</div>'
      +'<input class="clan-in" id="eggGiftNick" placeholder="Alıcı nicknick" maxlength="20" style="width:100%;margin-bottom:7px">'
      +'<div class="clan-msg" id="eggGiftMsg"></div>'
      +'<div class="clan-lbl" style="margin-top:8px;margin-bottom:5px">Veya arkadaşlardan seç:</div>'
      +'<div id="eggFriendList" class="egg-friend-list">⏳ Yükleniyor…</div>'
    +'</div>'
    +'<div class="nm-actions">'
      +'<button class="nm-btn nm-ok" id="eggConfirm">🥜 '+fmt(item.price)+' Kaju Öde</button>'
      +'<button class="nm-btn nm-cancel" id="eggCancel">İptal</button>'
    +'</div>';
  ov.appendChild(inn); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  inn.querySelector('#eggCancel').addEventListener('click',()=>ov.remove());
  let mode='self';
  inn.querySelector('#eggSelf').addEventListener('click',()=>{mode='self';inn.querySelector('#eggGiftForm').style.display='none';inn.querySelector('#eggSelf').style.borderColor='rgba(0,229,255,.6)';inn.querySelector('#eggGift').style.borderColor='rgba(224,64,251,.35)';});
  inn.querySelector('#eggGift').addEventListener('click',()=>{
    mode='gift';
    inn.querySelector('#eggGiftForm').style.display='block';
    inn.querySelector('#eggGift').style.borderColor='rgba(224,64,251,.6)';
    inn.querySelector('#eggSelf').style.borderColor='rgba(0,229,255,.35)';
    loadFriendsForGift(inn,st);
  });
  inn.querySelector('#eggConfirm').addEventListener('click',async()=>{
    if((pl.kaju||0)<item.price){_toast('Yetersiz Kaju!');return;}
    if(mode==='gift'){
      const nick=(inn.querySelector('#eggGiftNick').value||'').trim();
      const msgEl=inn.querySelector('#eggGiftMsg');
      if(!nick){msgEl.textContent='Nick gerekli veya listeden arkadaş seç';msgEl.className='clan-msg bad';return;}
      // Önce seçili uid var mı (arkadaş listesinden)
      const frBox=inn.querySelector('#eggFriendList');
      const selUid=frBox&&frBox.dataset.selUid&&frBox.dataset.selName===nick?frBox.dataset.selUid:null;
      try{
        let toUid=selUid, toName=nick;
        if(!selUid){
          const snap=await fdb.get(fdb.ref(db,'nicks/'+nick.toLowerCase()));
          if(!snap.exists()){msgEl.textContent='Bu nick bulunamadı';msgEl.className='clan-msg bad';return;}
          toUid=snap.val().uid; toName=snap.val().nick||nick;
        }
        if(toUid===st.uid){msgEl.textContent='Kendine hediye için "Kendime Al" seç';msgEl.className='clan-msg bad';return;}
        try{await Store.addKaju(-item.price,'shop',item.id);}catch(e){_toast('Ödeme hatası');return;}
        const rarity=item.id==='egg_basic'?'common':item.id==='egg_rare'?'rare':'epic';
        await fdb.set(fdb.ref(db,'kozmoPending/'+toUid+'/'+st.uid+'_shop_'+Date.now()),{
          fromUid:st.uid,fromName:st.displayName||'Oyuncu',fromAvatar:(st.profile&&st.profile.avatar)||'🎁',
          toUid,toName,sentAt:Date.now(),seed:Math.floor(Math.random()*999),status:'pending',minRarity:rarity,source:'gift'
        });
        try{await fdb.push(fdb.ref(db,'userNotifs/'+toUid),{icon:'🎁',text:(st.displayName||'Bir oyuncu')+' sana '+esc(item.name)+' hediye etti! 🥚',ts:Date.now()});}catch(e){}
        ov.remove(); _toast('🎁 '+esc(item.name)+' → '+toName+' hediye edildi!');
      }catch(e){msgEl.textContent='Hata: '+(e.message||e);msgEl.className='clan-msg bad';}
    } else {
      try{await Store.addKaju(-item.price,'shop',item.id);}catch(e){_toast('Ödeme hatası');return;}
      const rarity=item.id==='egg_basic'?'common':item.id==='egg_rare'?'rare':'epic';
      const eggId='egg_'+Date.now()+'_shop';
      await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),{
        fromUid:'shop',fromName:'Mağaza',fromAvatar:'🛍️',
        toUid:st.uid,sentAt:Date.now(),acceptedAt:Date.now(),
        seed:Math.floor(Math.random()*999),feedCount:0,minRarity:rarity,source:'shop'
      });
      ov.remove(); _toast('🥚 Yumurta kozmos koleksiyonuna eklendi!');
    }
  });
}

async function loadFriendsForGift(modal, st){
  const box = modal.querySelector('#eggFriendList'); if(!box) return;
  try{
    const snap = await fdb.get(fdb.ref(db,'friends/'+st.uid));
    if(!snap.exists()||!Object.keys(snap.val()).length){ box.innerHTML='<div style="font-size:10px;color:#5d6890">Henüz arkadaşın yok</div>'; return; }
    const uids = Object.keys(snap.val()).slice(0,15);
    const rows = await Promise.all(uids.map(async uid=>{
      let name='Arkadaş', ava='👤';
      try{ const u=await fdb.get(fdb.ref(db,'users/'+uid)); if(u.exists()){const v=u.val();name=v.nick||v.name||name;ava=v.avatar||'👤';} }catch(e){}
      return {uid,name,ava};
    }));
    box.innerHTML='';
    rows.forEach(r=>{
      const btn=document.createElement('button'); btn.className='egg-friend-btn';
      btn.innerHTML='<span>'+esc(r.ava)+'</span> <span>'+esc(r.name)+'</span>';
      btn.addEventListener('click',()=>{
        // Nick inputa yaz + vurgula
        const inp=modal.querySelector('#eggGiftNick'); if(inp) inp.value=r.name;
        box.querySelectorAll('.egg-friend-btn').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        // uid'yi sakla
        btn.closest('#eggFriendList').dataset.selUid=r.uid;
        btn.closest('#eggFriendList').dataset.selName=r.name;
      });
      box.appendChild(btn);
    });
  }catch(e){ box.innerHTML='<div style="font-size:10px;color:#5d6890">Yüklenemedi</div>'; }
}

async function buyUniqueKozmo(item){
  const st=Auth.getState(); const pl=Store.getState?Store.getState():{};
  if(!st.uid||st.status!=='google'){_toast('Satın almak için giriş gerekli');return;}
  if((pl.kaju||0)<item.price){_toast('🥜 Yetersiz Kaju! Gerekli: '+fmt(item.price));return;}
  if(!confirm('⭐ "'+item.name+'" → '+fmt(item.price)+' Kaju. Bu UNIQUE kozmoyu satın al?'))return;
  try{
    await Store.addKaju(-item.price,'shop',item.id);
    await fdb.update(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'),{[item.id]:true});
    _inv[item.id]=true;
    // Kozmos koleksiyonuna ekle
    const creId='cre_uniq_'+Date.now();
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+creId),{
      typeKey:'unique_'+item.id, name:item.name, rarity:item.rarity,
      fromUid:'shop', fromName:'Mağaza', bornAt:Date.now(),
      level:1, xp:0, unique:true, uniqueId:item.id,
      icon:item.icon, color:item.color,
      element:item.element||null, power:item.power||null,
    });
    renderShop();
    _toast('✨ '+item.icon+' '+item.name+' kozmos koleksiyonuna eklendi!');
  }catch(e){_toast('Satın alınamadı: '+(e.message||e));}
}

export default openShop;
