// ═══════════════════════════════════════════════════════════════
//  KAJU MAĞAZASI — Hero Oyun Portalı
//  Tab: Çerçeve / Tema / Kozmo Yumurtası
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>(Number.isFinite(Number(n))?Number(n):0).toLocaleString('tr-TR');

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
      +'<div class="shop-kaju-badge">💰 '+fmt(pl.kaju)+' Kaju</div>'
      +'<button class="clan-x" id="shopClose">✕</button>'
    +'</div>'
    +'<div class="shop-tabs" id="shopTabs"></div>'
    +'<div class="clan-body" id="shopBody"></div>';
  ov.appendChild(panel); document.body.appendChild(ov);
  panel.querySelector('#shopClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  renderShopTabs();
  renderShop();
}

function renderShopTabs(){
  const box=document.getElementById('shopTabs'); if(!box)return;
  const tabs=[['frames','🖼️ Çerçeve'],['themes','🎨 Tema'],['eggs','🥚 Kozmo Yumurta']];
  box.innerHTML='';
  tabs.forEach(([id,label])=>{
    const b=document.createElement('button');
    b.className='shop-tab-btn'+(id===_tab?' active':'');
    b.textContent=label;
    b.addEventListener('click',()=>{_tab=id;renderShopTabs();renderShop();});
    box.appendChild(b);
  });
}

function renderShop(){
  const box=document.getElementById('shopBody'); if(!box)return;
  const items=SHOP_ITEMS[_tab]||[];
  const st=Auth.getState(); const pl=Store.getState?Store.getState():{};
  box.innerHTML='';

  if(_tab==='eggs'){
    const sec=document.createElement('div'); sec.className='shop-egg-info';
    sec.innerHTML='<div class="clan-lbl" style="color:#E040FB;margin-bottom:8px">🥚 KOZMO YUMURTASI</div>'
      +'<div style="font-size:11px;color:#9fb0d8;line-height:1.6">Bir yumurta satın al → kozmos koleksiyonuna eklenir. Her fazda büyür, 120 saatte doğar!</div>';
    box.appendChild(sec);
    items.forEach(item=>{
      const card=document.createElement('div'); card.className='shop-egg-card';
      card.innerHTML='<div class="shop-egg-ico">'+item.icon+'</div>'
        +'<div class="shop-egg-name">'+esc(item.name)+'</div>'
        +'<div class="shop-egg-desc">'+esc(item.desc)+'</div>'
        +'<button class="shop-buy-btn" data-buy="'+esc(item.id)+'">💰 '+fmt(item.price)+'</button>';
      card.querySelector('[data-buy]').addEventListener('click',async()=>buyEgg(item));
      box.appendChild(card);
    });
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
          :'<button class="shop-btn-buy'+(canBuy?'':' locked')+'">💰 '+fmt(item.price)+'</button>');
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
  if((pl.kaju||0)<item.price){alert('💰 Yetersiz Kaju! Gerekli: '+fmt(item.price));return;}
  if(!confirm(item.icon+' "'+item.name+'" → '+fmt(item.price)+' Kaju harcanacak. Satın al?'))return;
  try{
    await Store.addKaju(-item.price,'shop',item.id);
    const st=Auth.getState();
    await fdb.update(fdb.ref(db,'shopInventory/'+st.uid+'/ownedItems'),{[item.id]:true});
    _inv[item.id]=true;
    await useItem(item);
    renderShop();
  }catch(e){alert('Satın alınamadı: '+(e.message||e));}
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
  }catch(e){alert('Uygulanamadı: '+(e.message||e));}
}

async function buyEgg(item){
  const pl=Store.getState?Store.getState():{};
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Satın almak için giriş gerekli');return;}
  if((pl.kaju||0)<item.price){alert('💰 Yetersiz Kaju!');return;}
  if(!confirm(item.icon+' "'+item.name+'" → '+fmt(item.price)+' Kaju. Satın al?'))return;
  try{
    await Store.addKaju(-item.price,'shop',item.id);
    const eggId='egg_'+Date.now()+'_shop';
    const rarity=item.id==='egg_basic'?'common':item.id==='egg_rare'?'rare':'epic';
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),{
      fromUid:'shop',fromName:'Mağaza',fromAvatar:'🛍️',
      toUid:st.uid,sentAt:Date.now(),acceptedAt:Date.now(),
      seed:Math.floor(Math.random()*999),feedCount:0,
      minRarity:rarity,source:'shop'
    });
    alert('🥚 Yumurta kozmos koleksiyonuna eklendi!');
  }catch(e){alert('Satın alınamadı: '+(e.message||e));}
}

export default openShop;
