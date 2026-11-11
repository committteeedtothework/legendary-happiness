# Giganto · Detonation and aftermath · 2.8.19

This stage refines the existing WebGL encounter. It does not replace Three.js with Unreal Engine or claim UE5-level asset fidelity. Existing portal entry, traversal, Emerald objective, combat balance, controls, unskippable cinematics, rewards and playable return portal remain.

## Ending

Sonic's chest transit still contacts at 3.60 seconds and exits behind the torso by 4.80. A new consumed encounter cue detonates Giganto at 5.45 seconds. The armor breaks away from the core and limbs; the body finishes disintegrating by 6.40 seconds. The final camera track stops orbiting the empty Titan and moves toward Sonic before flight control returns at seven seconds. The Overworld portal then opens as before.

The rupture shader affects the original color, normal/AO and shadow surfaces together. It reveals hot fracture edges without turning the entire Titan orange or fading an intact model. The inner chest tunnel breaks away with the core. Up to 256 instanced armor fragments use the existing Titan texture, with embers, two thin shock rings, an HDR core flash, local light and up to 40 soft procedural smoke billboards. Debris and smoke are deterministic from saved cinematic time, freeze during pause, and expire. The body and its shadow stay absent after destruction. No character afterimages or duplicate character meshes are added.

The effect is an authored visual fracture and ballistic debris simulation, not a destructible remesh, rigid-body armor collision, fluid fire/smoke simulation or Unreal Chaos destruction.

## Weather and time

Victory saves the exact arena sky clock, phase pressure, day-length and weather settings before resetting the cinematic clock. The sun/moon, light color, exposure-driving atmosphere and weather intensity retain that state throughout the aftermath and reload. Rain, wind and clouds continue animating. Time/weather controls are disabled after victory; graphics and audio settings remain usable.

The arena snapshot is separate from the Overworld. Returning restores the existing world state and saved player location. Older victorious saves receive a valid held sky state when loaded.

## Music and sound

The supplied battle track fades from cinematic second 5.20 to 7.00 through a smooth gain envelope. The gain curve is scheduled against the Web Audio source clock, so a slow rendered frame does not collapse the release into a sudden stop. Pause retires the current voice; resume/reload schedules only the remaining portion using the saved transport. No extra duration beyond the existing seven-second finishing cue is required from a custom recording.

The 5.45-second detonation cue triggers original layered low-frequency rumble, metal and transient Foley with a 2.8-second tail. Cues remain deduplicated across catch-up and saved reloads. No supplied recording bytes were changed.

## Graphics and animation

- Spatial SMAA anti-aliasing runs before the output transform, with no temporal frame history or character ghosting. Its checkbox is in the arena's Graphics section; it requires post-processing at Balanced/High and floating-point render support.
- High shadows use up to 4096 pixels, with the existing lower-cost shadow option retained. Three.js applies hardware limits. High sky reflections use a 128-pixel PMREM source instead of 64.
- High terrain uses 1024-pixel original procedural color/normal maps and smoother tree geometry. Low/Balanced retain smaller inputs. Quality changes dispose/reallocate GPU texture storage before changing dimensions; High maps are cached within the arena to avoid repeated generation. The public asset files and Overworld textures are unchanged.
- Cliff terraces are less regular; rock relief, foliage silhouettes and character material roughness/reflection balance are refined.
- Every imported clip transition now uses a quintic blend with zero endpoint velocity and acceleration. Contact timings, rig proportions and hit detection are unchanged. Super Sonic's aura uses flowing noise and a softer corona. The final shots have new continuous camera keys.

These changes refine existing animation clips and materials. They do not supply new motion-captured choreography, facial animation, high-poly replacement models, path tracing, Lumen, Nanite, ray-traced reflections, or photogrammetric terrain. The supplied rigs and procedural scenery remain the main fidelity limits. The optional speed blur remains the existing restrained screen-space effect.

## Cost and verification

High has a larger geometry, shadow and texture cost. Low/Balanced preserve the earlier forest geometry budget, while High adds smoother foliage and full explosion counts. The effects remain instanced and bounded. Software WebGL measurements from browser automation are not a desktop GPU FPS promise.

See VALIDATION.md, STAGE-CHANGED-FILES.txt and the Screenshots ZIP for the executed tests, exact changed files, frozen HTML checksum, rendered frames and native music measurements. Unit checks cover 30/60/144 Hz cue consumption, frozen sky persistence, malformed save recovery, deterministic/expired effects, all three rupture passes, monotonic music release, audio-clock pause/restart and reversible detail inputs. Browser checks render the High pipeline, compare anti-aliasing pixels, measure the actual recording's release, and exercise the existing return/reload/reward flows.

Native Windows launching remains untested on the Linux build host. The Windows launcher embeds the browser-tested HTML, and companion extraction is verified byte for byte. Managed browser policy restricts direct file navigation; automation serves the identical standalone bytes over loopback while blocking external assets. Desktop singleplayer can open the extracted HTML without a server.
