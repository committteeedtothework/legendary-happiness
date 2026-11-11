# Giganto cinematic overhaul · 2.8.16

This stage expands the existing singleplayer encounter. The portal, ring gathering,
armor ascent, final Emerald objective, combat phases, music cues, checkpoints,
rewards and return to the saved world are retained. Nothing in the overworld
renderer, terrain generator, block textures, controls or save envelope is changed.

## Implemented

- **Colossal scale:** arena coordinates render at 1.6 metres per canonical unit;
  the approximately 95-unit Titan is approximately 152 metres tall. Sonic's body
  retains its prior physical size. Scenery, camera, shadows, targeting, effects
  and analytic combat regions use the same conversion. Existing saved canonical
  coordinates remain valid; Super Sonic's energy attack ranges expand with the
  encounter. Ground traversal framing is wider.
- **Atmosphere:** a continuous 240-second default arena cycle passes through day,
  sunset, night and dawn. The persisted simulation clock controls sun/moon,
  stars, shadows, sky colors, fog, cloud cover and rain. Changing weather grows
  more severe smoothly in phase two. Moonlight and environment illumination
  preserve dark model detail. A 64-pixel sky reflection probe refreshes every
  four seconds on High or twelve on Balanced; Low avoids that cost.
  Turning Sky reflections off retains a static lighting probe instead of
  refreshing its captured sky.
- **Emerald sequence:** an original solid octagonal-cut gemstone with explicit
  facets and a polished physical material replaces the previous primitive.
  Sonic reaches for the final Emerald; seven separate colored gemstones orbit,
  accelerate, converge and disappear inside him. A shader blends his blue atlas
  toward gold while the quill layer rises and the aura energizes. Root movement
  into collection and out into flight is continuous. Six consumed contact events
  synchronize effects and Foley without replaying them after checkpoint reload.
  Queued contacts carry their complete catch-up age, preventing delayed Foley
  bursts after a slow frame.
- **Adaptive combat:** six rapid unblocked hits can trigger a 1.25-second frontal
  guard with visible anticipation/release. Its active window reduces frontal
  damage to 25%; flanking and earned counters bypass it. A ten-second cooldown
  prevents repeated shielding. Retaliation, player distance, camping and phase
  influence attack selection; the last two moves remain excluded where possible.
  Recovery is faster in phase two, with an absolute 1.05-second minimum.
- **Aerial pressure:** the new visible ring wave expands at the height locked in
  during its windup. Change altitude, dodge or time a parry within 0.3 seconds of
  contact. A held parry cannot permanently defeat this move. Swept contact avoids
  missed hits across frame rates, and the wave damages once per release.
- **Carried grabs:** a caught Sonic moves continuously into Giganto's hands at the
  jaw. Shared hand targets and a close cinematic camera follow the restraint.
  Fresh Space/LMB taps escape into the existing earned counter. Failure throws
  Sonic outward, costs rings and supplies temporary invulnerability; it does not
  strand him inside the Titan. Existing beam struggles remain available.
- **Weight and scenery:** guard/pulse arm poses use shared procedural targets,
  alongside existing blended attack clips, deforming armor and foot planting.
  New original distant colonnades are instanced outside movement/camera bounds.
  Footfalls and low impacts create temporary ground depressions, dust and flying
  stones. Contact flashes use two reusable light slots. Six crater slots, at most
  72 stones/dust planes and twelve retained impact events bound rendering costs.
- **HUD:** thinner health framing, guard feedback, more consistent typography,
  resource hierarchy, contextual warnings, escape prompts and transformation
  banners remain exclusive to the Titan interface. The normal HUD returns on exit.

## Controls and configuration

Enter a discovered portal with **E**. Gather rings, then climb Giganto for the final
Emerald. During combat: **WASD** move, **Space/Ctrl** rise/fall, **Shift** boost,
**LMB** combo/counter, **RMB** parry, **Q** dodge, **Tab** target,
**X** homing attack, **R** Sonic Boom, **F** Wild Rush, **E** Cyloop,
**C** Cross Slash, **V** Homing Shot. **Enter** skips protected cinematics;
**Escape** opens the arena pause menu. Tap **Space/LMB** for struggle prompts.

Escape → Battle settings contains Day/night cycle, Day length (90–1200 seconds),
Changing/Clear/Storm weather, Rain, Ground impacts, Sky reflections, quality,
shadows, AO, post-processing, exposure, particles, motion blur and camera settings.
Combat adds Adaptive defense and Aggression (0.7–1.5). These preferences belong
to the encounter, never to overworld settings. Existing local MP3 imports and
editable cue maps remain under Audio → Soundtrack.

