
/* ═══════════════════════════════════════════════════════════════════
   r514-core-zikir-sentez
   Zikir arayüzü ve sayaç · prosedürel ses sentezi (hû, gong, tik) · hatim ve vird akışı · dock

   r514 — A: Bu kod eskiden 18.342 satırlık TEK ve İSİMSİZ bir
   <script> bloğundaydı; uygulamanın %40'ı orada duruyordu ve
   dışarıdan nerede ne olduğu görünmüyordu. Son üç hata avında
   bulunan hataların çoğu (bozuk esc, decodeBlob bağlam sızıntısı,
   spatialLoop, çakışan #surumEtiket işleyicileri) tam olarak böyle
   isimsiz ortak alanlardan çıktı.

   KOD DEĞİŞMEDİ — yalnız sınır çizildi ve ad verildi. Bölme
   noktaları, iki parçanın da bağımsız olarak ayrıştığı doğrulanarak
   seçildi. Klasik script'lerde üst düzey let/const global sözcüksel
   kapsamda paylaşıldığı ve çalıştırma sırası korunduğu için
   parçalar birbirinin değişkenlerini eskisi gibi görür.
   ═══════════════════════════════════════════════════════════════ */
function renderZikir(swap=true){
  /* ⚠ r128: öğe yoksa BÜTÜN çizim çöküyordu (`it.ar` → TypeError) ve
     çökme bir sonraki adımı değil, tüm arayüz güncellemesini durduruyordu.
     Gerçekçi yolda `FAV.kur()` bunu engelliyor, ama favori listesi boşken
     `Z.cat='fav'` atayan herhangi bir yol (ileride eklenecek bir kısayol,
     içe aktarma, geri/ileri gezinme) sessizce kırılırdı.
     Ucuz savunma: geçerli öğe yoksa esmâya dön. */
  if(!zItem()){
    const grup=ZIKIR[Z.cat];
    if(!grup||!grup.items||!grup.items.length){ Z.cat='esma'; Z.idx=0; }
    else Z.idx=Math.min(Math.max(0,Z.idx),grup.items.length-1);
    if(!zItem()){ Z.cat='esma'; Z.idx=0; }
    try{ if(typeof renderCats==='function')renderCats(); }catch(e){}
  }
  const it=zItem(); let ar,tr,mean,eb=0;
  const _kat=zKat();                    /* favoride öğenin KENDİ kategorisi */
  /* r129: terkiplerde kaynağın ne olduğu açıkça yazılsın —
     Kur'ân'da birlikte geçenler «âyet», ötekiler «gelenek». */
  try{
    const rz=document.getElementById('zKaynak');
    if(rz){
      const k=it&&it.kay;
      rz.hidden=!k;
      if(k){
        const terkipMi=_kat==='terkip';
        rz.className='trkKay '+(terkipMi?'gelenek':(k==='ayet'?'ayet'
          :k==='mucerrebat'?'mucerrebat':k==='ekberi'?'ekberi':'gelenek'));
        rz.textContent = terkipMi ? 'Esmâ terkibi'
          : k==='ayet' ? 'âyet'
          : k==='kendi' ? 'kendi terkibin'
          : k==='mucerrebat' ? 'derleme · mücerrebât'
          : k==='ekberi' ? 'Ekberî’ye nispet' : 'gelenek';
        if(terkipMi)rz.title = k==='ayet'?'İsimler Kur’ân’da birlikte geçen bir terkiptir':(k==='kendi'?'Kendi oluşturduğun Esmâ terkibi':'Esmâ terkibi');
        /* r131: kaynakta belirtilen adet varsa hedefi ona ayarla —
           212 / 579 / 1060 gibi sayılar tertibin parçası. */
        try{ if(it.adet && typeof ensureTargetOpt==='function'){
          ensureTargetOpt(it.adet,String(it.adet)); Z.target=it.adet;
        } }catch(e2){}
      }
    }
    /* ⚠ r130: BU BLOK `if(k)` İÇİNDE OLMAMALI. İçindeyken yalnız kaynak
       rozeti olan öğelerde çalışıyordu; rozetsiz bir zikre (normal esmâ)
       geçince niyet satırı temizlenmiyor, ÖNCEKİ zikrin niyeti ekranda
       kalıyordu. «Gizleme kodu, gösterme koşulunun içine konmaz» —
       her çizimde koşulsuz çalışmalı. */
    /* ⚠ r143: burada ikinci bir okunuş satırı (`#zOkunus`) vardı.
       r134'te eklemiştim ama `#zOku` ZATEN aynı işi yapıyordu (bkz.
       aşağıda `okEl`); sonuç: sûrelerde Latin okunuş İKİ KEZ yazılıyor,
       anlam ekrandan aşağı itiliyordu. Fazlalık kaldırıldı; tek alan
       `#zOku` kaldı ve o zaten bütün `oku` alanlı kayıtları kapsıyor. */
    /* ══ r174: MENZİL + SABİT TAKVİM EŞLEMESİ ══
       Menba şerhi 28 ismi 28 harf ve 28 ay menziliyle eşler. `may`
       alanındaki yıllık sabit günler ise Ay'ın anlık ekliptik konumunu
       hesaplamaz; güneş/takvim temelli yaklaşık bir eşlemedir. Bu yüzden
       artık «bugünün ay menzili» veya «şimdi vakti» diye sunulmaz. */
    const mz=document.getElementById('zMenzil');
    if(mz){
      const M=it&&it.menzil, A=it&&it.may;
      mz.hidden=!M;
      if(M&&Array.isArray(A)){
        const AY=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz',
                  'Ağustos','Eylül','Ekim','Kasım','Aralık'];
        const b=new Date(), bm=b.getMonth()+1, bg=b.getDate();
        /* yıl sonunu aşan aralık (ör. 21 Aralık – 2 Ocak) için iki parça */
        const ic=(m1,g1,m2,g2)=>{
          const p=(m,g)=>m*100+g, t=p(bm,bg), a=p(m1,g1), z=p(m2,g2);
          return a<=z ? (t>=a&&t<=z) : (t>=a||t<=z);
        };
        const takvimde=ic(A[0],A[1],A[2],A[3]);
        mz.classList.toggle('simdi',takvimde);
        /* r150: matris satırı — harf · ebced · unsur · tabiat */
        const mat=[];
        if(it.harf)mat.push('<span class="mzH" lang="ar">'+it.harf+'</span>');
        if(it.eb)mat.push('ebced <b>'+it.eb+'</b>');
        if(it.unsur)mat.push('<span class="mzU u-'+
          ({'Ateş':'ates','Toprak':'toprak','Hava':'hava','Su':'su'}[it.unsur]||'')+'">'+it.unsur+'</span>');
        if(it.tabiat)mat.push(it.tabiat);
        mz.innerHTML='<b>Menzil eşlemesi:</b> '+M+' · sabit takvim '+A[1]+' '+AY[A[0]-1]+' – '+A[3]+' '+AY[A[2]-1]+
          (takvimde?' <span class="mzSimdi">takvim aralığında</span>':'')+
          (mat.length?'<div class="mzMat">'+mat.join(' · ')+'</div>':'')+
          '<div class="mzMat">Bu aralık Ay’ın gökyüzündeki anlık menzilini göstermez; gerçek Ay konumu bu sürümde hesaplanmıyor.</div>';
      }
    }
    /* r146: kilitli bölümün kaynak ve edeb uyarısı — kullanıcıdan
       saklanmıyor, zikrin altında duruyor. */
    const uy=document.getElementById('zUyari');
    if(uy){
      const gz=(ZIKIR[Z.cat]||{}).gizli;
      uy.hidden=!gz;
      if(gz)uy.innerHTML='<b>⚠ Metin durumu:</b> 28’li sıra, Bûnî’ye nispet edilen fakat aidiyeti modern araştırmada tartışmalı '+
        '<i>Menbaʿ Uṣûli’l-Hikme</i> içindeki Berhetiyye şerhinin 1951 matbu yazımına göre gösterilir. '+
        'Şemsü’l-Maârif-i Kübrâ başka/kısa bir varyant taşır. Bu metin <b>Kur’ân veya hadis değildir</b>; '+
        'şerhteki esmâ karşılıkları da kesin etimoloji ya da kanonik ilâhî isim listesi sayılmaz.';
    }
    const nz=document.getElementById('zNiyet');
    if(nz){
      /* r148: üçüncü etiket — Berhetiyye kelimelerinin «işaret» satırı */
      const n=it&&(it.isaret||it.niyet||it.vird);
      /* r131: terkiplerde Hizbü'l-Vikâye kısayolu — başta okunması uygun */
      const hizbli = it && (it.kay==='ekberi'||it.kay==='mucerrebat');
      nz.hidden=!(n||hizbli);
      let g='';
      if(n)g+=(it.isaret?'<b>Nero tefekkür notu:</b> ':(it.niyet?'<b>Niyet:</b> ':'<b>Vird:</b> '))+n;
      if(hizbli)g+=(n?'<br>':'')+
        '<a href="#" id="zHvkAc" style="color:var(--goldh);text-decoration:none;border-bottom:1px dotted">'+
        '🛡 Başta Hizbü’l-Vikâye oku →</a>';
      nz.innerHTML=g;
      const ac=document.getElementById('zHvkAc');
      if(ac)ac.onclick=e3=>{
        e3.preventDefault();
        try{
          /* r135: tek Hizb paneli — okuyucu olan hzvBox */
          const d=document.getElementById('hzvBox');
          if(d){ d.open=true; d.scrollIntoView({behavior:'smooth',block:'start'}); }
        }catch(err){}
      };
    }
  }catch(e){}
  /* r153: `adet` ile `ebced` ayrıldı.
     Berhetiyye kayıtlarındaki adet:28 geleneksel/önerilen tekrar bilgisidir;
     EBCED HEDEFİ değildir. Yalnız gerçekten sabit-adet kullanan tesbih
     kayıtları hedefi doğrudan belirleyebilir. */
  if(it&&it.adet&&_kat==='tesbih'&&typeof ensureTargetOpt==='function'){
    Z.target=it.adet; ensureTargetOpt(it.adet,String(it.adet));
  }
  if(_kat==='esma'){ const f=esmaForms(it); ar=f.ar; tr=f.tr; mean=f.mean; eb=f.eb; }
  else {
    ar=it.ar; tr=it.tr; mean=it.mean;
    if(_kat==='berhet'&&it.serh)mean='Menba şerhinde zikredilen karşılık: '+it.serh+(it.mean?' · '+it.mean:'');
    if(_kat==='terkip'){
      try{
        const esmalar=ZIKIR?.esma?.items||[];
        let ids=Array.isArray(it?.esmaIndices)?it.esmaIndices.map(Number).filter(Number.isInteger):[];
        if(!ids.length){
          const norm=s=>String(s||'').replace(/^Y(?:â|a)\s+/i,'').trim().toLocaleLowerCase('tr');
          const adlar=String(it?.oku||it?.tr||'').split(/\s*[•·;]\s*/).map(norm).filter(Boolean);
          ids=adlar.map(ad=>esmalar.findIndex(e=>norm(e?.t)===ad)).filter(i=>i>=0);
        }
        const aciklamalar=ids.map(i=>esmalar[i]).filter(Boolean).map(e=>'Yâ '+e.t+': '+(e.m||e.mean||'')).filter(Boolean);
        if(aciklamalar.length){
          mean=aciklamalar.join(' · ')+(it.mean?' · Terkip notu: '+it.mean:'');
        }
      }catch(e){}
    }
  }
  const arEl=$('#zAr');
  arEl.textContent=ar;
  /* uzun sûre/âyet metinlerinde punto küçülsün */
  const L=(ar||'').length;
  arEl.classList.toggle('long',L>70&&L<=200);
  arEl.classList.toggle('vlong',L>200);
  /* okunuş satırı — yalnız metni başlık olan sûre/âyet kayıtlarında var */
  const okEl=$('#zOku'), oku=(it&&it.oku)?it.oku:'';
  if(okEl){ okEl.textContent=oku; okEl.hidden=!oku; }
  $('#zTr').textContent=tr;
  $('#zMean').textContent=Z.mean?mean:'';
  const _eb=zEbcedDegeri(it);
  const _ebVar=(_kat==='esma'||_kat==='berhet')&&_eb>0;
  $('#zEb').textContent=_ebVar?'ebced • '+_eb:'';
  const _ebB=$('#ebBtn'); if(_ebB){_ebB.disabled=!_ebVar; _ebB.classList.toggle('disabled',!_ebVar);}
  if(swap){const st=$('#zStage');st.classList.remove('swap');void st.offsetWidth;st.classList.add('swap');}
  $$('#zList .zItem').forEach(el=>el.classList.toggle('act',+el.dataset.i===Z.idx));
  if(typeof itemRecSyncUI==='function')itemRecSyncUI();
  /* Yıldızın durumu her sahne değişiminde tazelenmeli. renderZikir sekiz
     ayrı yerden çağrılıyor; hepsine tek tek eklemek yerine buraya. */
  if(typeof favUI==='function')favUI();
  try{if(!document.hidden&&typeof r476Prepare==='function')r476Prepare()}catch(e){}
  try{window.currentZikirState?.refresh('renderZikir')}catch(e){}
}
function zUI(){
  /* r139: akış sürerken çerçevede sürekli hafif toz */
  try{
    const st=document.getElementById('zStage');
    if(st)st.classList.toggle('tozAkis', !!Z.auto);
  }catch(e){}
  /* r126: aktif hatim ya da letâif varsa sayaç sahnesinde göster —
     kullanıcı buradan zikir çekiyor ama hangi bölümle bağlantılı
     olduğunu bilmiyordu. */
  /* r127: şeridi yazmadan önce durumu tutarlı hâle getir — yoksa
     kategori değişmişken «hatim aktif» yazabiliyordu. */
  try{ if(typeof seyirTutarlilik==='function')seyirTutarlilik(); }catch(e){}
  const badge=$('#zModBadge');
  if(badge){
    let yaz='', git=null;
    try{
      if(typeof HATIM!=='undefined'&&HATIM.active)
        yaz='🕋 Esmâ Hatmi aktif — '+HATIM.idx+'/99 • duraklat için <b>▼</b> kaydır',git='hatBox';
      else if(typeof LTF!=='undefined'&&LTF.active)
        yaz='🫀 Letâif Seyri aktif — '+(LTF.i+1)+'/5 • duraklat için <b>▼</b> kaydır',git='ltfBox';
    }catch(e){}
    badge.hidden=!yaz;
    badge.innerHTML=yaz;
    badge.onclick=yaz?(()=>{
      try{const d=document.getElementById(git); if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});}}catch(e){}
    }):null;
    badge.style.cursor=yaz?'pointer':'default';
  }
  /* r499: sayaç artık currentZikirState tek kaynak modelinden beslenir. */
  const _flow=window.currentFlowState?.refresh?.('zUI')||null;
  const _zs=_flow?.zikir||window.currentZikirState?.refresh('zUI')||null;
  const _hedef=_zs?_zs.target:Math.max(0,Number(Z.target)||0);
  const _hamSay=_zs?_zs.countRaw:Math.max(0,Number(Z.count)||0);
  const _say=_zs?_zs.count:(_hedef>0?(_hamSay%_hedef):_hamSay);
  const _kalan=_zs?(_zs.remain??Infinity):(_hedef>0?(_hedef-_say):Infinity);
  $('#cntBig').textContent=_say;
  const _ct=document.getElementById('cntTargetView'); if(_ct)_ct.textContent=_hedef>0?_hedef:'∞';
  const _cr=document.getElementById('cntRemain'); if(_cr)_cr.textContent=_hedef>0?_kalan:'∞';
  const _cp=document.getElementById('cntPct'); if(_cp)_cp.textContent=_hedef>0?('%'+Math.round(clamp((_zs?_zs.pct:_say/_hedef),0,1)*100)):'serbest';
  const _cm=document.getElementById('cntTargetMode'); if(_cm){
    const tm=_zs?_zs.targetMode:Z.targetMode;
    let m='adet'; try{m=(tm==='ebced'?'Ebced':tm==='manual'?'Serbest':'adet')}catch(e){} _cm.textContent=m;
  }
  if(typeof sayacDuyur==='function')
    sayacDuyur(_hamSay,_hedef,_zs?.name||((($('#zTr')&&$('#zTr').textContent)||'').split('—')[0].trim()));
  $('#cntSub').textContent=(_hedef>0?'Hedef '+_hedef:'Serbest sayım')+' • Devir '+(_zs?_zs.devir:Z.devir);
  const pct=_zs?_zs.pct:(_hedef>0?_say/_hedef:(_say%100)/100);
  const arc=$('#zProgArc'); if(arc)arc.style.strokeDashoffset=(829.38*(1-clamp(pct,0,1))).toFixed(1);
  $('#totalCnt').textContent=_zs?_zs.total:Z.total;
  const ab=$('#autoBtn');
  ab.innerHTML=Z.auto?'■ <b>DURDUR</b>':'▷ <b>SAYMAYA BAŞLA</b><small>(Tekrar artar)</small>';
  ab.classList.toggle('playing',Z.auto);
  try{ if(typeof targetPremiumSync==='function')targetPremiumSync(); }catch(e){}
}
function pulseZ(){
  /* r191: zikir dokunuşunda görsel flash yok.
     Sayının değişmesi tek başına geri bildirimdir. */
}
/* Tesbih tanesi tıkırtısı */
function tickSnd(){
  if(!ctx||document.hidden)return;
  if(typeof _zAutoSessizUntil!=='undefined'&&Date.now()<_zAutoSessizUntil)return;
  const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
  if(zv<=0.002)return;
  const t=ctx.currentTime, o=ctx.createOscillator();
  o.type='triangle'; o.frequency.setValueAtTime(1400+Math.random()*500,t);
  const gg=g(.0001);
  gg.gain.setValueAtTime(.001,t);
  gg.gain.exponentialRampToValueAtTime(Math.max(.0012,.13*zv),t+.007);
  gg.gain.exponentialRampToValueAtTime(.0001,t+.07);
  o.connect(gg); gg.connect(master);
  o.start(t); o.stop(t+.09);
}
/* ══════════════════════════════════════════════════════════════════
   ZİKİR SONU SESİ — «Hû»   (r119)

   Devir bitince çan çalıyordu; ses güzeldi ama zikrin diline yabancıydı.
   Artık üç seçenek var:
     • huu   — SENTEZLENMİŞ Hû (varsayılan): nefes soluğu + göğüs tınısı
     • kendi — kullanıcının kendi sesiyle kaydı
     • can   — eski çan (isteyen için duruyor)
     • yok   — sessiz

   ⚠ NEDEN CİHAZ SESİ (TTS) DEĞİL: konuşma motoru «Hû»yu kesik bir hece
   gibi okur — zikrin sonundaki uzayan nefes hissi tamamen kaybolur.
   Ayrıca TTS Web Audio dışında çalar; yankı, ton, ana ses hiçbiri işlemez
   (r111/r113). Bu yüzden TTS bilerek seçenek DEĞİL.

   SENTEZ NASIL: «Hû» iki katmandır — (1) «H» aspirasyonu: süzülmüş
   gürültü, (2) «û» ünlüsü: alçak bir temel ses + /u/ ünlüsünün formant
   tepeleri (~300 Hz ve ~870 Hz). İkisi yavaş açılıp uzun sönerek göğüsten
   gelen bir Hûûû verir. Tamamı Web Audio — dosya yok. */
const HU={ kip:'huu', anahtar:'hu:sonu' };
try{ HU.kip=S.get('sukun.huKip','huu'); }catch(e){}
/* r122: çan kaldırıldı; eskiden çan seçmiş olanlar gonga geçsin */
if(HU.kip==='can'){ HU.kip='gong'; try{S.set('sukun.huKip','gong')}catch(e){} }
window.HU_KIP_AL=()=>HU.kip;
window.HU_KIP_SET=v=>{ HU.kip=v; try{S.set('sukun.huKip',v)}catch(e){} };

/* r120: üç nefeslik Hû — son nefes uzun. Tekke halkalarında yaygın olan
   üçlü tekrarın karşılığı. Aynı sentez üç kez, üçüncüsü uzatılarak.
   ⚠ «Lâ ilâhe illâ Hû» gibi TAM bir formül sentezlenemez: sentez uzayan
   bir ünlü üretebilir, cümle üretemez. O formülü isteyen kendi sesiyle
   kaydetmeli — TTS ile okutmak kesik ve mekanik çıkar. */
function huUclu(){
  if(!ctx)return;
  huSentez(0.9);
  setTimeout(()=>huSentez(0.9),620);
  setTimeout(()=>huSentez(2.6),1240);
}
function huSentez(uzunluk){
  if(!ctx)return;
  const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
  if(zv<=0.002)return;
  const t=ctx.currentTime, SON=(typeof uzunluk==='number'&&uzunluk>0)?uzunluk:2.6;
  const KISA=SON<1.6;   /* kısa nefeste zarf da sıkışmalı */

  /* (1) «H» — nefes aspirasyonu: kısa gürültü patlaması */
  const n=ctx.createBufferSource();
  const len=Math.floor(ctx.sampleRate*SON);
  const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*0.5;
  n.buffer=buf;
  const nf=ctx.createBiquadFilter(); nf.type='bandpass'; nf.frequency.value=900; nf.Q.value=.7;
  const ng=g(0);
  ng.gain.setValueAtTime(0,t);
  ng.gain.linearRampToValueAtTime(.055*zv,t+.09);     /* «H» hemen gelir */
  ng.gain.exponentialRampToValueAtTime(.0001,t+(KISA?SON*.42:.95));
  n.connect(nf); nf.connect(ng); ng.connect(master); ng.connect(wetIn);
  n.start(t); n.stop(t+SON);

  /* (2) «û» — göğüs tınısı: temel + oktav, /u/ formantlarından geçer */
  const fmt=[{f:300,q:7,k:1},{f:870,q:9,k:.55}].map(o=>{
    const b=ctx.createBiquadFilter(); b.type='peaking';
    b.frequency.value=o.f; b.Q.value=o.q; b.gain.value=12*o.k;
    return b;
  });
  const gov=g(0);
  gov.gain.setValueAtTime(0,t);
  gov.gain.linearRampToValueAtTime(.10*zv,t+(KISA?.14:.30));
  gov.gain.setValueAtTime(.10*zv,t+(KISA?SON*.48:1.15));
  gov.gain.exponentialRampToValueAtTime(.0001,t+SON); /* uzun sönüş */
  /* formantları zincirle */
  let ilk=fmt[0], son=fmt[0];
  for(let i=1;i<fmt.length;i++){ son.connect(fmt[i]); son=fmt[i]; }
  son.connect(gov); gov.connect(master); gov.connect(wetIn);

  [{f:118,tip:'sine',a:1},{f:236,tip:'sine',a:.34},{f:354,tip:'triangle',a:.14}]
  .forEach(o=>{
    const osc=ctx.createOscillator(); osc.type=o.tip;
    osc.frequency.setValueAtTime(o.f,t);
    /* hafif iniş — insan sesi gibi, sabit değil */
    osc.frequency.exponentialRampToValueAtTime(o.f*.94,t+SON);
    const og=g(0); og.gain.setValueAtTime(o.a,t);
    osc.connect(og); og.connect(ilk);
    osc.start(t); osc.stop(t+SON);
  });
}
/* ══════════════════════════════════════════════════════════════════
   UZAK DOĞU GONGU   (r122)

   Çan yerine geldi. Farkı kulakla değil fizikle: çan/çınlama tam sayı
   katlarında (1·2·3·4) titreşir, kulağa «notalı» gelir. Gong ise dairesel
   bir levhadır; kısmî sesleri UYUMSUZ oranlardadır (1 · 1.52 · 2.00 ·
   2.44 · 2.95 · 3.61 · 4.15 · 5.43) — metalik, notasız, «yıkanan» tını
   bundan doğar.

   Üç katman:
     (1) VURUŞ  — kısa, tiz süzülmüş gürültü: tokmağın değme anı
     (2) KISMÎLER — uyumsuz oranlarda sinüsler; tiz olanlar daha ÇABUK
         söner (gerçek metalde de öyledir), böylece ses zamanla koyulaşır
     (3) TİTREŞİM — her kısmî hafifçe çiftlenip birkaç Hz kaydırılır;
         aradaki vuruş (beating) gongun o titrek uğultusunu verir

   Uzun sönüş (~6,5 sn) kasıtlı: zikrin sonunu kapatan bir nefes gibi.
   Tamamı Web Audio — dosya yok. */
function gongSentez(){
  if(!ctx)return;
  const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
  if(zv<=0.002)return;
  const t=ctx.currentTime, SON=6.5, F0=82;

  /* (1) tokmağın değme anı */
  const n=ctx.createBufferSource();
  const len=Math.floor(ctx.sampleRate*0.4);
  const buf=ctx.createBuffer(1,len,ctx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1);
  n.buffer=buf;
  const nf=ctx.createBiquadFilter(); nf.type='bandpass';
  nf.frequency.setValueAtTime(3200,t);
  nf.frequency.exponentialRampToValueAtTime(700,t+.28);   /* parlaklık düşer */
  nf.Q.value=.9;
  const ng=g(0);
  ng.gain.setValueAtTime(.085*zv,t);
  ng.gain.exponentialRampToValueAtTime(.0001,t+.34);
  n.connect(nf); nf.connect(ng); ng.connect(master); ng.connect(wetIn);
  n.start(t); n.stop(t+.45);

  /* (2)+(3) uyumsuz kısmîler, çiftli titreşimle */
  const KISMI=[
    {r:1.00, a:1.00, s:1.00},
    {r:1.52, a:.62,  s:.86},
    {r:2.00, a:.48,  s:.74},
    {r:2.44, a:.38,  s:.62},
    {r:2.95, a:.29,  s:.50},
    {r:3.61, a:.21,  s:.40},
    {r:4.15, a:.15,  s:.31},
    {r:5.43, a:.10,  s:.23}
  ];
  KISMI.forEach((p,i)=>{
    const sure=SON*p.s;
    /* çift: biri tam, biri hafif kaydırılmış → saniyede birkaç vuruş */
    [0, 0.7+i*0.35].forEach((kay,j)=>{
      const osc=ctx.createOscillator();
      osc.type='sine';
      osc.frequency.setValueAtTime(F0*p.r+kay,t);
      /* gerçek gongta vuruştan hemen sonra hafif bir düşüş olur */
      osc.frequency.exponentialRampToValueAtTime(Math.max(20,(F0*p.r+kay)*.988),t+sure);
      const og=g(0);
      const tepe=(j===0?.062:.030)*p.a*zv;
      og.gain.setValueAtTime(0,t);
      og.gain.linearRampToValueAtTime(tepe,t+.012);      /* neredeyse ani */
      og.gain.exponentialRampToValueAtTime(.0001,t+sure);
      osc.connect(og); og.connect(master); og.connect(wetIn);
      osc.start(t); osc.stop(t+sure+.05);
    });
  });
}

/* ══ r139: SEÇME TINISI ══
   Zikir seçilince / geçiş olunca çalan kısa, ayırt edici ses.
   Kapanış sesinden (Hû/gong) FARKLI olmalı — o bir mühür, bu bir işaret.
   Bu yüzden: çok kısa (~0,22 sn), tiz, iki notalı yükselen bir «tın».
   Zikir sonu sesiyle karışmasın diye alçak kısmî yok. */
let _secSon=0;
function secmeSesi(){
  try{
    if(!ctx)return;
    const now=Date.now();
    if(now-_secSon<120)return;          /* hızlı gezinmede üst üste binmesin */
    _secSon=now;
    const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
    if(zv<=0.002)return;
    const t=ctx.currentTime;
    [{f:1046.5,d:0,a:.030},{f:1568,d:.055,a:.024}].forEach(o=>{
      const osc=ctx.createOscillator(); osc.type='sine';
      osc.frequency.setValueAtTime(o.f,t+o.d);
      const g2=g(0);
      g2.gain.setValueAtTime(0,t+o.d);
      g2.gain.linearRampToValueAtTime(o.a*zv,t+o.d+.008);
      g2.gain.exponentialRampToValueAtTime(.0001,t+o.d+.19);
      osc.connect(g2); g2.connect(master);
      osc.start(t+o.d); osc.stop(t+o.d+.22);
    });
  }catch(e){}
}
window.secmeSesi=secmeSesi;

/* Altın tozu — sayaç çerçevesinde kısa parıltı */
function tozSac(){
  try{
    const el=document.getElementById('zStage'); if(!el)return;
    el.classList.remove('toz'); void el.offsetWidth; el.classList.add('toz');
    setTimeout(()=>{ try{el.classList.remove('toz')}catch(e){} },2500);
  }catch(e){}
}
window.tozSac=tozSac;

/* ═══ r657 — AUDIO CONTINUITY / END-TONE ISOLATION ═══════════════
   Özel Hû kapanış kaydı foreground `playRecording()` kapısından geçerse,
   asenkron decode tamamlandığında o sırada başlamış yeni zikir kaydını
   `superseded` ile soft-stop edebiliyordu. Kapanış tınısı artık SES/Arbiter/
   NowPlaying/Source state'ine dokunmayan bağımsız kısa WebAudio bus'ında çalar. */
const R657_CONTINUITY=window.__SUKUN_R657_CONTINUITY__||(window.__SUKUN_R657_CONTINUITY__={
  endToneStarts:0,endToneFailures:0,poolResets:0,trimStops:0,lastReason:'ready',lastAt:0,lastKey:''
});
function r657ContinuityBump(name,reason='',key=''){
  if(name&&Object.prototype.hasOwnProperty.call(R657_CONTINUITY,name))R657_CONTINUITY[name]++;
  R657_CONTINUITY.lastReason=String(reason||name||'');R657_CONTINUITY.lastAt=Date.now();R657_CONTINUITY.lastKey=String(key||'');
}

/* r658 — CLICKLESS RECORDING BOUNDARY TELEMETRY
   Kısa tekrar kayıtlarının sınırları JS timeout'u yerine mümkün olduğunda
   AudioParam'ın ses saatiyle yumuşatılır. Bu katman yeni timer/observer açmaz. */
const R658_BOUNDARY=window.__SUKUN_R658_BOUNDARY__||(window.__SUKUN_R658_BOUNDARY__={
  attackScheduled:0,tailScheduled:0,tailByAudioClock:0,fallbacks:0,lastReason:'ready',lastAt:0,lastKey:'',lastAttackMs:0,lastTailMs:0
});
function r658BoundaryBump(name,reason='',key='',extra={}){
  if(name&&Object.prototype.hasOwnProperty.call(R658_BOUNDARY,name)&&typeof R658_BOUNDARY[name]==='number')R658_BOUNDARY[name]++;
  R658_BOUNDARY.lastReason=String(reason||name||'');R658_BOUNDARY.lastAt=Date.now();R658_BOUNDARY.lastKey=String(key||'');
  if(Number.isFinite(+extra.attackMs))R658_BOUNDARY.lastAttackMs=+extra.attackMs;
  if(Number.isFinite(+extra.tailMs))R658_BOUNDARY.lastTailMs=+extra.tailMs;
}
window.SukunRecordingBoundaryR658=Object.freeze({version:'r658',snapshot:()=>Object.freeze({version:'r658',...R658_BOUNDARY})});
let R657_HU_CACHE={sig:'',buffer:null};
async function huKendiSes(){
  try{
    if(!RECKEYS.has(HU.anahtar))return false;
    const blob=await REC_DB.get(HU.anahtar);
    if(!blob)return false;
    /* Ana SÜKÛN context tek kez açılır; burada yeni per-tone AudioContext yok. */
    try{if(!ctx&&typeof ac==='function')ac()}catch(e){}
    if(!ctx||ctx.state==='closed'||!master){r657ContinuityBump('endToneFailures','no-main-context',HU.anahtar);return false}
    try{if(ctx.state==='suspended')await ctx.resume()}catch(e){}
    const sig=String(blob.size||0)+'|'+String(blob.type||'');
    let buffer=R657_HU_CACHE.sig===sig?R657_HU_CACHE.buffer:null;
    if(!buffer){
      buffer=window.SukunAudioDecodeAuthority?.decode?await window.SukunAudioDecodeAuthority.decode(blob):await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      R657_HU_CACHE={sig,buffer};
    }
    if(!buffer)return false;
    const src=ctx.createBufferSource(),gain=ctx.createGain(),t=ctx.currentTime,d=Math.max(.04,Number(buffer.duration)||.4);
    src.buffer=buffer;gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.72,t+.012);
    const fadeAt=t+Math.max(.02,d-.065);gain.gain.setValueAtTime(.72,fadeAt);gain.gain.linearRampToValueAtTime(.0001,t+d);
    src.connect(gain);gain.connect(master);
    src.onended=()=>{try{src.disconnect();gain.disconnect()}catch(e){}};
    src.start(t);src.stop(t+d+.03);r657ContinuityBump('endToneStarts','isolated-end-tone',HU.anahtar);
    return true;
  }catch(e){r657ContinuityBump('endToneFailures','end-tone-error',HU.anahtar);return false}
}
window.SukunRecordingContinuity=Object.freeze({version:'r657',snapshot:()=>Object.freeze({version:'r657',...R657_CONTINUITY})});
/* Devir/hedef tamamlandığında çalar. Eski `chime()` çağrıları buraya
   yönlendirildi — tek kapı, tek ayar. */
