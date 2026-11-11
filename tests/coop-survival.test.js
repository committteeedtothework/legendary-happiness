import test from "node:test";
import assert from "node:assert/strict";
import { Multiplayer } from "../src/multiplayer.js";
import { World } from "../src/world.js";
import { B, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { UI } from "../src/ui.js";
import {
  cleanInput,
  damagePeer,
  inventoryOperation,
  stepPeer,
  tickPeer,
  peerSave,
} from "../src/coop-survival.js";
import { runOwnerCommand, tokenizeCommand } from "../src/chat.js";
import { hostileTarget } from "../src/defenders.js";
import {
  creeperExplosion,
  fireHostileProjectile,
  tickHostileProjectiles,
} from "../src/hostile-combat.js";
import { damageEntity, dropItem } from "../src/simulation.js";
import { pack, unpack } from "../src/storage.js";
function fixture() {
  const world = new World("Co-op authority");
  for (let x = -5; x < 12; x++)
    for (let z = -8; z < 12; z++) world.set(x, 199, z, B.stone);
  const game = {
    world,
    active: true,
    id: "test",
    mode: "survival",
    dimension: "overworld",
    time: 14000,
    tickCount: 1,
    elapsed: 1,
    difficulty: "normal",
    spawn: { x: 0.5, y: 200, z: 4.5 },
    player: createPlayer({ x: 0.5, y: 200, z: 4.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    settings: { particles: "minimal" },
    chat: { announce() {} },
    renderer: { breakParticles() {}, pulseEffect() {} },
    save: async () => {},
    snapshot() {
      return {
        mode: this.mode,
        player: this.player,
        inventory: this.inventory.export(),
        coopPlayers: this.multiplayer.exportPlayers(),
      };
    },
    damage(n) {
      this.player.health = Math.max(0, this.player.health - n);
    },
    breakBlock(t) {
      this.world.set(t.x, t.y, t.z, B.air);
      dropItem(this, makeStack("log"), t.x + 0.5, t.y + 0.5, t.z + 0.5, 0);
    },
  };
  game.ui = Object.assign(Object.create(UI.prototype), {
    game,
    updateHotbar() {},
    updateHUD() {},
  });
  const session = (game.multiplayer = new Multiplayer(game));
  session.connected = true;
  session.id = "host";
  session.players = [{ id: "host", name: "Owner" }];
  session.send = (data) => {
    session.sent.push(structuredClone(data));
    return true;
  };
  session.sent = [];
  session.addPeer({ id: "guest", name: "Friend One" });
  const peer = session.peers.get("guest");
  Object.assign(peer.player, {
    x: 2.5,
    y: 200,
    z: 4.5,
    onGround: true,
    yaw: 0,
    pitch: 0,
  });
  peer.context.player = peer.player;
  return { game, session, peer };
}
test("Survival inputs contain only whitelisted controls and cannot teleport, fly, set health or select invalid slots", () => {
  const { game, session, peer } = fixture();
  session.receiveInput({
    id: "guest",
    input: {
      yaw: 0,
      pitch: 0,
      x: 9999,
      flying: true,
      health: 999,
      keys: ["KeyW", "Exploit", "KeyW"],
      selected: 90,
      skin: "dante",
    },
  });
  assert.equal(peer.player.x, 2.5);
  assert.equal(peer.player.health, 20);
  assert.equal(peer.player.flying, false);
  assert.deepEqual([...peer.keys], ["KeyW"]);
  assert.equal(peer.inventory.selected, 0);
  for (let i = 0; i < 60; i++) stepPeer(session, peer, 1 / 60);
  assert.ok(peer.player.z < 4.5 && peer.player.z > -0.2);
  assert.equal(game.player.x, 0.5);
  assert.equal(cleanInput({ yaw: NaN, pitch: 0 }), null);
});
test("Host mining requires real elapsed physics ticks and cannot be completed by a forged break command", () => {
  const { game, session, peer } = fixture();
  game.world.set(2, 201, 2, B.log);
  peer.mine = true;
  session.execute({ id: "guest", seq: 1, kind: "break", held: "diamond_axe" });
  assert.equal(game.world.get(2, 201, 2), B.log);
  stepPeer(session, peer, 1 / 60);
  assert.equal(game.world.get(2, 201, 2), B.log);
  for (let i = 0; i < 181; i++) {
    peer.lastPose = performance.now();
    game.elapsed += 1 / 60;
    stepPeer(session, peer, 1 / 60);
  }
  assert.equal(game.world.get(2, 201, 2), B.air);
  assert.ok(game.drops.length >= 1);
});
test("Guest crafting consumes real host ingredients once and invalid inventory references cannot create items", () => {
  const { session, peer } = fixture();
  peer.menu = { type: "personal" };
  peer.inventory.craft[0] = makeStack("log");
  assert.equal(inventoryOperation(session, peer, { action: "craft" }), true);
  assert.equal(peer.inventory.cursor.id, "planks");
  assert.equal(peer.inventory.cursor.count, 4);
  inventoryOperation(session, peer, { action: "craft" });
  assert.equal(peer.inventory.cursor.count, 4);
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "creative",
      index: 0,
    }),
    false,
  );
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "inventory",
      index: -1,
    }),
    false,
  );
  const m = {
    id: "guest",
    seq: 8,
    kind: "inventory",
    payload: { action: "slot", ref: "inventory", index: 0 },
  };
  session.execute(m);
  session.execute(m);
  assert.equal(peer.inventory.slots[0].count, 4);
  assert.equal(peer.inventory.cursor, null);
});
test("Shared chest transfers use current host slots and repeated clicks conserve total items", () => {
  const { session, peer } = fixture();
  const slots = Array(27).fill(null);
  slots[0] = makeStack("diamond", 3);
  peer.menu = { type: "chest", container: { type: "chest", slots } };
  inventoryOperation(session, peer, {
    action: "slot",
    ref: "container",
    index: 0,
    shift: true,
  });
  inventoryOperation(session, peer, {
    action: "slot",
    ref: "container",
    index: 0,
    shift: true,
  });
  assert.equal(peer.inventory.slots[0].count, 3);
  assert.equal(slots[0], null);
});
test("Host applies damage, drops cursor/crafting/armor exactly once, and alone authorizes respawn", () => {
  const { game, session, peer } = fixture();
  peer.inventory.slots[0] = makeStack("log", 2);
  peer.inventory.cursor = makeStack("diamond");
  peer.inventory.craft[0] = makeStack("stick");
  peer.inventory.equipment[0] = makeStack("iron_helmet");
  damagePeer(session, peer, 100, "a test");
  const count = game.drops.reduce((n, d) => n + d.count, 0);
  assert.equal(count, 5);
  assert.equal(peer.player.health, 0);
  damagePeer(session, peer, 100, "again");
  assert.equal(
    game.drops.reduce((n, d) => n + d.count, 0),
    count,
  );
  session.execute({ id: "guest", seq: 1, kind: "respawn" });
  assert.equal(peer.player.health, 20);
  assert.ok(peer.inventory.slots.every((s) => s === null));
  session.execute({ id: "guest", seq: 2, kind: "respawn" });
  assert.equal(
    game.drops.reduce((n, d) => n + d.count, 0),
    count,
  );
});
test("Guest pickup is a single shared transaction and hunger/oxygen advance without advancing world time again", () => {
  const { game, session, peer } = fixture();
  game.drops = [{ id: "log", count: 3, x: 2.5, y: 200.5, z: 4.5, delay: 0 }];
  peer.player.exhaustion = 4;
  peer.player.underwater = true;
  peer.player.saturation = 0;
  const time = game.time;
  tickPeer(session, peer);
  tickPeer(session, peer);
  assert.equal(peer.inventory.slots[0].count, 3);
  assert.equal(game.drops.length, 0);
  assert.equal(peer.player.food, 19);
  assert.equal(peer.player.oxygen, 298);
  assert.equal(game.time, time);
});
test("Reconnect credentials are private, records survive checksummed saves, and simultaneous reuse is rejected", () => {
  const { game, session, peer } = fixture();
  peer.inventory.slots[0] = makeStack("diamond", 2);
  peer.player.health = 9;
  const first = session.sent.find((m) => m.type === "welcome");
  assert.equal(first.world.coopPlayers, undefined);
  assert.equal(first.world.resumeToken, peer.resume);
  assert.notEqual(peer.resume, session.id);
  const saved = unpack(pack(session.exportPlayers()));
  session.stashPeer("guest");
  session.peers.delete("guest");
  session.restorePlayers(saved);
  session.addPeer({ id: "returning", name: "New name", resume: peer.resume });
  const returning = session.peers.get("returning");
  assert.equal(returning.inventory.slots[0].count, 2);
  assert.equal(returning.player.health, 9);
  session.addPeer({ id: "duplicate", name: "Dupe", resume: peer.resume });
  assert.equal(session.peers.has("duplicate"), false);
  assert.ok(
    session.sent.some((m) => m.type === "kick" && m.id === "duplicate"),
  );
});
test("Hostiles target a nearby living guest and projectiles/explosions damage their host record", () => {
  const { game, session, peer } = fixture();
  game.player.x = 40;
  const zombie = { type: "zombie", x: 2.5, y: 200, z: 3.5 };
  assert.equal(hostileTarget(game, zombie), peer.player);
  const hp = peer.player.health;
  creeperExplosion(
    game,
    { type: "creeper", x: 2.5, y: 200, z: 3.5 },
    damageEntity,
    dropItem,
  );
  assert.ok(peer.player.health < hp);
  assert.equal(game.player.health, 20);
  peer.player.health = 20;
  peer.player.hurt = 0;
  game.hostileProjectiles = [];
  const source = { id: "s", type: "skeleton", x: 2.5, y: 200, z: 1.5 };
  fireHostileProjectile(game, source, peer.player);
  for (let i = 0; i < 12; i++) tickHostileProjectiles(game, damageEntity);
  assert.ok(peer.player.health < 20);
});
test("Owner commands support quoted names and deny guests before every mutation", async () => {
  const { game, session, peer } = fixture();
  assert.deepEqual(tokenizeCommand('/give "Friend One" log 2'), [
    "/give",
    "Friend One",
    "log",
    "2",
  ]);
  await runOwnerCommand(game, '/give "Friend One" log 2');
  assert.equal(peer.inventory.slots[0].count, 2);
  await runOwnerCommand(game, "/time set night");
  assert.equal(game.time % 24000, 14000);
  await runOwnerCommand(game, "/weather rain");
  assert.equal(game.world.weather.kind, "rain");
  game.player.health = 8;
  await runOwnerCommand(game, '/tp @s "Friend One"');
  assert.equal(game.player.x, peer.player.x);
  assert.equal(game.player.health, 8);
  session.isGuest = true;
  await assert.rejects(runOwnerCommand(game, "/give @s diamond 64"), /Only/);
  await assert.rejects(runOwnerCommand(game, "/time day"), /Only/);
  assert.equal(game.inventory.slots[0], null);
});
test("Invalid owner commands and full inventory grants fail without item loss or world changes", async () => {
  const { game } = fixture();
  game.inventory.slots = Array.from({ length: 36 }, () =>
    makeStack("stone", 64),
  );
  game.inventory.slots[0] = makeStack("log", 63);
  await assert.rejects(runOwnerCommand(game, "/give @s log 2"), /space/);
  assert.equal(game.inventory.slots[0].count, 63);
  for (const command of [
    "/time -1",
    "/weather invalid",
    "/difficulty impossible",
    "/give @s nonexistent 1",
    "/give @s log -2",
    "/tp @s NaN 200 0",
    "/tp @s 0 -999 0",
  ])
    await assert.rejects(runOwnerCommand(game, command));
});

