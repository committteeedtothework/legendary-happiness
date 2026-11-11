import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { createHash } from "node:crypto";
import { B } from "../../src/data.js";
const out = process.env.DCSMCRAFT_MOBILE_ARTIFACTS || "test-results/mobile";
mkdirSync(out, { recursive: true });
const base = resolve("dist/mobile");
let server,
  origin,
  corrupt = false;
const manifest = JSON.parse(readFileSync(base + "/offline-manifest.json"));
const broken = manifest.files.find((f) => f.url.endsWith(".mp3")).url;
test.beforeAll(async () => {
  server = createServer((q, r) => {
    try {
      const path = decodeURIComponent(
        new URL(q.url, "http://localhost").pathname,
      );
      let file =
        path === "/desktop.html"
          ? resolve("dist/DCSMCRAFT-Standalone.html")
          : resolve(base, path.replace(/^\/mobile\/?/, "") || "index.html");
      if (
        !file.startsWith(base) &&
        !file.endsWith("DCSMCRAFT-Standalone.html")
      ) {
        r.writeHead(403);
        r.end();
        return;
      }
      if (path === "/mobile/" || path === "/mobile")
        file = base + "/index.html";
      let body = readFileSync(file);
      if (corrupt && path.endsWith(broken.slice(2)))
        body = Buffer.from("interrupted");
      const types = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".mp3": "audio/mpeg",
        ".glb": "model/gltf-binary",
      };
      r.setHeader("Content-Type", types[extname(file)] || "text/plain");
      r.setHeader("Cache-Control", "no-cache");
      if (q.headers.range) {
        const m = /bytes=(\d+)-(\d*)/.exec(q.headers.range);
        if (m) {
          const start = +m[1],
            end = m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
          r.statusCode = 206;
          r.setHeader("Content-Range", `bytes ${start}-${end}/${body.length}`);
          body = body.subarray(start, end + 1);
        }
      }
      r.setHeader("Content-Length", body.length);
      r.end(body);
    } catch {
      r.writeHead(404);
      r.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  await new Promise((r) => server.close(r));
});
async function boot(page) {
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(origin + "/mobile/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, requests };
}
async function world(page) {
  await page.locator('[data-action="create"]').tap();
  await page.locator('[name="seed"]').fill("Mobile input field");
  await page.locator('[data-action="start-world"]').tap();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    for (let x = -7; x < 8; x++)
      for (let z = -9; z < 10; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 204; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      health: 20,
      food: 20,
    });
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = {
      id: "diamond_pickaxe",
      count: 1,
      durability: 1561,
    };
    g.inventory.slots[1] = { id: "stone", count: 8 };
    g.inventory.selected = 0;
    g.ui.updateHotbar();
    g.resume();
  }, B);
  await expect(page.locator("#touch-controls")).toBeVisible();
}
const sessions = new WeakMap();
async function fingers(page, type, points) {
  if (!sessions.has(page))
    sessions.set(page, await page.context().newCDPSession(page));
  const c = sessions.get(page);
  await c.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map(([id, x, y]) => ({
      id,
      x,
      y,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    })),
  });
}
async function hold(page, selector, ms) {
  const b = await page.locator(selector).boundingBox();
  await fingers(page, "touchStart", [
    [1, b.x + b.width / 2, b.y + b.height / 2],
  ]);
  await page.waitForTimeout(ms);
  await fingers(page, "touchEnd", []);
}

