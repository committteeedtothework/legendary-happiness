# DCSMCRAFT 2.17.0 — offline Windows app

Download and run **DCSMCRAFT-2.17.0-Portable.exe** on Windows 10/11 x64. Keep the downloaded EXE anywhere writable. It unpacks its bundled runtime internally and opens DCSMCRAFT; no browser, Node, Unity, local server or separate HTML file is needed. No installer, account or internet connection is required for singleplayer. Public multiplayer still requires an online relay.

The app contains Electron 45.3.0, Chromium, the game, original texture packs and all existing user-supplied models/audio. Large models/music load from the package when needed, instead of parsing base64 media in the startup script. HTML/JavaScript remain internal implementation technologies; this is the complete existing game, not the unfinished Unity rewrite.

## Saves and older worlds

The stable profile is `%LOCALAPPDATA%\DCSMCRAFT\DesktopApp` (Chromium IndexedDB/settings inside). Updates keep this path and the `dcsmcraft://game` origin unchanged. Closing the game window pauses and awaits a durable save. A failed/session-only save offers Retry, Cancel, or an explicit Quit Without Saving; cancel and export a backup if storage is unavailable.

The previous launcher used `%LOCALAPPDATA%\DCSMCRAFT\DesktopProfile` in Edge/Chrome. This app does not open, copy, overwrite or delete that profile. To move an old world, open the old version, choose Singleplayer and its world export arrow, then use Singleplayer → Import backup in the new app. Original browser backups and generator versions remain supported; an import creates a separate world.

## Verification and limits

The bundled Electron runtime is launched and playtested on Linux with HTTP networking blocked. Actual native Windows execution is not available on this Linux host. The portable EXE's embedded Windows runtime and app archive are extracted/hashed against the verified inputs. The binary is unsigned and may be flagged as an unfamiliar app by Windows. No claim of zero bugs or native Windows playtesting is made.

Terrain previews are visual heightfields, not extra simulated worlds. They approximate distant caves, trees and structures until detailed chunks arrive; the transition can still show a shape/detail change. They do not alter saved terrain. See DESKTOP-STREAMING.md and VALIDATION.md for concrete results.

## Build from source

Node 24.22.1 / npm 11.9.0:

```text
npm ci
npm run build:standalone
npm run build:desktop
```

`build:desktop` packages an offline app and produces `dist/desktop-app/DCSMCRAFT-<version>-Portable.exe`. Runtime downloads are pinned and SHA-256 checked in desktop/electron/runtime.json. On Linux the script also prepares a matching Linux runtime for verification. Set `DCSMCRAFT_ELECTRON_CACHE` to reuse a verified runtime cache. `node scripts/build-electron.mjs --unpacked-only` skips portable wrapping; `--linux-only` prepares only the Linux test app. `node tests/desktop/runtime.mjs` tests the isolated app without opening your real save profile.

The old browser-dependent launcher remains source-only under `desktop/launcher.c`, accessible through `npm run build:desktop:legacy`; it is not the new release artifact.

---

# Historical release notes (superseded by the instructions above)

2.8.23 updates only the Giganto arena interface. H opens controls; Escape pauses. Options use Graphics, Sound, Camera, Battle and Controls tabs. See GIGANTO-INTERFACE.md.

2.8.22 adds smoother cinematic camera handoffs, new transformation and counter choreography, contact flashes and shaped energy waves. See GIGANTO-CHOREOGRAPHY.md.

2.8.21 adds stronger Giganto/Super Sonic tuning, directional flight, full-body ability poses, pre-fight Cyloop rings and arena rendering refinements. Hold C while circling grass as base Sonic. See GIGANTO-FLIGHT-CYLOOP.md.

2.8.20 changes only Giganto music playback: Phase 1 loops 0:00–2:00; Phase 2 loops 2:01–the end; victory plays 3:57–the end. See GIGANTO-SCORE-SEGMENTS.md.

2.8.19 adds Giganto’s timed destruction, a fading finishing track and a fixed arena sky after victory. High graphics adds anti-aliasing, sharper shadows and detailed terrain. Fly through the Overworld portal to return. See GIGANTO-DETONATION.md.

2.8.18 adds a playable return portal after Giganto’s defeat and concise arena/Overworld menu text. Fly through the gate to return; Escape pauses. See GIGANTO-RETURN-PORTAL.md.

2.8.17 refines the Giganto presentation and replaces the finale with a continuous chest-piercing flight and airborne defeat. Encounter cutscenes play in full; Escape pauses. See GIGANTO-CHEST-FINALE.md for verification and limitations.

2.8.16 expands the Giganto arena, atmosphere, transformation, adaptive combat and effects. See GIGANTO-CINEMATIC-OVERHAUL.md for controls, verification and limitations.

