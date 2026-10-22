import { Auth, db, fdb } from './auth.js';
import { openPanel, element, button } from './portal-panels.js';
import { TOURNAMENT_GAMES,validTournamentCode,validMemberUid,tournamentMatches,proposeTournamentResult,tournamentStandings } from './private-tournament-model.js';

const owner=uid=>Auth.getState().uid===uid&&Auth.getState().status==='google';
const path=code=>'privateTournaments/'+code;
const memoryKey=uid=>'hero_private_tournaments:'+uid;
function remember(uid,code){if(!owner(uid))return;try{const rows=JSON.parse(localStorage.getItem(memoryKey(uid))||'[]');localStorage.setItem(memoryKey(uid),JSON.stringify([code,...(Array.isArray(rows)?rows:[]).filter(c=>c!==code&&validTournamentCode(c))].slice(0,16)));}catch(_){}}
function known(uid){try{const rows=JSON.parse(localStorage.getItem(memoryKey(uid))||'[]');return Array.isArray(rows)?rows.filter(validTournamentCode).slice(0,16):[];}catch(_){return [];}}
const valid=data=>data&&data.v===1&&validMemberUid(data.ownerUid)&&Object.hasOwn(TOURNAMENT_GAMES,data.game)&&data.members&&Object.keys(data.members).length<=8&&['waiting','playing','complete','cancelled'].includes(data.status);
function makeCode(){const bytes=new Uint8Array(8);globalThis.crypto.getRandomValues(bytes);const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');}
export async function createPrivateTournament({name,game},uid=Auth.getState().uid){
  if(!owner(uid)||!validMemberUid(uid)||!Object.hasOwn(TOURNAMENT_GAMES,game))throw new Error('Giriş ve oyun seçimi gerekli');
  const pendingKey='hero_private_creation:'+uid,nick=String(Auth.getState().displayName||'Oyuncu').slice(0,40),cleanName=String(name||'Arkadaşlar turnuvası').trim().slice(0,60);
  let pending;try{pending=JSON.parse(localStorage.getItem(pendingKey)||'null');}catch(_){}
  if(!validTournamentCode(pending?.code)||pending?.record?.ownerUid!==uid||pending.record.name!==cleanName||pending.record.game!==game)pending={code:makeCode(),record:{v:1,ownerUid:uid,name:cleanName,game,status:'waiting',createdAt:Date.now(),members:{[uid]:{name:nick,joinedAt:Date.now()}}}};
  const {code,record}=pending;
  try{localStorage.setItem(pendingKey,JSON.stringify(pending));}catch(_){throw new Error('Turnuva kurtarma kaydı bu cihaza yazılamadı');}
  remember(uid,code);
  let result;
  try{result=await fdb.runTransaction(fdb.ref(db,path(code)),saved=>{if(owner(uid)&&!saved)return record;},{applyLocally:false});}
  catch(_){/* An uncertain acknowledgement is checked against the same code. */}
  if(!owner(uid))throw new Error('Hesap değişti');
  let saved;try{saved=result?.committed?result.snapshot.val():(await fdb.get(fdb.ref(db,path(code)))).val();}catch(_){throw new Error('Turnuva onayı alınamadı. '+code+' kodu Turnuvalarım bölümünde korunuyor.');}
  if(!owner(uid))throw new Error('Hesap değişti');
  if(!valid(saved)||saved.ownerUid!==uid||saved.createdAt!==record.createdAt||saved.game!==record.game)throw new Error('Turnuva oluşturulamadı. Aynı bilgilerle yeniden deneyebilirsin.');
  try{localStorage.removeItem(pendingKey);}catch(_){}return code;
}
export async function joinPrivateTournament(code,uid=Auth.getState().uid){
  code=String(code||'').toUpperCase().trim();if(!owner(uid)||!validTournamentCode(code)||!validMemberUid(uid))throw new Error('Sekiz karakterli turnuva kodunu gir');
  await fdb.get(fdb.ref(db,path(code)));if(!owner(uid))throw new Error('Hesap değişti');
  const nick=String(Auth.getState().displayName||'Oyuncu').slice(0,40);let reason='Turnuva bulunamadı';
  const result=await fdb.runTransaction(fdb.ref(db,path(code)),saved=>{
    if(!owner(uid)||!valid(saved))return;
    if(saved.members[uid]){reason='member';return;}
    if(saved.status!=='waiting'){reason='Bu turnuvaya katılım kapanmış';return;}
    if(Object.keys(saved.members).length>=8){reason='Turnuva dolu';return;}
    return {...saved,members:{...saved.members,[uid]:{name:nick,joinedAt:Date.now()}}};
  },{applyLocally:false});
  if(!owner(uid))throw new Error('Hesap değişti');
  if(!result.committed&&reason!=='member')throw new Error(reason);remember(uid,code);return code;
}
export async function updatePrivateTournament(code,action,payload={},uid=Auth.getState().uid){
  if(!owner(uid)||!validTournamentCode(code))throw new Error('Hesap veya kod geçersiz');let reason='İşlem kaydedilemedi';
  await fdb.get(fdb.ref(db,path(code)));if(!owner(uid))throw new Error('Hesap değişti');
  const result=await fdb.runTransaction(fdb.ref(db,path(code)),saved=>{
    if(!owner(uid)||!valid(saved)||!saved.members[uid])return;
    try{
      if(action==='result')return proposeTournamentResult(saved,payload.matchId,uid,payload.result);
      if(saved.ownerUid!==uid){reason='Bu işlem turnuva kurucusuna ait';return;}
      if(action==='start'&&saved.status==='waiting')return {...saved,status:'playing',startedAt:Date.now(),matches:tournamentMatches(saved.members)};
      if(action==='cancel'&&['waiting','playing'].includes(saved.status))return {...saved,status:'cancelled',cancelledAt:Date.now()};
    }catch(error){reason=error.message;}
  },{applyLocally:false});
  if(!owner(uid))throw new Error('Hesap değişti');if(!result.committed)throw new Error(reason);return result.snapshot.val();
}
export function openPrivateTournaments(){
  const me=Auth.getState(),uid=me.uid,panel=openPanel({id:'privateTournamentCenter',title:'Özel mini turnuva',subtitle:'2–8 arkadaş · Herkes herkesle · Ortak sonuç onayı',uid});
  if(me.status!=='google'){panel.body.append(element('p','pc-empty','Arkadaşlarınla turnuva kurmak için hesabını bağla.'));return panel;}
  let busy=false,off=()=>{},selected=null,epoch=0;
  const home=element('div','pc-list'),detail=element('div','pc-list');panel.body.append(home,detail);
  panel.cleanup(()=>{epoch++;off();});
  async function act(task){if(busy||!panel.current())return;busy=true;panel.dialog.setAttribute('aria-busy','true');panel.message('İşlem kaydediliyor…');
    try{const result=await task();if(panel.current())panel.message('Kaydedildi.');return result;}
    catch(error){panel.message(error?.message||'Bağlantı veya veritabanı izni nedeniyle işlem tamamlanamadı.',true);}
    finally{busy=false;if(panel.current())panel.dialog.removeAttribute('aria-busy');}
  }
  function lobby(){
    home.replaceChildren();detail.replaceChildren();off();epoch++;selected=null;
    const create=element('form','pc-card'),title=element('h3','','Turnuva kur'),name=element('input','pc-input');name.placeholder='Turnuva adı';name.maxLength=60;name.setAttribute('aria-label','Turnuva adı');
    const game=element('select','pc-input');game.setAttribute('aria-label','Turnuva oyunu');for(const [id,label]of Object.entries(TOURNAMENT_GAMES)){const opt=element('option','',label);opt.value=id;game.append(opt);}
    const createButton=button('Turnuvayı oluştur',null,'pc-button primary');createButton.type='submit';create.append(title,name,game,createButton);
    create.addEventListener('submit',async event=>{event.preventDefault();const code=await act(()=>createPrivateTournament({name:name.value,game:game.value},uid));if(code&&panel.current())watch(code);});
    const join=element('form','pc-card'),code=element('input','pc-input');code.placeholder='8 karakterli kod';code.maxLength=8;code.autocapitalize='characters';code.setAttribute('aria-label','Turnuva kodu');
    const joinButton=button('Katıl',null);joinButton.type='submit';join.append(element('h3','','Koda katıl'),code,joinButton);join.addEventListener('submit',async event=>{event.preventDefault();const result=await act(()=>joinPrivateTournament(code.value,uid));if(result&&panel.current())watch(result);});
    home.append(create,join,element('small','pc-muted','Özel turnuvalar Kaju ücreti veya otomatik ödül içermez. Oyuncular maç sonucunu aynı biçimde onaylayınca puan işlenir. 3 puan galibiyet, 1 puan beraberlik.'));
    const recent=known(uid);if(recent.length){home.append(element('h3','','Turnuvalarım'));recent.forEach(code=>home.append(button(code+' →',()=>watch(code))));}
  }
  function watch(code){
    off();selected=code;const token=++epoch;home.replaceChildren();detail.replaceChildren(element('p','pc-muted','Turnuva yükleniyor…'));
    off=fdb.onValue(fdb.ref(db,path(code)),snapshot=>{if(!panel.current()||token!==epoch)return;const data=snapshot.val();if(!valid(data)||!data.members[uid]){detail.replaceChildren(button('← Geri',lobby),element('p','pc-empty','Turnuva kaydı bulunamadı veya katılımcı değilsin.'));return;}remember(uid,code);render(data,code);},()=>{if(panel.current()&&token===epoch){detail.replaceChildren(button('← Geri',lobby));panel.message('Turnuva okunamadı. Bağlantıyı ve veritabanı izinlerini kontrol et.',true);}});
  }
  function render(data,code){
    detail.replaceChildren();const header=element('div','pc-card'),tools=element('div','pc-row');tools.append(button('← Turnuvalar',lobby),button('Kodu kopyala',async()=>{try{await navigator.clipboard.writeText(code);panel.message('Davet kodu kopyalandı: '+code);}catch(_){panel.message('Davet kodu: '+code);}}));
    header.append(element('h3','',data.name),element('p','pc-muted',TOURNAMENT_GAMES[data.game]+' · '+code),element('span','pc-chip',({waiting:'Katılım açık',playing:'Maçlar oynanıyor',complete:'Tamamlandı',cancelled:'İptal edildi'})[data.status]),tools);detail.append(header);
    const members=element('div','pc-card');members.append(element('h3','','Puan durumu'));tournamentStandings(data).forEach((row,i)=>{const line=element('div','pc-row');line.append(element('span','',(i+1)+'. '+row.name),element('b','',row.points+' puan · '+row.played+' maç'));members.append(line);});detail.append(members);
    if(data.ownerUid===uid&&data.status==='waiting')detail.append(button('Maçları başlat',()=>act(()=>updatePrivateTournament(code,'start',{},uid)),'pc-button primary'));
    if(data.ownerUid===uid&&['waiting','playing'].includes(data.status))detail.append(button('Turnuvayı iptal et',()=>{if(confirm('Bu özel turnuva iptal edilsin mi?'))act(()=>updatePrivateTournament(code,'cancel',{},uid));}));
    for(const [id,match]of Object.entries(data.matches||{}).slice(0,28)){
      const mine=match.a===uid||match.b===uid,a=data.members[match.a]?.name||'Oyuncu',b=data.members[match.b]?.name||'Oyuncu',card=element('div','pc-card');
      card.append(element('span','pc-chip',match.round+'. tur'),element('h3','',a+' · '+b));
      if(match.status==='complete'){card.append(element('p','pc-positive',match.result==='draw'?'Berabere · İki oyuncu onayladı':(match.result==='a'?a:b)+' kazandı · İki oyuncu onayladı'));}
      else if(mine&&data.status==='playing'){
        const other=match.a===uid?match.b:match.a,otherName=data.members[other]?.name||'Oyuncu';
        card.append(button('Rakibe oyun daveti',()=>act(async()=>{const social=await import('./social.js');if(panel.current()){if(typeof social.invitePlayerToGame!=='function')throw new Error('Oyun daveti hazırlanamadı');const opened=await social.invitePlayerToGame(other,otherName,data.game);if(opened&&panel.current())panel.close();}})));
        const results=element('div','pc-row');for(const [value,label]of [[match.a===uid?'a':'b','Ben kazandım'],['draw','Berabere'],[match.a===uid?'b':'a','Rakip kazandı']]){const result=button(label,()=>act(()=>updatePrivateTournament(code,'result',{matchId:id,result:value},uid)));result.setAttribute('aria-pressed',String(match.proposals?.[uid]===value));results.append(result);}card.append(results);
        if(match.proposals?.[match.a]&&match.proposals?.[match.b]&&match.proposals[match.a]!==match.proposals[match.b])card.append(element('p','pc-negative','Sonuçlar uyuşmuyor. İkiniz de doğru sonucu yeniden seçin.'));
        else if(match.proposals?.[uid])card.append(element('p','pc-muted','Bildirimin kaydedildi; rakibin aynı sonucu onaylaması bekleniyor.'));
      }else card.append(element('p','pc-muted','Sonuç bekleniyor'));
      detail.append(card);
    }
  }
  lobby();return panel;
}
