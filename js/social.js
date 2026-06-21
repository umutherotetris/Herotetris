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
          ${isAdm?'<span class="chat-admin-badge">👑 ADMİN 👑</span>':''}${isOp?'<span class="chat-op-badge">🔧 OP</span>':''}${p.isVice?'<span class="chat-op-badge" style="color:#FFD740;border-color:rgba(255,215,64,.3);background:rgba(255,215,64,.1)">⭐ VICE</span>':''}
        </div>
        <div class="pcp-sub">${online ? '<b style="color:#69F0AE">● Çevrimiçi</b>' : (pr.lastSeen ? tAgo(pr.lastSeen) + ' önce görüldü' : 'Çevrimdışı')}</div>
      </div>
    </div>
    <div class="pcp-stats">
      <div class="pcp-stat"><b>⭐ ${esc(p.level || 1)}</b><span>SEVİYE</span></div>
      <div class="pcp-stat"><b>💰 ${Number(p.kaju||0).toLocaleString('tr-TR')}</b><span>KAJU</span></div>
      <div class="pcp-stat"><b>✨ ${(()=>{ const xObj=p.xp; const raw = (xObj && typeof xObj==='object') ? (xObj.totalXP??xObj.xp??0) : (p.totalXP??xObj??0); const v=Number(raw); return (Number.isFinite(v)?v:0).toLocaleString('tr-TR'); })()}</b><span>XP</span></div>
    </div>
    ${self ? '' : `<div class="pcp-acts">
      <button class="pcp-btn" data-pc="dm">✉️ Mesaj</button>
      <button class="pcp-btn" data-pc="fr">${isFriend ? '✕ Arkadaşlıktan Çıkar' : '👥 Arkadaş Ekle'}</button>
    </div>`}
    <button class="pcp-x">Kapat</button>`;
  ov.querySelector('.pcp-x').addEventListener('click', () => ov.remove());
  const dmB = ov.querySelector('[data-pc="dm"]');
  if(dmB) dmB.addEventListener('click', () => { ov.remove(); applyFabSetting(); openHubTab('ozel'); dmOpenThread(uid, nick); });
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
// ── ⚙️ SOSYAL HUB AYARLAR PANELİ ──────────────────────────────
function openHubSettings(){
  if(document.getElementById('ghpSettingsModal')) return;
  const fabsOn   = localStorage.getItem('hero_set_fabs') !== '0';
  const admHidden = localStorage.getItem('hero_admfab_hidden') === '1';
  const st = Auth.getState();
  const isAdm = st.isAdmin === true;

  const m = document.createElement('div');
  m.id = 'ghpSettingsModal';
  m.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
  m.innerHTML = `
    <div style="background:linear-gradient(160deg,#1a1a2e,#16162a);border:1px solid rgba(124,77,255,.35);border-radius:18px;padding:0;max-width:380px;width:100%;max-height:85vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(124,77,255,.2);position:sticky;top:0;background:linear-gradient(160deg,#1a1a2e,#16162a);z-index:1">
        <div style="font-size:16px;font-weight:900;color:#B39DDB">⚙️ Ayarlar</div>
        <button id="ghpSetClose" style="width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#fff;font-size:16px;cursor:pointer">✕</button>
      </div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:14px">

        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div><div style="font-weight:800;font-size:13px;color:#e8eaf6">💎 FAB Butonları</div><div style="font-size:10px;color:#8a93b8">Ekrandaki gem & admin butonları</div></div>
          <button id="ghpSetFabs" class="ghp-set-toggle" style="padding:6px 14px;border-radius:20px;border:1px solid ${fabsOn?'#5fd38a':'#ff8fa0'};background:${fabsOn?'rgba(95,211,138,.15)':'rgba(255,143,160,.15)'};color:${fabsOn?'#5fd38a':'#ff8fa0'};font-weight:800;font-size:12px;cursor:pointer">${fabsOn?'AÇIK':'KAPALI'}</button>
        </div>

        ${isAdm ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div><div style="font-weight:800;font-size:13px;color:#e8eaf6">👑 Admin FAB</div><div style="font-size:10px;color:#8a93b8">Admin butonu görünürlüğü</div></div>
          <button id="ghpSetAdmFab" style="padding:6px 14px;border-radius:20px;border:1px solid ${admHidden?'#ff8fa0':'#5fd38a'};background:${admHidden?'rgba(255,143,160,.15)':'rgba(95,211,138,.15)'};color:${admHidden?'#ff8fa0':'#5fd38a'};font-weight:800;font-size:12px;cursor:pointer">${admHidden?'GİZLİ':'GÖRÜNÜR'}</button>
        </div>` : ''}

        <div style="height:1px;background:rgba(255,255,255,.08);margin:2px 0"></div>

        <div style="font-weight:800;font-size:12px;color:#8a93b8;text-transform:uppercase;letter-spacing:.5px">🧹 Bakım</div>

        <button id="ghpSetReload" style="text-align:left;padding:12px 14px;border-radius:12px;border:1px solid rgba(66,165,245,.3);background:rgba(66,165,245,.08);color:#90CAF9;font-weight:700;font-size:13px;cursor:pointer">
          🔄 Sayfayı Yenile <span style="font-size:10px;opacity:.7;display:block;font-weight:400">Önbelleği atlayarak yeniden yükle</span>
        </button>

        <button id="ghpSetClearCache" style="text-align:left;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,180,0,.3);background:rgba(255,180,0,.08);color:#FFD740;font-weight:700;font-size:13px;cursor:pointer">
          🗑 Önbellek & Bellek Temizle <span style="font-size:10px;opacity:.7;display:block;font-weight:400">localStorage + cache temizler (oturum korunur)</span>
        </button>

        <button id="ghpSetHardReset" style="text-align:left;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,82,82,.35);background:rgba(255,82,82,.08);color:#ff8fa0;font-weight:700;font-size:13px;cursor:pointer">
          ⚠️ Tam Sıfırlama <span style="font-size:10px;opacity:.7;display:block;font-weight:400">Tüm yerel veri + çıkış (yeniden giriş gerekir)</span>
        </button>

        <div style="font-size:9px;color:#50506e;text-align:center;margin-top:4px">Hero Oyun Portalı · ${st.uid ? st.uid.slice(0,8) : 'misafir'}</div>
      </div>
    </div>`;
  document.body.appendChild(m);

  const close = () => m.remove();
  byId('ghpSetClose').addEventListener('click', close);
  m.addEventListener('click', (e) => { if(e.target === m) close(); });

  // FAB toggle
  const fabBtn = byId('ghpSetFabs');
  if(fabBtn) fabBtn.addEventListener('click', () => {
    const on = localStorage.getItem('hero_set_fabs') !== '0';
    localStorage.setItem('hero_set_fabs', on ? '0' : '1');
    applyFabSetting();
    close(); openHubSettings();
  });

  // Admin FAB toggle
  const admBtn = byId('ghpSetAdmFab');
  if(admBtn) admBtn.addEventListener('click', () => {
    const hidden = localStorage.getItem('hero_admfab_hidden') === '1';
    localStorage.setItem('hero_admfab_hidden', hidden ? '0' : '1');
    applyFabSetting();
    close(); openHubSettings();
  });

  // Sayfayı yenile (cache-bust)
  byId('ghpSetReload').addEventListener('click', () => {
    const u = new URL(location.href);
    u.searchParams.set('v', Date.now());
    location.href = u.toString();
  });

  // Önbellek temizle (oturum korunur)
  byId('ghpSetClearCache').addEventListener('click', async () => {
    if(!confirm('Önbellek ve yerel ayarlar temizlenecek. Oturumun korunur. Devam?')) return;
    try{
      // Firebase auth anahtarlarını koru
      const keep = {};
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(k && (k.startsWith('firebase:') || k.includes('firebaseLocalStorage'))) keep[k] = localStorage.getItem(k);
      }
      localStorage.clear();
      Object.keys(keep).forEach(k => localStorage.setItem(k, keep[k]));
      // Cache API temizle
      if('caches' in window){ const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n))); }
      // Service worker temizle
      if('serviceWorker' in navigator){ const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
      alert('✓ Önbellek temizlendi. Sayfa yenileniyor.');
      const u = new URL(location.href); u.searchParams.set('v', Date.now()); location.href = u.toString();
    }catch(e){ alert('Hata: ' + (e.message||e)); }
  });

  // Tam sıfırlama
  byId('ghpSetHardReset').addEventListener('click', async () => {
    if(!confirm('TÜM yerel veriler silinecek ve çıkış yapılacak. Yeniden giriş gerekir. Emin misin?')) return;
    try{
      localStorage.clear();
      try{ sessionStorage.clear(); }catch(e){}
      if('caches' in window){ const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n))); }
      if('serviceWorker' in navigator){ const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
      if(window.indexedDB && indexedDB.databases){ const dbs = await indexedDB.databases(); await Promise.all(dbs.map(d => d.name && indexedDB.deleteDatabase(d.name))); }
      try{ const Auth = await import('./auth.js'); if(Auth.logout) await Auth.logout(); }catch(e){}
      alert('✓ Tam sıfırlama yapıldı. Sayfa yenileniyor.');
      location.href = location.origin + location.pathname;
    }catch(e){ alert('Hata: ' + (e.message||e)); location.reload(); }
  });
}