2.8.15 refines Giganto music direction and local soundtrack/cue controls. See GIGANTO-MUSIC-DIRECTION.md for verification, source notes and remaining limitations.

2.8.11 adds Homing Shot (V), smoother interrupted poses, jump/boost/climb animation fixes and saved cooldowns. See GIGANTO-VOLLEY.md for controls, results and limitations.

2.8.10 adds direct armor ascent, saved climb checkpoints, wall-running poses and arena-only contact shading. See GIGANTO-ASCENT.md for controls, validation and limitations.

2.8.9 adds contact-timed beam/grab counters, struggle poses, a staged finisher and safe scene saves/skips. See GIGANTO-CINEMATICS.md for this stage, controls and limitations.

2.8.8 adds Giganto turning/planted steps, reachable grabs and physical Wild Rush zigzags. See GIGANTO-MOBILITY.md for this stage and remaining limitations.

2.8.7: refined Giganto combat, stable rig blending, homing attack (X), Cross Slash (C), travelling energy waves, double sweep/stomp attacks, isolated Battle Settings, synchronized arena audio, camera visibility and torch seam/invalidation fixes. See GIGANTO-REFINEMENT.md for tuning, tests and remaining approximations. Extract the ZIP and run DCSMCRAFT.exe on Windows 10/11 x64 with Edge or Chrome installed. The launcher uses the existing local game/profile paths; export world backups before changing browser, profile or file location. Native Windows launch is unverified on this Linux build host.

Earlier release notes (superseded where they differ):

2.8.6: detailed Titan arena, pre-fight music and ring gathering, a longer 12,000-HP Normal fight at 45% player damage, revised character animation/arm targeting, cinematic VFX/Foley and reference-style HUD without the camera icon. Original sandbox UI/player state return afterward. Read TITAN-OVERHAUL.md for controls, actual graphics/balance/save behavior and remaining approximations. Extract before running DCSMCRAFT.exe; native Windows execution is untested on Linux.

2.8.3: user-supplied Undefeatable plays during the Giganto fight with adaptive phase/finishing cues, pause/settings handling and long-checkpoint synchronization. Read GIGANTO-MUSIC.md for timing limits and credits. Existing models, combat and worlds remain compatible. Extract before running DCSMCRAFT.exe. Native Windows launch is untested on Linux.

2.8.2: supplied detailed Sonic/Giganto skinned GLBs with embedded textures, 22/24 named clips, golden Super form, jaw/claw/emitter animation and cached loading. Custom motion remains approximate; read TITAN-ASSETS.md and GIGANTO.md for credits/limits. Existing worlds and combat balance are preserved. Extract and run DCSMCRAFT.exe on Windows 10/11 x64 with Edge/Chrome installed. Native Windows execution is untested on this Linux host.

Earlier release notes (character descriptions superseded above):

2.8.1: corrected narrow torches, persistent loaded-terrain lighting and reference-guided Giganto/Super Sonic/arena presentation. Read LIGHTING.md and GIGANTO.md for limits. Existing worlds, controls and combat balance remain compatible.

TITAN SIGNALS: GIGANTO 2.8.0: singleplayer fan-made Sonic/Giganto encounter. Pause → Titan Signals for portal coordinates/settings; E enters. Climb for the final Emerald, transform and fight, retry or return safely. Original low-poly rigs/audio and custom approximations are detailed in GIGANTO.md; this is not a 1:1 port. Existing worlds/art/gameplay remain. Run DCSMCRAFT.exe with installed Edge/Chrome. Native Windows launch is untested on Linux.

REMAINING NATIVE PIXEL ART 2.7.19: 651 existing block/state surfaces and 18 older utility sprites now use crisp original 16px motifs. Finished art, Classic and supplied images remain. Models, mechanics, UI, sound, controls and saves are unchanged. See ART-COMPLETION.md. Extract and run DCSMCRAFT.exe with installed Edge/Chrome. Native Windows launch is untested on Linux.

ITEM ART & RECOVERABLE ARROWS 2.7.18: 75 native icon/sprite or palette improvements; forward nocked bow arrows; arrows lodge in block surfaces, persist and can be picked up once. Air swings are silent. Crafting/Creative keep one X; the book still toggles recipes. Existing worlds, stats, armor/skins and controls remain. See ITEMS-ARROWS.md for pickup/lifetime limits. Extract and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows launch is untested on Linux.

FITTED ARMOR & CONSISTENT SKINS 2.7.17: all 38 armor icons/equipped pieces share original palettes and fitted layers; eleven skins keep their model proportions with corrected arm/hair/face pixels and matching portraits. Gloves use textures; overlapping outfit decorations hide under armor. Stats, weapons, controls and saves remain. See APPEARANCE.md. Extract and run DCSMCRAFT.exe with installed Edge/Chrome. Native Windows launch is untested on Linux.

