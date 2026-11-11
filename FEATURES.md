# DCSMCRAFT feature and parity ledger

Current **2.8.6** encounter update: [TITAN-CYLOOP.md](TITAN-CYLOOP.md) supersedes earlier Cyloop, swat and boost-audio descriptions. Other 2.8.5 combat tuning is retained.

Current **2.8.5** boss-only combat/cinematic update: see [TITAN-COMBAT.md](TITAN-COMBAT.md) for the stronger per-move damage, timed body/limb contacts, free movement, cyan HUD, shadows, controls and remaining limits. Historical 2.8.4 details below are superseded where they differ.

Current content reference: **Minecraft Java Edition 26.3**, world height **−64 through 319**, 20 ticks per second. Release **2.8.4** remains a playable foundation with custom/simplified mechanics. [CONTENT.md](CONTENT.md) is the current completed/partial/deferred/excluded checklist and per-entry audit. Older numbered sections below record historical releases and are superseded by that current checklist.

**Implemented** means functional in this game's available content. **Partial** means significant reference behavior or content is absent. **Missing** means there is no implementation; UI descriptions are not substitutes.

## Titan arena overhaul — 2.8.4

The supplied **Titan: GIGANTO** prelude now accompanies ring gathering/ascent; Undefeatable follows combat. Thirty-six persistent golden trails, real ring carryover, **12,000 Normal HP** and **45% player damage** create a substantially longer encounter. Revised skinned animations, arm targeting, complete special poses, cinematic camera/effects, original layered Foley, a detailed PBR highland basin and the supplied-reference corner HUD replace the older presentation. The camera icon is omitted; the normal sandbox UI/player state return afterward.

[TITAN-OVERHAUL.md](TITAN-OVERHAUL.md) documents controls, difficulty stats, ring/retry/save behavior, graphics quality, source credits and remaining approximations. The arena remains original procedural/stylized scenery with analytic combat contacts and a platform ascent; exact commercial UI, photorealistic assets, finger/facial animation and full production choreography remain incomplete. Ordinary world mechanics/art/audio and multiplayer are preserved; old saves migrate without regeneration. Earlier encounter descriptions below are historical and superseded where stated.

## Giganto battle music — 2.8.3

The supplied **Undefeatable.mp3** now plays during aerial combat, with phase-aware pickups, chorus loops and a finishing riff. A natural half-health cinematic reaches the second chorus continuously; skipped movies and retries choose their own phase cue. Pause, settings and long checkpoint reloads preserve the transport. Source MP3 bytes are unchanged; effects, models, stats and normal-world music remain. This is a custom adaptive edit, **not exact Sonic Frontiers music-script/choreography parity**. [GIGANTO-MUSIC.md](GIGANTO-MUSIC.md) lists cue seconds, controls, memory/platform details and limits.

## Imported Titan rigs — 2.8.2

The supplied Sketchfab Sonic and Giganto meshes now replace the earlier procedural character models in the playable encounter. Sonic retains 10,414 triangles, the original walk/run cycles, a 2K atlas and a working skin, with six added quill joints and a golden variant. Giganto retains its 42,081-triangle body, 152-joint rig, 1K maps, jaw and claws; ten original animated dorsal emitters are added. The reusable embedded-texture GLBs are in `public/models/titan/`.

Sonic has **22 named clips** and Giganto **24**. Only Sonic's walk/run came with the upload; all other clips are locally authored approximations. AnimationMixer blending, synchronized attack sampling, jaw/emitter effect sockets, cached loading and independent encounter skeletons are integrated. Loading pauses arena combat/resources. Existing boss simulation, stats, controls, rewards, sandbox mechanics, artwork and save format remain; no world regeneration or paid generation service is needed.

Read [TITAN-ASSETS.md](TITAN-ASSETS.md) for Sketchfab creator/license credits, the clip list, rebuild instructions and exact limitations. Finger/facial performance, official choreography, direct mesh climbing and exact animated hand-hitbox contacts remain incomplete. [GIGANTO.md](GIGANTO.md) documents the playable controls and encounter differences; [VALIDATION.md](VALIDATION.md) records actual tests. Historical 2.8.0/2.8.1 procedural-character descriptions below are superseded by this release.

## Torch & Titan presentation — 2.8.1

Placed torches return to a narrow shaft with corrected texture mapping. World-space block illumination now persists across loaded terrain independently of camera direction and the old four nearby lights, with wall occlusion, water attenuation, chunk-seam updates and luminous dropped items. **Carried Item Light** controls the optional moving highlight; placed lamps stay lit with Fancy Graphics off. See [LIGHTING.md](LIGHTING.md) for supported emitters, persistence, verification and rendering limits.

Giganto is rebuilt from original geometry toward the supplied references: dark layered armor, a broad shoulder mantle, recessed red eyes and pale jaw, narrow waist, long tapered forearms/claws, etched details and ten dorsal emitters. A batched thirty-ray fan, refined raised Super quills/shoe soles, thin golden corona, a green forest/cliff basin, graded sky, close aerial camera and centered boss bar replace the previous presentation. Climbing pads disappear during the fight. Wider camera clearance protects the new shoulder silhouette. Existing fight timings, damage, controls, phases, checkpoints and rewards remain. **Low-poly rigs, platform climbing, analytic damage volumes and shortened cinematics remain approximations**; see [GIGANTO.md](GIGANTO.md).

## Titan Signals: Giganto — 2.8.0

Playable original singleplayer Sonic/Giganto interpretation: seeded safe portals, arena, real traversal and final Emerald, Super transformation, two combat stages and recognizable attack catalog, parry/counter/dodge/specials, configurable rings/checkpoints, saved retries, victory/defeat/exit, and atomic once-only rewards. **Partial reference fidelity**, not commercial-game parity: see [GIGANTO.md](GIGANTO.md) for the implemented/approximate/missing matrix, original-asset substitutions, controls and reference source. Ordinary worlds, stats/art and multiplayer remain; no terrain regeneration is required.

## Remaining Native Pixel Art — 2.7.19

651 existing block/state surface entries and 18 older utility/aquatic sprites now have original discrete-palette 16px art. The atlas/icon pass preserves finished art, supplied images, Classic, models, UI and all mechanics. [ART-COMPLETION.md](ART-COMPLETION.md) records the per-entry audit, preserved art and limits. No content IDs or gameplay features are added.

## Item Art & Recoverable Arrows — 2.7.18

**Implemented:** 51 original food/resource sprites, 24 corrected palettes and native-sprite priority over old placeholders; forward-facing rigid nocked bow arrows in first/F5; shared stepped flying/lodged arrow models; block-surface embedding, one-item pickup with full-inventory safety, support release, per-dimension persistence and host-authoritative shared visuals; silent air swings; one working inventory X while the book remains toggleable. **Retained:** stats, nutrition, recipes, bow charge/ammo/damage/gravity, armor/skins, generation 16 and protocol 4. **Limits:** 256 lodged arrows/dimension; active lifetime 1,200 ticks; mob/Creative shots are not recoverable, entity-hit arrows keep prior despawn behavior and airborne shots remain transient on saves. Native supplied pack images stay native; earlier unrelated content gaps remain. See ITEMS-ARROWS.md.

## Fitted Armor & Consistent Skins — 2.7.17

**Implemented:** shared original equipped/icon palettes for 38 armor pieces; face/collar cutouts; joint-attached sleeve/bracer, leg/boot layers; underlayer masking and costume-overlay suppression; real chainmail holes; consistent turtle aliases; continuous colored arm texels and mirrored hairlines for all eleven skins; texture-based gloves and matching pixel portraits. Inventory, wardrobe, F5 and empty first-person arms share these surfaces. **Retained:** exact base proportions and identities, all weapon visuals/poses, animation curves, stats/durability/protection, saves and networking. **Limits:** fixed bundled skins and original armor designs, not an imported-skin editor or reference-perfect armor layers; arbitrary dye/trim rendering is unchanged/incomplete. Extreme original rig poses are not guaranteed universally intersection-free. See APPEARANCE.md/VALIDATION.md.

## Pixel Weapon Arsenal — 2.7.16

**Implemented:** all 61 existing combat-tool/weapon models and icons share original low-resolution art; real stepped cutouts; nearest textures/no mipmaps; voxel pistols with independent recoil; discrete bow/crossbow draw and loaded frames; Java 26.3 numeric display profiles; actual first-person/F5 weapon use state and attached palms; NPC equipment reuse. **Approximate:** original geometry/origin conversions, shield/trident/spear placement, third-person mount translations and custom abilities. **Retained differences:** hidden first-person arm while holding; custom spear combat; one-way new-item equip; incomplete remote charge/block/ability replication; no offhand combat. Gameplay code and existing world saves remain. See WEAPONS.md. This supersedes older weapon geometry and pose descriptions below.

## Doors, Chests, Position & Audio — 2.7.15

**Implemented:** restored discrete door meshes; corrected natural village chest facing and body/lid texture bands across packs; reference-style resting hand placement; world-source distance/pan and bounded ranges with moving-listener updates; nearby-column tornado falloff/shelter. Existing holding animation curves, hidden-arm behavior, chest loot/cells, terrain, inventory UI and music remain. **Partial:** lightweight initial obstruction filtering, not acoustic/reverb simulation. Native Windows launch is unverified; see README.md/VALIDATION.md. The earlier animated-door descriptions are historical and superseded.

## Player Inventory & Recipe Book — 2.7.14

**Implemented:** compact classic-style personal/table layouts; a clickable recipe book with search, pagination and craftable filtering; immediate ingredient filling with atomic failure and reuse of current grid ingredients; a mouse-following 3D skin/armor/held-item preview with bounded look, context reuse and disposal. Twenty recipe icons per page; 2×2/3×3 fit checks; cursor capacity feedback. **Offhand is partial:** the new pocket stores, splits/transfers, saves and obeys death/Keep Inventory and matching-host authority; offhand combat/use and F-key swapping are missing. Old saves get an empty pocket. No recipes/items/world/audio or first-person animation changes. The Java-style first-person motion from 2.7.13 supersedes the historical always-pinned animation descriptions below; see README.md for its exact reference differences.

## Held Items & Building Performance — 2.7.11

**Implemented:** visible-silhouette anchoring closes held-item gaps, including transparent flat-icon padding, while retaining a smooth equip and constrained first-person swings. Loaded-data worker snapshots handle ordinary edit meshing; exact interior/edge/corner invalidation, edit priority, pending coalescing and stale-revision rejection reduce stalls without changing authoritative world cells. **Limits:** mesh appearance follows asynchronous completion; bootstrap and unsupported-worker fallback remain synchronous. No universal FPS guarantee. Saves, F5/wardrobe bodies and existing content remain compatible.

## Item Mount & Clearance — 2.7.10

**Implemented:** held objects fill the former forearm area at a lower, closer mount; the left pistol mirrors this position. Item-only clearance derives from real item geometry and ignores hidden hands, gloves, sleeves and armor. **Retained:** smooth use/attack/recoil curves, visible empty-hand pose, F5/wardrobe bodies, gameplay, saves, generation 16 and protocol 4. Native Windows execution remains untested here.

