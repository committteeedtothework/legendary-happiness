"""Append original local-bone animation to an optimized, user-supplied Wyvern GLB.
Input optimization: glTF Transform 4.2.1, meshopt, WebP 1024, simplify .45/error .0005,
flatten/join/instance/palette false. No animation or game code is imported.
"""
from pathlib import Path
import json,struct,math,hashlib,sys
src=Path(sys.argv[1]);out=Path(sys.argv[2]);raw=src.read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);binary=bytearray(raw[28+length:]);g.setdefault('animations',[])
def data(vals,kind):
 while len(binary)%4:binary.append(0)
 pos=len(binary);binary.extend(struct.pack('<'+'f'*len(vals),*vals));view=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteOffset':pos,'byteLength':len(vals)*4});n={'SCALAR':1,'VEC4':4}[kind];i=len(g['accessors']);a={'bufferView':view,'componentType':5126,'count':len(vals)//n,'type':kind}
 if kind=='SCALAR':a.update(min=[min(vals)],max=[max(vals)])
 g['accessors'].append(a);return i
def mul(a,b):
 x,y,z,w=a;X,Y,Z,W=b;return[w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z]
clips=[('flight',3.6),('idle',3.6),('missile_launch',1.5),('claw_left',2.3),('claw_right',2.3),('bite',2.4),('roar',3.8),('stagger',1.8),('tail_slam',4.2),('dorsal_deploy',4),('defeat',6)]
for name,duration in clips:
 count=math.ceil(duration*24)+1;times=[i*duration/(count-1) for i in range(count)];ti=data(times,'SCALAR');samplers=[];channels=[]
 for i,node in enumerate(g['nodes']):
  label=node.get('name','');tail=label.startswith('Tail') and not 'end'in label;head=label.startswith(('Neck_','Head_'));jaw=label.startswith('Jaw_under');arm=label.startswith(('HandA_','HandB_','HandC_','UpperArm_','ForeArm_'))
  needle=label.startswith('Needle') and label.split('_')[0].endswith('1')
  if not (tail or head or jaw or arm or needle):continue
  vals=[];rest=node.get('rotation',[0,0,0,1]);numbers=''.join(c for c in label.split('_')[0] if c.isdigit());index=int(numbers or 0)
  for t in times:
   u=t/duration;wave=math.sin(t*math.tau/3.6-index*.22);x=y=z=0
   if tail:y=wave*.045;z=math.sin(t*math.tau/3.6-index*.18)*.018
   if head:z=math.sin(t*math.tau/3.6)*.025
   if arm:
    side=1 if '_L'in label else -1
    if label.startswith('UpperArm'):z=-.85+math.sin(t*math.tau/3.6)*.045;y=-side*.3
    elif label.startswith('ForeArm'):z=.28
    else:z=math.sin(t*math.tau/3.6)*.025
   if needle:z=-math.pi/2-(math.pi/2*(u*u*(3-2*u)) if name=='dorsal_deploy' else 0)
   pulse=math.sin(math.pi*u)**2
   if name=='missile_launch' and head:z-=pulse*.13
   if name in ['bite','roar','defeat'] and jaw:z+=pulse*.16
   if name.startswith('claw_') and arm:
    side=1 if '_L'in label else -1;active=(side==1)==(name=='claw_left')
    if active:
     if label.startswith('UpperArm'):y+=-side*pulse*1.22;z+=pulse*.85
     elif label.startswith('ForeArm'):z-=pulse*.28
     else:x+=pulse*.2
   if name=='stagger' and head:y+=math.sin(t*18)*pulse*.12
   if name in ['tail_slam','defeat'] and tail:z+=pulse*.065
   qx=[math.sin(x/2),0,0,math.cos(x/2)];qy=[0,math.sin(y/2),0,math.cos(y/2)];qz=[0,0,math.sin(z/2),math.cos(z/2)];q=mul(rest,mul(qx,mul(qy,qz)));n=math.sqrt(sum(v*v for v in q));vals +=[v/n for v in q]
  ai=data(vals,'VEC4');channels.append({'sampler':len(samplers),'target':{'node':i,'path':'rotation'}});samplers.append({'input':ti,'output':ai,'interpolation':'LINEAR'})
 g['animations'].append({'name':name,'samplers':samplers,'channels':channels,'extras':{'author':'DCSMCRAFT','loop':name in ['flight','idle']}})
g.setdefault('extras',{})['dcsmWyvern']={'author':'_____Xler_____','source':'https://sketchfab.com/3d-models/wyvern-59695baa3ad24d7691fef625cb8a7d0f','license':'CC-BY-4.0','originalSHA256':'45b5d6765f7ae81afe762e36819d5dc9724163d3e9a900fa7dac7eb867a1a845','animationAuthor':'DCSMCRAFT','head':'Head_07','jaw':'Jaw_under1_071'}
g['buffers'][0]['byteLength']=len(binary)
while len(binary)%4:binary.append(0)
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary)
print(json.dumps({'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'clips':[c[0]for c in clips],'joints':len(g['skins'][0]['joints']),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes']for p in m['primitives'])},indent=2))
