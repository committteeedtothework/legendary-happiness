import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  titanSession,
  restoreTitanSession,
  titanInput,
  stepTitan,
} from "../src/giganto-simulation.js";
import { TITAN_DAMAGE } from "../src/titan-combat.js";
import { upgradeTitanCombat } from "../src/titan-balance.js";
import {
  advanceGrassCyloop,
  restoreGrassCyloop,
  GRASS_CYLOOP,
} from "../src/titan-grass-cyloop.js";
import { GrassCyloopView } from "../src/titan-grass-cyloop-view.js";
import { advanceTitanTrails } from "../src/titan-trails.js";
const ground = () => {
  const s = titanSession({ cinematics: false });
  s.stage = "traversal";
  Object.assign(s.avatar, { x: -110, y: 0, z: 0, onGround: true });
  return s;
};
const draw = (
  s,
  { radius = 5, cyloop = true, grounded = true, steps = 90 } = {},
) => {
  const events = [];
  for (let i = 0; i <= steps; i++) {
    s.time += 1 / 60;
    Object.assign(s.avatar, {
      x: -115 + Math.cos((i / steps) * Math.PI * 2) * radius,
      z: Math.sin((i / steps) * Math.PI * 2) * radius,
      onGround: grounded,
    });
    advanceGrassCyloop(s, { cyloop }, 1 / 60, (_s, type, d) =>
      events.push({ type, ...d }),
    );
  }
  return events;
};
test("base Cyloop requires an actual grounded closed area, releases physical rings once, and has a bounded cooldown", () => {
  for (const mode of [
    { cyloop: false },
    { grounded: false },
    { radius: 0.4 },
  ]) {
    const s = ground();
    draw(s, mode);
    assert.equal(s.grassCyloop.drops.length, 0);
  }
  const s = ground(),
    events = draw(s);
  assert.equal(events.filter((e) => e.type === "grass-cyloop").length, 1);
  assert.equal(s.grassCyloop.drops.length, 8);
  assert.equal(s.rings, 80);
  assert.equal(new Set(s.grassCyloop.drops.map((d) => d.id)).size, 8);
  draw(s);
  assert.equal(s.grassCyloop.serial, 1);
  assert.ok(s.grassCyloop.cooldown > 0);
  const before = s.grassCyloop.drops.length;
  s.grassCyloop.cooldown = 0;
  s.grassCyloop.points = [];
  s.grassCyloop.length = 0;
  advanceGrassCyloop(s, { cyloop: true }, 1 / 60, () => {});
  s.avatar.x += 80;
  advanceGrassCyloop(s, { cyloop: true }, 1 / 60, () => {});
  assert.equal(s.grassCyloop.drops.length, before);
});
test("released rings persist and each pickup transfers once across reload; malformed drawings and duplicate drops do not duplicate rewards", () => {
  const s = ground();
  s.original = {};
  draw(s);
  let q = s.grassCyloop;
  q.drops.forEach((d) => (d.age = 1));
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.grassCyloop.drops.length, 8);
  const first = { ...r.grassCyloop.drops[0] };
  Object.assign(r.avatar, { x: first.x, z: first.z, y: 0, onGround: true });
  advanceGrassCyloop(r, {}, 1 / 60, () => {});
  assert.equal(r.rings, 85);
  assert.equal(r.grassCyloop.drops.length, 7);
  const r2 = restoreTitanSession(JSON.parse(JSON.stringify(r)));
  advanceGrassCyloop(r2, {}, 1 / 60, () => {});
  assert.equal(r2.rings, 85);
  const malformed = restoreGrassCyloop({
    ...q,
    drops: [q.drops[0], q.drops[0], { id: "bad", x: Infinity, z: 0, age: 0 }],
    points: Array(500).fill({ x: 0, z: 0 }),
  });
  assert.equal(malformed.drops.length, 1);
  assert.equal(malformed.points.length, 0);
  r2.rings = r2.config.rings;
  Object.assign(r2.avatar, r2.grassCyloop.drops[0]);
  advanceGrassCyloop(r2, {}, 1 / 60, () => {});
  assert.equal(r2.grassCyloop.drops.length, 7);
});
test("Cyloop rendering is two bounded batches, pauses exactly and disappears outside base traversal", () => {
  const s = ground();
  draw(s);
  const scene = new T.Scene(),
    v = new GrassCyloopView(scene);
  v.update(s);
  assert.equal(scene.children.length, 2);
  assert.equal(v.rings.count, 8);
  assert.ok(v.path.count < 128);
  const before = [...v.rings.instanceMatrix.array];
  v.update(s);
  assert.deepEqual([...v.rings.instanceMatrix.array], before);
  assert.ok(before.every(Number.isFinite));
  s.stage = "combat";
  s.emerald = true;
  v.update(s);
  assert.equal(v.path.visible, false);
  assert.equal(v.rings.visible, false);
  scene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});
