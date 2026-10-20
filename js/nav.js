// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — NAVİGASYON (basit, tek mekanizma)
//  Alt menüdeki sekmeler ekranları değiştirir. Tek event listener,
//  eski sistemdeki goMenu/showScreen yama kulesi YOK.
// ════════════════════════════════════════════════════════════════
const SCREENS = ['home', 'friends', 'leaderboard', 'profile', 'notifications'];
let initialized = false;

export function go(screen, focus = false){
  if(SCREENS.indexOf(screen) < 0) screen = 'home';
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === screen);
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === screen);
    if(el.dataset.nav === screen) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  try { history.replaceState({ screen }, '', '#' + screen); } catch(e){}
  window.scrollTo(0, 0);
  if(focus) document.querySelector('[data-screen="' + screen + '"]')?.focus({ preventScroll: true });
}

export function initNav(){
  if(initialized) return;
  initialized = true;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); go(el.dataset.nav, true); });
  });
  // İlk ekran: hash varsa onu, yoksa home
  const hash = (location.hash || '').replace('#', '');
  go(SCREENS.indexOf(hash) >= 0 ? hash : 'home');
  window.addEventListener('hashchange', () => {
    const screen = location.hash.slice(1);
    if(SCREENS.includes(screen)) go(screen);
  });
}

export default initNav;
