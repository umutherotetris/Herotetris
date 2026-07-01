// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — BOOTSTRAP
//  Auth/UI/Nav baştan yüklenir (login için kritik).
//  Oyunlar DİNAMİK yüklenir — bir oyun dosyası eksik/hatalı olsa bile
//  login ve diğer oyunlar çalışmaya devam eder (izolasyon).
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import initUI from './ui.js';
import initNav from './nav.js';
import Store from './store.js';

// Mobilde hata görmek için: ekranın üstüne kısa bir uyarı bas
function toast(msg, isErr){
  let t = document.getElementById('__heroToast');
  if(!t){
    t = document.createElement('div');
    t.id = '__heroToast';
    t.style.cssText = 'position:fixed;top:8px;left:8px;right:8px;z-index:99999;padding:10px 12px;border-radius:10px;font:700 11px/1.5 system-ui;white-space:pre-wrap;word-break:break-word;box-shadow:0 8px 30px rgba(0,0,0,.6);pointer-events:none';
    document.body.appendChild(t);
  }
  t.style.background = isErr ? 'rgba(255,82,82,.96)' : 'rgba(105,240,174,.96)';
  t.style.color = isErr ? '#fff' : '#001018';
  t.textContent = msg;
  clearTimeout(t.__h); t.__h = setTimeout(() => { t.remove(); }, isErr ? 4000 : 2000);
}

// Bir oyun modülünü dinamik yükle + aç. Hata olursa sadece o oyun etkilenir.
async function launchGame(modulePath, exportName, label){
  toast(label + ' açılıyor…', false);
  try{
    const mod = await import(modulePath);
    const fn = mod[exportName];
    if(typeof fn !== 'function') throw new Error(exportName + ' bulunamadı (' + modulePath + ')');
    fn();
  }catch(e){
    const detail = (e && (e.message || e)) + '';
    toast(label + ' AÇILAMADI:\n' + detail + '\n\nEksik dosya olabilir — tüm js/games/ klasörünü yükleyip ?v sayısını artır.', true);
    console.error('[' + label + ']', e);
  }
}

function bindEco(id, modulePath, exportName){
  const el = document.getElementById(id);
  if(!el || el.__bound) return;
  el.__bound = 1;
  el.addEventListener('click', async () => {
    try{ const m = await import(modulePath); m[exportName](); }
    catch(e){
      console.error('[Load]', modulePath, e);
      const msg = (e.message||'').includes('<') || (e.message||'').includes('token')
        ? 'Önbellek hatası — sayfayı yenileyin (Ayarlar → Önbellek Temizle)'
        : 'Yüklenemedi: ' + (e.message||e);
      toast(msg, true);
    }
  });
}
async function updateEcoBadges(){
  try{
    const eco = await import('./economy.js');
    // Çark badge: bugün çevrilmemişse göster
    const wb = document.getElementById('wheelBadge');
    if(wb) wb.style.display = eco.canSpin() ? 'flex' : 'none';
    // Görev badge: alınmamış tamamlanan görev sayısı
    const qb = document.getElementById('questBadge');
    if(qb){ const n = eco.pendingQuestCount(); if(n>0){ qb.textContent = n; qb.style.display='flex'; } else qb.style.display='none'; }
  }catch(e){}
  // Turnuva badge: geçen haftanın ödülü bekliyorsa
  try{
    const tb = document.getElementById('trnBadge');
    if(tb){ const trn = await import('./tournament.js'); const has = await trn.hasPendingPrize(); tb.style.display = has ? 'flex' : 'none'; }
  }catch(e){}
}

function bindCard(id, modulePath, exportName, label){
  const card = document.getElementById(id);
  if(!card){ toast('HATA: ' + id + ' kartı yok (index.html güncel değil)', true); return; }
  card.addEventListener('click', () => launchGame(modulePath, exportName, label));
}

