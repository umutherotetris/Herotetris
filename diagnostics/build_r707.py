from pathlib import Path
import re,json,hashlib,zipfile,difflib,shutil
from bs4 import BeautifulSoup
base=Path('/mnt/data/sukun_r707_work')
source=Path('/mnt/data/SUKUN_r706_TAM_PAKET.zip')
with zipfile.ZipFile(source) as z:
    original=z.read('nero.html').decode('utf-8')
html=original

def replace_script(id, transform):
    global html
    pat=r'(<script\b[^>]*\bid="'+re.escape(id)+r'"[^>]*>)([\s\S]*?)(</script>)'
    m=re.search(pat,html)
    assert m,id
    new=transform(m.group(2))
    html=html[:m.start(2)]+new+html[m.end(2):]
    (base/'diagnostics'/f'{id}-r707.js').write_text(new)

def one(s,a,b):
    assert s.count(a)==1,(a[:80],s.count(a))
    return s.replace(a,b,1)

def layout(s):
    s=one(s,"const VERSION='r706'","const VERSION='r707'")
    s=one(s,"if(!B.classList.contains('r699-layout'))B.classList.add('r699-layout');","if(!B.classList.contains('r699-layout'))B.classList.add('r699-layout');if(!B.classList.contains('r707-scroll'))B.classList.add('r707-scroll');")
    s=one(s,"function naturalHeight(shell,body,footer,grip){const cs=getComputedStyle(shell);const pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0),gap=parseFloat(cs.rowGap)||0;const gh=grip?.getBoundingClientRect().height||0,fh=footer?.getBoundingClientRect().height||0;const bh=body?.scrollHeight||0;return Math.ceil(pad+gh+fh+bh+gap*2)}",'''function naturalHeight(shell,body,footer,grip){
 const cs=getComputedStyle(shell),pad=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0),gap=parseFloat(cs.rowGap)||0;
 const gh=grip?.getBoundingClientRect().height||0,fh=footer?.getBoundingClientRect().height||0;
 // Measure intrinsic content, not the height left over by an old fixed grid.
 let bh=body?.scrollHeight||0;
 if(body){const r=body.getBoundingClientRect();for(const child of body.children){const c=getComputedStyle(child);if(c.display==='none'||c.position==='absolute'||c.position==='fixed')continue;const cr=child.getBoundingClientRect();bh=Math.max(bh,cr.bottom-r.top+body.scrollTop+(parseFloat(c.marginBottom)||0));}}
 return Math.ceil(pad+gh+fh+Math.max(0,bh)+gap*2);
}''')
    s=one(s,"const changedMode=modeLast!==m;if(changedMode){if(body.scrollTop){body.scrollTop=0;scrollResets++}modeLast=m}","const changedMode=modeLast!==m;if(changedMode)modeLast=m; // Native scroll clamps only if the new content is shorter.")
    s=one(s,"const cap=Math.max(1,v.height-bottom-16);let need=0,desired=0;","const priorScrollTop=body.scrollTop;const cap=Math.max(1,v.height-bottom-16);let need=0,desired=0;")
    s=one(s,"B.classList.toggle('r699-body-scroll',!drawer&&need>desired+2);B.classList.toggle('r699-overflow',!drawer&&need>desired+2);",'''const actualOverflow=!drawer&&body.scrollHeight>body.clientHeight+2;
 B.classList.toggle('r699-body-scroll',actualOverflow);B.classList.toggle('r699-overflow',actualOverflow);''')
    s=one(s,"B.classList.toggle('r699-overflow',actualOverflow);","B.classList.toggle('r699-overflow',actualOverflow);\n // Preserve the user's reading position across a mode switch; let native bounds clamp it.\n if(changedMode&&!drag&&Math.abs(body.scrollTop-priorScrollTop)>.5)body.scrollTop=Math.min(priorScrollTop,Math.max(0,body.scrollHeight-body.clientHeight));")
    # The reading surface is now a normal document flow. Do not use a viewport-sized
    # clipping budget based on the top edge of the player.
    s=one(s,"r706Style(root.style,'--r699-card-budget',px(cardH));","r706Style(root.style,'--r699-card-budget',px(cardH));")
    s=one(s,"B.classList.remove('r699-dock-active');r706Style(root.style,'--r699-content-reserve'","B.classList.remove('r699-dock-active','r699-body-scroll','r699-overflow');r706Style(root.style,'--r699-content-reserve'")
    # Preserve the previous shell accessibility state instead of resetting a separate owner.
    s=one(s,"let modalTrigger=null,modalKind='',focusGuard=false;","let modalTrigger=null,modalKind='',focusGuard=false,modalShellState=null;")
    s=one(s,"const shell=$('r588DockShell');if(shell){shell.inert=open;if(open)shell.setAttribute('aria-hidden','true');else shell.removeAttribute('aria-hidden')}",'''const shell=$('r588DockShell');if(shell){
  if(open&&!modalShellState){modalShellState={inert:shell.inert,aria:shell.getAttribute('aria-hidden')};shell.inert=true;shell.setAttribute('aria-hidden','true')}
  else if(!open&&modalShellState){shell.inert=modalShellState.inert;if(modalShellState.aria===null)shell.removeAttribute('aria-hidden');else shell.setAttribute('aria-hidden',modalShellState.aria);modalShellState=null}
 }''')
    # A late drawer close must not leave a backdrop or the shell inert.
    s=one(s,"else if(modalKind==='drawer'){modalKind='';try{modalTrigger?.focus?.({preventScroll:true})}catch(_){ }modalTrigger=null}","else if(modalKind==='drawer'){modalKind='';try{modalTrigger?.isConnected&&modalTrigger.focus?.({preventScroll:true})}catch(_){ }modalTrigger=null}")
    # A frame should not be queued solely to clean up a hidden page.
    s=one(s,"function schedule(why='event'){reason=why;if(document.hidden)return;","function schedule(why='event'){reason=why;if(document.hidden)return;")
    return s
