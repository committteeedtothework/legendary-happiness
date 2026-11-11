import { AudioEngine } from "../src/audio.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/world.js";
import { B, BLOCKS } from "../src/data.js";
import { snowColumn } from "../src/snow.js";
import { setWeather, tickWeather, restoreWeather } from "../src/weather.js";
import { createPlayer, collides, moveBody } from "../src/physics.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { meshChunk } from "../src/mesher.js";
import { blockBounds } from "../src/doors.js";
import {
  VOICE_PROFILES,
  voiceSamples,
  createVoiceBank,
} from "../src/voices.js";
import {
  EFFECT_PROFILES,
  effectSamples,
  createEffectBank,
} from "../src/effects-audio.js";
import {
  createHandRig,
  updateHandRig,
  fitHandGrip,
  createHeldModel,
} from "../src/first-person.js";
import { actionPose } from "../src/animation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const site = () => {
  const w = new World("weather");
  w.set(0, 200, 0, B.stone);
  return w;
};
test("snow layers accumulate to eight, target and collide at their actual surface, persist and melt without duplicating blocks", () => {
  const w = site();
  for (let n = 1; n <= 8; n++) {
    assert.equal(snowColumn(w, 0, 0, true, true), true);
    assert.equal(w.get(0, 201, 0), B[`snow_layer_${n}`]);
    assert.equal(blockBounds(w.get(0, 201, 0))[4], n / 8);
  }
  assert.equal(snowColumn(w, 0, 0, true, true), false);
  assert.equal(w.get(0, 202, 0), B.air);
  const restored = restoreRealm(
    w.seed,
    "overworld",
    exportRealm({ world: w, entities: [], drops: [] }),
  ).world;
  assert.equal(restored.get(0, 201, 0), B.snow_layer_8);
  for (let n = 7; n >= 0; n--) {
    snowColumn(restored, 0, 0, false, false);
    assert.equal(restored.get(0, 201, 0), n ? B[`snow_layer_${n}`] : B.air);
  }
  w.set(0, 201, 0, B.snow_layer_1);
  assert.equal(collides(w, { x: 0.5, y: 201.126, z: 0.5 }), false);
  assert.equal(collides(w, { x: 0.5, y: 201.12, z: 0.5 }), true);
  const hit = w.raycast({ x: 0.5, y: 202, z: 0.5 }, { x: 0, y: -1, z: 0 }, 3);
  assert.equal(hit.id, B.snow_layer_1);
  assert.equal(hit.distance, 0.875);
  const geometry = meshChunk(w, w.ensure(0, 0));
  assert.ok(geometry.some((g) => g?.position.some((y) => y === 201.125)));
  const p = { x: 1.5, y: 201, z: 0.5, onGround: true, vx: 0, vy: 0, vz: 0 };
  moveBody(w, p, -0.6, 0, 0);
  assert.equal(p.y, 201.125);
});
test("snow respects roofs, occupied cells, heat, support removal and unloaded chunks", () => {
  const w = site();
  assert.equal(snowColumn(w, 10000, 10000, true, true), false);
  assert.equal(
    snowColumn(w, 0, 0, true, true, [{ x: 0.5, y: 201, z: 0.5 }]),
    false,
  );
  w.set(0, 204, 0, B.planks);
  snowColumn(w, 0, 0, true, true);
  assert.equal(w.get(0, 201, 0), B.air);
  assert.equal(w.get(0, 205, 0), B.snow_layer_1);
  w.set(0, 204, 0, B.air);
  w.simulate();
  assert.equal(w.get(0, 205, 0), B.air);
  w.set(0, 201, 0, B.snow_layer_4);
  w.set(1, 201, 0, B.torch);
  snowColumn(w, 0, 0, true, true);
  assert.equal(w.get(0, 201, 0), B.snow_layer_3);
});
test("seeded natural tornado tracks cross the warning area, preserve buildings and save their exact path", () => {
  const w = new World("vortex"),
    p = createPlayer({ x: 8, y: 200, z: 8 }),
    g = {
      world: w,
      player: p,
      mode: "creative",
      difficulty: "normal",
      entities: [],
      drops: [],
    };
  const kinds = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const testWorld = new World("natural-storm-" + seed);
    testWorld.weather.remaining = 1;
    testWorld.tick = 1;
    tickWeather({ ...g, world: testWorld });
    kinds.add(testWorld.weather.kind);
  }
  assert.ok(kinds.has("tornado"));
  assert.ok(kinds.has("hail"));
  setWeather(w, "tornado");
  w.weather.intensity = 1;
  w.tick++;
  tickWeather(g);
  const start = Math.hypot(w.weather.funnel.x - p.x, w.weather.funnel.z - p.z),
    f = w.weather.funnel;
  for (let i = 0; i < 400; i++) {
    w.tick++;
    tickWeather(g);
  }
  assert.ok(Math.hypot(f.x - p.x, f.z - p.z) < start - 20);
  assert.deepEqual(restoreWeather(w.weather, w.seedInt), w.weather);
  setWeather(w, "clear");
  tickWeather(g);
  assert.equal(w.weather.funnel, null);
});
test("all creature identities and event articulations are distinct, bounded, click-free and cached lazily", () => {
  const audio = new AudioEngine({ volume: 1, mobVolume: 1 });
  audio.context = {};
  let chosen;
  audio.sample = (name) => (chosen = name);
  audio.mob("watcher", 0, "laugh");
  assert.equal(chosen, "watcher");
  const signatures = new Set();
  for (const type of Object.keys(VOICE_PROFILES))
    for (const kind of ["idle", "attack", "hurt", "death"]) {
      const d = voiceSamples(type, 8000, 0, kind);
      assert.ok(d.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.65));
      assert.equal(Math.abs(d[0]), 0);
      assert.ok(Math.abs(d.at(-1)) < 0.001);
      assert.ok(d.some((v) => Math.abs(v) > 0.01));
      signatures.add(d.length + ":" + d.slice(500, 600).join(","));
    }
  assert.equal(signatures.size, Object.keys(VOICE_PROFILES).length * 4);
  let made = 0;
  const c = {
    sampleRate: 48000,
    createBuffer(ch, n, rate) {
      made++;
      return { copyToChannel() {}, sampleRate: rate };
    },
  };
  const bank = createVoiceBank(c);
  assert.equal(made, 0);
  assert.equal(bank.zombie, bank.zombie);
  assert.equal(made, 3);
  assert.notEqual(bank["zombie:hurt"], bank.zombie);
  const fx = createEffectBank(c),
    before = made;
  assert.equal(fx.ui, fx.ui);
  assert.equal(made, before + 3);
});
test("original layered effects have finite bounds, varied material/event signatures and silent sample edges", () => {
  const signatures = new Set();
  for (const id of Object.keys(EFFECT_PROFILES)) {
    const d = effectSamples(id, 8000);
    assert.ok(d.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8));
    assert.equal(Math.abs(d[0]), 0);
    assert.ok(Math.abs(d.at(-1)) < 0.005);
    assert.ok(d.some((v) => Math.abs(v) > 0.015));
    assert.notDeepEqual(d, effectSamples(id, 8000, 1));
    signatures.add(d.length + ":" + d.slice(100, 200).join(","));
  }
  assert.equal(signatures.size, Object.keys(EFFECT_PROFILES).length);
});
test("grip profiles keep rigid item sockets and the entire wrist clear of the near plane through every action", () => {
  const restore = mockCanvas();
  try {
    for (const id of [
      "wooden_sword",
      "diamond_spear",
      "hellfire_pickaxe",
      "devin_sword",
      "stone",
      "flint_and_steel",
      "apple",
      "saint_corpse_part",
      "matthew_dual_pistols",
    ]) {
      const rig = createHandRig(),
        model = createHeldModel(id, {
          texture: new THREE.Texture(),
          pack: "renewed",
        });
      rig.grip.add(model);
      fitHandGrip(rig, id, model);
      for (const kind of ["attack", "mine", "place", "eat", "use", "fire"])
        for (let n = 0; n <= 20; n++) {
          const pose = actionPose(
            kind,
            n / 20,
            id.includes("sword") ? "sword" : undefined,
          );
          rig.root.position.set(0.37 + pose.x, -0.27 + pose.y, -0.72 + pose.z);
          rig.root.rotation.set(pose.rx, pose.ry, pose.rz);
          updateHandRig(rig);
          rig.root.updateMatrixWorld(true);
          assert.ok(
            new THREE.Box3().setFromObject(rig.wrist).max.z <= -0.1099,
            id + kind,
          );
          assert.deepEqual(rig.grip.scale.toArray(), [1, 1, 1]);
        }
      if (id === "stone") {
        const cube = model.children[0];
        const contact = rig.forearm.localToWorld(new THREE.Vector3(0, -0.5, 0));
        cube.geometry.computeBoundingBox();
        assert.ok(
          cube.geometry.boundingBox.containsPoint(cube.worldToLocal(contact)),
        );
      }
      if (id === "flint_and_steel") assert.ok(model.position.z < 0);
    }
  } finally {
    restore();
  }
});
