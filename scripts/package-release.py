"""Package already-built DCSMCRAFT artifacts using only Python's standard library.

Run from the repository after npm run build, build:standalone and build:desktop.
Pass --verify-manifest /path/to/tested-input-hashes.json to enforce a test freeze.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import json
import shutil

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root.parent / 'artifacts'))
parser.add_argument('--verify-manifest')
args = parser.parse_args()
art = Path(args.output).resolve()
art.mkdir(parents=True, exist_ok=True)
version = json.loads((root / 'package.json').read_text())['version']
html = root / 'dist/DCSMCRAFT-Standalone.html'
exe = root / 'dist/desktop/DCSMCRAFT.exe'
if args.verify_manifest:
    expected = json.loads(Path(args.verify_manifest).read_text())
    for name, digest in expected.items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, f'Tested input changed: {name}'
for source, name in [(html, f'DCSMCRAFT-Standalone-v{version}.html'), (html, 'DCSMCRAFT-Standalone.html'), (exe, 'DCSMCRAFT.exe')]:
    shutil.copyfile(source, art / name)
docs = ['README.md', 'FEATURES.md', 'VALIDATION.md', 'MULTIPLAYER.md', 'LICENSE', 'THIRD_PARTY.md', 'PERFORMANCE.json', 'PERFORMANCE.md', 'STANDS.md', 'AQUATIC.md', 'CONTENT.md', 'OVERWORLD.md', 'WEAPONS.md', 'APPEARANCE.md', 'ITEMS-ARROWS.md', 'ART-COMPLETION.md', 'GIGANTO.md', 'LIGHTING.md', 'TITAN-ASSETS.md', 'GIGANTO-MUSIC.md', 'TITAN-OVERHAUL.md', 'TITAN-COMBAT.md', 'TITAN-CYLOOP.md', 'GIGANTO-REFINEMENT.md', 'GIGANTO-MOBILITY.md', 'GIGANTO-CINEMATICS.md', 'GIGANTO-ASCENT.md', 'GIGANTO-VOLLEY.md', 'GIGANTO-SWEEPS.md', 'GIGANTO-ARTICULATION.md', 'GIGANTO-PRESENTATION.md', 'GIGANTO-MUSIC-DIRECTION.md', 'GIGANTO-CINEMATIC-OVERHAUL.md', 'GIGANTO-CHEST-FINALE.md', 'GIGANTO-RETURN-PORTAL.md', 'GIGANTO-DETONATION.md', 'GIGANTO-SCORE-SEGMENTS.md', 'GIGANTO-FLIGHT-CYLOOP.md', 'GIGANTO-CHOREOGRAPHY.md', 'GIGANTO-INTERFACE.md', 'GIGANTO-COLOSSUS.md', 'CONTROLLERS.md', 'OVERWORLD-STREAMING.md', 'GIGANTO-HIGHLANDS.md', 'WOOL-WATER-RESTORATION.md']
root_files = ['AGENTS.md', '.gitignore', '.dockerignore', '.nvmrc', '.node-version', 'BUILDING.md', 'AUDIT.md', 'SAVE-DURABILITY.md', 'render.yaml', *docs, 'index.html', 'package.json', 'package-lock.json', 'playwright.config.js', 'playwright.smoke.config.js', 'playwright.regression.config.js', 'vite.config.js']
source_files = [root / n for n in root_files]
for folder in ['src', 'public', 'scripts', 'desktop', 'server', 'tests', 'reference', '.github']:
    source_files += [p for p in (root / folder).rglob('*') if p.is_file() and p.name != 'payload.hpp' and not p.name.startswith('overworld-music-data.js') and p.name not in ['worker-code.js','titan-model-data.js','giganto-score-data.js','titan-prelude-data.js','titan-boost-data.js']]
with ZipFile(art / f'dcsmcraft-source-v{version}.zip', 'w', ZIP_DEFLATED) as z:
    for p in sorted(source_files):
        z.write(p, f'dcsmcraft-source-v{version}/{p.relative_to(root)}')

# The optional relay package is ready to run after installing Node; it contains
# the pure-JS ws runtime and its license, with no npm/network step on first run.
relay_files = [(html, 'dist/DCSMCRAFT-Standalone.html'), (root / 'MULTIPLAYER.md', 'START-HERE.md'), (root / 'STANDS.md', 'STANDS.md')]
for folder, dest in [('server', 'server'), ('node_modules/ws', 'node_modules/ws')]:
    for p in sorted((root / folder).rglob('*')):
        if p.is_file():
            relay_files.append((p, f'{dest}/{p.relative_to(root / folder)}'))
relay_package = {'name': 'dcsmcraft-survival-creative-relay', 'version': version, 'private': True, 'type': 'module', 'scripts': {'start': 'node server/relay.mjs', 'public': 'node server/public-relay.mjs'}, 'dependencies': {'ws': '8.18.3'}}
with ZipFile(art / f'DCSMCRAFT-Multiplayer-Server-{version}.zip', 'w', ZIP_DEFLATED) as z:
    for p, dest in relay_files:
        z.write(p, f'Multiplayer-Server/{dest}')
    z.writestr('Multiplayer-Server/HOST-PUBLIC.cmd', '@echo off\r\ncall "%~dp0server\\HOST-PUBLIC.cmd"\r\n')
    z.writestr('Multiplayer-Server/HOST-SERVER.cmd', '@echo off\r\ncall "%~dp0server\\HOST-SERVER.cmd"\r\n')
    z.writestr('Multiplayer-Server/package.json', json.dumps(relay_package, indent=2) + '\n')
with ZipFile(art / f'DCSMCRAFT-Windows-{version}.zip', 'w', ZIP_DEFLATED) as z:
    for p in sorted((root / 'dist/desktop').rglob('*')):
        if p.is_file() and p.name != 'payload-check':
            z.write(p, f'DCSMCRAFT-Windows/{p.relative_to(root / "dist/desktop")}')
    # The launcher embeds this HTML and the relay carries the browser fallback
    # below. Avoid a third identical full soundtrack copy in the Windows ZIP.
    z.writestr('DCSMCRAFT-Windows/OPEN-BROWSER.cmd', '@echo off\r\nstart /wait "" "%~dp0DCSMCRAFT.exe" --extract-only\r\nif errorlevel 1 exit /b 1\r\nstart "" "%LOCALAPPDATA%\\DCSMCRAFT\\Game\\index.html"\r\n')
    for n in docs:
        z.write(root / n, f'DCSMCRAFT-Windows/{n}')
    for p in sorted((root/'reference').rglob('*')):
        if p.is_file():z.write(p,f'DCSMCRAFT-Windows/{p.relative_to(root)}')
    for p, dest in relay_files:
        if p != html:  # The self-contained EXE extracts this payload for hosting/browser helpers.
            z.write(p, f'DCSMCRAFT-Windows/Multiplayer-Server/{dest}')
    z.writestr('DCSMCRAFT-Windows/HOST-PUBLIC.cmd', '@echo off\r\ncall "%~dp0Multiplayer-Server\\HOST-PUBLIC.cmd"\r\n')
    z.writestr('DCSMCRAFT-Windows/Multiplayer-Server/HOST-PUBLIC.cmd', '@echo off\r\ncall "%~dp0server\\HOST-PUBLIC.cmd"\r\n')
    z.writestr('DCSMCRAFT-Windows/Multiplayer-Server/HOST-SERVER.cmd', '@echo off\r\ncall "%~dp0server\\HOST-SERVER.cmd"\r\n')
    z.writestr('DCSMCRAFT-Windows/Multiplayer-Server/package.json', json.dumps(relay_package, indent=2) + '\n')
shutil.copyfile(art / f'DCSMCRAFT-Windows-{version}.zip', art / 'DCSMCRAFT-PC.zip')
with ZipFile(art / f'dcsmcraft-build-v{version}.zip', 'w', ZIP_DEFLATED) as z:
    for p in sorted((root / 'dist').rglob('*')):
        # This archive is the deployable web build. Offline HTML and desktop
        # binaries have their own complete ZIPs; do not duplicate them here.
        rel = p.relative_to(root / 'dist')
        if p.is_file() and not (p.suffix == '.glb' and rel.parts[:2] == ('models','titan')) and rel.parts[0] != 'desktop' and p.name != 'DCSMCRAFT-Standalone.html' and not (p.suffix == '.mp3' and rel.parts[:2] in [('audio','overworld'), ('audio','creative'), ('audio','giganto')]):
            z.write(p, f'dcsmcraft-build-v{version}/{p.relative_to(root / "dist")}')
    for n in docs:
        z.write(root / n, f'dcsmcraft-build-v{version}/{n}')
    for p in sorted((root/'reference').rglob('*')):
        if p.is_file():z.write(p,f'dcsmcraft-build-v{version}/{p.relative_to(root)}')

names = [f'DCSMCRAFT-Windows-{version}.zip', 'DCSMCRAFT.exe', f'DCSMCRAFT-Standalone-v{version}.html', f'DCSMCRAFT-Multiplayer-Server-{version}.zip', f'dcsmcraft-source-v{version}.zip', f'dcsmcraft-build-v{version}.zip']
manifest = {}
for name in names:
    p = art / name
    manifest[name] = {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
    assert p.suffix != '.zip' or p.stat().st_size < 100 * 1024 * 1024, f'Public Git download ZIP exceeds 100 MiB: {name}'
    if p.suffix == '.zip':
        with ZipFile(p) as z:
            assert z.testzip() is None, f'ZIP integrity error: {name}'
with ZipFile(art / f'DCSMCRAFT-Windows-{version}.zip') as z:
    assert z.read('DCSMCRAFT-Windows/DCSMCRAFT.exe') == exe.read_bytes()
    assert not any(n.endswith('.html') for n in z.namelist()), 'Windows ZIP duplicates the executable HTML payload'
    assert b'--extract-only' in z.read('DCSMCRAFT-Windows/OPEN-BROWSER.cmd')
    assert b'--extract-only' in z.read('DCSMCRAFT-Windows/Multiplayer-Server/server/HOST-SERVER.cmd')
assert html.read_bytes() in exe.read_bytes(), 'Executable does not embed this HTML'
(art / f'DCSMCRAFT-v{version}-checksums.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
