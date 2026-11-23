import { Auth } from './auth.js';
import { button, ensureCenterStyles } from './portal-panels.js';

const specs=[['tetris','.tetris-overlay','.tetris-topbar'],['chess','.chess-root','.cg-top'],['tavla','.tavla-root','.tg-top'],['kelime','.kl-root','.kl-top']];
let initialized=false;
// Game overlays cover the whole portal, but unlike native dialogs do not
// prevent keyboard and screen-reader navigation into what's behind them.
// Keep those surfaces usable again as soon as the game is minimized or closed.
const overlaySelector=specs.map(([,selector])=>selector).concat('.hero-select-overlay').join(',');
function createGameFocus(){
  const shell=[...document.querySelectorAll('.portal-header,#app,.bottom-nav')];
  const prior=new Map();let front=null,opener=null;
  return ()=>{
    const next=[...document.querySelectorAll(overlaySelector)].reverse().find(root=>!root.hidden&&!root.inert);
    if(next===front)return;
    if(next){
      const focused=document.activeElement;
      if(!front){opener=focused;for(const node of shell){prior.set(node,node.inert);node.inert=true;}}
      if(!next.contains(focused)){
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
  const syncFocus=typeof document.querySelectorAll==='function'?createGameFocus():()=>{};
  let active=null,pending=false;const records=new Map(),modules=new Map(),owners=new WeakMap();
  const dock=button('↗ Aktif maça dön',()=>restore(),'portal-resume');dock.hidden=true;document.body.append(dock);
  const restore=()=>{
    if(!active)return;const entry=active;active=null;
    if(Auth.getState().uid!==entry.uid){entry.module.closePortalGame?.(entry.root);dock.hidden=true;document.body.style.overflow='';return;}
    if(entry.root.isConnected){entry.root.hidden=false;entry.root.inert=false;delete entry.root.dataset.portalMinimized;entry.module.setPortalMinimized(false);document.body.style.overflow=entry.overflow;entry.control?.focus({preventScroll:true});}
    dock.hidden=true;syncFocus();
  };
  const minimize=entry=>{
    if(active||!entry.root.isConnected||Auth.getState().uid!==entry.uid)return;
    entry.overflow=document.body.style.overflow;if(entry.module.setPortalMinimized(true)===false)return;
    entry.root.hidden=true;entry.root.inert=true;entry.root.dataset.portalMinimized='true';document.body.style.overflow='';active=entry;
    dock.textContent='↗ '+entry.name+' · Aktif maça dön';dock.hidden=false;syncFocus();dock.focus();
  };
  async function scan(){
    if(pending)return;pending=true;
    try{
      for(const [key,selector,headerSelector]of specs){
        const root=document.querySelector(selector);if(!root)continue;
        const capturedUid=Auth.getState().uid;if(!owners.has(root))owners.set(root,capturedUid);
        let entry=records.get(root);
        if(!entry){
          let module=modules.get(key);if(!module){module=await import('./games/'+key+'.js');modules.set(key,module);}
          if(capturedUid!==Auth.getState().uid||owners.get(root)!==Auth.getState().uid){module.closePortalGame?.(root);continue;}
          if(!root.isConnected||typeof module.setPortalMinimized!=='function')continue;
          entry={root,module,uid:capturedUid,name:({tetris:'Tetris',chess:'Satranç',tavla:'Tavla',kelime:'Kelimecik'})[key]};records.set(root,entry);
        }
        if(!entry.control?.isConnected){
          const header=root.querySelector(headerSelector);if(!header)continue;
          const control=button('↗ Portal · oyun sürer',()=>minimize(entry),'portal-minimize');control.title='Oyun ve süreler devam edebilir. Aktif maça dön düğmesiyle geri gel.';control.setAttribute('aria-label','Portala bak. Oyun ve süreler devam edebilir.');entry.control=control;header.append(control);
          globalThis.dispatchEvent?.(new Event('resize'));
        }
      }
      for(const [root,entry]of records)if(!root.isConnected){records.delete(root);if(active===entry){active=null;dock.hidden=true;}}
    }finally{pending=false;}
  }
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;syncFocus();void scan();});};
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('hero:game-opened',schedule);
  Auth.subscribe(state=>{
    for(const [root,entry]of records)if(entry.uid!==state.uid){
      entry.control?.remove();entry.module.closePortalGame?.(root);records.delete(root);
      if(active===entry){active=null;dock.hidden=true;document.body.style.overflow='';}
    }
  });
  schedule();
}
