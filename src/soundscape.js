// A stateful original stereo soundscape. Each sample advances persistent noise,
// filters and irregular wildlife envelopes. No short recording is looped.
export class AmbientDSP {
  constructor(seed = 4919, rate = 48000) {
    this.state = seed | 0;
    this.rate = rate;
    this.frame = 0;
    this.low = [0, 0];
    this.water = [0, 0];
    this.deep = [0, 0];
    this.levels = {};
    this.targets = {};
    this.gust = 0.5;
    this.gustTarget = 0.5;
    this.chirp = 0;
    this.chirpWait = rate * 0.12;
    this.chirpPhase = 0;
    this.chirpFreq = 4300;
    this.caveWait = rate * 9;
    this.caveAge = 100;
    this.caveKind = 0;
    this.cavePhase = 0;
    this.dreadPhase = 0;
  }
  random() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) | 0;
    return (this.state >>> 0) / 4294967296;
  }
  set(levels) {
    this.targets = { ...levels };
  }
  render(left, right) {
    const names = [
      "wind",
      "water",
      "night",
      "rumble",
      "leaves",
      "fire",
      "lava",
      "rain",
      "hail",
      "cave",
      "eerie",
    ];
    const smoothing = 1 - Math.exp(-1 / (this.rate * 0.65));
    const outputs = [left, right];
    for (let i = 0; i < left.length; i++) {
      if ((this.frame++ & 4095) === 0)
        this.gustTarget = 0.3 + this.random() * 0.7;
      this.gust += (this.gustTarget - this.gust) * 0.000015;
      if (--this.chirpWait <= 0) {
        this.chirp = 0.045 + this.random() * 0.12;
        this.chirpWait = this.rate * (0.08 + this.random() * 1.5);
        this.chirpFreq =
          (this.targets.insectBase || 3500) +
          this.random() * (this.targets.insectSpread || 2800);
      }
      this.chirp = Math.max(0, this.chirp - 1 / this.rate);
      this.chirpPhase += (this.chirpFreq * 6.28318530718) / this.rate;
      const insect =
        Math.sin(this.chirpPhase) * Math.min(1, this.chirp * 100) * 0.12;
      for (const name of names)
        this.levels[name] =
          (this.levels[name] || 0) +
          ((this.targets[name] || 0) - (this.levels[name] || 0)) * smoothing;
      if (--this.caveWait <= 0) {
        this.caveWait = this.rate * (8 + this.random() * 21);
        this.caveAge = 0;
        this.caveKind = Math.floor(this.random() * 3);
      }
      this.caveAge += 1 / this.rate;
      const age = this.caveAge;
      this.cavePhase +=
        (((this.targets.caveTone || 80) +
          Math.sin((this.frame / this.rate) * 0.16) * 3) *
          Math.PI *
          2) /
        this.rate;
      this.dreadPhase += (Math.PI * 2 * 54.7) / this.rate;
      const drip =
        (Math.sin(age * 4200) * Math.exp(-age * 25) +
          Math.sin((age - 0.19) * 3900) *
            Math.exp(-Math.max(0, age - 0.19) * 20) *
            (age > 0.19 ? 0.35 : 0)) *
        (age < 0.6 ? 1 : 0);
      const creak =
        Math.sin(age * 195 + Math.sin(age * 17) * 4) *
        Math.sin(Math.min(1, age / 2.2) * Math.PI) *
        Math.exp(-age * 1.5) *
        (age < 2.2 ? 1 : 0);
      const event =
        this.caveKind === 0
          ? drip
          : this.caveKind === 1
            ? creak
            : Math.sin(age * 230) * Math.exp(-age * 4) * Math.min(1, age * 20);
      for (let c = 0; c < 2; c++) {
        const noise = this.random() * 2 - 1;
        this.low[c] += 0.017 * (noise - this.low[c]);
        this.water[c] += 0.24 * (noise - this.water[c]);
        this.deep[c] += 0.002 * (noise - this.deep[c]);
        const crack = Math.abs(noise) > 0.997 ? noise * 0.4 : 0;
        const v =
          this.levels.wind * this.low[c] * this.gust * 2.5 +
          this.levels.water *
            (this.water[c] * (0.5 + this.gust * 0.4) + noise * 0.09) +
          this.levels.night * insect * (c ? 0.84 : 1) +
          this.levels.rumble * this.deep[c] * 3 +
          this.levels.cave *
            (event * 0.1 +
              Math.sin(this.cavePhase) * 0.018 +
              this.deep[c] * 0.45) +
          this.levels.eerie *
            (Math.sin(this.dreadPhase) * 0.025 +
              Math.sin(this.dreadPhase * 1.496) * 0.012 +
              this.deep[c] * 0.7 +
              creak * 0.025) +
          this.levels.leaves * (noise - this.water[c]) * 0.07 * this.gust +
          this.levels.fire * (this.low[c] * 0.6 + crack) +
          (this.levels.lava||0)*(this.deep[c]*2+this.low[c]*.16+Math.sin(this.frame/this.rate*7+this.low[c]*10)*.018) +
          this.levels.rain * (noise * 0.1 + this.water[c] * 0.2) +
          this.levels.hail *
            (Math.abs(noise) > 0.987 ? noise * 0.55 : this.water[c] * 0.04);
        outputs[c][i] = Math.max(-0.8, Math.min(0.8, v));
      }
    }
  }
}
export function ambienceSamples(kind, rate, duration = 4) {
  const dsp = new AmbientDSP(4919 + kind.length * 1777, rate),
    a = new Float32Array(Math.ceil(rate * duration)),
    b = new Float32Array(a.length);
  dsp.set({ [kind]: 1 });
  dsp.render(a, b);
  for (let i = 0; i < a.length; i++)
    a[i] *= Math.max(
      0,
      Math.min(1, i / (rate * 0.08), (a.length - 1 - i) / (rate * 0.08)),
    );
  return a;
}
const WORKLET = `const AmbientDSP = (${AmbientDSP.toString()});\nclass LivingWorld extends AudioWorkletProcessor { constructor(){super();this.dsp=new AmbientDSP(4919,sampleRate);this.port.onmessage=e=>this.dsp.set(e.data);} process(inputs,outputs){const o=outputs[0];this.dsp.render(o[0],o[1]||o[0]);return true;} }registerProcessor('dcsm-living-world',LivingWorld);`;
export class Soundscape {
  constructor(context, output) {
    this.context = context;
    this.layers = Object.fromEntries(
      [
        "wind",
        "water",
        "night",
        "rumble",
        "leaves",
        "fire",
      "lava",
        "rain",
        "cave",
        "eerie",
      ].map((k) => [k, { target: 0 }]),
    );
    this.targets = {};
    this.sources = new Set();
    this.mode = "scheduled";
    this.nextTime = 0;
    this.dsp = new AmbientDSP(4919, context.sampleRate);
    this.filter = context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 10000;
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.filter.connect(this.gain);
    this.gain.connect(output);
    this.setupWorklet();
  }
  async setupWorklet() {
    if (!this.context.audioWorklet || typeof AudioWorkletNode === "undefined")
      return;
    const url = URL.createObjectURL(
      new Blob([WORKLET], { type: "application/javascript" }),
    );
    try {
      await this.context.audioWorklet.addModule(url);
      this.node = new AudioWorkletNode(this.context, "dcsm-living-world", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.node.connect(this.filter);
      this.node.port.postMessage(this.targets);
      this.mode = "worklet";
      for (const { source, env } of this.sources) {
        env.gain.setTargetAtTime(0, this.context.currentTime, 0.01);
        source.stop(this.context.currentTime + 0.05);
      }
    } catch {
      /* Scheduled unique PCM segments work in restricted/local viewers. */
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  mix(targets, underwater = false) {
    const signature = JSON.stringify([targets, underwater]);
    if (signature === this.mixSignature) {
      this.pump();
      return;
    }
    this.mixSignature = signature;
    this.targets = { ...targets };
    for (const [key, layer] of Object.entries(this.layers))
      layer.target = targets[key] || 0;
    this.dsp.set(this.targets);
    this.node?.port.postMessage(this.targets);
    const audible = Object.values(targets).some((v) => v > 0);
    this.gain.gain.setTargetAtTime(
      audible ? 1 : 0,
      this.context.currentTime,
      audible ? 0.2 : 0.055,
    );
    this.filter.frequency.setTargetAtTime(
      underwater ? 500 : 10000,
      this.context.currentTime,
      0.3,
    );
    this.pump();
  }
  pump() {
    if (
      this.mode === "worklet" ||
      !Object.values(this.targets).some((v) => v > 0)
    )
      return;
    const c = this.context;
    if (this.nextTime < c.currentTime) this.nextTime = c.currentTime + 0.02;
    while (this.nextTime < c.currentTime + 0.65) {
      const length = Math.ceil(c.sampleRate * 0.75),
        buffer = c.createBuffer(2, length, c.sampleRate);
      this.dsp.render(buffer.getChannelData(0), buffer.getChannelData(1));
      const source = c.createBufferSource(),
        env = c.createGain();
      source.buffer = buffer;
      source.loop = false;
      env.gain.value = 1;
      source.connect(env);
      env.connect(this.filter);
      const record = { source, env };
      this.sources.add(record);
      source.start(this.nextTime);
      this.nextTime += length / c.sampleRate;
      source.onended = () => {
        source.disconnect();
        env.disconnect();
        this.sources.delete(record);
      };
    }
  }
  silence() {
    this.mix({});
  }
}
