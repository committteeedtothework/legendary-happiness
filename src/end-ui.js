import { B } from "./data.js";
import { endState } from "./end-runtime.js";
export class EndJournal {
  constructor(game) {
    this.game = game;
    this.hud = document.createElement("section");
    this.hud.id = "world-boss-hud";
    this.hud.hidden = true;
    this.hud.innerHTML =
      '<h2>DRAGOON</h2><div class="end-boss-track" role="progressbar" aria-label="DRAGOON health" aria-valuemin="0" aria-valuemax="200"><i></i></div><p></p>';
    game.ui.root.append(this.hud);
    game.ui.overlay.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="end-journal"]')) this.open();
    });
  }
  open() {
    const g = this.game;
    if (!g.active) return;
    if (g.running) g.pause();
    const s = endState(g.world),
      count = (id) =>
        g.inventory.count?.(id) ||
        g.inventory.slots.reduce((n, x) => n + (x?.id === id ? x.count : 0), 0),
      site = s.lastStronghold;
    g.ui.setScreen(
      "end-journal",
      `<main class="dialog end-journal"><header><h2>The End</h2><button data-action="back">Done</button></header><section><h3>Eyes of Ender</h3><p>Combine an Ender Pearl with Blaze Powder. Use an Eye in the Overworld to follow it toward a stronghold. Recover Eyes that fall.</p><p>Ender Pearls · ${count("ender_pearl")}　Eyes of Ender · ${count("eye_of_ender")}</p>${site ? `<p>Stronghold · X ${Math.round(site.x)} / Z ${Math.round(site.z)}</p>` : ""}</section><section><h3>End Portal</h3><p>Find the underground portal room. Fill all twelve frames with Eyes of Ender, then step into the portal.</p></section><section><h3>DRAGOON</h3><p>Destroy the crystals on the obsidian towers to stop healing. Use a bow in flight and a blade when DRAGOON lands. Stay clear of purple breath.</p></section><section><h3>End Cities</h3><p>Explore outer islands for purpur towers, bridges and treasure rooms. Shulker shots cause levitation. Ships can contain Elytra: equip them in your chest slot and hold Jump while falling to glide. Look to steer; release Jump to stop.</p><h3>After the Battle</h3><p>The fountain returns you home. Recover the egg above it. Reach the small gateway to explore the outer islands.</p><p>Place four End Crystals around the fountain to summon DRAGOON again. Craft a crystal with glass, an Eye of Ender and Blaze Powder.</p></section></main>`,
    );
  }
  frame() {
    const g = this.game,
      s = g.world?.endgame,
      boss = g.entities?.find((e) => e.type === "dragoon" && e.hp > 0);
    this.hud.hidden = !(
      g.active &&
      g.dimension === "end" &&
      g.ui.screen === "play" &&
      boss &&
      !s?.defeated
    );
    if (this.hud.hidden) return;
    const hp = boss.dying ? 0 : boss.hp;
    const track = this.hud.querySelector("[role=progressbar]");
    track.setAttribute("aria-valuenow", String(Math.round(hp)));
    this.hud.querySelector("i").style.width =
      `${Math.max(0, Math.min(100, hp / 2))}%`;
    const crystals = g.entities.filter(
      (e) => e.type === "end_crystal" && e.hp > 0 && !e.placed,
    ).length;
    this.hud.querySelector("p").textContent = boss.dying
      ? "Defeated"
      : `${crystals} crystals · ${boss.mode === "charge" ? "Incoming" : boss.mode === "perch" ? "Perched" : s?.phase === 2 ? "Enraged" : "In flight"}`;
  }
}
