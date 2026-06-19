// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — EKRANLAR: 👤 Profil + ⚙️ Ayarlar + 🏆 Liderlik
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';


// Hafif toast helper (alert yerine)
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n) => { const v=Number(n); return (Number.isFinite(v)?v:0).toLocaleString('tr-TR'); };
const byId = (id) => document.getElementById(id);
function defaultAvatar(uid){ if(!uid)return '⭐'; let h=0; for(let i=0;i<uid.length;i++)h=((h<<5)-h)+uid.charCodeAt(i); const A=['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈']; return A[Math.abs(h)%A.length]; }
function setOn(key,def){ const v=localStorage.getItem(key); return v===null?def:v!=='0'; }

export function applyProfileBg(id){
  const scr=document.querySelector('[data-screen="profile"]'); if(!scr) return;
  scr.classList.remove('matrix-bg');
  [...scr.querySelectorAll('.prf-matrix-col')].forEach(e=>e.remove());
  if(window._matrixAnim){clearInterval(window._matrixAnim);window._matrixAnim=null;}
  if(id==='matrix'){
    scr.style.background='#000800'; scr.classList.add('matrix-bg');
    // Canvas tabanlı matrix (Goodyedek bgMatrix birebir)
    let cv=scr.querySelector('canvas.matrix-cv');
    if(!cv){ cv=document.createElement('canvas'); cv.className='matrix-cv'; cv.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0'; scr.insertBefore(cv,scr.firstChild); }
    cv.width=scr.offsetWidth||360; cv.height=scr.offsetHeight||600;
    const ctx=cv.getContext('2d');
    const cols=Math.floor(cv.width/13);
    const bgS=Array.from({length:cols},(_,i)=>({ y:Math.random()*cv.height*1.4, sp:Math.random()*.8+.3 }));
    if(window._matrixAnim) cancelAnimationFrame(window._matrixAnim);
    function matrixFrame(){
      if(!scr.classList.contains('matrix-bg')){ ctx.clearRect(0,0,cv.width,cv.height); return; }
      const t=Date.now()/1000;
      ctx.fillStyle='rgba(0,8,4,0.22)'; ctx.fillRect(0,0,cv.width,cv.height);
      ctx.globalAlpha=0.04; ctx.strokeStyle='#00ff44'; ctx.lineWidth=0.5;
      const gs=28;
      for(let gx=0;gx<cv.width;gx+=gs){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,cv.height);ctx.stroke();}
      for(let gy=0;gy<cv.height;gy+=gs){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(cv.width,gy);ctx.stroke();}
      bgS.forEach(function(s,i){
        const x=i*13+6;
        s.y=(s.y+s.sp*2+1.2)%(cv.height*1.4);
        const y=s.y-cv.height*0.4;
        ctx.globalAlpha=0.98; ctx.fillStyle='#afffaf'; ctx.font='bold 12px monospace';
        ctx.fillText(String.fromCharCode(33+Math.floor(Math.random()*93)),x,y);
        const hg=ctx.createRadialGradient(x,y,0,x,y,8);
        hg.addColorStop(0,'rgba(100,255,100,0.35)'); hg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
        for(let k=1;k<16;k++){
          const fade=1-k/16; ctx.globalAlpha=fade*0.75;
          const bright=30+fade*50; ctx.fillStyle='hsl(120,100%,'+bright+'%)';
          ctx.font=(11-k*0.25)+'px monospace';
          ctx.fillText(String.fromCharCode(33+Math.floor(Math.random()*93)),x,y-k*12);
        }
      });
      for(let c=0;c<cols;c+=5){
        const cp=0.03+Math.abs(Math.sin(t*0.7+c*0.4))*0.07;
        const sg=ctx.createLinearGradient(c*13,0,c*13,cv.height);
        sg.addColorStop(0,'rgba(0,255,70,0)'); sg.addColorStop(0.5,'rgba(0,255,70,'+cp+')'); sg.addColorStop(1,'rgba(0,255,70,0)');
        ctx.fillStyle=sg; ctx.globalAlpha=1; ctx.fillRect(c*13,0,11,cv.height);
      }
      const scanY=(t*45)%cv.height;
      ctx.globalAlpha=0.2; ctx.fillStyle='rgba(0,255,80,1)'; ctx.fillRect(0,scanY-1,cv.width,3);
      ctx.globalAlpha=0.06; ctx.fillStyle='rgba(0,255,80,1)'; ctx.fillRect(0,scanY-20,cv.width,22);
      const vg=ctx.createRadialGradient(cv.width/2,cv.height/2,cv.width*0.25,cv.width/2,cv.height/2,cv.width*0.85);
      vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,8,2,0.6)');
      ctx.globalAlpha=1; ctx.fillStyle=vg; ctx.fillRect(0,0,cv.width,cv.height);
      window._matrixAnim=requestAnimationFrame(matrixFrame);
    }
    matrixFrame();
    return;
  }
  const BG={'ocean':'linear-gradient(160deg,#0d1b4b 0%,#0a3060 50%,#062040 100%)','space':'radial-gradient(ellipse at top,#1a1040 0%,#0a0a1e 100%)','forest':'linear-gradient(160deg,#0d2b1a 0%,#1a3a20 50%,#0a1e12 100%)','sunset':'linear-gradient(160deg,#3a0a20 0%,#6b1a2a 40%,#2a0a40 100%)','ice':'linear-gradient(160deg,#0d2040 0%,#1a3060 50%,#0a1830 100%)'};
  scr.style.background=BG[id]||'';
}

// ── ui.js modal erişimi (önbelleğe dayanıklı) ────────────────
async function uiMod(){
  try{ const m=await import('./ui.js'); if(m.openKajuModal&&m.openNickModal) return m; }catch(e){}
  return import('./ui.js');
}

