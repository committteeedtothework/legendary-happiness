import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import * as THREE from "three";
import { World, index } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  CREATIVE_ITEMS,
  SPAWN_EGG_TYPES,
  HOSTILE_TYPES,
} from "../src/data.js";
import { BIOMES } from "../src/biomes.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer, collides } from "../src/physics.js";
import { createEntity, damageEntity, tickSurvival } from "../src/simulation.js";
import { wildlifeForBiome } from "../src/ecology.js";
import { spawnOverworldWildlife, wildlifeCount } from "../src/wildlife.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { createMobModel } from "../src/models.js";
import { voiceSamples } from "../src/voices.js";
import { meshChunk } from "../src/mesher.js";
import workerSource from "../src/worker-code.js";
import { blockBounds, doorId, setDoorOpen } from "../src/doors.js";
import { WorldAnimations } from "../src/world-animations.js";
import {
  canOpenChest,
  menuStillValid,
  validateLocalContainerMenu,
  openChestKeys,
  worldInteractionSnapshot,
} from "../src/world-interactions.js";
import { UI } from "../src/ui.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
import { modelFingerprint } from "./helpers/model-fingerprint.js";
const quiet = { toast() {}, updateHUD() {}, updateHotbar() {}, announce() {} };
function flat(biome = "meadow") {
  const world = new World("Living world");
  world.ensure(0, 0); // The virtual floor is in an actively loaded chunk.
  world.terrain = () => ({ h: 80, biome });
  world.skyHeight = () => 80;
  world.get = (x, y) => (y < 81 ? B.grass : B.air);
  world.solid = (x, y) => y < 81;
  world.simulate = () => {};
  return {
    world,
    dimension: "overworld",
    mode: "survival",
    difficulty: "peaceful",
    entities: [],
    drops: [],
    player: createPlayer({ x: 0.5, y: 81, z: 0.5 }),
    inventory: new Inventory(),
    tickCount: 120,
    time: 6000,
    elapsed: 1,
    settings: { renderDistance: 2 },
    ui: quiet,
    audio: { tone() {}, voice() {} },
    damage(n) {
      this.player.health -= n;
    },
  };
}
const atlas = () => ({ texture: new THREE.Texture(), pack: "renewed" });
function visuals() {
  const world = new World("Living props"),
    scene = new THREE.Scene(),
    a = atlas(),
    controller = new WorldAnimations(scene, a);
  const g = {
    world,
    player: createPlayer({ x: 0.5, y: 200, z: 3 }),
    entities: [],
    active: true,
    running: false,
    ui: { screen: "play" },
    settings: { animatedTextures: true, particles: "all" },
    sounds: [],
    audio: {
      tone(s) {
        g.sounds.push(s);
      },
    },
  };
  return { g, controller, scene, a };
}

