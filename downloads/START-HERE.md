# DCSMCRAFT 2.8.15 downloads

This Giganto-only update corrects cinematic/audio clock alignment, selects score sections from encounter events, preserves pre-fight music across reload and adds local MP3 imports with editable cue maps. The existing supplied recordings, arena presentation, combat balance, overworld gameplay/assets and save envelope are retained.

- Windows 10/11 x64: extract DCSMCRAFT-Windows-2.8.15.zip and run DCSMCRAFT.exe with Edge or Chrome installed.
- Browser: extract DCSMCRAFT-Browser-2.8.15.zip and open DCSMCRAFT.html; assets are embedded for offline singleplayer.
- Source: dcsmcraft-source-v2.8.15.zip includes source/assets, dependency lock and build instructions.
- Screenshots: DCSMCRAFT-Screenshots-2.8.15.zip contains actual in-game captures and a local gallery.

Inside the arena: Escape > Battle settings > Audio > Soundtrack. Local MP3 files stay on this PC/browser. World backups carry their track reference and cue map, so choose the file again when moving to another PC. Use supplied track and Reset cue map restore the bundled arrangement. Use the same browser/profile/file location for existing worlds, or export/import a backup.

752 unit tests, 9 targeted standalone browser cases and one production smoke pass. Native Windows launch remains untested; the launcher embeds/extracts the tested HTML. Direct-file opening remains restricted by the build host's managed policy. Existing soundtrack recordings were supplied by the user; no new commercial audio or independent redistribution license was obtained. Official stems/event markers are unavailable and reference footage could not be accessed, so exact commercial timing is not claimed. Read GIGANTO-MUSIC-DIRECTION.md for changed files, reference notes, tests and limits.
