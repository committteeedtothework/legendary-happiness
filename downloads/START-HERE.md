# DCSMCRAFT 2.9.1 downloads

Overworld chunk streaming now reuses worker neighborhoods, hands full generated terrain to collision/gameplay, queues GPU installation, blends near detail over distant terrain and bounds retained meshes. Menus and the original DCSMCRAFT logo follow Java-style visual conventions. Controller source handoff, remapping, tab navigation, death/respawn and menu Back behavior are refined. Existing world generation, saves, textures, music, items and arena combat are preserved.

- Windows 10/11 x64: extract DCSMCRAFT-Windows-2.9.1.zip and run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: extract DCSMCRAFT-Browser-2.9.1.zip and open DCSMCRAFT.html. Singleplayer needs no local server.
- Source: dcsmcraft-source-v2.9.1.zip includes code, assets, dependencies/lock, notices, tests and build instructions.
- Screenshots: DCSMCRAFT-Screenshots-2.9.1.zip includes actual captures and verification reports.

813 unit tests, 18 standalone browser cases and 4 production checks pass. A single paired worker CPU run measured about 74% less warm processing time with identical mesh bytes; this is not an FPS guarantee. Distant LOD and first-load/teleport hitches remain practical limits. Menus use original assets and custom pages, rather than exact official branding or every official page. Physical controllers and native Windows launch remain untested; virtual Gamepad input and executable extraction are verified. Exact HTML is tested over loopback because managed browser policy restricts direct file navigation.

Read OVERWORLD-STREAMING.md, CONTROLLERS.md and VALIDATION.md. Export a world backup before changing browser/profile/file location. This downloads branch does not alter the default branch.
