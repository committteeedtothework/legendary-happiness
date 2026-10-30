# DCSMCRAFT 2.8.11 downloads

These ZIPs contain Homing Shot (V): six guided energy spheres with timed release, bounded steering/range and individually configurable damage; interrupted pose blending, jump/fall/boost/climbing animation fixes; and preserved combat cooldowns across reload. All previous armor ascent, arena graphics, combat, cinematics, audio, rewards and world return are retained. Overworld artwork, mechanics and saves are unchanged.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.11.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.11.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.11.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 726 unit tests and 20 browser tests passed (19 standalone and one production smoke). One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see GIGANTO-VOLLEY.md, GIGANTO-ASCENT.md, GIGANTO-CINEMATICS.md and GIGANTO-MOBILITY.md included in each ZIP.
