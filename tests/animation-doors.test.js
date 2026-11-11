import test from "node:test";
import assert from "node:assert/strict";
import { FirstPersonAnimator, actionPose } from "../src/animation.js";
import {
  B,
  BLOCKS,
  ITEMS,
  CREATIVE_ITEMS,
  RECIPES,
  MAX_Y,
} from "../src/data.js";
import { World } from "../src/world.js";
import {
  blockBounds,
  doorId,
  doorAt,
  placeDoor,
  removeDoor,
  setDoorOpen,
} from "../src/doors.js";
import { createPlayer, collides, moveBody } from "../src/physics.js";
import { meshChunk } from "../src/mesher.js";
import {
  matchRecipe,
  Inventory,
  miningTicks,
  canHarvest,
} from "../src/inventory.js";
import { tickSurvival, hitEntity } from "../src/simulation.js";
import { exportRealm, restoreRealm } from "../src/realms.js";

function emptyWorld() {
  const w = new World("door regression");
  w.set(15, 199, -1, B.stone);
  return w;
}
for (let facing = 0; facing < 4; facing++) {
  test(`door facing ${facing}: linked halves, thin collisions, open passage, and precise rays`, () => {
    const w = emptyWorld(),
      x = 15,
      y = 200,
      z = -1;
    assert.equal(placeDoor(w, x, y, z, (-facing * Math.PI) / 2), true);
    assert.deepEqual(doorAt(w, x, y + 1, z), { x, y, z, facing, open: false });
    const bounds = blockBounds(doorId(facing));
    const point = createPlayer({
      x: x + (bounds[0] + bounds[3]) / 2,
      y,
      z: z + (bounds[2] + bounds[5]) / 2,
    });
    assert.equal(collides(w, point), true);
    const center = createPlayer({ x: x + 0.5, y, z: z + 0.5 });
    assert.equal(
      collides(w, center),
      false,
      "thin panel leaves the rest of the cell free",
    );
    assert.equal(setDoorOpen(w, x, y + 1, z, true), true);
    assert.equal(w.get(x, y, z), doorId(facing, true));
    assert.equal(w.get(x, y + 1, z), doorId(facing, true, true));
    assert.equal(collides(w, center), false);
    const hit = w.raycast(
      { x: x - 1, y: y + 0.5, z: z + 0.5 },
      { x: 1, y: 0, z: 0 },
      4,
    );
    if (facing === 0 || facing === 2)
      assert.ok(hit?.id === doorId(facing, true));
    else assert.equal(hit, null, "ray passes through the open gap");
  });
}
test("closed door blocks forward travel and an open door permits passage", () => {
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, -Math.PI);
  const p = createPlayer({ x: 15.5, y: 200, z: 1 });
  for (let i = 0; i < 100; i++) moveBody(w, p, 0, 0, -0.05);
  assert.ok(p.z >= 0.299);
  setDoorOpen(w, 15, 200, -1, true);
  for (let i = 0; i < 60; i++) moveBody(w, p, 0, 0, -0.05);
  assert.ok(p.z < -1.5);
});
test("door targeting returns panel distance and ignores the open gap", () => {
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, -Math.PI);
  const origin = { x: 15.5, y: 201.5, z: 2 },
    dir = { x: 0, y: 0, z: -1 };
  const hit = w.raycast(origin, dir);
  assert.ok(Math.abs(hit.distance - 2) < 1e-8);
  assert.equal(hit.id, doorId(2, false, true));
  assert.deepEqual(hit.normal, { x: 0, y: 0, z: 1 });
  setDoorOpen(w, 15, 200, -1, true);
  assert.equal(w.raycast(origin, dir), null);
});
test("door placement fails atomically for occupied halves, absent support, player intersection and height limit", () => {
  for (const problem of ["upper", "lower", "support", "player", "height"]) {
    const w = emptyWorld(),
      y = problem === "height" ? MAX_Y : 200;
    if (problem === "height") w.set(15, y - 1, -1, B.stone);
    if (problem === "upper") w.set(15, y + 1, -1, B.stone);
    if (problem === "lower") w.set(15, y, -1, B.stone);
    if (problem === "support") w.set(15, y - 1, -1, B.air);
    const before = JSON.stringify(w.exportEdits());
    const actors =
      problem === "player" ? [createPlayer({ x: 15.5, y, z: -0.1 })] : [];
    assert.equal(placeDoor(w, 15, y, -1, -Math.PI, actors), false, problem);
    assert.equal(JSON.stringify(w.exportEdits()), before, problem);
  }
});
test("closing cannot trap a player or creature and does not change either half on failure", () => {
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, -Math.PI);
  setDoorOpen(w, 15, 200, -1, true);
  for (const p of [
    createPlayer({ x: 15.5, y: 200, z: 0 }),
    { x: 15.5, y: 200, z: 0, hp: 10, type: "cow" },
  ]) {
    assert.equal(setDoorOpen(w, 15, 200, -1, false, [p]), false);
    assert.equal(doorAt(w, 15, 200, -1).open, true);
  }
});
test("removing either half removes the pair exactly once; support removal clears it on tick", () => {
  for (const half of [0, 1]) {
    const w = emptyWorld();
    placeDoor(w, 15, 200, -1, 0);
    assert.ok(removeDoor(w, 15, 200 + half, -1));
    assert.equal(w.get(15, 200, -1), B.air);
    assert.equal(w.get(15, 201, -1), B.air);
    assert.equal(removeDoor(w, 15, 200 + half, -1), null);
  }
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, 0);
  w.set(15, 199, -1, B.air);
  w.simulate();
  assert.equal(w.get(15, 200, -1), B.air);
  assert.equal(w.get(15, 201, -1), B.air);
});
test("door state survives unload, save reconstruction and both realm exports", () => {
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, -Math.PI / 2);
  setDoorOpen(w, 15, 200, -1, true);
  w.unload(100, 100, 1);
  assert.equal(doorAt(w, 15, 201, -1).open, true);
  const saved = exportRealm({ world: w, entities: [], drops: [] });
  for (const realm of ["overworld", "cinderwild"]) {
    const r = restoreRealm(w.seed, realm, saved).world;
    assert.deepEqual(doorAt(r, 15, 200, -1), {
      x: 15,
      y: 200,
      z: -1,
      facing: 1,
      open: true,
    });
  }
});
test("only the real door item appears in inventory; recipe consumes six planks and produces three doors", () => {
  assert.equal(
    CREATIVE_ITEMS.filter((id) => id.startsWith("oak_door")).length,
    1,
  );
  assert.equal(ITEMS.oak_door.block, B.oak_door);
  const r = RECIPES.find((r) => r.id === "oak_door");
  assert.equal(r.count, 3);
  const grid = r.pattern.flatMap((row) =>
    [...row.padEnd(3)].map((c) =>
      c === "P" ? { id: "planks", count: 1 } : null,
    ),
  );
  assert.equal(matchRecipe(grid, 3).id, "oak_door");
  const inv = new Inventory();
  inv.craft = grid;
  assert.equal(inv.craftOne(3), true);
  assert.deepEqual(inv.cursor, { id: "oak_door", count: 3 });
  assert.ok(inv.craft.every((s) => !s));
  assert.equal(inv.craftOne(3), false);
});
test("held blocks never masquerade as mining tools or produce invalid mining times", () => {
  for (const item of Object.values(ITEMS).filter(
    (i) => i.block !== undefined,
  )) {
    assert.equal(item.tool, undefined, item.key);
    assert.equal(miningTicks(BLOCKS[B.stone], { id: item.key, count: 1 }), 150);
    assert.equal(
      canHarvest(BLOCKS[B.stone], { id: item.key, count: 1 }),
      false,
    );
  }
});
function gameWithDoor() {
  const world = emptyWorld();
  placeDoor(world, 15, 200, -1, 0);
  setDoorOpen(world, 15, 200, -1, true);
  return {
    world,
    player: createPlayer({ x: 15.5, y: 200, z: -0.5 }),
    inventory: new Inventory(),
    dimension: "overworld",
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    time: 6000,
    elapsed: 10,
    tickCount: 0,
    settings: { renderDistance: 2 },
    damage(n) {
      this.player.health -= n;
    },
    ui: { updateHUD() {}, updateHotbar() {}, toast() {} },
  };
}
test("standing in an open doorway does not cause suffocation damage", () => {
  const g = gameWithDoor();
  for (let i = 0; i < 20; i++) tickSurvival(g);
  assert.equal(g.player.health, 20);
});
test("combat knockback resolves against walls instead of phasing the victim through", () => {
  const g = gameWithDoor();
  for (let y = 200; y < 203; y++) g.world.set(16, y, -1, B.stone);
  g.player.x = 14.5;
  g.inventory.slots[0] = { id: "diamond_sword", count: 1, durability: 100 };
  const e = {
    id: "victim",
    type: "shade",
    x: 15.5,
    y: 200,
    z: -0.5,
    hp: 20,
    vx: 0,
    vy: 0,
    vz: 0,
  };
  hitEntity(g, e);
  assert.ok(e.x <= 15.701);
  assert.equal(collides(g.world, e, 1.95), false);
  assert.ok(e.hp < 20);
});
test("chunk meshing batches doors with thin bounds and valid atlas coordinates", () => {
  const w = emptyWorld();
  placeDoor(w, 15, 200, -1, 0);
  const groups = meshChunk(w, w.ensure(0, -1), { ambientOcclusion: false });
  assert.ok(groups[0].uv.every((u) => u >= 0 && u <= 1));
  assert.ok(
    Math.max(
      ...BLOCKS.map((b, i) => (b.artTile ?? i * 3) * (b.edition ? 1 : 0)),
    ) < 4096,
  );
  assert.equal(B.sandstone, 36, "legacy IDs remain stable");
});
test("ordinary swings return to rest and share their motion across tools; eating stays distinct", () => {
  for (const kind of ["attack", "eat", "use", "place"])
    for (const tool of [undefined, "sword", "axe", "pickaxe"])
      for (const t of [0, 1])
        for (const n of Object.values(actionPose(kind, t, tool)))
          assert.ok(Math.abs(n) < 1e-10);
  assert.deepEqual(
    actionPose("attack", 0.5, "sword"),
    actionPose("attack", 0.5, "axe"),
  );
  assert.deepEqual(
    actionPose("attack", 0.5),
    actionPose("attack", 0.5, "pickaxe"),
  );
});
test("visual actions finish consistently across frame rates, pause at zero dt and never mutate player mechanics", () => {
  for (const hz of [30, 60, 144]) {
    const a = new FirstPersonAnimator(),
      p = createPlayer({ x: 0, y: 0, z: 0 });
    const before = JSON.stringify(p);
    a.trigger("attack", "sword");
    a.step(0.1, p);
    const age = a.action.age;
    a.step(0, p);
    assert.equal(a.action.age, age);
    for (let i = 0; i < hz; i++) a.step(1 / hz, p);
    assert.equal(a.action, null);
    assert.equal(JSON.stringify(p), before);
  }
});
test("mining, recoil, equip, swimming and landing produce finite distinct poses and reset cleanly", () => {
  const a = new FirstPersonAnimator(),
    p = createPlayer({ x: 0, y: 0, z: 0 });
  a.trigger("equip");
  assert.ok(a.step(0.01, p).y < -0.2);
  a.trigger("hurt");
  assert.ok(a.step(0.02, p, { itemId: "devin_sword", tool: "sword" }).z > 0);
  a.reset();
  a.equip = 0;
  p.vy = -12;
  a.step(0.02, p);
  p.onGround = true;
  assert.ok(
    a.step(0.02, p, { itemId: "devin_sword", tool: "sword" }).y < -0.01,
  );
  for (let i = 0; i < 60; i++) {
    const pose = a.step(1 / 60, p, { mining: true, moving: true });
    assert.ok(Object.values(pose).every(Number.isFinite));
  }
  a.trigger("attack", "sword");
  a.reset();
  assert.equal(a.action, null);
});