test("closing an inventory does not consume the next world interaction cooldown", () => {
  const { game, session } = fixture();
  session.sessionReady = true;
  session.lastCommand = -1000;
  game.renderer.action = () => {};
  assert.equal(session.command("close"), true);
  assert.equal(session.lastCommand, -1000);
  assert.equal(session.command("use"), true);
});
test("rejoining with zero health opens the death screen rather than trapping a guest in pause", () => {
  const { game, session, peer } = fixture();
  game.keys = new Set();
  game.player.health = 0;
  game.pause = () => {};
  game.ui.screen = "pause";
  game.ui.death = () => {
    game.ui.screen = "death";
  };
  session.applyPrivate({
    player: { ...peer.player, health: 0 },
    inventory: peer.inventory.export(),
    spawn: peer.spawn,
  });
  assert.equal(game.ui.screen, "death");
});
test("replacing a container invalidates an old open view before any transfer can duplicate its dropped contents", () => {
  const { game, session, peer } = fixture();
  game.world.set(2, 201, 2, B.chest);
  const key = "2,201,2",
    old = { type: "chest", slots: Array(27).fill(null) };
  old.slots[0] = makeStack("diamond", 3);
  peer.menu = {
    type: "chest",
    container: old,
    target: { x: 2, y: 201, z: 2, id: B.chest },
  };
  game.world.containers[key] = { type: "chest", slots: Array(27).fill(null) };
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "container",
      index: 0,
      shift: true,
    }),
    false,
  );
  assert.ok(peer.inventory.slots.every((s) => s === null));
});

