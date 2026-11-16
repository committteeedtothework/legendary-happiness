import {multiplayerAuthorized} from "./helpers/multiplayer-authorized.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ANIMAL_CALLS, animalVoiceSamples } from "../src/animal-voices.js";
import { createVoiceBank, voiceSamples } from "../src/voices.js";
import { AudioEngine } from "../src/audio.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { FirstPersonAnimator } from "../src/animation.js";
import {
  addCriticalImpact,
  updateCriticalParticle,
} from "../src/combat-feedback.js";
import { B, MOB_INFO, makeStack } from "../src/data.js";
import { World } from "../src/world.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { createEntity, hitEntity, damageEntity } from "../src/simulation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
const player = () => ({
  x: 0,
  y: 100,
  z: 0,
  onGround: true,
  yaw: 0,
  pitch: 0,
  vy: 0,
});

test("animal calls use species articulations, distinct events/variants and click-free bounded PCM", () => {
  const unique = new Set();
  for (const [type, def] of Object.entries(ANIMAL_CALLS)) {
    assert.ok(MOB_INFO[type], type);
    for (const event of ["idle", "hurt", "attack", "death"]) {
      const a = voiceSamples(type, 22050, 0, event),
        b = voiceSamples(type, 22050, 1, event);
      assert.ok(a.length > 2000 && a.length < 50000, `${type} ${event}`);
      assert.ok(a.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.65));
      assert.equal(Math.abs(a[0]), 0);
      assert.ok(Math.abs(a.at(-1)) < 0.001);
      assert.ok(a.some((v) => Math.abs(v) > 0.03));
      assert.notDeepEqual(a, b);
      unique.add(a.length + ":" + a.slice(200, 250).join(","));
    }
  }
  assert.equal(unique.size, Object.keys(ANIMAL_CALLS).length * 4);
  assert.equal(ANIMAL_CALLS.rabbit.call, "squeak");
  assert.equal(ANIMAL_CALLS.skeleton_horse.call, "whinny");
  assert.equal(ANIMAL_CALLS.koala.call, "bellow");
  assert.equal(animalVoiceSamples("unknown", 22050), null);
});

test("only the selected animal voice variant is synthesized, once, at a bounded sample rate", () => {
  let count = 0;
  const bank = createVoiceBank({
    sampleRate: 48000,
    createBuffer(ch, n, rate) {
      count++;
      assert.equal(ch, 1);
      assert.equal(rate, 22050);
      return {
        copyToChannel(a) {
          assert.equal(a.length, n);
        },
      };
    },
  });
  const cow = bank.cow;
  assert.equal(count, 0);
  assert.equal(cow.length, 3);
  const first = cow[1];
  assert.equal(count, 1);
  assert.equal(cow[1], first);
  assert.equal(count, 1);
  assert.notEqual(cow[2], first);
  assert.equal(count, 2);
  assert.notEqual(bank["cow:hurt"][1], first);
  assert.equal(count, 3);
});

test("babies get higher voices, assigned End aliases work and muted/distant calls stay silent", () => {
  const audio = new AudioEngine({ volume: 1, mobVolume: 1 }),
    calls = [];
  audio.context = {};
  audio.sample = (...args) => calls.push(args);
  audio.withWorldPosition = (g, t, e, fn) => fn();
  audio.voice({}, { type: "cow", baby: true }, "hurt");
  assert.equal(calls[0][0], "cow:hurt");
  assert.ok(calls[0][2] >= 1.3 && calls[0][2] <= 1.4);
  audio.mob("enderman", 0, "hurt");
  assert.equal(calls.at(-1)[0], "stalker:hurt");
  audio.mob("dragoon", 0, "attack");
  assert.equal(calls.at(-1)[0], "mad_titan:attack");
  audio.mob("shulker", 0, "hurt");
  assert.equal(calls.at(-1)[0], "shulker:hurt");
  const count = calls.length;
  audio.mob("cow", 16);
  audio.mob("unknown");
  audio.settings.mobSounds = false;
  audio.mob("cow");
  assert.equal(calls.length, count);
});

