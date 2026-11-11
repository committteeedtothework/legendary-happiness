import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import { B, MIN_Y, makeStack } from "../src/data.js";
import { hash } from "../src/random.js";
import { launchSeeker, tickSeekers } from "../src/seeker.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { placeDoor, doorAt, setDoorOpen } from "../src/doors.js";
import { updateVillageDoor } from "../src/ecology.js";
import {
  relayURL,
  invitationURL,
  readInvitation,
  cleanPose,
} from "../src/multiplayer.js";
import { SKINS, skinPreview } from "../src/skins.js";

function arena() {
  return {
    world: { raycast: () => null },
    player: createPlayer({ x: 0, y: 100, z: 0 }),
    inventory: new Inventory(),
    entities: [],
    tickCount: 0,
    settings: { particles: "minimal" },
  };
}
const enemy = (id, x, z) => ({ id, type: "shade", x, y: 100, z, hp: 30 });
test("Seeker tracks a moving hostile, avoids passive targets, and has a persisted cooldown", () => {
  const g = arena(),
    passive = { ...enemy("friend", 1, -2), type: "cow" },
    hostile = enemy("target", 0, -14);
  g.inventory.slots[0] = makeStack("devin_sword");
  g.entities = [passive, hostile];
  assert.equal(launchSeeker(g), true);
  assert.equal(g.seekers[0].target, "target");
  assert.equal(launchSeeker(g), false);
  let damage = 0;
  for (let t = 0; t < 60 && g.seekers.length; t++) {
    hostile.x += 0.08;
    tickSeekers(g, (_g, e, n) => {
      assert.equal(e, hostile);
      e.hp -= n;
      damage += n;
    });
  }
  assert.equal(damage, 12);
  assert.equal(passive.hp, 30);
  assert.equal(g.seekers.length, 0);
  const restored = JSON.parse(JSON.stringify(g.player));
  assert.equal(restored.devinSeekerTick, 280);
  g.player = restored;
  assert.equal(launchSeeker(g), false);
  g.tickCount = 280;
  assert.equal(launchSeeker(g), true);
});
test("Seeker cannot acquire through walls, hits new obstacles, and does not consume a cooldown without a target", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("devin_sword");
  g.entities = [enemy("target", 0, -8)];
  g.world.raycast = () => ({ distance: 1 });
  assert.equal(launchSeeker(g), false);
  assert.equal(g.player.devinSeekerTick, undefined);
  g.world.raycast = () => null;
  assert.equal(launchSeeker(g), true);
  g.world.raycast = () => ({ distance: 0.2 });
  let hit = false;
  tickSeekers(g, () => (hit = true));
  assert.equal(hit, false);
  assert.equal(g.seekers.length, 0);
});
test("Seeker reacquires live hostiles only and expires without a target", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("devin_sword");
  g.entities = [enemy("one", 0, -4), enemy("two", 2, -8)];
  launchSeeker(g);
  g.entities[0].hp = 0;
  tickSeekers(g, () => {});
  assert.equal(g.seekers[0].target, "two");
  g.entities = [];
  for (let i = 0; i < 90; i++)
    tickSeekers(g, () => assert.fail("No target to damage"));
  assert.equal(g.seekers.length, 0);
  g.inventory.slots[0] = makeStack("iron_sword");
  g.tickCount = 300;
  assert.equal(launchSeeker(g), false);
});
test("v8 natural obsidian stays underground next to actual cave lava, with order-independent negative chunk boundaries", () => {
  const a = new World("Wildflower", {}, "overworld", 8),
    b = new World("Wildflower", {}, "overworld", 8);
  assert.equal(a.generationVersion, 8);
  const coords = [
    [-3, -3],
    [-3, -2],
    [-2, -3],
    [-2, -2],
    [1, 1],
    [2, 2],
  ];
  for (const [x, z] of coords) a.ensure(x, z);
  for (const [x, z] of coords.toReversed()) b.ensure(x, z);
  let obsidian = 0,
    lava = 0;
  for (const [cx, cz] of coords) {
    const c = a.ensure(cx, cz);
    assert.deepEqual(c.data, b.ensure(cx, cz).data);
    for (let z = cz * 16; z < cz * 16 + 16; z++)
      for (let x = cx * 16; x < cx * 16 + 16; x++) {
        const h = a.terrain(x, z).h;
        assert.notEqual(a.get(x, h, z), B.obsidian);
        for (let y = MIN_Y + 1; y < h; y++)
          if (a.get(x, y, z) === B.obsidian) {
            obsidian++;
            assert.ok(y <= 17);
            assert.equal(a.get(x, y + 1, z), B.air);
          } else if (a.get(x, y, z) === B.lava) lava++;
      }
  }
  assert.ok(obsidian > 0);
  assert.ok(lava > 0);
  const rx = -1,
    rz = -1,
    s = a.seedInt,
    px = rx * 64 + 12 + Math.floor(hash(rx, 2, rz, s + 9081) * 40),
    pz = rz * 64 + 12 + Math.floor(hash(rx, 3, rz, s + 9081) * 40),
    py = -42 + Math.floor(hash(rx, 4, rz, s + 9081) * 60);
  assert.equal(a.get(px, py, pz), B.lava);
  assert.equal(a.get(px, py + 1, pz), B.air);
});
test("placed obsidian persists above ground while old generators remain explicit", () => {
  const a = new World("saved");
  a.set(0, 200, 0, B.obsidian);
  const b = new World(
    a.seed,
    a.exportEdits(),
    "overworld",
    a.generationVersion,
  );
  assert.equal(b.get(0, 200, 0), B.obsidian);
  assert.equal(new World("legacy", {}, "overworld", 7).generationVersion, 7);
});
test("opened village doors stay open after residents leave, across reloads, until manually toggled", () => {
  const world = new World("door");
  world.set(0, 199, 0, B.stone);
  world.set(0, 200, 0, B.air);
  world.set(0, 201, 0, B.air);
  assert.equal(placeDoor(world, 0, 200, 0, 0, []), true);
  assert.equal(setDoorOpen(world, 0, 200, 0, true), true);
  const game = { world, player: { x: 10, y: 200, z: 10 }, entities: [] };
  const e = {
    x: 10,
    y: 200,
    z: 10,
    speed: 0,
    home: { doorX: 0.5, y: 200, doorZ: 0.5 },
  };
  for (let i = 0; i < 200; i++) updateVillageDoor(game, e);
  assert.equal(doorAt(world, 0, 200, 0).open, true);
  const restored = new World(world.seed, world.exportEdits());
  assert.equal(doorAt(restored, 0, 200, 0).open, true);
  assert.equal(setDoorOpen(restored, 0, 200, 0, false), true);
  assert.equal(doorAt(restored, 0, 200, 0).open, false);
});
test("invitations round-trip without putting their private token in the server query", () => {
  const invite = invitationURL(
      "https://example.com/",
      "abcDEF12",
      "X".repeat(32),
    ),
    url = new URL(invite);
  assert.equal(url.search, "");
  assert.ok(url.hash.includes("key="));
  assert.deepEqual(readInvitation(invite), {
    server: "wss://example.com/relay",
    room: "abcDEF12",
    key: "X".repeat(32),
  });
  assert.equal(
    relayURL("http://localhost:8787/path").href,
    "ws://localhost:8787/relay",
  );
  for (const value of [
    "javascript:alert(1)",
    "file:///tmp/a",
    "https://user:pass@example.com/",
  ])
    assert.throws(() => relayURL(value));
  assert.throws(() => readInvitation("https://example.com/"));
});
test("remote appearances validate finite positions, known outfits, items and armor slots", () => {
  const p = {
    x: 1,
    y: 100,
    z: -1,
    yaw: 0,
    pitch: 0,
    skin: "devin",
    held: "devin_sword",
    equipment: ["iron_helmet", "dirt_chestplate", "planks", "iron_boots"],
  };
  assert.deepEqual(cleanPose(p).equipment, [
    "iron_helmet",
    "dirt_chestplate",
    null,
    "iron_boots",
  ]);
  for (const value of [NaN, Infinity, "1", 100001])
    assert.equal(cleanPose({ ...p, x: value }), null);
  assert.equal(cleanPose({ ...p, skin: "<script>" }).skin, "explorer");
});
test("eleven distinct original wardrobe previews include a smirking tunic hero", () => {
  assert.equal(Object.keys(SKINS).length, 11);
  assert.equal(SKINS.devin.name, "Devin The Hero");
  assert.equal(SKINS.devin.style, "devin");
  assert.equal(new Set(Object.keys(SKINS).map(skinPreview)).size, 11);
  assert.match(
    decodeURIComponent(skinPreview("devin")),
    /shape-rendering="crispEdges"/,
  );
});

