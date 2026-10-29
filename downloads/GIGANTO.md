# DCSMCRAFT 2.8.0 — Titan Signals: Giganto

This is a **playable, original fan interpretation** of the original **Sonic Frontiers (2022), Kronos Island Giganto encounter**. It is **not a complete 1:1 port**. Minecraft Java Edition 26.3 remains DCSMCRAFT's separate sandbox reference. Sonic and Giganto are Sega characters; this independent addition uses newly written code, procedural models, textures, animations, effects and synthesized audio. No Sega model, animation, voice, soundtrack or recording is included.

## Find and enter

In an existing or new singleplayer Overworld, portals can appear in loaded, accessible terrain. Pause → **Titan Signals · Giganto** shows a discovered portal's XYZ coordinates, rewards ledger and world-specific settings. Creative also offers a safe-site search button; it bypasses the chance roll, not safety checks. Explore clear terrain if no loaded site fits. Stand near a portal on solid ground and press **E**. This takes priority over opening inventory while its prompt is visible.

The default spawn chance is **0.32 per eligible 64×64 search cell**; up to eight deterministic seeded points are checked per cell. Discovery scans once per second near the player and never requests remote chunks merely to place a portal. A 5×5 support area and five blocks of empty height are checked, with no water/lava, leaf/log/cactus/bed/chest/magma support, partial shapes, occupied creature space or protected structures. One portal/session exists at a time. Repeat activation and invalid or obstructed entry are rejected. Successful or abandoned encounters consume the site and start a **900 world-second cooldown**; pausing does not consume that cooldown.

This is a **singleplayer encounter**. Entry is blocked while co-op is connected, and opening co-op is blocked during an active trial. Ordinary multiplayer remains available after returning. The arena uses a separate mesh scene and fixed-step simulation; it does not replace or edit the normal voxel world or its dimension. The player's normal state, inventory, equipment, camera mode and return position are saved before control is transferred. Normal world simulation and its elapsed timers remain frozen during the trial.

## Objective and controls

Six Chaos Emeralds are established as already secured **within this encounter's fiction**; no missing Overworld Emerald quest is implied. Start as blue Sonic and climb the thirteen-pad route up Giganto to physically collect the **seventh and final Emerald** above its head. All twelve climbing transitions use actual jump/boost/air-control movement and platform landing collisions. Warned dorsal pulses can knock Sonic away on the back-side climb. Missing a jump returns Sonic to the last safe pad; it cannot strand the player below the climb. The Emerald unlocks the Super Sonic transformation and aerial fight.

| Input | In the encounter |
| --- | --- |
| WASD / mouse | Move or fly / orbit camera |
| Shift | Boost, using regenerating energy |
| Space | Jump as Sonic; rise as Super Sonic |
| Ctrl | Descend in Super form |
| Left mouse | Homing approach, repeated combo; Grand Slam when a counter prompt is active |
| Right mouse held | Parry arm swing, slap and incoming grab; default forgiving hold behavior |
| Q | Directional dodge with a brief immunity window |
| R | Sonic Boom burst |
| F | Wild Rush dash attack |
| E | Quick Cyloop: energy cost, lift/stagger window and orbiting effect |
| Tab | Toggle lock-on camera and target marker; unlock for free mouse orbit |
| Space / left click, tapped | Fill the timed mouth-beam or grab/crunch struggle meter; held/repeated same-tick taps do not count |
| Enter | Skip intro, transformation, phase transition or finale |
| Escape | Pause: resume, settings, safe exit, or save checkpoint and quit |

Ordinary mining, building, inventory, weapons and world commands are intentionally unavailable while Sonic controls are active. They return afterward. Existing sandbox bindings and held-item behavior remain unchanged outside the encounter.

## Fight and settings

Blue Sonic is traversal-only; the boss cannot be damaged before the Emerald. Super Sonic starts with **360 rings**, drains **one ring per active combat second** on Normal, and loses when rings reach zero. Easy/Hard scale ring drain by 0.65/1.3, boss HP (1,800/2,600/3,400) and attack windups. Energy fuels boosting and special attacks and regenerates. Combos fill Phantom Rush for an eight-second ×1.2 damage window. Ranged and special attacks have energy/cooldown checks; holding attack cannot create unlimited same-tick hits.

The boss state machine includes readable left-arm swing and right-arm slap windups, strike frames, knockback, dodge immunity, forgiving parries, stagger/recovery windows and a prompted Grand Slam counter. At half HP it enters a protected phase transition, extends dorsal emitters and gains back laser hazards, a mouth-beam struggle, and a parryable grab leading to a crunch struggle. Failed struggles cost a custom difficulty-scaled 10/20/30 rings, followed by protected recovery. Ordinary Super-form arm hits cause knockback rather than normal-player health loss. Cinematics and active struggle sequences pause passive ring drain; protected cinematics never damage the player. Empty HP starts a skippable finishing sequence and bounded disintegration effect, then victory.

Titan Signals settings cover natural portal enable/chance, cooldown, effects, lighting, audio, original boss score, difficulty, starting rings (100–999), passive drain (0–3), retry checkpoints, cinematics and optional strict 0.3-second parry timing. Boss score also respects the game's main Music switch and master volume. Settings save with the world. Retry applies newly selected starting rings and boss HP; other toggles can take effect immediately. New cooldown duration applies on the next exit. Zero drain is an intentional accessibility/configuration option.

Retry checkpoints preserve Emerald completion and, when enabled, the half-health phase. Saving/quitting during the arena restores its progress, HP, rings and position. Interrupted enemy attacks resume with an idle grace period and immunity, rather than resuming a surprise strike or partly expired QTE. Pause freezes movement, resource drain, attack clocks and animations.