test("cold wildlife habitats, neutral species, persisted records and Creative-only eggs are connected", () => {
  for (const biome of ["alpine", "snowy_taiga"]) {
    const types = new Set(
      Array.from({ length: 12 }, (_, n) => wildlifeForBiome(biome, n)),
    );
    assert.ok(types.has("snow_leopard") && types.has("polar_bear"));
  }
  for (const type of ["snow_leopard", "polar_bear"]) {
    assert.equal(HOSTILE_TYPES.has(type), false);
    assert.equal(MOB_INFO[type].neutral, true);
    assert.ok(SPAWN_EGG_TYPES.includes(type));
    assert.ok(CREATIVE_ITEMS.includes(type + "_spawn_egg"));
    assert.equal(ITEMS[type + "_spawn_egg"].creativeOnly, true);
  }
  const g = flat("alpine");
  spawnOverworldWildlife(g, createEntity, true);
  assert.ok(
    g.entities.some((e) => e.type === "polar_bear") &&
      g.entities.some((e) => e.type === "snow_leopard"),
  );
  const s = restoreRealm(g.world.seed, "overworld", exportRealm(g));
  assert.deepEqual(s.entities, g.entities);
});
test("all habitable land biomes seed sixteen safe animals and bounded four-animal waves reach 48", () => {
  for (const biome of Object.keys(BIOMES).filter((b) => b !== "ocean")) {
    const g = flat(biome);
    assert.equal(spawnOverworldWildlife(g, createEntity, true), 16, biome);
    assert.ok(
      g.entities.every(
        (e) =>
          !collides(
            g.world,
            e,
            MOB_INFO[e.type].height,
            MOB_INFO[e.type].width,
          ),
      ),
    );
    for (let tick = 240; tick <= 1440; tick += 120) {
      g.tickCount = tick;
      const n = spawnOverworldWildlife(g, createEntity);
      assert.ok(n <= 4);
    }
    assert.equal(wildlifeCount(g), 48, biome);
    assert.equal(g.entities.length, 48);
    assert.ok(g.entities.every((e) => !HOSTILE_TYPES.has(e.type)));
  }
});
test("wildlife rejects water, roofs, occupied bodies, Cinderworld, dead records and wrong tick scheduling correctly", () => {
  const g = flat();
  g.tickCount = 121;
  assert.equal(spawnOverworldWildlife(g, createEntity), 0);
  g.tickCount = 120;
  g.dimension = "cinderwild";
  assert.equal(spawnOverworldWildlife(g, createEntity), 0);
  g.dimension = "overworld";
  g.world.get = () => B.water;
  assert.equal(spawnOverworldWildlife(g, createEntity), 0);
  g.world.get = () => B.stone;
  g.world.solid = () => true;
  assert.equal(spawnOverworldWildlife(g, createEntity), 0);
  const h = flat();
  spawnOverworldWildlife(h, createEntity, true);
  const before = h.entities.length;
  h.entities.forEach((e) => (e.hp = 0));
  assert.equal(wildlifeCount(h), 0);
  assert.equal(spawnOverworldWildlife(h, createEntity), 4);
  assert.equal(h.entities.length, before + 4);
  const living = h.entities.filter((e) => e.hp > 0);
  for (let i = 0; i < living.length; i++)
    for (let j = i + 1; j < living.length; j++)
      assert.ok(
        Math.hypot(living[i].x - living[j].x, living[i].z - living[j].z) > 0.6,
      );
});
test("new neutral animals wander calmly, retaliate when provoked and calm down without becoming permanent hostiles", () => {
  for (const type of ["snow_leopard", "polar_bear"]) {
    const g = flat("alpine");
    g.difficulty = "normal";
    g.player.health = 100;
    g.tickCount = 11;
    const e = createEntity(g, type, 1, 0);
    g.entities = [e];
    tickSurvival(g);
    assert.equal(g.player.health, 100);
    damageEntity(g, e, 1, { knockback: 0 });
    assert.ok(e.flee > 0);
    for (let n = 0; n < 82; n++) tickSurvival(g);
    assert.ok(g.player.health < 100, type);
    assert.equal(e.flee, 0, type);
    assert.ok(e.hp > 0);
  }
});
test("cold models and voices are original, distinct, grounded and articulated", () => {
  const restore = mockCanvas();
  try {
    const models = ["polar_bear", "snow_leopard"].map((type) =>
      createMobModel({ type }),
    );
    assert.notEqual(modelFingerprint(models[0]), modelFingerprint(models[1]));
    for (let i = 0; i < 2; i++) {
      const type = i ? "snow_leopard" : "polar_bear",
        m = models[i],
        bounds = new THREE.Box3().setFromObject(m);
      assert.equal(m.userData.legs.length, 4);
      assert.ok(bounds.min.y >= -0.001);
      assert.ok(Math.abs(bounds.max.y - MOB_INFO[type].height) < 1e-5);
      const v = voiceSamples(type, 22050);
      assert.ok(v.every(Number.isFinite));
      assert.ok(v.some((x) => Math.abs(x) > 0.01));
    }
    assert.equal(models[1].userData.tailSegments.length, 3);
    assert.notDeepEqual(
      voiceSamples("polar_bear", 8000),
      voiceSamples("snow_leopard", 8000),
    );
  } finally {
    restore();
  }
});
test("detailed meshing and embedded workers transfer identical bounded prop descriptors without detaching terrain", () => {
  const w = new World("Props"),
    c = w.ensure(-1, 0);
  c.data.fill(0);
  c.maxY = 202;
  const edits = {
    "-2,200,2": B.chest,
    "-3,200,2": B.furnace,
    "-4,200,2": B.enchanting_table,
    "-5,200,2": B.jukebox,
    "-6,200,2": doorId(),
    "-6,201,2": doorId(0, false, true),
  };
  for (const [k, id] of Object.entries(edits)) {
    const [x, y, z] = k.split(",").map(Number);
    c.data[index(x + 16, y, z)] = id;
  }
  meshChunk(w, c, { interactiveModels: true });
  const descriptors = structuredClone(c.worldVisuals);
  assert.equal(descriptors.length, 4);
  assert.equal(descriptors.filter((t) => BLOCKS[t.id].door).length, 0);
  // A real worker also evaluates deterministic terrain/edits; compare its descriptors to the same real world.
  const real = new World("Worker props", edits),
    chunk = real.ensure(-1, 0);
  meshChunk(real, chunk, { interactiveModels: true });
  let message;
  const self = { postMessage: (m) => (message = m) };
  vm.runInNewContext(workerSource, { self });
  self.onmessage({
    data: {
      ticket: 1,
      seed: "Worker props",
      dimension: "overworld",
      generationVersion: 14,
      cx: -1,
      cz: 0,
      edits,
    },
  });
  assert.ok(!message.error, message.error);
  assert.deepEqual(
    JSON.parse(JSON.stringify(message.worldVisuals)),
    chunk.worldVisuals,
  );
  assert.ok(chunk.data.byteLength > 0);
  c.data.fill(B.chest);
  c.maxY = 0;
  meshChunk(w, c, { interactiveModels: true });
  assert.equal(c.worldVisuals.length, 64);
});
test("chests open upward while paused, stay open for all viewers, close smoothly and survive mesh replacements", () => {
  const { g, controller } = visuals(),
    t = { x: 0, y: 200, z: 0, id: B.chest };
  controller.setChunk("0,0", [t]);
  g.ui = { screen: "inventory", invType: "chest", containerTarget: t };
  for (let n = 0; n < 30; n++) controller.update(g, 1 / 60, n / 60);
  const m = controller.models.get("0,200,0");
  assert.ok(m.userData.hinge.rotation.x > 1.4);
  assert.ok(new THREE.Box3().setFromObject(m).max.y > 201.3);
  assert.deepEqual(g.sounds, ["open"]);
  controller.setChunk("0,0", [t]);
  assert.equal(controller.models.get("0,200,0"), m);
  g.multiplayer = {
    peers: new Map([
      ["a", { player: { health: 20 }, menu: { type: "chest", target: t } }],
    ]),
  };
  g.ui.screen = "play";
  controller.update(g, 0.1, 1);
  assert.equal(m.userData.want, true);
  g.multiplayer.peers.clear();
  for (let n = 0; n < 40; n++) controller.update(g, 1 / 60, 1 + n / 60);
  assert.ok(m.userData.openness < 0.001);
  assert.deepEqual(g.sounds, ["open", "close"]);
  controller.removeChunk("0,0");
  assert.equal(controller.models.size, 0);
});
test("doors use original discrete block meshes for all facings and never create tweening props", () => {
  for (let facing = 0; facing < 4; facing++)
    for (const open of [false, true]) {
      const { g, controller } = visuals(),
        t = { x: 0, y: 200, z: 0, id: doorId(facing, open) };
      controller.setChunk("0,0", [t]);
      controller.update(g, 0.03, 0);
      assert.equal(controller.models.size, 0);
      const c = g.world.ensure(0, 0);
      c.data.fill(0);
      c.maxY = 201;
      c.data[index(0, 200, 0)] = t.id;
      c.data[index(0, 201, 0)] = doorId(facing, open, true);
      const groups = meshChunk(g.world, c, { interactiveModels: true });
      assert.ok(groups.some(Boolean));
      assert.equal(c.worldVisuals.length, 0);
      const vertices = groups
        .filter(Boolean)
        .flatMap((group) => Array.from(group.position));
      const bounds = blockBounds(t.id);
      for (let i = 0; i < vertices.length; i += 3) {
        assert.ok(
          vertices[i] >= bounds[0] - 1e-6 && vertices[i] <= bounds[3] + 1e-6,
        );
        assert.ok(
          vertices[i + 2] >= bounds[2] - 1e-6 &&
            vertices[i + 2] <= bounds[5] + 1e-6,
        );
      }
    }
});
test("furnace flames, enchanting pages and jukebox discs follow actual functional state and graphics settings", () => {
  const { g, controller } = visuals();
  g.running = true;
  controller.setChunk("0,0", [
    { x: 0, y: 200, z: 0, id: B.furnace },
    { x: 2, y: 200, z: 0, id: B.enchanting_table },
    { x: 4, y: 200, z: 0, id: B.jukebox },
  ]);
  const f = controller.models.get("0,200,0"),
    book = controller.models.get("2,200,0"),
    j = controller.models.get("4,200,0");
  controller.update(g, 0.1, 0);
  assert.equal(f.userData.fire.visible, false);
  assert.equal(j.userData.disc.visible, false);
  g.world.containers["0,200,0"] = { type: "furnace", burn: 100 };
  g.world.containers["4,200,0"] = {
    type: "jukebox",
    slots: [{ id: "music_disc_amber", count: 1 }],
  };
  g.jukebox = { state: "playing", selection: { key: "4,200,0" } };
  controller.update(g, 0.1, 1);
  assert.equal(f.userData.fire.visible, true);
  assert.equal(f.userData.sparks.visible, true);
  assert.equal(j.userData.disc.visible, true);
  assert.ok(j.userData.disc.rotation.y > 0);
  const y = book.userData.book.position.y;
  controller.update(g, 0.1, 2);
  assert.notEqual(book.userData.book.position.y, y);
  assert.ok(
    book.userData.pages[0].rotation.z > 0 &&
      book.userData.pages[1].rotation.z < 0,
  );
  for (let n = 0; n < 40; n++) {
    controller.update(g, 0.025, n * 0.1);
    book.updateMatrixWorld(true);
    const leafBounds = new THREE.Box3().setFromObject(book.userData.leaf);
    assert.ok(
      leafBounds.min.y >=
        book.getWorldPosition(new THREE.Vector3()).y +
          book.userData.book.position.y +
          0.045,
    );
  }
  g.settings.particles = "minimal";
  g.settings.animatedTextures = false;
  g.jukebox.state = "paused";
  const angle = j.userData.disc.rotation.y;
  controller.update(g, 0.1, 3);
  assert.equal(f.userData.sparks.visible, false);
  assert.equal(j.userData.disc.rotation.y, angle);
  controller.clear();
  assert.equal(controller.models.size, 0);
});
test("texture-pack and mipmap swaps rebuild prop materials without disposing shared atlas textures", () => {
  const { g, controller, a } = visuals();
  controller.setChunk("0,0", [{ x: 0, y: 200, z: 0, id: B.chest }]);
  let disposed = 0;
  a.texture.addEventListener("dispose", () => disposed++);
  const next = { texture: new THREE.Texture(), pack: "supplied" };
  controller.atlasChanged(next);
  assert.equal(controller.models.size, 1);
  assert.equal(disposed, 0);
  let maps = 0;
  controller.models.get("0,200,0").traverse((m) => {
    if (m.material?.map) {
      maps++;
      assert.equal(m.material.map, next.texture);
    }
  });
  assert.ok(maps > 0);
  controller.clear();
  assert.equal(disposed, 0);
});
test("blocked/replaced/out-of-reach chest menus reject real slot clicks before moving or duplicating items", () => {
  for (const reason of ["roof", "removed", "replaced", "reach"]) {
    const world = new World("Menu race"),
      t = { x: 0, y: 200, z: 0, id: B.chest };
    world.set(0, 200, 0, B.chest);
    const container = {
      type: "chest",
      slots: [{ id: "diamond", count: 1 }, ...Array(26).fill(null)],
    };
    world.containers["0,200,0"] = container;
    const g = {
      world,
      player: createPlayer({ x: 0.5, y: 200, z: 2 }),
      inventory: new Inventory(),
      closed: 0,
      closeInventory() {
        this.closed++;
        this.ui.screen = "play";
      },
    };
    const ui = {
      game: g,
      screen: "inventory",
      invType: "chest",
      containerTarget: t,
      container,
      toast() {},
    };
    g.ui = ui;
    assert.equal(canOpenChest(world, t), true);
    assert.equal(menuStillValid(g, { target: t, container }), true);
    if (reason === "roof") world.set(0, 201, 0, B.stone);
    if (reason === "removed") world.set(0, 200, 0, B.air);
    if (reason === "replaced")
      world.containers["0,200,0"] = { ...container, slots: [] };
    if (reason === "reach") g.player.x = 20;
    UI.prototype.slotClick.call(
      ui,
      { dataset: { ref: "container", index: "0" } },
      { button: 0 },
    );
    assert.equal(g.closed, 1, reason);
    assert.equal(g.inventory.cursor, null);
    assert.equal(container.slots[0].count, 1);
  }
});
test("co-op prop snapshots contain only public chest positions and small state, without inventory, MP3 paths or reconnect secrets", () => {
  const { g } = visuals();
  g.multiplayer = {
    peers: new Map([
      [
        "p",
        {
          resume: "secret-resume",
          player: { health: 20 },
          menu: { type: "chest", target: { x: 1, y: 200, z: 2 } },
        },
      ],
    ]),
  };
  g.world.containers["0,200,0"] = {
    type: "jukebox",
    slots: [{ id: "music_disc_amber", count: 1 }],
    file: "private.mp3",
  };
  const snap = worldInteractionSnapshot(g);
  assert.deepEqual(snap.openChests, ["1,200,2"]);
  assert.deepEqual(snap.blocks, [
    { key: "0,200,0", burn: 0, disc: "music_disc_amber" },
  ]);
  assert.ok(
    !JSON.stringify(snap).includes("secret-resume") &&
      !JSON.stringify(snap).includes("private.mp3"),
  );
});

test("chest targeting, collision and grounding use the same inset 7/8-block body as the animated model", async () => {
  const { moveBody } = await import("../src/physics.js");
  const w = new World("Chest bounds");
  w.set(0, 200, 0, B.chest);
  assert.equal(
    w.raycast({ x: 0.5, y: 200.95, z: 2 }, { x: 0, y: 0, z: -1 }, 4),
    null,
  );
  const hit = w.raycast({ x: 0.5, y: 200.5, z: 2 }, { x: 0, y: 0, z: -1 }, 4);
  assert.equal(hit.id, B.chest);
  assert.ok(Math.abs(hit.distance - 1.0625) < 1e-8);
  assert.equal(collides(w, { x: 0.5, y: 200.9, z: 0.5 }), false);
  assert.equal(collides(w, { x: 0.5, y: 200.86, z: 0.5 }), true);
  const p = { x: 0.5, y: 201, z: 0.5, vy: -2, onGround: false };
  moveBody(w, p, 0, -0.2, 0);
  assert.ok(Math.abs(p.y - 200.875) < 0.001);
  assert.equal(p.onGround, true);
});