replace_script('r633-flow-dock-placement-runtime',layout)

# The existing viewport helper is a separate source of delayed scroll jumps:
# suppress() used to veto explicit user navigation, and preserve() restored a
# stale document position after the user had begun a new gesture.
def viewport(s):
    s=one(s,"if(t<suppressUntil)return{ok:false,reason:suppressReason||'suppressed'};\n  if(explicitDepth>0)return{ok:true,reason:'explicit'};", "if(explicitDepth>0)return{ok:true,reason:'explicit'};\n  if(t<userIntentUntil)return{ok:true,reason:userReason||'user'};\n  if(t<suppressUntil)return{ok:false,reason:suppressReason||'suppressed'};")
    s=one(s,"  if(t<userIntentUntil)return{ok:true,reason:userReason||'user'};\n  return{ok:false,reason:'background'};", "  return{ok:false,reason:'background'};")
    s=one(s,"  suppress(ms,opt.reason||'preserve-scroll');", "  suppress(ms,opt.reason||'preserve-scroll');\n  const intentAtStart=userIntentUntil;")
    s=one(s,"  const restore=()=>{\n    if(anchor?.isConnected", "  const restore=()=>{\n    if(userIntentUntil>intentAtStart)return;\n    if(anchor?.isConnected")
    return s
replace_script('r508-viewport-policy',viewport)

# Retire the remaining window-level touchmove handlers for the carrier knob.
# Pointer capture owns this one control; movement elsewhere never cancels scroll.
def core(s):
    start=s.index('function knobKur(){')
    end=s.index("$('#carSld').addEventListener",start)
    old=s[start:end]
    new=old
    new=one(new,"let suruklu=false, baslangicY=0, baslangicX=0, baslangicOran=0;", "let suruklu=false, aktifPointer=null, baslangicY=0, baslangicX=0, baslangicOran=0;")
    new=one(new,"    suruklu=true;\n    baslangicY=(e.touches?e.touches[0].clientY:e.clientY);\n    baslangicX=(e.touches?e.touches[0].clientX:e.clientX);", "    if(e.isPrimary===false||e.pointerType==='mouse'&&e.button!==0)return;\n    suruklu=true;aktifPointer=e.pointerId;\n    baslangicY=e.clientY;baslangicX=e.clientX;\n    try{k.setPointerCapture(e.pointerId)}catch(_){}")
    new=one(new,"    if(!suruklu)return;\n    const y=(e.touches?e.touches[0].clientY:e.clientY);", "    if(!suruklu||e.pointerId!==aktifPointer)return;\n    const y=e.clientY;")
    new=one(new,"const dx=(e.touches?e.touches[0].clientX:e.clientX)-baslangicX;", "const dx=e.clientX-baslangicX;")
    new=one(new,"  const bitir=()=>{ if(suruklu){suruklu=false; if(typeof saveSettings==='function')saveSettings();} };\n  k.addEventListener('mousedown',bas);\n  k.addEventListener('touchstart',bas,{passive:false});\n  window.addEventListener('mousemove',hareket);\n  window.addEventListener('touchmove',hareket,{passive:false});\n  window.addEventListener('mouseup',bitir);\n  window.addEventListener('touchend',bitir);", "  const bitir=e=>{if(!suruklu||e.pointerId!==aktifPointer)return;suruklu=false;aktifPointer=null;try{k.releasePointerCapture(e.pointerId)}catch(_){}if(typeof saveSettings==='function')saveSettings()};\n  k.style.touchAction='none';\n  k.addEventListener('pointerdown',bas);\n  k.addEventListener('pointermove',hareket,{passive:false});\n  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>k.addEventListener(ev,bitir));")
    return s[:start]+new+s[end:]
