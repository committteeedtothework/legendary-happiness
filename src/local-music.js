export const MAX_MP3_BYTES = 32 * 1024 * 1024;
export function validateMP3(file) {
  if (
    !file ||
    typeof file.name !== "string" ||
    !/\.mp3$/i.test(file.name) ||
    !Number.isFinite(file.size) ||
    file.size <= 0 ||
    file.size > MAX_MP3_BYTES
  )
    throw Error("Choose an MP3 file up to 32 MiB.");
  return {
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
    size: file.size,
  };
}
// Separate from world backups: Blobs stay on this PC/browser, never in relay packets.
export class LocalMusicLibrary {
  constructor() {
    this.memory = new Map();
    this.persistent = true;
  }
  async open() {
    if (!this.opening)
      this.opening = new Promise((resolve, reject) => {
        const r = indexedDB.open("dcsmcraft-local-music", 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore("tracks", { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      }).catch(() => {
        this.persistent = false;
        return null;
      });
    return this.opening;
  }
  async get(id) {
    const db = await this.open();
    if (!db) return this.memory.get(id) || null;
    return new Promise((resolve, reject) => {
      const r = db.transaction("tracks").objectStore("tracks").get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  }
  async put(id, file) {
    const info = validateMP3(file),
      record = { id, ...info, blob: file.slice(0, file.size, "audio/mpeg") },
      db = await this.open();
    if (!db) {
      this.memory.set(id, record);
      return record;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      tx.objectStore("tracks").put(record);
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () =>
        reject(
          tx.error ||
            Error(
              "Could not store this MP3. Free browser storage and try again.",
            ),
        );
    });
    return record;
  }
}
