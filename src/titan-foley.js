// Original layered encounter Foley, generated locally. No commercial effects.
export function titanFoleySamples(kind, rate = 24000, variant = 0) {
  const duration =
    {
      hit: 0.32,
      impact: 0.65,
      "titan-impact": 1.1,
      detonation: 2.8,
      telegraph: 1.1,
      parry: 0.75,
      counter: 1.2,
      ring: 0.6,
      emerald: 1.1,
      beam: 1.9,
      grab: 0.9,
      pulse: 1.2,
      stage: 1.5,
      dodge: 0.45,
      jump: 0.38,
      boom: 0.8,
      rush: 0.7,
      loop: 1.3,
      "qte-win": 1.1,
      windup: 0.14,
      sweep: 0.5,
    }[kind] || 0.4;
  const out = new Float32Array(Math.ceil(rate * duration));
  let seed = (kind.length * 1171 + variant * 619 + 9137) | 0,
    low = 0,
    old = 0;
  const metallic = ["parry", "counter", "ring", "emerald", "qte-win"].includes(
      kind,
    ),
    whoosh = [
      "rush",
      "dodge",
      "jump",
      "loop",
      "boom",
      "windup",
      "sweep",
    ].includes(kind);
  for (let i = 0; i < out.length; i++) {
    const t = i / rate,
      u = t / duration;
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    const noise = ((seed >>> 0) / 4294967295) * 2 - 1;
    low += 0.055 * (noise - low);
    const high = noise - old;
    old = noise;
    let value;
    if (kind === "titan-impact") {
      const body =
        Math.sin(6.28318 * (54 * t - 10 * t * t)) * 0.65 * Math.exp(-t * 6);
      const crack = high * 0.32 * Math.exp(-t * 35);
      const tail = low * 2.9 * Math.exp(-t * 3.2);
      const metal =
        (Math.sin(t * 6.28318 * 131) + Math.sin(t * 6.28318 * 197)) *
        0.08 *
        Math.exp(-t * 8);
      value = body + crack + tail + metal;
    } else if (kind === "detonation") {
      const thump =
          Math.sin(6.28318 * (48 * t - 4 * t * t)) * 0.7 * Math.exp(-t * 2.7),
        crack = high * 0.42 * Math.exp(-t * 24),
        rumble = low * 3 * Math.exp(-t * 0.95),
        metal = Math.sin(t * 6.28318 * 173) * 0.14 * Math.exp(-t * 3);
      value = thump + crack + rumble + metal;
    } else if (metallic) {
      const base = kind === "ring" ? 980 : kind === "emerald" ? 660 : 360;
      value =
        Math.sin(t * base * 6.28318) * 0.32 * Math.exp(-t * 7) +
        Math.sin(t * base * 1.503 * 6.28318) * 0.2 * Math.exp(-t * 9) +
        Math.sin(t * base * 2.117 * 6.28318) * 0.12 * Math.exp(-t * 12) +
        high * 0.12 * Math.exp(-t * 45);
      if (kind === "counter" || kind === "parry")
        value += Math.sin(t * (72 - t * 32) * 6.28318) * 0.3 * Math.exp(-t * 6);
    } else if (whoosh) {
      const shape = Math.sin(Math.PI * u) ** 1.7;
      value =
        (low * 1.9 +
          high * 0.06 +
          Math.sin(t * (130 + u * 280) * 6.28318) * 0.035) *
        shape;
    } else {
      const decay = kind === "telegraph" ? 2.2 : kind === "beam" ? 1.4 : 5;
      value =
        (Math.sin(t * (64 - 35 * u) * 6.28318) * 0.45 +
          low * 2.3 +
          high * 0.04) *
        Math.exp(-u * decay);
      if (kind === "hit") value += high * 0.2 * Math.exp(-t * 45);
    }
    const edge = Math.min(1, t / 0.006) * Math.min(1, (duration - t) / 0.045);
    out[i] = Math.tanh(value * 1.1) * edge * 0.75;
  }
  out[0] = out[out.length - 1] = 0;
  return out;
}
export class TitanFoley {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.cache = new Map();
    this.voices = new Set();
    this.gains = new Map();
    this.serial = 0;
  }
  play(kind, strength = 1, when = this.context.currentTime) {
    if (
      ![
        "hit",
        "impact",
        "titan-impact",
        "detonation",
        "telegraph",
        "parry",
        "counter",
        "ring",
        "emerald",
        "beam",
        "grab",
        "pulse",
        "stage",
        "dodge",
        "jump",
        "boom",
        "rush",
        "loop",
        "qte-win",
        "windup",
        "sweep",
      ].includes(kind)
    )
      return false;
    if (this.voices.size >= 12) {
      const first = this.voices.values().next().value;
      try {
        first.stop();
      } catch {}
      this.voices.delete(first);
      this.gains.get(first)?.disconnect();
      this.gains.delete(first);
    }
    const variant = this.serial++ % 3,
      key = kind + variant;
    let buffer = this.cache.get(key);
    if (!buffer) {
      const data = titanFoleySamples(kind, this.context.sampleRate, variant);
      buffer = this.context.createBuffer(
        1,
        data.length,
        this.context.sampleRate,
      );
      buffer.getChannelData(0).set(data);
      this.cache.set(key, buffer);
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = ["beam", "stage", "pulse"].includes(kind)
      ? 0.38
      : kind === "ring"
        ? 0.22
        : 0.5;
    gain.gain.value *= Math.max(0.55, Math.min(1.25, strength));
    if (source.playbackRate)
      source.playbackRate.value = 1.05 - Math.min(1, strength) * 0.12;
    source.connect(gain);
    gain.connect(this.output);
    this.voices.add(source);
    this.gains.set(source, gain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(source);
      this.gains.delete(source);
    };
    source.start(Math.max(this.context.currentTime, when));
    return true;
  }
  stop() {
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
      this.gains.get(source)?.disconnect();
    }
    this.voices.clear();
    this.gains.clear();
  }
  dispose() {
    this.stop();
    this.cache.clear();
  }
}
