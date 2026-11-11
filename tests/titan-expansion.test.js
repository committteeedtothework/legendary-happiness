import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import * as T from "three";
import {
  titanSession,
  stepTitan,
  titanInput,
  restoreTitanSession,
  retryTitan,
  TITAN_RING_TRAILS,
  TITAN_ROUTE,
} from "../src/giganto-simulation.js";
import { TitanPrelude } from "../src/titan-prelude.js";
import { TITAN_PRELUDE } from "../src/titan-prelude-data.js";
import {
  makeTitanLandscape,
  updateTitanLandscape,
  disposeTitanLandscape,
} from "../src/titan-landscape.js";
import { disposeTitanObject } from "../src/giganto-models.js";
import { titanFoleySamples } from "../src/titan-foley.js";
test("golden ring clusters award real capped resources once, persist pickup IDs and cannot advance the ascent from underneath a pad", () => {
  const s = titanSession({ cinematics: false });
  s.original = { player: {} };
  assert.equal(s.rings, 80);
  const r = TITAN_RING_TRAILS[0];
  Object.assign(s.avatar, { x: r.x, y: 0, z: r.z, onGround: true });
  stepTitan(s, {}, 1 / 60);
  assert.equal(s.rings, 90);
  assert.deepEqual(s.ringPickups, [0]);
  stepTitan(s, {}, 1 / 60);
  assert.equal(s.rings, 90);
  const saved = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(saved.ringPickups, [0]);
  stepTitan(saved, {}, 1 / 60);
  assert.equal(saved.rings, 90);
  saved.rings = saved.config.rings;
  const next = TITAN_RING_TRAILS[1];
  Object.assign(saved.avatar, { x: next.x, y: 0, z: next.z, onGround: true });
  stepTitan(saved, {}, 1 / 60);
  assert.deepEqual(saved.ringPickups, [0]);
  const under = titanSession({ cinematics: false });
  Object.assign(under.avatar, { x: 0, y: 0, z: 59, onGround: true });
  stepTitan(under, {}, 1 / 60);
  assert.equal(under.route, 0);
});
test("collected rings carry into Super form without a free refill and checkpoints retain the best prepared amount", () => {
  const s = titanSession({ cinematics: false });
  s.rings = 270;
  s.stage = "transform";
  s.emerald = true;
  s.checkpoint = "combat";
  s.original = { player: {} };
  titanInput(s, "skip");
  assert.equal(s.rings, 270);
  assert.equal(s.preparedRings, 270);
  s.rings = 0;
  s.stage = "defeat";
  retryTitan(s);
  assert.equal(s.rings, 270);
  assert.equal(s.stage, "combat");
  s.ringPickups = [0, 0, -2, 999];
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(restored.ringPickups, [0]);
});
test("the 120,000 HP boss rewards stronger timed attacks and retains legacy proportional migration through a complete fight", () => {
  const s = titanSession({ cinematics: false });
  s.rings = 400;
  s.stage = "transform";
  s.emerald = true;
  titanInput(s, "skip");
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  const hp = s.hp;
  titanInput(s, "hit");
  assert.equal(s.hp, hp);
  for (let i = 0; i < 15; i++) stepTitan(s, {}, 1 / 60);
  assert.equal(hp - s.hp, 180);
  const moves = new Set();
  for (
    let i = 0;
    i < 60 * 400 && s.stage !== "victory" && s.stage !== "defeat";
    i++
  ) {
    if (s.qte && i % 5 === 0) titanInput(s, "jump");
    if (i % 5 === 0) for (const a of ["boom", "rush", "loop"]) titanInput(s, a);
    const p = s.avatar,
      dx = s.boss.x + Math.sin(s.boss.yaw) * 5 - p.x,
      dz = s.boss.z + Math.cos(s.boss.yaw) * 5 - p.z,
      d = Math.hypot(dx, dz);
    if (d > 1) p.yaw = Math.atan2(-dx, -dz);
    stepTitan(
      s,
      { hit: true, parry: true, forward: d > 1, up: p.y < 56, down: p.y > 58 },
      1 / 60,
    );
    if (s.attack !== "idle") moves.add(s.attack);
  }
  assert.equal(
    s.stage,
    "victory",
    JSON.stringify({ hp: s.hp, time: s.time, rings: s.rings }),
  );
  assert.equal(s.phase, 2);
  assert.ok(s.time > 40 && s.time < 180, `combat time ${s.time}`);
  assert.ok(
    moves.size >= 3 && (moves.has("beam") || moves.has("pulse")),
    JSON.stringify([...moves]),
  );
  const legacy = titanSession();
  legacy.original = {};
  delete legacy.balance;
  legacy.maxHp = 2600;
  legacy.hp = 1300;
  const restored = restoreTitanSession(legacy);
  assert.equal(restored.maxHp, 120000);
  assert.equal(restored.hp, 60000);
});
test("the supplied pre-fight MP3 is embedded unchanged and native media pauses, loops and releases as combat begins", async () => {
  const b = fs.readFileSync(
    new URL("../public/audio/giganto/titan-giganto.mp3", import.meta.url),
  );
  assert.deepEqual(Buffer.from(TITAN_PRELUDE.src.split(",")[1], "base64"), b);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    TITAN_PRELUDE.sha256,
  );
  let media;
  const node = () => ({ connect() {}, disconnect() {} }),
    context = {
      currentTime: 0,
      state: "running",
      createGain() {
        return {
          ...node(),
          gain: {
            value: 0,
            cancelAndHoldAtTime() {},
            linearRampToValueAtTime(v) {
              this.value = v;
            },
          },
        };
      },
      createMediaElementSource() {
        return node();
      },
    };
  const pre = new TitanPrelude(context, node(), {
    createMedia: () =>
      (media = {
        paused: true,
        currentTime: 0,
        play() {
          this.paused = false;
          return Promise.resolve();
        },
        pause() {
          this.paused = true;
        },
        removeAttribute() {
          this.src = "";
        },
        load() {},
      }),
  });
  const s = titanSession({ cinematics: false }),
    settings = { musicEnabled: true, volume: 0.7, musicVolume: 0.4 };
  pre.update(s, true, settings);
  await Promise.resolve();
  assert.equal(media.loop, true);
  assert.equal(media.paused, false);
  media.currentTime = 41;
  pre.update(s, false, settings);
  assert.equal(media.paused, true);
  pre.update(s, true, settings);
  await Promise.resolve();
  assert.equal(media.currentTime, 41);
  s.stage = "combat";
  pre.update(s, true, settings);
  assert.equal(pre.player.media, null);
  assert.equal(media.src, "");
  pre.dispose();
});
test("the detailed landscape batches grass, ring trails, rock and forest geometry and keeps all effect matrices finite", () => {
  const scene = makeTitanLandscape(TITAN_ROUTE, 2);
  const s = titanSession({ cinematics: false });
  s.ringPickups = [0];
  s.phase = 2;
  s.time = 30;
  updateTitanLandscape(scene, s, 0.016);
  let calls = 0,
    triangles = 0;
  scene.traverse((o) => {
    if (o.isMesh) {
      calls++;
      const p = o.geometry.attributes.position;
      assert.ok(p.array.every(Number.isFinite));
      triangles +=
        ((o.geometry.index?.count || p.count) / 3) *
        (o.isInstancedMesh ? o.count : 1);
      if (o.isInstancedMesh)
        assert.ok(o.instanceMatrix.array.every(Number.isFinite));
    }
  });
  assert.ok(calls < 40, `${calls} calls`);
  assert.ok(triangles < 500000, `${triangles} triangles`);
  assert.equal(scene.userData.ringMesh.count, 360);
  assert.equal(scene.userData.debris.visible, true);
  s.stage = "combat";
  s.avatar.y = 100;
  updateTitanLandscape(scene, s, 0.016);
  assert.equal(scene.userData.ringMesh.visible, false);
  assert.equal(scene.userData.blades.visible, false);
  disposeTitanLandscape(scene);
  disposeTitanObject(scene);
});
test("original Foley variants are bounded, distinct and click-free for metal, creature, wind and ring cues", () => {
  for (const type of [
    "hit",
    "impact",
    "telegraph",
    "parry",
    "counter",
    "ring",
    "emerald",
    "beam",
    "grab",
    "pulse",
    "stage",
    "dodge",
    "jump",
    "boom",
    "rush",
    "loop",
    "qte-win",
  ]) {
    const a = titanFoleySamples(type, 16000, 0),
      b = titanFoleySamples(type, 16000, 1);
    assert.equal(a[0], 0);
    assert.equal(a.at(-1), 0);
    assert.ok(a.every(Number.isFinite));
    assert.ok(a.some((v) => Math.abs(v) > 0.01));
    assert.ok(a.every((v) => Math.abs(v) <= 0.76));
    assert.notDeepEqual(a, b);
  }
});

test("special moves finish their poses before another offensive move can replace them, while defensive dodge remains responsive", () => {
  const s = titanSession({ cinematics: false, drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  s.energy = 100;
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  assert.equal(titanInput(s, "loop"), true);
  assert.equal(titanInput(s, "hit"), false);
  assert.equal(titanInput(s, "boom"), false);
  assert.equal(s.action, "loop");
  assert.equal(titanInput(s, "dodge"), true);
  assert.equal(s.action, "dodge");
  for (let i = 0; i < 210; i++) stepTitan(s, {}, 1 / 60);
  assert.equal(titanInput(s, "hit"), true);
});
