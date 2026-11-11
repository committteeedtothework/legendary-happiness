# Giganto double sweep and recovery — 2.8.12

This stage continues GIGANTO-VOLLEY.md and the earlier Giganto reports. Changes stay inside the encounter, tests and delivery notes. Portal entry, ring preparation, armor/ruins ascent, Emerald, transformation, two phases, player abilities, counters, finisher, rewards, retries and return remain. Sandbox gameplay, supplied assets, world generation and save formats are unchanged.

## Working changes

Giganto’s double sweep now has independently timed hands. The left releases after the existing 1.7-second windup (difficulty-scaled); the right follows 0.9 seconds later. Each hand moves for 0.6 seconds and is dangerous only from 0.08 to 0.56 seconds after its own release. The complete strike section lasts 1.55 seconds, followed by the existing 3.3-second recovery. Easy/Normal/Hard scale the initial windup by 1.25/1/0.85; spacing between the hands stays readable.

A shared timing definition drives the actual analytic forearm path, collision windows, dedicated double-sweep torso animation, two hand warnings, predicted hand arcs and LEFT → RIGHT prompts. Waiting and completed hands cannot cause sweep damage. Collision samples the player’s swept movement against the moving forearm only inside its active window, with a 6.5-metre combined contact radius. This is smaller than the old general 9-metre arm tolerance. Other attacks retain their existing contact rules.

A successful parry of either hand cancels the remaining combo and awards the existing counter window. The normal timed/perfect-parry rules remain. A protected first contact does not disable the later right-hand threat, while one actual hit prevents a second damage chain during the same combo. A hit applies the existing difficulty-based ring loss and outward swat impulse. The 0.9-second hand spacing exceeds the existing 0.85-second dodge cooldown. You can also reposition or fly above the arm path. Boss health and player damage/costs/cooldowns are unchanged.

Each hand has an event-timed release sound: the existing first release plus a once-only follow-up cue. Pause, retries, movies, saved encounter recovery and arena exit retain the existing audio cleanup. Warnings remain readable with Particles disabled; decorative hand-path lines follow Particles. No new recording, texture or model is loaded.

Giganto now uses a dedicated quaternion-only double-sweep clip with opposing torso turns and head compensation. Actual hand placement still follows the shared contact path through the existing arm IK. Ending an attack captures the last rendered hand positions, then eases procedural hand corrections out over 0.45 seconds, avoiding an immediate snap to idle. This carry also covers compatible phase/finisher entry; protected counter choreography retains its own release poses. Sonic’s guard correction eases in/out at an exponential rate of 16/s, freezes during pause and keeps dodge/damage/special-move poses in priority. Parry mechanics are responsive immediately; animation blending does not delay them.

Runtime clips total **32 Sonic / 31 Giganto**; embedded GLBs remain 22 / 24. Meshes, textures, bind scales, joint lengths and supplied recordings are retained.

## Changed files

- Shared sweep timings/contacts and simulation: src/titan-sweep.js, src/titan-contact.js, src/giganto-simulation.js.
- Torso clip, rig selection, recovery and guard blending: src/titan-motion-clips.js, src/titan-imports.js, src/titan-kinematics.js.
- Warnings, prompts and event audio: src/giganto-view.js, src/giganto.js, src/giganto-audio.js.
- Tests: tests/titan-sweep.test.js, tests/titan-assets.test.js, tests/browser/giganto.spec.js.
- Delivery: package.json, package-lock.json, src/data.js (version only), scripts/package-release.py, README.md, desktop/README.md, VALIDATION.md and this report.

## Remaining limitations

This is an original two-hand interpretation, not verified frame-matched Sonic Frontiers choreography. Shared analytic forearm capsules approximate the visible mesh; warning spheres and arcs describe hand motion rather than every triangle of the limb. The combined contact radius includes forgiveness. The recovery solver preserves hand positions, with authored/bind wrist orientation rather than captured finger animation. Guard blending and other procedural contact corrections still differ from a production authored animation stack.

