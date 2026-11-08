# Wyvern recording reference · 2.11.1

Reference supplied by the user: https://www.youtube.com/watch?v=dkzQALlpzPc&t=360s . The timestamp points to 06:00; the analysis also covered the surrounding fight so the ending was kept in context.

The installed `analyze-youtube` skill used Gemini 3.7 Flash's native YouTube input with `store=false`. The first timestamped request failed to fetch, a canonical request encountered high demand, and an alternate model denied access. A final canonical request succeeded, followed by a focused verification pass. No recording, soundtrack, captions or commercial assets were downloaded. Direct playback and metadata access from this environment were blocked by the network proxy, so this is Gemini-assisted evidence, not independently frame-verified footage. Exact title/channel metadata remains unverified.

## Evidence used

These are approximate timestamps reported by the analysis, not production animation or audio cue measurements.

| Footage | Agreed observation | Build response |
| --- | --- | --- |
| 00:32–03:20 | Nighttime coastal desert; a physical tower followed by a long red ribbon chase | Coastal island/ocean backdrop, dark sky and moon, longer 2,400-unit ribbon, rings and lane obstacles |
| 03:21–03:33 | Seven Emeralds, a bright transformation and golden Super Sonic | Twelve-second transformation with stretched, synchronized existing poses/effect/audio events |
| 03:36 onward | Wyvern and Sonic travel over cliffs and water with a trailing pursuit camera | Continuous authored flight-frame path; scenery remains anchored; shared local contacts and free movement stay consistent |
| 04:00 onward | Claw parries, close damage windows and a spinning throw counter | Boost catch-up alternative, parry-to-counter throw with one contact event, orbiting counter camera and smooth recovery |
| Around 05:05 | Dorsal energy rings and brightening daylight | Twenty-second emitter deployment, energy cage and gradual night-to-day lighting across the fight |
| 05:59–06:06; 06:58–07:04 | Missiles surround Sonic; a red ring shrinks toward a white target | Red timing ring, fixed white target, matching success window and curved missiles with bounded red trails |
| 06:38–07:18 | Several timing/mash prompts followed by jaw prying and a missile finish | Timing → hold → launch → missile barrage timing → jaws mash → missile push mash → explosion |
| Around 07:19–07:22 | Bright internal detonation and clearance | Later detonation event, white/pink flash, sparks and a longer escape shot; the existing playable return portal remains |

## Corrections and uncertain claims

The first analysis described a laser-beam struggle; the second explicitly rejected that description. No beam struggle was added. The passes also disagreed on consecutive claw counts and gave ring-count descriptions that do not establish uninterrupted depletion or damage rules. The previously sourced one-claw/two-claw phase pattern, configurable ring drain and established health/damage values remain. Missile reflection's strict necessity was not established by the clip; the build now also allows sustained boost catch-up before a properly telegraphed claw attack.

No particular spline implementation, skeleton topology or internal engine behavior can be proven from video pixels. This build uses its own analytic moving frame and the supplied Wyvern skin, with locally authored clips and additional tail bending. It does not import official animation curves. The tower's ramp, gap crossings, collision approximations, camera paths, counter grip and scenery remain adaptations. New movie durations are authored approximations: intro 8s, transformation 12s, phase reveal 20s, counter 6s, slam 6.5s, launch 5s and finale 10s. Interactive QTE duration depends on the player's inputs. No exact 1:1 fidelity is claimed.

## Controls, compatibility and audio

Hold **Shift** with lock-on to close the distance; WASD overrides automatic catch-up, and Tab disengages targeting. **RMB** parries; an immediate **LMB** counter can initiate the claw throw. All existing Sonic moves remain. Each counter opening can produce one cinematic throw, not an infinite counter loop. Timing and mash prompts accept LMB or Space, with existing controller/touch bindings.

The original adaptive score remains; no authorized Wyvern music recording accompanied this reference. Local MP3 import remains available, with the cue editor now accessible before importing a shorter track. Existing Giganto recordings and Overworld audio are unchanged. Event-based effects, music pause/resume and reward transactions retain the existing architecture.

Old Wyvern chase saves convert their progress fraction once to the longer track and retain pickup IDs. New counter/ending stages, flight time and one-shot cue flags persist. Physics stays in the same local frame as characters, missiles, effects and camera, while the coast stays in world space. The sky is camera-centered to avoid sun/moon parallax. After victory the flight/lighting profile freezes; water still animates on simulation time. Original world state, Giganto progress and rewards are preserved.

Changed implementation: `src/wyvern-choreography.js`, `src/wyvern-environment.js`, and the existing Wyvern simulation, view, model, audio, integration and CSS modules. Runtime model/media assets and sandbox source are unchanged except the release version. See `tests/wyvern-reference.test.js`, `tests/wyvern.test.js` and `tests/browser/wyvern.spec.js` for validation.
