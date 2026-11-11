import { PROTOCOL } from "../server/protocol.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { get } from "node:https";
import { WebSocket } from "ws";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { once } from "node:events";
import { createRelay } from "../server/relay.mjs";
import {
  startPublicRelay,
  tunnelAddress,
  waitForPublicRelay,
} from "../server/public-relay.mjs";
import { testCertificate } from "./helpers/tls-fixture.js";
import {
  probeRelay,
  relayAddressInfo,
  validateRelayAccess,
} from "../src/relay-connection.js";
const message = (ws) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Missing relay response")),
      3000,
    );
    ws.once("message", (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw));
    });
  });
test("public mode distinguishes encrypted public addresses from localhost, private ranges and insecure URLs", () => {
  for (const value of [
    "https://game.example.com",
    "wss://quiet-cube.trycloudflare.com/relay",
  ])
    assert.equal(validateRelayAccess(value, "public").publicHTTPS, true);
  for (const value of [
    "http://game.example.com",
    "ws://game.example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://10.2.3.4",
    "https://192.168.1.2",
    "https://172.31.0.1",
    "https://[::1]",
    "https://[fd00::1]",
    "https://host.local",
  ])
    assert.throws(() => validateRelayAccess(value, "public"));
  assert.equal(
    relayAddressInfo("wss://game.example.com/relay#secret").url,
    "https://game.example.com",
  );
  assert.throws(() => relayAddressInfo("https://user:password@example.com"));
});
test("quick-tunnel output accepts only actual trycloudflare origins, including chunk-assembled output", () => {
  assert.equal(
    tunnelAddress("Visit https://quiet-cube.trycloudflare.com |"),
    "https://quiet-cube.trycloudflare.com",
  );
  for (const text of [
    "https://evil.example.com",
    "https://safe.trycloudflare.com.evil.example",
    "https://-bad.trycloudflare.com",
    "https://user@safe.trycloudflare.com",
    "http://safe.trycloudflare.com",
  ])
    assert.equal(tunnelAddress(text), null);
});
test("native HTTPS serves the game and verifies actual TLS/WSS host, guest, chat and private routing", async (t) => {
  const cert = testCertificate();
  t.after(() => cert.close());
  const relay = createRelay({ tls: cert }),
    { port } = await relay.listen(0, "127.0.0.1");
  t.after(() => relay.close());
  const origin = `https://127.0.0.1:${port}`;
  relay.setPublicURL(origin);
  const health = await new Promise((resolve, reject) =>
    get(origin + "/health", { ca: cert.cert }, (res) => {
      let text = "";
      res.on("data", (d) => (text += d));
      res.on("end", () => resolve(JSON.parse(text)));
    }).on("error", reject),
  );
  assert.equal(health.protocol, PROTOCOL);
  const host = new WebSocket(origin.replace("https:", "wss:") + "/relay", {
      ca: cert.cert,
    }),
    guest = new WebSocket(origin.replace("https:", "wss:") + "/relay", {
      ca: cert.cert,
    });
  await Promise.all([once(host, "open"), once(guest, "open")]);
  let next = message(host);
  host.send(
    JSON.stringify({ type: "create", protocol: PROTOCOL, name: "Owner" }),
  );
  const room = await next;
  assert.equal(room.publicURL, origin);
  const joined = message(guest),
    peer = message(host);
  guest.send(
    JSON.stringify({
      type: "join",
      protocol: PROTOCOL,
      name: "Friend",
      room: room.room,
      key: room.key,
    }),
  );
  await joined;
  const member = await peer;
  // Drain the roster before checking subsequent messages.
  await new Promise((resolve) => setTimeout(resolve, 20));
  next = message(guest);
  host.send(
    JSON.stringify({
      type: "private-state",
      to: member.id,
      state: { inventory: { slots: [{ id: "log", count: 2 }] } },
    }),
  );
  assert.equal((await next).state.inventory.slots[0].count, 2);
  const chat = message(host);
  guest.send(JSON.stringify({ type: "chat", message: "Encrypted hello" }));
  assert.equal((await chat).message, "Encrypted hello");
  next = message(host);
  relay.setPublicURL("https://new-relay.example.com");
  assert.equal((await next).type, "public-address");
  assert.throws(() => createRelay({ tls: { cert: cert.cert } }), /both/);
});
test("public readiness retries failures, requires a successful probe and respects cancellation", async () => {
  let calls = 0;
  await waitForPublicRelay("https://relay.example.com", {
    probe: async () => {
      if (++calls < 2) throw Error("not ready");
    },
    timeout: 2000,
  });
  assert.equal(calls, 2);
  const controller = new AbortController();
  controller.abort(Error("cancelled"));
  await assert.rejects(
    waitForPublicRelay("https://relay.example.com", {
      signal: controller.signal,
      probe: () => assert.fail("probed after abort"),
    }),
    /cancelled/,
  );
  await assert.rejects(
    waitForPublicRelay("https://relay.example.com", {
      probe: async () => {
        throw Error("offline");
      },
      timeout: 20,
    }),
    /reachable/,
  );
});
async function tunnelFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "dcsmcraft-public-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const htmlPath = join(directory, "game.html"),
    script = join(directory, "provider.mjs");
  await writeFile(htmlPath, "<!doctype html><title>test game</title>");
  await writeFile(
    script,
    "process.stderr.write('https://quiet-');setTimeout(()=>process.stderr.write('cube.trycloudflare.com \\n'),10);setInterval(()=>{},1000);",
  );
  return { directory, htmlPath, script };
}
test("explicit public launcher advertises its tested address, writes instructions and cleans up a test provider", async (t) => {
  const f = await tunnelFixture(t),
    logs = [];
  let localURL;
  const session = await startPublicRelay({
    htmlPath: f.htmlPath,
    outputPath: join(f.directory, "PUBLIC-RELAY.txt"),
    log: (text) => logs.push(text),
    spawnTunnel: (_exe, args, options) => {
      localURL = args[args.indexOf("--url") + 1];
      assert.ok(args.includes("http2"));
      assert.equal(options.shell, undefined);
      return spawn(process.execPath, [f.script, ...args], options);
    },
    probe: async () => {
      const r = await fetch(localURL + "/health");
      assert.equal((await r.json()).protocol, PROTOCOL);
    },
  });
  t.after(() => session.close());
  assert.equal(session.url, "https://quiet-cube.trycloudflare.com");
  assert.equal(session.relay.http.address().address, "127.0.0.1");
  assert.match(
    await readFile(join(f.directory, "PUBLIC-RELAY.txt"), "utf8"),
    /quiet-cube/,
  );
  assert.ok(logs.some((s) => s.includes("READY")));
  const ws = new WebSocket(localURL.replace("http:", "ws:") + "/relay");
  await once(ws, "open");
  const next = message(ws);
  ws.send(
    JSON.stringify({ type: "create", protocol: PROTOCOL, name: "Owner" }),
  );
  assert.equal((await next).publicURL, session.url);
  await Promise.all([session.close(), session.close()]);
  assert.equal(session.relay.http.listening, false);
  assert.equal(session.child.killed, true);
});
test("missing tunnel utility fails with Windows installation help and closes the listener", async (t) => {
  const f = await tunnelFixture(t);
  await assert.rejects(
    startPublicRelay({
      htmlPath: f.htmlPath,
      executable: resolve(f.directory, "not-installed"),
      log() {},
      outputPath: join(f.directory, "output.txt"),
    }),
    /winget install/,
  );
});
test("launcher never marks an unreachable tunnel ready", async (t) => {
  const f = await tunnelFixture(t),
    logs = [];
  await assert.rejects(
    startPublicRelay({
      htmlPath: f.htmlPath,
      log: (text) => logs.push(text),
      outputPath: join(f.directory, "output.txt"),
      readyTimeout: 20,
      spawnTunnel: (_exe, args, options) =>
        spawn(process.execPath, [f.script, ...args], options),
      probe: async () => {
        throw Error("blocked");
      },
    }),
    /reachable/,
  );
  assert.equal(
    logs.some((s) => s.includes("READY")),
    false,
  );
});

test("browser relay probe accepts the same protocol as actual room creation", async (t) => {
  const relay = createRelay();
  const { port } = await relay.listen(0, "127.0.0.1");
  t.after(() => relay.close());
  const info = await probeRelay(`http://127.0.0.1:${port}`, { timeout: 3000 });
  assert.equal(info.url, `http://127.0.0.1:${port}`);
  assert.equal(PROTOCOL, 4);
});
