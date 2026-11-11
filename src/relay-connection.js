import { relayURL } from "./multiplayer.js";
import { PROTOCOL } from "../server/protocol.mjs";
const STORAGE = "dcsmcraft-relay-address";
export function relayAddressInfo(value) {
  const ws = relayURL(value),
    host = ws.hostname.toLowerCase().replace(/^\[|\]$/g, ""),
    parts = host.split(".").map(Number);
  const privateAddress =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "::" ||
    /^(fc|fd)[0-9a-f]{2}:/.test(host) ||
    host.startsWith("fe80:") ||
    host.startsWith("::ffff:") ||
    (parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (parts[0] === 0 ||
        parts[0] === 10 ||
        parts[0] === 127 ||
        (parts[0] === 169 && parts[1] === 254) ||
        (parts[0] === 192 && parts[1] === 168) ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)));
  const secure = ws.protocol === "wss:",
    web = new URL(ws);
  web.protocol = secure ? "https:" : "http:";
  web.pathname = "/";
  return {
    url: web.origin,
    websocket: ws.href,
    secure,
    privateAddress,
    publicHTTPS: secure && !privateAddress,
  };
}
export function validateRelayAccess(value, access = "local") {
  const info = relayAddressInfo(value);
  if (access === "public" && !info.publicHTTPS)
    throw Error(
      "Public hosting needs an HTTPS/WSS address reachable from the internet. Run HOST-PUBLIC.cmd and paste its https://…trycloudflare.com address, or use your permanent HTTPS relay.",
    );
  if (globalThis.location?.protocol === "https:" && !info.secure)
    throw Error("This HTTPS page needs a secure HTTPS/WSS relay address.");
  return info;
}
export function readSavedRelay() {
  try {
    const value = localStorage.getItem(STORAGE);
    return value ? relayAddressInfo(value).url : "";
  } catch {
    return "";
  }
}
export function saveRelay(value) {
  try {
    localStorage.setItem(STORAGE, relayAddressInfo(value).url);
  } catch {}
}
export function probeRelay(value, { timeout = 8000, access = "local" } = {}) {
  const info = validateRelayAccess(value, access);
  return new Promise((resolve, reject) => {
    let socket,
      done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket?.close();
      error ? reject(error) : resolve(info);
    };
    const timer = setTimeout(
      () =>
        finish(
          Error(
            "Relay timed out. Keep HOST-PUBLIC.cmd/server running and check its address.",
          ),
        ),
      timeout,
    );
    try {
      socket = new WebSocket(info.websocket);
    } catch (error) {
      finish(Error("The relay could not open: " + error.message));
      return;
    }
    socket.onopen = () =>
      socket.send(JSON.stringify({ type: "ping", at: Date.now() }));
    socket.onmessage = (event) => {
      try {
        const m = JSON.parse(event.data);
        if (m.type === "pong")
          finish(
            m.protocol === PROTOCOL
              ? null
              : Error(
                  `Game versions do not match. Use the matching protocol-${PROTOCOL} relay.`,
                ),
          );
        else if (m.type === "error") finish(Error(m.message));
      } catch {
        finish(Error("The relay sent an invalid response."));
      }
    };
    socket.onerror = () =>
      finish(
        Error(
          "Could not connect securely. Check the relay address, certificate and WebSocket proxy support.",
        ),
      );
    socket.onclose = () => finish(Error("The relay closed before answering."));
  });
}
