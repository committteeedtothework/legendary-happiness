# DCSMCRAFT

An original, playable browser voxel sandbox. **Current content reference: Minecraft Java Edition 26.3.** The earlier Survival foundation uses custom/simplified mechanics. This release is a **foundation**, not a complete Minecraft reproduction. It implements an interconnected early Survival loop and a Creative sandbox; major advanced systems remain missing. See [FEATURES.md](FEATURES.md) for the complete status and differences.

Game code, default procedural pixel textures, models, branding and synthesized sounds are original. Three.js provides WebGL rendering. The optional **Supplied Assets** pack contains user-provided Minecraft textures; see THIRD_PARTY.md and public/SUPPLIED-ASSETS-NOTICE.txt for attribution. This expansion imports factual registry names, recipes, tags and item-component values; no Minecraft code, models, fonts or shaders are imported. User-supplied menu and claim recordings are separately attributed in THIRD_PARTY.md. See [CONTENT.md](CONTENT.md) for provenance and limitations.

## Held Items & Building Performance — 2.7.11

Held objects now pivot at the bottom of the first-person view using their **visible silhouette**, including opaque pixels of flat icons. This closes the remaining gap for small items, tools and both pistols through use, mining and attack poses. A cached convex outline keeps frame work small; transparent effects do not reserve space. Equip animations lower and raise the anchored edge smoothly. Empty slots still show the selected skin arm at its existing pose; F5 and wardrobe models retain full bodies.

Ordinary block edits now mesh off-thread from transferable copies of already-loaded cells. Interior edits invalidate one chunk, edge edits two and corner edits four, including vertex AO and connected shapes. Edited meshes take priority over new terrain, pending jobs coalesce, and revision checks discard stale results. Simulation/collisions and saved edits update immediately; the visible mesh updates when its worker finishes. Explicit world bootstrap and worker-unavailable fallback still use synchronous meshing. This removes reproduced large edit stalls, not every possible source of dropped frames. See PERFORMANCE.md for controlled measurements and limits.

Existing worlds, generation 16, protocol 4, inventories, weapon geometry and music remain compatible. No new world is needed. Extract the Browser ZIP and open DCSMCRAFT.html, or extract the Windows ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows launch is untested on the Linux build host.

## Item Mount & Clearance — 2.7.10

Held objects now occupy the **lower-right area previously filled by the forearm**, with a closer camera mount and a mirrored position for the second pistol. The old invisible hand/arm no longer reserves space or pushes a held object away from the camera: item-only camera clearance uses the real item geometry, with a small safety margin for animated parts. Item use, swings, mining and pistol recoil retain their animation curves around the new position.

Empty slots show the selected skin arm at its existing position, including empty-handed swimming. F5/wardrobe models, weapons, skins, gameplay and saves remain compatible. Existing worlds work without regeneration. Extract the Browser ZIP and open DCSMCRAFT.html, or run the Windows ZIP's DCSMCRAFT.exe with Edge/Chrome installed. Native Windows launch remains untested on the Linux build host.

## Item-Only First Person — 2.7.9

Holding any block, item, tool or weapon now displays **only the held object** in first person. The skin hand, sleeve, glove and shoulder armor are hidden together, including both arms for Matthew's Dual Wielded Pistols and the swimming arm while carrying anything. Selecting an empty hotbar slot restores the selected skin arm; empty-handed swimming retains its arm animation.

This is a cosmetic first-person change. Item positions/animations, third-person F5 bodies, wardrobe previews, weapon models, skins, inventory, music and saves remain. Existing worlds work; no regeneration is needed. The single-file Browser ZIP and portable Windows ZIP remain offline-capable. Windows uses installed Edge/Chrome; native Windows launch is unverified on the Linux build host.

## Blocky Skins & 3D Outfit Chest — 2.7.8

All **11 existing skins** now share classic block proportions: an 8×8×8 pixel head, 8×12×4 torso, and 4×12×4 arms/legs, scaled to the existing 1.8-block player. Original nearest-filtered pixel faces, clothing, boots and costume details replace the narrow bodies and bulky raised decorations. Every character retains its name, palette and signature style; Devin's tunic/smirk, Dante/Vergil's coats, Moonwalker's visor, Ranger's hood/satchel, Smith's goggles/apron and the other costumes remain distinct. Cosmetic coat tails, Vergil's sheath and Moonwalker's pack are retained. This is original artwork, not an imported Minecraft skin/model.

Open **Skins → The Outfit Chest** from the title or pause menu. A live 3D view uses the same model as F5 and co-op. Previous/next arrows wrap through the outfits, direct buttons choose any skin, and arrow keys cycle while an outfit control has focus. Drag the model or use its turn buttons to inspect the back. Selection applies immediately and persists on this device. The menu adapts to narrow/short windows and respects Reduced Motion. It uses one preview context at a capped 30 FPS, reuses it when cycling, and releases it when the menu closes.

First-person hand/sleeve colors and texels match the selected outfit. Armor fits the new body, ordinary and dual-pistol grips follow their square palms, and existing movement/swimming/combat remain. Weapon geometry, audio, 18-track Creative/Survival playlists, gameplay, saves, generation 16 and protocol 4 are retained. Existing worlds work. Browser and Windows downloads remain self-contained; native Windows execution is unverified on the Linux build host. The earlier content backlog remains unfinished.

## Creative Soundtrack — 2.7.7

Adds the six supplied C418 Volume Beta recordings—**Aria Math, Dreiton, Haunt Muskie, Blind Spots, Taswell and Biome Fest**—as a separate **Creative-only Overworld** playlist. The 12 Volume Alpha tracks stay Survival-only. Each pool visits all its tracks before reshuffling, avoids consecutive repeats and uses the existing 8–18-second gaps. Switching modes pauses the old pool first and resumes each pool’s own song position; pause/mute/jukebox priority and quit/reload cleanup remain. Cinderworld keeps its original generated music. Use Options → Music: ON and the existing Music/Master sliders. All 18 original files are embedded unchanged for offline playback; only the selected song plays.

To keep downloads under the hosting file-size limit, the Windows ZIP carries the self-contained EXE once. OPEN-BROWSER.cmd and the hosting scripts ask that EXE to extract its embedded HTML to the same local game folder, without launching a second game window. No extra audio download is required. The Browser ZIP still contains a single playable DCSMCRAFT.html; the server ZIP carries the standalone HTML. The web-build ZIP omits unused duplicate source MP3 sidecars, because every recording is in its runtime JS. The source ZIP contains all original MP3s/manifests and regenerates the large embedded catalog automatically with Node during npm predev/prebuild/pretest; no Python installation is needed for those workflows. Existing worlds, sky/weather fixes, gameplay, generation 16 and protocol 4 are retained.

## Survival Soundtrack Expansion — 2.7.6

Adds eight supplied C418 recordings—**Dry Hands, Wet Hands, Mice on Venus, Key, Oxygène, Danny, Living Mice and Haggstrom**—to Clark, Sweden, Subwoofer Lullaby and Minecraft. All **12** now play **only in Survival Overworld**, in complete shuffled rounds with no consecutive repeats and the existing 8–18-second gaps. Creative Overworld stays silent; switching modes pauses/resumes the same recording and position. Cinderworld retains its original generated music. Options → Music: ON, Music volume and Master volume remain; existing preferences are preserved. All files are embedded unchanged for offline playback, with one native decoder active.

The larger soundtrack is packaged without redundant HTML copies: the Windows ZIP keeps DCSMCRAFT.exe, hosting tools and the browser fallback at Multiplayer-Server/dist/DCSMCRAFT-Standalone.html; OPEN-BROWSER.cmd opens it directly. The Browser ZIP still contains DCSMCRAFT.html. The web-build ZIP now contains the deployable Vite site; desktop and offline HTML have their own ZIPs. Full source/assets and dependencies remain included in the source package. Existing worlds, gameplay, sky/weather fixes, title splash, protocol 4 and generation 16 are retained. No new world is required.

## Steady Sky & Living Clouds — 2.7.5

Sun, moon and stars use a sky centered on the final camera position, so walking, jumping, crouching, view bob and F5 translations cause no sky parallax or previous-frame facing jitter. The sun/moon orbit still follows world time. Rain, snow and hail now occupy a world-anchored repeating field: you move through the particles rather than carrying them. Recycling occurs at faded volume edges; roof checks retain their 32-query/frame budget, and precipitation types/intensity blend instead of abruptly switching. Existing lightning and tornado paths remain world-anchored.

Clouds are layered original voxel formations in one instanced draw, with bright daylight tops, cool undersides, warm twilight and blue moonlight. They drift on their own wind clock; streamed cells never snap the entire sky at player chunk boundaries, and distant replacements blend into sky haze. Rain builds coverage; thunder/hail/tornado smoothly thicken and darken the banks. Opaque depth-tested cloud faces avoid transparency sorting flicker. Fancy Graphics adjusts shape detail; Clouds, Cloud Height, Sun & Moon, Weather Effects, Lightning Flashes and pause remain supported. Cloud shading is stylized, not volumetric ray tracing, and clouds do not cast terrain shadows. Existing saves, terrain, music, gameplay, generation 16 and protocol 4 remain unchanged.

## Supplied Overworld Soundtrack — 2.7.4

Replaces generated Overworld music with the four supplied C418 recordings: **Clark, Sweden, Subwoofer Lullaby and Minecraft**. Each track plays in full; a shuffle bag visits all four before reshuffling and avoids consecutive repeats between rounds. Quiet gaps last 8–18 seconds. Use **Options → Music: ON**, Music volume and Master volume. Existing saved preferences are retained, including Music being off by default.

The unchanged recordings are embedded in the browser HTML and Windows launcher for offline playback; no file picker, streaming service or separate music files are needed. The download is larger because it includes full tracks. Only the current song uses a native media decoder. Menus, mute, jukebox playback and leaving the Overworld pause the current song; returning resumes its position. Quitting/changing worlds releases it. Cinderworld retains original generated piano/bell music. Track progress is session-local and is not saved with a world. The manifest and embedding script make future additions straightforward; no additional songs are claimed in this release. Attribution/hashes are in THIRD_PARTY.md and public/audio/overworld/. Existing worlds, gameplay and the animated title splash remain.

## Right-Side Animated Splash — 2.7.3

Moves the randomized splash beneath the right side of the logo. Its 20-degree tilt and one-second scale cycle produce the familiar Minecraft-style pulse; reserved space keeps long lines away from the logo and buttons. All 24 lines, reduced-motion support, menu styling, audio, gameplay and saves remain.

## Title Splash Repair — 2.7.2

The title splash has dedicated space below the logo, with responsive wrapping and a smaller pulse so it stays clear of menu controls. Twenty-four game-related lines include the three requested Devin/Matthew quotes. A fresh random line appears whenever the title opens, without immediately repeating the previous one. Reduced-motion preferences are respected. Existing menu styling, gameplay, sounds, worlds, generation 16 and protocol 4 are retained. Browser and Windows ZIP launch instructions below still apply.

## Performance & Console Menu Audio — 2.7.1

Uses the supplied Select, Hover, Exit and Slide recordings for menu actions, with separate menu mute/volume. Adds eleven graphics controls and Fast/Balanced/Detailed presets. Removes repeated settled-terrain scans, saved-edit light scans, creature vector allocation and redundant cloud/resolution work. [PERFORMANCE.md](PERFORMANCE.md) documents the controls, measured workloads, audio mapping and limits. Existing saves, generation 16 and content remain; use matching 2.7.1 protocol-4 clients/relay. No new world is required.

Extract the browser ZIP and open DCSMCRAFT.html, or extract the Windows ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Singleplayer needs no server. Native Windows execution is unverified on the Linux build host. The prior remaining-content request is still staged and unfinished; OVERWORLD.md retains its backlog.

## Overworld Foundations I — 2.7.0

First stage of the remaining-content request, excluding new Nether/End content. Fixes cropped Creative block previews and unclear egg/item icons; adds feeding/breeding/babies for the five existing farm species, chicken eggs, sheep fleece regrowth, milk buckets and eleven functional enchantments (24 total). Existing world generation, custom content, supplied assets and old item/recipe indices remain. No regeneration is needed. Multiplayer connection tests now use the same shared protocol as the relay; use matching **2.7.0 protocol-4 clients/relay**.

**The full requested expansion is not finished.** [OVERWORLD.md](OVERWORLD.md) records completed behavior, simplifications and every remaining stage; [the scoped machine-readable backlog](reference/overworld-backlog.json) retains the named content remainder and Nether/End exclusions. Download/extract the browser ZIP and open DCSMCRAFT.html offline in Edge/Chrome, or use the Windows ZIP launcher. Native Windows execution is unverified on the Linux build host. Older sections below describe their historical release.

## Creative Menu — 2.6.1

Creative inventory now uses icon tabs above/below a compact gray pixel panel, a nine-column/five-row scrolling catalog, a visible draggable scrollbar, and the hotbar underneath. Categories separate Building Blocks, Colored Blocks, Natural Blocks, Functional Blocks, Redstone, Tools & Travel, Combat & Armor, Food & Drinks, Ingredients and Spawn Eggs. Search Items covers the entire catalog; Stands and Player Inventory & Crafting retain their own tabs and the crafting recipe book. Search works inside each category and accepts multiple words. Left/right/shift-click retain their original stack behavior; keyboard arrows navigate tabs. The catalog draws only nearby rows while keeping every item reachable.

This is a menu-only update to 2.6.0. Items, recipes, terrain generation, Survival and saves retain the same behavior. Use the new standalone HTML or Windows ZIP to get the new interface; older downloaded files cannot update themselves.

## Content Expansion I — 2.6.0

Adds **713 block types and 818 inventory items**, with original family geometry/art, tag-based recipes, new crafting materials/foods/crops, modeled equipment, bows/crossbows/a basic shield/mace, barrels, fast specialized furnaces, stonecutting and Netherite smithing. Catalog and recipe searches are paged. Existing custom weapons, creatures, supplied assets and saves remain. Generator 16 adds regional wood, deep stone/ores and Cinderworld resources to new worlds; old generators stay unchanged.

