
(()=>{
'use strict';
if(window.SukunR699Layout)return;
const VERSION='r707', $=id=>document.getElementById(id), clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const root=document.documentElement, B=document.body;
const KEY='sukun.dockY.r633';
let stateSig='',y=0,raf=0,last=null,reason='boot',measures=0,coalesced=0,ro=null,drag=null,quietUntil=0,deferred=false,resizeTimer=0,modeLast='',drawerLast=false,detailsLast=false,anchorLast='',scrollResets=0,rehomeCount=0,violations=0;
try{y=clamp(Number(localStorage.getItem(KEY))||0,-900,240)}catch(_){}
const safe=(fn,fallback)=>{try{return fn()}catch(_){return fallback}};
const visible=e=>{if(!e||e.hidden)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>.01&&r.width>1&&r.height>1};
const rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right}:null};
const px=n=>Math.round(n*10)/10+'px';
// r706: local style guard, no browser prototype patching.
function r706Style(style,key,value,priority=''){if(!style)return;value=String(value);if(style.getPropertyValue(key)!==value||(style.getPropertyPriority?.(key)||'')!==priority)style.setProperty(key,value,priority)}
function mode(){return B.classList.contains('r588-mode-max')?'max':B.classList.contains('r588-mode-midi')?'midi':'mini'}
function viewport(){const v=window.visualViewport;const layoutH=root.clientHeight||innerHeight;const top=v?.offsetTop||0,height=v?.height||innerHeight;return{top,height,bottom:top+height,width:v?.width||innerWidth,layoutH};}
function safeBottom(){let p=$('r633SafeProbe');if(!p){p=document.createElement('i');p.id='r633SafeProbe';p.setAttribute('aria-hidden','true');p.style.cssText='position:fixed;left:-9999px;bottom:0;width:1px;height:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';B.appendChild(p)}return parseFloat(getComputedStyle(p).paddingBottom)||0}
function reserve(v){let n=Math.max(8,safeBottom()+8);for(const e of document.querySelectorAll('#r616BottomNav,.sukun-bottom-nav')){if(!visible(e))continue;const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(['fixed','sticky'].includes(s.position)&&r.bottom>=v.bottom-24&&r.top<v.bottom)n=Math.max(n,v.bottom-r.top+8)}return n}
function ensure(){const shell=$('r588DockShell'),host=$('r170Now');if(!shell||!host)return false;if(!B.classList.contains('r699-layout'))B.classList.add('r699-layout');if(!B.classList.contains('r707-scroll'))B.classList.add('r707-scroll');let grip=$('r633DockGrip');if(!grip){grip=document.createElement('button');grip.id='r633DockGrip';grip.type='button';grip.innerHTML='<span aria-hidden="true"></span><small aria-hidden="true">↕</small><span class="r697GripLabel" aria-hidden="true">Tut ve sürükle</span>';shell.insertBefore(grip,shell.firstChild)}if(grip.getAttribute('aria-label')!=='Akış barını sürükle. Yön tuşlarıyla da taşıyabilirsin.')grip.setAttribute('aria-label','Akış barını sürükle. Yön tuşlarıyla da taşıyabilirsin.');grip.title='Tut ve sürükle · Yön tuşlarıyla taşı';if(!grip.dataset.r699Bound){grip.dataset.r699Bound='1';bindGrip(grip)}
 let body=$('r659DockBody'),footer=shell.querySelector(':scope > .r588Mode');if(!body){body=document.createElement('div');body.id='r659DockBody';body.dataset.r659Scroll='1';shell.insertBefore(body,footer||null)}
 const stray=[...shell.children].filter(e=>e!==grip&&e!==body&&e!==footer);if(stray.length){stray.forEach(e=>body.appendChild(e));rehomeCount+=stray.length}if(shell.firstElementChild!==grip)shell.insertBefore(grip,shell.firstChild);if(footer&&shell.lastElementChild!==footer)shell.appendChild(footer);
 if(!host.dataset.r699Ready){host.dataset.r699Ready='1';}
 return true}
