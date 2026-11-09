# DCSMCRAFT Unity — separate native migration

The original playable builds remain unchanged. **This is an unfinished source project, not a tested Windows executable or a completed gameplay port.**

- [DCSMCRAFT-Unity-Media-v0.1.0.zip](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/22720628de2e8b349d99075a94b959f9cf72765d/downloads/unity/DCSMCRAFT-Unity-Media-v0.1.0.zip)
- [DCSMCRAFT-Unity-Models-Art-v0.1.0.zip](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/22720628de2e8b349d99075a94b959f9cf72765d/downloads/unity/DCSMCRAFT-Unity-Models-Art-v0.1.0.zip)
- [DCSMCRAFT-Unity-Project-v0.1.0.zip](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/22720628de2e8b349d99075a94b959f9cf72765d/downloads/unity/DCSMCRAFT-Unity-Project-v0.1.0.zip)

Download Project, install/activate Unity 6000.0.62f1 with Windows Build Support, then run Build-Windows.cmd. Assets can be restored from local Media/Models-Art ZIPs or the script’s verified HTTPS downloads.


---

# Native Unity feature status

Status describes C# implementation, not successful Unity runtime verification. **No system has been playtested in Unity yet.** The source archive preserves the full browser game, independently of the native port.

| System | Native implementation | Remaining work |
|---|---|---|
| Data/content | All 2,625 block definitions, 1,125 items, 1,292 recipes, 39 mob definitions and 11 skins migrated; full original metadata retained | Port special behavior for most advanced blocks/items |
| World | Deterministic generation 1, height −64…319, six biomes, oceans, caves, ores, basic trees, Cinder terrain | Exact generation-16 parity, diverse caves, rivers/lakes, structures, villages, temples, mineshafts, full Cinder generation |
| Rendering | Chunk meshes, hidden-face removal, Unity frustum culling, two CPU mesh workers, nearby-first streaming, bounded uploads, collision meshes, three pixel-art packs | Unity profiling, distant LODs/occlusion, smooth streaming under fast travel, animated block/fluid materials |
| Lighting | Native block-light flood propagation, occlusion, neighbor chunk invalidation, separate skylight/emission shader inputs; core tested | Full skylight propagation, natural lava emission discovery, large-world lighting scalability, Unity shadow/shader verification |
| Movement | First/third person, walk/run/double-W sprint, Shift crouch, jump, gravity, collisions, basic swimming, Creative flight | Reference camera/physics parity, boats, precise shaped collision/movement behavior, complete controller menus/settings/presets, touch/mobile |
| Block interaction | DDA targeting, progressive hardness/tool-tier mining, drops, solid placement exclusion, static shape meshes | Orientation/state interactions, doors, stairs refinement, block updates, gravity blocks, flowing fluids, fire, explosions, redstone-like behavior |
| Inventory | Nine-slot hotbar, 36 slots, stack limits, consumption, pickups/drops, chest transfer, persistence | Armor/offhand/cursor drag/split/swap UI, durability use/equipment, full reference layout and recipes UI |
| Crafting/smelting | Atomic shaped/shapeless recipe engine with alternatives, grid matching, recipe-click crafting, native furnace/fuel/cooking | Actual 2×2/3×3 cursor crafting interface, advanced workstations, experience/enchantments/anvils/brewing/farming |
| Survival | Health/hunger, basic regeneration/starvation, oxygen/suffocation/fall damage, death drops and respawn | Saturation parity, armor/shield/projectiles/status effects, exact combat cooldowns/criticals, beds/spawn rules, difficulty |
| Creatures | 39 converted models available; basic wandering/chasing/fleeing/melee; initial wildlife, Creative eggs, saved entities | Full spawn/despawn rules, nighttime ecology, pathfinding, breeding, trading, villages/guardians/Golem/Watcher behaviors, bosses outside Titans |
| Environment | Day/night lighting, Cinder terrain generator exists | Weather, snow/tornadoes, fishing, renewable ecology, full dimension portals and survival progression |
| Audio | Original files retained; native streamed music, explicit phase cue regions, dual DSP-scheduled sources, pause and stale-request cancellation | Positional SFX/events, full soundscape, playlist sequencing/fades, Unity device/pause/latency tests |
| Character art | 11 skin GLBs with two simple native locomotion clips each, 39 mob GLBs, 61 tool/weapon GLBs, all icons and packs | Complete held/third-person animations, skin preview, armor fit, bow draw/projectiles, custom weapons/stands and their mechanics |
| Giganto | Actual model/36 clips migrated; native arena prototype with objective/transform/two phases, basic swing/slap/stomp/beam, parry/dodge/homing/melee/Boom, victory/retry/return/reward ledger | Complete current choreography, ascent, cinematic QTEs/finishers, advanced moves/combos, polished camera/UI, precise hitboxes, VFX and audio synchronization |
| Wyvern | Actual model/11 clips migrated; native flight arena prototype with missiles/parry/homing, two phases, victory/retry/return | Tower/traversal rails, varied canyon chase, full missile/finger-flick/counters/QTE choreography, natural rig constraints and full boss moveset |
| Sonic/Super Sonic | Actual rig and 53 source clips migrated; native run/jump/flight/basic attack playback, simple gold material/morph transformation; no energy meter | Accurate full Super rig/quills/materials, all relevant moves/counters/cinematics, blending/contact/collision polish |
| Automation | Original source/data preserved | Native circuits, pistons, observers, hoppers, comparators, dispensers, tick-accurate transfers |
| Saves | Separate checksummed format with backup/interrupted-save recovery; edits, inventory, containers, furnaces, mobs/drops and Titan reward ledger | Browser save import, full simulation state, multiple-world selection/migration |
| UI/controls | Native title/new/load/options/pause, inventory/chest/furnace/recipe/Creative prototype, three quality levels | Full menu parity, arena-only settings/HUD polish, controller glyphs/presets, mobile UI/accessibility |
| Networking | Original relay/server/client source preserved | Native networking, authoritative world simulation, public relay, chat/commands, anti-duplication/concurrency testing |
| Distribution | Separate source/assets archives, pinned dependencies, Windows CLI scripts | Unity compilation and import verification, actual native Windows EXE, installers/signing, Android/iOS/WebGL builds |

