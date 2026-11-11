import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
  retryTitan,
} from "../src/giganto-simulation.js";
import {
  TITAN_HEALTH,
  TITAN_BALANCE,
  upgradeTitanCombat,
} from "../src/titan-balance.js";
import { TITAN_ACTIONS } from "../src/titan-combat.js";
import { TITAN_BOSS_POWER, titanBossImpact } from "../src/titan-boss-power.js";
import {
  titanMoveShot,
  titanCameraTransport,
} from "../src/titan-move-camera.js";
import { titanShotKey } from "../src/titan-shot-flow.js";
import {
  titanCanopy,
  titanLeafAtlas,
  titanTreeBranches,
} from "../src/titan-foliage-shapes.js";
import { titanFoleySamples } from "../src/titan-foley.js";
const ticks = (s, n, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / 60);
    events.push(...s.events);
  }
  return events;
};
function fight() {
  const s = titanSession({
    cinematics: false,
    drain: 0,
    bossMobility: false,
    adaptiveBoss: false,
  });
  s.stage = "transform";
  s.emerald = true;
  titanInput(s, "skip");
  s.idle = 999;
  s.rings = 400;
  Object.assign(s.avatar, {
    x: 0,
    y: 57,
    z: 5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  });
  return s;
}
test("health increases independently; revision-five saves preserve health fraction and custom attack values exactly once, including the largest configured boss", () => {
  assert.equal(titanSession().maxHp, 120000);
  for (const d of ["easy", "normal", "hard"])
    assert.equal(titanSession({ difficulty: d }).maxHp, TITAN_HEALTH[d]);
  const s = fight();
  s.original = {};
  s.balance = 5;
  s.config.combatRevision = 5;
  s.config.damage.basic = 360;
  s.maxHp = 48000;
  s.hp = 12000;
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.maxHp, 120000);
  assert.equal(r.hp, 30000);
  assert.equal(r.config.damage.basic, 360);
  assert.equal(r.balance, TITAN_BALANCE);
  assert.deepEqual(upgradeTitanCombat(r.config), r.config);
  assert.equal(restoreTitanSession(JSON.parse(JSON.stringify(r))).hp, 30000);
  const large = titanSession({ difficulty: "hard", healthMultiplier: 2 });
  large.original = {};
  large.hp = 288000;
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(large)));
  assert.equal(restored.maxHp, 320000);
  assert.equal(restored.hp, 288000);
});
test("buffered confirmed melee chains shorten recovery without duplicate contacts or free attacks", () => {
  const s = fight();
  titanInput(s, "hit");
  assert.equal(titanInput(s, "hit"), false);
  const events = ticks(s, 7);
  assert.equal(titanInput(s, "hit"), true);
  assert.equal(s.strike.serial, 1);
  events.push(...ticks(s, 7));
  assert.equal(s.strike.serial, 2);
  assert.equal(s.strike.kind, "combo");
  assert.equal(events.filter((e) => e.type === "hit").length, 1);
  events.push(...ticks(s, 30));
  assert.deepEqual(
    events.filter((e) => e.type === "hit").map((e) => e.kind),
    ["basic", "combo"],
  );
  assert.equal(s.maxHp - s.hp, 180 + 235);
  assert.equal(s.queuedMove, null);
});
test("explicit special intent survives held attack input; multihit moves finish every emission before a chained special and retain costs without Super cooldowns", () => {
  const s = fight();
  titanInput(s, "hit");
  ticks(s, 7);
  assert.ok(titanInput(s, "boom"));
  let events = ticks(s, 8, { hit: true });
  assert.equal(s.strike.move, "boom");
  assert.equal(s.cooldowns.boom,0);
  events.push(...ticks(s, 44));
  assert.ok(titanInput(s, "cross"));
  events.push(...ticks(s, 25));
  assert.equal(events.filter((e) => e.type === "boom").length, 4);
  assert.ok(
    events.some((e) => e.type === "attack-start" && e.kind === "cross"),
  );
  assert.equal(s.cooldowns.cross,0);
  assert.equal(s.energy, undefined);
  assert.equal(titanInput(s, "boom"), false);
  const serials = events
    .filter((e) => e.type === "attack-start")
    .map((e) => e.eventId);
  assert.equal(new Set(serials).size, serials.length);
});
test("whiffs cannot cancel their windup; dodge and retry discard queued intent", () => {
  const s = fight();
  s.avatar.z = 120;
  titanInput(s, "hit");
  ticks(s, 8);
  titanInput(s, "boom");
  ticks(s, 7);
  assert.equal(s.strike.move, "punch");
  assert.equal(s.strike.serial, 1);
  assert.equal(s.hp, s.maxHp);
  assert.ok(titanInput(s, "dodge"));
  assert.equal(s.queuedMove, null);
  assert.equal(s.strike, null);
  assert.equal(s.energy, undefined);
  const r = fight();
  titanInput(r, "hit");
  ticks(r, 7);
  titanInput(r, "boom");
  assert.ok(r.queuedMove);
  retryTitan(r);
  assert.equal(r.queuedMove, null);
});
test("boss impacts scale by attack, difficulty, phase and isolated power setting, while defensive windows stay unchanged", () => {
  const s = fight();
  assert.equal(titanBossImpact(s, "swing").ringLoss, 26);
  assert.equal(titanBossImpact(s, "swat").ringLoss, 30);
  s.phase = 2;
  assert.ok(
    titanBossImpact(s, "uppercut").ringLoss >
      titanBossImpact(s, "pulse").ringLoss,
  );
  for (const difficulty of ["easy", "normal", "hard"]) {
    s.config.difficulty = difficulty;
    s.phase = 1;
    assert.equal(
      titanBossImpact(s, "swing").ringLoss,
      TITAN_BOSS_POWER[difficulty],
    );
  }
  s.config.bossPower = 0.5;
  assert.equal(titanBossImpact(s, "swing").ringLoss, 19);
  assert.equal(TITAN_ACTIONS.punch.contacts[0], 0.13);
  assert.equal(TITAN_ACTIONS.loop.cost, undefined); // Dedicated hit-filled Cyloop charges.
});
test("each move shot follows live Sonic coordinates, keeps Sonic the focus and transports the camera at 30/60/144 Hz without changing the simulation", () => {
  for (const fps of [30, 60, 144]) {
    const s = fight(),
      h = {};
    titanCameraTransport(h, s);
    for (const move of Object.keys(TITAN_ACTIONS)) {
      s.strike = { move, serial: 3, orbit: { center: { x: 0, z: -7.5 } } };
      const before = JSON.stringify(s);
      const q = titanMoveShot(s);
      assert.equal(JSON.stringify(s), before);
      assert.ok(q);
      assert.ok(
        Math.hypot(q.target.x - s.avatar.x, q.target.z - s.avatar.z) < 1,
      );
      assert.match(titanShotKey(s, null), /^move:3:/);
      const old = { ...s.avatar };
      s.avatar.x += 24 / fps;
      s.avatar.y += 8 / fps;
      const d = titanCameraTransport(h, s);
      assert.ok(Math.abs(d.x - (s.avatar.x - old.x)) < 1e-9);
      assert.ok(Math.abs(d.y - 8 / fps) < 1e-9);
      assert.ok(Object.values(q.position).every(Number.isFinite));
    }
    s.stage = "phase";
    assert.equal(titanMoveShot(s), null);
    assert.deepEqual(titanCameraTransport(h, s), { x: 0, y: 0, z: 0 });
    s.stage = "combat";
    assert.deepEqual(titanCameraTransport(h, s), { x: 0, y: 0, z: 0 });
    s.avatar.x += 100;
    assert.deepEqual(titanCameraTransport(h, s), { x: 0, y: 0, z: 0 });
    s.config.moveCamera = false;
    assert.equal(titanMoveShot(s), null);
    assert.equal(titanShotKey(s, null), "gameplay");
  }
});
test("cutout foliage has individual transparent leaf silhouettes, finite normals and stable bounded detail levels", () => {
  const t = titanLeafAtlas(),
    a = t.image.data;
  let solid = 0,
    clear = 0;
  for (let i = 3; i < a.length; i += 4) {
    if (a[i] > 128) solid++;
    if (a[i] === 0) clear++;
  }
  assert.ok(solid > 3000 && clear > 30000);
  assert.equal(t.generateMipmaps, true);
  const low = titanCanopy(12, 8),
    high = titanCanopy(24, 16),
    trunk = titanTreeBranches();
  assert.ok(high.attributes.position.count > low.attributes.position.count);
  assert.ok(high.attributes.position.count <= 880);
  for (const g of [low, high, trunk]) {
    assert.ok(g.attributes.position.array.every(Number.isFinite));
    assert.ok(g.attributes.normal.array.every(Number.isFinite));
    g.dispose();
  }
  assert.equal(low.index.count, low.userData.leafCards * 6);
  t.dispose();
});
test("heavy Titan impact audio is original, finite, distinct from ordinary hits and has a bounded bass tail with silent edges", () => {
  const a = titanFoleySamples("titan-impact", 24000),
    b = titanFoleySamples("impact", 24000);
  assert.equal(a.length, Math.ceil(24000 * 1.1));
  assert.notDeepEqual(a, b);
  assert.equal(a[0], 0);
  assert.equal(a.at(-1), 0);
  assert.ok(a.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.75));
  assert.ok(a.slice(15000, 21000).some((v) => Math.abs(v) > 0.01));
});