PIXEL WEAPON ARSENAL 2.7.16: all 61 existing weapon/combat-tool models and icons share original sharp pixel art. Java 26.3 display profiles, first/F5 use poses and NPC weapon art; stats/controls/saves remain. Exact pose differences are documented in WEAPONS.md. Extract and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows launch is untested on Linux.

DOORS, VILLAGE CHESTS, HELD POSITION & SOUND DISTANCE 2.7.15: original instant doors, inward-facing textured village chests, reference-style held mount, and source-based distance/volume for world effects and tornado ambience. Holding animations and skin-arm rules remain. Existing worlds work. Extract and run DCSMCRAFT.exe using installed Edge/Chrome. Native Windows launch is untested on Linux.

PLAYER INVENTORY & RECIPE BOOK 2.7.14: compact classic-style inventory, click-to-open book with ingredient filling, and a mouse-following 3D skin/armor preview. Offhand pocket supports storage/saving/death rules; combat use is not implemented. Existing worlds work. Extract and run DCSMCRAFT.exe using installed Edge/Chrome. Native Windows launch is untested on Linux.

JAVA-STYLE ITEM ANIMATION 2.7.13: ordinary items/tools share a one-way Java-style swing and natural equip; specialized Devin/pistol/spear moves remain. Held objects hide the skin arm; empty slots restore it. Rest fits the actual item; swings are no longer pinned to the bottom each frame. See README.md for reference differences. Existing worlds work. Extract and run DCSMCRAFT.exe using installed Edge/Chrome. Native Windows launch is untested on Linux.

ITEM VIEW POLISH 2.7.12: holding an item hides the skin arm and keeps the visible item connected to the bottom edge, including equip and narrow-window framing. Empty slots restore the skin arm. Extract and run DCSMCRAFT.exe using installed Edge/Chrome. Existing worlds work. Native Windows execution is untested on Linux.

HELD ITEMS & BUILDING PERFORMANCE 2.7.11: held silhouettes stay connected to the bottom edge through use/attack, including small flat icons; equip stays smooth and empty slots show skin arms. Ordinary edited chunks mesh off-thread from copied loaded cells, with exact boundary invalidation and stale-result checks. Mesh appearance follows worker completion; startup/fallback can still mesh synchronously. Existing worlds work. Extract the ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows execution is untested on the Linux host.

ITEM MOUNT & CLEARANCE 2.7.10: held objects fill the former forearm area at a lower/closer mount, with actual-item-only camera bounds. Empty slots restore the skin arm at its existing position. Existing worlds work. Extract the ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows execution is untested on the Linux host.

ITEM-ONLY FIRST PERSON 2.7.9: held objects display without skin arms, gloves or shoulder armor. Select an empty hotbar slot to show the skin arm again. F5/wardrobe models and existing saves remain. Extract the ZIP and run DCSMCRAFT.exe with Edge/Chrome installed. Native Windows execution is not tested on the Linux host.

BLOCKY SKINS & 3D OUTFIT CHEST 2.7.8: all eleven outfits use classic block proportions and original pixel details. Open Skins from the title/pause menu; cycle, drag or turn the live 3D model. Selected skin persists on this device and matches F5/first person. Existing saves and gameplay remain. Extract the ZIP and run DCSMCRAFT.exe with desktop Edge/Chrome installed. Native Windows execution is not tested on the Linux build host.

CREATIVE SOUNDTRACK 2.7.7: six supplied C418 Volume Beta tracks play only in Creative Overworld; the 12 Alpha tracks stay Survival-only. Enable Options -> Music: ON and use Music/Master volume. Cinderworld music is unchanged.
Run DCSMCRAFT.exe normally. OPEN-BROWSER.cmd or the hosting tools can extract the embedded HTML with --extract-only; the same local game folder/profile paths remain. The Windows ZIP needs no separate HTML/audio download.
The source ZIP regenerates music data automatically with Node npm prebuild/predev/pretest. All originals are included. Existing saves and gameplay remain. Older notes below are historical.

SURVIVAL SOUNDTRACK EXPANSION 2.7.6: all 12 supplied C418 tracks play only in Survival Overworld. Enable Options -> Music: ON; adjust Music/Master volume. Creative stays silent; Cinderworld keeps original music.
Run DCSMCRAFT.exe, or OPEN-BROWSER.cmd for the bundled HTML at Multiplayer-Server/dist/DCSMCRAFT-Standalone.html. Hosting tools remain included.
Existing worlds, controls and sky/weather fixes remain. Older notes below are historical.