export function applyFabSetting(){
  const on = localStorage.getItem('hero_set_fabs') !== '0';
  const g = document.getElementById('gemFloatBtn');
  if(g){
    g.style.visibility = on ? '' : 'hidden';
    g.style.opacity = '';
    g.style.transform = '';
    g.style.display = '';
  }
  // Admin FAB — gizli modda küçük+şeffaf ama görünür
  const a = document.getElementById('adminFloatBtn');
  if(a){
    const admHid = localStorage.getItem('hero_admfab_hidden') === '1';
    a.style.opacity = admHid ? '0.18' : '';
    a.style.transform = admHid ? 'scale(0.52)' : '';
  }
}
// Ekranlardan hub'ı belirli sekmede aç
// Dışarıdan (profile.js, nav.js) DM açmak için — hub'ı gösterir + DM'e geçer
export function dmOpenThreadExternal(uid, nick){
  // Sosyal hub'ı göster (FAB'a basmadan direkt aç)
  let panel = document.getElementById('ghpPanel');
  if(!panel){
    // Hub kapalıysa gem FAB'a programatik tıkla
    const fab = document.getElementById('gemFloatBtn');
    if(fab) fab.click();
    // Kısa bekle sonra DM aç
    setTimeout(() => {
      try{ openHubTab('ozel'); dmOpenThread(uid, nick); }catch(e){}
    }, 180);
  } else {
    // Hub zaten açık
    openHubTab('ozel');
    dmOpenThread(uid, nick);
  }
}

