// Original, deterministic vocal models. No recordings or Minecraft audio.
// Each species has its own articulation, pitch contour and resonant mouth shape.
export const ANIMAL_CALLS = Object.freeze({
  cow: {
    call: "moo",
    pitch: 92,
    seconds: 1.14,
    mouth: [510, 1050],
    breath: 0.08,
  },
  woolling: {
    call: "bleat",
    pitch: 240,
    seconds: 0.84,
    mouth: [730, 1620],
    breath: 0.12,
  },
  grazer: {
    call: "oink",
    pitch: 145,
    seconds: 0.58,
    mouth: [620, 1250],
    breath: 0.22,
  },
  chicken: {
    call: "cluck",
    pitch: 560,
    seconds: 0.62,
    mouth: [1100, 2300],
    breath: 0.12,
  },
  rabbit: {
    call: "squeak",
    pitch: 1480,
    seconds: 0.24,
    mouth: [1800, 3100],
    breath: 0.06,
  },
  panda: {
    call: "grunt",
    pitch: 115,
    seconds: 0.67,
    mouth: [410, 890],
    breath: 0.32,
  },
  koala: {
    call: "bellow",
    pitch: 58,
    seconds: 1.18,
    mouth: [340, 690],
    breath: 0.38,
  },
  tiger: {
    call: "roar",
    pitch: 62,
    seconds: 1.24,
    mouth: [470, 1100],
    breath: 0.26,
  },
  snow_leopard: {
    call: "chuff",
    pitch: 142,
    seconds: 0.56,
    mouth: [650, 1650],
    breath: 0.65,
  },
  polar_bear: {
    call: "growl",
    pitch: 48,
    seconds: 1.02,
    mouth: [310, 790],
    breath: 0.34,
  },
  ash_deer: {
    call: "bark",
    pitch: 245,
    seconds: 0.51,
    mouth: [900, 1650],
    breath: 0.28,
  },
  skeleton_horse: {
    call: "whinny",
    pitch: 420,
    seconds: 1.28,
    mouth: [1200, 2450],
    breath: 0.22,
  },
  dolphin: {
    call: "chirp",
    pitch: 1900,
    seconds: 0.6,
    mouth: [2500, 3900],
    breath: 0.01,
  },
  turtle: {
    call: "exhale",
    pitch: 105,
    seconds: 0.42,
    mouth: [400, 950],
    breath: 0.75,
  },
  cod: {
    call: "bubble",
    pitch: 310,
    seconds: 0.18,
    mouth: [670, 1340],
    breath: 0.3,
  },
  salmon: {
    call: "bubble",
    pitch: 225,
    seconds: 0.24,
    mouth: [450, 980],
    breath: 0.38,
  },
  tropical_fish: {
    call: "bubble",
    pitch: 570,
    seconds: 0.16,
    mouth: [1100, 1960],
    breath: 0.2,
  },
  pufferfish: {
    call: "puff",
    pitch: 180,
    seconds: 0.38,
    mouth: [800, 1700],
    breath: 0.85,
  },
  squid: {
    call: "squelch",
    pitch: 78,
    seconds: 0.52,
    mouth: [280, 640],
    breath: 0.52,
  },
  cinder_roc: {
    call: "screech",
    pitch: 930,
    seconds: 0.92,
    mouth: [1800, 2900],
    breath: 0.28,
  },
});
const TAU = Math.PI * 2;
const harmonicFalloff = Array.from({ length: 25 }, (_, n) =>
  n ? 1 / n ** 1.15 : 0,
);
const pulse = (p, count, sharpness = 1) => {
  const local = (p * count) % 1;
  return Math.sin(Math.PI * local) ** sharpness;
};
export function animalVoiceSamples(type, rate, variant = 0, kind = "idle") {
  const def = ANIMAL_CALLS[type];
  if (!def) return null;
  const duration =
    def.seconds *
    (1 + variant * 0.035) *
    (kind === "hurt"
      ? 0.58
      : kind === "death"
        ? 1.22
        : kind === "attack"
          ? 0.82
          : 1);
  const data = new Float32Array(Math.ceil(duration * rate));
  let seed = 0x71bf + variant * 7919;
  for (const ch of type) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  let phase = 0,
    low = 0,
    chest = 0;
  const weights = new Float64Array(25);
  const lowAlpha = 1 - Math.exp((-TAU * 950) / rate),
    chestAlpha = 1 - Math.exp((-TAU * 190) / rate);
  for (let i = 0; i < data.length; i++) {
    const t = i / rate,
      p = i / (data.length - 1),
      call = def.call;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = (seed >>> 0) / 2147483648 - 1;
    low += lowAlpha * (noise - low);
    chest += chestAlpha * (noise - chest);
    let contour = 1 + 0.2 * Math.sin(Math.PI * p) - 0.23 * p,
      articulation = 1;
    if (call === "moo") contour = 1 + 0.24 * Math.sin(Math.PI * p) - 0.3 * p;
    if (call === "bleat") {
      contour += 0.085 * Math.sin(t * 48);
      articulation = 0.72 + 0.28 * Math.sin(t * 48);
    }
    if (call === "oink") {
      contour = 1.15 - 0.4 * ((p * 2) % 1);
      articulation = pulse(p, 2, 1.8);
    }
    if (call === "cluck") {
      contour = 1.5 - 0.8 * ((p * 4) % 1);
      articulation = pulse(p, 4, 3);
    }
    if (call === "squeak") {
      contour = 1 + 0.4 * Math.sin(p * Math.PI);
      articulation = pulse(p, 2, 0.8);
    }
    if (call === "grunt") {
      contour = 0.9 + 0.1 * Math.sin(t * 35);
      articulation = pulse(p, 3, 1.4);
    }
    if (call === "bellow") {
      contour = 0.85 + 0.15 * Math.sin(t * 24);
      articulation = 0.7 + 0.3 * pulse(p, 3);
    }
    if (call === "chuff") articulation = pulse(p, 2, 2);
    if (call === "bark") {
      contour = 1.5 - 0.65 * p;
      articulation = pulse(p, 2, 2);
    }
    if (call === "whinny") {
      contour =
        p < 0.3 ? 0.75 + p * 2 : 1.45 - p * 0.55 + 0.16 * Math.sin(t * 49);
      articulation = p < 0.3 ? 1 : 0.4 + 0.6 * pulse((p - 0.3) / 0.7, 7);
    }
    if (call === "chirp") {
      contour = 0.6 + 0.85 * ((p * 3) % 1);
      articulation = pulse(p, 3, 1.5);
    }
    if (call === "bubble" || call === "squelch") {
      contour = 1.4 - ((p * 3) % 1);
      articulation = pulse(p, 3, 2);
    }
    if (call === "puff") articulation = pulse(p, 1, 0.8);
    if (call === "screech") contour = 1.4 - 0.5 * p + 0.08 * Math.sin(t * 85);
    const eventPitch =
      kind === "hurt"
        ? 1.28
        : kind === "death"
          ? 1.05 - 0.5 * p
          : kind === "attack"
            ? 1.1
            : 1;
    const f =
      def.pitch *
      contour *
      eventPitch *
      (1 + variant * 0.025) *
      (1 + 0.012 * Math.sin(t * 137) + 0.006 * noise);
    phase += (TAU * f) / rate;
    const vowel =
      call === "moo" ? 1.2 - 0.65 * p : 1 + 0.12 * Math.sin(Math.PI * p);
    let voice = 0;
    const harmonics =
      call === "chirp" || call === "squeak"
        ? 3
        : Math.min(24, Math.floor((rate * 0.43) / f));
    // Mouth filters change slowly: update at control rate. Harmonic recurrence
    // avoids dozens of trig/exp calls per sample on the gameplay thread.
    if ((i & 63) === 0)
      for (let n = 1; n <= 24; n++) {
        const frequency = f * n;
        const mouth =
          Math.exp(-(((frequency - def.mouth[0] * vowel) / 220) ** 2)) +
          0.55 * Math.exp(-(((frequency - def.mouth[1] * vowel) / 380) ** 2));
        weights[n] = (0.12 + mouth) * harmonicFalloff[n];
      }
    let previous = 0,
      current = Math.sin(phase),
      twiceCos = 2 * Math.cos(phase);
    for (let n = 1; n <= harmonics; n++) {
      voice += current * weights[n];
      const next = twiceCos * current - previous;
      previous = current;
      current = next;
    }
    let value = voice * (1 - def.breath) + low * def.breath * 1.4;
    if (["roar", "growl", "bellow"].includes(call))
      value =
        (voice * 0.85 + chest * 0.75) *
        (0.75 + 0.25 * Math.sin(t * (call === "roar" ? 71 : 39)));
    if (call === "chirp")
      value = Math.sin(phase + Math.sin(phase * 0.5) * 0.18) * 0.3;
    if (call === "chuff" || call === "exhale" || call === "puff")
      value = (noise - low) * 0.2 + low * 0.7 + voice * 0.1;
    const envelope =
      Math.max(0, Math.min(1, t / 0.016, (duration - t) / 0.04)) *
      Math.sin(Math.PI * p) ** 0.45 *
      articulation;
    data[i] = Math.tanh(value * 3) * 0.6 * envelope;
  }
  return data;
}
