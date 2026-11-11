import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  titanConfig,
  restoreTitanSession,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import { TITAN_DAMAGE } from "../src/titan-combat.js";
import {
  nearestTitanSurface,
  sweptTitanContact,
  titanArmPath,
  titanFinalePosition,
} from "../src/titan-contact.js";
const ticks = (s, n, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / 60);
    events.push(...s.events);
  }
  return events;
};
const fight = (config = {}) => {
  const s = titanSession({ cinematicPace: 1, cinematics: false, drain: 0, ...config });
  s.rings = 400;
  s.emerald = true;
  s.stage = "transform";
  titanInput(s, "skip");
  s.idle = 999;
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  return s;
};
test("damage values and boss-health scale are independently configurable, bounded, and save compatible", () => {
  const c = titanConfig({
    healthMultiplier: 99,
    damage: { basic: 65, counter: Infinity, boom: -9 },
  });
  assert.equal(c.healthMultiplier, 2);
  assert.equal(c.damage.basic, 65);
  assert.equal(c.damage.counter, 1900);
  assert.equal(c.damage.boom, 1);
  assert.deepEqual(titanConfig().damage, TITAN_DAMAGE);
  assert.equal(titanSession(c).maxHp, 240000);
  const s = fight(c);
  s.original = {};
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.config.damage.basic, 65);
  assert.equal(r.maxHp, 240000);
});
test("melee damage waits for contact, rejects repeated activation, and four successful attacks form a distinct bounded combo", () => {
  const s = fight(),
    events = [];
  for (const expected of [180, 235, 360, 760]) {
    const hp = s.hp;
    assert.ok(titanInput(s, "hit"));
    assert.equal(s.hp, hp);
    for (let i = 0; i < 30; i++) assert.equal(titanInput(s, "hit"), false);
    events.push(...ticks(s, 7));
    assert.equal(s.hp, hp);
    events.push(...ticks(s, 40));
    assert.equal(hp - s.hp, expected);
  }
  assert.deepEqual(
    events.filter((e) => e.type === "hit").map((e) => e.kind),
    ["basic", "combo", "heavy", "finisher"],
  );
  assert.equal(
    new Set(events.filter((e) => e.type === "hit").map((e) => e.serial)).size,
    4,
  );
});
test("torso, head, forearms and legs accept reachable attacks; whiffs cannot teleport or damage from across the arena", () => {
  for (const p of [
    { x: 0, y: 57, z: 5 },
    { x: 0, y: 85, z: 23 },
    { x: 18, y: 35, z: 0 },
    { x: 15, y: 20, z: -5 },
  ]) {
    const s = fight();
    Object.assign(s.avatar, p);
    const hp = s.hp;
    assert.ok(nearestTitanSurface(s, { ...p, y: p.y + 1.8 }).distance <= 6.5);
    titanInput(s, "hit");
    ticks(s, 25);
    assert.ok(s.hp < hp, JSON.stringify(p));
  }
  for (const move of ["hit", "boom", "rush", "loop"]) {
    const s = fight();
    Object.assign(s.avatar, { x: 0, y: 57, z: 125 });
    const hp = s.hp,
      before = { ...s.avatar };
    titanInput(s, move);
    if (move !== "rush") assert.deepEqual(s.avatar, before);
    ticks(s, 110);
    assert.equal(s.hp, hp, move);
    assert.equal(s.stagger, 0, move);
  }
  const s = fight();
  s.avatar.yaw = Math.PI;
  s.lock = false;
  titanInput(s, "hit");
  ticks(s, 30);
  assert.equal(s.hp, s.maxHp);
});
test("relative sweeps catch fast crossings and moving limbs without extending the attack reach", () => {
  const s = fight();
  assert.ok(
    sweptTitanContact(s, { x: 35, y: 20, z: -5 }, { x: -35, y: 20, z: -5 }, 2),
  );
  assert.equal(
    sweptTitanContact(s, { x: 90, y: 20, z: 80 }, { x: 100, y: 20, z: 80 }, 6),
    null,
  );
  s.attack = "swing";
  s.attackTime = 1.85;
  const a = titanArmPath(s, "L", 1.8),
    b = titanArmPath(s, "L", 1.85);
  const p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  assert.ok(sweptTitanContact(s, p, p, 1, 1.8));
});
test("lock-on never overwrites yaw; ordinary offensive actions allow horizontal/vertical movement and dodge cancels pending damage", () => {
  for (const move of ["hit", "boom", "rush"]) {
    const s = fight();
    Object.assign(s.avatar, { x: 60, y: 44, z: 60, yaw: 0.6 });
    titanInput(s, move);
    const p = { ...s.avatar };
    ticks(s, 8, { right: true, up: true, boost: true });
    assert.equal(s.avatar.yaw, 0.6);
    assert.ok(s.avatar.y > p.y);
    assert.ok(Math.hypot(s.avatar.x - p.x, s.avatar.z - p.z) > 0.2);
    titanInput(s, "dodge");
    assert.equal(s.strike, null);
    assert.equal(s.action, "dodge");
    ticks(s, 110);
    assert.equal(s.hp, s.maxHp);
  }
  const s = fight();
  titanInput(s, "target");
  assert.equal(s.lock, false);
  titanInput(s, "target");
  assert.equal(s.lock, true);
  Object.assign(s.avatar, { x: 80, y: 0.05, z: 60, onGround: true });
  titanInput(s, "jump");
  ticks(s, 5, { up: true });
  assert.ok(s.avatar.y > 0.2);
});
test("Wild Rush consumes at most three timed contacts and never assigns a fixed world destination", () => {
  const s = fight();
  Object.assign(s.avatar, { x: 35, y: 55, z: 8 });
  const before = { ...s.avatar };
  assert.ok(titanInput(s, "rush"));
  assert.deepEqual(s.avatar, before);
  const e = ticks(s, 70);
  const hits = e.filter((e) => e.type === "hit");
  assert.ok(hits.length > 0 && hits.length <= 3);
  assert.ok(s.maxHp - s.hp <= 1620);
  assert.equal(new Set(hits.map((e) => e.serial)).size, 1);
});
test("perfect timing produces a stronger counter than held guard; the counter lands at animation contact", () => {
  for (const perfect of [false, true]) {
    const s = fight();
    s.attack = "swing";
    s.avatar.z = 18;
    s.attackTime = 1.5;
    s.iframes = 0;
    if (!perfect) {
      s.parryHeld = true;
      s.parryAge = 2;
    }
    if (perfect) ticks(s, 14);
    const e = ticks(s, 35, { parry: true });
    assert.ok(
      e.some((e) => e.type === "parry"),
      JSON.stringify(e),
    );
    assert.equal(s.perfectCounter, perfect);
    const hp = s.hp;
    titanInput(s, "hit");
    assert.equal(s.hp, hp);
    const contacts=ticks(s,100).filter(e=>e.type==='hit'&&e.kind===(perfect?'perfectCounter':'counter'));
    assert.equal(contacts.length,1);
    assert.equal(contacts[0].amount,perfect?2900:1900);
    assert.equal(s.counter,0);
  }
});
test("arm attacks have readable windups, one contact, and avoidable vertical/dodge paths; targeted beam and grab can miss", () => {
  for (const move of ["swing", "slap"]) {
    const s = fight();
    s.attack = move;
    s.avatar.z = 18;
    s.iframes = 0;
    const rings = s.rings;
    ticks(s, Math.floor(TITAN_MOVES[move].tell * 60) - 1);
    assert.equal(s.rings, rings);
    const e = ticks(s, 55);
    assert.equal(e.filter((e) => e.type === "impact").length, 1);
    assert.ok(s.rings < rings);
    const high = fight();
    high.attack = move;
    high.iframes = 0;
    high.avatar.y = 115;
    assert.equal(ticks(high, 160).filter((e) => e.type === "impact").length, 0);
  }
  for (const move of ["beam", "crunch"]) {
    const s = fight();
    s.phase = 2;
    s.attack = move;
    s.attackAim = { x: 0, y: 57, z: 5 };
    s.attackTime = TITAN_MOVES[move].tell - 0.01;
    Object.assign(s.avatar, { x: 65, y: 100, z: 70 });
    ticks(s, 3);
    assert.equal(s.qte, null, move);
  }
});
test("Cyloop cannot remotely interrupt attacks or perpetually renew stagger, while ordinary hits never stagger", () => {
  const s = fight();
  s.attack = "swing";
  s.attackTime = 0.2;
  Object.assign(s.avatar, { x: 0, y: 57, z: 120 });
  titanInput(s, "loop");
  ticks(s, 55);
  assert.equal(s.stagger, 0);
  assert.equal(s.attack, "swing");
  const close = fight();
  titanInput(close, "loop");
  ticks(close, 180);
  assert.ok(close.stagger > 0);
  const until = close.staggerRest;
  assert.ok(until > 10);
  ticks(close, 20);
  close.energy = 100;
  close.cooldowns.loop = 0;
  assert.equal(titanInput(close, "loop"), false); // No second charge earned.
  ticks(close, 230);
  assert.equal(close.stagger, 0);
  assert.ok(close.staggerRest > 0);
  const basic = fight();
  titanInput(basic, "hit");
  ticks(basic, 20);
  assert.equal(basic.stagger, 0);
});
test("transformation rises over the head before descending; skips and phase resumes leave input and resources safe", () => {
  const s = fight({ cinematics: true });
  s.stage = "transform";
  s.stageTime = 0;
  s.cinematicFrom = null;
  Object.assign(s.avatar, { x: 0, y: 92, z: 0 });
  let old = { ...s.avatar },
    highest = 0;
  const rings = s.rings;
  for (let i = 0; i < 359; i++) {
    stepTitan(s, { hit: true }, 1 / 60);
    const p = s.avatar;
    assert.ok(Math.hypot(p.x - old.x, p.y - old.y, p.z - old.z) < 2);
    highest = Math.max(highest, p.y);
    old = { ...p };
  }
  assert.ok(highest > 103);
  assert.equal(s.rings, rings);
  stepTitan(s, {}, 1 / 60);
  ticks(s, 2);
  assert.equal(s.stage, "combat");
  const p = { ...s.avatar };
  ticks(s, 15, { right: true, up: true });
  assert.ok(s.avatar.x > p.x && s.avatar.y > p.y);
  for (const stage of ["intro", "transform", "phase", "finale"]) {
    const a = fight();
    a.stage = stage;
    const hp = a.hp,
      r = a.rings;
    ticks(a, 20);
    assert.equal(a.hp, hp);
    assert.equal(a.rings, r);
    titanInput(a, "skip");
    assert.ok(["traversal", "combat", "victory"].includes(a.stage));
    assert.equal(a.qte, null);
  }
});
test("saved windups resume safely without replaying a scheduled strike or awarding duplicate damage", () => {
  const s = fight();
  s.original = {};
  titanInput(s, "rush");
  ticks(s, 17);
  s.avatar.y = 129;
  const saved = JSON.parse(JSON.stringify(s)),
    hp = s.hp;
  const r = restoreTitanSession(saved);
  assert.equal(r.strike, null);
  assert.equal(r.hp, hp);
  assert.equal(r.avatar.y, 129);
  assert.ok(r.iframes >= 2);
  ticks(r, 60);
  assert.equal(r.hp, hp);
  assert.equal(r.avatar.y, 129);
});

