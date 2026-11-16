import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./multiplayer-fixture.js";
import { B, makeStack } from "../src/data.js";
import { buildPortal } from "../src/portals.js";
import { tickPeer, peerSave, respawnPeer } from "../src/coop-survival.js";
import { playerActors } from "../src/pvp.js";
import { selectRealm } from "../src/realms.js";
const setup = () => {
  const f = fixture();
  f.game.realms = {};
  f.game.renderer.setWorld = () => {};
  f.game.renderer.loadAround = () => {};
  f.game.audio = { tone() {} };
  f.game.settings.renderDistance = 2;
  return f;
};
test("guest can travel alone through a real Cinder portal and return without moving the owner or losing items", () => {
  const { game: g, peer, session: m } = setup(),
    owner = { ...g.player },
    world = g.world;
  peer.inventory.slots[0] = makeStack("diamond", 3);
  const frame = { x: 2, y: 200, z: 4, axis: "x" };
  buildPortal(world, frame);
  Object.assign(peer.player, { x: 3.5, y: 201.01, z: 4.5, onGround: true });
  assert.equal(m.sharedRealm.travelPeer(peer, frame), true);
  assert.equal(peer.dimension, "cinderwild");
  assert.equal(g.dimension, "overworld");
  assert.equal(g.world, world);
  assert.equal(g.player.x, owner.x);
  assert.equal(peer.inventory.slots[0].count, 3);
  assert.equal(peer.awaitingRealm, true);
  const dest = Object.values(peer.context.world.portals)[0];
  assert.ok(dest);
  peer.awaitingRealm = false;
  m.sharedRealm.travelPeer(peer, dest);
  assert.equal(peer.dimension, "overworld");
  assert.equal(peer.context.world, world);
  assert.equal(peer.inventory.slots[0].count, 3);
  assert.throws(() => selectRealm(peer.context, "end"), /portal/);
});
test("End entry is per player; death returns the guest to their Overworld spawn and the End stays saved", () => {
  const { game: g, peer, session: m } = setup();
  g.world.set(2, 200, 4, B.end_portal);
  Object.assign(peer.player, { x: 2.5, y: 200, z: 4.5 });
  m.sharedRealm.tickPeerTravel(peer);
  assert.equal(peer.dimension, "end");
  assert.equal(g.dimension, "overworld");
  assert.equal(peer.player.x, 96.5);
  assert.ok(peer.context.world.endgame);
  peer.player.health = 0;
  respawnPeer(m, peer);
  assert.equal(peer.dimension, "overworld");
  assert.equal(peer.player.health, 20);
  assert.equal(peer.context.world, g.world);
  assert.ok(g.realms.end.world.endgame);
});
test("same-realm actors share one world; different realms cannot PvP or transfer into another realm container", () => {
  const { game: g, peer, session: m } = setup();
  m.addPeer({ id: "two", name: "Two" });
  const p2 = m.peers.get("two");
  p2.awaitingRealm = false;
  const f = { x: 2, y: 200, z: 4, axis: "x" };
  buildPortal(g.world, f);
  m.sharedRealm.travelPeer(peer, f);
  m.sharedRealm.travelPeer(p2, f);
  assert.equal(peer.context.world, p2.context.world);
  g.rules = { pvp: true };
  assert.deepEqual(
    playerActors(peer.context)
      .map((p) => p.id)
      .sort(),
    ["guest", "two"],
  );
  assert.deepEqual(
    playerActors(g).map((p) => p.id),
    ["host"],
  );
  peer.context.world.set(4, 110, 4, B.gold_block);
  m.sharedRealm.sync();
  assert.equal(g.world.get(4, 110, 4) === B.gold_block, false);
  assert.equal(g.realms.cinderwild.world.get(4, 110, 4), B.gold_block);
});
test("owner realm changes do not relocate guests; returning and saved guest realms retain their positions", () => {
  const { game: g, peer, session: m } = setup();
  const f = { x: 2, y: 200, z: 4, axis: "x" };
  buildPortal(g.world, f);
  m.sharedRealm.travelPeer(peer, f);
  const pos = { x: peer.player.x, y: peer.player.y, z: peer.player.z };
  selectRealm(g, "end");
  assert.equal(peer.dimension, "cinderwild");
  assert.deepEqual(
    { x: peer.player.x, y: peer.player.y, z: peer.player.z },
    pos,
  );
  const record = peerSave(peer);
  assert.equal(record.dimension, "cinderwild");
  selectRealm(g, "overworld");
  assert.equal(peer.dimension, "cinderwild");
  assert.deepEqual(
    { x: peer.player.x, y: peer.player.y, z: peer.player.z },
    pos,
  );
});

