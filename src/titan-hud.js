import {titanTargetContact} from "./titan-targeting.js";
import { TITAN_COMBO } from "./titan-combo.js";
import { arenaPadGlyph, padGlyph } from "./controller-data.js";
import { TITAN_ACTIONS } from "./titan-combat.js";
import { nearestTitanSurface } from "./titan-contact.js";
import { arenaUnitScale } from "./titan-metrics.js";
import { titanTransformation } from "./titan-transformation.js";
const icons = {
  stomp: '<path d="m6 3 7 3-2 8 8 2-2 5H4l-1-6 4-3m9-11v8m-3-3 3 3 3-3"/>',
  spin: '<path d="M4 10a8 8 0 1 1 1 8M3 4v7h7M16 7l-6 7 8 2"/>',
  cyclone:
    '<path d="M3 6c16-6 23 9 7 13-8 2-10-5-4-7 10-3 12 4 7 7m-2-3 2 3 4-1"/>',
  ring: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/>',
  star: '<path d="m12 2 2.7 6.8L22 12l-7.3 3.2L12 22l-2.7-6.8L2 12l7.3-3.2Z"/>',
  shield: '<path d="M4 3h16v9c0 5-8 9-8 9s-8-4-8-9Z"/>',
  sword: '<path d="m7 15 11-12 3 1-1 3L9 18M4 13l7 7M3 21l4-4"/>',
  speed: '<path d="m4 4 8 4-2 5 10 4-1 4H3l-1-5 6-7M13 3h8M16 7h6"/>',
  bolt: '<path d="m14 2-9 12h6l-1 8 9-13h-6Z"/>',
  homing: '<path d="m12 3 9 17H3Z M12 8v5m0 3v1"/>',
  boom: '<path d="M4 4c18 1 18 15 0 16 10-4 10-12 0-16Z M3 9h6m-6 6h6"/>',
  rush: '<path d="m3 7 11-4-6 8 13-1-14 11 5-9-9 2Z"/>',
  loop: '<path d="M7 5c12-5 18 10 6 14C2 23-2 8 7 5m9-1 4 4-5 1"/>',
  cross:
    '<path d="m4 4 16 16M5 10l5-5m4 14 5-5M20 4 4 20m10-15 5 5M5 14l5 5"/>',
  shot: '<circle cx="12" cy="12" r="4"/><path d="m12 2 0 3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2"/>',
  gem: '<path d="m7 3 10 0 5 7-10 12L2 10Z M2 10h20M7 3l5 19 5-19"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${icons[name]}</svg>`;
export function titanHudTemplate() {
  return `
 <div class="titan-compass" aria-label="Camera heading"><div class="titan-compass-ticks"></div><b id="titan-bearing">N 000°</b><i></i></div>
 <div class="titan-top"><strong class="titan-title">GIGANTO</strong><div class="titan-health" role="progressbar" aria-label="Giganto health"><em></em><i></i></div><span id="titan-phase"></span></div>
 <div class="titan-resources"><div class="titan-ring-total">${icon("ring")}<b><span id="titan-rings"></span><small id="titan-ring-capacity"></small></b></div><div class="titan-mini" title="Rings gathered">${icon("star")}<span id="titan-gathered">0</span></div><div class="titan-mini" title="Chaos Emeralds">${icon("gem")}<span id="titan-emeralds">6</span></div><div class="titan-mini" title="Quick Cyloop charges">${icon("loop")}<span id="titan-cyloop-stock">1/2</span></div></div>
 <div class="titan-objective"><b id="titan-objective"></b><span id="titan-detail"></span></div>
 <div class="titan-combo"><strong id="titan-combo">0</strong><small>COMBO</small><div><i id="titan-rush-meter"></i></div><span id="titan-rush-label"></span></div>
 <div class="titan-stats" aria-label="Sonic battle stats"><i class="titan-stats-diamond"></i><div class="titan-stat stat-n">${icon("speed")}<b id="titan-stat-speed">0</b><small>SPEED</small></div><div class="titan-stat stat-w">${icon("sword")}<b id="titan-stat-power">34</b><small>POWER</small></div><div class="titan-stat stat-e">${icon("shield")}<b id="titan-stat-guard">READY</b><small>GUARD</small></div><div class="titan-stat stat-s">${icon("ring")}<b id="titan-stat-capacity">400</b><small>CAPACITY</small></div></div>
 <div class="titan-speedometer"><svg viewBox="0 0 160 140" aria-label="Speed and boost"><path class="dial-track" d="M22 112A65 65 0 1 1 138 112" pathLength="100"/><path id="titan-speed-arc" d="M22 112A65 65 0 1 1 138 112" pathLength="100"/><path id="titan-speed-needle" d="M80 80 34 106"/><circle class="dial-hub" cx="80" cy="80" r="4"/><path class="dial-ticks" d="M19 96l8-2m-9-18h9m-5-23 8 4m3-25 7 6m12-24 4 9m23-12v9m24-6-4 9m25 1-7 7m23 10-8 5m17 17-9 2m11 21h-9m6 21-8-3"/></svg><div class="titan-speed-number"><b id="titan-speed">0</b><small>m/s</small></div></div>
 <div class="titan-abilities" aria-label="Combat abilities">${[
   ["homing", "X", "HOMING"],
   ["boom", "R", "SONIC BOOM"],
   ["rush", "F", "WILD RUSH"],
   ["loop", "E", "CYLOOP"],
   ["cross", "C", "CROSS SLASH"],
   ["shot", "V", "HOMING SHOT"],
   ["stomp", "Z", "STOMP"],
   ["spin", "G", "SPIN SLASH"],
   ["cyclone", "B", "CYCLONE KICK"],
 ]
   .map(
     ([key, button, label]) =>
       `<div data-ability="${key}">${icon(key)}<kbd>${button}</kbd><span>${label}</span><b></b><i></i></div>`,
   )
   .join("")}</div>
 <div id="titan-return-marker" hidden>Overworld</div><div class="titan-target-state" id="titan-target-state"></div><div class="titan-phase-banner" id="titan-phase-banner" role="status"></div><div class="titan-damage-number" id="titan-damage-number"></div>
 <div class="titan-tell" id="titan-tell"></div><div class="titan-qte" id="titan-qte" hidden><svg class="titan-qte-dial" viewBox="0 0 120 120" aria-hidden="true"><circle class="qte-track" cx="60" cy="60" r="51"/><circle class="qte-time" cx="60" cy="60" r="51" pathLength="100"/><circle class="qte-effort" cx="60" cy="60" r="41" pathLength="100"/></svg><kbd class="titan-qte-key">SPACE</kbd><b></b><progress max="1"></progress><div></div><span class="titan-qte-count"></span></div><div class="titan-controls" id="titan-controls"></div><section id="titan-help" hidden aria-label="Controls"><h2>Controls <small>H · Close</small></h2><div><span><kbd>WASD</kbd> Move</span><span><kbd>Mouse</kbd> Camera</span><span><kbd>Shift</kbd> Boost</span><span><kbd>Space</kbd> Jump / Rise</span><span><kbd>Ctrl</kbd> Descend</span><span><kbd>LMB</kbd> Attack / Counter</span><span><kbd>RMB</kbd> Parry</span><span><kbd>Q</kbd> Dodge</span><span><kbd>Tab</kbd> Lock on</span><span><kbd>E</kbd> Climb / Cyloop</span><span><kbd>C</kbd> Draw Cyloop / Cross Slash</span><span><kbd>X</kbd> Homing attack</span><span><kbd>R</kbd> Light Dash / Sonic Boom</span><span><kbd>F</kbd> Wild Rush</span><span><kbd>V</kbd> Slide / Homing Shot</span><span><kbd>Z</kbd> Stomp</span><span><kbd>G</kbd> Drop Dash / Spin Slash</span><span><kbd>B</kbd> Cyclone Kick</span></div></section><div id="titan-reticle" aria-label="Locked target" hidden><svg viewBox="0 0 30 28" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 2 12 23H3Z"/></svg></div>`;
}
export function updateTitanHudExtras(hud, s, view, controller) {
  const q = (id) => hud.querySelector(id),
    speed =
      Math.hypot(s.avatar.vx, s.avatar.vy, s.avatar.vz) * arenaUnitScale(s),
    heading = view?.heading || 0,
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  q("#titan-bearing").textContent =
    `${dirs[Math.round(heading / 45) % 8]} ${Math.round(heading).toString().padStart(3, "0")}°`;
  hud.style.setProperty("--titan-bearing", `${-(heading % 15) * 2}px`);
  q("#titan-ring-capacity").textContent = `/${s.config.rings}`;
  hud.dataset.phase = s.phase;
  q("#titan-gathered").textContent =
    (s.ringPickups?.length || 0) * 10 + s.collected.length * 5;
  q("#titan-emeralds").textContent = s.emerald ? "7" : "6";
  q("#titan-combo").textContent = s.combo;
  q("#titan-cyloop-stock").textContent = `${Math.floor((s.cyloopCharge ?? 1)+1e-8)}/2`;
  q("#titan-rush-meter").style.width =
    `${s.phantom > 0 ? Math.min(100,s.phantom / TITAN_COMBO.phantomDuration * 100) : (s.phantomCharge || 0)*100}%`;
  q("#titan-rush-label").textContent = s.phantom > 0 ? "PHANTOM RUSH" : "";
  q("#titan-speed").textContent = Math.round(speed);
  q("#titan-stat-speed").textContent = Math.round(speed);
  q("#titan-stat-capacity").textContent = s.config.rings;
  q("#titan-stat-power").textContent = Math.round(
    s.config.damage.basic * (s.phantom > 0 ? 1.2 : 1),
  );
  const contact = titanTargetContact(s);
  q("#titan-target-state").textContent =
    s.strike?.homing ? (s.titan==='wyvern'?"HOMING ATTACK":"") : s.stage === "combat" && !s.lock ? "TAB · Lock on" : "";
  q("#titan-target-state").setAttribute(
    "aria-label",
    s.lock ? `Target locked: ${contact.id}` : "Free camera",
  );
  q("#titan-target-state").classList.toggle("in-range", contact.distance < 7);
  const hit = s.hitFeedback?.until > s.time ? s.hitFeedback : null;
  q("#titan-damage-number").textContent = hit?.amount
    ? `${Math.round(hit.amount)}${hit.kind === "perfectCounter" ? " · PERFECT" : hit.kind === "blocked" ? " · GUARDED" : ""}`
    : "";
  const damage = q("#titan-damage-number"),
    screen = view?.damageScreen;
  damage.style.left = `${(screen?.x ?? 0.53) * 100}%`;
  damage.style.top = `${(screen?.y ?? 0.43) * 100}%`;
  damage.style.opacity = screen?.visible === false ? "0" : "1";
  hud.classList.toggle("has-combo", s.combo > 0);
  hud.classList.toggle("damage-taken", hit?.kind === "hurt");
  hud.classList.toggle("hit-confirm", !!hit?.amount);
  hud.classList.toggle(
    "critical-rings",
    s.emerald && s.rings < Math.min(60, s.config.rings * 0.25),
  );
  q("#titan-phase-banner").textContent =
    s.stage === "victory" && s.stageTime < 3
      ? "GIGANTO DEFEATED"
      : s.stage === "phase"
        ? "PHASE II"
        : s.stage === "transform"
          ? s.stageTime < 1.15
            ? "FINAL EMERALD"
            : s.stageTime < 4.3
              ? "CHAOS EMERALDS"
              : "SUPER SONIC"
          : "";
  const exit = q("#titan-return-marker"),
    marker = view?.returnScreen;
  exit.hidden = !(
    s.stage === "victory" &&
    marker?.visible &&
    !s.returnPortal?.crossed
  );
  if (marker) {
    exit.style.left = `${marker.x * 100}%`;
    exit.style.top = `${marker.y * 100}%`;
  }
  hud.dataset.stage = s.stage;
  hud.classList.toggle("grabbed", s.qte?.kind === "crunch");
  hud.classList.toggle("qte-active", !!s.qte);
  if (s.qte) {
    const progress = Math.min(1, s.qte.hits / s.qte.need),
      left = Math.max(0, s.qte.left) / (s.qte.kind === "beam" ? 4.5 : 4.2);
    hud.style.setProperty("--qte-effort", 100 * (1 - progress));
    hud.style.setProperty("--qte-time", 100 * (1 - left));
    hud.classList.toggle("qte-critical", s.qte.left < 1.25);
    q(".titan-qte-count").textContent = s.qte.hits + " / " + s.qte.need;
    q("#titan-qte").style.setProperty(
      "--qte-pulse",
      1 + Math.sin(s.time * 12) * 0.025,
    );
  }
  hud.classList.toggle("counter-cinematic", !!s.counterScene);
  hud.style.setProperty("--titan-health", `${(s.hp / s.maxHp) * 100}%`);
  for (const key of [
    "homing",
    "boom",
    "rush",
    "loop",
    "cross",
    "shot",
    "stomp",
    "spin",
    "cyclone",
  ]) {
    const node = q(`[data-ability="${key}"]`),
      m = TITAN_ACTIONS[key],
      cd = s.cooldowns[key] || 0;
    node.querySelector("kbd").textContent = {
      homing: "X",
      boom: "R",
      rush: "F",
      loop: "E",
      cross: "C",
      shot: "V",
      stomp: "Z",
      spin: "G",
      cyclone: "B",
    }[key];
    const base=s.stage==='traversal'&&!s.emerald;
    const labels={homing:'HOMING',boom:base?'LIGHT DASH':'SONIC BOOM',rush:'WILD RUSH',loop:'CYLOOP',cross:'CROSS SLASH',shot:base?'SLIDE':'HOMING SHOT',stomp:'STOMP',spin:base?'DROP DASH':'SPIN SLASH',cyclone:'CYCLONE KICK'};
    node.querySelector('span').textContent=labels[key];node.hidden=base&&!['homing','boom','shot','stomp','spin'].includes(key);
    node.querySelector("b").textContent =
      base ? "" : key === "loop" ? `${Math.floor((s.cyloopCharge ?? 1)+1e-8)}/2` : cd > 0.05 ? cd.toFixed(1) : "";
    node.querySelector("i").style.width =
      `${key === "loop" ? Math.min(1,s.cyloopCharge ?? 1)*100 : (1 - Math.min(1, cd / m.cooldown)) * 100}%`;
    node.classList.toggle(
      "unavailable",
      !base && (cd > 0.05 || !!s.strike || (key === "loop" && (s.cyloopCharge ?? 1)<1-1e-8)),
    );
  }
  q("#titan-stat-guard").textContent = s.parryHeld
    ? "PARRY"
    : s.counter > 0
      ? "COUNTER"
      : "READY";
  q("#titan-speed-needle").style.transform =
    `rotate(${Math.min(1, speed / 36) * 240}deg)`;
  q("#titan-speed-arc").style.strokeDashoffset =
    100 - Math.min(100, (speed / 36) * 100);
  const pad = controller?.lastDevice === "controller";
  q(".titan-qte-key").textContent = "SPACE";
  hud.classList.toggle("pad-active", pad);
  hud.classList.toggle("traversal",s.stage==='traversal'&&!s.emerald);
  hud.classList.toggle("combat", s.emerald);
  hud.classList.toggle("phantom", s.phantom > 0);
  hud.classList.toggle("titan-guard", s.tactics?.guard > 0);
  hud.classList.toggle(
    "transform-gold",
    s.stage === "transform" && titanTransformation(s.stageTime).gold > 0.5,
  );
}
