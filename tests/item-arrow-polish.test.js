import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ITEMS, B, makeStack } from "../src/data.js";
import { World } from "../src/world.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import {
  REFINED_ITEM_IDS,
  REFINED_COLOR_IDS,
  refinedItemPixels,
  paintRefinedItem,
  visualInventoryItem,
} from "../src/refined-item-art.js";
import {
  embedArrow,
  tickEmbeddedArrows,
  restoreEmbeddedArrows,
  EMBEDDED_ARROW_LIMIT,
  EMBEDDED_ARROW_LIFETIME,
} from "../src/embedded-arrows.js";
import { tickHostileProjectiles } from "../src/hostile-combat.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import {
  createHeldModel,
  createHandRig,
  fitHandGrip,
} from "../src/first-person.js";
import { mountJavaItem, javaSwingPose } from "../src/java-item-motion.js";
import { animateRangedWeapon } from "../src/ranged-weapon-models.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
const arena = () => {
  const world = new World("Arrow polish");
  world.set(0, 199, 0, B.stone);
  return {
    world,
    player: createPlayer({ x: 0.5, y: 200, z: 0.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    hostileProjectiles: [],
    ui: { updateHotbar() {} },
    audio: { world() {} },
    multiplayer: { isGuest: false },
  };
};
const shoot = (
  g,
  {
    from = { x: 0.5, y: 201, z: 4.5 },
    vx = 0,
    vy = 0,
    vz = -3,
    recoverable = true,
    playerArrow = true,
    id = "test-arrow",
  } = {},
) => {
  const q = {
    ...from,
    vx,
    vy,
    vz,
    damage: 6,
    id,
    age: 0,
    playerArrow,
    recoverable,
    owner: "owner",
  };
  g.hostileProjectiles.push(q);
  tickHostileProjectiles(g, () => {});
  return g.world.embeddedArrows?.at(-1);
};
const near = (g) => {
  const q = g.world.embeddedArrows[0];
  Object.assign(g.player, { x: q.x, y: q.y - 0.5, z: q.z });
};
const count = (g) =>
  g.inventory.slots
    .filter((s) => s?.id === "arrow")
    .reduce((n, s) => n + s.count, 0);
test("51 remaining legacy item silhouettes are crisp original 16px art, including visibly distinct raw/cooked animal foods and resources", () => {
  assert.equal(REFINED_ITEM_IDS.length, 51);
  const signatures = new Set();
  for (const id of REFINED_ITEM_IDS) {
    const p = refinedItemPixels(id);
    assert.ok(p.grid.flat().includes("."));
    assert.ok(p.grid.flat().filter((c) => c !== ".").length > 12, id);
    const ops = [];
    const c = {
      set fillStyle(v) {
        this.color = v;
      },
      fillRect(x, y, w, h) {
        assert.ok([x, y, w, h].every(Number.isInteger));
        assert.ok(x >= 0 && y >= 0 && x + w <= 32 && y + h <= 32);
        ops.push(this.color);
      },
    };
    assert.equal(paintRefinedItem(c, id), true);
    assert.equal(c.imageSmoothingEnabled, false);
    assert.ok(
      ops.every((c) => /^#[a-f0-9]{6}$/i.test(c)),
      id,
    );
    signatures.add(JSON.stringify([p.grid, p.palette]));
  }
  assert.ok(signatures.size >= 45);
  assert.notDeepEqual(
    refinedItemPixels("mutton"),
    refinedItemPixels("chicken"),
  );
  assert.notDeepEqual(
    refinedItemPixels("chicken").palette,
    refinedItemPixels("cooked_chicken").palette,
  );
  assert.equal(paintRefinedItem({}, "apple"), false);
  assert.equal(paintRefinedItem({}, "diamond_sword"), false);
});
test("24 gray legacy palette fallbacks gain correct dye/mineral colors without mutating registry, food, stack or equipment data", () => {
  assert.equal(REFINED_COLOR_IDS.length, 24);
  for (const id of REFINED_COLOR_IDS) {
    const before = JSON.stringify(ITEMS[id]),
      item = visualInventoryItem(id);
    assert.equal(item.key, id);
    assert.deepEqual({ ...item, color: ITEMS[id].color }, ITEMS[id]);
    assert.equal(JSON.stringify(ITEMS[id]), before);
  }
  assert.notEqual(
    visualInventoryItem("red_dye").color,
    visualInventoryItem("blue_dye").color,
  );
  assert.equal(visualInventoryItem("apple"), ITEMS.apple);
});
test("nocked 3D arrow tips follow actual aim in first/F5 at every draw stage, with nocks seated exactly on the string", () => {
  const camera = new THREE.PerspectiveCamera(70, 1.7, 0.04, 4);
  for (const t of [0.2, 0.8, 1.5])
    for (const yaw of [-1, 0, 1])
      for (const pitch of [-0.5, 0, 0.5]) {
        const p = {
            onGround: true,
            health: 20,
            yaw,
            pitch,
            editionDraw: { id: "bow", start: 0 },
          },
          rig = createHandRig();
        rig.armVisuals.visible = false;
        const model = createHeldModel("bow");
        rig.grip.add(model);
        fitHandGrip(rig, "bow", model);
        animateRangedWeapon(model, p, t);
        mountJavaItem(rig, "bow", javaSwingPose(0), camera, p, t, {});
        const arrow = model.userData.nockedArrow;
        const check = (m, expected) => {
          m.updateWorldMatrix(true, true);
          const a = m.userData.nockedArrow,
            d = a
              .localToWorld(a.userData.tip.clone())
              .sub(a.localToWorld(a.userData.nock.clone()))
              .normalize();
          assert.ok(d.dot(expected) > 0.99999);
          const frame = m.userData.drawMeshes[m.userData.drawStage],
            nock = frame.localToWorld(frame.userData.stringNock.clone());
          assert.ok(
            nock.distanceTo(a.localToWorld(a.userData.nock.clone())) < 1e-8,
          );
        };
        check(model, new THREE.Vector3(0, 0, -1));
        assert.ok(arrow.visible);
        assert.ok(rig.viewBounds.max.z <= -0.1099);
        const f = createPlayerModel("dante", [], "bow");
        f.rotation.y = yaw;
        animatePlayerModel(f, p, 1 / 60, false, 0, "use", 0, true, null, {
          time: t,
        });
        check(
          f.userData.grip.children[0],
          new THREE.Vector3(
            -Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.cos(yaw) * Math.cos(pitch),
          ),
        );
      }
});
test("swept arrows lodge into all six block faces and chunk boundaries with their shafts outside and tips embedded", () => {
  for (const [vx, vy, vz] of [
    [3, 0, 0],
    [-3, 0, 0],
    [0, 3, 0],
    [0, -3, 0],
    [0, 0, 3],
    [0, 0, -3],
  ]) {
    const g = arena(),
      target = { x: 16, y: 201, z: 0 };
    g.world.set(target.x, target.y, target.z, B.stone);
    const direction = new THREE.Vector3(vx, vy, vz).normalize(),
      center = new THREE.Vector3(16.5, 201.5, 0.5),
      from = center.clone().addScaledVector(direction, -2);
    const q = shoot(g, {
      from: { x: from.x, y: from.y, z: from.z },
      vx,
      vy,
      vz,
    });
    assert.ok(q);
    assert.deepEqual([q.hit.x, q.hit.y, q.hit.z], [16, 201, 0]);
    assert.equal(g.hostileProjectiles.length, 0);
    assert.equal(g.drops.length, 0);
    assert.ok(q.stuck);
    assert.ok(Math.abs(Math.hypot(...Object.values(q.direction)) - 1) < 1e-8);
  }
});
test("one recoverable arrow stays embedded during pickup delay, survives full inventory, and transfers exactly once when a slot opens", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  shoot(g);
  near(g);
  for (let i = 0; i < 3; i++) tickEmbeddedArrows(g);
  assert.equal(count(g), 0);
  for (let i = 0; i < 36; i++) g.inventory.slots[i] = makeStack("stone", 64);
  for (let i = 0; i < 7; i++) tickEmbeddedArrows(g);
  assert.equal(g.world.embeddedArrows.length, 1);
  g.inventory.slots[9] = null;
  tickEmbeddedArrows(g);
  assert.equal(count(g), 1);
  assert.equal(g.world.embeddedArrows.length, 0);
  for (let i = 0; i < 20; i++) tickEmbeddedArrows(g);
  assert.equal(count(g), 1);
});
test("Creative and mob arrows are visible but cannot produce recoverable ammunition", () => {
  for (const [playerArrow, recoverable] of [
    [true, false],
    [false, false],
  ]) {
    const g = arena();
    g.world.set(0, 201, 2, B.stone);
    shoot(g, { playerArrow, recoverable });
    near(g);
    for (let i = 0; i < 10; i++) tickEmbeddedArrows(g);
    assert.equal(count(g), 0);
    assert.equal(g.world.embeddedArrows.length, 1);
  }
});
test("removing support releases the same arrow into gravity while replacing support with a solid block keeps it embedded", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  const q = shoot(g);
  g.world.set(0, 201, 2, B.dirt);
  tickEmbeddedArrows(g);
  assert.equal(g.world.embeddedArrows.length, 1);
  assert.equal(q.hit.id, B.dirt);
  g.world.set(0, 201, 2, B.air);
  tickEmbeddedArrows(g);
  assert.equal(g.world.embeddedArrows.length, 0);
  assert.equal(g.hostileProjectiles.length, 1);
  assert.equal(g.hostileProjectiles[0].id, q.id);
  assert.ok(g.hostileProjectiles[0].vy < 0);
  assert.equal(g.hostileProjectiles[0].recoverable, true);
});
test("realm saves round-trip lodged positions, direction, pickup ownership and delay, and old worlds default to no arrows", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  shoot(g);
  const saved = JSON.parse(JSON.stringify(exportRealm(g))),
    state = restoreRealm(g.world.seed, "overworld", saved);
  assert.equal(state.world.embeddedArrows.length, 1);
  const q = state.world.embeddedArrows[0];
  assert.equal(q.owner, "owner");
  assert.deepEqual(q.hit, g.world.embeddedArrows[0].hit);
  assert.equal(q.recoverable, true);
  assert.equal(q.delay, 7);
  assert.deepEqual(
    restoreRealm("old", "overworld", {}).world.embeddedArrows,
    [],
  );
});
test("unloaded or far lodged arrows do not query/stream terrain; loaded arrows expire after their bounded lifetime", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  const q = shoot(g);
  let queries = 0;
  const get = g.world.get.bind(g.world);
  g.world.get = (...a) => (queries++, get(...a));
  g.world.chunks.delete("0,0");
  tickEmbeddedArrows(g);
  assert.equal(queries, 0);
  assert.equal(q.age, 0);
  g.world.ensure(0, 0);
  q.age = EMBEDDED_ARROW_LIFETIME - 1;
  tickEmbeddedArrows(g);
  assert.equal(g.world.embeddedArrows.length, 0);
});
test("bounded restore rejects malformed geometry and normalizes directions; the world keeps at most 256 lodged arrows", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  const q = shoot(g),
    data = [
      null,
      {},
      { ...q, x: NaN },
      { ...q, direction: { x: 0, y: 0, z: 0 } },
      q,
    ];
  assert.equal(restoreEmbeddedArrows(data).length, 1);
  assert.deepEqual(restoreEmbeddedArrows(null), []);
  for (let i = 0; i < EMBEDDED_ARROW_LIMIT + 3; i++)
    embedArrow(
      g,
      { ...q, id: "cap-" + i, vx: 0, vy: 0, vz: -1 },
      { x: 0, y: 201, z: 2, id: B.stone, distance: 1 },
      { x: 0.5, y: 201, z: 4 },
      1,
    );
  assert.equal(g.world.embeddedArrows.length, 256);
  assert.equal(g.world.embeddedArrows.at(-1).id, "cap-258");
});
test("host-authoritative pickup transfers to one nearby peer once, while guest-side ticks cannot grant arrows", () => {
  const g = arena();
  g.world.set(0, 201, 2, B.stone);
  shoot(g);
  const q = g.world.embeddedArrows[0];
  Object.assign(g.player, { x: 30, z: 30 });
  const inv = new Inventory(),
    p = createPlayer({ x: q.x, y: q.y - 0.5, z: q.z });
  g.multiplayer = {
    connected: true,
    isGuest: false,
    peers: new Map([["peer", { player: p, inventory: inv }]]),
  };
  for (let i = 0; i < 8; i++) tickEmbeddedArrows(g);
  assert.equal(inv.slots.find((s) => s?.id === "arrow")?.count, 1);
  assert.equal(count(g), 0);
  assert.equal(g.world.embeddedArrows.length, 0);
  g.world.embeddedArrows = restoreEmbeddedArrows([q]);
  g.multiplayer.isGuest = true;
  tickEmbeddedArrows(g);
  assert.equal(g.world.embeddedArrows.length, 1);
  assert.equal(inv.slots.find((s) => s?.id === "arrow")?.count, 1);
});
