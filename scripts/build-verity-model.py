"""Rebuild the original DCSMCRAFT Lord Verity mesh using Blender 4.3+.

Reference appearance: Horror Skunx / Lord Verity, documented in LORD-VERITY.md.
This is a new mesh, not the creator's or a Sketchfab author's original asset.
"""
import bpy, math, json
from mathutils import Vector, Matrix
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.fps=28
bpy.context.scene.frame_start=0
parts=[]

def material(name, color, roughness=.5, metallic=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=roughness;p.inputs['Metallic'].default_value=metallic
    return m

ivory=material('Ivory wool',(.89,.86,.78),.65)
white=material('White shirt',(.98,.98,.93),.62)
gold=material('Gold satin',(.91,.58,.075),.3,.2)
skin=material('Warm brown skin',(.23,.115,.043),.63)
lip=material('Smile edges',(.14,.052,.022),.65)
black=material('Eye sockets',(.006,.004,.002),.88)
shoe=material('Polished shoes',(.035,.021,.011),.27)
teeth=material('Ivory teeth',(.95,.89,.69),.38)
bone_defs={
 'Root':((0,0,0),(0,0,.2),None),
 'Hips':((0,0,1.05),(0,0,1.25),'Root'),
 'Spine':((0,0,1.25),(0,0,1.59),'Hips'),
 'Chest':((0,0,1.59),(0,0,1.88),'Spine'),
 'Neck':((0,0,1.88),(0,0,2.01),'Chest'),
 'Head':((0,0,2.01),(0,0,2.38),'Neck'),
}
for side,s in [('L',-1),('R',1)]:
    bone_defs.update({
     f'UpperArm.{side}':((s*.25,0,1.81),(s*.56,0,1.65),'Chest'),
     f'Forearm.{side}':((s*.56,0,1.65),(s*.81,-.035,1.52),f'UpperArm.{side}'),
     f'Hand.{side}':((s*.81,-.035,1.52),(s*.96,-.045,1.45),f'Forearm.{side}'),
     f'Thigh.{side}':((s*.12,0,1.10),(s*.12,0,.60),'Hips'),
     f'Shin.{side}':((s*.12,0,.60),(s*.12,0,.12),f'Thigh.{side}'),
     f'Foot.{side}':((s*.12,0,.12),(s*.12,-.18,.065),f'Shin.{side}'),
    })
arm_data=bpy.data.armatures.new('Lord Verity skeleton');rig=bpy.data.objects.new('LordVerity',arm_data)
bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in bone_defs.items():
    b=arm_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)

def bind(obj,bone,mat):
    obj.data.materials.append(mat)
    for f in obj.data.polygons:f.use_smooth=True
    g=obj.vertex_groups.new(name=bone);g.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    parts.append(obj);return obj

