import { DEVIN_CLAIM_MP3 } from "./devin-claim-audio-data.js";
import { assetArrayBuffer } from "./asset-source.js";

// Prepare after audio unlock without playing. Desktop embeds the recording;
// mobile uses the same bytes from its website or verified offline cache.
export class ClaimFanfare {
  constructor(context, output, mp3 = DEVIN_CLAIM_MP3) {
    this.context = context;
    this.output = output;
    this.started = 0;
    this.source = null;
    this.pending = false;
    this.failed = false;
    this.ready = Promise.resolve()
      .then(async () => context.decodeAudioData(await assetArrayBuffer(mp3)))
      .catch(() => {
        this.failed = true;
        return null;
      });
  }
  async play(enabled = () => true) {
    if (this.pending || this.source || !enabled()) return false;
    this.pending = true;
    let source, gain;
    try {
      const buffer = await this.ready;
      if (!buffer || !enabled() || this.context.state !== "running")
        return false;
      source = this.context.createBufferSource();
      gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = false;
      gain.gain.value = 0.7;
      source.connect(gain);
      gain.connect(this.output);
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        if (this.source === source) this.source = null;
      };
      this.source = source;
      source.start();
      this.started++;
      return true;
    } catch {
      source?.disconnect();
      gain?.disconnect();
      this.source = null;
      this.failed = true;
      return false;
    } finally {
      this.pending = false;
    }
  }
}
