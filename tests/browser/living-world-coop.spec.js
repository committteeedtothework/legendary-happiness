import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";

test("real Survival co-op holds shared chest lids for both viewers, closes on removal and never duplicates contents", async ({
  browser,
}) => {
  test.setTimeout(150000);
  const relay = createRelay(),
    { port } = await relay.listen(0, "127.0.0.1"),
    origin = `http://127.0.0.1:${port}`,
    contexts = [],
    errors = [];
  try {
    const pages = [];
    for (let n = 0; n < 2; n++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() =>
        localStorage.setItem(
          "dcsmcraft-settings",
          JSON.stringify({
            graphics: 1,
            renderDistance: 2,
            distantTerrain: false,
            volume: 0,
            musicEnabled: false,
            frameLimit: 30,
          }),
        ),
      );
      await page.goto(origin);
      await page.waitForFunction(() => window.dcsmcraft?.initialized);
    }
    const [host, guest] = pages;
    await host.locator("[data-action=create]").click();
    await host.locator("[name=seed]").fill("Wildflower");
    await host.locator("[name=mode][value=survival]").check();
    await host.locator("[data-action=start-world]").click();
    await host.waitForFunction(() => dcsmcraft.active);
    await host.evaluate(() => dcsmcraft.pause());
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-role=host]").click();
    const invite = await host.locator("#session-invite").inputValue();
    await guest.locator("[data-action=multiplayer]").click();
    await guest.locator("#multiplayer-invite").fill(invite);
    await guest.locator("[data-role=guest]").click();
    await guest.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
    await host.evaluate((B) => {
      const g = dcsmcraft,
        peer = [...g.multiplayer.peers.values()][0];
      g.entities = [];
      g.drops = [];
      for (let x = -4; x <= 5; x++)
        for (let z = -2; z <= 6; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y < 204; y++) g.world.set(x, y, z, B.air);
        }
      g.world.set(0, 200, 0, B.chest);
      g.world.containers["0,200,0"] = {
        type: "chest",
        slots: [{ id: "diamond", count: 3 }, ...Array(26).fill(null)],
      };
      Object.assign(g.player, {
        x: 0.5,
        y: 200,
        z: 3,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        health: 20,
      });
      g.inventory.slots.fill(null);
      Object.assign(peer.player, {
        x: 2.5,
        y: 200,
        z: 3,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        health: 20,
      });
      peer.inventory.slots.fill(null);
      peer.teleport = true;
      g.multiplayer.sendPrivate(peer);
      g.renderer.loadAround(0.5, 3, 2, 25);
      g.resume();
      g.pointerLockFallback = true;
    }, B);
    await guest.waitForFunction(
      () => dcsmcraft.player.y > 199 && dcsmcraft.player.y < 201,
    );
    for (const page of pages) {
      await page.evaluate(() => {
        dcsmcraft.resume();
        dcsmcraft.pointerLockFallback = true;
      });
      await page.mouse.move(640, 400);
      await page.evaluate(() => {
        const p = dcsmcraft.player,
          dx = 0.5 - p.x,
          dz = 0.5 - p.z;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(200.45 - p.y - 1.62, Math.hypot(dx, dz));
      });
      await page.waitForTimeout(200);
    }
    async function open(page) {
      await page.evaluate(() => {
        dcsmcraft.resume();
        dcsmcraft.pointerLockFallback = true;
      });
      await page.mouse.move(640, 400);
      await page.evaluate(() => {
        const p = dcsmcraft.player,
          dx = 0.5 - p.x,
          dz = 0.5 - p.z;
        p.yaw = Math.atan2(-dx, -dz);
        p.pitch = Math.atan2(200.45 - p.y - 1.62, Math.hypot(dx, dz));
      });
      await page.waitForTimeout(250);
      await page.mouse.click(640, 400, { button: "right" });
      await page.waitForFunction(
        () =>
          dcsmcraft.ui.screen === "inventory" &&
          dcsmcraft.ui.invType === "chest",
        {},
        { timeout: 10000 },
      );
    }
    await open(host);
    await open(guest);
    for (const page of pages)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              dcsmcraft.renderer.worldAnimations.models.get("0,200,0")?.userData
                .openness,
          ),
        )
        .toBeGreaterThan(0.95);
    await host.locator("[data-action=close-inv]").click();
    await host.waitForTimeout(500);
    expect(
      await host.evaluate(
        () =>
          dcsmcraft.renderer.worldAnimations.models.get("0,200,0").userData
            .openness,
      ),
    ).toBeGreaterThan(0.95);
    await guest.locator("[data-action=close-inv]").click();
    for (const page of pages)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              dcsmcraft.renderer.worldAnimations.models.get("0,200,0")?.userData
                .openness,
          ),
        )
        .toBeLessThan(0.01);
    await open(host);
    await open(guest);
    await host.evaluate(
      (B) => dcsmcraft.breakBlock({ x: 0, y: 200, z: 0, id: B.chest }),
      B,
    );
    for (const page of pages) {
      await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
      await page.waitForFunction(
        () => !dcsmcraft.renderer.worldAnimations.models.has("0,200,0"),
      );
    }
    const total = await host.evaluate(() => {
      const g = dcsmcraft,
        p = [...g.multiplayer.peers.values()][0];
      return [...g.inventory.slots, ...p.inventory.slots, ...g.drops]
        .filter((s) => s?.id === "diamond")
        .reduce((n, s) => n + s.count, 0);
    });
    expect(total).toBe(3);
    expect(
      await host.evaluate(() => dcsmcraft.world.containers["0,200,0"]),
    ).toBeUndefined();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await relay.close();
  }
});