test("feet preserve floor clearance, and the finale remains clear until its intended chest contact", () => {
  const s = fight();
  Object.assign(s.avatar, { x: 5, y: 0.05, z: -3, onGround: true });
  stepTitan(s, {}, 1 / 60);
  assert.ok(Math.hypot(s.avatar.x - 4.84, s.avatar.z + 6.02) > 5);
  for (let i = 0; i < 60; i++) {
    stepTitan(s, { right: true }, 1 / 60);
    assert.ok(s.avatar.y >= 0.05);
    assert.ok(
      Object.values(s.avatar).every(
        (v) => typeof v !== "number" || Number.isFinite(v),
      ),
    );
  }
  for (const from of [
    { x: 0, y: 57, z: 5 },
    { x: 0, y: 57, z: -25 },
    { x: -40, y: 70, z: -10 },
    { x: 0, y: 108, z: 0 },
  ]) {
    let previous = from;
    for (let i = 0; i <= 228; i++) {
      const p = titanFinalePosition(from, i / 60);
      if (i / 60 < 3.55)
        assert.ok(
          nearestTitanSurface(s, { ...p, y: p.y + 1.8 }).distance > 0.5,
        );
      assert.ok(
        Math.hypot(p.x - previous.x, p.y - previous.y, p.z - previous.z) < 5,
      );
      previous = p;
    }
  }
});
