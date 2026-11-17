# The End — 2.20.0

Craft an Eye of Ender from an Ender Pearl and Blaze Powder. Endermen appear on dark nights and in The End; looking into their eyes provokes them. Use Eyes outdoors to find a stronghold, then follow them downward near the destination. Each thrown Eye can break. Fill the portal's twelve frames and enter its centre.

Destroy the pillar crystals to stop DRAGOON healing. Arrows work in flight; attack the head with a sword when it perches. Avoid charges and lingering breath. Defeat opens the exit fountain, awards experience and a trophy, and unlocks a gateway to outer islands. The exit returns to your bed/world spawn. Four placed End Crystals around the fountain summon another encounter. The dragon egg is awarded once.

Ender Pearls teleport on impact with five points of damage and require a clear landing. Chorus Fruit provides food and a short safe teleport. The pause menu's **The End** journal records recipes and your discovered stronghold.

## Content and compatibility

Original articulated voxel models, pixel textures and procedural effects are included. Lava is opaque; water, lava, fire and portals animate within their own texture cells. Brewing stands display active bubbles and filled bottles. Loaded nearby fire/lava contribute sound. Explosions use seeded pressure rays rather than evenly removing spheres.

Existing block/item identifiers, recipes, equipment stats and saves are retained. Strongholds appear in naturally generated terrain; explicit saved block edits take precedence. Back up worlds before exploring a new version. The desktop runtime and legacy Windows HTML edition use separate profiles; transfer worlds with Export/Import Backup.

## References and practical differences

Minecraft Wiki references consulted for mechanics:

- https://minecraft.wiki/w/The_End — island, void, platform and exit progression.
- https://minecraft.wiki/w/Stronghold and https://minecraft.wiki/w/Eye_of_Ender — locating strongholds and twelve-frame activation.
- https://minecraft.wiki/w/Ender_Pearl and https://minecraft.wiki/w/Enderman — teleportation, damage and provocation.
- https://minecraft.wiki/w/Ender_Dragon and https://minecraft.wiki/w/End_crystal — healing pillars, flight/perching, breath, exit and resurrection.
- https://minecraft.wiki/w/Explosion — direction-dependent blast attenuation.

This is a compact original adaptation: three seeded strongholds use a portal chamber, approach and small library rather than Minecraft's complete stronghold generator. DRAGOON uses the game's existing combat and voxel renderer. The End Crystal recipe uses obtainable Blaze Powder instead of a Ghast Tear. Outer islands, chorus and a return gateway are included; End cities, Shulkers and Elytra are not. Resurrection restores crystal encounters but does not rebuild player-mined pillars. Dimension travel remains singleplayer, consistent with the existing Cinderworld architecture. No exact Minecraft visual or behaviour parity is claimed.

## Verification

Automated coverage checks append-only content and save definitions, seeded terrain, frame activation, crafting, Eye/Pearl behaviour, crystal healing, perch hit detection, death/rewards, repeat summons, gateway return, Enderman aggression, malformed metadata, shader paths, brewing animation and irregular explosions. Browser tests exercise crafting through the UI, an actual stronghold portal, reload, combat, victory, exit, mobile journal and fluid rendering. Release verification includes logs and screenshots. Windows packages are built and payload-verified on Linux; native Windows execution is not verified here.
