"""Repack user-supplied GLB texture data for offline WebGL; no network access."""
import sys,struct,json,io,hashlib
from pathlib import Path
from PIL import Image

def read(path):
 b=Path(path).read_bytes();size=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+size]),b[28+size:]
def save(path,g,parts):
 data=bytearray()
 for v,p in zip(g['bufferViews'],parts):
  data.extend(b'\0'*((-len(data))%4));v['byteOffset']=len(data);v['byteLength']=len(p);v['buffer']=0;data.extend(p)
 g['buffers']=[{'byteLength':len(data)}];data.extend(b'\0'*((-len(data))%4))
 j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 Path(path).write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(data))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(data),0x004e4942)+data)
def run(source,dest,role):
 g,b=read(source);parts=[b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]for v in g['bufferViews']]
 original=[]
 for i,img in enumerate(g.get('images',[])):
  im=Image.open(io.BytesIO(parts[img['bufferView']])).convert('RGBA');original.append(im.copy())
  if max(im.size)>2048:im.thumbnail((2048,2048),Image.Resampling.LANCZOS)
  # Tiny uniform utility texels remain tiny: enlarging them wastes GPU memory.
  alpha=im.getchannel('A').getextrema()
  if alpha==(255,255):im=im.convert('RGB')
  dst=io.BytesIO();normal=any(m.get('normalTexture',{}).get('index') in [t for t,v in enumerate(g.get('textures',[]))if v.get('source')==i]for m in g.get('materials',[]))
  im.save(dst,format='WEBP',lossless=normal,quality=96,method=6);parts[img['bufferView']]=dst.getvalue();img['mimeType']='image/webp'
  if max(im.size)<=64:img.setdefault('extras',{})['dcsmUtilityTexture']=True
 for m in g.get('materials',[]):
  m.pop('extensions',None);m['pbrMetallicRoughness']['metallicFactor']=0;m['pbrMetallicRoughness']['roughnessFactor']=.72
  if role=='sonic':m.pop('emissiveTexture',None);m['emissiveFactor']=[0,0,0]
  elif 'eye'in m.get('name','').lower():m['emissiveTexture']=m['pbrMetallicRoughness'].get('baseColorTexture');m['emissiveFactor']=[.65,.2,.2]
 if role=='sonic':
  import numpy as np
  arr=np.asarray(original[0]).copy();rgb=arr[:,:,:3].astype(float);r,gg,bb=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
  mask=(bb>r*1.2)&(bb>gg*.95)&(bb>45);lum=np.max(rgb,axis=2)
  arr[:,:,0][mask]=np.clip(lum[mask]*1.03,0,255);arr[:,:,1][mask]=np.clip(lum[mask]*.82+12,0,255);arr[:,:,2][mask]=np.clip(lum[mask]*.13+12,0,255)
  eyes=(gg>r*1.2)&(gg>bb*1.35)&(gg>50);arr[:,:,0][eyes]=np.clip(gg[eyes]*.9,0,255);arr[:,:,1][eyes]=np.clip(gg[eyes]*.2,0,255);arr[:,:,2][eyes]=np.clip(gg[eyes]*.18,0,255)
  dst=io.BytesIO();Image.fromarray(arr).convert('RGB').save(dst,format='WEBP',quality=96,method=6)
  vi=len(parts);parts.append(dst.getvalue());g['bufferViews'].append({'buffer':0,'byteLength':len(parts[-1])})
  ii=len(g['images']);g['images'].append({'bufferView':vi,'mimeType':'image/webp','name':'Super Sonic original palette variant'})
  ti=len(g['textures']);g['textures'].append({'source':ii,'sampler':g['textures'][0].get('sampler',0)})
  mat=json.loads(json.dumps(g['materials'][0]));mat['name']='Super Sonic';mat['pbrMetallicRoughness']['baseColorTexture']={'index':ti};mi=len(g['materials']);g['materials'].append(mat)
  g.setdefault('extensions',{})['KHR_materials_variants']={'variants':[{'name':'Blue Sonic'},{'name':'Super Sonic'}]}
  for mesh in g['meshes']:
   for prim in mesh['primitives']:prim.setdefault('extensions',{})['KHR_materials_variants']={'mappings':[{'material':mi,'variants':[1]}]}
  g.setdefault('extras',{})['dcsmSuperMaterial']=mi
 for texture in g['textures']:
  texture.setdefault('extensions',{})['EXT_texture_webp']={'source':texture.pop('source')}
 g['extensionsRequired']=['EXT_texture_webp']
 g['extensionsUsed']=[x for x in g.get('extensionsUsed',[])if x not in ['KHR_materials_specular','KHR_materials_ior']]
 if 'EXT_texture_webp'not in g['extensionsUsed']:g['extensionsUsed'].append('EXT_texture_webp')
 if role=='sonic'and'KHR_materials_variants'not in g['extensionsUsed']:g['extensionsUsed'].append('KHR_materials_variants')
 g.setdefault('asset',{})['copyright']=('Sonic by ily20111: https://sketchfab.com/3d-models/3d-sonic-rigged-cf9837777ff142b6b2e83d9569c8f4c6' if role=='sonic' else 'Giganto by HiGuys920, uploaded by Logandium: https://sketchfab.com/3d-models/giganto-sonic-frontiers-f4cbf7a0363a4692883ace2deb8193cf')+' | CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ | DCSMCRAFT modifications: repacked textures, normalization, custom keyed animation, sockets, golden/quill variant or dorsal emitters. See TITAN-ASSETS.md. Sega characters; independent fan work.'
 Path(dest).parent.mkdir(parents=True,exist_ok=True);save(dest,g,parts)
 print(role,'texture repack',Path(source).stat().st_size,'->',Path(dest).stat().st_size,flush=True)
if __name__=='__main__':run(*sys.argv[1:])
