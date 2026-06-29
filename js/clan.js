// ═══════════════════════════════════════════════════════════════
//  KLAN SİSTEMİ — Hero Oyun Portalı
//  Klan adı değiştir · Kick/Ban/Unban nedenli · Davet sistemi
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';


// Hafif toast helper (alert yerine)
function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2800); }catch(e){ console.log(msg); }
}

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>(Number.isFinite(Number(n))?Number(n):0).toLocaleString('tr-TR');
const tAgo=(ts)=>{const d=Date.now()-(ts||0);if(d<60e3)return'şimdi';if(d<3600e3)return Math.floor(d/60e3)+' dk';if(d<86400e3)return Math.floor(d/3600e3)+' sa';return Math.floor(d/86400e3)+' g';};

let C=null; let _clan=null;

let _trCssDone=false;
function _ensureTreasuryCss(){
  if(_trCssDone) return; _trCssDone=true;
  const s=document.createElement('style');
  s.textContent=`
  .clan-treasury-hero{text-align:center;padding:18px 14px;border-radius:16px;background:linear-gradient(135deg,rgba(255,215,64,.14),rgba(240,165,0,.05));border:1px solid rgba(255,215,64,.3);margin-bottom:14px}
  .clan-treasury-lbl{font-size:12px;color:#bba8df;font-weight:700}
  .clan-treasury-amt{font-size:30px;font-weight:900;color:#ffe082;margin:5px 0;text-shadow:0 2px 12px rgba(255,215,64,.3)}
  .clan-treasury-sub{font-size:10px;color:#9fb0d8}
  .clan-donate-box{background:rgba(255,255,255,.04);border-radius:14px;padding:13px;margin-bottom:14px}
  .clan-donate-row{display:flex;gap:8px}
  .clan-don-amt{flex:1;padding:11px;border-radius:11px;border:1px solid rgba(255,215,64,.3);background:rgba(255,215,64,.08);color:#ffe082;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;transition:.15s}
  .clan-don-amt:active{transform:scale(.96);background:rgba(255,215,64,.18)}
  .clan-sect{font-size:11px;font-weight:800;color:#bba8df;margin:14px 2px 8px;letter-spacing:.4px}
  .clan-donrow{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.035);margin-bottom:6px;font-size:12px;font-weight:700;color:#e8eaf6}
  .clan-treasury-info{font-size:10px;color:#7d8ab8;line-height:1.6;background:rgba(255,255,255,.03);border-radius:11px;padding:11px;margin-top:13px}
  .clan-admin-box{background:linear-gradient(135deg,rgba(255,215,64,.1),rgba(124,77,255,.06));border:1px solid rgba(255,215,64,.35);border-radius:14px;padding:13px;margin-bottom:14px}
  .clan-admin-title{font-size:13px;font-weight:900;color:#ffe082;margin-bottom:3px}
  .clan-admin-sub{font-size:10px;color:#bba8df;margin-bottom:9px}
  .clan-adm-amt{flex:1;padding:11px 6px;border-radius:11px;border:1px solid rgba(124,77,255,.4);background:rgba(124,77,255,.12);color:#d8b4fe;font-weight:900;font-size:12px;cursor:pointer;font-family:inherit;transition:.15s}
  .clan-adm-amt:active{transform:scale(.96);background:rgba(124,77,255,.25)}
  .clan-adm-go{padding:10px 14px;border-radius:10px;border:none;background:linear-gradient(135deg,#FFD740,#f0a500);color:#1a1208;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap}
  .clan-adm-go:active{transform:scale(.96)}
  .clan-war-hero{text-align:center;padding:18px 14px;border-radius:16px;background:linear-gradient(135deg,rgba(255,82,82,.12),rgba(124,77,255,.06));border:1px solid rgba(255,82,82,.3);margin-bottom:14px}
  .clan-war-lbl{font-size:12px;color:#bba8df;font-weight:700}
  .clan-war-rank{font-size:30px;font-weight:900;color:#ff8a80;margin:4px 0;text-shadow:0 2px 12px rgba(255,82,82,.3)}
  .clan-war-pts{font-size:16px;font-weight:900;color:#ffe082}
  .clan-war-sub{font-size:10px;color:#9fb0d8;margin-top:3px}
  .clan-war-info{font-size:10px;color:#7d8ab8;line-height:1.6;background:rgba(255,255,255,.03);border-radius:11px;padding:11px;margin-bottom:13px}
  .clan-war-row{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:11px;background:rgba(255,255,255,.035);margin-bottom:6px}
  .clan-war-row.mine{background:rgba(255,215,64,.08);border:1px solid rgba(255,215,64,.3)}
  .clan-war-medal{font-size:14px;font-weight:900;min-width:32px;text-align:center;color:#ffd54f}
  .clan-war-nm{flex:1;font-size:12px;font-weight:700;color:#e8eaf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .clan-war-rowpts{font-size:13px;font-weight:900;color:#ff8a80}
  .clan-sys-msg{text-align:center;font-size:11px;font-weight:700;color:#ffe082;background:linear-gradient(135deg,rgba(255,215,64,.12),rgba(124,77,255,.06));border:1px solid rgba(255,215,64,.25);border-radius:12px;padding:9px 12px;margin:8px 6px;line-height:1.4}
  `;
  document.head.appendChild(s);
}

export async function openClan(){
  if(document.getElementById('clanPanel'))return;
  _ensureTreasuryCss();
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){_toast('Klan için giriş gerekli');return;}
  const ov=document.createElement('div'); ov.id='clanPanel'; ov.className='clan-ov';
  const panel=document.createElement('div'); panel.className='clan-panel';
  panel.innerHTML='<div class="clan-head"><div class="clan-title">🏰 KLANLAR</div><button class="clan-x" id="clanClose">✕</button></div><div class="clan-body" id="clanBody"><div class="clan-load">⏳ Yükleniyor…</div></div>';
  ov.appendChild(panel); document.body.appendChild(ov);
  C={ov,panel,myClanId:null,myRole:null,off:[]};
  panel.querySelector('#clanClose').addEventListener('click',closeClan);
  ov.addEventListener('click',e=>{if(e.target===ov)closeClan();});
  await loadMyClan();
}

function closeClan(){
  C&&C.off.forEach(f=>{try{f();}catch(e){}});
  C=null; _clan=null;
  document.getElementById('clanPanel')?.remove();
}

function body(){return document.getElementById('clanBody');}

async function loadMyClan(){
  const st=Auth.getState();
  try{const s=await fdb.get(fdb.ref(db,'users/'+st.uid+'/clanId'));C.myClanId=s.exists()?s.val():null;}catch(e){C.myClanId=null;}
  if(C.myClanId) await renderMyClan();
  else renderNoClan();
}

