"""Regenerate the optional Ottoman chess atlas with Blender 4.3 (no add-ons).
  blender -b -t 6 --python design/render-ottoman-chess-v162.py -- /tmp/hero-ottoman
  python design/pack-ottoman-chess-v162.py /tmp/hero-ottoman assets/chess-ottoman-3d-v162.webp
The same scene is rendered twice with only palette replacement for each piece.
"""
import bpy
from mathutils import Vector
from math import cos, sin, pi, radians
from pathlib import Path
import sys

OUT = Path(sys.argv[sys.argv.index('--') + 1])
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 72
scene.cycles.use_denoising = False
scene.render.resolution_x = scene.render.resolution_y = 144
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .38
scene.world.color = (.19, .19, .19)

def linear(v):
    return v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4

def rgb(h):
    return tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4)) + (1,)

def mat(name, h, metal=.15, rough=.33, relief=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    node=m.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value=rgb(h)
    node.inputs['Metallic'].default_value=metal
    node.inputs['Roughness'].default_value=rough
    if relief:
        tex=m.node_tree.nodes.new('ShaderNodeTexNoise')
        tex.inputs['Scale'].default_value=35
        tex.inputs['Detail'].default_value=2.0
        bump=m.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=relief
        bump.inputs['Distance'].default_value=.035
        m.node_tree.links.new(tex.outputs['Fac'],bump.inputs['Height'])
        m.node_tree.links.new(bump.outputs['Normal'],node.inputs['Normal'])
    return m

G=mat('Hand-polished gilding','c8913d',.70,.25,.12)
L=mat('Highlights in gilding','f7cc6e',.58,.21,.08)
D=mat('Patinated bronze','63411d',.52,.39)
I=mat('Bone / carved temple ivory','e4ccb0',.13,.33,.17)
B=mat('Supports / sculpture surface','dcbe93',.25,.32,.22)
C=mat('Leather and lacquer','106052',.25,.37,.21)
E=mat('Secondary enamel / clothing','23557c',.30,.28,.12)
F=mat('Painted complexion','d0a476',.1,.44)
T=mat('Tempered steel','88929b',.62,.29)
Q=mat('Recesses and leather','171318',.21,.52)
R=mat('Court red pennant','8e1f21',.18,.36)
ROYAL=mat('Imperial brocade','542c23',.24,.42,.19)
H=mat('Mane or hair','4d3c2d',.22,.42)
CAM=Vector((3.7,-10,4.8))
bpy.ops.object.camera_add(location=CAM)
cam=bpy.context.object
cam.data.type='ORTHO'
scene.camera=cam

def light(label, loc, energy, color, size):
    bpy.ops.object.light_add(type='AREA',location=loc)
    l=bpy.context.object; l.name=label
    l.data.energy=energy; l.data.color=color; l.data.shape='DISK'; l.data.size=size
    l.rotation_euler=(Vector((0,0,.85))-l.location).to_track_quat('-Z','Y').to_euler()

light('Warm gallery key',(-3.5,-4,5.5),440,(1,.88,.74),4)
light('Sky fill',(3.5,-2,4),220,(.63,.81,1),3.5)
light('Gilded edge',(2,3,4.5),465,(1,.76,.46),3)
light('Front bounce',(0,-3,2),45,(1,1,1),3)

PARTS=[]
def save(o,m,smooth=True):
    o.data.materials.append(m)
    if smooth and o.type=='MESH':
        for p in o.data.polygons: p.use_smooth=True
    PARTS.append(o)
    return o

def ell(m,at,s,rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=at)
    o=bpy.context.object;o.scale=s
    if rot: o.rotation_euler=rot
    return save(o,m)

def box(m,at,s,rot=None,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=at)
    o=bpy.context.object;o.dimensions=s
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if rot: o.rotation_euler=rot
    if bevel:
        be=o.modifiers.new('Crafted edges','BEVEL');be.width=bevel;be.segments=2
        o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL')
    return save(o,m,False)

def lathe(m,at,profile,aspect=1,steps=32):
    vv=[(at[0]+rr*cos(i*2*pi/steps),at[1]+rr*sin(i*2*pi/steps)*aspect,at[2]+z)
        for z,rr in profile for i in range(steps)]
    ff=[tuple(reversed(range(steps)))]
    for j in range(len(profile)-1):
        ff.extend((j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i) for i in range(steps))
    ff.append(tuple((len(profile)-1)*steps+i for i in range(steps)))
    me=bpy.data.meshes.new(m.name);me.from_pydata(vv,[],ff);me.update()
    o=bpy.data.objects.new(m.name,me);scene.collection.objects.link(o)
    save(o,m)
    o.data.polygons[0].use_smooth=False
    o.data.polygons[-1].use_smooth=False
    return o

def rod(m,a,b,r1,r2=None,verts=12):
    a,b=Vector(a),Vector(b); d=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r1 if r2 is None else r2,depth=d.length,location=(a+b)/2)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return save(o,m)

