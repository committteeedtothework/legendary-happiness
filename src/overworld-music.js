import { OVERWORLD_TRACKS, CREATIVE_TRACKS } from "./overworld-music-data.js";

// Native media decoding keeps one full-length recording active, rather than
// allocating PCM buffers for an entire soundtrack. Nothing is fetched online.
export class OverworldMusic {
  constructor(context, output, options = {}) {
    this.context = context;
    this.mode = options.mode || "survival";
    this.tracks =
      options.tracks ||
      (this.mode === "creative" ? CREATIVE_TRACKS : OVERWORLD_TRACKS);
    this.random = options.random || Math.random;
    this.createMedia = options.createMedia || (() => new Audio());
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.output.connect(output);
    this.queue = [];
    this.failed = new Set();
    this.history = [];
    this.token = 0;
    this.nextTrackAt = 0;
    this.state = "idle";
  }
  nextTrack() {
    if (!this.queue.length) {
      this.queue = this.tracks.filter((t) => !this.failed.has(t.id));
      for (let i = this.queue.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
      }
      if (this.queue.length > 1 && this.queue[0].id === this.lastTrack) {
        [this.queue[0], this.queue[1]] = [this.queue[1], this.queue[0]];
      }
    }
    return this.queue.shift();
  }
  gain(target) {
    if (target === this.lastGain) return;
    const param = this.output.gain,
      now = this.context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const value = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(value, now);
    }
    param.linearRampToValueAtTime(target, now + (target ? 0.8 : 0.12));
    this.lastGain = target;
  }
  pause() {
    this.wanted = false;
    this.token++;
    this.pending = false;
    this.media?.pause();
    this.gain(0);
    if (this.media && this.state !== "blocked") this.state = "paused";
  }
  release() {
    this.token++;
    this.pending = false;
    if (this.media) {
      this.media.onended = this.media.onerror = null;
      this.media.pause();
      this.source?.disconnect();
      this.media.removeAttribute("src");
      this.media.load();
    }
    this.media = this.source = this.currentTrack = null;
  }
  reset() {
    this.pause();
    this.release();
    this.queue = [];
    this.failed.clear();
    this.lastTrack = null;
    this.nextTrackAt = 0;
    this.blocked = false;
    this.state = "idle";
  }
  allowPlayback() {
    // Called by the normal audio-unlock gesture; never retry play every frame.
    if (this.blocked) {
      this.blocked = false;
      this.state = this.media ? "paused" : "idle";
    }
  }
  startOrResume() {
    if (this.pending || this.blocked) return;
    let media = this.media;
    try {
      if (!media) {
        const track = this.nextTrack();
        if (!track) {
          this.state = "unavailable";
          return;
        }
        this.currentTrack = track;
        media = this.media = this.createMedia();
        media.preload = "metadata";
        media.loop = false;
        media.src = track.src;
        this.source = this.context.createMediaElementSource(media);
        this.source.connect(this.output);
        media.onended = () => {
          if (this.media !== media) return;
          this.release();
          this.nextTrackAt = this.context.currentTime + 8 + this.random() * 10;
          this.state = "waiting";
        };
        media.onerror = () => this.fail(media);
      }
      this.pending = true;
      this.state = "loading";
      const token = ++this.token;
      Promise.resolve(media.play())
        .then(() => {
          if (this.media !== media || !this.wanted) {
            media.pause();
            return;
          }
          if (this.token !== token) return;
          this.pending = false;
          this.state = "playing";
          if (this.lastTrack !== this.currentTrack.id) {
            this.lastTrack = this.currentTrack.id;
            this.history.push(this.lastTrack);
            if (this.history.length > 32) this.history.shift();
          }
        })
        .catch((error) => {
          if (this.media !== media || this.token !== token) return;
          this.pending = false;
          if (error?.name === "NotAllowedError") {
            this.blocked = true;
            this.state = "blocked";
          } else this.fail(media);
        });
    } catch {
      this.fail(media);
    }
  }
  fail(media) {
    if (media && this.media !== media) return;
    if (this.currentTrack) this.failed.add(this.currentTrack.id);
    this.queue = this.queue.filter((t) => !this.failed.has(t.id));
    this.release();
    this.nextTrackAt = this.context.currentTime + 1;
    this.state = "waiting";
  }
  update(game, settings) {
    if (!game.active) {
      if (this.worldKey != null || this.media) this.reset();
      this.worldKey = null;
      return;
    }
    const worldKey = game.id ?? game.world?.seed;
    if (this.worldKey !== worldKey) {
      this.reset();
      this.worldKey = worldKey;
    }
    const enabled =
      game.mode === this.mode &&
      game.dimension === "overworld" &&
      game.running &&
      settings.musicEnabled &&
      settings.volume > 0 &&
      (settings.musicVolume ?? 0.45) > 0 &&
      this.context.state === "running" &&
      !["playing", "menu-paused"].includes(game.jukebox?.state);
    if (!enabled) {
      if (this.wanted || this.lastGain) this.pause();
      return;
    }
    this.wanted = true;
    this.gain((settings.musicVolume ?? 0.45) * 0.65);
    if (
      (!this.media || this.media.paused) &&
      this.context.currentTime >= this.nextTrackAt
    )
      this.startOrResume();
  }
}
