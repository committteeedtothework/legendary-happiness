# DCSMCRAFT 2.7.19 — remaining native pixel art

Reference remains **Minecraft Java Edition 26.3**. This is a cosmetic release. No blocks/items are added and no gameplay, models, poses, controls, UI, sound, world generation, saves or multiplayer code changes.

The art audit identified **651 existing block/state texture entries** still using older generic or noisy surfaces: **515 expanded-catalog art owners** and **136 legacy entries**, including directional door halves, flowing liquid levels and growth stages. They now use original 16×16 motifs with small discrete palettes, integer-pixel detail and true cutout holes. Three existing face slots per entry are repainted; existing UVs, shapes, tile sharing and chunk meshing remain.

- Timber species have consistent planks, bark, cut ends, stripped wood, mosaics and framed doors/trapdoors. Copper oxidation/wax variants, shared brick/tile slab/stair/wall families, woven cloth, colored building materials, rock strata, ore clusters, carved panels and mineral blocks follow the same pixel conventions.
- Workstations have readable tops and sides: crafting grids, furnace openings, blast-furnace vents, smoker chimneys, smithing plates, barrel bands, chest latch, note-block lattice, cauldron/pot rims, lanterns and conduits. Existing workstation shapes and chest/door interactions remain.
- Flowers, mushrooms, saplings, foliage, grasses, crops, vines, coral, kelp, pickles and eggs use crisp cutouts. Glass, ladders, webs and trapdoors retain genuine transparent gaps. Source/flowing water and lava use matching stepped ripple palettes; their simulation and shader animation remain unchanged.
- **18 older utility/aquatic sprites** are updated: Cinder Sigil, fishing rod, scute, nautilus shell, Heart of the Sea, prismarine crystals, ink sac, Nether wart, blaze rod, all four fish buckets, treasure map, glass/water bottles, Awkward Potion and Turtle Master Potion. Original 16×16 art is shared by inventory, recipes, held planes and dropped items. The Awkward Potion's cork has a small distinct marker.

The exact entries and source tile addresses are in [reference/art-completion-2.7.19.json](reference/art-completion-2.7.19.json).

## Preserved artwork and behavior

The intentionally older **Classic** texture pack remains byte-identical in rendered atlas cells and item icons. Supplied Assets retains all supplied native images; the updated original artwork fills its missing native fallbacks. Renewed and Soft use the new completion pass. All previously refined weapon/tool art and poses, armor, skins, spawn eggs, dedicated native item art, the 75 item improvements from 2.7.18 and already-authored Renewed natural terrain are preserved. The fishing rod was the remaining utility tool with older sprite art; it keeps its existing model/animation conventions.

Only the atlas/icon dispatcher and two new artwork modules change at runtime, apart from the release label. The source also includes captured 2.7.18 atlas/icon SHA-256 fingerprints, so the art comparison needs no downloaded older build. The previous complete runtime hash manifest is bundled and tested: simulation, collisions, creatures, stats, recipes, held/drop geometry, animation, audio, UI, arrow recovery/persistence, world state and multiplayer stay byte-identical. Generation **16**, protocol **4**, and the existing save envelope remain; no new world is needed. No objects or per-frame simulation/rendering work are added. The new art runs during atlas construction or an icon's first cached creation.

## Limits and launch

These are original material-family designs, not imported or pixel-identical Minecraft textures. Variants within the same material intentionally share motifs. Existing simplified block models, directional/state presentation and all earlier feature/pose limits remain; this does not add missing blocks, models or simulation features. A pre-existing cube-shaped station remains cube-shaped, and the supplied pack retains its native art differences. The preserved Classic archive intentionally keeps its earlier appearance.

Extract the Browser ZIP and open `DCSMCRAFT.html` in desktop Edge/Chrome, or extract the Windows 10/11 x64 ZIP and run `DCSMCRAFT.exe`. Source includes all art generators, assets, dependency locks and tests. Browser checks use the exact standalone over loopback with outside requests blocked. Native Windows launch/direct-file opening are not tested on this Linux host. See VALIDATION.md for results and earlier guides for remaining game limitations.
