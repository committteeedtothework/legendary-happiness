import {
  VERITY,
  danceLocked,
  scoreVerityStep,
  VERITY_KEYS,
  nextVerityBeat,
  verityHitBeat,
  verityStickStep,
} from "./verity-simulation.js";
import { VerityMusic } from "./verity-music.js";
import { buttonName, inputDevice } from "./input-prompts.js";
import "./verity.css";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export class VerityEncounter {
  constructor(game) {
    this.g = game;
    this.hud = document.createElement("section");
    this.hud.id = "verity-hud";
    this.hud.hidden = true;
    this.hud.innerHTML = `<h2>Lord Verity</h2><div class="verity-phase"></div><div class="verity-notes"></div><div class="verity-feedback" aria-live="polite"></div><progress max="${VERITY.beats}" value="0" aria-label="Dance progress"></progress><div class="verity-score"></div>`;
    this.media = document.createElement("aside");
    this.media.id = "verity-song";
    this.media.hidden = true;
    this.media.setAttribute("aria-label", "Lord Verity song");
    this.mediaControls = document.createElement("div");
    this.mediaControls.id = "verity-song-controls";
    this.mediaControls.hidden = true;
    this.mediaControls.innerHTML = '<button type="button">Play Song</button>';
    this.mediaControls.querySelector("button").onclick = () => {
      game.audio.unlock();
      if (this.music.state === "error") this.settings();
      else this.music.play();
    };
    document
      .querySelector("#app")
      .append(this.hud, this.media, this.mediaControls);
    this.music = new VerityMusic(game, this.media);
    this.touch = document.createElement("div");
    this.touch.id = "verity-touch";
    this.touch.hidden = true;
    for (const [step, text] of [
      ["left", "←"],
      ["kick", "↑"],
      ["right", "→"],
      ["clap", "Clap"],
    ]) {
      const b = document.createElement("button");
      b.textContent = text;
      b.type = "button";
      b.setAttribute("aria-label", step);
      b.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        game.audio.unlock();
        game.touch?.activate();
        b.classList.add("held");
        b.setPointerCapture?.(e.pointerId);
        this.input(step);
      };
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        b.addEventListener(event, () => b.classList.remove("held"));
      this.touch.append(b);
    }
    document.querySelector("#app").append(this.touch);
  }
  get active() {
    return (
      this.g.active &&
      this.g.player.health > 0 &&
      !this.g.player.multiplayerAway &&
      this.g.dimension === "overworld" &&
      !this.g.giganto?.active &&
      danceLocked(this.g.player)
    );
  }
  handleKey(e) {
    if (!this.active || !this.g.running) return false;
    if (e.code === "Escape") return false;
    e.preventDefault();
    if (!e.repeat && VERITY_KEYS[e.code]) this.input(VERITY_KEYS[e.code]);
    return true;
  }
  controller(r, edge) {
    if (!this.active || !this.g.running) return false;
    if (edge("pause")) {
      this.g.pause();
      return true;
    }
    for (const [action, step] of [
      ["left", "left"],
      ["right", "right"],
      ["up", "kick"],
      ["down", "clap"],
      ["jump", "clap"],
    ])
      if (edge(action)) this.input(step);
    const stick = verityStickStep(r.move, this.stickStep);
    if (stick && stick !== this.stickStep) this.input(stick);
    this.stickStep = stick;
    return true;
  }
  input(step) {
    if (!this.active || !this.g.running) return false;
    const d = this.g.player.verityDance,
      beat = nextVerityBeat(d);
    if (verityHitBeat(d, step) < 0) {
      const until = beat * VERITY.beat - d.time;
      if (
        d.phase === "dance" &&
        beat < VERITY.beats &&
        VERITY.steps[beat % VERITY.steps.length] === step &&
        until > 0 &&
        until <= VERITY.good + VERITY.inputBuffer
      )
        this.pending = { step, beat, id: d.id };
      return false;
    }
    this.pending = null;
    if (this.g.multiplayer?.isGuest)
      return this.g.multiplayer.command("verity", { step });
    const ok = scoreVerityStep(this.g, this.g.player, step);
    if (ok) this.g.audio?.tone?.("place", "gold_block");
    return ok;
  }
  frame(dt) {
    const g = this.g,
      active = this.active,
      d = g.player.verityDance;
    if (active && this.id !== d.id) {
      this.id = d.id;
      this.pending = null;
      this.stickStep = null;
      g.resetControls();
      this.music.begin(d.id, {
        resumeAt:
          (g.world.settlements?.["lord-verity"]?.active?.age || 0) >
          VERITY.arrival
            ? g.world.settlements["lord-verity"].active.age
            : 0,
      });
      g.mouseDown = g.rightMouseDown = false;
      g.mining = 0;
      g.audio.music?.silence();
      g.jukebox?.audio?.pause();
    }
    if (!g.running || !active) {
      this.pending = null;
      this.stickStep = null;
    }
    if (this.pending && g.running) {
      const q = this.pending;
      if (
        q.id !== d?.id ||
        d.phase !== "dance" ||
        d.time > q.beat * VERITY.beat + VERITY.good
      )
        this.pending = null;
      else if (verityHitBeat(d, q.step) >= 0) {
        this.pending = null;
        this.input(q.step);
      }
    }
    document.querySelector("#app").classList.toggle("verity-dancing", active);
    this.mediaControls.querySelector("button").textContent =
      this.music.state === "error" ? "Music Options" : "Play Song";
    this.hud.hidden = !active;
    this.touch.hidden = !active || !g.running || inputDevice(g) !== "touch";
    this.music.update(active, g.running && g.ui.screen === "play");
    this.media.hidden =
      !active ||
      !g.running ||
      g.ui.screen !== "play" ||
      this.music.mode !== "youtube" ||
      !this.music.player;
    this.mediaControls.hidden =
      !active ||
      !["blocked", "error", "paused"].includes(this.music.state) ||
      !g.settings.musicEnabled;
    if (!active) {
      this.id = null;
      this.renderDance = null;
      return;
    }
    if (this.lastTime !== d.time || this.lastPhase !== d.phase) {
      this.lastTime = d.time;
      this.lastPhase = d.phase;
      this.visualTime = d.time;
    } else if (g.running)
      this.visualTime = Math.min(
        d.time + 0.13,
        (this.visualTime || d.time) + dt,
      );
    this.renderDance = { ...d, time: this.visualTime };
    const phase = this.hud.querySelector(".verity-phase");
    phase.textContent =
      d.phase === "arrival" ? "READY" : d.phase === "bow" ? "COMPLETE" : "";
    const beat = Math.min(VERITY.beats - 1, nextVerityBeat(d));
    this.hud.style.setProperty(
      "--verity-timing",
      String(
        Math.max(
          0,
          1 - Math.abs(beat * VERITY.beat - d.time) / (VERITY.beat * 1.5),
        ),
      ),
    );
    const device = inputDevice(g),
      signature = device + (g.controller?.family || "") + ":" + beat;
    if (signature !== this.signature) {
      this.signature = signature;
      const controls =
        device === "controller"
          ? {
              left: buttonName(g, "left"),
              right: buttonName(g, "right"),
              kick: buttonName(g, "up"),
              clap: `${buttonName(g, "down")} / ${buttonName(g, "jump")}`,
            }
          : device === "touch"
            ? { left: "←", right: "→", kick: "↑", clap: "Clap" }
            : { left: "A / ←", right: "D / →", kick: "W / ↑", clap: "S / ↓" };
      this.hud.querySelector(".verity-notes").innerHTML = Array.from(
        { length: 4 },
        (_, i) => {
          const step = VERITY.steps[(beat + i) % VERITY.steps.length];
          return `<span class="verity-note ${i ? "" : "current"}"><b>${esc(controls[step])}</b><small>${step === "kick" ? "Kick" : step === "clap" ? "Clap" : step === "left" ? "Left" : "Right"}</small></span>`;
        },
      ).join("");
    }
    this.hud.querySelector("progress").value = Math.min(
      VERITY.beats,
      d.time / VERITY.beat,
    );
    this.hud.querySelector(".verity-feedback").textContent =
      d.feedbackUntil > d.time ? d.feedback || "" : "";
    this.hud.querySelector(".verity-score").textContent =
      `${d.score || 0} / ${VERITY.beats * 2}`;
  }
  clear() {
    document.querySelector("#app").classList.remove("verity-dancing");
    this.music.stop();
    this.id = null;
    this.pending = null;
    this.stickStep = null;
    this.hud.hidden = this.touch.hidden = this.mediaControls.hidden = true;
    this.g.renderer.verityVisuals?.clear();
  }
  settings() {
    const g = this.g,
      m = g.settings.verityMusic || "supplied";
    g.pause();
    g.ui.setScreen(
      "verity-settings",
      `<main class="dialog compact"><h2>Lord Verity</h2><label>Music<select id="verity-music"><option value="supplied" ${m === "supplied" ? "selected" : ""}>Soundtrack</option><option value="youtube" ${m === "youtube" ? "selected" : ""}>YouTube · Horror Skunx</option><option value="local" ${m === "local" ? "selected" : ""}>Local MP3</option><option value="off" ${m === "off" ? "selected" : ""}>Off</option></select></label><label>Choose MP3<input id="verity-mp3" type="file" accept="audio/mpeg,.mp3"></label><p id="verity-file-status" role="status"></p><p class="fine">YouTube needs an internet connection. Imported music stays on this device.</p><button class="primary wide" data-action="back">Done</button></main>`,
    );
    g.ui.overlay.querySelector("#verity-music").onchange = (e) => {
      g.settings.verityMusic = e.target.value;
      g.ui.saveSettings();
      this.clear();
    };
    g.ui.overlay.querySelector("#verity-mp3").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = g.ui.overlay.querySelector("#verity-file-status");
      try {
        await this.music.library.put("lord-verity", file);
        g.settings.verityMusic = "local";
        g.ui.saveSettings();
        g.ui.overlay.querySelector("#verity-music").value = "local";
        status.textContent = "MP3 ready.";
        this.clear();
      } catch (error) {
        status.textContent = error.message;
      }
    };
  }
}
