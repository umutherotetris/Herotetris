import { Auth } from './auth.js';
import { mountGameSocial } from './game-social.js';
import { go } from './nav.js';
import { button, element, ensureCenterStyles } from './portal-panels.js';

const specs=[
  ['tetris','.tetris-overlay','.tetris-topbar','HeroTetris'],
  ['chess','.chess-root','.cg-top','Satranç'],
  ['tavla','.tavla-root','.tg-top','Tavla'],
  ['kelime','.kl-root','.kl-top','Kelimecik']
];
const overlaySelector=specs.map(([,selector])=>selector).concat('.hero-select-overlay').join(',');
let initialized=false;

// Full-screen game roots are not native dialogs. Keep the portal from receiving
// focus while a game is in front; leave a real dialog's own focus handling alone.
function createGameFocus(){
  const shell=[...document.querySelectorAll('.portal-header,#app,.bottom-nav')];
  const prior=new Map();let front=null,opener=null;
  return ()=>{
    const next=[...document.querySelectorAll(overlaySelector)].reverse().find(root=>!root.hidden&&!root.inert);
    if(next===front)return;
    if(next){
      const focused=document.activeElement;
      if(!front){opener=focused;for(const node of shell){prior.set(node,node.inert);node.inert=true;}}
      if(!next.contains(focused)&&!document.querySelector('dialog[open]')){
        if(!next.hasAttribute('tabindex'))next.tabIndex=-1;
        next.focus({preventScroll:true});
      }
    }else{
      for(const [node,saved]of prior)node.inert=saved;prior.clear();
      if(opener?.isConnected && (!document.activeElement||document.activeElement===document.body))opener.focus({preventScroll:true});
      opener=null;
    }
    front=next;
  };
}

export function initGameReturn(){
  if(initialized)return;initialized=true;ensureCenterStyles();
  const syncFocus=createGameFocus();
  let active=null,pending=false,again=false;
  const records=new Map(),modules=new Map(),owners=new WeakMap();
  const dock=button('',()=>restore(),'portal-resume');dock.hidden=true;
  const glyph=element('span','portal-resume-glyph','↪');glyph.setAttribute('aria-hidden','true');
  const status=element('span','portal-resume-copy'),name=element('strong');
  const summary=element('span','portal-resume-sub','Oturum açık');
  const call=element('span','portal-resume-cta','Oyuna dön');
  status.append(name,summary);dock.append(glyph,status,call);
  const app=document.getElementById('app');
  if(app?.parentNode?.insertBefore)app.parentNode.insertBefore(dock,app);
  else document.body.append(dock);

  function updateDock(entry){
    if(!entry){dock.hidden=true;delete dock.dataset.game;return;}
    name.textContent=entry.name;
    summary.textContent=entry.root.querySelector('.hero-session-status')
      ? 'Çevrimiçi · süre işleyebilir' : 'Oturum açık';
    dock.dataset.game=entry.key;
    dock.setAttribute('aria-label',entry.name+' oyununa dön');
    dock.hidden=false;
  }

  function notify(entry,minimized){
    document.dispatchEvent(new CustomEvent('hero:game-visibility',{detail:{root:entry.root,key:entry.key,minimized}}));
  }

  function restore(){
    const entry=active;
    if(!entry)return false;
    if(!entry.root.isConnected||Auth.getState().uid!==entry.uid){
      if(entry.root.isConnected)entry.module.closePortalGame?.(entry.root);
      active=null;updateDock(null);syncFocus();return false;
    }
    const {root}=entry;
    root.hidden=false;root.inert=false;
    delete root.dataset.portalMinimized;
    // The engine still needs the visible board dimensions when it resumes.
    if(entry.module.setPortalMinimized(false)===false){
      root.hidden=true;root.inert=true;root.dataset.portalMinimized='true';
      return false;
    }
    active=null;updateDock(null);
    document.body.style.overflow=entry.overflow;
    syncFocus();
    notify(entry,false);
    if(!document.querySelector('dialog[open]'))entry.control?.focus({preventScroll:true});
    return true;
  }

  function minimize(entry,screen='home'){
    if(active||!entry.root.isConnected||Auth.getState().uid!==entry.uid)return false;
    entry.overflow=document.body.style.overflow;
    if(entry.module.setPortalMinimized(true)===false)return false;
    const {root}=entry;
    root.hidden=true;root.inert=true;root.dataset.portalMinimized='true';
    document.body.style.overflow='';
    active=entry;
    updateDock(entry);syncFocus();notify(entry,true);
    go(screen,false,'push');
    dock.focus({preventScroll:true});
    return true;
  }

  function detachControls(entry){
    entry.social?.destroy();
    entry.social=null;
    entry.tools?.remove();
    entry.tools=null;entry.control=null;
  }

  function drop(entry){
    detachControls(entry);
    records.delete(entry.root);
    if(active===entry){active=null;updateDock(null);}
  }

  async function scan(){
    if(pending){again=true;return;}
    pending=true;
    try{
      for(const [root,entry]of records)if(!root.isConnected)drop(entry);
      for(const [key,selector,headerSelector,title]of specs){
        const root=document.querySelector(selector);if(!root)continue;
        if(!owners.has(root))owners.set(root,Auth.getState().uid);
        const capturedUid=owners.get(root);
        let entry=records.get(root);
        if(!entry){
          let module=modules.get(key);
          if(!module){module=await import('./games/'+key+'.js');modules.set(key,module);}
          if(!root.isConnected)continue;
          if(capturedUid!==Auth.getState().uid){module.closePortalGame?.(root);continue;}
          if(typeof module.setPortalMinimized!=='function')continue;
          entry={root,module,key,name:title,uid:capturedUid};records.set(root,entry);
        }
        if(!entry.tools?.isConnected){
          const header=root.querySelector(headerSelector);if(!header)continue;
          detachControls(entry);
          const tools=element('div','portal-game-tools');
          tools.setAttribute('role','group');tools.setAttribute('aria-label','Oyun araçları');
          const control=button('Portala dön',()=>minimize(entry),'portal-minimize portal-tool');
          control.title='Portala dön ve oyunu açık tut. Çevrimiçi maçlar çalışmaya devam eder.';
          control.setAttribute('aria-description','Çevrimiçi maç ve sayaçlar devam edebilir.');
          entry.tools=tools;entry.control=control;
          tools.append(control);header.append(tools);
          entry.social=mountGameSocial(root,tools,{onCover:open=>entry.module.setPortalSocialOpen?.(open,root)});
          document.dispatchEvent(new CustomEvent('hero:game-tools-mounted',{detail:{root,tools,key}}));
          const exit=header.querySelector('[data-act="exit"],[data-act="close"]');
          if(exit&&!exit.hasAttribute('aria-label'))exit.setAttribute('aria-label','Oyundan çık');
          globalThis.dispatchEvent?.(new Event('resize'));
        }
      }
    }catch(error){console.warn('[Oyun araçları]',error);}
    finally{pending=false;if(again){again=false;schedule();}}
  }

  let scheduled=false;
  const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;syncFocus();void scan();});};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('hero:game-opened',schedule);
  document.addEventListener('hero:request-game-portal',event=>{
    const entry=records.get(event.detail?.root);
    if(entry&&minimize(entry,event.detail?.screen))event.preventDefault();
  });
  Auth.subscribe(state=>{
    for(const entry of records.values())if(entry.uid!==state.uid){
      entry.module.closePortalGame?.(entry.root);
      drop(entry);
      document.body.style.overflow='';
    }
    schedule();
  });
  schedule();
}