Normal boss health remains **12,000 HP** (Easy 8,000; Hard 16,000). Existing player
damage, ability costs/cooldowns and default ring drain are unchanged. Basic hit
34, combo 42, heavy 62, finisher 120, homing 90, Boom 145, Cross Slash 125 per
wave, Rush 95 per contact (three maximum), Cyloop 185, perfect counter 460.
All existing damage tuning remains configurable. The new defense and pressure
increase challenge without silently inflating health or reducing base damage.

The final automated default-difficulty playthrough reached victory approximately
126.57 simulated seconds after arena entry, including preparation and ascent,
with 301.9 rings remaining. It retained 12,000 maximum boss HP, made three music
transport starts across the encounter, restored the original player's 17 health
and granted one ledger entry. These are test-scenario results, not a promised
human completion time or hardware FPS measurement.

## Verification

Final results, exact build hashes and changed files are recorded in VALIDATION.md
and the accompanying verification reports. Automated checks include actual GLB
rigs and deformation, frame-rate comparisons, event deduplication, guard timing,
directional damage, ring-wave avoidance, carried grab escape/throw, reflection
and renderer restoration, bounded effects, pause/checkpoints, portal-to-return,
victory/defeat/retry, soundtrack handling and repeated visits. Browser captures
are actual game renders; staged time/pose screenshots are labeled separately
from the playable full encounter.

## Remaining approximations and asset notes

| Requested area | Status in this stage |
| --- | --- |
| Arena day/night, changing weather and local combat lights | Implemented; isolated simulation clock and bounded lights |
| Larger Titan/arena, matching render/contact coordinates | Implemented; 1.6× conversion with Sonic's body size retained |
| Adaptive defense, phase aggression, aerial pressure and carried grabs | Implemented; telegraphs, directional guard, escape/counter and throw |
| Physical Emerald collection and seven-gem transformation | Implemented; rig interaction, orbit/absorption, blended golden material/quills |
| Heavy animation, environmental reactions and scenic expansion | Expanded; original procedural layers and supplied rigs, shallow visual craters |
| Exact official choreography, cinematic performance and interface | Partial; reference-inspired original presentation, no official motion/font assets |
| Reflections and terrain damage | Partial; sky probes and temporary visual deformation, no local-object tracing or excavation physics |
| Overworld isolation, checkpoints, rewards and return | Retained; final verification results accompany the build |

- This remains a fan-made Frontiers-inspired encounter, not an exact port. The
  supplied GLBs, their existing authored rigs/clips and original procedural layers
  are retained. Official motion capture, choreography, facial performance, fonts,
  material authoring and an official animation-event track are unavailable.
- Combat uses shared animated analytic body/limb regions; armor climbing uses the
  real deforming mesh. Combat hitboxes are not per-triangle surface collision.
- Temporary ground deformation is visual, shallow and recoverable. It does not
  alter the movement collision floor or permanently excavate terrain. Distant
  ruins are scenery, not explorable interiors. No newly generated external asset
  or paid service is required.
- Reflections capture the sky, not moving local characters. There are no ray-
  traced reflections or volumetric clouds. Existing scalable screen-space contact
  shading, shadow maps, procedural textures and post-processing remain in use.
- The HUD uses original shapes and installed font fallbacks; typography varies
  by PC and does not reproduce the licensed interface exactly.
- Existing user-supplied music remains byte-identical. No new commercial audio
  or redistribution license was obtained. Musical section/cinematic synchronization
  follows the existing explicit encounter/cue system; exact official timing is
  unverified. See GIGANTO-MUSIC-DIRECTION.md and TITAN-ASSETS.md for provenance.
- Quality/performance evidence comes from the Linux Chromium test environment,
  including software WebGL. It is not a Windows hardware FPS guarantee. Visual
  cue delivery remains limited by rendering frame rate; stale Foley is skipped
  rather than replayed late. The soundtrack transport itself follows audio time. The
  Windows launcher can be built and its embedded HTML extraction verified here;
  native Windows execution cannot be tested on this host.

## Changed implementation

New modules: `titan-atmosphere.js`, `titan-metrics.js`, `titan-transformation.js`,
`titan-tactics.js`, `titan-ground-fx.js`, `titan-ruins.js`.

Integration: `giganto-simulation.js`, `titan-contact.js`, `titan-cinematics.js`,
`titan-climb.js`, `titan-kinematics.js`, `titan-imports.js`, `giganto-models.js`,
`giganto-view.js`, `giganto-audio.js`, `titan-settings.js`, `titan-menu.js`,
`titan-hud.js`, `titan-timing.js`, `giganto.js`, `giganto.css`. Tests, version metadata, release
packaging and documentation accompany these changes. The stage-specific changed
file list distinguishes this update from earlier uncommitted work in the repository.
