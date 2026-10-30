# Giganto movement and Wild Rush — 2.8.8

This stage continues the Giganto upgrades in [GIGANTO-REFINEMENT.md](GIGANTO-REFINEMENT.md). It changes the encounter only. The earlier torch-light fixes and corrected wool/water artwork are retained. No terrain regeneration, save migration, new dependencies or additional downloaded assets are required.

## Implemented

- Giganto repositions after every three attacks. He approaches, retreats or sidesteps based on Sonic's position, turning toward him. Each step has a 0.45-second warning and a 2.4-second movement, followed by at least 1.4 seconds of recovery. Travel is at most 8 metres, heading change at most 0.45 radians, and the boss stays within 32 metres of the arena centre. Walking cannot overlap a selected attack. The Battle Settings **Titan movement** toggle disables subsequent steps.
- Alternating feet stay on their world anchors during the supporting half of each step. The swinging foot lifts 6 metres; the body lowers slightly to keep both legs within their actual reach. Shared two-bone geometry keeps knee/leg contact regions aligned with the imported rig. Foot plants emit event-timed impact Foley and restrained ground rings/camera response. Contact hit-stop preserves walking foot IK instead of dragging the old foot pose along with the moving root.
- Body regions, arm paths, stomp waves, dorsal beams, targeting, camera clearance, Cyloop and cinematic framing follow the boss's translated and rotated coordinate frame. Relative sweeps include the previous body pose. Grabs now require actual reachable-hand proximity, rather than a broad chest-centred catch volume. Windup captures its target so moving away remains effective.
- Wild Rush follows an actual short zigzag flight path with alternating arm contacts and a bounded banking pose. It retains 95 damage per contact, at most three contacts at 0.22/0.40/0.61 seconds, 28 energy, a 4.5-second cooldown and a 0.8-second action. It approaches a nearby locked target physically, follows the boss frame and preserves steering. Free-target/distant activations travel along the captured direction; they do not remotely snap to the boss. Q cancels the path and pending contacts. A settling segment prevents residual lateral drift at different simulation rates.
- Cinematics, QTEs, stagger and Cyloop pause tactical steps. Interrupted encounter saves retain the standing boss's position/heading and resume with a protected neutral attack state; an interrupted foot animation is deliberately not replayed. Legacy encounter saves default to the original centred pose. Retry retains its existing checkpoint behavior and resets the boss to the original centre.

## Controls and tuning

Controls are unchanged: F Wild Rush; E Cyloop; Q dodge/cancel; X homing; R Sonic Boom; C Cross Slash; LMB combo/counter; RMB parry; Tab target; WASD fly, Shift boost, Space/Ctrl rise/fall; Escape arena pause; Enter cinematic skip. **Battle Settings → Combat → Titan movement** controls tactical steps. All attack damage, ring drain, difficulty and health tuning from 2.8.7 remain unchanged.

The movement distances/timing and shared foot paths are in `src/titan-mobility.js`; coordinate transforms in `src/titan-space.js`; Wild Rush's path in `src/titan-rush.js`. Combat scheduling, resources and saves stay in the existing simulation. Rendering/IK consumes those same poses; it does not drive damage or persist changes to the overworld.

## Scope and remaining limits

This is another working stage, not a claim that the entire Frontiers recreation is complete. The existing supplied meshes, textures, skeletons, recordings and original runtime clips remain. No official additional animations, soundtrack stems or motion capture were supplied. No new external reference was retrieved for this stage; it builds on the verified reference and screenshots documented in the previous report.

- Walking is a deliberate two-step tactical reposition using the existing locomotion clip plus foot IK, not full navigation, direct mesh climbing or official choreography. Hands/body hit volumes remain analytic approximations; exact skinned-triangle collision is absent. The neutral body proxy and animated surface can differ slightly.
- Wild Rush's bounded zigzag and alternating contacts are an original playable interpretation, not the commercial game's exact path or cinematic animation. Sonic Boom, homing and Cyloop retain their previously documented approximations.
- The full official moveset, finishers, facial/finger animation, realistic terrain/materials, cascaded/contact shadows, velocity-buffer motion blur and exact musical/cinematic synchronization remain incomplete or approximate as described in GIGANTO-REFINEMENT.md. No placeholder is being counted as a completed version of these features.
- Interrupted saves retain boss placement but intentionally settle the feet; multiplayer Titan encounters remain unsupported. Native Windows execution and direct local-file browser behavior require the platform checks noted below.

