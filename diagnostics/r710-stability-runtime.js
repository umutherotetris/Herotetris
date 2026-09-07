(()=>{
'use strict';
if(window.SukunR710Stability)return;
const B=document.body;
let errors=0,lastError='',lastAt=0;
const clean=s=>String(s??'').slice(0,400);
const onError=e=>{errors++;lastError=clean(e.reason?.message||e.message||e.reason||'runtime');lastAt=Date.now()};
window.addEventListener('error',onError,{passive:true});
window.addEventListener('unhandledrejection',onError,{passive:true});
function mount(){B.classList.add('r710-sanctuary');}
function safe(fn){try{return fn()}catch(e){return null}}
function snapshot(){return Object.freeze({
 version:'r710',build:document.querySelector('meta[name="sukun-build"]')?.content||'',
 errors,lastError,lastAt,
 physical:safe(()=>window.SukunR693Integrity?.physical?.()),
 terminal:safe(()=>window.SukunR693Integrity?.snapshot?.()),
 truth:safe(()=>window.SukunAudioTruth?.snapshot?.()),
 transport:safe(()=>window.SukunR698Transport?.snapshot?.()),
 taps:safe(()=>window.SukunR688TapAuthority?.snapshot?.()),
 layout:safe(()=>window.SukunR699Layout?.snapshot?.()),
 atmosphere:safe(()=>window.SukunAtmosphereR706?.snapshot?.())
});}
window.SukunR710Stability=Object.freeze({version:'r710',snapshot,refresh:()=>{mount();window.SukunR699Layout?.schedule?.('r710-refresh');return true}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