// ── Klansız ekran ─────────────────────────────────────────────
function renderNoClan(){
  const b=body(); if(!b)return;
  b.innerHTML='';
  const emptyCard=document.createElement('div'); emptyCard.className='clan-card';
  emptyCard.innerHTML='<div class="clan-empty-ico">🏰</div><div class="clan-empty-txt">Henüz bir klana üye değilsin</div>';
  b.appendChild(emptyCard);
  // Arama
  const srchCard=document.createElement('div'); srchCard.className='clan-card';
  srchCard.innerHTML='<div class="clan-lbl">🔍 KLAN ARA</div>'
    +'<div class="clan-row"><input class="clan-in" id="clanSearchQ" placeholder="Klan adı veya [ETİKET]" maxlength="20"><button class="clan-btn p" id="clanSearchBtn">Ara</button></div>'
    +'<div id="clanSearchRes"></div>';
  b.appendChild(srchCard);
  srchCard.querySelector('#clanSearchBtn').addEventListener('click',searchClans);
  srchCard.querySelector('#clanSearchQ').addEventListener('keydown',e=>{if(e.key==='Enter')searchClans();});
  // Davet kutusunu da göster
  renderMyInvites(b);
  // Oluştur
  const createCard=document.createElement('div'); createCard.className='clan-card';
  createCard.innerHTML='<div class="clan-lbl">➕ YENİ KLAN KUR</div>'
    +'<input class="clan-in" id="clanNewName" placeholder="Klan adı (3–20 harf)" maxlength="20" style="margin-bottom:7px">'
    +'<input class="clan-in" id="clanNewTag" placeholder="[ETİKET] (2–5 harf)" maxlength="5" style="text-transform:uppercase;margin-bottom:7px">'
    +'<div class="clan-msg" id="clanCreateMsg"></div>'
    +'<button class="clan-btn p" id="clanCreateBtn" style="width:100%">🏰 Klan Kur</button>';
  b.appendChild(createCard);
  createCard.querySelector('#clanCreateBtn').addEventListener('click',createClan);
}

async function renderMyInvites(b){
  const st=Auth.getState(); if(!st.uid)return;
  let invs={};
  try{const s=await fdb.get(fdb.ref(db,'clanInvites/'+st.uid));invs=s.exists()?s.val():{};}catch(e){}
  const valid=Object.entries(invs).filter(([,v])=>v&&!v.rejected&&!v.accepted&&(Date.now()-(v.ts||0))<86400000);
  if(!valid.length)return;
  const card=document.createElement('div'); card.className='clan-card';
  card.style.borderColor='rgba(0,229,255,.3)';
  card.innerHTML='<div class="clan-lbl" style="color:#00E5FF">📬 KLAN DAVETİ ('+valid.length+')</div>';
  valid.forEach(([k,inv])=>{
    const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)';
    row.innerHTML='<div style="flex:1"><b style="color:#00E5FF">🏰 '+esc(inv.clanName||'Klan')+'</b><div style="font-size:9px;color:#7d8ab8">'+esc(inv.fromName||'?')+' tarafından davet edildin</div></div>'
      +'<button class="clan-btn p" style="padding:5px 10px;font-size:10px" data-acc="'+k+'" data-cid="'+esc(inv.clanId||'')+'">✅ Katıl</button>'
      +'<button class="clan-btn r" style="padding:5px 8px;font-size:10px" data-rej="'+k+'">✕</button>';
    row.querySelector('[data-acc]').addEventListener('click',async e=>{
      const cid=e.target.dataset.cid; if(!cid)return;
      const st2=Auth.getState();
      try{
        await fdb.update(fdb.ref(db,'clans/'+cid+'/members/'+st2.uid),{name:st2.displayName||'Oyuncu',role:'member',joinedAt:Date.now()});
        await fdb.update(fdb.ref(db,'users/'+st2.uid),{clanId:cid});
        await fdb.update(fdb.ref(db,'clanInvites/'+st2.uid+'/'+k),{accepted:true});
        C.myClanId=cid; await renderMyClan();
      }catch(err){_toast('Katılım başarısız');}
    });
    row.querySelector('[data-rej]').addEventListener('click',async e=>{
      try{await fdb.update(fdb.ref(db,'clanInvites/'+Auth.getState().uid+'/'+e.target.dataset.rej),{rejected:true});row.remove();}catch(err){}
    });
    card.appendChild(row);
  });
  b.insertBefore(card,b.firstChild);
}

async function searchClans(){
  const q=(document.getElementById('clanSearchQ').value||'').trim().toLowerCase();
  const res=document.getElementById('clanSearchRes'); if(!res)return;
  if(q.length<2){res.innerHTML='<div class="clan-msg bad">En az 2 harf gir</div>';return;}
  res.innerHTML='<div class="clan-load">Aranıyor…</div>';
  try{
    const snap=await fdb.get(fdb.ref(db,'clans'));
    if(!snap.exists()){res.innerHTML='<div class="clan-msg bad">Sonuç yok</div>';return;}
    const hits=[];snap.forEach(ch=>{const v=ch.val();if(!v)return;if((v.name||'').toLowerCase().includes(q)||(v.tag||'').toLowerCase().includes(q))hits.push({id:ch.key,...v});});
    if(!hits.length){res.innerHTML='<div class="clan-msg bad">Sonuç yok</div>';return;}
    res.innerHTML='';
    hits.slice(0,8).forEach(c=>{
      const cnt=Object.keys(c.members||{}).length;
      const row=document.createElement('div'); row.className='clan-res';
      row.innerHTML='<div style="min-width:0;flex:1;overflow:hidden"><b style="color:#ffd86b;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;display:block">['+esc(c.tag||'?')+'] '+esc(c.name||'Klan')+'</b><div style="font-size:9px;color:#7d8ab8">👥 '+cnt+' üye · 🥜 '+fmt(c.kaju)+'</div></div>'
        +'<button class="clan-btn p" style="padding:6px 11px;flex-shrink:0" data-join="'+esc(c.id)+'">Katıl</button>';
      row.querySelector('[data-join]').addEventListener('click',()=>joinClan(c.id));
      res.appendChild(row);
    });
  }catch(e){res.innerHTML='<div class="clan-msg bad">Arama hatası</div>';}
}

async function createClan(){
  const name=(document.getElementById('clanNewName').value||'').trim();
  const tag=(document.getElementById('clanNewTag').value||'').trim().toUpperCase();
  const msg=document.getElementById('clanCreateMsg');
  if(name.length<3){msg.textContent='Klan adı en az 3 harf';msg.className='clan-msg bad';return;}
  if(tag.length<2||tag.length>5){msg.textContent='Etiket 2–5 harf';msg.className='clan-msg bad';return;}
  const st=Auth.getState();
  try{
    const clanId='c'+Date.now()+'_'+Math.floor(Math.random()*9999);
    await fdb.set(fdb.ref(db,'clans/'+clanId),{name,tag,leader:st.uid,members:{[st.uid]:{name:st.displayName||'Oyuncu',role:'leader',joinedAt:Date.now()}},kaju:0,wins:0,createdAt:Date.now(),nameChanges:0});
    await fdb.update(fdb.ref(db,'users/'+st.uid),{clanId});
    C.myClanId=clanId; await renderMyClan();
  }catch(e){msg.textContent='✗ Kurulamadı: '+(e.message||e);msg.className='clan-msg bad';}
}

async function joinClan(clanId){
  const st=Auth.getState();
  try{
    // Ban kontrolü
    const ban=await fdb.get(fdb.ref(db,'clans/'+clanId+'/banned/'+st.uid));
    if(ban.exists()&&ban.val()){_toast('Bu klandan banlısın, katılamazsın.');return;}
    await fdb.update(fdb.ref(db,'clans/'+clanId+'/members/'+st.uid),{name:st.displayName||'Oyuncu',role:'member',joinedAt:Date.now()});
    await fdb.update(fdb.ref(db,'users/'+st.uid),{clanId});
    C.myClanId=clanId; await renderMyClan();
  }catch(e){_toast('Katılım başarısız: '+(e.message||e));}
}

