import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { B, BLOCKS, ITEMS, MOB_INFO } from "../src/data.js";
import { createMobModel } from "../src/models.js";
import { OVERWORLD_STYLES } from "../src/overworld-models.js";
import { VILLAGE_STYLES } from "../src/village-styles.js";
import {
  boundedLook,
  NECK_YAW_LIMIT,
  NECK_PITCH_LIMIT,
} from "../src/mob-look.js";
import { createHeldModel, createDroppedModel } from "../src/first-person.js";
import { isFlatItem } from "../src/item-shapes.js";
import { blockArtTile, blockArtUV, EXTRA_ART } from "../src/block-art.js";
import { meshChunk, FACES } from "../src/mesher.js";
import { World } from "../src/world.js";
import { doorId } from "../src/doors.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
import { modelFingerprint } from "./helpers/model-fingerprint.js";

test("all 20 Overworld and retained legacy designs are distinct, finite, grounded and bounded in batches", () => {
  const restore = mockCanvas();
  try {
    const hashes = new Set();
    for (const type of Object.keys(OVERWORLD_STYLES)) {
      const model = createMobModel({
          type,
          style: "meadow",
          profession: "farmer",
        }),
        bounds = new THREE.Box3().setFromObject(model);
      assert.equal(model.userData.overworldStyle, OVERWORLD_STYLES[type]);
      assert.ok(
        Math.abs(bounds.max.y - (MOB_INFO[type]?.height || 1.95)) < 1e-5,
        type,
      );
      assert.ok(
        bounds.min.y >= -0.045,
        type + " underground feet: " + bounds.min.y,
      );
      let draws = 0;
      model.traverse((o) => {
        assert.ok(o.matrixWorld.elements.every(Number.isFinite));
        if (o.isMesh) {
          draws++;
          assert.ok(
            o.geometry.attributes.position.array.every(Number.isFinite),
          );
        }
      });
      assert.ok(draws <= 38, type + " " + draws + " batches");
      assert.ok(model.userData.head.children.length > 0);
      hashes.add(
        modelFingerprint(model) +
          JSON.stringify(
            model.userData.materials.map((m) => m.userData.paletteColor),
          ),
      );
    }
    assert.equal(hashes.size, 20);
  } finally {
    restore();
  }
});
test("eight village styles and three professions retain attached folded arms and distinct appearances", () => {
  const restore = mockCanvas();
  try {
    const appearances = new Set();
    for (const style of Object.keys(VILLAGE_STYLES))
      for (const profession of ["farmer", "mason", "shepherd"]) {
        const m = createMobModel({ type: "villager", style, profession });
        assert.equal(m.userData.foldedArms.length, 2);
        for (const arm of m.userData.foldedArms) {
          assert.equal(arm.parent, m.userData.rig);
          arm.rotation.z = 0.025;
          arm.rotation.x = 0.015;
          const b = new THREE.Box3().setFromObject(arm);
          assert.ok(b.min.z < -0.15 && b.max.y > 1.1, style);
        }
        appearances.add(
          modelFingerprint(m) +
            JSON.stringify(
              m.userData.materials.map((m) => m.userData.paletteColor),
            ),
        );
      }
    assert.equal(appearances.size, 24);
  } finally {
    restore();
  }
});
test("head tracking cannot accumulate rotations or turn through a body, even across angle wrapping and frame rates", () => {
  for (const rate of [30, 60, 144]) {
    let p = { yaw: Math.PI * 17, pitch: 7 };
    for (let i = 0; i < rate * 10; i++) {
      p = boundedLook(
        p.yaw,
        p.pitch,
        (i / rate) * Math.PI * 8,
        Math.sin(i / rate) * 2,
        1 / rate,
      );
      assert.ok(Math.abs(p.yaw) <= NECK_YAW_LIMIT + 1e-10);
      assert.ok(Math.abs(p.pitch) <= NECK_PITCH_LIMIT + 1e-10);
    }
  }
  const a = boundedLook(0.2, 0.1, 0.6, 0.2, 0);
  assert.ok(Math.abs(a.yaw - 0.2) < 1e-10);
  assert.equal(a.pitch, 0.1);
});
test("ordinary items, plants and door sprites have zero extrusion in hand and in normalized drops; weapons and solid blocks keep depth", () => {
  const restore = mockCanvas();
  try {
    let count = 0;
    for (const id of Object.keys(ITEMS).filter(isFlatItem)) {
      count++;
      const held = createHeldModel(id),
        drop = createDroppedModel(id);
      assert.equal(held.userData.flatCutout, true, id);
      assert.equal(drop.userData.flatCutout, true, id);
      const b = new THREE.Box3().setFromObject(drop),
        size = b.getSize(new THREE.Vector3());
      assert.ok(size.z < 1e-7, id + " extrusion");
      assert.ok(Math.abs(Math.max(size.x, size.y) - 0.38) < 1e-6, id);
      held.traverse((o) => {
        if (o.isMesh) {
          assert.equal(o.geometry.type, "PlaneGeometry");
          assert.equal(o.material.side, THREE.DoubleSide);
          assert.equal(o.material.alphaTest, 0.5);
        }
      });
    }
    assert.ok(count > 80);
    for (const id of [
      "planks",
      "stone",
      "iron_sword",
      "devin_sword",
      "matthew_dual_pistols",
    ]) {
      assert.equal(isFlatItem(id), false);
      const model = createHeldModel(id, { texture: new THREE.Texture() });
      assert.ok(
        new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).z >
          0.02,
        id,
      );
    }
  } finally {
    restore();
  }
});
test("directional art, door edge crops and worker-compatible UVs stay in their atlas cells", () => {
  assert.equal(blockArtTile(B.furnace, 5, "supplied"), EXTRA_ART.furnace_front);
  assert.equal(blockArtTile(B.furnace, 0, "supplied"), B.furnace * 3 + 1);
  assert.equal(blockArtTile(B.furnace, 5, "classic"), B.furnace * 3 + 1);
  assert.ok(Math.max(...Object.values(EXTRA_ART)) < 1024);
  for (let facing = 0; facing < 4; facing++)
    for (const open of [false, true])
      for (const upper of [false, true])
        for (let face = 0; face < 6; face++)
          for (const u of [0, 1])
            for (const v of [0, 1]) {
              const id = doorId(facing, open, upper),
                uv = blockArtUV(id, face, u, v, "supplied");
              assert.ok(uv.every((n) => n > 0 && n < 1));
              const actual =
                Math.floor(uv[0] * 32) + (127 - Math.floor(uv[1] * 128)) * 32;
              assert.equal(actual, blockArtTile(id, face, "supplied"));
            }
  const world = new World("art-fixture");
  for (let x = 1; x < 5; x++)
    world.set(
      x,
      200,
      1,
      [B.furnace, B.crafting_table, B.chest, B.mine_rail][x - 1],
    );
  world.set(7, 200, 1, B.bamboo);
  const mesh = meshChunk(world, world.ensure(0, 0), {
    texturePack: "supplied",
  });
  const heights = [];
  for (const g of mesh.filter(Boolean))
    for (let i = 0; i < g.position.length; i += 3)
      if (
        g.position[i] >= 7 &&
        g.position[i] <= 8 &&
        g.position[i + 1] >= 200 &&
        g.position[i + 2] >= 1 &&
        g.position[i + 2] <= 2
      )
        heights.push(g.position[i + 1]);
  assert.equal(
    Math.max(...heights),
    201,
    "bamboo joins the next plant block without a gap",
  );
  for (const tile of Object.values(EXTRA_ART))
    assert.ok(
      mesh.some(
        (m) =>
          m &&
          Array.from(m.uv).some(
            (u, i, a) =>
              i % 2 === 0 &&
              Math.floor(u * 32) + (127 - Math.floor(a[i + 1] * 128)) * 32 ===
                tile,
          ),
      ),
      String(tile),
    );
});
