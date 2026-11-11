import { isWeapon } from "../src/weapon-art.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  actionPose,
  actionDuration,
  FirstPersonAnimator,
} from "../src/animation.js";
import {
  javaSwingPose,
  javaUsePose,
  mountJavaItem,
  customItemMotion,
} from "../src/java-item-motion.js";
import {
  createHandRig,
  createHeldModel,
  fitHandGrip,
} from "../src/first-person.js";
import { weaponActionPose } from "../src/weapon-motion.js";
import { mockCanvas } from "./helpers/mock-canvas.js";

const close = (a, b, label) =>
  assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);
const player = () => ({ onGround: true, yaw: 0, pitch: 0, vy: 0 });
test("standard blocks and tools share a six-tick, one-direction swing with the early Java arc and no invented trails", () => {
  const quarter = javaSwingPose(0.25);
  close(quarter.x, -0.4, "quarter x");
  close(quarter.y, 0, "quarter y");
  close(quarter.z, -Math.SQRT2 / 10, "quarter z");
  for (const tool of [
    undefined,
    "sword",
    "axe",
    "pickaxe",
    "shovel",
    "hoe",
    "mace",
    "trident",
  ])
    for (const kind of ["attack", "mine", "place", "use"])
      for (const p of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
        assert.deepEqual(actionPose(kind, p, tool, -1), javaSwingPose(p));
        assert.equal(actionDuration(kind, tool), 0.3);
      }
  const a = new FirstPersonAnimator();
  a.trigger("attack", "sword", "iron_sword");
  a.action = null;
  a.trigger("attack", "sword", "iron_sword");
  assert.equal(a.action.direction, 1);
});
test("special item routing preserves the Devin Sword and custom spear attack curves and independent pistol recoil", () => {
  for (const id of ["devin_sword", "matthew_dual_pistols"])
    assert.ok(customItemMotion(id));
  for (const id of [
    "iron_sword",
    "diamond_pickaxe",
    "hellfire_axe",
    "dirt_sword",
    "mace",
    "trident",
  ])
    assert.equal(customItemMotion(id), false);
  for (const [id, tool] of [
    ["devin_sword", "sword"],
    ["iron_spear", "spear"],
  ])
    for (const direction of [-1, 1])
      for (const kind of ["attack", "mine", "use"])
        for (const p of [0, 0.15, 0.35, 0.6, 1])
          assert.deepEqual(
            actionPose(kind, p, tool, direction, id),
            weaponActionPose(kind, p, tool, direction),
          );
  assert.deepEqual(
    actionPose("fire", 0.5, "pistols", 1, "matthew_dual_pistols"),
    { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 },
  );
});
test("rest fitting never rewrites a standard item's swing trajectory or reserves an invisible arm", () => {
  const restore = mockCanvas();
  try {
    for (const aspect of [0.6, 1.6, 3.5])
      for (const id of [
        "stone",
        "oak_stairs",
        "flint_and_steel",
        "diamond_pickaxe",
        "iron_sword",
        "apple",
      ]) {
        const c = new THREE.PerspectiveCamera(70, aspect, 0.04, 4),
          r = createHandRig();
        r.armVisuals.visible = false;
        r.wrist.rotation.set(0, 0, 0);
        const m = createHeldModel(id, {
          texture: new THREE.Texture(),
          pack: "renewed",
        });
        r.grip.add(m);
        fitHandGrip(r, id, m);
        mountJavaItem(r, id, javaSwingPose(0), c);
        const rest = r.root.position.clone(),
          q = r.root.quaternion.clone();
        const bottom = Math.min(
          ...r.itemSilhouette.map(
            (p) => p.clone().applyMatrix4(r.wrist.matrixWorld).project(c).y,
          ),
        );
        if (isWeapon(id)) assert.ok(Number.isFinite(bottom));
        else close(bottom, -1.035, "rest bottom");
        for (const p of [0.1, 0.25, 0.5, 0.75, 1]) {
          const pose = javaSwingPose(p);
          mountJavaItem(r, id, pose, c);
          close(r.root.position.x - rest.x, pose.x, "unaltered swing x");
          close(r.root.position.y - rest.y, pose.y, "unaltered swing y");
          const expected = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(pose.rx, pose.ry, pose.rz))
            .multiply(q);
          close(
            1 - Math.abs(r.root.quaternion.dot(expected)),
            0,
            "swing rotation",
          );
          assert.ok(r.viewBounds.max.z <= -0.10999);
          assert.equal(r.armVisuals.visible, false);
        }
      }
  } finally {
    restore();
  }
});
test("bow/crossbow draw, shield guard and trident charge follow live use state and clear on release without mutating gameplay", () => {
  const p = player();
  for (const id of ["bow", "crossbow"]) {
    p.editionDraw = { id, start: 1 };
    const before = JSON.stringify(p),
      pose = javaUsePose(id, p, 2.5);
    assert.ok(pose.x < 0 && pose.y > 0 && pose.z > 0);
    assert.deepEqual(
      actionPose("use", 0.5, undefined, 1, id),
      javaSwingPose(0),
    );
    assert.equal(JSON.stringify(p), before);
    delete p.editionDraw;
    assert.deepEqual(javaUsePose(id, p, 3), javaSwingPose(0));
  }
  p.shieldRaised = true;
  assert.ok(javaUsePose("shield", p, 2).y > 0);
  p.shieldRaised = false;
  assert.deepEqual(javaUsePose("shield", p, 2), javaSwingPose(0));
  const game = {
    tickCount: 30,
    tridentCharge: { start: 20, stack: { id: "trident" } },
  };
  assert.ok(javaUsePose("trident", p, 2, game).rx < -1);
  delete game.tridentCharge;
  assert.deepEqual(javaUsePose("trident", p, 2, game), javaSwingPose(0));
});
test("standard idle/sprint/swimming add no custom tilt; repeat mining and equip settle independently of frame rate and pause", () => {
  for (const hz of [30, 60, 144]) {
    const a = new FirstPersonAnimator(),
      p = { ...player(), sprinting: true, inWater: true, onGround: false };
    a.trigger("equip");
    const before = JSON.stringify(p);
    for (let i = 0; i < hz; i++)
      a.step(1 / hz, p, { itemId: "iron_sword", tool: "sword", moving: false });
    assert.equal(a.equip, 0);
    assert.equal(a.sprint, 0);
    assert.equal(a.swim, 0);
    assert.deepEqual(
      a.step(0, p, { itemId: "iron_sword", tool: "sword" }),
      javaSwingPose(0),
    );
    assert.equal(JSON.stringify(p), before);
    const b = new FirstPersonAnimator();
    for (let i = 0; i < hz * 0.6; i++)
      b.step(1 / hz, player(), {
        itemId: "diamond_pickaxe",
        tool: "pickaxe",
        mining: true,
      });
    assert.ok(Math.abs(b.miningPhase - 2) < 0.03);
    const phase = b.miningPhase;
    b.step(0, player(), {
      itemId: "diamond_pickaxe",
      tool: "pickaxe",
      mining: true,
    });
    assert.equal(b.miningPhase, phase);
  }
});