// ── 👤 PROFİL ─────────────────────────────────────────────────
let _profT=null;
export function initScreens(){
  if(typeof window!=='undefined'){ if(window.__heroScreensInit) return; window.__heroScreensInit=true; }
  // Auth değişince hem profili hem nav köprülerini yeniden render et
  try{ Auth.subscribe(st=>{
    try{ _renderProfile(st); }catch(e){ console.error('[PRF]',e); const b=byId('scrProfile'); if(b) b.innerHTML='<div class="placeholder">⚠️ '+esc(e.message)+'</div>'; }
    try{ renderBridges(); }catch(e){}  // ← auth değişince köprüler de güncellensin
  }); }catch(e){}
  try{ Store.subscribe(()=>_renderProfile(Auth.getState())); }catch(e){}
  try{ renderBridges(); }catch(e){}
  try{ renderLeaderboard(); }catch(e){}
  document.querySelectorAll('[data-nav="leaderboard"]').forEach(el=>el.addEventListener('click',()=>setTimeout(renderLeaderboard,80)));
  document.querySelectorAll('[data-nav="profile"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>_renderProfile(Auth.getState()),80)));
  // Nav arkadaş/bildirim sekmelerine tıklanınca taze veri çek
  document.querySelectorAll('[data-nav="friends"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>{try{_buildFriendsBridge();}catch(e){}},80)));
  document.querySelectorAll('[data-nav="notifications"]').forEach(el=>el.addEventListener('click',()=>setTimeout(()=>{try{_buildNotifBridge();}catch(e){}},80)));
}
export function renderProfile(st){ if(!st) st=Auth.getState(); _renderProfile(st); }

function _renderProfile(st){
  if(!st) st=Auth.getState();
  const box=byId('scrProfile'); if(!box) return;
  const pl=Store.getState?Store.getState():{};
  const isGoogle=st.status==='google';
  const nick=st.displayName||'Misafir Oyuncu';
  const lvl=Math.max(1,Number(pl.level)||1);
  const xpR=Number(pl.xp); const xp=Number.isFinite(xpR)?xpR:0;
  const txR=Number(pl.totalXP); const totalXPv=Number.isFinite(txR)?txR:xp;
  const need=Math.max(1,(Store.xpForLevel?Store.xpForLevel(lvl):300+lvl*200)||100);
  const rawPct=xp/need*100; const pct=Number.isFinite(rawPct)?Math.max(0,Math.min(100,Math.round(rawPct))):0;
  const curXPv=xp, needed=need;
  let photoDataUrl=null; try{ if(st.uid) photoDataUrl=localStorage.getItem('hero_photo_'+st.uid); }catch(e){}
  const avaHtml = photoDataUrl
    ? '<img src="'+photoDataUrl+'" alt="profil foto" style="width:100%;height:100%;object-fit:cover;border-radius:13px;position:absolute;inset:0">'
    : '<span style="font-size:28px">'+esc((st.profile&&st.profile.avatar)||defaultAvatar(st.uid))+'</span>';
  const frameColor=esc((st.profile&&st.profile.frame)||'transparent');
  box.innerHTML = ''
    +'<div class="prf-card">'
      +'<div class="prf-top">'
        +'<div class="prf-ava" data-p="avatar" title="Fotoğraf/Avatar" style="cursor:pointer;border:3px solid '+frameColor+';overflow:hidden;position:relative;border-radius:50%">'
          +avaHtml
          +'<span class="prf-ava-edit">📷</span>'
        +'</div>'
        +'<div class="prf-id">'
          +'<div class="prf-name"><span data-el="prfNick">'+esc(nick)+'</span>'
            +(isGoogle?' <button class="prf-mini" data-p="nick">✏️</button>':'')
          +'</div>'
          +'<div class="prf-badges" data-el="prfBadges"></div>'
          +'<div class="prf-sub">'+(isGoogle?(st.isAdmin?'👑 ADMİN · ':'')+esc((st.uid||'').slice(0,12))+'…':'Misafir hesabı')+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="prf-stats">'
        +'<div class="prf-stat"><b>🥜 '+fmt(pl.kaju)+'</b><span>KAJU</span></div>'
        +'<div class="prf-stat"><b>⭐ '+lvl+'</b><span>SEVİYE</span></div>'
        +'<div class="prf-stat"><b>✨ '+fmt(totalXPv)+'</b><span>TOPLAM XP</span></div>'
      +'</div>'
      +'<div class="prf-xp-premium">'
        +'<div class="prf-xp-header">'
          +'<div class="prf-xp-lv-badge" data-rank="'+(lvl>=50?'mythic':lvl>=25?'legend':lvl>=10?'epic':lvl>=5?'rare':'common')+'">LV '+lvl+'</div>'
          +'<div class="prf-xp-mid">'
            +'<div class="prf-xp-title">⚡ DENEYİM PUANI</div>'
            +'<div class="prf-xp-pct" style="color:'+(pct>=75?'#69F0AE':pct>=40?'#FFD740':'#c084fc')+'">%'+pct+' tamamlandı</div>'
          +'</div>'
          +'<div class="prf-xp-next-lv">LV '+(lvl+1)+' →</div>'
        +'</div>'
        +'<div class="prf-xp-track">'
          +'<div class="prf-xp-fill-bar" style="width:'+pct+'%"></div>'
          +'<div class="prf-xp-glow-dot" style="left:'+Math.max(0,pct-1)+'%"></div>'
        +'</div>'
        +'<div class="prf-xp-footer">'
          +'<span class="prf-xp-cur">'+fmt(curXPv)+' XP</span>'
          +'<span class="prf-xp-remain">'+fmt(needed-curXPv)+' XP kaldı</span>'
          +'<span class="prf-xp-max">'+fmt(needed)+' XP</span>'
        +'</div>'
      +'</div>'
      +'<div class="prf-acts-grid">'
        +(isGoogle?'<button class="prf-act-btn prf-act-primary" data-p="kaju">🥜 Kaju Gönder</button>':'<button class="prf-act-btn prf-act-primary" data-p="login">🔗 Hesabı Bağla</button>')
        +(isGoogle?'<button class="prf-act-btn" data-p="mycard">🪪 Kartım</button>':'')
        +(isGoogle?'<button class="prf-act-btn" data-p="clan">🏰 Klan</button>':'')
        +'<button class="prf-act-btn" data-p="season">👑 Sezon</button>'
        +(isGoogle?'<button class="prf-act-btn" data-p="shop">🛍️ Mağaza</button>':'')
        +(isGoogle?'<button class="prf-act-btn" data-p="kozmos">🥚 Kozmos</button>':'')
        +(isGoogle?'<button class="prf-act-btn" data-p="frame">🖼️ Çerçeve</button>':'')
        +(isGoogle?'<button class="prf-act-btn prf-act-dm" data-p="dm">✉️ Mesaj</button>':'')        +'<button class="prf-act-btn" data-p="settings">⚙️ Ayarlar</button>'
      +'</div>'
    +'</div>'
    +'<div class="prf-card" id="prfRecords"><div class="prf-lbl">🏆 REKORLARIN</div><div class="prf-recbody">Yükleniyor…</div></div>'
    +'<div class="prf-card" id="prfTrophies"><div class="prf-lbl">🏅 ROZET VİTRİNİ</div><div class="prf-trbody">Yükleniyor…</div></div>';
  // Buton dinleyicileri
  const q=(sel)=>box.querySelector('[data-p="'+sel+'"]');
  q('settings')&&q('settings').addEventListener('click',openSettings);
  if(q('dm')&&isGoogle) q('dm').addEventListener('click',async()=>{
    // Kendi profil ekranı → mesaj kutusunu (DM listesi) aç
    try{
      const m=await import('./social.js');
      m.openHubTab('ozel');
    }catch(e){ console.warn('[profil dm]',e); }
  });
  if(q('nick')&&isGoogle) q('nick').addEventListener('click',async()=>(await uiMod()).openNickModal());
  if(q('kaju')&&isGoogle) q('kaju').addEventListener('click',async()=>(await uiMod()).openKajuModal());
  if(q('login')) q('login').addEventListener('click',()=>Auth.loginGoogle&&Auth.loginGoogle());
  if(q('mycard')) q('mycard').addEventListener('click',async()=>{ try{const m=await import('./social.js');m.openPlayerCard(st.uid);}catch(e){} });
  if(q('clan')) q('clan').addEventListener('click',async()=>{ try{const m=await import('./clan.js');m.default();}catch(e){_toast('Klan: '+(e.message||e));} });
  if(q('season')) q('season').addEventListener('click',async()=>{ try{const m=await import('./season.js');m.openSeason();}catch(e){_toast('Sezon: '+(e.message||e));} });
  if(q('shop')) q('shop').addEventListener('click',async()=>{ try{const m=await import('./shop.js');m.openShop();}catch(e){_toast('Mağaza: '+(e.message||e));} });
  if(q('kozmos')) q('kozmos').addEventListener('click',async()=>{ try{const m=await import('./kozmos.js');m.openKozmos();}catch(e){_toast('Kozmos: '+(e.message||e));} });
  if(q('frame')) q('frame').addEventListener('click',openFramePicker);
  // Avatar/fotoğraf seçici
  const avb=box.querySelector('[data-p="avatar"]');
  if(avb) avb.addEventListener('click',()=>{
    if(!isGoogle){ openAvatarPicker(); return; }
    openPhotoMenu(st, photoDataUrl);
  });
  renderBadgesAndRank(st);
  renderRecords(st);
  renderTrophies(st);
  const bgId=(st.profile&&st.profile.profileBg)||'default';
  if(bgId&&bgId!=='default') applyProfileBg(bgId);
}

// ── 📷 Fotoğraf / Avatar menüsü ───────────────────────────────
function openPhotoMenu(st, photoDataUrl){
  const ov=document.createElement('div'); ov.id='avMenu'; ov.className='nick-modal-ov';
  const ov_inner=document.createElement('div'); ov_inner.className='nick-modal'; ov_inner.style.maxWidth='280px';
  ov_inner.innerHTML='<div class="nm-title">👤 Profil Görseli</div><div class="nm-actions" style="flex-direction:column;gap:8px"></div>';
  const acts=ov_inner.querySelector('.nm-actions');
  const addBtn=(lbl,cls,fn)=>{ const b=document.createElement('button'); b.className='nm-btn '+cls; b.textContent=lbl; b.addEventListener('click',fn); acts.appendChild(b); };
  addBtn('🎭 Emoji Avatar Seç','nm-ok',()=>{ ov.remove(); openAvatarPicker(); });
  addBtn('📷 Fotoğraf Yükle','nm-ok',()=>{
    ov.remove();
    const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.addEventListener('change',e=>{
      const file=e.target.files[0]; if(!file) return;
      if(file.size>2*1024*1024){ _toast('Fotoğraf 2MB’den küçük olmalı'); return; }
      const reader=new FileReader();
      reader.onload=async ev=>{
        try{
          localStorage.setItem('hero_photo_'+st.uid, ev.target.result);
          try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{photo:ev.target.result.slice(0,50000)}); }catch(e){}
          _renderProfile(Auth.getState());
        }catch(err){ _toast('Fotoğraf kaydedilemedi'); }
      };
      reader.readAsDataURL(file);
    });
    inp.click();
  });
  if(photoDataUrl) addBtn('🗑 Fotoğrafı Kaldır','nm-cancel',async()=>{
    try{ localStorage.removeItem('hero_photo_'+st.uid); await fdb.update(fdb.ref(db,'users/'+st.uid),{photo:null}); }catch(e){}
    ov.remove(); _renderProfile(Auth.getState());
  });
  addBtn('İptal','nm-cancel',()=>ov.remove());
  ov.appendChild(ov_inner);
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
}