## Item-Only First Person — 2.7.9

**Implemented:** all held content displays without the first-person arm/sleeve/gloves/shoulder armor. Both pistol arms are hidden; swimming does not reveal an empty side arm while an item is held. Empty slots restore the selected skin arm and empty-handed swimming. **Retained:** item transforms/animations, F5/wardrobe models, gameplay, saves, generation 16 and protocol 4. Native Windows execution remains untested here.

## Blocky Skins & 3D Outfit Chest — 2.7.8

**Implemented:** all eleven selectable costumes have shared classic block proportions, original pixel faces and outfit details, fitted armor and attached palms; first-person colors/texels match. The Outfit Chest has a live shared-rig 3D preview, wrapping previous/next cycling, direct selection, arrow-key navigation, drag/turn controls, saved selection and responsive layouts. A single capped preview renderer is disposed on exit; Reduced Motion is respected. **Retained:** existing weapon geometry, animation curves, music, world/save behavior and co-op identity/protocol. **Limits:** eleven bundled skins, not a custom PNG skin importer; native Windows launch remains unverified. Other features/backlog below are unaffected.

## Performance & Console Menu Audio — 2.7.1

**Implemented:** eleven graphics controls, three presets, independent menu volume/mute and the four user-labeled supplied sounds. Settled terrain invalidation, loaded-index local lights, reused creature vectors, cached resolution/cloud updates and distance-limited prop animation reduce repeated work. **Retained:** existing content, saves, terrain generation and protocol 4. **Limits:** no guaranteed FPS or complete parity; native Windows launch remains unverified. See PERFORMANCE.md for options, cue mapping and benchmark scope.

## Overworld Foundations I — 2.7.0

**Implemented:** corrected Creative block projection and original item/egg silhouettes; five existing farm species gain feeding, following, safe breeding, saved babies/cooldowns and growth; chickens lay eggs, sheep eat grass to regrow fleece, and cow milk buckets clear status effects. Eleven more enchantments now affect actual harvesting, loot, combat, matching damage, air and underwater mining. Shared protocol 4 fixes the obsolete relay probe and rejects older clients.

**Partial:** local farm steering/loaded-region timers, simplified growth/proportions, finite pasture, instant milk use and custom deterministic enchanting/loot/timings. No egg throwing or general grass spread. **Still missing:** the rest of the requested Overworld systems. **Excluded from new additions:** all Nether/End-related content; existing content remains. [OVERWORLD.md](OVERWORLD.md) and [reference/overworld-backlog.json](reference/overworld-backlog.json) supersede historical missing-feature statements below.

## Tornado performance & weather fixes — 2.5.1

Fixed storm-driven loading of distant terrain: weather now rejects far/unloaded bodies before roof or collision queries. Ordinary simulation also suspends unloaded item physics and remote persistent-NPC contact checks; items in loaded areas near Survival guests remain active. Unloaded drops keep their despawn timer until their area becomes active again. Existing worlds work without regeneration; generator 15, Aquatic content, inventories and terrain edits are retained.

Tornado particles now animate on the GPU with distance/quality budgets (512 All, 256 Decreased, 96 Minimal near the storm) and a capped screen size. The funnel uses a single transparent shell pass, bounded debris updates, frustum/distance culling and static particle buffers. Rain/snow particle roof queries are cached by terrain revision and limited to 32 per frame. Snow heat checks no longer load neighboring chunks. Lightning respects Weather Effects/Lightning Flashes toggles, reuses its buffer and refreshes correctly on realm or same-tick strike changes; low swimming poses receive proper shelter checks.

This fixes reproduced stalls, not every possible game issue or a universal FPS target. PERFORMANCE.json and VALIDATION.md record the controlled benchmarks and playtests. Launch instructions and all Aquatic simplifications below still apply.


## Aquatic Voyages — 2.5.0 checklist

- **Implemented:** append-only ocean content/recipes/Creative eggs; nine climate/depth variants; reefs, kelp, ice, wrecks/ruins and persistent map treasure.
- **Implemented with documented simplifications:** fish/squid/dolphin/turtle/Drowned ecology, fishing/buckets, scutes/helmets, Turtle Master brewing, conduits/columns, trident throws/returns/Riptide, Mending, undead conversion, skeleton-horse riding and sprint swimming.
- **Retained:** boats, basic oxygen, Unbreaking, old generators 2–14 and previous custom progression.
- **Partial/missing:** local AI/timings/loot, general waterlogging/coral orientation, complete maps/potions/monuments and platform-specific Realms/Education services. Exact per-feature status: [AQUATIC.md](AQUATIC.md). The historical checklists below describe their releases; this section supersedes earlier statements that fishing/brewing/sea life are entirely missing.

## Matthew's Pistols claim cue — 2.4.1

**Implemented:** supplied MP3 plays once on a successful first altar claim per world; embedded offline, Master-volume controlled, silent preloading, finite non-looping playback and cleanup. Existing claim gates/save flags and the separate Devin Sword cue remain. No cue on failed/full-bag/guest claims, ordinary pickup/Creative grants or reload. Muted claims do not queue playback. Existing saves work without regeneration; other partial mechanics below remain.

## Living Worlds — 2.4.0 checklist

- **Implemented:** smooth chest lids/latches with real hollow interiors and viewer counting; hinged oak doors; furnace fire/sparks tied to burning; nearby opening/turning enchanting book; inserted jukebox disc display and playback rotation.
- **Implemented:** worker/main-thread prop metadata, detailed-chunk animation budget/static fallback, rigid batching, texture/mipmap replacement and unload cleanup. Optional idle motion/particles obey graphics controls.
- **Implemented:** solid-roof chest gate, stale/replaced/out-of-reach container/crafting-menu guards before slot transfers, inset chest targeting/collision/grounding and workstation priority over held utility items.
- **Implemented:** more Overworld wildlife (up to 16 initial animals, up to four per six seconds, 48 nearby cap), dry full-body/occupancy checks across every habitable land biome; existing Cinderworld rules retained.
- **Implemented:** original neutral Snow Leopard/Polar Bear models, voices, walking/tail animation, cold habitats, finite provocation, Creative-only eggs and persisted entity state.
- **Partial:** local mob steering; no cold-species breeding/cubs/prey or aquatic ecology. Single chests with fixed facing; no double-chest/reference animation parity. Doors collide at their authoritative end state during the visual tween. Dense/distant props may use static fallback. Multiplayer/other baseline partial mechanics below remain.
- **Compatibility:** no regeneration required; generators 2–14, old item/recipe indices, supplied textures/claim recording and prior progress remain.

## Devin Sword claim audio — 2.3.2

**Implemented:** supplied MP3 embedded unchanged for offline, one-time successful Devin Sword extraction; Master-volume control including mid-clip mute; silent preloading, no loop/overlap and cleanup. Existing Guardian/Sigil/time/reach/inventory gates and saves remain. No new world required. Other mechanics/limitations below are unchanged. The recording is supplied third-party audio, separately attributed from the original synthesized effects.

## Connected Worlds — 2.3.1 checklist

- **Implemented:** generator 14 continuous connected land/climate fields, shorter ocean/lava channels, all 13 Overworld and six Cinderworld biomes; previous sparse village/structure spacing and seeded structure variants retained.
- **Implemented:** irregular compound caves, winding variable-width branches/dead ends, varying chamber aspect/height/orientation, sparse pillars, cross-level routes and warped Cinderworld cave voids. Existing ores, cave regions, mineshafts and Watcher retained.
- **Implemented:** increased bounded Cinderworld natural hostile waves and flyer density; difficulty caps, Peaceful, lighting and collision rules retained; guarded loot and reflected fireballs remain functional.
- **Implemented:** shallower block grip/closer flat sprites; solved arm/skin/glove/shoulder camera clearance; no finger models added.
- **Partial:** custom procedural caves and terrain, local creature navigation, shared biome-influenced weather clock, one-seat approximate boats and existing co-op dimension travel restrictions. Oceans can still be wide in some locations; no hard maximum crossing width.
- **Compatibility:** new terrain/caves require a new world. Saved generators 2–13 stay intact; old blocks/items/recipes/mob stats are unchanged. Other missing reference mechanics below remain missing.

## Milestones, in requested order

| Milestone                                                 | Status                                           | Delivered / next work                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Terrain, rendering, movement, collisions, interaction  | Implemented foundation; partial reference parity | Working first-person chunk world, mining and building. Next: exact movement/collision shapes, full fluid parity and voxel lighting.                                                                                                                                      |
| 2. Inventory, crafting, tools, saving                     | Implemented foundation; partial reference parity | Working personal/table crafting, mining tiers, furnaces, chests, durability and recoverable browser persistence. Next: offhand, all item interactions and full recipe corpus.                                                                                        |
| 3. Survival, combat, creatures, farming                   | Partial                                          | Playable health/hunger, basic melee and AI, wheat, sleep, death/respawn. Armor and spear/relic weapons now work. Next: player bows/effects, exact food rules, reference-exact light/spawn propagation, full navigation and breeding.                                                 |
| 4. Structures, villages, advanced progression, dimensions | Partial structures and custom dimension          | Seeded stone waystations, eight-home villages with persistent residents and limited trades, and a persistent Cinderwild with obsidian portals. Next: full village AI, raids, full workstation progression, reference enchanting/brewing, full Nether/End progression. |
| 5. Automation, mechanical parity, optimization, polish    | Partial rendering/UI polish; automation missing  | Chunk meshes, face removal, frustum culling, unloads, settings, original asset atlas and synthesized effects. Next: scalable tick scheduler, signal graph and each automation component with interaction tests.                                                      |

## World

