# Giganto refinement — 2.8.7

This local build preserves the portal, ring gathering, final Emerald ascent, transformation, two health phases, original-world checkpoint, return and exactly-once rewards. The only sandbox change is torch/block-light invalidation and authoritative worker snapshots. World generation, block/item IDs, textures (including the corrected wool/water), inventory, combat outside the arena, multiplayer protocol, save database and export format are retained. Existing worlds need no regeneration.

## Stages implemented

1. **Lighting and lifecycle:** Build missing lamp caches before testing occluder edits; invalidate all nine destination revisions, including jobs still loading; supply authoritative loaded terrain to initial worker meshes as well as remeshes. Walls, source removal and seams now reject outdated light fields. Ambient brightness is unchanged.
2. **Rig and audio:** Normalize locomotion bind translations, retain joint scales, use bounded action crossfades, stop faded actions, restore sampled poses before procedural IK, and keep the chosen striking arm through impact. Original upright boost-flight, homing, Cross Slash and two stomp clips run on the existing supplied skeletons. Thin speed ribbons are time-sampled, bounded and optional; no character copies or frame-history effect is used. Audio owns a separate arena master/effects route, pauses world playback, prewarms boost, deduplicates event IDs, plays windups/releases/impacts at their own events, and stops scheduled effects on pause/retry/exit. Backgrounding pauses the encounter. Phase music continues to use the existing audio-clock transport and explicit encounter stages.
3. **Combat:** Homing attack and Cross Slash join the existing combo, dodge, parry, counters, Wild Rush, Cyloop and Sonic Boom. Boom and Cross Slash now launch finite moving projectiles with swept contacts. Giganto gains a two-arm sweep and an airborne-avoidable expanding stomp wave. Attack selection excludes the last two moves, chooses stomps/swats only at suitable heights/ranges, and adds beam/grab pressure in phase two. Dorsal hazards follow finite ray envelopes with a 1.25s warning and one contact per burst, replacing invisible lower rear cones.
4. **Presentation and settings:** The existing PBR basin, ruins, forest, grass motion, distant cliffs, shadows and cinematic cameras are retained. The darker phase has stronger directional illumination while keeping its blue atmosphere. Projectile crescents, a travelling stomp ring, directional contact effects, readable target labels and five ability meters accompany combat. The arena-only Battle Settings panel controls quality, shadows, bloom, optional speed blur, trails, particles, lighting, camera and separate audio levels, plus difficulty/checkpoints/damage. It never writes world graphics/audio preferences. The shared renderer's tone mapping, exposure and shadow state are restored after each draw; encounter resources/audio are released on exit.

## Controls and tuning

WASD move/fly; mouse camera; Shift boost; Space jump/rise; Ctrl descend; Tab target on/off. Turning the mouse sharply disengages lock. LMB combo/counter; RMB hold parry (optional timed parry setting); Q directional dodge/cancel; X homing attack; R Sonic Boom; F Wild Rush; E full-orbit Cyloop; C Cross Slash. Enter skips cinematics; Escape opens the arena pause menu. Tap Space or LMB during grabs/beam struggles.

| Move | Damage | Energy | Cooldown | Contact/release |
| --- | ---: | ---: | ---: | --- |
| Four-hit combo | 34 / 42 / 62 / 120 | 0 | 0.32–0.55s | 0.13 / 0.15 / 0.18 / 0.25s |
| Homing attack | 90 | 14 | 1.3s | 0.48s; physical flight, activation within 32m |
| Sonic Boom | 145 | 18 | 1.8s | Kick at 0.30s, projectile 150m/s, range 43m |
| Cross Slash | 125 × 2 | 32 | 5s | Kicks at 0.24 / 0.46s, projectile 150m/s, range 32m |
| Wild Rush | 95 × up to 3 | 28 | 4.5s | 0.22 / 0.40 / 0.61s |
| Cyloop | 185 | 45 | 12s | Circle closure at 2.75s; total 3.1s; Q cancels |
| Counter / perfect counter | 300 / 460 | 0 | 1.2s | 0.48s |
| Beam/grab cinematic counter | 300 | 0 | — | Successful timed tapping |

Damage is individually configurable (1 to three times each default). Normal boss health remains 12,000, Easy 8,000, Hard 16,000; health multiplier 0.5–2 applies on retry. Normal ring drain is 1/s, Easy 0.65/s, Hard 1.3/s, multiplied by the drain setting. Each ordinary hit removes 9/14/20 rings by difficulty, with protection against immediate repeat hits. Q has 0.48s protection and a 0.85s cooldown. Successful attacks do not repeatedly stagger Giganto; Cyloop retains its stagger-immunity timer. Offensive actions permit movement and can be cancelled by dodging, except protected cinematic/QTE moments.

