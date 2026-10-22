# DCSMCRAFT 1.7.0 — Cave Update

Download the Windows ZIP, extract it and run DCSMCRAFT.exe. The self-contained HTML remains available for desktop browsers. The Windows launcher requires installed Edge or Chrome.

Create a **new world** for four expanded underground regions: hollow halls, dripstone vaults, moss grottos and deep rifts, with linked tunnels, sloping entrances, and rare abandoned mineshafts containing timber supports, slowing cobwebs, decorative rails and persistent loot chests. Ore deposits now form spaced veins; diamonds are small, uncommon deposits between Y −56 and 8.

Zombies, skeletons, creepers and spiders can spawn in dark caves during daylight. Torches suppress spawning locally. **The Watcher** rarely appears in the darkness: a pale, long-limbed, black-eyed stalker that never attacks, cannot be killed, and laughs when caught staring. Continuous original cave ambience includes irregular drips, echoes, groans and creaks; surface nights have a calm eerie undertone. Creative adds 24 unlimited spawn eggs in the searchable catalog, with no Survival crafting, drops or use.

Existing saved terrain (generators 2–11) is preserved, including unexplored chunks. Old caves receive the new spawning, ambience and Watcher, but new layouts/mineshafts/ore placement need a new world. Cinderworld terrain and prior progression are retained. The multiplayer generation check now accepts generator 12. Export backups before upgrading; do not reopen updated saves in old builds.

- [Windows 10/11 game ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-Windows-1.7.0.zip)
- [Standalone offline HTML](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-Standalone-v1.7.0.html)
- [Browser build ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/dcsmcraft-build-v1.7.0.zip)
- [Multiplayer relay ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-Multiplayer-Server-1.7.0.zip)
- [Complete source ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/dcsmcraft-source-v1.7.0.zip)
- [Checksums](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-v1.7.0-checksums.json)
- [Validation report](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-v1.7.0-validation.json)
- [Terrain compatibility report](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.7.0/downloads/DCSMCRAFT-v1.7.0-compatibility.json)

Validation: **350 core tests and six distinct browser scenarios pass**. The exact standalone checks cover Creative eggs, persistent mineshaft loot, daytime cave spawning, a natural Watcher with accelerated rarity timers, actual melee/bullet immunity, gaze laughter, cave/night WebAudio, four rendered natural cave regions. Retained Guardian acquisition and actual HTTPS/WSS Survival synchronization scenarios also pass. Controlled positions/equipment/timers make these reproducible; this is not an unaided complete Survival playthrough or a guarantee of no bugs. Sixty sampled old-generator chunks match 1.6.1 byte-for-byte, plus three unchanged Cinderworld samples for generator 12. ZIP CRCs, embedded HTML and public download SHA-256 checksums are verified.

Rails are decorative (no minecarts), dripstone is cubic decoration, and lighting/spawning/navigation remain simplified. Reference mechanics remain Minecraft Java Edition 1.20.4 with partial parity. The named complete-source ZIP includes application source, original assets, dependency lockfile, tests, launch/build instructions and the completed/partial/missing checklist. GitHub automatic source archives contain the distribution branch. Direct file:// navigation is blocked by managed Chromium policy and remains unverified; the identical standalone HTML is tested over isolated local HTTP with outside requests blocked. Native Windows execution, live Cloudflare tunneling and real YouTube playback remain unverified here. See README.md, FEATURES.md and VALIDATION.md for scope and limitations.
