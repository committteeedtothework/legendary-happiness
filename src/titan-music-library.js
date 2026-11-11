import { LocalMusicLibrary, validateMP3 } from "./local-music.js";
import { titanScoreLength } from "./giganto-score-timeline.js";

// Read native metadata before allocating full PCM. This timeout guards failed
// file I/O only; it never schedules an encounter or musical transition.
async function probeDuration(file) {
  if (typeof Audio !== "function") return null;
  return new Promise((resolve, reject) => {
    const media = new Audio(),
      url = URL.createObjectURL(file);
    const done = (error) => {
      const duration = media.duration;
      clearTimeout(timer);
      media.onloadedmetadata = media.onerror = null;
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(url);
      error ? reject(error) : resolve(duration);
    };
    const timer = setTimeout(
      () => done(Error("Could not read this MP3.")),
      15000,
    );
    media.preload = "metadata";
    media.onloadedmetadata = () => done();
    media.onerror = () => done(Error("Could not read this MP3."));
    media.src = url;
  });
}

// Reuse local Blob storage, with arena-specific IDs. Backups carry only an ID;
// importing a world elsewhere must not silently substitute a different track.
export class TitanMusicLibrary {
  constructor(library = new LocalMusicLibrary()) {
    this.library = library;
  }
  async import(file, context, cues) {
    const info = validateMP3(file);
    if (info.size > 16 * 1024 * 1024)
      throw Error("Choose an MP3 up to 16 MiB.");
    const duration = await probeDuration(file);
    if (duration !== null && (!Number.isFinite(duration) || duration > 900))
      throw Error("Choose a track no longer than 15 minutes.");
    const bytes = await file.arrayBuffer();
    const buffer = await context.decodeAudioData(bytes);
    if (!Number.isFinite(buffer.duration) || buffer.duration > 900)
      throw Error("Choose a track no longer than 15 minutes.");
    if (buffer.duration < titanScoreLength(cues))
      throw Error("Track is shorter than the cue map. Adjust cue times first.");
    const id = "titan:" + crypto.randomUUID();
    await this.library.put(id, file);
    return {
      track: { id, name: info.name, duration: buffer.duration },
      buffer,
      persistent: this.library.persistent,
    };
  }
  async decode(track, context) {
    const record = await this.library.get(track.id);
    if (!record?.blob)
      throw Error(
        "Local battle track is missing. Choose the file again or use the supplied track.",
      );
    return context.decodeAudioData(await record.blob.arrayBuffer());
  }
}
