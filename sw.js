/* SÜKÛN r795 — Update Recovery + Jewel Component Authority
   Amaç: yeni sürümün "waiting/install mismatch" yüzünden eski shell'de
   kilitlenmesini önlemek. Controller değişimi aktif sesi kendiliğinden
   kesmez; sayfa reload kararı istemci tarafında verilir. */
'use strict';

const SURUM = 'r795';
const CACHE = 'sukun-r795-20260913a';
const CACHE_META = './__sukun_cache_meta_r795__.json';
const BUILD_MARKER = './__sukun_build_r795__.json';
const LATEST_MARKER = './__sukun_latest__.json';

/* Kurulumu kırabilecek büyük/görsel dosyaları zorunlu listeye koymuyoruz.
   Shell doğrulaması bağımsız; geri kalan assetler best-effort pre-cache ve
   normal fetch sırasında current cache'e yazılır. */
const CORE = [
  './nero.html',
  './manifest.webmanifest',
  BUILD_MARKER,
  LATEST_MARKER
];

const PRECACHE = [
  './css/jewel-tokens-r795.css',
  './css/jewel-components-r795.css',
  './css/jewel-layout-r795.css',
  './js/jewel-bindings-r795.js',
  './assets/jewel-r795/ASSET_MANIFEST_r795.json',
  './assets/jewel-r795/btn-primary-wide.png',
  './assets/jewel-r795/btn-secondary-sapphire.png',
  './assets/jewel-r795/btn-secondary-amethyst.png',
  './assets/jewel-r795/btn-secondary-emerald.png',
  './assets/jewel-r795/btn-compact-sapphire.png',
  './assets/jewel-r795/btn-compact-gold.png',
  './assets/jewel-r795/btn-compact-emerald.png',
  './assets/jewel-r795/btn-round-minus.png',
  './assets/jewel-r795/btn-round-plus.png',
  './assets/jewel-r795/card-wide.png',
  './assets/jewel-r795/card-wide-ornate.png',
  './assets/jewel-r795/card-medium.png',
  './assets/jewel-r795/panel-tall.png',
  './assets/jewel-r795/panel-short.png',
  './assets/jewel-r795/panelbar.png',
  './assets/jewel-r795/panel-context.png',
  './assets/sukun-tesbih-weave-r759.svg',
  './assets/sukun-nur-mist-r759.svg',
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
  './assets/sukun-nur-orbit-r757.svg',
  './assets/jewel-ui-r792/card-wide.svg',
  './assets/jewel-ui-r792/card-medium.svg',
  './assets/jewel-ui-r792/field.svg',
  './assets/jewel-ui-r792/chip.svg',
  './assets/jewel-ui-r792/button-wide.svg',
  './assets/jewel-ui-r792/button-small.svg',
  './assets/jewel-ui-r792/panel-tall.svg',
  './assets/jewel-ui-r792/player.svg',
  './assets/jewel-ui-r792/divider.svg',
  './assets/jewel-ui-r792/toolbar-button.svg',
  './assets/jewel-ui-r792/tefekkur-cta.svg',
  './assets/jewel-ui-r792/ASSET_CARDS_r792.json',
  './assets/jewel-ui-r794/card-wide.svg',
  './assets/jewel-ui-r794/card-medium.svg',
  './assets/jewel-ui-r794/field.svg',
  './assets/jewel-ui-r794/chip.svg',
  './assets/jewel-ui-r794/button-wide.svg',
  './assets/jewel-ui-r794/button-small.svg',
  './assets/jewel-ui-r794/panel-tall.svg',
  './assets/jewel-ui-r794/player.svg',
  './assets/jewel-ui-r794/divider.svg',
  './assets/jewel-ui-r794/toolbar-button.svg',
  './assets/jewel-ui-r794/tefekkur-cta.svg',
  './assets/jewel-ui-r794/ASSET_CARDS_r794.json',
  './surumler.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

const NOTLAR = [
  'r795 · Jewel Component Authority: eski r790/r792/r794 geçici skin otoriteleri kaldırıldı; Zikir, Tefekkür, 28/99 Seyir ve accordionlar ortak component sınıflarına bağlandı.',
  'r793 · Güncelleme Kurtarma Otoritesi: yeni worker artık install/waiting çıkmazında eski sürümde takılı kalmaz.',
  'Navigasyon network-first + build-aware oldu; ağda daha yeni doğrulanmış HTML varsa eski shell yerine yeni HTML açılır.',
  'Service worker skipWaiting ile aktive olur; aktif ses varken sayfa zorla reload edilmez.',
  'Jewel/Tefekkür/ses/sayaç/28-99 seyir motorlarında işlevsel değişiklik yapılmadı.'
];

function buildOfHtml(text){
  const m=String(text||'').match(/<meta\s+name=["']sukun-build["']\s+content=["']([^"']+)["']/i);
  return m?m[1]:'';
}
function vnum(v){const m=String(v||'').match(/r(\d+)/i);return m?Number(m[1]):-1}
function sameOriginPath(path){return new URL(path,self.location.href).pathname}
async function fetchFresh(path,timeout=4500){
  const req=new Request(path,{cache:'no-store'});
  let timer;
  try{
    const ctl=new AbortController();
    timer=setTimeout(()=>ctl.abort(),timeout);
    const res=await fetch(new Request(req,{signal:ctl.signal,cache:'no-store'}));
    if(!res||!res.ok||res.type==='opaque')throw new Error('fetch '+path+' '+(res?.status||'failed'));
    return res;
  }finally{clearTimeout(timer)}
}
async function put(cache,key,res){try{await cache.put(key,res.clone());return true}catch(e){return false}}
async function readCacheMeta(){
  try{const c=await caches.open(CACHE),r=await c.match(CACHE_META,{ignoreSearch:true});return r?await r.json():null}catch(e){return null}
}
async function writeCacheMeta(meta){
  try{const c=await caches.open(CACHE);await c.put(CACHE_META,new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}))}catch(e){}
  return meta;
}

let prepareInFlight=null;
function prepareShell(){
  if(prepareInFlight)return prepareInFlight;
  const p=(async()=>{
    const cache=await caches.open(CACHE);
    const meta={v:SURUM,cache:CACHE,at:Date.now(),shell:false,manifest:false,marker:false,latest:false,complete:false,errors:[]};

    /* Her parça bağımsız. Tek bir 404 yeni worker'ı redundant yapamaz. */
    try{
      const r=await fetchFresh(BUILD_MARKER);const j=await r.clone().json();
      if(String(j?.v||'')===SURUM||String(j?.build||'').includes(SURUM)){await put(cache,BUILD_MARKER,r);meta.marker=true}else throw new Error('build marker mismatch');
    }catch(e){meta.errors.push('marker:'+String(e?.message||e))}
    try{
      const r=await fetchFresh(LATEST_MARKER);const j=await r.clone().json();
      if(j&&j.v){await put(cache,LATEST_MARKER,r);meta.latest=true}else throw new Error('latest invalid');
    }catch(e){meta.errors.push('latest:'+String(e?.message||e))}
    try{
      const r=await fetchFresh('./manifest.webmanifest');const j=await r.clone().json();
      const u=new URL(j?.start_url||'',self.location.href);
      if(j?.short_name==='SÜKÛN'&&u.searchParams.get('v')===SURUM){await put(cache,'./manifest.webmanifest',r);meta.manifest=true}else throw new Error('manifest mismatch');
    }catch(e){meta.errors.push('manifest:'+String(e?.message||e))}
    try{
      const r=await fetchFresh('./nero.html',6500);const b=buildOfHtml(await r.clone().text());
      if(b===SURUM){await put(cache,'./nero.html',r);meta.shell=true}else throw new Error('html '+(b||'unknown')+' != '+SURUM);
    }catch(e){meta.errors.push('html:'+String(e?.message||e))}

    meta.complete=meta.shell&&meta.manifest&&meta.marker;
    await writeCacheMeta(meta);

    /* Görseller kurulumun kaderini belirlemez. */
    Promise.allSettled(PRECACHE.map(async path=>{
      try{const r=await fetchFresh(path,5000);await put(cache,path,r)}catch(e){}
    })).catch(()=>{});
    return meta;
  })();
  prepareInFlight=p;
  p.finally(()=>{if(prepareInFlight===p)prepareInFlight=null}).catch(()=>{});
  return p;
}

async function cachedShellFrom(cacheName){
  try{
    const c=await caches.open(cacheName),r=await c.match('./nero.html',{ignoreSearch:true});
    if(!r)return null;const b=buildOfHtml(await r.clone().text());return b?{res:r,build:b,cache:cacheName}:null;
  }catch(e){return null}
}
async function bestCachedShell(){
  const current=await cachedShellFrom(CACHE);if(current)return current;
  const keys=(await caches.keys()).filter(k=>k.startsWith('sukun-')&&k!==CACHE)
    .sort((a,b)=>vnum(b)-vnum(a));
  for(const k of keys){const x=await cachedShellFrom(k);if(x)return x}
  return null;
}
async function broadcastStatus(extra={}){
  const m=await readCacheMeta();
  const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const msg={type:'SUKUN_SW_STATUS',v:SURUM,cache:CACHE,complete:!!m?.complete,marker:m||null,...extra};
  cs.forEach(c=>{try{c.postMessage(msg)}catch(e){}});
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    /* r793: install hiçbir geçici Pages yayılım uyuşmazlığında beklemeye kilitlenmez.
       Sekiz saniyeden uzun CDN gecikmesinde aktivasyon yine devam eder; activate
       aşaması shell hazırlığını yeniden dener. */
    try{await Promise.race([prepareShell(),new Promise(r=>setTimeout(r,8000))])}catch(e){}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    await self.clients.claim();
    try{await prepareShell()}catch(e){}
    await broadcastStatus({phase:'activated'});
    /* Eski cache'leri burada silmiyoruz: yeni shell henüz CDN'e yayılmadıysa
       çevrimdışı güvenlik ağı olarak kalırlar. */
  })());
});

