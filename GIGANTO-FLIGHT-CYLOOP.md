# Giganto · Flight, power and pre-fight Cyloop · 2.8.21

Arena-only changes. Overworld gameplay, world assets, music timestamps, portals, objectives, unskippable cutscenes, the finishing explosion and saved aftermath sky remain.

## Combat

Giganto has 32,000 / 48,000 / 64,000 HP on Easy / Normal / Hard, four times the previous defaults. The existing 0.5–2 health multiplier remains. Super Sonic's damage values are independently configurable:

| Move | Damage |
| --- | ---: |
| Basic / combo / heavy / finisher | 180 / 235 / 360 / 760 |
| Homing attack | 500 |
| Sonic Boom | 820 |
| Wild Rush | 540 per contact, three maximum |
| Cross Slash | 680 per wave, two maximum |
| Homing Shot | 210 per sphere, six maximum |
| Quick Cyloop | 1,400 |
| Counter / perfect counter | 1,900 / 2,900 |
| Cinematic counter | 2,300 |

Energy costs, cooldowns, contact times, reach, phase protection and stagger immunity are retained. Pressure, recoil and impact presentation are normalized for the larger numbers; ordinary hits do not force maximum screen shake or overwhelm telegraphs. A prepared mixed attack/parry/special simulation wins at approximately 32 / 47 / 58 seconds with cinematics disabled. This is an automated favorable-play benchmark, not a predicted human completion time. Native browser verification also exercises the mandatory phase and finishing cinematics. Poor preparation and ring drain still cause defeat.

Old saves preserve the Titan's health fraction and health multiplier. Serialized attack overrides retain their relative strength, upgrade once, and remain editable afterward. Interrupted counter damage uses the upgraded limit and remains single-use. New high-health saves retain values above the old 100,000 HP clamp.

## Base Sonic Cyloop

During ground traversal, hold **C** while running a closed loop through the grass. A blue path follows the drawing and flashes pink at closure. A valid loop releases eight physical golden rings, worth five rings each. Walk through them to collect them. The minimum length is 14 arena units and enclosed area 12 square units; tiny turns, straight backtracking, airborne drawings, collision teleports and oversized paths do not generate rewards. The ability has a six-second cooldown and bounded drawing/drop storage. Rings expire after 24 seconds, respect ring capacity and persist across save/reload without duplicate awards. A partially drawn path cancels on load. **E** retains armor grip/release. Combat **E** retains Quick Cyloop; combat **C** remains Cross Slash.

## Animation and visuals

Super Sonic uses distinct hover, forward flight, ascent, descent, strafe and boost poses. Combat motions have full torso/arm/leg rotations for punches, combo, heavy kick, finisher, homing attack, Homing Shot, Sonic Boom, Wild Rush, Quick Cyloop, Cross Slash, counters, parry, dodge and hurt. Release/contact clocks remain authoritative. Poses blend through the existing quintic transition system. Limb scales, avatar coordinates, hit detection and mesh counts remain stable.

The blue speed ribbon is absent in Super Sonic form. Gold aura and sparks remain; the intentional Quick Cyloop orbit is distinct from a following speed trail. Base Sonic retains the ordinary speed ribbon. The new ground Cyloop uses two bounded instanced meshes for its path and released rings.

Arena grass has root-to-tip shading, a subtle back-light fill and layered wind motion. Terrain anisotropy scales to 1 / 4 / 8 for Low / Balanced / High, capped by actual hardware support and cached to avoid per-frame texture uploads. High-resolution terrain inputs, shadow controls and existing anti-aliasing remain. No Overworld texture or shader changes occur.

Pose blending reuses quaternion/vector scratch storage instead of cloning both for each blending joint every frame. Inactive impact/trail instances no longer receive 96/48 redundant matrix/color writes; particle colors reuse scratch storage. Effects remain bounded and scalable. Software WebGL measurements are reported separately from hardware PC performance; no universal FPS guarantee is claimed.

## Reference and verification

[SEGA's product description](https://store.steampowered.com/app/1237320/Sonic_Frontiers/) documents the combat vocabulary and Cyloop. [Mineragrl's Giganto trial guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3043795839) informed the attack/parry/counter and second-phase laser/Quick Cyloop rhythm. The latter concerns Final Horizon on Hard, so its difficulty is not treated as story-mode data. See reference/giganto-flight-cyloop-2.8.21.json. Models remain the previously supplied rigs; new motions and grass/ring effects are original. These are authored procedural clips, not official motion-captured animations or exact Frontiers choreography. No paid generation was used.

See VALIDATION.md and the Screenshots ZIP for the executed checks, native rendered samples, timing data, pickup/reload results and full changed-file list. Native Windows launch remains untested on the Linux host; its embedded browser payload is byte-verified. Exact standalone HTML bytes are tested over loopback with external assets blocked because the managed browser restricts direct file navigation.
