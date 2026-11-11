// An explicit, optional public hosting process; never runs from the offline game.
import { spawn } from "node:child_process";
import { writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRelay } from "./relay.mjs";
import { checkAddress } from "./check-address.mjs";

export function tunnelAddress(text) {
  const match = String(text).match(
    /https:\/\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.trycloudflare\.com(?=[\s/|]|$)/i,
  );
  return match ? `https://${match[1].toLowerCase()}.trycloudflare.com` : null;
}
export async function waitForPublicRelay(
  url,
  { probe = checkAddress, signal, timeout = 45000 } = {},
) {
  const controller = new AbortController(),
    deadline = setTimeout(
      () =>
        controller.abort(
          Error(
            "Public HTTPS/WSS relay did not become reachable. Check your internet connection and cloudflared output.",
          ),
        ),
      timeout,
    );
  const combined = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  try {
    while (true) {
      combined.throwIfAborted();
      try {
        await probe(url, { signal: combined });
        return;
      } catch (error) {
        if (combined.aborted) throw combined.reason;
      }
      await new Promise((resolve) => {
        const timer = setTimeout(done, 1000);
        function done() {
          clearTimeout(timer);
          combined.removeEventListener("abort", done);
          resolve();
        }
        combined.addEventListener("abort", done, { once: true });
      });
    }
  } finally {
    clearTimeout(deadline);
  }
}
export async function startPublicRelay({
  htmlPath = resolve("dist/DCSMCRAFT-Standalone.html"),
  executable = process.env.CLOUDFLARED_PATH || "cloudflared",
  protocol = "http2",
  signal,
  log = console.log,
  outputPath = resolve("PUBLIC-RELAY.txt"),
  spawnTunnel = spawn,
  probe = checkAddress,
  addressTimeout = 90000,
  readyTimeout = 45000,
} = {}) {
  if (!["http2", "quic", "auto"].includes(protocol))
    throw Error("Tunnel protocol must be http2, quic or auto.");
  await access(htmlPath);
  const relay = createRelay({ htmlPath }),
    controller = new AbortController();
  const combined = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  let child,
    closed = false,
    stopPromise;
  const close = () => {
    if (stopPromise) return stopPromise;
    closed = true;
    stopPromise = Promise.resolve().then(() => {
      controller.abort(Error("Public hosting stopped."));
      child?.kill();
      return relay.close();
    });
    return stopPromise;
  };
  try {
    combined.throwIfAborted();
    const { port } = await relay.listen(0, "127.0.0.1"),
      localURL = `http://127.0.0.1:${port}`;
    combined.throwIfAborted();
    log(
      "Starting temporary public hosting. Keep this window and the owner game open.",
    );
    child = spawnTunnel(
      executable,
      ["--no-autoupdate", "tunnel", "--url", localURL, "--protocol", protocol],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    const abort = () => {
      close().catch(() => {});
    };
    combined.addEventListener("abort", abort, { once: true });
    const url = await new Promise((resolve, reject) => {
      let done = false,
        tail = "";
      const timer = setTimeout(
        () =>
          finish(
            Error(
              "cloudflared did not return a public address. Check its connection/configuration, or use a permanent HTTPS relay.",
            ),
          ),
        addressTimeout,
      );
      const finish = (error, url) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        combined.removeEventListener("abort", cancel);
        error ? reject(error) : resolve(url);
      };
      const cancel = () =>
        finish(combined.reason || Error("Public hosting cancelled."));
      combined.addEventListener("abort", cancel, { once: true });
      const output = (data) => {
        tail = (tail + data.toString()).slice(-8192);
        const url = tunnelAddress(tail);
        if (url) finish(null, url);
      };
      child.stdout?.on("data", output);
      child.stderr?.on("data", output);
      child.once("error", (error) =>
        finish(
          Error(
            error.code === "ENOENT"
              ? "cloudflared is not installed. On Windows run: winget install --id Cloudflare.cloudflared -e. Then reopen HOST-PUBLIC.cmd. Official download: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
              : `cloudflared could not start: ${error.message}`,
          ),
        ),
      );
      child.once("exit", (code) => {
        finish(
          Error(`cloudflared stopped (code ${code}). ${tail.slice(-1200)}`),
        );
        if (!closed) {
          log("Public tunnel ended. The relay session is closing.");
          close().catch(() => {});
        }
      });
    });
    relay.setPublicURL(url);
    log("Public address received; checking HTTPS and secure WebSockets…");
    await waitForPublicRelay(url, {
      probe,
      signal: combined,
      timeout: readyTimeout,
    });
    combined.throwIfAborted();
    log(`PUBLIC HTTPS RELAY READY: ${url}`);
    log(
      "Open your game → Multiplayer → Public HTTPS → paste this address → Open This World to Friends → Copy Invitation.",
    );
    log(
      "Friends use the invitation on any network. This temporary address lasts only while this process stays open.",
    );
    try {
      await writeFile(
        outputPath,
        `${url}\n\nPublic HTTPS/WSS relay. Open your existing game and enter this address in Multiplayer > Public HTTPS. Host a world, then share its invitation. Keep this window open. Stopping/restarting changes this temporary address. The host browser owns the world save.\n`,
      );
    } catch {
      log(
        "Could not write PUBLIC-RELAY.txt; copy the address from this window.",
      );
    }
    return { url, relay, child, close };
  } catch (error) {
    await close();
    throw error;
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const controller = new AbortController();
  let session;
  const stop = () => {
    controller.abort(Error("Public hosting stopped."));
    session?.close().catch(() => {});
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    session = await startPublicRelay({
      htmlPath: resolve(
        process.env.DCSMCRAFT_HTML || "dist/DCSMCRAFT-Standalone.html",
      ),
      signal: controller.signal,
    });
    if (process.argv.includes("--open")) {
      const [command, args] =
        process.platform === "win32"
          ? ["rundll32", ["url.dll,FileProtocolHandler", session.url]]
          : process.platform === "darwin"
            ? ["open", [session.url]]
            : ["xdg-open", [session.url]];
      const opener = spawn(command, args, {
        stdio: "ignore",
        windowsHide: true,
      });
      opener.on("error", () =>
        console.log("Open the printed HTTPS address in your browser."),
      );
    }
  } catch (error) {
    console.error(error.message);
    if (!controller.signal.aborted) process.exitCode = 1;
  }
}
