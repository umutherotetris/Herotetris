/* Hero Portal 140: replace the legacy Sukun worker at its existing URL. */
'use strict';
const HERO_BUILD = '140';
const SCOPE = new URL(self.registration.scope);
const HOME = new URL('index.html', SCOPE);
const CACHE_PREFIX = 'hero-portal:' + SCOPE.pathname + ':';
const CACHE_NAME = CACHE_PREFIX + HERO_BUILD;
const CORE_ASSETS = [
  'css/ivory.css?v=140', 'assets/ivory-club-hero.webp?v=140',
  'index.html', 'hero.webmanifest', 'assets/hero-portal.svg?v=140',
  'css/tokens.css?v=138', 'css/base.css?v=124', 'css/components.css?v=124',
  'css/tetris.css?v=124', 'css/themes.css?v=124', 'css/portal.css?v=138',
  'js/portal-worker.js?v=140', 'js/portal.js?v=140', 'js/nav.js',
  'assets/portal-orbit.svg?v=138', 'assets/game-tetris.svg?v=140',
  'assets/game-chess.svg?v=140', 'assets/game-tavla.svg?v=140', 'assets/game-word.svg?v=140',
  'assets/fonts/manrope-latin-wght.woff2?v=138', 'assets/fonts/manrope-latin-ext-wght.woff2?v=138',
  'js/vendor/peerjs-1.5.4.min.js?v=138'
];

function inScope(url){
  return url.origin === SCOPE.origin && url.pathname.startsWith(SCOPE.pathname);
}
function isHome(url){
  return url.origin === SCOPE.origin && (url.pathname === SCOPE.pathname || url.pathname === HOME.pathname);
}
function isPortalHtml(text){
  // Accept both the new shell and an earlier valid Hero shell during CDN rollout.
  return /\bid=["']gameTetris["']/.test(text) && /\bid=["']gameChess["']/.test(text);
}
async function fetchFresh(request){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try{ return await fetch(new Request(request, { cache: 'no-store', signal: controller.signal })); }
  finally{ clearTimeout(timer); }
}
async function cacheHome(response){
  if(!response || !response.ok || !isPortalHtml(await response.clone().text())) return false;
  try{ await (await caches.open(CACHE_NAME)).put(HOME.href, response.clone()); }catch(error){}
  return true;
}
function wrongAssetType(request, response){
  return /\.(?:m?js|css)(?:\?|$)/i.test(request.url) && /text\/html/i.test(response.headers.get('Content-Type') || '');
}
async function cacheAsset(request, response){
  if(response && response.ok && !wrongAssetType(request, response)){
    try{ await (await caches.open(CACHE_NAME)).put(request, response.clone()); }catch(error){}
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await Promise.allSettled(CORE_ASSETS.map(async path => {
      const request = new Request(new URL(path, SCOPE));
      const response = await fetchFresh(request);
      if(isHome(new URL(request.url))) await cacheHome(response);
      else await cacheAsset(request, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Preserve existing caches. A failed preload must not discard an older offline shell,
    // and CacheStorage also contains other projects on this GitHub Pages origin.
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.filter(client => inScope(new URL(client.url))).forEach(client => {
      client.postMessage({ type: 'HERO_WORKER_ACTIVE', build: HERO_BUILD });
    });
    // Never reload an open game. The explicit recovery page handles the old broken shell.
  })());
});

function offlineHome(){
  return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="hero-build" content="${HERO_BUILD}"><title>Hero Portal</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0e13;color:#f3f6fa;font:16px/1.7 system-ui}main{max-width:420px;padding:32px}h1{color:#dfc299}a{display:inline-block;padding:12px 20px;margin-top:12px;background:#dfc299;color:#0c0e13;border-radius:10px;text-decoration:none;font-weight:700}</style></head><body><main><h1>Hero Portal</h1><p>Oyun alanı şu an açılamıyor. İnternet bağlantını kontrol edip yeniden deneyebilirsin.</p><a href="${HOME.pathname}">Yeniden dene</a></main></body></html>`, {
    status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
async function navigationResponse(request){
  try{
    const response = await fetchFresh(request);
    if(await cacheHome(response)) return response;
  }catch(error){}
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(HOME.href);
  if(cached && isPortalHtml(await cached.clone().text())) return cached;
  return offlineHome();
}
async function assetResponse(request){
  try{
    const response = await fetchFresh(request);
    if(wrongAssetType(request, response)) return new Response('', { status: 502 });
    await cacheAsset(request, response);
    return response; // Preserve real 404s; never substitute HTML for a missing module.
  }catch(error){
    return (await (await caches.open(CACHE_NAME)).match(request)) || Response.error();
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== 'GET' || !inScope(url)) return;
  if(request.mode === 'navigate'){
    if(isHome(url)) event.respondWith(navigationResponse(request));
    return; // Explicit nero.html/other apps are never replaced with the Hero home page.
  }
  if(/\.(?:m?js|css|json|webmanifest|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname) && !url.pathname.endsWith('/sw.js')){
    event.respondWith(assetResponse(request));
  }
});

function notificationUrl(value){
  try{ const url = new URL(value || HOME.href, SCOPE); if(inScope(url)) return url.href; }catch(error){}
  return HOME.href;
}
function showNotification(data = {}){
  return self.registration.showNotification(data.title || 'Hero Portal', {
    body: data.body || '', icon: new URL('assets/hero-portal.svg?v=140', SCOPE).href,
    tag: data.tag || 'hero-notification', data: { url: notificationUrl(data.url) }
  });
}
self.addEventListener('push', event => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(error){ data = { body: event.data.text() }; }
  event.waitUntil(showNotification(data));
});
self.addEventListener('message', event => {
  if(event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if(event.data?.type === 'HERO_PING'){
    const response = { type: 'HERO_PONG', build: HERO_BUILD };
    if(event.ports[0]) event.ports[0].postMessage(response);
    else event.source?.postMessage(response);
  }
  if(event.data?.type === 'SHOW_NOTIFICATION') event.waitUntil(showNotification(event.data.payload));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = notificationUrl(event.notification.data?.url);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = windows.find(window => inScope(new URL(window.url)));
    if(client){ await client.navigate(target); return client.focus(); }
    return self.clients.openWindow(target);
  })());
});
