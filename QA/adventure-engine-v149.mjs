import assert from 'node:assert/strict';
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v))};
const {WORLDS,calcStars,completeWorld,getProgress}=await import('../js/games/tetris-adventure.js');
for(const w of WORLDS){
 assert.equal(calcStars(w.id,w.target-1),0,'an incomplete world has no completion stars');
 assert.equal(calcStars(w.id,w.target),1);
 assert.equal(calcStars(w.id,w.target+1),2,'a finishing double can earn two stars in every world');
 assert.equal(calcStars(w.id,w.target+2),3,'a finishing triple can earn three stars in every world');
 for(let extra=0;extra<=3;extra++){
  const previous=w.target-1,finalClear=extra+1;
  assert.ok(finalClear<=4,'normal four-row mechanics suffice');
  assert.equal(calcStars(w.id,previous+finalClear),Math.min(extra+1,3));
 }
}
console.log('PASS all eight worlds have reachable one/two/three-star finishes with normal clears.');
for(const n of [NaN,Infinity,-1,'40',null])assert.equal(calcStars(3,n),0);
for(const id of [0,9,'1',null])assert.equal(calcStars(id,100),0);
console.log('PASS incomplete or invalid adventure results cannot produce completion stars.');
completeWorld(2,3);completeWorld(2,1);assert.equal(getProgress().stars[2],3);
console.log('PASS existing earned stars are preserved on lower replay results.');
