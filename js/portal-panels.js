import { Auth } from './auth.js';

export function element(tag, className, text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=String(text);
  return el;
}
export function button(label, handler, className='pc-button'){
  const el=element('button',className,label);el.type='button';
  if(handler)el.addEventListener('click',handler);
  return el;
}
export function ensureCenterStyles(){
  if(document.getElementById('portalCentersCSS'))return;
  const css=element('link');css.id='portalCentersCSS';css.rel='stylesheet';
  css.href=new URL('../css/portal-centers.css',import.meta.url).href;document.head.append(css);
}
// Every center belongs to the account that opened it. Async controllers can use
// current() before rendering or writing; closing also releases all listeners.
export function openPanel({id,title,subtitle='',uid=Auth.getState().uid,onClose}={}){
  ensureCenterStyles();
  document.getElementById(id)?.dispatchEvent(new Event('hero:close-panel'));
  const previous=document.activeElement,dialog=element('dialog','pc-dialog');dialog.id=id;
  const head=element('header','pc-head'),heading=element('div');
  const h=element('h2','',title);h.id=id+'Title';heading.append(h);
  if(subtitle)heading.append(element('p','pc-muted',subtitle));
  const closeButton=button('✕',()=>close(),'pc-close');closeButton.setAttribute('aria-label','Kapat');
  head.append(heading,closeButton);dialog.append(head);dialog.setAttribute('aria-labelledby',h.id);
  const body=element('div','pc-body'),status=element('p','pc-status');status.setAttribute('role','status');status.hidden=true;
  dialog.append(body,status);document.body.append(dialog);
  let closed=false,unsubscribe=()=>{};const cleanups=[];
  function current(){return !closed && Auth.getState().uid===uid;}
  function close(){
    if(closed)return;closed=true;unsubscribe();cleanups.splice(0).forEach(fn=>{try{fn();}catch(_){}});
    dialog.close?.();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});onClose?.();
  }
  function message(text,error=false){if(!current())return;status.hidden=!text;status.textContent=text;status.classList.toggle('is-error',error);}
  dialog.addEventListener('hero:close-panel',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');
  unsubscribe=Auth.subscribe(state=>{if(state.uid!==uid)close();});
  if(closed)unsubscribe();
  closeButton.focus();
  return {dialog,body,status,current,close,message,cleanup:fn=>{if(closed){try{fn();}catch(_){}}else cleanups.push(fn);}};
}
