// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — KOZMOS YUMURTA SİSTEMİ 🥚
//  Goodyedek'ten birebir: SVG egg, creature, phase render
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>{const v=Number(n);return(Number.isFinite(v)?v:0).toLocaleString('tr-TR');};

// ── Faz bilgisi (Goodyedek birebir) ─────────────────────────
const KOZMO_PHASE_INFO=[
  {label:'Karanlık',color:'#b090f0',mystery:true},
  {label:'Isınıyor~',color:'#a080e8',mystery:true},
  {label:'Sesler!',color:'#c090e8',mystery:true},
  {label:'Renk değişiyor!',color:'#e0a050',mystery:true},
  {label:'İlk Çatlak!',color:'#f5c040',mystery:true},
  {label:'Büyüyor…',color:'#60d8f8',mystery:false},
  {label:'Göz açıldı! 👁',color:'#40d0ff',mystery:false},
  {label:'İki göz! 👀',color:'#c070ff',mystery:false},
  {label:'Baş çıkıyor',color:'#d090ff',mystery:false},
  {label:'Uyuuyor~ 💤',color:'#b080f0',mystery:false},
  {label:'Neredeyse! ✦',color:'#e0a030',mystery:false},
  {label:'DOĞDU! 🎊',color:'#fbbf24',mystery:false},
];
const PHASE_HOURS=[0,6,14,24,36,48,60,72,84,96,108,120];

// ── Faz hesapla ──────────────────────────────────────────────
export function kozmoGetPhase(sentAt,feedBonus){
  const bonus=(feedBonus||0)*8*3600000;
  const elapsed=Date.now()-(sentAt||0)+bonus;
  let phase=0;
  for(let i=0;i<PHASE_HOURS.length;i++){ if(elapsed>=PHASE_HOURS[i]*3600000)phase=i; else break; }
  return Math.min(phase,11);
}

// ── Yaratık türleri (Goodyedek KOZMO_TYPES) ─────────────────
const KOZMO_TYPES={
  nebula_kedi:  {name:'Nebula Kedi',   color:'#93c5fd',rarity:'common'},
  lav_tilkisi:  {name:'Lav Tilkisi',   color:'#fb923c',rarity:'rare'},
  mandalina_tav:{name:'Mandalina Tav', color:'#fbbf24',rarity:'common'},
  bulut_ruhu:   {name:'Bulut Ruhu',    color:'#e0f2fe',rarity:'rare'},
  gokk_ruhu:    {name:'Gökk Ruhu',     color:'#e879f9',rarity:'legendary'},
  kristal_boc:  {name:'Kristal Böcek', color:'#67e8f9',rarity:'rare'},
  nova_kitsune:  {name:'Nova Kitsune',  color:'#c084fc',rarity:'rare'},
  kozmik_unicorn:{name:'Kozmik Unicorn',color:'#ff80ff',rarity:'epic'},
  derin_ejder:   {name:'Derin Ejder',   color:'#00ffc8',rarity:'legendary'},
  peri_ruhu:     {name:'Peri Ruhu',     color:'#ffb8ff',rarity:'mythical'},
};
const TYPE_KEYS=Object.keys(KOZMO_TYPES).filter(k=>!KOZMO_TYPES[k].shopOnly);
export function randomType(seed){
  const weights=TYPE_KEYS.map(k=>({common:6,rare:3,epic:1.5,legendary:0.7,mythical:0.3}[KOZMO_TYPES[k].rarity]||3));
  const total=weights.reduce((a,b)=>a+b,0);
  let r=((seed||Date.now())%1000/1000)*total;
  for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return{key:TYPE_KEYS[i],...KOZMO_TYPES[TYPE_KEYS[i]]};}
  return {key:TYPE_KEYS[0],...KOZMO_TYPES[TYPE_KEYS[0]]};
}

