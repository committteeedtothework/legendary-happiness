import test from "node:test";
import assert from "node:assert/strict";
import { WyvernScore, WyvernPrelude } from "../src/wyvern-music.js";
import { wyvernSession, restoreWyvernSession } from "../src/wyvern-simulation.js";
import { scorePosition } from "../src/giganto-score-timeline.js";
function setup() {
  const parameter = () => ({ value: 0, cancelAndHoldAtTime() {},
    setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; } });
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx = { currentTime: 0, state: "running",
    createGain: () => ({ ...node(), gain: parameter() }),
    createMediaElementSource: node,
    createBufferSource: () => ({ ...node(), start(t, offset) { this.offset = offset; }, stop() {} }) };
  const score = new WyvernScore(ctx, node(), { decode: async () => ({duration: 249.573878}) });
  const s = wyvernSession();
  const settings = { volume: 1, musicVolume: 0.5, musicEnabled: true };
  return { ctx, score, s, settings, node };
}
test("Wyvern exact phase loops use the audio clock and do not restart for counters or QTEs", async () => {
  const {ctx, score, s, settings} = setup();
  await score.prepare();
  for (const stage of ["intro", "traversal", "transform"]) {
    s.stage = stage; score.update(s, true, settings); assert.equal(score.current, null);
  }
  s.stage = "combat"; s.stageTime = 0;
  score.update(s, true, settings);
  assert.equal(score.current.offset, 0);
  assert.equal(score.current.source.loopStart, 0);
  assert.equal(score.current.source.loopEnd, 103);
  ctx.currentTime = 44;
  s.stage = "wyvern-counter";
  score.update(s, true, settings);
  assert.equal(score.starts, 1);
  assert.equal(scorePosition(score.current, 44), 44);
  for (const [time, expected] of [[102.99,102.99],[103,0],[206,0],[309.25,0.25]]) {
    ctx.currentTime=time;score.update(s,true,settings);
    assert.ok(Math.abs(scorePosition(score.current,time)-expected)<1e-8);
    assert.equal(score.starts,1);
  }
  s.stage = "phase"; s.stageTime = 0; s.phase = 2;
  score.update(s, true, settings);
  assert.equal(score.current.offset, 104);
  assert.equal(score.current.source.loopEnd, 249);
  const count = score.starts;
  ctx.currentTime += 146;
  for (const stage of ["combat", "wyvern-dive", "wyvern-jaw", "finale"]) {
    s.stage = stage; score.update(s, true, settings);
    assert.equal(score.starts, count);
    assert.equal(scorePosition(score.current, ctx.currentTime), 105);
  }
  score.dispose(); assert.equal(score.voices.size, 0);
});
test("Wyvern pause, save/reload, retry, victory fade and defeat never leak the prior song", async () => {
  const {ctx, score, s, settings} = setup(); await score.prepare();
  Object.assign(s, {stage: "combat", stageTime: 0}); score.update(s, true, settings);
  ctx.currentTime = 12; score.update(s, false, settings);
  assert.equal(s.battleMusic.offset, 12); assert.equal(score.current, null);
  ctx.currentTime = 70; score.update(s, true, settings);
  assert.equal(score.current.offset, 12);
  score.snapshot(s);
  const restored = restoreWyvernSession(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.battleMusic.track, "titan:wyvern-battle-v1");
  score.update(restored, true, settings); assert.equal(score.current.offset, 12);
  restored.attempt++; score.update(restored, true, settings);
  assert.equal(score.current.offset, 0);
  Object.assign(restored, {stage:"victory", stageTime:3, phase:2});
  score.update(restored, true, settings); assert.equal(score.current, null);
  restored.stage = "defeat"; score.update(restored, true, settings);
  assert.equal(restored.battleMusic, null);
  score.dispose();
});
test("Wyvern prelude loops, pauses, restores position, resets on retry and stops before battle", async () => {
  const {ctx, s, settings, node} = setup();
  const media = [];
  const prelude = new WyvernPrelude(ctx, node(), {createMedia: () => {
    const m = {readyState:1, currentTime:0, duration:221.3355, paused:true,
      play() { this.paused=false; return Promise.resolve(); },
      pause() {this.paused=true;}, removeAttribute() {}, load() {} };
    media.push(m); return m;
  }});
  s.preludeMusic = {offset:30};
  prelude.update(s, true, settings); await Promise.resolve();
  assert.equal(media[0].currentTime,30); assert.equal(media[0].loop,true);
  assert.equal(prelude.player.currentTrack.id,"wyvern-prelude");
  media[0].currentTime=42; prelude.update(s,false,settings);
  assert.equal(s.preludeMusic.offset,42); assert.ok(media[0].paused);
  prelude.update(s,true,settings); await Promise.resolve();
  assert.equal(media[0].currentTime,42);
  s.attempt = (s.attempt || 0) + 1; prelude.update(s,true,settings); await Promise.resolve();
  assert.equal(media[1].currentTime,0);
  s.stage="combat"; prelude.update(s,true,settings);
  assert.ok(media[1].paused); assert.equal(prelude.player.media,null);
  prelude.dispose();
});
