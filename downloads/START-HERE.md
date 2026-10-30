# DCSMCRAFT 2.8.10 downloads

These ZIPs contain the tested Giganto armor ascent and contact shading update: climb the visible armor to the final Emerald, save and reload at earned armor checkpoints, use dedicated wall-run poses, and choose optional arena-only contact shading. Existing combat, cinematics, audio, portal, reward and return systems are retained. Overworld artwork, mechanics and saves are unchanged.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.10.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.10.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.10.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 717 unit tests and 19 browser tests passed (18 standalone and one production smoke). One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see GIGANTO-ASCENT.md, GIGANTO-CINEMATICS.md and GIGANTO-MOBILITY.md included in each ZIP.