Official remaining abilities/choreography, production cutscenes, facial/finger performance, arbitrarily deforming-limb climbing, photographic terrain/materials, advanced shadows and velocity-buffer blur remain partial or incomplete. Existing Homing Shot free-heading/pitch and rig-rebuild clock limitations remain. Armor climbing still uses the exact mesh in a fixed joint stance plus moving root. Exact commercial music/cinematic timing is not claimed. No paid generation, new external reference, official animation or soundtrack download was used. Prior supplied references, assets and licensing notes remain in TITAN-ASSETS.md and THIRD_PARTY.md.

## Validation

The final unit suite passes **735/735 tests**. New checks cover separate hand release timing across Easy/Normal/Hard at 30/60/144 Hz, harmless waiting/finished hands, swept crossings, vertical/range rejection, independent protected-contact handling, one-hit chain protection, either-hand parry cancellation and counter availability. Two actual dodge inputs also protect both forced-contact windows at 30/60/144 Hz with the ordinary cooldown, without spending rings. Actual rigs verify the dedicated sweep clip, continuous first recovery frame, stationary paused recovery, and eased/frozen guard correction with dodge priority. Prior animation, Homing Shot, combat, audio, world, lighting, save and multiplayer tests remain green.

The exact frozen standalone HTML passes **20 browser cases**, with **one managed-policy skip**, in 18.1 minutes. The full portal → rings → armor ascent → Emerald → transformation → both phases → finisher → reward/return sequence passes in 120.38 simulated seconds including preparation/cinematics. Defeat/retry, failed reward saves, inventory overflow, pause/reload, repeated visits, settings isolation, targeting/camera, all **63 runtime clips**, actual music/prelude/boost effects and retained torch seam tests pass. No JavaScript/WebGL errors were observed in passing fixtures.

The new native double-sweep scenario displays both warning markers, the dedicated rig clip and correct LEFT/RIGHT prompts. It emits the first and follow-up releases once each, 0.900s apart; the completed left warning disappears while the right remains. The largest observed hand displacement at the first idle/recovery frame is 0.000070m (the assertion allows 0.5m). Pause freezes time and attack clock. Screenshots capture both halves. Unit contact scenarios separately verify one normal 14-ring hit, no double damage chain, a later right-hand hit after a protected left contact, and either-hand parry cancellation.

The production web smoke passes **1/1**, including playable world creation, inventory and save/reload of chunk-seam edits, equipment and health. Standalone, web and Windows x64 builds succeed; the launcher embeds the tested HTML and Linux companion extraction is byte-identical. Native Windows launch remains untested on this Linux host. Managed Chromium blocks file:// before game load (ERR_BLOCKED_BY_ADMINISTRATOR); that check is explicitly skipped, and the exact self-contained bytes are tested over loopback with external assets blocked in encounter fixtures.

A separate repeat of the warmed 1280×800 SwiftShader fixture, run after all unit/encounter checks to avoid concurrent load, records 132 draw calls, median 3.2ms and p95 7.2ms. These are not whole-game or Windows hardware FPS measurements. Additional warnings use one cloned marker and two bounded 13-point lines, hidden outside the sweep; arcs obey Particles. No new asset/dependency payload or expensive post-processing is added.

All 270 supplied/static assets are byte-identical to 2.8.11. Frozen source/runtime/assets/tests/HTML hashes are checked before packaging, followed by ZIP CRC, source-file byte comparison and embedded/extracted launcher payload checks. Save schema 1, generation 16 and protocol 4 remain. The existing large embedded-audio warning remains (about 134 MB uncompressed). Evidence is retained under /workspace/.cache/dcsmcraft-titan-sweeps/ and copied with local delivery artifacts. Official choreography and remaining limitations are listed above; the successful checks do not establish exact commercial fidelity or bug-free behavior in every scenario.
