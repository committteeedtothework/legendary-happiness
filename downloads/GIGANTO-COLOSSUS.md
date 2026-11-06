# Giganto · Colossus update · 2.9.0

The existing uploaded rigs, portal, crown Emerald, transformation, two phases, score, finishing chest breach/explosion, return portal and reward/save system remain. Other sandbox gameplay and all earlier public assets are retained; game-wide controller input is the authorized exception.

Giganto and the arena render at 2.8 metres per canonical arena unit, previously 1.6. Sonic retains his physical body size. The Titan is 75% larger relative to Sonic; canonical coordinates keep saved encounters and contacts stable. Scale is configurable in source (`titanScale`, 1–3.2). The crown Emerald now stays within reach at the new scale. Wild Rush offsets, melee reach, lock-on approaches, counter closure and transformation closeups account for Sonic's physical size.

Terrain gains finer rock geometry, erosion strata, fissures and lichen variation. Forest canopies have irregular lobes rather than uniform spheres; richer grass, clearer aerial depth and a character-only cool rim light keep subjects legible. Grass extends higher on the slopes. Existing high/balanced/low scenery, resolution, post-processing, AO, reflections, shadows and particle settings remain functional. The landscape's high detail geometry budget increases from 400k to 500k triangles while retaining fewer than 40 landscape draw objects. This is browser WebGL, not a UE5 renderer.

Protected entrance, transformation, phase and finale clocks now run at 0.65 pace by default (approximately 6.9, 9.2, 6.2 and 10.8 seconds respectively). Camera paths, poses and cue events share that clock. Combat runs at its normal speed. Arena Camera options can adjust cinematic pace from 0.4 to 1. Cutscenes remain unskippable. Existing saved protected scenes without a pace snapshot retain their old timing; new scenes adopt the setting. Music timing remains explicit: phase one 0–120 seconds, phase two starts/loops at 121 seconds, finale starts at 237 seconds and continues through the aftermath with its existing end fade. No recording bytes were edited.

## Combat

Normal health remains Easy 32,000 / Normal 48,000 / Hard 64,000; health multiplier and damage settings remain separate. New moves:

| Technique | Keyboard | Contacts / damage | Energy / cooldown |
|---|---|---|---|
| Stomp | Z | One descending kick, 1,300 | 24 / 4 s |
| Spin Slash | G | Four spinning contacts, 300 each | 30 / 5 s |
| Cyclone Kick | B | Three rising helix contacts, 420 each | 32 / 7 s |
| Sonic Boom | R | Four kick waves, 300 each | 22 / 3.3 s |

All use rotational rig animations, contact events, costs, recovery and bounded gold effects. Stomp and Cyclone physically approach the chosen surface; remote activation is rejected. Basic combos, Homing Attack, Homing Shot, Cross Slash, Wild Rush, Quick Cyloop, Phantom Rush and counters remain. Existing revision-four custom damage proportions migrate once; Boom is now tuned per wave. A counter physically closes distance instead of acquiring a longer invisible hit radius.

Giganto adds a two-turn rotating arm sweep and left/right rising uppercuts to his existing swings, swats, double sweep, stomp, beam/grab struggles and dorsal attacks. New moves have distinct anticipation, shared rig/contact paths, dodge/parry windows and recovery. Rotation uses swept intermediate samples to catch moving limbs without repeated damage. Recent attacks are excluded from the next selection where possible.

## Reference and limits

Research used SEGA's online manual/skill screenshots, the official Steam gallery and Showdown Trailer, plus a Steam Giganto guide. The guide covers the Final Horizon Hard trial and is not used as a claim about story-mode tuning. Original procedural animations approximate the supplied skeletons; they are not official motion-capture/choreography or a frame-for-frame recreation. Stomp, Spin Slash and Cyclone Kick follow broader Frontiers skill conventions; their input and aerial implementations are adapted to this engine, not claimed as exact Giganto encounter actions. Ring-wave, uppercut and other existing adaptations remain identified as such. Official complete moveset parity, terrain/material fidelity and cinematic editing remain incomplete. The user-linked YouTube source was unavailable under this environment's network policy; no blocked source was bypassed. Reference media is not redistributed. URLs and observations are in `reference/giganto-colossus-2.9.0.json`.

Supplied Sonic/Giganto rigs, textures and audio keep their existing notices in THIRD_PARTY.md. No paid generation, new commercial recording or unlicensed downloaded asset was added. Physical controller and native Windows testing limitations are documented in CONTROLLERS.md and VALIDATION.md. Verification results and actual in-game screenshots accompany the build.
