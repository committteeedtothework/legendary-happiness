import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlayer,
  moveBody,
  collides,
  intersectsBlock,
  updatePlayer,
} from "../src/physics.js";
import { B, BLOCKS } from "../src/data.js";
function world() {
  const cells = new Map();
  const get = (x, y, z) =>
    cells.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ??
    (y < 0 ? B.stone : B.air);
  return { cells, get, solid: (x, y, z) => !!BLOCKS[get(x, y, z)]?.solid };
}
test("placement ignores the same tiny contact rounding as movement but rejects genuine overlap", () => {
  const p = createPlayer({ x: 16.5, y: 1 - 0.000005, z: -15.5 });
  assert.equal(intersectsBlock(p, 16, 0, -16), false);
  assert.equal(intersectsBlock({ ...p, y: 0.999 }, 16, 0, -16), true);
  assert.equal(intersectsBlock({ ...p, y: 1.01 }, 16, 0, -16), false);
  assert.equal(
    intersectsBlock({ ...p, x: 15.7 + 0.000005 }, 16, 1, -16),
    false,
  );
  assert.equal(intersectsBlock({ ...p, x: 15.701 }, 16, 1, -16), true);
});
for (const [axis, sign] of [
  ["x", 1],
  ["x", -1],
  ["z", 1],
  ["z", -1],
]) {
  test(`one-block climb crosses a ${axis} chunk edge in direction ${sign} and lands on the surface`, () => {
    const w = world(),
      p = createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: true });
    p[axis] = sign > 0 ? 15.5 : -15.5;
    const cell = sign > 0 ? 16 : -17;
    w.cells.set(axis === "x" ? `${cell},0,0` : `0,0,${cell}`, B.stone);
    moveBody(
      w,
      p,
      axis === "x" ? sign * 0.4 : 0,
      -0.01,
      axis === "z" ? sign * 0.4 : 0,
      1.8,
      0.6,
      1,
    );
    assert.ok(Math.abs(p.y - 1) < 0.00002, JSON.stringify(p));
    assert.ok(Math.abs(p[axis]) > 15.8);
    assert.equal(p.onGround, true);
    assert.equal(collides(w, p), false);
  });
}
test("walking climbs a one-block rise with exactly two blocks of destination headroom", () => {
  const w = world(),
    p = createPlayer(
      { x: 0.5, y: 0, z: 0.5 },
      { onGround: true, yaw: -Math.PI / 2 },
    );
  for (let x = -1; x <= 30; x++) {
    w.cells.set(`${x},3,0`, B.stone);
    if (x >= 1) w.cells.set(`${x},0,0`, B.stone);
  }
  const g = {
    world: w,
    player: p,
    mode: "survival",
    damage: () => assert.fail("Climbing must not hurt the player"),
  };
  for (let i = 0; i < 90; i++) updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  assert.ok(p.x > 2, JSON.stringify(p));
  assert.ok(Math.abs(p.y - 1) < 0.00002);
  assert.equal(collides(w, p), false);
});
test("stepping respects walls, insufficient destination headroom and the ceiling along the lift", () => {
  for (const obstruction of ["wall", "destination", "origin"]) {
    const w = world(),
      p = createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: true });
    w.cells.set("1,0,0", B.stone);
    if (obstruction === "wall") w.cells.set("1,1,0", B.stone);
    if (obstruction === "destination") w.cells.set("1,2,0", B.stone);
    if (obstruction === "origin") w.cells.set("0,2,0", B.stone);
    moveBody(w, p, 0.4, -0.01, 0, 1.8, 0.6, 1);
    assert.ok(p.x < 0.701, obstruction);
    assert.ok(Math.abs(p.y) < 0.00002, obstruction);
    assert.equal(collides(w, p), false, obstruction);
  }
});
test("airborne bodies cannot gain a free step and the default creature step limit remains below a full block", () => {
  for (const airborne of [false, true]) {
    const w = world(),
      p = createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: !airborne });
    w.cells.set("1,0,0", B.stone);
    if (airborne) moveBody(w, p, 0.4, 0, 0, 1.8, 0.6, 1);
    else moveBody(w, p, 0.4, 0, 0);
    assert.ok(p.x < 0.701);
    assert.equal(p.y, 0);
  }
});

test("shallow collision shapes settle on their exact top without a fixed lift", () => {
  const w = world(),
    p = createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: true });
  w.cells.set("1,0,0", B.devin_relic_base);
  moveBody(w, p, 0.4, -0.01, 0, 1.8, 0.6, 1);
  assert.ok(Math.abs(p.y - 0.65) < 0.00002, JSON.stringify(p));
  assert.equal(collides(w, p), false);
});
test("diagonal movement cannot stack two full step lifts in a single update", () => {
  const w = world(),
    p = createPlayer({ x: 0.5, y: 0, z: 0.5 }, { onGround: true });
  w.cells.set("1,0,0", B.stone);
  w.cells.set("1,0,1", B.stone);
  w.cells.set("1,1,1", B.stone);
  moveBody(w, p, 0.4, -0.01, 0.4, 1.8, 0.6, 1);
  assert.ok(p.y <= 1.00001, JSON.stringify(p));
  assert.equal(collides(w, p), false);
});
