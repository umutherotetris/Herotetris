// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — ADMİN YÖNETİM PANELİ
//  👑 rozetinden açılır. Yalnız /admins kaydı olan hesaplar.
//  Bölümler: oyuncu ara → profil + Kaju ± + geçmiş + nick zorla
//  değiştir + ban/mute. Her işlem adminLog'a yazılır.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb as rawFdb } from './auth.js';
import Store from './store.js';

const $ = (root, sel) => root.querySelector(sel);
const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('tr-TR'):'—';
const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let P = null;   // panel durumu { root, target:{uid,profile} }

// Every SDK call owns the panel, actor and selected player that started it.
// The real Firebase rules remain the authority; this prevents stale UI work from
// carrying on after a panel, account, selection or live role changes.
const validUid=uid=>typeof uid==='string'&&uid.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(uid)&&!!uid;
function activeAdmin(panel=P){
  const st=Auth.getState();
  return panel&&P===panel&&panel.root?.isConnected!==false&&panel.authorized!==false
    &&st.uid&&st.status==='google'&&st.isAdmin===true&&(!panel.ownerUid||panel.ownerUid===st.uid)?panel:null;
}
function panelMessage(panel,text,ok){
  if(!activeAdmin(panel))return;
  const el=$(panel.root,'[data-el="msg"]');if(!el)return;
  el.textContent=text||'';el.className='adm-msg '+(ok?'ok':'bad');
}
function sdkContext(){
  const panel=activeAdmin();if(!panel)throw new Error('Yönetici oturumu kapandı');
  const uid=Auth.getState().uid,target=panel.target;
  const current=()=>activeAdmin(panel)&&Auth.getState().uid===uid&&panel.target===target;
  return {panel,uid,current,assert(){if(!current())throw new Error('Hesap, yetki veya seçilen oyuncu değişti');}};
}
async function authorizeSDK(context){
  context.assert();
  const role=await rawFdb.get(rawFdb.ref(db,'admins/'+context.uid));
  context.assert();
  if(!role.exists()||role.val()===false){context.panel.authorized=false;if(P===context.panel)closePanel();throw new Error('Yönetici yetkisi kaldırıldı');}
}
const fdb={...rawFdb,
  async get(...args){const c=sdkContext();const result=await rawFdb.get(...args);c.assert();return result;},
  async set(...args){const c=sdkContext();await authorizeSDK(c);const result=await rawFdb.set(...args);c.assert();return result;},
  async update(...args){const c=sdkContext();await authorizeSDK(c);const result=await rawFdb.update(...args);c.assert();return result;},
  async push(...args){const c=sdkContext();await authorizeSDK(c);const result=await rawFdb.push(...args);c.assert();return result;},
  async runTransaction(reference,change,options={}){
    const c=sdkContext();await authorizeSDK(c);
    const result=await rawFdb.runTransaction(reference,value=>c.current()?change(value):undefined,{...options,applyLocally:false});
    c.assert();return result;
  }
};
function lockPanel(panel,on,label='İşlem sürüyor…'){
  if(!panel)return;panel.busy=on;
  panel.root.setAttribute?.('aria-busy',String(on));
  panel.root.querySelectorAll('button,input,select').forEach(el=>{
    if(el.dataset.a==='close')return;
    if(on){if(el.dataset.adminWasDisabled===undefined)el.dataset.adminWasDisabled=el.disabled?'1':'0';el.disabled=true;}
    else if(el.dataset.adminWasDisabled!==undefined){el.disabled=el.dataset.adminWasDisabled==='1';delete el.dataset.adminWasDisabled;}
  });
  const status=$(panel.root,'[data-el="busy"]');if(status){status.textContent=on?label:'Hazır';status.dataset.busy=String(on);}
}
function setAdminDisabled(panel,control,disabled){
  if(!control)return;
  if(panel.busy)control.dataset.adminWasDisabled=disabled?'1':'0';
  control.disabled=!!panel.busy||disabled;
}
async function runAdminAction(work,label){
  const panel=activeAdmin();if(!panel||panel.busy)return;
  lockPanel(panel,true,label);
  try{return await work();}finally{lockPanel(panel,false);}
}
let adminCssLoaded=false;
function ensureAdminCss(){
  if(adminCssLoaded)return;adminCssLoaded=true;
  const link=document.createElement('link');link.rel='stylesheet';link.href='css/admin-premium.css?v=159';document.head.appendChild(link);
}