| Requirement                   | Status      | Shipped behavior / difference                                                                                                                                                                                                                                         |
| ----------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed-based procedural terrain | Implemented | Deterministic string/numeric seed; original value-noise generator, not reference terrain.                                                                                                                                                                             |
| Chunk load/unload             | Implemented | 16 × 16 columns, configurable 2–24 chunk radius, sparse persistent edits across unloads.                                                                                                                                                                              |
| World height                  | Implemented | −64…319; unbreakable floor at −64 in Survival. No reference world border.                                                                                                                                                                                             |
| Biomes                        | Partial     | Thirteen original biome types including generator-7 jungle; the original version-4 types: oak/birch woodland, meadow, desert, alpine, pine forest, savanna, badlands, marsh, snowy taiga, stony peaks and ocean. Versions 2/3 retain the four original climates. No reference-exact distribution or full biome list.     |
| Caves, ravines                | Partial     | Generator 12 adds four original underground regions: hollow halls, dripstone vaults, moss grottos and rift caverns, linked by bent tunnels, vertical connections and occasional sloping land entrances. Older generators keep their original caves. No reference carvers, aquifers or full underground biome parity. Dripstone is cubic decoration without falling-spike damage.                                                                                                                                                          |
| Ores | Partial | Generator 12 places coal, iron, diamond, lapis, copper, gold and emerald in spaced seeded veins with height limits; diamonds are uncommon small clusters at Y −56…8. Older generators retain their distributions. Real drops, smelting and mining tiers. Cinderworld Hellfire/Brimstone veins remain exclusive. Original distributions; no redstone, reference deepslate variants or exact veins. |
| Vegetation | Partial | Oak/birch/pine/savanna trees, foliage, moss, ferns, cactus, flowers, cane and bamboo. Cactus has inset geometry, accurate contact damage and ordinary dropped-item destruction. No cactus/tree growth, saplings or leaf decay. |
| Rivers, oceans, lakes | Partial | Generator 13 adds separated irregular continents and broad deep ocean corridors; older generators keep their seeded depressions. Water/lava flow, drain, renew supported water sources and cool on contact. No exact aquifers, reference hydrology or shortest-drop routing. |
| Structures                    | Partial     | Stone waystations and seeded eight-home villages, biome-specific roofs/walls, paths, wells, lamps, crops, beds, workstations and loot chests. Generator 7 also adds the guarded relic temple and three Cinderworld structures. Generator 12 adds rare abandoned mineshafts with supported corridors, slowing webs, decorative rails and persistent loot chests. No minecarts, cave-spider spawners, dungeons, strongholds or reference structure algorithm.                                                      |
| Persistence                   | Implemented | Seed, sparse edits, containers/furnaces, entity/drop records, crops, player, inventory, world tick/time and spawn.                                                                                                                                                    |

## Movement and controls

| Requirement                                        | Status                 | Shipped behavior / difference                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-person mouse look, pointer lock              | Implemented            | Sensitivity setting; vertical look clamped; Escape releases pointer.                                                                                                                                                                                                                                                                          |
| Walk / sprint / crouch                             | Partial                | Target speeds 4.317 / 5.612 / 1.295 blocks/s; acceleration differs. Double-tap W within seven ticks to latch sprint until movement stops; Ctrl + W also works. Either Shift crouches and cancels sprint; crouch height 1.5 and ledge protection. Keeping sprint while strafing/backing up is custom behavior.                                 |
| Jump, gravity, collisions                          | Partial                | Swept-axis AABB resolution, head/ground checks, approximately 1.2 block jump; not exact reference drag/acceleration. No auto-jump.                                                                                                                                                                                                            |
| Swimming / oxygen | Partial | Flowing/still water, fluid-height submersion, oxygen/drowning, buoyancy and basic currents. No exact reference drag, sprint swimming or fluid collision parity. |
| Fall / suffocation damage                          | Implemented foundation | Approximate fall distance beyond three blocks; head-block suffocation. Damage invulnerability window is simplified.                                                                                                                                                                                                                           |
| Creative flight                                    | Implemented            | Double-tap Space; Space/Shift ascend/descend; flight retains block collisions. Horizontal 10.89 blocks/s, sprint 21.78.                                                                                                                                                                                                                       |
| Reach and camera                                   | Partial                | Survival block reach 4.5; Creative 5; normal melee 3, spears 4.25 and Devin Sword 3.5 (custom additions). Reference-style eye heights and sprint FOV change; hand/bobbing are original approximations.                                                                                                                                        |
| Required key bindings / hotbar                     | Implemented            | WASD, Space, Shift, left/right mouse, 1–9, scroll, E, Q, Escape.                                                                                                                                                                                                                                                                              |
| Sensitivity, FOV, audio, graphics, render distance | Implemented            | Browser-local settings: 2–24 chunk distance, resolution, mipmaps, brightness, FPS cap, particles, entity display distance, view bobbing, biome colors/blend, Classic/Soft/Renewed/Supplied Assets packs, independent Fancy Graphics/AO/sun shadows, sound categories and volume, fog, clouds, extended terrain, FPS and fullscreen. AO remeshes in the background. |

## Blocks and simulation

| Requirement                               | Status                                  | Shipped behavior / difference                                                                                                                                                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targeting and outlines | Implemented subset | Voxel DDA, face normals, nearest block hit, shape-aware doors/relic/cactus and mining outline. Normal mining ignores fluids; empty buckets target source fluids. |
| Progressive mining                        | Partial                                 | Hardness/tier/speed-based timing, crack overlay, particles and rhythmic mining strokes. Efficiency and Unbreaking work; no full effect modifiers.                                                                                                                                                                |
| Tool requirements and drops               | Implemented subset                      | Wood → stone → iron → diamond tools; iron requires stone, diamond requires iron. Leaves/random seeds and ore XP simplified.                                                                                                                                                                                      |
| Placement / interaction priority          | Partial                                 | Containers/workstations before placement, crouch bypass, adjacent-face placement, no solid placement intersecting player. Four door orientations; other blocks retain default orientation. No replaceable-plant parity.                                                                                          |
| Collision shapes | Partial | Full cubes except thin two-block oak doors, inset cactus and the relic base; matching world targeting/outlines. Torch/crops/fire/fluids are nonsolid. Camp bed is a full cube. No slabs/stairs/trapdoors/fences/ladders. |
| Transparency                              | Implemented subset                      | Transparent water/glass and cutout leaves/plants. Door windows are decorative pixels on a solid thin panel.                                                                                                                                                                                                      |
| Gravity blocks                            | Partial                                 | Block updates move placed/edited sand/gravel downward, no falling-block entities/damage.                                                                                                                                                                                                                         |
| Block updates | Partial | Neighbor mesh invalidation, gravity/crops/cane, bounded tick-driven fluids, local fire and TNT timers. No exact reference scheduled-update ordering. |
| Oak doors                                 | Partial                                 | Four orientations, open/closed linked halves, thin collision, either-half interaction, crafting, support checks, single-item drops, persistence and villager opening. Doors never automatically close; player interaction closes them. Fixed hinge; panel changes instantly. No paired double-door logic, redstone, iron doors, door-breaking AI, or other wood variants. |
| Slabs, stairs, trapdoors, fences, ladders | Missing                                 | No models, states, collision shapes or recipes.                                                                                                                                                                                                                                                                  |
| Fluids and waterlogging | Partial; waterlogging missing | Persistent water/lava levels, downward flow, bounded lateral spread, source removal, water renewal, cooling, buckets, lava fuel, Cinderworld evaporation, swimming/currents, floating item transport and crop hydration. 5-tick water updates; lava normally 30 ticks Overworld/10 Cinderworld. Bounded 400-update budget; unloaded/out-of-range simulation pauses. Stepped surfaces and local relaxation differ from Java. No waterlogging, fluid slope routing, lava-generated fire or reference fluid/block reactions beyond the documented cooling. |
| Fire and explosions | Partial | General flint-and-steel ignition with durability/portal priority, extinguishable burning/spreading fire, contact burns and saved player burning state. Saved four-second TNT fuses, flashing blocks, short-fuse chain reactions, terrain/creature damage. TNT stays at the primed block position. Simplified bounded blast/drop rules protect containers, relics and hard blocks; no reference blast-resistance propagation, signal ignition, ghast/fireball ignition or exact fire rules. |

## Inventory and progression

| Requirement                                             | Status             | Shipped behavior / difference                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hotbar / main inventory                                 | Implemented        | Nine hotbar plus 27 main slots.                                                                                                                                                                                                                                                                                    |
| Armor / offhand / equipment | Partial | Four armor slots: dirt, leather, gold, iron, diamond and Hellfire; toughness, reduction, wear, swapping and persistent death drops. Offhand and remaining armor materials are missing. |
| Cursor, stack limits, split, drag, swap, shift transfer | Implemented subset | Left exchange/merge; right split/place-one; drag places one per new visited slot; Shift-click transfers. No double-click gather or number-key swaps inside inventory.                                                                                                                                              |
| Drop / pickup / despawn                                 | Implemented        | Q / Ctrl+Q; pickup radius; gravity for drops; five active minutes to despawn. No entity stack merging or inventory hover-Q action.                                                                                                                                                                                 |
| Durability | Implemented subset | Material-specific tool/armor/flint durability, bars and per-use wear, including functional Unbreaking. No repairs, Mending or anvils. |
| Personal / table crafting                               | Implemented        | 2 × 2 and 3 × 3, translated/mirrored shaped and shapeless matching, exact ingredient consumption, cursor-capacity check.                                                                                                                                                                                           |
| Data-driven recipes | Implemented subset | 122 shaped/shapeless recipes, including 43 new in 1.2, cover progression, buckets/TNT, mineral storage, new masonry, armor and tools. Translated/mirrored grids and ingredient counts work; the complete Java catalog is missing. |
| Containers                                              | Implemented subset | 27-slot chest and three-slot furnace; no double chest, lock, hopper/container sided access.                                                                                                                                                                                                                        |
| Furnace / fuel / smelting / cooking | Implemented subset | 200-tick recipes; charcoal, glass, stone, iron, copper, gold, clay/bricks/terracotta, smooth/cracked stone, Hellfire and meat. Coal blocks burn 16,000 ticks; lava buckets burn 20,000 and leave a bucket. No wet sponge, smokers or blast furnaces. |
| Wood-to-advanced equipment | Partial | Dirt/wood/stone/iron/gold/diamond/Hellfire gear, melee spears, six enchantments and the unbreakable Devin Sword with charged-hit healing, Pulse and Seeker. No Netherite, player bows/shields or reference full weapon set. |
| XP                                                      | Partial            | Direct XP accumulation from ores, kills and furnace output; simple level visualization. No XP orb entities or reference level curve.                                                                                                                                                                               |
| Enchanting / anvil / brewing / other workstations       | Partial            | Functional table, lapis, paper/books and six deterministic upgrades: Sharpness V, Efficiency V, Unbreaking III, Protection IV, Feather Falling IV and Knockback II. Costs raw XP points and lapis. No random offers, bookshelf power, enchanted books, anvils or brewing.                                          |
| Farming / renewable resources                           | Partial            | Hoe farmland, plant seeds, water within four blocks, growth every 100 ticks to age 7, mature wheat and bread. No reference random-tick/light/soil rules or growth-stage artwork; seeds/food renewable. Shoreline cane grows to height three beside water every 400 ticks; paper/book recipes. Trees do not regrow. |

## Survival, combat and creatures

