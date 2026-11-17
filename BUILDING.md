# Lord Verity — 2.25.0

Use the existing Node 24.22.1/npm 11.9.0 workflow. The prebuild/pretest hooks embed the committed original Lord Verity GLB. No paid model generation or Blender installation is needed to play/build; Blender 4.3+ can regenerate the asset with scripts/build-verity-model.py.

Run npm test and npx playwright test --config playwright.verity.config.js. The browser media test uses the original test-tone MP3 committed under tests/fixtures; the original song is not bundled. LORD-VERITY.md documents streaming restrictions, media import and controls. Update the relay with the game for protocol 7. Existing standalone, Electron, legacy Windows and packaging commands remain valid.

## Previous build notes

# Friends and dimensions — 2.24.0

Use Node 24.22.1/npm 11.9.0. Run `npm ci`, `npm test`, and `npx playwright test --config playwright.social.config.js --workers=1`. `npm run friends` starts the persistent account/friends/game relay; `npm run multiplayer` retains the classic relay. All clients and relay must use protocol 6.

Build with `npm run build:standalone`, `npm run build:desktop`, and `npm run build:desktop:legacy`. Set `DCSMCRAFT_SOCIAL_URL=https://your-service.example` during standalone/desktop builds to configure Friends by default. A game served directly by `npm run friends` discovers the same-origin service from `/health`. The in-game Connection Settings also accepts an operator's service address. See FRIENDS-REALMS.md for TLS, persistence, Docker/Caddy and Render deployment.

`python3 scripts/package-desktop-release.py --output DIR` packages the separate Windows editions, browser/source ZIPs and verification hashes. Do not distribute `data/`, account backups, TLS keys or local profiles.

## Previous build notes

# Multiplayer — 2.23.0

Use Node 24.22.1/npm 11.9.0. Run `npm ci`, `npm test`, then `npx playwright test --config playwright.multiplayer-update.config.js --workers=1`. The browser tests start a real relay and verify PvP, watching, media negotiation/fallback, guest Titan entry/exit and realm isolation. `npm run multiplayer` starts the relay for players (protocol 5). See MULTIPLAYER-UPGRADE.md.

Build both Windows editions using the existing standalone, Electron and legacy launcher commands below. `python3 scripts/package-desktop-release.py --output <directory>` packages the EXE, separate HTML launcher, browser and source. `npm run test:desktop` launches the packaged runtime and checks offline saves, import/export and both Titan portals.

## Previous build notes — 2.22.0

# Gameplay polish — 2.22.0

Use Node 24.22.1/npm 11.9.0. Run npm test, then npx playwright test --config playwright.gameplay-polish.config.js. Existing desktop regression and packaging commands remain valid. GAMEPLAY-POLISH.md documents changes, references and sound synthesis.

## Previous build notes

# Controls and achievement presentation — 2.19.0

The build commands below remain valid. This release adds `npx playwright test --config playwright.controls-ui.config.js` for notification, theme and free controller-cursor transactions. Run `npm test`, `npm run test:desktop:web` and `npm run test:desktop` for physics/targeting, encounter/regression and packaged-runtime coverage. The package script includes separate Windows runtime and HTML launcher downloads, browser/source ZIPs and checksums. See CONTROLS-UI-POLISH.md for scope and limitations.

## Previous release — 2.18.0

# Achievement update — 2.18.0

Use Node 24.22.1 / npm 11.9.0. npm ci, npm run build:standalone, npm run build:desktop (bundled Electron runtime), npm run build:desktop:legacy (previous browser-based launcher). Then python scripts/package-desktop-release.py --output OUTPUT_DIR produces separate runtime EXE, Windows HTML ZIP, Browser ZIP and Source ZIP, with payload checks and SHA-256 checksums.

npm test runs the unit suite. npm run test:desktop:web runs the existing progression/Titan browser regressions; npx playwright test --config playwright.achievements.config.js runs achievement UI/persistence/mobile/controller checks. npm run test:desktop tests the packaged app in an isolated profile. On Linux, use the matching Electron runtime and software WebGL; this does not establish native Windows/controller/GPU results. Main and the existing hosted mobile branch are not changed.

## Previous build notes — 2.17.0

# Offline desktop build — 2.17.0

