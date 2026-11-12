import {
  controllerConfig,
  readController,
  padGlyph,
  menuButtonNames,
  controllerActivity,
  smoothControllerLook,
} from "./controller-data.js";
import { installControllerUI } from "./controller-ui.js";
import { controlName, buttonName } from "./input-prompts.js";
import "./controller.css";
const activeNode = (n) =>
  n &&
  !n.disabled &&
  n.getClientRects().length &&
  getComputedStyle(n).visibility !== "hidden";
export class ControllerInput {
  constructor(game) {
    this.game = game;
    this.lastDevice = "keyboard";
    this.family = "generic";
    this.previous = {};
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.filteredLook={x:0,y:0};
    this.arenaKeys = new Set();
    this.padKeys = new Set();
    this.lastContext = "";
    this.pad = null;
    this.focusKey = "";
    this.mouse = { 0: false, 2: false };
    this.hintBackup = new WeakMap();
    this.footerBackup = new WeakMap();
    this.hint = document.createElement("button");
    this.hint.id = "controller-hint";
    this.hint.hidden = true;
    this.hint.textContent = "Enable sound";
    this.hint.addEventListener("click", (e) => {
      e.stopPropagation();
      game.audio.unlock();
    });
    document.querySelector("#app").append(this.hint);
    const physical = (e) => {
      if (!e.isTrusted) return;
      if (
        e.type !== "keydown" &&
        (e.sourceCapabilities?.firesTouchEvents ||
          performance.now() - (game.touch?.lastTouchAt || -10000) < 800)
      )
        return;
      game.touch?.deactivate();
      this.handoffRead = this.lastRead || null;
      this.restorePrompts();
      document
        .querySelectorAll(".pad-focus")
        .forEach((n) => n.classList.remove("pad-focus"));
      this.lastDevice = "keyboard";
      document.querySelector("#app").dataset.input = "keyboard";
    };
    addEventListener("keydown", physical, true);
    addEventListener(
      "mousemove",
      (e) => {
        if (e.movementX || e.movementY) physical(e);
      },
      true,
    );
    addEventListener(
      "mousedown",
      (e) => {
        physical(e);
        this.mouse[e.button] = true;
      },
      true,
    );
    addEventListener(
      "mouseup",
      (e) => {
        this.mouse[e.button] = false;
      },
      true,
    );
    addEventListener("blur", () => {
      this.clear();
      this.awaitNeutral = true;
    });
    addEventListener("gamepaddisconnected", (e) => {
      if (e.gamepad.index === this.pad?.index) {
        this.clear();
        if (game.active && game.running && this.lastDevice === "controller")
          game.pause();
        this.pad = null;
      }
    });
    installControllerUI(this);
  }
  status() {
    return this.pad
      ? `${this.pad.id} · ${this.pad.mapping === "standard" ? "Standard mapping" : "Custom mapping may be needed"}`
      : "No controller connected";
  }
  worldKeys(keys) {
    if (!this.padKeys.size) return keys;
    return new Set([...keys, ...this.padKeys]);
  }
  clear() {
    this.padKeys.clear();
    this.arenaKeys.clear();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.filteredLook={x:0,y:0};
    this.sprint = false;
    if (this.primary) {
      if (!this.mouse[0]) this.game.endPrimaryInput?.();
      this.primary = false;
    }
    if (this.secondary) {
      if (!this.mouse[2]) this.game.endSecondaryInput?.();
      this.secondary = false;
    }
  }
  trigger(code, extra = {}) {
    const g = this.game,
      had = g.keys.has(code);
    g.handleKeyDown?.({
      code,
      key: code,
      repeat: false,
      target: g.renderer.gl.domElement,
      preventDefault() {},
      ...extra,
    });
    if (!had) g.keys.delete(code);
  }
  frame(dt) {
    const g = this.game,
      c = controllerConfig(g.settings.controller);
    this.config = c;
    let pads = [];
    try {
      pads = [...(navigator.getGamepads?.() || [])].filter(
        (p) => p?.connected !== false && p,
      );
    } catch {}
    const candidates = pads.map((p) => [p, readController(p, c)]);
    let selected = candidates.find(([p]) => p.index === this.pad?.index);
    const fresh = candidates.find(
      ([p, r]) =>
        p.index !== this.pad?.index &&
        (Math.hypot(r.move.x, r.move.y) > 0.2 ||
          r.values.some((v) => v > 0.55)),
    );
    selected = fresh || selected || candidates[0];
    if (!c.enabled || !selected || document.hidden) {
      if (
        this.pad &&
        !selected &&
        g.active &&
        g.running &&
        this.lastDevice === "controller"
      )
        g.pause();
      this.clear();
      this.previous = {};
      this.lastRead = null;
      this.pad = selected?.[0] || null;
      return;
    }
    const [pad, r] = selected,
      switched = this.pad?.index !== pad.index || this.pad?.id !== pad.id;
    if (switched) {
      this.lastRead = null;
      this.handoffRead = null;
      this.clear();
      this.previous = {};
    }
    this.pad = pad;
    this.family = r.family;
    this.raw = r;
    const b = r.buttons,
      edge = (k) => !!b[k] && !this.previous[k],
      activity = controllerActivity(
        this.lastRead,
        r,
        this.lastDevice === "keyboard"
          ? this.handoffRead || null
          : this.lastRead,
      );
    this.lastRead = r;
    this.move = r.move;
    this.look = r.look;
    if (activity) {
      g.touch?.deactivate();
      this.lastDevice = "controller";
      document.querySelector("#app").dataset.input = "controller";
    }
    const context = this.keyboard ? "keyboard" : g.ui.screen;
    if (this.lastContext !== context) {
      this.clear();
      this.move = r.move;
      this.look = r.look;
      this.lastContext = context;
      this.menuDirection = "";
      this.repeatAt = 0;
    }
    if (this.awaitNeutral) {
      if (
        !Object.values(b).some(Boolean) &&
        !Math.hypot(r.move.x, r.move.y, r.look.x, r.look.y)
      )
        this.awaitNeutral = false;
      this.previous = { ...b };
      this.lastValues = r.values;
      return;
    }
    if (g.ui.screen === "controller-settings") {
      const status = g.ui.overlay.querySelector("#controller-status");
      if (status) status.textContent = this.status();
      const live = g.ui.overlay.querySelector("#controller-live");
      if (live)
        live.textContent = `Axes: ${[...(pad.axes || [])].map((v, i) => `${i}: ${Number(v).toFixed(2)}`).join("  ")}  Buttons: ${
          r.values
            .map((v, i) => (v > 0.2 ? i : ""))
            .filter((v) => v !== "")
            .join(", ") || "—"
        }`;
    }
    if (this.lastDevice === "controller") {
      this.hint.hidden = !(g.running && g.audio.context?.state === "suspended");
      if (this.keyboard || g.ui.screen !== "play") this.menu({...r,move:r.navigationMove,look:r.navigationLook}, edge, dt);
      else {
        this.filteredLook=smoothControllerLook(this.filteredLook,r.look,c.lookSmoothing,dt);
        const gameRead={...r,look:this.filteredLook};this.look=this.filteredLook;
        if(g.giganto.active)this.arena(gameRead,edge,dt);else this.world(gameRead,edge,dt);
      }
      this.decorate();
    } else {
      this.hint.hidden = true;
      this.clear();
    }
    this.previous = { ...b };
    this.lastValues = r.values;
  }
  world(r, edge, dt) {
    const g = this.game,
      b = r.buttons;
    if(this.config.sprintMode==='hold')this.sprint=!!b.sprint;
    else if(edge('sprint'))this.sprint=!this.sprint;
    if(Math.hypot(r.move.x,r.move.y)<0.001)this.sprint=false;
    this.padKeys.clear();
    for (const [code, want] of [
      ["KeyW", r.move.y < -0.1],
      ["KeyS", r.move.y > 0.1],
      ["KeyA", r.move.x < -0.1],
      ["KeyD", r.move.x > 0.1],
      ["Space", b.jump],
      ["ShiftLeft", b.crouch],
      ["ControlLeft", this.sprint],
    ])
      if (want) this.padKeys.add(code);
    g.player.yaw -= r.look.x * this.config.lookSensitivity * dt;
    g.player.pitch = Math.max(
      -1.553,
      Math.min(
        1.553,
        g.player.pitch - r.look.y * this.config.lookSensitivity * this.config.verticalLookScale * dt,
      ),
    );
    if (edge("pause")) {
      g.pause();
      return;
    }
    if (edge("view")) {
      this.actions();
      return;
    }
    if (edge("inventory")) {
      g.openInventory("personal");
      return;
    }
    if (edge("jump")) this.trigger("Space");
    if (edge("crouch") && g.player.boatId) this.trigger("ShiftLeft");
    if (edge("leftShoulder") || edge("rightShoulder")) {
      g.inventory.selected =
        (g.inventory.selected + (edge("rightShoulder") ? 1 : 8)) % 9;
      g.ui.updateHotbar();
    }
    if (edge("target")) this.trigger("F5");
    if (edge("up")) this.trigger("KeyR");
    if (edge("down")) this.trigger("KeyQ");
    if (edge("left")) this.trigger("KeyJ");
    if (edge("right")) g.chat.open();
    if (edge("mine")) {
      this.primary = g.beginPrimaryInput();
    }
    if (!b.mine && this.primary) {
      if (!this.mouse[0]) g.endPrimaryInput();
      this.primary = false;
    }
    if (edge("use")) {
      if (g.giganto.nearPortal) {
        g.giganto.enter();
        return;
      }
      this.secondary = true;
      g.beginSecondaryInput();
    }
    if (!b.use && this.secondary) {
      if (!this.mouse[2]) g.endSecondaryInput();
      this.secondary = false;
    }
  }
  arena(r, edge, dt) {
    const e = this.game.giganto,
      s = e.session,
      b = r.buttons;
    this.arenaKeys.clear();
    for (const [key, want] of [
      ["KeyW", r.move.y < -0.1],
      ["KeyS", r.move.y > 0.1],
      ["KeyA", r.move.x < -0.1],
      ["KeyD", r.move.x > 0.1],
      ["Space", b.jump],
      ["ControlLeft", b.crouch],
      ["ShiftLeft", b.mine && !b.use],
      ["Mouse2", b.use],
      ["Mouse0", b.attack],
    ])
      if (want) this.arenaKeys.add(key);
    s.avatar.yaw -= r.look.x * this.config.lookSensitivity * dt;
    s.avatar.pitch = Math.max(
      -1.25,
      Math.min(
        1.25,
        s.avatar.pitch + r.look.y * this.config.lookSensitivity * this.config.verticalLookScale * dt,
      ),
    );
    if (edge("pause")) {
      this.game.pause();
      return;
    }
    if (edge("view")) e.key("KeyH");
    if (edge("jump")) e.input("jump");
    if (edge("attack")) e.input("hit");
    if (edge("inventory")) e.input("homing");
    if (edge("target")) e.input("target");
    if (edge("rightShoulder")) e.input("dodge");
    if(s.stage==='traversal'){
      const directions=['up','down','left','right'];
      if(b.leftShoulder&&!directions.some(k=>b[k]))this.arenaKeys.add('KeyC');
      if(edge('left'))e.input('climb');
      if(edge('up'))e.input(b.leftShoulder?'shot':'boom');
      if(edge('down'))e.input('stomp');
      if(edge('right'))e.input('spin');
    }else for(const [key,normal,shift] of [['up','boom','shot'],['down','rush','stomp'],['left','loop','cyclone'],['right','cross','spin']])if(edge(key))e.input(b.leftShoulder?shift:normal);
    if (s.qte) {
      const length = Math.hypot(r.move.x, r.move.y),
        angle = Math.atan2(r.move.y, r.move.x);
      if (length > 0.65 && this.qteAngle !== undefined) {
        const d = Math.atan2(
          Math.sin(angle - this.qteAngle),
          Math.cos(angle - this.qteAngle),
        );
        if (Math.abs(d) < 1.2) {
          if (this.qteTurn && Math.sign(d) !== Math.sign(this.qteTurn))
            this.qteTurn = 0;
          this.qteTurn = (this.qteTurn || 0) + d;
          if (Math.abs(this.qteTurn) > Math.PI / 2) {
            e.input("jump");
            this.qteTurn = 0;
          }
        }
      }
      this.qteAngle = length > 0.65 ? angle : undefined;
    } else {
      this.qteAngle = undefined;
      this.qteTurn = 0;
    }
  }
  cancel() {
    const g = this.game;
    if (this.keyboard) {
      this.closeKeyboard();
      return;
    }
    if (g.ui.screen === "death") return;
    if (g.ui.screen === "inventory") {
      g.closeInventory();
      return;
    }
    const button = [
      ...g.ui.overlay.querySelectorAll(
        '[data-pad-command="back"], [data-titan="back"], [data-action="back"], [data-action="close-inv"]',
      ),
    ].find(activeNode);
    if (button && activeNode(button)) {
      button.click();
      return;
    }
    if (g.giganto.active) {
      g.giganto.key("Escape");
      return;
    }
    if (g.active && g.ui.screen !== "death") g.resume();
    else g.ui.title();
  }
  menu(r, edge, dt) {
    const g = this.game,
      root = this.keyboard || g.ui.overlay,
      names = menuButtonNames(this.family);
    const nodes = [
      ...root.querySelectorAll(
        "button,input,select,textarea,summary,.slot[data-ref]",
      ),
    ].filter(
      (n) =>
        activeNode(n) &&
        n.type !== "hidden" &&
        n.getAttribute("aria-hidden") !== "true",
    );
    for (const n of nodes) if (n.matches(".slot[data-ref]")) n.tabIndex = 0;
    const tabs = [
      ...root.querySelectorAll('[role="tab"],[data-titan-tab]'),
    ].filter(activeNode);
    if (tabs.length && (edge("leftShoulder") || edge("rightShoulder"))) {
      const i = Math.max(
        0,
        tabs.findIndex((n) => n.getAttribute("aria-selected") === "true"),
      );
      const tab =
        tabs[(i + (edge("rightShoulder") ? 1 : tabs.length - 1)) % tabs.length];
      tab.click();
      this.focus(tab, true);
      return;
    }
    let focused = document.activeElement;
    if (!nodes.includes(focused))
      focused =
        nodes.find((n) => this.nodeKey(n) === this.focusKey) ||
        nodes.find((n) =>
          n.matches('[aria-selected="true"],[data-titan="resume"]'),
        ) ||
        nodes[0];
    if (!focused) return;
    this.focus(focused);
    const horizontal = r.buttons.left
        ? -1
        : r.buttons.right
          ? 1
          : r.move.x < -0.55
            ? -1
            : r.move.x > 0.55
              ? 1
              : 0,
      vertical = r.buttons.up
        ? -1
        : r.buttons.down
          ? 1
          : r.move.y < -0.55
            ? -1
            : r.move.y > 0.55
              ? 1
              : 0;
    const direction = horizontal
      ? horizontal < 0
        ? "left"
        : "right"
      : vertical
        ? vertical < 0
          ? "up"
          : "down"
        : "";
    this.menuTime = (this.menuTime || 0) + dt;
    if (
      direction &&
      (direction !== this.menuDirection || this.menuTime >= this.repeatAt)
    ) {
      const fresh = direction !== this.menuDirection;
      this.menuDirection = direction;
      this.repeatAt = this.menuTime + (fresh ? 0.32 : 0.11);
      if (
        horizontal &&
        focused.matches('input[type="range"],input[type="number"],select')
      )
        this.adjust(focused, horizontal);
      else {
        const a = focused.getBoundingClientRect(),
          cx = a.x + a.width / 2,
          cy = a.y + a.height / 2;
        const targets = nodes
          .filter((n) => n !== focused)
          .map((n) => {
            const b = n.getBoundingClientRect(),
              dx = b.x + b.width / 2 - cx,
              dy = b.y + b.height / 2 - cy,
              along = horizontal ? dx * horizontal : dy * vertical,
              cross = horizontal ? Math.abs(dy) : Math.abs(dx);
            return {
              n,
              score:
                along > 3
                  ? along + cross * 2.5 + (cross * cross) / (along + 1)
                  : Infinity,
            };
          })
          .sort((a, b) => a.score - b.score);
        if (Number.isFinite(targets[0]?.score)) this.focus(targets[0].n, true);
      }
    } else if (!direction) this.menuDirection = "";
    const scroll = Math.abs(r.look.y) > 0.15 ? r.look.y : 0;
    if (scroll) {
      const panel =
        root.querySelector(".achievement-grid") ||
        root.querySelector(
          ".creative-catalog,[data-titan-panel]:not([hidden]),.dialog",
        ) || root;
      panel.scrollTop += scroll * dt * 500;
    }
    if (edge(names.cancel) || edge("pause")) {
      this.cancel();
      return;
    }
    focused = document.activeElement;
    if (edge(names.confirm)) this.confirm(focused, 0, false);
    if (g.ui.screen === "inventory" && !this.keyboard) {
      if (edge("attack")) this.confirm(focused, 2, false);
      if (edge("inventory")) this.confirm(focused, 0, true);
    }
  }
  nodeKey(n) {
    return (
      n.id ||
      (n.name ? `${n.tagName}:${n.name}:${n.type}` : "") ||
      JSON.stringify(
        [...n.attributes]
          .filter((a) => a.name.startsWith("data-"))
          .map((a) => [a.name, a.value]),
      )
    );
  }
  focus(n, scroll = false) {
    if (!n) return;
    document.querySelectorAll(".pad-focus").forEach((p) => {
      if (p !== n) p.classList.remove("pad-focus");
    });
    n.classList.add("pad-focus");
    if (document.activeElement !== n) n.focus({ preventScroll: true });
    this.focusKey = this.nodeKey(n);
    if (scroll) n.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (this.game.ui.screen === "inventory") {
      const p = n.getBoundingClientRect();
      this.game.ui.cursorEl.style.transform = `translate(${p.x + p.width}px,${p.y + p.height}px)`;
    }
  }
  adjust(n, delta) {
    if (n.tagName === "SELECT") {
      const options = [...n.options].filter((o) => !o.disabled);
      const i = options.findIndex((o) => o.value === n.value);
      n.value = options[(i + delta + options.length) % options.length].value;
    } else {
      const lo = Number(n.min || 0),
        hi = Number(n.max || 100),
        step = Number(n.step) || 1;
      n.value = String(
        Math.round(
          Math.max(lo, Math.min(hi, Number(n.value) + delta * step)) * 1e5,
        ) / 1e5,
      );
    }
    n.dispatchEvent(new Event("input", { bubbles: true }));
    n.dispatchEvent(new Event("change", { bubbles: true }));
  }
  confirm(n, button = 0, shift = false) {
    if (!n) return;
    if (n.matches(".slot[data-ref]") && this.game.ui.screen === "inventory") {
      this.game.ui.slotClick(n, { button, shiftKey: shift });
      this.game.ui.dragging = false;
      this.game.ui.dragVisited = null;
      return;
    }
    if (
      n.matches(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]),textarea',
      ) &&
      !n.readOnly
    ) {
      this.openKeyboard(n);
      return;
    }
    if (n.tagName === "SELECT") {
      this.adjust(n, 1);
      return;
    }
    n.click();
  }
  openKeyboard(target) {
    this.keyboardTarget = target;
    this.keyboardDraft = target.value;
    this.keyboardShift = false;
    const panel = document.createElement("section");
    panel.id = "controller-keyboard";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.innerHTML =
      '<h2>Keyboard</h2><output></output><div class="pad-key-grid"></div><div class="pad-key-actions"></div>';
    document.querySelector("#app").append(panel);
    this.keyboard = panel;
    const add = (label, fn, where) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", fn);
      where.append(b);
    };
    const output = panel.querySelector("output"),
      refresh = () => {
        output.textContent = this.keyboardDraft || " ";
      };
    for (const char of "1234567890qwertyuiopasdfghjklzxcvbnm-_/.:?@#=+!%,&()")
      add(
        char,
        () => {
          const limit = target.maxLength >= 0 ? target.maxLength : 512;
          if (this.keyboardDraft.length < limit)
            this.keyboardDraft += this.keyboardShift
              ? char.toUpperCase()
              : char;
          refresh();
        },
        panel.querySelector(".pad-key-grid"),
      );
    const actions = panel.querySelector(".pad-key-actions");
    add(
      "Space",
      () => {
        this.keyboardDraft += " ";
        refresh();
      },
      actions,
    );
    add(
      "Delete",
      () => {
        this.keyboardDraft = this.keyboardDraft.slice(0, -1);
        refresh();
      },
      actions,
    );
    add(
      "Shift",
      () => {
        this.keyboardShift = !this.keyboardShift;
      },
      actions,
    );
    add(
      "Clear",
      () => {
        this.keyboardDraft = "";
        refresh();
      },
      actions,
    );
    add(
      "Done",
      () => {
        target.value = this.keyboardDraft.slice(
          0,
          target.maxLength >= 0 ? target.maxLength : 512,
        );
        target.dispatchEvent(new Event("input", { bubbles: true }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        this.closeKeyboard();
      },
      actions,
    );
    add("Cancel", () => this.closeKeyboard(), actions);
    refresh();
    this.focus(panel.querySelector("button"));
  }
  closeKeyboard() {
    this.keyboard?.remove();
    this.keyboard = null;
    this.keyboardTarget?.focus();
    this.keyboardTarget = null;
    this.focusKey = "";
  }
  actions() {
    const g = this.game;
    g.pause();
    const entries = [
      ["Inventory", () => g.openInventory("personal")],
      ["Drop one", () => this.trigger("KeyQ")],
      ["Drop stack", () => this.trigger("KeyQ", { ctrlKey: true })],
      ["Change view", () => this.trigger("F5")],
      ["Coordinates", () => this.trigger("F3")],
      ["Weapon ability", () => this.trigger("KeyR")],
      ["Relic journal", () => this.trigger("KeyJ")],
      ["Chat", () => g.chat.open()],
    ];
    for (const [key, code] of Object.entries(g.settings.standKeys || {}))
      entries.push(["Stand · " + key, () => this.trigger(code)]);
    if (g.mode === "creative")
      entries.push([
        "Toggle flight",
        () => {
          g.player.flying = !g.player.flying;
        },
      ]);
    g.ui.setScreen(
      "controller-actions",
      '<main id="controller-actions" class="dialog compact"><h2>Actions</h2></main>',
    );
    const root = g.ui.overlay.querySelector("main");
    for (const [label, fn] of entries) {
      const b = document.createElement("button");
      b.className = "secondary wide";
      b.textContent = label;
      b.addEventListener("click", () => {
        g.resume();
        fn();
      });
      root.append(b);
    }
    const back = document.createElement("button");
    back.textContent = "Back";
    back.className = "primary wide";
    back.addEventListener("click", () => g.resume());
    root.append(back);
  }
  decorate() {
    if (this.game.prompts) this.game.prompts.dirty = true;
  }
  restorePrompts() {
    if (this.game.prompts) this.game.prompts.dirty = true;
  }
  rumble(strength = 0.25, duration = 90) {
    if (!this.config?.vibration) return;
    try {
      this.pad?.vibrationActuator
        ?.playEffect?.("dual-rumble", {
          duration,
          weakMagnitude: Math.min(1, strength),
          strongMagnitude: Math.min(1, strength * 0.7),
        })
        .catch?.(() => {});
    } catch {}
  }
}
