import { MENU_AUDIO_MP3 } from "./menu-audio-data.js";
import { assetArrayBuffer } from "./asset-source.js";

// Windows include each cue's quiet attack/tail, rather than playing the long
// silent gaps in the compilation. The original source recording stays intact.
export const MENU_CUES = [
  { offset: 0.935, duration: 0.09, gain: 0.72 },
  { offset: 2.235, duration: 0.31, gain: 2.5 },
  { offset: 4.377, duration: 0.28, gain: 0.82 },
  { offset: 6.356, duration: 0.09, gain: 1.67 },
];
// Labels supplied by the user in playback order, not inferred from the MP3 cover.
export const MENU_ROLES = { select: 0, hover: 1, exit: 2, slide: 3 };
export const menuRoleForAction = (action) =>
  [
    "back",
    "title",
    "resume",
    "close-inv",
    "quit",
    "disconnect-multiplayer",
  ].includes(action)
    ? "exit"
    : "select";
export class MenuAudio {
  constructor(context, master, settings) {
    this.context = context;
    this.settings = settings;
    this.bus = context.createGain();
    this.bus.connect(master);
    this.active = new Set();
    this.played = 0;
    this.updateVolume();
  }
  updateVolume() {
    const volume =
      this.settings.menuSounds === false
        ? 0
        : (this.settings.menuVolume ?? 0.65);
    if (this.appliedVolume !== volume) {
      this.bus.gain.setTargetAtTime(volume, this.context.currentTime, 0.012);
      this.appliedVolume = volume;
    }
    if (
      this.settings.menuSounds === false ||
      !this.settings.volume ||
      this.settings.menuVolume === 0
    )
      this.stop();
  }
  load() {
    if (!this.pending)
      this.pending = (async () => {
        try {
          this.buffer = await this.context.decodeAudioData(
            await assetArrayBuffer(MENU_AUDIO_MP3),
          );
          return this.buffer;
        } catch {
          this.failed = true;
          return null;
        }
      })();
    return this.pending;
  }
  async play(role = "select") {
    const now = this.context.currentTime;
    this.requestTimes ||= {};
    const spacing = role === "hover" ? 0.09 : role === "slide" ? 0.065 : 0.018;
    if (now - (this.requestTimes[role] ?? -Infinity) < spacing) return false;
    this.requestTimes[role] = now;
    const played = await this.playCue(MENU_ROLES[role]);
    if (played) this.lastRole = role;
    return played;
  }
  async playCue(index) {
    const cue = MENU_CUES[index];
    if (
      !cue ||
      this.settings.menuSounds === false ||
      !this.settings.volume ||
      this.settings.menuVolume === 0
    )
      return false;
    const requested = this.context.currentTime;
    const buffer = this.buffer || (await this.load());
    if (
      !buffer ||
      this.settings.menuSounds === false ||
      !this.settings.volume ||
      this.settings.menuVolume === 0 ||
      this.context.state !== "running" ||
      this.context.currentTime - requested > 0.2
    )
      return false;
    if (this.active.size >= 4) return false;
    this.updateVolume();
    const source = this.context.createBufferSource(),
      gain = this.context.createGain(),
      now = this.context.currentTime;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.bus);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(cue.gain, now + 0.002);
    gain.gain.setValueAtTime(cue.gain, now + cue.duration - 0.008);
    gain.gain.linearRampToValueAtTime(0, now + cue.duration);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start(now, cue.offset, cue.duration);
    this.played++;
    this.lastCue = index;
    return true;
  }
  stop() {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
  }
}
