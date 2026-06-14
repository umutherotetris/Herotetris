// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — KOZMOS YUMURTA SİSTEMİ 🥚
//  Arkadaşa yumurta gönder, bekle, kabul et, yaratık çıksın
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');

// ── Yaratık türleri ──────────────────────────────────────────
export const KOZMO_TYPES = [
  {id:'dragon',  name:'Ejderha',   icon:'🐉', rarity:'efsane', color:'#FF5722'},
  {id:'fox',     name:'Tilki',     icon:'🦊', rarity:'nadir',  color:'#FF9800'},
  {id:'unicorn', name:'Unicorn',   icon:'🦄', rarity:'efsane', color:'#E040FB'},
  {id:'wolf',    name:'Kurt',      icon:'🐺', rarity:'normal', color:'#7986CB'},
  {id:'cat',     name:'Kedi',      icon:'🐈', rarity:'normal', color:'#4DD0E1'},
  {id:'spirit',  name:'Ruh',       icon:'👻', rarity:'nadir',  color:'#B0BEC5'},
  {id:'phoenix', name:'Zümrüt',    icon:'⚡', rarity:'efsane', color:'#FFD740'},
  {id:'penguin', name:'Penguen',   icon:'🐧', rarity:'normal', color:'#81D4FA'},
];

const PHASE_LABELS = [
  '🥚 Karanlık','🥚 Isınıyor','🥚 Sesler!','🥚 Renk Değişiyor',
  '🥚 Çatlak!','🐣 Büyüyor','🐣 Göz Açıldı','🐣 İki Göz',
  '🐣 Baş Çıkıyor','💤 Uyuyor','✦ Neredeyse!','🎉 DOĞDU!'
];
const PHASE_HOURS = [0,6,14,24,36,48,60,72,84,96,108,120];

export function kozmoGetPhase(sentAt, feedBonus){
  const bonus = (feedBonus||0)*8*3600000;
  const elapsed = Date.now() - sentAt + bonus;
  let phase = 0;
  for(let i=0; i<PHASE_HOURS.length; i++){
    if(elapsed >= PHASE_HOURS[i]*3600000) phase=i; else break;
  }
  return Math.min(phase,11);
}
export function randomType(seed){
  const weights = KOZMO_TYPES.map(t=>t.rarity==='efsane'?1:t.rarity==='nadir'?3:6);
  const total = weights.reduce((a,b)=>a+b,0);
  let r = ((seed||Date.now())%total+total)%total;
  for(let i=0;i<weights.length;i++){ r-=weights[i]; if(r<0) return KOZMO_TYPES[i]; }
  return KOZMO_TYPES[0];
}

// ── Yumurta gönder ───────────────────────────────────────────
export async function sendEgg(toUid, toName){
  const st = Auth.getState();
  if(!st.uid||st.status!=='google'){ alert('Yumurta için giriş gerekli'); return; }
  const todayKey = 'htu_kozmo_'+new Date().toDateString();
  const sentToday = parseInt(localStorage.getItem(todayKey)||'0');
  if(sentToday >= 1){
    const pl = Store.getState ? Store.getState() : {};
    if((pl.kaju||0)<50){ alert('Günlük limit doldu! (50 Kaju ile 1 daha)'); return; }
    if(!confirm('Günlük limit doldu. 50 Kaju ile gönder?')) return;
    const ok = await Store.addKaju(-50,'kozmo','egg_send'); if(!ok) return;
  }
  try{
    const seed = Math.floor(Date.now()/1000)%1000;
    await fdb.set(fdb.ref(db,'kozmoPending/'+toUid+'/'+st.uid),{
      fromUid:st.uid, fromName:st.displayName||'Oyuncu', fromAvatar:st.profile&&st.profile.avatar||'👤',
      toUid, toName: toName||'Oyuncu', sentAt:Date.now(), seed, status:'pending'
    });
    try{ localStorage.setItem(todayKey,String(sentToday+1)); }catch(e){}
    alert(`🥚 Yumurta gönderildi → ${toName}!`);
  }catch(e){ alert('Gönderilemedi'); }
}

