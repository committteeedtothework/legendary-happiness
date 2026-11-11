# Devil’s Palm & Stand Awakening — 2.0.0

This is a playable, original-code supernatural expansion inspired by Steel Ball Run. The base sandbox still uses **Minecraft Java Edition 1.20.4** as its partial mechanics reference; Stands and the Palm are custom additions. Existing worlds, their generator versions and terrain edits remain supported.

## Finding and surviving the Palm

One active Palm normally forms in a remote desert or badlands region; occasional anomalies can appear elsewhere. Look for five rising fingers of layered stone, an irregular hand-shaped depression, red sand/cracked earth, bleached block skeletons, dead wood and broken shrine walls. Haze, a red-orange sky, darkened clouds, irregular whisper-like sounds, wind and sand motes grow stronger nearby. There is **no exact map marker**. The crater and buried chamber are actual mineable, collidable blocks.

Entering the hidden boundary begins a **60-second, 1,200-tick** trial. Distorted visibility, brief silhouettes, tremors, fleeing animals, exhaustion and occasional mild damage build tension. Mild Palm damage stops below four health; ordinary enemies, hunger, falls and other normal hazards can still kill you. Escape the region before completion to cancel the attempt without a fate roll or pity increase. A standalone pause freezes the simulation; opening an inventory or hosting co-op continues the world's normal ticks.

A completed trial rolls once:

| Outcome | Default chance | Result |
|---|---:|---|
| Stand Awakening | 35% | Permanently receive one of the five Stands. |
| Rejection | 50% | Normal Survival death, drops and respawn. Creative is protected by default. |
| Neutral survival | 15% | Survive without a Stand. |

Pity adds two percentage points per consecutive completed failure, capped at twenty bonus points; the remaining death/neutral weights retain their relative proportions. Turn pity off for the unmodified weights. All configured weights normalize to 100%, including the all-zero fallback. Luck is not an existing player attribute and has no modifier. An existing Stand prevents further trials unless the owner enables replacement. Replacement requires leaving and re-entering; simply remaining inside cannot reroll.

Awakening briefly locks movement and interactions, darkens the scene, adds a short optional flash, plays an original sound and materializes the Stand in a swirling aura. The new identity, fate ledger and rare reward are saved together. Ownership survives death, respawn, dimension changes, interrupted trials, saves and reloads. An interrupted singleplayer save resumes the same unfinished attempt; no completed result is rerolled.

## Controls and energy

| Default key | Action |
|---|---|
| **H** | Summon or dismiss your Stand. |
| **F** | Primary ability. |
| **G** | Secondary ability. |
| **V** | Stand details, statistics, energy and cooldowns. |

**R retains Air Trick / Devin’s Seeker.** WASD, Space, Shift, mouse mining/placement, E, Q, numbers, Escape, F3 and F5 retain their existing functions. Change the four Stand keys under **Options → Devil’s Palm & Stand Options**. Only unused supported letter keys are offered, and duplicate assignments are rejected. The pause menu also opens Stand details. Ability buttons return to play and execute the same authoritative action as their keys.

Energy starts at 100, regenerates at **2.4 points per simulation second**, and is spent only on a successful activation. Missed utility targets, full health, blocked travel, insufficient energy and cooldowns give HUD feedback without charging energy. Projectiles fired into empty space still spend their cost. Every twenty successful ability uses adds a level and five maximum energy, through level five. No further Acts or upgrade quests are implemented.

| Stand | Primary | Secondary |
|---|---|---|
| **Tusk** | Spin Nail: 6 damage, 24-block travel, 12 energy, 0.6s cooldown. | Golden Volley: three 4-damage nails, 32 energy, 5s cooldown. |
| **Oh! Lonesome Me** | Rope Hand: retrieve visible loose items or toggle a door within 12 blocks; 14 energy, 2s cooldown. | Lasso Traverse: pull toward a targeted solid surface within 12 blocks; 24 energy, 6s cooldown. |
| **Scary Monsters** | Saurian Form: 15 seconds, ×1.35 speed, ×1.5 melee with integer rounding; a 1.25-high, 0.9-wide collision body and custom dinosaur model; 35 energy, 20s cooldown. | Predator Roar: 5 damage/knockback to visible hostiles within 4 blocks; 24 energy, 7s cooldown. |
| **Cream Starter** | Repair Mist: heal yourself by four health points, up to 20; 30 energy, 9s cooldown. | Helping Hand: heal a visible teammate or passive creature within 4 blocks by four points; 35 energy, 10s cooldown. |
| **D4C** | Fold Step: blink up to 9 blocks through a clear path and leave a five-second return rift; 30 energy, 6s cooldown. | Return Fold: return through a still-clear path within 12 blocks; 18 energy, 4s cooldown. |

Nails use swept body/block collision, normal enemy damage/drops, spinning instanced models and impact effects. Rope effects include detached hand-like segments. Traversal and rifts sweep the entire collision body in small steps: they stop at walls, obey protected areas and are disabled in the existing sealed Titan arena. D4C does **not** pass through walls or move to another dimension. Transformation waits for headroom before returning to the taller body. Equipment remains in the inventory; the dinosaur uses its own body rather than rendering carried equipment on its paws.

## Relocation and relics