**This is a playable first stage, not every missing latest-version feature.** [CONTENT.md](CONTENT.md) documents behavior, simplified mechanics, Survival availability and the remaining compatible content. [The per-entry audit](reference/content-audit-26.3.csv) accounts for all 1,286 reference blocks and 1,658 items. The complete build has 2,625 block states, 1,124 inventory entries and 1,292 recipes. Added block/item counts overlap.

Save/open the standalone HTML locally, or extract the Windows ZIP and launch DCSMCRAFT.exe with Edge/Chrome installed. No local server is needed for singleplayer. Export a world backup before updating and use matching 2.6.0 relay/client downloads for multiplayer protocol 3. Native Windows launch remains unverified on the Linux build host. Older sections below are historical release notes; CONTENT.md describes the current content scope.

## Tornado performance & weather fixes — 2.5.1

Fixed storm-driven loading of distant terrain: weather now rejects far/unloaded bodies before roof or collision queries. Ordinary simulation also suspends unloaded item physics and remote persistent-NPC contact checks; items in loaded areas near Survival guests remain active. Unloaded drops keep their despawn timer until their area becomes active again. Existing worlds work without regeneration; generator 15, Aquatic content, inventories and terrain edits are retained.

Tornado particles now animate on the GPU with distance/quality budgets (512 All, 256 Decreased, 96 Minimal near the storm) and a capped screen size. The funnel uses a single transparent shell pass, bounded debris updates, frustum/distance culling and static particle buffers. Rain/snow particle roof queries are cached by terrain revision and limited to 32 per frame. Snow heat checks no longer load neighboring chunks. Lightning respects Weather Effects/Lightning Flashes toggles, reuses its buffer and refreshes correctly on realm or same-tick strike changes; low swimming poses receive proper shelter checks.

This fixes reproduced stalls, not every possible game issue or a universal FPS target. PERFORMANCE.json and VALIDATION.md record the controlled benchmarks and playtests. Launch instructions and all Aquatic simplifications below still apply.


## Aquatic Voyages — 2.5.0

Ocean climates, reefs/kelp, fish/dolphins/turtles/Drowned, wrecks/ruins/treasure, fishing/fish buckets, conduit/bubble columns, tridents/enchantments, Turtle Master brewing and sprint swimming are connected and playable. **Create a new world for ocean terrain/structures**; old saved terrain is preserved. Open **Pause → Ocean Journal** for controls/progression. The source-by-source implemented/partial/not-applicable audit is [AQUATIC.md](AQUATIC.md); this expansion does not claim exact reference parity.

Download the 2.5.0 Windows ZIP, extract it and run DCSMCRAFT.exe with Edge/Chrome installed, or double-click the standalone HTML. No local server is required for singleplayer. World saves belong to the browser profile; export backups before moving files/profiles. Build with `npm install`, `npm run build` / `npm run build:standalone`; `npm run dev` provides the development server. Internet co-op still requires the optional matching HTTPS relay; see MULTIPLAYER.md. Both supplied claim MP3s and supplied textures remain unchanged. Native Windows launch is unverified on the Linux build host.

## Matthew's Pistols claim cue — 2.4.1

The supplied **Devil May Cry 1 HD Remastered Title Video Let s Rock Baby (1).mp3** now plays once on the first successful Matthew's Dual Wielded Pistols altar claim in each world. The full unchanged 2.01-second stereo MP3 is embedded in the offline HTML and Windows executable. No external request, file picker or internet connection is needed. **Master volume** controls it, including changes during playback; background Music controls are independent.

The existing Hellspawn defeat/ready-state, host-only claim, reach, free inventory slot and single-reward rules are unchanged. Failed/full-inventory attempts, Creative grants, dropping/picking up the weapons and loading an already-claimed world do not play the cue. Muted claims do not queue sound for later. If MP3 decoding fails, the prior short rune cue is used without blocking the reward/save. The Devin Sword recording remains separate and unchanged.

**Existing saves work; no new world required.** Previously claimed altars remain claimed and do not replay this new cue on upgrade. All 2.4.0 animations, wildlife, terrain, mechanics and other sounds remain. Extract the **2.4.1 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Native Windows launch remains unverified on this Linux build host. Recording attribution/hash: THIRD_PARTY.md and public/audio/MATTHEW-CLAIM-NOTICE.txt.

## Living Worlds — 2.4.0

**Works with existing saves; no new world required.** Generator 14 terrain/caves and all prior progression remain. Mechanics reference remains partial/custom Minecraft Java Edition 1.20.4.

**Interactive world animation:** nearby chests are hollow boxes with hinged lids and attached latches. They ease open while a player views the inventory, remain open for every shared viewer, then ease shut with a soft close sound. Oak doors now swing smoothly around their hinges; their collision/state changes immediately and they remain open until operated again. Burning furnaces show flickering fire and optional sparks, enchanting tables have a floating book with turning pages that opens toward nearby players, and inserted jukebox discs are visible and spin during actual local playback. Shared chests, furnace burning and inserted disc visuals synchronize through the host without transmitting inventory contents, private resume credentials or local MP3 files in the visual packet.

These props are discovered during existing chunk meshing, including workers, and have their own articulated geometry. Rigid chest walls/door halves are batched; the rest of the terrain remains chunk meshes, not one render object per block. Up to 64 prop descriptors per detailed chunk are animated; excess props and distant/surface-only chunks keep static fallback geometry. Animation models are cleaned up on unload/world/texture changes. Animated Textures controls idle book/flame/disc motion; Minimal particles hides furnace sparks. Door/lid interaction feedback still eases normally. Chest orientation stays the existing fixed front; double chests, loot-item display and exact reference block-entity animation parity are not implemented.

**Interaction repairs:** a solid block above a chest prevents opening; host and guest container/crafting menus reject removed/replaced/out-of-reach targets before moving slots. Local stale-container menus close safely and return cursor/crafting items using existing rules. Chest collision, targeting and grounding now match its inset 7/8-block body. Workstations/containers open before a held bucket, egg or flint and steel is used; crouch to bypass their interaction. Linked door halves and existing obstruction checks remain. Crafting tables keep the recipe sidebar.

**More wildlife:** new Overworld populations try to seed 16 safe animals instead of eight. Up to four animals spawn every six simulation seconds, with a cap of 48 nearby living wildlife instead of the old 24; actual counts depend on suitable space. All 12 habitable land biomes have appropriate existing animals. Natural placement checks dry solid support, complete body clearance, nearby occupants and a safe radius, and stays bounded. Oceans do not receive land animals; aquatic wildlife is still missing. Rare hostile Savanna tigers remain on non-Peaceful worlds, while initial new-world populations and Peaceful spawns stay safe. Existing Cinderworld population rules are unchanged.

**Snow Leopards and Polar Bears** spawn in Snowy Highlands/Alpine and Snowy Taiga regions. Original voxel models have different silhouettes, four walking limbs, bounded head motion, idle tail animation, a jointed long leopard tail and separate original voices. Both are calm neutral animals: hurting one provokes short retaliation outside Creative/Peaceful, and the anger timer now expires for all neutral animals instead of remaining stuck. Snow Leopards have 22 health, Polar Bears 30. Both have Creative-only spawn eggs and persist with the world; Survival cannot obtain or use eggs. No cubs, breeding, hunting-prey ecosystem, swimming AI, hide/fur drops or full reference polar-bear behavior. These two animals drop no meat, like the retained panda/koala behavior.

Download/extract the **2.4.0 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Use matching 2.4.0 clients/relay for co-op. Existing dimension restrictions and shared-weather clock remain. Native Windows execution remains unverified on this Linux build host. The supplied Devin Sword MP3 remains embedded unchanged.

## Devin Sword claim audio — 2.3.2

The user-supplied **High Value Item Get The Legend of Zelda Breath of the Wild OST.mp3** now plays once when the Devin Sword is successfully extracted. The complete unchanged 5.46-second MP3 is embedded in the offline HTML and Windows executable; no external request or file picker is needed. It is a claim sound effect controlled by **Master volume**, independent of the background Music toggle/slider. Changing Master volume also changes a playing fanfare. Muted claims do not queue playback for later.

The existing Guardian/Sigil requirements, uninterrupted 30-second extraction, reach, inventory-space checks and one-sword reward are unchanged. Failed/interrupted/full-inventory attempts, generic relic interactions, Creative inventory grants, ordinary pickups and save reloads do not play the recording. Existing saves work; **no new world is needed**. If decoding is unavailable, the claim succeeds with the previous short synthesized cue. Other audio, terrain, caves, mobs and hand animations are unchanged.

The supplied recording is an exception to the game's original synthesized effects; attribution and source-file hash are in THIRD_PARTY.md and public/audio/DEVIN-CLAIM-NOTICE.txt. Extract the **2.3.2 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Native Windows launch remains unverified on the Linux build host.

## Connected Worlds — 2.3.1

**Create a new world for generator 14's terrain and caves.** Existing worlds keep their recorded generator and buildings. Boats, biome weather, the increased Cinderworld threat and first-person fixes work in existing saves too. Minecraft mechanics reference remains Java Edition 1.20.4; see FEATURES.md for partial/missing systems.

**One connected landscape:** continuous, warped land fields replace generator 13's isolated continental discs. Climate regions meet directly across broad stretches of land, with mountains, coasts, lakes and rivers between them. Oceans remain real water crossings, but are much shorter and less dominant. A Wildflower sample across ±4,096 at 32-block intervals measures **20.1% water**, a **128-block median crossing** and **608-block 90th percentile** along sampled east/west lines. These are sample statistics, not a universal maximum; wide seas can still occur. All 13 existing biomes remain. Cinderworld uses the same connected layout, with about **20.9% lava** in that sample, joined volcanic regions and shorter lava channels. Boats remain water-only. The wider village/structure spacing and varied guarded architecture from 2.3.0 remain.

**More dangerous Cinderworld:** up to three ground enemies spawn per three-second wave instead of the old one/two per five seconds, when safe unlit space exists 24–38 blocks away. Nearby live-hostile caps are 18/26/32 in Easy/Normal/Hard (including flyers and guardians); natural aerial spawning runs every five seconds, with a separate four-flyer Easy/six-flyer Normal/Hard limit. Hostile numbers stay bounded, Peaceful stays safe and torch exclusion/body collision checks remain. Spawn eggs/trials have their existing separate rules. Existing guarded vaults, Hellfire resources, loot and returnable fireballs are retained; no new loot tier is introduced.

**Wilder caves:** seeded branching routes bend in three to five sections with varying widths, slopes, dead ends and cross-level links. Caverns have rotated/elongated outlines, compound chambers, uneven floors and ceilings, occasional pillars, and different heights. Moss, dripstone and rift decoration, mineshafts, spaced ores, the Watcher and cave creatures remain. Cinderworld caves combine warped chambers and narrow twisting routes. Plans are evaluated in world coordinates for stable negative chunk borders and save reloads. This is custom generation, not Minecraft's noise-cave algorithm.

**First-person repair:** blocks rest close to the hand tip with less arm penetration; flat sprites sit at the actual grip rather than being offset away from it. Rigid item sockets, finger-free square arms, skins and smooth motions remain. The camera clearance guard now checks the solved forearm, sleeve, glove and armour shoulder as well as the cached held item. All held block/tool families are checked through their action cycles.

Download/extract the **2.3.1 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Singleplayer requires no server. Use matching 2.3.1 clients/relay for co-op; the existing co-op dimension restrictions remain. Native Windows launch remains unverified on this Linux build host.

## Oceans & Expeditions — 2.3.0

**Create a new world for generator 13.** Existing saves keep their recorded generator and terrain; importing/loading a world does not regenerate your buildings. Boats, aerial creatures and biome-weighted weather also work in existing saves. The reference remains **Minecraft Java Edition 1.20.4**, with the partial/custom mechanics described in FEATURES.md.

**Overworld:** large, irregular, seeded landmasses sit in deep oceans with continuous sea corridors between continental regions. Climate fields are much broader, with all 13 existing biomes, coasts, mountains, river valleys, inland lakes, trees and the retained cave/ore/mineshaft systems. New village regions are 1,536 blocks wide with **at least 1,024 blocks between centers**, and the whole village footprint must be on suitable land. Spawn height is checked against real terrain, including broad deserts. The Wildflower sample has about 83.5% ocean and mean continuous land-biome runs of 227 blocks versus 79 in generator 12; these are measurements of one seed/sample, not universal guarantees.

**Oak Boats:** craft five planks in a U at a crafting table. Right-click open water to launch, then right-click the boat to board. **W/S paddle, A/D steer, Shift dismounts**; mouse look remains free. Boats accelerate to about eight blocks/second, float at the fluid surface, collide with terrain, persist with their riders, animate their oars and have a seated F5 pose. Break one to recover a single reusable item; wood burns in lava. Inventory/dropped boat items stay flat pixel sprites. Up to 32 boats per dimension are retained. One player per boat; animals/passengers, boat-to-boat collision, exact reference momentum and ice racing are not implemented.

**Cinderworld:** generator 13 adds broad volcanic regions and extensive lava seas. Structures use the same wider 1,536-block regional spacing/minimum 1,024 separation. Citadels, cathedrals and foundries now have distinct layouts, seeded orientation, dimensions, tower/chimney heights, ruined wall sections, material palettes and bonus loot. Their six persistent defenders, sealed vaults and Cinder Sigils remain functional across rotations/saves. Water boats cannot cross lava: bridge it or use Creative flight. These are three procedural architecture families, not reference jigsaw generation.

**Ember Rays and Cinder Rocs** fly, wander/chase, avoid solid geometry and launch telegraphed fireballs. Aim at a nearby fireball and **left-click with an empty hand or melee item** to return it; the reflected shot turns cyan and can damage the shooter. Parry recharge is six simulation ticks. Returned shots spare players/passive creatures, and the original Guardian/Titan bullet immunity remains. Both creatures have original models, wing animation, voices, drops and Creative-only spawn eggs. Natural flyers are capped at four; Peaceful removes them and Creative players are not targeted. Flight uses local collision steering rather than global pathfinding; wings/hitboxes are approximate. Fireball impact has damage/visual effects but does not destroy terrain or start spreading fires.

