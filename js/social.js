// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — SOSYAL HUB (💎 FAB) + 👑 ADMİN FAB
//  Goodyedek monolitinden taşındı: sürüklenebilir FAB'lar, 3 sekmeli
//  hub (CHAT / ÖZEL / BİLDİRİM), okunmamış rozetleri.
//  Veri katmanı temiz: Auth/fdb (globalChat, messages, userNotifs).
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tAgo = (ts) => { const d = Date.now()-ts; if(d<60e3) return 'şimdi'; if(d<3600e3) return Math.floor(d/60e3)+' dk'; if(d<86400e3) return Math.floor(d/3600e3)+' sa'; return Math.floor(d/86400e3)+' g'; };

let H = null;   // hub durumu

// Nick Işıltısı stilleri (Goodyedek'ten) — izleyenin tercihi
export const GLOW_STYLES = {
  classic:{label:'✨ Klasik', cls:'ng-classic'}, rainbow:{label:'🌈 Gökkuşağı', cls:'ng-rainbow'},
  police:{label:'🚔 Polis', cls:'ng-police'},   fire:{label:'🔥 Yangın', cls:'ng-fire'},
  ice:{label:'❄️ Buz', cls:'ng-ice'},           purple:{label:'💜 Mor', cls:'ng-purple'},
  gold:{label:'👑 Altın', cls:'ng-gold'}
};
function showToast(msg,dur){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(20,30,60,.95);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:10px 18px;font-size:12px;font-weight:700;color:#dfe7ff;z-index:99999;pointer-events:none;animation:dailyToastIn .3s ease';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), dur||2200);
}
export function glowClass(){ const k = localStorage.getItem('hero_glow_style') || 'classic'; return (GLOW_STYLES[k] || GLOW_STYLES.classic).cls; }

// Seçilebilir avatarlar (profil > değiştir)
// Basit, her cihazda çalışan avatarlar (ZWJ sekansı yok)
export const AVATARS = ['🐉','🦊','🦁','🐯','🐺','🐼','🐸','🦄','👾','🤖','👻','👽','🎃','⚡','🔥','❄️','💎','🌙','⭐','🌊','🏆','🎯','🎮','🌈'];
// UID'den deterministik varsayılan avatar seç
export function defaultAvatar(uid){
  if(!uid) return '⭐';
  let h = 0; for(let i=0;i<uid.length;i++) h = ((h<<5)-h) + uid.charCodeAt(i);
  return AVATARS[Math.abs(h) % AVATARS.length];
}
// Avatar değeri emoji mi yoksa yanlış kaydedilmiş metin mi kontrol et
function isValidAvatar(v){
  if(!v || typeof v !== 'string') return false;
  if(AVATARS.includes(v)) return true;
  try{ return /^\p{Emoji}/u.test(v) && v.length <= 8; }catch(e){ return false; }
}
export function avatarOf(p, uid){
  const av = p && p.avatar;
  return isValidAvatar(av) ? av : defaultAvatar(uid);
}

