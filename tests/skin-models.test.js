import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { SKINS, armAppearanceFor } from "../src/skins.js";
import { skinPartTexture } from "../src/skin-art.js";
import {
  createPlayerModel,
  animatePlayerModel,
  PLAYER_PROPORTIONS as P,
} from "../src/player-model.js";
import { createHandRig, applyHandAppearance } from "../src/first-person.js";
import { disposeSkinModel } from "../src/skin-preview.js";
const size = (m) => {
  m.geometry.computeBoundingBox();
  return m.geometry.boundingBox.getSize(new THREE.Vector3()).toArray();
};
test("all eleven costumes share classic 32-pixel proportions, contact at shoulders/hips and a 1.8-unit silhouette", () => {
  assert.equal(Object.keys(SKINS).length, 11);
  for (const id of Object.keys(SKINS)) {
    const m = createPlayerModel(id),
      u = m.userData;
    assert.deepEqual(size(u.head.children[0]), P.head.map(Math.fround));
    assert.deepEqual(size(u.body), P.body.map(Math.fround));
    for (const leg of u.legs)
      assert.deepEqual(size(leg.children[0]), P.leg.map(Math.fround));
    const b = new THREE.Box3().setFromObject(m);
    assert.ok(Math.abs(b.max.y - 1.8) < 1e-6, id);
    assert.ok(Math.abs(b.min.y) < 1e-6, id);
    assert.equal(u.arms[0].position.y, u.head.position.y);
    assert.ok(
      Math.abs(Math.abs(u.arms[0].position.x) - 0.225 / 2 - 0.45 / 2) < 1e-9,
    );
    let meshes = 0;
    m.traverse((o) => {
      if (o.isMesh) meshes++;
    });
    assert.ok(meshes <= 20, `${id}: ${meshes} batches`);
    disposeSkinModel(m);
  }
});
test("every skin has distinct original pixel faces/costumes; all six face UVs stay within their own nearest-filtered strip", () => {
  const heads = new Set(),
    bodies = new Set();
  for (const id of Object.keys(SKINS)) {
    const m = createPlayerModel(id);
    for (const [part, set] of [
      ["head", heads],
      ["body", bodies],
    ])
      set.add(
        createHash("sha256")
          .update(skinPartTexture(id, part).image.data)
          .digest("hex"),
      );
    m.traverse((o) => {
      if (!o.material?.map?.userData.rects) return;
      const tex = o.material.map,
        { width, height } = tex.image,
        uv = o.geometry.attributes.uv;
      assert.equal(tex.magFilter, THREE.NearestFilter);
      assert.equal(tex.generateMipmaps, false);
      tex.userData.rects.forEach(([x, y, w, h], face) => {
        for (let n = face * 4; n < face * 4 + 4; n++) {
          assert.ok(uv.getX(n) > x / width && uv.getX(n) < (x + w) / width);
          assert.ok(
            uv.getY(n) > 1 - (y + h) / height && uv.getY(n) < 1 - y / height,
          );
        }
      });
    });
    disposeSkinModel(m);
  }
  assert.equal(heads.size, 11);
  assert.equal(bodies.size, 11);
});
test("first-person sleeve/hand texels and colors match the selected world rig and survive wardrobe disposal", () => {
  for (const id of Object.keys(SKINS)) {
    const rig = createHandRig();
    applyHandAppearance(rig, armAppearanceFor(id));
    const m = createPlayerModel(id),
      u = m.userData;
    assert.equal(rig.skin.map, u.forearms[1].children[1].material.map);
    assert.equal(rig.sleeve.map, u.arms[1].children[0].material.map);
    assert.ok(rig.skin.color.equals(u.forearms[1].children[1].material.color));
    let disposed = false;
    rig.skin.map.addEventListener("dispose", () => (disposed = true));
    disposeSkinModel(m);
    assert.equal(disposed, false);
    const replacement = createPlayerModel(id);
    assert.equal(
      replacement.userData.arms[1].children[0].material.map,
      rig.sleeve.map,
    );
    disposeSkinModel(replacement);
    disposeSkinModel(rig.root);
  }
});
test("updated armor and both pistol grips remain connected through running, crouching, swimming and combat without changing simulation state", () => {
  for (const id of Object.keys(SKINS))
    for (const held of [
      "stone",
      "iron_sword",
      "devin_sword",
      "matthew_dual_pistols",
    ]) {
      const m = createPlayerModel(
          id,
          [
            { id: "diamond_helmet" },
            { id: "diamond_chestplate" },
            { id: "diamond_leggings" },
            { id: "diamond_boots" },
          ],
          held,
          { texture: new THREE.Texture() },
        ),
        u = m.userData;
      for (const mode of [
        { onGround: true },
        { onGround: true, crouching: true },
        { inWater: true, onGround: false },
      ]) {
        const p = { pitch: 0.3, yaw: 0, vy: 0, ...mode },
          before = JSON.stringify(p);
        for (let n = 0; n < 15; n++)
          animatePlayerModel(m, p, 1 / 30, true, 0.7, "attack", 0.12);
        assert.equal(JSON.stringify(p), before);
        m.updateMatrixWorld(true);
        for (const o of [
          u.grip,
          ...(held === "matthew_dual_pistols" ? [u.leftGrip] : []),
        ]) {
          const elbow = o.parent,
            palm = elbow.children[1];
          assert.ok(
            o
              .getWorldPosition(new THREE.Vector3())
              .distanceTo(palm.getWorldPosition(new THREE.Vector3())) < 0.1,
          );
        }
        m.traverse((o) =>
          assert.ok(o.matrixWorld.elements.every(Number.isFinite)),
        );
      }
      disposeSkinModel(m);
    }
});
