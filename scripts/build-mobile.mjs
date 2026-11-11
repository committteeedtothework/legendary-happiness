import { buildLocalGame } from "./build-local-game.mjs";
await buildLocalGame(process.argv[2] || "dist/mobile", { mobile: true });