def line(m, points, width=.013, taper=None):
    curve=bpy.data.curves.new(m.name,'CURVE')
    curve.dimensions='3D';curve.resolution_u=8
    curve.bevel_depth=width;curve.bevel_resolution=2;curve.use_fill_caps=True
    sp=curve.splines.new('POLY');sp.points.add(len(points)-1)
    for j,(p, co) in enumerate(zip(sp.points,points)):
        p.co=(*co,1);p.radius=taper[j] if taper else 1
    o=bpy.data.objects.new(m.name,curve);scene.collection.objects.link(o)
    return save(o,m)

def band(m,z,r,w=.026,at=(0,0,0),asp=1):
    return lathe(m,at,[(z-w,r*.975),(z-w*.67,r),(z+w*.4,r),(z+w,r*.975)],asp)

def crest(at=(0,0,0),size=.10,m=G):
    x,y,z=at
    a=[(x+dx*size,y,z+dz*size) for dx,dz in ((0,1),(.47,.38),(1,0),(.46,-.38),(0,-1),(-.47,-.38),(-1,0),(-.46,.38),(0,1))]
    line(m,a,size*.103)
    ell(L,at,(size*.22,size*.11,size*.22))

def plinth(radius=.46,aspect=.78):
    lathe(D,(0,0,0),[(0,radius*.91),(.025,radius),(.225,radius)],aspect)
    lathe(C,(0,0,0),[(.054,radius*1.014),(.079,radius*1.018),(.17,radius),(.19,radius*.95)],aspect)
    for z,r,w in [(.034,radius*1.018,.015),(.185,radius,.021),(.239,radius*.86,.014)]:
        band(G,z,r,w,asp=aspect)
    lathe(B,(0,0,0),[(.197,radius*.91),(.232,radius*.86),(.249,radius*.80)],aspect)
    for j in range(20):
        k=j*pi/10
        r=radius*.998
        if sin(k)<.45:
            z=.115
            x=r*cos(k);y=r*sin(k)*aspect
            ell(G,(x,y,z),(.019,.017,.026),(0,0,k))
            ell(L,(x,y,z+.035),(.013,.011,.011))

def spear(x,y,z,h,head='blade'):
    rod(D,(x,y,z),(x,y,z+h-.08),.019,.014)
    for dz in (h*.22,h*.58,h-.13):
        band(G,dz,.028,.012,(x,y,z))
    if head=='blade':
        lathe(G,(x,y,z+h-.09),[(0,.02),(.09,.055),(.175,0.001)],steps=8)
    else:
        ell(G,(x,y,z+h-.06),(.055,.045,.067))
        lathe(L,(x,y,z+h),[(0,.03),(.085,.002)],steps=10)