STEADY SKY & LIVING CLOUDS 2.7.5: world-anchored rain/snow/hail, stable sun/moon directions, smooth weather transitions and bright layered clouds that thicken/darken in storms. Existing world saves, controls and four-track Overworld music remain.

SUPPLIED OVERWORLD SOUNDTRACK 2.7.4: Clark, Sweden, Subwoofer Lullaby and Minecraft (C418) play in shuffled full-track rounds, offline. Enable Options -> Music: ON and adjust Music/Master volume. Cinderworld keeps original music. Existing worlds and controls remain.

RIGHT-SIDE ANIMATED SPLASH 2.7.3: randomized lines now sit beneath the right side of the logo with a 20-degree tilt and one-second pulsing animation. Gameplay and saves remain.

TITLE SPLASH REPAIR 2.7.2: 24 randomized game-related lines, responsive reserved space below the logo, and no immediate repeats.
Existing worlds and gameplay remain. Older numbered notes below are historical.

PERFORMANCE & CONSOLE MENU AUDIO 2.7.1: existing worlds work; no regeneration needed.
Options -> Video Settings adds Fast/Balanced/Detailed presets and eleven rendering controls.
Audio Options has Menu Sounds and Menu Volume for the supplied Select/Hover/Exit/Slide cues.
See PERFORMANCE.md for settings, measurements and limits. Matching multiplayer protocol is 4.
Extract this ZIP and run DCSMCRAFT.exe with Edge/Chrome installed on Windows 10/11 x64.
The same single-file game is included as DCSMCRAFT-Standalone.html. Native Windows launch
is unverified on the Linux build host. Export world backups before changing browser profiles.
Older numbered notes below are historical.

MATTHEW CLAIM CUE 2.4.1: the supplied MP3 plays once on the first successful pistol altar claim per world.
Works offline in existing saves. Master volume controls it. Already-claimed altars do not replay it.
The Devin Sword cue and all 2.4.0 features remain.

LIVING WORLDS 2.4.0: works in existing saves; no new world required.
Animated chests/doors, functional workstation visuals, safer container interactions,
more Overworld wildlife and cold-biome Snow Leopards/Polar Bears are included.
Both new animals also have Creative-only spawn eggs. See README/FEATURES for limits.

DEVIN SWORD CLAIM AUDIO 2.3.2: the supplied MP3 plays once after successful extraction.
Works in existing worlds; no regeneration needed. Master volume controls the claim cue.
Failed, interrupted or full-inventory attempts and reloads do not play it.

CONNECTED WORLDS 2.3.1: create a NEW WORLD for generator 14 connected terrain and varied caves.
Old saves keep their original generation and buildings. Ocean/lava crossings are shorter;
biomes connect over land. Cinderworld has denser bounded enemies. Hand clipping is reduced.
See README.md and FEATURES.md for details and limitations.

OCEANS & EXPEDITIONS: create a NEW WORLD for generator 13 terrain. Old worlds retain their saved terrain.
Oak Boat: five planks in a U at a crafting table. Right-click water to launch, right-click boat to board.
W/S paddle, A/D steer, Shift dismount. Boats persist; break to recover. Water only, not lava.
Cinderworld Ember Rays/Cinder Rocs fire telegraphed shots: aim and left-click with a melee item/empty hand to return them.
Wet/cold biomes have more frequent natural rain/snow. See README.md for limits and validation.

SKIN & GRIP REPAIR: held blocks touch the hand; sleeves/gloves match your F5 outfit.

FIRST-PERSON ARM REPAIR: square hands without fingers; smooth motions retained.
Existing worlds work; no regeneration needed.

LOCAL MUSIC: right-click a placed Jukebox, choose a disc and MP3, insert then Play.
Files stay in this browser profile, outside world backups. Creative: E > Stands.

DCSMCRAFT Desktop Edition — Windows 11 / Windows 10 x64
Current game release: 2.4.1 — Matthew Claim Cue
Snow accumulation, seeded tornado tracks, original sounds and grip repairs apply to EXISTING WORLDS. No new world needed.
See STANDS.md for abilities, fate rules, relocation safeguards and known limits.
H: summon/dismiss; F/G: abilities; V: Stand details. R keeps weapon abilities.
Owner rules and personal bindings: Options > Devil’s Palm & Stand Options.
Create a new world for generator 13 continents, broader biomes and wider village/Cinderworld structure spacing. See README.md and FEATURES.md for the
complete changelog, controls and partial/missing mechanics.

RUN
Double-click DCSMCRAFT.exe. The executable includes the complete offline game.
It writes the game to %LOCALAPPDATA%\DCSMCRAFT\Game\index.html and opens it
in a dedicated window using installed Microsoft Edge (or Chrome as fallback).
There is no manual server setup, account, installation, or online game download.
WebGL 2 and hardware acceleration are required. Edge is included with Windows 11.

