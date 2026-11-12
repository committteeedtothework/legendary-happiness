import {playAchievementCue, achievementEnvelope, ACHIEVEMENT_NOTICE} from "./achievement-feedback.js";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from "./achievement-data.js";
import { achievementState, achievementSummary } from "./achievements.js";
import { iconURL } from "./textures.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export class AchievementView {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.category = "all";
    this.filter = "all";
    this.query = "";
    this.toast = document.createElement("aside");
    this.toast.id = "achievement-toast";
    this.toast.hidden = true;
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    game.ui.root.append(this.toast);
    game.ui.achievementUnlocked = (entry) => {
      this.resetWorld();
      this.queue.push(entry);
      this.saveIn = 1;
    };
    game.ui.achievements = () => this.open();
    game.ui.overlay.addEventListener("click", (e) => {
      const button = e.target.closest("[data-ach-category], [data-ach-filter]");
      if (!button) return;
      game.audio.menu("select");
      if (button.dataset.achCategory)
        this.category = button.dataset.achCategory;
      if (button.dataset.achFilter) this.filter = button.dataset.achFilter;
      this.open(false);
      game.ui.overlay
        .querySelector(
          `[${button.dataset.achCategory ? "data-ach-category" : "data-ach-filter"}="${button.dataset.achCategory || button.dataset.achFilter}"]`,
        )
        ?.focus();
    });
    game.ui.overlay.addEventListener("input", (e) => {
      if (e.target.id !== "achievement-search") return;
      this.query = e.target.value;
      this.renderCards();
    });
  }
  open(reset = true) {
    const g = this.game;
    if (!g.active) return;
    if (g.running) g.pause();
    if (reset) {
      this.query = "";
      this.category = "all";
      this.filter = "all";
    }
    const { completed, total } = achievementSummary(g.player);
    const tabs = [["all", "All"], ...ACHIEVEMENT_CATEGORIES];
    g.ui.setScreen(
      "achievements",
      `<main class="dialog achievement-window ${g.giganto?.active ? "achievement-arena" : "achievement-overworld"}" aria-labelledby="achievement-title"><header class="achievement-heading"><div><h2 id="achievement-title">Achievements</h2><p>${completed} / ${total} unlocked</p></div><button data-action="back">Done</button></header><nav class="achievement-tabs" aria-label="Achievement categories">${tabs.map(([id, label]) => `<button data-ach-category="${id}" aria-pressed="${this.category === id}">${label}</button>`).join("")}</nav><div class="achievement-tools"><input id="achievement-search" type="search" placeholder="Search achievements…" aria-label="Search achievements" value="${esc(this.query)}" maxlength="100"><div role="group" aria-label="Achievement status">${[
        ["all", "All"],
        ["locked", "Locked"],
        ["unlocked", "Unlocked"],
      ]
        .map(
          ([id, label]) =>
            `<button data-ach-filter="${id}" aria-pressed="${this.filter === id}">${label}</button>`,
        )
        .join(
          "",
        )}</div></div><div class="achievement-grid" aria-label="Achievements"></div></main>`,
    );
    this.renderCards();
  }
  renderCards() {
    const root = this.game.ui.overlay.querySelector(".achievement-grid");
    if (!root) return;
    const state = achievementState(this.game.player),
      q = this.query.trim().toLowerCase();
    const entries = ACHIEVEMENTS.filter(
      (e) =>
        (this.category === "all" || e.category === this.category) &&
        (this.filter === "all" ||
          !!state.unlocked[e.id] === (this.filter === "unlocked")) &&
        (!q || `${e.title} ${e.description}`.toLowerCase().includes(q)),
    );
    root.innerHTML = entries.length
      ? entries
          .map((e) => {
            const done = !!state.unlocked[e.id],
              value = state.progress[e.id] || 0;
            return `<article class="achievement-card ${done ? "unlocked" : "locked"} ${e.challenge ? "challenge" : ""}" data-achievement="${e.id}"><img src="${iconURL(e.icon)}" alt="" draggable="false"><div><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p><small>${done ? "Unlocked" : e.survival ? "Survival" : "Not unlocked"}</small>${e.target > 1 ? `<div class="achievement-progress"><progress max="${e.target}" value="${value}" aria-label="${esc(e.title)} progress"></progress><span>${Math.floor(value)} / ${e.target}</span></div>` : ""}</div><span class="achievement-check" aria-hidden="true">${done ? "✓" : "◇"}</span></article>`;
          })
          .join("")
      : '<p class="achievement-empty" role="status">No matching achievements.</p>';
  }
  resetWorld() {
    if (this.worldId === this.game.id) return;
    this.worldId = this.game.id;
    this.queue = [];
    this.toast.hidden = true;
    this.remaining = 0;
    this.saveIn = null;
  }
  frame(dt) {
    const g = this.game;
    this.resetWorld();
    if (!g.active) {
      this.queue = [];
      this.remaining = 0;
      this.toast.hidden = true;
      return;
    }
    if (
      this.saveIn !== null &&
      this.saveIn !== undefined &&
      !g.multiplayer?.isGuest
    ) {
      this.saveIn -= dt;
      if (this.saveIn <= 0) {
        this.saveIn = null;
        if (g.active) g.save()?.catch?.(() => {});
      }
    }
    const stage = g.giganto?.session?.stage;
    const visible =
      g.active &&
      g.ui.screen === "play" &&
      (!g.giganto?.active ||
        ["traversal", "combat", "victory"].includes(stage));
    this.toast.hidden = !visible || !this.remaining;
    if (!visible) return;
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining && this.queue.length) {
      const entry = this.queue.shift();
      this.remaining = ACHIEVEMENT_NOTICE.duration;
      this.toast.dataset.theme = g.giganto?.active ? "arena" : "overworld";
      this.toast.innerHTML = `<img alt="" src="${iconURL(entry.icon)}"><div><span>${entry.challenge ? "Challenge complete!" : "Achievement unlocked!"}</span><strong>${esc(entry.title)}</strong></div>`;
      this.toast.classList.toggle("challenge", !!entry.challenge);
      this.toast.hidden = false;
      if(g.giganto?.active)playAchievementCue(g.audio.context,g.giganto.audio?.bus,{arena:true,challenge:!!entry.challenge});
      else g.audio.achievement({challenge:!!entry.challenge});
    }
    const envelope=achievementEnvelope(ACHIEVEMENT_NOTICE.duration-(this.remaining || 0));
    this.toast.style.opacity=String(envelope);
    this.toast.style.setProperty('--notice-offset', `${(1-envelope)*18}px`);
    if(!this.remaining)this.toast.hidden=true;
  }
}
