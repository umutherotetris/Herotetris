// Native sharing is a fixture; no message is sent by this test.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM});
 try{
  const page=await browser.newPage();await page.route('**/*',r=>new URL(r.request().url()).pathname==='/js/room-share.js'?r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'js/room-share.js'),'utf8')}):r.fulfill({contentType:'text/html',body:'<!doctype html><input id="focus"><script type="module">window.__share=await import("/js/room-share.js");</script>'}));
  await page.goto(base);await page.waitForFunction(()=>!!window.__share);
  let result=await page.evaluate(async()=>{window.__data=null;Object.defineProperty(navigator,'share',{configurable:true,writable:true,value:async data=>window.__data=data});return {result:await window.__share.shareRoomCode('chess','ABC123'),data:window.__data};});
  assert.equal(result.result,'shared');assert.match(result.data.text,/ABC123/);assert.equal(result.data.url,base+'/');console.log('PASS native sharing receives the game name, room code and portal link');
  result=await page.evaluate(async()=>{window.__copied=null;navigator.share=async()=>{throw new DOMException('Cancelled','AbortError');};Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__copied=text}});return {result:await window.__share.shareRoomCode('tavla','ABC123'),copied:window.__copied};});
  assert.equal(result.result,'cancelled');assert.equal(result.copied,null);console.log('PASS cancelling native sharing does not copy or claim success');
  result=await page.evaluate(async()=>{navigator.share=undefined;return {result:await window.__share.shareRoomCode('tetris','XYZ789'),copied:window.__copied};});
  assert.equal(result.result,'copied');assert.match(result.copied,/Tetris[\s\S]*XYZ789[\s\S]*http/);console.log('PASS clipboard fallback copies a usable invitation');
  result=await page.evaluate(async()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied');}}});document.execCommand=()=>false;document.getElementById('focus').focus();return {result:await window.__share.shareRoomCode('tavla','ABC123'),fields:document.querySelectorAll('textarea').length,focus:document.activeElement.id};});
  assert.equal(result.result,'unsupported');assert.equal(result.fields,0);assert.equal(result.focus,'focus');console.log('PASS denied copy reports failure and releases its temporary field');
  assert.equal(await page.evaluate(()=>window.__share.shareRoomCode('chess','')),'unsupported');console.log('PASS empty rooms cannot generate an invitation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
