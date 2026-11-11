import { test, expect } from "@playwright/test";
import { createRelay } from "../../server/relay.mjs";
let relay, origin;
test.beforeAll(async () => {
  relay = createRelay();
  const { port } = await relay.listen(0, "127.0.0.1");
  origin = `http://127.0.0.1:${port}`;
});
test.afterAll(async () => relay.close());
test("Creative guest selects Stands through host authority while forged Survival grants remain rejected", async ({
  browser,
}) => {
  test.setTimeout(120000);
  const contexts = [];
  try {
    const pages = [];
    for (let i = 0; i < 2; i++) {
      const c = await browser.newContext();
      contexts.push(c);
      const p = await c.newPage();
      pages.push(p);
      await p.addInitScript(() =>
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
      await p.goto(origin);
      await p.waitForFunction(() => window.dcsmcraft?.initialized);
    }
    const [host, guest] = pages;
    await host.locator("[data-action=create]").click();
    await host.locator("[name=mode][value=creative]").check();
    await host.locator("[name=seed]").fill("Creative Stand Relay");
    await host.locator("[data-action=start-world]").click();
    await host.waitForFunction(() => dcsmcraft.running);
    await host.evaluate(() => dcsmcraft.pause());
    await host.locator("[data-action=multiplayer]").click();
    await host.locator("#multiplayer-server").fill(origin);
    await host.locator("[data-role=host]").click();
    const invite = await host.locator("#session-invite").inputValue();
    await guest.locator("[data-action=multiplayer]").click();
    await guest.locator("#multiplayer-invite").fill(invite);
    await guest.locator("[data-role=guest]").click();
    await guest.waitForFunction(() => dcsmcraft.multiplayer.sessionReady);
    await guest.evaluate(() => {
      dcsmcraft.resume();
      dcsmcraft.pointerLockFallback = true;
      dcsmcraft.openInventory("personal");
    });
    await guest.locator("[data-tab=stands]").click();
    await guest.locator("[data-stand=tusk]").click();
    await host.waitForFunction(
      () =>
        [...dcsmcraft.multiplayer.peers.values()][0].player.standData.id ===
        "tusk",
    );
    await guest.waitForFunction(() => dcsmcraft.player.standData.id === "tusk");
    await host.evaluate(() => {
      dcsmcraft.mode = "survival";
      const p = [...dcsmcraft.multiplayer.peers.values()][0];
      p.player.standData.id = null;
    });
    await guest.evaluate(() =>
      dcsmcraft.multiplayer.command("stand", {
        slot: "creative",
        id: "d4c",
        mode: "creative",
      }),
    );
    await guest.waitForTimeout(500);
    expect(
      await host.evaluate(
        () => [...dcsmcraft.multiplayer.peers.values()][0].player.standData.id,
      ),
    ).toBeNull();
  } finally {
    for (const c of contexts) await c.close();
  }
});
