# Overworld expansion — 2.7.0, stage I

This release is the first tested stage of the request to implement all remaining non-Nether/non-End features. **The full request is not complete.** It adds no new Nether/End blocks, items, species, structures or progression. Existing Cinderworld/custom quests and previously available content are retained. Content reference remains Java 26.3; mechanics remain custom/partial.

## Completed in this stage

- Fixed the oversized projection that cropped expanded block icons below their canvas. Cubes and shaped previews fit the inventory cell. Atlas initialization also works when a block icon is requested before a renderer exists.
- Original species-colored, seeded spotted spawn eggs; round compass/clock faces; readable powders, gems/nuggets and milk bucket. Exact existing supplied item PNGs take priority where available. Hotbar, catalog, held sprites and flat drops share the same icon source.
- Existing cow, pig/Grazer, sheep/Woolling, chicken and rabbit feeding, food following, same-species breeding, visible love hearts, half-size babies, parent following, 20-minute loaded-time growth and five-minute adult cooldown. Feeding babies advances 10% of remaining growth. Offspring/feeding/timers persist. Births check solid space, loaded terrain, walls and population limits. Adults do not grow into low ceilings; player/pistol/arrow targeting and movement use the smaller baby size. Babies cannot be sheared, milked or farmed for meat/XP.
- Adult chickens lay one egg every 5–10 loaded minutes. Sheared adult sheep occasionally graze grass/short grass for 40 ticks and regain fleece; the consumed grass becomes dirt. No grass spread/complete ecosystem is claimed.
- Milk adult cows with empty buckets. Full inventories preserve stacked buckets without loss or duplication. Drinking milk clears positive and negative status effects and returns the bucket. Creative milking also fills a bucket; drinking in Creative keeps its milk bucket.
- Eleven more functional enchantments: Silk Touch, Fortune, Looting, Smite, Bane of Arthropods, Fire Aspect, Fire Protection, Blast Protection, Projectile Protection, Respiration and Aqua Affinity. Together with existing enchantments the table has 24. Conflict checks happen before charging XP/lapis and conflicting choices are disabled in the menu.
- Silk Touch retrieves supported ores/glass/leaves/clay/ice/turtle eggs without ore XP. Fortune raises supported ore yields and gravel flint chance, without multiplying stored minerals/chests/double slabs. Smite/Bane bonuses affect their supported target classes; Bane slows spiders, Fire Aspect deals tick-based burning (water extinguishes), Looting raises supported ordinary land-animal and common night-mob yields, specialized armor reduces matching damage, Respiration saves air and Aqua Affinity removes the underwater mining penalty. Host and Survival guests use the same authoritative rules.
- Fixed the relay connection probe's obsolete protocol-2 expectation. Browser/relay/probe now share protocol 4, with older clients rejected; use matching 2.7.0 files.

## Partial behavior in this stage

Farm AI uses existing local steering, not global pathfinding or a full genetics/taming system. Love scans run once a second; births stop at 64 local farm animals or 256 total entities. Farm/chicken/growth timers pause outside the existing loaded active region. Breeding grants no XP orb; newborn proportions reuse the existing original model at half scale. Rabbits/pigs/sheep use existing custom variants. Milk consumption is instant. Eggs are real inventory/recipe ingredients, not throwable hatching projectiles. Fleece regrowth consumes finite pasture; general grass spread remains unfinished.

Enchanting retains deterministic offers/raw XP costs and has no books/anvil/random bookshelf power. Fortune/Looting do not implement every Java loot table or every creature/plant, and Silk Touch does not provide every wall/plant state. Smite/Bane/armor/fire timings remain approximate. Fire Aspect uses damage/glow rather than a complete reference fire overlay, does not cook drops, and burning finishing blows do not currently credit kill XP. Respiration uses deterministic air savings. Additional enchantments remain in the backlog.

## Remaining stages — not implemented by this release

1. Redstone and automation: network strength/update order, switches/buttons/plates, lamps, repeaters/comparators, pistons/observers, hoppers/dispensers/droppers/crafters and transfer safety.
2. Workstations/storage/decorations: anvil, grindstone, loom, cartography/fletching, lectern/composter, campfire cooking, double chests, bundles, signs/hanging signs, banners, candles, paintings/frames, armor stands, editable books/names and full bed/state families.
3. Overworld ecology: the remaining eligible creature roster/eggs, taming/breeding/AI, horses/leads/saddles/equipment, bees/honey and Copper Golem sorting. Existing farm and aquatic implementations need full behavior/loot/navigation parity.
4. Exploration/progression: eligible missing biomes/structures, archaeology/pottery, sculk/ancient cities, Trial Chambers/vaults, Creakings/resin/sulfur, armor trims, beacons, wind charges, map/cartography and missing renewable Survival sources. Nether/End encounters/sources are excluded.
5. Equipment/combat: remaining non-Nether/End enchantments, complete potion/effect/brewing catalogs, enchanted books, offhand/melee shields, sweeping/knockback/timing, projectiles/fireworks/totems and exact food rules.
6. Transport/building simulation: boats/rafts/chest variants/passengers, carts/rails, general waterlogging, attachment/support updates, copper aging/waxing, exact fluids/fire/blasts/gravity blocks, crops/trees and propagated lighting.
7. Multiplayer/polish: independent player simulation areas, dedicated simulation/host migration, supported-realm travel, permission/account/ban/PvP options, synchronized audio/animations, complete advances/Hardcore, models/UI/accessibility and performance.

The exhaustive named registry/creature/enchantment remainder is [reference/overworld-backlog.json](reference/overworld-backlog.json). Every listed registry entry carries its scope: remaining Overworld work, excluded Nether/End material, or excluded administrative/internal state. A custom counterpart is not falsely labeled absent simply because its exact Minecraft registry name differs. The full reference [CSV](reference/content-audit-26.3.csv) retains all entries for comparison.

## Playing and compatibility

Extract the browser ZIP and open DCSMCRAFT.html in Edge/Chrome, or extract the Windows ZIP and run DCSMCRAFT.exe. Singleplayer is offline. Existing worlds need no regeneration; their generator remains 16 or their saved older version. New item IDs append after the old Creative list; blocks, recipes, terrain, public assets and existing inventory indices are preserved. Export backups before opening a new save in older builds. Multiplayer needs the new protocol-4 relay and clients. See MULTIPLAYER.md.