function zikirSonuSes(){
  try{
    if(HU.kip==='yok')return false;
    /* r629: seyir tamamlanma yöneticisi, son ismin normal devir mührünü
       ikinci kez çalmamalı. Gerçek bir kapanış tınısı başlatıldığında
       zamanı tek yerde işaretlenir; sessiz tercihi işaret sayılmaz. */
    try{window.__SUKUN_LAST_END_TONE_AT__=Date.now()}catch(e){}
    if(HU.kip==='gong'){ gongSentez(); return true; }
    if(HU.kip==='uclu'){ huUclu(); return true; }
    if(HU.kip==='kendi'){
      huKendiSes().then(ok=>{ if(!ok)huSentez(); });   /* kayıt yoksa sentez */
      return true;
    }
    huSentez();
    return true;
  }catch(e){ try{huSentez();window.__SUKUN_LAST_END_TONE_AT__=Date.now();return true}catch(e2){return false} }   /* yedek de çan değil */
}
window.zikirSonuSes=zikirSonuSes;

/* Devir tamamlandığında yumuşak çan */
function chime(){
  if(!ctx)return;
  const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
  if(zv<=0.002)return;
  [659.25,987.77].forEach((f,i)=>{
    const t=ctx.currentTime+i*.22, o=ctx.createOscillator(); o.frequency.value=f;
    const gg=g(0);
    gg.gain.setValueAtTime(0,t);
    gg.gain.linearRampToValueAtTime(.09*zv,t+.02);
    gg.gain.exponentialRampToValueAtTime(.0001,t+1.1);
    o.connect(gg); gg.connect(master); gg.connect(wetIn);
    o.start(t); o.stop(t+1.2);
  });
}
/* r470 — Zikir haptik ritmi: kısa vuruş + devir imzası. */
window.SukunHaptics=window.SukunHaptics||{
  enabled(){try{return !!Z.vib&&!!navigator.vibrate}catch(e){return false}},
  zikir(){if(!this.enabled())return false;try{return navigator.vibrate(document.body.classList.contains('sukun-tefekkur-mode')?7:10)}catch(e){return false}},
  devir(){if(!this.enabled())return false;try{return navigator.vibrate([22,34,34])}catch(e){return false}},
  tamam(){if(!this.enabled())return false;try{return navigator.vibrate([28,40,42,48,56])}catch(e){return false}}
};
const ZikirTransitionTxn=window.SukunZikirTransaction=(()=>{
  let seq=0,active=null,last=null;
  const history=[];
  const log=(type,t,extra={})=>{
    history.push({at:Date.now(),type,txid:t?.txid||0,cat:t?.cat||'',idx:Number.isFinite(+t?.idx)?+t.idx:null,target:+t?.target||0,phase:t?.phase||'',...extra});
    if(history.length>32)history.splice(0,history.length-32);
  };
  const sameActive=raw=>!!active&&!active.done&&!active.cancelled&&
    Z.cat===active.cat&&Z.idx===active.idx&&
    active.cat===raw?.cat&&active.idx===raw?.idx&&(+active.target||0)===(+raw?.target||0);

  function prepare(raw){
    if(sameActive(raw)){log('reused',active,{reason:'same-target'});return active}
    const tx={...(raw||{}),txid:++seq,createdAt:Date.now(),phase:'prepared',cancelled:false,cancelReason:'',done:false,attempts:0,lastAttemptAt:0};
    active=tx;last=tx;log('prepared',tx);
    try{window.dispatchEvent(new CustomEvent('sukun:zikirtransaction',{detail:{phase:'prepared',txid:tx.txid,cat:tx.cat,idx:tx.idx,target:tx.target}}))}catch(e){}
    return tx;
  }

  function isCurrent(t){
    return !!t&&!t.cancelled&&!t.done&&active===t&&Z.cat===t.cat&&Z.idx===t.idx;
  }

  function cancel(reason='cancelled'){
    const t=active;
    if(t&&!t.done){
      t.cancelled=true;t.cancelReason=String(reason||'cancelled');t.phase='cancelled';last=t;log('cancelled',t,{reason:t.cancelReason});
      try{window.dispatchEvent(new CustomEvent('sukun:zikirtransaction',{detail:{phase:'cancelled',txid:t.txid,reason:t.cancelReason}}))}catch(e){}
    }
    active=null;
    try{window.__SUKUN_PENDING_ZIKIR_TRANSITION__=null}catch(e){}
    return !!t;
  }

  function commit(t,reason='commit'){
    if(!t||t.done||t.cancelled)return false;
    if(active&&t.txid&&active.txid!==t.txid){log('commit-rejected',t,{reason:'active-mismatch',activeTxid:active.txid||0});return false}
    t.attempts=(t.attempts||0)+1;t.lastAttemptAt=Date.now();

    if(Z.cat!==t.cat||Z.idx!==t.idx){
      t.cancelled=true;t.cancelReason='stale-selection';t.phase='cancelled';
      if(active===t)active=null;last=t;log('cancelled',t,{reason:'stale-selection'});return false;
    }

    t.phase='committing';
    const fromIdx=Z.idx;
    t.done=true;
    Z.count=0;Z.devir++;

    if(!t.silent){
      /* r641 — Seyir içindeki hedef/devir, bağımsız zikir oturumunun kapanışı
         değildir. Özellikle HU.kip='kendi' ise huKendiSes() IndexedDB'yi
         asenkron okur; yeni isim çoktan başlamışken playRecording() çağırıp
         persistent journey native kaydını `superseded` ile kesebiliyordu.
         28/99 seyirde per-item kapanış sesini bastır; gerçek seyir tamamlanma
         sesi r629 JourneyCompletion tarafından ayrıca ve bir kez yönetilir. */
      if(!t.journeyOwner)zikirSonuSes();
      else try{window.dispatchEvent(new CustomEvent('sukun:journey-tone-suppressed',{detail:{owner:t.journeyOwner,cat:t.cat,idx:t.idx,at:Date.now()}}))}catch(e){}
      try{tozSac()}catch(e){}
      try{zikirTamam('Devir tamam',(t.label||((document.getElementById('zTr')||{}).textContent||'').trim())+' · '+Z.devir+'. devir')}catch(e){}
      try{window.SukunHaptics?.devir?.()}catch(e){}
    }

    if(t.adv){
      const grup=ZIKIR[Z.cat]&&ZIKIR[Z.cat].items;
      if(grup&&grup.length){
        Z.idx=(Z.idx+1)%grup.length;
        try{if(typeof zHedefSecimeUyarla==='function')zHedefSecimeUyarla(false)}catch(e){}
        /* r634 — kilit ekranında mantıksal isim ilerlerken native loop eski
           kayıtta kalmasın. renderZikir görünür DOM işidir ve gizliyken hâlâ
           çalıştırılmaz; fakat lock-audio hazırlığı DOM'dan bağımsız olarak
           HER isim geçişinde yenilenmek zorundadır. */
        if(!document.hidden){try{renderZikir(false)}catch(e){}}
        try{
          if(typeof r476Prepare==='function'){
            const prep=r476Prepare();
            if(prep&&typeof prep.then==='function')window.__SUKUN_R476_PREPARE_PROMISE__=prep.catch(()=>false);
          }
        }catch(e){}
        /* r639 — auto-zikir ilerlemesi de aynı section identity kapısından geçer. */
        try{window.SukunSectionIdentityCommit?.commit?.('auto-zikir',Z.idx,'zikir-transaction')}catch(e){}
      }
    }

    if(!t.silent)try{zUI()}catch(e){}
    t.phase='committed';t.committedAt=Date.now();last=t;if(active===t)active=null;
    log('committed',t,{reason,fromIdx,toIdx:Z.idx,devir:Z.devir,advanced:!!t.adv});
    try{window.dispatchEvent(new CustomEvent('sukun:zikirtransaction',{detail:{phase:'committed',txid:t.txid,cat:t.cat,idx:t.idx,fromIdx,toIdx:Z.idx,devir:Z.devir,advanced:!!t.adv,reason}}))}catch(e){}
    try{window.currentFlowState?.refresh?.('zikir-transaction',true)}catch(e){}
    return true;
  }

  function commitCurrent(reason='rescue'){return active?commit(active,reason):false}

  function snapshot(){
    const pick=t=>t?{txid:t.txid,phase:t.phase,cat:t.cat,idx:t.idx,target:t.target,adv:!!t.adv,journeyOwner:String(t.journeyOwner||''),cancelled:!!t.cancelled,cancelReason:t.cancelReason||'',attempts:t.attempts||0,lastAttemptAt:t.lastAttemptAt||0,createdAt:t.createdAt||0,committedAt:t.committedAt||0}:null;
    return{version:'r550',active:pick(active),last:pick(last),history:history.slice(-20)};
  }
  return{version:'r550',prepare,commit,commitCurrent,cancel,isCurrent,snapshot};
})();
function r482CommitTransition(t,reason='voice-or-direct'){
  return ZikirTransitionTxn.commit(t,reason);
}

/* r566: seyir döngüsü başka bir blokta; sayma yoluna oradan erişebilmek
   için rep dışarıya açılıyor. Davranışı değişmiyor. */
function rep(){
  const _r476Silent=!!window.__r476SilentCatchup;
  const _r482Defer=!!window.__SUKUN_DEFER_ZIKIR_TRANSITION__;
  /* r639 — 28/99 seyir kendi indeks otoritesine sahiptir. Global sayaç
     devir/hedef işlerini yapabilir ama seyir tekrarı sırasında Z.idx'yi
     ikinci kez ilerletemez. */
  const _r639JourneyRep=!!window.__SUKUN_JOURNEY_REP__;

  if(!_r476Silent)ac();

  Z.count++;
  Z.total++;
  if(Z.total%5===0)S.set('sukun.total',Z.total);

  if(!_r476Silent){
    pulseZ();
    if(Z.tick)tickSnd();
    try{window.SukunHaptics?.zikir?.()}catch(e){}
  }

  if(Z.target>0&&Z.count>=Z.target){
    const tr=ZikirTransitionTxn.prepare({
      cat:Z.cat,
      idx:Z.idx,
      target:Z.target,
      adv:_r639JourneyRep?false:!!Z.adv,
      silent:_r476Silent,
      journeyOwner:_r639JourneyRep?String(window.__SUKUN_JOURNEY_REP__||''):'',
      label:((document.getElementById('zTr')||{}).textContent||'').trim()
    });

    if(_r482Defer){
      /* r482: son sayım önce mevcut Esmâ'yı gerçekten okur.
         Sayaç hedefte kalır; ses tamamlanınca transition commit edilir. */
      window.__SUKUN_PENDING_ZIKIR_TRANSITION__=tr;
    }else{
      r482CommitTransition(tr);
    }
  }

  if(!_r476Silent)zUI();
}
try{window.SukunZikirRep=rep}catch(e){}
/* ── Uzun kayıt altyapısı ───────────────────────────────────────────
   Eskiden her kaydedicide sabit bir süre sınırı vardı (6/8/30 sn); sûre ve
   dua boylarına yetmiyordu. Uzun kayıtta ayrıca telefon uyuyunca MediaRecorder
   askıya alınıyor, start() zaman dilimsiz çağrıldığı için o ana kadar toplanan
   ses de kayboluyordu. Aşağısı üçünü birden çözer:
   ekran kilidi + saniyelik dilimlerle toplama + görünür sayaç. */
let RECWL=null, REC_N=0, NIYET_SESS=null, CS_SESS=null;
async function recWakeOn(){
  REC_N++;
  try{ if('wakeLock' in navigator && !RECWL) RECWL=await navigator.wakeLock.request('screen'); }catch(e){}
}
function recWakeOff(){
  REC_N=Math.max(0,REC_N-1); if(REC_N)return;
  try{ RECWL&&RECWL.release(); }catch(e){} RECWL=null;
}
/* Ekran tekrar açıldığında tarayıcı kilidi bırakmış olur — geri al */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && REC_N && !RECWL){ REC_N--; recWakeOn(); }
});
/* Tüm kaydediciler için tek, tepede duran canlı gösterge */
/* Kayıt oturumu TEKİLDİR.
   Sorun: beş ayrı kaydedici (zikir · tövbe · salavât · Delâil · tefekkür)
   aynı #recNowT öğesine yazıyordu. Önceki oturum kapatılmadan yenisi
   başlayınca zamanlayıcılar üst üste biniyor, sayaç saniyede 2-3 kez
   artıyor, biri bitince donuyordu. Artık yeni oturum öncekini kapatır. */
let _REC_AKTIF=null;
function recSessionBegin(etiket,maxSn,suresiDoldu){
  /* devrede kalmış oturum varsa önce onu kapat */
  if(_REC_AKTIF){ try{ _REC_AKTIF.bitir(); }catch(e){} _REC_AKTIF=null; }
  recWakeOn();
  const kutu=document.getElementById('recNow');
  if(kutu)kutu.classList.add('on');
  const et=document.getElementById('recNowL'); if(et)et.textContent=etiket;
  const t0=Date.now();
  let bitti=false;
  const yaz=()=>{
    const sn=Math.floor((Date.now()-t0)/1000);
    const c=document.getElementById('recNowT');
    if(c)c.textContent=String(Math.floor(sn/60)).padStart(2,'0')+':'+String(sn%60).padStart(2,'0');
    return sn;
  };
  yaz();                                   /* 00:00 hemen görünsün */
  const tick=setInterval(()=>{
    const sn=yaz();
    if(maxSn && sn>=maxSn){ clearInterval(tick); try{suresiDoldu&&suresiDoldu()}catch(e){} }
  },500);
  const oturum={
    _tick:tick,
    bitir(){
      if(bitti)return Math.round((Date.now()-t0)/1000);   /* iki kez kapatmaya karşı */
      bitti=true;
      clearInterval(tick); recWakeOff();
      const k=document.getElementById('recNow'); if(k)k.classList.remove('on');
      if(_REC_AKTIF===oturum)_REC_AKTIF=null;
      return Math.round((Date.now()-t0)/1000);
    }
  };
  _REC_AKTIF=oturum;
  return oturum;
}
function recSure(sn){ return String(Math.floor(sn/60)).padStart(2,'0')+':'+String(sn%60).padStart(2,'0'); }

/* ── Kumanda açıklamaları: masaüstünde üzerine gelince, dokunmatikte basılı tutunca ──
   Telefonda "hover" yok; bu yüzden 450 ms basılı tutmak açıklamayı açar,
   parmağı kaldırınca ya da kaydırınca kapanır. Kısa dokunuş düğmeyi çalıştırır. */
let dockTipT=null, dockTipEl=null, dockTipAcik=false;
function dockTipGoster(el){
  const tip=document.getElementById('dockTip'); if(!tip||!el)return;
  const metin=el.dataset.tip||''; if(!metin)return;
  const ad=(el.querySelector('.dl')||{}).textContent||'';
  tip.innerHTML='<b>'+hesc(ad)+'</b>'+hesc(metin);
  tip.hidden=false;
  const r=el.getBoundingClientRect();
  tip.style.left='0px'; tip.style.top='0px';           /* ölçüm için sıfırla */
  const tr=tip.getBoundingClientRect();
  let x=r.left+r.width/2-tr.width/2;
  x=Math.max(10,Math.min(x,innerWidth-tr.width-10));
  let y=r.bottom+9;
  if(y+tr.height>innerHeight-10) y=Math.max(10,r.top-tr.height-9);
  tip.style.left=x+'px'; tip.style.top=y+'px';
  requestAnimationFrame(()=>tip.classList.add('on'));
  el.classList.add('tipOn');
  dockTipEl=el; dockTipAcik=true;
}
function dockTipGizle(){
  const tip=document.getElementById('dockTip');
  if(tip){ tip.classList.remove('on'); setTimeout(()=>{ if(!dockTipAcik)tip.hidden=true; },220); }
  if(dockTipEl)dockTipEl.classList.remove('tipOn');
  dockTipEl=null; dockTipAcik=false;
  if(dockTipT){ clearTimeout(dockTipT); dockTipT=null; }
}
/* ── r98: tek elemanı bağlayan yardımcı ─────────────────────────────
   Eskiden bütün bağlama dockTipInit içinde, AÇILIŞTA BİR KEZ yapılıyordu.
   Sonradan üretilen düğmeler (esmâ kartları, kanal listesi, hizb satırları)
   data-tip taşısa bile dinleyici almıyordu — açıklama sessizce çalışmıyordu.
   Artık bağlama tek elemanlık; erişilebilirlik kuyruğu (swA11ySync) yeni
   gelen her düğüm için bunu çağırır. WeakSet iki kez bağlamayı önler. */
const _tipBagli=new WeakSet();
function dockTipBagla(el){
  if(!el||el.nodeType!==1)return;
  if(!el.dataset||!el.dataset.tip)return;
  if(_tipBagli.has(el))return;
  if(el.closest('#tk'))return;            /* Tekke'nin kendi açıklama yolu var */
  _tipBagli.add(el);
  [el].forEach(el=>{
    el.addEventListener('pointerenter',e=>{
      if(e.pointerType==='touch')return;                /* dokunmatikte basılı tutma yolu var */
      dockTipT=setTimeout(()=>dockTipGoster(el),420);
    });
    el.addEventListener('pointerleave',dockTipGizle);
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='touch')return;
      dockTipT=setTimeout(()=>{ dockTipGoster(el); vib&&vib(12); },450);
    });
    ['pointerup','pointercancel'].forEach(t=>el.addEventListener(t,()=>{
      if(dockTipT){clearTimeout(dockTipT);dockTipT=null;}
      if(dockTipAcik)setTimeout(dockTipGizle,1400);     /* okumaya vakit bırak */
    }));
    /* r698: açıklama yalnız görseldir; hiçbir gerçek click'i yutmaz. */
  });
}
window.dockTipBagla=dockTipBagla;

function dockTipInit(){
  document.querySelectorAll('[data-tip]').forEach(dockTipBagla);
  addEventListener('scroll',()=>{ if(dockTipAcik)dockTipGizle(); },{passive:true});
  dockLblGuncelle();
  const zb=document.getElementById('zBar');
  if(zb)zb.addEventListener('click',e=>e.stopPropagation());
  const mh=document.getElementById('zBarHelp');
  if(mh)mh.addEventListener('click',()=>{ if(!dockTipAcik)document.getElementById('micHelpSheet').hidden=false; });
  const mx=document.getElementById('micHelpClose');
  if(mx)mx.addEventListener('click',()=>{ document.getElementById('micHelpSheet').hidden=true; });
}
/* Etiketler o anki durumu göstersin — tema adı, görünüm kademesi, dil */
function dockLblGuncelle(){
  try{
    const t=document.body.dataset.tema||'zumrut';
    const ad=(typeof THEMES!=='undefined'&&THEMES.find(x=>x.k===t)||{}).n;
    const tl=document.getElementById('temaLbl'), tb=document.getElementById('temaBtn');
    /* Etikete tam ad sığmıyor (80 px) — ilk kelime yeter, tamamı açıklamada durur */
    if(tl&&ad)tl.textContent=ad.split(' ')[0];
    if(tb&&ad)tb.dataset.tip='Şu an: '+ad+'. Uygulamanın renk dünyasını değiştirir — on iki tema var; gece için koyu, gündüz için açık olanları dene.';
    const ul=document.getElementById('uiLbl'), ub=document.getElementById('uiBtn');
    if(typeof UIM!=='undefined'){
      const m=UIM.m, adi=({mini:'Mini',midi:'Midi',pro:'Pro'})[m]||'Görünüm';
      const izah=({mini:'yalnız esaslar',midi:'dengeli',pro:'tüm ince ayarlar'})[m]||'';
      if(ul)ul.textContent=adi;
      if(ub)ub.dataset.tip='Şu an: '+adi+' — '+izah+'. Arayüzün ne kadar ayrıntı göstereceğini seçer; dokundukça Mini → Midi → Pro sırasıyla değişir.';
    }
    const ll=document.getElementById('langLbl'), lb=document.getElementById('langBtn');
    const en=(typeof I18N!=='undefined'&&I18N.lang==='en');
    if(ll)ll.textContent=en?'Türkçe':'English';
    if(lb)lb.dataset.tip=en?'Switch the interface back to Turkish. Arabic text and transliterations are unaffected.'
                          :'Arayüzü İngilizceye çevirir. Arapça metinler ve okunuşlar değişmez.';
    const st=document.getElementById('sleepTimer'), ti=document.getElementById('dockTimer');
    if(st&&ti)ti.classList.toggle('on',+st.value>0);
  }catch(e){}
}
/* ── Alt sayfa perdesi: hangi sayfa açılırsa açılsın perde otomatik gelir ── */
const BTM_SHEETS=['temaSheet','helpSheet','recSheet','customSoundSheet','micHelpSheet','logSheet'];
function scrimSync(){
  const perde=document.getElementById('sheetScrim'); if(!perde)return;
  const acikVar=BTM_SHEETS.some(id=>{const el=document.getElementById(id);return el&&!el.hidden;});
  perde.hidden=!acikVar;
}
function scrimInit(){
  const perde=document.getElementById('sheetScrim'); if(!perde)return;
  perde.addEventListener('click',()=>{
    BTM_SHEETS.forEach(id=>{const el=document.getElementById(id); if(el)el.hidden=true;});
    scrimSync();
  });
  /* r154: bazı sheet'ler (sozSheet / dlEditSheet / kurSheet) sonradan DOM'a
     ekleniyor. Eski gözlemci yalnız init anında var olanları izliyordu; bu
     yüzden dinamik sheet açılınca perde görünmeyebiliyordu. Body üzerinden
     yalnız `hidden` değişimlerini izleyerek sonradan eklenenleri de kapsa. */
  const gozcu=new MutationObserver(kayitlar=>{
    if(kayitlar.some(k=>k.target&&BTM_SHEETS.includes(k.target.id)))scrimSync();
  });
  gozcu.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
  /* Escape ile de kapansın (masaüstü) */
  addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if(BTM_SHEETS.some(id=>{const el=document.getElementById(id);return el&&!el.hidden;})){
      BTM_SHEETS.forEach(id=>{const el=document.getElementById(id); if(el)el.hidden=true;});
      scrimSync();
    }
  });
  scrimSync();
}
/* ── Dokunsal + işitsel geri bildirim ──
   Seçim değişimleri sessizdi. Artık her seçim kısa bir tık + hafif titreşim
   verir; sekme geçişi biraz daha dolu bir «sayfa» sesi alır. Ses zaten kapalıysa
   (ya da kullanıcı sesi kısmışsa) sfx kendiliğinden sessiz kalır. */
function geriBildirim(tur){
  try{
    if(tur==='sekme'){ sfx('page'); vib&&vib(14); }
    else if(tur==='secim'){ sfx('tick'); vib&&vib(9); }
    else if(tur==='ac'){ sfx('open'); vib&&vib(12); }
    else if(tur==='kapa'){ sfx('close'); vib&&vib(8); }
  }catch(e){}
}
function geriBildirimBagla(){
  /* Sekmeler */
  document.querySelectorAll('.tabs > button').forEach(b=>{
    b.addEventListener('click',()=>geriBildirim('sekme'),{passive:true});
  });
  /* Kategori ve zikir öğeleri — dinamik üretildikleri için kapsayıcıdan dinle */
  ['#catRow','#zList','#zikirList','.catRow'].forEach(sel=>{
    const k=document.querySelector(sel); if(!k)return;
    k.addEventListener('click',e=>{ if(e.target.closest('.cat,.zItem'))geriBildirim('secim'); },{passive:true});
  });
  /* Ön ayar kartları ve kanal anahtarları */
  document.addEventListener('click',e=>{
    if(e.target.closest('#tk'))return;
    if(e.target.closest('.pre'))geriBildirim('secim');
    else if(e.target.closest('.chip,.sw'))geriBildirim('secim');
  },{passive:true});
  /* Alt sayfa açılış/kapanışı */
  if(typeof BTM_SHEETS!=='undefined'){
    BTM_SHEETS.forEach(id=>{
      const el=document.getElementById(id); if(!el)return;
      new MutationObserver(()=>geriBildirim(el.hidden?'kapa':'ac'))
        .observe(el,{attributes:true,attributeFilter:['hidden']});
    });
  }
}
/* Otomatik akış + ekranı uyanık tutma */
let wl=null;
async function lockOn(){try{if('wakeLock' in navigator)wl=await navigator.wakeLock.request('screen');}catch(e){}}
function lockOff(){try{wl&&wl.release();}catch(e){} wl=null;}
/* r154 — OTOMATİK ZİKİR SAATİ
   Android ekran kilidinde setInterval ana iş parçacığı throttle edilir.
   Döndüğünde birikmiş callback'ler arka arkaya çalışırsa «pıt pıt» sesleri
   atlar / kümelenir. Burada interval yerine duvar-saati tabanlı tek timeout
   kullanılır. Kaç tur kaçırıldığı Date.now() ile hesaplanır; kaçan sayımlar
   SESSİZ tamamlanır, ses hiçbir zaman burst şeklinde telafi edilmez. */
let _zAutoSon=0;
let _zAutoUyanTO=0,_zAutoUyanSeq=0,_zAutoSessizUntil=0,_zAutoHiddenAt=0;

/* r476 — KİLİT EKRANI: SÜREKLİ MEDYA, TIMER'SIZ SES
   r475 hâlâ JS timer/event zincirine güveniyordu; Android ekranı uyuttuğunda
   o zincir de uyuyordu. r476 kilitte tekrar başlatma yapmaz:
   • kendi kayıt varsa TEK native <audio> aynı kaydı loop eder;
   • kayıt yoksa tek, uzun TTS utterance önceden kuyruğa verilir;
   • sayaç ekran geri geldiğinde sessizce uzlaştırılır.
   Böylece kilit dönüşünde toplu tık/pıt sesi üretilmez. */
let _r476LockAudio=null,_r476SilentUrl='',_r476RecUrl='';
let _r476HedefTimer=0;   /* r540: kilitteyken hedefe varış zamanlayıcısı */
let _r476Prepared={
  key:'',blob:null,url:'',durationMs:0,
  fxUrl:'',fxSig:'',cycleMs:0,fxReady:false,playRate:1,
  text:'',voice:null,lang:'tr-TR',rate:.85,pitch:.9
};
let _r476Hidden=null,_r476Batch=null,_r476PrepareSeq=0;

function r476SilentWav(){
  const rate=8000,sec=1.2,n=Math.floor(rate*sec),buf=new ArrayBuffer(44+n),v=new DataView(buf);
  const wr=(o,x)=>{for(let i=0;i<x.length;i++)v.setUint8(o+i,x.charCodeAt(i))};
  wr(0,'RIFF');v.setUint32(4,36+n,true);wr(8,'WAVE');wr(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate,true);v.setUint16(32,1,true);v.setUint16(34,8,true);
  wr(36,'data');v.setUint32(40,n,true);
  for(let i=44;i<44+n;i++)v.setUint8(i,128);
  return new Blob([buf],{type:'audio/wav'});
}
function r476Audio(){
  if(_r476LockAudio)return _r476LockAudio;
  const a=document.createElement('audio');
  a.id='r476LockZikirAudio';
  a.setAttribute('aria-hidden','true');
  a.preload='auto';a.playsInline=true;a.loop=true;a.disableRemotePlayback=false;
  a.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-20px;bottom:-20px';
  _r476SilentUrl=URL.createObjectURL(r476SilentWav());
  a.src=_r476SilentUrl;
  /* r693: bu element prime/keepalive sırasında GERÇEK ses değildir. Global
     HTMLMediaElement gözlemcisi sessiz taşıyıcıyı playback sayarsa AudioHub
     sonsuza dek playing'de kalabiliyor. Kaynak gerçek kayda dönene kadar
     açık bir sınıflandırma taşı. */
  try{a.dataset.sukSilentCarrier='1'}catch(e){}
  document.body.appendChild(a);
  _r476LockAudio=a;
  return a;
}
function r476Prime(){
  try{
    const a=r476Audio();
    a.loop=true;
    if(a.src!==_r476SilentUrl){a.src=_r476SilentUrl;a.load()}
    try{a.dataset.sukSilentCarrier='1'}catch(e){}
    const p=a.play();if(p?.catch)p.catch(()=>{});
    r476Prepare();
    return true;
  }catch(e){return false}
}
/* r634 — kilitte DOM bilerek render edilmez. Bu nedenle ses metni ve
   MediaSession başlığı DOM'dan okunursa Z.idx yeni isme geçmiş olsa bile eski
   isim taşınır. Canonical kaynak doğrudan Z + ZIKIR'dir; DOM yalnız yedektir. */
function r476CanonicalItem(){
  try{
    const g=ZIKIR?.[Z?.cat],items=g?.items;
    return Array.isArray(items)?(items[Math.max(0,Math.min(items.length-1,+Z.idx||0))]||null):null;
  }catch(e){return null}
}
function r476CurrentLabel(){
  const it=r476CanonicalItem();
  try{
    if(it){
      const base=String(it.tr||it.t||it.oku||'').trim();
      if(base)return Z?.cat==='esma'&&!/^y[âa]\s/i.test(base)?'Yâ '+base:base;
    }
  }catch(e){}
  return String(($('#zTr')?.textContent||'Zikir')).trim()||'Zikir';
}
function r476CurrentText(){
  const it=r476CanonicalItem();
  try{
    if(SPK.arOn&&SPK.arVoice){
      const ar=String(it?.ar||it?.a||($('#zAr')?.textContent||'')).trim();
      if(ar)return{txt:ar,voice:SPK.arVoice,lang:SPK.arVoice.lang||'ar-SA',rate:SPK.arRate,pitch:SPK.arPitch};
    }
  }catch(e){}
  let txt='';
  try{
    if(it){
      txt=String(it.oku||it.translit||it.tr||'').trim();
      if(!txt&&it.t)txt=(Z?.cat==='esma'?'Yâ ':'')+String(it.t).trim();
    }
  }catch(e){}
  if(!txt){
    const oku=($('#zOku')?.textContent||'').trim(),tr=($('#zTr')?.textContent||'').trim();
    txt=oku||tr;
  }
  return{txt,voice:SPK.voice||null,lang:'tr-TR',rate:SPK.rate,pitch:.9};
}
async function r476ProbeDuration(url){
  return await new Promise(resolve=>{
    const a=document.createElement('audio');
    let done=false;
    const fin=v=>{if(done)return;done=true;clearTimeout(to);a.src='';resolve(v)};
    const to=setTimeout(()=>fin(0),2200);
    a.preload='metadata';a.onloadedmetadata=()=>fin(Number.isFinite(a.duration)?a.duration*1000:0);
    a.onerror=()=>fin(0);a.src=url;try{a.load()}catch(e){fin(0)}
  });
}