function save(){safe(()=>localStorage.setItem(KEY,String(Math.round(y*10)/10)),null)}
function setY(n,persist=false){y=Number.isFinite(+n)?+n:0;r706Style(root.style,'--r699-y',px(y));r706Style(root.style,'--r633-dock-y',px(y));r706Style($('r170Now')?.style,'--r633-dock-y',px(y));if(B.classList.contains('r699-dock-active')){const h=parseFloat(root.style.getPropertyValue('--r699-host-h'))||0,b=parseFloat(root.style.getPropertyValue('--r699-bottom'))||0;if(h){const v=viewport(),surface=h+b-y+12,content=surface-(v.layoutH-v.bottom);r706Style(root.style,'--r699-surface-bottom',px(surface));r706Style(root.style,'--r699-content-reserve',px(content));r706Style(root.style,'--r659-wrap-reserve',px(content));}}if(persist)save();return y}
function readingReserve(v,bottom){
 if(!B.classList.contains('sukun-tefekkur-mode')||B.classList.contains('r699-drawer-open'))return 0;
 const cap=Math.max(1,v.height-bottom-16);
 return Math.max(0,Math.min(420,Math.floor(v.height*.5),cap-120));
}
function setBounds(v,bottom,hostH){const capBottom=v.bottom-bottom,top=v.top+8+readingReserve(v,bottom);return{min:Math.min(0,top-(capBottom-hostH)),max:0,top,bottom:capBottom,cap:Math.max(1,capBottom-top)}}
function applyPosition(v,bottom,hostH,desiredY=y){const bounds=setBounds(v,bottom,hostH);const n=clamp(desiredY,bounds.min,bounds.max);setY(n,false);return bounds}
function bindGrip(grip){
 const finish=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;B.classList.remove('r633-dock-dragging');$('r170Now')?.classList.remove('r633-dragging');safe(()=>grip.releasePointerCapture(e.pointerId),null);quietUntil=performance.now()+120;save();schedule('drag-end');if(moved)grip.dataset.r699SuppressClick='1';setTimeout(()=>{delete grip.dataset.r699SuppressClick},350)};
 grip.addEventListener('pointerdown',e=>{if(e.isPrimary===false||e.pointerType==='mouse'&&e.button!==0)return;const h=$('r170Now');if(!visible(h))return;const v=viewport(),r=h.getBoundingClientRect(),bottom=reserve(v);drag={id:e.pointerId,start:e.clientY,y,moved:false,bounds:setBounds(v,bottom,r.height)};B.classList.add('r633-dock-dragging');h.classList.add('r633-dragging');safe(()=>grip.setPointerCapture(e.pointerId),null)});
 grip.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dy=e.clientY-drag.start;if(Math.abs(dy)>3)drag.moved=true;if(!drag.moved)return;e.preventDefault();setY(clamp(drag.y+dy,drag.bounds.min,drag.bounds.max),false)},{passive:false});
 grip.addEventListener('pointerup',finish);grip.addEventListener('pointercancel',finish);grip.addEventListener('lostpointercapture',finish);
 grip.addEventListener('click',e=>{if(grip.dataset.r699SuppressClick){e.preventDefault();e.stopImmediatePropagation()}},true);
 grip.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const h=$('r170Now');if(!visible(h))return;const v=viewport(),b=setBounds(v,reserve(v),h.getBoundingClientRect().height);let n=e.key==='Home'?b.min:e.key==='End'?b.max:y+(e.key==='ArrowUp'?-1:1)*(e.shiftKey?80:28);setY(clamp(n,b.min,b.max),true);schedule('keyboard-grip')});
}
function naturalHeight(shell,body,footer,grip){
 const cs=getComputedStyle(shell),pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0),gap=parseFloat(cs.rowGap)||0;
 const gh=grip?.getBoundingClientRect().height||0,fh=footer?.getBoundingClientRect().height||0;
 // Measure intrinsic content, not the height left over by an old fixed grid.
 let bh=body?.scrollHeight||0;
 if(body){const r=body.getBoundingClientRect();for(const child of body.children){const c=getComputedStyle(child);if(c.display==='none'||c.position==='absolute'||c.position==='fixed')continue;const cr=child.getBoundingClientRect();bh=Math.max(bh,cr.bottom-r.top+body.scrollTop+(parseFloat(c.marginBottom)||0));}}
 return Math.ceil(pad+gh+fh+Math.max(0,bh)+gap*2);
}
function clearLegacy(){
 // Current r699 dimensions stay installed while intrinsic content is measured.
 for(const k of ['--r662-exact-fill','--r671-zcard-h','--r680-max-host-h'])if(root.style.getPropertyValue(k))root.style.removeProperty(k);
 const h=$('r170Now');if(h?.style.getPropertyValue('--r659-dock-fit-h'))h.style.removeProperty('--r659-dock-fit-h');
 if(root.classList.contains('r680-max-doc-lock'))root.classList.remove('r680-max-doc-lock');
 for(const k of ['r680-max-surface','r698-max-overflow','r659-bottom-fit','r662-converging','r662-body-scroll','r671-boundary-authority','r660-dock-tight','r660-dock-roomy'])if(B.classList.contains(k))B.classList.remove(k);
 if(!B.classList.contains('r660-dock-compact'))B.classList.add('r660-dock-compact');
}

