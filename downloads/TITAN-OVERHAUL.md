# DCSMCRAFT 2.8.4 — Titan arena and preparation overhaul

This update changes the dedicated singleplayer Giganto encounter. The voxel sandbox, world generation, ordinary player, weapons, skins, inventories and multiplayer remain separate. The normal world/player state, interface, camera mode and renderer settings return after victory, defeat/forfeit or checkpoint quit. The character meshes are the previously supplied Sketchfab assets, with revised original animation clips and new runtime posing; credits remain in TITAN-ASSETS.md.

## Music and preparation

The complete user-supplied **Titan GIGANTO Sonic Frontiers OST.mp3** plays during portal intro, ring gathering, the ascent and transformation. Native media streams the embedded recording, loops it, pauses/resumes at the same position and releases it when aerial combat begins. **Undefeatable** then uses the existing phase-aware audio-clock transport. A cold pre-fight checkpoint reload restarts the prelude; current battle checkpoints retain their actual saved music cursor. Main Music, Music Volume, master and Encounter Music/Audio switches apply. No online stream, server or extra prompt is needed. Original MP3 bytes, cover, metadata and hashes are retained in public/audio/giganto/; prelude-manifest.json and PRELUDE-NOTICE.txt identify the source.

New trials start with **80 rings**. **36 golden trails**, each worth **10 rings**, surround the playable floor; each visibly contains ten rotating rings. Enter a trail to collect it. A trail awards once, stops accepting pickups at capacity and persists its stable ID. Default capacity is **400**; the existing ring option now controls capacity. Each of the twelve ascent checkpoints also grants five rings once, capped at capacity. The meter carries into Super form; combat no longer grants a free refill. Gathering enough before climbing is useful, not a mandatory invisible gate.

Retry preserves the best prepared ring amount, with a minimum of 180 capped by the chosen capacity, and clears floor-trail IDs for a new preparation attempt when retrying the ascent. These are encounter-only resources, never exported as ordinary world items. Saves deduplicate/validate trail IDs. Walking underneath an elevated pad no longer advances the ascent: its checkpoint requires actually landing at the platform height. Existing fall rescue remains.

## Longer combat

| Difficulty | Boss HP |
| --- | ---: |
| Easy | 8,000 |
| Normal | 12,000 |
| Hard | 16,000 |

These replace 1,800 / 2,600 / 3,400. Player-caused boss damage is **45% of the previous values**, including specials/counters/struggle success; Phantom Rush still multiplies it by 1.2. Damage against ordinary world creatures is unchanged. Ring drain, difficulty modifiers and protected cinematics/QTE rules remain. Effective duration depends on inputs and settings; an automated real-control victory is measured in VALIDATION.md, not advertised as a guaranteed player completion time.

Offensive specials now finish their short action poses before another offensive action replaces them. **Q dodge can still cancel defensively.** This fixes basic-attack/special spam cutting animations off immediately; it also prevents overlapping offensive activations. Holding LMB resumes basic combos when the action ends. Specials retain existing costs/cooldowns and controls. Timely parries, counter windows, dodges and struggles remain important. Long fights require ring preparation; there is no forced timer, invincible filler phase or artificial damage delay to fit music.

The optional session balance marker is version 2. Legacy in-progress sessions migrate proportionally to the new maximum HP, preserving their current health fraction and phase. Old saves/defaults remain readable. Save envelope 1, generator 16 and protocol 4 remain; no world regeneration is required. Existing normal-world rewards and exactly-once ledger behavior are unchanged.

## Arena graphics

The old faceted cone/cliff backdrop is replaced in the playable view by a continuous, tessellated highland basin, textured rock, tileable grass/soil/normal maps, slope-aware foliage and smoothed eroded boulders. A layered alpha-cutout forest, nearby wind-driven grass, shallow scenic water and phase-two airborne debris add depth and scale. Decorative solid scenery begins outside the walking/flight bounds; the play floor remains flat and clear, avoiding mismatched collision hills or trees trapping Sonic. Water/debris are scenery, not new swimming/destruction systems.

Geometry is shared/instanced: floor/cliffs are continuous meshes; grass, trunks, foliage, ring trails, boulders, debris, particles and ripples use batches. Grass density follows Graphics quality and is hidden at high aerial altitude. Ground-ring matrix updates stop during combat. Medium/High graphics add an original sky-derived reflection environment, selective soft bloom and an output pass; Low bypasses those passes. Existing shadows and encounter particle/light switches apply. Exposure/render targets and arena-specific canvas filtering are scoped/restored; the normal voxel world retains its original rendering and pixel treatment.

