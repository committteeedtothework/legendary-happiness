// Original multi-layer PCM effects. Short contacts, resonant bodies, granular
// friction and irregular tails replace bare oscillator beeps. Cached on demand.
export const EFFECT_PROFILES = {
  ui: [0.1, 440, "wood"],
  arrow: [0.32, 260, "pluck"],
  swing: [0.23, 900, "air"],
  hit: [0.28, 86, "impact"],
  craft: [0.42, 320, "work"],
  pickup: [0.22, 960, "chime"],
  smelt: [0.55, 620, "metal"],
  eat: [0.42, 600, "crunch"],
  close: [0.28, 140, "slam"],
  open: [0.4, 180, "creak"],
  "door-open": [0.52, 170, "creak"],
  "door-close": [0.35, 125, "slam"],
  bucket: [0.6, 250, "water"],
  swim: [0.52, 210, "water"],
  fizz: [0.8, 2900, "fire"],
  ignite: [0.45, 1800, "spark"],
  fuse: [0.32, 3200, "fire"],
  explosion: [1.9, 44, "blast"],
  "guardian-impact": [1.3, 68, "blast"],
  thunder: [3.2, 35, "blast"],
  "guardian-charge": [1.1, 130, "charge"],
  rune: [0.8, 190, "charge"],
  seeker: [0.6, 430, "magic"],
  portal: [2.3, 90, "rift"],
  enchant: [1.1, 400, "magic"],
  relic: [1.7, 330, "magic"],
  pulse: [0.9, 78, "charge"],
  equip: [0.26, 230, "cloth"],
  growl: [0.9, 61, "growl"],
  dawn: [1.0, 1700, "bird"],
  dusk: [1.4, 180, "magic"],
  bird: [0.8, 1900, "bird"],
  trickster: [0.38, 720, "air"],
  incursion: [2.3, 38, "rift"],
  stand_presence: [1.2, 65, "rift"],
  stand_whisper: [1, 125, "whisper"],
  stand_wind: [0.9, 260, "air"],
  stand_awaken: [2.2, 165, "magic"],
  stand_reject: [1.4, 38, "rift"],
  stand_tremor: [0.9, 41, "blast"],
  stand_nail: [0.25, 650, "pluck"],
  stand_heal: [0.9, 420, "magic"],
  stand_rift: [0.8, 140, "rift"],
  stand_roar: [0.8, 74, "growl"],
  stand_neutral: [0.8, 240, "magic"],
  stand_rope: [0.36, 180, "cloth"],
};
export function effectSamples(key, rate, variant = 0) {
  const [duration, pitch, kind] = EFFECT_PROFILES[key] || EFFECT_PROFILES.hit;
  const data = new Float32Array(Math.ceil(duration * rate));
  let state =
      key
        .split("")
        .reduce((s, c) => (Math.imul(s, 31) + c.charCodeAt(0)) | 0, 37) +
      variant * 871,
    lo = 0,
    mid = 0,
    slow = 0,
    phase = 0;
  const smooth = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / rate),
    a = smooth(450),
    b = smooth(2200),
    c = smooth(80);
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      p = t / duration;
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const noise = (state >>> 0) / 2147483648 - 1;
    lo += a * (noise - lo);
    mid += b * (noise - mid);
    slow += c * (noise - slow);
    const f = pitch * (1 + variant * 0.018);
    phase += (2 * Math.PI * f * (1 + 0.05 * Math.sin(t * 19))) / rate;
    const contact = (at, decay = 40) =>
      t >= at ? Math.exp(-(t - at) * decay) : 0;
    let value = 0;
    if (kind === "wood" || kind === "slam" || kind === "work") {
      const e =
        contact(0.006, kind === "wood" ? 65 : 32) +
        contact(duration * 0.45, 60) * 0.4;
      value =
        (Math.sin(phase) * 0.22 +
          Math.sin(phase * 2.37) * 0.09 +
          (noise - mid) * 0.15 +
          lo * 0.35) *
        e;
      if (kind === "work") value += (noise - mid) * contact(0.15, 38) * 0.15;
    } else if (kind === "metal" || kind === "chime" || kind === "magic") {
      const chords = kind === "magic" ? [1, 1.25, 1.5, 2] : [1, 2.76, 4.12];
      for (let j = 0; j < chords.length; j++) {
        const at = 0.01 + j * (kind === "magic" ? 0.105 : 0.007),
          u = Math.max(0, t - at);
        value +=
          (Math.sin(2 * Math.PI * f * chords[j] * u) *
            contact(at, kind === "magic" ? 3 : 12) *
            (1 - Math.exp(-u * 70)) *
            0.16) /
          (1 + j * 0.5);
      }
      value += (noise - mid) * Math.sin(Math.PI * p) ** 2 * 0.025;
    } else if (kind === "creak") {
      value =
        (Math.sin(phase * (1 + p * 0.3)) + Math.sin(phase * 2.1) * 0.3) *
        Math.sin(Math.PI * p) ** 2 *
        0.14;
      value +=
        (lo * 0.5 + (noise - mid) * 0.15) *
        (contact(0.01, 35) + contact(duration * 0.8, 70));
    } else if (kind === "air" || kind === "cloth" || kind === "whisper") {
      value =
        (kind === "cloth" ? lo : mid - lo) *
        Math.sin(Math.PI * p) ** (kind === "whisper" ? 1 : 2) *
        0.65;
      value += Math.sin(phase) * Math.sin(Math.PI * p) * 0.025;
    } else if (kind === "water") {
      value = (mid * 0.35 + lo * 0.5) * Math.sin(Math.PI * p) ** 0.7;
      for (let j = 0; j < 5; j++) {
        const at = (j * duration) / 6,
          u = t - at;
        if (u >= 0)
          value +=
            Math.sin(
              (2 * Math.PI * f * (1 + j * 0.3) * Math.log(1 + u * 24)) / 24,
            ) *
            contact(at, 30) *
            0.2;
      }
    } else if (kind === "crunch" || kind === "spark" || kind === "fire") {
      const pulses =
        0.2 +
        0.8 *
          Math.max(
            0,
            Math.sin(t * (kind === "crunch" ? 65 : 113) + Math.sin(t * 37) * 2),
          ) **
            12;
      value = (noise - mid + lo * 0.4) * pulses * Math.exp(-p * 3) * 0.6;
    } else if (kind === "pluck") {
      value =
        (Math.sin(phase * (1 - p * 0.3)) * 0.35 + Math.sin(phase * 3) * 0.12) *
          Math.exp(-p * 7) +
        (noise - mid) * Math.exp(-p * 20) * 0.4;
    } else if (kind === "blast" || kind === "impact") {
      value = (lo * 1.3 + slow * 1.5 + (noise - mid) * 0.2) * Math.exp(-p * 4);
      value +=
        Math.sin(2 * Math.PI * (f * t - (0.3 * f * t * t) / duration)) *
        Math.exp(-p * 8) *
        0.35;
      if (kind === "blast")
        value +=
          lo *
          (contact(duration * 0.18, 5) + contact(duration * 0.43, 8)) *
          0.45;
    } else if (kind === "bird") {
      const syllable = Math.max(0, Math.sin(p * Math.PI * (3 + variant))) ** 3;
      value =
        (Math.sin(phase + Math.sin(p * 19) * 2) +
          Math.sin(phase * 2.02) * 0.15) *
        syllable *
        0.3;
    } else {
      const swell = Math.sin(Math.PI * p) ** 0.65;
      value =
        (lo * 0.5 +
          slow * 0.7 +
          Math.sin(phase * (1 + 0.23 * Math.sin(p * 5))) * 0.22 +
          Math.sin(phase * 1.498) * 0.12) *
        swell;
      if (kind === "growl") value *= 0.4 + 0.6 * Math.sin(t * 44) ** 2;
      if (kind === "charge")
        value += Math.sin(phase * (1 + p)) * p * (1 - p) * 0.5;
    }
    const fade = Math.min(1, t / 0.003, (duration - t) / 0.03);
    data[i] = Math.tanh(value * 1.8) * fade * 0.8;
  }
  return data;
}
export function createEffectBank(context) {
  const bank = {},
    rate = Math.min(22050, context.sampleRate);
  for (const key of Object.keys(EFFECT_PROFILES))
    Object.defineProperty(bank, key, {
      enumerable: true,
      configurable: true,
      get() {
        const buffers = Array.from({ length: 3 }, (_, v) => {
          const d = effectSamples(key, rate, v),
            b = context.createBuffer(1, d.length, rate);
          b.copyToChannel(d, 0);
          return b;
        });
        Object.defineProperty(bank, key, { value: buffers, enumerable: true });
        return buffers;
      },
    });
  return bank;
}
