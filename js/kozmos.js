// ═══════════════════════════════════════════════════════════════
//  KOZMOS — Hero Oyun Portalı (Goodyedek birebir + geliştirilmiş UI)
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

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
const TYPES={
  nebula_kedi:  {n:'Nebula Kedi',  e:'🐱',c:'#93c5fd',r:'common'},
  lav_tilkisi:  {n:'Lav Tilkisi',  e:'🦊',c:'#fb923c',r:'rare'},
  mandalina_tav:{n:'Mandalina Tav',e:'🐇',c:'#fbbf24',r:'common'},
  bulut_ruhu:   {n:'Bulut Ruhu',   e:'☁️',c:'#e0f2fe',r:'rare'},
  gokk_ruhu:    {n:'Gökk Ruhu',    e:'🌈',c:'#e879f9',r:'legendary'},
  kristal_boc:  {n:'Kristal Böcek',e:'🦋',c:'#67e8f9',r:'rare'},
  nova_kitsune: {n:'Nova Kitsune', e:'✨',c:'#c084fc',r:'rare'},
  kozmik_unicorn:{n:'Kozmik Unicorn',e:'🦄',c:'#ff80ff',r:'epic'},
  derin_ejder:  {n:'Derin Ejder',  e:'🐲',c:'#00ffc8',r:'legendary'},
  peri_ruhu:    {n:'Peri Ruhu',    e:'🧚',c:'#ffb8ff',r:'mythical'},
};
const RARITY_COLOR={common:'#aaa',rare:'#00E5FF',epic:'#c084fc',legendary:'#FFD740',mythical:'#ff80ff'};
const RARITY_LABEL={common:'Sıradan',rare:'Nadir',epic:'Epik',legendary:'Efsanevi',mythical:'Mitolojik'};
const TYPE_KEYS=Object.keys(TYPES);
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

// ── Yumurta gönder (arkadaş profilinden) ─────────────────────
export async function sendEgg(toUid,toName){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Yumurta için giriş gerekli');return;}
  const todayKey='htu_kozmo_'+new Date().toDateString();
  const sentToday=parseInt(localStorage.getItem(todayKey)||'0');
  if(sentToday>=1){
    const pl=Store.getState?Store.getState():{};
    if((pl.kaju||0)<50){alert('Günlük limit doldu! 50 Kaju ile 1 daha gönderebilirsin.');return;}
    if(!confirm('Günlük limit doldu. 50 Kaju ile gönder?'))return;
    try{await Store.addKaju(-50,'kozmo','egg_send');}catch(e){return;}
  }
  try{
    await fdb.set(fdb.ref(db,'kozmoPending/'+toUid+'/'+st.uid),{
      fromUid:st.uid,fromName:st.displayName||'Oyuncu',
      fromAvatar:(st.profile&&st.profile.avatar)||'👤',
      toUid,toName:toName||'Oyuncu',
      sentAt:Date.now(),seed:Math.floor(Date.now()/1000)%997,status:'pending'
    });
    try{localStorage.setItem(todayKey,String(sentToday+1));}catch(e){}
    alert('🥚 Yumurta gönderildi → '+toName+'!');
  }catch(e){alert('Gönderilemedi: '+(e.message||e));}
}