| Requirement                                    | Status  | Shipped behavior / difference                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health, hunger, saturation, exhaustion         | Partial | Basic pools and spending for sprint/jump/mining/attacks. Instant eating, approximate food values and exhaustion/regen. Visual eating animation; consumption remains instant.                                                                                                                                               |
| Regeneration / starvation                      | Partial | Food threshold regen every 80 ticks; difficulty-dependent starvation floor. No exact saturation regeneration algorithm.                                                                                                                                                                                                    |
| Armor / shields / bows / projectiles / effects | Partial | Dirt, leather, gold, iron, diamond and Hellfire armor, Protection and Feather Falling reduce damage; armor wears/breaks and drops on death. Spears and The Devin Sword are melee additions. No player shields, bows or potion system. Skeleton arrows and the custom Devin homing attack work.                                                                                                        |
| Melee cooldown / criticals / knockback         | Partial | Damage strength based on elapsed cooldown, downward-airborne crit multiplier, small direct knockback. Sharpness and Knockback work; victims resolve against walls. No sweeping or exact knockback resistance.                                                                                                              |
| Difficulty                                     | Partial | Peaceful/easy/normal/hard affect spawning, attack damage, hunger/starvation; no complete reference scaling.                                                                                                                                                                                                                |
| Bed / spawn / death / respawn                  | Partial | Original single-cube bed; sleep at night if no nearby hostile; spawn uses player's safe position. Death drops inventory/cursor/crafting/equipped armor once, resets XP; respawn restores health/hunger. No sleeping animation, bed halves or dimension explosion.                                                          |
| Passive animals                                | Partial | Original pig, sheep, cow, chicken and rabbit models, wandering/fleeing, vocalizations, rabbit hops, chicken slow falls and simple meat/wool/leather/feather drops. No breeding, taming, shearing, milk, chicken-laid eggs or reference-complete loot.                                                                                   |
| Hostiles                                       | Partial | Zombies, Creepers, eight-legged Spiders and bow-carrying Skeletons replace old Overworld night spawns; old saves migrate shade/stalker identities. Melee, cancellable 30-tick fuses, terrain blasts, simple wall climbing/daylight neutrality, ranged arrows with swept wall/body collision, daylight burning and despawn. Cinderworld roster retained. Spawns/steering/damage/loot remain simplified; arrows cannot be collected. Rotten flesh has no Hunger penalty; gunpowder crafts TNT; fireworks remain missing.                                                                                                                         |
| Pathfinding                                    | Partial | Local steering, obstacle jump and collisions; villagers follow simple entrance/home waypoints. No global navigation graph; mobs can get stuck.                                                                                                                                                                             |
| Villagers / trading / village behavior         | Partial | Eight persistent residents per new village (four on older generators), farmer/mason/shepherd roles, daytime wandering, nighttime homes, basic fleeing, limited two-offer trading, 12-use stocks and sunrise restock. Payments/output commit atomically. No full navigation, reputation, profession levels, POI job acquisition, breeding or raids; golems use a simplified defender system. |
| Spawn/despawn rules                            | Partial | Distance, simplified terrain/day/night and nearby placed-torch checks; no voxel-light propagation, reference mob caps, full biome filters or complete space validation.                                                                                                                                                    |

## Environment and automation

| Requirement                                            | Status                 | Shipped behavior / difference                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Day/night                                              | Implemented foundation | 24,000 tick days, moving original sun/moon, ambient and sunlight intensity changes; four editable cycle announcements.                                                                                                                                                                                                                                       |
| Sunlight and block lighting                            | Partial                | Directional/hemisphere lighting and fog, face shading, independent per-vertex ambient occlusion, optional local 1024-pixel sun shadow maps, and up to four nearby torch point lights. Shadows cover a 64-block-wide area, default off, cost GPU time and can flicker at low sun angles. No skylight/block-light flood fill or light occlusion through walls. |
| Weather                                                | Partial                | Saved seeded clear/rain/thunder/hail/tornado cycles, biome/altitude snow, roof exposure, smooth sky transitions, lightning and delayed thunder, rain crop hydration, storm shelter/night behavior, bed clearing and Creative overrides. Independent visual toggles, hail damage and local moving/pulling/lifting funnels with roof shelter. Persistent eighth-block snow accumulates on exposed cold surfaces, melts in warmth/near heat and supports accurate targeting/collision. Bounded local simulation; no realistic snow drifting, lightning damage/fire or exact reference timing.                                                                                                                                                                                                                                                                                      |
| Fishing                                                | Missing                | No rod, bobber, loot tables or fish AI.                                                                                                                                                                                                                                                                                                                      |
| Nether-like and End-like dimensions / portals / bosses | Partial custom realm   | Original persistent Cinderwild, linked 4×5 obsidian portals, flint and steel, lava, resources and emberlings. Optional corners, 80-tick Survival charge and 8:1 initial coordinates. Fixed frame size; no full Nether/End parity, fortress, bosses or dimension progression.                                                                                 |
| Tick-based simulation independent of rendering         | Implemented foundation | 60 Hz physics and 20 Hz world ticks via accumulated frame time; capped catch-up avoids a spiral on slow hardware. Severe frame stalls slow game time rather than skipping unchecked simulation.                                                                                                                                                              |
| Wiring / signal strength / switches                    | Missing                | No signal network or block states.                                                                                                                                                                                                                                                                                                                           |
| Repeaters / comparators / pistons / observers          | Missing                | No components, timing or interactions.                                                                                                                                                                                                                                                                                                                       |
| Hoppers / dispensers / droppers                        | Missing                | No automated transfers, inventories or pulses.                                                                                                                                                                                                                                                                                                               |

## UI, assets and delivery

| Requirement                                  | Status                 | Shipped behavior / difference                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title, create/select, seed, modes            | Implemented            | Live terrain title, local-world selection, names, seeds and difficulty.                                                                                                                                                                                                                                                                           |
| Settings, pause, save/quit, controls         | Implemented            | In-game field guide, honest feature ledger and restartable workflow.                                                                                                                                                                                                                                                                              |
| Inventories / recipe guide / tooltips        | Implemented subset     | Searchable notebook, actual ingredient autofill, Creative catalog, item counts/durability, container/furnace states.                                                                                                                                                                                                                              |
| Complete Survival HUD                        | Partial                | Health, hunger, armor, oxygen, XP visualization, mining/relic progress, attack recovery, selected item/day indicators and Devin power readiness. Status effects are absent.                                                                                                                                                                       |
| Original art, crisp rendering, fog and audio | Implemented            | Original 16-pixel block atlas, textured isometric icons/held blocks, pixel font, textured animated creature models, crack overlays, starry sky, animated fluids, fog, original PCM Foley, mob voices and procedural ambience. No copied Minecraft assets or recorded sound bank.                                                                  |
| Efficient chunk rendering                    | Implemented foundation | Two material meshes per chunk, internal faces omitted, frustum culling, two embedded generation/mesh workers, transferable buffers, stale-job rejection and immediate nearby edits. Full geometry within four chunks; simplified voxel surfaces through eight chunks and 64×64 heightfield tiles out to 24. Fine/coarse coverage masking prevents loading seams; distant tree/building silhouettes are approximate. No greedy meshing; underground terrain/overhang detail at long range is approximate. |
| Reliable saves / interrupted-save recovery   | Implemented foundation | IndexedDB atomic transaction, payload checksum, two generations, automatic fallback, export/import. Cross-tab conflict resolution and cloud sync missing.                                                                                                                                                                                         |
| Standalone sharing                           | Implemented            | Single embedded HTML (including worker and font), no server or network dependency; Save game HTML and separate JSON world export. Windows x64 launcher EXE embeds the HTML and uses installed Edge/Chrome in an app window; actual Windows launch unverified here.                                                                                |
| Source / dependencies / build                | Implemented            | Source, generated assets, exact package lock, tests, launch instructions and production build command.                                                                                                                                                                                                                                            |

## Verification boundaries

Automated test results are recorded in `VALIDATION.md`. Fluid tests cover implemented source/flow/drain/cooling behavior and interactions; exact reference fluid routing remains partial. Shelter/night and advanced fixture tests accelerate production ticks and set deterministic state; world creation and recipe UI are exercised through browser actions. Milestones 3–5 remain open. Survival and Creative multiplayer are an optional, partial co-op beta documented in MULTIPLAYER.md. No complete version parity, full Nether/End parity, or automation behavior is claimed.

## Animation and held-item update (0.4.0)

- Implemented original wrist/palm/finger grip with rigidly attached, shaded 3D tools and textured blocks. A separate fixed-FOV hand camera keeps item proportions stable as the world FOV changes. Shared atlas textures survive held-item switches. Blocks are inventory items, not tools; their preferred mining tool no longer leaks into held-item behavior.
- Sword cuts, axe/tool strikes, punches, rhythmic mining, placement/use, visual eating, equip raises, look sway, walking/sprinting bob, swimming, airborne carry, landing and hurt recoil. Near-target obstruction lowers the hand. These are original visual curves; item use, eating and damage keep the existing simulation timing.
- Hostile arm strikes, distance-based limb gait, idle head/tail motion, villager trade nods, hit flinches, critical sparks, brief death falls, crosshair feedback and attack recovery indicator. Victim knockback now resolves against walls. Animation remains an approximation; no full skeleton/IK, shield/bow animation, or physically simulated fingers.
- The hand remains an overlay rendered after the world, as in many first-person games. Lowering it near the targeted wall reduces overlap; this is not full per-mesh world occlusion. Door state changes are immediate with background remeshing, not animated hinge sweeps.

## Ambient world and equipment update (0.5.0)

- Originally wind/water loops (replaced by continuous streaming synthesis in 0.8), daytime birds, night insects and cave/Cinderwild rumble. All nine creature types have distinct spatial voices with hurt/death variants. Separate saved volume sliders and category toggles; ambience fades while paused. These are synthesized approximations, not reference sounds.
- Ambient Occlusion, Sun Shadows, Fancy Graphics and Clouds are independent saved switches. AO rebuilds chunk vertex colors; sun shadows are local directional shadow maps, not a postprocess label or global voxel light. Fancy controls nearby torch lights and animated fluids. Since 0.6, resolution, clouds and particle settings are independent.
- The Devin Sword has a deterministic planted site in version-3 Overworld terrain, journal coordinates, 30 real-second continuous extraction, inventory-space checks and a once-per-world persistent claim. Release, pause, damage, aim and distance reset progress. Its ten-damage unbreakable blade heals one health point on a fully charged hit and provides an eight-damage/seven-block hostile-only, wall-aware pulse on a ten-second simulation cooldown. Cooldown and origin metadata persist. No quest/boss chain is claimed.
- Spears, the relic sword and deterministic enchanting are deliberate custom mechanics beyond the Java 1.20.4 reference. F5 now cycles first/behind/front views of an articulated player with palette costumes, rigid armor overlays and held items. No skin-file importer, full IK or reference skin UV system. Saved generator versions 2/3/4 retain their terrain; version 0.7 expanded villages use generator 5, and current regional villages use generator 6. Export backups before upgrading; new content cannot be opened safely in older builds.

## Terrain, visual and sound renewal (0.6.0)

