import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { B, makeStack } from "../src/data.js";
import {
  createWorldAnimation,
  disposeWorldAnimation,
} from "../src/world-animation-models.js";
import { regionalVillage, VILLAGE_STYLES } from "../src/village-styles.js";
import { AudioEngine } from "../src/audio.js";
import {
  positionMix,
  distanceGain,
  tornadoInfluence,
  playWorldSound,
} from "../src/spatial-audio.js";
import {
  createHandRig,
  createHeldModel,
  fitHandGrip,
} from "../src/first-person.js";
import {
  heldMountX,
  heldRestRoll,
  mountJavaItem,
  javaSwingPose,
} from "../src/java-item-motion.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const player = () => ({ x: 0, y: 80, z: 0, yaw: 0 });
function fakeAudio() {
  const param = () => ({
      value: 0,
      setValueAtTime(v) {
        this.value = v;
      },
      setTargetAtTime(v) {
        this.value = v;
      },
    }),
    nodes = [];
  const node = (extra) => ({
    connect() {},
    disconnect() {
      this.disconnected = true;
    },
    ...extra,
  });
  const context = {
    currentTime: 0,
    createGain: () => node({ gain: param() }),
    createStereoPanner: () => node({ pan: param() }),
    createBiquadFilter: () => node({ frequency: param() }),
    createBufferSource: () => {
      const n = node({ playbackRate: param(), start() {}, stop() {} });
      nodes.push(n);
      return n;
    },
  };
  const a = new AudioEngine({ volume: 1, mobVolume: 1 });
  a.context = context;
  a.master = node({ gain: param() });
  a.appliedMasterVolume = 1;
  a.effects = { hit: [{}], thunder: [{}] };
  a.voices = { zombie: [{}], "zombie:hurt": [{}] };
  const g = {
    player: player(),
    world: { raycast: () => null },
    active: true,
    running: true,
    dimension: "overworld",
  };
  return { a, g, context, nodes };
}
test("chests have textured body/lid bands in every pack, stay flush to the block floor and turn into the room without moving their storage position", () => {
  for (const pack of ["classic", "renewed", "supplied"])
    for (let facing = 0; facing < 4; facing++) {
      const texture = new THREE.Texture(),
        m = createWorldAnimation(
          { x: -2, y: 80, z: 15, id: B.chest, facing },
          { texture, pack },
        );
      assert.equal(m.userData.chestPivot.rotation.y, (-facing * Math.PI) / 2);
      const b = new THREE.Box3().setFromObject(m);
      assert.ok(Math.abs(b.min.y - 80) < 1e-6);
      assert.ok(Math.abs(b.max.y - 80.875) < 1e-6);
      assert.ok(
        b.min.x >= -2 && b.max.x <= -1 && b.min.z >= 15 && b.max.z <= 16,
      );
      let textured = 0;
      m.traverse((o) => {
        if (o.material?.map) {
          textured++;
          assert.equal(o.material.map, texture);
          assert.ok(
            [...o.geometry.attributes.uv.array].every((n) => n >= 0 && n <= 1),
          );
        }
      });
      assert.ok(textured >= 2);
      m.userData.hinge.rotation.x = 1.5;
      assert.ok(new THREE.Box3().setFromObject(m).max.y > 81.3);
      disposeWorldAnimation(m);
    }
});
test("all eight village styles place supported, unobstructed inward-facing chests across chunk edges and retain old saved loot", () => {
  for (const [style, def] of Object.entries(VILLAGE_STYLES)) {
    const cells = new Map(),
      w = { containers: {}, cropTicks: {}, edits: new Map() },
      floor = 80 + (def.lift || 0),
      h = { x: -1, z: 13, doorX: 2, doorZ: 19, floor, profession: "farmer" },
      v = { x: 8, z: 8, y: 80, style, houses: [h] };
    const draw = () => {
      for (let cz = -3; cz <= 3; cz++)
        for (let cx = -3; cx <= 3; cx++)
          regionalVillage(
            w,
            { cx, cz },
            (x, y, z, id) => {
              if (x >= 0 && x < 16 && z >= 0 && z < 16)
                cells.set(`${cx * 16 + x},${y},${cz * 16 + z}`, id);
            },
            v,
          );
    };
    draw();
    const key = `0,${floor + 1},18`;
    assert.equal(cells.get(key), B.chest, style);
    assert.equal(cells.get(`0,${floor},18`), B.planks);
    assert.equal(cells.get(`0,${floor + 2},18`), B.air);
    assert.equal(cells.get(`1,${floor + 1},18`), B.air);
    assert.equal(w.containers[key].facing, 1);
    w.containers[key].slots[0] = makeStack("diamond", 7);
    delete w.containers[key].facing;
    draw();
    assert.equal(w.containers[key].facing, 1);
    assert.equal(w.containers[key].slots[0].count, 7);
  }
});
test("world sound falls off in three dimensions, pans with the listener and stops at each category's range", () => {
  const p = player();
  let previous = 1;
  for (const d of [0, 2, 4, 8, 12, 15, 16, 100]) {
    const mix = positionMix(p, { x: d, y: 80, z: 0 }, "mob");
    assert.ok(mix.gain <= previous);
    previous = mix.gain;
    assert.ok(mix.pan >= 0 && mix.pan <= 1);
  }
  assert.equal(positionMix(p, { x: 0, y: 120, z: 0 }, "mob").gain, 0);
  assert.equal(positionMix(p, { x: 48, y: 80, z: 0 }, "explosion").gain, 0);
  assert.equal(positionMix(p, { x: 160, y: 80, z: 0 }, "thunder").gain, 0);
  assert.ok(positionMix({ ...p, yaw: Math.PI }, { x: 5, y: 80, z: 0 }).pan < 0);
  assert.ok(
    positionMix(p, { x: 5, y: 80, z: 0 }, "hit", true).gain <
      positionMix(p, { x: 5, y: 80, z: 0 }, "hit").gain,
  );
  assert.equal(distanceGain(NaN), 0);
});
test("real audio nodes attenuate and pan world events; moving out of range or dimensions mutes active voices and ending releases records", () => {
  const { a, g, context, nodes } = fakeAudio(),
    source = { x: 4, y: 80, z: 0 };
  assert.equal(a.world(g, "hit", source), true);
  const record = [...a.positionedVoices][0];
  assert.ok(record.volume.gain.value > 0 && record.volume.gain.value < 0.45);
  assert.equal(record.stereo.pan.value, 1);
  g.player.x = -200;
  context.currentTime = 0.1;
  a.updatePositioned(g);
  assert.equal(record.volume.gain.value, 0);
  g.player.x = 0;
  context.currentTime = 0.2;
  a.updatePositioned(g);
  assert.ok(record.volume.gain.value > 0);
  g.dimension = "cinderwild";
  context.currentTime = 0.3;
  a.updatePositioned(g);
  assert.equal(record.volume.gain.value, 0);
  nodes[0].onended();
  assert.equal(a.positionedVoices.size, 0);
  assert.equal(a.active, 0);
  assert.equal(a.spatialEvent, undefined);
});
test("distant damage/creature audio skips source creation and raycasts; a peer context uses the actual listener, without attenuating later local/UI sounds", () => {
  const { a, g, context, nodes } = fakeAudio();
  let rays = 0;
  g.world.raycast = () => {
    rays++;
    return null;
  };
  const remote = { x: 200, y: 80, z: 0, type: "zombie" };
  const peer = { ...g, player: remote, multiplayer: { game: g } };
  a.voice(peer, remote, "hurt");
  a.world(peer, "hit", remote);
  assert.equal(nodes.length, 0);
  assert.equal(rays, 0);
  a.voice(g, { x: 4, y: 80, z: 0, type: "zombie" }, "hurt");
  assert.equal(nodes.length, 1);
  assert.ok([...a.positionedVoices][0].volume.gain.value < 0.5);
  assert.equal(a.spatialEvent, undefined);
  a.tone("hit");
  assert.equal(nodes.length, 2);
  assert.equal(a.positionedVoices.size, 1);
  assert.equal(context.currentTime, 0);
  let called;
  playWorldSound(
    {
      audio: {
        world(...args) {
          called = args;
        },
      },
    },
    "hit",
    remote,
  );
  assert.equal(called[1], "hit");
  assert.equal(called[2], remote);
});
test("tornado wind/rumble uses funnel distance and shelter rather than a globally loud weather flag", () => {
  assert.ok(
    tornadoInfluence(player(), { x: 0, z: 0 }) >
      tornadoInfluence(player(), { x: 40, z: 0 }),
  );
  assert.equal(tornadoInfluence(player(), { x: 96, z: 0 }), 0);
  assert.equal(
    tornadoInfluence(
      { ...player(), y: 400 },
      { x: 0, y: 80, z: 0, height: 58 },
    ),
    0,
  );
  const { a, g, context } = fakeAudio();
  const weather = {
    kind: "tornado",
    intensity: 1,
    funnel: { x: 0, z: 0 },
    strike: null,
  };
  Object.assign(g, { elapsed: 0, time: 6000, renderer: {}, settings: {} });
  Object.assign(g.world, {
    weather,
    dimension: "overworld",
    terrain: () => ({ h: 79, biome: "meadow" }),
    skyHeight: () => 79,
    get: () => B.air,
    containers: {},
    tick: 100,
  });
  let mix;
  a.soundscape = {
    pump() {},
    mix(t) {
      mix = t;
    },
  };
  a.ambient(g);
  const near = mix;
  weather.funnel.x = 200;
  context.currentTime = 1;
  a.ambient(g);
  assert.ok(mix.wind < near.wind);
  assert.equal(mix.rumble, 0);
  weather.funnel.x = 0;
  g.world.skyHeight = () => 100;
  context.currentTime = 2;
  a.ambient(g);
  assert.ok(mix.rumble < near.rumble * 0.2);
});
test("legacy non-weapon framing remains normalized; Java weapon mount keeps the sword at the lower-right edge", () => {
  for (const aspect of [0.6, 854 / 478, 1.6, 3.5]) {
    const c = new THREE.PerspectiveCamera(70, aspect, 0.04, 4);
    assert.ok(
      Math.abs((heldMountX(c) * c.projectionMatrix.elements[0]) / 0.72 - 0.62) <
        1e-9,
    );
  }
  assert.ok(
    Math.abs(heldRestRoll("diamond_sword") + (35 * Math.PI) / 180) < 1e-9,
  );
  assert.equal(heldRestRoll("matthew_dual_pistols"), 0);
  const restore = mockCanvas();
  try {
    const rig = createHandRig();
    rig.armVisuals.visible = false;
    rig.wrist.rotation.set(0, 0, 0);
    const m = createHeldModel("diamond_sword", {
      texture: new THREE.Texture(),
      pack: "renewed",
    });
    rig.grip.add(m);
    fitHandGrip(rig, "diamond_sword", m);
    const c = new THREE.PerspectiveCamera(70, 854 / 478, 0.04, 4);
    mountJavaItem(rig, "diamond_sword", javaSwingPose(0), c);
    const points = rig.itemSilhouette.map((p) =>
      p.clone().applyMatrix4(rig.wrist.matrixWorld).project(c),
    );
    assert.ok(Math.min(...points.map((p) => p.x)) > 0.4);
    assert.ok(Math.max(...points.map((p) => p.x)) > 1);
    assert.ok(
      Math.max(...points.map((p) => p.y)) > 0.1 &&
        Math.max(...points.map((p) => p.y)) < 0.5,
    );
    assert.equal(rig.armVisuals.visible, false);
  } finally {
    restore();
  }
});
test("world attenuation state is restored even when a sound producer fails", () => {
  const { a, g } = fakeAudio();
  assert.throws(() =>
    a.withWorldPosition(g, "hit", g.player, () => {
      throw new Error("producer failed");
    }),
  );
  assert.equal(a.spatialEvent, undefined);
});
