// The shell and navigation stay usable while account services load.
import initNav from './nav.js';

initNav();

const status = document.getElementById('portalStatus');
const gameIds = ['gameTetris', 'gameChess', 'gameTavla', 'gameKelime'];
let bootState = 'loading';

function showStatus(message, retry = false){
  status.replaceChildren(document.createTextNode(message));
  status.hidden = false;
  if(retry){
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'portal-retry';
    button.textContent = 'Yeniden dene';
    button.addEventListener('click', () => location.reload());
    status.append(' ', button);
  }
}

gameIds.concat(['connectBtn', 'ecoWheelBtn', 'ecoQuestBtn', 'ecoHistBtn']).forEach(id => {
  const button = document.getElementById(id);
  if(!button) return;
  button.addEventListener('click', event => {
    if(bootState === 'ready') return;
    event.stopImmediatePropagation();
    showStatus(bootState === 'error'
      ? 'Oyuncu hizmetine bağlanılamadı. Bağlantını kontrol edip tekrar dene.'
      : 'Oyun alanın hazırlanıyor. Birazdan hazır olacak.', bootState === 'error');
    // Account buttons sit below the games; announce the same state there.
    const msg = document.getElementById('authMsg');
    msg.textContent = bootState === 'error' ? 'Bağlantı kurulamadı. Sayfayı yenileyip tekrar dene.' : 'Bağlantı kuruluyor…';
    msg.style.display = 'block';
  }, { capture: true });
});

// A stalled connection must offer recovery even when an SDK request never rejects.
const bootTimeout = setTimeout(() => {
  bootState = 'error';
  showStatus('Bağlantı beklenenden uzun sürüyor. İnternetini kontrol edip tekrar dene.', true);
}, 15000);

import('./app.js?v=139').then(() => {
  clearTimeout(bootTimeout);
  bootState = 'ready';
  status.hidden = true;
  const msg = document.getElementById('authMsg');
  msg.textContent = '';
  msg.style.display = 'none';
}).catch(error => {
  clearTimeout(bootTimeout);
  bootState = 'error';
  console.error('[PortalBoot]', error);
  showStatus('Oyuncu hizmetine bağlanılamadı. Bağlantını kontrol edip tekrar dene.', true);
});

const screenError = () => {
  ['scrProfile', 'scrLB', 'scrFriends', 'scrNotif'].forEach(id => {
    const box = document.createElement('div');
    box.className = 'placeholder';
    box.setAttribute('role', 'status');
    box.textContent = 'Bu alan yüklenemedi. Bağlantını kontrol edip sayfayı yenile.';
    document.getElementById(id).replaceChildren(box);
  });
};

import('./profile.js').then(module => module.initScreens()).catch(screenError);
import('./social.js').then(module => module.initSocial()).catch(error => console.error('[SocialBoot]', error));