test.describe("mobile", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
  });
  test("touch movement/look, mining/placing, inventory transfers and save reload work without pointer lock", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const ev = await boot(page);
    expect(ev.requests.some((u) => u.endsWith(".glb"))).toBe(false);
    await world(page);
    const start = await page.evaluate(() => ({
      x: dcsmcraft.player.x,
      z: dcsmcraft.player.z,
      yaw: dcsmcraft.player.yaw,
    }));
    const b = await page.locator("#touch-joystick").boundingBox(),
      x = b.x + b.width / 2,
      y = b.y + b.height / 2;
    await fingers(page, "touchStart", [
      [1, x, y],
      [2, 400, 130],
    ]);
    await fingers(page, "touchMove", [
      [1, x, y - 38],
      [2, 450, 140],
    ]);
    await page.waitForTimeout(500);
    const moved = await page.evaluate(() => ({
      x: dcsmcraft.player.x,
      z: dcsmcraft.player.z,
      yaw: dcsmcraft.player.yaw,
    }));
    expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(
      0.2,
    );
    expect(Math.abs(moved.yaw - start.yaw)).toBeGreaterThan(0.05);
    await fingers(page, "touchCancel", []);
    expect(await page.evaluate(() => dcsmcraft.touch.keys.size)).toBe(0);
    await page.evaluate((B) => {
      const g = dcsmcraft;
      Object.assign(g.player, {
        x: 0.5,
        y: 200,
        z: 0.5,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.world.set(0, 201, -3, B.stone);
      g.world.set(0, 201, -4, B.bedrock);
    }, B);
    await hold(page, '[data-touch="attack"]', 1200);
    await expect
      .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 201, -3)))
      .toBe(B.air);
    await page.locator(".hotbar-slot").nth(1).tap();
    await page.locator('[data-touch="use"]').tap();
    await expect
      .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 201, -3)))
      .toBe(B.stone);
    expect(await page.evaluate(() => dcsmcraft.inventory.slots[1].count)).toBe(
      7,
    );
    await page.locator('[data-touch="inventory"]').tap();
    await expect(page.locator(".inventory-window")).toBeVisible();
    await page.locator('[data-ref="inventory"][data-index="1"]').tap();
    await page.locator('[data-touch="split"]').tap();
    await page.locator('[data-ref="inventory"][data-index="2"]').tap();
    const inv = await page.evaluate(() => ({
      cursor: dcsmcraft.inventory.cursor?.count,
      placed: dcsmcraft.inventory.slots[2]?.count,
    }));
    expect(inv).toEqual({ cursor: 6, placed: 1 });
    await page.locator('[data-touch="stack"]').tap();
    await page.locator('[data-ref="inventory"][data-index="1"]').tap();
    await page.locator('[data-touch="transfer"]').tap();
    await page.locator('[data-ref="inventory"][data-index="2"]').tap();
    expect(
      await page.evaluate(() =>
        dcsmcraft.inventory.slots
          .filter((s) => s?.id === "stone")
          .reduce((n, s) => n + s.count, 0),
      ),
    ).toBe(7);
    await page.screenshot({ path: out + "/touch-inventory.png" });
    await page.locator('[data-touch="close"]').tap();
    await page.locator('[data-touch="pause"]').tap();
    expect(
      await page.evaluate(
        () => dcsmcraft.mouseDown || dcsmcraft.touch.keys.size > 0,
      ),
    ).toBe(false);
    const id = await page.evaluate(async () => {
      dcsmcraft.player.xp = 42;
      await dcsmcraft.save();
      return dcsmcraft.id;
    });
    await page.reload();
    await page.waitForFunction(() => dcsmcraft?.initialized);
    await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
    expect(await page.evaluate(() => dcsmcraft.player.xp)).toBe(42);
    expect(await page.evaluate(() => dcsmcraft.world.get(0, 201, -3))).toBe(
      B.stone,
    );
    await page.screenshot({ path: out + "/touch-world.png" });
    expect(ev.errors).toEqual([]);
    writeFileSync(
      out + "/touch-world-report.json",
      JSON.stringify(
        { build: manifest.id, moved, inv, errors: ev.errors },
        null,
        2,
      ),
    );
  });

  test("mobile offline install validates interrupted downloads, reloads an existing world offline and serves cached audio byte ranges", async ({
    page,
    context,
  }) => {
    test.setTimeout(180000);
    const ev = await boot(page);
    await world(page);
    const id = await page.evaluate(async () => {
      dcsmcraft.player.xp = 27;
      await dcsmcraft.save();
      return dcsmcraft.id;
    });
    await page.evaluate(() => dcsmcraft.mobileApp.panel());
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    corrupt = true;
    await page.locator('[data-mobile="download"]').tap();
    await expect(page.locator("#mobile-offline-status")).toContainText(
      "Could not finish",
      { timeout: 45000 },
    );
    corrupt = false;
    await page.locator('[data-mobile="download"]').tap();
    await expect(page.locator("#mobile-offline-status")).toHaveText(
      "Offline ready",
      { timeout: 90000 },
    );
    const count = await page.evaluate(async () => {
      const m = await dcsmcraft.mobileApp.manifest;
      return (await (await caches.open(m.cache)).keys()).length;
    });
    expect(count).toBeGreaterThanOrEqual(manifest.files.length);
    await page.screenshot({ path: out + "/offline-ready.png" });
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => dcsmcraft?.initialized);
    await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
    expect(await page.evaluate(() => dcsmcraft.player.xp)).toBe(27);
    const range = await page.evaluate(async () => {
      const m = await dcsmcraft.mobileApp.manifest;
      const file = m.files.find((f) => f.url.endsWith(".mp3"));
      const r = await fetch(file.url, { headers: { Range: "bytes=10-31" } });
      return {
        status: r.status,
        length: (await r.arrayBuffer()).byteLength,
        contentRange: r.headers.get("content-range"),
      };
    });
    expect(range.status).toBe(206);
    expect(range.length).toBe(22);
    expect(range.contentRange).toMatch(/^bytes 10-31\//);
    await context.setOffline(false);
    expect(ev.errors).toEqual([]);
    writeFileSync(
      out + "/offline-report.json",
      JSON.stringify(
        { build: manifest.id, count, range, errors: ev.errors },
        null,
        2,
      ),
    );
  });
  test("portrait menus fit and arena touch controls reach movement, parry, attacks, specials, pause and return", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const ev = await boot(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await world(page);
    await page.locator('[data-touch="inventory"]').tap();
    await expect(page.locator(".inventory-window")).toBeVisible();
    await page.screenshot({ path: out + "/touch-portrait.png" });
    const overflow = await page.evaluate(() => {
      const r = document
        .querySelector(".inventory-window")
        .getBoundingClientRect();
      return { left: r.left, right: r.right, width: innerWidth };
    });
    expect(overflow.left).toBeGreaterThanOrEqual(0);
    expect(overflow.right).toBeLessThanOrEqual(overflow.width + 1);
    await page.locator('[data-touch="close"]').tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => {
      const g = dcsmcraft;
      for (let x = 0; x <= 10; x++)
        for (let z = 0; z <= 10; z++) {
          g.world.set(x, 199, z, 3);
          for (let y = 200; y < 206; y++) g.world.set(x, y, z, 0);
        }
      Object.assign(g.player, {
        x: 4.5,
        y: 200,
        z: 7,
        yaw: 0,
        pitch: 0,
        onGround: true,
        health: 17,
      });
      g.giganto.record.config.spawnChance = 0;
      g.giganto.record.portal = {
        id: "touch-titan",
        cell: "0,0",
        x: 4,
        y: 200,
        z: 4,
      };
      g.giganto.overworld(0.01);
      g.resume();
    });
    await page.locator('[data-touch="use"]').tap();
    await page.waitForFunction(
      () =>
        dcsmcraft.giganto.active &&
        !dcsmcraft.giganto.pending &&
        dcsmcraft.giganto.view?.assetsReady,
    );
    await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session;
      Object.assign(s, {
        stage: "combat",
        stageTime: 10,
        time: 10,
        emerald: true,
        lock: false,
      });
      Object.assign(s.config, {
        graphicsQuality: "low",
        shadowQuality: "off",
        postProcessing: false,
        music: false,
        audio: false,
      });
      Object.assign(s.avatar, { x: 0, y: 25, z: 35, onGround: false });
      window.touchActions = [];
      const original = e.input.bind(e);
      e.input = (a) => {
        touchActions.push(a);
        return original(a);
      };
      g.resume();
    });
    await expect(page.locator('[data-touch="boost"]')).toBeVisible();
    await hold(page, '[data-touch="use"]', 200);
    await page.locator('[data-touch="attack"]').tap();
    await page.locator('[data-touch="dodge"]').tap();
    await hold(page, '[data-touch="boost"]', 250);
    await page.locator('[data-touch="actions"]').tap();
    await page.locator('[data-touch="boom"]').tap();
    const actions = await page.evaluate(() => touchActions);
    expect(actions).toContain("hit");
    expect(actions).toContain("dodge");
    expect(actions).toContain("boom");
    await page.locator('[data-touch="inventory"]').tap();
    await expect(page.locator("#titan-help")).toBeVisible();
    expect(await page.locator("#titan-help").innerText()).not.toMatch(
      /WASD|LMB|RMB|SPACE|SHIFT/,
    );
    await page.locator('[data-touch="inventory"]').tap();
    await page.screenshot({ path: out + "/touch-arena.png" });
    await page.locator('[data-touch="pause"]').tap();
    expect(await page.evaluate(() => dcsmcraft.running)).toBe(false);
    expect(await page.evaluate(() => dcsmcraft.touch.keys.size)).toBe(0);
    const originalHealth = await page.evaluate(
      () => dcsmcraft.giganto.session.original.player.health,
    );
    await page.evaluate(() => dcsmcraft.giganto.exit());
    await page.waitForFunction(() => !dcsmcraft.giganto.active);
    expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(
      originalHealth,
    );
    expect(ev.errors).toEqual([]);
  });
});

