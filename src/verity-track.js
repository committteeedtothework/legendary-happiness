import { assetArrayBuffer } from "./asset-source.js";
const decoded = new WeakMap();
export function prepareVerityTrack(context, asset) {
  let ready = decoded.get(context);
  if (!ready) {
    ready = assetArrayBuffer(asset).then((bytes) =>
      context.decodeAudioData(bytes),
    );
    decoded.set(context, ready);
    ready.catch(() => decoded.delete(context));
  }
  return ready;
}
// The game's gesture-unlocked AudioContext also works for mobile encounters
// that begin long after the last tap. Pause keeps the actual playback position.
export class VerityTrack {
  constructor(context, output, buffer) {
    this.context = context;
    this.buffer = buffer;
    this.duration = buffer.duration;
    this.offset = 0;
    this.paused = true;
    this.ended = false;
    this.gain = context.createGain();
    this.gain.connect(output);
  }
  get currentTime() {
    return Math.min(
      this.duration,
      this.offset +
        (this.paused ? 0 : this.context.currentTime - this.startedAt),
    );
  }
  set currentTime(value) {
    const playing = !this.paused;
    this.pause();
    this.offset = Math.max(0, Math.min(this.duration, value || 0));
    this.ended = this.offset >= this.duration;
    if (playing) this.play();
  }
  set volume(value) {
    this.gain.gain.value = value;
  }
  get volume() {
    return this.gain.gain.value;
  }
  async play() {
    if (!this.paused || this.ended) return;
    if (this.context.state !== "running") await this.context.resume();
    if (this.disposed || !this.paused) return;
    if (this.context.state !== "running")
      throw new DOMException(
        "Tap Play Song to enable audio.",
        "NotAllowedError",
      );
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    this.source = source;
    this.startedAt = this.context.currentTime;
    this.paused = false;
    source.onended = () => {
      source.disconnect();
      if (this.source === source) {
        this.offset = this.duration;
        this.paused = true;
        this.ended = true;
        this.source = null;
      }
    };
    source.start(0, this.offset);
  }
  pause() {
    if (this.paused) return;
    this.offset = this.currentTime;
    this.paused = true;
    const source = this.source;
    this.source = null;
    source?.stop();
    source?.disconnect();
  }
  removeAttribute() {
    this.disposed = true;
    this.pause();
    this.gain.disconnect();
  }
  load() {}
}
