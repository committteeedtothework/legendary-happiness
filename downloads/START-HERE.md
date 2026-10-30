# DCSMCRAFT 2.8.9 downloads

These ZIPs contain the tested Giganto movement build: contact-timed cinematic beam/grab counters, seven new runtime rig clips, a beat-timed finisher with planted collapse feet, and safe scene saves/skips. Prior tactical steps, moving-body contacts and Wild Rush are retained. All previous torch, arena audio, settings and combat updates are retained; overworld artwork and saves are unchanged.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.9.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.9.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.9.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 705 unit tests and 17 browser tests passed. One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see GIGANTO-CINEMATICS.md and GIGANTO-MOBILITY.md included in each ZIP.
