import { freshTitanRecord, safeTitanSite } from "./giganto.js";
import { titanConfig } from "./giganto-simulation.js";
import { WyvernAudio } from "./wyvern-audio.js";
import { titanPortal, animateTitanPortal } from "./giganto-view.js";
import { disposeTitanObject } from "./giganto-models.js";
import { hash } from "./random.js";
import { cloneState } from "./compat.js";
import { MIN_Y, MAX_Y } from "./data.js";
import { updateTitanHudExtras } from "./titan-hud.js";
import { WYVERN_GAPS, WYVERN_HEALTH, stepWyvern, wyvernParryWindow } from "./wyvern-simulation.js";
import { titanReturnReady, TITAN_RETURN } from "./titan-return.js";
import { touchMovement } from "./touch-data.js";
import { WYVERN_TOWER } from "./wyvern-space.js";
import {
  WYVERN_QTE,
  WYVERN_CINEMA,
  wyvernQteTargetScale,
} from "./wyvern-choreography.js";
export function freshWyvernRecord() {
  const r = freshTitanRecord();
  r.config = titanConfig({
    ...r.config,
    climbMode: "ruins",
    colossalScale: false,
    spawnChance: 0.38,
    cooldown: 1200,
  });
  return r;
}
export function restoreWyvernRecord(data) {
  const r = freshWyvernRecord();
  if (!data || data.schema !== 1) return r;
  r.config = titanConfig({
    ...data.config,
    climbMode: "ruins",
    colossalScale: false,
  });
  r.used = [
    ...new Set(
      (Array.isArray(data.used) ? data.used : []).filter(
        (s) => typeof s === "string" && s.length < 150,
      ),
    ),
  ].slice(-4096);
  r.ledger = [
    ...new Set(
      (Array.isArray(data.ledger) ? data.ledger : []).filter(
        (s) => typeof s === "string" && s.length < 150,
      ),
    ),
  ].slice(-4096);
  r.serial = Math.max(0, Math.min(1e9, Math.floor(Number(data.serial) || 0)));
  r.cooldownUntil = Number.isFinite(data.cooldownUntil)
    ? Math.max(0, data.cooldownUntil)
    : 0;
  const p = data.portal;
  if (
    p &&
    typeof p.id === "string" &&
    p.id.length < 150 &&
    [p.x, p.y, p.z].every(Number.isFinite) &&
    Math.abs(p.x) < 3e7 &&
    Math.abs(p.z) < 3e7 &&
    p.y >= MIN_Y &&
    p.y < MAX_Y - 5
  )
    r.portal = {
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      cell: String(p.cell || "").slice(0, 100),
    };
  return r;
}
export class WyvernIntegration {
  constructor(owner) {
    this.owner = owner;
    this.record = freshWyvernRecord();
    owner.game.ui.overlay.addEventListener("click", (e) => {
      const b = e.target.closest("[data-wyvern]");
      if (!b) return;
      if (
        b.dataset.wyvern === "summon" &&
        !owner.active &&
        owner.game.mode === "creative"
      ) {
        owner.game.ui.toast(
          this.findPortal(true)
            ? "Wyvern portal located."
            : "No clear portal site nearby.",
        );
        owner.menu();
      }
    });
  }
  export() {
    const e = this.owner;
    if (this.savedGigantoRecord) {
      const data = cloneState(this.savedGigantoRecord);
      data.wyvern = cloneState(e.record);
      if (e.session) data.activeTitan = "wyvern";
      return data;
    }
    const data = cloneState(e.record);
    data.wyvern = cloneState(this.record);
    return data;
  }
  reset() {
    if (this.mesh) disposeTitanObject(this.mesh);
    if (this.savedGigantoMesh) disposeTitanObject(this.savedGigantoMesh);
    if (this.savedGigantoAudio) this.owner.audio = this.savedGigantoAudio;
    else if (this.owner.audio instanceof WyvernAudio)
      this.owner.audio = new this.owner.gigantoAudioClass(this.owner.game);
    this.mesh = null;
    this.savedGigantoRecord = null;
    this.savedGigantoMesh = null;
    this.savedGigantoAudio = null;
    this.record = freshWyvernRecord();
    this.near = false;
    this.owner.nearWyvernPortal = false;
  }
  select() {
    const e = this.owner;
    if (this.savedGigantoRecord) return;
    this.savedGigantoRecord = e.record;
    this.savedGigantoMesh = e.portalMesh;
    this.savedGigantoAudio = e.audio;
    if (this.savedGigantoMesh) this.savedGigantoMesh.visible = false;
    e.record = this.record;
    e.portalMesh = this.mesh;
    e.audio = new WyvernAudio(e.game);
    e.nearWyvernPortal = false;
    e.nearPortal = true;
  }
  finish() {
    if (!this.savedGigantoRecord) return;
    const e = this.owner;
    this.record = e.record;
    this.mesh = e.portalMesh;
    e.audio.silence();
    e.audio = this.savedGigantoAudio;
    e.record = this.savedGigantoRecord;
    e.portalMesh = this.savedGigantoMesh;
    this.savedGigantoRecord =
      this.savedGigantoMesh =
      this.savedGigantoAudio =
        null;
    e.nearPortal = false;
    e.nearWyvernPortal = false;
    this.near = false;
  }
  findPortal(force = false) {
    const e = this.owner,
      g = e.game,
      r = this.record;
    if (
      e.active ||
      e.pending ||
      !g.active ||
      g.dimension !== "overworld" ||
      g.multiplayer?.connected ||
      r.portal ||
      !r.config.enabled ||
      g.tickCount < r.cooldownUntil
    )
      return false;
    const cx = Math.floor(g.player.x / 160),
      cz = Math.floor(g.player.z / 160);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const a = cx + dx,
          b = cz + dz,
          cell = `wyvern:${a},${b}`;
        if (
          r.used.includes(cell) ||
          (!force && hash(a, 521, b, g.world.seedInt) > r.config.spawnChance)
        )
          continue;
        for (let i = 0; i < 24; i++) {
          const x =
              a * 160 +
              12 +
              Math.floor(hash(a, 522 + i * 2, b, g.world.seedInt) * 136),
            z =
              b * 160 +
              12 +
              Math.floor(hash(a, 523 + i * 2, b, g.world.seedInt) * 136),
            d = Math.hypot(x - g.player.x, z - g.player.z);
          if (
            d < 18 ||
            d > 105 ||
            (e.record.portal &&
              Math.hypot(x - e.record.portal.x, z - e.record.portal.z) < 25)
          )
            continue;
          const y = g.world.terrain(x, z).h + 1;
          if (!safeTitanSite(g, x, y, z)) continue;
          r.portal = {
            id: `wyvern:${g.world.seedInt}:${a},${b}:${++r.serial}`,
            x,
            y,
            z,
            cell,
          };
          g.save().catch((error) =>
            g.ui.toast("Portal save failed: " + error.message),
          );
          g.ui.toast("A Wyvern portal appeared.");
          return true;
        }
      }
    return false;
  }
  overworld(dt) {
    const e = this.owner,
      g = e.game;
    if (this.savedGigantoRecord) return;
    if (!g.active || g.dimension !== "overworld") {
      if (this.mesh) this.mesh.visible = false;
      this.near = false;
      return;
    }
    this.scan = (this.scan || 0) + dt;
    if (this.scan > 2) {
      this.scan = 0;
      if (g.running) this.findPortal();
    }
    const p = this.record.portal;
    this.near = false;
    if (!p) {
      if (this.mesh) this.mesh.visible = false;
      return;
    }
    if (!this.mesh) {
      this.mesh = titanPortal();
      this.mesh.name = "Wyvern portal";
      this.mesh.traverse((o) => {
        if (o.material?.color) o.material.color.set("#ea9d52");
        if (o.material?.emissive) o.material.emissive.set("#c1373e");
        if (o.isPointLight) o.color.set("#ff8744");
      });
      g.renderer.scene.add(this.mesh);
    }
    this.mesh.position.set(p.x + 0.5, p.y, p.z + 0.5);
    this.mesh.rotation.y = g.elapsed * 0.14;
    animateTitanPortal(
      this.mesh,
      g.elapsed,
      this.record.config.particles,
      this.record.config.lighting,
    );
    this.mesh.visible = Math.hypot(g.player.x - p.x, g.player.z - p.z) < 110;
    const d = Math.hypot(g.player.x - p.x, g.player.y - p.y, g.player.z - p.z);
    this.near =
      d < 3.6 &&
      this.record.config.enabled &&
      g.tickCount >= this.record.cooldownUntil;
    if (
      this.near &&
      (!e.nearPortal ||
        d <
          Math.hypot(
            g.player.x - (e.record.portal?.x ?? 1e8),
            g.player.z - (e.record.portal?.z ?? 1e8),
          ))
    ) {
      e.nearWyvernPortal = true;
      e.nearPortal = true;
      e.prompt.hidden = g.ui.screen !== "play";
      e.prompt.textContent = "E · Enter Wyvern portal";
    } else e.nearWyvernPortal = false;
  }
  menu() {
    const e = this.owner,
      root = e.game.ui.overlay;
    if (e.session?.titan === "wyvern") {
      for (const k of [
        "aggression",
        "sceneryDetail",
        "weatherEffects",
        "speedTrails",
        "lighting",
        "motionBlur",
        "ambientOcclusion",
        "liveReflections",
        "groundEffects",
        "arenaWeather",
        "bossMobility",
        "adaptiveBoss",
        "climbMode",
        "titanScale",
        "colossalScale",
        "cinematicPace",
        "arenaDayLength",
      ])
        root
          .querySelector(`[data-titan-config="${k}"]`)
          ?.closest("label")
          ?.remove();
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        n.data = n.data
          .replace(/Giganto/g, "Wyvern")
          .replace(/GIGANTO/g, "WYVERN")
          .replace(/Undefeatable/g, "Arena score");
      }
    } else if (!e.active && e.game.mode === "creative") {
      const b = document.createElement("button");
      b.dataset.wyvern = "summon";
      b.textContent = "Find Wyvern portal";
      b.className = "primary";
      root.querySelector(".titan-settings")?.append(b);
    }
  }
  frame(dt) {
    const e = this.owner,
      g = e.game,
      s = e.session;
    if (!s) return;
    g.elapsed -= dt;
    g.audio.music?.silence();
    e.prompt.hidden = true;
    e.hud.hidden = g.ui.screen !== "play";
    if (!e.view?.assetsReady) {
      e.hud.querySelector("#titan-objective").textContent = e.view?.assetError
        ? "Arena unavailable"
        : "Loading arena…";
      return;
    }
    const playing =
      g.running && g.ui.screen === "play" && !e.closing && !e.pending;
    e.audio.frame(s, playing);
    if (playing) {
      e.accumulator = (e.accumulator || 0) + dt;
      const events = [];
      while (e.accumulator >= 1 / 60) {
        const physical = e.controls,
          k = new Set([
            ...physical,
            ...(g.controller?.arenaKeys || []),
            ...(g.touch?.active ? g.touch.keys : []),
          ]),
          move = touchMovement(g);
        stepWyvern(
          s,
          {
            ...(move
              ? {
                  moveX: +physical.has("KeyD") - +physical.has("KeyA") + move.x,
                  moveY: +physical.has("KeyW") - +physical.has("KeyS") - move.y,
                }
              : {}),
            forward: k.has("KeyW"),
            back: k.has("KeyS"),
            left: k.has("KeyA"),
            right: k.has("KeyD"),
            boost: k.has("ShiftLeft") || k.has("ShiftRight"),
            up: k.has("Space"),
            down: k.has("ControlLeft") || k.has("ControlRight"),
            parry: k.has("Mouse2"),
            hit: k.has("Mouse0"),
            cyloop: k.has("KeyC"),
          },
          1 / 60,
        );
        events.push(...s.events);
        e.accumulator -= 1 / 60;
      }
      for (const event of events) {
        e.view.event(event, s);
        e.audio.event(event);
        if (["stage", "checkpoint", "emerald", "qte-win"].includes(event.type))
          e.checkpointSave = true;
        if (["impact", "parry", "hit"].includes(event.type))
          g.controller?.rumble(event.type === "impact" ? 0.65 : 0.18, 100);
      }
      if (e.checkpointSave || s.time - (e.lastSave || 0) > 15) {
        e.checkpointSave = false;
        e.lastSave = s.time;
        g.save().catch((error) =>
          g.ui.toast("Arena save failed: " + error.message),
        );
      }
      e.renderResultIfNeeded();
      if (titanReturnReady(s) && !e.closing) e.exit();
    }
    e.transition.style.transition = "none";
    e.transition.style.opacity = s.returnPortal?.crossed
      ? Math.min(1, s.returnPortal.fade / TITAN_RETURN.fade)
      : 0;
    e.audio.syncBoost(s,playing);
    e.view.draw(s, playing ? dt : 0);
    this.updateHUD();
  }
  updateHUD() {
    const e = this.owner,
      s = e.session,
      w = s.wyvern,
      q = (id) => e.hud.querySelector(id);
    updateTitanHudExtras(e.hud, s, e.view, e.game.controller);
    q(".stat-e small").textContent = "PARRY";
    q("#titan-stat-guard").textContent = w.parrySlow>0 ? "COUNTER" :
      s.parryHeld ? (w.parryUsed || s.parryAge>wyvernParryWindow(s) ? "RELEASE" : "READY") : "READY";
    q(".titan-title").textContent = "WYVERN";
    q("#titan-phase-banner").textContent =
      s.stage === "victory" && s.stageTime < 3
        ? "WYVERN DEFEATED"
        : s.stage === "phase"
          ? "PHASE II"
          : s.stage === "transform"
            ? "SUPER SONIC"
            : "";
    q(".titan-health i").style.width = `${(100 * s.hp) / s.maxHp}%`;
    q(".titan-health").setAttribute("aria-label", "Wyvern health");
    q(".titan-health").setAttribute(
      "aria-valuenow",
      Math.round((100 * s.hp) / s.maxHp),
    );
    q("#titan-phase").textContent = s.emerald
      ? `PHASE ${s.phase}`
      : "ARES APPROACH";
    q("#titan-rings").textContent = Math.ceil(s.rings)
      .toString()
      .padStart(3, "0");

    const titles = {
      intro: "WYVERN",
      traversal:
        w.section === "tower"
          ? "Climb the tower"
          : w.section === "boarding"
            ? "Board Wyvern"
            : w.section === "runway"
              ? "Chase Wyvern"
              : "Claim the Emerald",
      transform: "SUPER SONIC",
      combat: w.open > 0 ? "Attack Wyvern" : "Chase Wyvern",
      phase: "SECOND PHASE",
      "wyvern-volley": "MISSILE BARRAGE",
      "wyvern-slam": "GRAND SLAM",
      "wyvern-dive": "COMET DIVE",
      "wyvern-mouth": "HOLD THE JAWS",
      "wyvern-hold": "HOLD ON",
      "wyvern-launch": "COUNTER",
      "wyvern-counter": "GRAND SLAM",
      "wyvern-barrage": "MISSILE BARRAGE",
      "wyvern-missile": "FINISH IT",
      finale: "BREAK THROUGH",
      victory: "Return to Overworld",
      defeat: "OUT OF RINGS",
    };
    q("#titan-objective").textContent = titles[s.stage] || "Wyvern";
    q("#titan-detail").textContent =
      s.stage === "traversal"
        ? w.section === "tower"
          ? w.tower > 176
            ? "X · Jump to Wyvern"
            : "Climb the tower · Shift · Wall run · C · Cyloop"
          : w.section === "runway"
            ? "WASD · Move   Shift · Boost   Space · Jump   Tab · Assist"
            : "Collect the Emerald"
        : s.stage === "combat"
          ? w.open > 0
            ? "Combo attacks · E · Quick Cyloop"
            : w.mode === "bite"
              ? "RMB · Parry the bite"
              : w.mode === "claws"
                ? s.phase === 2
                  ? "RMB · Parry both claw strikes"
                  : "RMB · Parry the claw"
                : "Shift · Chase Wyvern   RMB · Parry   X · Homing Attack"
          : "";
    const parrySoon = s.stage === "combat" && !w.open &&
      (w.missiles.some(m=>!m.reflected && m.eta-m.age<0.28) ||
       (["claws","bite"].includes(w.mode) && w.timer<0.28));
    q("#titan-tell").textContent = parrySoon ? "PARRY" :
      s.stage === "combat"
        ? w.open > 0
          ? "VULNERABLE"
          : w.mode === "bite"
            ? "BITE"
            : w.mode === "claws"
              ? w.slash
                ? "SECOND STRIKE"
                : "CLAW STRIKE"
              : w.lasers.length
                ? "ENERGY RINGS · MOVE ASIDE"
                : "MISSILES INBOUND"
        : "";
    const cinematic =
      [
        "intro",
        "transform",
        "phase",
        "wyvern-slam",
        "wyvern-counter",
        "wyvern-launch",
        "finale",
      ].includes(s.stage) || !!s.qte;
    e.hud.classList.toggle("cinematic", cinematic);
    e.hud.classList.toggle("combat", s.stage === "combat");
    e.hud.classList.toggle("victorious", s.stage === "victory");
    e.hud.classList.toggle("no-letterbox", s.config.cinematicBars === false);
    e.hud.dataset.encounter = "wyvern";
    const marker = e.view.targetScreen,
      ret = q("#titan-reticle");
    ret.hidden = !(marker?.visible && s.lock && s.stage === "combat");
    if (marker) {
      ret.style.left = `${marker.x * 100}%`;
      ret.style.top = `${marker.y * 100}%`;
    }
    const qt = q("#titan-qte");
    qt.hidden = !s.qte;
    qt.classList.toggle("wyvern-timing", s.qte?.kind === "timing");
    if (s.qte) {
      qt.querySelector(".titan-qte-key").textContent = "LMB";
      qt.querySelector("b").textContent =
        s.qte.kind === "timing" ? "STRIKE" : "PUSH";
      qt.querySelector("progress").value = s.qte.hits / s.qte.need;
      qt.querySelector("div").textContent =
        s.qte.kind === "timing" ? "LMB · Strike" : "LMB · Mash";
      qt.querySelector(".qte-time").style.transform =
        `scale(${s.qte.kind === "timing" ? 1 - (s.qte.age % WYVERN_QTE.period) / WYVERN_QTE.period : 1})`;
      qt.querySelector(".qte-effort").style.transform =
        s.qte.kind === "timing"
          ? `scale(${wyvernQteTargetScale(Number(qt.querySelector(".qte-time").getAttribute("r")), Number(qt.querySelector(".qte-effort").getAttribute("r")))})`
          : "";
    }
    let flash = q(".wyvern-flash");
    if (!flash) {
      flash = document.createElement("div");
      flash.className = "wyvern-flash";
      e.hud.append(flash);
    }
    const burst =
      s.stage === "finale"
        ? Math.max(0, 1 - Math.abs(s.stageTime - WYVERN_CINEMA.detonate) / 0.5)
        : 0;
    flash.style.opacity = String(burst * 0.75);
    q("#titan-controls").textContent = "H · Controls   ESC · Pause";
    q("#titan-help h2 small").textContent = "H · Close";
    e.game.prompts && (e.game.prompts.dirty = true);
    e.game.prompts?.frame();
  }
}