// ── Klanım ────────────────────────────────────────────────────
async function renderMyClan(){
  const b=body(); if(!b)return;
  b.innerHTML='<div class="clan-load">Yükleniyor…</div>';
  try{
    const snap=await fdb.get(fdb.ref(db,'clans/'+C.myClanId));
    if(!snap.exists()){await leaveClanClean();return;}
    _clan=snap.val()||{};
    const st=Auth.getState();
    C.myRole=_clan.leader===st.uid?'leader':(_clan.viceLeaders&&_clan.viceLeaders[st.uid])?'vice':'member';
    const cnt=Object.keys(_clan.members||{}).length;
    const nameChanges=_clan.nameChanges||0;
    b.innerHTML='';
    const banner=document.createElement('div'); banner.className='clan-card clan-banner';
    banner.innerHTML=''
      +'<div class="clan-banner-row">'
        +'<div class="clan-badge-box">'+esc(_clan.tag||'?')+'</div>'
        +'<div class="clan-banner-info">'
          +'<div class="clan-banner-name">'+esc(_clan.name||'Klan')+'</div>'
          +'<div class="clan-banner-meta">👥 '+cnt+' üye · 🥜 '+fmt(_clan.kaju)+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="clan-tabs" style="margin-top:10px" id="clanTabs"></div>';
    b.appendChild(banner);
    const tabBody=document.createElement('div'); tabBody.id='clanTabBody'; b.appendChild(tabBody);
    const leaveBtn=document.createElement('button'); leaveBtn.className='clan-btn r'; leaveBtn.style.cssText='width:100%;margin-top:8px'; leaveBtn.textContent='🚪 Klandan Ayrıl';
    leaveBtn.addEventListener('click',leaveClan); b.appendChild(leaveBtn);
    const tabs=[['members','👥 Üyeler'],['treasury','💰 Kasa'],['war','⚔️ Savaş'],['chat','💬 Sohbet'],['leader','🏆 Liderlik']];
    if(C.myRole==='leader'||C.myRole==='vice') tabs.push(['manage','⚙️ Yönet']);
    const tabsEl=banner.querySelector('#clanTabs');
    tabs.forEach(([id,label])=>{
      const btn=document.createElement('button'); btn.className='clan-tab'; btn.textContent=label;
      btn.addEventListener('click',()=>{tabsEl.querySelectorAll('.clan-tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');loadTab(id);});
      tabsEl.appendChild(btn);
    });
    tabsEl.firstChild.classList.add('active');
    loadTab('members');
    listenMembers();
  }catch(e){b.innerHTML='<div class="clan-msg bad">Klan yüklenemedi</div>';}
}

function loadTab(t){
  if(t==='members')renderMembers();
  else if(t==='treasury')renderTreasury();
  else if(t==='war')renderClanWar();
  else if(t==='chat')renderChat();
  else if(t==='leader')renderLeader();
  else if(t==='manage')renderManage();
}

// ── Klan Kasası (ortak Kaju havuzu) ──────────────────────────
// ══════════ KLAN SAVAŞLARI ══════════
// Haftalık: üyelerin galibiyetleri klana puan kazandırır.
// Firebase: clanWars/{weekId}/{clanId} = { name, tag, points, members:{uid:pts} }
function _warWeekId(){
  const d = new Date();
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const wk = Math.ceil((((dt - yearStart)/86400000)+1)/7);
  return dt.getUTCFullYear()+'-W'+String(wk).padStart(2,'0');
}

// Bir oyuncu maç kazanınca klanına puan ekle (store.js veya oyunlar çağırabilir)
export async function addClanWarPoints(pts){
  const st = Auth.getState();
  if(!st.uid || !pts) return;
  let cid = null;
  try{ const s = await fdb.get(fdb.ref(db,'users/'+st.uid+'/clanId')); cid = s.exists()?s.val():null; }catch(e){}
  if(!cid) return;   // klanı yoksa puan yok
  const wk = _warWeekId();
  try{
    let cname='Klan', ctag='?';
    try{ const cn=await fdb.get(fdb.ref(db,'clans/'+cid)); if(cn.exists()){ const cv=cn.val(); cname=cv.name||'Klan'; ctag=cv.tag||'?'; } }catch(e){}
    await fdb.runTransaction(fdb.ref(db,'clanWars/'+wk+'/'+cid+'/points'), p=>(p||0)+pts);
    await fdb.runTransaction(fdb.ref(db,'clanWars/'+wk+'/'+cid+'/members/'+st.uid), p=>(p||0)+pts);
    await fdb.update(fdb.ref(db,'clanWars/'+wk+'/'+cid), { name:cname, tag:ctag });
  }catch(e){}
}

async function renderClanWar(){
  const body=document.getElementById('clanTabBody'); if(!body||!_clan) return;
  const wk = _warWeekId();
  body.innerHTML = '<div style="text-align:center;color:#9fb0d8;font-size:12px;padding:20px">⚔️ Savaş yükleniyor…</div>';
  // Tüm klanların bu haftaki puanları
  let wars = [];
  let myClanPts = 0, myMembers = {};
  try{
    const snap = await fdb.get(fdb.ref(db,'clanWars/'+wk));
    if(snap.exists()){
      const v = snap.val()||{};
      wars = Object.keys(v).map(cid=>({ cid, name:v[cid].name||'Klan', tag:v[cid].tag||'?', points:v[cid].points||0, members:v[cid].members||{} }));
      wars.sort((a,b)=>b.points-a.points);
      const mine = v[C.myClanId];
      if(mine){ myClanPts = mine.points||0; myMembers = mine.members||{}; }
    }
  }catch(e){}
  const myRank = wars.findIndex(w=>w.cid===C.myClanId)+1;
  // Ödül: ilk 3 klana kasaya bonus
  const prizeText = '🥇 1.: 50.000 · 🥈 2.: 30.000 · 🥉 3.: 15.000 Kaju (kasaya)';

  let html = '<div class="clan-war-hero">'
    + '<div class="clan-war-lbl">⚔️ Haftalık Klan Savaşı</div>'
    + '<div class="clan-war-rank">'+(myRank>0?'#'+myRank:'—')+'</div>'
    + '<div class="clan-war-pts">'+fmt(myClanPts)+' puan</div>'
    + '<div class="clan-war-sub">Her galibiyet klanına puan kazandırır</div>'
    + '</div>';

  html += '<div class="clan-war-info">🏆 '+prizeText+'<br>🗓️ Her pazartesi sıfırlanır. Üyelerin maç galibiyetleri klan puanına eklenir!</div>';

  // Sıralama
  html += '<div class="clan-sect">🏅 KLAN SIRALAMASI</div>';
  if(!wars.length){
    html += '<div style="text-align:center;color:#9fb0d8;font-size:12px;padding:16px">Bu hafta henüz savaş puanı yok. İlk galibiyeti sen getir! ⚔️</div>';
  } else {
    html += wars.slice(0,20).map((w,i)=>{
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
      const isMine = w.cid===C.myClanId;
      return '<div class="clan-war-row'+(isMine?' mine':'')+'">'
        + '<div class="clan-war-medal">'+medal+'</div>'
        + '<div class="clan-war-nm">['+esc(w.tag)+'] '+esc(w.name)+'</div>'
        + '<div class="clan-war-rowpts">'+fmt(w.points)+'</div>'
        + '</div>';
    }).join('');
  }

  // Klanımın en çok puan getiren üyeleri
  const memArr = Object.keys(myMembers).map(uid=>({uid, pts:myMembers[uid]})).sort((a,b)=>b.pts-a.pts).slice(0,5);
  if(memArr.length){
    html += '<div class="clan-sect">⭐ Klanının Yıldızları</div>';
    // İsimleri çek
    const names = await Promise.all(memArr.map(async m=>{
      try{ const u=await fdb.get(fdb.ref(db,'users/'+m.uid)); return u.exists()?(u.val().nick||u.val().name||'Üye'):'Üye'; }catch(e){ return 'Üye'; }
    }));
    html += memArr.map((m,i)=>'<div class="clan-donrow"><span>'+['🥇','🥈','🥉','4.','5.'][i]+' '+esc(names[i])+'</span><span style="color:#ffd86b">⚔️ '+fmt(m.pts)+'</span></div>').join('');
  }

  body.innerHTML = html;
}

