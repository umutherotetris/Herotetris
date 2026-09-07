
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const FS_KEY='sukun.tefekkur.systemFullscreen.v1';
let idleTimer=null,focusTimer=null,recordingRefresh=null;
let fullscreenOwned=false;
let systemFullscreen=false;

try{systemFullscreen=localStorage.getItem(FS_KEY)==='1'}catch(e){}

function tr(v){
  try{return window.I18N?.t?.(v)||v}catch(e){return v}
}

function syncFullscreenSetting(){
  document.querySelectorAll('[data-r530-tef-fs]').forEach(b=>{
    const on=(b.dataset.r530TefFs==='system')===systemFullscreen;
    b.setAttribute('aria-pressed',String(on));
  });
  const row=document.getElementById('r530TefFullscreen');
  if(row)row.dataset.mode=systemFullscreen?'system':'app';
}

function ensureFullscreenSetting(){
  const general=document.querySelector('.temaSheet .genAyar')||document.querySelector('.genAyar');
  if(!general)return null;
  let row=document.getElementById('r530TefFullscreen');
  if(!row){
    row=document.createElement('div');
    row.id='r530TefFullscreen';
    row.innerHTML=
      '<div class="r530FsHead"><b>'+tr('Tefekkür ekranı')+'</b><small>'+tr('Sistem bildirimi olmadan odaklan')+'</small></div>'+
      '<div class="r530FsSeg" role="group" aria-label="'+tr('Tefekkür ekranı')+'">'+
        '<button type="button" data-r530-tef-fs="app">'+tr('Uygulama içinde')+'</button>'+
        '<button type="button" data-r530-tef-fs="system">'+tr('Sistem tam ekranı')+'</button>'+
      '</div>'+
      '<div class="r530FsFoot">'+tr('Uygulama içi görünüm önerilir; Android sistem bildirimi göstermez. Sistem tam ekranı isteğe bağlıdır.')+'</div>';
  }
  const heads=[...general.querySelectorAll('.genBas')];
  const view=heads.find(x=>(x.textContent||'').toLocaleUpperCase('tr-TR').includes('GÖRÜNÜM'));
  if(row.parentNode!==general){
    if(view)view.insertAdjacentElement('afterend',row);else general.appendChild(row);
  }
  if(row.dataset.bound!=='1'){
    row.dataset.bound='1';
    row.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-r530-tef-fs]');
      if(!b)return;
      setSystemFullscreen(b.dataset.r530TefFs==='system',true);
    });
  }
  syncFullscreenSetting();
  return row;
}