// ── SVG Egg (Goodyedek kozmoEggSVG birebir) ─────────────────
function kozmoEggSVG(phase,size){
  size=size||54;
  const p=KOZMO_PHASE_INFO[phase]||KOZMO_PHASE_INFO[0];
  const anim=phase<4?'kozmoEggPulse':phase<8?'kozmoEggShake':'kozmoEggPulse';
  const dur=[2.5,2.2,2.0,1.8,1.7,1.5,1.5,1.4,1.3,1.2,1.1,1.0][phase]||2;
  const colors=[
    ['#2e1558','#160a35'],['#3a1a68','#160a35'],['#461c78','#160a35'],
    ['#522285','#160a35'],['#5e2490','#160a35'],['#6a2aa0','#160a35'],
    ['#702eb8','#160a35'],['#7830c8','#160a35'],['#7030c0','#160a35'],
    ['#7535c0','#1e0e45'],['#7535c8','#1e0e45'],['#c0a0ff','#3a1860'],
  ];
  const c=colors[phase]||colors[0];
  const strokeC=phase>=10?'rgba(255,215,64,.5)':'rgba(180,130,255,'+(0.25+phase*0.02)+')';
  let extras='';
  if(phase>=4) extras+='<path d="M'+(size*.5)+' '+(size*.16)+' L'+(size*.46)+' '+(size*.3)+' L'+(size*.52)+' '+(size*.38)+'" stroke="rgba(255,215,100,.65)" stroke-width="1.5" fill="none" stroke-linecap="round" style="animation:kozmoCrack '+(2-phase*.1).toFixed(1)+'s ease-in-out infinite"/>';
  if(phase>=5) extras+='<path d="M'+(size*.52)+' '+(size*.38)+' L'+(size*.62)+' '+(size*.44)+'" stroke="rgba(100,220,255,.5)" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  if(phase>=6) extras+='<ellipse cx="'+(size*.4)+'" cy="'+(size*.66)+'" rx="'+(size*.09)+'" ry="'+(size*.07)+'" fill="rgba(0,4,18,.92)"/><circle cx="'+(size*.4)+'" cy="'+(size*.66)+'" r="'+(size*.052)+'" fill="#00d4ff" style="animation:kozmoSparkle 2s ease-in-out infinite"/><circle cx="'+(size*.4)+'" cy="'+(size*.66)+'" r="'+(size*.026)+'" fill="#001525"/><circle cx="'+(size*.42)+'" cy="'+(size*.64)+'" r="'+(size*.018)+'" fill="white" opacity=".9"/>';
  if(phase>=7) extras+='<ellipse cx="'+(size*.6)+'" cy="'+(size*.66)+'" rx="'+(size*.08)+'" ry="'+(size*.07)+'" fill="rgba(0,4,18,.88)"/><circle cx="'+(size*.6)+'" cy="'+(size*.66)+'" r="'+(size*.048)+'" fill="#b060ff" style="animation:kozmoSparkle 2s ease-in-out infinite .5s"/><circle cx="'+(size*.6)+'" cy="'+(size*.66)+'" r="'+(size*.024)+'" fill="#0a0018"/><circle cx="'+(size*.62)+'" cy="'+(size*.64)+'" r="'+(size*.016)+'" fill="white" opacity=".88"/>';
  if(phase>=8&&phase<=10){
    const hx=size*.5,hy=size*.46,hr=size*.3;
    extras+='<circle cx="'+hx+'" cy="'+hy+'" r="'+hr+'" fill="rgba(42,18,80,.9)" stroke="rgba(190,140,255,.28)" stroke-width="1"/>';
    extras+='<path d="M'+(hx-hr*.4)+' '+hy+' Q'+hx+' '+(hy+hr*.2)+' '+(hx+hr*.4)+' '+hy+'" stroke="rgba(190,150,255,.75)" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    extras+='<circle cx="'+(hx-hr*.35)+'" cy="'+(hy-hr*.1)+'" r="'+(size*.09)+'" fill="rgba(255,140,175,.25)"/>';
    extras+='<circle cx="'+(hx+hr*.35)+'" cy="'+(hy-hr*.1)+'" r="'+(size*.09)+'" fill="rgba(255,140,175,.25)"/>';
  }
  if(phase>=11){
    extras+='<circle cx="'+(size*.1)+'" cy="'+(size*.3)+'" r="3" fill="#fbbf24" style="animation:kozmoSparkle 1.5s ease-in-out infinite"/>';
    extras+='<circle cx="'+(size*.9)+'" cy="'+(size*.25)+'" r="2.5" fill="#f9a8d4" style="animation:kozmoSparkle 2s ease-in-out infinite .4s"/>';
    extras+='<text x="'+(size*.05)+'" y="'+(size*.5)+'" font-size="8" fill="rgba(251,191,36,.7)" style="animation:kozmoSparkle 2.5s ease-in-out infinite">✦</text>';
  }
  const cx=size*.5,cy=size*.54,rx=size*.39,ry=size*.46;
  return '<svg width="'+size+'" height="'+(size*1.15)+'" viewBox="0 0 '+size+' '+(size*1.15)+'" style="display:block;margin:0 auto;animation:'+anim+' '+dur+'s ease-in-out infinite;--kgc:'+strokeC+'">'
    +'<defs><radialGradient id="keg'+phase+'s'+size+'" cx="40%" cy="35%"><stop offset="0%" stop-color="'+c[0]+'"/><stop offset="100%" stop-color="'+c[1]+'"/></radialGradient></defs>'
    +'<ellipse cx="'+cx+'" cy="'+cy+'" rx="'+rx+'" ry="'+ry+'" fill="url(#keg'+phase+'s'+size+')" stroke="'+strokeC+'" stroke-width="1.4"/>'
    +extras+'</svg>';
}

