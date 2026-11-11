import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  createPistolModel,
  animatePistolModel,
  pistolRecoil,
  PISTOL_RECOIL_SECONDS,
} from "../src/pistol-model.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { SKINS, skinPreview } from "../src/skins.js";
import { FirstPersonAnimator, actionPose } from "../src/animation.js";
import { cleanPose } from "../src/multiplayer.js";
const GUN = "matthew_dual_pistols";
const player = () => ({
  x: 0,
  y: 200,
  z: 0,
  yaw: 0,
  pitch: 0,
  onGround: true,
  vy: 0,
  matthewHand: 1,
});

test("Dante has a distinct selectable preview, open coat rig and accepted co-op identity", () => {
  assert.equal(SKINS.dante.name, "Dante");
  assert.equal(SKINS.dante.hair, "#e4e5e8");
  assert.notEqual(skinPreview("dante"), skinPreview("devin"));
  const m = createPlayerModel("dante", [], GUN);
  assert.equal(m.userData.skin, "dante");
  assert.equal(m.userData.body.material.map.userData.skin, "dante");
  assert.equal(m.userData.coat.length, 2);
  assert.equal(
    cleanPose({ ...player(), skin: "dante", held: GUN }).skin,
    "dante",
  );
});
test("Dante coat settles without changing player state or invalidating armor and grip attachment", () => {
  const equipment = [
    "iron_helmet",
    "iron_chestplate",
    "iron_leggings",
    "iron_boots",
  ].map((id) => ({ id, count: 1 }));
  const m = createPlayerModel("dante", equipment, GUN),
    p = player(),
    snapshot = JSON.stringify(p);
  for (let i = 0; i < 60; i++)
    animatePlayerModel(m, p, 1 / 60, true, 0, "fire", 0.15);
  assert.ok(
    m.userData.coat.every((t) => t.rotation.x < 0 && t.rotation.x > -0.5),
  );
  assert.equal(JSON.stringify(p), snapshot);
  const before = m.userData.coat[0].rotation.x;
  animatePlayerModel(m, p, 0, false, 0);
  assert.equal(m.userData.coat[0].rotation.x, before);
  assert.equal(m.userData.grip.parent, m.userData.forearms[1]);
  assert.equal(m.userData.leftGrip.parent, m.userData.forearms[0]);
});
test("black and silver long-slide sidearms use finite solid geometry and batched detail", () => {
  for (const dark of [false, true]) {
    const m = createPistolModel(dark),
      size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    assert.equal(m.userData.finish, dark ? "black" : "silver");
    assert.ok(size.z > 0.45 && size.z > size.x * 3);
    let draws = 0;
    m.traverse((o) => {
      if (o.isMesh) {
        draws++;
        const a = o.geometry.attributes.position.array;
        assert.ok(a.every(Number.isFinite));
      }
    });
    assert.ok(draws <= 16, `batched draws ${draws}`);
  }
});
test("slide and hammer recoil are independent per hand and return exactly to rest", () => {
  const right = createPistolModel(),
    left = createPistolModel(true);
  animatePistolModel(right, PISTOL_RECOIL_SECONDS - 0.018);
  animatePistolModel(left, 0);
  assert.ok(right.userData.slide.position.z > 0.045);
  assert.ok(right.userData.hammer.rotation.x < -0.6);
  assert.equal(right.userData.flash.visible, true);
  assert.equal(left.userData.slide.position.z, 0);
  animatePistolModel(right, 0.12, false);
  assert.equal(right.userData.flash.visible, false);
  assert.equal(right.userData.casing.visible, false);
  animatePistolModel(right, 0);
  assert.equal(right.userData.slide.position.z, 0);
  assert.equal(Math.abs(right.userData.hammer.rotation.x), 0);
  assert.equal(right.userData.flash.visible, false);
  assert.equal(right.userData.casing.visible, false);
  for (let remaining = 0; remaining <= 0.18; remaining += 0.001) {
    const p = pistolRecoil(remaining);
    assert.ok(p.kick >= 0 && p.kick <= 1 && p.slide >= 0 && p.slide <= 1);
  }
});
test("pistol fire never applies the generic two-hand jab and equip settles finitely", () => {
  for (const progress of [0, 0.2, 0.5, 0.8, 1])
    assert.deepEqual(actionPose("fire", progress, "pistols"), {
      x: 0,
      y: 0,
      z: 0,
      rx: 0,
      ry: 0,
      rz: 0,
      trail: 0,
    });
  const a = new FirstPersonAnimator(),
    p = player();
  a.trigger("equip");
  a.trigger("fire", "pistols");
  for (let i = 0; i < 120; i++)
    assert.ok(
      Object.values(a.step(1 / 60, p, { tool: "pistols" })).every(
        Number.isFinite,
      ),
    );
  assert.equal(a.equip, 0);
  assert.equal(a.action, null);
});
test("F5 shares independent slide recoil, forward aim, and clears flashes after switching cameras", () => {
  const m = createPlayerModel("dante", [], GUN),
    p = player();
  animatePlayerModel(m, p, 1 / 60, false, 0, "fire", 0.162);
  const u = m.userData;
  assert.ok(u.grip.children[0].userData.slide.position.z > 0.04);
  assert.equal(u.leftGrip.children[0].userData.slide.position.z, 0);
  for (const pitch of [-1, 0, 1]) {
    p.pitch = pitch;
    animatePlayerModel(m, p, 1 / 60, false, 0, "fire", 0);
    m.updateMatrixWorld(true);
    const forward = new THREE.Vector3(0, 0, -1).transformDirection(
      u.grip.matrixWorld,
    );
    assert.ok(
      forward.dot(new THREE.Vector3(0, Math.sin(pitch), -Math.cos(pitch))) >
        0.99,
    );
    assert.equal(u.grip.children[0].userData.flash.visible, false);
  }
});

test("the modeled trigger guard is open through the center and solid around its rim", () => {
  const m = createPistolModel();
  m.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(1, -0.01875, -0.075),
    new THREE.Vector3(-1, 0, 0),
  );
  assert.equal(ray.intersectObject(m, true).length, 0);
  ray.ray.origin.y = -0.0375;
  assert.ok(ray.intersectObject(m, true).length > 0);
});
