# Wool and water texture correction

This local correction is the user's explicit exception to the current
**Giganto encounter only** change scope. Do not resume unrelated sandbox work
or the remaining audit stages without a new instruction. See AGENTS.md.

The older completion layer replaced existing wool with high-contrast diagonal
cloth noise and water with stepped bands. It now leaves those existing textures
alone, restoring the earlier atlas painters instead of adding replacement art.

- Restores all 16 wool colors, including the textures shared by their existing
  slabs/stairs and the white carpet.
- Restores source water, seven flowing levels and falling water: nine water
  states, including top, side and bottom faces.
- Keeps native Supplied Assets wool/water images intact. Classic is unchanged.
- Leaves other blocks, lava, plants, particles, renderer settings, water physics,
  world generation, saves, combat, Stands, multiplayer and the Giganto fight alone.

Only `src/completed-block-art.js` changes among application runtime files.
No block IDs or save format changed; existing worlds need no regeneration.

## Verification

- `npm test`: **661 passed**, zero failures.
- `tests/browser/wool-water.spec.js`: **passed** on the exact rebuilt standalone
  HTML. It compares all **75 restored faces across all three packs** against the
  frozen 2.7.18 RGBA hashes, and compares a SHA-256 of **every other atlas pixel**
  against the unmodified 2.8.6 audit build. All restored faces match, every other
  pixel is unchanged, and the entire Classic atlas is unchanged.
- Inspected before/after screenshots of the full wool palette, a water pool and
  every water flow state in an actual world, before entering Giganto.
- Standalone build passed. Windows cross-compilation and byte-for-byte embedded
  HTML extraction passed. Native Windows launch remains untested on Linux.

To repeat the comparison, first build standalone, then provide the unmodified
audit HTML and run:

```sh
DCSMCRAFT_BEFORE_HTML=/path/to/DCSMCRAFT-Audit-P0.html npx playwright test tests/browser/wool-water.spec.js
```

Use the same Node/npm and browser setup described in BUILDING.md. The comparison
case skips explicitly if its baseline HTML was not supplied; it never silently
replaces that baseline with the corrected file.

The local Browser ZIP contains `DCSMCRAFT-Standalone.html`; extract and open it
in a desktop browser with WebGL 2. The Windows ZIP contains the existing launcher
with that same corrected HTML. No server is required for singleplayer. No new
release has been published, and the existing published downloads are unchanged.