// ── 🎭 Avatar seçici ─────────────────────────────────────────
const AVATARS=['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈'];
async function openAvatarPicker(){
  if(byId('avaModal')) return;
  const st=Auth.getState(); const cur=(st.profile&&st.profile.avatar)||defaultAvatar(st.uid);
  const ov=document.createElement('div'); ov.id='avaModal'; ov.className='nick-modal-ov';
  const inner=document.createElement('div'); inner.className='nick-modal';
  inner.innerHTML='<div class="nm-title">🎭 Avatarını Seç</div><div class="ava-grid"></div><div class="nm-actions"><button class="nm-btn nm-cancel" id="avaClose">Kapat</button></div>';
  const grid=inner.querySelector('.ava-grid');
  AVATARS.forEach(a=>{
    const b=document.createElement('button'); b.className='ava-opt'+(a===cur?' on':''); b.textContent=a; b.dataset.av=a;
    b.addEventListener('click',async()=>{
      try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{avatar:a}); if(st.profile)st.profile.avatar=a; ov.remove(); _renderProfile(Auth.getState()); }catch(e){ _toast('Kaydedilemedi'); }
    });
    grid.appendChild(b);
  });
  inner.querySelector('#avaClose').addEventListener('click',()=>ov.remove());
  ov.appendChild(inner); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov)ov.remove(); });
}

