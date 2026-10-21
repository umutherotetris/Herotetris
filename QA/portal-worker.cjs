// Real service-worker regression test; no live accounts or production writes.
// Run: PORTAL_CHROMIUM=/tmp/chromium node QA/portal-worker.cjs
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
// Exact historical fixture from 34f768b6503f8b13c9d25f8c56b5efb2750c5ece:sw.js.
// Vendored so this regression also runs from shallow clones and source ZIPs.
const legacyWorker = fs.readFileSync(path.join(__dirname, 'fixtures/sukun-r820-worker.js'), 'utf8');
const legacyPrecachePaths = new Set([...legacyWorker.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(match => '/Herotetris/' + match[1].replace(/^\.\//, '')));
const legacyShell = '<!doctype html><meta name="sukun-build" content="r820"><title>Legacy SÜKÛN</title><h1>Legacy SÜKÛN shell</h1>';
const mime = { '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
let serveModernWorker = false;
let homeRequests = 0;
let serverOffline = false;
let browser;

const server = http.createServer((req, res) => {
  if(serverOffline){ req.socket.destroy(); return; }
  const pathname = new URL(req.url, 'http://test.invalid').pathname;
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, body, type = 'text/html') => { res.writeHead(status, { 'Content-Type': type + '; charset=utf-8' }); res.end(body); };
  if(pathname === '/Herotetris/sw.js') return send(200, serveModernWorker ? fs.readFileSync(path.join(root, 'sw.js')) : legacyWorker, 'text/javascript');
  if(pathname === '/Herotetris/seed.html') return send(200, '<!doctype html><title>Worker test bootstrap</title>');
  if(pathname === '/Herotetris/nero.html') return send(200, legacyShell);
  if(pathname === '/Herotetris/__sukun_build_r820__.json' || pathname === '/Herotetris/__sukun_latest__.json') return send(200, JSON.stringify({v:'r820'}), 'application/json');
  if(pathname === '/Herotetris/manifest.webmanifest') return send(200, JSON.stringify({short_name:'SÜKÛN',start_url:'./index.html?v=r820'}), 'application/manifest+json');
  if(pathname === '/Herotetris/' || pathname === '/Herotetris/index.html') {
    homeRequests++;
    // Keep only the independent worker bootstrap. Account/game integration has
    // its own suite; external auth must not affect worker migration coverage.
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (all, attrs) => /portal-worker\.js/.test(attrs) ? all : '');
    return send(200, html);
  }
  // Large unrelated Sukun artwork is unnecessary to reproduce its routing bug.
  // Fail those best-effort precaches immediately so outstanding legacy network
  // requests cannot dominate the worker activation timing.
  if(legacyPrecachePaths.has(pathname)) return send(404, 'Legacy optional asset unavailable', 'text/plain');
  if(!pathname.startsWith('/Herotetris/')) return send(404, 'Outside application scope', 'text/plain');
  const file = path.resolve(root, '.' + pathname.slice('/Herotetris'.length));
  if(!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, 'Missing asset', 'text/plain');
  const body = path.extname(file) === '.css'
    ? fs.readFileSync(file, 'utf8').replace(/@import\s+url\((['"])https:\/\/fonts\.googleapis\.com[^'"]+\1\)\s*;/g, '')
    : fs.readFileSync(file);
  send(200, body, mime[path.extname(file)] || 'application/octet-stream');
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const base = origin + '/Herotetris/';
  const launch = { headless: true };
  if(process.env.PORTAL_CHROMIUM) launch.executablePath = process.env.PORTAL_CHROMIUM;
  browser = await chromium.launch(launch);
  const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(base + 'seed.html');
  await page.evaluate(async () => {
    const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const ready = await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller) await changed;
    await new Promise((resolve, reject) => {
      const active = ready.active;
      if(active.state === 'activated') return resolve();
      const timeout = setTimeout(() => reject(new Error('Legacy worker did not finish activation')), 15000);
      active.addEventListener('statechange', () => { if(active.state === 'activated'){ clearTimeout(timeout); resolve(); } });
    });
    localStorage.setItem('hero_theme', 'emerald');
    const unrelated = await caches.open('unrelated-app-sentinel');
    await unrelated.put('/other-app/sentinel.txt', new Response('keep unrelated data'));
    const legacy = await caches.open('sukun-r820-20260914a');
    await legacy.put('./legacy-sentinel.txt', new Response('keep legacy data'));
  });

  // A successful fresh Hero response is still replaced by the legacy shell.
  await page.goto(base + 'index.html');
  assert.equal(await page.title(), 'Legacy SÜKÛN');
  assert.ok(homeRequests > 0, 'legacy reproduction must have fetched valid Hero HTML');

  serveModernWorker = true;
  // The recovery document carries the isolated legacy compatibility marker,
  // so the old worker can deliver it before the replacement worker activates.
  await page.goto(base + 'hero-recover.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#gameTetris').waitFor({ state: 'visible' }).catch(async error => { console.error('[diagnostic]', await page.url(), await page.title(), await page.locator('body').innerText()); console.error('[states]', await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return {controller:navigator.serviceWorker.controller?.scriptURL,active:r?.active?.state,waiting:r?.waiting?.state,installing:r?.installing?.state,caches:await caches.keys()}})); for(const w of context.serviceWorkers()){try{console.error('[worker]',w.url(),await w.evaluate(()=>({build:typeof HERO_BUILD==='undefined'?null:HERO_BUILD,scope:self.registration.scope})));}catch(e){console.error('[worker-eval]',e.message)}} throw error; });
  assert.match(await page.title(), /Hero Portal/);
  assert.equal(await page.locator('meta[name="hero-build"]').getAttribute('content'), '141');
  assert.equal(await page.locator('link[href*="css/portal.css"]').count(), 1);
  const workerBuild = await page.evaluate(() => new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => reject(new Error('Hero worker did not respond')), 4000);
    channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data); };
    navigator.serviceWorker.controller.postMessage({ type: 'HERO_PING' }, [channel.port2]);
  }));
  assert.equal(workerBuild.type, 'HERO_PONG');
  assert.equal(workerBuild.build, '141');
  assert.equal(await page.evaluate(() => localStorage.getItem('hero_theme')), 'emerald');

  const missingAsset = await page.evaluate(async () => {
    const response = await fetch('./worker-missing-file.js');
    return { status: response.status, type: response.headers.get('content-type'), body: await response.text() };
  });
  assert.equal(missingAsset.status, 404);
  assert.doesNotMatch(missingAsset.type || '', /text\/html/);
  assert.equal(missingAsset.body, 'Missing asset');
  await page.goto(base + 'nero.html');
  assert.equal(await page.title(), 'Legacy SÜKÛN', 'explicit legacy route must not be replaced with Hero HTML');
  await page.goto(base + 'index.html');
  await page.locator('#gameTetris').waitFor({ state: 'visible' });

  // Real socket failure covers both page and worker requests without CDP
  // interception, which can change service-worker lifecycle behavior.
  serverOffline = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#gameTetris').waitFor({ state: 'visible' });
  assert.match(await page.title(), /Hero Portal/);
  assert.doesNotMatch(await page.locator('body').innerText(), /SÜKÛN çevrimdışı/);
  // Navigation must bootstrap from the exact imported URL even when the first
  // online visit loaded it before the worker took control.
  await page.evaluate(async () => { const nav = await import('./js/nav.js'); nav.initNav(); });
  await page.locator('.bottom-nav [data-nav="friends"]').click();
  assert.equal(await page.locator('[data-screen="friends"]').evaluate(el=>el.classList.contains('active')), true);
  await page.locator('.bottom-nav [data-nav="home"]').click();

  const offlineAsset = await page.evaluate(async () => {
    try {
      const response = await fetch('./worker-uncached-file.js');
      return { status: response.status, type: response.headers.get('content-type'), body: await response.text() };
    } catch { return { rejected: true }; }
  });
  assert.ok(offlineAsset.rejected || (offlineAsset.status >= 400 && !/text\/html/.test(offlineAsset.type || '')), 'uncached JS must never receive an HTML shell');

  const otherPage = await context.newPage();
  let unrelatedFailed = false;
  try { await otherPage.goto(base + 'nested/not-a-portal-page.html'); }
  catch { unrelatedFailed = true; }
  assert.ok(unrelatedFailed || !/Hero Portal/.test(await otherPage.title()), 'nested navigation must not receive portal fallback');
  await otherPage.close();

  const preserved = await page.evaluate(async () => {
    const unrelated = await caches.open('unrelated-app-sentinel');
    const legacy = await caches.open('sukun-r820-20260914a');
    return {
      unrelated: await (await unrelated.match('/other-app/sentinel.txt')).text(),
      legacy: await (await legacy.match('./legacy-sentinel.txt')).text(),
    };
  });
  assert.deepEqual(preserved, { unrelated: 'keep unrelated data', legacy: 'keep legacy data' });

  // An empty Hero cache must show Hero's own offline response, never Sukun.
  await page.evaluate(async () => {
    for(const name of await caches.keys()) if(name.startsWith('hero-portal:/Herotetris/:')) await caches.delete(name);
  });
  const emptyOffline = await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(emptyOffline.status(), 503);
  assert.match(await page.locator('body').innerText(), /Hero|HERO/);
  assert.doesNotMatch(await page.locator('body').innerText(), /SÜKÛN/);
  assert.equal(await page.evaluate(() => localStorage.getItem('hero_theme')), 'emerald');

  assert.deepEqual(pageErrors, [], 'no uncaught browser errors');
  console.log('PASS: actual legacy Sukun worker reproduction; recovery-page migration and worker handshake; Hero online/offline shell; no HTML for missing JS or unrelated navigation; unrelated caches and settings preserved; empty-cache Hero offline response.');
})().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });
