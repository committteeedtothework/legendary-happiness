import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ClaimFanfare } from "../src/claim-audio.js";
import { DEVIN_CLAIM_MP3 } from "../src/devin-claim-audio-data.js";
import { AudioEngine } from "../src/audio.js";
import { World } from "../src/world.js";
import { B, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { relicSite, extractRelic } from "../src/relic.js";
import { exportRealm, restoreRealm } from "../src/realms.js";

test("embedded claim MP3 is byte-identical to the supplied file, without network or local path dependencies", () => {
  assert.deepEqual(
    Buffer.from(DEVIN_CLAIM_MP3, "base64"),
    readFileSync(
      new URL("../public/audio/devin-sword-claim.mp3", import.meta.url),
    ),
  );
  assert.equal(Buffer.from(DEVIN_CLAIM_MP3, "base64").length, 215357);
});
function game() {
  const world = new World("Wildflower"),
    p = relicSite(world),
    calls = [];
  world.settlements["devin-temple"] = {
    created: [0, 1, 2],
    defeated: [0, 1, 2],
    attuned: true,
  };
  return {
    world,
    mode: "survival",
    dimension: "overworld",
    running: true,
    mouseDown: true,
    player: createPlayer({ x: p.x + 0.5, y: p.y, z: p.z + 2.8 }),
    inventory: new Inventory(),
    target: { x: p.x, y: p.y + 1, z: p.z, id: B.devin_relic_blade },
    audio: {
      devinClaim() {
        calls.push("claim");
      },
      tone() {
        calls.push("generic");
      },
    },
    ui: { toast() {}, updateHotbar() {}, announce() {} },
    calls,
  };
}
test("only a completed, unlocked extraction with inventory room plays the claim clip, exactly once and never on reload", () => {
  const g = game();
  g.world.settlements["devin-temple"].defeated = [0, 1];
  extractRelic(g, g.target, 0);
  extractRelic(g, g.target, 30000);
  assert.deepEqual(g.calls, []);
  g.world.settlements["devin-temple"].defeated.push(2);
  extractRelic(g, g.target, 40000);
  extractRelic(g, g.target, 69999);
  assert.deepEqual(g.calls, []);
  g.mouseDown = false;
  extractRelic(g, g.target, 70000);
  g.mouseDown = true;
  g.inventory.slots.fill(null);
  g.inventory.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  extractRelic(g, g.target, 80000);
  extractRelic(g, g.target, 110000);
  assert.deepEqual(g.calls, []);
  g.inventory.slots[0] = null;
  extractRelic(g, g.target, 110001);
  assert.deepEqual(g.calls, ["claim"]);
  assert.equal(g.inventory.slots[0].id, "devin_sword");
  extractRelic(g, g.target, 200000);
  assert.deepEqual(g.calls, ["claim"]);
  g.world = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: [], drops: [] }),
  ).world;
  extractRelic(g, g.target, 250000);
  assert.deepEqual(g.calls, ["claim"]);
});
function context() {
  const sources = [],
    gains = [],
    buffer = { duration: 5.45 };
  return {
    state: "running",
    sources,
    gains,
    buffer,
    async decodeAudioData(bytes) {
      assert.deepEqual(
        Buffer.from(bytes),
        Buffer.from(DEVIN_CLAIM_MP3, "base64"),
      );
      return buffer;
    },
    createBufferSource() {
      const s = {
        loop: true,
        starts: 0,
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start() {
          this.starts++;
        },
      };
      sources.push(s);
      return s;
    },
    createGain() {
      const g = {
        gain: { value: 1 },
        connect(output) {
          this.output = output;
        },
        disconnect() {
          this.disconnected = true;
        },
      };
      gains.push(g);
      return g;
    },
  };
}
test("sample preloading is silent, playback does not loop/overlap, mute/suspension prevent delayed sound, and nodes clean up", async () => {
  const c = context(),
    f = new ClaimFanfare(c, "master");
  await f.ready;
  assert.equal(c.sources.length, 0);
  assert.equal(await f.play(() => false), false);
  c.state = "suspended";
  assert.equal(await f.play(), false);
  c.state = "running";
  const pending = f.play();
  assert.equal(await f.play(), false);
  assert.equal(await pending, true);
  assert.equal(f.started, 1);
  assert.equal(c.sources[0].buffer, c.buffer);
  assert.equal(c.sources[0].loop, false);
  assert.equal(c.gains[0].output, "master");
  c.sources[0].onended();
  assert.equal(f.source, null);
  assert.ok(c.sources[0].disconnected && c.gains[0].disconnected);
  assert.equal(await f.play(), true);
  assert.equal(f.started, 2); // A claim in a different world can play later.
  const bad = context();
  bad.decodeAudioData = async () => {
    throw Error("unsupported");
  };
  const failed = new ClaimFanfare(bad, "master");
  assert.equal(await failed.play(), false);
  assert.equal(failed.failed, true);
});
test("AudioEngine uses master volume independently of background music, with a safe decoding fallback", async () => {
  const a = new AudioEngine({
    volume: 0.35,
    musicEnabled: false,
    musicVolume: 0,
  });
  a.context = context();
  a.master = "master";
  a.updateVolume = () => {};
  a.claimFanfare = new ClaimFanfare(a.context, a.master);
  assert.equal(await a.devinClaim(), true);
  assert.equal(a.played, 1);
  a.settings.volume = 0;
  assert.equal(await a.devinClaim(), false);
  assert.equal(a.played, 1);
  a.claimFanfare.source.onended();
  a.settings.volume = 0.35;
  a.claimFanfare = { failed: true, play: async () => false };
  const tones = [];
  a.tone = (s) => tones.push(s);
  assert.equal(await a.devinClaim(), false);
  assert.deepEqual(tones, ["relic"]);
});
