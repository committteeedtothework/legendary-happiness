# Titan combat · 2.11.4

This update is limited to Giganto, Wyvern and their shared Sonic combat/rendering systems. Overworld rules, saves, textures, all supplied audio, portal rewards, mobile touch controls and controller mappings are preserved.

## References

The supplied video, https://www.youtube.com/watch?v=ao6-F7-WP8k , was analyzed with the installed analyze-youtube skill using Gemini native video input (store=false). The generated analysis reports a normal blue Sonic training demonstration; it contains neither Super Sonic nor either Titan. Its poses, paths, cadence and effect silhouettes guide original arena adaptations. These timestamps are Gemini observations, not independently frame-verified footage:

| Video time | Observation used |
| --- | --- |
| 00:13–00:23; 01:58–02:01 | Homing curl, vertical stomp and stomp cancel |
| 00:52–01:21 | Braced parry; alternating punches and finishing kicks |
| 01:22–01:28 | Freehand Cyloop and closed Quick Cyloop |
| 01:29–01:45 | Hit counter and a separate filling/active Phantom Rush gauge |
| 01:46–01:49 | Repeated kicks and crescent Sonic Boom waves |
| 02:09–02:18 | Wild Rush zigzag and ascending Cyclone Kick |
| 02:19–02:33 | Compact Spin Slash and Cross Slash arcs/X effects |
| 02:40–02:45 | Homing Shot curl/charge, sphere ring, sequential homing release |

SEGA's Steam product description, https://store.steampowered.com/app/1237320/Sonic_Frontiers/ , confirms dodges, parries, counters, combos and Cyloop as Titan combat tools. https://www.gamepur.com/guides/how-to-defeat-the-wyvern-in-sonic-frontiers and https://www.destructoid.com/sonic-frontiers-how-to-beat-wyvern-boss-guide/ confirm missile/claw parries before an opening, two claw parries in Phase 2 and Quick Cyloop extending a stun. The community guide https://steamcommunity.com/sharedfiles/filedetails/?id=3043795839 describes charge-building and stomp/Cyloop strategy, but concerns Final Horizon on Hard; its difficulty and timing are not treated as story-mode constants. These pages were read directly. Several other sites were unavailable or irrelevant and were excluded. No video, official animation or new media asset was downloaded into the game.

## Working changes

Wyvern's 28-joint spine uses a bounded tangent field from its rest pose, replacing cumulative post-animation rotations. Local rotations are differences of adjacent tangents, preventing a 28-joint corkscrew. Rendered-body and spine collision paths use the same field. Tests sample actual imported joints at different frame rates and repeated frozen draws. The old repeated 153-degree turn between attack modes is replaced by a small flight heading change. Cinematic throws complete one monotonic turn with limited bank instead of reversing rapidly as a multiplied time angle falls back to zero.

Head/neck/spine and mantle collision recovery use stable perpendicular normals, including exactly-on-axis starts. Giganto clearance uses the current body pose and Cyloop lift. Wyvern camera booms check the body before and after smoothing. Punch root nudges stop outside the body clearance. Homing Shot charge/release origins use Sonic's rendered scale and remain outside solid surfaces.

Both encounters use bounded shared pools for crescent Sonic Boom waves, full X-shaped Cross Slashes and charged/homing spheres. Launched attacks stay visible when optional particles are off. Wyvern now also shows the intentional Cyloop arc and Spin Slash/Stomp/Cyclone trails. Cross Slash gains a close-target lateral arc; distant casts retain their projectile reach. Homing Shot visibly curls before spreading its orb ring. Spin Slash uses a compact pose, homing includes a physical root spin, Sonic Boom has a sideways kick posture, and parry places the forearms in a braced guard. Existing contact/release clocks, all damage values and non-Cyloop costs/cooldowns are retained. No extra Sonic body meshes or ordinary blue Super Sonic ribbons are added.

## Combo and Cyloop tuning

These numerical values are DCSMCRAFT tuning; exact production-game constants were not established by the reference video.

| System | Behavior |
| --- | --- |
| Hit count | One per landed, unguarded damage contact; guarded hits do not refill it |
| Combo gap | Four active combat seconds, paused during an active skill or protected cinematic |
| Phantom Rush | Separate gauge, 20 landed hits to fill; eight active seconds at the existing ×1.2 damage multiplier |
| Active Phantom gauge | Drains with its remaining duration; no second activation while active |
| Taking damage | Breaks the hit chain and Phantom charge/window |
| Quick Cyloop | Separate two-stock gauge; starts with one charge; 12 landed hits refill one charge |
| Quick Cyloop cost | One charge, zero boost energy; 0.8-second input cooldown; one contact after closure |
| Giganto | Horizontal full loop; four-second bind/lift shared by model and collisions; a second loop releases it smoothly; 12-second stagger guard prevents repeated binds |
| Wyvern | Vertical loop around the head instead of a horizontal path through its spine; requires a parry-opened window; extends that window once by three seconds |

Existing controls remain **E** for combat Quick Cyloop and **C** for the base freehand Cyloop/Cross Slash. The charge stock is displayed separately. Incomplete or dodged loops do not award closure damage. Saved gauges/combos restore with bounded defaults for older saves; interrupted strikes/projectiles still clear so they cannot replay damage. Partial visual loops clear on retry and clock reset.

## Fidelity and remaining limits

This is an original fan-game adaptation. The supplied rigs do not contain official Frontiers choreography. Attack curves, blend durations, fixed keyboard/touch shortcuts, three-second full-orbit Quick Cyloop and simplified counters remain authored approximations. The complete official skill tree, exact input tree, Recovery Smash branch, multiple-Sonic Phantom Rush choreography and exact per-Titan second-loop cinematics are not recreated. Phantom Rush retains its existing multiplier with an accurate independent fill/drain structure; it does not spawn duplicate character meshes.

Body contacts remain analytic ellipsoids/capsules rather than triangle-perfect deformed mesh collisions. The spine field is calibrated to the supplied model; representative joint positions track within 0.8 canonical arena units in tests. Pose penetration cases, camera obstruction and action sequences are checked, but this does not establish zero clipping in every possible frame. Intended jaw/counter holds and the existing chest-piercing finisher are deliberate cinematics. WebGL performance depends on hardware; browser tests use software Chromium, not a physical Windows/iPhone benchmark.