## Reference, assets and limits

Reference checked: [Sirus Gaming, Sonic Frontiers Giganto Boss Fight Guide](https://sirusgaming.com/sonic-frontiers-giganto-boss-guide/), retrieved during this change. It confirms pre-fight ring preparation, the final Emerald on Giganto, forgiving held parry, half-health dorsal emitters, mouth-beam/grab struggles and counters. The user's supplied screenshots guide proportions/framing. This is not verification against a complete recording or the commercial game's source. Stomp/sweep timing and projectile mechanics are original interpretations; exact Frontiers choreography, move availability and damage formulas are not claimed.

The existing user-supplied Sonic/Giganto embedded-texture GLBs and prelude, Undefeatable and boost recordings remain unchanged. No paid generation or additional asset downloads were used. Creator/license notices remain in TITAN-ASSETS.md, THIRD_PARTY.md and public/audio/giganto/. The GLBs retain 22 Sonic and 24 Giganto clips. Five additional original runtime clips bring the playable rig libraries to 25 and 26 respectively. These clips are source-authored in titan-motion-clips.js, not baked back into the supplied GLBs.

Remaining approximations:

- Original keyframes and IK, not official animation/motion capture; no new face/finger rig. Homing uses a tucked body pose rather than a complete articulated ball morph. Boss locomotion around the arena, direct mesh climbing and official finishers remain incomplete.
- Wild Rush uses a short velocity-driven rush with three timed contacts, not the commercial cinematic zigzag. Sonic Boom launches one crescent per activation; Cross Slash has two authored kicks. Cyloop follows a scripted physical orbit. These are working interpretations rather than exact official ability choreography.
- Analytic body capsules/ellipsoids, swept contacts and shared arm/foot paths approximate the skinned surface. Dorsal ray origins follow animated sockets visually and an authored envelope in simulation; the proximal 12m is deliberately harmless, with 2.5m forgiveness further along the beam. Per-triangle animated collision is not implemented.
- Original procedural scenery and vector/system-font HUD, not a photorealistic or exact commercial recreation. Shadows use one directional PCF map (1024/2048), plus a contact disk; no cascades, ray tracing or screen-space contact shadows. Optional speed blur is a restrained current-frame radial filter, not velocity-buffer motion blur; it has no temporal history/ghost frames.
- Music uses the supplied stereo recordings, existing bar-aligned loops and phase/cinematic event cues. No official stems, event markers or production cutscene timeline were supplied. Exact Frontiers musical/choreographic sync cannot be claimed. User-supplied soundtrack rights remain outside the project's MIT license.
- Block light is a derived 15-level flood over loaded chunks, not infinite global lighting. Fully opaque cells block the flood; partial block shapes retain cell-level occlusion. Colored light and fully shape-aware propagation are not implemented. No brightness workaround was added.
- Existing singleplayer encounter scope remains; multiplayer Titan encounters are not implemented.

## Launch and verification

Use Node 24.22.1 / npm 11.9.0: `npm ci`, `npm test`, `npm run build:standalone`. Open `dist/DCSMCRAFT-Standalone.html` in a desktop browser with WebGL/audio enabled, or use `npm run dev` for the source build. All assets are embedded in the standalone file. The local source build needs its dev/preview server. Keep exported world backups when changing builds. Replace the browser file at the same path/name to retain its storage origin; import a backup if moving to another browser, profile or origin. Browser ZIPs keep the established DCSMCRAFT.html name; the Windows launcher retains its existing local profile/game paths.

Verification results are recorded below after the final build and browser runs. Direct file-opening and native Windows execution may be restricted by the managed Linux environment; such limits are reported rather than treated as passes.

Additional visual review found the close-range camera could cross to the far side of Giganto while Sonic reversed yaw. A sampled body/arm visibility test now slides the camera to a clear sector, shortening the boom only if needed, without overwriting movement yaw. Protected phase/finisher poses also follow the active music cursor after frame hitches; unrelated, suspended or paused transports cannot advance them.

## Changed files

| Area | Files |
| --- | --- |
| Torch flood invalidation / worker snapshots | src/block-light.js, src/world.js, src/renderer.js |
| Encounter control, lifecycle and menu | src/giganto.js, src/titan-settings.js, src/titan-menu.js |
| Combat and shared contacts | src/giganto-simulation.js, src/titan-combat.js, src/titan-contact.js, src/titan-dorsal.js |
| Rig posing / transitions | src/titan-imports.js, src/titan-kinematics.js, src/titan-motion-clips.js |
| Camera, scenery presentation and effects | src/giganto-view.js, src/titan-camera.js, src/titan-trails.js |
| Audio lifecycle and timing | src/giganto-audio.js, src/titan-foley.js, src/titan-timing.js |
| Arena HUD / settings styling | src/titan-hud.js, src/giganto.css |
| Verification | tests/titan-refinement.test.js, tests/torch-invalidation.test.js, tests/edit-streaming.test.js, tests/titan-assets.test.js, tests/titan-polish.test.js, tests/browser/giganto.spec.js, tests/browser/persistent-light.spec.js, tests/browser/production-smoke.spec.js |
| Version label / packaging / documentation | src/data.js (version label only), package.json, package-lock.json (version only), scripts/package-release.py (include these notes), README.md, desktop/README.md, VALIDATION.md, AGENTS.md, this report |

All supplied meshes, textures and audio remain byte-identical to the prior corrected build. No dependencies were added or upgraded.

## Verification details

The final source unit suite passes **681/681** tests. Added cases cover uncached lamp invalidation, unloaded worker destinations, first-mesh snapshots/stale-job revisions, homing travel/cancellation, finite projectile contacts, one-hit stomp and parry/dodge/fly escapes, recent-attack exclusion, bounded trails, isolated audio buses, contact timing at 30/60/144 steps per second, paused pose stability, bounded animation actions, visibility-preserving camera placement and audio-clock cinematic alignment. Existing sandbox, crafting, combat, weather, save/recovery and multiplayer unit checks also pass.

The browser tests use the exact self-contained HTML over loopback in headless Chromium with SwiftShader WebGL. A direct file:// test is blocked by managed browser policy (ERR_BLOCKED_BY_ADMINISTRATOR), so it is explicitly skipped rather than reported as a successful disk launch. No external asset requests are permitted by the encounter tests.

Observed lighting fixtures: all four packs retain opaque torch pixels; six placed lamps and luminous dropped items illuminate loaded terrain with local point-light budgets disabled, after turning away, moving away and reloading. The real worker seam fixture opens/closes an occluder twice with deliberately cleared lamp caches, restores its original 0.8066667 baked-light value, then reaches zero after torch removal.

The final full-encounter run completed portal → rings → ascent → Emerald → transformation → both phases → finale → victory → return. It measured 129.98 simulated seconds for the entire encounter (including gathering/ascent/cinematics), not a separately isolated combat duration. Normal HP was 12,000; the original player retained 17 health; exactly one reward ledger entry was written and a repeated exit was rejected. Other browser cases exercise defeat/retry, failed-reward-save rollback, full-inventory reward overflow, long music checkpoints, skippable movies and arena-only settings. Final aggregate browser/build/package results follow once those commands finish.

### Final results

- Unit suite: **681 passed, 0 failed**.
- Exact standalone browser suite: **14 passed, 1 policy skip, 0 failed**, 10.6 minutes. This includes the full encounter, all 51 runtime clips, audio/phase/checkpoint tests, repeated entry/exit, settings isolation, reverse-yaw pixel visibility and real-worker torch updates.
- Production web build smoke: **1 passed**, creating a playable world, opening inventory and preserving edited seam blocks, inventory and player health across reload.
- Production web, standalone and Windows x64 packaging builds succeed. The Windows payload is extracted by the Linux companion and compared byte-for-byte with the tested standalone HTML. Native Windows execution remains untested.
- The 1280×800 SwiftShader render fixture recorded **92 draw calls**, median **2.4ms**, p95 **6.4ms**. This is a warmed isolated rendering fixture, not a whole-game frame-rate guarantee or a Windows hardware benchmark.
- Supplied/static asset comparison: **no changes** to public/ or reference/ assets. Runtime source/assets/generated modules and tested HTML remain unchanged after the final test freeze. The web build warns about the existing large embedded-audio bundle (about 133.6MB JS); no external asset download is required at runtime.
- ZIP integrity, packaged source/build identity, launcher payload and SHA-256 checksums are verified when packaging. Files are local review builds; this task does not publish them or update GitHub's default branch.

Evidence is retained under /workspace/.cache/dcsmcraft-giganto-refinement/ on the build host and copied with the local delivery artifacts. The direct-file policy skip and native Windows limitation remain open platform checks.

The final stomp checks use the actual normalized ankle positions (Y1.48, Z−6.02), with the sole on the ground. Both imported feet plant at the shockwave center; the native test records exactly one 14-ring hit. The revised foot collision fixture uses those model coordinates.
