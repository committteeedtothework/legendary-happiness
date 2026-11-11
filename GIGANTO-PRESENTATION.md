# Giganto presentation — 2.8.14

This update stays inside the Giganto encounter. Overworld terrain, artwork, creatures, gameplay, music and world saves are retained. The portal, ring collection, moving armor ascent, Emerald, transformation, combat phases, retries, rewards and world return remain. This is a Frontiers-inspired presentation using the supplied Sonic/Giganto rigs and original procedural scenery; it does not claim exact commercial asset or cinematic fidelity.

## Arena and environment

The old continuous cliff wall is replaced by an irregular basin with foothills, exposed slopes, low valleys and distant ridgelines. One deterministic scenery-height function places terrain, boulders, groves, water and ruined colonnades consistently. Decorative relief begins beyond the playable floor, which remains flat and unobstructed. Existing traversal and combat collisions are preserved. The water is distant arena scenery, not a change to overworld fluids.

Procedural surface maps are 512 square, with gentler normal detail, broad grass/soil variation and a slope-dependent blend between rock and turf. Ruins have eroded edges; large boulders and forest groves reinforce scale. Grass uses tapered bent ribbons rather than single dark triangles. Grass and crowns sway, the distant water has moving normal-map ripples, and clouds drift using the encounter clock. Phase two changes sky/fog/light color gradually. Pausing freezes environmental motion.

Terrain and scenery remain batched/instanced. Foliage budgets are 3,200 / 8,500 / 14,000 grass instances, with reduced forest counts in Low. High and Full foliage use 260 trunks / 1,040 crown clusters. Decorative geometry does not acquire hidden collision obstacles.

## Lighting, models and effects

The directional key, cool rim, hemisphere fill, environment reflections and phase tint are rebalanced. The existing dynamic character shadows and optional contact shading remain, with a smaller normal bias to reduce detached-looking shadows. Titan armor receives bounded roughness/metalness and environment-response adjustments; Sonic's gold material retains readable features. Supplied model geometry, embedded textures, skeletons, clips and physics are not replaced.

Attack warnings use camera-facing rings in place of wireframe spheres. Contact sparks use one bounded 64-instance batch, emitted from real encounter events, with duplicate/stale-event rejection and pause/retry cleanup. Short additive streaks render with depth priority for readability over the approximate collision shell; these are not physically occluded surface decals. Damage numbers follow projected contact points with an offset to clear Sonic. The old broad cyan armor hit flash is reduced. The gold aura now uses thin time-driven arcs instead of a stronger solid shell. Existing shockwaves, blue Cyloop trail, dorsal lasers, impact ripples and restrained hit-stop remain.

Effects stay localized. Telegraphs and DOM HUD are not blurred by the optional boost blur. The empty combo counter is hidden until a combo starts. No generic placeholder model or new sound recording is added.

## Camera, cinematics and HUD

Entrance, transformation, phase reveal and finisher now use continuous keyed camera compositions. These follow existing protected movie clocks and event timing; damage, music cues, skip handling and control restoration are retained. Counter/grab cameras remain tied to the actual actor/contact. A light approach-framing assist helps show Giganto's scale when he is ahead and yields as the player changes pitch.

The HUD uses slimmer edge panels, a magenta boss bar with cyan framing, compact ability cells, clearer resource typography, a contact-aligned damage number and an unobstructed combat centre. Attack prompts retain priority. Protected cinematics hide the peripheral HUD while retaining the announcement and skip prompt, with optional letterbox bars. Small-screen rules keep the six abilities in a compact two-row layout.

## Arena-only controls

Battle settings add Foliage (Match quality/Off/Reduced/Full), resolution scale (65–100%), exposure (0.7–1.4), bloom (0–0.65), atmosphere, impact sparks, cinematic camera and letterbox switches. Existing quality, shadows, AO, post-processing, blur, trails, shake, FOV, sensitivity, audio and combat options remain. Resolution scale changes the arena render targets while the HUD stays at display resolution. Low skips expensive AO/bloom. These preferences do not modify overworld graphics/audio settings.

Arena dialog labels have explicit light text and a consistent font, preventing the sandbox's dark inventory-label styles from overriding them. The settings panel scrolls within the viewport so its title and controls stay accessible at smaller heights.

Controls are unchanged: WASD move, Shift boost, Space/Ctrl rise/fall, LMB combo/counter, RMB parry, Q dodge, X homing, R Sonic Boom, F Wild Rush, E Cyloop, C Cross Slash, V Homing Shot, Tab target, Enter skip and Escape arena pause/settings.

## Changed files

