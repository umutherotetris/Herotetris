import { Auth } from './auth.js';
import { openPanel, element, button } from './portal-panels.js';

const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
export function puzzleWinner(board){return lines.some(line=>line.every(i=>board[i]==='X'))?'X':lines.some(line=>line.every(i=>board[i]==='O'))?'O':null;}
let catalog;
function puzzles(){
  if(catalog)return catalog;
  catalog=[];
  for(let code=0;code<19683;code++){
    let n=code;const board=Array.from({length:9},()=>{const cell=['','X','O'][n%3];n=Math.floor(n/3);return cell;});
    if(board.filter(c=>c==='X').length!==board.filter(c=>c==='O').length||puzzleWinner(board))continue;
    const wins=[];for(let i=0;i<9;i++)if(!board[i]){const next=[...board];next[i]='X';if(puzzleWinner(next)==='X')wins.push(i);}
    if(wins.length===1)catalog.push({board,answer:wins[0]});
  }
  return catalog;
}
export function dailyPuzzle(day=new Date().toISOString().slice(0,10)){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw new Error('Geçersiz gün');
  let hash=2166136261;for(const c of day){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
  const row=puzzles()[(hash>>>0)%puzzles().length];return {day,board:[...row.board],answer:row.answer,id:'hero-puzzle-1-'+day};
}
const saveKey=uid=>'hero_daily_puzzles:'+uid;
export function getPuzzleProgress(uid=Auth.getState().uid){
  if(!uid||Auth.getState().uid!==uid)return {};
  try{const raw=JSON.parse(localStorage.getItem(saveKey(uid))||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};}catch(_){return {};}
}
export function completeDailyPuzzle(puzzle,cell,uid=Auth.getState().uid){
  if(!uid||Auth.getState().uid!==uid)return {ok:false,error:'Hesap değişti'};
  const canonical=dailyPuzzle(puzzle?.day);if(puzzle?.id!==canonical.id||cell!==canonical.answer)return {ok:false,correct:false};
  if(canonical.day!==new Date().toISOString().slice(0,10))return {ok:false,error:'Yeni günün bulmacasını aç'};
  const previous=getPuzzleProgress(uid);if(previous[canonical.day])return {ok:true,already:true};
  const days=Object.keys(previous).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)).sort().slice(-59),next={};for(const day of days)next[day]=previous[day];next[canonical.day]={at:Date.now()};
  try{localStorage.setItem(saveKey(uid),JSON.stringify(next));return {ok:true,correct:true};}catch(_){return {ok:false,correct:true,error:'Çözdün; cihaz depolamasına kaydedilemedi'};}
}
export function openDailyPuzzle(){
  const uid=Auth.getState().uid,puzzle=dailyPuzzle(),panel=openPanel({id:'dailyPuzzleCenter',title:'Günün bulmacası',subtitle:puzzle.day+' · Herkese aynı bulmaca · UTC',uid});
  const intro=element('div','pc-card');intro.append(element('h3','','Tek hamlede kazan'),element('p','pc-muted','Sıra X’te. Üç X’i aynı çizgiye getiren tek kareyi bul.'));
  const board=element('div','pc-puzzle-board');board.setAttribute('aria-label','Üçe üç bulmaca tahtası');
  const feedback=element('p','pc-muted');feedback.setAttribute('role','status');
  let finished=!!getPuzzleProgress(uid)[puzzle.day],attempts=0;
  puzzle.board.forEach((cell,i)=>{
    const tile=button(cell||'·',()=>{
      if(finished||!panel.current())return;attempts++;
      const result=completeDailyPuzzle(puzzle,i,uid);
      if(result.correct||result.ok){finished=true;tile.textContent='X';tile.setAttribute('aria-label',tile.getAttribute('aria-label').replace('boş','X'));tile.classList.add('win');board.querySelectorAll('button').forEach(b=>b.disabled=true);feedback.textContent=result.error||'Çözüldü! '+attempts+' denemede doğru hamleyi buldun.';}
      else feedback.textContent=result.error||'Bu kare üçlü oluşturmuyor. Yeniden bak: yatay, dikey ve çapraz çizgiler.';
    },'pc-puzzle-cell');
    tile.disabled=!!cell||finished;tile.setAttribute('aria-label',(Math.floor(i/3)+1)+'. satır '+(i%3+1)+'. sütun: '+(cell||'boş'));board.append(tile);
  });
  if(finished){board.children[puzzle.answer].textContent='X';board.children[puzzle.answer].classList.add('win');feedback.textContent='Bugünün bulmacasını tamamladın. Yeni bulmaca yarın.';}
  const hint=button('Bir ipucu',()=>{feedback.textContent='İki X bulunan ve üçüncü karesi boş olan bir çizgi ara. Rakibin O taşlarını atlayamazsın.';});
  panel.body.append(intro,board,feedback,hint,element('small','pc-muted','Bulmaca başarıların bu hesap için bu cihazda saklanır. Kaju veya sıralama puanı vermez.'));
  return panel;
}
