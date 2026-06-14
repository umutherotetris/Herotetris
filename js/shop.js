// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — KAJU MAĞAZASI
//  Tema, çerçeve satın al — Kaju ile ödeme, Firebase'e yaz
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');

export const SHOP_ITEMS = {
  frames:[
    {id:'fr_gold',    name:'👑 Altın Çerçeve',   price:1000,  icon:'👑', color:'#FFD740', desc:'Klasik altın parıltı'},
    {id:'fr_diamond', name:'💎 Elmas Çerçeve',   price:5000,  icon:'💎', color:'#00E5FF', desc:'Efsanevi elmas efekti'},
    {id:'fr_fire',    name:'🔥 Ateş Çerçeve',    price:3000,  icon:'🔥', color:'#FF5722', desc:'Animasyonlu ateş çerçeve'},
    {id:'fr_rainbow', name:'🌈 Gökkuşağı',        price:8000,  icon:'🌈', color:'linear-gradient(45deg,#f00,#ff0,#0f0,#0ff,#00f)', desc:'Renk değiştiren çerçeve'},
    {id:'fr_neon',    name:'💜 Neon Çerçeve',     price:2500,  icon:'💜', color:'#CE93D8', desc:'Neon mor parıltı'},
    {id:'fr_cyan',    name:'💙 Siber Mavi',       price:1500,  icon:'💙', color:'#00E5FF', desc:'Siber cyberpunk mavi'},
  ],
  themes:[
    {id:'th_ocean',   name:'🌊 Okyanus',          price:800,   icon:'🌊', bg:'ocean',    desc:'Mavi dalgalar arka plan'},
    {id:'th_galaxy',  name:'🌌 Galaksi',           price:1200,  icon:'🌌', bg:'space',   desc:'Yıldızlı gece gökyüzü'},
    {id:'th_matrix',  name:'💚 Matrix',            price:2000,  icon:'💚', bg:'matrix',  desc:'Yeşil kod yağmuru animasyonu'},
    {id:'th_forest',  name:'🌲 Orman',             price:600,   icon:'🌲', bg:'forest',  desc:'Yeşil doğa ambiyansı'},
    {id:'th_sunset',  name:'🌅 Gün Batımı',        price:900,   icon:'🌅', bg:'sunset',  desc:'Turuncu-mor gradient'},
    {id:'th_ice',     name:'❄️ Buz',               price:1000,  icon:'❄️', bg:'ice',     desc:'Buz mavisi atmosfer'},
  ],
};

// ── Envanter kontrol ──────────────────────────────────────────
async function getInventory(){
  const st = Auth.getState(); if(!st.uid) return {};
  try{
    const s = await fdb.get(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'));
    return s.exists() ? (s.val()||{}) : {};
  }catch(e){ return {}; }
}
async function buyItem(item){
  const st = Auth.getState();
  if(!st.uid||st.status!=='google'){ alert('Satın almak için Google ile giriş yap'); return false; }
  const pl = Store.getState ? Store.getState() : {};
  if((pl.kaju||0) < item.price){ alert(`💰 Yetersiz Kaju! Gerekli: ${fmt(item.price)} · Mevcut: ${fmt(pl.kaju)}`); return false; }
  if(!confirm(`${item.icon} "${item.name}" → ${fmt(item.price)} Kaju harcanacak. Satın al?`)) return false;
  try{
    const ok = await Store.addKaju(-item.price, 'shop', item.id);
    if(!ok){ alert('Kaju düşülemedi'); return false; }
    await fdb.update(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'),{[item.id]:true});
    return true;
  }catch(e){ alert('Satın alınamadı: '+(e.message||e)); return false; }
}

// ── Panel aç ─────────────────────────────────────────────────
export async function openShop(){
  if(document.getElementById('shopPanel')) return;
  const inv = await getInventory();
  const pl = Store.getState ? Store.getState() : {};
  const ov = document.createElement('div'); ov.id='shopPanel'; ov.className='clan-ov';
  ov.innerHTML=`
    <div class="clan-panel" style="border-color:rgba(255,215,64,.35)">
      <div class="clan-head">
        <div class="clan-title" style="color:#ffd86b">🛍️ KAJU MAĞAZASI · <span style="font-size:11px;color:#ffd86b">💰 ${fmt(pl.kaju)} Kaju</span></div>
        <button class="clan-x" id="shopClose">✕</button>
      </div>
      <div class="clan-body" id="shopBody">
        <div class="clan-card"><div class="clan-lbl">🖼️ ÇERÇEVELER</div><div class="shop-grid" id="shopFrames"></div></div>
        <div class="clan-card"><div class="clan-lbl">🎨 PROFİL TEMALARI</div><div class="shop-grid" id="shopThemes"></div></div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#shopClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  renderShopSection('shopFrames', SHOP_ITEMS.frames, inv, 'frame');
  renderShopSection('shopThemes', SHOP_ITEMS.themes, inv, 'theme');
}

function renderShopSection(containerId, items, inv, type){
  const box = document.getElementById(containerId); if(!box) return;
  box.innerHTML = items.map(item=>{
    const owned = !!inv[item.id];
    const st = Auth.getState();
    const pl = Store.getState ? Store.getState() : {};
    const canBuy = !owned && (pl.kaju||0) >= item.price;
    const active = type==='frame'
      ? ((st.profile&&st.profile.frame)===item.id)
      : ((st.profile&&st.profile.profileBg)===item.id.replace('th_',''));
    return `<div class="shop-item${active?' active':''}${owned?' owned':''}" data-id="${esc(item.id)}" data-type="${type}">
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-name">${esc(item.name)}</div>
      <div class="shop-desc">${esc(item.desc)}</div>
      ${owned
        ? `<button class="shop-btn use" data-use="${esc(item.id)}" data-type="${type}">${active?'✓ Aktif':'Kullan'}</button>`
        : `<button class="shop-btn buy${canBuy?'':' locked'}" data-buy="${esc(item.id)}" data-type="${type}">${fmt(item.price)} 💰</button>`}
    </div>`;
  }).join('');
  box.querySelectorAll('[data-buy]').forEach(btn=>btn.addEventListener('click',async()=>{
    const item = items.find(i=>i.id===btn.dataset.buy); if(!item) return;
    const ok = await buyItem(item);
    if(ok){ const inv2=await getInventory(); renderShopSection(containerId,items,inv2,type); }
  }));
  box.querySelectorAll('[data-use]').forEach(btn=>btn.addEventListener('click',async()=>{
    const item = items.find(i=>i.id===btn.dataset.use); if(!item) return;
    const st2 = Auth.getState();
    try{
      if(type==='frame'){
        await fdb.update(fdb.ref(db,'users/'+st2.uid),{frame:item.id});
        if(st2.profile) st2.profile.frame=item.id;
      } else {
        const bgId = item.bg||item.id.replace('th_','');
        await fdb.update(fdb.ref(db,'users/'+st2.uid),{profileBg:bgId});
        if(st2.profile) st2.profile.profileBg=bgId;
        const sm = await import('./profile.js'); sm.applyProfileBg(bgId);
      }
      const inv2=await getInventory(); renderShopSection(containerId,items,inv2,type);
    }catch(e){ alert('Yapılamadı'); }
  }));
}

export default openShop;
