import {
  positionMix,
  distanceGain,
  tornadoInfluence,
  soundListenerGame,
} from "./spatial-audio.js";
import { MATTHEW_CLAIM_MP3 } from "./matthew-claim-audio-data.js";
import { MenuAudio } from "./menu-audio.js";
import { ClaimFanfare } from "./claim-audio.js";
import { createEffectBank, EFFECT_PROFILES } from "./effects-audio.js";
import { caveRegionAt } from "./cave-update.js";
import { createPistolBank } from "./pistol-audio.js";
import { isWater, isLava } from "./block-dynamics.js";
import { MusicEngine } from "./music.js";
import { weatherAt } from "./weather.js";
import { createVoiceBank } from "./voices.js";
import { B } from "./data.js";
import { Soundscape } from "./soundscape.js";
import { createFoleyBank, surfaceFamily } from "./foley.js";
// Original procedural Foley: filtered noise, short resonant impacts, and
// harmonic envelopes. Supplied menu/weapon-claim recordings have separate notices.
export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.played = 0;
    this.active = 0;
  }
  unlock() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!this.context) {
        this.context = new Context();
        this.master = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -16;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.005;
        this.compressor.release.value = 0.15;
        this.master.connect(this.compressor);
        this.compressor.connect(this.context.destination);
        this.menuAudio = new MenuAudio(
          this.context,
          this.master,
          this.settings,
        );
        this.bank = {
          ...createFoleyBank(this.context),
          ...createPistolBank(this.context),
        };
        this.voices = createVoiceBank(this.context);
        this.effects = createEffectBank(this.context);
        this.soundscape = new Soundscape(this.context, this.master);
        this.music = new MusicEngine(this.context, this.master);
        this.claimFanfare = new ClaimFanfare(this.context, this.master);
        this.pistolClaimFanfare = new ClaimFanfare(
          this.context,
          this.master,
          MATTHEW_CLAIM_MP3,
        );

        this.noise = this.context.createBuffer(
          1,
          this.context.sampleRate * 3,
          this.context.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      this.updateVolume();
      this.context.resume()?.catch(() => {});
      this.music?.overworld?.allowPlayback();
      this.music?.creative?.allowPlayback();
    } catch {
      /* Audio availability must never prevent a menu or world from opening. */
    }
  }
  updateVolume() {
    if (this.master && this.appliedMasterVolume !== this.settings.volume) {
      this.master.gain.setTargetAtTime(
        this.settings.volume,
        this.context.currentTime,
        0.025,
      );
      this.appliedMasterVolume = this.settings.volume;
    }
    this.menuAudio?.updateVolume();
  }
  async menu(role = "select") {
    if (
      !this.context ||
      !this.settings.volume ||
      this.settings.menuSounds === false ||
      this.settings.menuVolume === 0
    )
      return false;
    this.updateVolume();
    const played = await this.menuAudio?.play(role);
    if (played) this.played++;
    else if (this.menuAudio?.failed && role !== "hover")
      this.sample("ui", 0.18 * (this.settings.menuVolume ?? 0.65), 1);
    return !!played;
  }
  async devinClaim() {
    if (!this.context || !this.settings.volume) return false;
    this.updateVolume();
    const played = await this.claimFanfare?.play(
      () => this.settings.volume > 0,
    );
    if (played) this.played++;
    else if (
      this.claimFanfare?.failed &&
      this.settings.volume &&
      this.context.state === "running"
    )
      this.tone("relic");
    return !!played;
  }
  async matthewClaim() {
    if (!this.context || !this.settings.volume) return false;
    this.updateVolume();
    const played = await this.pistolClaimFanfare?.play(
      () => this.settings.volume > 0,
    );
    if (played) this.played++;
    else if (
      this.pistolClaimFanfare?.failed &&
      this.settings.volume &&
      this.context.state === "running"
    )
      this.tone("rune");
    return !!played;
  }
  note(
    frequency,
    duration,
    gain = 0.15,
    type = "sine",
    delay = 0,
    end = frequency,
  ) {
    if (!this.context || this.active > 36) return;
    const c = this.context,
      t = c.currentTime + delay,
      osc = c.createOscillator(),
      env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env);
    let spatial;
    if (this.voicePan) {
      spatial = c.createStereoPanner();
      spatial.pan.value = this.voicePan;
      env.connect(spatial);
      spatial.connect(this.master);
    } else env.connect(this.master);
    osc.start(t);
    osc.stop(t + duration);
    this.active++;
    osc.onended = () => {
      this.active--;
      osc.disconnect();
      env.disconnect();
      spatial?.disconnect();
    };
  }
  hiss(duration, frequency = 900, gain = 0.16, delay = 0, type = "lowpass") {
    if (!this.context || this.active > 36) return;
    const c = this.context,
      t = c.currentTime + delay,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      env = c.createGain();
    source.buffer = this.noise;
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(80, frequency * 0.4),
      t + duration,
    );
    filter.Q.value = 0.7;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    filter.connect(env);
    let spatial;
    if (this.voicePan) {
      spatial = c.createStereoPanner();
      spatial.pan.value = this.voicePan;
      env.connect(spatial);
      spatial.connect(this.master);
    } else env.connect(this.master);
    source.start(t, Math.random() * 0.4, Math.min(duration, 2.5));
    this.active++;
    source.onended = () => {
      this.active--;
      source.disconnect();
      filter.disconnect();
      env.disconnect();
      spatial?.disconnect();
    };
  }
  standSound(kind) {
    if (!this.context || !this.settings.volume) return;
    this.updateVolume();
    this.sample(
      `stand_${EFFECT_PROFILES[`stand_${kind}`] ? kind : "rope"}`,
      0.32,
    );
  }
  tone(type, surface = "grass") {
    if (type === "ui") return this.menu("select");
    if (!this.context || !this.settings.volume) return;
    this.updateVolume();
    this.played++;
    if (type === "pistol") {
      const finish =
        surface === "black" || surface === "silver"
          ? surface
          : (this.pistolShots = (this.pistolShots || 0) + 1) % 2
            ? "silver"
            : "black";
      this.sample(
        `pistol_${finish}`,
        0.34,
        0.992 + Math.random() * 0.016,
        0,
        finish === "black" ? -0.12 : 0.12,
      );
    } else if (["step", "land", "break", "place", "mine"].includes(type)) {
      const family = surfaceFamily(surface),
        gain = { step: 0.42, land: 0.85, break: 0.95, place: 0.6, mine: 0.28 }[
          type
        ];
      const rate =
        (type === "step" ? 1.08 : type === "land" ? 0.78 : 1) *
        (0.93 + Math.random() * 0.14);
      this.sample(
        family,
        gain,
        rate,
        0,
        type === "step"
          ? (this.foot = (this.foot || 0) + 1) % 2
            ? -0.035
            : 0.035
          : 0,
      );
      if (type === "break") this.sample(family, 0.3, rate * 1.35, 0.035);
    } else {
      if (type === "trade") this.mob("villager", 0, "idle");
      const key = EFFECT_PROFILES[type]
        ? type
        : type === "trade"
          ? "pickup"
          : "hit";
      this.sample(
        key,
        type === "ui" ? 0.24 : type === "explosion" ? 0.7 : 0.45,
        0.97 + Math.random() * 0.06,
      );
    }
  }
  withWorldPosition(game, type, source, callback) {
    if (!this.context || !this.settings.volume) return false;
    const listener = soundListenerGame(game);
    let mix = positionMix(listener.player, source, type);
    if (!mix.gain) return false;
    const d = mix.distance,
      p = listener.player;
    const occluded =
      d > 3 &&
      !!listener.world.raycast?.(
        { x: p.x, y: p.y + 1.2, z: p.z },
        {
          x: (source.x - p.x) / d,
          y: ((source.y ?? p.y) - p.y) / d,
          z: (source.z - p.z) / d,
        },
        Math.max(0, d - 0.5),
        true,
      );
    const previous = this.spatialEvent;
    this.spatialEvent = {
      game: listener,
      type,
      source,
      occluded,
      dimension: listener.dimension,
    };
    try {
      callback();
      return true;
    } finally {
      this.spatialEvent = previous;
    }
  }
  world(game, type, source, surface = "grass") {
    return this.withWorldPosition(game, type, source, () =>
      this.tone(type, surface),
    );
  }
  updatePositioned(game) {
    if (!this.context || this.context.currentTime < (this.nextPositionMix || 0))
      return;
    this.nextPositionMix = this.context.currentTime + 0.05;
    for (const record of this.positionedVoices || []) {
      const { event, volume, stereo, filter, gain, pan, cutoff } = record;
      const mix = positionMix(
        game.player,
        event.source,
        event.type,
        event.occluded,
      );
      const audible =
        game.active !== false && event.dimension === game.dimension;
      volume.gain.setTargetAtTime(
        audible ? gain * mix.gain : 0,
        this.context.currentTime,
        0.025,
      );
      stereo.pan.setTargetAtTime(
        Math.max(-1, Math.min(1, pan + mix.pan)),
        this.context.currentTime,
        0.04,
      );
      filter.frequency.setTargetAtTime(
        Math.min(cutoff, mix.cutoff),
        this.context.currentTime,
        0.04,
      );
    }
  }
  sample(family, gain = 0.5, rate = 1, delay = 0, pan = 0, cutoff = 18000) {
    if (!this.context || this.active > 44) return;
    const choices =
      this.bank?.[family] || this.effects?.[family] || this.voices?.[family];
    if (!choices) return;
    const c = this.context,
      source = c.createBufferSource(),
      volume = c.createGain(),
      stereo = c.createStereoPanner(),
      filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    source.buffer = choices[Math.floor(Math.random() * choices.length)];
    source.playbackRate.value = rate;
    const event = this.spatialEvent;
    const mix = event
      ? positionMix(event.game.player, event.source, event.type, event.occluded)
      : { gain: 1, pan: 0, cutoff: 18000 };
    volume.gain.value = gain * mix.gain;
    stereo.pan.value = Math.max(-1, Math.min(1, pan + mix.pan));
    filter.frequency.value = Math.min(cutoff, mix.cutoff);
    let positioned;
    if (event) {
      positioned = { event, volume, stereo, filter, gain, pan, cutoff };
      (this.positionedVoices ||= new Set()).add(positioned);
    }
    source.connect(filter);
    filter.connect(volume);
    volume.connect(stereo);
    stereo.connect(this.master);
    source.start(c.currentTime + delay);
    this.active++;
    source.onended = () => {
      this.active--;
      if (positioned) this.positionedVoices.delete(positioned);
      source.disconnect();
      filter.disconnect();
      volume.disconnect();
      stereo.disconnect();
    };
  }
  voice(game, entity, kind = "idle") {
    if (
      !this.context ||
      !this.settings.volume ||
      this.settings.mobSounds === false ||
      (this.settings.mobVolume ?? 0.75) <= 0
    )
      return;
    return this.withWorldPosition(game, "mob", entity, () =>
      this.mob(entity.type, 0, kind),
    );
  }
  mob(type, distance = 0, kind = "idle", pan = 0, occluded = false) {
    if (
      !this.context ||
      !this.settings.volume ||
      this.settings.mobSounds === false ||
      (this.settings.mobVolume ?? 0.75) <= 0 ||
      distance >= 16
    )
      return;
    const gain =
        distanceGain(distance, 16) *
        (this.settings.mobVolume ?? 0.75) *
        (kind === "idle" ? 0.35 : 0.5),
      pitch = 0.97 + Math.random() * 0.06;
    this.played++;
    const eventKind = ["idle", "hurt", "attack", "death"].includes(kind)
      ? kind
      : "idle";
    this.sample(
      eventKind === "idle" ? type : `${type}:${eventKind}`,
      gain * (occluded ? 0.4 : 1),
      pitch,
      0,
      pan,
      occluded ? 950 : Math.max(1800, 15000 - distance * 330),
    );
  }
  silenceAmbient() {
    this.soundscape?.silence();
  }
  ambient(game) {
    if (!this.context) return;
    this.updatePositioned(game);
    this.music?.update(game, this.settings);
    this.soundscape?.pump();
    if (
      !game.active ||
      !game.running ||
      this.settings.ambientSounds === false ||
      !this.settings.volume
    ) {
      this.silenceAmbient();
      return;
    }
    if (this.context.currentTime < (this.nextAmbienceMix || 0)) return;
    this.nextAmbienceMix = this.context.currentTime + 0.5;
    const p = game.player,
      t = game.world.terrain(p.x, p.z),
      cinder = game.dimension === "cinderwild",
      cave = p.y < t.h - 4 && game.world.skyHeight(p.x, p.z) > p.y + 1.8,
      night = game.time % 24000 >= 13000 && game.time % 24000 < 23000,
      v = this.settings.ambientVolume ?? 0.55;
    if (v <= 0) {
      this.silenceAmbient();
      return;
    }
    const weather = weatherAt(game.world, p);
    let water = 0,
      fire = 0;
    if (!cave && !cinder && p.y < t.h + 15)
      for (const [dx, dz] of [
        [0, 0],
        [3, 0],
        [-3, 0],
        [0, 3],
        [0, -3],
        [7, 0],
        [-7, 0],
        [0, 7],
        [0, -7],
      ]) {
        const x = Math.floor(p.x + dx),
          z = Math.floor(p.z + dz),
          ground = game.world.terrain(x, z).h;
        if (
          Math.abs(p.y - 62) < 12 &&
          ground < 62 &&
          isWater(game.world.get(x, 61, z))
        )
          water = Math.max(water, 1 - Math.hypot(dx, dz) / 12);
        if (
          isLava(game.world.get(x, Math.floor(p.y), z)) ||
          game.world.get(x, Math.floor(p.y), z) === B.fire
        )
          fire = Math.max(fire, 1 - Math.hypot(dx, dz) / 12);
      }
    for (const [pos, container] of Object.entries(game.world.containers))
      if (container.burn > 0) {
        const [x, y, z] = pos.split(",").map(Number);
        fire = Math.max(
          fire,
          Math.max(0, 1 - Math.hypot(p.x - x, p.y - y, p.z - z) / 9),
        );
      }
    const wooded = [
        "woodland",
        "birch_woodland",
        "pine_forest",
        "snowy_taiga",
        "marsh",
        "jungle",
      ].includes(t.biome),
      dry = ["desert", "badlands", "savanna"].includes(t.biome),
      high = ["alpine", "stony_peaks"].includes(t.biome),
      hush = weather.exposed ? 1 : 0.18;
    const palm = game.renderer?.standVisuals?.trialFade || 0;
    const f = weather.funnel;
    // Match the visible wind column without loading chunks at a remote funnel.
    const column =
      f && Math.hypot(f.x - p.x, f.z - p.z) < 96
        ? {
            ...f,
            y: Math.max(62, game.world.terrain(f.x, f.z).h) + 1,
            height: 58,
          }
        : null;
    const funnel = tornadoInfluence(p, column) * weather.intensity * hush;
    this.soundscape?.mix(
      {
        wind:
          v *
          (funnel * 0.48 +
            (cinder ? 0.1 : cave ? 0.05 : high ? 0.55 : dry ? 0.32 : 0.22)),
        leaves:
          v *
          (wooded && !cave && !cinder
            ? ["pine_forest", "snowy_taiga"].includes(t.biome)
              ? 0.09
              : 0.18
            : 0),
        water: v * (p.inWater ? 0.5 : water * 0.42),
        night:
          v *
          (night && !cave && !cinder
            ? t.biome === "marsh"
              ? 0.4
              : dry
                ? 0.11
                : 0.25
            : 0),
        cave: v * (cave && !cinder ? 0.42 : 0),
        eerie: v * (night && !cave && !cinder ? 0.22 : 0),
        caveTone: cave
          ? {
              hollow_halls: 72,
              dripstone_vault: 133,
              moss_grotto: 98,
              rift_cavern: 49,
            }[caveRegionAt(game.world, p)] || 72
          : 0,
        rumble: v * (funnel * 0.65 + (cinder ? 0.45 : cave ? 0.13 : 0)),
        fire: v * (cinder ? 0.15 : fire * 0.25),
        rain: v * weather.rain * hush * 0.75,
        hail: v * (weather.hail || 0) * hush * 0.5,
        insectBase: t.biome === "marsh" ? 650 : 3500,
        insectSpread: t.biome === "marsh" ? 650 : 2800,
        ...(palm > 0
          ? {
              wind: v * (0.4 + palm * 0.4),
              eerie: v * palm * 0.5,
              rumble: v * palm * 0.25,
              night: 0,
              leaves: 0,
            }
          : {}),
      },
      p.underwater,
    );
    if (
      weather.strike &&
      weather.strike.tick !== this.lastThunderTick &&
      game.world.tick - weather.strike.tick < 20
    ) {
      this.lastThunderTick = weather.strike.tick;
      const d = Math.hypot(weather.strike.x - p.x, weather.strike.z - p.z),
        delay = d / 340;
      this.withWorldPosition(game, "thunder", weather.strike, () =>
        this.sample(
          "thunder",
          0.65 * v * hush,
          0.92 + Math.random() * 0.12,
          delay,
        ),
      );
    }
    if (
      game.elapsed >= (this.nextBird || 0) &&
      !night &&
      !cave &&
      !cinder &&
      !p.underwater
    ) {
      this.nextBird = game.elapsed + 7 + Math.random() * (dry ? 28 : 18);
      if (!weather.storm && weather.rain < 0.5) {
        this.sample(
          "bird",
          0.12 * v * (weather.exposed ? 1 : 0.25),
          wooded ? 1.05 : dry ? 0.78 : 0.92,
          0,
          Math.random() * 1.4 - 0.7,
        );
      }
    }
  }
}
