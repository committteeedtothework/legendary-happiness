# Terrain streaming, menus and controllers · 2.9.1

World generation, seeds, block/item artwork, music recordings, combat stats and save format remain unchanged. Existing worlds require no regeneration. The content reference remains Minecraft Java Edition 26.3. The Giganto arena retains its separate Frontiers presentation.

## Chunk streaming

Workers retain overlapping generated neighborhoods rather than regenerate nine chunks for every mesh. Each worker keeps at most two generation contexts, each bounded to a 5×5 chunk neighborhood. Exact edit stamps handle additions and removals; seed, realm, generation version, renderer epoch and generation metadata separate contexts. Authoritative loaded-cell snapshots still replace worker cells. Worker buffers are copied before transfer and never detach gameplay state.

Full worker-generated chunks can enter the gameplay cache, with their container loot, growth/aquatic indexes, cane and lamp indexes and fluid wakeups. Collision queries then reuse those cells. Loaded chunks and saved containers keep authority; stale revisions are rejected before handoff. Surface-only and distant meshes never become collision terrain. This avoids repeating full terrain generation merely because the player reaches a visible chunk.

Worker responses queue for main-thread installation: at most two per frame, with a 2.5 ms soft CPU budget and bounded backpressure. A single upload, allocation, driver operation or GC pause cannot be interrupted. Already displayed meshes remain until a valid replacement is ready. Stale results cannot cross worlds, graphics epochs or edits. Ordinary snapshot/dispatch work also has a 3 ms soft budget. Explicit initial bootstrap and unavailable-worker fallback retain synchronous generation.

Coarse coverage now starts at ordinary view distances as well as extended distances. Complementary screen-door coverage blends new detailed chunks over coarse terrain for 240 ms without alpha sorting or see-through block materials. Outgoing detail retires over an available coarse tile. Detailed retention is bounded around its real near radius instead of the full distant view radius, avoiding accumulated old meshes, overlapping coverage and repeated distant surfaces. Full block faces, targeting and lighting remain authoritative.

A paired local CPU measurement ran six adjacent full-detail jobs through the original 2.9.0 and updated bundled workers. The warm jobs used approximately 74% less CPU time; all mesh arrays matched byte-for-byte. This is one local generation/meshing measurement, not a frame-rate guarantee. The verification archive contains the samples and environment limits.

Remaining limits: coarse terrain approximates far structures and caves. Fast teleports can outrun streaming. The first shader compilation, very complex lighting/geometry, terrain needed before a worker finishes, memory pressure and browsers without workers can still cause hitches. Transitions cannot display geometry that has not been generated. No arbitrary FPS or complete absence of pop-in is promised.

## Menus

The title, world creation/selection, pause, options, sound, world messages, video, controls, wardrobe and custom sandbox menus use compact pixel typography, rectangular beveled gray controls, dark fields, white focus borders and paired buttons. The DCSMCRAFT stone-letter SVG is original artwork. Yellow animated splash text remains beside the logo. Options separates sound and custom messages into functional pages; custom game features remain under World in pause. Existing Minecraft-style inventory/recipe layouts and the live skin preview remain functional.

Research: Minecraft.net accessibility and controls documentation, Minecraft Wiki's Options page and Java options screenshot, plus available title/menu descriptions and user-provided references. The Title Screen page was unavailable during this session. No reference screenshot or official logo/font was added to the game. DCSMCRAFT-specific pages and browser controls require adapted layouts; this is not an exact copy of every official Minecraft screen or its branding. Original artwork and existing licensed fonts are retained. URLs and observations are recorded in `reference/overworld-interface-2.9.1.json`.

## Controller changes

Mouse/keyboard handoff compares raw stick samples instead of gameplay vectors cleared by pause. A held stick or small noise no longer takes control back on its own. Deliberate stick movement or a new button/axis-trigger press activates the controller. Remapping and preset changes wait for neutral before another action; stable field identities improve focus restoration. Shoulder buttons switch actual creative/arena tabs. Back skips hidden controls and keeps the death screen in place until Respawn or Save and Quit is selected. Slow deliberate stick movement can reclaim control from the raw handoff position. Controller presets remain in DCSMCRAFT Options only.

See CONTROLLERS.md for bindings, browser exposure and hardware limitations. Automated controller checks use virtual Gamepad API input. Physical controllers and native Windows launch remain untested on this Linux host. Browser singleplayer embeds assets and needs no local server; online multiplayer retains its existing relay requirement. Exact standalone bytes are tested over loopback because managed browser policy can restrict file navigation.
