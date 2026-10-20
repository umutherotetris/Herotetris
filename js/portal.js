// The shell and navigation stay usable while account services load.
import initNav, { go } from './nav.js';

initNav();
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  go('home');
  const games = document.getElementById('games');
  games.focus({ preventScroll: true });
  games.scrollIntoView({ block: 'start' });
});

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

import('./app.js?v=136').then(() => {
  bootState = 'ready';
  status.hidden = true;
  const msg = document.getElementById('authMsg');
  msg.textContent = '';
  msg.style.display = 'none';
}).catch(error => {
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