def ellipsoid(name,loc,scale,mat,bone,segments=20,rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;return bind(o,bone,mat)

def tube(name,a,b,r1,r2,mat,bone,ellipse=1):
    a,b=Vector(a),Vector(b);axis=(b-a).normalized();u=axis.cross(Vector((0,1,0))).normalized()
    if not u.length:u=Vector((1,0,0))
    v=axis.cross(u).normalized();verts=[];faces=[];N=16;R=5
    for j in range(R):
        t=j/(R-1);r=r1+(r2-r1)*t
        for i in range(N):
            p=a.lerp(b,t)+u*(math.cos(i*math.tau/N)*r)+v*(math.sin(i*math.tau/N)*r*ellipse)
            verts.append(p)
    for j in range(R-1):
        for i in range(N):
            n=(i+1)%N;faces.append((j*N+i,j*N+n,(j+1)*N+n,(j+1)*N+i))
    faces.extend([tuple(reversed(range(N))),tuple((R-1)*N+i for i in range(N))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return bind(o,bone,mat)

def patch(name,verts,faces,mat,bone):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    solid=o.modifiers.new('Tailored thickness','SOLIDIFY');solid.thickness=.008
    bevel=o.modifiers.new('Soft seams','BEVEL');bevel.width=.012;bevel.segments=2
    bpy.context.view_layer.objects.active=o
    for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
    return bind(o,bone,mat)

# A tailored, tapered silhouette with actual lapels, seams and coat tails.
ellipsoid('Jacket torso',(0,.015,1.54),(.265,.145,.38),ivory,'Chest')
ellipsoid('Waistcoat',(0,-.123,1.46),(.176,.035,.31),gold,'Spine')
patch('Shirt front',[(-.095,-.148,1.83),(.095,-.148,1.83),(.055,-.17,1.49),(-.055,-.17,1.49)],[(0,1,2,3)],white,'Chest')
for side,s in [('L',-1),('R',1)]:
    patch('Jacket lapel '+side,[(s*.095,-.15,1.83),(s*.25,-.11,1.73),(s*.14,-.18,1.51),(s*.035,-.18,1.60)],[(0,1,2,3)],white,'Chest')
    patch('Collar '+side,[(0,-.17,1.81),(s*.108,-.14,1.86),(s*.13,-.185,1.76),(s*.055,-.195,1.72)],[(0,1,2,3)],white,'Neck')
    patch('Coat tail '+side,[(s*.025,-.105,1.39),(s*.23,-.09,1.45),(s*.255,.035,.91),(s*.07,-.005,.87)],[(0,1,2,3)],ivory,'Hips')
    ellipsoid('Shoulder '+side,(s*.25,0,1.79),(.12,.12,.13),ivory,'UpperArm.'+side)
    tube('Sleeve '+side,(s*.27,0,1.80),(s*.56,0,1.65),.11,.078,ivory,'UpperArm.'+side)
    tube('Forearm sleeve '+side,(s*.56,0,1.65),(s*.81,-.035,1.52),.078,.055,ivory,'Forearm.'+side)
    for j in range(3):
        a=Vector((s*.29,0,1.79)).lerp(Vector((s*.56,0,1.65)),.18+j*.2)
        b=a+Vector((s*.025,0,-.012));tube('Gold sleeve braid '+side+str(j),a,b,.112-j*.004,.112-j*.004,gold,'UpperArm.'+side)
    ellipsoid('Elbow '+side,(s*.56,0,1.65),(.077,.077,.078),ivory,'Forearm.'+side,16,8)
    ellipsoid('Hand '+side,(s*.855,-.04,1.495),(.075,.029,.043),skin,'Hand.'+side)
    for j in range(4):
        base=(s*.88,-.07+j*.019,1.49);tip=(s*(.99-(abs(j-1.5)*.015)),-.07+j*.023,1.445-j*.003)
        tube('Finger '+side+str(j),base,tip,.009,.006,skin,'Hand.'+side)
    tube('Thumb '+side,(s*.84,-.065,1.47),(s*.89,-.104,1.425),.013,.008,skin,'Hand.'+side)
    tube('Trouser thigh '+side,(s*.12,0,1.10),(s*.12,0,.60),.105,.073,ivory,'Thigh.'+side,1.04)
    ellipsoid('Trouser knee '+side,(s*.12,0,.60),(.074,.08,.08),ivory,'Shin.'+side,16,8)
    tube('Trouser shin '+side,(s*.12,0,.60),(s*.12,0,.12),.074,.059,ivory,'Shin.'+side,1.08)
    tube('Gold trouser seam '+side,(s*.205,0,1.05),(s*.181,0,.61),.007,.006,gold,'Thigh.'+side)
    ellipsoid('Shoe '+side,(s*.12,-.075,.075),(.081,.18,.073),shoe,'Foot.'+side)
    ellipsoid('Spat '+side,(s*.12,-.015,.14),(.068,.089,.075),white,'Foot.'+side)
    for j in range(3):ellipsoid('Spat button '+side+str(j),(s*.185,-.026,.09+j*.035),(.009,.011,.008),gold,'Foot.'+side,8,6)
ellipsoid('Tie knot',(0,-.20,1.73),(.04,.022,.045),gold,'Chest',12,8)
patch('Gold tie',[(-.018,-.204,1.72),(.018,-.204,1.72),(.04,-.205,1.48),(0,-.21,1.425),(-.04,-.205,1.48)],[(0,1,2,3,4)],gold,'Chest')
for j in range(4):ellipsoid('Waistcoat button '+str(j),(0,-.162,1.49-j*.065),(.009,.01,.009),white,'Spine',8,6)
tube('Neck',(0,0,1.85),(0,0,2.04),.068,.075,skin,'Neck')

# Recessed sockets and a dimensional grin; no camera-facing face card.
ellipsoid('Head',(0,0,2.16),(.19,.14,.235),skin,'Head',28,20)
ellipsoid('Jaw',(0,-.04,2.04),(.142,.117,.095),skin,'Head')
for s in [-1,1]:
    ellipsoid('Cheek',(s*.13,-.095,2.105),(.063,.053,.08),skin,'Head',16,10)
    ellipsoid('Eye rim',(s*.082,-.116,2.23),(.067,.03,.076),lip,'Head',20,12)
    ellipsoid('Deep eye socket',(s*.082,-.14,2.23),(.049,.018,.059),black,'Head',20,12)
    ellipsoid('Brow',(s*.082,-.13,2.30),(.072,.023,.022),skin,'Head',16,8)
    ellipsoid('Ear',(s*.183,0,2.17),(.028,.025,.055),skin,'Head',12,8)
ellipsoid('Nose',(0,-.145,2.16),(.045,.039,.038),skin,'Head',16,10)
ellipsoid('Grin cavity',(0,-.122,2.075),(.142,.028,.061),black,'Head',24,12)
for i in range(11):
    t=(i-5)/5;x=t*.123;z=2.09+.032*abs(t)**1.6
    ellipsoid('Upper tooth '+str(i),(x,-.15+abs(t)*.012,z),(.011,.011,.018-abs(t)*.005),teeth,'Head',8,6)
ellipsoid('Lower lip',(0,-.136,2.026),(.099,.015,.017),lip,'Head',20,8)

# Broad fedora with pinched crown, curled brim and continuous gold band.
ellipsoid('Hat brim',(0,.005,2.395),(.34,.27,.022),ivory,'Head',32,10)
tube('Fedora crown',(0,.01,2.395),(0,.01,2.565),.181,.153,ivory,'Head',.81)
ellipsoid('Hat top',(0,.01,2.56),(.156,.126,.018),ivory,'Head',24,8)
tube('Gold hatband',(0,.01,2.407),(0,.01,2.442),.183,.178,gold,'Head',.82)

# Join geometry into one draw mesh while retaining materials and bone groups.
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='LordVerity_SkinnedMesh'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
mod=mesh.modifiers.new('Skin','ARMATURE');mod.object=rig;mesh.parent=rig
rig['asset_origin']='Original DCSMCRAFT reference recreation; not the original Horror Skunx or Sketchfab mesh.'
rig['reference']='https://www.youtube.com/watch?v=lhCPiauHI-g'

# In-place actions keep collision and player-owned movement separate from posing.
def make_action(name,seconds,pose):
    action=bpy.data.actions.new(name);rig.animation_data_create();rig.animation_data.action=action
    for frame in range(0,round(seconds*28)+1):
        t=frame/28
        for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
        pose(t)
        for b in rig.pose.bones:
            b.keyframe_insert(data_path='rotation_euler',frame=frame)
            b.keyframe_insert(data_path='location',frame=frame)
    track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action)
    rig.animation_data.action=None

def arm_to(side,s,target):
    name='UpperArm.'+side;upper=rig.pose.bones[name];lower=rig.pose.bones['Forearm.'+side]
    shoulder=Vector(bone_defs[name][0]);hand=Vector(target)
    first=(Vector(bone_defs[name][1])-shoulder).length
    second=(Vector(bone_defs['Forearm.'+side][1])-Vector(bone_defs['Forearm.'+side][0])).length
    delta=hand-shoulder;distance=min(first+second-.001,max(.05,delta.length));axis=delta.normalized()
    along=(first*first-second*second+distance*distance)/(2*distance)
    outward=Vector((s,0,0));outward=(outward-axis*axis.dot(outward)).normalized()
    elbow=shoulder+axis*along+outward*math.sqrt(max(0,first*first-along*along))
    upper.matrix=Matrix.Translation(shoulder)@(elbow-shoulder).to_track_quat('Y','Z').to_matrix().to_4x4()
    bpy.context.view_layer.update()
    lower.matrix=Matrix.Translation(elbow)@(hand-elbow).to_track_quat('Y','Z').to_matrix().to_4x4()
    bpy.context.view_layer.update()
    palm=rig.pose.bones['Hand.'+side]
    palm.matrix=Matrix.Translation(hand)@Vector((s*.045,-.015,-.13)).to_track_quat('Y','Z').to_matrix().to_4x4()

def dance(t):
    beat=t*112/60;wave=math.sin(beat*math.pi);cycle=(beat%8)/8
    rig.pose.bones['Hips'].location.z=.025*math.sin(beat*math.tau)
    rig.pose.bones['Hips'].rotation_euler.y=.11*wave
    rig.pose.bones['Spine'].rotation_euler.y=-.07*wave
    rig.pose.bones['Head'].rotation_euler.z=.06*wave
    for side,s in [('L',-1),('R',1)]:
        phase=beat+(0 if s==-1 else 1);kick=max(0,math.sin(phase*math.pi))
        rig.pose.bones['Thigh.'+side].rotation_euler.x=-.42*kick
        rig.pose.bones['Thigh.'+side].rotation_euler.y=s*.08
        rig.pose.bones['Shin.'+side].rotation_euler.x=.22*kick
        rig.pose.bones['Foot.'+side].rotation_euler.x=-.18*kick
        clap=math.sin((beat%1)*math.pi) if cycle>.75 else 0
        hip=(s*.27,-.11,1.33);front=(s*(.15-.105*clap),-.32,1.67)
        blend=min(1,max(0,(cycle-.73)*25)) if cycle>.73 else 0
        target=tuple(hip[i]*(1-blend)+front[i]*blend for i in range(3))
        arm_to(side,s,target)

def idle(t):
    rig.pose.bones['Chest'].rotation_euler.x=.012*math.sin(t*math.pi)
    for side,s in [('L',-1),('R',1)]:arm_to(side,s,(s*.31,-.02,1.19))

def bow(t):
    a=math.sin(min(1,t/2)*math.pi);rig.pose.bones['Spine'].rotation_euler.x=.52*a
    rig.pose.bones['Head'].rotation_euler.x=.20*a
    for side,s in [('L',-1),('R',1)]:arm_to(side,s,(s*.31,-.02,1.19))

make_action('Idle',2,idle);make_action('VerityDance',60/112*8,dance);make_action('Bow',2,bow)
bpy.context.scene.frame_set(0)
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
out=ROOT/'public/models/verity';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);rig.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'lord-verity.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_apply=False,export_extras=True)
triangles=sum(len(p.vertices)-2 for p in mesh.data.polygons)
(out/'model-info.json').write_text(json.dumps({'origin':'original reference recreation','triangles':triangles,'bones':len(bone_defs),'clips':['Idle','VerityDance','Bow'],'height':2.58,'reference':'https://sketchfab.com/3d-models/high-poly-model-lord-verity-8c39adaebb0e4f7aa6694b941caa7e10'},indent=2)+'\n')
print('VERITY_MODEL',triangles,'triangles',len(bone_defs),'bones')