// ── 🖼️ Çerçeve + Tema seçici ─────────────────────────────────
const FRAMES=[
  {id:'none',label:'Çerçeve Yok',color:'transparent'},
  {id:'gold',label:'👑 Altın',color:'#FFD740'},
  {id:'cyan',label:'💎 Mavi',color:'#00E5FF'},
  {id:'fire',label:'🔥 Ateş',color:'#FF5722'},
  {id:'green',label:'🌿 Yeşil',color:'#69F0AE'},
  {id:'purple',label:'💜 Mor',color:'#CE93D8'},
  {id:'silver',label:'🥈 Gümüş',color:'#B0BEC5'},
];
const BG_THEMES=[
  {id:'default',label:'🌌 Varsayılan',bg:''},
  {id:'space',label:'🚀 Uzay',bg:'radial-gradient(ellipse at top,#1a1040 0%,#0a0a1e 100%)'},
  {id:'ocean',label:'🌊 Okyanus',bg:'linear-gradient(160deg,#0d1b4b 0%,#0a3060 50%,#062040 100%)'},
  {id:'forest',label:'🌲 Orman',bg:'linear-gradient(160deg,#0d2b1a 0%,#1a3a20 50%,#0a1e12 100%)'},
  {id:'sunset',label:'🌅 Gün Batımı',bg:'linear-gradient(160deg,#3a0a20 0%,#6b1a2a 40%,#2a0a40 100%)'},
  {id:'ice',label:'❄️ Buz',bg:'linear-gradient(160deg,#0d2040 0%,#1a3060 50%,#0a1830 100%)'},
  {id:'matrix',label:'💚 Matrix',bg:'#000800'},
];
function openFramePicker(){
  if(byId('framePicker')) return;
  const st=Auth.getState(); if(!st.uid||st.status!=='google'){ _toast('Çerçeve için giriş gerekli'); return; }
  const cur=(st.profile&&st.profile.frame)||'none';
  const curBg=(st.profile&&st.profile.profileBg)||'default';
  const ov=document.createElement('div'); ov.id='framePicker'; ov.className='nick-modal-ov';
  const inner=document.createElement('div'); inner.className='nick-modal';
  inner.innerHTML='<div class="nm-title">🖼️ Çerçeve & Tema</div><div class="prf-lbl" style="margin-top:8px">AVATAR ÇERÇEVESİ</div><div class="ava-grid" id="fpFrames" style="grid-template-columns:repeat(4,1fr)"></div><div class="prf-lbl" style="margin-top:10px">PROFİL ARKA PLANI</div><div class="ava-grid" id="fpBgs" style="grid-template-columns:repeat(3,1fr)"></div><div class="nm-actions"><button class="nm-btn nm-cancel" id="fpClose">Kapat</button></div>';
  FRAMES.forEach(fr=>{
    const b=document.createElement('button'); b.className='ava-opt'+(fr.id===cur?' on':'');
    b.style.cssText='font-size:10px;font-weight:800;padding:7px 2px;border:2px solid '+(fr.color==='transparent'?'rgba(255,255,255,.1)':fr.color);
    b.textContent=fr.label;
    b.addEventListener('click',async()=>{
      try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{frame:fr.id}); if(st.profile)st.profile.frame=fr.id; ov.remove(); _renderProfile(Auth.getState()); }catch(e){ _toast('Kaydedilemedi'); }
    });
    inner.querySelector('#fpFrames').appendChild(b);
  });
  BG_THEMES.forEach(bg=>{
    const b=document.createElement('button'); b.className='ava-opt'+(bg.id===curBg?' on':'');
    b.style.cssText='font-size:10px;font-weight:700;padding:8px 2px;'+(bg.bg?'background:'+bg.bg+';':'');
    b.textContent=bg.label;
    b.addEventListener('click',async()=>{
      try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{profileBg:bg.id}); if(st.profile)st.profile.profileBg=bg.id; applyProfileBg(bg.id); ov.remove(); _renderProfile(Auth.getState()); }catch(e){ _toast('Kaydedilemedi'); }
    });
    inner.querySelector('#fpBgs').appendChild(b);
  });
  inner.querySelector('#fpClose').addEventListener('click',()=>ov.remove());
  ov.appendChild(inner); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov)ov.remove(); });
}

// ── ⚙️ Ayarlar ──────────────────────────────────────────────
// ── 🚫 Engellediklerim Listesi ───────────────────────────────
async function openBlockedList(){
  const st=Auth.getState();
  if(!st.uid) return;
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inner=document.createElement('div'); inner.className='nick-modal'; inner.style.maxWidth='340px';
  inner.innerHTML='<div class="nm-title">🚫 Engellediklerim</div><div id="blkList" style="max-height:50vh;overflow-y:auto"><div class="clan-load">⏳ Yükleniyor…</div></div><div class="nm-actions"><button class="nm-btn nm-cancel" id="blkClose">Kapat</button></div>';
  ov.appendChild(inner); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  inner.querySelector('#blkClose').addEventListener('click',()=>ov.remove());
  const box=inner.querySelector('#blkList');
  try{
    const snap=await fdb.get(fdb.ref(db,'blocks/'+st.uid));
    if(!snap.exists()||!Object.keys(snap.val()||{}).length){
      box.innerHTML='<div style="text-align:center;padding:24px;color:#7d8ab8;font-size:12px">✅ Kimseyi engellemiyorsun</div>';
      return;
    }
    const uids=Object.keys(snap.val()).filter(u=>snap.val()[u]===true);
    if(!uids.length){ box.innerHTML='<div style="text-align:center;padding:24px;color:#7d8ab8;font-size:12px">✅ Kimseyi engellemiyorsun</div>'; return; }
    const rows=await Promise.all(uids.map(async uid=>{
      let n='Kullanıcı',a='👤';
      try{const u=await fdb.get(fdb.ref(db,'users/'+uid));if(u.exists()){const v=u.val();n=v.nick||v.name||n;a=v.avatar||'👤';}}catch(e){}
      return {uid,n,a};
    }));
    box.innerHTML=rows.map(r=>'<div class="blk-row">'
      +'<div class="blk-ava">'+esc(r.a)+'</div>'
      +'<div class="blk-name">'+esc(r.n)+'</div>'
      +'<button class="blk-unblock" data-unblock="'+esc(r.uid)+'">🔓 Engeli Kaldır</button>'
    +'</div>').join('');
    box.querySelectorAll('[data-unblock]').forEach(b=>b.addEventListener('click',async()=>{
      const uid=b.dataset.unblock;
      try{
        await fdb.set(fdb.ref(db,'blocks/'+st.uid+'/'+uid),null);
        b.closest('.blk-row').style.opacity='.4';
        b.textContent='✓ Kaldırıldı'; b.disabled=true;
      }catch(e){_toast('Yapılamadı');}
    }));
  }catch(e){ box.innerHTML='<i style="color:#ff7a8a">Yüklenemedi</i>'; }
}

