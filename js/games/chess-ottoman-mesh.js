// Runtime WebGL rendering of the original mesh, not an image asset. Rasterize
// into the existing 2D draw path once per color, so pointer hit-testing, board
// orientation, dragging and animation do not require a second board.
import { loadOttomanPieces as loadFallback, drawOttomanPiece as drawFallback } from './chess-ottoman.js';

const URLS = Object.fromEntries([...'rnbqkp'].map(piece=>[piece,new URL(`../../assets/ottoman-v163/ottoman-${piece}.glb`,import.meta.url).href]));
const HEIGHT_FRAC={k:.965,q:.94,b:.92,n:.91,r:.88,p:.83};
const DEFAULT_YAW=.23, PIECE_YAW={n:.72,b:-.49};
const TILE = 160;
let tiles, loading;
export function readChessMesh(buffer) {
  const dv = new DataView(buffer);
  if(dv.byteLength>330000)throw Error('Over the chess asset budget');
  if (dv.byteLength < 28 || dv.getUint32(0,true) !== 0x46546c67 ||
      dv.getUint32(4,true) !== 2 || dv.getUint32(8,true) !== dv.byteLength) throw Error('Invalid GLB');
  const jsonSize = dv.getUint32(12,true), bin = 20 + jsonSize;
  if (bin + 8 > dv.byteLength || dv.getUint32(16,true) !== 0x4e4f534a ||
      dv.getUint32(bin+4,true) !== 0x004e4942 || bin+8+dv.getUint32(bin,true) !== dv.byteLength) throw Error('Invalid GLB chunks');
  const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonSize)));
  // Only accepts our bundled, uncompressed, single-primitive mesh.
  const prim = doc.meshes?.[0]?.primitives?.[0];
  if (!prim || (prim.mode != null && prim.mode !== 4)) throw Error('Invalid chess mesh');
  function data(index, type, component, Ctor, width) {
    const a = doc.accessors?.[index], b = doc.bufferViews?.[a?.bufferView];
    if (!a || !b || a.sparse || b.buffer !== 0 || b.byteStride ||
        a.type !== type || a.componentType !== component ||
        !Number.isSafeInteger(a.count) || a.count < 1 || a.count > 300000) throw Error('Invalid mesh accessor');
    const byte = (b.byteOffset ?? 0) + (a.byteOffset ?? 0), bytes = a.count * width * Ctor.BYTES_PER_ELEMENT;
    if (!Number.isSafeInteger(byte) || byte < 0 || byte + bytes > dv.getUint32(bin,true) ||
        (a.byteOffset ?? 0) + bytes > b.byteLength) throw Error('Invalid mesh buffer view');
    return new Ctor(buffer, bin+8+byte, a.count * width);
  }
  const position = data(prim.attributes.POSITION,'VEC3',5126,Float32Array,3);
  const normal = data(prim.attributes.NORMAL,'VEC3',5126,Float32Array,3);
  const region = data(prim.attributes._REGION,'SCALAR',5121,Uint8Array,1);
  const palettes=Object.fromEntries(['w','b'].map(side=>{
    const list=doc.extras?.heroTeamPalettes?.[side];
    if(!Array.isArray(list)||list.length<4||list.length>8||!list.every(value=>/^#[0-9A-F]{8}$/i.test(value)))throw Error('Invalid mesh palette');
    const data=new Float32Array(24);
    data.set(list.flatMap(value=>[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255)));
    return [side,{data, length:list.length}];
  }));
  const component = doc.accessors?.[prim.indices]?.componentType;
  if (component !== 5123 && component !== 5125) throw Error('Invalid index type');
  const indices = data(prim.indices,'SCALAR',component,component===5123 ? Uint16Array : Uint32Array,1);
  if (indices.length % 3 || normal.length !== position.length ||
      region.length!==position.length/3 || palettes.w.length!==palettes.b.length || region.some(i=>i>=palettes.w.length) || indices.some(i=>i>=position.length/3) || !position.every(Number.isFinite) || !normal.every(Number.isFinite)) throw Error('Invalid mesh geometry');
  const lo=[Infinity,Infinity,Infinity], hi=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<position.length;i+=3) for(let k=0;k<3;k++){
    lo[k]=Math.min(lo[k],position[i+k]); hi[k]=Math.max(hi[k],position[i+k]);
  }
  if (hi[1]-lo[1] < 1e-6) throw Error('Empty geometry');
  for(let i=0;i<indices.length;i+=3) if(region[indices[i]]!==region[indices[i+1]]||region[indices[i]]!==region[indices[i+2]])throw Error('Mixed region on a face');
  return { position, normal, indices, region, palettes, lo, hi, placeholder:doc.extras?.heroPlaceholder===true };
}

