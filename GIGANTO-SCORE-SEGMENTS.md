# Giganto · Undefeatable segments · 2.8.20

Only arena music playback changes. The supplied MP3 bytes, combat balance, cinematics, models, scenery, return portal and Overworld behavior remain unchanged.

| Event | Playback |
| --- | --- |
| Phase 1 begins | Start at 0:00. |
| Phase 1 exceeds 2:00 | Loop to 0:00, repeating the 120-second section. |
| Half-health / Phase 2 transition starts | Immediately seek to 2:01 (121 seconds). |
| Phase 2 combat resumes after its cinematic | Continue the same source; do not repeat the opening four seconds. |
| Phase 2 reaches the end of the recording | Loop to 2:01. This includes the full remainder of the song, as requested. |
| Giganto reaches zero health / finishing cinematic begins | Immediately seek to 3:57 (237 seconds), without looping. |
| Finishing cinematic ends | Continue the same source throughout the playable aftermath. |
| Recording finishes | Stop once; never restart on subsequent frames or reload. |
| Player leaves the arena before the song ends | Fade/clean up the arena source through the existing exit path. |

The supplied recording includes silent opening/tail samples; those remain intact. The exact endpoint comes from the decoded audio duration, rather than the MP3 container's padding estimate (about 4:25). The existing 1.8-second smooth fade now occurs at the recording's end, not the seven-second cinematic boundary. The cutscene length and its explosion cues are unchanged. Short transition ramps and two-millisecond loop-edge tapers prevent clicks in the decoded playback copy; the source file is not edited.

The Web Audio clock owns playback. Pause/resume and save/reload retain the actual source cursor, including victory positions beyond the cinematic. Phase events select cues directly; no wall-clock timeout triggers them. Retry resets the appropriate phase cue. The pre-fight music and world playlists are unchanged. Existing saved custom cue maps are preserved; Soundtrack > Reset cue map applies these new defaults. Local MP3 selection and explicit custom cue maps remain available; editing a Phase 2 loop endpoint overrides the default recording-end boundary.

Verification covers exact source ranges, native loop properties and wrapping, phase handoff without duplicate sources, late-frame behavior, pause/resume, saved victory cursors and completion without replay. Browser checks use the actual embedded recording, measure audible output during the victory passage, and verify the native final gain envelope separately from the recording’s silent tail. See VALIDATION.md for executed results and STAGE-CHANGED-FILES.txt for the complete changed-file list.

A stage change is delivered by the existing simulation/render event loop, so physical output includes device latency and up to a game tick/frame. The requested source timestamps are exact; this is not a sample-perfect speaker/video synchronization claim. Native Windows launch remains untested on the Linux build host; the Windows launcher embeds the browser-tested HTML.