Default relocation is **every five in-game days**. The host searches seeded, valid distant regions in small batches; it never regenerates terrain every frame. It rejects edited chunks, villages, the Devin Temple, protected land and occupied areas. It waits while anyone is in a trial or near the formation. Configured counts of two or three active Palms are also supported.

Untouched formations return to the original seeded terrain. Edited formations, discovered chambers and formations occupied by saved offline players become harmless ruins. Player edits are always applied after procedural Palm blocks. Chamber contents persist and do not replenish on unload/reload. Previously visited ruins can remain in the world; only active sites run trials. Candidate searches may postpone a move until valid land is found.

Buried chambers contain a Weathered Palm Tablet and modest supplies. On a successful awakening, a default **2%** chance grants a **Saint’s Corpse Part** in the chamber. Carrying one adds **10 maximum Stand energy**; copies do not stack. The part has original icon/model art and a description. There is at most one corpse grant per player per Palm site. If the original chamber chest is gone/full, the reward falls back to inventory, then a normal collectible drop rather than being lost. Corpse upgrade quests are a future extension, not a working feature.

## Configuration and owner/development commands

Open **Options → Devil’s Palm & Stand Options** in your world. The owner can configure rarity, relocation days, trial seconds, all three fate weights, pity toggle/rate, active count, corpse chance, Stand replacement and optional fatal Creative rejection. A separate **Keep Inventory** rule applies to ordinary player deaths as well as rejection, preserving the inventory/equipment/XP by default only when enabled. Keep Inventory defaults OFF. Guests can change their personal keys but cannot change world rules.

`/palmprotect <4–128>` reserves a circle around the owner against Palm formation and Stand travel. Normal walking and building remain possible. Protected areas persist with the realm.

Development commands are available only under `npm run dev`, and only to the owner:

- `/palmdev spawn` — attempt a nearby Palm, refusing occupied/protected/uneven land.
- `/palmdev trial` — reset the local development trial after entering a Palm.
- `/palmdev outcome stand|death|neutral [tusk|lonesome|monsters|cream|d4c]` — force the next completed local trial for testing.
- `/palmdev relocate` — attempt relocation; active trials and nearby players still block it.

These commands are disabled in the production web build, standalone HTML and Windows payload. Their gate does not turn a browser game into an anti-tamper system; a world owner can inspect/edit their own local JavaScript and save data.

## Co-op

Use the **2.0.0 relay package and 2.0.0 clients**. The owner's browser is the authoritative simulation, using the existing relay for membership/routing; this is not a new dedicated simulation server. Each guest has a separate saved identity, Stand, energy, cooldowns and fate ledger. Guests send ability intents, never damage values or requested outcomes. Sequence checks discard duplicate commands. Summoned spirits, transformations, nails, rope effects and rifts are visible to other players. Healing can target teammates. Current co-op **PvP remains disabled**, including Stand damage.

The host processes simultaneous trials, relocation and saves. A guest disconnecting before completion cancels that unfinished trial without a roll; committed ownership remains saved and reconnects with the existing resume credential. Keep the same browser and a stable relay address for ongoing guest profiles. The existing temporary public-tunnel address/profile limitation is unchanged; see MULTIPLAYER.md. New relay addresses or browser origins can create a fresh guest profile. Native Windows and real cross-network Cloudflare operation are not verified by this Linux test host.

## Implementation map

- `src/palm-terrain.js`: voxel stamp, fingers/crater/chamber, spatial lookup, chunk invalidation and imported state.
- `src/devils-palm.js`: seeded candidate search, relocation, authoritative trials, fate ledger/pity, corpse rewards, owner configuration and development commands.
- `src/stands-data.js`: Stand definitions, configuration normalization, weight selection, artifacts and safe keybindings.
- `src/stand-abilities.js`: modular executable handler registry, energy, cooldowns, progression, swept nails, healing, transformation and protected traversal.
- `src/stand-models.js`, `src/stand-visuals.js`: original batched rigs/relic, bounded instanced nails/rifts/segments, particles, atmosphere and animation.
- `src/stand-ui.js`, `src/stand-ui.css`: management/options screens, bindings, HUD and effects.
- Existing world/worker/horizon modules add the optional stamp before player edits. Existing physics, collision, combat, death and respawn receive conditional Stand hooks. Storage/realm exports include the new optional state. Existing multiplayer/relay paths add validated intents and host state. Original weapon/pistol models, ability curves, recipes and base generation remain.

## Remaining limits

These are original gameplay adaptations, not complete JoJo powers or reference-exact Minecraft mechanics. Full Acts, corpse upgrade quests, a Luck attribute, Hardcore rules and PvP are absent. Palms do not physically migrate one block at a time; their active supernatural region relocates while visited ruins remain. Hallucinations are visual effects, and whispers are original non-verbal synthesis. No Stand-versus-Stand health/link-damage system is implemented. The baseline sandbox’s existing incomplete mechanics remain listed in FEATURES.md. Testing is targeted, not a guarantee of zero bugs.

## Creative access — 2.2.0

Open E → Stands in Creative and choose Equip Stand. The five choices bypass the trial only in Creative, including host-validated Creative guests. Selection persists; energy/cooldowns still apply. Survival trial/fate/ownership behavior is unchanged.
