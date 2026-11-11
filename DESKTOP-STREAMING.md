# DCSMCRAFT 2.17.0 — offline desktop and terrain streaming

## Download and play

Run **DCSMCRAFT-2.17.0-Portable.exe** on Windows 10/11 x64. The single download contains the game, Electron 45.3.0, Chromium, texture packs, supplied models and music. No installed browser, Node.js, Unity, loose HTML file or local server is required. It extracts its internal runtime automatically. Singleplayer works offline; multiplayer remains an optional network feature. The app still uses the existing HTML/JavaScript game internally, rather than a native engine rewrite.

The app is unsigned. Windows may mark it as unfamiliar. Actual native Windows execution is **not tested on this Linux build host**; the identical packaged game is tested in the matching Linux Electron runtime, and the Windows payload is statically extracted and verified. There is no claim of zero bugs or a Windows hardware FPS guarantee.

## Terrain changes

- Detailed chunks now take over complete columns atomically. The old screen-space pixel-dither fade could expose holes between differently shaped coarse and detailed surfaces; it has been removed. Coarse terrain stays opaque until its detailed replacement is installed.
- Heightfield previews fill missing coarse tiles, at most one per frame. They sample terrain directly and do not create collision chunks, loot, containers, entities or saved edits. Full worker meshes replace previews without a gap. Even the lowest view distance has fallback coverage.
- Chunk-grid skirts extend the coarse surface down to the world floor. Boundary faces sample ownership slightly inside their own column so an adjacent detailed chunk cannot discard the wrong wall.
- Ready uploads prioritize nearby terrain and edited meshes. Queued surface-only results are rejected if the player has moved close enough to require full geometry. Revision and epoch checks remain authoritative.
- The existing two-worker limit, bounded upload queue, per-frame upload budget, hidden-face meshing and frustum culling remain. Coarse heightfields do not cast expensive dynamic shadows. Stationary solid coverage does not upload a new mask every frame.
- Streaming/resource ownership moved from the camera/animation renderer into `src/terrain-streaming.js`; common geometry/worker helpers remain in `src/terrain-stream.js`. Public Renderer entrypoints remain compatible.

Previews approximate distant terrain, vegetation and structures; caves are revealed by detailed chunks. Shape/detail changes can still be visible as real geometry arrives. Skirts are visual geometry, not new world blocks. This is not a guarantee of seamless infinite-distance terrain or faster FPS on every graphics driver.

## Desktop packaging and saves

Mobile and desktop share `scripts/build-local-game.mjs`. Desktop sets the mobile flag false, bundles local media/model files and loads them on demand, reducing the startup JS/CSS payload to about 4.4 MB instead of parsing the standalone HTML's embedded media. The complete offline package still contains those assets.

The app serves only files inside its packaged game via `dcsmcraft://game`; renderer Node integration is disabled, context isolation and sandboxing are enabled, and the preload exposes only Quit. The stable profile is `%LOCALAPPDATA%\DCSMCRAFT\DesktopApp`. Closing pauses the game and awaits a durable save; failed/session-only storage offers Retry, Cancel or explicit Quit Without Saving.

The previous HTML/browser-launcher saves remain in their existing browser profiles, including `%LOCALAPPDATA%\DCSMCRAFT\DesktopProfile`. They are not overwritten or automatically copied between Chromium profiles. **Export a backup from the old game and use Singleplayer → Import backup in this app.** Imports create separate worlds. Existing save format, generator versions, block IDs, gameplay rules, combat tuning, original textures/models/audio and Titan progress remain unchanged.

## Validation

- **928 unit tests pass**, including save recovery, crafting, mining, light/mesh invalidation, both Titan simulations and the new ownership/preview/desktop lifecycle checks.
- **Eight browser regressions pass**: wood→crafting/tools; progressive mining→ores→smelting/building; night survival/death/respawn; atomic reload of containers/inventory/entities; moving chunk streaming and seam persistence; full Giganto phases/defeat/retry/finish; full Wyvern traversal/phases/save/return; and physical post-parry Homing Attack/jump rendering.
- The matching Electron app is exercised with HTTP networking blocked: world creation, travel, bounded queues and binary coverage, cross-chunk edits, unsaved edit persistence on window close, relaunch/reload, native backup download/import, local Titan model loading, arena return and Quit. Native Windows UI/controller/audio-device execution remains outside this host's verification.
- The portable EXE is unpacked, and its Windows entrypoint and app.asar are hashed against the verified runtime and the game used in Linux tests. Source assets are compared against the unchanged pre-update baseline.

Machine-readable results and screenshots are shipped with the verification download. Preview sampling on this host was roughly 0.3–0.5 ms warm and 4.5 ms cold for a sample tile, with zero simulation chunks generated. Software-renderer frame intervals are recorded for diagnosis, not presented as native GPU performance results.

## Rebuild

Use Node 24.22.1 / npm 11.9.0. `npm ci`, `npm run build:standalone`, `npm run build:desktop`. The desktop builder verifies official Electron archive hashes, builds an ASAR and invokes electron-builder's standard NSIS portable target. On Linux it also creates a matching runtime for local verification. `node tests/desktop/runtime.mjs` tests an isolated temporary profile, not your real saves. Full script details are in desktop/README.md.
