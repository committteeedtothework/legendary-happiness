import { PROTOCOL } from "../server/protocol.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createRelay, MAX_PLAYERS } from "../server/relay.mjs";

async function client(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/relay`),
    queue = [],
    waiters = [];
  ws.on("message", (data) => {
    const m = JSON.parse(data);
    const i = waiters.findIndex((w) => w.type === m.type);
    if (i >= 0) {
      const [w] = waiters.splice(i, 1);
      clearTimeout(w.timer);
      w.resolve(m);
    } else queue.push(m);
  });
  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  return {
    ws,
    send: (m) => ws.send(JSON.stringify(m)),
    next: (type) =>
      new Promise((resolve, reject) => {
        const i = queue.findIndex((m) => m.type === type);
        if (i >= 0) return resolve(queue.splice(i, 1)[0]);
        const w = {
          type,
          resolve,
          timer: setTimeout(() => reject(Error(`Missing ${type}`)), 2000),
        };
        waiters.push(w);
      }),
  };
}
async function fixture(t) {
  const relay = createRelay(),
    { port } = await relay.listen(0, "127.0.0.1");
  t.after(() => relay.close());
  const host = await client(port);
  host.send({ type: "create", protocol: PROTOCOL, name: "Host" });
  const room = await host.next("created");
  return { relay, port, host, room };
}
async function join(port, room, name = "Guest") {
  const guest = await client(port);
  guest.send({
    type: "join",
    protocol: PROTOCOL,
    name,
    room: room.room,
    key: room.key,
  });
  return guest;
}
test("relay routes invitations, full snapshots, player poses, commands, acknowledgements and chat", async (t) => {
  const { port, host, room } = await fixture(t),
    guest = await join(port, room, "<Guest>");
  const joined = await guest.next("joined"),
    peer = await host.next("peer-join");
  assert.equal(peer.id, joined.id);
  host.send({
    type: "welcome",
    to: peer.id,
    world: { seed: "example", edits: { "0,100,0": 1 } },
  });
  assert.equal((await guest.next("welcome")).world.seed, "example");
  guest.send({ type: "pose", pose: { x: 1, y: 100, z: 0 } });
  assert.equal((await host.next("pose")).pose.x, 1);
  guest.send({
    type: "command",
    seq: 1,
    kind: "break",
    held: "diamond_pickaxe",
  });
  assert.equal((await host.next("command")).id, peer.id);
  host.send({ type: "ack", to: peer.id, seq: 1, ok: true });
  assert.equal((await guest.next("ack")).ok, true);
  guest.send({
    type: "command",
    seq: 2,
    kind: "pistol",
    held: "matthew_dual_pistols",
  });
  const fire = await host.next("command");
  assert.equal(fire.kind, "pistol");
  assert.equal(fire.id, peer.id);
  host.send({
    type: "ack",
    to: peer.id,
    seq: 2,
    ok: true,
    cooldowns: { matthewHand: 1, matthewShotTick: 44 },
  });
  assert.deepEqual((await guest.next("ack")).cooldowns, {
    matthewHand: 1,
    matthewShotTick: 44,
  });
  assert.equal(guest.ws.readyState, WebSocket.OPEN);
  host.send({ type: "state", state: { time: 900 } });
  assert.equal((await guest.next("state")).state.time, 900);
  guest.send({ type: "chat", message: "Hello\u0000 world" });
  assert.equal((await host.next("chat")).message, "Hello world");
  assert.equal((await guest.next("chat")).name, "<Guest>");
  guest.send({ type: "ping", at: 123 });
  assert.equal((await guest.next("pong")).at, 123);
});
test("relay rejects invalid secrets, mismatched protocol, oversized poses and forged guest state", async (t) => {
  const { port, host, room } = await fixture(t),
    bad = await join(port, { ...room, key: "wrong" });
  assert.match((await bad.next("error")).message, /invalid/);
  const old = await client(port);
  old.send({ type: "create", protocol: 3 });
  assert.match((await old.next("error")).message, /versions/);
  const guest = await join(port, room);
  await guest.next("joined");
  guest.send({ type: "state", state: { edits: [] } });
  assert.match((await guest.next("error")).message, /cannot change/);
  const large = await join(port, room);
  await large.next("joined");
  large.send({ type: "pose", pose: { payload: "x".repeat(3000) } });
  assert.match((await large.next("error")).message, /pose/);
  assert.equal(host.ws.readyState, WebSocket.OPEN);
});
test("room capacity is bounded and the host can remove members", async (t) => {
  const { port, host, room } = await fixture(t),
    guests = [];
  for (let i = 1; i < MAX_PLAYERS; i++) {
    const g = await join(port, room, `Player ${i}`);
    guests.push({ g, id: (await g.next("joined")).id });
  }
  const full = await join(port, room);
  assert.match((await full.next("error")).message, /full/);
  const peer = guests[0];
  host.send({ type: "kick", id: peer.id });
  assert.match((await peer.g.next("ended")).reason, /removed/);
  await host.next("peer-left");
  const replacement = await join(port, room);
  await replacement.next("joined");
});
test("host departure ends the room instead of giving guests independent conflicting worlds", async (t) => {
  const { relay, port, host, room } = await fixture(t),
    guest = await join(port, room);
  await guest.next("joined");
  host.ws.close();
  assert.match((await guest.next("ended")).reason, /host closed/);
  assert.equal(relay.rooms.size, 0);
  const health = await fetch(`http://127.0.0.1:${port}/health`);
  assert.deepEqual(await health.json(), { ok: true, protocol: PROTOCOL });
});