def stone_tower():
    plinth(.45,.82)
    body=[(.25,.35),(.36,.32),(.49,.29),(1.11,.255),(1.20,.29),(1.34,.37),(1.43,.365)]
    lathe(B,(0,0,0),body)
    for z,r,w,m in [(.31,.36,.022,G),(.41,.317,.026,B),(1.18,.29,.024,D),(1.235,.34,.027,G),(1.314,.374,.034,B),(1.414,.376,.020,G)]:
        band(m,z,r,w)
    for j,z in enumerate((.50,.60,.70,.80,.90,1.00,1.10)):
        r=.307-(z-.5)*.065
        band(D,z,r,.003)
        for k in range(11):
            a=2*pi*(k+j*.5)/11
            if sin(a)<.18:
                x,y=r*cos(a),r*sin(a)
                line(D,[(x,y,z+.01),(x*.977,y*.977,z+.096)],.003)
    for j in range(12):
        a=2*pi*j/12
        box(B,(.351*cos(a),.351*sin(a),1.47),(.093,.103,.155),(0,0,a),.009)
        ell(L,(.316*cos(a),.316*sin(a),1.289),(.021,.021,.038))
    # Stone doorway and near-side arrow slits.
    for a,z,scale in [(-pi/2,.38,1),(-pi/2+.85,.77,.60),(-pi/2-.85,.77,.60)]:
        f=Vector((cos(a),sin(a),0)); tangent=Vector((-sin(a),cos(a),0))
        r=.307 if z<.6 else .288; ll=f*r
        w=.057*scale; h=.137*scale
        if z<.6: ll=f*.335
        at=lambda u,zz: tuple(ll+tangent*u+Vector((0,0,zz)))
        ell(Q,at(0,z+h),(.036*scale,.033*scale,.048*scale))
        box(Q,at(0,z+h*.53),(.045,.087*scale,.125*scale),(0,0,a),.001)
        profile=[at(-w,z),at(-w,z+h),at(-w*.58,z+h+.039*scale),at(0,z+h+.061*scale),
                 at(w*.58,z+h+.039*scale),at(w,z+h),at(w,z)]
        line(G,profile,.010*scale)
    rod(G,(-.047,0,1.46),(-.047,0,1.80),.015,.011)
    ell(L,(-.047,0,1.817),(.026,.027,.026))
    # Fabric wave made from a subdivided surface and solidify.
    v=[];f=[]
    for j in range(9):
        u=j/8
        for k in range(3):
            d=k/2
            v.append((-.046+.285*u,.038*sin(u*7),1.792-.129*d*(1-u*.82)-.033*u+.022*sin(u*7)))
    for j in range(8):
        for k in range(2):
            i=j*3+k; f.append((i,i+3,i+4,i+1))
    mesh=bpy.data.meshes.new('Pennant');mesh.from_pydata(v,[],f);mesh.update()
    ob=bpy.data.objects.new('Waving pennant',mesh);scene.collection.objects.link(ob)
    ob.modifiers.new('Fabric edge','SOLIDIFY').thickness=.009
    save(ob,R)
    # Small gold crescent and stud read as decoration even at low resolution.
    line(L,[(.03-.022*cos(i*.3),-.025,1.724+.025*sin(i*.3)) for i in range(-6,7)],.0065)
    ell(L,(.05,-.025,1.725),(.008,.007,.008))

def headgear(x,y,z,role):
    if role=='sultan':
        ell(I,(x,y,z+.03),(.15,.136,.117))
        for j in range(14):
            a=j*pi/7
            o=ell(I,(x+.096*cos(a),y+.092*sin(a),z+.04),(.055,.060,.104),(0,.34*cos(a),a))
        ell(E,(x,y-.137,z+.052),(.039,.021,.048))
        line(G,[(x,y-.153,z+.102),(x-.04,y-.15,z+.053),(x,y-.158,z+.014),(x+.04,y-.15,z+.053),(x,y-.153,z+.102)],.010)
        for a in (pi*.20,pi*.84,pi*1.47):
            rod(G,(x+.035*cos(a),y+.035*sin(a),z+.153),(x+.068*cos(a),y+.068*sin(a),z+.225),.019,.012)
            ell(L,(x+.068*cos(a),y+.068*sin(a),z+.233),(.018,.018,.022))
        band(G,.14,.057,.013,(x,y,z))
        ell(G,(x,y,z+.190),(.020,.017,.049))
    elif role=='rider':
        lathe(G,(x,y,z),[(-.045,.059),(-.02,.082),(.047,.075),(.089,.052),(.123,.023),(.146,.009)])
        ell(D,(x,y-.077,z+.015),(.025,.026,.034))
        ell(L,(x,y,z+.154),(.021,.020,.028))
    else:
        wide=.099 if role=='vizier' else .091
        lathe(I,(x,y,z),[(-.035,.059),(.0,.067),(.155,wide),(.171,wide*.97),(.181,wide*.87)],.70)
        band(G,.173,wide,.008,(x,y,z),.70)
        line(G,[(x+.017,y-.053,z-.030),(x+.021,y-.066,z+.071),(x+.029,y-.069,z+.178)],.011)
        if role=='guard':
            ell(E,(x-.039,y-.062,z+.034),(.018,.008,.023))

