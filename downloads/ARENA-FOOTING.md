# Sonic movement and controller tuning · 2.15.0

Jumping uses the same curled silhouette while running or boosting. Landing restores the rig; no extra character mesh or trail is added. A jump cancels slide, roll, stomp and dash overrides so their velocity cannot fight the jump. A short wall-jump grace period prevents an immediate wall-run recapture.

Wyvern's tower and traversal trail now use the rendered top triangles for support. Swept steps catch fast falls and stomps, block slab undersides and side entry, and follow descending ramps. Landing on the trail while still in the tower section changes sections automatically. The summit and genuine trail gaps remain traversable; gaps still require a jump or homing dash. Emerald-deck jumping retains gravity.

Pre-fight rolls and slides blend steering and speed. Dodges use one bounded directional impulse. Light Dash advances between ring targets without a stationary frame, prefers targets ahead, and stops when blocked. Jumping cancels the dash. These changes preserve boss health, damage, music cues, rewards and saved worlds.

## Controller settings

Open Options → Controller from the DCSMCRAFT menu. Settings persist locally and apply to both the world and arenas. Existing Xbox, PlayStation, Switch and Custom presets remain available.

- Separate movement and look deadzones; an outer deadzone compensates for sticks that cannot reach full travel.
- Movement response: Linear, Precise or Fast. Look response: Linear, Smooth or Precision. Radial shaping preserves diagonal direction.
- Horizontal look sensitivity, vertical sensitivity, horizontal/vertical inversion, and 0–0.2 seconds of look smoothing. Releasing the stick stops look immediately.
- Sprint: Hold or Toggle. Trigger threshold: 0.1–0.95. Existing vibration and custom mappings remain.

Menu navigation uses the unshaped stick so a precise gameplay curve does not make menus sluggish. In the arena before transformation, D-pad Up activates Light Dash, LB + Up slides, Down stomps, Right charges Drop Dash, Left climbs, and holding LB without a direction draws Cyloop. Prompts use the selected controller's button names. Combat bindings are unchanged.

## Limits

Platform contacts use the visible top triangles and swept player-height slabs, not a triangle-level collision mesh for the entire imported character or scenery. The player collision shape remains the existing simplified volume. Controller tests use virtual Gamepad API devices; physical controllers and native Windows/iOS execution require device testing. Animation blending and game mechanics remain adaptations rather than exact Sonic Frontiers reproductions.
