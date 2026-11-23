/* Theme materials for the playable Canvas and its studio swatches. No images or network. */
export const CHESS_BOARD_ART = {
  iznikmavi: { surface:'glaze', rim:'#e4d3b0', deep:'#132958', metal:'#e3b878', ink:'#163d91', accent:'#b84432' },
  kizil: { surface:'sancak', rim:'#721d2b', deep:'#290c15', metal:'#ecbe71', ink:'#f3c582', accent:'#e68668' },
  bursa: { surface:'palace', rim:'#145746', deep:'#08261e', metal:'#e8be6a', ink:'#e4c58a', accent:'#60b69b' },
  sinan: { surface:'stone', rim:'#344b63', deep:'#151d2b', metal:'#d0dbea', ink:'#b4cedd', accent:'#6ea3bd' },
  safranbolu: { surface:'wood', rim:'#6e4024', deep:'#291609', metal:'#e6b669', ink:'#efc179', accent:'#b77848' },
  sedef: { surface:'ebru', rim:'#302242', deep:'#131124', metal:'#c8b0e2', ink:'#b593dc', accent:'#41b7d2' },
  canakkale: { surface:'stone', rim:'#29385a', deep:'#111930', metal:'#efc77b', ink:'#d7a36c', accent:'#ae6f4a' },
  kapadokya: { surface:'wood', rim:'#875e3e', deep:'#2d1d12', metal:'#e5bc78', ink:'#e1ad72', accent:'#a97448' },
  otag: { surface:'palace', rim:'#1c3269', deep:'#101931', metal:'#e9c485', ink:'#d3b882', accent:'#609bb8' }
};

const TAU = Math.PI * 2;
function grain(seed){
  let n = seed | 0;
  return () => { n = (Math.imul(n, 1664525) + 1013904223) | 0; return (n >>> 0) / 4294967296; };
}
function line(ctx,x,y,toX,toY){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();}
function rosette(ctx,x,y,r,petals=8){
  ctx.beginPath();
  for(let i=0;i<=petals*8;i++){
    const a=i*TAU/(petals*8), d=r*(.65+.35*Math.cos(petals*a));
    const xx=x+Math.cos(a)*d, yy=y+Math.sin(a)*d;
    if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);
  }
  ctx.closePath();ctx.stroke();
}
function metal(ctx,sz,skin){
  const g=ctx.createLinearGradient(0,0,sz,sz);
  [[0,skin.deep],[.10,skin.metal],[.22,'#fff1cc'],[.37,skin.metal],[.52,skin.deep],[.69,skin.metal],[.78,'#fff1cc'],[1,skin.deep]].forEach(([at,col])=>g.addColorStop(at,col));
  return g;
}
function filigree(ctx,sz,m,skin,ramp){
  const porcelain=skin.surface==='glaze', unit=m*.83;
  ctx.save();
  for(let side=0;side<4;side++){
    ctx.save();ctx.translate(sz/2,sz/2);ctx.rotate(side*Math.PI/2);ctx.translate(-sz/2,-sz/2);
    // Numbers occupy the left and bottom rail; tone the pattern down there.
    ctx.globalAlpha=(side===2||side===3) ? .46 : 1;
    ctx.lineWidth=Math.max(.55,m*.052);
    const count=Math.max(6,Math.floor((sz-3*m)/(1.55*m)));
    for(let i=0;i<count;i++){
      const a=1.5*m+(i+.5)*(sz-3*m)/count, cy=m*.49, p=unit*.49;
      ctx.strokeStyle=skin.ink;ctx.fillStyle=i%3===1?skin.accent:skin.ink;
      if(porcelain){
        ctx.beginPath();ctx.moveTo(a-p*1.5,cy+unit*.22);
        ctx.bezierCurveTo(a-p*.65,cy-unit*.37,a+p*.46,cy+unit*.32,a+p*1.55,cy-unit*.19);ctx.stroke();
        for(const dir of [-1,1]){
          ctx.beginPath();ctx.moveTo(a+dir*p*1.27,cy-dir*unit*.10);
          ctx.quadraticCurveTo(a+dir*p*.60,cy-dir*unit*.50,a+dir*p*.18,cy-dir*unit*.04);
          ctx.quadraticCurveTo(a+dir*p*.52,cy-dir*unit*.04,a+dir*p*1.27,cy-dir*unit*.10);ctx.fill();
        }
      }
      if(i%2===0||!porcelain){
        rosette(ctx,a,cy,unit*(porcelain?.245:.235),porcelain?6:8);
        ctx.beginPath();ctx.arc(a,cy,Math.max(.62,unit*.066),0,TAU);ctx.fill();
      }
    }
    ctx.restore();
  }
  for(const [x,y,large] of [[m*.54,m*.54],[sz-m*.54,m*.54],[m*.54,sz-m*.54],[sz-m*.54,sz-m*.54],[sz/2,m*.54,true],[sz/2,sz-m*.54,true]]){
    const rad=m*(large?.4:.31);
    ctx.fillStyle=porcelain?'#075c80':skin.deep;
    ctx.strokeStyle=ramp;ctx.lineWidth=Math.max(.7,m*.077);ctx.beginPath();
    for(let a=0;a<8;a++){
      const theta=TAU*a/8-Math.PI/2, r=rad*(a%2?.80:1.12), xx=x+Math.cos(theta)*r, yy=y+Math.sin(theta)*r;
      if(a)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);
    }
    ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle=skin.metal;ctx.lineWidth=Math.max(.5,m*.046);
    rosette(ctx,x,y,rad*.63,6);
  }
  ctx.restore();
}

