import { TouchInput } from "./touch.js";
import { touchConfig } from "./touch-data.js";
import { POCKET_STORAGE, pocketConfig, pocketStick, pocketDpad, pocketWorldMoves } from "./pocket-controls-data.js";
import "./pocket-touch.css";

// Instantiated only by the mobile asset build. Desktop keeps TouchInput.
export class PocketTouchInput extends TouchInput {
  constructor(g) {
    super(g);
    let saved;
    try { saved = JSON.parse(localStorage.getItem(POCKET_STORAGE) || "{}"); } catch {}
    this.config = pocketConfig(saved);
    this.pocketReady = true;
    this.crouched = false;
    this.root.classList.add("pocket-controls");
    this.root.insertAdjacentHTML("beforeend", `<div id="touch-dpad" aria-label="Movement pad" hidden>${[
      ["nw", "↖"], ["n", "▲"], ["ne", "↗"], ["w", "◀"], ["center", "◆"],
      ["e", "▶"], ["sw", "↙"], ["s", "▼"], ["se", "↘"],
    ].map(([d, icon]) => `<span data-direction="${d}" aria-hidden="true">${icon}</span>`).join("")}</div><div class="pocket-utility"></div>`);
    const top = this.root.querySelector(".touch-top");
    top.insertAdjacentHTML("beforeend", '<button data-touch="chat" aria-label="Chat">▤</button>');
    this.root.querySelector('[data-touch="pause"]').textContent = "II";
    this.root.querySelector('[data-touch="pause"]').setAttribute("aria-label", "Pause");
    this.root.querySelector('[data-touch="actions"]').textContent = "Moves";
    this.root.querySelector('[data-touch="inventory"]').classList.add("pocket-inventory");
    this.root.append(this.root.querySelector('[data-touch="inventory"]'));
    g.ui.overlay.addEventListener("change", e => {
      const key = e.target.dataset.pocketSetting;
      if (!key) return;
      this.config = pocketConfig({ ...this.config, [key]: e.target.type === "checkbox"
        ? e.target.checked : e.target.type === "range" ? Number(e.target.value) : e.target.value });
      try { localStorage.setItem(POCKET_STORAGE, JSON.stringify(this.config)); }
      catch { g.ui.toast("Touch settings could not be saved."); }
      this.clear();
      this.layout = "";
    });
    addEventListener("resize", () => { this.clear(); this.layout = ""; });
    this.frame();
  }
  clear() {
    super.clear();
    this.crouched = false;
    this.manualSprint = false;
    this.autoSprint = false;
    this.lastForwardTap = null;
    if (this.root) {
      this.root.querySelector("#touch-joystick")?.style.removeProperty("--stick-x");
      this.root.querySelector("#touch-joystick")?.style.removeProperty("--stick-y");
      this.root.querySelector("#touch-joystick")?.style.removeProperty("translate");
    }
  }
  look(dx, dy) {
    const g = this.game, a = g.giganto?.active ? g.giganto.session.avatar : g.player;
    const sensitivity = touchConfig(g.settings.touch).sensitivity;
    a.yaw -= dx * sensitivity;
    a.pitch = Math.max(-1.3, Math.min(1.3, a.pitch + dy * sensitivity * (g.giganto?.active ? 1 : -1)));
  }
  down(e) {
    if (!this.pocketReady || e.pointerType !== "touch" || !this.enabled()) return super.down(e);
    const g = this.game, node = e.target.closest("#touch-joystick, #touch-dpad");
    if (node && g.running && g.ui.screen === "play") {
      e.preventDefault(); e.stopImmediatePropagation();
      if ([...this.pointers.values()].some(p => ["stick", "dpad"].includes(p.kind))) return;
      this.activate(); g.audio.unlock();
      const rect = node.getBoundingClientRect(), floating = node.id === "touch-joystick" && this.config.floating;
      const p = {kind: node.id === "touch-dpad" ? "dpad" : "stick", node,
        x: floating ? e.clientX : rect.x + rect.width / 2,
        y: floating ? e.clientY : rect.y + rect.height / 2, radius: rect.width / 2};
      this.pointers.set(e.pointerId, p);
      node.setPointerCapture?.(e.pointerId);
      if (floating) node.style.translate = `${e.clientX - rect.x - rect.width / 2}px ${e.clientY - rect.y - rect.height / 2}px`;
      this.updateMove(p, e);
      if (p.kind === "dpad" && this.move.y < -0.5) {
        const now = performance.now();
        if (this.lastForwardTap != null && now - this.lastForwardTap < 300)
          this.manualSprint = true;
        this.lastForwardTap = now;
      }
      return;
    }
    super.down(e);
    const p = this.pointers.get(e.pointerId);
    if (p?.kind === "button") { p.x = e.clientX; p.y = e.clientY; }
  }
  updateMove(p, e) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    const vector = p.kind === "dpad" ? pocketDpad(dx, dy, p.radius)
      : pocketStick(dx, dy, p.radius, this.config.sprint);
    this.move = {x: vector.x, y: vector.y};
    this.autoSprint = !!vector.sprint;
    if (p.kind === "stick") {
      p.node.querySelector("i").style.transform = `translate(${vector.x * 27}px,${vector.y * 27}px)`;
      p.node.setAttribute("aria-valuenow", Math.round(Math.hypot(vector.x, vector.y) * 100));
    }
  }
  pointerMove(e) {
    if (!this.pocketReady) return super.pointerMove(e);
    const p = this.pointers.get(e.pointerId);
    if (p && ["stick", "dpad"].includes(p.kind)) {
      e.preventDefault(); this.updateMove(p, e); return;
    }
    if (p?.kind === "button" && ["attack", "use"].includes(p.action) && this.game.running) {
      e.preventDefault(); this.look(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY; return;
    }
    super.pointerMove(e);
  }
  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (this.pocketReady && p && ["stick", "dpad"].includes(p.kind)) {
      this.pointers.delete(e.pointerId); this.move = {x:0, y:0};
      this.sprint = this.manualSprint = this.autoSprint = false;
      for (const k of ["KeyW", "KeyS", "KeyA", "KeyD", "ControlLeft"]) this.keys.delete(k);
      p.node.querySelector("i")?.style.removeProperty("transform");
      p.node.style.removeProperty("translate");
      p.node.setAttribute("aria-valuenow", "0");
      return;
    }
    super.up(e);
  }
  press(action) {
    if (!this.pocketReady) return super.press(action);
    const g = this.game, arena = g.giganto?.active;
    if (action === "chat") { g.chat.open(); return; }
    if (action === "actions") { this.moves(); return; }
    if (!g.running || g.ui.screen !== "play") return super.press(action);
    if (action === "weapon") { g.controller.trigger("KeyR"); return; }
    if (action.startsWith("stand:")) { g.controller.trigger(action.slice(6)); return; }
    if (action === "view") { g.controller.trigger("F5"); return; }
    if (action === "more") { super.actions(); return; }
    if (action === "down" && !arena && !g.player.flying && !g.player.underwater && !g.player.boatId && this.config.toggleCrouch) {
      this.crouched = !this.crouched;
      return;
    }
    if (action === "sprint") { this.manualSprint = !this.manualSprint; return; }
    super.press(action);
  }
  moves() {
    const g = this.game, tray = this.root.querySelector("#touch-tray");
    if (g.giganto?.active) return super.moves();
    tray.hidden = !tray.hidden;
    if (!tray.hidden) tray.innerHTML = [...pocketWorldMoves(g), ["view", "View"], ["more", "More…"]]
      .map(([a,n]) => `<button data-touch="${a}">${n}</button>`).join("");
  }
  frame() {
    if (!this.pocketReady) return super.frame();
    const before = this.layout;
    this.sprint = this.manualSprint || this.autoSprint;
    super.frame();
    const g = this.game, visible = !this.root.hidden, arena = !!g.giganto?.active;
    const app = document.querySelector("#app");
    app.classList.toggle("pocket-layout", app.classList.contains("touch-layout"));
    this.root.dataset.layout = this.config.layout;
    this.root.dataset.arena = String(arena);
    this.root.dataset.leftHanded = String(this.config.leftHanded);
    this.root.style.setProperty("--pocket-size", this.config.size);
    this.root.querySelector("#touch-dpad").hidden = !visible || g.ui.screen !== "play" || this.config.layout !== "dpad";
    this.root.querySelector("#touch-joystick").hidden = !visible || g.ui.screen !== "play" || this.config.layout === "dpad";
    this.root.querySelector('[data-touch="inventory"]').hidden = g.ui.screen === "inventory";
    this.root.querySelector(".pocket-utility").hidden = g.ui.screen !== "play";
    if (before !== this.layout) {
      const inv = this.root.querySelector('[data-touch="inventory"]');
      inv.textContent = arena ? "?" : "⋯";
      inv.setAttribute("aria-label", arena ? "Controls" : "Inventory");
      this.root.querySelector(".pocket-utility").innerHTML = arena ? "" : '<button data-touch="weapon" aria-label="Weapon ability" hidden>Ability</button>';
      this.root.querySelectorAll(".touch-buttons button").forEach(b => b.dataset.caption = b.textContent);
    }
    if (visible && g.running && g.ui.screen === "play") {
      if (!arena && this.crouched && (g.player.flying || g.player.underwater || g.player.boatId)) {
        this.crouched = false;
        if (![...this.pointers.values()].some(p => p.kind === "button" && p.action === "down"))
          this.keys.delete("ShiftLeft");
      }
      if (!arena && this.crouched && !g.player.flying && !g.player.underwater) this.keys.add("ShiftLeft");
      if (!arena && this.sprint && this.move.y < -0.2) this.keys.add("ControlLeft");
      const down = this.root.querySelector('[data-touch="down"]');
      if (down) {
        down.setAttribute("aria-pressed", String(!arena && this.crouched));
        const label = arena || g.player.flying || g.player.underwater ? "Down" : g.player.boatId ? "Dismount" : "Sneak";
        if (down.textContent !== label) {
          down.textContent = label;
          down.setAttribute("aria-label", label);
        }
      }
      const jump = this.root.querySelector('[data-touch="jump"]');
      const jumpLabel = arena ? "Rise" : g.player.flying ? "Up" : g.player.underwater ? "Swim" : "Jump";
      if (jump && jump.textContent !== jumpLabel) {
        jump.textContent = jumpLabel;
        jump.setAttribute("aria-label", jumpLabel);
      }
      const ability = this.root.querySelector('.pocket-utility [data-touch="weapon"]');
      if (ability) {
        const move = pocketWorldMoves(g).find(([id]) => id === "weapon");
        ability.hidden = !move;
        if (move && ability.textContent !== move[1]) ability.textContent = move[1];
      }
    }
  }
  settings() {
    super.settings();
    const root = this.game.ui.overlay.querySelector("main"), c = this.config;
    root.querySelector("p").textContent = "Drag to look. Hold Mine or Use; drag either button to aim. Double-tap Jump to fly in Creative. Moves opens your abilities.";
    root.querySelector("h2").insertAdjacentHTML("afterend", `<label>Control layout<select data-pocket-setting="layout"><option value="joystick" ${c.layout === "joystick" ? "selected" : ""}>Joystick & crosshair</option><option value="dpad" ${c.layout === "dpad" ? "selected" : ""}>D-pad & crosshair</option></select></label><label>Button size<input data-pocket-setting="size" type="range" min=".85" max="1.3" step=".05" value="${c.size}"></label>${[["sprint","Sprint with joystick"],["toggleCrouch","Toggle sneak"],["floating","Floating joystick"],["leftHanded","Left-handed layout"]].map(([k,n]) => `<label>${n}<input data-pocket-setting="${k}" type="checkbox" ${c[k] ? "checked" : ""}></label>`).join("")}`);
  }
}