function start(){
  // Auth/UI/Nav her durumda çalışır (oyun modüllerinden bağımsız)
  try{ initUI(); }catch(e){ console.error('[UI]', e); toast('Arayüz hatası: ' + (e && e.message || e), true); }
  try{ initNav(); }catch(e){ console.error('[Nav]', e); }

  // 💎 Sosyal Hub: index.html'de versiyonsuz import ediliyor (çift init önlendi)
  // PWA push bildirimleri — SW kaydet + dinlemeyi başlat
  import('./push.js').then(m => m.initPush()).catch(e => console.warn('[Push]', e));
  // Günlük giriş ödülü — auth hazır olunca çalıştır
  import('./daily.js').then(m => {
    const { Auth } = { Auth: window.__heroAuth };
    // Auth state hazır olunca kontrol et
    setTimeout(async()=>{
      try{ const d=await import('./daily.js'); await d.checkDailyLogin(); }catch(e){}
    }, 2000);
  }).catch(()=>{});
  // 👤 Profil ekranları: index.html'de versiyonsuz import ediliyor (çift init önlendi)

  // Oyunlar dinamik yüklenir — biri eksikse diğerleri + login etkilenmez
  bindCard('gameTetris', './games/tetris.js', 'openTetris', 'Tetris');
  bindCard('gameChess',  './games/chess.js',  'openChess',  'Satranç');
  bindCard('gameTavla',  './games/tavla.js',  'openTavla',  'Tavla');
  bindCard('gameKelime', './games/kelime.js', 'openKelime', 'Kelimecik');

  // 💎 Ekonomi butonları (çark / görev / kaju geçmişi)
  bindEco('ecoWheelBtn',  './economy.js', 'openDailyWheel');
  bindEco('ecoQuestBtn',  './economy.js', 'openQuests');
  bindEco('ecoHistBtn',   './economy.js', 'openKajuHistory');
  // 🏆 Turnuva butonu (varsa)
  bindEco('ecoTrnBtn',    './tournament.js', 'openTournament');
  // 🔔 Bildirim ayarları butonu (varsa)
  bindEco('notifSettingsBtn', './push.js', 'openNotifSettings');
  // Turnuva sistemini aktive et (puan toplama + Auth aboneliği)
  import('./tournament.js').then(m => {
    // Giriş sonrası geçen haftanın turnuva ödülünü otomatik yatır (talep gerektirmez)
    if(m.autoClaimPrize) setTimeout(()=>m.autoClaimPrize().catch(()=>{}), 2500);
  }).catch(e => console.warn('[Tournament]', e));
  // Günlük özet widget'ı (ana ekrana otomatik enjekte olur)
  import('./dailysummary.js').catch(e => console.warn('[DailySummary]', e));
  // Badge güncelleme: 3sn sonra (önce kritik UI yüklensin)
  setTimeout(updateEcoBadges, 3000);
  setInterval(updateEcoBadges, 60000);

  // Yakalanmayan hataları ekrana bas
  window.addEventListener('error', (e) => toast('HATA: ' + (e.message || '') + '\n' + (e.filename||'').split('/').pop() + ':' + (e.lineno||''), true));
  window.addEventListener('unhandledrejection', (e) => toast('PROMISE HATASI:\n' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason), true));

  console.info('[Hero] Stage 2 — Auth hazır, oyunlar dinamik yüklenecek.');
  window.Hero = {
    Auth, Store, toast,
    openTetris: () => launchGame('./games/tetris.js', 'openTetris', 'Tetris'),
    openChess:  () => launchGame('./games/chess.js',  'openChess',  'Satranç'),
    openTavla:  () => launchGame('./games/tavla.js',  'openTavla',  'Tavla'),
    openKelime: () => launchGame('./games/kelime.js', 'openKelime', 'Kelimecik'),
    openQuests:     () => import('./economy.js').then(m=>m.openQuests()).catch(e=>toast('Görevler açılamadı',true)),
    openWheel:      () => import('./economy.js').then(m=>m.openDailyWheel()).catch(e=>toast('Çark açılamadı',true)),
    openTournament: () => import('./tournament.js').then(m=>m.openTournament()).catch(e=>toast('Turnuva açılamadı',true)),
    openNotifSettings: () => import('./push.js').then(m=>m.openNotifSettings()).catch(e=>toast('Bildirim ayarları açılamadı',true))
  };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
