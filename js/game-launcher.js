// One launch authority for collection cards, recents and friend invitations.
const games = {
  tetris: { path:'./games/tetris.js', open:'openTetris', name:'Tetris' },
  chess: { path:'./games/chess.js', open:'openChess', name:'Satranç' },
  tavla: { path:'./games/tavla.js', open:'openTavla', name:'Tavla' },
  kelime: { path:'./games/kelime.js', open:'openKelime', name:'Kelimecik' }
};
let pending = null;
const activeGame = () => document.querySelector('.tetris-overlay,.hero-select-overlay,.chess-root,.tavla-root,.kl-root');
function announce(message, error = false){
  if(window.Hero?.toast) window.Hero.toast(message, error);
  else {
    const status = document.getElementById('portalStatus');
    if(status){ status.textContent = message; status.hidden = false; }
  }
}
export function canLaunchPortalGame(){
  if(pending?.isCurrent && !pending.isCurrent()) pending = null;
  if(pending || activeGame()){
    announce(pending ? 'Oyun hazırlanıyor. Birazdan hazır olacak.' : 'Önce açık oyunu kapat, sonra yeni oyuna geç.', true);
    return false;
  }
  return true;
}
export function launchPortalGame(key, options = {}){
  const entry = Object.hasOwn(games, key) ? games[key] : null;
  if(!entry) return Promise.resolve(false);
  if(pending?.isCurrent && !pending.isCurrent()) pending = null;
  // Repeated ordinary taps share the same import; invitations keep their context.
  if(pending?.key === key && !options.open && !pending.custom) return pending.promise;
  // Ordinary collection taps keep the most recent choice while imports load.
  // Invitations reserve the slot through their preparation so their context
  // cannot be overtaken by an unrelated collection tap or invitation.
  if(activeGame() || (pending && (pending.custom || options.open))){
    canLaunchPortalGame();
    return Promise.resolve(false);
  }
  announce(entry.name + ' açılıyor…');
  const request = { key, custom:!!options.open, isCurrent:options.isCurrent, promise:null };
  pending = request;
  request.promise = (async () => {
    try{
      const module = await import(entry.path);
      if(pending !== request || request.isCurrent && !request.isCurrent()) return false;
      // A direct invitation/module callback may have opened a game while loading.
      if(activeGame()){
        announce('Önce açık oyunu kapat, sonra yeni oyuna geç.', true);
        return false;
      }
      const open = options.open || (loaded => loaded[entry.open]());
      if(await open(module) === false) return false;
      if(pending !== request) return false;
      document.dispatchEvent(new CustomEvent('hero:game-opened', { detail:{ modulePath:entry.path } }));
      return true;
    }catch(error){
      console.error('[' + entry.name + ']', error);
      announce(entry.name + ' açılamadı. Bağlantını kontrol edip yeniden dene.', true);
      return false;
    }finally{
      if(pending === request) pending = null;
    }
  })();
  return request.promise;
}