/* r477 — kilit ekranı için kendi kayıt sesini ÖNCEDEN işler.
   Native audio kilitte güvenilir; WebAudio grafiği ise bazı Android'lerde
   askıya alınır. Bu yüzden ekran AÇIKKEN kısa zikir kaydının 8D + reverb
   karakterini OfflineAudioContext ile WAV'a basıyoruz. Kilitte native
   <audio> bu işlenmiş dosyayı loop eder. Tempo da loop uzunluğuna gömülür. */
let _r477FxUrl='',_r477FxBuildSeq=0,_r477FxCacheSig='';

function r477WavFromBuffer(buf){
  const ch=Math.min(2,Math.max(1,buf.numberOfChannels||1));
  const frames=buf.length,sr=buf.sampleRate,bytes=44+frames*ch*2;
  const ab=new ArrayBuffer(bytes),v=new DataView(ab);
  const wr=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
  wr(0,'RIFF');v.setUint32(4,bytes-8,true);wr(8,'WAVE');wr(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,ch,true);
  v.setUint32(24,sr,true);v.setUint32(28,sr*ch*2,true);v.setUint16(32,ch*2,true);
  v.setUint16(34,16,true);wr(36,'data');v.setUint32(40,frames*ch*2,true);
  const data=[];for(let c=0;c<ch;c++)data.push(buf.getChannelData(Math.min(c,buf.numberOfChannels-1)));
  let o=44;
  for(let i=0;i<frames;i++){
    for(let c=0;c<ch;c++){
      let x=Math.max(-1,Math.min(1,data[c][i]||0));
      x=x<0?x*0x8000:x*0x7fff;
      v.setInt16(o,x,true);o+=2;
    }
  }
  return new Blob([ab],{type:'audio/wav'});
}
function r477FxSignature(key){
  const speed=Math.max(.5,Math.min(2,Number(window.OKUMA_HIZ)||1));
  const rev=Math.max(0,Math.min(1,Number(KAYIT?.yankiMik)||0));
  const d8=KAYIT?.mekan?1:0;
  const tempo=Math.max(.18,Number(Z?.tempo)||1);
  return [key,speed.toFixed(3),rev.toFixed(3),d8,tempo.toFixed(3)].join('|');
}
/* r653 — lock/echo decode authority: seyirde her isim için yeni CANLI
   AudioContext açılmaz. Varsa ana SÜKÛN context decode eder; yoksa küçük bir
   OfflineAudioContext kullanılır. */
async function r653DecodeAudioBlob(blob){
  if(!blob)throw new Error('Ses verisi yok');
  const raw=await blob.arrayBuffer();
  let live=null;
  try{live=(typeof ctx!=='undefined'&&ctx&&ctx.state!=='closed')?ctx:null}catch(e){live=null}
  if(live){try{return await live.decodeAudioData(raw.slice(0))}catch(e){}}
  const OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  if(!OC)throw new Error('Audio decode desteklenmiyor');
  const off=new OC(1,1,44100);
  return await off.decodeAudioData(raw.slice(0));
}
window.SukunAudioDecodeAuthority=Object.freeze({version:'r653',decode:r653DecodeAudioBlob});
async function r477RenderLockTrack(blob,key){
  if(!blob||!key||!('OfflineAudioContext'in window))return null;
  const sig=r477FxSignature(key);
  const readRate=Math.max(.5,Math.min(2,Number(window.OKUMA_HIZ)||1));
  if(sig===_r477FxCacheSig&&_r477FxUrl){
    return{
      url:_r477FxUrl,
      sig,
      cycleMs:_r476Prepared.cycleMs||zAutoTempoMs(),
      playRate:readRate
    };
  }

  const seq=++_r477FxBuildSeq;
  try{
    const decoded=await r653DecodeAudioBlob(blob);
    if(seq!==_r477FxBuildSeq)return null;

    /* ÖNEMLİ: AudioBufferSource.playbackRate pitch'i de değiştirir.
       Eski r477 burada readRate kullanıyordu; kilitte sesin "cüce"leşmesinin
       ana nedeni buydu. Ses dosyasını 1x/orijinal pitch'te render ediyoruz.
       Hız daha sonra native <audio>.playbackRate + preservesPitch ile uygulanır. */
    const spokenWallSec=Math.max(.12,decoded.duration/readRate);
    const cycleWallSec=Math.max(spokenWallSec,Math.max(.18,Number(Z?.tempo)||1));

    /* Native player readRate hızında oynatacağı için medya dosyasının kaynak
       süresi wall-cycle * readRate olmalı. Böylece tempo duvar saatinde değişmez. */
    const fileSec=Math.max(decoded.duration,cycleWallSec*readRate);
    const sr=Math.max(22050,Math.min(48000,decoded.sampleRate||44100));
    const frames=Math.max(1,Math.ceil(fileSec*sr));
    const OC=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    const off=new OC(2,frames,sr);
    const src=off.createBufferSource();
    src.buffer=decoded;
    src.playbackRate.value=1; /* pitch-safe */

    let out=src;
    if(KAYIT?.mekan&&off.createStereoPanner){
      const pan=off.createStereoPanner();
      src.connect(pan);out=pan;
      for(let t=0;t<fileSec;t+=.12){
        /* Native playback hızlandırınca 8D dönüş hızı da hızlanmasın. */
        const wallT=t/readRate;
        pan.pan.setValueAtTime(Math.sin(wallT*.55)*.85,t);
      }
    }

    const dry=off.createGain();dry.gain.value=.96;
    out.connect(dry);dry.connect(off.destination);

    const rev=Math.max(0,Math.min(1,Number(KAYIT?.yankiMik)||0));
    if(rev>0){
      const wet=off.createGain();wet.gain.value=Math.min(.78,rev*.78);
      const conv=off.createConvolver();
      const irSec=Math.min(2.8,Math.max(.8,fileSec));
      const ir=off.createBuffer(2,Math.max(1,Math.floor(sr*irSec)),sr);
      for(let c=0;c<2;c++){
        const d=ir.getChannelData(c);let lp=0;
        for(let n=0;n<d.length;n++){
          const k=1-n/d.length;
          const noise=(Math.random()*2-1)*Math.pow(k,2.5);
          lp+=(noise-lp)*(0.20-(0.14*n/d.length));
          d[n]=lp;
        }
      }
      conv.buffer=ir;out.connect(wet);wet.connect(conv);conv.connect(off.destination);
    }

    src.start(0);
    const rendered=await off.startRendering();
    if(seq!==_r477FxBuildSeq)return null;

    const wav=r477WavFromBuffer(rendered);
    const url=URL.createObjectURL(wav);
    if(_r477FxUrl)try{URL.revokeObjectURL(_r477FxUrl)}catch(e){}
    _r477FxUrl=url;_r477FxCacheSig=sig;

    return{
      url,
      sig,
      cycleMs:Math.round(cycleWallSec*1000),
      playRate:readRate
    };
  }catch(e){
    return null;
  }
}

async function r476Prepare(){
  const seq=++_r476PrepareSeq;
  let key='';try{key=zikirKey()}catch(e){}
  const t=r476CurrentText();
  let blob=null,url='',durationMs=0;
  try{if(key&&typeof REC_DB!=='undefined')blob=await REC_DB.get(key)}catch(e){}
  if(seq!==_r476PrepareSeq)return false;

  if(blob){
    try{
      if(_r476RecUrl)URL.revokeObjectURL(_r476RecUrl);
      url=URL.createObjectURL(blob);_r476RecUrl=url;
      durationMs=await r476ProbeDuration(url);
    }catch(e){url='';durationMs=0}
  }
  if(seq!==_r476PrepareSeq)return false;

  const speed=Math.max(.5,Math.min(2,Number(window.OKUMA_HIZ)||1));
  let cycleMs=Math.max(zAutoTempoMs(),durationMs?Math.round(durationMs/speed):0,650);
  _r476Prepared={
    key,blob,url,durationMs,
    fxUrl:'',fxSig:'',cycleMs,fxReady:false,playRate:speed,
    text:t.txt||'',voice:t.voice||null,lang:t.lang||'tr-TR',
    rate:t.rate||.85,pitch:t.pitch==null?.9:t.pitch
  };

  /* Ağır OfflineAudio render yalnız görünürken yapılır. Android kilidinde
     isim değişiminde öncelik yeni kaynağı native <audio>'ya HEMEN vermektir;
     arka planda OfflineAudioContext throttling'i kaynak değişimini geciktiremez. */
  if(blob&&url&&!document.hidden){
    const fx=await r477RenderLockTrack(blob,key);
    if(seq!==_r476PrepareSeq)return false;
    if(fx){
      _r476Prepared.fxUrl=fx.url;
      _r476Prepared.fxSig=fx.sig;
      _r476Prepared.cycleMs=fx.cycleMs||cycleMs;
      _r476Prepared.playRate=fx.playRate||speed;
      _r476Prepared.fxReady=true;
    }
  }
  /* ═══ r539 — KİLİT EKRANI ELEMANI ESKİ KAYITTA TAKILI KALIYORDU ══════
     Zincirin son halkası buydu. Sayaç ilerliyor, hedef dolunca geçiş
     işleniyor, yeni ismin parçası hazırlanıyor — hepsi çalışıyor. Ama
     kilit ekranında çalan tek bir audio elemanı var ve loop=true ile
     elindeki kaynağı sonsuza dek tekrarlıyor. Kaynağı yalnız kilit
     BAŞLARKEN bir kez atanıyordu; isim değiştiğinde kimse güncellemiyordu.
     Sonuç: durum yeni isme geçmiş olsa bile kulağa hep eski kayıt
     geliyordu; ekran açılınca oynatma baştan kurulduğu için ancak o zaman
     yeni isim duyuluyordu.

     Artık hazırlık bittiğinde, eleman hâlâ gerçek bir parça çalıyorsa
     kaynağı yenisiyle değiştiriliyor. Sessiz taşıyıcı çalıyorsa veya
     eleman duraklatılmışsa dokunulmuyor — kilit oturumu başlatan yol
     kendi atamasını zaten yapıyor. Aynı kaynak ise boşuna yeniden
     yüklenmiyor; yoksa her hazırlıkta ses baştan başlardı. */
  try{
    const a=_r476LockAudio;
    const yeni=_r476Prepared.fxUrl||_r476Prepared.url||'';
    /* r539: karşılaştırma URL'e göre YAPILMAZ. r476Prepare her çağrıda aynı
       kayıt için bile yeni bir objectURL üretiyor; URL'e bakarsak her
       hazırlıkta kaynak değişmiş görünür, ses baştan başlar ve gidermeye
       çalıştığımız kesintinin aynısını üretiriz. Ölçüt zikir anahtarı:
       yalnız gerçekten BAŞKA bir isme geçildiyse kaynak değiştirilir. */
    const calanAnahtar=a?(a.dataset.sukLockKey||''):'';
    const yeniAnahtar=_r476Prepared.key||'';
    if(a&&yeni&&yeniAnahtar&&yeniAnahtar!==calanAnahtar&&!a.paused&&a.src&&a.src!==_r476SilentUrl){
      const oran=Math.max(.5,Math.min(2,Number(_r476Prepared.playRate)||1));
      a.loop=true;
      a.src=yeni;
      try{delete a.dataset.sukSilentCarrier}catch(e){}
      a.defaultPlaybackRate=oran;
      a.playbackRate=oran;
      try{a.preservesPitch=true}catch(e){}
      a.load();
      try{a.dataset.sukLockKey=yeniAnahtar;a.dataset.sukLockFx=_r476Prepared.fxUrl?'1':'0'}catch(e){}
      const pp=a.play(); if(pp&&pp.catch)pp.catch(()=>{});
      try{window.SukunNativeEchoBridge?.start?.(a,{src:yeni,wet:KAYIT?.yankiMik,volume:a.volume,rate:a.playbackRate,key:yeniAnahtar,mode:'lock-zikir',baked:!!_r476Prepared.fxUrl})}catch(e){}
      try{r476MediaSession('recording')}catch(e){}
    }
  }catch(e){}
  return true;
}
/* ═══ r541 — KİLİT EKRANINDA PLAY SESİ GERİ GETİRMİYORDU ════════════
   Kilit ekranında ses, r476'nın tek yerel <audio> elemanından çıkıyor.
   Ama kilit düğmelerinin bağlı olduğu işleyiciler ses kayıt defterinin
   SAĞLAYICILARI üzerinde çalışıyor ve bu eleman o defterde yok.
   Duraklatma çalışıyordu çünkü tarayıcı üstveri sahibi elemanı kendisi
   duraklatıyor; başlatma ise sağlayıcıları uyandırmaya çalışıp elemana
   hiç dokunmuyordu. Eleman duraklatılmış kaldığı için ses gelmiyordu.

   Aşağıdaki köprü elemanı dışarıya açıyor; kilit işleyicileri artık önce
   bunu deniyor. Kilit oturumu yoksa veya eleman sessiz taşıyıcıdaysa
   dokunmuyor, normal yola bırakıyor. */
window.SukunLockAudio={
  etkin(){
    try{
      const a=_r476LockAudio;
      return !!(a&&a.src&&a.src!==_r476SilentUrl);
    }catch(e){ return false }
  },
  calisiyor(){
    try{return this.etkin()&&!_r476LockAudio.paused&&!_r476LockAudio.ended}catch(e){return false}
  },
  anahtar(){
    try{return String(_r476LockAudio?.dataset?.sukLockKey||'')}catch(e){return''}
  },
  beklenenAnahtar(){
    try{return typeof zikirKey==='function'?String(zikirKey()||''):''}catch(e){return''}
  },
  duraklatildi(){
    try{ return this.etkin()&&!!_r476LockAudio.paused }catch(e){ return false }
  },
  surdur(){
    try{
      if(!this.etkin())return false;
      const a=_r476LockAudio;
      if(!a.paused)return true;
      a.loop=true;
      const p=a.play(); if(p&&p.catch)p.catch(()=>{});
      try{window.SukunNativeEchoBridge?.resume?.(a)}catch(e){}
      try{navigator.mediaSession.playbackState='playing'}catch(e){}
      return true;
    }catch(e){ return false }
  },
  duraklat(){
    try{
      if(!this.etkin())return false;
      _r476LockAudio.pause();
      try{window.SukunNativeEchoBridge?.pause?.(_r476LockAudio)}catch(e){}
      try{navigator.mediaSession.playbackState='paused'}catch(e){}
      return true;
    }catch(e){ return false }
  }
};

function r476MediaSession(mode){
  try{
    if(!('mediaSession'in navigator))return;
    const title=(typeof r476CurrentLabel==='function'?r476CurrentLabel():'')||($('#zTr')?.textContent||'Zikir').trim()||'Zikir';
    navigator.mediaSession.metadata=new MediaMetadata({
      title:'Zikir · '+title,
      artist:mode==='recording'?'SÜKÛN · Kendi kayıt':'SÜKÛN · TTS',
      album:'Tefekkür / Zikir'
    });
    navigator.mediaSession.playbackState='playing';
  }catch(e){}
}
function r476StopTtsBatch(){
  try{if(_r476Batch){_r476Batch.active=false}_r476Batch=null;speechSynthesis.cancel()}catch(e){}
}
function r481StableVoice(preferred,lang){
  try{
    const voices=speechSynthesis.getVoices()||[];
    if(!voices.length)return preferred||null;
    if(preferred){
      const exact=voices.find(v=>v.name===preferred.name&&v.lang===preferred.lang);
      if(exact)return exact;
      const sameName=voices.find(v=>v.name===preferred.name);
      if(sameName)return sameName;
    }
    const p=String(lang||'tr-TR').slice(0,2).toLowerCase();
    return voices.find(v=>String(v.lang||'').toLowerCase().startsWith(p))||preferred||voices[0]||null;
  }catch(e){return preferred||null}
}
function r476StartTtsBatch(){
  const p=_r476Prepared;
  if(!p.text||!('speechSynthesis'in window))return false;
  r476StopTtsBatch();

  /* Dev tek metin bazı Android TTS motorlarında kilit ekranında prosodiyi
     bozup yüksek/ince "cüce" tınısına geçebiliyor. Her tekrar normal bir
     utterance olarak ÖNCEDEN kuyruğa verilir; kilitte yeni JS timer gerekmez. */
  const voice=r481StableVoice(p.voice,p.lang);
  const rate=Math.max(.55,Math.min(1.55,(p.rate||.85)*(window.OKUMA_HIZ||1)));
  const pitch=Math.max(.72,Math.min(1.02,p.pitch==null?.9:p.pitch));
  const queueCount=120;
  const b={active:true,items:[],completed:0,current:0,total:queueCount,voiceName:voice?.name||'',rate,pitch};
  _r476Batch=b;

  try{
    for(let i=0;i<queueCount;i++){
      const u=new SpeechSynthesisUtterance(p.text.trim());
      u.lang=p.lang||'tr-TR';
      if(voice)u.voice=voice;
      u.rate=rate;
      u.pitch=pitch;
      try{
        u.volume=Math.min(1,Math.max(.05,((typeof ZVOL==='number'?ZVOL:1)*(window.okumaSeviyesi?.()||1))));
      }catch(e){u.volume=1}

      u.onstart=()=>{if(b.active)b.current=i};
      u.onend=()=>{if(b.active)b.completed=Math.max(b.completed,i+1)};
      u.onerror=()=>{};
      b.items.push(u);
      speechSynthesis.speak(u);
    }
    return true;
  }catch(e){
    try{speechSynthesis.cancel()}catch(_){}
    b.active=false;
    return false;
  }
}
async function r476BeginHidden(){
  if(!Z.auto||!zikirSesliAktifMi()||ZIKIR_BIRLIKTE)return false;
  if(_r476Hidden)return true;

  if(!_r476Prepared.key){try{await r476Prepare()}catch(e){}}

  /* Foreground kaydı ortasındaysa fazını yakala; kilit geçişi mümkün olduğunca
     aynı yerden sürsün. */
  let phaseMs=0;
  try{
    const playing=[...SES.ler].find(x=>x&&!x.paused&&!x.ended);
    if(playing&&Number.isFinite(playing.currentTime)){
      phaseMs=Math.max(0,playing.currentTime*1000/Math.max(.1,playing.playbackRate||1));
    }
  }catch(e){}

  try{if(typeof sesDurdur==='function')sesDurdur()}catch(e){}
  try{speechSynthesis.cancel()}catch(e){}

  const sourceUrl=_r476Prepared.fxUrl||_r476Prepared.url||'';
  const cycleMs=Math.max(650,_r476Prepared.cycleMs||_r476Prepared.durationMs||zAutoTempoMs());
  const now=Date.now();
  _r476Hidden={
    startedAt:now,
    count:+Z.count||0,devir:+Z.devir||0,total:+Z.total||0,
    mode:sourceUrl?'recording':'tts',
    cycleMs,
    phaseMs:sourceUrl?(phaseMs%cycleMs):0,
    preparedKey:_r476Prepared.key||'',
    fx:!!_r476Prepared.fxUrl
  };

  /* ═══ r540 — KİLİTTEYKEN İSİM İLERLEMİYORDU (KÖK NEDEN) ══════════════
     Yukarıdaki not açıkça söylüyor: kilitte tekrar başlatma yapılmaz, tek
     native audio aynı kaydı loop eder ve «sayaç ekran geri geldiğinde
     sessizce uzlaştırılır». Yani kilitliyken Z.count HİÇ ARTMIYOR.
     Hedef kontrolü (count >= target) sayaca baktığı için hiç tetiklenmiyor;
     ebced dolsa bile isim ilerlemiyordu. Ekran açılınca r476EndHidden
     geçen süreyi cycleMs'e bölüp tekrarları toplu işliyor, sayaç hedefi
     bir anda aşıyor ve isim ancak O ZAMAN değişiyordu.

     Bu yüzden r536, r538 ve r539 tek başına yetmedi: üçü de zincirin ALT
     halkalarıydı (geçişin işlenmesi, parçanın hazırlanması, kaynağın
     değiştirilmesi). Üstteki halka — kilitliyken hedefe varıldığının fark
     edilmesi — hiç yoktu.

     Çözüm: kilit oturumu kurulurken kalan tekrar sayısından süre hesaplanıp
     zamanlayıcı kuruluyor. Süre dolunca sayaç hedefe taşınıyor, normal
     ilerleme yolu (rep) çağrılıyor — geçiş, hazırlık ve kaynak değişimi
     zaten oradan zincirleniyor — ve sonraki isim için yeni zamanlayıcı
     kuruluyor. Böylece kilitliyken de isimler sırayla akıyor.

     Zamanlayıcı ses çaldığı sürece güvenilir: tarayıcılar ses çalan
     sekmede zamanlayıcıyı ağır kısıtlamaz. Ses durursa zaten kilit oturumu
     bitiyor ve zamanlayıcı temizleniyor. */
  try{ if(_r476HedefTimer){clearTimeout(_r476HedefTimer);_r476HedefTimer=0;} }catch(e){}
  try{
    if(!window.__SUKUN_R692_LOCK_TARGET_AUTHORITY__ && sourceUrl && Z.adv && (+Z.target||0)>0){
      const kalanRep=Math.max(0,(+Z.target||0)-(+Z.count||0));
      if(kalanRep>0){
        const faz=Math.max(0,(_r476Hidden.phaseMs||0)%cycleMs);
        const sure=Math.max(400,kalanRep*cycleMs-faz);
        _r476HedefTimer=setTimeout(function r476HedefVarildi(){
          _r476HedefTimer=0;
          try{
            if(document.hidden!==true)return;      /* ekran açıldıysa normal yol devralır */
            if(!_r476Hidden)return;                 /* kilit oturumu bitmiş */
            /* Sayacı hedefe taşı ve normal ilerleme yolunu çalıştır:
               rep() hedefi görüp geçişi işler, geçiş r476Prepare'i tetikler,
               r476Prepare de çalan kaynağı yenisiyle değiştirir (r539). */
            const hedef=+Z.target||0;
            if(hedef>0&&(+Z.count||0)<hedef)Z.count=hedef-1;
            if(typeof rep==='function')rep();

            /* r634 — rep() isim kimliğini senkron değiştirir fakat yeni kayıt
               IndexedDB'den asenkron hazırlanır. Sonraki hedef zamanlayıcısını
               eski Kerîrin cycle/key'i ile kurma; transaction'ın başlattığı
               preparation tamamlanınca yeni ismin gerçek cycle'ını sahiplen. */
            const finalizeNext=()=>{
              try{
                if(document.hidden!==true||!_r476Hidden)return;
                _r476Hidden.startedAt=Date.now();
                _r476Hidden.count=+Z.count||0;
                _r476Hidden.devir=+Z.devir||0;
                _r476Hidden.phaseMs=0;
                _r476Hidden.cycleMs=Math.max(650,_r476Prepared.cycleMs||cycleMs);
                _r476Hidden.preparedKey=_r476Prepared.key||'';
                const yeniKalan=Math.max(0,(+Z.target||0)-(+Z.count||0));
                if(yeniKalan>0&&Z.adv){
                  const c2=Math.max(650,_r476Hidden.cycleMs||cycleMs);
                  _r476HedefTimer=setTimeout(r476HedefVarildi,Math.max(400,yeniKalan*c2));
                }
              }catch(e){}
            };
            const pending=window.__SUKUN_R476_PREPARE_PROMISE__;
            if(pending&&typeof pending.then==='function')pending.finally(finalizeNext);
            else finalizeNext();
          }catch(e){}
        },sure);
      }
    }
  }catch(e){}

  const a=r476Audio();
  if(sourceUrl){
    try{
      a.pause();a.loop=true;a.src=sourceUrl;
      try{delete a.dataset.sukSilentCarrier}catch(e){}
      /* r539: hangi ismin parçası çalıyor — kaynak değiştirme ölçütü. */
      try{a.dataset.sukLockKey=_r476Prepared.key||'';a.dataset.sukLockFx=_r476Prepared.fxUrl?'1':'0'}catch(e){}
      const lockRate=Math.max(.5,Math.min(2,Number(_r476Prepared.playRate)||1));
      a.defaultPlaybackRate=lockRate;
      a.playbackRate=lockRate;
      try{a.preservesPitch=true}catch(e){}
      try{a.mozPreservesPitch=true}catch(e){}
      try{a.webkitPreservesPitch=true}catch(e){}
      const zv=(typeof ZVOL==='number'&&isFinite(ZVOL))?ZVOL:1;
      a.volume=Math.max(.05,Math.min(1,zv));
      a.load();
      const go=()=>{
        try{
          if(Number.isFinite(a.duration)&&a.duration>0&&_r476Hidden){
            const srcPhase=(_r476Hidden.phaseMs/1000)*Math.max(.5,Math.min(2,Number(_r476Prepared.playRate)||1));
            a.currentTime=Math.min(Math.max(0,srcPhase),Math.max(0,a.duration-.04));
          }
        }catch(e){}
        const pp=a.play();if(pp?.catch)pp.catch(()=>{});
        try{window.SukunNativeEchoBridge?.start?.(a,{src:sourceUrl,wet:KAYIT?.yankiMik,volume:a.volume,rate:a.playbackRate,key:_r476Prepared.key||'',mode:'lock-zikir',baked:!!_r476Prepared.fxUrl})}catch(e){}
      };
      if(a.readyState>=1)go();else a.addEventListener('loadedmetadata',go,{once:true});
      r476MediaSession('recording');
      return true;
    }catch(e){}
  }

  /* TTS web platformunda WebAudio'ya yönlendirilemez; hız/voice korunur.
     Uzun utterance, kilitte yeni timer çağrısı gerektirmeden speech engine'e
     tek seferde teslim edilir. */
  try{
    a.loop=true;a.src=_r476SilentUrl;a.volume=1;a.load();
    const pp=a.play();if(pp?.catch)pp.catch(()=>{});
  }catch(e){}
  r476MediaSession('tts');
  return r476StartTtsBatch();
}
function r476TtsSpoken(){
  const b=_r476Batch;
  if(!b)return 0;
  return Math.max(0,Math.floor(b.completed||0));
}
/* r695 — TEK KULLANIM MUHASEBESİ.
   Günlük sayaç, Esmâ kullanım sayacı, hidden catch-up, voice rollback ve Undo
   aynı delta-ledger üzerinden ilerler. Böylece engellenen/geri alınan bir rep
   istatistiklerde hayalet sayı bırakamaz; sınır tekrarı da yeni Esmâ'ya yazılmaz. */
const R695_USAGE=window.__SUKUN_R695_USAGE__||(window.__SUKUN_R695_USAGE__={credits:0,rollbacks:0,undo:0,lastDelta:0,lastCat:'',lastIdx:-1,lastReason:'ready',lastAt:0});
function r695AdjustUsageStats(delta,cat,idx,opt={}){
  delta=Math.trunc(+delta||0);if(!delta)return 0;
  cat=String(cat||'');idx=Math.max(0,Math.trunc(+idx||0));
  const doDaily=opt.daily!==false,doEsma=opt.esma!==false;
  if(doDaily)try{
    if(typeof dayZkTemizle==='function'&&typeof dayKey==='function'){
      const m=dayZkTemizle(S.get('sukun.dayZk',{})),k=dayKey();
      m[k]=Math.max(0,Math.min(10000000,(m[k]||0)+delta));
      const keys=Object.keys(m).sort();while(keys.length>14)delete m[keys.shift()];
      S.set('sukun.dayZk',m);
      if(!document.hidden){const el=document.getElementById('tcZk');if(el)el.textContent=m[k]||0}
    }
  }catch(e){}
  if(doEsma&&cat==='esma')try{
    if(typeof esmaCountTemizle==='function'){
      const it=ZIKIR?.esma?.items?.[idx],nm='Yâ '+(it?.t||'');
      if(nm.trim()!=='Yâ'){
        const c=esmaCountTemizle(S.get('sukun.esmaCount',{})),next=Math.max(0,Math.min(10000000,(c[nm]||0)+delta));
        if(next>0)c[nm]=next;else delete c[nm];
        S.set('sukun.esmaCount',c);
      }
    }
  }catch(e){}
  if(opt.completed)try{if(typeof virdCheckFor==='function')virdCheckFor(cat,idx,true);else if(typeof virdCheck==='function')virdCheck()}catch(e){}
  if(delta>0)R695_USAGE.credits+=delta;else R695_USAGE.rollbacks+=Math.abs(delta);
  if(opt.reason==='undo')R695_USAGE.undo+=Math.abs(delta);
  R695_USAGE.lastDelta=delta;R695_USAGE.lastCat=cat;R695_USAGE.lastIdx=idx;R695_USAGE.lastReason=String(opt.reason||'adjust');R695_USAGE.lastAt=Date.now();
  return Math.abs(delta);
}
function r694CreditUsageStats(n,cat,idx,opt={}){
  n=Math.max(0,Math.trunc(+n||0));return n?r695AdjustUsageStats(n,cat,idx,opt):0;
}
window.SukunUsageStatsAdjustR695=r695AdjustUsageStats;
window.SukunUsageStatsCreditR694=r694CreditUsageStats; /* geriye uyumlu çağrı */
window.SukunUsageStatsRollbackR695=(n,cat,idx,reason='voice-rollback')=>r695AdjustUsageStats(-Math.max(0,Math.trunc(+n||0)),cat,idx,{reason});
window.SukunUsageStatsR695=Object.freeze({version:'r695',snapshot:()=>Object.freeze({...R695_USAGE})});
async function r476SilentApply(reps){
  reps=Math.max(0,Math.min(5000,Math.floor(reps||0)));
  if(!reps)return;
  const statCat=Z.cat,statIdx=Z.idx,statTarget=Math.max(0,+Z.target||0),statCount=Math.max(0,+Z.count||0),statDevir=Math.max(0,+Z.devir||0);let applied=0;
  window.__r476SilentCatchup=true;
  _zAutoSessizUntil=Date.now()+1800;
  try{
    /* r693 — adv açıkken unlock catch-up r692 tarafından mevcut Esmâ'nın
       kalan hedefiyle zaten sınırlandırılır. Yüzlerce _repS() çağrısı yapmak
       aynı sonucu üretirken ana thread'i 50–150 ms bloklayabiliyordu. Hedefin
       son tekrarına kadar aritmetik ilerle, yalnız transaction sınırında tek
       gerçek rep çağır. Böylece sayaç/total tam, geçiş exactly-once kalır. */
    const target=Math.max(0,+Z.target||0),count=Math.max(0,+Z.count||0);
    if(Z.adv&&target>0&&count<target&&reps<=target-count){
      const room=target-count;
      const bulk=Math.min(reps,Math.max(0,room-1));
      if(bulk){Z.count+=bulk;Z.total+=bulk;reps-=bulk;applied+=bulk}
      if(reps>0){_repS();reps--;applied++}
      if(reps>0){Z.count+=reps;Z.total+=reps;applied+=reps;reps=0}
      try{S.set('sukun.total',Z.total)}catch(e){}
    }else{
      for(let i=0;i<reps;i++){
        _repS();applied++;
        if(i&&i%80===0)await new Promise(r=>requestAnimationFrame(r));
      }
    }
  }finally{
    window.__r476SilentCatchup=false;
    try{
      const completed=!!(statTarget>0&&statCount<statTarget&&applied>=statTarget-statCount);
      if(applied)r694CreditUsageStats(applied,statCat,statIdx,{completed,reason:'hidden-catchup'});
    }catch(e){}
    try{zUI()}catch(e){}
  }
}
async function r476EndHidden(){
  const s=_r476Hidden;if(!s)return 0;
  _r476Hidden=null;
  /* r540: kilit bitti, hedef zamanlayıcısı boşta kalmasın. */
  try{ if(_r476HedefTimer){clearTimeout(_r476HedefTimer);_r476HedefTimer=0;} }catch(e){}

  let reps=0;
  if(s.mode==='recording'){
    const elapsed=Math.max(0,Date.now()-s.startedAt);
    const cycle=Math.max(650,s.cycleMs);
    const startPhase=Math.max(0,s.phaseMs||0)%cycle;
    /* Gizlerken zaten sayılmış olan mevcut okuma tekrar sayılmaz.
       Yalnız loop sınırından geçen YENİ tekrarlar sayılır. */
    reps=Math.max(0,Math.floor((startPhase+elapsed)/cycle)-Math.floor(startPhase/cycle));
  }else{
    reps=r476TtsSpoken();
  }

  r476StopTtsBatch();
  try{window.SukunAudioSessionRegistry?.sync?.()}catch(e){}

  /* r692 — kilit dönüşünde eski kaydın dinlenmiş süresi sonraki Esmâlara
     dağıtılamaz. Android bir hedef zamanlayıcısını geciktirdiyse kullanıcı o
     sürede hâlâ AYNI ismi duydu. Eski r476SilentApply tüm elapsed tekrarları
     peş peşe uygulayıp Hâdî → Bedî’ → Bâkî → Vâris gibi birkaç hedefi tek
     görünür dönüşte geçebiliyordu. Catch-up en fazla o anda gerçekten çalan
     ismin kalan hedefi kadar uygulanır; fazla süre sonraki isimlere yazılmaz. */
  try{
    if(s.mode==='recording'&&Z.adv&&(+Z.target||0)>0){
      const room=Math.max(0,(+Z.target||0)-(+Z.count||0));
      if(reps>room){
        const discarded=reps-room;
        reps=room;
        const m=window.__SUKUN_R693_LOCK_TARGET_METRICS__||window.__SUKUN_R692_LOCK_TARGET_METRICS__;
        if(m){m.catchupCaps=(m.catchupCaps||0)+1;m.discardedCycles=(m.discardedCycles||0)+discarded;m.lastDiscarded=discarded;m.lastReason='visible-catchup-capped';m.lastAt=Date.now()}
        try{window.dispatchEvent(new CustomEvent('sukun:r692-lock-catchup-capped',{detail:{discarded,room,key:(typeof zikirKey==='function'?zikirKey():''),at:Date.now()}}))}catch(e){}
      }
    }
  }catch(e){}

  await r476SilentApply(reps);
  _zAutoSon=Date.now();

  const a=r476Audio();
  const oldVol=Number.isFinite(a.volume)?a.volume:1;
  try{window.SukunNativeEchoBridge?.stop?.(a,'lock-visible-return')}catch(e){}

  /* Önce normal foreground okumasını devreye al; sonra kilit track'ini
     220ms'de söndür. Böylece dönüşte ses kesilmez ama çift ses de uzamaz. */
  if(Z.auto&&zikirSesliAktifMi()&&!ZIKIR_BIRLIKTE){
    try{
      const vp=zikirSesBaslat(false);
      Promise.resolve(vp).then(r=>window.SukunZikirTransportGate?.observeVoice?.(r,'lock-visible-return')).catch(()=>{});
    }catch(e){}
  }
  const t0=performance.now();
  const fade=()=>{
    const k=Math.min(1,(performance.now()-t0)/220);
    try{a.volume=Math.max(0,oldVol*(1-k))}catch(e){}
    if(k<1)requestAnimationFrame(fade);
    else{
      try{
        a.pause();a.src=_r476SilentUrl;a.loop=true;a.volume=1;
        try{a.dataset.sukSilentCarrier='1';delete a.dataset.sukLockKey}catch(e){}
        a.load();
        if(Z.auto){const pp=a.play();if(pp?.catch)pp.catch(()=>{})}
      }catch(e){}
    }
  };
  requestAnimationFrame(fade);

  _zAutoSessizUntil=Date.now()+900;
  return reps;
}
function r476Stop(all=true){
  _r476Hidden=null;r476StopTtsBatch();
  try{
    const a=_r476LockAudio;
    if(a){try{window.SukunNativeEchoBridge?.stop?.(a,'lock-stop')}catch(e){};a.pause();a.currentTime=0}
  }catch(e){}
  if(all){
    try{if('mediaSession'in navigator)navigator.mediaSession.playbackState='none'}catch(e){}
  }
}
window.SukunLockScreenZikir={
  version:'r481',
  prime:r476Prime,
  prepare:r476Prepare,
  beginHidden:r476BeginHidden,
  endHidden:r476EndHidden,
  running:()=>!!_r476Hidden,
  source:()=>_r476Hidden?.mode||(_r476Prepared.url?'recording':'tts'),
  stop:()=>r476Stop(true)
};
/* r477 — ayar değişince sonraki kilit için FX track'ini görünürken yenile. */
let _r477PrepTO=0;
function r477PrepareSoon(){
  if(document.hidden)return;
  clearTimeout(_r477PrepTO);
  _r477PrepTO=setTimeout(()=>{try{r476Prepare()}catch(e){}},180);
}
document.addEventListener('input',e=>{
  if(e.target?.matches?.('#tempoSld,#recRev,#genRate,#spkRate,[data-r434-tempo],[data-r434-rev]'))r477PrepareSoon();
},{passive:true});
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#rec8dTgl,[data-r434-8d],#recEchoTgl,#recGainTgl'))r477PrepareSoon();
},{passive:true});
window.addEventListener('sukun:voicesource',r477PrepareSoon,{passive:true});

