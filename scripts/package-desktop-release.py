"""Package the offline Electron release, updated HTML, full source and notices.
Run only after builds/tests: python scripts/package-desktop-release.py --output DIR
GitHub Release assets support the portable executable's >100 MiB size.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,zipfile,shutil,os
root=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);v=json.loads((root/'package.json').read_text())['version'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
metadata=json.loads((root/'dist/electron/build.json').read_text());assert metadata['version']==v
asar=root/'dist/electron/win-unpacked/resources/app.asar';assert sha(asar)==metadata['asarSHA256']
exe=root/f'dist/desktop-app/DCSMCRAFT-{v}-Portable.exe';assert exe.stat().st_size>1000000
copy=out/exe.name
if copy.exists():copy.unlink()
try:os.link(exe,copy)
except OSError:shutil.copyfile(exe,copy)
docs=['README.md','desktop/README.md','DESKTOP-STREAMING.md','BUILDING.md','VALIDATION.md','THIRD_PARTY.md','TITAN-ASSETS.md','LICENSE']
html=out/f'DCSMCRAFT-Browser-{v}.zip'
with zipfile.ZipFile(html,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.write(root/'dist/DCSMCRAFT-Standalone.html','DCSMCRAFT-Browser/DCSMCRAFT.html')
 for name in docs:z.write(root/name,'DCSMCRAFT-Browser/'+('DESKTOP.md' if name=='desktop/README.md' else name))
 for f in (root/'public').rglob('*.txt'):
  if any(s in f.name.upper() for s in ['NOTICE','LICENSE','OFL']):z.write(f,'DCSMCRAFT-Browser/notices/'+f.relative_to(root/'public').as_posix())
files=[n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=root,text=True).splitlines() if(root/n).is_file()]
source=out/f'dcsmcraft-source-v{v}.zip'
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for name in files:z.write(root/name,'dcsmcraft/'+name)
for file in [html,source]:
 with zipfile.ZipFile(file) as z:assert z.testzip() is None;assert len(z.namelist())==len(set(z.namelist()))
with zipfile.ZipFile(source) as z:
 for name in files:assert hashlib.sha256(z.read('dcsmcraft/'+name)).hexdigest()==sha(root/name),name
checks={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in [copy,html,source]};(out/f'DCSMCRAFT-v{v}-checksums.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks,indent=2))