test("new tuning upgrades old health fractions and relative custom attack settings once, including high-health saves", () => {
  const old = {
    combatRevision: 3,
    damage: { basic: 65, boom: 145 },
    healthMultiplier: 1.5,
  };
  const config = upgradeTitanCombat(old);
  assert.equal(config.damage.basic, (65 * 180) / 34);
  assert.equal(config.damage.boom, 300);
  assert.deepEqual(upgradeTitanCombat(config), config);
  const s = titanSession();
  s.original = {};
  s.config = old;
  s.balance = 3;
  s.maxHp = 18000;
  s.hp = 9000;
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.maxHp, 180000);
  assert.equal(r.hp, 90000);
  assert.equal(r.config.damage.basic, config.damage.basic);
  assert.equal(restoreTitanSession(JSON.parse(JSON.stringify(r))).hp, 90000);
  const hard = titanSession({ difficulty: "hard", healthMultiplier: 2 });
  hard.original = {};
  hard.hp = 110000;
  const loaded = restoreTitanSession(JSON.parse(JSON.stringify(hard)));
  assert.equal(loaded.maxHp, 320000);
  assert.equal(loaded.hp, 110000);
  assert.equal(titanSession().maxHp, 120000);
  assert.equal(TITAN_DAMAGE.perfectCounter, 2900);
});
test("Super Sonic never leaves ribbon history at 30/60/144 Hz, even through boost, dodge and abilities", () => {
  for (const fps of [30, 60, 144])
    for (const action of [
      "idle",
      "dodge",
      "rush",
      "loop",
      "homing",
      "cross",
      "shot",
    ]) {
      const s = titanSession(),
        h = {
          segments: [
            { a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 1 }, life: 0.14 },
          ],
        };
      s.stage = "combat";
      s.emerald = true;
      s.boosting = true;
      s.action = action;
      assert.equal(
        advanceTitanTrails(
          h,
          { x: 0, y: 55, z: 0 },
          { x: 0, y: 55, z: 1 },
          s,
          1 / fps,
        ).length,
        0,
      );
    }
});
test("a mixed attack/counter policy wins both phases without an instant kill while an unprepared idle player loses to ring drain", () => {
  for (const difficulty of ["easy", "normal", "hard"]) {
    const s = titanSession({ cinematics: false, difficulty });
    s.rings = 400;
    s.stage = "transform";
    s.emerald = true;
    titanInput(s, "skip");
    Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
    const moves = new Set();
    for (
      let i = 0;
      i < 60 * 300 && !["victory", "defeat"].includes(s.stage);
      i++
    ) {
      if (s.qte && i % 5 === 0) titanInput(s, "jump");
      if (i % 5 === 0)
        for (const action of ["boom", "rush"]) titanInput(s, action);
      // Spend the new hit-earned charge on a fresh bind, not on repeat drops.
      if (i % 5 === 0 && !s.stagger && s.staggerRest <= 0)
        titanInput(s,"loop");
      const p = s.avatar,
        dx = s.boss.x + Math.sin(s.boss.yaw) * 5 - p.x,
        dz = s.boss.z + Math.cos(s.boss.yaw) * 5 - p.z,
        d = Math.hypot(dx, dz);
      if (d > 1) p.yaw = Math.atan2(-dx, -dz);
      stepTitan(
        s,
        {
          hit: true,
          parry: true,
          forward: d > 1,
          up: p.y < 56,
          down: p.y > 58,
        },
        1 / 60,
      );
      if (s.attack !== "idle") moves.add(s.attack);
    }
    assert.equal(s.stage, "victory");
    assert.equal(s.phase, 2);
    assert.ok(s.time > 30 && s.time < 150, `${difficulty}: ${s.time}`);
    assert.ok(moves.size >= 4);
    assert.ok(s.rings > 0);
  }
  const s = titanSession({ cinematics: false });
  s.stage = "combat";
  s.emerald = true;
  s.rings = 30;
  s.idle = 1000;
  Object.assign(s.avatar, { x: 120, y: 90, z: 0 });
  for (let i = 0; i < 60 * 40 && s.stage !== "defeat"; i++)
    stepTitan(s, {}, 1 / 60);
  assert.equal(s.stage, "defeat");
  assert.equal(s.hp, s.maxHp);
});
