// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — BOOTSTRAP
//  Tüm modülleri birbirine bağlar. Tek giriş noktası.
// ════════════════════════════════════════════════════════════════
import Auth from './auth.js';
import initUI from './ui.js';
import initNav from './nav.js';

function start(){
  initUI();
  initNav();
  console.info('[Hero] Stage 1 çekirdek hazır — tek kaynaklı auth + tek render + nav.');
  // Hata ayıklama için konsoldan erişim
  window.Hero = { Auth };
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
