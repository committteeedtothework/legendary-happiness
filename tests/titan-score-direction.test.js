import test from "node:test";
import assert from "node:assert/strict";
import {
  titanScoreCues,
  titanScoreLength,
  titanScorePlan,
  TITAN_SCORE_CUES,
} from "../src/giganto-score-timeline.js";
import { TitanScore } from "../src/giganto-score.js";
import { TitanMusicLibrary } from "../src/titan-music-library.js";
import { TitanPrelude } from "../src/titan-prelude.js";
import {
  titanSession,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import { alignTitanCinematic } from "../src/titan-timing.js";
import { titanSettingsPanel } from "../src/titan-menu.js";
const short = () => ({
  bpm: 200,
  phaseOne: { start: 0, loopStart: 1, loopEnd: 8 },
  phaseTwo: { start: 6, loopStart: 4, loopEnd: 10 },
  finale: { start: 2 },
});
function clock() {
  const sources = [],
    node = () => ({
      connect() {},
      disconnect() {
        this.disconnected = true;
      },
    });
  const context = {
    currentTime: 0,
    state: "running",
    createGain() {
      return {
        ...node(),
        gain: {
          value: 0,
          cancelAndHoldAtTime() {},
          linearRampToValueAtTime(v) {
            this.value = v;
          },
        },
      };
    },
    createBufferSource() {
      const s = {
        ...node(),
        start(t, o) {
          this.when = t;
          this.offset = o;
        },
        stop() {
          this.stopped = true;
        },
      };
      sources.push(s);
      return s;
    },
  };
  return { context, sources, node };
}
test("cue maps validate whole loop groups, start the phase transition at the second-phase cue and bound all source ranges", () => {
  const c = titanScoreCues(short());
  assert.equal(c.transition.start, 6);
  assert.equal(titanScoreLength(c), 10);
  const s = titanSession({ cinematicPace: 1, scoreCues: c });
  s.stage = "phase";
  s.stageTime = 4;
  assert.equal(titanScorePlan(s).offset, 10);
  s.stage = "combat";
  s.phase = 2;
  s.stageTime = 0;
  assert.equal(titanScorePlan(s).offset, 6);
  const invalid = short();
  invalid.phaseTwo.loopEnd = 3;
  invalid.finale.start = Infinity;
  assert.deepEqual(titanScoreCues(invalid).phaseTwo, TITAN_SCORE_CUES.phaseTwo);
  assert.equal(titanScoreCues(invalid).finale.start, 237);
  assert.deepEqual(TITAN_SCORE_CUES.phaseTwo, {
    start: 121,
    loopStart: 121,
    loopEnd: 264.96,
    toEnd: true,
  });
});
test("a short local track uses its own cue limits, rejects another track's checkpoint, and resumes its own exact cursor", async () => {
  const { context, sources, node } = clock(),
    cues = titanScoreCues(short());
  const score = new TitanScore(context, node(), {
    cues,
    trackId: "titan:test",
    decode: async () => ({ duration: 12 }),
  });
  await score.prepare();
  assert.equal(score.failed, undefined);
  const s = titanSession({ cinematicPace: 1,
    scoreCues: cues,
    battleTrack: { id: "titan:test", name: "Test", duration: 12 },
  });
  s.stage = "combat";
  s.stageTime = 0;
  s.battleMusic = { section: "phaseOne", offset: 5, track: "titan:another" };
  const settings = { volume: 1, musicVolume: 1, musicEnabled: true };
  score.update(s, true, settings);
  assert.equal(sources[0].offset, 0);
  context.currentTime = 3.25;
  score.update(s, false, settings);
  assert.equal(s.battleMusic.track, "titan:test");
  assert.equal(s.battleMusic.offset, 3.25);
  const raw = JSON.parse(JSON.stringify(s));
  raw.original = {};
  const restored = restoreTitanSession(raw);
  context.currentTime = 10;
  score.update(restored, true, settings);
  assert.equal(score.current.offset, 3.25);
  score.dispose();
  assert.equal(score.voices.size, 0);
  const bad = new TitanScore(context, node(), {
    cues,
    decode: async () => ({ duration: 9 }),
  });
  await bad.prepare();
  assert.equal(bad.state, "unavailable");
  assert.match(bad.error, /shorter/);
  bad.dispose();
});
test("protected cinematic contacts follow the score at different frame rates without adding simulation time twice", () => {
  for (const fps of [30, 60, 144]) {
    const s = titanSession({ cinematicPace: 1, drain: 0 });
    s.stage = "finale";
    s.emerald = true;
    const score = {
      cues: TITAN_SCORE_CUES,
      context: { state: "running", currentTime: 0 },
      current: { section: "finale", offset: 237, when: 0 },
    };
    const hits = [];
    let pending = 0;
    for (let i = 1; i <= Math.floor(fps * 6.9); i++) {
      score.context.currentTime = i / fps;
      pending += 1 / fps;
      const steps = Math.floor((pending + 1e-9) * 60);
      if (!steps) continue;
      alignTitanCinematic(s, score, steps / 60);
      for (let n = 0; n < steps; n++) {
        stepTitan(s, {}, 1 / 60);
        hits.push(...s.events.filter((e) => e.type === "cinematic-cue"));
        pending -= 1 / 60;
      }
      assert.ok(
        Math.abs(s.stageTime - i / fps) < 1e-8,
        `${fps} Hz: ${s.stageTime} / ${i / fps}`,
      );
    }
    assert.deepEqual(
      hits.map((e) => e.cue),
      ["charge", "launch", "contact", "rupture", "detonate"],
    );
    assert.equal(new Set(hits.map((e) => e.eventId)).size, 5);
  }
});
test("pre-fight media resumes a saved cursor after metadata and ignores an abandoned load", async () => {
  const { context, node } = clock();
  context.createMediaElementSource = node;
  let media, seek;
  const createMedia = () =>
    (media = {
      readyState: 0,
      currentTime: 0,
      paused: true,
      play() {
        this.paused = false;
        return Promise.resolve();
      },
      pause() {
        this.paused = true;
      },
      removeAttribute() {},
      load() {},
      addEventListener(type, fn) {
        if (type === "loadedmetadata") seek = fn;
      },
    });
  const s = titanSession({ cinematicPace: 1 });
  s.preludeMusic = { offset: 41.5 };
  const p = new TitanPrelude(context, node(), { createMedia });
  p.update(s, true, { musicEnabled: true, volume: 1, musicVolume: 1 });
  await Promise.resolve();
  assert.equal(media.currentTime, 0);
  p.snapshot(s);
  assert.equal(s.preludeMusic.offset, 41.5);
  media.readyState = 1;
  seek();
  assert.equal(media.currentTime, 41.5);
  media.currentTime = 43;
  p.snapshot(s);
  assert.equal(s.preludeMusic.offset, 43);
  s.stage = "combat";
  p.update(s, true, { musicEnabled: true, volume: 1, musicVolume: 1 });
  assert.equal(p.player.media, null);
  seek();
  assert.equal(media.currentTime, 43);
  p.dispose();
});
test("local imports validate decoded duration before storing and report missing files without fetching or substituting music", async () => {
  const records = new Map(),
    library = {
      persistent: true,
      async put(id, file) {
        records.set(id, { blob: file });
      },
      async get(id) {
        return records.get(id);
      },
    },
    store = new TitanMusicLibrary(library);
  const file = new File([new Uint8Array([73, 68, 51])], "My <track>.mp3", {
    type: "audio/mpeg",
  });
  const context = { decodeAudioData: async () => ({ duration: 12 }) };
  const q = await store.import(file, context, titanScoreCues(short()));
  assert.equal(records.size, 1);
  assert.equal(q.buffer.duration, 12);
  assert.equal((await store.decode(q.track, context)).duration, 12);
  await assert.rejects(
    store.decode({ id: "titan:missing" }, context),
    /missing/,
  );
  await assert.rejects(
    store.import(
      file,
      { decodeAudioData: async () => ({ duration: 1 }) },
      titanScoreCues(short()),
    ),
    /shorter/,
  );
  assert.equal(records.size, 1);
  const html = titanSettingsPanel(
    titanSession({ cinematicPace: 1, battleTrack: q.track }).config,
    true,
    {},
  );
  assert.ok(html.includes("My &lt;track&gt;"));
  assert.ok(html.includes('data-titan="apply-cues"'));
  assert.ok(html.includes("data-titan-track"));
});
test("a delayed natural phase handoff preserves the existing chorus voice instead of replaying the downbeat", async () => {
  const { context, sources, node } = clock();
  const score = new TitanScore(context, node(), {
    decode: async () => ({ duration: 265 }),
  });
  await score.prepare();
  const s = titanSession({ cinematicPace: 1 });
  s.stage = "phase";
  s.stageTime = 0;
  const settings = { volume: 1, musicVolume: 1, musicEnabled: true };
  score.update(s, true, settings);
  const voice = score.current;
  context.currentTime = 4.12;
  s.stage = "combat";
  s.phase = 2;
  s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(score.current, voice);
  assert.equal(sources.length, 1);
  assert.ok(Math.abs(s.battleMusic.offset - 125.12) < 1e-8);
  assert.equal(voice.source.loop, true);
  score.dispose();
});
test("audio-owned endpoints finish despite floating-point rounding, and pose clock corrections do not masquerade as retries", async () => {
  for (const stage of ["phase", "finale"]) {
    const s = titanSession({ cinematicPace: 1, drain: 0 });
    s.stage = stage;
    s.emerald = true;
    s.stageTime = (stage === "phase" ? 4 : 7) - 1 / 60 - 1e-14;
    stepTitan(s, {}, 1 / 60);
    assert.equal(s.stage, stage === "phase" ? "combat" : "victory");
  }
  const { context, sources, node } = clock(),
    score = new TitanScore(context, node(), {
      decode: async () => ({ duration: 265 }),
    });
  await score.prepare();
  const s = titanSession({ cinematicPace: 1 });
  s.stage = "phase";
  s.stageTime = 1;
  const settings = { volume: 1, musicVolume: 1, musicEnabled: true };
  score.update(s, true, settings);
  context.currentTime = 1;
  s.stageTime = 0.999;
  score.update(s, true, settings);
  assert.equal(sources.length, 1);
  s.attempt = 1;
  s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(sources.length, 2);
  assert.equal(score.current.offset, 121);
  score.dispose();
});