export function openHubTab(tab){
  if(!H) return;
  switchTab(tab || 'chat');
  if(!H.open) open();
}

export function initSocial(){
  // Duyuru pulse animasyonu
  if(!document.getElementById('ghp-bc-style')){
    const st = document.createElement('style');
    st.id = 'ghp-bc-style';
    st.textContent = `
      @keyframes ghp-pulse-bc {
        0%,100% { box-shadow: 0 0 10px rgba(255,215,64,.12); }
        50%      { box-shadow: 0 0 22px rgba(255,215,64,.35), 0 0 8px rgba(224,64,251,.2); }
      }
    `;
    document.head.appendChild(st);
  }
  // FAB zaten varsa tekrar oluşturma (çift init koruması) — ama style ekleme devam etsin
  if(document.getElementById('gemFloatBtn')){
    applyFabSetting();
    return;
  }
  // 💎 Gem FAB
  const gem = document.createElement('button');
  gem.id = 'gemFloatBtn'; gem.className = 'twin-fab';
  gem.innerHTML = `<span class="tw-gem">💎</span><i class="tw-spark tw-spark-cyan-1"></i><i class="tw-spark tw-spark-cyan-2"></i><i class="tw-spark tw-spark-cyan-3"></i><i class="tw-badge" id="gemFabBadge">0</i>`;
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
      <div class="ghp-acts"><button class="ghp-act" id="ghpSettingsBtn" title="Ayarlar">⚙️</button><button class="ghp-act" id="ghpSizeBtn" title="Boyut: mini / midi / full">⤢</button><button class="ghp-act" id="ghpCloseBtn">✕</button></div>
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
        <div class="ghp-quick-bar" id="ghpChatQuick">
          <button class="ghp-qb" data-q="😂">😂</button>
          <button class="ghp-qb" data-q="❤️">❤️</button>
          <button class="ghp-qb" data-q="👍">👍</button>
          <button class="ghp-qb" data-q="🔥">🔥</button>
          <button class="ghp-qb" data-q="😮">😮</button>
          <button class="ghp-qb" data-q="😢">😢</button>
          <button class="ghp-qb" data-q="🎉">🎉</button>
          <button class="ghp-qb" data-q="💪">💪</button>
          <span class="ghp-qb-sep"></span>
          <button class="ghp-qb ghp-qb-text" data-q="GG">GG</button>
          <button class="ghp-qb ghp-qb-text" data-q="Merhaba! 👋">Merhaba</button>
          <button class="ghp-qb ghp-qb-text" data-q="Tebrikler! 🎉">Tebrik</button>
          <button class="ghp-qb ghp-qb-text" data-q="İyi oyunlar! ⚔️">İyi oyun</button>
        </div>
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
          <div class="ghp-quick-bar" id="ghpDMQuick">
            <button class="ghp-qb" data-dq="😂">😂</button>
            <button class="ghp-qb" data-dq="❤️">❤️</button>
            <button class="ghp-qb" data-dq="👍">👍</button>
            <button class="ghp-qb" data-dq="🔥">🔥</button>
            <button class="ghp-qb" data-dq="😮">😮</button>
            <button class="ghp-qb" data-dq="😢">😢</button>
            <button class="ghp-qb" data-dq="🎉">🎉</button>
            <button class="ghp-qb" data-dq="💪">💪</button>
            <span class="ghp-qb-sep"></span>
            <button class="ghp-qb ghp-qb-text" data-dq="GG">GG</button>
            <button class="ghp-qb ghp-qb-text" data-dq="Merhaba! 👋">Merhaba</button>
            <button class="ghp-qb ghp-qb-text" data-dq="Tebrikler! 🎉">Tebrik</button>
            <button class="ghp-qb ghp-qb-poke" id="ghpDMPoke" title="Dürt!">👋 Dürt</button>
          </div>
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

  // Quick bar CSS inject
  if(!document.getElementById('_ghp_qb_css')){
    const _qs = document.createElement('style'); _qs.id='_ghp_qb_css';
    _qs.textContent = `
      .ghp-quick-bar{display:flex;gap:4px;padding:5px 8px 3px;overflow-x:auto;flex-shrink:0;scrollbar-width:none;align-items:center;border-top:1px solid rgba(255,255,255,.05);}
      .ghp-quick-bar::-webkit-scrollbar{display:none;}
      .ghp-qb{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:3px 7px;font-size:15px;cursor:pointer;flex-shrink:0;transition:background .15s,transform .1s;line-height:1.3;}
      .ghp-qb:active{background:rgba(255,255,255,.18);transform:scale(1.14);}
      .ghp-qb-text{font-size:10px;font-weight:700;color:#90CAF9;padding:4px 8px;}
      .ghp-qb-poke{font-size:11px;font-weight:800;color:#FFD740;border-color:rgba(255,215,64,.35);background:rgba(255,215,64,.1);padding:4px 9px;margin-left:2px;}
      .ghp-qb-poke:active{background:rgba(255,215,64,.25);}
      .ghp-qb-sep{width:1px;height:18px;background:rgba(255,255,255,.12);flex-shrink:0;margin:0 2px;}
    `;
    document.head.appendChild(_qs);
  }

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
  const setBtn = byId('ghpSettingsBtn');
  if(setBtn) setBtn.addEventListener('click', openHubSettings);
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
  // Quick emoji / hazır mesaj — Chat
  panel.querySelectorAll('#ghpChatQuick .ghp-qb[data-q]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = byId('ghpChatInput');
      if(!inp) return;
      inp.value = (inp.value ? inp.value + ' ' : '') + btn.dataset.q;
      inp.focus();
      sendChat();
    });
  });
  // Quick emoji / hazır mesaj — DM
  panel.querySelectorAll('#ghpDMQuick .ghp-qb[data-dq]').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = byId('ghpDMInput');
      if(!inp) return;
      inp.value = (inp.value ? inp.value + ' ' : '') + btn.dataset.dq;
      inp.focus();
      dmSend();
    });
  });
  // 👋 Dürtme butonu
  const pokeBtn = byId('ghpDMPoke');
  if(pokeBtn) pokeBtn.addEventListener('click', async () => {
    if(!H.dmThread || !H.dmThread.uid) return;
    const me = Auth.getState();
    if(!me.uid) return;
    pokeBtn.disabled = true; pokeBtn.textContent = '✓ Dürtüldü!';
    try{
      await fdb.push(fdb.ref(db, 'userNotifs/' + H.dmThread.uid), {
        type: 'poke', icon: '👋',
        text: (me.displayName || me.profile?.nick || 'Biri') + ' seni dürtüyor! 👋',
        ts: Date.now(), fromUid: me.uid
      });
    } catch(e){ console.warn('poke err', e); }
    setTimeout(() => { if(pokeBtn){ pokeBtn.disabled=false; pokeBtn.textContent='👋 Dürt'; } }, 4000);
  });

  // Auth durumuna göre: admin FAB + dinleyiciler
  applyFabSetting();
  Auth.subscribe((st) => {
    const _fabHid = localStorage.getItem('hero_admfab_hidden') === '1';
    if(st.isAdmin === true){
      adm.style.display = 'grid';
      adm.style.opacity = _fabHid ? '0.18' : '';
      adm.style.transform = _fabHid ? 'scale(0.52)' : '';
      adm.title = _fabHid ? 'Admin paneli (gizli mod)' : '';
    } else {
      adm.style.display = 'none';
      adm.style.opacity = '';
      adm.style.transform = '';
    }
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
    const rows = []; snap.forEach(ch => { rows.push(ch.val()); });
    rows.sort((a,b) => (a.ts||0)-(b.ts||0));
    const gcl = glowClass();
    list.innerHTML = rows.map(m => {
      // 🎨 SİSTEM MESAJI (kick/ban/duyuru) → özel renkli kart
      const isSys = m.uid === 'system' || m.isSystem === true || m.isAnnounce === true;
      if(isSys){ return renderChatSystemMsg(m); }
      const adm = m.isAdmin === true || (H.admins && H.admins[m.uid]);
      const op = !adm && H.ops && H.ops[m.uid] === true;
      const nameHtml = adm
        ? `<span class="chat-admin-badge">👑</span><span class="ghp-chat-name ${gcl}" style="color:#FFD740">${esc(m.name || 'Admin')}</span><span class="chat-admin-badge" style="margin-left:2px">👑</span>`
        : (op
          ? `<span class="chat-op-badge">🔧 OP</span><span class="ghp-chat-name" style="color:#CE93D8">${esc(m.name || 'Oyuncu')}</span>`
          : `<span class="ghp-chat-name" style="color:${m.uid === me ? '#00E5FF' : '#A78BFA'}">${esc(m.name || 'Oyuncu')}</span>`);
      return `
      <div class="ghp-chat-row${m.uid === me ? ' mine' : ''}${adm ? ' ghp-adm' : ''}">
        <div class="ghp-chat-avatar">${esc(m.avatar || (adm ? '👑' : defaultAvatar(m.uid)))}</div>
        <div class="ghp-chat-body">
          <div style="display:flex;align-items:center;gap:3px;cursor:pointer" data-pcuid="${esc(m.uid||'')}">${nameHtml}</div>
          <div class="ghp-chat-text">${esc(m.text)}</div>
          <div class="ghp-chat-ts">${tAgo(m.ts || 0)}</div>
        </div>
      </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  });
}
async function sendChat(){
  const st = Auth.getState();
  const inp = byId('ghpChatInput'); const text = inp.value.trim();
  if(!text) return;
  if(!st.uid){ alert('Sohbet için giriş yapmalısın.'); return; }
  const p = st.profile || {};
  if(p.muted === true && (!p.muteUntil || p.muteUntil > Date.now())){ alert('🔇 Susturulmuşsun' + (p.muteReason ? ': ' + p.muteReason : '')); return; }
  if(H.chatLocked && st.isAdmin !== true){ alert('🔒 Sohbet şu an yönetici tarafından kilitli'); return; }
  inp.value = '';
  try{
    const m = { uid: st.uid, name: st.displayName || 'Oyuncu', text: text.slice(0, 200), ts: Date.now() };
    const av = st.profile && st.profile.avatar; if(av) m.avatar = av;
    if(st.isAdmin === true) m.isAdmin = true;
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
  // Karşı tarafın admin bilgisini çek
  fdb.get(fdb.ref(db, 'users/' + uid)).then(s => {
    if(!s.exists()) return;
    const uv = s.val();
    const isAdmUser = uv.isAdmin === true || (H.admins && H.admins[uid]);
    H.dmThread.isAdmin = isAdmUser;
    H.dmThread.avatar = avatarOf(uv, uid);
    if(isAdmUser){
      tEl.innerHTML = '✉️ <span class="chat-admin-badge" style="font-size:10px;padding:1px 5px">👑</span> ' + esc(uv.nick||uv.displayName||nick) + ' <span class="chat-admin-badge" style="font-size:10px;padding:1px 5px">👑</span>';
    } else {
      tEl.textContent = '✉️ ' + (uv.nick || uv.displayName || nick);
    }
  }).catch(()=>{});
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
  H._lastDmSig = '';      // son render imzası (gereksiz render'ı önler)
  H._lastSeenWrite = 0;   // _seen yazma throttle
  // Sadece gerçek MESAJLARI dinle (alt _seen/_typing node'larını değil → feedback loop yok)
  H.offDM = fdb.onValue(fdb.query(fdb.ref(db, 'messages/' + pk), fdb.orderByChild('ts'), fdb.limitToLast(30)), (snap) => {
    const box = byId('ghpDMMsgs'); if(!box) return;
    const rows = []; if(snap.exists()) snap.forEach(ch => {
      const k = ch.key; const v = ch.val();
      // _seen / _typing gibi meta node'ları atla
      if(k && (k.charAt(0)==='_')) return;
      if(v && v.text) rows.push(v);
    });
    if(!rows.length){ box.innerHTML = '<div class="ghp-empty"><div class="ghp-empty-icon">✉️</div><div class="ghp-empty-text">İLK MESAJI YAZ</div></div>'; H.dmRows=[]; return; }
    rows.sort((a,b) => (a.ts||0)-(b.ts||0));
    // İmza: mesaj sayısı + son ts → değişmediyse render etme (kasma önleme)
    const sig = rows.length + ':' + (rows[rows.length-1].ts||0);
    if(sig !== H._lastDmSig){
      H._lastDmSig = sig;
      renderDMRows(rows);
      H.dmRows = rows;
      H.seen['dm_' + uid] = Date.now(); saveSeen();
    }
    // 👁 okundu yaz — throttle (en fazla 3 saniyede bir, gereksiz yazma yok)
    const now = Date.now();
    if(now - H._lastSeenWrite > 3000){
      H._lastSeenWrite = now;
      try{ fdb.set(fdb.ref(db, 'messages/' + pk + '/_seen/' + me), now); }catch(e){}
    }
  });
  // rakibin okundu zamanı → ✓✓ (sadece tick güncelle, TÜM listeyi yeniden render etme)
  H.offSeen = fdb.onValue(fdb.ref(db, 'messages/' + pk + '/_seen/' + uid), (snap) => {
    const newSeen = snap.exists() ? (snap.val() || 0) : 0;
    if(newSeen === H.dmOppSeen) return;  // değişmediyse dokunma
    H.dmOppSeen = newSeen;
    // Sadece tick işaretlerini güncelle (DOM'u baştan kurma)
    updateDmTicks();
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
  // Hafif: sadece kendi mesajlarının ✓/✓✓ tikini güncelle (tüm DOM'u kurmaz)
  function updateDmTicks(){
    const box = byId('ghpDMMsgs'); if(!box || !H.dmRows) return;
    box.querySelectorAll('[data-msgts]').forEach(el => {
      const ts = Number(el.getAttribute('data-msgts')) || 0;
      const tick = el.querySelector('.dm-tick');
      if(!tick) return;
      const seen = H.dmOppSeen >= ts;
      tick.textContent = seen ? '✓✓' : '✓';
      tick.style.color = seen ? '#4FC3F7' : '#546e7a';
      tick.title = seen ? 'Görüldü' : 'İletildi';
    });
  }

  function renderDMRows(rows){
    const box = byId('ghpDMMsgs'); if(!box) return;
    const threadIsAdmin = H.dmThread && H.dmThread.isAdmin === true;
    const myIsAdmin = Auth.getState().isAdmin === true;
    let prevDate = '';
    box.innerHTML = rows.map(m => {
      const isMine = m.from === me;
      const isAdmMsg = m.isAdmin === true;
      // Tarih ayırıcı
      const d = m.ts ? new Date(m.ts) : null;
      const dateStr = d ? d.toLocaleDateString('tr-TR', {day:'numeric',month:'long'}) : '';
      const dateSep = (dateStr && dateStr !== prevDate)
        ? `<div style="text-align:center;margin:8px 0;font-size:9px;color:#50506e;letter-spacing:.5px">${dateStr}</div>`
        : '';
      prevDate = dateStr;
      // Avatar
      const av = isMine
        ? ((Auth.getState().profile && Auth.getState().profile.avatar) || defaultAvatar(me))
        : (m.fromAvatar || defaultAvatar(m.from || ''));
      // İsim + admin rozeti
      const nameHtml = (() => {
        // Kendi mesajım: kendi nick'imi göster (sağa hizalı)
        if(isMine){
          const myState = Auth.getState();
          const myNick = esc(myState.displayName || (myState.profile && myState.profile.nick) || 'Sen');
          const myAdm = myState.isAdmin === true;
          if(myAdm){
            const gcl = glowClass();
            return `<div class="ghp-dm-sender-name ${gcl}" style="color:#FFD740;font-size:10px;font-weight:900;margin-bottom:2px;text-align:right"><span class="chat-admin-badge" style="font-size:9px;padding:1px 4px">👑</span> ${myNick} <span class="chat-admin-badge" style="font-size:9px;padding:1px 4px">👑</span></div>`;
          }
          return `<div style="color:#00E5FF;font-size:10px;font-weight:800;margin-bottom:2px;text-align:right">${myNick}</div>`;
        }
        // Karşı tarafın mesajı
        const n = esc(m.fromName || H.dmThread.nick || 'Oyuncu');
        if(isAdmMsg || threadIsAdmin){
          const gcl = glowClass();
          return `<div class="ghp-dm-sender-name ${gcl}" style="color:#FFD740;font-size:10px;font-weight:900;margin-bottom:2px"><span class="chat-admin-badge" style="font-size:9px;padding:1px 4px">👑</span> ${n} <span class="chat-admin-badge" style="font-size:9px;padding:1px 4px">👑</span></div>`;
        }
        return `<div style="color:#A78BFA;font-size:10px;font-weight:800;margin-bottom:2px">${n}</div>`;
      })();
      // Tick durumu (iletildi / görüldü)
      const tickHtml = isMine ? (() => {
        const seen = H.dmOppSeen >= (m.ts||0);
        return seen
          ? ` <span class="dm-tick seen" title="Görüldü" style="color:#4FC3F7">✓✓</span>`
          : ` <span class="dm-tick" title="İletildi" style="color:#546e7a">✓</span>`;
      })() : '';
      // Mesaj balonu stili
      const bubbleBg = isMine
        ? 'linear-gradient(135deg,rgba(103,80,164,.6),rgba(81,45,168,.4))'
        : isAdmMsg || threadIsAdmin
          ? 'linear-gradient(135deg,rgba(255,180,0,.18),rgba(224,64,251,.1))'
          : 'linear-gradient(135deg,rgba(30,30,60,.8),rgba(20,20,50,.6))';
      const bubbleBdr = isMine ? 'rgba(103,80,164,.4)' : isAdmMsg || threadIsAdmin ? 'rgba(255,215,64,.35)' : 'rgba(60,60,100,.5)';
      return `${dateSep}<div class="ghp-chat-row${isMine ? ' mine' : ''}" style="align-items:flex-end;gap:6px">
        ${!isMine ? `<div style="width:28px;height:28px;border-radius:50%;background:rgba(30,30,60,.8);border:1px solid ${isAdmMsg||threadIsAdmin?'rgba(255,215,64,.4)':'rgba(80,80,120,.4)'};display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${av}</div>` : ''}
        <div style="flex:1;min-width:0">
          ${nameHtml}
          <div style="background:${bubbleBg};border:1px solid ${bubbleBdr};border-radius:${isMine?'14px 14px 4px 14px':'14px 14px 14px 4px'};padding:8px 11px;max-width:82%;word-break:break-word;${isMine?'margin-left:auto':''}">
            <div class="ghp-chat-text" style="margin:0">${esc(m.text)}</div>
          </div>
          <div class="ghp-chat-ts" data-msgts="${m.ts||0}" style="${isMine?'text-align:right':''}margin-top:2px">${tAgo(m.ts || 0)}${tickHtml}</div>
        </div>
        ${isMine ? `<div style="width:28px;height:28px;border-radius:50%;background:rgba(30,30,60,.8);border:1px solid rgba(103,80,164,.4);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${av}</div>` : ''}
      </div>`;
    }).join('');
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
    const _dmAvatar = (me.profile && me.profile.avatar) ? me.profile.avatar : defaultAvatar(me.uid);
    const _dmMsg = { from: me.uid, fromName: me.displayName || 'Oyuncu', text: text.slice(0, 300), ts: Date.now(), fromAvatar: _dmAvatar };
    if(me.isAdmin === true) _dmMsg.isAdmin = true;
    await fdb.push(fdb.ref(db, 'messages/' + pk), _dmMsg);
    // konu listesini güncelle
    const ts = loadThreads(); const i = ts.findIndex(x => x.uid === H.dmThread.uid);
    const item = { uid: H.dmThread.uid, nick: H.dmThread.nick, last: text.slice(0, 40), ts: Date.now(), unread: false };
    if(i >= 0) ts.splice(i, 1);
    ts.unshift(item); saveThreads(ts);
    // watchDMThreads() her mesajda çağrılmaz — ana dinleyici (offDM) zaten mesajı yakalar.
    // Sadece thread listesi rozetini hafifçe güncelle:
    updateDmThreadBadge();
  }catch(e){ alert('Gönderilemedi'); }
}
// Hafif: DM rozet sayısını güncelle (tüm dinleyicileri yeniden kurmadan)
function updateDmThreadBadge(){
  try{
    const ts = loadThreads();
    const unread = ts.filter(t => t.unread).length;
    const badge = byId('ghpDMBadge');
    if(badge){ badge.textContent = unread; badge.style.display = unread > 0 ? '' : 'none'; }
  }catch(e){}
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
// ── 🎨 SOHBET SİSTEM MESAJI (kick/ban/duyuru renkli kart) ─────
function renderChatSystemMsg(m){
  const txt = m.text || '';
  // ── Premium cyberpunk paleti (mor-altın, MMORPG sistem mesajı havası) ──
  // Tüm sistem mesajları aynı elit temayı paylaşır; tip sadece başlık/ikonu değiştirir.
  let label = '📢 DUYURU', icon = '📢';
  if(/atıld|sohbetten at|KICK/i.test(txt)){ label = 'SOHBET KICK'; icon = '🔨'; }
  else if(/banland|ban:|SOHBET BAN/i.test(txt)){ label = 'SOHBET BAN'; icon = '⛔'; }
  else if(/susturul|mute/i.test(txt)){ label = 'SOHBET SUSTURMA'; icon = '🔇'; }
  else if(/duyuru|announce/i.test(txt)){ label = 'DUYURU'; icon = '📢'; }

  // Gövde: başlıktaki ikon tekrarını temizle
  let body = esc(txt).replace(/^[⚡🔨📢🚫⛔🔇]\s*/, '');

  // Admin adlarını altın + ışıltılı yap (👑 ... 👑 arasını veya "Admin: X" sonrasını)
  // "Admin:" sonrası gelen ismi altına boya
  body = body.replace(/(Admin[:\s]+)([^·\n(]+)/i, (mm, p1, p2) =>
    `${p1}<span style="color:#ffd84d;font-weight:800;text-shadow:0 0 6px rgba(255,216,77,.5)">${p2.trim()}</span>`);
  // "ADMIN" / "ADMİN" etiketini mat-altın rozet yap
  body = body.replace(/\b(ADM[İI]N)\b/g,
    `<span style="background:#d6b23c;color:#1a1208;font-weight:900;font-size:9px;padding:1px 6px;border-radius:5px;letter-spacing:.5px;box-shadow:0 0 4px rgba(214,178,60,.4)">$1</span>`);
  // "(neden: ...)" kısmını soluk gri
  body = body.replace(/(\(neden:[^)]*\))/i, `<span style="color:#8a8a8a;font-style:italic">$1</span>`);

  return `<div class="ghp-chat-row" style="width:100%">
    <div style="width:100%;position:relative;border:1px solid #b000ff;border-radius:12px;padding:10px 13px;
      background:linear-gradient(150deg,#120018 0%,#080010 100%);
      box-shadow:0 0 14px rgba(176,0,255,.35), inset 0 0 22px rgba(176,0,255,.06), inset 0 1px 0 rgba(255,76,255,.15);
      overflow:hidden">
      <div style="position:absolute;inset:0;border-radius:12px;pointer-events:none;
        box-shadow:inset 0 0 0 1px rgba(255,76,255,.18)"></div>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:14px;filter:drop-shadow(0 0 4px rgba(255,76,255,.6))">${icon}</span>
        <span style="font-size:11px;font-weight:900;letter-spacing:1px;color:#ff4cff;text-shadow:0 0 8px rgba(255,76,255,.6),0 0 2px rgba(255,76,255,.9)">${label}</span>
        <span style="margin-left:auto;font-size:8.5px;color:#666666">${tAgo(m.ts || 0)}</span>
      </div>
      <div style="font-size:12px;color:#e5e5e5;line-height:1.55">${body}</div>
    </div>
  </div>`;
}

// ── 🎨 ZENGİN BİLDİRİM KARTI (Goodyedek paleti) ──────────────
function renderNotifCard(n){
  // Bildirim tipi renk paleti — her tip kendi canlı rengiyle
  const STY = {
    kick:     {bg:'linear-gradient(135deg,rgba(255,82,82,.16),rgba(180,0,0,.08))', bd:'rgba(255,82,82,.5)',  bl:'#FF5252', ic:'🦵', col:'#ff9090', label:'SOHBETTEN ATILDIN', glow:'0 0 14px rgba(255,82,82,.25)'},
    ban:      {bg:'linear-gradient(135deg,rgba(229,57,53,.18),rgba(120,0,0,.08))', bd:'rgba(229,57,53,.55)', bl:'#E53935', ic:'🚫', col:'#ff8a80', label:'BANLANDIN', glow:'0 0 16px rgba(229,57,53,.3)'},
    unban:    {bg:'linear-gradient(135deg,rgba(105,240,174,.12),rgba(76,175,80,.05))', bd:'rgba(105,240,174,.4)', bl:'#69F0AE', ic:'✅', col:'#69F0AE', label:'BAN KALDIRILDI', glow:'none'},
    mute:     {bg:'linear-gradient(135deg,rgba(255,152,0,.14),rgba(200,80,0,.06))', bd:'rgba(255,152,0,.45)', bl:'#FF9800', ic:'🔇', col:'#FFB74D', label:'SUSTURULDUN', glow:'0 0 12px rgba(255,152,0,.2)'},
    admin:    {bg:'linear-gradient(135deg,rgba(255,82,82,.12),rgba(255,215,64,.06))', bd:'rgba(255,215,64,.5)', bl:'#FFD740', ic:'👑', col:'#FFD740', label:'ADMİN BİLDİRİMİ', glow:'0 0 14px rgba(255,215,64,.2)'},
    broadcast:{bg:'linear-gradient(135deg,rgba(224,64,251,.14),rgba(171,71,188,.06))', bd:'rgba(224,64,251,.4)', bl:'#E040FB', ic:'📢', col:'#E040FB', label:'DUYURU', glow:'0 0 14px rgba(224,64,251,.22)'},
    kaju:     {bg:'linear-gradient(135deg,rgba(255,215,64,.16),rgba(255,180,0,.08))', bd:'rgba(255,215,64,.45)', bl:'#FFD740', ic:'🎁', col:'#FFE57F', label:'KAJU HEDİYESİ', glow:'0 0 14px rgba(255,215,64,.25)'},
    msg:      {bg:'linear-gradient(135deg,rgba(66,165,245,.12),rgba(66,165,245,.05))', bd:'rgba(66,165,245,.35)', bl:'#42A5F5', ic:'✉️', col:'#90CAF9', label:'MESAJ', glow:'none'},
    friend:   {bg:'linear-gradient(135deg,rgba(105,240,174,.12),rgba(76,175,80,.05))', bd:'rgba(105,240,174,.4)', bl:'#69F0AE', ic:'👥', col:'#69F0AE', label:'ARKADAŞLIK', glow:'none'},
    poke:     {bg:'linear-gradient(135deg,rgba(255,215,64,.14),rgba(255,152,0,.06))', bd:'rgba(255,215,64,.4)', bl:'#FFD740', ic:'👋', col:'#FFD740', label:'DÜRTME', glow:'0 0 12px rgba(255,215,64,.2)'},
    challenge:{bg:'linear-gradient(135deg,rgba(255,152,0,.14),rgba(255,87,34,.07))', bd:'rgba(255,152,0,.4)', bl:'#FF9800', ic:'⚔️', col:'#FFB74D', label:'MEYDAN OKUMA', glow:'0 0 12px rgba(255,152,0,.2)'},
    clan:     {bg:'linear-gradient(135deg,rgba(0,229,255,.12),rgba(0,188,212,.05))', bd:'rgba(0,229,255,.4)', bl:'#00E5FF', ic:'🏰', col:'#00E5FF', label:'KLAN', glow:'0 0 12px rgba(0,229,255,.18)'},
    system:   {bg:'rgba(255,255,255,.04)', bd:'rgba(206,147,216,.3)', bl:'#CE93D8', ic:'⚙️', col:'#CE93D8', label:'SİSTEM', glow:'none'}
  };
  // Tipi tespit et: önce n.type, sonra ikon/metin sezgisi
  const txt0 = (n.text || n.msg || '');
  let t = n.type || '';
  if(!t || !STY[t]){
    if(n.icon === '🦵' || txt0.includes('atıldın')) t = 'kick';
    else if(n.icon === '🚫' || txt0.includes('banland')) t = 'ban';
    else if(n.icon === '🔇' || txt0.includes('susturuld')) t = 'mute';
    else if((txt0.includes('🪙') || txt0.includes('🥜') || txt0.includes('hediye')) && (txt0.includes('Kaju') || txt0.includes('kaju'))) t = 'kaju';
    else if(n.from === 'admin' || n.from === 'system') t = 'admin';
    else t = 'system';
  }
  const s = STY[t] || STY.system;
  const ic  = esc(n.icon || s.ic);
  const txt = esc(txt0);
  const hdr = `<b style="color:${s.col};font-size:11px;font-weight:900;letter-spacing:.3px">${s.ic} ${s.label}${t==='admin'||t==='broadcast'?' 👑':''}</b><br>`;
  const fromAttr = n.fromUid
    ? `data-nfrom="${esc(n.fromUid)}" style="cursor:pointer;border-left:3px solid ${s.bl};border-color:${s.bd};background:${s.bg};box-shadow:${s.glow}"`
    : `style="border-left:3px solid ${s.bl};border-color:${s.bd};background:${s.bg};box-shadow:${s.glow}"`;
  return `<div class="ghp-notif-row" ${fromAttr}>
    <div class="ghp-notif-icon" style="background:${s.bg};border:1px solid ${s.bd};font-size:20px">${ic}</div>
    <div class="ghp-notif-body">
      <div class="ghp-notif-text">${hdr}<span style="color:#e8eaf6">${txt}</span></div>
      <div class="ghp-chat-ts" style="color:${s.col};opacity:.85">${tAgo(n.ts || 0)}</div>
    </div>
  </div>`;
}

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
  list.innerHTML = all.map(n => n._bc ? `
      <div class="ghp-notif-row" style="border-color:rgba(255,215,64,.5);background:linear-gradient(135deg,rgba(255,180,0,.13),rgba(224,64,251,.07));box-shadow:0 0 12px rgba(255,215,64,.12);animation:ghp-pulse-bc 2s ease-in-out infinite">
        <div class="ghp-notif-icon" style="background:rgba(255,215,64,.18);border:1px solid rgba(255,215,64,.5);font-size:20px">📣</div>
        <div class="ghp-notif-body">
          <div class="ghp-notif-text" style="font-weight:800"><span style="color:#FFD740">👑 ADMİN DUYURUSU 👑</span><br><span style="color:#fff;font-size:12px">${esc(n.text || '')}</span></div>
          <div class="ghp-chat-ts" style="color:#FFD740;opacity:.8">${esc(n.by || 'Admin')} · ${tAgo(n.ts || 0)}</div>
        </div>
      </div>` : `
      ${renderNotifCard(n)}`).join('');
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