let modalTrigger=null,modalKind='',focusGuard=false,modalShellState=null;
function modalBackdrop(){let e=$('r699ModalBackdrop');if(!e){e=document.createElement('div');e.id='r699ModalBackdrop';e.hidden=true;e.setAttribute('aria-hidden','true');B.appendChild(e);e.addEventListener('click',()=>window.SukunAlertCenter?.close?.())}return e}
function modalSync(){
 const drawer=$('r554AlertDrawer'),open=!!drawer&&!drawer.hidden&&$('r170Now')?.classList.contains('r554-alert-open');
 const back=modalBackdrop();back.hidden=!open;B.classList.toggle('r699-drawer-open',open);
 const shell=$('r588DockShell');if(shell){
  if(open&&!modalShellState){modalShellState={inert:shell.inert,aria:shell.getAttribute('aria-hidden')};shell.inert=true;shell.setAttribute('aria-hidden','true')}
  else if(!open&&modalShellState){shell.inert=modalShellState.inert;if(modalShellState.aria===null)shell.removeAttribute('aria-hidden');else shell.setAttribute('aria-hidden',modalShellState.aria);modalShellState=null}
 }
 if(open){if(modalKind!=='drawer'){modalTrigger=document.activeElement;modalKind='drawer';try{window.SukunDockDetails?.close?.()}catch(_){ }setTimeout(()=>drawer.querySelector('#r554DrawerClose')?.focus({preventScroll:true}),0)}drawer.setAttribute('role','dialog');drawer.setAttribute('aria-modal','true');drawer.setAttribute('aria-label','Akış bildirimleri')}
 else if(modalKind==='drawer'){modalKind='';try{modalTrigger?.isConnected&&modalTrigger.focus?.({preventScroll:true})}catch(_){ }modalTrigger=null}
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!e.defaultPrevented){if($('r554AlertDrawer')&&!$('r554AlertDrawer').hidden){e.preventDefault();window.SukunAlertCenter?.close?.();return}if(B.classList.contains('r434-inline-details-open')){e.preventDefault();window.SukunDockDetails?.close?.();return}}
 if(e.key!=='Tab'||!B.classList.contains('r699-drawer-open'))return;
 const d=$('r554AlertDrawer'),items=[...d.querySelectorAll('button:not(:disabled):not([hidden]),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter(visible);if(!items.length)return;
 const first=items[0],lastItem=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!d.contains(document.activeElement))){e.preventDefault();lastItem.focus()}else if(!e.shiftKey&&(document.activeElement===lastItem||!d.contains(document.activeElement))){e.preventDefault();first.focus()}
},true);