**Weather:** natural clear periods pass faster in jungle/marsh (3×), snowy regions (2.2×) and oceans (1.5×) than ordinary regions. Cold precipitation renders as snow and accumulates using the retained snow system; wet climates favor rain/thunder and deserts do not start natural storms. Weather still follows one saved world clock influenced by the host's current biome, not independent weather cells for every player. Manual overrides remain available.

Singleplayer is offline. Survival co-op boat placement, ownership and movement are host-authoritative, with client prediction, public ownership IDs, safe dismount and no item duplication; reconnect secrets never enter replicated entities/projectiles. Creative guests observe host-controlled boats. Existing co-op dimension-travel restrictions remain. Download/extract the **2.3.0 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Native Windows launch remains unverified on this Linux build host.

## Skin & Grip Repair — 2.2.3

Corrects the **floating held-block regression in 2.2.2**. First-person blocks now fit around the actual square hand contact point, including during placement and mining. Modeled tools/pistols use that same hand socket; ordinary sprites stay flat. No finger geometry is reintroduced. Smooth action curves are retained.

First-person arms now share the **selected F5 skin's sleeve, skin and glove palette**, with a fixed exposed-hand length rather than an exposed section that grows with the off-screen arm. The slightly raised resting pose keeps sleeves visible even while idle, and Dante/Vergil/Bandit retain their appropriate glove colours and exposed skin. Chest armour covers the shoulder rather than repainting the entire sleeve; invalid non-armour equipment cannot tint it. F5 shapes/materials and all gameplay remain unchanged. Existing worlds work without regeneration.

Download/extract the **2.2.3 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. See VALIDATION.md for contact checks, skin comparisons and browser playtests. Windows launch remains unverified on this Linux host.

## Classic Arm Repair — 2.2.2

First-person hands return to a simple **square voxel arm**. Separate finger bars, knuckles, thumbs and oversized pistol grips are removed. Skin and sleeve have equal widths and meet exactly along one axis; gloved skins replace the skin section instead of stacking intersecting meshes. Item sockets are fitted to the block hand, including both pistols. Empty hands and held items retain conservative camera clearance. Smooth action curves, sway, recoil, equip transitions and swimming remain.

This is a first-person visual repair for existing worlds. World generation, saves, combat, damage timing, controls, item models, sounds, local discs, Creative Stands and F5 player animations are unchanged. No new world is needed. Download/extract the **2.2.2 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML.

See VALIDATION.md for automated geometry and browser playtests. Native Windows execution remains unverified on this Linux build host; the executable contains the tested HTML byte-for-byte.

## Local Discs & Creative Stands — 2.2.1

YouTube playback, URL entry, iframe/dock and the external player loader have been removed. The jukebox now holds **one reusable music disc** and plays a local MP3 selected by you. Four disc types (Amber, Azure, Moss, Rose) each remember one MP3 in this PC/browser profile. Importing a file replaces that disc type’s local track across your worlds. Right-click a placed jukebox, choose a disc, select its MP3, insert an owned disc and press Play. Right-click while holding a disc inserts it directly. Volume multiplies master volume; Pause/Resume, Stop and Eject work. Other menus pause playback; returning resumes only previously playing audio. Background game music yields while a disc is playing. Nothing autoplays after reload. Removing the jukebox drops the inserted disc and stops its player.

MP3s up to **32 MiB** are copied into a separate local IndexedDB library. They never enter world exports, HTML downloads or multiplayer packets. On another PC/browser/profile, relink files using the picker; the game cannot read arbitrary disk paths. If browser storage is denied, imports are labelled session-only. Decode/storage errors are shown in the menu. Co-op hosts control insertion/ejection; guests can listen to the inserted disc using their own local MP3 mapping. Audio is personal and unsynchronized, not streamed from the host.

Craft **Amber Disc** at a crafting table using four paper and one coal. Craft Azure from Amber + lapis lazuli, Moss from Amber + seeds, or Rose from Amber + poppy. Recipes are shapeless and use the existing recipe sidebar. Discs have a stack limit of one and support normal inventory, containers, dropping and saves. All four discs are also in the Creative catalog. Old jukebox links become an empty disc slot when opened; unrelated containers and block IDs stay intact.

**Creative Inventory → Stands** gives direct access to Tusk, Oh! Lonesome Me, Scary Monsters, Cream Starter and D4C. Choose Equip Stand, close the inventory, then use H/F/G/V. Selection persists and works through host authority for Creative guests. The server rejects Creative grants in Survival; Survival still requires the existing Palm trial/fate progression. Energy, ability costs and cooldowns are retained. Switching out of dinosaur form requires sufficient headroom.

Smoother code: the first-person camera guard caches rigid item bounds at equip instead of traversing all meshes each frame, with conservative recoil/glint padding; Stand text refreshes at 10 Hz instead of every rendered frame; an idle jukebox does no per-frame work, active checks are bounded at 10 Hz, and the external video player is gone. The bounds CPU microbenchmark is recorded separately; it is not a hardware FPS claim. Menus retain the existing pixel style, now label Creative Inventory correctly and display selected Stands clearly.

Extract the **2.2.1 Windows ZIP** and run DCSMCRAFT.exe with Edge/Chrome installed, or save/open the standalone HTML. Singleplayer is offline; use the matching relay/client for co-op. Existing worlds retain generator 12 and the partial Minecraft Java 1.20.4 mechanics reference. Native Windows execution remains unverified on this Linux build host.

## Weather, Sound & Grip — 2.1.0

Works in existing worlds. Repaired the four-arm centered crosshair and added open grip profiles for tools, sprites, blocks and dual pistols. Fingers now leave room for the actual item, blocks rest above the palm, flat sprites remain flat, and a camera-space guard keeps all held geometry clear of the near plane during every action. F5 flat-item grips also sit outside the solid palm. Weapon damage and abilities are retained.

**Snow accumulates** in cold biomes during precipitation, in eight one-eighth-block states with real collision/targeting, step-up, chunk meshing, saved edits and co-op synchronization. Exposed roofs collect it; sheltered ground stays dry. Warm conditions or nearby torches/fire/lava melt one layer at a time. Support removal clears unsupported layers, and building can replace thin snow. A bounded pass changes at most four columns per simulation second around loaded players. Accumulation takes minutes, caps at one block above the supporting surface and does not generate distant chunks. This is a custom simplified model, not exact Java snow/light rules. The snow block item remains available; accumulated thin layers currently drop no item.

**Tornadoes** occur naturally among seeded severe weather events or through Creative Weather / owner `/weather tornado`. A warning precedes a seeded path crossing the area; the storm does not home in on players. A solid-looking rotating funnel and bounded flying debris replace the faint dot outline. Exposed Survival players are pulled/lifted and hurt by debris; solid roofs shelter them. Creatures and drops are caught too. Buildings, containers and terrain remain intact; only loose decorative plants may be stripped. Weather Effects and particle settings control visuals. Cinderworld retains its own environment.

**Original sound overhaul:** species-specific non-verbal animals, bone clatters, spider chitters, zombie groans, spectral Cinderworld voices, molten bubbling and Titan rumbles. Idle/attack/hurt/death each have distinct articulations rather than only playback-rate changes. New layered PCM effects cover menus, combat, doors, water, crafting, explosions, thunder, portals, Stands and more. Nine Foley materials include snow/ice, metal and water; pitch/contact variations reduce repetition. Creature audio is spatial, distance-filtered and muffled behind obstacles. Voice/effect variants are cached on demand; active one-shots are capped and cleaned up. Existing continuous ambience, music controls and the reference-informed pistol reports remain. All new audio is original synthesis, not recordings from Minecraft or other games.

Download the 2.1.0 Windows ZIP, extract and run DCSMCRAFT.exe with Edge/Chrome installed; or save/open the embedded standalone HTML. No singleplayer server is required. Use the matching 2.1.0 relay for co-op. Controls and world saves are retained. Native Windows launch remains unverified on the Linux build host.

## Devil’s Palm & Stand Awakening — 2.0.0

A functional supernatural expansion for **existing and new worlds**: rare seeded hand-shaped block formations, moving active regions, 60-second survival trials, configurable 35% Stand / 50% death / 15% neutral fate, permanent per-player ownership, pity and rare relics. Five Stands have real energy-limited abilities: Tusk, Oh! Lonesome Me, Scary Monsters, Cream Starter and D4C. Terrain edits, chambers, outcomes, ownership and guest profiles persist. Co-op uses the existing authoritative host and relay; no dedicated simulation backend is added.

**H** summon/dismiss · **F** primary · **G** secondary · **V** details. R keeps its weapon abilities. Configure personal keys and owner world rules in **Options → Devil’s Palm & Stand Options**. Look for environmental abnormalities; there is no exact map marker. Creative is protected from fatal rejection by default. Keep Inventory is an optional saved rule, OFF by default.

Read [STANDS.md](STANDS.md) for all abilities, costs, controls, default probabilities, relocation safeguards, server behavior, development commands, source-file map and clearly labelled limits. The Stand concepts are inspired by Steel Ball Run; new code, models, icons and audio are original. Generator 12 and the Minecraft Java 1.20.4 mechanics reference remain unchanged. Full Acts/quests, Luck, Hardcore and PvP are not implemented.

Download the **2.0.0 Windows ZIP**, extract and double-click **DCSMCRAFT.exe** (Windows 10/11 x64 with Edge/Chrome installed), or open the included standalone HTML. Singleplayer needs no server, account or ChatGPT. The optional **2.0.0 relay ZIP** serves the new client for friends. Export your world backup before changing browsers/profiles or moving the file; saves belong to the browser origin. Native Windows execution remains unverified on this Linux host.

## Pixel & Grip — 1.9.1

A presentation update for existing worlds, retaining the Java 1.20.4 mechanics reference and generator 12. Options/pause screens now use the game backdrop, with shared stone bevels, pixel sliders, square checkboxes, dropdown arrows, clearer inventory tabs, recipe cards, tooltips, furnace flames and crafting arrows. Options sliders use two columns on desktop and one on narrow screens. The crafting-table recipe sidebar remains available.

**103 original item icons** replace bulky fallback silhouettes with distinct 16px cutouts: ordinary tools, armor, gems, raw ores, ingots, food, buckets and materials. Renewed uses the new artwork; Supplied Assets retains its native images and uses new original artwork only for unmapped custom items. Classic and Soft retain their previous icons. Ordinary items remain genuinely flat in hand and when dropped; building blocks and modeled weapons keep their geometry.

First-person forearms now connect the palm to a fixed elbow below the screen through swings, thrusts, mining, item use, equipping, swimming and independent pistol recoil. Only the forearm sections adjust length; hands, grips and held items remain rigid. Weapon shapes, combat timing/damage, pistol abilities/audio, world generation and save formats are retained. F5 uses its existing articulated player rig. These are original visual designs, not exact reference UI or animation parity.

Download the Windows ZIP, extract it, and double-click **DCSMCRAFT.exe** (Windows 10/11 x64 with Edge or Chrome installed), or open the included standalone HTML in a desktop browser. No server is needed for singleplayer. Export a world backup before changing browser/profile or moving the game; local storage belongs to that browser. Native Windows launch cannot be verified from this Linux build machine.

## Field & Form — 1.9.0

A visual repair and creature-model release for **existing worlds**. No new seed, generator or progression reset is required. Mechanics reference stays Minecraft Java Edition 1.20.4 with partial parity; the imported artwork does not change mechanics.

**Overworld creatures:** all 16 current Overworld types have original storybook voxel designs: pigs, sheep, cows, chickens, rabbits, pandas, koalas, tigers, villagers, Iron Golems, zombies, creepers, skeletons, spiders, Devin Guardians and The Watcher. Shapes use distinct proportions, layered fleece/feathers/armor, blocky faces, restrained palettes and connected joints rather than realistic faces. Two retained legacy shade/stalker save types use palette variants of the wanderer rig. Villagers retain all eight village palettes and their farmer/mason/shepherd details, with connected folded sleeves/hands. Tiger tail stripes now belong to the moving tail. Cinderworld creatures and Matthew's pistol models remain unchanged.

**Neck repair:** villagers track the player within **±60° yaw and ±0.32 radians pitch**, using wrapped, bounded local angles and smooth interpolation. They cannot rotate their heads around their bodies or accumulate whole turns. Other creature head tracking uses the same limits; body steering and AI are unchanged.

**Flat items:** all **97 ordinary item/plant/door sprites** use a single double-sided, alpha-tested plane in first person, F5/co-op appearances and when dropped. There are no cuboid sidewalls, repeated side textures or extruded pixel blocks. Dropped sprites face the camera and retain the existing bob toggle. Solid building blocks, modeled tools/weapons, The Devin Sword and Matthew's pistols keep their actual geometry. Inventory, durability, ignition, placement, drops and pickup retain their gameplay rules. World doors remain thick, hinged panels with their existing collisions.

**Supplied Assets repairs:** furnace and crafting-table fronts no longer repeat on every side; additional directional faces use spare atlas cells. Chests use fitted lid/body/latch crops from the supplied chest sheet instead of an unrelated fallback. Torch world faces sample the actual wooden shaft/tip rather than stretching transparent icon margins over a cuboid; the inventory sprite keeps its original cutout. Narrow door edges sample solid frame pixels while broad faces retain their windows and upper/lower halves. Bamboo and cobwebs render as crossed cutouts; flat rails have no stretched sidewalls. Plant/door inventory sprites now use appropriate flat artwork, including supplied cane/bamboo/door icons. Pack switching invalidates old mesh jobs and remeshes both local and worker-built chunks, so directional UVs cannot stay stuck on the previous pack. Far terrain uses the same face rules.

