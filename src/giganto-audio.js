import { TitanBoostAudio } from "./titan-boost.js";
import { arenaAudioSettings } from "./titan-settings.js";
import { MenuAudio } from "./menu-audio.js";
import { TitanPrelude } from "./titan-prelude.js";
import { TitanFoley } from "./titan-foley.js";
// Supplied battle recording; original synthesized traversal score and effects.
import { TitanScore } from "./giganto-score.js";
import { titanScorePlan, titanScoreCues } from "./giganto-score-timeline.js";
import { TitanMusicLibrary } from "./titan-music-library.js";
export class TitanAudio {
  constructor(game) {
    this.game = game;
    this.notes = 0;
    this.beat = 0;
    this.next = 0;
    this.tones = new Set();
    this.seen = new Set();
    this.lastEffects = new Map();
    this.musicLibrary = new TitanMusicLibrary();
  }
  settings(s = this.game.giganto?.session) {
    const settings = arenaAudioSettings(
      s?.config || this.game.giganto?.record.config || {},
      this.game.settings,
    );
    if (s?.returnPortal?.crossed)
      settings.volume *= Math.max(0, 1 - s.returnPortal.fade / 0.45);
    return settings;
  }
  route(s) {
    const a = this.game.audio,
      ctx = a.context;
    if (!ctx?.createGain || !a.master) return;
    if (!this.master) {
      this.master = ctx.createGain();
      this.master.connect(a.compressor || a.master);
      this.bus = ctx.createGain();
      this.bus.connect(this.master);
      // Only the arena bypasses the world's master. Neither settings object is
      // overwritten; unrelated loops cannot bleed into the fight.
      if (a.compressor) {
        a.master.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
        this.worldMuted = true;
      }
    }
    const set = (node, value) =>
      node.gain.setTargetAtTime
        ? node.gain.setTargetAtTime(value, ctx.currentTime, 0.015)
        : (node.gain.value = value);
    set(this.master, s.config.audio ? this.settings(s).volume : 0);
    set(this.bus, s.config.audio ? (s.config.effectsVolume ?? 0.75) : 0);
  }
  stopEffects() {
    this.foley?.stop();
    for (const v of this.tones) {
      try {
        v.o.stop();
      } catch {}
      v.o.disconnect();
      v.v.disconnect();
    }
    this.tones.clear();
  }
  pause(s) {
    this.playing = false;
    this.stopEffects();
    this.boost?.update(s, false, this.settings(s));
    this.prelude?.update(s, false, this.settings(s));
    this.score?.update(s, false, this.settings(s));
  }
  prepareMenu(s) {
    const a = this.game.audio;
    if (!a.context?.decodeAudioData || !this.master) return;
    this.menuSettings ||= {};
    Object.assign(this.menuSettings, {
      volume: s.config.audio ? this.settings(s).volume : 0,
      menuVolume: (s.config.effectsVolume ?? 0.75) * 0.65,
      menuSounds: s.config.audio,
    });
    if (!this.menuAudio) {
      this.menuAudio = new MenuAudio(a.context, this.master, this.menuSettings);
      this.menuAudio.buffer = a.menuAudio?.buffer;
      if (!this.menuAudio.buffer) this.menuAudio.load();
    }
    this.menuAudio.updateVolume();
  }
  menu(role) {
    const s = this.game.giganto?.session;
    if (!s) return;
    this.route(s);
    this.prepareMenu(s);
    this.menuAudio?.play(role);
  }
  tone(frequency, duration = 0.2, type = "sine", volume = 0.1, delay = 0) {
    const a = this.game.audio;
    if (!a.context || !a.master || !this.game.giganto?.record.config.audio)
      return;
    const ctx = a.context;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.connect(this.master || a.master);
    }
    const o = ctx.createOscillator(),
      v = ctx.createGain(),
      t = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(frequency, t);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(24, frequency * 0.72),
      t + duration,
    );
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(v);
    v.connect(this.bus);
    this.notes++;
    const voice = { o, v };
    this.tones.add(voice);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      this.notes = Math.max(0, this.notes - 1);
      o.disconnect();
      v.disconnect();
      this.tones.delete(voice);
    };
  }
  event(e) {
    const a = this.game.audio;
    const s = this.game.giganto?.session;
    if (this.playing === false) return;
    if (e.eventId) {
      if (this.seen.has(e.eventId)) return;
      this.seen.add(e.eventId);
      if (this.seen.size > 256)
        this.seen.delete(this.seen.values().next().value);
    }
    if (
      s &&
      Number.isFinite(e.at) &&
      s.time - e.at > 0.12 &&
      !["hit", "impact", "stage"].includes(e.type)
    )
      return;
    if (["stage", "retry", "cinematic-skip"].includes(e.type)) {
      const aftermath = e.type === "stage" && e.stage === "victory";
      if (!aftermath) this.stopEffects();
      this.lastEffects.clear();
      // The same simulation event that changes the pose selects the score cue.
      // No wall-clock timers or delayed callbacks decide the musical section.
      if (s && this.playing === true) this.frame(s, true);
      if (aftermath) return;
    }
    if (s) this.route(s);
    if (
      ["cinematic-cue", "transformation-cue"].includes(e.type) &&
      (e.age || 0) > 0.2
    )
      return;
    let sound = e.type;
    if (
      e.type === "attack-start" &&
      ["stomp", "spin", "cyclone"].includes(e.kind)
    )
      sound = "rush";
    if (sound === "grass-cyloop") sound = "loop";
    if (sound === "transformation-cue")
      sound = {
        collect: "emerald",
        orbit: "ring",
        spiral: "windup",
        absorb: "pulse",
        super: "counter",
        launch: "rush",
      }[e.cue];
    if (sound === "boss-guard" || sound === "block") sound = "parry";
    if (sound === "struggle") sound = "windup";
    if (sound === "grab-throw") sound = "impact";
    if (sound === "cinematic-cue")
      sound = {
        charge: "telegraph",
        launch: "rush",
        contact: "counter",
        rupture: "impact",
        detonate: "detonation",
      }[e.cue];
    if (e.type === "hit" && e.kind === "struggle") sound = "counter";
    if (sound === "armor-step" || sound === "armor-grip") sound = "windup";
    if (sound === "footstep") sound = "impact";
    if (sound === "homing") sound = "rush";
    if (sound === "cross" || sound === "shot") sound = "boom";
    if (e.type === "shot" && (e.age || 0) > 0.15) return;
    if (sound === "stomp") sound = "impact";
    if (e.type === "impact" || e.type === "stomp" || e.type === "grab-throw")
      sound = "titan-impact";
    if (
      sound === "attack-start" &&
      ["basic", "combo", "heavy", "finisher"].includes(e.kind)
    )
      sound = "windup";
    if (sound === "boss-followup") sound = "sweep";
    if (sound === "boss-release")
      sound = ["beam", "crunch"].includes(e.move)
        ? e.move === "beam"
          ? "beam"
          : "grab"
        : "sweep";
    const now = a.context?.currentTime || 0;
    if (now - (this.lastEffects.get(sound) ?? -100) < 0.025) return;
    this.lastEffects.set(sound, now);
    if (
      a.context?.createBuffer &&
      a.master &&
      this.game.giganto?.record.config.audio
    ) {
      if (!this.bus) {
        this.bus = a.context.createGain();
        this.bus.connect(this.master || a.master);
      }
      this.foley ||= new TitanFoley(a.context, this.bus);
      if (
        this.foley.play(
          sound,
          e.type === "shot" || e.type === "struggle"
            ? 0.3
            : e.type.startsWith("armor-")
              ? 0.3
              : e.type === "hit"
                ? 0.65 + Math.min(0.55, (e.amount || 0) / 700)
                : Math.min(1.3, e.strength || 1),
        )
      )
        return;
    }
    const type = e.type;
    if (type === "pulse") this.tone(110, 0.5, "triangle", 0.065);
    if (type === "hit" || type === "impact") {
      this.tone(95, 0.17, "triangle", 0.17);
      this.tone(330, 0.12, "square", 0.025);
    } else if (type === "telegraph") {
      this.tone(75, 0.5, "sawtooth", 0.06);
      this.tone(155, 0.3, "triangle", 0.07, 0.2);
    } else if (["parry", "counter", "qte-win"].includes(type)) {
      [440, 660, 880].forEach((f, n) =>
        this.tone(f, 0.25, "triangle", 0.065, n * 0.06),
      );
    } else if (type === "emerald" || type === "ring") {
      [660, 880, 1320].forEach((f, n) =>
        this.tone(f, 0.3, "sine", 0.05, n * 0.08),
      );
    } else if (type === "beam") {
      this.tone(90, 0.8, "sawtooth", 0.08);
      this.tone(180, 0.65, "triangle", 0.05);
    } else if (
      ["rush", "loop", "boom", "dodge", "jump", "shot"].includes(type)
    ) {
      this.tone(type === "jump" ? 420 : 220, 0.22, "triangle", 0.065);
    } else if (type === "stage") {
      this.tone(110, 0.6, "triangle", 0.1);
      this.tone(165, 0.6, "sine", 0.06, 0.15);
    }
  }
  prepare(s) {
    const a = this.game.audio,
      settings = this.settings(s),
      cues = titanScoreCues(s.config.scoreCues),
      key = JSON.stringify([s.config.battleTrack?.id || "supplied", cues]);
    if (this.score && this.scoreKey !== key) {
      this.score.dispose();
      this.score = null;
      s.battleMusic = null;
    }
    if (
      !this.score &&
      a.context &&
      a.master &&
      s.config.audio &&
      s.config.music &&
      settings.musicEnabled !== false &&
      settings.volume > 0 &&
      (settings.musicVolume ?? 0.45) > 0
    ) {
      this.scoreKey = key;
      const track = s.config.battleTrack;
      const ready = this.importedBuffer;
      this.importedBuffer = null;
      this.score = new TitanScore(a.context, this.master || a.master, {
        cues,
        trackId: track?.id || "supplied",
        ...(track
          ? {
              decode: () =>
                ready?.id === track.id
                  ? Promise.resolve(ready.buffer)
                  : this.musicLibrary.decode(track, a.context),
            }
          : {}),
      });
      this.score.prepare();
    }
    return this.score;
  }
  syncBoost(s,playing) {this.boost?.update(s,playing,this.settings(s));}
  frame(s, playing) {
    const a = this.game.audio;
    a.updateVolume();
    const settings = this.settings(s);
    if (this.lastSession !== s || this.lastAttempt !== (s.attempt || 0)) {
      this.stopEffects();
      this.seen.clear();
      this.lastEffects.clear();
      this.lastSession = s;
      this.lastAttempt = s.attempt || 0;
    }
    this.route(s);
    this.prepareMenu(s);
    if (!playing && this.playing !== false) this.stopEffects();
    this.playing = playing;
    if (
      a.context?.decodeAudioData &&
      a.context?.createBufferSource &&
      a.master
    ) {
      if (!this.bus) {
        this.bus = a.context.createGain();
        this.bus.connect(this.master || a.master);
      }
      this.boost ||= new TitanBoostAudio(a.context, this.bus);
      this.boost.prepare();
      this.boost.update(s, playing, settings);
    }
    if (a.context?.createMediaElementSource && a.master) {
      this.prelude ||= new TitanPrelude(a.context, this.master || a.master);
      this.prelude.update(s, playing, settings);
    }
    this.prepare(s)?.update(s, playing, settings);
    if (this.score?.failed && !this.score.warned) {
      this.score.warned = true;
      this.game.ui?.toast(
        this.score.error || "Battle music could not load.",
        5000,
      );
    }
    if (this.bus)
      this.bus.gain.setTargetAtTime(
        playing && s.config.audio ? (s.config.effectsVolume ?? 0.75) : 0,
        a.context.currentTime,
        0.04,
      );
    if (
      s.stage === "victory" ||
      this.prelude ||
      titanScorePlan(s) ||
      !playing ||
      !s.config.audio ||
      !s.config.music ||
      settings.musicEnabled === false ||
      settings.musicVolume <= 0 ||
      !a.context
    )
      return;
    const now = a.context.currentTime;
    if (now < this.next) return;
    this.next = now + 0.23;
    const roots = [82.41, 73.42, 98, 65.41],
      base = roots[Math.floor(this.beat / 16) % 4];
    this.tone(base * (this.beat % 4 === 3 ? 2 : 1), 0.21, "sawtooth", 0.026);
    if (this.beat % 2 === 0) this.tone(48, 0.12, "sine", 0.11);
    if (this.beat % 4 === 2) this.tone(180, 0.06, "triangle", 0.035);
    if (this.beat % 4 === 0) {
      const melody = [4, 3, 2, 3, 5, 4, 2, 1][Math.floor(this.beat / 4) % 8];
      this.tone(base * melody, 0.35, "triangle", 0.025);
    }
    this.beat++;
  }
  silence() {
    this.stopEffects();
    this.seen.clear();
    this.lastEffects.clear();
    if (this.menuSettings) this.menuSettings.volume = 0;
    this.menuAudio?.stop();
    this.menuAudio?.bus.disconnect();
    this.menuAudio = null;
    this.boost?.dispose();
    this.boost = null;
    this.prelude?.dispose();
    this.prelude = null;
    this.foley?.dispose();
    this.foley = null;
    this.score?.dispose();
    this.score = null;
    this.importedBuffer = null;
    this.scoreKey = null;
    if (this.bus)
      this.bus.gain.setTargetAtTime(
        0,
        this.game.audio.context.currentTime,
        0.03,
      );
    if (this.worldMuted) {
      const a = this.game.audio;
      a.master.gain.setTargetAtTime(
        this.game.settings.volume,
        a.context.currentTime,
        0.025,
      );
      this.worldMuted = false;
    }
    const bus = this.bus,
      master = this.master;
    this.bus = null;
    this.master = null;
    // A teardown fade only; encounter timing always uses the audio clock.
    if (bus || master)
      setTimeout(() => {
        bus?.disconnect();
        master?.disconnect();
      }, 60);
    this.playing = false;
    this.lastSession = null;
    this.notes = 0;
  }
  dispose() {
    this.silence();
  }
}
