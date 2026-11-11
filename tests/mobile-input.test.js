import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { promptText, controlName, buttonName } from "../src/input-prompts.js";
import { controllerConfig } from "../src/controller-data.js";
import { touchConfig, touchVector, touchMovement } from "../src/touch-data.js";
import { assetArrayBuffer } from "../src/asset-source.js";
function game(family = "xbox", extra = {}) {
  return {
    settings: {
      controller: controllerConfig(),
      standKeys: {
        summon: "KeyH",
        primary: "KeyF",
        secondary: "KeyG",
        info: "KeyV",
      },
    },
    controller: { family, lastDevice: "controller", pad: { id: family } },
    giganto: { session: { stage: "combat" } },
    ...extra,
  };
}
test("controller world, inventory and arena prompts name the actual Xbox, PlayStation and Switch actions without re-translating face buttons", () => {
  for (const [family, mine, use, jump, inv, pause] of [
    ["xbox", "RT", "LT", "A", "Y", "Menu"],
    ["playstation", "R2", "L2", "×", "△", "Options"],
    ["switch", "ZR", "ZL", "B", "X", "+"],
  ]) {
    const g = game(family);
    const config = g.settings.controller;
    let reads = 0;
    Object.defineProperty(g.settings, "controller", {
      get() {
        reads++;
        return config;
      },
    });
    assert.equal(controlName(g, "jump"), jump);
    assert.ok(
      reads <= 2,
      "a prompt resolves its own binding rather than every other action",
    );
    assert.equal(
      promptText(
        g,
        "LMB Fire · RMB Dash · Space Jump · E Inventory · ESC Pause",
      ),
      `${mine} Fire · ${use} Dash · ${jump} Jump · ${inv} Inventory · ${pause} Pause`,
    );
    assert.equal(
      promptText(g, "E · Enter Titan portal"),
      `${use} · Enter Titan portal`,
    );
    assert.equal(
      promptText(g, "R Seeker · RMB Pulse"),
      `↑ Seeker · ${use} Pulse`,
    );
    assert.equal(
      promptText(g, "LEFT CLICK · PICK UP / PLACE", "inventory"),
      `${family === "switch" ? "A" : jump} · PICK UP / PLACE`,
    );
    assert.equal(
      promptText(g, "SHIFT + CLICK TO TRANSFER", "inventory"),
      inv + " TO TRANSFER",
    );
    assert.equal(
      promptText(g, "LMB Counter · RMB Parry · Q Dodge · TAB Lock", "arena"),
      `${family === "xbox" ? "X" : family === "playstation" ? "□" : "Y"} Counter · ${use} Parry · ${family === "xbox" ? "RB" : family === "playstation" ? "R1" : "R"} Dodge · ${family === "playstation" ? "R3" : "R Stick"} Lock`,
    );
  }
});
test("custom mappings, unavailable bindings, Stand actions and plain narrative/roman enchantment levels remain accurate", () => {
  const g = game("generic");
  g.controller.pad.id = "Sony DualSense";
  g.settings.controller = controllerConfig({
    preset: "custom",
    bindings: { mine: 0, use: 7, inventory: -1 },
  });
  assert.equal(buttonName(g, "mine"), "×");
  assert.equal(buttonName(g, "use"), "R2");
  assert.equal(controlName(g, "inventory"), "Unbound");
  assert.match(
    promptText(g, "H summons your Stand"),
    /Create → Stand · summon/,
  );
  assert.equal(
    promptText(g, "A runed blade · Protection V"),
    "A runed blade · Protection V",
  );
  g.settings.controller = controllerConfig({
    preset: "custom",
    bindings: { mine: -1 },
    rightTriggerAxis: 5,
  });
  assert.equal(buttonName(g, "mine"), "Axis 5");
  g.controller.lastDevice = "keyboard";
  assert.equal(promptText(g, "WASD · Space · LMB"), "WASD · Space · LMB");
});
test("touch prompts and joystick scaling cover independent rise/descend, hold actions and actual named buttons", () => {
  const g = game();
  g.controller.lastDevice = "touch";
  g.touch = { active: true, move: touchVector(104, -104) };
  assert.equal(
    promptText(g, "RMB Use · LMB Mine · E Inventory"),
    "Use Use · Mine Mine · Inventory Inventory",
  );
  assert.equal(controlName(g, "boom", "arena"), "Sonic Boom");
  assert.equal(controlName(g, "draw", "arena"), "Draw loop");
  assert.equal(touchMovement(g), g.touch.move);
  assert.ok(Math.abs(Math.hypot(g.touch.move.x, g.touch.move.y) - 1) < 1e-10);
  assert.deepEqual(touchVector(2, 1), { x: 0, y: 0 });
  assert.equal(
    touchConfig({ mode: "bad", sensitivity: 99, opacity: -1 }).sensitivity,
    0.008,
  );
});
test("asset decoding preserves embedded bytes and checks lazy network failures", async () => {
  assert.deepEqual(
    [...new Uint8Array(await assetArrayBuffer("AQID"))],
    [1, 2, 3],
  );
  assert.deepEqual(
    [
      ...new Uint8Array(
        await assetArrayBuffer({ src: "data:audio/mpeg;base64,BAUG" }),
      ),
    ],
    [4, 5, 6],
  );
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(new Uint8Array([7, 8]));
    assert.deepEqual(
      [...new Uint8Array(await assetArrayBuffer({ url: "./asset" }))],
      [7, 8],
    );
    globalThis.fetch = async () => new Response("missing", { status: 404 });
    await assert.rejects(assetArrayBuffer({ url: "./missing" }), /404/);
  } finally {
    globalThis.fetch = old;
  }
});
test("service worker handles Safari cached audio ranges, offline navigation and interrupted install recovery without touching world databases", async () => {
  const handlers = {},
    storage = new Map(),
    deleted = [];
  const cache = {
    async addAll() {},
    async match(key) {
      return storage.get(typeof key === "string" ? key : key.url)?.clone();
    },
    async put(key, response) {
      storage.set(typeof key === "string" ? key : key.url, response);
    },
    async keys() {
      return [...storage.keys()].map((url) => new Request(url));
    },
  };
  const scope = "https://game.example/mobile/",
    code = readFileSync(
      new URL("../scripts/mobile-service-worker.js", import.meta.url),
      "utf8",
    )
      .replace("__CACHE__", JSON.stringify("dcsmcraft-mobile-test"))
      .replace("__CORE__", JSON.stringify(["./index.html"]))
      .replace("__FILES__", JSON.stringify(["./index.html", "./song.mp3"]));
  vm.runInNewContext(code, {
    self: {
      registration: { scope },
      location: { origin: "https://game.example" },
      clients: { claim: async () => {} },
      addEventListener: (n, f) => {
        handlers[n] = f;
      },
      skipWaiting() {},
    },
    URL,
    Headers,
    Response,
    Request,
    Set,
    caches: {
      open: async () => cache,
      keys: async () => ["dcsmcraft-mobile-test"],
      delete: async (n) => deleted.push(n),
    },
    fetch: async () => {
      throw Error("Offline");
    },
  });
  await cache.put(
    scope + "song.mp3",
    new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), {
      headers: { "Content-Type": "audio/mpeg" },
    }),
  );
  await cache.put(scope + "index.html", new Response("game"));
  for (const [range, status, expected] of [
    ["bytes=2-4", 206, [2, 3, 4]],
    ["bytes=-3", 206, [5, 6, 7]],
    ["bytes=99-100", 416, []],
  ]) {
    let response;
    handlers.fetch({
      request: new Request(scope + "song.mp3", { headers: { range } }),
      respondWith: (p) => {
        response = p;
      },
    });
    response = await response;
    assert.equal(response.status, status);
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer())],
      expected,
    );
  }
  let intercepted = false;
  handlers.fetch({
    request: new Request("https://relay.example/"),
    respondWith: () => {
      intercepted = true;
    },
  });
  assert.equal(intercepted, false);
  let wait;
  cache.addAll = async () => {
    throw Error("network");
  };
  handlers.install({
    waitUntil: (p) => {
      wait = p;
    },
  });
  await assert.rejects(wait, /network/);
  assert.deepEqual(deleted, ["dcsmcraft-mobile-test"]);
  assert.doesNotMatch(code, /indexedDB\.deleteDatabase|localStorage\.clear/);
});
