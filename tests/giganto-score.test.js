import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { TitanScore } from "../src/giganto-score.js";
import { GIGANTO_SCORE } from "../src/giganto-score-data.js";
import {
  titanScorePlan,
  TITAN_SCORE_CUES,
  scorePosition,
} from "../src/giganto-score-timeline.js";
import {
  titanSession,
  restoreTitanSession,
  retryTitan,
} from "../src/giganto-simulation.js";
import { TitanAudio } from "../src/giganto-audio.js";
function setup(options = {}) {
  const created = [],
    parameters = [];
  const node = () => ({
    connect() {},
    disconnect() {
      this.disconnected = true;
    },
  });
  const context = {
    state: "running",
    currentTime: 0,
    createGain() {
      return {
        ...node(),
        gain: {
          value: 0,
          cancelAndHoldAtTime() {},
          linearRampToValueAtTime(v, t) {
            this.value = v;
            parameters.push([v, t]);
          },
        },
      };
    },
    createBufferSource() {
      const s = {
        ...node(),
        start(when, offset) {
          this.when = when;
          this.offset = offset;
        },
        stop(when) {
          this.stopped = when ?? context.currentTime;
        },
      };
      created.push(s);
      return s;
    },
  };
  const buffer = {
    duration: 264.93,
    sampleRate: 1000,
    numberOfChannels: 2,
    channels: [
      new Float32Array(265000).fill(0.25),
      new Float32Array(265000).fill(0.25),
    ],
    getChannelData(i) {
      return this.channels[i];
    },
  };
  const score = new TitanScore(context, node(), {
    decode: async () => buffer,
    ...options,
  });
  const session = titanSession({ cinematicPace: 1, cinematics: false });
  session.stage = "combat";
  const settings = { volume: 0.8, musicEnabled: true, musicVolume: 0.45 };
  return { score, context, session, settings, created, buffer, parameters };
}
test("Giganto score retains the complete supplied MP3 byte for byte and its manifest SHA-256, with offline data only", () => {
  const b = fs.readFileSync(
    new URL("../public/audio/giganto/undefeatable.mp3", import.meta.url),
  );
  const m = JSON.parse(
    fs.readFileSync(
      new URL("../public/audio/giganto/manifest.json", import.meta.url),
    ),
  );
  assert.equal(GIGANTO_SCORE.bytes, b.length);
  assert.equal(b.length, 4493052);
  assert.deepEqual(Buffer.from(GIGANTO_SCORE.base64, "base64"), b);
  assert.equal(
    createHash("sha256").update(b).digest("hex"),
    GIGANTO_SCORE.sha256,
  );
  assert.equal(m.sha256, GIGANTO_SCORE.sha256);
});
test("requested timestamps select exact phase loops and a continuous victory tail", () => {
  const s = titanSession({ cinematicPace: 1 });
  for (const stage of ["intro", "traversal", "transform", "defeat"]) {
    s.stage = stage;
    assert.equal(titanScorePlan(s), null);
  }
  s.stage = "combat";
  for (const [time, expected] of [
    [0, 0],
    [119.9, 119.9],
    [120, 0],
    [240.25, 0.25],
    [12000, 0],
  ]) {
    s.stageTime = time;
    assert.equal(titanScorePlan(s).offset, expected);
  }
  assert.deepEqual(TITAN_SCORE_CUES.phaseOne, {
    start: 0,
    loopStart: 0,
    loopEnd: 120,
  });
  s.stage = "phase";
  s.stageTime = 0;
  assert.equal(titanScorePlan(s).offset, 121);
  s.stageTime = 4;
  assert.equal(titanScorePlan(s).offset, 125);
  s.stage = "combat";
  s.phase = 2;
  s.stageTime = 0;
  assert.equal(titanScorePlan(s).offset, 121);
  s.stage = "finale";
  assert.equal(titanScorePlan(s).offset, 237);
  s.stageTime = 7;
  assert.equal(titanScorePlan(s).offset, 244);
  s.stage = "victory";
  s.stageTime = 0;
  assert.equal(titanScorePlan(s).offset, 244);
  s.stageTime = 10;
  assert.equal(titanScorePlan(s).offset, 254);
});
test("audio-clock transport pauses at the same musical point, resumes without a restart, follows volume and uses bounded edge-tapered PCM", async () => {
  const { score, context, session, settings, created, buffer } = setup();
  await score.prepare();
  const lo = Math.round(TITAN_SCORE_CUES.phaseOne.loopStart * 1000);
  assert.equal(buffer.channels[0][lo], 0);
  assert.equal(buffer.channels[0][lo + 2], 0.25);
  score.update(session, true, settings);
  assert.equal(created.length, 1);
  assert.equal(created[0].offset, 0);
  assert.equal(created[0].loop, true);
  session.stageTime = context.currentTime = 12.3;
  score.update(session, true, settings);
  assert.equal(created.length, 1);
  score.update(session, false, settings);
  assert.equal(score.current, null);
  context.currentTime = 22.3;
  score.update(session, true, settings);
  assert.equal(created.length, 2);
  assert.equal(score.current.offset, 12.3);
  assert.equal(score.current.gain.gain.value, 0.27);
  settings.musicVolume = 0.2;
  score.update(session, true, settings);
  assert.equal(score.current.gain.gain.value, 0.12);
  context.currentTime += 300;
  session.stageTime += 300;
  score.update(session, true, settings);
  assert.equal(created.length, 2);
  assert.ok(scorePosition(score.current, context.currentTime) < 120);
  score.dispose();
  assert.equal(score.buffer, null);
  assert.equal(score.voices.size, 0);
});
test("phase-two pickup joins the chorus without restarting; skipped movies, finale and defeat safely select or stop cues", async () => {
  const { score, context, session: s, settings, created } = setup();
  await score.prepare();
  score.update(s, true, settings);
  context.currentTime = 20;
  s.stage = "phase";
  s.phase = 2;
  s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(score.current.offset, 121);
  assert.equal(created.length, 2);
  context.currentTime = 24;
  s.stage = "combat";
  s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(created.length, 2);
  assert.equal(score.current.section, "phaseTwo");
  assert.ok(Math.abs(scorePosition(score.current, 24) - 125) < 1e-8);
  s.stage = "phase";
  s.stageTime = 0;
  context.currentTime = 25;
  score.update(s, true, settings);
  s.stage = "combat";
  s.stageTime = 0;
  context.currentTime = 25.3;
  score.update(s, true, settings);
  assert.equal(score.current.offset, 121);
  s.stage = "finale";
  s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(score.current.offset, 237);
  assert.equal(score.current.source.loop, false);
  s.stage = "defeat";
  score.update(s, true, settings);
  assert.equal(score.current, null);
  score.dispose();
});
test("master/music switches, context suspension, pending decode disposal and decoder failure never start stale or overlapping music", async () => {
  const t = setup();
  await t.score.prepare();
  for (const [field, value] of [
    ["volume", 0],
    ["musicEnabled", false],
    ["musicVolume", 0],
  ]) {
    const settings = { ...t.settings, [field]: value };
    t.score.update(t.session, true, settings);
    assert.equal(t.created.length, 0);
  }
  t.session.config.music = false;
  t.score.update(t.session, true, t.settings);
  assert.equal(t.created.length, 0);
  t.session.config.music = true;
  t.context.state = "suspended";
  t.score.update(t.session, true, t.settings);
  assert.equal(t.created.length, 0);
  t.context.state = "running";
  for (let i = 0; i < 20; i++) {
    t.session.stage = i % 2 ? "phase" : "combat";
    t.session.stageTime = i * 3;
    t.context.currentTime = i;
    t.score.update(t.session, true, t.settings);
    assert.ok(t.score.voices.size <= 2);
  }
  t.score.dispose();
  assert.equal(t.score.buffer, null);
  let resolve;
  const a = setup({ decode: () => new Promise((r) => (resolve = r)) });
  const ready = a.score.prepare();
  await Promise.resolve();
  a.score.dispose();
  resolve(a.buffer);
  assert.equal(await ready, null);
  assert.equal(a.score.buffer, null);
  assert.equal(a.created.length, 0);
  const b = setup({
    decode: async () => {
      throw Error("bad MP3");
    },
  });
  assert.equal(await b.score.prepare(), null);
  assert.equal(b.score.failed, true);
  b.score.update(b.session, true, b.settings);
  assert.equal(b.created.length, 0);
});
test("long arena saves restore the exact score position past two minutes, and checkpoint retry starts its own phase cue", () => {
  const s = titanSession({ cinematicPace: 1, cinematics: false });
  s.original = { player: {} };
  s.stage = "combat";
  s.stageTime = 450.4;
  s.phase = 2;
  s.checkpoint = "phase2";
  s.emerald = true;
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.stageTime, 450.4);
  assert.deepEqual(titanScorePlan(restored), titanScorePlan(s));
  restored.stage = "defeat";
  retryTitan(restored);
  assert.equal(restored.stage, "combat");
  assert.equal(restored.phase, 2);
  assert.equal(restored.stageTime, 0);
  assert.equal(titanScorePlan(restored).offset, 121);
});
test("recorded battle music replaces the generated combat score while traversal and combat sound effects retain their existing path", () => {
  const game = {
    settings: { volume: 0, musicEnabled: false },
    audio: { context: { currentTime: 0 }, updateVolume() {} },
    giganto: { record: { config: { audio: true } } },
  };
  const audio = new TitanAudio(game);
  let notes = 0;
  audio.tone = () => notes++;
  const s = titanSession({ cinematicPace: 1 });
  s.stage = "combat";
  audio.frame(s, true);
  assert.equal(notes, 0);
  game.settings.musicEnabled = true;
  s.stage = "traversal";
  audio.frame(s, true);
  assert.ok(notes > 0);
  const before = notes;
  audio.event({ type: "hit" });
  assert.ok(notes > before);
  audio.dispose();
});

