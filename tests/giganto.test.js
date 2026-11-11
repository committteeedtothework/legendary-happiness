import { TitanView, titanCameraClearance } from "../src/giganto-view.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  titanConfig,
  titanSession,
  stepTitan,
  titanInput,
  retryTitan,
  restoreTitanSession,
  TITAN_ROUTE,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import {
  makeSonic,
  poseSonic,
  makeGiganto,
  poseGiganto,
  makeTitanArena,
  disposeTitanObject,
} from "../src/giganto-models.js";
const ticks = (s, n, input = {}) => {
  for (let i = 0; i < n; i++) stepTitan(s, input, 1 / 60);
};
const fight = () => {
  const s = titanSession({ cinematicPace: 1, cinematics: false, drain: 0 });
  s.rings = s.config.rings;
  s.preparedRings = s.rings;
  s.stage = "transform";
  s.emerald = true;
  s.checkpoint = "combat";
  titanInput(s, "skip");
  return s;
};
test("Titan settings clamp imported configuration and preserve explicit false / zero resource drain", () => {
  const c = titanConfig({
    spawnChance: 99,
    rings: -5,
    drain: 0,
    lighting: false,
    cooldown: 0,
    difficulty: "cheat",
  });
  assert.equal(c.spawnChance, 1);
  assert.equal(c.rings, 100);
  assert.equal(c.drain, 0);
  assert.equal(c.lighting, false);
  assert.equal(c.cooldown, 10);
  assert.equal(c.difficulty, "normal");
});
test("the entire Emerald traversal is reachable using real boost, jump, air control and platform collisions without teleporting", () => {
  const s = titanSession({
    cinematicPace: 1,
    cinematics: true,
    climbMode: "ruins",
  });
  titanInput(s, "skip");
  for (let target = 1; target < TITAN_ROUTE.length; target++) {
    const q = TITAN_ROUTE[target];
    let landed = false;
    // Each cyan pad is a checkpoint. Aim at the next visible platform and jump.
    s.avatar.yaw = Math.atan2(-(q.x - s.avatar.x), -(q.z - s.avatar.z));
    titanInput(s, "jump");
    for (let i = 0; i < 210; i++) {
      const p = s.avatar,
        dx = q.x - p.x,
        dz = q.z - p.z,
        d = Math.hypot(dx, dz);
      if (d > 1) p.yaw = Math.atan2(-dx, -dz);
      stepTitan(s, { forward: d > 1.3, boost: d > 4 }, 1 / 60);
      if (s.route >= target) {
        landed = true;
        break;
      }
    }
    assert.ok(landed, `platform ${target}: ${JSON.stringify(s.avatar)}`);
  }
  assert.equal(s.emerald, true);
  assert.equal(s.stage, "transform");
  ticks(s, 361);
  assert.equal(s.stage, "combat");
  assert.equal(s.checkpoint, "combat");
  assert.equal(s.rings, 80 + 12 * 5);
  assert.equal(s.ringPickups.length, 0);
});
test("rings, damage and attack clocks are protected during all cinematic stages; skips reach the proper next state", () => {
  for (const stage of ["intro", "transform", "phase", "finale"]) {
    const s = fight();
    s.stage = stage;
    s.stageTime = 0;
    s.config.drain = 3;
    const r = s.rings,
      h = s.hp;
    for (let i = 0; i < 30; i++) {
      stepTitan(s, {}, 1 / 60);
      titanInput(s, "hit");
    }
    assert.equal(s.rings, r, stage);
    assert.equal(s.hp, h, stage);
    titanInput(s, "skip");
    assert.ok(["traversal", "combat", "victory"].includes(s.stage));
  }
});
test("both recognizable arm attacks honor windup, forgiving held parry, Grand Slam counters, dodge immunity and recovery gaps", () => {
  for (const move of ["swing", "slap"]) {
    const s = fight();
    s.attack = move;
    s.attackTime = 0;
    s.avatar.x = 0;
    s.avatar.y = 57;
    s.avatar.z = 18;
    ticks(s, Math.ceil((TITAN_MOVES[move].tell + 0.5) * 60), { parry: true });
    assert.ok(s.counter > 0, move);
    const hp = s.hp;
    titanInput(s, "hit");
    ticks(s, 31);
    assert.ok(s.hp < hp);
    assert.equal(s.counter, 0);
    assert.ok(s.idle > 2);
  }
  const s = fight();
  s.attack = "swing";
  s.attackTime = 1.35;
  titanInput(s, "dodge");
  ticks(s, 15);
  assert.notEqual(s.action, "hurt");
  assert.equal(s.combo, 0);
});
test("mouth-beam and grab/crunch struggles accept fresh timed taps, reject held auto-clicks and recover safely after success or failure", () => {
  for (const move of ["beam", "crunch"]) {
    const s = fight();
    s.phase = 2;
    s.attack = move;
    s.attackTime = TITAN_MOVES[move].tell - 0.01;
    s.iframes = 0;
    s.avatar = { ...s.avatar, x: 0, y: 57, z: 5 };
    s.attackAim = { ...s.avatar };
    ticks(s, 2);
    assert.equal(s.qte.kind, move);
    const before = s.qte.hits;
    for (let i = 0; i < 100; i++) titanInput(s, "hit");
    assert.equal(s.qte.hits, before + 1);
    for (let i = 0; i < 20 && s.qte; i++) {
      ticks(s, 5);
      titanInput(s, "jump");
    }
    ticks(s, 1);
    assert.equal(s.qte, null);
    assert.ok(s.stagger > 0);
  }
  const s = fight();
  s.qte = { kind: "beam", left: 0.02, need: 10, hits: 0 };
  ticks(s, 3);
  assert.equal(s.qte, null);
  assert.equal(s.rings, s.config.rings - 39);
  assert.ok(s.idle > 3);
});
test("combo, Sonic Boom, Wild Rush, Cyloop and Phantom Rush have free abilities and bounded contacts; phase two and defeat/retry checkpoints are explicit", () => {
  const s = fight();
  s.config.adaptiveBoss = false; // Charge requires real unguarded contacts.
  s.config.bossMobility = false;
  s.avatar = { ...s.avatar, x: 0, y: 57, z: 5 };
  s.idle = 999;
  for (let i = 0; i < 25; i++) {
    titanInput(s, "hit");
    ticks(s, 37, { parry: true });
  }
  assert.ok(s.phantom > 0 || s.phantomRest > 0);
  for (const action of ["boom", "rush", "loop"]) {
    const before = s.energy;
    assert.equal(titanInput(s, action), true);
    assert.equal(s.energy,undefined);
    assert.equal(titanInput(s, action), false);
    ticks(s, action === "loop" ? 205 : 100, { parry: true });
  }
  // Cyloop now leaves Sonic at its closure. Establish a close-range phase
  // fixture explicitly instead of relying on an automatic return to the cast.
  Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
  s.hp = s.maxHp * 0.5 + 1;
  s.attack = "idle";
  s.cooldowns.hit = 0;
  titanInput(s, "hit");
  ticks(s, 14);
  assert.equal(s.phase, 2);
  assert.equal(s.checkpoint, "phase2");
  ticks(s, 250);
  s.rings = 0.001;
  s.config.drain = 3;
  ticks(s, 1);
  assert.equal(s.stage, "defeat");
  retryTitan(s);
  assert.equal(s.phase, 2);
  assert.equal(s.hp, s.maxHp * 0.5);
  assert.equal(s.stage, "combat");
  assert.equal(s.rings, s.config.rings);
});
test("saved arenas sanitize malformed values and resume interrupted attacks with a fair protected recovery instead of phantom damage", () => {
  const s = fight();
  s.original = {
    player: { x: 0, y: 64, z: 0 },
    inventory: { slots: Array(36).fill(null) },
    dimension: "overworld",
  };
  s.attack = "crunch";
  s.qte = { kind: "crunch", left: 1, hits: 0, need: 12 };
  s.avatar.vx = 100;
  s.avatar.x = Infinity;
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.ok(restored);
  assert.equal(restored.attack, "idle");
  assert.equal(restored.qte, null);
  assert.ok(restored.iframes >= 2);
  assert.ok(Number.isFinite(restored.avatar.x));
  assert.equal(restoreTitanSession({ schema: 1, stage: "oops" }), null);
});
test("original articulated Sonic, Super Sonic, Giganto and batched arena models have finite transforms, connected joints and bounded draw objects", () => {
  const sonic = makeSonic(),
    boss = makeGiganto(),
    arena = makeTitanArena(TITAN_ROUTE),
    s = fight();
  for (const action of [
    "idle",
    "punch",
    "counter",
    "parry",
    "dodge",
    "boom",
    "rush",
    "loop",
    "hurt",
  ]) {
    s.action = action;
    s.actionTime = 0.2;
    poseSonic(sonic, s, 1 / 60);
    for (const move of ["swing", "slap", "beam", "crunch"]) {
      s.attack = move;
      s.attackTime = 1.9;
      poseGiganto(boss, s, 1 / 60);
      for (const obj of [sonic, boss]) {
        obj.updateMatrixWorld(true);
        obj.traverse((n) =>
          assert.ok(n.matrixWorld.elements.every(Number.isFinite)),
        );
      }
    }
  }
  assert.equal(sonic.userData.quills.length, 6);
  assert.equal(sonic.userData.super, true);
  let meshes = 0;
  boss.traverse((n) => (meshes += +!!n.isMesh));
  assert.ok(meshes < 130);
  assert.equal(arena.children.length, 15);
  assert.ok(arena.userData.platforms.isMesh);
  for (const o of [sonic, boss, arena]) disposeTitanObject(o);
});