function zAutoTempoMs(){ return Math.max(180,Math.round((+Z.tempo||1)*1000)); }
function zSessizTamamla(n){
  window.__SUKUN_DEFER_ZIKIR_TRANSITION__=false;
  window.__SUKUN_PENDING_ZIKIR_TRANSITION__=null;
  n=Math.max(0,Math.min(20000,Math.floor(n||0)));
  if(!n)return;
  let secimDegisti=false;
  for(let i=0;i<n;i++){
    Z.count++; Z.total++;
    if(Z.target>0&&Z.count>=Z.target){
      Z.count=0; Z.devir++;
      if(Z.adv){
        const grup=ZIKIR[Z.cat]&&ZIKIR[Z.cat].items;
        if(grup&&grup.length){
          Z.idx=(Z.idx+1)%grup.length;
          try{ if(typeof zHedefSecimeUyarla==='function')zHedefSecimeUyarla(false); }catch(e){}
          secimDegisti=true;
        }
      }
    }
  }
  if(secimDegisti)try{renderZikir(false)}catch(e){}
  try{S.set('sukun.total',Z.total)}catch(e){}
  try{zUI()}catch(e){}
}
let _zAutoPlanSeq=0;
function zAutoKur(yeniden){
  if(!Z.auto)return;

  const planSeq=++_zAutoPlanSeq;

  if(document.hidden&&zikirSesliAktifMi()&&!ZIKIR_BIRLIKTE){
    if(Z.autoId){clearTimeout(Z.autoId);Z.autoId=null;}
    if(!window.SukunLockScreenZikir?.running?.())r476BeginHidden();
    return;
  }

  if(Z.autoId){clearTimeout(Z.autoId);Z.autoId=null;}

  const seriSes=!!(zikirSesliAktifMi()&&!ZIKIR_BIRLIKTE);
  if(yeniden||!_zAutoSon)_zAutoSon=Date.now();

  const planla=(ms)=>{
    if(planSeq!==_zAutoPlanSeq||!Z.auto)return;
    Z.autoId=setTimeout(dongu,Math.max(40,ms));
  };

  const sesBitincePlanla=()=>{
    const p=window.__SUKUN_ZIKIR_VOICE_PROMISE__;
    if(p){
      Promise.resolve(p).finally(()=>{
        if(planSeq!==_zAutoPlanSeq||!Z.auto||document.hidden)return;
        const kalan=Math.max(40,zAutoTempoMs()-Math.max(0,Date.now()-_zAutoSon));
        planla(kalan);
      });
    }else{
      planla(70);
    }
  };

  const dongu=()=>{
    if(planSeq!==_zAutoPlanSeq||!Z.auto)return;

    if(document.hidden&&seriSes){
      if(Z.autoId){clearTimeout(Z.autoId);Z.autoId=null;}
      r476BeginHidden();
      return;
    }

    const ms=zAutoTempoMs();

    /* 0.8 gibi hızlı tempoda önceki ses sürüyorsa SAYI ARTMAZ.
       Sesin promise'i bittiği anda kalan tempo süresi hesaplanır. */
    if(seriSes&&zikirSesMesgul()){
      sesBitincePlanla();
      return;
    }

    const now=Date.now();
    const gecen=Math.max(1,Math.floor((now-_zAutoSon)/ms));

    /* Yalnız sessiz otomatikte kaçırılan timer turları sayısal telafi edilir.
       Sesli zikirde hiçbir koşulda catch-up ile sayı şişirilmez. */
    if(!seriSes&&gecen>1)zSessizTamamla(gecen-1);

    _zAutoSon=now;
    const ilerledi=rep();
    if(!Z.auto)return;

    if(seriSes){
      if(ilerledi===false){
        planla(70);
        return;
      }
      sesBitincePlanla();
      return;
    }

    planla(zAutoTempoMs());
  };

  if(seriSes&&zikirSesMesgul()){
    sesBitincePlanla();
  }else{
    const bekle=Math.max(40,zAutoTempoMs()-Math.max(0,Date.now()-_zAutoSon));
    planla(bekle);
  }
}
function zAutoUyan(reason){
  if(!Z.auto||document.hidden)return;
  const ms=zAutoTempoMs(), now=Date.now();
  const sesli=!!(zikirSesliAktifMi()&&!ZIKIR_BIRLIKTE);
  const kacirilan=Math.max(0,Math.floor((now-_zAutoSon)/ms));
  if(!sesli&&kacirilan>0)zSessizTamamla(kacirilan);
  _zAutoSon=now;
  _zAutoSessizUntil=now+Math.min(1800,Math.max(900,Math.round(ms*.9)));
  zAutoKur(true);
  try{
    document.body.classList.add('sukun-resume-settling');
    setTimeout(()=>document.body.classList.remove('sukun-resume-settling'),1250);
  }catch(e){}
}
function zAutoUyanPlanla(reason){
  if(!Z.auto)return;
  clearTimeout(_zAutoUyanTO);
  const seq=++_zAutoUyanSeq;
  _zAutoUyanTO=setTimeout(()=>{
    if(seq!==_zAutoUyanSeq||document.hidden||!Z.auto)return;
    zAutoUyan(reason);
  },360);
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    _zAutoHiddenAt=Date.now();
    clearTimeout(_zAutoUyanTO);
    if(Z.autoId){clearTimeout(Z.autoId);Z.autoId=null;}
    try{zBekciDurdur()}catch(e){}
    if(Z.auto&&zikirSesliAktifMi()&&!ZIKIR_BIRLIKTE){
      r476BeginHidden();
    }
    return;
  }
  (async()=>{
    try{await r476EndHidden()}catch(e){}
    if(Z.auto)zAutoUyanPlanla('visibility');
  })();
});
window.addEventListener('pageshow',()=>{
  if(!Z.auto)return;
  if(window.SukunLockScreenZikir?.running?.()){
    (async()=>{try{await r476EndHidden()}catch(e){};zAutoUyanPlanla('pageshow')})();
  }else zAutoUyanPlanla('pageshow');
});

let _r477AutoStarting=false,_r477AutoTapAt=0;
function autoStart(){
  if(Z.auto||_r477AutoStarting)return false;
  // A journey owns its own reader and counter. Never start an independent auto
  // scheduler on top of a paused/running 28 or 99 journey.
  if(window.SukunR698Transport?.hasJourney?.())return false;
  window.SukunR698VoiceIntent?.captureStart?.();
  _r477AutoStarting=true;
  try{

  /* r640: geçmiş global pause latch'i yeni zikir niyetini boğmasın. */
  try{window.SukunAudioSessionRegistry?.releasePauseGate?.('auto-zikir-start')}catch(e){}
  try{window.SukunZikirTransportGate?.reset?.('auto-start')}catch(e){}
  try{ac();if(ctx?.state==='suspended')ctx.resume().catch(()=>{})}catch(e){}
  try{r476Prime();r476Prepare()}catch(e){}

  Z.auto=true;
  _zAutoSon=Date.now();
  try{lockOn()}catch(e){}

  /* r480: ilk okuma artık sayaçtan bağımsız başlamaz.
     İlk dokunuş = 1 sayaç artışı + 1 kayıt/TTS. */
  const ilk=rep();
  if(ilk===false){autoStop();return false;}
  try{zUI()}catch(e){}

  /* Seri ses promise'i ile aynı scheduler zincirine bağlanır. */
  zAutoKur(false);

  try{if(!ZA.kapali)zikirAcilisAna('kisa',()=>{})}catch(e){}
  return true;
  }catch(error){
    try{autoStop()}catch(_){}
    try{window.sukunReport?.('r702-auto-start',error)}catch(_){}
    return false;
  }finally{_r477AutoStarting=false;}
}
function autoStop(){
  _r477AutoStarting=false;
  if(!Z.auto){
    // Never abort a journey's speech from the independent auto-zikir path.
    if(!window.SukunR698Transport?.hasJourney?.()&&(window.__SUKUN_ZIKIR_VOICE_BUSY__||window.__SUKUN_ZIKIR_VOICE_PROMISE__))
      try{window.SukunZikirVoiceAbortR696?.('auto-stop-idle-r698',{stopMedia:true,cancelTts:true})}catch(_){}
    return;
  }
  Z.auto=false;_r477AutoStarting=false;
  try{window.SukunZikirTransportGate?.reset?.('auto-stop')}catch(e){}
  _zAutoPlanSeq++;
  if(Z.autoId){clearTimeout(Z.autoId);Z.autoId=null;}
  _zAutoSon=0;
  window.__SUKUN_PENDING_ZIKIR_TRANSITION__=null;
  window.__SUKUN_DEFER_ZIKIR_TRANSITION__=false;
  window.__SUKUN_NIYET_GATE_PROMISE__=null;
  _r485NiyetGateKey='';
  try{ zBekciDurdur(); }catch(e){}
  /* r696: ritim/scheduler dururken eski kayıt/TTS Promise'i yaşamaya devam
     ederse sonraki Start yalnız ritmi açıp sesi stale transaction'a bağlar. */
  try{ zikirSesAbortR696('auto-stop-r696',{stopMedia:true,cancelTts:true}); }catch(e){}
  try{ r476Stop(true); }catch(e){}
  S.set('sukun.total',Z.total);
  lockOff(); zUI();
}
window.SukunDirectZikirTransportR698=Object.freeze({
  version:'r698',start:()=>autoStart(),stop:()=>autoStop(),
  state:()=>({auto:!!Z.auto,cat:Z.cat,idx:Z.idx,count:Z.count,target:Z.target,voiceRequired:zikirSesliAktifMi(),starting:!!_r477AutoStarting}),
  clearStale(){
    const busy=window.SukunPhysicalRecordingBusyR696?.()||!!(window.speechSynthesis?.speaking);
    const age=Date.now()-(+window.__SUKUN_ZIKIR_VOICE_STARTED_AT__||Date.now());
    if(!window.SukunR698Transport?.hasJourney?.()&&!busy&&age>18000&&(window.__SUKUN_ZIKIR_VOICE_BUSY__||window.__SUKUN_ZIKIR_VOICE_PROMISE__))
      return window.SukunZikirVoiceAbortR696?.('explicit-restart-stale-r698',{stopMedia:true,cancelTts:true});
    return false;
  }
});

/* ════════════════════════════════════════════════════════════
   6) ARAYÜZ BAĞLARI
   ════════════════════════════════════════════════════════════ */
function setFill(inp){
  const min=parseFloat(inp.min), max=parseFloat(inp.max), v=parseFloat(inp.value);
  const mn=isFinite(min)?min:0, mx=isFinite(max)?max:1, vv=isFinite(v)?v:mn;
  const span=mx-mn;
  inp.style.setProperty('--val',(span?((vv-mn)/span*100):0)+'%');
}

/* Sekmeler */
$$('.tab').forEach((b,i)=>{
  b.setAttribute('aria-selected',b.classList.contains('act')?'true':'false');
  b.setAttribute('tabindex',b.classList.contains('act')?'0':'-1');
  const panel=document.getElementById('tab-'+b.dataset.t);
  if(panel){ panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-label',(b.textContent||'').trim()); }
  b.onclick=()=>{
    $$('.tab').forEach(x=>{
      const aktif=x===b; x.classList.toggle('act',aktif);
      x.setAttribute('aria-selected',aktif?'true':'false');
      x.setAttribute('tabindex',aktif?'0':'-1');
    });
    $$('section[id^="tab-"]').forEach(panel=>panel.hidden=(panel.id!=='tab-'+b.dataset.t));
    try{window.dispatchEvent(new CustomEvent('sukun:tabchange',{detail:{tab:b.dataset.t}}))}catch(e){}
  };
  b.onkeydown=e=>{
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
    e.preventDefault(); const l=$$('.tab'), d=e.key==='ArrowRight'?1:-1;
    const n=(l.indexOf(b)+d+l.length)%l.length; l[n].focus(); l[n].click();
  };
});

/* ── Ambiyans mikseri ── */
/* Kanalı hangi kulakçığa koyacağımızı söyleyen ayrı eşleme — 27 kanalın
   kendi tanımına dokunmadan (regresyon riski en düşük yol). */
/* Kanal sayısı 27'den 55'e çıkınca iki kategori yetmez oldu: yeni sesler
   haritada olmadığı için hepsi «Doğa» grubuna düşüyor, liste 4,9 ekran
   boyu tek yığın hâline geliyordu. Kategoriler genişletildi ve her kanalın
   kendi kat alanı (tanımlarda) esas alınıyor. */
/* Ses seviyeleri ölçümle dengelendi: kanallar arasında 30 kata varan
   fark vardı (Rüzgâr Çanları tepe 1, Okyanus 31). Her kanalın cal çarpanı,
   ölçülen tepe genliğe göre ortak bir hedefe (~16) göre yeniden hesaplandı.
   Kullanıcının kendi ses kaydırıcısı bunun üstünde çalışmaya devam eder. */
const AMB_CATS=[
 {k:'su',    t:'💧 Su & Gökyüzü'},
 {k:'gurultu',t:'📊 Gürültü Renkleri'},
 {k:'doga',  t:'🌿 Kır & Ateş'},
 {k:'canli', t:'🐦 Canlılar'},
 {k:'mekan', t:'🏛 Mekânlar'},
 {k:'asmr',  t:'✋ ASMR & Dokunuş'},
 {k:'uyku',  t:'🌙 Uyku & Sabit Uğultu'},
 {k:'sakin', t:'🕊 Sakinleştiriciler'},
 {k:'zikir', t:'۞ Zikir & Usûl'},
 {k:'makam', t:'🎼 Makamlar'},
 {k:'neuro', t:'🧠 NeuroSync'}
];
/* Eski harita geriye dönük uyumluluk için duruyor; tanımdaki d.kat önceliklidir. */
const AMB_CAT_MAP={
 ney:'makam',sema:'zikir',hu:'zikir',
 rast:'makam',hicaz:'makam',saba:'makam',huseyni:'makam',
 nihavent:'makam',neva:'makam',acemasiran:'makam',isfahan:'makam',
 rain:'doga',birds:'canli',forest:'doga',cicada:'doga',stream:'doga',
 wind:'doga',ocean:'doga',storm:'doga',fire:'doga',kedi:'canli',
 bulbul:'canli',muhabbet:'canli',kuzu:'canli',ari:'canli',kurbaga:'doga',can:'sakin'
};
/* Açılışta yalnız iki grup açık gelir — 55 kanalın tamamı açık gelirse
   gruplama işe yaramaz, liste yine 5 ekran olur. */
let AMB_OPEN=new Set(S.get('sukun.ambopen',['su']));
const MAQAM8=new Set(['rast','hicaz','saba','huseyni','nihavent','neva','acemasiran','isfahan','segah','kurdi','mahur']);
const PREVIEW={timer:null,id:null};

function previewUi(id,on){
  try{
    const card=document.getElementById('chn-'+id);
    if(card)card.classList.toggle('previewing',!!on);
    const btn=document.querySelector('[data-prev="'+id+'"]');
    if(btn){btn.classList.toggle('previewing',!!on);btn.textContent=on?'■':'▶';}
  }catch(e){}
}

function previewStop(stopChannel=true){
  const id=PREVIEW.id;
  if(PREVIEW.timer){try{clearTimeout(PREVIEW.timer)}catch(e){} PREVIEW.timer=null;}
  PREVIEW.id=null;
  if(id){
    previewUi(id,false);
    if(stopChannel){try{if(AMB[id])chOff(id)}catch(e){}}
  }
  try{syncMixerUI()}catch(e){}
}

function previewCommit(id){
  /* Preview kanalını kapatmadan kalıcı kanala çevir. */
  if(PREVIEW.id!==id || !AMB[id])return false;
  if(PREVIEW.timer){try{clearTimeout(PREVIEW.timer)}catch(e){} PREVIEW.timer=null;}
  PREVIEW.id=null;
  previewUi(id,false);
  try{syncMixerUI()}catch(e){}
  return true;
}

function previewMaqam(id){
  const def=AMBIENT_DEFS.find(x=>x.id===id);
  if(!def)return;

  /* Kalıcı çalan kanal varsa preview başlatma. */
  if(AMB[id] && PREVIEW.id!==id){
    try{if(typeof toast==='function')toast('🎼 '+def.name+' zaten çalıyor')}catch(e){}
    return;
  }

  /* Aynı preview düğmesine ikinci kez basılırsa durdur. */
  if(PREVIEW.id===id){previewStop(true);return;}

  /* Önceki preview varsa yalnız onu kapat. */
  if(PREVIEW.id)previewStop(true);

  try{
    ac();
    if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});

    /* Tek ses motoru: normal kanal motorunu aynen kullan. */
    chOn(def);
    if(!AMB[id])throw new Error('preview channel not created');

    PREVIEW.id=id;
    previewUi(id,true);
    /* UI'de kalıcı açık görünmesin. */
    syncMixerUI();

    PREVIEW.timer=setTimeout(()=>{
      if(PREVIEW.id===id)previewStop(true);
    },4200);
  }catch(e){
    try{if(AMB[id])chOff(id)}catch(_){ }
    PREVIEW.id=null; PREVIEW.timer=null; previewUi(id,false);
    try{if(typeof toast==='function')toast('Makam önizlemesi başlatılamadı')}catch(_){ }
    console.warn('[SÜKÛN makam preview]',id,e);
  }
}
function chnCardHTML(d){
  const did=hesc(d.id),dname=hesc(d.name),ddesc=hesc(d.desc),dicon=hesc(d.icon||'♪');
  return '<div class="chn" id="chn-'+did+'">'+
     '<div class="chTop">'+
       '<span class="chIc">'+dicon+'</span>'+
       '<div class="chName" title="'+dname+'"><b>'+dname+'</b><small>'+ddesc+'</small></div>'+
       '<i class="chEq" aria-hidden="true"><s></s><s></s><s></s><s></s></i>'+
       (MAQAM8.has(d.id)?'<button class="chPrev" data-prev="'+did+'" aria-label="'+dname+' — kısa dinle" title="Kısa dinle (~3sn)">▶</button>':'')+
       '<button class="chInfo" data-ambinfo="'+did+'" aria-label="'+dname+' hakkında bilgi" title="Detay ve kullanım ipucu">i</button>'+
       '<button class="sw" data-sw="'+did+'" aria-label="'+dname+' aç/kapat"></button>'+
     '</div>'+
     (d.custom?(
       '<div class="chActions">'+
         '<button class="chEdit" data-edit="'+did+'" aria-label="'+dname+' adını değiştir"><span class="ico" data-ico="pencil"></span> Ad</button>'+
         '<button class="chDel" data-del="'+did+'" aria-label="'+dname+' sil"><span class="ico" data-ico="trash"></span> Sil</button>'+
       '</div>'
     ):'')+
     '<input type="range" min="0" max="1" step="0.01" value="'+clamp(+chVol[d.id]||0,0,1)+'" data-vol="'+did+'" aria-label="'+dname+' ses">'+
   '</div>';
}
function ambAccItem(key,title,count,inner){
  const open=AMB_OPEN.has(key);
  return '<div class="preAcc'+(open?' open':'')+'" data-ambacc="'+key+'">'+
    '<button class="preAccHead" data-ambacctgl="'+key+'">'+
      '<span class="preAccT">'+title+'</span>'+
      '<span class="preAccN">'+count+'</span>'+
      '<span class="preAccChev">⌄</span>'+
    '</button>'+
    '<div class="preAccBody"><div class="preAccInner"><div class="mixGrid">'+inner+'</div></div></div>'+
  '</div>';
}
function renderMixer(){
  let body='';
  AMB_CATS.forEach(cat=>{
    const items=AMBIENT_DEFS.filter(d=>!d.custom && (d.kat||AMB_CAT_MAP[d.id]||'doga')===cat.k);
    if(!items.length)return;
    body+=ambAccItem(cat.k,cat.t,items.length,items.map(chnCardHTML).join(''));
  });
  const custom=AMBIENT_DEFS.filter(d=>d.custom);
  if(custom.length) body+=ambAccItem('ozel','🎙 Kendi Seslerim',custom.length,custom.map(chnCardHTML).join(''));
  $('#mixer').innerHTML=body;
  syncAmbAccHeights();
  $('#sessRow').innerHTML=SESSIONS.map((s,i)=>
   '<button class="sess" data-sess="'+i+'"><span class="sIc">'+s.icon+'</span><b>'+s.name+'</b><small>'+s.sub+'</small></button>').join('');
}
function syncAmbAccHeights(){
  /* r703: eskiden her akordeon için sırayla scrollHeight OKUNUP hemen maxHeight
     YAZILIYORDU. Her yazımdan sonraki okuma tarayıcıyı senkron reflow'a zorlar
     (layout thrashing); açılışta ~1.8 sn tutuyordu. Artık bütün ölçümler önce
     alınır, sonra yazılır — sonuç aynı, tek reflow. */
  const olcum=[];
  $$('#mixer .preAcc').forEach(a=>{
    const bd=a.querySelector('.preAccBody'), inner=a.querySelector('.preAccInner');
    if(!bd||!inner)return;
    olcum.push([bd, a.classList.contains('open')?(inner.scrollHeight+2)+'px':'0px']);
  });
  for(let i=0;i<olcum.length;i++){
    const bd=olcum[i][0], v=olcum[i][1];
    if(bd.style.maxHeight!==v)bd.style.maxHeight=v;
  }
}
document.addEventListener('click',e=>{
  const pv=e.target.closest('#mixer [data-prev]');
  if(pv){ previewMaqam(pv.dataset.prev); return; }
});
document.addEventListener('click',e=>{
  const t=e.target.closest('#mixer [data-ambacctgl]'); if(!t)return;
  const key=t.dataset.ambacctgl;
  if(AMB_OPEN.has(key))AMB_OPEN.delete(key); else AMB_OPEN.add(key);
  S.set('sukun.ambopen',[...AMB_OPEN]);
  const acc=t.closest('.preAcc');
  if(acc){ acc.classList.toggle('open',AMB_OPEN.has(key)); syncAmbAccHeights(); }
});
addEventListener('resize',()=>{ if($('#mixer'))syncAmbAccHeights(); });
/* Çalan kanalların özeti — 49 kanal arasında hangilerinin açık olduğunu
   listeyi kaydırmadan görmek için. Kapatma da buradan yapılabilir. */
function calanSeritYaz(){
  const el=document.getElementById('calanSerit'); if(!el)return;
  const acik=AMBIENT_DEFS.filter(d=>AMB[d.id]&&PREVIEW.id!==d.id);
  if(!acik.length){ el.hidden=true; el.innerHTML=''; return; }
  el.hidden=false;
  el.innerHTML='<span class="csBas">ÇALIYOR</span>'+
    acik.map(d=>'<button class="csSeritEt" data-kapat="'+hesc(d.id)+'" title="'+hesc(d.name)+' — kapat">'+
      hesc(d.icon||'♪')+' '+hesc(d.name)+' <i>✕</i></button>').join('')+
    (acik.length>1?'<button class="csHepsi" id="csHepsiKapat">tümünü kapat</button>':'');
}
function syncMixerUI(){
  AMBIENT_DEFS.forEach(d=>{
    const on=!!AMB[d.id] && PREVIEW.id!==d.id;
    const sw=$('[data-sw="'+d.id+'"]'); if(sw)sw.classList.toggle('on',on);
    const card=$('#chn-'+d.id); if(card)card.classList.toggle('on',on);
    const r=$('[data-vol="'+d.id+'"]'); if(r){r.value=chVol[d.id];setFill(r);}
  });
  if(typeof calanSeritYaz==='function')calanSeritYaz();
}
document.getElementById('calanSerit').addEventListener('click',e=>{
  const k=e.target.closest('[data-kapat]');
  if(k){ chOff(k.dataset.kapat); syncMixerUI(); if(typeof vib==='function')vib(8); return; }
  if(e.target.closest('#csHepsiKapat')){
    AMBIENT_DEFS.filter(d=>AMB[d.id]).forEach(d=>chOff(d.id));
    syncMixerUI(); if(typeof vib==='function')vib(12);
  }
});
$('#mixer').addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]');
  if(ed){ csRename(ed.dataset.edit); return; }
  const del=e.target.closest('[data-del]');
  if(del){ csDelete(del.dataset.del); return; }
  const sw=e.target.closest('[data-sw]'); if(!sw)return;
  const id=sw.dataset.sw;

  /* r192: preview ve normal çalma aynı chOn kanalıdır.
     Preview sırasında Aç denirse timer iptal edilir; ses kesilmeden kalıcı olur. */
  if(PREVIEW.id===id && AMB[id]){
    previewCommit(id);
    return;
  }

  if(AMB[id])chOff(id); else {
    const def=AMBIENT_DEFS.find(d=>d.id===id);
    if(def){
      try{
        ac();
        if(ctx && ctx.state==='suspended')ctx.resume().catch(()=>{});
        chOn(def);
      }catch(err){}
    }
  }
  syncMixerUI();
});
$('#mixer').addEventListener('input',e=>{
  const r=e.target.closest('[data-vol]'); if(!r)return;
  setFill(r); chSetVol(r.dataset.vol,+r.value);
});
$('#sessRow').addEventListener('click',e=>{
  const b=e.target.closest('[data-sess]'); if(!b)return;
  applySession(SESSIONS[+b.dataset.sess]);
});

/* ── Frekans paneli ── */
const PRESET_CATS=[
 {k:'med',t:'🧘 Meditasyon & Dinginlik'},
 {k:'odak',t:'⚡ Zindelik & Odak'},
 {k:'uret',t:'🎨 Üretken İlham & Ruh Hâli'},
 {k:'sifa',t:'💚 Dinlenme & Denge'},
 {k:'uyku',t:'😴 Gevşeme & Uyku'},
 {k:'astral',t:'🌌 Astral & Derin Zihin'}
];
let PRESET_FILTER=S.get('sukun.prefilter','all');
let PRESET_OPEN=new Set(S.get('sukun.preopen',['med']));
function accItem(key,title,count,inner){
  const open=PRESET_OPEN.has(key);
  return '<div class="preAcc'+(open?' open':'')+'" data-acc="'+key+'">'+
    '<button class="preAccHead" data-acctgl="'+key+'">'+
      '<span class="preAccT">'+title+'</span>'+
      '<span class="preAccN">'+count+'</span>'+
      '<span class="preAccChev">⌄</span>'+
    '</button>'+
    '<div class="preAccBody"><div class="preAccInner"><div class="preGrid2">'+inner+'</div></div></div>'+
  '</div>';
}
function renderPresets(){
  const host=$('#presets'); if(!host)return;
  const chips='<div class="preFilter" id="preFilter">'+
    '<button data-f="all"'+(PRESET_FILTER==='all'?' class="act"':'')+'>Tümü</button>'+
    PRESET_CATS.map(c=>'<button data-f="'+hesc(c.k)+'"'+(PRESET_FILTER===c.k?' class="act"':'')+'>'+hesc(c.t)+'</button>').join('')+
    '</div>';
  let body='';
  const cats=PRESET_FILTER==='all'?PRESET_CATS:PRESET_CATS.filter(c=>c.k===PRESET_FILTER);
  cats.forEach(cat=>{
    const items=FREQ_PRESETS.map((p,i)=>({p,i})).filter(o=>(o.p.cat||'med')===cat.k);
    if(!items.length)return;
    const inner=items.map(o=>'<button class="pre" data-p="'+o.i+'"><span class="pIc">'+hesc(o.p.icon)+'</span><b>'+hesc(o.p.name)+'</b><small>'+hesc(o.p.sub)+'</small></button>').join('');
    body+=accItem(cat.k,cat.t,items.length,inner);
  });
  host.innerHTML=chips+body;
  syncAccHeights();
}
function syncAccHeights(){
  $$('#presets .preAcc').forEach(a=>{
    const bd=a.querySelector('.preAccBody'), inner=a.querySelector('.preAccInner');
    if(!bd||!inner)return;
    bd.style.maxHeight=a.classList.contains('open')?(inner.scrollHeight+2)+'px':'0px';
  });
}
document.addEventListener('click',e=>{
  const t=e.target.closest('#presets [data-acctgl]'); if(!t)return;
  const key=t.dataset.acctgl;
  if(PRESET_OPEN.has(key))PRESET_OPEN.delete(key); else PRESET_OPEN.add(key);
  S.set('sukun.preopen',[...PRESET_OPEN]);
  const acc=t.closest('.preAcc');
  if(acc){ acc.classList.toggle('open',PRESET_OPEN.has(key)); syncAccHeights(); }
});
addEventListener('resize',()=>{ if($('#presets'))syncAccHeights(); });
document.addEventListener('click',e=>{
  const f=e.target.closest('#preFilter [data-f]'); if(!f)return;
  PRESET_FILTER=f.dataset.f; S.set('sukun.prefilter',PRESET_FILTER);
  renderPresets(); syncFreqUI();
});