function tileGrain(ctx,x,y,c,isLight,skin,random){
  const s=skin.surface;
  ctx.save();ctx.beginPath();ctx.rect(x,y,c,c);ctx.clip();
  if(s==='glaze'||s==='palace'||s==='sancak'){
    // Interlaced glaze, shallow enough that legal move rings remain dominant.
    ctx.strokeStyle=isLight?'rgba(111,79,43,.15)':s==='glaze'?'rgba(120,195,237,.34)':'rgba(250,213,152,.24)';
    ctx.lineWidth=Math.max(.48,c*.012);
    if(s!=='sancak'||!isLight)rosette(ctx,x+c*.5,y+c*.5,c*.27,s==='palace'?10:8);
    for(const a of [0,1])for(const b of [0,1]){
      const tx=x+(a?.77:.23)*c, ty=y+(b?.77:.23)*c;
      rosette(ctx,tx,ty,c*(s==='sancak'?.13:.17),s==='palace'?6:4);
    }
    ctx.strokeStyle=isLight?'rgba(255,255,255,.36)':'rgba(0,11,31,.39)';
    ctx.beginPath();ctx.moveTo(x,y+c*.5);ctx.quadraticCurveTo(x+c*.5,y-c*.16,x+c,y+c*.5);
    ctx.quadraticCurveTo(x+c*.5,y+c*1.16,x,y+c*.5);ctx.stroke();
    if(s==='sancak'&&!isLight){
      const u=x+c*.53,v=y+c*.49;ctx.beginPath();ctx.arc(u,v,c*.14,.90,5.32);ctx.stroke();
      ctx.beginPath();ctx.arc(u+.055*c,v,c*.12,1.2,5.10);ctx.stroke();
    }
  } else {
    const count=s==='wood'?20:s==='ebru'?12:7;
    for(let i=0;i<count;i++){
      const g=(i/count+random()*.04)*c, curve=(random()-.5)*c*.52;
      ctx.lineWidth=Math.max(.48,c*(s==='ebru'?.014:.009));
      ctx.strokeStyle=s==='ebru' ? (i%3===0?'rgba(200,92,211,.33)':'rgba(45,191,224,.28)') :
        s==='wood' ? (i%2===0?'rgba(255,232,175,.18)':'rgba(51,25,9,.27)') : (isLight?'rgba(56,72,96,.17)':'rgba(204,226,244,.23)');
      ctx.beginPath();ctx.moveTo(x-c*.10,y+g);
      ctx.bezierCurveTo(x+c*.27,y+g+curve,x+c*.52,y+g-curve*.88,x+c*1.10,y+g+(s==='stone'?c*.36:curve*.34));ctx.stroke();
    }
    if(s==='wood'){
      ctx.strokeStyle='rgba(55,30,10,.14)';ctx.lineWidth=Math.max(.5,c*.012);
      ctx.beginPath();ctx.ellipse(x+c*.58,y+c*.47,c*.24,c*.09,-.13,0,TAU);ctx.stroke();
    }
    if(s==='stone'){
      ctx.strokeStyle=isLight?'rgba(47,68,91,.24)':'rgba(207,226,243,.20)';
      rosette(ctx,x+c*.5,y+c*.5,c*.23,4);
    }
  }
  ctx.restore();
}