test("idle guest prediction converges to the host before precision placement, without snapping every small moving update", () => {
  const { game, session } = fixture();
  game.keys = new Set();
  game.running = true;
  game.ui.screen = "play";
  session.applyPrivate({
    player: { ...game.player, x: 0.8 },
    inventory: game.inventory.export(),
    spawn: game.spawn,
  });
  assert.equal(game.player.x, 0.8);
  game.keys.add("KeyW");
  session.applyPrivate({
    player: { ...game.player, x: 1.1 },
    inventory: game.inventory.export(),
    spawn: game.spawn,
  });
  assert.equal(game.player.x, 0.8);
});

test("offhand storage uses host-authoritative slot operations, bounds checks, death drops and saved inventory", () => {
  const { game, session, peer } = fixture();
  peer.menu = { type: "personal" };
  peer.inventory.cursor = makeStack("shield");
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "offhand",
      index: 0,
    }),
    true,
  );
  assert.equal(peer.inventory.offhand[0].id, "shield");
  assert.equal(peer.inventory.cursor, null);
  assert.equal(new Inventory(peerSave(peer).inventory).offhand[0].id, "shield");
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "offhand",
      index: 1,
    }),
    false,
  );
  peer.menu = { type: "table" };
  assert.equal(
    inventoryOperation(session, peer, {
      action: "slot",
      ref: "offhand",
      index: 0,
    }),
    false,
  );
  peer.menu = { type: "personal" };
  damagePeer(session, peer, 100, "offhand test");
  assert.equal(peer.inventory.offhand[0], null);
  assert.equal(game.drops.filter((s) => s.id === "shield").length, 1);
});
