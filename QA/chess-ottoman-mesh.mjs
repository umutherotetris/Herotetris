import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {fitChessTile,readChessMesh} from '../js/games/chess-ottoman-mesh.js';
const PIECES=[...'rnbqkp'];
const path=kind=>new URL(`../assets/ottoman-v163/ottoman-${kind}.glb`,import.meta.url);

test('All six model assets are small, indexed, genuinely 3D, multi-region and safe within a cell', async ()=>{
  let bytes=0;
  for(const p of PIECES){
    const disk=await readFile(path(p));
    const glb=disk.buffer.slice(disk.byteOffset,disk.byteOffset+disk.byteLength);
    const m=readChessMesh(glb);
    bytes+=glb.byteLength;
    assert.ok(glb.byteLength<250_000);
    assert.ok(m.indices.length/3 >= 7300 && m.indices.length/3 <= 10500);
    assert.ok(m.hi.every((max,k)=>max-m.lo[k]>.008));
    assert.ok(m.hi[1]-m.lo[1]>=.038&&m.hi[1]-m.lo[1]<=.051);
    assert.equal(new Set(m.region).size,p==='k'?8:4);
    assert.deepEqual([...m.palettes.w.data.slice(15,18)],[...m.palettes.b.data.slice(15,18)]);
    if(p==='k') assert.notDeepEqual([...m.palettes.w.data.slice(21,24)],[...m.palettes.b.data.slice(21,24)]);
    assert.notDeepEqual([...m.palettes.w.data.slice(0,3)],[...m.palettes.b.data.slice(0,3)]);
    assert.equal(m.placeholder,false);
    const tile=fitChessTile(m,p);
    assert.ok(tile.projected[0]<=1.901&&tile.projected[1]<=1.931);
    assert.ok(tile.projected[1]>=(p==='p'?1.65:1.75), 'stone fills most of cell vertically');
    assert.ok(-.95+tile.projected[1]<.99, 'stone does not clip at top');
    assert.ok(tile.projected[0]>0&&tile.projected[1]>0);
    assert.throws(()=>readChessMesh(glb.slice(0,-12)),/Invalid GLB/);
    const badChunks=glb.slice(0);
    new DataView(badChunks).setUint32(12,0xffffffff,true);
    assert.throws(()=>readChessMesh(badChunks),/Invalid GLB/);
  }
  assert.ok(bytes<1_200_000);
});

test('Missing WebGL and failed model downloads preserve all six 2D sprites in both teams', async ()=>{
  const previous={Image:globalThis.Image,document:globalThis.document,fetch:globalThis.fetch};
  try{
    globalThis.Image=class{
      set src(value){
        assert.ok(value.endsWith('chess-ottoman-3d-v162.webp'));
        this.naturalWidth=864;this.naturalHeight=288;
        queueMicrotask(()=>this.onload());
      }
    };
    let requests=[];
    globalThis.fetch=async url=>{
      assert.match(url,/ottoman-[rnbqkp]\.glb$/);
      requests.push(url);return {ok:false,status:404};
    };
    for(const hasWebGL of [false,true]){
      globalThis.document={createElement:()=>({getContext:()=>hasWebGL ? {getExtension:()=>null}:null})};
      const {loadOttomanPieces,drawOttomanPiece}=await import('../js/games/chess-ottoman-mesh.js?fallback='+hasWebGL);
      let notified=0;
      assert.equal(await loadOttomanPieces(()=>notified++),true);
      assert.equal(notified,1);
      assert.equal(new Set(requests).size,hasWebGL ? 6 : 0);
      const calls=[];
      const context={drawImage:(...coords)=>calls.push(coords)};
      for(const [c,t] of PIECES.entries()){
        for(const [color,y] of [['w',0],['b',144]]){
          assert.equal(drawOttomanPiece(context,30,50,40,{t,c:color}),true);
          assert.deepEqual(calls.at(-1).slice(1,5),[c*144,y,144,144]);
        }
      }
    }
  }finally{Object.assign(globalThis,previous);}
});

test('One missing model falls back independently; both colors of all other models still use 3D tiles', async ()=>{
  const previous={Image:globalThis.Image,document:globalThis.document,fetch:globalThis.fetch};
  try{
    globalThis.Image=class{
      set src(_) { this.naturalWidth=864; this.naturalHeight=288; queueMicrotask(()=>this.onload()); }
    };
    let submitted=0, snapshot=0;
    const noop=()=>{};
    const gl=new Proxy({
      getProgramParameter:()=>true,getShaderParameter:()=>true,isContextLost:()=>false,
      getError:()=>0,NO_ERROR:0,getExtension:()=>null,drawElements:()=>submitted++,
      canvas:{gl:true}
    },{get(target,name){return target[name]??noop}});
    globalThis.document={createElement:()=>({
      getContext:(kind)=>kind==='webgl2'?gl:{drawImage:source=>{assert.equal(source,gl.canvas);snapshot++;}}
    })};
    globalThis.fetch=async url=>{
      const kind=url.match(/ottoman-([a-z]).glb$/)[1];
      if(kind==='k')return {ok:false};
      const raw=await readFile(path(kind));
      return {ok:true,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)};
    };
    const {loadOttomanPieces,drawOttomanPiece}=await import('../js/games/chess-ottoman-mesh.js?partial');
    let notifies=0;
    assert.equal(await loadOttomanPieces(()=>notifies++),true);
    assert.equal(notifies,6,'2D atlas first then five loaded mesh notifications');
    assert.equal(submitted,10);
    assert.equal(snapshot,10);
    for(const t of PIECES)for(const c of ['w','b']){
      let args;
      const ctx={drawImage:(...params)=>{args=params},save:noop,beginPath:noop,ellipse:noop,fill:noop,restore:noop};
      assert.equal(drawOttomanPiece(ctx,50,50,42,{t,c}),true);
      assert.equal(args.length,t==='k'?9:5);
    }
  }finally{Object.assign(globalThis,previous);}
});