This is an executable launcher with an embedded browser game, not a separate
native rendering engine. It does not bundle another Chromium installation.
The executable is unsigned. It has been cross-compiled and inspected on Linux;
actual Windows 11 launch cannot be verified in this environment.

CONTROLS
Double-tap W, holding the second press, to start sprinting. Keep moving to stay
running; stop moving to end sprint. Hold either Shift key to crouch and cancel
sprint on foot. In Creative flight, Shift still descends. Ctrl + W also sprints.

SAVES
The desktop browser profile is %LOCALAPPDATA%\DCSMCRAFT\DesktopProfile.
Worlds/settings persist there. Keep this folder when updating the executable.
The embedded HTML uses a stable file path so updates retain the same save origin.
Browser editions and the desktop profile have separate saves. Use Export world
backup and Saved Worlds > Import backup to move a world between them.
Save and Quit to Title before closing the window. Back up important worlds.

SOURCE / REBUILD
The original launcher source is desktop/launcher.c. Build the standalone
edition first with npm run build:standalone, then npm run build:desktop.
DCSMCRAFT_ZIG can point to a Zig compiler (tested: 0.12.0-dev.1286).
On Linux the build also requires gcc for the extraction verification helper.
Toolchain used here: @oven/zig-linux-x64@0.12.0-dev.1286, installed with npm
integrity verification in an isolated development directory. No compiler is
required by players. Source compilation preserves original HTML bytes.

VISUALS / CONTENT
Original pixel graphics, font, models and synthesized audio. Mechanics reference:
Minecraft Java Edition 1.20.4; this remains an incomplete independent sandbox.
Create a NEW world for villages. Old saves keep their original terrain generator.
Villagers have limited trading and basic routines, not full Minecraft village AI.
Video Settings offers independent Fancy Graphics, Ambient Occlusion, Sun Shadows, fog, clouds, FPS and extended terrain. Shadows default OFF for performance.
Distant surfaces are simplified beyond four chunks; view distance supports 24, with batched approximate heightfields beyond eight.

ANIMATIONS / DOORS — 0.4.0
Gripped 3D tools/blocks, combat/mining/use/equip/movement reactions and mob hit/
death/attack motion. Right-click either half of a village door to open or close.
Villagers operate their own doors. Six planks in two columns craft three doors.
Doors are two blocks tall, have thin collision panels, and retain their state in
saves. Hinge animation, signals, double-door linkage and other door types are
not included. Important saves should be exported before updating any edition.

AMBIENCE / EQUIPMENT / RELIC — 0.5.0
Options has separate master, ambience and creature volumes and category toggles.
Leather, iron and diamond armor can be Shift-clicked into four equipment slots,
or right-clicked while held. Craft diagonal spears with two sticks and a tip.
New terrain has lapis ore and shoreline cane for paper/books/enchanting tables.
Enchanting has six functional deterministic upgrades using XP points and lapis;
reference random offers, bookshelf power, enchanted books and anvils are absent.
Press J for The Devin Sword's seeded location. Hold left mouse on the planted
sword for 30 uninterrupted seconds with a free inventory slot. Charged hits
heal one health point; right-click pulses visible hostiles with a ten-second
cooldown. Spears and the sword are original additions beyond the reference.
Gear, enchantments, relic claim and power cooldown persist. Back up old worlds.

VISUAL / WORLD RENEWAL — 0.6.0
Menus retain their pixel style; Video Settings groups display, lighting, detail
and camera settings. Texture Pack > Classic preserves the v0.5 block artwork;
Renewed is the clearer new default. Both are already embedded and offline.
Choose brightness, 0-4 mip levels, particles, FPS cap, entity display distance,
biome colors/blend and View Bobbing. Resolution does not change clouds/particles.
Entity Shadows requires Sun Shadows; leave sun shadows off for lower GPU cost.
Create a NEW world for twelve biome types and the expanded generator. Saved
version-2/3 worlds preserve their old terrain algorithms in unexplored chunks.
New pines, birches, terrain materials, smoother/batched creatures and layered
original sounds are included. This remains an incomplete independent sandbox.

EXPEDITION UPDATE — 0.7.0
F3: precise XYZ axes, compass, sword coordinates/deltas/bearing/turn guidance.
F5: first person / behind / front, with animated player and worn armor.
Main menu -> Skins: Explorer, Carnival Clown, Trail Hero, Bandit.
Continuous dawn/dusk lighting, moonlight and star fades; revised creatures and
connected villager arms. New worlds have eight-home villages and two farms.
Villages receive a persistent Iron Golem that attacks hostiles. Existing terrain
is preserved; create a new world for expanded village structures.
Dirt equipment is craftable but fragile and cannot harvest stone or ore.
Windows launch remains unverified on the Linux build host.