- Version 0.6 introduced generator version 4; current new worlds use version 6. Legacy versions 2–5 retain their saved terrain algorithms. Continental relief, ridges, broader river valleys, distinct tree forms and twelve biomes are original approximations. Lapis, crops, relics, villages and portals stay functional. Ten terrain blocks append after prior IDs. Pine/birch log-to-plank, fuel/charcoal and red-sand-to-glass recipes connect the new resources to progression. No new reference dimensions, mobs or weather parity is claimed.
- Existing menu art/style stays intact. The reorganized Video Settings exposes immediate, persisted controls for resolution, distance/LOD, frame cap, entity display range, particles, smooth lighting/AO, brightness, local sun/entity shadows, 0–4 mip levels, biome tint/blend, view bobbing, clouds, sun/moon and fog. Biome Blend samples five points, brightness is ambient illumination, and entity casting requires sun shadows. These differ from exact reference implementations.
- Renewed filters texture speckle while preserving silhouettes, material markings and pixel edges. Classic preserves the old 58-block atlas pixel-for-pixel, including doors/relics. Both are built in and offline; external resource-pack import is absent. Pack choice does not revert newer models, game systems or terrain.
- Creature models batch static geometry by material, share immutable cube geometry, fit resting collision height and interpolate visual movement/rotation. Physics remains separate; collision shapes and pathfinding remain approximate. No full IK or motion-capture animation. The new F5 player has its own articulated model.
- Bounded terrain caches, once-per-column tint evaluation, per-chunk edit indexes, pruned light/plant indexes, distant model disposal and shared drop textures reduce measured CPU work and retained rendering resources. Exact hardware FPS and a stutter-free maximum-distance experience are not guaranteed.
- Layered material contact/friction/resonance and multi-harmonic/formant creature samples replace basic tones. Three voice variants per creature with breath, envelopes, stereo distance attenuation and event pitch changes; all sound remains original synthesis.

## Expedition update (0.7.0)

| Feature | Status | Shipped behavior / limits |
| --- | --- | --- |
| F3 navigation | Implemented | Feet and floored block XYZ, negative-coordinate chunk indices, world axes, eight compass headings and clockwise bearing. Seeded sword base, signed delta, horizontal distance and shortest turn. Correct claimed/other-dimension/legacy messages. |
| F5 player | Implemented foundation | First person, behind and front. Collision-aware camera, articulated gait, attack/mining motion, crouch and head look. Equipment and held model follow joints. Player reach still uses the player eye. Body poses are original approximations, no IK, swimming pose or native skin importer. |
| Main-menu skins | Implemented | Explorer, Carnival Clown, Trail Hero and Bandit; original palettes/details, preview sprites, saved device preference. Armor overlays the costume. |
| Smoother daylight | Implemented foundation | Fractional visual clock, continuous cyclical light/color curves, dusk warmth, moonlit nights and star fades. Existing 20 Hz/24,000-tick mechanical cycle and announcements unchanged; 0.8 adds partial weather/lightning. |
| Creature models | Implemented foundation | Smaller dark animal eyes; connected folded villager arms, shoulders, elbows and hands; custom articulated iron guardian. Basic voxel joints, no full skeleton IK. |
| Expanded villages | Partial | New generator 5 doubles homes/residents to eight, with lanes, two wheat plots and a planted green. Old generators preserve four-home layouts. Original structures and waypoint AI; not reference layout parity. |
| Iron Golem defense | Partial | One persistent 100-health defender per visited village, including legacy settlements. Chases and strikes nearby hostiles; enemies can attack civilians/golems. Attacks respect solid walls. Guard kills grant no player XP; no respawn duplicates. No construction, healing, reputation, flowers or spawn-summoning rules. |
| Dirt tools/armor | Implemented custom | Ten shaped recipes (five tools, spear, four armor slots). Tier 0 mining, speed 1.2, 12-use tools; armor 8–12 durability, 2.5 points total. Cannot harvest stone/ore; intentionally weaker than wood/leather. Can receive compatible existing enchantments. |
| Pixel menus | Implemented | Existing layout and controls with original timber, moss and brass styling, distinct wardrobe and navigation overlay. |

At release 0.7 the ledger still described static fluids, incomplete dimensions and no automation; 1.2 supersedes the fluid status. The later releases add limited Creative co-op. Broader Minecraft parity remains partial/missing as labeled.

## Living world update (0.8.0)

| Feature | Status | Shipped behavior / limits |
| --- | --- | --- |
| Continuous ambience | Implemented foundation | Stateful original stereo synthesis with smoothly varying biome, water, foliage, cave, night and weather layers. AudioWorklet with newly generated PCM streaming fallback; no reused four-second buffers. Irregular bird calls, roof-muffled rain, distance-delayed thunder. Synthetic approximations, not recordings. |
| Music toggle/volume | Implemented original | OFF by default; saved independent toggle/volume. Seeded original felt-piano/bell phrases, cold/coastal tonal palette, rests and fade on pause/disable. Calm exploration mood; no copied reference compositions/samples. |
| Regional villages | Partial | New generator 6, 512-block regions, minimum 384-block center separation. Eight regional wall/roof/robe/headwear styles including raised marsh homes; eight residents, linked doors, farms, loot and golem. Fixed schematic plans, not reference jigsaw generation. Legacy 2–5 algorithms stay unchanged. |
| Weather | Partial | Seeded clear/rain/thunder, smooth intensity, biome/height snow, dry deserts, roof clipping, lightning/delayed thunder, overcast light/fog, exposed-crop irrigation, storm shelter and bed clearing. Saved timers/override/intensity. No accumulated snow, melting, fire, lightning damage or exact reference spawning/light. |
| Extended rendering | Implemented foundation | 2–24 chunks; full within four, simplified voxel surfaces through eight, then stable 64×64 heightfield batches without voxel chunk generation. Approximate trees, village silhouettes and above-ground edits. Actual loaded-chunk coverage mask fills loading seams. Underground terrain/builds, overhangs and exact distant geometry remain approximate. |
| Fixes | Implemented | Middle-distance building walls retain their faces below roofs, sealed regional roof ridges, rapid pause/resume survives asynchronous pointer-lock exit, finite cancellable music mute, cleared transient worker indexes and bounded roof caches. |

The completed/partial/missing status of all other systems above remains unchanged. Weather and village algorithms are original approximations; automation and complete dimensions remain missing; fluid flow arrived in 1.2.

## Cinderworld expedition update (0.9.0)

| Feature | Status | Shipped behavior / limits |
| --- | --- | --- |
| Cinderworld generation | Implemented custom foundation | Generator 7 adds four volcanic regions, lava basins/channels, coherent caves, ember canopies, crystal growths and basalt spires. Existing generators 2–6 stay unchanged. Original open-sky terrain, not Minecraft Nether generation or biome parity. |
| Exclusive ores / Hellfire progression | Implemented custom | Hellfire and Brimstone veins at Y 15–70, diamond/iron mining tiers, actual drops, fuel, furnace smelting and shapeless alloy refining. Ten shaped gear recipes. Faster, longer-lived tools; full armor 20 points plus toughness 3/piece and 40% extra heat reduction. No immunity, anvil repair or reference Netherite equivalence. |
| Exploration / loot | Partial | Bastions, crystal shrines and ruined waystations; real chests, food/fuel/rare resources, workstation blocks and persistent one-time defenders. Fixed schematic plans and kind-based loot, not reference jigsaw structures or full randomized loot pools. |
| Cinderworld creatures | Implemented custom foundation | Peaceful ash deer, retaliating Cinderbacks, hostile basalt crawlers and cinder wraiths, plus existing emberlings. Separate original models/voices, basic local steering/collision, drops and persistence. Wraiths walk; no flight, breeding or global pathfinding. |
| Distant relic temple | Implemented custom foundation | Generator-7 sword site begins around 1,024 blocks from origin, inside an actual runestone/pillar temple. Three 140-health, 35%-resistant Guardians have a melee wind-up and local pursuit. All three defeats persist and unlock 30-second extraction; Every mode/difficulty requires all three distinct Guardian defeats before temple extraction. Legacy sites remain intact. |
| Magical sword visuals | Implemented | Faceted 3D blade, luminous runes, gem and orbiting shards in held/F5 views; enhanced planted geometry; one pooled star-mote draw call and layered expanding pulse rings. Minimal particles suppress motes, retaining the pulse rings. Existing attack/healing/cooldown/line-of-sight rules remain. |
| Hail / tornadoes | Partial custom hazards | Rare natural cycles and Creative menu, saved moving funnel state, batched particles, hail impacts, wind/rumble, exposed-player damage and collision-aware pull/lift. Roof cover protects; Creative/Peaceful immune. Dense batched funnel shells and 20–96 visual debris instances follow seeded crossing tracks. Players, creatures and drops are pulled; buildings remain intact and only loose decorative vegetation may be stripped. No structural block destruction, physical hail items or realistic fluid dynamics. |
| Jungle wildlife / tigers | Partial custom ecology | Generator-7 jungle with taller trees and bamboo; pandas retaliate, koalas are passive ground foragers. Day-active hostile savanna tigers use existing night-independent wildlife spawning and can threaten villages. Original articulated models/voices; no climbing, breeding, feeding or exact reference AI. |
| Guidance | Implemented | Existing pixel menu style; pause expedition guide with recipes, hazards and nearby Cinderworld structure coordinates. Relic Journal includes seal progress and Guardian advice. Existing F3/J remain accurate to saved generator. |

All these additions are original extensions beyond the Java 1.20.4 mechanics reference. At release 0.9 these systems remained incomplete: static fluids, no automation and no full Nether/End/boss progression; 1.2 supersedes fluids. Multiplayer was absent in 0.9.0; later releases add limited Creative co-op.

## Main release — 1.0.0 additions

| Requirement | Status | Shipped behavior / difference |
| --- | --- | --- |
| Menu/UI overhaul | Implemented | Original stone/dirt pixel theme; squared beveled controls; consistent panels; title top bar removed; pause Options navigation; crafting-table recipe sidebar retained with material-consuming autofill and search. No copied Minecraft assets. |
| Softer UI audio | Implemented | Quiet rounded sine partials and low-pass noise with smooth envelopes replace the harsh stone impact. |
| Manual doors | Implemented | Villagers may open doors but never close them automatically. Both halves and collision states persist; closing checks occupants. |
| Natural obsidian | Implemented in generator 8 | Coherent underground lava chambers with obsidian rims at Y −42…17. No surface outcrops in new terrain. Player-placed blocks and portals persist. Generators 2–7 stay unchanged, including old outcrops. Fluids remain static. |
| Devin Seeker | Implemented custom ability | R launches a visible homing bolt toward a visible hostile within 28 blocks, 12 damage, 14-second saved cooldown, swept wall collision, peaceful-target filtering, live reacquisition and bounded lifetime. Right-click Pulse retained. |
| Skins | Implemented original subset | Nine original palette/geometry costumes and previews. Devin The Hero has a fine emerald tunic and smirk; four other new outfits each have costume details. No skin-file import or reference UV format. |
| Multiplayer | Partial beta | Optional Node.js WebSocket relay, invitations, eight-player Creative co-op, host-checked edits/doors/combat, shared creatures/weather, avatars/armor/held items, roster, chat, latency and removal. Host browser runs/saves the world. See MULTIPLAYER.md. |
| Advanced multiplayer | Partial; see 1.4 update below | Survival Overworld co-op, shared containers/crafting and saved guest profiles now work. Independent dimensions, dedicated simulation, automatic public hosting/NAT traversal, host migration, accounts and public-server hardening remain absent. |

This main release extends the existing game and save format; its version number does not mean full Minecraft parity. Earlier milestone gaps remain open.


## Adventure update — 1.1.0 additions