test("relay routes Survival inputs and private inventories only between each guest and host", async (t) => {
  const { port, host, room } = await fixture(t),
    guest = await join(port, room);
  const peer = await host.next("peer-join");
  await guest.next("joined");
  guest.send({
    type: "input",
    input: { yaw: 0, pitch: 0, keys: ["KeyW"], selected: 0 },
  });
  assert.equal((await host.next("input")).id, peer.id);
  guest.send({
    type: "command",
    seq: 1,
    kind: "inventory",
    selected: 2,
    payload: { action: "slot", ref: "inventory", index: 2 },
  });
  const command = await host.next("command");
  assert.equal(command.selected, 2);
  assert.equal(command.payload.index, 2);
  host.send({
    type: "private-state",
    to: peer.id,
    state: { inventory: { slots: [{ id: "log", count: 2 }] } },
  });
  assert.equal(
    (await guest.next("private-state")).state.inventory.slots[0].count,
    2,
  );
  guest.send({ type: "chat", message: "/give @s diamond 64" });
  assert.match((await guest.next("chat")).message, /owner/);
  host.send({ type: "announcement", message: "A host announcement" });
  assert.equal((await guest.next("chat")).name, "World");
});
test("public relay address is operator-configured and advertised for internet invitation links", async (t) => {
  const relay = createRelay({ publicURL: "https://play.example.com" }),
    { port } = await relay.listen(0, "127.0.0.1");
  t.after(() => relay.close());
  const host = await client(port);
  host.send({
    type: "create",
    protocol: PROTOCOL,
    name: "Host",
    publicURL: "https://untrusted.invalid",
  });
  assert.equal(
    (await host.next("created")).publicURL,
    "https://play.example.com",
  );
  for (const publicURL of [
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/subpath",
    "https://example.com/#secret",
  ])
    assert.throws(() => createRelay({ publicURL }));
});

test("deployed-address checker verifies both HTTP protocol and WebSocket upgrades", async (t) => {
  const { port } = await fixture(t),
    { checkAddress } = await import("../server/check-address.mjs");
  assert.match(
    await checkAddress(`http://127.0.0.1:${port}`),
    /HTTP and WebSocket connected/,
  );
  await assert.rejects(checkAddress("file:///game.html"), /HTTP/);
});
