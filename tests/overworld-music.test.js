import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { OverworldMusic } from "../src/overworld-music.js";
import {
  OVERWORLD_TRACKS,
  CREATIVE_TRACKS,
} from "../src/overworld-music-data.js";
import { MusicEngine } from "../src/music.js";

function setup() {
  const created = [],
    parameters = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const context = {
    currentTime: 0,
    state: "running",
    createGain() {
      const gain = {
        value: 0,
        cancelAndHoldAtTime() {},
        linearRampToValueAtTime(value) {
          this.value = value;
          parameters.push(value);
        },
      };
      return { ...node(), gain };
    },
    createDelay() {
      return { ...node(), delayTime: { value: 0 } };
    },
    createMediaElementSource(media) {
      media.connected = true;
      return node();
    },
  };
  const createMedia = () => {
    const m = {
      currentTime: 0,
      paused: true,
      plays: 0,
      loads: 0,
      play() {
        this.paused = false;
        this.plays++;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      },
      removeAttribute() {
        this.src = "";
      },
      load() {
        this.loads++;
      },
    };
    created.push(m);
    return m;
  };
  const player = new OverworldMusic(context, node(), {
    createMedia,
    random: () => 0.37,
  });
  const game = {
    id: "world-a",
    active: true,
    running: true,
    dimension: "overworld",
    mode: "survival",
    world: { seedInt: 12, terrain: () => ({ biome: "meadow" }) },
    player: { x: 0, z: 0 },
  };
  const settings = { musicEnabled: true, volume: 0.35, musicVolume: 0.45 };
  return { player, context, game, settings, created, parameters, createMedia };
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

test("all twelve embedded songs preserve the full supplied MP3 bytes and manifest hashes", () => {
  assert.deepEqual(
    OVERWORLD_TRACKS.map((t) => t.title),
    [
      "Clark",
      "Sweden",
      "Subwoofer Lullaby",
      "Minecraft",
      "Dry Hands",
      "Wet Hands",
      "Mice on Venus",
      "Key",
      "Oxygène",
      "Danny",
      "Living Mice",
      "Haggstrom",
    ],
  );
  for (const t of OVERWORLD_TRACKS) {
    const bytes = Buffer.from(t.src.split(",")[1], "base64");
    assert.deepEqual(
      bytes,
      readFileSync(
        new URL(`../public/audio/overworld/${t.file}`, import.meta.url),
      ),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), t.sha256);
    assert.equal(bytes.length, t.bytes);
    assert(t.duration > 60 && t.duration < 300);
  }
});
test("shuffle bags play every full song once per round, avoid boundary repeats and release finished decoders", async () => {
  const { player: p, context: c, game: g, settings: s, created } = setup();
  const order = [];
  for (let i = 0; i < 36; i++) {
    p.update(g, s);
    await flush();
    order.push(p.currentTrack.id);
    const media = p.media;
    assert.equal(media.loop, false);
    assert(media.connected);
    p.update(g, s);
    assert.equal(media.plays, 1);
    media.onended();
    assert.equal(media.src, "");
    assert.equal(media.loads, 1);
    p.update(g, s);
    assert.equal(p.media, null);
    c.currentTime = p.nextTrackAt + 0.01;
  }
  for (let i = 0; i < 36; i += 12)
    assert.equal(new Set(order.slice(i, i + 12)).size, 12);
  assert(order.every((id, i) => !i || id !== order[i - 1]));
  assert.equal(created.length, 36);
  assert(created.every((m) => m.paused));
});
test("menus, mute, disabled music and jukebox playback pause/resume the same recording and position", async () => {
  const { player: p, game: g, settings: s, created } = setup();
  p.update(g, s);
  await flush();
  const media = p.media;
  media.currentTime = 95;
  for (const [object, key, value, restore] of [
    [g, "running", false, true],
    [s, "musicEnabled", false, true],
    [s, "volume", 0, 0.35],
    [s, "musicVolume", 0, 0.45],
  ]) {
    object[key] = value;
    p.update(g, s);
    assert(media.paused);
    assert.equal(media.currentTime, 95);
    object[key] = restore;
    p.update(g, s);
    await flush();
    assert(!media.paused);
    assert.equal(p.media, media);
  }
  for (const state of ["playing", "menu-paused"]) {
    g.jukebox = { state };
    p.update(g, s);
    assert(media.paused);
    g.jukebox.state = "stopped";
    p.update(g, s);
    await flush();
    assert(!media.paused);
  }
  assert.equal(created.length, 1);
  assert.equal(p.history.length, 1);
});
test("Overworld replaces generated notes; Cinderworld keeps the legacy generator and pauses the recording", async () => {
  const f = setup(),
    music = new MusicEngine(f.context, {});
  music.overworld.createMedia = f.createMedia;
  music.update(f.game, f.settings);
  await flush();
  const media = music.overworld.media;
  media.currentTime = 42;
  assert(!music.enabled);
  assert.equal(music.events.length, 0);
  assert.equal(music.scheduled, 0);
  f.game.dimension = "cinderwild";
  music.update(f.game, f.settings);
  assert(media.paused);
  assert(music.enabled);
  assert(music.events.length > 0);
  f.game.dimension = "overworld";
  music.update(f.game, f.settings);
  await flush();
  assert.equal(music.events.length, 0);
  assert(!media.paused);
  assert.equal(media.currentTime, 42);
  music.silence();
  assert(media.paused);
  assert.equal(music.overworld.output.gain.value, 0);
});
test("volume changes use the shared music bus without reloading media or repeating gain automation", async () => {
  const { player: p, game: g, settings: s, parameters } = setup();
  p.update(g, s);
  await flush();
  const media = p.media,
    count = parameters.length;
  for (let i = 0; i < 50; i++) p.update(g, s);
  assert.equal(parameters.length, count);
  s.musicVolume = 0.2;
  p.update(g, s);
  assert.equal(p.lastGain, 0.2 * 0.65);
  assert.equal(media.plays, 1);
  s.volume = 0;
  p.update(g, s);
  assert.equal(p.output.gain.value, 0);
  assert(media.paused);
});
test("world quit/new world releases media and restarts a fresh queue without world save data", async () => {
  const { player: p, game: g, settings: s } = setup();
  p.update(g, s);
  await flush();
  const old = p.media;
  g.active = false;
  p.update(g, s);
  assert.equal(p.media, null);
  assert(old.paused);
  assert.equal(old.src, "");
  g.active = true;
  g.id = "world-b";
  p.update(g, s);
  await flush();
  assert.notEqual(p.media, old);
  assert.equal(p.worldKey, "world-b");
});
test("failed tracks are skipped without a per-frame retry storm; all-failed playlists stay harmless", async () => {
  const { player: p, context: c, game: g, settings: s, created } = setup();
  for (let i = 0; i < OVERWORLD_TRACKS.length; i++) {
    p.update(g, s);
    await flush();
    assert(p.media);
    p.media.onerror();
    c.currentTime = p.nextTrackAt + 0.01;
  }
  for (let i = 0; i < 100; i++) {
    p.update(g, s);
    c.currentTime++;
  }
  assert.equal(created.length, OVERWORLD_TRACKS.length);
  assert.equal(p.failed.size, OVERWORLD_TRACKS.length);
  assert.equal(p.state, "unavailable");
  assert.equal(p.media, null);
});
test("autoplay rejection waits for a gesture and stale play completions never resume a muted track", async () => {
  const { player: p, game: g, settings: s, created } = setup();
  const original = p.createMedia;
  p.createMedia = () => {
    const m = original();
    m.play = () => {
      m.plays++;
      return Promise.reject({ name: "NotAllowedError" });
    };
    return m;
  };
  p.update(g, s);
  await flush();
  assert.equal(p.state, "blocked");
  for (let i = 0; i < 100; i++) p.update(g, s);
  assert.equal(created[0].plays, 1);
  const m = p.media;
  let resolve;
  m.play = () => {
    m.paused = false;
    return new Promise((r) => (resolve = r));
  };
  p.allowPlayback();
  p.update(g, s);
  s.musicEnabled = false;
  p.update(g, s);
  resolve();
  await flush();
  assert(m.paused);
  assert.equal(p.history.length, 0);
});

