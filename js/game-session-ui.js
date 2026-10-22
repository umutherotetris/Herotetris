// Shared presentation for the existing transports. It never decides a winner
// or changes room data; each game supplies its real connection state.
const PHASES={waiting:['Rakip bekleniyor','Davetini paylaş; rakibin katıldığında burada göreceksin.'],connecting:['Bağlanıyor','Oda bağlantısı kuruluyor.'],ready:['Oyun hazır','İki oyuncu da hazır.'],playing:['Maç sürüyor',''],reconnecting:['Bağlantı yenileniyor','Maç durumunun doğrulanması bekleniyor.'],failed:['Bağlantı kurulamadı','Yeniden deneyebilir veya oyun menüsüne dönebilirsin.'],ended:['Maç tamamlandı','']};
const labels={chess:'Satranç',tavla:'Tavla',kelime:'Kelimecik',tetris:'HeroTetris'};
function styles(){
  if(document.querySelector('link[data-session-ui]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../css/game-session-ui.css',import.meta.url).href;link.dataset.sessionUi='';document.head.append(link);
}
export function mountSessionStatus(host,options={}){
  if(!host?.appendChild)throw new TypeError('Oyun durumu kapsayıcısı gerekli');
  styles();let disposed=false,busy=false,state={phase:'waiting'};
  const box=document.createElement('section');box.className='hero-session-status';box.setAttribute('aria-label','Oda ve bağlantı durumu');
  const copy=document.createElement('div'),eyebrow=document.createElement('span'),title=document.createElement('strong'),detail=document.createElement('p');
  eyebrow.className='hero-session-game';eyebrow.textContent=labels[options.game]||'Oyun';
  title.setAttribute('role','status');title.setAttribute('aria-live','polite');detail.className='hero-session-detail';copy.append(eyebrow,title,detail);
  const controls=document.createElement('div');controls.className='hero-session-actions';
  const retry=document.createElement('button'),leave=document.createElement('button');
  retry.type=leave.type='button';retry.textContent='Yeniden dene';leave.textContent='Oyun menüsü';controls.append(retry,leave);box.append(copy,controls);host.appendChild(box);
  function update(next={}){
    if(disposed)return;
    if(next.phase&&next.phase!==state.phase){state={...state,detail:undefined,canRetry:undefined};}
    state={...state,...next};const phase=Object.hasOwn(PHASES,state.phase)?state.phase:'connecting';
    box.dataset.phase=phase;title.textContent=PHASES[phase][0];detail.textContent=typeof state.detail==='string'?state.detail:PHASES[phase][1];detail.hidden=!detail.textContent;
    retry.hidden=typeof options.onRetry!=='function'||!['failed','reconnecting'].includes(phase)||state.canRetry===false;
    leave.hidden=typeof options.onLeave!=='function'||!['failed','waiting','ended'].includes(phase);controls.hidden=retry.hidden&&leave.hidden;
  }
  const action=async(kind,control)=>{
    if(disposed||busy||control.hidden||typeof options[kind]!=='function')return;
    busy=true;control.disabled=true;
    try{await options[kind]();}
    catch(_){if(!disposed)update({phase:'failed',detail:'İşlem tamamlanamadı. Yeniden deneyebilirsin.'});}
    finally{busy=false;if(!disposed)control.disabled=false;}
  };
  const retryFn=()=>action('onRetry',retry),leaveFn=()=>action('onLeave',leave);retry.addEventListener('click',retryFn);leave.addEventListener('click',leaveFn);
  let observer;
  function destroy(){if(disposed)return;disposed=true;observer?.disconnect();retry.removeEventListener('click',retryFn);leave.removeEventListener('click',leaveFn);box.remove();}
  if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>{if(!box.isConnected)destroy();});observer.observe(document.body,{childList:true,subtree:true});}
  update(options.initial||{});return{update,destroy,element:box};
}
export {PHASES as SESSION_PHASES};
