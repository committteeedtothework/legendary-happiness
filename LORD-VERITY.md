# Lord Verity — 2.25.1

Lord Verity appears on safe open Overworld ground after about 90 seconds, then has a ten-minute revisit cooldown. Nearby eligible players dance in place. The encounter lasts about **2 minutes 23 seconds**: 2.4 seconds of arrival, 256 dance beats at 112 BPM, and a three-second departure. Existing saves and visit/cooldown records remain compatible. Completed rewards are never granted twice.

## Controls

- Keyboard: **A/Left**, **D/Right**, **W/Up**, **S/Down**. Space and F also clap. Escape pauses.
- Controller: left stick or D-pad in all four directions. Down claps; the mapped Jump button also claps. Release the stick toward neutral between repeated moves. Device-specific prompts use the configured bindings.
- Mobile: the four dance buttons. Pause remains available. Touching restores touch input after using a controller.

The highlighted card shows the next unscored beat. Its gold bar indicates timing. Accepted inputs advance the card immediately. Perfect timing is within 0.14 seconds, Good within 0.31 seconds. A short early press can wait in a 0.14-second buffer; holding a key/stick does not repeat scores. Wrong moves and duplicate inputs never score. The host validates multiplayer inputs; remote poses retain the full extended timeline.

The maximum score is 512. At least 256 earns one emerald and five XP, once per visit. Normal movement, camera, inventory and combat controls return afterward. Death, dimension changes and unsafe support cancel the encounter safely. Pause freezes the singleplayer clock; save/reload preserves the active visit.

## Soundtrack

The user supplied **Lord Verity - Master of Humanity (song).mp3**, identified as **Master of Humanity — Horror Skunx**. The exact 5,635,271-byte MP3 is included in all builds and the mobile offline download at public/audio/verity/master-of-humanity.mp3. Its duration is about 140.85 seconds; SHA-256 is **28434d112238d82cba160a3b231f26879a5ee4becaefd69746931eee7d0332ee**. No YouTube extraction was used.

**Soundtrack** is the default. Every fresh visit starts from **0:00**, without seeking past the intro after loading. It plays once, fades during departure, pauses/resumes at its actual playhead and releases its voice on exit. Loading a saved active encounter resumes its existing position. The game's gesture-unlocked Web Audio context handles the supplied recording on mobile; the normal audio-volume settings apply. Late decoding cannot start music after the encounter has ended.

**Pause → Encounters** also offers Local MP3, optional YouTube and Off. Existing Local MP3/Off preferences remain available; the previous default YouTube choice migrates to the included Soundtrack. Imported files stay in the device's music library. No Internet connection or video player is needed for the supplied recording.

## Model and references

The 19,192-triangle, 18-bone GLB remains an original reference recreation with Idle, VerityDance and Bow clips. The creator's original Sketchfab mesh was not downloaded. Appearance references remain Horror Skunx/ThatMob, [Xratior's high-poly listing](https://sketchfab.com/3d-models/high-poly-model-lord-verity-8c39adaebb0e4f7aa6694b941caa7e10) and [CheaterPMCPL's rig listing](https://sketchfab.com/3d-models/lord-verity-rig-1116a6c0018c4d0c9623a43fa4045cd8). Original creator ownership is not claimed.

Song reference: [Horror Skunx — Master of Humanity](https://www.youtube.com/watch?v=lhCPiauHI-g). Dance references: [tutorial](https://www.youtube.com/watch?v=Syi3HSu3-Tk) and [creator's public tutorial listing](https://www.facebook.com/RealHorrorSkunx/videos/lord-verity-dance-tutorial-lordverity-verity/1112768507907187/). Earlier native-video analysis attempts were unavailable; exact original choreography remains unverified. The dance is reference-inspired, not original motion capture.

## Compatibility

Use matching **2.25.1 / protocol 8** clients and relay. Main, supplied models/textures, world generation, item/NPC statistics, save storage and Titan tuning remain preserved. The current mobile site receives this update at the same URL and storage scope. Windows editions retain their separate existing save profiles. Physical iOS/Safari and native Windows execution remain unverified on this Linux host; browser tests use touch emulation/software WebGL.
