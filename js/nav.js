// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — NAVİGASYON (basit, tek mekanizma)
//  Alt menüdeki sekmeler ekranları değiştirir. Tek event listener,
//  eski sistemdeki goMenu/showScreen yama kulesi YOK.
// ════════════════════════════════════════════════════════════════
const SCREENS = ['home', 'friends', 'leaderboard', 'profile', 'notifications'];

export function go(screen){
  if(SCREENS.indexOf(screen) < 0) screen = 'home';
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === screen);
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === screen);
  });
  try { history.replaceState({ screen }, '', '#' + screen); } catch(e){}
  window.scrollTo(0, 0);
}

export function initNav(){
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); go(el.dataset.nav); });
  });
  // İlk ekran: hash varsa onu, yoksa home
  const hash = (location.hash || '').replace('#', '');
  go(SCREENS.indexOf(hash) >= 0 ? hash : 'home');
}

export default initNav;