LIVING WORLD UPDATE — 0.8.0
Options > Music enables original quiet felt-piano/bell pieces, OFF by default.
Music has its own volume and fades on pause/disable. Ambience is continuously
generated, biome/location/weather-reactive stereo; it no longer loops short buffers.
New worlds use generator 6: village centers are at least 384 blocks apart, with
eight regional wall/roof/clothing styles. Existing terrain versions 2-5 stay intact.
Weather: natural clear/rain/thunder cycles, cold-biome/altitude snow, dry deserts,
roof shelter, delayed thunder, visual lightning and exposed-crop rain hydration.
Creative pause > Weather selects a manual override or Natural. Video Settings
separately toggles Rain & Snow and Lightning Flashes. Weather saves with worlds.
No snow accumulation/melting, lightning damage/fire or reference weather parity.
Render distance reaches 24 chunks (~384 blocks) using distant heightfield batches
with approximate trees/buildings, and coverage masking while fine chunks arrive.
Full geometry remains within four chunks; underground detail stays near-field.

CINDERWORLD EXPEDITION UPDATE — 0.9.0
Generator 7 adds four volcanic regions, Hellfire/Brimstone veins at Y 15-70,
bastions/shrines/waystations with persistent loot and defenders, peaceful ash
deer, neutral Cinderbacks, hostile crawlers and wraiths. Diamond mines Hellfire;
iron mines Brimstone. Smelt Raw Hellfire, then craft 2 ingots + 1 Brimstone
into 2 alloy. Use normal equipment patterns for ten Hellfire gear recipes.
Each armor piece adds 10% heat reduction, without immunity. Pause > Cinderworld
Expedition has the guide and nearby structure coordinates.
New worlds place the Devin Sword in a distant temple, guarded by three armored
44-health Guardians. Defeat all three, then hold left mouse for 30 seconds.
They have a visible wind-up, local pursuit and saved defeat state. Creative/
Peaceful bypass the seal. The sword has new runes, shards, motes and pulse VFX.
Hailstorms hurt exposed players; tornadoes pull/lift nearby players. Roofs
provide shelter; Creative/Peaceful disable hazards. No terrain destruction or
hail accumulation. Weather and moving funnels save normally.
Jungles add pandas, koalas and bamboo; savannas add day-active tigers. Animal
climbing/breeding and full pathfinding remain absent. New terrain/temple needs
a new world, or a first Cinderworld visit for the new realm. Existing saved
generators 2-6 preserve terrain and old sword sites. Export backups first.
Windows launch remains unverified on this Linux build host.

MAIN RELEASE 1.0.0
R while holding The Devin Sword fires its homing Seeker; right-click keeps Pulse.
Choose one of ten skins in the title menu, including Devin The Hero.
Doors no longer close automatically. New worlds have underground obsidian rims
around cave lava pools; old worlds retain their original terrain.

OPTIONAL MULTIPLAYER
Offline singleplayer requires no server. The optional Multiplayer-Server folder
contains a Node.js relay, its dependencies, and instructions. Install Node.js
22.12+ or 24, then run Multiplayer-Server\HOST-SERVER.cmd. Use its LAN
address in the game's Creative Co-op menu and share the generated invitation.
Internet invitations require a publicly reachable HTTP(S)/WS(S) server.
Only Creative co-op is supported; see MULTIPLAYER.md for exact limitations.


ADVENTURE UPDATE 1.1.0
New worlds use generator 9: linked cave chambers, sloping passages, foothill
ridges and a grand Devin Sword Temple. Saved generators 2 through 8 retain
existing terrain. Guardians have 64 health and three telegraphed special
attacks: jump the shockwave, dodge runic bolts, sidestep the aimed lunge.
Zombies, Creepers, Spiders and Skeletons replace old Overworld night spawns.
Creeper explosions damage terrain; shelter stops arrows. Models, sounds,
textures and player interaction animations are original. Dropped items now
have solid 3D geometry. Video Settings retains Classic and v1.0 Soft artwork
alongside Renewed, with seven new independent rendering controls.
Hold right-click and jump to pillar; one-block ledges climb with headroom.
Minecraft Java Edition 1.20.4 remains the reference; parity is incomplete.