// ── 👤 OYUNCU KARTI: her yerden açılan mini profil ─────────────
export async function openPlayerCard(uid){
  if(!uid || document.getElementById('pcPop')) return;
  const ov = document.createElement('div');
  ov.id = 'pcPop'; ov.className = 'pcp-ov';
  ov.innerHTML = '<div class="pcp-card"><div class="pcp-load">⏳</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', (e) => { if(e.target === ov) ov.remove(); });
  let p = {}, pr = {};
  try{ const s = await fdb.get(fdb.ref(db, 'users/' + uid)); p = s.exists() ? s.val() : {}; }catch(e){}
  try{ const s = await fdb.get(fdb.ref(db, 'presence/' + uid)); pr = s.exists() ? s.val() : {}; }catch(e){}
  const me = Auth.getState();
  const online = pr.online === true && (Date.now() - (pr.lastSeen||0)) < 180000;
  const isAdm = (H && H.admins && H.admins[uid]) || p.isAdmin === true;
  const isOp = H && H.ops && H.ops[uid] === true;
  let isFriend = false;
  try{ const s = await fdb.get(fdb.ref(db, 'friends/' + me.uid + '/' + uid)); isFriend = s.exists() && s.val() !== false; }catch(e){}
  const nick = p.nick || p.name || p.displayName || pr.name || 'Oyuncu';
  const self = uid === me.uid;
  ov.querySelector('.pcp-card').innerHTML = `
    <div class="pcp-top">
      <div class="pcp-ava">${avatarOf(p, uid)}${online ? '<span class="pcp-dot"></span>' : ''}</div>
      <div class="pcp-id">
        <div class="pcp-name ${isAdm ? glowClass() : ''}" style="${isAdm?'color:#FFD740':''}">${esc(nick)}
          ${isAdm?'<span class="chat-admin-badge">👑 ADMİN</span>':''}${isOp?'<span class="chat-op-badge">🔧 OP</span>':''}${p.isVice?'<span class="chat-op-badge" style="color:#FFD740;border-color:rgba(255,215,64,.3);background:rgba(255,215,64,.1)">⭐ VICE</span>':''}
        </div>
        <div class="pcp-sub">${online ? '<b style="color:#69F0AE">● Çevrimiçi</b>' : (pr.lastSeen ? tAgo(pr.lastSeen) + ' önce görüldü' : 'Çevrimdışı')}</div>
      </div>
    </div>
    <div class="pcp-stats">
      <div class="pcp-stat"><b>⭐ ${esc(p.level || 1)}</b><span>SEVİYE</span></div>
      <div class="pcp-stat"><b>🥜 ${Number(p.kaju||0).toLocaleString('tr-TR')}</b><span>KAJU</span></div>
      <div class="pcp-stat"><b>✨ ${(()=>{ const xObj=p.xp; const raw = (xObj && typeof xObj==='object') ? (xObj.totalXP??xObj.xp??0) : (p.totalXP??xObj??0); const v=Number(raw); return (Number.isFinite(v)?v:0).toLocaleString('tr-TR'); })()}</b><span>XP</span></div>
    </div>
    ${(()=>{
      const meAdm=(H&&H.admins&&H.admins[me.uid])||me.isAdmin===true;
      const hidden=p.friendsHidden===true;
      if(hidden&&!meAdm) return '<div class="pcp-friends-hidden">🔒 Arkadaş listesi gizli</div>';
      return '';
    })()}
    ${self ? '' : `<div class="pcp-acts">
      <button class="pcp-btn" data-pc="dm">✉️ Mesaj</button>
      <button class="pcp-btn" data-pc="fr">${isFriend ? '✕ Arkadaşlıktan Çıkar' : '👥 Arkadaş Ekle'}</button>
      <button class="pcp-btn" style="background:rgba(192,132,252,.1);border-color:rgba(192,132,252,.35);color:#c084fc" data-pc="egg">🥚 Kozmo Gönder</button>
      <button class="pcp-btn" style="background:rgba(255,152,0,.08);border-color:rgba(255,152,0,.3);color:#FFB74D" data-pc="poke">👉 Dürt</button>
      <button class="pcp-btn" style="background:rgba(255,82,82,.08);border-color:rgba(255,82,82,.3);color:#FF7043" data-pc="challenge">⚔️ Meydan Oku</button>
      ${(()=>{
        if(uid===me.uid) return '';
        const meAdmin = me.isAdmin === true;
        const meOp = (H && H.ops && H.ops[me.uid] === true);
        if(!meAdmin && !meOp) return '';
        const targetIsOp = (H && H.ops && H.ops[uid] === true);
        let html = '<div class="pcp-admin-mod">';
        if(meAdmin){
          // ── ADMİN: tüm yetkiler ──
          html += '<div class="pcp-mod-lbl">👑 Yönetici İşlemleri</div>'
            + '<div class="pcp-mod-grid">'
              + '<button class="pcp-mod-btn ban" data-mod="ban">🚫 Ban</button>'
              + '<button class="pcp-mod-btn" data-mod="unban">✅ Unban</button>'
              + '<button class="pcp-mod-btn mute" data-mod="mute">🔇 Mute</button>'
              + '<button class="pcp-mod-btn" data-mod="unmute">🔊 Unmute</button>'
              + '<button class="pcp-mod-btn kick" data-mod="kick">🦵 Kick</button>'
              + '<button class="pcp-mod-btn op" data-mod="'+(targetIsOp?'unop':'op')+'">'+(targetIsOp?'🔧 OP Al':'🔧 OP Yap')+'</button>'
            + '</div>'
            + '<div class="pcp-mod-lbl" style="margin-top:8px;color:#FF7043">🌐 IP İşlemleri</div>'
            + '<div class="pcp-mod-grid">'
              + '<button class="pcp-mod-btn" data-mod="showip">👁️ IP Gör</button>'
              + '<button class="pcp-mod-btn ban" data-mod="ipban">🌐 IP Ban</button>'
              + '<button class="pcp-mod-btn" data-mod="ipunban">✅ IP Unban</button>'
            + '</div>';
        } else if(meOp){
          // ── OPERATÖR: sınırlı yetkiler ──
          html += '<div class="pcp-mod-lbl" style="color:#CE93D8">🔧 Operatör İşlemleri</div>'
            + '<div class="pcp-mod-grid">'
              + '<button class="pcp-mod-btn kick" data-mod="kick">🦵 Kick</button>'
              + '<button class="pcp-mod-btn mute" data-mod="mute">🔇 Mute</button>'
              + '<button class="pcp-mod-btn" data-mod="unmute">🔊 Unmute</button>'
            + '</div>';
        }
        html += '</div>';
        return html;
      })()}
    </div>`}
    <button class="pcp-x">Kapat</button>`;
  ov.querySelector('.pcp-x').addEventListener('click', () => ov.remove());
  // 👉 Poke
  const pokeB = ov.querySelector('[data-pc="poke"]');
  if(pokeB) pokeB.addEventListener('click', async()=>{
    try{
      await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'👉',text:(me.displayName||'Biri')+' seni dürttü!',ts:Date.now(),fromUid:me.uid});
      // Kısa vibrasyon
      if(navigator.vibrate) navigator.vibrate([30,20,30]);
      ov.remove();
      showToast('👉 Dürtüldü!');
    }catch(e){}
  });
  // ⚔️ Meydan okuma
  const chalB = ov.querySelector('[data-pc="challenge"]');
  if(chalB) chalB.addEventListener('click', async()=>{
    // Online kontrolü — çevrimdışı oyuncuya meydan okunamaz
    if(!online){
      alert('⚠️ '+nick+' şu an çevrimdışı. Meydan okuma sadece çevrimiçi oyunculara gönderilebilir.');
      return;
    }
    if(!confirm('⚔️ '+nick+' adlı oyuncuya meydan okuyacaksın. Devam?'))return;
    try{
      await fdb.set(fdb.ref(db,'gameInvites/'+uid+'/chall_'+Date.now()),{
        fromUid:me.uid,fromName:me.displayName||'Oyuncu',fromAvatar:(me.profile&&me.profile.avatar)||'👤',
        toUid:uid,type:'challenge',game:'tetris',ts:Date.now(),status:'pending'
      });
      await fdb.push(fdb.ref(db,'userNotifs/'+uid),{icon:'⚔️',text:(me.displayName||'Biri')+' sana meydan okudu! (Tetris)',ts:Date.now(),fromUid:me.uid});
      ov.remove(); showToast('⚔️ Meydan okuma gönderildi!');
    }catch(e){alert('Gönderilemedi');}
  });
  // 👑/🔧 Moderasyon butonları (rol bazlı)
  ov.querySelectorAll('[data-mod]').forEach(btn=>btn.addEventListener('click',async()=>{
    const action=btn.dataset.mod;
    const mod=await import('./moderation.js');
    // Neden sorulacak aksiyonlar
    const needsReason=['ban','mute','kick','unban','unmute','ipban','ipunban'];
    let reason='';
    if(needsReason.includes(action)){
      reason=prompt('Neden? (boş bırakırsan "Kural İhlali")','')||'';
    }
    let ok=false, msg='';
    try{
      if(action==='ban'){ if(!confirm('🚫 '+nick+' oyundan banlansın mı?'))return; ok=await mod.globalBan(uid,nick,reason); msg='Banlandı'; }
      else if(action==='unban'){ ok=await mod.globalUnban(uid,nick,reason); msg='Ban kaldırıldı'; }
      else if(action==='mute'){ const dur=prompt('Kaç dakika? (boş = süresiz)','60'); const d=dur?parseInt(dur):null; if(!confirm('🔇 '+nick+' susturulsun mu?'))return; ok=await mod.globalMute(uid,nick,reason,d); msg='Susturuldu'; }
      else if(action==='unmute'){ ok=await mod.globalUnmute(uid,nick,reason); msg='Susturma kaldırıldı'; }
      else if(action==='kick'){
        if(!confirm('🦵 '+nick+' oyundan atılsın mı?'))return;
        const res=await mod.globalKick(uid,nick,reason);
        if(res&&res.ok){ showToast('✅ '+nick+': Oyundan atıldı'); setTimeout(()=>{try{ov.remove();}catch(e){}},800); }
        else { alert(res&&res.error?res.error:'Atılamadı'); }
        return;
      }
      else if(action==='op'){ if(!confirm('🔧 '+nick+' operatör yapılsın mı?'))return; ok=await mod.makeOperator(uid,nick); msg='Operatör yapıldı'; if(H&&H.ops)H.ops[uid]=true; }
      else if(action==='unop'){ if(!confirm('🔧 '+nick+' operatörlüğü kaldırılsın mı?'))return; ok=await mod.removeOperator(uid,nick); msg='Operatörlük kaldırıldı'; if(H&&H.ops)delete H.ops[uid]; }
      else if(action==='showip'){
        const ip=await mod.getUserIP(uid);
        alert(ip?('🌐 '+nick+' IP adresi:\n'+ip):'IP bilgisi bulunamadı (kullanıcı henüz kaydetmemiş olabilir)');
        return;
      }
      else if(action==='ipban'){
        if(!confirm('🌐 '+nick+' IP adresi yasaklansın mı? (Bu IP ile giriş engellenir)'))return;
        const res=await mod.ipBan(uid,nick,reason);
        if(res.ok){ showToast('✅ IP banlandı: '+res.ip); }
        else { alert('IP ban başarısız: '+(res.error||'bilinmeyen')); }
        return;
      }
      else if(action==='ipunban'){
        const res=await mod.ipUnban(uid,nick,reason);
        if(res.ok){ showToast('✅ IP yasağı kaldırıldı'); }
        else { alert('Başarısız: '+(res.error||'bilinmeyen')); }
        return;
      }
      if(ok){ showToast('✅ '+nick+': '+msg); btn.textContent='✓'; setTimeout(()=>{try{ov.remove();}catch(e){}},800); }
      else { alert('İşlem başarısız'); }
    }catch(e){ alert('Hata: '+(e.message||e)); }
  }));
  const eggPcB = ov.querySelector('[data-pc="egg"]');
  if(eggPcB) eggPcB.addEventListener('click', async() => {
    ov.remove();
    try{ const m = await import('./kozmos.js'); await m.sendEgg(uid, nick); }catch(e){ alert('Kozmo gönderilemedi: '+(e.message||e)); }
  });
  const dmB = ov.querySelector('[data-pc="dm"]');
  if(dmB) dmB.addEventListener('click', () => {
    ov.remove();
    applyFabSetting();
    openHubTab('ozel');
    // Hub DOM'u render olduktan sonra thread aç (yoksa elementler yok)
    setTimeout(() => { try{ dmOpenThread(uid, nick); }catch(e){ console.warn('[DM]',e); } }, 150);
  });
  const frB = ov.querySelector('[data-pc="fr"]');
  if(frB) frB.addEventListener('click', async () => {
    if(me.status !== 'google'){ alert('Arkadaşlık için Google ile giriş gerekli.'); return; }
    try{
      if(isFriend){
        await fdb.set(fdb.ref(db, 'friends/' + me.uid + '/' + uid), null);
        await fdb.set(fdb.ref(db, 'friends/' + uid + '/' + me.uid), null);
      } else {
        await fdb.set(fdb.ref(db, 'friends/' + me.uid + '/' + uid), { name: nick, ts: Date.now() });
        await fdb.set(fdb.ref(db, 'friends/' + uid + '/' + me.uid), { name: me.displayName || 'Oyuncu', ts: Date.now() });
        try{ await fdb.push(fdb.ref(db, 'userNotifs/' + uid), { icon:'👥', text: (me.displayName || 'Bir oyuncu') + ' seni arkadaş olarak ekledi!', ts: Date.now(), fromUid: me.uid }); }catch(e){}
      }
      ov.remove();
      if(H && H.open && H.tab === 'dost') renderFriends();
    }catch(e){ alert('Yapılamadı'); }
  });
}   // { open, tab, dmUnread, notifUnread, dmThread, offChat, offDM, offNotif, dmWatch:{} }