const VS = `#version 300 es
in vec3 aPosition,aNormal;
in float aRegion;
uniform vec3 uCenter;
uniform float uScale;
uniform float uYaw;
uniform vec2 uOffset;
out vec3 n;
flat out int region;
vec3 camera(vec3 p){
  float yaw=uYaw, tilt=.24;
  vec3 q=vec3(cos(yaw)*p.x-sin(yaw)*p.z,p.y,sin(yaw)*p.x+cos(yaw)*p.z);
  return vec3(q.x,cos(tilt)*q.y-sin(tilt)*q.z,sin(tilt)*q.y+cos(tilt)*q.z);
}
void main(){
  vec3 p=camera((aPosition-uCenter)*uScale);
  gl_Position=vec4(p.xy+uOffset,clamp(-p.z*.65,-.99,.99),1.);
  n=camera(aNormal);
  region=int(aRegion);
}`;
const FS = `#version 300 es
precision mediump float;
in vec3 n;
flat in int region;
uniform vec3 uPalette[8];
out vec4 frag;
void main(){
  vec3 v=normalize(n), l=normalize(vec3(-.6,.8,.65));
  float diffuse=max(dot(v,l),0.), fill=max(dot(v,normalize(vec3(.85,.25,.6))),0.);
  float edge=pow(1.-abs(v.z),2.);
  float sheen=pow(max(dot(v,normalize(l+vec3(0.,0.,1.))),0.),20.);
  frag=vec4(uPalette[region]*(.82+.34*diffuse+.19*fill)+vec3(.105)*edge+vec3(.10)*sheen,1.);
}`;
// Keep the calibrated silhouette inside the cell, with a common baseline.
export function fitChessTile(mesh,piece) {
  const center=mesh.lo.map((x,i)=>(x+mesh.hi[i])/2);
  const yaw=PIECE_YAW[piece]??DEFAULT_YAW,tilt=.24,c=Math.cos(yaw),s=Math.sin(yaw),cu=Math.cos(tilt),su=Math.sin(tilt);
  let lx=Infinity,hx=-Infinity,ly=Infinity,hy=-Infinity;
  for(let i=0;i<mesh.position.length;i+=3){
    const u=mesh.position[i]-center[0],v=mesh.position[i+1]-center[1],w=mesh.position[i+2]-center[2];
    const x=c*u-s*w,y=cu*v-su*(s*u+c*w);
    lx=Math.min(lx,x);hx=Math.max(hx,x);ly=Math.min(ly,y);hy=Math.max(hy,y);
  }
  const scale=Math.min(1.90/(hx-lx),2*HEIGHT_FRAC[piece]/(hy-ly));
  return {scale,center,yaw,offset:[-(lx+hx)*scale/2,-.95-ly*scale],
          projected:[(hx-lx)*scale,(hy-ly)*scale]};
}
function buildTiles(gl, mesh, piece) {
  const resources=[];
  const program=gl.createProgram();
  const shader=(type,source)=>{
    const sh=gl.createShader(type); resources.push(['deleteShader',sh]);
    gl.shaderSource(sh,source);gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw Error('WebGL shader failed');
    return sh;
  };
  try {
    gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('WebGL GLB renderer failed');
    gl.useProgram(program);gl.viewport(0,0,TILE,TILE);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    function bind(target,data){
      const b=gl.createBuffer();resources.push(['deleteBuffer',b]);
      gl.bindBuffer(target,b); gl.bufferData(target,data,gl.STATIC_DRAW);
    }
    for(const [attr,data,size,kind] of [['aPosition',mesh.position,3,gl.FLOAT],['aNormal',mesh.normal,3,gl.FLOAT],['aRegion',mesh.region,1,gl.UNSIGNED_BYTE]]){
      bind(gl.ARRAY_BUFFER,data);
      const location=gl.getAttribLocation(program,attr);
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,kind,false,0,0);
    }
    bind(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
    const space=fitChessTile(mesh,piece);
    gl.uniform3fv(gl.getUniformLocation(program,'uCenter'),space.center);
    gl.uniform2fv(gl.getUniformLocation(program,'uOffset'),space.offset);
    gl.uniform1f(gl.getUniformLocation(program,'uScale'),space.scale);
    gl.uniform1f(gl.getUniformLocation(program,'uYaw'),space.yaw);
    const layers=new Map();
    for(const side of ['w','b']){
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform3fv(gl.getUniformLocation(program,'uPalette[0]'),mesh.palettes[side].data);
      gl.drawElements(gl.TRIANGLES,mesh.indices.length,mesh.indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,0);
      if(gl.isContextLost() || gl.getError()!==gl.NO_ERROR) throw Error('Mesh draw failed');
      const copy=document.createElement('canvas');copy.width=copy.height=TILE;
      copy.getContext('2d').drawImage(gl.canvas,0,0);
      layers.set(side,copy);
    }
    return layers;
  } finally {
    for(const [remove,resource] of resources) gl[remove](resource);
    gl.deleteProgram(program);
  }
}
async function loadMeshes(onReady){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TILE;
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});
  if(!gl)return;
  await Promise.allSettled(Object.entries(URLS).map(async ([piece,url])=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    let buffer;
    try {
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw Error('Missing chess model');
      buffer=await response.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
    // Synchronous GL submission inside each task avoids shared-context races;
    // yielding first gives input and the 2D fallback a chance to draw.
    await new Promise(r=>setTimeout(r,0));
    tiles.set(piece,buildTiles(gl,readChessMesh(buffer),piece));
    if(typeof onReady==='function')onReady();
  }));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
}
export async function loadOttomanPieces(onReady){
  if(!loading){
    tiles=new Map();
    loading=loadMeshes(onReady).then(()=>Boolean(tiles.size)).catch(()=>false);
  }
  const [fallback,models]=await Promise.all([loadFallback(onReady),loading]);
  return fallback||models;
}

export function drawOttomanPiece(ctx,cx,cy,cell,piece){
  const mesh=tiles?.get(piece?.t)?.get(piece.c);
  if(!mesh) return drawFallback(ctx,cx,cy,cell,piece);
  const size=cell;
  ctx.save();
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();
  ctx.ellipse(cx,cy+cell*.445,cell*.235,cell*.033,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(mesh,cx-size/2,cy-size/2,size,size);
  ctx.restore();
  return true;
}
