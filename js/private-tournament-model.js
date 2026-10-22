export const TOURNAMENT_GAMES={chess:'Satranç',tavla:'Tavla',kelime:'Kelimecik',tetris:'Tetris'};
export const validTournamentCode=value=>typeof value==='string'&&/^[A-Z2-9]{8}$/.test(value);
export const validMemberUid=value=>typeof value==='string'&&/^[\w-]{1,128}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
export function tournamentMatches(members){
  const ids=Object.keys(members||{}).filter(validMemberUid).slice(0,8),matches={};
  if(ids.length<2)throw new Error('En az iki oyuncu gerekli');
  let round=0;const slots=[...ids];if(slots.length%2)slots.push(null);
  // Circle schedule: each member appears at most once in a round.
  for(let r=0;r<slots.length-1;r++){
    for(let i=0;i<slots.length/2;i++){
      const a=slots[i],b=slots[slots.length-1-i];if(a&&b)matches['m'+round++]={a,b,round:r+1,status:'pending',proposals:{}};
    }
    slots.splice(1,0,slots.pop());
  }
  return matches;
}
export function proposeTournamentResult(tournament,matchId,uid,result,now=Date.now()){
  if(!tournament||!['playing','complete'].includes(tournament.status)||!['a','b','draw'].includes(result))throw new Error('Sonuç bilgisi geçersiz');
  const match=tournament.matches?.[matchId];
  if(!match||![match.a,match.b].includes(uid))throw new Error('Yalnızca maçın oyuncuları sonuç bildirebilir');
  if(match.status==='complete')return tournament;
  if(tournament.status!=='playing')throw new Error('Turnuva tamamlanmış');
  const proposals={...match.proposals,[uid]:result},agreed=proposals[match.a]===proposals[match.b]&&['a','b','draw'].includes(proposals[match.a]);
  const updated={...match,proposals,status:agreed?'complete':'pending',...(agreed?{result,completedAt:now}:{})};
  const matches={...tournament.matches,[matchId]:updated};
  return {...tournament,matches,status:Object.values(matches).every(row=>row.status==='complete')?'complete':'playing'};
}
export function tournamentStandings(tournament){
  const rows=Object.entries(tournament?.members||{}).slice(0,8).map(([uid,v])=>({uid,name:String(v?.name||'Oyuncu').slice(0,40),points:0,played:0,wins:0})),byId=new Map(rows.map(row=>[row.uid,row]));
  const pairs=new Set();
  for(const match of Object.values(tournament?.matches||{}).slice(0,28)){
    // Recompute from two agreeing participants, never trust a stored point total.
    if(match?.status!=='complete'||match.proposals?.[match.a]!==match.result||match.proposals?.[match.b]!==match.result||!['a','b','draw'].includes(match.result))continue;
    const a=byId.get(match.a),b=byId.get(match.b);if(!a||!b||match.a===match.b||!validMemberUid(match.a)||!validMemberUid(match.b))continue;
    const pair=[match.a,match.b].sort().join(':');if(pairs.has(pair))continue;pairs.add(pair);a.played++;b.played++;
    if(match.result==='draw'){a.points++;b.points++;}else{const winner=match.result==='a'?a:b;winner.points+=3;winner.wins++;}
  }
  return rows.sort((a,b)=>b.points-a.points||b.wins-a.wins||a.name.localeCompare(b.name,'tr'));
}