LIVING BLOCKS & CITADEL UPDATE 1.2.0
43 new usable blocks/items and recipes: copper/gold/emerald resources, mineral
storage, golden gear, clay/bricks, new masonry, hay, packed ice, bookshelves,
buckets and TNT. The crafting-table sidebar shows recipes.
Craft three iron ingots in a V for a bucket. Right-click source water/lava to
collect it, and right-click a surface to pour. Flowing levels cannot be collected.
Water flows seven blocks; lava three in the Overworld/seven in Cinderworld.
Sources drain downstream when removed; water/lava cool into rock. Water
extinguishes you, evaporates in Cinderworld, and moves floating dropped items.
Flint and steel now lights ordinary supported surfaces and TNT as well as
portals. Left-click fire to extinguish it. TNT has a saved four-second fuse and
chain reactions. Cactus contact hurts at the sides and top.
NEW worlds use generator 10: new ores/clay and a fortified 69x73 sword citadel,
36-block outer towers and a sealed inner sanctuary. Three Guardians have
100 HP, 35% resistance, heavier models and six alternating telegraphed attacks.
Sidestep the cyan ground sigil; flank a cleave; jump the shockwave and evade
volleys/lunges. Defeat all three to open the sanctuary, then extract the sword.
Existing generators 2-9 retain terrain and saved Guardian HP. General fluid,
fire, bucket, crafting and hazard changes also apply to existing worlds.
Fluid routing/surfaces, fire and TNT physics are simplified. Not every Java
block/item is implemented. Read FEATURES.md and export important world backups.


MATTHEW’S ARSENAL UPDATE 1.3.0
- Rare Overworld incursions: tentacles, opening ground, rising shrine, four Hellspawn and one persistent reward. Works in existing worlds.
- Matthew's Dual Wielded Pistols: hold left mouse to fire. Right mouse + WASD Dash; in air Sky Star; R aimed Air Trick; Space + right mouse beside a wall Wall Hike.
- Two rechargeable style charges. No invulnerability/fall immunity; this is an original Trickster-inspired adaptation.
- J journal shows coordinates and the Creative-only call-incursion button. Air Trick and unique claims are host-only in Creative co-op.
- Original code/models/sound. Existing Minecraft Java 1.20.4 reference and documented foundation limitations remain.


DANTE & TWIN IRON VISUAL UPDATE 1.3.1
Select Dante in Skins for a DMC3-inspired crimson coat and silver-haired voxel model.
Matthew’s pistols now feature black/silver long-slide models, wooden grips,
animated slides/hammers, alternating wrist recoil and casing effects in first
person and F5. Their mechanics and existing saves remain compatible.


TWIN REPORT AUDIO UPDATE 1.3.2
Matthew’s pistols have new original reference-informed firing audio: black/silver
reports, stronger attacks and body, mechanical clacks, short tails, four variants
per pistol and subtle hand panning. Master volume and mute apply. Existing saves,
weapon mechanics and visuals remain compatible. Guest co-op shots have local audio.


TRICKSTER WAKE UPDATE 1.3.3
Dashes now have cyan/violet sigils, speed lines and fading body echoes.
R approaches any aimed living creature, or free-blinks up to 18 blocks when no
creature is targeted. Free aim stops before blocks; insufficient room fails free.
Looking down while grounded stays level. Charges, cooldowns, dash distance and
fall damage remain. Creative flight still disables style; co-op R stays host-only.
Pistol and Devin Sword moves/cooldowns now sit above the hotbar and survival bars.
Minimal particles suppress effects; Fancy and Dynamic FOV keep their controls.

JUKEBOX — 1.3.4 (OPTIONAL INTERNET FEATURE)
Craft eight planks around a diamond, place the Jukebox and right-click to paste a
YouTube video link. Creative also has the block. Escape > Jukebox opens its
controls or a temporary player. Play starts the official visible video player;
other menus pause it. Stop removes it. Block links/volume save, not autoplay.
Master volume applies; existing original game music keeps its own toggle.
YouTube requires internet and allows only some embedded videos. Local HTML and
this file-based desktop launcher can be rejected with YouTube error 153. Use
Open on YouTube, or serve the game using the included optional Node server and
open http://localhost:8787 in a normal browser; multiplayer need not be enabled.
Export/import backups to move saves between the local file and server origins.
YouTube requests were blocked by this build environment (HTTP 403), so actual
streaming and Windows execution remain unverified. Offline game play is retained.

CHAT / SURVIVAL CO-OP — 1.4.0
T opens in-game chat; / opens owner commands; Tab opens players/invitations.
Use /help for the supported commands. Only the owner can run them.
Survival Overworld sharing now supports host-controlled inventories, real mining,
crafting, shared chests/furnaces, hazards, hostile damage, death/respawn and saved
private guest reconnect profiles. Creative remains available. Keep the owner's
game and Node relay open. The relay alone does not simulate or save a world.
Friends on different networks need a publicly reachable relay, normally HTTPS/WSS.
PUBLIC_URL, Docker/Caddy/Compose and optional Render deployment files are supplied;
no public server is automatically created. See MULTIPLAYER.md for setup/limits.
External internet deployment and Windows execution remain unverified here.

