import { TitanScore } from "./giganto-score.js";
import { TitanPrelude } from "./titan-prelude.js";
import { assetArrayBuffer } from "./asset-source.js";
import { WYVERN_PRELUDE, WYVERN_SCORE } from "./wyvern-music-data.js";

export const WYVERN_SCORE_CUES = Object.freeze({
  phaseOne: { start: 0, loopStart: 0, loopEnd: 103 },
  phaseTwo: { start: 104, loopStart: 104, loopEnd: 249 },
  transition: { start: 104, duration: 4 },
  finale: { start: 242, duration: 7 },
});

// Keep a stable transport session: animation/QTE stage changes within the same
// phase must not restart the song. The encounter phase event owns the seek.
export class WyvernScore extends TitanScore {
  constructor(context, output, options = {}) {
    super(context, output, {
      cues: WYVERN_SCORE_CUES,
      trackId: "titan:wyvern-battle-v1",
      decode: async () => context.decodeAudioData(await assetArrayBuffer(WYVERN_SCORE)),
      ...options,
    });
  }
  mapped(s) {
    if (this.owner !== s) {
      this.owner = s;
      this.transportSession = {};
    }
    const pre = ["intro", "traversal", "transform", "defeat"].includes(s.stage);
    return Object.assign(this.transportSession, s, {
      stage: pre ? "intro" : "combat",
      phase: s.stage === "phase" ? 2 : s.phase,
    });
  }
  update(s, playing, settings) {
    const mapped = this.mapped(s);
    super.update(mapped, playing, {
      ...settings,
      musicVolume: (settings.musicVolume ?? 0.45) *
        (s.stage === "victory" ? Math.max(0, 1 - s.stageTime / 3) : 1),
    });
    s.battleMusic = mapped.battleMusic;
  }
  snapshot(s) {
    if (!s) return;
    // TitanScore.update invokes snapshot with its already-mapped session.
    if (s === this.transportSession) return super.snapshot(s);
    const mapped = this.mapped(s);
    super.snapshot(mapped);
    s.battleMusic = mapped.battleMusic;
  }
}

export class WyvernPrelude extends TitanPrelude {
  constructor(context, output, options = {}) {
    super(context, output, options);
    this.player.tracks = [WYVERN_PRELUDE];
  }
  update(s, playing, settings) {
    if (this.owner !== s || this.attempt !== (s.attempt || 0)) {
      if (this.owner === s) s.preludeMusic = null;
      this.player.reset();
      this.media = null;
      this.owner = s;
      this.attempt = s.attempt || 0;
    }
    super.update(s, playing, settings);
  }
}
