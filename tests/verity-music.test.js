import test from "node:test";
import assert from "node:assert/strict";
import { VERITY } from "../src/verity-simulation.js";
import { VerityMusic, VERITY_SONG } from "../src/verity-music.js";

function fixture(t) {
  const saved = globalThis.Audio,
    created = [];
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.paused = true;
      this.playCount = 0;
      created.push(this);
    }
    async play() {
      this.paused = false;
      this.playCount++;
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {
      this.src = "";
    }
    load() {}
  };
  t.after(() => {
    globalThis.Audio = saved;
  });
  const game = {
    settings: {
      verityMusic: "local",
      musicEnabled: true,
      volume: 0.8,
      musicVolume: 0.5,
    },
    running: true,
    ui: { screen: "play" },
    world: { settlements: {} },
  };
  const mount = { hidden: true, replaceChildren() {}, append() {} };
  const music = new VerityMusic(game, mount);
  music.library = {
    get: async () => ({ blob: new Blob(["test"], { type: "audio/mpeg" }) }),
  };
  return { game, music, created, mount };
}
test("local encounter music starts once, applies master/music volume, pauses/resumes and destroys its source on exit", async (t) => {
  const { game, music, created } = fixture(t);
  await music.begin("visit:1");
  assert.equal(created.length, 1);
  assert.equal(music.media.volume, 0.4);
  assert.equal(music.media.paused, false);
  game.running = false;
  music.update(true, false);
  assert.equal(created[0].paused, true);
  game.running = true;
  music.update(true, true);
  await Promise.resolve();
  assert.equal(created.length, 1);
  assert.equal(created[0].paused, false);
  game.settings.musicEnabled = false;
  music.update(true, true);
  assert.equal(created[0].paused, true);
  game.settings.musicEnabled = true;
  music.update(true, true);
  await Promise.resolve();
  assert.equal(created[0].paused, false);
  music.update(false, false);
  assert.equal(created[0].paused, true);
  assert.equal(created[0].src, "");
  assert.equal(music.media, null);
  assert.equal(music.objectURL, null);
  assert.equal(music.state, "idle");
});
test("a delayed import cannot start after quitting, and a paused encounter never starts audio during loading", async (t) => {
  const { game, music, created } = fixture(t);
  let resolve;
  music.library = { get: () => new Promise((r) => (resolve = r)) };
  const loading = music.begin("visit:1");
  music.stop();
  resolve({ blob: new Blob(["test"]) });
  await loading;
  assert.equal(created.length, 0);
  game.running = false;
  music.library = { get: async () => ({ blob: new Blob(["test"]) }) };
  await music.begin("visit:2");
  assert.equal(created.length, 1);
  assert.equal(created[0].playCount, 0);
  music.stop();
});
test("bow fades the track, muted/off settings do not create media, and the supplied recording remains an explicit music option", async (t) => {
  const { game, music, created } = fixture(t);
  game.settings.verityMusic = "off";
  await music.begin("off");
  assert.equal(created.length, 0);
  game.settings.verityMusic = "local";
  game.settings.volume = 0;
  await music.begin("muted");
  assert.equal(created.length, 0);
  game.settings.volume = 0.8;
  await music.begin("play");
  const volume = music.media.volume;
  game.world.settlements["lord-verity"] = {
    active: {
      phase: "bow",
      age: VERITY.arrival + VERITY.beats * VERITY.beat + 1.35,
    },
  };
  music.update(true, true);
  assert.ok(Math.abs(music.media.volume - volume / 2) < 0.0001);
  music.stop();
  assert.equal(VERITY_SONG.id, "lhCPiauHI-g");
});

test("the supplied song starts at zero on each new visit and pause/resume preserves its playhead instead of skipping the intro", async (t) => {
  const { game, music, created } = fixture(t);
  game.settings.verityMusic = "supplied";
  game.world.settlements["lord-verity"] = {
    active: { age: 1.8, phase: "arrival" },
  };
  await music.begin("fresh");
  assert.equal(created[0].currentTime, 0);
  assert.equal(created[0].loop, false);
  assert.match(created[0].src, /^data:audio\/mpeg;base64,/);
  created[0].currentTime = 3.2;
  game.running = false;
  music.update(true, false);
  game.world.settlements["lord-verity"].active.age = 8;
  game.running = true;
  music.update(true, true);
  await Promise.resolve();
  assert.equal(created[0].currentTime, 3.2);
  await music.begin("next");
  assert.equal(created[1].currentTime, 0);
  assert.equal(created[0].src, "");
  music.stop();
});