test("land arms stay rigid for fists, blocks, tools, food and custom weapons; torso stays attached during attacks", () => {
  const restore = mockCanvas();
  try {
    for (const id of [
      undefined,
      "stone",
      "apple",
      "iron_sword",
      "diamond_pickaxe",
      "devin_sword",
      "iron_spear",
    ]) {
      const model = createPlayerModel("devin", [], id, {
          texture: new THREE.Texture(),
          pack: "renewed",
        }),
        p = player(),
        before = JSON.stringify(p),
        u = model.userData;
      for (const kind of ["attack", "mine", "place", "use", "eat"])
        for (const progress of [0.02, 0.12, 0.35, 0.65, 0.9]) {
          animatePlayerModel(
            model,
            p,
            1 / 60,
            true,
            Math.sin(progress * Math.PI),
            kind,
            0,
            true,
            { kind, age: progress, duration: 1 },
          );
          assert.ok(
            u.forearms.every((a) => a.rotation.x === 0),
            `${id} ${kind} folded an elbow`,
          );
          assert.deepEqual(u.body.rotation.toArray().slice(0, 3), [0, 0, 0]);
          model.updateMatrixWorld(true);
          const palm = u.forearms[1].children[1].getWorldPosition(
              new THREE.Vector3(),
            ),
            grip = u.grip.getWorldPosition(new THREE.Vector3());
          assert.ok(grip.distanceTo(palm) < 0.1);
        }
      assert.equal(JSON.stringify(p), before);
    }
  } finally {
    restore();
  }
});

test("the shared attack clock starts both views immediately and produces the same pose at 30/60/144 FPS", () => {
  const restore = mockCanvas();
  try {
    const poses = [];
    for (const fps of [30, 60, 144]) {
      const model = createPlayerModel("devin", [], "stone", {
          texture: new THREE.Texture(),
          pack: "renewed",
        }),
        a = new FirstPersonAnimator(),
        p = player();
      a.trigger("attack", undefined, "stone");
      a.step(1 / fps, p, { itemId: "stone", bobbing: false });
      animatePlayerModel(
        model,
        p,
        1 / fps,
        false,
        Math.sin((Math.PI * a.action.age) / a.action.duration),
        "attack",
        0,
        true,
        a.action,
      );
      assert.ok(
        model.userData.arms[1].rotation.x > 0.1,
        "first visible frame stayed idle",
      );
      // Sample the same elapsed action time with variable final frame length.
      while (a.action.age < 0.15 - 1e-9) {
        const dt = Math.min(1 / fps, 0.15 - a.action.age);
        a.step(dt, p, { itemId: "stone", bobbing: false });
        animatePlayerModel(model, p, dt, false, 1, "attack", 0, true, a.action);
      }
      poses.push(model.userData.arms[1].rotation.toArray().slice(0, 3));
      const before = JSON.stringify(model.toJSON());
      animatePlayerModel(model, p, 0, false);
      assert.equal(JSON.stringify(model.toJSON()), before);
    }
    for (const pose of poses)
      for (let i = 0; i < 3; i++)
        assert.ok(Math.abs(pose[i] - poses[0][i]) < 1e-8);
  } finally {
    restore();
  }
});

test("critical stars use the reachable body surface, face the camera, fade and share geometry", () => {
  const renderer = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    settings: { particles: "all" },
    effects: [],
  };
  const entity = { type: "cow", x: 4, y: 100, z: 3 };
  addCriticalImpact(renderer, entity, { x: 4, y: 100, z: 1 });
  assert.equal(renderer.effects.length, 16);
  const e = renderer.effects[0];
  assert.ok(renderer.effects.every((p) => p.m.geometry === e.m.geometry));
  assert.ok(e.m.geometry.userData.shared);
  assert.ok(e.m.position.y > 100 && e.m.position.y < 100 + MOB_INFO.cow.height);
  assert.ok(e.m.position.z < entity.z, "stars spawned on far side of target");
  renderer.camera.rotation.y = 0.6;
  renderer.camera.updateMatrixWorld();
  e.life = 0.08;
  const scale = e.m.scale.x;
  updateCriticalParticle(e, renderer.camera, 0.03);
  assert.ok(e.m.material.opacity < 0.5);
  assert.ok(e.m.scale.x < scale);
  assert.ok(e.m.quaternion.angleTo(renderer.camera.quaternion) < 1e-8);
  renderer.effects.length = 179;
  addCriticalImpact(renderer, entity);
  assert.equal(renderer.effects.length, 180);
  renderer.settings.particles = "minimal";
  renderer.effects = [];
  addCriticalImpact(renderer, entity);
  assert.equal(renderer.effects.length, 0);
});

