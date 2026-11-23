// The game toolbar opens the same social hub as Diamond. No separate
// account, transport, room state, or message listeners are created here.
const entries = new Map();
let hub = { entry:null, unread:0, open:false };
let social;
const loadSocial = () => social ||= import('./social.js').catch(error => { social = null; throw error; });

function canOpen(entry){
  return !!entry?.opener.isConnected && !entry.root.hidden && !entry.root.inert &&
    entry.opener.getClientRects().length > 0;
}

export function visibleGameSocial(){
  return [...entries.values()].reverse().find(canOpen) || null;
}

export function gameSocialBounds(view, zoom = 1){
  const gap = 8, wide = view.width >= 720;
  const availableWidth = Math.max(1,view.width - 2 * gap);
  const availableHeight = Math.max(1,view.height - 2 * gap);
  const width = Math.min(availableWidth, (wide ? 420 : 460) * zoom);
  const height = Math.min(availableHeight, wide ? 510 * zoom : Math.max(310 * zoom, view.height * .58));
  return {
    left: view.left + (wide ? view.width - width - gap : (view.width - width) / 2),
    top: view.top + (wide && view.height >= 550 ? 20 : view.height - height - gap),
    width, height,
  };
}

export function setGameSocialState(next){
  hub = next;
  for(const entry of entries.values()) entry.sync();
}

export function mountGameSocial(root, toolbar, {onCover} = {}){
  entries.get(root)?.destroy();
  if(!document.getElementById('gameSocialCSS')){
    const style = document.createElement('link');
    style.rel = 'stylesheet'; style.id = 'gameSocialCSS';
    style.href = new URL('../css/game-social.css', import.meta.url).href;
    document.head.append(style);
  }
  const opener = document.createElement('button');
  opener.type = 'button'; opener.className = 'portal-tool portal-game-social';
  opener.setAttribute('aria-label','Portal sohbeti ve arkadaşlar');
  opener.setAttribute('aria-controls','gemHubPanel');
  opener.setAttribute('aria-haspopup','dialog');
  opener.title = 'Portal sohbeti ve arkadaşlar';
  opener.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 10.8a7.7 7.7 0 0 1-7.9 7.5H8.4l-4.8 2.2 1.2-4.1A7.2 7.2 0 0 1 3 11.1a7.8 7.8 0 0 1 8-7.6h1.6a7.8 7.8 0 0 1 7.9 7.3Z"/><path d="M8 11h8"/></svg><span class="portal-social-label">Sosyal</span><span class="portal-social-badge" aria-hidden="true" hidden></span>';
  const label = opener.querySelector('.portal-social-label');
  const badge = opener.querySelector('.portal-social-badge');
  let covered = false, alive = true;
  const entry = {root,opener,sync,destroy};
  entries.set(root, entry);
  const roomChat = root.querySelector('[data-el="chatBtn"]');
  if(roomChat){ roomChat.title='Oda sohbeti';roomChat.setAttribute('aria-label','Oda sohbeti'); }
  toolbar.append(opener);

  function cover(open){
    if(covered === open) return;
    covered = open;
    try{ onCover?.(open); }catch(error){ console.warn('[GameSocial]',error); }
  }
  function sync(){
    const open = hub.open && hub.entry === entry;
    opener.setAttribute('aria-expanded',String(open));
    badge.hidden = !hub.unread;
    badge.textContent = hub.unread > 9 ? '9+' : String(hub.unread || '');
    opener.setAttribute('aria-label','Portal sohbeti ve arkadaşlar' + (hub.unread ? ', ' + hub.unread + ' okunmamış' : ''));
    cover(open);
  }
  async function show(){
    if(!canOpen(entry) || !alive || opener.disabled) return;
    opener.disabled = true; opener.setAttribute('aria-busy','true');
    try{
      const module = await loadSocial();
      if(alive && canOpen(entry)){
        label.textContent = 'Sosyal';
        opener.title = 'Portal sohbeti ve arkadaşlar';
        // Re-enable before opening so focus can return even on an immediate dismissal.
        opener.disabled = false;
        module.openGameHub('chat',entry);
      }
    }catch(error){
      if(alive){
        label.textContent = 'Yeniden dene';
        opener.title = 'Sohbet yüklenemedi. Yeniden dene.';
        opener.setAttribute('aria-label',opener.title);
        window.Hero?.toast?.(opener.title,true);
        console.warn('[GameSocial]',error);
      }
    }finally{opener.disabled = false; opener.removeAttribute('aria-busy');}
  }
  function visibility(event){
    if(event.detail?.root !== root || !event.detail?.minimized || hub.entry !== entry) return;
    loadSocial().then(module => module.closeGameHub(root,false)).catch(()=>{});
  }
  function destroy(){
    if(!alive) return;
    alive = false;
    opener.removeEventListener('click',show);
    document.removeEventListener('hero:game-visibility',visibility);
    if(entries.get(root) === entry) entries.delete(root);
    if(hub.entry === entry) loadSocial().then(module => module.closeGameHub(root,false)).catch(()=>{});
    // The root may have already been replaced; the game hook checks round identity.
    cover(false);
    opener.remove();
  }
  opener.addEventListener('click',show);
  document.addEventListener('hero:game-visibility',visibility);
  sync();
  return entry;
}
