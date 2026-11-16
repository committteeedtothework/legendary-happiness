import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("multiplayer update preserves supplied assets, generation, stats, save storage, visual rigs and both pure Titan simulations", () => {
  const files = JSON.parse(
    readFileSync(
      new URL(
        "../reference/multiplayer-preserved-2.22.0.json",
        import.meta.url,
      ),
    ),
  );
  assert.ok(Object.keys(files).length > 200);
  for (const required of [
    "src/world.js",
    "src/storage.js",
    "src/data.js",
    "src/giganto-simulation.js",
    "src/wyvern-simulation.js",
    "src/player-model.js",
  ])
    assert.ok(files[required], required);
  for (const [name, hash] of Object.entries(files)) {
    let content = readFileSync(new URL("../" + name, import.meta.url));
    if (name === "src/data.js")
      content = Buffer.from(
        content.toString().replace(/VERSION = "[^"]+"/, 'VERSION = "2.22.0"'),
      );
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      hash,
      name,
    );
  }
});