test("missed climbing jumps return to the last reachable pad instead of stranding Sonic on the arena floor", () => {
  const s = titanSession({
    cinematicPace: 1,
    cinematics: false,
    climbMode: "ruins",
  });
  s.route = 6;
  const q = TITAN_ROUTE[6];
  Object.assign(s.avatar, {
    x: q.x + 18,
    y: q.y,
    z: q.z,
    vy: -4,
    onGround: false,
  });
  let rescued = false;
  for (let n = 0; n < 180; n++) {
    stepTitan(s, {}, 1 / 60);
    if (s.events.some((e) => e.type === "return-pad")) {
      rescued = true;
      break;
    }
  }
  assert.ok(rescued);
  assert.equal(s.route, 6);
  assert.ok(Math.abs(s.avatar.x - q.x) < 0.1);
  assert.ok(Math.abs(s.avatar.y - q.y) < 0.2);
});

test("climb dorsal pulses apply bounded knockback after their warning interval without repeated same-pulse hits", () => {
  const s = titanSession({
    cinematicPace: 1,
    cinematics: false,
    climbMode: "ruins",
  });
  s.time = 4.1;
  s.route = 6;
  Object.assign(s.avatar, { x: 22, y: 46, z: -25, onGround: false });
  stepTitan(s, {}, 1 / 60);
  assert.ok(s.events.some((e) => e.type === "pulse"));
  assert.ok(s.pulseCooldown > 0);
  const y = s.avatar.vy;
  stepTitan(s, {}, 1 / 60);
  assert.ok(!s.events.some((e) => e.type === "pulse"));
  assert.ok(s.avatar.vy < y);
});

