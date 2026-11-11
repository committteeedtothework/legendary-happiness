# Giganto · Arena interface · 2.8.23

The arena HUD, pause/result screens and active-arena options are redesigned. Overworld menus and gameplay, world textures, combat simulation and balance, animation/model assets, camera choreography, sound recordings, score cues and saves are unchanged.

## Reference

SEGA's [Sonic Frontiers online manual](https://manuals.sega.com/sonicfrontiers/en/) provides the field HUD and menu references: [game screen](https://manuals.sega.com/sonicfrontiers/en/?pid=4#game_field), [menu](https://manuals.sega.com/sonicfrontiers/en/?pid=4#menu_field), and [start screen](https://manuals.sega.com/sonicfrontiers/en/?pid=2#menu). The associated wm_271.jpg, wm_291.jpg and wm_131.jpg were inspected. SEGA's Steam product screenshots were also inspected; those promotional images omit the HUD and were not treated as a HUD reference. Source URLs and observed details are recorded in reference/giganto-interface-2.8.23.json. Reference images remain outside the distributed build.

## HUD

- Condensed white type, unboxed upper-left counters, a narrow compass strip, pale objective ribbon, centered pink Titan health bar, right-hand combo display and corner gauges replace the previous panels. Ring counts have three-digit minimum padding and a smaller capacity. Real phase, health, speed, guard, attack power, energy and collectible values remain.
- The boost gauge has a circular energy arc and a speed needle. Critical rings, delayed health loss, combo charge, Phantom Rush, targeting and contextual warnings remain live. No imaginary Sonic levels, keys or skill progression are displayed.
- The six implemented combat skills use small original vector icons, their actual PC keys and live cooldown/energy feedback. Press **H** to show or hide the controls overlay and skill names; **Escape** pauses. Controls also appear in Options. The center stays clear during ordinary combat.
- Timed beam/grab inputs use a circular prompt with remaining time, input effort and a Space key. Existing input requirements and timing remain. Cinematic bars, protected scenes, damage feedback and the playable return marker are retained. Reduced motion is respected.

## Menus

Pause and defeat screens use a pale grey-blue field, cyan selection and condensed labels. The active-arena options are divided into **Graphics**, **Sound**, **Camera**, **Battle** and **Controls**. Every existing setting, soundtrack import, cue map and damage override remains available. Only the selected panel scrolls; navigation and Back stay visible.

Mouse, Tab and native form keyboard controls work. Left/right switch focused tabs, Home/End select the first/last tab, and up/down move menu focus outside editable controls. Enter confirms buttons. Escape returns from options to pause/results; Escape on pause resumes. Menu keys do not enter the movement control set. Values retain their existing save behavior. The options tab selection is transient interface state.

Barlow Condensed (600/800) is embedded for offline use under the SIL Open Font License, included in public/fonts/frontiers/OFL.txt and the standalone license notice. All new interface vectors/CSS are original. The commercial font, artwork, logos and unused Frontiers systems are not imported. This is a researched adaptation to DCSMCRAFT's actual controls and resources, not an exact pixel-for-pixel reproduction.

## Verification and delivery

See VALIDATION.md, the Screenshots ZIP and STAGE-CHANGED-FILES.txt for actual checks, captures and changed files. Tests use exact standalone HTML over loopback with external requests blocked because managed browser policy restricts direct file navigation. The HTML still embeds singleplayer assets and needs no local server. Windows x64 cross-build and embedded payload extraction are verified; native Windows launch remains untested on the Linux host.