| Requirement | Status | Shipped behavior / difference |
| --- | --- | --- |
| Player and interaction animation | Implemented custom rigs | Alternating sword cuts, spear thrusts, tool-specific mining, placement, use, eating, sprint carry, swimming, landing, and third-person action poses; rigid hand grips. Visual motion is separate from simulation. Some instantaneous interactions still use short generic use poses. |
| Caves and terrain overhaul | Implemented in generator 9 | Seeded connected ellipsoid chambers, sloping tunnels, occasional land entrances and foothill relief. Lava/obsidian chambers retained. Older generators 2–8 keep actual voxel output; no reference noise-cave/aquifer parity or underground biomes. |
| Nighttime roster | Partial Java-inspired subset | Four distinct original Zombie/Creeper/Spider/Skeleton models, voices and attacks, replacing shade/stalker Overworld spawns. Simplified local AI, damage and spawn rules; no zombie infection/door breaking, charged Creepers, spider jockeys or mob equipment spawning. |
| Guardian challenge | Implemented custom encounter | Three persistent 64-health Guardians, 28% reduction, telegraphed melee, jumpable shockwave, runic barrage and aimed lunge. Distinct recovery windows, leash, Peaceful dormancy, permanent defeat seal. Older already-spawned entities retain saved health. |
| Grand sword temple | Implemented in generator 9 | Larger courtyard, open arches/galleries, four lit towers, a raised open crown and real persistent supply loot. Existing worlds retain their original temple layout. |
| Texture packs | Implemented original artwork | Renewed 16px material motifs; v1.0 Soft and frozen v0.5 Classic retained. World, hand, icons, drops and player held items update together. No Minecraft assets. |
| 3D dropped items | Implemented | Atlas-textured blocks/panels, actual tool models, and merged extruded material silhouettes with lit edges. Bob/rotation toggle, range culling, disposal on pickup/unload/pack/mipmap changes. No flat billboard drops. |
| Additional video options | Implemented | Stars, Cloud Height, Animated Textures, Creature Animations, Dropped Item Animation, FOV Effects and Damage Tilt. Persisted real controls; combat telegraphs remain active when idle animation is disabled. |
| Mob loot and bone meal | Partial | Rotten flesh/bone/string/gunpowder drops, bone → three bone meal, four string → wool, bone meal advances wheat three stages. No rotten-flesh Hunger effect, full loot tables or gunpowder crafting yet. |
| Remaining major gaps | Missing / partial as above | Flowing fluids now have the partial 1.2 implementation above. Automation, full Nether/End/boss progression, player bows/shields/offhand, full pathfinding and reference lighting remain incomplete. Creative co-op beta retains its documented limits. |

The stronger custom encounter and new artwork do not imply Minecraft 1.20.4 mechanical parity. In-flight enemy projectiles are transient and clear on reload/dimension changes; creature/fuse/skill state and terrain damage save normally. Public multiplayer hosting and native Windows execution were not validated on Linux.

## Previous release 1.2.0 — Living Blocks & Citadel

The earlier versioned sections are release history. The current ledger above and this section take precedence over their old static-fluid/Guardian-balance descriptions.

| Feature | Status | Shipped behavior and limits |
| --- | --- | --- |
| Missing-content expansion | Implemented subset | 43 new usable items/blocks and 43 recipes; 121 numeric block states and 182 item definitions in total. Append-only IDs preserve old saves. This is not the complete Java item/block catalog. |
| Minerals and storage | Implemented subset | Copper/gold/emerald ore, raw copper/gold, ingots and ten reversible mineral blocks; coal blocks and lava buckets fuel furnaces. Natural deposits require generator 10. No copper oxidation or reference vein distribution. |
| Golden gear | Implemented | Five tools plus four armor slots. Speed 12, tool durability 32, wooden mining tier. Gold armor provides 11 total armor points with reference-style durability values; no special enchantability or piglin behavior. |
| Building materials | Implemented subset | Stone bricks, mossy/cracked variants, smooth stone, granite/diorite/andesite, clay/brick chain, packed ice, hay bale, bookshelf and TNT recipes. Stone-variant combining recipes are custom. Packed ice does not alter friction; hay does not cushion falls; bookshelves do not affect enchanting. |
| Fluid dynamics | Partial | Working source/flowing/falling states, retreat, renewable water, buckets, cooling, Cinderworld evaporation, currents and item buoyancy. States live in normal saved terrain edits and work in worker meshes/co-op. No waterlogging, accurate corner slopes, exact spread ordering or lava proximity ignition. |
| Fire / hazards | Partial | Flint and steel ignites surfaces, fire or TNT; supported fire burns/spreads, extinguishes and hurts. Cactus sides/tops hurt and destroy ordinary drops. Creature/fluid contact and fire timing remain approximations. |
| TNT | Partial | Four-second persistent fuse, visual/audio warning, chain reactions and bounded terrain/LOS damage. Primed blocks do not fall or launch; protected inventories remain intact. No redstone or exact Java explosion resistance/chaining. |
| Grand citadel / protected sword | Implemented custom encounter | Generator-10 69 × 73 site, 36-block outer towers, galleries, roofed sanctuary and indestructible Guardian seal. Three permanent defeat records open the seal; interrupted 30-second extraction remains. Generators 2–9 retain original terrain. |
| Guardian upgrade | Implemented custom | Fresh 100 HP, 35% reduction; heavier original models; six alternating telegraphed attacks, ground-sigil slow and shorter recovery below half HP. Cover/distance/jump/flank/sidestep counterplay. Saved spawned HP is preserved. Local steering is not full pathfinding. |
| Remaining missing content | Missing | Most Java decorative variants, slabs/stairs/trapdoors/fences/ladders, waterlogging, redstone and automation, player bows/shields/functional offhand, brewing/anvils/fishing, full dimensions/bosses and the full recipe catalog. See the system-by-system ledger above. |


## Previous release 1.3.0 — Matthew’s Arsenal

| Feature | Status | Shipped behavior / limit |
| --- | --- | --- |
| Matthew's Dual Wielded Pistols | Implemented custom addition | One paired, nonstackable, unbreakable item; alternating aimed shots, 5 damage, 5 shots/second, 40-block range; solid-wall and body ray intersections, no block damage; original models in both hands/F5 and original synthesized effects. Magical shots use no ammunition. |
| Trickster-inspired evasive moves | Partial custom adaptation | Dash (4.2-block style displacement), Sky Star once airborne, Air Trick toward an aimed hostile within 18 blocks, Wall Hike once airborne near a wall. Two independently recharged 2-second charges; Air Trick also has 5-second cooldown. Swept body collision, no invulnerability/fall immunity. No DMC3 lock-on, upgrades, full combat/parry/animation parity or copied assets. |
| Tentacled Overworld incursion | Implemented custom addition | 25% chance per 30-second check after 60 active seconds, subject to a dry unedited loaded clearing. Six tentacles, actual opening, nine-second rising shrine, exact requested announcement. Body occupancy pauses dangerous construction transitions. One event per world. |
| Protected reward / persistence | Implemented | Four persistent Hellspawn (two bolt-firing wraiths, crawler, emberling); permanent defeat records; no claim before all four die; full bags leave the reward untouched; exactly one pair. Interrupted emergence, blocks, enemies, cooldowns and claims save. Peaceful pauses encounter and preserves guards. |
| Creative demonstration / journal | Implemented | J journal coordinates, phase, kill count, controls and Creative-only summon button. A valid clearing is still required. Normal earning gate remains. |
| Multiplayer extension | Partial | Host approves shots/damage and shares incursion state/trails. Guests can use Dash/Sky Star/Wall Hike; Air Trick and unique reward are host-only. Existing Creative-only and host-vicinity limits remain. |
| Existing-code fixes | Implemented | Right-button release leaves held left-button actions active; Seeker acquisition and swept bolts ignore non-solid decorations. |
| Save/terrain compatibility | Implemented | Append-only new altar ID and item, same generator 10. Old generators 2–10 retain terrain. No new world required. New-content saves need 1.3+. |


## Visual update 1.3.1 — Dante & Twin Iron

| Feature | Status | Shipped behavior |
| --- | --- | --- |
| Dante wardrobe entry | Implemented custom costume | DMC3-inspired silver hair, open red coat, harness, gloves, boots and grin; matching SVG preview, saved selection, co-op skin ID, F5 coat-tail motion. Ten total outfits. |
| Reference-inspired pistol models | Implemented | Original batched geometry: black/silver long slides, brown wood grips, screws, oval cameo motifs, hollow guards, sights, serrations, under-barrel weights and hammers. Used in both hand views, drops and incursion display. Stylized, not photographic replicas. |
| Local pistol animation | Implemented | Independent recoil, sliding actions, hammer travel, short muzzle flashes, ejected casings, draw/settle, sprint carry and first-person dash carry. F5 shares mechanical recoil. No simulated reload: the established weapon has unlimited magical ammunition. Minimal particles hide flashes/casings. |
| Remote firing animation | Missing | Co-op movement, costumes and weapons render; remote shot animation is not synchronized. |
| World/save/mechanical changes | Unchanged | Generator 10, old terrain compatibility, unique acquisition, shots, damage, cooldowns and Trickster-inspired movement retained. No new save format. |


## Audio update 1.3.2 — Twin Report

| Feature | Status | Shipped behavior |
| --- | --- | --- |
| Pistol firing reports | Implemented original synthesis | Reference-informed crack, deep body, chamber/slide clack, short reflections; black/silver timbres with four variations each. No uploaded recording embedded. |
| Playback and controls | Implemented | One reused PCM buffer source per shot with gain and subtle hand panning; respects master volume/mute and existing voice cap; ended nodes disconnect. Short tails remain bounded at the existing five shots/second. |
| Co-op guest feedback | Implemented | Local predicted guest shots play the appropriate firing-hand report; host authorization/damage remain unchanged. Remote spatial gunshot replication remains partial. |
| Subjective reference matching | Unverified | Spectral/envelope analysis and output-signal checks are performed; this environment cannot directly audition audio. Use the original WAV preview or the game to judge the sound. |


## Trickster Wake update 1.3.3

| Feature | Status | Shipped behavior |
| --- | --- | --- |
| Dash presentation | Implemented local visuals | Cyan/violet sigils, body echoes, wake and first-person peripheral speed lines; upward Wall Hike streak; Air Trick departure/arrival rings and intermediate echoes. Three pooled draw calls, at most 12 rings, 12 echoes and 96 line segments. |
| Graphics controls | Implemented | Minimal particles suppress new effects; reduced particles/Fancy off suppress echoes; Dynamic FOV controls the brief speed impulse. Effects pause, expire and clear between worlds. Remote co-op effect replication remains missing. |
| R acquisition and free aim | Expanded | Any aimed living creature within 18 blocks, or an up-to-18-block free blink toward the crosshair. Creature approaches retain 1.8-block standoff and reject obstructed body paths. Free aim stops at the last clear whole-body position; too little room fails without spending a charge. Grounded downward aim stays level. No damage to passive targets. |
| Balance and restrictions | Retained | Two independently recovering style charges, five-second R cooldown, dash speed/displacement, no invulnerability/fall immunity, no style while dead/swimming/in lava/Creative flight, host-only R in Creative co-op. |
| Weapon move guides | Implemented | Dedicated panel above hotbar/vitals for pistols and Devin Sword; cooldowns and style charges; responsive wrapping; visible in F5. World targeting labels remain separate. |

