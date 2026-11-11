import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createPistolBank } from "../src/pistol-audio.js";
import { AudioEngine } from "../src/audio.js";
const context = (sampleRate) => ({
  sampleRate,
  createBuffer(channels, length, rate) {
    const d = new Float32Array(length);
    return {
      length,
      numberOfChannels: channels,
      sampleRate: rate,
      duration: length / rate,
      getChannelData() {
        return d;
      },
    };
  },
});
const rms = (a) => Math.sqrt(a.reduce((n, x) => n + x * x, 0) / a.length);
test("pistol bank is finite, nonclipping, click-free at its endpoints and consistent at browser sample rates", () => {
  for (const rate of [22050, 44100, 48000]) {
    const bank = createPistolBank(context(rate));
    for (const buffers of Object.values(bank))
      for (const b of buffers) {
        const d = b.getChannelData(0);
        assert.equal(d[0], 0);
        assert.equal(Math.abs(d[d.length - 1]), 0);
        assert.ok(d.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.821));
        assert.ok(rms(d.slice(0, Math.floor(rate * 0.08))) > 0.1);
        assert.ok(rms(d.slice(Math.floor(rate * 0.3))) < 0.005);
        assert.ok(Math.abs(d.reduce((n, x) => n + x, 0) / d.length) < 0.0001);
      }
  }
});
test("both pistol finishes have reproducible, distinct variations without reference recordings", () => {
  const a = createPistolBank(context(48000)),
    b = createPistolBank(context(48000));
  const hash = (x) =>
    createHash("sha256")
      .update(Buffer.from(x.getChannelData(0).buffer))
      .digest("hex");
  const hashes = Object.values(a).flat().map(hash);
  assert.equal(new Set(hashes).size, 8);
  assert.deepEqual(hashes, Object.values(b).flat().map(hash));
});
test("maximum-rate alternating fire has a bounded tail and headroom before the master compressor", () => {
  const bank = createPistolBank(context(48000)),
    mix = new Float32Array(48000 * 3);
  for (let shot = 0; shot < 12; shot++) {
    const b =
      bank[shot % 2 ? "pistol_black" : "pistol_silver"][
        shot % 4
      ].getChannelData(0);
    const offset = shot * 9600;
    for (let i = 0; i < b.length; i++) mix[offset + i] += b[i] * 0.34;
  }
  assert.ok(mix.every((x) => Number.isFinite(x) && Math.abs(x) < 0.5));
  assert.equal(rms(mix.slice(48000 * 2.7)), 0);
});
test("firing selects the actual hand timbre and light stereo position while respecting master mute", () => {
  const a = new AudioEngine({ volume: 0.65 }),
    calls = [];
  a.context = {};
  a.updateVolume = () => {};
  a.sample = (...args) => calls.push(args);
  a.tone("pistol", "silver");
  a.tone("pistol", "black");
  assert.equal(calls[0][0], "pistol_silver");
  assert.equal(calls[1][0], "pistol_black");
  assert.equal(calls[0][4], 0.12);
  assert.equal(calls[1][4], -0.12);
  assert.ok(
    calls.every((c) => c[1] === 0.34 && c[2] >= 0.992 && c[2] <= 1.008),
  );
  a.settings.volume = 0;
  a.tone("pistol", "black");
  assert.equal(calls.length, 2);
});
test("generic pistol previews alternate both finishes without changing player state", () => {
  const a = new AudioEngine({ volume: 1 }),
    calls = [];
  a.context = {};
  a.updateVolume = () => {};
  a.sample = (id) => calls.push(id);
  a.tone("pistol");
  a.tone("pistol");
  assert.deepEqual(calls, ["pistol_silver", "pistol_black"]);
});
