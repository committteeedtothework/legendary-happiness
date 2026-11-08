# Wyvern · 2.12.0

A separate orange Titan portal leads to Wyvern. Giganto's portal, configuration, victories and cooldown remain independent. In Creative, Pause → World… → Giganto → **Find Wyvern portal** locates a clear nearby site. Natural portals use seeded 160-block cells, a 38% candidate chance, safe ground checks, and a 20-minute cooldown after returning. Encounters are single-player; portals do not activate in connected multiplayer worlds.

The 2.11.1 recording-based refinements, timing, save conversion and fidelity limits are documented in [WYVERN-VIDEO.md](WYVERN-VIDEO.md). Current tuning is listed below.

## Route and controls

Climb the spiral tower, then **X** at its summit to jump to Wyvern's three-lane runway. Use **A/D** to change lanes, **Shift** to boost, and **X/Space** near the red bars to cross the three gaps. Collect rings and reach the final Chaos Emerald on Wyvern's head to transform.

In combat, fly with **WASD**, **Space/Ctrl** vertically and **Shift** to boost. Tap **RMB** near contact to parry; **Q** dodges; **Tab** toggles targeting. Reflect a missile, parry the claw, then attack during the opening. Phase two adds two claw strikes and dorsal energy rings. Every fourth attack cycle substitutes a bite. Each press deflects one attack; release before the next strike. Strict Parry narrows the timing window.

**LMB** basic combo, **X** homing attack, **E** Quick Cyloop (hit-earned charge), **R** Sonic Boom, **F** Wild Rush, **C** Cross Slash, **V** Homing Shot, **G** Spin Slash, **Z** Stomp, **B** Cyclone Kick. These reuse the existing Sonic attack system, energy, cooldowns and swept body contacts. **C** draws a freehand Cyloop before transformation. **H** opens the shared controls guide; **Esc** pauses. Controller mappings and mobile touch actions follow the existing input system.

Near defeat, strike when the shrinking timing ring meets the marked ring; finish the jaw struggle by repeatedly pressing **Space/LMB**. Failed timing attempts repeat and consume rings instead of resetting boss health. After the explosion, fly through the return portal. Returning restores the original position, inventory, health, hunger and camera, then grants the existing Titan reward once: six diamonds, eight hellfire ingots and 100 XP.

The 2.11.4 spine, clearance, shared ability and vertical Cyloop changes are documented in [TITAN-COMBAT.md](TITAN-COMBAT.md).

## Tuning and saves

Default health is 137,500 / 220,000 / 302,500 for Easy / Normal / Hard, multiplied by the arena health setting. Shared per-move Sonic damage remains configurable through the existing combat settings. Damage openings last ten seconds; Quick Cyloop can extend an opening once, up to thirteen seconds. Missile/claw/energy-ring hits remove 20/30/16 rings before the existing boss-power multiplier. The fight transitions at 50%, 12% and 4% health. Normal starts with 80 rings; traversal and flight pickups can raise this to 400. Default drain is inherited from the arena configuration.

The separate `giganto.wyvern` save record retains the portal, used cells, reward ledger, cooldown and encounter checkpoint. `activeTitan: "wyvern"` identifies an interrupted Wyvern session; older saves need no migration. Saves preserve traversal progress, pickups, health, phase, energy, cooldowns and partial QTEs. Reload re-telegraphs an interrupted missile/claw sequence rather than resuming an invisible hit. Retry uses the last transformation/phase checkpoint. The existing transactional return-save and reward ledger prevent duplicate rewards.

Graphics quality, resolution scale, shadows, post-processing, bloom, camera and audio settings are isolated inside the arena. Unsupported Giganto-only weather, foliage, adaptive aggression, climbing, ground-contact, speed-trail and dynamic-light toggles are hidden. Cutscenes retain the current full-playback policy; Escape pauses them.

## References and assets

Research consulted November 7, 2026 UTC, describing the original 2022 encounter rather than the Final Horizon trial:

