import "./java-menus.css";
import { ControllerInput } from "./controller.js";
import { controllerConfig } from "./controller-data.js";
import { TouchInput } from "./touch.js";
import { PocketTouchInput } from "./pocket-touch.js";
import { touchConfig, isTouchDevice, MOBILE_DEFAULTS } from "./touch-data.js";
import { InputPrompts } from "./input-prompts.js";
import { installMobileApp } from "./mobile-app.js";
import { GigantoEncounter } from "./giganto.js";
import { restoreEmbeddedArrows } from "./embedded-arrows.js";
import { playWorldSound } from "./spatial-audio.js";
import { releaseEditionWeapon } from "./edition-combat.js";
import { useEdition, placeEdition } from "./edition-interactions.js";
import { useLivestock } from "./livestock.js";
import { farmScale } from "./livestock-data.js";
import { blockHarvest } from "./harvest.js";
import { playerEye } from "./player-body.js";
import { useAquatic, releaseTrident } from "./aquatic-gear.js";
import { awardXP } from "./equipment.js";
import {
  canOpenChest,
  validateLocalContainerMenu,
} from "./world-interactions.js";
import { tickPalm } from "./devils-palm.js";
import { useBoat, boatInReach, leaveBoat } from "./boats.js";
import { deflectFireball } from "./cinder-flight.js";
import { activateStand, standLocked } from "./stand-abilities.js";
import { standBindings } from "./stands-data.js";
import { useSpawnEgg } from "./spawn-eggs.js";
import { activeTrial, respawnInTrial, useTrialExit } from "./rift-trial.js";
import { ChatSystem } from "./chat.js";
import { Jukebox } from "./jukebox.js";
import {
  firePistols,
  holdsPistols,
  pistolUsesStyle,
  tricksterMove,
  updateTrickster,
} from "./matthew.js";
import { claimPistols } from "./invasion.js";
import { useBucket, useFlintAndSteel } from "./block-actions.js";
import { fluid, isWater } from "./block-dynamics.js";
import { upgradeNightEnemies } from "./hostile-combat.js";
import { Multiplayer } from "./multiplayer.js";
import { launchSeeker } from "./seeker.js";
import { restoreWeather, setWeather } from "./weather.js";
import { SKINS } from "./skins.js";
import { frameDue, effectiveFrameLimit, VIDEO_CHOICES } from "./graphics.js";
import {
  extractRelic,
  resetExtraction,
  relicSite,
  attuneTemple,
} from "./relic.js";
import { infernalLootBlocked } from "./infernal-encounters.js";
import { reduceDamage, equipHeld } from "./equipment.js";
import { doorAt, removeDoor, placeDoor, setDoorOpen } from "./doors.js";
import {
  travel,
  selectRealm,
  realmState,
  exportRealm,
  restoreRealm,
} from "./realms.js";
import { uniqueId, cloneState } from "./compat.js";
import * as THREE from "three";
import "./style.css";
import "./pixel-ui.css";
import "./stand-ui.css";
import { World, coordKey } from "./world.js";
import { Renderer } from "./renderer.js";
import { Inventory, miningTicks, canHarvest } from "./inventory.js";
import {
  B,
  MAX_Y,
  BLOCKS,
  ITEMS,
  DEFAULT_SETTINGS,
  makeStack,
  RECIPES,
  CYCLE_TEXT,
  HOSTILE_TYPES,
  MOB_INFO,
} from "./data.js";
import { createPlayer, updatePlayer, intersectsBlock } from "./physics.js";
import { SprintInput, hasMovement } from "./controls.js";
import {
  tickSurvival,
  damageEntity,
  seedCreatures,
  dropItem,
  hitEntity,
  devinPulse,
  interactContainer,
} from "./simulation.js";
import { SaveStore } from "./storage.js";
import { saveGame } from "./save-session.js";
import "./save-status.css";
import { AudioEngine } from "./audio.js";
import { UI } from "./ui.js";
function readSettings() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("dcsmcraft-settings") || "{}");
  } catch {
    /* Recover from a malformed preferences record. */
  }
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  const result = { ...DEFAULT_SETTINGS };
  if (!Object.keys(saved).length && isTouchDevice())
    Object.assign(result, MOBILE_DEFAULTS);
  if (SKINS[saved.skin]) result.skin = saved.skin;
  const limits = {
    sensitivity: [0.0005, 0.005],
    FOV: [55, 110],
    volume: [0, 1],
    ambientVolume: [0, 1],
    mobVolume: [0, 1],
    musicVolume: [0, 1],
    menuVolume: [0, 1],
    droppedItemDistance: [0.25, 1.5],
    blockEntityDistance: [16, 128],
    renderDistance: [2, 24],
    graphics: [1, 5],
    brightness: [0, 1],
    mipmapLevels: [0, 4],
    entityDistance: [0.5, 1.5],
    biomeBlend: [0, 4],
    cloudHeight: [96, 256],
  };
  for (const [key, [min, max]] of Object.entries(limits))
    if (Number.isFinite(saved?.[key]))
      result[key] = Math.max(min, Math.min(max, saved[key]));
  for (const key of [
    "fancyGraphics",
    "ambientOcclusion",
    "viewBobbing",
    "dynamicFOV",
    "damageTilt",
    "stars",
    "animatedTextures",
    "entityAnimations",
    "droppedItemAnimation",
    "biomeColors",
    "sunMoon",
    "entityShadows",
    "shadows",
    "ambientSounds",
    "mobSounds",
    "musicEnabled",
    "weatherEffects",
    "lightningFlashes",
    "fog",
    "clouds",
    "showFPS",
    "distantTerrain",
    "lightFlicker",
    "menuSounds",
  ])
    if (typeof saved?.[key] === "boolean") result[key] = saved[key];
  if (saved.ambientOcclusion === undefined && saved.fancyGraphics === false)
    result.ambientOcclusion = false;
  result.cycleText = Object.fromEntries(
    Object.entries(CYCLE_TEXT).map(([key, text]) => [
      key,
      typeof saved?.cycleText?.[key] === "string"
        ? saved.cycleText[key].slice(0, 140)
        : text,
    ]),
  );
  for (const [key, choices] of Object.entries(VIDEO_CHOICES))
    if (choices.some(([value]) => value === saved[key]))
      result[key] = saved[key];
  result.mipmapLevels = Math.round(result.mipmapLevels);
  result.biomeBlend = Math.round(result.biomeBlend);
  result.graphics = Math.round(result.graphics);
  result.renderDistance = Math.round(result.renderDistance);
  if (
    saved.droppedItemDistance === undefined &&
    Number.isFinite(saved.entityDistance)
  )
    result.droppedItemDistance = result.entityDistance;
  result.controller = controllerConfig(saved.controller);
  result.touch = touchConfig(saved.touch);
  result.standKeys = standBindings(saved.standKeys);
  return result;
}
class Game {
  constructor() {
    this.settings = readSettings();
    this.devStands =
      typeof __DCSMCRAFT_DEV__ !== "undefined" && __DCSMCRAFT_DEV__;
    this.standProjectiles = [];
    this.rules = { keepInventory: false };
    this.store = new SaveStore();
    this.audio = new AudioEngine(this.settings);
    this.renderer = new Renderer(document.querySelector("#app"), this.settings);
    this.cameraMode = 0;
    this.dimension = "overworld";
    this.realms = {};
    this.portalLinks = {};
    this.world = new World("Aquatic");
    this.spawn = this.world.findSpawn();
    this.player = createPlayer(this.spawn);
    this.inventory = new Inventory();
    this.mode = "survival";
    this.difficulty = "normal";
    this.time = 6000;
    this.entities = [];
    this.drops = [];
    this.tickCount = 0;
    this.elapsed = 0;
    this.keys = new Set();
    this.sprintInput = new SprintInput();
    this.running = false;
    this.active = false;
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.pointerLockFallback = false;
    this.target = null;
    this.mining = 0;
    this.lastPlace = 0;
    this.lastAutoSave = 0;
    this.renderer.setWorld(this.world);
    this.renderer.loadAround(this.spawn.x, this.spawn.z, 3, 9);
    this.ui = new UI(this);
    this.store.onStatus = () => this.ui.refreshSaveStatus();
    this.multiplayer = new Multiplayer(this);
    this.jukebox = new Jukebox(this);
    this.chat = new ChatSystem(this);
    this.giganto = new GigantoEncounter(this);
    this.controller = new ControllerInput(this);
    this.touch = typeof __DCSMCRAFT_MOBILE__ !== "undefined" && __DCSMCRAFT_MOBILE__
      ? new PocketTouchInput(this) : new TouchInput(this);
    this.prompts = new InputPrompts(this);
    installMobileApp(this);
    this.ui.title();
    if (new URLSearchParams(location.hash.slice(1)).has("join"))
      this.ui.multiplayerMenu(location.href);
    this.bind();
    this.animate(performance.now());
    this.initialized = true;
  }
  bind() {
    const canvas = this.renderer.gl.domElement;
    addEventListener("hashchange", () => {
      if (
        !this.active &&
        new URLSearchParams(location.hash.slice(1)).has("join")
      )
        this.ui.multiplayerMenu(location.href);
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    this.handleKeyDown = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) &&
        e.code !== "Escape"
      )
        return;
      if (
        this.ui.screen === "play" &&
        ["Space", "KeyE", "Tab", "KeyQ", "ArrowUp", "ArrowDown"].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.repeat) return;
      const freshPress = !this.keys.has(e.code);
      this.keys.add(e.code);
      if (e.code === "F5" && this.active && this.ui.screen === "play") {
        e.preventDefault();
        this.cameraMode = (this.cameraMode + 1) % 3;
        this.ui.toast(
          ["First person", "Third person · behind", "Third person · front"][
            this.cameraMode
          ],
        );
        return;
      }
      if (e.code === "F3") {
        e.preventDefault();
        this.ui.debug = !this.ui.debug;
        return;
      }
      if (e.code === "Escape" && this.active && this.ui.screen === "play") {
        e.preventDefault();
        this.audio.menu("select");
        this.pause();
        return;
      }
      if (e.code === "Escape" && this.controller?.keyboard) {
        e.preventDefault();
        this.controller.closeKeyboard();
        return;
      }
      if (e.code === "Escape" && !this.active && this.ui.screen !== "title") {
        e.preventDefault();
        this.ui.back();
        return;
      }
      if (e.code === "Escape" && this.active && this.ui.screen !== "play") {
        if (this.ui.screen !== "death") this.audio.menu("exit");
        if (this.ui.screen === "inventory") this.closeInventory();
        else if (this.ui.screen === "pause") this.resume();
        else if (this.ui.screen !== "death") this.ui.back();
        return;
      }
      if (
        e.code === "KeyE" &&
        this.active &&
        ["inventory", "trading", "enchanting"].includes(this.ui.screen)
      ) {
        this.audio.menu("exit");
        this.closeInventory();
        return;
      }
      if (!this.active || this.ui.screen !== "play") return;
      const standKey = Object.entries(this.settings.standKeys).find(
        ([, code]) => code === e.code,
      )?.[0];
      if (standKey && (this.player.standData?.id || standKey === "info")) {
        e.preventDefault();
        if (standKey === "info") {
          this.pause();
          this.ui.standMenu();
        } else if (this.multiplayer?.isGuest)
          this.multiplayer.command("stand", { slot: standKey });
        else activateStand(this, standKey, damageEntity);
        return;
      }
      if (e.code === "KeyW" && freshPress)
        this.sprintInput.pressForward(this.tickCount);
      if (e.code === "KeyT" || e.code === "Slash") {
        e.preventDefault();
        this.chat.open(e.code === "Slash" ? "/" : "");
        return;
      }
      if (e.code === "Tab" && this.multiplayer.connected) {
        e.preventDefault();
        this.pause();
        this.ui.multiplayerMenu();
        return;
      }
      if (e.code === "KeyR") {
        if (holdsPistols(this)) {
          if (this.multiplayer?.isGuest) {
            this.ui.toast("Air Trick is host-only in Creative co-op.");
            return;
          }
          tricksterMove(this, true);
          return;
        }
        if (this.multiplayer.isGuest) this.multiplayer.command("seeker");
        else launchSeeker(this);
        return;
      }
      if (e.code === "KeyJ") {
        this.openJournal();
        return;
      }
      if (e.code === "KeyE") {
        this.openInventory("personal");
        return;
      }
      if (
        (e.code === "ShiftLeft" || e.code === "ShiftRight") &&
        this.player.boatId
      ) {
        if (this.multiplayer?.isGuest) this.multiplayer.command("use");
        else leaveBoat(this);
      }
      if (/^Digit[1-9]$/.test(e.code)) {
        this.inventory.selected = Number(e.code.slice(-1)) - 1;
        this.ui.updateHotbar();
      }
      if (e.code === "KeyQ") {
        if (this.multiplayer.isGuest) {
          if (this.mode === "survival") {
            this.multiplayer.command("drop", { all: e.ctrlKey });
            return;
          }
          this.ui.toast("Item drops are host-controlled in Creative co-op.");
          return;
        }
        const s = this.inventory.held;
        if (s) {
          const count = e.ctrlKey ? s.count : 1;
          dropItem(
            this,
            { ...s, count },
            this.player.x - Math.sin(this.player.yaw),
            this.player.y + 1,
            this.player.z - Math.cos(this.player.yaw),
            30,
          );
          this.inventory.consume(this.inventory.selected, count);
          this.ui.updateHotbar();
        }
      }
      if (e.code === "Space" && this.mode === "creative") {
        // Reference-style seven-tick double-tap window. Rendering stalls must
        // not change the gesture window relative to the game simulation.
        if (this.tickCount - (this.lastSpaceTick ?? -100) < 7)
          this.player.flying = !this.player.flying;
        this.lastSpaceTick = this.tickCount;
      }
      if (e.code === "KeyF") {
        this.ui.toast("This item cannot be used from the offhand.");
      }
    };
    addEventListener("keydown", this.handleKeyDown);
    addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (!hasMovement(this.keys)) {
        this.sprintInput.stop();
        this.player.sprinting = false;
      }
    });
    addEventListener("blur", () => {
      this.resetControls();
      this.mouseDown = false;
      if (this.running) this.pause();
    });
    document.addEventListener("mousemove", (e) => {
      if (
        this.running &&
        (document.pointerLockElement === canvas ||
          (this.pointerLockFallback && e.target === canvas))
      ) {
        this.player.yaw -= e.movementX * this.settings.sensitivity;
        this.player.pitch = Math.max(
          -1.553,
          Math.min(
            1.553,
            this.player.pitch - e.movementY * this.settings.sensitivity,
          ),
        );
      }
    });
    document.addEventListener("pointerlockerror", () =>
      this.useUnlockedMouse(),
    );
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === canvas) {
        this.lockRequested = false;
        this.pointerLockFallback = false;
        if (!this.running) document.exitPointerLock?.();
      }
      if (
        document.pointerLockElement !== canvas &&
        this.running &&
        !this.pointerLockFallback &&
        !this.lockRequested
      ) {
        this.running = false;
        this.mouseDown = false;
        this.resetControls();
        if (this.ui.screen === "play") this.ui.pause();
      }
    });
    canvas.addEventListener("mousedown", (e) => {
      if (!this.active || this.ui.screen !== "play") return;
      if (document.pointerLockElement !== canvas && !this.pointerLockFallback) {
        this.resume();
        return;
      }
      if (e.button === 0) this.beginPrimaryInput();
      else if (e.button === 2) this.beginSecondaryInput();
    });
    addEventListener("mouseup", (e) => {
      if (e.button === 2) this.endSecondaryInput();
      if (e.button === 0) this.endPrimaryInput();
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.running) return;
        e.preventDefault();
        this.inventory.selected =
          (this.inventory.selected + Math.sign(e.deltaY) + 9) % 9;
        this.ui.updateHotbar();
      },
      { passive: false },
    );
    addEventListener("pagehide", () => {
      if (this.active && !this.giganto?.closing) this.save().catch(() => {});
    });
  }
  async newWorld({ name, seed, mode, difficulty }) {
    this.giganto.clear();
    this.multiplayer?.disconnect();
    if (this.multiplayer) this.multiplayer.isGuest = false;
    this.ui.loading("Creating world…");
    await new Promise((r) => setTimeout(r, 30));
    this.multiplayer?.restorePlayers();
    this.chat.lines = [];
    this.id = uniqueId();
    this.name = name || "A little wilderness";
    this.dimension = "overworld";
    this.realms = {};
    this.portalLinks = {};
    this.portalCooldown = 0;
    this.portalCharge = 0;
    this.standProjectiles = [];
    this.rules = { keepInventory: false };
    this.seekers = [];
    this.pistolTraces = [];
    this.hostileProjectiles = [];
    this.mode = mode;
    this.difficulty = difficulty;
    this.world = new World(seed || String(Math.floor(Math.random() * 1e9)));
    this.spawn = this.world.findSpawn();
    this.player = createPlayer(this.spawn);
    this.cameraMode = 0;
    this.inventory = new Inventory();
    if (mode === "creative") {
      [
        "grass",
        "stone",
        "log",
        "planks",
        "glass",
        "torch",
        "crafting_table",
        "furnace",
        "diamond_pickaxe",
      ].forEach(
        (id, i) => (this.inventory.slots[i] = makeStack(id, ITEMS[id].stack)),
      );
    }
    this.entities = [];
    this.drops = [];
    this.time = 1000;
    this.tickCount = 0;
    this.lastAutoSave = this.elapsed;
    seedCreatures(this);
    this.renderer.setWorld(this.world);
    this.renderer.loadAround(this.player.x, this.player.z, 2, 9);
    this.active = true;
    this.lastDeath = null;
    await this.save();
    this.ui.play();
    this.resume();
    this.ui.announce("DAY 1", this.settings.cycleText.dayStart);
    this.ui.toast(
      this.store.temporary
        ? "Browser storage is blocked. This world is session-only; export it from Saved Worlds before closing."
        : "Hold left-click on a tree to gather wood.",
      this.store.temporary ? 10000 : 6500,
    );
  }
  async loadWorld(id) {
    this.multiplayer?.disconnect();
    if (this.multiplayer) this.multiplayer.isGuest = false;
    this.ui.loading("Loading world…");
    try {
      const { data, recovered } = await this.store.load(id);
      this.giganto.clear();
      this.standProjectiles = [];
      this.rules = { keepInventory: false, ...data.rules };
      this.seekers = [];
      this.pistolTraces = [];
      this.hostileProjectiles = [];
      this.multiplayer?.restorePlayers(data.coopPlayers);
      this.chat.lines = [];
      this.id = data.id;
      this.name = data.name;
      this.mode = data.mode;
      this.difficulty = data.difficulty;
      this.dimension = data.dimension || "overworld";
      this.realms = Object.fromEntries(
        Object.entries(data.realms || {}).map(([dim, state]) => [
          dim,
          restoreRealm(data.seed, dim, state),
        ]),
      );
      this.portalLinks = data.portalLinks || {};
      this.portalCooldown = 100;
      this.portalCharge = 0;
      this.world = new World(
        data.seed,
        data.edits,
        this.dimension,
        data.generationVersion ?? 2,
      );
      this.world.palm = data.palm || null;
      this.world.protectedAreas = data.protectedAreas || [];
      this.world.weather = restoreWeather(data.weather, this.world.seedInt);
      this.world.relicClaimed = !!data.relicClaimed;
      this.world.settlements = data.settlements || {};
      this.world.containers = data.containers || {};
      this.world.cropTicks = data.crops || {};
      this.world.aquatic = data.aquatic || {
        growth: {},
        projectiles: [],
        achievements: {},
      };
      this.world.tick = data.worldTick || 0;
      this.world.restoreDynamics(data.blockTimers);
      this.world.portals = data.portals || {};
      this.time = data.time;
      this.tickCount = data.tickCount || 0;
      this.spawn = data.spawn || this.world.findSpawn();
      this.player = createPlayer(this.spawn, data.player);
      delete this.player.fishing;
      this.inventory = new Inventory(data.inventory);
      this.entities = upgradeNightEnemies(data.entities, this.dimension);
      this.drops = data.drops || [];
      this.world.embeddedArrows = restoreEmbeddedArrows(
        data.realms?.[this.dimension]?.embeddedArrows ?? data.embeddedArrows,
      );
      this.lastDeath = data.lastDeath;
      this.renderer.setWorld(this.world);
      this.renderer.loadAround(this.player.x, this.player.z, 2, 9);
      this.active = true;
      this.giganto.load(data.giganto);
      this.lastAutoSave = this.elapsed;
      if (this.player.health <= 0) {
        this.running = false;
        this.ui.death();
      } else {
        this.ui.play();
        this.resume();
      }
      if (recovered) this.ui.toast("Recovered the previous save.", 6000);
    } catch (err) {
      this.ui.error(err.message);
    }
  }
  snapshot() {
    this.realms[this.dimension] = realmState(this);
    return cloneState({
      format: 1,
      giganto: this.giganto.export(),
      dimension: this.dimension,
      realms: Object.fromEntries(
        Object.entries(this.realms).map(([dim, state]) => [
          dim,
          exportRealm(state),
        ]),
      ),
      portalLinks: this.portalLinks,
      portals: this.world.portals,
      palm: this.world.palm,
      protectedAreas: this.world.protectedAreas || [],
      rules: this.rules,
      id: this.id,
      name: this.name,
      seed: this.world.seed,
      mode: this.mode,
      difficulty: this.difficulty,
      time: this.time,
      tickCount: this.tickCount,
      worldTick: this.world.tick,
      blockTimers: this.world.blockTimers,
      spawn: this.spawn,
      player: this.player,
      inventory: this.inventory.export(),
      edits: this.world.exportEdits(),
      generationVersion: this.world.generationVersion,
      weather: this.world.weather,
      relicClaimed: this.world.relicClaimed,
      settlements: this.world.settlements,
      containers: this.world.containers,
      aquatic: this.world.aquatic,
      crops: this.world.cropTicks,
      entities: this.entities,
      drops: this.drops,
      embeddedArrows: this.world.embeddedArrows || [],
      lastDeath: this.lastDeath,
      coopPlayers: this.multiplayer?.exportPlayers() || {},
    });
  }
  save() {
    return saveGame(this);
  }
  async quit() {
    if (this.multiplayer?.isGuest) {
      this.multiplayer.disconnect();
      this.multiplayer.isGuest = false;
      this.running = false;
      this.active = false;
      document.exitPointerLock?.();
      this.ui.title();
      return;
    }
    this.closeCraft();
    this.running = false;
    document.exitPointerLock?.();
    this.ui.loading("Saving world…");
    try {
      await this.save();
      this.multiplayer?.disconnect();
      this.active = false;
      this.ui.title();
    } catch (e) {
      this.ui.error(
        "Could not save: " +
          e.message +
          ". Your world is still in memory; resume and try again.",
      );
    }
  }
  inputKeys() {
    const keys = this.controller?.worldKeys(this.keys) || this.keys;
    return this.touch?.active ? new Set([...keys, ...this.touch.keys]) : keys;
  }
  beginPrimaryInput() {
    if (!this.active || this.ui.screen !== "play") return false;
    if (!this.multiplayer?.isGuest && claimPistols(this, this.target))
      return false;
    if (holdsPistols(this)) {
      this.mouseDown = true;
      this.firePistols();
      return true;
    }
    this.renderer.action("attack");
    this.mouseDown = true;
    if (this.tryAttack()) this.mouseDown = false;
    else if (this.multiplayer.isGuest && this.target)
      this.multiplayer.command("break");
    return this.mouseDown;
  }
  endPrimaryInput() {
    this.mouseDown = false;
    resetExtraction(this);
    this.mining = 0;
  }
  beginSecondaryInput() {
    this.rightMouseDown = this.canRepeatPlacement();
    this.use();
  }
  endSecondaryInput() {
    this.rightMouseDown = false;
    if (this.multiplayer?.isGuest) this.multiplayer.command("release-use");
    else {
      releaseTrident(this);
      releaseEditionWeapon(this);
    }
  }
  resetControls() {
    this.controller?.clear();
    this.touch?.clear();
    delete this.player.editionDraw;
    this.player.shieldRaised = false;
    this.player.spyglassUntil = 0;
    delete this.player.tricksterDash;
    this.rightMouseDown = false;
    this.keys.clear();
    resetExtraction(this);
    this.audio.silenceAmbient();
    this.sprintInput.reset();
    this.player.sprinting = false;
    this.lockRequested = false;
    this.audio.music?.silence();
    this.renderer.animator.reset();
    this.renderer.playerSwing = 0;
  }
  resume() {
    if (this.multiplayer?.isGuest && !this.multiplayer.connected) {
      this.ui.toast(
        "The host is offline. Leave this session and rejoin with an invitation.",
      );
      return;
    }
    if (!this.active || this.player.health <= 0) return;
    this.audio.unlock();
    this.ui.play();
    this.resetControls();
    this.lastSpaceTick = -100;
    this.mouseDown = false;
    this.mining = 0;
    this.running = true;
    if (this.controller?.lastDevice === "controller" || this.touch?.active) {
      this.pointerLockFallback = true;
      this.lockRequested = false;
      return;
    }
    this.pointerLockFallback = false;
    this.lockRequested = true;
    this.renderer.gl.domElement.style.cursor = "";
    try {
      const canvas = this.renderer.gl.domElement;
      if (typeof canvas.requestPointerLock !== "function") {
        this.useUnlockedMouse();
        return;
      }
      const result = canvas.requestPointerLock();
      result?.catch(() => this.useUnlockedMouse());
    } catch {
      this.useUnlockedMouse();
    }
  }
  useUnlockedMouse() {
    if (!this.running || this.ui.screen !== "play" || this.pointerLockFallback)
      return;
    this.pointerLockFallback = true;
    this.lockRequested = false;
    this.renderer.gl.domElement.style.cursor = "crosshair";
    this.ui.toast(
      "Mouse capture unavailable. Move the mouse over the game to look. Escape pauses." +
        (this.store.temporary
          ? " Saves are session-only; export before closing."
          : ""),
      10000,
    );
  }
  pause() {
    if (!this.active) return;
    this.running = false;
    this.mouseDown = false;
    this.resetControls();
    document.exitPointerLock?.();
    this.ui.pause();
  }
  openInventory(type, container = null, target = null) {
    if (this.multiplayer?.isGuest && this.mode === "survival")
      this.multiplayer.command("menu", { type });
    this.running = false;
    this.mouseDown = false;
    this.mining = 0;
    this.resetControls();
    this.ui.openInventory(type, container, target);
    document.exitPointerLock?.();
  }
  closeCraft() {
    if (this.multiplayer?.isGuest && this.mode === "survival") {
      this.multiplayer.command("close");
      return;
    }
    for (let i = 0; i < 9; i++) {
      const s = this.inventory.craft[i];
      if (s) {
        const n = this.inventory.add(s);
        if (n)
          dropItem(
            this,
            { ...s, count: n },
            this.player.x,
            this.player.y + 0.5,
            this.player.z,
          );
        this.inventory.craft[i] = null;
      }
    }
    if (this.inventory.cursor) {
      const s = this.inventory.cursor,
        n = this.inventory.add(s);
      if (n)
        dropItem(
          this,
          { ...s, count: n },
          this.player.x,
          this.player.y + 0.5,
          this.player.z,
        );
      this.inventory.cursor = null;
    }
  }
  closeInventory() {
    this.closeCraft();
    this.resume();
  }
  damage(amount, cause, force = false) {
    if (this.multiplayer?.isGuest && this.mode === "survival") return;
    const p = this.player;
    if ((this.mode === "creative" && !force) || p.health <= 0 || p.hurt > 0)
      return;
    amount = reduceDamage(this.inventory, amount, cause);
    if (this.player.effects?.resistance && !/void|starvation/.test(cause))
      amount *= 1 - Math.min(0.8, this.player.effects.resistance.level * 0.2);
    p.health = Math.max(0, p.health - amount);
    p.hurt = 0.5;
    resetExtraction(this);
    this.renderer.action("hurt");
    this.audio.tone("hit");
    this.ui.updateHUD();
    if (!p.health) {
      this.lastDeath = { x: p.x, y: p.y, z: p.z, cause };
      this.closeCraft();
      if (!this.rules?.keepInventory)
        for (let i = 0; i < 36; i++) {
          const s = this.inventory.slots[i];
          if (s) {
            dropItem(
              this,
              s,
              p.x + (Math.random() - 0.5) * 1.2,
              p.y + 0.5,
              p.z + (Math.random() - 0.5) * 1.2,
              30,
            );
            this.inventory.slots[i] = null;
          }
        }
      if (!this.rules?.keepInventory)
        for (let i = 0; i < 4; i++) {
          const stack = this.inventory.equipment[i];
          if (stack) dropItem(this, stack, p.x, p.y + 0.5, p.z, 30);
          this.inventory.equipment[i] = null;
        }
      if (!this.rules?.keepInventory) {
        const stack = this.inventory.offhand[0];
        if (stack) dropItem(this, stack, p.x, p.y + 0.5, p.z, 30);
        this.inventory.offhand[0] = null;
      }
      if (!this.rules?.keepInventory) p.xp = 0;
      this.running = false;
      this.resetControls();
      document.exitPointerLock?.();
      this.ui.death();
      this.save().catch((e) => this.ui.toast("Save failed: " + e.message));
    }
  }
  respawn() {
    if (respawnInTrial(this)) return;
    if (this.multiplayer?.isGuest && this.mode === "survival") {
      this.multiplayer.command("respawn");
      return;
    }
    if (this.dimension !== "overworld") selectRealm(this, "overworld");
    const point = { ...this.spawn };
    let clear = false;
    for (let y = point.y; y < point.y + 32; y++)
      if (
        !this.world.solid(point.x, y, point.z) &&
        !this.world.solid(point.x, y + 1, point.z)
      ) {
        point.y = y;
        clear = true;
        break;
      }
    const standData = this.player.standData,
      aquaticId = this.player.aquaticId;
    this.player = createPlayer(clear ? point : this.world.findSpawn(), {
      aquaticId,
    });
    if (standData) {
      this.player.standData = standData;
      standData.trial = null;
      standData.summoned = false;
      standData.transformed = false;
    }
    this.resume();
    this.save().catch((e) => this.ui.toast("Save failed: " + e.message));
    this.ui.toast("Respawned. Dropped items remain for five minutes.");
  }
  travelDimension(portal) {
    if (activeTrial(this)) {
      this.portalCharge = 0;
      this.portalCooldown = 100;
      this.ui.toast(
        "The trial seals ordinary portals. Defeat A Mad Titan and use the return rune.",
      );
      return;
    }
    if (this.multiplayer?.connected) {
      this.portalCharge = 0;
      this.portalCooldown = 100;
      this.ui.toast("Leave multiplayer to change dimensions.");
      return;
    }

    travel(this, portal);
  }
  direction() {
    return new THREE.Vector3(
      -Math.sin(this.player.yaw) * Math.cos(this.player.pitch),
      Math.sin(this.player.pitch),
      -Math.cos(this.player.yaw) * Math.cos(this.player.pitch),
    );
  }
  targetEntity() {
    const p = this.player,
      origin = new THREE.Vector3(p.x, p.y + playerEye(p), p.z),
      direction = this.direction();
    let nearest = null,
      distance =
        this.inventory.held?.id === "water_bucket"
          ? 4.5
          : ITEMS[this.inventory.held?.id]?.reach || 3;
    const ray = new THREE.Ray(origin, direction);
    for (const e of this.entities) {
      if (e.hp <= 0) continue;
      const half =
          ((e.type === "boat" ? 1.3 : MOB_INFO[e.type]?.width || 0.7) *
            farmScale(e)) /
          2,
        height =
          (e.type === "boat" ? 0.65 : MOB_INFO[e.type]?.height || 1.95) *
          farmScale(e),
        box = new THREE.Box3(
          new THREE.Vector3(e.x - half, e.y, e.z - half),
          new THREE.Vector3(e.x + half, e.y + height, e.z + half),
        ),
        hit = ray.intersectBox(box, new THREE.Vector3());
      if (hit) {
        const dist = hit.distanceTo(origin);
        if (dist < distance && (!this.target || this.target.distance > dist)) {
          nearest = e;
          distance = dist;
        }
      }
    }
    return nearest;
  }
  tryAttack() {
    if (
      this.multiplayer?.isGuest &&
      (this.hostileProjectiles || []).some(
        (q) =>
          q.fireball &&
          Math.hypot(
            q.x - this.player.x,
            q.y - this.player.y - 1.3,
            q.z - this.player.z,
          ) < 4.5,
      )
    )
      return this.multiplayer.command("attack");
    if (!this.multiplayer?.isGuest && deflectFireball(this)) return true;
    const entity = this.targetEntity();
    if (!entity) return false;
    if (this.multiplayer?.isGuest) return this.multiplayer.command("attack");
    hitEntity(this, entity);
    return true;
  }
  openEnchanting() {
    this.closeCraft();
    this.running = false;
    this.mouseDown = false;
    this.resetControls();
    document.exitPointerLock?.();
    this.ui.enchanting();
  }
  openJournal() {
    this.pause();
    this.ui.journal(relicSite(this.world));
  }
  openTrade(entity) {
    this.closeCraft();
    this.running = false;
    this.mouseDown = false;
    this.resetControls();
    document.exitPointerLock?.();
    this.audio.mob?.("villager", 0);
    this.ui.trading(entity);
  }
  firePistols() {
    if (this.multiplayer?.isGuest) return this.multiplayer.command("pistol");
    return firePistols(this, damageEntity);
  }
  mine(dt) {
    if (standLocked(this)) return;
    if (this.mode === "creative" && this.inventory.held?.id === "trident") {
      this.mining = 0;
      return;
    }
    if (holdsPistols(this)) {
      resetExtraction(this);
      this.mining = 0;
      if (this.mouseDown) this.firePistols();
      return;
    }
    if (this.multiplayer?.isGuest && this.mode === "creative") {
      if (this.mouseDown && this.target) this.multiplayer.command("break");
      this.mining = 0;
      return;
    }
    const t = this.target;
    if (!this.mouseDown || !t) {
      resetExtraction(this);
      this.mining = 0;
      this.miningKey = null;
      return;
    }
    if (BLOCKS[t.id]?.relic) {
      this.mining = 0;
      if (this.multiplayer?.isGuest) {
        this.ui.toast("The host controls unique relic extraction.");
        return;
      }
      extractRelic(this, t);
      return;
    }
    resetExtraction(this);
    const key = coordKey(t.x, t.y, t.z);
    if (key !== this.miningKey) {
      this.mining = 0;
      this.miningKey = key;
    }
    if (
      this.elapsed - (this.lastBreak || -1) < 0.25 &&
      this.mode !== "creative"
    )
      return;
    const b = BLOCKS[t.id],
      ticks =
        this.mode === "creative"
          ? 1
          : miningTicks(
              b,
              this.inventory.held,
              this.player.underwater && !this.player.effects?.conduit_power,
              !this.player.onGround,
              this.inventory.equipment?.[0],
            );
    this.mining += (dt * 20) / ticks;
    if (this.mining >= 1) {
      if (!this.multiplayer?.isGuest) this.breakBlock(t);
      this.mining = 0;
      this.lastBreak = this.elapsed;
    }
  }
  breakBlock(t) {
    if (this.mode === "creative" && this.inventory.held?.id === "trident")
      return;
    if (infernalLootBlocked(this, t)) return;
    if (
      this.world.get(t.x, t.y, t.z) !== t.id ||
      BLOCKS[t.id]?.relic ||
      t.id === B.matthew_altar
    )
      return;
    const door = doorAt(this.world, t.x, t.y, t.z);
    if (door) {
      removeDoor(this.world, t.x, t.y, t.z);
      this.renderer.breakParticles(t.x, t.y, t.z, t.id);
      playWorldSound(this, "break", t, "planks");
      if (this.mode !== "creative") {
        dropItem(
          this,
          makeStack(door.item || "oak_door"),
          door.x + 0.5,
          door.y + 0.5,
          door.z + 0.5,
          0,
        );
        if (ITEMS[this.inventory.held?.id]?.tool) this.inventory.damageTool();
      }
      this.ui.updateHotbar();
      return;
    }
    const b = BLOCKS[t.id];
    if (b.hardness === Infinity && this.mode !== "creative") return;
    const key = coordKey(t.x, t.y, t.z),
      container = this.world.containers[key];
    if (container) {
      for (const s of container.slots)
        if (s) dropItem(this, s, t.x + 0.5, t.y + 0.5, t.z + 0.5);
      delete this.world.containers[key];
    }
    const crop = this.world.cropTicks[key];
    if (t.id === B.sugar_cane)
      for (
        let dy = 1;
        t.y + dy <= MAX_Y &&
        this.world.get(t.x, t.y + dy, t.z) === B.sugar_cane;
        dy++
      ) {
        this.world.set(t.x, t.y + dy, t.z, B.air);
        if (this.mode !== "creative")
          dropItem(
            this,
            makeStack("sugar_cane"),
            t.x + 0.5,
            t.y + dy + 0.3,
            t.z + 0.5,
            0,
          );
      }
    const supportedDoor = doorAt(this.world, t.x, t.y + 1, t.z);
    if (supportedDoor && supportedDoor.y === t.y + 1) {
      removeDoor(this.world, supportedDoor.x, supportedDoor.y, supportedDoor.z);
      if (this.mode !== "creative")
        dropItem(
          this,
          makeStack(supportedDoor.item || "oak_door"),
          t.x + 0.5,
          t.y + 1.5,
          t.z + 0.5,
          0,
        );
    }
    if (t.id === B.kelp)
      for (
        let dy = 1;
        dy <= 26 && this.world.get(t.x, t.y + dy, t.z) === B.kelp;
        dy++
      ) {
        this.world.set(t.x, t.y + dy, t.z, B.water);
        if (this.mode !== "creative")
          dropItem(
            this,
            makeStack("kelp"),
            t.x + 0.5,
            t.y + dy + 0.3,
            t.z + 0.5,
            0,
          );
      }
    this.world.set(t.x, t.y, t.z, b.aquaticWater ? B.water : B.air);
    this.renderer.breakParticles(t.x, t.y, t.z, t.id);
    playWorldSound(this, "break", t, b.key);
    if (this.mode !== "creative" && canHarvest(b, this.inventory.held)) {
      const harvest = blockHarvest(t.id, this.inventory.held, crop);
      for (const stack of harvest.drops)
        dropItem(this, stack, t.x + 0.5, t.y + 0.5, t.z + 0.5, 0);
      if (harvest.xp) awardXP(this, harvest.xp);
      if (ITEMS[this.inventory.held?.id]?.tool) this.inventory.damageTool();
      this.player.exhaustion += 0.005;
    }
    delete this.world.cropTicks[key];
    if (this.world.aquatic) delete this.world.aquatic.growth[key];
    this.ui.updateHotbar();
  }
  canRepeatPlacement() {
    if (ITEMS[this.inventory.held?.id]?.block === undefined) return false;
    if (this.player.crouching) return true;
    const t = this.target;
    // Holding place must never repeatedly operate a door, workstation or villager.
    if (
      t &&
      (BLOCKS[t.id]?.station ||
        ["gate", "trapdoor"].includes(BLOCKS[t.id]?.shape) ||
        BLOCKS[t.id]?.door ||
        BLOCKS[t.id]?.relic ||
        [
          B.crafting_table,
          B.jukebox,
          B.chest,
          B.furnace,
          B.enchanting_table,
          B.bed,
        ].includes(t.id))
    )
      return false;
    return this.targetEntity()?.type !== "villager";
  }
  use() {
    if (standLocked(this)) return;
    if (useTrialExit(this, this.target)) return;
    if (!this.multiplayer?.isGuest && attuneTemple(this, this.target)) return;
    if (infernalLootBlocked(this, this.target)) return;
    if (!this.multiplayer?.isGuest && claimPistols(this, this.target)) return;
    if (this.jukebox.interact()) return;
    if (
      this.inventory.held?.id === "oak_boat" ||
      this.player.boatId ||
      boatInReach(this)
    ) {
      if (this.multiplayer?.isGuest) {
        if (this.mode === "survival") this.multiplayer.command("use");
        else this.ui.toast("Boats are host-controlled in Creative co-op.");
      } else useBoat(this);
      return;
    }
    if (pistolUsesStyle(this)) {
      if (this.multiplayer?.isGuest && this.mode === "survival") {
        this.ui.toast("Only the host can use this ability.");
        return;
      }
      tricksterMove(this);
      return;
    }
    if (this.multiplayer?.isGuest) {
      if (!this.player.crouching && this.target?.id === B.crafting_table) {
        this.openInventory("table");
        return;
      }
      this.multiplayer.command(
        this.inventory.held?.id === "devin_sword" &&
          !BLOCKS[this.target?.id]?.door
          ? "pulse"
          : "use",
      );
      return;
    }
    if (this.elapsed - this.lastPlace < 0.2) return;
    this.lastPlace = this.elapsed;
    const t = this.target,
      held = this.inventory.held,
      item = ITEMS[held?.id],
      p = this.player;
    const entity = this.targetEntity();
    if (entity?.type === "villager" && !p.crouching) {
      this.openTrade(entity);
      return;
    }
    if (t && BLOCKS[t.id]?.door && !p.crouching) {
      const door = doorAt(this.world, t.x, t.y, t.z);
      if (
        door &&
        setDoorOpen(this.world, t.x, t.y, t.z, !door.open, [
          p,
          ...this.entities,
          ...(this.multiplayer?.occupants() || []),
        ])
      ) {
        this.renderer.action("use");
        playWorldSound(this, door.open ? "door-close" : "door-open", t);
      }
      return;
    }
    if (t && !p.crouching) {
      if (t.id === B.enchanting_table) {
        this.openEnchanting();
        return;
      }
      if (BLOCKS[t.id]?.relic) {
        this.ui.toast(
          "Hold left click on the sword for 30 uninterrupted seconds. Release, look away or take damage to reset.",
        );
        return;
      }
      if (t.id === B.crafting_table) {
        playWorldSound(this, "open", t);
        this.openInventory("table", null, t);
        return;
      }
      if (t.id === B.chest || t.id === B.furnace) {
        if (t.id === B.chest && !canOpenChest(this.world, t)) {
          this.ui.toast("The chest lid is blocked.");
          return;
        }
        if (t.id === B.furnace) playWorldSound(this, "open", t);
        this.openInventory(
          BLOCKS[t.id].key,
          interactContainer(this.world, t),
          t,
        );
        return;
      }
      if (t.id === B.bed) {
        if (this.dimension !== "overworld") {
          this.ui.toast(
            "The Cinderwild never sleeps. Return to the Overworld to rest.",
          );
          return;
        }
        if (this.time % 24000 < 12500 || this.time % 24000 > 23500) {
          this.ui.toast("You can set your spawn and sleep here at night.");
          return;
        }
        if (
          this.entities.some(
            (e) =>
              HOSTILE_TYPES.has(e.type) &&
              Math.hypot(e.x - p.x, e.z - p.z) < 10,
          )
        ) {
          this.ui.toast("A hostile creature is too close to sleep.");
          return;
        }
        this.spawn = { x: p.x, y: p.y, z: p.z };
        this.time = Math.ceil(this.time / 24000) * 24000 + 1000;
        setWeather(this.world, "clear").override = null;
        this.ui.toast("Spawn point set. A new day begins.");
        this.ui.announce("A NEW DAY", this.settings.cycleText.dayStart);
        this.audio.tone("dawn");
        return;
      }
    }
    if (
      useLivestock(this) ||
      useEdition(this) ||
      useAquatic(this) ||
      useSpawnEgg(this) ||
      useBucket(this) ||
      useFlintAndSteel(this, t)
    )
      return;
    if (held?.id === "devin_sword") {
      devinPulse(this);
      return;
    }
    if (equipHeld(this.inventory)) {
      this.audio.tone("equip");
      this.renderer.action("equip");
      this.ui.updateHotbar();
      this.ui.updateHUD();
      return;
    }
    if (item?.food && (p.food < 20 || this.mode === "creative")) {
      p.food = Math.min(20, p.food + item.food);
      p.saturation = Math.min(p.food, p.saturation + item.saturation);
      if (this.mode !== "creative") this.inventory.consume();
      this.renderer.action("eat");
      this.audio.tone("eat");
      this.ui.updateHotbar();
      this.ui.updateHUD();
      return;
    }
    if (!t || !held) return;
    if (held.id === "bone_meal" && t.id === B.crop) {
      const state = (this.world.cropTicks[coordKey(t.x, t.y, t.z)] ||= {
        age: 0,
      });
      if (state.age >= 7) return;
      state.age = Math.min(7, state.age + 3);
      if (this.mode !== "creative") this.inventory.consume();
      this.renderer.action("use");
      playWorldSound(this, "place", t, "grass");
      this.ui.updateHotbar();
      return;
    }
    if (
      item?.tool === "hoe" &&
      (t.id === B.grass || t.id === B.dirt) &&
      this.world.get(t.x, t.y + 1, t.z) === B.air
    ) {
      this.world.set(t.x, t.y, t.z, B.farmland);
      if (this.mode !== "creative") this.inventory.damageTool();
      this.renderer.action("use");
      playWorldSound(this, "place", t);
      this.ui.updateHotbar();
      return;
    }
    if (
      held.id === "seeds" &&
      t.id === B.farmland &&
      this.world.get(t.x, t.y + 1, t.z) === B.air
    ) {
      this.world.set(t.x, t.y + 1, t.z, B.crop);
      this.world.cropTicks[coordKey(t.x, t.y + 1, t.z)] = { age: 0 };
      if (this.mode !== "creative") this.inventory.consume();
      this.renderer.action("place");
      this.ui.updateHotbar();
      return;
    }
    if (item?.block === undefined) return;
    if (placeEdition(this)) return;
    const replaceSnow = BLOCKS[t.id]?.snowLayers && BLOCKS[t.id].snowLayers < 8;
    const x = t.x + (replaceSnow ? 0 : t.normal.x),
      y = t.y + (replaceSnow ? 0 : t.normal.y),
      z = t.z + (replaceSnow ? 0 : t.normal.z),
      existing = this.world.get(x, y, z);
    if (
      existing !== B.air &&
      existing !== B.fire &&
      !BLOCKS[existing]?.snowLayers &&
      !fluid(existing)
    )
      return;
    if (held.id === "oak_door") {
      if (
        placeDoor(this.world, x, y, z, p.yaw, [
          p,
          ...this.entities,
          ...(this.multiplayer?.occupants() || []),
        ])
      ) {
        if (this.mode !== "creative") this.inventory.consume();
        this.renderer.action("place");
        playWorldSound(this, "place", { x, y, z }, "planks");
        this.ui.updateHotbar();
      }
      return;
    }
    if (
      BLOCKS[item.block].solid &&
      [p, ...(this.multiplayer?.occupants() || [])].some((body) =>
        intersectsBlock(body, x, y, z),
      )
    )
      return;
    if (item.block === B.sugar_cane) {
      const below = this.world.get(x, y - 1, z);
      if (
        ![B.grass, B.dirt, B.sand, B.red_sand, B.moss, B.sugar_cane].includes(
          below,
        )
      )
        return;
      if (
        below !== B.sugar_cane &&
        ![
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dz]) => isWater(this.world.get(x + dx, y - 1, z + dz)))
      )
        return;
    }
    if (item.block === B.torch && t.normal.y === -1) return;
    if (this.world.set(x, y, z, item.block)) {
      if (this.mode !== "creative") this.inventory.consume();
      this.renderer.action("place");
      playWorldSound(this, "place", { x, y, z }, BLOCKS[item.block].key);
      this.ui.updateHotbar();
    }
  }
  autofill(recipe, size) {
    if (this.multiplayer?.isGuest && this.mode === "survival") {
      this.multiplayer.command("inventory", {
        action: "recipe",
        recipe: RECIPES.indexOf(recipe),
      });
      return;
    }
    if (
      recipe.station
        ? recipe.station !== this.ui.invType
        : !["personal", "table"].includes(this.ui.invType)
    ) {
      this.ui.toast("Use the matching workstation for this recipe.");
      return;
    }
    const error = this.inventory.autofill(recipe, size);
    if (error) this.ui.toast(error);
    this.ui.refreshInventory();
  }
  animate(now) {
    requestAnimationFrame((t) => this.animate(t));
    if (
      !frameDue(
        now,
        this.lastFrame,
        effectiveFrameLimit(this.settings, this.ui.screen),
      )
    )
      return;
    const realFrameSeconds = (now - (this.lastFrame || now)) / 1000;
    const dt = Math.min(0.1, realFrameSeconds);
    this.lastFrame = now;
    this.elapsed += dt;
    if (realFrameSeconds > 0)
      this.fps = this.fps
        ? this.fps * 0.94 + (1 / realFrameSeconds) * 0.06
        : 1 / realFrameSeconds;
    this.controller?.frame(dt);
    this.touch?.frame(dt);
    if (this.active && this.giganto?.active) {
      this.giganto.frame(dt);
      this.prompts?.frame();
      return;
    }
    this.giganto?.overworld(dt);
    if (
      this.active &&
      (this.running ||
        this.multiplayer?.connected ||
        ["inventory", "trading", "enchanting"].includes(this.ui.screen)) &&
      (this.player.health > 0 ||
        (this.multiplayer?.connected && !this.multiplayer.isGuest))
    ) {
      this.accumulator = (this.accumulator || 0) + dt;
      while (this.accumulator >= 1 / 60) {
        this.moving = updatePlayer(
          this,
          this.running ? this.inputKeys() : new Set(),
          1 / 60,
        );
        if (!this.multiplayer?.isGuest || this.mode === "creative")
          updateTrickster(this, 1 / 60);
        this.multiplayer?.physics(1 / 60);
        this.accumulator -= 1 / 60;
        this.subtick = (this.subtick || 0) + 1;
        if (this.subtick % 3 === 0 && !this.multiplayer?.isGuest) {
          tickSurvival(this);
          tickPalm(this, damageEntity);
          this.multiplayer?.tickSurvival();
        }
      }
      this.target = this.world.raycast(
        {
          x: this.player.x,
          y: this.player.y + playerEye(this.player),
          z: this.player.z,
        },
        this.direction(),
        this.mode === "creative" ? 5 : 4.5,
      );
      if (this.running) {
        this.mine(dt);
        if (this.rightMouseDown && this.canRepeatPlacement()) this.use();
      }
      if (
        this.running &&
        this.mining > 0 &&
        this.elapsed - (this.lastChip || 0) > 0.23
      ) {
        playWorldSound(
          this,
          "mine",
          this.target,
          BLOCKS[this.target?.id]?.key || "stone",
        );
        this.lastChip = this.elapsed;
      }
      if (
        this.running &&
        this.moving &&
        (this.player.onGround || this.player.inWater) &&
        this.elapsed - (this.lastStep || 0) > 0.4
      ) {
        this.audio.tone(
          this.player.inWater ? "swim" : "step",
          BLOCKS[
            this.world.get(this.player.x, this.player.y - 0.1, this.player.z)
          ]?.key || "grass",
        );
        this.lastStep = this.elapsed;
      }
      if (this.elapsed - this.lastAutoSave > 30) {
        this.lastAutoSave = this.elapsed;
        this.save().catch((e) =>
          this.ui.toast("Save failed: " + e.message, 6000),
        );
      }
    }
    this.multiplayer?.frame(now, dt);
    this.audio.ambient(this);
    const p = this.player;
    const oceanTitle =
      !this.active &&
      this.world.seed === "Aquatic" &&
      this.world.generationVersion >= 15;
    const vista = oceanTitle ? { x: 1600.5, y: 63, z: 1600.5 } : this.spawn;
    this.renderer.loadAround(
      oceanTitle ? vista.x : p.x,
      oceanTitle ? vista.z : p.z,
      this.settings.renderDistance,
      1,
    );
    if (!this.active) {
      const a = 0.6 + this.elapsed * 0.008;
      this.renderer.camera.position.set(
        vista.x + Math.cos(a) * 26,
        vista.y + (oceanTitle ? 8 : 20),
        vista.z + Math.sin(a) * 26,
      );
      this.renderer.camera.lookAt(vista.x - 9, vista.y + 1, vista.z - 10);
    }
    this.renderer.setHeld(this.inventory.held?.id, this.inventory.held);
    this.renderer.setArmor(this.inventory.equipment);
    this.renderer.updateTarget(this.running ? this.target : null, this.mining);
    const visualActive =
      this.active &&
      (this.running ||
        this.multiplayer?.connected ||
        ["inventory", "trading", "enchanting"].includes(this.ui.screen));
    this.visualTime = (this.visualTime || 0) + (visualActive ? dt : 0);
    this.renderer.syncEntities(
      this.entities,
      this.drops,
      this.visualTime,
      visualActive ? dt : 0,
      this.hostileProjectiles || [],
    );
    this.renderer.syncIncursion(this, this.visualTime, visualActive ? dt : 0);
    this.renderer.standVisuals?.sync(this, visualActive ? dt : 0);
    validateLocalContainerMenu(this);
    this.renderer.draw({
      game: this,
      player: p,
      time: this.active
        ? this.time +
          (visualActive
            ? ((this.subtick || 0) % 3) / 3 + (this.accumulator || 0) * 20
            : 0)
        : 6000,
      cameraMode: this.cameraMode,
      equipment: this.inventory.equipment,
      playing: this.active,
      elapsed: this.elapsed,
      mining: this.mouseDown ? this.mining : 0,
      moving: this.running && this.moving,
      underwater: p.underwater,
      animating: this.running,
    });
    this.ui.frame();
    this.jukebox.update();
    this.chat.frame();
    this.prompts?.frame();
    if (
      this.ui.screen === "inventory" &&
      this.elapsed - (this.lastInvUpdate || 0) > 0.2
    ) {
      this.lastInvUpdate = this.elapsed;
      this.ui.refreshInventory();
    }
  }
}
if (document.querySelector("script[data-dcsmcraft-bundle]")) {
  window.DCSMCRAFT_HTML_SOURCE =
    "<!doctype html>\n" + document.documentElement.outerHTML;
}
try {
  window.dcsmcraft = new Game();
} catch (e) {
  document.querySelector("#app").innerHTML =
    `<div style="padding:3rem;color:#f0e8d6;background:#1b2c25;font-family:monospace"><h1>DCSMCRAFT could not start</h1><p>WebGL is required. Enable hardware acceleration and reload.</p><pre></pre></div>`;
  document.querySelector("pre").textContent = e.message;
  console.error(e);
}