The pack now preserves **189 source PNGs**, including one chest UV sheet, with **191 baked 16px images**, **110 mapped block states** and **97 imported item icons**. Original PNGs and crop/hash provenance are under `public/supplied-pack/`. Original Renewed/Soft/Classic packs remain selectable, and Renewed remains the default. Unsupported custom art and the existing bed art retain their original fallback. Animated source strips still use frame zero with existing fluid shimmer; complete animation metadata, resource-pack models and exact reference block orientation/geometry remain partial. Workstation fronts use the game's fixed north-facing orientation. See THIRD_PARTY.md for Mojang/Microsoft asset attribution and VALIDATION.md for testing.

## Supplied Assets texture pack — 1.8.1

Open **Options → Video Settings → World detail → Texture Pack → Supplied Assets — Minecraft textures**. The choice applies immediately and stays saved in this browser. Renewed remains the default; Renewed, Soft and Classic can be selected again at any time. Existing worlds work without conversion or a new generator.

The uploaded `assets.zip` contributes **183 native 16-pixel PNG textures**: supported terrain and ore faces, upper/lower doors, workstations, foliage, fluid surfaces, rail/cobweb decoration, common item icons, standard tools/armor icons and available vanilla creature eggs. Source PNGs and a coverage/provenance manifest are included under `public/supplied-pack/`; `scripts/import-texture-pack.py` reproduces the embedded synchronous pixels using Pillow (asset-development only). Biome-tinted source textures receive explicit base colors and keep the existing biome shading. Alpha holes remain transparent. All data is embedded in the HTML and Windows payload; there is no CDN or first-use texture download.

**Partial texture coverage:** unmapped custom blocks/items retain Renewed art. The Devin Sword, Matthew’s pistols, custom equipment, creature skins, weapon geometry, menus, chest/bed models and audio retain their existing designs. Standard weapon/armor inventory icons use the supplied images; existing modeled weapons and worn armor keep their original materials. Animated PNG strips use frame zero; the existing fluid shimmer toggle remains functional, but full resource-pack animation metadata is not implemented. This imports selected texture artwork, not the archive’s block/item JSON, shaders, text, models or new gameplay. The mechanics reference stays Java 1.20.4; the supplied artwork’s archive version does not change mechanics.

## Forge & Motion — 1.8.0

This is a cosmetic model/animation overhaul for **existing and new worlds**; **no new world is required**. Generator 12, combat statistics, mining, recipes, controls, fluids, saving and progression are retained. Reference inspiration remains Java 1.20.4; original models and animations are not extracted reference assets or exact animation parity.

All **42 non-pistol weapon/tool variants** now use thin, stepped pixel silhouettes with material-specific edges, highlights, guards and consistent palm sockets: seven material tiers of sword/axe/pickaxe/shovel/hoe, six spears and The Devin Sword. Models share the same geometry across first person, F5, dropped items and co-op appearances. Each rigid ordinary weapon uses one merged draw batch rather than one render object per pixel. Spears, Hellfire and Devin equipment remain original additions beyond the reference.

**The Devin Sword** now follows its broad turquoise hotbar silhouette, with raised blade ridges, a gold guard and wrapped golden grip. Its icon's grip is updated to match. The planted temple sword uses that same model; the existing target cell, all-Guardians requirement, Sigil and uninterrupted 30-second extraction are retained. Three small anchored glints and a slow blade sheen replace orbiting fragments and idle motes across the aim. Combat has a short cyan trail and fewer concentrated impact sparks. **Minimal particles** hides glints, sheen and trails, including on dropped and co-op swords. Its damage, healing, Pulse and Seeker abilities are unchanged.

**Flint and steel** is a flat, double-sided alpha-cutout item in hand and when dropped. Its transparent hole stays open, without textured cuboid edges or thick voxel extrusion. Ignition, portal lighting and durability remain functional. Working block models and the other ordinary item models remain unchanged.

Non-pistol player rigs add elbows, hand-attached grips, distinct slash/thrust/chop/dig/scoop/rake motions, subtle weight transfer and smoother carrying, jumping and crouching. In water, the player paddles in first person and uses prone strokes while moving, continuous upright treading while still, and a smooth land transition in F5. Fully submerged movement retains the pose near the bottom; wading and Creative flight do not trigger it. Swimming phase survives ordinary held-item changes, and co-op appearance packets carry validated water/ground flags. **Space still swims upward.** These are visual poses: the authoritative upright collision body and existing water physics remain unchanged; near walls, a horizontal visual limb may overlap terrain. Wind-up animation does not delay the existing click damage.

**Matthew's Dual Wielded Pistols are excluded:** their models, independent recoil, firing/F5 poses, original player rig, sounds and Trickster moves remain. Their retained player stance is an intentional exception to the new non-pistol articulation/swimming rig. Published-v1.7 geometry, pose and motion fingerprints are checked in tests.

Cinderworld's **emberling, basalt crawler, cinder wraith, dread knight, soul reaver, magma maw and Mad Titan**, plus the neutral **cinderback**, now have distinct coal-imp, split-carapace, shrouded-mask, asymmetric-armour, soul-prism, hinged-jaw and broken-crown silhouettes. Jaws, pincers, trailing mantles and attack poses are articulated; rigid details are batched. Damage flashes now restore original emissive eyes/cores instead of clearing them to black. The peaceful ash deer, Overworld creatures and Guardian design retain their existing looks. Enemy stats, attacks, hitboxes, drops and progression are unchanged.

## Cave Update — 1.7.0

Create a **new world** for generator 12: large hollow halls, tall dripstone vaults, moss grottos and deep rift caverns, linked by winding tunnels and occasional sloping surface entrances. Rare abandoned mineshafts cross some caves, with timber supports, cobwebs that slow movement, flat decorative rails and two persistent supply chests. Rails do not support minecarts; dripstone uses cubic decoration rather than falling-spike mechanics.

Overworld ores now form separated, seeded veins instead of dense independent block placements. Diamond deposits are small and uncommon, between **Y −56 and 8**, becoming rarer toward the upper end. Coal, iron, copper, gold, lapis and emerald have their own height ranges and spacing. This is original generation, not Minecraft's exact ore distribution.

Dark underground passages can spawn **zombies, skeletons, creepers and spiders during the day** in Survival. Torches and nearby bright sources suppress spawning locally. Spiders in dark caves remain aggressive by daylight. Lighting checks approximate nearby source brightness; they are not full reference light propagation. Peaceful disables natural cave hostiles.

**The Watcher** is a rare, harmless cave stalker with pale skin, distorted long limbs and lifeless black eyes. It watches from a distance, slowly follows while unseen, and gives an original unsettling laugh when you catch its gaze with clear line of sight. It cannot take damage or drop loot/XP, never attacks, and retreats from light, close approaches or sustained observation. Natural encounters have a grace period and cooldown; absence in a short visit is normal. Its appearance state persists. Depth-aware dark fog and smoothly dimmed underground lighting hide distant unloaded passages without changing surface skies. Original cave drones, irregular drips/echoes and creaks blend continuously into the biome soundscape; surface nights gain a calmer eerie undertone. Ambience and creature-volume controls still apply.

**Creative spawn eggs:** press E and search `spawn egg` to find all 24 passive, neutral, hostile and special creature types, including The Watcher. Right-click a supported clear space within reach. Eggs are unlimited, have no recipes or Survival drops, and cannot be used in Survival. The Watcher egg is limited to one living Watcher. A Creative-spawned Watcher stays for viewing instead of using the natural encounter's disappearance rules. Ordinary creature/boss AI remains the existing local steering, not reference pathfinding.

Existing generators **2–11 retain their terrain**, including unexplored chunks. Their caves can receive the new hostiles, Watcher and ambience, but the new layouts, mineshafts and ore distribution require a new world. Cinderworld terrain, Guardian collection requirements, the Titan trial, multiplayer and prior progression remain. New generator-12 multiplayer guests now join correctly; the supported-generation check no longer stops at 11. The game remains host-authoritative, with existing shared-dimension/co-op limits. Export a world backup before upgrading, and do not reopen updated saves in older builds.

## Guardian collection gate — 1.6.1

The planted Devin Sword in temple worlds now requires **all three distinct temple Guardians to be defeated**, including in Creative and Peaceful. Duplicate/invalid defeat entries and stale records with living Guardians cannot unlock extraction. The inner seal no longer opens just because the mode or difficulty changes. Peaceful keeps Guardians dormant; return to another difficulty to fight. Saved legitimate defeats still count, and the normal 30-second extraction and Cinder Sigil rules remain. Already claimed swords stay claimed; older pre-temple worlds keep their original relic behavior. Creative catalog items and owner commands remain Creative/cheat tools.

## Titan's Grasp update — 1.6.0

Matthew's pistol incursion now has two **84-HP Soul Reavers**, a **120-HP Dread Knight** and an **88-HP Magma Maw**, with 20% stronger attack damage. Existing living legacy guards receive proportionally increased health once; dead guards and claimed rewards stay completed. The sealed orb fires random straight bullets (6 base damage) every 0.8–1.75 seconds. Shots collide with bodies and walls; the orb disarms after all four defenders fall.

In single-player Survival, standing near a tentacle gives it a **25% grab chance per five-second check**. A two-second warning lets you move away or take cover. If its grip completes, you are physically pulled into **Cinderworld's Titan prison**. **A Mad Titan** has 320 HP, 25% damage resistance, complete bullet immunity, strong melee and four visible, telegraphed special attacks. Jump over ground slams, dodge marked blasts and charges, and use melee or magic. A recovery alcove contains one set of equipment and food; death respawns you there without resetting the boss. Defeat it and right-click the alcove's return rune to escape, then finish the original pistol encounter. Titan victory grants 30 bonus XP and four Hellfire ingots once.

Trial progress, supplies, boss health and the original encounter persist across reloads. Ordinary portals cannot bypass the prison. Peaceful pauses it without granting victory; resume another difficulty to continue. The arena reserves untouched distant Cinderworld space and does not replace terrain generation or player buildings. Existing saves work; **no new world is required**. Each world can trigger this abduction once. **Co-op retains the stronger guards and orb bullets, but abduction is single-player only** because independent dimension travel remains unavailable.

## Infernal Kingdoms update — 1.5.0

New Cinderworld realms use **generator 11**: six volcanic regions with deep lava rifts, enormous ridges, towering basalt teeth, skeletal emberwoods, Bloodglass Calderas and Valleys of Souls. Three original strongholds — the **Citadel of the Damned**, **Cathedral of Souls** and **Hellfire Crucible** — span 53–61 blocks across, with 44–64-block towers, open naves, buttresses, lava channels and sealed vaults. The pause menu's **Cinderworld Expedition** lists nearby structure coordinates.

Each vault has **six persistent defenders**: armored **Dread Knights** with a telegraphed, jumpable ground slam; **Soul Reavers** with aimed three-bolt volleys; and charging **Magma Maws**. Existing peaceful ash deer, neutral cinderbacks, crawlers, emberlings and wraiths remain. Defeat every defender to open the amber vault ward. Survival players cannot bypass the encounter by mining its chest. Defeats and emptied chests persist without respawning guards or regenerating rewards. Loot includes enchanted Hellfire swords (Sharpness IV), pickaxes (Efficiency IV), or chestplates (Protection III), each with Unbreaking III, plus alloy, diamonds, supplies and a **Cinder Sigil**.

New Overworld temples require that Sigil: hold it and right-click the **front cyan ward or its runestone arch** to consume one key and permanently open the approach. Cross the narrow bridge over the lava moat, then defeat all three Guardians to release the inner seal. Fresh Guardians now have **140 health**, retain **35% damage reduction**, completely **deflect pistol bullets**, and deal **12 base melee damage** with stronger special attacks. Enchanted blades, spears and magic remain effective. The existing uninterrupted **30-second sword extraction** and unique reward remain. Creative and Peaceful retain Cinderworld vault and outer-approach bypasses; planted sword extraction still requires all three Guardians.

The wardrobe adds an original **DMC3-inspired Vergil** costume: swept silver hair, silver-embroidered blue coat with animated tails, black gloves and a cosmetic sheathed katana. It persists with settings and works in F5 and co-op. The skin grants no weapon or abilities. No extracted character models, textures, voices or music are included.

**Save compatibility:** generators 2–10 keep their exact terrain, including unexplored chunks. Create a **new world** for the fortified, Sigil-gated temple. A previously unvisited Cinderworld gets generator 11; previously visited realms preserve their old terrain. Guardian bullet immunity/damage and the new skin also work in older worlds. New content must not be reopened in older builds. AI remains local steering rather than full dungeon navigation; Cinderworld dimension travel remains unavailable during co-op. Export world backups before upgrading.

## Open Skies HTTPS update — 1.4.1

**HOST-PUBLIC.cmd** now starts a public HTTPS/WSS relay through an optional Cloudflare Quick Tunnel. Install Node.js and cloudflared once, run the launcher, wait for its verified ready address, then enter that address under Multiplayer → **Public HTTPS** in your existing game. Host your world and share its invitation. The launcher checks HTTPS and WSS, writes PUBLIC-RELAY.txt, and stops the relay/tunnel together. It requires internet and contacts Cloudflare only when explicitly run.

The multiplayer menu adds Public HTTPS / Local-LAN choices, a connection test, saved relay addresses and an encrypted-connection label. For permanent servers, Node can also serve HTTPS/WSS directly using TLS_CERT_FILE/TLS_KEY_FILE, alongside the existing reverse-proxy setup. These additions retain Survival/Creative co-op, chat, owner commands and game mechanics.

**Quick Tunnel addresses are temporary and change on restart.** Keep the hosting process and owner's game open. A changed address/browser origin creates a new guest profile; ongoing guest inventory persistence needs a stable relay address. Existing desktop worlds remain in their original save profile when connecting from that game. The utility is an external install and is not bundled. Live Cloudflare access is blocked by this environment (HTTP 403), so the actual provider tunnel is unverified; native encrypted HTTPS/WSS and the launcher lifecycle are tested separately. See [MULTIPLAYER.md](MULTIPLAYER.md) for installation, limits and permanent HTTPS hosting.

## Previous Campfire Co-op update — 1.4.0

