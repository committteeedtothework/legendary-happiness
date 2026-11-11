import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createHandRig,
  fitHandGrip,
  cacheHandBounds,
  createHeldModel,
  updateHandRig,
  ITEM_REST_OFFSET,
} from "../src/first-person.js";
import { actionPose } from "../src/animation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
test("item-only clearance contains only real item geometry, ignoring the old hand placeholder and hidden glove/sleeve/armor", () => {
  const rig = createHandRig();
  rig.armVisuals.visible = false;
  rig.wrist.rotation.set(0, 0, 0);
  const item = new THREE.Group(),
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.01, 0.01),
      new THREE.MeshBasicMaterial(),
    );
  mesh.position.x = 0.3;
  item.add(mesh);
  rig.grip.add(item);
  fitHandGrip(rig, "apple", item);
  assert.ok(
    rig.localViewBounds.min.x > 0.2,
    "The old hand-origin box must not reserve empty space",
  );
  assert.ok(rig.localViewBounds.max.x - rig.localViewBounds.min.x < 0.17);
  for (const o of [rig.forearm, rig.cuff, rig.glove, rig.shoulder]) {
    o.visible = true;
    o.scale.set(100, 100, 100);
    o.position.set(0, 0, 10);
  }
  const before = rig.root.position.clone();
  updateHandRig(rig);
  assert.deepEqual(rig.root.position.toArray(), before.toArray());
  assert.ok(rig.viewBounds.max.z < -0.5);
  // The same visible empty-hand rig still reserves/safeguards its real arm.
  rig.armVisuals.visible = true;
  item.removeFromParent();
  cacheHandBounds(rig);
  assert.ok(rig.localViewBounds.min.x < 0);
});
test("actual hidden-arm item bounds stay clear of the camera through complete action poses, mirrored pistols and the new lower mount", () => {
  const restore = mockCanvas();
  try {
    const atlas = { texture: new THREE.Texture(), pack: "renewed" };
    for (const id of [
      "stone",
      "diamond_pickaxe",
      "iron_sword",
      "devin_sword",
      "matthew_dual_pistols",
      "flint_and_steel",
      "apple",
      "water_bucket",
    ])
      for (const side of [1, -1]) {
        const rig = createHandRig();
        rig.armVisuals.visible = false;
        rig.root.scale.x = side;
        if (id === "matthew_dual_pistols")
          rig.wrist.rotation.set(0.04, 0.1, -0.07);
        const model = createHeldModel(id, atlas);
        rig.grip.add(model);
        fitHandGrip(rig, id, model);
        for (const kind of ["attack", "mine", "place", "use", "eat", "fire"])
          for (let i = 0; i <= 20; i++) {
            const p = actionPose(kind, i / 20);
            rig.root.position.set(
              side * (0.37 + ITEM_REST_OFFSET.x + p.x),
              -0.22 + ITEM_REST_OFFSET.y + p.y,
              -0.72 + ITEM_REST_OFFSET.z + p.z,
            );
            rig.root.rotation.set(p.rx, side * p.ry, side * p.rz);
            updateHandRig(rig);
            const bounds = new THREE.Box3().setFromObject(model);
            assert.ok(
              bounds.max.z <= -0.11 + 1e-9,
              `${id} ${kind} clipped the camera`,
            );
            assert.ok(rig.viewBounds.max.z <= -0.11 + 1e-9);
            assert.ok(
              [...bounds.min.toArray(), ...bounds.max.toArray()].every(
                Number.isFinite,
              ),
            );
          }
      }
  } finally {
    restore();
  }
});