test("guest edit deltas do not accumulate a second block-update simulation queue", async () => {
  const { Multiplayer } = await import("../src/multiplayer.js");
  const world = new World("guest-queue"),
    game = { world };
  const multiplayer = new Multiplayer(game);
  const edits = Array.from({ length: 100 }, (_, i) => [`${i},200,0`, B.planks]);
  multiplayer.applyState({
    dimension: "overworld",
    edits,
    time: 1000,
    tickCount: 20,
    worldTick: 20,
    entities: [],
    drops: [],
  });
  // Dimension gates reject stale state; an accepted state is applied once.
  assert.equal(world.edits.size, 0);
  game.dimension = "overworld";
  multiplayer.applyState({
    dimension: "overworld",
    edits,
    time: 1000,
    tickCount: 20,
    worldTick: 20,
    entities: [],
    drops: [],
  });
  assert.equal(world.edits.size, 100);
  assert.equal(world.get(99, 200, 0), B.planks);
  assert.equal(world.pending.length, 0);
});
test("congested multiplayer connections end explicitly instead of silently dropping edit deltas", async () => {
  const { Multiplayer } = await import("../src/multiplayer.js");
  const multiplayer = new Multiplayer({});
  let closed, sent;
  multiplayer.socket = {
    readyState: WebSocket.OPEN,
    bufferedAmount: 4 * 1024 * 1024,
    close: (...a) => (closed = a),
    send: (value) => (sent = value),
  };
  assert.equal(
    multiplayer.send({ type: "state", state: { edits: [] } }),
    false,
  );
  assert.equal(sent, undefined);
  assert.equal(closed[0], 4001);
  assert.match(multiplayer.endReason, /too slow/);
  multiplayer.socket.bufferedAmount = 0;
  assert.equal(multiplayer.send({ type: "ping", at: 42 }), true);
  assert.deepEqual(JSON.parse(sent), { type: "ping", at: 42 });
});
