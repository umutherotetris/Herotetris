// Real storage modules; malformed fields must not erase valid progress.
import assert from 'node:assert/strict';
const values=new Map();
globalThis.localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
const {Stats}=await import('../js/games/tetris-stats.js');
const {getProgress,isWorldUnlocked,completeWorld,calcStars}=await import('../js/games/tetris-adventure.js');
const put=(key,value)=>values.set(key,JSON.stringify(value));
{
 values.clear();put('hero_tetris_achievements',{});
 assert.doesNotThrow(()=>Stats.recordGame({score:100,lines:1,hero:'vor'}),'a corrupt achievements object cannot break game completion');
 assert.equal(Stats.get().gamesPlayed,1);assert.equal(Stats.get().totalScore,100);
 assert.ok(Stats.getUnlocked().includes('first_game'));
 console.log('PASS corrupt achievements recover while recording the completed game.');
}
{
 values.clear();
 put('hero_tetris_stats',{gamesPlayed:5,totalScore:3400,totalLines:19,totalTetris:2,bestScore:1300,bestCombo:4,maxLevel:7,powersUsed:3,gemsUsed:5,aiWins:1,vsWins:2,bossesBeaten:1,favoriteHero:'vor',heroPlays:{vor:3,neks:2,constructor:900,unknown:4},unexpected:99});
 put('hero_tetris_achievements',['first_game','first_game','unknown',null,7]);
 assert.deepEqual(Stats.getUnlocked(),['first_game']);
 Stats.recordGame({score:200,lines:2,tetrisCount:1,combo:2,level:3,powersUsed:1,gemsUsed:2,hero:'neks',won:true,mode:'ai'});
 const s=Stats.get();assert.equal(s.gamesPlayed,6);assert.equal(s.totalScore,3600);assert.equal(s.totalLines,21);assert.equal(s.totalTetris,3);
 assert.equal(s.bestScore,1300);assert.equal(s.maxLevel,7);assert.equal(s.bestCombo,4);assert.equal(s.powersUsed,4);assert.equal(s.gemsUsed,7);assert.equal(s.aiWins,2);
 assert.deepEqual(s.heroPlays,{vor:3,neks:3});assert.equal(Object.hasOwn(s,'unexpected'),false);
 console.log('PASS valid statistics and hero counts survive field filtering and normal updates.');
}
{
 values.clear();
 put('hero_tetris_stats',{gamesPlayed:Number.MAX_SAFE_INTEGER,totalScore:10,totalLines:-1,bestCombo:'invalid',maxLevel:0,heroPlays:[],favoriteHero:'unknown'});
 put('hero_tetris_achievements','not-an-array');
 assert.doesNotThrow(()=>Stats.recordGame({score:Infinity,lines:-4,combo:NaN,level:-2,powersUsed:'bad',hero:'__proto__',won:'yes',mode:'ai'}));
 const s=Stats.get();assert.equal(s.gamesPlayed,Number.MAX_SAFE_INTEGER);assert.equal(s.totalScore,10);assert.equal(s.totalLines,0);assert.equal(s.bestCombo,0);assert.equal(s.maxLevel,1);assert.equal(s.aiWins,0);assert.deepEqual(s.heroPlays,{});assert.equal(s.favoriteHero,null);
 for(const [key,value] of Object.entries(s))if(typeof value==='number')assert.ok(Number.isSafeInteger(value)&&value>=0,`${key} stays a safe nonnegative integer`);
 console.log('PASS malformed counters, inputs and overflowing lifetime counts stay bounded.');
}
{
 values.clear();Stats.recordGame({});const s=Stats.get();
 assert.equal(s.gamesPlayed,1);assert.equal(s.totalScore,0);assert.equal(s.totalLines,0);assert.equal(s.totalTetris,0);assert.equal(s.powersUsed,0);assert.equal(s.gemsUsed,0);
 console.log('PASS absent per-game counters add no artificial score or usage.');
}
{
 values.clear();put('hero_tetris_adventure',{completed:{},stars:{2:3}});
 assert.doesNotThrow(()=>isWorldUnlocked(2));assert.equal(isWorldUnlocked(2),false);
 assert.doesNotThrow(()=>completeWorld(1,2));assert.deepEqual(getProgress(),{completed:[1],stars:{1:2,2:3}});
 assert.equal(isWorldUnlocked(2),true);
 console.log('PASS corrupt completed-world shape recovers without discarding valid star records.');
}
{
 values.clear();put('hero_tetris_adventure',{completed:['1',1,1,2,0,-1,9,null],stars:{1:3,2:2,3:0,4:4,8:1,constructor:2,unknown:3}});
 assert.deepEqual(getProgress(),{completed:[1,2],stars:{1:3,2:2,8:1}});
 completeWorld(2,1);assert.equal(getProgress().stars[2],2,'a lower replay result cannot reduce saved stars');
 completeWorld(3,3);assert.deepEqual(getProgress(),{completed:[1,2,3],stars:{1:3,2:2,3:3,8:1}});
 const before=JSON.stringify(getProgress());for(const id of [-1,0,9,'2',null]){assert.equal(isWorldUnlocked(id),false);completeWorld(id,3);}
 for(const stars of [-1,0,4,NaN,'3',null])completeWorld(4,stars);
 assert.equal(JSON.stringify(getProgress()),before,'invalid world/star inputs do not modify valid progress');
 assert.equal(calcStars(2,38),3,'existing star calculation is unchanged');
 console.log('PASS valid progress survives ID/range filtering and invalid completion calls.');
}
