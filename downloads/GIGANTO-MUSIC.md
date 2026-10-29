# DCSMCRAFT 2.8.3 — Giganto battle music

The user's complete **Undefeatable.mp3** now replaces the generated score during the Giganto fight. Original file bytes, embedded cover, metadata and SHA-256 are retained in `public/audio/giganto/`; normal-world playlists, boss models, attacks, damage, controls and rewards are unchanged. Intro/traversal/transformation keep the earlier original synthesized accompaniment. The supplied recording begins when aerial combat actually starts, follows the half-health transition and plays a closing riff during defeat. Results, forfeit and return stop it.

This is a **custom adaptive edit synchronized to DCSMCRAFT's existing encounter**, not an exact copy of Sonic Frontiers' internal music script. A player's damage output controls the phases; the game does not delay damage, force a kill time or change the four/seven-second cinematics to fit a linear song. We have one mixed recording, not the original game's stems, transition assets or event markers. Production-perfect choreography, identical every-lyric timing and per-attack musical stingers are **not implemented**.

## Cue map

The recording was inspected locally using vocal timing landmarks and spectral onset peaks. The stable beat grid is 200 BPM; loops are 64 and 32 four-beat bars. Seconds refer to this uploaded file, not another online version. Cues live in `src/giganto-score-timeline.js` and can be adjusted there before rebuilding.

| Encounter event | Source cue / behavior |
| --- | --- |
| First aerial combat | Start at 0.00; opening proceeds normally. |
| A long first phase | At 103.24, loop to 26.44 (76.8 seconds / 64 bars). |
| Half-health cinematic | Crossfade to 175.14; its four-second pickup reaches the second main chorus at 179.14. |
| Second aerial phase | Continue into 179.14 without a restart after a natural transition; skipping the movie seeks directly to that cue. |
| A long second phase | At 198.94, loop to 160.54 (38.4 seconds / 32 bars). |
| Finishing cinematic | Crossfade to the closing heavy riff at 221.14 for the seven-second finale. |
| Victory / defeat / return | Fade out; no battle recording over the result menu or normal world. |
| Retry | Restart the appropriate combat-phase cue, or remain silent during traversal. |

Web Audio schedules playback against its own clock. Section changes use short gain ramps; each loop edge has a 2 ms taper in the decoded playback copy to prevent PCM clicks. The original MP3 remains unchanged. A natural transition joins the chorus continuously; skipped movies select their phase cue, old checkpoints fall back to their stage clock, and current checkpoints restore the actual saved music cursor. Phase events are sampled at 60 Hz; visible timing includes up to a simulation tick and normal device/output latency. Within a phase the audio clock owns playback, so rendering hitches never repeatedly seek the song. A natural phase pickup can join continuously within 25 ms; otherwise the phase event crossfades to its cue. This is not a promise of sample-perfect speaker-to-screen synchronization on every PC.

## Pause, saves and settings

Pause freezes the session/music position and stops the source. Resume starts from that position. Music-off, Music Volume zero, Master Volume zero, Encounter Audio off and Encounter Music off silence the recording; re-enabling seeks to the current fight position. Main Music Volume controls the recording separately from combat effects, and the existing master/compressor path remains. Audio decode errors leave gameplay usable and show one message.

The session stores a small optional `battleMusic` record containing only section and source offset; no PCM or encoded MP3 enters world saves. Export captures the actual audio position even between rendered frames. Old saves fall back to their existing `stageTime`; its old 120-second restore clamp is corrected to a bounded 10,000,000 seconds. Old saves remain compatible and retries clear the optional music cursor. Save envelope, generation and network protocol are unchanged. Apart from optional music metadata and the restored clock bound, boss simulation source is unchanged.

One full stereo buffer is decoded lazily during an active encounter with music enabled; approximately 89 MiB at 44.1 kHz or 97 MiB at 48 kHz. At most two sources overlap briefly during a transition. It is reused within that encounter and released on quit, forfeit, world change and return, including pending-decode cancellation. Other scenes do not decode this track. No external request, YouTube player or service is needed.

## Build and provenance

`node scripts/embed-giganto-score.mjs` reproducibly embeds the original MP3; normal npm predev/prebuild/pretest hooks call it. The generated `src/giganto-score-data.js` is omitted from source ZIPs to avoid a duplicate recording, but the original and generator are included. The standalone HTML and Windows payload carry the complete recording and notice. Controls remain in GIGANTO.md; executed verification is in VALIDATION.md.

Metadata identifies **Undefeatable (feat. Kellin Quinn)**, artist **SEGA SOUND TEAM - Topic**. The user supplied this Sonic Frontiers soundtrack recording. Rights remain with Sega and the respective composers, performers and rights holders; it is not covered by the project's MIT license. No separate redistribution license accompanied the upload. See `public/audio/giganto/NOTICE.txt` and its manifest for original hashes. Reference fight stages/half-health behavior were checked against https://sirusgaming.com/sonic-frontiers-giganto-boss-guide/; those facts do not supply official soundtrack cue timings.
