# DCSMCRAFT 2.8.2 — Imported Sonic and Giganto rigs

This release uses the actual GLB/ZIP models supplied by the user, not the earlier procedural stand-ins. The ordinary sandbox, weapons, controls, boss simulation, damage values, phase timing, rewards and existing save format are preserved. No Tripo tasks were submitted and no generation credits were spent.

## Attribution and supplied assets

- **3D sonic rigged**, by **ily20111**: https://sketchfab.com/3d-models/3d-sonic-rigged-cf9837777ff142b6b2e83d9569c8f4c6 . The listing identifies Creative Commons Attribution, **CC BY 4.0**: https://creativecommons.org/licenses/by/4.0/ . The uploaded ZIP contains separate T-pose, walking and running GLBs and a texture image. Both locomotion cycles are retained; their horizontal root motion is removed so game physics owns position.
- **Giganto - Sonic Frontiers**, uploaded by **Logandium**, who credits **HiGuys920** as its original creator: https://sketchfab.com/3d-models/giganto-sonic-frontiers-f4cbf7a0363a4692883ace2deb8193cf . The listing identifies **CC BY 4.0**. Creator link given by that listing: https://www.deviantart.com/higuys920 . The supplied GLB includes a detailed skin/skeleton, jaw and claws, but no animation clips.

Sonic and Giganto are Sega characters. Listing metadata and user-supplied files provide the asset provenance; this is an independent fan implementation and does not claim Sega authorship or endorsement. License links/credits travel with the models and game. Original-source file hashes and modifications are recorded in `reference/titan-assets/imported-assets-2.8.2.json`. Original input downloads are retained separately from the optimized runtime models.

## Model deliverables

`public/models/titan/sonic.glb` and `giganto.glb` are reusable glTF 2.0 binary files with embedded textures, skinning, named animation clips and effect sockets. Their companion `manifest.json` lists clip durations, origin and loop behavior. Sonic retains 10,414 triangles; Giganto retains its 42,081-triangle body plus the new original dorsal-emitter geometry, within the requested 60,000-triangle maximum.

Source color textures are repacked as high-quality WebP; normal maps use lossless WebP. Sonic has a 2K atlas and a locally authored golden palette variant. Giganto uses its 1K maps; one original uniform 32×32 eye/utility texture is intentionally kept small. WebP uses the standard `EXT_texture_webp` glTF extension and browser-native decoding, with no CDN decoder. WebP-only textures omit the core PNG/JPEG fallback source; both models pass the independent Khronos glTF validator without errors. Source non-root skin-node warnings and optional buffer-target hints remain; actual Three.js transforms and deformation are tested. Sonic's original full-strength emissive texture is corrected for normal scene lighting. Existing pixel-art sandbox textures/filters are unchanged.

Sonic's original skeleton is preserved, with six additional skinned quill joints and a Super Sonic material variant. The golden texture changes blue body pixels and green eye pixels while retaining red shoes, gloves and muzzle colors. Giganto's supplied skeleton and jaw/claws are retained. Ten original dorsal emitters, animated rig nodes and mouth/hand/emitter sockets are added; lasers follow the real animated sockets.

## Named clips

Sonic has **22 clips**: supplied `move` and `run`; authored `idle`, `boost`, `jump`, `fall`, `fly`, `parry`, `transform`, `attack_windup`, `attack`, `attack_left`, `attack_right`, `recovery`, `damage`, `defeat`, `counter`, `sonic_boom`, `wild_rush`, `quick_cyloop`, `dodge`, and an independent `super_quills` pose layer.

Giganto has **24 authored clips**: `idle`, `move`, `attack_windup`, `attack`, `recovery`, `damage`, `defeat`, `arm_swing_windup`, `arm_swing`, `arm_swing_recovery`, `arm_slap_windup`, `arm_slap`, `arm_slap_recovery`, `grab_windup`, `grab`, `grab_recovery`, `jaw_open`, `jaw_close`, `beam_charge`, `beam_fire`, `phase_transition`, `stagger`, `dorsal_extend`, `dorsal_pulse`.

These clips contain real keyed rotations/scales on the rig. They are not empty labels or renamed T-poses. Three.js AnimationMixer crossfades the body states; boss windup/strike clips are sampled from the existing difficulty-scaled attack clock. Beam/grab gestures follow struggle timing. Dorsal and Super-quill animation layers run separately from body combat. Assets load from embedded bytes before entry, are cached, and each encounter owns its skeleton/mixer/material instances. A resumed encounter freezes its combat/rings while models decode; load errors offer safe exit rather than silently advertising an old stand-in as the new model.

## Controls and integration

Encounter controls remain in GIGANTO.md: WASD/mouse, Shift boost, Space jump/rise, Ctrl descend, LMB combo/counter, RMB parry, Q dodge, R Boom, F Rush, E Cyloop, Tab target, Enter skip, Escape pause/return. Portal discovery, traversal checkpoints, victory, defeat/retry, cooldowns and the exactly-once reward ledger are unchanged. Save envelope 1, generation 16 and multiplayer protocol 4 remain. No world regeneration is needed.

Build the reusable models locally with:

```
node scripts/build-titan-assets.mjs "/path/to/sonic/unpacked" "/path/to/giganto_-_sonic_frontiers.glb"
```

The Sonic folder must contain `T_pose sonic.glb`, `walking sonic.glb`, and `running sonic.glb`, extracted from the supplied nested ZIP. The script uses Three.js and Python/Pillow/NumPy, with no service or network calls. Run `node scripts/audit-titan-glb.mjs sonic public/models/titan/sonic.glb` and the equivalent `giganto` command. Normal prebuild/predev/pretest embeds the finished GLBs reproducibly; ordinary source installs do not need the original downloads just to launch/build the game.

## Remaining approximations

The new assets improve the actual mesh detail, texture fidelity and deforming rigs. They do **not** make this a complete Sonic Frontiers port. Only walk/run are supplied animations; all other motion is locally authored and remains an approximation of the reference choreography. Sonic's supplied rig has no individual finger or facial bones, so true finger curls, facial performance and detailed fist grips remain incomplete. Super quills use a regional skin-weight extension rather than a separate official Super Sonic mesh. Giganto's claws and jaw are articulated, but the grab/chew choreography and limb contact are approximate. The body remains largely stationary; its `move` clip is an idle stepping presentation, not new boss navigation. Dedicated damage/windup/recovery clips are provided for reuse even where the game selects stagger, dodge or a shared combat variant instead.

Climbing remains the existing platform route, and damage uses the existing analytic volumes rather than per-triangle hand/mesh contacts. Laser fan rays remain decorative over the existing coarse dorsal hazard sectors. Cinematics, Cyloop, Grand Slam and the finale remain abbreviated. No new paid services, official soundtrack, facial capture, complete finger rig, mesh wall-running, root-motion combat collision, co-op raid or new combat stats are added. Verification results and platform limits are in VALIDATION.md.


## 2.8.4 motion revision

The same source meshes, textures and skin budgets are retained, with refreshed original body keyframes, timing-aligned specials and less abrupt transitions. The live game adds two-bone arm targeting, head tracking, a visual strike lunge and optional Cyloop/finale presentation. Runtime posing/camera layers are not baked into reusable GLB clips. Named clip counts remain 22/24. No new Sonic finger/facial bones or official animation data are introduced. reference/titan-assets/animation-overhaul-2.8.4.json records the revised file hashes. TITAN-OVERHAUL.md gives current arena, balance, audio and UI changes.
