# DCSMCRAFT 2.7.18 — item art and recoverable arrows

Reference stays **Minecraft Java Edition 26.3**. This release improves existing content and interactions; it adds no items or recipes.

| Area | Behavior |
| --- | --- |
| Legacy food art | 34 food sprites now have original species/recipe-specific 16×16 silhouettes: raw/cooked chicken, mutton, pork and rabbit; fish varieties; vegetables, soups/stews, berries, melon, cookies/pie, honey, dried kelp, spider eyes and golden apples. |
| Legacy utility/resource art | 17 stepped sprites: arrows, three seed types, bowl, breeze rod, cocoa beans, ghast tear, glowing ink, honeycomb, Netherite scrap/template, rabbit foot/hide, resin brick, shears and spyglass. |
| Generic-gray palettes | 24 corrections cover all sixteen dyes, amethyst/quartz, gold/iron/copper nuggets, glowstone dust, magma cream and Netherite ingot. Registry colors/stats are not mutated. |
| Existing art | Already-refined native sprites are preferred over generic edition placeholders. Existing dedicated sprites, weapon/armor designs and Supplied Assets native images are preserved. Native fallbacks use crisp integer pixels and binary alpha with no smoothing. |
| Bow presentation | A rigid arrow is seated at the actual drawn-string nock. Its tip points along the view/aim direction in first person and F5 at every charge stage. The flat backward arrow is removed from the held frames. |
| Physical arrows | Stepped shaft/tip/fletching model for flying and lodged normal arrows. Block hits lodge the arrow in the precise contacted surface; its shaft remains outside the block. Floors, walls, ceilings, shape surfaces and chunk boundaries use existing precise collision rays. |
| Pickup | Survival-fired recoverable arrows return exactly one arrow after a seven-tick settling delay when a living player approaches. Full inventory means no pickup; the arrow stays in place. One successful inventory insertion removes that lodged arrow. |
| Support changes | Replacing support with a solid shape that still supports the arrow keeps it lodged; removing/opening/moving its contacted support releases it back into gravity. |
| Saves/dimensions | Lodged position, direction, support, pickup ownership/delay and age persist in an optional per-realm field. Older saves default to an empty list. Save envelope and generation 16 remain. |
| Multiplayer | The host owns pickup, including guests' inventories; guest-side arrow ticks do not grant items. Lodged visuals are broadcast in optional protocol-4 state. Matching builds are recommended. |
| Sound | The shared hand/melee air-swipe whoosh is removed. Actual impacts, block sounds, bow shots, pickup, special abilities and menu sounds retain their existing mix. |
| Menus | Personal/table/Creative views have one inventory X. The extra recipe-book X is removed; the green book still opens/closes recipes. Other menu style/layout/controls remain. |

The complete per-item art audit is [reference/item-art-2.7.18.json](reference/item-art-2.7.18.json). No food values, stack limits, recipes, armor stats, weapon damage/charge/gravity/durability, controls, terrain equations, music or supplied assets are changed.

## Limits

Only Survival-fired arrows marked recoverable grant ammunition. Creative and mob arrows can lodge but do not create free arrows. Arrows that hit entities keep their existing damage/despawn behavior; attached arrows on moving creature bodies are not added. Flying arrows remain transient on save/dimension switches. Lodged arrows persist per realm.

A realm retains at most **256 lodged arrows**; the oldest are removed when this budget is exceeded. Lodged arrows expire after **1,200 active simulation ticks**, about 60 seconds at the existing 20 Hz tick. Far or unloaded records pause instead of streaming remote chunks; activation uses loaded terrain within 64 blocks of a living player. Existing simplified flight, physics and body-hit sampling remain. This is not a full Minecraft projectile/enchantment reimplementation.

Supplied-pack native item images keep their provided artwork; the new original sprites are the native fallback. Classic's existing dedicated legacy artwork remains where not replaced by these audited fixes. Earlier feature, offhand, pose, skin and armor limitations remain in CONTENT.md, WEAPONS.md and APPEARANCE.md.

Extract the Browser ZIP and open `DCSMCRAFT.html` in desktop Edge/Chrome, or extract the Windows ZIP and run `DCSMCRAFT.exe`. Existing worlds need no regeneration. Source includes original art generators, all supplied assets/audio, server code, dependency locks and tests. Exact standalone tests use loopback HTTP with outside requests blocked. Native Windows launch/direct-file navigation are untested on Linux; payload/extraction and byte-identical source reconstruction are verified separately. See VALIDATION.md for results.