// ── Yumurta gönder ───────────────────────────────────────────
export async function sendEgg(toUid,toName){
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Yumurta için giriş gerekli');return;}
  const todayKey='htu_kozmo_'+new Date().toDateString();
  const sentToday=parseInt(localStorage.getItem(todayKey)||'0');
  if(sentToday>=1){
    const pl=Store.getState?Store.getState():{};
    if((pl.kaju||0)<50){alert('Günlük limit doldu! (50 Kaju ile 1 daha)');return;}
    if(!confirm('Günlük limit doldu. 50 Kaju ile gönder?'))return;
    try{await Store.addKaju(-50,'kozmo','egg_send');}catch(e){alert('Kaju hatası');return;}
  }
  try{
    await fdb.set(fdb.ref(db,'kozmoPending/'+toUid+'/'+st.uid),{
      fromUid:st.uid,fromName:st.displayName||'Oyuncu',
      fromAvatar:(st.profile&&st.profile.avatar)||'👤',
      toUid,toName:toName||'Oyuncu',
      sentAt:Date.now(),seed:Math.floor(Date.now()/1000)%1000,status:'pending'
    });
    try{localStorage.setItem(todayKey,String(sentToday+1));}catch(e){}
    alert('🥚 Yumurta gönderildi → '+toName+'!');
  }catch(e){alert('Gönderilemedi: '+(e.message||e));}
}

