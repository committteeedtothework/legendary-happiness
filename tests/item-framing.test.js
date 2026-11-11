import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createHandRig,
  createHeldModel,
  fitHandGrip,
  updateHandRig,
  ITEM_REST_OFFSET,
} from "../src/first-person.js";
import { anchorHeldItem } from "../src/item-framing.js";
import { actionPose } from "../src/animation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const camera = () => new THREE.PerspectiveCamera(70, 1.6, 0.04, 4);
const bottom = (rig, c) =>
  Math.min(
    ...rig.itemSilhouette.map(
      (p) => p.clone().applyMatrix4(rig.wrist.matrixWorld).project(c).y,
    ),
  );
test("transparent icon padding cannot leave a gap: the opaque sprite outline reaches the bottom while empty hands retain their pose", () => {
  const rig = createHandRig();
  rig.armVisuals.visible = false;
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let y = 3; y < 11; y++)
    for (let x = 5; x < 10; x++) pixels[(y * 16 + x) * 4 + 3] = 255;
  const image = {
    width: 16,
    height: 16,
    getContext: () => ({ getImageData: () => ({ data: pixels }) }),
  };
  const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshLambertMaterial({
        map: new THREE.CanvasTexture(image),
        alphaTest: 0.5,
      }),
    ),
    model = new THREE.Group();
  model.add(mesh);
  rig.grip.add(model);
  fitHandGrip(rig, "apple", model);
  const c = camera();
  updateHandRig(rig);
  anchorHeldItem(rig, c);
  assert.ok(Math.abs(bottom(rig, c) + 1.035) < 1e-6);
  assert.ok(rig.itemSilhouette.length < 100);
  rig.armVisuals.visible = true;
  const before = rig.root.position.clone();
  anchorHeldItem(rig, c);
  assert.deepEqual(rig.root.position.toArray(), before.toArray());
});
test("real blocks, flat items, weapons and mirrored pistols stay connected to the edge through every action without camera clipping or support-point growth", () => {
  const restore = mockCanvas();
  try {
    const c = camera();
    for (const id of [
      "stone",
      "oak_stairs",
      "glass_pane",
      "diamond_pickaxe",
      "iron_sword",
      "devin_sword",
      "matthew_dual_pistols",
      "flint_and_steel",
      "apple",
      "water_bucket",
      "music_disc_amber",
      "zombie_spawn_egg",
    ])
      for (const side of [-1, 1]) {
        const rig = createHandRig();
        rig.armVisuals.visible = false;
        rig.root.scale.x = side;
        const model = createHeldModel(id, {
          texture: new THREE.Texture(),
          pack: "renewed",
        });
        rig.grip.add(model);
        fitHandGrip(rig, id, model);
        assert.ok(
          rig.itemSilhouette.length > 0 && rig.itemSilhouette.length <= 256,
          id,
        );
        const count = rig.itemSilhouette.length;
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
            anchorHeldItem(rig, c);
            assert.ok(
              Math.abs(bottom(rig, c) + 1.035) < 1e-5,
              `${id} ${kind} gap`,
            );
            assert.ok(rig.viewBounds.max.z <= -0.10999);
            assert.equal(rig.itemSilhouette.length, count);
          }
      }
  } finally {
    restore();
  }
});

test("held silhouettes stay inside resized viewports and meet the bottom throughout equip without reserving any arm space", () => {
  const restore = mockCanvas();
  try {
    for (const aspect of [0.6, 1, 1.6, 2.4, 3.5]) {
      const c = new THREE.PerspectiveCamera(70, aspect, 0.04, 4);
      for (const id of [
        "stone",
        "diamond_pickaxe",
        "devin_sword",
        "matthew_dual_pistols",
        "flint_and_steel",
        "apple",
      ])
        for (const side of [-1, 1]) {
          const rig = createHandRig();
          rig.armVisuals.visible = false;
          rig.root.scale.x = side;
          const model = createHeldModel(id, {
            texture: new THREE.Texture(),
            pack: "renewed",
          });
          rig.grip.add(model);
          fitHandGrip(rig, id, model);
          for (const equip of [0, 0.5, 1])
            for (const kind of ["attack", "mine", "place", "use"])
              for (const progress of [0, 0.3, 0.6, 1]) {
                const p = actionPose(kind, progress);
                rig.root.position.set(
                  side * (0.37 + ITEM_REST_OFFSET.x + p.x),
                  -0.22 + ITEM_REST_OFFSET.y + p.y - equip * 0.28,
                  -0.72 + ITEM_REST_OFFSET.z + p.z,
                );
                rig.root.rotation.set(
                  p.rx - equip * 0.2,
                  side * p.ry,
                  side * (p.rz + equip * 0.1),
                );
                updateHandRig(rig);
                anchorHeldItem(rig, c);
                const visible = rig.itemSilhouette
                  .map((p) =>
                    p.clone().applyMatrix4(rig.wrist.matrixWorld).project(c),
                  )
                  .filter((p) => Math.abs(p.x) < 1);
                const label = `${id} aspect=${aspect} side=${side} equip=${equip} ${kind}/${progress}`;
                assert.ok(visible.length, label);
                assert.ok(
                  Math.abs(Math.min(...visible.map((p) => p.y)) + 1.035) < 1e-5,
                  label + " gap",
                );
                assert.ok(
                  Math.max(...visible.map((p) => p.y)) > -0.98,
                  label + " missing item",
                );
                assert.equal(rig.armVisuals.visible, false);
                assert.ok(
                  rig.viewBounds.max.z <= -0.10999,
                  label + " near plane",
                );
              }
        }
    }
  } finally {
    restore();
  }
});