def face(x,y,z,scale=1,beard=False):
    ell(F,(x,y,z),(.074*scale,.064*scale,.083*scale))
    ell(H,(x,y+.022*scale,z+.034*scale),(.083*scale,.047*scale,.064*scale))
    ell(F,(x,y-.057*scale,z-.003*scale),(.020*scale,.030*scale,.025*scale))
    for side in (-1,1):
        ell(Q,(x+side*.029*scale,y-.057*scale,z+.016*scale),(.012*scale,.008*scale,.005*scale))
        ell(F,(x+side*.071*scale,y,z-.006*scale),(.014*scale,.015*scale,.025*scale))
        ell(H,(x+side*.018*scale,y-.056*scale,z-.028*scale),(.024*scale,.010*scale,.009*scale),(0,side*.38,0))
    if beard:
        ell(H,(x,y-.044*scale,z-.064*scale),(.066*scale,.042*scale,.065*scale))
        ell(I,(x+.032*scale,y-.075*scale,z-.071*scale),(.011*scale,.007*scale,.041*scale),(0,.16,0))

def person(role):
    sultan=role=='sultan'; vizier=role=='vizier'; guard=role=='guard'
    ext=1.0 if sultan else .86 if vizier else .79
    plinth(.46 if sultan else .402,.82)
    wx=.248 if sultan else .183 if vizier else .162
    shoulder=1.36*ext
    foot=.264
    coat=ROYAL if sultan else C
    for sign in (-1,1):
        ell(Q,(sign*.102,-.084,foot+.026),(.068,.137,.046))
    lathe(coat,(0,0,0),[(foot+.03,wx),(foot+.115,wx*1.01),(.71*ext,wx*.76),(.98*ext,wx*.58),
                              (1.15*ext,wx*.79),(shoulder,wx*.68),(shoulder+.036,wx*.41)],.67)
    if sultan:
        lathe(Q,(0,.063,0),[(.304,.242),(.385,.253),(.79,.20),(1.023,.181),(1.255,.204),(1.345,.164)],.72)
        for s in (-1,1):
            ee=[(s*.131,-.106,1.355),(s*.225,-.157,1.266),(s*.232,-.155,1.131),(s*.213,-.144,.963),
                (s*.222,-.128,.699),(s*.253,-.132,.408),(s*.242,-.132,.33)]
            line(I,ee,.030)
            for j in range(6):
                ell(D,(s*(.213+.006*j),-.162,.58+j*.09),(.010,.009,.020))
    for z,r in [((foot+.073),wx),(.70*ext,wx*.76),(.99*ext,wx*.59),(1.205*ext,wx*.745)]:
        band(G,z,r,.011,asp=.681)
    for s in (-1,1):
        line(G,[(s*.04,-wx*.49,shoulder+.005),(s*wx*.22,-wx*.63,.97*ext),
                (s*wx*.28,-wx*.60,.71*ext),(s*wx*.49,-wx*.75,.315)],.013 if sultan else .009)
        line(L,[(s*wx*.52,-wx*.43,shoulder-.09),(s*wx*.48,-wx*.51,.93*ext),
                (s*wx*.58,-wx*.47,.71*ext),(s*wx*.75,-wx*.54,.32)],.008)
        for j in range(6):
            z=.39+j*.11*ext
            if z<.70*ext:
                y=-wx*.72+(z-.39)*.117
                crest((s*wx*.24,y,z),.021)
        z1=1.220*ext
        a=(s*wx*.71,-.013,shoulder-.036); b=(s*wx*.94,-wx*.36,z1-.068)
        c=(s*wx*.43,-wx*.87,z1-.082)
        if s==-1 and not vizier: c=(-wx*1.26,-wx*.75,1.13*ext)
        rod(C,a,b,.046,.049);ell(C,b,(.053,.053,.055));rod(coat,b,c,.052,.043)
        c2=Vector(c)+(Vector(b)-Vector(c))*.18
        rod(G,c,c2,.045,.048)
        hand=Vector(c)+(Vector(c)-Vector(b))*.21
        ell(F,hand,(.037,.034,.039))
    if not vizier: spear(-wx*1.38,-wx*.67,.322,1.49*ext,'royal' if sultan else 'blade')
    ell(E,(0,-wx*.68,1.015*ext),(.046,.020,.035))
    crest((0,-wx*.72,1.015*ext),.040)
    face(0,-.036,shoulder+.121,1.06 if sultan else .98,sultan)
    headgear(0,-.032,shoulder+.185,role)

