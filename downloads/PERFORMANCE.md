# Performance & Console Menu Audio — 2.7.1

## Held Items & Building Performance — 2.7.11

Ordinary edited meshes now run in existing terrain workers from copies of loaded cells, rather than synchronously remeshing on the rendering thread. Exact face/shape/AO dependency invalidation reduces an interior edit from five dirty chunks to one; edges touch two and corners four. Edited meshes are prioritized, in-flight edits coalesce, and stale revisions cannot replace newer cells. Each job copies at most nine loaded 196,608-byte chunks (1,769,472 bytes total); transferred copies leave authoritative buffers attached. The two-worker pool remains bounded. Startup/bootstrap and unsupported/failed-worker fallback still build synchronously.

The Wildflower fixture preloads chunks, edits at Y=200, uses render distance 2/AO, and pauses physics to isolate rendering work. Controlled headless Chromium/SwiftShader measurements compare a five-edit burst with twelve scheduling passes per edit: the old build executed 25 synchronous builds, taking **232–423 ms** per scheduling batch; the new path executed **zero synchronous builds**, with **0.2–1.0 ms** scheduling batches. New jobs coalesce, so these figures compare main-thread work, not equivalent per-edit render completion or universal FPS. Nine real placement/break handlers (stone, stairs, panes, fences, chest, torch, furnace, glass, slab) took roughly **0.7–3.6 ms** and **0.8–1.4 ms** respectively in the recorded fixture. Worker round trips were roughly **20–155 ms** including queue/message delivery; meshes can appear a few frames after the authoritative edit. Snapshot jobs, unchanged game buffers, newest mesh revisions, connected shapes, chest models and saved reloads are verified. The raw data is in [reference/edit-performance-2.7.11.json](reference/edit-performance-2.7.11.json).

Held-item framing separately caches a convex silhouette once per equip, using opaque sprite pixels rather than transparent texture padding. Frame work projects that small outline to anchor the lower edge through use/attack; equip lowering uses a smooth quadratic edge. It does not create extra render objects, alter weapon geometry or remesh terrain. Empty-hand and F5/wardrobe models remain. GPU uploads/shader compilation, simulation and other hardware/platform stalls are not all eliminated.


Existing worlds work without regeneration. This patch adds rendering controls and uses the four supplied menu cues; it adds no blocks, items, recipes or creatures. World generation remains 16 and multiplayer protocol remains 4. The broader unfinished content expansion is tracked in OVERWORLD.md.

## Graphics controls

Open Options → Video Settings. The existing pixel menu style remains, with Fast, Balanced and Detailed presets above the individual controls. Presets affect graphics only; they do not change your audio, controls, skin, inventory or world.

| New control | Choices | Purpose |
| --- | --- | --- |
| High-DPI Limit | 1×, 1.5×, 2× | Caps device pixel ratio before the existing resolution-quality multiplier. |
| Menu Framerate | 15, 30, 60, Match Gameplay | Reduces drawing while a menu is open. Default 30. Shared-world simulation continues at its existing tick rate. |
| Dropped Item Distance | 25–150% | Separate visual distance for dropped items. Does not delete items or change pickups. |
| Animated Block Distance | 16–128 blocks | Limits articulated chest/door/book/furnace/disc rendering and animation work. Does not change interactions or collisions. |
| Distant Terrain Detail | Fast, Balanced, Detailed | Changes coarse horizon sampling to steps 8, 4 or 2. Does not change real terrain, collision chunks or save data. |
| Shadow Resolution | 512, 1024, 2048 | Trades shadow-map memory/detail. |
| Shadow Coverage | 32, 64, 96 blocks | Changes the shadow camera coverage; larger coverage reduces detail at the same map size. |
| Shadow Filtering | Hard, Soft | Selects Basic or PCF soft filtering. |
| Nearby Block Lights | 0, 2, 4 | Caps nearby dynamic lights; the existing terrain lighting still applies. |
| Light Flicker | On, Off | Controls dynamic-light flicker. |
| Anisotropic Filtering | 1×, 2×, 4×, 8×, 16× | Hardware-capped filtering for angled textures. |

