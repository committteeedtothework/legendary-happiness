// Checks HTTP and WebSocket reachability from the machine running this command.
import { WebSocket } from "ws";
import { PROTOCOL } from "./relay.mjs";
export async function checkAddress(address, { signal } = {}) {
  const url = new URL(address);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw Error("Use an HTTP(S) server address.");
  const response = await fetch(new URL("/health", url), {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
  });
  const health = await response.json();
  if (!response.ok || health.protocol !== PROTOCOL || !health.ok)
    throw Error("This address is not a compatible DCSMCRAFT relay.");
  const wsURL = new URL("/relay", url);
  wsURL.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason || Error("Connection check cancelled."));
      return;
    }
    const ws = new WebSocket(wsURL),
      timer = setTimeout(() => {
        finish(Error("WebSocket did not answer; check proxy upgrade support."));
      }, 8000);
    let done = false;
    const abort = () =>
      finish(signal.reason || Error("Connection check cancelled."));
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      ws.close();
      error ? reject(error) : resolve();
    };
    signal?.addEventListener("abort", abort, { once: true });
    ws.on("open", () =>
      ws.send(JSON.stringify({ type: "ping", at: Date.now() })),
    );
    ws.on("message", (raw) => {
      try {
        if (JSON.parse(raw).type === "pong") finish();
      } catch {
        finish(Error("Invalid relay response."));
      }
    });
    ws.on("error", finish);
    ws.on("close", () =>
      finish(Error("WebSocket closed before the relay answered.")),
    );
  });
  return `HTTP and WebSocket connected to ${url.origin}. Test from a friend's network too; this does not open routers or deploy a server.`;
}
if (process.argv[1]?.endsWith("check-address.mjs"))
  checkAddress(process.argv[2])
    .then(console.log)
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