/* Eski PRESET_INFO sözlüğü artık kullanılmıyordu ve kesin biyolojik sonuç
   izlenimi veren tarihî açıklamalar taşıyordu. Tek görünür açıklama kaynağı,
   aşağıdaki temkinli presetGuvenliNot() üreticisidir. */

let tipTimer=null, tipEl=null, tipMoved=false, tipSuppressClick=false;
function presetGuvenliNot(p){
  const en=!!(window.I18N&&window.I18N.lang==='en');
  const temaTr={med:'tefekkür ve sakin dinleme',odak:'çalışmaya geçiş ve uyanık odak',uret:'üretkenlik ve serbest çağrışım',sifa:'dinlenme ve kişisel denge',uyku:'gevşeme ve gece rutini',astral:'sembolik/deneysel içe bakış'};
  const temaEn={med:'contemplation and calm listening',odak:'a transition into work and alert focus',uret:'creative work and free association',sifa:'rest and personal balance',uyku:'relaxation and a bedtime routine',astral:'symbolic, experimental inward reflection'};
  const cat=p.cat||'med', t=(window.I18N&&window.I18N.t)?window.I18N.t.bind(window.I18N):(x=>x);
  return en
    ? `This preset combines the sound settings “${t(p.sub)}” for ${temaEn[cat]||temaEn.med}. Frequency and wave labels describe controls or traditional themes; they do not promise a biological or medical outcome.`
    : `Bu preset “${p.sub}” ses ayarlarını ${temaTr[cat]||temaTr.med} niyetiyle birleştirir. Frekans ve dalga etiketleri bir ayarı veya geleneksel temayı anlatır; biyolojik ya da tıbbî sonuç vaat etmez.`;
}
function preTipShow(el){
  const i=el.dataset.p; if(i==null)return;
  const p=FREQ_PRESETS[+i]; if(!p)return;
  $('#ptIc').textContent=p.icon;
  const tr=(window.I18N&&window.I18N.t)?window.I18N.t.bind(window.I18N):(x=>x);
  $('#ptName').textContent=tr(p.name);
  $('#ptSub').textContent=tr(p.sub);
  $('#ptBody').textContent=presetGuvenliNot(p);
  const t=$('#preTip');
  t.style.visibility='hidden'; t.classList.add('show');
  el.classList.add('tipping'); tipEl=el;
  requestAnimationFrame(()=>{ preTipPos(el); t.style.visibility=''; });
}
function preTipPos(el){
  const t=$('#preTip'); if(!el||!t)return;
  const r=el.getBoundingClientRect(), tw=t.offsetWidth, th=t.offsetHeight, vw=innerWidth, vh=innerHeight;
  const left=clamp(r.left+r.width/2-tw/2,8,Math.max(8,vw-8-tw));
  const above=(r.top - th - 12 >= 8);
  const top=above?r.top-th-10:r.bottom+10;
  t.style.left=left+'px'; t.style.top=Math.max(8,Math.min(top,vh-th-8))+'px';
  t.classList.toggle('above',above); t.classList.toggle('below',!above);
  const ax=clamp(r.left+r.width/2-left,16,tw-16);
  t.style.setProperty('--ax',ax+'px');
}
function preTipHide(){
  const t=$('#preTip'); if(t)t.classList.remove('show');
  if(tipEl){tipEl.classList.remove('tipping');tipEl=null;}
}
(function bindPreTip(){
  const host=$('#presets'); if(!host)return;
  host.addEventListener('pointerdown',e=>{
    const el=e.target.closest('.pre[data-p]'); if(!el)return;
    tipMoved=false; tipSuppressClick=false;
    clearTimeout(tipTimer);
    tipTimer=setTimeout(()=>{ if(!tipMoved){ tipSuppressClick=true; preTipShow(el); } },420);
  });
  host.addEventListener('pointermove',()=>{ tipMoved=true; clearTimeout(tipTimer); });
  host.addEventListener('pointerup',()=>{ clearTimeout(tipTimer); setTimeout(preTipHide,1400); });
  host.addEventListener('pointercancel',()=>{clearTimeout(tipTimer);preTipHide();});
  host.addEventListener('mouseover',e=>{ const el=e.target.closest('.pre[data-p]'); if(el&&matchMedia('(hover:hover)').matches)preTipShow(el); });
  host.addEventListener('mouseout',()=>{ if(matchMedia('(hover:hover)').matches)preTipHide(); });
})();
addEventListener('scroll',()=>{ if(tipEl)preTipHide(); },{passive:true,capture:true});

function glassApply(v){
  document.documentElement.style.setProperty('--glassA',v.toFixed(2));
  const el=$('#glassAV'); if(el)el.textContent='%'+Math.round(v*100);
  const sl=$('#glassA'); if(sl){sl.value=v;setFill(sl);}
}
(function initGlassA(){
  const v=+S.get('sukun.glassA',.82);
  glassApply(v);
  const sl=$('#glassA');
  if(sl)sl.addEventListener('input',e=>{ const x=+e.target.value; glassApply(x); S.set('sukun.glassA',x); });
})();
(function initShimmer(){
  SHIMMER_ON=S.get('sukun.shimmer',true)!==false;
  const t=$('#shimTgl'); if(t){
    t.classList.toggle('on',SHIMMER_ON);
    t.onclick=()=>{ SHIMMER_ON=!SHIMMER_ON; t.classList.toggle('on',SHIMMER_ON); S.set('sukun.shimmer',SHIMMER_ON); if(SHIMMER_ON)shimmerChime(); };
  }
  document.documentElement.classList.toggle('noShimmer',!SHIMMER_ON);
})();

$('#presets').addEventListener('click',e=>{
  const b=e.target.closest('[data-p]'); if(!b)return;
  if(tipSuppressClick){ tipSuppressClick=false; return; }
  const p=FREQ_PRESETS[+b.dataset.p];
  celebrate(b);
  if(p.journey){ startJourney(); b.classList.add('act'); }
  else{
    stopJourney();
    FR.c=p.c; FR.b=p.b;
    if(FR.playing)frRetune(.4); else frStart();
    b.classList.add('act'); syncFreqUI(); saveSettings();
  }
});
/* ── 3B frekans düğmesi ──
   Değer 20–18000 Hz arasında logaritmik haritalanır; düğme 270° döner
   (135°'ten 405°'ye), böylece alt ve üst uç görsel olarak ayrışır. */
const KNOB_MIN=20, KNOB_MAX=18000, KNOB_YAY=270;
function knobOranHz(oran){                       /* 0..1 → Hz */
  return KNOB_MIN*Math.pow(KNOB_MAX/KNOB_MIN, Math.max(0,Math.min(1,oran)));
}
function knobHzOran(hz){                         /* Hz → 0..1 */
  const v=Math.max(KNOB_MIN,Math.min(KNOB_MAX,hz));
  return Math.log(v/KNOB_MIN)/Math.log(KNOB_MAX/KNOB_MIN);
}
function knobBiciml(hz){
  if(hz>=10000)return (hz/1000).toFixed(2)+'k';
  if(hz>=1000) return (hz/1000).toFixed(2)+'k';
  if(hz>=100)  return hz.toFixed(1);
  if(hz>=10)   return hz.toFixed(2);
  return hz.toFixed(3);
}
function knobTirtilCiz(){
  const g=document.getElementById('carTirtil'); if(!g||g.childNodes.length)return;
  let h='';
  for(let i=0;i<72;i++){
    const a=(i/72)*360;
    h+='<rect x="99.2" y="9" width="1.6" height="9" rx=".8" fill="url(#kTirtil)" '+
       'transform="rotate('+a+' 100 100)"/>';
  }
  g.innerHTML=h;
}
function knobCiz(hz){
  const k=document.getElementById('carKnob'); if(!k)return;
  const oran=knobHzOran(hz);
  const ibre=document.getElementById('carIbre');
  if(ibre)ibre.setAttribute('transform','rotate('+(135+oran*KNOB_YAY)+' 100 100)');
  const yay=document.getElementById('carYay');
  if(yay){
    const cevre=2*Math.PI*58;                    /* r=58 */
    const tam=cevre*(KNOB_YAY/360);
    yay.setAttribute('stroke-dasharray',(tam*oran).toFixed(1)+' '+cevre.toFixed(1));
  }
  const d=document.getElementById('carVal');
  if(d)d.textContent=knobBiciml(hz);
  k.setAttribute('aria-valuenow',Math.round(hz));
  k.setAttribute('aria-valuetext',knobBiciml(hz)+' hertz');
}
function knobUygula(hz,kayitli){
  hz=Math.max(KNOB_MIN,Math.min(KNOB_MAX,hz));
  FR.c=hz;
  const sld=document.getElementById('carSld'); if(sld)sld.value=hz;
  const num=document.getElementById('carNum'); if(num&&document.activeElement!==num)num.value=+hz.toFixed(2);
  knobCiz(hz);
  if(typeof stopJourney==='function')stopJourney();
  if(typeof frRetune==='function')frRetune();
  if(!kayitli&&typeof saveSettings==='function')saveSettings();
}
function knobKur(){
  const k=document.getElementById('carKnob'); if(!k)return;
  knobTirtilCiz();
  knobCiz(FR.c||180);
  let suruklu=false, aktifPointer=null, baslangicY=0, baslangicX=0, baslangicOran=0;
  const bas=(e)=>{
    if(e.isPrimary===false||e.pointerType==='mouse'&&e.button!==0)return;
    suruklu=true;aktifPointer=e.pointerId;
    baslangicY=e.clientY;baslangicX=e.clientX;
    try{k.setPointerCapture(e.pointerId)}catch(_){}
    baslangicOran=knobHzOran(FR.c||180);
    e.preventDefault();
  };
  const hareket=(e)=>{
    if(!suruklu||e.pointerId!==aktifPointer)return;
    const y=e.clientY;
    /* yukarı sürükle = artır; 220 px tam yolu kat eder */
    /* 220 px tam yolu kat ediyordu — küçük bir kaydırma bile frekansı
       uçuruyordu. 520 px'e çıkarıldı: parmak hareketi daha hassas.
       Yatay hareket de dikkate alınır (sağa = artır), böylece hangi yöne
       çevrileceği belirsizliği kalkar. */
    const dx=e.clientX-baslangicX;
    const oran=baslangicOran+(((baslangicY-y)+dx)/520);
    knobUygula(knobOranHz(oran));
    e.preventDefault();
  };
  const bitir=e=>{if(!suruklu||e.pointerId!==aktifPointer)return;suruklu=false;aktifPointer=null;try{k.releasePointerCapture(e.pointerId)}catch(_){}if(typeof saveSettings==='function')saveSettings()};
  k.style.touchAction='none';
  k.addEventListener('pointerdown',bas);
  k.addEventListener('pointermove',hareket,{passive:false});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>k.addEventListener(ev,bitir));
  /* tekerlek */
  k.addEventListener('wheel',e=>{
    e.preventDefault();
    knobUygula(knobOranHz(knobHzOran(FR.c||180)+(e.deltaY>0?-.012:.012)));
  },{passive:false});
  /* klavye */
  k.addEventListener('keydown',e=>{
    const adim=e.shiftKey?.05:.008;
    if(e.key==='ArrowUp'||e.key==='ArrowRight'){ knobUygula(knobOranHz(knobHzOran(FR.c||180)+adim)); e.preventDefault(); }
    else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){ knobUygula(knobOranHz(knobHzOran(FR.c||180)-adim)); e.preventDefault(); }
  });
  /* -/+ düğmeleri: basılı tutunca hızlanan artış */
  const adimla=(yon)=>{
    const hz=FR.c||180;
    /* oransal adım: alçak frekansta ince, yüksekte kaba */
    const carpan=hz<100?1.01:hz<1000?1.02:1.03;
    knobUygula(yon>0?hz*carpan:hz/carpan);
  };
  [['carInc',1],['carDec',-1]].forEach(([id,yon])=>{
    const b=document.getElementById(id); if(!b)return;
    let tk=null, hiz=260;
    const basla=(e)=>{
      e.preventDefault(); adimla(yon); hiz=260;
      const tekrar=()=>{ adimla(yon); hiz=Math.max(45,hiz*.82); tk=setTimeout(tekrar,hiz); };
      tk=setTimeout(tekrar,420);
      if(typeof vib==='function')vib(6);
    };
    const dur=()=>{ if(tk){clearTimeout(tk);tk=null; if(typeof saveSettings==='function')saveSettings();} };
    b.addEventListener('mousedown',basla);
    b.addEventListener('touchstart',basla,{passive:false});
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev=>b.addEventListener(ev,dur));
  });
}
$('#carSld').addEventListener('input',e=>{stopJourney();FR.c=+e.target.value;frRetune();knobCiz(FR.c);syncFreqUI();saveSettings();});
function numApply(el,lo,hi,set){const v=parseFloat(el.value);if(!isFinite(v))return syncFreqUI();stopJourney();set(clamp(v,lo,hi));frRetune();syncFreqUI();saveSettings();}
$('#carNum').addEventListener('change',e=>numApply(e.target,20,18000,v=>FR.c=v));
$('#beatNum').addEventListener('change',e=>numApply(e.target,0.5,40,v=>FR.b=v));
$('#carNum').addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();}});
$('#beatNum').addEventListener('keydown',e=>{if(e.key==='Enter'){e.target.blur();}});
$('#beatSld').addEventListener('input',e=>{stopJourney();FR.b=+e.target.value;frRetune();syncFreqUI();saveSettings();});
$('#frVol').addEventListener('input',e=>{
  FR.vol=+e.target.value; setFill(e.target);
  if(FR.playing)FR.out.gain.setTargetAtTime(FR.vol*.35,ctx.currentTime,.15);
  pinkGain();
  if(FR2.E)FR2.out.gain.setTargetAtTime(FR.vol*.22,ctx.currentTime,.15);
  $('#frVolVal').textContent='%'+Math.round(FR.vol*100);
  saveSettings();
});
$('#modeSeg').addEventListener('click',e=>{
  const b=e.target.closest('[data-m]'); if(!b)return;
  $$('#modeSeg button').forEach(x=>x.classList.toggle('act',x===b));
  FR.mode=b.dataset.m;
  if(FR.playing){
    FR.E.kill(.25,FR.out); FR.playing=false;
    setTimeout(frStart,320);
  }
  saveSettings();
});
$('#frToggle').onclick=()=>{FR.playing?frStop():frStart();};

/* ── Ana ses / durdur / uyku zamanlayıcısı ── */
$('#masterVol').addEventListener('input',e=>{
  setFill(e.target);
  if(master)master.gain.setTargetAtTime(+e.target.value,ctx.currentTime,.1);
  /* r111: ana ses ayrıca TTS'i de kapsar — konuşma Web Audio'dan
     geçmediği için burada ayrıca haber verilmeli. */
  try{ ttsSesTazele(); }catch(err){}
  try{ if(typeof miniDenetimSync==='function')miniDenetimSync(); }catch(err){}
  saveSettings();
});
/* ═══ r559 — DURDURMA İZİ ══════════════════════════════════════════════
   Cihaz raporu seyrin iki okumadan sonra durduğunu ve sebebin bir
   stopAll çağrısı olduğunu gösterdi (aggregate.reason = stopAll). Ama
   çağrıyı KİMİN yaptığı görünmüyor: kilit ekranı durdurma eylemi, uyku
   zamanlayıcısı, Tekke geçişi ve ses odağı kaybı hepsi aynı yola çıkıyor.

   Körlemesine kısıtlamak yanlış olurdu — hardStopAll meşru bir «her şeyi
   durdur» sözleşmesi. Onun yerine çağrının kaynağı tanılama kaydına
   yazılıyor. Bu bir davranış değişikliği değil, yalnız iz bırakma;
   sesi ya da akışı etkilemiyor. Bir sonraki raporda hangi yolun
   tetiklediği açıkça görünecek. */
function sukunDurdurmaIzi(nereden){
  try{
    /* r562: ilk iz yalnız üç kare alıyordu ve üçü de hardStopAll'ın kendi
       çerçevesine düşüyordu; asıl çağıran görünmüyordu. Artık kendi iz
       işlevimiz ile hardStopAll'a ait kareler ELENİYOR, geriye ilk gerçek
       çağıran kalıyor. Dosya yolu da kırpılıyor; satırlar taşmasın diye
       yalnız işlev adı ve satır numarası bırakılıyor. */
    const ham=((new Error()).stack||'').split('\n').slice(1);
    const temiz=[];
    for(const k of ham){
      const t=k.trim();
      if(!t)continue;
      if(/sukunDurdurmaIzi|hardStopAll|ErrorEvent|dispatchEvent/.test(t))continue;
      /* «at ad (url:sat:sut)» → «ad :sat» */
      const mm=t.match(/at\s+([^\s(]+)[^:]*:(\d+):\d+/) || t.match(/([^@\s]+)@.*:(\d+):\d+/);
      temiz.push(mm ? (mm[1]+' :'+mm[2]) : t.slice(0,44));
      if(temiz.length>=4)break;
    }
    const satir = temiz.length ? temiz.join(' ← ') : 'çağıran görünmüyor';
    const bs=window.BERHET_SEYIR;
    const seyir=bs?('seyir run='+!!bs.run+' paused='+!!bs.paused+' i='+bs.i):'seyir yok';
    const msg='[durdurma] '+(nereden||'?')+' · '+seyir+' · '+satir;
    /* r609: durdurma çağrısı HATA değildir. ErrorEvent'e yazmak Sistem
       Durumu'nu kirletiyor ve gerçek hataları görünmez kılıyordu. */
    try{
      window.dispatchEvent(new CustomEvent('sukun:trace',{
        detail:{kind:'durdurma',message:msg,source:'sukun://durdurma-izi',at:Date.now()}
      }));
      console.debug(msg);
    }catch(e2){ try{console.debug(msg)}catch(e3){} }
  }catch(e){}
}
window.sukunDurdurmaIzi=sukunDurdurmaIzi;

let _sukDurduruluyor=false;
function hardStopAll(){
  /* ═══ r563 — KESİN DURDURMA KENDİNİ BESLİYORDU ══════════════════════
     İz zinciri şunu gösterdi:
       belge tık dinleyicisi → stopAll → sağlayıcı süpürmesi
         → «mix» sağlayıcısının stop'u → hardStopAll
         → hardStopAll içeride yine durdurma tetikliyor → başa dön
     Cihaz kaydında tek bir kullanıcı eyleminden sonra yirmi beş çağrı
     birikmişti: ilki seyir çalışırken, kalan yirmi dördü zaten durmuşken.
     Her tur seyri yeniden kesiyor, sayaç ve şerit güncellenemiyordu.

     Yeniden girişe karşı kapı: durdurma sürerken gelen ikinci çağrı
     yok sayılır. Gerçek durdurma tam olarak bir kez, baştan sona
     çalışır; kullanıcıdan gelen sonraki durdurmalar normal işler
     çünkü kapı iş bitince açılır. */
  if(_sukDurduruluyor){
    try{sukunDurdurmaIzi('hardStopAll:yeniden-giriş-engellendi')}catch(e){}
    return;
  }
  _sukDurduruluyor=true;
  try{ setTimeout(()=>{_sukDurduruluyor=false;},0); }catch(e){ _sukDurduruluyor=false; }
  sukunDurdurmaIzi('hardStopAll');
  try{window.SukunZikirTransaction?.cancel?.('hard-stop')}catch(e){}
  /* r696: Z.auto false olsa bile telefon aramasından kalmış recording/TTS
     transaction'ı yaşayabilir. autoStop() bu durumda erken çıktığı için
     kesin Stop stale voice Promise'ini burada da doğrudan iptal eder. */
  try{window.SukunZikirVoiceAbortR696?.('hard-stop-r696',{stopMedia:true,cancelTts:true})}catch(e){}
  /* Elle ya da başka bir modülden gelen kesin durdurma, ana uyku sayacının
     gecikmiş fade callback'ini de iptal eder. Aksi hâlde ses sustuktan birkaç
     saniye sonra eski callback yeniden çalışıp ana gain'i değiştirebilirdi. */
  try{clearInterval(stInt);stInt=null;stEnd=0;clearTimeout(stFade);stFade=null}catch(e){}
  try{const sl=$('#sleepTimer');if(sl)sl.value='0';const tb=$('#timerBadge');if(tb)tb.textContent=''}catch(e){}
  try{ window.__mzbzStop&&window.__mzbzStop(); }catch(e){}   /* r118 */
  /* r438: Hizbü'l-Vikâye okuyucularDurdur() içinde zaten durur.
     Burada ikinci kez stop/cancel çalıştırmak TTS geçişlerinde yarış üretiyordu. */
  try{ if(typeof okuyucularDurdur!=='function')window.__hzvStop&&window.__hzvStop(); }catch(e){}
  Object.keys(AMB).forEach(chOff);
  frStop(); autoStop(); syncMixerUI();
  rxEsmaBgStop();
  /* okuyucular, konuşma sentezi ve çalan kayıtlar da sussun */
  try{ okuyucularDurdur(); }catch(e){}
  try{ if(typeof mzbzSpkStop==='function')mzbzSpkStop(); }catch(e){}
  /* ⚠ r127: «Durdurma bütün olmalı» — hatim ve Letâif seyri burada
     duraklatılmıyordu. Ses susuyor ama HATIM.active/LTF.active true
     kalıyordu: düğme kırmızı nabız atmaya, şerit «aktif» demeye devam
     ediyordu. İlerleme hatSave/ltfSave ile korunur, «▶ Devam» ile
     kaldığı yerden sürer — kayıp yok, yalnız durum dürüstleşir. */
  try{ if(typeof HATIM!=='undefined'&&HATIM.active)hatPause(); }catch(e){}
  try{ if(typeof LTF!=='undefined'&&LTF.active)ltfPause(); }catch(e){}
  /* r171: Sonradan eklenen bağımsız modüller de aynı "Tümünü durdur"
     sözleşmesine uyar. Tembel modüller gereksiz yere kurulmaz; yalnız
     gerçekten etkin olan sağlayıcı durdurulur ve ilerlemesi korunur. */
  try{
    const bs=window.BERHET_SEYIR;
    if(bs&&typeof bs.stopAll==='function'&&(bs.run||bs.paused))bs.stopAll('all-stop');
  }catch(e){}
  try{
    const aktif=window.Tekke&&((Tekke.isActive&&Tekke.isActive())||(Tekke.isRunning&&Tekke.isRunning()));
    if(aktif&&Tekke.stop)Tekke.stop('all-stop');
  }catch(e){}
  try{
    const aktif=window.Neuro&&((Neuro.isActive&&Neuro.isActive())||(Neuro.isPlaying&&Neuro.isPlaying()));
    if(aktif&&Neuro.stop)Neuro.stop(true);
  }catch(e){}
  /* Uyku fade'i kesildiyse ana ses seviyesi sıfıra doğru yürümeye devam etmesin. */
  try{if(ctx&&master){master.gain.cancelScheduledValues(ctx.currentTime);master.gain.setTargetAtTime(+$('#masterVol').value,ctx.currentTime,.08)}}catch(e){}
  /* r172: Sessiz MediaSession köprüsü de gerçek bir oynatıcıdır. Bunu açık
     bırakmak kilit ekranındaki kartı ve kulaklık medya odağını canlı tutar;
     kullanıcı sesi uygulamadan durdursa bile telefon "çalıyor" sanır. */
  try{window.SesCapa&&SesCapa.stop()}catch(e){}
  /* r432: Global Queue ve Akıllı Seans hardStopAll dışında kalmıştı.
     Bu nedenle sesler sustuğu halde paused provider canlı kalıyor ve tek dock
     ekranda takılı kalıyordu. Kesin durdurma artık bu iki state'i de sıfırlar. */
  try{
    const gq=window.GlobalQueue;
    const gs=gq?.state;
    if(gq&&gs&&(gs.playing||gs.paused||gs.restored))gq.stop(true);
  }catch(e){}
  try{
    const sp=window.R170?.Player;
    if(sp&&(sp.playing||sp.paused||sp._r422PlayPending))sp.stop?.();
  }catch(e){}
  try{window.SukunNowPlayingStore?.clearOverride?.()}catch(e){}
  try{window.SukunNowPlayingStore?.refresh?.()}catch(e){}
  /* Duraklatılmış durumdan kesin durdurmaya geçildiyse mini çubuk eski
     "Duraklatıldı" etiketini taşımamalı; burada TTS'i sürdürmeden yalnız
     taşıma durumunu sıfırlarız. */
  try{
    if(typeof MINI==='object'&&MINI){MINI.paused=false;MINI.wasAuto=false;}
    const bar=document.getElementById('miniBar');if(bar)bar.classList.remove('paused');
    const p=document.getElementById('mbPause');if(p)p.textContent='⏸';
    const pu=document.getElementById('mbPulse');if(pu)pu.textContent='〰';
  }catch(e){}
}
$('#stopAll').onclick=hardStopAll;

let stInt=null, stEnd=0, stFade=null;
$('#sleepTimer').addEventListener('change',e=>{
  if(typeof dockLblGuncelle==='function')dockLblGuncelle();
  clearInterval(stInt); stInt=null; $('#timerBadge').textContent='';
  const m=+e.target.value; if(!m)return;
  stEnd=Date.now()+m*60000;
  stInt=setInterval(()=>{
    const s=Math.max(0,Math.round((stEnd-Date.now())/1000));
    $('#timerBadge').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
    if(s<=0){
      clearInterval(stInt); stInt=null;
      $('#timerBadge').textContent=''; e.target.value='0';
      fadeOutAll();
    }
  },1000);
});
function fadeOutAll(){
  if(ctx)master.gain.setTargetAtTime(.0001,ctx.currentTime,4);
  clearTimeout(stFade);
  stFade=setTimeout(()=>{
    stFade=null;
    hardStopAll();
    if(ctx)master.gain.setTargetAtTime(+$('#masterVol').value,ctx.currentTime,.4);
  },13000);
}

/* ── Zikir bağları ── */
/* r139: kategori değişimi de bir geçiştir — aynı işaret */
$('#zCats').addEventListener('click',e=>{
  const b=e.target.closest('[data-c]'); if(!b)return;
  try{window.SukunZikirTransaction?.cancel?.('category-change')}catch(err){}
  Z.cat=b.dataset.c; Z.idx=0;
  if(typeof zHedefSecimeUyarla==='function')zHedefSecimeUyarla(true);
  renderCats(); renderZikir(); zUI(); saveSettings();
});
$('#zList').addEventListener('click',e=>{
  const b=e.target.closest('[data-i]'); if(!b)return;
  if(+b.dataset.i===Z.idx)return;            /* aynı zikre yeniden tıklama */
  try{window.SukunZikirTransaction?.cancel?.('zikir-change')}catch(err){}
  Z.idx=+b.dataset.i;
  if(typeof zHedefSecimeUyarla==='function')zHedefSecimeUyarla(true);
  renderZikir(); zUI(); saveSettings();
  /* r139: seçim işareti — kısa tını + çerçevede altın tozu */
  try{ ac(); }catch(err){}
  try{ secmeSesi(); }catch(err){}
  try{ tozSac(); }catch(err){}
});
$('#tapBtn').onclick=rep;
/* r160: yalnız GERÇEK TAP sayar. Dikey kaydırma / sürükleme / uzun basma sayım üretmez. */
(function(){
  const el=$('#zCountVisual'); if(!el)return;
  let pid=null,x0=0,y0=0,t0=0,moved=false;
  const MOVE=9, MAX_MS=650;
  el.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    pid=e.pointerId; x0=e.clientX; y0=e.clientY; t0=performance.now(); moved=false;
  });
  el.addEventListener('pointermove',e=>{
    if(pid!==e.pointerId)return;
    if(Math.hypot(e.clientX-x0,e.clientY-y0)>MOVE)moved=true;
  });
  el.addEventListener('pointercancel',e=>{ if(pid===e.pointerId){pid=null;moved=true;} });
  el.addEventListener('pointerup',e=>{
    if(pid!==e.pointerId)return;
    const ok=!moved && Math.hypot(e.clientX-x0,e.clientY-y0)<=MOVE && (performance.now()-t0)<=MAX_MS;
    pid=null;
    if(ok)rep();
  });
  el.addEventListener('click',e=>e.preventDefault());
  el.addEventListener('keydown',e=>{
    if(e.key===' '||e.key==='Enter'){ e.preventDefault(); rep(); }
  });
})();
document.addEventListener('click',e=>{
  const t=e.target.closest('#rxEsmaBgTgl'); if(!t)return;
  RX_ESMA_BG=!RX_ESMA_BG; S.set('sukun.rxesmabg',RX_ESMA_BG);
  t.classList.toggle('on',RX_ESMA_BG);
  if(RX_ESMA_BG && typeof RX_LAST!=='undefined' && RX_LAST) rxEsmaBgStart(RX_LAST.rx.esma);
  else rxEsmaBgStop();
});
document.addEventListener('input',e=>{
  const r=e.target.closest('#rxEsmaInt'); if(!r)return;
  RX_ESMA_INTERVAL=+r.value; S.set('sukun.rxesmaint',RX_ESMA_INTERVAL);
  const lbl=document.getElementById('rxEsmaIntV'); if(lbl)lbl.textContent=RX_ESMA_INTERVAL+'sn';
  rxEsmaBgRetune();
});
/* ── Favori aç/kapa ── */
$('#favBtn').onclick=()=>{
  const it=zItem(); if(!it)return;
  const eklendi=FAV.cevir(zKat(),it);
  /* Favoriden çıkarılan öğe o an favori listesindeyse liste kayar;
     renderCats zaten Z.idx'i sınırlar. */
  renderCats(); renderZikir(false); favUI();
  if(typeof toast==='function')
    toast(eklendi?'★ Favorilere eklendi':'Favorilerden çıkarıldı');
  if(typeof sfx==='function')sfx(eklendi?'page':'tick');   /* sfx paleti: open·tick·page·close·done */
};
$('#autoBtn').onclick=()=>{
  const now=Date.now();
  // A rapid Stop/Pause must never be discarded by the start debounce.
  const live=Z.auto||window.SukunR698Transport?.hasJourney?.()||window.SukunAudioSessionRegistry?.aggregateSnapshot?.()?.paused;
  if(!live&&now-_r477AutoTapAt<620)return;
  _r477AutoTapAt=now;
  const t=window.SukunR698Transport;
  if(t)t.playPause('main');else Z.auto?autoStop():autoStart();
};
$('#plusBtn').onclick=()=>{ if(Z.auto)return; rep(); };
$('#undoBtn').onclick=()=>{
  if(Z.auto)autoStop();
  try{window.SukunZikirTransaction?.cancel?.('r695-undo')}catch(e){}
  const curCat=zKat(),curIdx=zIdx(),hedef=Math.max(0,Number(Z.target)||0),last=window.SukunZikirTransaction?.snapshot?.()?.last||null;
  let undoCat=curCat,undoIdx=curIdx,changed=false,revertedSection=false;
  if(Z.count>0){
    Z.count--;Z.total=Math.max(0,Z.total-1);changed=true;
  }else{
    /* Auto-advance sınırından hemen sonra Undo, SONRAKİ Esmâ'yı target-1'e
       çekmemeli. Transaction'ın kaynak indeksine geri dönüp son gerçek turu
       geri alır. */
    const items=ZIKIR?.[curCat]?.items||[],expected=items.length&&last?.cat===curCat?((+last.idx+1)%items.length):-1;
    const recent=!!(last?.committedAt&&Date.now()-last.committedAt<15*60*1000);
    if(last?.phase==='committed'&&last?.adv&&recent&&expected===curIdx&&Z.devir>0){
      undoCat=last.cat;undoIdx=+last.idx||0;Z.idx=undoIdx;Z.target=Math.max(0,+last.target||0);Z.devir--;Z.count=Math.max(0,Z.target-1);Z.total=Math.max(0,Z.total-1);changed=true;revertedSection=true;
    }else if(hedef>0&&Z.devir>0){
      Z.devir--;Z.count=Math.max(0,hedef-1);Z.total=Math.max(0,Z.total-1);changed=true;
    }
  }
  if(changed){
    try{window.SukunUsageStatsRollbackR695?.(1,undoCat,undoIdx,'undo')}catch(e){}
    try{S.set('sukun.total',Z.total)}catch(e){}
    if(revertedSection){try{renderCats();renderZikir(false);window.SukunSectionIdentityCommit?.commit?.('direct-zikir',Z.idx,'r695-undo')}catch(e){}}
  }
  zUI();
};
$('#resetBtn').onclick=()=>{
  if(window.SukunZikirRestart?.restart)window.SukunZikirRestart.restart({source:'main'});
  else{Z.count=0;Z.devir=0;zUI();}
};
/* ۞ Köprü: seçili zikri Dijital Tekke'ye taşı */
$('#tekkeBtn').onclick=()=>{
  const bridge=window.SukunTekkeContext,ctx=bridge?.payload?.();
  if(bridge){
    if(!ctx){try{bridge.change?.()}catch(e){};try{toast('Önce bir zikir seç')}catch(e){};return;}
    S.set('sukun.total',Z.total);hardStopAll();Tekke.open(ctx);return;
  }
  const it=zItem(); let tr,ar,mean;
  if(zKat()==='esma'){const f=esmaForms(it);tr=f.tr;ar=f.ar;mean=f.mean;}
  else{tr=it.tr;ar=it.ar;mean=it.mean;}
  S.set('sukun.total',Z.total); hardStopAll();
  Tekke.open({tr,ar,mean,target:Z.target>0?Z.target:33});
};
$('#tekkeTab').onclick=()=>{const ctx=window.SukunTekkeContext?.payload?.();S.set('sukun.total',Z.total);hardStopAll();Tekke.open(ctx||undefined);};
$('#neuroBtn').onclick=()=>{S.set('sukun.total',Z.total);hardStopAll();Neuro.open();};
window.addEventListener('tekke:closed',()=>{Z.total=Math.max(Z.total,S.get('sukun.total',Z.total));zUI();});
$('#tempoSld').addEventListener('input',e=>{
  Z.tempo=+e.target.value; setFill(e.target);
  $('#tempoVal').textContent=Z.tempo.toFixed(1)+' sn';
  if(Z.auto){_zAutoSon=Date.now();zAutoKur(true);}
  saveSettings();
});
$('#targetSel').addEventListener('change',e=>{
  Z.target=+e.target.value;
  const txt=(e.target.selectedOptions&&e.target.selectedOptions[0]?e.target.selectedOptions[0].textContent:'')||'';
  Z.targetMode=/^Ebced/.test(txt)?'ebced':(/^Elle/.test(txt)?'manual':'fixed');
  Z.count=0; Z.devir=0; zUI(); saveSettings();
});
[['optTick','tick'],['optVib','vib'],['optMean','mean'],['optAdv','adv']].forEach(([id,key])=>{
  $('#'+id).onclick=()=>{
    Z[key]=!Z[key];
    $('#'+id).classList.toggle('on',Z[key]);
    if(key==='mean')renderZikir(false);
    saveSettings();
  };
});
/* Boşluk tuşu ile sayım (zikir sekmesi açıkken) */
document.addEventListener('keydown',e=>{
  const _tk=document.getElementById('tk'),_ns=document.getElementById('ns');
  if((_tk&&!_tk.hidden)||(_ns&&!_ns.hidden))return;
  if(e.code==='Space'&&!$('#tab-zkr').hidden&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)){
    e.preventDefault(); rep();
  }
});
window.addEventListener('pagehide',()=>{
  S.set('sukun.total',Z.total);
  try{hatSave(); ltfSave();}catch(e){}
});

