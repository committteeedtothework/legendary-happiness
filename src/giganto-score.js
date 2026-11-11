import { cinemaRate } from "./titan-cinema-rate.js";
import { finishingMusicGain } from "./titan-ending.js";
import { GIGANTO_SCORE } from "./giganto-score-data.js";
import { assetArrayBuffer } from "./asset-source.js";
import {
  titanScorePlan,
  scorePosition,
  TITAN_SCORE_CUES,
  titanScoreLength,
} from "./giganto-score-timeline.js";

// One lazily decoded stereo buffer per active encounter. Sources use the Web
// Audio clock (not frame timers); only two short crossfading voices may coexist.
export class TitanScore {
  constructor(context, output, options = {}) {
    this.context = context;
    this.output = output;
    this.cues = structuredClone(options.cues || TITAN_SCORE_CUES);
    this.trackId = options.trackId || "supplied";
    this.decode =
      options.decode ||
      (async () =>
        context.decodeAudioData(await assetArrayBuffer(GIGANTO_SCORE)));
    this.voices = new Set();
    this.state = "idle";
    this.starts = 0;
    this.generation = 0;
  }
  prepare() {
    if (this.disposed || this.failed) return Promise.resolve(null);
    if (!this.ready) {
      const generation = this.generation;
      this.state = "decoding";
      this.ready = Promise.resolve()
        .then(this.decode)
        .then((buffer) => {
          if (this.disposed || generation !== this.generation) return null;
          if (!buffer || buffer.duration < titanScoreLength(this.cues))
            throw Error("Giganto music is shorter than its cues");
          if (this.cues.phaseTwo.toEnd)
            this.cues.phaseTwo.loopEnd = buffer.duration;
          if (this.cues.finale.toEnd) this.cues.finale.end = buffer.duration;
          // A 2 ms taper at each loop edge avoids a PCM discontinuity/click.
          // Only this decoded playback copy changes; source MP3 bytes are retained.
          if (buffer.getChannelData)
            for (let c = 0; c < buffer.numberOfChannels; c++) {
              const data = buffer.getChannelData(c),
                n = Math.max(1, Math.round(buffer.sampleRate * 0.002));
              for (const cue of [this.cues.phaseOne, this.cues.phaseTwo]) {
                const lo = Math.round(cue.loopStart * buffer.sampleRate),
                  hi = Math.round(cue.loopEnd * buffer.sampleRate);
                for (let i = 0; i < n; i++) {
                  data[lo + i] *= i / n;
                  data[hi - 1 - i] *= i / n;
                }
              }
            }
          this.buffer = buffer;
          this.state = "ready";
          return buffer;
        })
        .catch((error) => {
          if (!this.disposed) {
            this.failed = true;
            this.state = "unavailable";
            this.error = error?.message || "Battle music could not load.";
          }
          return null;
        });
    }
    return this.ready;
  }
  gain(voice, target, duration = 0.035) {
    const p = voice.gain.gain,
      now = this.context.currentTime;
    if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(now);
    else {
      const value = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(value, now);
    }
    p.linearRampToValueAtTime(target, now + duration);
  }
  retire(voice) {
    if (!voice || voice.retired) return;
    voice.retired = true;
    this.gain(voice, 0, 0.025);
    try {
      voice.source.stop(this.context.currentTime + 0.03);
    } catch {}
    if (this.current === voice) this.current = null;
  }
  stop() {
    for (const voice of this.voices) this.retire(voice);
    this.current = null;
    if (!this.disposed && !this.failed)
      this.state = this.buffer ? "paused" : "idle";
  }
  snapshot(session) {
    if (!session) return;
    const plan = titanScorePlan(session, this.cues),
      t = this.transport;
    session.battleMusic = !plan
      ? null
      : {
          section: plan.section,
          track: this.trackId,
          offset:
            t?.section === plan.section
              ? scorePosition(
                  t,
                  this.clockRunning ? this.context.currentTime : t.when,
                )
              : plan.offset,
        };
  }
  update(session, playing, settings) {
    const plan = titanScorePlan(session, this.cues),
      now = this.context.currentTime;
    const fresh = this.session !== session,
      retried = !fresh && this.lastAttempt !== (session.attempt || 0),
      changed = this.transport?.section !== plan?.section,
      running = !!(playing && plan && this.context.state === "running");
    let reset = fresh || retried || changed;
    this.session = session;
    this.lastStage = session.stage;
    this.lastStageTime = session.stageTime;
    this.lastAttempt = session.attempt || 0;
    this.plan = plan;
    if (!plan) this.transport = null;
    else if (reset) {
      const saved = fresh ? session.battleMusic : null,
        min =
          plan.loopStart && plan.section === "phaseTwo"
            ? plan.loopStart
            : plan.section === "transition"
              ? this.cues.transition.start
              : plan.section === "finale"
                ? this.cues.finale.start
                : 0,
        max =
          plan.loopEnd ??
          plan.end ??
          (this.cues[plan.section].toEnd
            ? 900
            : this.cues[plan.section].start +
              this.cues[plan.section].duration / cinemaRate(session)),
        offset =
          saved?.section === plan.section &&
          (!saved.track
            ? this.trackId === "supplied"
            : saved.track === this.trackId) &&
          Number.isFinite(saved.offset) &&
          saved.offset >= min &&
          saved.offset <= max
            ? saved.offset
            : plan.offset;
      this.transport = { ...plan, offset, when: now };
    } else if (this.clockRunning && !running) {
      this.transport.offset = scorePosition(this.transport, now);
      this.transport.when = now;
    } else if (!this.clockRunning && running) this.transport.when = now;
    if (this.transport && plan) {
      this.transport.loopStart = plan.loopStart;
      this.transport.loopEnd = plan.loopEnd;
      this.transport.end = plan.end;
    }
    this.clockRunning = running;
    this.snapshot(session);
    const enabled =
      playing &&
      plan &&
      session.config.audio &&
      session.config.music &&
      settings.musicEnabled !== false &&
      settings.volume > 0 &&
      (settings.musicVolume ?? 0.45) > 0 &&
      this.context.state === "running" &&
      !this.disposed;
    if (!enabled) {
      this.stop();
      return;
    }
    if (!this.buffer) {
      this.prepare();
      return;
    }
    let voice = this.current;
    const offset = scorePosition(this.transport, now);
    if (!plan.loopEnd && offset >= this.buffer.duration) {
      this.stop();
      this.state = "ended";
      return;
    }
    // Within a phase the audio clock owns the song. Rendering hitches must not
    // repeatedly seek/restart it. Only phase changes/retries select fresh cues.
    const continuous = voice && !reset;
    const joined =
      voice &&
      changed &&
      !fresh &&
      !retried &&
      voice.section === "transition" &&
      plan.section === "phaseTwo" &&
      // Keep an uninterrupted pickup/chorus when a rendered frame arrives late.
      // A 25 ms equality window replayed the downbeat on ordinary 30 Hz frames.
      scorePosition(voice, now) >= this.cues.phaseTwo.start - 0.025 &&
      scorePosition(voice, now) < plan.loopEnd;
    if (continuous || joined) {
      if (joined) {
        this.transport.offset = scorePosition(voice, now);
        this.transport.when = now;
      }
      voice.section = plan.section;
      voice.loopStart = plan.loopStart;
      voice.loopEnd = plan.loopEnd;
      voice.source.loop = !!plan.loopEnd;
      if (plan.loopEnd) {
        voice.source.loopStart = plan.loopStart;
        voice.source.loopEnd = plan.loopEnd;
      }
    } else {
      // Select a new event cue or restore a frozen/persisted transport.
      for (const old of this.voices) {
        if (old !== voice && old.retired) {
          try {
            old.source.stop();
          } catch {}
          old.source.disconnect();
          old.gain.disconnect();
          this.voices.delete(old);
        }
      }
      this.retire(voice);
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      gain.gain.value = 0;
      source.buffer = this.buffer;
      source.loop = !!plan.loopEnd;
      if (plan.loopEnd) {
        source.loopStart = plan.loopStart;
        source.loopEnd = plan.loopEnd;
      }
      source.connect(gain);
      gain.connect(this.output);
      voice = {
        source,
        gain,
        when: now,
        offset,
        section: plan.section,
        loopStart: plan.loopStart,
        loopEnd: plan.loopEnd,
        end: plan.end,
      };
      this.current = voice;
      this.voices.add(voice);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        this.voices.delete(voice);
        if (this.current === voice) this.current = null;
      };
      source.start(now, offset);
      this.starts++;
    }
    const baseVolume = (settings.musicVolume ?? 0.45) * 0.6;
    const elapsed = scorePosition(voice, now) - this.cues.finale.start;
    const releaseEnd = this.buffer.duration - this.cues.finale.start;
    const param = voice.gain.gain;
    // Schedule once against the source clock. Render hitches cannot shorten the
    // musical release; pause/reload rebuild only the unplayed envelope segment.
    if (
      plan.section === "finale" &&
      param.setValueCurveAtTime &&
      param.setValueAtTime
    ) {
      if (voice.fadeBase !== baseVolume) {
        if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
        else param.cancelScheduledValues(0);
        param.setValueAtTime(
          baseVolume * finishingMusicGain(elapsed, releaseEnd),
          now,
        );
        const start = Math.max(elapsed, releaseEnd - Math.min(1.8, releaseEnd)),
          wait = Math.max(0, start - elapsed),
          duration = releaseEnd - start;
        if (duration > 0.005) {
          const curve = Float32Array.from(
            { length: 96 },
            (_, i) =>
              baseVolume *
              finishingMusicGain(start + (duration * i) / 95, releaseEnd),
          );
          if (wait > 0) param.setValueAtTime(baseVolume, now + wait);
          param.setValueCurveAtTime(curve, now + wait, duration);
        }
        voice.fadeBase = baseVolume;
      }
      voice.volume = baseVolume;
      this.snapshot(session);
      this.state = "playing";
      return;
    }
    const volume =
      baseVolume *
      (plan.section === "finale" ? finishingMusicGain(elapsed, releaseEnd) : 1);
    if (voice.volume !== volume || voice.retired) {
      this.gain(voice, volume);
      voice.volume = volume;
    }
    this.snapshot(session);
    this.state = "playing";
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    for (const voice of this.voices) {
      const disconnect = () => {
        voice.source.disconnect();
        voice.gain.disconnect();
      };
      voice.source.onended = disconnect;
      try {
        if (this.context.state === "running") {
          this.gain(voice, 0, 0.025);
          voice.source.stop(this.context.currentTime + 0.03);
        } else {
          voice.source.stop();
          disconnect();
        }
      } catch {
        disconnect();
      }
    }
    this.voices.clear();
    this.current = null;
    this.buffer = null;
    this.transport = null;
    this.ready = null;
    this.state = "disposed";
  }
}
