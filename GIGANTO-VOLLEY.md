# Giganto Homing Shot and animation fixes — 2.8.11

This stage continues GIGANTO-ASCENT.md and the earlier Giganto reports. The portal, ring preparation, armor/ruins ascent, final Emerald, transformation, two combat phases, cinematic counters, finisher, rewards, retries and return remain. Changes are limited to the encounter, verification, version and delivery notes. Sandbox visuals/mechanics, supplied assets, world generation and save formats are unchanged.

## Implemented

**V · Homing Shot** charges a six-sphere fan and releases it at 0.36, 0.44, 0.52, 0.60, 0.68 and 0.76 seconds. Each sphere follows a real swept flight, deals 45 base damage once on contact, and expires within a 65-metre travel budget. A complete base volley deals 270; existing Phantom Rush scaling and phase protections apply. Guided shots turn at most five radians/second at 78 m/s toward reachable moving body regions. Locked casts require a body surface within 60 metres. Unlocked casts use free aim without acquiring a target.

The skill costs 40 energy, lasts 1.15 seconds and has an eight-second cooldown. Movement and vertical steering remain available. Q cancels pending releases; already released spheres finish their finite flight. Damage does not stun or lock Giganto. Phase transitions, defeat and existing checkpoint recovery clear projectiles. Damage per sphere is configurable through Battle Settings → Damage tuning. Existing attacks, boss health and balance values remain unchanged.

One quaternion-only Homing Shot clip uses the supplied Sonic rig. Charge spheres, visible cores, directional cyan rings, contact effects and event-timed, quieter layered release effects accompany actual simulation events. At most eight projectiles and eight instanced sphere slots exist. Empty sphere batches are hidden; decorative rings respect Particles while projectile cores remain readable. No character copies or temporal afterimages are added. The HUD and arena controls/settings include the skill.

**Animation fixes:** jump/fall and locomotion clips now use clocks local to entering the pose, so a jump late in a trial starts correctly. Carried motion from Giganto no longer makes an idle climber retain a running stride; armor running is driven by actual travel along the surface. Super Sonic selects boost flight from actual boosting, rather than residual speed or knockback. Interrupted body blends start from the displayed pre-IK pose instead of abruptly promoting a half-weight source clip. Quaternion and position samples are restored separately before the mixer, then procedural IK is applied once. Named dorsal/quill layers stay separate. Blend durations remain 65 ms for fast actions and 160 ms for other changes. Bind scales and joint lengths remain unchanged.

Attack hand IK now fades with the strike envelope, avoiding a full-strength arm correction at the first windup frame. Held guard input no longer overrides dodge, damage or active special-move arm poses. Existing counter/finisher contact IK, grounded Titan steps and collapse remain.

Saved combat cooldowns are now restored and bounded by their move definitions. Reloading cancels unfinished attacks/projectiles, as before, while preserving spent energy, damage and remaining cooldowns. This prevents reload from bypassing ability cooldowns. Older saves without cooldown fields use safe defaults. No save-schema migration is required.

Runtime libraries contain **32 Sonic / 30 Giganto** clips; embedded GLBs retain 22 / 24. All model meshes, textures and supplied recordings are retained byte-for-byte.

## Changed files

- Pose snapshots, clocks and blending: src/titan-animation.js, src/titan-imports.js, src/titan-kinematics.js, src/titan-climb.js.
- Volley flight, contacts, tuning and cooldown saves: src/titan-shot.js, src/titan-combat.js, src/giganto-simulation.js.
- Skill pose, rendering and event audio: src/titan-motion-clips.js, src/giganto-view.js, src/giganto-audio.js.
- Arena control/HUD/settings: src/giganto.js, src/titan-hud.js, src/titan-menu.js.
- Verification: tests/titan-shot.test.js, tests/titan-assets.test.js, tests/browser/giganto.spec.js.
- Delivery: package.json, package-lock.json, src/data.js (version only), scripts/package-release.py, README.md, desktop/README.md, VALIDATION.md and this report.

## Remaining work and fidelity

