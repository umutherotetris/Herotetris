(()=>{
'use strict';
if(window.SukunR708Focus)return;
let userSeq=0,entrySeq=0,last=null;
const mark=()=>{userSeq++};
for(const type of ['pointerdown','touchstart','wheel','keydown'])document.addEventListener(type,mark,{capture:true,passive:true});
function enter(){
 const seq=++entrySeq,gesture=userSeq;
 function top(){
  if(seq!==entrySeq||gesture!==userSeq||!document.body.classList.contains('sukun-tefekkur-mode'))return;
  const tab=document.getElementById('tab-zkr');
  if(tab&&tab.scrollTop)tab.scrollTop=0;
  const root=document.scrollingElement||document.documentElement;
  if(root.scrollTop)root.scrollTop=0;
  if(window.scrollY)window.scrollTo({top:0,left:0,behavior:'instant'});
 }
 top();requestAnimationFrame(()=>{top();requestAnimationFrame(top)});
 last={reason:'explicit-entry',at:Date.now(),sequence:seq};
 return true;
}
window.SukunR708Focus=Object.freeze({version:'r708',enter,snapshot:()=>last});
})();