def beast_leg(x,y,upper,joint,hoof,elephant=False):
    k=.068 if elephant else .040
    a=(x,y,upper);b=(x+joint,y-.016,upper-(.31 if elephant else .23));c=(x+hoof,y-.041,.304)
    rod(B,a,b,k*1.12,k*.78)
    ell(B,b,(k,k,k*1.22))
    rod(B,b,c,k*.76,k*.63)
    ell(Q,(c[0]+.012,c[1]-.008,.287),(k*1.06,k*.92,k*.57))
    if elephant:
        rod(G,(b[0],b[1],b[2]-.051),(b[0],b[1],b[2]-.017),k*.89,k*.88)

def horse():
    plinth(.54,.70)
    ell(B,(-.097,.031,.738),(.334,.123,.175),(0,.075,0))
    ell(B,(-.319,.027,.703),(.173,.130,.17),(0,-.16,0))
    ell(B,(.158,.026,.758),(.142,.123,.194),(0,-.3,0))
    ell(B,(.211,.026,.896),(.099,.087,.191),(0,.48,0))
    ell(B,(.322,.026,1.008),(.116,.078,.095),(0,.27,0))
    ell(B,(.405,.017,.979),(.083,.061,.059),(0,.32,0))
    for yy in (-.029,.083):
        rod(B,(.286,yy,1.029),(.266,yy,1.136),.036,.011)
        ell(H,(.378,yy+(-.036 if yy<0 else .02),1.008),(.019,.011,.017))
    for x,y,j,d in [(-.337,.085,.071,.028),(.147,.084,-.004,-.018),
                    (-.271,-.039,.058,-.045),(.225,-.056,-.014,.035)]:
        beast_leg(x,y,.667,j,d)
    for s in (-1,1):
        y=s*.135+.023
        line(G,[(.405,y*.48,.982),(.329,y*.57,.922),(.259,y*.75,.914),(.204,y*.89,.838),(.097,y,.736)],.014)
        line(G,[(-.273,y*.67,.775),(-.278,y,.688),(-.213,y,.628),(-.065,y,.652),(.014,y*.87,.745)],.014)
        line(D,[(.391,s*.072,.985),(.249,s*.115,.991),(.107,s*.135,.984),(.038,s*.129,.988)],.011)
        for j in range(4):
            ell(L,(-.218+j*.067,y,.687+j*.007),(.015,.015,.019))
    mane=[(.257,.031,1.081),(.217,.035,1.005),(.143,.034,.928),(.101,.032,.877),(.063,.025,.85)]
    line(H,mane,.043,[.79,1,.97,.72,.41])
    line(H,[(-.419,.052,.762),(-.525,.034,.646),(-.56,.014,.469),(-.496,-.025,.376)],.046,[.72,.86,1,.25])
    ell(C,(-.096,.035,.844),(.182,.141,.064))
    ell(D,(-.089,.035,.885),(.123,.1,.043))
    ell(G,(.022,.034,.893),(.035,.079,.048))
    # Actual rider, including two separate bent legs and arms with reins.
    x=-.083;y=.033
    ell(C,(x,y,1.022),(.075,.090,.149),(0,-.18,0))
    ell(T,(x+.021,y,1.063),(.056,.08,.1),(0,-.18,0))
    line(G,[(x-.05,y-.064,.998),(x+.055,y-.052,1.092),(x+.035,y-.048,1.161)],.012)
    face(x+.041,y-.005,1.227,.75)
    headgear(x+.041,y-.006,1.280,'rider')
    for s in (-1,1):
        y2=y+s*.126
        a=(x-.016,y2*.72,.955); b=(x+.073,y2,.801); c=(x+.034,y2,.677)
        rod(C,a,b,.038,.03);ell(D,b,(.042,.035,.036));rod(T,b,c,.03,.022)
        ell(Q,(c[0]+.016,c[1],c[2]),(.043,.028,.024));line(G,[(x+.008,y2,.769),(x+.02,y2,.664),(x+.07,y2,.661)],.008)
        a=(x+.025,y2*.80,1.105); b=(x+.078,y2,1.005); c=(x+.154,y2*.91,.984)
        rod(C,a,b,.032,.031);rod(T,b,c,.031,.019);ell(F,c,(.026,.019,.020))
    ell(E,(x-.057,y-.069,1.037),(.025,.023,.029))

