import {
  usernameOf,
  serviceURL,
  challengeMessage,
} from "../server/social-protocol.mjs";
import {
  identityGet,
  identityPut,
  newIdentity,
  exportIdentity,
  importIdentity,
} from "./social-identity.js";
import { invitationURL } from "./multiplayer.js";
import { FriendsPanel } from "./friends-panel.js";
const encoded = (data) =>
  btoa(String.fromCharCode(...new Uint8Array(data)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
export class FriendsClient {
  constructor(game) {
    this.game = game;
    this.pending = new Map();
    this.sequence = 0;
    this.state = { friends: [], requests: [], invitations: [], blocked: [] };
    this.status = "offline";
    this.panel = new FriendsPanel(this);
    this.boot().catch((e) => {
      this.error = e.message;
    });
  }
  async boot() {
    const configured =
      globalThis.DCSMCRAFT_SOCIAL_URL ||
      (typeof __DCSMCRAFT_SOCIAL_URL__ !== "undefined"
        ? __DCSMCRAFT_SOCIAL_URL__
        : "");
    try {
      this.url = serviceURL(
        localStorage.getItem("dcsmcraft-friends-service") || configured,
      );
    } catch {
      this.url = "";
    }
    if (!this.url && ["http:", "https:"].includes(location.protocol)) {
      try {
        const r = await fetch(new URL("/health", location.origin), {
          signal: AbortSignal.timeout(3000),
        });
        const info = await r.json();
        if (info.social === true) this.url = serviceURL(location.origin);
      } catch {}
    }
    if (this.url) {
      this.identity = await identityGet(this.url);
      if (this.identity?.registered) this.connect().catch(() => {});
    }
  }
  changed() {
    const n =
      (this.state.invitations?.length || 0) +
      (this.state.requests?.filter((r) => r.incoming).length || 0);
    for (const b of document.querySelectorAll("[data-action=friends]"))
      b.textContent = n ? `Friends (${n})` : "Friends";
    this.panel.update();
  }
  async configure(raw) {
    const url = serviceURL(raw);
    if (this.game.multiplayer.connected)
      throw Error("Leave the current server before changing services.");
    this.disconnect();
    this.url = url;
    this.identity = await identityGet(url);
    this.state = { friends: [], requests: [], invitations: [], blocked: [] };
    localStorage.setItem("dcsmcraft-friends-service", url);
    this.changed();
  }
  async connect(username) {
    if (!this.url) throw Error("Configure the friends service first.");
    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.token &&
      Date.now() - this.signedAt < 72000000
    )
      return;
    this.disconnect();
    this.error = "";
    this.status = "connecting";
    this.changed();
    if (username) {
      const name = usernameOf(username);
      if (this.identity?.registered && name !== this.identity.username)
        throw Error("Restore the account backup to use another username.");
      if (!this.identity) this.identity = await newIdentity(name);
      else if (!this.identity.registered) this.identity.username = name;
      await identityPut(this.url, this.identity);
    } else this.identity ||= await identityGet(this.url);
    if (!this.identity) {
      this.status = "offline";
      throw Error("Choose a username first.");
    }
    const target = new URL(this.url);
    target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
    target.pathname = "/social";
    const ws = (this.socket = new WebSocket(target));
    return new Promise((resolve, reject) => {
      let finished = false;
      const fail = (e) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.error = e.message || String(e);
        this.status = "offline";
        this.changed();
        reject(e);
      };
      const timer = setTimeout(() => {
        fail(Error("Friends service did not respond."));
        ws.close();
      }, 12000);
      ws.onmessage = async (event) => {
        if (this.socket !== ws) return;
        try {
          const m = JSON.parse(event.data);
          if (m.type === "challenge") {
            if (
              m.audience !== this.url ||
              typeof m.nonce !== "string" ||
              m.nonce.length > 100
            )
              throw Error("Friends service identity does not match.");
            const data = new TextEncoder().encode(
              challengeMessage(
                m.nonce,
                this.identity.username,
                this.identity.publicKey,
                this.url,
              ),
            );
            const signature = encoded(
              await crypto.subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                this.identity.privateKey,
                data,
              ),
            );
            if (this.socket !== ws) return;
            const result = await this.request(
              this.identity.registered ? "login" : "register",
              {
                username: this.identity.username,
                publicKey: this.identity.publicKey,
                signature,
              },
            );
            if (this.socket !== ws) return;
            this.identity.registered = true;
            await identityPut(this.url, this.identity);
            this.token = result.token;
            this.signedAt = Date.now();
            this.state = result;
            this.status = "online";
            finished = true;
            clearTimeout(timer);
            this.changed();
            resolve();
          } else if (m.type === "response") {
            const p = this.pending.get(m.request);
            if (p) {
              clearTimeout(p.timer);
              this.pending.delete(m.request);
              m.ok
                ? p.resolve(m.result)
                : p.reject(Error(m.message || "Request failed."));
            }
          } else if (m.type === "state") {
            const previous = new Set(
              this.state.invitations?.map((i) => i.id) || [],
            );
            this.state = m.state;
            if (this.status === "online" && this.game.ui.screen !== "friends") {
              const fresh = this.state.invitations?.find(
                (i) => !previous.has(i.id),
              );
              if (fresh)
                this.game.ui.toast(
                  `${fresh.username} invited you. Open Friends to join.`,
                );
            }
            this.changed();
          }
        } catch (e) {
          fail(e);
          ws.close();
        }
      };
      ws.onerror = () => fail(Error("Friends service is unavailable."));
      ws.onclose = () => {
        if (this.socket !== ws) return;
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(Error("Friends service disconnected."));
        }
        this.pending.clear();
        this.token = null;
        this.status = "offline";
        this.changed();
        fail(Error("Friends service disconnected."));
      };
    });
  }
  request(action, data = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN)
      return Promise.reject(Error("Connect to Friends first."));
    return new Promise((resolve, reject) => {
      const request = ++this.sequence,
        timer = setTimeout(() => {
          this.pending.delete(request);
          reject(Error("The service did not respond."));
        }, 10000);
      this.pending.set(request, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ request, action, ...data }));
    });
  }
  async action(action, data) {
    await this.connect();
    const result = await this.request(action, data);
    if (result?.profile) this.state = result;
    this.changed();
    return result;
  }
  async invite(id) {
    await this.connect();
    const g = this.game,
      m = g.multiplayer;
    if (!g.active) throw Error("Open a world first.");
    if (m.isGuest) throw Error("Only the world owner can invite players.");
    if (!m.connected)
      await m.connect({
        server: this.url,
        name: this.identity.username,
        hubToken: this.token,
        friendsOnly: true,
      });
    if (new URL(m.server).host !== new URL(this.url).host)
      throw Error(
        "Close the current server before opening this world to Friends.",
      );
    await this.action("invite", { id, room: m.room });
    g.ui.toast("Invitation sent.");
  }
  async join(id) {
    await this.connect();
    const g = this.game;
    if (g.active) await g.quit();
    const result = await this.action("join", { id });
    await g.multiplayer.connect({
      invite: invitationURL(this.url, result.room, result.ticket),
      name: this.identity.username,
      hubToken: this.token,
    });
    g.pause();
  }
  async backup() {
    const raw = await exportIdentity(this.url, this.identity),
      blob = new Blob([JSON.stringify(raw, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `DCSMCRAFT-account-${this.identity.username}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async restore(file) {
    if (file.size > 16384) throw Error("Account backup is too large.");
    if (this.game.multiplayer.connected)
      throw Error("Leave the server before restoring an account.");
    const saved = await importIdentity(JSON.parse(await file.text()));
    this.disconnect();
    this.url = saved.url;
    this.identity = saved.identity;
    localStorage.setItem("dcsmcraft-friends-service", this.url);
    await this.connect();
    this.changed();
  }
  disconnect() {
    const ws = this.socket;
    this.socket = null;
    this.token = null;
    this.status = "offline";
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(Error("Disconnected."));
    }
    this.pending.clear();
    ws?.close();
    this.changed();
  }
}
