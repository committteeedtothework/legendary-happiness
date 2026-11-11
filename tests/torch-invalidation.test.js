import test from "node:test";
import assert from "node:assert/strict";
import { World, index } from "../src/world.js";
import { B, MIN_Y, MAX_Y } from "../src/data.js";
import { dirtyLightRegion, buildBlockLight } from "../src/block-light.js";
function tunnel() {
  const w = new World("light cache regression");
  for (let z = -1; z <= 1; z++)
    for (let x = -1; x <= 1; x++) {
      const key = `${x},${z}`;
      w.chunks.set(key, {
        key,
        cx: x,
        cz: z,
        maxY: 204,
        data: new Uint16Array(256 * (MAX_Y - MIN_Y + 1)),
      });
    }
  for (let x = -1; x <= 22; x++)
    for (let y = 199; y <= 202; y++)
      for (let z = 4; z <= 6; z++) w.set(x, y, z, B.stone);
  for (let x = 0; x <= 21; x++) w.set(x, 200, 5, B.air);
  w.set(13, 200, 5, B.torch);
  return w;
}
test("wall opening/closing invalidates neighboring light even when lamp caches have never been built", () => {
  const w = tunnel();
  for (const c of w.chunks.values()) delete c.lightSources;
  w.dirty.clear();
  const before = w.revisions.get("1,0") || 0;
  w.set(14, 200, 5, B.stone);
  assert.ok(w.revisions.get("1,0") > before);
  assert.equal(buildBlockLight(w, w.chunks.get("1,0"))(16, 200, 5), 0);
  for (const c of w.chunks.values()) delete c.lightSources;
  w.dirty.clear();
  w.set(14, 200, 5, B.air);
  assert.ok(w.dirty.has("1,0"));
  assert.equal(buildBlockLight(w, w.chunks.get("1,0"))(16, 200, 5), 11);
});
test("lamp edits invalidate not-yet-loaded worker destinations without generating chunks", () => {
  const w = tunnel();
  w.chunks.delete("1,0");
  const count = w.chunks.size;
  const revision = w.revisions.get("1,0") || 0;
  dirtyLightRegion(w, 15, 5);
  assert.equal(w.chunks.size, count);
  assert.ok(w.revisions.get("1,0") > revision);
});