// ── Sürüklenebilir FAB (monolitten) ─────────────────────────────
function makeFabDraggable(fab, onMove){
  const st = { on:false, moved:false, sx:0, sy:0, sl:0, st:0 }, KEY = 'twFab_' + fab.id;
  const TOP_MIN = 8;
  try{
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(p && p.left != null){
      const safeTop = Math.max(TOP_MIN, Math.min(window.innerHeight - 54, p.top));
      const safeLeft = Math.max(4, Math.min(window.innerWidth - 54, p.left));
      fab.style.left = safeLeft+'px'; fab.style.top = safeTop+'px'; fab.style.right = 'auto'; fab.style.bottom = 'auto';
    }
  }catch(e){}
  fab.addEventListener('pointerdown', (e) => { st.on = true; st.moved = false; st.sx = e.clientX; st.sy = e.clientY; const r = fab.getBoundingClientRect(); st.sl = r.left; st.st = r.top; if(fab.setPointerCapture) fab.setPointerCapture(e.pointerId); e.preventDefault(); }, { passive:false });
  fab.addEventListener('pointermove', (e) => {
    if(!st.on) return;
    const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if(Math.abs(dx) > 5 || Math.abs(dy) > 5) st.moved = true;
    if(!st.moved) return;
    const l = Math.max(4, Math.min(window.innerWidth - 54, st.sl + dx));
    const t = Math.max(TOP_MIN, Math.min(window.innerHeight - 54, st.st + dy));
    fab.style.left = l+'px'; fab.style.top = t+'px'; fab.style.right = 'auto'; fab.style.bottom = 'auto';
    if(onMove) onMove(l, t);
  });
  fab.addEventListener('pointerup', () => { if(!st.on) return; st.on = false; const r = fab.getBoundingClientRect(); try{ localStorage.setItem(KEY, JSON.stringify({ left:r.left, top:r.top })); }catch(e){} });
  return () => st.moved;
}
function pressAnim(fab){ fab.classList.remove('tw-press'); void fab.offsetWidth; fab.classList.add('tw-press'); }

// ── Kurulum ─────────────────────────────────────────────────────
// Ayar: FAB'lar gizlenebilir (profil > ayarlar)
export function applyFabSetting(){
  const on = localStorage.getItem('hero_set_fabs') !== '0';
  const g = document.getElementById('gemFloatBtn');
  if(g){ g.style.visibility = ''; g.style.display = on ? 'grid' : 'none'; }
}
// Ekranlardan hub'ı belirli sekmede aç
export function openHubTab(tab){
  if(!H) return;
  if(!H.open) open();
  switchTab(tab || 'chat');
}