function openSettings(){
  if(byId('setModal')) return;
  const ov=document.createElement('div'); ov.id='setModal'; ov.className='nick-modal-ov';
  const inner=document.createElement('div'); inner.className='nick-modal';
  const st=Auth.getState();
  const fabOn=setOn('hero_set_fabs',true);
  const hfOn=setOn('hero_set_hidefriends',false);
  inner.innerHTML='<div class="nm-title">⚙️ Ayarlar</div>'
    +'<div class="set-theme-section"><div class="set-theme-lbl">🎨 TEMA & RENK</div><div class="set-theme-grid" id="themeGrid"></div></div>'
    +'<div class="set-row"><span>💎 Yüzen butonlar (FAB)</span><button class="set-tgl'+(fabOn?' on':'')+'" id="stFab">'+(fabOn?'AÇIK':'KAPALI')+'</button></div>'
    +'<div class="set-row"><span>👥 Arkadaş listemi gizle <small style="opacity:.45;font-size:9px">(adminler görür)</small></span><button class="set-tgl'+(hfOn?' on':'')+'" id="stHF">'+(hfOn?'GİZLİ':'HERKES')+'</button></div>'
    +'<div class="set-row"><span>🔔 Push bildirimleri</span><button class="set-tgl" id="stNotif">YÜKLENİYOR</button></div>'
    +(st.status==='google'?'<div class="set-row"><span>✉️ Herkesten DM al <small style="opacity:.45;font-size:9px">(adminler hariç)</small></span><button class="set-tgl'+(setOn('hero_set_dmclosed',false)?'':' on')+'" id="stDM">'+(setOn('hero_set_dmclosed',false)?'KAPALI':'AÇIK')+'</button></div>':'')
    +(st.status==='google'?'<div class="set-row"><span>🚫 Engellediklerim</span><button class="set-tgl" id="stBlocked">GÖSTER</button></div>':'')
    +'<div class="set-row"><span>🧹 Önbelleği temizle + yenile</span><button class="set-tgl" id="stCache">TEMİZLE</button></div>'
    +(st.status==='google'?'<div class="set-row"><span>🚪 Hesaptan çık</span><button class="set-tgl warn" id="stLogout">ÇIKIŞ</button></div>':'')
    +'<div class="set-ver">Hero Oyun Portalı · modüler sürüm</div>'
    +'<div class="nm-actions"><button class="nm-btn nm-cancel" id="stClose">Kapat</button></div>';
  inner.querySelector('#stClose').addEventListener('click',()=>ov.remove());
  // 🎨 Tema seçici
  const THEMES=[
    {key:'neon',    name:'Neon',    c1:'#00E5FF',c2:'#FF4081'},
    {key:'cosmic',  name:'Kozmik',  c1:'#c084fc',c2:'#22d3ee'},
    {key:'sunset',  name:'Gün Batımı',c1:'#FF9800',c2:'#FF4081'},
    {key:'emerald', name:'Zümrüt',  c1:'#69F0AE',c2:'#22d3ee'},
    {key:'golden',  name:'Altın',   c1:'#FFD740',c2:'#FF9800'},
    {key:'crimson', name:'Kızıl',   c1:'#FF5252',c2:'#E040FB'},
    {key:'ocean',   name:'Okyanus', c1:'#42A5F5',c2:'#26C6DA'},
    {key:'mono',    name:'Gümüş',   c1:'#E0E0FF',c2:'#B0B0D0'},
  ];
  let curTheme='neon';
  try{ curTheme=localStorage.getItem('hero_theme')||'neon'; }catch(e){}
  const tg=inner.querySelector('#themeGrid');
  if(tg){
    tg.innerHTML=THEMES.map(t=>
      '<button class="theme-chip'+(t.key===curTheme?' active':'')+'" data-theme="'+t.key+'">'
        +'<div class="theme-swatch" style="background:linear-gradient(135deg,'+t.c1+','+t.c2+')"></div>'
        +'<div class="theme-name">'+t.name+'</div>'
      +'</button>'
    ).join('');
    tg.querySelectorAll('[data-theme]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.theme;
      try{ localStorage.setItem('hero_theme',key); }catch(e){}
      document.documentElement.setAttribute('data-theme',key);
      tg.querySelectorAll('.theme-chip').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      // Parçacık renklerini yenile
      try{
        const c=document.getElementById('bgParticles');
        if(c){
          const cs=getComputedStyle(document.documentElement);
          const cols=[(cs.getPropertyValue('--logo-c1')||'#00E5FF').trim(),(cs.getPropertyValue('--logo-c2')||'#FF4081').trim(),(cs.getPropertyValue('--logo-x')||'#FFD740').trim()];
          c.querySelectorAll('.bg-particle').forEach((p,i)=>{ const col=cols[i%cols.length]; p.style.background=col; p.style.color=col; });
        }
      }catch(e){}
    }));
  }
  inner.querySelector('#stFab').addEventListener('click',async e=>{
    const now=!setOn('hero_set_fabs',true); localStorage.setItem('hero_set_fabs',now?'1':'0');
    e.target.classList.toggle('on',now); e.target.textContent=now?'AÇIK':'KAPALI';
    try{const m=await import('./social.js');m.applyFabSetting();}catch(err){}
  });
  // 🔔 Push bildirim toggle
  (async()=>{
    const nb=inner.querySelector('#stNotif'); if(!nb) return;
    try{
      const pm=await import('./push.js');
      const perm=pm.notifPermission();
      if(perm==='unsupported'){ nb.textContent='DESTEKLENMİYOR'; nb.style.opacity='.4'; nb.disabled=true; return; }
      if(perm==='granted'){ nb.textContent='AÇIK'; nb.classList.add('on'); }
      else if(perm==='denied'){ nb.textContent='ENGELLİ'; nb.style.opacity='.5'; }
      else { nb.textContent='KAPALI'; }
      nb.addEventListener('click',async()=>{
        const cur=pm.notifPermission();
        if(cur==='granted'){
          _toast('Bildirimler açık. Kapatmak için tarayıcı ayarlarını kullan.');
          return;
        }
        const ok=await pm.requestNotifPermission();
        if(ok){ nb.textContent='AÇIK'; nb.classList.add('on'); }
        else { nb.textContent=pm.notifPermission()==='denied'?'ENGELLİ':'KAPALI'; }
      });
    }catch(e){ nb.textContent='HATA'; }
  })();
  inner.querySelector('#stHF').addEventListener('click',async e=>{
    const now=!setOn('hero_set_hidefriends',false); localStorage.setItem('hero_set_hidefriends',now?'1':'0');
    e.target.classList.toggle('on',now); e.target.textContent=now?'GİZLİ':'HERKES';
    const st2=Auth.getState(); if(st2.uid) try{await fdb.update(fdb.ref(db,'users/'+st2.uid),{friendsHidden:now});}catch(ex){}
  });
  // ✉️ DM kapatma toggle (Firebase'e yaz, başkaları kontrol etsin)
  const dmBtn=inner.querySelector('#stDM');
  if(dmBtn) dmBtn.addEventListener('click',async e=>{
    const nowClosed=!setOn('hero_set_dmclosed',false);
    localStorage.setItem('hero_set_dmclosed',nowClosed?'1':'0');
    e.target.classList.toggle('on',!nowClosed);
    e.target.textContent=nowClosed?'KAPALI':'AÇIK';
    const st2=Auth.getState();
    if(st2.uid) try{await fdb.update(fdb.ref(db,'users/'+st2.uid),{dmClosed:nowClosed});}catch(ex){}
  });
  // 🚫 Engellediklerim listesi
  const blkBtn=inner.querySelector('#stBlocked');
  if(blkBtn) blkBtn.addEventListener('click',async()=>{ ov.remove(); openBlockedList(); });
  inner.querySelector('#stCache').addEventListener('click',async()=>{
    try{if(window.caches&&caches.keys){const ks=await caches.keys();for(const k of ks)await caches.delete(k);}}catch(e){}
    location.reload();
  });
  const lo=inner.querySelector('#stLogout');
  if(lo) lo.addEventListener('click',async()=>{ if(confirm('Hesaptan çıkılsın mı?')){ try{await Auth.logout();}catch(e){} ov.remove(); } });
  ov.appendChild(inner); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov)ov.remove(); });
}

