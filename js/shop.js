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
  {id:'uniq_aether',  name:'Yıldız Bekçisi',    icon:'🌌',color:'#c0b0ff',price:25000, desc:'Uzak galaksilerin gizemli yaratığı. Tek üretim, koleksiyonluk.', rarity:'mythical'},
  {id:'uniq_void',    name:'Karanlık Ejder',    icon:'🐉',color:'#00ffc8',price:50000, desc:'Karanlık bölgelerin nadir sakinlerinden. Ultra nadir, benzersiz baskı.', rarity:'mythical'},
  {id:'uniq_aurora',  name:'Kutup Dansçısı',    icon:'🌠',color:'#f0a0f8',price:35000, desc:'Kuzey ışıklarıyla dans eden efsanevi yaratık. Tek nüsha.', rarity:'legendary'},
  {id:'uniq_phoenix', name:'Kor Kanatları',     icon:'🦅',color:'#fb923c',price:45000, desc:'Ateşin içinden çıkan güçlü bir kanat. Koleksiyonda yalnızca bu kopya.', rarity:'legendary'},
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
    UNIQUE_KOZMOS.forEach(item=>{
      const pl=Store.getState?Store.getState():{};
      const owned=!!_inv[item.id];
      const canBuy=!owned&&(pl.kaju||0)>=item.price;
      const card=document.createElement('div'); card.className='shop-unique-card';
      card.style.setProperty('--uc',item.color);
      card.innerHTML='<div class="shop-unique-badge">✦ UNIQUE</div>'
        +'<div class="shop-unique-creature">'+item.icon+'</div>'
        +'<div class="shop-unique-name" style="color:'+item.color+'">'+esc(item.name)+'</div>'
        +'<div style="font-size:8px;color:#7d8ab8;margin:3px 0 8px;line-height:1.4">'+esc(item.desc)+'</div>'
        +(owned
          ?'<div style="font-size:10px;color:#69F0AE;font-weight:800">✓ Sahibisin</div>'
          :'<button class="shop-unique-btn'+(canBuy?'':' locked')+'">🥜 '+fmt(item.price)+'</button>');
      if(!owned){ const btn=card.querySelector('button'); if(btn) btn.addEventListener('click',()=>buyUniqueKozmo(item)); }
      uGrid.appendChild(card);
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
    });
    renderShop();
    _toast('✨ '+item.icon+' '+item.name+' kozmos koleksiyonuna eklendi!');
  }catch(e){_toast('Satın alınamadı: '+(e.message||e));}
}

export default openShop;
