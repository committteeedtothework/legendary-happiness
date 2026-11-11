import test from "node:test";
import assert from "node:assert/strict";
import { SaveStore, FALLBACK_KEY, unpack } from "../src/storage.js";
import { saveGame, exportWorldState } from "../src/save-session.js";

let disk, denyWrite, denyRead, previous;
test.beforeEach(() => {
  disk = new Map();
  denyWrite = denyRead = false;
  previous = new Map(
    ["indexedDB", "localStorage"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    get() {
      throw new Error("IDB denied");
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key) {
        if (denyRead) throw new Error("Storage read denied");
        return disk.get(key) || null;
      },
      setItem(key, value) {
        if (denyWrite) throw new Error("Quota exceeded");
        disk.set(key, value);
      },
    },
  });
});
test.afterEach(() => {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});
function world(xp = 1, id = "world-a") {
  return {
    id,
    name: id,
    seed: "Wildflower",
    mode: "survival",
    time: 1000,
    generationVersion: 16,
    player: { xp },
    inventory: {
      slots: [
        {
          id: "iron_pickaxe",
          count: 1,
          durability: 91,
          enchantments: { efficiency: 2 },
        },
      ],
    },
    edits: { "16,63,-1": 2 },
    giganto: { rewards: ["kept"] },
    coopPlayers: { guest: { xp: 9 } },
  };
}

test("quota denial after committed generations is session-only; exports are latest and restart recovers durable bytes", async () => {
  const store = new SaveStore();
  assert.equal((await store.save(world(10))).status, "durable");
  assert.equal((await store.save(world(20))).status, "durable");
  const durableBytes = disk.get(FALLBACK_KEY);
  denyWrite = true;
  const result = await store.save(world(30));
  assert.equal(result.status, "session-only");
  assert.equal(result.backend, "memory");
  assert.match(result.error, /Quota/);
  assert.equal(store.temporary, true);
  assert.equal(disk.get(FALLBACK_KEY), durableBytes);
  assert.equal((await store.load("world-a")).data.player.xp, 30);
  assert.equal(
    (await exportWorldState({ store, active: false }, "world-a")).player.xp,
    30,
  );
  assert.equal((await store.list())[0].durability, "session-only");
  const restarted = new SaveStore();
  const loaded = await restarted.load("world-a");
  assert.deepEqual(loaded.data, world(20));
  assert.equal(loaded.outcome.status, "durable");
  assert.equal(
    unpack(JSON.parse(durableBytes)["world-a"].backup).player.xp,
    10,
  );
  // Recovery is explicit: a subsequent successful write clears the warning,
  // and its backup is the last durable version, never the failed session write.
  denyWrite = false;
  assert.equal((await store.save(world(40))).status, "durable");
  assert.equal(store.warnings().length, 0);
  assert.equal(store.temporary, false);
  assert.equal(
    unpack(JSON.parse(disk.get(FALLBACK_KEY))["world-a"].backup).player.xp,
    20,
  );
});

test("corrupt current recovers valid backup; a new save retains that recovery generation", async () => {
  const store = new SaveStore();
  await store.save(world(4));
  await store.save(world(8));
  const records = JSON.parse(disk.get(FALLBACK_KEY));
  records["world-a"].current.payload += "corrupt";
  disk.set(FALLBACK_KEY, JSON.stringify(records));
  const restarted = new SaveStore(),
    loaded = await restarted.load("world-a");
  assert.equal(loaded.recovered, true);
  assert.deepEqual(loaded.data, world(4));
  await restarted.save(world(12));
  assert.deepEqual(
    unpack(JSON.parse(disk.get(FALLBACK_KEY))["world-a"].backup),
    world(4),
  );
});

test("concurrent writes capture independent states; a load waits for all earlier queued commits", async () => {
  const store = new SaveStore(),
    input = world(1);
  const first = store.save(input);
  input.player.xp = 2;
  const second = store.save(input);
  input.player.xp = 999;
  const loaded = store.load(input.id);
  assert.deepEqual(
    (await Promise.all([first, second])).map((r) => r.status),
    ["durable", "durable"],
  );
  assert.equal((await loaded).data.player.xp, 2);
  assert.equal(
    unpack(JSON.parse(disk.get(FALLBACK_KEY))[input.id].backup).player.xp,
    1,
  );
});

test("every game save caller awaits its own commit; concurrent export captures current simulation without rotating disk", async () => {
  const store = new SaveStore();
  let state = world(10),
    release,
    entered;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const realSave = store.save.bind(store);
  let calls = 0;
  store.save = async (data) => {
    if (++calls === 1) {
      entered();
      await gate;
    }
    return realSave(data);
  };
  const game = {
    id: state.id,
    active: true,
    store,
    snapshot: () => structuredClone(state),
    ui: { saved() {} },
  };
  const first = saveGame(game);
  await started;
  state.player.xp = 20;
  let secondDone = false;
  const second = saveGame(game).then((r) => {
    secondDone = true;
    return r;
  });
  state.player.xp = 30;
  assert.equal((await exportWorldState(game, game.id)).player.xp, 30);
  assert.equal(secondDone, false);
  assert.equal(disk.has(FALLBACK_KEY), false);
  release();
  await first;
  await second;
  assert.equal((await store.load(game.id)).data.player.xp, 20);
  assert.equal(game.saving, null);
});

test("serialization failure is explicit and does not poison the next request or advance lastSaved", async () => {
  const store = new SaveStore();
  let state = world(2);
  const game = {
    id: state.id,
    active: true,
    store,
    lastSaved: 123,
    snapshot: () => state,
    ui: { saved() {} },
  };
  state.bad = 1n;
  const result = await store.save(state);
  assert.equal(result.status, "failed");
  await assert.rejects(saveGame(game), /BigInt/);
  assert.equal(game.lastSaved, 123);
  assert.equal(game.saving, null);
  delete state.bad;
  assert.equal((await saveGame(game)).status, "durable");
  assert.ok(game.lastSaved > 123);
});

test("unreadable fallback data is never overwritten; memory-only worlds can be exported and deleted", async () => {
  disk.set(FALLBACK_KEY, "unreadable preexisting bytes");
  const store = new SaveStore();
  assert.equal((await store.save(world(3))).status, "session-only");
  assert.equal(disk.get(FALLBACK_KEY), "unreadable preexisting bytes");
  assert.deepEqual((await store.load("world-a")).data, world(3));
  await store.remove("world-a");
  assert.equal(store.warnings().length, 0);
  assert.equal((await store.list()).length, 0);
  assert.equal(disk.get(FALLBACK_KEY), "unreadable preexisting bytes");
});

test("one world's durable success cannot hide another world's missing backup", async () => {
  const store = new SaveStore();
  denyWrite = true;
  await store.save(world(1, "a"));
  denyWrite = false;
  await store.save(world(2, "b"));
  assert.deepEqual(
    store.warnings().map((o) => o.id),
    ["a"],
  );
  assert.equal((await store.load("a")).data.player.xp, 1);
  assert.equal((await new SaveStore().list()).length, 1);
});
