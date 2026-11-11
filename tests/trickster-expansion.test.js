import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/world.js";
import { B, MOB_INFO, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer, collides } from "../src/physics.js";
import {
  tricksterMove,
  styleCharges,
  updateTrickster,
} from "../src/matthew.js";
import { TricksterEffects } from "../src/trickster-effects.js";
import { weaponMoveText } from "../src/weapon-hud.js";
function arena() {
  const world = new World("Wildflower");
  for (let x = -4; x < 20; x++)
    for (let z = -12; z < 20; z++) world.set(x, 199, z, B.stone);
  const inventory = new Inventory();
  inventory.slots[0] = makeStack("matthew_dual_pistols");
  const effects = [];
  return {
    world,
    inventory,
    player: createPlayer({ x: 0.5, y: 200, z: 10.5 }),
    entities: [],
    tickCount: 100,
    keys: new Set(),
    running: true,
    renderer: {
      tricksterEffect: (...args) => effects.push(args),
      tricksterTrail() {},
    },
    effects,
  };
}
test("R free-blinks eighteen blocks without a creature and keeps its cooldown/charge/fall accounting", () => {
  const g = arena();
  g.player.fallStart = 220;
  assert.equal(tricksterMove(g, true), true);
  assert.equal(g.player.z, -7.5);
  assert.equal(g.player.y, 200);
  assert.equal(styleCharges(g.player, g.tickCount), 1);
  assert.equal(g.player.tricksterBlinkTick, 200);
  assert.equal(g.player.fallStart, 220);
  assert.equal(tricksterMove(g, true), false);
  assert.equal(g.effects[0][0], "air-trick");
  const reloaded = createPlayer(g.player, JSON.parse(JSON.stringify(g.player)));
  assert.equal(reloaded.tricksterBlinkTick, 200);
});
test("R can approach passive animals and villagers without causing damage or consuming ammunition", () => {
  for (const type of ["grazer", "villager"]) {
    const g = arena(),
      e = { type, x: 0.5, y: 200, z: 1.5, hp: 20 };
    g.entities = [e];
    g.player.pitch = Math.atan2(e.y + MOB_INFO[type].height * 0.5 - 201.62, 9);
    assert.equal(tricksterMove(g, true), true);
    assert.ok(Math.abs(g.player.z - 3.3) < 0.001);
    assert.equal(e.hp, 20);
    assert.equal(g.inventory.held.count, 1);
  }
});
test("free blink sweeps the whole body and stops before a wall across a chunk boundary", () => {
  const g = arena();
  Object.assign(g.player, { x: 14.5, z: 0.5, yaw: -Math.PI / 2 });
  for (let y = 200; y <= 202; y++) g.world.set(16, y, 0, B.stone);
  const edits = JSON.stringify(g.world.exportEdits());
  assert.equal(tricksterMove(g, true), true);
  assert.ok(g.player.x > 15 && g.player.x <= 15.7);
  assert.equal(collides(g.world, g.player), false);
  assert.equal(JSON.stringify(g.world.exportEdits()), edits);
});
test("looking slightly down on the ground remains usable, while an airborne blink follows pitch", () => {
  const g = arena();
  g.player.onGround = true;
  g.player.pitch = -0.08;
  assert.equal(tricksterMove(g, true), true);
  assert.equal(g.player.y, 200);
  assert.ok(g.player.z < -7);
  const air = arena();
  air.player.y = 205;
  air.player.onGround = false;
  air.player.pitch = 0.3;
  assert.equal(tricksterMove(air, true), true);
  assert.ok(air.player.y > 210);
  assert.equal(air.player.fallStart, air.player.y);
});
test("a fully blocked blink leaves position, cooldown and charges intact and emits no effects", () => {
  const g = arena();
  for (let y = 200; y <= 202; y++) g.world.set(0, y, 9, B.stone);
  assert.equal(tricksterMove(g, true), false);
  assert.equal(g.player.z, 10.5);
  assert.equal(g.player.tricksterBlinkTick || 0, 0);
  assert.equal(styleCharges(g.player, g.tickCount), 2);
  assert.equal(g.effects.length, 0);
});
test("dash visual hooks do not change fixed-speed displacement or recharge behavior", () => {
  const g = arena();
  g.player.onGround = true;
  assert.equal(tricksterMove(g), true);
  for (let i = 0; i < 12; i++) updateTrickster(g, 1 / 60);
  assert.ok(Math.abs(g.player.z - 6.3) < 0.001);
  assert.equal(g.effects[0][0], "dash");
  assert.equal(styleCharges(g.player, g.tickCount), 1);
});
test("style visuals use bounded reusable batches and expire completely without mutating source poses", () => {
  const scene = new THREE.Scene(),
    v = new TricksterEffects(scene),
    a = { x: 0, y: 200, z: 0, yaw: 0 },
    b = { x: 0, y: 200, z: -18, yaw: 0 };
  const poses = JSON.stringify([a, b]);
  for (let i = 0; i < 30; i++) {
    v.start("air-trick", a, b, null, { particles: "all" });
    v.trail(a, b, { particles: "all" }, true);
  }
  v.update(0.016, true, { particles: "all" });
  assert.equal(v.root.children.length, 3);
  assert.ok(
    v.sigils.count <= 12 && v.echoes.count <= 12 && v.streaks.length <= 96,
  );
  assert.ok(v.sigils.instanceMatrix.array.every(Number.isFinite));
  assert.ok(v.echoes.instanceMatrix.array.every(Number.isFinite));
  assert.equal(JSON.stringify([a, b]), poses);
  v.update(1, true, { particles: "all" });
  assert.equal(v.root.visible, false);
  assert.equal(v.sigils.count, 0);
  assert.equal(v.echoes.count, 0);
  assert.equal(v.lines.geometry.drawRange.count, 0);
});
test("minimal particles disable style effects, reduced particles skip body echoes, and world clear resets the FOV impulse", () => {
  const v = new TricksterEffects(new THREE.Scene()),
    p = { x: 0, y: 0, z: 0, yaw: 0 };
  v.start("dash", p, p, { x: 0, z: -1 }, { particles: "minimal" });
  assert.equal(v.rings.length, 0);
  assert.equal(v.boost, 0);
  v.start("dash", p, p, { x: 0, z: -1 }, { particles: "decreased" });
  v.trail(p, { ...p, z: -2 }, { particles: "decreased" });
  v.update(0.016, true, { particles: "decreased" });
  assert.equal(v.echoes.count, 0);
  assert.ok(v.sigils.count > 0);
  assert.ok(v.lines.geometry.drawRange.count > 0);
  v.clear();
  assert.equal(v.boost, 0);
  assert.equal(v.root.visible, false);
});
test("shared hotbar move guides cover both weapons, expose saved cooldowns, and clear when changing items", () => {
  const g = arena();
  assert.match(weaponMoveText(g), /R Air Trick/);
  assert.match(weaponMoveText(g), /Style 2\/2/);
  g.player.tricksterBlinkTick = 121;
  assert.match(weaponMoveText(g), /Air Trick 2s/);
  g.inventory.slots[0] = makeStack("devin_sword");
  g.player.devinSeekerTick = 140;
  g.player.devinReadyTick = 100;
  assert.match(weaponMoveText(g), /Seeker 2s/);
  assert.match(weaponMoveText(g), /Pulse READY/);
  g.inventory.slots[0] = makeStack("stone");
  assert.equal(weaponMoveText(g), "");
});