const NET_TIMEOUT=3500;
async function timedFetch(request,ms=NET_TIMEOUT){
  return new Promise(resolve=>{
    let done=false;const t=setTimeout(()=>{if(!done){done=true;resolve(null)}},ms);
    fetch(request).then(r=>{if(!done){done=true;clearTimeout(t);resolve(r)}}).catch(()=>{if(!done){done=true;clearTimeout(t);resolve(null)}});
  });
}
async function navigationResponse(request){
  /* Güncelleme deadlock'unu kıran kritik fark:
     ağdaki HTML bu workerdan daha yeniyse CACHE'e dönmek yerine onu göster. */
  const fresh=await timedFetch(new Request(request,{cache:'no-store'}));
  if(fresh&&fresh.ok&&fresh.type!=='opaque'){
    const b=buildOfHtml(await fresh.clone().text());
    if(b){
      if(vnum(b)>vnum(SURUM)){
        try{self.registration.update()}catch(e){}
        return fresh;
      }
      if(b===SURUM){
        const c=await caches.open(CACHE);put(c,'./nero.html',fresh.clone());
        const m=await readCacheMeta()||{v:SURUM,cache:CACHE};m.shell=true;m.complete=!!(m.shell&&m.manifest&&m.marker);m.at=Date.now();writeCacheMeta(m);
        return fresh;
      }
      /* CDN kısa süreli eski HTML döndürüyorsa mevcut daha yeni shell'i koru. */
      const cached=await bestCachedShell();
      if(cached&&vnum(cached.build)>=vnum(b))return cached.res;
      return fresh;
    }
  }
  const cached=await bestCachedShell();
  if(cached)return cached.res;
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SÜKÛN</title><body style="background:#05090c;color:#8fe9ff;font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:44px;opacity:.75">۞</div><p>SÜKÛN çevrimdışı ve doğrulanmış kabuk bulunamadı.</p><p style="opacity:.6;font-size:14px">Bağlantı geldiğinde sayfayı yeniden aç.</p></div>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}

