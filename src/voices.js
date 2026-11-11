// Original vocal synthesis: harmonic/formant bodies, breath, irregular pulse
// envelopes and pitch motion. No recordings or copied game audio.
export const VOICE_PROFILES = {
  cod: [320, 0.2, 1400, 0.7],
  salmon: [280, 0.25, 1200, 0.65],
  tropical_fish: [490, 0.19, 1800, 0.6],
  pufferfish: [180, 0.35, 900, 0.65],
  squid: [80, 0.6, 450, 0.7],
  dolphin: [1100, 0.55, 2600, 0.12],
  turtle: [130, 0.45, 620, 0.55],
  drowned: [63, 0.95, 430, 0.65],
  husk: [72, 0.8, 490, 0.5],
  stray: [89, 0.4, 1600, 0.8],
  skeleton_horse: [160, 0.7, 900, 0.3],
  snow_leopard: [142, 0.62, 980, 0.31],
  polar_bear: [56, 1.05, 420, 0.22],
  ember_ray: [311, 1.45, 2250, 0.72],
  cinder_roc: [91, 1.2, 1350, 0.43],
  watcher: [103, 1.65, 940, 0.67],
  zombie: [67, 0.82, 510, 0.47],
  creeper: [152, 0.48, 2300, 0.96],
  spider: [235, 0.32, 2700, 0.72],
  skeleton: [83, 0.28, 1800, 0.78],
  panda: [112, 0.72, 640, 0.24],
  koala: [175, 0.48, 780, 0.4],
  tiger: [64, 0.9, 620, 0.33],
  ash_deer: [260, 0.65, 1080, 0.18],
  cinderback: [52, 0.75, 330, 0.32],
  basalt_crawler: [76, 0.45, 1700, 0.6],
  cinder_wraith: [173, 0.9, 1850, 0.5],
  devin_guardian: [58, 0.85, 590, 0.14],
  dread_knight: [41, 1.1, 370, 0.35],
  soul_reaver: [210, 1.25, 1750, 0.68],
  mad_titan: [33, 1.35, 290, 0.54],
  magma_maw: [63, 0.72, 800, 0.48],
  iron_golem: [48, 0.58, 340, 0.08],
  cow: [86, 0.82, 480, 0.15],
  woolling: [205, 0.6, 1050, 0.28],
  grazer: [123, 0.36, 650, 0.55],
  chicken: [410, 0.48, 1550, 0.12],
  rabbit: [890, 0.22, 2500, 0.3],
  villager: [124, 0.44, 840, 0.22],
  shade: [59, 0.65, 470, 0.4],
  stalker: [90, 0.53, 1300, 0.7],
  emberling: [132, 0.6, 2100, 0.6],
};
// Species use distinct articulations, not the same oscillator at a new pitch.
const families = {
  cod: "bubble",
  salmon: "bubble",
  tropical_fish: "bubble",
  pufferfish: "hiss",
  squid: "bubble",
  dolphin: "whistle",
  turtle: "snort",
  drowned: "groan",
  husk: "groan",
  stray: "bone",
  skeleton_horse: "whistle",
  snow_leopard: "snort",
  polar_bear: "growl",
  ember_ray: "spectral",
  cinder_roc: "growl",
  cow: "moo",
  woolling: "bleat",
  grazer: "snort",
  chicken: "cluck",
  rabbit: "sniff",
  panda: "snort",
  koala: "chatter",
  tiger: "growl",
  villager: "murmur",
  iron_golem: "metal",
  zombie: "groan",
  creeper: "hiss",
  skeleton: "bone",
  spider: "chitter",
  watcher: "laugh",
  ash_deer: "whistle",
  cinderback: "boulder",
  basalt_crawler: "ratchet",
  cinder_wraith: "spectral",
  devin_guardian: "choir",
  dread_knight: "forge",
  soul_reaver: "spectral",
  mad_titan: "titan",
  magma_maw: "bubble",
  emberling: "ember",
  shade: "groan",
  stalker: "chitter",
};
export function voiceSamples(type, rate, variant = 0, kind = "idle") {
  const profile = VOICE_PROFILES[type] || VOICE_PROFILES.zombie;
  const [pitch, base, formant, breath] = profile,
    family = families[type];
  const duration =
    base *
    (kind === "death"
      ? 1.35
      : kind === "attack"
        ? 0.72
        : kind === "hurt"
          ? 0.5
          : 1);
  const data = new Float32Array(Math.ceil(rate * duration));
  let state = 7177 + variant * 291 + Math.floor(pitch),
    phase = 0,
    low = 0,
    slow = 0;
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      p = t / duration;
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    const noise = (state >>> 0) / 2147483648 - 1;
    low += (1 - Math.exp((-2 * Math.PI * 850) / rate)) * (noise - low);
    slow += (1 - Math.exp((-2 * Math.PI * 120) / rate)) * (noise - slow);
    let f =
      pitch *
      (1 + variant * 0.021) *
      (kind === "hurt"
        ? 1.5
        : kind === "attack"
          ? 0.86
          : kind === "death"
            ? 1 - p * 0.6
            : 1);
    const vowel = Math.sin(Math.PI * p),
      jitter = 1 + 0.018 * Math.sin(t * 91 + variant);
    f *= jitter * (1 + 0.12 * vowel - 0.15 * p);
    if (family === "bleat") f *= 1 + 0.09 * Math.sin(t * 43);
    if (family === "cluck") f *= 1 + 0.3 * Math.sin(p * Math.PI * 6);
    if (family === "whistle") f *= 1 + 0.45 * vowel;
    if (family === "murmur")
      f *= 1 + 0.17 * Math.sin(p * Math.PI * 5 + variant);
    phase += (2 * Math.PI * f) / rate;
    let voice = 0;
    for (let n = 1; n <= 7; n++) {
      const band = Math.exp(
        -(((n * f - formant * (0.65 + 0.6 * vowel)) / 330) ** 2),
      );
      voice +=
        (Math.sin(phase * n + 0.12 * Math.sin(t * 11)) * (0.1 + band)) / n;
    }
    let value = voice * (1 - breath) + (noise - low) * breath * 0.3;
    const syllable = (count, power = 4) =>
      0.14 + 0.86 * Math.max(0, Math.sin(p * Math.PI * count)) ** power;
    if (family === "moo")
      value = (voice * 0.85 + low * 0.12) * (0.5 + 0.5 * vowel);
    if (family === "bleat")
      value = (voice * 0.8 + (noise - low) * 0.09) * syllable(5, 2);
    if (["snort", "sniff"].includes(family))
      value =
        (low * 1.3 + (noise - low) * 0.3 + voice * 0.18) *
        syllable(family === "sniff" ? 4 : 3);
    if (family === "chatter" || family === "cluck")
      value =
        (voice * 0.9 + (noise - low) * 0.12) *
        syllable(family === "cluck" ? 7 : 9);
    if (family === "growl" || family === "titan")
      value =
        (voice + slow * 1.3 + Math.sin(phase * 0.51) * 0.19) *
        (0.6 + 0.4 * Math.sin(t * 64) ** 2);
    if (family === "groan")
      value =
        (voice + low * 0.45) * (0.4 + 0.6 * Math.sin(p * Math.PI * 2.4) ** 2);
    if (family === "hiss")
      value =
        (noise - low) *
        0.7 *
        (kind === "attack" ? 0.15 + p * 0.85 : syllable(2, 2));
    if (family === "chitter")
      value =
        ((noise - low) * 0.55 + Math.sin(phase * 2.1) * 0.18) *
        syllable(11, 12);
    if (
      family === "bone" ||
      family === "ratchet" ||
      family === "metal" ||
      family === "forge"
    ) {
      value = 0;
      for (let j = 0; j < 5; j++) {
        const u = t - (j === 0 ? 0.001 : (j * duration) / 6);
        if (u >= 0)
          value +=
            (Math.sin(
              2 *
                Math.PI *
                (family === "bone" ? 780 : family === "forge" ? 170 : 350) *
                (1 + j * 0.27) *
                u,
            ) *
              0.55 +
              low * 0.4) *
            Math.exp(-u * (family === "bone" ? 85 : 32));
      }
    }
    if (family === "bubble")
      value =
        (Math.sin(phase * (1 + Math.sin(t * 27) * 0.35)) * 0.6 + low * 0.8) *
        syllable(6, 2);
    if (family === "boulder")
      value = slow * 2 + Math.sin(phase) * 0.25 + Math.sin(phase * 1.49) * 0.15;
    if (family === "whistle" || family === "ember")
      value =
        Math.sin(phase) * 0.5 +
        Math.sin(phase * 2.01) * 0.13 +
        (noise - low) * (family === "ember" ? 0.3 : 0.05);
    if (family === "spectral" || family === "choir")
      value =
        (voice * 0.7 +
          Math.sin(phase * 1.498) * 0.15 +
          Math.sin(phase * 2.007) * 0.13 +
          (noise - low) * 0.28) *
        (family === "spectral" ? 0.1 + p : 1);
    if (family === "laugh")
      value = (voice * 0.9 + (noise - low) * 0.12) * syllable(9, 3);
    if (family === "murmur")
      value = voice * syllable(3 + variant, 2) + low * 0.08;
    const envelope =
      Math.min(1, t / 0.012, (duration - t) / 0.055) *
      Math.sin(Math.PI * p) ** 0.5;
    data[i] = Math.tanh(value * 2.4) * envelope * 0.65;
  }
  return data;
}
export function createVoiceBank(context) {
  const bank = {},
    rate = Math.min(22050, context.sampleRate);
  for (const type of Object.keys(VOICE_PROFILES))
    for (const kind of ["idle", "hurt", "attack", "death"]) {
      const key = kind === "idle" ? type : `${type}:${kind}`;
      Object.defineProperty(bank, key, {
        enumerable: true,
        get() {
          const buffers = Array.from({ length: 3 }, (_, v) => {
            const samples = voiceSamples(type, rate, v, kind),
              buffer = context.createBuffer(1, samples.length, rate);
            buffer.copyToChannel(samples, 0);
            return buffer;
          });
          Object.defineProperty(bank, key, {
            value: buffers,
            enumerable: true,
          });
          return buffers;
        },
        configurable: true,
      });
    }
  return bank;
}
