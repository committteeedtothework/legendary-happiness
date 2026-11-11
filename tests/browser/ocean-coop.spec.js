import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";
test("real relay Survival guest launches one owned boat, rows under host authority, dismounts and exposes no reconnect token", async ({
  browser,
}) => {
  test.setTimeout(120000);
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
      for (let z = 5; z <= 11; z++) g.world.set(4128, 63, z, B.planks);
      Object.assign(g.player, {
        x: 4128.5,
        y: 64.01,
        z: 10.5,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        fallStart: 64.01,
      });
      Object.assign(peer.player, {
        x: 4128.5,
        y: 64.01,
        z: 6.5,
        yaw: 0,
        pitch: -0.8,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        fallStart: 64.01,
      });
      peer.inventory.slots.fill(null);
      peer.inventory.slots[0] = { id: "oak_boat", count: 1 };
      peer.inventory.selected = 0;
      peer.teleport = true;
      g.renderer.loadAround(4128, 6, 2, 30);
      g.multiplayer.sendPrivate(peer);
    }, B);
    await guest.waitForFunction(
      () =>
        dcsmcraft.inventory.held?.id === "oak_boat" &&
        dcsmcraft.player.x > 2000,
    );
    await guest.evaluate(() => {
      dcsmcraft.player.pitch = -0.8;
      dcsmcraft.player.yaw = 0;
      dcsmcraft.resume();
      dcsmcraft.pointerLockFallback = true;
    });
    await guest.waitForTimeout(350);
    await guest.mouse.click(640, 400, { button: "right" });
    await host.waitForFunction(
      () => dcsmcraft.entities.some((e) => e.type === "boat"),
      {},
      { timeout: 10000 },
    );
    expect(
      await host.evaluate(
        () => [...dcsmcraft.multiplayer.peers.values()][0].inventory.held,
      ),
    ).toBeNull();
    await guest.waitForFunction(() =>
      dcsmcraft.entities.some((e) => e.type === "boat"),
    );
    await guest.evaluate(() => {
      const g = dcsmcraft,
        b = g.entities.find((e) => e.type === "boat"),
        dx = b.x - g.player.x,
        dz = b.z - g.player.z;
      g.player.yaw = Math.atan2(-dx, -dz);
      g.player.pitch = Math.atan2(
        b.y + 0.25 - g.player.y - 1.62,
        Math.hypot(dx, dz),
      );
    });
    await guest.waitForTimeout(300);
    await guest.mouse.click(640, 400, { button: "right" });
    await host.waitForFunction(
      () => !![...dcsmcraft.multiplayer.peers.values()][0].player.boatId,
      {},
      { timeout: 10000 },
    );
    await guest.waitForFunction(() => !!dcsmcraft.player.boatId);
    const before = await host.evaluate(
      () => dcsmcraft.entities.find((e) => e.type === "boat").z,
    );
    await guest.keyboard.down("w");
    await guest.waitForTimeout(1800);
    await guest.keyboard.up("w");
    expect(
      await host.evaluate(
        () => dcsmcraft.entities.find((e) => e.type === "boat").z,
      ),
    ).toBeLessThan(before - 5);
    expect(
      await host.evaluate(() => {
        const g = dcsmcraft,
          p = [...g.multiplayer.peers.values()][0],
          b = g.entities.find((e) => e.type === "boat");
        return (
          b.rider === p.id && !JSON.stringify(g.entities).includes(p.resume)
        );
      }),
    ).toBe(true);
    await guest.keyboard.press("ShiftLeft");
    await host.waitForFunction(
      () => ![...dcsmcraft.multiplayer.peers.values()][0].player.boatId,
      {},
      { timeout: 10000 },
    );
    expect(
      await host.evaluate(
        () => dcsmcraft.entities.filter((e) => e.type === "boat").length,
      ),
    ).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    for (const c of contexts) await c.close();
    await relay.close();
  }
});