async function renderTreasury(){
  const body=document.getElementById('clanTabBody'); if(!body||!_clan) return;
  const st=Auth.getState();
  const isAdmin = st.isAdmin === true;
  const pool=_clan.kaju||0;
  const myKaju=(window.Hero&&window.Hero.Store&&window.Hero.Store.getState&&window.Hero.Store.getState().kaju)||0;
  // Bağış geçmişi (son katkılar)
  let donors='';
  try{
    const snap=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/donations'));
    if(snap.exists()){
      const v=snap.val()||{};
      const arr=Object.keys(v).map(k=>v[k]).sort((a,b)=>(b.ts||0)-(a.ts||0)).slice(0,10);
      donors=arr.map(d=>'<div class="clan-donrow"><span>'+esc(d.name||'Üye')+'</span><span style="color:#ffd86b">🥜 '+fmt(d.amount)+'</span></div>').join('');
    }
  }catch(e){}
  // En çok bağış yapanlar (toplam)
  let topDonors='';
  try{
    const snap=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/donorTotals'));
    if(snap.exists()){
      const v=snap.val()||{};
      const arr=Object.keys(v).map(uid=>({uid,...v[uid]})).sort((a,b)=>(b.total||0)-(a.total||0)).slice(0,3);
      topDonors=arr.map((d,i)=>'<div class="clan-donrow"><span>'+['🥇','🥈','🥉'][i]+' '+esc(d.name||'Üye')+'</span><span style="color:#ffd86b">🥜 '+fmt(d.total)+'</span></div>').join('');
    }
  }catch(e){}

  body.innerHTML=''
    +'<div class="clan-treasury-hero">'
      +'<div class="clan-treasury-lbl">💰 Klan Kasası</div>'
      +'<div class="clan-treasury-amt">🥜 '+fmt(pool)+'</div>'
      +'<div class="clan-treasury-sub">Üyelerin ortak ödül havuzu</div>'
    +'</div>'
    +'<div class="clan-donate-box">'
      +'<div style="font-size:11px;color:#bba8df;margin-bottom:7px">Kasaya bağış yap (senin Kaju: '+fmt(myKaju)+')</div>'
      +'<div class="clan-donate-row">'
        +'<button class="clan-don-amt" data-don="500">500</button>'
        +'<button class="clan-don-amt" data-don="1000">1.000</button>'
        +'<button class="clan-don-amt" data-don="5000">5.000</button>'
      +'</div>'
    +'</div>'
    +(isAdmin ? (
        '<div class="clan-admin-box">'
        +'<div class="clan-admin-title">👑 Admin Kaju Desteği</div>'
        +'<div class="clan-admin-sub">Kasaya sınırsız destek — Kaju\'ndan düşmez</div>'
        +'<div class="clan-donate-row">'
          +'<button class="clan-adm-amt" data-adm="100000">100.000</button>'
          +'<button class="clan-adm-amt" data-adm="500000">500.000</button>'
          +'<button class="clan-adm-amt" data-adm="1000000">1.000.000</button>'
        +'</div>'
        +'<div style="display:flex;gap:7px;margin-top:8px">'
          +'<input id="clanAdmCustom" type="number" min="1" placeholder="Özel miktar…" style="flex:1;min-width:0;padding:10px;border-radius:10px;border:1px solid rgba(255,215,64,.3);background:rgba(255,215,64,.06);color:#ffe082;font-size:13px;font-weight:700">'
          +'<button class="clan-adm-go" id="clanAdmGo">💰 Destekle</button>'
        +'</div>'
        +'</div>'
      ) : '')
    +(topDonors?'<div class="clan-sect">🏆 En Cömert Üyeler</div>'+topDonors:'')
    +(donors?'<div class="clan-sect">📜 Son Bağışlar</div>'+donors:'')
    +'<div class="clan-treasury-info">💡 Klan kasası, klan turnuvalarında ödül olarak dağıtılır ve klan seviyesini yükseltir. Cömert üyeler liderlik tablosunda öne çıkar!</div>';

  body.querySelectorAll('[data-don]').forEach(btn=>btn.addEventListener('click',()=>donateToClan(parseInt(btn.dataset.don))));
  // Admin destek butonları (sınırsız, Kaju'dan düşmez)
  body.querySelectorAll('[data-adm]').forEach(btn=>btn.addEventListener('click',()=>adminDonateToClan(parseInt(btn.dataset.adm))));
  const admGo=body.querySelector('#clanAdmGo');
  if(admGo) admGo.addEventListener('click',()=>{
    const inp=body.querySelector('#clanAdmCustom');
    const amt=parseInt(inp&&inp.value||'0');
    if(!amt||amt<1){ _toast('Geçerli bir miktar gir',true); return; }
    adminDonateToClan(amt);
  });
}

// ── Admin Kaju desteği — sınırsız, admin'in Kaju'sundan DÜŞMEZ ──
async function adminDonateToClan(amount){
  const st=Auth.getState();
  if(!st.uid||!C||!C.myClanId) return;
  if(st.isAdmin !== true){ _toast('Bu işlem yalnızca admin içindir',true); return; }
  if(!amount||amount<1){ _toast('Geçersiz miktar',true); return; }
  // Üst sınır: Kaju veri tipi güvenliği (çok büyük sayı taşmasın)
  const MAX = 1000000000;   // 1 milyar tavan (güvenlik)
  if(amount>MAX){ _toast('En fazla '+fmt(MAX)+' destek verilebilir',true); return; }
  if(!confirm('👑 Admin desteği: Klan kasasına '+fmt(amount)+' Kaju eklensin mi?\n(Senin Kaju\'ndan düşmez)')) return;
  try{
    // Klan kasasına ekle (admin'den düşmeden)
    await fdb.runTransaction(fdb.ref(db,'clans/'+C.myClanId+'/kaju'),c=>(c||0)+amount);
    // Bağış kaydı (admin desteği olarak işaretli)
    const name='👑 '+(st.displayName||'Admin')+' (Destek)';
    await fdb.push(fdb.ref(db,'clans/'+C.myClanId+'/donations'),{uid:st.uid,name,amount,ts:Date.now(),adminGift:true});
    // Yerel güncelle
    _clan.kaju=(_clan.kaju||0)+amount;
    // 💬 Klan sohbetine sistem mesajı (her destekte)
    try{
      await fdb.push(fdb.ref(db,'clans/'+C.myClanId+'/chat'),{
        uid:'system', name:'👑 Sistem', avatar:'💰', isSystem:true, isAdmin:true,
        text:'👑 '+(st.displayName||'Admin')+' klan kasasına '+fmt(amount)+' Kaju destek verdi! 🎉',
        ts:Date.now()
      });
    }catch(e){}
    // 🔔 Büyük destek (100.000+) → tüm klan üyelerine push bildirimi
    if(amount >= 100000){
      try{
        const memSnap = await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members'));
        const members = memSnap.exists() ? memSnap.val() : {};
        const clanName = _clan.name || 'Klanın';
        const notifText = '💰 '+clanName+' kasasına '+fmt(amount)+' Kaju destek geldi! 🎉';
        await Promise.all(Object.keys(members).map(async muid=>{
          if(muid === st.uid) return;   // kendine bildirim gönderme
          try{
            await fdb.push(fdb.ref(db,'userNotifs/'+muid),{
              type:'clan', icon:'💰', text:notifText, ts:Date.now(), fromUid:st.uid
            });
          }catch(e){}
        }));
      }catch(e){}
    }
    _toast('👑 Admin desteği: '+fmt(amount)+' Kaju kasaya eklendi!'+(amount>=100000?' · Üyelere bildirildi':''));
    renderTreasury();
    renderMyClan();
  }catch(e){ _toast('Destek başarısız',true); }
}