function fixture() {
  const world = new World("polish combat", {}, "overworld", 15),
    inventory = new Inventory(),
    events = [],
    messages = [];
  for (let x = 0; x < 6; x++)
    for (let z = 0; z < 6; z++) {
      world.set(x, 199, z, B.stone);
      for (let y = 200; y < 205; y++) world.set(x, y, z, B.air);
    }
  return {
    world,
    inventory,
    events,
    messages,
    player: createPlayer({ x: 2.5, y: 200, z: 2.5 }),
    entities: [],
    drops: [],
    mode: "creative",
    difficulty: "normal",
    elapsed: 5,
    tickCount: 1,
    time: 1000,
    dimension: "overworld",
    settings: { renderDistance: 2, cycleText: {} },
    audio: { tone() {}, voice() {} },
    renderer: {
      action() {},
      combatImpact(e, data) {
        events.push({ id: e.id, ...data });
      },
    },
    ui: {
      toast(t) {
        messages.push(t);
      },
      updateHotbar() {},
      updateHUD() {},
    },
    damage() {},
  };
}
test("crit feedback follows real falling-hit damage and never appears for immune/dead targets; loot/XP remain without kill messages", () => {
  const g = fixture();
  g.inventory.slots[0] = makeStack("iron_sword");
  g.inventory.selected = 0;
  const e = createEntity(g, "cow", 3.5, 3.5);
  e.y = 200;
  e.hp = 100;
  g.player.onGround = false;
  g.player.vy = -3;
  const falling = hitEntity(g, e);
  assert.ok(falling > 0);
  assert.equal(g.events.at(-1).critical, true);
  assert.equal(g.events.at(-1).source, g.player);
  g.elapsed += 2;
  g.player.onGround = true;
  g.player.vy = 0;
  const standing = hitEntity(g, e);
  assert.ok(falling > standing);
  assert.equal(g.events.at(-1).critical, false);
  const count = g.events.length;
  damageEntity(g, { ...e, type: "watcher" }, 10, { critical: true });
  damageEntity(g, { ...e, hp: 0 }, 10, { critical: true });
  assert.equal(g.events.length, count);
  damageEntity(g, e, 1000, { critical: false });
  assert.ok(g.drops.length);
  assert.ok(g.player.xp > 0);
  assert.deepEqual(g.messages, []);
});

test("existing assets, save code, generation, collision, item/creature stats and both Titan encounters remain intact", async () => {
  const { readFileSync } = await import("node:fs"),
    { createHash } = await import("node:crypto");
  const baseline = JSON.parse(
    readFileSync(
      new URL(
        "../reference/gameplay-polish-preserved-2.21.1.json",
        import.meta.url,
      ),
    ),
  );
  for (const [path, hash] of Object.entries(baseline).filter(([path])=>!multiplayerAuthorized.has(path)))
    assert.equal(
      createHash("sha256")
        .update(readFileSync(new URL("../" + path, import.meta.url)))
        .digest("hex"),
      hash,
      path,
    );
  const data = readFileSync(
    new URL("../src/data.js", import.meta.url),
    "utf8",
  ).replace('VERSION = "2.23.0"', 'VERSION = "2.21.1"');
  assert.equal(
    createHash("sha256").update(data).digest("hex"),
    "43650126164eed61be67105b8d6b49484b996737e1b4ae794d55cf04ee2c9b18",
  );
});

test("crit bursts emerge outside elongated, rotated animal meshes instead of hiding inside their collision radius", () => {
  const entity = { id: 7, type: "cow", x: 4, y: 100, z: 3 };
  const model = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.4, 2.8), new THREE.MeshBasicMaterial());
  body.position.y = .7;
  model.add(body);
  model.position.set(4, 100, 3);
  model.rotation.y = 0.6;
  model.updateMatrixWorld(true);
  const renderer = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    settings: { particles: "all" },
    effects: [],
    mobMeshes: new Map([[7, model]]),
  };
  addCriticalImpact(renderer, entity, { x: 4, y: 100, z: 0 });
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(renderer.effects.every((e) => !bounds.containsPoint(e.m.position)));
  assert.ok(renderer.effects.every((e) => e.v.z < 0));
});