The browser version remains the complete playable baseline. “Preserved” means recoverable source/assets, not an embedded browser renderer or a completed native system. The new C# runtime does not launch Electron, Chromium, Three.js, or the browser game.

---

# Can Giganto and Wyvern look better in Unity?

**Yes.** Unity 6 with URP can improve shadow stability, physically based materials, exposure/tonemapping, animation transitions, camera control, particles, and profiling. It does not automatically improve source geometry, create missing animation, or make an encounter match Sonic Frontiers.

## Already prepared in source

- URP 17.0.4, linear color, ACES tonemapping, restrained bloom and directional soft shadows.
- Three scalable levels: render scale 0.75/1/1.15, shadow distance 60/140/260, 1/2/4 cascades; world chunk radius 3/5/7.
- Actual source models converted to native-importable GLB 2.0 with embedded PNG textures, decoded vertex buffers and named animation clips. No external WebP/Meshopt decoder is required for the exported native art.
- Sonic: 10,414 triangles, 30 unique joints, 53 clips. Giganto: 42,145 triangles, 152 unique joints, 36 clips. Wyvern: 67,205 triangles, 403 unique joints, 11 clips.
- glTFast runtime loading shares imported model resources. Animation crossfades, shadow-casting meshes and bone-attached collision capsules are implemented in the prototype.
- Chunk rendering uses worker-generated meshes rather than one object per voxel; asset atlases retain point sampling.

These are configured/converted features. The Unity shader, imports, animation playback, lighting and visual quality have **not been verified in a running Unity build**. Model/clip counts are validated GLB contents, not a claim that every clip is wired to a finished native move.

## Highest-value next passes

