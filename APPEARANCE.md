# DCSMCRAFT 2.7.17 — fitted armor and consistent skins

Reference remains **Minecraft Java Edition 26.3**. This release changes appearance, with **38 existing armor entries and eleven existing skins**; it adds no equipment or gameplay system.

| Area | Updated behavior |
| --- | --- |
| All armor icons and equipped surfaces | One original, discrete pixel palette per material, shared in Classic, Renewed and Supplied Assets. No gradient/filtering/mipmap blur. Non-armor pack textures remain. |
| Helmets | Fitted outer shell, opaque crown and real alpha face opening/cheek pieces; head pixels stay visible where intended. Both turtle aliases use the same green shell palette. |
| Chestplates | Open collar, torso layer parented to the existing body, upper guards and lower bracers parented to the existing arm/elbow sections. Opaque guards hide only covered sleeve meshes. |
| Leggings/boots | Separate waist, thigh/shin and boot layers. Slight inward clearance and different shell depths prevent the former coplanar seams. Boot soles rest at the existing feet. Covered leg texels are masked. |
| Chainmail | Actual binary alpha holes; cloth/skin underneath remains intentionally visible. This is a deliberate underlayer, not failed clipping. |
| Costume layers under armor | Long coat tails, decorative sheath/hilt and the astronaut backpack hide only when the equipped region would overlap them; removing armor restores the original skin decorations. |
| Arms and gloves | Shared twelve-row arm texture, cropped continuously across the existing upper arm, elbow and palm sizes. Gloves are skin pixels rather than inflated boxes. First-person and F5 use the same original texels and neutral material tint. |
| Faces/hair/clothes | Mirrored side hairlines, skin-tone nose/mouth details, recognizable eye colors, coherent sleeve stripes/cuffs and distinct outfit backs. Random scattered shading and white arm maps are removed. |
| Wardrobe portraits | Small SVG portraits are painted from the same front texels as the actual 3D skin, rather than separate inconsistent artwork. |
| Inventory/F5/wardrobe | All use the same model builder and equipment surfaces. The selected skin and equipment remain saved. |
| First person | Empty slots retain the selected skin arm and matching equipped sleeve. Holding anything still hides the whole arm, as requested previously. |

Materials covered: **dirt, leather, chainmail, copper, iron, golden, diamond, netherite and hellfire** (four pieces each), plus **turtle_shell and turtle_helmet** (two helmet entries). They retain existing defense, toughness, durability, crafting and enchantment behavior. Mixed sets use each item's own palette.

Skins covered: **Devin The Hero, Moonwalker, Moss Ranger, Cinder Smith, Tidekeeper, Explorer, Carnival Clown, Trail Hero, Bandit, Dante and Vergil**. Their names, palettes, defining costumes, and classic base models remain: 8×8 head, 8×12 torso, 4×12 limbs on the existing 1.8-unit rig. Existing joint locations, animation curves, combat poses and first-person weapon mounts remain. Replacing glove boxes with texels and suppressing covered accessories changes cosmetic layers, not those base proportions.

## Limits

These are original voxel cosmetics, not imported Minecraft armor models or pixel-identical skin assets. The game still has eleven bundled skins; arbitrary PNG skin import, arbitrary leather dye and full armor-trim appearance are not added. Existing functionality/limitations of those systems remain. Chainmail holes deliberately show the outfit. Equipped armor hides conflicting costume decorations instead of simulating cloth under plates. The original articulated movement system remains; tested idle, walking, crouching, swimming and combat poses improve fit, but there is no universal guarantee that every extreme procedural pose can never intersect.

The previous weapon pose differences remain documented in WEAPONS.md. This update does not change weapon models, hit detection, damage/armor/protection formulas, durability, recipes, controls, inventory mechanics, generation 16, relay protocol 4, audio or world saving. A source-hash regression manifest at `reference/appearance-gameplay-2.7.16.json` verifies these boundaries (data.js changes only its release label).

Use the standalone Browser ZIP's `DCSMCRAFT.html` in desktop Edge/Chrome, or extract the Windows ZIP and run `DCSMCRAFT.exe`. Existing worlds require no regeneration. Browser validation streams the exact embedded file over loopback with external requests blocked. Native Windows launch and direct file navigation remain untested on the Linux build host; executable payload/extraction and byte-identical source reconstruction are checked separately. See VALIDATION.md for test results.
