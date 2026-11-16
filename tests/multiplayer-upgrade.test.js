import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./multiplayer-fixture.js";
import { normalizeWorldRules } from "../src/world-rules.js";
import { runOwnerCommand } from "../src/chat.js";
import { damagePvP, pvpActors } from "../src/pvp.js";
import { damagePeer, peerSave } from "../src/coop-survival.js";
import { makeStack, B } from "../src/data.js";
import { selectRealm } from "../src/realms.js";
import { arenaFrame } from "../src/multiplayer-arena.js";
import {
  titanSession,
  stepTitan,
  titanInput,
} from "../src/giganto-simulation.js";
import {
  wyvernSession,
  stepWyvern,
  wyvernInput,
} from "../src/wyvern-simulation.js";
import { lockTitanCinematics } from "../src/titan-finale.js";
import { createWatchRouter } from "../server/watch.mjs";
import { routeArena } from "../server/arena.mjs";
import {
  cleanRemoteAction,
  recordPeerAction,
} from "../src/multiplayer-animation.js";

test("new Survival rules require cheats opt-in; old worlds preserve behavior", () => {
  const fresh = normalizeWorldRules({}, { legacy: false });
  assert.equal(fresh.cheats, false);
  assert.equal(fresh.pvp, true);
  const old = normalizeWorldRules();
  assert.equal(old.cheats, true);
  assert.equal(old.pvp, false);
  assert.equal(
    normalizeWorldRules({}, { legacy: false, mode: "creative" }).cheats,
    true,
  );
  assert.equal(
    normalizeWorldRules({ cheats: "false", pvp: "false", keepInventory: "on" })
      .keepInventory,
    true,
  );
});
test("creator commands enforce cheats, validate before mutation and handle custom inventories", async () => {
  const { game: g, peer } = fixture();
  g.rules = { cheats: false };
  await assert.rejects(runOwnerCommand(g, "/give @a diamond 2"), /disabled/);
  assert.match(await runOwnerCommand(g, "/list"), /Friend/);
  g.rules.cheats = true;
  await runOwnerCommand(g, "/gamerule pvp true");
  assert.equal(g.rules.pvp, true);
  await runOwnerCommand(g, "/give @a hellfire_ingot 2");
  assert.equal(
    peer.inventory.slots.find((s) => s?.id === "hellfire_ingot").count,
    2,
  );
  const before = JSON.stringify(g.inventory.export());
  peer.inventory.slots.fill(makeStack("stone", 64));
  await assert.rejects(runOwnerCommand(g, "/give @a diamond 64"), /space/);
  assert.equal(JSON.stringify(g.inventory.export()), before);
  const edits = JSON.stringify(g.world.exportEdits());
  await assert.rejects(
    runOwnerCommand(g, "/fill 0 200 0 100 230 100 stone"),
    /4096/,
  );
  assert.equal(JSON.stringify(g.world.exportEdits()), edits);
  await runOwnerCommand(g, "/setblock ~ 202 ~ stone");
  assert.equal(g.world.get(0, 202, 4), B.stone);
  await runOwnerCommand(g, "/effect give guest resistance 30 2");
  assert.deepEqual(peer.player.effects.resistance, { ticks: 600, level: 3 });
  await runOwnerCommand(g, "/effect clear guest");
  assert.deepEqual(peer.player.effects, {});
  peer.inventory.slots[0] = makeStack("iron_sword");
  peer.inventory.selected = 0;
  await runOwnerCommand(g, "/enchant guest sharpness 2");
  assert.equal(peer.inventory.held.enchantments.sharpness, 2);
  await runOwnerCommand(g, "/clear guest iron_sword");
  assert.equal(peer.inventory.held, null);
});
test("PvP is opt-in for legacy worlds, capped, reciprocal and never targets away or trial players", () => {
  const { game: g, peer } = fixture();
  assert.equal(pvpActors(g).length, 0);
  g.rules = { pvp: true };
  let target = pvpActors(g)[0];
  assert.equal(damagePvP(g, target, 100), 12);
  assert.equal(peer.player.health, 8);
  assert.equal(damagePvP(g, target, 100), 0);
  peer.player.hurt = 0;
  const host = pvpActors(peer.context, peer.player).find(
    (p) => p.pvpId === "host",
  );
  assert.ok(host);
  assert.ok(damagePvP(peer.context, host, 4, { attacker: peer.player }) > 0);
  assert.ok(g.player.health < 20);
  peer.player.multiplayerAway = true;
  assert.equal(pvpActors(g).length, 0);
  assert.equal(damagePvP(g, target, 100), 0);
  delete peer.player.multiplayerAway;
  peer.player.standData = { trial: { phase: "trial" } };
  assert.equal(pvpActors(g).length, 0);
  delete peer.player.standData;
  g.mode = "creative";
  assert.deepEqual(pvpActors(g), []);
  assert.equal(damagePvP(g, target, 100), 0);
});
test("custom PvP range caps, death attribution, drops, keepInventory and away saves are authoritative", () => {
  const { game: g, peer, session } = fixture();
  g.rules = { pvp: true };
  const target = pvpActors(g)[0];
  peer.player.x = 30;
  assert.equal(damagePvP(g, target, 6), 0);
  assert.ok(damagePvP(g, target, 6, { kind: "bullet" }) > 0);
  peer.player.x = 2;
  peer.player.hurt = 0;
  peer.player.health = 1;
  peer.inventory.slots[0] = makeStack("hellfire_ingot", 3);
  damagePvP(g, target, 6);
  assert.equal(peer.player.health, 0);
  assert.equal(g.player.multiplayerStats.kills, 1);
  assert.equal(peer.player.multiplayerStats.deaths, 1);
  assert.ok(g.drops.some((s) => s.id === "hellfire_ingot"));
  damagePvP(g, target, 6);
  assert.equal(g.player.multiplayerStats.kills, 1);
  peer.player.health = 20;
  peer.player.hurt = 0;
  g.rules.keepInventory = true;
  peer.inventory.slots[0] = makeStack("diamond", 4);
  damagePeer(session, peer, 99, "test");
  assert.equal(peer.inventory.slots[0].count, 4);
  peer.player.multiplayerAway = true;
  assert.equal(peerSave(peer).player.multiplayerAway, undefined);
});
test("watch routing requires host approval and active membership; frames and signals stay scoped and bounded", () => {
  const host = { id: "h", name: "Host", bufferedAmount: 0 },
    a = { id: "a", name: "A", bufferedAmount: 0 },
    b = { id: "b", name: "B", bufferedAmount: 0 },
    sent = [];
  const room = {
      host,
      guests: new Map([
        ["a", a],
        ["b", b],
      ]),
    },
    send = (ws, m) => {
      if (ws) sent.push([ws.id, m]);
    },
    r = createWatchRouter(room, send);
  assert.throws(
    () => r.route(a, { type: "watch-approved", to: "a", target: "h" }),
    /host/,
  );
  assert.throws(
    () => r.route(a, { type: "watch-signal", to: "b", signal: {} }),
    /active/,
  );
  r.route(a, { type: "watch-request", target: "h" });
  assert.equal(sent.at(-1)[0], "h");
  r.route(host, { type: "watch-approved", to: "a", target: "h" });
  sent.length = 0;
  r.route(host, {
    type: "watch-frame",
    seq: 1,
    image: "data:image/jpeg;base64,AAAA",
    meta: { title: "Arena", health: 90 },
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "a");
  assert.equal(sent[0][1].meta.health, 1);
  host.watchAt = 0;
  a.bufferedAmount = 1e6;
  sent.length = 0;
  r.route(host, {
    type: "watch-frame",
    seq: 2,
    image: "data:image/jpeg;base64,AAAA",
  });
  assert.equal(sent.length, 0);
  r.leave("h");
  assert.equal(r.watches.size, 0);
  assert.throws(
    () => routeArena(room, a, { type: "arena-response", to: "b" }, send),
    /host/,
  );
  routeArena(
    room,
    a,
    { type: "arena-request", request: 1, action: "begin", id: "h" },
    send,
  );
  assert.equal(sent.at(-1)[1].id, "a");
});
test("arena input replay is deterministic for both Titans; invalid tokens, oversized input and forged victory cannot grant loot", () => {
  for (const [kind, make, step] of [
    ["giganto", titanSession, stepTitan],
    ["wyvern", wyvernSession, stepWyvern, wyvernInput],
  ]) {
    const { game: g, peer, session: m } = fixture();
    g.player.onGround = true;
    const arena = m.arena;
    const record = {
      portal: { id: "p", cell: "0,0", x: 2, y: 200, z: 4 },
      config: { enabled: true, cinematics: true, cooldown: 60 },
      cooldownUntil: 0,
      ledger: [],
      used: [],
    };
    g.giganto = {
      export: () =>
        kind === "wyvern" ? { ...record, wyvern: record } : record,
    };
    const grant = arena.hostBegin(peer, kind),
      local = structuredClone(grant.session);
    assert.equal(peer.player.multiplayerAway, true);
    assert.equal(
      arena.hostFrames(peer, { token: "fake", seq: 1, frames: [{}] }),
      false,
    );
    const frames = Array.from({ length: 8 }, () => ({
      forward: true,
      moveX: 0.5,
      actions: [],
    }));
    assert.equal(
      arena.hostFrames(peer, { token: grant.token, seq: 1, frames }),
      true,
    );
    for (const f of frames) {
      local.events = [];
      step(local, arenaFrame(f), 1 / 60);
    }
    assert.deepEqual(peer.arena.session, local);
    assert.equal(
      arena.hostFrames(peer, { token: grant.token, seq: 1, frames }),
      false,
    );
    assert.throws(
      () => arena.hostFinish(peer, grant.token, true),
      /confirmed victory/,
    );
    const state = arena.hostFinish(peer, grant.token, false);
    assert.equal(state.player.multiplayerAway, undefined);
    assert.ok(state.titanRecords[kind].session);
    assert.equal(peer.arena, null);
  }
  assert.throws(() => arenaFrame({ moveX: Infinity }), /movement/);
  assert.throws(() => arenaFrame({ actions: ["x".repeat(30)] }), /action/);
  assert.equal(arenaFrame({ moveX: 1.5, health: 999 }).moveX, 1);
  assert.equal(arenaFrame({ health: 999 }).health, undefined);
});
test("reward ledger pays once only after canonical victory and portal crossing", () => {
  const { game: g, peer, session: m } = fixture();
  g.giganto = {
    export: () => ({
      portal: { id: "victory", cell: "a", x: 2, y: 200, z: 4 },
      config: { enabled: true, cooldown: 60 },
      cooldownUntil: 0,
      used: [],
      ledger: [],
    }),
  };
  const { token } = m.arena.hostBegin(peer, "giganto"),
    s = peer.arena.session;
  Object.assign(s, { won: true, stage: "victory" });
  assert.throws(() => m.arena.hostFinish(peer, token, true), /confirmed/);
  s.returnPortal = { crossed: true, fade: 0.45 };
  m.arena.hostFinish(peer, token, true);
  assert.equal(peer.inventory.slots.find((s) => s?.id === "diamond").count, 6);
  assert.equal(peer.titanRecords.giganto.ledger.length, 1);
  assert.throws(() => m.arena.hostFinish(peer, token, true), /expired/);
});
test("owner realm expeditions keep guests and saves in the shared realm and restore canonical clocks on return", () => {
  const { game: g, peer, session: m } = fixture(),
    world = g.world,
    position = { x: peer.player.x, y: peer.player.y, z: peer.player.z };
  g.renderer.setWorld = () => {};
  g.realms = {};
  g.hostileProjectiles = [];
  g.standProjectiles = [];
  g.seekers = [];
  g.pistolTraces = [];
  selectRealm(g, "cinderwild");
  assert.equal(m.sharedRealm.contextFor("overworld").world, world);
  assert.equal(peer.context.dimension, "overworld");
  assert.equal(peer.context.world, world);
  assert.deepEqual(
    { x: peer.player.x, y: peer.player.y, z: peer.player.z },
    position,
  );
  assert.equal(pvpActors(g).length, 0);
  m.sharedRealm.contextFor("overworld").world.set(3,203,3,B.gold_block);
  g.tickCount += 200;
  m.sharedRealm.sync();
  assert.equal(g.realms.overworld.world.get(3, 203, 3), B.gold_block);
  assert.throws(() => selectRealm(peer.context, "end"), /portal/);
  const tick = g.tickCount;
  selectRealm(g, "overworld");
  assert.equal(g.world, world);
  assert.equal(m.sharedRealm.base, null);
  assert.equal(peer.context.world, world);
  assert.equal(g.tickCount, tick);
});
test("remote visual actions cannot smuggle gameplay state or invalid durations", () => {
  const { peer, session: m } = fixture();
  recordPeerAction(m, peer, "attack");
  assert.equal(cleanRemoteAction(peer.visualAction).kind, "attack");
  assert.equal(
    cleanRemoteAction({ ...peer.visualAction, duration: 900 }),
    null,
  );
  assert.equal(
    cleanRemoteAction({ ...peer.visualAction, kind: "teleport" }),
    null,
  );
});

test("Fall Damage rule applies equally to host-validated guests", () => {
  const { game, peer, session } = fixture();
  game.rules = { fallDamage: false };
  damagePeer(session, peer, 8, "fall");
  assert.equal(peer.player.health, 20);
  game.rules.fallDamage = true;
  damagePeer(session, peer, 8, "fall");
  assert.equal(peer.player.health, 12);
});

test("guest targeting excludes its replicated body and still targets other players", () => {
  const { game, session, peer } = fixture();
  game.rules = { pvp: true };
  session.isGuest = true;
  session.id = "guest";
  session.remotePoses = [
    { id: "guest", name: "Self", ...game.player },
    { id: "other", name: "Other", ...peer.player },
  ];
  assert.deepEqual(
    pvpActors(game).map((a) => a.pvpId),
    ["other"],
  );
});

test("Titan replay keeps mouse, touch and controller look and action headings authoritative for both fights", () => {
  for (const [kind, make, step, action] of [
    ["giganto", titanSession, stepTitan, titanInput],
    ["wyvern", wyvernSession, stepWyvern, wyvernInput],
  ]) {
    const { game: g, peer, session: m } = fixture();
    g.giganto = {
      export: () => ({
        portal: { id: "look", cell: "x", x: 2, y: 200, z: 4 },
        config: { enabled: true, cooldown: 60 },
        cooldownUntil: 0,
        ledger: [],
        used: [],
        wyvern: {
          portal: { id: "wlook", cell: "w", x: 2, y: 200, z: 4 },
          config: { enabled: true, cooldown: 60 },
          cooldownUntil: 0,
          ledger: [],
          used: [],
        },
      }),
    };
    const grant = m.arena.hostBegin(peer, kind);
    peer.arena.session.stage = "traversal";
    const local = structuredClone(peer.arena.session);
    const pre = { yaw: 1.1, pitch: 0.3, lock: false },
      post = { yaw: 1.35, pitch: 0.4, lock: false };
    Object.assign(local.avatar, { yaw: pre.yaw, pitch: pre.pitch });
    local.lock = pre.lock;
    local.events = [];
    action(local, "jump");
    Object.assign(local.avatar, { yaw: post.yaw, pitch: post.pitch });
    local.lock = post.lock;
    const input = arenaFrame({
      forward: true,
      view: post,
      actions: [{ key: "jump", view: pre }],
    });
    step(local, input, 1 / 60);
    assert.equal(
      m.arena.hostFrames(peer, { token: grant.token, seq: 1, frames: [input] }),
      true,
    );
    assert.deepEqual(peer.arena.session, local);
  }
  assert.throws(
    () => arenaFrame({ view: { yaw: Infinity, pitch: 0 } }),
    /look/,
  );
  assert.throws(
    () =>
      arenaFrame({ actions: [{ key: "jump", view: { yaw: 0, pitch: 99 } }] }),
    /look/,
  );
  assert.equal(
    arenaFrame({ view: { yaw: 1, pitch: 0.2, x: 999, hp: 999 } }).view.x,
    undefined,
  );
});