test("locked and unlocked aerial movement keep the manual camera basis without overwriting its yaw", () => {
  for (const lock of [true, false]) {
    const s = fight();
    s.lock = lock;
    Object.assign(s.avatar, { x: 60, y: 57, z: 50, yaw: 0.4 });
    ticks(s, 30, { forward: true });
    assert.equal(s.avatar.yaw, 0.4);
    assert.ok(s.avatar.z < 48);
    assert.ok(s.avatar.x < 60);
  }
});
test("classic camera smoothing stays outside the Titan keep-out cylinder even during extreme orbit reversals", () => {
  const ow = globalThis.innerWidth,
    oh = globalThis.innerHeight;
  globalThis.innerWidth = 854;
  globalThis.innerHeight = 478;
  const view = new TitanView({
      settings: { shadows: false },
      renderer: { gl: { info: { reset() {} }, render() {} } },
    }),
    s = fight();
  s.lock = false;
  s.config.moveCamera = false;
  try {
    for (let n = 0; n < 80; n++) {
      s.avatar.x = 20 * Math.sin(n * 0.5);
      s.avatar.z = 20 * Math.cos(n * 0.5);
      s.avatar.yaw = n * 0.8;
      view.draw(s, 1 / 30);
      const p = view.camera.position;
      assert.ok(p.toArray().every(Number.isFinite));
      assert.ok(p.y >= 2.5);
      if (p.y < 93)
        assert.ok(Math.hypot(p.x, p.z) >= titanCameraClearance(p.y) - 0.001);
      assert.equal(view.game.renderer.gl.toneMapping, undefined);
      assert.equal(view.arena.userData.platforms.visible, false);
    }
    s.attack = "beam";
    s.qte = {};
    view.draw(s, 1 / 60);
    const start = new THREE.Vector3(0, -0.2, 3.5).applyMatrix4(
        view.boss.userData.bones.jaw.matrixWorld,
      ),
      end = new THREE.Vector3(s.avatar.x, s.avatar.y + 1, s.avatar.z);
    assert.ok(
      view.beam.position.distanceTo(start.add(end).multiplyScalar(0.5)) < 0.001,
    );
  } finally {
    view.dispose();
    if (ow === undefined) delete globalThis.innerWidth;
    else globalThis.innerWidth = ow;
    if (oh === undefined) delete globalThis.innerHeight;
    else globalThis.innerHeight = oh;
  }
});