export function initSocial(){
  if(typeof window!=='undefined'){ if(window.__heroSocialInit) return; window.__heroSocialInit = true; }
  if(document.getElementById('gemFloatBtn')) return;
  // 💎 Gem FAB
  const gem = document.createElement('button');
  gem.id = 'gemFloatBtn'; gem.className = 'twin-fab';
  gem.innerHTML = `<span class="tw-gem">💎</span><i class="tw-spark tw-spark-cyan-1"></i><i class="tw-spark tw-spark-cyan-2"></i><i class="tw-spark tw-spark-cyan-3"></i><i class="tw-badge" id="gemFabBadge">0</i>`;
  gem.style.display = 'grid'; gem.style.visibility = '';   // her zaman görünür başla
  document.body.appendChild(gem);
  // 👑 Admin FAB (yalnız adminde görünür)
  const adm = document.createElement('button');
  adm.id = 'adminFloatBtn'; adm.className = 'twin-fab';
  adm.style.display = 'none';
  adm.innerHTML = `<span class="tw-crown">👑</span><i class="tw-spark tw-spark-gold-1"></i><i class="tw-spark tw-spark-gold-2"></i><i class="tw-spark tw-spark-gold-3"></i>`;
  document.body.appendChild(adm);
  // Hub paneli
  const panel = document.createElement('div');
  panel.id = 'gemHubPanel';
  panel.innerHTML = `
    <div class="ghp-drag" id="ghpDragHandle">
      <div class="ghp-title"><span class="ghp-title-gem">💎</span> SOSYAL HUB</div>
      <div class="ghp-acts"><button class="ghp-act" id="ghpSizeBtn" title="Boyut: mini / midi / full">⤢</button><button class="ghp-act" id="ghpCloseBtn">✕</button></div>
    </div>
    <div class="ghp-tabs">
      <button class="ghp-tab active" data-ghptab="chat">💬 CHAT</button>
      <button class="ghp-tab" data-ghptab="ozel">✉️<span class="ghp-tab-badge" id="ghpDMBadge" style="display:none">0</span></button>
      <button class="ghp-tab" data-ghptab="dost">👥</button>
      <button class="ghp-tab" data-ghptab="notif">🔔<span class="ghp-tab-badge" id="ghpNotifBadge" style="display:none">0</span></button>
    </div>
    <div class="ghp-body">
      <div class="ghp-pane active" id="ghpPane-chat">
        <div class="ghp-list" id="ghpChatList"><div class="ghp-empty"><div class="ghp-empty-icon">💬</div><div class="ghp-empty-text">SOHBET YÜKLENİYOR…</div></div></div>
        <div class="ghp-input-row"><input class="ghp-input" id="ghpChatInput" maxlength="200" placeholder="Mesaj yaz…" autocomplete="off"><button class="ghp-send" id="ghpChatSend">➤</button></div>
      </div>
      <div class="ghp-pane" id="ghpPane-ozel">
        <div class="ghp-input-row" style="border-top:none;border-bottom:1px solid rgba(66,165,245,.12)">
          <input class="ghp-input" id="ghpDMNick" maxlength="16" placeholder="Nick ile yeni sohbet…" autocomplete="off"><button class="ghp-send" id="ghpDMOpen" style="color:#42A5F5;border-color:rgba(66,165,245,.4);background:linear-gradient(135deg,rgba(66,165,245,.22),rgba(66,165,245,.08))">＋</button>
        </div>
        <div class="ghp-list" id="ghpDMList"></div>
        <div id="ghpDMThread" style="display:none;flex-direction:column;flex:1;overflow:hidden">
          <div class="ghp-input-row" style="border-top:none;border-bottom:1px solid rgba(66,165,245,.12)">
            <button class="ghp-act" id="ghpDMBack">←</button><div class="ghp-dm-name" id="ghpDMTitle" style="font-size:12px;flex:1"></div>
          </div>
          <div class="ghp-list" id="ghpDMMsgs"></div>
          <div class="ghp-input-row"><input class="ghp-input" id="ghpDMInput" maxlength="300" placeholder="Mesaj…" autocomplete="off"><button class="ghp-send" id="ghpDMSend" style="color:#42A5F5;border-color:rgba(66,165,245,.4)">➤</button></div>
        </div>
      </div>
      <div class="ghp-pane" id="ghpPane-dost">
        <div class="ghp-input-row" style="border-top:none;border-bottom:1px solid rgba(105,240,174,.12)">
          <input class="ghp-input" id="ghpFrNick" maxlength="16" placeholder="Nick ile arkadaş ekle…" autocomplete="off"><button class="ghp-send" id="ghpFrAdd" style="color:#69F0AE;border-color:rgba(105,240,174,.4);background:linear-gradient(135deg,rgba(105,240,174,.2),rgba(105,240,174,.07))">＋</button>
        </div>
        <div class="ghp-list" id="ghpFrList"></div>
      </div>
      <div class="ghp-pane" id="ghpPane-notif">
        <div class="ghp-list" id="ghpNotifList"></div>
        <div class="ghp-input-row"><button class="ghp-act" id="ghpNotifClear" style="flex:1;padding:8px">🧹 Tümünü temizle</button></div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  H = { open:false, tab:'chat', dmUnread:0, notifUnread:0, dmThread:null, offChat:null, offDM:null, offNotif:null, dmWatch:{}, seen: loadSeen() };

  // FAB davranışları
  const gemMoved = makeFabDraggable(gem, () => { if(H.open) position(); });
  gem.addEventListener('click', () => { if(gemMoved()) return; pressAnim(gem); toggle(); });
  const admMoved = makeFabDraggable(adm);
  adm.addEventListener('click', () => { if(admMoved()) return; pressAnim(adm); import('./admin.js').then(m => m.openAdminPanel()).catch(() => alert('Panel yüklenemedi')); });
  // Panel sürükleme + kapatma
  makePanelDrag(panel, panel.querySelector('#ghpDragHandle'));
  panel.querySelector('#ghpCloseBtn').addEventListener('click', close);
  panel.querySelector('#ghpSizeBtn').addEventListener('click', cycleSize);
  applySize();
  document.addEventListener('pointerdown', (e) => { if(!H.open) return; if(panel.contains(e.target) || gem.contains(e.target)) return; close(); }, { passive:true });
  // Sekmeler
  panel.querySelectorAll('.ghp-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.ghptab)));
  // Chat gönder
  panel.querySelector('#ghpChatSend').addEventListener('click', sendChat);
  panel.querySelector('#ghpChatList').addEventListener('click', (e) => {
    const n = e.target.closest('[data-pcuid]');
    if(n) openPlayerCard(n.dataset.pcuid);
  });
  panel.querySelector('#ghpChatInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChat(); });
  // DM
  panel.querySelector('#ghpDMOpen').addEventListener('click', dmOpenByNick);
  panel.querySelector('#ghpDMNick').addEventListener('keydown', (e) => { if(e.key === 'Enter') dmOpenByNick(); });
  panel.querySelector('#ghpDMBack').addEventListener('click', dmBack);
  panel.querySelector('#ghpDMSend').addEventListener('click', dmSend);
  panel.querySelector('#ghpDMInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') dmSend(); });
  // Bildirim temizle
  panel.querySelector('#ghpNotifClear').addEventListener('click', clearNotifs);
  // Arkadaş ekle
  panel.querySelector('#ghpFrAdd').addEventListener('click', addFriendByNick);
  panel.querySelector('#ghpFrNick').addEventListener('keydown', (e) => { if(e.key === 'Enter') addFriendByNick(); });

  // Auth durumuna göre: admin FAB + dinleyiciler
  applyFabSetting();
  Auth.subscribe((st) => {
    adm.style.display = (st.isAdmin === true) ? 'grid' : 'none';
    teardownListeners();
    if(st.uid){
      loadAdminsSet(); listenChatLock();
      listenChat(); listenNotifs(st.uid); listenBroadcasts(); watchDMThreads();
    }
  });
}

// ── Panel aç/kapa/konum ─────────────────────────────────────────
function byId(id){ return document.getElementById(id); }
const SIZES = ['midi','mini','full'];
function curSize(){ const v = localStorage.getItem('hero_hub_size'); return SIZES.includes(v) ? v : 'midi'; }
function applySize(){
  const p = byId('gemHubPanel'); if(!p) return;
  const sz = curSize();
  p.classList.toggle('ghp-mini', sz === 'mini');
  p.classList.toggle('ghp-full', sz === 'full');
  const btn = byId('ghpSizeBtn'); if(btn) btn.textContent = sz === 'full' ? '⤡' : (sz === 'mini' ? '▣' : '⤢');
  if(H && H.open) position();
}
function cycleSize(){
  const next = SIZES[(SIZES.indexOf(curSize()) + 1) % SIZES.length];
  try{ localStorage.setItem('hero_hub_size', next); }catch(e){}
  applySize();
}
function position(){
  if(curSize() === 'full'){ const p = byId('gemHubPanel'); p.style.left = p.style.top = p.style.right = p.style.bottom = ''; return; }
  const panel = byId('gemHubPanel'), fab = byId('gemFloatBtn');
  const fr = fab.getBoundingClientRect(), pw = panel.offsetWidth || 316, vw = window.innerWidth, vh = window.innerHeight;
  const l = Math.max(8, Math.min(vw - pw - 8, fr.left + fr.width/2 - pw/2));
  panel.style.left = l + 'px'; panel.style.right = 'auto';
  if(fr.top > 260){ panel.style.bottom = (vh - fr.top + 8) + 'px'; panel.style.top = 'auto'; }
  else { panel.style.top = (fr.bottom + 8) + 'px'; panel.style.bottom = 'auto'; }
}
function open(){ H.open = true; const p = byId('gemHubPanel'); p.classList.remove('ghp-closing'); position(); p.classList.add('ghp-open'); markTabSeen(H.tab); }
function close(){ H.open = false; const p = byId('gemHubPanel'); p.classList.add('ghp-closing'); setTimeout(() => p.classList.remove('ghp-open','ghp-closing'), 260); }
function toggle(){ H.open ? close() : open(); }
function switchTab(tab){
  H.tab = tab;
  document.querySelectorAll('.ghp-tab').forEach(b => b.classList.toggle('active', b.dataset.ghptab === tab));
  document.querySelectorAll('.ghp-pane').forEach(p => p.classList.toggle('active', p.id === 'ghpPane-' + tab));
  markTabSeen(tab);
}
function markTabSeen(tab){
  if(tab === 'ozel'){ H.dmUnread = 0; }
  if(tab === 'dost'){ renderFriends(); }
  if(tab === 'notif'){ H.notifUnread = 0; H.seen.notif = Date.now(); saveSeen(); }
  updateBadges();
}
function updateBadges(){
  const set = (id, n) => { const el = byId(id); if(!el) return; el.textContent = n > 9 ? '9+' : n; el.style.display = n > 0 ? '' : 'none'; };
  set('ghpDMBadge', H.dmUnread); set('ghpNotifBadge', H.notifUnread);
  const total = H.dmUnread + H.notifUnread, gb = byId('gemFabBadge');
  if(gb){ gb.textContent = total > 9 ? '9+' : total; gb.style.display = total > 0 ? 'grid' : 'none'; }
}
function loadSeen(){ try{ return JSON.parse(localStorage.getItem('hero_hub_seen') || '{}'); }catch(e){ return {}; } }
function saveSeen(){ try{ localStorage.setItem('hero_hub_seen', JSON.stringify(H.seen)); }catch(e){} }

// Admin uid seti (/admins okunur — herkese açık okuma) → şaşalı nick
async function loadAdminsSet(){
  try{ const s = await fdb.get(fdb.ref(db, 'admins')); H.admins = s.exists() ? s.val() : {}; }catch(e){ H.admins = {}; }
  try{ const s = await fdb.get(fdb.ref(db, 'gcOperators')); H.ops = s.exists() ? s.val() : {}; }catch(e){ H.ops = {}; }
}
// 🔒 Sohbet kilidi (chatModeration/locked) — admin panelden açılıp kapanır
function listenChatLock(){
  try{
    H.offLock = fdb.onValue(fdb.ref(db, 'chatModeration/locked'), (snap) => {
      H.chatLocked = snap.exists() && snap.val() && snap.val().locked === true;
      const inp = byId('ghpChatInput');
      if(inp) inp.placeholder = H.chatLocked ? '🔒 Sohbet yönetici tarafından kilitli' : 'Mesaj yaz…';
    });
  }catch(e){}
}

// ── 💬 GLOBAL CHAT ──────────────────────────────────────────────
function listenChat(){
  const ref = fdb.query(fdb.ref(db, 'globalChat'), fdb.limitToLast(40));
  H.offChat = fdb.onValue(ref, (snap) => {
    const list = byId('ghpChatList'); if(!list) return;
    if(!snap.exists()){ list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">💬</div><div class="ghp-empty-text">İLK MESAJI SEN YAZ</div></div>'; return; }
    const me = Auth.getState().uid;
    const rows = []; snap.forEach(ch => { const v=ch.val(); if(v) rows.push({...v, _key:ch.key}); });
    rows.sort((a,b) => (a.ts||0)-(b.ts||0));
    const gcl = glowClass();
    list.innerHTML = rows.map(m => {
      // Sistem mesajı — renkli pill (kick/ban/duyuru)
      const isSys = m.uid === 'system' || m.isSystem === true;
      if(isSys){
        const t=esc(m.text||''), tx=m.text||'';
        const isKick=tx.includes('atıldı')||tx.includes('kick')||tx.includes('🦵');
        const isBan =tx.includes('banlı')||tx.includes('banlandı')||tx.includes('🚫');
        const isUnban=tx.includes('ban kaldır')||tx.includes('serbest')||tx.includes('✅');
        const isWarn=tx.includes('uyar')||tx.includes('⚠');
        const isAnn =tx.includes('📣')||tx.includes('DUYURU');
        const bg=isKick?'rgba(255,82,82,.1)':isBan?'rgba(255,50,50,.12)':isUnban?'rgba(105,240,174,.08)':isWarn?'rgba(255,152,0,.09)':isAnn?'rgba(255,215,64,.09)':'rgba(206,147,216,.06)';
        const br=isKick?'rgba(255,82,82,.4)':isBan?'rgba(255,50,50,.45)':isUnban?'rgba(105,240,174,.35)':isWarn?'rgba(255,152,0,.4)':isAnn?'rgba(255,215,64,.4)':'rgba(206,147,216,.2)';
        const cl=isKick?'#FF9090':isBan?'#FF5252':isUnban?'#69F0AE':isWarn?'#FFB74D':isAnn?'#FFD740':'#CE93D8';
        const ic=isKick?'🦵':isBan?'🚫':isUnban?'✅':isWarn?'⚠️':isAnn?'📣':'🔔';
        return `<div class="ghp-sys-msg" style="background:${bg};border:1px solid ${br};color:${cl}">${ic} ${t} <span class="ghp-chat-ts" style="color:${cl}66;margin-left:4px">${tAgo(m.ts||0)}</span></div>`;
      }
      const adm = m.isAdmin === true; // mesaj gönderilirken kaydedilen flag (userMode'da false)
      const op = !adm && H.ops && H.ops[m.uid] === true;
      const isMe = m.uid === me;
      const me_isAdmin = (H && H.admins && H.admins[me]) || Auth.getState().isAdmin === true;
      const nameHtml = adm
        ? `<span class="chat-admin-badge">👑</span><span class="ghp-chat-name ${gcl}" style="color:#FFD740">${esc(m.name || 'Admin')}</span>`
        : (op
          ? `<span class="chat-op-badge">🔧 OP</span><span class="ghp-chat-name" style="color:#CE93D8">${esc(m.name || 'Oyuncu')}</span>`
          : `<span class="ghp-chat-name" style="color:${isMe ? '#00E5FF' : '#A78BFA'}">${esc(m.name || 'Oyuncu')}</span>`);
      return `
      <div class="ghp-chat-row${isMe?' mine':''}${adm?' ghp-adm':''}" data-mkey="${esc(m._key||'')}">
        <div class="ghp-chat-avatar" data-pcuid="${esc(m.uid||'')}" style="cursor:pointer">${esc(m.avatar||(adm?'👑':defaultAvatar(m.uid)))}</div>
        <div class="ghp-chat-body">
          <div style="display:flex;align-items:center;gap:3px;cursor:pointer" data-pcuid="${esc(m.uid||'')}">${nameHtml}</div>
          <div class="ghp-chat-text">${esc(m.text)}${m.edited?'<span style="font-size:8px;opacity:.5;margin-left:4px">(düzenlendi)</span>':''}</div>
          <div class="ghp-chat-ts">${tAgo(m.ts||0)}${(()=>{
            if(!m._key) return '';
            const within5min = (Date.now()-(m.ts||0)) < 300000;
            const canEdit = (isMe && within5min) || me_isAdmin;
            const canDel = isMe || me_isAdmin;
            let acts='';
            if(canDel) acts+=' <span class="gc-act" data-del="'+esc(m._key)+'">🗑</span>';
            if(canEdit) acts+=' <span class="gc-act" data-edit="'+esc(m._key)+'" data-txt="'+esc(m.text||'')+'">✏️</span>';
            return acts;
          })()}</div>
        </div>
      </div>`;
    }).join('');
    // düzenle/sil
    list.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const k=b.dataset.del;if(k&&confirm('Mesaj silinsin mi?'))fdb.set(fdb.ref(db,'globalChat/'+k),null).catch(()=>{});}));
    list.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const cur=b.dataset.txt;const txt=prompt('Mesajı düzenle:',cur);if(txt&&txt.trim()&&txt.trim()!==cur)fdb.update(fdb.ref(db,'globalChat/'+b.dataset.edit),{text:txt.trim(),edited:true}).catch(()=>{});}));
    list.scrollTop = list.scrollHeight;
  });
}
async function sendChat(){
  const st = Auth.getState();
  const inp = byId('ghpChatInput'); const text = inp.value.trim();
  if(!text) return;
  if(!st.uid){ alert('Sohbet için giriş yapmalısın.'); return; }
  const p = st.profile || {};
  if(p.muted === true){
    if(p.muteUntil && p.muteUntil <= Date.now()){
      // Süre dolmuş — otomatik kaldır
      try{ await fdb.update(fdb.ref(db,'users/'+st.uid),{muted:false,muteReason:null,muteUntil:null}); }catch(e){}
    } else {
      alert('🔇 Susturulmuşsun' + (p.muteReason ? ': ' + p.muteReason : '') + (p.muteUntil ? ' (' + Math.ceil((p.muteUntil-Date.now())/60000) + ' dk kaldı)' : '')); return;
    }
  }
  if(H.chatLocked && st.isAdmin !== true){ alert('🔒 Sohbet şu an yönetici tarafından kilitli'); return; }
  inp.value = '';
  try{
    const m = { uid: st.uid, name: st.displayName || 'Oyuncu', text: text.slice(0, 200), ts: Date.now() };
    const av = st.profile && st.profile.avatar; if(av) m.avatar = av;
    // Admin badge: SADECE görünür admin modunda (userMode'da gizle)
    if(st.isVisibleAdmin === true) m.isAdmin = true;
    await fdb.push(fdb.ref(db, 'globalChat'), m);
  }catch(e){ alert('Gönderilemedi' + (p.banned ? ' (banlısın)' : '')); }
}

// ── ✉️ ÖZEL MESAJLAR ────────────────────────────────────────────
function pairKey(a, b){ return [a, b].sort().join('_'); }
function loadThreads(){ try{ return JSON.parse(localStorage.getItem('hero_dm_threads') || '[]'); }catch(e){ return []; } }
function saveThreads(t){ try{ localStorage.setItem('hero_dm_threads', JSON.stringify(t.slice(0, 8))); }catch(e){} }
function renderThreads(){
  const list = byId('ghpDMList'); if(!list) return;
  const t = loadThreads();
  if(!t.length){ list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">✉️</div><div class="ghp-empty-text">NICK YAZIP YENİ SOHBET AÇ</div></div>'; return; }
  list.innerHTML = t.map(x => `
    <div class="ghp-dm-row" data-uid="${esc(x.uid)}" data-nick="${esc(x.nick)}">
      <div class="ghp-dm-avatar" data-dmpc="${esc(x.uid)}" style="cursor:pointer">👤</div>
      <div class="ghp-dm-info"><div class="ghp-dm-name">${esc(x.nick)}</div><div class="ghp-dm-text">${esc(x.last || '')}</div></div>
      <div class="ghp-dm-ts">${x.ts ? tAgo(x.ts) : ''}</div>
      ${x.unread ? '<div class="ghp-dm-dot"></div>' : ''}
    </div>`).join('');
  list.querySelectorAll('.ghp-dm-row').forEach(r => r.addEventListener('click', (e) => {
    const pc = e.target.closest('[data-dmpc]');
    if(pc){ openPlayerCard(pc.dataset.dmpc); return; }
    dmOpenThread(r.dataset.uid, r.dataset.nick);
  }));
}
async function dmOpenByNick(){
  const inp = byId('ghpDMNick'); const nick = inp.value.trim();
  if(!nick) return;
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google'){ alert('Özel mesaj için Google ile giriş gerekli.'); return; }
  const t = await Auth.resolveNick(nick);
  if(!t){ alert('Nick bulunamadı: ' + nick); return; }
  if(t.uid === me.uid){ alert('Kendine mesaj atamazsın 🙂'); return; }
  inp.value = '';
  dmOpenThread(t.uid, t.nick || nick);
}
function dmOpenThread(uid, nick){
  H.dmThread = { uid, nick };
  byId('ghpDMList').style.display = 'none';
  byId('ghpDMList').previousElementSibling.style.display = 'none';   // nick arama satırı
  const th = byId('ghpDMThread'); th.style.display = 'flex';
  const tEl = byId('ghpDMTitle');
  tEl.textContent = '✉️ ' + nick;
  tEl.style.cursor = 'pointer';
  tEl.onclick = () => openPlayerCard(uid);
  // okundu işaretle
  const ts = loadThreads(); const i = ts.findIndex(x => x.uid === uid);
  if(i >= 0){ ts[i].unread = false; saveThreads(ts); }
  H.seen['dm_' + uid] = Date.now(); saveSeen();
  const me = Auth.getState().uid;
  const pk = pairKey(me, uid);
  if(H.offDM){ try{ H.offDM(); }catch(e){} }
  H.dmOppSeen = 0;
  H.offDM = fdb.onValue(fdb.query(fdb.ref(db, 'messages/' + pk), fdb.orderByChild('ts'), fdb.limitToLast(30)), (snap) => {
    const box = byId('ghpDMMsgs'); if(!box) return;
    const rows = []; if(snap.exists()) snap.forEach(ch => { const v = ch.val(); if(v && v.text && ch.key !== '_seen' && ch.key !== '_typing') rows.push({...v, _key:ch.key}); });
    if(!rows.length){ box.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">✉️</div><div class="ghp-empty-text">İLK MESAJI YAZ</div></div>'; return; }
    rows.sort((a,b) => (a.ts||0)-(b.ts||0));
    renderDMRows(rows);
    H.dmRows = rows;
    H.seen['dm_' + uid] = Date.now(); saveSeen();
    // 👁 okundu: en son mesajın ts'ini _seen'e yaz (rakip ✓✓ görsün)
    try{ fdb.set(fdb.ref(db, 'messages/' + pk + '/_seen/' + me), Date.now()); }catch(e){}
  });
  // rakibin okundu zamanı → ✓✓
  H.offSeen = fdb.onValue(fdb.ref(db, 'messages/' + pk + '/_seen/' + uid), (snap) => {
    H.dmOppSeen = snap.exists() ? (snap.val() || 0) : 0;
    if(H.dmRows) renderDMRows(H.dmRows);
  });
  // ✍️ rakip yazıyor mu
  H.offTyping = fdb.onValue(fdb.ref(db, 'messages/' + pk + '/_typing/' + uid), (snap) => {
    const t = snap.exists() ? (snap.val() || 0) : 0;
    const el = byId('ghpDMTitle');
    if(!el) return;
    const fresh = Date.now() - t < 4500;
    el.textContent = '✉️ ' + nick + (fresh ? ' · yazıyor…' : '');
    if(fresh){ clearTimeout(H._typT); H._typT = setTimeout(() => { if(byId('ghpDMTitle')) byId('ghpDMTitle').textContent = '✉️ ' + nick; }, 4600); }
  });
  // kendi yazışını bildir (1.2 sn'de bir)
  const dmInp = byId('ghpDMInput');
  if(dmInp){
    dmInp.oninput = () => {
      const now = Date.now();
      if(now - (H._typeSent || 0) < 1200) return;
      H._typeSent = now;
      try{ fdb.set(fdb.ref(db, 'messages/' + pk + '/_typing/' + me), now); }catch(e){}
    };
  }
  function renderDMRows(rows){
    const box = byId('ghpDMMsgs'); if(!box) return;
    const meAdmin = Auth.getState().isAdmin === true;
    const pk = H.dmThread ? pairKey(me, H.dmThread.uid) : null;
    box.innerHTML = rows.map(m => {
      const isMine = m.from === me;
      const within5 = (Date.now() - (m.ts||0)) < 300000;
      const canEdit = (isMine && within5) || meAdmin;
      const canDel = isMine || meAdmin;
      let acts = '';
      if(m._key){
        if(canDel) acts += ' <span class="gc-act" data-dmdel="'+esc(m._key)+'">🗑</span>';
        if(canEdit) acts += ' <span class="gc-act" data-dmedit="'+esc(m._key)+'" data-dmtxt="'+esc(m.text||'')+'">✏️</span>';
      }
      const tick = isMine ? (H.dmOppSeen >= (m.ts||0) ? ' <span class="dm-tick seen">✓✓</span>' : ' <span class="dm-tick">✓</span>') : '';
      const editedTag = m.edited ? '<span style="font-size:8px;opacity:.5;margin-left:4px">(düzenlendi)</span>' : '';
      return '<div class="ghp-chat-row'+(isMine ? ' mine' : '')+'">'
        + '<div class="ghp-chat-body">'
          + '<div class="ghp-chat-text">'+esc(m.text)+editedTag+'</div>'
          + '<div class="ghp-chat-ts">'+tAgo(m.ts || 0)+tick+acts+'</div>'
        + '</div></div>';
    }).join('');
    // Düzenle/sil listener
    box.querySelectorAll('[data-dmdel]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation(); const k = b.dataset.dmdel; if(!k || !pk) return;
      if(!confirm('Mesaj silinsin mi?')) return;
      try{ await fdb.set(fdb.ref(db, 'messages/' + pk + '/' + k), null); }catch(err){}
    }));
    box.querySelectorAll('[data-dmedit]').forEach(b => b.addEventListener('click', async (e) => {
      e.stopPropagation(); const k = b.dataset.dmedit; if(!k || !pk) return;
      const cur = b.dataset.dmtxt; const nt = prompt('Mesajı düzenle:', cur);
      if(nt && nt.trim() && nt.trim() !== cur){
        try{ await fdb.update(fdb.ref(db, 'messages/' + pk + '/' + k), { text: nt.trim().slice(0,300), edited: true }); }catch(err){}
      }
    }));
    box.scrollTop = box.scrollHeight;
  }
}
function dmBack(){
  if(H.offDM){ try{ H.offDM(); }catch(e){} H.offDM = null; }
  if(H.offSeen){ try{ H.offSeen(); }catch(e){} H.offSeen = null; }
  if(H.offTyping){ try{ H.offTyping(); }catch(e){} H.offTyping = null; }
  H.dmThread = null;
  byId('ghpDMThread').style.display = 'none';
  byId('ghpDMList').style.display = '';
  byId('ghpDMList').previousElementSibling.style.display = '';
  renderThreads();
}
async function dmSend(){
  if(!H.dmThread) return;
  const inp = byId('ghpDMInput'); const text = inp.value.trim();
  if(!text) return;
  const me = Auth.getState();
  const pk = pairKey(me.uid, H.dmThread.uid);
  inp.value = '';
  try{
    await fdb.push(fdb.ref(db, 'messages/' + pk), { from: me.uid, fromName: me.displayName || 'Oyuncu', text: text.slice(0, 300), ts: Date.now() });
    // konu listesini güncelle
    const ts = loadThreads(); const i = ts.findIndex(x => x.uid === H.dmThread.uid);
    const item = { uid: H.dmThread.uid, nick: H.dmThread.nick, last: text.slice(0, 40), ts: Date.now(), unread: false };
    if(i >= 0) ts.splice(i, 1);
    ts.unshift(item); saveThreads(ts);
    watchDMThreads();
  }catch(e){ alert('Gönderilemedi'); }
}
// Son konuşmaların yeni mesajlarını izle → rozet
function watchDMThreads(){
  Object.values(H.dmWatch).forEach(off => { try{ off(); }catch(e){} });
  H.dmWatch = {};
  const me = Auth.getState().uid; if(!me) return;
  loadThreads().slice(0, 6).forEach(t => {
    const pk = pairKey(me, t.uid);
    H.dmWatch[t.uid] = fdb.onValue(fdb.query(fdb.ref(db, 'messages/' + pk), fdb.orderByChild('ts'), fdb.limitToLast(1)), (snap) => {
      if(!snap.exists()) return;
      let last = null; snap.forEach(ch => { last = ch.val(); });
      if(!last || !last.text || last.from === me) return;
      const seen = H.seen['dm_' + t.uid] || 0;
      if((last.ts || 0) > seen){
        const ts = loadThreads(); const i = ts.findIndex(x => x.uid === t.uid);
        if(i >= 0){ ts[i].last = (last.text || '').slice(0, 40); ts[i].ts = last.ts; ts[i].unread = true; saveThreads(ts); }
        if(!(H.open && H.tab === 'ozel' && H.dmThread && H.dmThread.uid === t.uid)){
          H.dmUnread = loadThreads().filter(x => x.unread).length; updateBadges();
        }
        if(H.open && H.tab === 'ozel' && !H.dmThread) renderThreads();
      }
    });
  });
  renderThreads();
}

// ── 🔔 BİLDİRİMLER (kişisel + 📣 duyurular birleşik) ───────────
function renderNotifPane(){
  const list = byId('ghpNotifList'); if(!list) return;
  const all = [
    ...(H.bcastRows || []).map(n => ({ ...n, _bc: true })),
    ...(H.notifRows || [])
  ].sort((a,b) => (b.ts||0)-(a.ts||0));
  const seen = H.seen.notif || 0;
  H.notifUnread = (H.open && H.tab === 'notif') ? 0 : all.filter(r => (r.ts||0) > seen).length;
  updateBadges();
  if(!all.length){ list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">🔔</div><div class="ghp-empty-text">BİLDİRİM YOK</div></div>'; return; }
  list.innerHTML = all.map(n => {
    const ico  = n.icon||'🔔'; const txt = n.text||n.msg||'';
    if(n._bc){
      return '<div class="ghp-notif-row ghp-notif-announce">'
        +'<div class="ghp-notif-icon" style="background:rgba(224,64,251,.12);border:1px solid rgba(224,64,251,.35);color:#E040FB">📣</div>'
        +'<div class="ghp-notif-body">'
          +'<div class="ghp-notif-text"><b style="color:#E040FB">DUYURU</b> · '+esc(txt)+'</div>'
          +'<div class="ghp-chat-ts">'+esc(n.by||'Admin')+' · '+tAgo(n.ts||0)+'</div>'
        +'</div></div>';
    }
    const isKick  = ico==='🦵'||ico==='🔨'||txt.includes('atıldın')||txt.includes('atıldı');
    const isBan   = ico==='🚫'||txt.includes('banlandın')||txt.includes('banlandı');
    const isUnban = ico==='✅'&&(txt.includes('ban')||txt.includes('serbest'));
    const isWarn  = ico==='⚠️'||txt.includes('uyarıldın');
    const isAnn   = ico==='📣'||txt.includes('DUYURU');
    const isClan  = ico==='🏰'||txt.includes('klana')||txt.includes('kland');
    const isKozmo = ico==='🥚'||ico==='🎁';
    const isFr    = ico==='👥'||ico==='🤝'||ico==='👋';
    const bg    = isKick?'rgba(255,82,82,.09)'  :isBan?'rgba(220,30,30,.11)'  :isUnban?'rgba(105,240,174,.07)':isWarn?'rgba(255,152,0,.08)':isAnn?'rgba(255,215,64,.07)':isClan?'rgba(255,215,64,.05)':isKozmo?'rgba(192,132,252,.07)':isFr?'rgba(0,229,255,.05)':'rgba(255,255,255,.03)';
    const bc    = isKick?'rgba(255,82,82,.4)'   :isBan?'rgba(220,30,30,.45)'  :isUnban?'rgba(105,240,174,.3)' :isWarn?'rgba(255,152,0,.38)':isAnn?'rgba(255,215,64,.4)' :isClan?'rgba(255,215,64,.28)':isKozmo?'rgba(192,132,252,.32)':isFr?'rgba(0,229,255,.28)':'rgba(255,255,255,.07)';
    const ic    = isKick?'#FF5252'              :isBan?'#FF1744'              :isUnban?'#69F0AE'             :isWarn?'#FFB74D'            :isAnn?'#FFD740'            :isClan?'#ffd86b'           :isKozmo?'#c084fc'          :isFr?'#00E5FF'          :'#9fb0d8';
    const prefix= isKick?'<b style="color:'+ic+'">🦵 SOHBET KICK</b> · ':isBan?'<b style="color:'+ic+'">🚫 BANLANDIN</b> · ':isUnban?'<b style="color:'+ic+'">✅ UNBAN</b> · ':isWarn?'<b style="color:'+ic+'">⚠️ UYARI</b> · ':'';
    const pFrom = n.fromUid ? ' data-nfrom="'+esc(n.fromUid)+'" style="cursor:pointer;' : ' style="';
    return '<div class="ghp-notif-row" '+pFrom+'background:'+bg+';border-color:'+bc+'">'
      +'<div class="ghp-notif-icon" style="background:'+ic+'22;border:1px solid '+ic+'55;color:'+ic+'">'+esc(ico)+'</div>'
      +'<div class="ghp-notif-body">'
        +'<div class="ghp-notif-text" style="color:'+(isKick||isBan?ic:'#dfe7ff')+'">'+prefix+esc(txt)+'</div>'
        +'<div class="ghp-chat-ts">'+tAgo(n.ts||0)+'</div>'
      +'</div></div>';
  }).join('');
  list.querySelectorAll('[data-nfrom]').forEach(el => el.addEventListener('click', () => openPlayerCard(el.dataset.nfrom)));
}
function listenNotifs(uid){
  H.offNotif = fdb.onValue(fdb.query(fdb.ref(db, 'userNotifs/' + uid), fdb.limitToLast(20)), (snap) => {
    const rows = []; if(snap.exists()) snap.forEach(ch => { rows.push({ key: ch.key, ...ch.val() }); });
    H.notifRows = rows;
    renderNotifPane();
  });
}
function listenBroadcasts(){
  H.offBcast = fdb.onValue(fdb.query(fdb.ref(db, 'broadcasts'), fdb.limitToLast(3)), (snap) => {
    const rows = []; if(snap.exists()) snap.forEach(ch => { rows.push({ key: ch.key, ...ch.val() }); });
    H.bcastRows = rows;
    renderNotifPane();
  });
}

// ── 👥 ARKADAŞLAR ───────────────────────────────────────────────
async function renderFriends(){
  const list = byId('ghpFrList'); if(!list) return;
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google'){ list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">👥</div><div class="ghp-empty-text">ARKADAŞLAR İÇİN GİRİŞ YAP</div></div>'; return; }
  list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-text">YÜKLENİYOR…</div></div>';
  let frs = {};
  try{ const s = await fdb.get(fdb.ref(db, 'friends/' + me.uid)); frs = s.exists() ? s.val() : {}; }catch(e){}
  const uids = Object.keys(frs).filter(k => frs[k] !== false);
  if(!uids.length){ list.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">👥</div><div class="ghp-empty-text">NICK YAZIP ARKADAŞ EKLE</div></div>'; return; }
  // İsim + çevrimiçilik
  const rows = await Promise.all(uids.slice(0, 20).map(async (fu) => {
    const f = frs[fu] || {};
    let name = (f && f.name) || null, online = false, last = 0, ava = '👤', lvl = '';
    try{ const u = await fdb.get(fdb.ref(db, 'users/' + fu)); if(u.exists()){ const uv = u.val(); name = uv.nick || uv.name || name; ava = avatarOf(uv, fu); lvl = uv.level || 1; } }catch(e){}
    try{ const pr = await fdb.get(fdb.ref(db, 'presence/' + fu)); if(pr.exists()){ const v = pr.val(); last = v.lastSeen||0; online = v.online === true && (Date.now()-last) < 180000; if(!name) name = v.name; } }catch(e){}
    return { uid: fu, name: name || 'Arkadaş', online, last, ava, lvl };
  }));
  rows.sort((a,b) => (b.online - a.online) || (b.last - a.last));
  list.innerHTML = rows.map(r => `
    <div class="ghp-dm-row" style="border-left-color:${r.online ? '#69F0AE' : '#546E7A'}">
      <div class="ghp-dm-avatar" data-pcfr="${esc(r.uid)}" style="position:relative;cursor:pointer">${r.ava}${r.online ? '<span style="position:absolute;bottom:-1px;right:-1px;width:10px;height:10px;border-radius:50%;background:#69F0AE;border:2px solid #0a0e1e;box-shadow:0 0 5px #69F0AE"></span>' : ''}</div>
      <div class="ghp-dm-info" data-pcfr="${esc(r.uid)}" style="cursor:pointer"><div class="ghp-dm-name" style="color:${r.online ? '#69F0AE' : '#90A4AE'}">${esc(r.name)} <small style="opacity:.65;font-weight:700">LV ${esc(r.lvl)}</small></div><div class="ghp-dm-text">${r.online ? 'Çevrimiçi' : (r.last ? tAgo(r.last) + ' önce' : 'Çevrimdışı')}</div></div>
      <button class="ghp-act" data-fdm="${esc(r.uid)}" data-fn="${esc(r.name)}">✉️</button>
      <button class="ghp-act" data-frm="${esc(r.uid)}" style="color:#ff7a8a">✕</button>
    </div>`).join('');
  list.querySelectorAll('[data-fdm]').forEach(b => b.addEventListener('click', () => { switchTab('ozel'); dmOpenThread(b.dataset.fdm, b.dataset.fn); }));
  list.querySelectorAll('[data-pcfr]').forEach(el => el.addEventListener('click', () => openPlayerCard(el.dataset.pcfr)));
  list.querySelectorAll('[data-fegg]').forEach(b => b.addEventListener('click', async() => {
    try{ const m = await import('./kozmos.js'); await m.sendEgg(b.dataset.fegg, b.dataset.fn); }catch(e){ alert('Kozmo gönderilemedi'); }
  }));
  list.querySelectorAll('[data-frm]').forEach(b => b.addEventListener('click', async () => {
    if(!confirm('Arkadaşlıktan çıkarılsın mı?')) return;
    try{ await fdb.set(fdb.ref(db, 'friends/' + me.uid + '/' + b.dataset.frm), null); }catch(e){}
    try{ await fdb.set(fdb.ref(db, 'friends/' + b.dataset.frm + '/' + me.uid), null); }catch(e){}
    renderFriends();
  }));
}
async function addFriendByNick(){
  const inp = byId('ghpFrNick'); const nick = inp.value.trim();
  if(!nick) return;
  const me = Auth.getState();
  if(!me.uid || me.status !== 'google'){ alert('Arkadaş eklemek için Google ile giriş gerekli.'); return; }
  const t = await Auth.resolveNick(nick);
  if(!t){ alert('Nick bulunamadı: ' + nick); return; }
  if(t.uid === me.uid){ alert('Kendini ekleyemezsin 🙂'); return; }
  try{ const fs = await fdb.get(fdb.ref(db, 'friends/' + me.uid + '/' + t.uid)); if(fs.exists() && fs.val() !== false){ alert('Zaten arkadaşsınız.'); return; } }catch(e){}
  try{
    await sendFriendRequest(t.uid, t.nick);
    inp.value = '';
    alert('👋 Arkadaşlık isteği gönderildi: ' + t.nick);
    renderFriends();
  }catch(e){ alert('Gönderilemedi'); }
}
async function clearNotifs(){
  const uid = Auth.getState().uid; if(!uid) return;
  try{ await fdb.set(fdb.ref(db, 'userNotifs/' + uid), null); }catch(e){}
  H.notifUnread = 0; H.seen.notif = Date.now(); saveSeen(); updateBadges();
}

// ── Panel sürükleme ─────────────────────────────────────────────
function makePanelDrag(panel, handle){
  const st = { on:false, sx:0, sy:0, pl:0, pt:0 };
  handle.addEventListener('pointerdown', (e) => { if(e.target.closest('button')) return; if(curSize() === 'full') return; st.on = true; st.sx = e.clientX; st.sy = e.clientY; const r = panel.getBoundingClientRect(); st.pl = r.left; st.pt = r.top; if(handle.setPointerCapture) handle.setPointerCapture(e.pointerId); e.preventDefault(); }, { passive:false });
  handle.addEventListener('pointermove', (e) => { if(!st.on) return; const l = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, st.pl + e.clientX - st.sx)); const t = Math.max(8, Math.min(window.innerHeight - 120, st.pt + e.clientY - st.sy)); panel.style.left = l+'px'; panel.style.right = 'auto'; panel.style.top = t+'px'; panel.style.bottom = 'auto'; });
  handle.addEventListener('pointerup', () => { st.on = false; });
  handle.addEventListener('pointercancel', () => { st.on = false; });
}

function teardownListeners(){
  if(!H) return;
  if(H.offChat){ try{ H.offChat(); }catch(e){} H.offChat = null; }
  if(H.offDM){ try{ H.offDM(); }catch(e){} H.offDM = null; }
  if(H.offNotif){ try{ H.offNotif(); }catch(e){} H.offNotif = null; }
  if(H.offBcast){ try{ H.offBcast(); }catch(e){} H.offBcast = null; }
  if(H.offLock){ try{ H.offLock(); }catch(e){} H.offLock = null; }
  if(H.offSeen){ try{ H.offSeen(); }catch(e){} H.offSeen = null; }
  if(H.offTyping){ try{ H.offTyping(); }catch(e){} H.offTyping = null; }
  Object.values(H.dmWatch).forEach(off => { try{ off(); }catch(e){} });
  H.dmWatch = {};
}

export default initSocial;
