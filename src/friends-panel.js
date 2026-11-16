const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export class FriendsPanel {
  constructor(client) {
    this.client = client;
    this.game = client.game;
  }
  open() {
    this.game.pause();
    this.render(true);
  }
  update() {
    if (this.game.ui.screen === "friends") this.render();
  }
  render(force = false) {
    const c = this.client,
      g = this.game,
      ui = g.ui,
      focused = document.activeElement;
    if (
      !force &&
      focused?.tagName === "INPUT" &&
      ui.overlay.contains(focused)
    ) {
      this.dirty = true;
      return;
    }
    const state = c.state || {},
      online = c.status === "online",
      friend = (p, actions) =>
        `<div class="friend-row"><span><b>${esc(p.username)}</b>${p.online !== undefined ? `<small>${p.online ? (p.playing ? "In a world" : "Online") : "Offline"}</small>` : ""}</span>${actions}</div>`,
      button = (text, action, id, disabled = false) =>
        `<button data-social="${action}" data-id="${esc(id)}" ${disabled ? "disabled" : ""}>${text}</button>`;
    ui.setScreen(
      "friends",
      `<main class="dialog friends-dialog"><h2>Friends</h2><p class="friends-status" role="status">${c.status === "connecting" ? "Connecting…" : online ? esc(state.profile?.username) : c.identity?.registered ? esc(c.identity.username) + " · Offline" : "DCSMCRAFT Account"}</p>${c.error ? `<p class="friends-error">${esc(c.error)}</p>` : ""}${!online ? `<form data-social-form="signin">${!c.identity?.registered ? '<label>Username<input name="username" minlength="3" maxlength="20" autocomplete="username" required></label>' : ""}<button type="submit" ${!c.url ? "disabled" : ""}>${c.identity?.registered ? "Sign In" : "Create Account"}</button></form>` : `<form data-social-form="add"><label>Add Friend<input name="username" minlength="3" maxlength="20" autocomplete="off" required></label><button type="submit">Add Friend</button></form><section><h3>Invitations</h3>${(state.invitations || []).map((p) => friend(p, button(g.active ? "Save & Join" : "Join", "join", p.id) + button("Dismiss", "dismiss", p.id))).join("") || "<p>No invitations.</p>"}</section><section><h3>Requests</h3>${(state.requests || []).map((p) => friend(p, p.incoming ? button("Accept", "accept", p.id) + button("Decline", "decline", p.id) : button("Cancel Request", "remove", p.id))).join("") || "<p>No pending requests.</p>"}</section><section><h3>Friends</h3>${(state.friends || []).map((p) => friend(p, button("Invite", "invite", p.id, !g.active || g.multiplayer.isGuest || !p.online) + button("Remove", "remove", p.id) + button("Block", "block", p.id))).join("") || "<p>No friends yet.</p>"}</section>${state.blocked?.length ? `<details><summary>Blocked Players</summary>${state.blocked.map((p) => friend(p, button("Unblock", "unblock", p.id))).join("")}</details>` : ""}${button("Back Up Account", "backup", "")}<p class="fine">Keep your account backup private. It restores your username and friends on another device.</p>`}<details ${!c.url ? "open" : ""}><summary>Connection Settings</summary><form data-social-form="service"><label>Friends Service<input name="service" type="url" value="${esc(c.url)}" placeholder="https://friends.example.com" required></label><button type="submit">Save</button></form><label class="account-restore">Restore Account<input type="file" data-restore-account accept="application/json,.json"></label>${c.url ? "" : "<p>The online service has not been configured.</p>"}</details>${online ? button("Disconnect", "disconnect", "") : ""}<button class="primary wide" data-action="back">Done</button></main>`,
    );
    const panel = ui.overlay.querySelector("main");
    const run = async (fn, control) => {
      if (control) control.disabled = true;
      try {
        c.error = "";
        await fn();
      } catch (e) {
        c.error = e.message;
        g.ui.toast(e.message);
      } finally {
        if (ui.screen === "friends") this.render(true);
      }
    };
    panel.addEventListener("click", (e) => {
      const b = e.target.closest("[data-social]");
      if (!b) return;
      run(async () => {
        const action = b.dataset.social,
          id = b.dataset.id;
        if (action === "invite") await c.invite(id);
        else if (action === "join") await c.join(id);
        else if (action === "backup") await c.backup();
        else if (action === "disconnect") c.disconnect();
        else await c.action(action, { id });
      }, b);
    });
    panel.addEventListener("submit", (e) => {
      e.preventDefault();
      const form = e.target,
        data = new FormData(form);
      run(async () => {
        if (form.dataset.socialForm === "service") {
          await c.configure(data.get("service"));
        } else if (form.dataset.socialForm === "signin")
          await c.connect(data.get("username") || undefined);
        else await c.action("request", { username: data.get("username") });
      }, form.querySelector("button"));
    });
    panel.querySelector("[data-restore-account]").onchange = (e) => {
      const file = e.target.files[0];
      if (file) run(() => c.restore(file));
    };
    panel.addEventListener("focusout", () => {
      if (this.dirty) {
        this.dirty = false;
        setTimeout(() => this.update(), 0);
      }
    });
  }
}
