import { Multiplayer } from "../src/multiplayer.js";
import { placeDoor, setDoorOpen } from "../src/doors.js";
import { IncursionRenderer } from "../src/incursion-renderer.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/world.js";
import { B, BLOCKS, ITEMS, makeStack, DEFAULT_SETTINGS } from "../src/data.js";
import { createPlayer, collides, updatePlayer } from "../src/physics.js";
import { Inventory } from "../src/inventory.js";
import { createEntity, damageEntity, tickSurvival } from "../src/simulation.js";
import {
  MATTHEW,
  pistolUsesStyle,
  firePistols,
  rayBody,
  styleCharges,
  tricksterMove,
  updateTrickster,
  tickPistolTraces,
} from "../src/matthew.js";
import {
  INVASION,
  INVASION_ANNOUNCEMENT,
  beginInvasion,
  invasionState,
  tickInvasion,
  claimPistols,
  recordInvaderDeath,
  findInvasionSite,
} from "../src/invasion.js";
import { restoreRealm, exportRealm } from "../src/realms.js";
import { createHeldModel, createDroppedModel } from "../src/first-person.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { launchSeeker, tickSeekers } from "../src/seeker.js";
function fixture() {
  const world = new World("Wildflower");
  for (let x = -12; x <= 24; x++)
    for (let z = -16; z <= 24; z++) world.set(x, 199, z, B.stone);
  const calls = [],
    g = {
      world,
      dimension: "overworld",
      mode: "survival",
      difficulty: "normal",
      tickCount: 1,
      time: 6000,
      elapsed: 1,
      settings: { ...DEFAULT_SETTINGS, renderDistance: 2 },
      inventory: new Inventory(),
      player: createPlayer({ x: 0.5, y: 200, z: 10.5 }),
      entities: [],
      drops: [],
      keys: new Set(),
      running: true,
      renderer: { action() {}, arcane: { burst() {}, emit() {} } },
      audio: { tone() {}, voice() {} },
      ui: {
        toast(...a) {
          calls.push(a[0]);
        },
        announce(...a) {
          calls.push(a[1]);
        },
        updateHUD() {},
        updateHotbar() {},
      },
      damage(n) {
        this.player.health -= n;
      },
      calls,
    };
  g.inventory.slots[0] = makeStack(MATTHEW);
  g.player.onGround = true;
  return g;
}
function mob(g, type = "zombie", x = 0.5, z = 1.5) {
  const e = createEntity(
    g,
    type,
    x - 0.5,
    z - 0.5,
    `${type}:${g.entities.length}`,
  );
  Object.assign(e, { x, y: 200, z, onGround: true });
  g.entities.push(e);
  return e;
}
function aim(g, e) {
  const p = g.player;
  p.yaw = Math.atan2(p.x - e.x, p.z - e.z);
  p.pitch = Math.atan2(
    e.y + 1.2 - p.y - 1.62,
    Math.hypot(p.x - e.x, p.z - e.z),
  );
}
function shot(g) {
  return firePistols(g, damageEntity);
}
function emerge(g) {
  assert.equal(beginInvasion(g, { x: 0, y: 200, z: 0 }), true);
  for (let i = 0; i < 180; i++) {
    g.tickCount++;
    tickInvasion(g, createEntity);
  }
  return invasionState(g.world);
}
function target(g) {
  const s = invasionState(g.world);
  Object.assign(g.player, { x: s.x + 0.5, y: s.y + 1, z: s.z + 3.5 });
  return { x: s.x, y: s.y + 1, z: s.z, id: B.matthew_altar };
}
test("pistols are an original unbreakable, nonstackable item and append-only altar state", () => {
  assert.equal(ITEMS[MATTHEW].name, "Matthew's Dual Wielded Pistols");
  assert.equal(ITEMS[MATTHEW].stack, 1);
  assert.equal(ITEMS[MATTHEW].unbreakable, true);
  assert.equal(B.matthew_altar, 121);
  assert.equal(B.water_flow_1, 105);
  assert.equal(BLOCKS[B.matthew_altar].internal, true);
});
test("alternating shots damage nearest full body once, respect four-tick cooldown, and use no ammunition", () => {
  const g = fixture(),
    e = mob(g),
    behind = mob(g, "skeleton", 0.5, -1.5);
  aim(g, e);
  assert.equal(shot(g), true);
  assert.equal(e.hp, 15);
  assert.equal(behind.hp, 20);
  assert.equal(g.player.matthewHand, 1);
  assert.equal(shot(g), false);
  g.tickCount += 4;
  assert.equal(shot(g), true);
  assert.equal(e.hp, 10);
  assert.equal(g.player.matthewHand, 0);
  assert.equal(g.inventory.held.count, 1);
  assert.equal(g.pistolTraces.length, 2);
  for (let i = 0; i < 3; i++) tickPistolTraces(g);
  assert.equal(g.pistolTraces.length, 0);
});
test("shots stop at walls and cannot damage an entity beyond forty blocks", () => {
  const g = fixture(),
    e = mob(g);
  aim(g, e);
  g.world.set(0, 201, 5, B.stone);
  shot(g);
  assert.equal(e.hp, 20);
  assert.ok(g.pistolTraces[0].to.z >= 5.99);
  g.world.set(0, 201, 5, B.air);
  e.z = -40;
  g.tickCount += 4;
  aim(g, e);
  shot(g);
  assert.equal(e.hp, 20);
});
test("shots pass through non-solid flowers", () => {
  const g = fixture(),
    e = mob(g);
  aim(g, e);
  g.world.set(0, 201, 5, B.flower);
  shot(g);
  assert.equal(e.hp, 15);
});
test("muzzle obstruction prevents corner shooting even when the crosshair ray is clear", () => {
  const g = fixture(),
    e = mob(g);
  g.player.x = 0.9;
  e.x = 0.9;
  aim(g, e);
  g.world.set(1, 201, 10, B.stone);
  shot(g);
  assert.equal(e.hp, 20);
});
test("ray slabs cover small and tall bodies and reject parallel off-body rays", () => {
  const e = { type: "spider", x: 0, y: 0, z: 0 };
  assert.equal(
    rayBody({ x: 0, y: 0.5, z: 4 }, { x: 0, y: 0, z: -1 }, e, 8),
    3.325,
  );
  assert.equal(
    rayBody({ x: 2, y: 0.5, z: 4 }, { x: 0, y: 0, z: -1 }, e, 8),
    null,
  );
});
test("ground dash travels 4.2 blocks with two independent charges and deterministic recharge", () => {
  const g = fixture();
  assert.equal(tricksterMove(g), true);
  for (let i = 0; i < 12; i++) updateTrickster(g, 1 / 60);
  assert.ok(Math.abs(g.player.z - 6.3) < 0.001);
  assert.equal(styleCharges(g.player, g.tickCount), 1);
  delete g.player.tricksterDash;
  assert.equal(tricksterMove(g), true);
  delete g.player.tricksterDash;
  assert.equal(tricksterMove(g), false);
  g.tickCount += 40;
  assert.equal(styleCharges(g.player, g.tickCount), 2);
});
test("dash small sweeps stop at one-block walls, including chunk boundaries", () => {
  const g = fixture();
  Object.assign(g.player, { x: 14.5, z: 0.5, yaw: -Math.PI / 2 });
  for (let y = 200; y <= 202; y++) g.world.set(16, y, 0, B.stone);
  tricksterMove(g);
  for (let i = 0; i < 14; i++) updateTrickster(g, 1 / 60);
  assert.ok(g.player.x <= 15.70001 && g.player.x > 15.5);
  assert.equal(collides(g.world, g.player), false);
});
test("Sky Star works once per airborne period and resets only on landing", () => {
  const g = fixture();
  g.player.onGround = false;
  g.player.y = 204;
  assert.equal(tricksterMove(g), true);
  delete g.player.tricksterDash;
  g.tickCount += 40;
  assert.equal(tricksterMove(g), false);
  g.player.onGround = true;
  updateTrickster(g, 1 / 60);
  g.player.onGround = false;
  assert.equal(tricksterMove(g), true);
});
test("wall hike needs a nearby wall, uses a charge, and cannot be repeated in midair", () => {
  const g = fixture();
  Object.assign(g.player, { x: 0.69999, y: 201, onGround: false });
  for (let y = 201; y < 205; y++) g.world.set(1, y, 10, B.stone);
  g.keys.add("Space");
  assert.equal(tricksterMove(g), true);
  assert.equal(g.player.vy, 11);
  assert.equal(g.player.tricksterWallUsed, true);
  assert.equal(styleCharges(g.player, g.tickCount), 1);
});
test("Air Trick retains aimed-hostile behavior, fall accounting, and saved cooldown", () => {
  const g = fixture(),
    e = mob(g);
  aim(g, e);
  assert.equal(tricksterMove(g, true), true);
  assert.ok(Math.abs(g.player.z - 3.3) < 0.001);
  assert.equal(g.player.tricksterBlinkTick, 101);
  assert.equal(collides(g.world, g.player), false);
  assert.equal(tricksterMove(g, true), false);
  const saved = JSON.parse(JSON.stringify(g.player));
  assert.equal(createPlayer(g.player, saved).tricksterBlinkTick, 101);
});
test("Air Trick stops before walls in free aim and rejects an obstructed creature approach", () => {
  const g = fixture(),
    e = mob(g);
  aim(g, e);
  g.world.set(0, 201, 6, B.stone);
  assert.equal(tricksterMove(g, true), true);
  assert.ok(g.player.z >= 7.3 && g.player.z < 10.5);
  assert.equal(collides(g.world, g.player), false);
  const blocked = fixture(),
    target = mob(blocked);
  aim(blocked, target);
  blocked.world.set(0, 200, 6, B.stone);
  assert.equal(tricksterMove(blocked, true), false);
  assert.equal(blocked.player.z, 10.5);
  assert.equal(styleCharges(blocked.player, blocked.tickCount), 2);
});
test("style movement does not operate while dead, swimming, in lava, flying, or holding another item", () => {
  for (const key of ["health", "inWater", "inLava", "flying"]) {
    const g = fixture();
    g.player[key] = key === "health" ? 0 : true;
    assert.equal(tricksterMove(g), false);
  }
  const g = fixture();
  g.inventory.slots[0] = makeStack("stick");
  assert.equal(tricksterMove(g), false);
});
test("opening announcement matches requested text exactly and shrine rises before four guards spawn", () => {
  const g = fixture(),
    s = emerge(g);
  assert.ok(g.calls.includes(INVASION_ANNOUNCEMENT));
  assert.equal(s.phase, "battle");
  assert.equal(s.opened, true);
  assert.equal(g.entities.filter((e) => e.encounter === INVASION).length, 4);
  assert.equal(g.world.get(0, 201, 0), B.matthew_altar);
  assert.equal(g.world.get(0, 198, 0), B.air);
  assert.equal(g.world.get(0, 199, 0), B.cinder_bricks);
});
test("opening and construction wait safely while a player occupies the rising shrine", () => {
  const g = fixture();
  beginInvasion(g, { x: 0, y: 200, z: 0 });
  const s = invasionState(g.world);
  s.age = 39;
  g.player.z = 0.5;
  tickInvasion(g, createEntity);
  assert.equal(s.age, 39);
  assert.equal(s.opened, false);
  g.player.z = 10.5;
  tickInvasion(g, createEntity);
  assert.equal(s.age, 40);
  s.age = 179;
  g.player.z = 0.5;
  tickInvasion(g, createEntity);
  assert.equal(s.age, 179);
  assert.equal(g.world.get(0, 201, 0), B.air);
});
test("Peaceful pauses emerging encounters and preserves guards, rather than awarding a free reward", () => {
  const g = fixture();
  const s = emerge(g);
  g.difficulty = "peaceful";
  tickSurvival(g);
  assert.equal(s.phase, "battle");
  assert.equal(
    g.entities.filter((e) => e.encounter === INVASION && e.hp > 0).length,
    4,
  );
  assert.equal(s.defeated.length, 0);
});
test("defeat gate rejects early claims; each valid guard death is recorded once", () => {
  const g = fixture(),
    s = emerge(g),
    t = target(g);
  claimPistols(g, t);
  assert.equal(s.phase, "battle");
  const e = g.entities[0];
  recordInvaderDeath(g.world, e);
  recordInvaderDeath(g.world, e);
  assert.deepEqual(s.defeated, [0]);
  recordInvaderDeath(g.world, { encounter: INVASION, invasionIndex: 100 });
  assert.deepEqual(s.defeated, [0]);
});
test("real damage defeats all Hellspawn, unlocks altar, rejects full bag, awards exactly one persistent pair", () => {
  const g = fixture(),
    s = emerge(g),
    t = target(g);
  for (const e of g.entities) damageEntity(g, e, 1000);
  tickInvasion(g, createEntity);
  assert.equal(s.phase, "ready");
  g.inventory.slots.fill(null);
  for (let i = 0; i < 36; i++) g.inventory.slots[i] = makeStack("stone", 64);
  claimPistols(g, t);
  assert.equal(s.phase, "ready");
  g.inventory.slots[4] = null;
  claimPistols(g, t);
  assert.equal(s.phase, "claimed");
  claimPistols(g, t);
  assert.equal(g.inventory.slots.filter((s) => s?.id === MATTHEW).length, 1);
  assert.equal(beginInvasion(g, { x: 12, y: 200, z: 12 }), false);
});
test("interrupted emergence and mid-battle per-guard progress survive realm round trips without duplication", () => {
  const g = fixture();
  beginInvasion(g, { x: 0, y: 200, z: 0 });
  for (let i = 0; i < 80; i++) tickInvasion(g, createEntity);
  let state = exportRealm({
    world: g.world,
    entities: g.entities,
    drops: g.drops,
  });
  let restored = restoreRealm(
    g.world.seed,
    "overworld",
    JSON.parse(JSON.stringify(state)),
  );
  Object.assign(g, restored);
  assert.equal(invasionState(g.world).age, 80);
  for (let i = 80; i < 180; i++) tickInvasion(g, createEntity);
  damageEntity(g, g.entities[0], 1000);
  state = exportRealm({
    world: g.world,
    entities: g.entities.filter((e) => e.hp > 0),
    drops: g.drops,
  });
  restored = restoreRealm(
    g.world.seed,
    "overworld",
    JSON.parse(JSON.stringify(state)),
  );
  Object.assign(g, restored);
  for (let i = 0; i < 40; i++) tickInvasion(g, createEntity);
  assert.equal(g.entities.length, 3);
  assert.equal(invasionState(g.world).defeated.length, 1);
});
test("ordinary Cinderworld creatures cannot satisfy the incursion reward gate", () => {
  const g = fixture(),
    s = emerge(g);
  const e = mob(g, "cinder_wraith");
  damageEntity(g, e, 1000);
  assert.equal(s.defeated.length, 0);
});
test("incursions do not start inside Cinderworld or simulate on guests", () => {
  const g = fixture();
  g.world.dimension = "cinderwild";
  assert.equal(beginInvasion(g, { x: 0, y: 200, z: 0 }), false);
  g.world.dimension = "overworld";
  g.multiplayer = { isGuest: true };
  tickInvasion(g, createEntity);
  assert.equal(invasionState(g.world), undefined);
});
test("weapon reward cannot be claimed from far away, at a counterfeit altar or by a guest", () => {
  const g = fixture(),
    s = emerge(g);
  s.phase = "ready";
  g.inventory.slots.fill(null);
  claimPistols(g, { x: 0, y: 201, z: 0, id: B.matthew_altar });
  assert.equal(s.phase, "ready");
  const t = target(g);
  g.multiplayer = { isGuest: true };
  claimPistols(g, t);
  assert.equal(s.phase, "ready");
  g.multiplayer = null;
  claimPistols(g, { ...t, x: 1 });
  assert.equal(s.phase, "ready");
});
test("pistols have solid 3D drops, a gripped model in each F5 hand, and correct forward barrel orientation", () => {
  const held = createHeldModel(MATTHEW),
    drop = createDroppedModel(MATTHEW);
  assert.ok(
    new THREE.Box3().setFromObject(held).getSize(new THREE.Vector3()).z > 0.3,
  );
  assert.equal(drop.userData.droppedItem, MATTHEW);
  const p = createPlayer({ x: 0, y: 0, z: 0 });
  p.pitch = 0;
  const model = createPlayerModel("hero", [], MATTHEW);
  animatePlayerModel(model, p, 0.016, false, 0);
  model.updateMatrixWorld(true);
  const u = model.userData;
  assert.equal(u.leftGrip.children.length, 1);
  assert.equal(u.grip.children.length, 1);
  const forward = new THREE.Vector3(0, 0, -1).transformDirection(
    u.grip.matrixWorld,
  );
  assert.ok(forward.z < -0.9);
});
test("Seeker ignores non-solid flowers but still hits hostiles behind them", () => {
  const g = fixture(),
    e = mob(g);
  g.inventory.slots[0] = makeStack("devin_sword");
  g.world.set(0, 201, 5, B.flower);
  assert.equal(launchSeeker(g), true);
  for (let i = 0; i < 20; i++) tickSeekers(g, damageEntity);
  assert.equal(e.hp, 8);
});