1. Open/import and compile in the actual Editor, compare the converted model orientation/materials against the shipped browser build, verify color space and skinning.
2. Port complete existing encounter choreography and action events before retuning. The present native fights are deliberately identified as prototypes, with many source actions not connected yet.
3. Author Unity animation state machines/rig constraints, cinematic timelines/cameras, intentional contact poses and event-synchronized hitboxes/audio. Do not stretch Sonic to simulate speed.
4. Add detailed arena terrain layers, vegetation instancing/LODs, authored rocks/ruins, atmosphere, contact shadows and restrained GPU particles. No detailed arena art has been newly generated in this migration.
5. Profile CPU, GPU, draw calls, memory and worst-case particles/skin deformation on a Windows PC. Wyvern's 403-joint rig and 67K triangles deserve special attention; use reduction/LODs only after visual comparisons.

HDRP could provide higher-cost volumetrics and richer high-end effects in a separate Windows-focused branch. It is not configured here and would reduce portability to mobile/WebGL. URP is a practical starting renderer for the requested desktop port. No UE5-quality or 1:1 fidelity claim is made; there are no Unity in-game screenshots or measured FPS results yet.

## Verified reference sources

- [Unity 6000.0.62f1 release](https://unity.com/releases/editor/whats-new/6000.0.62f1)
- [Unity 6 command-line arguments](https://docs.unity3d.com/6000.0/Documentation/Manual/EditorCommandLineArguments.html)
- [Unity URP source package/version](https://github.com/Unity-Technologies/Graphics/blob/6000.0/staging/Packages/com.unity.render-pipelines.universal/package.json)
- [Unity glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.20/manual/index.html)

Research confirms package/API availability; it cannot substitute for running and profiling the Editor.

---

# Validation and remaining gates

## Performed here

- Engine-independent C# compiled with .NET SDK 8.0.427/Roslyn, then **5,427 assertions passed, zero failures**. These include 5,250 catalog UV assertions, not 5,427 different gameplay scenarios.
- Behavioral checks cover original JavaScript seed/hash/noise parity (including Unicode), negative chunk coordinates, deterministic native terrain, vertical bounds, DDA targeting, hidden-face and collision mesh generation, stable worker snapshots, neighboring/distant chunk invalidation, torch propagation/occlusion/removal across a chunk boundary, atomic recipe alternatives and full-inventory rollback, slot-transfer conservation, furnace fuel/output continuity, checksum/backup/interrupted-save recovery, prototype Titan objective/transform/phase gates/rewards/music regions and victory time freeze.
- One native CPU chunk generation/meshing sample: about 36 ms, 10,536 vertices. This is not Unity FPS, not a browser speed comparison and not a large-world performance guarantee.
- All native C# parsed without syntax errors. **No Unity API type resolution or shader compilation** was performed by that parser.
- Migration validator checked every one of 893 original files byte-for-byte and confirmed the browser source was unchanged. All 114 converted GLB models and six PNG atlas/icon sheets were checked against their hashes. GLBs have embedded buffers/textures, valid GLB 2.0 headers, PNG images and recorded clip names. No WebP/Meshopt/Draco decoder requirement remains in these converted files.
- Content: 2,625 block definitions, 1,125 items, 1,292 recipes, 39 mob models, 11 skin models, 61 weapons/tools, three Titan models with **100 named clips**. Skin models add 22 simple locomotion clips.

Machine-readable records: `Tests/Core/results.json`, `Verification/migration.json`, `Reference/source-manifest.json`, `Reference/art-manifest.json` and downloadable bundle checksums.

## Not performed / required before a playable release

Unity Editor/Hub and an activated license are absent from this environment. The Editor download alone exceeds the available free space, so no installation or license activation was attempted. A .NET SDK was used solely to verify the independent core.

No Unity Editor compilation, Package Manager resolution, PlayMode session, shader compilation, Windows executable launch, rendered screenshot, GPU benchmark, controller session, native sound playback or complete portal-to-return playtest has run. This means runtime/API/material/import bugs may remain. The included scripts make the next build reproducible but do not prove success in advance.

On an actual Unity PC, first run EditorCheck/build. Then test new/load/save recovery; gather wood→craft→mine→smelt→build→death/respawn; boundary lighting and rapid edits; all quality/texture settings; all skin/weapon/mob imports; keyboard/controller focus; and repeated Titan enter/transform/phase/defeat/retry/victory/return with audio pause/exit. Compare native features against FEATURE-STATUS.md. Finish missing systems before calling this a full port.

The complete browser builds remain available independently; this foundation is not a replacement stable release.
