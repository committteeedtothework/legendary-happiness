import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MENU_AUDIO_MP3 } from "../src/menu-audio-data.js";
import {
  MenuAudio,
  MENU_CUES,
  MENU_ROLES,
  menuRoleForAction,
} from "../src/menu-audio.js";
import { AudioEngine } from "../src/audio.js";
function audio() {
  const starts = [],
    gains = [],
    sources = [],
    master = {};
  const parameter = () => ({
    setTargetAtTime(...a) {
      gains.push(a);
    },
    setValueAtTime() {},
    linearRampToValueAtTime() {},
  });
  const context = {
    currentTime: 1,
    state: "running",
    decodes: 0,
    async decodeAudioData(bytes) {
      assert.ok(bytes.byteLength > 150000);
      this.decodes++;
      return { duration: 9.3 };
    },
    createGain() {
      return { gain: parameter(), connect() {}, disconnect() {} };
    },
    createBufferSource() {
      const s = {
        connect() {},
        disconnect() {
          this.disconnected = true;
        },
        start(...a) {
          starts.push(a);
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(s);
      return s;
    },
  };
  const settings = { volume: 0.5, menuSounds: true, menuVolume: 0.65 };
  return {
    context,
    settings,
    starts,
    gains,
    sources,
    menu: new MenuAudio(context, master, settings),
  };
}
test("supplied console MP3 stays byte-identical in the offline payload and the four labels match the user's order", () => {
  const bytes = Buffer.from(MENU_AUDIO_MP3.split(",")[1], "base64");
  assert.deepEqual(bytes, readFileSync("public/audio/menu-console-source.mp3"));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "f025b026bf2740b1225a9cb36bb9b7358fdbc5223038e448c993e788d426bc0c",
  );
  assert.deepEqual(MENU_ROLES, { select: 0, hover: 1, exit: 2, slide: 3 });
  for (const cue of MENU_CUES) {
    assert.ok(cue.offset > 0 && cue.offset + cue.duration < 9.3);
    assert.ok(cue.duration < 0.4);
  }
  for (const action of ["back", "title", "resume", "close-inv", "quit"])
    assert.equal(menuRoleForAction(action), "exit");
  for (const action of [
    "create",
    "settings",
    "toggle-graphics",
    "graphics-preset",
    "load",
  ])
    assert.equal(menuRoleForAction(action), "select");
});
test("menus decode one shared recording and play only the correct offset/duration for Select, Hover, Exit and Slide", async () => {
  const a = audio();
  for (const role of ["select", "hover", "exit", "slide"]) {
    a.context.currentTime += 1;
    assert.equal(await a.menu.play(role), true);
    const cue = MENU_CUES[MENU_ROLES[role]];
    assert.deepEqual(a.starts.at(-1), [
      a.context.currentTime,
      cue.offset,
      cue.duration,
    ]);
    assert.equal(a.menu.lastRole, role);
  }
  assert.equal(a.context.decodes, 1);
  assert.equal(a.menu.active.size, 4);
  a.context.currentTime++;
  assert.equal(
    await a.menu.play("select"),
    false,
    "voice budget stays bounded",
  );
  a.sources[0].onended();
  assert.equal(a.menu.active.size, 3);
  assert.equal(a.sources[0].disconnected, true);
  a.context.currentTime++;
  assert.equal(await a.menu.play("select"), true);
});
test("rapid slider/hover events are throttled, muting stops active sources, and muted clicks never decode or queue sounds", async () => {
  const a = audio();
  const results = await Promise.all(
    Array.from({ length: 25 }, () => a.menu.play("slide")),
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(a.starts.length, 1);
  a.settings.menuSounds = false;
  a.menu.updateVolume();
  assert.ok(a.sources[0].stopped);
  assert.equal(a.menu.active.size, 0);
  assert.equal(await a.menu.play("exit"), false);
  assert.equal(a.starts.length, 1);
  const b = audio();
  b.settings.volume = 0;
  assert.equal(await b.menu.play("hover"), false);
  assert.equal(b.context.decodes, 0);
  b.settings.volume = 1;
  b.settings.menuVolume = 0;
  assert.equal(await b.menu.play("select"), false);
  assert.equal(b.context.decodes, 0);
});
test("decode failures and delayed first clicks fail quietly without delayed playback after muting", async () => {
  const a = audio();
  a.context.decodeAudioData = async () => {
    throw Error("unsupported MP3");
  };
  assert.equal(await a.menu.play("select"), false);
  assert.equal(a.menu.failed, true);
  assert.equal(a.starts.length, 0);
  const b = audio();
  let finish;
  b.context.decodeAudioData = () =>
    new Promise((r) => {
      finish = r;
    });
  const pending = b.menu.play("select");
  // Mobile asset loading may yield before the decoder begins.
  await new Promise(setImmediate);
  b.settings.menuSounds = false;
  finish({ duration: 9.3 });
  assert.equal(await pending, false);
  assert.equal(b.starts.length, 0);
  const c = audio();
  c.context.decodeAudioData = async () => {
    c.context.currentTime += 1;
    return { duration: 9.3 };
  };
  assert.equal(await c.menu.play("select"), false);
  assert.equal(c.starts.length, 0);
});
test("AudioEngine routes the old UI tone through supplied Select and keeps world audio independent from menu mute", async () => {
  const a = new AudioEngine({ volume: 1, menuSounds: true, menuVolume: 1 }),
    roles = [],
    tones = [];
  a.context = { currentTime: 0 };
  a.updateVolume = () => {};
  a.menuAudio = {
    async play(role) {
      roles.push(role);
      return true;
    },
  };
  a.sample = (...args) => tones.push(args);
  assert.equal(await a.tone("ui"), true);
  assert.deepEqual(roles, ["select"]);
  a.settings.menuSounds = false;
  assert.equal(await a.menu("exit"), false);
  a.tone("pickup");
  assert.equal(tones[0][0], "pickup");
});
