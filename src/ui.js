import { recordAchievement, scanAchievements } from "./achievements.js";
import { menuLogo } from "./menu-logo.js";
import {
  recipeBookIcon,
  equipmentPlaceholder,
  craftArrowIcon,
} from "./inventory-ui-art.js";
import {
  CREATIVE_TABS,
  creativeEntries as catalogEntries,
  creativeWindow,
} from "./creative-catalog.js";
import { brewingSlotAccepts } from "./aquatic-gear.js";
import { awardXP } from "./equipment.js";
import { validateLocalContainerMenu } from "./world-interactions.js";
import { installStandUI } from "./stand-ui.js";
import { activeTrial } from "./rift-trial.js";
import {
  probeRelay,
  relayAddressInfo,
  validateRelayAccess,
  readSavedRelay,
  saveRelay,
} from "./relay-connection.js";
import { weaponMoveText } from "./weapon-hud.js";
import { beginInvasion, invasionState, INVADERS } from "./invasion.js";
import { relayURL } from "./multiplayer.js";
import { CINDER_BIOMES, nearbyCinderSites } from "./cinderworld.js";
import { setWeather } from "./weather.js";
import { debugNavigation } from "./navigation.js";
import { SKINS } from "./skins.js";
import { SkinPreview } from "./skin-preview.js";
import {
  VIDEO_GROUPS,
  VIDEO_CHOICES,
  applyGraphicsPreset,
} from "./graphics.js";
import { BIOMES } from "./biomes.js";
import { menuRoleForAction } from "./menu-audio.js";
import { nextTitleSplash } from "./title-splashes.js";
import {
  ENCHANTMENTS,
  enchantItem,
  enchantLevel,
  enchantCost,
  enchantConflict,
  enchantText,
  armorStats,
} from "./equipment.js";
import { uniqueId, cloneState } from "./compat.js";
import { exportWorldState } from "./save-session.js";
import {
  BLOCKS,
  MOB_INFO,
  ITEMS,
  RECIPES,
  CREATIVE_ITEMS,
  VERSION,
  REFERENCE,
  makeStack,
  CYCLE_TEXT,
  VILLAGER_TRADES,
  attackCooldown,
  ARMOR_SLOTS,
  FUELS,
  SMELTS,
} from "./data.js";
import { iconURL } from "./textures.js";
import { compatible } from "./inventory.js";
import { tradeWithVillager } from "./ecology.js";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cube = `<svg viewBox="0 0 40 44" aria-hidden="true"><path fill="#a9bf7b" d="m20 1 19 11-19 11L1 12Z"/><path fill="#6f8c55" d="m1 12 19 11v21L1 33Z"/><path fill="#3c5940" d="m39 12-19 11v21l19-11Z"/><path fill="#cad79c" d="m20 1 19 11-6 3L14 4Z"/></svg>`;
const arrow =
  '<span class="arrow-icon" aria-hidden="true"><svg viewBox="0 0 18 18"><path d="M4 14 14 4M4 4h10v10" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span>';
const itemHTML = (s, large = false) =>
  s
    ? `<img draggable="false" alt="${esc(ITEMS[s.id]?.name || s.id)}" src="${iconURL(s.id)}" class="${s.enchantments || ITEMS[s.id]?.legendary ? "enchanted-item" : ""}"/>${s.count > 1 ? `<b>${s.count}</b>` : ""}${s.durability !== undefined && s.durability < ITEMS[s.id].durability ? `<i class="durability" style="--wear:${(s.durability / ITEMS[s.id].durability) * 100}%"></i>` : ""}`
    : "";
