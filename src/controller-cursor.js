// Uses the inventory's existing transactions, including guest authority and
// stack limits. The cursor never mutates stacks or fabricates drag events.
export class ControllerCursor {
  constructor(manager) {
    this.manager = manager;
    this.x = 0;
    this.y = 0;
    this.visited = new Set();
    this.el = document.createElement("div");
    this.el.id = "controller-cursor";
    this.el.hidden = true;
    this.el.setAttribute("aria-hidden", "true");
    document.querySelector("#app").append(this.el);
  }
  hide() {
    this.el.hidden = true;
    this.active = false;
    this.visited.clear();
    this.held = false;
  }
  frame(r, edge, dt, names, nodes) {
    const m = this.manager,
      g = m.game;
    if (!this.active) {
      const node = nodes.find((n) => n.matches(".slot[data-ref]")) || nodes[0],
        b = node?.getBoundingClientRect();
      this.x = b ? b.x + b.width / 2 : innerWidth / 2;
      this.y = b ? b.y + b.height / 2 : innerHeight / 2;
      this.active = true;
    }
    const speed = 620 * (m.config?.cursorSpeed ?? 1),
      moving = Math.hypot(r.move.x, r.move.y) > 0;
    this.x = Math.max(
      5,
      Math.min(innerWidth - 5, this.x + r.move.x * speed * Math.min(dt, 0.05)),
    );
    this.y = Math.max(
      5,
      Math.min(innerHeight - 5, this.y + r.move.y * speed * Math.min(dt, 0.05)),
    );
    const direction = edge("left")
      ? [-1, 0]
      : edge("right")
        ? [1, 0]
        : edge("up")
          ? [0, -1]
          : edge("down")
            ? [0, 1]
            : null;
    if (direction) {
      const candidates = nodes
        .map((n) => {
          const b = n.getBoundingClientRect(),
            dx = b.x + b.width / 2 - this.x,
            dy = b.y + b.height / 2 - this.y,
            along = dx * direction[0] + dy * direction[1],
            cross = Math.abs(dx * direction[1] - dy * direction[0]);
          return { n, b, score: along > 3 ? along + cross * 3 : Infinity };
        })
        .sort((a, b) => a.score - b.score);
      if (Number.isFinite(candidates[0]?.score)) {
        this.x = candidates[0].b.x + candidates[0].b.width / 2;
        this.y = candidates[0].b.y + candidates[0].b.height / 2;
      }
    }
    const hit = document
      .elementsFromPoint(this.x, this.y)
      .map((n) => n.closest?.("button,input,select,textarea,.slot[data-ref]"))
      .find((n) => nodes.includes(n));
    document.querySelectorAll(".pad-focus").forEach((n) => {
      if (n !== hit) n.classList.remove("pad-focus");
    });
    if (hit) {
      m.focus(hit);
      if (moving)
        hit.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            clientX: this.x,
            clientY: this.y,
          }),
        );
    }
    if (edge(names.cancel) || edge("pause")) {
      m.cancel();
      this.hide();
      return;
    }
    const pressed = !!r.buttons[names.confirm],
      split = !!r.buttons.attack;
    if (!pressed && !split) this.visited.clear();
    const key = hit?.dataset.ref + ":" + hit?.dataset.index;
    if (hit && edge("inventory")) m.confirm(hit, 0, true);
    else if (hit && (edge(names.confirm) || edge("attack"))) {
      m.confirm(hit, split ? 2 : 0, false);
      this.visited.add(key);
    } else if (
      hit?.matches(".slot[data-ref]") &&
      split &&
      g.inventory.cursor &&
      !this.visited.has(key)
    ) {
      m.confirm(hit, 2, false);
      this.visited.add(key);
    }
    const panel =
      g.ui.overlay.querySelector(".creative-catalog") ||
      g.ui.overlay.querySelector(".dialog");
    if (panel && Math.abs(r.look.y) > 0.15)
      panel.scrollTop += r.look.y * dt * 500;
    this.el.hidden = false;
    this.el.style.transform = `translate(${this.x}px,${this.y}px)`;
    g.ui.cursorEl.style.transform = `translate(${this.x + 12}px,${this.y + 12}px)`;
  }
}
