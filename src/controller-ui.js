import {
  controllerConfig,
  controllerFamily,
  CONTROLLER_PRESETS,
  PAD_BUTTONS,
  padGlyph,
  arenaPadGlyph,
} from "./controller-data.js";
import { buttonName, controlName } from "./input-prompts.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function controllerPanel(c, status = "No controller connected", game) {
  const range = (k, label, a, b, step) =>
    `<label class="range-label"><span>${label}<output>${c[k]}</output></span><input type="range" data-pad-setting="${k}" min="${a}" max="${b}" step="${step}" value="${c[k]}"></label>`;
  const check = (k, label) =>
    `<label><input type="checkbox" data-pad-setting="${k}" ${c[k] ? "checked" : ""}> ${label}</label>`;
  const select=(key,label,values)=>`<label>${label}<select data-pad-setting="${key}">${values.map(([v,n])=>`<option value="${v}" ${c[key]===v?'selected':''}>${n}</option>`).join('')}</select></label>`;
  return `<main class="dialog settings-dialog controller-dialog"><h2>Controller</h2><p id="controller-status" role="status">${esc(status)}</p>${check("enabled", "Controller enabled")}<label>Preset<select data-pad-setting="preset">${CONTROLLER_PRESETS.map(([id, label]) => `<option value="${id}" ${c.preset === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><h3>Sticks</h3>${range('deadzone','Movement deadzone',0.05,0.45,0.01)}${range('lookDeadzone','Look deadzone',0.02,0.45,0.01)}${range('outerDeadzone','Outer deadzone',0,0.2,0.01)}${select('moveCurve','Movement response',[['linear','Linear'],['precise','Precise'],['fast','Fast']])}${select('lookCurve','Look response',[['linear','Linear'],['smooth','Smooth'],['precision','Precision']])}<h3>Camera</h3>${range('lookSensitivity','Look sensitivity',0.5,6,0.1)}${range('verticalLookScale','Vertical sensitivity',0.25,2,0.05)}${range('lookSmoothing','Look smoothing · seconds',0,0.2,0.01)}${check('invertX','Invert horizontal look')}${check("invertY", "Invert vertical look")}<h3>Buttons</h3>${select('sprintMode','Sprint',[['toggle','Toggle'],['hold','Hold']])}${range('triggerThreshold','Trigger threshold',0.1,0.95,0.05)}${check("vibration", "Vibration")}<details ${c.preset === "custom" ? "open" : ""}><summary>Custom mapping</summary><p>Button and axis numbers start at 0. Use −1 to disable a binding. Button mapping applies to the Custom preset.</p><div class="controller-mapping">${Object.entries(
    PAD_BUTTONS,
  )
    .map(
      ([key]) =>
        `<label>${esc(key.replace(/([A-Z])/g, " $1"))}<input type="number" min="-1" max="63" step="1" value="${c.bindings[key]}" data-pad-binding="${key}"></label>`,
    )
    .join(
      "",
    )}${["moveX", "moveY", "lookX", "lookY", "leftTriggerAxis", "rightTriggerAxis"].map((key) => `<label>${esc(key.replace(/([A-Z])/g, " $1"))}<input type="number" min="-1" max="15" step="1" value="${c[key]}" data-pad-setting="${key}"></label>`).join("")}</div><div id="controller-live" aria-live="off"></div></details>${controllerWorldGuide(c, game)}<button class="secondary wide" data-pad-command="reset">Reset controller settings</button><button class="primary wide" data-pad-command="back">Done</button></main>`;
}
export function installControllerUI(manager) {
  const { game: g } = manager,
    ui = g.ui;
  ui.controllerMenu = () => {
    if (g.giganto?.active) return;
    ui.setScreen(
      "controller-settings",
      controllerPanel(
        controllerConfig(g.settings.controller),
        manager.status(),
        g,
      ),
    );
  };
  ui.overlay.addEventListener("click", (e) => {
    const open = e.target.closest('[data-action="controller-settings"]');
    if (open && !g.giganto?.active) {
      ui.controllerMenu();
      return;
    }
    const b = e.target.closest("[data-pad-command]");
    if (!b) return;
    if (b.dataset.padCommand === "back") ui.settings();
    if (b.dataset.padCommand === "reset") {
      g.settings.controller = controllerConfig();
      ui.saveSettings();
      manager.clear();
      manager.awaitNeutral = true;
      ui.controllerMenu();
    }
  });
  ui.overlay.addEventListener("change", (e) => {
    const key = e.target.dataset.padSetting,
      binding = e.target.dataset.padBinding;
    if (!key && !binding) return;
    const c = controllerConfig(g.settings.controller);
    if (binding) {
      c.preset = "custom";
      c.bindings[binding] = Number(e.target.value);
    } else
      c[key] =
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.tagName === "SELECT"
            ? e.target.value
            : Number(e.target.value);
    g.settings.controller = controllerConfig(c);
    ui.saveSettings();
    manager.clear();
    const out = e.target.closest("label")?.querySelector("output");
    if (out) out.textContent = e.target.value;
    if (key === "preset" || binding) {
      manager.awaitNeutral = true;
      ui.controllerMenu();
    }
  });
}
export function arenaControllerGuide(family, game) {
  const p = (k) => (game ? buttonName(game, k) : padGlyph(family, k)),
    a = (k) =>
      game ? controlName(game, k, "arena") : arenaPadGlyph(family, k);
  const base=game?.giganto?.session?.stage==='traversal';
  const moves=base?['homing','boom','shot','stomp','spin','climb','draw']:['homing','boom','rush','loop','cross','shot','stomp','spin','cyclone'];
  const labels={homing:'Homing attack',boom:base?'Light Dash':'Sonic Boom',rush:'Wild Rush',loop:'Quick Cyloop',cross:'Cross Slash',shot:base?'Slide':'Homing Shot',stomp:'Stomp',spin:base?'Drop Dash':'Spin Slash',cyclone:'Cyclone Kick',climb:'Climb',draw:'Cyloop'};
  return `<section class="titan-control-sheet" data-input-ready="controller"><h3>Movement</h3><dl><dt>Left stick</dt><dd>Move</dd><dt>Right stick</dt><dd>Camera</dd><dt>${p("jump")}</dt><dd>Jump / Rise</dd><dt>${p("crouch")}</dt><dd>Descend</dd><dt>${p("mine")}</dt><dd>Boost</dd><dt>${p("target")}</dt><dd>Lock on</dd><dt>${p("view")}</dt><dd>Controls overlay</dd></dl><h3>Combat</h3><dl><dt>${p("attack")}</dt><dd>Attack / Counter</dd><dt>${p("use")}</dt><dd>Parry</dd><dt>${p("rightShoulder")}</dt><dd>Dodge</dd>${moves.map((k) => `<dt>${a(k)}</dt><dd>${labels[k]}</dd>`).join("")}</dl></section>`;
}

function controllerWorldGuide(c, game) {
  const profile = {
    settings: { controller: c },
    controller: {
      lastDevice: "controller",
      family: controllerFamily(game?.controller?.pad?.id || "", c.preset),
      pad: game?.controller?.pad,
    },
  };
  const n = (a) => controlName(profile, a),
    p = (a) => buttonName(profile, a);
  return `<details data-input-ready="controller"><summary>Controls</summary><p>Left stick · Move. Right stick · Look. ${n("jump")} · Jump. ${n("crouch")} · Crouch. ${n("sprint")} · Sprint. ${n("mine")} · Mine / attack. ${n("use")} · Use / place. ${n("hotbar")} · Hotbar. ${n("inventory")} · Inventory.</p><p>${n("actions")} · Actions, Stands and flight. ${n("ability")} · Weapon ability. ${n("journal")} · Journal. ${n("drop")} · Drop one. ${n("chat")} · Chat. ${n("view")} · Camera. ${n("pause")} · Pause.</p><p>Menus: D-pad or left stick · Navigate. ${n("confirm")} · Select. ${n("cancel")} · Back. Left/right · Adjust. Right stick · Scroll. Inventory: ${n("confirm")} · Move stack. ${n("split")} · Split. ${n("transfer")} · Quick transfer.</p><p>Custom button numbers match the mapping fields. System file pickers use the device's native controls.</p></details>`;
}
