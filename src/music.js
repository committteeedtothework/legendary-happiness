import { OverworldMusic } from "./overworld-music.js";
// Original generative chamber music remains in Cinderworld. The Overworld uses
// the separately attributed, user-supplied recordings in OverworldMusic.
export function makeMusicPhrase(seed, biome = "meadow", phrase = 0) {
  let state = (seed ^ Math.imul(phrase + 1, 73471)) | 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
  const cold = ["alpine", "snowy_taiga", "pine_forest", "ocean"].includes(
      biome,
    ),
    scale = cold ? [0, 2, 3, 7, 10] : [0, 2, 4, 7, 9],
    root = cold ? 50 : 48;
  const events = [];
  let cursor = 1.5,
    note = 2;
  for (let bar = 0; bar < 8; bar++) {
    const chord = [0, 3, 4, 1][(bar + Math.floor(random() * 2)) % 4];
    events.push({
      at: cursor,
      midi: root + scale[chord % 5] - 12,
      duration: 5 + random() * 3,
      gain: 0.17,
      instrument: "felt",
    });
    if (random() > 0.25)
      events.push({
        at: cursor + 0.18,
        midi: root + scale[(chord + 2) % 5],
        duration: 5,
        gain: 0.09,
        instrument: "felt",
      });
    for (let i = 0; i < 2 + Math.floor(random() * 3); i++) {
      note = Math.max(
        0,
        Math.min(
          9,
          note + (random() < 0.5 ? -1 : 1) * (random() < 0.8 ? 1 : 2),
        ),
      );
      const octave = Math.floor(note / 5),
        midi = root + 12 + scale[note % 5] + octave * 12;
      events.push({
        at: cursor + 0.8 + i * (0.8 + random() * 0.6),
        midi,
        duration: 2.5 + random() * 3,
        gain: 0.12 + random() * 0.08,
        instrument: random() < 0.13 ? "bell" : "felt",
      });
    }
    cursor += 6 + random() * 3;
  }
  return {
    events: events.sort((a, b) => a.at - b.at),
    duration: cursor + 10 + random() * 18,
    biome,
    phrase,
  };
}
export function musicSamples(midi, instrument, rate, duration = 6) {
  const a = new Float32Array(Math.ceil(rate * duration)),
    f = 440 * 2 ** ((midi - 69) / 12);
  const partials =
    instrument === "bell"
      ? [1, 2.01, 3.9, 5.43]
      : [1, 2.002, 3.008, 4.018, 5.03];
  for (let i = 0; i < a.length; i++) {
    const t = i / rate,
      attack = 1 - Math.exp(-t / (instrument === "bell" ? 0.008 : 0.012));
    let v = 0;
    for (let n = 0; n < partials.length; n++)
      v +=
        (Math.sin(2 * Math.PI * f * partials[n] * t) *
          Math.exp(-t * (0.5 + n * 0.35))) /
        (1 + n * n * 0.7);
    a[i] = v * 0.3 * attack * Math.min(1, (a.length - 1 - i) / (rate * 0.15));
  }
  return a;
}
export class MusicEngine {
  constructor(context, output) {
    this.context = context;
    this.overworld = new OverworldMusic(context, output);
    this.creative = new OverworldMusic(context, output, { mode: "creative" });
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(output);
    this.cache = new Map();
    this.sources = new Set();
    this.enabled = false;
    this.phrase = 0;
    this.nextPhrase = 0;
    this.events = [];
    this.scheduled = 0;
    const delay = context.createDelay(1);
    delay.delayTime.value = 0.37;
    const echo = context.createGain();
    echo.gain.value = 0.16;
    this.output.connect(delay);
    delay.connect(echo);
    echo.connect(output);
  }
  update(game, settings) {
    // Pause the old mode first, so switching never starts two songs together.
    if (game.mode === "creative") {
      this.overworld.update(game, settings);
      this.creative.update(game, settings);
    } else {
      this.creative.update(game, settings);
      this.overworld.update(game, settings);
    }
    const c = this.context,
      enabled =
        !!settings.musicEnabled &&
        game.dimension !== "overworld" &&
        game.active &&
        game.running &&
        !["playing", "menu-paused"].includes(game.jukebox?.state) &&
        settings.volume > 0 &&
        (settings.musicVolume ?? 0.45) > 0;
    const target = enabled ? (settings.musicVolume ?? 0.45) * 0.65 : 0;
    if (this.lastGain !== target) {
      this.fade(target, enabled ? 0.8 : 0.12);
    }
    if (!enabled) {
      if (this.enabled) {
        for (const s of this.sources) {
          try {
            s.stop(c.currentTime + 0.25);
          } catch {}
        }
        this.events = [];
        this.nextPhrase = 0;
      }
      this.enabled = false;
      return;
    }
    this.enabled = true;
    if (c.currentTime >= this.nextPhrase) {
      const biome = game.world.terrain(game.player.x, game.player.z).biome,
        plan = makeMusicPhrase(game.world.seedInt, biome, this.phrase++);
      this.events = plan.events.map((e) => ({
        ...e,
        at: e.at + c.currentTime,
      }));
      this.nextPhrase = c.currentTime + plan.duration;
      this.currentBiome = biome;
    }
    while (this.events.length && this.events[0].at < c.currentTime + 0.7) {
      const e = this.events.shift();
      if (e.at < c.currentTime - 0.1) continue;
      const f = 440 * 2 ** ((e.midi - 69) / 12),
        gain = c.createGain(),
        filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(
        f * (e.instrument === "bell" ? 10 : 7),
        e.at,
      );
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(220, f * 1.4),
        e.at + e.duration,
      );
      gain.gain.setValueAtTime(0.00001, e.at);
      gain.gain.exponentialRampToValueAtTime(e.gain * 0.65, e.at + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.00001, e.at + e.duration + 1.2);
      filter.connect(gain);
      gain.connect(this.output);
      const oscillators = [];
      for (const [ratio, level] of e.instrument === "bell"
        ? [
            [1, 0.65],
            [2.01, 0.23],
            [3.9, 0.08],
          ]
        : [
            [1, 0.65],
            [2.002, 0.2],
            [3.008, 0.07],
          ]) {
        const source = c.createOscillator(),
          partial = c.createGain();
        source.type = "sine";
        source.frequency.value = f * ratio;
        partial.gain.value = level;
        source.connect(partial);
        partial.connect(filter);
        source.start(e.at);
        source.stop(e.at + e.duration + 1.25);
        oscillators.push(source);
        this.sources.add(source);
        source.onended = () => {
          source.disconnect();
          partial.disconnect();
          this.sources.delete(source);
          if (oscillators.every((s) => !this.sources.has(s))) {
            gain.disconnect();
            filter.disconnect();
          }
        };
      }
      this.scheduled++;
    }
  }
  silence() {
    this.overworld.pause();
    this.creative.pause();
    this.fade(0, 0.12);
  }
  fade(target, seconds) {
    const gain = this.output.gain,
      now = this.context.currentTime;
    // Replace pending automation and reach exact silence, including when a menu
    // opens during the fade-in. An asymptotic fade never actually reaches zero.
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else {
      const value = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(value, now);
    }
    gain.linearRampToValueAtTime(target, now + seconds);
    this.lastGain = target;
  }
}