/* ── Ayar kalıcılığı ── */
function saveSettings(){
  S.set('sukun.set',{
    mv:+$('#masterVol').value,
    fr:{c:FR.c,b:FR.b,vol:FR.vol,mode:FR.mode,pink:FR.pink},
    x2:{on:FR2.on,c:FR2.c,b:FR2.b},
    opt2:{bendir:BENDIR,aveInt:AVE.int,vhVol:VH.vol,vhL:VH.layers,spkOn:SPK.on,spkRate:SPK.rate,arOn:SPK.arOn,arPitch:SPK.arPitch,arRate:SPK.arRate},
    z:{target:Z.target,targetMode:Z.targetMode,tempo:Z.tempo,tick:Z.tick,vib:Z.vib,mean:Z.mean,adv:Z.adv,form:Z.form}
  });
}
function loadSettings(){
  const s=S.get('sukun.set',null); if(!s)return;
  if(typeof s!=='object'||Array.isArray(s))return;
  const say=(v,vars,a,b)=>{const n=Number(v);return Number.isFinite(n)?clamp(n,a,b):vars;};
  if(s.mv!=null)$('#masterVol').value=say(s.mv,.7,0,1);
  if(s.fr&&typeof s.fr==='object'&&!Array.isArray(s.fr)){
    FR.b=say(s.fr.b,FR.b,.5,40);
    FR.c=frSafeCarrier(say(s.fr.c,FR.c,20,18000),FR.b);
    FR.vol=say(s.fr.vol,FR.vol,0,1);
    FR.mode=/^(bin|iso|mix|mono)$/.test(String(s.fr.mode||''))?String(s.fr.mode):FR.mode;
    $('#frVol').value=FR.vol;
    $$('#modeSeg button').forEach(x=>x.classList.toggle('act',x.dataset.m===FR.mode));
    FR.pink=!!s.fr.pink;
    $('#pinkTgl').classList.toggle('on',FR.pink);
  }
  if(s.x2&&typeof s.x2==='object'&&!Array.isArray(s.x2)){
    FR2.on=!!s.x2.on; FR2.b=say(s.x2.b,FR2.b,.5,40);
    FR2.c=frSafeCarrier(say(s.x2.c,FR2.c,20,18000),FR2.b);
    $('#fr2Tgl').classList.toggle('on',FR2.on);
    $('#fr2Car').value=FR2.c; $('#fr2Beat').value=FR2.b;
    $('#fr2CarV').textContent=FR2.c.toFixed(1)+' Hz';
    $('#fr2BeatV').textContent=FR2.b.toFixed(2)+' Hz';
  }
  if(s.opt2&&typeof s.opt2==='object'&&!Array.isArray(s.opt2)){
    BENDIR=!!s.opt2.bendir; $('#optBendir').classList.toggle('on',BENDIR);
    AVE.int=say(s.opt2.aveInt,AVE.int,.05,.5);
    $('#aveInt').value=AVE.int; $('#aveIntV').textContent='%'+Math.round(AVE.int*100);
    VH.vol=say(s.opt2.vhVol,VH.vol,0,1);
    VH.layers=[3,5,7].includes(+s.opt2.vhL)?+s.opt2.vhL:VH.layers;
    $('#vhVol').value=VH.vol; $('#vhLayers').value=String(VH.layers);
    SPK.on=!!s.opt2.spkOn; SPK.rate=say(s.opt2.spkRate,SPK.rate,.5,2); SPK.arOn=s.opt2.arOn!==false;
    SPK.arPitch=say(s.opt2.arPitch,SPK.arPitch,.5,2); SPK.arRate=say(s.opt2.arRate,SPK.arRate,.5,2);
  }
  if(s.z&&typeof s.z==='object'&&!Array.isArray(s.z)){
    Z.target=Math.round(say(s.z.target,Z.target,0,99999));
    Z.targetMode=/^(fixed|manual|ebced)$/.test(String(s.z.targetMode||''))?String(s.z.targetMode):Z.targetMode;
    Z.tempo=say(s.z.tempo,Z.tempo,.8,6);
    ['tick','vib','mean','adv'].forEach(k=>{if(k in s.z)Z[k]=!!s.z[k];});
    if(/^(nida|tev)$/.test(String(s.z.form||'')))Z.form=String(s.z.form);
  }
}

/* ════════════════════════════════════════════════════════════
   6b) v1.1 — ESMÂ FORMLARI • EBCED • BANT ARAYÜZLERİ
   ════════════════════════════════════════════════════════════ */
Z.form='nida';
const EB_MAP={'ا':1,'أ':1,'إ':1,'آ':1,'ء':1,'ب':2,'ج':3,'د':4,'ه':5,'ة':5,'و':6,'ؤ':6,'ز':7,'ح':8,'ط':9,'ي':10,'ى':10,'ئ':10,'ی':10,'ك':20,'ک':20,'ل':30,'م':40,'ن':50,'س':60,'ع':70,'ف':80,'ص':90,'ق':100,'ر':200,'ش':300,'ت':400,'ث':500,'خ':600,'ذ':700,'ض':800,'ظ':900,'غ':1000};
const stripHarake=a=>String(a||'').replace(/[\u064B-\u065F\u0670\u0640\s]/g,'');
function ebced(a){let s=0;for(const ch of stripHarake(a))s+=EB_MAP[ch]||0;return s;}
/* r153 — TEK ebced kaynağı.
   Berhetiyye matrisinde kaynakla birlikte saklanan `eb` varsa onu korur;
   normal Esmâ ve diğer Arapça kayıtlar için yazımdan otomatik hesaplar.
   `adet` ebced DEĞİLDİR: klasik/önerilen tekrar sayısı ayrı bilgidir. */
function zEbcedDegeri(it){
  if(!it)return 0;
  const kaynak=Number(it.eb);
  if(Number.isFinite(kaynak)&&kaynak>0)return Math.round(kaynak);
  return ebced(it.a||it.ar||'');
}
const EMPH='حخصضطظعغقر';
/* Her esmâ için nidâ («Yâ …») ve tevhid («Lâ … illâllah») kalıbını üretir */
function esmaForms(it){
  const eb=zEbcedDegeri(it), bare=stripHarake(it.a), last=bare[bare.length-1];
  if(Z.form==='tev'&&!it.nt){
    const tt=/î$/.test(it.t)?it.t.slice(0,-1)+'iye':it.t+(EMPH.includes(last)?'a':'e');
    return {ar:'لَا '+it.a+'َ إِلَّا اللّٰهُ', tr:'Lâ '+tt+' illâllah',
            mean:'Gerçek '+it.t+' ancak Allah’tır', eb};
  }
  const mean=(Z.form==='tev'&&it.nt)?it.m+' • bu isme tevhid kalıbı uygulanmaz':it.m;
  return {ar:it.aya||('يَا '+it.a+(last==='ي'?'':'ُ')), tr:it.ya||('Yâ '+it.t), mean, eb};
}
function syncFormSeg(){$$('#formSeg button').forEach(x=>x.classList.toggle('act',x.dataset.f===Z.form));}
$('#formSeg').addEventListener('click',e=>{
  const b=e.target.closest('[data-f]'); if(!b)return;
  Z.form=b.dataset.f; syncFormSeg(); renderZikir(); saveSettings();
});
$('#zSearch').addEventListener('input',renderList);
/* Ebced hedefi — r153:
   `targetMode:'ebced'` seçildiğinde isim değişse bile hedef o ismin gerçek
   ebcedine yeniden bağlanır. Böylece otomatik sayaç ile elle dokunarak sayım
   aynı Z.target değerini kullanır. */
function ensureTargetOpt(v,label){
  const sel=$('#targetSel');
  let o=[...sel.options].find(x=>x.dataset.dynamic==='1');
  if(!o){
    o=document.createElement('option'); o.dataset.dynamic='1';
    sel.insertBefore(o,sel.querySelector('option[value="0"]'));
  }
  o.value=String(v);
  o.textContent=label||String(v);
  sel.value=String(v);
}
function zEbcedHedefUygula(resetCount){
  const v=zEbcedDegeri(zItem());
  if(!v)return false;
  Z.target=v; Z.targetMode='ebced';
  if(resetCount){ Z.count=0; Z.devir=0; }
  ensureTargetOpt(v,'Ebced • '+v);
  return true;
}
/* ═══ r564 — TEMPO İSİM DEĞİŞİNCE 1.0'A DÖNER ══════════════════════════
   İsim değiştiğinde tempo bir önceki isimden devralınıyordu; kendi ses
   kaydı uzun olan bir isimden sonra beş altı saniyelik çevrim kalıyor ve
   yeni isim o ağır tempoyla başlıyordu. Kullanıcı her zikre bir saniyelik
   tempoyla başlamak istiyor.

   Tempo artık isim değişiminde varsayılana dönüyor. Kaydırıcıyı elle
   oynatırsan o isim için geçerli olur; sonraki isme geçince yine bire
   döner. Otomatik sayım açıksa zamanlayıcı yeni tempoyla kuruluyor. */
const Z_TEMPO_VARSAYILAN=1.0;
function zTempoVarsayilanaDon(){
  try{
    if(Math.abs((+Z.tempo||0)-Z_TEMPO_VARSAYILAN)<0.01)return;
    Z.tempo=Z_TEMPO_VARSAYILAN;
    try{ S.set('sukun.tempo',Z.tempo); }catch(e){}
    const sld=document.getElementById('tempoSld');
    if(sld){ sld.value=String(Z.tempo); try{setFill(sld)}catch(e){} }
    const val=document.getElementById('tempoVal');
    if(val)val.textContent=Z.tempo.toFixed(1)+' sn';
    document.querySelectorAll('[data-r434-tempo]').forEach(el=>{
      try{ el.value=String(Z.tempo); }catch(e){}
    });
    const cs=document.getElementById('csTempo');
    if(cs){ try{cs.value=String(Z.tempo)}catch(e){} }
    const csv=document.getElementById('csTempoV');
    if(csv)csv.textContent=Z.tempo.toFixed(1)+' sn';
    if(Z.auto){ try{ _zAutoSon=Date.now(); zAutoKur(true); }catch(e){} }
  }catch(e){}
}
window.zTempoVarsayilanaDon=zTempoVarsayilanaDon;

function zHedefSecimeUyarla(resetCount){
  /* r564: isim değişimi bu yoldan geçiyor; tempo burada sıfırlanıyor. */
  zTempoVarsayilanaDon();
  if(Z.targetMode==='ebced')return zEbcedHedefUygula(!!resetCount);
  return false;
}
function targetPremiumSync(){
  const eb=zEbcedDegeri(zItem());
  const out=document.getElementById('ebcedDisplay'); if(out)out.textContent=eb||'—';
  const inp=document.getElementById('freeTargetInput');
  if(inp&&document.activeElement!==inp&&Z.targetMode==='manual'&&Z.target>0)inp.value=String(Z.target);
  const ebB=document.getElementById('ebBtn'), frB=document.getElementById('freeBtn');
  if(ebB)ebB.classList.toggle('act',Z.targetMode==='ebced');
  if(frB)frB.classList.toggle('act',Z.targetMode==='manual');
  const ht=document.getElementById('targetHintText');
  if(ht)ht.textContent=Z.targetMode==='ebced'
    ? 'Ebced modu aktif — isim değişince hedef yeni ismin ebcedine otomatik uyarlanır.'
    : Z.targetMode==='manual'
      ? 'Serbest hedef aktif — belirlediğin sayı isim değişse bile sabit kalır.'
      : '33 / 99 gibi klasik sabit hedefler de kayıtlı ayarlardan kullanılmaya devam eder.';
}
function serbestHedefUygula(v){
  const n=Math.round(Number(v));
  if(!Number.isFinite(n)||n<1||n>99999){ alert('Geçerli bir hedef gir (1 – 99999).'); return false; }
  Z.target=n; Z.targetMode='manual'; Z.count=0; Z.devir=0;
  ensureTargetOpt(n,'Serbest • '+n); zUI(); saveSettings(); return true;
}
$('#ebBtn').onclick=()=>{
  if(!zEbcedHedefUygula(true))return;
  zUI(); saveSettings();
};
const _ebCalc=document.getElementById('ebCalcBtn'); if(_ebCalc)_ebCalc.onclick=()=>{
  if(!zEbcedHedefUygula(true))return; zUI(); saveSettings();
};
const _freeBtn=document.getElementById('freeBtn'); if(_freeBtn)_freeBtn.onclick=()=>{
  const i=document.getElementById('freeTargetInput'); if(i){i.focus();i.select();}
};
const _freeApply=document.getElementById('freeApplyBtn'); if(_freeApply)_freeApply.onclick=()=>{
  const i=document.getElementById('freeTargetInput'); serbestHedefUygula(i&&i.value);
};
const _freeInput=document.getElementById('freeTargetInput'); if(_freeInput)_freeInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();serbestHedefUygula(e.currentTarget.value);}
});
/* Bant arayüzleri: her beyin dalgası bandının kendi vuruş çipleri */
const BANDS={
 delta:{def:2.5,chips:[0.5,1,1.5,2,3,3.5],tag:'DELTA 0.5–4 Hz'},
 theta:{def:6,chips:[4,4.5,5,6,7,7.83],tag:'THETA 4–8 Hz'},
 alpha:{def:10,chips:[8,9,10,11,12],tag:'ALFA 8–13 Hz'},
 beta:{def:18,chips:[13,15,18,22,27],tag:'BETA 13–30 Hz'},
 gamma:{def:40,chips:[30,33,36,40],tag:'GAMA 30–40 Hz'}
};
const SOLFEJ=[136.1,174,285,396,417,432,528,639,741,852,963];
let lastBand='';
function renderBeatChips(){
  const key=bandOf(FR.b)[0];
  if(key!==lastBand){
    lastBand=key;
    $('#beatChips').innerHTML=BANDS[key].chips.map(v=>'<span data-v="'+v+'">'+v+'</span>').join('');
    $('#beatBandTag').textContent=BANDS[key].tag;
  }
  $$('#beatChips span').forEach(s=>s.classList.toggle('act',Math.abs(+s.dataset.v-FR.b)<.01));
  $$('#carChips span').forEach(s=>s.classList.toggle('act',Math.abs(+s.dataset.v-FR.c)<.05));
}
$('#carChips').innerHTML=SOLFEJ.map(v=>'<span data-v="'+v+'">'+v+'</span>').join('');
$('#bandChips').addEventListener('click',e=>{
  const s=e.target.closest('[data-b]'); if(!s)return;
  stopJourney(); FR.b=BANDS[s.dataset.b].def; frRetune(.3); syncFreqUI(); saveSettings();
});
$('#beatChips').addEventListener('click',e=>{
  const s=e.target.closest('[data-v]'); if(!s)return;
  stopJourney(); FR.b=+s.dataset.v; frRetune(.3); syncFreqUI(); saveSettings();
});
$('#carChips').addEventListener('click',e=>{
  const s=e.target.closest('[data-v]'); if(!s)return;
  stopJourney(); FR.c=+s.dataset.v; frRetune(.3); syncFreqUI(); saveSettings();
});

/* ════════════════════════════════════════════════════════════
   6c) v1.2 — PEMBE YASTIK • YOLCULUK EDİTÖRÜ • GÜNLÜK • AKTAR
   ════════════════════════════════════════════════════════════ */
let PINKE=null;
function pinkOn(){
  if(PINKE||!FR.pink)return; ac();
  const E=makeEnv(), out=E.n(g(0)); out.connect(master);
  const n=E.play(src('pink')), lp=E.n(flt('lowpass',3200));
  n.connect(lp); lp.connect(out);
  out.gain.setTargetAtTime(FR.vol*.12,ctx.currentTime,1.2);
  PINKE={E,out};
}
function pinkOff(){ if(!PINKE)return; PINKE.E.kill(.8,PINKE.out); PINKE=null; }
function pinkGain(){ if(PINKE)PINKE.out.gain.setTargetAtTime(FR.vol*.12,ctx.currentTime,.2); }
$('#pinkTgl').onclick=()=>{
  FR.pink=!FR.pink;
  $('#pinkTgl').classList.toggle('on',FR.pink);
  if(FR.pink&&FR.playing)pinkOn(); else pinkOff();
  saveSettings();
};

const JBANDS=[['delta','Delta 0.5–4',2.5],['theta','Theta 4–8',6],['alpha','Alfa 8–13',10],['beta','Beta 13–30',18],['gamma','Gama 30–40',40]];
let JED=S.get('sukun.journey',[{k:'theta',min:5},{k:'delta',min:8},{k:'gamma',min:1}]);
function jRender(){
  $('#jRows').innerHTML=JED.map((s,i)=>
   '<div class="jRow" data-i="'+i+'"><select>'+JBANDS.map(b=>'<option value="'+b[0]+'"'+(b[0]===s.k?' selected':'')+'>'+b[1]+' Hz</option>').join('')+
   '</select><input type="number" min="1" max="45" value="'+s.min+'"><span>dk</span><button class="x" title="Aşamayı sil"><span class="ico" data-ico="close"></span> </button></div>').join('');
}
$('#jAdd').onclick=()=>{if(JED.length<8){JED.push({k:'theta',min:5});jRender();S.set('sukun.journey',JED);}};
$('#jRows').addEventListener('input',e=>{
  const r=e.target.closest('.jRow'); if(!r)return;
  const i=+r.dataset.i;
  JED[i].k=r.querySelector('select').value;
  JED[i].min=clamp(+r.querySelector('input').value||1,1,45);
  S.set('sukun.journey',JED);
});
$('#jRows').addEventListener('click',e=>{
  if(!e.target.classList.contains('x'))return;
  const i=+e.target.closest('.jRow').dataset.i;
  if(JED.length>1){JED.splice(i,1);jRender();S.set('sukun.journey',JED);}
});
$('#jRun').onclick=()=>{
  startJourney(JED.map((s,i)=>{
    const b=JBANDS.find(x=>x[0]===s.k);
    return {n:'Aşama '+(i+1)+' • '+b[1].split(' ')[0], b:b[2], hold:s.min*60};
  }));
};

$('#expBtn').onclick=async()=>{
  const cfg={v:1,fr:{c:FR.c,b:FR.b,mode:FR.mode,vol:FR.vol,pink:FR.pink},
    amb:Object.fromEntries(Object.keys(AMB).map(id=>[id,chVol[id]])),
    journey:JED};
  const txt=JSON.stringify(cfg);
  try{await navigator.clipboard.writeText(txt);alert('Ayar JSON panoya kopyalandı ✦');}
  catch(e){prompt('Kopyalamak için seç:',txt);}
};
$('#impBtn').onclick=()=>{
  const txt=prompt('Ayar JSON yapıştır:'); if(!txt)return;
  try{
    if(txt.length>100000)throw new Error('Ayar dosyası çok büyük');
    const c=JSON.parse(txt);
    if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Şema geçersiz');
    if(c.fr&&typeof c.fr==='object'&&!Array.isArray(c.fr)){
      FR.b=clamp(Number.isFinite(+c.fr.b)?+c.fr.b:FR.b,.5,40);
      FR.c=frSafeCarrier(clamp(Number.isFinite(+c.fr.c)?+c.fr.c:FR.c,20,18000),FR.b);
      if(/^(bin|iso|mix|mono)$/.test(String(c.fr.mode||'')))FR.mode=String(c.fr.mode);
      FR.vol=clamp(Number.isFinite(+c.fr.vol)?+c.fr.vol:FR.vol,0,1); FR.pink=!!c.fr.pink;
      $('#frVol').value=FR.vol;
      $('#pinkTgl').classList.toggle('on',FR.pink);
      $$('#modeSeg button').forEach(x=>x.classList.toggle('act',x.dataset.m===FR.mode));
      if(FR.playing)frRetune(.3);
      syncFreqUI();
    }
    if(c.amb&&typeof c.amb==='object'&&!Array.isArray(c.amb)){
      Object.keys(AMB).forEach(chOff);
      Object.entries(c.amb).forEach(([id,v])=>{
        const d=AMBIENT_DEFS.find(x=>x.id===id);
        if(d){chVol[id]=clamp(+v||.5,0,1);chOn(d);}
      });
      syncMixerUI();
    }
    if(Array.isArray(c.journey)&&c.journey.length){
      JED=c.journey.slice(0,8).map(s=>({
        k:JBANDS.some(b=>b[0]===String(s&&s.k))?String(s.k):'theta',
        min:clamp(Number.isFinite(+(s&&s.min))?+s.min:5,1,45)
      }));
      S.set('sukun.journey',JED); jRender();
    }
    saveSettings(); alert('Ayarlar uygulandı ✦');
  }catch(e){alert('Geçersiz JSON');}
};

/* ════ İSTATİSTİK MOTORU ════
   Günlük kayıtları (sukun.log + tekke.defter) çözümleyip özet çıkarır.
   Yeni veri toplamaz — hâlihazırda yazılanları okur, böylece geçmiş
   oturumlar da istatistiğe dâhil olur. */
/* ════ NEURO ENGINE — KURAL TABANLI ════
   Yapay zekâ değil, açıkça yazılmış kurallar. Her öneri hangi gözlemden
   çıktığını söyler, böylece keyfî görünmez. Motor ASLA kendiliğinden bir
   şey değiştirmez — yalnız önerir, uygulamak kullanıcının kararıdır.
   Bu bilinçli bir sınır: bir zikir uygulamasının kullanıcının iradesini
   devralması doğru olmaz. */