test("pistol rays ignore water and hit only the actual closed door panel", () => {
  const g = fixture(),
    e = mob(g);
  aim(g, e);
  g.world.set(0, 201, 5, B.water);
  shot(g);
  assert.equal(e.hp, 15);
  g.world.set(0, 201, 5, B.air);
  g.tickCount += 4;
  assert.equal(placeDoor(g.world, 0, 200, 5, 0), true);
  shot(g);
  assert.equal(e.hp, 15);
  setDoorOpen(g.world, 0, 200, 5, true);
  g.tickCount += 4;
  shot(g);
  assert.equal(e.hp, 10);
});
test("tentacle segments bridge curve joints throughout emergence, with bounded instancing", () => {
  const g = fixture();
  g.active = true;
  beginInvasion(g, { x: 0, y: 200, z: 0 });
  const scene = new THREE.Scene(),
    visual = new IncursionRenderer(scene);
  for (const age of [5, 40, 90, 160, 179]) {
    invasionState(g.world).age = age;
    visual.update(g, age / 20);
    assert.equal(visual.arms.count, 48);
    const a = new THREE.Matrix4(),
      b = new THREE.Matrix4();
    for (let arm = 0; arm < 6; arm++)
      for (let j = 0; j < 7; j++) {
        visual.arms.getMatrixAt(arm * 8 + j, a);
        visual.arms.getMatrixAt(arm * 8 + j + 1, b);
        const end = new THREE.Vector3(0, 0.5, 0).applyMatrix4(a),
          start = new THREE.Vector3(0, -0.5, 0).applyMatrix4(b);
        assert.ok(end.distanceTo(start) < 0.05);
      }
  }
  visual.clear();
  assert.equal(visual.root.children.length, 0);
  assert.equal(visual.traces.geometry.drawRange.count, 0);
});
test("natural checks respect their initial grace period and eventually find real unedited land", () => {
  const g = fixture();
  g.world = new World("Wildflower", {}, "overworld", 12);
  g.player.x = 88.5;
  g.player.z = 8.5;
  for (let z = -2; z <= 2; z++)
    for (let x = 3; x <= 7; x++) g.world.ensure(x, z);
  tickInvasion(g, createEntity);
  const waiting = invasionState(g.world);
  assert.equal(waiting.nextCheck, 1200);
  g.world.tick = 1199;
  tickInvasion(g, createEntity);
  assert.equal(waiting.attempts, 0);
  for (let n = 0; n < 40 && invasionState(g.world).phase === "waiting"; n++) {
    g.world.tick = 1200 + n * 600;
    g.tickCount = g.world.tick;
    tickInvasion(g, createEntity);
  }
  assert.equal(invasionState(g.world).phase, "emerging");
  assert.ok(g.calls.includes(INVASION_ANNOUNCEMENT));
});

