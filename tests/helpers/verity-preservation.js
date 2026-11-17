// Remove only the isolated 2.25 encounter hooks for legacy byte-preservation
// checks. The added encounter itself has functional, authority and browser tests.
export function withoutVerityHooks(name, bytes) {
  const hooks = {
    "desktop/electron/main.cjs":["const {installYouTubeIdentity} = require('./youtube.cjs');\n",'      installYouTubeIdentity(window);\n'],
    "src/controller.js": [
      "    if(g.verity?.controller(r,edge)){this.padKeys.clear();return;}\n",
    ],
    "src/jukebox.js": [
      [
        'const show = ["play", "jukebox"].includes(g.ui.screen)&&!g.verity?.active;',
        'const show = ["play", "jukebox"].includes(g.ui.screen);',
      ],
    ],
    "src/overworld-music.js": ["      !game.verity?.active &&\n"],
    "src/physics.js": [
      '      (p.verityDance && ["arrival","dance","bow"].includes(p.verityDance.phase)) ? null :\n',
      '    (p.verityDance && ["arrival","dance","bow"].includes(p.verityDance.phase)) ||\n',
    ],
    "src/renderer.js": [
      "import {VerityVisuals} from './verity-visuals.js';\n",
      "    this.verityVisuals = new VerityVisuals(this);\n",
      "    this.verityVisuals?.clear();\n",
      "    if(game?.verity)this.verityVisuals.compose(game,frameDt);\n",
    ],
  };
  if (!hooks[name]) return bytes;
  let s = bytes.toString();
  for (const h of hooks[name] || [])
    s = Array.isArray(h) ? s.replace(h[0], h[1]) : s.replace(h, "");
  return Buffer.from(s);
}