test("realm packets target only that dimension and old input/action epochs cannot move the guest", async () => {
  const { sendRealmFrames } =
    await import("../src/multiplayer-realms-network.js");
  const { game: g, peer, session: m } = setup();
  m.addPeer({ id: "other", name: "Other" });
  const other = m.peers.get("other");
  other.awaitingRealm = false;
  const oldEpoch = peer.realmEpoch;
  g.world.set(2, 200, 4, B.end_portal);
  Object.assign(peer.player, { x: 2.5, y: 200, z: 4.5 });
  m.sharedRealm.tickPeerTravel(peer);
  peer.awaitingRealm = false;
  const yaw = peer.player.yaw;
  m.receiveInput({
    id: peer.id,
    input: { realmEpoch: oldEpoch, keys: ["KeyW"], yaw: 1, pitch: 0 },
  });
  assert.equal(peer.player.yaw, yaw);
  assert.equal(peer.keys.has("KeyW"), false);
  m.execute({
    id: peer.id,
    realmEpoch: oldEpoch,
    seq: 99,
    kind: "inventory",
    payload: {},
  });
  assert.equal(m.sent.at(-1).ok, false);
  m.sent = [];
  sendRealmFrames(m, 1000, { poseFor: () => g.player, cleanPose: (p) => p });
  const frames = m.sent.filter((x) => x.type === "state");
  assert.equal(frames.length, 2);
  assert.equal(frames.find((x) => x.to === peer.id).state.dimension, "end");
  assert.equal(
    frames.find((x) => x.to === "other").state.dimension,
    "overworld",
  );
  assert.equal(
    frames.find((x) => x.to === peer.id).state.realmEpoch,
    peer.realmEpoch,
  );
});
test("authenticated guest reconnects to their saved dimension and inventory with a new connection ID", () => {
  const { game: g, peer, session: m } = setup();
  peer.accountId = "account-guest";
  peer.inventory.slots[0] = makeStack("diamond", 7);
  g.world.set(2, 200, 4, B.end_portal);
  Object.assign(peer.player, { x: 2.5, y: 200, z: 4.5 });
  m.sharedRealm.tickPeerTravel(peer);
  m.stashPeer(peer.id);
  m.peers.delete(peer.id);
  m.addPeer({
    id: "reconnected",
    name: "Friend One",
    accountId: "account-guest",
  });
  const next = m.peers.get("reconnected");
  assert.equal(next.dimension, "end");
  assert.equal(next.inventory.slots[0].count, 7);
  assert.equal(next.player.x, peer.player.x);
  assert.equal(next.context.world, g.realms.end.world);
  assert.equal(g.dimension, "overworld");
});

test("End victory while the owner is elsewhere rewards the guest, never the background anchor or overworld owner", async () => {
  const { tickEndWorld } = await import("../src/end-runtime.js"),
    { damageEntity, dropItem } = await import("../src/simulation.js");
  const { game: g, peer, session: m } = setup();
  g.world.set(2, 200, 4, B.end_portal);
  Object.assign(peer.player, { x: 2.5, y: 200, z: 4.5 });
  m.sharedRealm.tickPeerTravel(peer);
  const end = m.sharedRealm.contextFor("end"),
    api = { damageEntity, dropItem };
  tickEndWorld(end, api);
  const dragon = end.entities.find((e) => e.type === "dragoon");
  assert.ok(dragon);
  const ownerXP = g.player.xp || 0,
    guestXP = peer.player.xp || 0;
  damageEntity(peer.context, dragon, 10000, { knockback: 0 });
  for (let i = 0; i < 105; i++) {
    end.tickCount++;
    tickEndWorld(end, api);
  }
  assert.equal(end.world.endgame.defeated, true);
  assert.equal(g.player.xp || 0, ownerXP);
  assert.equal(peer.player.xp, guestXP + 12000);
  assert.equal(peer.standAnnouncement.title, "DRAGOON DEFEATED");
});
