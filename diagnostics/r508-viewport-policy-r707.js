
(()=>{
'use strict';
if(window.SukunViewportPolicy?.version==='r508')return;

const nativeScrollIntoView=Element.prototype.scrollIntoView;
let suppressUntil=0,suppressReason='';
let explicitDepth=0;
let userIntentUntil=0,userReason='';
let blocked=0,allowed=0,last=null;

const now=()=>performance.now();
const markUser=reason=>{
  userIntentUntil=now()+1250;
  userReason=reason||'user';
};

document.addEventListener('pointerdown',()=>markUser('pointer'),{capture:true,passive:true});
document.addEventListener('touchstart',()=>markUser('touch'),{capture:true,passive:true});
document.addEventListener('keydown',e=>{
  if(['Enter',' ','Spacebar','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    markUser('keyboard');
  }
},{capture:true,passive:true});

function suppress(ms=500,reason='background-flow'){
  const until=now()+Math.max(0,+ms||0);
  if(until>suppressUntil){
    suppressUntil=until;
    suppressReason=String(reason||'background-flow');
  }
  return suppressUntil;
}
function allow(fn,reason='explicit'){
  explicitDepth++;
  try{return typeof fn==='function'?fn():undefined}
  finally{
    explicitDepth=Math.max(0,explicitDepth-1);
    last={type:'allow-scope',reason:String(reason),at:Date.now()};
  }
}
function shouldAllow(el){
  const t=now();
  if(explicitDepth>0)return{ok:true,reason:'explicit'};
  if(t<userIntentUntil)return{ok:true,reason:userReason||'user'};
  if(t<suppressUntil)return{ok:false,reason:suppressReason||'suppressed'};
  if(el?.closest?.('[data-sukun-scroll="allow"]'))return{ok:true,reason:'element-allow'};
  return{ok:false,reason:'background'};
}
function describe(el){
  if(!el)return'—';
  if(el.id)return'#'+el.id;
  const cls=[...el.classList||[]].slice(0,2).join('.');
  return(el.tagName||'EL').toLowerCase()+(cls?'.'+cls:'');
}

/* Projedeki eski scrollIntoView çağrılarının tamamı artık tek politikadan geçer.
   Kullanıcı eylemine bağlı kaydırma korunur; background state/render kaydırması engellenir. */
Element.prototype.scrollIntoView=function(arg){
  const d=shouldAllow(this);
  if(!d.ok){
    blocked++;
    last={type:'blocked',reason:d.reason,target:describe(this),at:Date.now()};
    try{
      window.dispatchEvent(new CustomEvent('sukun:scrollblocked',{detail:{...last}}));
    }catch(e){}
    return;
  }
  allowed++;
  last={type:'allowed',reason:d.reason,target:describe(this),at:Date.now()};
  return nativeScrollIntoView.call(this,arg);
};

function preserve(fn,opt={}){
  const anchor=opt.anchor?.isConnected?opt.anchor:null;
  const anchorTop=anchor?anchor.getBoundingClientRect().top:null;
  const y=window.scrollY||document.documentElement.scrollTop||0;
  const ms=Math.max(120,+opt.ms||520);
  suppress(ms,opt.reason||'preserve-scroll');
  const intentAtStart=userIntentUntil;

  const restore=()=>{
    if(userIntentUntil>intentAtStart)return;
    if(anchor?.isConnected&&Number.isFinite(anchorTop)){
      const dy=anchor.getBoundingClientRect().top-anchorTop;
      if(Math.abs(dy)>.5)window.scrollBy(0,dy);
    }else{
      const cy=window.scrollY||document.documentElement.scrollTop||0;
      if(Math.abs(cy-y)>.5)window.scrollTo(0,y);
    }
  };

  let out;
  try{out=typeof fn==='function'?fn():undefined}
  finally{
    restore();
    requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});
    setTimeout(restore,90);
    setTimeout(restore,220);
  }
  return out;
}

function scrollTo(el,opt,reason='explicit-navigation'){
  if(!el?.scrollIntoView)return false;
  return allow(()=>nativeScrollIntoView.call(el,opt),reason),true;
}
function snapshot(){
  return{
    version:'r508',
    suppressed:now()<suppressUntil,
    suppressReason:now()<suppressUntil?suppressReason:'',
    userIntent:now()<userIntentUntil,
    userReason:now()<userIntentUntil?userReason:'',
    blocked,allowed,last
  };
}

window.SukunViewportPolicy={
  version:'r508',
  suppress,
  preserve,
  allow,
  scrollTo,
  snapshot,
  markUserIntent:markUser
};
})();
