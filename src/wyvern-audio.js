import { TitanAudio } from "./giganto-audio.js";
import { TitanBoostAudio } from "./titan-boost.js";
import { WyvernPrelude, WyvernScore } from "./wyvern-music.js";
export class WyvernAudio extends TitanAudio {
  prepare(s) {
    if (!s?.config.battleTrack) {
      const key = "wyvern-supplied-v1";
      if (this.score && this.scoreKey !== key) {
        this.score.dispose();
        this.score = null;
        s.battleMusic = null;
      }
      const a = this.game.audio;
      const settings = this.settings(s);
      if (!this.score && a.context?.decodeAudioData && this.master &&
          s.config.audio && s.config.music && settings.musicEnabled !== false &&
          settings.volume > 0 && settings.musicVolume > 0) {
        this.scoreKey = key;
        this.score = new WyvernScore(a.context, this.master);
        this.score.prepare();
      }
      return this.score;
    }
    return super.prepare(s);
  }
  frame(s, playing) {
    const a = this.game.audio,
      ctx = a.context,
      settings = this.settings(s);
    a.updateVolume();
    this.route(s);
    this.prepareMenu(s);
    if (ctx?.createMediaElementSource && this.master) {
      this.prelude ||= new WyvernPrelude(ctx, this.master);
      this.prelude.update(s, playing, settings);
    }
    if (this.lastSession !== s || this.lastAttempt !== (s.attempt || 0)) {
      this.stopEffects();
      this.seen.clear();
      this.lastSession = s;
      this.lastAttempt = s.attempt || 0;
      this.beat = 0;
    }
    if (!playing && this.playing !== false) {
      this.stopEffects();
    }
    this.playing = playing;
    if (ctx?.createBufferSource && this.bus) {
      this.boost ||= new TitanBoostAudio(ctx, this.bus);
      this.boost.prepare();
      this.boost.update(s, playing, settings);
    }
    if (this.bus && ctx)
      this.bus.gain.setTargetAtTime(
        playing && s.config.audio ? (s.config.effectsVolume ?? 0.75) : 0,
        ctx.currentTime,
        0.03,
      );
    // Imported overrides retain their editable cues; bundled Wyvern recordings
    // use the requested phase loops and never borrow Giganto's soundtrack.
    if (s.config.battleTrack) {
      if (this.importedOwner !== s) {
        this.importedOwner = s;
        this.importedSession = {};
      }
      const mapped = Object.assign(this.importedSession, s, {
        stage: s.stage.startsWith("wyvern-") ? "combat" : s.stage,
      });
      super.prepare(mapped)?.update(mapped, playing, settings);
      s.battleMusic = mapped.battleMusic;
      return;
    }
    this.prepare(s)?.update(s, playing, settings);
    if (this.score?.failed && !this.score.warned) {
      this.score.warned = true;
      this.game.ui?.toast("Wyvern music could not load.", 5000);
    }
  }
  event(e) {
    if (e.type === "counter-impact")
      return super.event({ ...e, type: "impact" });
    if (e.type === "wyvern-explosion")
      return super.event({ ...e, type: "cinematic-cue", cue: "detonate" });
    if (e.type === "missile") return super.event({ ...e, type: "shot" });
    super.event(e);
  }
  silence() {
    super.silence();
  }
}