test("render hitches never seek a playing phase; snapshots retain actual audio position, survive clock restoration and reset safely on retry", async () => {
  const a = setup();
  await a.score.prepare();
  a.score.update(a.session, true, a.settings);
  a.context.currentTime = 8;
  a.session.stageTime = 1;
  a.score.update(a.session, true, a.settings);
  assert.equal(a.created.length, 1);
  assert.equal(a.session.battleMusic.offset, 8);
  a.context.currentTime = 10;
  a.score.snapshot(a.session);
  assert.equal(a.session.battleMusic.offset, 10);
  const raw = JSON.parse(JSON.stringify(a.session));
  raw.original = { player: {} };
  const restored = restoreTitanSession(raw);
  const b = setup();
  await b.score.prepare();
  b.score.update(restored, true, b.settings);
  assert.equal(b.score.current.offset, 10);
  assert.equal(restored.stageTime, 1);
  b.score.update(restored, false, b.settings);
  b.context.currentTime = 100;
  b.score.update(restored, true, b.settings);
  assert.equal(b.score.current.offset, 10);
  restored.stage = "defeat";
  restored.checkpoint = "combat";
  retryTitan(restored);
  b.score.update(restored, true, b.settings);
  assert.equal(b.score.current.offset, 0);
  a.score.dispose();
  b.score.dispose();
});

