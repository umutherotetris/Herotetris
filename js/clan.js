// ═══════════════════════════════════════════════════════════════
//  KLAN SİSTEMİ — Hero Oyun Portalı
//  Klan adı değiştir · Kick/Ban/Unban nedenli · Davet sistemi
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>(Number.isFinite(Number(n))?Number(n):0).toLocaleString('tr-TR');
const tAgo=(ts)=>{const d=Date.now()-(ts||0);if(d<60e3)return'şimdi';if(d<3600e3)return Math.floor(d/60e3)+' dk';if(d<86400e3)return Math.floor(d/3600e3)+' sa';return Math.floor(d/86400e3)+' g';};

let C=null; let _clan=null;

export async function openClan(){
  if(document.getElementById('clanPanel'))return;
  const st=Auth.getState();
  if(!st.uid||st.status!=='google'){alert('Klan için giriş gerekli');return;}
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
      }catch(err){alert('Katılım başarısız');}
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
    if(ban.exists()&&ban.val()){alert('Bu klandan banlısın, katılamazsın.');return;}
    await fdb.update(fdb.ref(db,'clans/'+clanId+'/members/'+st.uid),{name:st.displayName||'Oyuncu',role:'member',joinedAt:Date.now()});
    await fdb.update(fdb.ref(db,'users/'+st.uid),{clanId});
    C.myClanId=clanId; await renderMyClan();
  }catch(e){alert('Katılım başarısız: '+(e.message||e));}
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
    const tabs=[['members','👥 Üyeler'],['chat','💬 Sohbet'],['leader','🏆 Liderlik']];
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
  else if(t==='chat')renderChat();
  else if(t==='leader')renderLeader();
  else if(t==='manage')renderManage();
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
    const reason=(inn.querySelector('#kickReason').value||'').trim();
    if(!confirm('Klandan at?'))return;
    try{
      await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid),null);
      await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null);
      try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'🔨',text:'🔨 '+(_clan&&_clan.name||'Klan')+'\'dan atıldın!'+(reason?' Neden: '+reason:''),ts:Date.now()});}catch(e){}
      ov.remove(); renderMembers();
    }catch(e){alert('Yapılamadı');}
  });
  inn.querySelector('#doBan').addEventListener('click',async()=>{
    const reason=(inn.querySelector('#kickReason').value||'').trim();
    if(!confirm('Banla?'))return;
    try{
      await fdb.set(fdb.ref(db,'clans/'+C.myClanId+'/members/'+uid),null);
      await fdb.update(fdb.ref(db,'clans/'+C.myClanId+'/banned/'+uid),{reason:reason||'—',bannedAt:Date.now(),bannedBy:Auth.getState().uid});
      await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null);
      try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'🚫',text:'🚫 '+(_clan&&_clan.name||'Klan')+'\'dan banlandın!'+(reason?' Neden: '+reason:''),ts:Date.now()});}catch(e){}
      ov.remove(); renderMembers();
    }catch(e){alert('Yapılamadı');}
  });
}

// ── Davet gönder ──────────────────────────────────────────────
export async function sendClanInvite(toUid,toName){
  if(!C||!C.myClanId){alert('Önce klana gir');return;}
  const st=Auth.getState();
  try{
    const already=await fdb.get(fdb.ref(db,'clans/'+C.myClanId+'/members/'+toUid));
    if(already.exists()&&already.val()){alert(toName+' zaten klanında!');return;}
    const invKey='inv_'+Date.now().toString(36);
    await fdb.set(fdb.ref(db,'clanInvites/'+toUid+'/'+invKey),{clanId:C.myClanId,clanName:_clan&&_clan.name||'Klan',fromUid:st.uid,fromName:st.displayName||'Oyuncu',ts:Date.now()});
    await fdb.push(fdb.ref(db,'userNotifs/'+toUid),{icon:'🏰',text:'🏰 '+esc(st.displayName||'Oyuncu')+' seni '+esc(_clan&&_clan.name||'klana')+' davet etti!',ts:Date.now()});
    alert('✅ '+toName+' davet edildi!');
  }catch(e){alert('Davet gönderilemedi');}
}