export class UI {
  constructor(game) {
    this.game = game;
    this.screen = "title";
    this.debug = false;
    this.root = document.createElement("div");
    this.root.id = "ui";
    this.root.innerHTML = `<div id="overlay"></div><div id="hud" hidden></div><div id="toast" role="status"></div><div id="cursor-item"></div><div id="tooltip"></div><div id="cycle-banner" aria-live="polite"><strong></strong><span></span></div>`;
    document.querySelector("#app").append(this.root);
    this.overlay = this.root.querySelector("#overlay");
    this.hud = this.root.querySelector("#hud");
    this.cursorEl = this.root.querySelector("#cursor-item");
    this.storageWarning = document.createElement("aside");
    this.storageWarning.id = "storage-warning";
    this.storageWarning.hidden = true;
    this.storageWarning.setAttribute("role", "alert");
    this.storageWarning.innerHTML =
      '<span></span><button type="button">Export latest backup</button>';
    this.storageWarning
      .querySelector("button")
      .addEventListener("click", () => {
        this.game.audio.menu("select");
        this.exportWorld(this.storageWarning.dataset.world);
      });
    this.root.append(this.storageWarning);
    this.tooltip = this.root.querySelector("#tooltip");
    this.bind();
    installStandUI(this);
  }
  bind() {
    this.overlay.addEventListener("click", (e) => {
      const button = e.target.closest("[data-action]");
      if (!button || button.disabled) return;
      const action = button.dataset.action;
      if (action === "start-world") {
        this.startWorld(button.closest("#world-form"));
        return;
      }
      this.game.audio.unlock();
      this.game.audio.menu(menuRoleForAction(action));
      if (action === "multiplayer") this.multiplayerMenu();
      if (action === "world-chat") this.game.chat.open();
      if (action === "connect-multiplayer") this.connectMultiplayer(button);
      if (action === "test-relay") this.testRelay(button);
      if (action === "copy-invite") this.copyInvite();
      if (action === "disconnect-multiplayer") {
        if (this.game.multiplayer.isGuest) this.game.quit();
        else {
          this.game.multiplayer.disconnect();
          this.pause("Co-op closed. Your world is now singleplayer.");
        }
      }
      if (action === "kick-player")
        this.game.multiplayer.send({ type: "kick", id: button.dataset.id });
      if (action === "send-chat") this.sendChat();
      if (action === "create") this.create();
      if (action === "title") this.title();
      if (action === "worlds") this.worlds();
      if (action === "guide") {
        if (this.screen === "settings") this.optionSubpage = "guide";
        this.guide();
      }
      if (action === "features") this.features();
      if (action === "settings") this.settings();
      if (action === "achievements") this.achievements();
      if (action === "titan-menu") this.game.giganto.menu();
      if (action === "weather") this.weather();
      if (action === "jukebox") this.game.jukebox.open();
      if (action === "set-weather" && this.game.mode === "creative") {
        setWeather(this.game.world, button.dataset.weather);
        this.weather();
      }
      if (action === "skins") {
        if (this.screen === "settings") this.optionSubpage = "skins";
        this.skins();
      }
      if (action === "choose-skin" && SKINS[button.dataset.skin]) {
        this.chooseSkin(button.dataset.skin);
      }
      if (action === "cycle-skin") {
        const ids = Object.keys(SKINS),
          index = ids.indexOf(this.game.settings.skin);
        this.chooseSkin(
          ids[(index + Number(button.dataset.step) + ids.length) % ids.length],
        );
      }
      if (action === "turn-skin") {
        this.skinPreview?.turn((Number(button.dataset.turn) * Math.PI) / 4);
      }
      if (action === "enchant-select")
        this.enchanting(Number(button.dataset.index));
      if (action === "enchant-item") {
        const result = enchantItem(
          this.game,
          this.enchantIndex,
          button.dataset.enchantment,
        );
        this.toast(result.message);
        this.enchanting(this.enchantIndex);
      }
      if (action === "cinder-guide") this.cinderGuide();
      if (action === "aquatic-guide") this.aquaticGuide();
      if (action === "journal") this.game.openJournal();
      if (
        action === "summon-incursion" &&
        this.game.mode === "creative" &&
        !this.game.multiplayer?.isGuest
      ) {
        if (beginInvasion(this.game)) this.game.resume();
        else
          this.toast(
            "Move to an open, unbuilt clearing, wait for chunks to load, then try again. Each world has one incursion.",
            7000,
          );
      }
      if (action === "toggle-audio") {
        const key = button.dataset.audio;
        this.game.settings[key] = !this.game.settings[key];
        this.saveSettings();
        this.game.audio.updateVolume();
        if (!this.game.settings.ambientSounds) this.game.audio.silenceAmbient();
        this.soundSettings();
      }
      if (action === "sound-settings") this.soundSettings();
      if (action === "cycle-settings") this.cycleSettings();
      if (action === "video-settings") this.videoSettings();
      if (
        action === "graphics-preset" &&
        applyGraphicsPreset(this.game.settings, button.dataset.preset)
      ) {
        this.game.renderer.applyGraphics();
        this.saveSettings();
        this.videoSettings();
      }
      if (action === "toggle-graphics") {
        const key = button.dataset.graphics;
        this.game.settings[key] = !this.game.settings[key];
        this.saveSettings();
        this.game.renderer.applyGraphics();
        this.videoSettings();
      }
      if (action === "fullscreen") {
        const op = document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen?.();
        op?.catch(() =>
          this.toast("Fullscreen is unavailable in this viewer."),
        );
      }
      if (action === "trade") {
        const result = tradeWithVillager(
          this.game,
          this.tradingEntity,
          Number(button.dataset.trade),
        );
        this.toast(result.message);
        this.trading(this.tradingEntity);
      }

      if (action === "quit-desktop") window.dcsmcraftDesktop?.quit();
      if (action === "download-game") this.downloadGame();
      if (action === "backup-current") this.exportWorld(this.game.id);
      if (action === "reset-cycle") {
        this.game.settings.cycleText = { ...CYCLE_TEXT };
        this.saveSettings();
        this.cycleSettings();
      }
      if (action === "preview-cycle") {
        const entries = Object.entries(this.game.settings.cycleText),
          item = entries[(this.previewCycleIndex || 0) % entries.length];
        this.previewCycleIndex = (this.previewCycleIndex || 0) + 1;
        this.overlay.querySelector("#message-preview").textContent =
          item[1] || "(This message is disabled)";
        this.game.audio.tone(item[0].includes("night") ? "dusk" : "dawn");
      }
      if (action === "back") this.back();
      if (action === "resume") this.game.resume();
      if (action === "quit") this.game.quit();
      if (action === "respawn") this.game.respawn();
      if (action === "world-tools") this.worldTools();
      if (action === "close-inv") this.game.closeInventory();
      if (action === "load") this.game.loadWorld(button.dataset.id);
      if (action === "export") this.exportWorld(button.dataset.id);
      if (action === "toggle-recipes") this.toggleRecipeBook();
      if (action === "recipe-page")
        this.overlay.querySelector(".recipe-list").innerHTML =
          this.recipeEntries(this.recipeQuery, Number(button.dataset.page));
      if (action === "recipe") {
        this.game.autofill(
          RECIPES[Number(button.dataset.recipe)],
          this.craftSize,
        );
      }
      if (action === "creative-stand")
        this.selectCreativeStand(button.dataset.stand);
      if (action === "creative-tab") {
        if (button.dataset.category) {
          this.creativeCategory = button.dataset.category;
          this.catalogQuery = "";
          this.catalogScroll = 0;
        }
        this.creativeTab = button.dataset.tab;
        this.buildInventory();
      }
      if (action === "craft") this.craft(e.shiftKey);
      if (action === "delete") {
        if (button.dataset.confirm === "yes") {
          this.game.store
            .remove(button.dataset.id)
            .then(() => this.worlds())
            .catch((e) => this.toast("Delete failed: " + e.message));
        } else {
          button.dataset.confirm = "yes";
          button.textContent = "Confirm delete";
          button.classList.add("danger");
        }
      }
    });
    this.overlay.addEventListener("submit", (e) => {
      e.preventDefault();
      if (e.target.id === "world-form") this.startWorld(e.target);
      if (e.target.id === "chat-form") this.sendChat();
    });
    this.overlay.addEventListener("keydown", (e) => {
      if (
        this.screen === "skins" &&
        e.target.closest('[data-skin], [data-action="cycle-skin"]') &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      ) {
        e.preventDefault();
        const ids = Object.keys(SKINS),
          index = ids.indexOf(this.game.settings.skin),
          step = ["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1;
        this.game.audio.menu("select");
        this.chooseSkin(ids[(index + step + ids.length) % ids.length]);
        this.overlay
          .querySelector(`[data-skin="${this.game.settings.skin}"]`)
          ?.focus();
      }
      const form = e.target.closest("#world-form");
      if (form && e.key === "Enter" && !e.target.closest("button")) {
        e.preventDefault();
        this.startWorld(form);
      }
    });
    this.overlay.addEventListener("change", (e) => {
      if (
        e.target.tagName === "SELECT" ||
        ["radio", "checkbox"].includes(e.target.type)
      ) {
        this.game.audio.unlock();
        this.game.audio.menu("select");
      }
      if (e.target.name === "relay-access") {
        const input = this.overlay.querySelector("#multiplayer-server");
        if (e.target.value === "public" && input) {
          try {
            if (!relayAddressInfo(input.value).publicHTTPS) input.value = "";
          } catch {
            input.value = "";
          }
        } else if (input && !input.value) input.value = "http://localhost:8787";
      }
      if (e.target.id === "import-world" && e.target.files?.[0])
        this.importWorld(e.target.files[0]);
    });
    this.overlay.addEventListener("input", (e) => {
      if (e.target.type === "range") {
        this.game.audio.unlock();
        this.game.audio.menu("slide");
      }
      if (e.target.dataset.preference) {
        const key = e.target.dataset.preference,
          choices = VIDEO_CHOICES[key];
        const entry = choices?.find(
          ([value]) => String(value) === e.target.value,
        );
        if (entry) {
          this.game.settings[key] = entry[0];
          this.game.renderer.applyGraphics();
          this.saveSettings();
        }
      }
      if (e.target.dataset.setting) {
        const key = e.target.dataset.setting,
          value = Number(e.target.value);
        this.game.settings[key] = value;
        this.saveSettings();
        if (key === "graphics") {
          this.game.renderer.applyGraphics();
          this.saveSettings();
        }
        if (["mipmapLevels", "brightness", "biomeBlend"].includes(key))
          this.game.renderer.applyGraphics();
        if (["volume", "menuVolume"].includes(key))
          this.game.audio.updateVolume();
        const output = this.overlay.querySelector(`[data-value="${key}"]`);
        if (output) output.textContent = this.settingValue(key, value);
      }
      if (e.target.dataset.cycle) {
        this.game.settings.cycleText[e.target.dataset.cycle] =
          e.target.value.slice(0, 140);
        this.saveSettings();
      }
      if (e.target.id === "recipe-craftable") {
        this.recipeCraftableOnly = e.target.checked;
        this.overlay.querySelector(".recipe-list").innerHTML =
          this.recipeEntries(this.recipeQuery || "");
      }
      if (e.target.id === "recipe-search")
        this.overlay.querySelector(".recipe-list").innerHTML =
          this.recipeEntries(e.target.value);
      if (e.target.id === "creative-scrollbar") {
        const viewport = this.overlay.querySelector(".creative-catalog");
        viewport.scrollTop =
          (Number(e.target.value) * viewport.clientWidth) / 9;
        this.catalogScroll = viewport.scrollTop;
        this.renderCreativeRows();
      }
      if (e.target.id === "creative-search") {
        this.catalogQuery = e.target.value;
        this.catalogScroll = 0;
        this.updateCreativeCatalog();
      }
    });
    this.overlay.addEventListener(
      "scroll",
      (e) => {
        if (e.target.classList?.contains("creative-catalog")) {
          this.catalogScroll = e.target.scrollTop;
          this.renderCreativeRows();
        }
      },
      true,
    );
    this.overlay.addEventListener("keydown", (e) => {
      const tab = e.target.closest("[data-creative-tab]");
      if (!tab) return;
      const all = [...this.overlay.querySelectorAll("[data-creative-tab]")],
        i = all.indexOf(tab);
      const next =
        e.key === "ArrowRight"
          ? (i + 1) % all.length
          : e.key === "ArrowLeft"
            ? (i + all.length - 1) % all.length
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? all.length - 1
                : -1;
      if (next < 0) return;
      e.preventDefault();
      const target = all[next].dataset.creativeTab;
      all[next].click();
      this.overlay.querySelector(`[data-creative-tab="${target}"]`)?.focus();
    });
    this.overlay.addEventListener("focusin", (e) => {
      const option = e.target.closest("[data-action], select");
      if (option && !option.disabled) this.game.audio.menu("hover");
    });
    this.overlay.addEventListener("mousedown", (e) => {
      const cell = e.target.closest(".slot[data-ref]");
      if (!cell || this.screen !== "inventory") return;
      e.preventDefault();
      this.slotClick(cell, e);
    });
    this.overlay.addEventListener("mouseover", (e) => {
      const option = e.target.closest("[data-action]");
      if (option && !option.disabled && !option.contains(e.relatedTarget)) {
        this.game.audio.menu("hover");
      }
      const cell = e.target.closest(".slot[data-ref]");
      if (
        this.dragging &&
        cell &&
        e.buttons &&
        this.dragVisited?.has(cell.dataset.ref + cell.dataset.index) === false
      ) {
        this.dragVisited.add(cell.dataset.ref + cell.dataset.index);
        this.slotClick(cell, { button: 2, shiftKey: false, drag: true });
      }
    });
    addEventListener("mouseup", () => {
      this.dragging = false;
      this.dragVisited = null;
    });
    addEventListener("mousemove", (e) => {
      this.cursorEl.style.transform = `translate(${e.clientX + 12}px,${e.clientY + 12}px)`;
      this.tooltip.style.left =
        Math.min(innerWidth - 220, e.clientX + 16) + "px";
      this.tooltip.style.top =
        Math.min(innerHeight - 80, e.clientY + 20) + "px";
      const s = e.target.closest("[data-tooltip]");
      this.tooltip.hidden = !s || !!this.game.inventory.cursor;
      if (s) this.tooltip.textContent = s.dataset.tooltip;
    });
  }
  startWorld(form) {
    if (!form || this.creatingWorld || !form.reportValidity()) return;
    this.game.audio.unlock();
    this.game.audio.menu("select");
    this.creatingWorld = true;
    const button = form.querySelector('[data-action="start-world"]');
    if (button) button.disabled = true;
    // A script-enabled HTML preview may prohibit native form submission.
    // Read the fields and call the game directly instead of navigating a form.
    this.game
      .newWorld(Object.fromEntries(new FormData(form)))
      .catch((error) => this.error(error.message))
      .finally(() => {
        this.creatingWorld = false;
        if (button?.isConnected) button.disabled = false;
      });
  }
  header() {
    return "";
  }
  setScreen(screen, html) {
    this.skinPreview?.dispose();
    this.skinPreview = null;
    this.inventoryPreview?.dispose();
    this.inventoryPreview = null;
    this.creativeViewportObserver?.disconnect();
    this.screen = screen;
    if (["settings", "title", "pause"].includes(screen))
      this.optionSubpage = null;
    this.hud.hidden = screen !== "play";
    this.overlay.className = screen === "play" ? "" : "visible";
    this.overlay.dataset.screen = screen;
    document.querySelector("#app").dataset.screen = screen;
    this.overlay.innerHTML = html;
    this.cursorEl.hidden = screen !== "inventory";
    this.tooltip.hidden = true;
    this.refreshSaveStatus();
  }
  async title() {
    this.game.running = false;
    this.game.resetControls();
    this.titleSplash = nextTitleSplash(this.titleSplash);
    this.setScreen(
      "title",
      `${this.header()}<main class="title-layout block-title"><section class="hero"><h1><span class="sr-only">DCSMCRAFT</span>${menuLogo().replace('role="img" aria-label="DCSMCRAFT"', 'aria-hidden="true"')}</h1><div class="title-splash-space"><div class="title-splash">${esc(this.titleSplash)}</div></div></section><section class="world-panel"><h2 class="sr-only">Singleplayer</h2><div id="recent-world"></div><button class="primary wide saved-worlds" data-action="worlds">Singleplayer <span id="world-count">0</span></button><button class="secondary wide" data-action="multiplayer">Multiplayer</button><button class="primary wide" data-action="create">Create New World</button><div class="title-button-grid"><button class="secondary" data-action="settings">Options</button><button class="secondary" data-action="guide">Controls</button></div><div class="title-button-grid"><button class="secondary" data-action="skins">Skins</button>${window.dcsmcraftDesktop ? '<button class="secondary" data-action="quit-desktop">Quit Game</button>' : window.DCSMCRAFT_HTML_SOURCE ? '<button class="secondary" data-action="download-game">Save game HTML</button>' : this.game.mobileApp ? '<button class="secondary" data-action="mobile-app">Mobile & Offline</button>' : '<button class="secondary" data-action="guide">Controls</button>'}</div></section></main><footer class="title-footer"><div class="footer-line"><span>v${VERSION}</span><button data-action="features">About</button></div></footer>`,
    );
    try {
      const worlds = await this.game.store.list();
      if (this.screen !== "title") return;
      this.overlay.querySelector("#world-count").textContent = worlds.length;
      if (worlds.length) {
        const w = worlds[0];
        this.overlay.querySelector("#recent-world").innerHTML =
          `<button class="recent-world" data-action="load" data-id="${esc(w.id)}"><span class="world-thumb">${cube}</span><span><small>CONTINUE</small><b>${esc(w.name)}</b></span><span>→</span></button>`;
      }
    } catch (e) {
      this.toast("Browser storage is unavailable: " + e.message, 7000);
    }
  }
  multiplayerMenu(invite = "") {
    const m = this.game.multiplayer;
    const suggested =
      readSavedRelay() ||
      (location.protocol === "http:" || location.protocol === "https:"
        ? location.origin
        : "http://localhost:8787");
    const publicMode = relayAddressInfo(suggested).publicHTTPS;
    this.setScreen(
      "multiplayer",
      `<main class="dialog multiplayer-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Multiplayer</h2><p>Up to 8 players. The host must stay online. T · Chat   / · Commands</p>${m.connected ? `<section class="session-panel"><h3>World: ${esc(this.game.name)}</h3><label>Invitation link<input id="session-invite" value="${esc(m.invite)}" readonly/></label><button class="secondary wide" data-action="copy-invite">Copy Invitation</button><p class="relay-badge">${relayAddressInfo(m.invite).publicHTTPS ? "PUBLIC HTTPS · ENCRYPTED WSS" : relayAddressInfo(m.invite).secure ? "HTTPS/WSS · LOCAL ADDRESS" : "HTTP/WS · LOCAL / LAN ADDRESS"}</p><p class="fine">Keep the host and server running. Use a public HTTPS address for internet play.</p><div id="session-players"></div><div id="chat-log" role="log" aria-live="polite"></div><form id="chat-form"><label>Message<input id="chat-message" maxlength="160" autocomplete="off" placeholder="Message…"/></label><button type="submit" class="secondary">Send</button></form><button class="secondary wide" data-action="disconnect-multiplayer">${m.isGuest ? "Leave Server" : "Close Server"}</button></section>` : `<label>Your name<input id="multiplayer-name" maxlength="20" value="Player" autocomplete="nickname"/></label><section class="multiplayer-choices"><div><h3>Host a World</h3><p>Open a Survival or Creative world, pause, then return here.</p><fieldset class="relay-access"><legend>Relay connection</legend><label><input type="radio" name="relay-access" value="public" ${publicMode ? "checked" : ""}>Public HTTPS · different networks</label><label><input type="radio" name="relay-access" value="local" ${!publicMode ? "checked" : ""}>Local / LAN</label></fieldset><label>Relay address<input id="multiplayer-server" value="${esc(suggested)}" placeholder="https://your-relay.trycloudflare.com"/></label><button class="secondary wide" data-action="test-relay">Test Connection</button><p class="fine">Run HOST-PUBLIC.cmd with Node.js and cloudflared installed. Paste its HTTPS address here. Keep that window open.</p><button class="secondary wide" data-action="connect-multiplayer" data-role="host" ${!this.game.active ? "disabled" : ""}>Open to Friends</button></div><div><h3>Join a World</h3><label>Invitation link<input id="multiplayer-invite" value="${esc(invite)}" placeholder="Paste the full invitation link"/></label><button class="secondary wide" data-action="connect-multiplayer" data-role="guest">Join World</button></div></section><p class="fine">Internet play requires a public HTTPS server. Singleplayer works offline.</p>`}<div id="multiplayer-status" role="status"></div><button class="primary wide" data-action="back">Done</button></main>`,
    );
    if (m.connected) this.updateSession();
  }
  async testRelay(button) {
    const status = this.overlay.querySelector("#multiplayer-status");
    button.disabled = true;
    status.textContent = "Connecting…";
    try {
      const info = await probeRelay(
        this.overlay.querySelector("#multiplayer-server").value,
        {
          access:
            this.overlay.querySelector("[name=relay-access]:checked")?.value ||
            "local",
        },
      );
      if (status.isConnected)
        status.textContent = info.publicHTTPS
          ? "Connected. Share the invitation to invite players."
          : "Connected to local server.";
      saveRelay(info.url);
    } catch (error) {
      if (status.isConnected) status.textContent = error.message;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }
  async connectMultiplayer(button) {
    const status = this.overlay.querySelector("#multiplayer-status");
    button.disabled = true;
    status.textContent = "Connecting…";
    try {
      const server = this.overlay.querySelector("#multiplayer-server")?.value;
      const invite =
        button.dataset.role === "guest"
          ? this.overlay.querySelector("#multiplayer-invite").value
          : null;
      if (invite && this.game.active)
        throw Error(
          "Save and quit your current world before joining another host.",
        );
      if (!invite && server)
        validateRelayAccess(
          server,
          this.overlay.querySelector("[name=relay-access]:checked")?.value ||
            "local",
        );
      const name = this.overlay.querySelector("#multiplayer-name").value;
      await this.game.multiplayer.connect({ server, name, invite });
      if (!invite && server) saveRelay(server);
      if (this.game.multiplayer.isGuest) {
        // The browser may require another gesture for pointer lock after joining.
        this.game.pause();
        this.pause("Connected. Select Back to Game.");
      } else this.multiplayerMenu();
    } catch (e) {
      if (status.isConnected) status.textContent = e.message;
      else this.toast(e.message, 7000);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }
  updateSession() {
    const m = this.game.multiplayer,
      players = this.overlay.querySelector("#session-players"),
      log = this.overlay.querySelector("#chat-log");
    if (players)
      players.innerHTML = `<h3>Players (${m.players.length}/8) · ${m.ping ?? "—"} ms</h3>${m.players.map((p) => `<div class="session-player"><span>${esc(p.name)}${p.host ? " · Host" : ""}</span>${!m.isGuest && !p.host ? `<button class="secondary" data-action="kick-player" data-id="${esc(p.id)}">Remove</button>` : ""}</div>`).join("")}`;
    if (log) {
      log.innerHTML = m.chat
        .map((line) => `<p><b>${esc(line.name)}</b>: ${esc(line.message)}</p>`)
        .join("");
      log.scrollTop = log.scrollHeight;
    }
  }
  sendChat() {
    const input = this.overlay.querySelector("#chat-message");
    if (input?.value.trim()) {
      this.game.chat.send(input.value);
      input.value = "";
    }
  }
  async copyInvite() {
    const input = this.overlay.querySelector("#session-invite");
    if (!input) return;
    try {
      await navigator.clipboard.writeText(input.value);
      this.toast("Invitation copied.");
    } catch {
      input.focus();
      input.select();
      this.toast("Press Ctrl+C to copy the selected invitation.");
    }
  }
  skins() {
    const id = SKINS[this.game.settings.skin]
      ? this.game.settings.skin
      : "explorer";
    this.setScreen(
      "skins",
      `${this.header()}<main class="dialog skin-dialog wardrobe"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Skins</h2><div class="wardrobe-layout"><section class="wardrobe-display" aria-label="Selected outfit"><div class="wardrobe-stage" id="skin-preview"><span class="wardrobe-hint">Drag to turn</span></div><div class="wardrobe-turn"><button class="secondary" data-action="turn-skin" data-turn="-1" aria-label="Turn preview left">◀</button><span>Rotate</span><button class="secondary" data-action="turn-skin" data-turn="1" aria-label="Turn preview right">▶</button></div></section><section class="wardrobe-picker"><div class="wardrobe-cycle"><button class="secondary" data-action="cycle-skin" data-step="-1" aria-label="Previous skin">◀</button><div><h3 id="skin-name"></h3><span id="skin-number"></span></div><button class="secondary" data-action="cycle-skin" data-step="1" aria-label="Next skin">▶</button></div><div class="wardrobe-list" aria-label="Outfits">${Object.entries(
        SKINS,
      )
        .map(
          ([key, skin]) =>
            `<button class="secondary wardrobe-choice" data-action="choose-skin" data-skin="${key}" aria-pressed="${id === key}"><span class="outfit-swatch" style="--outfit:${skin.shirt};--trim:${skin.accent}" aria-hidden="true"></span><span>${esc(skin.name)}</span><span class="outfit-check" aria-hidden="true">◆</span></button>`,
        )
        .join(
          "",
        )}</div></section></div><button class="primary wide" data-action="back">Done</button></main>`,
    );
    const container = this.overlay.querySelector("#skin-preview");
    try {
      this.skinPreview = new SkinPreview(container, id);
    } catch (error) {
      container.insertAdjacentHTML(
        "beforeend",
        '<p class="preview-error">Preview unavailable.</p>',
      );
      console.warn("Outfit preview unavailable:", error);
    }
    this.updateSkinSelection(id);
  }
  chooseSkin(id) {
    if (!SKINS[id]) return;
    this.game.settings.skin = id;
    this.saveSettings();
    this.updateSkinSelection(id);
  }
  updateSkinSelection(id) {
    const skin = SKINS[id],
      ids = Object.keys(SKINS);
    for (const button of this.overlay.querySelectorAll("[data-skin]"))
      button.setAttribute("aria-pressed", String(button.dataset.skin === id));
    this.overlay.querySelector("#skin-name").textContent = skin.name;
    this.overlay.querySelector("#skin-number").textContent =
      `${ids.indexOf(id) + 1} / ${ids.length}`;

    this.skinPreview?.setSkin(id);
  }
  create() {
    this.setScreen(
      "create",
      `${this.header()}<main class="dialog create-dialog"><form id="world-form"><div class="dialog-top"><button type="button" class="close" data-action="title" aria-label="Close">×</button></div><h2>Create New World</h2><label>WORLD NAME<input name="name" maxlength="48" value="New World" required autocomplete="off"/></label><label>WORLD SEED <small>Optional · letters or numbers</small><input name="seed" maxlength="80" placeholder="Random" autocomplete="off"/></label><fieldset><legend>GAME MODE</legend><label class="radio-card"><input type="radio" name="mode" value="survival" checked/><span><b>Survival</b><small>Gather resources and survive.</small></span><span>◈</span></label><label class="radio-card"><input type="radio" name="mode" value="creative"/><span><b>Creative</b><small>Unlimited blocks and flight.</small></span><span>▧</span></label></fieldset><label class="select-label">DIFFICULTY<select name="difficulty"><option value="peaceful">Peaceful</option><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label><button class="primary wide" type="button" data-action="start-world">Create New World</button></form></main>`,
    );
  }
  async worlds() {
    this.setScreen(
      "worlds",
      `${this.header()}<main class="dialog list-dialog"><div class="dialog-top"><button class="close" data-action="title" aria-label="Close">×</button></div><h2>Your Worlds</h2><p class="muted">Saved on this device, in this browser. Export a backup before clearing browser data.</p><div id="world-list" class="world-list">Loading worlds…</div><div class="world-list-actions"><button class="primary" data-action="create">Create New World</button><label class="import-button">Import backup<input id="import-world" type="file" accept="application/json,.json" hidden/></label></div></main>`,
    );
    try {
      const worlds = await this.game.store.list();
      if (this.screen !== "worlds") return;
      this.overlay.querySelector("#world-list").innerHTML = worlds.length
        ? worlds
            .map(
              (w) =>
                `<article class="world-row"><div class="world-thumb">${cube}</div><div class="world-details"><h3>${esc(w.name)}</h3><p>${esc(w.mode)} · Day ${w.day} · Seed ${esc(w.seed)}</p><small>${new Date(w.updated).toLocaleString()}</small></div><button class="primary small" data-action="load" data-id="${esc(w.id)}">Play →</button><button class="icon-button" data-action="export" data-id="${esc(w.id)}" title="Export world backup">↓</button><button class="icon-button" data-action="delete" data-id="${esc(w.id)}" title="Delete world">×</button></article>`,
            )
            .join("")
        : `<div class="empty-state">${cube}<h3>No saved worlds yet.</h3><p>Create New World to fill this shelf.</p></div>`;
    } catch (e) {
      this.error(e.message);
    }
  }
  async importWorld(file) {
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("The backup is larger than 20 MB.");
      const data = JSON.parse(await file.text());
      if (
        data.format !== 1 ||
        typeof data.seed !== "string" ||
        !data.player ||
        !data.inventory ||
        !data.edits ||
        !["survival", "creative"].includes(data.mode)
      )
        throw new Error("This is not a supported DCSMCRAFT backup.");
      for (const s of [
        ...(data.inventory.slots || []),
        ...(data.inventory.craft || []),
        ...(data.inventory.equipment || []),
        data.inventory.cursor,
      ])
        if (
          s &&
          (!ITEMS[s.id] ||
            !Number.isInteger(s.count) ||
            s.count < 1 ||
            s.count > ITEMS[s.id].stack)
        )
          throw new Error("Invalid inventory in backup.");
      for (const [pos, id] of Object.entries(data.edits))
        if (
          !/^-?\d+,-?\d+,-?\d+$/.test(pos) ||
          !Number.isInteger(id) ||
          !BLOCKS[id]
        )
          throw new Error("Invalid terrain edits in backup.");
      if (
        ![data.player.x, data.player.y, data.player.z, data.time].every(
          Number.isFinite,
        )
      )
        throw new Error("Invalid player data in backup.");
      data.id = uniqueId();
      data.name = String(data.name || "Imported world").slice(0, 48);
      const outcome = await this.game.store.save(data);
      if (outcome.status === "failed") throw new Error(outcome.error);
      this.worlds();
      this.toast(
        outcome.status === "durable"
          ? "Backup imported as a separate world."
          : "Imported for this session only. Export before closing.",
        6000,
      );
    } catch (e) {
      this.toast("Import failed: " + e.message, 6000);
    }
  }
  async exportWorld(id) {
    try {
      const data = await exportWorldState(this.game, id),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data)], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = `dcsmcraft-${data.name.replace(/[^a-z0-9]/gi, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.toast("World backup exported.");
    } catch (e) {
      this.toast(e.message);
    }
  }
  loading(message) {
    this.setScreen(
      "loading",
      `<div class="loading-screen">${cube}<h2>${esc(message)}</h2><span class="loading-dots">■ ■ ■</span></div>`,
    );
  }
  error(message) {
    this.setScreen(
      "error",
      `<main class="dialog compact"><h2>Unable to continue</h2><p>${esc(message)}</p><button class="primary" data-action="${this.game.active ? "resume" : "title"}">${this.game.active ? "Return to world" : "Back to title"} →</button></main>`,
    );
  }
  play() {
    this.lastHUD = null;
    this.setScreen("play", "");
    this.hud.innerHTML = `<div class="hud-brand">${cube}<span>DCSMCRAFT<small id="hud-biome"></small></span></div><div class="world-clock"><span id="day-icon">☀</span><span id="day-label"></span><span class="clock-rule"></span><small id="mode-label"></small></div><div id="target-label"></div><div id="crosshair"><i></i><i></i></div><div id="attack-cooldown" role="progressbar" aria-label="Attack recovery" aria-valuemin="0" aria-valuemax="100" hidden><i></i></div><div id="mining-bar"><i></i></div><div id="hurt-vignette"></div><div id="water-vignette"></div><div id="fps-counter"></div><div id="hud-debug" hidden></div><div class="hud-bottom"><div id="weapon-moves" aria-label="Weapon moves" hidden></div><div class="selected-name" id="selected-name"></div><div id="survival-bars"><div id="armor-bar"></div><div id="oxygen"></div><div class="vital-row"><div id="hearts"></div><div id="hunger"></div></div><div class="xp-line"><span id="xp-level"></span><i id="xp-fill"></i></div></div><div id="hotbar" class="hotbar"></div><div class="hud-hint"><span><kbd>E</kbd> Inventory</span><span><kbd>ESC</kbd> Pause & controls</span><span id="save-status">${this.game.multiplayer?.isGuest ? "SAVED BY HOST" : this.game.store.temporary ? "SESSION ONLY · EXPORT TO KEEP" : "SAVED LOCALLY"}</span></div></div>`;
    this.updateHotbar();
    this.updateHUD();
    this.refreshSaveStatus();
  }
  pause(message = "") {
    if (this.game.giganto?.active) return this.game.giganto.pauseMenu();
    this.game.running = false;
    this.setScreen(
      "pause",
      `<div class="pause-shade"></div><main class="dialog compact pause-dialog"><h2>Game Menu</h2>${message ? `<p>${esc(message)}</p>` : ""}<button class="primary wide" data-action="resume">Back to Game</button><div class="pause-actions"><button class="secondary" data-action="achievements">Achievements</button><button class="secondary" data-action="guide">Controls</button><button class="secondary" data-action="journal">Relic Journal</button><button class="secondary" data-action="settings">Options...</button><button class="secondary" data-action="multiplayer">${this.game.multiplayer?.connected ? "Players" : "Multiplayer"}</button><button class="secondary" data-action="world-chat">Chat</button><button class="secondary" data-action="world-tools">World...</button></div><button class="secondary wide" data-action="quit">${this.game.multiplayer?.isGuest ? "Leave Server" : "Save and Quit to Title"}</button></main>`,
    );
  }
  worldTools() {
    const g = this.game;
    this.setScreen(
      "world-tools",
      `<main class="dialog compact"><h2>World</h2><button data-action="titan-menu">Giganto</button><button data-action="jukebox">Jukebox</button><button data-action="cinder-guide">Cinderworld</button><button data-action="aquatic-guide">Ocean Journal</button>${g.mode === "creative" ? '<button data-action="weather">Weather</button>' : ""}${!g.multiplayer?.isGuest ? '<button data-action="backup-current">Export world backup</button>' : ""}${window.DCSMCRAFT_HTML_SOURCE ? '<button data-action="download-game">Save game HTML</button>' : ""}<button data-action="back">Done</button></main>`,
    );
  }
  settingValue(key, value) {
    if (key === "graphics")
      return [
        "50% · Fast",
        "70% · Low",
        "100% · Native",
        "125% · High",
        "150% · Ultra",
      ][value - 1];
    if (key === "cloudHeight") return `Y ${Math.round(value)}`;
    if (key === "brightness") return `${Math.round(value * 100)}%`;
    if (["entityDistance", "droppedItemDistance"].includes(key))
      return `${Math.round(value * 100)}%`;
    if (key === "blockEntityDistance") return `${Math.round(value)} blocks`;
    if (key === "mipmapLevels") return value === 0 ? "OFF" : `${value} levels`;
    if (key === "biomeBlend")
      return value === 0 ? "OFF" : `${value} block radius`;
    return key === "sensitivity"
      ? `${Math.round((value / 0.002) * 100)}%`
      : [
            "volume",
            "ambientVolume",
            "mobVolume",
            "musicVolume",
            "menuVolume",
          ].includes(key)
        ? `${Math.round(value * 100)}%`
        : key === "FOV"
          ? `${value}°`
          : `${value} chunks`;
  }
  weather() {
    const w = this.game.world.weather;
    this.setScreen(
      "weather",
      `${this.header()}<main class="dialog compact"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Weather</h2><p>Creative control · Current sky: ${esc(w.kind)}. Cold biomes receive snow; deserts stay dry. Weather fades in gradually.</p><div class="weather-options">${[
        ["auto", "Natural cycle"],
        ["clear", "Clear skies"],
        ["rain", "Rain / snow"],
        ["thunder", "Thunderstorm"],
        ["hail", "Hailstorm"],
        ["tornado", "Tornado"],
      ]
        .map(
          ([key, label]) =>
            `<button class="secondary wide" data-action="set-weather" data-weather="${key}" aria-pressed="${(w.override || "auto") === key}">${label}</button>`,
        )
        .join(
          "",
        )}</div><p class="fine">Thunderstorms have rain, distant lightning and thunder. Hail hurts exposed players; tornado funnels pull and lift nearby players. Solid roofs shelter both. Funnels never destroy your buildings. Peaceful/Creative disable weather damage. Snow accumulates in thin layers on exposed cold surfaces and melts near warmth. Natural weather and Creative overrides save with the world.</p><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  back() {
    if (
      [
        "video",
        "sound",
        "cycle",
        "controller-settings",
        "touch-settings",
        "mobile-app",
      ].includes(this.screen) ||
      this.optionSubpage === this.screen
    )
      this.settings();
    else if (this.game.active) this.pause();
    else this.title();
  }
  settingSliders(fields) {
    return fields
      .map(
        ([key, label, min, max, step]) =>
          `<label class="range-label"><span>${label}<output data-value="${key}">${this.settingValue(key, this.game.settings[key])}</output></span><input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${this.game.settings[key]}"/></label>`,
      )
      .join("");
  }
  settings() {
    this.setScreen(
      "settings",
      `<main class="dialog settings-dialog java-options"><h2>Options</h2><div class="options-sliders">${this.settingSliders(
        [
          ["FOV", "Field of View", 55, 110, 1],
          ["sensitivity", "Mouse Sensitivity", 0.0005, 0.005, 0.0001],
        ],
      )}</div><div class="title-button-grid options-pages"><button data-action="skins">Skin Customization...</button><button data-action="sound-settings">Music & Sounds...</button><button data-action="video-settings">Video Settings...</button><button data-action="guide">Controls...</button><button data-action="controller-settings">Controller...</button><button data-action="touch-settings">Touch Controls...</button>${this.game.mobileApp ? '<button data-action="mobile-app">Mobile & Offline...</button>' : ""}<button data-action="cycle-settings">World Messages...</button></div><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  soundSettings() {
    const toggles = [
      ["ambientSounds", "Ambient Sounds"],
      ["mobSounds", "Creature Sounds"],
      ["musicEnabled", "Music"],
      ["menuSounds", "Menu Sounds"],
    ];
    this.setScreen(
      "sound",
      `<main class="dialog settings-dialog java-options"><h2>Music & Sounds</h2><div class="options-sliders">${this.settingSliders(
        [
          ["volume", "Master Volume", 0, 1, 0.05],
          ["musicVolume", "Music", 0, 1, 0.05],
          ["ambientVolume", "Ambient", 0, 1, 0.05],
          ["mobVolume", "Creatures", 0, 1, 0.05],
          ["menuVolume", "Menu Sounds", 0, 1, 0.05],
        ],
      )}</div><div class="title-button-grid">${toggles.map(([key, label]) => `<button data-action="toggle-audio" data-audio="${key}" aria-pressed="${this.game.settings[key]}">${label}: ${this.game.settings[key] ? "ON" : "OFF"}</button>`).join("")}</div><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  cycleSettings() {
    this.setScreen(
      "cycle",
      `<main class="dialog settings-dialog"><h2>World Messages</h2><fieldset class="cycle-settings"><legend>Custom day & night messages</legend>${Object.entries(
        {
          dayEnd: "Sunset · day ending",
          nightStart: "Night begins",
          nightEnd: "Dawn · night ending",
          dayStart: "Day begins",
        },
      )
        .map(
          ([key, label]) =>
            `<label>${label}<input data-cycle="${key}" value="${esc(this.game.settings.cycleText[key])}" maxlength="140"/></label>`,
        )
        .join(
          "",
        )}<div class="title-button-grid"><button class="secondary" data-action="preview-cycle">Preview messages</button><button class="secondary" data-action="reset-cycle">Restore messages</button></div><div id="message-preview" role="status">Your messages appear at sunset, nightfall, dawn, and sunrise. An empty line disables that message.</div></fieldset><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  videoSettings() {
    const s = this.game.settings;
    const field = ([key, label, ...args]) => {
      if (Array.isArray(args[0]))
        return `<label class="video-choice"><span>${label}</span><select data-preference="${key}" aria-label="${label}">${args[0].map(([value, name]) => `<option value="${value}" ${s[key] === value ? "selected" : ""}>${name}</option>`).join("")}</select></label>`;
      if (args.length)
        return `<label class="range-label"><span>${label}<output data-value="${key}">${this.settingValue(key, s[key])}</output></span><input aria-label="${label}" type="range" data-setting="${key}" min="${args[0]}" max="${args[1]}" step="${args[2]}" value="${s[key]}"/></label>`;
      return `<button class="secondary" data-action="toggle-graphics" data-graphics="${key}" aria-pressed="${s[key]}">${label}: ${s[key] ? "ON" : "OFF"}</button>`;
    };
    const group = ([name, note, fields]) =>
      `<section class="video-group"><h3>${name}</h3><p>${note}</p><div class="video-fields">${fields.map(field).join("")}</div></section>`;
    this.setScreen(
      "video",
      `${this.header("settings")}<main class="dialog settings-dialog video-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Video Settings</h2><div class="graphics-presets" aria-label="Graphics presets"><button class="secondary" data-action="graphics-preset" data-preset="fast">Fast</button><button class="secondary" data-action="graphics-preset" data-preset="balanced">Balanced</button><button class="secondary" data-action="graphics-preset" data-preset="detailed">Detailed</button></div><div class="video-groups"><div class="video-column">${[VIDEO_GROUPS[0], VIDEO_GROUPS[3]].map(group).join("")}</div><div class="video-column">${[VIDEO_GROUPS[1], VIDEO_GROUPS[2]].map(group).join("")}</div></div><div class="title-button-grid"><button class="secondary" data-action="fullscreen">Toggle Fullscreen</button><button class="primary" data-action="back">Done</button></div></main>`,
    );
  }

  enchanting(index = -1) {
    this.enchantIndex = index;
    const g = this.game,
      stack = g.inventory.slots[index],
      item = ITEMS[stack?.id];
    this.setScreen(
      "enchanting",
      `<main class="dialog enchanting-dialog"><div class="dialog-top"><span class="eyebrow">ENCHANTING TABLE</span><button class="close" data-action="close-inv" aria-label="Close enchanting">×</button></div><h2>Enchant Equipment</h2><p>Choose an item below. Each upgrade costs XP points and lapis; Creative upgrades are free.</p><div class="enchant-selected">${stack ? itemHTML(stack) : "Select a weapon, tool or armor piece"}<strong>${esc(item?.name || "Your equipment")}</strong><small>${esc(enchantText(stack))}</small></div><div class="enchant-options">${Object.entries(
        ENCHANTMENTS,
      )
        .map(([id, e]) => {
          const level = enchantLevel(stack, id) + 1,
            cost = enchantCost(level),
            conflict = enchantConflict(stack, id),
            valid = e.fits(item) && level <= e.max && !conflict;
          return `<button class="secondary" data-action="enchant-item" data-enchantment="${id}" ${!valid ? "disabled" : ""}>${e.name} ${level > e.max ? "MAX" : level}<small>${conflict ? "Incompatible enchantment" : `${cost.xp} XP + ${cost.lapis} lapis`}</small></button>`;
        })
        .join(
          "",
        )}</div><p>${Math.floor(g.player.xp)} XP points available · Costs apply only when an upgrade succeeds.</p><div class="slot-grid nine enchant-inventory">${g.inventory.slots.map((s, i) => `<button class="slot ${i === index ? "chosen" : ""}" data-action="enchant-select" data-index="${i}" aria-label="${esc(ITEMS[s?.id]?.name || "Empty slot")}" ${!s || !Object.values(ENCHANTMENTS).some((e) => e.fits(ITEMS[s.id])) ? "disabled" : ""}>${itemHTML(s)}</button>`).join("")}</div><p class="fine">24 deterministic upgrades, including Fortune, Silk Touch, Looting, specialized protection and underwater equipment. Conflicting enchantments cannot be combined. Bookshelf power, random offers, enchanted books and anvil combining remain unfinished.</p><button class="primary wide" data-action="close-inv">Done</button></main>`,
    );
  }
  arsenalGuide() {
    const g = this.game,
      s = invasionState(g.world);
    return `<h3>Matthew's Dual Wielded Pistols</h3><p>A rare Cinderworld incursion can open untouched, loaded Overworld ground near you. From the second minute onward, each 30-second check has a 25% chance, provided a dry clearing is available. Peaceful pauses encounters. Tentacles open a fissure, then a shrine rises. Defeat its four elite persistent Hellspawn (two Soul Reavers, a Dread Knight and a Magma Maw) and right-click the rune altar with an empty inventory slot. Each world awards one pair. While sealed, the orb fires dangerous random bullets; use cover. Nearby tentacles have a 25% grab chance per five-second check, with a two-second escape warning. In single-player Survival, a completed grab drags you into Cinderworld to face A Mad Titan: 320 health, bullet immunity and four telegraphed special attacks. The recovery alcove has a one-time equipment chest and remains your respawn point until victory. Defeat the Titan, then right-click its return rune to resume the incursion. Co-op tentacle abduction is unavailable.</p><p class="relic-coordinates">${s && s.phase !== "waiting" ? `X ${s.x} · Y ${s.y} · Z ${s.z} · ${esc(s.phase.toUpperCase())} · ${s.defeated.length}/${INVADERS.length} Hellspawn defeated` : "No incursion discovered yet. Explore open, dry ground."}</p><p><strong>Hold left-click</strong> for alternating, rune-powered shots: 5 damage, 40-block reach, no ammunition. <strong>Right-click + WASD</strong>: Dash; in the air: Sky Star (once per jump). <strong>R</strong>: Air Trick toward any aimed, visible creature within 18 blocks, or free-blink toward your crosshair if none is targeted. Free aim stops before blocks; a blocked creature approach fails without spending a charge. Grounded downward aim stays level. <strong>Space + right-click beside a wall</strong> while airborne: Wall Hike. Two style charges recover individually in two seconds; Air Trick also recharges for five seconds. Movement sweeps stop at walls. No invulnerability or fall immunity.</p><p class="fine">Original code, models and sound. The four evasive moves are inspired by Dante’s Trickster style in Devil May Cry 3; this is a custom adaptation, without its complete combat, lock-on or upgrade system. Creative co-op supports host-approved shots, Dash, Sky Star and Wall Hike; Air Trick and the unique reward are host-only.</p>${g.mode === "creative" && g.dimension === "overworld" && !g.multiplayer?.isGuest && (!s || s.phase === "waiting") ? '<button class="secondary wide" data-action="summon-incursion">Call an incursion · Creative</button>' : ""}`;
  }
  journal(site) {
    const claimed = this.game.world.relicClaimed;
    this.setScreen(
      "journal",
      `<main class="dialog compact relic-journal"><div class="dialog-top"><span class="eyebrow">RELIC JOURNAL</span><button class="close" data-action="back" aria-label="Close journal">×</button></div><h2>The Devin Sword</h2><p>A runed star-metal blade sleeps in ancient stone.</p><p class="relic-coordinates">${claimed ? "CLAIMED IN THIS WORLD" : site ? `Overworld · X ${site.x} · Y ${site.y} · Z ${site.z}` : "Create a new Overworld world for a relic site."}</p>${site?.temple ? `<p>Temple seal: <strong>${Math.min(3, this.game.world.settlements?.["devin-temple"]?.defeated?.length || 0)} / 3 Guardians defeated</strong>. This temple is far from spawn. Bring iron/diamond or Hellfire equipment and food. Fresh Guardians have 140 health, 35% damage resistance and bulletproof armor. Their melee attacks deal 12 damage before armor; six telegraphed special attacks are also stronger. Bullets do no damage; use enchanted blades, spears or magic. Watch the amber warnings: jump the shockwave, dodge aimed volleys and lunges, and flank the sweeping cleave. Leave the cyan ground sigil before it erupts and slows you. Wounded Guardians recover faster. In new temples the inner sanctuary stays sealed until all three fall. Melee strikes also have a visible wind-up. They stay near the temple and do not return after defeat. Defeat all three to release the seal. All three Guardians must be defeated before the planted sword can be extracted, including in Creative and Peaceful. Peaceful pauses their attacks.</p>` : ""}<p>${this.game.world.generationVersion >= 11 ? `Outer ward: <strong>${this.game.world.settlements?.["devin-temple"]?.attuned ? "ATTUNED" : "CINDER SIGIL REQUIRED"}</strong>. Defeat the six defenders of a Cinderworld vault, claim its Cinder Sigil, hold it and right-click the front cyan ward. Cross the narrow bridge over the moat. The inner sword seal still needs all three Guardians defeated.` : "This older temple retains its original entry and requires no Cinder Sigil."}</p><p>Hold left click on the planted sword for <strong>30 uninterrupted seconds</strong>. Releasing, looking away, pausing, taking damage or leaving reach resets extraction. Keep an inventory slot free.</p><p><strong>Unbreakable.</strong> Fully charged hits restore one health point. Right-click for <strong>Devin's Pulse</strong>: eight damage and collision-safe knockback to visible hostiles within seven blocks. Animals and villagers are spared. Ten-second recharge; cooldown survives saves.</p><p>Press <strong>R</strong> for <strong>Devin's Seeker</strong>: a luminous homing bolt deals 12 damage to a visible hostile within 28 blocks. The bolt turns toward moving targets, collides with walls, and ignores peaceful creatures. Fourteen-second recharge, saved with the player. No target means no cooldown.</p><p class="fine">Spears and The Devin Sword are original additions beyond the Java Edition 1.20.4 reference.</p>${this.arsenalGuide()}<button class="primary wide" data-action="back">Back</button></main>`,
    );
  }
  aquaticGuide() {
    const done = this.game.world.aquatic?.achievements || {};
    this.setScreen(
      "aquatic-guide",
      `${this.header()}<main class="dialog guide-dialog"><h2>Aquatic Voyages</h2><h3>Life below the waves</h3><p>Sprint in water to swim faster; dolphins grant a speed boost. Feed a dolphin raw cod or salmon and follow it to a ruin. Use a water bucket on a fish to collect it; right-click to release. Feed two adult turtles seagrass to breed. Protect their beach eggs until dawn. Babies grow over 20 minutes and drop one scute; five scutes craft a Turtle Shell helmet.</p><h3>Ocean discoveries</h3><p>Look in wreck and ruin chests for treasure maps. Right-click a map to read its treasure coordinates. Buried treasure contains a Heart of the Sea. Combine it with eight Nautilus Shells (fishing or shell-carrying Drowned) for a Conduit. Surround the Conduit with a 3×3×3 volume of water, then build a 5×5 ring of prismarine or sea lanterns two blocks out. At least 16 frame blocks grant breath and clear vision in water; three complete rings (42 unique blocks) increase range and attack nearby submerged hostiles.</p><p>Soul sand beneath source water pushes you up; magma pulls you down and replenishes air. Sneak to avoid hot magma damage. Kelp grows in water and can be dried in a furnace. Nine dried kelp craft a fuel block.</p><h3>Gear from the deep</h3><p>Craft a fishing rod with three sticks and two string. Aim at water and right-click to cast; reel in when the bobber dips and a bite message appears. Drowned occasionally carry tridents; defeat them for a rare drop. Hold right-click for half a second, then release to throw. Loyalty returns the weapon, Impaling affects aquatic animals, Channeling calls lightning during thunder, and Riptide launches you only in water or rain. Riptide excludes Loyalty and Channeling. Mending repairs held or worn gear when earning XP.</p><h3>Turtle Master</h3><p>Craft a brewing stand with a Cinder Blaze Rod and three cobblestone. Magma Maws drop rods; turn rods into blaze powder for fuel. Find Nether Wart on soul sand in newly generated Cinderworld. Brew water bottles + wart, then the awkward potions + a Turtle Shell. Drinking grants 20 seconds of Resistance III and Slowness IV.</p><h3>Ocean journal</h3><p>${
        Object.keys(done).length
          ? Object.keys(done)
              .map((id) => esc(id.replaceAll("_", " ")))
              .join(" · ")
          : "Explore, fish, breed turtles and build a conduit to record discoveries."
      }</p><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  cinderGuide() {
    const w = this.game.world,
      p = this.game.player;
    const sites =
      w.dimension === "cinderwild"
        ? nearbyCinderSites(w, p.x, p.z, 560)
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.z - p.z) -
                Math.hypot(b.x - p.x, b.z - p.z),
            )
            .slice(0, 3)
        : [];
    this.setScreen(
      "cinder-guide",
      `${this.header()}<main class="dialog compact"><h2>Cinderworld</h2><p>${w.generationVersion >= 11 ? "Beyond the obsidian portal: six infernal regions, deep lava rifts, jagged spires and enormous strongholds." : "Beyond the obsidian portal: four volcanic regions, exclusive resources and guarded relics."}</p><ol><li>Bring a diamond pickaxe, an iron pickaxe, food, blocks and flint and steel.</li><li>Search caves between Y 15 and 70. Orange Hellfire veins need diamond; yellow Brimstone needs iron. Veins are uncommon coherent clusters.</li><li>Smelt Raw Hellfire in a furnace. Craft 2 Hellfire ingots + 1 Brimstone into 2 Hellfire alloy, using the personal grid.</li><li>Use alloy in the usual armor/tool/spear recipes. Hellfire tools exceed diamond speed/durability. Each armor piece adds 10% lava/fire resistance; a full set adds 40%, without immunity.</li><li>${w.generationVersion >= 11 ? "Explore the Citadel of the Damned, Cathedral of Souls and Hellfire Crucible. Six persistent defenders bind each vault: defeat them all to open its amber ward. Breaking the chest cannot bypass its defenders. Rewards include a Cinder Sigil, powerful enchanted Hellfire equipment, alloy and diamonds. Take the Sigil to the Devin Temple and use it on the front cyan ward. Dread knights telegraph a jumpable ground slam; soul reavers cast aimed three-bolt volleys; magma maws wind up a straight charge. Dodge, use cover, and bring armor." : "Explore Emberwatch bastions, crystal shrines and ruined waystations. Chests contain supplies and rare crafting resources; bastions/shrines have defenders."}</li></ol><p>Ash deer are peaceful. Cinderbacks retaliate when attacked. Basalt crawlers and cinder wraiths are hostile, alongside emberlings. </p>${sites.length ? `<h3>Nearby expeditions</h3><ul>${sites.map((v) => `<li>${esc(v.name || v.kind)} · X ${v.x} / Y ${v.y + 1} / Z ${v.z}</li>`).join("")}</ul>` : `<p>Build a 4 × 5 obsidian frame with a 2 × 3 opening. Light it with flint and steel to enter Cinderworld.</p>`}<button class="primary wide" data-action="back">Back</button></main>`,
    );
  }
  trading(entity) {
    this.tradingEntity = entity;
    const trades = VILLAGER_TRADES[entity.profession] || [];
    this.setScreen(
      "trading",
      `<main class="dialog compact trade-dialog"><div class="dialog-top"><span class="eyebrow">VILLAGER</span><button class="close" data-action="close-inv" aria-label="Close trading">×</button></div><h2>${esc(entity.profession || "villager")}</h2><p class="muted">Level 1 · Resident<br/>Trades restock after sunrise.</p><div class="trade-list">${trades.map((t, i) => `<button class="secondary trade-row" data-action="trade" data-trade="${i}" ${entity.tradeUses?.[i] >= 12 ? "disabled" : ""}><span>${itemHTML(makeStack(t.input, t.cost))}<small>${esc(ITEMS[t.input].name)} × ${t.cost}</small></span><b>→</b><span>${itemHTML(makeStack(t.output, t.count))}<small>${esc(ITEMS[t.output].name)} × ${t.count}</small></span><em>${Math.max(0, 12 - (entity.tradeUses?.[i] || 0))} left</em></button>`).join("")}</div><p class="fine">Carry payment in your inventory. Each completed trade awards 2 XP. This is a limited trading system; reputation and profession leveling are not implemented.</p><button class="primary wide" data-action="close-inv">Done</button></main>`,
    );
  }
  guide() {
    this.setScreen(
      "guide",
      `${this.header("guide")}<main class="dialog guide-dialog"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>Controls</h2><div class="guide-columns"><section><dl class="controls-list"><dt><kbd>W A S D</kbd></dt><dd>Move</dd><dt><kbd>MOUSE</kbd></dt><dd>Look around</dd><dt><kbd>SPACE</kbd></dt><dd>Jump / swim up</dd><dt><kbd>SHIFT</kbd></dt><dd>Hold to crouch / flight down</dd><dt><kbd>W → W</kbd></dt><dd>Double-tap to sprint; keep moving to stay running</dd><dt><kbd>CTRL + W</kbd></dt><dd>Sprint (alternative)</dd><dt><kbd>LEFT CLICK</kbd></dt><dd>Mine / attack</dd><dt><kbd>RIGHT CLICK</kbd></dt><dd>Use / place / eat</dd><dt><kbd>1–9 / SCROLL</kbd></dt><dd>Select hotbar slot</dd><dt><kbd>E</kbd></dt><dd>Open / close inventory</dd><dt><kbd>Q / CTRL+Q</kbd></dt><dd>Drop one / stack</dd><dt><kbd>ESC</kbd></dt><dd>Pause</dd><dt><kbd>J</kbd></dt><dd>Relic Journal</dd><dt><kbd>F3</kbd></dt><dd>Coordinates, compass & sword guidance</dd><dt><kbd>F5</kbd></dt><dd>First person → behind → front</dd></dl><p>Creative: double-tap Space to fly. Inventory: right-click splits stacks; Shift-click transfers. Open the recipe book to fill the crafting grid.</p></section><section><h3>Getting started</h3><ol><li>Mine a tree for logs.</li><li>Craft planks, sticks, and a crafting table.</li><li>Craft a wooden pickaxe. Mine stone to upgrade.</li><li>Smelt raw iron in a furnace with coal or wood.</li><li>Build shelter and place torches before night.</li></ol><h3>Exploration</h3><p>Right-click villagers to trade. J opens the Relic Journal. Build a 4 × 5 obsidian frame with a 2 × 3 opening and light it with flint and steel to enter Cinderworld.</p><h3>Giganto</h3><p>Enter a Titan portal. Gather rings, climb for the final Emerald, and defeat Giganto. Fly through the portal that opens after the battle to return to the Overworld.</p><h3>Stands</h3><p>Enter a Devil’s Palm to begin a trial. H summons your Stand; F and G use its abilities. V opens Stand details.</p><h3>World backups</h3><p>Worlds are stored in this browser. Export a backup before clearing browser data or moving the game.</p></section></div></main>`,
    );
  }
  features() {
    this.setScreen(
      "features",
      `${this.header()}<main class="dialog compact"><div class="dialog-top"><button class="close" data-action="back" aria-label="Back">×</button></div><h2>About DCSMCRAFT</h2><p>Version ${VERSION}</p><p>Mechanics reference: ${REFERENCE}</p><p>An independent voxel sandbox.</p><button class="primary wide" data-action="back">Done</button></main>`,
    );
  }
  death() {
    this.setScreen(
      "death",
      `<div class="death-shade"></div><main class="dialog compact death-dialog"><h2>You Died!</h2><p>Cause: ${esc(this.game.lastDeath?.cause || "Unknown")}</p><p class="death-coordinates">${Math.floor(this.game.player.x)} / ${Math.floor(this.game.player.y)} / ${Math.floor(this.game.player.z)}</p><button class="primary wide" data-action="respawn">Respawn</button><button class="text-button wide" data-action="quit">Save and Quit to Title</button></main>`,
    );
  }
  openInventory(type, container, target) {
    this.invType = type;
    this.recipeQuery = "";
    this.recipePage = 0;
    this.recipeBookOpen ??= !!this.game.settings.recipeBookOpen;
    this.container = container;
    this.containerTarget = target;
    this.craftSize = ["table", "stonecutter", "smithing_table"].includes(type)
      ? 3
      : 2;
    this.creativeTab =
      this.game.mode === "creative" && type === "personal"
        ? ["catalog", "stands", "inventory"].includes(this.creativeTab)
          ? this.creativeTab
          : "catalog"
        : "inventory";
    this.creativeCategory ||= "search";
    this.buildInventory();
  }
  slots(ref, count, start = 0) {
    return Array.from(
      { length: count },
      (_, i) =>
        `<button class="slot" data-ref="${ref}" data-index="${i + start}" aria-label="Empty slot"></button>`,
    ).join("");
  }
  buildInventory() {
    if (
      this.game.mode === "creative" &&
      this.invType === "personal" &&
      this.creativeTab !== "inventory"
    )
      return this.buildCreativeInventory();
    const g = this.game,
      creative = g.mode === "creative",
      catalog = creative && ["catalog", "stands"].includes(this.creativeTab);
    let top = "";
    if (this.invType === "furnace") {
      top = `<div class="furnace-layout"><div><span class="grid-caption">INPUT</span>${this.slots("container", 1, 0)}<div class="flame" id="furnace-flame">♨</div>${this.slots("container", 1, 1)}<span class="grid-caption">FUEL</span></div><div class="smelt-arrow"><span>→</span><div id="smelt-progress"><i></i></div><small>${this.container?.station ? "5" : "10"} SECOND SMELT</small></div><div><span class="grid-caption">OUTPUT</span>${this.slots("container", 1, 2)}</div></div>`;
    } else if (this.invType === "brewing_stand") {
      top = `<div class="brewing-layout"><p>Brewing Stand · 20 seconds per batch</p><div class="slot-grid" style="--cols:5">${this.slots("container", 5)}</div><p class="fine">Bottles ×3 · Ingredient · Blaze powder</p><p id="brew-progress">Water + Nether wart → Awkward. Awkward + Turtle Shell → Turtle Master.</p></div>`;
    } else if (this.invType === "chest") {
      top = `<div class="container-grid slot-grid nine">${this.slots("container", 27)}</div>`;
    } else {
      top = `<div class="crafting-layout"><div><span class="grid-caption">${this.craftSize} × ${this.craftSize} CRAFTING</span><div class="slot-grid craft-grid" style="--cols:${this.craftSize}">${this.slots("craft", this.craftSize ** 2)}</div></div><span class="craft-arrow">→</span><div><span class="grid-caption">RESULT</span><button class="slot output-slot" data-action="craft" aria-label="Craft result"></button></div><div class="craft-tip">Choose a recipe<small>Choose a recipe to fill the grid.</small></div></div>`;
    }
    const compact = ["personal", "table"].includes(this.invType);
    const bookButton = `<button class="recipe-book-toggle" data-action="toggle-recipes" aria-label="Toggle recipe book" aria-controls="crafting-recipe-book" aria-expanded="${!!this.recipeBookOpen}" data-tooltip="Recipe book">${recipeBookIcon}</button>`;
    if (this.invType === "personal") {
      top = `<div class="player-inventory-top"><div class="armor-column" aria-label="Armor slots">${this.slots("armor", 4)}</div><div class="inventory-model" aria-label="Your equipped character"></div><div class="offhand-pocket">${this.slots("offhand", 1)}</div><section class="personal-crafting"><h2>Crafting</h2><div class="personal-craft-row"><div class="slot-grid craft-grid" style="--cols:2">${this.slots("craft", 4)}</div><span class="craft-arrow" aria-hidden="true">${craftArrowIcon}</span><button class="slot output-slot" data-action="craft" aria-label="Craft result"></button></div>${bookButton}</section></div>`;
    } else if (this.invType === "table") {
      top = `<section class="table-crafting-top"><h2>Crafting</h2><div class="table-craft-row"><div class="slot-grid craft-grid" style="--cols:3">${this.slots("craft", 9)}</div><span class="craft-arrow" aria-hidden="true">${craftArrowIcon}</span><button class="slot output-slot" data-action="craft" aria-label="Craft result"></button></div>${bookButton}</section>`;
    }
    const recipes =
      !catalog && !["furnace", "chest", "brewing_stand"].includes(this.invType);
    this.setScreen(
      "inventory",
      `<main class="inventory-window ${compact ? "compact-inventory" : ""} ${recipes && this.recipeBookOpen ? "with-recipes" : ""} ${creative && this.invType === "personal" ? "creative-player-screen" : ""}">${recipes ? `<aside class="recipe-book" id="crafting-recipe-book" ${this.recipeBookOpen ? "" : "hidden"}><div class="recipe-heading"><h3>Recipe Book</h3></div><input id="recipe-search" placeholder="Search recipes…" aria-label="Search recipes" value="${esc(this.recipeQuery || "")}"/><label class="craftable-filter"><input type="checkbox" id="recipe-craftable" ${this.recipeCraftableOnly ? "checked" : ""}/> Craftable now</label><div class="recipe-list">${this.recipeBookOpen ? this.recipeEntries(this.recipeQuery || "") : ""}</div><p class="recipe-help">Click a recipe to place its materials in the grid. Take the result to craft.</p></aside>` : ""}<section class="inventory-main">${creative && this.invType === "personal" ? this.creativeTabs("top") + this.creativeTabs("bottom") : ""}<div class="dialog-top"><span class="eyebrow">${this.invType === "personal" ? "PLAYER INVENTORY" : this.invType === "table" ? "CRAFTING TABLE" : this.invType.toUpperCase()}</span><button class="close" data-action="close-inv" aria-label="Close inventory">×</button></div>${compact ? "" : `<div class="inventory-title"><h2>${this.container?.station ? esc(this.container.station.replaceAll("_", " ")) : this.invType === "furnace" ? "Furnace" : this.invType === "chest" ? "Chest" : this.invType === "brewing_stand" ? "Brewing Stand" : "Crafting"}</h2>${recipes ? bookButton : ""}</div>`}${top}<div class="inventory-divider"><span>Inventory</span><small><kbd>SHIFT + CLICK</kbd> TO TRANSFER</small></div><div class="slot-grid nine main-slots">${this.slots("inventory", 27, 9)}</div><div class="slot-grid nine inventory-hotbar">${this.slots("inventory", 9)}</div><div class="inventory-foot"><span><kbd>LEFT CLICK</kbd> · PICK UP / PLACE</span><span><kbd>RIGHT CLICK</kbd> · SPLIT / PLACE ONE</span></div></section></main>`,
    );
    const preview = this.overlay.querySelector(".inventory-model");
    if (preview) {
      try {
        this.inventoryPreview = new SkinPreview(preview, g.settings.skin, {
          mode: "inventory",
          equipment: g.inventory.equipment,
          held: g.inventory.held?.id,
          atlas: g.renderer.atlas,
        });
      } catch {
        preview.textContent = SKINS[g.settings.skin]?.name || "Your character";
      }
    }
    this.refreshInventory();
  }
  creativeTabs(row) {
    return `<nav class="creative-tabs creative-tabs-${row}" role="tablist" aria-label="${row === "top" ? "Blocks and search" : "Equipment and player"}">${CREATIVE_TABS.filter(
      (t) => t.row === row,
    )
      .map((t) => {
        const active =
          t.id === "stands"
            ? this.creativeTab === "stands"
            : t.id === "inventory"
              ? this.creativeTab === "inventory"
              : this.creativeTab === "catalog" &&
                this.creativeCategory === t.id;
        return `<button type="button" role="tab" aria-label="${t.name}" aria-selected="${active}" tabindex="${active ? 0 : -1}" class="creative-tab ${active ? "active" : ""}" data-action="creative-tab" data-tab="${["stands", "inventory"].includes(t.id) ? t.id : "catalog"}" ${!["stands", "inventory"].includes(t.id) ? `data-category="${t.id}"` : ""} data-creative-tab="${t.id}" data-tooltip="${t.name}"><img draggable="false" src="${iconURL(t.icon)}" alt=""/><span class="sr-only">${t.name}</span></button>`;
      })
      .join("")}</nav>`;
  }
  buildCreativeInventory() {
    const stands = this.creativeTab === "stands",
      tab =
        CREATIVE_TABS.find((t) => t.id === this.creativeCategory) ||
        CREATIVE_TABS.find((t) => t.id === "search");
    this.setScreen(
      "inventory",
      `<main class="creative-window" aria-label="Creative Inventory">${this.creativeTabs("top")}<section class="creative-body"><div class="creative-heading"><h2>${stands ? "Stands" : tab.name}</h2><button class="close" data-action="close-inv" aria-label="Close inventory">×</button></div>${stands ? `<div class="creative-stand-content">${this.creativeStandCatalog()}</div>` : `<input id="creative-search" type="search" autocomplete="off" spellcheck="false" aria-label="Search Creative catalog" placeholder="Search items…" value="${esc(this.catalogQuery || "")}"/><div class="creative-catalog-frame"><div class="creative-catalog" tabindex="0" aria-label="${tab.name} items"><div class="creative-scroll-space"><div class="creative-visible-grid"></div></div></div><input id="creative-scrollbar" class="creative-scrollbar" type="range" min="0" max="1" step="1" value="0" aria-label="Scroll Creative items"/></div><div class="creative-catalog-status" aria-live="polite"></div>`}<div class="creative-hotbar slot-grid nine">${this.slots("inventory", 9)}</div></section>${this.creativeTabs("bottom")}</main>`,
    );
    this.refreshInventory();
    if (!stands) {
      this.updateCreativeCatalog();
      const viewport = this.overlay.querySelector(".creative-catalog");
      if (typeof ResizeObserver !== "undefined") {
        this.creativeViewportObserver = new ResizeObserver(() => {
          if (viewport.isConnected) this.renderCreativeRows();
        });
        this.creativeViewportObserver.observe(viewport);
      }
    }
  }
  updateCreativeCatalog() {
    const viewport = this.overlay.querySelector(".creative-catalog");
    if (!viewport) return;
    this.catalogMatches = catalogEntries(
      this.creativeCategory,
      this.catalogQuery,
    );
    viewport.scrollTop = this.catalogScroll || 0;
    this.renderCreativeRows();
  }
  renderCreativeRows() {
    const viewport = this.overlay.querySelector(".creative-catalog");
    if (!viewport) return;
    const entries = this.catalogMatches || [],
      pitch = viewport.clientWidth / 9 || 52;
    const w = creativeWindow(entries.length, this.catalogScroll || 0, pitch);
    const spacer = viewport.querySelector(".creative-scroll-space"),
      grid = viewport.querySelector(".creative-visible-grid");
    viewport.style.height = `${pitch * 5}px`;
    viewport.style.setProperty("--creative-row-height", `${pitch}px`);
    spacer.style.height = `${w.height}px`;
    if (Math.abs(viewport.scrollTop - w.scrollTop) > 0.5)
      viewport.scrollTop = w.scrollTop;
    const key = [this.creativeCategory, this.catalogQuery, w.start, w.end].join(
      ":",
    );
    if (grid.dataset.window !== key) {
      grid.dataset.window = key;
      grid.style.transform = `translateY(${w.offset}px)`;
      grid.innerHTML = Array.from({ length: w.end - w.start }, (_, i) => {
        const e = entries[w.start + i];
        return e
          ? `<button class="slot creative-slot" data-ref="creative" data-index="${e.index}" data-name="${esc(ITEMS[e.id].name.toLowerCase())}" data-tooltip="${esc(ITEMS[e.id].name)}" aria-label="${esc(ITEMS[e.id].name)}">${itemHTML(makeStack(e.id))}</button>`
          : '<span class="slot creative-empty-slot" aria-hidden="true"></span>';
      }).join("");
    }
    const slider = this.overlay.querySelector("#creative-scrollbar");
    if (slider) {
      slider.max = String(Math.max(0, Math.ceil(entries.length / 9) - 5));
      slider.value = String(Math.round(w.scrollTop / pitch));
      slider.disabled = entries.length <= 45;
      slider.style.height = `${pitch * 5}px`;
    }
    const status = this.overlay.querySelector(".creative-catalog-status");
    status.textContent = entries.length
      ? `${entries.length} items`
      : "No matching items";
  }
  toggleRecipeBook() {
    const panel = this.overlay.querySelector(".recipe-book");
    if (!panel) return;
    this.recipeBookOpen = !this.recipeBookOpen;
    this.game.settings.recipeBookOpen = this.recipeBookOpen;
    this.saveSettings();
    panel.hidden = !this.recipeBookOpen;
    this.overlay
      .querySelector(".inventory-window")
      .classList.toggle("with-recipes", this.recipeBookOpen);
    this.overlay
      .querySelector(".recipe-book-toggle")
      ?.setAttribute("aria-expanded", String(this.recipeBookOpen));
    if (this.recipeBookOpen) this.refreshRecipeBook(true);
  }
  refreshRecipeBook(force = false) {
    if (!this.recipeBookOpen || !this.overlay.querySelector(".recipe-list"))
      return;
    const inv = this.game.inventory;
    const signature = JSON.stringify([
      inv.slots,
      inv.craft,
      this.invType,
      this.recipeQuery,
      this.recipePage,
      this.recipeCraftableOnly,
    ]);
    if (!force && signature === this.recipeInventorySignature) return;
    this.recipeInventorySignature = signature;
    this.overlay.querySelector(".recipe-list").innerHTML = this.recipeEntries(
      this.recipeQuery || "",
      this.recipePage || 0,
    );
  }
  recipeEntries(query = "", page = 0) {
    this.recipeQuery = query;
    const station = this.invType || "personal",
      inv = this.game.inventory;
    const all = RECIPES.map((r, index) => ({ r, index })).filter(
      ({ r }) =>
        (r.station
          ? r.station === station
          : ["personal", "table"].includes(station)) &&
        (!r.pattern ||
          (r.pattern.length <= this.craftSize &&
            r.pattern.every((row) => row.length <= this.craftSize))) &&
        (!r.ingredients || r.ingredients.length <= this.craftSize ** 2) &&
        ITEMS[r.result].name.toLowerCase().includes(query.toLowerCase()) &&
        (!this.recipeCraftableOnly || inv.canAutofill(r, this.craftSize)),
    );
    const pages = Math.max(1, Math.ceil(all.length / 20));
    this.recipePage = Math.max(0, Math.min(page, pages - 1));
    return (
      all
        .slice(this.recipePage * 20, (this.recipePage + 1) * 20)
        .map(({ r, index }) => {
          const ready = inv.canAutofill(r, this.craftSize),
            name = ITEMS[r.result].name;
          return `<button class="recipe-card ${ready ? "ready" : "missing"}" data-action="recipe" data-recipe="${index}" data-ready="${ready}" data-tooltip="${esc(name)} · ${ready ? "Materials ready — click to fill" : "Missing materials or inventory space"}" aria-label="${esc(name)}, ${ready ? "materials ready" : "materials missing"}"><img src="${iconURL(r.result)}" alt=""/>${r.count > 1 ? `<b>${r.count}</b>` : ""}</button>`;
        })
        .join("") +
      `${all.length ? "" : '<p class="recipe-empty">No matching recipes.</p>'}<div class="catalog-pages"><button data-action="recipe-page" aria-label="Previous recipes" data-page="${Math.max(0, this.recipePage - 1)}" ${this.recipePage === 0 ? "disabled" : ""}>‹</button><span>${this.recipePage + 1} / ${pages}</span><button data-action="recipe-page" aria-label="Next recipes" data-page="${this.recipePage + 1}" ${this.recipePage + 1 >= pages ? "disabled" : ""}>›</button></div>`
    );
  }
  slotClick(cell, e) {
    if (this.screen && this.screen !== "inventory") return;
    if (!validateLocalContainerMenu(this.game)) return;
    const g = this.game,
      inv = g.inventory,
      ref = cell.dataset.ref,
      index = Number(cell.dataset.index),
      right = e.button === 2;
    if (e.button !== 0 && !right) return;
    if (g.multiplayer?.isGuest && g.mode === "survival") {
      this.dragging = !e.drag;
      this.dragVisited = this.dragVisited || new Set([ref + index]);
      g.multiplayer.command("inventory", {
        action: "slot",
        ref,
        index,
        right,
        shift: e.shiftKey,
      });
      return;
    }
    this.dragging = !e.drag;
    this.dragVisited = this.dragVisited || new Set([ref + index]);
    if (ref === "creative") {
      if (
        g.mode !== "creative" ||
        !Number.isInteger(index) ||
        !CREATIVE_ITEMS[index]
      )
        return;
      const id = CREATIVE_ITEMS[index];
      if (e.shiftKey) {
        inv.add(makeStack(id, ITEMS[id].stack));
      } else inv.cursor = makeStack(id, right ? 1 : ITEMS[id].stack);
      this.refreshInventory();
      return;
    }
    const array =
      ref === "inventory"
        ? inv.slots
        : ref === "armor"
          ? inv.equipment
          : ref === "offhand"
            ? inv.offhand
            : ref === "craft"
              ? inv.craft
              : this.container.slots;
    const smelt = ref === "container" && this.invType === "furnace" && index === 2
      ? { item: array[index]?.id, before: array[index]?.count || 0 } : null;
    const recordSmelt = () => {
      const count = smelt ? smelt.before - (array[index]?.count || 0) : 0;
      if (count > 0) recordAchievement(g,"smelt-take",{item:smelt.item,count});
    };
    if (
      ref === "armor" &&
      inv.cursor &&
      ITEMS[inv.cursor.id]?.armorSlot !== index
    )
      return;
    if (
      this.invType === "brewing_stand" &&
      ref === "container" &&
      !brewingSlotAccepts(index, inv.cursor)
    )
      return;
    const armorSlot =
      ref === "inventory" ? ITEMS[array[index]?.id]?.armorSlot : undefined;
    if (e.shiftKey && armorSlot !== undefined && !inv.equipment[armorSlot]) {
      inv.equipment[armorSlot] = array[index];
      array[index] = null;
      this.refreshInventory();
      return;
    }
    if (
      this.invType === "furnace" &&
      ref === "container" &&
      index === 2 &&
      inv.cursor
    ) {
      const output = array[index];
      if (
        output &&
        compatible(output, inv.cursor) &&
        output.count + inv.cursor.count <= ITEMS[output.id].stack
      ) {
        inv.cursor.count += output.count;
        array[index] = null;
        awardXP(g, Math.floor(this.container.xp || 0));
        this.container.xp = 0;
        recordSmelt();
      }
      this.refreshInventory();
      return;
    }
    if (e.shiftKey) {
      if (ref === "inventory" && this.container) {
        const target = this.container.slots;
        if (this.invType === "brewing_stand") {
          const stack = array[index];
          if (stack)
            for (let i = 0; i < 5; i++)
              if (!target[i] && brewingSlotAccepts(i, stack)) {
                const count = i < 3 ? 1 : stack.count;
                target[i] = { ...stack, count };
                stack.count -= count;
                if (!stack.count) {
                  array[index] = null;
                  break;
                }
              }
        } else if (this.invType === "furnace") {
          // Insert only into input/fuel, never into result.
          const s = array[index];
          if (s) {
            const destination = FUELS[s.id] ? 1 : SMELTS[s.id] ? 0 : -1;
            if (destination < 0) return;
            const slot = target[destination],
              max = ITEMS[s.id].stack;
            if (!slot) {
              target[destination] = s;
              array[index] = null;
            } else if (compatible(slot, s)) {
              const n = Math.min(s.count, max - slot.count);
              slot.count += n;
              s.count -= n;
              if (!s.count) array[index] = null;
            }
          }
        } else inv.transfer(array, index, target);
      } else if (ref !== "inventory") {
        const before = array[index]?.count || 0;
        inv.transfer(array, index, inv.slots);
        if (
          ref === "container" &&
          this.invType === "furnace" &&
          index === 2 &&
          (array[index]?.count || 0) < before
        ) {
          awardXP(g, Math.floor(this.container.xp || 0));
          this.container.xp = 0;
        }
      } else {
        const start = index < 9 ? 9 : 0,
          end = index < 9 ? 36 : 9;
        this.transferRange(index, start, end);
      }
    } else {
      inv.click(array, index, right);
      if (ref === "container" && this.invType === "furnace" && index === 2) {
        awardXP(g, Math.floor(this.container.xp || 0));
        this.container.xp = 0;
      }
    }
    recordSmelt();
    scanAchievements(g);
    g.audio.tone("ui");
    this.refreshInventory();
  }
  transferRange(index, start, end) {
    const inv = this.game.inventory,
      s = inv.slots[index];
    if (!s) return;
    for (let i = start; i < end && s.count; i++)
      if (compatible(inv.slots[i], s)) {
        const n = Math.min(s.count, ITEMS[s.id].stack - inv.slots[i].count);
        inv.slots[i].count += n;
        s.count -= n;
      }
    for (let i = start; i < end && s.count; i++)
      if (!inv.slots[i]) {
        inv.slots[i] = { ...s };
        s.count = 0;
      }
    if (!s.count) inv.slots[index] = null;
  }
  craft(all = false) {
    if (this.game.multiplayer?.isGuest && this.game.mode === "survival") {
      this.game.multiplayer.command("inventory", { action: "craft", all });
      return;
    }
    const inv = this.game.inventory;
    if (all) {
      for (let i = 0; i < 64; i++) {
        const r = inv.recipe(this.craftSize, this.invType);
        if (!r) break;
        const backup = cloneState(inv.export());
        if (inv.cursor) break;
        if (!inv.craftOne(this.craftSize, this.invType)) break;
        const left = inv.add(inv.cursor);
        if (left) {
          Object.assign(inv, new inv.constructor(backup));
          break;
        }
        inv.cursor = null;
        recordAchievement(this.game,"craft",{item:r.result,count:r.count});
      }
    } else {
      const r=inv.recipe(this.craftSize,this.invType);
      if (inv.craftOne(this.craftSize, this.invType))
        recordAchievement(this.game,"craft",{item:r.result,count:r.count});
    }
    scanAchievements(this.game);
    this.game.audio.tone("craft");
    this.refreshInventory();
  }
  refreshInventory() {
    if (this.screen !== "inventory") return;
    const inv = this.game.inventory;
    this.overlay.querySelectorAll(".slot[data-ref]").forEach((cell) => {
      const ref = cell.dataset.ref;
      if (ref === "creative") return;
      const i = Number(cell.dataset.index),
        stack =
          ref === "inventory"
            ? inv.slots[i]
            : ref === "armor"
              ? inv.equipment[i]
              : ref === "offhand"
                ? inv.offhand[i]
                : ref === "craft"
                  ? inv.craft[i]
                  : this.container?.slots[i];
      cell.innerHTML =
        itemHTML(stack) ||
        (ref === "armor"
          ? equipmentPlaceholder(i)
          : ref === "offhand"
            ? equipmentPlaceholder(4)
            : "");
      cell.classList.toggle("empty", !stack);
      cell.dataset.tooltip = stack
        ? `${ITEMS[stack.id]?.name || stack.id}${ITEMS[stack.id]?.description ? " · " + ITEMS[stack.id].description : ""}${enchantText(stack) ? " · " + enchantText(stack) : ""}${stack.durability !== undefined ? " · Durability " + stack.durability : ""}`
        : ref === "armor"
          ? `${ARMOR_SLOTS[i]} slot`
          : ref === "offhand"
            ? "Offhand"
            : "";
      if (ref === "offhand" && stack)
        cell.dataset.tooltip += " · Offhand storage (combat use unavailable)";
      cell.setAttribute(
        "aria-label",
        stack
          ? `${stack.count} ${ITEMS[stack.id]?.name}`
          : ref === "armor"
            ? `Empty ${ARMOR_SLOTS[i]} slot`
            : ref === "offhand"
              ? "Empty offhand storage slot"
              : "Empty slot",
      );
    });
    const brew = this.overlay.querySelector("#brew-progress");
    if (brew)
      brew.textContent = `Brew: ${Math.floor((this.container.progress || 0) / 4)}% · Fuel: ${this.container.fuel || 0} batches. Water + wart → Awkward; Awkward + shell → Turtle Master.`;
    const points = this.overlay.querySelector("#equipment-points");
    if (points) points.textContent = `${armorStats(inv).armor} armor points`;
    const r = inv.recipe(this.craftSize, this.invType),
      out = this.overlay.querySelector(".output-slot");
    if (out) {
      out.innerHTML = r ? itemHTML(makeStack(r.result, r.count)) : "";
      const output = r && makeStack(r.result, r.count);
      const room =
        !inv.cursor ||
        (output &&
          compatible(inv.cursor, output) &&
          inv.cursor.count + output.count <= ITEMS[output.id].stack);
      out.disabled = !output || !room;
      out.dataset.tooltip = r
        ? room
          ? `Craft ${ITEMS[r.result].name}`
          : "Clear space on your cursor first"
        : "No matching recipe";
    }
    if (this.invType === "furnace") {
      const bar = this.overlay.querySelector("#smelt-progress i");
      if (bar)
        bar.style.width =
          (this.container.progress || 0) / (this.container.station ? 1 : 2) +
          "%";
      this.overlay
        .querySelector("#furnace-flame")
        ?.classList.toggle("burning", this.container.burn > 0);
    }
    this.inventoryPreview?.setSkin(
      this.game.settings.skin,
      inv.equipment,
      inv.held?.id,
    );
    this.refreshRecipeBook();
    this.cursorEl.hidden = !inv.cursor;
    this.cursorEl.innerHTML = itemHTML(inv.cursor);
  }
  updateHotbar() {
    if (this.screen !== "play") return;
    const inv = this.game.inventory,
      bar = this.hud.querySelector("#hotbar");
    bar.innerHTML = inv.slots
      .slice(0, 9)
      .map(
        (s, i) =>
          `<div class="hotbar-slot ${i === inv.selected ? "selected" : ""}"><small>${i + 1}</small>${itemHTML(s)}</div>`,
      )
      .join("");
    this.hud.querySelector("#selected-name").textContent =
      ITEMS[inv.held?.id]?.name || "";
    this.nameUntil = this.game.elapsed + 2;
  }
  updateHUD() {
    if (this.screen !== "play") return;
    const g = this.game,
      p = g.player,
      creative = g.mode === "creative";
    const trial = activeTrial(g);
    let bossBar = this.hud.querySelector("#titan-boss");
    if (!bossBar) {
      bossBar = document.createElement("div");
      bossBar.id = "titan-boss";
      this.hud.append(bossBar);
    }
    bossBar.hidden = !trial;
    if (trial) {
      const hp = Math.max(
        0,
        Math.ceil(
          g.entities.find((e) => e.id === trial.bossId)?.hp ?? trial.bossHP,
        ),
      );
      bossBar.innerHTML = `<b>A MAD TITAN</b><div><i style="width:${Math.min(100, (hp / 320) * 100)}%"></i></div><small>${trial.phase === "victory" ? "Return rune unlocked · recovery alcove" : `${hp} / 320 · Bullets cannot pierce its hide`}</small>`;
    }
    const state = JSON.stringify([
      p.health,
      p.food,
      p.oxygen,
      p.underwater,
      p.xp,
      armorStats(g.inventory).armor,
      g.mode,
      Math.floor(g.time / 1000),
      Math.floor(p.x),
      Math.floor(p.z),
    ]);
    if (this.lastHUD === state) return;
    this.lastHUD = state;
    this.hud.querySelector("#survival-bars").hidden = creative;
    this.hud.querySelector("#hearts").innerHTML = Array.from(
      { length: 10 },
      (_, i) =>
        `<span class="heart ${p.health >= i * 2 + 2 ? "full" : p.health > i * 2 ? "half" : ""}">♥</span>`,
    ).join("");
    this.hud.querySelector("#hunger").innerHTML = Array.from(
      { length: 10 },
      (_, i) =>
        `<span class="food ${p.food >= i * 2 + 2 ? "full" : p.food > i * 2 ? "half" : ""}">◆</span>`,
    ).join("");
    const armor = armorStats(g.inventory).armor,
      armorBar = this.hud.querySelector("#armor-bar");
    armorBar.hidden = !armor;
    armorBar.setAttribute("aria-label", `${armor} armor points`);
    armorBar.innerHTML = Array.from(
      { length: 10 },
      (_, i) => `<i class="armor-pip ${armor > i * 2 ? "full" : ""}"></i>`,
    ).join("");
    const oxygen = this.hud.querySelector("#oxygen");
    oxygen.hidden = !p.underwater;
    oxygen.innerHTML = Array.from(
      { length: Math.ceil(Math.max(0, p.oxygen) / 30) },
      () => "<span>○</span>",
    ).join("");
    const level = Math.floor(Math.sqrt(p.xp / 7));
    this.hud.querySelector("#xp-level").textContent = level || "";
    this.hud.querySelector("#xp-fill").style.width =
      `${((p.xp - level * level * 7) / Math.max(7, (level + 1) ** 2 * 7 - level * level * 7)) * 100}%`;
    this.hud.querySelector("#day-label").textContent =
      `DAY ${Math.floor(g.time / 24000) + 1}`;
    this.hud.querySelector("#day-icon").textContent =
      g.time % 24000 > 13000 && g.time % 24000 < 23000 ? "☾" : "☀";
    this.hud.querySelector("#mode-label").textContent = creative
      ? "CREATIVE"
      : "SURVIVAL";
    const biome = g.world.terrain(p.x, p.z).biome;
    this.hud.querySelector("#hud-biome").textContent = (
      g.dimension === "cinderwild" ? "CINDERWILD" : BIOMES[biome]?.name || biome
    ).toUpperCase();
  }
  frame() {
    this.hud.dataset.view = String(this.game.cameraMode || 0);
    if (this.screen !== "play") return;
    const g = this.game,
      p = g.player;
    const fps = this.hud.querySelector("#fps-counter");
    if (fps) {
      fps.hidden = !g.settings.showFPS;
      fps.textContent = `${Math.round(g.fps || 0)} FPS`;
    }
    this.hud.querySelector("#hurt-vignette").style.opacity = p.hurt * 0.9;
    this.hud.querySelector("#water-vignette").style.opacity = p.underwater
      ? 0.5
      : 0;
    const crosshair = this.hud.querySelector("#crosshair");
    const hit = g.hitFeedback && g.elapsed < g.hitFeedback.until;
    crosshair.classList.toggle("combat-hit", !!hit);
    crosshair.classList.toggle("critical-hit", !!hit && g.hitFeedback.critical);
    const recovery = this.hud.querySelector("#attack-cooldown");
    const charge = Math.max(
      0,
      Math.min(
        1,
        (g.elapsed - (g.lastAttack ?? -10)) /
          attackCooldown(g.inventory.held?.id),
      ),
    );
    recovery.hidden = charge >= 1;
    recovery.firstElementChild.style.width = `${charge * 100}%`;
    recovery.setAttribute("aria-valuenow", Math.round(charge * 100));
    const label = this.hud.querySelector("#target-label");
    label.textContent = g.target ? BLOCKS[g.target.id].name : "";
    if (g.target && BLOCKS[g.target.id].key === "crop") {
      const t = g.target,
        age = g.world.cropTicks[`${t.x},${t.y},${t.z}`]?.age || 0;
      label.textContent += age === 7 ? " · Mature" : ` · Growing ${age}/7`;
    }
    const enemy = g.targetEntity?.();
    if (enemy && MOB_INFO[enemy.type])
      label.textContent = `${MOB_INFO[enemy.type].name} · ${Math.ceil(enemy.hp)} HP${enemy.windup ? " · STRIKE INCOMING" : ""}`;
    if (enemy?.type === "watcher") label.textContent = "The Watcher";
    if (g.extraction)
      label.textContent = `The Devin Sword · ${Math.floor(g.extraction.progress * 30)} / 30 seconds · keep holding`;
    let statuses = this.hud.querySelector("#ocean-effects");
    if (!statuses) {
      statuses = document.createElement("div");
      statuses.id = "ocean-effects";
      statuses.style.cssText =
        "position:absolute;right:18px;top:100px;text-align:right;color:#d8eee5;text-shadow:2px 2px #172b31;font-size:12px;pointer-events:none";
      this.hud.append(statuses);
    }
    statuses.textContent = Object.entries(g.player.effects || {})
      .map(
        ([id, e]) => `${id.replaceAll("_", " ")} ${Math.ceil(e.ticks / 20)}s`,
      )
      .join(" · ");
    const moves = this.hud.querySelector("#weapon-moves");
    moves.textContent =
      weaponMoveText(g) ||
      (g.inventory.held?.id === "trident"
        ? "Hold right-click, release to throw · Riptide needs water or rain"
        : g.inventory.held?.id === "fishing_rod"
          ? "Right-click to cast / reel · watch for a bite"
          : "");
    moves.hidden = !moves.textContent;
    if (g.target?.id === BLOCKS.findIndex((b) => b.key === "matthew_altar")) {
      const s = invasionState(g.world);
      label.textContent =
        s?.phase === "ready"
          ? "Matthew’s Rift Altar · right-click to claim the pistols"
          : s?.phase === "claimed"
            ? "Matthew’s Rift Altar · claimed"
            : `Sealed altar · ${s?.defeated.length || 0}/4 Hellspawn defeated`;
    }
    if (g.target?.id === BLOCKS.findIndex((b) => b.key === "trial_exit"))
      label.textContent =
        activeTrial(g)?.phase === "victory"
          ? "Return rune · right-click to escape"
          : "Return rune sealed · defeat A Mad Titan";
    label.hidden = !label.textContent;
    this.hud.classList.toggle("in-portal", (g.portalCharge || 0) > 0);
    this.hud.style.setProperty(
      "--portal-charge",
      Math.min(0.55, (g.portalCharge || 0) / 100),
    );
    const mining = this.hud.querySelector("#mining-bar");
    mining.hidden = !g.mining && !g.extraction;
    mining.classList.toggle("relic-extraction", !!g.extraction);
    mining.firstElementChild.style.width =
      Math.min(100, (g.extraction?.progress || g.mining) * 100) + "%";
    this.hud.querySelector("#selected-name").style.opacity =
      g.elapsed < this.nameUntil ? 1 : 0;
    const debug = this.hud.querySelector("#hud-debug");
    debug.hidden = !this.debug;
    if (this.debug)
      debug.textContent = `${debugNavigation(g.world, p)}\n\nSeed ${g.world.seed}\n${p.flying ? "Creative flight" : ""}`;
  }
  saveSettings() {
    try {
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify(this.game.settings),
      );
    } catch {
      /* Settings remain usable in storage-restricted HTML viewers. */
    }
  }
  announce(title, message) {
    if (!message) return;
    const banner = this.root.querySelector("#cycle-banner");
    banner.querySelector("strong").textContent = title;
    banner.querySelector("span").textContent = message;
    banner.classList.add("show");
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => banner.classList.remove("show"), 6500);
  }
  downloadGame() {
    const html = window.DCSMCRAFT_HTML_SOURCE;
    if (!html) {
      this.toast(
        "Use the standalone HTML download to share a self-contained copy.",
      );
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" })),
      a = document.createElement("a");
    a.href = url;
    a.download = "DCSMCRAFT-Standalone.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast(
      "Game HTML saved. Share that file; export a world backup separately to share your world.",
      6500,
    );
  }
  toast(message, duration = 3500) {
    const el = this.root.querySelector("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), duration);
  }
  refreshSaveStatus() {
    const warnings = this.game.store.warnings();
    const current =
      warnings.find((o) => o.id === this.game.id) || warnings.at(-1);
    this.storageWarning.hidden = !current;
    if (current) {
      this.storageWarning.dataset.world = current.id || this.game.id;
      this.storageWarning.querySelector("span").textContent =
        `${current.name || "World"}: ${current.status === "failed" ? "save failed" : "session-only"}. Export before closing this tab. The last durable save is unchanged.${warnings.length > 1 ? ` ${warnings.length} worlds need backups.` : ""}`;
      this.storageWarning.title = current.error || "";
    }
    const el = this.hud.querySelector("#save-status");
    if (el) {
      const outcome = this.game.store.outcome(this.game.id);
      el.dataset.durability = outcome?.status || "unknown";
      el.textContent = this.game.multiplayer?.isGuest
        ? "SAVED BY HOST"
        : outcome?.status === "durable"
          ? "SAVED LOCALLY"
          : outcome?.status === "session-only"
            ? "SESSION ONLY · EXPORT TO KEEP"
            : outcome?.status === "failed"
              ? "SAVE FAILED · EXPORT TO KEEP"
              : "NOT SAVED YET";
    }
  }
  saved() {
    this.refreshSaveStatus();
  }
}