def elephant():
    plinth(.55,.73)
    ell(B,(-.131,.041,.756),(.319,.174,.235))
    ell(B,(-.339,.032,.709),(.152,.159,.173))
    ell(B,(.105,.04,.762),(.152,.167,.21))
    ell(B,(.270,.029,.808),(.139,.114,.139),(0,.27,0))
    for x,y,j,d in [(-.339,.136,-.023,-.002),(.113,.135,.005,.02),
                    (-.249,-.055,-.005,-.016),(.2,-.064,.007,.011)]:
        beast_leg(x,y,.682,j,d,True)
    # Far and near ears, paired sweeping tusks, and curled trunk.
    for s in (1,-1):
        yy=s*.108+.035
        ell(B,(.172,yy,.788),(.125,.047,.141),(s*.24,.20,s*.22))
        ell(WARM,(.189,yy+s*.029,.784),(.099,.019,.110),(s*.24,.20,s*.22))
        ell(Q,(.325,yy,.832),(.019,.012,.017))
        ell(L,(.337,yy+s*.004,.836),(.006,.006,.006))
        line(I,[(.339,yy,.724),(.391,yy+s*.025,.668),(.462,yy+s*.031,.646),(.518,yy+s*.032,.670)],.029,[1,.76,.48,.035])
        line(G,[(.157,yy,.878),(.245,yy,.926),(.314,yy*.9,.888),(.348,yy*.65,.842)],.014)
    line(B,[(.362,.012,.792),(.413,.010,.742),(.42,.003,.622),(.431,-.012,.494),
            (.492,-.024,.424),(.544,-.032,.439),(.562,-.036,.500)],.064,[1,.99,.85,.65,.53,.45,.37])
    line(B,[(-.402,.022,.762),(-.469,.041,.659),(-.49,.029,.541),(-.473,.018,.501)],.022,[.91,1,.5,.36])
    ell(H,(-.468,.014,.496),(.026,.018,.037))
    # Draped armour and patterned tassels.
    ell(C,(-.114,.038,.861),(.259,.193,.163))
    for s in (-1,1):
        y=.037+s*.188
        line(G,[(-.35,y*.75,.817),(-.298,y*.95,.736),(-.164,y,.712),(-.048,y,.73),(.118,y*.88,.827)],.015)
        for j in range(5):
            x=-.294+j*.074;z=.714+.022*((j-2)**2)
            line(G,[(x,y,z+.12),(x,y,z+.022)],.008)
            ell(L,(x,y,z),(.017,.017,.023))
        crest((-.123,y,.802),.042)
    # Howdah with inlaid rail, lattice and ribbed onion cupola.
    box(D,(-.096,.025,1.012),(.45,.289,.073),bevel=.018)
    box(C,(-.107,.026,1.106),(.367,.255,.17),bevel=.012)
    for z in (1.065,1.185,1.214):
        box(G,(-.107,.026,z),(.416,.29,.019),bevel=.004)
    for x in (-.307,-.212,-.116,-.020,.092):
        for y in (-.107,.153):
            rod(G,(x,y,1.056),(x,y,1.294),.014,.012)
            ell(L,(x,y,1.302),(.018,.018,.028))
    for x in (-.265,-.168,-.073,.038):
        crest((x,-.109,1.122),.032)
    shp=[(1.203,.151),(1.25,.157),(1.299,.143),(1.35,.117),(1.39,.074),(1.439,.019),(1.455,.012)]
    lathe(E,(-.107,.023,0),shp,.85)
    for j in range(10):
        a=j*2*pi/10
        line(G,[(-.107+(r+.005)*cos(a),.023+(r*.85+.005)*sin(a),z) for z,r in shp],.009)
    band(G,1.239,.161,.014,(-.107,.023,0),.85)
    ell(L,(-.107,.023,1.457),(.023,.023,.032))
    rod(G,(-.107,.023,1.456),(-.107,.023,1.526),.015,.004)
    ell(L,(-.107,.023,1.536),(.013,.013,.020))

