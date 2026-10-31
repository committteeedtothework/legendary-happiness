# Giganto · Chest finale · 2.8.17

This stage changes the Giganto encounter only. Overworld runtime modules, original public/reference assets, inventories and world formats remain unchanged. Existing portal, ring gathering, final Emerald, transformation, two combat phases, checkpoints, retry, rewards and return are retained.

## Presentation and choreography

The supplied stills guide the golden foreground Sonic, dark red-veined Titan, daylight basin and airborne backward defeat. Arena cliffs now have more tessellation, exposed terraced rock, deeper vegetation colors and a revised daylight/reflection balance. Imported character geometry and recordings remain the existing supplied assets.

Camera tracks use continuous cubic interpolation with shared velocities at shot keys. Actor transitions blend for 90 ms on attacks and 220 ms on other base transitions. The foreground combat camera adjusts its shoulder offset and distance to keep Sonic visible without entering the Titan's shoulders. Sonic's finale pose follows the actual flight tangent; the previous finishing kick is replaced by a forward flight pose.

The seven-second finisher retains the existing event-based score sequence:

| Encounter time | Action |
| --- | --- |
| 0–1.90 s | Sonic withdraws from his actual position and curves around the torso into a windup; no reset to a fixed starting location. |
| 1.90–3.60 s | Acceleration into a straight chest approach. |
| 3.60–4.35 s | Chest contact, continuous transit, opening armor, debris and restrained impact wave. |
| 4.35–4.80 s | Rear exit and outward flight. |
| 4.35–7.00 s | Titan recoils backward into the air, arms reaching forward; Sonic decelerates beyond the body. |

The visible torso is cut through in the color, shadow and contact-shading passes. An open-ended inner wall, torn rim and up to 96 instanced fragments surround the opening. The model stays opaque and the final pose/hole persist on the victory screen. At most 48 thin trail segments depict energy, without duplicate character meshes. The breach and poses reconstruct from saved encounter time, including a save during penetration.

This is a shader-cut opening with original animated dressing, not a remeshed/destructible physical chest. The protected cinematic uses its authored flight path rather than normal combat collision.

## QTE and controls

The QTE has a radial remaining-time arc, an independent actual-input progress arc, tap count, shield contact and translucent beam streaks. Timers and progress come from the simulation; no decorative fake progress is used. Repeated inputs retain the existing tap debounce and damage rules. Pause freezes them.

**Cutscenes play in full.** Enter and the legacy skip action cannot advance entrance, transformation, phase transition, counter or finishing scenes. Old saved settings that disabled cinematics are overridden only in this encounter. The skip/cinematic-disable controls are removed from the arena menu. Escape still pauses; pausing, saving, retrying after defeat and forfeiting safely to the overworld remain available. Forfeiting does not award a victory.

Combat controls and damage values are unchanged: WASD move, mouse camera, Shift boost, Space/Ctrl rise/fall, LMB combo/counter, RMB parry, Q dodge, X homing, R Sonic Boom, F Wild Rush, E Cyloop, C Cross Slash, V Homing Shot, Tab target. Tap Space/LMB for a QTE. Escape opens the isolated arena menu.

## Quality and performance

Arena quality, resolution scale, shadow resolution, contact shading, reflections, foliage, particles, bloom and post-processing remain independently configurable. Cinematic composition is mandatory; letterbox, FOV and shake preferences remain. No temporal character accumulation is introduced. The torso cut is applied to the AO normal/depth rendering too, and renderer/material state is restored after failed renders.

Detailed cliffs and High shadows cost more than Low quality. Automated WebGL runs use software rendering; their results are not a hardware FPS guarantee. Lower resolution scale, shadows, foliage and contact shading on slower computers.

## Fidelity and verification limits

This is a Frontiers-inspired reconstruction, **not verified 1:1 fidelity**. Still-image references cannot establish exact official motion timing, shot composition or music choreography. The supplied rigs, procedural joint animation, terrain, sky, trees and original effects remain visibly simpler than the official game's production assets. No new photogrammetry, facial animation, motion capture, official animation clips, physically simulated armor destruction or commercial asset generation was added. The Titan's existing head/jaw silhouette is retained; movement is not a new facial rig.

Existing user-supplied music and GLBs remain byte-identical. Finishing audio continues to use the existing explicit encounter cues; this stage does not retime the source recording or claim official soundtrack synchronization.

See VALIDATION.md and the accompanying verification reports for actual executed checks, final standalone SHA-256 and staged in-game captures. Native Windows launching cannot be tested on the Linux host. The Windows build embeds the same HTML verified by browser automation and payload extraction. Managed browser policy restricts direct file navigation, so the standalone is tested as identical bytes over loopback without external assets. End users can extract the Browser ZIP and open DCSMCRAFT.html in desktop Chrome/Edge without a server for singleplayer.

## Changed implementation

- `src/titan-finale.js`, `src/titan-finale-view.js`: flight, defeat, breach, fragments and shadow/AO cuts.
- `src/titan-cinematics.js`, `src/titan-contact.js`, `src/titan-kinematics.js`, `src/titan-imports.js`, `src/titan-animation.js`: camera continuity and animated actor integration.
- `src/giganto.js`, `src/giganto-simulation.js`, `src/titan-menu.js`: mandatory encounter cinematics and menu policy.
- `src/giganto-view.js`, `src/titan-landscape.js`, `src/titan-atmosphere.js`, `src/titan-ao.js`: arena presentation and rendering isolation.
- `src/titan-hud.js`, `src/giganto.css`, `src/giganto-audio.js`: live QTE display, beam/shield feedback and input Foley.
- Focused unit/browser tests, version metadata, packaging and documentation. STAGE-CHANGED-FILES.txt records the exact files changed relative to the beginning of this stage.