test("host pistol commands enforce per-peer tick cooldowns and restore host state", () => {
  const g = fixture(),
    enemy = mob(g);
  g.mode = "creative";
  const hostPlayer = g.player,
    hostInventory = g.inventory;
  const peerPlayer = createPlayer(hostPlayer);
  aim({ ...g, player: peerPlayer }, enemy);
  const session = Object.create(Multiplayer.prototype),
    acks = [];
  session.game = g;
  session.peers = new Map([
    [
      "guest",
      {
        player: peerPlayer,
        inventory: new Inventory(),
        lastSeq: -1,
        lastPose: performance.now(),
        lastAction: -10,
        lastAttack: -10,
      },
    ],
  ]);
  session.send = (m) => acks.push(m);
  session.execute({ id: "guest", seq: 1, kind: "pistol", held: MATTHEW });
  assert.equal(enemy.hp, 15);
  assert.equal(g.player, hostPlayer);
  assert.equal(g.inventory, hostInventory);
  assert.equal(acks.at(-1).cooldowns.matthewHand, 1);
  g.elapsed += 0.2;
  session.execute({ id: "guest", seq: 2, kind: "pistol", held: MATTHEW });
  assert.equal(enemy.hp, 15);
  assert.equal(acks.at(-1).ok, false);
  g.elapsed += 0.2;
  g.tickCount += 4;
  session.execute({ id: "guest", seq: 3, kind: "pistol", held: MATTHEW });
  assert.equal(enemy.hp, 10);
  assert.equal(acks.at(-1).cooldowns.matthewHand, 0);
});

test("pistol style respects door, workstation, bed, altar and villager interaction priority", () => {
  const g = fixture();
  assert.equal(pistolUsesStyle(g), true);
  for (const id of [
    B.oak_door,
    B.chest,
    B.furnace,
    B.crafting_table,
    B.enchanting_table,
    B.bed,
    B.matthew_altar,
    B.devin_relic_blade,
  ]) {
    g.target = { id };
    assert.equal(pistolUsesStyle(g), false);
  }
  g.target = null;
  g.targetEntity = () => ({ type: "villager" });
  assert.equal(pistolUsesStyle(g), false);
  g.player.crouching = true;
  assert.equal(pistolUsesStyle(g), true);
});

test("successful shots emit the matching finish exactly once and rejected cooldown shots stay silent", () => {
  const g = fixture(),
    sounds = [];
  g.audio.tone = (...args) => sounds.push(args);
  assert.equal(shot(g), true);
  assert.equal(shot(g), false);
  g.tickCount = g.player.matthewShotTick;
  assert.equal(shot(g), true);
  assert.deepEqual(sounds, [
    ["pistol", "silver"],
    ["pistol", "black"],
  ]);
});
