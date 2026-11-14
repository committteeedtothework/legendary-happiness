# End Cities and world polish — 2.21.0

Outer End islands now contain seeded purpur cities with connected towers, staircases, railed bridges, treasure rooms, End Rod lighting and occasional ships. Shulkers open to fire homing shots that cause five seconds of levitation. Defeated guards stay defeated; opened chests and player edits persist. Ships can contain Elytra. Equip them in the chest slot and hold Jump while falling to glide. Look to steer; release Jump to stop. Unpowered gliding always descends, respects swept collisions and uses durability.

DRAGOON retains its health, crystals, phases, perching, rewards and return route. Its flight now uses continuous velocity, bounded turns, banking and pitch. Swoops anticipate the dive, fly through a chosen attack point and climb out. Endermen have a connected neck/head and stable head height. Duplicate Enderman/Shulker loot paths are guarded.

Villages gain eight profession annexes, for sixteen homes in current worlds. Blacksmiths, toolsmiths, armorers, librarians, clerics, fletchers, fishermen and butchers have distinct trades and clothing. Workshops use existing functional furnaces, smithing tables, blast furnaces, brewing stands, storage and crafting stations. Blacksmith workshops include an insulated forge and equipment chest; libraries contain bookshelves. Annex roads and offsets vary by seed and biome, alongside existing biome-specific materials, roofs and stilts. The first eight homes retain their positions. Older generator versions retain their original settlements. Existing settlement records gain the new residents once without resurrecting old residents or guards. Saved block edits override generation.

## Controls and inventory

- **F** swaps the main and offhand stacks. Existing active Stand bindings take priority; inventory slots and mobile Actions → Swap hands remain available.
- **Use** activates the offhand when the main hand is empty or holds a melee weapon, with doors, containers and villagers retaining interaction priority. **Alt + Use** explicitly uses the offhand.
- Secondary melee weapons attack; shields block frontal strikes and projectiles using their own durability. Bows can draw/fire from the offhand. Blocks, food, Pearls and other items use their existing actions. Holding a two-handed pistol retains its original controls.
- Controller: **Crouch + D-pad Left** swaps hands. Existing Use operates the secondary item. Mobile: **Actions → Swap hands**, then the existing Use control.
- Drag a picked-up stack outside the inventory and release, or click outside with a carried stack, to drop it. Left drops the stack; right drops one. Metadata and stack counts are retained, including 64-block stacks. Survival co-op drops are host-authoritative.
- Double-click collects compatible items up to the stack limit. **Sort** merges/orders the backpack while leaving the hotbar and equipment in place. Double-click collection is local/host-only; normal co-op stack transfers and sorting remain available.

Rapid melee contacts now deal at least one point of damage instead of rounding weak hits to zero. Charged attacks, criticals, enchantments and full-charge-only healing retain their rules. Client melee requests use a shorter network throttle; world placement retains its existing pacing.

## Presentation and performance

Hotbar/inventory icons for modeled items are rendered from the actual held geometry and materials. Flat items share their existing held sprites. One cached thumbnail is generated per frame; repeated icons reuse it. If a second WebGL context is unavailable, original icons remain usable. Opaque wool/concrete/terracotta/End material faces lose isolated high-contrast speckles without modifying cutouts or adjacent atlas cells. Creature cloth uses quieter coherent texture patches. Atlas mip filtering retains tile boundaries.

The day display uses the game's pixel font and a restrained square panel. Successful-save text is hidden; real save failures and temporary-storage warnings remain visible. Offhand items appear in first/third person and a dedicated HUD slot, including narrow-screen layouts. Distant city guards retain their health while unloading from the active entity list.

## References and limits

Minecraft Wiki pages consulted: [End City](https://minecraft.wiki/w/End_city), [Shulker](https://minecraft.wiki/w/Shulker), [Elytra](https://minecraft.wiki/w/Elytra), [Levitation](https://minecraft.wiki/w/Levitation), [Villager](https://minecraft.wiki/w/Villager), [Village](https://minecraft.wiki/w/Village), [Inventory](https://minecraft.wiki/w/Inventory), [Dual wielding](https://minecraft.wiki/w/Dual_wield) and [Attack](https://minecraft.wiki/w/Attack).

This remains an original adaptation. Cities use authored connected tower modules rather than Minecraft's full recursive generator. Shulkers do not reproduce every vanilla teleport/bullet-routing rule. Shells are collectible; portable Shulker Boxes are not implemented. Elytra use a conservative glide model rather than full vanilla flight physics or firework boosting. Villager trades are fixed, restock at sunrise and do not include reputation or profession leveling. Added workshop roles use existing stations where a vanilla station is absent. Offhand melee is an intentional extension beyond Java's normal restrictions. Dimension travel remains singleplayer. No exact visual or mechanical parity is claimed.
