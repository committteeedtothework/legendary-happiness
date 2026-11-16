import { WORLD_RULES, normalizeWorldRules } from "./world-rules.js";
export function openWorldRules(ui) {
  const g = ui.game;
  if (!g.active) return;
  const owner = !g.multiplayer?.isGuest,
    rules = normalizeWorldRules(g.rules);
  ui.setScreen(
    "world-rules",
    `<main class="dialog compact"><h2>World Options</h2><form id="world-rules-form">${[["cheats", { label: "Allow Cheats" }], ...Object.entries(WORLD_RULES)].map(([key, r]) => `<label class="world-rule"><input type="checkbox" name="${key}" ${rules[key] ? "checked" : ""} ${owner ? "" : "disabled"}> ${r.label}</label>`).join("")}<button type="submit" class="primary wide">${owner ? "Done" : "Back"}</button></form></main>`,
  );
  ui.overlay.querySelector("form").onsubmit = async (e) => {
    e.preventDefault();
    if (owner) {
      const form = e.currentTarget,
        data = {};
      for (const key of ["cheats", ...Object.keys(WORLD_RULES)])
        data[key] = form.elements.namedItem(key).checked;
      g.rules = normalizeWorldRules(data);
      try {
        await g.save();
      } catch (error) {
        ui.toast("Save failed: " + error.message);
        return;
      }
    }
    ui.pause();
  };
}
