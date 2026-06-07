// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — BOOTSTRAP
//  Auth/UI/Nav baştan yüklenir (login için kritik).
//  Oyunlar DİNAMİK yüklenir — bir oyun dosyası eksik/hatalı olsa bile
//  login ve diğer oyunlar çalışmaya devam eder (izolasyon).
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import initUI from './ui.js';
import initNav from './nav.js';

// Mobilde hata görmek için: ekranın üstüne kısa bir uyarı bas
function toast(msg, isErr){
  let t = document.getElementById('__heroToast');
  if(!t){
    t = document.createElement('div');
    t.id = '__heroToast';
    t.style.cssText = 'position:fixed;top:8px;left:8px;right:8px;z-index:99999;padding:10px 12px;border-radius:10px;font:700 11px/1.5 system-ui;white-space:pre-wrap;word-break:break-word;box-shadow:0 8px 30px rgba(0,0,0,.6)';
    document.body.appendChild(t);
  }
  t.style.background = isErr ? 'rgba(255,82,82,.96)' : 'rgba(105,240,174,.96)';
  t.style.color = isErr ? '#fff' : '#001018';
  t.textContent = msg;
  clearTimeout(t.__h); t.__h = setTimeout(() => { t.remove(); }, isErr ? 9000 : 2500);
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

function bindCard(id, modulePath, exportName, label){
  const card = document.getElementById(id);
  if(!card){ toast('HATA: ' + id + ' kartı yok (index.html güncel değil)', true); return; }
  card.addEventListener('click', () => launchGame(modulePath, exportName, label));
}

function start(){
  // Auth/UI/Nav her durumda çalışır (oyun modüllerinden bağımsız)
  try{ initUI(); }catch(e){ console.error('[UI]', e); toast('Arayüz hatası: ' + (e && e.message || e), true); }
  try{ initNav(); }catch(e){ console.error('[Nav]', e); }

  // Oyunlar dinamik yüklenir — biri eksikse diğerleri + login etkilenmez
  bindCard('gameTetris', './games/tetris.js', 'openTetris', 'Tetris');
  bindCard('gameChess',  './games/chess.js',  'openChess',  'Satranç');
  bindCard('gameTavla',  './games/tavla.js',  'openTavla',  'Tavla');
  bindCard('gameKelime', './games/kelime.js', 'openKelime', 'Kelimecik');

  // Yakalanmayan hataları ekrana bas
  window.addEventListener('error', (e) => toast('HATA: ' + (e.message || '') + '\n' + (e.filename||'').split('/').pop() + ':' + (e.lineno||''), true));
  window.addEventListener('unhandledrejection', (e) => toast('PROMISE HATASI:\n' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason), true));

  console.info('[Hero] Stage 2 — Auth hazır, oyunlar dinamik yüklenecek.');
  window.Hero = {
    Auth, toast,
    openTetris: () => launchGame('./games/tetris.js', 'openTetris', 'Tetris'),
    openChess:  () => launchGame('./games/chess.js',  'openChess',  'Satranç'),
    openTavla:  () => launchGame('./games/tavla.js',  'openTavla',  'Tavla'),
    openKelime: () => launchGame('./games/kelime.js', 'openKelime', 'Kelimecik')
  };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
