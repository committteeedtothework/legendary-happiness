# Giganto · Return portal · 2.8.18

After the full defeat animation, Sonic remains in the arena. A portal opens ahead of him instead of a results screen. Fly through it to return to the saved Overworld location. The defeated Titan, chest opening and final pose remain visible while you explore.

## Return sequence

- The gate opens over 0.9 seconds, about 18 metres from Sonic. It uses the arena's existing portal artwork, particles and light.
- WASD moves, Space/Ctrl rises or falls, Shift boosts, and the mouse controls the camera. Combat inputs, boss attacks and ring drain stop after victory. Boost energy still recharges. Escape pauses.
- The final shot blends into the flight camera over 1.4 seconds. Crossing the actual opening starts a 0.45-second fade. The world fades back in over 0.4 seconds after its save succeeds.
- Crossing detection sweeps the movement segment through the opening, including fast movement and either entry direction. Passing beside or above the portal does not return you.
- The victory menu no longer has a return button. The arena pause menu offers Resume, Settings, and Save and Quit. Leaving an unfinished battle is still available before victory.
- Portal position, opening progress, flight position and crossing/fade state are saved. Older victorious saves receive a portal without moving Sonic to a new location.
- Rewards are granted once by the existing atomic return save. If that save fails, the arena, inventory and victory remain intact. The fade clears and the player can enter again. A failed save cannot repeatedly trigger returns without another crossing.

## Player-facing text

Menus use short game terms such as Create New World, Select World, Skins, Controls, Respawn, and Jukebox. Repeated headings, development history, renderer explanations, generic slogans and the old results-screen reward pitch are removed from normal screens. The controls guide retains practical instructions. Detailed implementation status and differences remain in the delivered documentation.

F3 retains coordinates, seed, direction and sword navigation; draw-call, triangle and simulation counters are removed. New default cycle messages are Sunset, Nightfall, Dawn and Sunrise. Saved custom messages, user-authored splash text, world names, item names and chat messages remain unchanged. Error messages, storage warnings, connection requirements, tooltips and accessibility labels remain available.

The wording preference is recorded in AGENTS.md for future changes. The source archive includes that file. Menu actions, settings keys, crafting handlers, multiplayer commands, jukebox playback and Stand abilities are preserved.

## Scope and verification

No changes to terrain generation, block textures, recipes, combat damage, creatures, armor, or pre-battle controls. The data module changes only the displayed version and four default cycle strings. Historical source-hash checks normalize those specific approved wording changes while continuing to protect gameplay code and binary assets.

See VALIDATION.md and the Screenshots ZIP for the executed unit/browser checks, actual game captures and frozen HTML checksum. Portal tests cover pause/settings, save-and-quit, victorious reload, physical entry, failed-return recovery, full-inventory reward drops, duplicate-return rejection, and restored Overworld HUD/player state. A separate menu test covers navigation, skin preview, inventory closing and F3 wording. The new movement and opening tests include 30/60/144 Hz simulation.

The portal is a stylized effect rather than a live view into the Overworld. Existing models, animation and arena scenery retain their previous approximations. Native Windows execution is untested on the Linux host; the Windows build embeds the browser-tested HTML and its extraction is verified. Managed browser policy restricts direct file navigation, so automation serves identical standalone bytes over loopback while blocking external assets. Desktop singleplayer can open the extracted HTML without a server.

Changed files are listed in STAGE-CHANGED-FILES.txt. This stage adds src/titan-return.js and its unit/browser tests, integrates the gate with the encounter's simulation/rendering/HUD/audio/return save, and updates the player-facing text and delivery documentation.