// ── Rozetler + Sıra ──────────────────────────────────────────
async function renderBadgesAndRank(st){
  const box=byId('scrProfile'); if(!box||!st.uid) return;
  const bEl=box.querySelector('[data-el="prfBadges"]'); if(!bEl) return;
  const badges=[];
  if(st.isAdmin===true){
    badges.push('<span class="chat-admin-badge">👑 ADMİN</span>');
    try{const m=await import('./social.js'); const n=box.querySelector('[data-el="prfNick"]'); if(n){n.classList.add(m.glowClass());n.style.color='#FFD740';}}catch(e){}
  }
  if(st.profile&&st.profile.isVice) badges.push('<span class="chat-op-badge" style="color:#FFD740;border-color:rgba(255,215,64,.3);background:rgba(255,215,64,.1)">⭐ VICE</span>');
  try{const o=await fdb.get(fdb.ref(db,'gcOperators/'+st.uid)); if(o.exists()&&o.val()===true) badges.push('<span class="chat-op-badge">🔧 OP</span>');}catch(e){}
  try{
    const snap=await fdb.get(fdb.query(fdb.ref(db,'leaderboard/kaju'),fdb.orderByChild('kaju'),fdb.limitToLast(100)));
    if(snap.exists()){const rows=[];snap.forEach(ch=>{rows.push({uid:ch.key,kaju:(ch.val()||{}).kaju||0});});rows.sort((a,b)=>b.kaju-a.kaju);const i=rows.findIndex(r=>r.uid===st.uid);if(i>=0)badges.push('<span class="prf-rank">🏆 Liderlik #'+(i+1)+'</span>');}
  }catch(e){}
  bEl.innerHTML=badges.join(' ');
}

// ── Rekorlar ─────────────────────────────────────────────────
async function renderRecords(st){
  const body=document.querySelector('#prfRecords .prf-recbody'); if(!body) return;
  if(!st.uid){body.innerHTML='<i>Giriş yapınca rekorların burada görünür</i>';return;}
  let p=st.profile||{};
  try{const s=await fdb.get(fdb.ref(db,'users/'+st.uid));if(s.exists())p=s.val();}catch(e){}
  const best=p.bestScores||{},kr=p.kelimeRecords||{};
  const rows=[];
  const names={tetris:'🧱 Tetris',chess:'♟️ Satranç',tavla:'🎲 Tavla',kelime:'🔤 Kelimecik'};
  for(const g of Object.keys(names)){if(best[g])rows.push('<div class="prf-rec"><span>'+names[g]+'</span><b>'+fmt(best[g])+'</b></div>');}
  if(kr.best&&kr.best.text) rows.push('<div class="prf-rec"><span>🔤 En değerli kelime</span><b>'+esc(kr.best.text)+' ('+kr.best.score+')</b></div>');
  if(kr.longest&&kr.longest.text) rows.push('<div class="prf-rec"><span>🔤 En uzun kelime</span><b>'+esc(kr.longest.text)+'</b></div>');
  body.innerHTML=rows.length?rows.join(''):'<i>Henüz rekor yok — oynamaya başla! 🎮</i>';
}

// ── 🏅 Rozet Vitrini ─────────────────────────────────────────
async function renderTrophies(st){
  const body=document.querySelector('#prfTrophies .prf-trbody'); if(!body) return;
  if(!st.uid){body.innerHTML='<i>Giriş yapınca rozetlerin burada görünür</i>';return;}
  body.innerHTML='<div class="badge-loading">⏳ Rozetler yükleniyor…</div>';
  try{
    const bm=await import('./badges.js');
    const badges=await bm.getUserBadges(st.uid, st.profile);
    const RAR=bm.BADGE_RARITY;
    const earned=badges.filter(b=>b.earned);
    const locked=badges.filter(b=>!b.earned);
    // Kalite sırası
    const rarOrder={mythic:0,legendary:1,epic:2,special:3,rare:4,common:5};
    earned.sort((a,b)=>(rarOrder[a.rarity]??9)-(rarOrder[b.rarity]??9));
    const renderBadge=(b,isLocked)=>{
      const r=RAR[b.rarity]||RAR.common;
      return '<div class="badge-item'+(isLocked?' locked':'')+' rar-'+b.rarity+'" title="'+esc(b.name)+' — '+esc(b.desc)+'" style="--bc:'+r.color+';--bg:'+r.glow+'">'
        +'<div class="badge-ico">'+(isLocked?'🔒':b.icon)+'</div>'
        +'<div class="badge-name">'+esc(b.name)+'</div>'
        +'<div class="badge-rar" style="color:'+r.color+'">'+r.label+'</div>'
      +'</div>';
    };
    body.innerHTML='<div class="badge-summary">'
        +'<span class="badge-count">🏅 '+earned.length+'/'+badges.length+' Rozet</span>'
      +'</div>'
      +'<div class="badge-grid">'
        +earned.map(b=>renderBadge(b,false)).join('')
        +locked.map(b=>renderBadge(b,true)).join('')
      +'</div>';
  }catch(e){ body.innerHTML='<i>Rozetler yüklenemedi</i>'; }
}

