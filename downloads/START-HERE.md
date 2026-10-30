# DCSMCRAFT 2.8.8 downloads

These ZIPs contain the tested Giganto movement build: turning and planted tactical steps, shared moving-body contacts/camera, reachable grabs, and a physical Wild Rush zigzag. All previous torch, arena audio, settings and combat updates are retained; overworld artwork and saves are unchanged.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.8.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.8.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.8.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 693 unit tests and 16 browser tests passed. One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see GIGANTO-MOBILITY.md and GIGANTO-REFINEMENT.md included in each ZIP.
