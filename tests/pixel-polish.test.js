import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ITEMS } from "../src/data.js";
import { itemSprite } from "../src/item-art.js";
import { createHandRig, updateHandRig } from "../src/first-person.js";
import { actionPose } from "../src/animation.js";

test("view-model arm stays connected to a fixed off-screen elbow across both hands and full weapon actions", () => {
  const camera = new THREE.PerspectiveCamera(70, 1.6, 0.04, 4);
  for (const left of [false, true]) {
    const rig = createHandRig();
    rig.root.scale.x = left ? -1 : 1;
    rig.wrist.rotation.set(left ? 0.04 : -0.12, 0.1, -0.13);
    for (const tool of [
      "sword",
      "spear",
      "axe",
      "pickaxe",
      "shovel",
      "hoe",
      "pistols",
    ]) {
      for (const kind of [
        "attack",
        "mine",
        "use",
        "place",
        "eat",
        "hit",
        "fire",
      ]) {
        for (let i = 0; i <= 20; i++) {
          const p = actionPose(kind, i / 20, tool);
          rig.root.position.set(
            (left ? -1 : 1) * (0.37 + p.x),
            -0.27 + p.y,
            -0.72 + p.z,
          );
          rig.root.rotation.set(p.rx, p.ry, p.rz);
          updateHandRig(rig);
          rig.root.updateMatrixWorld(true);
          const expectedHand = rig.wrist.localToWorld(
            new THREE.Vector3(0, -0.04, 0.025),
          );
          // The square hand ends at its item socket and joins the sleeve.
          const skinTop = rig.forearm.localToWorld(
            new THREE.Vector3(0, -0.5, 0),
          );
          const sleeveTop = rig.cuff.localToWorld(
            new THREE.Vector3(0, -0.5, 0),
          );
          const skinBottom = rig.forearm.localToWorld(
            new THREE.Vector3(0, 0.5, 0),
          );
          const sleeveBottom = rig.cuff.localToWorld(
            new THREE.Vector3(0, 0.5, 0),
          );
          assert.ok(
            expectedHand.distanceTo(skinTop) < 0.025,
            `${tool} ${kind} wrist gap`,
          );
          assert.ok(
            sleeveTop.distanceTo(skinBottom) < 0.045,
            `${tool} ${kind} cuff gap`,
          );
          assert.ok(
            sleeveBottom.distanceTo(
              new THREE.Vector3(left ? -0.48 : 0.48, -1.1, -0.4),
            ) < 0.025,
          );
          assert.ok(sleeveBottom.clone().project(camera).y < -1);
          rig.root.traverse((o) =>
            assert.ok(o.matrixWorld.elements.every(Number.isFinite)),
          );
          assert.deepEqual(rig.grip.scale.toArray(), [1, 1, 1]);
          assert.equal(rig.grip.parent, rig.wrist);
        }
      }
    }
  }
});

test("original item art has transparent silhouettes, recognizable cutouts, distinct materials and no clipped pixels", () => {
  const sprites = Object.entries(ITEMS)
    .map(([id, item]) => [id, itemSprite(id, item)])
    .filter(([, s]) => s);
  assert.ok(sprites.length >= 113);
  for (const [id, sprite] of sprites) {
    assert.ok(
      sprite.rows.length <= 16 && sprite.rows.every((row) => row.length <= 16),
      id,
    );
    const pixels = sprite.rows.join("").replaceAll(" ", "");
    assert.ok(
      pixels.length > 12 && pixels.length < 145,
      `${id} bulky/empty art`,
    );
    for (const c of pixels)
      assert.match(
        sprite.palette[c] || "",
        /^#[0-9a-f]{6}$/i,
        `${id} unpainted pixel`,
      );
  }
  for (const [id, hole] of [
    ["iron_helmet", "    "],
    ["iron_boots", " "],
    ["flint_and_steel", "  "],
  ])
    assert.ok(
      itemSprite(id, ITEMS[id]).rows.some((row) => row.trim().includes(hole)),
      `${id} needs alpha hole`,
    );
  const diamond = itemSprite("diamond", ITEMS.diamond),
    emerald = itemSprite("emerald", ITEMS.emerald);
  assert.notDeepEqual(diamond.rows, emerald.rows);
  assert.notEqual(
    itemSprite("water_bucket", ITEMS.water_bucket).palette.f,
    itemSprite("lava_bucket", ITEMS.lava_bucket).palette.f,
  );
  for (const id of [
    "devin_sword",
    "matthew_dual_pistols",
    "stone",
    "zombie_spawn_egg",
  ])
    assert.equal(itemSprite(id, ITEMS[id]), null);
});