test("victory release is scheduled at the recording end, survives hitches and resumes the remaining fade", async () => {
  const h = setup(),
    curves = [];
  const create = h.context.createGain;
  h.context.createGain = () => {
    const n = create();
    n.gain.cancelScheduledValues = () => {};
    n.gain.setValueAtTime = (v, t) => h.parameters.push([v, t]);
    n.gain.setValueCurveAtTime = (v, t, d) => curves.push({ v: [...v], t, d });
    return n;
  };
  await h.score.prepare();
  h.session.stage = "finale";
  h.session.stageTime = 0;
  h.score.update(h.session, true, h.settings);
  const end = h.buffer.duration - 237;
  assert.equal(curves.length, 1);
  assert.ok(Math.abs(curves[0].t - (end - 1.8)) < 1e-5);
  assert.ok(Math.abs(curves[0].d - 1.8) < 1e-5);
  assert.equal(curves[0].v.at(-1), 0);
  h.context.currentTime = 7;
  h.session.stage = "victory";
  h.session.stageTime = 0;
  const original = h.score.current;
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.current, original);
  assert.equal(h.score.starts, 1);
  assert.equal(curves.length, 1);
  h.context.currentTime = end - 1.3;
  h.session.stageTime = end - 8.3;
  h.score.update(h.session, true, h.settings);
  h.score.update(h.session, false, h.settings);
  h.context.currentTime = 101;
  h.score.update(h.session, true, h.settings);
  assert.equal(curves.length, 2);
  assert.ok(Math.abs(curves[1].d - 1.3) < 1e-5);
  assert.ok(curves[1].v[0] < curves[0].v[0]);
  assert.equal(curves[1].v.at(-1), 0);
  h.score.dispose();
  assert.equal(h.score.voices.size, 0);
});

test("both native phase loops use exact decoded boundaries, and the victory tail ends once without replay", async () => {
  const h = setup();
  await h.score.prepare();
  assert.equal(h.score.cues.phaseTwo.loopEnd, h.buffer.duration);
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.current.source.loopStart, 0);
  assert.equal(h.score.current.source.loopEnd, 120);
  h.context.currentTime = 360.25;
  h.score.update(h.session, true, h.settings);
  assert.equal(h.session.battleMusic.offset, 0.25);
  h.session.stage = "phase";
  h.session.phase = 2;
  h.session.stageTime = 0;
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.current.offset, 121);
  h.context.currentTime += 4.1;
  h.session.stage = "combat";
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.current.source.loopEnd, h.buffer.duration);
  h.context.currentTime += (h.buffer.duration - 121) * 3;
  h.score.update(h.session, true, h.settings);
  assert.ok(Math.abs(h.session.battleMusic.offset - 125.1) < 1e-8);
  h.session.stage = "finale";
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.current.offset, 237);
  assert.equal(h.score.current.source.loop, false);
  h.context.currentTime += 7;
  h.session.stage = "victory";
  h.score.update(h.session, true, h.settings);
  assert.ok(Math.abs(h.session.battleMusic.offset - 244) < 1e-8);
  const starts = h.score.starts;
  h.context.currentTime += 100;
  h.score.update(h.session, true, h.settings);
  assert.equal(h.score.state, "ended");
  assert.equal(h.session.battleMusic.offset, h.buffer.duration);
  for (let i = 0; i < 100; i++) {
    h.context.currentTime++;
    h.score.update(h.session, true, h.settings);
  }
  assert.equal(h.score.starts, starts);
  const save = JSON.parse(JSON.stringify(h.session));
  const reload = setup();
  await reload.score.prepare();
  reload.score.update(save, true, reload.settings);
  assert.equal(reload.score.starts, 0);
  assert.equal(reload.score.state, "ended");
  h.score.dispose();
  reload.score.dispose();
});