// ── Kozmos paneli ─────────────────────────────────────────────
export async function openKozmos(){
  if(document.getElementById('kozmosPanel'))return;
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Kozmos için giriş gerekli');return;}
  const ov=document.createElement('div'); ov.id='kozmosPanel'; ov.className='clan-ov';
  const inner=document.createElement('div'); inner.className='clan-panel';
  inner.style.borderColor='rgba(180,130,255,.35)';
  inner.innerHTML='<div class="clan-head"><div class="clan-title koz-title">🥚 KOZMOS</div><button class="clan-x" id="kozClose">✕</button></div><div class="clan-body" id="kozBody"><div class="clan-load">Yükleniyor…</div></div>';
  ov.appendChild(inner); document.body.appendChild(ov);
  inner.querySelector('#kozClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  await renderKozmos(st);
}

async function renderKozmos(st){
  const box=document.getElementById('kozBody'); if(!box)return;
  let pending={},eggs={},creatures={};
  try{const s=await fdb.get(fdb.ref(db,'kozmoPending/'+st.uid));pending=s.exists()?s.val():{};}catch(e){}
  try{const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/eggs'));eggs=s.exists()?s.val():{};}catch(e){}
  try{const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/creatures'));creatures=s.exists()?s.val():{};}catch(e){}
  const pendList=Object.entries(pending).filter(([,v])=>v&&v.status==='pending');
  const eggList=Object.entries(eggs);
  const creList=Object.entries(creatures);
  box.innerHTML='';

  // ── Gelen yumurtalar ──
  if(pendList.length){
    const sec=document.createElement('div'); sec.className='clan-card koz-sec';
    sec.innerHTML='<div class="clan-lbl" style="color:#E040FB">📬 GELEN YUMURTALAR ('+pendList.length+')</div>';
    pendList.forEach(([fromUid,e])=>{
      const row=document.createElement('div'); row.className='koz-pend-row';
      row.innerHTML='<div class="koz-pend-ava">'+esc(e.fromAvatar||'👤')+'</div>'
        +'<div class="koz-pend-info"><b style="color:#CE93D8">'+esc(e.fromName||'?')+'</b> sana yumurta gönderdi 🥚<div style="font-size:9px;color:#6d7aa8">Kabul et → yumurta büyür!</div></div>'
        +'<div style="display:flex;flex-direction:column;gap:4px">'
          +'<button class="clan-btn p" style="padding:5px 10px;font-size:11px" data-acc="'+fromUid+'">✅ Kabul</button>'
          +'<button class="clan-btn r" style="padding:5px 9px;font-size:11px" data-rej="'+fromUid+'">✕ Reddet</button>'
        +'</div>';
      row.querySelector('[data-acc]').addEventListener('click',async()=>{
        const eggId='egg_'+Date.now()+'_'+fromUid.slice(0,6);
        try{
          await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),{...e,acceptedAt:Date.now(),feedCount:0,ownerId:st.uid});
          await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+fromUid),null);
          await renderKozmos(st);
        }catch(err){alert('Kabul edilemedi');}
      });
      row.querySelector('[data-rej]').addEventListener('click',async()=>{
        try{await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+fromUid),null);await renderKozmos(st);}catch(e){}
      });
      sec.appendChild(row);
    });
    box.appendChild(sec);
  }

  // ── Kuluçka ──
  if(eggList.length){
    const sec=document.createElement('div'); sec.className='clan-card koz-sec';
    sec.innerHTML='<div class="clan-lbl" style="color:#FFD740">🥚 KULUÇKA ('+eggList.length+')</div>';
    const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:10px';
    eggList.forEach(([k,egg])=>{
      const phase=kozmoGetPhase(egg.sentAt||egg.acceptedAt||0,egg.feedCount||0);
      const info=KOZMO_PHASE_INFO[phase]||KOZMO_PHASE_INFO[0];
      const pct=Math.round(phase/11*100);
      const card=document.createElement('div'); card.className='kozmo-egg-mini';
      card.innerHTML=kozmoEggSVG(phase,52)
        +'<div style="font-size:6.5px;font-weight:900;color:'+info.color+';margin-top:4px;text-align:center">'+esc(info.label)+'</div>'
        +'<div style="font-size:6px;color:#5060a0;text-align:center">'+esc(egg.fromName||'?')+'</div>'
        +'<div style="height:2px;background:rgba(255,255,255,.06);border-radius:2px;margin:5px 0;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,#c084fc,#818cf8);border-radius:2px"></div></div>'
        +'<button class="clan-btn p" style="width:100%;padding:4px;font-size:9px" data-feed="'+k+'">🍎 Besle</button>';
      card.querySelector('[data-feed]').addEventListener('click',async e=>{
        e.stopPropagation();
        try{
          await fdb.runTransaction(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+k+'/feedCount'),cur=>(cur||0)+1);
          // Besleme animasyonu
          ['⭐','🌟','✨','💫'].forEach((s,i)=>{setTimeout(()=>{const el=document.createElement('div');el.textContent=s;el.style.cssText='position:fixed;z-index:9999;font-size:20px;pointer-events:none;left:'+(30+Math.random()*40)+'%;bottom:35%;animation:kozmoConfetti .9s ease-out forwards';document.body.appendChild(el);setTimeout(()=>el.remove(),950);},i*120);});
          await renderKozmos(st);
        }catch(err){alert('Beslenemedi');}
      });
      card.addEventListener('click',()=>{ const msg=info.label+' ('+pct+'%) — '+esc(egg.fromName||'?')+"'den"; alert('🥚 '+msg); });
      grid.appendChild(card);
    });
    sec.appendChild(grid); box.appendChild(sec);
  }

  // ── Yaratıklar ──
  if(creList.length){
    const sec=document.createElement('div'); sec.className='clan-card koz-sec';
    sec.innerHTML='<div class="clan-lbl" style="color:#69F0AE">🐾 YARATIKLARIM ('+creList.length+')</div>';
    const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:8px';
    creList.forEach(([k,c])=>{
      const t=KOZMO_TYPES[c.typeKey]||{name:'?',color:'#c084fc',rarity:'common'};
      const rarityColor={common:'#aaa',rare:'#00E5FF',epic:'#c084fc',legendary:'#FFD740',mythical:'#ff80ff'}[t.rarity]||'#aaa';
      const card=document.createElement('div'); card.className='kozmo-card';
      card.style.borderColor=t.color+'40';
      card.innerHTML='<div style="font-size:36px;text-align:center;margin-bottom:5px">'+(t.icon||'🌟')+'</div>'
        +'<div style="font-size:10px;font-weight:900;color:'+t.color+';text-align:center">'+esc(c.name||t.name)+'</div>'
        +'<div style="font-size:8px;color:'+rarityColor+';text-align:center;margin-top:2px">'+esc(t.rarity)+' · LV'+(c.level||1)+'</div>'
        +'<div style="font-size:7px;color:#404060;text-align:center;margin-top:4px">💝 '+esc(c.fromName||'?')+'</div>';
      card.addEventListener('click',()=>alert('✨ '+esc(c.name||t.name)+' ('+esc(t.rarity)+') · '+esc(c.fromName||'?')+"'den"));
      grid.appendChild(card);
    });
    sec.appendChild(grid); box.appendChild(sec);
  }

  if(!pendList.length&&!eggList.length&&!creList.length){
    const empty=document.createElement('div'); empty.className='clan-card';
    empty.style.textAlign='center'; empty.style.padding='28px 16px';
    empty.innerHTML='<div style="font-size:44px;margin-bottom:10px">🥚</div>'
      +'<div style="font-size:13px;color:#7d8ab8;font-weight:700">Henüz kozmo yok</div>'
      +'<div style="font-size:11px;color:#555070;margin-top:6px">Arkadaşın profilinden yumurta gönder!</div>';
    box.appendChild(empty);
  }
}

export default openKozmos;
