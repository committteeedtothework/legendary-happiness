import { TITAN_MENU_TABS, titanMenuFooter } from "./titan-interface.js";
import { TITAN_DAMAGE } from "./titan-combat.js";
import { TITAN_CUE_FIELDS, titanScoreCues } from "./giganto-score-timeline.js";
const names = {
  basic: "Jab",
  stomp: "Stomp",
  spin: "Spin Slash (per contact)",
  cyclone: "Cyclone Kick (per contact)",
  shot: "Homing Shot (per sphere)",
  combo: "Combo",
  heavy: "Heavy strike",
  finisher: "Combo finisher",
  boom: "Sonic Boom (per wave)",
  rush: "Wild Rush",
  loop: "Cyloop",
  homing: "Homing attack",
  cross: "Cross Slash",
  counter: "Counter",
  perfectCounter: "Perfect counter",
  struggle: "Cinematic counter",
};
export function titanSettingsPanel(c, active, info) {
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[x],
    );
  const cues = titanScoreCues(c.scoreCues);
  const music = `<details class="titan-score-controls"><summary>Soundtrack</summary><p>${c.battleTrack ? escape(c.battleTrack.name) : "Undefeatable"}</p><label>Battle track<input type="file" accept=".mp3,audio/mpeg" data-titan-track></label><button data-titan="reset-track">Default track</button><details><summary>Cue times · seconds</summary>${TITAN_CUE_FIELDS.map(
    ([path, label]) => {
      const [section, key] = path.split(".");
      return `<label><span>${label}</span><input type="number" min="0" max="900" step="0.01" value="${cues[section][key]}" data-titan-cue="${path}"></label>`;
    },
  ).join(
    "",
  )}<button data-titan="apply-cues">Apply cue map</button><button data-titan="reset-cues">Reset cue map</button></details><p>MP3 · 16 MB maximum</p></details>`;
  const check = (k, name) =>
    `<label class="titan-check"><span>${name}</span><input type="checkbox" data-titan-config="${k}" ${c[k] ? "checked" : ""} ${info.skyLocked && k === "dynamicSky" ? 'disabled title="Time and weather stay fixed after victory."' : ""}></label>`;
  const select = (k, name, options) =>
    `<label><span>${name}</span><select data-titan-config="${k}" ${(active && k === "climbMode") || (info.skyLocked && k === "arenaWeather") ? "disabled" : ""}>${options.map(([v, label]) => `<option value="${v}" ${c[k] === v ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
  const range = (k, name, min, max, step) =>
    `<label><span>${name} <output>${c[k]}</output></span><input type="${k === "drain" ? "number" : "range"}" min="${min}" max="${max}" step="${step}" value="${c[k]}" data-titan-config="${k}" ${info.skyLocked && k === "arenaDayLength" ? "disabled" : ""}></label>`;
  const group = (name, content) =>
    `<fieldset><legend>${name}</legend>${content}</fieldset>`;
  const combat = group(
    "Combat",
    select(
      "difficulty",
      "Difficulty",
      ["easy", "normal", "hard"].map((x) => [
        x,
        x[0].toUpperCase() + x.slice(1),
      ]),
    ) +
      range("drain", "Ring drain", 0, 3, 0.1) +
      range("rings", "Ring capacity", 100, 999, 1) +
      range("healthMultiplier", "Boss health", 0.5, 2, 0.1) +
      select("climbMode", "Ascent", [
        ["armor", "Armor wall run"],
        ["ruins", "Ruins route"],
      ]) +
      check("bossMobility", "Titan movement") +
      check("adaptiveBoss", "Adaptive defense") +
      range("aggression", "Aggression", 0.7, 1.5, 0.1) +
      range("bossPower", "Attack power", 0.5, 2, 0.1) +
      check("strictParry", "Timed parry") +
      check("checkpoints", "Checkpoints"),
  );
  const visual = group(
    "Graphics",
    select("graphicsQuality", "Quality", [
      ["auto", "Match world"],
      ["low", "Low"],
      ["balanced", "Balanced"],
      ["high", "High"],
    ]) +
      select("shadowQuality", "Shadows", [
        ["auto", "Match world"],
        ["off", "Off"],
        ["low", "Soft · 1024"],
        ["high", "Soft · 4096"],
      ]) +
      select("ambientOcclusion", "Contact shading", [
        ["off", "Off"],
        ["low", "Soft · Half resolution"],
        ["high", "Detailed · 3/4 resolution"],
      ]) +
      select("sceneryDetail", "Foliage", [
        ["auto", "Match quality"],
        ["off", "Off"],
        ["low", "Reduced"],
        ["high", "Full"],
      ]) +
      range("renderScale", "Resolution scale", 0.65, 1, 0.05) +
      range("exposure", "Exposure", 0.7, 1.4, 0.05) +
      range("bloomIntensity", "Bloom", 0, 0.65, 0.05) +
      check("atmosphere", "Atmosphere") +
      check("impactEffects", "Impact sparks") +
      check("postProcessing", "Post-processing") +
      check("antialiasing", "Anti-aliasing") +
      check("motionBlur", "Speed blur") +
      check("speedTrails", "Speed trails") +
      check("particles", "Particles") +
      check("lighting", "Dynamic lighting") +
      check("dynamicSky", "Day / night cycle") +
      range("arenaDayLength", "Day length · seconds", 600, 3600, 60) +
      select("arenaWeather", "Weather", [
        ["auto", "Changing"],
        ["clear", "Clear"],
        ["storm", "Storm"],
      ]) +
      check("weatherEffects", "Rain") +
      check("groundEffects", "Ground impacts") +
      check("liveReflections", "Sky reflections"),
  );
  const sound = group(
    "Audio",
    check("audio", "Sound") +
      check("music", "Music") +
      range("masterVolume", "Master volume", 0, 1, 0.01) +
      range("musicVolume", "Music volume", 0, 1, 0.01) +
      range("effectsVolume", "Effects volume", 0, 1, 0.01) +
      music,
  );
  const camera = group(
    "Camera",
    check("cinematicBars", "Letterbox") +
      range("cameraFov", "Field of view", 45, 95, 1) +
      range("cameraSensitivity", "Sensitivity", 0.0005, 0.01, 0.0001) +
      range("cameraShake", "Camera shake", 0, 1, 0.05) +
      check("moveCamera", "Move camera") +
      range("cinematicPace", "Cinematic pace", 0.4, 1, 0.05),
  );
  const tuning = `<details class="titan-tuning"><summary>Damage tuning</summary>${Object.entries(
    c.damage,
  )
    .map(
      ([k, v]) =>
        `<label><span>${names[k] || k}</span><input type="number" min="1" max="${TITAN_DAMAGE[k] * 3}" value="${v}" data-titan-damage="${k}"></label>`,
    )
    .join("")}</details>`;
  const portal = info.portal
    ? `Portal · X ${info.portal.x} / Y ${info.portal.y} / Z ${info.portal.z}`
    : `No portal${info.cooldown ? ` · ${info.cooldown}s` : ""}`;
  if (active) {
    const selected = TITAN_MENU_TABS.includes(info.tab) ? info.tab : "graphics";
    const labels = {
      graphics: "Graphics",
      sound: "Sound",
      camera: "Camera",
      battle: "Battle",
      controls: "Controls",
    };
    const controls =
      info.controllerGuide ||
      `<section class="titan-control-sheet"><h3>Movement</h3><dl><dt>WASD</dt><dd>Move</dd><dt>Mouse</dt><dd>Camera</dd><dt>Shift</dt><dd>Boost</dd><dt>Space / Ctrl</dt><dd>Jump or rise / Descend</dd><dt>Tab</dt><dd>Lock on</dd><dt>H</dt><dd>Controls overlay</dd></dl><h3>Combat</h3><dl><dt>LMB</dt><dd>Combo / Counter</dd><dt>RMB</dt><dd>Parry</dd><dt>Q</dt><dd>Dodge</dd><dt>X</dt><dd>Homing attack</dd><dt>R</dt><dd>Sonic Boom</dd><dt>F</dt><dd>Wild Rush</dd><dt>E</dt><dd>Quick Cyloop / Climb</dd><dt>C</dt><dd>Cross Slash / Draw Cyloop</dd><dt>V</dt><dd>Homing Shot</dd><dt>Z</dt><dd>Stomp</dd><dt>G</dt><dd>Spin Slash</dd><dt>B</dt><dd>Cyclone Kick</dd></dl></section>`;
    const contents = {
      graphics: visual,
      sound,
      camera,
      battle: combat + tuning,
      controls,
    };
    return `<main class="dialog titan-result titan-settings titan-menu-surface" role="dialog" aria-modal="true" aria-labelledby="titan-settings-title" data-tab="${selected}"><header class="titan-menu-heading"><span>GIGANTO</span><h2 id="titan-settings-title">Options</h2></header><nav class="titan-menu-tabs" role="tablist" aria-label="Arena options">${TITAN_MENU_TABS.map((key) => `<button id="titan-tab-${key}" role="tab" data-titan-tab="${key}" aria-controls="titan-panel-${key}" aria-selected="${key === selected}" tabindex="${key === selected ? 0 : -1}">${labels[key]}</button>`).join("")}</nav><div class="titan-config">${TITAN_MENU_TABS.map((key) => `<section role="tabpanel" id="titan-panel-${key}" data-titan-panel="${key}" aria-labelledby="titan-tab-${key}" ${key === selected ? "" : "hidden"}>${contents[key]}</section>`).join("")}</div><button class="titan-settings-done" data-titan="back">Back</button>${titanMenuFooter}</main>`;
  }
  return `<main class="dialog titan-result titan-settings"><h2>${active ? "Settings" : "Giganto"}</h2>${active ? "" : `<p class="titan-signal">${portal}</p><p>Titan Sigils · ${info.sigils}</p>`}<div class="titan-config">${active ? visual + sound + camera + combat + tuning : group("Portals", check("enabled", "Natural portals") + range("spawnChance", "Spawn chance", 0, 1, 0.05) + range("cooldown", "Cooldown", 10, 7200, 10)) + combat}</div>${active ? `<details class="titan-control-guide"><summary>Controls</summary><p>WASD · Move | Mouse · Camera | Shift · Boost | Space / Ctrl · Rise / Fall</p><p>LMB · Combo / Counter | RMB · Parry | Q · Dodge | Tab · Target</p><p>X · Homing attack | R · Sonic Boom | F · Wild Rush | E · Cyloop | C · Cross Slash | V · Homing Shot</p><p>Escape · Pause</p></details>` : ""}${!active && info.creative ? '<button class="secondary wide" data-titan="summon">Locate portal</button>' : ""}<button class="primary wide" data-titan="back">Done</button></main>`;
}
