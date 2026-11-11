import {
  STANDS,
  STAND_KEYS,
  STAND_KEY_CHOICES,
  standBindings,
  palmConfig,
} from "./stands-data.js";
import { ensurePalm, configurePalm } from "./devils-palm.js";
import {
  activateStand,
  standMaxEnergy,
  grantCreativeStand,
} from "./stand-abilities.js";
import { damageEntity } from "./simulation.js";
const escape = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const keyLabel = (code) => code.replace("Key", "");
const portraits = new Map();
export function standPortrait(id) {
  if (portraits.has(id)) return portraits.get(id);
  const d = STANDS[id],
    c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d");
  const box = (color, a, b, w, h) => {
    x.fillStyle = color;
    x.fillRect(a, b, w, h);
  };
  box("#24202f", 0, 0, 64, 64);
  box("#514059", 4, 4, 56, 56);
  if (d.form === "dinosaur") {
    box(d.color, 17, 28, 31, 19);
    box(d.color, 36, 16, 18, 16);
    box(d.accent, 39, 27, 17, 5);
    box("#13182b", 48, 20, 3, 3);
    box(d.color, 8, 35, 15, 8);
    box(d.accent, 22, 47, 8, 8);
    box(d.accent, 40, 47, 8, 8);
  } else if (d.form === "spray") {
    box(d.color, 23, 25, 18, 28);
    box(d.accent, 20, 23, 24, 5);
    box(d.accent, 31, 16, 19, 6);
    box("#201a30", 26, 34, 3, 3);
    box("#201a30", 35, 34, 3, 3);
  } else {
    box(d.color, 23, 31, 18, 18);
    box(d.color, 23, 49, 7, 9);
    box(d.color, 34, 49, 7, 9);
    box(d.color, 15, 32, 7, 19);
    box(d.color, 42, 32, 7, 19);
    box(d.accent, 14, 47, 9, 6);
    box(d.accent, 41, 47, 9, 6);
    box(d.color, 21, 13, 22, 18);
    box("#191c30", 25, 20, 4, 4);
    box("#191c30", 35, 20, 4, 4);
    if (d.form === "rabbit") {
      box(d.color, 22, 4, 6, 12);
      box(d.color, 36, 4, 6, 12);
      box(d.accent, 24, 6, 2, 8);
      box(d.accent, 38, 6, 2, 8);
    }
    if (d.form === "rope") {
      box("#634a34", 15, 12, 34, 4);
      box(d.accent, 22, 6, 20, 8);
    }
    if (d.form === "imp") {
      box(d.accent, 18, 11, 5, 17);
      box(d.accent, 41, 11, 5, 17);
      box(d.accent, 25, 9, 14, 5);
    }
    box(d.accent, 28, 35, 8, 8);
  }
  const url = c.toDataURL();
  portraits.set(id, url);
  return url;
}
function use(g, slot) {
  if (g.multiplayer?.isGuest) return g.multiplayer.command("stand", { slot });
  return activateStand(g, slot, damageEntity);
}
export function installStandUI(ui) {
  const g = ui.game,
    settings = ui.settings.bind(ui),
    pause = ui.pause.bind(ui),
    frame = ui.frame.bind(ui),
    play = ui.play.bind(ui);
  ui.creativeStandCatalog = () =>
    g.mode !== "creative"
      ? ""
      : `<p class="fine">H · Summon   F / G · Abilities   V · Details</p><div class="creative-stand-grid">${Object.entries(
          STANDS,
        )
          .map(
            ([id, d]) =>
              `<section><img src="${standPortrait(id)}" alt="${escape(d.name)}"><div><h3>${escape(d.name)}</h3><p>${escape(d.primary.name)} · ${escape(d.secondary.name)}</p><button class="secondary" data-action="creative-stand" data-stand="${id}">${g.player.standData?.id === id ? "Selected" : "Equip Stand"}</button></div></section>`,
          )
          .join("")}</div>`;
  ui.selectCreativeStand = (id) => {
    if (g.mode !== "creative") return false;
    if (g.multiplayer?.isGuest) {
      g.multiplayer.command("stand", { slot: "creative", id });
      return true;
    }
    if (!grantCreativeStand(g, id)) return false;
    ui.buildInventory();
    ui.toast(`${STANDS[id].name} equipped.`);
    return true;
  };
  ui.standMenu = () => {
    const s = g.player.standData,
      d = STANDS[s?.id],
      keys = standBindings(g.settings.standKeys);
    ui.setScreen(
      "stand",
      `<main class="dialog stand-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>${d ? escape(d.name) : "Stand Awakening"}</h2>${
        d
          ? `<section class="stand-summary"><img src="${standPortrait(s.id)}" alt="${escape(d.name)} voxel portrait"><div><p>${escape(d.description)}</p><p>Level ${s.level || 1} · ${s.xp || 0} uses · ${s.level >= 5 ? "Max level" : `Next energy upgrade at ${(s.level || 1) * 20} uses`}</p><div class="stand-energy"><i></i><span></span></div></div></section><button class="secondary wide" data-stand-use="summon">${s.summoned ? "Dismiss" : "Summon"} Stand · ${keyLabel(keys.summon)}</button><div class="stand-abilities">${[
              "primary",
              "secondary",
            ]
              .map((slot) => {
                const a = d[slot];
                return `<section><h3>${escape(a.name)} · ${keyLabel(keys[slot])}</h3><p>${escape(a.description)}</p><small>${a.cost} energy · ${a.cooldown / 20}s recharge${a.damage ? ` · ${a.damage} damage` : ""}${a.range ? ` · ${a.range} block range` : ""}</small><button class="secondary wide" data-stand-use="${slot}">Use ability</button><output data-stand-cooldown="${slot}"></output></section>`;
              })
              .join("")}</div>`
          : `<p>Rare red-orange haze, stranger winds and jagged stone fingers may lead you to a Devil's Palm. Stay inside for its trial, or escape before it judges you. No exact map marker is provided.</p><p>Completed trials can grant a Stand, leave you unchanged, or cause normal Survival death. There is no early-escape roll. Creative is protected from fatal rejection by default.</p><div class="stand-collection">${Object.entries(
              STANDS,
            )
              .map(
                ([id, d]) =>
                  `<figure><img src="${standPortrait(id)}" alt="${escape(d.name)}"><figcaption>${escape(d.name)}</figcaption></figure>`,
              )
              .join("")}</div>`
      }<p class="fine">Summon: ${keyLabel(keys.summon)} · Primary: ${keyLabel(keys.primary)} · Secondary: ${keyLabel(keys.secondary)} · Details: ${keyLabel(keys.info)}. Stands persist through ordinary death and reload. Further Acts and upgrade quests are not implemented. Co-op PvP remains disabled.</p><div class="title-button-grid"><button class="secondary" data-action="stand-settings">Stand Options</button><button class="primary" data-action="back">Done</button></div></main>`,
    );
    update(ui);
  };
  ui.standSettings = () => {
    const keys = standBindings(g.settings.standKeys),
      owner = g.active && !g.multiplayer?.isGuest,
      c = palmConfig(g.world.palm?.config);
    const fields = [
      ["rarity", "Spawn rarity (%)", 0, 100, 0.1, c.rarity * 100],
      [
        "relocationDays",
        "Relocation interval (game days)",
        1,
        30,
        1,
        c.relocationDays,
      ],
      ["trialSeconds", "Trial duration (seconds)", 5, 600, 1, c.trialSeconds],
      ["activeCount", "Active Palms", 1, 3, 1, c.activeCount],
      ["awakening", "Awakening weight (%)", 0, 100, 0.1, c.awakening],
      ["death", "Death weight (%)", 0, 100, 0.1, c.death],
      ["neutral", "Neutral survival weight (%)", 0, 100, 0.1, c.neutral],
      [
        "pityRate",
        "Pity increase per failure (points)",
        0,
        20,
        0.1,
        c.pityRate,
      ],
      [
        "corpseChance",
        "Corpse Part chance on awakening (%)",
        0,
        100,
        0.1,
        c.corpseChance,
      ],
    ];
    ui.setScreen(
      "stand-settings",
      `<main class="dialog stand-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Devil's Palm & Stands</h2><h3>Personal keybindings</h3><div class="stand-key-grid">${Object.entries(
        keys,
      )
        .map(
          ([slot, key]) =>
            `<label>${slot[0].toUpperCase() + slot.slice(1)}<select data-stand-key="${slot}" aria-label="Stand ${slot} key">${STAND_KEY_CHOICES.map((k) => `<option value="${k}" ${k === key ? "selected" : ""}>${keyLabel(k)}</option>`).join("")}</select></label>`,
        )
        .join(
          "",
        )}</div><p class="fine">Movement, mining, inventory, R weapon moves and J journal retain their existing controls.</p><h3>World rules · ${owner ? "Owner" : "Read only"}</h3>${owner ? "" : '<p class="fine">Open your own world to configure its Palm rules. Guests use the host’s settings.</p>'}<form id="palm-config"><fieldset ${owner ? "" : "disabled"}><div class="palm-fields">${fields.map(([key, label, min, max, step, value]) => `<label>${label}<input type="number" name="${key}" min="${min}" max="${max}" step="${step}" value="${Number(value.toFixed(3))}" required></label>`).join("")}</div>${[
        ["pity", "Pity system", c.pity],
        [
          "allowReplacement",
          "Allow replacing an existing Stand",
          c.allowReplacement,
        ],
        ["creativeDeath", "Allow fatal rejection in Creative", c.creativeDeath],
        ["keepInventory", "Keep Inventory on death", g.rules?.keepInventory],
      ]
        .map(
          ([key, label, value]) =>
            `<label class="palm-check"><input type="checkbox" name="${key}" ${value ? "checked" : ""}>${label}</label>`,
        )
        .join(
          "",
        )}<p class="fine">Fate weights normalize to exactly 100%. Defaults: 35% awakening, 50% death, 15% survival. Pity shifts at most 20 percentage points toward awakening. Relocation waits for all trials and nearby players; edited sites remain harmless ruins. /palmprotect reserves land against Palm terrain and Stand travel. Creative protection is enabled by default.</p><button class="primary wide" type="submit">Apply World Rules</button></fieldset></form><div id="palm-config-status" role="status"></div><button class="secondary wide" data-action="back">Done</button></main>`,
    );
  };
  ui.settings = () => {
    settings();
    ui.overlay
      .querySelector(".settings-dialog > [data-action=back]")
      ?.insertAdjacentHTML(
        "beforebegin",
        '<button class="secondary wide" data-action="stand-settings">Devil’s Palm & Stand Options...</button>',
      );
  };
  ui.pause = (...a) => {
    pause(...a);
    ui.overlay
      .querySelector(".pause-actions")
      ?.insertAdjacentHTML(
        "afterend",
        '<button class="secondary wide" data-action="stand-info">Stand Awakening</button>',
      );
  };
  ui.play = () => {
    play();
    ui.hud
      .querySelector(".hud-bottom")
      ?.insertAdjacentHTML("afterbegin", '<div id="stand-hud" hidden></div>');
    ui.hud.insertAdjacentHTML("beforeend", '<div id="stand-vignette"></div>');
  };
  ui.frame = () => {
    frame();
    update(ui);
  };
  ui.overlay.addEventListener("click", (e) => {
    const button = e.target.closest("button");
    if (!button) return;
    if (button.dataset.action === "stand-info") ui.standMenu();
    if (button.dataset.action === "stand-settings") ui.standSettings();
    if (button.dataset.standUse) {
      g.resume();
      use(g, button.dataset.standUse);
    }
  });
  ui.overlay.addEventListener("input", (e) => {
    const slot = e.target.dataset.standKey;
    if (!slot) return;
    const keys = standBindings(g.settings.standKeys),
      chosen = e.target.value;
    if (
      Object.entries(keys).some(
        ([key, value]) => key !== slot && value === chosen,
      )
    ) {
      e.target.value = keys[slot];
      ui.toast("That key is already assigned to another Stand action.");
      return;
    }
    g.settings.standKeys = standBindings({ ...keys, [slot]: chosen });
    ui.saveSettings();
  });
  ui.overlay.addEventListener("submit", (e) => {
    if (e.target.id !== "palm-config") return;
    e.preventDefault();
    if (!g.active || g.multiplayer?.isGuest) return;
    if (!e.target.reportValidity()) return;
    const form = new FormData(e.target),
      config = Object.fromEntries([...form].map(([k, v]) => [k, Number(v)]));
    config.rarity /= 100;
    for (const key of ["pity", "allowReplacement", "creativeDeath"])
      config[key] = form.has(key);
    if (configurePalm(g, config)) {
      g.rules = { ...g.rules, keepInventory: form.has("keepInventory") };
      g.save()?.catch(() => ui.toast("Save failed. Export a backup."));
      ui.standSettings();
      ui.overlay.querySelector("#palm-config-status").textContent = "Saved.";
    }
  });
}
function update(ui) {
  const stamp = globalThis.performance?.now?.() || Date.now();
  const identity = ui.screen + ":" + ui.game.player.standData?.id;
  if (ui._standIdentity === identity && stamp < (ui._nextStandUpdate || 0))
    return;
  ui._standIdentity = identity;
  ui._nextStandUpdate = stamp + 100;
  if (ui.screen === "inventory" && ui.creativeTab === "stands")
    ui.overlay.querySelectorAll("[data-stand]").forEach((button) => {
      button.textContent =
        ui.game.player.standData?.id === button.dataset.stand
          ? "Selected"
          : "Equip Stand";
    });
  const g = ui.game,
    s = g.player.standData,
    d = STANDS[s?.id],
    max = standMaxEnergy(g),
    now = g.tickCount || 0;
  if (ui.screen === "stand" && d) {
    const bar = ui.overlay.querySelector(".stand-energy");
    if (bar) {
      bar.querySelector("i").style.width = (s.energy / max) * 100 + "%";
      bar.querySelector("span").textContent =
        `Energy ${Math.floor(s.energy)} / ${max}`;
    }
    for (const slot of ["primary", "secondary"]) {
      const remaining = Math.max(0, (s.cooldowns?.[slot] || 0) - now) / 20,
        button = ui.overlay.querySelector(`[data-stand-use=${slot}]`);
      if (button)
        button.disabled =
          !s.summoned ||
          remaining > 0 ||
          s.energy < d[slot].cost ||
          (s.awakeningUntil || 0) > now;
      const out = ui.overlay.querySelector(`[data-stand-cooldown=${slot}]`);
      if (out)
        out.textContent = remaining
          ? `Ready in ${remaining.toFixed(1)}s`
          : "Ready";
    }
  }
  const hud = ui.hud.querySelector("#stand-hud");
  if (!hud) return;
  hud.hidden = !d && s?.trial?.phase !== "trial";
  if (d) {
    const keys = standBindings(g.settings.standKeys),
      cooldown = (slot) =>
        Math.max(0, Math.ceil(((s.cooldowns?.[slot] || 0) - now) / 20));
    hud.textContent = `${d.name} · ${s.summoned ? "Summoned" : "Dismissed"} · Energy ${Math.floor(s.energy)} / ${max}\n${keyLabel(keys.summon)} Summon · ${keyLabel(keys.primary)} ${d.primary.name}${cooldown("primary") ? " " + cooldown("primary") + "s" : ""} · ${keyLabel(keys.secondary)} ${d.secondary.name}${cooldown("secondary") ? " " + cooldown("secondary") + "s" : ""} · ${keyLabel(keys.info)} Details`;
  } else if (s?.trial?.phase === "trial")
    hud.textContent =
      "An unnatural presence surrounds you...\n" +
      Math.floor(s.trial.elapsed / 20) +
      " seconds endured · leave the region to escape";
  const v = ui.hud.querySelector("#stand-vignette");
  if (v) {
    const f = g.renderer.standVisuals?.trialFade || 0;
    const flash =
      s?.effect?.kind === "awaken" &&
      now - s.effect.tick < 3 &&
      g.settings.lightningFlashes !== false;
    v.style.background = flash ? "#fff4cf" : "";
    v.style.opacity = String(flash ? 0.55 : f * 0.65);
    v.dataset.awakening = String(
      (s?.awakeningUntil || 0) > now && g.settings.lightningFlashes !== false,
    );
  }
}