// ── Klan Sohbeti ──────────────────────────────────────────────
function renderChat(){
  const box=document.getElementById('clanTabBody'); if(!box)return;
  box.innerHTML='';
  const card=document.createElement('div'); card.className='clan-card'; card.style.padding='0;overflow:hidden';
  card.innerHTML='<div class="clan-chat" id="clanChatList"><div class="clan-load">Yükleniyor…</div></div><div class="clan-row" style="padding:8px;border-top:1px solid rgba(255,255,255,.06)"><input class="clan-in" id="clanChatInp" placeholder="Klan sohbetine yaz…" maxlength="200"><button class="clan-btn p" id="clanChatSend">➤</button></div>';
  box.appendChild(card);
  card.querySelector('#clanChatSend').addEventListener('click',sendChat);
  card.querySelector('#clanChatInp').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  const offC=fdb.onValue(fdb.query(fdb.ref(db,'clans/'+C.myClanId+'/chat'),fdb.limitToLast(40)),snap=>{
    const list=document.getElementById('clanChatList'); if(!list)return;
    const me=Auth.getState().uid;
    const rows=[]; if(snap.exists())snap.forEach(ch=>{rows.push(ch.val());});
    rows.sort((a,b)=>(a.ts||0)-(b.ts||0));
    if(!rows.length){list.innerHTML='<div class="clan-load" style="color:#5d6890">İlk mesajı sen yaz! 🏰</div>';return;}
    list.innerHTML=rows.map(m=>'<div class="clan-chat-row'+(m.uid===me?' mine':'')+'"><div class="clan-chat-ava">'+(m.avatar||'👤')+'</div><div><div style="font-size:10px;font-weight:800;color:'+(m.uid===me?'#00E5FF':'#A78BFA')+'">'+esc(m.name||'Üye')+'</div><div style="font-size:12px;color:#c4c4e0">'+esc(m.text)+'</div><div style="font-size:8px;color:#505074">'+tAgo(m.ts)+'</div></div></div>').join('');
    list.scrollTop=list.scrollHeight;
  });
  if(C)C.off.push(offC);
}
async function sendChat(){
  const inp=document.getElementById('clanChatInp'); if(!inp)return;
  const text=inp.value.trim(); if(!text)return;
  const st=Auth.getState(); inp.value='';
  try{await fdb.push(fdb.ref(db,'clans/'+C.myClanId+'/chat'),{uid:st.uid,name:st.displayName||'Üye',avatar:(st.profile&&st.profile.avatar)||'👤',text:text.slice(0,200),ts:Date.now()});}catch(e){alert('Gönderilemedi');}
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
      if(nn.length<3){alert('En az 3 harf');return;}
      const newCount = isAdminUser ? nameChanges : nameChanges+1;
      if(!confirm('Klan adı "'+nn+'" olarak değişsin?'+(isAdminUser?'':' ('+(nameChanges+1)+'/3)')))return;
      const updates={name:nn,nameChanges:newCount};
      if(nt.length>=2&&nt.length<=5) updates.tag=nt;
      try{
        await fdb.update(fdb.ref(db,'clans/'+C.myClanId),updates);
        _clan.name=nn;if(nt.length>=2)_clan.tag=nt;_clan.nameChanges=newCount;
        alert('✅ Klan adı değiştirildi!'+(isAdminUser?'':' ('+(nameChanges+1)+'/3)'));
        await renderMyClan();
      }catch(e){alert('Değiştirilemedi');}
    });
  }
  // Duyuru
  const annCard=document.createElement('div'); annCard.className='clan-card';
  annCard.innerHTML='<div class="clan-lbl">📣 KLAN DUYURUSU</div>'
    +'<div class="clan-row"><input class="clan-in" id="clanAnnInp" maxlength="150" placeholder="Tüm üyelere duyuru…"><button class="clan-btn p" id="clanAnnSend">Gönder</button></div>';
  box.appendChild(annCard);
  annCard.querySelector('#clanAnnSend').addEventListener('click',async()=>{
    const text=(annCard.querySelector('#clanAnnInp').value||'').trim();if(!text)return;
    const st=Auth.getState();
    const uids=Object.keys(mems);
    for(const uid of uids){if(uid===st.uid)continue;try{await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'🏰',text:'['+esc(_clan.tag||'KLAN')+'] '+text.slice(0,140),ts:Date.now()});}catch(e){}}
    annCard.querySelector('#clanAnnInp').value='';
    alert('✓ Duyuru gönderildi ('+( uids.length-1)+' üye)');
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
        }catch(e){alert('Yapılamadı');}
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
        }catch(e){alert('Yapılamadı');}
      });
    }
    const disbCard=document.createElement('div'); disbCard.className='clan-card';
    disbCard.innerHTML='<div class="clan-lbl" style="color:#ff8fa0">⚠️ TEHLİKELİ</div><button class="clan-btn r" id="disbBtn" style="width:100%">💀 Klanı Dağıt</button>';
    box.appendChild(disbCard);
    disbCard.querySelector('#disbBtn').addEventListener('click',async()=>{
      if(!confirm('Klan KALICI OLARAK silinecek!'))return;
      const cn=prompt('Onaylamak için klan adını yaz: "'+(_clan.name||'')+'"');
      if(cn!==(_clan.name||'')){alert('Klan adı eşleşmedi');return;}
      try{
        for(const uid of Object.keys(mems))await fdb.set(fdb.ref(db,'users/'+uid+'/clanId'),null).catch(()=>{});
        await fdb.set(fdb.ref(db,'clans/'+C.myClanId),null);
        C.myClanId=null;_clan=null;renderNoClan();
      }catch(e){alert('Yapılamadı');}
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