WARM=mat('Ear / edge relief','ae8868',.16,.37,.18)

PALETTES={
    'w': {B:'ebd4a9',C:'126047',E:'0c4e74',H:'564137',WARM:'b79878',ROYAL:'22644a',F:'d2a77f'},
    'b': {B:'434550',C:'7a2437',E:'6e2b31',H:'1f1e21',WARM:'52505a',ROYAL:'691936',F:'c28c68'},
}

def set_camera():
    bpy.context.view_layer.update()
    deps=bpy.context.evaluated_depsgraph_get()
    w=CAM.normalized()
    rotation=(-w).to_track_quat('-Z','Y')
    u=rotation@Vector((1,0,0)); v=rotation@Vector((0,1,0))
    verts=[]
    for ob in PARTS:
        ev=ob.evaluated_get(deps)
        if ev.type=='MESH':
            verts += [ev.matrix_world@p.co for p in ev.data.vertices]
        else:
            me=ev.to_mesh()
            if me:
                verts += [ev.matrix_world@p.co for p in me.vertices]
                ev.to_mesh_clear()
    assert verts
    xp=[p.dot(u) for p in verts]; yp=[p.dot(v) for p in verts]
    ww=max(xp)-min(xp); hh=max(yp)-min(yp)
    # Keep every base aligned while the pawn reads shorter than its officers.
    length=max(1.81,ww/.92,hh/.92)
    cam.data.ortho_scale=length
    at=u*((max(xp)+min(xp))*.5)+v*(min(yp)+length*.454)
    cam.location=at+CAM
    cam.rotation_euler=rotation.to_euler()

def render(name, fn):
    fn()
    set_camera()
    for side, paints in PALETTES.items():
        for m,h in paints.items():
            m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=rgb(h)
        scene.render.filepath=str(OUT/f'{side}{name}.png')
        bpy.ops.render.render(write_still=True)
    for ob in PARTS:
        bpy.data.objects.remove(ob,do_unlink=True)
    PARTS.clear()

builders={'r':stone_tower,'n':horse,'b':elephant,'q':lambda:person('vizier'),
          'k':lambda:person('sultan'),'p':lambda:person('guard')}
for key, fn in builders.items():
    render(key,fn)
