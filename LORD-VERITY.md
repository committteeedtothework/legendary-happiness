# Lord Verity — 2.25.0

Lord Verity appears near an eligible player in the Overworld after roughly 90 seconds of world simulation, then no sooner than ten minutes after a visit. He chooses clear, supported ground within five blocks. Visits wait while players are flying, swimming, riding, in recent PvP, in a Stand trial, or surrounded by solid obstructions. Natural visits follow the existing Mob Spawning rule. No terrain is cleared and no existing creature or Titan statistics are changed.

Nearby players are compelled into a short dance: 2.4 seconds of arrival, 32 beats at the encounter's 112 BPM timing, and a three-second bow/departure. Movement, mining, attacks, item use and inventory opening are blocked during the sequence; pause and quit remain available. Collision stays upright and uses the existing physics. Damage is suppressed during the dance, and the sequence cancels if support becomes unsafe, the player leaves the dimension, dies or becomes a spectator. Camera composition changes visually without moving the player or overwriting their selected camera mode.

Follow the four prompts:

| Move | Keyboard | Controller | Touch |
|---|---|---|---|
| Left | A / Left arrow | D-pad left | Left button |
| Right | D / Right arrow | D-pad right | Right button |
| Kick | W / Up arrow | D-pad up | Up button |
| Clap | Space / F | Mapped jump button | Clap button |

Controller prompts use the detected family/custom mapping. Each beat can score once: two points within 110 ms, one within 240 ms. The dance always releases control; at least 32 of 64 points awards one emerald and five XP, once per visit. Full-inventory rewards drop into the correct world. Per-player participation, scores, rewards and world cooldowns survive normal saves. Co-op hosts own the encounter and validate score commands; guests cannot create visits, forge participation or replay a beat for extra rewards. Only players in the Overworld participate. Other players can see the character and dancing avatars through normal shared-world replication.

## Model and choreography

The shipped GLB is an **original reference recreation**, not Horror Skunx's original mesh or a downloaded Sketchfab asset. The public Sketchfab download endpoints returned HTTP 401 and require account sign-in. No paid Tripo generation was used.

The new asset has 19,192 triangles, 18 bones, eight material groups, and named Idle, VerityDance and Bow clips. It has dimensional eye sockets, grin/teeth, fingers, gold sleeve braids, waistcoat/tie, lapels, coat tails, shoes and a gold-banded fedora. The character is rendered as actual skinned geometry, not a sprite or face billboard. Player and NPC dance poses use articulated limbs and hands-to-hips/clap targets, alternating steps and kicks. Pose sampling follows encounter time; rendering interpolates between host ticks/packets. The body collision and held-item animation outside this encounter are unchanged.

Rebuild the committed GLB with Blender 4.3+:

```sh
blender -b --python scripts/build-verity-model.py
node scripts/embed-verity.mjs
```

Blender is not needed to build/play the game: the GLB is included. The standalone build embeds it, and desktop/mobile bundles package it as a local asset. Shadows and the optional local light respect existing graphics settings.

The character/costume references are credited below. Gemini video analysis was attempted through the installed analyze-youtube skill, but the current models returned service-unavailable responses; an older model was retired. Exact frame-by-frame choreography and original motion capture were therefore **not verified**. The dance is a functional reference-inspired recreation, not a claim of an exact original animation.

## Song

The identified recording is **Master of Humanity — Horror Skunx**:

https://www.youtube.com/watch?v=lhCPiauHI-g

By default, each visit opens a visible, controllable, privacy-enhanced YouTube player when music is enabled and audible. It uses the IFrame API when available and a standard visible embed if that script is blocked. The player is paused/removed on pause, exit, realm changes and encounter completion. Browser autoplay or regional/provider restrictions can require pressing Play in the player. No YouTube audio was extracted or bundled.

**Pause → Encounters** selects YouTube, Local MP3 or Off. Import a recording you are authorized to use for offline playback. That MP3 stays in the existing device-local music library, separate from world backups and relay traffic. Local playback uses the master/music volumes, pauses/resumes, seeks to encounter time after a co-op pause, fades during the bow and releases its media/Blob URL afterward. Background world/jukebox music pauses for the encounter and resumes through the existing music systems.

The packaged app identifies YouTube requests using the game’s public project URL as its HTTP Referer; a raw no-referrer embed produced Error 153, while the identified request returned the actual song title without that error. File-opened browser/legacy editions can still require a local MP3 or serving the game over HTTP(S). The actual original-song stream could not be verified in this environment: www.youtube.com requests are blocked, although the public no-cookie embed document is reachable. Actual local MP3 decoding/play/pause/resume and cleanup were tested using an original generated test tone, not a substituted Lord Verity recording. For reliable offline audio, import the song yourself; the soundtrack is not included in the downloads.

## References

- Horror Skunx, [Lord Verity — Master of Humanity](https://www.youtube.com/watch?v=lhCPiauHI-g), identified through YouTube/Music search links and the public video listing.
- [Lord Verity dance tutorial](https://www.youtube.com/watch?v=Syi3HSu3-Tk), search-identified video; native video analysis unavailable.
- Horror Skunx's [public dance tutorial listing](https://www.facebook.com/RealHorrorSkunx/videos/lord-verity-dance-tutorial-lordverity-verity/1112768507907187/), including its hands-on-hips/forward-step description.
- Xratior, [high-poly Lord Verity reference](https://sketchfab.com/3d-models/high-poly-model-lord-verity-8c39adaebb0e4f7aa6694b941caa7e10), credited there to Horror Skunx and Spooky Cat's port; listed CC BY 4.0. Its mesh is not distributed here.
- CheaterPMCPL, [Lord Verity RIG reference](https://sketchfab.com/3d-models/lord-verity-rig-1116a6c0018c4d0c9623a43fa4045cd8), listed CC BY 4.0. Its mesh is not distributed here.
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference) and [embedded player parameters](https://developers.google.com/youtube/player_parameters) for visible playback, controls and lifecycle integration.

Horror Skunx and ThatMob are credited for the referenced character/song universe. No affiliation or original creator asset ownership is claimed.

## Compatibility and validation

Use matching 2.25.0/protocol 7 clients and server for multiplayer. Existing save storage, supplied assets, world generation, item/NPC stats and both Titan simulations/rigs remain preserved. Default and hosted mobile branches are not updated. Both separate Windows editions retain their save profiles; export/import backups when switching editions.

The verification download includes unit/integration logs, real in-game rig/animation/camera/pause tests, imported MP3 playback, screenshots, source-preservation hashes and packaged runtime checks. Native Windows execution, actual original-song streaming and exact choreography fidelity remain unverified on this Linux build host.
