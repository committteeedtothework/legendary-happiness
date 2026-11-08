# Titan traversal and canyon chase · 2.14.0

Both Titan arenas now share a base Sonic traversal kit: jump and double jump, ground/air boost, quick-step dodge, homing/air dash, Light Dash along ring markers, stomp, slide, a charged Drop Dash and grounded rolling dash, basic attack poses, parry stance and the existing freehand Cyloop. Boosting into Wyvern's tower supports a wall run; Giganto retains its climbable skin. These actions use the existing keyboard, controller and mobile inputs. They do not damage a boss before its Emerald objective. Dodge/jump/stomp can cancel a ring dash, and blocked dashes expire. Core movement remains steerable during ordinary attacks and rolling.

Controls before transformation: Space jump/double jump; Shift boost; Q quick step; X homing/air dash; R Light Dash; V slide; Z stomp; G Drop Dash/rolling dash; LMB basic attacks; RMB parry; hold C to draw Cyloop. Holding jump after a double jump also charges the Drop Dash. Tab toggles target/road assistance. Existing Super Sonic bindings and music cues remain unchanged. The mobile Moves tray shows the base actions before transformation.

Sonic's body heading is independent of camera yaw. Movement sets his heading; releasing movement retains it. Looking while idle turns the retained heading by the player's look input instead of returning to a fixed world direction. Facing and look state persist on reload. Uniform rig scale and the supplied character models are preserved. Slide, rolling, homing and wall-running use original pose work; one bounded light-streak pool follows actual base-Sonic movement. It freezes on pause and is released on exit.

Wyvern's tower is 200 metres high, with a 42-metre spiral radius, wider ramp, segmented buttresses and an open summit entrance. The tower stands clear of the resting Titan's wings, with a ring trail and Light Dash approach. The core, platform, ramp support and underside tests follow the enlarged dimensions. The old tower was 80 metres high with a 17-metre radius. Old tower progress and road height are converted once when loading a pre-fight save; the player's Overworld return state remains untouched.

The digital road uses physical horizontal movement, gravity, jump velocity and rendered surface support rather than assigning player position from a lane number. WASD and camera input control steering, reverse movement and stopping. With targeting enabled, holding boost without directional input supplies optional road guidance; directional input overrides it. Jumping and homing carry Sonic across the gaps. Leaving the road allows a physical fall and return to the tower area rather than an automatic lane snap. The final head deck also respects camera-relative movement.

The canyon pursuit follows a closed multi-bend route with alternating corners, height changes and four overhead stone passages. Passage render instances and player/camera collision share their placement data and remain anchored in the world. Boss flight samples the terrain behind its long body for clearance. These are authored procedural route/terrain replacements; Wyvern does not dynamically plan arbitrary paths through the entire map or choose a new route at each fork.

Missile downtime is shorter: initial delay 1.4 seconds; subsequent launch spacing 3.4 / 2.7 seconds in phases one / two; incoming travel time 2.4 / 2.1 seconds. The existing forgiving parry, immediate blink and 12-second attack window remain. Boss health, per-move damage, phase gates, ring drain, soundtrack regions and reward rules are unchanged. Camera turn roll is restrained, and move shots add a short actor-relative arc. Existing transformation and finishing choreography remain event-driven and protected.

Wyvern's wing and finger contacts are sampled from the supplied skeleton, using the same explicit clip clock as rendering. Its resting pose has 32 metres of ground clearance lift, and the head deck/Emerald and transformation ascent share that offset.

Collision changes include swept displacement at high movement speeds, upper/lower player capsule samples, contact-normal velocity correction, physical roof/pier tests and continuous camera-boom obstruction tests. Giganto's outer rocks now participate in player and camera collision. Wyvern can move below the boss frame's local zero when the world terrain permits, removing an invisible altitude barrier. The shared collision samples follow the current body pose rather than an idle-only pose. Purposeful cinematic mouth/skin interactions retain their authored placement.

Original procedural architecture and VFX were added locally; no paid model-generation task or new soundtrack recording was used. Existing public assets and Overworld mechanics are unchanged. The supplied Sonic/Giganto/Wyvern assets, original animation clips and prior arena quality settings remain in use. Regenerate the sampled wing contact data with `node scripts/build-wyvern-contacts.mjs` if the supplied rig changes.

## References

- Gamepur: https://www.gamepur.com/guides/how-to-defeat-the-wyvern-in-sonic-frontiers — tower, homing launch, digital road, missile reflection and QTE flow.
- Destructoid: https://www.destructoid.com/sonic-frontiers-how-to-beat-wyvern-boss-guide/ — road avoidance, attack openings and phase-two energy rings.
- Gamepur: https://www.gamepur.com/guides/how-to-light-dash-in-sonic-frontiers — travel through ring chains.
- Gamepur: https://www.gamepur.com/guides/how-to-do-a-drop-dash-in-sonic-frontiers — double jump followed by held jump, then rolling on landing.
- Gamepur: https://www.gamepur.com/guides/how-to-unlock-skills-in-sonic-frontiers — distinction between traversal and unlockable combat skills.
- Existing user video analysis is retained in WYVERN-VIDEO.md. No new frame-by-frame video verification is claimed.

## Limits

This is an original browser-game interpretation, not complete Frontiers parity. Rail grinding, air-trick scoring, production terrain/assets, official choreography and every advanced base-Sonic combat skill are not newly implemented. Some cinematic poses and capsule/box collision bounds remain approximations to the supplied meshes. Basic attacks and parry poses in the preparation field have no hostile opponent to fight. The ordinary ring dash and wall run use local movement rules rather than official animation data. Exhaustive absence of every possible mesh intersection is not claimed. Physical iOS/controller hardware and native Windows launch need device testing. See VALIDATION.md for measured checks rather than assumed fidelity or frame rates.
