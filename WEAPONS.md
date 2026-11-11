# DCSMCRAFT 2.7.16 — pixel weapon arsenal

Reference: **Minecraft Java Edition 26.3**. This update covers all **61 existing weapons/combat tools**, with no new stats, items or combat systems.

| Family | Entries | Art and rendered states | Pose status |
| --- | ---: | --- | --- |
| Swords | 9 | Dirt, wooden, golden, stone, copper, iron, diamond, netherite, hellfire; shared pixel model/icon; idle, swing, mining/use/equip | Java handheld numbers and six-tick first-person swing; original art and rig conversion |
| Axes, pickaxes, shovels, hoes | 36 | Same nine materials, distinct stepped heads/handles; shared model/icon | Same handheld conventions; existing mining/combat behavior |
| Spears | 9 | Same materials; long thin shafts and stepped heads, icon/drop/player model | Java 26.3 spear display numbers; adapted original origin; existing custom thrust/abilities, not Minecraft spear combat parity |
| The Devin Sword | 1 | Broad cyan pixel blade, fuller/ridge markings, golden hilt; three restrained square glints; planted/held/dropped/F5 model | Handheld convention with original art basis; existing special combos/abilities remain custom |
| Trident | 1 | Three stepped prongs and shared green shaft/icon | Documented held/throwing transforms; adapted origin/scale, actual charge, overhead F5 windup; existing throw/return/Riptide behavior |
| Mace | 1 | Squared steel head with contrasting center/core and wrapped handle | Its separate 26.3 handheld-mace display numbers; existing swing/smash mechanics |
| Bow | 1 | Four discrete draw frames with pixel string/arrow, shared idle icon | Actual draw state; raised two-arm F5 aim; adapted original sprite/origin |
| Crossbow | 1 | Four draw/loaded frames, pixel limbs/string/bolt, shared idle icon | Actual charging/loaded/fire state; two-arm aim; existing 1.25-second load retained |
| Shield | 1 | Metal border, distinct wood planks/rivets, real thin silhouette, shared icon | Actual guard and F5 arm pose; entity-axis/handle conversion approximate; main-hand use only |
| Matthew's Dual Wielded Pistols | 1 | Two original 24×16 stepped profiles; silver/black finishes; three rigid assemblies each; new paired icon | Consistent blocky sockets; preserved independent recoil, slides, hammers, flash/casing and custom dash moves; no direct Minecraft equivalent |

All palettes are explicit solid RGB colors. Standard profiles are 16×16; long/special art uses up to 32 pixels per axis. Nearest magnification/minification, no mipmaps and opaque palette texels avoid blur and gradients. Alpha is binary; holes and stepped edges are real missing geometry. Adjacent pixel side faces are removed. Each rigid part is one mesh, not one object per pixel. Bows/crossbows prebuild four small frames and switch visibility; there is no geometry rebuild during charging. Pistol subassemblies retain their own independent recoil clocks.

The same source grids paint inventory/hotbar icons and build the held, dropped and player models. Weapons deliberately use these **original assets in all three texture packs**, including Supplied Assets. Non-weapon pack art is unaffected. Skeleton bows, temple Guardian sword/shield and Dread Knight blades reuse the same original equipment rather than plain substitute cuboids; creature bodies/AI/stats remain.

## What matches, and what remains approximate

The numeric right-hand first/third display rotation, scale and translation facts are documented with source URLs in [reference/weapon-poses-26.3.json](reference/weapon-poses-26.3.json). Handheld, mace, spear, bow, crossbow, shield/guard and trident held/throwing profiles are separate. First-person ordinary mounts use Java's camera-space base and six-tick swing, not frame-by-frame edge pinning or aspect-dependent scale. Sword animation does not schedule hits; game simulation still controls all cooldowns and damage.

**This is not pixel-identical Minecraft posing.** Original geometry and the existing 1.8-block character rig need coordinate conversion. Third-person translations are normalized to actual palms; shield/entity axes and long-weapon origins are adapted, rather than importing Minecraft entity models. Narrow windows naturally crop the fixed camera-unit mount more, as in Java. A moving/equipping weapon can leave the bottom of the view.

The requested **item-only first-person rule** stays: a skin arm appears only when empty. F5/inventory/wardrobe retain the character. Custom Devin/pistol/spear abilities retain game-specific animation curves. Spear combat remains the existing custom thrust. New-item equip does not render the old item lowering first. Offhand blocking/use and F-key swapping remain missing. Remote players receive the new geometry but existing networking does not transmit every draw/block/ability state; remote special/use animation parity remains incomplete. General locomotion/swimming and camera behavior remain the existing original system.

## Compatibility and delivery

Combat definitions, hit tests, damage, durability, cooldowns, ammunition, recipes, controls, inventory handling, world saves and networking source are unchanged from 2.7.15. A regression manifest at `reference/weapon-gameplay-2.7.15.json` checks the relevant source hashes (the release label is the only data.js edit). Existing terrain generation 16 and relay protocol 4 remain. No new world is needed.

Use the Browser ZIP's `DCSMCRAFT.html` with desktop Edge/Chrome, or the Windows ZIP's `DCSMCRAFT.exe`. Source includes all pixel grids, pose references, assets, dependency locks and test code. Exact standalone browser tests run over loopback with outside requests blocked. Native Windows launch and direct file navigation are not tested on the Linux build host; payload/extraction and source reconstruction are checked separately. See VALIDATION.md for results and limitations.