Use Node 24.22.1 / npm 11.9.0. Run `npm ci`, `npm run build:standalone`, then `npm run build:desktop`. The new desktop output is `dist/desktop-app/DCSMCRAFT-2.17.0-Portable.exe`, with the complete runtime and local game assets bundled. Source and runtime details are in desktop/README.md and DESKTOP-STREAMING.md. The legacy browser-launcher command is explicitly named `build:desktop:legacy` and is not shipped as the desktop update.

Electron runtime archives are pinned to 45.3.0 and verified against explicit SHA-256 values. electron-builder 26.18.0 produces a standard user-level NSIS portable launcher; no signing certificate is configured. On Linux the game is tested in a matching Electron app, while native Windows launch remains unverified. Models, soundtracks and textures keep their original notices.

---

# Previous build/audit notes

# Reproducible source build

The review branch contains the unpacked application at the repository root. Its
baseline is the 667-file source archive from `downloads-v2.8.6`, commit
`696a15bc4310c3a5b2bb520eab615bb81fc6bbb1`; every imported file was byte-compared.
The remote default branch remains unchanged. No release or deployment is part of
this audit. Generated outputs stay in ignored `dist/`, `.desktop-cache/` and
`artifacts/`; supplied source assets remain under `public/` with their notices.

Use **Node 24 LTS, at least 24.22.1, and npm 11, at least 11.9.0**. The pinned,
verified combination is **Node 24.22.1 / npm 11.9.0**, recorded in `.nvmrc`,
`.node-version` and `packageManager`. Other Node/npm major versions are unsupported.

```sh
nvm install
nvm use
npm install --global npm@11.9.0
npm ci
npm test
npm run build
npm run build:standalone
npx playwright install --with-deps chromium
npm run test:smoke
```

`npm ci` must not change `package-lock.json`. The lock was regenerated with npm,
in an empty dependency directory, retaining all previous resolved versions.
`esbuild` is now an explicit build dependency at its existing resolved version.
No dependency was upgraded. Asset embedding and the terrain worker regenerate
from checked-in sources, including `pretest` generating the worker before unit
tests; no paid tool, external model download or credential is
required. CI executes these commands on Linux and does not publish anything.

`npm run dev` runs the development server. `npm run preview` serves the production
build. The standalone output is `dist/DCSMCRAFT-Standalone.html`: double-click it
in a desktop browser with WebGL 2. Singleplayer needs no server; public multiplayer
still needs a separately configured relay. Smoke tests serve the exact packaged
HTML over loopback because managed browser policies can block `file://` itself.

Optional Windows packaging: after the standalone build, set `DCSMCRAFT_ZIG` to
the compiler described in `desktop/TOOLCHAIN.json`, then run `npm run build:desktop:legacy`.
It cross-compiles the existing Windows launcher and verifies its embedded HTML
using a Linux extraction companion. This does not verify native Windows launch.
Full release ZIP packaging uses `python3 scripts/package-release.py --output artifacts`.
Packaging is local only; publication requires separate approval.

The local audit's save contract is in [SAVE-DURABILITY.md](SAVE-DURABILITY.md).
[AUDIT.md](AUDIT.md) records completed stages, verification and the continuation
checklist. `npm run test:regression` exercises the retained sandbox, Survival
co-op and Titan browser suites against the development server. Build standalone
first; leave source files unchanged during the run to avoid Vite hot reloads.
Those suites disable large-script tracing and use screenshots/assertions instead.

Mobile web app: `npm run build:mobile` writes `dist/mobile`. Serve all output files over HTTPS for iOS Home Screen installation and offline storage. See [MOBILE.md](MOBILE.md). The mobile build uses the same checked-in media as desktop, loaded separately; no external CDN is needed.


Wyvern 2.11.0 uses the checked-in optimized GLB at `public/models/wyvern/wyvern.glb`. `predev`, `pretest` and each browser/mobile prebuild regenerate its embedded payload automatically; Meshopt is decoded using Three.js's bundled decoder. No Sketchfab login, paid service, model download or extra runtime dependency is required. Asset provenance and optional animation authoring are documented in [WYVERN.md](WYVERN.md). Compact release archives, including mobile and model notices, can be reproduced after building with `python3 scripts/package-downloads.py --output artifacts`. The optional `--verify-manifest` flag checks a previously frozen build/test manifest before packaging.