test("controller prompts cover weapon HUDs, inventory, guides and arena/QTE across families and custom mapping, and restore keyboard text", async ({
  page,
}) => {
  test.setTimeout(120000);
  const ev = await boot(page);
  await page.evaluate(() => {
    dcsmcraft.ui.guide();
  });
  const results = [];
  for (const family of ["xbox", "playstation", "switch"]) {
    const q = await page.evaluate((family) => {
      const g = dcsmcraft;
      g.controller.lastDevice = "controller";
      g.controller.family = family;
      g.prompts.dirty = true;
      g.prompts.frame();
      return g.ui.overlay.querySelector(".controls-list").textContent;
    }, family);
    expect(q).not.toMatch(
      /LEFT CLICK|RIGHT CLICK|W A S D|SPACE|SHIFT|CTRL|ESC/,
    );
    expect(q).toContain(
      family === "xbox" ? "RT" : family === "playstation" ? "R2" : "ZR",
    );
    results.push({ family, guide: q });
  }
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.controller.lastDevice = "keyboard";
    g.prompts.frame();
  });
  await expect(page.locator(".controls-list")).toContainText("LEFT CLICK");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.controller.lastDevice = "controller";
    g.controller.family = "playstation";
    g.ui.toast("Hold left-click for 30 seconds. Press R for Seeker.");
    g.prompts.dirty = true;
    g.prompts.frame();
  });
  await expect(page.locator("#toast")).toContainText("R2");
  await expect(page.locator("#toast")).toContainText("↑");
  expect(ev.errors).toEqual([]);
  writeFileSync(
    out + "/controller-prompts.json",
    JSON.stringify({ build: manifest.id, results, errors: ev.errors }, null, 2),
  );
});