PUBLIC HTTPS / WSS — 1.4.1
Run HOST-PUBLIC.cmd for temporary internet hosting. Install Node.js and cloudflared
once (winget install --id Cloudflare.cloudflared -e), then reopen the window.
The launcher starts a localhost relay and Cloudflare Quick Tunnel, checks HTTPS
and WSS, prints/writes a ready public address, and opens it in a browser.
To retain an existing world, open this executable, load your saved world, choose
Multiplayer > Public HTTPS, paste that address, test it, host, and copy the invite.
Keep the hosting window and game open. The random address changes on restart;
stable guest inventory persistence requires a fixed HTTPS relay address/browser.
Cloudflare is an external service and cloudflared is not bundled. Live tunnels
could not be verified here (network HTTP 403). Native TLS/WSS transport is tested.
Permanent hosting can use TLS_CERT_FILE/TLS_KEY_FILE or the supplied proxy config.
See MULTIPLAYER.md for all setup and limits. Offline play remains self-contained.

CAVE UPDATE — 1.7.0
Four underground regions, linked tunnels and rare abandoned mineshafts now
populate new worlds. Timber corridors contain slowing cobwebs, decorative rails
(no minecarts) and persistent supply chests. Ore veins are more spread out;
diamonds are small uncommon deposits at Y -56 to 8. Dark caves can spawn ordinary
night hostiles during daylight. Bring torches; local lighting checks approximate
brightness and may suppress through walls.
The rare Watcher is pale and long-limbed, watches from afar and laughs when seen.
It never attacks, cannot be damaged, drops nothing and retreats from light or
sustained observation. Continuous original cave/night ambience has irregular
creaks, echoes and drips. Creative inventory has 24 spawn eggs; search “spawn egg”
and use a supported clear block face. Eggs have no Survival use/recipes/drops.
Old terrain remains compatible; new cave layouts/mines/ore placements require a
new world. Cinderworld, the Titan trial and the all-Guardians sword gate remain.
Export a backup before upgrading. The packaged browser game is tested; native
Windows launch and direct file navigation are not verified in this Linux setup.

FORGE & MOTION — 1.8.0
All 42 non-pistol weapon/tool variants have original thin pixel silhouettes,
material-specific edges and consistent grip sockets in hand, F5 and dropped views.
The Devin Sword has a stepped turquoise blade, raised ridges, a gold grip/guard
and restrained blade-bound glints. Its planted temple display uses the same model.
Minimal particles hides glints/sheen/trails; fewer impact sparks avoid aim clutter.
Flint and steel is a flat double-sided transparent cutout, without cuboid sidewalls
in hand or when dropped. Other working block and ordinary item models are retained.
Non-pistol player rigs have elbows, distinct swings/thrusts/digging, smoother gait,
prone swimming, stationary treading and smooth land recovery. Space still swims up.
This is visual animation; the upright collision body and water physics are unchanged.
Matthew's pistols retain their original models, recoil, F5 rig/poses, audio and skills.
Eight Cinderworld foe/neutral designs have distinct silhouettes and articulated
jaws, robes, claws and weapons. Damage flashes restore their original glowing eyes.
World generation stays at version 12. Existing saves/progression remain compatible.

SUPPLIED ASSETS — 1.8.1
Options > Video Settings > World detail > Texture Pack > Supplied Assets.
183 user-supplied Minecraft PNGs are embedded for offline play. This optional
pack is off by default; original packs and custom content remain. Models and
mechanics are unchanged. Animated strips use frame zero with existing shimmer.
Supplied Minecraft artwork belongs to Mojang/Microsoft, is not covered by the
project MIT license, and is attributed in licenses/SUPPLIED-ASSETS-NOTICE.txt.

FIELD & FORM — 1.9.0
All 16 current Overworld creature types have original stylized voxel rigs,
including villagers, golems, night enemies, Guardians and The Watcher. Two
legacy saved mob types use palette variants. Villager head turns are bounded
to 60 degrees left/right, with limited vertical look and attached folded arms.
97 ordinary/plant/door items are flat transparent sprites in hand, F5 and
when dropped. Flat drops face the camera. Solid blocks and modeled weapons,
including Matthew's pistols and The Devin Sword, retain their depth.
The optional Supplied Assets pack repairs workstation/chest/torch/door UVs,
plant/rail surfaces and flat inventory sprites, with correct chunk remeshing.
Existing worlds, game statistics and progression remain. No new world needed.
189 source PNGs are attributed to Mojang/Microsoft; animations still use
frame zero. See README.md, THIRD_PARTY.md and VALIDATION.md for exact coverage.

The boss-only combat/cinematic polish is documented in TITAN-COMBAT.md.

TITAN-CYLOOP.md covers the complete physical Cyloop, aimed swats and supplied boost effect.