Homing Shot is a complete custom six-sphere implementation of the guided-volley concept, with original posing/effects and authored timing/damage. It is not a frame-matched reproduction of the official skill. A community reference-page request returned HTTP 402; no new external reference or official animation was obtained. The prior supplied visuals and existing encounter remain the reference context. No paid generation, extra models or soundtrack downloads were used.

The full official ability/choreography roster, production cutscenes, facial/finger animation, arbitrarily deforming-limb climbing, photographic terrain/materials, advanced shadows and velocity-buffer blur remain partial or incomplete. Climbing still uses the exact armor mesh in a fixed joint stance plus moving root. Combat hit regions and the displayed pre-IK pose blends are approximations; instantaneous changes to procedural contact IK can still differ from a fully authored transition. Unlocked shooting follows Sonic’s horizontal facing heading rather than full camera-pitch aiming; vertical positioning remains controllable. Locomotion entry clocks restart when a rig is rebuilt on load. Exact commercial music/cinematic synchronization is not claimed. Prior reports and TITAN-ASSETS.md / THIRD_PARTY.md retain asset and licensing notes.

## Validation

The final unit suite passes **726/726 tests**. New checks cover all six release times and once-only contacts at 30/60/144 Hz; damage tuning, energy/reach/cooldown rejection, bounded steering and range, free-aim misses, movement during casting, dodge cancellation before/after release, phase protection and saved cooldowns. Actual supplied rigs verify late jump/fall entry clocks, paused samples, boost selection, carried climbing idle, interrupted pre-IK pose continuity, bounded mixer actions and bind scales. Existing combat, cinematic, lighting, world, content, save and multiplayer tests remain green.

The exact frozen standalone HTML passes **19 browser cases**, with **one explicit managed-policy skip**, in 17.2 minutes. The full controls-driven portal → rings → armor ascent → Emerald → transformation → both phases → finisher → reward/return sequence passes in 120.97 simulated seconds including preparation/cinematics. Defeat/retry, failed reward saves, full-inventory overflow, pause/reload, repeated entry/exit, settings isolation, contacts, lighting seams, actual soundtrack/boost/prelude audio and all **62 runtime clips** are exercised. No JavaScript/WebGL errors were observed in passing fixtures.

The new native V-key scenario shows the charge and volley on the imported rig, observes **six releases, six hits and 270 damage**, with at most 6 live projectiles. The local jump clip starts at 0 even at encounter time 200 and advances to 0.20s. Pause freezes the action/resources and leaves zero Foley voices; resumed releases are audible. Saving/reloading retains 4.90s of cooldown and the damaged boss HP, clears old projectiles, and does not duplicate the volley. Exit restores the unchanged world settings. Screenshots capture charge and flight.

The production web smoke passes **1/1**, including playable world creation, inventory, chunk-seam edits and saved reloads. Standalone, web and Windows x64 builds succeed; the launcher embeds the tested HTML and Linux companion extraction is byte-identical. Native Windows execution remains untested on this Linux host. Managed Chromium blocks direct file:// before game load (ERR_BLOCKED_BY_ADMINISTRATOR); that case is explicitly skipped and the exact self-contained bytes are tested over loopback. External asset requests are blocked in encounter fixtures.

The warmed 1280×800 isolated SwiftShader scene fixture records 132 draw calls, median 2.8ms and p95 7.6ms. These are not whole-game or Windows hardware FPS measurements. Sphere rendering uses one bounded instanced batch, hidden when unused; no new asset/dependency payloads or expensive post-processing were added.

All 270 supplied/static assets are byte-identical to 2.8.10. Frozen source/runtime/assets/tests/HTML hashes are checked before packaging, followed by ZIP CRC, source-file byte comparison and embedded/extracted launcher payload checks. Save schema 1, generation 16 and protocol 4 remain. The large embedded-audio bundle warning remains (about 134 MB uncompressed). Evidence is retained under /workspace/.cache/dcsmcraft-titan-volley/ and copied with local delivery artifacts. Initial tests exposed a quaternion-comparison normalization issue and the reload cooldown reset; those attempts are retained in logs and excluded from final pass counts.
