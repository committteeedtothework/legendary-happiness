# Giganto · Highland arena and combat · 2.9.2

This update is arena-only. Overworld terrain, textures, streaming, items, audio tracks, saves and controllers retain their 2.9.1 behavior.

## Scenery

Original alpha-cutout leaf sprays replace the solid rounded tree crowns. Shared branching trunks, uneven tree groups, low scrub and meadow tufts break up the rock terraces. Cooler exposed stone, distant broken ring towers and existing atmospheric depth follow the supplied Kronos reference. Decorative relief stays outside traversal bounds; the playable floor and collision rules are preserved. These are original procedural replacements, not extracted Sonic Frontiers scenery.

Grass, trees and scrub remain instanced. Scenery Detail and Graphics Quality control real instance counts and leaf geometry. Low/Off remain available. Wind uses the encounter clock, including newly compiled shaders, so it stops with pause. Ordinary alpha testing avoids bright cutout fringes on the shared non-MSAA browser renderer. New foliage/landmarks add no external asset downloads. The terrain materials, scenery and audio buses remain separate from the Overworld.

## Combat

| Difficulty | Health | Ordinary hit ring loss |
| --- | ---: | ---: |
| Easy | 80,000 | 16 |
| Normal | 120,000 | 26 |
| Hard | 160,000 | 38 |

Health is 2.5 times the previous default. The existing Boss Health multiplier remains 0.5–2. Attack Power is independently adjustable from 0.5–2 in arena combat settings. Super Sonic's damage values, energy costs, special cooldowns and boss attack warning/contact windows are unchanged. Super Sonic loses rings on enemy hits rather than receiving ordinary player health damage.

Attack weights vary: swats/double sweeps ×1.15, spin ×1.2, uppercut ×1.25, stomp ×1.3, ring wave ×0.85, dorsal lasers ×0.7 and failed struggles ×1.5. Phase two adds ×1.15. Ring loss rounds to an integer. Hits carry stronger outward force; swats have a 0.65-second decaying throw. Existing invulnerability and defensive windows prevent damage stacking. Impact sparks, dust, shake and new original layered low-frequency Foley reinforce contact. Shake/effects/volume settings still apply.

A single buffered follow-up can be entered near the last contact of the current move. Hold LMB for basic combos and tap a special near contact to queue it ahead of the held attack. Confirmed melee and completed ranged emissions can cancel recovery after 85 ms; all authored contacts must finish first. Whiffs keep their full recovery. Cyloop and counters finish their complete trajectories. Energy and cooldowns are paid on actual launch; they are not refunded. Held basic attack cannot overwrite an explicitly queued special. Dodge, damage, boss phase changes, struggles and retry clear pending intent. Queued inputs are transient and do not resume from saves.

Revision-five saves retain custom Sonic damage exactly and migrate boss health proportionally once, including hard bosses with the maximum health multiplier. Portals, checkpoints, rewards, the Emerald objective, transformation, music cue boundaries, finale and physical return portal remain intact.

## Camera and controls

Existing controls remain unchanged. LMB combos, X homes, R uses Sonic Boom, F uses Wild Rush, E performs Cyloop, C uses Cross Slash, V uses Homing Shot; Z uses Stomp, G uses Spin and B uses Cyclone. Existing controller presets remain available. Q dodges, RMB parries and Tab toggles targeting.

Arena Camera settings now include Move Camera. Each move uses a live shoulder composition focused on Sonic. Camera transport follows his displacement before easing the boom, including the entire Cyloop orbit and successive moves. Player camera rotation remains available. Actual boss-body occlusion still overrides close framing. Protected cutscenes retain their own authored cameras; camera history resets across stage/retry changes and large teleports. Turning Move Camera off restores the usual gameplay composition.

## References and limits

Research includes the user's image, the viewed Kronos Island screenshot linked from Wikipedia, SEGA's official product page and Pro Game Guides' Giganto encounter guide. The guide describes slow arm swings, parry damage, dorsal lasers and beam/grab struggles. The supplied YouTube reference was unavailable through the current network proxy. See `reference/giganto-highlands-2.9.2.json` for URLs and observations. Research images are not included in distributed assets.

Foliage is procedural cutout geometry with shared branch shapes; it does not reproduce Frontiers' commercial vegetation assets or full landscape. Close camera framing may widen around a moving arm or the mantle. This is a browser Three.js adaptation, not verified 1:1 fidelity. Shadows, overdraw and high detail remain hardware dependent. Native Windows launch and physical controllers cannot be checked on this Linux host; automated Gamepad API and Windows payload extraction checks are separate.