replace_script('r514-core-zikir-sentez',core)

# In the final cascade, restore one document scroller and actual dock scrolling.
css='''/* r707 — native scroll / hit-test boundary. No new visual or audio owner. */
html:has(body.r707-scroll.sukun-tefekkur-mode){height:auto!important;overflow-x:clip!important;overflow-y:auto!important;overscroll-behavior-y:auto!important}
html body.r707-scroll.sukun-tefekkur-mode{position:relative!important;inset:auto!important;height:auto!important;min-height:100dvh!important;max-height:none!important;overflow-x:clip!important;overflow-y:auto!important;overscroll-behavior-y:auto!important;touch-action:auto!important}
html body.r707-scroll.sukun-tefekkur-mode :is(main,.wrap){position:relative!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;contain:none!important}
html body.r707-scroll.sukun-tefekkur-mode #tab-zkr{position:relative!important;inset:auto!important;display:block!important;width:100%!important;height:auto!important;min-height:100dvh!important;max-height:none!important;margin:0!important;padding:8px clamp(8px,2.4vw,14px) var(--r699-content-reserve)!important;overflow:visible!important;overscroll-behavior-y:auto!important;touch-action:pan-y pinch-zoom!important;scrollbar-gutter:auto!important}
html body.r707-scroll.sukun-tefekkur-mode #tab-zkr>.card.zCtl{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;contain:none!important;padding-bottom:8px!important}
html body.r707-scroll.sukun-tefekkur-mode #tab-zkr>#zStage{height:auto!important;max-height:none!important;overflow:visible!important}
html body.r707-scroll.sukun-tefekkur-mode #tfRefinedLayout,html body.r707-scroll.sukun-tefekkur-mode #tfRefinedLayout>.tfVisualPanel,html body.r707-scroll.sukun-tefekkur-mode #tfRefinedLayout>.tfControlPanel{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
/* The body scrolls naturally, while the player remains a bounded fixed surface. */
html body.r707-scroll #r588DockShell>#r659DockBody,html body.r707-scroll.r588-mode-max #r588DockShell>#r659DockBody,html body.r707-scroll.r588-mode-midi #r588DockShell>#r659DockBody,html body.r707-scroll.r699-measuring #r588DockShell>#r659DockBody{min-height:0!important;max-height:none!important;touch-action:pan-y pinch-zoom!important;-webkit-overflow-scrolling:touch!important}
html body.r707-scroll:not(.r699-measuring) #r588DockShell>#r659DockBody{overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:auto!important}
html body.r707-scroll.r699-measuring #r170Now.r588-authority{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important}
html body.r707-scroll.r699-measuring #r588DockShell{height:auto!important;grid-template-rows:auto auto auto!important;overflow:visible!important}
html body.r707-scroll.r699-measuring #r588DockShell>#r659DockBody{height:auto!important;max-height:none!important;overflow:visible!important;align-self:start!important}
/* One bounded grid track owns the player scrollport. Retired Max rules may not expand it to intrinsic content height. */
html body.r707-scroll.r699-layout #r170Now.r588-authority #r588DockShell{display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important}
html body.r707-scroll.r699-layout:not(.r699-measuring) #r170Now.r588-authority #r588DockShell>#r659DockBody{display:block!important;height:100%!important;overflow-anchor:none!important;min-height:0!important;max-height:100%!important;align-self:stretch!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-y:auto!important;touch-action:pan-y pinch-zoom!important}
html body.r707-scroll.r699-layout.r699-measuring #r170Now.r588-authority #r588DockShell{height:auto!important;min-height:0!important;max-height:none!important;grid-template-rows:auto auto auto!important;overflow:visible!important}
html body.r707-scroll.r699-layout.r699-measuring #r170Now.r588-authority #r588DockShell>#r659DockBody{height:auto!important;min-height:0!important;max-height:none!important;align-self:start!important;overflow:visible!important}
/* Decorations cannot become invisible shields. All modal surfaces retain their own explicit hit tests. */
html body.r707-scroll :is(#r706Atmosphere,#r706Smoke,#r706Orbit,.r706Arch,.r706Lightfall,.r706Ticks,.r706Arc,.r706Pearl,.r706Satellite,#breathHalo,#nameToastLayer,.r501OverflowMark){pointer-events:none!important}
html body.r707-scroll #r588DockShell :is(#r588Play,#r588Stop,#r588Hide,[data-r588-mode]),html body.r707-scroll #r433DockPeek,html body.r707-scroll #tefExitBtn{pointer-events:auto!important;touch-action:manipulation!important}
html body.r707-scroll #r588DockShell>#r633DockGrip{touch-action:none!important;pointer-events:auto!important}
html body.r707-scroll #r588DockShell .r588Actions{height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;align-content:start!important}
html body.r707-scroll #r588DockShell .r588Actions .r588Action{height:auto!important;min-height:44px!important;max-height:none!important;flex-shrink:0!important}
/* r698's fixed 36px Max action row was defeating the later intrinsic layout. */
html body.r707-scroll.r698-ui.r588-mode-max #r588DockShell .r588Actions{display:flex!important;flex-wrap:wrap!important;align-items:center!important;height:auto!important;min-height:44px!important;max-height:none!important;overflow:visible!important}
html body.r707-scroll.r698-ui.r588-mode-max #r588DockShell .r588Actions .r588Action{height:auto!important;min-height:44px!important;max-height:none!important;flex-shrink:0!important}
/* The canonical exit must not depend on the optional r697 visual-theme class. */
html body.r707-scroll.sukun-tefekkur-mode #tfRefinedLayout .tfStatusRow>.tfExitRow{display:flex!important;align-items:center!important;justify-content:flex-end!important;min-height:44px!important;height:auto!important;max-height:none!important;overflow:visible!important;pointer-events:auto!important}
html body.r707-scroll #r588DockShell>.r588Mode{min-width:0!important;max-width:100%!important;grid-template-columns:minmax(0,1fr) auto 44px!important;gap:4px!important}
html body.r707-scroll #r588DockShell .r588Transport{grid-template-columns:repeat(2,44px)!important}
html body.r707-scroll #r588DockShell .r588ModeSeg button,html body.r707-scroll #r588DockShell .r588Transport button,html body.r707-scroll #r588Hide{min-height:44px!important;height:44px!important;touch-action:manipulation!important}
html body.r707-scroll #r588DockShell .r588Transport button,html body.r707-scroll #r588Hide{width:44px!important;min-width:44px!important;max-width:44px!important}
html body.r707-scroll.sukun-tefekkur-mode #tfRefinedLayout :is(#autoBtn,#undoBtn,#plusBtn,#tefExitBtn,.r494NavBtn){min-height:44px!important;touch-action:manipulation!important}
html body.r707-scroll #r677DetailsBackdrop{display:none!important;pointer-events:none!important}
html body.r707-scroll.r434-inline-details-open #r677DetailsBackdrop{display:block!important;pointer-events:auto!important}
html body.r707-scroll #r699ModalBackdrop[hidden],html body.r707-scroll #r434InlineDetails[hidden],html body.r707-scroll #r554AlertDrawer[hidden]{display:none!important;pointer-events:none!important}
html body.r707-scroll #r699ModalBackdrop:not([hidden]){pointer-events:auto!important}
html body.r707-scroll.r434-inline-details-open>#r434InlineDetails.r677-details-portal{max-height:min(72dvh,560px)!important;overflow:hidden!important}
html body.r707-scroll.r434-inline-details-open>#r434InlineDetails.r677-details-portal>#r674DetailsScroll{min-height:0!important;overflow-y:auto!important;touch-action:pan-y pinch-zoom!important}
html body.r707-scroll #r554DrawerList,html body.r707-scroll #calanSayfa:not([hidden]){overflow-y:auto!important;touch-action:pan-y pinch-zoom!important}
html body.r707-scroll #r674DetailsScroll input[type=range],html body.r707-scroll #r659DockBody input[type=range]{touch-action:pan-y!important}
/* Explicit short-screen fallback: preserve the approved two-column layout. */
@media(max-height:480px) and (orientation:landscape){html body.r707-scroll.sukun-tefekkur-mode #tab-zkr{min-height:100dvh!important;padding-bottom:var(--r699-content-reserve)!important}html body.r707-scroll #r588DockShell>.r588Mode{gap:3px!important}html body.r707-scroll #r588DockShell>#r633DockGrip{height:40px!important;min-height:40px!important;max-height:40px!important}}
@media(prefers-reduced-motion:reduce){html body.r707-scroll #r588DockShell *,html body.r707-scroll #tfRefinedLayout *{scroll-behavior:auto!important}}
'''
# The previous absolute-positioned atmospheric artwork remains untouched.
# Add this last so no historical !important layout rule can reintroduce the lock.
html=one(html,'</body>','<style id="r707-scroll-hit-test-authority">\n'+css+'</style>\n</body>')
(base/'diagnostics/style-r707-scroll-hit-test-authority.css').write_text(css)