// ── Kozmos paneli ────────────────────────────────────────────
export async function openKozmos(){
  if(document.getElementById('kozmosPanel')) return;
  const st = Auth.getState();
  if(!st.uid||st.status!=='google'){ alert('Kozmos için giriş gerekli'); return; }
  const ov=document.createElement('div'); ov.id='kozmosPanel'; ov.className='clan-ov';
  ov.innerHTML=`
    <div class="clan-panel" style="border-color:rgba(180,130,255,.35)">
      <div class="clan-head">
        <div class="clan-title" style="background:linear-gradient(90deg,#E040FB,#7C4DFF);-webkit-background-clip:text;-webkit-text-fill-color:transparent">🥚 KOZMOS</div>
        <button class="clan-x" id="kozClose">✕</button>
      </div>
      <div class="clan-body" id="kozBody"><div class="clan-load">Yükleniyor…</div></div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#kozClose').addEventListener('click',()=>ov.remove());
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  await renderKozmos();
}

async function renderKozmos(){
  const box=document.getElementById('kozBody'); if(!box) return;
  const st=Auth.getState();
  let pending={}, eggs={}, creatures={};
  try{ const s=await fdb.get(fdb.ref(db,'kozmoPending/'+st.uid)); pending=s.exists()?s.val():{} }catch(e){}
  try{ const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/eggs')); eggs=s.exists()?s.val():{} }catch(e){}
  try{ const s=await fdb.get(fdb.ref(db,'kozmos/'+st.uid+'/creatures')); creatures=s.exists()?s.val():{} }catch(e){}

  const pendingList = Object.entries(pending).filter(([,v])=>v&&v.status==='pending');
  const eggList = Object.entries(eggs);
  const creatureList = Object.entries(creatures);

  box.innerHTML = `
    ${pendingList.length ? `<div class="clan-card">
      <div class="clan-lbl" style="color:#E040FB">📬 GELEN YUMURTALAR (${pendingList.length})</div>
      ${pendingList.map(([uid,e])=>`
        <div class="koz-pending" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
          <div style="font-size:22px">${esc(e.fromAvatar||'👤')}</div>
          <div style="flex:1"><b style="color:#CE93D8">${esc(e.fromName||'?')}</b> yumurta gönderdi 🥚<div style="font-size:9px;color:#7d8ab8">Reddedersen kaybolur, kabul edersen büyür!</div></div>
          <button class="clan-btn p" style="padding:5px 10px;font-size:11px" data-acc="${esc(uid)}">✅ Kabul</button>
          <button class="clan-btn r" style="padding:5px 9px;font-size:11px" data-rej="${esc(uid)}">✕</button>
        </div>`).join('')}
    </div>` : ''}
    ${eggList.length ? `<div class="clan-card">
      <div class="clan-lbl" style="color:#FFD740">🥚 KULUÇKA (${eggList.length})</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${eggList.map(([k,e])=>{
          const phase=kozmoGetPhase(e.sentAt||0,e.feedCount||0);
          const pct=Math.round(phase/11*100);
          const mystery=phase<5;
          const type=mystery?null:randomType(e.seed||0);
          return `<div class="koz-egg" data-ekey="${esc(k)}">
            <div class="koz-egg-ico">${mystery?'🥚':type.icon}</div>
            <div class="koz-phase">${esc(PHASE_LABELS[phase])}</div>
            <div class="koz-bar"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#E040FB,#7C4DFF);border-radius:3px"></div></div>
            <div style="font-size:9px;color:#7d8ab8">${pct}% · ${mystery?'Gizemli':'Tür: '+esc(type.name)}</div>
            <button class="clan-btn p" style="width:100%;padding:5px;font-size:10px;margin-top:5px" data-feed="${esc(k)}">🍎 Besle (8sa hızlan)</button>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
    ${creatureList.length ? `<div class="clan-card">
      <div class="clan-lbl" style="color:#69F0AE">🐾 YARATIKLARIM (${creatureList.length})</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${creatureList.map(([k,c])=>{
          const t=KOZMO_TYPES.find(x=>x.id===c.typeId)||KOZMO_TYPES[0];
          return `<div class="koz-creature" style="border-color:${t.color}20">
            <div style="font-size:28px">${t.icon}</div>
            <div style="font-size:10px;font-weight:800;color:${t.color}">${esc(c.name||t.name)}</div>
            <div style="font-size:8px;color:#7d8ab8">LV ${c.level||1} · ${esc(t.rarity)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
    ${!pendingList.length&&!eggList.length&&!creatureList.length?`<div class="clan-card" style="text-align:center;padding:20px">
      <div style="font-size:36px;margin-bottom:8px">🥚</div>
      <div style="font-size:13px;color:#7d8ab8">Henüz kozmo yok</div>
      <div style="font-size:11px;color:#555070;margin-top:6px">Arkadaşının profilinden yumurta gönder!</div>
    </div>` : ''}`;

  // Kabul
  box.querySelectorAll('[data-acc]').forEach(btn=>btn.addEventListener('click',async()=>{
    const fromUid=btn.dataset.acc;
    const e=pending[fromUid]; if(!e) return;
    const eggId='egg_'+Date.now()+'_'+fromUid.slice(0,6);
    try{
      await fdb.set(fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+eggId),{...e,acceptedAt:Date.now(),feedCount:0,ownerId:st.uid});
      await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+fromUid),null);
      await renderKozmos();
    }catch(err){ alert('Kabul edilemedi'); }
  }));
  // Reddet
  box.querySelectorAll('[data-rej]').forEach(btn=>btn.addEventListener('click',async()=>{
    try{ await fdb.set(fdb.ref(db,'kozmoPending/'+st.uid+'/'+btn.dataset.rej),null); await renderKozmos(); }catch(e){}
  }));
  // Besle
  box.querySelectorAll('[data-feed]').forEach(btn=>btn.addEventListener('click',async()=>{
    try{
      const ref2=fdb.ref(db,'kozmos/'+st.uid+'/eggs/'+btn.dataset.feed+'/feedCount');
      await fdb.runTransaction(ref2,cur=>(cur||0)+1);
      await renderKozmos();
    }catch(e){ alert('Beslenemedi'); }
  }));
}

export default openKozmos;
