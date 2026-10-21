// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — NAVİGASYON (basit, tek mekanizma)
//  Alt menüdeki sekmeler ekranları değiştirir. Tek event listener,
//  eski sistemdeki goMenu/showScreen yama kulesi YOK.
// ════════════════════════════════════════════════════════════════
const SCREENS = ['home', 'friends', 'leaderboard', 'profile', 'notifications'];
let initialized = false;

export function go(screen, focus = false, historyMode = 'replace'){
  if(SCREENS.indexOf(screen) < 0) screen = 'home';
  document.querySelectorAll('[data-screen]').forEach(el => {
    el.classList.toggle('active', el.dataset.screen === screen);
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === screen);
    if(el.dataset.nav === screen) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
  try { if(historyMode !== 'none' && location.hash !== '#' + screen) history[historyMode === 'push' ? 'pushState' : 'replaceState']({ screen }, '', '#' + screen); } catch(e){}
  window.scrollTo(0, 0);
  if(focus) document.querySelector('[data-screen="' + screen + '"]')?.focus({ preventScroll: true });
}

export function initNav(){
  if(initialized) return;
  initialized = true;
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); go(el.dataset.nav, true, 'push'); });
  });
  const showGames = (historyMode = 'push') => {
    go('home', false, 'none');
    const games = document.getElementById('games');
    if(!games) return;
    games.focus({ preventScroll: true });
    games.scrollIntoView({ block: 'start' });
    try{ if(historyMode !== 'none' && location.hash !== '#games') history.pushState({ screen: 'home' }, '', '#games'); }catch(e){}
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href="#games"]');
    if(!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    showGames();
  });
  // İlk ekran: hash varsa onu, yoksa home
  const hash = (location.hash || '').replace('#', '');
  if(hash === 'games') showGames('none');
  else go(SCREENS.indexOf(hash) >= 0 ? hash : 'home');
  window.addEventListener('hashchange', () => {
    const screen = location.hash.slice(1);
    if(screen === 'games') showGames('none');
    else go(SCREENS.includes(screen) ? screen : 'home', true, 'none');
  });
}

export default initNav;
