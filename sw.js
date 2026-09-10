/* SÜKÛN r757 — Nur visual merge and runtime repairs */
'use strict';

const SURUM = 'r757';
const CACHE = 'sukun-r757-20260910a';

const CORE = [
  './nero.html',
  './manifest.webmanifest',
  './assets/tefekkur-sanctuary.webp',
  './assets/tefekkur-sanctuary-r710.webp',
  './assets/tefekkur-sanctuary-r710-small.webp',
  './assets/feyz-ornament.svg',
  './assets/sukun-sanctuary-r717.webp',
  './assets/sukun-sanctuary-r717-small.webp',
  './assets/feyz-mark-r718.svg',
  './assets/feyz-pattern-r718.svg',
  './assets/feyz-flame-ring-r718.webp',
  './assets/ui-target-r722.svg',
  './assets/ui-hourglass-r722.svg',
  './assets/ui-exit-r722.svg',
  './assets/ui-speaker-r722.svg',
  './assets/sukun-nur-sanctuary-r757.png',
  './assets/sukun-nur-ring-r757.png',
  './assets/sukun-nur-orbit-r757.svg'
];
/* r732: HTML'in hiç referans vermediği eski görseller kurulumu bloklayan CORE
   listesinden çıkarıldı. Biri eksik olsa bile güncelleme artık düşmez; yine de
   önbelleğe alınırlar, çünkü eski bir kabuk onlara başvurabilir. */
