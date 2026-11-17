// 2.23.0 multiplayer and 2.25.0 Lord Verity encounter hooks are authorized.
// verity-preserved.test.js byte-checks ordinary rendering/input/audio outside the new hooks.
// Other files are still checked by their original guards and the new release baseline.
export const multiplayerAuthorized = new Set([
 "desktop/electron/main.cjs","scripts/build-electron.mjs",
 "src/controller.js","src/jukebox.js","src/overworld-music.js","src/renderer.js",
 "server/Dockerfile","server/compose.yaml","render.yaml","scripts/build-standalone.mjs","scripts/build-local-game.mjs",
  "src/aquatic.js",
  "src/end-runtime.js",
  "src/wyvern-integration.js",
  "server/protocol.mjs",
  "server/relay.mjs",
  "src/aquatic-gear.js",
  "src/audio.js",
  "src/cave-life.js",
  "src/chat.js",
  "src/coop-players.js",
  "src/coop-survival.js",
  "src/devils-palm.js",
  "src/giganto.js",
  "src/hostile-combat.js",
  "src/main.js",
  "src/matthew.js",
  "src/multiplayer.js",
  "src/physics.js",
  "src/realms.js",
  "src/rift-trial.js",
  "src/seeker.js",
  "src/simulation.js",
  "src/stand-abilities.js",
  "src/style.css",
  "src/ui.js",
  "src/weather.js"
]);
