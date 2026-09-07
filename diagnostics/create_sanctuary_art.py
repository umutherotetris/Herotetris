from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import math, random
P=Path(__file__).resolve().parents[1]
W,H=768,1280
# Original generated artwork is used as material; the interface, text and counters
# are never rasterized into the application's working surface.
source=Image.open('/mnt/data/a_mystical_cinematic_neon_glow_mobile_app_ui_scr.png').convert('RGB')
scene=source.crop((302,0,663,346)).resize((768,735),Image.Resampling.LANCZOS)
base=Image.new('RGB',(W,H));px=base.load()
for y in range(H):
 for x in range(W):
  a=y/H; radial=max(0,1-abs(x-W/2)/(W*.63));
  px[x,y]=(int(3+5*radial),int(13+20*(1-a)*radial),int(24+25*(1-a)))
# Broad feathered photo layer, no text or control pixels.
mask=Image.new('L',(W,735));m=mask.load()
for y in range(735):
 for x in range(W):
  edge=min(1,x/55,(W-1-x)/55);fade=min(1,(735-y)/180)
  m[x,y]=int(255*max(0,edge)*max(0,fade))
base.paste(scene,(0,0),mask)
# Dervish is extracted from the approved visual concept, omitting the old ring.
derv=Image.open('/mnt/data/neon_sükûn_tefekkür_uygulaması.png').convert('RGB').crop((148,592,282,935))
derv=derv.resize((250,640),Image.Resampling.LANCZOS)
mask=Image.new('L',derv.size);m=mask.load()
for y in range(derv.height):
 for x in range(derv.width):
  edge=min(1,x/25,(derv.width-1-x)/95,y/55,(derv.height-1-y)/80)
  m[x,y]=int(145*max(0,edge))
base.paste(derv,(-22,485),mask)
# Deep blue-green reflective floor and restrained mist, rather than a flat fill.
veil=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(veil,'RGBA')
random.seed(709)
for i in range(100):
 y=random.randrange(650,H);x=random.randrange(-100,W+100)
 length=random.randrange(16,175);alpha=int(5+24*(y-650)/(H-650))
 d.line((x,y,x+length,y),fill=(32,174,160,alpha),width=random.choice([1,1,2]))
for i in range(17):
 y=random.randrange(500,H);x=random.randrange(-200,W+200);w=random.randrange(180,550)
 d.ellipse((x,y,x+w,y+random.randrange(50,160)),fill=random.choice([(13,112,113,13),(45,95,150,12),(10,160,113,10)]))
veil=veil.filter(ImageFilter.GaussianBlur(20));base=Image.alpha_composite(base.convert('RGBA'),veil)
# A subtle edge vignette keeps real text readable on all viewports.
v=Image.new('RGBA',(W,H));vp=v.load()
for y in range(H):
 for x in range(W):
  rx=abs(x-W/2)/(W/2);ry=y/H
  alpha=int(min(110,10+36*rx*rx+45*max(0,ry-.45)))
  vp[x,y]=(2,7,16,alpha)
base=Image.alpha_composite(base,v).convert('RGB')
out=P/'assets';out.mkdir(exist_ok=True)
base.save(out/'tefekkur-sanctuary.webp','WEBP',quality=87,method=6)
base.resize((384,640),Image.Resampling.LANCZOS).save(out/'tefekkur-sanctuary-preview.jpg','JPEG',quality=72,optimize=True)
print('scene:',(out/'tefekkur-sanctuary.webp').stat().st_size)
