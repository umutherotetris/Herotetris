// Register independently of Firebase so account/CDN failures cannot block worker repair.
(function(){
  'use strict';
  if(!('serviceWorker' in navigator)) return;
  const base = new URL('../', document.currentScript.src);
  navigator.serviceWorker.addEventListener('message', event => {
    if(event.data?.type === 'HERO_WORKER_ACTIVE' && event.ports[0]){
      event.ports[0].postMessage({ type: 'HERO_PAGE_READY' });
    }
  });
  window.__heroWorkerReady = navigator.serviceWorker.register(new URL('sw.js', base), {
    scope: base.href, updateViaCache: 'none'
  }).then(registration => {
    const watched = new WeakSet();
    function watch(worker){
      if(!worker || watched.has(worker)) return;
      watched.add(worker);
      const promote = () => {
        if(worker.state === 'installed') worker.postMessage({ type: 'SKIP_WAITING' });
      };
      worker.addEventListener('statechange', promote);
      promote();
    }
    function inspect(){
      watch(registration.installing);
      watch(registration.waiting);
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    }
    // register() may return after updatefound has already fired.
    registration.addEventListener('updatefound', inspect);
    inspect();
    registration.update().then(inspect).catch(() => {});
    return registration;
  }).catch(error => {
    console.warn('[HeroWorker]', error);
    return null;
  });
})();
