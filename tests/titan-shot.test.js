import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import {
  makeTitanShot,
  steerTitanShot,
  TITAN_SHOT,
} from "../src/titan-shot.js";
import { TITAN_ACTIONS } from "../src/titan-combat.js";
const fight = (config = {}) => {
  const s = titanSession({ cinematics: false, drain: 0, ...config });
  s.stage = "combat";
  s.emerald = true;
  s.rings = 400;
  s.idle = 999;
  s.original = { dimension: "overworld" };
  Object.assign(s.avatar, { x: 0, y: 57, z: 45, onGround: false });
  return s;
};
const ticks = (s, n, input = {}, hz = 60) => {
  const e = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / hz);
    e.push(...s.events);
  }
  return e;
};
test("Homing Shot releases at six animation contacts and deals exactly 1260 once at 30/60/144 Hz", () => {
  for (const hz of [30, 60, 144]) {
    // Isolate projectile cooldown/damage from the separately tested adaptive retaliation.
    const s = fight({ adaptiveBoss: false });
    assert.ok(titanInput(s, "shot"));
    assert.equal(s.energy, undefined);
    const before = ticks(s, Math.floor(0.35 * hz), {}, hz);
    assert.equal(before.filter((e) => e.type === "shot").length, 0);
    assert.equal(s.hp, s.maxHp);
    const e = ticks(s, hz * 3, {}, hz),
      releases = e.filter((e) => e.type === "shot");
    assert.equal(releases.length, 6);
    assert.deepEqual(
      releases.map((e) => e.index),
      [1, 2, 3, 4, 5, 6],
    );
    assert.ok(releases.every((e) => e.age >= 0 && e.age < 1 / hz + 0.00001));
    assert.equal(e.filter((e) => e.type === "hit").length, 6);
    assert.equal(s.maxHp - s.hp, 1260);
    assert.equal(s.projectiles.length, 0);
    assert.equal(s.cooldowns.shot,0);
    ticks(s, hz * 6, {}, hz);
    assert.equal(s.maxHp - s.hp, 1260);
    assert.ok(titanInput(s, "shot"));
  }
});
test("shot damage is independently configurable; legacy energy values do not gate shots; reach gates still reject remote targets", () => {
  const s = fight({ damage: { shot: 60 } });
  titanInput(s, "shot");
  ticks(s, 180);
  assert.equal(s.maxHp - s.hp, 360);
  const poor = fight();
  poor.energy = 39;
  assert.equal(titanInput(poor, "shot"), true);
  assert.equal(poor.energy, 39);
  assert.equal(poor.cooldowns.shot, 0);
  const far = fight();
  far.avatar.z = 140;
  assert.equal(titanInput(far, "shot"), false);
  assert.equal(far.energy, undefined);
});
test("guided spheres turn at a bounded angular speed and free-aim shots do not acquire a target", () => {
  const s = fight(),
    a = { direction: { x: 0, y: 0, z: -1 }, serial: 1 };
  const q = makeTitanShot(s, a, 0),
    old = { x: q.vx, y: q.vy, z: q.vz };
  s.boss.x = 15;
  steerTitanShot(s, q, 1 / 60);
  const speed = Math.hypot(q.vx, q.vy, q.vz),
    angle = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (old.x * q.vx + old.y * q.vy + old.z * q.vz) /
            (TITAN_SHOT.speed * speed),
        ),
      ),
    );
  assert.ok(Math.abs(speed - TITAN_SHOT.speed) < 1e-8);
  assert.ok(angle > 0 && angle <= TITAN_SHOT.turnRate / 60 + 0.00001);
  const away = fight();
  away.lock = false;
  away.avatar.yaw = Math.PI;
  assert.ok(titanInput(away, "shot"));
  const e = ticks(away, 240);
  assert.equal(e.filter((e) => e.type === "shot").length, 6);
  assert.equal(away.hp, away.maxHp);
  assert.equal(away.projectiles.length, 0);
});
test("dodge cancels pending releases while already launched spheres have one finite flight", () => {
  for (const [frames, launched] of [
    [12, 0],
    [29, 2],
  ]) {
    const s = fight();
    titanInput(s, "shot");
    const e = ticks(s, frames);
    assert.ok(titanInput(s, "dodge"));
    e.push(...ticks(s, 180));
    assert.equal(e.filter((e) => e.type === "shot").length, launched);
    assert.equal(e.filter((e) => e.type === "hit").length, launched);
    assert.equal(s.maxHp - s.hp, 210 * launched);
    assert.equal(s.projectiles.length, 0);
    assert.equal(s.strike, null);
  }
});
test("volley movement stays free; phase transitions and reload cannot replay outstanding projectiles", () => {
  const s = fight();
  titanInput(s, "shot");
  const x = s.avatar.x;
  ticks(s, 20, { right: true, up: true });
  assert.ok(s.avatar.x > x + 2);
  assert.ok(s.avatar.y > 58);
  const p = fight();
  p.hp = p.maxHp * 0.5 + 20;
  titanInput(p, "shot");
  ticks(p, 120);
  assert.equal(p.phase, 2);
  assert.equal(p.projectiles.length, 0);
  assert.equal(p.strike, null);
  const saved = fight();
  titanInput(saved, "shot");
  ticks(saved, 29);
  assert.ok(saved.projectiles.length > 0);
  const raw = JSON.parse(JSON.stringify(saved)),
    r = restoreTitanSession(raw);
  assert.ok(r);
  assert.equal(r.strike, null);
  assert.equal(r.projectiles.length, 0);
  assert.equal(r.cooldowns.shot,0);
  const hp = r.hp;
  ticks(r, 120);
  assert.equal(r.hp, hp);
});
