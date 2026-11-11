"""Compact, duplicate-free Browser/Windows/Mobile/source ZIPs from tested builds.
Run after all builds: python3 scripts/package-downloads.py --output artifacts
The source archive includes Git-tracked and nonignored source files, not caches.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse, hashlib, json, subprocess
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);parser.add_argument('--verify-manifest');args=parser.parse_args()
out=Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if args.verify_manifest:
 for n,h in json.loads(Path(args.verify_manifest).read_text()).items():assert sha(root/n)==h,'Tested input changed: '+n
v=json.loads((root/'package.json').read_text())['version'];manifest={}
docs=['ARENA-HOMING.md','ARENA-FOOTING.md','TITAN-FREEDOM.md','TITAN-COUNTER.md','README.md','WYVERN.md','WYVERN-VIDEO.md','WYVERN-MUSIC.md','TITAN-COMBAT.md','WYVERN-PURSUIT.md','TITAN-PURSUIT.md','MOBILE-CONTROLS.md','MOBILE.md','BUILDING.md','CONTROLLERS.md','VALIDATION.md','THIRD_PARTY.md','TITAN-ASSETS.md','LICENSE']
def doc_entries(folder):
 return [(root/n,folder+'/'+n) for n in docs]+[(root/'dist/mobile/NOTICES.txt',folder+'/NOTICES.txt')]+[(p,folder+'/licenses/'+str(p.relative_to(root/'public'))) for p in (root/'public').rglob('*.txt') if any(n in p.name.upper() for n in ['NOTICE','LICENSE','OFL'])]
def pack(name,entries):
 seen={};p=out/name
 with ZipFile(p,'w',ZIP_DEFLATED,compresslevel=9) as z:
  for f,n in entries:
   h=sha(f)
   if n in seen:assert seen[n]==h,'Conflicting archive entry '+n;continue
   seen[n]=h;z.write(f,n)
 with ZipFile(p) as z:assert z.testzip() is None;assert len(z.namelist())==len(set(z.namelist()))
 manifest[name]={'bytes':p.stat().st_size,'sha256':sha(p)};assert p.stat().st_size<100*1024*1024,name+' exceeds GitHub file limit';print(name,manifest[name],flush=True)
pack(f'DCSMCRAFT-Browser-{v}.zip',[(root/'dist/DCSMCRAFT-Standalone.html','DCSMCRAFT-Browser/DCSMCRAFT.html')]+doc_entries('DCSMCRAFT-Browser'))
pack(f'DCSMCRAFT-Windows-{v}.zip',[(root/'dist/desktop/DCSMCRAFT.exe','DCSMCRAFT-Windows/DCSMCRAFT.exe'),(root/'desktop/README.md','DCSMCRAFT-Windows/DESKTOP.md')]+[(p,'DCSMCRAFT-Windows/licenses/'+str(p.relative_to(root/'desktop/licenses'))) for p in (root/'desktop/licenses').rglob('*') if p.is_file()]+doc_entries('DCSMCRAFT-Windows'))
pack(f'DCSMCRAFT-Mobile-{v}.zip',[(p,'DCSMCRAFT-Mobile/'+str(p.relative_to(root/'dist/mobile'))) for p in sorted((root/'dist/mobile').rglob('*')) if p.is_file()]+[(root/'MOBILE.md','DCSMCRAFT-Mobile/MOBILE.md'),(root/'ARENA-FOOTING.md','DCSMCRAFT-Mobile/ARENA-FOOTING.md'),(root/'ARENA-HOMING.md','DCSMCRAFT-Mobile/ARENA-HOMING.md'),(root/'TITAN-PURSUIT.md','DCSMCRAFT-Mobile/TITAN-PURSUIT.md'),(root/'TITAN-COUNTER.md','DCSMCRAFT-Mobile/TITAN-COUNTER.md'),(root/'TITAN-FREEDOM.md','DCSMCRAFT-Mobile/TITAN-FREEDOM.md')])
files=[n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=root,text=True).splitlines() if (root/n).is_file()]
pack(f'dcsmcraft-source-v{v}.zip',[(root/n,'dcsmcraft/'+n) for n in files])
with ZipFile(out/f'dcsmcraft-source-v{v}.zip') as z:
 for n in files:assert hashlib.sha256(z.read('dcsmcraft/'+n)).hexdigest()==sha(root/n),n
(out/f'DCSMCRAFT-v{v}-checksums.json').write_text(json.dumps(manifest,indent=2)+'\n')
