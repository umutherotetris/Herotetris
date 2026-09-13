/* SÜKÛN r796 — DOM-to-component authority. Narrow observers only. */
(()=>{'use strict';
 if(window.SukunJewelUIR796)return;
 const V='r796', $=id=>document.getElementById(id), qa=(s,r=document)=>[...r.querySelectorAll(s)];
 let busy=false;
 function cls(el,...names){if(el)names.forEach(n=>n&&el.classList.add(n));return el}
 function normalizeAuto(){
   const a=$('autoBtn');if(!a)return;
   cls(a,'j796-btn','j796-primary');
   const txt=(a.textContent||'').toLowerCase();
   a.classList.toggle('is-paused',/duraklat|sürdür/.test(txt));
 }
 function reorderMain(){
   const ctl=document.querySelector('.card.zCtl'),row=document.querySelector('.zCounterRow'),actions=document.querySelector('.zCounterActions'),nav=$('r616ZikirNavRow'),sub=$('cntSub'),settings=$('r679ZikirAyarBox');
   if(!ctl||!row)return;
   try{
     if(actions&&actions.parentElement===ctl&&row.nextElementSibling!==actions)row.insertAdjacentElement('afterend',actions);
     if(nav&&nav.parentElement===ctl&&actions&&actions.nextElementSibling!==nav)actions.insertAdjacentElement('afterend',nav);
     if(sub&&sub.parentElement===ctl&&nav&&nav.nextElementSibling!==sub)nav.insertAdjacentElement('afterend',sub);
     if(settings&&settings.parentElement===ctl&&sub&&sub.nextElementSibling!==settings)sub.insertAdjacentElement('afterend',settings);
   }catch(e){}
 }
 function bind(){
   if(busy)return;busy=true;
   try{
     document.documentElement.classList.add('sukun-jewel-r796');document.body?.classList.add('sukun-jewel-r796');
     // Main fixed selectors do not need classes, but semantic classes are useful for diagnostics.
     qa('.zCounterSide').forEach(e=>cls(e,'j796-stat'));
     ['undoBtn','plusBtn','autoBtn'].forEach(id=>cls($(id),'j796-control'));
     normalizeAuto();
     qa('#r616ZikirNavRow button').forEach(e=>cls(e,'j796-nav-btn'));
     const bar=$('zBar');if(bar){cls(bar,'j796-toolbar');qa('.spkBtn',bar).forEach(e=>cls(e,'j796-tool-btn'))}
     cls($('r442TefekkurBtn'),'j796-primary');
     ['berhetSeyir','esmaSeyir99'].forEach(id=>{
       const box=$(id);if(!box)return;cls(box,'j796-journey');
       qa('.r168MiniRow label',box).forEach(e=>cls(e,'j796-field-card'));
       qa('.r168Progress',box).forEach(e=>cls(e,'j796-progress'));
       qa('.r168Status',box).forEach(e=>cls(e,'j796-status'));
       qa('.r168Buttons button',box).forEach(e=>cls(e,'j796-journey-btn'));
     });
     cls($('r754SeyirContext'),'j796-context');qa('.r754Ctx').forEach(e=>cls(e,'j796-context'));
     qa('#zMegaHost>.zMegaGroup').forEach(e=>cls(e,'j796-accordion'));
     cls($('r679ZikirAyarBox'),'j796-settings');cls($('r433DockPeek'),'j796-player');
     reorderMain();
   }finally{busy=false}
 }
 function queue(){if(busy)return;requestAnimationFrame(bind)}
 function observe(root){if(!root||root.__j796Obs)return;root.__j796Obs=1;new MutationObserver(queue).observe(root,{childList:true,subtree:true})}
 function init(){bind();['tab-zkr','zStage','zMegaHost'].forEach(id=>observe($(id)));setTimeout(()=>{bind();['tab-zkr','zStage','zMegaHost'].forEach(id=>observe($(id)))},220)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
 ['sukun:domhydrate','sukun:tabchange','sukun:tab-change','sukun:currentzikirchange','sukun:journey-advance','sukun:currentflowchange'].forEach(ev=>window.addEventListener(ev,queue,{passive:true}));
 window.addEventListener('pageshow',queue,{passive:true});
 window.SukunJewelUIR796=Object.freeze({version:V,bind,snapshot:()=>({version:V,body:!!document.body?.classList.contains('sukun-jewel-r796'),stats:qa('.j796-stat').length,tools:qa('.j796-tool-btn').length,journeys:qa('.j796-journey').length,accordions:qa('.j796-accordion').length,context:qa('.j796-context').length})});
})();
