import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SKINS, armAppearanceFor } from "../src/skins.js";
import { createPlayerModel } from "../src/player-model.js";
import { isFlatItem } from "../src/item-shapes.js";
import { ITEMS } from "../src/data.js";
import { actionPose } from "../src/animation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
import {
  applyHandAppearance,
  createHandRig,
  createHeldModel,
  fitHandGrip,
  updateHandRig,
} from "../src/first-person.js";

test("first-person palettes, exposed hand length and fitted glove styles match every selected F5 skin", () => {
  for (const id of Object.keys(SKINS)) {
    const r = createHandRig(),
      appearance = armAppearanceFor(id);
    applyHandAppearance(r, appearance, null);
    updateHandRig(r);
    const f5 = createPlayerModel(id).userData;
    assert.ok(
      r.skin.color.equals(f5.forearms[1].children[1].material.color),
      id,
    );
    assert.ok(r.sleeve.color.equals(f5.arms[1].children[0].material.color), id);
    assert.ok(
      Math.abs(r.forearm.scale.y - (appearance.handLength * 0.16) / 0.18) <
        1e-12,
    );
    assert.equal(r.glove.visible, false);
    assert.equal(r.glove.userData.texturedGlove, !!appearance.glove);
    assert.equal(r.shoulder.visible, false);
    assert.equal(r.forearm.visible, true);
    const meshes = [];
    r.root.traverseVisible((o) => {
      if (o.isMesh) meshes.push(o.name);
    });
    assert.deepEqual(meshes.sort(), ["block-hand", "block-sleeve"].sort());
    if (appearance.glove) {
      assert.equal(r.skin.map, f5.forearms[1].children[1].material.map);
      assert.ok(!f5.forearms[1].children.some((o) => o.name === "block-glove"));
    }
    const skinEnd = r.forearm.localToWorld(new THREE.Vector3(0, 0.5, 0));
    const sleeveStart = r.cuff.localToWorld(new THREE.Vector3(0, -0.5, 0));
    assert.ok(skinEnd.distanceTo(sleeveStart) < 1e-12);
    assert.deepEqual(
      r.forearm.quaternion.toArray(),
      r.cuff.quaternion.toArray(),
    );
    assert.equal(armAppearanceFor(id), appearance);
    assert.ok(Object.isFrozen(appearance));
  }
});

test("real solid block geometry contains the hand contact point across the catalog, mirrored arms and complete actions", () => {
  const atlas = { texture: new THREE.Texture(), pack: "renewed" };
  let blocks = 0;
  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.block === undefined || isFlatItem(id)) continue;
    blocks++;
    for (const left of [false, true]) {
      const r = createHandRig(),
        model = createHeldModel(id, atlas),
        cube = model.children[0];
      r.root.scale.x = left ? -1 : 1;
      r.grip.add(model);
      fitHandGrip(r, id, model);
      cube.geometry.computeBoundingBox();
      for (const kind of ["attack", "mine", "place", "use"])
        for (let n = 0; n <= 20; n++) {
          const p = actionPose(kind, n / 20);
          r.root.position.set(
            (left ? -1 : 1) * (0.37 + p.x),
            -0.27 + p.y,
            -0.72 + p.z,
          );
          r.root.rotation.set(p.rx, p.ry, p.rz);
          updateHandRig(r);
          r.root.updateMatrixWorld(true);
          const contact = r.forearm.localToWorld(new THREE.Vector3(0, -0.5, 0));
          cube.worldToLocal(contact);
          assert.ok(
            cube.userData.voxelParts
              ? cube.userData.voxelParts.some(
                  (b) =>
                    contact.x >= b[0] - 1e-6 &&
                    contact.x <= b[3] + 1e-6 &&
                    contact.y >= b[1] - 1e-6 &&
                    contact.y <= b[4] + 1e-6 &&
                    contact.z >= b[2] - 1e-6 &&
                    contact.z <= b[5] + 1e-6,
                )
              : cube.geometry.boundingBox.containsPoint(contact),
            `${id}/${left}/${kind}/${n}: floating block`,
          );
        }
    }
  }
  assert.ok(blocks > 0);
});

test("both full arms and all held families remain connected and clear of the camera throughout action cycles", () => {
  const restore = mockCanvas();
  try {
    const atlas = { texture: new THREE.Texture(), pack: "renewed" };
    for (const id of [
      null,
      "diamond_sword",
      "devin_sword",
      "diamond_spear",
      "iron_axe",
      "iron_pickaxe",
      "iron_shovel",
      "iron_hoe",
      "stone",
      "oak_door",
      "flint_and_steel",
      "apple",
      "saint_corpse_part",
      "matthew_dual_pistols",
    ]) {
      for (const left of [false, true]) {
        const r = createHandRig(),
          model = createHeldModel(id, atlas);
        r.root.scale.x = left ? -1 : 1;
        if (model) r.grip.add(model);
        fitHandGrip(r, id, model);
        const socket = r.grip.position.toArray();
        for (const kind of ["attack", "mine", "place", "use", "eat", "fire"])
          for (const direction of [-1, 1])
            for (let n = 0; n <= 40; n++) {
              const p = actionPose(kind, n / 40, ITEMS[id]?.tool, direction);
              r.root.position.set(
                (left ? -1 : 1) * (0.37 + p.x),
                -0.27 + p.y,
                -0.72 + p.z,
              );
              r.root.rotation.set(p.rx, p.ry, p.rz);
              updateHandRig(r);
              r.root.updateMatrixWorld(true);
              const bounds = new THREE.Box3().setFromObject(r.root);
              assert.ok(
                bounds.max.z < -0.04,
                `${id}/${kind}/${n} camera intersection`,
              );
              const hand = r.wrist.localToWorld(
                new THREE.Vector3(0, -0.04, 0.025),
              );
              const tip = r.forearm.localToWorld(new THREE.Vector3(0, -0.5, 0));
              assert.ok(
                tip.distanceTo(hand) < 1e-12,
                `${id}/${kind} detached arm`,
              );
              assert.deepEqual(r.grip.position.toArray(), socket);
              if (model) assert.equal(model.parent, r.grip);
            }
      }
    }
  } finally {
    restore();
  }
});
