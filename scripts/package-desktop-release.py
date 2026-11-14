"""Package the offline Electron release, updated HTML, full source and notices.
Run only after builds/tests: python scripts/package-desktop-release.py --output DIR
GitHub Release assets support the portable executable's >100 MiB size.
"""
from pathlib import Path
import argparse,hashlib,json,subprocess,zipfile,shutil,os,mmap
root=Path(__file__).resolve().parents[1];p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True);v=json.loads((root/'package.json').read_text())['version'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
metadata=json.loads((root/'dist/electron/build.json').read_text());assert metadata['version']==v
asar=root/'dist/electron/win-unpacked/resources/app.asar';assert sha(asar)==metadata['asarSHA256']
exe=root/f'dist/desktop-app/DCSMCRAFT-{v}-Portable.exe';assert exe.stat().st_size>1000000
copy=out/exe.name
if copy.exists():copy.unlink()
try:os.link(exe,copy)
except OSError:shutil.copyfile(exe,copy)
docs=['END-CITIES.md','END.md','CONTROLS-UI-POLISH.md','CONTROLLERS.md','ACHIEVEMENTS.md','README.md','desktop/README.md','DESKTOP-STREAMING.md','BUILDING.md','VALIDATION.md','THIRD_PARTY.md','TITAN-ASSETS.md','LICENSE']
html=out/f'DCSMCRAFT-Browser-{v}.zip'
with zipfile.ZipFile(html,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.write(root/'dist/DCSMCRAFT-Standalone.html','DCSMCRAFT-Browser/DCSMCRAFT.html')
 for name in docs:z.write(root/name,'DCSMCRAFT-Browser/'+('DESKTOP.md' if name=='desktop/README.md' else name))
 for f in (root/'public').rglob('*.txt'):
  if any(s in f.name.upper() for s in ['NOTICE','LICENSE','OFL']):z.write(f,'DCSMCRAFT-Browser/notices/'+f.relative_to(root/'public').as_posix())
# The previous browser-based Windows edition ships separately beside Electron.
legacy=root/'dist/desktop/DCSMCRAFT.exe';assert legacy.is_file(),'Build the Windows HTML launcher with npm run build:desktop:legacy'
standalone=root/'dist/DCSMCRAFT-Standalone.html';html_hash=sha(standalone)
with standalone.open('rb') as f:header=f.read(64)
with legacy.open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as binary:
 assert binary[:2]==b'MZ';offset=binary.find(header);assert offset>=0
 view=memoryview(binary)[offset:offset+standalone.stat().st_size];assert hashlib.sha256(view).hexdigest()==html_hash;view.release()
 assert binary[offset+standalone.stat().st_size]==0
legacy_zip=out/f'DCSMCRAFT-Windows-HTML-{v}.zip'
with zipfile.ZipFile(legacy_zip,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 folder='DCSMCRAFT-Windows-HTML/'
 z.write(legacy,folder+'DCSMCRAFT.exe')
 z.writestr(folder+'START-HERE.txt',f"DCSMCRAFT {v} — Windows HTML launcher\n\nExtract the ZIP and run DCSMCRAFT.exe on Windows 10/11 x64. Requires installed Microsoft Edge or Google Chrome. Singleplayer is offline.\n\nUses the original %LOCALAPPDATA%\\DCSMCRAFT\\DesktopProfile save location. The separate bundled-runtime EXE uses DesktopApp. Export/import world backups when switching profiles.\n\nBoth editions include the same {v} game and achievement system. Open Pause → Achievements. The executable is unsigned; native Windows launch is unverified on this Linux host.\n")
 for name in docs:z.write(root/name,folder+('DESKTOP.md' if name=='desktop/README.md' else name))
 for f in (root/'public').rglob('*.txt'):
  if any(s in f.name.upper() for s in ['NOTICE','LICENSE','OFL']):z.write(f,folder+'notices/'+f.relative_to(root/'public').as_posix())
with zipfile.ZipFile(legacy_zip) as z:
 assert z.testzip() is None
 with z.open('DCSMCRAFT-Windows-HTML/DCSMCRAFT.exe') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==sha(legacy)
legacy_report=out/f'DCSMCRAFT-Windows-HTML-{v}-verification.json'
legacy_report.write_text(json.dumps({'version':v,'standaloneHTML_SHA256':html_hash,'windowsEXE_SHA256':sha(legacy),'windowsPEEmbeddedPayloadMatches':True,'windowsPEPayloadOffset':offset,'zipVerified':True,'nativeWindowsExecutionTested':False},indent=2)+'\n')
files=[n for n in subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=root,text=True).splitlines() if(root/n).is_file()]
source=out/f'dcsmcraft-source-v{v}.zip'
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for name in files:z.write(root/name,'dcsmcraft/'+name)
for file in [html,source]:
 with zipfile.ZipFile(file) as z:assert z.testzip() is None;assert len(z.namelist())==len(set(z.namelist()))
with zipfile.ZipFile(source) as z:
 for name in files:assert hashlib.sha256(z.read('dcsmcraft/'+name)).hexdigest()==sha(root/name),name
checks={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in [copy,html,legacy_zip,legacy_report,source]};(out/f'DCSMCRAFT-v{v}-checksums.json').write_text(json.dumps(checks,indent=2)+'\n');print(json.dumps(checks,indent=2))