async function donateToClan(amount){
  const st=Auth.getState();
  if(!st.uid||!C||!C.myClanId) return;
  const Store=(window.Hero&&window.Hero.Store);
  const myKaju=(Store&&Store.getState&&Store.getState().kaju)||0;
  if(myKaju<amount){ _toast('Yetersiz Kaju (gerekli: '+fmt(amount)+')',true); return; }
  if(!confirm('💰 Klan kasasına '+fmt(amount)+' Kaju bağışla?')) return;
  try{
    // Kaju'yu oyuncudan düş
    if(Store&&Store.addKaju) await Store.addKaju(-amount,'clan','💰 Klan kasası bağışı');
    // Klan kasasına ekle
    await fdb.runTransaction(fdb.ref(db,'clans/'+C.myClanId+'/kaju'),c=>(c||0)+amount);
    // Bağış kaydı + toplam
    const name=st.displayName||'Üye';
    await fdb.push(fdb.ref(db,'clans/'+C.myClanId+'/donations'),{uid:st.uid,name,amount,ts:Date.now()});
    await fdb.runTransaction(fdb.ref(db,'clans/'+C.myClanId+'/donorTotals/'+st.uid+'/total'),c=>(c||0)+amount);
    await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/donorTotals/'+st.uid),{name});
    // Yerel güncelle
    _clan.kaju=(_clan.kaju||0)+amount;
    _toast('💰 '+fmt(amount)+' Kaju kasaya eklendi! Teşekkürler 🙏');
    renderTreasury();
    const meta=document.querySelector('.clan-banner-meta'); // banner kasa rakamını güncelle
    renderMyClan();
  }catch(e){ _toast('Bağış başarısız',true); }
}

// ── Üyeler ────────────────────────────────────────────────────
function listenMembers(){
  if(!C)return;
  const off=fdb.onValue(fdb.ref(db,'clans/'+C.myClanId+'/members'),snap=>{
    if(snap.exists()&&_clan)_clan.members=snap.val();
    const act=document.querySelector('.clan-tab.active');
    if(act&&act.textContent.includes('Üye'))renderMembers();
  });
  C.off.push(off);
}

async function renderMembers(){
  const box=document.getElementById('clanTabBody'); if(!box||!_clan)return;
  const st=Auth.getState();
  const mems=_clan.members||{};
  // Canlı avatar/nick çek
  const rows=await Promise.all(Object.keys(mems).map(async uid=>{
    const m={uid,...mems[uid]};
    try{const s=await fdb.get(fdb.ref(db,'users/'+uid));if(s.exists()){const v=s.val();m.name=v.nick||v.displayName||v.name||m.name||'Oyuncu';m.avatar=v.avatar||'👤';}}catch(e){}
    return m;
  }));
  rows.sort((a,b)=>{const o={leader:0,vice:1,member:2};return(o[a.role]||2)-(o[b.role]||2);});
  // Admin seti
  let admins={};
  try{const s=await fdb.get(fdb.ref(db,'admins'));admins=s.exists()?s.val():{};}catch(e){}
  const isLeader=C.myRole==='leader', isVice=C.myRole==='vice', canMgmt=isLeader||isVice;
  box.innerHTML='';
  const card=document.createElement('div'); card.className='clan-card';
  rows.forEach(m=>{
    const isPAdmin=!!admins[m.uid],isL=m.role==='leader',isV=m.role==='vice';
    const gc=isPAdmin||isL?'ng-gold':isV?'ng-classic':'';
    const nc=isPAdmin||isL?'#FFD740':isV?'#00E5FF':'#cdd8f5';
    const badges=[]
    if(isPAdmin)badges.push('<span class="chat-admin-badge">👑 Admin</span>');
    if(isL)badges.push('<span class="chat-admin-badge" style="color:#FFD740;background:rgba(255,215,64,.1);border-color:rgba(255,215,64,.3)">👑 Lider</span>');
    if(isV)badges.push('<span class="chat-admin-badge" style="color:#00E5FF;background:rgba(0,229,255,.07);border-color:rgba(0,229,255,.28)">⭐ Varis</span>');
    const row=document.createElement('div'); row.className='clan-member'; row.dataset.muid=m.uid;
    row.innerHTML=''
      +'<div class="clan-mava" style="font-size:'+(isL?'20':'16')+'px">'+(m.avatar||'👤')+'</div>'
      +'<div style="flex:1;min-width:0;overflow:hidden">'
        +'<div style="display:flex;align-items:center;gap:3px;flex-wrap:wrap">'
          +'<b class="'+gc+'" style="color:'+nc+';max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(m.name||'Üye')+'</b>'+badges.join('')
        +'</div>'
        +'<div style="font-size:9px;color:#6d7aa8;white-space:nowrap">'+tAgo(m.joinedAt)+' önce katıldı</div>'
      +'</div>'
      +'<div style="display:flex;gap:3px;flex-shrink:0">'
        +(isLeader&&!isL&&!isV?'<button class="clan-btn p" style="padding:4px 7px;font-size:9px" title="Varis Yap" data-vice="'+m.uid+'">⭐</button>':'')
        +(isLeader&&isV?'<button class="clan-btn" style="padding:4px 7px;font-size:9px;background:rgba(255,255,255,.07)" title="Varislikten Al" data-rmvice="'+m.uid+'">✕⭐</button>':'')
        +(canMgmt&&!isL?'<button class="clan-btn" style="padding:4px 7px;font-size:9px;background:rgba(255,152,0,.1);color:#FFB74D;border:1px solid rgba(255,152,0,.3)" title="Davet Gönder" data-inv="'+m.uid+'">✉️</button>':'')
        +(canMgmt&&m.uid!==st.uid&&!isL?'<button class="clan-btn r" style="padding:4px 7px;font-size:9px" title="Kick/Ban" data-kick="'+m.uid+'" data-name="'+esc(m.name||'Üye')+'">✕</button>':'')
      +'</div>';
    row.querySelector('.clan-mava').addEventListener('click',async()=>{
      try{const mod=await import('./social.js');mod.openPlayerCard(m.uid);}catch(e){}
    });
    const viceBtn=row.querySelector('[data-vice]');
    if(viceBtn)viceBtn.addEventListener('click',async()=>{
      if(!confirm('Varis yap?'))return;
      const ms=_clan.members||{};
      for(const uid of Object.keys(ms)){if(ms[uid]&&ms[uid].role==='vice')await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid),{role:'member'}).catch(()=>{});}
      await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/members/'+viceBtn.dataset.vice),{role:'vice'});
      renderMembers();
    });
    const rmVice=row.querySelector('[data-rmvice]');
    if(rmVice)rmVice.addEventListener('click',async()=>{
      if(!confirm('Varisliği kaldır?'))return;
      await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/members/'+rmVice.dataset.rmvice),{role:'member'}).catch(()=>{});
      renderMembers();
    });
    const kickBtn=row.querySelector('[data-kick]');
    if(kickBtn)kickBtn.addEventListener('click',()=>showKickMenu(kickBtn.dataset.kick,kickBtn.dataset.name));
    card.appendChild(row);
  });
  box.appendChild(card);
}

