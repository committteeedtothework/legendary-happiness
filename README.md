## Choose your Windows edition

- [Bundled runtime app](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-2.17.0-Portable.exe): contains Electron/Chromium and runs independently of an installed browser.
- [Previous Windows HTML launcher](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-Windows-HTML-2.17.0.zip): extract the ZIP and run DCSMCRAFT.exe; requires installed Microsoft Edge or Chrome. Uses the original DesktopProfile save location.
- [Standalone browser HTML](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-Browser-2.17.0.zip): extract and open DCSMCRAFT.html in a desktop browser.

All three contain the same 2.17.0 game updates and work offline in singleplayer. Profiles are separate; use world backup export/import when switching. The Windows HTML launcher's embedded payload matches the tested browser build byte for byte. Both Windows executables are unsigned; native Windows launch is unverified on this Linux host. [Launcher verification](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-Windows-HTML-2.17.0-verification.json).

DCSMCRAFT 2.17.0

The Windows download is a self-contained portable app. Run DCSMCRAFT-2.17.0-Portable.exe; no separate browser, HTML file, Node.js, local server or Unity is required. The existing game still uses HTML/JavaScript internally. Singleplayer works offline; multiplayer needs its relay.

Terrain: removed screen-pixel dither holes, added opaque fallback terrain while chunks load, extended coarse boundary skirts, prioritized nearby/edited uploads and discarded stale LOD results. Streaming and local asset packaging now have separate modules. Original world generation, gameplay/combat rules, supplied art/music and save format are preserved.

World transfer: export a backup from your previous browser/launcher build, then use Singleplayer → Import backup in this app. Existing browser profiles and saves are not overwritten. Closing the app pauses and waits for a durable save.

Validation: 928 unit tests and eight browser regressions pass, including complete Giganto and Wyvern cycles. The matching Linux Electron runtime passes offline creation, travel, save-on-close, relaunch, backup import/export and local model loading. The Windows payload is extracted and hash checked against the tested game. Native Windows launch, Windows controller/audio devices and hardware FPS are not verified on this Linux host. The app is unsigned. Distant previews are approximate; detail changes can still be visible.

Downloads: portable Windows x64 EXE, optional Browser ZIP, complete Source ZIP, verification archive with machine-readable results and in-game screenshots, and SHA-256 checksums. The default branch and hosted mobile build remain unchanged.

## Direct downloads

- [DCSMCRAFT-2.17.0-Portable.exe](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-2.17.0-Portable.exe)
- [DCSMCRAFT-Browser-2.17.0.zip](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-Browser-2.17.0.zip)
- [dcsmcraft-source-v2.17.0.zip](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/dcsmcraft-source-v2.17.0.zip)
- [DCSMCRAFT-Verification-2.17.0.zip](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-Verification-2.17.0.zip)
- [DCSMCRAFT-v2.17.0-checksums.json](https://github.com/committteeedtothework/legendary-happiness/raw/refs/heads/downloads-v2.17.0/DCSMCRAFT-v2.17.0-checksums.json)

The Windows executable is stored using Git LFS on the separate downloads branch. Each URL serves the actual download. The source branch is `desktop-stream-2.17.0`; `main` and Pages remain unchanged.