// ── adminLog kaydı ──────────────────────────────────────────────
function selectedAdmin(){
  const panel=activeAdmin(),target=panel?.target;if(!target||!validUid(target.uid))return null;
  const actor=Auth.getState();
  return {panel,target,uid:target.uid,actor,current:()=>!!activeAdmin(panel)&&panel.target===target,
    say(text,ok){if(this.current())panelMessage(panel,text,ok);}};
}
async function readTarget(context,protect=false){
  const snapshot=await fdb.get(fdb.ref(db,'users/'+context.uid));
  if(!context.current())throw new Error('Seçilen oyuncu değişti');
  const profile=snapshot.val();if(!profile||profile.deleted)throw new Error('Oyuncu kaydı artık bulunmuyor');
  if(protect){
    const role=await fdb.get(fdb.ref(db,'admins/'+context.uid));
    if((role.exists()&&role.val()!==false)||profile.isAdmin)throw new Error('Yönetici hesabında bu işlem uygulanamaz');
  }
  return profile;
}
async function writeTarget(context,fields,protect=false){
  await readTarget(context,protect);
  const result=await fdb.runTransaction(fdb.ref(db,'users/'+context.uid),profile=>{
    if(!context.current()||!profile||profile.deleted||(protect&&profile.isAdmin))return;
    return {...profile,...fields};
  });
  if(!result.committed)throw new Error('Oyuncu değişikliği onaylanmadı');
  return result.snapshot.val();
}
function adminOperation(prefix){return prefix+'_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));}

async function logAdmin(action, targetUid, detail){
  const P=activeAdmin();if(!P)return;
  try{
    const me = Auth.getState();
    const k = 'a' + Date.now() + '_' + Math.floor(Math.random()*100000);
    await fdb.set(fdb.ref(db, 'adminLog/' + k), {
      ts: Date.now(), adminUid: me.uid, adminNick: me.displayName || 'Admin',
      action, target: targetUid || '', detail: String(detail||'').slice(0, 200)
    });
  }catch(e){}
}

const ADMIN_VIEWS=['Players','Community','System'];
function showAdminView(panel,key,focus=false){
  if(!activeAdmin(panel)||panel.busy||!ADMIN_VIEWS.includes(key))return;
  for(const id of ADMIN_VIEWS){
    const tab=$(panel.root,'[data-admin-tab="'+id+'"]'),view=$(panel.root,'[data-admin-view="'+id+'"]');
    const on=id===key;
    if(tab){tab.tabIndex=on?0:-1;tab.setAttribute('aria-selected',String(on));if(on&&focus)tab.focus();}
    if(view)view.hidden=!on;
  }
  $(panel.root,'[data-el="sug"]').hidden=true;
  const scroller=$(panel.root,'.adm-body');if(scroller&&panel.view!==key)scroller.scrollTop=0;
  panel.view=key;
}
function toggleDisclosure(panel,action,box){
  const open=box.style.display==='none';
  box.style.display=open?'':'none';
  $(panel.root,'[data-a="'+action+'"]')?.setAttribute('aria-expanded',String(open));
  return open;
}

// ── Panel aç/kapa ───────────────────────────────────────────────
export function openAdminPanel(){
  const st = Auth.getState();
  if(!st.uid||st.status!=='google'||st.isAdmin !== true){ alert('Bu panel yalnız adminler içindir.'); return; }
  if(document.getElementById('adminPanel')) return;
  ensureAdminCss();
  const opener=document.activeElement;
  const ov = document.createElement('div');
  ov.id = 'adminPanel'; ov.className = 'adm-ov';
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-labelledby','adminPanelTitle');
  ov.innerHTML = `
    <div class="adm-panel">
      <div class="adm-head">
        <div><p class="adm-eyebrow">HERO PORTAL</p><h2 class="adm-title" id="adminPanelTitle">Yönetim merkezi</h2></div>
        <button class="adm-x" type="button" data-a="close" aria-label="Yönetim panelini kapat">✕</button>
      </div>
      <div class="adm-tabs" role="tablist" aria-label="Yönetim alanları">
        <button type="button" class="adm-tab" id="adminTabPlayers" data-admin-tab="Players" role="tab" aria-selected="true" aria-controls="adminViewPlayers">Oyuncular</button>
        <button type="button" class="adm-tab" id="adminTabCommunity" data-admin-tab="Community" role="tab" aria-selected="false" aria-controls="adminViewCommunity" tabindex="-1">Topluluk</button>
        <button type="button" class="adm-tab" id="adminTabSystem" data-admin-tab="System" role="tab" aria-selected="false" aria-controls="adminViewSystem" tabindex="-1">Sistem</button>
      </div>
      <div class="adm-selection"><span data-el="selected">İşlem için bir oyuncu seç</span><span class="adm-busy" data-el="busy" role="status">Hazır</span></div>
      <div class="adm-msg" data-el="msg" role="status" aria-live="polite"></div>
      <div class="adm-body">
        <section class="adm-view" data-admin-view="Players" id="adminViewPlayers" role="tabpanel" aria-labelledby="adminTabPlayers" tabindex="0">
          <div class="adm-row adm-search" role="search" aria-label="Oyuncu arama">
            <input class="adm-in" data-el="q" aria-label="Oyuncu nicki veya UID ara" aria-controls="adminSearchSuggestions" placeholder="Nick veya UID ara…" autocomplete="off" spellcheck="false">
            <button type="button" class="adm-btn p" data-a="search">Ara</button>
            <div class="adm-sug" id="adminSearchSuggestions" data-el="sug" hidden></div>
          </div>
          <div class="adm-stats" data-el="stats" aria-live="polite">Oyuncu sayıları yükleniyor…</div>
          <div data-el="result"></div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="onlinelist" aria-controls="adminOnlineList" aria-expanded="false">Çevrimiçi oyuncular <span data-el="oncount"></span></button>
            <div class="adm-log" id="adminOnlineList" data-el="online" style="display:none"></div>
          </div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="allusers" aria-controls="adminUsersList" aria-expanded="false">Tüm oyuncular <span data-el="ucount"></span></button>
            <div class="adm-user-list" id="adminUsersList" data-el="usersList" style="display:none">
              <div class="adm-user-filter" id="userFilterRow">
                <div class="adm-filter-options" role="group" aria-label="Oyuncu listesi filtresi">
                  <button type="button" class="adm-btn p" data-filter="all" aria-pressed="true">Tümü</button>
                  <button type="button" class="adm-btn" data-filter="nonick" aria-pressed="false">Nick yok</button>
                  <button type="button" class="adm-btn" data-filter="anon" aria-pressed="false">Misafir</button>
                  <button type="button" class="adm-btn" data-filter="dup" aria-pressed="false">Nick çakışması</button>
                </div>
                <input class="adm-in" data-el="userSearch" aria-label="Listede nick veya UID ara" placeholder="Listede nick veya UID ara…" autocomplete="off">
              </div>
              <p class="adm-list-meta" data-el="userCount" role="status"></p>
              <div class="adm-log" data-el="allusers" style="display:none"></div>
              <button type="button" class="adm-btn" data-a="moreUsers" hidden>Daha fazla göster</button>
            </div>
          </div>
        </section>
        <section class="adm-view" data-admin-view="Community" id="adminViewCommunity" role="tabpanel" aria-labelledby="adminTabCommunity" tabindex="0" hidden>
          <div class="adm-sec adm-wide">
            <label class="adm-lbl" for="adminAnnouncement">Portal duyurusu</label>
            <p class="adm-help">Gönderilen duyuru tüm oyunculara görünür.</p>
            <div class="adm-row">
              <input class="adm-in" id="adminAnnouncement" data-el="bcText" maxlength="200" placeholder="Duyuru metni…">
              <button type="button" class="adm-btn p" data-a="bcSend">Gönder</button>
            </div>
          </div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="chatmod" aria-controls="adminChatLog" aria-expanded="false">Sohbet moderasyonu</button>
            <div class="adm-log" id="adminChatLog" data-el="chatmod" style="display:none"></div>
          </div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="chatlock">Genel sohbet: <b data-el="lockState">…</b></button>
            <button type="button" class="adm-acc" data-a="glow" aria-controls="adminGlowPicker" aria-expanded="false">Nick ışıltısı</button>
            <div class="adm-log" id="adminGlowPicker" data-el="glowbox" style="display:none"></div>
          </div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="ipbans" aria-controls="adminIPBans" aria-expanded="false">IP yasakları</button>
            <div class="adm-log" id="adminIPBans" data-el="ipbans" style="display:none"></div>
          </div>
          <div class="adm-sec">
            <button type="button" class="adm-acc" data-a="nickbans" aria-controls="adminNickBans" aria-expanded="false">Nick yasakları</button>
            <div class="adm-log" id="adminNickBans" data-el="nickbans" style="display:none">
              <div class="adm-row">
                <input class="adm-in" data-el="nbText" aria-label="Yasaklanacak nick" maxlength="16" placeholder="Yasaklanacak nick" autocapitalize="off">
                <button type="button" class="adm-btn r" data-a="nbAdd">Yasakla</button>
              </div>
              <div data-el="nbList"></div>
            </div>
          </div>
        </section>
        <section class="adm-view" data-admin-view="System" id="adminViewSystem" role="tabpanel" aria-labelledby="adminTabSystem" tabindex="0" hidden>
          <div class="adm-sec adm-wide">
            <h3 class="adm-lbl">Sistem sağlığı</h3>
            <p class="adm-help">Oturumu, oyun modüllerini ve veri bağlantısını kontrol et.</p>
            <button type="button" class="adm-btn p" data-a="runCheckup">Tanılamayı çalıştır</button>
            <div class="adm-log adm-checkup" data-el="checkup" role="status" aria-live="polite" style="display:none"></div>
          </div>
          <div class="adm-sec">
            <h3 class="adm-lbl">Görünürlük</h3>
            <button type="button" class="adm-acc" data-a="ghost">Gizli mod: <b data-el="ghostState">…</b></button>
            <button type="button" class="adm-acc" data-a="toggleAdmFab">Yönetici taç düğmesi: <b data-el="admFabState">…</b></button>
            <button type="button" class="adm-acc" data-a="toggleDebug">Hata göstergesi: <b data-el="debugState">…</b></button>
          </div>
          <div class="adm-sec">
            <h3 class="adm-lbl">Nick defteri</h3>
            <button type="button" class="adm-acc" data-a="rebuild">Nick defterini onar</button>
            <button type="button" class="adm-acc" data-a="dupclean">Sahipsiz defter kayıtlarını temizle</button>
          </div>
          <details class="adm-sec adm-wide adm-maintenance">
            <summary>Oyuncu kayıt bakımı</summary>
            <p class="adm-help">Oyuncu kayıtlarını etkileyen işlemleri buradan yapabilirsin.</p>
            <div class="adm-row">
              <button type="button" class="adm-btn r" data-a="cleanAnon">Boş misafir kayıtlarını temizle</button>
              <button type="button" class="adm-btn r" data-a="cleanDup">Çakışan nickleri temizle</button>
            </div>
          </details>
          <div class="adm-sec adm-wide">
            <button type="button" class="adm-acc" data-a="loglist" aria-controls="adminActionLog" aria-expanded="false">Son yönetici işlemleri</button>
            <div class="adm-log" id="adminActionLog" data-el="log" style="display:none"></div>
          </div>
        </section>
      </div>
    </div>`;
  document.body.appendChild(ov);
  P = { root: ov, target: null,ownerUid:st.uid,authorized:true,off:[],opener,view:'Players',searchVersion:0,userFilter:'all',userLimit:40 };
  const panel=P;
  _allUsersCache=[];_dupNickMap=Object.create(null);
  const watchAuth=Auth.subscribe(next=>{if(P===panel&&(next.uid!==st.uid||next.status!=='google'||next.isAdmin!==true))closePanel();});
  if(P===panel)panel.off.push(watchAuth);else watchAuth();
  if(rawFdb.onValue){const watchRole=rawFdb.onValue(rawFdb.ref(db,'admins/'+st.uid),snapshot=>{
    if(P===panel&&(!snapshot.exists()||snapshot.val()===false)){panel.authorized=false;closePanel();}
  },()=>{if(P===panel){panel.authorized=false;closePanel();}});
    if(P===panel)panel.off.push(watchRole);else watchRole();
  }
  const search=$(ov,'[data-el="q"]'),suggestions=$(ov,'[data-el="sug"]');
  for(const [index,key] of ADMIN_VIEWS.entries()){
    const tab=$(ov,'[data-admin-tab="'+key+'"]');
    tab.addEventListener('click',()=>showAdminView(panel,key));
    tab.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowLeft')next=(index+ADMIN_VIEWS.length-1)%ADMIN_VIEWS.length;
      else if(event.key==='ArrowRight')next=(index+1)%ADMIN_VIEWS.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=ADMIN_VIEWS.length-1;
      if(next!==undefined){event.preventDefault();showAdminView(panel,ADMIN_VIEWS[next],true);}
    });
  }
  ov.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      if(!suggestions.hidden&&suggestions.childElementCount){suggestions.hidden=true;search.focus();}
      else closePanel();
      return;
    }
    if(event.key!=='Tab')return;
    const focusable=Array.from(ov.querySelectorAll('button,input,select,summary,[tabindex="0"]')).filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  ov.addEventListener('click', (e) => {
    if(e.target === ov){closePanel();return;}
    if(!e.target.closest?.('.adm-search'))suggestions.hidden=true;
  });
  $(ov,'[data-a="close"]').addEventListener('click', closePanel);
  $(ov,'[data-a="search"]').addEventListener('click', doSearch);
  search.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();doSearch();}
    else if(event.key==='ArrowDown'&&!suggestions.hidden){
      const first=suggestions.querySelector('.adm-sug-it');if(first){event.preventDefault();first.focus();}
    }
  });
  let sugT=null,sugVersion=0;
  search.addEventListener('input',()=>{
    const value=search.value.trim(),version=++sugVersion;
    ++panel.searchVersion;clearTimeout(sugT);suggestions.hidden=true;
    if(value.length<2||value.length>16)return;
    sugT=setTimeout(async()=>{
      if(!activeAdmin(panel)||panel.busy||panel.view!=='Players')return;
      try{
        const list=Auth.searchNicks?await Auth.searchNicks(value,8):[];
        if(!activeAdmin(panel)||panel.busy||panel.view!=='Players'||version!==sugVersion||search.value.trim()!==value)return;
        if(document.activeElement!==search&&!suggestions.contains(document.activeElement))return;
        if(!list.length)return;
        suggestions.innerHTML=list.map(item=>`<button type="button" class="adm-sug-it" data-uid="${esc(item.uid)}">${esc(item.nick)}</button>`).join('');
        suggestions.hidden=false;
        suggestions.querySelectorAll('.adm-sug-it').forEach(item=>item.addEventListener('click',()=>{
          suggestions.hidden=true;search.value=item.textContent;loadTarget(item.dataset.uid);
        }));
      }catch(error){if(activeAdmin(panel)&&version===sugVersion)suggestions.hidden=true;}
    },220);
  });
  $(ov,'[data-a="loglist"]').addEventListener('click', toggleLog);
  $(ov,'[data-a="rebuild"]').addEventListener('click', rebuildRegistry);
  $(ov,'[data-a="onlinelist"]').addEventListener('click', toggleOnline);
  $(ov,'[data-a="chatmod"]').addEventListener('click', toggleChatMod);
  $(ov,'[data-a="chatlock"]').addEventListener('click', toggleChatLock);
  $(ov,'[data-a="glow"]').addEventListener('click', toggleGlowPicker);
  $(ov,'[data-a="allusers"]').addEventListener('click', toggleAllUsers);
  $(ov,'[data-a="cleanAnon"]').addEventListener('click', cleanAnonUsers);
  $(ov,'[data-a="cleanDup"]').addEventListener('click', cleanDupNicks);
  ov.querySelectorAll('[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    if(!activeAdmin(panel)||panel.busy)return;
    panel.userFilter=btn.dataset.filter;panel.userLimit=40;refreshUserFilter(panel);
  }));
  $(ov,'[data-el="userSearch"]').addEventListener('input',()=>{
    if(!activeAdmin(panel)||panel.busy)return;
    panel.userLimit=40;refreshUserFilter(panel);
  });
  $(ov,'[data-a="moreUsers"]').addEventListener('click',()=>{
    if(!activeAdmin(panel)||panel.busy)return;
    panel.userLimit+=40;refreshUserFilter(panel);
  });
  $(ov,'[data-a="ghost"]').addEventListener('click', toggleGhost);
  $(ov,'[data-a="toggleAdmFab"]').addEventListener('click', toggleAdminFab);
  $(ov,'[data-a="toggleDebug"]').addEventListener('click', toggleDebugMode);
  $(ov,'[data-a="runCheckup"]').addEventListener('click', runSystemCheckup);
  $(ov,'[data-a="ipbans"]').addEventListener('click', toggleIPBans);
  $(ov,'[data-a="nickbans"]').addEventListener('click', toggleNickBans);
  $(ov,'[data-a="nbAdd"]').addEventListener('click', addNickBan);
  $(ov,'[data-a="dupclean"]').addEventListener('click', cleanRegistry);
  loadStats(); loadLockState(); loadGhostState(); loadAdminFabState(); loadDebugState();
  $(ov,'[data-a="bcSend"]').addEventListener('click', sendBroadcast);
  $(ov,'[data-a="close"]').focus({preventScroll:true});
}

// ── 📊 İstatistik şeridi ────────────────────────────────────────
async function panelRead(panel,reference){
  if(!activeAdmin(panel))throw new Error('Yönetim paneli kapalı');
  const snapshot=await rawFdb.get(reference);
  if(!activeAdmin(panel))throw new Error('Yönetim paneli değişti');
  return snapshot;
}
async function loadStats(){
  const panel=activeAdmin();if(!panel)return;
  const el=$(panel.root,'[data-el="stats"]');if(!el)return;
  const [users,presence]=await Promise.allSettled([
    panelRead(panel,fdb.ref(db,'users')),
    panelRead(panel,fdb.query(fdb.ref(db,'presence'),fdb.orderByChild('online'),fdb.equalTo(true)))
  ]);
  if(!activeAdmin(panel))return;
  const total=users.status==='fulfilled'?fmt(Object.values(users.value.val()||{}).filter(profile=>profile&&!profile.deleted).length):'—';
  const online=presence.status==='fulfilled'?fmt(Object.values(presence.value.val()||{}).filter(isFreshPresence).length):'—';
  el.innerHTML=`<div><span>Portal oyuncusu</span><strong>${total}</strong></div><div><span>Çevrimiçi</span><strong>${online}</strong></div>`;
}
function isFreshPresence(record){
  const elapsed=Date.now()-Number(record?.lastSeen);
  return record?.online===true&&elapsed>=-60000&&elapsed<180000;
}

