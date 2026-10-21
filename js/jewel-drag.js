// Original jewel artwork stays in components.css. This module only places it.
export function makeFabDraggable(fab, onMove){
  const key = 'twFab_' + fab.id;
  const slot = document.getElementById(fab.id === 'gemFloatBtn' ? 'gemParkSlot' : 'crownParkSlot');
  let active = null, moved = false;
  const scale = () => Number(window.__uiScale) || 1;
  const save = value => { try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} };
  const place = (left, top) => {
    const z = scale(), width = (fab.offsetWidth || 34) * z, height = (fab.offsetHeight || 34) * z;
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
    const bottom = nav && nav.width > innerWidth / 2 && nav.top > innerHeight / 2 ? nav.top : innerHeight;
    left = Math.max(4, Math.min(innerWidth - width - 4, Number(left) || 4));
    top = Math.max(8, Math.min(bottom - height - 8, Number(top) || 8));
    Object.assign(fab.style, {left:left/z+'px',top:top/z+'px',right:'auto',bottom:'auto'});
    if(onMove) onMove(left, top);
    return {left,top};
  };
  const park = () => {
    if(!slot) return;
    slot.appendChild(fab); fab.dataset.parked = 'true';
    for(const p of ['left','top','right','bottom']) fab.style[p] = '';
    save({parked:true});
    if(onMove) onMove();
  };
  const float = () => { delete fab.dataset.parked; document.body.appendChild(fab); };
  let previous;
  try{
    if(localStorage.getItem('hero_jewel_start') === 'remember') previous = JSON.parse(localStorage.getItem(key));
  }catch{}
  if(previous && Number.isFinite(previous.left) && Number.isFinite(previous.top)){
    float(); place(previous.left,previous.top);
  }else park();
  fab.addEventListener('pointerdown', e => {
    if(e.button !== 0 || !e.isPrimary) return;
    const r = fab.getBoundingClientRect();
    active = {id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top}; moved = false;
    fab.setPointerCapture(e.pointerId); e.preventDefault();
  });
  fab.addEventListener('pointermove', e => {
    if(!active || e.pointerId !== active.id) return;
    const dx=e.clientX-active.x, dy=e.clientY-active.y;
    if(!moved && Math.hypot(dx,dy)<6) return;
    if(!moved){ moved=true; float(); fab.setPointerCapture(e.pointerId); }
    place(active.left+dx,active.top+dy);
  });
  const finish = e => {
    if(!active || e.pointerId !== active.id) return;
    if(moved){ const r=fab.getBoundingClientRect(); save({left:r.left,top:r.top}); }
    active=null;
  };
  fab.addEventListener('pointerup',finish);
  fab.addEventListener('pointercancel',finish);
  fab.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ') moved=false;});
  window.addEventListener('hero:park-jewels',park);
  const fit = () => {
    if(fab.dataset.parked || !fab.isConnected || fab.style.display==='none') return;
    const r=fab.getBoundingClientRect(); place(r.left,r.top);
  };
  window.addEventListener('resize',fit);
  window.addEventListener('hero:scale',fit);
  // Keep reserved parking spaces consistent with existing visibility controls.
  if(slot){
    const sync = () => { slot.hidden = fab.style.display==='none' || fab.style.visibility==='hidden'; };
    new MutationObserver(sync).observe(fab,{attributes:true,attributeFilter:['style']}); sync();
  }
  return () => moved;
}
