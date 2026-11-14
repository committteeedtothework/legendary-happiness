import {swapHands} from "./offhand.js";
import { touchConfig, touchVector, isTouchDevice } from "./touch-data.js";
import "./touch.css";
export class TouchInput {
  constructor(g) {
    this.game = g;
    this.mobile = isTouchDevice();
    this.active =
      touchConfig(g.settings.touch).mode === "on" ||
      (this.mobile && touchConfig(g.settings.touch).mode !== "off");
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.pointers = new Map();
    this.sprint = false;
    this.root = document.createElement("section");
    this.root.id = "touch-controls";
    this.root.setAttribute("aria-label", "Touch controls");
    this.root.hidden = true;
    this.root.innerHTML = `<div id="touch-joystick" role="slider" aria-label="Move stick" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="touch-top"><button data-touch="pause">Pause</button><button data-touch="inventory">Inventory</button><button data-touch="actions">Actions</button></div><div class="touch-buttons"></div><div id="touch-tray" hidden></div><div id="touch-inventory" hidden><button data-touch="stack" aria-pressed="true">Move stack</button><button data-touch="split" aria-pressed="false">Split</button><button data-touch="transfer" aria-pressed="false">Quick move</button><button data-touch="close">Done</button></div>`;
    document.querySelector("#app").append(this.root);
    this.layout = "";
    this.slotMode = "stack";
    document.addEventListener("pointerdown", (e) => this.down(e), {
      capture: true,
      passive: false,
    });
    document.addEventListener("pointermove", (e) => this.pointerMove(e), {
      capture: true,
      passive: false,
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      document.addEventListener(event, (e) => this.up(e), true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
        if (g.active && g.running) g.pause();
        if (g.active) g.save().catch(() => {});
      }
    });
    addEventListener("blur", () => this.clear());
    addEventListener("pagehide", () => this.clear());
    g.ui.overlay.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="touch-settings"]')) this.settings();
    });
    g.ui.overlay.addEventListener("change", (e) => {
      const key = e.target.dataset.touchSetting;
      if (!key) return;
      const c = touchConfig(g.settings.touch);
      c[key] =
        e.target.tagName === "SELECT" ? e.target.value : Number(e.target.value);
      g.settings.touch = touchConfig(c);
      g.ui.saveSettings();
      this.clear();
      if (c.mode === "off") this.active = false;
      else if (c.mode === "on" || this.mobile) this.activate();
    });
    this.frame(0);
  }
  enabled() {
    const c = touchConfig(this.game.settings.touch);
    return c.mode === "on" || (c.mode === "auto" && this.mobile);
  }
  activate() {
    if (!this.enabled()) return;
    this.lastTouchAt = performance.now();
    if (!this.active) this.game.controller?.clear();
    this.active = true;
    this.game.controller?.restorePrompts();
    if (this.game.controller) this.game.controller.lastDevice = "touch";
    document.querySelector("#app").dataset.input = "touch";
  }
  deactivate() {
    this.active = false;
    this.clear();
  }
  clear() {
    this.keys.clear();
    this.move = { x: 0, y: 0 };
    this.pointers.clear();
    this.sprint = false;
    if (this.mining) this.game.endPrimaryInput?.();
    this.mining = false;
    if (this.using) this.game.endSecondaryInput?.();
    this.using = false;
    this.root.querySelector("#touch-joystick i").style.transform = "";
    this.root
      .querySelectorAll(".held")
      .forEach((n) => n.classList.remove("held"));
  }
  down(e) {
    if (e.pointerType !== "touch" || !this.enabled()) return;
    this.activate();
    this.game.audio.unlock();
    const g = this.game,
      b = e.target.closest("[data-touch]"),
      slot = e.target.closest(".slot[data-ref]"),
      hotbar = e.target.closest(".hotbar-slot"),
      stick = e.target.closest("#touch-joystick"),
      ability = e.target.closest("[data-ability]");
    if (slot && g.ui.screen === "inventory") {
      e.preventDefault();
      e.stopImmediatePropagation();
      g.ui.slotClick(slot, {
        button: this.slotMode === "split" ? 2 : 0,
        shiftKey: this.slotMode === "transfer",
      });
      g.ui.dragging = false;
      return;
    }
    if (hotbar && g.ui.screen === "play") {
      e.preventDefault();
      const i = [...hotbar.parentNode.children].indexOf(hotbar);
      if (i >= 0 && i < 9) {
        g.inventory.selected = i;
        g.ui.updateHotbar();
      }
      return;
    }
    if (ability && g.giganto?.active && g.ui.screen === "play") {
      e.preventDefault();
      g.giganto.input(ability.dataset.ability);
      return;
    }
    if (b) {
      e.preventDefault();
      e.stopImmediatePropagation();
      b.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, {
        kind: "button",
        action: b.dataset.touch,
        node: b,
      });
      b.classList.add("held");
      this.press(b.dataset.touch);
      return;
    }
    if (stick && g.running && g.ui.screen === "play") {
      e.preventDefault();
      stick.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {
        kind: "stick",
        x: e.clientX,
        y: e.clientY,
        node: stick,
      });
      return;
    }
    if (
      e.target === g.renderer.gl.domElement &&
      g.running &&
      g.ui.screen === "play"
    ) {
      e.preventDefault();
      e.target.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {
        kind: "look",
        x: e.clientX,
        y: e.clientY,
        node: e.target,
      });
    }
  }
  pointerMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    this.lastTouchAt = performance.now();
    if (p.kind === "stick") {
      this.move = touchVector(e.clientX - p.x, e.clientY - p.y);
      p.node.querySelector("i").style.transform =
        `translate(${this.move.x * 36}px,${this.move.y * 36}px)`;
      p.node.setAttribute(
        "aria-valuenow",
        Math.round(Math.hypot(this.move.x, this.move.y) * 100),
      );
    } else if (p.kind === "look") {
      const g = this.game,
        a = g.giganto?.active ? g.giganto.session.avatar : g.player,
        c = touchConfig(g.settings.touch);
      a.yaw -= (e.clientX - p.x) * c.sensitivity;
      const sign = g.giganto?.active ? 1 : -1;
      a.pitch = Math.max(
        -1.3,
        Math.min(1.3, a.pitch + (e.clientY - p.y) * c.sensitivity * sign),
      );
      p.x = e.clientX;
      p.y = e.clientY;
    }
  }
  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.kind === "stick") {
      this.move = { x: 0, y: 0 };
      this.sprint = false;
      for (const key of ["KeyW", "KeyS", "KeyA", "KeyD", "ControlLeft"])
        this.keys.delete(key);
      p.node.querySelector("i").style.transform = "";
    }
    if (p.kind === "button") {
      p.node.classList.remove("held");
      if (
        ![...this.pointers.values()].some(
          (other) => other.kind === "button" && other.action === p.action,
        )
      )
        this.release(p.action);
    }
  }
  press(action) {
    const g = this.game,
      e = g.giganto,
      arena = e?.active;
    if (["stack", "split", "transfer"].includes(action)) {
      this.slotMode = action;
      this.root
        .querySelectorAll("#touch-inventory [data-touch]")
        .forEach((n) =>
          n.setAttribute("aria-pressed", String(n.dataset.touch === action)),
        );
      return;
    }
    if (action === "pause") {
      g.pause();
      return;
    }
    if (action === "close") {
      g.closeInventory();
      return;
    }
    if (action === "inventory") {
      if (arena) e.key("KeyH");
      else g.openInventory("personal");
      return;
    }
    if (action === "actions") {
      if (arena) this.moves();
      else this.actions();
      return;
    }
    if (!g.running || g.ui.screen !== "play") return;
    if (action === "sprint") {
      this.sprint = !this.sprint;
      return;
    }
    if (action === "jump") {
      this.keys.add("Space");
      if (arena) e.input("jump");
      else g.controller.trigger("Space");
      return;
    }
    if (action === "down") {
      this.keys.add(arena ? "ControlLeft" : "ShiftLeft");
      if (!arena && g.player.boatId) g.controller.trigger("ShiftLeft");
      return;
    }
    if (action === "boost") {
      this.keys.add("ShiftLeft");
      return;
    }
    if (action === "attack") {
      if (arena) {
        this.keys.add("Mouse0");
        e.input("hit");
      } else {
        this.mining = g.beginPrimaryInput();
      }
      return;
    }
    if (action === "use") {
      if (arena) this.keys.add("Mouse2");
      else if (e.nearPortal) e.enter();
      else {
        this.using = true;
        g.beginSecondaryInput();
      }
      return;
    }
    if (action === "draw") {
      this.keys.add("KeyC");
      return;
    }
    if (arena) {
      e.input(action);
      this.root.querySelector("#touch-tray").hidden = true;
    }
  }
  release(action) {
    if (action === "jump") this.keys.delete("Space");
    if (action === "down") {
      this.keys.delete("ShiftLeft");
      this.keys.delete("ControlLeft");
    }
    if (action === "boost") this.keys.delete("ShiftLeft");
    if (action === "draw") this.keys.delete("KeyC");
    if (action === "attack") {
      this.keys.delete("Mouse0");
      if (this.mining) this.game.endPrimaryInput();
      this.mining = false;
    }
    if (action === "use") {
      this.keys.delete("Mouse2");
      if (this.using) this.game.endSecondaryInput();
      this.using = false;
    }
  }
  moves() {
    const base=this.game.giganto?.active&&this.game.giganto.session?.stage==='traversal';
    const tray = this.root.querySelector("#touch-tray");
    tray.hidden = !tray.hidden;
    if (!tray.hidden)
      tray.innerHTML = [
        ["homing", "Homing"],
        ["boom",base?"Light Dash":"Sonic Boom"],
        ["rush", "Wild Rush"],
        ["loop", "Cyloop"],
        ["cross", "Cross Slash"],
        ["shot",base?"Slide":"Homing Shot"],
        ["stomp", "Stomp"],
        ["spin",base?"Drop Dash":"Spin Slash"],
        ["cyclone", "Cyclone Kick"],
        ["target", "Target"],
        ["climb", "Climb"],
        ["draw", "Draw loop"],
      ]
        .filter(([a])=>!base||!["rush","loop","cross","cyclone"].includes(a))
        .map(([a, n]) => `<button data-touch="${a}">${n}</button>`)
        .join("");
  }
  actions() {
    const g = this.game;
    g.pause();
    g.ui.setScreen(
      "touch-actions",
      '<main class="dialog compact touch-actions"><h2>Actions</h2></main>',
    );
    const root = g.ui.overlay.querySelector("main");
    const items = [
      ["Swap hands",()=>swapHands(g)],
      ["Weapon ability", () => g.controller.trigger("KeyR")],
      ["Drop one", () => g.controller.trigger("KeyQ")],
      ["Drop stack", () => g.controller.trigger("KeyQ", { ctrlKey: true })],
      ["View", () => g.controller.trigger("F5")],
      ["Coordinates", () => g.controller.trigger("F3")],
      ["Journal", () => g.controller.trigger("KeyJ")],
      ["Chat", () => g.chat.open()],
    ];
    for (const [a, code] of Object.entries(g.settings.standKeys || {}))
      items.push(["Stand · " + a, () => g.controller.trigger(code)]);
    if (g.mode === "creative")
      items.push([
        "Flight",
        () => {
          g.player.flying = !g.player.flying;
        },
      ]);
    for (const [label, fn] of items) {
      const b = document.createElement("button");
      b.className = "secondary wide";
      b.textContent = label;
      b.onclick = () => {
        g.resume();
        fn();
      };
      root.append(b);
    }
    const done = document.createElement("button");
    done.textContent = "Back";
    done.onclick = () => g.resume();
    root.append(done);
  }
  settings() {
    const g = this.game,
      c = touchConfig(g.settings.touch);
    g.ui.setScreen(
      "touch-settings",
      `<main class="dialog settings-dialog"><h2>Touch Controls</h2><label>Touch controls<select data-touch-setting="mode">${["auto", "on", "off"].map((v) => `<option value="${v}" ${c.mode === v ? "selected" : ""}>${v === "auto" ? "Automatic" : v === "on" ? "On" : "Off"}</option>`).join("")}</select></label><label>Look sensitivity<input data-touch-setting="sensitivity" type="range" min=".001" max=".008" step=".0005" value="${c.sensitivity}"></label><label>Control opacity<input data-touch-setting="opacity" type="range" min=".3" max="1" step=".05" value="${c.opacity}"></label><p>Move with the left stick. Drag the view to look. Hold Mine or Use. Tap a hotbar slot to select it. Inventory offers Move stack, Split and Quick move.</p><button data-action="back" class="primary wide">Done</button></main>`,
    );
  }
  frame() {
    const g = this.game,
      enabled = this.enabled();
    if (g.controller?.lastDevice === "controller" && this.active)
      this.deactivate();
    const visible =
      enabled &&
      g.controller?.lastDevice !== "controller" &&
      (this.active || this.mobile);
    this.root.hidden = !(
      visible &&
      g.active &&
      ["play", "inventory"].includes(g.ui.screen)
    );
    document.querySelector("#app").classList.toggle("touch-layout", visible);
    this.root.style.setProperty(
      "--touch-opacity",
      touchConfig(g.settings.touch).opacity,
    );
    const arena = !!g.giganto?.active,
      layout = (arena ? "arena" : "world") + ":" + g.ui.screen;
    if (layout !== this.layout) {
      this.clear();
      this.layout = layout;
      this.root.querySelector('[data-touch="inventory"]').textContent = arena
        ? "Controls"
        : "Inventory";
      this.root.querySelector(".touch-buttons").innerHTML = (
        arena
          ? [
              ["attack", "Attack"],
              ["use", "Parry"],
              ["jump", "Rise"],
              ["down", "Down"],
              ["dodge", "Dodge"],
              ["boost", "Boost"],
            ]
          : [
              ["attack", "Mine"],
              ["use", "Use"],
              ["jump", "Jump"],
              ["down", "Crouch"],
              ["sprint", "Sprint"],
            ]
      )
        .map(
          ([a, n]) =>
            `<button data-touch="${a}" aria-label="${n}">${n}</button>`,
        )
        .join("");
      this.root.querySelector("#touch-tray").hidden = true;
    }
    const inv = g.ui.screen === "inventory";
    this.root.querySelector("#touch-inventory").hidden = !inv;
    this.root.querySelector("#touch-joystick").hidden = inv;
    this.root.querySelector(".touch-buttons").hidden = inv;
    this.root.querySelector(".touch-top").hidden = inv;
    if (!this.active || !g.running || g.ui.screen !== "play") return;
    for (const [k, on] of [
      ["KeyW", this.move.y < -0.1],
      ["KeyS", this.move.y > 0.1],
      ["KeyA", this.move.x < -0.1],
      ["KeyD", this.move.x > 0.1],
    ]) {
      if (on) this.keys.add(k);
      else this.keys.delete(k);
    }
    if (!arena) {
      if (this.sprint && Math.hypot(this.move.x, this.move.y) > 0.06)
        this.keys.add("ControlLeft");
      else this.keys.delete("ControlLeft");
    }
  }
}
