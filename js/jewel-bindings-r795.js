/* SÜKÛN r795 — visual component binder. Uses existing r656 hydration bus; no new broad MutationObserver. */
(()=>{'use strict';
 const V='r795';
 const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
 const add=(el,...cls)=>{if(el)el.classList.add(...cls.filter(Boolean));return el};
 const button=(id,kind='secondary',variant='')=>{
   const el=document.getElementById(id);if(!el)return;
   add(el,'jewel-btn',`jewel-btn--${kind}`);if(variant)add(el,`jewel-btn--${variant}`);
 };
 function bind(root=document){
   document.documentElement.classList.add('sukun-jewel-ui');
   document.body?.classList.add('sukun-jewel-ui');

   qa('.zCounterSide',root===document?document:root).forEach(el=>add(el,'jewel-stat'));
   button('undoBtn','round','minus');button('plusBtn','round','plus');button('autoBtn','primary');button('resetBtn','secondary');
   qa('#r616ZikirNavRow button').forEach(el=>add(el,'jewel-btn','jewel-btn--secondary'));

   const zbar=document.getElementById('zBar');if(zbar){add(zbar,'jewel-toolbar');qa('.spkBtn',zbar).forEach(el=>add(el,'jewel-btn','jewel-btn--compact'));
     add(document.getElementById('niyetRecBtn'),'jewel-btn--compact-gold');
     add(document.getElementById('zBarHelp'),'jewel-btn--compact-emerald');
   }
   button('r442TefekkurBtn','primary');

   ['berhetSeyir','esmaSeyir99'].forEach(id=>{
     const box=document.getElementById(id);if(!box)return;add(box,'jewel-journey','jewel-panel');
     const head=q(':scope>summary',box);if(head)add(head,'jewel-card');
     qa('.r168MiniRow select,.r168MiniRow input',box).forEach(el=>add(el,'jewel-select'));
     qa('.r168Progress',box).forEach(el=>add(el,'jewel-progress'));
     qa('.r168Status',box).forEach(el=>add(el,'jewel-pill'));
   });
   [['bsStart','primary'],['bsPrev','secondary'],['bsNext','secondary'],['bsAgain','secondary'],['bsStop','secondary'],['bsReset','primary'],
    ['es99Start','primary'],['es99Prev','secondary'],['es99Next','secondary'],['es99Again','secondary'],['es99Stop','secondary'],['es99Reset','primary']].forEach(x=>button(x[0],x[1]));
   add(document.getElementById('bsStop'),'jewel-btn--amethyst');add(document.getElementById('es99Stop'),'jewel-btn--amethyst');

   const ctx=document.getElementById('r754SeyirContext');if(ctx)add(ctx,'jewel-context');
   qa('.r754Ctx').forEach(el=>add(el,'jewel-context'));

   qa('#zMegaHost>.zMegaGroup').forEach(el=>add(el,'jewel-accordion'));
   ['r679ZikirAyarBox','niyetBox','vhBox'].forEach(id=>add(document.getElementById(id),'jewel-accordion'));
   add(document.getElementById('r433DockPeek'),'jewel-player');
 }
 function initial(){bind(document);requestAnimationFrame(()=>bind(document));setTimeout(()=>bind(document),180)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initial,{once:true});else initial();
 window.addEventListener('sukun:domhydrate',e=>{try{for(const r of e?.detail?.roots||[])bind(r);bind(document)}catch(_){bind(document)}},{passive:true});
 window.addEventListener('sukun:tab-change',()=>requestAnimationFrame(()=>bind(document)),{passive:true});
 window.addEventListener('pageshow',()=>requestAnimationFrame(()=>bind(document)),{passive:true});
 window.SukunJewelUIR795=Object.freeze({version:V,mode:'component-system',bind:()=>bind(document),snapshot:()=>({version:V,body:document.body?.classList.contains('sukun-jewel-ui')||false,journeys:qa('.jewel-journey').length,buttons:qa('.jewel-btn').length,accordions:qa('.jewel-accordion').length,toolbar:!!document.querySelector('#zBar.jewel-toolbar')})});
})();
