import { TITAN_BOOST } from "./titan-boost-data.js";
import { assetArrayBuffer } from "./asset-source.js";
export class TitanBoostAudio {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.voices = new Set();
    this.starts = 0;
    this.wanted = false;
    this.disposed = false;
  }
  prepare() {
    if (!this.pending) {
      this.pending = assetArrayBuffer(TITAN_BOOST)
        .then((bytes) => this.context.decodeAudioData(bytes))
        .then((buffer) => {
          if (this.disposed) return null;
          this.buffer = buffer;
          if (this.wanted) this.start();
          return buffer;
        })
        .catch(() => {
          this.failed = true;
          return null;
        });
    }
    return this.pending;
  }
  update(s, playing, settings) {
    this.wanted =
      !this.disposed &&
      playing &&
      s.boosting &&
      !s.knockback &&
      !s.qte &&
      !s.counterScene &&
      ["traversal", "combat"].includes(s.stage) &&
      s.config.audio &&
      settings.volume > 0;
    if (!this.wanted) {
      this.stop();
      return;
    }
    if (!this.buffer) this.prepare();
    else this.start();
  }
  start() {
    if (this.voice || !this.buffer || !this.wanted || this.disposed) return;
    if (this.voices.size >= 2) {
      const old = this.voices.values().next().value;
      try {
        old.source.stop();
      } catch {}
      old.source.disconnect();
      old.gain.disconnect();
      this.voices.delete(old);
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain(),
      t = this.context.currentTime;
    source.buffer = this.buffer;
    source.loop = true;
    source.loopStart = TITAN_BOOST.loopStart;
    source.loopEnd = Math.min(TITAN_BOOST.loopEnd, this.buffer.duration);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.42, t + 0.008);
    source.connect(gain);
    gain.connect(this.output);
    const v = { source, gain };
    this.voice = v;
    this.voices.add(v);
    this.starts++;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(v);
      if (this.voice === v) this.voice = null;
    };
    source.start(t, Math.min(0.425, Math.max(0,this.buffer.duration-0.01)));
  }
  stop(immediate = false) {
    const v = this.voice;
    if (!v) return;
    this.voice = null;
    const t = this.context.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + (immediate ? 0.001 : 0.055));
    try {
      v.source.stop(t + (immediate ? 0.002 : 0.06));
    } catch {}
  }
  dispose() {
    this.wanted = false;
    this.disposed = true;
    this.stop(true);
    for (const v of this.voices) {
      try {
        v.source.stop();
      } catch {}
      v.source.disconnect();
      v.gain.disconnect();
    }
    this.voices.clear();
    this.buffer = null;
    this.pending = null;
  }
}
