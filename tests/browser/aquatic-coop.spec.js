import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
import { B } from "../../src/data.js";
test("Survival relay validates charged guest tridents, returns the same item once, syncs ocean effects and keeps private reconnect credentials out of projectiles", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const relay = createRelay(),
    { port } = await relay.listen(0, "127.0.0.1"),
    origin = `http://127.0.0.1:${port}`,
    contexts = [],
    pages = [],
    errors = [];
  try {
    for (let n = 0; n < 2; n++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
      page.on("pageerror", (e) => errors.push(e.stack || e.message));
      await page.addInitScript(() =>
        localStorage.setItem(
          "dcsmcraft-settings",
          JSON.stringify({
            graphics: 1,
            renderDistance: 2,
            distantTerrain: false,
            volume: 0,
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
      g.difficulty = "peaceful";
      for (let x = -5; x <= 6; x++)
        for (let z = -6; z <= 6; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y < 204; y++)
            g.world.set(x, y, z, z === -5 ? B.stone : B.air);
        }
      Object.assign(g.player, {
        x: 4.5,
        y: 200,
        z: 4.5,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: 200,
      });
      Object.assign(peer.player, {
        x: 0.5,
        y: 200,
        z: 2.5,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: 200,
      });
      peer.inventory.slots.fill(null);
      peer.inventory.slots[0] = {
        id: "trident",
        count: 1,
        durability: 250,
        enchantments: { loyalty: 3 },
      };
      peer.inventory.selected = 0;
      peer.teleport = true;
      g.multiplayer.sendPrivate(peer);
      g.resume();
    }, B);
    await guest.waitForFunction(
      () =>
        dcsmcraft.inventory.held?.id === "trident" && dcsmcraft.player.y > 190,
    );
    await guest.evaluate(() => {
      dcsmcraft.resume();
      dcsmcraft.pointerLockFallback = true;
      dcsmcraft.player.yaw = 0;
      dcsmcraft.player.pitch = 0;
    });
    await guest.mouse.move(640, 400);
    await guest.waitForTimeout(350);
    await guest.mouse.down({ button: "right" });
    await host.waitForFunction(
      () =>
        !![...dcsmcraft.multiplayer.peers.values()][0].context.tridentCharge,
    );
    await guest.waitForTimeout(700);
    await guest.mouse.up({ button: "right" });
    await host.waitForFunction(
      () => !!dcsmcraft.world.aquatic?.projectiles?.length,
    );
    const data = await host.evaluate(() => ({
      q: dcsmcraft.world.aquatic.projectiles[0],
      resume: [...dcsmcraft.multiplayer.peers.values()][0].resume,
    }));
    expect(JSON.stringify(data.q)).not.toContain(data.resume);
    expect(data.q.owner).toBeTruthy();
    await host.waitForFunction(
      () => {
        const g = dcsmcraft,
          peer = [...g.multiplayer.peers.values()][0];
        return (
          peer.inventory.slots.filter((s) => s?.id === "trident").length ===
            1 && !g.world.aquatic.projectiles.length
        );
      },
      {},
      { timeout: 15000 },
    );
    await guest.waitForFunction(
      () => dcsmcraft.inventory.slots[0]?.durability === 249,
    );
    expect(
      await host.evaluate(
        () =>
          [...dcsmcraft.multiplayer.peers.values()][0].inventory.slots.filter(
            (s) => s?.id === "trident",
          ).length,
      ),
    ).toBe(1);
    await host.evaluate(() => {
      const peer = [...dcsmcraft.multiplayer.peers.values()][0];
      peer.player.effects = { resistance: { ticks: 400, level: 3 } };
      dcsmcraft.multiplayer.sendPrivate(peer);
    });
    await guest.waitForFunction(
      () => dcsmcraft.player.effects?.resistance?.level === 3,
    );
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
    await relay.close();
  }
});