## Changed files in this stage

- Simulation/shared geometry: `src/giganto-simulation.js`, `src/titan-space.js`, `src/titan-mobility.js`, `src/titan-rush.js`, `src/titan-contact.js`, `src/titan-cyloop.js`, `src/titan-dorsal.js`.
- Rig, camera and effects: `src/titan-imports.js`, `src/titan-kinematics.js`, `src/giganto-view.js`, `src/titan-camera.js`.
- HUD/menu and footstep routing: `src/giganto.js`, `src/titan-menu.js`, `src/giganto-audio.js`.
- Verification: `tests/titan-mobility.test.js`, `tests/titan-assets.test.js`, `tests/giganto.test.js`, `tests/titan-expansion.test.js`, `tests/browser/giganto.spec.js`. The natural-playthrough bot now tracks the moving boss instead of pursuing the old arena origin.
- Version/documentation/package notes: `package.json`, `package-lock.json` (version only), `src/data.js` (version only), `README.md`, `desktop/README.md`, `VALIDATION.md`, `scripts/package-release.py`, this report.

## Verification

The final source suite passes **693/693 tests**, including translated/rotated contacts, moving-body sweeps, reachable grabs, planted knees/feet on the actual imported rig, interrupted and legacy saves, movement-toggle recovery and Wild Rush at 30/60/144 simulation rates. The ordinary sandbox/content/server/save tests remain green.

The exact final standalone HTML passes **15 browser cases**, with **one explicit policy skip**, in 11.9 minutes. Tests use native Chromium/SwiftShader WebGL over loopback, with external asset requests blocked in the encounter fixtures. Coverage includes the complete portal/rings/ascent/Emerald/transformation/two-phase/victory/return sequence, defeat/retry, pause/reload, failed reward saves, inventory overflow, all 51 runtime rig clips, actual MP3 decoding/timing/cleanup, hidden-tab suspension, settings isolation, repeated entries/exits, Cyloop/swats, stomp contacts, camera visibility and real worker torch seams/occlusion. No JavaScript or WebGL errors were observed in the passing cases.

The new moving-boss browser fixture checks the actual imported rig during a full 8-metre / 0.45-radian step, including forced hit-stop. Both foot plants occur once, no attack overlaps the step, and foot error stays below the 0.2-metre assertion threshold. The actual Wild Rush crosses both sides of its path, deals exactly 285 total damage, keeps one Sonic mesh with unit root scale and restores the boss's saved position/heading without replaying a walk or attack. The menu toggle also works through real UI clicks.

The natural playthrough took 133.38 simulated seconds **including** traversal/preparation/cinematics, not an isolated combat duration. It kept the normal 12,000 HP, returned the player's original 17 health/equipment/world clock and recorded one reward ledger entry; repeated exit was rejected.

The production web smoke test also passes (**1/1**), creating a playable world, opening inventory and persisting edited chunk-seam blocks, player health and inventory across reload. The final standalone, production web and Windows x64 builds succeed. The Windows launcher contains the exact tested HTML, and the Linux companion extracts it byte-for-byte. Native Windows execution remains untested on this Linux host. Direct file:// navigation is blocked before game load by managed Chromium policy (ERR_BLOCKED_BY_ADMINISTRATOR); it is skipped rather than called a local-file launch pass. Policy was not bypassed.

The isolated 1280×800 software-render fixture recorded 92 draw calls, median 1.7 ms and p95 5.6 ms. These are warmed draw/update measurements, not a complete-game or Windows hardware FPS benchmark. Existing large embedded-audio bundle warnings remain (about 133.6 MB production JS / 133.8 MB standalone HTML).

All supplied/static assets are byte-identical to 2.8.7. Frozen runtime, assets, tests and standalone hashes are checked again during packaging. ZIP CRCs, exact source archive contents and launcher payload identity are verified before delivery. Save schema 1, generation 16 and protocol 4 are retained. Evidence is retained under /workspace/.cache/dcsmcraft-titan-mobility/ on the build host and copied into the delivery verification folder.