async function assetResponse(request){
  const url=new URL(request.url),current=await caches.open(CACHE);
  const latestPath=sameOriginPath(LATEST_MARKER),manifestPath=sameOriginPath('./manifest.webmanifest');
  const updateProbe=(url.pathname===latestPath)||url.pathname.endsWith('/sw.js')||/\/__sukun_build_r\d+__\.json$/.test(url.pathname);
  /* Update probeları cache-first olamaz; aksi halde latest marker kendi cache'inde
     sonsuza dek kalır ve bir sonraki sürüm hiç algılanmaz. */
  if(updateProbe){
    try{
      const fresh=await fetch(new Request(request,{cache:'no-store'}));
      if(fresh?.ok&&fresh.type!=='opaque')put(current,new Request(url.origin+url.pathname),fresh.clone());
      return fresh;
    }catch(e){
      const fb=await current.match(new Request(url.origin+url.pathname),{ignoreSearch:true});
      if(fb)return fb;
    }
  }
  const cached=await current.match(request,{ignoreSearch:false})||await current.match(new Request(url.origin+url.pathname),{ignoreSearch:true});
  if(cached)return cached;
  try{
    const res=await fetch(request);
    if(res?.ok&&res.type!=='opaque')put(current,request,res.clone());
    return res;
  }catch(e){
    const keys=(await caches.keys()).filter(k=>k.startsWith('sukun-')&&k!==CACHE).sort((a,b)=>vnum(b)-vnum(a));
    for(const k of keys){try{const c=await caches.open(k),r=await c.match(request,{ignoreSearch:true});if(r)return r}catch(_){} }
    return Response.error();
  }
}

self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  event.respondWith(req.mode==='navigate'?navigationResponse(req):assetResponse(req));
});

self.addEventListener('message',event=>{
  const d=event.data||{},port=event.ports?.[0];
  if(d.type==='SKIP_WAITING'){event.waitUntil(self.skipWaiting());return}
  if(d.type==='SURUM_NOTU'){try{port?.postMessage({v:SURUM,notlar:NOTLAR})}catch(e){};return}
  if(d.type==='STATUS'){
    event.waitUntil((async()=>{const m=await readCacheMeta();try{port?.postMessage({v:SURUM,cache:CACHE,complete:!!m?.complete,marker:m,error:m?.errors?.join(' | ')||''})}catch(e){}})());return;
  }
  if(d.type==='CACHE_REFRESH'){
    event.waitUntil(prepareShell().then(async m=>{await broadcastStatus({phase:'refresh'});try{port?.postMessage({ok:true,v:SURUM,cache:CACHE,complete:!!m?.complete,marker:m})}catch(e){}}).catch(e=>{try{port?.postMessage({ok:false,v:SURUM,error:String(e?.message||e)})}catch(_){}}));return;
  }
  if(d.type==='CHECK_UPDATE'){
    event.waitUntil((async()=>{try{await self.registration.update();port?.postMessage({ok:true,v:SURUM})}catch(e){port?.postMessage({ok:false,v:SURUM,error:String(e?.message||e)})}})());
  }
});
