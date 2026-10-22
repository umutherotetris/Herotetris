import { Auth, db, fdb } from './auth.js';
import Store from './store.js';
import { openPanel, element, button } from './portal-panels.js';

const integer=value=>Number.isSafeInteger(Number(value))?Math.max(0,Number(value)):0;
const format=value=>integer(value).toLocaleString('tr-TR');
const time=value=>Number.isFinite(Number(value))?new Date(Number(value)).toLocaleString('tr-TR'):'Tarih yok';
export function walletDeliveries(profile={}){
  const rows=[];
  const add=(kind,id,value,label,state,amount,ts)=>rows.push({kind,id,label,state,amount:integer(amount),ts:integer(ts),detail:String(value?.toNick||value?.toName||value?.sku||value?.reason||'').slice(0,160)});
  for(const [id,v]of Object.entries(profile.kajuOutbox||{}))if(v&&typeof v==='object')add('transfer',id,v,'Kaju gönderimi',v.state==='published'?'published':'pending',v.amount,v.ts);
  for(const [id,v]of Object.entries(profile.heroShopPurchases||{}))if(v&&typeof v==='object')add('shop',id,v,'Mağaza teslimatı',v.status==='complete'?'complete':'pending',v.price,v.createdAt);
  for(const [id,v]of Object.entries(profile.heroClanDonations||{}))if(v&&typeof v==='object')add('clan',id,v,'Klan bağışı',v.state==='delivered'?'complete':v.state==='refunded'?'refunded':'pending',v.amount,v.ts);
  for(const [id,v]of Object.entries(profile.heroEggGifts||{}))if(v&&typeof v==='object')add('egg',id,v,'Kozmo hediyesi',v.status==='complete'?'published':'pending',v.amount,v.sentAt);
  for(const [id,v]of Object.entries(profile.heroKozmoCare||{}))if(v&&typeof v==='object')add('care',id,v,v.kind==='fusion'?'Kozmo birleştirme':'Kozmo bakımı',v.status==='complete'?'complete':v.status==='cancelled'?'cancelled':'pending',0,v.createdAt);
  return rows.sort((a,b)=>b.ts-a.ts).slice(0,200);
}
const states={pending:'İşlem bekliyor',published:'Alıcıya gönderildi',complete:'Tamamlandı',refunded:'İade edildi',cancelled:'İptal edildi'};
export function openWalletCenter(){
  const me=Auth.getState(),uid=me.uid;
  const panel=openPanel({id:'walletCenter',title:'İşlem Merkezi',subtitle:'Bakiyen, Kaju akışı ve bekleyen teslimatlar tek yerde',uid});
  if(me.status!=='google'){panel.body.append(element('p','pc-empty','İşlemlerini görmek için hesabını bağla.'));return panel;}
  let profile=null,tab='delivery',busy=false,readGeneration=0,observation=0;
  const balance=element('div','pc-card'),tabs=element('nav','pc-tabs'),list=element('div','pc-list'),tools=element('div','pc-row');
  const refresh=button('Yenile',()=>read()),retry=button('Bekleyenleri tamamla',()=>recover(),'pc-button primary');tools.append(refresh,retry);
  const tabButtons={};for(const [key,label]of [['delivery','Teslimatlar'],['flow','Kaju akışı'],['server','Hesap kayıtları']]){const b=button(label,()=>{tab=key;render();});tabButtons[key]=b;tabs.append(b);}
  panel.body.append(balance,tools,tabs,list,element('small','pc-muted','“Alıcıya gönderildi” teslim kuyruğuna yazıldığını gösterir. Alıcının hediyeyi kabul ettiğini veya Kaju’yu aldığını tek başına doğrulamaz. Cihaz geçmişi son 200 kaydı tutar.'));
  function render(){
    if(!panel.current()||!profile)return;
    const validBalance=profile.kaju==null||(typeof profile.kaju==='number'&&Number.isSafeInteger(profile.kaju)&&profile.kaju>=0&&profile.kaju<=999999999);
    balance.replaceChildren(element('div','pc-muted',validBalance?'ONAYLANAN BAKİYE':'BAKİYE KONTROLÜ'),element('div','pc-metric',validBalance?format(profile.kaju)+' Kaju':'Doğrulanamadı'));
    for(const [key,b]of Object.entries(tabButtons))b.setAttribute('aria-pressed',String(key===tab));
    list.replaceChildren();
    if(tab==='delivery'){
      const rows=walletDeliveries(profile);retry.disabled=busy||!rows.some(r=>r.state==='pending');
      for(const row of rows){
        const card=element('div','pc-card'),head=element('div','pc-row');head.append(element('b','',row.label),element('span','pc-chip '+(row.state==='pending'?'pending':'complete'),states[row.state]));
        card.append(head,element('p','pc-muted',[row.detail,row.amount?format(row.amount)+' Kaju':''].filter(Boolean).join(' · ')),element('small','pc-muted',time(row.ts)+' · '+row.id));list.append(card);
      }
      if(!rows.length)list.append(element('p','pc-empty','Bekleyen ya da kayıtlı teslimat yok.'));
    }else{
      const source=tab==='flow'?Store.getKajuLog('all',uid):Object.entries(profile.kaju_history||{}).map(([id,v])=>({...v,id})).sort((a,b)=>integer(b.ts)-integer(a.ts));
      for(const row of source.slice(0,200)){
        const entry=element('div','pc-entry'),earn=['earn','admin_gift','admin-add'].includes(row.type)||(typeof row.delta==='number'&&row.delta>0);
        const amt=Math.abs(Number(row.amount??row.delta)||0);
        entry.append(element('span','',row.reason||row.game||'Kaju işlemi'),element('strong',earn?'pc-positive':'pc-negative',(earn?'+':'−')+format(amt)),element('small','',time(row.ts)+(row.id?' · '+row.id:'')));list.append(entry);
      }
      if(!source.length)list.append(element('p','pc-empty',tab==='flow'?'Bu cihazda henüz Kaju geçmişi yok.':'Henüz ayrı hesap işlem kaydı yok.'));
      list.append(element('small','pc-muted',tab==='flow'?'Bu hesap için bu cihazda tutulan kazanç ve harcama kayıtları.':'Sunucudaki işlem makbuzları. Cihaz geçmişiyle aynı işlemi içerebilir.'));
    }
  }
  async function read(){
    if(busy||!panel.current())return;refresh.disabled=true;const generation=++readGeneration,observed=observation;
    try{const snap=await fdb.get(fdb.ref(db,'users/'+uid));if(panel.current()&&generation===readGeneration){if(observed===observation)profile=snap.val()||{};render();panel.message('Hesap kayıtları güncellendi.');}}
    catch(_){panel.message('Hesap kayıtları okunamadı. Yeniden deneyebilirsin.',true);}
    finally{if(panel.current()&&generation===readGeneration)refresh.disabled=false;}
  }
  async function recover(){
    if(busy||!panel.current())return;busy=true;retry.disabled=true;refresh.disabled=true;panel.message('Bekleyen kayıtlar kontrol ediliyor…');
    let failures=0;
    // Each existing journal retries its own stable receipts. No new purchase,
    // transfer or speculative refund is created by the center.
    const actions=[()=>Store.retryPendingTransfers(),()=>Store.claimPendingTransfers(),async()=>{const m=await import('./shop-purchases.js');if(panel.current())return m.retryShopPurchases(uid);},async()=>{const m=await import('./clan-economy.js');if(panel.current())return m.retryClanDonations();},async()=>{const m=await import('./kozmos.js');if(panel.current())return m.retryEggGifts(uid);},async()=>{const m=await import('./kozmo-care.js');if(panel.current())return m.retryKozmoCare(uid);}];
    for(const action of actions){if(!panel.current())break;try{const result=await action();if(result?.ok===false||Array.isArray(result)&&result.some(r=>r?.ok===false))failures++;}catch(_){failures++;}}
    busy=false;if(!panel.current())return;await read();if(!panel.current())return;
    const pending=walletDeliveries(profile||{}).filter(r=>r.state==='pending').length;
    panel.message(pending||failures?'Kontrol tamamlandı. '+pending+' işlem bekliyor; kayıtlar korunuyor.':'Kontrol tamamlandı; bekleyen teslimat görünmüyor.',!!failures);refresh.disabled=false;render();
  }
  panel.body.prepend(element('p','pc-muted','Kayıtlar yükleniyor…'));const loading=panel.body.firstChild;
  read().finally(()=>loading.remove());
  const off=Store.subscribe(()=>{if(panel.current()&&profile)render();});panel.cleanup(off);
  try{const unsubscribe=fdb.onValue(fdb.ref(db,'users/'+uid),snap=>{if(panel.current()){observation++;profile=snap.val()||{};render();}},()=>panel.message('Canlı güncelleme kesildi. Yenile ile tekrar kontrol edebilirsin.',true));panel.cleanup(unsubscribe);}catch(_){}
  return panel;
}
