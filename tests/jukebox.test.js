import test from "node:test";
import assert from "node:assert/strict";
import { B, ITEMS, CREATIVE_ITEMS, makeStack } from "../src/data.js";
import { World } from "../src/world.js";
import { Inventory } from "../src/inventory.js";
import {
  DISC_IDS,
  jukeboxRecord,
  insertDisc,
  ejectDisc,
  Jukebox,
} from "../src/jukebox.js";
import {
  LocalMusicLibrary,
  validateMP3,
  MAX_MP3_BYTES,
} from "../src/local-music.js";
import { pack, unpack } from "../src/storage.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { grantCreativeStand } from "../src/stand-abilities.js";
import { createPlayer } from "../src/physics.js";
import { Multiplayer } from "../src/multiplayer.js";
const setup = () => {
  const world = new World("discs");
  world.set(0, 200, 0, B.jukebox);
  return {
    world,
    id: "discs",
    dimension: "overworld",
    inventory: new Inventory(),
    mode: "survival",
    player: createPlayer({ x: 3, y: 201, z: 3 }),
  };
};
test("local MP3 validation rejects unsupported, empty and oversized files", () => {
  assert.equal(validateMP3(new File(["mp3"], "a.mp3")).name, "a");
  for (const file of [
    null,
    { name: "x.wav", size: 100 },
    { name: "x.mp3", size: 0 },
    { name: "x.mp3", size: MAX_MP3_BYTES + 1 },
  ])
    assert.throws(() => validateMP3(file));
});
test("local library fallback stores MP3 Blobs outside world saves and reuses disc keys", async () => {
  const library = new LocalMusicLibrary();
  await library.put(DISC_IDS[0], new File(["one"], "first.mp3"));
  assert.equal((await library.get(DISC_IDS[0])).name, "first");
  await library.put(DISC_IDS[0], new File(["two"], "second.mp3"));
  assert.equal(await (await library.get(DISC_IDS[0])).blob.text(), "two");
  assert.equal(library.memory.size, 1);
});
test("existing jukebox IDs/recipe survive and new reusable discs have real crafting and Creative access", () => {
  assert.equal(B.jukebox, 122);
  const inv = new Inventory();
  inv.craft = Array.from({ length: 9 }, (_, i) =>
    makeStack(i === 4 ? "diamond" : "planks"),
  );
  assert.equal(inv.craftOne(3), true);
  assert.equal(inv.cursor.id, "jukebox");
  for (const id of DISC_IDS) {
    assert.equal(ITEMS[id].stack, 1);
    assert.ok(CREATIVE_ITEMS.includes(id));
  }
  const d = new Inventory();
  d.craft = [
    ...Array.from({ length: 4 }, () => makeStack("paper")),
    makeStack("coal"),
    ...Array(4).fill(null),
  ];
  assert.equal(d.craftOne(3), true);
  assert.equal(d.cursor.id, DISC_IDS[0]);
});
test("old YouTube metadata migrates to an empty disc slot without loading URLs", () => {
  const g = setup();
  g.world.containers["0,200,0"] = {
    type: "jukebox",
    slots: [],
    youtube: { videoId: "M7lc1UVf-VE" },
    volume: 0.35,
  };
  const r = jukeboxRecord(g.world, { x: 0, y: 200, z: 0 });
  assert.equal(r.youtube, undefined);
  assert.deepEqual(r.slots, [null]);
  assert.equal(r.volume, 0.35);
  assert.equal(jukeboxRecord(g.world, { x: 5, y: 200, z: 0 }), null);
});
test("insertion and ejection transfer a single disc, reject full inventory/guests and never duplicate", () => {
  const g = setup(),
    r = jukeboxRecord(g.world, { x: 0, y: 200, z: 0 });
  g.inventory.slots[0] = makeStack(DISC_IDS[0]);
  assert.equal(insertDisc(g, r, DISC_IDS[0]), true);
  assert.equal(g.inventory.slots[0], null);
  assert.equal(insertDisc(g, r, DISC_IDS[0]), false);
  g.inventory.slots.fill(makeStack("stone", 64));
  assert.equal(ejectDisc(g, r), false);
  assert.ok(r.slots[0]);
  g.inventory.slots[0] = null;
  assert.equal(ejectDisc(g, r), true);
  assert.equal(ejectDisc(g, r), false);
  assert.equal(g.inventory.slots[0].id, DISC_IDS[0]);
  g.multiplayer = { isGuest: true };
  assert.equal(insertDisc(g, r, DISC_IDS[0]), false);
});
test("inserted discs and volume survive checksummed realm serialization without personal MP3 data", () => {
  const g = setup(),
    r = jukeboxRecord(g.world, { x: 0, y: 200, z: 0 });
  r.slots[0] = makeStack(DISC_IDS[1]);
  r.volume = 0.4;
  const exported = exportRealm({ ...g, entities: [], drops: [] }),
    saved = unpack(pack(exported));
  assert.equal(JSON.stringify(saved).includes("blob"), false);
  const loaded = restoreRealm(g.world.seed, "overworld", saved);
  assert.deepEqual(loaded.world.containers["0,200,0"], r);
  const player = new Jukebox(g);
  player.selection = {
    worldId: g.id,
    dimension: g.dimension,
    key: "0,200,0",
    x: 0,
    y: 200,
    z: 0,
  };
  assert.equal(player.record, r);
  g.world.set(0, 200, 0, B.air);
  assert.equal(player.record, null);
});
test("local player master volume multiplies disc volume and stop releases media and URLs", () => {
  const box = new Jukebox({ settings: { volume: 0.8 } });
  box.audio = { volume: 0, pause() {}, removeAttribute() {}, load() {} };
  box.volume = 0.5;
  box.syncVolume();
  assert.equal(box.audio.volume, 0.4);
  box.game.settings.volume = 0;
  box.syncVolume();
  assert.equal(box.audio.volume, 0);
  box.stop();
  assert.equal(box.audio, null);
  assert.equal(box.state, "stopped");
});
test("Creative Stand selection does not mutate Survival trials, fate, inventory or ownership", () => {
  const g = setup();
  g.player.standData = { trial: { elapsed: 19 }, serial: 3 };
  const before = JSON.stringify(g.player);
  assert.equal(grantCreativeStand(g, "tusk"), false);
  assert.equal(JSON.stringify(g.player), before);
  g.mode = "creative";
  assert.equal(grantCreativeStand(g, "tusk"), true);
  assert.equal(g.player.standData.id, "tusk");
  assert.equal(g.player.standData.serial, 3);
  assert.equal(g.player.standData.summoned, true);
  assert.equal(grantCreativeStand(g, "invalid"), false);
});
test("host rejects forged Survival Creative-Stand grants and duplicate Creative packets", () => {
  for (const mode of ["survival", "creative"]) {
    const ctx = setup();
    ctx.mode = mode;
    let saves = 0;
    ctx.save = () => {
      saves++;
      return Promise.resolve();
    };
    const peer = {
        lastSeq: 0,
        lastPose: performance.now(),
        player: ctx.player,
        context: ctx,
        id: "friend",
      },
      messages = [],
      fake = {
        peers: new Map([["friend", peer]]),
        send: (m) => messages.push(m),
        sendPrivate() {},
      };
    const m = {
      id: "friend",
      seq: 1,
      payload: { slot: "creative", id: "d4c", mode: "creative" },
    };
    Multiplayer.prototype.executeStand.call(fake, m);
    Multiplayer.prototype.executeStand.call(fake, m);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ok, mode === "creative");
    assert.equal(saves, mode === "creative" ? 1 : 0);
    if (mode === "survival") assert.equal(ctx.player.standData, undefined);
  }
});
