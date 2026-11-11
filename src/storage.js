const DB = "dcsmcraft-worlds",
  STORE = "worlds";
export const FALLBACK_KEY = "dcsmcraft-worlds-fallback-v1";
export function checksum(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
export function pack(data) {
  const payload = JSON.stringify(data);
  if (typeof payload !== "string")
    throw new Error("Save data is not serializable");
  return { payload, checksum: checksum(payload) };
}
export function unpack(record) {
  if (
    !record ||
    typeof record.payload !== "string" ||
    checksum(record.payload) !== record.checksum
  )
    throw new Error("Save integrity check failed");
  return JSON.parse(record.payload);
}
const message = (error) => error?.message || String(error);
function validGeneration(record) {
  for (const generation of [record?.current, record?.backup]) {
    try {
      if (generation) {
        unpack(generation);
        return generation;
      }
    } catch {
      /* Try the recovery generation. */
    }
  }
  return null;
}
function nextRecord(data, current, old) {
  return {
    id: data.id,
    name: data.name,
    seed: data.seed,
    mode: data.mode,
    day: Math.floor(data.time / 24000) + 1,
    updated: Date.now(),
    current,
    backup: validGeneration(old),
  };
}
function fallbackRecords() {
  const records = JSON.parse(localStorage.getItem(FALLBACK_KEY) || "{}");
  if (!records || typeof records !== "object" || Array.isArray(records))
    throw new Error("Invalid fallback saves; export before clearing storage");
  return records;
}

export class SaveStore {
  constructor() {
    // Durable records and unsaved session records must never share a cache:
    // failed writes must not rotate the durable recovery generation.
    this.records = {};
    this.sessionRecords = new Map();
    this.outcomes = new Map();
    this.pending = Promise.resolve();
  }
  get temporary() {
    return !!this.fallbackBlocked || this.sessionRecords.size > 0;
  }
  queue(operation) {
    const pending = this.pending.then(operation);
    this.pending = pending.catch(() => {});
    return pending;
  }
  outcome(id) {
    return this.outcomes.get(id);
  }
  warnings() {
    return [...this.outcomes.values()].filter((o) => o.status !== "durable");
  }
  notify(result) {
    // A UI observer must never turn a committed write into a reported failure.
    try {
      this.onStatus?.(result);
    } catch (error) {
      console.error("Save status display failed", error);
    }
  }
  report(record, status, backend, error) {
    const result = {
      status,
      backend,
      id: record.id,
      name: record.name,
      updated: record.updated,
    };
    if (error) result.error = message(error);
    this.outcomes.set(record.id, result);
    this.notify(result);
    return result;
  }
  async open() {
    if (this.db) return this.db;
    if (this.fallback) return null;
    if (!this.opening) {
      this.opening = new Promise((resolve, reject) => {
        const r = indexedDB.open(DB, 1);
        r.onupgradeneeded = () =>
          r.result.createObjectStore(STORE, { keyPath: "id" });
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.onblocked = () =>
          reject(new Error("World database is blocked by another tab"));
      })
        .then((db) => {
          this.db = db;
          db.onversionchange = () => {
            db.close();
            this.db = null;
            this.opening = null;
          };
          return db;
        })
        .catch((error) => {
          this.fallback = true;
          this.openError = message(error);
          try {
            this.records = fallbackRecords();
          } catch (e) {
            // Preserve unreadable/corrupt durable data. Never replace it with an
            // empty object merely because this document could not read it.
            this.fallbackBlocked = message(e);
          }
          return null;
        });
    }
    return this.opening;
  }
  async readDurable(id) {
    const db = await this.open();
    if (!db) return this.records[id];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE),
        r = tx.objectStore(STORE).get(id);
      let record;
      r.onsuccess = () => {
        record = r.result;
      };
      tx.oncomplete = () => {
        if (record) this.records[id] = record;
        resolve(record);
      };
      tx.onerror = () => reject(tx.error || new Error("Could not read world"));
      tx.onabort = () =>
        reject(tx.error || new Error("World read interrupted"));
    });
  }
  list() {
    return this.queue(async () => {
      const db = await this.open();
      let records;
      try {
        records = !db
          ? Object.values(this.records)
          : await new Promise((resolve, reject) => {
              const tx = db.transaction(STORE),
                r = tx.objectStore(STORE).getAll();
              r.onsuccess = () => {
                records = r.result;
              };
              tx.oncomplete = () => resolve(records);
              tx.onerror = () =>
                reject(tx.error || new Error("Could not list worlds"));
              tx.onabort = () =>
                reject(tx.error || new Error("World list interrupted"));
            });
      } catch (error) {
        if (!this.sessionRecords.size) throw error;
        records = Object.values(this.records);
      }
      const merged = new Map(records.map((record) => [record.id, record]));
      for (const [id, record] of this.sessionRecords) merged.set(id, record);
      return [...merged.values()]
        .map(({ id, name, seed, mode, updated, day }) => ({
          id,
          name,
          seed,
          mode,
          updated,
          day,
          durability: this.sessionRecords.has(id) ? "session-only" : "durable",
        }))
        .sort((a, b) => b.updated - a.updated);
    });
  }
  load(id) {
    return this.queue(async () => {
      const session = this.sessionRecords.get(id);
      const record = session || (await this.readDurable(id));
      if (!record) throw new Error("World does not exist");
      let data,
        recovered = false;
      try {
        data = unpack(record.current);
      } catch {
        if (!record.backup)
          throw new Error(
            "Both save generations failed validation. Export your browser data before clearing storage.",
          );
        data = unpack(record.backup);
        recovered = true;
      }
      const outcome = session
        ? this.outcome(id)
        : this.report(
            record,
            "durable",
            this.db ? "indexeddb" : "localstorage",
          );
      return { data, recovered, outcome };
    });
  }
  save(data) {
    // Capture on invocation, not after waiting for another write. Later mutations
    // by simulation/containers cannot change a queued save or its metadata.
    let current, snapshot;
    try {
      current = pack(data);
      snapshot = unpack(current);
      if (typeof snapshot.id !== "string" || !snapshot.id)
        throw new Error("Save requires a world ID");
    } catch (error) {
      return this.queue(() =>
        this.report(
          { id: data?.id, name: data?.name },
          "failed",
          "none",
          error,
        ),
      );
    }
    return this.queue(async () => {
      let record;
      try {
        const db = await this.open();
        if (!db) {
          if (this.fallbackBlocked) throw new Error(this.fallbackBlocked);
          const records = fallbackRecords();
          record = nextRecord(snapshot, current, records[snapshot.id]);
          records[snapshot.id] = record;
          // setItem is atomic. Retain this.records and the on-disk generations
          // unchanged if quota/security denial occurs.
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
          this.records = records;
        } else {
          record = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite"),
              store = tx.objectStore(STORE),
              r = store.get(snapshot.id);
            let written;
            r.onsuccess = () => {
              written = nextRecord(snapshot, current, r.result);
              store.put(written);
            };
            // A successful put request is not a durable commit. Only complete is.
            tx.oncomplete = () => resolve(written);
            tx.onerror = () =>
              reject(tx.error || new Error("World transaction failed"));
            tx.onabort = () =>
              reject(tx.error || new Error("Save interrupted"));
          });
          this.records[snapshot.id] = record;
        }
        this.sessionRecords.delete(snapshot.id);
        return this.report(
          record,
          "durable",
          this.db ? "indexeddb" : "localstorage",
        );
      } catch (error) {
        record ||= nextRecord(snapshot, current, this.records[snapshot.id]);
        this.sessionRecords.set(snapshot.id, record);
        return this.report(record, "session-only", "memory", error);
      }
    });
  }
  remove(id) {
    return this.queue(async () => {
      const db = await this.open();
      // Do not hide a durable world on deletion failure; report the error and
      // retain its session overlay as well.
      if (!db) {
        if (this.records[id] || !this.sessionRecords.has(id)) {
          if (this.fallbackBlocked) throw new Error(this.fallbackBlocked);
          const records = fallbackRecords();
          delete records[id];
          localStorage.setItem(FALLBACK_KEY, JSON.stringify(records));
          this.records = records;
        }
      } else {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(id);
          tx.oncomplete = resolve;
          tx.onerror = () =>
            reject(tx.error || new Error("Could not delete world"));
          tx.onabort = () =>
            reject(tx.error || new Error("World deletion interrupted"));
        });
        delete this.records[id];
      }
      this.sessionRecords.delete(id);
      this.outcomes.delete(id);
      this.notify();
    });
  }
}
