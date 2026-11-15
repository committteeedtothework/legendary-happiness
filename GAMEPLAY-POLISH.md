# DCSMCRAFT 2.22.0

Camera changes, mob defeats, loot reminders, successful ability-hit counts and routine respawns no longer create status toasts. New worlds keep their day announcement and warn if storage is unavailable. Errors, controls, achievements, user chat and progression notices remain available.

Both camera views now use the same current-frame action clock. Fists, blocks and ordinary tools start their shoulder swing together. Land arms stay straight, the torso does not twist independently of its attached limbs, and held objects stay attached to the palm. Swimming retains its articulated strokes, and bows, crossbows, shields, tridents, custom weapons, pistols and Elytra retain their specialized poses. This is a rigid voxel character, not a newly skinned mesh.

Successful critical damage emits a camera-facing burst of stepped stars at the target's near body surface. The stars fade from pale tan to brown, shrink and clear after 0.42 seconds. Particle settings apply; minimal particles retain the existing crosshair cue. The effect pool is bounded and the star geometry is shared. Damage, attack strength, loot, XP and invulnerability rules are unchanged.

Animal calls have separate species articulations: moos, bleats, oinks, clucks, squeaks, grunts, bellows, chuffs, growls, whinnies, chirps and aquatic breaths/bubbles. Hurt, attack and death calls differ from idle calls. Babies use a higher pitch. These are original synthesized effects, not animal recordings or copied Minecraft assets. Assigned End-creature voice aliases now resolve, and Shulkers have a shell rattle. Sound variants are generated only when first selected and then cached; control-rate filtering reduces synthesis work. Existing positional attenuation, occlusion, volume and mute controls apply.

## References

Reviewed Minecraft Wiki pages: [melee attacks/critical hits](https://minecraft.wiki/w/Melee_attack#Critical_hit), [damage](https://minecraft.wiki/w/Damage#Critical_hit), [particles](https://minecraft.wiki/w/Particles), [cow](https://minecraft.wiki/w/Cow), [pig](https://minecraft.wiki/w/Pig), [sheep](https://minecraft.wiki/w/Sheep), [chicken](https://minecraft.wiki/w/Chicken), [rabbit](https://minecraft.wiki/w/Rabbit), [horse](https://minecraft.wiki/w/Horse), [panda](https://minecraft.wiki/w/Panda), [polar bear](https://minecraft.wiki/w/Polar_Bear), [turtle](https://minecraft.wiki/w/Turtle) and [dolphin](https://minecraft.wiki/w/Dolphin). The references describe star/cross critical particles, distinct ambient/hurt/death calls, higher baby pitch and local sound ranges. [Animal Diversity Web: koala](https://animaldiversity.org/accounts/Phascolarctos_cinereus/) informs its low bellow. No reference media is bundled.

## Downloads and saves

The bundled Windows runtime is DCSMCRAFT-2.22.0-Portable.exe. The separate previous Windows HTML edition is DCSMCRAFT-Windows-HTML-2.22.0.zip; it requires installed Edge or Chrome. Close the old app before launching the update. Both retain their existing save profiles. Use world-backup export/import when switching editions. No world migration is required. The Windows executables are unsigned; native Windows execution must be checked on Windows.
