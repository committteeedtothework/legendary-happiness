import test from "node:test";
import assert from "node:assert/strict";
import { SprintInput, hasMovement } from "../src/controls.js";
import { createPlayer, updatePlayer } from "../src/physics.js";
import { B } from "../src/data.js";

function game() {
  return {
    mode: "survival",
    sprintInput: new SprintInput(),
    player: createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: true }),
    world: {
      get(x, y) {
        return y < 0 ? B.stone : B.air;
      },
      solid(x, y) {
        return y < 0;
      },
    },
    damage() {},
  };
}
function advance(g, codes, steps = 120) {
  const keys = new Set(codes);
  for (let i = 0; i < steps; i++) updatePlayer(g, keys, 1 / 60);
}
function doubleTap(g) {
  g.sprintInput.pressForward(100);
  g.sprintInput.stop(); // First tap releases W before the next press.
  g.sprintInput.pressForward(106);
}

test("a released double tap starts sprint inside the seven-tick window", () => {
  const g = game();
  doubleTap(g);
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, true);
  assert.ok(Math.abs(g.player.vz + 5.612) < 0.001);
  const walking = game();
  advance(walking, ["KeyW"]);
  assert.equal(walking.player.sprinting, false);
  assert.ok(Math.abs(walking.player.vz + 4.317) < 0.001);
});
test("a slow second W press does not sprint", () => {
  const g = game();
  g.sprintInput.pressForward(100);
  g.sprintInput.pressForward(107);
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
});
test("sprint stays latched while changing direction, then stops with movement", () => {
  const g = game();
  doubleTap(g);
  for (const keys of [["KeyW"], ["KeyW", "KeyD"], ["KeyD"], ["KeyS"]]) {
    advance(g, keys);
    assert.equal(g.player.sprinting, true);
    assert.ok(Math.abs(Math.hypot(g.player.vx, g.player.vz) - 5.612) < 0.001);
  }
  advance(g, []);
  assert.equal(g.player.sprinting, false);
  assert.equal(g.sprintInput.latched, false);
  g.sprintInput.pressForward(107);
  advance(g, ["KeyW"]);
  assert.equal(
    g.player.sprinting,
    false,
    "stopping consumes the previous gesture",
  );
});
test("opposing movement keys cancel sprint when there is no horizontal intent", () => {
  assert.equal(hasMovement(new Set(["KeyW", "KeyS"])), false);
  assert.equal(hasMovement(new Set(["KeyA", "KeyD"])), false);
  assert.equal(hasMovement(new Set(["KeyW", "KeyS", "KeyD"])), true);
  const g = game();
  doubleTap(g);
  advance(g, ["KeyW", "KeyS"]);
  assert.equal(g.player.sprinting, false);
  assert.equal(g.sprintInput.latched, false);
});
for (const shift of ["ShiftLeft", "ShiftRight"]) {
  test(`${shift} crouches, cancels sprint and returns to walking on release`, () => {
    const g = game();
    doubleTap(g);
    advance(g, ["KeyW", shift]);
    assert.equal(g.player.crouching, true);
    assert.equal(g.player.sprinting, false);
    assert.ok(Math.abs(g.player.vz + 1.295) < 0.001);
    advance(g, ["KeyW"]);
    assert.equal(g.player.crouching, false);
    assert.equal(g.player.sprinting, false);
  });
}
test("Survival hunger cancels sprint without restoring it when food returns", () => {
  const g = game();
  doubleTap(g);
  advance(g, ["KeyW"]);
  g.player.food = 6;
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
  g.player.food = 20;
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
});
test("Creative flight retains double-tap sprint and both Shift descent controls", () => {
  for (const shift of ["ShiftLeft", "ShiftRight"]) {
    const g = game();
    g.mode = "creative";
    Object.assign(g.player, { flying: true, y: 20, food: 0, onGround: false });
    doubleTap(g);
    advance(g, ["KeyW", shift], 60);
    assert.equal(g.player.sprinting, true);
    assert.equal(g.player.crouching, false);
    assert.equal(g.player.vy, -7);
    assert.ok(Math.abs(g.player.vz + 21.78) < 0.01);
    assert.ok(g.player.y < 14);
  }
});
test("Ctrl + W remains an alternative sprint control", () => {
  for (const ctrl of ["ControlLeft", "ControlRight"]) {
    const g = game();
    advance(g, ["KeyW", ctrl]);
    assert.equal(g.player.sprinting, true);
    advance(g, ["KeyW"]);
    assert.equal(g.player.sprinting, false);
  }
});
test("running into a wall ends the double-tap sprint latch", () => {
  const g = game();
  g.world.solid = (x, y, z) => y < 0 || z < 0;
  doubleTap(g);
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
  assert.equal(g.sprintInput.latched, false);
  assert.ok(g.player.z >= 0.3 - 0.00001);
});
test("reset forgets both active sprint and an incomplete double tap", () => {
  const g = game();
  g.sprintInput.pressForward(100);
  g.sprintInput.reset();
  g.sprintInput.pressForward(101);
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
  doubleTap(g);
  g.sprintInput.reset();
  advance(g, ["KeyW"]);
  assert.equal(g.player.sprinting, false);
});
