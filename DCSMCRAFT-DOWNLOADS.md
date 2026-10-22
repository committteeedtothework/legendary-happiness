# DCSMCRAFT 1.5.0 — Infernal Kingdoms

Download the Windows ZIP, extract it and run DCSMCRAFT.exe. Requires installed Edge or Chrome. The standalone HTML remains self-contained.

Six Cinderworld regions, huge infernal citadels/cathedrals/foundries, three new original monsters, six persistent defenders per treasure vault, enchanted Hellfire loot and a Cinder Sigil temple key. Devin Sword Guardians deflect bullets, have 140 health when newly spawned and deal stronger melee/special damage. New temples add a Sigil-consuming outer ward, lava moat and narrow approach. All three Guardians still gate the inner sanctuary and uninterrupted 30-second extraction. Includes an original DMC3-inspired Vergil skin with blue embroidered coat, animated tails, silver hair, gloves and cosmetic sheathed katana.

**New world required for the new temple and terrain.** Previously unvisited Cinderworld realms also use the new generator; existing generators 2–10 keep their terrain, including unexplored chunks. Older Guardians retain their saved current health but gain bullet immunity and stronger attacks. No game code or buildings in existing saved realms are overwritten. Main and previous downloadable releases are retained.

- [Windows 10/11 game ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.5.0/downloads/DCSMCRAFT-Windows-1.5.0.zip)
- [Browser build ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.5.0/downloads/dcsmcraft-build-v1.5.0.zip)
- [Multiplayer relay ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.5.0/downloads/DCSMCRAFT-Multiplayer-Server-1.5.0.zip)
- [Complete source ZIP](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.5.0/downloads/dcsmcraft-source-v1.5.0.zip)
- [Checksums](https://raw.githubusercontent.com/committteeedtothework/legendary-happiness/downloads-v1.5.0/downloads/DCSMCRAFT-v1.5.0-checksums.json)

Validation: 310 core tests and six selected browser scenarios passed, including the actual 30-second extraction, vault protection, permanent defeats/reload, portal entry, Vergil/F5, real HTTPS/WSS and Survival multiplayer inventory/duplication regressions. Combat/browser tests use controlled setup and positioning; this is not a claim of an unaided playthrough or zero bugs. Fifty-four sampled legacy chunks across both dimensions and generators 2–10 were byte-identical to release 1.4.1. ZIP CRCs and original/downloaded SHA-256 checksums are verified.

Use the named complete-source ZIP for application code, assets, dependencies, build/launch instructions and the completed/partial/missing checklist; GitHub's automatic source archives contain the distribution branch. Reference mechanics remain Minecraft Java Edition 1.20.4 with partial parity. Infernal upper towers have no ladders or furnished upper floors; monster AI uses local steering. Cinderworld travel remains unavailable during co-op. Multiplayer hosting requires Node.js; optional public tunnels also require cloudflared and a running host browser. Actual Windows execution and live Cloudflare tunneling remain unverified on this Linux host. See README.md, FEATURES.md and VALIDATION.md in the source archive.
