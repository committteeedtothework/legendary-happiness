import { OverworldMusic } from "./overworld-music.js";
import { TITAN_PRELUDE } from "./titan-prelude-data.js";
export class TitanPrelude {
  constructor(context, output, options = {}) {
    this.player = new OverworldMusic(context, output, {
      ...options,
      mode: "titan",
      tracks: [TITAN_PRELUDE],
    });
  }
  snapshot(s) {
    if (
      s &&
      this.player.media &&
      (this.player.media.readyState === undefined ||
        this.player.media.readyState > 0) &&
      Number.isFinite(this.player.media.currentTime)
    )
      s.preludeMusic = { offset: this.player.media.currentTime };
  }
  update(s, playing, settings) {
    const pre = ["intro", "traversal", "transform"].includes(s.stage);
    if (pre && this.session === s) this.snapshot(s);
    const saved = s.preludeMusic?.offset;
    this.session = s;
    this.player.update(
      {
        active: pre,
        id: s.id,
        mode: "titan",
        dimension: "overworld",
        running: playing,
      },
      {
        ...settings,
        musicEnabled:
          settings.musicEnabled !== false && s.config.music && s.config.audio,
      },
    );
    if (this.player.media) {
      const media = this.player.media;
      media.loop = true;
      if (media !== this.media) {
        this.media = media;
        const seek = () => {
          if (this.player.media !== media) return;
          if (
            Number.isFinite(saved) &&
            saved >= 0 &&
            saved < (media.duration || 245.22)
          ) {
            try {
              media.currentTime = saved;
            } catch {}
          }
        };
        if (media.readyState === undefined || media.readyState > 0) seek();
        else media.addEventListener("loadedmetadata", seek, { once: true });
      }
    } else this.media = null;
  }
  allowPlayback() {
    this.player.allowPlayback();
  }
  dispose() {
    this.player.reset();
    this.player.output.disconnect();
  }
}
