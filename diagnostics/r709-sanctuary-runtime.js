(()=>{
'use strict';
if(window.SukunSanctuaryR709)return;
const B=document.body,$=id=>document.getElementById(id);
let mounted=false,unsub=null,disposed=false;
function mandala(){
 const N=28,pts=[],dots=[];
 for(let i=0;i<N;i++){
  const a=-Math.PI/2+i*2*Math.PI/N;
  pts.push([100+83*Math.cos(a),100+83*Math.sin(a)]);
  dots.push('<circle cx="'+pts[i][0].toFixed(2)+'" cy="'+pts[i][1].toFixed(2)+'" r="1.65"/>');
 }
 const lines=[];
 for(let i=0;i<N;i++){
  const j=(i+11)%N;
  lines.push('<path d="M'+pts[i][0].toFixed(2)+' '+pts[i][1].toFixed(2)+'L'+pts[j][0].toFixed(2)+' '+pts[j][1].toFixed(2)+'"/>');
 }
 return '<svg id="r709Mandala" viewBox="0 0 200 200" aria-hidden="true" focusable="false"><defs><linearGradient id="r709Gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5dea0"/><stop offset=".5" stop-color="#9c7743"/><stop offset="1" stop-color="#f2d796"/></linearGradient></defs><g fill="none" stroke="url(#r709Gold)" stroke-width=".32" opacity=".43">'+lines.join('')+'</g><g fill="none" stroke="url(#r709Gold)" stroke-width=".55" opacity=".7"><circle cx="100" cy="100" r="88"/><circle cx="100" cy="100" r="66" stroke-dasharray="1.5 2.5"/></g><g fill="#f5dea0" opacity=".88">'+dots.join('')+'</g></svg>';
}
function mount(){
 if(disposed)return false;
 const root=$('tfRefinedLayout');if(!root)return false;
 const layer=$('r706Atmosphere');if(!layer)return false;
 if(!$('r709SceneArt')){
  const art=document.createElement('div');art.id='r709SceneArt';art.setAttribute('aria-hidden','true');
  const veil=document.createElement('div');veil.id='r709SceneVeil';veil.setAttribute('aria-hidden','true');
  layer.prepend(veil);layer.prepend(art);
 }
 const ring=$('zCountVisual');
 if(ring&&!$('r709Mandala'))ring.insertAdjacentHTML('afterbegin',mandala());
 if(ring){const count=$('cntBig');const text=(count?.textContent||'').trim();ring.dataset.r709Digits=String(Math.min(6,text.length||1));}
 mounted=true;return true;
}
function reconcile(){
 if(disposed)return;
 if(!B.classList.contains('r709-sanctuary'))B.classList.add('r709-sanctuary');
 if(B.classList.contains('sukun-tefekkur-mode')){
  if(!mount()){window.SukunCanonicalTefekkur?.mount?.();window.SukunAtmosphereR706?.refresh?.();mount();}
 }
}
function boot(){
 B.classList.add('r709-sanctuary');
 const count=$('cntBig'),ring=$('zCountVisual');
 if(count&&ring&&window.MutationObserver){
  const observer=new MutationObserver(()=>{const digits=Math.min(6,(count.textContent||'').trim().length||1);if(ring.dataset.r709Digits!==String(digits))ring.dataset.r709Digits=String(digits);});
  observer.observe(count,{childList:true,characterData:true,subtree:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
 }
 unsub=window.SukunLifecycleHub?.onBodyClass?.((change)=>{
  const active=B.classList.contains('sukun-tefekkur-mode');
  if(active&&!mounted)reconcile();
 },{immediate:true});
 reconcile();
 window.addEventListener('pageshow',reconcile,{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.SukunSanctuaryR709=Object.freeze({version:'r709',mount,reconcile,snapshot:()=>({mounted,scene:!!$('r709SceneArt'),mandala:!!$('r709Mandala'),canonical:!!$('tfRefinedLayout'),audioUntouched:true})});
})();
