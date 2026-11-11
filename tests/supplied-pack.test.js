import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  BLOCKS,
  ITEMS,
  GENERATION_VERSION,
  DEFAULT_SETTINGS,
} from "../src/data.js";
import { VIDEO_CHOICES } from "../src/graphics.js";
import { suppliedBlockFaces } from "../src/supplied-pack.js";
import {
  SUPPLIED_BLOCKS,
  SUPPLIED_ITEMS,
  SUPPLIED_PIXELS,
} from "../src/supplied-pack-data.js";

const manifest = JSON.parse(readFileSync("public/supplied-pack/manifest.json"));
test("supplied artwork preserves selected source PNGs and valid full-size RGBA runs", () => {
  assert.equal(manifest.assets.length, 189);
  for (const asset of manifest.assets) {
    const name = asset.path.replace("assets/minecraft/textures/", "");
    const source = readFileSync("public/supplied-pack/" + name);
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      asset.sha256,
    );
    assert.equal(source.readUInt32BE(16), asset.size[0]);
  }
  for (const [name, encoded] of Object.entries(SUPPLIED_PIXELS)) {
    const runs = Buffer.from(encoded, "base64");
    assert.equal(runs.length % 5, 0);
    let pixels = 0;
    for (let i = 0; i < runs.length; i += 5) {
      assert.ok(runs[i] > 0);
      pixels += runs[i];
    }
    assert.equal(pixels, 256, name);
  }
  const raw = Buffer.from(SUPPLIED_PIXELS["block/bamboo_stalk"], "base64"),
    alpha = [];
  for (let i = 0; i < raw.length; i += 5)
    for (let n = 0; n < raw[i]; n++) alpha.push(raw[i + 4]);
  assert.equal(
    alpha.filter((a) => a === 255).length,
    48,
    "native bamboo UV strip becomes a three-pixel stalk, not an opaque panel",
  );
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      assert.equal(alpha[y * 16 + x], x >= 6 && x <= 8 ? 255 : 0);
});
test("mapped block faces, door states and inventory IDs resolve; custom art and generators stay intact", () => {
  for (const [key, faces] of Object.entries(SUPPLIED_BLOCKS)) {
    assert.ok(BLOCKS.some((b) => b.key === key) || key.startsWith("oak_door_"));
    for (const face of faces) assert.ok(SUPPLIED_PIXELS["block/" + face], face);
  }
  for (const b of BLOCKS.filter((b) => b.door))
    assert.equal(
      suppliedBlockFaces(b)[1],
      b.door.upper ? "oak_door_top" : "oak_door_bottom",
    );
  for (const [key, name] of Object.entries(SUPPLIED_ITEMS)) {
    assert.ok(ITEMS[key], key);
    assert.ok(SUPPLIED_PIXELS[name.includes("/") ? name : "item/" + name]);
  }
  for (const key of [
    "devin_sword",
    "matthew_dual_pistols",
    "hellfire_sword",
    "dirt_sword",
  ])
    assert.equal(SUPPLIED_ITEMS[key], undefined);
  for (const key of [
    "devin_relic_blade",
    "hellfire_ore",
    "matthew_altar",
    "bed",
  ])
    assert.equal(
      suppliedBlockFaces(BLOCKS.find((b) => b.key === key)),
      undefined,
    );
  assert.equal(DEFAULT_SETTINGS.texturePack, "renewed");
  assert.equal(GENERATION_VERSION, 16);
  assert.deepEqual(
    VIDEO_CHOICES.texturePack.map((p) => p[0]),
    ["renewed", "soft", "classic", "supplied"],
  );
});
