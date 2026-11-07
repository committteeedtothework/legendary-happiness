# Wyvern music · 2.11.2

The supplied **Titan WYVERN** recording loops in the arena entrance, tower, ribbon chase and transformation. Combat switches to **Break Through It All**:

| Encounter | Source segment | Behavior |
| --- | --- | --- |
| Phase 1 | 1:00–1:43 (60–103 seconds) | Loop |
| Phase 2, starting with its transition | 1:44–4:09 (104–249 seconds) | Loop |

Phase 2 seeks immediately when the encounter changes phase. Counters, QTEs and the final cinematic keep the active phase's music continuous. Victory fades it over three seconds. Death stops it; retry selects the checkpoint's phase. Returning releases both players and restores the overworld audio route. Music/master settings and pause remain arena-specific. An explicitly imported custom battle track still overrides the bundled battle recording.

Web Audio buffer-source loop points own combat timing; rendering frame delays never seek/restart the song. Loop edges use a 2 ms PCM taper. Source timestamps remain unchanged. Saving/restoring retains track identity and playback position. The prelude uses a single streaming media element; only the battle recording is decoded into a PCM buffer, lazily after music is enabled.

Playback copies use 96 kbps MP3 for the prelude and 128 kbps for battle to keep standalone ZIPs below GitHub's file-size limit. Full-length content is retained; playback and uploaded-source hashes are in public/audio/wyvern/manifest.json. These user-supplied Sega recordings are not MIT assets. Original uploads remain in the session attachments; no soundtrack was downloaded from the web.

Changed game modules are src/wyvern-audio.js, src/wyvern-music.js and the Wyvern music-position restoration in src/wyvern-simulation.js. Generation, combat tuning, Giganto and overworld audio remain unchanged. Build scripts embed these tracks in the HTML/Windows version and create hashed offline assets for mobile.