const NEURO={
  acik: true,
  sonOneri: 0,
  reddedilen: [],
  /* ── gözlemler ── */
  gozlem(){
    const s2=Date.now();
    const saat=new Date().getHours();
    let gecenDk=0;
    try{ if(LOG.cur&&LOG.cur.t0)gecenDk=Math.round((s2-LOG.cur.t0)/60000); }catch(e){}
    let ses=.5;
    try{ ses=parseFloat(document.getElementById('masterVol').value)||.5; }catch(e){}
    let kanal=0;
    try{ kanal=Object.keys(AMB).filter(id=>PREVIEW.id!==id).length; }catch(e){}
    let bugunDk=0;
    try{
      const bas=new Date(); bas.setHours(0,0,0,0);
      logTemizle(S.get('sukun.log',[])).forEach(x=>{ if(x.t>=bas.getTime())bugunDk+=Math.round(x.dur/60); });
    }catch(e){}
    return {saat, gecenDk, ses, kanal, bugunDk,
            frekansCaliyor:(typeof FR!=='undefined'&&FR.playing),
            vuruslHz:(typeof FR!=='undefined')?FR.b:0};
  },
  /* ── kurallar: her biri {kosul, oneri} ── */
  KURALLAR:[
    {
      ad:'uyku',
      kosul:g=>(g.saat>=22||g.saat<5) && g.gecenDk>=35 && g.ses<=.45,
      baslik:'Uyku moduna geçilsin mi?',
      gerekce:g=>'Gece '+g.saat+':00 · '+g.gecenDk+' dakikadır dinliyorsun · sesi kısmışsın.',
      eylem:'Delta vuruş (2 Hz), pembe gürültü ve 20 dakikada sönen zamanlayıcı.',
      uygula:()=>{
        /* ═══ r575 — SEHER KURALINDAKİ AYNI KUSUR BURADA DA VARDI ═══════
           Frekansı yalnız ZATEN ÇALIYORSA yeniden kuruyordu; kapalıyken
           sadece ayarı yazıp çıkıyordu. Üstelik bütün gövde boş bir catch
           içindeydi: pembe gürültü açılmasa, zamanlayıcı kurulmasa da
           hata yutuluyor ve bildirim «Uygulandı» diyordu.

           Uyku modu üç şeyden oluşuyor: delta vuruş, pembe gürültü ve
           yirmi dakikalık sönme. Üçü de gerçekten kurulmalı. Hiçbiri
           tutmazsa hata fırlatılıyor; bildirim katmanı bunu yakalayıp
           «uygulanamadı» diyor ve Sistem Durumu'na yazıyor. */
        if(typeof FR==='undefined')throw new Error('Frekans motoru yok');
        FR.b=2; FR.mode='bin';
        try{ if(typeof ac==='function')ac(); }catch(e){}
        if(FR.playing){ try{frStop()}catch(e){} }
        frStart();
        let gurultu=false;
        try{
          const p2=AMBIENT_DEFS.find(d=>d.id==='gur_pembe');
          if(p2){ if(!AMB['gur_pembe'])chOn(p2); gurultu=!!AMB['gur_pembe']; }
        }catch(e){}
        let zaman=false;
        try{
          const sel=document.getElementById('sleepTimer');
          if(sel){ sel.value='20'; sel.dispatchEvent(new Event('change',{bubbles:true})); zaman=true; }
        }catch(e){}
        try{ if(typeof syncFreqUI==='function')syncFreqUI(); }catch(e){}
        if(!FR.playing)throw new Error('Delta vuruş başlatılamadı');
        if(!gurultu&&!zaman)throw new Error('Pembe gürültü ve zamanlayıcı kurulamadı');
      }
    },
    {
      ad:'mola',
      kosul:g=>g.gecenDk>=55,
      baslik:'Bir mola vermeyi düşün',
      gerekce:g=>g.gecenDk+' dakikadır kesintisiz dinliyorsun.',
      eylem:'Kulaklıkla uzun süre dinlemek işitmeyi yorar. Birkaç dakika sessizlik iyi gelir.',
      uygula:null      /* eylem yok — yalnız hatırlatma */
    },
    {
      ad:'seher',
      kosul:g=>g.saat>=4 && g.saat<7 && g.gecenDk>=3,
      baslik:'Seher vakti',
      gerekce:()=>'Gecenin son saatindesin.',
      eylem:'Theta vuruş (6 Hz) ve Yâ Fettâh — istiğfar ve açılış vakti.',
      uygula:()=>{
        /* ═══ r573 — «UYGULA» DİYORDU AMA FREKANS BAŞLAMIYORDU ═══════════
           Eski hâli frekansı yalnız ZATEN ÇALIYORSA yeniden kuruyordu:
           kapalıyken sadece ayarı yazıp çıkıyordu. Hata atmadığı için
           bildirim «Uygulandı» diyor, kullanıcı ise hiçbir şey duymuyordu.

           Uygula demek başlatmak demektir: frekans kapalıysa artık
           başlatılıyor, açıksa yeni değerle yeniden kuruluyor. Başlatma
           gerçekten olmazsa hata fırlatılıyor; bildirim katmanı onu
           yakalayıp «uygulanamadı» diyor ve Sistem Durumu'na yazıyor —
           böylece sessiz başarısızlık bir daha olmuyor. */
        if(typeof FR==='undefined')throw new Error('Frekans motoru yok');
        FR.b=6;
        try{ if(typeof ac==='function')ac(); }catch(e){}
        if(FR.playing){
          try{frStop()}catch(e){}
          frStart();
        }else{
          frStart();
        }
        try{ if(typeof syncFreqUI==='function')syncFreqUI(); }catch(e){}
        if(!FR.playing)throw new Error('Frekans başlatılamadı');
      }
    },
    {
      ad:'yigilma',
      kosul:g=>g.kanal>=7,
      baslik:'Çok fazla kanal açık',
      gerekce:g=>g.kanal+' ses kanalı aynı anda çalıyor.',
      eylem:'Katmanlar üst üste binince ayrıntı kaybolur; birkaçını kapatmak sesi berraklaştırır.',
      uygula:null
    },
    {
      /* Bu kural fazla agresifti: 20 dakikayı geçen herkese sürekli çıkıyor,
         diğer kuralların önüne geçiyordu. Eşik 45 dakikaya çekildi ve yalnız
         günde bir kez gösterilir — övgü değil, sakin bir fark ettirme. */
      ad:'gunluk_hedef',
      kosul:g=>{
        if(!(g.bugunDk>=45 && g.gecenDk>=5 && g.saat>=6 && g.saat<22))return false;
        try{
          const bugun=new Date().toDateString();
          if(S.get('sukun.neuroHedefGun','')===bugun)return false;
        }catch(e){}
        return true;
      },
      baslik:'Bugünkü pratiğin dolu',
      gerekce:g=>'Bugün toplam '+g.bugunDk+' dakika oldu.',
      eylem:'Düzenli az, aralıklı çoktan hayırlıdır. Bugünlük yeter demek de bir edeptir.',
      uygula:null,
      gosterildi:()=>{ try{ S.set('sukun.neuroHedefGun',new Date().toDateString()); }catch(e){} }
    }
  ],
  /* ── değerlendirme ── */
  degerlendir(){
    if(!this.acik)return null;
    /* aynı öneriyi sık tekrarlama: 12 dakika ara */
    if(Date.now()-this.sonOneri < 12*60000)return null;
    const g=this.gozlem();
    for(const k of this.KURALLAR){
      if(this.reddedilen.includes(k.ad))continue;
      try{ if(k.kosul(g))return {kural:k, gozlem:g}; }catch(e){}
    }
    return null;
  }
};
window.NEURO=NEURO;
function neuroGoster(sonuc){
  if(!sonuc)return;
  const {kural,gozlem}=sonuc;
  const gerekce=typeof kural.gerekce==='function'?kural.gerekce(gozlem):kural.gerekce,eylem=kural.eylem||'';
  NEURO.sonOneri=Date.now();try{kural.gosterildi&&kural.gosterildi()}catch(e){}
  if(window.SukunAlertCenter?.push){
    const bucket=Math.floor(Date.now()/(12*60000));
    window.SukunAlertCenter.push({
      id:`neuro:${kural.ad}:${bucket}`,kind:'warning',title:kural.baslik||'SÜKÛN uyarısı',
      body:[gerekce,eylem].filter(Boolean).join(' · '),source:'NEURO ENGINE',
      actionLabel:kural.uygula?'Uygula':'',actionFn:kural.uygula||null,
      /* r572: İşlevin kendisi JSON'a yazılamaz. Kalıcı kural kimliği,
         yeniden açılmış kartın Uygula eylemini tekrar çözebilmesini sağlar. */
      meta:{rule:kural.ad||'',type:'neuro',action:'neuro',actionKey:`neuro:${kural.ad||''}`}
    });
    const old=document.getElementById('neuroKart');if(old)old.hidden=true;try{typeof vib==='function'&&vib([10,60,10])}catch(e){};return;
  }
  let el=document.getElementById('neuroKart');if(!el){el=document.createElement('div');el.id='neuroKart';el.hidden=true;document.body.appendChild(el)}
  el.innerHTML='<div class="nkBas"><span class="ico" data-ico="brain"></span> NEURO ENGINE</div><div class="nkBaslik">'+kural.baslik+'</div><div class="nkGerekce">'+gerekce+'</div><div class="nkEylem">'+eylem+'</div><div class="nkBtn">'+(kural.uygula?'<button id="nkEvet">Uygula</button>':'')+'<button id="nkHayir">'+(kural.uygula?'Şimdi değil':'Anladım')+'</button><button id="nkKapat" class="nkSessiz">Bu oturumda sorma</button></div>';
  el.hidden=false;if(typeof icoHydrate==='function')icoHydrate(el);if(typeof vib==='function')vib([10,60,10]);const kapa=()=>{el.hidden=true},e1=document.getElementById('nkEvet');
  if(e1)e1.onclick=()=>{
    /* r573: eski hâli hatayı yutup her durumda «Uygulandı» diyordu; eylem
       patlasa bile kullanıcı başarılı sanıyordu. Artık başarı yalnız
       gerçekten çalıştıysa bildiriliyor, hata Sistem Durumu'na yazılıyor. */
    let oldu=false;
    try{ if(kural.uygula){ kural.uygula(); oldu=true; } }
    catch(e){
      try{typeof sukunReport==='function'&&sukunReport('neuro-uygula',String(kural.ad||'?'),String(e&&e.message||e))}catch(_){}
    }
    if(typeof toast==='function')toast(oldu?'Uygulandı ✦':'Uygulanamadı · Sistem Durumu kaydına bak');
    kapa();
  };document.getElementById('nkHayir').onclick=()=>{NEURO.reddedilen.push(kural.ad);kapa()};document.getElementById('nkKapat').onclick=()=>{NEURO.acik=false;kapa();if(typeof toast==='function')toast('Neuro Engine bu oturumda susturuldu')};
}
let NEURO_T=null;
function neuroBaslat(){
  if(NEURO_T)clearInterval(NEURO_T);
  NEURO_T=setInterval(()=>{
    try{ const s2=NEURO.degerlendir(); if(s2)neuroGoster(s2); }catch(e){}
  },60000);   /* dakikada bir bak — sık kontrol pil yakar */
}
function logTemizle(raw,limit=100){
  if(!Array.isArray(raw))return [];
  const out=[];
  for(const x of raw.slice(-Math.max(1,Math.min(1000,limit)))){
    if(!x||typeof x!=='object'||Array.isArray(x))continue;
    const t=Number(x.t),dur=Number(x.dur);
    if(!Number.isFinite(t)||!Number.isFinite(dur)||dur<0)continue;
    const o={t:Math.max(0,Math.min(Date.now()+86400000,Math.floor(t))),dur:Math.min(604800,Math.floor(dur)),detail:String(x.detail==null?'':x.detail).slice(0,500)};
    const mood=Math.floor(Number(x.mood));if(mood>=1&&mood<=5)o.mood=mood;
    const zk=Math.floor(Number(x.zk));if(Number.isFinite(zk)&&zk>0)o.zk=Math.min(10000000,zk);
    if(Array.isArray(x.mk))o.mk=x.mk.slice(0,100).map(m=>m&&typeof m==='object'?{ad:String(m.ad||'').slice(0,100)}:null).filter(m=>m&&m.ad);
    out.push(o);
  }
  return out;
}
const IST={
  kayitlar(gun){
    const sinir=Date.now()-gun*864e5, hepsi=[];
    try{ logTemizle(S.get('sukun.log',[]),1000).forEach(x=>{ if(x.t>=sinir)hepsi.push({...x,kaynak:'uygulama'}); }); }catch(e){}
    try{ tekkeDefterTemizle(S.get('tekke.defter',[]),1000).forEach(x=>{
      if(x.t>=sinir)hepsi.push({t:x.t,dur:x.sn||0,detail:'۞ Tekke seyri',kaynak:'tekke',zk:x.zk||0,mk:x.mk||[]}); }); }catch(e){}
    return hepsi.sort((a,b)=>a.t-b.t);
  },
  /* metinden esmâ adlarını ayıkla — «Yâ Latîf ×129» gibi */
  esmaCikar(t){
    const out=[];
    String(t||'').replace(/Yâ\s+[A-ZÂÎÛÖÜĞŞÇ][a-zâîûöüğşçA-ZÂÎÛÖÜĞŞÇ'’-]*/g,m=>{out.push(m.trim());return m;});
    return out;
  },
  frekansCikar(t){
    const out=[];
    String(t||'').replace(/([\d.]+)\s*Hz/g,(m,h)=>{const v=parseFloat(h); if(isFinite(v))out.push(v); return m;});
    return out;
  },
  ozet(gun){
    const k=this.kayitlar(gun);
    const toplamSn=k.reduce((a,x)=>a+(x.dur||0),0);
    const zikir=k.reduce((a,x)=>a+(x.zk||0),0);
    /* günlere dağılım */
    const gunler={};
    k.forEach(x=>{ const g=new Date(x.t); const anah=g.getFullYear()+'-'+String(g.getMonth()+1).padStart(2,'0')+'-'+String(g.getDate()).padStart(2,'0');
      gunler[anah]=(gunler[anah]||0)+(x.dur||0); });
    /* esmâ ve frekans sayımı */
    const esma={}, frek={};
    k.forEach(x=>{
      this.esmaCikar(x.detail).forEach(e=>{ esma[e]=(esma[e]||0)+1; });
      this.frekansCikar(x.detail).forEach(f=>{ const y=Math.round(f*100)/100; frek[y]=(frek[y]||0)+1; });
      (x.mk||[]).forEach(m=>{ if(m&&m.ad)esma[m.ad]=(esma[m.ad]||0)+1; });
    });
    /* saat dağılımı — hangi vakitte dinleniyor */
    const saatler=new Array(24).fill(0);
    k.forEach(x=>{ saatler[new Date(x.t).getHours()]+=(x.dur||0); });
    /* üst üste gün serisi */
    const gunListe=Object.keys(gunler).sort();
    let seri=0; const bugun=new Date();
    for(;;){ const a=bugun.getFullYear()+'-'+String(bugun.getMonth()+1).padStart(2,'0')+'-'+String(bugun.getDate()).padStart(2,'0');
      if(gunler[a]){seri++; bugun.setDate(bugun.getDate()-1);} else break; }
    const sirala=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
    return {oturum:k.length, toplamSn, dk:Math.round(toplamSn/60), zikir,
            aktifGun:gunListe.length, seri, gunler, saatler,
            esma:sirala(esma), frekans:sirala(frek),
            ortalamaDk: k.length?Math.round(toplamSn/60/k.length):0,
            enUzunDk: k.length?Math.round(Math.max(...k.map(x=>x.dur||0))/60):0};
  }
};
window.IST=IST;
const LOG={cur:null};
LOG.touch=(k,detail)=>{
  if(!LOG.cur)LOG.cur={t0:Date.now(),parts:{}};
  LOG.cur.parts[k]=detail;
};
LOG.allStopped=()=>!FR.playing&&Object.keys(AMB).length===0&&!Z.auto;
LOG.maybeEnd=()=>{
  if(!LOG.cur||!LOG.allStopped())return;
  const dur=Math.round((Date.now()-LOG.cur.t0)/1000);
  const parts=LOG.cur.parts; LOG.cur=null;
  if(dur<90)return;
  LOG.push({t:Date.now(),dur,detail:Object.values(parts).join(' · ')});
  LOG.rate();
};
LOG.push=e=>{
  const a=logTemizle(S.get('sukun.log',[]));
  const temiz=logTemizle([e],1)[0];if(!temiz)return;
  a.push(temiz);S.set('sukun.log',a.slice(-100));
};
window.LOG=LOG;   /* Tekke modülü kendi kapsamından günlüğe yazabilsin */
LOG.rate=()=>{
  $('#rateRow').innerHTML=[1,2,3,4,5].map(n=>'<button data-n="'+n+'">'+'✦'.repeat(n)+'</button>').join('')+'<button data-n="0" style="color:var(--dim)">Geç</button>';
  $('#rateToast').hidden=false;
  clearTimeout(LOG._rt); LOG._rt=setTimeout(()=>$('#rateToast').hidden=true,20000);
};
$('#rateToast').addEventListener('click',e=>{
  const b=e.target.closest('[data-n]'); if(!b)return;
  const n=+b.dataset.n;
  if(n){const a=logTemizle(S.get('sukun.log',[])); if(a.length){a[a.length-1].mood=n;S.set('sukun.log',a);}}
  $('#rateToast').hidden=true;
});
window.addEventListener('sukun:log',e=>{
  const d=e.detail||{}; if(!d.dur)return;
  LOG.push({t:Date.now(),dur:d.dur,detail:d.detail||d.kind,mood:d.mood});
  if(d.kind==='tekke')LOG.rate();
  Z.total=Math.max(Z.total,S.get('sukun.total',Z.total)); zUI();
});
function fmtDur(s){return s>=60?Math.round(s/60)+' dk':s+' sn';}
function lsRender(){
  const all=logTemizle(S.get('sukun.log',[]));
  const a=all.slice().reverse();
  const wk=Date.now()-7*864e5;
  const tot=Math.round(all.filter(x=>x.t>=wk).reduce((p,x)=>p+x.dur,0)/60);
  $('#ls7').textContent='Son 7 gün: '+tot+' dk';
  $('#lsList').innerHTML=a.length?a.map(x=>{
    const d=new Date(x.t);
    const dd=String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    return '<div class="lsItem"><b>'+dd+'</b><span>'+hesc(x.detail||'')+'</span><span class="m">'+fmtDur(x.dur)+(x.mood?' · '+'✦'.repeat(x.mood):'')+'</span></div>';
  }).join(''):'<div class="bosDurum"><span class="ico" data-ico="journal"></span><b>Henüz kayıt yok</b><small>1,5 dakikadan uzun bir seans bitince burada belirir.</small></div>';
}
$('#logBtn').onclick=()=>{lsRender();try{defterBirlesikYaz();istCiz();}catch(e){}lsHeatRender();lsEsmaRender();try{weekRender()}catch(e){}$('#logSheet').hidden=false;};
$('#lsClose').onclick=()=>$('#logSheet').hidden=true;
$('#lsClear').onclick=()=>{if(confirm('Günlük silinsin mi?')){S.set('sukun.log',[]);lsRender();}};
const _chOn=chOn; chOn=d=>{_chOn(d);LOG.touch('amb',d.icon+' '+d.name);};
const _chOff=chOff; chOff=id=>{_chOff(id);LOG.maybeEnd();};
const _autoStart=autoStart; autoStart=()=>{_autoStart();try{LOG.touch('zikir','📿 '+(($('#zTr')&&$('#zTr').textContent)||'Zikir'));}catch(e){}};
const _autoStop=autoStop; autoStop=()=>{_autoStop();LOG.maybeEnd();};

/* ════════════════════════════════════════════════════════════
   6d) v1.3 — VİRD • SES HALKASI • BENDİR • ÇİFT KATMAN • KAYIT • AVE
   ════════════════════════════════════════════════════════════ */
/* ── İkinci binaural katman ── */
const FR2={on:false,c:100,b:2.5,E:null,out:null,oL:null,oR:null};
function fr2Start(){
  if(FR2.E||!FR2.on)return; ac();
  FR2.b=clamp(+FR2.b||2.5,.5,40); FR2.c=frSafeCarrier(FR2.c,FR2.b);
  const E=makeEnv(), out=E.n(g(0)); out.connect(master);
  const mg=E.n(ctx.createChannelMerger(2));
  FR2.oL=E.play(osc(FR2.c-FR2.b/2)); const gl=E.n(g(.5)); FR2.oL.connect(gl); gl.connect(mg,0,0);
  FR2.oR=E.play(osc(FR2.c+FR2.b/2)); const gr=E.n(g(.5)); FR2.oR.connect(gr); gr.connect(mg,0,1);
  mg.connect(out);
  out.gain.setTargetAtTime(FR.vol*.22,ctx.currentTime,.6);
  FR2.E=E; FR2.out=out;
}
function fr2Stop(){ if(!FR2.E)return; FR2.E.kill(.5,FR2.out); FR2.E=null; FR2.out=null; }
function fr2Retune(){
  if(!FR2.E)return; const t=ctx.currentTime;
  FR2.b=clamp(+FR2.b||2.5,.5,40); FR2.c=frSafeCarrier(FR2.c,FR2.b);
  FR2.oL.frequency.setTargetAtTime(FR2.c-FR2.b/2,t,.15);
  FR2.oR.frequency.setTargetAtTime(FR2.c+FR2.b/2,t,.15);
}
$('#fr2Tgl').onclick=()=>{
  FR2.on=!FR2.on; $('#fr2Tgl').classList.toggle('on',FR2.on);
  if(FR.playing)(FR2.on?fr2Start():fr2Stop());
  saveSettings();
};
$('#fr2Car').addEventListener('input',e=>{FR2.c=frSafeCarrier(+e.target.value,FR2.b);e.target.value=FR2.c;$('#fr2CarV').textContent=FR2.c.toFixed(1)+' Hz';setFill(e.target);fr2Retune();saveSettings();});
$('#fr2Beat').addEventListener('input',e=>{FR2.b=clamp(+e.target.value||2.5,.5,40);FR2.c=frSafeCarrier(FR2.c,FR2.b);$('#fr2Car').value=FR2.c;$('#fr2BeatV').textContent=FR2.b.toFixed(2)+' Hz';setFill(e.target);fr2Retune();saveSettings();});

/* ── Bendir usûlü — düm & tek sentezi ── */
let BENDIR=false;
function drumDum(t){
  const o=osc(140), gg=g(0);
  o.frequency.setValueAtTime(140,t);
  o.frequency.exponentialRampToValueAtTime(70,t+.12);
  gg.gain.setValueAtTime(0,t);
  gg.gain.linearRampToValueAtTime(.5,t+.008);
  gg.gain.exponentialRampToValueAtTime(.0001,t+.28);
  o.connect(gg); gg.connect(master);
  const w=g(.25); gg.connect(w); w.connect(wetIn);
  o.start(t); o.stop(t+.32);
  const n=ctx.createBufferSource(); n.buffer=NOISE.get('brown');
  const f=flt('lowpass',300), ng=g(0);
  n.connect(f); f.connect(ng); ng.connect(master);
  ng.gain.setValueAtTime(0,t);
  ng.gain.linearRampToValueAtTime(.22,t+.004);
  ng.gain.exponentialRampToValueAtTime(.0001,t+.09);
  n.start(t); n.stop(t+.12);
}
function drumTek(t){
  const n=ctx.createBufferSource(); n.buffer=NOISE.get('white');
  const f=flt('bandpass',2900,5), ng=g(0);
  n.connect(f); f.connect(ng); ng.connect(master);
  const w=g(.3); ng.connect(w); w.connect(wetIn);
  ng.gain.setValueAtTime(0,t);
  ng.gain.linearRampToValueAtTime(.2,t+.003);
  ng.gain.exponentialRampToValueAtTime(.0001,t+.07);
  n.start(t); n.stop(t+.1);
}
let USUL=S.get('sukun.usul','duyek');
$('#usulSel').value=USUL;
$('#usulSel').addEventListener('change',e=>{USUL=e.target.value;S.set('sukun.usul',USUL);});
/* Usûl kalıpları: her vuruşun zamanı (tempo birimi çarpanı) ve türü (D=düm, T=tek) */
const USULLER={
  duyek:[[0,'D'],[0.5,'T'],[0.75,'T']],
  sofyan:[[0,'D'],[0.5,'T']],
  devrihindi:[[0,'D'],[0.375,'T'],[0.625,'D'],[0.875,'T']],
  cifte:[[0,'D'],[0.25,'T'],[0.5,'D'],[0.75,'T']]
};
function playUsul(){
  if(!ctx)return;
  const unit=Math.min(1.6,Math.max(.4,Z.tempo)); const t0=ctx.currentTime+.02;
  (USULLER[USUL]||USULLER.duyek).forEach(([off,ty])=>{
    const t=t0+off*unit;
    if(ty==='D')drumDum(t); else drumTek(t);
  });
}
$('#optBendir').onclick=()=>{
  BENDIR=!BENDIR; $('#optBendir').classList.toggle('on',BENDIR);
  if(BENDIR)ac();
  saveSettings();
};

/* ── 8D mekânsal ses: aktif ambiyans kanallarını yavaşça çevrede dolaştır ── */
let SPATIAL=S.get('sukun.spatial',false), spatialRAF=null, spatialNodes={};
function spatialEnsure(id){
  /* her kanalın çıkışına bir StereoPanner ekle (yalnızca 8D açıkken) */
  return spatialNodes[id];
}
/* ═══ r513 — P-05: rAF KORUMANIN ÖNÜNDEYDİ ═════════════════════════
   Eski sıra: önce requestAnimationFrame, SONRA koruma. Yani spatialStart()
   bir kez çağrıldıktan sonra döngü sonsuza dek 60 fps dönüyordu — 8D
   KAPATILSA bile. Kapatma dalı yalnız panner'ları ortaya alıyor, rAF'ı hiç
   iptal etmiyordu. r512 tanılama raporunda ölçüldü: uygulama boştayken
   106 sn'de 19.778 rAF isteği (~186/sn), dördü de canlı.
   Doğru sıra: koruma önce; iş yoksa döngü parklanır. */
function spatialDur(){ if(spatialRAF){try{cancelAnimationFrame(spatialRAF)}catch(e){} spatialRAF=null;} }
function spatialLoop(){
  if(!SPATIAL||!ctx||ctx.state==='closed'){ spatialRAF=null; return; }   /* park */
  spatialRAF=requestAnimationFrame(spatialLoop);
  const t=ctx.currentTime;
  Object.keys(AMB).forEach((id,i)=>{
    const node=AMB[id]; if(!node||!node.gain)return;
    if(!node._pan){
      try{
        const p=ctx.createStereoPanner();
        node.gain.disconnect(master);      /* yalnızca kuru yolu kes, reverb (wetIn) sürsün */
        node.gain.connect(p); p.connect(master);
        node._pan=p;
      }catch(e){node._pan='none';}
    }
    if(node._pan&&node._pan!=='none'){
      const speed=.12+i*0.035;
      node._pan.pan.setValueAtTime(Math.sin(t*speed+i*1.7)*0.85,t);
    }
  });
}
function spatialStart(){ if(!spatialRAF)spatialLoop(); }
$('#spatialTgl').onclick=()=>{
  SPATIAL=!SPATIAL; $('#spatialTgl').classList.toggle('on',SPATIAL);
  S.set('sukun.spatial',SPATIAL);
  if(SPATIAL){ac();spatialStart();}
  else{ /* r513: panner'ları ortaya al VE döngüyü gerçekten durdur */
    if(ctx)Object.values(AMB).forEach(n=>{ if(n&&n._pan&&n._pan!=='none')n._pan.pan.setTargetAtTime(0,ctx.currentTime,.3); });
    setTimeout(spatialDur,400);   /* pan'ler ortaya oturana kadar bekle, sonra park et */
  }
};
function spatialInit(){ $('#spatialTgl').classList.toggle('on',SPATIAL); if(SPATIAL)spatialStart(); }

/* ── Kendi sesinle zikir halkası ── */
const VH={buf:null,blob:null,dur:0,playing:null,layers:5,vol:.6,rec:null,chunks:[]};
async function vhRecord(){
  if(VH.rec){try{VH.rec.stop()}catch(e){} return;}
  try{
    const st=await navigator.mediaDevices.getUserMedia(micKisit());
    VH.chunks=[];
    const mr=new MediaRecorder(st); VH.rec=mr; VH.sess=null;
    mr.ondataavailable=e=>{if(e.data.size)VH.chunks.push(e.data)};
    mr.onstop=async()=>{
      if(VH.sess){VH.sess.bitir();VH.sess=null;}
      st.getTracks().forEach(tr=>tr.stop());
      VH.rec=null; $('#vhRec').classList.remove('rec'); $('#vhRec').textContent='⏺ Sesini kaydet';
      const blob=new Blob(VH.chunks,{type:mr.mimeType||'audio/webm'});
      VH.blob=blob; VH.buf=null; VH.dur=0; vhStop();
      /* süreyi öğren (webm süresi bazen Infinity döner — korumalı) */
      try{
        const pa=new Audio(URL.createObjectURL(blob));
        pa.addEventListener('loadedmetadata',()=>{
          if(isFinite(pa.duration)&&pa.duration>0)VH.dur=pa.duration;
          URL.revokeObjectURL(pa.src);
        },{once:true});
      }catch(e){}
      /* çözebilirsek hassas tampon yolu, çözemesek de eleman yolu çalışır */
      try{
        ac();
        VH.buf=await ctx.decodeAudioData(await blob.arrayBuffer());
        VH.dur=VH.buf.duration;
      }catch(e){}
      $('#vhStat').textContent='Kayıt hazır ✓'+(VH.dur?' '+VH.dur.toFixed(1)+' sn':'')+' — ▶ ile halkayı başlat';
      if(blob.size<2*1024*1024){
        const r=new FileReader();
        r.onload=()=>S.set('sukun.voice',{d:r.result});
        r.readAsDataURL(blob);
      }
    };
    await micHazirla(st); mr.start(1000);
    $('#vhRec').classList.add('rec'); $('#vhRec').textContent='⏹ Bitir';
    $('#vhStat').textContent='Kaydediliyor… «Hû» ya da esmâyı bir kez söyle (en çok 20 sn)';
    VH.sess=recSessionBegin('Zikir halkası — bitirmek için 🎙',20,
      ()=>{ if(VH.rec===mr&&mr.state==='recording')mr.stop(); });
  }catch(e){$('#vhStat').textContent='Mikrofon izni verilmedi';}
}
async function vhLoadStored(){
  const v=S.get('sukun.voice',null); if(!v||!v.d)return false;
  try{
    const d=String(v.d||'');
    /* localStorage yedeklerinden uzak URL veya sınırsız veri yüklenmesin.
       Bu kayıt yolu yalnız FileReader'ın ürettiği gerçek ses data URI'sini
       kabul eder; uygulamanın kendi kayıt sınırı 2 MB, burada küçük bir
       uyumluluk payıyla 4 MB üst sınır uygulanır. */
    if(d.length>4*1024*1024||!/^data:audio\/[a-z0-9.+-]+(?:;[a-z0-9.+_-]+=[a-z0-9.+_-]+)*;base64,[a-z0-9+/=]+$/i.test(d))return false;
    VH.blob=await (await fetch(d)).blob();
    if(!VH.blob||VH.blob.size>3*1024*1024||!/^audio\//i.test(VH.blob.type||'')){VH.blob=null;return false;}
    ac();
    try{
      VH.buf=await ctx.decodeAudioData(await VH.blob.arrayBuffer());
      VH.dur=VH.buf.duration;
    }catch(e){}
    return true;
  }catch(e){return false;}
}
function vhStop(){
  if(!VH.playing)return;
  const P=VH.playing; VH.playing=null;
  if(P.els)P.els.forEach(a=>{try{a.pause()}catch(e){}});
  P.E.kill(1,P.out);
  if(P.url)setTimeout(()=>{try{URL.revokeObjectURL(P.url)}catch(e){}},1500);
  $('#vhPlay').textContent='▶ Halkayı başlat'; $('#vhPlay').classList.remove('playing');
}
async function vhToggle(){
  if(VH.playing){vhStop();LOG.maybeEnd();return;}
  if(!VH.buf&&!VH.blob&&!(await vhLoadStored())){
    $('#vhStat').textContent='Önce kısa bir ses kaydet ⏺'; return;
  }
  ac(); try{await ctx.resume()}catch(e){}
  if(VH.buf){ try{vhBufStart(); return;}catch(e){} }
  try{vhElemStart();}
  catch(e){$('#vhStat').textContent='Halka başlatılamadı ('+((e&&e.name)||'hata')+') — sesi yeniden kaydetmeyi dene';}
}
/* Yol 1: çözülmüş tampon — hassas detune */
function vhBufStart(){
  const E=makeEnv(), out=E.n(g(0)); out.connect(master);
  const w=E.n(g(.45)); out.connect(w); w.connect(wetIn);
  const L=VH.layers, D=VH.buf.duration;
  for(let i=0;i<L;i++){
    const s=E.n(ctx.createBufferSource()); s.buffer=VH.buf; s.loop=true;
    s.playbackRate.value=1+(i-(L-1)/2)*0.012;
    const p=E.n(ctx.createStereoPanner()); p.pan.value=(L>1?(i/(L-1)-.5):0)*1.4;
    const gg=E.n(g(.8/Math.sqrt(L)));
    s.connect(gg); gg.connect(p); p.connect(out);
    s.start(ctx.currentTime+.05+i*(D/L)*.9);
  }
  out.gain.setTargetAtTime(VH.vol,ctx.currentTime,1.2);
  VH.playing={E,out};
  LOG.touch('halka','🎙 Ses halkası ×'+L);
  $('#vhPlay').textContent='⏸ Halkayı durdur'; $('#vhPlay').classList.add('playing');
}
/* Yol 2: tarayıcı çözemezse <audio> elemanlarıyla — kaydettiğini her cihaz çalar */
function vhElemStart(){
  const L=VH.layers, url=URL.createObjectURL(VH.blob), D=VH.dur||4;
  const E=makeEnv(), out=E.n(g(0)); out.connect(master);
  const w=E.n(g(.45)); out.connect(w); w.connect(wetIn);
  const els=[];
  for(let i=0;i<L;i++){
    const a=new Audio(); a.src=url; a.loop=true; a.preload='auto';
    a.playbackRate=1+(i-(L-1)/2)*0.012;
    try{a.preservesPitch=false; a.mozPreservesPitch=false; a.webkitPreservesPitch=false;}catch(e){}
    const sn=E.n(ctx.createMediaElementSource(a));
    const pn=E.n(ctx.createStereoPanner()); pn.pan.value=(L>1?(i/(L-1)-.5):0)*1.4;
    const gg=E.n(g(.8/Math.sqrt(L)));
    sn.connect(gg); gg.connect(pn); pn.connect(out);
    els.push(a);
    setTimeout(()=>{a.play().catch(()=>{})},60+i*(D/L)*900);
  }
  out.gain.setTargetAtTime(VH.vol,ctx.currentTime,1.2);
  VH.playing={E,out,els,url};
  LOG.touch('halka','🎙 Ses halkası ×'+L);
  $('#vhPlay').textContent='⏸ Halkayı durdur'; $('#vhPlay').classList.add('playing');
}
$('#vhRec').onclick=vhRecord;
$('#vhPlay').onclick=vhToggle;
$('#vhLayers').addEventListener('change',e=>{
  VH.layers=+e.target.value; saveSettings();
  if(VH.playing){vhStop();vhToggle();}
});
$('#vhVol').addEventListener('input',e=>{
  VH.vol=+e.target.value; setFill(e.target);
  if(VH.playing)VH.playing.out.gain.setTargetAtTime(VH.vol,ctx.currentTime,.2);
  saveSettings();
});
function vhInit(){
  if(S.get('sukun.voice',null))$('#vhStat').textContent='Kayıtlı sesin hazır ✓ — ▶ ile halkayı başlat';
}

/* ── Seans kaydı (.webm) ── */
let REC=null, recDest=null;
function recToggle(){
  if(REC){try{REC.stop()}catch(e){} return;}
  if(!window.MediaRecorder){alert('Bu tarayıcı kayıt desteklemiyor');return;}
  ac();
  if(!recDest){recDest=ctx.createMediaStreamDestination(); master.connect(recDest);}
  let mime='audio/webm;codecs=opus';
  if(!MediaRecorder.isTypeSupported(mime))mime='audio/webm';
  const chunks=[], mr=new MediaRecorder(recDest.stream,{mimeType:mime});
  mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{
    REC=null; $('#recBtn').classList.remove('rec'); $('#recBtn').textContent='⏺';
    const blob=new Blob(chunks,{type:mime});
    const a=document.createElement('a'), d=new Date(), p=x=>String(x).padStart(2,'0');
    a.href=URL.createObjectURL(blob);
    a.download='sukun-seans-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes())+'.webm';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);
  };
  mr.start(1000); REC=mr;
  $('#recBtn').classList.add('rec'); $('#recBtn').textContent='⏹';
}
$('#recBtn').onclick=recToggle;

/* ── Ses-tepkili orb + Fotik uyarım (AVE) ── */
let ANA=null,anaBuf=null,ampV=0;
const AVE={on:false,int:.18};
function anaEnsure(){
  if(ANA||!ctx)return;
  ANA=ctx.createAnalyser(); ANA.fftSize=512;
  anaBuf=new Uint8Array(ANA.fftSize);
  master.connect(ANA);
}
$('#aveTgl').onclick=()=>{
  if(!AVE.on){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){alert('Cihazda «hareketi azalt» açık — fotik uyarım devre dışı bırakıldı.');return;}
    if(!confirm('⚠ FOTİK UYARIM UYARISI\n\nEkran, vuruş frekansında ritmik olarak parlayacak. Epilepsi ya da ışığa duyarlılık öykünüz varsa KULLANMAYIN. Rahatsızlık hissederseniz hemen kapatın.\n\nDevam edilsin mi?'))return;
    AVE.on=true; $('#aveTgl').classList.add('on'); $('#aveOv').hidden=false;
  }else{
    AVE.on=false; $('#aveTgl').classList.remove('on');
    const o=$('#aveOv'); o.style.opacity=0; o.hidden=true;
  }
  saveSettings();
};
$('#aveInt').addEventListener('input',e=>{
  AVE.int=+e.target.value;
  $('#aveIntV').textContent='%'+Math.round(AVE.int*100);
  setFill(e.target); saveSettings();
});
CIZ.ekle('vis',function visLoop(){
  if(!ctx)return;
  const busy=FR.playing||Object.keys(AMB).length||VH.playing;
  if(busy){
    anaEnsure();
    ANA.getByteTimeDomainData(anaBuf);
    let sum=0;
    for(let i=0;i<anaBuf.length;i+=4){const v=(anaBuf[i]-128)/128; sum+=v*v;}
    const rms=Math.sqrt(sum/(anaBuf.length/4));
    ampV+=(rms-ampV)*.18;
    const orb=$('#orb');
    if(orb)orb.style.filter='brightness('+(1+ampV*1.6).toFixed(3)+') saturate('+(1+ampV*1.1).toFixed(3)+')';
  }
  const ov=$('#aveOv');
  if(ov&&AVE.on){
    ov.style.opacity=FR.playing
      ? (Math.sin(2*Math.PI*FR.b*ctx.currentTime)>0?AVE.int:0).toFixed(3)
      : 0;
  }
});

/* ── Vird programı — haftanın esmâları ── */
const DAYS_TR=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const eIdx=nm=>Math.max(0,ZIKIR.esma.items.findIndex(x=>x.t===nm));

/* ── FÂTİHA ↔ NEFS ↔ LATÎFE işârî haritası (yorumî-sembolik) ──
   Sıra: Fâtiha'nın 7 âyeti, 7 nefs mertebesine ve 7 latîfeye karşılık getirilir.
   Besmele 1. âyet sayılır (Kûfî/İbn Kesîr sayımı — Diyanet mushafı). */
const FATIHA=[
 {no:'1. âyet',aa:'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  am:'Rahmân ve Rahîm olan Allah’ın adıyla.',
  bag:'Emmâre mertebesinin başlangıcı: kul, kötülüğü emreden nefsin karşısında ilk adımı «Allah’ın adıyla» atar. Besmele, mücadelenin niyet kapısıdır.'},
 {no:'2. âyet',aa:'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
  am:'Hamd, âlemlerin Rabbi Allah’a mahsustur.',
  bag:'Levvâme mertebesi: kendini kınayan nefs, kusurunu görüp her hâlde hamd etmeyi öğrenir. Şükür, nefsi terbiyenin ikinci basamağıdır.'},
 {no:'3. âyet',aa:'الرَّحْمَٰنِ الرَّحِيمِ',
  am:'O, Rahmân’dır, Rahîm’dir.',
  bag:'Mülhime mertebesi: ilham alan kalbe ilâhî rahmetin iki tecellîsi (Rahmân-Rahîm) yansımaya başlar; havf ile recâ dengelenir.'},
 {no:'4. âyet',aa:'مَالِكِ يَوْمِ الدِّينِ',
  am:'O, hesap gününün sahibidir.',
  bag:'Mutmainne mertebesi: huzura eren nefs, hesap gününü yakîn ile hisseder; korku değil, teslimiyet ve itminan hâkim olur.'},
 {no:'5. âyet',aa:'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
  am:'Yalnız Sana kulluk eder, yalnız Senden yardım dileriz.',
  bag:'Râzıye mertebesi: kul, ibâdette ve istiânede yalnız Hakk’ı görür; «Sen»den râzı olarak mâsivâyı terk eder.'},
 {no:'6. âyet',aa:'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
  am:'Bizi dosdoğru yola ilet.',
  bag:'Marzıyye mertebesi: Hak’tan râzı olduğu gibi Hakk’ın da kendisinden râzı olduğu kul, sırât-ı müstakîm üzere sabit kılınmayı niyaz eder.'},
 {no:'7. âyet',aa:'صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ',
  am:'Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapkınların yoluna değil.',
  bag:'Sâfiye (kâmile) mertebesi: nimete erdirilmiş sıddîkler zümresine katılış; tertemiz olmuş nefsin, enbiyâ ve evliyânın yolunda karar kılışı.'}
];
window.FATIHA=FATIHA;
function virdHaftaTemizle(a){
  if(!Array.isArray(a)||a.length!==7)return null;
  const max=ZIKIR.esma.items.length-1;
  return a.map(x=>({i:Math.round(clamp(Number(x&&x.i)||0,0,max)),n:Math.round(clamp(Number(x&&x.n)||33,1,1000))}));
}
let VIRD=virdHaftaTemizle(S.get('sukun.vird',null));
function virdInit(){
  if(!VIRD){
    VIRD=['Nûr','Latîf','Vedûd','Fettâh','Alîm','Selâm','Sabûr'].map(nm=>{
      const i=eIdx(nm); return {i,n:ebced(ZIKIR.esma.items[i].a)};
    });
    S.set('sukun.vird',VIRD);
  }
  VIRD=virdHaftaTemizle(VIRD);S.set('sukun.vird',VIRD);
  const opts=ZIKIR.esma.items.map((it,i)=>'<option value="'+i+'">Yâ '+hesc(it.t)+'</option>').join('');
  /* Düzen: 1. satır gün + adet + hedef düğmesi, 2. satır esmâ seçici TAM genişlikte.
     Eski düzende select güne ve sayıya sıkışıyor, uzun esmâlar (Zü'l-Celâli ve'l-İkrâm)
     kırpılıyordu. Select tek başına satır kaplayınca en uzun esmâ bile tam görünür. */
  /* Sayı kutusu esmânın ebced değerine göre başlar (🎯 ile yeniden eşitlenir)
     ama serbestçe düzenlenebilir; kullanıcı bunun ebced değeri olduğunu
     anlamıyordu — üstüne küçük bir "EBCED DEĞERİ" etiketi eklendi. */
  /* Her gün kendi rengiyle ayrışsın — kartın sol kenarı ve seçim kutusu o
     renkte. Haftanın yedi günü, uygulamanın diğer yerlerinde de kullanılan
     sıcak-soğuk geçişli palet dilinden. */
  const VIRD_RENK=['#e0574a','#e08c3a','#e6c34a','#3faa6a','#3f8fd0','#9b59b6','#c264d9'];
  $('#virdRows').innerHTML=VIRD.map((v,d)=>
   '<div class="jRow" data-d="'+d+'" style="--vc:'+VIRD_RENK[d]+'"><b>'+DAYS_TR[d]+'</b>'+
   '<div class="virdNumWrap"><label>Ebced Değeri</label>'+
   '<input type="number" min="1" max="1000" value="'+v.n+'" aria-label="Ebced değeri / hedef adet"></div>'+
   '<button class="x" title="Adedi esmânın ebced değerine eşitle"><span class="ico" data-ico="target"></span> </button>'+
   '<select aria-label="Günün esmâsı" style="--vc:'+VIRD_RENK[d]+'">'+opts+'</select></div>').join('');
  $$('#virdRows .jRow').forEach(r=>{r.querySelector('select').value=String(VIRD[+r.dataset.d].i);});
  virdBanner();
}
function virdBanner(){
  const d=new Date().getDay(), v=VIRD[d], it=ZIKIR.esma.items[v.i];
  const done=S.get('sukun.vird.done',{})[new Date().toDateString()];
  $('#virdTxt').innerHTML=(done?'✓ ':'📅 ')+DAYS_TR[d]+' virdi: <b>Yâ '+hesc(it.t)+' ×'+v.n+'</b>'+(done?' — tamam ✦':'');
  $('#virdBar').classList.toggle('done',!!done);
  $('#virdGo').textContent=done?'Tekrar':'Başla';
}
$('#virdRows').addEventListener('input',e=>{
  const r=e.target.closest('.jRow'); if(!r)return;
  const d=+r.dataset.d;
  VIRD[d].i=+r.querySelector('select').value;
  VIRD[d].n=clamp(+r.querySelector('input').value||33,1,1000);
  S.set('sukun.vird',VIRD); virdBanner();
});
$('#virdRows').addEventListener('click',e=>{
  if(!e.target.classList.contains('x'))return;
  const r=e.target.closest('.jRow'), d=+r.dataset.d;
  VIRD[d].n=ebced(ZIKIR.esma.items[VIRD[d].i].a);
  r.querySelector('input').value=VIRD[d].n;
  S.set('sukun.vird',VIRD); virdBanner();
});
$('#virdGo').onclick=()=>{
  const d=new Date().getDay(), v=VIRD[d];
  Z.cat='esma'; Z.idx=v.i; Z.target=v.n; Z.count=0; Z.devir=0; Z.form='nida';
  syncFormSeg(); ensureTargetOpt(v.n,'Vird • '+v.n);
  renderCats(); renderZikir(); zUI();
  if(RX_ESMA_BG) rxEsmaBgStart(ZIKIR.esma.items[v.i].t);
};
function virdCheckFor(cat,idx,completed=false){
  const d=new Date().getDay(),v=VIRD?VIRD[d]:null;if(!v)return false;
  const liveDone=cat==='esma'&&Z.cat==='esma'&&Z.idx===idx&&Z.devir>=1;
  if(cat==='esma'&&(+idx||0)===v.i&&(completed||liveDone)){
    const key=new Date().toDateString(),done=S.get('sukun.vird.done',{});
    if(!done[key]){done[key]=1;S.set('sukun.vird.done',done);virdBanner();}
    return true;
  }
  return false;
}
function virdCheck(){return virdCheckFor(Z.cat,Z.idx,false)}
window.SukunVirdCheckForR695=virdCheckFor;

/* ── Günlük içgörüsü: seri + sana iyi gelen + 7 gün grafiği ── */
function lsHeatRender(){
  const box=$('#lsHeat'); if(!box)return;
  const all=logTemizle(S.get('sukun.log',[]));
  const perDay={};
  all.forEach(x=>{ const d=new Date(x.t); d.setHours(0,0,0,0); const k=d.getTime(); perDay[k]=(perDay[k]||0)+x.dur; });
  const cells=[]; const today=new Date(); today.setHours(0,0,0,0);
  /* 12 hafta × 7 gün = 84 gün, sütun=hafta */
  const start=new Date(today); start.setDate(start.getDate()-83);
  const startDow=(start.getDay()+6)%7; start.setDate(start.getDate()-startDow); /* pazartesi hizası */
  for(let w=0;w<12;w++)for(let d=0;d<7;d++){
    const dt=new Date(start); dt.setDate(dt.getDate()+w*7+d);
    const mins=Math.round((perDay[dt.getTime()]||0)/60);
    let lv=0; if(mins>0)lv=1; if(mins>=10)lv=2; if(mins>=25)lv=3; if(mins>=45)lv=4;
    cells.push({w,d,mins,lv,fut:dt>today});
  }
  /* grid satır=gün(7), sütun=hafta(12) → satır bazlı diz */
  let html='';
  for(let d=0;d<7;d++)for(let w=0;w<12;w++){
    const c=cells.find(x=>x.w===w&&x.d===d);
    const col=c.fut?'transparent':['rgba(255,255,255,.05)','rgba(201,162,39,.28)','rgba(201,162,39,.5)','rgba(201,162,39,.75)','#ecd27e'][c.lv];
    html+='<i style="background:'+col+'" title="'+c.mins+' dk"></i>';
  }
  box.innerHTML=html;
}
function esmaCountTemizle(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  const known=new Set(ZIKIR.esma.items.map(x=>'Yâ '+x.t)),out={};
  Object.entries(raw).slice(0,500).forEach(([k,v])=>{const n=Math.floor(Number(v));if(known.has(k)&&Number.isFinite(n)&&n>0)out[k]=Math.min(10000000,n)});return out;
}
function lsEsmaRender(){
  const box=$('#lsEsma'); if(!box)return;
  const cnt=esmaCountTemizle(S.get('sukun.esmaCount',{}));
  const rows=Object.entries(cnt)
    .map(([nm,n])=>[String(nm).slice(0,120),Math.max(0,Math.min(10000000,Math.floor(Number(n)||0)))])
    .filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!rows.length){ box.innerHTML='<div style="font-size:10.5px;color:var(--dim)">Esmâ zikri çektikçe en çok andığın isimler burada birikir.</div>'; return; }
  const mx=rows[0][1];
  box.innerHTML='<div class="lsHeatT">En çok andığın esmâlar</div>'+rows.map(([nm,n])=>
    '<div class="er"><b>'+hesc(nm)+'</b><span class="bar"><i style="width:'+Math.round(n/mx*100)+'%"></i></span><span class="n">'+n+'</span></div>').join('');
}
/* Hâl kartı — canvas ile paylaşılabilir görsel üret */
async function makeHalCard(){
  const all=logTemizle(S.get('sukun.log',[]));
  const wk=Date.now()-7*864e5;
  const totMin=Math.round(all.filter(x=>x.t>=wk).reduce((p,x)=>p+x.dur,0)/60);
  const days=new Set(all.map(x=>new Date(x.t).toDateString()));
  let streak=0; for(let i=0;;i++){ const d=new Date(Date.now()-i*864e5).toDateString(); if(days.has(d))streak++; else break; }
  const lastZikir=$('#zTr').textContent||'Zikrullah';
  const cs=getComputedStyle(document.body);
  const gold=(cs.getPropertyValue('--gold')||'#c9a227').trim();
  const goldh=(cs.getPropertyValue('--goldh')||'#ecd27e').trim();
  const bg=(cs.getPropertyValue('--bg')||'#081310').trim();
  const W=1080,Hh=1080, c=document.createElement('canvas'); c.width=W;c.height=Hh;
  const x=c.getContext('2d');
  /* zemin */
  const grd=x.createRadialGradient(W/2,Hh*.38,60,W/2,Hh*.5,W*.8);
  grd.addColorStop(0,'#123');grd.addColorStop(0,bg);grd.addColorStop(1,'#04070a');
  x.fillStyle=bg;x.fillRect(0,0,W,Hh);
  x.fillStyle=grd;x.globalAlpha=.6;x.fillRect(0,0,W,Hh);x.globalAlpha=1;
  /* altın çerçeve */
  x.strokeStyle=gold;x.lineWidth=3;x.strokeRect(48,48,W-96,Hh-96);
  x.strokeStyle=goldh;x.lineWidth=1;x.strokeRect(64,64,W-128,Hh-128);
  /* mühür */
  x.fillStyle=goldh;x.font='90px serif';x.textAlign='center';x.fillText('۞',W/2,220);
  x.fillStyle=goldh;x.font='600 64px "Cormorant Garamond",serif';x.fillText('SÜKÛN',W/2,320);
  x.fillStyle='rgba(255,255,255,.55)';x.font='26px sans-serif';x.fillText('TASAVVUFÎ FREKANS & ZİKİR',W/2,368);
  /* içerik */
  x.fillStyle='#efe7d3';x.font='italic 44px "Cormorant Garamond",serif';
  x.fillText('Bugünkü zikrim',W/2,540);
  x.fillStyle=goldh;x.font='600 62px "Cormorant Garamond",serif';
  const zt=lastZikir.length>26?lastZikir.slice(0,25)+'…':lastZikir;
  x.fillText(zt,W/2,620);
  /* istatistik satırı */
  x.font='600 90px sans-serif';x.fillStyle=gold;
  x.fillText('🔥 '+streak,W*.32,800);
  x.fillText(totMin+'′',W*.68,800);
  x.font='28px sans-serif';x.fillStyle='rgba(255,255,255,.6)';
  x.fillText('gün seri',W*.32,850);
  x.fillText('bu hafta',W*.68,850);
  /* muhasebe motifi — nefs muhasebesi günleri altın elmas dizisi olarak mühre işlenir */
  try{
    const MU=muhTemizle(S.get('sukun.muhasebe',{})), md=Object.keys(MU).length;
    if(md>0){
      const last=MU[Object.keys(MU).sort((a,b)=>new Date(b)-new Date(a))[0]];
      const mc=(last&&NEFS[last.i]&&NEFS[last.i].c)||goldh;
      const show=Math.min(md,15), gap=34, x0=W/2-((show-1)*gap)/2;
      x.save(); x.font='22px serif'; x.textAlign='center';
      for(let k=0;k<show;k++){ x.fillStyle=k===show-1?mc:goldh; x.globalAlpha=.55+.45*(k/Math.max(1,show-1)); x.fillText('◆',x0+k*gap,905); }
      x.restore(); x.globalAlpha=1;
      x.fillStyle='rgba(255,255,255,.55)'; x.font='24px sans-serif'; x.textAlign='center';
      x.fillText('🪞 '+md+' gün nefs muhasebesi'+(md>15?' • +'+(md-15):''),W/2,936);
    }
  }catch(e){}
  /* alt söz */
  x.fillStyle='rgba(236,210,126,.85)';x.font='italic 34px "Cormorant Garamond",serif';
  x.fillText('«Kalpler ancak zikrullah ile huzur bulur»',W/2,980);
  return c;
}
async function halShare(){
  try{
    const c=await makeHalCard();
    c.toBlob(async(blob)=>{
      if(!blob)return;
      const file=new File([blob],'sukun-hal-karti.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        try{ await navigator.share({files:[file],title:'SÜKÛN Hâl Kartım'}); return; }catch(e){}
      }
      /* paylaşım yoksa indir */
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='sukun-hal-karti.png';
      document.body.appendChild(a); a.click();
      setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000);
    },'image/png');
  }catch(e){ alert('Hâl kartı oluşturulamadı'); }
}
$('#halBtn') && ($('#halBtn').onclick=halShare);