export function paintChessBoard(ctx,theme,skin,sz,m,cell){
  const ramp=metal(ctx,sz,skin), edge=Math.max(.65,m*.075);
  ctx.save();
  ctx.fillStyle=ramp;ctx.fillRect(0,0,sz,sz);
  const rail=ctx.createLinearGradient(0,0,sz*.71,sz);
  rail.addColorStop(0,skin.rim);rail.addColorStop(.55,skin.surface==='glaze'?'#f5e5c2':skin.deep);rail.addColorStop(1,skin.rim);
  ctx.fillStyle=rail;ctx.fillRect(edge*1.45,edge*1.45,sz-edge*2.9,sz-edge*2.9);
  ctx.strokeStyle=skin.deep;ctx.lineWidth=edge*.62;ctx.strokeRect(edge*1.55,edge*1.55,sz-edge*3.1,sz-edge*3.1);
  ctx.strokeStyle=skin.metal;ctx.lineWidth=edge*.32;ctx.strokeRect(edge*2.36,edge*2.36,sz-edge*4.72,sz-edge*4.72);
  filigree(ctx,sz,m,skin,ramp);
  ctx.strokeStyle=ramp;ctx.lineWidth=edge*2.04;ctx.strokeRect(m-edge,m-edge,cell*8+edge*2,cell*8+edge*2);
  ctx.strokeStyle=skin.deep;ctx.lineWidth=edge*.71;ctx.strokeRect(m+edge*.08,m+edge*.08,cell*8-edge*.16,cell*8-edge*.16);

  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const x=m+c*cell,y=m+r*cell,isLight=(r+c)%2===0;
    const shine=ctx.createLinearGradient(x,y,x+cell,y+cell);
    shine.addColorStop(0,isLight?theme.lightTile:theme.darkTile);shine.addColorStop(1,isLight?theme.light:theme.dark);
    ctx.fillStyle=shine;ctx.fillRect(x,y,cell,cell);
    tileGrain(ctx,x,y,cell,isLight,skin,grain(311+51*r+123*c));
    ctx.lineWidth=Math.max(.45,cell*.018);
    ctx.strokeStyle=isLight?'rgba(255,252,233,.63)':'rgba(214,202,161,.38)';
    ctx.beginPath();ctx.moveTo(x+.4,y+cell-.42);ctx.lineTo(x+.4,y+.4);ctx.lineTo(x+cell-.42,y+.4);ctx.stroke();
    ctx.strokeStyle='rgba(24,15,13,.42)';
    ctx.beginPath();ctx.moveTo(x+cell-.39,y+.4);ctx.lineTo(x+cell-.39,y+cell-.39);ctx.lineTo(x+.4,y+cell-.39);ctx.stroke();
  }
  ctx.restore();
}

export function paintChessCoords(ctx,skin,m,c,sz,flip){
  const cream=skin.surface==='glaze';
  ctx.save();ctx.font=`700 ${Math.max(8,Math.floor(c*.2))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle=cream?'#f1dfba':'#161625';ctx.fillStyle=cream?'#101d3b':'#fff0cd';
  ctx.lineWidth=Math.max(1,c*.045);ctx.lineJoin='round';
  const files=flip?'hgfedcba':'abcdefgh',ranks=flip?'12345678':'87654321';
  for(let i=0;i<8;i++){
    const a=m+i*c+c/2,b=m*.46,d=sz-m*.43;
    ctx.strokeText(files[i],a,d);ctx.fillText(files[i],a,d);ctx.strokeText(ranks[i],b,a);ctx.fillText(ranks[i],b,a);
  }
  ctx.restore();
}
