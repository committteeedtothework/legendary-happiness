import { WebSocketServer, WebSocket } from "ws";
import { randomBytes, createHash, createPublicKey, verify } from "node:crypto";
import { SocialStore, usernameOf, publicKeyOf } from "./social-store.mjs";
import { challengeMessage, serviceURL } from "./social-protocol.mjs";
export { challengeMessage } from "./social-protocol.mjs";
const token = () => randomBytes(32).toString("base64url");
const hash = (t) => createHash("sha256").update(String(t)).digest("hex");

export class SocialHub {
  constructor({
    database = ":memory:",
    allowedOrigins = [],
    audience = "",
  } = {}) {
    this.store = new SocialStore(database);
    this.clients = new Map();
    this.sessions = new Map();
    this.rooms = new Map();
    this.tickets = new Map();
    this.ipLimits = new Map();
    this.allowedOrigins = allowedOrigins;
    this.audience = audience ? serviceURL(audience) : null;
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 16384,
      perMessageDeflate: false,
    });
    this.wss.on("connection", (ws, req) => this.connected(ws, req));
    this.timer = setInterval(() => this.sweep(), 30000);
    this.timer.unref();
  }
  upgrade(req, socket, head) {
    try {
      req.socialAudience =
        this.audience ||
        serviceURL(
          `${req.socket.encrypted ? "https" : "http"}://${req.headers.host || "localhost"}`,
        );
    } catch {
      socket.destroy();
      return;
    }
    const origin = req.headers.origin;
    if (
      this.allowedOrigins.length &&
      origin &&
      !this.allowedOrigins.includes(origin) &&
      origin !== this.audience &&
      origin !== "null" &&
      origin !== "dcsmcraft://game"
    ) {
      socket.destroy();
      return;
    }
    const ip = req.socket.remoteAddress || "local",
      now = Date.now();
    let limit = this.ipLimits.get(ip);
    if (!limit || limit.until < now)
      this.ipLimits.set(ip, (limit = { count: 0, until: now + 60000 }));
    if (++limit.count > 30 || this.wss.clients.size >= 512) {
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) =>
      this.wss.emit("connection", ws, req),
    );
  }
  send(ws, data) {
    if (ws?.readyState === WebSocket.OPEN) {
      if (ws.bufferedAmount > 256 * 1024) {
        ws.close(1013, "Connection too slow");
        return;
      }
      ws.send(JSON.stringify(data));
    }
  }
  connected(ws, req) {
    ws.nonce = token();
    ws.challengeUntil = Date.now() + 30000;
    ws.window = Date.now();
    ws.count = 0;
    ws.audience = req.socialAudience;
    this.send(ws, {
      type: "challenge",
      nonce: ws.nonce,
      audience: ws.audience,
    });
    const timer = setTimeout(() => {
      if (!ws.account) ws.close(1008, "Sign-in timed out");
    }, 30000);
    timer.unref();
    ws.on("message", (raw) => {
      try {
        if (Date.now() - ws.window > 10000) {
          ws.window = Date.now();
          ws.count = 0;
        }
        if (++ws.count > 30) throw Error("Too many requests.");
        const m = JSON.parse(raw.toString());
        if (
          !m ||
          typeof m !== "object" ||
          !Number.isSafeInteger(m.request) ||
          typeof m.action !== "string"
        )
          throw Error("Invalid request.");
        let result;
        try {
          result = this.request(ws, m);
          this.send(ws, {
            type: "response",
            request: m.request,
            ok: true,
            result,
          });
        } catch (e) {
          this.send(ws, {
            type: "response",
            request: m.request,
            ok: false,
            message: e.message,
          });
        }
      } catch (e) {
        ws.close(1008, e.message.slice(0, 100));
      }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(timer);
      if (ws.account) {
        const set = this.clients.get(ws.account.id);
        set?.delete(ws);
        if (!set?.size) this.clients.delete(ws.account.id);
        this.publish();
      }
    });
  }
  request(ws, m) {
    if (!ws.account) {
      if (
        !["register", "login"].includes(m.action) ||
        Date.now() > ws.challengeUntil
      )
        throw Error("Sign in first.");
      const name = usernameOf(m.username),
        account = this.store.account(name),
        key =
          m.action === "register"
            ? publicKeyOf(m.publicKey)
            : account && JSON.parse(account.public_key);
      if (!key) throw Error("Account unavailable.");
      if (typeof m.signature !== "string" || m.signature.length > 120)
        throw Error("Invalid account proof.");
      const data = Buffer.from(
        challengeMessage(ws.nonce, name, key, ws.audience),
      );
      if (
        !verify(
          "sha256",
          data,
          {
            key: createPublicKey({ key, format: "jwk" }),
            dsaEncoding: "ieee-p1363",
          },
          Buffer.from(m.signature, "base64url"),
        )
      )
        throw Error("Account key does not match.");
      ws.nonce = null;
      ws.account =
        m.action === "register" ? this.store.register(name, key) : account;
      const peers = this.clients.get(ws.account.id) || new Set();
      if (peers.size >= 4) throw Error("Too many signed-in devices.");
      peers.add(ws);
      this.clients.set(ws.account.id, peers);
      const access = token();
      ws.access = hash(access);
      this.sessions.set(ws.access, {
        id: ws.account.id,
        username: ws.account.username,
        expires: Date.now() + 86400000,
      });
      this.publish();
      return { token: access, ...this.snapshot(ws.account.id) };
    }
    const id = ws.account.id;
    if (m.action === "sync") return this.snapshot(id);
    if (m.action === "request") this.store.request(id, m.username);
    else if (m.action === "accept") this.store.accept(id, m.id);
    else if (m.action === "remove" || m.action === "decline")
      this.store.remove(id, m.id);
    else if (m.action === "block") this.store.block(id, m.id);
    else if (m.action === "unblock") this.store.unblock(id, m.id);
    else if (m.action === "invite") {
      const room = this.rooms.get(m.room);
      if (!room || room.host.account?.id !== id)
        throw Error("Open your world to friends first.");
      this.store.invite(id, m.id, room.id);
    } else if (m.action === "dismiss") this.store.dismiss(id, m.id);
    else if (m.action === "join") {
      const invite = this.store.takeInvite(id, m.id),
        room = this.rooms.get(invite.room);
      if (!room || room.host.account?.id !== invite.sender)
        throw Error("The host is offline.");
      if (room.guests.size >= 7) throw Error("That world is full.");
      const ticket = randomBytes(24).toString("base64url");
      this.tickets.set(hash(ticket), {
        account: id,
        owner: invite.sender,
        room: room.id,
        expires: Date.now() + 30000,
      });
      this.publish();
      return { room: room.id, ticket };
    } else if (m.action === "logout") {
      this.sessions.delete(ws.access);
      ws.close(1000, "Signed out");
      return {};
    } else throw Error("Unknown friends action.");
    this.publish();
    return this.snapshot(id);
  }
  identity(access) {
    const s =
      typeof access === "string" && access.length < 128
        ? this.sessions.get(hash(access))
        : null;
    return s && s.expires > Date.now()
      ? { id: s.id, username: s.username }
      : null;
  }
  joinTicket(ticket, id, room) {
    const key = hash(ticket),
      t = this.tickets.get(key);
    if (
      !t ||
      t.account !== id ||
      t.room !== room ||
      t.expires < Date.now() ||
      !this.store.areFriends(id, t.owner)
    )
      return false;
    this.tickets.delete(key);
    return true;
  }
  bindRoom(room) {
    this.rooms.set(room.id, room);
    this.publish();
  }
  unbindRoom(room) {
    this.rooms.delete(room.id);
    this.publish();
  }
  snapshot(id) {
    const state = this.store.snapshot(id);
    for (const f of state.friends) {
      f.online = this.clients.has(f.id);
      f.playing = [...this.rooms.values()].some(
        (r) =>
          r.host.account?.id === f.id ||
          [...r.guests.values()].some((p) => p.account?.id === f.id),
      );
    }
    state.invitations = state.invitations.filter((i) =>
      this.rooms.has(
        this.store.db
          .prepare("SELECT room FROM invitations WHERE id=?")
          .get(i.id)?.room,
      ),
    );
    return state;
  }
  publish() {
    for (const [id, clients] of this.clients) {
      const state = this.snapshot(id);
      for (const ws of clients) this.send(ws, { type: "state", state });
    }
  }
  sweep() {
    const now = Date.now();
    for (const [id, v] of this.sessions)
      if (v.expires < now) this.sessions.delete(id);
    for (const [id, v] of this.tickets)
      if (v.expires < now) this.tickets.delete(id);
    for (const [id, v] of this.ipLimits)
      if (v.until < now) this.ipLimits.delete(id);
    for (const ws of this.wss.clients) {
      if (ws.alive === false) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
      ws.once("pong", () => (ws.alive = true));
    }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    for (const ws of this.wss.clients) ws.terminate();
    await new Promise((r) => this.wss.close(r));
    this.store.close();
  }
}