function measure(why='api'){
 measures++;reason=why;if(!ensure())return null;
 const host=$('r170Now'),shell=$('r588DockShell'),body=$('r659DockBody'),footer=shell.querySelector(':scope > .r588Mode'),grip=$('r633DockGrip');const v=viewport(),bottom=reserve(v),m=mode(),tef=B.classList.contains('sukun-tefekkur-mode'),drawer=host.classList.contains('r554-alert-open')&&!($('r554AlertDrawer')?.hidden),hidden=B.classList.contains('r433-dock-hidden')||!B.classList.contains('r431-dock-visible')||!B.classList.contains('r591-flow-active');
 r706Style(root.style,'--r633-dock-bottom',px(v.layoutH-v.bottom+bottom));r706Style(root.style,'--r699-bottom',px(v.layoutH-v.bottom+bottom));r706Style(root.style,'--r633-max-h',px(Math.max(1,v.height-bottom-16)));r706Style(root.style,'--r633-vvh',px(v.height));r706Style(root.style,'--r633-safe-top',px(v.top+8));r706Style(root.style,'--r699-top',px(v.top+8));r706Style(root.style,'--r699-viewport-h',px(v.height));r706Style(root.style,'--r699-available',px(Math.max(1,v.height-bottom-16)));
 clearLegacy();modalSync();B.classList.toggle('r699-drawer-open',drawer);B.classList.toggle('r699-details-open',B.classList.contains('r434-inline-details-open'));
 if(hidden){B.classList.remove('r699-keyboard-compact');if(drawer){safe(()=>window.SukunAlertCenter?.close?.(),null);modalSync()}B.classList.remove('r699-dock-active','r699-body-scroll','r699-overflow');r706Style(root.style,'--r699-content-reserve',px(visible($('r433DockPeek'))?$('r433DockPeek').getBoundingClientRect().height+bottom+12:bottom+12));r706Style(root.style,'--r699-surface-bottom',px(v.layoutH-v.bottom+parseFloat(root.style.getPropertyValue('--r699-content-reserve'))));r706Style(root.style,'--r659-wrap-reserve',px(0));r706Style(root.style,'--r660-peek-reserve',px(visible($('r433DockPeek'))?$('r433DockPeek').getBoundingClientRect().height+bottom+8:62));last={version:VERSION,reason,active:false,hidden:true,mode:m,viewportHeight:v.height,measureCount:measures,rehomeCount,scrollResets};return last}
 B.classList.add('r699-dock-active');
 const changedMode=modeLast!==m;if(changedMode)modeLast=m; // Native scroll clamps only if the new content is shorter.
 const priorScrollTop=body.scrollTop;const cap=Math.max(1,v.height-bottom-16);let need=0,desired=0;const keyboardCompact=v.height<280||(v.height<360&&!!document.activeElement?.matches?.('input,textarea,select,[contenteditable=true]')&&!host.contains(document.activeElement));B.classList.toggle('r699-keyboard-compact',keyboardCompact);
 if(keyboardCompact&&!drawer){need=58;desired=Math.min(cap,58)}else if(drawer){need=Math.max(350,Math.ceil(v.height*.75));desired=Math.min(cap,Math.max(350,Math.min(650,need)));}
 else{
  B.classList.add('r699-measuring');
  need=naturalHeight(shell,body,footer,grip);
  B.classList.remove('r699-measuring');
  let profile=m==='mini'?Math.min(cap,Math.max(180,v.height*(tef?.32:.40))):m==='midi'?Math.min(cap,Math.max(240,v.height*(tef?.46:.60))):cap;
  // Short landscape screens must retain a usable reading area even in Max.
  if(v.height<480&&v.width>v.height)profile=Math.min(profile,Math.max(160,Math.floor(v.height*.60)));
  desired=Math.min(need,profile,cap);
  const fixed=Math.ceil((grip?.getBoundingClientRect().height||0)+(footer?.getBoundingClientRect().height||0)+18);
  desired=Math.max(Math.min(cap,fixed+40),desired);
  // Reserve the reading surface in every Tefekkür size, including dragged Max.
  if(tef)desired=Math.min(desired,Math.max(1,cap-readingReserve(v,bottom)));
 }
 desired=Math.min(cap,Math.max(1,Math.ceil(desired)));r706Style(root.style,'--r699-host-h',px(desired));r706Style(root.style,'--r659-dock-fit-h',px(desired));r706Style(root.style,'--r659-dock-max-h',px(cap));r706Style(root.style,'--r659-dock-min-h',px(0));r706Style(root.style,'--r662-intrinsic',px(need));r706Style(host.style,'height',px(desired),'important');r706Style(host.style,'min-height','0px','important');r706Style(host.style,'max-height',px(cap),'important');
 const bounds=applyPosition(v,bottom,desired,y);const free=y<-5;
 const reservePx=desired+bottom-y+12;r706Style(root.style,'--r699-content-reserve',px(reservePx));r706Style(root.style,'--r699-surface-bottom',px(v.layoutH-v.bottom+reservePx));r706Style(root.style,'--r659-wrap-reserve',px(reservePx));r706Style(root.style,'--r660-peek-reserve',px(62+bottom));
 const actualOverflow=!drawer&&body.scrollHeight>body.clientHeight+2;
 B.classList.toggle('r699-body-scroll',actualOverflow);B.classList.toggle('r699-overflow',actualOverflow);
 // Preserve the user's reading position across a mode switch; let native bounds clamp it.
 if(changedMode&&!drag&&Math.abs(body.scrollTop-priorScrollTop)>.5)body.scrollTop=Math.min(priorScrollTop,Math.max(0,body.scrollHeight-body.clientHeight));
 // Max is not a document lock. The zikir surface may scroll naturally behind the fixed player.
 const card=document.querySelector('#tab-zkr>.card.zCtl');let boundaryTop=null,cardH=0;
 if(tef&&visible(card)){
  const r=card.getBoundingClientRect();boundaryTop=Math.min(v.bottom-2,host.getBoundingClientRect().top-8);cardH=Math.max(0,Math.floor(boundaryTop-v.top));
  r706Style(root.style,'--r699-card-budget',px(cardH));
 }else root.style.removeProperty('--r699-card-budget');
 const dm=$('r554DrawerList'),scrollable=!!dm&&dm.scrollHeight>dm.clientHeight+2;
 last={version:VERSION,reason,active:true,bottomFit:!free,hidden:false,mode:m,density:'compact',viewportTop:v.top,viewportHeight:v.height,viewportBottom:v.bottom,appliedHeight:desired,intrinsicNeed:need,naturalCap:cap,profileCap:cap,maxHeight:cap,minHeight:0,rawGap:Math.max(0,cap-desired),rawAvailableHeight:cap,overlayPx:0,unusedGapPx:Math.max(0,cap-desired),exactFillPx:Math.max(0,cap-need),wrapReserve:reservePx,bodyOverflowPx:Math.max(0,body.scrollHeight-body.clientHeight),bodyScrollTop:body.scrollTop,drawerOpen:drawer,drawerClientHeight:dm?.clientHeight||0,drawerScrollHeight:dm?.scrollHeight||0,drawerMaxScroll:Math.max(0,(dm?.scrollHeight||0)-(dm?.clientHeight||0)),drawerScrollable:scrollable,bottomReachable:!drawer||!!dm&&dm.clientHeight>0,lastY:y,cardHeight:cardH,boundaryTop,measureCount:measures,rehomeCount,scrollResets,rafCoalesced:coalesced,resizeEvents:0,layoutSyncs:measures,convergence:0,panActive:!!drag,gestureDeferrals:0,viewportScrollIgnored:0,geometryDebounces:0,viewportDebounces:0,at:Date.now()};
 return last;
}
function schedule(why='event'){reason=why;if(document.hidden)return;if(drag){deferred=true;return}if(raf){coalesced++;return}raf=requestAnimationFrame(()=>{raf=0;measure(reason)})}
function reset(announce=false){setY(0,true);schedule('reset');if(announce)safe(()=>window.toast?.('Akış barı güvenli konuma alındı ↕'),null);return true}
function reflow(why='reflow'){return measure(why)}
function boundary(){const c=document.querySelector('#tab-zkr>.card.zCtl');return{version:VERSION,cardHeight:last?.cardHeight||0,boundaryTop:last?.boundaryTop||0,kind:last?.active?'dock':'none',gap:8,measures};}
function bind(){if(ro)ro.disconnect();if(!window.ResizeObserver)return;ro=new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>schedule('geometry-resize'),100)});for(const e of [$('r588DockShell')?.querySelector('.r588Mode'),...document.querySelectorAll('#r659DockBody > *'),$('r554AlertDrawer'),$('r434InlineDetails')])if(e)safe(()=>ro.observe(e),null)}
const placement=Object.freeze({version:VERSION,reflow,reset,getY:()=>y,set:(n,persist=true)=>{const v=viewport(),b=setBounds(v,reserve(v),$('r170Now')?.getBoundingClientRect().height||0);setY(clamp(n,b.min,b.max),persist);schedule('placement-set');return y},bounds:()=>{const v=viewport();return setBounds(v,reserve(v),$('r170Now')?.getBoundingClientRect().height||0)},snapshot:()=>({version:VERSION,y,bottom:parseFloat(root.style.getPropertyValue('--r633-dock-bottom'))||0,visible:visible($('r170Now')),rect:rect($('r170Now')),viewport:viewport(),reason,dragging:!!drag})});
const adaptive=Object.freeze({version:VERSION,schedule,measure:()=>measure('api'),reflow,isPanning:()=>!!drag||performance.now()<quietUntil,snapshot:()=>last||measure('snapshot'),rebind:()=>{ensure();bind();schedule('rebind')}});
window.SukunFlowDockPlacement=placement;window.SukunAdaptiveDockLayout=adaptive;
const boundaryApi=Object.freeze({version:VERSION,measure:()=>measure('boundary'),schedule,snapshot:boundary});window.SukunBoundaryR671=window.SukunBoundaryR672=window.SukunBoundaryR673=boundaryApi;
window.SukunR680=Object.freeze({version:VERSION,refresh:()=>measure('max-refresh'),snapshot:()=>({version:VERSION,active:!!last?.active&&mode()==='max',height:last?.appliedHeight||0,naturalNeed:last?.intrinsicNeed||0,safeMax:last?.maxHeight||0,syncs:measures})});
window.SukunR679=Object.freeze({version:VERSION,refresh:()=>schedule('max-refresh'),snapshot:()=>({version:VERSION,max:mode()==='max',syncs:measures,dock:last,placement:placement.snapshot()})});
window.SukunR673Layout=Object.freeze({version:VERSION,refresh:schedule});
window.SukunR699Layout=Object.freeze({version:VERSION,measure,schedule,reset,ensure,setY,bounds:()=>{const v=viewport();return setBounds(v,reserve(v),$('r170Now')?.getBoundingClientRect().height||0)},snapshot:()=>last,viewport,visible,rect,boundary});
const events=['sukun:r616viewchange','sukun:r698modechange','sukun:alertdrawerchange','sukun:playbackchange','sukun:currentflowchange','sukun:currentzikirchange','sukun:zikirtransaction','sukun:zikirnav','sukun:zikirrestart','sukun:miniflowglasschange','sukun:authoritychange','sukun:journey-advance','sukun:mediasessionwakeguard','pageshow'];events.forEach(ev=>window.addEventListener(ev,()=>schedule(ev),{passive:true}));
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>schedule('resize'),100)},{passive:true});window.visualViewport?.addEventListener?.('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>schedule('viewport-resize'),100)},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule('visible')},{passive:true});
document.addEventListener('click',e=>{if(e.target.closest?.('#r554DockReset')){reset(false);return;}if(e.target.closest?.('[data-r588-mode],#r588Hide,#r433DockPeek,#r588Details,#r433DetailBtn,#tefExitBtn,#r442TefekkurBtn'))setTimeout(()=>schedule('control'),35)},{passive:true});
const classObserver=new MutationObserver(()=>{const sig=[mode(),B.classList.contains('r433-dock-hidden'),B.classList.contains('r591-flow-active'),B.classList.contains('sukun-tefekkur-mode'),$('r170Now')?.classList.contains('r554-alert-open'),B.classList.contains('r434-inline-details-open')].join('|');if(sig!==stateSig){stateSig=sig;schedule('state-change')}});
classObserver.observe(B,{attributes:true,attributeFilter:['class']});const observeHost=()=>{const h=$('r170Now');if(h)classObserver.observe(h,{attributes:true,attributeFilter:['class']})};observeHost();
const boot=()=>{if(!ensure())return;bind();schedule('boot');setTimeout(()=>schedule('settled'),250)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

