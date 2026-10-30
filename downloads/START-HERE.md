# DCSMCRAFT 2.8.7 downloads

These ZIPs contain the tested Giganto refinement build, including corrected torch updates, rig blending, arena audio/settings, expanded combat and corrected camera/stomp placement.

- Windows 10/11 x64: download and extract DCSMCRAFT-Windows-2.8.7.zip, then run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: download and extract DCSMCRAFT-Browser-2.8.7.zip, then open DCSMCRAFT.html. Its assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.7.zip contains source/assets and the dependency lock. Use Node 24.22.1/npm 11.9.0 and the included build instructions.

Keep the same browser/profile and file location for existing local worlds, or export/import a world backup when moving. The save format is unchanged.

Verification: 681 unit tests and 15 browser tests passed. One direct-file check was blocked by the managed browser policy. The Windows payload matches the tested HTML; native Windows execution remains unverified. Character motion, collisions and choreography are custom approximations; see the report included in each ZIP.