Settings persist locally. Start with Fast on slower hardware, then raise render distance or individual effects. Detailed is deliberately more demanding. Menu Framerate limits drawing, not server simulation; ordinary paused singleplayer still pauses as before. Background browser throttling remains outside the game's control.

## Removed repeated work

Settled terrain now skips full plan revision scans until an edit, streaming change, pending job or mesh-quality change invalidates it. Overlapping coarse horizon tiles retain consistent metadata, preventing unnecessary fallback rebuilds. Creature updates reuse position/vector storage; shared cloud material color updates occur once per frame. Nearby dynamic lighting uses the existing loaded-light index instead of the complete saved-edit history. Resolution changes happen only when the pixel ratio or viewport actually changes. Disabling/resizing shadows releases their old maps.

The reproduction script is `node scripts/benchmark-render-performance.mjs --baseline /path/to/2.7.0/src/renderer.js --output report.json`. The recorded report is `reference/render-performance-2.7.1.json`.

| Controlled workload | 2.7.0 | 2.7.1 |
| --- | ---: | ---: |
| 120 settled frames, 361 terrain plan entries | 43,320 revision checks | 0 after warming |
| 120 updates of 96 existing creature groups | 11,520 position clones | 0 |
| 30 nearby-light refreshes, 100,000 saved edits | 3,000,000 saved-edit visits | 0 |
| Sample horizon mesh vertices | Detailed 6,284 | Balanced 2,632; Fast 1,204 |

These are CPU workload/geometry measurements, not hardware FPS promises. Terrain generation and initial loading still cost CPU; high render distance, dense worlds and expensive effects can still be slow. Historical tornado benchmarks remain in PERFORMANCE.json.

## Supplied menu sounds

The user's unchanged MP3 is embedded offline and decoded once. The user confirmed these labels in playback order:

| Action | Cue | Source window |
| --- | --- | --- |
| Activate a button / valid world creation / change a selection or toggle | Select | 0.935–1.025 s |
| Enter a button / focus navigation | Hover | 2.235–2.545 s |
| Back / close / resume / quit / disconnect | Exit | 4.377–4.657 s |
| Move a slider | Slide | 6.356–6.446 s |

Short fades prevent boundary clicks; playback gains balance the differently recorded cues. No pitch changes or silent gaps are added. Up to four voices can play, with hover/slider throttling. Audio Options has Menu Sounds and Menu Volume, independent of world effects and music but still controlled by Master Volume. Muting stops active menu voices and never queues them for later. Browsers require an initial click/key gesture to unlock audio; hovering before that stays silent. Decode failure uses the existing small fallback effect without blocking a menu action.

Attribution and SHA-256 are in THIRD_PARTY.md and public/audio/MENU-SOUNDS-NOTICE.txt. Other supplied claim recordings and texture assets remain unchanged.

## Launch and limits

Extract the browser ZIP and open DCSMCRAFT.html in desktop Edge/Chrome. Singleplayer needs no local server or internet connection. The Windows ZIP contains a Windows 10/11 launcher using installed Edge/Chrome and the same embedded HTML; native Windows execution is unverified on the Linux build host. For development use `npm ci` then `npm run dev`; production builds use `npm run build`, `npm run build:standalone` and `npm run build:desktop`. Multiplayer still requires a reachable matching relay; see MULTIPLAYER.md. Export a world backup before changing browser profiles or moving files because local saves belong to that browser/origin.

Automated browser tests use the exact standalone bytes served locally with external requests blocked; direct file navigation and native Windows launch are not claimed as tested. This patch does not establish full Minecraft parity or a bug-free game. FEATURES.md, CONTENT.md and OVERWORLD.md retain the complete partial/missing feature lists.
