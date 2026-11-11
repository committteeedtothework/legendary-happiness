import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MATTHEW_CLAIM_MP3 } from "../src/matthew-claim-audio-data.js";
import { ClaimFanfare } from "../src/claim-audio.js";
import { AudioEngine } from "../src/audio.js";
import { World } from "../src/world.js";
import { B, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { claimPistols, INVASION } from "../src/invasion.js";
import { exportRealm, restoreRealm } from "../src/realms.js";

test("Matthew claim recording is embedded byte-for-byte from the supplied 32888-byte MP3", () => {
  const bytes = Buffer.from(MATTHEW_CLAIM_MP3, "base64");
  assert.equal(bytes.length, 32888);
  assert.deepEqual(
    bytes,
    readFileSync(
      new URL("../public/audio/matthew-pistols-claim.mp3", import.meta.url),
    ),
  );
});
test("only the first successful altar claim plays Matthew's cue; guards, guest, distance, full bag and persisted claims stay gated", () => {
  const world = new World("Claim"),
    calls = [],
    g = {
      world,
      dimension: "overworld",
      player: createPlayer({ x: 0.5, y: 200, z: 3.5 }),
      inventory: new Inventory(),
      ui: { toast() {}, updateHotbar() {} },
      audio: {
        matthewClaim() {
          calls.push("mp3");
        },
        tone() {
          calls.push("generic");
        },
      },
    };
  const s = (world.settlements[INVASION] = {
    x: 0,
    y: 200,
    z: 0,
    phase: "battle",
    defeated: [],
  });
  world.set(0, 201, 0, B.matthew_altar);
  const t = { x: 0, y: 201, z: 0, id: B.matthew_altar };
  claimPistols(g, t);
  assert.deepEqual(calls, []);
  s.phase = "ready";
  s.defeated = [0, 1, 2, 3];
  g.multiplayer = { isGuest: true };
  claimPistols(g, t);
  assert.deepEqual(calls, []);
  g.multiplayer = null;
  g.player.x = 20;
  claimPistols(g, t);
  assert.deepEqual(calls, []);
  g.player.x = 0.5;
  g.inventory.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  claimPistols(g, t);
  assert.deepEqual(calls, []);
  assert.equal(s.phase, "ready");
  g.inventory.slots[0] = null;
  claimPistols(g, t);
  assert.deepEqual(calls, ["mp3"]);
  assert.equal(s.phase, "claimed");
  assert.equal(g.inventory.slots[0].id, "matthew_dual_pistols");
  claimPistols(g, t);
  g.inventory.slots[0] = null;
  claimPistols(g, t);
  assert.deepEqual(calls, ["mp3"]);
  g.world = restoreRealm(
    world.seed,
    "overworld",
    exportRealm({ world, entities: [], drops: [] }),
  ).world;
  claimPistols(g, t);
  assert.deepEqual(calls, ["mp3"]);
});
function context() {
  const sources = [];
  return {
    state: "running",
    sources,
    async decodeAudioData(bytes) {
      return {
        duration: bytes.byteLength === 32888 ? 2.01 : 5.46,
        bytes: bytes.byteLength,
      };
    },
    createBufferSource() {
      const s = { connect() {}, disconnect() {}, start() {}, loop: true };
      sources.push(s);
      return s;
    },
    createGain() {
      return {
        gain: { value: 1 },
        connect(output) {
          this.output = output;
        },
        disconnect() {},
      };
    },
  };
}
test("independent Matthew and Devin sample buffers preload silently, do not loop/overlap and clean up", async () => {
  const c = context(),
    sword = new ClaimFanfare(c, "master"),
    pistols = new ClaimFanfare(c, "master", MATTHEW_CLAIM_MP3);
  await Promise.all([sword.ready, pistols.ready]);
  assert.equal(c.sources.length, 0);
  assert.equal(await pistols.play(), true);
  assert.equal(pistols.source.buffer.bytes, 32888);
  assert.equal(pistols.source.loop, false);
  assert.equal(await pistols.play(), false);
  assert.equal(sword.started, 0);
  assert.equal(await sword.play(), true);
  assert.equal(sword.source.buffer.bytes, 215357);
  assert.notEqual(sword.source.buffer, pistols.source.buffer);
  pistols.source.onended();
  assert.equal(pistols.source, null);
  assert.equal(sword.started, 1);
});
test("Matthew's cue follows Master volume independently of background Music and has a safe rune fallback", async () => {
  const a = new AudioEngine({
    volume: 0.4,
    musicEnabled: false,
    musicVolume: 0,
  });
  a.context = context();
  a.master = "master";
  a.updateVolume = () => {};
  a.pistolClaimFanfare = new ClaimFanfare(
    a.context,
    a.master,
    MATTHEW_CLAIM_MP3,
  );
  a.settings.volume = 0;
  assert.equal(await a.matthewClaim(), false);
  await a.pistolClaimFanfare.ready;
  assert.equal(a.pistolClaimFanfare.started, 0);
  a.settings.volume = 0.4;
  assert.equal(await a.matthewClaim(), true);
  assert.equal(a.played, 1);
  a.pistolClaimFanfare.source.onended();
  a.pistolClaimFanfare = { failed: true, play: async () => false };
  const tones = [];
  a.tone = (k) => tones.push(k);
  assert.equal(await a.matthewClaim(), false);
  assert.deepEqual(tones, ["rune"]);
});