## Return, rewards and persistence

Victory offers **Claim reward & return**. Defeat offers **Retry checkpoint** or **Return**. Pause also provides a forfeit exit and **Save checkpoint & quit**. The restored normal player keeps their previous persistent state, inventory, equipment, realm and location; transient input/velocity/held-use state stops safely. Victory adds one recorded **Titan Sigil badge** in Titan Signals, **six diamonds, eight Hellfire ingots and 100 XP through the existing XP/Mending system**. The badge is a journal record, not an inventory item. Full inventory overflow becomes uniquely identified ordinary item drops at the return location.

Reward inventory/drops/XP, the session completion ledger, consumed portal and cooldown are committed together through the existing two-generation checksummed save system. Failed return saves roll back the entire mutation, keeping the arena checkpoint available to retry. Repeated Return/Claim calls cannot grant another reward. Victory is unclaimed until this return transaction succeeds. Forfeiting never grants rewards. As with ordinary world saves, use one active tab per world; a separate cross-tab authority/locking system is not added.

Saves add one optional top-level `giganto` record; the old save envelope, generation **16**, protocol **4**, seed, terrain edits, containers, ordinary entities and existing realm data remain compatible. Old saves default to no encounter. No world regeneration is required. The Windows launcher source remains unchanged; its build now assembles the exact read-only embedded HTML directly rather than expanding it into millions of C integer literals. Windows PE/payload and Linux companion extraction are verified byte-for-byte.

## Honest fidelity and missing features

| Area | Status / differences |
| --- | --- |
| Portal → climb → Emerald → transformation → two-stage fight → victory/defeat/retry/return | Implemented, with persistence and reward guards. |
| Reference attack catalog | Arm swing, slap, dorsal lasers, mouth beam and grab/crunch are implemented. Timing, volumes, damage tuning and exact choreography are custom approximations. |
| Climb | Playable original platform route around the Titan, with boost/jump and fall rescue. Warned dorsal knockback pulses are included. **No wall running, direct mesh climbing, original boost-ring path or original terrain reproduction.** |
| Sonic / Super Sonic | Original textured low-poly, articulated rigid-part bone rigs with movement, jump, flight, attack, kick, parry, dodge and hurt blending, golden form and raised quills. **Not production Sega meshes, deforming skin rigs, facial blendshapes or a full hand/finger animation system.** |
| Giganto | Original articulated armored Titan, jaw, shoulders/elbows, legs, fingers and dorsal emitters. **Simplified low-poly anatomy and a largely stationary boss; no full ground locomotion/charging path, official detailed mesh, ragdoll or original animation clips.** Grab/crunch is represented by the arm gesture, timed attack volume and struggle sequence. |
| Combat | Combo/homing, Phantom Rush, Sonic Boom, Wild Rush, Quick Cyloop, dodge, parry and Grand Slam interpretations. **No complete Frontiers skill tree, freehand Cyloop recognition, exact combo input tree or head/body damage multipliers.** Quick Cyloop and Grand Slam use abbreviated effects/poses, not the full original cinematic choreography. |
| Collision / camera | Platform collisions, coarse body/boundary exclusion and camera keep-out volumes. **Not per-triangle Titan climbing or fully mesh-accurate animated hand hitboxes.** Strike volumes are analytic and tied to the same attack timeline as the rig. Extreme manual camera angles and limbs remain approximate. |
| Cinematics / finale | Skippable original fly-throughs, transformation, dorsal transition and bounded defeat dissolve/shards. **Not the original cinematic direction, facial performance, mouth-through-body shot or commercial explosion sequence.** |
| Art / sound / score | All newly authored procedural replacements. **No official voices, music, vocal rock track, Sega VFX, licensed skins or commercial asset downloads.** The synthesized score is a modest original accompaniment. |
| Multiplayer | Encounter is singleplayer-only; no synchronized Sonic/Titan raid. Ordinary co-op is preserved and guarded against overlapping entry. |
| Balance | Original fixed difficulty presets; **not Frontiers' imported Strength/Defense/ring upgrade progression or frame-perfect mechanics.** |

The code delivers the whole playable loop, not a claim that these approximations are complete commercial-game parity. Existing CONTENT.md, FEATURES.md and other game limitations remain.

## Reference verification

The original fight sequence, forgiving held parry, climbing/head Emerald, ring drain, arm swing/slap, half-health dorsal lasers, mouth beam and grab/crunch were checked against Dave Acuña's [Sirus Gaming Giganto guide](https://sirusgaming.com/sonic-frontiers-giganto-boss-guide/) on October 29, 2026. It distinguishes traversal plus two Super phases. This implementation calls the two combat stages phases 1 and 2 and lists substitutions above. The guide was used as factual reference, not copied assets or dialogue. Optional strict parry is a custom mode, not a claim about the original Kronos fight.

## Launch and verification

Extract the Browser ZIP and open `DCSMCRAFT.html` in desktop Edge/Chrome, or extract the Windows 10/11 x64 ZIP and run `DCSMCRAFT.exe`. Singleplayer needs no server. Source includes the procedural models/art/audio, dependencies/locks, simulation, server and tests. Run `npm ci`, `npm test`, `npm run build:standalone`, and `npm run test:e2e` for development. VALIDATION.md records executed checks. Browser automation uses the exact standalone over loopback, with outside requests blocked for the encounter; native Windows launch/direct-file opening remain untested on Linux.
