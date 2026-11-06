# Giganto · Choreography and camera · 2.8.22

Arena-only presentation changes. Combat balance, contact times, controls, movement, portal objectives, saves, music segments, mandatory cutscenes, finishing explosion and playable return are retained. Normal Giganto health remains 48,000; see GIGANTO-FLIGHT-CYLOOP.md for individual damage values and difficulty settings. Overworld textures and gameplay are unchanged.

## Camera and animation

Cinematic camera keys now share smooth velocity and acceleration, with bounded interpolation to avoid overshoot. Scene entries blend from the displayed camera, look target and lens. The normal handoff lasts 0.4 seconds, counter entry 0.22, gameplay return 0.65, and the finishing-scene return 1.4. The intro finishes behind the starting player rather than looking into the Titan. Free-flight framing is closer; lock-on keeps 12–15 metres of setback so Sonic stays fully in frame. Existing collision clearance is retained. Cutscene duration and simulation-owned audio/contact events do not change.

Super Sonic's transformation now reaches for the Emerald, coils during absorption, opens into the release and launches into flight. Beam and grab counters have separate full-body poses; the grab escape twists into a kick. Giganto's protected second-phase awakening rises through the chest, shoulders, head and jaw while keeping the legs planted. These rotational clips use the existing supplied rigs without changing limb scale, player location, damage volumes or mesh count. Sonic has 45 runtime clips and Giganto 33, including the existing locomotion and combat library.

Contact zoom is now composed from an independent lens value. Repeated paused draws no longer subtract zoom repeatedly, and the lens response is consistent across frame rates. Letterbox and HUD visibility transitions are softened inside the arena and respect reduced motion.

## Effects

Authoritative impact events create directional tapered sparks and short shock rings. Normal contacts use restrained gold-white flashes, parries use cyan-white, and finishers/counters receive a larger ring. A bounded instanced pool uses two draws, rejects stale/duplicate events, freezes with the encounter clock and clears between attempts. Low particle quality reduces the ray count. Particles and impact effects can be disabled with the existing arena settings.

Sonic Boom and Cross Slash use original tapered crescent geometry with a luminous center and cyan edges. Homing Shot retains its separate spheres without a redundant ring. No character copies or following Super Sonic speed ribbon are added.

## Reference and limits

The requested video is https://youtu.be/M2XRHLJMGVQ. This environment's network proxy returned 403 for YouTube, so the clip could not be watched or compared. No claim of matching its shots or timing is made. An uploaded video would permit direct comparison.

Accessible references were [SEGA's Frontiers description](https://store.steampowered.com/app/1237320/Sonic_Frontiers/) and [Mineragrl's Giganto trial guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3043795839), alongside the previously supplied screenshots. These informed the attack/parry/counter vocabulary, scale and second-phase pressure; the trial guide's Final Horizon Hard tuning is not treated as story-mode data. Source facts and access status are recorded in reference/giganto-choreography-2.8.22.json.

All new curves, poses and effects are original code. The existing user-supplied models, textures and recordings remain unchanged. Motions are authored procedural clips, not official choreography or motion capture. Detailed facial/finger performance, commercial terrain assets and exact Frontiers rendering remain outside this update. No paid generation was used.

See VALIDATION.md and the Screenshots ZIP for executed checks and real game captures. Pose captures stage the native renderer; the complete native simulation, save/reload and audio flows are checked separately. Linux cross-build and embedded-payload extraction do not constitute a native Windows launch test. Managed browser policy restricts direct file navigation; exact standalone bytes are tested over loopback with external assets blocked. The downloadable HTML embeds its singleplayer assets and does not require a server.