// Kick menüsü: At / Ban (nedenli)
function showKickMenu(uid,name){
  const ov=document.createElement('div'); ov.className='nick-modal-ov';
  const inn=document.createElement('div'); inn.className='nick-modal'; inn.style.maxWidth='280px';
  inn.innerHTML='<div class="nm-title">⚠️ '+esc(name)+'</div>'
    +'<input class="clan-in" id="kickReason" placeholder="Neden (isteğe bağlı)" maxlength="80" style="width:100%;margin-bottom:10px">'
    +'<div class="nm-actions" style="flex-direction:column;gap:7px">'
      +'<button class="nm-btn" style="background:rgba(255,152,0,.1);color:#FFB74D;border:1px solid rgba(255,152,0,.3)" id="doKick">🔨 Klandan At</button>'
      +'<button class="nm-btn" style="background:rgba(255,82,82,.1);color:#FF5252;border:1px solid rgba(255,82,82,.3)" id="doBan">🚫 Banla</button>'
      +'<button class="nm-btn nm-cancel" id="kickClose">İptal</button>'
    +'</div>';
  ov.appendChild(inn); document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  inn.querySelector('#kickClose').addEventListener('click',()=>ov.remove());
  inn.querySelector('#doKick').addEventListener('click',async()=>{
    const reason=(inn.querySelector('#kickReason').value||'').trim() || 'Kural İhlali';
    // Üyelik kontrolü
    try{
      const mem=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid));
      if(!mem.exists()||!mem.val()){ _toast('⚠️ '+esc(name)+' artık klanda değil, atılamaz.'); ov.remove(); renderMembers(); return; }
    }catch(e){}
    if(!confirm('Klandan at?'))return;
    try{
      await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid),null);
      await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null);
      try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'🔨',text:'🔨 '+(_clan&&_clan.name||'Klan')+'\'dan atıldın!'+(reason?' Neden: '+reason:''),ts:Date.now()});}catch(e){}
      ov.remove(); renderMembers();
    }catch(e){_toast('Yapılamadı');}
  });
  inn.querySelector('#doBan').addEventListener('click',async()=>{
    const reason=(inn.querySelector('#kickReason').value||'').trim() || 'Kural İhlali';
    try{
      const mem=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid));
      if(!mem.exists()||!mem.val()){ _toast('⚠️ '+esc(name)+' artık klanda değil. Yine de ban listesine eklensin mi?'); }
    }catch(e){}
    if(!confirm('Banla?'))return;
    try{
      await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid),null);
      await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/banned/'+uid),{reason:reason||'—',bannedAt:Date.now(),bannedBy:Auth.getState().uid});
      await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null);
      try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'🚫',text:'🚫 '+(_clan&&_clan.name||'Klan')+'\'dan banlandın!'+(reason?' Neden: '+reason:''),ts:Date.now()});}catch(e){}
      ov.remove(); renderMembers();
    }catch(e){_toast('Yapılamadı');}
  });
}

// ── Davet gönder ──────────────────────────────────────────────
// Profil kartından klana davet — C state'e bağlı değil, klanı Firebase'den çeker
export async function inviteToClanByUid(toUid, toName){
  const st = Auth.getState();
  if(!st.uid){ _toast('Giriş gerekli'); return; }
  let cid = null;
  try{ const s = await fdb.get(fdb.ref(db,'users/'+st.uid+'/clanId')); cid = s.exists() ? s.val() : null; }catch(e){}
  if(!cid){ _toast('Önce bir klana katılmalısın'); return; }
  try{
    // Zaten üye mi?
    const already = await fdb.get(fdb.ref(db,'clans/'+cid+'/members/'+toUid));
    if(already.exists() && already.val()){ _toast(toName+' zaten klanında!'); return; }
    let clanName = 'Klan';
    try{ const cn = await fdb.get(fdb.ref(db,'clans/'+cid+'/name')); if(cn.exists()) clanName = cn.val(); }catch(e){}
    const invKey = 'inv_'+Date.now().toString(36);
    await fdb.set(fdb.ref(db,'clanInvites/'+toUid+'/'+invKey), { clanId:cid, clanName, fromUid:st.uid, fromName:st.displayName||'Oyuncu', ts:Date.now() });
    await fdb.push(fdb.ref(db,'userNotifs/'+toUid), { type:'clan', icon:'🏰', text:'🏰 '+(st.displayName||'Oyuncu')+' seni '+clanName+' klanına davet etti!', ts:Date.now(), fromUid:st.uid });
    _toast('✅ '+toName+' klana davet edildi!');
  }catch(e){ _toast('Davet gönderilemedi'); }
}

export async function sendClanInvite(toUid,toName){
  if(!C||!C.myClanId){_toast('Önce klana gir');return;}
  const st=Auth.getState();
  try{
    const already=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members/'+toUid));
    if(already.exists()&&already.val()){_toast(toName+' zaten klanında!');return;}
    const invKey='inv_'+Date.now().toString(36);
    await fdb.set(fdb.ref(db,'clanInvites/'+toUid+'/'+invKey),{clanId:C.myClanId,clanName:_clan&&_clan.name||'Klan',fromUid:st.uid,fromName:st.displayName||'Oyuncu',ts:Date.now()});
    await fdb.push(fdb.ref(db,'userNotifs/'+toUid),{icon:'🏰',text:'🏰 '+esc(st.displayName||'Oyuncu')+' seni '+esc(_clan&&_clan.name||'klana')+' davet etti!',ts:Date.now()});
    _toast('✅ '+toName+' davet edildi!');
  }catch(e){_toast('Davet gönderilemedi');}
}