## Jukebox update 1.3.4 — Historical, removed in 2.2.0

Local MP3 discs replace this historical feature. See the current 2.2.0 section.

| Feature | Status | Behavior / limits |
| --- | --- | --- |
| Craftable/placeable jukebox | Implemented custom addition | Eight planks around a diamond; Creative catalog; original top/side textures; axe mining and ordinary block drops. Existing IDs and generator remain unchanged. |
| YouTube links | Implemented integration; external service dependent | Official visible IFrame API, validated video links/start times, Play/Pause/Stop, volume/master mute, normal YouTube fallback. Requires internet and a provider-allowed embed. Local files may be rejected with error 153. Real streaming could not be tested here because the network returns 403. |
| Persistence/lifecycle | Implemented | Canonical video ID/start and volume stored in the existing per-realm container records; no autoplay on reload. Stop on world/dimension change or block removal. Other menus pause the player. |
| Multiplayer jukebox | Partial | Personal playback only. Host saves block links; guests cannot write them. No shared time, audible range, replicated play state, music discs, comparator output or redstone control. |

## Campfire Co-op update 1.4.0

| Feature | Status | Behavior / limits |
| --- | --- | --- |
| In-game chat | Implemented | T to chat, / for commands, history recall, escaped text, recent-message HUD, session log and relay chat interval. Singleplayer supports local chat/commands. |
| Owner commands | Implemented subset | Help/list/seed/time/weather/difficulty/give/tp/heal/spawn/kick/save. Local host authorization, bounded arguments, atomic inventory grants. No permission ranks, command blocks, arbitrary scripts or gamemode/ban commands. |
| Survival multiplayer | Partial playable beta | Host-authoritative movement, real mining/tool speed, inventories, crafting/recipe sidebar, equipment, shared chests/furnaces, item consumption/drops/pickup, vitals/hazards, hostile damage, death/respawn and individual bed spawn. No PvP; guest trading/enchanting/style movement/unique sword extraction remain owner-only. Shared Overworld only. |
| Guest persistence | Implemented with limits | Up to 64 saved profiles in existing recoverable host saves, private random browser reconnect token, no name-based inventory recovery, duplicate-token admission rejected. Same browser/relay required. No account recovery or host migration. |
| Internet sharing | Implemented transport/setup; external deployment required | Public HTTP(S)/WS(S) relay address, PUBLIC_URL invitations, Docker/Caddy/Compose/Render config and reachability checker. Owner must supply/run a reachable server. Actual external deployment/multiple Wi-Fi networks not verified here. No automatic NAT traversal, cloud server provisioning or dedicated simulation. |
| Simulation regions | Partial | Owner browser runs/saves world and remote player physics. Spawns/fluids/AI still center on host vicinity, with existing nearby mobs able to target guests. Latency corrections, background throttling and full-world snapshot limits remain. |

## Open Skies HTTPS update 1.4.1

| Feature | Status | Behavior / limits |
| --- | --- | --- |
| Native HTTPS/WSS | Implemented | One TLS listener with operator-provided certificate/key, protocol-2 relay and encrypted browser/client tests. No client certificate-validation bypass ships. Certificate provisioning/renewal requires an operator or proxy. |
| Public PC hosting launcher | Implemented integration; provider-dependent | HOST-PUBLIC.cmd starts localhost relay + externally installed cloudflared, checks HTTPS and WSS before readiness, saves address and stops both on exit/failure. Live Quick Tunnel creation is unverified because Cloudflare/GitHub requests return 403 here. Tests use a separate fake provider process; none is shipped. |
| Public connection menu | Implemented | Public HTTPS versus Local/LAN selection, public-address validation, WSS probe/version check, remembered endpoint, encryption label and invitation refresh after operator URL change. |
| Persistent public service | Partial / external | Quick Tunnels are temporary; addresses and browser save origins change on restart. Stable guest profiles need a stable relay address. Existing direct-TLS/proxy/container/cloud setup is available, but there is no always-on public deployment or dedicated simulation in this delivery. |


## Infernal Kingdoms update 1.5.0

| Feature | Status | Behavior / limits |
| --- | --- | --- |
| Cinderworld terrain | Implemented custom generator | Six seeded regions, lava rifts, jagged highlands, spires, skeletal emberwoods and broad caves; generator 11 only. Existing generators 2–10 preserve their terrain. No exact Nether terrain or dimension ceiling. |
| Huge infernal structures | Implemented | Three types, 53–61 blocks wide and 44–64 blocks tall, accessible ground-level naves, buttresses, hollow towers, lava channels, sealed treasure vaults and distant silhouettes. Tower interiors have no ladders or furnished upper floors. |
| Infernal defenders | Implemented custom additions | Dread knight ground slam, aimed Soul Reaver volleys, charging Magma Maw; six persistent guards per vault. Local steering, swept body collision, original batched models and synthesized voices; no full dungeon pathfinding. |
| Guarded loot | Implemented | All six defeats unlock the vault and Survival chest opening/mining. Enchanted Hellfire equipment, alloy, diamonds and a Cinder Sigil. Rewards and permanent defeats persist. Creative/Peaceful bypass protection; no multiplayer dimension access. |
| Harder Devin Sword acquisition | Implemented | Generator-11 temples add a lava moat, narrow bridge and Sigil-consuming outer ward; all three Guardians still gate the inner sanctuary and 30-second extraction. Older temples need no Sigil. |
| Guardian buff | Implemented | Fresh Guardians: 140 health, 35% damage reduction, 12 base melee damage and stronger six specials. Pistol hits are rejected centrally before damage/knockback/death; melee and magic remain effective. Previously saved Guardians retain their current health. |
| Vergil skin | Implemented original costume | DMC3-inspired blue embroidered coat, swept silver hair, gloves and cosmetic sheathed katana; original wardrobe preview, F5 coat animation, saved selection and accepted co-op identity. No extra combat moves. |

## Titan's Grasp update 1.6.0

- **Completed:** Four elite incursion defenders, 20% increased attack damage, once-only proportional legacy health upgrade, saved orb shot sequence with swept bullet/body/wall collisions, bounded projectile rendering, visible tentacle warning/reach/pull.
- **Completed:** Chance-based single-player abduction into the real saved Cinderworld; indestructible arena shell, recovery alcove, one-time equipment/food cache, 320-HP original horned Mad Titan, bullet immunity, melee resistance, four telegraphed specials, boss HUD and synthesized voice.
- **Completed:** Persistent trial/boss/consumed supplies, checkpoint respawn and item recovery, boundary recovery, ordinary portal lock, victory-gated return rune, unique XP/loot award, preserved original pistol claim gate.
- **Partial:** Tentacles select the local Survival player; abduction is disabled during co-op. Boss AI uses existing local steering and can be obstructed by cover. The prison is an enclosed edited arena at Y244 rather than a new generated biome. Death drops retain the standard five-active-minute despawn. Peaceful suspends combat and keeps the exit locked.
- **Missing:** Separate per-player multiplayer dimensions and boss encounters; destructible tentacle limbs, full-body grab cinematics or automatic difficulty scaling by player equipment. Existing broader partial/missing mechanics listed above remain unchanged.

## Guardian collection gate 1.6.1

Implemented: planted temple swords require three distinct, valid Guardian defeats in every mode/difficulty. Living temple Guardians override stale completion records; only actual dead temple Guardians with valid role indices count. The inner seal respects the same victory requirement. Legitimate saved defeats, the Cinder Sigil approach and 30-second extraction remain. Legacy pre-temple relics and already claimed swords are retained. Creative catalogs/owner cheats remain unrestricted tools.

## Cave Update additions — 1.7.0

| Feature | Status | Shipped behavior / limits |
| --- | --- | --- |
| Daytime underground hostiles | Implemented foundation | Zombies, skeletons, creepers and spiders can spawn in loaded dark cave passages near the Survival host even during daylight; local source proximity suppresses spawning. Full body clearance, player exclusion distance, caps and Peaceful checks apply. Not reference-exact brightness, spawn algorithm or independent spawning around distant co-op guests. |
| The Watcher | Implemented original feature | Rare saved cave encounter; pale elongated original model, black eyes, gaze/line-of-sight-triggered laugh, unseen stalking and retreats. Harmless, damage-immune, no drops/XP. Creative egg variant stays for viewing. This is an original NPC, not a Minecraft mob. |
| Creative spawn eggs | Implemented | Searchable eggs for all 24 implemented mob types, clear supported placement, entity cap, unlimited use. No Survival crafting, drops or use. Special eggs spawn individual entities, not entire associated structures/reward encounters. |
| Underground atmosphere | Implemented original feature | Roof/depth-aware smooth light dimming and dark fog hide distant underground chunk boundaries. Open shafts, surface houses and Cinderworld keep their existing sky behavior. Fog and brightness settings remain available. |
| Cave/night ambience | Implemented original feature | Continuous original procedural ambience with irregular echoes, drips, groans and creaks, region-specific cave tones and calm eerie night undertones. Separate ambience/creature volume controls. No borrowed soundtrack or recorded samples. |
| Mineshaft rails/webs | Partial | Original thin decorative rails, accurate targeting; no carts, rail connectivity or redstone. Real cobweb slowdown and mining/string drops; no spider-created webs. |

## Forge & Motion additions — 1.8.0

| Feature | Status | Shipped behavior / limits |
| --- | --- | --- |
| Weapon/tool models | Implemented original visuals | All 42 non-pistol variants have thin pixel silhouettes and shared held/F5/dropped geometry; material-specific highlights and guards. Original assets inspired by Java 1.20.4, not exact UV/texture parity. |
| Devin model and flair | Implemented original visuals | Broad turquoise stepped blade, raised ridges, golden grip/guard, matching planted display and icon grip. Three anchored glints, subtle sheen, brief cyan trail and restrained impact sparks; Minimal hides decorative effects. Existing Guardian/Sigil/30-second/unique-claim mechanics remain. |
| Flat flint and steel | Implemented | Transparent double-sided plane in hand/drop/F5; real icon hole, no rectangular cuboid sidewalls or voxel extrusion. Ignition, portals and durability remain. Other ordinary item/block models retained. |
| Player movement/weapon animation | Partial reference parity | Non-pistol rigs have elbows, staged tool-specific actions, subtle gait/airborne/crouch poses, first-person paddling and F5 prone strokes/treading/land recovery. Co-op water flags and held-item phase continuity work. Visual only: upright collision/physics and click damage timing remain. Near-wall swim limbs can overlap terrain. |
| Pistol exclusion | Retained | Matthew's original models, first-person fire, independent recoil, F5 rig/poses, sounds and Trickster skills stay. This retained player stance is an intentional exception to the new non-pistol swimming/articulation rig. |
| Cinderworld foe design | Implemented original visuals | Eight distinct foe/neutral silhouettes, animated jaws/robes/pincers/attack stances and persistent glow after damage flashes. Same creature stats, hitboxes, AI, attacks and drops; local steering/navigation limits remain. Peaceful ash deer and existing Overworld/Guardian designs retained. |