- https://www.destructoid.com/sonic-frontiers-how-to-beat-wyvern-boss-guide/
- https://www.gamepur.com/guides/how-to-defeat-the-wyvern-in-sonic-frontiers
- https://sirusgaming.com/how-to-beat-wyvern-in-sonic-frontiers-boss-fight-guide/
- https://retrododo.com/how-to-defeat-the-wyvern-in-sonic-frontiers/

These establish the tower, digital chase, final Emerald, missile reflection, one/two claw parries, phase-two dorsal rings, tail slam, timing prompts and missile/jaw finish. They informed the state machine and controls, not imported game code.

The user-supplied **Wyvern** GLB credits **_____Xler_____**, CC BY 4.0, at https://sketchfab.com/3d-models/wyvern-59695baa3ad24d7691fef625cb8a7d0f . Credits are retained in the GLB and `public/models/wyvern/NOTICE.txt`. Sonic/Wyvern and their designs remain Sega properties. The source upload contains 132,775 triangles, 403 joints and no animations. It was optimized with glTF-Transform 4.2.1 to approximately 67,205 triangles, 1K WebP textures and Meshopt geometry, then given eleven original skeletal clips with `scripts/author-wyvern-clips.py`. The shipped GLB embeds textures and animations and is under 4 MB. Three's bundled Meshopt decoder loads it offline.

The user-supplied **Titan WYVERN** prelude and **Break Through It All** battle recording play offline. Phase 1 loops 0:00–1:43; Phase 2 loops 1:44–4:09. See [WYVERN-MUSIC.md](WYVERN-MUSIC.md). Custom local battle tracks remain supported.

## Fidelity limits

This is a playable fan interpretation, not a 1:1 recreation. The desert, tower, runway, ruins and effects are original procedural replacements. Shared Sonic techniques include game-specific additions. Wyvern's eleven new clips, flight and cinematic paths are locally authored; the supplied model has no official choreography. Analytic head, neck and claw hit regions approximate the animated surface. Flight uses a moving scenery reference frame around a stable boss, with free player movement; it is not a full open-world dragon navigation system. The jaw/explosion ending uses animated skinning, original effects and fades rather than destructive topology. No official voices are bundled; the two requested user-supplied soundtrack recordings are included. Physical iOS, controller hardware and Windows execution require device checks beyond Linux Chromium validation.

## Feature status

| Feature | Status |
| --- | --- |
| Separate seeded portal, safe placement, cooldown and single encounter owner | Implemented |
| Playable tower, lane changes, gaps, ring pickups and final Emerald | Implemented |
| Super Sonic flight, shared attacks, missile reflection, claw/bite counters and two phases | Implemented |
| Dorsal rings, timing prompts, tail slam, jaw struggle, explosion and playable return | Implemented; original choreography |
| Checkpoint reload, defeat/retry, transactional return and one-time reward | Implemented |
| Supplied textured/skinned Wyvern, eleven named clips and shared Sonic rig | Implemented; animation fidelity is approximate |
| Desert scenery, lighting, shadows, camera and effects | Original replacements; reference scenery is partial |
| Adaptive score and local MP3 selection/cues | Implemented; official Wyvern recording missing |
| Controller and touch input | Implemented through shared input; physical devices unverified |
| Multiplayer Wyvern encounters | Not implemented; entry is disabled during multiplayer |

The implementation adds `src/wyvern-{integration,simulation,space,model,view,audio}.js` and `src/wyvern.css`. Conditional hooks in `src/giganto.js`, `src/giganto-simulation.js`, `src/titan-contact.js` and `src/titan-imports.js` reuse the existing encounter owner, Sonic combat and save transaction. Asset authoring/embedding, build scripts, attribution/reference records and Wyvern unit/browser tests accompany the change. No existing `public/` or `reference/` asset was changed.

See WYVERN-PURSUIT.md for the 2.11.6 health, flight, timed parry and terrain changes.

The current canyon pursuit, larger Titan, shared Super cooldown removal, jump and quill changes are documented in [TITAN-PURSUIT.md](TITAN-PURSUIT.md).