- Scenery and impacts: src/titan-landscape.js, src/titan-impact-fx.js.
- Rendering/materials/camera integration: src/giganto-view.js, src/titan-imports.js, src/titan-cinematics.js.
- HUD/settings: src/giganto.css, src/giganto.js, src/titan-hud.js, src/titan-settings.js, src/titan-menu.js.
- Checks/captures: tests/titan-presentation.test.js, tests/browser/titan-presentation.spec.js.
- Delivery: package.json, package-lock.json, src/data.js (version only), scripts/package-release.py, README.md, desktop/README.md, VALIDATION.md and this report.

## Remaining limits

The terrain, vegetation, water and sky are original procedural substitutes. They are not photogrammetry, true volumetric clouds or a full ocean simulation. The scenery is a backdrop beyond the playable basin; collision-aware uneven ground is not added. Shadows use the existing single directional map and optional screen-space contact shading, without cascades/ray tracing. Boost blur is a restrained radial approximation, not velocity-buffer motion blur. Model silhouettes and texture detail remain those of the supplied rigs; facial/finger performance, the complete official choreography and production cinematic animation remain unfinished. Camera shots are authored interpretations, not verified frame-for-frame reproductions. Combat collision regions and grounded-shoe corrections retain the earlier documented approximations.

## Validation

The final source passes **745/745 unit tests**. New tests verify deterministic scenic relief outside the playable floor, bounded scene draw objects, actual foliage budgets, explicit Full overriding Low, pause-clock wind, bounded/deduplicated/stale-event spark handling, cinematic camera continuity and state immutability, and clamped settings/menu controls. Existing model, combat, movement, music, save, lighting, sandbox and multiplayer checks remain green.

The frozen standalone passes **22 browser cases**, with **one managed-policy skip**, in 20.8 minutes. The added presentation case captures approach, battle, phase two, transformation, a real jab contact, a compact HUD and the settings menu. All capture frames restore shared renderer state. The actual 34-damage contact creates 12 streaks and changes 44 rendered pixels above the comparison threshold when toggled, verifying visible output. It is a deliberately restrained basic-hit effect; strength scales with damage/counter events. At 70% scale the render target is 896 pixels wide for a 1280-pixel display, with 3,200 Reduced grass instances; Low disables AO and each setting leaves world preferences unchanged. Actual menu changes survive save/reload, retain 80% render scale and disabled foliage/cinematic options, then exit to the normal world HUD.

The complete portal → rings → moving armor → Emerald → transformation → both phases → finisher → reward/return scenario passes in 124.22 simulated seconds including preparation/cinematics. Animation clips, camera/targeting, audio pause/phase cues, counter/finisher contacts, skips, defeat/retry, failed reward saves, repeated arena visits, retained Cyloop/shot/sweep abilities and torch chunk-seam cases pass. Passing fixtures report no JavaScript/WebGL errors. The production web smoke passes **1/1**, including playable world creation, inventory and edited-block/equipment/health reload.

Actual high-quality captures and before images are supplied separately in the screenshot gallery/ZIP. They are controlled in-game view fixtures rendered by the working standalone, with a separate full-playthrough test. The final capture report identifies HTML SHA-256 **f2233a49a9516aa1b5ffa3e49b600c0036ee8b21f136ef5e45e5f483ee7145cf**. Screenshots were shared during development as well as at delivery; generated concept art was not used.

The warmed 1280×800 SwiftShader combat fixture records 132 draw calls, median 2.0ms and p95 6.3ms. This is not a whole-game, traversal or native Windows FPS guarantee. Added terrain/scenery stay merged or instanced and sparks are one bounded batch; expensive passes and foliage have independent controls. Initial procedural scenery construction adds load work while the portal prepares. No external asset/dependency payload is added.

Standalone, web and Windows x64 builds succeed. The Windows launcher embeds the tested HTML; its Linux companion extraction matches byte-for-byte. Native Windows execution remains untested on this Linux host. Managed Chromium blocks file:// navigation before the game loads (ERR_BLOCKED_BY_ADMINISTRATOR), so that case is explicitly skipped; exact standalone bytes are tested over loopback with external encounter requests blocked.

All 270 supplied/static assets are byte-identical to 2.8.13. Overworld source and save formats remain; schema 1, generation 16 and protocol 4 are retained. Frozen runtime/assets/tests/HTML hashes are verified before packaging, followed by ZIP CRC, source byte comparison and launcher payload checks. The existing large embedded-audio bundle warning remains. Evidence is retained under /workspace/.cache/dcsmcraft-titan-presentation/ and with local delivery artifacts. Remaining approximations are listed above; successful checks do not establish exact commercial fidelity or absence of every possible bug.