# Release metadata: only global release identifiers, not historical notes or API names.
html=one(html,'name="sukun-build" content="r706"','name="sukun-build" content="r707"')
html=html.replace('manifest.webmanifest?v=r706','manifest.webmanifest?v=r707')
# Read the exact present metadata rather than blindly replacing historical r706 strings.
soup=BeautifulSoup(html,'html.parser')
notes=json.loads(soup.find('script',id='surumNotlari').string)
newnote={'v':'r707','t':'Kaydırma ve Dokunma Kararlılığı','b':[
 'Tefekkürün belge kaydırması serbest bırakıldı; sabit ekran ve kart yüksekliği kilitleri kaldırıldı. Neon atmosfer ve mevcut gerçek kontrol sahipleri korundu.',
 'Mini/Midi/Max geçişlerinde dock kaydırması zorla sıfırlanmaz. İçerik taşması gerçek scrollHeight/clientHeight ile değerlendirilir; scroll yüzeyi tahmini yüksekliğe göre kapatılmaz.',
 'Eski frekans düğmesinin pencere düzeyindeki touchmove yakalaması pointer capture ile sınırlandı. Görünmez dekor ve kapalı modal hit-test kuralları güçlendirildi.',
 'Bildirim modalı kapanınca önceden mevcut olan inert/aria-hidden durumu geri yüklenir. Açık detay ve bildirimlerin kaydırma sahipliği korunur.',
 'Kaydırma korumasında gerçek kullanıcı hareketi ve açıkça istenen navigasyon önceliklidir; gecikmiş konum geri yüklemesi yeni kullanıcı kaydırmasını geri alamaz.',
 'Ses, kayıt, sayaç ve seyir motorları değiştirilmedi. Kaynak/izole testler tamamlandı; gerçek Android dokunma, kilit ekranı ve duyulan ses doğrulaması ayrıca gereklidir.'
]}
notes.insert(0,newnote)
inline=json.dumps(notes,ensure_ascii=False,indent=2)
m=re.search(r'(<script\b[^>]*\bid="surumNotlari"[^>]*>)([\s\S]*?)(</script>)',html)
assert m
html=html[:m.start(2)]+'\n'+inline+'\n'+html[m.end(2):]
(base/'nero.html').write_text(html)
(base/'surumler.json').write_text(inline+'\n')