// ── 💬 Sohbet moderasyonu: son mesajlar + silme ─────────────────
async function toggleChatMod(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="chatmod"]');
  if(!toggleDisclosure(P,'chatmod',box))return;
  box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await panelRead(P,fdb.query(fdb.ref(db, 'globalChat'), fdb.limitToLast(15)));
    if(!snap.exists()){ box.innerHTML = '<i>Mesaj yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ ...ch.val(), key:ch.key }); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(m => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(m.name || '?')}</b>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.text || '')}</span>
        <button type="button" class="adm-btn r" aria-label="Mesajı sil" data-del="${esc(m.key)}">Sil</button>
      </div>`).join('');
    box.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => runAdminAction(async () => {if(!activeAdmin(P))return;
      if(!confirm('Bu mesaj silinsin mi?')) return;
      try{
        await fdb.set(fdb.ref(db, 'globalChat/' + btn.dataset.del), null);
        btn.closest('.adm-li').remove();
        logAdmin('chat-sil', '', 'mesaj silindi');
      }catch(e){ msg('✗ Silinemedi', false); }
    })));
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

// ── 🔒 Sohbet kilidi ────────────────────────────────────────────
async function loadLockState(){
  const panel=activeAdmin();if(!panel)return null;
  try{
    const snap=await panelRead(panel,fdb.ref(db,'chatModeration/locked')),on=snap.val()?.locked===true;
    const label=$(panel.root,'[data-el="lockState"]');if(label){label.textContent=on?'KİLİTLİ':'AÇIK';label.dataset.state=on?'warning':'on';}return on;
  }catch(e){if(activeAdmin(panel))$(panel.root,'[data-el="lockState"]').textContent='OKUNAMADI';return null;}
}

async function toggleChatLock(){
  const panel=activeAdmin();if(!panel)return;
  const on=await loadLockState();if(on===null||!activeAdmin(panel)){panelMessage(panel,'Sohbet durumu okunamadı; değişiklik yapılmadı',false);return;}
  const desired=!on;if(!confirm(desired?'Global sohbet kilitlensin mi?':'Global sohbet kilidi kaldırılsın mı?'))return;
  try{
    const actor=Auth.getState().uid,result=await fdb.runTransaction(fdb.ref(db,'chatModeration/locked'),value=>{
      if((value?.locked===true)!==on)return;return desired?{locked:true,by:actor,ts:Date.now()}:null;
    });
    if(!result.committed)throw new Error('Sohbet durumu başka bir yönetici tarafından değişti; yeniden kontrol et');
    await loadLockState();panelMessage(panel,desired?'✓ Sohbet kilitlendi':'✓ Sohbet kilidi kaldırıldı',true);logAdmin(desired?'sohbet-kilit':'sohbet-ac','','');
  }catch(e){panelMessage(panel,e.message||'Sohbet kilidi değiştirilemedi',false);}
}

async function toggleGlowPicker(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="glowbox"]');
  if(!toggleDisclosure(P,'glow',box))return;
  let GS = {}, cur = localStorage.getItem('hero_glow_style') || 'classic';
  try{ const m = await import('./social.js'); if(!activeAdmin(P))return; GS = m.GLOW_STYLES || {}; }catch(e){}
  box.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px 0">' +
    Object.keys(GS).map(k => `
      <button class="adm-acc" data-glow="${esc(k)}" style="${k===cur?'border-color:#ffd86b;':''}">
        <span class="${esc(GS[k].cls)}" style="font-weight:900;color:#FFD740">NitrikOksit</span><br><small style="opacity:.7">${esc(GS[k].label)}</small>
      </button>`).join('') + '</div>';
  box.querySelectorAll('[data-glow]').forEach(btn => btn.addEventListener('click', () => {
    localStorage.setItem('hero_glow_style', btn.dataset.glow);
    msg('✓ Işıltı: ' + btn.dataset.glow + ' (sohbette admin nicklerinde)', true);
    toggleGlowPicker(); toggleGlowPicker();   // yeniden çiz (seçim çerçevesi)
  }));
}

// ── 👥 Tüm kullanıcılar ─────────────────────────────────────────
// Tüm kullanıcılar listesi için global cache
let _allUsersCache = [];
let _dupNickMap = Object.create(null);  // nick → [uid1, uid2, ...]

async function toggleAllUsers(){
  const panel=activeAdmin();if(!panel)return;
  const box=$(panel.root,'[data-el="allusers"]'),list=$(panel.root,'[data-el="usersList"]');
  const request=panel.usersRequest=(panel.usersRequest||0)+1;
  const open=toggleDisclosure(panel,'allusers',box);
  if(list)list.style.display=open?'':'none';
  if(!open)return;
  box.innerHTML='Oyuncular yükleniyor…';
  try{
    const users=await readAdminUsers(panel);
    if(request!==panel.usersRequest)return;
    setAdminUsers(panel,users);
  }catch(error){if(activeAdmin(panel)&&request===panel.usersRequest)box.innerHTML='<i>Oyuncular okunamadı. Listeyi kapatıp yeniden aç.</i>';}
}
async function readAdminUsers(panel){
  const users=(await panelRead(panel,fdb.ref(db,'users'))).val()||{};
  return Object.keys(users).filter(uid=>validUid(uid)&&users[uid]&&!users[uid].deleted).map(uid=>({...users[uid],uid}));
}
function setAdminUsers(panel,users){
  if(!activeAdmin(panel))return;
  _allUsersCache=users.sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0));
  rebuildDupMap();
  $(panel.root,'[data-el="ucount"]').textContent=fmt(_allUsersCache.length);
  refreshUserFilter(panel);
}
function adminSearchKey(value){
  return String(value??'').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').normalize('NFD').replace(/[̀-ͯ]/g,'');
}
function userName(user){return String(user.nick||user.name||user.displayName||'').trim();}
function isGuestAccount(user){
  if(user.isGuest===true||user.anonymous===true)return true;
  if(user.email||user.provider==='google.com'||user.provider==='google')return false;
  const name=adminSearchKey(userName(user));
  return !name||/^(misafir|oyuncu|anonim)(?:[\s_#-]|\d|$)/.test(name);
}
function refreshUserFilter(panel){
  if(!activeAdmin(panel))return;
  panel.userFilter ||= 'all';
  for(const btn of panel.root.querySelectorAll('[data-filter]')){
    const on=btn.dataset.filter===panel.userFilter;
    btn.className=on?'adm-btn p':'adm-btn';btn.setAttribute('aria-pressed',String(on));
  }
  applyUserFilter(panel.userFilter,$(panel.root,'[data-el="userSearch"]')?.value||'');
}
function renderUserList(rows,dupSet){
  const panel=activeAdmin();if(!panel)return;
  const box=$(panel.root,'[data-el="allusers"]'),meta=$(panel.root,'[data-el="userCount"]'),more=$(panel.root,'[data-a="moreUsers"]');
  const visible=rows.slice(0,panel.userLimit||40);
  if(meta)meta.textContent=rows.length?`${fmt(visible.length)} / ${fmt(rows.length)} oyuncu`:'Aramaya uygun oyuncu yok';
  if(more)more.hidden=visible.length>=rows.length;
  if(!visible.length){box.innerHTML='<p class="adm-empty">Sonuç yok.</p>';return;}
  box.innerHTML=visible.map(user=>{
    const name=userName(user)||'İsimsiz oyuncu',collision=dupSet.has(user.uid);
    return `<button type="button" class="adm-li adm-user" data-uid="${esc(user.uid)}">
      <b>${esc(name)}</b>
      ${collision?'<span class="adm-tag mute">Nick çakışması</span>':''}
      ${user.isAdmin?'<span class="adm-tag" aria-label="Yönetici">👑</span>':''}
      ${user.isVice?'<span class="adm-tag" aria-label="Yardımcı yönetici">⭐</span>':''}
      ${user.banned===true?'<span class="adm-tag ban">Yasaklı</span>':''}
      ${user.muted===true?'<span class="adm-tag mute">Susturulmuş</span>':''}
      ${isGuestAccount(user)?'<span class="adm-tag">Misafir</span>':''}
      <span class="adm-user-kaju">${fmt(user.kaju)} Kaju</span>
    </button>`;
  }).join('');
  box.querySelectorAll('[data-uid]').forEach(control=>control.addEventListener('click',()=>loadTarget(control.dataset.uid)));
  if(panel.busy)lockPanel(panel,true);
}
function applyUserFilter(filter,searchValue){
  const dupSet=new Set(Object.values(_dupNickMap).filter(owners=>owners.length>1).flat());
  const query=adminSearchKey(searchValue).trim();
  const rows=_allUsersCache.filter(user=>{
    if(filter==='nonick'&&String(user.nick||'').trim())return false;
    if(filter==='anon'&&!isGuestAccount(user))return false;
    if(filter==='dup'&&!dupSet.has(user.uid))return false;
    return !query||adminSearchKey(userName(user)).includes(query)||adminSearchKey(user.uid).includes(query);
  });
  renderUserList(rows,dupSet);
}

// 🧹 Nick'siz (boş isimli) anonim kullanıcıları sil
function hasPendingEconomy(profile){
  return Object.values(profile.kajuOutbox||{}).some(v=>v&&v.state!=='published')
    ||Object.values(profile.heroClanDonations||{}).some(v=>v&&!['delivered','refunded'].includes(v.state))
    ||Object.values(profile.heroShopPurchases||{}).some(v=>v?.status==='pending')
    ||Object.values(profile.heroEggGifts||{}).some(v=>v?.status==='pending');
}
function isEmptyAnonymous(profile){
  return !!profile&&!profile.deleted&&!profile.isAdmin&&!profile.isVice
    &&!String(profile.nick||profile.name||profile.displayName||'').trim()&&(profile.kaju==null||(Number.isSafeInteger(profile.kaju)&&profile.kaju===0))
    &&!Number(profile.heroWalletRevision||0)
    &&Number(profile.level||1)<=1&&!Number(profile.totalXP||profile.xp?.totalXP||profile.xp?.xp||profile.xp||0)
    &&!profile.clanId&&!['heroRewardClaims','heroClanDonations','kajuOutbox','heroShopPurchases','heroEggGifts','heroAdminKajuOps','purchasedOnce','inventory','bestScores','kelimeRecords'].some(k=>Object.keys(profile[k]||{}).length);
}

async function cleanAnonUsers(){
  const panel=activeAdmin();if(!panel)return;
  let users;try{users=await readAdminUsers(panel);}catch(error){panelMessage(panel,'Oyuncular okunamadı; kayıtlar değiştirilmedi.',false);return;}
  if(!activeAdmin(panel))return;
  const candidates=users.filter(isEmptyAnonymous);
  if(!candidates.length){panelMessage(panel,'İlerlemesi olmayan boş kayıt bulunamadı.',true);return;}
  if(!confirm(candidates.length+' boş kayıt güncel verileri yeniden doğrulanarak temizlenecek. Devam?'))return;
  const deleted=new Set();let failed=0,skipped=0;
  for(const row of candidates){
    if(!activeAdmin(panel))return;
    try{
      if(row.uid===panel.ownerUid){skipped++;continue;}
      const role=await fdb.get(fdb.ref(db,'admins/'+row.uid));if(role.exists()){skipped++;continue;}
      let hasRelated=false;
      for(const path of ['kozmos/','shopInventory/','friends/','userNotifs/']){if((await fdb.get(fdb.ref(db,path+row.uid))).exists()){hasRelated=true;break;}}
      if(hasRelated){skipped++;continue;}
      const result=await fdb.runTransaction(fdb.ref(db,'users/'+row.uid),profile=>isEmptyAnonymous(profile)?null:undefined);
      if(result.committed)deleted.add(row.uid);else skipped++;
    }catch(e){if(!activeAdmin(panel))return;failed++;}
  }
  if(!activeAdmin(panel))return;
  setAdminUsers(panel,users.filter(row=>!deleted.has(row.uid)));
  void loadStats();
  panelMessage(panel,deleted.size+' kayıt silindi · '+skipped+' değişmiş/korunan kayıt atlandı'+(failed?' · '+failed+' başarısız':''),failed===0);logAdmin('anon-temizle','',deleted.size+' silindi, '+failed+' başarısız');
}

async function cleanDupNicks(){
  const panel=activeAdmin();if(!panel)return;
  try{setAdminUsers(panel,await readAdminUsers(panel));}catch(error){panelMessage(panel,'Oyuncular okunamadı; nickler değiştirilmedi.',false);return;}
  if(!activeAdmin(panel))return;
  const groups=Object.entries(_dupNickMap).filter(([,uids])=>uids.length>1);
  if(!groups.length){panelMessage(panel,'Tekrarlanan kayıtlı nick bulunamadı',true);return;}
  if(!confirm(groups.length+' nick grubu yeniden doğrulanacak. Kayıt defterindeki sahibi ve yöneticiler korunur; diğer hesaplarda yalnız aynı nick boşaltılır. Devam?'))return;
  let fixed=0,failed=0,skipped=0;
  for(const [key,uids] of groups){
    if(!activeAdmin(panel))return;
    try{
      const registry=(await fdb.get(fdb.ref(db,'nicks/'+key))).val();
      if(!registry||!uids.includes(registry.uid)){skipped+=uids.length;continue;}
      for(const uid of uids){
        if(uid===registry.uid)continue;
        const role=await fdb.get(fdb.ref(db,'admins/'+uid));if(role.exists()){skipped++;continue;}
        const result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
          if(!profile||profile.isAdmin||nickKeySafe(profile.nick||'')!==key)return;
          return {...profile,nick:null,name:profile.name===profile.nick?null:profile.name||null};
        });
        if(result.committed){fixed++;const row=_allUsersCache.find(v=>v.uid===uid);if(row)Object.assign(row,result.snapshot.val(),{uid});}else skipped++;
      }
    }catch(e){if(!activeAdmin(panel))return;failed++;}
  }
  rebuildDupMap();refreshUserFilter(panel);panelMessage(panel,fixed+' nick düzeltildi · '+skipped+' korundu/atlandı'+(failed?' · '+failed+' başarısız':''),failed===0);logAdmin('dup-temizle','',fixed+' nick, '+failed+' başarısız');
}
function rebuildDupMap(){
  _dupNickMap=Object.create(null);for(const row of _allUsersCache){const key=nickKeySafe(row.nick||'');if(key)(_dupNickMap[key]||=[]).push(row.uid);}
}

async function toggleOnline(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="online"]');
  if(!toggleDisclosure(P,'onlinelist',box))return;
  box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await panelRead(P,fdb.query(fdb.ref(db, 'presence'), fdb.orderByChild('online'), fdb.equalTo(true)));
    if(!snap.exists()){ box.innerHTML = '<i>Şu an çevrimiçi oyuncu yok</i>'; $(P.root,'[data-el="oncount"]').textContent = '(0)'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ ...ch.val(),uid:ch.key }); });
    // 3 dakikadan eski "online" kayıtları bayat say (kapanışta onDisconnect kaçmış olabilir)
    const fresh = rows.filter(isFreshPresence);
    fresh.sort((a,b) => (b.lastSeen||0)-(a.lastSeen||0));
    $(P.root,'[data-el="oncount"]').textContent = '(' + fresh.length + ')';
    if(!fresh.length){ box.innerHTML = '<i>Şu an çevrimiçi oyuncu yok</i>'; return; }
    box.innerHTML = fresh.map(r =>
      `<button type="button" class="adm-li adm-online adm-user" data-uid="${esc(r.uid)}">
        <span class="adm-online-dot" aria-hidden="true"></span>
        <b>${esc(r.name || 'Oyuncu')}</b> <span class="adm-user-kaju">${tAgoA(r.lastSeen)}</span>
      </button>`).join('');
    box.querySelectorAll('.adm-online').forEach(el=>el.addEventListener('click',()=>loadTarget(el.dataset.uid)));
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}
function tAgoA(ts){ const d = Date.now()-(ts||0); if(d<90e3) return 'şimdi'; if(d<3600e3) return Math.floor(d/60e3)+' dk önce'; return Math.floor(d/3600e3)+' sa önce'; }

// ── 📣 Duyuru ───────────────────────────────────────────────────
async function sendBroadcast(){
  const panel=activeAdmin();if(!panel)return;const input=$(panel.root,'[data-el="bcText"]'),text=input.value.trim().slice(0,200);
  if(!text){panelMessage(panel,'Duyuru metni boş',false);return;}
  if(!confirm('Bu duyuru tüm oyunculara gösterilecek:\n\n'+text+'\n\nGönderilsin mi?'))return;
  if(panel.broadcastAttempt?.text!==text)panel.broadcastAttempt={text,id:adminOperation('broadcast'),ts:Date.now()};
  const attempt=panel.broadcastAttempt;
  try{
    const actor=Auth.getState();await fdb.set(fdb.ref(db,'broadcasts/'+attempt.id),{text,ts:attempt.ts,by:actor.displayName||'Admin',byUid:actor.uid});
    if(!activeAdmin(panel))return;
    if(panel.broadcastAttempt===attempt)panel.broadcastAttempt=null;
    if(input.value.trim()===text)input.value='';panelMessage(panel,'✓ Duyuru kaydedildi',true);logAdmin('duyuru','',text.slice(0,80));
  }catch(e){panelMessage(panel,'Duyuru doğrulanamadı; aynı metinle yeniden kontrol edebilirsin',false);}
}

function nickKeySafe(n){ return String(n||'').replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase().replace(/[.#$\[\]\/\s]/g,''); }
async function rebuildRegistry(){
  const panel=activeAdmin();if(!panel)return;
  if(!confirm('Oyuncuların güncel nickleri doğrulanıp kayıt defterine eklenecek. Var olan başka sahipler korunur. Devam?'))return;
  let added=0,conflicts=0,failed=0,skipped=0;
  try{
    const users=(await fdb.get(fdb.ref(db,'users'))).val()||{};
    for(const uid of Object.keys(users)){
      if(!activeAdmin(panel))return;
      const profile=users[uid];if(!profile||profile.deleted){skipped++;continue;}
      const clean=String(profile.nick||profile.name||profile.displayName||'').trim().slice(0,16),validation=Auth.validateNick(clean);
      if(!validation.ok){skipped++;continue;}const key=nickKeySafe(validation.clean);
      try{
        let created=false;
        const registry=await fdb.runTransaction(fdb.ref(db,'nicks/'+key),entry=>{
          if(entry)return;created=true;return{uid,nick:validation.clean,ts:Date.now()};
        });
        const saved=registry.committed?registry.snapshot.val():(await fdb.get(fdb.ref(db,'nicks/'+key))).val();
        if(saved?.uid!==uid){conflicts++;continue;}if(registry.committed&&created)added++;
        if(!profile.nick)await fdb.runTransaction(fdb.ref(db,'users/'+uid),value=>{
          if(!value||value.deleted||value.nick||String(value.name||value.displayName||'').trim().slice(0,16)!==clean)return;
          return {...value,nick:validation.clean};
        });
      }catch(e){if(!activeAdmin(panel))return;failed++;}
    }
    panelMessage(panel,'Defter: '+added+' eklendi · '+conflicts+' çakışma · '+skipped+' atlandı'+(failed?' · '+failed+' başarısız':''),failed===0);logAdmin('nick-defter-onar','',added+' eklendi, '+conflicts+' çakışma, '+failed+' başarısız');
  }catch(e){panelMessage(panel,'Kullanıcılar okunamadı; işlem tamamlanmadı',false);}
}

function closePanel(){ if(P){const panel=P;P=null;panel.off?.forEach(off=>{try{off();}catch(e){}});panel.root.remove();_allUsersCache=[];_dupNickMap=Object.create(null);if(panel.opener?.isConnected)panel.opener.focus();} }
function msg(t,ok){panelMessage(P,t,ok);}

// ── Oyuncu ara ──────────────────────────────────────────────────
async function doSearch(){
  const panel=activeAdmin();if(!panel||panel.busy)return;
  const input=$(panel.root,'[data-el="q"]'),q=input.value.trim(),version=++panel.searchVersion;
  $(panel.root,'[data-el="sug"]').hidden=true;
  if(!q){panelMessage(panel,'Nick veya UID gir',false);return;}
  clearSelection(panel);panelMessage(panel,'Oyuncu aranıyor…',true);
  try{
    const result=q.length>=20&&!/\s/.test(q)?{uid:q}:await Auth.resolveNick(q);
    if(!activeAdmin(panel)||panel.busy||version!==panel.searchVersion||input.value.trim()!==q)return;
    const uid=result?.uid||q;
    if(!validUid(uid)){panelMessage(panel,'Oyuncu bulunamadı',false);return;}
    await loadTarget(uid,version);
  }catch(e){if(activeAdmin(panel)&&version===panel.searchVersion)panelMessage(panel,'Arama tamamlanamadı. Yeniden dene.',false);}
}

function clearSelection(panel){
  panel.target=null;
  $(panel.root,'[data-el="selected"]').textContent='İşlem için bir oyuncu seç';
  $(panel.root,'[data-el="result"]').innerHTML='';
}
async function loadTarget(uid,requestVersion){
  const panel=activeAdmin();if(!panel||panel.busy||!validUid(uid))return;
  const version=requestVersion??++panel.searchVersion;
  if(requestVersion===undefined){clearSelection(panel);panelMessage(panel,'Oyuncu yükleniyor…',true);}
  try{
    const snap=await fdb.get(fdb.ref(db,'users/'+uid));
    if(!activeAdmin(panel)||panel.busy||version!==panel.searchVersion)return;
    if(!snap.exists()){panelMessage(panel,'Oyuncu kaydı bulunamadı',false);return;}
    panel.target={uid,profile:snap.val()||{}};
    panelMessage(panel,'',true);renderTarget();
    $(panel.root,'[data-el="selected"]').textContent='Seçili: '+String(panel.target.profile.nick||panel.target.profile.name||uid)+' · '+uid.slice(0,10)+'…';
    $(panel.root,'[data-el="targetTitle"]')?.focus({preventScroll:true});
    $(panel.root,'[data-el="result"]').scrollIntoView?.({block:'nearest'});
  }catch(e){if(activeAdmin(panel)&&version===panel.searchVersion)panelMessage(panel,'Oyuncu okunamadı. Bağlantını ve yetkini kontrol et.',false);}
}

function renderTarget(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  if(!P.target)return;
  const { uid, profile: p } = P.target;
  if(p.deleted){
    $(P.root,'[data-el="result"]').innerHTML='<div class="adm-card"><h3 class="adm-prow" data-el="targetTitle" tabindex="-1">Portal erişimi kapalı</h3><div class="adm-uid">'+esc(uid)+'</div><div class="adm-sec"><p>Finansal işlem makbuzları korunuyor. Yarım kalan yan kayıt temizliğini yeniden çalıştırabilirsin.</p><button class="adm-btn r" data-a="deleteUser">Yan kayıt temizliğini tamamla</button></div></div>';
    $(P.root,'[data-a="deleteUser"]').addEventListener('click',doDeleteUser);
    if(P.busy)lockPanel(P,true);
    return;
  }
  const banned = p.banned === true;
  const muted = p.muted === true;
  const banInfo = banned ? (p.banType==='perma' ? 'KALICI' : ('→ ' + (p.banUntil ? new Date(p.banUntil).toLocaleString('tr-TR') : '?'))) : '';
  const muteInfo = muted ? ('→ ' + (p.muteUntil ? new Date(p.muteUntil).toLocaleString('tr-TR') : '?')) : '';
  $(P.root,'[data-el="result"]').innerHTML = `
    <div class="adm-card">
      <div class="adm-prow"><h3 data-el="targetTitle" tabindex="-1">${esc(p.nick || p.name || p.displayName || '—')}</h3>
        ${banned?'<span class="adm-tag ban">🚫 BANLI '+esc(banInfo)+'</span>':''}
        ${muted?'<span class="adm-tag mute">🔇 SUSTURULMUŞ '+esc(muteInfo)+'</span>':''}
      </div>
      <div class="adm-uid">${esc(uid)}</div>
      <div class="adm-prow">💰 <b data-el="kaju">${fmt(p.kaju)}</b> Kaju · LV ${esc(p.level||1)} · XP ${(()=>{ const x=p.xp; const v=Number((x&&typeof x==='object')?(x.totalXP??x.xp??0):(p.totalXP??x??0)); return (Number.isFinite(v)?v:0).toLocaleString('tr-TR'); })()}</div>
      <div class="adm-prow" style="font-size:11px;color:#9fb0d8">🌐 IP: <b data-el="ipTxt">${esc(p.lastIP || 'bilinmiyor')}</b>
        ${p.lastIP ? '<button class="adm-btn r" style="padding:4px 9px;font-size:10px" data-a="ipban">IP Banla</button>' : ''}
        <span data-el="ipBanState"></span>
      </div>

      <div class="adm-sec"><div class="adm-lbl">💰 KAJU AYARLA</div>
        <div class="adm-row">
          <input class="adm-in" data-el="kAmt" inputmode="numeric" placeholder="+ekle / −eksilt (örn. -500)">
          <button class="adm-btn p" data-a="kaju">Uygula</button>
        </div>
        <button class="adm-acc" data-a="khist" aria-expanded="false" aria-controls="adminKajuHistory">Kaju geçmişi</button>
        <div class="adm-log" id="adminKajuHistory" data-el="khist" style="display:none"></div>
      </div>

      <div class="adm-sec"><div class="adm-lbl">🔔 OYUNCUYA BİLDİRİM</div>
        <div class="adm-row">
          <input class="adm-in" data-el="ntfText" maxlength="150" placeholder="Bildirim metni">
          <button class="adm-btn p" data-a="ntfSend">Gönder</button>
        </div>
      </div>
      <div class="adm-sec"><div class="adm-lbl">✏️ NİCK ZORLA DEĞİŞTİR</div>
        <div class="adm-row">
          <input class="adm-in" data-el="nNick" maxlength="16" placeholder="Yeni nick" autocapitalize="off">
          <button class="adm-btn p" data-a="forcenick">Değiştir</button>
        </div>
      </div>

      <div class="adm-sec"><div class="adm-lbl">🚫 BAN / 🔇 MUTE</div>
        <div class="adm-row">
          <select class="adm-in" data-el="dur" aria-label="Yasak veya susturma süresi">
            <option value="3600000">1 saat</option><option value="86400000">1 gün</option>
            <option value="604800000">7 gün</option><option value="0">KALICI</option>
          </select>
          <input class="adm-in" data-el="reason" placeholder="Sebep" maxlength="80">
        </div>
        <div class="adm-row">
          <button class="adm-btn p" style="flex:1" data-a="kick">🦵 Oyundan At</button>
          <button class="adm-btn ${p.isVice?'g':'p'}" style="flex:1" data-a="vice">${p.isVice?'⭐ Vice Kaldır':'⭐ Vice Yap'}</button>
          <button class="adm-btn p" style="flex:1" data-a="op" data-el="opBtn">🔧 OP…</button>
        </div>
        <div class="adm-row">
          ${banned
            ? '<button class="adm-btn g" data-a="unban">✅ Banı Kaldır</button>'
            : '<button class="adm-btn r" data-a="ban">🚫 Banla</button>'}
          ${muted
            ? '<button class="adm-btn g" data-a="unmute">✅ Susturmayı Kaldır</button>'
            : '<button class="adm-btn r" data-a="mute">🔇 Sustur</button>'}
        </div>
      </div>

      <div class="adm-sec" style="border:1px solid rgba(255,82,82,.25);border-radius:10px;padding:8px">
        <div class="adm-lbl" style="color:#ff8fa0">Kalıcı işlemler</div>
        <div style="font-size:10px;color:#6d7aa8;margin-bottom:6px">Seçili oyuncuya uygulanır. Silme portal erişimini kapatır; Google hesabını silmez.</div>
        <button class="adm-acc" data-a="deldetail" aria-expanded="false" aria-controls="adminDeletionDetails" style="width:100%;margin-bottom:4px">🗂 Silinecekler <span>▾</span></button>
        <div id="adminDeletionDetails" data-el="deldetail" style="display:none;font-size:10px;color:#9fb0d8;padding:4px 0;line-height:1.8">
          ☑ Profil bilgileri kaldırılır; finansal makbuzlar korunur<br>
          ☑ nicks/ (nick kayıt defteri)<br>
          ☑ presence/${esc(uid)} (çevrimiçi durum)<br>
          ☑ friends/${esc(uid)} (arkadaş listesi)<br>
          ☑ userNotifs/${esc(uid)} (bildirimler)<br>
          ☑ gameLB/${esc(uid)} (oyun liderliği)<br>
          ☑ leaderboard/kaju/${esc(uid)}<br>
          ☑ seasons/* (sezon puanları)<br>
          ☑ shopInventory/${esc(uid)} (envanter)<br>
          ☑ kozmos/${esc(uid)} (kozmos)<br>
          ☑ outbox/${esc(uid)}<br>
          ☑ adminForcedNick/${esc(uid)}<br>
          ☑ kicks/${esc(uid)}<br>
        </div>
        <div class="adm-row" style="gap:6px;margin-top:4px">
          <button class="adm-btn r" style="flex:1" data-a="resetProgress">🔄 İlerlemeyi Sıfırla</button>
          <button class="adm-btn r" style="flex:1;background:rgba(255,50,50,.2);border-color:#ff5252" data-a="deleteUser">Portal Kaydını Sil</button>
        </div>
      </div>
    </div>`;
  const R = $(P.root,'[data-el="result"]');
  R.querySelectorAll('input,select').forEach(input=>{if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',input.placeholder||'İşlem değeri');});
  $(R,'[data-a="kaju"]').addEventListener('click', doKaju);
  $(R,'[data-a="khist"]').addEventListener('click', toggleKHist);
  $(R,'[data-a="forcenick"]').addEventListener('click', doForceNick);
  $(R,'[data-a="ntfSend"]').addEventListener('click', sendUserNotif);
  $(R,'[data-a="kick"]').addEventListener('click', doKick);
  $(R,'[data-a="vice"]').addEventListener('click', doVice);
  const ipb = $(R,'[data-a="ipban"]'); if(ipb) ipb.addEventListener('click', doIPBan);
  checkTargetIPBan();
  const opb = $(R,'[data-a="op"]'); if(opb){ opb.addEventListener('click', doOP); refreshOPBtn(); }
  const bb = $(R,'[data-a="ban"]'), ub = $(R,'[data-a="unban"]');
  const mb = $(R,'[data-a="mute"]'), um = $(R,'[data-a="unmute"]');
  if(bb) bb.addEventListener('click', () => doBan(true));
  if(ub) ub.addEventListener('click', () => doBan(false));
  if(mb) mb.addEventListener('click', () => doMute(true));
  if(um) um.addEventListener('click', () => doMute(false));
  // Silme butonları
  const delBtn = $(R,'[data-a="deleteUser"]');
  const resetBtn = $(R,'[data-a="resetProgress"]');
  const detailBtn = $(R,'[data-a="deldetail"]');
  if(detailBtn) detailBtn.addEventListener('click', () => {
    const d = $(R,'[data-el="deldetail"]');
    if(d)toggleDisclosure(P,'deldetail',d);
  });
  if(resetBtn) resetBtn.addEventListener('click', doResetProgress);
  if(delBtn) delBtn.addEventListener('click', doDeleteUser);
  if(P.busy)lockPanel(P,true);
}

// ── 👻 Ghost ────────────────────────────────────────────────────
async function loadGhostState(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  try{
    const m = await import('./auth.js');if(!activeAdmin(P))return;
    const on = m.isGhost && m.isGhost();
    const el = $(P.root,'[data-el="ghostState"]'); if(el){ el.textContent = on ? 'AÇIK 👻' : 'KAPALI'; el.style.color = on ? '#CE93D8' : '#5fd38a'; }
    return on;
  }catch(e){ return false; }
}
// ── 👑 Admin FAB görünürlük toggle ─────────────────────────────
// ── 🔬 DEBUG MODU ───────────────────────────────────────────────
function loadDebugState(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const on = localStorage.getItem('hero_debug') === '1';
  const el = $(P.root,'[data-el="debugState"]');
  if(el){ el.textContent = on ? 'AÇIK 🟢' : 'KAPALI ⚫'; el.style.color = on ? '#5fd38a' : '#9fb0d8'; }
  applyDebugOverlay(on);
  return on;
}
function toggleDebugMode(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const on = !(localStorage.getItem('hero_debug') === '1');
  localStorage.setItem('hero_debug', on ? '1' : '0');
  loadDebugState();
  msg(on ? '🔬 Debug modu açıldı — hatalar ekranda görünecek' : '🔬 Debug modu kapatıldı', true);
}
function applyDebugOverlay(on){
  let ov = document.getElementById('__heroDebugOverlay');
  if(on){
    if(!ov){
      ov = document.createElement('div');
      ov.id = '__heroDebugOverlay';
      ov.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483646;background:rgba(0,0,0,.82);color:#0f0;font:10px/1.5 monospace;padding:5px 8px;border:1px solid #0f0;border-radius:0 0 8px 0;max-width:70vw;max-height:30vh;overflow:auto;pointer-events:none';
      document.body.appendChild(ov);
      // Global hata yakalayıcıları kur (bir kez)
      if(!window.__heroDebugHooked){
        window.__heroDebugHooked = true;
        window.addEventListener('error', e => _heroDbgErr('JS', e.message, e.error && e.error.stack));
        window.addEventListener('unhandledrejection', e => { const r=e.reason; _heroDbgErr('PROMISE', (r&&r.message)||String(r), r&&r.stack); });
      }
    }
    _heroDbgRefresh();
    if(window.__heroDbgTimer) clearInterval(window.__heroDbgTimer);
    window.__heroDbgTimer = setInterval(_heroDbgRefresh, 1500);
  } else {
    if(ov) ov.remove();
    if(window.__heroDbgTimer){ clearInterval(window.__heroDbgTimer); window.__heroDbgTimer = null; }
  }
}
function _heroDbgErr(kind, m, stack){
  window.__heroDbgErrors = window.__heroDbgErrors || [];
  window.__heroDbgErrors.unshift('✗ ['+kind+'] '+m + (stack ? ' | '+stack.split(String.fromCharCode(10))[1] : ''));
  if(window.__heroDbgErrors.length > 6) window.__heroDbgErrors.pop();
}
function _heroDbgRefresh(){
  const ov = document.getElementById('__heroDebugOverlay'); if(!ov) return;
  let st = {}; try{ st = Auth.getState(); }catch(e){}
  const errs = window.__heroDbgErrors || [];
  const guestEl = document.getElementById('authGuest');
  const userEl = document.getElementById('authUser');
  ov.innerHTML = '<b style="color:#0ff">🔬 DEBUG</b> '
    + 'status=' + (st.status||'?')
    + ' uid=' + (st.uid ? st.uid.slice(0,6) : 'YOK')
    + ' adm=' + (st.isAdmin===true?'E':'H') + '<br>'
    + 'guest=' + (guestEl ? (guestEl.style.display||'def') : '?')
    + ' user=' + (userEl ? (userEl.style.display||'def') : '?') + '<br>'
    + (errs.length ? '<span style="color:#ff6b8a">'+errs.map(esc).join('<br>')+'</span>' : '<span style="color:#5fd38a">hata yok ✓</span>');
}

// ── 🩺 TAM SİSTEM CHECK-UP ───────────────────────────────────────
async function runSystemCheckup(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="checkup"]');
  if(!box) return;
  box.style.display = '';
  box.innerHTML = '<p>Tanılama çalışıyor…</p>';
  const lines = [];
  const ok  = (t) => lines.push('<div class="adm-check-pass">✓ '+esc(t)+'</div>');
  const bad = (t) => lines.push('<div class="adm-check-error">✗ '+esc(t)+'</div>');
  const inf = (t) => lines.push('<div>• '+esc(t)+'</div>');

  // 1. Auth durumu
  let st = {};
  try{ st = Auth.getState(); ok('Auth.getState() çalışıyor'); }catch(e){ bad('Auth.getState HATA: '+e.message); }
  inf('status = '+(st.status||'?')+' | uid = '+(st.uid?st.uid.slice(0,10):'YOK')+' | admin = '+(st.isAdmin===true));

  // 2. DOM elementleri (login ekranı)
  const guestEl = document.getElementById('authGuest');
  const userEl = document.getElementById('authUser');
  if(guestEl) ok('authGuest elementi var → display: '+(guestEl.style.display||'default')); else bad('authGuest elementi YOK');
  if(userEl) ok('authUser elementi var → display: '+(userEl.style.display||'default')); else bad('authUser elementi YOK');
  // Login state tutarlılığı
  if(st.status === 'google'){
    if(guestEl && guestEl.style.display !== 'none') bad('TUTARSIZ: giriş yapıldı ama login ekranı görünür! (render hatası)');
    if(userEl && userEl.style.display === 'none') bad('TUTARSIZ: giriş yapıldı ama kullanıcı paneli gizli!');
    if(guestEl && guestEl.style.display === 'none' && userEl && userEl.style.display !== 'none') ok('Login UI tutarlı (giriş paneli doğru gösteriliyor)');
  }

  // 3. Store
  try{ const Store = (await import('./store.js')).default || (await import('./store.js')).Store; const ss = Store.getState(); ok('Store.getState() OK → kaju:'+(ss.kaju||0)+' lvl:'+(ss.level||1)); }catch(e){ bad('Store HATA: '+e.message); }

  // 4. Kritik modüller yüklenebiliyor mu
  const mods = ['ui.js','nav.js','profile.js','social.js','clan.js','store.js','auth.js','kozmos.js','games/tetris.js','games/chess.js','games/tavla.js','games/kelime.js'];
  for(const mod of mods){
    if(!activeAdmin(P))return;
    try{ await import('./'+mod); ok(mod+' yükleniyor'); }
    catch(e){ bad(mod+' → '+e.message); }
  }

  // 5. Firebase bağlantısı
  try{
    await fdb.get(fdb.ref(db, 'admins/' + (st.uid||'x')));
    ok('Firebase DB erişilebilir');
  }catch(e){ bad('Firebase HATA: '+e.message); }

  // 6. Kullanıcı verisi
  if(st.uid){
    try{ const us = await fdb.get(fdb.ref(db,'users/'+st.uid)); if(us.exists()){ const u=us.val(); ok('Kullanıcı kaydı var → nick:'+(u.nick||u.name||'?')); } else bad('users/'+st.uid.slice(0,8)+' kaydı YOK'); }
    catch(e){ bad('Kullanıcı verisi HATA: '+e.message); }
  }

  // 7. localStorage sağlık
  try{
    const keys = ['hero_set_fabs','hero_admfab_hidden','hero_debug','hero_ui_scale','hero_glow_style'];
    const vals = keys.map(k => k+'='+(localStorage.getItem(k)||'∅')).join(' ');
    inf('localStorage: '+vals);
    ok('localStorage erişilebilir');
  }catch(e){ bad('localStorage HATA: '+e.message); }

  // 8. Bilinen hatalar (debug overlay'den)
  const errs = window.__heroDbgErrors || [];
  if(errs.length){ errs.forEach(er => bad('Yakalanan: '+er)); }
  else inf('Çalışma anında yakalanan hata yok (debug açıksa)');

  // 9. Service Worker
  if('serviceWorker' in navigator){
    try{ const regs = await navigator.serviceWorker.getRegistrations(); inf('Service Worker: '+regs.length+' kayıt'); ok('SW API erişilebilir'); }
    catch(e){ bad('SW HATA: '+e.message); }
  }

  lines.push('<strong>Tanılama tamamlandı</strong>');
  if(activeAdmin(P))box.innerHTML = lines.join('');
}

function loadAdminFabState(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const hidden = localStorage.getItem('hero_admfab_hidden') === '1';
  const el = $(P.root,'[data-el="admFabState"]');
  if(el){ el.textContent = hidden ? 'GİZLİ 🙈' : 'GÖRÜNÜR 👁'; el.style.color = hidden ? '#ff8fa0' : '#5fd38a'; }
  // FAB gizlenince tamamen kaybolmaz — %18 opak küçük buton olarak kalır (panele girebilmek için)
  const fab = document.getElementById('adminFloatBtn');
  if(fab){
    fab.style.display = 'grid';
    fab.style.opacity = hidden ? '0.18' : '';
    fab.style.transform = hidden ? 'scale(0.52)' : '';
    fab.title = hidden ? 'Admin paneli (gizli mod)' : '';
  }
  return hidden;
}
function toggleAdminFab(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const hidden = !( localStorage.getItem('hero_admfab_hidden') === '1' );
  localStorage.setItem('hero_admfab_hidden', hidden ? '1' : '0');
  loadAdminFabState();
  msg(hidden ? '👑 Admin FAB gizlendi' : '👑 Admin FAB gösteriliyor', true);
}

async function toggleGhost(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  try{
    const m = await import('./auth.js');if(!activeAdmin(P))return;
    const on = !(m.isGhost && m.isGhost());
    await m.setGhost(on);
    await loadGhostState();
    msg(on ? '✓ Ghost AÇIK — çevrimiçi listelerde görünmezsin 👻' : '✓ Ghost kapalı — tekrar görünürsün', true);
    logAdmin(on ? 'ghost-ac' : 'ghost-kapat', '', '');
  }catch(e){ msg('✗ Yapılamadı', false); }
}

// ── 🌐 IP ban / liste ───────────────────────────────────────────
let _ipKey = null;
async function ipKeyOf(ip){ const m = await import('./auth.js'); return m.ipKey(ip); }
async function checkTargetIPBan(){
  const c=selectedAdmin();if(!c||!c.target.profile.lastIP)return;
  const button=$(c.panel.root,'[data-a="ipban"]'),label=$(c.panel.root,'[data-el="ipBanState"]');setAdminDisabled(c.panel,button,true);
  try{
    const key=await ipKeyOf(c.target.profile.lastIP);if(!c.current())return;
    const snap=await fdb.get(fdb.ref(db,'ipBans/'+key));
    if(!c.current()||$(c.panel.root,'[data-a="ipban"]')!==button)return;
    c.target.ipBanned=snap.exists();c.target.ipBanKey=key;
    if(label)label.textContent=snap.exists()?'IP YASAKLI':'';
    if(button){button.textContent=snap.exists()?'IP Yasağını Kaldır':'IP Yasakla';button.className='adm-btn '+(snap.exists()?'g':'r');setAdminDisabled(c.panel,button,false);}
  }catch(e){if(c.current()&&button){button.textContent='IP durumu okunamadı';setAdminDisabled(c.panel,button,true);}}
}

async function doIPBan(){
  const c=selectedAdmin();if(!c||!c.target.profile.lastIP)return;
  if(typeof c.target.ipBanned!=='boolean'){c.say('Önce IP yasağı durumu yüklenmeli',false);return;}
  const ip=String(c.target.profile.lastIP),desired=!c.target.ipBanned;
  const reason=$(c.panel.root,'[data-el="reason"]').value.trim().slice(0,80)||'Yönetici kararı';
  if(desired&&!confirm('Bu IP engellenecek: '+ip+'\nBu IP’yi kullanan tüm hesaplar etkilenir.\nSebep: '+reason))return;
  try{
    const profile=await readTarget(c,true);if(String(profile.lastIP||'')!==ip)throw new Error('Oyuncunun IP adresi değişti; kaydı yeniden aç');
    const key=await ipKeyOf(ip);if(!c.current())return;
    await fdb.set(fdb.ref(db,'ipBans/'+key),desired?{ip,reason,by:c.actor.uid,ts:Date.now(),targetUid:c.uid}:null);
    if(!c.current())return;c.target.ipBanned=desired;c.say(desired?'✓ IP yasağı kaydedildi':'✓ IP yasağı kaldırıldı',true);logAdmin(desired?'ipban':'ipban-kaldir',c.uid,ip);renderTarget();
  }catch(e){c.say(e.message||'IP yasağı değiştirilemedi',false);}
}

async function toggleIPBans(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="ipbans"]');
  if(!toggleDisclosure(P,'ipbans',box))return;
  box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await panelRead(P,fdb.ref(db, 'ipBans'));
    if(!snap.exists()){ box.innerHTML = '<i>IP yasağı yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ ...ch.val(), key:ch.key }); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(r => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(r.ip || r.key)}</b><span style="flex:1">${esc(r.reason || '')}</span>
        <button class="adm-btn g" style="flex:0;padding:4px 9px;font-size:10px" data-ipun="${esc(r.key)}">Kaldır</button>
      </div>`).join('');
    box.querySelectorAll('[data-ipun]').forEach(btn => btn.addEventListener('click', () => runAdminAction(async () => {if(!activeAdmin(P))return;
      try{ await fdb.set(fdb.ref(db, 'ipBans/' + btn.dataset.ipun), null); btn.closest('.adm-li').remove(); logAdmin('ipban-kaldir', '', btn.dataset.ipun); }catch(e){ msg('✗ Kaldırılamadı', false); }
    })));
  }catch(e){ box.innerHTML = '<i>IP yasakları okunamadı</i>'; }
}

// ── 🚷 Nick yasakları ───────────────────────────────────────────
function nbKey(n){ return nickKeySafe(n); }
async function toggleNickBans(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="nickbans"]');
  if(!toggleDisclosure(P,'nickbans',box))return;
  refreshNickBans();
}
async function refreshNickBans(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const list = $(P.root,'[data-el="nbList"]'); if(!list) return;
  list.innerHTML = 'Yükleniyor…';
  try{
    const snap = await panelRead(P,fdb.ref(db, 'nickBans'));
    if(!snap.exists()){ list.innerHTML = '<i>Yasaklı nick yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push({ ...ch.val(), key:ch.key }); });
    list.innerHTML = rows.map(r => `
      <div class="adm-li" style="align-items:center">
        <b>${esc(r.nick || r.key)}</b>
        <button class="adm-btn g" style="flex:0;margin-left:auto;padding:4px 9px;font-size:10px" data-nbun="${esc(r.key)}">Kaldır</button>
      </div>`).join('');
    list.querySelectorAll('[data-nbun]').forEach(btn => btn.addEventListener('click', () => runAdminAction(async () => {if(!activeAdmin(P))return;
      try{ await fdb.set(fdb.ref(db, 'nickBans/' + btn.dataset.nbun), null); btn.closest('.adm-li').remove(); logAdmin('nickban-kaldir', '', btn.dataset.nbun); }catch(e){ msg('✗ Kaldırılamadı', false); }
    })));
  }catch(e){ list.innerHTML = '<i>Nick yasakları okunamadı</i>'; }
}
async function addNickBan(){
  const panel=activeAdmin();if(!panel)return;const input=$(panel.root,'[data-el="nbText"]'),value=Auth.validateNick(input.value.trim());
  if(!value.ok){panelMessage(panel,value.error||'Geçerli bir nick yaz',false);return;}
  const key=nbKey(value.clean),actor=Auth.getState();
  try{
    // Keep an existing player's registry ownership; the ban controls availability.
    await fdb.set(fdb.ref(db,'nickBans/'+key),{nick:value.clean,by:actor.uid,ts:Date.now()});
    if(!activeAdmin(panel))return;if(input.value.trim()===value.clean)input.value='';panelMessage(panel,'✓ Nick kullanımı yasaklandı: '+value.clean,true);logAdmin('nickban','',value.clean);await refreshNickBans();
  }catch(e){panelMessage(panel,'Nick yasağı kaydedilemedi',false);}
}

async function refreshOPBtn(){
  const c=selectedAdmin();if(!c)return;const btn=$(c.panel.root,'[data-el="opBtn"]');if(!btn)return;
  setAdminDisabled(c.panel,btn,true);
  try{
    const snap=await fdb.get(fdb.ref(db,'gcOperators/'+c.uid));
    if(!c.current()||$(c.panel.root,'[data-el="opBtn"]')!==btn)return;
    const on=snap.val()===true;btn.textContent=on?'🔧 OP Kaldır':'🔧 OP Yap';btn.className='adm-btn '+(on?'g':'p');btn.dataset.on=on?'1':'0';setAdminDisabled(c.panel,btn,false);
  }catch(e){if(c.current()){btn.textContent='OP durumu okunamadı';delete btn.dataset.on;setAdminDisabled(c.panel,btn,true);}}
}

async function doOP(){
  const c=selectedAdmin();if(!c)return;const btn=$(c.panel.root,'[data-el="opBtn"]');
  if(!['0','1'].includes(btn?.dataset.on)){c.say('Önce operatör durumu yüklenmeli',false);return;}
  const desired=btn.dataset.on!=='1';
  try{
    await readTarget(c,true);
    await fdb.set(fdb.ref(db,'gcOperators/'+c.uid),desired?true:null);
    if(!c.current())return;c.say(desired?'✓ Sohbet operatörlüğü verildi':'✓ Operatörlük kaldırıldı',true);logAdmin(desired?'op-yap':'op-kaldir',c.uid,'');await refreshOPBtn();
  }catch(e){c.say(e.message||'Operatörlük değiştirilemedi',false);}
}

async function cleanRegistry(){
  const panel=activeAdmin();if(!panel)return;
  if(!confirm('Kopya ve sahibi olmayan nick kayıtları güncel sahipleri yeniden doğrulanarak temizlenecek. Devam?'))return;
  let removed=0,failed=0,skipped=0;
  try{
    const entries=(await fdb.get(fdb.ref(db,'nicks'))).val()||{};
    for(const [key,entry] of Object.entries(entries)){
      if(!activeAdmin(panel))return;if(!validUid(entry?.uid)){skipped++;continue;}
      try{
        const profile=(await fdb.get(fdb.ref(db,'users/'+entry.uid))).val();
        const desired=nickKeySafe(profile?.nick||profile?.name||profile?.displayName||'');
        if(profile&&!profile.deleted&&desired===key){skipped++;continue;}
        const result=await fdb.runTransaction(fdb.ref(db,'nicks/'+key),current=>{
          if(!current||current.uid!==entry.uid||current.nick!==entry.nick||current.ts!==entry.ts)return;
          return null;
        });
        if(result.committed)removed++;else skipped++;
      }catch(e){if(!activeAdmin(panel))return;failed++;}
    }
    panelMessage(panel,removed+' kayıt temizlendi · '+skipped+' korundu'+(failed?' · '+failed+' başarısız':''),failed===0);logAdmin('defter-temizlik','',removed+' temizlendi, '+failed+' başarısız');
  }catch(e){panelMessage(panel,'Defter okunamadı; işlem tamamlanmadı',false);}
}

function _deleteNodes(uid){
  return [
    'users/' + uid,
    'presence/' + uid,
    'friends/' + uid,
    'userNotifs/' + uid,
    'outbox/' + uid,
    'adminForcedNick/' + uid,
    'kicks/' + uid,
    'shopInventory/' + uid,
    'shopPurchases/' + uid,
    'kozmos/' + uid,
    'kozmoPending/' + uid,
    'leaderboard/kaju/' + uid,
    'leaderboard/games/' + uid,
    'gameLB/' + uid,
    'gameLeaderboard/all/' + uid,
    'userInbox/' + uid,
  ];
}

async function doResetProgress(){
  const panel=P, target=panel?.target, actor=Auth.getState();
  const current=()=>panel.authorized!==false&&P===panel&&Auth.getState().uid===actor.uid&&Auth.getState().status==='google'&&Auth.getState().isAdmin===true;
  if(!target||!actor.uid||!current()||panel._resetBusy)return;
  const { uid, profile: p } = target;
  if(p.isAdmin){ msg('✗ Admin hesabının ilerlemesi sıfırlanamaz', false); return; }
  if(panel._resetCompletedUid===uid){msg('✓ Bu sıfırlama tamamlandı',true);return;}
  const nick = p.nick || p.name || p.displayName || uid.slice(0,8);
  if(!panel._resetAttempt||panel._resetAttempt.uid!==uid){
    panel._resetAttempt={uid,id:'reset_'+actor.uid+'_'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2))};
    panel._resetUncertain=false;
  }
  const operationId=panel._resetAttempt.id;
  if(!panel._resetUncertain&&panel._resetCleanupPendingUid!==uid&&!confirm(`"${nick}" kullanıcısının İLERLEMESİ sıfırlanacak:\n\n• Kaju: 0\n• Level: 1 / XP: 0\n• Maç istatistikleri ve geçmişi silinir\n• Kaju geçmişi silinir\n• Oyun liderliği silinir\n• Sezon puanları silinir\n\nProfil ve nick KORUNUR. GERİ ALINAMAZ!`)) return;
  panel._resetBusy=true;
  msg('Sıfırlanıyor…', true);
  try{
    const targetRole=await fdb.get(fdb.ref(db,'admins/'+uid));
    if(targetRole.exists()&&targetRole.val()!==false)throw new Error('Yönetici hesabının ilerlemesi sıfırlanamaz');
    let result;
    try{
      // Preserve reward receipts, reserved donations, transfer outboxes and spend
      // counters. Resetting them would replay paid rewards or bypass send limits.
      result=await fdb.runTransaction(fdb.ref(db,'users/'+uid),profile=>{
        if(!current()||!profile||profile.deleted||profile.isAdmin||profile.heroProgressResets?.[operationId])return;
        const revision=(Number.isSafeInteger(profile.heroWalletRevision)&&profile.heroWalletRevision>=0?profile.heroWalletRevision:0)+1;
        return {...profile,kaju:0,heroWalletRevision:revision,heroXPRevision:(Number.isSafeInteger(profile.heroXPRevision)&&profile.heroXPRevision>=0?profile.heroXPRevision:0)+1,heroMatchRevision:(Number.isSafeInteger(profile.heroMatchRevision)&&profile.heroMatchRevision>=0?profile.heroMatchRevision:0)+1,
          stats:{games:{},totalW:0,totalL:0,totalD:0,streak:0,bestStreak:0},h2h:null,matchHistory:null,level:1,xp:{level:1,xp:0,totalXP:0},bestScores:null,kelimeRecords:null,lastSeen:null,kaju_history:null,
          heroProgressResets:{...profile.heroProgressResets,[operationId]:{actorUid:actor.uid,ts:Date.now()}}};
      },{applyLocally:false});
    }catch(e){panel._resetUncertain=true;}
    if(!current())return;
    let profile;
    try{profile=result?.committed?result.snapshot.val():(await fdb.get(fdb.ref(db,'users/'+uid))).val();}
    catch(e){panel._resetUncertain=true;throw new Error('Sıfırlamanın sonucu doğrulanamadı; aynı işlemle yeniden kontrol et');}
    if(!current())return;
    if(profile?.heroProgressResets?.[operationId]?.actorUid!==actor.uid){
      throw new Error('Sıfırlama onaylanmadı');
    }
    panel._resetUncertain=false;
    // Leaderboard cleanup is safe to repeat after a lost acknowledgement.
    let cleanupFailed=0;
    const lbNodes = ['leaderboard/kaju/'+uid,'leaderboard/games/'+uid,'gameLB/'+uid,'gameLeaderboard/all/'+uid];
    await Promise.all(lbNodes.map(n => current()?fdb.set(fdb.ref(db,n),null).catch(()=>{cleanupFailed++;}):undefined));
    if(!current())return;
    try{
      const seasons = await fdb.get(fdb.ref(db, 'seasons'));
      if(!current())return;
      if(seasons.exists()){
        const dels=[];
        seasons.forEach(season=>{if(current())dels.push(fdb.set(fdb.ref(db,'seasons/'+season.key+'/'+uid),null));});
        await Promise.all(dels.map(d=>d.catch(()=>{cleanupFailed++;})));
      }
    }catch(e){cleanupFailed++;}
    if(!current())return;
    panel._resetCleanupPendingUid=cleanupFailed?uid:null;
    if(!cleanupFailed)panel._resetCompletedUid=uid;
    Object.assign(target.profile,{kaju:profile.kaju||0,level:profile.level||1,xp:profile.xp||{level:1,xp:0,totalXP:0}});
    logAdmin('ilerleme-sifirla',uid,nick);
    if(panel.target===target){msg(cleanupFailed?'İlerleme sıfırlandı; '+cleanupFailed+' yan kayıt temizlenemedi. Aynı işlemle temizliği yeniden deneyebilirsin':`✓ "${nick}" ilerlemesi sıfırlandı`,!cleanupFailed);renderTarget();}
  }catch(e){if(current()&&panel.target===target)msg('✗ '+(e.message||e),false);}
  finally{panel._resetBusy=false;}
}

async function doDeleteUser(){
  const c=selectedAdmin();if(!c)return;const nick=String(c.target.profile.nick||c.target.profile.name||c.uid);
  if(!confirm('"'+nick+'" portal kaydı silinecek ve portala erişimi kapatılacak.\nProfil, sosyal veriler ve envanter kaldırılır. Ödeme/ödül işlem makbuzları tekrar ödeme olmaması için korunur.\nGoogle hesabı silinmez. Geri alınamaz. Devam?'))return;
  if(!confirm('SON ONAY: '+nick+' ('+c.uid+') portal kaydı silinsin mi?'))return;
  try{
    const before=(await fdb.get(fdb.ref(db,'users/'+c.uid))).val();if(!before)throw new Error('Portal kaydı bulunamadı');
    const adminRole=await fdb.get(fdb.ref(db,'admins/'+c.uid));if(adminRole.exists()||before.isAdmin)throw new Error('Yönetici hesabı silinemez');
    if(!before.deleted&&hasPendingEconomy(before))throw new Error('Bekleyen ödeme veya teslim var. Önce İşlem Merkezi üzerinden tamamlanmalı.');
    const operationId=c.panel.deleteAttempt?.uid===c.uid?c.panel.deleteAttempt.id:adminOperation('delete');c.panel.deleteAttempt={uid:c.uid,id:operationId};
    const result=before.deleted?null:await fdb.runTransaction(fdb.ref(db,'users/'+c.uid),profile=>{
      if(!c.current()||!profile||profile.isAdmin||hasPendingEconomy(profile))return;
      const preserved={};
      for(const [key,value] of Object.entries(profile))if(/^hero[A-Z]/.test(key)||['kajuSent','purchasedOnce'].includes(key))preserved[key]=value;
      return {...preserved,kaju:0,heroWalletRevision:(Number.isSafeInteger(profile.heroWalletRevision)&&profile.heroWalletRevision>=0?profile.heroWalletRevision:0)+1,heroInventoryRevision:(Number.isSafeInteger(profile.heroInventoryRevision)&&profile.heroInventoryRevision>=0?profile.heroInventoryRevision:0)+1,
        heroDeletionCleanup:{nickKeys:Array.from(new Set([profile.nick,profile.name].filter(Boolean).map(nickKeySafe))).filter(Boolean),clanId:profile.clanId||null,status:'pending'},
        deleted:true,deletedAt:Date.now(),deletedBy:c.actor.uid,deleteOperationId:operationId,banned:true,banType:'perma',banMsg:'Portal kaydı silindi',banReason:'Portal kaydı silindi'};
    });
    if(!before.deleted&&!result?.committed)throw new Error('Silme onaylanmadı; oyuncunun güncel kaydını kontrol et');
    const tombstone=before.deleted?before:result.snapshot.val(),plan=tombstone.heroDeletionCleanup||{};
    let failed=0;
    // Exact-owned nick records only: never release another player's renamed claim.
    for(const key of plan.nickKeys||[]){
      if(!key)continue;
      try{await fdb.runTransaction(fdb.ref(db,'nicks/'+key),entry=>entry?.uid===c.uid?null:undefined);}catch(e){failed++;}
    }
    if(plan.clanId&&validUid(plan.clanId))try{await fdb.set(fdb.ref(db,'clans/'+plan.clanId+'/members/'+c.uid),null);}catch(e){failed++;}
    const nodes=_deleteNodes(c.uid).filter(path=>path!=='users/'+c.uid);
    try{const seasons=await fdb.get(fdb.ref(db,'seasons'));seasons.forEach(season=>nodes.push('seasons/'+season.key+'/'+c.uid));}catch(e){failed++;}
    for(const path of nodes){if(!c.current())return;try{await fdb.set(fdb.ref(db,path),null);}catch(e){if(!c.current())return;failed++;}}
    if(!c.current())return;
    _allUsersCache=_allUsersCache.filter(row=>row.uid!==c.uid);rebuildDupMap();
    c.say(failed?'Portal erişimi kapatıldı; '+failed+' yan kayıt temizlenemedi. Kaydı yeniden açıp kontrol et.':'✓ Portal kaydı silindi; ödeme makbuzları korundu',failed===0);
    logAdmin('kullanici-sil',c.uid,nick+' · '+failed+' temizlenemeyen kayıt');
    if(failed){c.target.profile=tombstone;renderTarget();}
    else{
      try{await fdb.update(fdb.ref(db,'users/'+c.uid+'/heroDeletionCleanup'),{status:'complete',completedAt:Date.now()});}catch(e){}
      if(!c.current())return;
      $(c.panel.root,'[data-el="result"]').innerHTML='<div class="adm-empty">Portal kaydı silindi. Ödeme makbuzları korundu.</div>';
      $(c.panel.root,'[data-el="selected"]').textContent='İşlem için bir oyuncu seç';c.panel.target=null;
    }
  }catch(e){c.say(e.message||'Silme doğrulanamadı; kaydı yeniden açıp kontrol et',false);}
}

async function doKick(){
  const c=selectedAdmin();if(!c)return;
  const reason=$(c.panel.root,'[data-el="reason"]').value.trim().slice(0,80)||'Yönetici kararı';
  if(!confirm('Seçili oyuncunun oturumu kapatılacak.\nSebep: '+reason+'\nOnaylıyor musun?'))return;
  try{
    await readTarget(c,true);
    const presence=(await fdb.get(fdb.ref(db,'presence/'+c.uid))).val();
    if(!presence?.online||Date.now()-Number(presence.lastSeen||0)>=180000)throw new Error('Oyuncu şu an çevrimiçi değil');
    await fdb.set(fdb.ref(db,'kicks/'+c.uid),{ts:Date.now(),by:c.actor.uid,reason});
    if(!c.current())return;c.say('✓ Oturumu kapatma sinyali iletildi',true);logAdmin('kick',c.uid,reason);
  }catch(e){c.say(e.message||'İşlem tamamlanamadı',false);}
}

async function doVice(){
  const c=selectedAdmin();if(!c)return;const desired=c.target.profile.isVice!==true;
  try{
    const profile=await writeTarget(c,{isVice:desired?true:null},true);
    if(!c.current())return;c.target.profile=profile;
    c.say(desired?'✓ Vice yetkisi verildi':'✓ Vice yetkisi kaldırıldı',true);logAdmin(desired?'vice-yap':'vice-kaldir',c.uid,'');renderTarget();
  }catch(e){c.say(e.message||'Yetki değiştirilemedi',false);}
}

async function sendUserNotif(){
  const c=selectedAdmin();if(!c)return;
  const input=$(c.panel.root,'[data-el="ntfText"]'),text=input.value.trim().slice(0,150);
  if(!text){c.say('Bildirim metni boş',false);return;}
  const signature=c.uid+':'+text;
  if(c.panel.noticeAttempt?.signature!==signature)c.panel.noticeAttempt={signature,id:adminOperation('notice'),ts:Date.now()};
  const attempt=c.panel.noticeAttempt;
  try{
    await readTarget(c);
    await fdb.set(fdb.ref(db,'userNotifs/'+c.uid+'/'+attempt.id),{icon:'📩',text,ts:attempt.ts,from:'admin',fromUid:c.actor.uid});
    if(!c.current())return;
    if(c.panel.noticeAttempt===attempt)c.panel.noticeAttempt=null;
    if(input.value.trim()===text)input.value='';
    c.say('✓ Bildirim kaydedildi',true);logAdmin('bildirim',c.uid,text.slice(0,60));
  }catch(e){c.say('Bildirim doğrulanamadı; aynı metinle yeniden kontrol edebilirsin',false);}
}

async function doKaju(){
  const panel = P, target = P?.target, me = Auth.getState();
  if(!panel || !target || target.profile?.deleted || panel._kajuBusy || !panel.root?.isConnected || !me.uid || me.status !== 'google' || me.isAdmin !== true) return;
  const current = () => panel.authorized!==false && P === panel && panel.root.isConnected && Auth.getState().uid === me.uid && Auth.getState().isAdmin === true;
  const visible = () => current() && panel.target === target;
  const input = $(panel.root,'[data-el="kAmt"]'), button = $(panel.root,'[data-a="kaju"]');
  const raw = input.value.trim(), v = Number(raw);
  if(!/^[+-]?\d+$/.test(raw) || !Number.isSafeInteger(v) || v === 0){ msg('Geçerli bir tam sayı gir (örn. 500 veya -500)', false); return; }
  panel._kajuBusy = true; if(button) button.disabled = true;
  if(panel._kajuAttempt?.uid !== target.uid || panel._kajuAttempt?.delta !== v) panel._kajuAttempt = {uid:target.uid, delta:v, id:'admin_ui_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '_' + Math.random().toString(36).slice(2))};
  const attempt=panel._kajuAttempt;
  msg('Uygulanıyor…', true);
  try{
    const r = await Store.adminAdjustKaju(target.uid, v, 'admin-panel', attempt.id);
    if(!current()) return;
    if(!r.ok){ if(visible()) msg('✗ ' + r.error, false); return; }
    // Retry the same receipt only while the previous attempt is unconfirmed.
    if(panel._kajuAttempt===attempt)panel._kajuAttempt=null;
    // The result and audit entry belong to the target captured before the await.
    if(target.profile) target.profile.kaju = r.newBalance;
    if(visible()){
      $(panel.root,'[data-el="kaju"]').textContent = fmt(r.newBalance);
      if(input.value.trim() === raw) input.value = '';
      msg(`✓ Uygulanan: ${fmt(r.appliedDelta)} Kaju · yeni bakiye: ${fmt(r.newBalance)}`, true);
    }
    logAdmin(r.appliedDelta > 0 ? 'kaju-ekle' : 'kaju-eksilt', target.uid, r.appliedDelta + ' → ' + r.newBalance);
  }catch(error){ if(visible()) msg('✗ İşlem doğrulanamadı. Bakiyeyi yenileyip kontrol et.', false); }
  finally{ panel._kajuBusy = false; if(button?.isConnected) button.disabled = false; }
}

async function toggleKHist(){
  const panel = P, target = P?.target, owner = Auth.getState().uid;
  if(!panel || !target || Auth.getState().isAdmin !== true) return;
  const box = $(panel.root,'[data-el="khist"]');
  const current = () => P === panel && panel.target === target && panel.root.isConnected && Auth.getState().uid === owner && Auth.getState().isAdmin === true && $(panel.root,'[data-el="khist"]') === box;
  if(!toggleDisclosure(panel,'khist',box))return;
  box.innerHTML = 'Yükleniyor…';
  try{
    const profilePath = 'users/' + target.uid;
    const [history,archived] = await Promise.allSettled([
      fdb.get(fdb.query(fdb.ref(db, profilePath + '/kaju_history'), fdb.limitToLast(15))),
      fdb.get(fdb.ref(db, profilePath + '/heroKajuHistoryArchive')),
    ]);
    if(!current()) return;
    const rows = [];
    if(history.status==='fulfilled'&&history.value.exists())history.value.forEach(ch=>{const v=ch.val();if(v&&Number.isFinite(Number(v.amount)))rows.push(v);});
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    let content = rows.map(v=>{
      const negative=Number(v.amount)<0||['spend','admin-sub'].includes(v.type);
      return `<div class="adm-li"><span>${new Date(v.ts).toLocaleString('tr-TR')}</span> <b class="${negative?'bad':'ok'}">${negative?'−':'+'}${fmt(Math.abs(Number(v.amount)))}</b> <span>${esc(v.type||'')} · ${esc(v.reason||'')}</span></div>`;
    }).join('') || (history.status==='fulfilled'?'<i>Kayıt yok</i>':'<i>İşlemler okunamadı</i>');
    if(archived.status==='fulfilled'){
      const archive=archived.value.val();
      const count=archive&&typeof archive==='object'&&!Array.isArray(archive)?Object.entries(archive).filter(([key,entry])=>/^entry_\d+$/.test(key)&&entry&&typeof entry==='object'&&!Array.isArray(entry)
        &&Object.hasOwn(entry,'original')&&entry.original!=null
        &&(entry.kind==='collection'||entry.kind==='row'&&typeof entry.logId==='string'&&entry.logId.length>0)).length:0;
      if(count)content+=`<div class="adm-li">İnceleme arşivi: ${count} öğe. Eski kayıtlar korundu; doğrulanmış işlem olarak listelenmiyor.</div>`;
    }else content+='<div class="adm-li">İnceleme arşivi okunamadı.</div>';
    box.innerHTML=content;
  }catch(e){ if(current()) box.innerHTML = '<i>Okunamadı</i>'; }
}

// ── Nick zorla değiştir ─────────────────────────────────────────
function nickKey(n){ return String(n||'').replace(/İ/g,'i').replace(/I/g,'ı').toLowerCase(); }
async function doForceNick(){
  const c=selectedAdmin();if(!c)return;const input=$(c.panel.root,'[data-el="nNick"]'),want=input.value.trim(),validation=Auth.validateNick(want);
  if(!validation.ok){c.say(validation.error,false);return;}
  const clean=validation.clean,key=nickKey(clean),operationId=adminOperation('nickname');let profileChanged=false,oldNick='';
  if(!confirm('Seçili oyuncunun nicki "'+clean+'" yapılacak. Onaylıyor musun?'))return;
  try{
    const before=await readTarget(c),expected=String(before.nick||'');oldNick=expected;
    const reservedResult=await fdb.runTransaction(fdb.ref(db,'nicks/'+key),entry=>{
      if(!c.current()||(entry&&entry.uid!==c.uid))return;
      return {uid:c.uid,nick:clean,ts:Date.now(),operationId};
    });
    if(!reservedResult.committed)throw new Error('Bu nick başka bir oyuncuya ait');
    let changed=await fdb.runTransaction(fdb.ref(db,'users/'+c.uid),profile=>{
      if(!c.current()||!profile||profile.deleted||String(profile.nick||'')!==expected)return;
      return {...profile,nick:clean,name:clean};
    });
    if(!changed.committed){
      const confirmed=await fdb.get(fdb.ref(db,'users/'+c.uid));
      if(confirmed.val()?.nick===clean)changed={snapshot:confirmed};
      else{
        await fdb.runTransaction(fdb.ref(db,'nicks/'+key),entry=>entry?.uid===c.uid&&entry.operationId===operationId?null:undefined);
        throw new Error('Oyuncunun nicki değişti; yeniden açıp kontrol et');
      }
    }
    profileChanged=true;
    const warnings=[];
    if(oldNick&&nickKey(oldNick)!==key){
      try{await fdb.runTransaction(fdb.ref(db,'nicks/'+nickKey(oldNick)),entry=>entry?.uid===c.uid?null:undefined);}catch(e){warnings.push('eski kayıt temizlenemedi');}
    }
    try{await fdb.set(fdb.ref(db,'adminForcedNick/'+c.uid),{nick:clean,by:c.actor.uid,ts:Date.now()});}catch(e){warnings.push('canlı bildirim iletilemedi');}
    if(!c.current())return;c.target.profile=changed.snapshot.val();
    if(input.value.trim()===want)input.value='';c.say('✓ Nick "'+clean+'" yapıldı'+(warnings.length?' · '+warnings.join(' · '):''),true);logAdmin('nick-zorla',c.uid,oldNick+' → '+clean);renderTarget();
  }catch(e){
    // An uncertain acknowledgement retains its claimed registry entry, so the
    // same player's current profile can be reconciled without stealing a name.
    c.say(profileChanged?'Nick değişti; ikincil kayıtlar tamamlanamadı':(e.message||'Nick değişikliği doğrulanamadı; kaydı yeniden aç'),false);
  }
}

function durReason(){
  const panel=activeAdmin();if(!panel)return null;
  const select=$(panel.root,'[data-el="dur"]'),d=Number(select.value);
  if(![0,3600000,86400000,604800000].includes(d)){panelMessage(panel,'Geçerli bir süre seç',false);return null;}
  const reason=$(panel.root,'[data-el="reason"]').value.trim().slice(0,80)||'Belirtilmedi';
  return {d,reason,until:d>0?Date.now()+d:0,label:d>0?String(select.selectedOptions?.[0]?.textContent||d/3600000+' saat'):'KALICI'};
}

async function doBan(on){
  const c=selectedAdmin();if(!c)return;
  const duration=on?durReason():null;if(on&&!duration)return;
  if(on&&!confirm('Seçili oyuncu '+duration.label+' yasaklanacak.\nSebep: '+duration.reason+'\nOnaylıyor musun?'))return;
  const fields=on?{banned:true,banType:duration.until?'temp':'perma',banUntil:duration.until||null,banMsg:duration.reason,banReason:duration.reason,bannedBy:c.actor.uid,bannedAt:Date.now(),banSource:'admin-panel',banIPKey:null}
    :{banned:false,banType:null,banUntil:null,banMsg:null,banReason:null,banSource:null,banIPKey:null};
  try{
    const profile=await writeTarget(c,fields,true);if(!c.current())return;
    c.target.profile=profile;c.say(on?'✓ Yasak uygulandı ('+duration.label+')':'✓ Yasak kaldırıldı',true);logAdmin(on?'ban':'unban',c.uid,duration?.reason||'');renderTarget();
  }catch(e){c.say(e.message||'Yasak değiştirilemedi',false);}
}

async function doMute(on){
  const c=selectedAdmin();if(!c)return;
  const duration=on?durReason():null;if(on&&!duration)return;
  const fields=on?{muted:true,muteUntil:duration.until||null,muteReason:duration.reason,mutedBy:c.actor.uid,mutedAt:Date.now()}:{muted:false,muteUntil:null,muteReason:null};
  try{
    const profile=await writeTarget(c,fields,true);if(!c.current())return;
    c.target.profile=profile;c.say(on?'✓ Susturma uygulandı ('+duration.label+')':'✓ Susturma kaldırıldı',true);logAdmin(on?'mute':'unmute',c.uid,duration?.reason||'');renderTarget();
  }catch(e){c.say(e.message||'Susturma değiştirilemedi',false);}
}

async function toggleLog(){
  const P=activeAdmin();if(!P)return;
  const msg=(text,ok)=>panelMessage(P,text,ok);
  const box = $(P.root,'[data-el="log"]');
  if(!toggleDisclosure(P,'loglist',box))return;
  box.innerHTML = 'Yükleniyor…';
  try{
    const snap = await panelRead(P,fdb.query(fdb.ref(db, 'adminLog'), fdb.limitToLast(20)));
    if(!snap.exists()){ box.innerHTML = '<i>Kayıt yok</i>'; return; }
    const rows = []; snap.forEach(ch => { rows.push(ch.val()); });
    rows.sort((a,b) => (b.ts||0)-(a.ts||0));
    box.innerHTML = rows.map(v =>
      `<div class="adm-li"><span>${new Date(v.ts).toLocaleString('tr-TR')}</span> <b>${esc(v.adminNick||'?')}</b> <span>${esc(v.action)} → ${esc((v.target||'').slice(0,10))}… ${esc(v.detail||'')}</span></div>`
    ).join('');
  }catch(e){ box.innerHTML = '<i>Okunamadı</i>'; }
}

// A single visible action lock also protects queued double clicks and maintenance.
const original_runSystemCheckup=runSystemCheckup;runSystemCheckup=(...args)=>runAdminAction(()=>original_runSystemCheckup(...args),'Sistem kontrol ediliyor…');
const original_toggleChatLock=toggleChatLock;toggleChatLock=(...args)=>runAdminAction(()=>original_toggleChatLock(...args),'İşlem sürüyor…');
const original_cleanAnonUsers=cleanAnonUsers;cleanAnonUsers=(...args)=>runAdminAction(()=>original_cleanAnonUsers(...args),'İşlem sürüyor…');
const original_cleanDupNicks=cleanDupNicks;cleanDupNicks=(...args)=>runAdminAction(()=>original_cleanDupNicks(...args),'İşlem sürüyor…');
const original_sendBroadcast=sendBroadcast;sendBroadcast=(...args)=>runAdminAction(()=>original_sendBroadcast(...args),'İşlem sürüyor…');
const original_rebuildRegistry=rebuildRegistry;rebuildRegistry=(...args)=>runAdminAction(()=>original_rebuildRegistry(...args),'İşlem sürüyor…');
const original_toggleGhost=toggleGhost;toggleGhost=(...args)=>runAdminAction(()=>original_toggleGhost(...args),'İşlem sürüyor…');
const original_doIPBan=doIPBan;doIPBan=(...args)=>runAdminAction(()=>original_doIPBan(...args),'İşlem sürüyor…');
const original_addNickBan=addNickBan;addNickBan=(...args)=>runAdminAction(()=>original_addNickBan(...args),'İşlem sürüyor…');
const original_doOP=doOP;doOP=(...args)=>runAdminAction(()=>original_doOP(...args),'İşlem sürüyor…');
const original_cleanRegistry=cleanRegistry;cleanRegistry=(...args)=>runAdminAction(()=>original_cleanRegistry(...args),'İşlem sürüyor…');
const original_doDeleteUser=doDeleteUser;doDeleteUser=(...args)=>runAdminAction(()=>original_doDeleteUser(...args),'İşlem sürüyor…');
const original_doKick=doKick;doKick=(...args)=>runAdminAction(()=>original_doKick(...args),'İşlem sürüyor…');
const original_doVice=doVice;doVice=(...args)=>runAdminAction(()=>original_doVice(...args),'İşlem sürüyor…');
const original_sendUserNotif=sendUserNotif;sendUserNotif=(...args)=>runAdminAction(()=>original_sendUserNotif(...args),'İşlem sürüyor…');
const original_doForceNick=doForceNick;doForceNick=(...args)=>runAdminAction(()=>original_doForceNick(...args),'İşlem sürüyor…');
const original_doBan=doBan;doBan=(...args)=>runAdminAction(()=>original_doBan(...args),'İşlem sürüyor…');
const original_doMute=doMute;doMute=(...args)=>runAdminAction(()=>original_doMute(...args),'İşlem sürüyor…');
const original_doKaju=doKaju;doKaju=(...args)=>runAdminAction(()=>original_doKaju(...args),'Kaju işlemi doğrulanıyor…');
const original_doResetProgress=doResetProgress;doResetProgress=(...args)=>runAdminAction(()=>original_doResetProgress(...args),'İlerleme sıfırlanıyor…');
// Global erişim — Ayarlar ekranındaki buton veya başka modüller çağırabilsin
try{ window.Hero = window.Hero || {}; window.Hero.openAdminPanel = openAdminPanel; }catch(e){}

export default openAdminPanel;