**T** opens in-game chat; **/** opens the owner's command prompt; **Tab** opens session/players. Chat uses a compact history and recent-message HUD. The world owner can use `/help`, `/list`, `/seed`, `/time`, `/weather`, `/difficulty`, `/give`, `/tp`, `/heal`, `/spawn`, `/kick` and `/save`. Guests cannot execute owner commands. Quote player names with spaces.

**Survival multiplayer is now a playable Overworld beta**, alongside Creative: host-controlled movement, mining time, inventories, crafting, shared chests/furnaces, tools, equipment, hunger/oxygen/damage, drops, hostile targeting, death and respawn. Private guest profiles save with the host's world and can resume in the same browser/relay after a new invitation. This is not a dedicated simulation server: keep the owner's game and Node relay running. AI/spawning remain concentrated around the host, and guest trading/enchanting, style movement, unique sword extraction, independent dimensions and PvP remain unavailable.

Friends on different networks can use a **publicly reachable HTTP(S)/WebSocket relay**. New `PUBLIC_URL` support, Docker/Caddy/Compose files, an optional Render Blueprint and a connectivity checker are included. There is no automatic cloud deployment or router opening. See [MULTIPLAYER.md](MULTIPLAYER.md) for Windows setup, internet hosting, commands and limits. Internet deployment and multi-network reachability were not available to verify here; local tests use independent browser clients over the real relay.

## Previous Jukebox update — 1.3.4 — Historical, removed in 2.2.0

Local MP3 discs replace this historical feature. See the current 2.2.0 section.

Craft a **Jukebox** at a crafting table with eight planks surrounding one diamond, or choose it from the Creative catalog. Place it and right-click, paste a YouTube video link and press **Play link**. The official visible YouTube player remains in a corner during gameplay. Escape → **Jukebox · YouTube player** releases the mouse and opens its controls; other menus pause playback. You can also listen temporarily from that pause-menu button without placing a block. Stop playback removes the player. Your original game-music toggle remains separate.

Block links and jukebox volume save with the world; playback requires a new click after reload. Master volume/mute also applies. Breaking its block, leaving its world or changing dimensions stops playback. Co-op listening is personal; guests cannot overwrite the host's saved links, and streams are not synchronized. There are no discs, hearing-distance effects or redstone interactions.

**YouTube requires internet and permits only some videos to be embedded.** The game uses the official IFrame API without downloading, extracting, bundling or proxying media. Videos with embedding disabled show a useful error and an **Open on YouTube** fallback. Local HTML/desktop builds may receive YouTube error **153** because their file origin lacks a normal web referrer. Use the external fallback or serve the game over HTTP/HTTPS; the included optional Node server can serve it at `http://localhost:8787` without joining multiplayer. Offline gameplay still needs no server. HTTP-hosted and local-file saves belong to different browser origins; export/import a world backup when moving between them.

This build environment blocks YouTube endpoints with HTTP 403. Official API wiring, controls, save/reload and network-error handling are tested with an explicit test-only SDK fixture; **real streaming and local Windows playback remain unverified**. No simulated player or media is shipped in the game. Existing terrain, simulation, movement, weapon effects/models/audio and save formats are retained; the new block ID and recipe append to existing data.

## Previous Trickster Wake update — 1.3.3

Matthew’s dashes now leave cyan/violet speed streaks, expanding sigils and translucent body echoes. A short forward speed tunnel makes the effect visible in first person; F5 shows the wake. Air Trick has departure/arrival rings and echoes along its path, and Wall Hike adds an upward streak. Effects use three pooled draw calls, respect the particle setting, skip body echoes with Fancy Graphics off/reduced particles, and reset between worlds. A brief FOV impulse follows the existing Dynamic FOV toggle.

**R now works without a hostile.** Aim at any living creature, including animals and villagers, to approach without damaging it. With no creature targeted, blink up to eighteen blocks toward the crosshair; free aim stops before solid blocks. Looking down while grounded stays level instead of entering the floor. A blocked creature approach still fails without charge/cooldown cost. Insufficient free space also fails without cost. The original two style charges, recharge times, five-second R cooldown, dash speed/distance and fall-damage accounting remain. Existing restrictions while dead, swimming, in lava or Creative flight remain; Air Trick is still host-only in the optional Creative co-op beta.

Pistol and Devin Sword move guides now have their own compact panel **above the hotbar and survival bars**, including saved cooldowns and style charges, in all three camera views. Block names, creature health and extraction progress remain separate targeting labels. Menu design, original weapon audio/models, acquisition, damage, terrain and save formats are retained.

## Previous Twin Report audio update — 1.3.2

Matthew’s pistols now use original layered PCM reports informed by the supplied Ebony & Ivory reference: fast broadband cracks, a stronger low-frequency body, short mechanical slide clacks and restrained early reflections. The black pistol is deeper; the silver pistol is brighter. Each has four variations and slight pitch variation, with subtle left/right positioning tied to the firing hand. Buffers are synthesized once and reused; sustained fire has short, bounded tails. Master volume/mute still applies. Creative co-op guests now hear their locally predicted pistol shots too.

The uploaded recording is used for signal analysis and timbre reference; its audio is not embedded or redistributed. Direct listening was unavailable in this build environment, so subjective similarity needs the player's own audition. A short original WAV preview is included with the release downloads. No weapon damage, cooldown, ammunition, models, terrain, menu design or save-format changes.

## Previous Dante & Twin Iron visual update — 1.3.1

Select **Dante** in the title-menu Skins wardrobe: an original voxel interpretation of his Devil May Cry 3 appearance, with parted silver hair, an open crimson coat, chest harness, fingerless gloves, boots and an asymmetric grin. The two coat tails follow movement in F5. Ten outfits are now available; the choice persists as a device preference and is accepted in Creative co-op.

Matthew’s pistols now have distinct black and silver long slides, brown wood panels, screw heads, original cameo inlays, hollow trigger guards, sights, slide serrations, hammers and under-barrel weights inspired by the supplied image. Detail is batched by material. First-person and F5 models use independent firing-hand recoil, moving slides/hammers, short muzzle flashes and ejected casings. Equipping rolls the pair into view; sprinting lowers the weapons, and style dashes spread the first-person carry pose. Minimal particles suppress flashes/casings. The unlimited magical ammunition, damage, cooldowns, acquisition, movement abilities, terrain and save formats stay the same. No reload animation implies an ammunition system that does not exist.

This is a fan-inspired costume and original stylized geometry, not extracted character art, weapon photography, a licensed collaboration, or an exact high-resolution replica. First-person hand poses and local F5 firing animate; remote co-op avatars show the skin/weapons and movement, but do not synchronize firing animation.

## Previous Matthew’s Arsenal update — 1.3.0

**Matthew's Dual Wielded Pistols** are a unique, unbreakable pair of original rune-powered sidearms. Hold left-click to alternate five-damage shots at five shots per second, up to forty blocks. Solid walls and closed door panels block shots; the pistols do not mine blocks. They use magical energy rather than ammunition. Doors, workstations, beds and villagers retain right-click interaction priority; crouch to use style movement instead. Each hand has its own model, recoil and muzzle flash, with matching F5 models and solid dropped-item geometry.

- **Earn the weapon:** rare Cinderworld incursions can happen in existing or new Overworld worlds. After an initial sixty seconds of active simulation, a check every thirty seconds has a 25% chance to look for an untouched, dry, loaded clearing nearby. Six segmented tentacles open a fissure and a basalt/rune shrine rises over nine seconds. The requested announcement reads exactly: “Hellspawn from Cinderworld have surfed in the overworld! Defeat them and claim a powerful weapon.”
- **Defeat its four Hellspawn:** two Cinder wraiths fire visible runic bolts, alongside a crawler and emberling. Guards persist and return toward the shrine. Defeat all four before right-clicking the altar. Leave one inventory slot free. One pair is awarded per world; the altar cannot award duplicates. Peaceful pauses the encounter without removing guards or unlocking the reward. The journal (`J`) shows location, phase and defeat count. Creative can call the same encounter from this journal when a valid clearing is loaded; it still requires defeating the guards.
- **Trickster-inspired movement:** right-click with WASD for **Dash**; right-click in the air for **Sky Star**, once per jump. Aim at a visible hostile within eighteen blocks and press `R` for **Air Trick**. While airborne beside a wall, hold Space and right-click for **Wall Hike**, once per airborne period. Two style charges each recover in two seconds; Air Trick has an additional five-second cooldown. Body sweeps prevent passing through walls. There is no invulnerability or fall immunity. This is an original adaptation inspired by Dante’s Trickster style in Devil May Cry 3, not its entire combat, lock-on or upgrade system.
- **Reliable saves:** interrupted emergence, terrain edits, each defeated guard, the unique claim, pistols and recharge times persist through save/reload. Existing generators **2–10 stay unchanged**; no new world is needed. In-flight shot trails are transient. Saves containing the new weapon/altar need 1.3 or newer.
- **Concrete fixes:** releasing right mouse no longer cancels a held left-click action; Devin’s Seeker uses solid collision tests so flowers and other non-solid decorations cannot block its homing path. Pistol recoil and muzzle-flash timing also expire in F5 and clear between worlds. Existing menu styles, crafting sidebar and prior systems are retained.

Creative co-op supports host-approved pistol shots, Dash, Sky Star and Wall Hike. Air Trick and the one-time reward are host-only; this remains a Creative co-op beta. Incursions use a local, original simulation: no destruction of player-edited clearings, no remote/dedicated ticking, and no exact DMC3 or Minecraft parity. If no suitable clearing is loaded, an incursion waits for a later chance; explore open ground. Do not stand in the emerging footprint: opening/construction wait until bodies move clear.

## Previous Living Blocks & Citadel update — 1.2.0

This update adds **43 usable blocks/items and 43 recipes**, rather than claiming to finish the entire Java item catalog. Existing menus, movement, crafting sidebar, skins and the Creative co-op beta are retained.

- **Working fluids:** water flows downward and up to seven blocks horizontally; lava spreads three blocks in the Overworld, seven in Cinderworld, with slower ticks. Downward flow takes priority. Levels retreat after source removal. Two supported water sources can renew a middle source. Water/lava contact produces obsidian, cobblestone or stone. Sources, flowing levels and terrain conversions persist across reloads and shared-world edits. Flow runs on the 20 Hz simulation with a bounded queue, without generating distant chunks.
- **Buckets:** craft three iron ingots in a V. Empty buckets collect source blocks; filled buckets place fluid. Survival replaces the same slot atomically, even with a full inventory. Water evaporates in Cinderworld. Lava buckets fuel a furnace for 20,000 ticks and leave an empty bucket. Flowing water affects swimming, oxygen, crop hydration, item buoyancy and currents.
- **Fire and TNT:** right-click ordinary supported surfaces with flint and steel; valid obsidian frames still take priority. Successful ignition wears the tool. Left-click fire to extinguish it. Fire spreads through nearby flammable blocks, burns material, is extinguished by water/exposed precipitation, and ignites TNT. TNT has a four-second saved fuse, flashes while primed, damages terrain/creatures, and chains nearby TNT with shorter fuses. Containers and indestructible relic/seal blocks are protected by the simplified blast rules.
- **Cactus contact:** inset collision and targeting match the rendered body. Contact at the sides or top hurts Survival players and creatures; cactus/fire/lava can destroy ordinary dropped items. Water extinguishes the player's saved burning state.
- **Useful materials and equipment:** copper/gold/emerald ores; raw copper/gold, ingots and reversible mineral storage; golden tools and all four armor pieces; clay balls and bricks; stone-brick variants, smooth stone, granite/diorite/andesite, hay bales, packed ice and bookshelves. Everything listed has actual mining, building, crafting or smelting behavior. Recipes are in the existing crafting-table sidebar. Golden tools mine quickly but wear out rapidly and have wooden-tier harvesting limits.
- **Fortified temple:** new worlds have a 69 × 73 citadel approach, eight towers including four 36-block outer towers, galleries, a crowned inner sanctuary and a physical Guardian seal. Defeat all three Guardians to open the entrance; the sword still needs 30 uninterrupted extraction seconds. F3/J guidance remains accurate. Fresh Guardians have **100 HP, 35% damage reduction**, heavier original armor/helm/shield models and six alternating attacks: shockwave/cleave, three-bolt volley/ground sigil, lunge/five-bolt fan. Sigils lock onto a marked position before erupting and briefly slowing the player. Charge warnings, dodging, flanking, cover and recovery windows provide counterplay. Below half health, special recovery is shorter.

**Create a new world for generator-10 ores, clay beds and the new citadel.** Saved generators 2–9 retain their terrain, including unexplored chunks; existing spawned Guardians retain saved HP while receiving new moves/resistance. Buckets, crafting, flowing fluids, fire and contact damage also work in existing worlds. Export an important world backup before updating. Saves containing the new blocks require 1.2 or newer; keep an older backup if you plan to downgrade. This release does **not** contain every Java block/item: slabs/stairs, fences/trapdoors/ladders, waterlogging, automation and many advanced items remain missing. See [FEATURES.md](FEATURES.md).

Fluid routing is an original simplified solver, with stepped surfaces rather than exact Java slopes or shortest-drop routing. Primed TNT stays at its block position; blasts use a bounded radius rather than Java resistance propagation. Fire is a local probabilistic simulation, not full reference parity. Bookshelves are decorative and do not power enchanting; copper does not oxidize; packed ice has no extra sliding behavior; hay bales do not cushion falls. New stone-variant recipes are custom. The original reference remains **Minecraft Java Edition 1.20.4**.

## Previous adventure update — 1.1.0

The update keeps the existing menus, recipe sidebar, saves, multiplayer beta and underfoot-building/one-block-climbing fixes. It adds:

- **Player animation overhaul:** alternating sword cuts, spear thrusts, tool-specific mining, distinct placement/use/eating poses, sprint carry, landing and swim motion, plus third-person attacks and interactions. Tools and blocks stay rigidly attached to the hand grip. Visual actions do not schedule damage or consume inventory.
- **Four nighttime enemies:** Zombies chase and strike; Creepers charge a cancellable 30-tick (1.5-second) fuse and explode; Spiders have eight articulated legs, fast attacks, simple wall climbing and daylight neutrality; Skeletons keep their distance and fire visible arrows. Arrows sweep walls and bodies instead of passing through shelter. All have original models and synthesized voices. Old saved shades/stalkers become Zombies/Skeletons while retaining IDs and current health; Cinderworld creatures are retained.
- **Harder Temple Guardians:** 64 health and 28% damage reduction, with a melee wind-up and one special attack each: a jumpable six-block shockwave, three aimed runic bolts, or a telegraphed lunge. Amber floor markings warn before attacks; skills have recovery windows. All three must fall to unlock the existing 30-second extraction. Their defeat records and special-attack state persist; Peaceful remains dormant; Creative also requires all three Guardian defeats.
- **Grand temple in generator 9:** a broad paved court, open arch galleries, four illuminated towers and an open crown above the blade. Real supply-chest loot persists. F3 and J still give precise coordinates. Older saved terrain keeps its original temple.
- **Connected caves and terrain:** new seeded chambers join through sloping tunnels, with occasional land entrances and broad foothill ridges. Generation is independent of chunk load order. Underground lava/obsidian remain. New worlds use generator 9; saved generators 2–8 keep their terrain, including unexplored chunks.
- **Original texture overhaul:** material-specific 16px grain, plank seams, log rings, clustered ores, stone joints, grass hems and carved runes. Select **Renewed**, **Soft (v1.0)** or **Classic (v0.5)** in Video Settings. No copied Minecraft textures are used.
- **Solid dropped items:** blocks are atlas-textured 3D cubes/panels, tools use their full held models, and other materials use merged, extruded pixel silhouettes with lit side walls. Items bob and rotate; distance culling limits rendering cost.
- **Seven additional video controls:** Stars, Cloud Height, Animated Textures, Creature Animations, Dropped Item Animation, FOV Effects and Damage Tilt. All affect rendering and persist independently. Disabling decorative creature motion retains combat warnings.

**Historical 1.1.0 notes (superseded by 1.2.0 above):** Enemy drops include rotten flesh, bones, string and gunpowder. Craft one bone into three bone meal; right-click growing wheat to advance it three stages. Four string craft one wool. **Differences:** rotten flesh currently has no Hunger penalty; gunpowder is collectible without TNT/firework recipes; arrows are enemy-only and disappear on impact. Creeper blasts use a bounded, simplified radius and line-of-sight damage, protect containers, runestone, glow crystals and relic blocks, and do not implement Java blast resistance or TNT chaining. Mob spawning/steering and spider climbing remain simplified. Guardian abilities and the temple are custom additions, not vanilla Minecraft parity. In-flight hostile projectiles are transient across save/load or dimension travel.

## Previous main release — 1.0.0

Original stone-and-dirt pixel menus, squared beveled buttons, consistent inventory panels and a crafting-table **recipe book sidebar**. The title no longer has the old top navigation; in-game Options has its controls/skins/checklist navigation instead. Menu clicks use quiet rounded sine/noise envelopes. All artwork, typography, sound and branding remain original.

**Doors stay open** after villagers or the player pass; only another player interaction closes them. Existing saved open states remain valid. **Generator 8** removes natural surface obsidian outcrops and scattered deep obsidian; cooled obsidian rims now surround actual underground lava pools in cave chambers at Y −42…17. The new temple's decorative ring uses basalt. Placed obsidian and existing portals remain valid. Saved generators **2–7 keep their original terrain**, including old outcrops; create a new world for the underground-only natural placement.

Hold The Devin Sword and press **R** for **Devin's Seeker**: an original cyan/violet homing bolt locks onto a visible hostile within 28 blocks, steers toward moving enemies, and deals 12 damage. It collides with walls, ignores peaceful creatures, reacquires live hostiles if its target dies, and expires after four simulation seconds. Fourteen-second cooldown survives saves; no target means no cooldown. Right-click retains the seven-block Pulse. Nine original outfits now include **Devin The Hero** (emerald tunic, gilded belt, smirk), Moonwalker, Moss Ranger, Cinder Smith and Tidekeeper alongside the earlier four costumes.

**Optional Survival & Creative co-op beta:** eight players, invitations, in-game chat/owner commands, host-controlled Survival inventories/mining/combat/death, shared crafting/containers and guest reconnect profiles. Run the included Node relay and share a public server invitation for internet play. The owner keeps simulation and saves; no automatic public deployment or dedicated ticking. See [MULTIPLAYER.md](MULTIPLAYER.md). Offline singleplayer remains self-contained.

## Standalone HTML: download, open, share

**DCSMCRAFT-Standalone.html** is the complete game in one file. Save it to your computer, then double-click it and open it in a current desktop Chrome, Edge, or Firefox with WebGL 2, keyboard, and mouse. No ChatGPT, account, prompt, internet connection, server, or installation is needed to run the packaged game. All JavaScript, graphics, icons, and original synthesized audio are embedded. If a messaging app opens a restricted preview, download the attachment first and open it in your browser.

Share that one HTML file. **Save game HTML** on the title/pause menus downloads another clean copy of the game; it does not include your private worlds. Use **Export world backup** to share or move a particular world, then import its JSON backup in the other browser. Local-file storage policies vary by browser; moving or renaming the HTML can change where saves are available. Export important worlds before doing so. If all storage is denied, the game clearly labels session-only saves and still allows backup export.

## Windows 11 desktop executable

Download **DCSMCRAFT-Windows-1.2.0.zip**, extract it, and double-click **DCSMCRAFT.exe**. The executable contains the entire offline game and opens a dedicated app window using the installed Microsoft Edge engine (Chrome is a fallback). It needs WebGL 2 and hardware acceleration. No manual server or game installation is required. This is an original launcher wrapping the browser game, rather than a separate native rendering engine.

The launcher extracts to `%LOCALAPPDATA%\DCSMCRAFT\Game\index.html` and uses `%LOCALAPPDATA%\DCSMCRAFT\DesktopProfile` for local saves/settings. Both paths remain stable across executable updates. Import an exported JSON world backup to move a world from the normal browser edition. The binary is unsigned. Windows execution is **unverified** on this Linux build machine; the PE architecture, standard-system imports, GUI subsystem, compiled payload, and byte-for-byte extraction were checked. See [desktop/README.md](desktop/README.md).

## Cinderworld expedition update — 0.9.0

The custom realm is now called **Cinderworld** in the expedition guide; its saved dimension key remains `cinderwild` for compatibility. Minecraft Java Edition **1.20.4** remains the mechanics reference. All additions below are original custom content beyond that reference.

**Travel with a purpose:** take a diamond pickaxe, food, blocks and flint and steel through the existing obsidian portal. New Cinderworld terrain has **Ash Wastes, Emberwood Groves, Basalt Ridges and Sulfur Basins**, lava channels, broader caves, tall ember canopies, crystal growths and basalt spires. Search between **Y 15 and 70** for coherent orange **Hellfire ore** veins (diamond pickaxe required) and yellow **Brimstone ore** (iron or better). Ores are uncommon, clustered and exclusive to Cinderworld; they do not appear in the Overworld.

Smelt **Raw Hellfire → Hellfire ingot** in a furnace. Brimstone also fuels a furnace for 2,400 ticks. Craft **two Hellfire ingots + one Brimstone → two Hellfire alloy**, shapelessly in the personal grid. Use alloy in the normal shaped patterns for **pickaxe, axe, shovel, hoe, sword, spear, helmet, chestplate, leggings and boots**. These are ten functional recipes, not catalog-only items. Tools have tier 5, speed 10 and 2,031 durability; swords deal 8 base damage, spears 9. Armor has the same 20 total armor points as diamond, 3 toughness per piece, longer durability and **10% extra lava/fire reduction per worn piece** (40% full set), without immunity. Normal equipment, wear, enchantment and saving rules apply. Ashen logs provide planks, fuel and charcoal.

Explore **Emberwatch bastions, crystal shrines and ruined waystations** for actual chests, food, fuel and rare resources. Bastions and shrines have persistent defenders and remain cleared after defeat/reload. Loot stays consumed after reopening or unloading. **Ash deer** are peaceful, **Cinderbacks** retaliate when hit, and **Basalt crawlers / Cinder wraiths** join the hostile emberlings. Each has original articulated geometry and a distinct synthesized voice. Crawlers drop Brimstone; wraiths drop Raw Hellfire. **Pause → Cinderworld Expedition** explains progression and shows nearby structure coordinates in the realm. Structures are original fixed plans; the wraith uses ground movement, and full pathfinding/boss progression remain missing.

In new Overworld terrain, the **Devin Sword** sits inside a runestone temple roughly a thousand blocks from the starting area (the tested seeds are over 800 blocks from actual spawn). Follow **F3** or **J**. Three **Guardians of The Devin Sword** each have 64 health, 28% damage reduction, visible melee wind-ups, a distinct special attack and a local home area. Bring upgraded armor, weapons and food; dodging the wind-up avoids damage. Guardians never respawn after defeat, and all three must fall before the seal permits the existing **30 uninterrupted seconds** of extraction. Creative and Peaceful also require all three Guardian defeats; Peaceful leaves the Guardians dormant. The sword now has a faceted blade, luminous runes, an inset gem, orbiting shards, pooled star motes and expanding layered pulse rings. Its unbreakability, charged-hit healing and wall-aware hostile-only pulse retain their existing gameplay values.

**Hailstorms and tornadoes** join natural Overworld weather and the Creative weather menu. Hail damages exposed Survival players every three seconds. Tornado funnels move through the world, pull players within 28 blocks, lift them near the center, and deal occasional debris damage. Solid overhead cover protects players; Creative/Peaceful disable these hazards. A funnel warning announces its arrival. Funnel position/age and weather timers save. These are **simplified custom weather events**: no block destruction, terrain deformation, hail accumulation or flying debris entities. The dangerous funnel stays visible even with precipitation particles disabled. Rain, snow and lightning retain their earlier limits.

New **jungles** have taller canopies, bamboo, **pandas** and **koalas**. Savannas have **tigers**, which are dangerous even in daylight and can threaten villagers; pandas retaliate when attacked, while koalas remain passive. These are original models/voices using existing collision and wandering systems. Koalas forage on the ground; climbing, breeding and reference-complete animal behavior are not implemented.

**Generation compatibility:** new worlds and realms first created in this release use **generator 7**. Saved generators **2–6 preserve all terrain**, including unexplored chunks and old sword sites. Create a new world for jungles and the distant temple. A previously unvisited Cinderworld realm uses the new generator, even in an old Overworld; a realm visited earlier retains its old landscape. New audio/equipment/VFX/weather and applicable wildlife rules work in existing saves. Export backups before upgrading; do not reopen new content in older builds.

## Living world update — 0.8.0

Ambience is one continuous original stereo soundscape, generated sample by sample instead of replaying short loops. Biome wind, foliage, nearby water/fire, caves, night insects and rain blend smoothly; bird calls happen at irregular intervals. Shelter muffles rain. The AudioWorklet path streams continuously; restricted browsers use newly generated, consecutive PCM segments, never repeated buffers. Pause and category/master controls mute it.

**Options → Music: ON** enables original quiet felt-piano/bell pieces with rests and seeded variation; **Music volume** is independent of ambience and creatures. Cold/coastal biomes use a different tonal palette. This evokes a calm exploration mood without copying Minecraft compositions, melodies or recordings. Music is OFF by default and fades on pause/disable.

Version 0.8 introduced generator **6**: villages occupy 512-block regions with a guaranteed minimum center separation of 384 blocks. Eight regional styles have distinct building materials, roof shapes and resident clothing: meadow timber, birch gables, pine lodges, snow roofs/hoods, desert sandstone/turbans, badlands terraces, savanna canopies and raised marsh homes. Every village retains eight residents, a golem, doors, farms and loot. These are original schematic settlements, not reference jigsaw structures. Old generators 2–5 preserve their villages and terrain, including unexplored areas. Current generator 7 retains that spacing and adds the expedition content above. New layouts require a **new world**.

Seeded Overworld weather alternates clear skies, rain and thunderstorms, with smooth transitions, darkened sky/clouds, distance-delayed thunder and lightning visuals. Cold biomes/high altitudes show snow; arid biomes stay dry, roofs shelter precipitation, rain irrigates exposed crops, beds clear storms and villagers shelter in thunder. Weather state and timers save in each realm. **Creative pause → Weather** selects Natural, Clear, Rain/Snow or Thunderstorm. **Video Settings → Rain & Snow / Lightning Flashes** controls effects independently. Rain does not flow, snow does not accumulate, lightning causes no damage/fire, and weather is not Minecraft-exact.

Render distance now reaches **24 chunks / about 384 blocks**. Full chunks within four chunks, simplified voxel surfaces through eight, and stable batched 64×64-block heightfield tiles beyond that reduce distant voxel allocation. Approximate trees/buildings and above-ground edits appear at long range. A coverage texture replaces distant terrain only when detailed chunks arrive, avoiding an empty circular loading seam. Caves, underground builds and exact silhouettes remain near-field detail. We also fixed missing middle-distance house walls, roof gaps, a rapid pause/resume pointer-lock race, and music fade cancellation.

## Expedition update — 0.7.0

F3 now gives unambiguous world axes (North −Z, East +X), exact feet and block coordinates, a compass, the sword's seeded base coordinates, signed X/Y/Z travel deltas, horizontal distance, bearing and turn instruction. Claimed relics and other dimensions are labeled correctly. J still opens the Relic Journal. Y is the **base block**, not the blade above it.

Daylight interpolates between world ticks with continuous dusk/dawn colors, warm horizons, blue moonlight and fading stars. The 24,000-tick day, hostile-night window and custom announcements retain their existing mechanical timing. Cinderwild keeps its own sky. Weather and lightning are added in 0.8.0; see above.

Villagers have connected folded arms and separate hands; animals have simpler eyes, and the Iron Golem has its own articulated model. Menus retain their pixel layout with carved timber colors, moss-green marks and brass accents.

Craft **dirt pickaxe, axe, shovel, hoe, sword, spear and four armor pieces** using the usual tool/armor patterns with dirt in place of the material. Tools last only 12 uses, armor 8–12 durability points; the entire armor set offers just 2.5 armor points. Dirt pickaxes cannot harvest stone or ore. Upgrade to wood for the normal stone progression. Dirt equipment, spears and the Devin Sword are intentional additions beyond the reference.

Version 0.7 introduced generator **5** for larger villages; 0.8 uses generator **6** for regional spacing/styles. Saves on generators 2, 3 and 4 retain their original terrain, including unexplored chunks. Visuals, equipment, skins, navigation and one village defender apply to existing saves too. Export a world backup before upgrading; older builds cannot understand the new items/entities.

## Develop and build

Requires Node.js **20.19+ or 22.12+**. Developed and verified with Node 24 and Chromium.

```sh
cd dcsmcraft-source-v1.4.1
npm ci
npm run dev
```

For source development, open the address printed by Vite using your environment's supported application access (port **5173**). The source `index.html` uses module imports and needs this server; the packaged standalone HTML does not. Singleplayer uses no API keys, backend, or external asset CDN. Optional Survival/Creative co-op uses the included Node.js relay; see MULTIPLAYER.md.

```sh
npm run build
npm run preview
npm run build:standalone
npm run build:desktop # optional Linux cross-build; requires the documented Zig compiler
```

The normal Vite build writes a static website into `dist/`; the standalone command adds `dist/DCSMCRAFT-Standalone.html`. Publish the normal static build to any suitable static host if desired. Browser worlds belong to their browser storage origin, so hosted and local copies have separate saves. This session has not published a website.

## Play

Choose **Create a world**, enter a name and optional seed, and select Survival or Creative. Letters and numbers both make deterministic seeds. `Wildflower` starts near a wooded marsh in the new generator. The title screen's scenery is itself a live generated world.

| Control             | Action                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Mouse               | Look; click Resume to capture the pointer                                                   |
| WASD                | Walk                                                                                        |
| Double-tap W        | Start sprinting; keep moving to stay running. Stop moving or hold Shift to cancel           |
| Ctrl + W            | Sprint (alternative)                                                                        |
| Space               | Jump; swim upward                                                                           |
| Shift (either key)  | Hold to crouch; avoid walking off edges; descend in Creative flight                         |
| Left mouse, hold    | Progressively mine the targeted block                                                       |
| Left mouse, click   | Attack: normal melee 3 blocks; spear 4.25; Devin Sword 3.5                                  |
| Right mouse         | Open a workstation/container, eat held food, use a hoe, plant seeds, sleep or place a block |
| Shift + right mouse | Place against an interactive block                                                          |
| 1–9 / scroll        | Select a hotbar slot                                                                        |
| E                   | Open or close inventory                                                                     |
| Q / Ctrl + Q        | Drop one item / the held stack                                                              |
| Escape              | Pause and release the pointer; close inventory                                              |
| Double-tap Space    | Toggle Creative flight                                                                      |
| J                   | Open the Relic Journal and locate The Devin Sword                                           |
| F3                  | Feet/block coordinates, compass, signed travel deltas and Devin Sword guidance |
| R                   | Devin Sword homing Seeker (28 blocks, 14-second recharge) |
| T / slash / Tab     | Chat / owner command prompt / multiplayer session |

**F5** cycles first person → third person behind → third person front. The original articulated player wears your armor and holds the selected item. The camera pulls in before walls; block and attack reach still starts at the player. Choose **Skins** on the main menu for ten outfits, including Devin The Hero, Explorer, Carnival Clown, Trail Hero, Bandit, Moonwalker, Moss Ranger, Cinder Smith, Tidekeeper and the DMC3-inspired Dante. The chosen outfit is a device preference, not a world item.

Settings persist mouse sensitivity, field of view, audio categories/volumes, custom cycle messages, and all graphics preferences. **Options → Video Settings** retains the same pixel menu style, with grouped display/performance, lighting, world-detail and camera controls:

- **Resolution scale:** 50%, 70%, 100%, 125% or 150%. Clouds and particles remain independent when this changes.
- **Render distance:** 2–24 chunks / up to about 384 blocks. Full geometry loads within four chunks, simplified voxel surfaces through eight and batched approximate heightfields beyond eight. Extended Terrain off caps the radius at six chunks.
- **Max Framerate:** Unlimited, 30, 60, 120 or 144 FPS, limited by display refresh and hardware. **Entity Distance:** 50–150% of the normal display range; this changes rendering, not creature simulation or spawning. **Particles:** All, Decreased or Minimal.
- **Smooth Lighting / AO**, **Sun Shadows**, **Entity Shadows**, and **Brightness**. Sun shadows are local optional shadow maps and default OFF. Entity Shadows controls creatures casting into those maps, so it needs Sun Shadows enabled. Brightness adjusts ambient illumination, not a reference-exact gamma curve.
- **Texture Pack:** **Renewed** is the new default, with less noisy, clearer pixel art. **Classic** preserves all original v0.5.0 block pixels exactly. Both packs are embedded, work offline and switch immediately without changing worlds, menus or game mechanics. New blocks have matching Classic artwork; this is a DCSMCRAFT pack selector, not a Minecraft resource-pack importer.
- **Mipmap Levels:** 0–4, with actual GPU mip chains to reduce distant shimmer while retaining crisp nearby pixels. **Biome Colors / Biome Blend:** optional foliage tints with a 0–4 block sample radius; the center and four neighbors are averaged, a simplified version of the reference's area blend.
- **Rain & Snow** controls precipitation particles; **Lightning Flashes** controls the bright flash (the bolt remains visible). Weather simulation continues when visual effects are off.
- Independent **Fancy Graphics** (local torch lights and animated fluids), **Clouds**, **Sun & Moon**, **Distance Fog**, **Show FPS**, **View Bobbing** and fullscreen. View Bobbing disables walking/swimming camera and hand bob while retaining combat/use animation.

Touch and gamepad controls remain missing. On slower computers start at 100% resolution or lower, two to four chunks, and shadows OFF.

### First Survival session

1. Hold left mouse on a tree trunk. A progress bar shows mining progress. Walk close to the dropped log to collect it.
2. Press E. Choose the **Oak planks** recipe; click the result to take it, then click an inventory slot to place it. Shift-clicking the result crafts into inventory. Repeat as needed.
3. Turn two vertically aligned planks into sticks. Turn four planks into a crafting table using your 2 × 2 grid. Recipe cards arrange the actual ingredients from your inventory; they do not create free materials.
4. Place the table, then right-click it for the 3 × 3 grid. Make a wooden pickaxe with three planks across the top and two sticks down the center.
5. Mine stone for cobblestone. Make a stone pickaxe with three cobblestone and two sticks; make a furnace with eight cobblestone around an empty center.
6. Mine iron ore with the stone pickaxe. Open a furnace: raw iron in the upper input, coal, charcoal, planks, logs or sticks in the lower fuel slot. Each smelt takes 200 ticks / ten simulation seconds. Take the iron ingot from the right output. Cook raw meat the same way.
7. Make a shelter before night, which begins at approximately tick 13,000. Coal plus a stick makes four torches. Torches currently suppress nearby hostile spawns but do **not** emit propagated light. Make a bed from three wool and three planks to sleep through the night and set your spawn point.
8. Grazer and woolling creatures drop raw meat; woollings also drop wool. Right-click food when hungry. Seeds sometimes drop from grass blocks; hoe dirt near water, plant seeds and wait for hydrated wheat to mature.

Inventory supports stack merging, right-click splitting/place-one, dragging one item into each visited slot, cursor swapping, Shift-click transfers and tool durability. Closing a crafting screen returns ingredients and cursor items to inventory, dropping only the excess if full. Four armor slots support leather, iron and diamond equipment. Shift-click armor to equip an empty matching slot; right-click held armor to swap equipment. Armor reduces physical damage, wears, breaks, saves and drops on death. Offhand remains missing.

Creative provides a searchable catalog of the implemented items, unlimited placement, damage immunity and flight. It does not make missing block types or mechanics available.

## Portals, night enemies, and cycle messages

- **Night:** Zombies, Creepers, Spiders and Skeletons spawn after tick 13,000, with distinct melee, fuse, climb and projectile behavior. Build solid shelter and place torches, which suppress spawns within nine blocks. Peaceful disables hostiles; Creative is immune. At dawn, Zombies and Skeletons take simplified sunlight damage when exposed to the sky; Spiders become neutral in daylight and Creepers remain dangerous. AI uses local steering, not a full pathfinder.
- **Cinderwild:** mine obsidian with a diamond pickaxe. Exposed outcrops occur near the centers of 64-block regions on dry land; obsidian also occurs deep below Y −35. Gravel has a 10% chance to drop flint. Craft one flint and one iron ingot into flint and steel in the personal grid.
- Build an upright obsidian frame **4 blocks wide × 5 high**, leaving a **2 × 3** opening. Corners are optional (10 obsidian minimum). Right-click the frame with flint and steel, then stand inside for four seconds in Survival or travel immediately in Creative. Frames work facing either horizontal axis. Creative supplies obsidian and flint and steel in its catalog.
- A linked return portal appears in the original **Cinderwild** realm: cinderstone terrain, caves, basalt spires, emberglass, dangerous lava (flowing since 1.2), and hostile emberlings. Initial portal coordinates use an 8:1 scale; later travel follows the saved link. Each dimension preserves its edits, chests, creatures, drops, and crops. Death there returns you to the Overworld spawn while drops remain in Cinderwild. This is a custom dimension, not full Minecraft Nether parity; the End and bosses remain missing. Flint and steel also ignites surfaces and TNT as of 1.2.
- **Options → Custom day & night messages:** edit the four lines shown at sunset (12,000), nightfall (13,000), approaching dawn (23,000), and sunrise (24,000/0). Preview and restore buttons are included. Empty text disables that message. The Overworld has a 24,000-tick/20-minute day at 20 ticks per second. Cinderwild has a fixed warm sky.

## Villages and a livelier Overworld

**Create a new world for expanded villages.** Existing worlds and imported 0.2 saves retain their terrain generator to protect builds. The seed `Wildflower` has a village near **X 307, Z 230** in generators 6/7 (generator 5: X 102, Z 99) (use F3 for coordinates). Current worlds contain seeded villages on suitable dry land: eight houses, branching paths, a well, two communal wheat plots, beds, lamps and loot chests. Homes use one of eight regional palettes and roof/clothing styles; see the 0.8 update above. Village centers are at least 384 blocks apart in new worlds. Original grass, flowers and cutout leaves add surface detail.

Each new village has eight persistent villagers and one 100-health Iron Golem. Farmers, masons and shepherds wander by day, return home at night, and flee nearby danger. Right-click a resident within reach to open limited trading. Actual inventory items pay for emeralds or goods, offers have twelve uses, and stock restocks at sunrise. Trade state, home positions, residents, crops and containers save and reload. Dead villagers do not automatically respawn. This is a partial village system: no reference-complete professions, reputation, raids, breeding or pathfinder. The golem attacks nearby hostiles, while hostile mobs can target villagers or the golem. Guard kills grant no player XP. A guard stays dead after death and reload; no automatic replacement or player-built golems. Existing villages receive one defender when visited, without terrain changes.

Pigs, sheep, cows, chickens and rabbits spawn in small groups with biome filtering, space checks, wandering, fleeing, original calls and simplified drops. Rabbits hop; chickens descend slowly. The original night hostiles remain dangerous. Animal breeding, milk, eggs and full reference loot tables are missing.

The new art uses original 16-pixel block textures, biome tinting, face/corner shading, textured hand blocks and creature models, progressive crack textures, a hand-drawn pixel font, classic inventory panels/HUD, stars and animated water/portal/lava colors. Sound uses an original PCM Foley bank with varied grass, wood, stone, sand, glass and cloth impacts, plus synthesized creature voices. None of this uses extracted Minecraft assets.

## Animation and village-door update — 0.4.0

Tools now have solid 3D handles and heads attached to the same wrist/palm/finger rig as the hand. Textured blocks share that grip. Combat includes distinct sword cuts, tool strikes and punches, critical impact particles, hit feedback, enemy attack/flinch/death motion and an attack recovery indicator. Mining, use, visual eating, equipping, look sway, movement, swimming and landing have their own visual motion. The hand camera keeps a stable FOV; a nearby targeted wall lowers the hand. These original visual animations do not delay damage or item transactions. Food is still consumed immediately.

Village houses have **oak doors**. Right-click either half to open or close; villagers open their own doors and close them after passing. Craft **three doors from six planks** arranged in two columns on a crafting table. Doors use two linked blocks, four orientations and thin collision panels. Placement needs support and two empty cells; it cannot intersect players or creatures. Breaking either half or the supporting block drops one door in Survival. Door states persist in both dimensions. Repeated stale break targets cannot duplicate drops.

Existing version-3 villages receive generated doors where their saved edits do not override the doorway; player edits stay intact. Version-2 saves retain their previous terrain generator. Door-containing worlds need version 0.4.0 or newer. Door panels switch state immediately while chunk meshes update; hinge animation, automatic double doors, signals and other door types are not implemented. The hand remains an overlay, with wall avoidance rather than complete world occlusion. See FEATURES.md for the full differences.

## Ambience, equipment and relic update — 0.5.0

The world mixes original wind, nearby water, daytime birds, night insects, cave rumbles and Cinderwild ambience. All nine creature types have distinct distance-attenuated, stereo-positioned voices and hurt/death variants. Pause silences ambience; master volume and separate ambience/creature controls are saved in Options. These are synthesized sounds, not recordings or reference sound copies.

Craft wooden, stone, iron or diamond **spears** at a crafting table with a material in the top-right and two sticks running diagonally toward the bottom-left. Spears have 4.25-block melee reach, a one-second attack cooldown, durability and thrust animation; they cannot be thrown. Dirt, leather, iron and diamond armor use familiar shaped recipes and have damage reduction, toughness, durability and equipment slots. These are subsets; other reference armor materials remain missing.

**Enchanting:** new version-3 terrain contains lapis ore below Y 32 and sugar cane beside some shores. Cane regrows to three blocks if its base remains beside water (an accelerated 400-tick check). Three cane in a row make three paper; three paper plus leather make a book. At a crafting table, arrange a book above two diamonds flanking obsidian, over three obsidian, to make an enchanting table. Right-click it, select equipment, then upgrade Sharpness, Efficiency, Unbreaking, Protection, Feather Falling or Knockback. Each level costs five times its level in **raw XP points** and its level in lapis. Costs apply only on success. Creative upgrades are free. Enchantments affect real damage, mining, durability, protection and knockback and survive saves/death drops. This deterministic system omits random offers, bookshelf power, XP-level costs, enchanted books and anvils.

**The Devin Sword:** press **J** or choose **Relic Journal** in the pause menu for the seeded Overworld coordinates. Aim at the sword planted in ancient stone and hold left mouse for **30 uninterrupted real seconds**. Releasing, looking away, leaving reach, taking damage or pausing resets progress. Make inventory space; a full inventory never consumes the relic. The claim is saved once per world. The unbreakable cyan-and-gold sword deals ten base damage; fully charged hits restore one health point. Right-click for **Devin’s Pulse**: eight damage with collision-safe knockback to visible hostile mobs within seven blocks, sparing animals and villagers. It has a ten-second simulation cooldown that persists across saves. Block/container interactions take priority. Spears and this legendary sword are original additions beyond the Java 1.20.4 reference. New items/blocks and equipped gear need version 0.5.0 or newer; back up worlds before updating. Version-2 terrain remains unchanged and has no generated relic.

Bug fixes include Creative combat no longer wearing tools, independent enchantment metadata copies, invalid furnace Shift-transfers, null/malformed preference recovery, sugar-cane support/harvest consistency and collision-safe constant-direction knockback. The feature ledger still lists incomplete and missing systems; this release does not complete every earlier requested Minecraft mechanic.

## Terrain, sound and model renewal — 0.6.0

**Create a new world for the new generator.** Saved generation versions 2 and 3 keep their terrain, including when loading unexplored chunks. Version 4 adds smooth continental hills, eroded ridges and broad river valleys, plus twelve Overworld biome types: Oak Woodland, Flower Meadow, Desert Dunes, Snowy Highlands, Pine Forest, Birch Woodland, Savanna, Badlands, Marsh, Snowy Taiga, Stony Peaks and Ocean. Terrain and distribution are original, not Minecraft's generator. Pine trees are taller and conical, birches have pale bark, and savanna trees have broad crowns. Marshes have moss and ferns; badlands have red sand and terracotta strata; cold lowlands can have ice. Cacti are solid decorative/harvestable blocks without reference growth or contact damage. Tree regrowth, full snowy weather, swamp water behavior and reference biome populations remain absent.

Pine and birch logs craft into four existing planks or smelt into charcoal, and burn as fuel. Red sand smelts into glass and falls like sand. Existing villages, relics and portals remain part of the new worlds. All new block IDs append after the previous ones. New terrain/materials require 0.6.0 or newer.

Creature art stays blocky, with cleaner proportions, static-part batching, shared cube geometry, smooth position/shortest-path turn interpolation, and eased head motion. Resting models fit their collision height; physical collisions and attack timing still use authoritative simulation state. The F5 player now adds articulated limbs and rigid armor overlays; full skeleton IK remains missing. Distant models are released and drop icons share textures. Chunk meshing caches biome tints, terrain lookups are bounded/cached, edits are indexed by chunk, and unloaded plant/light indexes are pruned. The v0.6 CPU meshing median was approximately unchanged versus v0.5, while repeated terrain queries dropped about 62%. Models keep material batching; the revised villager adds connected arm joints. These are resource/work reductions, not a universal FPS guarantee; see PERFORMANCE.json for both measured samples. A repeatable `node scripts/benchmark-meshing.mjs` benchmark is included; comparison mode takes `--baseline=/path/to/older/source`.

Material impacts now combine contact, friction and damped resonance. Nine creature types use original multi-harmonic/formant and breath samples with three variants, distance attenuation, stereo position and hurt/death/attack pitch changes. They remain synthesized, not recorded animals or Minecraft samples. Existing ambience and separate sound controls remain available.

## Saves and recovery

Worlds save to **IndexedDB in this browser** every 30 active simulation seconds and on Save & Return to Title. Save before closing the tab; a browser shutdown does not guarantee that the best-effort page-hide save finishes. A save includes the seed, terrain edits, container contents, furnace state, crops, dropped items, creatures, inventory/cursor, armor, enchantments, relic claim/power cooldown, tools, health/hunger/oxygen/XP, world time, spawn point, current dimension, both visited realms, portal links, terrain generation version, resident/home records, and village trade stock.

Each save is a single IndexedDB read/write transaction. Checksummed JSON envelopes retain the previous valid generation as a backup. Loading automatically tries that backup if the current generation fails validation. Saving after recovery keeps the valid backup. A failed transaction leaves the previous committed record intact. This protects against partial writes and detected corruption; it does not protect against deleting all browser data or disk failure.

Use **Your saved worlds → ↓** to export JSON backups. **Import backup** restores a supported export as a separate world, preserving any existing world. Export before clearing browser storage or changing your deployment origin. Different tabs are not synchronized: playing the same world in two tabs can overwrite the other tab's later progress. Offline time does not advance simulation.

## Validation

TLS development tests additionally require the **OpenSSL command-line utility** to generate isolated temporary test certificates. OpenSSL is not required to play or to run HOST-PUBLIC. Runtime public hosting needs Node.js and the separately installed cloudflared utility.

```sh
npm test
npm run test:e2e
npm run build
```

The unit suite also checks double-tap sprint timing, continued movement, both Shift crouch keys, hunger, wall collisions and input resets. It exercises deterministic terrain, generation order, chunk-edge edits, unloading/reloading, ray targeting, static water transparency to targeting, gravity blocks, mining tiers/times, recipes, stack conservation, transfers, durability, furnace timing, collisions, jumps, falls, crouching, oxygen, hunger, pickups, combat cooldowns, duplicate death-drop prevention and save checksums.

The Playwright suite runs real Chromium/WebGL and IndexedDB. It exercises world creation, menus, responsive layout, settings persistence, gathering natural logs, crafting through the UI, progressive mining, natural iron ore drops, smelting, placement exclusion, a simulated night in a shelter, death/respawn, Creative flight, swimming, persistent reloads and recovery from an intentionally corrupted save generation. Late-game tests use deterministic player positions and test fixtures, and advance real production simulation ticks; they are not a claim of a full manually played session or of Minecraft parity.

Playwright uses `/usr/bin/chromium` when present. Else install its browser with `npx playwright install chromium`, or set `CHROMIUM_PATH` to a supported system Chromium executable. The current cloud image already supplies Chromium. Browser downloads can require an additional allowed domain on restricted networks.

## Source map

| File                                       | Responsibility                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/data.js`                              | Block/item definitions, mining tiers, fuel, smelting and shaped/shapeless recipes                                 |
| `src/random.js`                            | Seed hashing, value noise and fractal terrain noise                                                               |
| `src/world.js`                             | 16 × 16 × 384 chunks, terrain, trees, ores, structures, sparse edits, DDA raycasting, gravity and crops           |
| `src/animation.js`, `src/first-person.js`  | Independent visual action controller, gripped hand/tool/block models                                              |
| `src/doors.js`                             | Door states, shapes, placement, interactions and targeting                                                        |
| `src/renderer.js`                          | Chunk geometry, hidden-face removal, frustum-culling meshes, atlas materials, sky, creatures, items and held hand |
| `src/matthew.js`, `src/pistol-model.js` | Paired sidearm shots, original held models and collision-safe Trickster-inspired moves |
| `src/invasion.js`, `src/incursion-renderer.js` | Saved incursion/reward state machine and batched rising shrine/tentacle visuals |
| `src/physics.js`                           | Player AABB collision, movement, Creative flight, swimming and fall damage                                        |
| `src/inventory.js`                         | Stack transactions, cursor manipulation, recipe matching, mining speed and durability                             |
| `src/villages.js`, `src/ecology.js`        | Village layouts, terrain blending, persistent residents, routines and atomic trades                               |
| `src/mesher.js`, `src/terrain-worker.js`   | Raw typed-array geometry, ambient occlusion, background generation and simplified distant terrain                 |
| `src/models.js`, `src/foley.js`            | Original textured creature models and generated PCM sound bank                                                    |
| `desktop/launcher.c`                       | Offline Windows launcher with embedded HTML and stable save profile                                               |
| `src/simulation.js`                        | Fixed world tick, survival, AI, combat, drops and furnaces                                                        |
| `src/portals.js`, `src/realms.js`          | Frame validation, portal charging, linked travel and independent realm persistence                                |
| `scripts/build-standalone.mjs`             | Reproducible self-contained HTML packaging, including licenses                                                    |
| `src/equipment.js`, `src/relic.js`         | Armor, enchantments, relic generation/extraction and unique powers                                                |
| `src/soundscape.js`                        | Continuous original stereo DSP, worklet/streaming fallback and environment mixing                                                 |
| `src/storage.js`                           | Atomic IndexedDB saves, checksums and fallback generation                                                         |
| `src/biomes.js`, `src/graphics.js`         | Original version-4 climate/terrain/decorations and graphics settings/pacing                                       |
| `src/classic-textures.js`, `src/voices.js` | Frozen Classic atlas and layered original creature vocal synthesis                                                |
| `src/textures.js`, `src/audio.js`          | Original procedurally generated assets                                                                            |
| `src/navigation.js`, `src/daylight.js` | Accurate compass/relic guidance and continuous visual lighting |
| `src/player-model.js`, `src/skins.js` | F5 body, worn equipment, original skin palettes/previews |
| `src/defenders.js` | Village defense targets and solid-wall line of sight |
| `src/music.js`, `src/weather.js`, `src/weather-renderer.js` | Original generative music, saved tick-based weather and batched precipitation/lightning |
| `src/horizon.js`, `src/village-styles.js` | Distant macro tiles and eight original regional settlements |
| `src/cinderworld.js`, `src/encounters.js` | Volcanic generation, coherent ore veins, explorable structures and persistent encounters |
| `src/caves.js`, `src/hostile-combat.js`, `src/night-models.js`, `src/renewed-textures.js` | Connected gen-9 caves, distinct enemy attacks/projectiles, original hostile rigs and material motifs |
| `src/expansion-models.js`, `src/arcane-effects.js` | Original expansion creatures and a pooled magical-particle draw call |
| `src/ui.js`, `src/style.css`               | Screens, HUD, recipe book, inventory and settings                                                                 |
| `src/block-dynamics.js`, `src/block-actions.js`, `src/content-textures.js` | Bounded fluid/fire simulation, saved TNT fuses, buckets/ignition and original appended content art |
| `src/main.js`                              | Game lifecycle, input, interactions, 60 Hz physics / 20 Hz simulation and rendering loop                          |

The renderer creates at most two terrain meshes per loaded chunk, never one object per block. Geometry is rebuilt only for edited chunks and affected neighbors. Chunks build near-to-far with a per-frame budget and unload outside the render region. Three.js culls chunk bounds against the camera frustum. World coordinates are separate from chunk-local vertex coordinates. Nearby collision chunks can still generate synchronously. Visual generation/meshing uses up to two embedded workers; opaque or restricted environments have a synchronous fallback. Distant surfaces reduce memory and mesh cost. Lighting uses ambient/directional shading, independent per-vertex AO, optional 1024-pixel local sun shadow maps and a small torch-light pool; propagated voxel light and greedy meshing remain future work. Entity/drop render objects are individual because their population is small.

## Known limitations

- Java 1.20.4 is a behavior reference, not a parity guarantee. Movement uses approximate continuous physics with reference target speeds/reach; generation, lighting, AI, combat and several survival timings differ.
- Water/lava flow, buckets, source retreat/renewal, cooling and simple currents are implemented in 1.2. Waterlogging, exact spread order/shortest-drop routing, smooth corner slopes and complete fluid/block reactions are missing. Simulation is bounded and pauses in unloaded or distant chunks.
- No offhand, player shields/bows, general potion-effect system, anvils, brewing, complete villager economies, full Nether/End progression, bosses, or automation. Armor/enchantments are limited subsets; spears are melee only. Sun shadows cover a local 64-block-wide area, can flicker at some sun angles and cost extra GPU time; they do not provide propagated voxel lighting.
- Most solid blocks use full-cube collision. Cactus uses an inset collider and hurts on contact. Exceptions also include oak doors, which have thin panels and persistent facing/open/half state, and the planted relic, which has a smaller stone-base collider. The camp bed is a single full cube. Slabs, stairs, trapdoors, fences and ladders are missing. Furnace/chest/table side textures repeat around the block.
- Gravity runs for placed/updated sand, red sand and gravel; untouched generated terrain is stable until updated. Leaves do not decay or drop saplings. Trees do not regrow.
- AI steers and jumps over simple obstacles; villagers use simple entrance waypoints. There is no full pathfinder and creatures can become stuck. Spawning uses a simplified day/night, terrain and torch-distance check rather than reference light/biome rules.
- Food is instant; crop age is stored but its rendered sprite does not show each growth stage. Food, farming and breeding are incomplete; use the checklist.
- Weather is a partial original system: no snow accumulation/melting, lightning damage/fire, wet blocks or reference spawn-light calculation. Rain/snow and bright flashes can be disabled independently.
- Large render distances can stutter while generating chunks, especially in software-rendered browsers. Start at four chunks and lower quality/distance on modest hardware. Detailed geometry extends four chunks; higher distances use simplified surfaces and then heightfields. Horizon tiles can pop/change shape as detailed chunks arrive; terrain undercuts, underground edits and exact structures are not reproduced at long range. There is no benchmark claim for all devices.
- Multiplayer is an eight-player Survival/Creative beta; see MULTIPLAYER.md. Survival is currently shared Overworld only, with host-vicinity activity, owner-only guest trading/enchanting/style/relic extraction, no PvP, independent dimensions, dedicated simulation or automatic internet deployment. Owner commands are a limited subset; achievements, mods and mobile controls remain absent.

The next stages are described in [FEATURES.md](FEATURES.md). None of those missing systems are presented as finished.