function btn(){
  return $('.sukun-focus-btn');
}
function syncButton(){
  const b=btn(); if(!b)return;
  const on=document.body.classList.contains('sukun-tefekkur-mode');
  b.textContent=on?'Tefekkürden Çık':'✦ Tefekkür';
  b.setAttribute('aria-pressed',String(on));
  b.setAttribute('aria-label',on?'Tefekkür modundan çık':'Tefekkür moduna gir');
  b.title=on?'Tefekkür modundan çık':'Tefekkür moduna gir';
}
function wake(){
  if(!document.body.classList.contains('sukun-tefekkur-mode'))return;
  document.body.classList.remove('tefekkur-idle');
  if(idleTimer)clearTimeout(idleTimer);
  idleTimer=setTimeout(()=>{
    if(document.body.classList.contains('sukun-tefekkur-mode'))
      document.body.classList.add('tefekkur-idle');
  },3600);
}
async function requestFs(){
  const current=document.fullscreenElement||document.webkitFullscreenElement;
  if(current)return;
  const el=document.documentElement;
  const fn=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!fn)return;
  try{
    const p=fn.call(el,{navigationUI:'hide'});
    if(p&&typeof p.then==='function')await p;
    fullscreenOwned=!!(document.fullscreenElement||document.webkitFullscreenElement);
    /* İstek çözülmeden kullanıcı modu kapattıysa ya da tercihi değiştirdiyse
       gecikmiş fullscreen sonucu ekranda asılı kalmasın. */
    if(fullscreenOwned&&(!systemFullscreen||!document.body.classList.contains('sukun-tefekkur-mode')))
      await leaveFs();
  }catch(e){
    /* CSS 100dvh fallback yeterli; fullscreen reddi hata değildir. */
    fullscreenOwned=false;
  }
}
async function leaveFs(){
  if(!fullscreenOwned)return;
  const fn=document.exitFullscreen||document.webkitExitFullscreen;
  try{
    if(fn){
      const p=fn.call(document);
      if(p&&typeof p.then==='function')await p;
    }
  }catch(e){}
  fullscreenOwned=false;
}
async function setSystemFullscreen(enabled,fromUser=false){
  systemFullscreen=!!enabled;
  try{localStorage.setItem(FS_KEY,systemFullscreen?'1':'0')}catch(e){}
  syncFullscreenSetting();
  if(!document.body.classList.contains('sukun-tefekkur-mode'))return systemFullscreen;
  if(systemFullscreen&&fromUser)await requestFs();
  if(!systemFullscreen)await leaveFs();
  return systemFullscreen;
}
async function enter(){
  const z=document.querySelector('.tab[data-t="zkr"]');
  if(z&&!z.classList.contains('act'))z.click();

  /* r702: görünüm geçişi ses başlatmaz ve IndexedDB'yi beklemez.
     Kayıt önceliği mevcut resolver'da kalır; anahtar yenileme tek arka plan işi. */
  if(!recordingRefresh&&typeof recInit==='function'){
    recordingRefresh=Promise.resolve().then(()=>recInit()).catch(()=>{}).finally(()=>{recordingRefresh=null});
  }

  document.body.classList.add('sukun-focus-mode','sukun-tefekkur-mode');
  document.body.classList.remove('tefekkur-idle');
  syncButton();
  wake();
  window.SukunR708Focus?.enter?.();

  /* r530: odak görünümü tek başına yeterlidir. Gerçek sistem tam ekranı
     yalnız kullanıcı Ayarlar'dan özellikle seçtiyse istenir. */
  if(systemFullscreen)requestFs();

  clearTimeout(focusTimer);
  focusTimer=setTimeout(()=>{
    if(!document.body.classList.contains('sukun-tefekkur-mode'))return;
    try{
      $('#zCountVisual')?.focus({preventScroll:true});
    }catch(e){}
  },90);
}
async function leave(alsoFullscreen=true){
  clearTimeout(focusTimer);focusTimer=null;
  if(idleTimer){clearTimeout(idleTimer);idleTimer=null;}
  document.body.classList.remove('sukun-tefekkur-mode','sukun-focus-mode','tefekkur-idle');
  syncButton();
  if(alsoFullscreen)await leaveFs();
}
async function toggle(){
  if(document.body.classList.contains('sukun-tefekkur-mode')) await leave(true);
  else await enter();
}

function install(){
  ensureFullscreenSetting();
  [240,760,1600].forEach(ms=>setTimeout(ensureFullscreenSetting,ms));
  const b=btn();
  if(b)b.onclick=toggle;
  if(b&&!document.body.classList.contains('sukun-tefekkur-mode')){
    b.textContent='◉ Tefekkür';
    b.setAttribute('aria-pressed','false');
    b.setAttribute('aria-label','Tefekkür moduna gir');
    b.title='Tefekkür moduna gir';
  }

  document.addEventListener('pointerdown',()=>{
    if(document.body.classList.contains('sukun-tefekkur-mode'))wake();
  },{passive:true});

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!e.defaultPrevented&&document.body.classList.contains('sukun-tefekkur-mode')){
      e.preventDefault();
      leave(true);
    }
  });

  document.addEventListener('fullscreenchange',()=>{
    /* Fullscreen gerçekten bizim tarafımızdan açılmış ve kullanıcı sistem
       hareketiyle çıkmışsa CSS tefekkür modunu da kapat. */
    if(fullscreenOwned && !document.fullscreenElement &&
       document.body.classList.contains('sukun-tefekkur-mode')){
      fullscreenOwned=false;
      leave(false);
    }
  });

  document.addEventListener('webkitfullscreenchange',()=>{
    if(fullscreenOwned && !document.webkitFullscreenElement &&
       document.body.classList.contains('sukun-tefekkur-mode')){
      fullscreenOwned=false;
      leave(false);
    }
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
}else{
  setTimeout(install,0);
}

window.SUKUN_TEFEKKUR={
  enter,
  exit:()=>leave(true),
  toggle,
  active:()=>document.body.classList.contains('sukun-tefekkur-mode'),
  fullscreenEnabled:()=>systemFullscreen,
  setFullscreen:setSystemFullscreen,
  fullscreenOwned:()=>fullscreenOwned,
  syncSettings:ensureFullscreenSetting,
  version:'r702'
};
})();
