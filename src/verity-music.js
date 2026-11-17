import { prepareVerityTrack, VerityTrack } from "./verity-track.js";
import { VERITY } from "./verity-simulation.js";
import { VERITY_AUDIO } from "./verity-audio-data.js";
import { LocalMusicLibrary } from "./local-music.js";

export const VERITY_SONG = {
  id: "lhCPiauHI-g",
  title: "Master of Humanity",
  artist: "Horror Skunx",
  url: "https://www.youtube.com/watch?v=lhCPiauHI-g",
};
let api;
function youtubeAPI() {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  return (api ||= new Promise((resolve, reject) => {
    const previous = globalThis.onYouTubeIframeAPIReady;
    const timer = setTimeout(
      () => reject(Error("YouTube is unavailable.")),
      12000,
    );
    globalThis.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(globalThis.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(Error("YouTube is unavailable."));
    };
    document.head.append(script);
  }));
}
export class VerityMusic {
  constructor(game, mount) {
    this.g = game;
    this.mount = mount;
    this.library = new LocalMusicLibrary();
    this.token = 0;
    this.state = "idle";
  }
  async begin(id, { resumeAt = 0 } = {}) {
    this.stop();
    this.id = id;
    const token = ++this.token,
      mode = this.g.settings.verityMusic || "supplied";
    this.mode = mode;
    if (mode === "off" || !this.g.settings.musicEnabled || this.volume() <= 0)
      return;
    this.state = "loading";
    try {
      if (mode === "local" || mode === "supplied") {
        const song =
          mode === "local" ? await this.library.get("lord-verity") : null;
        if (token !== this.token) return;
        if (mode === "local" && !song)
          throw Error("Choose an MP3 in Encounters.");
        const src =
          mode === "local"
            ? (this.objectURL = URL.createObjectURL(song.blob))
            : VERITY_AUDIO.src;
        const context = this.g.audio?.context;
        this.buffered = mode === "supplied" && !!context;
        let buffer;
        if (this.buffered)
          buffer = await prepareVerityTrack(context, VERITY_AUDIO);
        if (token !== this.token) return;
        const media = (this.media = this.buffered
          ? new VerityTrack(context, this.g.audio.master, buffer)
          : new Audio(src));
        media.preload = "auto";
        media.loop = mode === "local";
        this.initialSeek = Math.max(0, resumeAt);
        media.currentTime = this.buffered ? this.initialSeek : 0;
        if (this.buffered) this.initialSeek = 0;
        media.volume = this.mediaVolume();
        media.addEventListener?.(
          "loadedmetadata",
          () => {
            if (token === this.token && this.initialSeek > 0) {
              media.currentTime = Math.min(
                this.initialSeek,
                Math.max(0, media.duration - 0.01),
              );
              this.initialSeek = 0;
            }
          },
          { once: true },
        );
        if (!this.g.running || this.g.ui.screen !== "play") {
          this.state = "paused";
          this.paused = true;
          return;
        }
        await media.play();
        if (token !== this.token) {
          media.pause();
          return;
        }
        if (!this.g.running || this.g.ui.screen !== "play") {
          media.pause();
          this.state = "paused";
          this.paused = true;
        } else this.state = "playing";
      } else {
        const YT = await youtubeAPI();
        if (token !== this.token) return;
        this.mount.replaceChildren();
        const player = document.createElement("div");
        this.mount.append(player);
        this.mount.hidden = false;
        this.player = new YT.Player(player, {
          host: "https://www.youtube-nocookie.com",
          width: 320,
          height: 200,
          videoId: VERITY_SONG.id,
          playerVars: { autoplay: 1, playsinline: 1, controls: 1, rel: 0 },
          events: {
            onReady: (e) => {
              if (token !== this.token) {
                e.target.destroy();
                return;
              }
              e.target.setVolume(Math.round(this.volume() * 100));
              e.target.seekTo?.(this.age(), true);
              if (
                this.g.running &&
                this.g.ui.screen === "play" &&
                this.g.settings.musicEnabled &&
                this.volume() > 0
              )
                e.target.playVideo();
              else e.target.pauseVideo();
            },
            onStateChange: (e) => {
              if (token !== this.token) return;
              if (e.data === 1) this.focusGame();
              this.state =
                e.data === 1
                  ? "playing"
                  : e.data === 2
                    ? "paused"
                    : e.data === 0
                      ? "ended"
                      : "loading";
              if (
                !this.g.running ||
                !this.g.settings.musicEnabled ||
                this.volume() <= 0
              )
                e.target.pauseVideo();
            },
            onAutoplayBlocked: () => {
              if (token === this.token) this.state = "blocked";
            },
            onError: () => {
              if (token === this.token) {
                this.state = "error";
                this.error = "YouTube playback is unavailable.";
              }
            },
          },
        });
      }
    } catch (e) {
      if (token === this.token) {
        if (mode === "youtube") this.embed(token);
        else {
          this.state =
            this.media && e.name === "NotAllowedError" ? "blocked" : "error";
          this.error = e.message;
        }
      }
    }
  }
  embed(token) {
    // The standard visible embed also works when the optional JS API script
    // is blocked. Pause/exit removes the iframe, so it cannot keep playing.
    let frame, listener;
    const clear = () => {
      if (listener) removeEventListener("message", listener);
      listener = null;
      frame?.remove();
      frame = null;
      this.mount.replaceChildren();
    };
    const command = (func, args = []) =>
      frame?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "https://www.youtube-nocookie.com",
      );
    const start = () => {
      if (
        token !== this.token ||
        !this.g.running ||
        !this.g.settings.musicEnabled ||
        this.volume() <= 0
      )
        return;
      clear();
      frame = document.createElement("iframe");
      frame.title = "Master of Humanity — Horror Skunx";
      frame.width = "320";
      frame.height = "200";
      const age = this.g.world?.settlements?.["lord-verity"]?.active?.age || 0;
      frame.src = `https://www.youtube-nocookie.com/embed/${VERITY_SONG.id}?autoplay=1&playsinline=1&controls=1&enablejsapi=1&rel=0&start=${Math.max(0, Math.floor(age))}`;
      frame.allow = "autoplay; encrypted-media; picture-in-picture";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;
      listener = (e) => {
        if (
          token !== this.token ||
          e.origin !== "https://www.youtube-nocookie.com" ||
          e.source !== frame?.contentWindow
        )
          return;
        let m;
        try {
          m = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        } catch {
          return;
        }
        if (m?.event === "onReady") {
          command("setVolume", [Math.round(this.volume() * 100)]);
          command("playVideo");
        }
        if (m?.event === "onStateChange") {
          if (m.info === 1) this.focusGame();
          this.state =
            m.info === 1 ? "playing" : m.info === 2 ? "blocked" : "embedded";
        }
        if (m?.event === "onError") {
          this.state = "error";
          this.error = "YouTube playback is unavailable.";
        }
      };
      addEventListener("message", listener);
      this.mount.append(frame);
      this.mount.hidden = false;
      this.state = "embedded";
      const ownFrame = frame;
      frame.onload = () => {
        if (token !== this.token || frame !== ownFrame) return;
        frame.contentWindow?.postMessage(
          JSON.stringify({ event: "listening", id: "dcsmcraft-verity" }),
          "https://www.youtube-nocookie.com",
        );
        command("setVolume", [Math.round(this.volume() * 100)]);
      };
    };
    this.player = {
      playVideo: start,
      pauseVideo: () => {
        clear();
        this.state = "paused";
      },
      setVolume: (n) => command("setVolume", [n]),
      destroy: clear,
    };
    start();
  }
  volume() {
    const r = this.g.world?.settlements?.["lord-verity"]?.active;
    const fade =
      r?.phase === "bow"
        ? Math.max(
            0,
            1 - (r.age - (VERITY.arrival + VERITY.beats * VERITY.beat)) / 2.7,
          )
        : 1;
    return Math.max(
      0,
      Math.min(
        1,
        (this.g.settings.volume ?? 0.65) *
          (this.g.settings.musicVolume ?? 0.45) *
          fade,
      ),
    );
  }
  mediaVolume() {
    return this.buffered
      ? this.volume() / Math.max(0.001, this.g.settings.volume ?? 0.65)
      : this.volume();
  }
  focusGame() {
    const canvas = this.g.renderer?.gl?.domElement;
    if (canvas && this.g.running) {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
  }
  age() {
    return Math.max(
      0,
      this.g.world?.settlements?.["lord-verity"]?.active?.age || 0,
    );
  }
  seekLocal(media) {
    if (Number.isFinite(media.duration) && media.duration > 0)
      media.currentTime = this.age() % media.duration;
  }
  async play() {
    if (this.media) {
      const media = this.media,
        token = this.token;
      try {
        await media.play();
        if (token !== this.token) {
          media.pause();
          return;
        }
        if (!this.g.running) {
          media.pause();
          this.state = "paused";
        } else this.state = "playing";
      } catch {
        if (token === this.token) this.state = "blocked";
      }
    } else if (this.player) {
      this.player.seekTo?.(this.age(), true);
      this.player.playVideo?.();
    } else if (this.id) {
      api = null;
      await this.begin(this.id);
    }
  }
  update(active, running) {
    if (!active) {
      if (this.id) this.stop();
      return;
    }
    const volume = this.volume();
    if (this.media) {
      this.media.volume = this.mediaVolume();
      if (this.media.ended) this.state = "ended";
    }
    if (this.player && volume !== this.lastVolume)
      this.player.setVolume?.(Math.round(volume * 100));
    this.lastVolume = volume;
    const enabled =
      this.g.settings.musicEnabled && volume > 0 && this.mode !== "off";
    if (!running || !enabled) {
      if (!this.paused) {
        this.media?.pause();
        this.player?.pauseVideo?.();
        this.paused = true;
        if (this.media) this.state = "paused";
      }
    } else if (this.paused) {
      this.paused = false;
      this.play();
    }
  }
  stop() {
    ++this.token;
    this.id = null;
    this.media?.pause();
    if (this.media) {
      this.media.removeAttribute("src");
      this.media.load();
    }
    this.media = null;
    this.initialSeek = 0;
    this.buffered = false;
    this.player?.destroy?.();
    this.player = null;
    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = null;
    this.mount.replaceChildren();
    this.mount.hidden = true;
    this.state = "idle";
    this.error = "";
    this.paused = false;
  }
}