// ── Klan Sohbeti ──────────────────────────────────────────────
function renderChat(){
  const box=document.getElementById('clanTabBody'); if(!box)return;
  box.innerHTML='';
  const card=document.createElement('div'); card.className='clan-card'; card.style.padding='0;overflow:hidden';
  const meAdm=Auth.getState().isAdmin===true;
  card.innerHTML=(meAdm?'<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.06)"><button class="clan-btn r" style="width:100%;font-size:10px;padding:6px" id="clanChatClear">🧹 Admin: Sohbeti Temizle</button></div>':'')+'<div class="clan-chat" id="clanChatList"><div class="clan-load">Yükleniyor…</div></div><div class="clan-row" style="padding:8px;border-top:1px solid rgba(255,255,255,.06)"><input class="clan-in" id="clanChatInp" placeholder="Klan sohbetine yaz…" maxlength="200"><button class="clan-btn p" id="clanChatSend">➤</button></div>';
  box.appendChild(card);
  card.querySelector('#clanChatSend').addEventListener('click',sendChat);
  card.querySelector('#clanChatInp').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  const clrBtn=card.querySelector('#clanChatClear');
  if(clrBtn) clrBtn.addEventListener('click',async()=>{
    if(!confirm('⚠️ Tüm klan sohbeti silinsin mi? (Admin işlemi)'))return;
    try{await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/chat'),null);}catch(e){_toast('Yapılamadı');}
  });
  const offC=fdb.onValue(fdb.query(fdb.ref(db,'clans/'+C.myClanId+'/chat'),fdb.limitToLast(40)),snap=>{
    const list=document.getElementById('clanChatList'); if(!list)return;
    const me=Auth.getState().uid;
    const rows=[]; if(snap.exists())snap.forEach(ch=>{const v=ch.val(); if(v) rows.push({...v, _key:ch.key});});
    rows.sort((a,b)=>(a.ts||0)-(b.ts||0));
    if(!rows.length){list.innerHTML='<div class="clan-load" style="color:#5d6890">İlk mesajı sen yaz! 🏰</div>';return;}
    const meAdmin=Auth.getState().isAdmin===true;
    const meLeader=C.myRole==='leader'||C.myRole==='vice';
    list.innerHTML=rows.map(m=>{
      // Sistem mesajı (admin desteği vb.) → özel ortalanmış rozet
      if(m.isSystem){
        return '<div class="clan-sys-msg">'+esc(m.text||'')+'</div>';
      }
      const within5=(Date.now()-(m.ts||0))<300000;
      const canEdit=(m.uid===me&&within5)||meAdmin;
      const canDel=m.uid===me||meAdmin||meLeader;
      let acts='';
      if(canEdit) acts+=' <span class="clan-chat-act edit" data-cedit="'+esc(m._key||'')+'" data-ctxt="'+esc(m.text||'')+'">✏️ Düzenle</span>';
      if(canDel) acts+=' <span class="clan-chat-act del" data-cdel="'+esc(m._key||'')+'">🗑 Sil</span>';
      const nameHtml=m.isAdmin===true
        ? '<span class="admin-crown">👑</span><span class="admin-nick-glow" style="font-size:10px">'+esc(m.name||'Admin')+'</span>'
        : '<span style="font-size:10px;font-weight:800;color:'+(m.uid===me?'#00E5FF':'#A78BFA')+'">'+esc(m.name||'Üye')+'</span>';
      return '<div class="clan-chat-row'+(m.uid===me?' mine':'')+(m.isAdmin?' admin-msg':'')+'"><div class="clan-chat-ava">'+(m.avatar||'👤')+'</div><div style="flex:1"><div>'+nameHtml+(m.edited?' <span style="font-size:7px;opacity:.5">(düzenlendi)</span>':'')+'</div><div style="font-size:12px;color:#c4c4e0">'+esc(m.text)+'</div><div style="font-size:8px;color:#505074">'+tAgo(m.ts)+acts+'</div></div></div>';
    }).join('');
    // Düzenle/sil listener
    list.querySelectorAll('[data-cdel]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation(); const k=b.dataset.cdel; if(!k)return;
      if(!confirm('Mesaj silinsin mi?'))return;
      try{await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/chat/'+k),null);}catch(err){}
    }));
    list.querySelectorAll('[data-cedit]').forEach(b=>b.addEventListener('click',async e=>{
      e.stopPropagation(); const k=b.dataset.cedit; if(!k)return;
      const cur=b.dataset.ctxt; const nt=prompt('Mesajı düzenle:',cur);
      if(nt&&nt.trim()&&nt.trim()!==cur){try{await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/chat/'+k),{text:nt.trim().slice(0,200),edited:true});}catch(err){}}
    }));
    list.scrollTop=list.scrollHeight;
  });
  if(C)C.off.push(offC);
}
async function sendChat(){
  const inp=document.getElementById('clanChatInp'); if(!inp)return;
  const text=inp.value.trim(); if(!text)return;
  const st=Auth.getState(); inp.value='';
  const cMsg={uid:st.uid,name:st.displayName||'Üye',avatar:(st.profile&&st.profile.avatar)||'👤',text:text.slice(0,200),ts:Date.now()};
  if(st.isVisibleAdmin===true) cMsg.isAdmin=true;
  try{await fdb.push(fdb.ref(db,'clans/'+C.myClanId+'/chat'),cMsg);}catch(e){_toast('Gönderilemedi');}
}

// ── Klan Liderliği ────────────────────────────────────────────
async function renderLeader(){
  const box=document.getElementById('clanTabBody'); if(!box)return;
  box.innerHTML='<div class="clan-card"><div class="clan-load">Yükleniyor…</div></div>';
  try{
    const snap=await fdb.get(fdb.query(fdb.ref(db,'clans'),fdb.orderByChild('kaju'),fdb.limitToLast(20)));
    if(!snap.exists()){box.innerHTML='<div class="clan-card"><i>Henüz klan yok</i></div>';return;}
    const rows=[];snap.forEach(ch=>{rows.push({id:ch.key,...ch.val()});});
    rows.sort((a,b)=>(b.kaju||0)-(a.kaju||0));
    box.innerHTML='';
    const card=document.createElement('div'); card.className='clan-card';
    rows.forEach((c,i)=>{
      const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
      const row=document.createElement('div'); row.className='clan-res'+(c.id===C.myClanId?' mine':'');
      row.innerHTML=medal+' <b style="color:'+(c.id===C.myClanId?'#00E5FF':'#ffd86b')+'">['+esc(c.tag||'?')+'] '+esc(c.name||'Klan')+'</b>'
        +'<span style="font-size:11px;color:#ffd86b;margin-left:auto">🥜 '+fmt(c.kaju)+'</span>';
      card.appendChild(row);
    });
    box.appendChild(card);
  }catch(e){box.innerHTML='<div class="clan-card"><i>Okunamadı</i></div>';}
}

// ── Yönet (lider/vice) ────────────────────────────────────────
async function renderManage(){
  const box=document.getElementById('clanTabBody'); if(!box)return;
  const nameChanges=_clan&&_clan.nameChanges||0;
  const mems=_clan&&_clan.members||{};
  const varisE=Object.entries(mems).find(([,v])=>v&&v.role==='vice');
  const banned=_clan&&_clan.banned||{};
  const bannedList=Object.entries(banned).filter(([,v])=>v);
  box.innerHTML='';
  // Klan adı değiştir
  const renCard=document.createElement('div'); renCard.className='clan-card';
  const isAdminUser = Auth.getState().isAdmin === true;
  const renLocked = !isAdminUser && nameChanges >= 3;
  renCard.innerHTML='<div class="clan-lbl">✏️ KLAN ADI DEĞİŞTİR'+(isAdminUser?' <span style="font-size:9px;color:#FFD740">(👑 Admin - Sınırsız)</span>':'('+nameChanges+'/3 hak)')+'</div>'
    +'<div class="clan-row"><input class="clan-in" id="clanNewName2" placeholder="Yeni ad (3–20 harf)" maxlength="20"><input class="clan-in" id="clanNewTag2" placeholder="[ETİKET]" maxlength="5" style="max-width:80px;text-transform:uppercase"><button class="clan-btn p" id="clanRenameBtn" '+(renLocked?'disabled style="opacity:.4"':'')+'>Değiştir</button></div>';
  if(renLocked){const warn=document.createElement('div');warn.className='clan-msg bad';warn.textContent='Ad değiştirme hakkı doldu (3/3) — Admin olmak için iletişime geçin';renCard.appendChild(warn);}
  box.appendChild(renCard);
  if(!renLocked){
    renCard.querySelector('#clanRenameBtn').addEventListener('click',async()=>{
      const nn=(renCard.querySelector('#clanNewName2').value||'').trim();
      const nt=(renCard.querySelector('#clanNewTag2').value||'').trim().toUpperCase().replace(/[^A-Z0-9İÇŞĞÜÖ]/gi,'');
      if(nn.length<3){_toast('En az 3 harf');return;}
      const newCount = isAdminUser ? nameChanges : nameChanges+1;
      if(!confirm('Klan adı "'+nn+'" olarak değişsin?'+(isAdminUser?'':' ('+(nameChanges+1)+'/3)')))return;
      const updates={name:nn,nameChanges:newCount};
      if(nt.length>=2&&nt.length<=5) updates.tag=nt;
      try{
        await fdb.update(fdb.ref(db,'clans/'+C.myClanId),updates);
        _clan.name=nn;if(nt.length>=2)_clan.tag=nt;_clan.nameChanges=newCount;
        _toast('✅ Klan adı değiştirildi!'+(isAdminUser?'':' ('+(nameChanges+1)+'/3)'));
        await renderMyClan();
      }catch(e){_toast('Değiştirilemedi');}
    });
  }
  // Duyuru — mevcut duyuruyu göster + düzenle/sil
  const curAnn=_clan.announcement||null;
  const annCard=document.createElement('div'); annCard.className='clan-card';
  let annHtml='<div class="clan-lbl">📣 KLAN DUYURUSU</div>';
  if(curAnn&&curAnn.text){
    annHtml+='<div class="clan-ann-current"><div style="font-size:11px;color:#ffd86b;line-height:1.5">'+esc(curAnn.text)+'</div><div style="font-size:8px;color:#7d8ab8;margin-top:4px">'+tAgo(curAnn.ts)+' önce</div><div style="display:flex;gap:5px;margin-top:7px"><button class="clan-btn" style="flex:1;font-size:10px;padding:5px;background:rgba(0,229,255,.08);color:#00E5FF;border-color:rgba(0,229,255,.3)" id="annEdit">✏️ Düzenle</button><button class="clan-btn r" style="flex:1;font-size:10px;padding:5px" id="annDel">🗑 Sil</button></div></div>';
  }
  annHtml+='<div class="clan-row" style="margin-top:8px"><input class="clan-in" id="clanAnnInp" maxlength="150" placeholder="'+(curAnn?'Yeni duyuru…':'Tüm üyelere duyuru…')+'"><button class="clan-btn p" id="clanAnnSend">Gönder</button></div>';
  annCard.innerHTML=annHtml;
  box.appendChild(annCard);
  // Gönder
  annCard.querySelector('#clanAnnSend').addEventListener('click',async()=>{
    const text=(annCard.querySelector('#clanAnnInp').value||'').trim();if(!text)return;
    const st=Auth.getState();
    try{
      // Duyuruyu kalıcı sakla
      await fdb.update(fdb.ref(db,'clans/'+C.myClanId),{announcement:{text:text.slice(0,140),ts:Date.now(),by:st.uid,byName:st.displayName||'Yönetici'}});
      _clan.announcement={text:text.slice(0,140),ts:Date.now(),by:st.uid};
      // Bildirim gönder
      const uids=Object.keys(mems);
      for(const uid of uids){if(uid===st.uid)continue;try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'📣',text:'['+esc(_clan.tag||'KLAN')+'] '+text.slice(0,130),ts:Date.now()});}catch(e){}}
      annCard.querySelector('#clanAnnInp').value='';
      await renderManage();
    }catch(e){_toast('Gönderilemedi');}
  });
  // Düzenle
  const annEditBtn=annCard.querySelector('#annEdit');
  if(annEditBtn) annEditBtn.addEventListener('click',async()=>{
    const nt=prompt('Duyuruyu düzenle:',curAnn.text);
    if(nt&&nt.trim()){
      try{await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/announcement'),{text:nt.trim().slice(0,140),edited:true});_clan.announcement.text=nt.trim();await renderManage();}catch(e){}
    }
  });
  // Sil
  const annDelBtn=annCard.querySelector('#annDel');
  if(annDelBtn) annDelBtn.addEventListener('click',async()=>{
    if(!confirm('Duyuru silinsin mi?'))return;
    try{await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/announcement'),null);_clan.announcement=null;await renderManage();}catch(e){}
  });
  // Banlı üyeler + unban
  if(bannedList.length){
    const banCard=document.createElement('div'); banCard.className='clan-card';
    banCard.innerHTML='<div class="clan-lbl" style="color:#FF9090">🚫 BANLI ÜYELER</div>';
    bannedList.forEach(([uid,info])=>{
      const row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)';
      row.innerHTML='<div style="flex:1;font-size:11px;color:#cdd8f5"><div>'+esc(uid.slice(0,12))+'…</div><div style="font-size:9px;color:#7d8ab8">Neden: '+esc((info&&info.reason)||'—')+'</div></div>'
        +'<button class="clan-btn p" style="padding:4px 9px;font-size:10px;background:rgba(105,240,174,.1);color:#69F0AE;border-color:rgba(105,240,174,.3)">✅ Unbanlı</button>';
      row.querySelector('button').addEventListener('click',async()=>{
        if(!confirm('Unbanla?'))return;
        try{
          await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/banned/'+uid),null);
          try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'✅',text:'✅ '+(_clan.name||'Klan')+'\'dan banın kaldırıldı!',ts:Date.now()});}catch(e){}
          row.remove();
        }catch(e){_toast('Yapılamadı');}
      });
      banCard.appendChild(row);
    });
    box.appendChild(banCard);
  }
  // Varis → Lider devret
  if(C.myRole==='leader'){
    const transCard=document.createElement('div'); transCard.className='clan-card';
    transCard.innerHTML='<div class="clan-lbl">⭐ LİDERLİĞİ DEVRET</div>'
      +'<div style="font-size:11px;color:#9fb0d8;margin-bottom:8px">'+( varisE?'Varis: <b style="color:#00E5FF">'+esc(varisE[1]&&varisE[1].name||'?')+'</b>':'Üyeler sekmesinden ⭐ ile varis ata')+'</div>'
      +'<button class="clan-btn p" style="width:100%'+(varisE?'':';opacity:.4')+'" '+(varisE?'':'disabled')+' id="transBtn">👑 Devret</button>';
    box.appendChild(transCard);
    if(varisE){
      transCard.querySelector('#transBtn').addEventListener('click',async()=>{
        if(!confirm('Liderlik '+esc(varisE[1]&&varisE[1].name||'?')+' adlı üyeye devredilsin mi?'))return;
        try{
          const st=Auth.getState();
          await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/members/'+varisE[0]),{role:'leader'});
          await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/members/'+st.uid),{role:'member'});
          await fdb.update(fdb.ref(db,'clans/'+C.myClanId),{leader:varisE[0]});
          await loadMyClan();
        }catch(e){_toast('Yapılamadı');}
      });
    }
    const disbCard=document.createElement('div'); disbCard.className='clan-card';
    disbCard.innerHTML='<div class="clan-lbl" style="color:#ff8fa0">⚠️ TEHLİKELİ</div><button class="clan-btn r" id="disbBtn" style="width:100%">💀 Klanı Dağıt</button>';
    box.appendChild(disbCard);
    disbCard.querySelector('#disbBtn').addEventListener('click',async()=>{
      if(!confirm('Klan KALICI OLARAK silinecek!'))return;
      const cn=prompt('Onaylamak için klan adını yaz: "'+(_clan.name||'')+'"');
      if(cn!==(_clan.name||'')){_toast('Klan adı eşleşmedi');return;}
      try{
        for(const uid of Object.keys(mems))await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null).catch(()=>{});
        await fdb.set(fdb.ref(db,'clans/'+C.myClanId),null);
        C.myClanId=null;_clan=null;renderNoClan();
      }catch(e){_toast('Yapılamadı');}
    });
  }
}

async function leaveClan(){
  const st=Auth.getState();
  if(!confirm(C.myRole==='leader'?'⚠️ Lider olarak ayrılırsan klan dağıtılabilir. Devam?':'Klandan ayrıl?'))return;
  await leaveClanClean();
}
async function leaveClanClean(){
  const st=Auth.getState();
  try{
    await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/members/'+st.uid),null);
    await fdb.set(fdb.ref(db,'users/'+st.uid+'/clanId'),null);
    if(C.myRole==='leader'){
      const s=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members'));
      if(!s.exists())await fdb.set(fdb.ref(db,'clans/'+C.myClanId),null);
    }
  }catch(e){}
  C.myClanId=null;_clan=null;renderNoClan();
}

export default openClan;
