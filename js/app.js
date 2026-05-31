// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — BOOTSTRAP
//  Tüm modülleri birbirine bağlar. Tek giriş noktası.
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import initUI from './ui.js';
import initNav from './nav.js';
import { openTetris } from './games/tetris.js';

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

function start(){
  initUI();
  initNav();

  // Oyun kartlarını bağla
  const tetrisCard = document.getElementById('gameTetris');
  if(!tetrisCard){
    toast('HATA: gameTetris kartı bulunamadı (index.html güncel değil)', true);
  } else {
    tetrisCard.addEventListener('click', () => {
      try{
        toast('Tetris açılıyor…', false);
        openTetris();
      }catch(e){
        toast('TETRİS HATASI:\n' + (e && (e.stack || e.message) || e), true);
        console.error('[Tetris]', e);
      }
    });
  }

  // Yakalanmayan hataları da ekrana bas
  window.addEventListener('error', (e) => toast('HATA: ' + (e.message || '') + '\n' + (e.filename||'').split('/').pop() + ':' + (e.lineno||''), true));
  window.addEventListener('unhandledrejection', (e) => toast('PROMISE HATASI:\n' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason), true));

  console.info('[Hero] Stage 2 — Tetris bağlı.');
  window.Hero = { Auth, openTetris, toast };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
