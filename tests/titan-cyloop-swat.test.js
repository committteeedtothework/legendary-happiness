import { makeTitanCyloopGeometry } from "../src/giganto-view.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import { TITAN_CYLOOP } from "../src/titan-cyloop.js";
import { TitanBoostAudio } from "../src/titan-boost.js";
import { TITAN_BOOST } from "../src/titan-boost-data.js";
const fight = () => {
  const s = titanSession({ cinematics: false, drain: 0 });
  s.rings = 400;
  s.emerald = true;
  s.stage = "transform";
  titanInput(s, "skip");
  s.idle = 999;
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  return s;
};
const ticks = (s, n, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / 60);
    events.push(...s.events);
  }
  return events;
};
test("E carries the physical avatar through a continuous full 360-degree circle and stays at closure; damage occurs once after closure", () => {
  const s = fight(),
    start = { ...s.avatar },
    events = [];
  assert.ok(titanInput(s, "loop"));
  assert.equal(s.strike.duration, 3.1);
  assert.deepEqual(s.avatar, start);
  let angle = 0,
    previousAngle = null,
    last = { ...s.avatar };
  for (let i = 0; i < 195; i++) {
    stepTitan(s, { right: true, up: true, boost: true }, 1 / 60);
    events.push(...s.events);
    if (s.strike?.elapsed < TITAN_CYLOOP.contact - 0.02)
      assert.equal(s.hp, s.maxHp);
    if (
      s.strike?.elapsed >= TITAN_CYLOOP.approach &&
      s.strike.elapsed <= TITAN_CYLOOP.contact
    ) {
      const a = Math.atan2(s.avatar.x, s.avatar.z + 7.5);
      if (previousAngle !== null)
        angle += Math.atan2(
          Math.sin(a - previousAngle),
          Math.cos(a - previousAngle),
        );
      previousAngle = a;
      assert.ok(Math.abs(Math.hypot(s.avatar.x, s.avatar.z + 7.5) - 48) < 0.01);
    }
    assert.ok(
      Math.hypot(
        s.avatar.x - last.x,
        s.avatar.y - last.y,
        s.avatar.z - last.z,
      ) < 3,
    );
    last = { ...s.avatar };
    if (!s.strike) break;
  }
  assert.ok(angle > 6.18 && angle < 6.3, `radians ${angle}`);
  assert.equal(s.maxHp - s.hp, 1400);
  assert.equal(events.filter((e) => e.type === "hit").length, 1);
  assert.ok(
    Math.hypot(
      Math.hypot(s.avatar.x, s.avatar.z + 7.5) - 48,
      s.avatar.y - start.y,
    ) < 0.02,
  );
  assert.equal(s.strike, null);
});
test("dodge cancels a partial Cyloop with no closure damage, restores steering, and remote activation is rejected", () => {
  const s = fight();
  titanInput(s, "loop");
  ticks(s, 65);
  const before = { ...s.avatar };
  assert.ok(titanInput(s, "dodge"));
  assert.equal(s.strike, null);
  ticks(s, 150, { forward: true, up: true });
  assert.equal(s.hp, s.maxHp);
  assert.ok(Math.hypot(s.avatar.x - before.x, s.avatar.z - before.z) > 4);
  assert.ok(s.avatar.y > before.y);
  const far = fight();
  far.avatar.z = 125;
  const energy = far.energy;
  assert.equal(titanInput(far, "loop"), false);
  assert.equal(far.energy, energy);
});
test("the orbital segment is protected from incidental dorsal lasers; interrupted saves do not replay the orbit or its damage", () => {
  const s = fight();
  s.phase = 2;
  titanInput(s, "loop");
  ticks(s, 90);
  s.original = {};
  const saved = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.strike, null);
  assert.equal(saved.boosting, false);
  assert.equal(saved.knockback, null);
  const hp = saved.hp;
  ticks(saved, 190);
  assert.equal(saved.hp, hp);
  const e = ticks(s, 110);
  assert.equal(e.filter((x) => x.type === "impact").length, 0);
  assert.equal(s.rings, 400);
  assert.equal(s.maxHp - s.hp, 1400);
});
test("Giganto selects a readable close-range swat and sends an unguarded attacker outward despite opposite steering", () => {
  const s = fight();
  s.idle = 0;
  s.sequence = 7;
  s.iframes = 0;
  stepTitan(s, {});
  assert.ok(
    ["swat", "spin", "uppercut", "sweep", "swing", "slap"].includes(s.attack),
  );
  s.attack = "swat";
  assert.ok(s.events.some((e) => e.type === "telegraph"));
  ticks(s, 70);
  assert.equal(s.rings, 400);
  let impacts = 0,
    hitPosition = null,
    peak = 0;
  for (let i = 0; i < 90; i++) {
    stepTitan(s, hitPosition ? { forward: true, down: true } : {});
    for (const e of s.events)
      if (e.type === "impact") {
        impacts++;
        hitPosition = { ...s.avatar };
        assert.equal(e.swat, true);
      }
    if (hitPosition) peak = Math.max(peak, s.avatar.z - hitPosition.z);
  }
  assert.equal(impacts, 1);
  assert.equal(s.rings, 370);
  assert.ok(hitPosition);
  assert.ok(peak > 8, `outward travel ${peak}`);
  assert.ok(s.avatar.y >= 0.05);
});
test("swats can be parried, dodged or escaped, are not global damage and do not add new attacks at unreachable heights", () => {
  for (const defense of ["parry", "dodge", "escape"]) {
    const s = fight();
    s.attack = "swat";
    s.swatSide = "L";
    s.attackAim = { x: 0, y: 57, z: 5 };
    s.iframes = 0;
    if (defense === "dodge") {
      ticks(s, 70);
      titanInput(s, "dodge");
    }
    const e = ticks(
      s,
      defense === "dodge" ? 50 : 120,
      defense === "parry"
        ? { parry: true }
        : defense === "escape"
          ? { back: true, boost: true }
          : {},
    );
    assert.equal(e.filter((x) => x.type === "impact").length, 0, defense);
    assert.equal(s.knockback, null);
    if (defense === "parry")
      assert.ok(s.counter > 0 || e.some((x) => x.type === "parry"));
  }
  const high = fight();
  high.avatar.y = 129;
  high.idle = 0;
  high.sequence = 1;
  stepTitan(high, {});
  assert.notEqual(high.attack, "swat");
});
test("power boost flags real horizontal/vertical motion, has no energy limit and is silent at rest, in cinematics and after release", () => {
  const s = fight();
  ticks(s, 3, { boost: true });
  assert.equal(!!s.boosting, false);
  const energy = s.energy;
  ticks(s, 20, { boost: true, up: true });
  assert.equal(s.boosting, true);
  assert.equal(s.energy, undefined);
  stepTitan(s, {});
  assert.equal(!!s.boosting, false);
  s.stage = "phase";
  stepTitan(s, { boost: true, up: true });
  assert.equal(s.boosting, false);
  const original = fs.readFileSync(
    new URL("../public/audio/giganto/sonic-power-boost.mp3", import.meta.url),
  );
  assert.deepEqual(
    Buffer.from(TITAN_BOOST.src.split(",")[1], "base64"),
    original,
  );
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    TITAN_BOOST.sha256,
  );
});
function context() {
  const sources = [];
  let resolveDecode;
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx = {
    currentTime: 0,
    decodeAudioData() {
      return new Promise((r) => (resolveDecode = r));
    },
    createGain() {
      return {
        ...node(),
        gain: {
          value: 0,
          setValueAtTime(v) {
            this.value = v;
          },
          linearRampToValueAtTime(v) {
            this.value = v;
          },
          cancelScheduledValues() {},
        },
      };
    },
    createBufferSource() {
      const v = {
        ...node(),
        start() {
          this.started = true;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(v);
      return v;
    },
  };
  return {
    ctx,
    sources,
    resolve() {
      resolveDecode({ duration: 9.012245 });
    },
  };
}
test("the supplied boost clip decodes once, sustains without repeated layering, respects SFX controls and releases on pause/exit", async () => {
  const mock = context(),
    a = new TitanBoostAudio(mock.ctx, {}),
    s = fight(),
    settings = { volume: 0.6, musicEnabled: false };
  s.boosting = true;
  a.update(s, true, settings);
  await new Promise(setImmediate);
  mock.resolve();
  await a.pending;
  assert.equal(a.starts, 1);
  assert.equal(a.voice.source.loopStart, 3);
  assert.equal(a.voice.source.loopEnd, 8.8);
  for (let i = 0; i < 60; i++) a.update(s, true, settings);
  assert.equal(a.starts, 1);
  a.update(s, false, settings);
  assert.equal(a.voice, null);
  assert.ok(mock.sources[0].stopped);
  for (let i = 0; i < 20; i++) {
    a.update(s, true, settings);
    a.update(s, false, settings);
    assert.ok(a.voices.size <= 2);
  }
  a.update(s, true, { volume: 0 });
  assert.equal(a.voice, null);
  s.config.audio = false;
  a.update(s, true, settings);
  assert.equal(a.voice, null);
  a.dispose();
  assert.equal(a.voices.size, 0);
  assert.equal(a.buffer, null);
  assert.ok(mock.sources.every((v) => v.stopped));
  const delayed = context(),
    late = new TitanBoostAudio(delayed.ctx, {});
  s.config.audio = true;
  late.update(s, true, settings);
  late.dispose();
  await new Promise(setImmediate);
  delayed.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(late.starts, 0);
});

test("the blue circular trail grows by angle, so its first quarter covers only a quarter-revolution", () => {
  const g = makeTitanCyloopGeometry(),
    p = g.attributes.position,
    index = g.index.array;
  for (let i = 0; i < index.length / 4; i++) {
    const n = index[i];
    let a = Math.atan2(-p.getZ(n), p.getX(n));
    if (a < -0.0001) a += Math.PI * 2;
    assert.ok(a >= -0.0001 && a <= Math.PI / 2 + 0.0001, `angle ${a}`);
  }
  g.dispose();
});
