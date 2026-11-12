import { recordTitanAchievement, preserveAchievements } from "./achievements.js";
import {
  WyvernIntegration,
  restoreWyvernRecord,
} from "./wyvern-integration.js";
import { WyvernView } from "./wyvern-view.js";
import { WyvernAudio } from "./wyvern-audio.js";
import {
  wyvernSession,
  restoreWyvernSession,
  wyvernInput,
} from "./wyvern-simulation.js";
import { prepareWyvernModels } from "./wyvern-model.js";
import "./wyvern.css";
import { padGlyph } from "./controller-data.js";
import { touchMovement } from "./touch-data.js";
import { arenaControllerGuide } from "./controller-ui.js";
import {
  activateTitanTab,
  navigateTitanMenu,
  titanPausePanel,
  titanDefeatPanel,
} from "./titan-interface.js";
import { upgradeTitanCombat } from "./titan-balance.js";
import {
  openTitanReturn,
  titanReturnReady,
  resetTitanReturn,
  TITAN_RETURN,
} from "./titan-return.js";
import { lockTitanCinematics } from "./titan-finale.js";
import { titanSweepPrompt } from "./titan-sweep.js";
import { armorMode, armorAttached } from "./titan-climb.js";
import { titanCheckpointEvent } from "./titan-cinematics.js";
import { alignTitanCinematic, ageTitanEvents } from "./titan-timing.js";
import { titanHudTemplate, updateTitanHudExtras } from "./titan-hud.js";
import { prepareTitanModels } from "./titan-imports.js";
import { playWorldSound } from "./spatial-audio.js";
import { B, BLOCKS, ITEMS, makeStack, MIN_Y, MAX_Y } from "./data.js";
import { Inventory } from "./inventory.js";
import { cloneState } from "./compat.js";
import { hash } from "./random.js";
import { awardXP } from "./equipment.js";
import { TitanView, titanPortal, animateTitanPortal } from "./giganto-view.js";
import { disposeTitanObject } from "./giganto-models.js";
import { initializeArenaSettings } from "./titan-settings.js";
import { titanSettingsPanel } from "./titan-menu.js";
import { TitanAudio } from "./giganto-audio.js";
import {
  TITAN_CUE_FIELDS,
  TITAN_SCORE_CUES,
  titanScoreCues,
  titanScoreLength,
} from "./giganto-score-timeline.js";
import {
  TITAN_ROUTE,
  TITAN_MOVES,
  TITAN_EMERALD,
  titanConfig,
  titanSession,
  restoreTitanSession,
  stepTitan,
  titanInput,
} from "./giganto-simulation.js";
import "./giganto.css";
export function freshTitanRecord() {
  return {
    schema: 1,
    config: titanConfig(),
    portal: null,
    used: [],
    ledger: [],
    serial: 0,
    cooldownUntil: 0,
    session: null,
  };
}
export function safeTitanSite(g, x, y, z) {
  if (
    g.dimension !== "overworld" ||
    ![x, y, z].every(Number.isFinite) ||
    y < MIN_Y + 2 ||
    y > MAX_Y - 6
  )
    return false;
  const w = g.world;
  if (
    (w.protectedAreas || []).some(
      (a) => Math.hypot(a.x - x, a.z - z) < (a.radius || 20) + 8,
    )
  )
    return false;
  if (
    (g.entities || []).some(
      (e) =>
        e.health > 0 &&
        Math.hypot(e.x - x, e.z - z) < 3 &&
        Math.abs(e.y - y) < 5,
    )
  )
    return false;
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      if (
        !w.chunks.has(
          `${Math.floor((x + dx) / 16)},${Math.floor((z + dz) / 16)}`,
        )
      )
        return false;
      const ground = w.get(x + dx, y - 1, z + dz),
        b = BLOCKS[ground];
      if (
        !b?.solid ||
        b.fluid ||
        (b.shape && b.shape !== "cube") ||
        /leaves|log|cactus|bed|chest|magma/.test(b.key)
      )
        return false;
      for (let h = 0; h < 5; h++)
        if (w.get(x + dx, y + h, z + dz) !== B.air) return false;
    }
  return true;
}
function validOriginal(o, g) {
  return (
    o &&
    o.dimension === g.dimension &&
    o.player &&
    [o.player.x, o.player.y, o.player.z, o.player.health].every(
      Number.isFinite,
    ) &&
    o.player.y >= MIN_Y &&
    o.player.y < MAX_Y + 10 &&
    Array.isArray(o.inventory?.slots) &&
    o.inventory.slots.length === 36 &&
    [
      ...o.inventory.slots,
      ...(o.inventory.equipment || []),
      ...(o.inventory.craft || []),
      o.inventory.cursor,
      ...(o.inventory.offhand || []),
    ].every(
      (q) =>
        !q ||
        (ITEMS[q.id] &&
          Number.isInteger(q.count) &&
          q.count > 0 &&
          q.count <= ITEMS[q.id].stack),
    )
  );
}
export class GigantoEncounter {
  constructor(game) {
    this.game = game;
    this.record = freshTitanRecord();
    this.active = false;
    this.controls = new Set();
    this.audio = new TitanAudio(game);
    this.gigantoAudioClass = TitanAudio;
    this.wyvern = new WyvernIntegration(this);
    this.hud = document.createElement("div");
    this.hud.id = "titan-hud";
    this.hud.hidden = true;
    this.hud.innerHTML = titanHudTemplate();
    this.keyboardHelp = this.hud.querySelector("#titan-help div").innerHTML;
    document.querySelector("#app").append(this.hud);
    this.prompt = document.createElement("div");
    this.transition = document.createElement("div");
    this.transition.id = "titan-return-fade";
    this.transition.setAttribute("aria-hidden", "true");
    document.querySelector("#app").append(this.transition);
    this.prompt.id = "titan-portal-prompt";
    this.prompt.hidden = true;
    document.querySelector("#app").append(this.prompt);
    addEventListener(
      "keydown",
      (e) => {
        if (
          this.active &&
          game.ui.screen !== "play" &&
          navigateTitanMenu(e, game.ui.overlay)
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.menuTab =
            game.ui.overlay.querySelector(
              '[data-titan-tab][aria-selected="true"]',
            )?.dataset.titanTab || this.menuTab;
          this.audio.menu("hover");
          return;
        }
        if (
          ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName) &&
          e.code !== "Escape"
        )
          return;
        if (this.active) {
          if (game.ui.screen !== "play" && e.code !== "Escape") return;
          e.preventDefault();
          e.stopImmediatePropagation();
          this.controls.add(e.code);
          if (!e.repeat) this.key(e.code);
          return;
        }
        if (
          e.code === "KeyE" &&
          !e.repeat &&
          this.nearPortal &&
          game.running &&
          game.ui.screen === "play"
        ) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.enter();
        }
      },
      true,
    );
    addEventListener(
      "keyup",
      (e) => {
        this.controls.delete(e.code);
      },
      true,
    );
    addEventListener(
      "mousedown",
      (e) => {
        if (
          !this.active ||
          e.target !== game.renderer.gl.domElement ||
          !game.running
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        game.audio.unlock();
        if (e.button === 0) {
          this.controls.add("Mouse0");
          this.input("hit");
        }
        if (e.button === 2) this.controls.add("Mouse2");
      },
      true,
    );
    addEventListener(
      "mouseup",
      (e) => {
        this.controls.delete(`Mouse${e.button}`);
        if (this.active) {
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    addEventListener(
      "wheel",
      (e) => {
        if (this.active && e.target === game.renderer.gl.domElement) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, passive: false },
    );
    addEventListener(
      "mousemove",
      (e) => {
        if (
          this.active &&
          game.running &&
          (document.pointerLockElement === game.renderer.gl.domElement ||
            (game.pointerLockFallback &&
              e.target === game.renderer.gl.domElement))
        ) {
          // Strong manual camera movement disengages targeting; a lock never
          // overwrites the player's camera or movement yaw.
          if (Math.abs(e.movementX) > 18) this.session.lock = false;
          this.session.avatar.yaw -=
            e.movementX * this.session.config.cameraSensitivity;
          this.session.avatar.pitch = Math.max(
            -0.6,
            Math.min(
              1.1,
              this.session.avatar.pitch +
                e.movementY * this.session.config.cameraSensitivity,
            ),
          );
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    const backgroundPause = () => {
      this.controls.clear();
      if (this.active && game.running) game.pause();
    };
    addEventListener("blur", backgroundPause);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) backgroundPause();
    });
    game.ui.overlay.addEventListener("click", (e) => {
      const tab = e.target.closest("[data-titan-tab]");
      if (
        this.active &&
        tab &&
        activateTitanTab(game.ui.overlay, tab.dataset.titanTab)
      ) {
        this.menuTab = tab.dataset.titanTab;
        this.audio.menu("select");
        return;
      }
      const b = e.target.closest("[data-titan]");
      if (!b || b.disabled) return;
      game.audio.unlock();
      if (this.active)
        this.audio.menu(
          ["resume", "back", "exit", "quit"].includes(b.dataset.titan)
            ? "exit"
            : "select",
        );
      else game.audio.menu("select");
      if (this.active && b.dataset.titan === "apply-cues") {
        const cues = titanScoreCues(this.record.config.scoreCues);
        for (const [path] of TITAN_CUE_FIELDS) {
          const input = game.ui.overlay.querySelector(
            `[data-titan-cue="${path}"]`,
          );
          if (!input?.value || !input.validity.valid) {
            game.ui.toast("Enter valid cue times.");
            return;
          }
          const [section, key] = path.split(".");
          cues[section][key] = Number(input.value);
        }
        if (cues.phaseTwo.loopEnd !== TITAN_SCORE_CUES.phaseTwo.loopEnd)
          delete cues.phaseTwo.toEnd;
        const validated = titanScoreCues(cues);
        if (
          TITAN_CUE_FIELDS.some(([path]) => {
            const [section, key] = path.split(".");
            return cues[section][key] !== validated[section][key];
          })
        ) {
          game.ui.toast("Check the start and end of each loop.");
          return;
        }
        if (
          titanScoreLength(validated) >
          (this.record.config.battleTrack?.duration || 264.96)
        ) {
          game.ui.toast("Cue map extends beyond the selected track.");
          return;
        }
        this.record.config = titanConfig({
          ...this.record.config,
          scoreCues: validated,
        });
        this.session.config = cloneState(this.record.config);
        this.session.battleMusic = null;
        this.audio.prepare(this.session);
        game
          .save()
          .catch((err) =>
            game.ui.toast("Settings save failed: " + err.message),
          );
        this.menu();
        return;
      }
      if (
        this.active &&
        ["reset-track", "reset-cues"].includes(b.dataset.titan)
      ) {
        if (
          b.dataset.titan === "reset-cues" &&
          this.record.config.battleTrack &&
          this.record.config.battleTrack.duration <
            titanScoreLength(titanScoreCues())
        ) {
          game.ui.toast(
            "Choose the supplied track before resetting this cue map.",
          );
          return;
        }
        this.record.config = titanConfig({
          ...this.record.config,
          [b.dataset.titan === "reset-track" ? "battleTrack" : "scoreCues"]:
            null,
        });
        if (this.session) {
          this.session.config = cloneState(this.record.config);
          this.session.battleMusic = null;
        }
        this.audio.prepare(this.session);
        game
          .save()
          .catch((err) =>
            game.ui.toast("Settings save failed: " + err.message),
          );
        this.menu();
        return;
      }
      this.button(b.dataset.titan);
    });
    game.ui.overlay.addEventListener("change", (e) => {
      if (this.active && e.target.hasAttribute("data-titan-track")) {
        this.importBattleTrack(e.target.files?.[0]);
        return;
      }
      const damage = e.target.dataset.titanDamage;
      const k = damage ? "damage" : e.target.dataset.titanConfig;
      if (!k || (this.active && k === "climbMode")) return;
      this.record.config = titanConfig({
        ...this.record.config,
        [k]: damage
          ? { ...this.record.config.damage, [damage]: e.target.value }
          : e.target.type === "checkbox"
            ? e.target.checked
            : ["range", "number"].includes(e.target.type)
              ? Number(e.target.value)
              : e.target.value,
      });
      if (this.session) this.session.config = cloneState(this.record.config);
      if (this.active) this.audio.menu("slide");
      const output = e.target.closest("label")?.querySelector("output");
      if (output) output.textContent = e.target.value;
      game
        .save()
        .catch((err) => game.ui.toast("Settings save failed: " + err.message));
    });
  }
  get session() {
    return this.record.session;
  }
  async importBattleTrack(file) {
    if (!file || this.importingTrack || !this.active) return;
    const session = this.session;
    this.importingTrack = true;
    try {
      const result = await this.audio.musicLibrary.import(
        file,
        this.game.audio.context,
        titanScoreCues(session.config.scoreCues),
      );
      if (!this.active || this.session !== session) return;
      if (
        result.buffer.duration <
        titanScoreLength(titanScoreCues(session.config.scoreCues))
      )
        throw Error("Track is shorter than the current cue map.");
      this.record.config = titanConfig({
        ...this.record.config,
        battleTrack: result.track,
      });
      session.config = cloneState(this.record.config);
      session.battleMusic = null;
      this.audio.importedBuffer = {
        id: result.track.id,
        buffer: result.buffer,
      };
      this.audio.prepare(session);
      await this.game.save();
      this.game.ui.toast(
        result.persistent
          ? "Battle track saved."
          : "Battle track loaded for this session.",
      );
      this.menu();
    } catch (error) {
      this.game.ui.toast(error.message, 5000);
    } finally {
      this.importingTrack = false;
    }
  }
  export() {
    this.audio.score?.snapshot(this.session);
    this.audio.prelude?.snapshot(this.session);
    return this.wyvern.export();
  }
  clear() {
    this.transition.style.opacity = 0;
    this.returnSession = null;
    this.active = false;
    this.pending = false;
    this.closing = false;
    this.controls.clear();
    this.accumulator = 0;
    this.lastSave = 0;
    this.checkpointSave = false;
    this.scan = 0;
    this.nearPortal = false;
    this.view?.dispose();
    this.view = null;
    if (this.portalMesh) disposeTitanObject(this.portalMesh);
    this.portalMesh = null;
    this.record = freshTitanRecord();
    this.hud.hidden = true;
    this.prompt.hidden = true;
    document.querySelector("#app").classList.remove("titan-active");
    this.audio.silence();
    this.wyvern?.reset();
  }
  load(data) {
    if (
      data?.activeTitan === "wyvern" &&
      data.wyvern?.session?.titan === "wyvern"
    ) {
      this.load({ ...data, activeTitan: undefined, wyvern: undefined });
      const oldRecord = this.record,
        oldAudio = this.audio;
      this.load({ ...data.wyvern, activeTitan: undefined, wyvern: undefined });
      if (this.session?.titan === "wyvern") {
        this.wyvern.savedGigantoRecord = oldRecord;
        this.wyvern.savedGigantoAudio = oldAudio;
        this.wyvern.record = this.record;
      } else {
        this.load(oldRecord);
        this.wyvern.record = restoreWyvernRecord(data.wyvern);
      }
      return;
    }
    this.clear();
    if (!data || data.schema !== 1) return;
    this.record.config = titanConfig(upgradeTitanCombat(data.config));
    this.record.used = Array.isArray(data.used)
      ? data.used
          .filter((x) => typeof x === "string" && x.length < 150)
          .slice(-4096)
      : [];
    this.record.ledger = Array.isArray(data.ledger)
      ? data.ledger
          .filter((x) => typeof x === "string" && x.length < 150)
          .slice(-4096)
      : [];
    this.record.serial = Math.max(
      0,
      Math.min(1e9, Math.floor(Number(data.serial) || 0)),
    );
    this.record.cooldownUntil = Number.isFinite(data.cooldownUntil)
      ? Math.max(0, Math.min(data.cooldownUntil, this.game.tickCount + 144000))
      : 0;
    const q = data.portal;
    if (
      q &&
      typeof q.id === "string" &&
      q.id.length < 150 &&
      [q.x, q.y, q.z].every(Number.isFinite) &&
      Math.abs(q.x) <= 30000000 &&
      Math.abs(q.z) <= 30000000 &&
      q.y >= MIN_Y &&
      q.y < MAX_Y - 5
    )
      this.record.portal = {
        id: q.id,
        x: q.x,
        y: q.y,
        z: q.z,
        cell: String(q.cell || "").slice(0, 100),
      };
    this.wyvern.record = restoreWyvernRecord(data.wyvern);
    const s =
      data.session?.titan === "wyvern"
        ? restoreWyvernSession(data.session)
        : restoreTitanSession(data.session);
    if (s && validOriginal(s.original, this.game)) {
      lockTitanCinematics(s);
      initializeArenaSettings(s.config, this.game.settings);
      this.record.config = cloneState(s.config);
      this.record.session = s;
      this.active = true;
      this.silenceWorld();
      if (s.titan === "wyvern") {
        this.audio.silence();
        this.audio = new WyvernAudio(this.game);
      }
      this.audio.frame(s, false);
      this.game.player = preserveAchievements(this.game.player, cloneState(s.original.player));
      this.game.inventory = new Inventory(s.original.inventory);
      this.view =
        s.titan === "wyvern"
          ? new WyvernView(this.game)
          : new TitanView(this.game);
      document.querySelector("#app").classList.add("titan-active");
      this.renderResultIfNeeded();
    }
  }
  input(action) {
    const s = this.session;
    if (!s || this.closing || this.pending || !this.view?.assetsReady)
      return false;
    lockTitanCinematics(s);
    s.events = [];
    const result =
      s.titan === "wyvern" ? wyvernInput(s, action) : titanInput(s, action);
    for (const e of s.events) {
      this.view?.event(e, s);
      if (e.type === "hit" || e.type === "impact" || e.type === "parry")
        this.game.controller?.rumble(
          e.type === "impact" ? 0.65 : 0.22,
          e.type === "impact" ? 180 : 75,
        );
      this.audio.event(e);
      if (titanCheckpointEvent(e)) this.checkpointSave = true;
    }
    return result;
  }
  key(code) {
    this.audio.prelude?.allowPlayback();
    const g = this.game,
      s = this.session;
    if (!s || this.closing || this.pending) return;
    if (code === "Escape") {
      this.controls.clear();
      if (g.ui.screen === "play") g.pause();
      else if (g.ui.screen === "achievements") g.ui.back();
      else if (g.ui.screen === "titan-menu") this.button("back");
      else if (s.stage !== "defeat") g.resume();
      return;
    }
    if (!g.running) return;
    if (code === "KeyH") {
      this.hudHelp = !this.hudHelp;
      this.hud.classList.toggle("show-help", this.hudHelp);
      this.hud.querySelector("#titan-help").hidden = !this.hudHelp;
      return;
    }
    const actions = {
      Space: "jump",
      KeyQ: "dodge",
      KeyX: "homing",
      KeyC: "cross",
      KeyV: "shot",
      KeyZ: "stomp",
      KeyG: "spin",
      KeyB: "cyclone",
      KeyR: "boom",
      KeyF: "rush",
      KeyE: "loop",
      Tab: "target",
    };
    if (code === "KeyE" && s.stage === "traversal" && armorMode(s))
      this.input("climb");
    else if (actions[code]) this.input(actions[code]);
  }
  validPortal() {
    const p = this.record.portal;
    return p && safeTitanSite(this.game, p.x, p.y, p.z);
  }
  findPortal(force = false) {
    const g = this.game,
      r = this.record;
    if (
      r.portal ||
      r.session ||
      this.pending ||
      !g.active ||
      g.dimension !== "overworld" ||
      g.multiplayer?.connected ||
      !r.config.enabled ||
      g.tickCount < r.cooldownUntil
    )
      return false;
    const cx = Math.floor(g.player.x / 64),
      cz = Math.floor(g.player.z / 64);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const xcell = cx + dx,
          zcell = cz + dz,
          cell = `${xcell},${zcell}`;
        if (
          r.used.includes(cell) ||
          (!force &&
            hash(xcell, 71, zcell, g.world.seedInt) > r.config.spawnChance)
        )
          continue;
        for (let attempt = 0; attempt < 8; attempt++) {
          const x =
              xcell * 64 +
              10 +
              Math.floor(
                hash(xcell, 72 + attempt * 3, zcell, g.world.seedInt) * 42,
              ),
            z =
              zcell * 64 +
              10 +
              Math.floor(
                hash(xcell, 73 + attempt * 3, zcell, g.world.seedInt) * 42,
              ),
            distance = Math.hypot(x - g.player.x, z - g.player.z);
          if (distance < 14 || distance > 100) continue;
          const y = g.world.terrain(x, z).h + 1;
          if (!safeTitanSite(g, x, y, z)) continue;
          r.portal = {
            id: `${g.world.seedInt}:${cell}:${++r.serial}`,
            x,
            y,
            z,
            cell,
          };
          g.save().catch((e) => g.ui.toast("Portal save failed: " + e.message));
          g.ui.toast("A Titan portal appeared.", 6000);
          return true;
        }
      }
    return false;
  }
  overworld(dt) {
    this.overworldGiganto(dt);
    this.wyvern.overworld(dt);
  }
  overworldGiganto(dt) {
    const g = this.game;
    if (!g.active) {
      if (this.portalMesh) this.portalMesh.visible = false;
      this.prompt.hidden = true;
      return;
    }
    this.scan = (this.scan || 0) + dt;
    if (this.scan > 1) {
      this.scan = 0;
      if (g.running) this.findPortal();
    }
    const p = this.record.portal;
    if (!p || g.dimension !== "overworld") {
      if (this.portalMesh) this.portalMesh.visible = false;
      this.nearPortal = false;
      this.prompt.hidden = true;
      return;
    }
    if (!this.portalMesh) {
      this.portalMesh = titanPortal();
      g.renderer.scene.add(this.portalMesh);
    }
    const m = this.portalMesh;
    m.position.set(p.x + 0.5, p.y, p.z + 0.5);
    m.rotation.y = g.elapsed * 0.2;
    animateTitanPortal(
      m,
      g.elapsed,
      this.record.config.particles,
      this.record.config.lighting,
    );
    const portalDistance = Math.hypot(
      g.player.x - p.x,
      g.player.y - p.y,
      g.player.z - p.z,
    );
    if (
      this.record.config.audio &&
      g.running &&
      portalDistance < 12 &&
      g.elapsed - (this.lastPortalTone ?? -100) > 8
    ) {
      this.lastPortalTone = g.elapsed;
      playWorldSound(g, "rune", { x: p.x + 0.5, y: p.y + 2, z: p.z + 0.5 });
    }
    m.userData.inner.rotation.z = -g.elapsed * 0.25;
    m.userData.light.visible = this.record.config.lighting;
    m.visible = Math.hypot(g.player.x - p.x, g.player.z - p.z) < 100;
    m.userData.ring.visible = this.record.config.particles;
    this.nearPortal =
      m.visible &&
      Math.hypot(
        g.player.x - p.x - 0.5,
        g.player.y - p.y,
        g.player.z - p.z - 0.5,
      ) < 3.6;
    this.prompt.hidden =
      !this.nearPortal || !this.record.config.enabled || g.ui.screen !== "play";
    if (!this.prompt.hidden) this.prompt.textContent = "[E] ENTER TITAN SIGNAL";
  }
  async enter() {
    if (this.nearWyvernPortal && !this.active && !this.pending) {
      this.wyvern.select();
      const entered = await this.enter();
      if (!entered) this.wyvern.finish();
      return entered;
    }
    const g = this.game,
      r = this.record;
    if (
      this.pending ||
      this.active ||
      !g.active ||
      !r.config.enabled ||
      !g.running ||
      g.player.health <= 0 ||
      !g.player.onGround
    )
      return false;
    if (g.multiplayer?.connected || g.multiplayer?.isGuest) {
      g.ui.toast("Leave multiplayer to enter.");
      return false;
    }
    if (
      !this.nearPortal ||
      !this.validPortal() ||
      g.tickCount < r.cooldownUntil
    ) {
      g.ui.toast(
        "The portal needs clear, solid ground and an unobstructed entrance.",
      );
      return false;
    }
    this.pending = true;
    try {
      await (this.wyvern.savedGigantoRecord
        ? prepareWyvernModels()
        : prepareTitanModels());
      if (
        this.record !== r ||
        !g.active ||
        !g.running ||
        g.player.health <= 0 ||
        !g.player.onGround ||
        !this.nearPortal ||
        !this.validPortal() ||
        g.multiplayer?.connected
      )
        return false;
      if (g.saving) await g.saving;
      const original = {
        player: cloneState(g.player),
        inventory: g.inventory.export(),
        dimension: g.dimension,
        cameraMode: g.cameraMode,
      };
      initializeArenaSettings(r.config, g.settings);
      r.session = lockTitanCinematics(
        (this.wyvern.savedGigantoRecord ? wyvernSession : titanSession)(
          { ...r.config, cinematics: true },
          r.portal.id,
        ),
      );
      r.session.original = original;
      this.active = true;
      g.resetControls();
      this.silenceWorld();
      this.prompt.hidden = true;
      if (this.portalMesh) this.portalMesh.visible = false;
      this.view =
        r.session.titan === "wyvern" ? new WyvernView(g) : new TitanView(g);
      this.audio.frame(r.session, false);
      document.querySelector("#app").classList.add("titan-active");
      await g.save();
      // Initial intro is committed here, before the simulation emits transitions.
      recordTitanAchievement(g, r.session, { type: "stage", stage: "intro" });
      this.accumulator = 0;
      this.lastSave = 0;
      return true;
    } catch (e) {
      this.active = false;
      this.audio.silence();
      r.session = null;
      this.view?.dispose();
      this.view = null;
      document.querySelector("#app").classList.remove("titan-active");
      g.ui.toast("Could not save the return checkpoint: " + e.message, 7000);
      return false;
    } finally {
      this.pending = false;
    }
  }
  silenceWorld() {
    const g = this.game;
    g.audio.silenceAmbient();
    g.audio.music?.silence();
    for (const fanfare of [g.audio.claimFanfare, g.audio.pistolClaimFanfare]) {
      try {
        fanfare?.source?.stop();
      } catch {}
    }
    const j = g.jukebox;
    if (j?.audio && j.state === "playing") {
      j.audio.pause();
      j.state = "menu-paused";
      j.autoResume = true;
    }
  }
  frame(dt) {
    const g = this.game,
      s = this.session;
    if (!s) return;
    if (s.titan === "wyvern") return this.wyvern.frame(dt);
    lockTitanCinematics(s);
    g.elapsed -= dt;
    g.audio.music?.silence();
    this.prompt.hidden = true;
    this.hud.hidden = g.ui.screen !== "play";
    if (!this.view?.assetsReady) {
      const obj = this.hud.querySelector("#titan-objective"),
        detail = this.hud.querySelector("#titan-detail");
      obj.textContent = this.view?.assetError
        ? "Arena unavailable"
        : "Loading arena…";
      detail.textContent = this.view?.assetError
        ? "Press Escape to leave."
        : "";
      return;
    }
    if (g.running && g.ui.screen === "play" && !this.closing && !this.pending) {
      // Restore the audio transport before a resumed simulation can emit its
      // first contact. Otherwise the paused event gate drops that frame's hit.
      if (this.audio.playing === false) this.audio.frame(s, true);
      this.accumulator = (this.accumulator || 0) + dt;
      alignTitanCinematic(
        s,
        this.audio.score,
        Math.floor((this.accumulator + 1e-9) * 60) / 60,
      );
      const events = [];
      while (this.accumulator >= 1 / 60) {
        const pad = this.game.controller,
          physical = this.controls,
          k = new Set([
            ...physical,
            ...(pad?.arenaKeys || []),
            ...(g.touch?.active ? g.touch.keys : []),
          ]),
          move = touchMovement(g);
        stepTitan(
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
        this.accumulator -= 1 / 60;
      }
      this.audio.syncBoost(s,true);
      // Deliver once after catch-up, against the same pose the next frame draws.
      for (const e of ageTitanEvents(s, events)) {
        recordTitanAchievement(g,s,e);
        this.view.event(e, s);
        this.audio.event(e);
        if (titanCheckpointEvent(e)) this.checkpointSave = true;
      }
      if (this.checkpointSave || s.time - (this.lastSave || 0) > 15) {
        this.checkpointSave = false;
        this.lastSave = s.time;
        g.save().catch((e) => g.ui.toast("Arena save failed: " + e.message));
      }
      this.renderResultIfNeeded();
      if (titanReturnReady(s) && !this.closing) this.exit();
    }
    this.transition.style.transition = "none";
    this.transition.style.opacity = s.returnPortal?.crossed
      ? Math.min(1, s.returnPortal.fade / TITAN_RETURN.fade)
      : 0;
    this.audio.frame(s, g.running && g.ui.screen === "play");
    this.view?.draw(s, g.running ? dt : 0);
    this.updateHUD();
  }
  updateHUD() {
    const s = this.session;
    if (!s) return;
    if (s.titan === "wyvern") return this.wyvern.updateHUD();
    this.hud.dataset.encounter = "giganto";
    this.hud.querySelector(".titan-title").textContent = "GIGANTO";
    this.hud
      .querySelector(".titan-health")
      .setAttribute("aria-label", "Giganto health");
    this.hud.querySelector("#titan-qte").classList.remove("wyvern-timing");
    this.hud.querySelector(".qte-time").style.transform = "";
    this.hud.querySelector(".qte-effort").style.transform = "";
    const q = (id) => this.hud.querySelector(id);
    updateTitanHudExtras(this.hud, s, this.view, this.game.controller);
    const marker = this.view?.targetScreen,
      reticle = q("#titan-reticle");
    reticle.hidden = !(
      marker?.visible &&
      s.lock &&
      s.emerald &&
      s.stage === "combat" &&
      !s.qte &&
      !s.counterScene
    );
    if (marker) {
      reticle.style.left = `${marker.x * 100}%`;
      reticle.style.top = `${marker.y * 100}%`;
    }
    q(".titan-health i").style.width = `${(s.hp / s.maxHp) * 100}%`;
    q(".titan-health").setAttribute(
      "aria-valuenow",
      Math.round((s.hp / s.maxHp) * 100),
    );
    q("#titan-phase").textContent = s.emerald
      ? `PHASE ${s.phase}`
      : "TITAN APPROACH";
    q("#titan-rings").textContent = Math.ceil(Math.max(0, s.rings))
      .toString()
      .padStart(3, "0");

    const victorious = s.stage === "victory";
    this.hud.classList.toggle("victorious", victorious);
    const cinematic =
        !!s.counterScene ||
        ["intro", "transform", "phase", "finale"].includes(s.stage),
      next = TITAN_ROUTE[s.route + 1];
    q("#titan-objective").textContent = victorious
      ? "Return to Overworld"
      : s.stage === "traversal"
        ? s.route === 0 && s.rings < Math.min(250, s.config.rings)
          ? "Gather rings"
          : armorMode(s)
            ? "Collect the Emerald"
            : "Collect the Emerald"
        : s.stage === "transform"
          ? "ALL SEVEN · SUPER SONIC"
          : s.stage === "phase"
            ? "SECOND PHASE"
            : s.stage === "finale"
              ? "FINISHING STRIKE"
              : s.emerald
                ? "Defeat Giganto"
                : "Giganto";
    q("#titan-detail").textContent = victorious
      ? ""
      : s.stage === "traversal"
        ? armorMode(s)
          ? armorAttached(s)
            ? "W / S · Up / Down   A / D · Traverse   Shift · Boost   Space · Jump   E · Release"
            : s.grassCyloop?.points.length > 1
              ? "Close the loop"
              : s.grassCyloop?.drops.length
                ? "Collect the rings"
                : "Hold C and circle the grass for rings · W against a foot to climb"
          : `Ring trails surround the basin · Ascent ${s.route}/12${s.route === 0 ? " · Gather before climbing" : ""}`
        : s.emerald
          ? ""
          : "Collect the final Emerald.";
    q("#titan-tell").textContent = victorious
      ? ""
      : s.counterScene
        ? "COUNTERATTACK"
        : s.stage === "combat" && s.tactics?.guard > 0
          ? "GUARD · FLANK OR COUNTER"
          : s.stage === "traversal" &&
              s.avatar.z < -12 &&
              s.time % 6 > 3 &&
              s.time % 6 < 4.5
            ? "DORSAL PULSE · WAIT OR BOOST PAST"
            : s.attack !== "idle" && !s.qte
              ? s.attack === "sweep"
                ? titanSweepPrompt(s)
                : TITAN_MOVES[s.attack]?.label || ""
              : [
                    "boom",
                    "rush",
                    "loop",
                    "counter",
                    "cross",
                    "homing",
                    "shot",
                  ].includes(s.action) && s.actionTime > 0
                ? {
                    homing: "HOMING ATTACK",
                    shot: "HOMING SHOT",
                    cross: "CROSS SLASH",
                    boom: "SONIC BOOM",
                    rush: "WILD RUSH",
                    loop: "QUICK CYLOOP",
                    counter: "GRAND SLAM",
                  }[s.action]
                : s.counter > 0
                  ? "LEFT CLICK · GRAND SLAM COUNTER"
                  : s.qte
                    ? ""
                    : s.attack !== "idle"
                      ? s.attack === "sweep"
                        ? titanSweepPrompt(s)
                        : TITAN_MOVES[s.attack]?.label || ""
                      : s.boss?.walk
                        ? ""
                        : s.stagger > 0
                          ? "STAGGERED · ATTACK NOW"
                          : "";
    const qt = q("#titan-qte");
    qt.hidden = !s.qte;
    if (s.qte) {
      qt.querySelector("b").textContent =
        s.qte.kind === "beam" ? "DEFLECT THE BEAM" : "BREAK THE GRAB";
      qt.querySelector("progress").value = s.qte.hits / s.qte.need;
      qt.querySelector("div").textContent = "Tap SPACE or LMB";
    }
    this.hud.classList.toggle("cinematic", cinematic);
    this.hud.classList.toggle("no-letterbox", s.config.cinematicBars === false);
    if (q("#titan-help").dataset.padGuide) {
      q("#titan-help div").innerHTML = this.keyboardHelp;
      delete q("#titan-help").dataset.padGuide;
    }
    q("#titan-help h2 small").textContent = "H · Close";
    q("#titan-controls").textContent = cinematic
      ? "ESC · Pause"
      : `${this.hudHelp ? "H · Close controls" : "H · Controls"}   ESC · Pause`;
    if (this.game.prompts) this.game.prompts.dirty = true;
    this.game.prompts?.frame();
  }
  renderResultIfNeeded() {
    const s = this.session;
    if (s?.stage === "victory") {
      openTitanReturn(s);
      if (this.returnSession !== s) {
        this.controls.clear();
        this.returnSession = s;
      }
      if (this.game.ui.screen === "titan-result") {
        this.game.ui.play();
        this.game.running = true;
      }
      return;
    }
    if (
      !s ||
      !["victory", "defeat"].includes(s.stage) ||
      this.game.ui.screen === "titan-result"
    )
      return;
    const g = this.game;
    g.running = false;
    this.controls.clear();
    document.exitPointerLock?.();
    g.ui.setScreen("titan-result", titanDefeatPanel());
    if (s.titan === "wyvern") this.wyvern.menu();
    g.ui.overlay
      .querySelector('[data-titan="retry"]')
      ?.focus({ preventScroll: true });
  }
  pauseMenu() {
    this.audio.pause(this.session);
    const g = this.game;
    g.running = false;
    this.controls.clear();
    document.exitPointerLock?.();
    g.ui.setScreen("pause", titanPausePanel(this.session));
    if (this.session?.titan === "wyvern") this.wyvern.menu();
    g.ui.overlay
      .querySelector('[data-titan="resume"]')
      ?.focus({ preventScroll: true });
  }
  menu() {
    const g = this.game,
      c = this.record.config,
      p = this.record.portal;
    if (this.active) {
      g.running = false;
      this.controls.clear();
      document.exitPointerLock?.();
    }
    if (this.active) this.audio.pause(this.session);
    initializeArenaSettings(c, g.settings);
    g.ui.setScreen(
      "titan-menu",
      titanSettingsPanel(c, this.active, {
        tab: this.menuTab,
        controllerGuide:
          this.game.controller?.lastDevice === "controller"
            ? arenaControllerGuide(this.game.controller.family, this.game)
            : null,
        skyLocked: this.session?.won === true,
        portal: p,
        cooldown: Math.max(
          0,
          Math.ceil((this.record.cooldownUntil - g.tickCount) / 20),
        ),
        sigils: this.record.ledger.length,
        creative: g.mode === "creative",
      }),
    );
    this.wyvern.menu();
    if (this.active)
      g.ui.overlay
        .querySelector('[data-titan-tab][aria-selected="true"]')
        ?.focus({ preventScroll: true });
  }
  async button(action) {
    if (this.closing || this.pending) return;
    const g = this.game;
    if (action === "resume") {
      this.controls.clear();
      g.resume();
    }
    if (action === "menu") this.menu();
    if (action === "back") {
      if (this.active && this.session.stage === "defeat") {
        g.ui.screen = "titan-menu";
        this.renderResultIfNeeded();
      } else if (this.active) this.pauseMenu();
      else g.ui.pause();
    }
    if (action === "retry") {
      this.session?.titan === "wyvern"
        ? wyvernInput(this.session, "retry")
        : titanInput(this.session, "retry");
      this.controls.clear();
      g.resume();
      g.save().catch((e) => g.ui.toast(e.message));
    }
    if (action === "summon") {
      if (g.mode === "creative") {
        g.ui.toast(
          this.findPortal(true) ? "Portal located." : "No portal nearby.",
        );
        this.menu();
      }
    }
    if (action === "exit" && !this.session?.won) await this.exit();
    if (action === "quit") {
      g.running = false;
      try {
        await g.save();
        this.active = false;
        this.transition.style.opacity = 0;
        this.returnSession = null;
        this.audio.silence();
        this.view?.dispose();
        this.view = null;
        this.hud.hidden = true;
        document.querySelector("#app").classList.remove("titan-active");
        g.active = false;
        document.exitPointerLock?.();
        g.ui.title();
      } catch (e) {
        g.ui.toast("Checkpoint save failed: " + e.message);
      }
    }
  }
  async exit() {
    const g = this.game,
      r = this.record,
      s = this.session;
    if (!s || this.closing || (s.won && !titanReturnReady(s))) return false;
    this.closing = true;
    g.running = false;
    this.controls.clear();
    this.audio.pause(s);
    try {
      if (g.saving) await g.saving;
      const old = {
        player: g.player,
        inventory: g.inventory,
        drops: g.drops.slice(),
        record: cloneState(r),
        cameraMode: g.cameraMode,
      };
      try {
        g.player = preserveAchievements(g.player, cloneState(s.original.player));
        g.inventory = new Inventory(s.original.inventory);
        g.cameraMode = s.original.cameraMode || 0;
        g.mouseDown = g.rightMouseDown = false;
        delete g.player.editionDraw;
        g.player.shieldRaised = false;
        g.player.vx = g.player.vy = g.player.vz = 0;
        if (s.won && !r.ledger.includes(s.id)) {
          r.ledger.push(s.id);
          for (const [id, count] of [
            ["diamond", 6],
            ["hellfire_ingot", 8],
          ]) {
            const left = g.inventory.add(makeStack(id, count));
            if (left)
              g.drops.push({
                uid: `titan:${s.id}:${id}`,
                id,
                count: left,
                x: g.player.x,
                y: g.player.y + 0.4,
                z: g.player.z,
                vx: 0,
                vy: 0,
                vz: 0,
                age: 0,
                delay: 10,
              });
          }
          awardXP(g, 100);
        }
        if (r.portal) {
          r.used.push(r.portal.cell);
          r.portal = null;
        }
        r.cooldownUntil = g.tickCount + Math.round(r.config.cooldown * 20);
        r.session = null;
        await g.save();
      } catch (e) {
        g.player = old.player;
        g.inventory = old.inventory;
        g.drops = old.drops;
        this.record = old.record;
        g.cameraMode = old.cameraMode;
        throw e;
      }
      this.active = false;
      this.view?.dispose();
      this.view = null;
      this.hud.hidden = true;
      if (this.portalMesh) disposeTitanObject(this.portalMesh);
      this.portalMesh = null;
      this.audio.silence();
      if (s.titan === "wyvern") this.wyvern.finish();
      document.querySelector("#app").classList.remove("titan-active");
      g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
      g.ui.play();
      g.resume();
      this.transition.style.transition = "opacity .4s ease";
      this.transition.style.opacity = 0;
      g.ui.toast(
        s.won ? "Titan Sigil earned." : "Returned to your world.",
        7000,
      );
      return true;
    } catch (e) {
      console.error("Arena return save failed", e);
      resetTitanReturn(this.session);
      this.transition.style.opacity = 0;
      g.ui.toast("Couldn’t save. Enter the portal to retry.", 6000);
      if (this.session?.won) {
        g.ui.play();
        g.resume();
      }
      return false;
    } finally {
      this.closing = false;
    }
  }
}