with zipfile.ZipFile(source) as z:sw=z.read('sw.js').decode('utf-8')
sw=one(sw,"const SURUM = 'r706';","const SURUM = 'r707';")
sw=one(sw,"const CACHE = 'sukun-r706-20260907a';","const CACHE = 'sukun-r707-20260907a';")
sw=one(sw,"const BUILD_MARKER='./__sukun_build_r706__.json';","const BUILD_MARKER='./__sukun_build_r707__.json';")
sw=sw.replace('/* SÜKÛN r706 — Living Neon Atmosphere */','/* SÜKÛN r707 — Native Scroll and Hit-Test Stability */',1)
notem=re.search(r'const NOTLAR = (\[[\s\S]*?\]);\n',sw)
assert notem
sw=sw[:notem.start(1)]+notem.group(1).replace('[', '[\n  '+json.dumps('r707 · Belge kaydırması, gerçek dock taşması, kullanıcı kaydırma önceliği ve tek frekans gesture sahibi düzeltildi. Ses/seyir motorları korunur.',ensure_ascii=False)+',',1)+sw[notem.end(1):]
(base/'sw.js').write_text(sw)
with zipfile.ZipFile(source) as z:manifest=json.loads(z.read('manifest.webmanifest'))
manifest['start_url']=manifest['start_url'].replace('v=r706','v=r707')
for shortcut in manifest.get('shortcuts',[]):shortcut['url']=shortcut['url'].replace('v=r706','v=r707')
(base/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(base/'__sukun_build_r707__.json').write_text(json.dumps({'build':'r707','date':'2026-09-07','feature':'native-scroll-hit-test-stability','base':'r706'},indent=2)+'\n')
(base/'__sukun_build_r706__.json').unlink(missing_ok=True)
# Keep source diff for a focused, reversible release review.
(base/'diagnostics/r707_changes.diff').write_text(''.join(difflib.unified_diff(original.splitlines(True),html.splitlines(True),fromfile='r706/nero.html',tofile='r707/nero.html')))
print('Patched',len(html),'bytes. r707 source ready.')