// ── 🏆 Liderlik ──────────────────────────────────────────────
async function renderLeaderboard(){
  const box=byId('scrLB'); if(!box) return;
  box.innerHTML='<div class="prf-card"><div class="prf-lbl">🏆 KAJU LİDERLİĞİ</div><div class="prf-recbody" id="lbBody">Yükleniyor…</div></div>';
  const body=byId('lbBody'); if(!body) return;
  try{
    const snap=await fdb.get(fdb.query(fdb.ref(db,'leaderboard/kaju'),fdb.orderByChild('kaju'),fdb.limitToLast(20)));
    if(!snap.exists()){body.innerHTML='<i>Henüz veri yok</i>';return;}
    const rows=[];snap.forEach(ch=>{rows.push({uid:ch.key,...ch.val()});});
    rows.sort((a,b)=>(b.kaju||0)-(a.kaju||0));
    const me=Auth.getState().uid;
    const out=await Promise.all(rows.map(async(r,i)=>{
      let name=r.name,ava='👤';
      try{const u=await fdb.get(fdb.ref(db,'users/'+r.uid));if(u.exists()){const v=u.val();name=v.nick||v.name||name;ava=v.avatar||'👤';}}catch(e){}
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      const mine=r.uid===me;
      return '<div class="prf-rec'+(mine?' me':'')+'" data-lbuid="'+esc(r.uid)+'" style="cursor:pointer"><span>'+medal+' '+esc(ava)+' '+esc(name||'Oyuncu')+'</span><b>🥜 '+fmt(r.kaju)+'</b></div>';
    }));
    body.innerHTML=out.join('');
    body.querySelectorAll('[data-lbuid]').forEach(el=>el.addEventListener('click',async()=>{
      try{const m=await import('./social.js');m.openPlayerCard(el.dataset.lbuid);}catch(e){}
    }));
  }catch(e){body.innerHTML='<i>Liderlik okunamadı</i>';}
}

// ── 👥 / 🔔 köprüleri ─────────────────────────────────────────
let _lastBridgeAuthState = null;
function renderBridges(){
  // Sadece giriş durumu değişince yeniden render (gereksiz tekrarları önle)
  const st = Auth.getState();
  const key = (st.uid||'') + ':' + (st.status||'');
  if(key === _lastBridgeAuthState) return;
  _lastBridgeAuthState = key;
  _buildFriendsBridge();
  _buildNotifBridge();
}
async function _buildFriendsBridge(){
  const fr=byId('scrFriends'); if(!fr) return;
  const st=Auth.getState();
  if(!st.uid || st.status!=='google'){
    fr.innerHTML='<div class="prf-card" style="text-align:center;padding:30px 16px"><div style="font-size:42px;margin-bottom:12px">👥</div><div style="font-size:14px;font-weight:800;color:#dfe7ff;margin-bottom:6px">Arkadaşların burada</div><div style="font-size:11px;color:#9fb0d8;margin-bottom:16px">Arkadaş eklemek, mesajlaşmak ve sosyalleşmek için giriş yap</div><button class="clan-btn p" style="width:100%" id="frLoginBtn">🔑 Google ile Giriş</button></div>';
    const lb=fr.querySelector('#frLoginBtn');
    if(lb) lb.addEventListener('click',async()=>{try{const a=await import('./auth.js');await a.loginGoogle();}catch(e){_toast('Giriş başlatılamadı');}});
    return;
  }
  fr.innerHTML='<div class="prf-card"><div id="navFrContent"><div class="clan-load">⏳ Yükleniyor…</div></div></div>';
  await _renderNavFriends();
}