// ── Kozmos Paneli ─────────────────────────────────────────────
export async function openKozmos(){
  if(document.getElementById('kozmosPanel'))return;
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Kozmos için giriş gerekli');return;}
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
      row.querySelector('[data-acc]').addEventListener('click',async()=>{
        const id='egg_'+Date.now()+'_'+uid.slice(0,6);
        try{
          await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+id),{...e,acceptedAt:Date.now(),feedCount:0,ownerId:st.uid});
          await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+uid),null);
          feedAnim(); await renderKozmos(st,box);
        }catch(err){alert('Kabul edilemedi');}
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
      card.innerHTML=kozmoEggSVG(phase,54)
        +'<div class="koz-phase-label" style="color:'+info.color+'">'+esc(info.label)+'</div>'
        +'<div class="koz-phase-desc">'+esc(info.desc)+'</div>'
        +'<div class="koz-egg-from">'+esc(egg.fromName||'?')+'\'den</div>'
        +'<div class="koz-bar"><div style="width:'+pct+'%;height:100%;background:linear-gradient(90deg,'+info.color+',#818cf8);border-radius:3px;transition:width .5s"></div></div>'
        +'<div class="koz-bar-txt">%'+pct+' · '+fed+' beslenme</div>'
        +'<button class="koz-feed-btn" data-feed="'+k+'">🍎 Besle</button>'
        +(phase>=11?'<button class="koz-hatch-btn" data-hatch="'+k+'">🎊 Doğurt!</button>':'');
      card.querySelector('[data-feed]').addEventListener('click',async e=>{
        e.stopPropagation();
        const todayKey='htu_feed_'+k+'_'+new Date().toDateString();
        const fedToday=parseInt(localStorage.getItem(todayKey)||'0');
        if(fedToday>=3){alert('Bugün bu yumurtayı 3 kez besledin. Yarın tekrar!');return;}
        try{
          await fdb.runTransaction(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+k+'/feedCount'),c=>(c||0)+1);
          localStorage.setItem(todayKey,String(fedToday+1));
          feedAnim(); await renderKozmos(st,box);
        }catch(err){alert('Beslenemedi');}
      });
      const hb=card.querySelector('[data-hatch]');
      if(hb) hb.addEventListener('click',async e=>{e.stopPropagation();await hatchEgg(k,egg,st,box);});
      card.addEventListener('click',()=>showEggModal(k,egg,phase,st,box));
      grid.appendChild(card);
    });
    sec.appendChild(grid);
  }

  // ── Yaratıklar
  if(creList.length){
    const sec=mkCard(box,'🐾 YARATIKLARIM ('+creList.length+')','#69F0AE');
    const grid=document.createElement('div'); grid.className='koz-cre-grid';
    creList.forEach(([k,c])=>{
      const t=TYPES[c.typeKey]||{n:'?',e:'🌟',c:'#c084fc',r:'common'};
      const rc=RARITY_COLOR[t.r]||'#aaa';
      const card=document.createElement('div'); card.className='kozmo-card';
      card.style.cssText='border-color:'+t.c+'33;background:linear-gradient(160deg,rgba(20,10,40,.98),rgba('+hexToRgb(t.c)+', .05))';
      card.innerHTML=''
        +'<div class="koz-cre-emoji">'+t.e+'</div>'
        +'<div class="koz-cre-name" style="color:'+t.c+'">'+esc(c.name||t.n)+'</div>'
        +'<div class="koz-cre-rarity" style="color:'+rc+'">'+esc(RARITY_LABEL[t.r]||t.r)+'</div>'
        +'<div class="koz-cre-lv">LV '+(c.level||1)+'</div>'
        +'<div class="koz-cre-from">💝 '+esc(c.fromName||'Mağaza')+'</div>';
      card.addEventListener('click',()=>alert('✨ '+esc(c.name||t.n)+'\n'+esc(RARITY_LABEL[t.r]||t.r)+' · '+esc(t.n)+'\nLV '+(c.level||1)));
      grid.appendChild(card);
    });
    sec.appendChild(grid);
  }

  if(!pendList.length&&!eggList.length&&!creList.length){
    const empty=document.createElement('div'); empty.style.cssText='text-align:center;padding:32px 16px';
    empty.innerHTML='<div style="font-size:52px;margin-bottom:12px">🥚</div>'
      +'<div style="font-size:14px;font-weight:800;color:#7d8ab8">Henüz kozmo yok</div>'
      +'<div style="font-size:11px;color:#4a5078;margin-top:8px;line-height:1.6">Arkadaş profilinden yumurta gönder<br>ya da 🛍️ Mağaza\'dan satın al!</div>';
    box.appendChild(empty);
  }
}

async function hatchEgg(eggId,egg,st,box){
  if(!confirm('🎊 Yumurta doğurulsun mu?'))return;
  try{
    const t=randomType(egg.seed||0,egg.minRarity);
    const creId='cre_'+Date.now()+'_'+eggId.slice(0,6);
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/creatures/'+creId),{
      typeKey:t.key, name:t.n, fromUid:egg.fromUid, fromName:egg.fromName||'?',
      bornAt:Date.now(), sentAt:egg.sentAt, level:1, xp:0,
    });
    await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),null);
    feedAnim(); alert('🎊 '+t.e+' '+t.n+' doğdu! ('+esc((RARITY_LABEL[t.r]||t.r))+')');
    await renderKozmos(st,box);
  }catch(e){alert('Doğurtulamadı: '+(e.message||e));}
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
    +'<div style="font-size:10px;color:#7d8ab8;text-align:center;margin-bottom:12px">Faz '+phase+' · '+esc(egg.fromName||'?')+"'den"+'</div>'
    +'<div class="koz-info-box"><div style="font-size:11px;color:#b8b8d8">'+esc(info.desc)+'</div></div>'
    +'<div class="koz-time-box">'+(hoursLeft>0?'Sonraki faz: ~'+hoursLeft+' saat':'<span style="color:#69F0AE">Sonraki faz hazır!</span>')+'</div>'
    +'<div class="nm-actions" style="gap:8px;margin-top:12px"></div>';
  const acts=inn.querySelector('.nm-actions');
  const bFeed=document.createElement('button'); bFeed.className='nm-btn nm-ok'; bFeed.textContent='🍎 Besle (+8sa)';
  bFeed.addEventListener('click',async()=>{
    const tk='htu_feed_'+eggId+'_'+new Date().toDateString();
    const fd=parseInt(localStorage.getItem(tk)||'0');
    if(fd>=3){alert('Bugün 3 kez besledin!');return;}
    try{await fdb.runTransaction(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId+'/feedCount'),c=>(c||0)+1);localStorage.setItem(tk,String(fd+1));feedAnim();ov.remove();await renderKozmos(st,box);}catch(e){}
  });
  acts.appendChild(bFeed);
  if(phase>=11){
    const bH=document.createElement('button'); bH.className='nm-btn nm-ok'; bH.style.background='linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08))'; bH.style.color='#fbbf24'; bH.style.borderColor='rgba(251,191,36,.35)'; bH.textContent='🎊 DOĞURT!';
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