function lsInsight(){
  const a=logTemizle(S.get('sukun.log',[]));
  const days=new Set(a.map(x=>new Date(x.t).toDateString()));
  let streak=0;
  for(let i=0;;i++){
    const d=new Date(Date.now()-i*864e5).toDateString();
    if(days.has(d))streak++; else break;
  }
  const m={};
  a.forEach(x=>{if(x.mood&&x.detail)(m[x.detail]=m[x.detail]||[]).push(x.mood);});
  let best=null,bv=0;
  Object.entries(m).forEach(([k,v])=>{
    if(v.length>=2){const av=v.reduce((p,c)=>p+c,0)/v.length; if(av>bv){bv=av;best=k;}}
  });
  $('#lsInsight').innerHTML='<b>🔥 Seri: '+streak+' gün</b>'+
    (best?'<span><span class="ico" data-ico="sparkle"></span> Sana en iyi gelen: '+hesc(best)+' ('+bv.toFixed(1)+'/5, '+m[best].length+' seans)</span>'
         :'<span>Seansları puanladıkça «sana en iyi gelen» burada belirir</span>');
  const KIS=['Pz','Pt','Sa','Ça','Pe','Cu','Ct'];
  const bars=[...Array(7)].map((_,i)=>{
    const d0=new Date(); d0.setHours(0,0,0,0); d0.setDate(d0.getDate()-(6-i));
    const t0=d0.getTime(), t1=t0+864e5;
    return {m:Math.round(a.filter(x=>x.t>=t0&&x.t<t1).reduce((p,x)=>p+x.dur,0)/60),l:KIS[d0.getDay()]};
  });
  const mx=Math.max(1,...bars.map(b=>b.m));
  $('#lsBars').innerHTML=bars.map(b=>
   '<div class="lb"><i style="height:'+Math.max(2,Math.round(b.m/mx*38))+'px" title="'+b.m+' dk"></i><s>'+b.l+'</s></div>').join('');
}

/* ── Arka plan ebrusu — SÜKÛN zeminine yaşayan mermer ── */
const BG={c:null,x:null,drops:[],W:0,H:0,last:0};
/* ════ IŞILTI — her temanın kendi renginde, nazikçe parlayıp sönen ışık zerreleri ════
   Tek sade biçim: yumuşak ışık noktası + twinkle (parlaklık dalgalanması).
   Simetri için ekran eşit dilimlere bölünür, her ışıltı kendi diliminden doğar. */
const PART={c:null,x:null,items:[],W:0,H:0,reduced:false,raf:null,t:0};
const PART_COLORS={
 zumrut:['#c9a227','#ecd27e','#efe7d3'],
 gul:   ['#e0899f','#eab4c2','#d9a05f'],
 gece:  ['#7fd4c1','#2e8f7f','#c9a227'],
 col:   ['#e8a967','#c1793a','#3aa6a0'],
 sabah: ['#a9822a','#8a6716','#1e5c4f']
};
function partCol(){ return PART_COLORS[document.body.dataset.tema||'zumrut']||PART_COLORS.zumrut; }
function partMk(x,y){
  const cs=partCol();
  return {x,y,r:rnd(2,4),baseOp:rnd(.3,.62),tw:rnd(1.4,3.2),ph:rnd(0,Math.PI*2),
    dx:rnd(-.045,.045),dy:rnd(-.05,-.018),col:cs[(Math.random()*cs.length)|0]};
}
function partSeed(){
  if(!PART.c)return;
  const N=PART.reduced?4:10;
  PART.items=[];
  const band=PART.W/N;
  for(let i=0;i<N;i++)PART.items.push(partMk(band*i+Math.random()*band, Math.random()*PART.H));
}
function partRespawn(p){ Object.assign(p,partMk(Math.random()*PART.W,PART.H+12)); }
function partLoop(){
  if(!PART.x)return;
  PART.t+=.016;
  PART.x.clearRect(0,0,PART.W,PART.H);
  for(const p of PART.items){
    p.x+=p.dx; p.y+=p.dy;
    if(p.x<-8)p.x=PART.W+8; else if(p.x>PART.W+8)p.x=-8;
    const tw=Math.sin(PART.t*p.tw+p.ph); const op=p.baseOp*(.4+.6*tw*tw);
    const g=PART.x; g.save(); g.globalAlpha=op;
    const rg=g.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3.2);
    rg.addColorStop(0,p.col); rg.addColorStop(1,'transparent');
    g.fillStyle=rg; g.beginPath(); g.arc(p.x,p.y,p.r*3.2,0,Math.PI*2); g.fill(); g.restore();
    if(p.y<-14)partRespawn(p);
  }
}
function partInit(){
  PART.c=document.getElementById('bgParticles'); if(!PART.c)return;
  PART.x=PART.c.getContext('2d');
  PART.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rs=()=>{
    const d=Math.min(devicePixelRatio||1,1.4);
    PART.W=innerWidth; PART.H=innerHeight;
    PART.c.width=Math.round(PART.W*d); PART.c.height=Math.round(PART.H*d);
    PART.x.setTransform(d,0,0,d,0,0);
    partSeed();
  };
  rs(); addEventListener('resize',rs);
  if(!PART.raf)CIZ.ekle('part',partLoop,{el:'ebruC'});
}

function bgInit(){
  BG.c=document.getElementById('bgEbru'); if(!BG.c)return;
  BG.x=BG.c.getContext('2d');
  const rs=()=>{
    const d=Math.min(devicePixelRatio||1,1.4);
    BG.W=innerWidth; BG.H=innerHeight;
    BG.c.width=Math.round(BG.W*d); BG.c.height=Math.round(BG.H*d);
    BG.x.setTransform(d,0,0,d,0,0);
    bgDraw();
  };
  rs(); addEventListener('resize',rs);
}
let BG_PAL=['#0d2b26','#12352e','#0e2a3d','#173043','#175646'];
let EBRU_GOLD='#c9a227';
function bgDrop(){
  if(!BG.x)return;
  const x=rnd(30,BG.W-30), y=rnd(60,BG.H-60), r=rnd(24,60);
  for(const dd of BG.drops){
    const p=dd.p;
    for(let i=0;i<p.length;i+=2){
      const dx=p[i]-x,dy=p[i+1]-y,L2=dx*dx+dy*dy||1e-6,f=Math.sqrt(1+r*r/L2);
      p[i]=x+dx*f; p[i+1]=y+dy*f;
    }
  }
  const N=56,p=new Float32Array(N*2);
  for(let i=0;i<N;i++){
    const a=i/N*2*Math.PI,rr=r*rnd(.96,1.04);
    p[i*2]=x+Math.cos(a)*rr; p[i*2+1]=y+Math.sin(a)*rr;
  }
  const gold=Math.random()<.14;
  BG.drops.push({p,c:gold?EBRU_GOLD:BG_PAL[(Math.random()*BG_PAL.length)|0],s:gold});
  if(BG.drops.length>40)BG.drops.shift();
  bgDraw();
}
function bgDraw(){
  const x=BG.x; if(!x)return;
  x.clearRect(0,0,BG.W,BG.H);
  for(const d of BG.drops){
    const p=d.p;
    x.beginPath(); x.moveTo(p[0],p[1]);
    for(let i=2;i<p.length;i+=2)x.lineTo(p[i],p[i+1]);
    x.closePath();
    if(d.s){x.globalAlpha=.35;x.strokeStyle=d.c;x.lineWidth=1.2;x.stroke();}
    else{x.globalAlpha=.5;x.fillStyle=d.c;x.fill();}
  }
  x.globalAlpha=1;
}
setInterval(()=>{
  if(!ctx||document.hidden)return;/*r414: sadece görsel — ekran kapalıyken gereksiz*/
  const busy=FR.playing||Object.keys(AMB).length||Z.auto||VH.playing;
  if(busy&&Date.now()-BG.last>6500){BG.last=Date.now(); bgDrop();}
},1200);

/* ════ 6e) v1.4 — ESMÂ HATMİ • LETÂİF • RUTİNLER • YEDEK ════ */
/* ── Esmâ Hatmi ── */
const HATIM=(()=>{const x=S.get('sukun.hatim',{}),o=x&&typeof x==='object'&&!Array.isArray(x)?x:{};return {
  idx:Math.round(clamp(Number(o.idx)||0,0,o.done?ZIKIR.esma.items.length:ZIKIR.esma.items.length-1)),count:Math.round(clamp(Number(o.count)||0,0,1000000)),
  mode:['11','33','ebced'].includes(String(o.mode))?String(o.mode):'33',active:false,done:!!o.done,
  startedAt:Number.isFinite(Number(o.startedAt))?Math.max(0,Math.min(Date.now(),Math.floor(Number(o.startedAt)))):0};})();
const hatItem=()=>ZIKIR.esma.items[Math.min(HATIM.idx,ZIKIR.esma.items.length-1)];
const hatTarget=()=>HATIM.mode==='ebced'?ebced(hatItem().a):+HATIM.mode;
function hatSave(){S.set('sukun.hatim',{idx:HATIM.idx,count:HATIM.count,mode:HATIM.mode,done:HATIM.done,startedAt:HATIM.startedAt});}
function hatApply(){
  Z.cat='esma'; Z.idx=HATIM.idx; Z.form='nida'; syncFormSeg();
  Z.target=hatTarget(); Z.count=HATIM.count;
  ensureTargetOpt(Z.target,'Hatim • '+Z.target);
  renderCats(); renderZikir(); zUI(); hatUI();
}
function hatStart(){
  if(HATIM.done){
    if(!confirm('Hatim tamamlanmıştı — yeniden başlansın mı?'))return;
    HATIM.idx=0; HATIM.count=0; HATIM.done=false; HATIM.startedAt=0;
  }
  ltfPause();
  if(!HATIM.startedAt)HATIM.startedAt=Date.now();
  HATIM.active=true; hatApply(); hatSave();
  /* r118: hatimde hangi ismin çekileceği ve kaç kere olduğu belirsizdi */
  try{ zikirAcilisAna('tam',()=>sayacaGit(60)); }catch(e){ sayacaGit(0); }
}
function hatPause(){HATIM.active=false; hatSave(); hatUI();}
function hatAdvance(){
  HATIM.idx++; HATIM.count=0;
  try{ secmeSesi(); tozSac(); }catch(e){}      /* r139: isim geçişi işareti */
  if(HATIM.idx>=ZIKIR.esma.items.length){hatFinish();return;}
  /* ⚠ KISA kip — 99 isim var; her birinde tam tören yapmak eşiği
     gürültüye çevirirdi. Yalnız «isim değişti» işareti. */
  try{ setTimeout(()=>zikirAcilisAna('kisa',()=>{}),60); }catch(e){}
  hatApply(); hatSave();
}
function hatFinish(){
  HATIM.active=false; HATIM.done=true; HATIM.idx=ZIKIR.esma.items.length;
  const el=Math.max(60,Math.round((Date.now()-(HATIM.startedAt||Date.now()))/1000));
  LOG.push({t:Date.now(),dur:el,detail:'🕋 Esmâ Hatmi tamam — 99 isim ✦'});
  try{navigator.vibrate&&navigator.vibrate([120,80,120,80,220])}catch(e){}
  hatSave(); hatUI();
  /* r120: hatim bitişi eski yoldaydı — Hû ve görsel işaret yoktu */
  try{ zikirSonuSes(); }catch(e){}
  try{ zikirTamam('Esmâ Hatmi tamam','99 ismin seyri bitti ✦'); }catch(e){}
}
function hatUI(){
  const N=ZIKIR.esma.items.length;
  const t=HATIM.done?1:hatTarget();
  $('#hatStat').innerHTML=HATIM.done
    ?'<b>✓ Hatim tamam</b> — 99 ismin seyri bitti; ↺ ile yeni bir hatme başlayabilirsin'
    :'İsim <b>'+(HATIM.idx+1)+'/'+N+'</b> • <b>Yâ '+hatItem().t+'</b> • bu isimde '+HATIM.count+'/'+t
     +(HATIM.active?'':' <i style="color:var(--dim)">(duraklatıldı — ▶ ile sürdür)</i>');
  const pct=HATIM.done?100:((HATIM.idx+HATIM.count/Math.max(1,t))/N*100);
  $('#hatBarI').style.width=pct.toFixed(1)+'%';
  let cells='';
  for(let i=0;i<N;i++)cells+='<span class="'+(HATIM.done||i<HATIM.idx?'d':(HATIM.active&&i===HATIM.idx?'a':''))+'"></span>';
  $('#hatCells').innerHTML=cells;
  const hatGoBtn=$('#hatGo');
  hatGoBtn.textContent=HATIM.active?'⏸ Duraklat':((HATIM.idx>0||HATIM.count>0)&&!HATIM.done?'▶ Devam Ettir':'▶ Başla');
  hatGoBtn.classList.toggle('aktif-dur',HATIM.active);   /* r126: kırmızı-nabız — çalışıyor */
  hatGoBtn.title=HATIM.active
    ?'Aynı düğme — duraklat / sürdür'
    :'Hatmi başlat veya kaldığın yerden devam et';
  $('#hatMode').value=HATIM.mode;
}
$('#hatGo').onclick=()=>HATIM.active?hatPause():hatStart();
$('#hatRst').onclick=()=>{
  if(!confirm('Hatim ilerlemesi sıfırlansın mı?'))return;
  HATIM.idx=0;HATIM.count=0;HATIM.active=false;HATIM.done=false;HATIM.startedAt=0;
  hatSave();hatUI();
};
$('#hatMode').addEventListener('change',e=>{
  HATIM.mode=e.target.value;
  if(HATIM.active){HATIM.count=Math.min(HATIM.count,hatTarget()-1); hatApply();}
  else hatUI();
  hatSave();
});
function hatInit(){hatUI();}

/* ── Letâif Seyri — Nakşî-Müceddidî tertibi ── */