const OPTIONAL = [
  './assets/feyz-mark.svg',
  './assets/feyz-flame-ring.svg',
  './assets/feyz-flame-ring.webp',
  './surumler.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
const BUILD_MARKER='./__sukun_build_r757__.json';

const NOTLAR = ["r756 kaynak kartları, 15 sayfalık Berhetiyye atlası ve Esmâ içerikleri r744 güvenilirlik düzeltmeleriyle birleştirildi.", "Feyz Nur: orijinal PNG sahne ve işlemeli nur çemberi; bağımsız vektör ışık katmanları, şeffaf yüzeyler ve kompakt kontroller.", "Ana sayaç başlığı, yan yana Hedef/Kalan ve gizli oynatıcı konumu onarıldı; kayıt stüdyosu ve güvenli SW yenilemesi geri taşındı.", "Bilgi kartı tek aşamada çizilir; yeniden çizim döngüsü giderildi. Kaynak görüntüleyicinin kaydırma kilidi ve yükleme animasyonları düzeltildi.", "Sürüm bilgileri eşitlendi. Kaynak/VM doğrulamaları raporda; fiziksel cihaz ve görsel tarayıcı doğrulaması yapılmadı."];

function buildOfHtml(text){
  const m=String(text||'').match(/<meta\s+name=["']sukun-build["']\s+content=["']([^"']+)["']/i);
  return m?m[1]:'';
}
async function fetchReload(path){
  const req=new Request(path,{cache:'reload'});
  const res=await fetch(req);
  if(!res||!res.ok||res.type==='opaque')throw new Error('fetch '+path+' '+(res?.status||'failed'));
  return{req,res};
}
async function validateCore(path,res){
  if(path.includes('nero.html')){
    const text=await res.clone().text();
    if(buildOfHtml(text)!==SURUM)throw new Error('HTML build mismatch: '+buildOfHtml(text)+' != '+SURUM);
  }else if(path.includes('manifest.webmanifest')){
    const obj=await res.clone().json();
    if(!obj||obj.short_name!=='SÜKÛN'||!obj.start_url)throw new Error('manifest invalid');
    const start=new URL(obj.start_url,self.location.href);
    if(start.searchParams.get('v')!==SURUM)throw new Error('manifest build mismatch');
  }
  return true;
}
async function marker(cache){
  const r=await cache.match(BUILD_MARKER);
  if(!r)return null;
  try{return await r.json()}catch(e){return null}
}
let prepareInFlight=null;
function kabuguHazirla(){
  if(prepareInFlight)return prepareInFlight;
  const task=prepareShell();prepareInFlight=task;
  task.finally(()=>{if(prepareInFlight===task)prepareInFlight=null}).catch(()=>{});
  return task;
}
async function prepareShell(){
  const cache=await caches.open(CACHE);
  /* Download and validate the complete core before replacing a working shell.
     A failed refresh must not partially overwrite the previous complete cache. */
  const prepared=[];
  for(const path of CORE){
    const {req,res}=await fetchReload(path);
    await validateCore(path,res);
    const body=await res.arrayBuffer();
    prepared.push({req,res:new Response(body,{status:res.status,statusText:res.statusText,headers:res.headers})});
  }
  for(const {req,res} of prepared)await cache.put(req,res);
  prepared.length=0;
  /* Opsiyoneller güncellemeyi düşürmez. */
  await Promise.allSettled(OPTIONAL.map(async path=>{
    const {req,res}=await fetchReload(path);await cache.put(req,res.clone());
  }));
  const meta={v:SURUM,cache:CACHE,complete:true,at:Date.now(),core:CORE.slice()};
  await cache.put(BUILD_MARKER,new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
  return meta;
}
async function currentComplete(){
  const cache=await caches.open(CACHE);const m=await marker(cache);
  if(!m||m.v!==SURUM||m.complete!==true)return false;
  for(const path of CORE){if(!await cache.match(path,{ignoreSearch:true}))return false}
  return true;
}

self.addEventListener('install',event=>{
  /* skipWaiting YOK: güncelleme waiting'de kalır, kullanıcı Yenile derse aktive olur. */
  event.waitUntil(kabuguHazirla());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    if(!await currentComplete())throw new Error(SURUM+' cache incomplete — old worker preserved');
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('sukun-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    cs.forEach(c=>{try{c.postMessage({type:'SUKUN_SW_STATUS',v:SURUM,cache:CACHE,complete:true})}catch(e){}});
  })());
});

const AG_ZAMAN_ASIMI=2500;
function zamanliFetch(request,ms){
  return new Promise(resolve=>{let done=false;const t=setTimeout(()=>{if(!done){done=true;resolve(null)}},ms);fetch(request).then(r=>{if(!done){done=true;clearTimeout(t);resolve(r)}}).catch(()=>{if(!done){done=true;clearTimeout(t);resolve(null)}})});
}
async function shellCached(){
  const cache=await caches.open(CACHE);
  if(!(await marker(cache))?.complete)return null;
  return await cache.match('./nero.html',{ignoreSearch:true});
}
async function responseBuild(res){
  try{return buildOfHtml(await res.clone().text())}catch(e){return''}
}
async function kabukOncelikli(request){
  const cache=await caches.open(CACHE);
  const cached=await shellCached();
  const fresh=await zamanliFetch(new Request(request,{cache:'no-store'}),AG_ZAMAN_ASIMI);
  if(fresh&&fresh.ok&&fresh.type!=='opaque'){
    const b=await responseBuild(fresh);
    if(b===SURUM){
      /* Yalnız AYNI build mevcut worker cache'ine yazılabilir. */
      eventlessPut(cache,'./nero.html',fresh.clone());
      return fresh;
    }
    if(b&&b!==SURUM){
      /* Ağda daha yeni HTML var ama bu worker eski: sürümleri karıştırma. */
      try{self.registration.update()}catch(e){}
      if(cached)return cached;
      /* İlk kurulum gibi cache yoksa ağdaki sayfa son çare; yeni worker hemen kurulacaktır. */
      return fresh;
    }
  }
  if(cached){
    /* Arka plan refresh yalnız aynı buildse cache'e girer. */
    fetch(new Request(request,{cache:'no-store'})).then(async r=>{
      if(r?.ok&&(await responseBuild(r))===SURUM)eventlessPut(cache,'./nero.html',r.clone());
      else if(r?.ok)try{self.registration.update()}catch(e){}
    }).catch(()=>{});
    return cached;
  }
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SÜKÛN</title><body style="background:#05090c;color:#8fe9ff;font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:44px;opacity:.75">۞</div><p>SÜKÛN çevrimdışı ve doğrulanmış önbellek yok.</p><p style="opacity:.6;font-size:14px">Bir kez çevrimiçi aç; sonrası çevrimdışı çalışır.</p></div>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}
function eventlessPut(cache,key,res){cache.put(key,res).catch(()=>{})}

async function onbellekOncelikli(request){
  const url=new URL(request.url);
  const packaged=[...CORE,...OPTIONAL].some(path=>new URL(path,self.location.href).pathname===url.pathname);
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request,{ignoreSearch:packaged||!url.search});
  if(cached)return cached;
  try{
    const res=await fetch(request);
    if(res?.ok&&res.type!=='opaque'){
      if(url.pathname===new URL('./manifest.webmanifest',self.location.href).pathname)await validateCore('./manifest.webmanifest',res);
      eventlessPut(cache,request,res.clone());
    }
    return res;
  }catch(e){return Response.error()}
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  event.respondWith(request.mode==='navigate'?kabukOncelikli(request):onbellekOncelikli(request));
});

self.addEventListener('message',event=>{
  const d=event.data||{},port=event.ports?.[0];
  if(d.type==='SKIP_WAITING'){self.skipWaiting();return}
  if(d.type==='SURUM_NOTU'){try{port?.postMessage({v:SURUM,notlar:NOTLAR})}catch(e){};return}
  if(d.type==='STATUS'){
    event.waitUntil((async()=>{const cache=await caches.open(CACHE),m=await marker(cache);try{port?.postMessage({v:SURUM,cache:CACHE,complete:!!m?.complete,marker:m,error:m?'':'marker missing'})}catch(e){}})());return;
  }
  if(d.type==='CACHE_REFRESH'){
    event.waitUntil(kabuguHazirla().then(m=>{try{port?.postMessage({ok:true,v:SURUM,cache:CACHE,complete:!!m?.complete})}catch(e){}}).catch(e=>{try{port?.postMessage({ok:false,v:SURUM,error:String(e?.message||e)})}catch(_){}}));
  }
});
