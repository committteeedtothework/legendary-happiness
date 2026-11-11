import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { networkInterfaces } from "node:os";
import { WebSocketServer, WebSocket } from "ws";

import { PROTOCOL } from "./protocol.mjs";
export { PROTOCOL };
export const MAX_PLAYERS = 8;
export function normalizePublicURL(value) {
  if (!value) return "";
  const u = new URL(value);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw Error(
      "PUBLIC_URL must be an HTTP(S) origin, such as https://play.example.com",
    );
  return u.origin;
}
const token = (n) => randomBytes(n).toString("base64url");
const text = (s, n) =>
  typeof s === "string"
    ? s
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, n)
    : "";
const sameKey = (a, b) =>
  typeof a === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));

// The host browser owns simulation and saving. This relay owns room membership,
// routing and limits; it never accepts guest world snapshots or stores passwords.
export function createRelay({
  htmlPath = resolve("dist/DCSMCRAFT-Standalone.html"),
  maxConnections = 64,
  publicURL = "",
  tls,
} = {}) {
  publicURL = normalizePublicURL(publicURL);
  if (tls && (!tls.cert || !tls.key))
    throw Error("HTTPS needs both a TLS certificate and private key.");
  const rooms = new Map();
  const handler = async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, protocol: PROTOCOL }));
      return;
    }
    if (req.url?.split("?")[0] !== "/") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const html = await readFile(htmlPath);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": "no-store",
      });
      res.end(html);
    } catch {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Build the game first: npm run build:standalone");
    }
  };
  const http = tls ? createSecureServer(tls, handler) : createServer(handler);
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024 * 1024,
    perMessageDeflate: false,
  });
  http.on("upgrade", (req, socket, head) => {
    if (req.url !== "/relay" || wss.clients.size >= maxConnections) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  const send = (ws, data) => {
    if (ws?.readyState !== WebSocket.OPEN) return;
    // A slow client must not grow the relay's memory without bound.
    if (ws.bufferedAmount > 12 * 1024 * 1024) {
      ws.close(1013, "Connection too slow");
      return;
    }
    ws.send(JSON.stringify(data));
  };
  const roster = (room) =>
    [room.host, ...room.guests.values()].map((ws) => ({
      id: ws.id,
      name: ws.name,
      host: ws === room.host,
    }));
  function broadcast(room, data) {
    for (const ws of [room.host, ...room.guests.values()]) send(ws, data);
  }
  function leave(ws) {
    const room = ws.room;
    ws.room = null;
    if (!room) return;
    if (room.host === ws) {
      rooms.delete(room.id);
      for (const guest of room.guests.values()) {
        guest.room = null;
        send(guest, {
          type: "ended",
          reason:
            "The host closed the session. The world is saved on the host's device.",
        });
        guest.close(1000, "Host left");
      }
    } else {
      room.guests.delete(ws.id);
      send(room.host, { type: "peer-left", id: ws.id });
      broadcast(room, { type: "roster", players: roster(room) });
    }
  }
  wss.on("connection", (ws) => {
    ws.id = token(9);
    ws.alive = true;
    ws.window = Date.now();
    ws.messages = 0;
    ws.bytes = 0;
    const deadline = setTimeout(() => {
      if (!ws.room) ws.close(1008, "Join timeout");
    }, 10000);
    deadline.unref();
    ws.on("pong", () => (ws.alive = true));
    ws.on("message", (raw, isBinary) => {
      try {
        if (isBinary) throw Error("Text messages required");
        if (Date.now() - ws.window > 1000) {
          ws.window = Date.now();
          ws.messages = 0;
          ws.bytes = 0;
        }
        if (
          ++ws.messages > 80 ||
          (ws.bytes += raw.length) >
            (ws.room?.host === ws ? 16 * 1024 * 1024 : 96 * 1024)
        )
          throw Error("Message rate exceeded");
        const m = JSON.parse(raw.toString());
        if (
          !m ||
          typeof m !== "object" ||
          Array.isArray(m) ||
          typeof m.type !== "string"
        )
          throw Error("Invalid message");
        if (m.type === "ping") {
          send(ws, { type: "pong", at: Number(m.at) || 0, protocol: PROTOCOL });
          return;
        }
        if (!ws.room) {
          if (m.protocol !== PROTOCOL)
            throw Error("Game versions do not match");
          ws.name = text(m.name, 20) || "Player";
          if (m.type === "create") {
            const room = {
              id: token(6),
              key: token(24),
              host: ws,
              guests: new Map(),
            };
            rooms.set(room.id, room);
            ws.room = room;
            send(ws, {
              type: "created",
              room: room.id,
              key: room.key,
              id: ws.id,
              players: roster(room),
              publicURL,
            });
          } else if (m.type === "join") {
            const room = rooms.get(m.room);
            if (!room || !sameKey(m.key, room.key))
              throw Error("Invitation is invalid or the host is offline");
            if (room.guests.size >= MAX_PLAYERS - 1)
              throw Error("This world is full (8 players)");
            ws.room = room;
            room.guests.set(ws.id, ws);
            send(ws, {
              type: "joined",
              id: ws.id,
              room: room.id,
              players: roster(room),
            });
            send(room.host, {
              type: "peer-join",
              id: ws.id,
              name: ws.name,
              resume: typeof m.resume === "string" ? m.resume.slice(0, 64) : "",
            });
            broadcast(room, { type: "roster", players: roster(room) });
          } else throw Error("Create or join a room first");
          clearTimeout(deadline);
          return;
        }
        const room = ws.room,
          host = room.host === ws;
        if (m.type === "chat") {
          const message = text(m.message, 160);
          if (message.startsWith("/")) {
            send(ws, {
              type: "chat",
              name: "World",
              message:
                "Commands can only be run by the world owner in the game chat.",
            });
            return;
          }
          if (Date.now() - (ws.chatAt || 0) < 500) {
            send(ws, {
              type: "chat",
              name: "World",
              message: "Please wait a moment between chat messages.",
            });
            return;
          }
          ws.chatAt = Date.now();
          if (message)
            broadcast(room, {
              type: "chat",
              id: ws.id,
              name: ws.name,
              message,
            });
          return;
        }
        if (host) {
          if (m.type === "announcement") {
            const message = text(m.message, 160);
            if (message)
              broadcast(room, { type: "chat", name: "World", message });
          } else if (m.type === "private-state")
            send(room.guests.get(m.to), {
              type: "private-state",
              state: m.state,
            });
          else if (m.type === "welcome" && typeof m.to === "string")
            send(room.guests.get(m.to), { type: "welcome", world: m.world });
          else if (m.type === "state") {
            for (const guest of room.guests.values())
              send(guest, { type: "state", state: m.state });
          } else if (m.type === "poses") {
            for (const guest of room.guests.values())
              send(guest, { type: "poses", players: m.players });
          } else if (m.type === "ack")
            send(room.guests.get(m.to), {
              type: "ack",
              seq: m.seq,
              ok: !!m.ok,
              message: text(m.message, 160),
              cooldowns: m.cooldowns,
            });
          else if (m.type === "kick") {
            const guest = room.guests.get(m.id);
            if (guest) {
              send(guest, {
                type: "ended",
                reason: "The host removed you from the session.",
              });
              guest.close(1000, "Removed by host");
            }
          } else throw Error("Unsupported host message");
        } else if (m.type === "input") {
          if (
            !m.input ||
            typeof m.input !== "object" ||
            JSON.stringify(m.input).length > 2048
          )
            throw Error("Invalid input");
          send(room.host, { type: "input", id: ws.id, input: m.input });
        } else if (m.type === "pose") {
          if (
            !m.pose ||
            typeof m.pose !== "object" ||
            JSON.stringify(m.pose).length > 2048
          )
            throw Error("Invalid pose");
          send(room.host, { type: "pose", id: ws.id, pose: m.pose });
        } else if (m.type === "command") {
          if (
            !Number.isSafeInteger(m.seq) ||
            m.seq < 0 ||
            ![
              "break",
              "use",
              "attack",
              "pulse",
              "release-use",
              "seeker",
              "pistol",
              "inventory",
              "menu",
              "close",
              "drop",
              "respawn",
              "stand",
            ].includes(m.kind) ||
            (m.payload != null &&
              (typeof m.payload !== "object" ||
                Array.isArray(m.payload) ||
                JSON.stringify(m.payload).length > 2048)) ||
            (m.held != null &&
              (typeof m.held !== "string" || m.held.length > 40))
          )
            throw Error("Invalid command");
          send(room.host, {
            type: "command",
            id: ws.id,
            seq: m.seq,
            kind: m.kind,
            held: m.held,
            selected: m.selected,
            payload: m.payload,
          });
        } else throw Error("Guests cannot change shared state directly");
      } catch (e) {
        send(ws, { type: "error", message: e.message });
        ws.close(1008, "Invalid request");
      }
    });
    ws.on("close", () => {
      clearTimeout(deadline);
      leave(ws);
    });
    ws.on("error", () => {});
  });
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, 30000);
  heartbeat.unref();
  http.on("close", () => clearInterval(heartbeat));
  return {
    http,
    wss,
    rooms,
    setPublicURL(value) {
      publicURL = normalizePublicURL(value);
      for (const room of rooms.values())
        send(room.host, { type: "public-address", publicURL });
    },
    listen: (port = 8787, host = "0.0.0.0") =>
      new Promise((resolve, reject) => {
        const fail = (error) => reject(error);
        http.once("error", fail);
        http.listen(port, host, () => {
          http.off("error", fail);
          resolve(http.address());
        });
      }),
    close: async () => {
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      await new Promise((resolve) => wss.close(resolve));
      if (http.listening) await new Promise((resolve) => http.close(resolve));
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const certPath = process.env.TLS_CERT_FILE,
    keyPath = process.env.TLS_KEY_FILE;
  if (!!certPath !== !!keyPath)
    throw Error("Set both TLS_CERT_FILE and TLS_KEY_FILE for HTTPS.");
  const tls = certPath
    ? { cert: await readFile(certPath), key: await readFile(keyPath) }
    : undefined;
  const relay = createRelay({
    htmlPath: resolve(
      process.env.DCSMCRAFT_HTML || "dist/DCSMCRAFT-Standalone.html",
    ),
    publicURL: process.env.PUBLIC_URL || "",
    tls,
  });
  const address = await relay.listen(
    Number(process.env.PORT) || 8787,
    process.env.HOST || "0.0.0.0",
  );
  console.log(
    `DCSMCRAFT Survival & Creative relay · ${tls ? "https" : "http"}://localhost:${address.port}`,
  );
  for (const group of Object.values(networkInterfaces()))
    for (const n of group || [])
      if (n.family === "IPv4" && !n.internal)
        console.log(
          `LAN: ${tls ? "https" : "http"}://${n.address}:${address.port} (${tls ? "certificate must cover this address" : "use this address in LAN invitations"})`,
        );
  console.log(
    "Keep this process and the host game open. For internet invitations, use a public HTTPS/WSS reverse proxy or a port-forwarded server; never expose your development server.",
  );
  if (process.env.PUBLIC_URL)
    console.log(`Internet invitations: ${process.env.PUBLIC_URL}`);
  const stop = async () => {
    await relay.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
