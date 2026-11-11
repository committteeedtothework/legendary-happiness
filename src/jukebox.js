import { B, ITEMS, makeStack } from "./data.js";
import { LocalMusicLibrary } from "./local-music.js";
export const DISC_IDS = [
  "music_disc_amber",
  "music_disc_azure",
  "music_disc_moss",
  "music_disc_rose",
];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const jukeboxKey = (t) => `${t.x},${t.y},${t.z}`;
export function jukeboxRecord(world, target) {
  if (!target || world.get(target.x, target.y, target.z) !== B.jukebox)
    return null;
  const key = jukeboxKey(target);
  let record = world.containers[key];
  if (record?.type !== "jukebox")
    record = world.containers[key] = {
      type: "jukebox",
      slots: [null],
      volume: 0.65,
    };
  // Legacy links are retired; an old jukebox becomes an empty disc slot.
  delete record.youtube;
  if (
    !Array.isArray(record.slots) ||
    record.slots.length !== 1 ||
    (record.slots[0] && !DISC_IDS.includes(record.slots[0].id))
  )
    record.slots = [null];
  record.volume = Number.isFinite(record.volume)
    ? Math.max(0, Math.min(1, record.volume))
    : 0.65;
  return record;
}
export function insertDisc(game, record, id) {
  if (
    !record ||
    record.slots?.[0] ||
    !DISC_IDS.includes(id) ||
    game.multiplayer?.isGuest
  )
    return false;
  const index =
    game.inventory.held?.id === id
      ? game.inventory.selected
      : game.inventory.slots.findIndex((s) => s?.id === id);
  if (index < 0 || !game.inventory.consume(index, 1)) return false;
  record.slots[0] = makeStack(id);
  return true;
}
export function ejectDisc(game, record) {
  const disc = record?.slots?.[0];
  if (!disc || game.multiplayer?.isGuest) return false;
  if (game.inventory.add({ ...disc }) > 0) return false;
  record.slots[0] = null;
  return true;
}
export class Jukebox {
  constructor(game) {
    this.game = game;
    this.library = new LocalMusicLibrary();
    this.volume = 0.65;
    this.state = "stopped";
    this.token = 0;
    this.disc = DISC_IDS[0];
  }
  interact() {
    const g = this.game;
    if (g.player.crouching || g.target?.id !== B.jukebox) return false;
    this.open(g.target);
    if (DISC_IDS.includes(g.inventory.held?.id))
      this.insert(g.inventory.held.id);
    return true;
  }
  get record() {
    const s = this.selection,
      g = this.game,
      r = s?.key ? g.world.containers[s.key] : null;
    return s?.worldId === g.id &&
      s.dimension === g.dimension &&
      r?.type === "jukebox" &&
      (g.world.edits?.get(s.key) === undefined ||
        g.world.edits.get(s.key) === B.jukebox)
      ? r
      : null;
  }
  open(target) {
    const g = this.game;
    if (!g.active) return;
    g.pause();
    if (target) {
      const next = {
        ...target,
        key: jukeboxKey(target),
        worldId: g.id,
        dimension: g.dimension,
      };
      if (
        this.selection?.key !== next.key ||
        this.selection?.worldId !== g.id ||
        this.selection?.dimension !== g.dimension
      )
        this.stop();
      this.selection = next;
      jukeboxRecord(g.world, target);
      this.disc =
        this.record?.slots[0]?.id ||
        (g.inventory.held?.id &&
          DISC_IDS.includes(g.inventory.held.id) &&
          g.inventory.held.id) ||
        this.disc;
      this.volume = this.record?.volume ?? 0.65;
    }
    if (
      this.selection?.worldId !== g.id ||
      this.selection?.dimension !== g.dimension
    )
      this.selection = null;
    this.render();
  }
  render() {
    const g = this.game,
      record = this.record,
      guest = g.multiplayer?.isGuest;
    g.ui.setScreen(
      "jukebox",
      `<main class="dialog jukebox-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Close jukebox">×</button></div><h2>Jukebox</h2><div class="local-disc-grid">${DISC_IDS.map((id) => `<button type="button" class="secondary" data-disc="${id}" aria-pressed="${id === this.disc}"><span class="disc-art" style="--disc-color:${ITEMS[id].color}"></span>${esc(ITEMS[id].name)}</button>`).join("")}</div><p>Selected: <b>${esc(ITEMS[this.disc]?.name)}</b> · ${record?.slots[0] ? "Inserted: " + esc(ITEMS[record.slots[0].id].name) : "No disc inserted"}</p><label>MP3 file<input id="jukebox-file" type="file" accept=".mp3,audio/mpeg"></label><p id="jukebox-track-name" class="fine">Loading tracks…</p><div class="jukebox-actions"><button class="secondary" id="jukebox-insert" ${!record || guest || record.slots[0] ? "disabled" : ""}>Insert selected disc</button><button class="secondary" id="jukebox-eject" ${!record?.slots[0] || guest ? "disabled" : ""}>Eject disc</button><button class="secondary" id="jukebox-play" ${!record?.slots[0] ? "disabled" : ""}>Play / Resume</button><button class="secondary" id="jukebox-pause">Pause</button><button class="secondary" id="jukebox-stop">Stop</button></div><p id="jukebox-status" role="status">${esc(this.message || "Choose an MP3, insert its disc, then press Play.")}</p><label>Jukebox volume<input id="jukebox-volume" type="range" min="0" max="1" step="0.05" value="${this.volume}"></label><p class="fine">Craft Amber Disc from four paper and one coal. Azure: Amber + lapis; Moss: Amber + seeds; Rose: Amber + poppy. All discs are also in Creative.</p><p class="fine">MP3 · 32 MB maximum. Tracks stay in this browser and aren’t included in world backups or multiplayer. ${guest ? "Co-op guests listen to the host’s inserted disc using their own local MP3; only the host can insert/eject." : !record ? "Place a Jukebox and right-click it to insert a disc." : "Breaking this block drops its inserted disc."}</p><button class="primary wide" data-action="resume">Back to Game</button></main>`,
    );
    const ui = g.ui.overlay;
    ui.querySelectorAll("[data-disc]").forEach(
      (b) =>
        (b.onclick = () => {
          this.disc = b.dataset.disc;
          this.render();
        }),
    );
    ui.querySelector("#jukebox-file").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const id = this.disc;
        await this.library.put(id, file);
        if (this.playingDisc === id) this.stop();
        this.status(
          `Linked ${file.name}.${this.library.persistent ? "" : " Session only: this browser denied storage."}`,
        );
        this.refreshName();
      } catch (error) {
        this.status(error.message);
      }
    };
    ui.querySelector("#jukebox-insert").onclick = () => this.insert(this.disc);
    ui.querySelector("#jukebox-eject").onclick = () => {
      const r = this.record;
      if (ejectDisc(g, r)) {
        this.stop();
        this.save();
        this.render();
        this.status("Disc returned to your inventory.");
      } else this.status("Make room in your inventory before ejecting.");
    };
    ui.querySelector("#jukebox-play").onclick = () => this.play();
    ui.querySelector("#jukebox-pause").onclick = () => {
      this.audio?.pause();
      this.state = "paused";
      this.autoResume = false;
      this.status("Playback paused.");
    };
    ui.querySelector("#jukebox-stop").onclick = () =>
      this.stop("Playback stopped.");
    ui.querySelector("#jukebox-volume").oninput = (e) => {
      this.volume = Number(e.target.value);
      if (this.record) {
        this.record.volume = this.volume;
      }
      this.syncVolume();
    };
    ui.querySelector("#jukebox-volume").onchange = () => this.save();
    this.refreshName();
  }
  async refreshName() {
    const selected = this.disc;
    try {
      const track = await this.library.get(selected);
      if (this.disc !== selected) return;
      const el = this.game.ui.overlay.querySelector("#jukebox-track-name");
      if (el)
        el.textContent = track
          ? `${track.name} · ${(track.size / 1048576).toFixed(1)} MiB`
          : "No MP3 linked to this disc on this PC.";
    } catch {
      this.status(
        "Could not read the local MP3 library. Choose the file again.",
      );
    }
  }
  status(text) {
    this.message = text;
    this.game.ui.root
      .querySelectorAll("#jukebox-status,[data-local-disc-status]")
      .forEach((e) => (e.textContent = text));
  }
  insert(id) {
    if (!insertDisc(this.game, this.record, id)) {
      this.status("You need this disc in your inventory and an empty jukebox.");
      return false;
    }
    this.stop();
    this.disc = id;
    this.save();
    this.render();
    this.game.ui.updateHotbar();
    this.status("Disc inserted. Press Play to listen.");
    return true;
  }
  save() {
    if (this.game.multiplayer?.isGuest) return;
    this.game
      .save?.()
      ?.catch?.(() =>
        this.status("Could not save the jukebox. Export a world backup."),
      );
  }
  async play() {
    const r = this.record,
      id = r?.slots[0]?.id;
    if (!id) {
      this.status("Insert a disc into a placed jukebox first.");
      return false;
    }
    if (
      this.audio &&
      this.playingDisc === id &&
      this.state !== "ended" &&
      this.state !== "error"
    ) {
      try {
        await this.audio.play();
        this.state = "playing";
        this.status("Playing your local MP3.");
        return true;
      } catch {
        this.status("Press Play again to allow browser audio.");
        return false;
      }
    }
    this.stop();
    const token = ++this.token,
      selection = { ...this.selection };
    try {
      const track = await this.library.get(id);
      if (
        token !== this.token ||
        !this.game.active ||
        this.game.id !== selection.worldId ||
        this.game.dimension !== selection.dimension ||
        this.record?.slots[0]?.id !== id
      )
        return false;
      if (!track) {
        this.disc = id;
        this.status("Choose an MP3 for this disc on this PC first.");
        return false;
      }
      this.objectURL = URL.createObjectURL(track.blob);
      this.audio = new Audio(this.objectURL);
      this.audio.loop = false;
      this.audio.preload = "metadata";
      this.playingDisc = id;
      this.bound = selection;
      this.syncVolume();
      this.audio.onended = () => {
        this.state = "ended";
        this.status("Disc finished. Press Play to replay.");
      };
      this.audio.onerror = () => {
        this.state = "error";
        this.status(
          "This MP3 could not be decoded. Choose a supported MP3 file.",
        );
      };
      await this.audio.play();
      if (token !== this.token) return false;
      this.state = "playing";
      this.status(`Playing ${track.name}`);
      return true;
    } catch (error) {
      if (token === this.token) {
        this.state = "error";
        this.status(
          error.name === "NotAllowedError"
            ? "Press Play again to allow browser audio."
            : "Could not play this MP3. Choose another file.",
        );
      }
      return false;
    }
  }
  syncVolume() {
    if (this.audio)
      this.audio.volume = Math.max(
        0,
        Math.min(1, (this.game.settings.volume ?? 0.65) * this.volume),
      );
  }
  stop(message) {
    this.message = message || "Playback stopped.";
    this.token++;
    if (this.audio) {
      this.audio.onended = this.audio.onerror = null;
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    this.audio = null;
    if (this.objectURL) URL.revokeObjectURL(this.objectURL);
    this.objectURL = null;
    this.bound = null;
    this.playingDisc = null;
    this.state = "stopped";
    this.autoResume = false;
    if (message) this.status(message);
  }
  update() {
    const g = this.game;
    if (!this.audio) return;
    const now = performance.now();
    if (now < (this.nextUpdate || 0)) return;
    this.nextUpdate = now + 100;
    const b = this.bound,
      r = this.record;
    if (
      !g.active ||
      b?.worldId !== g.id ||
      b?.dimension !== g.dimension ||
      !r ||
      r.slots[0]?.id !== this.playingDisc
    ) {
      this.stop("Jukebox stopped: its disc, block or world changed.");
      return;
    }
    const show = ["play", "jukebox"].includes(g.ui.screen);
    if (!show && this.state === "playing") {
      this.audio.pause();
      this.state = "menu-paused";
      this.autoResume = true;
    } else if (show && this.autoResume) {
      this.autoResume = false;
      const media = this.audio;
      media
        .play()
        .then(() => {
          if (this.audio === media) this.state = "playing";
        })
        .catch(() => this.status("Press Play in the jukebox to resume."));
    }
    this.syncVolume();
  }
}