async function _renderNavFriends(){
  const box=byId('navFrContent'); if(!box) return;
  const st=Auth.getState();
  try{
    const snap=await fdb.get(fdb.ref(db,'friends/'+st.uid));
    if(!snap.exists()||!Object.keys(snap.val()||{}).length){
      box.innerHTML='<div class="prf-lbl">👥 ARKADAŞLAR</div><div style="text-align:center;padding:20px;color:#7d8ab8;font-size:12px">Henüz arkadaşın yok.<br><br>Sohbette birinin adına tıklayıp <b>👥 Arkadaş Ekle</b> diyebilirsin.</div><button class="clan-btn p" style="width:100%;margin-top:8px" data-gohub="dost">💎 Sosyal Hub\'a Git</button>';
      const gh=box.querySelector('[data-gohub]'); if(gh) gh.addEventListener('click',async()=>{try{const m=await import('./social.js');m.applyFabSetting();m.openHubTab('dost');}catch(e){}});
      return;
    }
    const uids=Object.keys(snap.val());
    const rows=await Promise.all(uids.map(async uid=>{
      let n='Arkadaş',a='👤',ol=false,lv=1,last=0;
      try{const u=await fdb.get(fdb.ref(db,'users/'+uid));if(u.exists()){const v=u.val();n=v.nick||v.name||n;a=v.avatar||'👤';lv=v.level||1;}}catch(e){}
      try{const pr=await fdb.get(fdb.ref(db,'presence/'+uid));if(pr.exists()){const pv=pr.val();last=pv.lastSeen||0;ol=pv.online===true&&(Date.now()-last)<180000;}}catch(e){}
      return {uid,n,a,ol,lv,last};
    }));
    rows.sort((x,y)=>(y.ol-x.ol)||(y.last-x.last));
    const onlineCount=rows.filter(r=>r.ol).length;
    const tAgoN=(ts)=>{const d=Date.now()-(ts||0);if(d<60e3)return'az önce';if(d<3600e3)return Math.floor(d/60e3)+' dk önce';if(d<86400e3)return Math.floor(d/3600e3)+' sa önce';return Math.floor(d/86400e3)+' gün önce';};
    box.innerHTML='<div class="fr-list-header"><span class="fr-hdr-total">👥 '+rows.length+' Arkadaş</span>'
      +(onlineCount>0?'<span class="fr-hdr-online">🟢 '+onlineCount+' çevrimiçi</span>':'<span class="fr-hdr-offline">Kimse çevrimiçi değil</span>')+'</div>'
      +rows.map(r=>'<div class="fr-row'+(r.ol?' online':'')+'">'
        +'<div class="fr-ava" data-navpc="'+esc(r.uid)+'">'+esc(r.a)+(r.ol?'<span class="fr-dot"></span>':'')+'</div>'
        +'<div class="fr-info" data-navpc="'+esc(r.uid)+'"><div class="fr-name">'+esc(r.n)+' <span class="fr-lv">LV '+r.lv+'</span></div><div class="fr-status">'+(r.ol?'<span class="fr-on">● Çevrimiçi</span>':'<span class="fr-off">'+tAgoN(r.last)+'</span>')+'</div></div>'
        +'<button class="fr-btn dm" data-navdm="'+esc(r.uid)+'" data-navnm="'+esc(r.n)+'" title="Mesaj">✉️</button>'
        +'<button class="fr-btn egg" data-navegg="'+esc(r.uid)+'" data-navnm="'+esc(r.n)+'" title="Kozmo">🥚</button>'
      +'</div>').join('');
    box.querySelectorAll('[data-navpc]').forEach(el=>el.addEventListener('click',async e=>{
      if(e.target.closest('[data-navdm],[data-navegg]'))return;
      try{const m=await import('./social.js');m.openPlayerCard(el.dataset.navpc);}catch(e){}
    }));
    box.querySelectorAll('[data-navdm]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();
      try{
        const m=await import('./social.js');
        m.dmOpenThreadExternal(b.dataset.navdm, b.dataset.navnm);
      }catch(err){ console.warn('[navDM]',err); }
    }));
    box.querySelectorAll('[data-navegg]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation();try{const m=await import('./kozmos.js');await m.sendEgg(b.dataset.navegg,b.dataset.navnm);}catch(err){}
    }));
  }catch(e){ box.innerHTML='<div class="prf-lbl">👥 ARKADAŞLAR</div><i style="color:#7d8ab8">Yüklenemedi</i>'; }
}
async function _buildNotifBridge(){
  const nt=byId('scrNotif'); if(!nt) return;
  const st=Auth.getState();
  if(!st.uid || st.status!=='google'){
    nt.innerHTML='<div class="prf-card" style="text-align:center;padding:30px 16px"><div style="font-size:42px;margin-bottom:12px">🔔</div><div style="font-size:14px;font-weight:800;color:#dfe7ff;margin-bottom:6px">Bildirimlerin burada</div><div style="font-size:11px;color:#9fb0d8;margin-bottom:16px">Arkadaş istekleri, mesajlar ve duyuruları görmek için giriş yap</div><button class="clan-btn p" style="width:100%" id="ntfLoginBtn">🔑 Google ile Giriş</button></div>';
    const lb=nt.querySelector('#ntfLoginBtn');
    if(lb) lb.addEventListener('click',async()=>{try{const a=await import('./auth.js');await a.loginGoogle();}catch(e){_toast('Giriş başlatılamadı');}});
    return;
  }
  nt.innerHTML='<div class="prf-card"><div id="navNotifContent"><div class="clan-load">⏳ Yükleniyor…</div></div></div>';
  await _renderNavNotifs();
}

async function _renderNavNotifs(){
  const box=byId('navNotifContent'); if(!box) return;
  const st=Auth.getState();
  try{
    const snap=await fdb.get(fdb.query(fdb.ref(db,'userNotifs/'+st.uid),fdb.limitToLast(30)));
    if(!snap.exists()){
      box.innerHTML='<div class="prf-lbl">🔔 BİLDİRİMLER</div><div style="text-align:center;padding:24px;color:#7d8ab8;font-size:12px">📭 Henüz bildirimin yok</div>';
      return;
    }
    const rows=[]; snap.forEach(ch=>{rows.push({key:ch.key,...ch.val()});});
    rows.sort((a,b)=>(b.ts||0)-(a.ts||0));
    const tAgoN=(ts)=>{const d=Date.now()-(ts||0);if(d<60e3)return'az önce';if(d<3600e3)return Math.floor(d/60e3)+' dk önce';if(d<86400e3)return Math.floor(d/3600e3)+' sa önce';return Math.floor(d/86400e3)+' gün önce';};
    box.innerHTML='<div class="fr-list-header"><span class="fr-hdr-total">🔔 '+rows.length+' Bildirim</span><button class="clan-btn" style="padding:4px 10px;font-size:9px;background:rgba(255,82,82,.08);border-color:rgba(255,82,82,.25);color:#FF7043" id="navNotifClear">🗑 Temizle</button></div>'
      +rows.map(n=>{
        const ico=n.icon||'🔔'; const txt=n.text||n.msg||'';
        const isKick=ico==='🦵'||txt.includes('atıldın');
        const isBan=ico==='🚫'||txt.includes('banland');
        const isUnban=ico==='✅';
        const isWarn=ico==='⚠️';
        const isAnn=ico==='📣'||ico==='🏰';
        const isKozmo=ico==='🥚'||ico==='🎁';
        const isFr=ico==='👥'||ico==='🤝'||ico==='👉';
        const c=isKick?'#FF5252':isBan?'#FF1744':isUnban?'#69F0AE':isWarn?'#FFB74D':isAnn?'#FFD740':isKozmo?'#c084fc':isFr?'#00E5FF':'#9fb0d8';
        const bg=isKick?'rgba(255,82,82,.07)':isBan?'rgba(220,30,30,.08)':isAnn?'rgba(255,215,64,.05)':isKozmo?'rgba(192,132,252,.06)':isFr?'rgba(0,229,255,.05)':'rgba(255,255,255,.03)';
        return '<div class="nav-notif-item" style="background:'+bg+';border-left:3px solid '+c+'">'
          +'<div class="nav-notif-ico" style="color:'+c+'">'+esc(ico)+'</div>'
          +'<div class="nav-notif-body"><div class="nav-notif-txt">'+esc(txt)+'</div><div class="nav-notif-time">'+tAgoN(n.ts)+'</div></div>'
        +'</div>';
      }).join('');
    const clr=box.querySelector('#navNotifClear');
    if(clr) clr.addEventListener('click',async()=>{
      if(!confirm('Tüm bildirimler silinsin mi?'))return;
      try{await fdb.set(fdb.ref(db,'userNotifs/'+st.uid),null);await _renderNavNotifs();}catch(e){}
    });
  }catch(e){ box.innerHTML='<div class="prf-lbl">🔔 BİLDİRİMLER</div><i style="color:#7d8ab8">Yüklenemedi</i>'; }
}

export default initScreens;
