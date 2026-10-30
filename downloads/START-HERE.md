# DCSMCRAFT 2.8.12 downloads

These ZIPs contain the rebuilt double sweep: separately timed hands, distinct warnings and follow-up audio, a dedicated torso clip, swept contact windows, fair parry/dodge handling and continuous hand recovery. Sonic guard blending is smoother. Prior abilities, armor ascent, graphics, cinematics, audio, rewards and world return remain. Overworld artwork, mechanics and saves are unchanged.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.12.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.12.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.12.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 735 unit tests and 21 browser tests passed (20 standalone and one production smoke). One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see GIGANTO-SWEEPS.md, GIGANTO-VOLLEY.md, GIGANTO-ASCENT.md, GIGANTO-CINEMATICS.md and GIGANTO-MOBILITY.md included in each ZIP.