test("the Survival catalog stays silent in Creative and mode changes resume the same Survival track", async () => {
  const { player: p, game: g, settings: s, created } = setup();
  g.mode = "creative";
  for (let i = 0; i < 60; i++) p.update(g, s);
  await flush();
  assert.equal(created.length, 0);
  assert(p.media == null);
  assert.equal(p.lastGain, 0);
  g.mode = "survival";
  p.update(g, s);
  await flush();
  const media = p.media;
  media.currentTime = 42;
  g.mode = "creative";
  p.update(g, s);
  await flush();
  assert(media.paused);
  assert.equal(p.lastGain, 0);
  assert.equal(p.history.length, 1);
  g.mode = "survival";
  p.update(g, s);
  await flush();
  assert.equal(p.media, media);
  assert.equal(media.currentTime, 42);
  assert(!media.paused);
  assert.equal(p.history.length, 1);
});

test("the Creative catalog preserves all six full supplied Beta recordings", () => {
  assert.deepEqual(
    CREATIVE_TRACKS.map((t) => t.title),
    [
      "Aria Math",
      "Dreiton",
      "Haunt Muskie",
      "Blind Spots",
      "Taswell",
      "Biome Fest",
    ],
  );
  for (const t of CREATIVE_TRACKS) {
    const bytes = Buffer.from(t.src.split(",")[1], "base64");
    assert.deepEqual(
      bytes,
      readFileSync(
        new URL(`../public/audio/creative/${t.file}`, import.meta.url),
      ),
    );
    assert.equal(createHash("sha256").update(bytes).digest("hex"), t.sha256);
    assert.equal(bytes.length, t.bytes);
    assert(t.duration > 300 && t.duration < 520);
    assert(!OVERWORLD_TRACKS.some((x) => x.id === t.id));
  }
});
test("Creative shuffles only its six recordings in complete no-repeat rounds", async () => {
  const f = setup(),
    p = new OverworldMusic(
      f.context,
      {},
      { mode: "creative", createMedia: f.createMedia, random: () => 0.37 },
    ),
    order = [];
  f.game.mode = "survival";
  p.update(f.game, f.settings);
  assert.equal(f.created.length, 0);
  f.game.mode = "creative";
  for (let i = 0; i < 18; i++) {
    p.update(f.game, f.settings);
    await flush();
    order.push(p.currentTrack.id);
    p.media.onended();
    f.context.currentTime = p.nextTrackAt + 0.01;
  }
  for (let i = 0; i < 18; i += 6)
    assert.equal(new Set(order.slice(i, i + 6)).size, 6);
  assert(
    order.every(
      (id, i) =>
        CREATIVE_TRACKS.some((t) => t.id === id) && (!i || id !== order[i - 1]),
    ),
  );
});
test("the music router switches exclusive mode pools, resumes each position and silences both for Cinderworld or pause", async () => {
  const f = setup(),
    m = new MusicEngine(f.context, {});
  m.overworld.createMedia = f.createMedia;
  m.creative.createMedia = f.createMedia;
  m.update(f.game, f.settings);
  await flush();
  const survival = m.overworld.media;
  survival.currentTime = 42;
  f.game.mode = "creative";
  m.update(f.game, f.settings);
  await flush();
  const creative = m.creative.media;
  creative.currentTime = 55;
  assert(survival.paused && !creative.paused);
  assert(CREATIVE_TRACKS.some((t) => t.id === m.creative.currentTrack.id));
  f.game.mode = "survival";
  m.update(f.game, f.settings);
  await flush();
  assert(creative.paused && !survival.paused);
  assert.equal(survival.currentTime, 42);
  f.game.mode = "creative";
  m.update(f.game, f.settings);
  await flush();
  assert(survival.paused && !creative.paused);
  assert.equal(creative.currentTime, 55);
  m.silence();
  assert(creative.paused && survival.paused);
  f.game.dimension = "cinderwild";
  m.update(f.game, f.settings);
  assert(creative.paused && survival.paused);
  assert(m.enabled);
});