## Supplied Assets pack — 1.8.1

Implemented: selectable offline pack from the uploaded PNG artwork; supported block faces, door halves, fluid states and common inventory icons; saved preferences and original-pack fallback. Partial: custom-content coverage and animation (frame zero plus existing fluid shimmer). Missing: full resource-pack models, creature/armor textures, metadata animation and arbitrary pack import. Gameplay and generator 12 are unchanged. See README.md and THIRD_PARTY.md for coverage and attribution.

## Field & Form — 1.9.0

Implemented: redesigned rigs for all 16 current Overworld types plus two legacy palette variants; all eight villager outfits, three professions and connected folded arms; bounded head tracking; 97 flat ordinary/plant/door items in hand/F5/co-op/drop rendering; camera-facing cutout drops. Solid blocks and modeled weapons retain depth. Supplied Assets repairs cover directional workstation faces, fitted chest-sheet crops, narrow door edges, world torch UVs, bamboo/cobweb cutouts, thin rails, flat item icons and pack-aware local/worker/horizon meshing. Partial: source animation strips (frame zero), fixed north-facing workstations, custom/bed fallback art and exact reference geometry. Original gameplay, stats and saves remain unchanged.

## Pixel & Grip — 1.9.1

- Implemented: shared stone/pixel menu controls, responsive Options sliders, recipe sidebar/slot styling, native keyboard-accessible toggles/ranges/selects, pixel crafting/furnace indicators and tooltips. Existing menu actions retained.
- Implemented: 103 original, alpha-cutout item icons in Renewed/custom Supplied fallback; native supplied icons and legacy Classic/Soft artwork retained. Flat held/dropped sprites share the same artwork.
- Implemented: camera-anchored connected first-person forearms for both hands. Rigid wrist/item sockets, existing swing/recoil curves and F5 rig retained.
- Partial: original UI/animation interpretation rather than reference-exact geometry, skin UVs or pixel/layout parity. Existing gameplay limitations remain as listed above.

## Devil’s Palm & Stand Awakening — 2.0.0

| Feature | Status | Shipped behavior |
|---|---|---|
| Palm block generation | Implemented custom system | Seeded five-finger formation, irregular depression/crater, original material palette, bones/dead wood/ruins, buried chamber and real container; shared chunk/worker/horizon geometry. Base generator/old block IDs retained. |
| Relocation/protection | Implemented custom system | Default one active site, configurable 1–3; five-day interval, small candidate batches, no moves during trials/nearby occupancy, rejects edits/villages/temples/protected land. Restores untouched terrain; retains visited/edited/offline-occupied ruins and containers. |
| Trial/fate | Implemented custom system | 1,200-tick default, escapable, rising haze/wind/particles, irregular whisper-like sounds/tremors/silhouettes/exhaustion/mild damage. Exactly one seeded weighted roll per completion: 35/50/15 defaults; normalized owner weights and optional capped pity. |
| Stand ownership | Implemented | Per-player persistent identity, permanent Stand, serial/ledger, energy, cooldowns, level/uses; retained through ordinary/Titan respawn, realms and reload. Existing users cannot reroll unless allowed. |
| Five Stands | Implemented custom adaptations | Ten executable actions: swept nails/volley; rope pickups/doors and grapple; collision/movement/melee transformation and roar; self/ally/animal repair; protected clear-path blink and return rift. Costs/cooldowns/target validation and HUD feedback. |
| Corpse Part | Implemented subset | Original 3D relic/icon/description, 2% default chance on awakening, hidden chest/fallback inventory/drop, once per player/site, non-stacking +10 energy. Upgrade quest absent. |
| Stand UI/configuration | Implemented | Pixel management/options screens, portraits, energy/cooldowns, H/F/G/V defaults, safe personal rebinding, normalized host rules and developer-only QA commands. R and ordinary controls retained. |
| Co-op Stand system | Implemented on existing beta | Host-authoritative independent trials, outcomes, ownership, abilities/damage, sequence rejection, private state, visible remote rigs/projectiles/rifts and synchronized relocation. Stable browser/relay resume identity required. Existing transport/host limitations remain. |
| Full reference powers / Acts / quests / Luck / Hardcore / PvP | Missing | No placeholder buttons or claims of complete JoJo/Minecraft power parity. Existing co-op PvP remains disabled. No dedicated simulation server or Stand-versus-Stand health system. |

See STANDS.md for exact values and controls. The rest of the original feature checklist remains applicable; version 2.0.0 denotes this expansion, not completion of the original Minecraft parity milestones.

## Weather, Sound & Grip — 2.1.0

| System | Status | Behavior / limits |
|---|---|---|
| First-person grips / crosshair | Implemented repairs | Separate narrow-handle, pistol, flat-sprite pinch and open-palm block grips; connected arm solver retained. Entire wrist/item stays behind the view camera near-plane guard through all actions. F5 flat items sit outside the solid palm. Both centered crosshair bars span the full 16px square. |
| Snow accumulation | Partial custom simulation | Eight persistent block states, actual mesh/bounds/raycast/step-up, roof collection, body-overlap prevention, heat/warmth melt, support removal, thin-snow replacement and host edit replication. At most four columns change each simulation second in loaded areas; accumulation takes minutes and caps at one block. No snowballs, snow-layer item/recipe, wind drifting or exact Java light/temperature rules. Existing full snow blocks retain their item/drops. |
| Weather hazards | Partial custom simulation | Natural rare events and owner/Creative weather controls. Seeded tornado path crosses the warning area; dense shells, instanced debris, player/creature/drop pull, lift and debris damage. Roof cover protects players. Buildings and loot are preserved; loose plants can be stripped. No full destructive fluid/structural model. |
| Creature / interaction sounds | Implemented original synthesis | 27 creature identities with distinct idle/attack/hurt/death articulations, three variants per event, distance filtering and wall muffling; 45 layered effect profiles plus material Foley. Lazy cached PCM, bounded active sources and cleanup. Original synthesized approximations, not sampled real animals or copied game sounds. Existing continuous ambience/music and original pistol reports remain. |

See the 2.1.0 README and VALIDATION.md sections for source changes, controls, launch instructions, testing and platform limits.

## Local Discs & Creative Stands — 2.2.0

| Feature | Status | Behavior / limits |
|---|---|---|
| YouTube jukebox | Removed | No URL field, iframe, loader or external video playback. Legacy metadata is retired on opening a jukebox. |
| Local MP3 discs | Implemented custom | Four reusable disc types, actual recipes, inventory insertion/ejection/drop/persistence, browser-local MP3 library, native playback, volume, pause, stop, no reload autoplay and background-music yielding. MP3 up to 32 MiB; one linked file per color per browser profile. |
| Disc sharing / co-op | Personal playback | Files stay outside world exports/relay. Hosts insert/eject; guests use their own local file for the inserted disc. No file streaming, shared playhead or automatic disk scanning. |
| Creative Stand menu | Implemented | Five selectable Stands in a dedicated Creative inventory tab, permanent Creative-world selection, host validation and co-op guest selection. Costs/cooldowns stay. No item/recipe provides a Stand in Survival; existing trial/fate logic is unchanged. |
| Performance / polish | Implemented targeted | Cached held-model bounds, 10 Hz Stand text, bounded jukebox checks, removal of video dock, selected-state buttons and Creative window label. CPU microbenchmark only; no new hardware FPS claim. |

2.2.1 applies the existing stone/pixel button styling to all new disc controls and Creative Stand selections.

## Classic Arm Repair — 2.2.2

Implemented: square, finger-free first-person arms; equal-width contiguous skin/sleeve sections; non-overlapping block gloves; fitted held-item sockets for tools, blocks, flat items and dual pistols; empty-hand camera-clearance bounds. Retained: smooth action/equip/sway/swim/recoil curves, F5 rigs, gameplay and all 2.2.1 features. The first-person arm is an original approximation, not exact reference animation/skin-UV parity. This visual patch does not add missing baseline mechanics.

## Skin & Grip Repair — 2.2.3

Implemented: held solid-block contact at the square hand tip through action poses; shared first-person/F5 costume palettes; visible sleeves with fixed hand length; costume-specific partial gloves including Bandit; validated shoulder-only chest armour. Hidden left pistols no longer receive block/flat-item offsets or expand the swimming-hand bounds. All non-view-model gameplay is retained. F5 geometry/materials remain identical in 110 sampled skin/held-item/armour configurations. Arm dimensions and view lighting remain original approximations rather than exact reference skin UVs or rendering parity.

## Oceans & Expeditions — 2.3.0

| System | Status | Shipped behavior / limit |
| --- | --- | --- |
| Continents / broader biomes | Implemented original generation | Generator 13 only; disconnected irregular landmasses, deep oceans, broader climate fields, all 13 existing biomes, retained caves/ores/mineshafts. Original noise, not Java-exact terrain. New world required; old recorded generators remain. |
| Village spacing | Implemented | New 1,536-block regions, minimum 1,024-block centers and dry full-footprint terrain checks. Existing regional village models/residents/defenders retained. |
| Boats | Partial | Five-plank table recipe, water launch, single-seat boarding, W/S propulsion/A/D steering, Shift dismount, buoyancy/collision, saved boats/riders, recoverable flat item, lava burning, oars and seated F5. No passengers/animal transport, boat-to-boat collision or exact reference momentum/ice behavior. 32 boats per dimension. |
| Sparse variable Cinderworld buildings | Implemented custom structures | Three distinct architecture families with seed-dependent rotation/dimensions/heights/palette/ruins/bonus loot; same larger spacing. Six defenders and rotated vault/loot gates persist. Lava seas require bridging or Creative flight; boats are water-only. No full jigsaw system. |
| Flying hostiles / returning fireballs | Implemented foundation | Ember Ray and Cinder Roc natural spawns, Creative eggs, articulated wings/voices, telegraphs, swept shots, melee deflection, six-tick recharge, player/passive-safe return damage and real drops. Four natural flyers, 48 projectiles. Local flight steering may get blocked by complex structures; no global navigation or terrain-destroying fireballs. |
| Biome weather frequency | Partial | Faster natural cycles in wet/cold/ocean regions, biome-appropriate snow/rain, dry deserts; snow accumulation and overrides retained. A shared saved weather clock follows the host biome, not independent regional cells. |
| Co-op boats | Partial | Survival host authority, client prediction, server-checked item use/ownership and private rider state. Public IDs never reveal reconnect tokens. Creative guests observe host-controlled boats; dimension travel restrictions remain. |

Other baseline missing/partial systems remain listed above. Minecraft mechanics reference stays Java 1.20.4; these new world/creature/structure designs are original additions.