This is a **higher-detail original procedural/stylized PBR landscape**, not photorealistic scanned Frontiers terrain, production vegetation, ray tracing, screen-space reflections or full ambient occlusion. The existing platform route remains; direct mesh wall running/climbing is not implemented.

## Animation, camera and effects

Sonic's idle/flight/combat/parry/transformation keys now include body balance, anticipation, impact/recovery and follow-through. Sonic Boom, Wild Rush and damage clips are aligned to actual action durations. Fast combat transitions use shorter blends, with gentler locomotion blends. A two-bone arm solver brings Sonic's hands into attacking/guard positions and guides Giganto's swing, slap and grab toward their presentation targets; Giganto also looks toward Sonic. These layers modify the rendered skeleton, not the saved avatar position or normal-world player.

Basic strikes add a short visual homing lunge. Quick Cyloop can orbit the rendered Sonic with its own cinematic camera when cinematics are enabled; disabled cinematics retain free camera presentation. The finale keeps Sonic/glow/particles together on a front-facing approach rather than moving the hero into the torso. Broader aerial framing, a wider far plane, boost FOV response and bounded impact shake give more scale; the body keep-out is rechecked after shaking. QTE/phase/intro/finale cameras remain protected/skippable as before.

The imported GLBs retain **22 Sonic / 24 Giganto named clips** and their original triangle budgets. The refreshed body keyframes are exported; runtime IK, visual lunge/orbit and camera motions are engine layers. Facial performance, individual Sonic finger animation, fully mesh-accurate grabs/hand contacts, full cinematic choreography and exact production animation fidelity remain incomplete. Existing analytic hit volumes are retained.

Original synthesized encounter Foley now uses layered metal/resonance, low body impact, filtered grit and shaped wind/energy sounds instead of simple event beeps. Three noise variants are cached lazily per cue, with a twelve-voice cap and disposal. Gold ring chimes, attacks, parries, counters, telegraphs, pulses, beam/grab, movement and stage/struggle success have distinct cues. No commercial sound effects are imported. VFX use soft instanced sparks, impact ripples, a less opaque Super rim, restrained corona, emitter-attached lasers and drifting rock; effects remain bounded and respect particle switches.

## Reference-style HUD

The supplied image guides an encounter-only white vector HUD: upper-left rings/capacity and compact live resource counters, a heading compass, restrained boss bar, right-side combo/Phantom Rush, a lower-left diamond stat cluster and lower-right speed/boost dial. The **camera icon is omitted**. The target is a hollow triangle; contextual action/struggle controls remain. Pause/result panels follow the arena's visual treatment. Both full and compact viewport layouts are inspected.

Icons and typography are original/system-font recreations, **not pixel-identical commercial UI assets**. Stat counters show DCSMCRAFT's actual speed, damage multiplier, guard state, capacity, pickups, Emerald count and energy. No fake upgrade levels, skill currencies or complete Frontiers skill tree are implied. On return the arena HUD/styles hide and the original Minecraft-style sandbox interface reappears.

## Controls and sources

Pause → Titan Signals locates/configures the portal; E enters nearby. Arena: WASD/mouse, Shift boost, Space jump/rise, Ctrl descend, LMB combo/counter, RMB parry, Q dodge, R Boom, F Rush, E Cyloop, Tab target, Enter skip, Escape pause/exit. Gather gold trails before following the marked ascent ruins. Controls and remaining encounter differences are in GIGANTO.md; music cue specifics are in GIGANTO-MUSIC.md.

The new recording's metadata identifies **Titan: GIGANTO - Sonic Frontiers [OST]**, uploader/artist tag **DeoxysPrime**. It is user-supplied soundtrack material; rights remain with Sega and the respective composers, performers and rightsholders, and no separate redistribution license accompanied the upload. It is not covered by the project MIT license. No paid generation service was used. Source installs use npm ci; normal prebuild/predev/pretest reconstruct both recording embeds and the GLB embed. Rebuilding the character GLBs uses the same original files and Python/Pillow/NumPy pipeline documented in TITAN-ASSETS.md. Executed verification and platform limitations are in VALIDATION.md.