test.describe("Pocket controls", () => {
  test.use({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,
    userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1"});
  test("Pocket layouts support sprint, toggle sneak, held-button aiming, custom moves, settings and rotation", async ({page}) => {
    test.setTimeout(180000);
    const ev=await boot(page); await world(page);
    expect(await page.evaluate(()=>dcsmcraft.touch.pocketReady)).toBe(true);
    await page.waitForTimeout(100);
    let box=await page.locator("#touch-joystick").boundingBox();
    let x=box.x+box.width/2,y=box.y+box.height/2;
    await fingers(page,"touchStart",[[1,x,y]]);
    await fingers(page,"touchMove",[[1,x,y-65]]);
    await expect.poll(()=>page.evaluate(()=>dcsmcraft.touch.keys.has("ControlLeft"))).toBe(true);
    await fingers(page,"touchMove",[[1,x,y-25]]);
    await expect.poll(()=>page.evaluate(()=>dcsmcraft.touch.keys.has("ControlLeft"))).toBe(false);
    await fingers(page,"touchCancel",[]);
    await page.locator('[data-touch="down"]').tap();
    await expect.poll(()=>page.evaluate(()=>dcsmcraft.touch.keys.has("ShiftLeft"))).toBe(true);
    await page.locator('[data-touch="down"]').tap();
    await expect.poll(()=>page.evaluate(()=>dcsmcraft.touch.keys.has("ShiftLeft"))).toBe(false);
    const attack=await page.locator('[data-touch="attack"]').boundingBox();
    const ax=attack.x+attack.width/2,ay=attack.y+attack.height/2;
    const yaw=await page.evaluate(()=>dcsmcraft.player.yaw);
    await fingers(page,"touchStart",[[2,ax,ay]]);
    await fingers(page,"touchMove",[[2,ax+32,ay+5]]);
    expect(Math.abs(await page.evaluate(()=>dcsmcraft.player.yaw)-yaw)).toBeGreaterThan(0.04);
    await fingers(page,"touchCancel",[]);
    expect(await page.evaluate(()=>dcsmcraft.mouseDown)).toBe(false);
    await page.evaluate(()=>{
      dcsmcraft.inventory.slots[0]={id:"matthew_dual_pistols",count:1};
      dcsmcraft.inventory.selected=0;dcsmcraft.ui.updateHotbar();
    });
    await expect(page.locator('.pocket-utility [data-touch="weapon"]')).toHaveText("Air Trick");
    await page.evaluate(()=>dcsmcraft.ui.toast("Air Trick ready.",4000));
    const toast=await page.locator("#toast").boundingBox();
    expect(toast.height).toBeLessThan(120);
    await page.locator('[data-touch="actions"]').tap();
    await expect(page.locator('#touch-tray [data-touch="weapon"]')).toHaveText("Air Trick");
    expect(await page.evaluate(()=>dcsmcraft.running)).toBe(true);
    await page.locator('[data-touch="actions"]').tap();
    await page.screenshot({path:out+"/pocket-landscape.png"});
    await page.locator('[data-touch="pause"]').tap();
    await page.evaluate(()=>dcsmcraft.touch.settings());
    await page.locator('[data-pocket-setting="layout"]').selectOption("dpad");
    await page.locator('[data-pocket-setting="leftHanded"]').check();
    await page.locator('[data-pocket-setting="size"]').evaluate(n => {
      n.value="1.15"; n.dispatchEvent(new Event("change",{bubbles:true}));
    });
    await page.evaluate(()=>dcsmcraft.resume());
    await expect(page.locator("#touch-dpad")).toBeVisible();
    await expect(page.locator("#touch-joystick")).toBeHidden();
    box=await page.locator("#touch-dpad").boundingBox();
    expect(box.x).toBeGreaterThan(500);
    x=box.x+box.width/2;y=box.y+box.height/2;
    const start=await page.evaluate(()=>({x:dcsmcraft.player.x,z:dcsmcraft.player.z}));
    await fingers(page,"touchStart",[[3,x,y-45]]);
    await page.waitForTimeout(350);
    expect(await page.evaluate(()=>dcsmcraft.touch.move.y)).toBe(-1);
    const end=await page.evaluate(()=>({x:dcsmcraft.player.x,z:dcsmcraft.player.z}));
    expect(Math.hypot(end.x-start.x,end.z-start.z)).toBeGreaterThan(0.1);
    await page.setViewportSize({width:390,height:844});
    await fingers(page,"touchCancel",[]);
    await expect.poll(()=>page.evaluate(()=>dcsmcraft.touch.keys.size)).toBe(0);
    await page.waitForTimeout(100);
    const bounds=await page.evaluate(()=>{
      const a=document.querySelector('[data-touch="inventory"]').getBoundingClientRect(),
        b=document.querySelector('.hotbar').getBoundingClientRect();
      return {left:a.left,right:a.right,bottom:a.bottom,barRight:b.right,w:innerWidth,h:innerHeight};
    });
    expect(bounds.left).toBeGreaterThanOrEqual(bounds.barRight);
    expect(bounds.right).toBeLessThanOrEqual(bounds.w);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.h);
    await page.screenshot({path:out+"/pocket-portrait-dpad.png"});
    await page.evaluate(async()=>{await dcsmcraft.save();window.savedPocketWorld=dcsmcraft.id;});
    const id=await page.evaluate(()=>dcsmcraft.id);
    await page.reload();await page.waitForFunction(()=>dcsmcraft?.initialized);
    await page.evaluate(id=>dcsmcraft.loadWorld(id),id);
    expect(await page.evaluate(()=>dcsmcraft.touch.config)).toMatchObject({layout:"dpad",leftHanded:true,size:1.15});
    expect(ev.errors).toEqual([]);
  });
});
