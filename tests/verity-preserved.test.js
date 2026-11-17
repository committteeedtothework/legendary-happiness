import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { withoutVerityHooks } from "./helpers/verity-preservation.js";
test("Lord Verity preserves source assets, save storage, generation, Titan rules/rigs and all normal rendering/input/physics outside its explicit hooks", () => {
  const before = JSON.parse(
    readFileSync(
      new URL("../reference/verity-preserved-2.24.0.json", import.meta.url),
    ),
  );
  assert.ok(Object.keys(before).length > 200);
  for (const [name, hash] of Object.entries(before)) {
    const content = withoutVerityHooks(
      name,
      readFileSync(new URL("../" + name, import.meta.url)),
    );
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      hash,
      name,
    );
  }
});
